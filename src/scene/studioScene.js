import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA_PRESETS } from '../config/anatomyData.js';
import { createClinicalEnvironment } from '../textures/proceduralTextures.js';

/**
 * Builds the biomedical dark studio environment:
 * WebGLRenderer (ACESFilmic), PMREM studio environment lighting, subtle medical grid floor,
 * multi-point clinical lights, and damped OrbitControls with smooth camera focus easing.
 */
export function createStudioScene(container) {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070c16');
  scene.fog = new THREE.FogExp2('#070c16', 0.02);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);
  camera.position.set(...CAMERA_PRESETS.hero.position);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Clinical studio PMREM environment lighting
  const envMap = createClinicalEnvironment(renderer);
  scene.environment = envMap;

  // Damped OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.rotateSpeed = 0.72;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.65;
  controls.minDistance = 3.2;
  controls.maxDistance = 24.0;
  controls.maxPolarAngle = Math.PI * 0.88;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.target.set(...CAMERA_PRESETS.hero.target);
  controls.update();

  // Clinical Studio Lighting Rig
  const hemiLight = new THREE.HemisphereLight('#c8e1ff', '#162033', 0.65);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#f4f8ff', 2.15);
  keyLight.position.set(6.5, 11.0, 9.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 32;
  keyLight.shadow.camera.left = -10;
  keyLight.shadow.camera.right = 10;
  keyLight.shadow.camera.top = 7;
  keyLight.shadow.camera.bottom = -7;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.025;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight('#7cb9f8', 0.95);
  fillLight.position.set(-10.0, 4.0, 7.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight('#ffd4c2', 1.45);
  rimLight.position.set(4.0, 5.5, -10.5);
  scene.add(rimLight);

  // Subtle under-bounce light to softly reveal the underside of the vessel & cutaway lumen
  const underLight = new THREE.DirectionalLight('#4a72a8', 0.45);
  underLight.position.set(0, -8.5, 4.0);
  scene.add(underLight);

  // Subtle warm internal lumen accent light
  const lumenAccent = new THREE.PointLight('#ff6b7a', 0.85, 10, 1.8);
  lumenAccent.position.set(1.4, 0.25, 0.9);
  scene.add(lumenAccent);

  // Subtle Medical Studio Backdrop Grid Floor (with smooth radial fade)
  const floorGroup = buildMedicalBackdropGrid();
  floorGroup.position.y = -3.65;
  scene.add(floorGroup);

  // Smooth Camera Tweening State
  const transition = {
    active: false,
    elapsed: 0,
    duration: 0.9,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3()
  };

  // Cancel camera tween immediately when user manually drags or zooms
  controls.addEventListener('start', () => {
    transition.active = false;
  });

  function focusCamera(positionArr, targetArr, duration = 0.85) {
    transition.startPos.copy(camera.position);
    transition.endPos.set(positionArr[0], positionArr[1], positionArr[2]);
    transition.startTarget.copy(controls.target);
    transition.endTarget.set(targetArr[0], targetArr[1], targetArr[2]);
    transition.elapsed = 0;
    transition.duration = duration;
    transition.active = true;
  }

  function update(dt) {
    if (transition.active) {
      transition.elapsed += dt;
      const t = Math.min(1, transition.elapsed / transition.duration);
      // Smooth quintic ease-out
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(transition.startPos, transition.endPos, ease);
      controls.target.lerpVectors(transition.startTarget, transition.endTarget, ease);
      if (t >= 1) {
        transition.active = false;
      }
    }
    controls.update();
  }

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    focusCamera,
    update,
    resize
  };
}

/**
 * Creates a sleek clinical floor plane with procedural fine grid + radial fadeout
 * and a soft shadow catcher directly under the floating artery.
 */
function buildMedicalBackdropGrid() {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 1024, 1024);

  // Subtle radial glow at center
  const glow = ctx.createRadialGradient(512, 512, 20, 512, 512, 470);
  glow.addColorStop(0, 'rgba(56, 189, 248, 0.10)');
  glow.addColorStop(0.55, 'rgba(30, 64, 118, 0.05)');
  glow.addColorStop(1, 'rgba(7, 12, 22, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 1024);

  // Fine grid lines
  const step = 32;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 1024; i += step) {
    const isMajor = i % (step * 4) === 0;
    ctx.strokeStyle = isMajor ? 'rgba(110, 168, 232, 0.20)' : 'rgba(92, 142, 204, 0.075)';
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  // Soft circular alpha mask so grid fades seamlessly into dark backdrop
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(512, 512, 90, 512, 512, 500);
  mask.addColorStop(0, 'rgba(255,255,255,1)');
  mask.addColorStop(0.62, 'rgba(255,255,255,0.52)');
  mask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, 1024, 1024);

  const gridTex = new THREE.CanvasTexture(canvas);
  gridTex.colorSpace = THREE.SRGBColorSpace;
  gridTex.anisotropy = 8;

  const gridPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 36),
    new THREE.MeshBasicMaterial({
      map: gridTex,
      transparent: true,
      depthWrite: false
    })
  );
  gridPlane.rotation.x = -Math.PI / 2;
  group.add(gridPlane);

  // Soft shadow receiver directly beneath artery
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 14),
    new THREE.ShadowMaterial({ opacity: 0.38 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.01;
  shadowPlane.receiveShadow = true;
  group.add(shadowPlane);

  return group;
}
