import * as THREE from 'three';

/**
 * Procedural Biomedical PBR Texture & Studio Environment Generator
 * Synthesizes seamless organic albedo, bump, and roughness CanvasTextures
 * for every arterial wall layer, atherosclerotic plaque, and clinical studio PMREM.
 */

function createPRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toTexture(canvas, { isColor = false, repeatX = 2, repeatY = 2 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Draw tiled strokes across edges so texture wraps seamlessly in both U and V.
 */
function drawWrapped(ctx, size, drawFn) {
  for (let ox = -size; ox <= size; ox += size) {
    for (let oy = -size; oy <= size; oy += size) {
      ctx.save();
      ctx.translate(ox, oy);
      drawFn();
      ctx.restore();
    }
  }
}

/**
 * Layer 1: Tunica Adventitia — fibrous interwoven collagen & elastin connective tissue
 */
function generateAdventitiaTextures() {
  const size = 512;
  const rng = createPRNG(104729);
  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);

  const cCtx = colorCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  // Base fibro-collagenous tissue tone
  cCtx.fillStyle = '#cf9e8c';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#b8b8b8';
  rCtx.fillRect(0, 0, size, size);

  // Soft mottled organic fascia blotches
  for (let i = 0; i < 140; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 22 + rng() * 58;
    const warm = rng() > 0.45;
    const grad = cCtx.createRadialGradient(x, y, 2, x, y, rad);
    grad.addColorStop(0, warm ? 'rgba(232, 198, 182, 0.16)' : 'rgba(164, 102, 92, 0.14)');
    grad.addColorStop(1, 'rgba(207, 158, 140, 0)');
    drawWrapped(cCtx, size, () => {
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.arc(x, y, rad, 0, Math.PI * 2);
      cCtx.fill();
    });
  }

  // Interwoven wavy collagen bundles (multiple criss-crossing angles)
  for (let i = 0; i < 420; i++) {
    const x0 = rng() * size;
    const y0 = rng() * size;
    const angle = (rng() - 0.5) * Math.PI * 0.95 + (i % 2 === 0 ? 0.25 : -0.35);
    const len = 65 + rng() * 140;
    const bend = (rng() - 0.5) * 34;
    const width = 1.2 + rng() * 3.2;

    const x1 = x0 + Math.cos(angle) * len;
    const y1 = y0 + Math.sin(angle) * len;
    const cx = 0.5 * (x0 + x1) - Math.sin(angle) * bend;
    const cy = 0.5 * (y0 + y1) + Math.cos(angle) * bend;

    const bright = rng();
    const colStr =
      bright > 0.62
        ? `rgba(245, 224, 212, ${0.18 + rng() * 0.25})`
        : bright > 0.28
          ? `rgba(218, 165, 148, ${0.22 + rng() * 0.22})`
          : `rgba(154, 96, 88, ${0.18 + rng() * 0.2})`;

    const bumpVal = Math.round(130 + bright * 115);
    const roughVal = Math.round(140 + (1 - bright) * 85);

    const drawStroke = (ctx, strokeStyle, lw) => {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
    };

    drawWrapped(cCtx, size, () => drawStroke(cCtx, colStr, width));
    drawWrapped(bCtx, size, () =>
      drawStroke(bCtx, `rgba(${bumpVal},${bumpVal},${bumpVal},0.42)`, width * 1.1)
    );
    drawWrapped(rCtx, size, () =>
      drawStroke(rCtx, `rgba(${roughVal},${roughVal},${roughVal},0.35)`, width)
    );
  }

  return {
    map: toTexture(colorCanvas, { isColor: true, repeatX: 3, repeatY: 2 }),
    bumpMap: toTexture(bumpCanvas, { repeatX: 3, repeatY: 2 }),
    roughnessMap: toTexture(roughCanvas, { repeatX: 3, repeatY: 2 })
  };
}

/**
 * Layer 2 & 4: Fenestrated Elastic Lamina (External & Internal)
 * Golden-cream elastic membrane with microscopic rounded fenestrations and wave ridges.
 */
function generateElasticLaminaTextures(isInternal = false) {
  const size = 512;
  const rng = createPRNG(isInternal ? 44917 : 22813);
  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);

  const cCtx = colorCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  cCtx.fillStyle = isInternal ? '#f0de9a' : '#e4ca82';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#a8a8a8';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#929292';
  rCtx.fillRect(0, 0, size, size);

  // Fine wavy elastin longitudinal corrugations (stronger on Internal Elastic Lamina)
  const ridgeCount = isInternal ? 32 : 20;
  for (let i = 0; i < ridgeCount; i++) {
    const y = (i / ridgeCount) * size;
    const h = size / ridgeCount;
    const gradC = cCtx.createLinearGradient(0, y, 0, y + h);
    gradC.addColorStop(0, 'rgba(255, 248, 214, 0.24)');
    gradC.addColorStop(0.5, 'rgba(196, 160, 78, 0.18)');
    gradC.addColorStop(1, 'rgba(255, 248, 214, 0.24)');
    cCtx.fillStyle = gradC;
    cCtx.fillRect(0, y, size, h);

    const gradB = bCtx.createLinearGradient(0, y, 0, y + h);
    gradB.addColorStop(0, isInternal ? 'rgba(245,245,245,0.62)' : 'rgba(215,215,215,0.35)');
    gradB.addColorStop(0.5, isInternal ? 'rgba(65,65,65,0.58)' : 'rgba(105,105,105,0.32)');
    gradB.addColorStop(1, isInternal ? 'rgba(245,245,245,0.62)' : 'rgba(215,215,215,0.35)');
    bCtx.fillStyle = gradB;
    bCtx.fillRect(0, y, size, h);
  }

  // Fine elastic fiber strands
  for (let i = 0; i < 240; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 35 + rng() * 90;
    const ang = (rng() - 0.5) * 0.45;
    drawWrapped(cCtx, size, () => {
      cCtx.strokeStyle = `rgba(255, 247, 210, ${0.14 + rng() * 0.2})`;
      cCtx.lineWidth = 0.8 + rng() * 1.4;
      cCtx.beginPath();
      cCtx.moveTo(x, y);
      cCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      cCtx.stroke();
    });
  }

  // Fenestrations (recessed oval pores characteristic of arterial elastic laminae)
  const poreCount = isInternal ? 160 : 210;
  for (let i = 0; i < poreCount; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = 3.2 + rng() * 5.8;
    const ry = 2.0 + rng() * 3.6;
    const rot = (rng() - 0.5) * 0.4;

    drawWrapped(cCtx, size, () => {
      cCtx.save();
      cCtx.translate(x, y);
      cCtx.rotate(rot);
      cCtx.fillStyle = isInternal ? 'rgba(138, 98, 42, 0.46)' : 'rgba(128, 86, 46, 0.52)';
      cCtx.beginPath();
      cCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.strokeStyle = 'rgba(255, 246, 206, 0.48)';
      cCtx.lineWidth = 1.0;
      cCtx.stroke();
      cCtx.restore();
    });

    drawWrapped(bCtx, size, () => {
      bCtx.save();
      bCtx.translate(x, y);
      bCtx.rotate(rot);
      bCtx.fillStyle = 'rgba(25, 25, 25, 0.82)';
      bCtx.beginPath();
      bCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.restore();
    });

    drawWrapped(rCtx, size, () => {
      rCtx.save();
      rCtx.translate(x, y);
      rCtx.rotate(rot);
      rCtx.fillStyle = 'rgba(210, 210, 210, 0.75)';
      rCtx.beginPath();
      rCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      rCtx.fill();
      rCtx.restore();
    });
  }

  return {
    map: toTexture(colorCanvas, { isColor: true, repeatX: 3, repeatY: 2 }),
    bumpMap: toTexture(bumpCanvas, { repeatX: 3, repeatY: 2 }),
    roughnessMap: toTexture(roughCanvas, { repeatX: 3, repeatY: 2 })
  };
}

/**
 * Layer 3: Tunica Media — dense circular smooth muscle fascicles & elastic lamellae
 * U runs axially along the vessel, V runs circumferentially — so circular smooth muscle
 * fibers run predominantly vertically (along V) with gentle helical weave.
 */
function generateMediaTextures() {
  const size = 512;
  const rng = createPRNG(31337);
  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);

  const cCtx = colorCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  cCtx.fillStyle = '#a8313b';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#868686';
  rCtx.fillRect(0, 0, size, size);

  // Circumferential smooth muscle fascicle bands (running along V)
  const bandCount = 56;
  for (let i = 0; i < bandCount; i++) {
    const x = (i / bandCount) * size;
    const w = size / bandCount;
    const shade = 0.85 + rng() * 0.3;
    const r = Math.min(255, Math.round(182 * shade));
    const g = Math.min(255, Math.round(52 * shade));
    const b = Math.min(255, Math.round(62 * shade));

    const gradC = cCtx.createLinearGradient(x, 0, x + w, 0);
    gradC.addColorStop(0, `rgba(${Math.round(r * 0.72)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.75)}, 0.55)`);
    gradC.addColorStop(0.5, `rgba(${r}, ${g + 12}, ${b + 12}, 0.65)`);
    gradC.addColorStop(1, `rgba(${Math.round(r * 0.72)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.75)}, 0.55)`);
    cCtx.fillStyle = gradC;
    cCtx.fillRect(x, 0, w + 1, size);

    const gradB = bCtx.createLinearGradient(x, 0, x + w, 0);
    gradB.addColorStop(0, 'rgba(45,45,45,0.65)');
    gradB.addColorStop(0.5, 'rgba(235,235,235,0.65)');
    gradB.addColorStop(1, 'rgba(45,45,45,0.65)');
    bCtx.fillStyle = gradB;
    bCtx.fillRect(x, 0, w + 1, size);
  }

  // Spindle-shaped smooth muscle cells & pale elastin interlacing fibers
  for (let i = 0; i < 480; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 36 + rng() * 95;
    const tilt = (rng() - 0.5) * 0.24;
    const isElastin = rng() < 0.14;
    const lw = isElastin ? 0.9 + rng() * 1.0 : 1.4 + rng() * 2.4;

    const col = isElastin
      ? `rgba(244, 214, 158, ${0.22 + rng() * 0.22})`
      : rng() > 0.5
        ? `rgba(218, 86, 94, ${0.24 + rng() * 0.25})`
        : `rgba(122, 24, 34, ${0.26 + rng() * 0.26})`;

    const x1 = x + Math.sin(tilt) * len;
    const y1 = y + Math.cos(tilt) * len;

    drawWrapped(cCtx, size, () => {
      cCtx.strokeStyle = col;
      cCtx.lineWidth = lw;
      cCtx.lineCap = 'round';
      cCtx.beginPath();
      cCtx.moveTo(x, y);
      cCtx.lineTo(x1, y1);
      cCtx.stroke();
    });

    const bv = isElastin ? 225 : rng() > 0.5 ? 190 : 75;
    drawWrapped(bCtx, size, () => {
      bCtx.strokeStyle = `rgba(${bv},${bv},${bv},0.32)`;
      bCtx.lineWidth = lw;
      bCtx.beginPath();
      bCtx.moveTo(x, y);
      bCtx.lineTo(x1, y1);
      bCtx.stroke();
    });
  }

  // Subtle moist specular roughness variations
  for (let i = 0; i < 90; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 18 + rng() * 44;
    const rv = Math.round(65 + rng() * 95);
    const grad = rCtx.createRadialGradient(x, y, 2, x, y, rad);
    grad.addColorStop(0, `rgba(${rv},${rv},${rv},0.35)`);
    grad.addColorStop(1, 'rgba(134,134,134,0)');
    drawWrapped(rCtx, size, () => {
      rCtx.fillStyle = grad;
      rCtx.beginPath();
      rCtx.arc(x, y, rad, 0, Math.PI * 2);
      rCtx.fill();
    });
  }

  return {
    map: toTexture(colorCanvas, { isColor: true, repeatX: 3, repeatY: 2 }),
    bumpMap: toTexture(bumpCanvas, { repeatX: 3, repeatY: 2 }),
    roughnessMap: toTexture(roughCanvas, { repeatX: 3, repeatY: 2 })
  };
}

/**
 * Layer 5: Tunica Intima / Endothelium — glistening flow-aligned cobblestone cellular mosaic
 */
function generateEndotheliumTextures() {
  const size = 512;
  const rng = createPRNG(55109);
  const colorCanvas = makeCanvas(size, size);
  const bumpCanvas = makeCanvas(size, size);
  const roughCanvas = makeCanvas(size, size);

  const cCtx = colorCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');

  // Generate jittered grid of cellular nuclei (elongated along X / flow direction)
  const cols = 12;
  const rows = 18;
  const pts = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = ((c + (r % 2 === 0 ? 0.25 : 0.75) + (rng() - 0.5) * 0.42) / cols) * size;
      const py = ((r + 0.5 + (rng() - 0.5) * 0.42) / rows) * size;
      pts.push({
        x: ((px % size) + size) % size,
        y: ((py % size) + size) % size,
        tint: (rng() - 0.5) * 18
      });
    }
  }

  // Pixel-exact tileable Voronoi cobblestone computation (fast at 256 -> upscaled smoothly to 512)
  const workSize = 256;
  const scale = workSize / size;
  const wColor = makeCanvas(workSize, workSize);
  const wBump = makeCanvas(workSize, workSize);
  const wRough = makeCanvas(workSize, workSize);

  const wcCtx = wColor.getContext('2d');
  const wbCtx = wBump.getContext('2d');
  const wrCtx = wRough.getContext('2d');

  const cImg = wcCtx.createImageData(workSize, workSize);
  const bImg = wbCtx.createImageData(workSize, workSize);
  const rImg = wrCtx.createImageData(workSize, workSize);

  const scaledPts = pts.map((p) => ({ x: p.x * scale, y: p.y * scale, tint: p.tint }));
  const halfW = workSize * 0.5;

  for (let y = 0; y < workSize; y++) {
    for (let x = 0; x < workSize; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      let bestTint = 0;

      for (let i = 0; i < scaledPts.length; i++) {
        const p = scaledPts[i];
        let dx = Math.abs(x - p.x);
        if (dx > halfW) dx = workSize - dx;
        let dy = Math.abs(y - p.y);
        if (dy > halfW) dy = workSize - dy;

        // Anisotropic stretch along X so endothelial cells align with blood flow
        const dist = Math.sqrt((dx * 0.72) ** 2 + (dy * 1.18) ** 2);
        if (dist < d1) {
          d2 = d1;
          d1 = dist;
          bestTint = p.tint;
        } else if (dist < d2) {
          d2 = dist;
        }
      }

      const border = Math.min(1, (d2 - d1) / 3.4); // 0 at cell junction, 1 in cell interior
      const dome = Math.pow(border, 0.55) * Math.max(0.25, 1.0 - d1 / 16.0);
      const idx = (y * workSize + x) * 4;

      // Glistening rose-pink endothelial hue with slightly darker tight junctions
      const junctionShade = 0.78 + 0.22 * border;
      cImg.data[idx] = Math.min(255, Math.max(0, Math.round((226 + bestTint) * junctionShade)));
      cImg.data[idx + 1] = Math.min(255, Math.max(0, Math.round((112 + bestTint * 0.6) * junctionShade)));
      cImg.data[idx + 2] = Math.min(255, Math.max(0, Math.round((126 + bestTint * 0.5) * junctionShade)));
      cImg.data[idx + 3] = 255;

      const bVal = Math.min(255, Math.max(0, Math.round(35 + dome * 215)));
      bImg.data[idx] = bVal;
      bImg.data[idx + 1] = bVal;
      bImg.data[idx + 2] = bVal;
      bImg.data[idx + 3] = 255;

      // Very smooth glossy interior, slightly rougher junctions
      const rVal = Math.min(255, Math.max(0, Math.round(92 - border * 52)));
      rImg.data[idx] = rVal;
      rImg.data[idx + 1] = rVal;
      rImg.data[idx + 2] = rVal;
      rImg.data[idx + 3] = 255;
    }
  }

  wcCtx.putImageData(cImg, 0, 0);
  wbCtx.putImageData(bImg, 0, 0);
  wrCtx.putImageData(rImg, 0, 0);

  cCtx.drawImage(wColor, 0, 0, size, size);
  bCtx.drawImage(wBump, 0, 0, size, size);
  rCtx.drawImage(wRough, 0, 0, size, size);

  return {
    map: toTexture(colorCanvas, { isColor: true, repeatX: 4, repeatY: 2 }),
    bumpMap: toTexture(bumpCanvas, { repeatX: 4, repeatY: 2 }),
    roughnessMap: toTexture(roughCanvas, { repeatX: 4, repeatY: 2 })
  };
}

/**
 * Pathology: Atherosclerotic Plaque — yellow-amber necrotic lipid core + fibrous cap
 */
function generatePlaqueTextures() {
  const size = 512;
  const rng = createPRNG(88241);

  // Lipid Core (cutaway cross-section & bulging sub-endothelial mass)
  const coreColor = makeCanvas(size, size);
  const coreBump = makeCanvas(size, size);
  const ccCtx = coreColor.getContext('2d');
  const cbCtx = coreBump.getContext('2d');

  ccCtx.fillStyle = '#dfa01d';
  ccCtx.fillRect(0, 0, size, size);
  cbCtx.fillStyle = '#7a7a7a';
  cbCtx.fillRect(0, 0, size, size);

  // Foamy yellow-amber lipid globules & macrophage clusters
  for (let i = 0; i < 360; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rad = 5 + rng() * 24;
    const pick = rng();
    const fill =
      pick > 0.68
        ? `rgba(255, 224, 118, ${0.28 + rng() * 0.34})`
        : pick > 0.25
          ? `rgba(218, 138, 16, ${0.26 + rng() * 0.32})`
          : `rgba(176, 94, 14, ${0.24 + rng() * 0.28})`;

    drawWrapped(ccCtx, size, () => {
      const grad = ccCtx.createRadialGradient(x - rad * 0.2, y - rad * 0.2, 1, x, y, rad);
      grad.addColorStop(0, fill);
      grad.addColorStop(1, 'rgba(223, 160, 29, 0)');
      ccCtx.fillStyle = grad;
      ccCtx.beginPath();
      ccCtx.arc(x, y, rad, 0, Math.PI * 2);
      ccCtx.fill();
    });

    const bv = pick > 0.5 ? 215 : 55;
    drawWrapped(cbCtx, size, () => {
      const grad = cbCtx.createRadialGradient(x, y, 1, x, y, rad);
      grad.addColorStop(0, `rgba(${bv},${bv},${bv},0.55)`);
      grad.addColorStop(1, 'rgba(122,122,122,0)');
      cbCtx.fillStyle = grad;
      cbCtx.beginPath();
      cbCtx.arc(x, y, rad, 0, Math.PI * 2);
      cbCtx.fill();
    });
  }

  // Fine cholesterol needle clefts & micro-calcification flecks
  for (let i = 0; i < 120; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const ang = rng() * Math.PI * 2;
    const len = 8 + rng() * 22;
    drawWrapped(ccCtx, size, () => {
      ccCtx.strokeStyle = 'rgba(255, 246, 204, 0.48)';
      ccCtx.lineWidth = 1.2;
      ccCtx.beginPath();
      ccCtx.moveTo(x, y);
      ccCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ccCtx.stroke();
    });
  }

  // Fibrous Cap texture (translucent pale amber-ivory collagenous cap)
  const capColor = makeCanvas(size, size);
  const capBump = makeCanvas(size, size);
  const fcCtx = capColor.getContext('2d');
  const fbCtx = capBump.getContext('2d');

  fcCtx.fillStyle = '#e7cf96';
  fcCtx.fillRect(0, 0, size, size);
  fbCtx.fillStyle = '#888888';
  fbCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 240; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 45 + rng() * 110;
    const ang = (rng() - 0.5) * 0.65;
    drawWrapped(fcCtx, size, () => {
      fcCtx.strokeStyle =
        rng() > 0.45 ? 'rgba(255, 248, 224, 0.25)' : 'rgba(202, 162, 86, 0.22)';
      fcCtx.lineWidth = 1.5 + rng() * 2.6;
      fcCtx.beginPath();
      fcCtx.moveTo(x, y);
      fcCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      fcCtx.stroke();
    });
    drawWrapped(fbCtx, size, () => {
      fbCtx.strokeStyle = rng() > 0.5 ? 'rgba(220,220,220,0.34)' : 'rgba(65,65,65,0.3)';
      fbCtx.lineWidth = 2.0;
      fbCtx.beginPath();
      fbCtx.moveTo(x, y);
      fbCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      fbCtx.stroke();
    });
  }

  return {
    coreMap: toTexture(coreColor, { isColor: true, repeatX: 2, repeatY: 2 }),
    coreBumpMap: toTexture(coreBump, { repeatX: 2, repeatY: 2 }),
    capMap: toTexture(capColor, { isColor: true, repeatX: 2, repeatY: 2 }),
    capBumpMap: toTexture(capBump, { repeatX: 2, repeatY: 2 })
  };
}

/**
 * Generates a soft clinical studio PMREM environment texture for realistic
 * wet clearcoat specular highlights and biomedical subsurface sheen.
 */
export function createClinicalEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#0a1120');

  // Overhead clinical softbox strip
  const topBox = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 9),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 2.95) })
  );
  topBox.position.set(0, 12, 2);
  topBox.rotation.x = Math.PI / 2;
  envScene.add(topBox);

  // Front-left cool key softbox
  const keyBox = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 2.2, 2.6) })
  );
  keyBox.position.set(-12, 6, 11);
  keyBox.lookAt(0, 0, 0);
  envScene.add(keyBox);

  // Rear-right warm rim light strip to pick out cutaway edges & red blood cells
  const rimBox = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 1.85, 1.55) })
  );
  rimBox.position.set(11, 4, -11);
  rimBox.lookAt(0, 0, 0);
  envScene.add(rimBox);

  // Subtle cyan-slate lower bounce reflector for dark medical elegance
  const lowerBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 0.44, 0.65) })
  );
  lowerBounce.position.set(0, -11, 0);
  lowerBounce.rotation.x = -Math.PI / 2;
  envScene.add(lowerBounce);

  const renderTarget = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  return renderTarget.texture;
}

/**
 * Synthesizes and returns the complete procedural PBR texture library.
 */
export function createProceduralTextureLibrary() {
  return {
    adventitia: generateAdventitiaTextures(),
    externalLamina: generateElasticLaminaTextures(false),
    media: generateMediaTextures(),
    internalLamina: generateElasticLaminaTextures(true),
    intima: generateEndotheliumTextures(),
    plaque: generatePlaqueTextures()
  };
}
