// Kult World 3D models. Every object in the world is a named SLOT. Until a
// real model exists, the slot is built procedurally here (stylized low-poly
// placeholders). To swap in final art, drop `public/models/<slot>.glb` and list
// it in `public/models/manifest.json` (see docs/MODELS.md); the world loads it
// instead and scales it to the slot's footprint.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// 1 tile = T world units.
export const T = 2;

// ------------------------------------------------------------------ slots (also the model brief)
export const SLOTS = {
  "bld-business-park": { label: "Kult Business Park HQ", size: [9, 8], height: 15 },
  "bld-arcade": { label: "Kult Arcade", size: [9, 9], height: 9 },
  "holo-dex": { label: "Kult Dex tower (coming soon)", size: [6, 6], height: 22 },
  "holo-production": { label: "Kult Production studio (coming soon)", size: [6, 7], height: 15 },
  "fountain": { label: "KULT crystal fountain", size: [4.4, 4.4], height: 6 },
  "spawn-pad": { label: "Spawn pad", size: [2.4, 2.4], height: 0.4 },
  "tree": { label: "Round tree", size: [1.6, 1.6], height: 4 },
  "pine": { label: "Pine tree", size: [1.4, 1.4], height: 5 },
  "blossom": { label: "Neon blossom tree", size: [2, 2], height: 4.6 },
  "bush": { label: "Bush", size: [1.2, 1.2], height: 1.2 },
  "flowers": { label: "Flower bed", size: [1.2, 1.2], height: 0.5 },
  "lamp": { label: "Street lamp", size: [0.5, 0.5], height: 4.4 },
  "bench": { label: "Bench", size: [1.4, 0.6], height: 0.9 },
  "billboard": { label: "Holo billboard", size: [4, 0.6], height: 7 },
  "car": { label: "Parked hover car", size: [1.8, 0.9], height: 0.9 },
  "crane": { label: "Construction crane", size: [2, 2], height: 20 },
  "agent": { label: "Agent character (rigged)", size: [0.9, 0.9], height: 2.3 }
};

// ------------------------------------------------------------------ shared materials & textures
const mats = new Map();
export function mat(key, make) { if (!mats.has(key)) mats.set(key, make()); return mats.get(key); }
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, flatShading: true, ...o });
const glow = (color, intensity = 2.2) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: color, emissiveIntensity: intensity, roughness: 1 });
export const M = {
  stone: () => mat("stone", () => std("#5a5288")),
  stoneDark: () => mat("stoneDark", () => std("#2c2650")),
  glass: () => mat("glass", () => new THREE.MeshStandardMaterial({ color: "#1b2a5a", roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 })),
  frame: () => mat("frame", () => std("#231d45", { roughness: 0.5, metalness: 0.4 })),
  trunk: () => mat("trunk", () => std("#4a2f2a")),
  leaf: (c) => mat(`leaf${c}`, () => std(c, { roughness: 0.9 })),
  glow: (c, i = 2.2) => mat(`glow${c}${i}`, () => glow(c, i)),
  metal: () => mat("metal", () => std("#3a3560", { metalness: 0.6, roughness: 0.4 })),
  gold: () => mat("gold", () => std("#c9962e", { metalness: 0.8, roughness: 0.3, emissive: "#3a2400", emissiveIntensity: 0.4 }))
};

// Canvas helpers.
function canvasTex(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Lit-window facade: returns { map, emissiveMap }.
function facade(cols, rows, { base = "#141230", frame = "#2a2350", lit = ["#ffd98a", "#ffe9b8", "#9fe8ff"], dark = "#0c0a20", p = 0.62, seed = 1 } = {}) {
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push(r() < p ? lit[Math.floor(r() * lit.length)] : null);
  const draw = (emissive) => (g, w, h) => {
    g.fillStyle = emissive ? "#000" : base; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / rows;
    cells.forEach((c, i) => {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      if (!emissive) { g.fillStyle = frame; g.fillRect(x, y, cw, ch); }
      g.fillStyle = c ? c : (emissive ? "#000" : dark);
      g.fillRect(x + cw * 0.14, y + ch * 0.18, cw * 0.72, ch * 0.62);
    });
  };
  return { map: canvasTex(256, 256, draw(false)), emissiveMap: canvasTex(256, 256, draw(true)) };
}
// Emissive text sign.
export function signTexture(lines, { w = 1024, h = 256, colors = ["#ff7eb6", "#4fd8ff"], bg = null, font = "Chakra Petch" } = {}) {
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((t, i) => {
      const size = i === 0 ? h * 0.46 : h * 0.24;
      g.font = `700 ${size}px "${font}", system-ui, sans-serif`;
      g.shadowColor = colors[i % colors.length]; g.shadowBlur = h * 0.08;
      g.fillStyle = colors[i % colors.length];
      g.fillText(t, w / 2, lines.length === 1 ? h / 2 : i === 0 ? h * 0.36 : h * 0.78);
    });
  });
}
// Soft radial glow sprite (light pools, halos).
export const glowTexture = (() => { let t; return () => t || (t = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); })); })();

// Ground light pool (additive decal).
export function lightPool(color, radius = 2.2, opacity = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 1;
  return m;
}

const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; return o; };
const cyl = (rt, rb, h, m, seg = 8, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; return o; };
const ico = (r, m, x = 0, y = 0, z = 0, detail = 0) => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };

// ------------------------------------------------------------------ buildings
// All buildings are built centred on the origin, entrance facing +Z.
function businessPark() {
  const g = new THREE.Group(), W = 9 * T * 0.92, D = 8 * T * 0.9;
  // Podium (lobby) with glass front and gold canopy.
  g.add(box(W, 3, D, M.frame()));
  const lobby = box(W * 0.6, 2.6, 0.2, M.glow("#ffd98a", 0.9), 0, 0, D / 2 + 0.05); g.add(lobby);
  g.add(box(W * 0.36, 0.35, 2.4, M.gold(), 0, 3.0, D / 2 + 0.9));
  g.add(box(W * 0.36, 0.08, 2.4, M.glow("#ffc94d", 3), 0, 2.94, D / 2 + 0.9));
  // Main tower: two stepped blocks of lit windows.
  const f1 = facade(10, 12, { seed: 3, p: 0.42, lit: ["#e8a94a", "#f0c070", "#5ab8d8"] }), f2 = facade(7, 8, { seed: 8, p: 0.45, lit: ["#5ab8d8", "#e8a94a"] });
  const towerMat = new THREE.MeshStandardMaterial({ map: f1.map, emissiveMap: f1.emissiveMap, emissive: "#ffffff", emissiveIntensity: 0.75, roughness: 0.35, metalness: 0.4 });
  const tower = box(W * 0.78, 16, D * 0.7, towerMat, -W * 0.06, 3, -D * 0.08); g.add(tower);
  const wing = box(W * 0.42, 9, D * 0.5, new THREE.MeshStandardMaterial({ map: f2.map, emissiveMap: f2.emissiveMap, emissive: "#ffffff", emissiveIntensity: 0.75, roughness: 0.35, metalness: 0.4 }), W * 0.28, 3, D * 0.18); g.add(wing);
  // Neon trims and roof crown.
  for (const [w, y, d, x, z] of [[W * 0.8, 19, D * 0.72, -W * 0.06, -D * 0.08], [W * 0.44, 12, D * 0.52, W * 0.28, D * 0.18]]) {
    g.add(box(w, 0.18, 0.18, M.glow("#ffc94d", 2.6), x, y - 0.1, z + d / 2));
    g.add(box(0.18, 0.18, d, M.glow("#ffc94d", 2.6), x + w / 2, y - 0.1, z));
  }
  g.add(box(W * 0.5, 1.2, D * 0.4, M.frame(), -W * 0.06, 19, -D * 0.08));
  g.add(cyl(0.12, 0.12, 4, M.metal(), 4, -W * 0.2, 20.2, -D * 0.12));
  g.add(ico(0.35, M.glow("#ff4fa3", 4), -W * 0.2, 24.3, -D * 0.12));
  // Vertical cyan light strips on the corners.
  for (const sx of [-1, 1]) g.add(box(0.14, 15.6, 0.14, M.glow("#4fd8ff", 2.4), -W * 0.06 + sx * W * 0.39, 3.2, -D * 0.08 + D * 0.35 + 0.02));
  // Rooftop sign.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.95, W * 0.24), new THREE.MeshBasicMaterial({ map: signTexture(["KULT", "BUSINESS PARK"], { colors: ["#ffc94d", "#4fd8ff"] }), transparent: true, depthWrite: false }));
  sign.position.set(0, 21.6, D * 0.3); g.add(sign);
  g.add(box(W * 0.9, W * 0.2, 0.3, M.frame(), 0, 21.6 - W * 0.1, D * 0.3 - 0.25));
  // Planters by the entrance.
  for (const sx of [-1, 1]) { g.add(box(1.4, 0.8, 1.4, M.stoneDark(), sx * W * 0.3, 0, D / 2 + 1.2)); g.add(ico(0.8, M.leaf("#2f8f6a"), sx * W * 0.3, 1.5, D / 2 + 1.2)); }
  g.userData.door = new THREE.Vector3(0, 1.4, D / 2 + 0.3);
  g.userData.anim = (t) => { towerMat.emissiveIntensity = 0.72 + Math.sin(t * 0.7) * 0.05; };
  return g;
}

function arcade() {
  const g = new THREE.Group(), W = 9 * T * 0.92, D = 9 * T * 0.88;
  const wall = std("#2a1650", { roughness: 0.6 });
  g.add(box(W, 7, D, wall));
  g.add(box(W + 0.4, 0.6, D + 0.4, M.frame(), 0, 7));
  // Marquee: chasing bulbs along the front and side top edges.
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), new THREE.MeshBasicMaterial({ color: "#ffffff" }), 64);
  const tmp = new THREE.Object3D(), cols = [];
  for (let i = 0; i < 64; i++) {
    const u = i / 40;
    if (i < 40) tmp.position.set(-W / 2 + u * W, 7.3, D / 2 + 0.25); else tmp.position.set(W / 2 + 0.25, 7.3, D / 2 - ((i - 40) / 24) * D);
    tmp.updateMatrix(); bulbs.setMatrixAt(i, tmp.matrix); cols.push(new THREE.Color());
  }
  g.add(bulbs);
  // Arched neon entrance.
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.16, 8, 24, Math.PI), M.glow("#ff4fa3", 3.2)); arch.position.set(-W * 0.18, 3.3, D / 2 + 0.12); g.add(arch);
  g.add(box(4.4, 3.3, 0.15, M.glow("#ffb3d4", 0.9), -W * 0.18, 0, D / 2 + 0.06));
  g.add(box(4.4, 0.12, 0.2, M.glow("#4fd8ff", 2.6), -W * 0.18, 0.05, D / 2 + 0.3));
  // Round neon windows on the right of the front.
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 6, 24), M.glow(i ? "#4fd8ff" : "#ff7eb6", 3)); ring.position.set(W * 0.12 + i * 3.4, 3.4, D / 2 + 0.1); g.add(ring);
    const pane = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), M.glow(i ? "#3b2c8f" : "#7a2c8f", 1.1)); pane.position.set(W * 0.12 + i * 3.4, 3.4, D / 2 + 0.05); g.add(pane);
  }
  // Side neon stripes.
  g.add(box(0.12, 0.12, D, M.glow("#4fd8ff", 2.6), W / 2 + 0.06, 1.2, 0));
  g.add(box(W, 0.12, 0.12, M.glow("#4fd8ff", 2.6), 0, 1.2, D / 2 + 0.06));
  // Rooftop: giant arcade joystick and sign.
  g.add(cyl(1.8, 2.2, 1, M.frame(), 8, W * 0.25, 7.6, -D * 0.15));
  g.add(cyl(0.22, 0.22, 3, M.metal(), 8, W * 0.25, 8.6, -D * 0.15));
  const knob = ico(1, M.glow("#ff4fa3", 2.2), W * 0.25, 12, -D * 0.15, 1); g.add(knob);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, W * 0.22), new THREE.MeshBasicMaterial({ map: signTexture(["KULT", "ARCADE"], { colors: ["#4fd8ff", "#ff4fa3"] }), transparent: true, depthWrite: false }));
  sign.position.set(-W * 0.12, 10.4, D * 0.3); g.add(sign);
  g.add(box(W * 0.74, W * 0.19, 0.3, M.frame(), -W * 0.12, 10.4 - W * 0.095, D * 0.3 - 0.25));
  g.add(box(0.2, 2.6, 0.2, M.metal(), -W * 0.42, 7.6, D * 0.3)); g.add(box(0.2, 2.6, 0.2, M.metal(), W * 0.18, 7.6, D * 0.3));
  g.userData.door = new THREE.Vector3(-W * 0.18, 1.4, D / 2 + 0.3);
  g.userData.anim = (t) => {
    for (let i = 0; i < 64; i++) { const on = (Math.floor(t * 8) + i) % 3 === 0; cols[i].set(on ? "#ffe27a" : "#6a4416"); bulbs.setColorAt(i, cols[i]); }
    bulbs.instanceColor.needsUpdate = true;
    knob.position.y = 12 + Math.sin(t * 2) * 0.15;
    arch.material.emissiveIntensity = 2.6 + Math.sin(t * 5) * 0.6;
  };
  return g;
}

// Wireframe hologram of a future building.
function hologram(name, h, color, [w, d]) {
  const g = new THREE.Group(), W = w * T * 0.9, D = d * T * 0.9;
  const floors = Math.round(h / 3);
  const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const line = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
  for (let i = 0; i < floors; i++) {
    const s = 1 - (i / floors) * 0.25, geo = new THREE.BoxGeometry(W * s, 3, D * s);
    const m = new THREE.Mesh(geo, fill); m.position.y = i * 3 + 1.5; g.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), line); e.position.y = i * 3 + 1.5; g.add(e);
  }
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.1, D * 1.1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  scan.rotation.x = -Math.PI / 2; g.add(scan);
  g.add(box(W * 1.05, 0.4, D * 1.05, M.stoneDark()));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: signTexture([name, "COMING SOON"], { colors: [color, "#ffc94d"] }), transparent: true, depthWrite: false }));
  label.position.set(0, floors * 3 + 2.4, 0); g.add(label);
  g.userData.anim = (t) => { scan.position.y = ((t * 3) % (floors * 3)); line.opacity = 0.6 + Math.sin(t * 9) * 0.1 + (Math.random() < 0.02 ? -0.4 : 0); label.position.y = floors * 3 + 2.4 + Math.sin(t * 1.4) * 0.3; };
  g.userData.billboard = label;
  return g;
}

// ------------------------------------------------------------------ plaza pieces
function fountain() {
  const g = new THREE.Group();
  g.add(cyl(4.2, 4.5, 0.8, M.stone(), 16));
  g.add(cyl(3.6, 3.6, 0.82, M.stoneDark(), 16));
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.1, 32), new THREE.MeshStandardMaterial({ color: "#1a6fb0", emissive: "#2aa8ff", emissiveIntensity: 0.7, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.9 }));
  water.position.y = 0.72; g.add(water);
  g.add(cyl(0.9, 1.3, 2.2, M.stone(), 8, 0, 0.6));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 6, 32), M.glow("#4fd8ff", 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 3.2; g.add(ring);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: "#ff9ccf", emissive: "#ff4fa3", emissiveIntensity: 1.8, roughness: 0.15, metalness: 0.2, flatShading: true }));
  crystal.scale.set(0.8, 1.5, 0.8); crystal.position.y = 4.6; crystal.castShadow = true; g.add(crystal);
  const shards = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), M.glow(i % 2 ? "#4fd8ff" : "#ff7eb6", 3)); g.add(s); shards.push(s); }
  const light = new THREE.PointLight("#ff4fa3", 30, 16, 1.6); light.position.y = 4.6; g.add(light);
  g.userData.anim = (t) => {
    crystal.rotation.y = t * 0.6; crystal.position.y = 4.6 + Math.sin(t * 1.6) * 0.25;
    shards.forEach((s, i) => { const a = t * 0.9 + (i / 4) * Math.PI * 2; s.position.set(Math.cos(a) * 1.9, 4.4 + Math.sin(t * 2 + i) * 0.4, Math.sin(a) * 1.9); s.rotation.y = t * 2; });
    ring.rotation.z = t * 0.4; water.material.emissiveIntensity = 0.6 + Math.sin(t * 2.2) * 0.15;
  };
  return g;
}

function spawnPad() {
  const g = new THREE.Group();
  g.add(cyl(2.3, 2.5, 0.3, M.frame(), 6));
  const tex = canvasTex(256, 256, (c) => { c.clearRect(0, 0, 256, 256); c.strokeStyle = "#4fd8ff"; c.lineWidth = 10; c.shadowColor = "#4fd8ff"; c.shadowBlur = 16; c.beginPath(); c.arc(128, 128, 96, 0, Math.PI * 2); c.stroke(); c.strokeStyle = "#ff7eb6"; c.lineWidth = 6; c.beginPath(); c.arc(128, 128, 62, 0, Math.PI * 2); c.stroke(); });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.32; g.add(disc);
  g.userData.anim = (t) => { disc.rotation.z = t * 0.5; disc.material.opacity = 0.7 + Math.sin(t * 3) * 0.3; };
  return g;
}

// ------------------------------------------------------------------ props
function tree(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.18, 0.28, 1.6, M.trunk(), 6));
  const shades = ["#1f7a5c", "#2a9468", "#36a874"];
  [[0, 2.3, 0, 1.15], [-0.5, 2.0, 0.3, 0.8], [0.45, 2.1, -0.3, 0.8], [0.1, 3.1, 0, 0.8]].forEach(([x, y, z, r], i) => g.add(ico(r, M.leaf(shades[i % 3]), x, y, z)));
  g.scale.setScalar(s);
  return g;
}
function pine(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.15, 0.22, 1.2, M.trunk(), 6));
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.25, 1.6, 7), M.leaf(["#1b6650", "#227a5d", "#2b8f68"][i])); c.position.y = 1.6 + i * 0.9; c.castShadow = true; g.add(c); }
  g.scale.setScalar(s);
  return g;
}
function blossom(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.3, 1.8, M.trunk(), 6));
  [[0, 2.6, 0, 1.25, "#ff8cc6"], [-0.6, 2.2, 0.3, 0.85, "#ff6fb1"], [0.55, 2.3, -0.3, 0.85, "#ffa6d6"], [0, 3.4, 0.1, 0.8, "#ffb8de"]].forEach(([x, y, z, r, c]) => g.add(ico(r, std(c, { emissive: c, emissiveIntensity: 0.25 }), x, y, z)));
  g.scale.setScalar(s);
  return g;
}
function bush(s = 1) { const g = new THREE.Group(); const b = ico(0.75, M.leaf("#2a8a63"), 0, 0.5, 0); b.scale.y = 0.75; g.add(b); g.add(ico(0.45, M.leaf("#36a874"), 0.45, 0.45, 0.2)); g.scale.setScalar(s); return g; }
function flowers() {
  const g = new THREE.Group();
  g.add(box(1.3, 0.3, 1.3, M.stoneDark()));
  const cs = ["#ff7eb6", "#ffc94d", "#4fd8ff", "#c79bff"];
  for (let i = 0; i < 9; i++) g.add(ico(0.13, M.glow(cs[i % 4], 0.9), -0.4 + (i % 3) * 0.4, 0.42, -0.4 + Math.floor(i / 3) * 0.4));
  return g;
}
function lamp(color = "#ffd27a") {
  const g = new THREE.Group();
  g.add(cyl(0.22, 0.28, 0.3, M.frame(), 6));
  g.add(cyl(0.07, 0.09, 4, M.frame(), 6, 0, 0.3));
  g.add(box(0.9, 0.1, 0.1, M.frame(), 0.35, 4.2));
  const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.25, 4, 8), M.glow(color, 3.4)); bulb.position.set(0.72, 3.95, 0); g.add(bulb);
  const pool = lightPool(color, 2.4, 0.55); pool.position.x = 0.72; g.add(pool);
  return g;
}
function bench() {
  const g = new THREE.Group(), wood = std("#7a4a34");
  g.add(box(1.5, 0.12, 0.5, wood, 0, 0.45)); g.add(box(1.5, 0.45, 0.1, wood, 0, 0.6, -0.22));
  for (const x of [-0.6, 0.6]) g.add(box(0.1, 0.45, 0.45, M.frame(), x, 0));
  return g;
}
const ADS = [["AI ARENA", "BATTLE NOW"], ["KULT CREATE", "BUILD GAMES"], ["KULT SPORTS", "MATCHDAY LIVE"], ["$ARENA", "WIN · EARN"]];
function billboard(ad = 0) {
  const g = new THREE.Group();
  for (const x of [-1.6, 1.6]) g.add(cyl(0.12, 0.12, 4.2, M.metal(), 6, x, 0));
  g.add(box(4.4, 2.5, 0.25, M.frame(), 0, 4));
  const tex = ADS.map((a, i) => signTexture(a, { colors: [["#ff4fa3", "#4fd8ff", "#7ee081", "#ffc94d"][i], "#ffffff"], bg: "#0b0717" }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.2), new THREE.MeshBasicMaterial({ map: tex[ad % 4], toneMapped: false }));
  screen.position.set(0, 5.25, 0.14); g.add(screen);
  let cur = ad % 4;
  g.userData.anim = (t) => { const k = (ad + Math.floor(t / 4)) % 4; if (k !== cur) { cur = k; screen.material.map = tex[k]; } screen.material.color.setScalar(0.85 + Math.sin(t * 6) * 0.05); };
  return g;
}
export function hoverCar(color = "#ff4fa3") {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 4, 8), std(color, { metalness: 0.5, roughness: 0.3 })); body.rotation.z = Math.PI / 2; body.position.y = 0.55; body.scale.set(0.8, 1, 1); body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass()); cab.position.set(-0.1, 0.78, 0); cab.scale.set(1.2, 0.8, 0.9); g.add(cab);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); under.rotation.x = -Math.PI / 2; under.position.y = 0.04; g.add(under);
  for (const z of [-0.3, 0.3]) g.add(box(0.06, 0.08, 0.14, M.glow("#ff3355", 3), -0.95, 0.5, z));
  g.userData.anim = (t) => { body.position.y = 0.55 + Math.sin(t * 2 + color.length) * 0.05; };
  return g;
}
function crane() {
  const g = new THREE.Group(), yellow = std("#e6b23a", { metalness: 0.3 });
  g.add(box(1.6, 0.6, 1.6, M.stoneDark()));
  g.add(box(0.7, 18, 0.7, yellow, 0, 0.6));
  const top = new THREE.Group(); top.position.y = 18.6; g.add(top);
  top.add(box(14, 0.5, 0.6, yellow, 4, 0)); top.add(box(2, 1.2, 1.2, M.frame(), -2.5, -0.3));
  top.add(box(0.06, 6, 0.06, M.metal(), 8, -6)); top.add(box(1.2, 1, 1.2, std("#4fd8ff", { emissive: "#4fd8ff", emissiveIntensity: 0.4 }), 8, -7));
  const beacon = ico(0.22, M.glow("#ff3355", 4), 0, 1.2, 0); top.add(beacon);
  g.userData.anim = (t) => { top.rotation.y = Math.sin(t * 0.15) * 1.2; beacon.visible = Math.floor(t * 2) % 2 === 0; };
  return g;
}

// ------------------------------------------------------------------ agent (placeholder rig)
// The placeholder character is three.js's CC0 "RobotExpressive" (rigged, with
// Idle/Walking/Running/Wave/Dance clips), tinted per archetype. If it cannot
// load, a capsule bot is used.
export const AGENT_PLACEHOLDER_URL = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/RobotExpressive/RobotExpressive.glb";
export function capsuleAgent(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), std(color, { flatShading: false, roughness: 0.4, metalness: 0.2 })); body.position.y = 0.95; body.castShadow = true; g.add(body);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.2), M.glow("#9fe8ff", 2.5)); visor.position.set(0, 1.45, 0.36); g.add(visor);
  return g;
}

// ------------------------------------------------------------------ registry
const BUILDERS = {
  "bld-business-park": businessPark, "bld-arcade": arcade,
  "holo-dex": () => hologram("KULT DEX", 22, "#4fd8ff", SLOTS["holo-dex"].size),
  "holo-production": () => hologram("KULT PRODUCTION", 15, "#ff7eb6", SLOTS["holo-production"].size),
  fountain, "spawn-pad": spawnPad, tree, pine, blossom, bush, flowers, lamp, bench, billboard, car: hoverCar, crane
};

// Real models listed in public/models/manifest.json ({ "slot": "file.glb", ... }).
let provided = {};
const gltf = new GLTFLoader();
const cache = new Map();
export async function loadProvided() {
  try { provided = await fetch(`models/manifest.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : {})); }
  catch { provided = {}; }
  return provided;
}
export function loadGLB(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => gltf.load(url, res, undefined, rej)));
  return cache.get(url);
}
// Scale a loaded model so its footprint fits the slot, feet on y=0, centred.
function fit(obj, slot) {
  obj.updateMatrixWorld(true);
  const s = SLOTS[slot], b = new THREE.Box3().setFromObject(obj), size = b.getSize(new THREE.Vector3());
  const k = Math.min((s.size[0] * T) / Math.max(size.x, 1e-3), (s.size[1] * T) / Math.max(size.z, 1e-3), s.height / Math.max(size.y, 1e-3) * 1.4);
  obj.scale.multiplyScalar(k);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  const g = new THREE.Group(); g.add(obj); return g;
}

// Build a slot: the provided GLB if there is one, otherwise the placeholder.
// Returns a Group immediately; a GLB replaces the placeholder when it loads.
export function build(slot, ...args) {
  const holder = new THREE.Group();
  const placeholder = BUILDERS[slot](...args);
  holder.add(placeholder);
  holder.userData.anim = placeholder.userData.anim;
  holder.userData.door = placeholder.userData.door;
  holder.userData.slot = slot;
  if (provided[slot]) {
    loadGLB(`models/${provided[slot]}`).then((gl) => {
      const m = fit(gl.scene.clone(true), slot);
      holder.remove(placeholder); holder.add(m);
      holder.userData.anim = null;
      if (gl.animations?.length) { const mixer = new THREE.AnimationMixer(m); gl.animations.forEach((a) => mixer.clipAction(a).play()); holder.userData.anim = (t, dt) => mixer.update(dt); }
    }).catch((e) => console.warn(`[models] ${slot}: ${e?.message || e}; keeping placeholder`));
  }
  return holder;
}
export const providedModel = (slot) => provided[slot] || null;
