// Character, prop and "Light" builders for the Noah short.
// Every character is built facing +X, standing on y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- materials ----------
const cache = new Map();
export function fur(color, o = {}) {
  const k = 'f' + color + JSON.stringify(o);
  if (!cache.has(k)) cache.set(k, new THREE.MeshPhysicalMaterial({
    color, roughness: o.r ?? 0.62, metalness: 0, sheen: o.sheen ?? 0.55, sheenRoughness: 0.7,
    sheenColor: new THREE.Color(o.sheenColor ?? 0xffffff), map: o.map ?? null,
    clearcoat: o.cc ?? 0, clearcoatRoughness: 0.25,
  }));
  return cache.get(k);
}
const basic = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

export function mesh(geom, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(...pos); m.rotation.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ'); m.scale.set(...scl);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export const group = (parent, pos = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...pos); parent && parent.add(g); return g; };
const S = (r, w = 40, h = 28) => new THREE.SphereGeometry(r, w, h);

// smooth tapered limb hanging down from the origin (top radius r0, bottom radius r1)
const limbCache = new Map();
export function limb(len, r0, r1) {
  const k = [len, r0, r1].join();
  if (limbCache.has(k)) return limbCache.get(k);
  const pts = [];
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(r0 * Math.sin(a), r0 * Math.cos(a))); }
  for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push(new THREE.Vector2(r1 * Math.cos(a), -len - r1 * Math.sin(a))); }
  pts[pts.length - 1].x = 0.0001; pts[0].x = 0.0001;
  const g = new THREE.LatheGeometry(pts, 36);
  limbCache.set(k, g); return g;
}

// big, glossy, friendly eye looking along local +X
export function eye(parent, pos, r, yaw, iris = 0x5b3a29) {
  const g = group(parent, pos); g.rotation.y = yaw;
  mesh(S(r), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }), g);
  mesh(S(r * 0.68), fur(iris, { r: 0.3, sheen: 0 }), g, [r * 0.72, 0, 0], [0, 0, 0], [0.4, 1, 1]);
  mesh(S(r * 0.42), fur(0x120c0a, { r: 0.2, sheen: 0 }), g, [r * 0.86, 0, 0], [0, 0, 0], [0.35, 1, 1]);
  mesh(S(r * 0.17, 16, 12), basic(0xffffff), g, [r * 0.97, r * 0.32, r * 0.24]);
  mesh(S(r * 0.08, 12, 8), basic(0xffffff), g, [r * 0.97, -r * 0.24, -r * 0.2]);
  return g;
}
function smile(parent, pos, r, tube, color, yaw = 0, tilt = 0) {
  const h = group(parent, pos); h.rotation.set(0, Math.PI / 2 + yaw, tilt, 'YXZ');
  mesh(new THREE.TorusGeometry(r, tube, 12, 28, Math.PI), fur(color, { sheen: 0 }), h, [0, r / 2, 0], [0, 0, Math.PI]);
  return h;
}
function tubeAlong(parent, pts, r0, r1, mat, n = 22) {
  const curve = new THREE.CatmullRomCurve3(pts);
  for (let i = 0; i <= n; i++) {
    const t = i / n; const p = curve.getPoint(t);
    mesh(S(r0 + (r1 - r0) * t, 28, 20), mat, parent, [p.x, p.y, p.z]);
  }
  return curve;
}

// ---------- animals ----------
export function lion() {
  const root = group(null), gold = fur(0xecb252), cream = fur(0xfbe6c0), mane = fur(0xd2772a, { sheen: 0.9 });
  mesh(S(0.38), gold, root, [0, 0.72, 0], [0, 0, 0], [1.35, 0.95, 0.9]);
  mesh(S(0.33), cream, root, [0.06, 0.6, 0], [0, 0, 0], [1.15, 0.78, 0.82]);
  for (const [x, z] of [[0.3, 0.17], [0.3, -0.17], [-0.3, 0.17], [-0.3, -0.17]]) {
    mesh(limb(0.5, 0.11, 0.088), gold, root, [x, 0.62, z]);
    mesh(S(0.1), cream, root, [x + 0.03, 0.065, z], [0, 0, 0], [1.3, 0.7, 1.1]);
  }
  const h = group(root, [0.52, 1.02, 0]);
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 12 : 16, rad = ring ? 0.2 : 0.31, r = ring ? 0.11 : 0.135;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; mesh(S(r, 24, 16), mane, h, [-0.08 - ring * 0.06, Math.cos(a) * rad, Math.sin(a) * rad]); }
  }
  mesh(S(0.3), mane, h, [-0.14, 0, 0]);
  mesh(S(0.28), gold, h);
  for (const s of [-1, 1]) {
    mesh(S(0.11), cream, h, [0.22, -0.09, s * 0.075]);
    mesh(S(0.075), gold, h, [-0.02, 0.27, s * 0.17]);
    mesh(S(0.045), fur(0xf2b8a2), h, [0.02, 0.27, s * 0.18]);
    eye(h, [0.19, 0.075, s * 0.12], 0.072, -s * 0.35, 0x7a4b1e);
  }
  mesh(S(0.07), cream, h, [0.2, -0.17, 0]);
  mesh(S(0.055), fur(0x8a4b3c, { r: 0.35 }), h, [0.32, -0.025, 0], [0, 0, 0], [0.8, 0.7, 1.25]);
  smile(h, [0.3, -0.14, 0], 0.045, 0.012, 0x6b3a2e);
  tubeAlong(root, [V(-0.48, 0.82, 0), V(-0.7, 0.7, 0), V(-0.86, 0.8, 0), V(-0.9, 1.0, 0)], 0.035, 0.03, gold, 16);
  mesh(S(0.085), mane, root, [-0.9, 1.04, 0], [0, 0, 0], [0.9, 1.3, 0.9]);
  return root;
}

export function elephant() {
  const root = group(null), skin = fur(0xa9bad0, { sheen: 0.3 }), pink = fur(0xf3b9c4), nail = fur(0xfaf6ee);
  mesh(S(0.55), skin, root, [0, 0.98, 0], [0, 0, 0], [1.25, 0.95, 0.95]);
  for (const [x, z] of [[0.36, 0.26], [0.36, -0.26], [-0.38, 0.26], [-0.38, -0.26]]) {
    mesh(limb(0.68, 0.17, 0.16), skin, root, [x, 0.86, z]);
    for (const dz of [-0.07, 0, 0.07]) mesh(S(0.035, 16, 12), nail, root, [x + 0.15, 0.06, z + dz]);
  }
  const h = group(root, [0.72, 1.28, 0]);
  mesh(S(0.38), skin, h);
  for (const s of [-1, 1]) {
    const e = group(h, [-0.1, 0.03, s * 0.34]); e.rotation.y = s * 0.45;
    mesh(S(0.36), skin, e, [0, 0, 0], [0, 0, 0], [0.16, 1, 1.05]);
    mesh(S(0.28), pink, e, [0.035, 0, 0], [0, 0, 0], [0.1, 0.95, 1.0]);
    eye(h, [0.27, 0.1, s * 0.17], 0.075, -s * 0.45, 0x4a3426);
    mesh(new THREE.ConeGeometry(0.035, 0.16, 16), nail, h, [0.3, -0.24, s * 0.13], [0, 0, -2.2]);
    mesh(S(0.07), pink, h, [0.27, -0.06, s * 0.24], [0, 0, 0], [0.5, 0.7, 1]);
  }
  tubeAlong(h, [V(0.3, -0.05, 0), V(0.44, -0.3, 0), V(0.47, -0.55, 0), V(0.57, -0.73, 0), V(0.7, -0.72, 0)], 0.14, 0.065, skin, 26);
  smile(h, [0.27, -0.26, 0], 0.05, 0.012, 0x5c4450, 0, -0.5);
  tubeAlong(root, [V(-0.66, 1.05, 0), V(-0.75, 0.85, 0), V(-0.77, 0.65, 0)], 0.025, 0.022, skin, 10);
  mesh(S(0.05), fur(0x6d7d93), root, [-0.77, 0.6, 0], [0, 0, 0], [0.8, 1.3, 0.8]);
  return root;
}

function spotTexture(base, spot, seed = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512); g.fillStyle = spot;
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const cx = x * 73 + 36 + (rnd() - 0.5) * 20 + (y % 2) * 36, cy = y * 73 + 36 + (rnd() - 0.5) * 20;
    g.beginPath();
    const n = 9, base = 22 + rnd() * 8;
    for (let k = 0; k <= n; k++) { const a = k / n * TAU, rr = base * (0.8 + 0.35 * rnd()); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85); }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function giraffe() {
  const root = group(null);
  const tex = spotTexture('#f6cb72', '#cf8442', 3); tex.repeat.set(2, 1);
  const body = fur(0xffffff, { map: tex }), plain = fur(0xf6cb72), dark = fur(0x8a5a33), hoof = fur(0x5b4636);
  mesh(S(0.4), body, root, [0, 1.28, 0], [0, 0, 0], [1.35, 0.88, 0.85]);
  for (const [x, z] of [[0.32, 0.16], [0.32, -0.16], [-0.32, 0.16], [-0.32, -0.16]]) {
    mesh(limb(1.08, 0.085, 0.065), plain, root, [x, 1.2, z]);
    mesh(new THREE.CylinderGeometry(0.068, 0.078, 0.08, 20), hoof, root, [x, 0.04, z]);
  }
  const neck = group(root, [0.36, 1.4, 0]); neck.rotation.z = Math.PI - 0.32;
  const ntex = spotTexture('#f6cb72', '#cf8442', 9); ntex.repeat.set(1, 2);
  mesh(limb(1.0, 0.15, 0.095), fur(0xffffff, { map: ntex }), neck);
  for (let i = 0; i < 9; i++) mesh(S(0.035, 16, 12), dark, neck, [0.12 - i * 0.003, -0.1 - i * 0.1, 0]);
  const h = group(root, [0.36 + Math.sin(0.32) * 1.02, 1.4 + Math.cos(0.32) * 1.02, 0]);
  mesh(S(0.17), plain, h, [0, 0, 0], [0, 0, 0], [1.4, 1, 1]);
  mesh(S(0.12), fur(0xfbe2b4), h, [0.17, -0.05, 0], [0, 0, 0], [1.1, 0.9, 1]);
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.13, 12), plain, h, [-0.06, 0.2, s * 0.06]);
    mesh(S(0.034), dark, h, [-0.06, 0.27, s * 0.06]);
    mesh(S(0.06), plain, h, [-0.12, 0.1, s * 0.15], [s * 0.6, 0, 0], [0.6, 0.6, 1.3]);
    eye(h, [0.06, 0.06, s * 0.11], 0.06, -s * 0.55, 0x5a361f);
    mesh(S(0.012, 10, 8), fur(0x6b4430), h, [0.28, -0.02, s * 0.04]);
  }
  smile(h, [0.25, -0.1, 0], 0.035, 0.009, 0x6b4430, 0, -0.4);
  tubeAlong(root, [V(-0.52, 1.35, 0), V(-0.6, 1.15, 0), V(-0.62, 0.95, 0)], 0.02, 0.018, plain, 10);
  mesh(S(0.045), dark, root, [-0.62, 0.9, 0], [0, 0, 0], [0.8, 1.4, 0.8]);
  return root;
}

export function camel() {
  const root = group(null), c = fur(0xd9a86c), light = fur(0xf0cf9d), pad = fur(0x9b7350);
  mesh(S(0.42), c, root, [0, 1.25, 0], [0, 0, 0], [1.3, 0.82, 0.82]);
  mesh(S(0.3), c, root, [-0.05, 1.52, 0], [0, 0, 0], [1.15, 0.95, 0.85]);
  for (const [x, z] of [[0.33, 0.15], [0.33, -0.15], [-0.33, 0.15], [-0.33, -0.15]]) {
    mesh(limb(1.08, 0.09, 0.07), c, root, [x, 1.2, z]);
    mesh(S(0.09), pad, root, [x + 0.02, 0.04, z], [0, 0, 0], [1.3, 0.45, 1.1]);
  }
  tubeAlong(root, [V(0.45, 1.32, 0), V(0.72, 1.2, 0), V(0.88, 1.42, 0), V(0.92, 1.72, 0)], 0.15, 0.1, c, 24);
  const h = group(root, [1.02, 1.84, 0]);
  mesh(S(0.16), c, h, [0, 0, 0], [0, 0, 0], [1.5, 1, 1]);
  mesh(S(0.11), light, h, [0.17, -0.05, 0], [0, 0, 0], [1.1, 0.85, 1]);
  mesh(S(0.06), light, h, [0.22, -0.13, 0], [0, 0, 0], [1, 0.6, 1.2]);
  for (const s of [-1, 1]) {
    mesh(S(0.045), c, h, [-0.12, 0.12, s * 0.12], [0, 0, 0], [0.7, 1.1, 0.7]);
    eye(h, [0.05, 0.06, s * 0.105], 0.058, -s * 0.55, 0x4e321f);
  }
  smile(h, [0.26, -0.11, 0], 0.03, 0.008, 0x6b4430, 0, -0.3);
  tubeAlong(root, [V(-0.52, 1.3, 0), V(-0.6, 1.1, 0), V(-0.6, 0.92, 0)], 0.022, 0.02, c, 10);
  mesh(S(0.045), pad, root, [-0.6, 0.88, 0], [0, 0, 0], [0.8, 1.4, 0.8]);
  return root;
}

export function sheep() {
  const root = group(null), wool = fur(0xfffaf0, { r: 0.9, sheen: 1, sheenColor: 0xfff2e0 }), face = fur(0xf4d8cc), leg = fur(0x5e5050);
  const n = 34;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
    mesh(S(0.16 + ((i * 7) % 5) * 0.008, 28, 20), wool, root, [Math.cos(th) * rad * 0.4, 0.62 + y * 0.26, Math.sin(th) * rad * 0.3]);
  }
  mesh(S(0.38), wool, root, [0, 0.62, 0], [0, 0, 0], [1.1, 0.75, 0.85]);
  for (const [x, z] of [[0.2, 0.13], [0.2, -0.13], [-0.2, 0.13], [-0.2, -0.13]]) mesh(limb(0.34, 0.055, 0.05), leg, root, [x, 0.42, z]);
  const h = group(root, [0.46, 0.8, 0]);
  mesh(S(0.19), face, h, [0, 0, 0], [0, 0, 0], [1.15, 1, 0.95]);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; mesh(S(0.07, 20, 14), wool, h, [-0.03 + Math.cos(a) * 0.04, 0.17, Math.sin(a) * 0.08]); }
  for (const s of [-1, 1]) {
    mesh(S(0.07), face, h, [-0.03, 0.04, s * 0.2], [s * 0.5, 0, 0], [0.55, 0.45, 1.4]);
    eye(h, [0.13, 0.04, s * 0.095], 0.058, -s * 0.4, 0x4a3326);
    mesh(S(0.04), fur(0xf6a9a9), h, [0.12, -0.07, s * 0.13], [0, 0, 0], [0.4, 0.6, 1]);
  }
  mesh(S(0.025, 14, 10), fur(0xc47c7c), h, [0.22, -0.03, 0]);
  smile(h, [0.2, -0.09, 0], 0.035, 0.009, 0x8a5050);
  return root;
}

export function dove(withBranch = true) {
  const root = group(null), w = fur(0xffffff, { r: 0.55, sheen: 0.8, sheenColor: 0xe8f0ff }), orange = fur(0xf3a24a);
  mesh(S(0.2), w, root, [0, 0.32, 0], [0, 0, 0.15], [1.4, 1, 1]);
  mesh(S(0.13), w, root, [0.23, 0.5, 0]);
  mesh(new THREE.ConeGeometry(0.035, 0.1, 20), orange, root, [0.38, 0.48, 0], [0, 0, -Math.PI / 2 - 0.2]);
  for (const s of [-1, 1]) {
    eye(root, [0.31, 0.53, s * 0.075], 0.042, -s * 0.5, 0x2a1a12);
    mesh(S(0.17), w, root, [-0.04, 0.36, s * 0.17], [s * 0.25, 0, 0.2], [1.25, 0.32, 0.62]);
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 10), orange, root, [0.02, 0.08, s * 0.06]);
    mesh(S(0.03, 12, 8), fur(0xf7b8c6), root, [0.27, 0.45, s * 0.1], [0, 0, 0], [0.5, 0.6, 1]);
  }
  mesh(S(0.13), w, root, [-0.32, 0.36, 0], [0, 0, 0.35], [1.25, 0.2, 0.75]);
  if (withBranch) {
    const green = fur(0x6ea24a), olive = fur(0x5c7d2e, { r: 0.3 });
    tubeAlong(root, [V(0.38, 0.46, 0.02), V(0.45, 0.4, 0.08), V(0.52, 0.33, 0.12)], 0.008, 0.007, fur(0x7a5a35), 10);
    [[0.42, 0.43, 0.07, 0.6], [0.47, 0.37, 0.11, -0.5], [0.5, 0.35, 0.07, 0.9], [0.44, 0.4, 0.12, -0.2]].forEach(([x, y, z, a]) =>
      mesh(S(0.03, 16, 10), green, root, [x, y, z], [a, a * 0.5, 0.5], [1.6, 0.25, 0.6]));
    mesh(S(0.018, 12, 8), olive, root, [0.5, 0.31, 0.13]);
  }
  return root;
}

// ---------- the ark ----------
function plankTexture(base, alt, lines, rep = [0.3, 0.3]) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? base : alt; g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = lines; g.fillRect(0, i * 64, 512, 3);
    g.globalAlpha = 0.12; for (let k = 0; k < 6; k++) { g.fillRect(0, i * 64 + 10 + k * 8, 512, 1); } g.globalAlpha = 1;
    const off = (i * 197) % 512; g.fillRect(off, i * 64, 3, 64);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t;
}
export function ark() {
  const root = group(null);
  const hullMat = new THREE.MeshPhysicalMaterial({ map: plankTexture('#9c6236', '#a96d3e', '#5e3519', [0.16, 0.32]), roughness: 0.75, sheen: 0.2 });
  const s = new THREE.Shape();
  s.moveTo(-3.3, 1.95); s.quadraticCurveTo(-3.1, 0.25, -1.9, 0.0); s.lineTo(1.9, 0.0);
  s.quadraticCurveTo(3.1, 0.25, 3.5, 2.1); s.quadraticCurveTo(0.1, 1.45, -3.3, 1.95);
  const hg = new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.22, bevelSegments: 8, curveSegments: 40 });
  hg.translate(0, 0.05, -1.1);
  mesh(hg, hullMat, root);
  // stripe along the hull
  const stripe = new THREE.Shape();
  stripe.moveTo(-3.05, 1.35); stripe.quadraticCurveTo(0.1, 0.95, 3.2, 1.45); stripe.lineTo(3.17, 1.3); stripe.quadraticCurveTo(0.1, 0.8, -3.0, 1.2);
  const sg = new THREE.ExtrudeGeometry(stripe, { depth: 2.75, bevelEnabled: false, curveSegments: 40 }); sg.translate(0, 0.05, -1.375);
  mesh(sg, fur(0xe8c27a, { sheen: 0.1 }), root);
  const cabinMat = new THREE.MeshPhysicalMaterial({ map: plankTexture('#c58d58', '#cf9863', '#7d4f2b', [0.7, 0.9]), roughness: 0.75 });
  mesh(new RoundedBoxGeometry(3.4, 1.25, 1.7, 5, 0.1), cabinMat, root, [-0.2, 2.15, 0]);
  const roof = new THREE.Shape(); roof.moveTo(-2.15, 0); roof.lineTo(1.75, 0); roof.lineTo(-0.2, 0.95); roof.lineTo(-2.15, 0);
  const rg = new THREE.ExtrudeGeometry(roof, { depth: 2.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4 });
  rg.translate(0, 2.74, -1.05);
  mesh(rg, fur(0x8f4a2d, { sheen: 0.1 }), root);
  for (let i = 0; i < 4; i++) {
    const x = -1.45 + i * 0.85; if (i === 2) continue;
    mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 32), fur(0x3a2a22), root, [x, 2.25, 0.86], [Math.PI / 2, 0, 0]);
    mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 32), fur(0xe8c27a), root, [x, 2.25, 0.88]);
  }
  // door + ramp
  mesh(new RoundedBoxGeometry(0.7, 1.0, 0.08, 3, 0.03), fur(0x6b3f22), root, [0.25, 2.03, 0.87]);
  const ramp = mesh(new RoundedBoxGeometry(0.85, 0.07, 3.2, 3, 0.03), new THREE.MeshPhysicalMaterial({ map: plankTexture('#a06a3c', '#b07646', '#5e3519', [0.4, 1.6]), roughness: 0.8 }), root, [0.25, 0.83, 2.25], [0.55, 0, 0]);
  void ramp;
  return root;
}

// ---------- the Light (represents the prophet; no figure is shown) ----------
function radial(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function raysTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.translate(256, 256);
  for (let i = 0; i < 16; i++) {
    g.rotate(TAU / 16);
    const len = i % 2 ? 170 : 250, gr = g.createLinearGradient(0, 0, 0, -len);
    gr.addColorStop(0, 'rgba(255,240,200,0.55)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-10, 0); g.lineTo(0, -len); g.lineTo(10, 0); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function holyLight(scene) {
  const root = group(null);
  const add = (map, scale, opacity) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    sp.scale.setScalar(scale); root.add(sp); return sp;
  };
  const glow = radial([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,246,220,0.95)'], [0.45, 'rgba(255,214,140,0.35)'], [1, 'rgba(255,200,120,0)']]);
  root.userData.halo = add(radial([[0, 'rgba(255,230,170,0.5)'], [0.5, 'rgba(255,210,140,0.15)'], [1, 'rgba(255,200,120,0)']]), 3.4, 0.45);
  root.userData.rays = add(raysTexture(), 2.4, 0.35);
  root.userData.glow = add(glow, 1.15, 0.85);
  const core = new THREE.Mesh(S(0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.4, 1.15), toneMapped: false }));
  root.add(core);
  // soft column of light down to the ground
  const colTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(0.55, 'rgba(255,236,190,0.6)'); gr.addColorStop(1, 'rgba(255,236,190,0.15)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 2.6, 40, 1, true),
    new THREE.MeshBasicMaterial({ map: colTex, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  col.position.y = -0.2; root.add(col);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48), new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = -1.48; root.add(pool);
  root.userData.sparkles = [];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.2, 0.9), toneMapped: false }));
    const a = i * 2.4, r = 0.45 + (i % 5) * 0.14;
    m.position.set(Math.cos(a) * r, -1.2 + (i % 9) * 0.3, Math.sin(a) * r); root.add(m); root.userData.sparkles.push(m);
  }
  const pl = new THREE.PointLight(0xffd9a0, 6, 7, 1.6); root.add(pl);
  root.userData.light = pl;
  if (scene) scene.add(root);
  return root;
}
