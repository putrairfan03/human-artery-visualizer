import * as THREE from 'three';
import {
  ALL_ANATOMY_ITEMS,
  ANATOMY_BY_ID,
  GUIDED_TOUR_STEPS,
  QUIZ_QUESTIONS,
  computeHemodynamics,
  getAnatomyPinAnchor,
  sampleArterialPulse
} from '../config/anatomyData.js';
import { createHemodynamicsGraph } from './hemodynamicsGraph.js';

/**
 * Glassmorphic HUD Controller:
 * - Interactive 3D Projected Layer Pins
 * - Live Arterial Pressure Waveform Sparkline & Telemetry Readouts
 * - 3-Tab Right Inspector (Anatomy | Poiseuille & Bernoulli Physics | Guided Tour & Quiz)
 * - Clinical Intervention Controls (PCI Stent & Plaque Rupture / Thrombosis)
 */
export function createHudController(callbacks) {
  const els = {
    pinsLayer: document.getElementById('pins-layer'),
    btnTogglePins: document.getElementById('btn-toggle-pins'),
    btnToggleTour: document.getElementById('btn-toggle-tour'),
    pulseDot: document.querySelector('.pulse-dot'),
    pulseCanvas: document.getElementById('pulse-canvas'),
    hrButtons: Array.from(document.querySelectorAll('[data-hr]')),

    valVelocity: document.getElementById('val-velocity'),
    valLumen: document.getElementById('val-lumen'),
    valShear: document.getElementById('val-shear'),
    valRegime: document.getElementById('val-regime'),
    heatmapLegend: document.getElementById('heatmap-legend'),
    statusPill: document.getElementById('clinical-status-pill'),
    statusText: document.getElementById('clinical-status-text'),

    rightDrawer: document.getElementById('right-drawer'),
    btnCollapseRight: document.getElementById('btn-collapse-right'),
    drawerTabButtons: Array.from(document.querySelectorAll('.drawer-tab-btn[data-tab]')),
    tabPanels: {
      anatomy: document.getElementById('tab-anatomy'),
      physics: document.getElementById('tab-physics'),
      education: document.getElementById('tab-education')
    },

    layerLegendList: document.getElementById('layer-legend-list'),
    detailSwatch: document.getElementById('detail-swatch'),
    detailTag: document.getElementById('detail-tag'),
    detailName: document.getElementById('detail-name'),
    btnCloseDetail: document.getElementById('btn-close-detail'),
    detailThickness: document.getElementById('detail-thickness'),
    detailTissueShort: document.getElementById('detail-tissue-short'),
    detailComposition: document.getElementById('detail-composition'),
    detailFunction: document.getElementById('detail-function'),
    detailClinical: document.getElementById('detail-clinical'),

    // Physics Tab
    hemoGraphCanvas: document.getElementById('hemo-graph-canvas'),
    physPeakVel: document.getElementById('phys-peak-vel'),
    physDeltaP: document.getElementById('phys-delta-p'),
    physResistance: document.getElementById('phys-resistance'),
    physReynolds: document.getElementById('phys-reynolds'),
    physNote: document.getElementById('phys-note'),

    // Education Tab: Guided Tour & Quick Quiz
    subtabButtons: Array.from(document.querySelectorAll('.subtab-btn[data-subtab]')),
    subtabTour: document.getElementById('subtab-tour'),
    subtabQuiz: document.getElementById('subtab-quiz'),
    tourStepCounter: document.getElementById('tour-step-counter'),
    tourDots: document.getElementById('tour-dots'),
    tourStepBadge: document.getElementById('tour-step-badge'),
    tourStepTitle: document.getElementById('tour-step-title'),
    tourStepSummary: document.getElementById('tour-step-summary'),
    tourStepActions: document.getElementById('tour-step-actions'),
    btnTourStent: document.getElementById('btn-tour-stent'),
    btnTourRupture: document.getElementById('btn-tour-rupture'),
    btnTourPrev: document.getElementById('btn-tour-prev'),
    btnTourNext: document.getElementById('btn-tour-next'),

    quizProgress: document.getElementById('quiz-progress'),
    quizScore: document.getElementById('quiz-score'),
    quizBody: document.getElementById('quiz-body'),
    quizQuestion: document.getElementById('quiz-question'),
    quizOptions: document.getElementById('quiz-options'),
    quizFeedback: document.getElementById('quiz-feedback'),
    quizFooter: document.getElementById('quiz-footer'),
    btnQuizNext: document.getElementById('btn-quiz-next'),
    quizSummary: document.getElementById('quiz-summary'),
    quizFinalScore: document.getElementById('quiz-final-score'),
    quizFinalMsg: document.getElementById('quiz-final-msg'),
    btnQuizRetake: document.getElementById('btn-quiz-retake'),

    // Bottom Dock
    bottomBar: document.getElementById('bottom-bar'),
    btnCollapseBottom: document.getElementById('btn-collapse-bottom'),
    sliderPeel: document.getElementById('slider-peel'),
    labelPeel: document.getElementById('label-peel'),
    sliderStenosis: document.getElementById('slider-stenosis'),
    labelStenosis: document.getElementById('label-stenosis'),
    presetButtons: Array.from(document.querySelectorAll('.preset-btn[data-stenosis]')),
    modeButtons: Array.from(document.querySelectorAll('.mode-btn[data-mode]')),
    camButtons: Array.from(document.querySelectorAll('.cam-btn[data-cam]')),
    btnDeployStent: document.getElementById('btn-deploy-stent'),
    btnTriggerRupture: document.getElementById('btn-trigger-rupture'),

    loadingOverlay: document.getElementById('loading-overlay')
  };

  // Initialize Live Poiseuille & Bernoulli 2D Canvas Graph
  const hemoGraph = createHemodynamicsGraph(els.hemoGraphCanvas);

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

  // =========================================================================
  // Right Panel Tabs (Anatomy | Physics | Tour & Quiz)
  // =========================================================================
  let activeTab = 'anatomy';

  function setRightTab(tabKey, expandIfCollapsed = true) {
    activeTab = tabKey;
    for (const btn of els.drawerTabButtons) {
      const match = btn.dataset.tab === tabKey;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', String(match));
    }
    for (const [key, panel] of Object.entries(els.tabPanels)) {
      if (panel) panel.classList.toggle('active', key === tabKey);
    }
    if (els.btnToggleTour) {
      const isEdu = tabKey === 'education';
      els.btnToggleTour.classList.toggle('active', isEdu);
      els.btnToggleTour.setAttribute('aria-pressed', String(isEdu));
    }
    if (expandIfCollapsed && els.rightDrawer.classList.contains('collapsed')) {
      els.rightDrawer.classList.remove('collapsed');
      els.btnCollapseRight.setAttribute('aria-expanded', 'true');
    }
  }

  for (const btn of els.drawerTabButtons) {
    btn.addEventListener('click', () => {
      setRightTab(btn.dataset.tab);
      if (btn.dataset.tab === 'education' && activeEduSubtab === 'tour') {
        callbacks.onApplyTourStep(GUIDED_TOUR_STEPS[tourStepIndex]);
      }
    });
  }

  // Top-Left "Tour & Quiz" Toggle Pill
  if (els.btnToggleTour) {
    els.btnToggleTour.addEventListener('click', () => {
      if (activeTab === 'education' && !els.rightDrawer.classList.contains('collapsed')) {
        setRightTab('anatomy', false);
      } else {
        setRightTab('education', true);
        if (activeEduSubtab === 'tour') {
          callbacks.onApplyTourStep(GUIDED_TOUR_STEPS[tourStepIndex]);
        }
      }
    });
  }

  // =========================================================================
  // Guided Anatomical Tour (7 Steps)
  // =========================================================================
  let activeEduSubtab = 'tour';
  let tourStepIndex = 0;

  function setEduSubtab(subKey) {
    activeEduSubtab = subKey;
    for (const btn of els.subtabButtons) {
      btn.classList.toggle('active', btn.dataset.subtab === subKey);
    }
    els.subtabTour.classList.toggle('active', subKey === 'tour');
    els.subtabQuiz.classList.toggle('active', subKey === 'quiz');
  }

  for (const btn of els.subtabButtons) {
    btn.addEventListener('click', () => setEduSubtab(btn.dataset.subtab));
  }

  // Build Tour progress dots
  els.tourDots.innerHTML = '';
  const tourDotEls = GUIDED_TOUR_STEPS.map((step, idx) => {
    const dot = document.createElement('span');
    dot.className = 'tour-dot' + (idx === 0 ? ' active' : '');
    dot.title = `Step ${step.step}: ${step.title}`;
    dot.addEventListener('click', () => goToTourStep(idx));
    els.tourDots.appendChild(dot);
    return dot;
  });

  function renderTourCard(idx) {
    const step = GUIDED_TOUR_STEPS[idx];
    els.tourStepCounter.textContent = `Step ${step.step} of ${GUIDED_TOUR_STEPS.length}`;
    els.tourStepBadge.textContent = step.badge;
    els.tourStepTitle.textContent = step.title;
    els.tourStepSummary.textContent = step.summary;
    els.tourStepActions.classList.toggle('hidden', !step.showActionShortcuts);
    els.btnTourPrev.disabled = idx === 0;
    els.btnTourNext.textContent =
      idx === GUIDED_TOUR_STEPS.length - 1 ? 'Start Quiz →' : 'Next →';
    tourDotEls.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function goToTourStep(idx) {
    tourStepIndex = Math.max(0, Math.min(GUIDED_TOUR_STEPS.length - 1, idx));
    renderTourCard(tourStepIndex);
    callbacks.onApplyTourStep(GUIDED_TOUR_STEPS[tourStepIndex]);
  }

  els.btnTourPrev.addEventListener('click', () => {
    if (tourStepIndex > 0) goToTourStep(tourStepIndex - 1);
  });

  els.btnTourNext.addEventListener('click', () => {
    if (tourStepIndex < GUIDED_TOUR_STEPS.length - 1) {
      goToTourStep(tourStepIndex + 1);
    } else {
      setEduSubtab('quiz');
    }
  });

  els.btnTourStent.addEventListener('click', () => callbacks.onToggleStent());
  els.btnTourRupture.addEventListener('click', () => callbacks.onToggleRupture());
  renderTourCard(0);

  // =========================================================================
  // Interactive 5-Question Self-Check Quiz
  // =========================================================================
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;

  function renderQuizQuestion() {
    const q = QUIZ_QUESTIONS[quizIndex];
    quizAnswered = false;
    els.quizBody.classList.remove('hidden');
    els.quizFooter.classList.remove('hidden');
    els.quizSummary.classList.add('hidden');
    els.quizFeedback.classList.add('hidden');
    els.btnQuizNext.disabled = true;
    els.btnQuizNext.textContent =
      quizIndex === QUIZ_QUESTIONS.length - 1 ? 'Finish Quiz →' : 'Next Question →';

    els.quizProgress.textContent = `Question ${quizIndex + 1} of ${QUIZ_QUESTIONS.length}`;
    els.quizScore.textContent = `Score: ${quizScore} / ${QUIZ_QUESTIONS.length}`;
    els.quizQuestion.textContent = q.question;

    els.quizOptions.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-opt-btn';
      btn.textContent = `${letters[optIdx]}. ${optText}`;
      btn.addEventListener('click', () => handleQuizAnswer(optIdx));
      els.quizOptions.appendChild(btn);
    });
  }

  function handleQuizAnswer(selectedIdx) {
    if (quizAnswered) return;
    quizAnswered = true;
    const q = QUIZ_QUESTIONS[quizIndex];
    const isCorrect = selectedIdx === q.correctIndex;
    if (isCorrect) quizScore++;

    els.quizScore.textContent = `Score: ${quizScore} / ${QUIZ_QUESTIONS.length}`;

    const optButtons = Array.from(els.quizOptions.querySelectorAll('.quiz-opt-btn'));
    optButtons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === q.correctIndex) btn.classList.add('correct');
      else if (idx === selectedIdx && !isCorrect) btn.classList.add('wrong');
    });

    els.quizFeedback.className = `quiz-feedback ${isCorrect ? 'correct' : 'wrong'}`;
    els.quizFeedback.textContent = `${isCorrect ? 'Correct! ' : 'Not quite — '}${q.explanation}`;
    els.btnQuizNext.disabled = false;
  }

  function showQuizSummary() {
    els.quizBody.classList.add('hidden');
    els.quizFooter.classList.add('hidden');
    els.quizSummary.classList.remove('hidden');
    els.quizFinalScore.textContent = `${quizScore} / ${QUIZ_QUESTIONS.length}`;

    if (quizScore === QUIZ_QUESTIONS.length) {
      els.quizFinalMsg.textContent =
        'Outstanding mastery of vascular histology, Poiseuille/Bernoulli hemodynamics, thrombosis, and PCI stenting!';
    } else if (quizScore >= 3) {
      els.quizFinalMsg.textContent =
        'Solid understanding of arterial anatomy and flow mechanics. Review the Physics tab or Guided Tour to perfect the remaining concepts.';
    } else {
      els.quizFinalMsg.textContent =
        'Walk through the 7-step Guided Tour and live Poiseuille/Bernoulli graph, then try the quiz again!';
    }
  }

  els.btnQuizNext.addEventListener('click', () => {
    if (quizIndex < QUIZ_QUESTIONS.length - 1) {
      quizIndex++;
      renderQuizQuestion();
    } else {
      showQuizSummary();
    }
  });

  els.btnQuizRetake.addEventListener('click', () => {
    quizIndex = 0;
    quizScore = 0;
    renderQuizQuestion();
  });
  renderQuizQuestion();

  // =========================================================================
  // Bottom Dock Controls & Clinical Interventions
  // =========================================================================
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

  els.btnDeployStent.addEventListener('click', () => callbacks.onToggleStent());
  els.btnTriggerRupture.addEventListener('click', () => callbacks.onToggleRupture());

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
  els.btnCloseDetail.addEventListener('click', () => callbacks.onResetFocus());

  function syncPeelUI(val) {
    els.sliderPeel.value = String(val);
    els.labelPeel.textContent = `${val}%`;
  }

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

  /**
   * Synchronizes Deploy Stent / Reset Intervention and Plaque Rupture / Reset Thrombosis buttons & status pill.
   */
  function syncInterventionUI(stenosisPct, stentState, thrombusState) {
    const stentActive = stentState.mode !== 'idle';
    const thrombusActive = thrombusState.mode !== 'idle';

    // Deploy Stent / Reset Intervention button
    if (stentActive) {
      els.btnDeployStent.disabled = false;
      els.btnDeployStent.classList.add('active');
      els.btnDeployStent.textContent = 'Reset Intervention';
      els.btnDeployStent.title = 'Remove deployed stent and restore pre-stent stenosis';
    } else {
      const canStent = stenosisPct > 0 && !thrombusActive;
      els.btnDeployStent.disabled = !canStent;
      els.btnDeployStent.classList.remove('active');
      els.btnDeployStent.textContent = 'Deploy Stent';
      els.btnDeployStent.title = canStent
        ? 'Animate PCI balloon angioplasty & titanium stent deployment'
        : thrombusActive
          ? 'Reset active thrombosis first'
          : 'Increase Stenosis above 0% to deploy a stent';
    }

    // Trigger Plaque Rupture / Reset Thrombosis button (enabled when Stenosis >= 50% and Stent not deployed)
    if (thrombusActive) {
      els.btnTriggerRupture.disabled = false;
      els.btnTriggerRupture.classList.add('active');
      els.btnTriggerRupture.textContent = 'Reset Thrombosis';
      els.btnTriggerRupture.title = 'Clear blood clot and restore flow';
    } else {
      const canRupture = stenosisPct >= 50 && !stentActive;
      els.btnTriggerRupture.disabled = !canRupture;
      els.btnTriggerRupture.classList.remove('active');
      els.btnTriggerRupture.textContent = 'Trigger Plaque Rupture';
      els.btnTriggerRupture.title = canRupture
        ? 'Trigger fibrous cap fissure & occlusive blood clot formation'
        : stentActive
          ? 'Unavailable while metallic stent is deployed'
          : 'Requires Stenosis ≥ 50% (Severe or Moderate plaque)';
    }

    // Also keep Step 7 tour shortcut buttons synced
    if (els.btnTourStent && els.btnTourRupture) {
      els.btnTourStent.textContent = stentActive ? 'Reset Stent' : 'Deploy PCI Stent';
      els.btnTourStent.classList.toggle('active', stentActive);
      els.btnTourRupture.textContent = thrombusActive ? 'Reset Clot' : 'Trigger Rupture';
      els.btnTourRupture.classList.toggle('active', thrombusActive);
    }

    // Top-left live clinical status pill
    if (thrombusActive) {
      els.statusPill.className = 'clinical-status-pill glass-panel danger';
      els.statusText.textContent = `Thrombosis: ${thrombusState.phaseLabel}`;
    } else if (stentActive) {
      const isDone = stentState.mode === 'deployed';
      els.statusPill.className = `clinical-status-pill glass-panel ${isDone ? 'success' : ''}`;
      els.statusText.textContent = `PCI: ${stentState.phaseLabel}`;
    } else {
      els.statusPill.className = 'clinical-status-pill glass-panel hidden';
    }
  }

  function buildClinicalContext(id, stenosisPct, heartRateMode, stateOpts) {
    const hemo = computeHemodynamics(stenosisPct, heartRateMode, 0.7, stateOpts);
    if (hemo.isOccluded) {
      return 'ACUTE THROMBOTIC OCCLUSION (100%): Fibrin-platelet clot completely seals the lumen. Downstream flow halted; proximal RBCs stagnate upstream.';
    }
    if (stateOpts && stateOpts.stentCompression > 0.75) {
      return `POST-PCI STENT RESTORED: Brushed-titanium scaffold expands lumen to ${hemo.lumenDiameterPct}%, restoring smooth laminar flow (~${Math.round(hemo.peakVelocityCmS)} cm/s, ΔP ${hemo.peakDeltaPMmHg.toFixed(1)} mmHg).`;
    }
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
      return `${grade}: ${stenosisPct}% diameter reduction (${hemo.areaReductionPct}% area loss), peak jet ~${Math.round(hemo.peakVelocityCmS)} cm/s, ΔP ≈ ${hemo.peakDeltaPMmHg.toFixed(1)} mmHg.`;
    }
    if (id === 'lumen') {
      return `${hemo.regime} regime (Re ≈ ${hemo.reynolds}) at ${hemo.bpm} BPM. Effective throat lumen is ${hemo.lumenDiameterPct}% with peak wall shear ${hemo.wssPa.toFixed(1)} Pa.`;
    }
    if (id === 'media') {
      return `Active rhythmic distension synced to ${hemo.bpm} BPM (${heartRateMode === 'exercise' ? 'elevated exercise pulse pressure' : 'resting baseline tone'}).`;
    }
    if (id === 'intima') {
      return `Exposed directly to ${hemo.wssPa.toFixed(1)} Pa peak wall shear stress. Abnormal oscillatory low shear downstream of plaque promotes endothelial dysfunction.`;
    }
    return `Healthy structural integrity maintained at ${hemo.bpm} BPM; outer wall tension adapts smoothly to systolic pulsation.`;
  }

  function updateDetailCard(id, stenosisPct, heartRateMode, stateOpts = {}, expandDrawer = false) {
    const item = ANATOMY_BY_ID[id] || ANATOMY_BY_ID.media;
    const hemo = computeHemodynamics(stenosisPct, heartRateMode, 0.7, stateOpts);

    els.detailSwatch.style.background = item.swatch;
    els.detailTag.textContent = item.tag;
    els.detailName.textContent = item.name;
    els.detailThickness.textContent =
      id === 'plaque'
        ? hemo.isOccluded
          ? '100% Clot Seal'
          : stateOpts.stentCompression > 0.75
            ? 'Compressed (Stented)'
            : stenosisPct === 0
              ? '0% (Absent)'
              : `${stenosisPct}% Narrowing`
        : id === 'lumen'
          ? `${hemo.lumenDiameterPct}% Open Diam.`
          : item.thicknessPct;
    els.detailTissueShort.textContent = item.primaryTissue;
    els.detailComposition.textContent = item.composition;
    els.detailFunction.textContent = item.function;
    els.detailClinical.textContent = buildClinicalContext(id, stenosisPct, heartRateMode, stateOpts);

    for (const [key, btn] of legendButtons.entries()) {
      btn.classList.toggle('active', key === id);
    }
    for (const [key, pin] of pinElements.entries()) {
      pin.classList.toggle('active', key === id);
    }

    if (expandDrawer) {
      setRightTab('anatomy', true);
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

    pulseCtx.strokeStyle = 'rgba(148, 188, 240, 0.14)';
    pulseCtx.lineWidth = 1;
    pulseCtx.beginPath();
    pulseCtx.moveTo(0, h - 5);
    pulseCtx.lineTo(w, h - 5);
    pulseCtx.stroke();

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

    pulseCtx.fillStyle = '#ffffff';
    pulseCtx.beginPath();
    pulseCtx.arc(w - 2.5, lastY, 2.2, 0, Math.PI * 2);
    pulseCtx.fill();
  }

  function updateTelemetry(
    time,
    stenosisPct,
    heartRateMode,
    heartPhase,
    pulseVal,
    selectedId,
    stateOpts = {}
  ) {
    drawPulseWaveform(heartPhase, heartRateMode, pulseVal);

    // Update live 2D Poiseuille & Bernoulli Graph when Physics tab is open
    const profile = hemoGraph.update(time, stenosisPct, heartRateMode, pulseVal, stateOpts);

    // Throttle numeric DOM text updates to ~10 Hz
    if (time - lastTelemetryUpdate < 0.1) return;
    lastTelemetryUpdate = time;

    const hemo = computeHemodynamics(stenosisPct, heartRateMode, pulseVal, stateOpts);
    els.valVelocity.textContent = String(Math.round(hemo.liveVelocityCmS));
    els.valLumen.textContent = String(hemo.lumenDiameterPct);
    els.valShear.textContent = hemo.wssPa.toFixed(1);

    els.valRegime.textContent = hemo.regime;
    els.valRegime.className = `regime-badge ${hemo.regimeClass}`;

    // Update Physics Tab KPI cards
    if (els.physPeakVel) {
      const openFrac = Math.max(0.12, hemo.lumenDiameterPct / 100);
      const resMult = hemo.isOccluded ? '∞' : `${Math.min(999, 1 / Math.pow(openFrac, 4)).toFixed(1)}×`;
      const dpDisplay = profile ? profile.maxPressureDrop : hemo.peakDeltaPMmHg;

      els.physPeakVel.textContent = hemo.isOccluded
        ? '0 cm/s'
        : `${Math.round(hemo.liveVelocityCmS)} cm/s`;
      els.physDeltaP.textContent = `${dpDisplay.toFixed(1)} mmHg`;
      els.physResistance.textContent = resMult;
      els.physReynolds.textContent = String(hemo.reynolds);

      if (hemo.isOccluded) {
        els.physNote.textContent =
          '100% thrombotic occlusion: volumetric flow drops to zero and the full arterial pressure head drops abruptly across the clot.';
      } else if (stateOpts.stentCompression > 0.75) {
        els.physNote.textContent =
          'Titanium stent restores lumen radius r, slashing 4th-power Poiseuille resistance and eliminating the Venturi jet & ΔP spike.';
      } else if (stenosisPct >= 50) {
        els.physNote.textContent =
          'Critical stenosis: steep Venturi acceleration at the throat triggers irreversible turbulent expansion pressure loss downstream.';
      } else {
        els.physNote.textContent =
          'Smooth laminar Poiseuille profile: low pressure drop and minimal convective Bernoulli acceleration across the vessel.';
      }
    }

    if (selectedId) {
      els.detailClinical.textContent = buildClinicalContext(
        selectedId,
        stenosisPct,
        heartRateMode,
        stateOpts
      );
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

  function updatePins(camera, peelPct, effectiveStenosisPct, radialScale) {
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
      const { anchor } = getAnatomyPinAnchor(item.id, peelPct, effectiveStenosisPct);
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

      const dimmed = item.id === 'plaque' && effectiveStenosisPct < 3;
      pinEl.classList.toggle('dimmed', dimmed);
      pinEl.style.pointerEvents = 'auto';
      pinEl.style.opacity = dimmed ? '0.32' : '1';

      visibleItems.push({ el: pinEl, x: sx, y: sy, z: projVec.z });
    }

    // Gentle screen-space vertical separation so pin pills never overlap
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
    syncPeelUI,
    syncStenosisUI,
    syncModeUI,
    syncCameraUI,
    syncHeartRateUI,
    syncInterventionUI,
    setRightTab,
    updateDetailCard,
    updateTelemetry,
    updatePins,
    hideLoader
  };
}
