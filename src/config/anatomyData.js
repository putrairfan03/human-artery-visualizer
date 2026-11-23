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
 * Supports pre-stenosis, PCI stent lumen restoration (stentCompression 0..1),
 * transient balloon inflation (balloonOcclusion 0..1), and acute thrombosis (thrombusOcclusion 0..1).
 */
export function computeHemodynamics(
  stenosisPct,
  heartRateMode,
  pulseVal = 0.5,
  { stentCompression = 0, thrombusOcclusion = 0, balloonOcclusion = 0 } = {}
) {
  const rawS = Math.max(0, Math.min(0.75, stenosisPct / 100));
  // PCI stent compresses plaque outward, restoring ~88% of lost lumen diameter
  const stentedS = rawS * (1.0 - 0.88 * clamp01(stentCompression));
  const clotFrac = clamp01(thrombusOcclusion);
  const balloonFrac = clamp01(balloonOcclusion);
  // Effective diameter narrowing combines residual plaque + thrombus/balloon occlusion
  const effectiveNarrowing = Math.min(
    1.0,
    stentedS + (1.0 - stentedS) * Math.max(clotFrac, balloonFrac * 0.92)
  );

  const isExercise = heartRateMode === 'exercise';
  const bpm = isExercise ? 130 : 65;

  // Handle complete/near-complete thrombotic occlusion
  const isOccluded = clotFrac >= 0.88;
  const flowTransmission = isOccluded
    ? 0.0
    : Math.max(0.04, 1.0 - Math.pow(Math.max(clotFrac, balloonFrac * 0.85), 1.65));

  // Healthy conduit artery baseline peak systolic velocity (cm/s)
  const basePeakVel = isExercise ? 78 : 42;
  const openDiamFrac = Math.max(0.18, 1.0 - stentedS);
  const areaRatio = Math.max(0.0625, openDiamFrac * openDiamFrac);
  // Mild autoregulatory flow drop at high stenosis resistance
  const qRelative = (1.0 / (1.0 + 1.85 * Math.pow(stentedS, 3.6))) * flowTransmission;

  // During partial clot growth (0.1..0.85), jet momentarily intensifies before halting at total occlusion
  const clotJetFactor =
    clotFrac > 0.05 && !isOccluded ? 1.0 + 1.15 * Math.sin(Math.min(1, clotFrac / 0.88) * Math.PI) : 1.0;

  const peakVelocityCmS = isOccluded ? 0 : (basePeakVel * qRelative * clotJetFactor) / areaRatio;
  const liveVelocityCmS = peakVelocityCmS * (0.72 + 0.28 * pulseVal);

  // Wall shear stress (Pa) via Hagen-Poiseuille approximation at throat:
  const mu = 0.0035; // Pa*s blood dynamic viscosity
  const rHealthyM = 0.003; // 3.0 mm healthy lumen radius (6 mm diameter)
  const rThroatM = Math.max(0.00045, rHealthyM * (1.0 - Math.min(0.85, effectiveNarrowing)));
  const vMeanMS = (peakVelocityCmS * 0.56) / 100.0;
  const wssPa = isOccluded ? 0.0 : (4 * mu * vMeanMS) / rThroatM;

  // Reynolds number at throat
  const rho = 1060;
  const reynolds = isOccluded ? 0 : (rho * (peakVelocityCmS / 100) * (2 * rThroatM)) / mu;

  // Bernoulli + Borda-Carnot pressure drop across the throat (mmHg; 1 mmHg = 133.322 Pa)
  const vInMS = (basePeakVel * qRelative) / 100.0;
  const vThroatMS = peakVelocityCmS / 100.0;
  const bernoulliPa = isOccluded
    ? (isExercise ? 92 : 76) * 133.322 // Full proximal systolic head blocked across total clot
    : 0.5 * rho * Math.max(0, vThroatMS * vThroatMS - vInMS * vInMS);
  const viscousDropPa = isOccluded
    ? 0
    : (8 * mu * 0.018 * (vInMS * Math.PI * rHealthyM * rHealthyM)) /
      (Math.PI * Math.pow(rThroatM, 4));
  const peakDeltaPMmHg = (bernoulliPa + viscousDropPa) / 133.322;

  let regime = 'Laminar';
  let regimeClass = 'laminar';
  if (isOccluded) {
    regime = 'Occluded';
    regimeClass = 'occluded';
  } else if (balloonFrac > 0.45) {
    regime = 'Balloon Hold';
    regimeClass = 'transitional';
  } else if (effectiveNarrowing >= 0.5 || (isExercise && effectiveNarrowing >= 0.42) || reynolds > 2100) {
    regime = 'Turbulent';
    regimeClass = 'turbulent';
  } else if (effectiveNarrowing >= 0.25 || (isExercise && effectiveNarrowing >= 0.2) || reynolds > 1200) {
    regime = 'Transitional';
    regimeClass = 'transitional';
  }

  return {
    bpm,
    effectiveStenosisPct: Math.round(effectiveNarrowing * 100),
    lumenDiameterPct: isOccluded ? 0 : Math.round((1 - effectiveNarrowing) * 100),
    areaReductionPct: isOccluded ? 100 : Math.round((1 - (1 - effectiveNarrowing) ** 2) * 100),
    peakVelocityCmS,
    liveVelocityCmS,
    wssPa,
    peakDeltaPMmHg,
    reynolds: Math.round(reynolds),
    regime,
    regimeClass,
    isOccluded
  };
}

/**
 * Samples axial profiles of Blood Velocity v(x) [cm/s] and Cumulative Pressure Drop ΔP(x) [mmHg]
 * across the entire artery segment [xMin, xMax] using Continuity, Bernoulli, and Hagen-Poiseuille laws.
 */
export function computeAxialHemodynamicProfile(
  stenosisPct,
  heartRateMode,
  pulseVal = 0.5,
  { stentCompression = 0, thrombusOcclusion = 0, balloonOcclusion = 0 } = {},
  sampleCount = 64
) {
  const { xMin, xMax, plaqueCenterX } = ARTERY_DIMENSIONS;
  const rawS = Math.max(0, Math.min(0.75, stenosisPct / 100));
  const stentedS = rawS * (1.0 - 0.88 * clamp01(stentCompression));
  const clotFrac = clamp01(thrombusOcclusion);
  const balloonFrac = clamp01(balloonOcclusion);
  const isExercise = heartRateMode === 'exercise';
  const isOccluded = clotFrac >= 0.88;

  const rho = 1060; // kg/m^3 blood density
  const mu = 0.0035; // Pa*s dynamic viscosity
  const r0 = 0.003; // 3 mm healthy radius
  const segmentLengthM = 0.056; // 56 mm modeled vessel segment
  const dxM = segmentLengthM / (sampleCount - 1);

  const basePeakVel = isExercise ? 78 : 42;
  const pulseMod = 0.78 + 0.22 * pulseVal;
  const flowTransmission = isOccluded
    ? 0.0
    : Math.max(0.05, 1.0 - Math.pow(Math.max(clotFrac, balloonFrac * 0.85), 1.65));
  const qRelative = (1.0 / (1.0 + 1.85 * Math.pow(stentedS, 3.6))) * flowTransmission;

  const vInCmS = basePeakVel * qRelative * pulseMod;
  const vInMS = vInCmS / 100.0;
  const Q = vInMS * 0.56 * Math.PI * r0 * r0; // Volumetric flow rate m^3/s

  const xs = new Array(sampleCount);
  const velocityCmS = new Array(sampleCount);
  const pressureDropMmHg = new Array(sampleCount);

  let cumulativeViscousPa = 0;
  let maxVelocity = 0;
  let maxPressureDrop = 0;
  let peakVelAtThroatMS = vInMS;

  for (let i = 0; i < sampleCount; i++) {
    const f = i / (sampleCount - 1);
    const x = xMin + (xMax - xMin) * f;
    xs[i] = x;

    const env = getPlaqueAxialEnvelope(x);
    // Local narrowing from compressed plaque + localized thrombus/balloon at throat
    const localClot = clotFrac * Math.pow(env, 0.7);
    const localBalloon = balloonFrac * Math.pow(env, 0.8);
    const localNarrowing = Math.min(
      0.99,
      stentedS * env + (1.0 - stentedS * env) * Math.max(localClot, localBalloon * 0.9)
    );

    if (isOccluded) {
      // Total thrombotic occlusion: upstream stasis near 0, sudden step drop across clot to 0 downstream
      const upstream = x < plaqueCenterX;
      const vx = upstream ? 3.5 * pulseVal * Math.max(0, 1 - env) : 0.0;
      velocityCmS[i] = vx;
      // Full arterial pressure drop occurs right across the occlusive thrombus barrier
      const sigmoid = 1.0 / (1.0 + Math.exp(-(x - plaqueCenterX) * 2.8));
      const headMmHg = (isExercise ? 92 : 76) * (0.85 + 0.15 * pulseVal);
      const dp = headMmHg * sigmoid;
      pressureDropMmHg[i] = dp;
      if (vx > maxVelocity) maxVelocity = vx;
      if (dp > maxPressureDrop) maxPressureDrop = dp;
      continue;
    }

    const rLocal = Math.max(0.00048, r0 * (1.0 - Math.min(0.84, localNarrowing)));
    const areaRatio = (rLocal / r0) * (rLocal / r0);
    // Continuity equation: v(x) = v_in * (A_0 / A(x))
    const vxMS = Math.min(5.2, vInMS / Math.max(0.0625, areaRatio));
    const vxCmS = vxMS * 100.0;
    velocityCmS[i] = vxCmS;
    if (vxMS > peakVelAtThroatMS) peakVelAtThroatMS = vxMS;

    // Hagen-Poiseuille viscous gradient: dP/dx = 8 * mu * Q / (pi * r^4)
    const dPviscDx = (8 * mu * Q) / (Math.PI * Math.pow(rLocal, 4));
    cumulativeViscousPa += dPviscDx * dxM;

    // Bernoulli convective pressure drop: ΔP_B = 0.5 * rho * (v(x)^2 - v_in^2)
    const bernoulliPa = 0.5 * rho * Math.max(0, vxMS * vxMS - vInMS * vInMS);

    // Post-stenotic irreversible turbulent expansion loss (Borda-Carnot) downstream of throat
    let turbLossPa = 0;
    if (x > plaqueCenterX) {
      const recovery = Math.min(1.0, (x - plaqueCenterX) / 2.6);
      const expansionDeltaV = Math.max(0, peakVelAtThroatMS - vInMS);
      // Turbulent dissipation prevents full Bernoulli pressure recovery downstream
      turbLossPa = 0.58 * 0.5 * rho * expansionDeltaV * expansionDeltaV * recovery;
    }

    const totalDropMmHg = (cumulativeViscousPa + bernoulliPa + turbLossPa) / 133.322;
    pressureDropMmHg[i] = totalDropMmHg;

    if (vxCmS > maxVelocity) maxVelocity = vxCmS;
    if (totalDropMmHg > maxPressureDrop) maxPressureDrop = totalDropMmHg;
  }

  return {
    xs,
    velocityCmS,
    pressureDropMmHg,
    maxVelocity,
    maxPressureDrop,
    netPressureLoss: pressureDropMmHg[sampleCount - 1],
    throatX: plaqueCenterX,
    isOccluded
  };
}

/**
 * 7-Step Guided Anatomical & Hemodynamic Tour (outside -> inside -> pathology -> intervention)
 */
export const GUIDED_TOUR_STEPS = [
  {
    step: 1,
    anatomyId: 'adventitia',
    title: 'Tunica Adventitia & Vasa Vasorum',
    badge: 'Layer 1 · Outermost',
    peelPct: 18,
    stenosisPct: 30,
    viewMode: 'anatomical',
    cameraPos: [-3.9, 3.2, 8.8],
    cameraTarget: [-2.4, 0.25, 0.0],
    summary:
      'The outermost protective sheath made of dense Type I collagen and elastin fibers. Notice the branching red arterioles and blue venules (vasa vasorum) supplying oxygen directly to the thick arterial wall.'
  },
  {
    step: 2,
    anatomyId: 'externalLamina',
    title: 'External Elastic Lamina',
    badge: 'Layer 2 · Elastic Boundary',
    peelPct: 48,
    stenosisPct: 30,
    viewMode: 'anatomical',
    cameraPos: [-3.4, 2.5, 6.8],
    cameraTarget: [-3.3, 0.2, 0.0],
    summary:
      'Peeling back the adventitia reveals a thin, fenestrated sheet of elastin. Its microscopic pores allow nutrient diffusion while evenly distributing circumferential tension between the outer sheath and smooth muscle.'
  },
  {
    step: 3,
    anatomyId: 'media',
    title: 'Tunica Media (Smooth Muscle)',
    badge: 'Layer 3 · Middle Muscular',
    peelPct: 64,
    stenosisPct: 30,
    viewMode: 'anatomical',
    cameraPos: [-2.1, 2.35, 6.4],
    cameraTarget: [-2.35, 0.1, 0.0],
    summary:
      'The thickest concentric arterial layer, packed with circular vascular smooth muscle cells. Watch it rhythmically expand and recoil with every heartbeat—regulating blood pressure through vasoconstriction and vasodilation.'
  },
  {
    step: 4,
    anatomyId: 'internalLamina',
    title: 'Internal Elastic Lamina',
    badge: 'Layer 4 · Wavy Barrier',
    peelPct: 76,
    stenosisPct: 30,
    viewMode: 'anatomical',
    cameraPos: [-1.0, 2.1, 5.9],
    cameraTarget: [-1.35, 0.1, 0.0],
    summary:
      'A prominent corrugated, wavy golden elastic sheet separating the smooth muscle media from the inner intima. It provides instant elastic recoil and acts as a barrier restraining smooth muscle migration.'
  },
  {
    step: 5,
    anatomyId: 'intima',
    title: 'Tunica Intima & Endothelium',
    badge: 'Layer 5 · Innermost Lining',
    peelPct: 86,
    stenosisPct: 30,
    viewMode: 'anatomical',
    cameraPos: [0.3, 1.8, 5.4],
    cameraTarget: [-0.35, 0.05, 0.0],
    summary:
      'A single cobblestone monolayer of flow-aligned endothelial cells in direct contact with blood. Its glistening non-thrombogenic surface senses wall shear stress and secretes nitric oxide (NO) to keep vessels relaxed.'
  },
  {
    step: 6,
    anatomyId: 'plaque',
    title: 'Stenotic Plaque & Venturi Jet',
    badge: 'Pathology · Hemodynamics',
    peelPct: 82,
    stenosisPct: 65,
    viewMode: 'heatmap',
    cameraPos: [2.8, 1.5, 5.8],
    cameraTarget: [1.55, -0.05, -0.1],
    summary:
      'Sub-endothelial cholesterol buildup narrows the lumen by 65%. By Continuity (A₁v₁ = A₂v₂) and Bernoulli’s principle, blood accelerates into a fiery red high-shear jet through the throat, spawning turbulent swirling eddies downstream.'
  },
  {
    step: 7,
    anatomyId: 'plaque',
    title: 'Clinical Intervention & Thrombosis',
    badge: 'PCI Stent · Acute Occlusion',
    peelPct: 80,
    stenosisPct: 65,
    viewMode: 'anatomical',
    cameraPos: [3.1, 1.65, 6.2],
    cameraTarget: [1.5, -0.05, -0.1],
    summary:
      'At severe stenosis (≥50%), a vulnerable fibrous cap can rupture and trigger an occlusive fibrin-platelet thrombus—or clinicians can perform PCI balloon angioplasty and deploy a metallic titanium stent to restore smooth laminar flow.',
    showActionShortcuts: true
  }
];

/**
 * 5-Question Interactive Biomedical & Hemodynamics Self-Check Quiz
 */
export const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    question:
      'Which arterial wall layer contains circular smooth muscle cells responsible for active vasomotor tone and pulse recoil?',
    options: [
      'Tunica Adventitia',
      'Tunica Media',
      'Internal Elastic Lamina',
      'Tunica Intima (Endothelium)'
    ],
    correctIndex: 1,
    explanation:
      'The Tunica Media is the thickest concentric layer (~48% of wall) composed of vascular smooth muscle cells and elastic lamellae that regulate lumen diameter and blood pressure.'
  },
  {
    id: 'q2',
    question:
      'According to Hagen–Poiseuille’s Law (R ∝ 1/r⁴), what happens to vascular flow resistance if atherosclerotic plaque cuts the lumen radius in half (50% narrowing)?',
    options: [
      'Resistance doubles (2×)',
      'Resistance quadruples (4×)',
      'Resistance increases 8-fold (8×)',
      'Resistance increases 16-fold (16×)'
    ],
    correctIndex: 3,
    explanation:
      'Because resistance scales inversely with the fourth power of radius (1 / 0.5⁴ = 16), even a 50% diameter reduction dramatically increases flow resistance and energy loss.'
  },
  {
    id: 'q3',
    question:
      'As blood accelerates through a tight stenotic throat, how do axial velocity v(x) and static pressure P(x) behave per Continuity & Bernoulli’s principle?',
    options: [
      'Velocity spikes sharply while static pressure drops across the throat',
      'Both velocity and static pressure rise equally at the throat',
      'Velocity drops to zero while static pressure spikes',
      'Velocity remains constant regardless of lumen narrowing'
    ],
    correctIndex: 0,
    explanation:
      'Conserving volumetric flow (Q = Av) forces blood velocity to surge in the narrowed throat, converting static pressure energy into kinetic energy (Venturi effect) and creating a steep ΔP drop.'
  },
  {
    id: 'q4',
    question:
      'What directly triggers rapid occlusive thrombus formation during an acute plaque rupture event?',
    options: [
      'Over-expansion of the vasa vasorum on the outer adventitia',
      'A fissure in the fibrous cap exposing thrombogenic lipid core to platelets & fibrin',
      'Calcification of the External Elastic Lamina',
      'Excessive nitric oxide release by healthy endothelium'
    ],
    correctIndex: 1,
    explanation:
      'When high wall shear stress tears a thin fibrous cap, exposed sub-endothelial lipid core and tissue factor rapidly activate spiky platelets and polymerize a 3D fibrin mesh that traps RBCs into an occlusive clot.'
  },
  {
    id: 'q5',
    question:
      'How does PCI balloon angioplasty with metallic stent deployment restore healthy arterial hemodynamics?',
    options: [
      'It dissolves the Tunica Media smooth muscle layer',
      'It permanently blocks blood flow downstream of the plaque',
      'The inflated balloon compresses plaque outward and the titanium mesh scaffolds a wide lumen for laminar flow',
      'It increases Reynolds number to maintain turbulent mixing'
    ],
    correctIndex: 2,
    explanation:
      'Balloon inflation radially compresses the atherosclerotic plaque against the wall, while the deployed diamond-strut metallic stent maintains lumen patency—lowering throat velocity, wall shear stress, and ΔP back to laminar flow.'
  }
];

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
