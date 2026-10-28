// Kult World ground: one floating landmass. The top is a smooth heightfield
// whose rim vertices snap onto the organic coastline (layout.ISLAND); the
// underside is a deep faceted rock body that meets it exactly at the coast.
// Surfaces blend asphalt, pavers, grass and lawn through a splat mask drawn
// from the exact painted shapes (round plaza and pond, straight roads), with
// every texture at one world scale. Avenues run to the coast and carry on as
// bridges to small floating islets; the pond spills over the edge as a waterfall.
import * as THREE from "three";
import { MAP, CENTER, POND, SHAPES, AVENUES, ISLAND, islandSD, tiles, vnoise } from "./layout.js";
import { T, M, lightPool } from "./models.js";

const PAD = ISLAND.pad, EXT = MAP + 2 * PAD, HALF = (MAP * T) / 2;
const W = (t) => t * T - HALF;                     // tile coordinate -> world metres
const H_ROAD = 0, H_PAVE = 0.12, H_GRASS = 0.24;
const SUB = 3;                                     // grid vertices per tile

// ------------------------------------------------------------------ tiling textures
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function noiseField(size, period, seed) {
  const r = rng(seed), lat = Array.from({ length: period * period }, r), out = new Float32Array(size * size), sm = (t) => t * t * (3 - 2 * t);
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
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function normalTex(hgt, size, strength) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data, at = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (-dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, false);
}
function paint(size, f) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4, [r, gg, b] = f(x, y, y * size + x); d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  return [c, g];
}
const mix = (a, b, k) => a + (b - a) * k;
function asphaltTex() {
  const S = 512, n = fbm(S, [4, 16, 64], 7), r = rng(9), hgt = new Float32Array(S * S);
  const [c, g] = paint(S, (x, y, i) => { const v = n[i], k = 30 + v * 16; hgt[i] = v * 0.4; return [k + 6, k + 2, k + 22]; });
  for (let i = 0; i < 2600; i++) { const x = r() * S, y = r() * S, l = r(); g.fillStyle = l < 0.7 ? `rgba(150,140,190,${0.12 + r() * 0.2})` : `rgba(8,6,18,${0.3 + r() * 0.3})`; g.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5); hgt[(Math.floor(y) % S) * S + (Math.floor(x) % S)] += l < 0.7 ? 0.5 : -0.4; }
  g.strokeStyle = "rgba(10,8,22,0.5)"; g.lineWidth = 1.2;
  for (let k = 0; k < 5; k++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  return { map: tex(c), normal: normalTex(hgt, S, 3) };
}
function paverTex() {
  const S = 1024, n = fbm(S, [8, 32], 21), r = rng(23), rows = 8, cols = 4, hgt = new Float32Array(S * S);
  const tint = Array.from({ length: rows * cols * 2 }, () => r()), rowH = S / rows, colW = S / cols, grout = 5;
  const [c] = paint(S, (x, y, i) => {
    const row = Math.floor(y / rowH), off = row % 2 ? colW / 2 : 0, col = Math.floor(((x + off) % S) / colW);
    const lx = (x + off) % colW, ly = y % rowH, edge = Math.min(lx, colW - lx, ly, rowH - ly);
    if (edge < grout) { hgt[i] = 0; return [40, 34, 70]; }
    const bevel = Math.min(1, (edge - grout) / 6), t = tint[row * cols + col], v = n[i];
    hgt[i] = 0.6 * bevel + v * 0.15;
    const k = 0.84 + t * 0.22 + (v - 0.5) * 0.18;
    return [96 * k, 88 * k, 150 * k];
  });
  return { map: tex(c), normal: normalTex(hgt, S, 6) };
}
function grassTex(stripes, seed) {
  const S = 1024, n = fbm(S, [4, 12, 48], seed), r = rng(seed + 3), hgt = new Float32Array(S * S);
  const [c, g] = paint(S, (x, y, i) => {
    const v = n[i], band = stripes ? (Math.floor((y / S) * stripes * 2) % 2 ? 1.07 : 0.93) : 1;
    hgt[i] = v * 0.3;
    return [mix(38, 62, v) * band, mix(112, 158, v) * band, mix(84, 112, v) * band];
  });
  for (let i = 0; i < S * 9; i++) {
    const x = r() * S, y = r() * S, len = 3 + r() * 6, a = -Math.PI / 2 + (r() - 0.5) * 0.9, light = r() < 0.55;
    g.strokeStyle = light ? `rgba(140,225,175,${0.12 + r() * 0.16})` : `rgba(10,50,38,${0.15 + r() * 0.2})`;
    g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    hgt[(Math.floor(y) % S) * S + (Math.floor(x) % S)] += light ? 0.6 : -0.3;
  }
  return { map: tex(c), normal: normalTex(hgt, S, 2.5) };
}
function stoneTex() {
  const S = 256, n = fbm(S, [4, 16], 41);
  const [c] = paint(S, (x, y, i) => { const v = n[i], k = 140 + v * 50; return [k * 0.8, k * 0.76, k]; });
  return tex(c);
}

// ------------------------------------------------------------------ the splat mask
// Three layers (road, paving, lawn) drawn from the layout's exact shapes at
// sub-tile resolution and softly blurred; grass is whatever remains.
const S = 1400, PX = S / EXT;                      // mask pixels per tile
const toPx = (t) => (t + PAD) * PX;
function drawMask(extraRoads, stream) {
  const layers = { r: null, p: null, c: null };
  for (const k of Object.keys(layers)) { const c = document.createElement("canvas"); c.width = c.height = S; layers[k] = c.getContext("2d"); }
  const LAYER = { r: "r", p: "p", w: "p", c: "c" };
  const shape = (g, sh) => { g.beginPath(); if (sh.rect) { const [x0, y0, x1, y1] = sh.rect; g.rect(toPx(x0), toPx(y0), (x1 - x0) * PX, (y1 - y0) * PX); } else { const [cx, cy, r] = sh.circle; g.arc(toPx(cx), toPx(cy), r * PX, 0, Math.PI * 2); } };
  const put = (sh, k) => {
    for (const [lk, g] of Object.entries(layers)) {
      g.globalCompositeOperation = lk === k ? "source-over" : "destination-out"; g.fillStyle = "#fff"; shape(g, sh); g.fill();
    }
  };
  for (const sh of SHAPES) if (LAYER[sh.k]) put(sh, LAYER[sh.k]);
  for (const rect of extraRoads) put({ rect }, "r");
  if (stream) {
    for (const [lk, g] of Object.entries(layers)) {
      g.globalCompositeOperation = lk === "p" ? "source-over" : "destination-out"; g.strokeStyle = "#fff"; g.lineCap = "round"; g.lineWidth = 1.1 * PX;
      g.beginPath(); g.moveTo(toPx(stream[0][0]), toPx(stream[0][1])); g.lineTo(toPx(stream[1][0]), toPx(stream[1][1])); g.stroke();
    }
  }
  // Soften the borders a little and read the layers back.
  const read = (g) => {
    const c = document.createElement("canvas"); c.width = c.height = S; const b = c.getContext("2d", { willReadFrequently: true });
    b.filter = `blur(${Math.round(PX * 0.12)}px)`; b.drawImage(g.canvas, 0, 0);
    const d = b.getImageData(0, 0, S, S).data, out = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) out[i] = d[i * 4 + 3] / 255;
    return out;
  };
  const R = read(layers.r), P = read(layers.p), L = read(layers.c);
  const c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d"), img = g.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) { d[i * 4] = R[i] * 255; d[i * 4 + 1] = P[i] * 255; d[i * 4 + 2] = L[i] * 255; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex: t, R, P, L };
}
const sample = (arr, x, y) => {
  const fx = Math.min(S - 1.001, Math.max(0, toPx(x) - 0.5)), fy = Math.min(S - 1.001, Math.max(0, toPx(y) - 0.5)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  const a = arr[j * S + i], b = arr[j * S + i + 1], c = arr[(j + 1) * S + i], d = arr[(j + 1) * S + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

// ------------------------------------------------------------------ height
let mask = null;
function surface(x, y) {
  if (!mask) return { h: 0, r: 0 };
  const r = sample(mask.R, x, y), p = Math.min(1 - r, sample(mask.P, x, y));
  return { h: H_ROAD * r + H_PAVE * p + H_GRASS * Math.max(0, 1 - r - p), r };
}
export const heightAt = (x, y) => surface(x, y).h;

// The blending ground material: MeshStandardMaterial with the albedo,
// normal and roughness of four surfaces mixed by the splat mask.
function groundMaterial(splat, t) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0.04, normalMap: t.grass.normal, normalScale: new THREE.Vector2(0.75, 0.75) });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uSplat: { value: splat }, uHalf: { value: HALF + PAD * T }, uSize: { value: EXT * T },
      uMapR: { value: t.asphalt.map }, uMapP: { value: t.pavers.map }, uMapL: { value: t.lawn.map }, uMapG: { value: t.grass.map },
      uNorR: { value: t.asphalt.normal }, uNorP: { value: t.pavers.normal }, uNorL: { value: t.lawn.normal }
    });
    sh.vertexShader = "varying vec3 vKW;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  vKW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = `varying vec3 vKW;
uniform sampler2D uSplat, uMapR, uMapP, uMapL, uMapG, uNorR, uNorP, uNorL;
uniform float uHalf, uSize;
` + sh.fragmentShader
      .replace("#include <map_fragment>", `
  vec4 kSp = texture2D(uSplat, vec2((vKW.x + uHalf) / uSize, 1.0 - (vKW.z + uHalf) / uSize));
  float wR = kSp.r, wP = min(kSp.g, 1.0 - wR), wL = min(kSp.b, 1.0 - wR - wP), wG = max(0.0, 1.0 - wR - wP - wL);
  vec2 kW = vec2(vKW.x, -vKW.z);
  vec3 kAlb = texture2D(uMapR, kW / 8.0).rgb * wR + texture2D(uMapP, kW / 4.0).rgb * wP + texture2D(uMapL, kW / 8.0).rgb * wL + texture2D(uMapG, kW / 6.0).rgb * wG;
  diffuseColor.rgb *= kAlb;`)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = wR * 0.8 + wP * 0.5 + (wL + wG) * 0.95;")
      .replace("vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;",
        "vec3 mapN = (texture2D(uNorR, kW / 8.0).xyz * wR + texture2D(uNorP, kW / 4.0).xyz * wP + texture2D(uNorL, kW / 8.0).xyz * wL + texture2D(normalMap, kW / 6.0).xyz * wG) * 2.0 - 1.0;");
  };
  m.customProgramCacheKey = () => "kw-ground";
  return m;
}

// Rock colour by depth below the surface: a soil band, then banded strata.
function rockColor(depth, x, y) {
  const n = vnoise(x * 3, y * 3 + depth * 0.5, 4, 11);
  if (depth < 0.9) return new THREE.Color().setHSL(0.93, 0.24, 0.24 + n * 0.06);
  const band = Math.sin(depth * 1.35 + n * 2.2) * 0.5 + 0.5, deep = Math.min(1, depth / 30);
  return new THREE.Color().setHSL(0.71 + band * 0.05, 0.34 - deep * 0.1, 0.22 + band * 0.12 - deep * 0.08 + n * 0.04);
}

// ------------------------------------------------------------------ build
export function buildTerrain(scene) {
  const texs = { asphalt: asphaltTex(), pavers: paverTex(), grass: grassTex(0, 61), lawn: grassTex(2, 71) };
  const anims = [];

  // Where each avenue meets the coast, and where the pond spills over the edge.
  const ends = [];
  const { ew, ns } = AVENUES, cy = (ew.y0 + ew.y1) / 2, cx = (ns.x0 + ns.x1) / 2;
  for (const [x, y, dx, dy, color] of [[ew.x0, cy, -1, 0, "#4fd8ff"], [ew.x1, cy, 1, 0, "#4fd8ff"], [cx, ns.y0, 0, -1, "#ff4fa3"], [cx, ns.y1, 0, 1, "#ff4fa3"]]) {
    let t = 0; while (t < 12 && islandSD(x + dx * t, y + dy * t) > 0.02) t += 0.05;
    ends.push({ from: [x, y], coast: [x + dx * t, y + dy * t], dir: [dx, dy], color });
  }
  const extraRoads = ends.map(({ from, coast, dir }) => dir[0] ? [Math.min(from[0], coast[0]) - 0.05, ew.y0, Math.max(from[0], coast[0]) + 0.05, ew.y1] : [ns.x0, Math.min(from[1], coast[1]) - 0.05, ns.x1, Math.max(from[1], coast[1]) + 0.05]);
  let stream = null, best = 1e9;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    for (let t = POND.r * 0.9; t < POND.r + 14; t += 0.2) {
      const x = POND.x + dx * t, y = POND.y + dy * t, tk = tiles[Math.floor(x)]?.[Math.floor(y)];
      if (tk === "r" || tk === "p" || tk === "c") break;
      if (islandSD(x, y) < 0.05) { if (t < best) { best = t; stream = { a: [POND.x + dx * POND.r * 0.85, POND.y + dy * POND.r * 0.85], b: [x, y], dir: [dx, dy] }; } break; }
    }
  }
  mask = drawMask(extraRoads, stream && [stream.a, stream.b]);

  // ---- the landmass: top surface + rock underside sharing the snapped coast
  const VN = EXT * SUB + 1, nV = VN * VN;
  const top = new Float32Array(nV * 3), bot = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), cTop = new Float32Array(nV * 3), cBot = new Float32Array(nV * 3), sd0 = new Float32Array(nV);
  const e = 0.05;
  for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) {
    const k = j * VN + i;
    let x = i / SUB - PAD, y = j / SUB - PAD;
    const s0 = sd0[k] = islandSD(x, y);
    if (s0 < 0 && s0 > -2.5) {
      // Move this rim vertex onto the coastline along the field's gradient.
      const gx = islandSD(x + e, y) - islandSD(x - e, y), gy = islandSD(x, y + e) - islandSD(x, y - e), gl = Math.hypot(gx, gy) || 1;
      x -= (gx / gl) * s0; y -= (gy / gl) * s0;
    }
    const sd = Math.max(0, s0), { h, r } = surface(x, y);
    const lip = (1 - Math.min(1, sd / 0.8)) ** 2 * 0.3 * (1 - r);
    const yt = h - lip;
    top.set([W(x), yt, W(y)], k * 3); uv.set([x, -y], k * 2);
    const shade = 0.9 + vnoise(x, y, 6, 21) * 0.2; cTop.set([shade, shade, shade], k * 3);
    // Underside: steep near the coast, then an uneven taper into stalactite-like points.
    const n1 = vnoise(x, y, 3.5, 31), n2 = vnoise(x, y, 1.3, 37), n3 = vnoise(x, y, 9, 41);
    const depth = sd <= 0 ? 0 : 2.6 * Math.sqrt(sd) + 0.95 * sd + (n1 - 0.4) * (0.8 + sd * 0.35) + n2 * sd * 0.18 + n3 * sd * 0.5;
    const jit = Math.min(1, sd / 1.5) * 0.45;
    const bx = x + (vnoise(x, y, 2, 51) - 0.5) * jit, by = y + (vnoise(x, y, 2, 57) - 0.5) * jit;
    bot.set([W(bx), yt - depth * T * 0.5, W(by)], k * 3);
    rockColor(depth * T * 0.5, x, y).toArray(cBot, k * 3);
  }
  const iTop = [], iBot = [];
  for (let j = 0; j < VN - 1; j++) for (let i = 0; i < VN - 1; i++) {
    const a = j * VN + i, b = a + 1, c = a + VN, d = c + 1, q = [sd0[a], sd0[b], sd0[c], sd0[d]];
    if (Math.max(...q) < 0 || Math.min(...q) < -2.5) continue;
    iTop.push(a, c, b, b, c, d); iBot.push(a, b, c, b, d, c);
  }
  const geo = (pos, col, idx, withUv) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    if (withUv) g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const ground = new THREE.Mesh(geo(top, cTop, iTop, true), groundMaterial(mask.tex, texs)); ground.receiveShadow = true;
  const rock = new THREE.Mesh(geo(bot, cBot, iBot, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  scene.add(ground, rock);

  // A handful of points on the underside for hanging crystals.
  const deep = [];
  for (let k = 0; k < nV; k += 7) if (sd0[k] > 3) deep.push(k);
  const undersidePoints = (n) => Array.from({ length: n }, () => { const k = deep[Math.floor(Math.random() * deep.length)]; return new THREE.Vector3(bot[k * 3], bot[k * 3 + 1], bot[k * 3 + 2]); });

  anims.push(roadMarkings(scene, ends));
  anims.push(plazaInlay(scene));
  for (const end of ends) anims.push(bridge(scene, end, texs));
  if (stream) anims.push(waterfall(scene, stream));
  return { anims, materials: { curb: new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.7 }) }, undersidePoints, waterfallTop: stream && new THREE.Vector3(W(stream.b[0]), 0.1, W(stream.b[1])) };
}

// ------------------------------------------------------------------ road neon, lane lines, crossings
function decalMat(params) { return new THREE.MeshStandardMaterial({ ...params, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); }
function roadMarkings(scene, ends) {
  const [cx, cy] = CENTER, plazaR = 7.7, { ew, ns } = AVENUES;
  const pulse = (() => { const c = document.createElement("canvas"); c.width = 256; c.height = 4; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(0.42, "rgba(255,255,255,0.55)"); gr.addColorStop(0.5, "rgba(255,255,255,1)"); gr.addColorStop(0.6, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0.55)"); g.fillStyle = gr; g.fillRect(0, 0, 256, 4); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; })();
  const strips = [];
  const strip = (x0, z0, x1, z1, color, dir) => {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.5) return;
    const t = pulse.clone(); t.needsUpdate = true; t.repeat.set(len / 16, 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.26), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(z1 - z0, x1 - x0); m.position.set((x0 + x1) / 2, 0.03, (z0 + z1) / 2);
    scene.add(m); strips.push([t, dir]);
  };
  // Avenue extents now run from coast to coast.
  const wx0 = ends[0].coast[0], wx1 = ends[1].coast[0], ny0 = ends[2].coast[1], ny1 = ends[3].coast[1];
  const ewSegs = [[wx0, cx - plazaR], [cx + plazaR, wx1]], nsSegs = [[ny0, cy - plazaR], [cy + plazaR, ny1]];
  for (const [a, b] of ewSegs) for (const [y, d] of [[ew.y0 + 0.3, 1], [ew.y1 - 0.3, -1]]) strip(W(a), W(y), W(b), W(y), "#4fd8ff", d);
  for (const [a, b] of nsSegs) for (const [x, d] of [[ns.x0 + 0.3, -1], [ns.x1 - 0.3, 1]]) strip(W(x), W(a), W(x), W(b), "#ff4fa3", d);
  const dash = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 0.14), decalMat({ color: "#e8b64a", emissive: "#e8b64a", emissiveIntensity: 0.6, roughness: 0.6 }), 120);
  const zebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.45, 5.2), decalMat({ color: "#d8d2f0", roughness: 0.7 }), 48);
  const o = new THREE.Object3D(); let nd = 0, nz = 0;
  const put = (m, x, z, rot, i) => { o.position.set(x, 0.02, z); o.rotation.set(-Math.PI / 2, 0, rot); o.updateMatrix(); m.setMatrixAt(i, o.matrix); };
  for (const [a, b] of ewSegs) for (let t = a + 1; t < b - 0.5; t += 1.5) put(dash, W(t), W(cy), 0, nd++);
  for (const [a, b] of nsSegs) for (let t = a + 1; t < b - 0.5; t += 1.5) put(dash, W(cx), W(t), Math.PI / 2, nd++);
  for (const [s, e] of [[cx - plazaR - 2.6, cx - plazaR - 0.2], [cx + plazaR + 0.2, cx + plazaR + 2.6]]) for (let t = s; t < e; t += 0.5) { put(zebra, W(t), W(cy), 0, nz++); put(zebra, W(cx), W(t), Math.PI / 2, nz++); }
  dash.count = nd; zebra.count = nz; dash.receiveShadow = zebra.receiveShadow = true;
  scene.add(dash, zebra);
  return (t) => { for (const [tx, d] of strips) tx.offset.x = -((t * 0.18 * d) % 1); };
}

// The plaza's glowing rings and spokes, inlaid in the paving.
function plazaInlay(scene) {
  const SZ = 1024, R = 7.6, c = document.createElement("canvas"); c.width = c.height = SZ;
  const g = c.getContext("2d"), px = SZ / 2, k = (SZ / 2) / R;
  const ring = (r, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.shadowColor = col; g.shadowBlur = 10; g.beginPath(); g.arc(px, px, r * k, 0, Math.PI * 2); g.stroke(); };
  ring(7.2, "#ff4fa3", 7); ring(6.1, "#4fd8ff", 5); ring(3.4, "#ffc94d", 5);
  g.strokeStyle = "#7a5cff"; g.lineWidth = 3; g.shadowColor = "#7a5cff";
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(px + Math.cos(a) * 3.6 * k, px + Math.sin(a) * 3.6 * k); g.lineTo(px + Math.cos(a) * 5.9 * k, px + Math.sin(a) * 5.9 * k); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 * T, R * 2 * T), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(W(CENTER[0]), H_PAVE + 0.01, W(CENTER[1])); scene.add(m);
  return (time) => { m.material.opacity = 0.85 + Math.sin(time * 1.4) * 0.15; };
}

// ------------------------------------------------------------------ bridges and islets
function bridge(scene, { coast, dir, color }, texs) {
  const L = 15, start = new THREE.Vector3(W(coast[0]) - dir[0] * 0.8, 0, W(coast[1]) - dir[1] * 0.8), D = new THREE.Vector3(dir[0], 0, dir[1]);
  const g = new THREE.Group(); g.position.copy(start); g.rotation.y = -Math.atan2(dir[1], dir[0]); scene.add(g);
  // Local +X runs out along the bridge.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L + 0.8, 0.5, 5.4), new THREE.MeshStandardMaterial({ map: texs.asphalt.map, color: "#b9b2d8", roughness: 0.8 }));
  deck.position.set(L / 2, -0.25, 0); deck.receiveShadow = deck.castShadow = true; g.add(deck);
  const keel = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 2.4), M.frame()); keel.position.set(L / 2 + 0.4, -0.9, 0); g.add(keel);
  const glow = M.glow(color, 2.6), posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1, 0.14), M.frame(), 2 * Math.ceil(L / 2.5)), po = new THREE.Object3D(); let np = 0;
  for (const z of [-2.6, 2.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, 0.12), glow); rail.position.set(L / 2 + 0.4, 1.0, z); g.add(rail);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(L + 0.8, 0.08, 0.1), glow); lip.position.set(L / 2, 0.02, z); g.add(lip);
    for (let x = 1; x <= L; x += 2.5) { po.position.set(x, 0.5, z); po.updateMatrix(); posts.setMatrixAt(np++, po.matrix); }
  }
  posts.count = np; g.add(posts);
  // The islet at the far end, with a beacon.
  const R = 6.5, ix = L + R - 0.5, isle = new THREE.Group(); isle.position.set(ix, 0, 0); g.add(isle);
  const grassMat = new THREE.MeshStandardMaterial({ map: texs.grass.map, roughness: 0.95 });
  grassMat.map = texs.grass.map.clone(); grassMat.map.needsUpdate = true; grassMat.map.repeat.set(2, 2);
  const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.96, 0.6, 12), [new THREE.MeshStandardMaterial({ color: "#4b3047", roughness: 1, flatShading: true }), grassMat, grassMat]);
  topDisc.position.y = -0.3; topDisc.receiveShadow = true; isle.add(topDisc);
  const coneGeo = new THREE.ConeGeometry(R * 0.96, 15, 12, 6), p = coneGeo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), depth = y + 7.5;
    if (y > -7.4) { const k = 1 + (Math.random() - 0.5) * 0.25; p.setXYZ(i, p.getX(i) * k, y + (Math.random() - 0.5) * 0.8, p.getZ(i) * k); }
    rockColor(depth, p.getX(i), p.getZ(i)).toArray(col, i * 3);
  }
  coneGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); coneGeo.computeVertexNormals();
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  cone.rotation.x = Math.PI; cone.position.y = -0.6 - 7.5; isle.add(cone);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), M.glow(color, 2.8)); crystal.scale.y = 2.2; isle.add(crystal);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.07, 6, 40), M.glow(color, 3)); ring.rotation.x = Math.PI / 2; isle.add(ring);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.6, 8), M.frame()); isle.add(base);
  const pool = lightPool(color, 5, 0.6); isle.add(pool);
  const ph = Math.random() * 6;
  return (t) => { crystal.position.y = 3 + Math.sin(t * 1.4 + ph) * 0.3; crystal.rotation.y = t * 0.8; ring.position.y = 1.2 + Math.sin(t * 1.4 + ph + 1) * 0.15; ring.rotation.z = t * 0.5; };
}

// ------------------------------------------------------------------ stream and waterfall
function streaks(w, h, seed) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), r = rng(seed);
  g.fillStyle = "rgba(160,225,255,0.35)"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w * 3; i++) { const x = r() * w, y = r() * h, l = 10 + r() * 40; g.fillStyle = `rgba(235,250,255,${0.3 + r() * 0.6})`; g.fillRect(x, y, 1 + r() * 2, l); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function waterfall(scene, { a, b, dir }) {
  // The stream: a strip of moving water from the pond to the edge.
  const ax = W(a[0]), az = W(a[1]), bx = W(b[0]), bz = W(b[1]), len = Math.hypot(bx - ax, bz - az);
  const flow = streaks(64, 256, 5); flow.rotation = Math.PI / 2; flow.center.set(0.5, 0.5); flow.repeat.set(len / 6, 1);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.1), new THREE.MeshStandardMaterial({ map: flow, color: "#6fc6ff", emissive: "#2a7fd6", emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.rotation.z = -Math.atan2(bz - az, bx - ax); water.position.set((ax + bx) / 2, H_PAVE + 0.035, (az + bz) / 2); scene.add(water);
  // The fall: a long sheet hanging off the coast, fading into the clouds.
  const fallTex = streaks(64, 512, 9); fallTex.repeat.set(1, 3);
  const fade = (() => { const c = document.createElement("canvas"); c.width = 4; c.height = 256; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#fff"); gr.addColorStop(0.7, "#888"); gr.addColorStop(1, "#000"); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c); })();
  const HGT = 46, sheet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, HGT, 1, 12), new THREE.MeshBasicMaterial({ map: fallTex, alphaMap: fade, color: "#cdf2ff", transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
  // Bow the sheet outwards a little as it falls.
  const p = sheet.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = (HGT / 2 - p.getY(i)) / HGT; p.setZ(i, k * k * 5); }
  sheet.geometry.computeVertexNormals();
  sheet.position.set(bx + dir[0] * 0.3, 0.1 - HGT / 2, bz + dir[1] * 0.3); sheet.rotation.y = Math.atan2(dir[0], dir[1]);
  scene.add(sheet);
  return (t, dt) => { flow.offset.x -= dt * 0.35; fallTex.offset.y += dt * 1.4; };
}
