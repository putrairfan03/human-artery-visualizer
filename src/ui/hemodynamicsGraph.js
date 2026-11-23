import { ARTERY_DIMENSIONS, computeAxialHemodynamicProfile } from '../config/anatomyData.js';

/**
 * Live HTML5 Canvas 2D Engineering & Mathematical Telemetry Graph
 * Dynamically plots:
 *   (a) Axial Blood Velocity v(x) [cm/s] — Continuity / Venturi acceleration spike
 *   (b) Cumulative Pressure Drop ΔP(x) [mmHg] — Bernoulli + Hagen-Poiseuille + Borda-Carnot loss
 */
export function createHemodynamicsGraph(canvasEl) {
  if (!canvasEl) {
    return {
      update() {}
    };
  }

  const ctx = canvasEl.getContext('2d');
  let smoothedMaxVel = 120;
  let smoothedMaxDp = 15;
  let lastDrawTime = 0;

  function ensureResolution() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvasEl.clientWidth || 246;
    const cssH = canvasEl.clientHeight || 152;
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvasEl.width !== targetW || canvasEl.height !== targetH) {
      canvasEl.width = targetW;
      canvasEl.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: cssW, h: cssH };
  }

  function update(time, stenosisPct, heartRateMode, pulseVal, stateOpts = {}) {
    // Only draw when canvas is visible (e.g., Physics tab active or visible in layout)
    if (canvasEl.offsetParent === null) return null;
    if (time - lastDrawTime < 0.045) return null; // ~22 Hz silky live chart without excess 2D work
    lastDrawTime = time;

    const { w, h } = ensureResolution();
    const profile = computeAxialHemodynamicProfile(
      stenosisPct,
      heartRateMode,
      pulseVal,
      stateOpts,
      64
    );

    // Smooth auto-ranging Y axes for readable curves across Healthy -> Severe 75% -> Occluded
    const targetVelCeil = Math.max(100, Math.ceil((profile.maxVelocity * 1.18) / 50) * 50);
    const targetDpCeil = Math.max(12, Math.ceil((profile.maxPressureDrop * 1.22) / 10) * 10);
    smoothedMaxVel += (targetVelCeil - smoothedMaxVel) * 0.22;
    smoothedMaxDp += (targetDpCeil - smoothedMaxDp) * 0.22;

    const padL = 32;
    const padR = 30;
    const padT = 14;
    const padB = 22;
    const plotW = Math.max(40, w - padL - padR);
    const plotH = Math.max(40, h - padT - padB);

    const { xMin, xMax, plaqueCenterX, plaqueHalfWidth } = ARTERY_DIMENSIONS;
    const mapX = (x) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
    const mapYVel = (v) => padT + plotH - Math.min(1, v / smoothedMaxVel) * plotH;
    const mapYDp = (dp) => padT + plotH - Math.min(1, dp / smoothedMaxDp) * plotH;

    // Clear & dark clinical chart backdrop
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(4, 9, 18, 0.72)';
    ctx.fillRect(0, 0, w, h);

    // Highlight stenotic plaque zone band
    const pLeft = mapX(plaqueCenterX - plaqueHalfWidth * 0.65);
    const pRight = mapX(plaqueCenterX + plaqueHalfWidth * 0.65);
    const throatPx = mapX(plaqueCenterX);
    ctx.fillStyle = profile.isOccluded
      ? 'rgba(244, 63, 94, 0.14)'
      : stateOpts.stentCompression > 0.5
        ? 'rgba(16, 185, 129, 0.1)'
        : 'rgba(245, 158, 11, 0.09)';
    ctx.fillRect(pLeft, padT, pRight - pLeft, plotH);

    // Subtle horizontal gridlines
    ctx.strokeStyle = 'rgba(148, 188, 240, 0.11)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const gy = padT + (i / 3) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + plotW, gy);
      ctx.stroke();
    }

    // Vertical dashed stenosis throat line
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = profile.isOccluded
      ? 'rgba(244, 63, 94, 0.55)'
      : 'rgba(245, 158, 11, 0.48)';
    ctx.beginPath();
    ctx.moveTo(throatPx, padT);
    ctx.lineTo(throatPx, padT + plotH);
    ctx.stroke();
    ctx.restore();

    const { xs, velocityCmS, pressureDropMmHg } = profile;

    // (a) Axial Velocity v(x) shaded area + crisp cyan curve
    const velGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    velGrad.addColorStop(0, 'rgba(56, 189, 248, 0.34)');
    velGrad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');

    ctx.beginPath();
    ctx.moveTo(mapX(xs[0]), padT + plotH);
    for (let i = 0; i < xs.length; i++) {
      ctx.lineTo(mapX(xs[i]), mapYVel(velocityCmS[i]));
    }
    ctx.lineTo(mapX(xs[xs.length - 1]), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = velGrad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const px = mapX(xs[i]);
      const py = mapYVel(velocityCmS[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // (b) Pressure Drop ΔP(x) curve in glowing coral-amber
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const px = mapX(xs[i]);
      const py = mapYDp(pressureDropMmHg[i]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 1.9;
    ctx.stroke();

    // Peak velocity marker dot at throat
    let peakIdx = 0;
    for (let i = 1; i < velocityCmS.length; i++) {
      if (velocityCmS[i] > velocityCmS[peakIdx]) peakIdx = i;
    }
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(mapX(xs[peakIdx]), mapYVel(velocityCmS[peakIdx]), 3.0, 0, Math.PI * 2);
    ctx.fill();

    // Outflow ΔP marker dot
    const lastIdx = xs.length - 1;
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.arc(mapX(xs[lastIdx]), mapYDp(pressureDropMmHg[lastIdx]), 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Axis ticks & labels
    ctx.font = '500 9px "JetBrains Mono", monospace';

    // Left Y-axis (Velocity cm/s in cyan)
    ctx.fillStyle = '#7dd3fc';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(smoothedMaxVel)}`, padL - 4, padT + 6);
    ctx.fillText(`${Math.round(smoothedMaxVel * 0.5)}`, padL - 4, padT + plotH * 0.5 + 3);
    ctx.fillText('0', padL - 4, padT + plotH + 2);

    // Right Y-axis (ΔP mmHg in rose)
    ctx.fillStyle = '#fda4af';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(smoothedMaxDp)}`, padL + plotW + 4, padT + 6);
    ctx.fillText(`${Math.round(smoothedMaxDp * 0.5)}`, padL + plotW + 4, padT + plotH * 0.5 + 3);
    ctx.fillText('0', padL + plotW + 4, padT + plotH + 2);

    // X-axis labels
    ctx.fillStyle = '#7c90ac';
    ctx.textAlign = 'left';
    ctx.fillText('Inflow', padL, h - 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = profile.isOccluded ? '#fda4af' : '#fcd34d';
    ctx.fillText(profile.isOccluded ? 'Clot' : 'Throat', throatPx, h - 6);
    ctx.fillStyle = '#7c90ac';
    ctx.textAlign = 'right';
    ctx.fillText('Outflow', padL + plotW, h - 6);

    // Tiny top-corner axis unit tags
    ctx.font = '600 8.5px "Inter", sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText('v(x) cm/s', padL + 2, 10);
    ctx.fillStyle = '#fb7185';
    ctx.textAlign = 'right';
    ctx.fillText('ΔP(x) mmHg', padL + plotW - 2, 10);

    return profile;
  }

  return { update };
}
