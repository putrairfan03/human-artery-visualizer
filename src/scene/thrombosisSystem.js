import * as THREE from 'three';
import { ARTERY_DIMENSIONS, getLumenCrossSection } from '../config/anatomyData.js';

/**
 * Advanced Pathology — Plaque Rupture & Acute Thrombosis (Blood Clot) Simulation
 * Animates:
 *   1. Jagged fibrous cap fissure forming at the high-shear plaque shoulder
 *   2. Yellow-amber lipid core particles erupting into the bloodstream
 *   3. Activated spiky/stellate platelets aggregating around the rupture site
 *   4. Procedural 3D fibrin protein mesh network polymerizing across the lumen
 *   5. Trapped dark-crimson red blood cells & thrombus mass growing to 100% total occlusion
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
 * Procedural activated stellate/spiky platelet with protruding pseudopods.
 */
function createSpikyPlateletGeometry(baseRadius = 0.048) {
  const geom = new THREE.IcosahedronGeometry(baseRadius, 2);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  const dir = new THREE.Vector3();

  // 10 deterministic pseudopod spike directions
  const spikes = [
    new THREE.Vector3(1, 0.25, 0.1).normalize(),
    new THREE.Vector3(-0.95, 0.3, -0.2).normalize(),
    new THREE.Vector3(0.2, 1, -0.15).normalize(),
    new THREE.Vector3(-0.15, -1, 0.25).normalize(),
    new THREE.Vector3(0.1, 0.15, 1).normalize(),
    new THREE.Vector3(-0.2, -0.1, -1).normalize(),
    new THREE.Vector3(0.7, 0.7, 0.3).normalize(),
    new THREE.Vector3(-0.7, 0.6, 0.4).normalize(),
    new THREE.Vector3(0.65, -0.65, -0.35).normalize(),
    new THREE.Vector3(-0.6, -0.65, 0.45).normalize()
  ];

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    dir.copy(v).normalize();
    let maxSpike = 0;
    for (let s = 0; s < spikes.length; s++) {
      const d = Math.max(0, dir.dot(spikes[s]));
      const sharp = Math.pow(d, 7.0);
      if (sharp > maxSpike) maxSpike = sharp;
    }
    const rScale = 0.85 + maxSpike * 1.15;
    v.multiplyScalar(rScale);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

/**
 * Compact biconcave disc for trapped coagulated erythrocytes inside the thrombus.
 */
function createTrappedRbcGeometry(radius = 0.09) {
  const points = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rho = Math.sin(t * Math.PI);
    const r = rho * radius;
    const oneMinusRho2 = Math.max(0, 1 - rho * rho);
    const halfH =
      0.5 *
      radius *
      Math.sqrt(oneMinusRho2) *
      (0.207 + 2.003 * rho * rho - 1.123 * Math.pow(rho, 4));
    const y = (t <= 0.5 ? 1 : -1) * halfH * 0.9;
    points.push(new THREE.Vector2(Math.max(0.0005, r), y));
  }
  const geom = new THREE.LatheGeometry(points, 14);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Organic bumpy clot matrix sphere used as the inner coagulated gel core.
 */
function createOrganicClotCoreGeometry() {
  const geom = new THREE.IcosahedronGeometry(1.0, 3);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.clone().normalize();
    const bump =
      1.0 +
      0.11 * Math.sin(d.x * 7.5 + d.y * 5.0) +
      0.08 * Math.cos(d.z * 9.0 - d.x * 4.0) +
      0.05 * Math.sin(d.y * 13.0);
    v.multiplyScalar(bump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds the Plaque Rupture & Thrombosis 3D System.
 */
export function createThrombosisSystem() {
  const group = new THREE.Group();
  group.visible = false;

  const rng = createPRNG(421907);
  const { plaqueCenterX } = ARTERY_DIMENSIONS;

  // 1. Jagged Fibrous Cap Fissure (dark hemorrhagic tear + glowing amber rupture lip)
  const fissureGroup = new THREE.Group();
  group.add(fissureGroup);

  const fissureMat = new THREE.MeshPhysicalMaterial({
    color: '#3b070e',
    emissive: new THREE.Color('#991b1b'),
    emissiveIntensity: 0.45,
    roughness: 0.25,
    clearcoat: 0.8
  });

  const fissureLipMat = new THREE.MeshPhysicalMaterial({
    color: '#f59e0b',
    emissive: new THREE.Color('#b45309'),
    emissiveIntensity: 0.35,
    roughness: 0.38
  });

  let fissureMeshes = [];

  // 2. Released Yellow-Amber Lipid Core Particles (InstancedMesh)
  const LIPID_COUNT = 110;
  const lipidMat = new THREE.MeshPhysicalMaterial({
    color: '#fbbf24',
    emissive: new THREE.Color('#b45309'),
    emissiveIntensity: 0.22,
    roughness: 0.32,
    clearcoat: 0.65
  });
  const lipidMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.044, 1),
    lipidMat,
    LIPID_COUNT
  );
  lipidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(lipidMesh);

  const lipidPool = Array.from({ length: LIPID_COUNT }, () => ({
    offsetX: (rng() - 0.5) * 0.85,
    offsetZ: (rng() - 0.5) * 0.45,
    vx: 0.35 + rng() * 1.1,
    vy: 0.3 + rng() * 0.9,
    vz: (rng() - 0.5) * 0.7,
    delay: rng() * 0.35,
    scale: 0.65 + rng() * 0.85,
    rotSpeed: (rng() - 0.5) * 5.0
  }));

  // 3. Activated Spiky Platelets (InstancedMesh)
  const PLATELET_COUNT = 155;
  const spikyPlateletMat = new THREE.MeshPhysicalMaterial({
    color: '#fde68a',
    emissive: new THREE.Color('#92400e'),
    emissiveIntensity: 0.14,
    roughness: 0.34,
    clearcoat: 0.55,
    sheen: 0.4,
    sheenColor: new THREE.Color('#fffbeb')
  });
  const spikyPlateletMesh = new THREE.InstancedMesh(
    createSpikyPlateletGeometry(0.048),
    spikyPlateletMat,
    PLATELET_COUNT
  );
  spikyPlateletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(spikyPlateletMesh);

  // 4. Trapped Coagulated Red Blood Cells (InstancedMesh)
  const TRAPPED_RBC_COUNT = 240;
  const trappedRbcMat = new THREE.MeshPhysicalMaterial({
    color: '#7f0e1c',
    emissive: new THREE.Color('#2a0408'),
    emissiveIntensity: 0.18,
    roughness: 0.26,
    clearcoat: 0.88,
    clearcoatRoughness: 0.16
  });
  const trappedRbcMesh = new THREE.InstancedMesh(
    createTrappedRbcGeometry(0.088),
    trappedRbcMat,
    TRAPPED_RBC_COUNT
  );
  trappedRbcMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(trappedRbcMesh);

  // 5. Coagulated Thrombus Matrix Core (fills inter-cellular spaces for solid 100% seal)
  const clotCoreMat = new THREE.MeshPhysicalMaterial({
    color: '#6b0f1a',
    roughness: 0.28,
    metalness: 0.02,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
    sheen: 0.45,
    sheenColor: new THREE.Color('#b91c1c'),
    transparent: true,
    opacity: 0.88
  });
  const clotCoreMesh = new THREE.Mesh(createOrganicClotCoreGeometry(), clotCoreMat);
  clotCoreMesh.castShadow = true;
  clotCoreMesh.receiveShadow = true;
  group.add(clotCoreMesh);

  // 6. Procedural 3D Fibrin Mesh Network (crisscrossing wavy ivory protein strands)
  const fibrinGroup = new THREE.Group();
  group.add(fibrinGroup);
  const fibrinMat = new THREE.MeshPhysicalMaterial({
    color: '#f5edd6',
    emissive: new THREE.Color('#57472a'),
    emissiveIntensity: 0.12,
    roughness: 0.36,
    clearcoat: 0.55,
    sheen: 0.4,
    sheenColor: new THREE.Color('#ffffff')
  });
  let fibrinStrands = [];

  // Normalized structural seeds for platelets & trapped RBCs inside the growing clot volume
  const plateletSeeds = Array.from({ length: PLATELET_COUNT }, (_, i) => {
    const u = Math.pow(rng(), 0.72); // Concentrate slightly denser near plaque fissure base
    const phi = rng() * Math.PI * 2;
    const xNorm = (rng() - 0.5) * 1.9;
    return {
      // Order of activation: basal platelets first, luminal cap platelets later
      activateAt: 0.16 + (i / PLATELET_COUNT) * 0.58,
      u,
      phi,
      xNorm,
      rx: rng() * Math.PI * 2,
      ry: rng() * Math.PI * 2,
      rz: rng() * Math.PI * 2,
      scale: 0.75 + rng() * 0.6
    };
  });

  const trappedRbcSeeds = Array.from({ length: TRAPPED_RBC_COUNT }, (_, i) => {
    const rFrac = Math.sqrt(rng()) * 0.96;
    const phi = rng() * Math.PI * 2;
    const xNorm = (rng() - 0.45) * 2.15;
    return {
      trapAt: 0.36 + (i / TRAPPED_RBC_COUNT) * 0.56,
      rFrac,
      phi,
      xNorm,
      rx: rng() * Math.PI * 2,
      ry: rng() * Math.PI * 2,
      rz: rng() * Math.PI * 2,
      scale: 0.85 + rng() * 0.32
    };
  });

  // Reusable scratch transform objects
  const dummy = new THREE.Object3D();

  // Geometry rebuild helper calibrated to the exact stenosis lumen cross-section at rupture time
  let anchoredCross = { radius: 0.5, centerY: 0.15, centerZ: 0.05 };
  let anchoredStenosis = 0.5;

  function rebuildThrombusGeometries(stenosisFrac) {
    anchoredStenosis = stenosisFrac;
    anchoredCross = getLumenCrossSection(plaqueCenterX, stenosisFrac);
    const { radius, centerY, centerZ } = anchoredCross;

    // Clear old fissure & fibrin meshes
    for (const m of fissureMeshes) {
      m.geometry.dispose();
      fissureGroup.remove(m);
    }
    fissureMeshes = [];

    for (const f of fibrinStrands) {
      f.mesh.geometry.dispose();
      fibrinGroup.remove(f.mesh);
    }
    fibrinStrands = [];

    // 1. Build jagged fibrous cap rupture fissure right on the lower crest of the plaque
    const ruptureBaseY = centerY - radius + 0.015;
    const ruptureBaseZ = centerZ + 0.08;

    const crackPts = [
      new THREE.Vector3(plaqueCenterX - 0.72, ruptureBaseY - 0.04, ruptureBaseZ - 0.14),
      new THREE.Vector3(plaqueCenterX - 0.42, ruptureBaseY + 0.02, ruptureBaseZ + 0.06),
      new THREE.Vector3(plaqueCenterX - 0.14, ruptureBaseY + 0.03, ruptureBaseZ - 0.08),
      new THREE.Vector3(plaqueCenterX + 0.18, ruptureBaseY + 0.04, ruptureBaseZ + 0.12),
      new THREE.Vector3(plaqueCenterX + 0.48, ruptureBaseY + 0.01, ruptureBaseZ - 0.05),
      new THREE.Vector3(plaqueCenterX + 0.74, ruptureBaseY - 0.05, ruptureBaseZ + 0.04)
    ];
    const crackCurve = new THREE.CatmullRomCurve3(crackPts);
    const crackMesh = new THREE.Mesh(new THREE.TubeGeometry(crackCurve, 32, 0.036, 7, false), fissureMat);
    fissureGroup.add(crackMesh);
    fissureMeshes.push(crackMesh);

    // Secondary jagged branch crack + exposed yellow lipid lip
    const branchPts = [
      new THREE.Vector3(plaqueCenterX - 0.14, ruptureBaseY + 0.03, ruptureBaseZ - 0.08),
      new THREE.Vector3(plaqueCenterX - 0.02, ruptureBaseY + 0.01, ruptureBaseZ - 0.28),
      new THREE.Vector3(plaqueCenterX + 0.16, ruptureBaseY - 0.03, ruptureBaseZ - 0.42)
    ];
    const branchMesh = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branchPts), 14, 0.024, 6, false),
      fissureMat
    );
    const lipMesh = new THREE.Mesh(
      new THREE.TubeGeometry(crackCurve, 28, 0.052, 6, false),
      fissureLipMat
    );
    lipMesh.position.y = -0.022;
    fissureGroup.add(branchMesh, lipMesh);
    fissureMeshes.push(branchMesh, lipMesh);

    // 2. Build 72 procedural 3D wavy Fibrin Mesh strands bridging across the narrowed lumen
    const localRng = createPRNG(99311);
    const STRAND_COUNT = 72;
    const clotHalfLen = Math.max(0.85, Math.min(1.45, radius * 2.15));

    for (let i = 0; i < STRAND_COUNT; i++) {
      const thA = localRng() * Math.PI * 2;
      const thB = thA + Math.PI * (0.45 + localRng() * 1.1);
      const rA = radius * (0.75 + localRng() * 0.25);
      const rB = radius * (0.72 + localRng() * 0.28);
      const xA = plaqueCenterX + (localRng() - 0.5) * clotHalfLen * 1.75;
      const xB = plaqueCenterX + (localRng() - 0.5) * clotHalfLen * 1.75;

      const p0 = new THREE.Vector3(xA, centerY + rA * Math.sin(thA), centerZ + rA * Math.cos(thA));
      const p3 = new THREE.Vector3(xB, centerY + rB * Math.sin(thB), centerZ + rB * Math.cos(thB));

      const p1 = new THREE.Vector3()
        .lerpVectors(p0, p3, 0.35)
        .add(
          new THREE.Vector3(
            (localRng() - 0.5) * 0.24,
            (localRng() - 0.5) * radius * 0.45,
            (localRng() - 0.5) * radius * 0.45
          )
        );
      const p2 = new THREE.Vector3()
        .lerpVectors(p0, p3, 0.68)
        .add(
          new THREE.Vector3(
            (localRng() - 0.5) * 0.24,
            (localRng() - 0.5) * radius * 0.45,
            (localRng() - 0.5) * radius * 0.45
          )
        );

      const strandCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
      const strandRad = 0.0085 + localRng() * 0.008;
      const strandGeom = new THREE.TubeGeometry(strandCurve, 14, strandRad, 5, false);
      const strandMesh = new THREE.Mesh(strandGeom, fibrinMat);
      strandMesh.visible = false;
      fibrinGroup.add(strandMesh);

      fibrinStrands.push({
        mesh: strandMesh,
        appearAt: 0.22 + (i / STRAND_COUNT) * 0.62
      });
    }
  }

  // State machine
  let mode = 'idle'; // 'idle' | 'rupturing' | 'occluded'
  let timer = 0;
  let thrombusOcclusion = 0; // 0..1
  let phaseLabel = 'Intact Fibrous Cap';

  function triggerRupture(stenosisPct) {
    if (mode !== 'idle') return;
    const sFrac = Math.max(0.5, Math.min(0.75, stenosisPct / 100));
    rebuildThrombusGeometries(sFrac);
    mode = 'rupturing';
    timer = 0;
    thrombusOcclusion = 0.02;
    phaseLabel = '1/4 Fibrous Cap Fissure';
    group.visible = true;
  }

  function reset() {
    mode = 'idle';
    timer = 0;
    thrombusOcclusion = 0;
    phaseLabel = 'Intact Fibrous Cap';
    group.visible = false;
  }

  function setViewMode(viewMode) {
    if (viewMode === 'xray') {
      clotCoreMat.opacity = 0.48;
      fibrinMat.color.set('#fff9db');
    } else if (viewMode === 'heatmap') {
      clotCoreMat.opacity = 0.72;
      fibrinMat.color.set('#fde68a');
    } else {
      clotCoreMat.opacity = 0.88;
      fibrinMat.color.set('#f5edd6');
    }
  }

  function update(dt, pulseVal) {
    if (mode === 'idle') {
      return {
        mode,
        thrombusOcclusion: 0,
        phaseLabel
      };
    }

    if (mode === 'rupturing') {
      timer += dt;
      // Full cascade over 6.4 seconds: fissure -> lipid burst -> platelets/fibrin -> 100% occlusion
      const progress = clamp01(timer / 6.4);
      thrombusOcclusion = smoothstep(0.12, 0.96, progress);

      if (progress < 0.22) {
        phaseLabel = '1/4 Fibrous Cap Fissure · Lipid Release';
      } else if (progress < 0.52) {
        phaseLabel = '2/4 Spiky Platelet Aggregation';
      } else if (progress < 0.86) {
        phaseLabel = '3/4 Fibrin Mesh & RBC Entrapment';
      } else {
        phaseLabel = '4/4 100% Total Occlusive Thrombus';
      }

      if (progress >= 1.0) {
        mode = 'occluded';
        thrombusOcclusion = 1.0;
        phaseLabel = 'Total Occlusion (100% Clot)';
      }
    }

    const progress = mode === 'occluded' ? 1.0 : clamp01(timer / 6.4);
    const { radius, centerY, centerZ } = anchoredCross;
    const ruptureBaseY = centerY - radius + 0.02;
    const clotHalfLen = Math.max(0.88, Math.min(1.48, radius * 2.15));

    // 1. Animate Fibrous Cap Fissure opening
    const fissureOpen = smoothstep(0.0, 0.18, progress);
    fissureGroup.visible = fissureOpen > 0.01;
    fissureGroup.scale.set(0.35 + 0.65 * fissureOpen, fissureOpen, fissureOpen);

    // 2. Animate Erupting Yellow-Amber Lipid Core Particles
    for (let i = 0; i < LIPID_COUNT; i++) {
      const lp = lipidPool[i];
      const age = Math.max(0, progress - lp.delay * 0.55);
      if (age <= 0.005) {
        dummy.scale.setScalar(0.0001);
      } else {
        const burstT = Math.min(1, age * 2.8);
        // Erupts upward from plaque fissure then slows as clot entraps it
        const trapBrake = 1.0 - 0.72 * thrombusOcclusion;
        const px = plaqueCenterX + lp.offsetX + lp.vx * burstT * (0.85 * trapBrake + 0.15);
        const py = Math.min(
          centerY + radius * 0.82,
          ruptureBaseY + lp.vy * Math.pow(burstT, 0.65) * radius * 1.45
        );
        const pz = centerZ + lp.offsetZ + lp.vz * burstT * radius * 0.75;
        const fade = progress > 0.78 ? Math.max(0.25, 1.0 - (progress - 0.78) * 3.0) : 1.0;

        dummy.position.set(px, py, pz);
        dummy.rotation.set(age * lp.rotSpeed, age * lp.rotSpeed * 0.7, 0);
        dummy.scale.setScalar(lp.scale * Math.min(1, age * 8.0) * fade);
      }
      dummy.updateMatrix();
      lipidMesh.setMatrixAt(i, dummy.matrix);
    }
    lipidMesh.instanceMatrix.needsUpdate = true;

    // 3. Animate Activated Spiky Platelets clumping from fissure upward across lumen
    const pulseMicro = 1.0 + pulseVal * 0.018;
    for (let i = 0; i < PLATELET_COUNT; i++) {
      const ps = plateletSeeds[i];
      const grow = smoothstep(ps.activateAt, ps.activateAt + 0.16, progress);
      if (grow <= 0.01) {
        dummy.scale.setScalar(0.0001);
      } else {
        // Grow upward from rupture base (-radius) to fill entire cross-section (+radius)
        const fillHeight = -radius * 0.92 + ps.u * (2.0 * radius * 0.92) * Math.min(1, thrombusOcclusion * 1.15);
        const maxChord = Math.sqrt(Math.max(0.01, radius * radius - fillHeight * fillHeight));
        const px = plaqueCenterX + ps.xNorm * clotHalfLen * 0.65;
        const py = centerY + fillHeight * pulseMicro;
        const pz = centerZ + Math.cos(ps.phi) * maxChord * 0.88 * pulseMicro;

        dummy.position.set(px, py, pz);
        dummy.rotation.set(ps.rx, ps.ry, ps.rz);
        dummy.scale.setScalar(ps.scale * grow);
      }
      dummy.updateMatrix();
      spikyPlateletMesh.setMatrixAt(i, dummy.matrix);
    }
    spikyPlateletMesh.instanceMatrix.needsUpdate = true;

    // 4. Animate Procedural 3D Fibrin Mesh Strands polymerizing progressively
    for (let i = 0; i < fibrinStrands.length; i++) {
      const f = fibrinStrands[i];
      const fGrow = smoothstep(f.appearAt, f.appearAt + 0.14, progress);
      f.mesh.visible = fGrow > 0.02;
      if (f.mesh.visible) {
        f.mesh.scale.setScalar(0.35 + 0.65 * fGrow);
      }
    }

    // 5. Animate Trapped Coagulated Red Blood Cells inside fibrin web
    for (let i = 0; i < TRAPPED_RBC_COUNT; i++) {
      const rs = trappedRbcSeeds[i];
      const trapGrow = smoothstep(rs.trapAt, rs.trapAt + 0.15, progress);
      if (trapGrow <= 0.01) {
        dummy.scale.setScalar(0.0001);
      } else {
        const rLocal = rs.rFrac * radius * 0.96 * Math.min(1, 0.35 + 0.65 * thrombusOcclusion);
        const px = plaqueCenterX + rs.xNorm * clotHalfLen * 0.62;
        const py = centerY + rLocal * Math.sin(rs.phi) * pulseMicro;
        const pz = centerZ + rLocal * Math.cos(rs.phi) * pulseMicro;

        dummy.position.set(px, py, pz);
        dummy.rotation.set(rs.rx, rs.ry, rs.rz);
        dummy.scale.setScalar(rs.scale * trapGrow);
      }
      dummy.updateMatrix();
      trappedRbcMesh.setMatrixAt(i, dummy.matrix);
    }
    trappedRbcMesh.instanceMatrix.needsUpdate = true;

    // 6. Animate Coagulated Thrombus Matrix Core swelling to seal 100% of lumen
    const coreGrow = smoothstep(0.34, 0.98, progress);
    clotCoreMesh.visible = coreGrow > 0.02;
    if (clotCoreMesh.visible) {
      const rx = clotHalfLen * (0.45 + 0.55 * coreGrow);
      const ry = radius * (0.28 + 0.73 * coreGrow) * pulseMicro;
      const rz = radius * (0.28 + 0.73 * coreGrow) * pulseMicro;
      // Anchor rises from fissure crest up to lumen center as clot fills 100%
      const cy = ruptureBaseY + (centerY - ruptureBaseY) * coreGrow;
      clotCoreMesh.position.set(plaqueCenterX, cy, centerZ);
      clotCoreMesh.scale.set(rx, ry, rz);
    }

    return {
      mode,
      thrombusOcclusion,
      phaseLabel
    };
  }

  return {
    group,
    triggerRupture,
    reset,
    setViewMode,
    update,
    getState: () => ({ mode, thrombusOcclusion, phaseLabel })
  };
}
