// Goha and the Little Donkey — a procedural 3D short built with three.js.
// Every frame is a pure function of time t (seconds), so it can be rendered
// deterministically frame by frame (see render.mjs) or previewed live.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const DURATION = 69;
const W = 1280, H = 720;

// ---------- math helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, k) => a.clone().lerp(b, k);
const TAU = Math.PI * 2;
function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(7);
const pulse = (t, a, b, fade = 0.3) => ss(a, a + fade, t) * (1 - ss(b - fade, b, t));

// ---------- renderer / scene ----------
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 400);
scene.add(camera);

function gradientTexture(stops, w = 4, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
scene.background = gradientTexture([[0, '#5db7ec'], [0.45, '#9fd6f4'], [0.8, '#fbe6c6'], [1, '#fde3b8']]);
scene.fog = new THREE.Fog(0xf8e2c0, 38, 120);

// lights
const hemi = new THREE.HemisphereLight(0xcfe9ff, 0xf3c98e, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d4, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 60 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xbfdcff, 0.9);
rim.position.set(6, 7, -10);
scene.add(rim);
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// materials
const matCache = new Map();
function M(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: o.r ?? 0.72, metalness: 0,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
      transparent: !!o.opacity, opacity: o.opacity ?? 1, flatShading: !!o.flat,
    }));
  }
  return matCache.get(key);
}
function part(geom, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(...pos); m.rotation.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ'); m.scale.set(...scl);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const group = (parent, pos = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; };
const sphere = (r, w = 28, h = 20) => new THREE.SphereGeometry(r, w, h);
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 8, 18);

// ---------- static (merged) environment ----------
const buckets = new Map();
function addS(geom, color, pos, rot = [0, 0, 0], scl = [1, 1, 1]) {
  const g = geom.index ? geom.toNonIndexed() : geom.clone();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  g.clearGroups();
  g.applyMatrix4(new THREE.Matrix4().compose(V(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], rot[3] || 'XYZ')), V(...scl)));
  if (!buckets.has(color)) buckets.set(color, []);
  buckets.get(color).push(g);
}
function flushStatic() {
  for (const [c, list] of buckets) {
    const mesh = new THREE.Mesh(mergeGeometries(list), M(c, { r: 0.85 }));
    mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  }
  buckets.clear();
}

function stripeTexture(a, b, n = 8, vertical = true) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a;
    if (vertical) g.fillRect(i * 128 / n, 0, 128 / n + 1, 128); else g.fillRect(0, i * 128 / n, 128, 128 / n + 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function buildEnvironment() {
  // ground + path
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M(0xf2d49c, { r: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xe9c48a, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(90, 3.6), pathMat);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.002, -0.2); path.receiveShadow = true; scene.add(path);

  const box = (w, h, d, r = 0.12) => new RoundedBoxGeometry(w, h, d, 3, r);
  // pebbles along path edges
  for (let i = 0; i < 140; i++) {
    const x = -40 + rand() * 80, z = (rand() < 0.5 ? -2.0 : 1.6) + (rand() - 0.5) * 0.7;
    if (Math.abs(x) < 2.5 && z > 0) continue;
    const s = 0.04 + rand() * 0.07;
    addS(sphere(1, 10, 8), rand() < 0.5 ? 0xd2b688 : 0xc9ab7e, [x, s * 0.3, z], [0, rand() * 3, 0], [s * 1.3, s * 0.6, s]);
  }

  // houses
  const houseCols = [0xf4dab3, 0xecc49b, 0xf7e6cb, 0xe9b98a, 0xf1d0a8];
  let x = -34;
  while (x < 34) {
    const w = 3.4 + rand() * 1.8, h = 2.6 + rand() * 1.8, d = 3.2, z = -9.2 - rand() * 1.8;
    const col = houseCols[Math.floor(rand() * houseCols.length)];
    addS(box(w, h, d, 0.18), col, [x + w / 2, h / 2, z]);
    const fz = z + d / 2;
    const dx = x + w / 2 + (rand() - 0.5) * (w - 1.4);
    addS(box(0.9, 1.4, 0.16, 0.05), 0x8a5532, [dx, 0.7, fz]);
    addS(new THREE.CylinderGeometry(0.45, 0.45, 0.16, 20), 0x8a5532, [dx, 1.4, fz], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 2; k++) {
      const wx = x + 0.7 + rand() * (w - 1.4);
      if (Math.abs(wx - dx) < 0.9) continue;
      addS(box(0.55, 0.6, 0.12, 0.05), 0x3f6f96, [wx, h - 0.9, fz]);
      addS(box(0.75, 0.1, 0.2, 0.03), 0xfaf3e6, [wx, h - 1.25, fz + 0.04]);
    }
    if (rand() < 0.45) {
      addS(new THREE.SphereGeometry(Math.min(w, d) * 0.33, 24, 12, 0, TAU, 0, Math.PI / 2),
        rand() < 0.5 ? 0xffffff : 0x63b8b5, [x + w / 2, h, z]);
    } else {
      addS(box(w + 0.15, 0.22, d + 0.15, 0.06), 0xfaf0dc, [x + w / 2, h + 0.05, z]);
      if (rand() < 0.5) addS(box(w * 0.45, 1.1, d * 0.6, 0.12), col, [x + w * 0.35, h + 0.6, z - 0.3]);
    }
    // little awning over door
    addS(box(1.4, 0.08, 0.6, 0.03), [0xd9534f, 0x3d9bd6, 0xf0ad4e, 0x5cb85c][Math.floor(rand() * 4)], [dx, 1.95, fz + 0.3], [0.25, 0, 0]);
    x += w + 0.3 + rand() * 0.8;
  }

  // market stalls along the far side of the path
  const canopyPairs = [['#e84a5f', '#fff6ea'], ['#2bb3b1', '#fff6ea'], ['#f7b32b', '#f26b38'], ['#7d5fd8', '#fff6ea'], ['#3e8ed0', '#fff6ea']];
  const goods = [0xf28c28, 0xd8343a, 0xf5d53a, 0x6cae3e];
  let sIdx = 0;
  for (let sx = -26; sx < 26; sx += 4.4 + rand() * 1.2) {
    const z = -3.7 - rand() * 0.3;
    addS(box(2.2, 0.72, 1.0, 0.06), 0xb57b48, [sx, 0.36, z]);
    for (const [px, pz] of [[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]])
      addS(new THREE.CylinderGeometry(0.045, 0.05, 2.15, 10), 0x8b5a33, [sx + px, 1.07, z + pz]);
    const [ca, cb] = canopyPairs[sIdx++ % canopyPairs.length];
    const tex = stripeTexture(ca, cb, 8, true);
    const cMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide });
    const canopy = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.06, 1.55, 2, 0.02), cMat);
    canopy.position.set(sx, 2.18, z); canopy.rotation.x = 0.16; canopy.castShadow = true; scene.add(canopy);
    const val = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.28), cMat);
    val.position.set(sx, 1.96, z + 0.78); val.castShadow = true; scene.add(val);
    // goods: pyramids of fruit or pots
    const kind = Math.floor(rand() * 5);
    if (kind < 4) {
      const col = goods[kind], r = kind === 3 ? 0.15 : 0.085;
      for (let pile = -1; pile <= 1; pile++) {
        const c = pile === 0 ? col : goods[(kind + pile + 4) % 4];
        const rr = c === 0x6cae3e ? 0.15 : 0.085;
        for (let layer = 0; layer < 3; layer++) {
          const n = 3 - layer;
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
            addS(sphere(rr, 14, 10), c, [sx + pile * 0.68 + (i - (n - 1) / 2) * rr * 1.9, 0.72 + rr + layer * rr * 1.5,
              z + (j - (n - 1) / 2) * rr * 1.9], [0, 0, 0], c === 0x6cae3e ? [1.2, 0.9, 1] : [1, 1, 1]);
        }
      }
      void r;
    } else {
      const pts = [[0, 0], [0.16, 0.02], [0.22, 0.14], [0.2, 0.28], [0.11, 0.36], [0.1, 0.42], [0.13, 0.45]].map(([a, b]) => new THREE.Vector2(a, b));
      const pot = new THREE.LatheGeometry(pts, 20);
      for (let i = -1; i <= 1; i++) addS(pot, i === 0 ? 0x5aa7c9 : 0xc8673d, [sx + i * 0.65, 0.72, z], [0, 0, 0], [1.1, 1.1, 1.1]);
    }
    // baskets in front
    if (rand() < 0.7) {
      const bx = sx + (rand() - 0.5) * 1.4;
      addS(new THREE.CylinderGeometry(0.27, 0.21, 0.28, 18, 1), 0xa8783f, [bx, 0.14, z + 0.85]);
      addS(sphere(0.25, 16, 8), goods[Math.floor(rand() * 4)], [bx, 0.27, z + 0.85], [0, 0, 0], [1, 0.35, 1]);
    }
  }

  // palm trees
  const palms = [[-17, -5.8], [-6.4, -6.3], [5.6, -6.0], [14.5, -6.1], [-11, -12.5], [10, -12.8], [22, -6.2], [-25, -6.4], [30, -7], [-31, -7]];
  for (const [px, pz] of palms) {
    let cx = px, cy = 0, lean = (rand() - 0.5) * 0.25;
    const segs = 9;
    for (let i = 0; i < segs; i++) {
      const r = 0.2 - i * 0.008;
      addS(new THREE.CylinderGeometry(r * 0.92, r, 0.5, 12), i % 2 ? 0xa0703f : 0x8a5f35, [cx, cy + 0.25, pz], [0, 0, -lean]);
      cx += Math.sin(lean) * 0.5; cy += 0.48; lean *= 1.08;
    }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + rand() * 0.3;
      addS(sphere(1, 16, 8), i % 2 ? 0x46a84a : 0x5bbd52, [cx + Math.cos(a) * 1.05, cy - 0.15, pz + Math.sin(a) * 1.05],
        [0, -a, -0.45 - rand() * 0.2, 'YXZ'], [1.3, 0.06, 0.32]);
    }
    for (let i = 0; i < 3; i++) addS(sphere(0.12, 12, 8), 0x6b4423, [cx + Math.cos(i * 2.1) * 0.15, cy - 0.12, pz + Math.sin(i * 2.1) * 0.15]);
  }

  // far dunes
  for (let i = 0; i < 14; i++) {
    const r = 18 + rand() * 18;
    addS(sphere(1, 24, 12), 0xedc68c, [-110 + i * 17 + rand() * 6, -r * 0.05, -55 - rand() * 30], [0, 0, 0], [r * 1.4, r * 0.28, r]);
  }
  flushStatic();

  // clouds (unfogged)
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe6f0fa, emissiveIntensity: 0.55, roughness: 1, fog: false });
  for (let i = 0; i < 9; i++) {
    const c = group(scene, [-90 + i * 24 + rand() * 8, 24 + rand() * 10, -95 - rand() * 20]);
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(sphere(1, 16, 12), cloudMat);
      m.position.set((k - 2) * 3.2 + rand(), rand() * 1.5, rand() * 2);
      m.scale.setScalar(3 + rand() * 2.5 - Math.abs(k - 2) * 0.6); c.add(m);
    }
  }
  // soft sun disc
  const sunTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,253,235,1)'); gr.addColorStop(0.3, 'rgba(255,245,200,0.9)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, toneMapped: false }));
  sunSprite.position.set(-60, 55, -110); sunSprite.scale.setScalar(40); scene.add(sunSprite);
}

// ---------- character helpers ----------
function makeEye(parent, pos, yaw, r, lidColor) {
  const g = group(parent, pos); g.rotation.y = yaw;
  part(sphere(r), M(0xffffff, { r: 0.25 }), g);
  part(sphere(r * 0.62), M(0x2b1d17, { r: 0.2 }), g, [r * 0.74, 0, 0], [0, 0, 0], [0.45, 1, 1]);
  part(sphere(r * 0.16, 10, 8), M(0xffffff, { r: 0.1, emissive: 0xffffff, ei: 0.7 }), g, [r * 0.99, r * 0.26, r * 0.2]);
  const lidPivot = group(g);
  part(new THREE.SphereGeometry(r * 1.07, 26, 12, 0, TAU, 0, Math.PI / 2), M(lidColor), lidPivot);
  return { g, lidPivot };
}
function setLid(eye, close) {
  eye.lidPivot.rotation.z = close < 0.5 ? lerp(1.6, 0.05, close * 2) : lerp(0.05, -1.62, (close - 0.5) * 2);
}
function makeMouth(parent, pos, r, tube, color, tilt = 0) {
  const holder = group(parent, pos); holder.rotation.set(0, Math.PI / 2, tilt, 'YXZ');
  const flip = group(holder);
  part(new THREE.TorusGeometry(r, tube, 10, 24, Math.PI), M(color, { r: 0.4 }), flip, [0, r / 2, 0], [0, 0, Math.PI]);
  return flip; // flip.scale.y: 1 smile, -1 frown
}
function blinkAmt(t, off) {
  const p = (t + off) % 3.9;
  return p < 0.16 ? Math.sin(p / 0.16 * Math.PI) : 0;
}

// ---------- Goha ----------
const SKIN = 0xe9b48c, PURPLE = 0x7d4cc2, LAVENDER = 0xb99be8, WHITE = 0xfbfaf6, GOLD = 0xf2c14e;
function buildGoha() {
  const g = {};
  g.root = group(scene);
  g.body = group(g.root);
  for (const s of [-1, 1]) part(sphere(0.09), M(0xc0563a), g.body, [0.2, 0.05, s * 0.17], [0, 0, 0], [1.7, 0.7, 1]);
  g.feet = g.body.children.slice(-2);
  g.lean = group(g.body, [0, 0.45, 0]);
  const up = group(g.lean, [0, -0.45, 0]);
  g.upper = up;
  const prof = [[0.0, 0], [0.58, 0], [0.57, 0.1], [0.51, 0.42], [0.45, 0.8], [0.41, 1.1], [0.37, 1.3], [0.3, 1.45], [0.14, 1.56], [0, 1.58]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  g.robe = part(new THREE.LatheGeometry(prof, 40), M(PURPLE, { r: 0.85 }), up);
  part(new THREE.TorusGeometry(0.575, 0.035, 10, 48), M(LAVENDER), up, [0, 0.06, 0], [Math.PI / 2, 0, 0]);
  part(new THREE.TorusGeometry(0.445, 0.045, 10, 48), M(GOLD, { r: 0.45 }), up, [0, 0.82, 0], [Math.PI / 2, 0, 0]);
  part(new THREE.TorusGeometry(0.2, 0.045, 10, 32), M(LAVENDER), up, [0, 1.52, 0], [Math.PI / 2, 0, 0]);
  // a few lavender buttons
  for (let i = 0; i < 3; i++) part(sphere(0.03, 10, 8), M(LAVENDER), up, [0.385 - i * 0.03, 1.02 + i * 0.13, 0]);

  // head
  const h = group(up, [0, 1.86, 0]); g.head = h;
  part(sphere(0.3), M(SKIN, { r: 0.6 }), h);
  part(sphere(0.085), M(0xe39f78, { r: 0.55 }), h, [0.3, -0.06, 0]);
  for (const s of [-1, 1]) {
    part(sphere(0.065, 16, 12), M(0xf2998e, { r: 0.7 }), h, [0.235, -0.1, s * 0.16], [0, 0, 0], [0.5, 0.8, 1]);
    part(sphere(0.06, 14, 10), M(SKIN), h, [0, -0.02, s * 0.3]);
  }
  g.eyes = [-1, 1].map((s) => makeEye(h, V(0.25, 0.02, s * 0.118), -s * 0.12, 0.07, SKIN));
  g.brows = [-1, 1].map((s) => {
    const bg = group(h, [0.275, 0.105, s * 0.12]);
    part(capsule(0.022, 0.08), M(WHITE), bg, [0, 0, 0], [Math.PI / 2, 0, 0]);
    return { bg, s };
  });
  // beard + mustache
  part(sphere(0.27), M(WHITE, { r: 0.95 }), h, [0.11, -0.22, 0], [0, 0, 0], [0.82, 1.05, 1.07]);
  part(sphere(0.15), M(WHITE, { r: 0.95 }), h, [0.15, -0.47, 0], [0, 0, 0], [0.8, 1.15, 0.95]);
  part(sphere(0.06, 12, 10), M(WHITE, { r: 0.95 }), h, [0.15, -0.62, 0]);
  for (const s of [-1, 1]) part(capsule(0.045, 0.1), M(WHITE, { r: 0.9 }), h, [0.31, -0.125, s * 0.075], [s * -1.0, 0, 0], [1, 1, 1]);
  g.mouth = makeMouth(h, [0.33, -0.2, 0], 0.045, 0.014, 0x8a3b3b);
  // turban
  part(new THREE.TorusGeometry(0.25, 0.115, 16, 36), M(WHITE, { r: 0.9 }), h, [0, 0.245, 0], [Math.PI / 2, 0, 0]);
  part(new THREE.TorusGeometry(0.17, 0.1, 16, 32), M(0xf1efe8, { r: 0.9 }), h, [0, 0.36, 0], [Math.PI / 2, 0.1, 0]);
  part(sphere(0.21), M(WHITE, { r: 0.9 }), h, [0, 0.38, 0], [0, 0, 0], [1, 0.85, 1]);
  part(sphere(0.05, 14, 10), M(0x9b59d0, { r: 0.2 }), h, [0.355, 0.27, 0]);
  part(new THREE.TorusGeometry(0.05, 0.012, 8, 20), M(GOLD, { r: 0.3 }), h, [0.35, 0.27, 0], [0, Math.PI / 2, 0]);

  // arms
  g.arms = [-1, 1].map((s) => {
    const sh = group(up, [0, 1.32, s * 0.33]);
    part(new THREE.CylinderGeometry(0.085, 0.14, 0.52, 16), M(PURPLE, { r: 0.85 }), sh, [0, -0.26, 0]);
    part(new THREE.TorusGeometry(0.13, 0.03, 8, 24), M(LAVENDER), sh, [0, -0.51, 0], [Math.PI / 2, 0, 0]);
    const hand = part(sphere(0.085), M(SKIN, { r: 0.6 }), sh, [0, -0.6, 0]);
    return { sh, hand, s };
  });
  return g;
}

// ---------- Donkey ----------
const GRAY = 0x9d9daa, LIGHT = 0xdedbe2, DARK = 0x5d5964, PINK = 0xf2a7b5;
function buildDonkey() {
  const d = {};
  d.root = group(scene);
  d.torso = group(d.root, [0, 0.75, 0]);
  part(capsule(0.3, 0.55), M(GRAY, { r: 0.8 }), d.torso, [0, 0, 0], [0, 0, Math.PI / 2]);
  part(sphere(0.29), M(LIGHT, { r: 0.85 }), d.torso, [0, -0.06, 0], [0, 0, 0], [1.55, 0.82, 0.93]);
  // legs (2 segments)
  d.legs = {};
  for (const [name, lx, lz] of [['FR', 0.3, 0.17], ['FL', 0.3, -0.17], ['BR', -0.32, 0.17], ['BL', -0.32, -0.17]]) {
    const hip = group(d.torso, [lx, -0.12, lz]);
    part(sphere(0.115), M(GRAY, { r: 0.8 }), hip, [0, 0.05, 0]);
    part(capsule(0.08, 0.2), M(GRAY, { r: 0.8 }), hip, [0, -0.15, 0]);
    const knee = group(hip, [0, -0.3, 0]);
    part(sphere(0.074), M(GRAY, { r: 0.8 }), knee);
    part(capsule(0.066, 0.18), M(GRAY, { r: 0.8 }), knee, [0, -0.14, 0]);
    part(new THREE.CylinderGeometry(0.075, 0.087, 0.09, 16), M(DARK, { r: 0.6 }), knee, [0, -0.28, 0]);
    d.legs[name] = { hip, knee };
  }
  // bruise on right front lower leg (outer side)
  d.bruise = group(d.legs.FR.knee, [0.042, -0.1, 0.044]); d.bruise.rotation.y = Math.PI / 4;
  d.bruiseOuter = part(sphere(0.058, 16, 12), M(0x8b6fc4, { r: 0.6 }), d.bruise, [0, 0, 0], [0, 0, 0], [1, 1.15, 0.32]);
  d.bruiseInner = part(sphere(0.034, 14, 10), M(0x6a4fa8, { r: 0.6 }), d.bruise, [0, 0, 0.006], [0, 0, 0], [1, 1.1, 0.32]);
  d.gel = part(sphere(0.05, 16, 12), M(0xdff4ff, { r: 0.1, opacity: 0.75 }), d.bruise, [0, 0.005, 0.012], [0, 0, 0], [1, 1, 0.45]);

  // tail
  d.tail = group(d.torso, [-0.56, 0.1, 0]);
  part(capsule(0.03, 0.26), M(GRAY), d.tail, [0, -0.15, 0]);
  part(sphere(0.07, 14, 10), M(DARK, { r: 0.9 }), d.tail, [0, -0.33, 0], [0, 0, 0], [0.9, 1.3, 0.9]);

  // neck + head
  d.neck = group(d.torso, [0.3, 0.1, 0]);
  part(capsule(0.14, 0.26), M(GRAY, { r: 0.8 }), d.neck, [0.1, 0.17, 0], [0, 0, -0.55]);
  for (let i = 0; i < 5; i++) part(sphere(0.055, 12, 10), M(DARK, { r: 0.95 }), d.neck, [-0.04 + i * 0.05, 0.12 + i * 0.075, 0]);
  const h = group(d.neck, [0.25, 0.38, 0]); d.head = h;
  part(sphere(0.23), M(GRAY, { r: 0.75 }), h, [0, 0, 0], [0, 0, 0], [1.1, 1, 0.95]);
  part(sphere(0.16), M(LIGHT, { r: 0.75 }), h, [0.2, -0.09, 0], [0, 0, 0], [1.15, 0.85, 1.0]);
  for (const s of [-1, 1]) part(sphere(0.022, 10, 8), M(0x4d3f4a), h, [0.375, -0.05, s * 0.055], [0, 0, 0], [0.5, 1, 1.2]);
  for (let i = 0; i < 3; i++) part(sphere(0.05, 12, 10), M(DARK, { r: 0.95 }), h, [0.04 - i * 0.05, 0.21 + i * 0.01, (i - 1) * 0.03]);
  d.mouth = makeMouth(h, [0.335, -0.18, 0], 0.05, 0.013, 0x5a3a45, -0.7);
  d.eyes = [-1, 1].map((s) => makeEye(h, V(0.14, 0.075, s * 0.145), -s * 0.62, 0.082, GRAY));
  d.brows = [-1, 1].map((s) => {
    const bg = group(d.eyes[(s + 1) / 2].g, [0.02, 0.105, 0]);
    part(capsule(0.016, 0.06), M(DARK), bg, [0, 0, 0], [Math.PI / 2, 0, 0]);
    return { bg, s };
  });
  d.ears = [-1, 1].map((s) => {
    const e = group(h, [-0.06, 0.17, s * 0.09]);
    part(capsule(0.062, 0.26), M(GRAY, { r: 0.8 }), e, [0, 0.19, 0], [0, 0, 0], [1, 1, 0.75]);
    part(capsule(0.04, 0.2), M(PINK, { r: 0.8 }), e, [0.03, 0.19, 0], [0, 0, 0], [0.6, 1, 0.55]);
    part(sphere(0.03, 10, 8), M(DARK), e, [0, 0.38, 0]);
    return { e, s };
  });
  // tear (child of right eye)
  d.tear = part(sphere(0.022, 14, 10), M(0x9fd8ff, { r: 0.05, opacity: 0.85, emissive: 0x7fbfff, ei: 0.25 }), d.eyes[1].g, [0.05, -0.06, 0.04], [0, 0, 0], [1, 1.35, 1]);
  return d;
}

function setDonkeyFace(d, f) {
  // f: {smile [-1..1], sad 0..1, lid 0..1, earDroop 0..1, ear jiggle}
  d.mouth.scale.y = f.smile;
  for (const b of d.brows) {
    b.bg.rotation.x = b.s * 0.75 * f.sad;
    b.bg.position.y = 0.105 + 0.012 * f.sad;
  }
  for (const eye of d.eyes) setLid(eye, f.lid);
  for (const e of d.ears) {
    e.e.rotation.x = e.s * (0.18 + 0.7 * f.earDroop + (f.earJ || 0));
    e.e.rotation.z = 0.15 + 0.8 * f.earDroop + (f.earBack || 0);
  }
}
function setGohaFace(g, f) {
  g.mouth.scale.y = f.smile;
  for (const b of g.brows) { b.bg.rotation.x = b.s * 0.5 * (f.concern - f.raise * 0.2); b.bg.position.y = 0.105 + 0.025 * f.raise; }
  for (const eye of g.eyes) setLid(eye, f.lid);
}

// ---------- props ----------
function buildProps() {
  const p = {};
  p.stone = part(new THREE.IcosahedronGeometry(0.14, 1), M(0x9c968e, { r: 0.95, flat: true }), scene, [0.17, 0.075, 0.17], [0.3, 0.6, 0], [1.25, 0.72, 1.05]);
  p.pillow = group(scene);
  part(new RoundedBoxGeometry(0.56, 0.14, 0.46, 5, 0.065), M(0xfdfdfb, { r: 0.9 }), p.pillow);
  // wooden tray with the towel and ice
  p.tray = group(scene, [1.05, 0, -0.15]);
  part(new RoundedBoxGeometry(0.62, 0.06, 0.5, 2, 0.02), M(0xb98552, { r: 0.7 }), p.tray, [0, 0.03, 0]);
  const blue = new THREE.MeshStandardMaterial({ color: 0x5aaeea, roughness: 0.85, side: THREE.DoubleSide });
  p.towel = group(p.tray, [0, 0.065, 0]);
  const S = 0.17;
  part(new THREE.PlaneGeometry(S * 2, S * 2), blue, p.towel, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  p.flaps = [];
  for (let i = 0; i < 4; i++) {
    const hinge = group(p.towel); hinge.rotation.y = i * Math.PI / 2;
    const fp = group(hinge, [S, 0, 0]);
    const tri = new THREE.Shape(); tri.moveTo(0, -S); tri.lineTo(S, 0); tri.lineTo(0, S); tri.lineTo(0, -S);
    part(new THREE.ShapeGeometry(tri), blue, fp, [0, 0, 0], [-Math.PI / 2, 0, 0]);
    p.flaps.push(fp);
  }
  const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xe8f8ff, roughness: 0.08, transmission: 0, transparent: true, opacity: 0.8, clearcoat: 1, emissive: 0xbfe6ff, emissiveIntensity: 0.25 });
  p.ice = [];
  const spots = [[-0.06, -0.05], [0.06, -0.04], [0.0, 0.06], [-0.07, 0.07], [0.07, 0.07]];
  for (const [x, z] of spots) {
    const c = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.07, 0.07, 2, 0.015), iceMat);
    c.castShadow = true; c.userData.home = V(x, 0.04, z); p.towel.add(c); p.ice.push(c);
  }
  // the wrapped ice pack (blue bundle)
  p.pack = group(scene);
  part(new RoundedBoxGeometry(0.22, 0.09, 0.17, 4, 0.04), blue, p.pack);
  part(sphere(0.05, 14, 10), blue, p.pack, [0, 0.045, 0], [0, 0, 0], [1.2, 0.6, 1]);
  // gel tube
  p.tube = group(scene);
  part(new THREE.CylinderGeometry(0.035, 0.03, 0.17, 16), M(0xffffff, { r: 0.35 }), p.tube);
  part(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 16), M(0x4fa3e0, { r: 0.4 }), p.tube, [0, 0.02, 0]);
  part(new THREE.CylinderGeometry(0.018, 0.022, 0.04, 12), M(0x4fa3e0, { r: 0.4 }), p.tube, [0, -0.1, 0]);
  // hearts
  const hs = new THREE.Shape();
  hs.moveTo(0, -0.5); hs.bezierCurveTo(-0.15, -0.35, -0.6, -0.1, -0.5, 0.25); hs.bezierCurveTo(-0.42, 0.55, -0.08, 0.6, 0, 0.3);
  hs.bezierCurveTo(0.08, 0.6, 0.42, 0.55, 0.5, 0.25); hs.bezierCurveTo(0.6, -0.1, 0.15, -0.35, 0, -0.5);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 4, curveSegments: 16 });
  hg.center();
  const hcols = [0xff6f9c, 0xff8fb1, 0xff5a7e, 0xffa3c4];
  p.hearts = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ color: hcols[i % 4], roughness: 0.35, emissive: hcols[i % 4], emissiveIntensity: 0.25, transparent: true }));
    scene.add(m); p.hearts.push(m);
  }
  // sparkles
  p.sparkles = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), new THREE.MeshBasicMaterial({ color: 0xfff3a0, toneMapped: false }));
    scene.add(m); p.sparkles.push(m);
  }
  return p;
}

// screen overlays: vignette + fade
function screenPlane(mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  m.renderOrder = 999; m.frustumCulled = false; m.position.z = -0.2; camera.add(m); return m;
}
const vignette = screenPlane(new THREE.MeshBasicMaterial({
  map: (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 60, 128, 128, 182); gr.addColorStop(0, 'rgba(60,30,10,0)'); gr.addColorStop(1, 'rgba(60,30,10,0.32)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })(),
  transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
const fadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
const fader = screenPlane(fadeMat); fader.renderOrder = 1000;

// ---------- build ----------
buildEnvironment();
const goha = buildGoha();
const donkey = buildDonkey();
const props = buildProps();

// ---------- timeline ----------
const T_BUMP = 11.0;
const WALK = 1.1;
function donkeyX(t) {
  if (t < T_BUMP) return -0.45 - (T_BUMP - t) * WALK;
  if (t < 54.5) return -0.45;
  const s = t - 54.5, v = 1.25;
  return -0.45 + (s < 1 ? v * s * s / 2 : v * (s - 0.5));
}

function legSet(L, hip, knee) { L.hip.rotation.z = hip; L.knee.rotation.z = knee; }

function updateDonkey(t) {
  const d = donkey; const x = donkeyX(t);
  d.root.position.set(x, 0, 0); d.root.rotation.y = 0;
  let torsoY = 0.75, torsoPitch = 0, neckRot = 0, headRot = 0, headYaw = 0;
  const legs = { FR: [0, 0], FL: [0, 0], BR: [0, 0], BL: [0, 0] };
  const face = { smile: 1, sad: 0, lid: 0, earDroop: 0, earJ: 0, earBack: 0 };

  const walkCycle = (phase, amp, lift) => {
    const pairs = { FR: 0, BL: 0, FL: Math.PI, BR: Math.PI };
    for (const k in pairs) {
      const ph = phase + pairs[k];
      legs[k] = [amp * Math.sin(ph), -lift * Math.max(0, Math.cos(ph))];
    }
  };

  if (t < T_BUMP) {
    // happy walk; FR leg reaches max forward exactly at T_BUMP
    const ph = TAU * (t - T_BUMP) / 0.72 + Math.PI / 2;
    walkCycle(ph, 0.34, 0.55);
    torsoY += 0.025 * Math.abs(Math.sin(ph));
    headRot = 0.05 * Math.sin(ph * 2);
    face.earJ = 0.08 * Math.sin(ph * 2 + 1);
  } else if (t < 29) {
    // the bump, then sad standing while favoring the right front leg
    const k = t - T_BUMP;
    const lift = pulse(t, T_BUMP + 0.05, 13.4, 0.25);
    const wob = Math.sin(k * 16) * Math.exp(-k * 2.5) * 0.12;
    legs.FR = [lerp(0.15, 0.55, lift) + wob, lerp(-0.45, -1.35, lift)];
    torsoPitch = 0.06 * Math.exp(-k * 3) * Math.sin(k * 10);
    torsoY -= 0.03 * lift;
    neckRot = lerp(0, -0.18, ss(11.4, 12.4, t));
    // looks up at Goha when patted (19..21) and while he prepares
    headYaw = 0.25 * ss(17.5, 18.5, t) * (1 - ss(20.5, 21.2, t)) * -1;
    headRot = 0.18 * pulse(t, 18.8, 21.2, 0.5);
  } else if (t < 51) {
    // lie down (29-31), leg onto pillow (32-34)
    const k = ease(ss(29, 31, t));
    torsoY = lerp(0.75, 0.335, k);
    const fold = [lerp(0, 1.28, k), lerp(0, -2.55, k)];
    legs.BR = fold; legs.BL = fold;
    legs.FL = [lerp(0, 1.2, k), lerp(0, -2.45, k)];
    const ext = ease(ss(32, 34, t));
    const frFold = [lerp(0.15, 0.95, k), lerp(-0.45, -1.7, k)];
    legs.FR = [lerp(frFold[0], 1.5, ext), lerp(frFold[1], -0.06, ext)];
    neckRot = lerp(-0.18, -0.12, k) - 0.12 * ss(33, 35, t) + 0.1 * ss(36, 38, t);
    headRot = -0.15 * ss(32.5, 34, t) * (1 - ss(36, 37.5, t)) + 0.08 * Math.sin(t * 1.3) * ss(37, 39, t);
    headYaw = -0.75 * ss(29.5, 31, t);
    torsoY += 0.012 * Math.sin(t * 2.2) * ss(36, 38, t); // gentle breathing
  } else {
    // stand (51-53), hop (53.4-54.2), trot
    const up = ease(ss(51.2, 52.8, t));
    torsoY = lerp(0.335, 0.75, up);
    legs.BR = legs.BL = [lerp(1.28, 0, up), lerp(-2.55, 0, up)];
    legs.FL = [lerp(1.2, 0, up), lerp(-2.45, 0, up)];
    legs.FR = [lerp(1.5, 0, up), lerp(-0.06, 0, up)];
    const hop = clamp((t - 53.4) / 0.8);
    if (hop > 0 && hop < 1) {
      torsoY += 0.32 * Math.sin(Math.PI * hop);
      for (const k in legs) legs[k] = [legs[k][0] + (k[0] === 'F' ? 0.5 : -0.5) * Math.sin(Math.PI * hop), -0.6 * Math.sin(Math.PI * hop)];
      face.earJ = -0.3 * Math.sin(Math.PI * hop);
    }
    if (t > 54.5) {
      const amt = ss(54.5, 55.3, t);
      const ph = TAU * (t - 54.5) / 0.5;
      walkCycle(ph, 0.42 * amt, 0.75 * amt);
      torsoY += 0.06 * amt * Math.abs(Math.sin(ph));
      headRot = 0.08 * amt * Math.sin(ph * 2);
      face.earJ = 0.15 * amt * Math.sin(ph * 2 + 1);
    }
    neckRot = 0.05;
  }

  // face timeline
  const sadAmt = ss(11.2, 11.8, t) * (1 - 0.35 * ss(17, 19, t)) * (1 - ss(36, 37.5, t));
  const ow = pulse(t, T_BUMP, 11.9, 0.15);
  face.sad = sadAmt;
  face.earDroop = sadAmt * 0.9 + 0.2 * ss(36, 37.5, t) * (1 - ss(50.5, 51.5, t));
  face.smile = lerp(1, -1, clamp(sadAmt * 1.3 + ow));
  const relaxed = ss(36.2, 37.6, t) * (1 - ss(48.6, 49.4, t)) * (1 - ss(50.8, 51.3, t));
  face.lid = Math.max(ow * 0.95, relaxed * 0.55, blinkAmt(t, 0.7) * (1 - relaxed));
  if (t > 48.6 && t < 50.8) face.lid = Math.max(face.lid, 0.42 * pulse(t, 49.2, 50.8, 0.3)); // happy squint
  face.earBack += 0.25 * relaxed;
  setDonkeyFace(d, face);

  d.torso.position.y = torsoY; d.torso.rotation.z = torsoPitch;
  d.neck.rotation.z = neckRot; d.neck.rotation.y = headYaw; d.head.rotation.z = headRot;
  for (const k in legs) legSet(d.legs[k], legs[k][0], legs[k][1]);
  d.tail.rotation.z = -0.35 + 0.08 * Math.sin(t * 2.1);
  d.tail.rotation.x = 0.35 * Math.sin(t * 1.7) * (t > 54.5 ? 1.6 : 1);

  // tear
  const tearOn = pulse(t, 12.6, 16.2, 0.4);
  const slide = ss(13.2, 15.6, t);
  d.tear.visible = tearOn > 0.01;
  d.tear.scale.set(tearOn, tearOn * 1.35, tearOn);
  d.tear.position.set(0.05 + slide * 0.02, -0.06 - slide * 0.12, 0.045 + slide * 0.01);

  // bruise: appears at bump, fades with the gel
  const show = ss(11.15, 11.9, t) * (1 - ss(46.8, 50, t));
  d.bruise.visible = show > 0.01;
  d.bruise.scale.setScalar(Math.max(0.001, show * (1 + 0.06 * Math.sin(t * 3) * (t < 30 ? 1 : 0))));
  const gelAmt = ss(45.2, 45.8, t) * (1 - ss(47.6, 49.6, t));
  d.gel.visible = gelAmt > 0.01; d.gel.scale.set(gelAmt, gelAmt, gelAmt * 0.45);
}

function gohaX(t) {
  if (t < T_BUMP) return 0.2 - (T_BUMP - t) * WALK;
  if (t < 11.4) { const s = t - T_BUMP; return 0.2 + WALK * (s - s * s / 0.8); }
  return 0.42;
}

function poseArm(arm, fwd, out, bend = 0) { arm.sh.rotation.set(arm.s * -out, 0, fwd); arm.bend = bend; }

function updateGoha(t) {
  const g = goha;
  g.stretch = 1;
  let pos, yaw = 0, crouch = 0, lean = 0, walkPh = null, walkAmp = 0;
  const armL = g.arms[0], armR = g.arms[1]; // arms[0] is his left when facing +X? (-z side = left)
  let aL = [0.05, 0.12], aR = [0.05, 0.12];
  const face = { smile: 1, concern: 0, raise: 0, lid: blinkAmt(t, 2.1) };

  if (t < 21) {
    pos = V(gohaX(t), 0, -0.95);
    if (t < 11.4) { walkPh = TAU * gohaX(t) / 1.1; walkAmp = t < T_BUMP ? 1 : 1 - ss(T_BUMP, 11.4, t); }
    // turn toward the donkey, then step closer
    const turn = ease(ss(11.7, 12.7, t));
    yaw = lerp(0, -1.8, turn);
    pos.z = lerp(-0.95, -0.72, ss(18.0, 19.0, t));
    face.raise = pulse(t, 11.2, 12.6, 0.2);
    face.concern = ss(11.8, 12.6, t) * (1 - ss(16.2, 17.2, t)) * 0.9;
    face.smile = lerp(1, 0.25, face.concern);
    lean = 0.12 * ss(12.6, 13.5, t) + 0.15 * pulse(t, 18.6, 21, 0.4);
    // pat the donkey's head (right arm, reaching across)
    const pat = pulse(t, 18.8, 21.0, 0.45);
    aL = [lerp(0.05, 1.55, pat) + 0.12 * Math.sin(t * 11) * pat, lerp(0.12, -0.25, pat)];
    // open arms gesture of reassurance at 16.5-18
    const reassure = pulse(t, 16.4, 18.4, 0.4);
    aR = [lerp(0.05, 0.6, reassure), lerp(0.12, 0.55, reassure)];
    aL[1] += 0.45 * reassure * (1 - pat); aL[0] += 0.5 * reassure * (1 - pat);
  } else if (t < 51) {
    // kneeling in front of the donkey's extended right leg, facing it (-X)
    pos = V(0.66, 0, -0.74); yaw = -1.97; crouch = 1.4;
    lean = 0.3;
    if (t < 29) {
      // wrapping ice on the tray (front-left of him)
      yaw = -1.0; lean = 0.45;
      const place = t < 25.5 ? Math.sin((t - 22) / 0.7 * Math.PI) : 0;
      aR = [0.95 + 0.25 * Math.max(0, place), -0.05];
      aL = [0.85, 0.1];
      if (t > 25.5) { const f = Math.sin((t - 25.5) * 4.2); aR = [0.95 + 0.08 * f, -0.12]; aL = [0.95 - 0.08 * f, 0.1]; }
    } else if (t < 36.8) {
      const guide = pulse(t, 29, 31.2, 0.5);
      const lift = pulse(t, 31.8, 34.2, 0.4);
      const placePack = pulse(t, 34.0, 36.6, 0.4);
      yaw = -1.97 + 0.95 * pulse(t, 33.9, 35.0, 0.3);
      aL = [lerp(0.2, 1.05, Math.max(guide, lift)), 0.15];
      aR = [lerp(0.2, 1.05, Math.max(guide * 0.6, lift, placePack)), lerp(0.1, -0.05, placePack)];
      aL[0] = Math.max(aL[0], lerp(0.2, 1.05, placePack));
      lean = 0.3 + 0.08 * Math.max(lift, placePack);
      g.stretch = 1 + 0.25 * Math.max(lift, placePack);
    } else if (t < 42) {
      // happy, gentle pat on the donkey's neck
      const pat = pulse(t, 38.2, 41.4, 0.5);
      aR = [lerp(0.2, 1.45, pat) + 0.1 * Math.sin(t * 9) * pat, 0.1 - 0.35 * pat];
      lean = 0.3 + 0.2 * pat;
      g.stretch = 1 + 0.2 * pat;
    } else {
      // gel cream with the right hand, little circles
      const rub = pulse(t, 46, 48.4, 0.3);
      aL = [1.05 + 0.08 * Math.sin(t * 9) * rub, 0.12 + 0.06 * Math.cos(t * 9) * rub];
      aR = [0.6, 0.15];
      lean = 0.36;
      g.stretch = 1.35;
      face.lid = Math.max(face.lid, 0.4 * pulse(t, 49.2, 50.8, 0.3));
    }
  } else {
    // final: walks happily beside the donkey on the far side
    const dx = donkeyX(t);
    pos = V(Math.max(0.42, dx + 0.7), 0, -0.98);
    const turn = ease(ss(54.0, 55.0, t));
    yaw = lerp(-1.8, 0, turn);
    if (t > 54.6) { walkPh = TAU * (dx + 0.7) / 1.25; walkAmp = ss(54.6, 55.4, t); }
    const cheer = pulse(t, 53.2, 54.6, 0.35);
    aL = [lerp(0.05, 0.5, cheer), lerp(0.12, 2.1, cheer)];
    aR = [lerp(0.05, 0.5, cheer), lerp(0.12, 2.1, cheer)];
    face.lid = Math.max(face.lid, 0.42 * cheer);
  }

  let bob = 0, sway = 0;
  if (walkPh !== null && walkAmp > 0) {
    bob = 0.035 * Math.abs(Math.sin(walkPh)) * walkAmp;
    sway = 0.04 * Math.sin(walkPh) * walkAmp;
    aL = [aL[0] + 0.32 * Math.sin(walkPh) * walkAmp, aL[1]];
    aR = [aR[0] - 0.32 * Math.sin(walkPh) * walkAmp, aR[1]];
    g.feet[0].position.x = 0.2 + 0.13 * Math.sin(walkPh) * walkAmp;
    g.feet[1].position.x = 0.2 - 0.13 * Math.sin(walkPh) * walkAmp;
  } else { g.feet[0].position.x = g.feet[1].position.x = 0.2; }

  g.root.position.copy(pos); g.root.rotation.y = yaw;
  g.body.position.y = -0.36 * crouch + bob;
  g.robe.scale.set(1 + 0.12 * Math.min(crouch, 1), 1, 1 + 0.12 * Math.min(crouch, 1));
  g.body.rotation.x = sway;
  g.lean.rotation.z = -lean;
  for (const f of g.feet) f.visible = crouch < 0.5;
  g.head.rotation.z = 0.12 * lean + (t > 21 && t < 51 ? -0.05 : 0);
  g.head.rotation.y = 0.04 * Math.sin(t * 0.9);
  poseArm(armL, aL[0], aL[1]); poseArm(armR, aR[0], aR[1]);
  for (const a of g.arms) a.sh.scale.y = g.stretch;
  setGohaFace(g, face);
}

const tmpV = new THREE.Vector3();
function updateProps(t) {
  const p = props, d = donkey;
  // stone wobble when bumped
  const k = Math.max(0, t - T_BUMP);
  p.stone.rotation.z = (t > T_BUMP ? Math.sin(k * 18) * Math.exp(-k * 4) * 0.35 : 0);
  p.stone.position.x = 0.17 + (t > T_BUMP ? 0.03 * (1 - Math.exp(-k * 8)) : 0);
  p.stone.visible = t < 51 || t > 51; // always

  // tray: visible in treatment scenes
  p.tray.visible = t > 21 && t < 42;
  // ice cubes drop one by one 22..25
  p.ice.forEach((c, i) => {
    const t0 = 22 + i * 0.7;
    const fall = clamp((t - t0) / 0.35);
    c.visible = t > t0 - 0.05 && t < 27.8;
    const bounce = t > t0 + 0.35 ? 0.025 * Math.abs(Math.sin((t - t0 - 0.35) * 14)) * Math.exp(-(t - t0 - 0.35) * 7) : 0;
    c.position.copy(c.userData.home); c.position.y += (1 - fall * fall) * 0.45 + bounce;
    c.rotation.set(i * 0.4, i * 0.9 + (1 - fall) * 2, 0);
    // during folding cubes huddle to the middle
    const hud = ss(25.6, 27.2, t);
    c.position.x *= 1 - 0.5 * hud; c.position.z *= 1 - 0.5 * hud;
    c.scale.setScalar(1 - 0.3 * hud);
  });
  p.flaps.forEach((f, i) => { f.rotation.z = ease(ss(25.6 + i * 0.35, 26.4 + i * 0.35, t)) * 2.6; });
  p.towel.visible = t < 27.8;

  // pillow: drops softly at 31.2
  const plx = -0.45 + 0.64, plz = 0.17;
  const drop = clamp((t - 31.2) / 0.45);
  p.pillow.visible = t > 31.1 && t < 51.3;
  const squash = t > 31.65 ? 0.18 * Math.sin((t - 31.65) * 14) * Math.exp(-(t - 31.65) * 6) : 0;
  p.pillow.position.set(plx, 0.07 + (1 - drop * drop) * 0.7, plz);
  p.pillow.scale.set(1 + squash, 1 - squash, 1 + squash);

  // ice pack: appears at 27.6 on tray, carried to the bruise 34.4-35.6, removed by 42
  d.bruise.getWorldPosition(tmpV);
  const onLeg = tmpV.clone().add(V(0.0, 0.075, 0.02));
  const trayPos = V(1.05, 0.12, -0.15);
  const carry = ease(ss(34.4, 35.6, t));
  p.pack.visible = t > 27.6 && t < 42.05;
  const packPos = vlerp(trayPos, onLeg, carry);
  packPos.y += Math.sin(carry * Math.PI) * 0.35;
  p.pack.position.copy(packPos);
  p.pack.rotation.set(0, carry * 0.3, 0);
  const appear = ss(27.6, 27.9, t);
  p.pack.scale.setScalar(Math.max(0.001, appear));

  // gel tube in Goha's right hand
  p.tube.visible = t > 42.05 && t < 51;
  goha.arms[0].hand.getWorldPosition(tmpV);
  p.tube.position.copy(tmpV).add(V(0, -0.05, 0));
  p.tube.rotation.set(0.9, 0, 0.4);

  // sparkles while healing
  p.sparkles.forEach((s, i) => {
    d.bruise.getWorldPosition(tmpV);
    const a = i / 8 * TAU + t * 1.5;
    const tw = pulse(t, 47.8 + i * 0.12, 50.6, 0.3) * (0.6 + 0.4 * Math.sin(t * 12 + i * 2));
    s.visible = tw > 0.02;
    s.position.set(tmpV.x + Math.cos(a) * 0.16, tmpV.y + 0.06 + Math.sin(t * 3 + i) * 0.06 + (i % 3) * 0.04, tmpV.z + Math.sin(a) * 0.16);
    s.scale.setScalar(tw * 1.4); s.rotation.y = t * 3;
  });

  // floating hearts in the final scene
  p.hearts.forEach((h, i) => {
    const per = 2.8, t0 = 53.6 + (i * 0.37) % per;
    if (t < t0) { h.visible = false; return; }
    const u = ((t - t0) % per) / per;
    const fadeOut = 1 - ss(65.8, 67.4, t);
    const s = Math.sin(Math.PI * u) * 0.14 * fadeOut;
    h.visible = s > 0.002;
    const dx = donkeyX(t);
    const side = i % 3;
    const bx = side === 0 ? dx + 0.55 : side === 1 ? dx + 0.15 : dx + 0.4;
    const bz = side === 2 ? -0.9 : 0.15 + (i % 2) * 0.2;
    const by = side === 2 ? 2.35 : 1.45;
    h.position.set(bx + Math.sin(u * 6 + i) * 0.12 - u * 0.4, by + u * 1.3, bz + Math.cos(u * 5 + i) * 0.08);
    h.scale.setScalar(Math.max(0.001, s));
    h.rotation.set(0, Math.sin(t * 2 + i) * 0.5, Math.sin(t * 3 + i) * 0.15);
    h.material.opacity = clamp(Math.sin(Math.PI * u) * 1.6);
  });
}

// ---------- camera ----------
function shot(t) {
  const dx = donkeyX(t);
  if (t < 5) {
    const k = ease(t / 5);
    return { pos: vlerp(V(-18, 8.5, 16), V(dx - 1.6, 2.1, 7.4), k), tgt: vlerp(V(-10, 1.2, -1.5), V(dx + 0.4, 1.1, -0.4), k), fov: 40 };
  }
  if (t < 9.2) {
    const u = (t - 5) / 4.2;
    return { pos: V(dx - 1.6 + u * 2.0, 1.75 - u * 0.25, 7.4 - u * 1.6), tgt: V(dx + 0.4 + u * 0.3, 1.1 - u * 0.1, -0.4), fov: 38 };
  }
  if (t < 12.7) {
    const u = ease((t - 9.2) / 3.5);
    return { pos: V(lerp(-2.1, -1.0, u), lerp(0.62, 0.55, u), lerp(2.6, 2.2, u)), tgt: V(lerp(-0.6, 0.05, u), lerp(0.45, 0.32, u), 0.15), fov: 38 };
  }
  if (t < 16.6) {
    const u = (t - 12.7) / 3.9;
    return { pos: V(lerp(1.75, 1.45, u), 1.32, lerp(1.95, 1.6, u)), tgt: V(0.2, lerp(1.12, 1.1, u), 0.05), fov: 36 };
  }
  if (t < 21) {
    const u = (t - 16.6) / 4.4;
    return { pos: V(lerp(1.5, 1.2, u), lerp(1.75, 1.65, u), lerp(4.2, 3.6, u)), tgt: V(0.05, 1.25, -0.45), fov: 38 };
  }
  if (t < 29) {
    const u = (t - 21) / 8;
    const a = lerp(-0.1, 0.35, u);
    const c = V(1.05, 0.12, -0.15);
    return { pos: V(c.x + Math.sin(a) * 1.55, lerp(1.3, 1.2, u), c.z + Math.cos(a) * 1.55), tgt: V(c.x - 0.15, lerp(0.42, 0.32, u), c.z - 0.2), fov: 38 };
  }
  if (t < 36.8) {
    const u = ease(ss(33.2, 36.6, t));
    return { pos: vlerp(V(0.6, 1.6, 4.0), V(0.55, 1.1, 1.85), u), tgt: vlerp(V(0.3, 0.6, -0.2), V(0.28, 0.25, 0.0), u), fov: 38 };
  }
  if (t < 42) {
    const u = (t - 36.8) / 5.2;
    return { pos: V(lerp(0.65, 0.55, u), lerp(0.98, 0.95, u), lerp(1.6, 1.4, u)), tgt: V(0.1, 0.8, 0.0), fov: 36 };
  }
  if (t < 51) {
    const u = ease(ss(48.2, 50.6, t));
    return { pos: vlerp(V(0.55, 1.05, 1.8), V(0.5, 1.4, 3.6), u), tgt: vlerp(V(0.28, 0.25, 0.0), V(0.3, 0.6, -0.2), u), fov: 36 };
  }
  if (t < 55.4) {
    const u = (t - 51) / 4.4;
    return { pos: V(lerp(2.9, 3.4, u), lerp(1.25, 1.4, u), lerp(3.2, 3.6, u)), tgt: V(lerp(0.1, 0.8, u), 0.85, -0.3), fov: 38 };
  }
  const u = ease((t - 55.4) / (DURATION - 55.4));
  return { pos: V(dx + lerp(0.4, 1.4, u), lerp(1.5, 3.0, u), lerp(5.8, 8.6, u)), tgt: V(dx + lerp(0.9, 1.8, u), lerp(1.15, 1.4, u), -0.45), fov: 38 };
}

function updateCamera(t) {
  const s = shot(t);
  camera.position.copy(s.pos); camera.fov = s.fov; camera.updateProjectionMatrix();
  camera.lookAt(s.tgt);
  const h = 2 * 0.2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  vignette.scale.set(h * camera.aspect, h, 1);
  fader.scale.set(h * camera.aspect * 1.1, h * 1.1, 1);
  // fades: in from black, dip to white for "later", out to black
  let op = 1 - ss(0, 1.4, t), col = 0x000000;
  const dip = 1 - clamp(Math.abs(t - 42.05) / 0.55);
  if (dip > 0) { op = ease(dip); col = 0xfff8ec; }
  if (t > DURATION - 2.6) op = ss(DURATION - 2.6, DURATION - 0.3, t);
  fadeMat.color.set(col); fadeMat.opacity = op; fader.visible = op > 0.001;

  // lighting follows the action; warmer in the "later" scene and the finale
  const focus = V(donkeyX(t), 0, 0);
  sun.position.copy(focus).add(V(-7, 11, 8)); sun.target.position.copy(focus);
  const warm = ss(41.8, 42.3, t);
  sun.color.set(0xfff0d4).lerp(new THREE.Color(0xffd7a0), warm);
  hemi.intensity = lerp(1.35, 1.25, warm);
}

export function update(t) {
  updateDonkey(t); updateGoha(t); updateProps(t); updateCamera(t);
}

window.renderFrame = (t, q = 0.92) => {
  update(t); renderer.render(scene, camera);
  return canvas.toDataURL('image/jpeg', q);
};
window.DURATION = DURATION;
window.ready = true;

const params = new URLSearchParams(location.search);
if (!params.has('render')) {
  const start = performance.now() - (parseFloat(params.get('t')) || 0) * 1000;
  const loop = () => {
    const t = ((performance.now() - start) / 1000) % DURATION;
    update(t); renderer.render(scene, camera); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
