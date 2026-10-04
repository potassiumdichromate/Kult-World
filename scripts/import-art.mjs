// Imports the Kult World art from the Assets folder into public/art/world/.
//
//   node scripts/import-art.mjs [assetsDir]
//
// - Painted white/grey "transparency" checkerboards are removed (flood fill
//   from the border), every image is trimmed to its content.
// - world-ground is re-projected so its top face lines up with the 24x24 grid.
// - Sheets (props, stamps, icons, ui-buttons) are split by grid cell.
// - Writes public/art/world/manifest.json with sizes and anchors.
import { readPng, writePng } from "./png.mjs";
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.argv[2] || join(homedir(), "Desktop", "Assets", "Kult-World");
const OUT = join(ROOT, "public", "art", "world");
mkdirSync(OUT, { recursive: true });
const manifest = { rev: "", files: {} };
const hash = createHash("sha1");

const src = (name) => { for (const n of [name, `${name}.png`]) if (existsSync(join(SRC, n))) return join(SRC, n); return null; };
const save = (name, img, extra = {}) => {
  writePng(join(OUT, name), img);
  hash.update(img.data);
  manifest.files[name.replace(/\.png$/, "")] = { file: `world/${name}`, w: img.width, h: img.height, ...extra };
  console.log(`  ${name.padEnd(28)} ${img.width}x${img.height}`);
};

// ------------------------------------------------------------------ image ops
const blank = (w, h) => ({ width: w, height: h, data: Buffer.alloc(w * h * 4) });
function crop(img, x0, y0, w, h) {
  const out = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x0 + x, sy = y0 + y;
    if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
    img.data.copy(out.data, (y * w + x) * 4, (sy * img.width + sx) * 4, (sy * img.width + sx) * 4 + 4);
  }
  return out;
}
function bbox(img, minAlpha = 24) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] >= minAlpha) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
const trim = (img, pad = 2, minAlpha = 24) => { const b = bbox(img, minAlpha); return b ? crop(img, b.x0 - pad, b.y0 - pad, b.x1 - b.x0 + 1 + pad * 2, b.y1 - b.y0 + 1 + pad * 2) : img; };
// Area-average downscale with premultiplied alpha (keeps edges clean).
function resize(img, w, h) {
  const out = blank(w, h), fx = img.width / w, fy = img.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx0 = x * fx, sx1 = (x + 1) * fx, sy0 = y * fy, sy1 = (y + 1) * fy;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      const wx = Math.min(sx + 1, sx1) - Math.max(sx, sx0), wy = Math.min(sy + 1, sy1) - Math.max(sy, sy0), wt = wx * wy;
      const o = (Math.min(sy, img.height - 1) * img.width + Math.min(sx, img.width - 1)) * 4, al = img.data[o + 3] / 255;
      r += img.data[o] * al * wt; g += img.data[o + 1] * al * wt; b += img.data[o + 2] * al * wt; a += al * wt; n += wt;
    }
    const o = (y * w + x) * 4;
    if (a > 0) { out.data[o] = Math.round(r / a); out.data[o + 1] = Math.round(g / a); out.data[o + 2] = Math.round(b / a); }
    out.data[o + 3] = Math.round((a / n) * 255);
  }
  return out;
}
const toWidth = (img, w) => resize(img, w, Math.max(1, Math.round((img.height * w) / img.width)));
const toHeight = (img, h) => resize(img, Math.max(1, Math.round((img.width * h) / img.height)), h);

// Removes a painted checkerboard: flood fill from the border over light,
// unsaturated pixels, then eat the anti-aliased fringe next to the hole.
function removeChecker(img) {
  const { width: W, height: H, data } = img;
  const light = (i, min) => { const o = i * 4, mx = Math.max(data[o], data[o + 1], data[o + 2]), mn = Math.min(data[o], data[o + 1], data[o + 2]); return data[o + 3] > 0 && mn >= min && mx - mn <= 18; };
  const gone = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (gone[i] || !light(i, 188)) continue;
    gone[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
  }
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (let i = 0; i < W * H; i++) if (!gone[i] && light(i, 150)) { const x = i % W; if ((x > 0 && gone[i - 1]) || (x < W - 1 && gone[i + 1]) || gone[i - W] || gone[i + W]) add.push(i); }
    for (const i of add) gone[i] = 1;
  }
  let n = 0;
  for (let i = 0; i < W * H; i++) if (gone[i]) { data[i * 4 + 3] = 0; n++; }
  return n / (W * H);
}
function checkerShare(img) {
  let n = 0; const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (d[i + 3] > 200 && mn > 188 && mx - mn < 18) n++; }
  return n / (img.width * img.height);
}
function load(name) {
  const f = src(name);
  if (!f) { console.warn(`  ! missing ${name}`); return null; }
  const img = readPng(f);
  if (checkerShare(img) > 0.05) console.log(`  ${name}: removed painted checkerboard (${(removeChecker(img) * 100).toFixed(0)}% of the image)`);
  return img;
}
// Split a sheet into cols x rows items. AI sheets are rarely on an exact grid,
// so rows and columns are found from the empty gaps between items (merging
// the smallest gaps away until the expected count is left).
function bands(profile, count) {
  const runs = []; let start = -1;
  profile.forEach((v, i) => { if (v && start < 0) start = i; if (!v && start >= 0) { runs.push([start, i]); start = -1; } });
  if (start >= 0) runs.push([start, profile.length]);
  while (runs.length > count) {
    let k = 0; for (let i = 1; i < runs.length - 1; i++) if (runs[i + 1][0] - runs[i][1] < runs[k + 1][0] - runs[k][1]) k = i;
    runs.splice(k, 2, [runs[k][0], runs[k + 1][1]]);
  }
  return runs.length === count ? runs : null;
}
function cells(img, cols, rows, pad = 2, minAlpha = 60) {
  const { width: W, height: H, data } = img, on = (x, y) => data[(y * W + x) * 4 + 3] >= minAlpha;
  const rowP = Array.from({ length: H }, (_, y) => { let n = 0; for (let x = 0; x < W; x++) n += on(x, y); return n > 2; });
  const even = (n, size) => Array.from({ length: n }, (_, i) => [Math.round((i * size) / n), Math.round(((i + 1) * size) / n)]);
  const out = [];
  for (const [y0, y1] of bands(rowP, rows) || even(rows, H)) {
    const colP = Array.from({ length: W }, (_, x) => { let n = 0; for (let y = y0; y < y1; y++) n += on(x, y); return n > 2; });
    for (const [x0, x1] of bands(colP, cols) || even(cols, W)) out.push(trim(crop(img, x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12), pad, 12));
  }
  return out;
}

// ------------------------------------------------------------------ ground
// Find the island's top face (top vertex, left and right vertices) and
// re-project it so the 24x24 grid lands exactly on world.js's iso().
console.log("world");
{
  const img = load("world-ground.png");
  if (img) {
    const { width: W, height: H, data } = img, A = (x, y) => data[(y * W + x) * 4 + 3] > 128;
    let top = null, left = null, right = null;
    for (let y = 0; y < H && !top; y++) { const xs = []; for (let x = 0; x < W; x++) if (A(x, y)) xs.push(x); if (xs.length) top = [(xs[0] + xs[xs.length - 1]) / 2, y]; }
    for (let x = 0; x < W && !left; x++) for (let y = 0; y < H; y++) if (A(x, y)) { left = [x, y]; break; }
    for (let x = W - 1; x >= 0 && !right; x--) for (let y = 0; y < H; y++) if (A(x, y)) { right = [x, y]; break; }
    // Target: top (768,216), left (0,600), right (1536,600).
    const sx = 1536 / (right[0] - left[0]), sy = 384 / (((left[1] + right[1]) / 2) - top[1]);
    const out = blank(1536, 1024);
    for (let y = 0; y < 1024; y++) for (let x = 0; x < 1536; x++) {
      const u = Math.round(left[0] + x / sx), v = Math.round(top[1] + (y - 216) / sy);
      if (u >= 0 && v >= 0 && u < W && v < H) data.copy(out.data, (y * 1536 + x) * 4, (v * W + u) * 4, (v * W + u) * 4 + 4);
    }
    console.log(`  ground fit: top ${top.map(Math.round)}, left ${left}, right ${right}, scale ${sx.toFixed(3)} x ${sy.toFixed(3)}`);
    save("ground.png", out);
  }
}

// ------------------------------------------------------------------ buildings
// Anchor = the bottom vertex of the footprint, in sprite px.
for (const [name, width] of [["building-park.png", 420], ["building-arcade.png", 420]]) {
  const img = load(name); if (!img) continue;
  const t = toWidth(trim(img), width), b = bbox(t, 128);
  let sum = 0, n = 0; for (let x = 0; x < t.width; x++) if (t.data[(b.y1 * t.width + x) * 4 + 3] >= 128) { sum += x; n++; }
  save(name.replace("building-", "bld-"), t, { anchor: [Math.round(sum / n), b.y1] });
}

// ------------------------------------------------------------------ props
{
  const img = load("props.png");
  if (img) {
    // tree lamp bench bush / flower fountain spawn crane: target heights (world px).
    const spec = [["tree", 104], ["lamp", 78], ["bench", 40], ["bush", 46], ["flower", 30], ["fountain", 118], ["spawn", 34], ["crane", 210]];
    cells(img, 4, 2).forEach((c, i) => { const [k, h] = spec[i], s = toHeight(c, h); save(`prop-${k}.png`, s, { anchor: [Math.round(s.width / 2), s.height - 3] }); });
  }
}

// ------------------------------------------------------------------ cards, monitor, logo, passport
console.log("ui");
for (const k of ["create", "sports", "dex", "production"]) { const img = load(`card-${k}.png`); if (img) save(`card-${k}.png`, toWidth(trim(img), 720)); }
{
  const img = load("monitor.png");
  if (img) {
    const t = trim(img, 0), { width: W, height: H, data } = t;
    // Screen = the biggest near-black rectangle: scan the centre row and column.
    const dark = (x, y) => { const o = (y * W + x) * 4; return data[o] + data[o + 1] + data[o + 2] < 40 && data[o + 3] > 200; };
    const cy = Math.round(H * 0.42), cx = Math.round(W / 2);
    let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
    while (x0 > 0 && dark(x0 - 1, cy)) x0--; while (x1 < W - 1 && dark(x1 + 1, cy)) x1++;
    while (y0 > 0 && dark(cx, y0 - 1)) y0--; while (y1 < H - 1 && dark(cx, y1 + 1)) y1++;
    const s = toWidth(t, 960), k = 960 / W;
    save("monitor.png", s, { screen: [x0, y0, x1 + 1, y1 + 1].map((v) => Math.round(v * k)) });
  }
}
{ const img = load("logo-kult-world.png"); if (img) save("logo.png", toWidth(trim(img), 900)); }
{ const img = load("passport-bg.png"); if (img) save("passport-bg.png", toWidth(trim(img, 0), 760)); }

// ------------------------------------------------------------------ sheets
{
  const img = load("stamps.png");
  if (img) ["park", "arcade", "create", "sports", "dex", "production"].forEach((k, i) => save(`stamp-${k}.png`, toWidth(cells(img, 3, 2)[i], 128)));
}
{
  const img = load("icons.png");
  if (img) {
    const names = ["close", "menu", "back", "settings", "google", "email", "wallet", "play", "skip", "lock", "newtab", "info", "close-hot", "menu-hot", "play-hot", "lock-hot"];
    cells(img, 4, 4).forEach((c, i) => save(`icon-${names[i]}.png`, toWidth(c, 64)));
  }
}
{
  const img = load("tokens.png");
  if (img) ["arena", "kp", "kult", "xp", "elo", "quest"].forEach((k, i) => save(`token-${k}.png`, toWidth(cells(img, 3, 2)[i], 64)));
}
{
  const img = load("ui-buttons.png");
  if (img) {
    const rows = ["primary", "hero", "secondary", "ghost", "gold", "small"], states = ["normal", "hover", "pressed", "disabled"];
    const all = cells(img, 4, 6, 0);
    rows.forEach((r, ri) => states.forEach((s, si) => { const c = all[ri * 4 + si]; save(`btn-${r}-${s}.png`, toHeight(c, Math.round(c.height / 2))); }));
  }
}

// Game thumbnails: thumb-<game>.png (resized), else a .webp copied as is
// (thumb-<game>.webp, or the Kult browser's original file name).
for (const [id, legacy] of [["warzone", "warzoneWarriors.webp"], ["robowars", "robowar.webp"], ["wave", "warzonewarriorswave.webp"], ["highway", "highwayhustle.webp"]]) {
  const png = src(`thumb-${id}.png`), isPng = png && readFileSync(png).readUInt32BE(0) === 0x89504e47;
  if (isPng) { save(`thumb-${id}.png`, toWidth(load(`thumb-${id}.png`), 640)); continue; }
  const f = [`thumb-${id}.webp`, `thumb-${id}.png.webp`, legacy].map((n) => existsSync(join(SRC, n)) && join(SRC, n)).find(Boolean);
  if (!f) { console.warn(`  ! missing thumb-${id}`); continue; }
  copyFileSync(f, join(OUT, `thumb-${id}.webp`)); manifest.files[`thumb-${id}`] = { file: `world/thumb-${id}.webp` }; console.log(`  thumb-${id}.webp`);
}

manifest.rev = hash.digest("hex").slice(0, 10);
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`manifest rev ${manifest.rev}, ${Object.keys(manifest.files).length} files`);
