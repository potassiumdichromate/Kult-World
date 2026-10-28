// Kult World ground: a stepped 3D terrain built from the tile map. Roads sit
// lowest, paving is a kerb higher and lawns sit on top, with stone kerb faces
// between levels. Surfaces use tiling procedural textures with normal maps;
// road neon, lane lines, crossings and the plaza inlay are separate meshes.
import * as THREE from "three";
import { MAP, tiles, CENTER } from "./layout.js";
import { T } from "./models.js";

const HALF = (MAP * T) / 2;
// Surface height per tile kind (metres). Pond and rim tiles sit at grass level.
const H = { r: 0, p: 0.12, g: 0.24, c: 0.24, w: 0.24, e: 0.24 };
export const heightAt = (x, y) => {
  const tx = Math.floor(x), ty = Math.floor(y);
  return tx < 0 || ty < 0 || tx >= MAP || ty >= MAP ? 0 : H[tiles[tx][ty]];
};
const SURFACE = { r: "asphalt", p: "pavers", g: "grass", w: "grass", e: "grass", c: "lawn" };
// Metres covered by one repeat of each texture.
const SCALE = { asphalt: 8, pavers: 4, grass: 6, lawn: 8, curb: 2, lip: 4 };

// ------------------------------------------------------------------ tiling noise
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
// Periodic value noise: tiles seamlessly at `size` pixels.
function noiseField(size, period, seed) {
  const r = rng(seed), lat = Array.from({ length: period * period }, r), out = new Float32Array(size * size);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * period, fy = (y / size) * period, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const v = (i, j) => lat[((j % period) * period) + (i % period)];
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * tx, b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * tx;
    out[y * size + x] = a + (b - a) * ty;
  }
  return out;
}
function fbm(size, periods, seed) {
  const out = new Float32Array(size * size); let total = 0;
  periods.forEach((p, i) => { const w = 1 / (i + 1), f = noiseField(size, p, seed + i * 101); for (let k = 0; k < out.length; k++) out[k] += f[k] * w; total += w; });
  for (let k = 0; k < out.length; k++) out[k] /= total;
  return out;
}
// Normal map from a height field (wrapping, so it tiles).
function normalTex(hgt, size, strength) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data;
  const at = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (-dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, false);
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const mix = (a, b, k) => a + (b - a) * k;
// Paint pixels from a function returning [r, g, b] (0-255).
function paint(size, f) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4, [r, gg, b] = f(x, y, y * size + x); d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return [c, g];
}

// ------------------------------------------------------------------ surface materials
function asphalt() {
  const S = 512, n = fbm(S, [4, 16, 64], 7), r = rng(9), hgt = new Float32Array(S * S);
  const [c, g] = paint(S, (x, y, i) => { const v = n[i], k = 26 + v * 16; hgt[i] = v * 0.4; return [k + 6, k + 2, k + 22]; });
  // Aggregate speckles and a few hairline cracks.
  for (let i = 0; i < 2600; i++) { const x = r() * S, y = r() * S, l = r(); g.fillStyle = l < 0.7 ? `rgba(150,140,190,${0.12 + r() * 0.2})` : `rgba(8,6,18,${0.3 + r() * 0.3})`; g.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5); hgt[(Math.floor(y) % S) * S + (Math.floor(x) % S)] += l < 0.7 ? 0.5 : -0.4; }
  g.strokeStyle = "rgba(10,8,22,0.55)"; g.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  return new THREE.MeshStandardMaterial({ map: tex(c), normalMap: normalTex(hgt, S, 3), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.82, metalness: 0.05 });
}
function pavers() {
  const S = 1024, n = fbm(S, [8, 32], 21), r = rng(23), rows = 8, cols = 4, hgt = new Float32Array(S * S);
  const tint = Array.from({ length: rows * cols * 2 }, () => r());
  const rowH = S / rows, colW = S / cols, grout = 5;
  const [c] = paint(S, (x, y, i) => {
    const row = Math.floor(y / rowH), off = row % 2 ? colW / 2 : 0, col = Math.floor(((x + off) % S) / colW);
    const lx = (x + off) % colW, ly = y % rowH, edge = Math.min(lx, colW - lx, ly, rowH - ly);
    if (edge < grout) { hgt[i] = 0; return [38, 32, 66]; }
    const bevel = Math.min(1, (edge - grout) / 6), t = tint[row * cols + col], v = n[i];
    hgt[i] = 0.6 * bevel + v * 0.15;
    const k = 0.82 + t * 0.22 + (v - 0.5) * 0.18;
    return [92 * k, 84 * k, 146 * k];
  });
  return new THREE.MeshStandardMaterial({ map: tex(c), normalMap: normalTex(hgt, S, 6), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.55, metalness: 0.08 });
}
function grassTex(S, stripes, seed) {
  const n = fbm(S, [4, 12, 48], seed), r = rng(seed + 3), hgt = new Float32Array(S * S);
  const [c, g] = paint(S, (x, y, i) => {
    const v = n[i], band = stripes ? (Math.floor((y / S) * stripes * 2) % 2 ? 1.06 : 0.94) : 1;
    hgt[i] = v * 0.3;
    return [mix(34, 58, v) * band, mix(104, 150, v) * band, mix(80, 110, v) * band];
  });
  // Blade strokes in lighter and darker greens.
  for (let i = 0; i < S * 9; i++) {
    const x = r() * S, y = r() * S, len = 3 + r() * 6, a = -Math.PI / 2 + (r() - 0.5) * 0.9, light = r() < 0.55;
    g.strokeStyle = light ? `rgba(130,220,170,${0.12 + r() * 0.16})` : `rgba(10,50,38,${0.15 + r() * 0.2})`;
    g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    hgt[(Math.floor(y) % S) * S + (Math.floor(x) % S)] += light ? 0.6 : -0.3;
  }
  return new THREE.MeshStandardMaterial({ map: tex(c), normalMap: normalTex(hgt, S, 2.5), normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.95, vertexColors: true });
}
function curb() {
  const S = 256, n = fbm(S, [4, 16], 41), hgt = new Float32Array(S * S);
  const [c] = paint(S, (x, y, i) => { const v = n[i], joint = x % 128 < 3 ? 0.6 : 1; hgt[i] = v * 0.5 * joint; const k = (150 + v * 40) * joint; return [k * 0.82, k * 0.78, k]; });
  return new THREE.MeshStandardMaterial({ map: tex(c), normalMap: normalTex(hgt, S, 3), roughness: 0.7 });
}
function lip() {
  // Island edge: a band of grass over dark violet soil with roots.
  const S = 256, n = fbm(S, [4, 16], 51), r = rng(53);
  const [c, g] = paint(S, (x, y, i) => { const v = n[i], t = y / S; if (t < 0.12 + v * 0.06) return [44 + v * 30, 128 + v * 30, 92]; const k = 0.7 + v * 0.4; return [62 * k, 40 * k, 84 * k]; });
  g.strokeStyle = "rgba(20,12,30,0.5)"; g.lineWidth = 1.5;
  for (let k = 0; k < 14; k++) { let x = r() * S, y = S * 0.15; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 14; y += r() * 30; g.lineTo(x, y); } g.stroke(); }
  return new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.95 });
}

// ------------------------------------------------------------------ geometry
class Buf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  quad(v, nrm, uvs, cols) {
    const b = this.p.length / 3;
    v.forEach((p, k) => { this.p.push(...p); this.n.push(...nrm); this.uv.push(...uvs[k]); this.c.push(...(cols ? cols[k] : [1, 1, 1])); });
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere();
    return g;
  }
}
const kindAt = (x, y) => (x < 0 || y < 0 || x >= MAP || y >= MAP ? null : tiles[x][y]);

export function buildTerrain(scene) {
  const mats = { asphalt: asphalt(), pavers: pavers(), grass: grassTex(1024, 0, 61), lawn: grassTex(1024, 2, 71), curb: curb(), lip: lip() };
  const bufs = Object.fromEntries(Object.keys(mats).map((k) => [k, new Buf()]));
  const macro = noiseField(MAP + 1, 7, 81);  // patchy brightness across the lawns
  const shade = (x, y) => { const v = 0.86 + macro[Math.min(MAP, y) * (MAP + 1) + Math.min(MAP, x)] * 0.24; return [v, v, v]; };
  const W = (x) => x * T - HALF;
  for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) {
    const k = tiles[x][y], h = H[k], surf = SURFACE[k], sc = SCALE[surf];
    const xs = [W(x), W(x + 1)], zs = [W(y), W(y + 1)];
    const uv = (px, pz) => [px / sc, -pz / sc];
    const v = [[xs[0], h, zs[0]], [xs[0], h, zs[1]], [xs[1], h, zs[1]], [xs[1], h, zs[0]]];
    bufs[surf].quad(v, [0, 1, 0], v.map((p) => uv(p[0], p[2])), surf === "grass" || surf === "lawn" ? [shade(x, y), shade(x, y + 1), shade(x + 1, y + 1), shade(x + 1, y)] : null);
    // Kerb faces down to lower neighbours; the island edge drops to the soil.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = kindAt(x + dx, y + dy), edge = nk === null, nh = edge ? -0.6 : H[nk];
      if (nh >= h) continue;
      const mat = edge ? "lip" : "curb", s = SCALE[mat];
      let a, b;
      if (dx === 1) { a = [xs[1], zs[1]]; b = [xs[1], zs[0]]; } else if (dx === -1) { a = [xs[0], zs[0]]; b = [xs[0], zs[1]]; }
      else if (dy === 1) { a = [xs[0], zs[1]]; b = [xs[1], zs[1]]; } else { a = [xs[1], zs[0]]; b = [xs[0], zs[0]]; }
      const u0 = (a[0] + a[1]) / s, u1 = (b[0] + b[1]) / s, vv = edge ? [0, 1] : [h / s, nh / s];
      bufs[mat].quad([[a[0], h, a[1]], [a[0], nh, a[1]], [b[0], nh, b[1]], [b[0], h, b[1]]], [dx, 0, dy], [[u0, vv[0]], [u0, vv[1]], [u1, vv[1]], [u1, vv[0]]]);
    }
  }
  const group = new THREE.Group();
  for (const [k, buf] of Object.entries(bufs)) {
    if (!buf.p.length) continue;
    const m = new THREE.Mesh(buf.geometry(), mats[k]); m.receiveShadow = true; group.add(m);
  }
  scene.add(group);
  const anims = [roadMarkings(scene), plazaInlay(scene)].filter(Boolean);
  cliff(scene);
  return { anims, materials: mats };
}

// ------------------------------------------------------------------ road neon, lane lines, crossings
function roadMarkings(scene) {
  const W = (x) => x * T - HALF, [cx, cy] = CENTER, plazaR = 7.7;
  // Light pulses travel along neon strips: a scrolling additive texture.
  const pulse = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 4; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.42, "rgba(255,255,255,0.55)"); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(0.6, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0.55)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 4); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; })();
  const strips = [];
  const strip = (x0, z0, x1, z1, color, dir) => {
    const len = Math.hypot(x1 - x0, z1 - z0), t = pulse.clone(); t.needsUpdate = true; t.repeat.set(len / 16, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.26), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z1 - z0, x1 - x0); m.position.set((x0 + x1) / 2, 0.015, (z0 + z1) / 2);
    scene.add(m); strips.push([t, dir]);
  };
  // Avenue segments outside the plaza: [from, to] in tiles along the avenue.
  const segs = [[2, cx - plazaR], [cx + plazaR, 54]];
  for (const [a, b] of segs) {
    for (const [y, d] of [[27.06, 1], [29.94, -1]]) strip(W(a), W(y), W(b), W(y), "#4fd8ff", d);
    for (const [x, d] of [[27.06, -1], [29.94, 1]]) strip(W(x), W(a), W(x), W(b), "#ff4fa3", d);
  }
  // Dashed lane lines and zebra crossings (instanced).
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 0.14), new THREE.MeshStandardMaterial({ color: "#e8b64a", emissive: "#e8b64a", emissiveIntensity: 0.6, roughness: 0.6 }), 80);
  const zebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.45, 5.4), new THREE.MeshStandardMaterial({ color: "#d8d2f0", roughness: 0.7 }), 48);
  const o = new THREE.Object3D(); let nd = 0, nz = 0;
  const put = (m, x, z, rot, i) => { o.position.set(x, 0.012, z); o.rotation.set(-Math.PI / 2, 0, rot); o.updateMatrix(); m.setMatrixAt(i, o.matrix); };
  for (const [a, b] of segs) for (let t = a + 0.5; t < b - 0.5; t += 1.5) { put(dash, W(t), W(28.5), 0, nd++); put(dash, W(28.5), W(t), Math.PI / 2, nd++); }
  for (const [s, e] of [[cx - plazaR - 2.6, cx - plazaR - 0.2], [cx + plazaR + 0.2, cx + plazaR + 2.6]]) for (let t = s; t < e; t += 0.5) { put(zebra, W(t), W(28.5), 0, nz++); put(zebra, W(28.5), W(t), Math.PI / 2, nz++); }
  dash.count = nd; zebra.count = nz; dash.receiveShadow = zebra.receiveShadow = true;
  scene.add(dash, zebra);
  return (t) => { for (const [tx, d] of strips) tx.offset.x = -((t * 0.18 * d) % 1); };
}

// The plaza's glowing rings and spokes, inlaid in the paving.
function plazaInlay(scene) {
  const S = 1024, R = 7.6, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), px = S / 2, k = (S / 2) / R;
  const ring = (r, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.shadowColor = col; g.shadowBlur = 10; g.beginPath(); g.arc(px, px, r * k, 0, Math.PI * 2); g.stroke(); };
  ring(7.2, "#ff4fa3", 7); ring(6.1, "#4fd8ff", 5); ring(3.4, "#ffc94d", 5);
  g.strokeStyle = "#7a5cff"; g.lineWidth = 3; g.shadowColor = "#7a5cff";
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(px + Math.cos(a) * 3.6 * k, px + Math.sin(a) * 3.6 * k); g.lineTo(px + Math.cos(a) * 5.9 * k, px + Math.sin(a) * 5.9 * k); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 * T, R * 2 * T), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(CENTER[0] * T - HALF, H.p + 0.006, CENTER[1] * T - HALF); scene.add(m);
  return (time) => { m.material.opacity = 0.85 + Math.sin(time * 1.4) * 0.15; };
}

// ------------------------------------------------------------------ the floating island's underside
function cliff(scene) {
  const size = MAP * T;
  // Soil band right under the surface.
  const soil = new THREE.Mesh(new THREE.BoxGeometry(size, 2.4, size), new THREE.MeshStandardMaterial({ color: "#3a2650", roughness: 1 }));
  soil.position.y = -0.6 - 1.2; scene.add(soil);
  // Rock: a jagged inverted pyramid with darker strata towards the tip.
  const geo = new THREE.ConeGeometry(size * 0.74, 56, 4, 10, true);
  const p = geo.attributes.position, col = [], r = rng(91);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = (y + 28) / 56;
    if (y < 27) p.setXYZ(i, p.getX(i) * (1 + (r() - 0.5) * 0.12), y + (r() - 0.5) * 2, p.getZ(i) * (1 + (r() - 0.5) * 0.12));
    const band = Math.floor(t * 9) % 2 ? 0.85 : 1, c = new THREE.Color().setHSL(0.74, 0.32, (0.2 - t * 0.12) * band);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  rock.rotation.set(Math.PI, Math.PI / 4, 0); rock.position.y = -3 - 28; scene.add(rock);
}
