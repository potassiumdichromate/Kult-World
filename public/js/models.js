// Kult World 3D models. Every object in the world is a named SLOT. Until a
// real model exists, the slot is built procedurally here (stylized low-poly
// placeholders). To swap in final art, drop `public/models/<file>.glb` and list
// it in `public/models/manifest.json` as { "<slot>": "<file>.glb" } (see
// docs/MODELS.md); the world loads it instead and scales it to the slot.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// 1 tile = T world units (metres).
export const T = 2;

// ------------------------------------------------------------------ slots (also the model brief)
export const SLOTS = {
  "bld-gaming-studio": { size: [7, 6], height: 13 },
  "bld-sports": { size: [7, 8], height: 15 },
  "bld-dex": { size: [7, 8], height: 26 },
  "bld-film": { size: [7, 6], height: 11 },
  "campus-gate": { size: [3, 1], height: 8 },
  "monument": { size: [2, 2], height: 6 },
  "bld-game-hub": { size: [10, 11], height: 14 },
  "bld-deal-room": { size: [7, 8], height: 20 },
  "bld-marketplace": { size: [16, 10], height: 11 },
  "fountain": { size: [4.4, 4.4], height: 6 },
  "spawn-pad": { size: [2.4, 2.4], height: 0.4 },
  "tree": { size: [1.6, 1.6], height: 4 },
  "pine": { size: [1.4, 1.4], height: 5 },
  "blossom": { size: [2, 2], height: 4.6 },
  "bush": { size: [1.2, 1.2], height: 1.2 },
  "flowers": { size: [1.2, 1.2], height: 0.5 },
  "lamp": { size: [0.5, 0.5], height: 4.4 },
  "bench": { size: [1.4, 0.6], height: 0.9 },
  "billboard": { size: [4, 0.6], height: 7 },
  "car": { size: [1.8, 0.9], height: 0.9 },
  "crane": { size: [2, 2], height: 20 },
  "agent": { size: [0.9, 0.9], height: 2.3 }
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
  obsidian: () => mat("obsidian", () => std("#120e24", { roughness: 0.18, metalness: 0.85, flatShading: false })),
  trunk: () => mat("trunk", () => std("#4a2f2a")),
  leaf: (c) => mat(`leaf${c}`, () => std(c, { roughness: 0.9 })),
  glow: (c, i = 2.2) => mat(`glow${c}${i}`, () => glow(c, i)),
  metal: () => mat("metal", () => std("#3a3560", { metalness: 0.6, roughness: 0.4 })),
  gold: () => mat("gold", () => std("#d2a03a", { metalness: 0.85, roughness: 0.28, emissive: "#3a2400", emissiveIntensity: 0.5 }))
};

function canvasTex(w, h, draw, { srgb = true } = {}) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Animated canvas screen: draw(g, w, h, t) is called ~12 times a second.
function liveScreen(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  let last = -1;
  return { tex, tick: (t) => { if (t - last < 0.08) return; last = t; draw(g, w, h, t); tex.needsUpdate = true; } };
}
// Lit-window facade: returns { map, emissiveMap }.
function facade(cols, rows, { base = "#141230", frame = "#2a2350", lit = ["#e8a94a", "#f0c070", "#5ab8d8"], dark = "#0c0a20", p = 0.45, seed = 1 } = {}) {
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
const facadeMat = (cols, rows, o) => { const f = facade(cols, rows, o); return new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissiveMap, emissive: "#ffffff", emissiveIntensity: 0.75, roughness: 0.35, metalness: 0.4 }); };

// ------------------------------------------------------------------ signs (translatable)
const FONT = `"Chakra Petch", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
export function signTexture(lines, { w = 1024, h = 256, colors = ["#ff7eb6", "#4fd8ff"], bg = null } = {}) {
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((t, i) => {
      let size = i === 0 ? h * 0.46 : h * 0.24;
      g.font = `700 ${size}px ${FONT}`;
      while (g.measureText(t).width > w * 0.94 && size > 10) { size *= 0.92; g.font = `700 ${size}px ${FONT}`; }
      g.shadowColor = colors[i % colors.length]; g.shadowBlur = h * 0.08;
      g.fillStyle = colors[i % colors.length];
      g.fillText(t, w / 2, lines.length === 1 ? h / 2 : i === 0 ? h * 0.36 : h * 0.78);
    });
  });
}
// Lines are strings or [i18nKey, english]; signs re-render on language change.
let tr = (k, en) => en;
const signs = new Set();
export function setSignTranslator(fn) { tr = fn; for (const s of signs) s(); }
export function sign(lines, width, height, opts = {}) {
  const m = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), m);
  const refresh = () => { m.map?.dispose(); m.map = signTexture(lines.map((l) => (Array.isArray(l) ? tr(l[0], l[1]) : l)), { w: 1024, h: Math.round(1024 * (height / width)), ...opts }); m.needsUpdate = true; };
  refresh(); signs.add(refresh);
  return mesh;
}
export const glowTexture = (() => { let t; return () => t || (t = canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.45)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); })); })();
export function lightPool(color, radius = 2.2, opacity = 0.5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 1;
  return m;
}
// Additive light cone (searchlights, floodlights).
function beamCone(color, len = 14, r = 2.2, opacity = 0.16) {
  const geo = new THREE.ConeGeometry(r, len, 16, 1, true); geo.translate(0, -len / 2, 0);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
}

const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; return o; };
const cyl = (rt, rb, h, m, seg = 8, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; return o; };
const ico = (r, m, x = 0, y = 0, z = 0, detail = 0) => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o; };
const edgeGlow = (g, w, d, y, color, x = 0, z = 0) => { g.add(box(w, 0.16, 0.16, M.glow(color, 2.6), x, y, z + d / 2)); g.add(box(0.16, 0.16, d, M.glow(color, 2.6), x + w / 2, y, z)); };
const animate = (g, f) => { const prev = g.userData.anim; g.userData.anim = prev ? (t, dt) => { prev(t, dt); f(t, dt); } : f; };

// ------------------------------------------------------------------ business park buildings
// Builders get { W, D } (footprint in metres) and build centred on the origin,
// entrance facing +Z.
function gamingStudio({ W, D }) {
  const g = new THREE.Group();
  g.add(box(W, 1, D, M.frame()));
  g.add(box(W * 0.9, 8, D * 0.72, facadeMat(9, 8, { seed: 4, lit: ["#ff8cc6", "#9fe8ff", "#f0c070"] }), 0, 1, -D * 0.06));
  g.add(box(W * 0.62, 3.6, D * 0.6, facadeMat(6, 3, { seed: 9, lit: ["#ff8cc6", "#ffd98a"] }), W * 0.14, 9, -D * 0.1));
  edgeGlow(g, W * 0.9, D * 0.72, 9, "#ff4fa3", 0, -D * 0.06); edgeGlow(g, W * 0.62, D * 0.6, 12.6, "#4fd8ff", W * 0.14, -D * 0.1);
  // Giant LED screen with a little shooter playing on it.
  const scr = liveScreen(256, 128, (c, w, h, t) => {
    c.fillStyle = "#0a0420"; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { c.fillStyle = "rgba(255,255,255,0.5)"; c.fillRect((i * 53 + t * 40) % w, (i * 31) % h, 2, 2); }
    for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { c.fillStyle = ["#ff4fa3", "#4fd8ff", "#ffc94d"][r]; c.fillRect(30 + i * 28 + Math.sin(t * 2) * 14, 16 + r * 18, 16, 10); }
    const sx = w / 2 + Math.sin(t * 1.3) * 80; c.fillStyle = "#7ef0a6"; c.fillRect(sx - 10, h - 22, 20, 10); c.fillRect(sx - 3, h - 28, 6, 6);
    c.fillStyle = "#fff"; c.fillRect(sx - 1, h - 40 - ((t * 120) % 70), 2, 8);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.56, W * 0.28), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  screen.position.set(-W * 0.12, 4.6, D * 0.3 + 0.05); g.add(screen);
  g.add(box(W * 0.6, 0.2, 0.2, M.glow("#ff4fa3", 3), -W * 0.12, 2.3, D * 0.3 + 0.08));
  const s = sign([["sign.create", "GAMING STUDIO"], "KULT CREATE"], W * 0.7, W * 0.17, { colors: ["#ff7eb6", "#ffffff"] }); s.position.set(W * 0.14, 14, D * 0.2 + 0.05); g.add(s);
  const pad = ico(0.9, M.glow("#ff4fa3", 2.5), W * 0.3, 14.6, -D * 0.1, 0); g.add(pad);
  animate(g, (t) => { scr.tick(t); pad.rotation.y = t; pad.position.y = 14.6 + Math.sin(t * 2) * 0.2; });
  return g;
}

function sportsAgency({ W, D }) {
  const g = new THREE.Group();
  g.add(box(W, 1, D, M.frame()));
  g.add(box(W * 0.86, 9, D * 0.74, facadeMat(9, 8, { seed: 6, lit: ["#7ef0a6", "#f0f0e0", "#5ab8d8"] }), 0, 1));
  // Stadium-style glass roof with glowing ribs.
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(D * 0.37, D * 0.37, W * 0.86, 20, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: "#1c6a4c", emissive: "#2aa86e", emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.9 }));
  roof.rotation.z = Math.PI / 2; roof.position.y = 10; roof.scale.set(0.55, 1, 1); g.add(roof);
  for (let i = -3; i <= 3; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(D * 0.37, 0.08, 4, 20, Math.PI), M.glow("#7ef0a6", 2)); rib.position.set(i * W * 0.12, 10, 0); rib.rotation.y = Math.PI / 2; rib.scale.set(1, 0.55, 1); g.add(rib); }
  // Floodlight masts with sweeping beams.
  const beams = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    g.add(cyl(0.12, 0.16, 6, M.metal(), 6, sx * W * 0.4, 10, sz * D * 0.33));
    g.add(box(1.2, 0.6, 0.3, M.glow("#ffffff", 3.5), sx * W * 0.4, 16, sz * D * 0.33));
    const b = beamCone("#e8fff0", 14, 2, 0.05); b.position.set(sx * W * 0.4, 16, sz * D * 0.33); b.rotation.z = sx * 0.7; g.add(b); beams.push([b, sx]);
  }
  // Live score ticker.
  const scr = liveScreen(512, 64, (c, w, h, t) => {
    c.fillStyle = "#04140c"; c.fillRect(0, 0, w, h); c.font = `700 34px ${FONT}`; c.textBaseline = "middle";
    const msg = "ARS 2 - 1 CHE  •  LIVE 78'  •  MCI 0 - 0 LIV  •  RMA 3 - 2 BAR  •  ";
    const off = -((t * 70) % c.measureText(msg).width);
    c.fillStyle = "#7ef0a6"; c.fillText(msg + msg + msg, off, h / 2);
  });
  const tick = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, W * 0.1), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); tick.position.set(0, 8.4, D * 0.37 + 0.05); g.add(tick);
  g.add(box(W * 0.3, 2.6, 0.2, M.glow("#c8ffe0", 0.9), 0, 1, D * 0.37 + 0.05));
  const s = sign([["sign.sports", "SPORTS AGENCY"], "KULT SPORTS"], W * 0.8, W * 0.2, { colors: ["#7ef0a6", "#ffffff"] }); s.position.set(0, 14.2, D * 0.3); g.add(s);
  animate(g, (t) => { scr.tick(t); beams.forEach(([b, sx], i) => { b.rotation.z = sx * (0.5 + Math.sin(t * 0.6 + i) * 0.35); }); });
  return g;
}

function dexTower({ W, D }) {
  const g = new THREE.Group();
  g.add(box(W, 1, D, M.frame()));
  const lvls = [[0.86, 9], [0.72, 8], [0.56, 6]];
  let y = 1;
  lvls.forEach(([k, h], i) => { g.add(box(W * k, h, D * k, facadeMat(8, 8, { seed: 12 + i, lit: ["#5ab8d8", "#9fe8ff", "#3a7ad8"], p: 0.5 }), 0, y)); edgeGlow(g, W * k, D * k, y + h, "#4fd8ff"); y += h; });
  // Candlestick chart running up the front.
  const scr = liveScreen(128, 256, (c, w, h, t) => {
    c.fillStyle = "#020a14"; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const k = Math.floor(t * 3) + i, up = Math.sin(k * 1.7) > -0.2, cy = h - i * 18 + ((t * 54) % 18);
      const len = 8 + Math.abs(Math.sin(k * 2.3)) * 50, x0 = 64 + Math.sin(k * 0.6) * 24;
      c.fillStyle = up ? "#3ddc84" : "#ff4f6a"; c.fillRect(x0 - len / 2, cy - 6, len, 12); c.fillRect(x0 - len / 2 - 8, cy - 1, len + 16, 2);
    }
  });
  const chart = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.22, 14), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); chart.position.set(-W * 0.25, 9, D * 0.43 + 0.05); g.add(chart);
  // Holographic coin on top.
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 32), new THREE.MeshStandardMaterial({ color: "#000", emissive: "#4fd8ff", emissiveIntensity: 2, transparent: true, opacity: 0.8 })); coin.rotation.x = Math.PI / 2; coin.position.y = y + 3.2; g.add(coin);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.07, 6, 40), M.glow("#4fd8ff", 3)); ring.position.y = y + 3.2; ring.rotation.x = Math.PI / 2; g.add(ring);
  g.add(cyl(0.1, 0.1, 1.8, M.metal(), 6, 0, y));
  const s = sign([["sign.dex", "DEX TRADING"], "KULT DEX"], W * 0.66, W * 0.17, { colors: ["#4fd8ff", "#ffffff"] }); s.position.set(W * 0.12, 10.6, D * 0.36 + 0.05); g.add(s);
  animate(g, (t) => { scr.tick(t); coin.rotation.z = t * 1.2; coin.position.y = y + 3.2 + Math.sin(t * 1.5) * 0.3; ring.rotation.z = -t * 0.5; });
  return g;
}

function filmStudio({ W, D }) {
  const g = new THREE.Group(), wall = std("#2a1d3e");
  g.add(box(W, 1, D, M.frame()));
  g.add(box(W * 0.92, 6, D * 0.8, wall, 0, 1));
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.46, W * 0.46, D * 0.8, 20, 1, false, Math.PI / 2, Math.PI), std("#3a2a58", { flatShading: false }));
  roof.rotation.x = Math.PI / 2; roof.position.y = 7; roof.scale.set(1, 1, 0.42); g.add(roof);
  // Big hangar door "STAGE 1" and a marquee strip.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.42, 4.6), new THREE.MeshBasicMaterial({ map: signTexture(["STAGE 1"], { w: 512, h: 512, colors: ["#ffc94d"], bg: "#1a1028" }), toneMapped: false })); door.position.set(0, 3.3, D * 0.4 + 0.05); g.add(door);
  const bulbs = []; for (let i = 0; i < 18; i++) { const b = ico(0.12, M.glow("#ffe27a", 3), -W * 0.44 + (i / 17) * W * 0.88, 6.85, D * 0.4 + 0.1); g.add(b); bulbs.push(b); }
  // Searchlights sweeping the sky.
  const lights = [];
  for (const sx of [-1, 1]) { g.add(cyl(0.5, 0.6, 0.8, M.metal(), 8, sx * W * 0.36, 7, D * 0.25)); const b = beamCone("#fff1c8", 26, 1.5, 0.045); b.rotation.x = Math.PI; b.position.set(sx * W * 0.36, 7.8, D * 0.25); g.add(b); lights.push(b); }
  // Clapperboard on the roof.
  const clap = new THREE.Group(); clap.position.set(-W * 0.2, 9.8, 0); g.add(clap);
  clap.add(box(3, 2, 0.3, std("#111")));
  const arm = box(3, 0.5, 0.3, M.glow("#ffffff", 1.4)); arm.position.y = 2.2; clap.add(arm);
  const s = sign([["sign.production", "FILM PRODUCTION"], "KULT PRODUCTION"], W * 0.72, W * 0.18, { colors: ["#ffc94d", "#ffffff"] }); s.position.set(W * 0.1, 10.8, D * 0.1); g.add(s);
  animate(g, (t) => {
    bulbs.forEach((b, i) => { b.visible = (Math.floor(t * 6) + i) % 3 !== 0; });
    lights.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.5 + i * 2) * 0.5; b.rotation.x = Math.PI + Math.cos(t * 0.4 + i) * 0.3; });
    arm.rotation.z = Math.max(0, Math.sin(t * 2)) * 0.5;
  });
  return g;
}

function campusGate({ W }) {
  const g = new THREE.Group(), span = W + 1.4;
  for (const sx of [-1, 1]) { g.add(box(1, 7, 1, M.frame(), sx * span / 2)); g.add(box(0.2, 6.6, 0.2, M.glow("#ffc94d", 2.6), sx * span / 2, 0.2, 0.52)); g.add(ico(0.35, M.glow("#ffc94d", 3), sx * span / 2, 7.4, 0)); }
  g.add(box(span + 1, 1.4, 0.8, M.frame(), 0, 6.2));
  g.add(box(span + 1, 0.14, 0.14, M.glow("#ffc94d", 3), 0, 6.2, 0.45));
  const s = sign(["KULT", ["sign.park", "BUSINESS PARK"]], span + 2.4, (span + 2.4) * 0.26, { colors: ["#ffc94d", "#4fd8ff"] }); s.position.set(0, 9, 0.2); g.add(s);
  return g;
}
function monument() {
  const g = new THREE.Group();
  g.add(cyl(1.6, 1.9, 0.8, M.stone(), 8)); g.add(cyl(1.1, 1.3, 1.6, M.stoneDark(), 8, 0, 0.8));
  const k = new THREE.Group(); k.position.y = 4; g.add(k);
  k.add(box(0.5, 2.6, 0.5, M.gold(), -0.5, -1.3)); const a = box(0.45, 1.7, 0.45, M.gold(), 0.25, -0.1); a.rotation.z = -0.75; k.add(a); const b = box(0.45, 1.7, 0.45, M.gold(), 0.25, -1.8); b.rotation.z = 0.75; k.add(b);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.06, 6, 40), M.glow("#ffc94d", 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 3.4; g.add(ring);
  animate(g, (t) => { k.rotation.y = t * 0.6; k.position.y = 4 + Math.sin(t * 1.4) * 0.15; ring.scale.setScalar(1 + Math.sin(t * 2) * 0.05); });
  return g;
}

// ------------------------------------------------------------------ hub, deal room, marketplace
function gameHub({ W, D }) {
  const g = new THREE.Group(), wall = std("#2a1650", { roughness: 0.6 });
  g.add(box(W, 8, D, wall));
  g.add(box(W + 0.4, 0.6, D + 0.4, M.frame(), 0, 8));
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), new THREE.MeshBasicMaterial({ color: "#ffffff" }), 80);
  const tmp = new THREE.Object3D(), cols = [];
  for (let i = 0; i < 80; i++) {
    if (i < 48) tmp.position.set(-W / 2 + (i / 47) * W, 8.3, D / 2 + 0.25); else tmp.position.set(W / 2 + 0.25, 8.3, D / 2 - ((i - 48) / 31) * D);
    tmp.updateMatrix(); bulbs.setMatrixAt(i, tmp.matrix); cols.push(new THREE.Color());
  }
  g.add(bulbs);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.18, 8, 24, Math.PI), M.glow("#ff4fa3", 3.2)); arch.position.set(-W * 0.2, 3.6, D / 2 + 0.12); g.add(arch);
  g.add(box(4.8, 3.6, 0.15, M.glow("#ffb3d4", 0.9), -W * 0.2, 0, D / 2 + 0.06));
  // Big VS screen on the right of the entrance.
  const scr = liveScreen(256, 144, (c, w, h, t) => {
    const k = Math.floor(t / 3) % 3;
    c.fillStyle = ["#1a0630", "#06182a", "#2a0618"][k]; c.fillRect(0, 0, w, h);
    c.font = `700 52px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "#ffc94d"; c.shadowColor = "#ffc94d"; c.shadowBlur = 14; c.fillText(["VS", "LIVE", "WIN"][k], w / 2, h / 2 + Math.sin(t * 6) * 3); c.shadowBlur = 0;
    c.fillStyle = "#ff4fa3"; c.fillRect(10, 20, 40 + Math.sin(t * 3) * 10, 104); c.fillStyle = "#4fd8ff"; c.fillRect(w - 60, 20, 40 + Math.cos(t * 3) * 10, 104);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.36, W * 0.2), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); screen.position.set(W * 0.2, 4, D / 2 + 0.06); g.add(screen);
  g.add(box(0.14, 0.14, D, M.glow("#4fd8ff", 2.6), W / 2 + 0.06, 1.2, 0)); g.add(box(W, 0.14, 0.14, M.glow("#4fd8ff", 2.6), 0, 1.2, D / 2 + 0.06));
  g.add(cyl(2, 2.4, 1, M.frame(), 8, W * 0.28, 8.6, -D * 0.2));
  g.add(cyl(0.24, 0.24, 3.4, M.metal(), 8, W * 0.28, 9.6, -D * 0.2));
  const knob = ico(1.15, M.glow("#ff4fa3", 2.2), W * 0.28, 13.4, -D * 0.2, 1); g.add(knob);
  g.add(box(W * 0.6, W * 0.17, 0.3, M.frame(), -W * 0.12, 11.6 - W * 0.085, D * 0.32 - 0.25));
  const s = sign(["KULT", ["sign.hub", "GAME HUB"]], W * 0.66, W * 0.19, { colors: ["#4fd8ff", "#ff4fa3"] }); s.position.set(-W * 0.12, 11.6, D * 0.32); g.add(s);
  animate(g, (t) => {
    scr.tick(t);
    for (let i = 0; i < 80; i++) { cols[i].set((Math.floor(t * 8) + i) % 3 === 0 ? "#ffe27a" : "#6a4416"); bulbs.setColorAt(i, cols[i]); }
    bulbs.instanceColor.needsUpdate = true;
    knob.position.y = 13.4 + Math.sin(t * 2) * 0.15; arch.material.emissiveIntensity = 2.6 + Math.sin(t * 5) * 0.6;
  });
  return g;
}

function dealRoom({ W, D }) {
  const g = new THREE.Group();
  g.add(box(W, 1, D, M.frame()));
  g.add(box(W * 0.8, 14, D * 0.78, M.obsidian(), 0, 1));
  // Gold fins on the front and side.
  for (let i = 0; i < 7; i++) { g.add(box(0.18, 13.4, 0.5, M.gold(), -W * 0.36 + i * W * 0.12, 1.3, D * 0.39 + 0.2)); g.add(box(0.5, 13.4, 0.18, M.gold(), W * 0.4 + 0.2, 1.3, -D * 0.36 + i * D * 0.12)); }
  edgeGlow(g, W * 0.8, D * 0.78, 15, "#ffc94d");
  // Market ticker band.
  const scr = liveScreen(1024, 64, (c, w, h, t) => {
    c.fillStyle = "#120a02"; c.fillRect(0, 0, w, h); c.font = `700 36px ${FONT}`; c.textBaseline = "middle";
    const msg = "BTC 104,220 ▲  ETH 3,920 ▲  $ARENA 0.42 ▲  KULT 1.18 ▼  0G 0.31 ▲  SOL 212 ▲  ";
    const off = -((t * 90) % c.measureText(msg).width); c.fillStyle = "#ffc94d"; c.fillText(msg + msg + msg, off, h / 2);
  });
  const tick = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, 0.9), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false })); tick.position.set(0, 13.4, D * 0.39 + 0.45); g.add(tick);
  // Gold portal entrance.
  g.add(box(3.6, 4, 0.3, M.gold(), 0, 1, D * 0.39 + 0.3));
  g.add(box(2.8, 3.4, 0.2, M.glow("#ffd98a", 1.2), 0, 1, D * 0.39 + 0.42));
  // Interlocked rings: the handshake of a deal.
  const crown = new THREE.Group(); crown.position.y = 18.6; g.add(crown);
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.22, 10, 40), M.gold()), r2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.22, 10, 40), M.glow("#ffc94d", 2.4));
  r1.position.x = -0.9; r2.position.x = 0.9; r2.rotation.x = Math.PI / 2; crown.add(r1, r2);
  const s = sign(["KULT", ["sign.deal", "DEAL ROOM"]], W * 0.76, W * 0.2, { colors: ["#ffc94d", "#ffffff"] }); s.position.set(0, 16.8, D * 0.39 + 0.2); g.add(s);
  animate(g, (t) => { scr.tick(t); crown.rotation.y = t * 0.5; crown.position.y = 18.6 + Math.sin(t * 1.2) * 0.3; r2.rotation.y = t * 0.8; });
  return g;
}

const STALLS = ["ANALYST", "ARTIST", "TRADER", "CODER", "SCOUT", "EDITOR"];
function marketplace({ W, D }) {
  const g = new THREE.Group();
  g.add(box(W, 0.6, D, M.stone()));
  g.add(box(W * 0.96, 0.08, D * 0.96, M.glow("#4fd8ff", 0.6), 0, 0.6));
  // Columns and a wave canopy of translucent panels.
  for (const cx of [-0.44, -0.22, 0, 0.22, 0.44]) for (const cz of [-0.4, 0.4]) g.add(cyl(0.18, 0.22, 7.4, M.metal(), 8, cx * W, 0.6, cz * D));
  const panels = [];
  for (let i = 0; i < 8; i++) {
    const c = i % 2 ? "#4fd8ff" : "#ff4fa3";
    const p = new THREE.Mesh(new THREE.BoxGeometry(W / 8 + 0.2, 0.18, D * 0.92), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5, transparent: true, opacity: 0.55, roughness: 0.2 }));
    p.position.set(-W / 2 + (i + 0.5) * (W / 8), 8 + (i % 2) * 0.9, 0); p.rotation.z = i % 2 ? -0.18 : 0.18; p.castShadow = true; g.add(p); panels.push(p);
  }
  // Stalls with floating holo cards.
  const cards = [];
  STALLS.forEach((name, i) => {
    const x = -W * 0.38 + (i % 3) * W * 0.38, z = i < 3 ? -D * 0.15 : D * 0.22;
    g.add(box(2.6, 1.1, 1.2, M.frame(), x, 0.6, z)); g.add(box(2.6, 0.1, 1.3, M.glow(i % 2 ? "#4fd8ff" : "#ff7eb6", 2), x, 1.7, z));
    const card = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: signTexture([name], { w: 512, h: 256, colors: [i % 2 ? "#4fd8ff" : "#ff7eb6"], bg: "rgba(10,6,30,0.75)" }), transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    card.position.set(x, 3.4, z); g.add(card); cards.push(card);
  });
  // Holo globe in the middle.
  const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshBasicMaterial({ color: "#4fd8ff", wireframe: true, transparent: true, opacity: 0.8 })); globe.position.set(0, 4.4, 0.4); g.add(globe);
  // Entrance arch with the sign.
  for (const sx of [-1, 1]) g.add(box(0.6, 6, 0.6, M.frame(), sx * 4, 0.6, D / 2 + 0.6));
  g.add(box(9, 0.8, 0.6, M.frame(), 0, 6.2, D / 2 + 0.6)); g.add(box(9, 0.12, 0.12, M.glow("#4fd8ff", 3), 0, 6.2, D / 2 + 0.95));
  const s = sign(["KULT", ["sign.market", "AGENTIC MARKETPLACE"]], 14, 3.6, { colors: ["#4fd8ff", "#ff7eb6"] }); s.position.set(0, 8.8, D / 2 + 0.7); g.add(s);
  animate(g, (t) => {
    globe.rotation.y = t * 0.4; globe.rotation.x = Math.sin(t * 0.3) * 0.3;
    cards.forEach((c, i) => { c.position.y = 3.4 + Math.sin(t * 1.6 + i) * 0.18; c.rotation.y = Math.sin(t * 0.5 + i) * 0.4; });
    panels.forEach((p, i) => { p.material.emissiveIntensity = 0.45 + Math.sin(t * 1.5 + i * 0.8) * 0.2; });
  });
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
  const jets = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, j = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.6, 6), new THREE.MeshBasicMaterial({ color: "#9fe8ff", transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); j.position.set(Math.cos(a) * 2.6, 1.6, Math.sin(a) * 2.6); g.add(j); jets.push(j); }
  const light = new THREE.PointLight("#ff4fa3", 30, 16, 1.6); light.position.y = 4.6; g.add(light);
  g.userData.anim = (t) => {
    crystal.rotation.y = t * 0.6; crystal.position.y = 4.6 + Math.sin(t * 1.6) * 0.25;
    shards.forEach((s, i) => { const a = t * 0.9 + (i / 4) * Math.PI * 2; s.position.set(Math.cos(a) * 1.9, 4.4 + Math.sin(t * 2 + i) * 0.4, Math.sin(a) * 1.9); s.rotation.y = t * 2; });
    jets.forEach((j, i) => { j.scale.y = 0.7 + Math.abs(Math.sin(t * 3 + i)) * 0.6; });
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

// ------------------------------------------------------------------ props (trees sway gently)
const sway = (g, s) => { const ph = Math.random() * 6; g.userData.anim = (t) => { g.rotation.z = Math.sin(t * 0.9 + ph) * 0.025 * s; g.rotation.x = Math.cos(t * 0.7 + ph) * 0.02 * s; }; };
function tree(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.18, 0.28, 1.6, M.trunk(), 6));
  const shades = ["#1f7a5c", "#2a9468", "#36a874"];
  [[0, 2.3, 0, 1.15], [-0.5, 2.0, 0.3, 0.8], [0.45, 2.1, -0.3, 0.8], [0.1, 3.1, 0, 0.8]].forEach(([x, y, z, r], i) => g.add(ico(r, M.leaf(shades[i % 3]), x, y, z)));
  g.scale.setScalar(s); sway(g, 1);
  return g;
}
function pine(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.15, 0.22, 1.2, M.trunk(), 6));
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.25, 1.6, 7), M.leaf(["#1b6650", "#227a5d", "#2b8f68"][i])); c.position.y = 1.6 + i * 0.9; c.castShadow = true; g.add(c); }
  g.scale.setScalar(s); sway(g, 0.8);
  return g;
}
function blossom(s = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.3, 1.8, M.trunk(), 6));
  [[0, 2.6, 0, 1.25, "#ff8cc6"], [-0.6, 2.2, 0.3, 0.85, "#ff6fb1"], [0.55, 2.3, -0.3, 0.85, "#ffa6d6"], [0, 3.4, 0.1, 0.8, "#ffb8de"]].forEach(([x, y, z, r, c]) => g.add(ico(r, mat(`bl${c}`, () => std(c, { emissive: c, emissiveIntensity: 0.25 })), x, y, z)));
  g.scale.setScalar(s); sway(g, 1);
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
  const g = new THREE.Group(), wood = mat("wood", () => std("#7a4a34"));
  g.add(box(1.5, 0.12, 0.5, wood, 0, 0.45)); g.add(box(1.5, 0.45, 0.1, wood, 0, 0.6, -0.22));
  for (const x of [-0.6, 0.6]) g.add(box(0.1, 0.45, 0.45, M.frame(), x, 0));
  return g;
}
const ADS = [["AI ARENA", "BATTLE NOW"], ["KULT CREATE", "BUILD GAMES"], ["KULT SPORTS", "MATCHDAY LIVE"], ["DEAL ROOM", "TRADE · PARTNER"], ["MARKETPLACE", "HIRE AN AGENT"]];
function billboard(ad = 0) {
  const g = new THREE.Group();
  for (const x of [-1.6, 1.6]) g.add(cyl(0.12, 0.12, 4.2, M.metal(), 6, x, 0));
  g.add(box(4.4, 2.5, 0.25, M.frame(), 0, 4));
  const tex = ADS.map((a, i) => signTexture(a, { colors: [["#ff4fa3", "#4fd8ff", "#7ef0a6", "#ffc94d", "#c79bff"][i], "#ffffff"], bg: "#0b0717" }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 2.2), new THREE.MeshBasicMaterial({ map: tex[ad % ADS.length], toneMapped: false }));
  screen.position.set(0, 5.25, 0.14); g.add(screen);
  let cur = ad % ADS.length;
  g.userData.anim = (t) => { const k = (ad + Math.floor(t / 4)) % ADS.length; if (k !== cur) { cur = k; screen.material.map = tex[k]; } };
  return g;
}
export function hoverCar(color = "#ff4fa3") {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 4, 8), std(color, { metalness: 0.5, roughness: 0.3 })); body.rotation.z = Math.PI / 2; body.position.y = 0.55; body.scale.set(0.8, 1, 1); body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass()); cab.position.set(-0.1, 0.78, 0); cab.scale.set(1.2, 0.8, 0.9); g.add(cab);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); under.rotation.x = -Math.PI / 2; under.position.y = 0.04; g.add(under);
  for (const z of [-0.3, 0.3]) g.add(box(0.06, 0.08, 0.14, M.glow("#ff3355", 3), -0.95, 0.5, z));
  for (const z of [-0.3, 0.3]) g.add(box(0.06, 0.08, 0.14, M.glow("#e8f4ff", 3), 0.95, 0.5, z));
  const ph = Math.random() * 6; g.userData.anim = (t) => { body.position.y = 0.55 + Math.sin(t * 2 + ph) * 0.05; };
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
// Three.js's CC0 "RobotExpressive" (rigged, Idle/Walking/Running/Wave/Dance),
// tinted per archetype. If it cannot load, a capsule bot is used.
export const AGENT_PLACEHOLDER_URL = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/RobotExpressive/RobotExpressive.glb";
export function capsuleAgent(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), std(color, { flatShading: false, roughness: 0.4, metalness: 0.2 })); body.position.y = 0.95; body.castShadow = true; g.add(body);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.2), M.glow("#9fe8ff", 2.5)); visor.position.set(0, 1.45, 0.36); g.add(visor);
  return g;
}

// ------------------------------------------------------------------ registry
const BUILDERS = {
  "bld-gaming-studio": gamingStudio, "bld-sports": sportsAgency, "bld-dex": dexTower, "bld-film": filmStudio,
  "campus-gate": campusGate, monument, "bld-game-hub": gameHub, "bld-deal-room": dealRoom, "bld-marketplace": marketplace,
  fountain, "spawn-pad": spawnPad, tree, pine, blossom, bush, flowers, lamp, bench, billboard, car: hoverCar, crane
};

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
  const s = SLOTS[slot];
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), size = b.getSize(new THREE.Vector3());
  const k = Math.min((s.size[0] * T) / Math.max(size.x, 1e-3), (s.size[1] * T) / Math.max(size.z, 1e-3), (s.height / Math.max(size.y, 1e-3)) * 1.4);
  obj.scale.multiplyScalar(k);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  const g = new THREE.Group(); g.add(obj); return g;
}

// Build a slot: the provided GLB if there is one, otherwise the placeholder.
// `opts` is passed to the placeholder builder ({ W, D } for buildings).
export function build(slot, opts) {
  const holder = new THREE.Group();
  const placeholder = BUILDERS[slot](opts);
  holder.add(placeholder);
  holder.userData.anim = (t, dt) => placeholder.userData.anim?.(t, dt);
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
