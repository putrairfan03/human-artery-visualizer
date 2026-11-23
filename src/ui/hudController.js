import * as THREE from 'three';
import {
  ALL_ANATOMY_ITEMS,
  ANATOMY_BY_ID,
  computeHemodynamics,
  getAnatomyPinAnchor,
  sampleArterialPulse
} from '../config/anatomyData.js';

/**
 * Glassmorphic HUD Controller, Interactive 3D Projected Layer Pins,
 * Live Arterial Pressure Waveform Sparkline, Telemetry Readouts & Detail Drawer.
 */
export function createHudController(callbacks) {
  const els = {
    pinsLayer: document.getElementById('pins-layer'),
    btnTogglePins: document.getElementById('btn-toggle-pins'),
    pulseDot: document.querySelector('.pulse-dot'),
    pulseCanvas: document.getElementById('pulse-canvas'),
    hrButtons: Array.from(document.querySelectorAll('[data-hr]')),

    valVelocity: document.getElementById('val-velocity'),
    valLumen: document.getElementById('val-lumen'),
    valShear: document.getElementById('val-shear'),
    valRegime: document.getElementById('val-regime'),
    heatmapLegend: document.getElementById('heatmap-legend'),

    rightDrawer: document.getElementById('right-drawer'),
    btnCollapseRight: document.getElementById('btn-collapse-right'),
    layerLegendList: document.getElementById('layer-legend-list'),

    detailSwatch: document.getElementById('detail-swatch'),
    detailTag: document.getElementById('detail-tag'),
    detailName: document.getElementById('detail-name'),
    btnCloseDetail: document.getElementById('btn-close-detail'),
    detailThickness: document.getElementById('detail-thickness'),
    detailTissueShort: document.getElementById('detail-tissue-short'),
    detailComposition: document.getElementById('detail-composition'),
    detailFunction: document.getElementById('detail-function'),
    detailClinicalWrap: document.getElementById('detail-clinical-wrap'),
    detailClinical: document.getElementById('detail-clinical'),

    bottomBar: document.getElementById('bottom-bar'),
    btnCollapseBottom: document.getElementById('btn-collapse-bottom'),
    sliderPeel: document.getElementById('slider-peel'),
    labelPeel: document.getElementById('label-peel'),
    sliderStenosis: document.getElementById('slider-stenosis'),
    labelStenosis: document.getElementById('label-stenosis'),
    presetButtons: Array.from(document.querySelectorAll('.preset-btn[data-stenosis]')),
    modeButtons: Array.from(document.querySelectorAll('.mode-btn[data-mode]')),
    camButtons: Array.from(document.querySelectorAll('.cam-btn[data-cam]')),
    loadingOverlay: document.getElementById('loading-overlay')
  };

  // Build Right Drawer Layer Legend items
  const legendButtons = new Map();
  els.layerLegendList.innerHTML = '';
  for (const item of ALL_ANATOMY_ITEMS) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'layer-item-btn';
    btn.dataset.anatomyId = item.id;
    btn.innerHTML = `
      <span class="layer-swatch" style="background:${item.swatch}"></span>
      <span class="layer-item-name">${item.shortName}</span>
      <span class="layer-item-badge">${item.shortNum}</span>
    `;
    btn.addEventListener('click', () => callbacks.onSelectAnatomy(item.id));
    li.appendChild(btn);
    els.layerLegendList.appendChild(li);
    legendButtons.set(item.id, btn);
  }

  // Build 7 Interactive 3D Projected Callout Pins
  const pinElements = new Map();
  els.pinsLayer.innerHTML = '';
  for (const item of ALL_ANATOMY_ITEMS) {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'pin-marker';
    pin.dataset.anatomyId = item.id;
    pin.style.setProperty('--pin-color', item.swatch);
    pin.style.setProperty('--pin-glow', `${item.swatch}88`);
    pin.style.background = 'none';
    pin.style.border = 'none';
    pin.setAttribute('aria-label', `Focus ${item.name}`);
    pin.innerHTML = `
      <span class="pin-dot">${item.shortNum}</span>
      <span class="pin-label">${item.shortName}</span>
    `;
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      callbacks.onSelectAnatomy(item.id);
    });
    els.pinsLayer.appendChild(pin);
    pinElements.set(item.id, pin);
  }

  // Wire Bottom Bar Sliders & Buttons
  els.sliderPeel.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    els.labelPeel.textContent = `${val}%`;
    callbacks.onPeelChange(val);
  });

  els.sliderStenosis.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    syncStenosisUI(val);
    callbacks.onStenosisChange(val);
  });

  for (const btn of els.presetButtons) {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.stenosis);
      syncStenosisUI(val);
      callbacks.onStenosisChange(val);
    });
  }

  for (const btn of els.modeButtons) {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      syncModeUI(mode);
      callbacks.onViewModeChange(mode);
    });
  }

  for (const btn of els.camButtons) {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.cam;
      syncCameraUI(preset);
      callbacks.onCameraPreset(preset);
    });
  }

  for (const btn of els.hrButtons) {
    btn.addEventListener('click', () => {
      const hr = btn.dataset.hr;
      syncHeartRateUI(hr);
      callbacks.onHeartRateChange(hr);
    });
  }

  // Pins Visibility Toggle
  let pinsVisible = true;
  els.btnTogglePins.addEventListener('click', () => {
    pinsVisible = !pinsVisible;
    els.btnTogglePins.classList.toggle('active', pinsVisible);
    els.btnTogglePins.setAttribute('aria-pressed', String(pinsVisible));
    els.pinsLayer.classList.toggle('hidden', !pinsVisible);
  });

  // Collapsible Right Drawer
  els.btnCollapseRight.addEventListener('click', () => {
    const collapsed = els.rightDrawer.classList.toggle('collapsed');
    els.btnCollapseRight.setAttribute('aria-expanded', String(!collapsed));
  });

  // Collapsible Bottom Control Bar
  els.btnCollapseBottom.addEventListener('click', () => {
    const collapsed = els.bottomBar.classList.toggle('collapsed');
    els.btnCollapseBottom.setAttribute('aria-expanded', String(!collapsed));
  });

  // Close / Reset Focus Button on Detail Card
  els.btnCloseDetail.addEventListener('click', () => {
    callbacks.onResetFocus();
  });

  function syncStenosisUI(val) {
    els.sliderStenosis.value = String(val);
    els.labelStenosis.textContent = `${val}%`;
    for (const btn of els.presetButtons) {
      btn.classList.toggle('active', Number(btn.dataset.stenosis) === val);
    }
  }

  function syncModeUI(mode) {
    for (const btn of els.modeButtons) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    }
    els.heatmapLegend.classList.toggle('hidden', mode !== 'heatmap');
  }

  function syncCameraUI(presetKey) {
    for (const btn of els.camButtons) {
      btn.classList.toggle('active', btn.dataset.cam === presetKey);
    }
  }

  function syncHeartRateUI(hrMode) {
    for (const btn of els.hrButtons) {
      btn.classList.toggle('active', btn.dataset.hr === hrMode);
    }
  }

  function buildClinicalContext(id, stenosisPct, heartRateMode) {
    const hemo = computeHemodynamics(stenosisPct, heartRateMode, 0.7);
    if (id === 'plaque') {
      if (stenosisPct === 0) {
        return 'Healthy vessel (0% narrowing): No intimal lipid deposition present. Adjust the Stenosis slider to inspect plaque progression.';
      }
      const grade =
        stenosisPct >= 65
          ? 'Severe hemodynamically significant stenosis'
          : stenosisPct >= 45
            ? 'Moderate stenosis with elevated throat shear'
            : 'Mild sub-endothelial atheroma';
      return `${grade}: ${stenosisPct}% diameter reduction (${hemo.areaReductionPct}% cross-sectional area loss), accelerating peak jet velocity to ~${Math.round(hemo.peakVelocityCmS)} cm/s.`;
    }
    if (id === 'lumen') {
      return `${hemo.regime} regime (Re ≈ ${hemo.reynolds}) at ${hemo.bpm} BPM. Effective throat lumen is ${hemo.lumenDiameterPct}% with peak wall shear stress reaching ${hemo.wssPa.toFixed(1)} Pa.`;
    }
    if (id === 'media') {
      return `Active rhythmic distension synced to ${hemo.bpm} BPM (${heartRateMode === 'exercise' ? 'elevated exercise pulse pressure' : 'resting baseline tone'}).`;
    }
    if (id === 'intima') {
      return `Exposed directly to ${hemo.wssPa.toFixed(1)} Pa peak wall shear stress. Abnormal oscillatory low shear downstream of plaque promotes endothelial dysfunction.`;
    }
    return `Healthy structural integrity maintained at ${hemo.bpm} BPM; outer wall tension adapts smoothly to systolic pulsation.`;
  }

  function updateDetailCard(id, stenosisPct, heartRateMode, expandDrawer = false) {
    const item = ANATOMY_BY_ID[id] || ANATOMY_BY_ID.media;

    els.detailSwatch.style.background = item.swatch;
    els.detailTag.textContent = item.tag;
    els.detailName.textContent = item.name;
    els.detailThickness.textContent =
      id === 'plaque'
        ? stenosisPct === 0
          ? '0% (Absent)'
          : `${stenosisPct}% Narrowing`
        : id === 'lumen'
          ? `${100 - stenosisPct}% Open Diam.`
          : item.thicknessPct;
    els.detailTissueShort.textContent = item.primaryTissue;
    els.detailComposition.textContent = item.composition;
    els.detailFunction.textContent = item.function;
    els.detailClinical.textContent = buildClinicalContext(id, stenosisPct, heartRateMode);

    for (const [key, btn] of legendButtons.entries()) {
      btn.classList.toggle('active', key === id);
    }
    for (const [key, pin] of pinElements.entries()) {
      pin.classList.toggle('active', key === id);
    }

    if (expandDrawer && els.rightDrawer.classList.contains('collapsed')) {
      els.rightDrawer.classList.remove('collapsed');
      els.btnCollapseRight.setAttribute('aria-expanded', 'true');
    }
  }

  // Live Arterial Pressure Waveform Sparkline Canvas
  const pulseCtx = els.pulseCanvas ? els.pulseCanvas.getContext('2d') : null;
  let lastTelemetryUpdate = 0;

  function drawPulseWaveform(heartPhase, heartRateMode, pulseVal) {
    if (els.pulseDot) {
      const s = 0.88 + pulseVal * 0.42;
      els.pulseDot.style.transform = `scale(${s.toFixed(3)})`;
    }
    if (!pulseCtx) return;

    const w = els.pulseCanvas.width;
    const h = els.pulseCanvas.height;
    pulseCtx.clearRect(0, 0, w, h);

    // Subtle baseline grid
    pulseCtx.strokeStyle = 'rgba(148, 188, 240, 0.14)';
    pulseCtx.lineWidth = 1;
    pulseCtx.beginPath();
    pulseCtx.moveTo(0, h - 5);
    pulseCtx.lineTo(w, h - 5);
    pulseCtx.stroke();

    // Draw scrolling arterial pressure curve (2 cycles at exercise, 1.4 at resting)
    const cycles = heartRateMode === 'exercise' ? 2.1 : 1.35;
    const accent = heartRateMode === 'exercise' ? '#fb7185' : '#38bdf8';

    pulseCtx.strokeStyle = accent;
    pulseCtx.lineWidth = 1.65;
    pulseCtx.beginPath();
    let lastY = h - 5;
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const samplePhase = heartPhase - (1 - t) * cycles;
      const val = sampleArterialPulse(samplePhase);
      const y = h - 5 - val * (h - 9);
      if (x === 0) pulseCtx.moveTo(x, y);
      else pulseCtx.lineTo(x, y);
      lastY = y;
    }
    pulseCtx.stroke();

    // Glowing live lead point on right edge
    pulseCtx.fillStyle = '#ffffff';
    pulseCtx.beginPath();
    pulseCtx.arc(w - 2.5, lastY, 2.2, 0, Math.PI * 2);
    pulseCtx.fill();
  }

  function updateTelemetry(time, stenosisPct, heartRateMode, heartPhase, pulseVal, selectedId) {
    drawPulseWaveform(heartPhase, heartRateMode, pulseVal);

    // Throttle numeric DOM text updates to ~10 Hz for crisp readability & zero layout thrash
    if (time - lastTelemetryUpdate < 0.1) return;
    lastTelemetryUpdate = time;

    const hemo = computeHemodynamics(stenosisPct, heartRateMode, pulseVal);
    els.valVelocity.textContent = String(Math.round(hemo.liveVelocityCmS));
    els.valLumen.textContent = String(hemo.lumenDiameterPct);
    els.valShear.textContent = hemo.wssPa.toFixed(1);

    els.valRegime.textContent = hemo.regime;
    els.valRegime.className = `regime-badge ${hemo.regimeClass}`;

    // Keep clinical note live if plaque/lumen/intima is selected
    if (selectedId) {
      els.detailClinical.textContent = buildClinicalContext(selectedId, stenosisPct, heartRateMode);
    }
  }

  // Reusable projection vector for 3D pins
  const projVec = new THREE.Vector3();
  const hudTopLeftEl = document.querySelector('.hud-top-left-stack');

  function isBehindPanel(sx, sy, rect) {
    if (!rect || rect.width < 10 || rect.height < 10) return false;
    const pad = 8;
    return (
      sx >= rect.left - pad &&
      sx <= rect.right + pad &&
      sy >= rect.top - pad &&
      sy <= rect.bottom + pad
    );
  }

  function updatePins(camera, peelPct, stenosisPct, radialScale) {
    if (!pinsVisible) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const topLeftRect = hudTopLeftEl ? hudTopLeftEl.getBoundingClientRect() : null;
    const rightRect = !els.rightDrawer.classList.contains('collapsed')
      ? els.rightDrawer.getBoundingClientRect()
      : null;
    const bottomRect = !els.bottomBar.classList.contains('collapsed')
      ? els.bottomBar.getBoundingClientRect()
      : null;

    const visibleItems = [];

    for (const item of ALL_ANATOMY_ITEMS) {
      const pinEl = pinElements.get(item.id);
      const { anchor } = getAnatomyPinAnchor(item.id, peelPct, stenosisPct);
      projVec.set(anchor[0], anchor[1] * radialScale, anchor[2] * radialScale);
      projVec.project(camera);

      const inFront = projVec.z >= -1 && projVec.z <= 1;
      const sx = (projVec.x * 0.5 + 0.5) * vw;
      const sy = (-projVec.y * 0.5 + 0.5) * vh;

      const onScreen = inFront && sx > 28 && sx < vw - 28 && sy > 28 && sy < vh - 28;
      const occludedByHud =
        isBehindPanel(sx, sy, topLeftRect) ||
        isBehindPanel(sx + 65, sy, rightRect) ||
        isBehindPanel(sx, sy, bottomRect);

      if (!onScreen || occludedByHud) {
        pinEl.style.opacity = '0';
        pinEl.style.pointerEvents = 'none';
        continue;
      }

      const dimmed = item.id === 'plaque' && stenosisPct < 3;
      pinEl.classList.toggle('dimmed', dimmed);
      pinEl.style.pointerEvents = 'auto';
      pinEl.style.opacity = dimmed ? '0.32' : '1';

      visibleItems.push({ el: pinEl, x: sx, y: sy, z: projVec.z });
    }

    // Gentle screen-space vertical separation so pin pills never stack on top of each other
    visibleItems.sort((a, b) => a.y - b.y);
    const minDy = 26;
    const closeDx = 128;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < visibleItems.length; i++) {
        const prev = visibleItems[i - 1];
        const curr = visibleItems[i];
        if (Math.abs(curr.x - prev.x) < closeDx) {
          const dy = curr.y - prev.y;
          if (dy < minDy) {
            const push = (minDy - dy) * 0.52;
            prev.y -= push;
            curr.y += push;
          }
        }
      }
    }

    for (const p of visibleItems) {
      p.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-12px, -50%)`;
      p.el.style.zIndex = String(Math.round((1 - p.z) * 100));
    }
  }

  function hideLoader() {
    if (!els.loadingOverlay) return;
    els.loadingOverlay.classList.add('fade-out');
    setTimeout(() => {
      if (els.loadingOverlay) els.loadingOverlay.style.display = 'none';
    }, 450);
  }

  return {
    syncStenosisUI,
    syncModeUI,
    syncCameraUI,
    syncHeartRateUI,
    updateDetailCard,
    updateTelemetry,
    updatePins,
    hideLoader
  };
}
