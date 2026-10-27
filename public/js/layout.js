// Kult World map: a 48x48 tile floating island. Shared by the 3D world, the
// pathfinding and the minimap. Grid x runs east (world +X), grid y runs south
// (world +Z); the isometric camera looks from the south-east, so every building
// faces south (+y) toward it, tall things sit north-west (the back) and the
// south-east (the front) stays low: lawns, pond, trees.

export const MAP = 48;

// Tile kinds: g grass, r road, p plaza/paving, w water, c construction, e edge (no-go rim).
export const tiles = Array.from({ length: MAP }, () => Array(MAP).fill("g"));
const paint = (x0, y0, x1, y1, k) => { for (let x = Math.max(0, x0); x < Math.min(MAP, x1); x++) for (let y = Math.max(0, y0); y < Math.min(MAP, y1); y++) tiles[x][y] = k; };
const disc = (cx, cy, r, k) => { for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) tiles[x][y] = k; };

// Districts
export const CONSTRUCTION = { x0: 2, y0: 2, x1: 21, y1: 12 };
export const DISTRICTS = [
  { id: "plaza", name: "Kult Plaza", x0: 17, y0: 17, x1: 32, y1: 32 },
  { id: "new", name: "New District", ...CONSTRUCTION },
  { id: "business", name: "Business District", x0: 2, y0: 12, x1: 23, y1: 23 },
  { id: "arcade", name: "Arcade Row", x0: 25, y0: 2, x1: 46, y1: 23 },
  { id: "market", name: "Market Street", x0: 2, y0: 26, x1: 23, y1: 46 },
  { id: "garden", name: "Neon Gardens", x0: 26, y0: 26, x1: 46, y1: 46 }
];

// Roads: a cross through the plaza, plus forecourts to each building.
paint(3, 23, 45, 26, "r");          // east-west avenue
paint(23, 3, 26, 45, "r");          // north-south avenue
paint(8, 21, 19, 23, "p");          // Business Park forecourt
paint(26, 16, 37, 19, "p");         // Arcade forecourt
paint(CONSTRUCTION.x0, CONSTRUCTION.y0, CONSTRUCTION.x1, CONSTRUCTION.y1, "c"); // New District
disc(24.5, 24.5, 7, "p");           // Kult Plaza
export const POND = { x: 37.5, y: 37.5, r: 3.6 };
disc(POND.x, POND.y, POND.r, "w");  // Neon Gardens pond
paint(36, 26, 39, 33, "p");         // garden path to the pond
for (let i = 0; i < MAP; i++) { tiles[i][0] = tiles[i][MAP - 1] = tiles[0][i] = tiles[MAP - 1][i] = "e"; }

// Buildings. Footprint in tiles (x1/y1 exclusive); door = the walkable tile
// in front of the entrance.
export const BUILDINGS = [
  {
    id: "park", name: "Kult Business Park", x0: 9, y0: 13, x1: 18, y1: 21, door: { tile: [13, 21] },
    color: "#ffc94d", accent: "#5ec8f2", blurb: "Run a studio or a sports agency"
  },
  {
    id: "arcade", name: "Kult Arcade", x0: 27, y0: 7, x1: 36, y1: 16, door: { tile: [31, 16] },
    color: "#ff4fa3", accent: "#4fd8ff", blurb: "AI vs AI battles"
  }
];
// Holographic "coming soon" buildings in the New District (not enterable).
export const HOLOS = [
  { id: "dex", name: "KULT DEX", x0: 4, y0: 3, x1: 10, y1: 9, h: 22, color: "#4fd8ff" },
  { id: "production", name: "KULT PRODUCTION", x0: 12, y0: 3, x1: 18, y1: 10, h: 15, color: "#ff7eb6" }
];
export const FOUNTAIN = { x: 24.5, y: 24.5, r: 2.2 };
export const SPAWN = [24.5, 30.2];

// ------------------------------------------------------------------ walkability
export const blocked = Array.from({ length: MAP }, () => Array(MAP).fill(false));
const block = (x0, y0, x1, y1) => { for (let x = Math.max(0, x0); x < Math.min(MAP, x1); x++) for (let y = Math.max(0, y0); y < Math.min(MAP, y1); y++) blocked[x][y] = true; };
for (const b of BUILDINGS) block(b.x0, b.y0, b.x1, b.y1);
block(CONSTRUCTION.x0, CONSTRUCTION.y0, CONSTRUCTION.x1, CONSTRUCTION.y1);
for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) {
  if (tiles[x][y] === "w" || tiles[x][y] === "e") blocked[x][y] = true;
  if (Math.hypot(x + 0.5 - FOUNTAIN.x, y + 0.5 - FOUNTAIN.y) < FOUNTAIN.r + 0.4) blocked[x][y] = true;
}

// ------------------------------------------------------------------ props
// kind, x, y (tile coords, may be fractional), optional rot / variant.
export const PROPS = [];
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const free = (x, y, r = 0) => {
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
    if (tx < 1 || ty < 1 || tx >= MAP - 1 || ty >= MAP - 1 || blocked[tx][ty] || tiles[tx][ty] !== "g") return false;
  }
  return true;
};
const put = (kind, x, y, extra = {}, solid = true) => { PROPS.push({ kind, x, y, ...extra }); if (solid) blocked[Math.floor(x)][Math.floor(y)] = true; };

// Street lamps along both avenues.
for (let i = 4; i < 44; i += 4) {
  if (i > 15 && i < 33) continue;
  put("lamp", i + 0.5, 22.4, { glow: i % 8 ? "#ffd27a" : "#4fd8ff" }, false);
  put("lamp", i + 0.5, 26.6, { glow: i % 8 ? "#ffd27a" : "#4fd8ff" }, false);
  put("lamp", 22.4, i + 0.5, { glow: i % 8 ? "#ffd27a" : "#ff7eb6" }, false);
  put("lamp", 26.6, i + 0.5, { glow: i % 8 ? "#ffd27a" : "#ff7eb6" }, false);
}
// Plaza ring lamps and benches.
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
  put("lamp", 24.5 + Math.cos(a) * 6.2, 24.5 + Math.sin(a) * 6.2, { glow: i % 2 ? "#ff7eb6" : "#4fd8ff" }, false);
}
for (const [x, y, rot] of [[20.2, 21.2, 0.8], [28.8, 21.2, -0.8], [20.2, 27.8, 2.4]]) put("bench", x, y, { rot });
// Pink blossom trees around the plaza.
for (const [x, y] of [[18.5, 18.5], [30.5, 18.5], [18.5, 30.5], [30.5, 30.5]]) put("blossom", x, y);
// Trees: dense in the north-west and the gardens, scattered elsewhere.
const scatter = (x0, y0, x1, y1, n, kinds) => {
  for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    if (!free(x, y, 1)) continue;
    put(kinds[Math.floor(rnd() * kinds.length)], x, y, { s: 0.8 + rnd() * 0.5, rot: rnd() * 6.28 });
    i++;
  }
};
scatter(37, 2, 46, 22, 14, ["pine", "tree", "pine"]);
scatter(2, 12, 9, 22, 8, ["tree", "pine", "bush"]);
scatter(2, 27, 22, 46, 24, ["tree", "blossom", "tree", "bush"]);
scatter(27, 27, 46, 46, 16, ["blossom", "bush", "tree", "bush"]);
// Garden benches by the pond and flower beds.
for (const [x, y, rot] of [[33.6, 33.4, 0.8], [41.4, 33.4, -0.8], [33.4, 41.6, 2.4]]) if (free(x, y)) put("bench", x, y, { rot });
for (let i = 0; i < 22; i++) { const x = 27 + rnd() * 18, y = 27 + rnd() * 18; if (free(x, y)) put("flowers", x, y, { rot: rnd() * 6.28 }, false); }
for (let i = 0; i < 10; i++) { const x = 3 + rnd() * 18, y = 28 + rnd() * 17; if (free(x, y)) put("flowers", x, y, { rot: rnd() * 6.28 }, false); }
// Billboards and parked hover-cars.
put("billboard", 40.5, 9.5, { rot: 0, ad: 0 });
put("billboard", 7, 29, { rot: 0, ad: 1 });
put("billboard", 21.4, 15, { rot: 0, ad: 2 });
for (const [x, y, c] of [[38.6, 22.2, "#ff4fa3"], [41.8, 22.2, "#4fd8ff"], [27.6, 22.2, "#ffc94d"], [5.6, 26.8, "#7ee081"], [9.2, 26.8, "#a98bff"]]) put("car", x, y, { color: c }, false);
// The construction crane.
put("crane", 19.4, 4.5);

export const walkable = (x, y) => x >= 0 && y >= 0 && x < MAP && y < MAP && !blocked[x][y];

// Random walkable tile on paving or roads (for wandering agents).
export function randomStreetTile(rand = Math.random) {
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(rand() * MAP), y = Math.floor(rand() * MAP);
    if (walkable(x, y) && (tiles[x][y] === "r" || tiles[x][y] === "p")) return [x, y];
  }
  return [Math.floor(SPAWN[0]), Math.floor(SPAWN[1])];
}

// ------------------------------------------------------------------ A* (8-way, no corner cutting)
export function findPath([sx, sy], [tx, ty]) {
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (!walkable(tx, ty)) return null;
  const key = (x, y) => y * MAP + x, open = [[sx, sy]], came = new Map(), g = new Map([[key(sx, sy), 0]]);
  const h = (x, y) => Math.hypot(tx - x, ty - y);
  const f = new Map([[key(sx, sy), h(sx, sy)]]), closed = new Set();
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(key(...open[i])) < f.get(key(...open[bi]))) bi = i;
    const [cx, cy] = open.splice(bi, 1)[0], ck = key(cx, cy);
    if (cx === tx && cy === ty) {
      const out = []; let k = ck;
      while (k !== key(sx, sy)) { out.unshift([(k % MAP) + 0.5, Math.floor(k / MAP) + 0.5]); k = came.get(k); }
      return smooth([[sx + 0.5, sy + 0.5], ...out]).slice(1);
    }
    closed.add(ck);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy, nk = key(nx, ny);
      if (!walkable(nx, ny) || closed.has(nk)) continue;
      if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
      const ng = g.get(ck) + (dx && dy ? 1.414 : 1);
      if (ng < (g.get(nk) ?? Infinity)) { came.set(nk, ck); g.set(nk, ng); f.set(nk, ng + h(nx, ny)); if (!open.some(([a, b]) => a === nx && b === ny)) open.push([nx, ny]); }
    }
  }
  return null;
}
// Drop waypoints that have a clear straight line between their neighbours.
function lineClear([x0, y0], [x1, y1]) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
  for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for (const [ox, oy] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) if (!walkable(Math.floor(x + ox), Math.floor(y + oy))) return false; }
  return true;
}
function smooth(pts) {
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !lineClear(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
  return out;
}
