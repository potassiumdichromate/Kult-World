// Generates the Kult World art templates in docs/templates/ from the real
// world layout (public/js/world.js), so painted art lines up 1:1.
//   node scripts/world-templates.mjs

import { Img, OUT } from "./tpl-lib.mjs";
import { BUILDINGS, MAP, SPAWN, iso, LAYOUT } from "../public/js/world.js";
import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const GUIDE = "#1a1033", MAG = "#ff00ff";
const { tiles, LOT, FOUNTAIN, PROPS } = LAYOUT;
const diamond = (x0, y0, x1, y1, z = 0) => [iso(x0, y0, z), iso(x1, y0, z), iso(x1, y1, z), iso(x0, y1, z)];

// ------------------------------------------------------------------ 1. world ground (1536x1024, 1:1)
function ground(annotated) {
  const img = new Img(1536, 1024, "#0b0717");
  // Island edge.
  img.poly([iso(MAP, 0), iso(MAP, MAP), [iso(MAP, MAP)[0], iso(MAP, MAP)[1] + 26], [iso(MAP, 0)[0], iso(MAP, 0)[1] + 26]], "#1a1030");
  img.poly([iso(0, MAP), iso(MAP, MAP), [iso(MAP, MAP)[0], iso(MAP, MAP)[1] + 26], [iso(0, MAP)[0], iso(0, MAP)[1] + 26]], "#24163f");
  for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) {
    const k = tiles[x][y];
    img.poly(diamond(x, y, x + 1, y + 1), k === "g" ? "#22513f" : k === "w" ? "#443c6a" : "#524a7a");
    img.outline(diamond(x, y, x + 1, y + 1), k === "g" ? "#1b4234" : "#3a335c", 1);
  }
  img.outline(diamond(0, 0, MAP, MAP), "#ece8ff", 2);
  if (annotated) {
    for (const b of BUILDINGS) { img.outline(diamond(b.x0, b.y0, b.x1, b.y1), "#f2c14e", 3, 8); const [cx, cy] = iso((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); img.text(b.name.toUpperCase(), cx, cy - 8, 2, "#f2c14e", "center"); img.text("BUILDING SPRITE (SEPARATE)", cx, cy + 10, 2, "#f2c14e", "center"); }
    img.outline(diamond(FOUNTAIN.x0, FOUNTAIN.y0, FOUNTAIN.x1, FOUNTAIN.y1), "#5ec8f2", 2, 5); img.text("FOUNTAIN", ...iso(13, 13).map((v, i) => (i ? v + 22 : v)), 2, "#5ec8f2", "center");
    img.outline(diamond(LOT.x0, LOT.y0, LOT.x1, LOT.y1), "#ff9f5a", 2, 6); img.text("NEW DISTRICT LOT", ...iso((LOT.x0 + LOT.x1) / 2, (LOT.y0 + LOT.y1) / 2), 2, "#ff9f5a", "center");
    const [sx, sy] = iso(SPAWN[0], SPAWN[1]); img.outline([[sx - 30, sy], [sx, sy - 15], [sx + 30, sy], [sx, sy + 15]], "#ff7eb6", 2, 4); img.text("SPAWN", sx, sy + 18, 2, "#ff7eb6", "center");
    for (const p of PROPS) { const [x, y] = iso(p.x, p.y); img.rect(x - 3, y - 3, 6, 6, { tree: "#7ee081", lamp: "#fff3a0", bench: "#c8a27a", bush: "#2a8059", flower: "#ff7eb6" }[p.kind] || "#fff"); }
    for (const b of BUILDINGS) { const [dx, dy] = iso(b.door.tile[0] + 0.5, b.door.tile[1] + 0.5); img.rect(dx - 5, dy - 5, 10, 10, "#ff4fa3"); img.text("DOOR", dx, dy + 8, 2, "#ff4fa3", "center"); }
    img.text("KULT WORLD GROUND - 1536X1024 - TILE 64X32 - 24X24 TILES", 768, 30, 3, "#ece8ff", "center");
    img.text("PAINT GROUND ONLY: GRASS, PLAZA STONE, PATHS, ISLAND EDGE. BUILDINGS, FOUNTAIN AND PROPS ARE SEPARATE SPRITES.", 768, 60, 2, "#a49cd0", "center");
    img.text("DOTS = PROP SPOTS (GREEN TREE, YELLOW LAMP, TAN BENCH, DARK GREEN BUSH, PINK FLOWERS). PINK SQUARES = DOORS.", 768, 80, 2, "#a49cd0", "center");
  }
  img.save(annotated ? "world-ground-annotated.png" : "world-ground-guide.png");
}

// ------------------------------------------------------------------ 2. buildings (1024x1024 each, 2x)
function building(b, annotated) {
  const S = 2, img = new Img(1024, 1024, MAG);
  // Map the building's world box into the image at 2x, footprint centred low.
  const fp = diamond(b.x0, b.y0, b.x1, b.y1);
  const minX = Math.min(...fp.map((p) => p[0])), maxX = Math.max(...fp.map((p) => p[0])), maxY = Math.max(...fp.map((p) => p[1]));
  const ox = 512 - ((minX + maxX) / 2) * S, oy = 900 - maxY * S;
  const T = ([x, y]) => [ox + x * S, oy + y * S];
  const P = (x, y, z = 0) => T(iso(x, y, z));
  const box = (z) => [P(b.x0, b.y0, z), P(b.x1, b.y0, z), P(b.x1, b.y1, z), P(b.x0, b.y1, z)];
  img.poly(box(0), "#120b28", 90);
  img.outline(box(0), GUIDE, 3);
  img.outline(box(b.h), GUIDE, 2, 10);
  for (const [x, y] of [[b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]) img.line(...P(x, y, 0), ...P(x, y, b.h), GUIDE, 2, 10);
  // Roof sign area (front-left edge).
  const sg = [P(b.x0 + (b.x1 - b.x0) * 0.1, b.y1 - 0.4, b.h + 66), P(b.x0 + (b.x1 - b.x0) * 0.9, b.y1 - 0.4, b.h + 66), P(b.x0 + (b.x1 - b.x0) * 0.9, b.y1 - 0.4, b.h + 4), P(b.x0 + (b.x1 - b.x0) * 0.1, b.y1 - 0.4, b.h + 4)];
  img.outline(sg, "#0b6b9a", 2, 6);
  // Door.
  const fpt = (u, z) => (b.door.face === "x" ? P(b.x1, b.y0 + (b.y1 - b.y0) * u, z) : P(b.x0 + (b.x1 - b.x0) * u, b.y1, z));
  const dr = [fpt(b.door.u - 0.08, 34), fpt(b.door.u + 0.08, 34), fpt(b.door.u + 0.08, 0), fpt(b.door.u - 0.08, 0)];
  img.poly(dr, "#ff4fa3", 160);
  if (annotated) {
    img.text(b.name.toUpperCase(), 512, 30, 4, GUIDE, "center");
    img.text(`FOOTPRINT ${b.x1 - b.x0}X${b.y1 - b.y0} TILES - WALLS ${b.h} PX - DRAWN AT 2X`, 512, 70, 2, GUIDE, "center");
    img.text("BLUE DASHED = ROOF SIGN AREA (LEAVE BLANK: THE NEON TEXT IS LIVE)", 512, 92, 2, GUIDE, "center");
    img.text("PINK = MAIN DOOR (GLOWS AND OPENS THE BUILDING)", 512, 112, 2, GUIDE, "center");
    img.text("FILL THE DASHED BOX: FLOOR TO ROOF. TRANSPARENT AROUND IT.", 512, 980, 2, GUIDE, "center");
  }
  img.save(`building-${b.id}-${annotated ? "annotated" : "guide"}.png`);
}

// ------------------------------------------------------------------ 3. props sheet (1536x1024, 3x)
function props(annotated) {
  const img = new Img(1536, 1024, MAG), S = 3;
  const items = [["TREE (3 VARIANTS OK)", 0.7, 0.7, 70], ["STREET LAMP", 0.25, 0.25, 56], ["BENCH", 0.9, 0.4, 20], ["BUSH", 0.7, 0.5, 18], ["FLOWER BED", 0.8, 0.4, 8], ["FOUNTAIN + KULT CRYSTAL", 2, 2, 60], ["SPAWN PAD (FLAT)", 1.2, 1.2, 2], ["CONSTRUCTION CRANE", 0.6, 0.6, 160]];
  items.forEach(([label, w, d, h], i) => {
    const col = i % 4, row = Math.floor(i / 4), x0 = col * 384, y0 = row * 512;
    img.frame(x0, y0, 384, 512, GUIDE, 2);
    const cx = x0 + 192, cy = y0 + 400, k = Math.min(S, 300 / ((w + d) * 32), 330 / (h + (w + d) * 16));
    const P = (gx, gy, z = 0) => [cx + (gx - gy) * 32 * k, cy + (gx + gy) * 16 * k - z * k];
    const fx = -w / 2, fy = -d / 2;
    const base = [P(fx, fy), P(fx + w, fy), P(fx + w, fy + d), P(fx, fy + d)], top = [P(fx, fy, h), P(fx + w, fy, h), P(fx + w, fy + d, h), P(fx, fy + d, h)];
    img.poly(base, "#120b28", 70); img.outline(base, GUIDE, 3); img.outline(top, GUIDE, 2, 8);
    for (let j = 1; j < 4; j++) img.line(...base[j], ...top[j], GUIDE, 2, 8);
    if (annotated) { img.text(label, cx, y0 + 24, 2, GUIDE, "center"); img.text(`${w}X${d} TILES`, cx, y0 + 470, 2, GUIDE, "center"); img.text(`${h} PX TALL`, cx, y0 + 490, 2, GUIDE, "center"); }
  });
  img.save(annotated ? "props-annotated.png" : "props-guide.png");
}

// ------------------------------------------------------------------ 4. computer monitor (1536x1024)
function monitor(annotated) {
  const img = new Img(1536, 1024, MAG);
  // Screen hole: 16:9, 1200x675, centred a bit high.
  const sx = 168, sy = 150, sw = 1200, sh = 675;
  img.frame(sx - 60, sy - 50, sw + 120, sh + 120, GUIDE, 4);            // bezel outer
  img.rect(sx, sy, sw, sh, "#000000");                                    // the screen (keep pure black)
  img.frame(sx, sy, sw, sh, "#5ec8f2", 3);
  img.frame(668, 925, 200, 90, GUIDE, 3);                                 // stand
  if (annotated) {
    img.text("KULT ARCADE COMPUTER - SCREEN AREA KEEP PURE BLACK (GAME IS LIVE)", 768, 30, 3, GUIDE, "center");
    img.text("SCREEN 1200X675 (16:9) - BEZEL AROUND IT - STAND BELOW - TRANSPARENT BACKGROUND", 768, 58, 2, GUIDE, "center");
    img.text("BLACK = LIVE GAME", 768, 480, 4, "#5ec8f2", "center");
    img.text("TITLE BAR / LIGHTS / BRAND PLATE GO ON THE BEZEL", 768, 855, 2, GUIDE, "center");
  }
  img.save(annotated ? "monitor-annotated.png" : "monitor-guide.png");
}

// ------------------------------------------------------------------ 5. cards (business + game art, 16:9)
function cards(annotated) {
  const img = new Img(1536, 1024, "#0b0717");
  const labels = ["GAMING STUDIO", "SPORTS MARKET", "DEX TRADING", "ENTERTAINMENT PROD.", "WARZONE WARRIORS", "ROBOWARS", "WARZONE WAVE", "HIGHWAY HUSTLE"];
  labels.forEach((l, i) => {
    const col = i % 4, row = Math.floor(i / 4), w = 352, h = 198, x = 16 + col * (w + 32), y = 180 + row * (h + 220);
    img.rect(x, y, w, h, "#1d1640"); img.frame(x, y, w, h, "#382c6c", 3);
    img.frame(x + 18, y + 10, w - 36, h - 20, "#5ec8f2", 2);           // safe area
    if (annotated) { img.text(l, x + w / 2, y + h + 14, 2, "#f2c14e", "center"); img.text("16:9 - NO TEXT", x + w / 2, y + h / 2 - 6, 2, "#a49cd0", "center"); }
  });
  if (annotated) {
    img.text("CARD ART - 16:9 - DELIVER AT 1536X864 - KEEP THE SUBJECT INSIDE THE BLUE SAFE AREA", 768, 40, 2, "#ece8ff", "center");
    img.text("TOP ROW: BUSINESS PARK CARDS - BOTTOM ROW: ARCADE GAME THUMBNAILS", 768, 64, 2, "#a49cd0", "center");
  }
  img.save(annotated ? "cards-annotated.png" : "cards-guide.png");
}

ground(true); ground(false);
for (const b of BUILDINGS) { building(b, true); building(b, false); }
props(true); props(false);
monitor(true); monitor(false);
cards(true); cards(false);
