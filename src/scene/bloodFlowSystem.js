import * as THREE from 'three';
import { ARTERY_DIMENSIONS, getLumenCrossSection } from '../config/anatomyData.js';

/**
 * High-Performance Hemodynamic Blood Flow & Cellular InstancedMesh System
 * Simulates biconcave Erythrocytes (RBCs), microvillous Leukocytes (WBCs), and Platelets
 * exhibiting Poiseuille laminar flow, stenotic jet acceleration, and post-stenotic turbulent eddies,
 * plus live Velocity & Shear Heatmap color-coding and X-Ray streamline paths.
 */

function createPRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/**
 * Evans & Fung anatomical biconcave disc geometry for Red Blood Cells (Erythrocytes).
 */
function createErythrocyteGeometry(radius = 0.095) {
  const points = [];
  const steps = 18;
  // Upper profile from center (r=0) -> rim (r=R) -> lower center (r=0)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 -> 1
    const rho = Math.sin(t * Math.PI); // 0 at poles, 1 at rim
    const r = rho * radius;
    const oneMinusRho2 = Math.max(0, 1 - rho * rho);
    const halfThickness =
      0.5 *
      radius *
      Math.sqrt(oneMinusRho2) *
      (0.207 + 2.003 * rho * rho - 1.123 * Math.pow(rho, 4));
    const y = (t <= 0.5 ? 1 : -1) * halfThickness * 0.92;
    points.push(new THREE.Vector2(Math.max(0.0005, r), y));
  }
  const geom = new THREE.LatheGeometry(points, 18);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Microvillous bumpy leukocyte (White Blood Cell) geometry.
 */
function createLeukocyteGeometry(radius = 0.13) {
  const geom = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();
    const bump =
      1.0 +
      0.085 * Math.sin(dir.x * 11.0) * Math.cos(dir.y * 11.0) +
      0.065 * Math.sin(dir.z * 14.0 + dir.x * 7.0);
    v.multiplyScalar(bump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

/**
 * Small oblate discoid platelet (Thrombocyte) geometry.
 */
function createPlateletGeometry(radius = 0.044) {
  const geom = new THREE.IcosahedronGeometry(radius, 1);
  geom.scale(1.15, 0.36, 0.92);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Writes scientific heatmap color (cool blue -> cyan -> yellow -> orange -> bright red) into target THREE.Color.
 */
function setVelocityHeatmapColor(outColor, t) {
  const c = clamp01(t);
  let r, g, b;
  if (c < 0.25) {
    const f = c / 0.25;
    r = 0.106 * (1 - f) + 0.0 * f;
    g = 0.431 * (1 - f) + 0.831 * f;
    b = 1.0 * (1 - f) + 0.784 * f;
  } else if (c < 0.55) {
    const f = (c - 0.25) / 0.3;
    r = 0.0 * (1 - f) + 1.0 * f;
    g = 0.831 * (1 - f) + 0.745 * f;
    b = 0.784 * (1 - f) + 0.102 * f;
  } else if (c < 0.8) {
    const f = (c - 0.55) / 0.25;
    r = 1.0;
    g = 0.745 * (1 - f) + 0.294 * f;
    b = 0.102 * (1 - f) + 0.122 * f;
  } else {
    const f = (c - 0.8) / 0.2;
    r = 1.0;
    g = 0.294 * (1 - f) + 0.078 * f;
    b = 0.122 * (1 - f) + 0.267 * f;
  }
  outColor.setRGB(r, g, b);
}

/**
 * Creates subtle translucent flow streamline curves inside the lumen
 * (vivid in X-Ray and Velocity & Shear Heatmap modes, very subtle in Anatomical mode).
 */
function createStreamlineOverlay() {
  const group = new THREE.Group();
  const rng = createPRNG(99123);
  const lineCount = 20;
  const ptsPerLine = 72;
  const lines = [];

  for (let i = 0; i < lineCount; i++) {
    const radialRing = i < 6 ? 0.24 : i < 13 ? 0.55 : 0.79;
    const basePhi = (i / lineCount) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const positions = new Float32Array(ptsPerLine * 3);
    const colors = new Float32Array(ptsPerLine * 3);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const line = new THREE.Line(geom, mat);
    group.add(line);
    lines.push({
      line,
      geom,
      mat,
      positions,
      colors,
      radialRing,
      basePhi,
      swirlSign: i % 2 === 0 ? 1 : -1,
      phaseOffset: rng() * Math.PI * 2
    });
  }

  const tmpColor = new THREE.Color();

  function update(time, effectiveStenosisPct, viewMode, thrombusOcclusion = 0) {
    const s = clamp01(effectiveStenosisPct / 100);
    const { xMin, xMax, plaqueCenterX } = ARTERY_DIMENSIONS;

    const targetOpacity =
      viewMode === 'xray' ? 0.34 : viewMode === 'heatmap' ? 0.42 : 0.0;
    group.visible = targetOpacity > 0.01;
    if (!group.visible) return;

    const turbFactor = smoothstep(0.18, 0.72, s) * (1.0 - thrombusOcclusion * 0.85);
    const occluded = thrombusOcclusion >= 0.82;

    for (const item of lines) {
      item.mat.opacity = targetOpacity;
      const pos = item.positions;
      const col = item.colors;

      for (let j = 0; j < ptsPerLine; j++) {
        const f = j / (ptsPerLine - 1);
        const x = xMin + 0.15 + (xMax - xMin - 0.3) * f;
        const cross = getLumenCrossSection(x, s);

        // Post-stenotic swirling helical eddy displacement on outer streamlines
        const postDist = x - (plaqueCenterX + 0.25);
        const postEnv =
          postDist > 0
            ? Math.sin(Math.min(1, postDist / 4.8) * Math.PI) * Math.exp(-postDist * 0.22)
            : 0;

        const swirlAngle =
          item.basePhi +
          item.swirlSign *
            turbFactor *
            postEnv *
            item.radialRing *
            (3.4 * Math.sin(postDist * 1.45 - time * 4.2 + item.phaseOffset) + 1.8 * postDist);

        const radialPulse =
          item.radialRing *
          (1.0 +
            0.16 *
              turbFactor *
              postEnv *
              Math.cos(postDist * 2.1 - time * 5.0 + item.phaseOffset));

        const r = Math.min(cross.radius * 0.88, cross.radius * radialPulse);
        const y = cross.centerY + r * Math.sin(swirlAngle);
        const z = cross.centerZ + r * Math.cos(swirlAngle);

        pos[j * 3] = x;
        pos[j * 3 + 1] = y;
        pos[j * 3 + 2] = z;

        // Color streamline by local flow speed + flowing pulse shimmer (dimmed downstream if occluded)
        const areaRatio = Math.max(0.1, (1 - cross.narrowing) * (1 - cross.narrowing));
        const localSpeedNorm = occluded
          ? 0.02
          : clamp01(((1.0 / areaRatio) - 0.85) / 4.2) * (1.0 - thrombusOcclusion * 0.65);
        const downstreamMask =
          thrombusOcclusion > 0.2 && x > plaqueCenterX - 0.2
            ? Math.max(0.04, 1.0 - thrombusOcclusion)
            : 1.0;
        const shimmer =
          (0.72 +
            0.28 *
              Math.sin(
                f * 26.0 - time * (occluded ? 0.8 : 6.5 + localSpeedNorm * 6.0) + item.phaseOffset
              )) *
          downstreamMask;

        if (viewMode === 'heatmap') {
          setVelocityHeatmapColor(tmpColor, localSpeedNorm * 0.92 + 0.08);
          col[j * 3] = tmpColor.r * shimmer;
          col[j * 3 + 1] = tmpColor.g * shimmer;
          col[j * 3 + 2] = tmpColor.b * shimmer;
        } else {
          // X-Ray luminous cyan/crimson flow lines
          col[j * 3] = (0.25 + 0.75 * localSpeedNorm) * shimmer;
          col[j * 3 + 1] = (0.82 - 0.45 * localSpeedNorm) * shimmer;
          col[j * 3 + 2] = (1.0 - 0.55 * localSpeedNorm) * shimmer;
        }
      }

      item.geom.attributes.position.needsUpdate = true;
      item.geom.attributes.color.needsUpdate = true;
    }
  }

  return { group, update };
}

/**
 * Main Blood Flow InstancedMesh System
 */
export function createBloodFlowSystem() {
  const group = new THREE.Group();
  const rng = createPRNG(602214);

  const RBC_COUNT = 1040;
  const WBC_COUNT = 46;
  const PLATELET_COUNT = 180;

  // Materials use white base color so setColorAt controls exact anatomical vs heatmap hues cleanly
  const rbcMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.2,
    metalness: 0.02,
    clearcoat: 0.94,
    clearcoatRoughness: 0.12,
    sheen: 0.45,
    sheenColor: new THREE.Color('#ff8899'),
    sheenRoughness: 0.35
  });

  const wbcMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.52,
    clearcoatRoughness: 0.3,
    sheen: 0.5,
    sheenColor: new THREE.Color('#cce6ff')
  });

  const plateletMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.35,
    metalness: 0.04,
    clearcoat: 0.45,
    clearcoatRoughness: 0.28
  });

  const rbcMesh = new THREE.InstancedMesh(createErythrocyteGeometry(0.092), rbcMat, RBC_COUNT);
  const wbcMesh = new THREE.InstancedMesh(createLeukocyteGeometry(0.128), wbcMat, WBC_COUNT);
  const plateletMesh = new THREE.InstancedMesh(createPlateletGeometry(0.042), plateletMat, PLATELET_COUNT);

  rbcMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wbcMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plateletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  rbcMesh.castShadow = false;
  rbcMesh.receiveShadow = true;
  wbcMesh.receiveShadow = true;

  group.add(rbcMesh, wbcMesh, plateletMesh);

  // Streamlines overlay for X-Ray and Heatmap clarity
  const streamlines = createStreamlineOverlay();
  group.add(streamlines.group);

  // Build particle state arrays
  function makeParticlePool(count, cellRadius, type) {
    const pool = new Array(count);
    const { xMin, xMax } = ARTERY_DIMENSIONS;

    for (let i = 0; i < count; i++) {
      // Platelets tend slightly closer to vessel wall (margination); RBCs fill core uniformly by area
      const uRad = type === 'platelet' ? 0.35 + 0.62 * Math.sqrt(rng()) : Math.sqrt(rng()) * 0.92;
      const baseColor = new THREE.Color();

      if (type === 'rbc') {
        // Rich arterial oxygenated crimson with subtle biological variation
        const shade = 0.86 + rng() * 0.24;
        baseColor.setRGB(
          Math.min(1, 0.76 * shade),
          0.065 * shade,
          0.115 * shade
        );
      } else if (type === 'wbc') {
        baseColor.setRGB(0.84 + rng() * 0.1, 0.89 + rng() * 0.08, 0.96);
      } else {
        baseColor.setRGB(0.95, 0.87 + rng() * 0.08, 0.68 + rng() * 0.12);
      }

      pool[i] = {
        x: xMin + rng() * (xMax - xMin),
        rNorm: uRad,
        baseRNorm: uRad,
        phi: rng() * Math.PI * 2,
        rotX: rng() * Math.PI * 2,
        rotY: rng() * Math.PI * 2,
        rotZ: rng() * Math.PI * 2,
        spinRate: (rng() - 0.5) * 2.2,
        eddyPhase: rng() * Math.PI * 2,
        eddyDir: rng() > 0.5 ? 1 : -1,
        scale: 0.88 + rng() * 0.24,
        cellRadius,
        baseColor
      };
    }
    return pool;
  }

  const rbcPool = makeParticlePool(RBC_COUNT, 0.095, 'rbc');
  const wbcPool = makeParticlePool(WBC_COUNT, 0.132, 'wbc');
  const plateletPool = makeParticlePool(PLATELET_COUNT, 0.045, 'platelet');

  // Reusable scratch objects (zero per-frame allocations)
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const xrayRbcColor = new THREE.Color('#ff385c');
  const xrayWbcColor = new THREE.Color('#8be9ff');
  const xrayPltColor = new THREE.Color('#ffe07d');

  let simTime = 0;

  function updatePool(
    pool,
    mesh,
    type,
    dt,
    effectiveStenosis,
    pulseVal,
    heartRateMode,
    viewMode,
    balloonOcclusion,
    thrombusOcclusion
  ) {
    const { xMin, xMax, plaqueCenterX } = ARTERY_DIMENSIONS;
    const isExercise = heartRateMode === 'exercise';
    const hrSpeedScale = isExercise ? 1.72 : 1.0;
    const pulsatileDrive = 0.66 + 0.62 * pulseVal;
    const baseAxialSpeed = 2.05 * hrSpeedScale * pulsatileDrive;

    // Temporary balloon hold or progressive thrombotic occlusion slows transmission
    const occlusionLevel = Math.max(thrombusOcclusion, balloonOcclusion * 0.92);
    const transmission = Math.max(0.0, 1.0 - Math.pow(occlusionLevel, 1.55));
    const isThrombusBlocked = thrombusOcclusion >= 0.45;
    const clotFrontX = plaqueCenterX - 0.92;
    const clotBackX = plaqueCenterX + 0.92;

    const turbGlobal = smoothstep(0.18, 0.72, effectiveStenosis) * (1.0 - occlusionLevel * 0.85);
    const isHeatmap = viewMode === 'heatmap';
    const isXray = viewMode === 'xray';

    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      const cross = getLumenCrossSection(p.x, effectiveStenosis);

      // 1. Parabolic Poiseuille laminar velocity profile (fastest along centerline)
      const parabolic = 1.0 - 0.58 * p.rNorm * p.rNorm;

      // 2. Continuity jet acceleration through stenotic narrowing: v ~ 1 / (1 - narrowing)^2
      const areaRatio = Math.max(0.14, (1.0 - cross.narrowing) * (1.0 - cross.narrowing));
      const jetMultiplier = Math.min(4.8, 1.0 / areaRatio);

      // 3. Post-stenotic turbulent swirling eddies downstream of the plaque shoulder
      const postX = p.x - (plaqueCenterX + 0.25);
      const inPostZone = postX > 0 && postX < 4.9 && turbGlobal > 0.01;
      let postEnv = 0;
      let eddyAxialMod = 1.0;

      if (inPostZone) {
        postEnv = Math.sin((postX / 4.9) * Math.PI) * Math.exp(-postX * 0.24) * turbGlobal;

        if (p.rNorm > 0.44) {
          const outerFactor = (p.rNorm - 0.44) / 0.56;
          const swirlSpeed = (2.8 + 4.8 * outerFactor) * postEnv * hrSpeedScale * p.eddyDir;
          p.phi += swirlSpeed * dt;

          const radialOsc =
            Math.sin(simTime * 5.2 + p.eddyPhase + postX * 1.9) * 0.22 * postEnv;
          p.rNorm = Math.max(0.24, Math.min(0.92, p.baseRNorm + radialOsc));

          const eddyPocket = Math.sin(postX * 1.85 + p.eddyPhase - simTime * 2.6);
          eddyAxialMod = Math.max(
            -0.28 * postEnv,
            1.0 - postEnv * (0.72 + 0.45 * outerFactor) + 0.28 * eddyPocket * postEnv
          );
        } else {
          eddyAxialMod = 1.0 + postEnv * 0.95;
          p.phi += 0.85 * postEnv * p.eddyDir * dt;
          p.rNorm += (p.baseRNorm - p.rNorm) * Math.min(1, dt * 3.0);
        }
      } else {
        p.rNorm += (p.baseRNorm - p.rNorm) * Math.min(1, dt * 2.5);
      }

      // Compute axial velocity including Thrombosis Stagnation & Balloon Hold physics
      let localVx = baseAxialSpeed * parabolic * jetMultiplier * eddyAxialMod * transmission;

      if (isThrombusBlocked) {
        const blockStrength = smoothstep(0.45, 0.92, thrombusOcclusion);
        if (p.x < clotFrontX) {
          // Upstream proximal blood cells approach clot, pile up densely, and pulse/stagnate in place!
          const distToClot = clotFrontX - p.x;
          const pileZone = smoothstep(0.0, 3.8, distToClot);
          // Cells farther back slowly creep forward to pack behind the clot; cells right at clot face oscillate with heartbeat
          const creepSpeed = (0.38 * pileZone + 0.05) * (1.0 - 0.65 * blockStrength);
          const stasisOsc = (pulseVal - 0.36) * 0.42 * blockStrength * (1.0 - pileZone * 0.5);
          localVx = localVx * (1 - blockStrength) + (creepSpeed + stasisOsc) * blockStrength;

          // Subtle sluggish Brownian/swirl agitation in backed-up stagnant blood column
          p.phi += Math.sin(simTime * 1.6 + p.eddyPhase) * 0.22 * blockStrength * dt;
        } else if (p.x >= clotFrontX && p.x <= clotBackX) {
          // Inside occluded thrombus region: stop & gently get nudged upstream or halted
          if (blockStrength > 0.72) {
            localVx = -0.35 * blockStrength; // Push back to proximal clot face so cells visually stack upstream
          } else {
            localVx *= 0.2;
          }
        } else {
          // Downstream of total occlusion: blood flow completely halts!
          localVx = localVx * (1.0 - blockStrength);
        }
      }

      // Advance axial position
      p.x += localVx * dt;

      // Prevent upstream backed-up cells from penetrating the 100% occluded thrombus barrier
      if (thrombusOcclusion > 0.75 && p.x > clotFrontX - 0.05 && p.x < plaqueCenterX + 0.1) {
        // Pack cells across the proximal stagnation buffer [clotFrontX - 2.6, clotFrontX - 0.08]
        p.x = clotFrontX - 0.08 - (p.eddyPhase / (Math.PI * 2)) * 0.35;
      }

      // Wrap seamlessly from outflow back to inflow (only when flow is moving)
      if (p.x > xMax + 0.12) {
        p.x = xMin - 0.1 + ((p.x - xMax) % 0.4);
        p.rNorm = p.baseRNorm;
        p.phi = (p.phi + 0.7) % (Math.PI * 2);
      } else if (p.x < xMin - 0.15) {
        p.x = xMin + 0.05;
      }

      // Compute exact lumen-safe 3D position (guaranteed zero wall clipping)
      const curCross = getLumenCrossSection(p.x, effectiveStenosis);
      const maxSafeR = Math.max(0.03, curCross.radius - p.cellRadius * 0.92);
      const rWorld = p.rNorm * maxSafeR;

      const y = curCross.centerY + rWorld * Math.sin(p.phi);
      const z = curCross.centerZ + rWorld * Math.cos(p.phi);

      // Cell orientation: laminar streamline alignment -> chaotic tumbling -> slow stasis drift
      const motionScale = thrombusOcclusion > 0.75 ? 0.25 : 1.0;
      const tumbleAmp = (0.35 + postEnv * 5.8 + curCross.narrowing * 1.6) * motionScale;
      if (type === 'rbc') {
        if (postEnv < 0.08) {
          const targetRotZ = Math.PI * 0.5 + Math.sin(simTime * 2.0 + p.eddyPhase) * 0.22;
          p.rotZ += (targetRotZ - p.rotZ) * Math.min(1, dt * 4.5);
          p.rotX += p.spinRate * 0.35 * motionScale * dt;
          p.rotY = p.phi * 0.25 + Math.cos(simTime * 1.6 + p.eddyPhase) * 0.25;
        } else {
          p.rotX += (p.spinRate + 2.4 * p.eddyDir) * tumbleAmp * dt;
          p.rotY += (1.9 - p.spinRate) * tumbleAmp * dt;
          p.rotZ += 2.2 * tumbleAmp * dt;
        }
      } else {
        p.rotX += (0.8 + Math.abs(p.spinRate)) * tumbleAmp * dt;
        p.rotY += 1.1 * tumbleAmp * dt;
      }

      dummy.position.set(p.x, y, z);
      dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Per-instance color update
      if (isHeatmap) {
        const speedScore = clamp01((Math.abs(localVx) - 0.5) / (isExercise ? 8.2 : 5.4));
        const shearBoost =
          thrombusOcclusion > 0.75
            ? 0.0
            : curCross.narrowing * 0.42 + (p.rNorm > 0.72 ? curCross.narrowing * 0.25 : 0);
        setVelocityHeatmapColor(tmpColor, clamp01(speedScore * 0.82 + shearBoost));
        mesh.setColorAt(i, tmpColor);
      } else if (isXray) {
        if (type === 'rbc') {
          const boost = 0.78 + 0.22 * clamp01((jetMultiplier - 1) / 3);
          tmpColor.copy(xrayRbcColor).multiplyScalar(boost);
          mesh.setColorAt(i, tmpColor);
        } else if (type === 'wbc') {
          mesh.setColorAt(i, xrayWbcColor);
        } else {
          mesh.setColorAt(i, xrayPltColor);
        }
      } else {
        // Darken stagnant upstream/downstream cells slightly during acute occlusion (deoxygenated stasis!)
        if (thrombusOcclusion > 0.5 && type === 'rbc') {
          const stasisTint = 1.0 - 0.34 * smoothstep(0.5, 1.0, thrombusOcclusion);
          tmpColor.copy(p.baseColor).multiplyScalar(stasisTint);
          mesh.setColorAt(i, tmpColor);
        } else {
          mesh.setColorAt(i, p.baseColor);
        }
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  function update(
    dt,
    effectiveStenosisPct,
    pulseVal,
    heartRateMode,
    viewMode,
    { balloonOcclusion = 0, thrombusOcclusion = 0 } = {}
  ) {
    simTime += dt;
    const stenosis = clamp01(effectiveStenosisPct / 100);

    updatePool(
      rbcPool,
      rbcMesh,
      'rbc',
      dt,
      stenosis,
      pulseVal,
      heartRateMode,
      viewMode,
      balloonOcclusion,
      thrombusOcclusion
    );
    updatePool(
      wbcPool,
      wbcMesh,
      'wbc',
      dt,
      stenosis,
      pulseVal,
      heartRateMode,
      viewMode,
      balloonOcclusion,
      thrombusOcclusion
    );
    updatePool(
      plateletPool,
      plateletMesh,
      'platelet',
      dt,
      stenosis,
      pulseVal,
      heartRateMode,
      viewMode,
      balloonOcclusion,
      thrombusOcclusion
    );

    streamlines.update(simTime, effectiveStenosisPct, viewMode, thrombusOcclusion);
  }

  return {
    group,
    update
  };
}
