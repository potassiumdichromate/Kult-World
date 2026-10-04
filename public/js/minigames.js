// The four AI-vs-AI arcade games, simulated on a 320x180 pixel screen.
// Both sides are played by agents (no input): each game is a small, readable
// simulation that ends with a winner. The real games (Unity WebGL) replace
// these when the backend lands; the computer-screen frame stays.
//
// createGame(id, { me, them }) -> { update(dt), draw(g), done, winner, hud }

export const SW = 320, SH = 180;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function bar(g, x, y, w, v, color) {
  g.fillStyle = "#0b0617"; g.fillRect(x - 1, y - 1, w + 2, 6);
  g.fillStyle = "#2a2140"; g.fillRect(x, y, w, 4);
  g.fillStyle = color; g.fillRect(x, y, Math.round(w * clamp(v, 0, 1)), 4);
}
function txt(g, s, x, y, color = "#fff", size = 6, align = "left") {
  g.font = `${size}px "Press Start 2P", monospace`; g.textAlign = align; g.textBaseline = "top"; g.fillStyle = color; g.fillText(s, x, y); g.textAlign = "left";
}

// ------------------------------------------------------------------ Warzone Warriors
function warzone({ me, them }) {
  const walls = [[90, 50, 24, 14], [200, 110, 24, 14], [150, 80, 20, 20], [60, 130, 18, 18], [240, 40, 18, 18]];
  const solid = (x, y) => x < 6 || y < 16 || x > SW - 6 || y > SH - 6 || walls.some(([wx, wy, ww, wh]) => x > wx - 4 && x < wx + ww + 4 && y > wy - 4 && y < wy + wh + 4);
  const sides = [
    { ...me, x: 30, y: 90, hp: 100, cd: 0, tx: 30, ty: 90 },
    { ...them, x: 290, y: 90, hp: 100, cd: 0, tx: 290, ty: 90 }
  ];
  const bullets = [], fx = [];
  const s = { done: false, winner: null, t: 0, limit: 40 };
  s.update = (dt) => {
    s.t += dt;
    sides.forEach((a, i) => {
      const b = sides[1 - i];
      if (Math.hypot(a.tx - a.x, a.ty - a.y) < 4) { for (let k = 0; k < 10; k++) { const nx = rnd(20, SW - 20), ny = rnd(24, SH - 14); if (!solid(nx, ny)) { a.tx = nx; a.ty = ny; break; } } }
      const d = Math.hypot(a.tx - a.x, a.ty - a.y) || 1, sp = 34 * dt;
      const nx = a.x + ((a.tx - a.x) / d) * sp, ny = a.y + ((a.ty - a.y) / d) * sp;
      if (!solid(nx, ny)) { a.x = nx; a.y = ny; } else { a.tx = a.x; a.ty = a.y; }
      a.cd -= dt;
      if (a.cd <= 0 && b.hp > 0) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x) + rnd(-0.12, 0.12);
        bullets.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 140, vy: Math.sin(ang) * 140, from: i, life: 2 });
        a.cd = rnd(0.35, 0.7);
      }
    });
    for (const bl of bullets) {
      bl.x += bl.vx * dt; bl.y += bl.vy * dt; bl.life -= dt;
      if (solid(bl.x, bl.y)) { bl.life = 0; fx.push({ x: bl.x, y: bl.y, t: 0.2, c: "#fff3a0" }); continue; }
      const tgt = sides[1 - bl.from];
      if (Math.hypot(tgt.x - bl.x, tgt.y - bl.y) < 6) { tgt.hp -= rnd(5, 9); bl.life = 0; fx.push({ x: bl.x, y: bl.y, t: 0.3, c: "#ff5050" }); }
    }
    for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].life <= 0) bullets.splice(i, 1);
    for (const f of fx) f.t -= dt;
    const dead = sides.findIndex((a) => a.hp <= 0);
    if (dead >= 0 || s.t > s.limit) { s.done = true; s.winner = dead >= 0 ? 1 - dead : sides[0].hp >= sides[1].hp ? 0 : 1; }
  };
  s.draw = (g) => {
    g.fillStyle = "#2b2a1e"; g.fillRect(0, 0, SW, SH);
    for (let x = 0; x < SW; x += 16) for (let y = 14; y < SH; y += 16) { g.fillStyle = (x + y) % 32 ? "#312f22" : "#2d2b1f"; g.fillRect(x, y, 16, 16); }
    for (const [wx, wy, ww, wh] of walls) { g.fillStyle = "#6b5a3a"; g.fillRect(wx, wy, ww, wh); g.fillStyle = "#8a7550"; g.fillRect(wx, wy, ww, 3); }
    for (const bl of bullets) { g.fillStyle = bl.from ? "#ff9f9f" : "#9fe3ff"; g.fillRect(Math.round(bl.x) - 1, Math.round(bl.y) - 1, 3, 2); }
    sides.forEach((a, i) => {
      if (a.hp <= 0) return;
      g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(Math.round(a.x) - 5, Math.round(a.y) + 4, 10, 3);
      g.fillStyle = a.color; g.fillRect(Math.round(a.x) - 4, Math.round(a.y) - 5, 8, 9);
      g.fillStyle = "#f1d3b0"; g.fillRect(Math.round(a.x) - 3, Math.round(a.y) - 9, 6, 5);
      const o = sides[1 - i], ang = Math.atan2(o.y - a.y, o.x - a.x);
      g.fillStyle = "#222"; g.fillRect(Math.round(a.x + Math.cos(ang) * 6) - 1, Math.round(a.y + Math.sin(ang) * 6) - 1, 3, 3);
    });
    for (const f of fx) if (f.t > 0) { g.fillStyle = f.c; g.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 4, 4); }
    hud(g, sides, s);
  };
  s.sides = sides;
  return s;
}

// ------------------------------------------------------------------ Robowars
function robowars({ me, them }) {
  const sides = [{ ...me, x: 70, vx: 0, y: 0, vy: 0, hp: 100, cd: 1, act: null, actT: 0, dir: 1 }, { ...them, x: 250, vx: 0, y: 0, vy: 0, hp: 100, cd: 1.3, act: null, actT: 0, dir: -1 }];
  const fx = [], beams = [];
  const s = { done: false, winner: null, t: 0, limit: 40, shake: 0 };
  const GY = 146;
  s.update = (dt) => {
    s.t += dt; s.shake = Math.max(0, s.shake - dt);
    sides.forEach((a, i) => {
      const b = sides[1 - i], dist = b.x - a.x;
      a.dir = Math.sign(dist) || a.dir;
      a.cd -= dt; a.actT -= dt;
      if (a.actT <= 0) a.act = null;
      if (a.cd <= 0) {
        const r = Math.random();
        if (Math.abs(dist) < 46 && r < 0.65) { a.act = "punch"; a.actT = 0.3; a.cd = rnd(0.6, 1.1); if (Math.abs(dist) < 50) { b.hp -= rnd(7, 12); b.vx += a.dir * 70; s.shake = 0.15; fx.push({ x: (a.x + b.x) / 2, y: GY - 40, t: 0.25, c: "#fff3a0" }); } }
        else if (r < 0.85) { a.act = "laser"; a.actT = 0.4; a.cd = rnd(1.2, 2); beams.push({ x: a.x + a.dir * 18, dir: a.dir, y: GY - 46, t: 0.4, from: i }); if (Math.abs(dist) > 20) { b.hp -= rnd(6, 10); fx.push({ x: b.x, y: GY - 46, t: 0.3, c: "#ff4fa3" }); } }
        else if (a.y === 0) { a.vy = 150; a.cd = 0.6; }
        else a.cd = 0.3;
      }
      const want = Math.abs(dist) > 60 ? 1 : Math.abs(dist) < 30 ? -1 : 0;
      a.vx += a.dir * want * 120 * dt;
      a.vx *= 0.9; a.x = clamp(a.x + a.vx * dt, 24, SW - 24);
      a.vy -= 400 * dt; a.y = Math.max(0, a.y + a.vy * dt); if (a.y === 0) a.vy = 0;
    });
    for (const f of fx) f.t -= dt;
    for (const bm of beams) bm.t -= dt;
    const dead = sides.findIndex((a) => a.hp <= 0);
    if (dead >= 0 || s.t > s.limit) { s.done = true; s.winner = dead >= 0 ? 1 - dead : sides[0].hp >= sides[1].hp ? 0 : 1; }
  };
  s.draw = (g) => {
    const sh = s.shake > 0 ? Math.round(rnd(-2, 2)) : 0;
    g.save(); g.translate(sh, 0);
    const grad = g.createLinearGradient(0, 0, 0, SH); grad.addColorStop(0, "#2a0d1e"); grad.addColorStop(1, "#5a1a2a");
    g.fillStyle = grad; g.fillRect(-4, 0, SW + 8, SH);
    g.fillStyle = "#3a0f1f"; for (let i = 0; i < 8; i++) g.fillRect(i * 44, 70 + (i % 3) * 10, 30, 80);
    g.fillStyle = "#1a0710"; g.fillRect(-4, GY, SW + 8, SH - GY);
    g.fillStyle = "#ff4f4f"; g.fillRect(-4, GY, SW + 8, 2);
    for (const bm of beams) if (bm.t > 0) { g.fillStyle = bm.from ? "#ff4fa3" : "#5ec8f2"; const x0 = bm.dir > 0 ? bm.x : 0, w = bm.dir > 0 ? SW - bm.x : bm.x; g.globalAlpha = bm.t / 0.4; g.fillRect(x0, bm.y - 2, w, 4); g.globalAlpha = 1; }
    sides.forEach((a) => {
      const x = Math.round(a.x), y = GY - Math.round(a.y);
      g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(x - 14, GY - 2, 28, 4);
      g.fillStyle = "#3a3a4a"; g.fillRect(x - 10, y - 20, 6, 20); g.fillRect(x + 4, y - 20, 6, 20);
      g.fillStyle = a.color; g.fillRect(x - 14, y - 50, 28, 30);
      g.fillStyle = "#1a1a24"; g.fillRect(x - 9, y - 62, 18, 12);
      g.fillStyle = a.act === "laser" ? "#fff" : a.color; g.fillRect(x + a.dir * 2 - 3, y - 58, 6, 3);
      const reach = a.act === "punch" ? 22 : 10;
      g.fillStyle = "#555566"; g.fillRect(a.dir > 0 ? x + 12 : x - 12 - reach, y - 44, reach, 7);
    });
    for (const f of fx) if (f.t > 0) { g.fillStyle = f.c; g.fillRect(Math.round(f.x) - 4, Math.round(f.y) - 4, 8, 8); }
    g.restore();
    hud(g, sides, s);
  };
  s.sides = sides;
  return s;
}

// ------------------------------------------------------------------ Warzone Warriors Wave
function wave({ me, them }) {
  const sides = [{ ...me, x: 100, y: 100, score: 0, cd: 0, tx: 100, ty: 100 }, { ...them, x: 220, y: 100, score: 0, cd: 0, tx: 220, ty: 100 }];
  const foes = [], shots = [], fx = [];
  const s = { done: false, winner: null, t: 0, limit: 36, wave: 1, spawnT: 0 };
  s.update = (dt) => {
    s.t += dt; s.spawnT -= dt; s.wave = 1 + Math.floor(s.t / 9);
    if (s.spawnT <= 0) {
      const edge = Math.floor(rnd(0, 4));
      const [x, y] = edge === 0 ? [rnd(0, SW), 16] : edge === 1 ? [rnd(0, SW), SH] : edge === 2 ? [0, rnd(16, SH)] : [SW, rnd(16, SH)];
      foes.push({ x, y, hp: 1 + Math.floor(s.wave / 2) });
      s.spawnT = Math.max(0.18, 0.7 - s.wave * 0.1);
    }
    for (const f of foes) { const tgt = sides.reduce((a, b) => (Math.hypot(b.x - f.x, b.y - f.y) < Math.hypot(a.x - f.x, a.y - f.y) ? b : a)); const d = Math.hypot(tgt.x - f.x, tgt.y - f.y) || 1; f.x += ((tgt.x - f.x) / d) * (18 + s.wave * 3) * dt; f.y += ((tgt.y - f.y) / d) * (18 + s.wave * 3) * dt; }
    sides.forEach((a) => {
      if (Math.hypot(a.tx - a.x, a.ty - a.y) < 4) { a.tx = rnd(60, SW - 60); a.ty = rnd(50, SH - 30); }
      const d = Math.hypot(a.tx - a.x, a.ty - a.y) || 1; a.x += ((a.tx - a.x) / d) * 26 * dt; a.y += ((a.ty - a.y) / d) * 26 * dt;
      a.cd -= dt;
      if (a.cd <= 0 && foes.length) {
        const f = foes.reduce((p, q) => (Math.hypot(q.x - a.x, q.y - a.y) < Math.hypot(p.x - a.x, p.y - a.y) ? q : p));
        const ang = Math.atan2(f.y - a.y, f.x - a.x) + rnd(-0.08, 0.08);
        shots.push({ x: a.x, y: a.y, vx: Math.cos(ang) * 170, vy: Math.sin(ang) * 170, owner: a, life: 1.5 });
        a.cd = rnd(0.16, 0.3);
      }
    });
    for (const sh of shots) {
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.life -= dt;
      const f = foes.find((q) => Math.hypot(q.x - sh.x, q.y - sh.y) < 5);
      if (f) { f.hp -= 1; sh.life = 0; if (f.hp <= 0) { sh.owner.score += 10 * s.wave; fx.push({ x: f.x, y: f.y, t: 0.3 }); foes.splice(foes.indexOf(f), 1); } }
    }
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
    for (const f of fx) f.t -= dt;
    if (s.t > s.limit) { s.done = true; s.winner = sides[0].score >= sides[1].score ? 0 : 1; }
  };
  s.draw = (g) => {
    g.fillStyle = "#16112a"; g.fillRect(0, 0, SW, SH);
    g.strokeStyle = "#241c42"; for (let x = 0; x < SW; x += 20) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, SH); g.stroke(); } for (let y = 14; y < SH; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(SW, y); g.stroke(); }
    for (const f of foes) { g.fillStyle = "#8a2be2"; g.fillRect(Math.round(f.x) - 4, Math.round(f.y) - 4, 8, 8); g.fillStyle = "#ff4f4f"; g.fillRect(Math.round(f.x) - 2, Math.round(f.y) - 2, 2, 2); g.fillRect(Math.round(f.x) + 1, Math.round(f.y) - 2, 2, 2); }
    for (const sh of shots) { g.fillStyle = sh.owner === sides[0] ? "#9fe3ff" : "#ffb3d4"; g.fillRect(Math.round(sh.x), Math.round(sh.y), 2, 2); }
    for (const a of sides) { g.fillStyle = a.color; g.fillRect(Math.round(a.x) - 4, Math.round(a.y) - 5, 8, 9); g.fillStyle = "#f1d3b0"; g.fillRect(Math.round(a.x) - 3, Math.round(a.y) - 9, 6, 5); }
    for (const f of fx) if (f.t > 0) { g.fillStyle = "#fff3a0"; g.fillRect(Math.round(f.x) - 5, Math.round(f.y) - 5, 10, 10); }
    hud(g, sides, s, true);
    txt(g, `WAVE ${s.wave}`, SW / 2, 16, "#f2c14e", 6, "center");
  };
  s.sides = sides;
  return s;
}

// ------------------------------------------------------------------ Highway Hustle
function highway({ me, them }) {
  const LANES = [86, 126, 166, 206, 246];
  const sides = [{ ...me, lane: 1, x: LANES[1], dist: 0, speed: 120, crashT: 0 }, { ...them, lane: 3, x: LANES[3], dist: 0, speed: 120, crashT: 0 }];
  const traffic = [];
  const s = { done: false, winner: null, t: 0, limit: 34, scroll: 0, spawnT: 0 };
  const carY = (a) => 130 - (a.dist - (sides[0].dist + sides[1].dist) / 2) * 0.6;
  s.update = (dt) => {
    s.t += dt; s.spawnT -= dt;
    const avg = (sides[0].dist + sides[1].dist) / 2;
    s.scroll = avg;
    if (s.spawnT <= 0) { traffic.push({ lane: Math.floor(rnd(0, LANES.length)), d: avg + 220, speed: rnd(40, 70), color: ["#e6e6f0", "#5ec8f2", "#7ee081", "#ff9f5a"][Math.floor(rnd(0, 4))] }); s.spawnT = rnd(0.35, 0.7); }
    for (const c of traffic) c.d += c.speed * dt;
    sides.forEach((a) => {
      a.crashT -= dt;
      const target = a.crashT > 0 ? 50 : 150 + s.t * 2;
      a.speed += (target - a.speed) * dt * 1.5;
      a.dist += a.speed * dt;
      // Look ahead and change lanes to dodge.
      const ahead = traffic.find((c) => c.lane === a.lane && c.d > a.dist && c.d - a.dist < 60);
      if (ahead && Math.random() < 0.9) {
        const opts = [a.lane - 1, a.lane + 1].filter((l) => l >= 0 && l < LANES.length && !traffic.some((c) => c.lane === l && Math.abs(c.d - a.dist) < 40));
        if (opts.length) a.lane = opts[Math.floor(rnd(0, opts.length))];
      }
      a.x += (LANES[a.lane] - a.x) * Math.min(1, dt * 8);
      const hit = traffic.find((c) => Math.abs(LANES[c.lane] - a.x) < 14 && Math.abs(c.d - a.dist) < 16);
      if (hit && a.crashT <= 0 && Math.random() < 0.5) { a.crashT = 1; hit.d += 30; }
    });
    for (let i = traffic.length - 1; i >= 0; i--) if (traffic[i].d < avg - 200) traffic.splice(i, 1);
    if (s.t > s.limit) { s.done = true; s.winner = sides[0].dist >= sides[1].dist ? 0 : 1; }
  };
  s.draw = (g) => {
    g.fillStyle = "#1c3a24"; g.fillRect(0, 0, SW, SH);
    g.fillStyle = "#2a2a34"; g.fillRect(66, 0, 200, SH);
    g.fillStyle = "#f2c14e"; g.fillRect(66, 0, 3, SH); g.fillRect(263, 0, 3, SH);
    for (let l = 1; l < LANES.length; l++) for (let y = -20; y < SH; y += 24) { g.fillStyle = "#cfd3e6"; g.fillRect(LANES[l] - 21, Math.round((y + (s.scroll * 0.6) % 24)), 2, 12); }
    for (let i = 0; i < 6; i++) { const y = Math.round(((i * 40 + s.scroll * 0.6) % 220) - 20); g.fillStyle = "#24603a"; g.beginPath(); g.arc(30, y, 10, 0, Math.PI * 2); g.arc(296, y + 20, 10, 0, Math.PI * 2); g.fill(); }
    const avg = (sides[0].dist + sides[1].dist) / 2;
    for (const c of traffic) { const y = Math.round(130 - (c.d - avg) * 0.6); g.fillStyle = c.color; g.fillRect(LANES[c.lane] - 7, y - 12, 14, 24); g.fillStyle = "#1a1a24"; g.fillRect(LANES[c.lane] - 5, y - 8, 10, 6); }
    sides.forEach((a) => {
      const y = Math.round(carY(a));
      if (a.crashT > 0 && Math.floor(s.t * 12) % 2) return;
      g.fillStyle = a.color; g.fillRect(Math.round(a.x) - 8, y - 14, 16, 28);
      g.fillStyle = "#0b0617"; g.fillRect(Math.round(a.x) - 6, y - 8, 12, 7);
      g.fillStyle = "#fff3a0"; g.fillRect(Math.round(a.x) - 7, y - 15, 3, 2); g.fillRect(Math.round(a.x) + 4, y - 15, 3, 2);
    });
    g.fillStyle = "rgba(10,6,24,0.8)"; g.fillRect(0, 0, SW, 14);
    sides.forEach((a, i) => txt(g, `${a.name.toUpperCase()} ${Math.round(a.dist / 10)}M`, i ? SW - 4 : 4, 4, a.color, 6, i ? "right" : "left"));
    txt(g, `${Math.max(0, Math.ceil(s.limit - s.t))}s`, SW / 2, 4, "#f2c14e", 6, "center");
  };
  s.sides = sides;
  return s;
}

function hud(g, sides, s, score = false) {
  g.fillStyle = "rgba(10,6,24,0.8)"; g.fillRect(0, 0, SW, 14);
  sides.forEach((a, i) => {
    const x = i ? SW - 104 : 4;
    txt(g, a.name.toUpperCase().slice(0, 8), i ? SW - 4 : 4, 2, a.color, 5, i ? "right" : "left");
    if (score) txt(g, String(a.score), i ? SW - 60 : 60, 2, "#fff", 6, i ? "right" : "left");
    else bar(g, x, 9, 100, a.hp / 100, a.color);
  });
  txt(g, `${Math.max(0, Math.ceil(s.limit - s.t))}`, SW / 2, 4, "#f2c14e", 6, "center");
}

export function createGame(id, sides) {
  return ({ warzone, robowars, wave, highway }[id] || warzone)(sides);
}

// Thumbnail art for the arcade cards (placeholder until real key art lands).
export function drawThumb(canvas, id, color) {
  canvas.width = SW; canvas.height = SH;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;
  const game = createGame(id, { me: { name: "YOU", color: "#5ec8f2" }, them: { name: "RIVAL", color: color || "#ff4fa3" } });
  for (let i = 0; i < 90; i++) game.update(1 / 30); // warm up a busy frame
  game.draw(g);
}
