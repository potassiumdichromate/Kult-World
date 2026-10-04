// Generates the art-direction templates in docs/art/templates/ (no deps).
// Run: node scripts/art-templates.mjs
//
// Every template is drawn at the office's "2x" asset scale: one isometric
// floor tile is 64x32 px (the live renderer uses 32x16 and will draw 2x
// assets at half size, so new art has twice the detail of today's shapes).

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "templates");
mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ raster + PNG
class Img {
  constructor(w, h, bg = "#000000") { this.w = w; this.h = h; this.px = Buffer.alloc(w * h * 4); this.fill(bg); }
  static rgba(hex, a = 255) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255, a]; }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, a = c[3] / 255;
    this.px[i] = this.px[i] * (1 - a) + c[0] * a; this.px[i + 1] = this.px[i + 1] * (1 - a) + c[1] * a;
    this.px[i + 2] = this.px[i + 2] * (1 - a) + c[2] * a; this.px[i + 3] = 255;
  }
  fill(hex) { const c = Img.rgba(hex); for (let i = 0; i < this.px.length; i += 4) this.px.set(c, i); }
  rect(x, y, w, h, hex, a) { const c = Img.rgba(hex, a); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  frame(x, y, w, h, hex, t = 2) { this.rect(x, y, w, t, hex); this.rect(x, y + h - t, w, t, hex); this.rect(x, y, t, h, hex); this.rect(x + w - t, y, t, h, hex); }
  line(x0, y0, x1, y1, hex, t = 1, dash = 0) {
    const c = Img.rgba(hex), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= n; s++) {
      if (dash && Math.floor(s / dash) % 2) continue;
      const x = x0 + ((x1 - x0) * s) / n, y = y0 + ((y1 - y0) * s) / n;
      for (let i = 0; i < t; i++) for (let j = 0; j < t; j++) this.set(x + i - (t >> 1), y + j - (t >> 1), c);
    }
  }
  poly(pts, hex, a) { // even-odd scanline fill
    const c = Img.rgba(hex, a), ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c);
    }
  }
  outline(pts, hex, t = 2, dash = 0) { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; this.line(a[0], a[1], b[0], b[1], hex, t, dash); } }
  text(str, x, y, scale, hex, align = "left") {
    const s = String(str).toUpperCase(), adv = 6 * scale, width = s.length * adv - scale;
    let cx = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
    const c = Img.rgba(hex);
    for (const ch of s) {
      const g = FONT[ch] || FONT["?"];
      for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
        if (g[row] >> (4 - col) & 1) for (let i = 0; i < scale; i++) for (let j = 0; j < scale; j++) this.set(cx + col * scale + i, y + row * scale + j, c);
      }
      cx += adv;
    }
  }
  png() {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) { raw[y * (this.w * 4 + 1)] = 0; this.px.copy(raw, y * (this.w * 4 + 1) + 1, y * this.w * 4, (y + 1) * this.w * 4); }
    const chunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      const td = Buffer.concat([Buffer.from(type), data]);
      const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
      return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
  }
  save(name) { writeFileSync(join(OUT, name), this.png()); console.log("wrote", name, `${this.w}x${this.h}`); }
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return c ^ -1; };

// 5x7 bitmap font (rows, 5 bits each).
const FONT = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [30, 1, 1, 14, 1, 1, 30],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 12, 12], ":": [0, 12, 12, 0, 12, 12, 0], "-": [0, 0, 0, 31, 0, 0, 0],
  "/": [1, 1, 2, 4, 8, 16, 16], "(": [2, 4, 8, 8, 8, 4, 2], ")": [8, 4, 2, 2, 2, 4, 8], "#": [10, 10, 31, 10, 31, 10, 10],
  "X_": [17, 10, 4, 10, 17, 0, 0], "?": [14, 17, 1, 2, 4, 0, 4], "'": [4, 4, 8, 0, 0, 0, 0], ",": [0, 0, 0, 0, 12, 4, 8],
  "+": [0, 4, 4, 31, 4, 4, 0], "=": [0, 0, 31, 0, 31, 0, 0], "%": [24, 25, 2, 4, 8, 19, 3]
};
FONT["×"] = FONT.X_;

// ------------------------------------------------------------------ shared style
const BG = "#ff00ff";            // chroma background the importer will key out
const GUIDE = "#1a1033";         // guide lines on magenta
const PAL = [
  ["Night sky", "#1a1033"], ["Wall left", "#2e2457"], ["Wall right", "#3a2f6e"], ["Wall trim", "#56489a"],
  ["Floor wood", "#74513f"], ["Floor wood dark", "#6b4a3a"], ["Desk top", "#c8a27a"], ["Chair", "#4b4275"],
  ["Monitor", "#2a2a3a"], ["Screen glow", "#7ee0ff"], ["KULT pink", "#ff7eb6"], ["KULT blue", "#5ec8f2"],
  ["Green", "#7ee081"], ["Gold", "#f2c14e"], ["Orange", "#ff9f5a"], ["Coral", "#f78c6b"],
  ["Lilac", "#c792ea"], ["Periwinkle", "#9fa8ff"], ["Mint", "#4dd4ac"], ["Butter", "#ffd166"],
  ["Ink outline", "#120d26"], ["Paper", "#fffdf5"]
];

// Isometric projection at 2x: tile 64x32.
const isoAt = (ox, oy, s = 1) => (gx, gy, z = 0) => [ox + (gx - gy) * 32 * s, oy + (gx + gy) * 16 * s - z * s];


export { Img, isoAt, PAL, GUIDE, BG, OUT };
