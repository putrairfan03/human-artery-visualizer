/**
 * Anatomical Metadata, Layer Dimensions, Stenosis Profiles & Camera Presets
 * Shared between 3D artery geometry, blood flow simulation, and HUD cards.
 */

export const ARTERY_DIMENSIONS = {
  length: 14.0,
  xMin: -7.0,
  xMax: 7.0,
  lumenRadius: 1.32,
  plaqueCenterX: 1.5,
  plaqueHalfWidth: 2.35,
  // Cutaway angular sector facing the viewer (centered slightly above +Z)
  cutCenterAngle: 0.14 * Math.PI,
  cutHalfAngleMin: 0.38 * Math.PI, // ~137 deg at partial peel
  cutHalfAngleMax: 0.47 * Math.PI, // ~169 deg at 100% peel
  // Radial layer geometry specs (with tiny 0.01 separation to avoid z-fighting)
  layers: [
    {
      id: 'adventitia',
      index: 0,
      shortNum: '1',
      tag: 'Layer 1 · Outermost',
      name: 'Tunica Adventitia',
      shortName: 'Tunica Adventitia',
      swatch: '#d7a896',
      rIn: 2.25,
      rOut: 2.62,
      peelTargetX: -5.2,
      thicknessPct: '~30% of wall',
      primaryTissue: 'Collagen & Elastin',
      composition:
        'Dense irregular fibroelastic connective tissue rich in Type I collagen bundles, fibroblasts, autonomic nerve endings, and an exterior microvascular plexus (vasa vasorum).',
      function:
        'Anchors the artery to surrounding perivascular tissue, prevents over-distension under peak systolic pressure, and supplies oxygen and nutrients to the outer arterial wall via the vasa vasorum.'
    },
    {
      id: 'externalLamina',
      index: 1,
      shortNum: '2',
      tag: 'Layer 2 · Boundary Sheet',
      name: 'External Elastic Lamina',
      shortName: 'Ext. Elastic Lamina',
      swatch: '#e8cf8a',
      rIn: 2.13,
      rOut: 2.24,
      peelTargetX: -4.05,
      thicknessPct: '~6% of wall',
      primaryTissue: 'Fenestrated Elastin',
      composition:
        'A thin, sheet-like fenestrated elastin membrane perforated by microscopic apertures allowing nutrient diffusion and signaling between the adventitia and media.',
      function:
        'Forms a resilient structural boundary separating the fibrous Tunica Adventitia from the contractile Tunica Media, distributing circumferential wall tension evenly.'
    },
    {
      id: 'media',
      index: 2,
      shortNum: '3',
      tag: 'Layer 3 · Middle Muscular',
      name: 'Tunica Media',
      shortName: 'Tunica Media',
      swatch: '#b83c44',
      rIn: 1.57,
      rOut: 2.12,
      peelTargetX: -2.65,
      thicknessPct: '~48% of wall',
      primaryTissue: 'Smooth Muscle',
      composition:
        'The thickest concentric arterial stratum, packed with helically and circumferentially arranged vascular smooth muscle cells (VSMCs) interwoven with elastic lamellae and reticular fibers.',
      function:
        'Generates active vasomotor tone (vasoconstriction and vasodilation) to regulate blood pressure and regional perfusion, while absorbing and recoiling with every cardiac pulse wave.'
    },
    {
      id: 'internalLamina',
      index: 3,
      shortNum: '4',
      tag: 'Layer 4 · Wavy Barrier',
      name: 'Internal Elastic Lamina',
      shortName: 'Int. Elastic Lamina',
      swatch: '#f2df9b',
      rIn: 1.44,
      rOut: 1.56,
      peelTargetX: -1.55,
      thicknessPct: '~7% of wall',
      primaryTissue: 'Corrugated Elastin',
      composition:
        'A prominent, undulated (wavy) acellular sheet of dense elastin fibers with fenestrations permitting molecular exchange between the intima and smooth muscle cells.',
      function:
        'Provides elastic recoil immediately beneath the intima and acts as a critical mechanical barrier restraining smooth muscle migration—disrupted during atherosclerotic remodeling.'
    },
    {
      id: 'intima',
      index: 4,
      shortNum: '5',
      tag: 'Layer 5 · Innermost',
      name: 'Tunica Intima / Endothelium',
      shortName: 'Tunica Intima',
      swatch: '#e06d79',
      rIn: 1.32,
      rOut: 1.43,
      peelTargetX: -0.45,
      thicknessPct: '~9% of wall',
      primaryTissue: 'Endothelial Monolayer',
      composition:
        'A single cobblestone layer of flow-aligned simple squamous endothelial cells resting on a basal lamina and thin sub-endothelial connective layer.',
      function:
        'Creates an ultra-smooth, non-thrombogenic glistening interface with flowing blood, senses wall shear stress, and releases nitric oxide (NO) to relax smooth muscle and inhibit clotting.'
    }
  ]
};

export const EXTRA_ANATOMY = {
  lumen: {
    id: 'lumen',
    shortNum: 'L',
    tag: 'Central Channel',
    name: 'Arterial Lumen & Blood',
    shortName: 'Lumen & Blood Flow',
    swatch: '#e11d48',
    thicknessPct: 'Variable (25–100%)',
    primaryTissue: 'Plasma + Formed Cells',
    composition:
      'Central blood-carrying conduit transporting biconcave erythrocytes (RBCs, ~45% hematocrit), leukocytes (WBCs), and thrombocytes (platelets) suspended in aqueous plasma.',
    function:
      'Delivers oxygenated blood under pulsatile arterial pressure. Healthy segments maintain smooth parabolic Poiseuille laminar flow; narrowed zones accelerate flow into high-shear turbulent jets.'
  },
  plaque: {
    id: 'plaque',
    shortNum: 'P',
    tag: 'Pathology · Stenosis',
    name: 'Atherosclerotic Plaque',
    shortName: 'Atherosclerotic Plaque',
    swatch: '#f59e0b',
    thicknessPct: 'Dynamic Bulge',
    primaryTissue: 'Lipid Core & Fibrous Cap',
    composition:
      'Sub-endothelial accumulation of oxidized LDL cholesterol, macrophage foam cells, and necrotic lipid debris sealed beneath a collagen-rich fibrous cap bulging into the lumen.',
    function:
      'Progressively narrows the effective lumen diameter (stenosis), elevating peak blood velocity and wall shear stress at the throat while inducing low-shear swirling recirculation eddies downstream.'
  }
};

export const ALL_ANATOMY_ITEMS = [
  ...ARTERY_DIMENSIONS.layers,
  EXTRA_ANATOMY.lumen,
  EXTRA_ANATOMY.plaque
];

export const ANATOMY_BY_ID = Object.fromEntries(
  ALL_ANATOMY_ITEMS.map((item) => [item.id, item])
);

export const CAMERA_PRESETS = {
  hero: {
    label: 'Hero 3/4 Cutaway',
    position: [4.6, 3.3, 11.4],
    target: [0.25, -0.15, 0.0]
  },
  crossSection: {
    label: 'Cross-Section End View',
    position: [12.4, 0.45, 2.35],
    target: [0.6, 0.0, 0.0]
  },
  stenosis: {
    label: 'Stenosis Close-Up',
    position: [2.8, 1.35, 5.7],
    target: [1.55, -0.05, -0.15]
  },
  peelOverview: {
    label: 'Layer Peel Overview',
    position: [-2.4, 4.4, 10.6],
    target: [-2.05, 0.0, 0.0]
  }
};

/**
 * Analytic plaque axial profile u in [-1, 1] -> [0, 1]
 * Asymmetric shoulder: steeper upstream, smoother tapered downstream recovery.
 */
export function getPlaqueAxialEnvelope(x) {
  const { plaqueCenterX, plaqueHalfWidth } = ARTERY_DIMENSIONS;
  const u = (x - plaqueCenterX) / plaqueHalfWidth;
  if (u <= -1.0 || u >= 1.0) return 0.0;
  const s = u < 0 ? Math.max(-1.0, u * 1.08) : Math.min(1.0, u * 0.94);
  const c = 0.5 * (1.0 + Math.cos(Math.PI * s));
  return Math.pow(c, 1.65);
}

/**
 * Exact luminal circle at axial position x for a given stenosis fraction (0.0 to 0.75).
 * Shared identically by 3D plaque/endothelium meshes AND blood cell physics so zero clipping occurs.
 */
export function getLumenCrossSection(x, stenosis) {
  const baseR = ARTERY_DIMENSIONS.lumenRadius;
  const env = getPlaqueAxialEnvelope(x);
  const narrowing = stenosis * env;
  const radius = baseR * (1.0 - narrowing);
  // Subtle eccentric upward-forward lumen shift so bottom/back plaque bulge is sculptural & realistic
  const centerY = baseR * narrowing * 0.21;
  const centerZ = baseR * narrowing * 0.08;
  return { radius, centerY, centerZ, env, narrowing };
}

/**
 * Realistic arterial pressure pulse waveform with systolic upstroke & dicrotic notch.
 * phase in [0, 1) -> returns value in [0, 1].
 */
export function sampleArterialPulse(phase) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.16) {
    // Rapid systolic upstroke
    const t = p / 0.16;
    return Math.sin(t * Math.PI * 0.5) ** 1.4;
  } else if (p < 0.34) {
    // Systolic fall into dicrotic incisura
    const t = (p - 0.16) / 0.18;
    return 1.0 - 0.58 * (0.5 - 0.5 * Math.cos(t * Math.PI));
  } else if (p < 0.45) {
    // Dicrotic wave rebound (aortic valve closure)
    const t = (p - 0.34) / 0.11;
    return 0.42 + 0.13 * Math.sin(t * Math.PI);
  } else {
    // Diastolic exponential runoff
    const t = (p - 0.45) / 0.55;
    return 0.42 * Math.exp(-3.1 * t) * (1.0 - t * 0.18);
  }
}

/**
 * Compute physiologically grounded hemodynamic telemetry values.
 */
export function computeHemodynamics(stenosisPct, heartRateMode, pulseVal = 0.5) {
  const s = Math.max(0, Math.min(0.75, stenosisPct / 100));
  const isExercise = heartRateMode === 'exercise';
  const bpm = isExercise ? 130 : 65;

  // Healthy conduit artery baseline peak systolic velocity (cm/s)
  const basePeakVel = isExercise ? 78 : 42;
  const areaRatio = Math.max(0.0625, (1 - s) * (1 - s));
  // Mild autoregulatory flow drop at high stenosis resistance
  const qRelative = 1.0 / (1.0 + 1.85 * Math.pow(s, 3.6));
  const peakVelocityCmS = (basePeakVel * qRelative) / areaRatio;
  const liveVelocityCmS = peakVelocityCmS * (0.72 + 0.28 * pulseVal);

  // Wall shear stress (Pa) via Hagen-Poiseuille approximation at throat:
  // tau = 4 * mu * v_mean / r
  const mu = 0.0035; // Pa*s blood dynamic viscosity
  const rHealthyM = 0.003; // 3.0 mm healthy lumen radius (6 mm diameter)
  const rThroatM = rHealthyM * (1 - s);
  const vMeanMS = (peakVelocityCmS * 0.56) / 100.0;
  const wssPa = (4 * mu * vMeanMS) / rThroatM;

  // Reynolds number at throat
  const rho = 1060;
  const reynolds = (rho * (peakVelocityCmS / 100) * (2 * rThroatM)) / mu;

  let regime = 'Laminar';
  let regimeClass = 'laminar';
  if (s >= 0.5 || (isExercise && s >= 0.42) || reynolds > 2100) {
    regime = 'Turbulent';
    regimeClass = 'turbulent';
  } else if (s >= 0.25 || (isExercise && s >= 0.2) || reynolds > 1200) {
    regime = 'Transitional';
    regimeClass = 'transitional';
  }

  return {
    bpm,
    lumenDiameterPct: Math.round((1 - s) * 100),
    areaReductionPct: Math.round((1 - areaRatio) * 100),
    peakVelocityCmS,
    liveVelocityCmS,
    wssPa,
    reynolds: Math.round(reynolds),
    regime,
    regimeClass
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Computes exact stepped cutaway layout for peelPct in [0, 100].
 * Shared by 3D artery layer builders, vasa vasorum masking, and 3D callout pins.
 */
export function getPeelLayout(peelPct) {
  const p = clamp01(peelPct / 100);
  const { xMax, cutCenterAngle, cutHalfAngleMin, cutHalfAngleMax, layers } = ARTERY_DIMENSIONS;

  if (p <= 0.002) {
    return {
      peel: 0,
      isOpen: false,
      cutCenterAngle,
      cutHalfAngle: 0,
      stepX: layers.map(() => xMax)
    };
  }

  // Smoothly open angular window early, then widen into full longitudinal hemisection
  const angleOpen = smoothstep(0.0, 0.22, p);
  const angleWiden = smoothstep(0.22, 1.0, p);
  const cutHalfAngle =
    angleOpen * cutHalfAngleMin + angleWiden * (cutHalfAngleMax - cutHalfAngleMin);

  // Staggered axial peel progression: outer layers begin peeling slightly earlier
  // so every layer terrace is clearly visible across 30%–100% peel.
  const stepX = layers.map((layer, idx) => {
    const startDelay = idx * 0.045;
    const localT = smoothstep(startDelay, 0.72 + idx * 0.04, p);
    const fineExtend = smoothstep(0.72, 1.0, p) * 0.42;
    const targetX = layer.peelTargetX - fineExtend;
    return xMax + (targetX - xMax) * localT;
  });

  return {
    peel: p,
    isOpen: cutHalfAngle > 0.015,
    cutCenterAngle,
    cutHalfAngle,
    stepX
  };
}

/**
 * Returns live 3D anchor position and ideal camera focus (position & target)
 * for any of the 7 clickable anatomical pins / legend entries.
 */
export function getAnatomyPinAnchor(id, peelPct, stenosisPct) {
  const layout = getPeelLayout(peelPct);
  const s = clamp01(stenosisPct / 100);
  const { layers, xMin, xMax, plaqueCenterX } = ARTERY_DIMENSIONS;

  const layer = layers.find((l) => l.id === id);
  if (layer) {
    const idx = layer.index;
    const sx = layout.stepX[idx];
    const nextSx = idx < layers.length - 1 ? layout.stepX[idx + 1] : Math.min(xMax - 0.8, sx + 1.35);

    // Place pin cleanly on the exposed terrace of this layer
    let anchorX;
    let theta;
    let r;

    if (!layout.isOpen) {
      // Closed tube: arrange pins along the exterior and right radial cross-section rim
      anchorX = idx === 0 ? -1.8 : xMax;
      theta = idx === 0 ? 0.25 * Math.PI : (0.18 - idx * 0.09) * Math.PI;
      r = idx === 0 ? layer.rOut + 0.05 : 0.5 * (layer.rIn + layer.rOut);
    } else if (idx === 0) {
      // Layer 1 Adventitia: sit on intact fibrous exterior just upstream of step 1
      anchorX = Math.max(xMin + 0.85, sx - 0.85);
      theta = 0.28 * Math.PI;
      r = layer.rOut + 0.06;
    } else {
      // Layers 2-5: sit mid-terrace where this layer's outer surface is exposed by the peeled layer above it
      const prevSx = layout.stepX[idx - 1];
      const terraceSpan = sx - prevSx;
      if (terraceSpan > 0.28) {
        anchorX = prevSx + terraceSpan * 0.52;
        theta = layout.cutCenterAngle + (idx % 2 === 0 ? 0.14 : -0.1) * Math.PI;
        r = layer.rOut + 0.03;
      } else {
        // Fallback onto the cutaway thickness edge
        anchorX = Math.min(xMax - 0.6, sx + 0.55);
        theta = layout.cutCenterAngle + layout.cutHalfAngle;
        r = 0.5 * (layer.rIn + layer.rOut);
      }
    }

    const pos = [anchorX, r * Math.sin(theta), r * Math.cos(theta)];
    const camPos = [
      anchorX + (idx === 0 ? -0.9 : 0.9),
      pos[1] + 1.55,
      Math.max(4.4, pos[2] + 4.35)
    ];
    return {
      anchor: pos,
      cameraPos: camPos,
      cameraTarget: [anchorX, pos[1] * 0.35, 0.0]
    };
  }

  if (id === 'lumen') {
    const anchorX = 3.15;
    const anchor = [anchorX, 0.22, 0.15];
    return {
      anchor,
      cameraPos: [anchorX + 1.4, 1.45, 5.4],
      cameraTarget: [anchorX - 0.35, 0.0, 0.0]
    };
  }

  // Pathology: Atherosclerotic Plaque
  const cross = getLumenCrossSection(plaqueCenterX, s);
  const plaqueTopY = cross.centerY - cross.radius - 0.14;
  const anchorY = s > 0.03 ? Math.max(-1.32, plaqueTopY) : -1.25;
  const anchor = [plaqueCenterX, anchorY, 0.42];
  return {
    anchor,
    cameraPos: [plaqueCenterX + 1.25, 1.25, 5.25],
    cameraTarget: [plaqueCenterX, -0.15, -0.1]
  };
}
