// Kult World: an isometric pixel town. Placeholder art is drawn in code
// (ground, buildings, props) so the layout can be designed before the final
// assets exist; agents use the real AI Arena archetype sprites. Every visual
// below has a matching slot in docs/ASSETS.md.

export const MAP = 24;                  // tiles per side
const TW = 64, TH = 32;                 // tile size (world px)
const OX = MAP * 32, OY = 216;          // world px of grid (0,0); headroom for buildings
export const WORLD_W = MAP * TW, WORLD_H = 1024;   // 1536x1024: the ground art is painted at exactly this size
export const iso = (gx, gy, z = 0) => [OX + (gx - gy) * 32, OY + (gx + gy) * 16 - z];

// ------------------------------------------------------------------ layout
export const BUILDINGS = [
  {
    id: "park", name: "Kult Business Park", x0: 3, y0: 10, x1: 9, y1: 16, h: 150,
    wallL: "#3b3170", wallR: "#2c2556", roof: "#4a3f8a", trim: "#f2c14e", glow: "#f2c14e",
    door: { face: "x", u: 0.5, tile: [9, 13] }, sign: ["KULT", "BUSINESS PARK"], signColors: ["#ff7eb6", "#f2c14e"]
  },
  {
    id: "arcade", name: "Kult Arcade", x0: 10, y0: 3, x1: 16, y1: 9, h: 130,
    wallL: "#3a1f5c", wallR: "#2a1646", roof: "#53307f", trim: "#5ec8f2", glow: "#ff4fa3",
    door: { face: "y", u: 0.5, tile: [13, 9] }, sign: ["KULT", "ARCADE"], signColors: ["#5ec8f2", "#ff4fa3"], marquee: true
  }
];
const LOT = { x0: 17, y0: 2, x1: 22, y1: 7, label: ["NEW DISTRICT", "COMING SOON"] };
const FOUNTAIN = { x0: 12, y0: 12, x1: 14, y1: 14 };
export const SPAWN = [11.5, 15.5];

// Tile kinds: g grass, p path, w plaza.
const tiles = Array.from({ length: MAP }, () => Array(MAP).fill("g"));
const paint = (x0, y0, x1, y1, k) => { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) if (x >= 0 && y >= 0 && x < MAP && y < MAP) tiles[x][y] = k; };
paint(9, 9, 17, 17, "w");                // plaza
paint(9, 12, 10, 15, "p");               // to the Business Park door
paint(12, 8, 15, 9, "p");                // to the Arcade door
paint(12, 17, 14, MAP, "p");             // main road south
paint(17, 12, MAP, 14, "p");             // road east
paint(17, 7, 20, 12, "p");               // to the new district

// Walkability: buildings, the fountain, the lot, and everything "behind" a
// building (so nobody walks behind a wall the renderer draws over them).
const blocked = Array.from({ length: MAP }, () => Array(MAP).fill(false));
const block = (x0, y0, x1, y1) => { for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) if (x >= 0 && y >= 0 && x < MAP && y < MAP) blocked[x][y] = true; };
for (const b of BUILDINGS) { block(b.x0, b.y0, b.x1, b.y1); block(0, 0, b.x1, b.y1); }
block(FOUNTAIN.x0, FOUNTAIN.y0, FOUNTAIN.x1, FOUNTAIN.y1);
block(LOT.x0, LOT.y0, LOT.x1, LOT.y1);
block(0, 0, LOT.x1, LOT.y0);
for (const b of BUILDINGS) blocked[b.door.tile[0]][b.door.tile[1]] = false;

// Props. "back" props sit in blocked areas behind buildings and draw first.
const PROPS = [];
const prop = (kind, x, y, extra = {}) => { PROPS.push({ kind, x, y, ...extra }); if (x >= 0 && y >= 0 && x < MAP && y < MAP && kind !== "lamp" && kind !== "flower") blocked[Math.floor(x)][Math.floor(y)] = true; };
for (const [x, y] of [[1.5, 17.5], [2.5, 20.5], [5.5, 22.5], [1.5, 22.5], [8.5, 20.5], [16.5, 20.5], [19.5, 22.5], [22.5, 19.5], [22.5, 16.5], [20.5, 9.5], [22.5, 10.5], [6.5, 18.5], [17.5, 17.5]]) prop("tree", x, y);
for (const [x, y] of [[1.5, 3.5], [4.5, 1.5], [7.5, 2.5], [1.5, 7.5], [17.5, 1.0], [23.0, 4.5]]) prop("tree", x, y, { back: true });
for (const [x, y] of [[9.2, 9.2], [16.8, 9.2], [9.2, 16.8], [16.8, 16.8], [11.6, 19.5], [14.4, 19.5], [11.6, 22.5], [14.4, 22.5], [19.5, 11.6], [22.5, 11.6], [8.6, 11.6]]) prop("lamp", x, y);
for (const [x, y] of [[10.5, 10.5], [15.5, 10.5], [15.5, 15.5]]) prop("bench", x, y);
for (const [x, y] of [[3.5, 17.5], [7.5, 21.5], [20.5, 18.5], [18.5, 21.5], [21.5, 14.5]]) prop("bush", x, y);
for (const [x, y] of [[10.2, 17.3], [15.8, 17.3], [16.6, 8.4]]) prop("flower", x, y);

export const walkable = (x, y) => x >= 0 && y >= 0 && x < MAP && y < MAP && !blocked[x][y];

// A* over tiles (8 directions, no corner cutting).
export function findPath([sx, sy], [tx, ty]) {
  sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
  if (!walkable(tx, ty)) return null;
  const key = (x, y) => y * MAP + x, open = new Map([[key(sx, sy), { x: sx, y: sy, g: 0, f: 0 }]]), came = new Map(), gs = new Map([[key(sx, sy), 0]]);
  const hfn = (x, y) => Math.hypot(tx - x, ty - y);
  while (open.size) {
    let cur = null;
    for (const n of open.values()) if (!cur || n.f < cur.f) cur = n;
    open.delete(key(cur.x, cur.y));
    if (cur.x === tx && cur.y === ty) {
      const out = [];
      for (let k = key(tx, ty); k !== undefined; k = came.get(k)) out.unshift([k % MAP + 0.5, Math.floor(k / MAP) + 0.5]);
      return out.slice(1);
    }
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!walkable(nx, ny) || (dx && dy && (!walkable(cur.x + dx, cur.y) || !walkable(cur.x, cur.y + dy)))) continue;
      const g = cur.g + (dx && dy ? 1.414 : 1), k = key(nx, ny);
      if (g >= (gs.get(k) ?? Infinity)) continue;
      gs.set(k, g); came.set(k, key(cur.x, cur.y));
      open.set(k, { x: nx, y: ny, g, f: g + hfn(nx, ny) });
    }
  }
  return null;
}

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// ------------------------------------------------------------------ world
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.t = 0;
    this.agents = new Map();
    this.particles = [];
    this.cam = { x: iso(SPAWN[0], SPAWN[1])[0], y: iso(SPAWN[0], SPAWN[1])[1] - 40 };
    this.zoom = 1; this.dpr = 1; this.cw = 800; this.ch = 600;
    this.hover = null;
    this.marker = null;
    this.ground = null;
    this.art = null;
    this.signCanvas = new Map();
    this.fireflies = Array.from({ length: 40 }, (_, i) => ({ x: Math.random() * MAP, y: Math.random() * MAP, p: i * 0.7 }));
  }

  useArt(manifest, images, urlOf) { this.art = { manifest, images, urlOf, loading: new Set() }; }

  resize(cw, ch, dpr) {
    this.cw = cw; this.ch = ch; this.dpr = dpr;
    this.canvas.width = Math.round(cw * dpr); this.canvas.height = Math.round(ch * dpr);
    this.canvas.style.width = `${cw}px`; this.canvas.style.height = `${ch}px`;
    // Show roughly 15 tiles across on desktop, a bit closer on phones.
    this.zoom = Math.max(0.55, Math.min(1.6, Math.min(cw / 1000, ch / 640) * 1.08));
  }

  // ---------------------------------------------------------------- agents
  addAgent(id, { name, archetype, clan, isPlayer = false, x, y }) {
    this.agents.set(id, { id, name, archetype: String(archetype).toLowerCase(), clan, isPlayer, x, y, path: [], walking: false, facing: 1, phase: (hash(id) % 100) / 15, alpha: 1, idleUntil: 0 });
    return this.agents.get(id);
  }
  get player() { return this.agents.get("me"); }

  spawnPlayer(agent) {
    const p = this.addAgent("me", { ...agent, isPlayer: true, x: SPAWN[0], y: SPAWN[1] });
    p.alpha = 0; p.spawnAt = this.t;
    const [sx, sy] = iso(SPAWN[0], SPAWN[1]);
    for (let i = 0; i < 70; i++) this.particles.push({ kind: "spark", x: sx + (Math.random() - 0.5) * 40, y: sy - Math.random() * 90, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 60, t0: this.t + Math.random() * 0.6, dur: 1.2 + Math.random(), color: ["#ff7eb6", "#5ec8f2", "#f2c14e", "#ffffff"][i % 4] });
    this.cam.x = sx; this.cam.y = sy - 40;
    return p;
  }

  walk(agent, target, done) {
    const path = findPath([agent.x, agent.y], target);
    if (!path) return false;
    agent.path = path; agent.onArrive = done || null;
    if (!path.length) { agent.onArrive = null; done?.(); }
    return true;
  }

  walkToBuilding(id, done) {
    const b = BUILDINGS.find((x) => x.id === id), p = this.player;
    if (!b || !p) return;
    const ok = this.walk(p, b.door.tile, () => { p.facing = b.door.face === "x" ? -1 : 1; done?.(b); });
    if (ok) this.marker = { x: b.door.tile[0] + 0.5, y: b.door.tile[1] + 0.5, t0: this.t };
  }

  // Screen (CSS px) -> world px -> grid.
  toWorld(sx, sy) { return [(sx - this.cw / 2) / this.zoom + this.cam.x, (sy - this.ch / 2) / this.zoom + this.cam.y]; }
  toGrid(wx, wy) { const a = (wx - OX) / 32, b = (wy - OY) / 16; return [(a + b) / 2, (b - a) / 2]; }

  buildingAt(sx, sy) {
    const [wx, wy] = this.toWorld(sx, sy);
    for (const b of [...BUILDINGS].reverse()) {
      const pts = [iso(b.x0, b.y1), iso(b.x1, b.y1), iso(b.x1, b.y0), iso(b.x1, b.y0, b.h + 70), iso(b.x0, b.y0, b.h + 70), iso(b.x0, b.y1, b.h)];
      if (this.inPoly(wx, wy, pts)) return b;
    }
    return null;
  }
  inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // Click on the ground: walk there (or to the nearest walkable tile).
  walkToScreen(sx, sy) {
    const p = this.player;
    if (!p) return false;
    let [gx, gy] = this.toGrid(...this.toWorld(sx, sy));
    gx = Math.floor(gx); gy = Math.floor(gy);
    if (!walkable(gx, gy)) {
      let best = null;
      for (let r = 1; r <= 3 && !best; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (walkable(gx + dx, gy + dy) && (!best || Math.hypot(dx, dy) < best.d)) best = { x: gx + dx, y: gy + dy, d: Math.hypot(dx, dy) };
      if (!best) return false;
      gx = best.x; gy = best.y;
    }
    if (!this.walk(p, [gx, gy])) return false;
    this.marker = { x: gx + 0.5, y: gy + 0.5, t0: this.t };
    return true;
  }

  // ---------------------------------------------------------------- loop
  update(dt) {
    this.t += dt;
    for (const a of this.agents.values()) {
      if (a.path.length) {
        a.walking = true;
        const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), step = (a.isPlayer ? 3.4 : 1.6) * dt;
        if (Math.abs(dx - dy) > 0.01) a.facing = dx - dy > 0 ? 1 : -1;
        if (d <= step) { a.x = tx; a.y = ty; a.path.shift(); if (!a.path.length) { a.walking = false; const f = a.onArrive; a.onArrive = null; f?.(); } }
        else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
      } else {
        a.walking = false;
        // Wanderers stroll between random spots.
        if (!a.isPlayer && this.t > a.idleUntil) {
          for (let i = 0; i < 20; i++) {
            const tx = Math.floor(8 + Math.random() * 15), ty = Math.floor(8 + Math.random() * 15);
            if (walkable(tx, ty) && Math.hypot(tx - a.x, ty - a.y) > 3 && this.walk(a, [tx, ty])) break;
          }
          a.idleUntil = this.t + 3 + Math.random() * 6;
        }
      }
      if (a.isPlayer && a.alpha < 1) a.alpha = Math.min(1, (this.t - a.spawnAt - 0.5) / 0.8);
    }
    // Camera follows the player.
    const p = this.player;
    if (p) {
      const [px, py] = iso(p.x, p.y);
      this.cam.x += (px - this.cam.x) * Math.min(1, dt * 3);
      this.cam.y += (py - 50 - this.cam.y) * Math.min(1, dt * 3);
    }
    this.particles = this.particles.filter((q) => this.t - q.t0 < q.dur);
  }

  draw() {
    const g = this.ctx, k = this.zoom * this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Night sky behind the town.
    const sky = g.createLinearGradient(0, 0, 0, this.canvas.height);
    sky.addColorStop(0, "#070418"); sky.addColorStop(0.6, "#120a2c"); sky.addColorStop(1, "#1b0f3a");
    g.fillStyle = sky; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 70; i++) { const x = (i * 137.5) % this.canvas.width, y = (i * 61.7) % (this.canvas.height * 0.5); if (Math.sin(this.t * 1.5 + i) > -0.6) g.fillRect(x, y, this.dpr, this.dpr); }
    g.setTransform(k, 0, 0, k, (this.cw / 2 - this.cam.x * this.zoom) * this.dpr, (this.ch / 2 - this.cam.y * this.zoom) * this.dpr);
    g.imageSmoothingEnabled = false;
    if (!this.ground) this.ground = this.buildGround();
    g.drawImage(this.ground, 0, 0);
    this.drawFountain(g);
    if (this.marker && this.t - this.marker.t0 < 1.2) this.drawMarker(g);
    this.drawSpawnPad(g);
    // Back props, then buildings, then everything that can overlap agents.
    for (const pr of PROPS.filter((q) => q.back).sort((a, b) => a.x + a.y - b.x - b.y)) this.drawProp(g, pr);
    this.drawLot(g);
    for (const b of BUILDINGS) this.drawBuilding(g, b);
    const items = [
      ...PROPS.filter((q) => !q.back).map((q) => ({ k: q.x + q.y, f: () => this.drawProp(g, q) })),
      ...[...this.agents.values()].map((a) => ({ k: a.x + a.y, f: () => this.drawAgent(g, a) }))
    ].sort((a, b) => a.k - b.k);
    for (const it of items) it.f();
    this.drawLights(g);
    this.drawParticles(g);
    for (const a of this.agents.values()) this.drawTag(g, a);
  }

  // ---------------------------------------------------------------- ground
  buildGround() {
    const c = document.createElement("canvas");
    c.width = WORLD_W; c.height = WORLD_H;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    // Island edge (dirt) under the grass.
    const edge = [iso(0, 0), iso(MAP, 0), iso(MAP, MAP), iso(0, MAP)];
    g.fillStyle = "#1a1030";
    g.beginPath(); g.moveTo(edge[1][0], edge[1][1]); g.lineTo(edge[2][0], edge[2][1]); g.lineTo(edge[2][0], edge[2][1] + 26); g.lineTo(edge[1][0], edge[1][1] + 26); g.closePath(); g.fill();
    g.fillStyle = "#24163f";
    g.beginPath(); g.moveTo(edge[3][0], edge[3][1]); g.lineTo(edge[2][0], edge[2][1]); g.lineTo(edge[2][0], edge[2][1] + 26); g.lineTo(edge[3][0], edge[3][1] + 26); g.closePath(); g.fill();
    for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) {
      const kind = tiles[x][y], h = hash(`${x},${y}`);
      const pts = [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)];
      let fill;
      if (kind === "g") fill = ["#1f4a3c", "#22513f", "#1c4537"][h % 3];
      else if (kind === "w") fill = (x + y) % 2 ? "#3d3660" : "#443c6a";
      else fill = (x + y) % 2 ? "#4a4270" : "#524a7a";
      g.fillStyle = fill;
      g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fill();
      g.strokeStyle = kind === "g" ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.25)"; g.lineWidth = 1; g.stroke();
      if (kind === "g" && h % 4 === 0) { const [cx, cy] = iso(x + 0.5, y + 0.5); g.fillStyle = "#2e6a50"; g.fillRect(cx - 6 + (h % 9), cy - 2, 2, 3); g.fillRect(cx + 4 - (h % 5), cy + 3, 2, 2); }
    }
    // Plaza inlay: a big KULT ring.
    const [cx, cy] = iso(13, 13);
    g.strokeStyle = "rgba(255,126,182,0.35)"; g.lineWidth = 3;
    g.beginPath(); g.ellipse(cx, cy, 160, 80, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "rgba(94,200,242,0.25)";
    g.beginPath(); g.ellipse(cx, cy, 190, 95, 0, 0, Math.PI * 2); g.stroke();
    return c;
  }

  drawFountain(g) {
    const f = FOUNTAIN, h = 14;
    const top = [iso(f.x0, f.y0, h), iso(f.x1, f.y0, h), iso(f.x1, f.y1, h), iso(f.x0, f.y1, h)];
    this.poly(g, [iso(f.x1, f.y0), iso(f.x1, f.y1), iso(f.x1, f.y1, h), iso(f.x1, f.y0, h)], "#2c2650");
    this.poly(g, [iso(f.x0, f.y1), iso(f.x1, f.y1), iso(f.x1, f.y1, h), iso(f.x0, f.y1, h)], "#3a3366");
    this.poly(g, top, "#5a5294");
    const inner = [iso(f.x0 + 0.25, f.y0 + 0.25, h), iso(f.x1 - 0.25, f.y0 + 0.25, h), iso(f.x1 - 0.25, f.y1 - 0.25, h), iso(f.x0 + 0.25, f.y1 - 0.25, h)];
    this.poly(g, inner, "#1f6f9a");
    const [cx, cy] = iso(13, 13, h);
    for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(158,226,255,${0.5 - i * 0.12})`; g.beginPath(); g.ellipse(cx, cy, 10 + ((this.t * 14 + i * 12) % 36), 5 + ((this.t * 7 + i * 6) % 18), 0, 0, Math.PI * 2); g.stroke(); }
    // The KULT crystal on top.
    g.fillStyle = "#ff7eb6"; g.fillRect(cx - 4, cy - 40 + Math.sin(this.t * 2) * 3, 8, 22);
    g.fillStyle = "#5ec8f2"; g.fillRect(cx - 4, cy - 40 + Math.sin(this.t * 2) * 3, 4, 22);
    g.fillStyle = "rgba(255,126,182,0.18)"; g.beginPath(); g.ellipse(cx, cy - 28, 26, 26, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 6; i++) { const k = (this.t * 0.9 + i / 6) % 1; g.fillStyle = `rgba(158,226,255,${1 - k})`; g.fillRect(cx + Math.sin(i * 2.1) * 18 * k, cy - 18 - Math.sin(k * Math.PI) * 26, 2, 2); }
  }

  drawSpawnPad(g) {
    const [cx, cy] = iso(SPAWN[0], SPAWN[1]);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 2.5);
    g.strokeStyle = `rgba(94,200,242,${0.4 + 0.4 * pulse})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(cx, cy, 30, 15, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = `rgba(255,126,182,${0.3 + 0.3 * (1 - pulse)})`;
    g.beginPath(); g.ellipse(cx, cy, 20, 10, 0, 0, Math.PI * 2); g.stroke();
    const p = this.player;
    if (p && this.t - p.spawnAt < 1.6) { // spawn beam
      const a = Math.max(0, 1 - (this.t - p.spawnAt) / 1.6);
      const grad = g.createLinearGradient(0, cy - 260, 0, cy);
      grad.addColorStop(0, "rgba(94,200,242,0)"); grad.addColorStop(1, `rgba(158,226,255,${0.75 * a})`);
      g.fillStyle = grad; g.fillRect(cx - 18, cy - 260, 36, 260);
    }
  }

  drawMarker(g) {
    const m = this.marker, k = (this.t - m.t0) / 1.2, [cx, cy] = iso(m.x, m.y);
    g.strokeStyle = `rgba(242,193,78,${1 - k})`; g.lineWidth = 2;
    g.beginPath(); g.ellipse(cx, cy, 8 + k * 16, 4 + k * 8, 0, 0, Math.PI * 2); g.stroke();
  }

  // ---------------------------------------------------------------- buildings
  poly(g, pts, fill) { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fillStyle = fill; g.fill(); }
  // Point on a building face: face "x" (x = x1, along y) or "y" (y = y1, along x); u 0..1 along, z height.
  facePt(b, face, u, z) { return face === "x" ? iso(b.x1, b.y0 + (b.y1 - b.y0) * u, z) : iso(b.x0 + (b.x1 - b.x0) * u, b.y1, z); }

  drawBuilding(g, b) {
    const hot = this.hover === b.id, { x0, y0, x1, y1, h } = b;
    // Shadow.
    this.poly(g, [iso(x0, y1), iso(x1, y1), iso(x1 + 0.6, y1 + 0.2), iso(x0 + 0.6, y1 + 0.6)], "rgba(0,0,0,0.25)");
    this.poly(g, [iso(x1, y0), iso(x1, y1), iso(x1, y1, h), iso(x1, y0, h)], b.wallR);
    this.poly(g, [iso(x0, y1), iso(x1, y1), iso(x1, y1, h), iso(x0, y1, h)], b.wallL);
    this.poly(g, [iso(x0, y0, h), iso(x1, y0, h), iso(x1, y1, h), iso(x0, y1, h)], b.roof);
    // Trim lines.
    g.strokeStyle = b.trim; g.lineWidth = 2;
    g.beginPath(); g.moveTo(...iso(x0, y1, h)); g.lineTo(...iso(x1, y1, h)); g.lineTo(...iso(x1, y0, h)); g.stroke();
    g.globalAlpha = 0.5; g.beginPath(); g.moveTo(...iso(x0, y1, 6)); g.lineTo(...iso(x1, y1, 6)); g.lineTo(...iso(x1, y0, 6)); g.stroke(); g.globalAlpha = 1;
    // Windows (some lit, a few flicker).
    for (const face of ["x", "y"]) {
      const len = face === "x" ? y1 - y0 : x1 - x0, cols = Math.round(len * 1.4), rows = Math.floor((h - 50) / 26);
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        const u0 = (c + 0.25) / cols, u1 = (c + 0.75) / cols, z0 = 40 + r * 26, z1 = z0 + 14;
        if (face === b.door.face && Math.abs((u0 + u1) / 2 - b.door.u) < 0.15 && r === 0) continue;
        const lit = (hash(`${b.id}${face}${c}${r}`) % 5) > 1 && !(Math.sin(this.t * 0.7 + c * 3 + r) > 0.97);
        this.poly(g, [this.facePt(b, face, u0, z1), this.facePt(b, face, u1, z1), this.facePt(b, face, u1, z0), this.facePt(b, face, u0, z0)], lit ? (r % 2 ? "#ffd98a" : "#ffe6a8") : "#1a1235");
      }
    }
    // Door with a glow, brighter on hover.
    const du = b.door.u, d0 = du - 0.08, d1 = du + 0.08;
    const door = [this.facePt(b, b.door.face, d0, 34), this.facePt(b, b.door.face, d1, 34), this.facePt(b, b.door.face, d1, 0), this.facePt(b, b.door.face, d0, 0)];
    this.poly(g, door, hot ? "#fff3c4" : "#ffd98a");
    g.strokeStyle = b.glow; g.lineWidth = 2; g.beginPath(); g.moveTo(...door[0]); for (const p of door.slice(1)) g.lineTo(...p); g.closePath(); g.stroke();
    const [dx, dy] = this.facePt(b, b.door.face, du, 0);
    const grad = g.createRadialGradient(dx, dy, 2, dx, dy, hot ? 70 : 46);
    grad.addColorStop(0, hot ? "rgba(255,230,160,0.55)" : "rgba(255,210,130,0.32)"); grad.addColorStop(1, "rgba(255,210,130,0)");
    g.fillStyle = grad; g.beginPath(); g.ellipse(dx, dy, hot ? 70 : 46, hot ? 35 : 23, 0, 0, Math.PI * 2); g.fill();
    // Marquee bulbs (arcade).
    if (b.marquee) {
      for (let i = 0; i < 26; i++) {
        const u = i / 25, on = (Math.floor(this.t * 6) + i) % 3 === 0;
        const [bx, by] = this.facePt(b, "y", u, h - 8);
        g.fillStyle = on ? "#fff3a0" : "#7a5a20"; g.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);
      }
    }
    this.drawSign(g, b, hot);
    if (hot) { // hover outline
      g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(...iso(x0, y1)); g.lineTo(...iso(x1, y1)); g.lineTo(...iso(x1, y0)); g.lineTo(...iso(x1, y0, h)); g.lineTo(...iso(x0, y0, h)); g.lineTo(...iso(x0, y1, h)); g.closePath(); g.stroke();
    }
  }

  // Neon billboard standing on the roof's front edge.
  drawSign(g, b, hot) {
    let c = this.signCanvas.get(b.id);
    if (!c) { c = document.createElement("canvas"); c.width = 720; c.height = 220; this.signCanvas.set(b.id, c); }
    const s = c.getContext("2d"), t = this.t;
    s.clearRect(0, 0, c.width, c.height);
    s.fillStyle = "#0d0820"; s.fillRect(0, 0, c.width, c.height);
    s.strokeStyle = b.trim; s.lineWidth = 8; s.strokeRect(4, 4, c.width - 8, c.height - 8);
    const flick = (seed) => { const k = Math.sin(t * 13 + seed) + Math.sin(t * 4.1 + seed * 3); return k < -1.8 ? 0.2 : 1; };
    b.sign.forEach((line, i) => {
      const a = flick(i * 2.3 + (b.id === "park" ? 0 : 5)) * (hot ? 1 : 0.9);
      s.font = `${i === 0 ? 64 : 46}px "Press Start 2P", monospace`; s.textAlign = "center"; s.textBaseline = "middle";
      s.globalAlpha = a; s.shadowColor = b.signColors[i]; s.shadowBlur = 26; s.fillStyle = b.signColors[i];
      s.fillText(line, c.width / 2, i === 0 ? 70 : 150);
      s.shadowBlur = 0; s.globalAlpha = 1;
    });
    // Billboard quad on the front-left edge of the roof (face "y"), leaning up.
    const u0 = 0.1, u1 = 0.9, base = b.h + 4, top = b.h + 66;
    const pt = (u, z) => iso(b.x0 + (b.x1 - b.x0) * u, b.y1 - 0.4, z);
    const tl = pt(u0, top), tr = pt(u1, top), bl = pt(u0, base);
    // posts
    g.fillStyle = "#1a1235";
    for (const u of [u0 + 0.05, u1 - 0.05]) { const [px, py] = pt(u, base); g.fillRect(px - 2, py - 4, 4, 8); }
    g.save();
    g.transform((tr[0] - tl[0]) / c.width, (tr[1] - tl[1]) / c.width, (bl[0] - tl[0]) / c.height, (bl[1] - tl[1]) / c.height, tl[0], tl[1]);
    g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0); g.imageSmoothingEnabled = false;
    g.restore();
  }

  drawLot(g) {
    const l = LOT;
    this.poly(g, [iso(l.x0, l.y0), iso(l.x1, l.y0), iso(l.x1, l.y1), iso(l.x0, l.y1)], "#3a2b22");
    // Fence.
    g.strokeStyle = "#f2c14e"; g.lineWidth = 2;
    for (let i = 0; i <= 20; i++) { const u = i / 20, [x, y] = iso(l.x0 + (l.x1 - l.x0) * u, l.y1, 0); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 12); g.stroke(); }
    for (let i = 0; i <= 20; i++) { const u = i / 20, [x, y] = iso(l.x1, l.y0 + (l.y1 - l.y0) * u, 0); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 12); g.stroke(); }
    g.beginPath(); g.moveTo(...iso(l.x0, l.y1, 9)); g.lineTo(...iso(l.x1, l.y1, 9)); g.lineTo(...iso(l.x1, l.y0, 9)); g.stroke();
    // Crane.
    const [bx, by] = iso(l.x0 + 1.5, l.y0 + 1.5);
    g.fillStyle = "#f2c14e"; g.fillRect(bx - 3, by - 150, 6, 150);
    const swing = Math.sin(this.t * 0.4) * 30;
    g.fillRect(bx - 20, by - 150, 120, 5);
    g.strokeStyle = "#cfd3e6"; g.lineWidth = 1; g.beginPath(); g.moveTo(bx + 60 + swing * 0.3, by - 146); g.lineTo(bx + 60 + swing * 0.3, by - 80); g.stroke();
    g.fillStyle = "#5ec8f2"; g.fillRect(bx + 52 + swing * 0.3, by - 82, 16, 10);
    g.fillStyle = Math.floor(this.t * 2) % 2 ? "#ff4f4f" : "#5a1a1a"; g.fillRect(bx - 2, by - 156, 4, 4);
    // Sign.
    const [sx, sy] = iso(l.x0 + 3, l.y1, 0);
    g.fillStyle = "#0d0820"; g.fillRect(sx - 52, sy - 46, 104, 30);
    g.strokeStyle = "#f2c14e"; g.lineWidth = 2; g.strokeRect(sx - 52, sy - 46, 104, 30);
    g.font = '7px "Press Start 2P", monospace'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#f2c14e"; g.fillText(l.label[0], sx, sy - 37);
    g.fillStyle = Math.floor(this.t * 1.5) % 2 ? "#ff7eb6" : "#ffb3d4"; g.fillText(l.label[1], sx, sy - 25);
    g.textAlign = "start";
    g.fillStyle = "#1a1235"; g.fillRect(sx - 2, sy - 16, 4, 16);
  }

  // ---------------------------------------------------------------- props
  drawProp(g, p) {
    const [x, y] = iso(p.x, p.y);
    if (p.kind === "tree") {
      g.fillStyle = "rgba(0,0,0,0.25)"; g.beginPath(); g.ellipse(x, y, 20, 9, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#3b2618"; g.fillRect(x - 3, y - 26, 6, 26);
      const sway = Math.sin(this.t * 1.2 + p.x) * 1.5;
      for (const [ox, oy, r, c] of [[0, -40, 20, "#1e5a43"], [-9, -50, 14, "#24704f"], [8, -54, 13, "#2a8059"], [0, -64, 11, "#33935f"]]) { g.fillStyle = c; g.beginPath(); g.arc(x + ox + sway, y + oy, r, 0, Math.PI * 2); g.fill(); }
    } else if (p.kind === "lamp") {
      g.fillStyle = "#1a1235"; g.fillRect(x - 2, y - 46, 4, 46);
      g.fillStyle = "#2c2556"; g.fillRect(x - 6, y - 52, 12, 7);
      g.fillStyle = "#fff0b8"; g.fillRect(x - 4, y - 50, 8, 4);
    } else if (p.kind === "bench") {
      g.fillStyle = "#5a3a26"; g.fillRect(x - 14, y - 10, 28, 5); g.fillRect(x - 14, y - 18, 28, 4);
      g.fillStyle = "#2c2556"; g.fillRect(x - 12, y - 5, 3, 6); g.fillRect(x + 9, y - 5, 3, 6);
    } else if (p.kind === "bush") {
      g.fillStyle = "#1e5a43"; g.beginPath(); g.ellipse(x, y - 8, 16, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2a8059"; g.beginPath(); g.ellipse(x - 4, y - 11, 8, 6, 0, 0, Math.PI * 2); g.fill();
    } else if (p.kind === "flower") {
      for (let i = 0; i < 6; i++) { g.fillStyle = ["#ff7eb6", "#f2c14e", "#5ec8f2"][i % 3]; g.fillRect(x - 10 + i * 4, y - 3 - (i % 2) * 3, 3, 3); }
    }
  }

  // Lamp and window light pools, fireflies.
  drawLights(g) {
    g.globalCompositeOperation = "lighter";
    for (const p of PROPS) if (p.kind === "lamp") {
      const [x, y] = iso(p.x, p.y);
      const r = 60 + Math.sin(this.t * 3 + p.x) * 2, grad = g.createRadialGradient(x, y - 48, 2, x, y - 20, r);
      grad.addColorStop(0, "rgba(255,226,150,0.35)"); grad.addColorStop(1, "rgba(255,226,150,0)");
      g.fillStyle = grad; g.beginPath(); g.ellipse(x, y - 20, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
    }
    for (const f of this.fireflies) {
      const fx = f.x + Math.sin(this.t * 0.3 + f.p) * 1.2, fy = f.y + Math.cos(this.t * 0.25 + f.p) * 1.2, [x, y] = iso(fx, fy, 14 + Math.sin(this.t + f.p) * 8);
      const a = 0.4 + 0.6 * Math.max(0, Math.sin(this.t * 2 + f.p * 3));
      g.fillStyle = `rgba(220,255,160,${a})`; g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    g.globalCompositeOperation = "source-over";
  }

  // ---------------------------------------------------------------- agents
  sprite(archetype) {
    const m = this.art?.manifest.ceo?.[archetype] || this.art?.manifest.ceo?.hybrid;
    if (!m) return null;
    if (!this.art.images[m.file] && !this.art.loading.has(m.file)) {
      this.art.loading.add(m.file);
      const img = new Image(); img.onload = () => { this.art.images[m.file] = img; }; img.src = this.art.urlOf(m.file);
    }
    const img = this.art.images[m.file];
    return img ? { m, img } : null;
  }

  drawAgent(g, a) {
    if (a.alpha <= 0) return;
    const s = this.sprite(a.archetype), [fx, fy] = iso(a.x, a.y);
    g.globalAlpha = a.alpha;
    if (a.isPlayer) { // ring
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
      g.strokeStyle = `rgba(94,200,242,${0.5 + 0.4 * pulse})`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(fx, fy, 18, 9, 0, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(fx, fy, 13, 5, 0, 0, Math.PI * 2); g.fill();
    if (!s) { g.fillStyle = "#ff7eb6"; g.fillRect(fx - 6, fy - 30, 12, 30); g.globalAlpha = 1; return; }
    const { m, img } = s, [fw, fh] = m.frame, walkFrames = m.poses.length - 2;
    let frame = 0;
    if (a.walking) frame = 2 + (Math.floor(this.t * 10 + a.phase) % walkFrames);
    else if (Math.sin(this.t * 0.6 + a.phase) > 0.92) frame = 1;
    const breath = !a.walking && Math.sin(this.t * 1.8 + a.phase) > 0.2 ? 0.5 : 0;
    const x = Math.round(fx - fw / 2), y = Math.round(fy - fh + 2);
    g.save();
    if (a.walking && (m.walkFaces === "right" ? a.facing < 0 : a.facing > 0)) { g.translate(Math.round(fx) * 2, 0); g.scale(-1, 1); }
    g.drawImage(img, frame * fw, 0, fw, fh, x, y, fw, fh);
    if (breath) { const split = Math.round(fh * 0.55); g.drawImage(img, frame * fw, 0, fw, split, x, y - breath, fw, split); }
    g.restore();
    g.globalAlpha = 1;
  }

  drawTag(g, a) {
    if (a.alpha <= 0.05) return;
    const s = this.sprite(a.archetype), [fx, fy] = iso(a.x, a.y), top = fy - (s ? s.m.frame[1] : 40) - 6;
    g.font = `${a.isPlayer ? 8 : 6}px "Press Start 2P", monospace`; g.textAlign = "center"; g.textBaseline = "bottom";
    const w = g.measureText(a.name).width + 8;
    g.globalAlpha = a.alpha * (a.isPlayer ? 1 : 0.8);
    g.fillStyle = "rgba(10,6,24,0.75)"; g.fillRect(Math.round(fx - w / 2), Math.round(top - (a.isPlayer ? 12 : 10)), Math.round(w), a.isPlayer ? 12 : 10);
    g.fillStyle = a.isPlayer ? "#f2c14e" : "#cfd3e6"; g.fillText(a.name, Math.round(fx), Math.round(top - 1));
    if (a.isPlayer && !a.walking) { const bob = Math.sin(this.t * 4) * 2; g.fillStyle = "#f2c14e"; g.fillRect(Math.round(fx) - 3, Math.round(top - 20 + bob), 6, 3); g.fillRect(Math.round(fx) - 1, Math.round(top - 17 + bob), 2, 2); }
    g.globalAlpha = 1; g.textAlign = "start";
  }

  drawParticles(g) {
    for (const q of this.particles) {
      const tt = this.t - q.t0;
      if (tt < 0) continue;
      const a = 1 - tt / q.dur;
      g.fillStyle = q.color; g.globalAlpha = Math.max(0, a);
      g.fillRect(Math.round(q.x + q.vx * tt), Math.round(q.y + q.vy * tt), 2, 2);
    }
    g.globalAlpha = 1;
  }
}

// Layout data for the art templates (scripts/world-templates.mjs).
export const LAYOUT = { tiles, LOT, FOUNTAIN, PROPS, OX, OY };
