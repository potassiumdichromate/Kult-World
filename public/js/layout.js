// Kult World map: a 56x56 tile floating island. Shared by the 3D world, the
// pathfinding and the minimap. Grid x runs east (world +X), grid y runs south
// (world +Z). The isometric camera looks from the south-east, so every building
// faces south (+y) toward it, tall things sit at the back (small x+y) and the
// front (large x+y) stays low: lawns, the pond, trees.

export const MAP = 56;

// Tile kinds: g grass, r road, p paving, w water, c campus lawn, v void (off the island).
export const tiles = Array.from({ length: MAP }, () => Array(MAP).fill("g"));
// Every painted shape, in order, so the terrain can draw exact (round) versions.
export const SHAPES = [];
const paint = (x0, y0, x1, y1, k) => { SHAPES.push({ k, rect: [x0, y0, x1, y1] }); for (let x = Math.max(0, x0); x < Math.min(MAP, x1); x++) for (let y = Math.max(0, y0); y < Math.min(MAP, y1); y++) tiles[x][y] = k; };
const disc = (cx, cy, r, k) => { SHAPES.push({ k, circle: [cx, cy, r] }); for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) tiles[x][y] = k; };

export const CENTER = [28.5, 28.5];
// The Business Park is a walled campus in the north-west with four buildings.
export const CAMPUS = { x0: 3, y0: 3, x1: 25, y1: 25, gates: [{ side: "s", from: 12, to: 15 }, { side: "e", from: 12, to: 15 }] };

// Studio Isle: Kult Create's game studio on its own small floating island off
// the south-east coast, in front of the camera. A ring of open sky (the moat)
// separates it from the city; a neon bridge from the gardens crosses it.
export const ISLE = { cx: 50, cy: 51.5, r: 6.2, moat: 5 };
export const BRIDGE = { x0: 48, x1: 51, y0: 40, y1: 47 };
const inIsleZone = (x, y) => Math.hypot(x - ISLE.cx, y - ISLE.cy) < ISLE.r + ISLE.moat;
export const onBridge = (x, y) => x >= BRIDGE.x0 && x < BRIDGE.x1 && y >= BRIDGE.y0 && y < BRIDGE.y1;

export const DISTRICTS = [
  { id: "studio", x0: 45, y0: 42, x1: 56, y1: 56 },
  { id: "plaza", x0: 21, y0: 21, x1: 36, y1: 36 },
  { id: "park", x0: 2, y0: 2, x1: 26, y1: 26 },
  { id: "hub", x0: 30, y0: 2, x1: 45, y1: 26 },
  { id: "deal", x0: 45, y0: 2, x1: 55, y1: 26 },
  { id: "market", x0: 2, y0: 30, x1: 27, y1: 55 },
  // The Switchyard: Kult Syndicates' rail depot, the front-left of the gardens.
  { id: "switchyard", x0: 30, y0: 43, x1: 39, y1: 56 },
  { id: "garden", x0: 30, y0: 30, x1: 55, y1: 55 }
];

// ------------------------------------------------------------------ ground
paint(CAMPUS.x0, CAMPUS.y0, CAMPUS.x1, CAMPUS.y1, "c");
export const AVENUES = { ew: { x0: 3, x1: 54, y0: 27, y1: 30 }, ns: { x0: 27, x1: 30, y0: 3, y1: 54 } };
paint(3, 27, 54, 30, "r");                 // east-west avenue
paint(27, 3, 30, 54, "r");                 // north-south avenue
disc(CENTER[0], CENTER[1], 7.6, "p");      // Kult Plaza
// Campus paths: a cross through the courtyard, a promenade, and the gates.
paint(12, 4, 15, 24, "p"); paint(4, 12, 24, 15, "p"); paint(4, 22, 24, 24, "p");
paint(12, 24, 15, 27, "p"); paint(24, 12, 27, 15, "p");
// Game Hub forecourt, Deal Room plaza and the path between them.
paint(30, 17, 46, 20, "p"); paint(44, 11, 54, 14, "p"); paint(47, 14, 50, 19, "p");
// Market Street: the OKX.AI and Base A2A marketplaces share one forecourt.
paint(3, 44, 27, 47, "p"); paint(3, 30, 27, 32, "p");
export const POND = { x: 40, y: 40, r: 3.8 };
disc(POND.x, POND.y, POND.r, "w");
paint(41, 30, 44, 37, "p");                // garden path to the pond
paint(48, 31, 51, 40, "p");                // garden path to the Studio Isle bridge
paint(30, 50, 38, 53, "p");                // the Switchyard's forecourt, off the north-south avenue
// Studio Isle: a path from the bridge round the studio to its forecourt.
paint(46, 46, 54, 48, "p"); paint(46, 48, 47, 53, "p"); paint(53, 48, 54, 53, "p"); paint(46, 53, 54, 56, "p");

// ------------------------------------------------------------------ buildings
// kind: biz (a business inside the park), park (the campus gate), hub, deal, market.
// The two marketplaces share kind "market"; tab picks which one opens.
// Footprint in tiles (x1/y1 exclusive); door = the walkable tile in front of the entrance.
export const BUILDINGS = [
  { id: "dex", kind: "biz", slot: "bld-dex", x0: 4, y0: 4, x1: 11, y1: 12, h: 24, door: [7, 12], color: "#4fd8ff", status: "soon" },
  { id: "sports", kind: "biz", slot: "bld-sports", x0: 16, y0: 4, x1: 23, y1: 12, h: 13, door: [19, 12], color: "#3ddc84", status: "open" },
  { id: "create", kind: "biz", slot: "bld-gaming-studio", x0: 47, y0: 48, x1: 53, y1: 53, h: 12, door: [50, 53], color: "#ff7eb6", status: "open", isle: true },
  { id: "production", kind: "biz", slot: "bld-film", x0: 16, y0: 16, x1: 23, y1: 22, h: 10, door: [19, 22], color: "#ffc94d", status: "soon" },
  { id: "park", kind: "park", slot: "campus-gate", x0: 12, y0: 24, x1: 15, y1: 25, h: 8, door: [13, 25], color: "#ffc94d" },
  { id: "hub", kind: "hub", slot: "bld-game-hub", x0: 31, y0: 2, x1: 44, y1: 17, h: 20, door: [37, 17], color: "#a96bff" },
  { id: "deal", kind: "deal", slot: "bld-deal-room", x0: 46, y0: 3, x1: 53, y1: 11, h: 18, door: [49, 11], color: "#ffc94d" },
  { id: "market", kind: "market", tab: "okx", slot: "bld-okx-market", x0: 4, y0: 34, x1: 14, y1: 44, h: 13, door: [9, 44], color: "#e8e8e8" },
  { id: "a2a", kind: "market", tab: "jobs", slot: "bld-base-market", x0: 16, y0: 34, x1: 26, y1: 44, h: 11, door: [21, 44], color: "#3d7bff" },
  // Kult Syndicates (the Switchyard), served at /world/syndicates/. Kept clear of Studio Isle's ring of sky.
  { id: "syndicate", kind: "syndicate", slot: "bld-syndicate", x0: 31, y0: 45, x1: 38, y1: 50, h: 9, door: [34, 50], color: "#ff6a3d" }
];
export const ENTERABLE = BUILDINGS;
export const FOUNTAIN = { x: CENTER[0], y: CENTER[1], r: 2.2 };
export const SPAWN = [28.5, 34.2];

// ------------------------------------------------------------------ the island's shape
// Land hugs everything that is built (roads, paving, lawns, buildings) plus a
// rounded core, with a noisy margin, so the coast is organic and has bays
// between districts. ISLAND.sd is the signed distance to the coast in tiles
// (positive on land), sampled ISLAND.res times per tile.
const RES = 4, PAD = 7, N = (MAP + 2 * PAD) * RES;
const hash = (i, j, k) => { let h = (i * 374761393 + j * 668265263 + k * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
export function vnoise(x, y, period, seed) {
  const fx = x / period, fy = y / period, xi = Math.floor(fx), yi = Math.floor(fy), u = fx - xi, v = fy - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}
function chamfer(src) {
  const D = new Float32Array(N * N), A = 1, B = Math.SQRT2;
  for (let k = 0; k < N * N; k++) D[k] = src[k] ? 0 : 1e9;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x; let d = D[k];
    if (x > 0) d = Math.min(d, D[k - 1] + A);
    if (y > 0) { d = Math.min(d, D[k - N] + A); if (x > 0) d = Math.min(d, D[k - N - 1] + B); if (x < N - 1) d = Math.min(d, D[k - N + 1] + B); }
    D[k] = d;
  }
  for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
    const k = y * N + x; let d = D[k];
    if (x < N - 1) d = Math.min(d, D[k + 1] + A);
    if (y < N - 1) { d = Math.min(d, D[k + N] + A); if (x < N - 1) d = Math.min(d, D[k + N + 1] + B); if (x > 0) d = Math.min(d, D[k + N - 1] + B); }
    D[k] = d;
  }
  return D;
}
export const ISLAND = (() => {
  const content = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const px = (i + 0.5) / RES - PAD, py = (j + 0.5) / RES - PAD, tx = Math.floor(px), ty = Math.floor(py);
    if (tx < 0 || ty < 0 || tx >= MAP || ty >= MAP) continue;
    if (inIsleZone(px, py)) continue;
    const inB = BUILDINGS.some((b) => !b.isle && tx >= b.x0 - 1 && tx < b.x1 + 1 && ty >= b.y0 - 1 && ty < b.y1 + 1);
    const core = Math.hypot(px - CENTER[0], py - CENTER[1]) <= 15;
    content[j * N + i] = tiles[tx][ty] !== "g" || inB || core ? 1 : 0;
  }
  const dOut = chamfer(content), land = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const px = (i + 0.5) / RES - PAD, py = (j + 0.5) / RES - PAD;
    const margin = 0.5 + vnoise(px, py, 8, 3) ** 1.5 * 5 + vnoise(px, py, 2.6, 7) * 1.1;
    const border = Math.min(px, py, MAP - px, MAP - py) + PAD - 0.6;
    const dIsle = Math.hypot(px - ISLE.cx, py - ISLE.cy);
    land[j * N + i] = dIsle < ISLE.r + (vnoise(px, py, 3, 13) - 0.5) * 0.8 ? 1 : dIsle < ISLE.r + ISLE.moat ? 0 : Math.min(margin - dOut[j * N + i] / RES, border) > 0 ? 1 : 0;
  }
  const notLand = land.map((v) => 1 - v), inD = chamfer(notLand), outD = chamfer(land);
  let sd = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) sd[k] = (land[k] ? inD[k] - 0.5 : -(outD[k] - 0.5)) / RES;
  // Two box-blur passes smooth the chamfer steps.
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let t = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < N && b < N) { t += sd[b * N + a]; n++; } }
      o[j * N + i] = t / n;
    }
    sd = o;
  }
  return { res: RES, pad: PAD, n: N, sd };
})();
// Signed distance to the coast (tiles, + on land) at any tile-space point.
export function islandSD(x, y) {
  const fx = Math.min(N - 1.001, Math.max(0, (x + PAD) * RES - 0.5)), fy = Math.min(N - 1.001, Math.max(0, (y + PAD) * RES - 0.5)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, S = ISLAND.sd;
  const a = S[j * N + i], b = S[j * N + i + 1], c = S[(j + 1) * N + i], d = S[(j + 1) * N + i + 1];
  if (x < -PAD || y < -PAD || x > MAP + PAD || y > MAP + PAD) return -5;
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) if (islandSD(x + 0.5, y + 0.5) < 0.45) tiles[x][y] = "v";

// ------------------------------------------------------------------ walkability
export const blocked = Array.from({ length: MAP }, () => Array(MAP).fill(false));
const block = (x0, y0, x1, y1) => { for (let x = Math.max(0, x0); x < Math.min(MAP, x1); x++) for (let y = Math.max(0, y0); y < Math.min(MAP, y1); y++) blocked[x][y] = true; };
for (const b of BUILDINGS) if (b.kind !== "park") block(b.x0, b.y0, b.x1, b.y1);
// Campus wall: the ring of the campus rectangle, minus the gates.
export const WALL = [];
for (let x = CAMPUS.x0; x < CAMPUS.x1; x++) for (let y = CAMPUS.y0; y < CAMPUS.y1; y++) {
  const edge = x === CAMPUS.x0 || y === CAMPUS.y0 || x === CAMPUS.x1 - 1 || y === CAMPUS.y1 - 1;
  if (!edge) continue;
  const gate = CAMPUS.gates.some((g) => (g.side === "s" && y === CAMPUS.y1 - 1 && x >= g.from && x < g.to) || (g.side === "e" && x === CAMPUS.x1 - 1 && y >= g.from && y < g.to));
  if (!gate) { blocked[x][y] = true; WALL.push([x, y]); }
}
// The courtyard monument.
export const MONUMENT = { x: 13.5, y: 13.5 };
blocked[13][13] = true;
for (let x = BRIDGE.x0; x < BRIDGE.x1; x++) for (let y = BRIDGE.y0; y < BRIDGE.y1; y++) if (tiles[x][y] === "v") tiles[x][y] = "b";
for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) {
  if (tiles[x][y] === "w" || tiles[x][y] === "v") blocked[x][y] = true;
  if (Math.hypot(x + 0.5 - FOUNTAIN.x, y + 0.5 - FOUNTAIN.y) < FOUNTAIN.r + 0.4) blocked[x][y] = true;
}

// ------------------------------------------------------------------ props
export const PROPS = [];
const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const free = (x, y, r = 0, kinds = ["g"]) => {
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
    if (tx < 1 || ty < 1 || tx >= MAP - 1 || ty >= MAP - 1 || blocked[tx][ty] || !kinds.includes(tiles[tx][ty]) || islandSD(tx + 0.5, ty + 0.5) < 1.2 || inIsleZone(tx + 0.5, ty + 0.5)) return false;
  }
  return true;
};
const put = (kind, x, y, extra = {}, solid = true) => { PROPS.push({ kind, x, y, ...extra }); if (solid) blocked[Math.floor(x)][Math.floor(y)] = true; };

// Street lamps along both avenues (outside the plaza).
for (let i = 4; i < 53; i += 4) {
  if (i > 19 && i < 38) continue;
  const c1 = i % 8 ? "#ffd27a" : "#4fd8ff", c2 = i % 8 ? "#ffd27a" : "#ff7eb6";
  put("lamp", i + 0.5, 26.5, { glow: c1 }, false); put("lamp", i + 0.5, 30.5, { glow: c1 }, false);
  put("lamp", 26.5, i + 0.5, { glow: c2 }, false); put("lamp", 30.5, i + 0.5, { glow: c2 }, false);
}
// Plaza ring lamps, benches and blossoms.
for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; put("lamp", CENTER[0] + Math.cos(a) * 6.8, CENTER[1] + Math.sin(a) * 6.8, { glow: i % 2 ? "#ff7eb6" : "#4fd8ff" }, false); }
for (const [x, y, rot] of [[24, 24.4, 0.8], [33, 24.4, -0.8], [24, 32.6, 2.4], [33, 32.6, -2.4]]) put("bench", x, y, { rot });
for (const [x, y] of [[21.6, 21.6], [35.4, 21.6], [21.6, 35.4], [35.4, 35.4]]) put("blossom", x, y);
// Campus: lamps along the paths, hedges and trees on the lawn.
for (const [x, y] of [[11.5, 9], [15.5, 9], [11.5, 19], [15.5, 19], [9, 11.5], [18.5, 11.5], [9, 15.5], [18.5, 15.5]]) put("lamp", x, y, { glow: "#ffd27a" }, false);
for (let i = 0, tries = 0; i < 16 && tries < 400; tries++) { const x = 4 + rnd() * 20, y = 4 + rnd() * 20; if (free(x, y, 0, ["c"])) { put(rnd() < 0.5 ? "bush" : "blossom", x, y, { s: 0.7 + rnd() * 0.4, rot: rnd() * 6.28 }); i++; } }
// Trees everywhere else, sparser at the front.
const scatter = (x0, y0, x1, y1, n, kinds) => {
  for (let i = 0, tries = 0; i < n && tries < n * 40; tries++) {
    const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
    if (!free(x, y, 1)) continue;
    put(kinds[Math.floor(rnd() * kinds.length)], x, y, { s: 0.8 + rnd() * 0.5, rot: rnd() * 6.28 });
    i++;
  }
};
scatter(31, 2, 54, 26, 16, ["pine", "tree", "pine"]);
scatter(2, 30, 27, 54, 22, ["tree", "blossom", "tree", "bush"]);
scatter(31, 31, 54, 54, 20, ["blossom", "bush", "tree", "bush"]);
scatter(25, 2, 27, 26, 3, ["bush"]);
// Gardens: benches by the pond and flower beds.
for (const [x, y, rot] of [[38.6, 37.6, 0.8], [47.4, 37.6, -0.8], [38.6, 46.6, 2.4], [47.6, 46.6, -2.4]]) if (free(x, y)) put("bench", x, y, { rot });
for (let i = 0; i < 26; i++) { const x = 31 + rnd() * 22, y = 31 + rnd() * 22; if (free(x, y)) put("flowers", x, y, { rot: rnd() * 6.28 }, false); }
for (let i = 0; i < 12; i++) { const x = 3 + rnd() * 22, y = 33 + rnd() * 20; if (free(x, y)) put("flowers", x, y, { rot: rnd() * 6.28 }, false); }
// Billboards.
put("billboard", 45.5, 21.5, { ad: 0 }); put("billboard", 7, 28.4, { ad: 1 }); put("billboard", 24.5, 49.5, { ad: 2 }); put("billboard", 51.5, 27, { ad: 3 });
put("crane", 31.5, 9.5);
// Studio Isle: lamps along the garden path and round the forecourt.
for (let y = 32; y < 40; y += 3.5) { put("lamp", 47.5, y + 0.5, { glow: "#ff7eb6" }, false); put("lamp", 51.5, y + 0.5, { glow: "#4fd8ff" }, false); }
for (const [x, y, glow] of [[45.6, 54.4, "#ff7eb6"], [54.4, 54.4, "#4fd8ff"], [45.2, 50.2, "#4fd8ff"], [54.8, 50.2, "#ff7eb6"]]) put("lamp", x, y, { glow }, false);

export const walkable = (x, y) => x >= 0 && y >= 0 && x < MAP && y < MAP && !blocked[x][y];

// Random walkable tile on paving or roads (for wandering agents).
export function randomStreetTile(rand = Math.random) {
  for (let i = 0; i < 300; i++) {
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
  const f = new Map([[key(sx, sy), h(sx, sy)]]), closed = new Set(), inOpen = new Set([key(sx, sy)]);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(key(...open[i])) < f.get(key(...open[bi]))) bi = i;
    const [cx, cy] = open.splice(bi, 1)[0], ck = key(cx, cy); inOpen.delete(ck);
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
      if (ng < (g.get(nk) ?? Infinity)) { came.set(nk, ck); g.set(nk, ng); f.set(nk, ng + h(nx, ny)); if (!inOpen.has(nk)) { open.push([nx, ny]); inOpen.add(nk); } }
    }
  }
  return null;
}
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
