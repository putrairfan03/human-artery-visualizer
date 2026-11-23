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
import { createHudController } from './ui/hudController.js';

/**
 * Human Artery 3D Visualizer — Main Application Entrypoint
 * Orchestrates procedural biomedical textures, 5-layer cutaway artery geometry,
 * dynamic stenosis plaque, real-time hemodynamic blood cell simulation, and glassmorphic HUD.
 */

const state = {
  peelPct: 72,
  stenosisPct: 30,
  viewMode: 'anatomical', // 'anatomical' | 'xray' | 'heatmap'
  heartRateMode: 'resting', // 'resting' (65 BPM) | 'exercise' (130 BPM)
  selectedAnatomyId: 'media',
  activeCameraPreset: 'hero',
  heartPhase: 0,
  elapsedTime: 0
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

  // 4. Initialize HUD, interactive controls & 3D callout pins
  const hud = createHudController({
    onPeelChange(val) {
      state.peelPct = val;
      artery.rebuildGeometry(state.peelPct, state.stenosisPct, state.viewMode);
    },
    onStenosisChange(val) {
      state.stenosisPct = val;
      artery.rebuildGeometry(state.peelPct, state.stenosisPct, state.viewMode);
      hud.updateDetailCard(state.selectedAnatomyId, state.stenosisPct, state.heartRateMode, false);
    },
    onViewModeChange(mode) {
      state.viewMode = mode;
      artery.setViewMode(mode);
    },
    onHeartRateChange(hrMode) {
      state.heartRateMode = hrMode;
      hud.updateDetailCard(state.selectedAnatomyId, state.stenosisPct, state.heartRateMode, false);
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
      hud.updateDetailCard(id, state.stenosisPct, state.heartRateMode, true);

      // Smoothly focus camera onto the clicked layer / plaque / lumen
      const { cameraPos, cameraTarget } = getAnatomyPinAnchor(id, state.peelPct, state.stenosisPct);
      studio.focusCamera(cameraPos, cameraTarget, 0.85);
    },
    onResetFocus() {
      state.selectedAnatomyId = null;
      state.activeCameraPreset = 'hero';
      artery.setSelectedAnatomy(null);
      hud.syncCameraUI('hero');
      hud.updateDetailCard('media', state.stenosisPct, state.heartRateMode, false);
      studio.focusCamera(CAMERA_PRESETS.hero.position, CAMERA_PRESETS.hero.target, 0.85);
    }
  });

  // Initial UI sync
  hud.syncStenosisUI(state.stenosisPct);
  hud.syncModeUI(state.viewMode);
  hud.syncCameraUI(state.activeCameraPreset);
  hud.syncHeartRateUI(state.heartRateMode);
  hud.updateDetailCard(state.selectedAnatomyId, state.stenosisPct, state.heartRateMode, false);

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
    if (dist > 6) return; // User orbited or panned

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
      hud.updateDetailCard(hitId, state.stenosisPct, state.heartRateMode, true);
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

  // Resize handling
  window.addEventListener('resize', () => {
    studio.resize();
  });

  // Smooth 60 FPS Render & Simulation Loop
  let prevTime = performance.now();
  let firstFrameDone = false;

  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
    prevTime = now;
    state.elapsedTime += dt;

    // Advance cardiac phase at 65 BPM (resting) or 130 BPM (exercise)
    const bpm = state.heartRateMode === 'exercise' ? 130 : 65;
    state.heartPhase = (state.heartPhase + (bpm / 60) * dt) % 1.0;
    const pulseVal = sampleArterialPulse(state.heartPhase);

    // Update artery heartbeat pulsation & layer highlights
    const radialScale = artery.update(dt, pulseVal, state.heartRateMode);

    // Update hemodynamic blood cell particle system
    bloodFlow.update(dt, state.stenosisPct, pulseVal, state.heartRateMode, state.viewMode);

    // Update damped OrbitControls & smooth camera focus transitions
    studio.update(dt);

    // Render biomedical studio scene
    studio.renderer.render(studio.scene, studio.camera);

    // Update 3D projected callout pins & live telemetry HUD
    hud.updatePins(studio.camera, state.peelPct, state.stenosisPct, radialScale);
    hud.updateTelemetry(
      state.elapsedTime,
      state.stenosisPct,
      state.heartRateMode,
      state.heartPhase,
      pulseVal,
      state.selectedAnatomyId
    );

    if (!firstFrameDone) {
      firstFrameDone = true;
      hud.hideLoader();
    }
  }

  requestAnimationFrame(animate);
}

bootstrap();
