// Kult World demo: landing, simulated sign-in, minting, the town, the
// Passport sidebar, the Kult Business Park and the Kult Arcade. All data is
// simulated (js/data.js); see docs/ for the asset plan and the backend notes.

import { World, BUILDINGS, MAP, walkable } from "./world.js";
import { createGame, drawThumb, SW, SH } from "./minigames.js";
import {
  CLANS, ARCHETYPES, archetype, TRAITS, RANKS, rankOf, nextRank, BUSINESSES, GAMES,
  randomOpponent, randomName, wanderers, mintAgent, veteranPlayer, loadPlayer, savePlayer, resetPlayer
} from "./data.js";

const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v; else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const show = (id, on = true) => { $(id).hidden = !on; };
let toastT = null;
function toast(msg, kind = "") { const t = $("toast"); t.textContent = msg; t.className = kind; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }
const fmt = (n) => Number(n || 0).toLocaleString();
const ago = (iso) => { const s = Math.max(1, (Date.now() - Date.parse(iso)) / 1000); return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ state
const state = { player: loadPlayer(), returning: false, inWorld: false, manifest: null, urlOf: (f) => `art/${f}`, wart: null };
const world = new World($("world"));

// ------------------------------------------------------------------ art
async function loadArt() {
  try {
    const m = await fetch(`art/manifest.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
    state.manifest = m;
    state.urlOf = (f) => `art/${f}${m.rev ? `?v=${m.rev}` : ""}`;
    world.useArt(m, {}, state.urlOf);
  } catch (e) { console.warn("[kult-world] art not loaded", e); }
  try {
    const w = await fetch(`art/world/manifest.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
    state.wart = w;
    world.useWorldArt(w, (f) => `art/${f}?v=${w.rev}`);
    const mon = w.files.monitor;
    if (mon?.screen) {
      const [x0, y0, x1, y1] = mon.screen, m = document.querySelector(".monitor");
      m.classList.add("art");
      m.style.cssText = `--ar:${mon.w}/${mon.h};--sl:${(x0 / mon.w) * 100}%;--st:${(y0 / mon.h) * 100}%;--sw:${((x1 - x0) / mon.w) * 100}%;--sh:${((y1 - y0) / mon.h) * 100}%`;
    }
  } catch (e) { console.warn("[kult-world] world art not loaded", e); }
}
// URL of an imported world asset (null when missing).
const wart = (key) => { const f = state.wart?.files?.[key]; return f ? `art/${f.file}?v=${state.wart.rev}` : null; };
const portraitUrl = (arch) => { const m = state.manifest?.ceo?.[String(arch).toLowerCase()]; return m?.portrait ? state.urlOf(m.portrait) : null; };
const rankBadge = (r) => `art/${r.badge}`;

// ------------------------------------------------------------------ loop
function resize() { world.resize(innerWidth, innerHeight, Math.min(2, devicePixelRatio || 1)); }
addEventListener("resize", resize);
resize();
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  world.update(dt); world.draw();
  if (state.inWorld) updateLocation();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Other agents walking the town (also the landing backdrop).
for (const w of wanderers(8)) {
  let x, y; do { x = 8 + Math.floor(Math.random() * 15) + 0.5; y = 8 + Math.floor(Math.random() * 15) + 0.5; } while (!walkable(Math.floor(x), Math.floor(y)));
  world.addAgent(w.id, { ...w, x, y });
}

// ------------------------------------------------------------------ pointer
const canvas = $("world");
canvas.addEventListener("pointermove", (e) => {
  if (!state.inWorld) return;
  const b = world.buildingAt(e.clientX, e.clientY);
  world.hover = b?.id || null;
  canvas.style.cursor = b ? "pointer" : "default";
  const tip = $("world-tip");
  if (b) { tip.textContent = `${b.name} · click to enter`; tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`; tip.hidden = false; }
  else tip.hidden = true;
});
canvas.addEventListener("pointerleave", () => { world.hover = null; $("world-tip").hidden = true; });
canvas.addEventListener("click", (e) => {
  if (!state.inWorld) return;
  const b = world.buildingAt(e.clientX, e.clientY);
  if (b) return goTo(b.id);
  world.walkToScreen(e.clientX, e.clientY);
});

function goTo(id) {
  const b = BUILDINGS.find((x) => x.id === id);
  $("location").textContent = `Walking to ${b.name}…`;
  world.walkToBuilding(id, () => openPlace(id));
}
function updateLocation() {
  const p = world.player;
  if (!p || p.walking) return;
  const near = BUILDINGS.find((b) => Math.hypot(p.x - b.door.tile[0] - 0.5, p.y - b.door.tile[1] - 0.5) < 2.2);
  $("location").textContent = near ? near.name : "Kult Plaza";
}

// ------------------------------------------------------------------ landing & sign-in
$("enter-btn").addEventListener("click", () => {
  state.returning = false;
  if (state.player) return enterWorld(false);
  showLogin();
});
$("returning-btn").addEventListener("click", () => { state.returning = true; showLogin(); });
function showLogin() { show("login-status", false); show("login"); }
for (const b of document.querySelectorAll(".login-opt")) b.addEventListener("click", async () => {
  const st = $("login-status");
  st.textContent = `Connecting with ${b.dataset.method}…`; st.hidden = false;
  for (const x of document.querySelectorAll(".login-opt")) x.disabled = true;
  await wait(900);
  st.textContent = "Checking your AI Arena agents…";
  await wait(700);
  for (const x of document.querySelectorAll(".login-opt")) x.disabled = false;
  show("login", false);
  if (state.returning) { state.player = veteranPlayer(); savePlayer(state.player); return enterWorld(false); }
  if (state.player) return enterWorld(false);
  openMint();
});
for (const b of document.querySelectorAll("[data-close]")) b.addEventListener("click", () => show(b.dataset.close, false));

// ------------------------------------------------------------------ mint
const mintSel = { clan: "ZEROG", archetype: "support" };
function openMint() {
  $("mint-name").value = `kult-player_${Math.random().toString(16).slice(2, 10)}`;
  renderMint();
  show("mint");
}
function renderMint() {
  const a = archetype(mintSel.archetype);
  const rgb = [1, 3, 5].map((i) => parseInt(a.color.slice(i, i + 2), 16)).join(",");
  const sel = $("mint-selected");
  sel.style.setProperty("--a-rgb", rgb); sel.style.setProperty("--ac", a.color);
  sel.replaceChildren(
    portraitUrl(a.id) ? el("img", { src: portraitUrl(a.id), alt: "" }) : el("span"),
    el("div", {}, el("span", { class: "sel-k" }, "● Selected archetype"), el("div", { class: "sel-name" }, a.name.toUpperCase()), el("div", { class: "sel-tag" }, a.tagline), el("div", { class: "role-chips" }, a.role.map((r) => el("span", {}, r)))));
  $("mint-clans").replaceChildren(...CLANS.map((c) => el("button", { type: "button", style: `--c:${c.color}`, "aria-pressed": mintSel.clan === c.id ? "true" : "false", onclick: () => { mintSel.clan = c.id; renderMint(); } }, el("i"), c.name)));
  $("mint-archetypes").replaceChildren(...ARCHETYPES.map((x) => el("button", { type: "button", style: `--c:${x.color}`, "aria-pressed": mintSel.archetype === x.id ? "true" : "false", onclick: () => { mintSel.archetype = x.id; renderMint(); } },
    portraitUrl(x.id) ? el("img", { src: portraitUrl(x.id), alt: "" }) : el("span"), x.name.toUpperCase())));
}
$("mint-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("mint-name").value.trim() || randomName();
  show("mint", false);
  $("minting-portrait").replaceChildren(portraitUrl(mintSel.archetype) ? el("img", { src: portraitUrl(mintSel.archetype), alt: "" }) : "");
  const steps = ["Creating your agent on AI Arena", "Minting your INFT on 0G", "Funding its custodial hot wallet", "Issuing your Kult World passport", "Spawning in Kult World"];
  const list = $("minting-steps");
  list.replaceChildren(...steps.map((s) => el("li", {}, el("span", { class: "s" }), s)));
  show("minting");
  for (const li of list.children) { li.className = "run"; await wait(650 + Math.random() * 350); li.className = "ok"; }
  await wait(300);
  show("minting", false);
  state.player = mintAgent({ name, archetype: mintSel.archetype, clan: mintSel.clan, backstory: $("mint-story").value.trim(), username: "kultplayer" });
  savePlayer(state.player);
  enterWorld(true);
});

// ------------------------------------------------------------------ the world
function enterWorld(fresh) {
  for (const id of ["landing", "login", "mint", "minting"]) show(id, false);
  for (const id of ["passport", "topbar", "hint"]) show(id, true);
  state.inWorld = true;
  const a = state.player.agent;
  world.spawnPlayer({ name: a.name, archetype: a.archetype, clan: a.clan });
  renderPassport();
  setTimeout(() => toast(fresh ? `${a.name} spawned in Kult World! Visit the Business Park or the Arcade.` : `Welcome back, ${a.name}.`, "good"), 900);
  setTimeout(() => show("hint", false), 12000);
}

// ------------------------------------------------------------------ passport sidebar
const STAMPS = [["park", "PARK", "#f2c14e"], ["arcade", "ARCADE", "#ff4fa3"], ["create", "CREATE", "#ff7eb6"], ["sports", "SPORTS", "#3ddc84"], ["dex", "DEX", "#5ec8f2"], ["production", "PROD", "#f2c14e"]];
function renderPassport() {
  const p = state.player, a = p.agent, arch = archetype(a.archetype), clan = CLANS.find((c) => c.id === a.clan);
  const r = rankOf(a.elo), nr = nextRank(a.elo), games = a.wins + a.losses;
  $("bal-arena").textContent = fmt(p.balances.arena); $("bal-kp").textContent = fmt(p.balances.kp);
  const section = (title, small, ...kids) => el("section", { class: "pp-section" }, el("h3", {}, title, small ? el("small", {}, small) : null), ...kids);
  $("passport-body").replaceChildren(
    // Passport card
    el("div", { class: "pp-card" },
      el("div", { class: "pp-head" }, el("span", { class: "t" }, "KULT WORLD PASSPORT"), el("span", { class: "seal", title: rankOf(a.elo).name }, wart("passport-bg") ? el("img", { src: rankBadge(rankOf(a.elo)), alt: "" }) : "K")),
      el("div", { class: "pp-id" }, p.passport.id),
      el("dl", { class: "pp-rows" },
        el("dt", {}, "Citizen"), el("dd", {}, p.passport.username),
        el("dt", {}, "Wallet"), el("dd", {}, p.passport.wallet),
        el("dt", {}, "Since"), el("dd", {}, new Date(p.passport.citizenSince).toLocaleDateString())),
      el("div", { class: "pp-level" }, el("span", { class: "lv ic xp" }, `LEVEL ${p.passport.level}`), el("span", { class: "muted" }, `${fmt(p.passport.xp)} / ${fmt(p.passport.xpToNext)} XP`)),
      el("div", { class: "bar" }, el("i", { style: `width:${Math.round((p.passport.xp / p.passport.xpToNext) * 100)}%` })),
      el("div", { class: "stamps", title: "Places and businesses visited" }, STAMPS.map(([id, label, c]) => {
        const on = p.passport.stamps.includes(id), img = wart(`stamp-${id}`);
        return img ? el("span", { class: `stamp img${on ? " on" : ""}`, title: `${label}${on ? "" : " (not visited)"}` }, el("img", { src: img, alt: label }))
          : el("span", { class: `stamp${on ? " on" : ""}`, style: `--c:${c}` }, label);
      }))),
    // Agent identity
    section("Agent identity", `INFT #${a.inft}`,
      el("div", { class: "agent-row" },
        portraitUrl(a.archetype) ? el("img", { src: portraitUrl(a.archetype), alt: "" }) : el("span"),
        el("div", {}, el("div", { class: "n" }, a.name), el("div", { class: "tags" },
          el("span", { class: "tag", style: `color:${arch.color}` }, arch.name.toUpperCase()),
          el("span", { class: "tag", style: `color:${clan?.color}` }, clan?.name.toUpperCase()),
          el("span", { class: "tag", style: "color:var(--muted)" }, a.evolution)))),
      el("div", { class: "rank-row" },
        el("img", { src: rankBadge(r), alt: "" }),
        el("div", {}, el("div", { class: "rn", style: `color:${r.color}` }, r.name.toUpperCase()), el("div", { class: "bar" }, el("i", { style: `--c:${r.color};width:${nr ? Math.round(((a.elo - r.min) / (nr.min - r.min)) * 100) : 100}%` })), el("div", { class: "muted tiny", style: "margin-top:3px" }, nr ? `${fmt(nr.min - a.elo)} ELO to ${nr.name}` : "Top rank")),
        el("span", { class: "elo ic elo-ic", title: "ELO" }, fmt(a.elo))),
      el("div", { class: "wl" },
        el("div", {}, el("b", { style: "color:var(--green)" }, a.wins), el("span", {}, "Wins")),
        el("div", {}, el("b", { style: "color:var(--red)" }, a.losses), el("span", {}, "Losses")),
        el("div", {}, el("b", {}, games ? `${Math.round((a.wins / games) * 100)}%` : "—"), el("span", {}, "Win rate")))),
    section("Traits", arch.role.join(" · "),
      el("div", { class: "traits" }, TRAITS.map((t) => el("div", { class: "trait" }, el("span", {}, t), el("div", { class: "bar" }, el("i", { style: `--c:${arch.color};width:${a.traits[t]}%` })), el("b", {}, a.traits[t]))))),
    section("Balances", null,
      el("div", { class: "bal-grid" },
        el("div", { class: "bal arena", style: "--c:var(--pink)" }, el("b", {}, fmt(p.balances.arena)), el("span", {}, "$ARENA")),
        el("div", { class: "bal kp", style: "--c:var(--gold)" }, el("b", {}, fmt(p.balances.kp)), el("span", {}, "Kult Points")),
        el("div", { class: "bal kult", style: "--c:var(--blue)" }, el("b", {}, fmt(p.balances.kult)), el("span", {}, "KULT")))),
    section("Businesses", `${Object.values(p.businesses).filter((b) => b.owned).length} owned`,
      el("div", { class: "biz-list" }, BUSINESSES.map((b) => {
        const own = p.businesses[b.id];
        const sub = own?.owned ? (b.id === "create" ? `${own.name} · ${own.gamesShipped} games · ${fmt(own.credits)} credits` : `${own.name} · Lv ${own.level} · ${own.points} pts${own.rank ? ` · #${own.rank}` : ""}`) : b.status === "open" ? `${b.brand} · open one in the Business Park` : `${b.brand} · coming soon`;
        return el("div", { class: "biz-row", style: `--c:${b.color}` }, el("span", { class: "dot" }), el("div", { style: "min-width:0" }, el("div", { class: "bn" }, b.name), el("div", { class: "bs" }, sub)),
          el("span", { class: `st ${own?.owned ? "own" : b.status}` }, own?.owned ? "OWNED" : b.status === "open" ? "OPEN" : "SOON"));
      }))),
    section("Quests", null, p.quests.map((q) => el("div", { class: `quest${q.progress >= q.target ? " done" : ""}` },
      el("div", { class: "qh" }, el("span", { class: "ic ic-quest" }, q.title), el("span", { class: "qr" }, q.reward)),
      el("div", { class: "bar" }, el("i", { style: `--c:var(--green);width:${Math.round((Math.min(q.progress, q.target) / q.target) * 100)}%` })),
      el("span", { class: "muted tiny" }, `${Math.min(q.progress, q.target)} / ${q.target}`)))),
    section("Recent activity", null, el("ul", { class: "activity" }, p.activity.slice(0, 6).map((x) => el("li", {}, x.text, el("time", {}, ago(x.at)))))));
}
function addActivity(text) { state.player.activity.unshift({ at: new Date().toISOString(), text }); state.player.activity = state.player.activity.slice(0, 20); }
function stamp(id) { const s = state.player.passport.stamps; if (!s.includes(id)) { s.push(id); gainXp(60); } }
function quest(id, by = 1) { const q = state.player.quests.find((x) => x.id === id); if (q && q.progress < q.target) { q.progress += by; if (q.progress >= q.target) toast(`Quest complete: ${q.title} (+${q.reward})`, "good"); } }
function gainXp(n) { const pp = state.player.passport; pp.xp += n; while (pp.xp >= pp.xpToNext) { pp.xp -= pp.xpToNext; pp.level += 1; pp.xpToNext = Math.round(pp.xpToNext * 1.35); toast(`Passport level ${pp.level}!`, "good"); } }
function commit() { savePlayer(state.player); renderPassport(); }

$("passport-toggle").addEventListener("click", () => { const o = $("passport").classList.toggle("open"); $("passport-toggle").setAttribute("aria-expanded", String(o)); });
$("menu-btn").addEventListener("click", () => show("menu", $("menu").hidden));
for (const b of document.querySelectorAll("[data-goto]")) b.addEventListener("click", () => { show("menu", false); goTo(b.dataset.goto); });
$("reset-demo").addEventListener("click", () => { resetPlayer(); location.reload(); });

// ------------------------------------------------------------------ places
function openPlace(id) {
  if (id === "park") { renderBiz(); show("park"); stamp("park"); quest("visit-park"); commit(); }
  if (id === "arcade") { renderGames(); show("arcade-list"); show("arcade-match", false); show("arcade"); stamp("arcade"); commit(); }
}

// Placeholder pixel art for business cards (replaced by the final card art).
function bizArt(b) {
  const c = el("canvas", { width: 160, height: 90 }), g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  P(0, 70, 160, 20, "#120b28");
  if (b.id === "create") { P(46, 30, 68, 40, "#2c2556"); P(52, 36, 56, 26, "#0d0820"); P(60, 44, 10, 10, "#ff7eb6"); P(76, 40, 14, 6, "#5ec8f2"); P(92, 50, 8, 8, "#f2c14e"); P(70, 70, 20, 4, "#2c2556"); P(30, 54, 16, 16, "#3b3170"); P(116, 50, 16, 20, "#3b3170"); }
  if (b.id === "sports") { P(30, 46, 100, 24, "#1f7a4f"); P(80, 46, 2, 24, "#e6fff2"); P(30, 46, 100, 2, "#e6fff2"); P(30, 68, 100, 2, "#e6fff2"); P(74, 52, 12, 12, "#e6fff2"); P(77, 55, 6, 6, "#0b1a14"); P(40, 30, 6, 16, "#cfd3e6"); P(114, 30, 6, 16, "#cfd3e6"); }
  if (b.id === "dex") { P(34, 60, 10, 10, "#5ec8f2"); P(50, 48, 10, 22, "#5ec8f2"); P(66, 54, 10, 16, "#f78c6b"); P(82, 36, 10, 34, "#5ec8f2"); P(98, 28, 10, 42, "#7ee081"); P(114, 40, 10, 30, "#f78c6b"); }
  if (b.id === "production") { P(46, 40, 70, 30, "#2c2556"); P(46, 30, 70, 10, "#f2c14e"); for (let i = 0; i < 5; i++) P(50 + i * 14, 30, 6, 10, "#0d0820"); P(62, 48, 38, 16, "#0d0820"); P(76, 52, 8, 8, "#ff4fa3"); }
  return c;
}

function renderBiz() {
  const p = state.player;
  $("biz-grid").replaceChildren(...BUSINESSES.map((b) => {
    const own = p.businesses[b.id];
    const card = el("button", { type: "button", class: `biz-card ${b.status}`, style: `--c:${b.color}`, "aria-label": `${b.name}, ${b.status === "open" ? "open" : "coming soon"}` },
      own?.owned ? el("span", { class: "owned-badge" }, `OWNED · ${own.name}`) : null,
      b.status === "soon" ? (wart("icon-lock") ? el("img", { class: "lock img", src: wart("icon-lock"), alt: "" }) : el("span", { class: "lock", "aria-hidden": "true" }, "🔒")) : null,
      el("div", { class: "biz-art" }, wart(`card-${b.id}`) ? el("img", { src: wart(`card-${b.id}`), alt: "", draggable: "false" }) : bizArt(b)),
      el("div", { class: "biz-body" },
        el("span", { class: "brand2" }, b.brand.toUpperCase()),
        el("span", { class: "name" }, b.name),
        el("p", {}, b.blurb),
        el("div", { class: "biz-foot" }, el("span", { class: "muted" }, b.stat), el("span", { class: "go" }, b.status === "open" ? (own?.owned ? "Enter" : "Open") : "Coming soon"))));
    card.addEventListener("click", () => (b.status === "open" ? activate(card, b) : locked(card)));
    return card;
  }));
}

function burst(x, y, color, n = 28) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, d = 80 + Math.random() * 120;
    const s = el("span", { class: "burst", style: `left:${x}px;top:${y}px;background:${i % 3 ? color : "#fff"};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px` });
    document.body.append(s); setTimeout(() => s.remove(), 950);
  }
}
function activate(card, b) {
  if (card.classList.contains("activate")) return;
  card.classList.add("activate");
  const r = card.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, b.color, 36);
  setTimeout(() => burst(r.left + r.width / 2, r.top + r.height * 0.3, "#f2c14e", 20), 300);
  setTimeout(() => { card.classList.remove("activate"); show("park", false); openApp(b); }, 1000);
}
function locked(card) {
  card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
  const s = el("span", { class: "stampfx" }, "COMING SOON"); card.append(s); setTimeout(() => s.remove(), 1650);
}

function openApp(b) {
  const p = state.player, own = p.businesses[b.id];
  $("app-title").textContent = `${b.brand} · ${b.name}`;
  $("app-newtab").href = b.url;
  $("app-iframe").src = b.url;
  show("app-frame");
  stamp(b.id);
  if (!own?.owned) {
    p.businesses[b.id] = b.id === "create" ? { owned: true, name: `${p.agent.name} Studios`, credits: 1000, gamesShipped: 0, plays: 0 } : { owned: true, name: `${p.agent.name} FC`, credits: 1500, level: 1, points: 0, rank: null };
    quest("open-business");
    addActivity(`Opened ${p.businesses[b.id].name} (${b.brand})`);
  }
  commit();
}
$("app-back").addEventListener("click", () => { show("app-frame", false); $("app-iframe").src = "about:blank"; toast("Back in Kult World"); });

// ------------------------------------------------------------------ arcade
function renderGames() {
  $("game-grid").replaceChildren(...GAMES.map((gm) => {
    const src = wart(`thumb-${gm.id}`);
    let thumb;
    if (src) thumb = el("div", { class: "thumb" }, el("img", { src, alt: "", draggable: "false" }), gm.id === "wave" ? el("span", { class: "ribbon" }, "WAVE MODE") : null);
    else { thumb = el("canvas"); requestAnimationFrame(() => drawThumb(thumb, gm.id, gm.color)); }
    return el("button", { type: "button", class: "game-card", style: `--c:${gm.color}`, onclick: () => startMatch(gm) },
      thumb, el("div", { class: "gb" }, el("span", { class: "gg" }, gm.genre.toUpperCase()), el("span", { class: "gn" }, gm.name), el("p", {}, gm.blurb),
        el("div", { class: "gf" }, el("span", {}, gm.mode), el("span", {}, "Win ", el("b", { class: "ic arena" }, `${gm.reward} $ARENA`))), el("div", { class: "gf" }, el("span", {}, gm.players))));
  }));
}

let match = null;
const screenUI = () => $("screen-ui");
function setScreen(...kids) { screenUI().replaceChildren(...kids); }
setInterval(() => { $("monitor-clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }, 1000);

async function startMatch(gm) {
  const token = {}; match = token;
  const a = state.player.agent, me = { name: a.name, archetype: a.archetype, clan: a.clan, elo: a.elo, color: archetype(a.archetype).color };
  show("arcade-list", false); show("arcade-match");
  $("monitor-title").textContent = `KULT-OS · ${gm.name.toUpperCase()}`;
  $("game-canvas").hidden = true; show("match-skip", false); $("monitor-led").className = "led busy";
  const alive = () => match === token;

  // 1. Scanning for an opponent.
  const names = el("div", { class: "scan-names" });
  const radar = el("div", { class: "radar" });
  for (let i = 0; i < 5; i++) radar.append(el("span", { class: "blip", style: `left:${20 + Math.random() * 60}%;top:${20 + Math.random() * 60}%;animation-delay:${i * 0.2}s` }));
  setScreen(el("div", { class: "scan" }, radar, el("div", { class: "scan-t" }, "SCANNING FOR OPPONENT…"), el("div", { class: "scan-names" }, `ELO ${fmt(a.elo - 150)}–${fmt(a.elo + 150)} · ${gm.mode.toUpperCase()}`), names));
  const roll = setInterval(() => { names.textContent = `${randomName().toUpperCase()} · ${archetype(ARCHETYPES[Math.floor(Math.random() * 6)].id).name.toUpperCase()}`; }, 120);
  await wait(3200 + Math.random() * 1200);
  clearInterval(roll);
  if (!alive()) return;

  // 2. Opponent found: face-off.
  const them = { ...randomOpponent(a.elo) }; them.color = archetype(them.archetype).color;
  if (them.color === me.color) them.color = "#ff4fa3";
  const side = (x, cls) => el("div", { class: `vs-side ${cls}`, style: `--c:${x.color}` },
    portraitUrl(x.archetype) ? el("img", { class: "p", src: portraitUrl(x.archetype), alt: "" }) : null,
    el("div", { class: "vn" }, x.name.toUpperCase()),
    el("div", { class: "vm" }, el("img", { src: rankBadge(rankOf(x.elo)), alt: "" }), `${fmt(x.elo)} ELO · ${archetype(x.archetype).name}`));
  setScreen(el("div", {}, el("div", { class: "scan-t", style: "margin-bottom:3vmin;color:var(--gold)" }, "OPPONENT FOUND"), el("div", { class: "vs" }, side(me, "l"), el("div", { class: "vs-mid" }, "VS"), side(them, "r"))));
  await wait(2600);
  if (!alive()) return;

  // 3. Countdown.
  for (const n of ["3", "2", "1", "FIGHT!"]) { setScreen(el("div", { class: "count" }, n)); await wait(n === "FIGHT!" ? 650 : 750); if (!alive()) return; }

  // 4. The game, played by both agents.
  setScreen(); $("game-canvas").hidden = false; show("match-skip");
  const g = $("game-canvas").getContext("2d"); g.imageSmoothingEnabled = false;
  const game = createGame(gm.id, { me, them });
  let lt = performance.now(), skip = false;
  $("match-skip").onclick = () => { skip = true; };
  await new Promise((resolve) => {
    const frame = (now) => {
      if (!alive()) return resolve();
      const dt = Math.min(0.05, (now - lt) / 1000); lt = now;
      const steps = skip ? 60 : 1;
      for (let i = 0; i < steps && !game.done; i++) game.update(skip ? 1 / 20 : dt);
      game.draw(g);
      if (game.done) return resolve();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  if (!alive()) return;
  show("match-skip", false);
  await wait(700);

  // 5. Result: ELO (+150 win / -25 loss, as in AI Arena), $ARENA and KP.
  const win = game.winner === 0;
  const p = state.player;
  const dElo = win ? 150 : -25, dArena = win ? gm.reward : 5, dKp = win ? 40 : 10;
  const before = rankOf(p.agent.elo);
  p.agent.elo = Math.max(0, p.agent.elo + dElo);
  if (win) p.agent.wins += 1; else p.agent.losses += 1;
  p.balances.arena += dArena; p.balances.kp += dKp;
  gainXp(win ? 80 : 30);
  if (win) quest("arcade-win");
  addActivity(`${win ? "Won" : "Lost"} ${gm.name} vs ${them.name} (${dElo > 0 ? "+" : ""}${dElo} ELO)`);
  commit();
  const after = rankOf(p.agent.elo);
  $("game-canvas").hidden = true; $("monitor-led").className = "led";
  setScreen(el("div", { class: "result" },
    el("div", { class: `big ${win ? "win" : "lose"}` }, win ? "VICTORY" : "DEFEAT"),
    el("div", { class: "scan-names" }, `${me.name.toUpperCase()} VS ${them.name.toUpperCase()}`),
    el("div", { class: "rows" }, el("span", { class: "ic elo-ic", style: `color:${dElo > 0 ? "var(--green)" : "var(--red)"}` }, `${dElo > 0 ? "+" : ""}${dElo} ELO`), el("span", { class: "ic arena", style: "color:var(--pink)" }, `+${dArena} $ARENA`), el("span", { class: "ic kp", style: "color:var(--gold)" }, `+${dKp} KP`)),
    after.name !== before.name ? el("div", { class: "scan-t", style: `color:${after.color}` }, `RANK UP: ${after.name.toUpperCase()}`) : null,
    el("div", { class: "btns" }, el("button", { type: "button", class: "btn primary", onclick: () => startMatch(gm) }, "Rematch"), el("button", { type: "button", class: "btn", onclick: backToGames }, "Other games"))));
  if (win) burst(innerWidth / 2, innerHeight / 2, "#f2c14e", 40);
}
function backToGames() { match = null; show("arcade-match", false); show("arcade-list"); $("monitor-led").className = "led"; }
$("match-back").addEventListener("click", backToGames);
$("arcade-close").addEventListener("click", () => { match = null; show("arcade", false); });

// ------------------------------------------------------------------ boot
await loadArt();
if (new URLSearchParams(location.search).has("reset")) { resetPlayer(); state.player = null; }
// The landing sits over the living town; signed-in demo players skip it.
if (state.player && new URLSearchParams(location.search).has("continue")) enterWorld(false);
void MAP; void RANKS; void SW; void SH;
