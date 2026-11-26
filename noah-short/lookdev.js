// Look-development stills: character lineup, the ark with the Light, the Light at dusk.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { lion, elephant, giraffe, camel, sheep, dove, ark, holyLight } from './characters.js';

const W = 1920, H = 1080;
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 500);
const composer = new EffectComposer(renderer);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.35, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function gradient(stops) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const hemi = new THREE.HemisphereLight(0xeaf4ff, 0xf3dcb8, 1.2); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 60 });
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xcfe2ff, 0.7); scene.add(fill);

// ---------- set 1: studio lineup ----------
const studio = new THREE.Group(); scene.add(studio);
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0xf6ecdc, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; studio.add(floor);
const cast = [
  [elephant(), -4.6, 0.2, -0.55, 1], [giraffe(), -2.25, -0.4, -0.45, 1], [lion(), -0.25, 0.4, -0.6, 1],
  [camel(), 1.75, -0.3, -0.5, 1], [sheep(), 3.55, 0.45, -0.7, 1.1],
];
for (const [m, x, z, yaw, s] of cast) { m.position.set(x, 0, z); m.rotation.y = yaw; m.scale.setScalar(s); studio.add(m); }
const rock = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 20), new THREE.MeshStandardMaterial({ color: 0xc9bba6, roughness: 0.9 }));
rock.scale.set(1.2, 0.55, 1); rock.position.set(4.95, 0.12, 0.6); rock.castShadow = rock.receiveShadow = true; studio.add(rock);
const dv = dove(); dv.scale.setScalar(1.5); dv.position.set(4.95, 0.25, 0.6); dv.rotation.y = -0.9; studio.add(dv);

// ---------- set 2: the ark on a green hill ----------
const world = new THREE.Group(); scene.add(world);
const grass = new THREE.Mesh(new THREE.CircleGeometry(120, 96), new THREE.MeshStandardMaterial({ color: 0x9fcf6e, roughness: 0.95 }));
grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; world.add(grass);
for (let i = 0; i < 9; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8fc0a8 : 0xa5cdb3, roughness: 1 }));
  const r = 14 + (i * 7) % 10; m.scale.set(r * 1.6, r * 0.45, r); m.position.set(-70 + i * 18, -r * 0.1, -55 - (i % 3) * 8); world.add(m);
}
for (const [x, z, s] of [[-7, -4, 1], [-9.5, -6, 1.3], [8, -5, 1.1], [10.5, -3, 0.8]]) {
  const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); world.add(t);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 1.4, 16), new THREE.MeshStandardMaterial({ color: 0x8a5d3b }));
  trunk.position.y = 0.7; trunk.castShadow = true; t.add(trunk);
  for (const [dx, dy, r] of [[0, 1.9, 0.75], [-0.45, 1.6, 0.5], [0.45, 1.65, 0.55]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0x5fae4c, roughness: 0.8, sheen: 0.5 }));
    b.position.set(dx, dy, 0); b.castShadow = true; t.add(b);
  }
}
const theArk = ark(); theArk.position.set(0.8, 0, -1.2); theArk.rotation.y = -0.12; world.add(theArk);
const pairA = elephant(); pairA.position.set(-0.9, 0, 3.6); pairA.rotation.y = -0.9; pairA.scale.setScalar(0.85); world.add(pairA);
const pairB = elephant(); pairB.position.set(-1.9, 0, 3.0); pairB.rotation.y = -0.75; pairB.scale.setScalar(0.8); world.add(pairB);
const gA = giraffe(); gA.position.set(-3.4, 0, 1.9); gA.rotation.y = -0.5; gA.scale.setScalar(0.85); world.add(gA);
const sA = sheep(); sA.position.set(2.6, 0, 3.4); sA.rotation.y = 2.4; world.add(sA);
const sB = sheep(); sB.position.set(3.3, 0, 3.0); sB.rotation.y = 2.6; sB.scale.setScalar(0.92); world.add(sB);
const nur = holyLight(world); nur.position.set(1.15, 1.55, 3.9);
const clouds = new THREE.Group(); world.add(clouds);
for (let i = 0; i < 7; i++) {
  const c = new THREE.Group(); c.position.set(-40 + i * 14, 16 + (i % 3) * 3, -60); clouds.add(c);
  for (let k = 0; k < 5; k++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdde8f5, emissiveIntensity: 0.5, fog: false }));
    m.position.set((k - 2) * 2.4, (k % 2) * 0.8, 0); m.scale.setScalar(2.6 - Math.abs(k - 2) * 0.5); c.add(m);
  }
}

// ---------- shots ----------
const shots = {
  1() { // character lineup
    studio.visible = true; world.visible = false;
    scene.background = gradient([[0, '#fdf6ea'], [1, '#f3e6d0']]); scene.fog = new THREE.Fog(0xf5eadb, 20, 45);
    hemi.color.set(0xeaf4ff); hemi.groundColor.set(0xf3dcb8); hemi.intensity = 1.25;
    sun.color.set(0xfff4e4); sun.intensity = 2.4; sun.position.set(-4, 9, 8); sun.target.position.set(0, 0, 0);
    fill.position.set(6, 3, 6);
    bloom.strength = 0.25;
    camera.fov = 25; camera.position.set(0.15, 2.3, 16.5); camera.lookAt(0.15, 1.0, 0);
  },
  2() { // the ark, animals arriving, the Light
    studio.visible = false; world.visible = true;
    scene.background = gradient([[0, '#5fb3ea'], [0.55, '#a8daf6'], [1, '#f6eedc']]); scene.fog = new THREE.Fog(0xdcecf0, 30, 110);
    hemi.color.set(0xdff0ff); hemi.groundColor.set(0xa5c98a); hemi.intensity = 1.15;
    sun.color.set(0xfff0d8); sun.intensity = 2.6; sun.position.set(-6, 10, 7); sun.target.position.set(0, 0, 0);
    nur.userData.light.intensity = 5;
    bloom.strength = 0.35;
    camera.fov = 34; camera.position.set(2.2, 2.6, 13.5); camera.lookAt(0.2, 1.6, 0.6);
  },
  3() { // the Light at dusk, close
    studio.visible = false; world.visible = true;
    scene.background = gradient([[0, '#2b3a6b'], [0.55, '#7d6aa0'], [1, '#f0a77a']]); scene.fog = new THREE.Fog(0x8a7aa0, 12, 70);
    hemi.color.set(0x9fb0e0); hemi.groundColor.set(0x6a7b5a); hemi.intensity = 0.8;
    sun.color.set(0xffa070); sun.intensity = 1.1; sun.position.set(8, 4, -6); sun.target.position.set(0, 0, 0);
    nur.userData.light.intensity = 9;
    bloom.strength = 0.55;
    camera.fov = 34; camera.position.set(-2.4, 2.0, 11.5); camera.lookAt(0.7, 1.4, 2.6);
  },
};

window.renderShot = (n) => {
  shots[n]();
  composer.render();
  return canvas.toDataURL('image/jpeg', 0.93);
};
window.ready = true;
if (!new URLSearchParams(location.search).has('render')) window.renderShot(Number(new URLSearchParams(location.search).get('shot') || 1));
