import * as THREE from 'three';
import {
  CAMERA_PRESETS,
  getAnatomyPinAnchor,
  sampleArterialPulse
} from './config/anatomyData.js';
import { createProceduralTextureLibrary } from './textures/proceduralTextures.js';
import { createStudioScene } from './scene/studioScene.js';
import { createArterySystem } from './scene/arteryBuilder.js';
import { createBloodFlowSystem } from './scene/bloodFlowSystem.js';
import { createStentSystem } from './scene/stentSystem.js';
import { createThrombosisSystem } from './scene/thrombosisSystem.js';
import { createHudController } from './ui/hudController.js';

/**
 * Human Artery 3D Visualizer — Main Application Entrypoint
 * Orchestrates procedural biomedical textures, 5-layer cutaway artery geometry,
 * dynamic stenosis plaque, PCI balloon angioplasty & metallic stent deployment,
 * plaque rupture & thrombosis simulation, real-time Poiseuille/Bernoulli telemetry,
 * blood flow InstancedMesh simulation, and Guided Tour / Quick Quiz HUD.
 */

const state = {
  peelPct: 72,
  stenosisPct: 30,
  viewMode: 'anatomical', // 'anatomical' | 'xray' | 'heatmap'
  heartRateMode: 'resting', // 'resting' (65 BPM) | 'exercise' (130 BPM)
  selectedAnatomyId: 'media',
  activeCameraPreset: 'hero',
  heartPhase: 0,
  elapsedTime: 0,
  lastRebuiltEffectiveStenosis: 30
};

function bootstrap() {
  const container = document.getElementById('canvas-container');
  const studio = createStudioScene(container);

  // 1. Synthesize procedural PBR organic textures
  const textures = createProceduralTextureLibrary();

  // 2. Build 5-layer cutaway artery + vasa vasorum + atherosclerotic plaque
  const artery = createArterySystem(textures);
  artery.rebuildGeometry(state.peelPct, state.stenosisPct, state.viewMode);
  artery.setViewMode(state.viewMode);
  studio.scene.add(artery.group);

  // 3. Build real-time hemodynamic InstancedMesh blood cell system
  const bloodFlow = createBloodFlowSystem();
  studio.scene.add(bloodFlow.group);

  // 4. Build PCI Balloon Angioplasty & Metallic Titanium Stent system
  const stentSystem = createStentSystem();
  studio.scene.add(stentSystem.group);

  // 5. Build Plaque Rupture & Acute Thrombosis (Blood Clot) system
  const thrombosisSystem = createThrombosisSystem();
  studio.scene.add(thrombosisSystem.group);

  function getEffectiveStenosisPct() {
    const comp = stentSystem.getState().plaqueCompression;
    return state.stenosisPct * (1.0 - 0.88 * comp);
  }

  function getStateOpts() {
    const st = stentSystem.getState();
    const th = thrombosisSystem.getState();
    return {
      stentCompression: st.plaqueCompression,
      balloonOcclusion: st.balloonOcclusion,
      thrombusOcclusion: th.thrombusOcclusion
    };
  }

  function rebuildArteryForCurrentState() {
    const effS = getEffectiveStenosisPct();
    state.lastRebuiltEffectiveStenosis = effS;
    artery.rebuildGeometry(state.peelPct, effS, state.viewMode);
  }

  // 6. Initialize HUD, 3D callout pins, live Poiseuille/Bernoulli graph, Tour & Quiz
  const hud = createHudController({
    onPeelChange(val) {
      state.peelPct = val;
      rebuildArteryForCurrentState();
    },
    onStenosisChange(val) {
      state.stenosisPct = val;
      // If user resets stenosis to 0% or lowers below 50% while thrombosis is active, reset cleanly
      if (val === 0 && stentSystem.getState().mode !== 'idle') {
        stentSystem.reset();
      }
      if (val < 50 && thrombosisSystem.getState().mode !== 'idle') {
        thrombosisSystem.reset();
      }
      rebuildArteryForCurrentState();
      hud.syncInterventionUI(state.stenosisPct, stentSystem.getState(), thrombosisSystem.getState());
      hud.updateDetailCard(
        state.selectedAnatomyId,
        state.stenosisPct,
        state.heartRateMode,
        getStateOpts(),
        false
      );
    },
    onViewModeChange(mode) {
      state.viewMode = mode;
      artery.setViewMode(mode);
      stentSystem.setViewMode(mode);
      thrombosisSystem.setViewMode(mode);
    },
    onHeartRateChange(hrMode) {
      state.heartRateMode = hrMode;
      hud.updateDetailCard(
        state.selectedAnatomyId,
        state.stenosisPct,
        state.heartRateMode,
        getStateOpts(),
        false
      );
    },
    onCameraPreset(presetKey) {
      const preset = CAMERA_PRESETS[presetKey];
      if (!preset) return;
      state.activeCameraPreset = presetKey;
      studio.focusCamera(preset.position, preset.target, 0.9);
    },
    onSelectAnatomy(id) {
      state.selectedAnatomyId = id;
      state.activeCameraPreset = null;
      hud.syncCameraUI(null);
      artery.setSelectedAnatomy(id);
      hud.updateDetailCard(id, state.stenosisPct, state.heartRateMode, getStateOpts(), true);

      const { cameraPos, cameraTarget } = getAnatomyPinAnchor(
        id,
        state.peelPct,
        getEffectiveStenosisPct()
      );
      studio.focusCamera(cameraPos, cameraTarget, 0.85);
    },
    onResetFocus() {
      state.selectedAnatomyId = null;
      state.activeCameraPreset = 'hero';
      artery.setSelectedAnatomy(null);
      hud.syncCameraUI('hero');
      hud.updateDetailCard('media', state.stenosisPct, state.heartRateMode, getStateOpts(), false);
      studio.focusCamera(CAMERA_PRESETS.hero.position, CAMERA_PRESETS.hero.target, 0.85);
    },
    onToggleStent() {
      const st = stentSystem.getState();
      if (st.mode !== 'idle') {
        // Reset Intervention -> return to pre-stent stenosed condition
        stentSystem.reset();
        rebuildArteryForCurrentState();
      } else if (state.stenosisPct > 0) {
        if (thrombosisSystem.getState().mode !== 'idle') {
          thrombosisSystem.reset();
        }
        // Ensure cutaway reveals the plaque/stent zone clearly during deployment
        if (state.peelPct < 60) {
          state.peelPct = 76;
          hud.syncPeelUI(state.peelPct);
          rebuildArteryForCurrentState();
        }
        stentSystem.startDeployment(state.stenosisPct);
        // Frame stenosis close-up slightly pulled back so full balloon + stent expansion shines
        state.activeCameraPreset = 'stenosis';
        hud.syncCameraUI('stenosis');
        studio.focusCamera([2.55, 1.55, 6.45], [1.45, -0.05, -0.05], 0.9);
      }
      hud.syncInterventionUI(state.stenosisPct, stentSystem.getState(), thrombosisSystem.getState());
    },
    onToggleRupture() {
      const th = thrombosisSystem.getState();
      if (th.mode !== 'idle') {
        thrombosisSystem.reset();
      } else if (state.stenosisPct >= 50 && stentSystem.getState().mode === 'idle') {
        if (state.peelPct < 60) {
          state.peelPct = 78;
          hud.syncPeelUI(state.peelPct);
          rebuildArteryForCurrentState();
        }
        thrombosisSystem.triggerRupture(state.stenosisPct);
        state.activeCameraPreset = 'stenosis';
        hud.syncCameraUI('stenosis');
        studio.focusCamera([2.65, 1.35, 5.55], [1.5, -0.05, -0.1], 0.85);
      }
      hud.syncInterventionUI(state.stenosisPct, stentSystem.getState(), thrombosisSystem.getState());
    },
    onApplyTourStep(step) {
      // Clear active interventions cleanly when stepping through anatomical layers 1–6
      if (step.step < 7) {
        if (stentSystem.getState().mode !== 'idle') stentSystem.reset();
        if (thrombosisSystem.getState().mode !== 'idle') thrombosisSystem.reset();
      }

      state.peelPct = step.peelPct;
      state.stenosisPct = step.stenosisPct;
      state.viewMode = step.viewMode;
      state.selectedAnatomyId = step.anatomyId;
      state.activeCameraPreset = null;

      hud.syncPeelUI(state.peelPct);
      hud.syncStenosisUI(state.stenosisPct);
      hud.syncModeUI(state.viewMode);
      hud.syncCameraUI(null);
      hud.syncInterventionUI(state.stenosisPct, stentSystem.getState(), thrombosisSystem.getState());

      artery.setSelectedAnatomy(step.anatomyId);
      artery.setViewMode(state.viewMode);
      stentSystem.setViewMode(state.viewMode);
      thrombosisSystem.setViewMode(state.viewMode);
      rebuildArteryForCurrentState();

      hud.updateDetailCard(
        step.anatomyId,
        state.stenosisPct,
        state.heartRateMode,
        getStateOpts(),
        false
      );
      studio.focusCamera(step.cameraPos, step.cameraTarget, 0.95);
    }
  });

  // Initial UI sync
  hud.syncPeelUI(state.peelPct);
  hud.syncStenosisUI(state.stenosisPct);
  hud.syncModeUI(state.viewMode);
  hud.syncCameraUI(state.activeCameraPreset);
  hud.syncHeartRateUI(state.heartRateMode);
  hud.syncInterventionUI(state.stenosisPct, stentSystem.getState(), thrombosisSystem.getState());
  hud.updateDetailCard(state.selectedAnatomyId, state.stenosisPct, state.heartRateMode, getStateOpts(), false);

  // Direct 3D Mesh Click-to-Select via Raycaster (distinguishing clicks from OrbitControls drags)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownPos = null;

  studio.renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  studio.renderer.domElement.addEventListener('pointerup', (e) => {
    if (!pointerDownPos) return;
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    pointerDownPos = null;
    if (dist > 6) return;

    const rect = studio.renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, studio.camera);
    const hits = raycaster.intersectObjects(artery.getInteractiveMeshes(), false);
    if (hits.length > 0 && hits[0].object.userData.anatomyId) {
      const hitId = hits[0].object.userData.anatomyId;
      state.selectedAnatomyId = hitId;
      state.activeCameraPreset = null;
      hud.syncCameraUI(null);
      artery.setSelectedAnatomy(hitId);
      hud.updateDetailCard(hitId, state.stenosisPct, state.heartRateMode, getStateOpts(), true);
    }
  });

  // Keyboard shortcuts for quick camera views (1-4)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const map = { '1': 'hero', '2': 'crossSection', '3': 'stenosis', '4': 'peelOverview' };
    const key = map[e.key];
    if (key) {
      state.activeCameraPreset = key;
      hud.syncCameraUI(key);
      const preset = CAMERA_PRESETS[key];
      studio.focusCamera(preset.position, preset.target, 0.85);
    }
  });

  window.addEventListener('resize', () => {
    studio.resize();
  });

  // Smooth 60 FPS Render & Simulation Loop
  let prevTime = performance.now();
  let firstFrameDone = false;
  let lastPlaqueMorphRebuild = 0;

  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
    prevTime = now;
    state.elapsedTime += dt;

    // Advance cardiac phase at 65 BPM (resting) or 130 BPM (exercise)
    const bpm = state.heartRateMode === 'exercise' ? 130 : 65;
    state.heartPhase = (state.heartPhase + (bpm / 60) * dt) % 1.0;
    const pulseVal = sampleArterialPulse(state.heartPhase);

    // Update PCI Balloon & Titanium Stent deployment animation
    const stentStatus = stentSystem.update(dt, pulseVal, state.stenosisPct);

    // Update Plaque Rupture & Thrombosis clot cascade
    const thrombusStatus = thrombosisSystem.update(dt, pulseVal);

    // Smoothly morph plaque compression during balloon inflation (throttled ~24 Hz for silky 60 FPS!)
    const effStenosis = getEffectiveStenosisPct();
    if (
      stentStatus.compressionChanged &&
      state.elapsedTime - lastPlaqueMorphRebuild > 0.042 &&
      Math.abs(effStenosis - state.lastRebuiltEffectiveStenosis) > 0.6
    ) {
      lastPlaqueMorphRebuild = state.elapsedTime;
      rebuildArteryForCurrentState();
    } else if (
      stentStatus.mode === 'deployed' &&
      Math.abs(effStenosis - state.lastRebuiltEffectiveStenosis) > 0.25
    ) {
      rebuildArteryForCurrentState();
    }

    // Keep intervention buttons & live clinical status pill updated during animations
    if (stentStatus.mode === 'deploying' || thrombusStatus.mode === 'rupturing') {
      hud.syncInterventionUI(state.stenosisPct, stentStatus, thrombusStatus);
    } else if (stentStatus.mode === 'deployed' || thrombusStatus.mode === 'occluded') {
      hud.syncInterventionUI(state.stenosisPct, stentStatus, thrombusStatus);
    }

    // Update artery heartbeat pulsation & layer highlights
    const radialScale = artery.update(dt, pulseVal, state.heartRateMode);

    // Update hemodynamic blood cell particle system
    bloodFlow.update(dt, effStenosis, pulseVal, state.heartRateMode, state.viewMode, {
      balloonOcclusion: stentStatus.balloonOcclusion,
      thrombusOcclusion: thrombusStatus.thrombusOcclusion
    });

    // Update damped OrbitControls & smooth camera focus transitions
    studio.update(dt);

    // Render biomedical studio scene
    studio.renderer.render(studio.scene, studio.camera);

    // Update 3D projected callout pins, live Poiseuille/Bernoulli graph & telemetry HUD
    const stateOpts = {
      stentCompression: stentStatus.plaqueCompression,
      balloonOcclusion: stentStatus.balloonOcclusion,
      thrombusOcclusion: thrombusStatus.thrombusOcclusion
    };
    hud.updatePins(studio.camera, state.peelPct, effStenosis, radialScale);
    hud.updateTelemetry(
      state.elapsedTime,
      state.stenosisPct,
      state.heartRateMode,
      state.heartPhase,
      pulseVal,
      state.selectedAnatomyId,
      stateOpts
    );

    if (!firstFrameDone) {
      firstFrameDone = true;
      hud.hideLoader();
    }
  }

  requestAnimationFrame(animate);
}

bootstrap();
