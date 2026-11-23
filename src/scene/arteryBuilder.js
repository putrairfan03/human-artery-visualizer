import * as THREE from 'three';
import {
  ARTERY_DIMENSIONS,
  getLumenCrossSection,
  getPeelLayout,
  getPlaqueAxialEnvelope
} from '../config/anatomyData.js';

/**
 * Procedural 5-Layer Cutaway Human Artery + Vasa Vasorum + Dynamic Atherosclerotic Plaque
 * Supports real-time stepped layer peel (0–100%), dynamic stenosis bulge (0–75%),
 * heartbeat smooth-muscle pulsation, selection highlighting, and 3 rendering view modes.
 */

const TWO_PI = Math.PI * 2;

function normalizeAngleDiff(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

/**
 * Builds a watertight thick-walled cylindrical shell with a stepped longitudinal cutaway:
 *  - Proximal segment [xMin, xStep]: closed 360° hollow tube + left annular cap + step-cut face
 *  - Distal segment [xStep, xMax]: open-arc hollow shell + longitudinal cut walls + right annular cap
 * Supports custom radial/eccentric cross-section functions for inner & outer surfaces.
 */
function buildSteppedShellGeometry({
  xMin,
  xMax,
  xStep,
  isOpen,
  cutCenterAngle,
  cutHalfAngle,
  segX = 48,
  segTheta = 68,
  sampleOuter,
  sampleInner,
  computeVertexColor = null
}) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = computeVertexColor ? [] : null;
  const indices = [];

  const pushVertex = (x, y, z, nx, ny, nz, u, v, col) => {
    const idx = positions.length / 3;
    positions.push(x, y, z);
    normals.push(nx, ny, nz);
    uvs.push(u, v);
    if (colors) {
      if (col) {
        colors.push(col[0], col[1], col[2]);
      } else {
        colors.push(1, 1, 1);
      }
    }
    return idx;
  };

  // Helper to emit a curved parametric grid (outer or inner surface)
  const addCurvedSurface = (xStart, xEnd, tStart, tEnd, nxSeg, ntSeg, sampler, flipWinding) => {
    if (xEnd - xStart < 0.002 || Math.abs(tEnd - tStart) < 0.002) return;
    const baseIndex = positions.length / 3;
    const stride = ntSeg + 1;

    for (let ix = 0; ix <= nxSeg; ix++) {
      const fx = ix / nxSeg;
      const x = xStart + (xEnd - xStart) * fx;
      const u = (x - xMin) / (xMax - xMin);

      for (let it = 0; it <= ntSeg; it++) {
        const ft = it / ntSeg;
        const theta = tStart + (tEnd - tStart) * ft;
        const v = theta / TWO_PI;
        const pt = sampler(x, theta);

        // Compute smooth surface normal via finite differences
        const epsT = 0.015;
        const epsX = 0.04;
        const ptT = sampler(x, theta + epsT);
        const ptX = sampler(Math.min(xMax, x + epsX), theta);
        const dx = x < xMax - epsX * 0.5 ? epsX : -epsX;
        const ptX2 = dx > 0 ? ptX : sampler(x + dx, theta);

        // Tangents: Tx along +x, Tt along +theta
        const txx = 1;
        const txy = (ptX2.y - pt.y) / dx;
        const txz = (ptX2.z - pt.z) / dx;

        const ttx = 0;
        const tty = (ptT.y - pt.y) / epsT;
        const ttz = (ptT.z - pt.z) / epsT;

        // Outward normal = Tx x Tt
        let nx = txy * ttz - txz * tty;
        let ny = txz * ttx - txx * ttz;
        let nz = txx * tty - txy * ttx;
        const len = Math.hypot(nx, ny, nz) || 1;
        const sign = flipWinding ? -1 : 1;
        nx = (nx / len) * sign;
        ny = (ny / len) * sign;
        nz = (nz / len) * sign;

        const col = computeVertexColor ? computeVertexColor(x, theta, flipWinding) : null;
        pushVertex(x, pt.y, pt.z, nx, ny, nz, u, v, col);
      }
    }

    for (let ix = 0; ix < nxSeg; ix++) {
      for (let it = 0; it < ntSeg; it++) {
        const a = baseIndex + ix * stride + it;
        const b = baseIndex + (ix + 1) * stride + it;
        const c = baseIndex + (ix + 1) * stride + (it + 1);
        const d = baseIndex + ix * stride + (it + 1);
        if (!flipWinding) {
          indices.push(a, b, c, a, c, d);
        } else {
          indices.push(a, c, b, a, d, c);
        }
      }
    }
  };

  // Helper to emit an annular cap at constant X
  const addAnnularCap = (x, tStart, tEnd, ntSeg, facePositiveX) => {
    if (Math.abs(tEnd - tStart) < 0.002) return;
    const baseIndex = positions.length / 3;
    const nx = facePositiveX ? 1 : -1;

    for (let it = 0; it <= ntSeg; it++) {
      const ft = it / ntSeg;
      const theta = tStart + (tEnd - tStart) * ft;
      const pIn = sampleInner(x, theta);
      const pOut = sampleOuter(x, theta);
      const col = computeVertexColor ? computeVertexColor(x, theta, false) : null;

      pushVertex(x, pIn.y, pIn.z, nx, 0, 0, 0.0, ft, col);
      pushVertex(x, pOut.y, pOut.z, nx, 0, 0, 1.0, ft, col);
    }

    for (let it = 0; it < ntSeg; it++) {
      const i0 = baseIndex + it * 2;
      const o0 = i0 + 1;
      const i1 = i0 + 2;
      const o1 = i0 + 3;
      if (facePositiveX) {
        indices.push(i0, o1, o0, i0, i1, o1);
      } else {
        indices.push(i0, o0, o1, i0, o1, i1);
      }
    }
  };

  // Helper to emit a longitudinal cutaway slice wall at constant theta
  const addLongitudinalCutWall = (xStart, xEnd, theta, nxSeg, faceNegativeTheta) => {
    if (xEnd - xStart < 0.002) return;
    const baseIndex = positions.length / 3;
    // Outward normal perpendicular to radial vector in YZ plane
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const ny = faceNegativeTheta ? -cosT : cosT;
    const nz = faceNegativeTheta ? sinT : -sinT;

    for (let ix = 0; ix <= nxSeg; ix++) {
      const fx = ix / nxSeg;
      const x = xStart + (xEnd - xStart) * fx;
      const u = (x - xMin) / (xMax - xMin);
      const pIn = sampleInner(x, theta);
      const pOut = sampleOuter(x, theta);
      const col = computeVertexColor ? computeVertexColor(x, theta, false) : null;

      pushVertex(x, pIn.y, pIn.z, 0, ny, nz, u, 0.0, col);
      pushVertex(x, pOut.y, pOut.z, 0, ny, nz, u, 1.0, col);
    }

    for (let ix = 0; ix < nxSeg; ix++) {
      const i0 = baseIndex + ix * 2;
      const o0 = i0 + 1;
      const i1 = i0 + 2;
      const o1 = i0 + 3;
      if (faceNegativeTheta) {
        indices.push(i0, i1, o1, i0, o1, o0);
      } else {
        indices.push(i0, o1, i1, i0, o0, o1);
      }
    }
  };

  const totalLen = xMax - xMin;
  const clampedStep = isOpen ? Math.max(xMin, Math.min(xMax, xStep)) : xMax;

  // 1. Proximal full-360° closed tube [xMin, clampedStep]
  const proxLen = clampedStep - xMin;
  if (proxLen > 0.005) {
    const proxSegX = Math.max(2, Math.round((proxLen / totalLen) * segX));
    addCurvedSurface(xMin, clampedStep, 0, TWO_PI, proxSegX, segTheta, sampleOuter, false);
    addCurvedSurface(xMin, clampedStep, 0, TWO_PI, proxSegX, segTheta, sampleInner, true);
    addAnnularCap(xMin, 0, TWO_PI, segTheta, false);

    if (!isOpen || clampedStep >= xMax - 0.005) {
      addAnnularCap(clampedStep, 0, TWO_PI, segTheta, true);
    } else {
      // Step-cut annular face covering only the excised angular sector
      const cutStart = cutCenterAngle - cutHalfAngle;
      const cutEnd = cutCenterAngle + cutHalfAngle;
      const cutSegT = Math.max(8, Math.round(((cutEnd - cutStart) / TWO_PI) * segTheta));
      addAnnularCap(clampedStep, cutStart, cutEnd, cutSegT, true);
    }
  }

  // 2. Distal cutaway shell [clampedStep, xMax]
  const distLen = xMax - clampedStep;
  if (isOpen && distLen > 0.005) {
    const thetaStart = cutCenterAngle + cutHalfAngle;
    const thetaEnd = cutCenterAngle + TWO_PI - cutHalfAngle;
    const arcFrac = (thetaEnd - thetaStart) / TWO_PI;
    const distSegX = Math.max(4, Math.round((distLen / totalLen) * segX));
    const distSegT = Math.max(16, Math.round(arcFrac * segTheta));

    addCurvedSurface(clampedStep, xMax, thetaStart, thetaEnd, distSegX, distSegT, sampleOuter, false);
    addCurvedSurface(clampedStep, xMax, thetaStart, thetaEnd, distSegX, distSegT, sampleInner, true);

    // Longitudinal cut planes cleanly exposing wall layer thickness
    addLongitudinalCutWall(clampedStep, xMax, thetaStart, distSegX, true);
    addLongitudinalCutWall(clampedStep, xMax, thetaEnd, distSegX, false);

    // Right radial cross-section end cap
    addAnnularCap(xMax, thetaStart, thetaEnd, distSegT, true);

    // If peeled all the way to xMin, also cap the left open arc
    if (proxLen <= 0.005) {
      addAnnularCap(xMin, thetaStart, thetaEnd, distSegT, false);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colors) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Generates procedural branching Vasa Vasorum (nutrient arterioles & venules)
 * hugging the exterior surface of Layer 1 (Tunica Adventitia), with dynamic peel masking.
 */
function buildVasaVasorum(rSurface) {
  const group = new THREE.Group();
  const { xMin, xMax } = ARTERY_DIMENSIONS;

  // Deterministic PRNG for anatomical consistency
  let seed = 7391;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const arterioleMat = new THREE.MeshPhysicalMaterial({
    color: '#c82333',
    roughness: 0.28,
    metalness: 0.02,
    clearcoat: 0.75,
    clearcoatRoughness: 0.2
  });

  const venuleMat = new THREE.MeshPhysicalMaterial({
    color: '#34589c',
    roughness: 0.32,
    metalness: 0.02,
    clearcoat: 0.65,
    clearcoatRoughness: 0.25
  });

  const vesselEntries = [];

  function addVesselPath(pointsXTheta, radius, isArteriole) {
    const pts3D = pointsXTheta.map(([x, th]) => {
      const r = rSurface + radius * 0.62;
      return new THREE.Vector3(x, r * Math.sin(th), r * Math.cos(th));
    });
    const curve = new THREE.CatmullRomCurve3(pts3D);
    const tubularSegments = Math.max(12, pointsXTheta.length * 6);
    const radialSegments = 6;
    const geom = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);

    // Precompute (x, theta) for each ring so we can mask triangles cleanly on peel change
    const fullIndices = Array.from(geom.index.array);
    const posAttr = geom.attributes.position;
    const triMeta = [];
    for (let i = 0; i < fullIndices.length; i += 3) {
      const a = fullIndices[i];
      const b = fullIndices[i + 1];
      const c = fullIndices[i + 2];
      const mx = (posAttr.getX(a) + posAttr.getX(b) + posAttr.getX(c)) / 3;
      const my = (posAttr.getY(a) + posAttr.getY(b) + posAttr.getY(c)) / 3;
      const mz = (posAttr.getZ(a) + posAttr.getZ(b) + posAttr.getZ(c)) / 3;
      const mTheta = Math.atan2(my, mz);
      triMeta.push({ a, b, c, x: mx, theta: mTheta });
    }

    const mesh = new THREE.Mesh(geom, isArteriole ? arterioleMat : venuleMat);
    mesh.castShadow = false;
    group.add(mesh);
    vesselEntries.push({ mesh, geom, triMeta, isArteriole });
  }

  // Generate 16 primary longitudinal/helical parent trunks + 32 fine branches
  const trunkCount = 16;
  for (let i = 0; i < trunkCount; i++) {
    const isArteriole = i % 2 === 0;
    const baseTheta = (i / trunkCount) * TWO_PI + (rng() - 0.5) * 0.22;
    const xStart = xMin + 0.15 + rng() * 1.4;
    const xEnd = xMax - 0.15 - rng() * 1.2;
    const steps = 11;
    const trunkPts = [];
    let curTheta = baseTheta;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = xStart + (xEnd - xStart) * t;
      curTheta += (rng() - 0.5) * 0.28 + (isArteriole ? 0.04 : -0.04);
      trunkPts.push([x, curTheta]);
    }

    addVesselPath(trunkPts, isArteriole ? 0.025 : 0.029, isArteriole);

    // Spawn 2 delicate secondary branches off each trunk
    for (let b = 0; b < 2; b++) {
      const branchIdx = 2 + Math.floor(rng() * (steps - 4));
      const [bx0, bt0] = trunkPts[branchIdx];
      const dir = b === 0 ? 1 : -1;
      const branchPts = [[bx0, bt0]];
      let bx = bx0;
      let bt = bt0;
      for (let k = 1; k <= 5; k++) {
        bx = Math.max(xMin + 0.12, Math.min(xMax - 0.12, bx + (0.28 + rng() * 0.35)));
        bt += dir * (0.14 + rng() * 0.18);
        branchPts.push([bx, bt]);
      }
      addVesselPath(branchPts, 0.015, isArteriole);
    }
  }

  function updatePeelMask(layout) {
    const advStepX = layout.stepX[0];
    const { isOpen, cutCenterAngle, cutHalfAngle } = layout;

    for (const entry of vesselEntries) {
      const activeIndices = [];
      for (let i = 0; i < entry.triMeta.length; i++) {
        const tri = entry.triMeta[i];
        let hidden = false;
        if (isOpen && tri.x > advStepX - 0.04) {
          const angDist = Math.abs(normalizeAngleDiff(tri.theta, cutCenterAngle));
          if (angDist < cutHalfAngle + 0.03) {
            hidden = true;
          }
        }
        if (!hidden) {
          activeIndices.push(tri.a, tri.b, tri.c);
        }
      }
      entry.geom.setIndex(activeIndices);
    }
  }

  function setViewMode(mode) {
    if (mode === 'anatomical') {
      arterioleMat.color.set('#c82333');
      venuleMat.color.set('#34589c');
      arterioleMat.transparent = false;
      venuleMat.transparent = false;
      arterioleMat.opacity = 1.0;
      venuleMat.opacity = 1.0;
      arterioleMat.depthWrite = true;
      venuleMat.depthWrite = true;
    } else if (mode === 'xray') {
      arterioleMat.color.set('#ff4d79');
      venuleMat.color.set('#46b7ff');
      arterioleMat.transparent = true;
      venuleMat.transparent = true;
      arterioleMat.opacity = 0.45;
      venuleMat.opacity = 0.4;
      arterioleMat.depthWrite = false;
      venuleMat.depthWrite = false;
    } else {
      // Heatmap mode: subtle muted vessels so velocity heatmap dominates
      arterioleMat.color.set('#6b3648');
      venuleMat.color.set('#2c4469');
      arterioleMat.transparent = true;
      venuleMat.transparent = true;
      arterioleMat.opacity = 0.35;
      venuleMat.opacity = 0.32;
      arterioleMat.depthWrite = false;
      venuleMat.depthWrite = false;
    }
  }

  return { group, updatePeelMask, setViewMode };
}

/**
 * Evaluates scientific blue -> cyan -> yellow -> orange -> red heatmap RGB [0..1]
 */
function sampleShearHeatmapRGB(t) {
  const c = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (c < 0.25) {
    const f = c / 0.25;
    r = 0.11 * (1 - f) + 0.0 * f;
    g = 0.43 * (1 - f) + 0.83 * f;
    b = 1.0 * (1 - f) + 0.78 * f;
  } else if (c < 0.55) {
    const f = (c - 0.25) / 0.3;
    r = 0.0 * (1 - f) + 1.0 * f;
    g = 0.83 * (1 - f) + 0.75 * f;
    b = 0.78 * (1 - f) + 0.1 * f;
  } else if (c < 0.8) {
    const f = (c - 0.55) / 0.25;
    r = 1.0;
    g = 0.75 * (1 - f) + 0.29 * f;
    b = 0.1 * (1 - f) + 0.12 * f;
  } else {
    const f = (c - 0.8) / 0.2;
    r = 1.0;
    g = 0.29 * (1 - f) + 0.08 * f;
    b = 0.12 * (1 - f) + 0.26 * f;
  }
  return [r, g, b];
}

/**
 * Creates the full 3D Multi-Layer Human Artery assembly.
 */
export function createArterySystem(textures) {
  const rootGroup = new THREE.Group();
  const vesselGroup = new THREE.Group();
  rootGroup.add(vesselGroup);

  // Separate sub-groups so Tunica Media & elastic wall layers pulse with heartbeat
  // while the calcified/fibrotic plaque stays stiffer (clinically accurate!)
  const layerMeshes = {};
  const layerMaterials = {};

  const materialConfigs = {
    adventitia: {
      color: '#dfb3a2',
      map: textures.adventitia.map,
      bumpMap: textures.adventitia.bumpMap,
      bumpScale: 0.048,
      roughnessMap: textures.adventitia.roughnessMap,
      roughness: 0.62,
      metalness: 0.02,
      clearcoat: 0.22,
      clearcoatRoughness: 0.48,
      sheen: 0.45,
      sheenColor: new THREE.Color('#f4d8cb'),
      sheenRoughness: 0.65,
      xrayColor: '#6db3f2',
      xrayOpacity: 0.14
    },
    externalLamina: {
      color: '#eed896',
      map: textures.externalLamina.map,
      bumpMap: textures.externalLamina.bumpMap,
      bumpScale: 0.036,
      roughnessMap: textures.externalLamina.roughnessMap,
      roughness: 0.42,
      metalness: 0.04,
      clearcoat: 0.48,
      clearcoatRoughness: 0.3,
      sheen: 0.35,
      sheenColor: new THREE.Color('#fff1bd'),
      sheenRoughness: 0.45,
      xrayColor: '#8be0ff',
      xrayOpacity: 0.18
    },
    media: {
      color: '#c4424d',
      map: textures.media.map,
      bumpMap: textures.media.bumpMap,
      bumpScale: 0.055,
      roughnessMap: textures.media.roughnessMap,
      roughness: 0.44,
      metalness: 0.02,
      clearcoat: 0.52,
      clearcoatRoughness: 0.32,
      sheen: 0.4,
      sheenColor: new THREE.Color('#ff8f99'),
      sheenRoughness: 0.55,
      xrayColor: '#5c9df5',
      xrayOpacity: 0.16
    },
    internalLamina: {
      color: '#f5e4a4',
      map: textures.internalLamina.map,
      bumpMap: textures.internalLamina.bumpMap,
      bumpScale: 0.045,
      roughnessMap: textures.internalLamina.roughnessMap,
      roughness: 0.36,
      metalness: 0.05,
      clearcoat: 0.58,
      clearcoatRoughness: 0.26,
      sheen: 0.38,
      sheenColor: new THREE.Color('#fff5cc'),
      sheenRoughness: 0.4,
      xrayColor: '#98ecff',
      xrayOpacity: 0.22
    },
    intima: {
      color: '#e87885',
      map: textures.intima.map,
      bumpMap: textures.intima.bumpMap,
      bumpScale: 0.032,
      roughnessMap: textures.intima.roughnessMap,
      roughness: 0.19,
      metalness: 0.02,
      clearcoat: 0.92,
      clearcoatRoughness: 0.14,
      sheen: 0.42,
      sheenColor: new THREE.Color('#ffb8c2'),
      sheenRoughness: 0.35,
      xrayColor: '#b5f0ff',
      xrayOpacity: 0.2
    }
  };

  for (const layer of ARTERY_DIMENSIONS.layers) {
    const cfg = materialConfigs[layer.id];
    const mat = new THREE.MeshPhysicalMaterial({
      color: cfg.color,
      map: cfg.map,
      bumpMap: cfg.bumpMap,
      bumpScale: cfg.bumpScale,
      roughnessMap: cfg.roughnessMap,
      roughness: cfg.roughness,
      metalness: cfg.metalness,
      clearcoat: cfg.clearcoat,
      clearcoatRoughness: cfg.clearcoatRoughness,
      sheen: cfg.sheen,
      sheenColor: cfg.sheenColor,
      sheenRoughness: cfg.sheenRoughness,
      emissive: new THREE.Color('#000000'),
      emissiveIntensity: 0
    });
    layerMaterials[layer.id] = { mat, cfg };

    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.anatomyId = layer.id;
    vesselGroup.add(mesh);
    layerMeshes[layer.id] = mesh;
  }

  // Pathology: Atherosclerotic Plaque — Lipid Core + Fibrous Cap
  const plaqueCoreMat = new THREE.MeshPhysicalMaterial({
    color: '#ebb028',
    map: textures.plaque.coreMap,
    bumpMap: textures.plaque.coreBumpMap,
    bumpScale: 0.055,
    roughness: 0.46,
    metalness: 0.02,
    clearcoat: 0.42,
    clearcoatRoughness: 0.34,
    sheen: 0.35,
    sheenColor: new THREE.Color('#ffe48a'),
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0
  });

  const plaqueCapMat = new THREE.MeshPhysicalMaterial({
    color: '#efd8a4',
    map: textures.plaque.capMap,
    bumpMap: textures.plaque.capBumpMap,
    bumpScale: 0.026,
    roughness: 0.24,
    metalness: 0.02,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
    sheen: 0.35,
    sheenColor: new THREE.Color('#fff4d4'),
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0
  });

  const plaqueCoreMesh = new THREE.Mesh(new THREE.BufferGeometry(), plaqueCoreMat);
  plaqueCoreMesh.castShadow = true;
  plaqueCoreMesh.receiveShadow = true;
  plaqueCoreMesh.userData.anatomyId = 'plaque';
  vesselGroup.add(plaqueCoreMesh);

  const plaqueCapMesh = new THREE.Mesh(new THREE.BufferGeometry(), plaqueCapMat);
  plaqueCapMesh.castShadow = true;
  plaqueCapMesh.receiveShadow = true;
  plaqueCapMesh.userData.anatomyId = 'plaque';
  vesselGroup.add(plaqueCapMesh);

  // Vasa Vasorum microvascular network on Layer 1 Adventitia
  const vasaVasorum = buildVasaVasorum(ARTERY_DIMENSIONS.layers[0].rOut);
  vesselGroup.add(vasaVasorum.group);

  let currentPeel = -1;
  let currentStenosis = -1;
  let currentMode = 'anatomical';
  let currentSelectedId = null;
  let highlightTime = 0;

  /**
   * Rebuilds procedural cutaway geometries whenever peelPct, stenosisPct, or heatmap mode updates.
   */
  function rebuildGeometry(peelPct, stenosisPct, mode = currentMode) {
    const layout = getPeelLayout(peelPct);
    const s = Math.max(0, Math.min(0.75, stenosisPct / 100));
    const { xMin, xMax, layers, plaqueCenterX, plaqueHalfWidth } = ARTERY_DIMENSIONS;
    const isHeatmap = mode === 'heatmap';

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const xStep = layout.stepX[i];

      let sampleOuter;
      let sampleInner;
      let computeVertexColor = null;

      if (layer.id === 'adventitia') {
        // Subtle organic fibrous undulation on outer adventitia sheath
        sampleOuter = (x, theta) => {
          const organic = 0.018 * Math.sin(x * 1.15 + theta * 3) + 0.01 * Math.cos(x * 2.3 - theta * 5);
          const r = layer.rOut + organic;
          return { y: r * Math.sin(theta), z: r * Math.cos(theta) };
        };
        sampleInner = (x, theta) => ({
          y: layer.rIn * Math.sin(theta),
          z: layer.rIn * Math.cos(theta)
        });
      } else if (layer.id === 'internalLamina') {
        // Distinct corrugated wavy elastic membrane
        sampleOuter = (x, theta) => {
          const wave = 0.022 * Math.sin(theta * 26 + x * 0.45);
          const r = layer.rOut + wave;
          return { y: r * Math.sin(theta), z: r * Math.cos(theta) };
        };
        sampleInner = (x, theta) => {
          const wave = 0.022 * Math.sin(theta * 26 + x * 0.45);
          const r = layer.rIn + wave;
          return { y: r * Math.sin(theta), z: r * Math.cos(theta) };
        };
      } else if (layer.id === 'intima') {
        // Innermost endothelial lining: smoothly conforms over the atherosclerotic plaque bulge!
        sampleInner = (x, theta) => {
          const cross = getLumenCrossSection(x, s);
          return {
            y: cross.centerY + cross.radius * Math.sin(theta),
            z: cross.centerZ + cross.radius * Math.cos(theta)
          };
        };
        sampleOuter = (x, theta) => {
          const cross = getLumenCrossSection(x, s);
          const pBlend = s > 0.005 ? Math.min(1, Math.pow(cross.env, 0.55) * 1.45) : 0;
          const intimaThick = 0.11 * (1 - pBlend) + 0.034 * pBlend;
          return {
            y: cross.centerY + (cross.radius + intimaThick) * Math.sin(theta),
            z: cross.centerZ + (cross.radius + intimaThick) * Math.cos(theta)
          };
        };

        if (isHeatmap) {
          computeVertexColor = (x, _theta, isInner) => {
            if (!isInner) return [0.16, 0.24, 0.38];
            const cross = getLumenCrossSection(x, s);
            const shearNorm = Math.min(1, 0.12 + cross.narrowing * 1.32);
            return sampleShearHeatmapRGB(shearNorm);
          };
        }
      } else {
        // Layer 2 (External Elastic Lamina) and Layer 3 (Tunica Media)
        sampleOuter = (x, theta) => ({
          y: layer.rOut * Math.sin(theta),
          z: layer.rOut * Math.cos(theta)
        });
        sampleInner = (x, theta) => ({
          y: layer.rIn * Math.sin(theta),
          z: layer.rIn * Math.cos(theta)
        });
      }

      const newGeom = buildSteppedShellGeometry({
        xMin,
        xMax,
        xStep,
        isOpen: layout.isOpen,
        cutCenterAngle: layout.cutCenterAngle,
        cutHalfAngle: layout.cutHalfAngle,
        segX: layer.id === 'intima' ? 60 : 44,
        segTheta: layer.id === 'internalLamina' ? 96 : 64,
        sampleOuter,
        sampleInner,
        computeVertexColor
      });

      layerMeshes[layer.id].geometry.dispose();
      layerMeshes[layer.id].geometry = newGeom;
    }

    // Build Atherosclerotic Plaque (Sub-endothelial yellow-amber lipid core + fibrous cap)
    if (s > 0.012) {
      const pMin = plaqueCenterX - plaqueHalfWidth;
      const pMax = plaqueCenterX + plaqueHalfWidth;
      const intimaStepX = layout.stepX[4];
      const plaqueOuterR = ARTERY_DIMENSIONS.layers[4].rOut - 0.008; // sits right beneath Internal Elastic Lamina

      // Yellow-amber necrotic lipid core filling the sub-endothelial pocket (strictly non-inverting lerp)
      const sampleCapOuter = (x, theta) => {
        const cross = getLumenCrossSection(x, s);
        const capThick = 0.044 * Math.sqrt(cross.env);
        const r = cross.radius + 0.036 + capThick;
        return {
          y: cross.centerY + r * Math.sin(theta),
          z: cross.centerZ + r * Math.cos(theta)
        };
      };

      const coreGeom = buildSteppedShellGeometry({
        xMin: pMin,
        xMax: pMax,
        xStep: Math.max(pMin, Math.min(pMax, intimaStepX)),
        isOpen: layout.isOpen && intimaStepX < pMax - 0.02,
        cutCenterAngle: layout.cutCenterAngle,
        cutHalfAngle: layout.cutHalfAngle,
        segX: 44,
        segTheta: 56,
        sampleOuter: (x, theta) => {
          const env = getPlaqueAxialEnvelope(x);
          const pIn = sampleCapOuter(x, theta);
          const wallY = plaqueOuterR * Math.sin(theta);
          const wallZ = plaqueOuterR * Math.cos(theta);
          const fill = Math.pow(env, 0.35);
          return {
            y: pIn.y + (wallY - pIn.y) * fill,
            z: pIn.z + (wallZ - pIn.z) * fill
          };
        },
        sampleInner: sampleCapOuter
      });

      // Pale collagenous Fibrous Cap directly beneath the endothelial lining
      const capGeom = buildSteppedShellGeometry({
        xMin: pMin,
        xMax: pMax,
        xStep: Math.max(pMin, Math.min(pMax, intimaStepX)),
        isOpen: layout.isOpen && intimaStepX < pMax - 0.02,
        cutCenterAngle: layout.cutCenterAngle,
        cutHalfAngle: layout.cutHalfAngle,
        segX: 38,
        segTheta: 56,
        sampleOuter: sampleCapOuter,
        sampleInner: (x, theta) => {
          const cross = getLumenCrossSection(x, s);
          const r = cross.radius + 0.036;
          return {
            y: cross.centerY + r * Math.sin(theta),
            z: cross.centerZ + r * Math.cos(theta)
          };
        }
      });

      plaqueCoreMesh.geometry.dispose();
      plaqueCoreMesh.geometry = coreGeom;
      plaqueCoreMesh.visible = true;

      plaqueCapMesh.geometry.dispose();
      plaqueCapMesh.geometry = capGeom;
      plaqueCapMesh.visible = true;
    } else {
      plaqueCoreMesh.visible = false;
      plaqueCapMesh.visible = false;
    }

    // Update vasa vasorum masking to stay flush only on intact Layer 1
    vasaVasorum.updatePeelMask(layout);

    currentPeel = peelPct;
    currentStenosis = stenosisPct;
  }

  /**
   * Switches wall materials cleanly between Anatomical Tissue, X-Ray Translucent, and Velocity & Shear Heatmap.
   */
  function setViewMode(mode) {
    currentMode = mode;

    for (const layer of ARTERY_DIMENSIONS.layers) {
      const { mat, cfg } = layerMaterials[layer.id];
      const isIntima = layer.id === 'intima';

      if (mode === 'anatomical') {
        mat.color.set(cfg.color);
        mat.map = cfg.map;
        mat.bumpMap = cfg.bumpMap;
        mat.roughnessMap = cfg.roughnessMap;
        mat.roughness = cfg.roughness;
        mat.clearcoat = cfg.clearcoat;
        mat.transparent = false;
        mat.opacity = 1.0;
        mat.depthWrite = true;
        mat.vertexColors = false;
        mat.side = THREE.FrontSide;
      } else if (mode === 'xray') {
        mat.color.set(cfg.xrayColor);
        mat.map = null;
        mat.bumpMap = cfg.bumpMap;
        mat.roughnessMap = null;
        mat.roughness = 0.14;
        mat.clearcoat = 1.0;
        mat.transparent = true;
        mat.opacity = cfg.xrayOpacity;
        mat.depthWrite = false;
        mat.vertexColors = false;
        mat.side = THREE.DoubleSide;
      } else {
        // Velocity & Shear Heatmap mode
        if (isIntima) {
          mat.color.set('#ffffff');
          mat.map = null;
          mat.bumpMap = cfg.bumpMap;
          mat.roughnessMap = null;
          mat.roughness = 0.25;
          mat.clearcoat = 0.85;
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.depthWrite = true;
          mat.vertexColors = true;
          mat.side = THREE.FrontSide;
        } else {
          mat.color.set('#304766');
          mat.map = null;
          mat.bumpMap = cfg.bumpMap;
          mat.roughnessMap = null;
          mat.roughness = 0.4;
          mat.clearcoat = 0.45;
          mat.transparent = true;
          mat.opacity = 0.34;
          mat.depthWrite = false;
          mat.vertexColors = false;
          mat.side = THREE.FrontSide;
        }
      }
      mat.needsUpdate = true;
    }

    // Plaque material adaptation per view mode
    if (mode === 'anatomical') {
      plaqueCoreMat.color.set('#ebb028');
      plaqueCoreMat.map = textures.plaque.coreMap;
      plaqueCoreMat.transparent = false;
      plaqueCoreMat.opacity = 1.0;
      plaqueCoreMat.depthWrite = true;

      plaqueCapMat.color.set('#efd8a4');
      plaqueCapMat.map = textures.plaque.capMap;
      plaqueCapMat.transparent = false;
      plaqueCapMat.opacity = 1.0;
      plaqueCapMat.depthWrite = true;
    } else if (mode === 'xray') {
      plaqueCoreMat.color.set('#ffb92a');
      plaqueCoreMat.map = null;
      plaqueCoreMat.transparent = true;
      plaqueCoreMat.opacity = 0.34;
      plaqueCoreMat.depthWrite = false;

      plaqueCapMat.color.set('#ffe29c');
      plaqueCapMat.map = null;
      plaqueCapMat.transparent = true;
      plaqueCapMat.opacity = 0.22;
      plaqueCapMat.depthWrite = false;
    } else {
      plaqueCoreMat.color.set('#d98a18');
      plaqueCoreMat.map = textures.plaque.coreMap;
      plaqueCoreMat.transparent = true;
      plaqueCoreMat.opacity = 0.62;
      plaqueCoreMat.depthWrite = true;

      plaqueCapMat.color.set('#ff6b2b');
      plaqueCapMat.map = null;
      plaqueCapMat.transparent = true;
      plaqueCapMat.opacity = 0.5;
      plaqueCapMat.depthWrite = false;
    }
    plaqueCoreMat.needsUpdate = true;
    plaqueCapMat.needsUpdate = true;

    vasaVasorum.setViewMode(mode);

    // Rebuild geometry so intima vertex colors populate/clear cleanly for heatmap
    if (currentPeel >= 0) {
      rebuildGeometry(currentPeel, currentStenosis, mode);
    }
  }

  function setSelectedAnatomy(id) {
    currentSelectedId = id;
    highlightTime = 0;
  }

  /**
   * Per-frame animation: rhythmic heartbeat radial expansion of Tunica Media & arterial wall,
   * plus gentle highlight pulse on the currently selected anatomical structure.
   */
  function update(dt, pulseVal, heartRateMode) {
    highlightTime += dt;

    // Subtle physiological radial distension synchronized with arterial systolic wave
    // Exercise increases pulse pressure amplitude slightly
    const amp = heartRateMode === 'exercise' ? 0.032 : 0.022;
    const radialScale = 1.0 + pulseVal * amp;

    // Tunica Media & elastic layers expand radially; plaque stays slightly stiffer
    for (const layer of ARTERY_DIMENSIONS.layers) {
      const mesh = layerMeshes[layer.id];
      const layerFactor =
        layer.id === 'media'
          ? 1.08
          : layer.id === 'internalLamina' || layer.id === 'externalLamina'
            ? 1.0
            : 0.92;
      const sRad = 1.0 + pulseVal * amp * layerFactor;
      mesh.scale.set(1.0, sRad, sRad);
    }
    vasaVasorum.group.scale.set(1.0, 1.0 + pulseVal * amp * 0.92, 1.0 + pulseVal * amp * 0.92);
    plaqueCoreMesh.scale.set(1.0, 1.0 + pulseVal * amp * 0.35, 1.0 + pulseVal * amp * 0.35);
    plaqueCapMesh.scale.set(1.0, 1.0 + pulseVal * amp * 0.45, 1.0 + pulseVal * amp * 0.45);

    // Subtle emissive highlight on selected anatomical layer
    const glowWave = 0.14 + 0.08 * Math.sin(highlightTime * 4.2);
    for (const layer of ARTERY_DIMENSIONS.layers) {
      const { mat } = layerMaterials[layer.id];
      if (currentSelectedId === layer.id) {
        mat.emissive.set('#38bdf8');
        mat.emissiveIntensity = glowWave;
      } else {
        mat.emissiveIntensity = Math.max(0, mat.emissiveIntensity - dt * 1.4);
      }
    }

    if (currentSelectedId === 'plaque') {
      plaqueCoreMat.emissive.set('#f59e0b');
      plaqueCoreMat.emissiveIntensity = glowWave * 1.25;
      plaqueCapMat.emissive.set('#fbbf24');
      plaqueCapMat.emissiveIntensity = glowWave * 0.9;
    } else {
      plaqueCoreMat.emissiveIntensity = Math.max(0, plaqueCoreMat.emissiveIntensity - dt * 1.4);
      plaqueCapMat.emissiveIntensity = Math.max(0, plaqueCapMat.emissiveIntensity - dt * 1.4);
    }

    return radialScale;
  }

  // Return clickable meshes for optional raycasting too
  function getInteractiveMeshes() {
    return [...Object.values(layerMeshes), plaqueCoreMesh, plaqueCapMesh];
  }

  return {
    group: rootGroup,
    rebuildGeometry,
    setViewMode,
    setSelectedAnatomy,
    update,
    getInteractiveMeshes
  };
}
