import * as THREE from 'three';
import { ARTERY_DIMENSIONS, getLumenCrossSection } from '../config/anatomyData.js';

/**
 * Clinical Intervention — PCI Balloon Angioplasty & Procedural Brushed-Titanium Diamond-Strut Stent
 * Animates:
 *   1. Metallic guidewire with curved J-tip advancing through the stenotic lumen
 *   2. Angioplasty balloon catheter + crimped metallic stent tracking to plaque center
 *   3. Translucent balloon inflation compressing the plaque outward & expanding the diamond-strut stent
 *   4. Balloon deflation leaving the expanded metallic stent scaffolding the widened lumen
 *   5. Catheter & guidewire withdrawal restoring unobstructed laminar blood flow
 */

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/**
 * Builds procedural brushed-titanium micro-streak roughness map for the stent struts.
 */
function createBrushedTitaniumRoughness() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#484848';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const shade = 52 + Math.floor(((Math.sin(y * 1.7) * 0.5 + 0.5) * 44));
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the procedural angioplasty balloon geometry with tapered conical shoulders.
 * Unit working radius (scaled dynamically in Y & Z during inflation/deflation).
 */
function createBalloonGeometry(bodyHalfLen = 2.15, shoulderLen = 0.52) {
  const pts = [];
  const totalHalf = bodyHalfLen + shoulderLen;
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const x = -totalHalf + f * (2 * totalHalf);
    const absX = Math.abs(x);
    let r;
    if (absX <= bodyHalfLen) {
      // Smooth cylindrical working segment with very subtle pressure barrel crown
      const u = absX / bodyHalfLen;
      r = 1.0 - 0.025 * u * u;
    } else {
      // Conical balloon taper down to catheter shaft
      const t = (absX - bodyHalfLen) / shoulderLen;
      r = Math.max(0.055, (1.0 - smoothstep(0, 1, t)) * 0.975 + 0.055 * smoothstep(0, 1, t));
    }
    pts.push(new THREE.Vector2(r, x));
  }
  const geom = new THREE.LatheGeometry(pts, 40);
  // Rotate LatheGeometry (Y-axis) so balloon aligns along X-axis
  geom.rotateZ(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds the curved-J metallic PCI guidewire aligned along the X-axis.
 */
function createGuidewireGeometry() {
  const pts = [];
  const len = 15.2;
  for (let i = 0; i <= 26; i++) {
    const x = -len + (i / 26) * (len - 0.35);
    pts.push(new THREE.Vector3(x, 0, 0));
  }
  // Soft clinical J-tip hook at distal leading end
  pts.push(new THREE.Vector3(-0.1, 0.03, 0.01));
  pts.push(new THREE.Vector3(0.14, 0.12, 0.04));
  pts.push(new THREE.Vector3(0.26, 0.24, 0.06));
  pts.push(new THREE.Vector3(0.18, 0.34, 0.05));
  pts.push(new THREE.Vector3(0.04, 0.33, 0.02));

  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 96, 0.024, 8, false);
}

/**
 * Creates the full PCI Balloon Angioplasty & Metallic Stent Deployment controller.
 */
export function createStentSystem() {
  const group = new THREE.Group();
  group.visible = false;

  const { xMin, xMax, plaqueCenterX, lumenRadius } = ARTERY_DIMENSIONS;

  // 1. Metallic Surgical Guidewire
  const guidewireMat = new THREE.MeshPhysicalMaterial({
    color: '#e2e9f2',
    metalness: 0.94,
    roughness: 0.18,
    clearcoat: 0.6
  });
  const guidewireMesh = new THREE.Mesh(createGuidewireGeometry(), guidewireMat);
  guidewireMesh.castShadow = true;
  group.add(guidewireMesh);

  // 2. Angioplasty Balloon Catheter Group
  const catheterGroup = new THREE.Group();
  group.add(catheterGroup);

  // Proximal catheter delivery shaft running from balloon back out -X
  const shaftGeom = new THREE.CylinderGeometry(0.046, 0.046, 12.0, 14);
  shaftGeom.rotateZ(Math.PI / 2);
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: '#2c4868',
    roughness: 0.28,
    metalness: 0.22,
    clearcoat: 0.75
  });
  const shaftMesh = new THREE.Mesh(shaftGeom, shaftMat);
  shaftMesh.position.x = -8.2;
  catheterGroup.add(shaftMesh);

  // Inner shaft core inside balloon
  const innerCoreGeom = new THREE.CylinderGeometry(0.038, 0.038, 5.4, 12);
  innerCoreGeom.rotateZ(Math.PI / 2);
  const innerCoreMesh = new THREE.Mesh(innerCoreGeom, shaftMat);
  catheterGroup.add(innerCoreMesh);

  // Two bright platinum radiopaque marker bands marking balloon working edges
  const markerGeom = new THREE.CylinderGeometry(0.056, 0.056, 0.14, 16);
  markerGeom.rotateZ(Math.PI / 2);
  const markerMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    metalness: 0.98,
    roughness: 0.1,
    emissive: new THREE.Color('#38bdf8'),
    emissiveIntensity: 0.35
  });
  const markerProx = new THREE.Mesh(markerGeom, markerMat);
  markerProx.position.x = -2.1;
  const markerDist = new THREE.Mesh(markerGeom, markerMat);
  markerDist.position.x = 2.1;
  catheterGroup.add(markerProx, markerDist);

  // Translucent Angioplasty Balloon
  const balloonMat = new THREE.MeshPhysicalMaterial({
    color: '#7dd3fc',
    roughness: 0.12,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.44,
    sheen: 0.65,
    sheenColor: new THREE.Color('#e0f2fe'),
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const balloonMesh = new THREE.Mesh(createBalloonGeometry(2.15, 0.54), balloonMat);
  catheterGroup.add(balloonMesh);

  // 3. Procedural Diamond-Strut Brushed Titanium Metallic Stent (InstancedMesh for silky 60 FPS morphing)
  const stentGroup = new THREE.Group();
  group.add(stentGroup);

  const RINGS = 7; // 7 axial crown rings forming 6 columns of diamond cells
  const CELLS_AROUND = 10; // 10 circumferential diamond cells around the lumen
  const STRUTS_PER_RING = CELLS_AROUND * 2;
  const DIAG_STRUT_COUNT = RINGS * STRUTS_PER_RING; // 140 diagonal diamond struts
  const BRIDGE_COUNT = (RINGS - 1) * CELLS_AROUND; // 60 longitudinal apex connectors
  const TOTAL_STRUTS = DIAG_STRUT_COUNT + BRIDGE_COUNT;
  const TOTAL_NODES = RINGS * CELLS_AROUND * 2;

  const titaniumMat = new THREE.MeshPhysicalMaterial({
    color: '#d8e2ee',
    metalness: 0.92,
    roughness: 0.24,
    roughnessMap: createBrushedTitaniumRoughness(),
    clearcoat: 0.42,
    clearcoatRoughness: 0.18,
    sheen: 0.25,
    sheenColor: new THREE.Color('#eef6ff')
  });

  // Unit-height Y-aligned cylinder stretched cleanly between strut endpoints
  const strutBaseGeom = new THREE.CylinderGeometry(0.024, 0.024, 1.0, 8, 1);
  const stentStrutsMesh = new THREE.InstancedMesh(strutBaseGeom, titaniumMat, TOTAL_STRUTS);
  stentStrutsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stentStrutsMesh.castShadow = true;
  stentStrutsMesh.receiveShadow = true;

  // Rounded titanium crown joint spheres at every diamond apex for seamless machined finish
  const nodeBaseGeom = new THREE.SphereGeometry(0.027, 8, 6);
  const stentNodesMesh = new THREE.InstancedMesh(nodeBaseGeom, titaniumMat, TOTAL_NODES);
  stentNodesMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  stentGroup.add(stentStrutsMesh, stentNodesMesh);

  // Scratch vectors/matrices for zero-allocation stent expansion animation
  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const upVec = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();

  function updateStentLattice(radius, expansionFrac, centerX, centerY, centerZ) {
    // Realistic subtle stent foreshortening as diamonds open radially
    const totalLength = 4.45 - 0.25 * expansionFrac;
    const ringSpacing = totalLength / RINGS;
    const halfZig = ringSpacing * 0.44;
    const dTheta = (Math.PI * 2) / CELLS_AROUND;

    let strutIdx = 0;
    let nodeIdx = 0;

    const placeStrut = (ax, ay, az, bx, by, bz, thickness = 1.0) => {
      pA.set(ax, ay, az);
      pB.set(bx, by, bz);
      mid.addVectors(pA, pB).multiplyScalar(0.5);
      dir.subVectors(pB, pA);
      const len = dir.length();
      if (len < 1e-4) return;
      dir.divideScalar(len);
      quat.setFromUnitVectors(upVec, dir);
      scaleVec.set(thickness, len, thickness);
      mat4.compose(mid, quat, scaleVec);
      stentStrutsMesh.setMatrixAt(strutIdx++, mat4);
    };

    const placeNode = (x, y, z) => {
      mid.set(x, y, z);
      quat.identity();
      scaleVec.setScalar(1.0);
      mat4.compose(mid, quat, scaleVec);
      stentNodesMesh.setMatrixAt(nodeIdx++, mat4);
    };

    // Build alternating phase-mirrored crown rings to create true diamond cells
    for (let r = 0; r < RINGS; r++) {
      const ringCenterX = centerX - totalLength * 0.5 + (r + 0.5) * ringSpacing;
      const phaseFlip = r % 2 === 0 ? 1 : -1;

      for (let c = 0; c < CELLS_AROUND; c++) {
        const th0 = c * dTheta;
        const thMid = (c + 0.5) * dTheta;
        const th1 = (c + 1) * dTheta;

        const x0 = ringCenterX - halfZig * phaseFlip;
        const xMid = ringCenterX + halfZig * phaseFlip;

        const y0 = centerY + radius * Math.sin(th0);
        const z0 = centerZ + radius * Math.cos(th0);
        const yM = centerY + radius * Math.sin(thMid);
        const zM = centerZ + radius * Math.cos(thMid);
        const y1 = centerY + radius * Math.sin(th1);
        const z1 = centerZ + radius * Math.cos(th1);

        // Two chevron struts forming half of each diamond cell
        placeStrut(x0, y0, z0, xMid, yM, zM, 1.0);
        placeStrut(xMid, yM, zM, x0, y1, z1, 1.0);

        // Crown apex spheres
        placeNode(x0, y0, z0);
        placeNode(xMid, yM, zM);

        // Longitudinal bridge strut connecting facing peaks/valleys between adjacent rings
        if (r < RINGS - 1) {
          const nextRingCenterX = centerX - totalLength * 0.5 + (r + 1.5) * ringSpacing;
          const nextPhaseFlip = (r + 1) % 2 === 0 ? 1 : -1;
          const bridgeTheta = phaseFlip > 0 ? thMid : th0;
          const bx0 = ringCenterX + halfZig;
          const bx1 = nextRingCenterX - halfZig * (nextPhaseFlip > 0 ? 1 : -1);
          // Connect nearest facing crowns cleanly
          const xStart = bx0;
          const xEnd = nextRingCenterX - halfZig;
          const by = centerY + radius * Math.sin(bridgeTheta);
          const bz = centerZ + radius * Math.cos(bridgeTheta);
          placeStrut(xStart, by, bz, xEnd, by, bz, 0.92);
        }
      }
    }

    stentStrutsMesh.instanceMatrix.needsUpdate = true;
    stentNodesMesh.instanceMatrix.needsUpdate = true;
  }

  // Timeline state
  let mode = 'idle'; // 'idle' | 'deploying' | 'deployed'
  let timer = 0;
  let plaqueCompression = 0; // 0..1
  let balloonOcclusion = 0; // 0..1
  let phaseLabel = 'Standby';
  let initialStenosisAtDeploy = 0.3;

  // Initialize stent lattice once
  updateStentLattice(0.26, 0, plaqueCenterX, 0, 0);

  function startDeployment(currentStenosisPct) {
    if (mode === 'deploying' || mode === 'deployed') return;
    mode = 'deploying';
    timer = 0;
    plaqueCompression = 0;
    balloonOcclusion = 0;
    initialStenosisAtDeploy = Math.max(0.05, Math.min(0.75, currentStenosisPct / 100));
    phaseLabel = 'Advancing Guidewire…';
    group.visible = true;
    guidewireMesh.visible = true;
    catheterGroup.visible = false;
    stentGroup.visible = false;
  }

  function reset() {
    mode = 'idle';
    timer = 0;
    plaqueCompression = 0;
    balloonOcclusion = 0;
    phaseLabel = 'Standby';
    group.visible = false;
  }

  function setViewMode(viewMode) {
    if (viewMode === 'xray') {
      // Bright fluoroscopic radiopaque stent look in X-Ray mode!
      titaniumMat.color.set('#e0f4ff');
      titaniumMat.emissive.set('#38bdf8');
      titaniumMat.emissiveIntensity = 0.25;
      balloonMat.opacity = 0.36;
    } else if (viewMode === 'heatmap') {
      titaniumMat.color.set('#cfdbe8');
      titaniumMat.emissive.set('#000000');
      titaniumMat.emissiveIntensity = 0;
      balloonMat.opacity = 0.38;
    } else {
      titaniumMat.color.set('#d8e2ee');
      titaniumMat.emissive.set('#000000');
      titaniumMat.emissiveIntensity = 0;
      balloonMat.opacity = 0.44;
    }
  }

  /**
   * Per-frame animation update. Returns live intervention metrics & whether plaque geometry needs refresh.
   */
  function update(dt, pulseVal, stenosisPct) {
    const prevCompression = plaqueCompression;

    if (mode === 'idle') {
      return {
        mode,
        plaqueCompression: 0,
        balloonOcclusion: 0,
        phaseLabel,
        compressionChanged: false
      };
    }

    const sRaw = Math.max(0, Math.min(0.75, stenosisPct / 100));
    const currentEffectiveS = sRaw * (1.0 - 0.88 * plaqueCompression);
    const cross = getLumenCrossSection(plaqueCenterX, currentEffectiveS);

    // Target expanded stent radius snugly scaffolds the widened lumen just inside endothelium
    const crimpedR = Math.min(0.24, Math.max(0.14, getLumenCrossSection(plaqueCenterX, initialStenosisAtDeploy).radius * 0.62));
    const targetDeployedR = lumenRadius * (1.0 - sRaw * 0.12) - 0.035;

    if (mode === 'deploying') {
      timer += dt;

      // Phase 1 (0.0 – 1.4s): Guidewire advances through narrowed lumen
      const wireAdvance = smoothstep(0.0, 1.4, timer);
      // Phase 2 (1.35 – 2.55s): Balloon catheter + crimped stent track along wire to plaqueCenterX
      const cathAdvance = smoothstep(1.35, 2.55, timer);
      // Phase 3 (2.6 – 4.5s): High-pressure balloon inflation & plaque compression
      const inflate = smoothstep(2.6, 4.45, timer);
      // Phase 4 (4.65 – 5.75s): Balloon deflation (stent stays locked expanded!)
      const deflate = smoothstep(4.65, 5.75, timer);
      // Phase 5 (5.8 – 7.0s): Catheter & guidewire withdrawal back out proximal end
      const retract = smoothstep(5.8, 7.0, timer);

      if (timer < 1.4) {
        phaseLabel = '1/5 Advancing Guidewire';
      } else if (timer < 2.6) {
        phaseLabel = '2/5 Positioning Balloon & Stent';
      } else if (timer < 4.65) {
        phaseLabel = '3/5 Inflating Balloon · Compressing Plaque';
      } else if (timer < 5.8) {
        phaseLabel = '4/5 Deflating Balloon · Stent Locked';
      } else if (timer < 7.05) {
        phaseLabel = '5/5 Retracting Catheter & Wire';
      }

      // Guidewire position (tracks centerline Y/Z so zero plaque clipping)
      const wireTipX =
        retract > 0
          ? xMax + 0.6 - retract * (xMax - xMin + 1.6)
          : xMin - 0.4 + wireAdvance * (xMax - xMin + 1.0);
      guidewireMesh.visible = retract < 0.99;
      guidewireMesh.position.set(wireTipX, cross.centerY * 0.88, cross.centerZ * 0.88);

      // Catheter & Balloon position
      const cathX =
        retract > 0
          ? plaqueCenterX - retract * (plaqueCenterX - xMin + 4.0)
          : xMin - 2.6 + cathAdvance * (plaqueCenterX - (xMin - 2.6));
      catheterGroup.visible = timer >= 1.3 && retract < 0.99;
      catheterGroup.position.set(cathX, cross.centerY * 0.95, cross.centerZ * 0.95);

      // Balloon radial scale (crimped -> inflated -> deflated)
      const balloonFactor = inflate * (1.0 - deflate);
      const balloonR = crimpedR * 0.88 + balloonFactor * (targetDeployedR - crimpedR * 0.88 - 0.02);
      balloonMesh.scale.set(1.0, balloonR, balloonR);
      balloonMat.opacity = 0.26 + 0.3 * balloonFactor;

      // Plaque compression monotonically rises during inflation and stays permanently compressed!
      plaqueCompression = Math.max(plaqueCompression, inflate);
      balloonOcclusion = balloonFactor;

      // Stent tracks with catheter until positioned, expands with balloon, and stays anchored permanently!
      stentGroup.visible = timer >= 1.3;
      const stentX = timer < 2.6 ? cathX : plaqueCenterX;
      const stentR = crimpedR + plaqueCompression * (targetDeployedR - crimpedR);
      updateStentLattice(stentR, plaqueCompression, stentX, cross.centerY, cross.centerZ);

      if (timer >= 7.05) {
        mode = 'deployed';
        balloonOcclusion = 0;
        plaqueCompression = 1.0;
        guidewireMesh.visible = false;
        catheterGroup.visible = false;
        stentGroup.visible = true;
        phaseLabel = 'Stent Deployed · Laminar Restored';
        updateStentLattice(targetDeployedR, 1.0, plaqueCenterX, cross.centerY, cross.centerZ);
      }
    } else if (mode === 'deployed') {
      // Gentle cardiac radial compliance on deployed stent synced with arterial wall
      const pulseScale = 1.0 + pulseVal * 0.012;
      stentGroup.scale.set(1.0, pulseScale, pulseScale);
    }

    const compressionChanged = Math.abs(plaqueCompression - prevCompression) > 0.008;

    return {
      mode,
      plaqueCompression,
      balloonOcclusion,
      phaseLabel,
      compressionChanged
    };
  }

  return {
    group,
    startDeployment,
    reset,
    setViewMode,
    update,
    getState: () => ({ mode, plaqueCompression, balloonOcclusion, phaseLabel })
  };
}
