// Kult World demo: landing, simulated sign-in, minting, the 3D city, the
// passport drawer and every place: the Business Park (four businesses), the
// Game Hub, the Deal Room and the Agentic Marketplace. All data is simulated
// (js/data.js); all text is English / 中文 (js/i18n.js).

import { World, BUILDINGS, MAP } from "./world3d.js";
import { randomStreetTile } from "./layout.js";
import { setSignTranslator } from "./models.js";
import { createGame, drawThumb } from "./minigames.js";
import { t, setLang, getLang, applyI18n, onLang } from "./i18n.js";
import { sound } from "./audio.js";
import { AgentViewer } from "./agentview.js";
import { createAgencies } from "./agencies.js";
import {
  CLANS, ARCHETYPES, archetype, TRAITS, rankOf, nextRank, BUSINESSES, GAMES, DEALS, DEAL_LINES, SERVICES,
  randomOpponent, randomName, wanderers, agentProfile, mintAgent, veteranPlayer, loadPlayer, savePlayer, resetPlayer
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
function toast(msg, kind = "") { sound.play(kind === "good" ? "pop" : kind === "bad" ? "error" : "pop"); const n = $("toast"); n.textContent = msg; n.className = `glass ${kind}`; n.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { n.hidden = true; }, 3400); }
const fmt = (n) => Number(n || 0).toLocaleString();
const pick = (o) => (o && typeof o === "object" ? o[getLang()] ?? o.en : o);
const ago = (iso) => { const s = Math.max(1, (Date.now() - Date.parse(iso)) / 1000); return s < 3600 ? t("ago.m", { n: Math.max(1, Math.round(s / 60)) }) : s < 86400 ? t("ago.h", { n: Math.round(s / 3600) }) : t("ago.d", { n: Math.round(s / 86400) }); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const placeName = (b) => t(`bld.${b.id}`);

// ------------------------------------------------------------------ state
const state = { player: migrate(loadPlayer()), returning: false, inWorld: false, manifest: null, urlOf: (f) => `art/${f}`, wart: null };
const world = new World($("world"));
if (new URLSearchParams(location.search).has("debug")) window.kw = { world, state, sound };
{ const q = { low: 0, medium: 1, high: 2 }[new URLSearchParams(location.search).get("quality")]; if (q !== undefined) { world.setQuality(q); world.qualityLocked = true; } }

// Older saved players get the new quests and businesses.
function migrate(p) {
  if (!p) return p;
  for (const q of [{ id: "close-deal", target: 1, progress: 0, reward: "150 KP" }, { id: "hire-agent", target: 1, progress: 0, reward: "100 KP" }]) if (!p.quests.some((x) => x.id === q.id)) p.quests.push(q);
  for (const b of BUSINESSES) p.businesses[b.id] ||= { owned: false };
  return p;
}

// ------------------------------------------------------------------ art
async function loadArt() {
  try {
    const m = await fetch(`art/manifest.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
    state.manifest = m;
    state.urlOf = (f) => `art/${f}${m.rev ? `?v=${m.rev}` : ""}`;
  } catch (e) { console.warn("[kult-world] art not loaded", e); }
  try { state.wart = await fetch(`art/world/manifest.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()); }
  catch (e) { console.warn("[kult-world] world art not loaded", e); }
}
const wart = (key) => { const f = state.wart?.files?.[key]; return f ? `art/${f.file}?v=${state.wart.rev}` : null; };
const portraitUrl = (arch) => { const m = state.manifest?.ceo?.[String(arch).toLowerCase()]; return m?.portrait ? state.urlOf(m.portrait) : null; };
const rankBadge = (r) => `art/${r.badge}`;
const portrait = (arch, cls = "") => (portraitUrl(arch) ? el("img", { class: cls, src: portraitUrl(arch), alt: "" }) : el("span", { class: `${cls} ph` }));

// ------------------------------------------------------------------ language
const signTr = (k, en) => t(k) || en;
applyI18n();
world.setTranslator(t);
setSignTranslator(signTr);
document.fonts?.ready.then(() => setSignTranslator(signTr));
$("lang-btn").addEventListener("click", () => setLang(getLang() === "en" ? "zh" : "en"));
onLang(() => {
  world.setTranslator(t); setSignTranslator(signTr);
  lastPlace = ""; lastPromptId = undefined;
  if (state.inWorld) { renderPassport(); renderQuests(); }
  if (!$("mint").hidden) renderMint();
  if (!$("park").hidden) renderBiz();
  if (!$("hub").hidden && !$("hub-list").hidden) renderGames();
  if (!$("deal").hidden && !$("deal-list").hidden) renderDeals();
  if (!$("market").hidden) renderMarket();
  closeAgentCard();
});

// ------------------------------------------------------------------ sound
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => sound.unlock(), { passive: true });
document.addEventListener("click", (e) => { if (e.target.closest("button, .door-prompt")) sound.play("click"); }, true);
const SPEAKER = '<path d="M4 9v6h4l5 4V5L8 9H4z" />', WAVES = '<path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />', CROSS = '<path d="M16 9l5 6M21 9l-5 6" />';
function renderSound() {
  const b = $("sound-btn"), m = sound.muted;
  b.querySelector("svg").innerHTML = SPEAKER + (m ? CROSS : WAVES);
  b.classList.toggle("muted", m); b.setAttribute("aria-pressed", String(!m)); b.title = t(m ? "sound.on" : "sound.off");
}
$("sound-btn").addEventListener("click", () => { sound.unlock(); sound.toggle(); });
sound.onChange(renderSound); renderSound();
// A coloured flash as you step through a door.
function flash(color) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const f = el("div", { class: "flash", style: `--c:${color}` }); document.body.append(f); setTimeout(() => f.remove(), 700);
}

// ------------------------------------------------------------------ loop
function resize() { world.resize(innerWidth, innerHeight, Math.min(1.5, devicePixelRatio || 1)); }
addEventListener("resize", resize);
resize();
let last = performance.now(), slowAt = 0, frames = 0;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  world.update(dt); world.draw();
  if (state.inWorld) {
    world.autoQuality(dt);
    const p = world.player;
    sound.update(world.t, { walking: p?.walking, fountainDist: p && world.fountainPos ? p.group.position.distanceTo(world.fountainPos) : 99 });
  }
  if (++frames === 3) $("boot").classList.add("done");
  if (state.inWorld && now - slowAt > 100) { slowAt = now; updateLocation(); updatePrompt(); world.minimap($("minimap")); }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
world.init().then(() => {
  for (const w of wanderers(16)) { const [x, y] = randomStreetTile(); world.addAgent(w.id, { ...w, elo: 900 + Math.floor(Math.random() * 2600), x: x + 0.5, y: y + 0.5 }); }
});

// ------------------------------------------------------------------ pointer
const canvas = $("world");
canvas.addEventListener("pointermove", (e) => {
  if (!state.inWorld) return;
  const b = world.buildingAt(e.clientX, e.clientY), a = b ? null : world.agentAt(e.clientX, e.clientY);
  world.hover = b?.id || null;
  canvas.style.cursor = b || a ? "pointer" : "default";
  const tip = $("world-tip");
  if (b) { tip.replaceChildren(placeName(b), el("small", {}, `${t(`blurb.${b.id}`)} · ${t("tip.enter")}`)); tip.style.setProperty("--c", b.color); }
  else if (a) { tip.replaceChildren(a.name, el("small", {}, `${archetype(a.archetype).name} · ${t("agent.elo", { n: fmt(a.elo) })}`)); tip.style.setProperty("--c", a.color); }
  if (b || a) { tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`; tip.hidden = false; } else tip.hidden = true;
});
canvas.addEventListener("pointerleave", () => { world.hover = null; $("world-tip").hidden = true; });
canvas.addEventListener("click", (e) => {
  if (!state.inWorld) return;
  closeAgentCard();
  const b = world.buildingAt(e.clientX, e.clientY);
  if (b) return goTo(b.id);
  const a = world.agentAt(e.clientX, e.clientY);
  if (a) return showAgentCard(a);
  world.walkToScreen(e.clientX, e.clientY);
});
canvas.addEventListener("wheel", (e) => { e.preventDefault(); world.zoomBy(e.deltaY > 0 ? 0.9 : 1.1); }, { passive: false });
$("minimap").addEventListener("click", (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  world.walkToTile(...world.minimapToTile((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height));
});

let lastPlace = "", walkingLabel = false;
function goTo(id, then) {
  const b = BUILDINGS.find((x) => x.id === id);
  if (!b) return;
  $("location-text").textContent = t("walking", { place: placeName(b) }); walkingLabel = true; lastPlace = "";
  world.walkToBuilding(id, () => { walkingLabel = false; openPlace(b, then); });
}
function updateLocation() {
  const p = world.player;
  if (!p) return;
  const district = t(`district.${world.districtAt(p.x, p.y)}`);
  $("mm-district").textContent = district;
  if (p.walking && walkingLabel) return;
  walkingLabel = false;
  const near = world.nearDoor(2.6), place = near ? placeName(near) : district;
  if (place !== lastPlace) { lastPlace = place; $("location-text").textContent = place; }
}
// "Enter" prompt floating over the door the player is standing at.
let lastPromptId;
const anyOpen = () => [...document.querySelectorAll(".overlay, .app-frame")].some((o) => !o.hidden);
function updatePrompt() {
  const b = anyOpen() ? null : world.nearDoor(2.2);
  if ((b?.id || null) === lastPromptId) return;
  lastPromptId = b?.id || null;
  world.showPrompt(b, b ? `<b>${placeName(b)}</b><span><kbd>E</kbd>${t("prompt.enter")}</span>` : "");
}
document.addEventListener("click", (e) => { if (e.target.closest(".door-prompt")) { const b = world.nearDoor(2.2); if (b) openPlace(b); } });

// ------------------------------------------------------------------ landing & sign-in
const stats = { online: 12480, deals: 3912, battles: 48205 };
setInterval(() => {
  stats.online += Math.round((Math.random() - 0.45) * 20); stats.deals += Math.random() < 0.5 ? 1 : 0; stats.battles += Math.floor(Math.random() * 4);
  $("st-online").textContent = fmt(stats.online); $("st-deals").textContent = fmt(stats.deals); $("st-battles").textContent = fmt(stats.battles);
}, 1200);
$("enter-btn").addEventListener("click", () => {
  state.returning = false;
  if (state.player) return enterWorld(false);
  showLogin();
});
$("returning-btn").addEventListener("click", () => { state.returning = true; showLogin(); });
function showLogin() { show("login-status", false); show("login"); }
for (const b of document.querySelectorAll(".login-opt")) b.addEventListener("click", async () => {
  const st = $("login-status");
  st.textContent = t("login.connecting", { method: b.dataset.method }); st.hidden = false;
  for (const x of document.querySelectorAll(".login-opt")) x.disabled = true;
  await wait(900);
  st.textContent = t("login.checking");
  await wait(700);
  for (const x of document.querySelectorAll(".login-opt")) x.disabled = false;
  show("login", false);
  if (state.returning) { state.player = migrate(veteranPlayer()); savePlayer(state.player); return enterWorld(false); }
  if (state.player) return enterWorld(false);
  openMint();
});
for (const b of document.querySelectorAll("[data-close]")) b.addEventListener("click", () => { sound.play("close"); show(b.dataset.close, false); if (b.dataset.close === "deal") negotiation = null; });

// ------------------------------------------------------------------ mint
const mintSel = { clan: "ZEROG", archetype: "support" };
function openMint() {
  $("mint-name").value = `kult-player_${Math.random().toString(16).slice(2, 10)}`;
  $("mint-story").value = t("mint.storyDefault");
  renderMint();
  show("mint");
}
function renderMint() {
  const a = archetype(mintSel.archetype);
  const rgb = [1, 3, 5].map((i) => parseInt(a.color.slice(i, i + 2), 16)).join(",");
  const sel = $("mint-selected");
  sel.style.setProperty("--a-rgb", rgb); sel.style.setProperty("--ac", a.color);
  sel.replaceChildren(portrait(a.id),
    el("div", {}, el("span", { class: "sel-k" }, t("mint.selected")), el("div", { class: "sel-name" }, a.name.toUpperCase()), el("div", { class: "sel-tag" }, a.tagline), el("div", { class: "role-chips" }, a.role.map((r) => el("span", {}, r)))));
  $("mint-clans").replaceChildren(...CLANS.map((c) => el("button", { type: "button", style: `--c:${c.color}`, "aria-pressed": mintSel.clan === c.id ? "true" : "false", onclick: () => { mintSel.clan = c.id; renderMint(); } }, el("i"), c.name)));
  $("mint-archetypes").replaceChildren(...ARCHETYPES.map((x) => el("button", { type: "button", style: `--c:${x.color}`, "aria-pressed": mintSel.archetype === x.id ? "true" : "false", onclick: () => { mintSel.archetype = x.id; renderMint(); } }, portrait(x.id), x.name.toUpperCase())));
}
$("mint-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("mint-name").value.trim() || randomName();
  show("mint", false);
  $("minting-portrait").replaceChildren(portrait(mintSel.archetype));
  const list = $("minting-steps");
  list.replaceChildren(...["mint.s1", "mint.s2", "mint.s3", "mint.s4", "mint.s5"].map((k) => el("li", {}, el("span", { class: "s" }), t(k))));
  show("minting");
  for (const li of list.children) { li.className = "run"; sound.play("beep"); await wait(650 + Math.random() * 350); li.className = "ok"; }
  await wait(300);
  show("minting", false);
  state.player = migrate(mintAgent({ name, archetype: mintSel.archetype, clan: mintSel.clan, backstory: $("mint-story").value.trim(), username: "kultplayer" }));
  savePlayer(state.player);
  enterWorld(true);
});

// ------------------------------------------------------------------ the world
let feedTimer = null;
function enterWorld(fresh) {
  for (const id of ["landing", "login", "mint", "minting"]) show(id, false);
  for (const id of ["passport", "topbar", "hint", "dock", "minimap-wrap", "feed"]) show(id, true);
  state.inWorld = true;
  const a = state.player.agent;
  world.spawnPlayer({ name: a.name, archetype: a.archetype, clan: a.clan, elo: a.elo });
  sound.play("spawn");
  renderPassport(); renderQuests();
  setTimeout(() => toast(t(fresh ? "toast.spawned" : "toast.welcome", { name: a.name }), "good"), 900);
  setTimeout(() => show("hint", false), 14000);
  clearInterval(feedTimer); feedTimer = setInterval(feedEvent, 6500); setTimeout(feedEvent, 2500);
}

// ------------------------------------------------------------------ passport drawer
const STAMPS = [["park", "PARK", "#ffc94d"], ["hub", "HUB", "#ff4fa3"], ["create", "CREATE", "#ff7eb6"], ["sports", "SPORTS", "#3ddc84"], ["deal", "DEAL", "#ffd27a"], ["market", "MARKET", "#4fd8ff"], ["dex", "DEX", "#5ec8f2"], ["production", "FILM", "#ffc94d"]];
const STAMP_ART = { hub: "arcade" };
function renderPassport() {
  const p = state.player, a = p.agent, arch = archetype(a.archetype), clan = CLANS.find((c) => c.id === a.clan);
  const r = rankOf(a.elo), nr = nextRank(a.elo), games = a.wins + a.losses;
  if (p.passport.stamps.includes("arcade") && !p.passport.stamps.includes("hub")) p.passport.stamps.push("hub");
  setBalance("bal-arena", p.balances.arena); setBalance("bal-kp", p.balances.kp);
  $("hp-name").textContent = a.name; $("hp-level").textContent = p.passport.level;
  $("hp-rank").textContent = r.name; $("hp-elo").textContent = t("agent.elo", { n: fmt(a.elo) }); $("hp-badge").src = rankBadge(r);
  $("hp-xp").style.width = `${Math.round((p.passport.xp / p.passport.xpToNext) * 100)}%`;
  if (portraitUrl(a.archetype)) $("hp-img").src = portraitUrl(a.archetype);
  $("hud-player").style.setProperty("--ac", arch.color);
  $("hud-player").title = t("passport");
  const section = (title, small, ...kids) => el("section", { class: "pp-section" }, el("h3", {}, title, small ? el("small", {}, small) : null), ...kids);
  $("passport-body").replaceChildren(
    el("div", { class: "pp-card" },
      el("div", { class: "pp-head" }, el("span", { class: "t" }, t("pp.title")), el("span", { class: "seal", title: r.name }, el("img", { src: rankBadge(r), alt: "" }))),
      el("div", { class: "pp-id" }, p.passport.id),
      el("dl", { class: "pp-rows" },
        el("dt", {}, t("pp.citizen")), el("dd", {}, p.passport.username),
        el("dt", {}, t("pp.wallet")), el("dd", {}, p.passport.wallet),
        el("dt", {}, t("pp.since")), el("dd", {}, new Date(p.passport.citizenSince).toLocaleDateString(getLang() === "zh" ? "zh-CN" : undefined))),
      el("div", { class: "pp-level" }, el("span", { class: "lv ic xp" }, t("pp.level", { n: p.passport.level })), el("span", { class: "muted" }, `${fmt(p.passport.xp)} / ${fmt(p.passport.xpToNext)} XP`)),
      el("div", { class: "bar" }, el("i", { style: `width:${Math.round((p.passport.xp / p.passport.xpToNext) * 100)}%` })),
      el("div", { class: "stamps", title: t("pp.visited") }, STAMPS.map(([id, label, c]) => {
        const on = p.passport.stamps.includes(id), img = wart(`stamp-${STAMP_ART[id] || id}`);
        return el("span", { class: `stamp${on ? " on" : ""}`, style: `--c:${c}`, title: `${label}${on ? "" : ` (${t("pp.notVisited")})`}` }, img ? el("img", { src: img, alt: label }) : label);
      }))),
    section(t("pp.identity"), `INFT #${a.inft}`,
      el("div", { class: "agent-row" }, portrait(a.archetype),
        el("div", {}, el("div", { class: "n" }, a.name), el("div", { class: "tags" },
          el("span", { class: "tag", style: `color:${arch.color}` }, arch.name.toUpperCase()),
          el("span", { class: "tag", style: `color:${clan?.color}` }, clan?.name.toUpperCase()),
          el("span", { class: "tag", style: "color:var(--muted)" }, a.evolution)))),
      el("div", { class: "rank-row" },
        el("img", { src: rankBadge(r), alt: "" }),
        el("div", {}, el("div", { class: "rn", style: `color:${r.color}` }, r.name.toUpperCase()), el("div", { class: "bar" }, el("i", { style: `--c:${r.color};width:${nr ? Math.round(((a.elo - r.min) / (nr.min - r.min)) * 100) : 100}%` })), el("div", { class: "muted tiny", style: "margin-top:3px" }, nr ? t("pp.toRank", { n: fmt(nr.min - a.elo), rank: nr.name }) : t("pp.topRank"))),
        el("span", { class: "elo ic elo-ic", title: "ELO" }, fmt(a.elo))),
      el("div", { class: "wl" },
        el("div", {}, el("b", { style: "color:var(--green)" }, a.wins), el("span", {}, t("pp.wins"))),
        el("div", {}, el("b", { style: "color:var(--red)" }, a.losses), el("span", {}, t("pp.losses"))),
        el("div", {}, el("b", {}, games ? `${Math.round((a.wins / games) * 100)}%` : "—"), el("span", {}, t("pp.winrate"))))),
    section(t("pp.traits"), arch.role.join(" · "),
      el("div", { class: "traits" }, TRAITS.map((tr) => el("div", { class: "trait" }, el("span", {}, t(`trait.${tr}`)), el("div", { class: "bar" }, el("i", { style: `--c:${arch.color};width:${a.traits[tr]}%` })), el("b", {}, a.traits[tr]))))),
    section(t("pp.balances"), null,
      el("div", { class: "bal-grid" },
        el("div", { class: "bal arena", style: "--c:var(--pink)" }, el("b", {}, fmt(p.balances.arena)), el("span", {}, "$ARENA")),
        el("div", { class: "bal kp", style: "--c:var(--gold)" }, el("b", {}, fmt(p.balances.kp)), el("span", {}, t("pp.kp"))),
        el("div", { class: "bal kult", style: "--c:var(--blue)" }, el("b", {}, fmt(p.balances.kult)), el("span", {}, "KULT")))),
    section(t("pp.businesses"), t("pp.owned", { n: Object.values(p.businesses).filter((b) => b.owned).length }),
      el("div", { class: "biz-list" }, BUSINESSES.map((b) => {
        const own = p.businesses[b.id];
        const sub = own?.owned ? (b.id === "create" ? `${own.name} · ${own.gamesShipped} games · ${fmt(own.credits)} credits` : `${own.name} · Lv ${own.level} · ${own.points} pts${own.rank ? ` · #${own.rank}` : ""}`) : t(b.status === "open" ? "biz.openIt" : "biz.soonSub", { brand: b.brand });
        return el("div", { class: "biz-row", style: `--c:${b.color}` }, el("span", { class: "dot" }), el("div", { style: "min-width:0" }, el("div", { class: "bn" }, t(`biz.${b.id}.name`)), el("div", { class: "bs" }, sub)),
          el("span", { class: `st ${own?.owned ? "own" : b.status}` }, t(own?.owned ? "st.owned" : b.status === "open" ? "st.open" : "st.soon")));
      }))),
    section(t("pp.quests"), null, p.quests.map((q) => el("div", { class: `quest${q.progress >= q.target ? " done" : ""}` },
      el("div", { class: "qh" }, el("span", { class: "ic ic-quest" }, t(`quest.${q.id}`)), el("span", { class: "qr" }, q.reward)),
      el("div", { class: "bar" }, el("i", { style: `--c:var(--green);width:${Math.round((Math.min(q.progress, q.target) / q.target) * 100)}%` })),
      el("span", { class: "muted tiny" }, `${Math.min(q.progress, q.target)} / ${q.target}`)))),
    section(t("pp.activity"), null, el("ul", { class: "activity" }, p.activity.slice(0, 6).map((x) => el("li", {}, x.text, el("time", {}, ago(x.at)))))));
}
// Gamified quest tracker (under the balances): the next open quests.
function renderQuests() {
  const qs = state.player.quests.filter((q) => q.progress < q.target).slice(0, 3);
  $("quest-tracker").hidden = !state.inWorld || !qs.length;
  $("quest-tracker").replaceChildren(el("div", { class: "qt-head" }, el("span", { class: "ic ic-quest" }, t("quest.tracker")), el("b", {}, `${state.player.quests.filter((q) => q.progress >= q.target).length}/${state.player.quests.length}`)),
    ...qs.map((q) => el("div", { class: "qt-row" }, el("span", {}, t(`quest.${q.id}`)), el("small", {}, `${q.progress}/${q.target} · +${q.reward}`), el("div", { class: "bar" }, el("i", { style: `--c:var(--gold);width:${Math.round((q.progress / q.target) * 100)}%` })))));
}
function setBalance(id, v) {
  const n = $(id), old = n.dataset.v;
  n.textContent = fmt(v); n.dataset.v = v;
  if (old !== undefined && Number(old) !== v) { const pill = n.closest(".pill"); pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }
}
function addActivity(text) { state.player.activity.unshift({ at: new Date().toISOString(), text }); state.player.activity = state.player.activity.slice(0, 20); }
function stamp(id) { const s = state.player.passport.stamps; if (!s.includes(id)) { s.push(id); gainXp(60); } }
function quest(id, by = 1) {
  const q = state.player.quests.find((x) => x.id === id);
  if (!q || q.progress >= q.target) return;
  q.progress += by;
  if (q.progress >= q.target) {
    const [n, cur] = q.reward.split(" "), b = state.player.balances;
    if (cur === "KP") b.kp += Number(n); else b.arena += Number(n);
    toast(t("toast.quest", { title: t(`quest.${q.id}`), reward: q.reward }), "good"); sound.play("quest");
    burst(innerWidth - 170, 150, "#ffc94d", 24);
  }
}
function gainXp(n) { const pp = state.player.passport; pp.xp += n; while (pp.xp >= pp.xpToNext) { pp.xp -= pp.xpToNext; pp.level += 1; pp.xpToNext = Math.round(pp.xpToNext * 1.35); toast(t("toast.level", { n: pp.level }), "good"); sound.play("level"); } }
function commit() { savePlayer(state.player); renderPassport(); renderQuests(); }

function togglePassport(force) { const o = $("passport").classList.toggle("open", force); $("passport-toggle").setAttribute("aria-expanded", String(o)); }
$("passport-toggle").addEventListener("click", () => togglePassport());
$("hud-player").addEventListener("click", () => togglePassport());
for (const b of document.querySelectorAll("[data-act]")) b.addEventListener("click", () => { if (b.dataset.act === "passport") togglePassport(); else world.recenter(); });
$("menu-btn").addEventListener("click", () => show("menu", $("menu").hidden));
for (const b of document.querySelectorAll("[data-goto]")) b.addEventListener("click", () => { show("menu", false); goTo(b.dataset.goto); });
$("reset-demo").addEventListener("click", () => { resetPlayer(); location.href = location.pathname; });
addEventListener("keydown", (e) => {
  if (!state.inWorld || e.target.closest("input, textarea")) return;
  if (e.key === "Escape") { if (anyOpen()) closeOverlays(); else { togglePassport(false); closeAgentCard(); } return; }
  if (anyOpen()) return;
  const k = e.key.toLowerCase();
  const go = { 1: "park", 2: "hub", 3: "deal", 4: "market" }[k];
  if (go) goTo(go); else if (k === "p") togglePassport(); else if (k === "c") world.recenter();
  else if (k === "e") { const b = world.nearDoor(2.2); if (b) openPlace(b); }
});
function closeOverlays() { sound.play("close"); match = null; negotiation = null; agencies.stopPoll(); show("agency-room", false); show("market-home"); for (const id of ["park", "hub", "deal", "market", "login"]) show(id, false); }

// ------------------------------------------------------------------ places
function openPlace(b, then) {
  closeAgentCard();
  sound.play("open"); flash(b.color);
  if (b.kind === "biz" || b.kind === "park") { renderBiz(b.kind === "biz" ? b.id : null); show("park"); stamp("park"); quest("visit-park"); }
  if (b.kind === "hub") { renderGames(); show("hub-list"); show("hub-match", false); show("hub"); stamp("hub"); if (then?.challenge) startMatch(GAMES[Math.floor(Math.random() * 2)], then.challenge); }
  if (b.kind === "deal") { renderDeals(); show("deal-list"); show("deal-room", false); show("deal"); stamp("deal"); }
  if (b.kind === "market") { renderMarket(); show("market"); stamp("market"); }
  commit();
}

// ------------------------------------------------------------------ business park
function bizArt(b) { const c = el("canvas", { width: 160, height: 90 }), g = c.getContext("2d"); g.fillStyle = b.color; g.globalAlpha = 0.25; g.fillRect(40, 20, 80, 50); return c; }
function renderBiz(focus = null) {
  const p = state.player;
  $("biz-grid").replaceChildren(...BUSINESSES.map((b) => {
    const own = p.businesses[b.id];
    const card = el("button", { type: "button", class: `biz-card ${b.status}${focus === b.id ? " focus" : ""}`, style: `--c:${b.color}`, "aria-label": t(`biz.${b.id}.name`) },
      own?.owned ? el("span", { class: "owned-badge" }, t("biz.ownedBadge", { name: own.name })) : null,
      b.status === "soon" ? el("span", { class: "lock", "aria-hidden": "true" }, "🔒") : null,
      el("div", { class: "biz-art" }, wart(`card-${b.id}`) ? el("img", { src: wart(`card-${b.id}`), alt: "", draggable: "false" }) : bizArt(b)),
      el("div", { class: "biz-body" },
        el("span", { class: "brand2" }, b.brand.toUpperCase()),
        el("span", { class: "name" }, t(`biz.${b.id}.name`)),
        el("p", {}, t(`biz.${b.id}.blurb`)),
        el("div", { class: "biz-foot" }, el("span", { class: "muted" }, b.status === "open" ? t(`biz.${b.id}.stat`) : t("biz.soon")), el("span", { class: "go" }, b.status === "open" ? t(own?.owned ? "biz.enter" : "biz.open") : t("biz.soon")))));
    card.addEventListener("click", () => (b.status === "open" ? activate(card, b) : locked(card)));
    if (focus === b.id && b.status === "soon") setTimeout(() => locked(card), 500);
    return card;
  }));
}
function burst(x, y, color, n = 28) {
  sound.play("coin");
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, d = 80 + Math.random() * 120;
    const s = el("span", { class: "burst", style: `left:${x}px;top:${y}px;color:${i % 3 ? color : "#fff"};background:currentColor;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px` });
    document.body.append(s); setTimeout(() => s.remove(), 950);
  }
}
function activate(card, b) {
  if (card.classList.contains("activate")) return;
  sound.play("whoosh");
  card.classList.add("activate");
  const r = card.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, b.color, 36);
  setTimeout(() => burst(r.left + r.width / 2, r.top + r.height * 0.3, "#ffc94d", 20), 300);
  setTimeout(() => { card.classList.remove("activate"); show("park", false); openApp(b); }, 1000);
}
function locked(card) {
  sound.play("error");
  card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
  const s = el("span", { class: "stampfx" }, t("biz.comingStamp")); card.append(s); setTimeout(() => s.remove(), 1650);
}
function openApp(b) {
  const p = state.player, own = p.businesses[b.id];
  $("app-title").textContent = `${b.brand} · ${t(`biz.${b.id}.name`)}`;
  $("app-newtab").href = b.url;
  $("app-iframe").src = b.url;
  show("app-frame");
  stamp(b.id);
  if (!own?.owned) {
    p.businesses[b.id] = b.id === "create" ? { owned: true, name: `${p.agent.name} Studios`, credits: 1000, gamesShipped: 0, plays: 0 } : { owned: true, name: `${p.agent.name} FC`, credits: 1500, level: 1, points: 0, rank: null };
    quest("open-business");
    addActivity(t("act.opened", { name: p.businesses[b.id].name, brand: b.brand }));
  }
  commit();
}
$("app-back").addEventListener("click", () => { show("app-frame", false); $("app-iframe").src = "about:blank"; toast(t("toast.back")); });

// ------------------------------------------------------------------ game hub
function renderGames() {
  $("game-grid").replaceChildren(...GAMES.map((gm) => {
    const src = wart(`thumb-${gm.id}`);
    let thumb;
    if (src) thumb = el("div", { class: "thumb" }, el("img", { src, alt: "", draggable: "false" }), gm.id === "wave" ? el("span", { class: "ribbon" }, t("hub.wave")) : null);
    else { thumb = el("canvas"); requestAnimationFrame(() => drawThumb(thumb, gm.id, gm.color)); }
    return el("button", { type: "button", class: "game-card", style: `--c:${gm.color}`, onclick: () => startMatch(gm) },
      thumb, el("div", { class: "gb" }, el("span", { class: "gg" }, t(`game.${gm.id}.genre`).toUpperCase()), el("span", { class: "gn" }, gm.name), el("p", {}, t(`game.${gm.id}.blurb`)),
        el("div", { class: "gf" }, el("span", {}, t(`game.${gm.id}.mode`)), el("span", {}, `${t("hub.win")} `, el("b", { class: "ic arena" }, `${gm.reward} $ARENA`))), el("div", { class: "gf" }, el("span", { class: "live-dot" }, t(`game.${gm.id}.players`)))));
  }));
}
let match = null;
function setScreen(...kids) { $("screen-ui").replaceChildren(...kids); }
setInterval(() => { $("monitor-clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }, 1000);

async function startMatch(gm, forced = null) {
  const token = {}; match = token;
  const a = state.player.agent, me = { name: a.name, archetype: a.archetype, clan: a.clan, elo: a.elo, color: archetype(a.archetype).color };
  show("hub-list", false); show("hub-match");
  $("monitor-title").textContent = `KULT-OS · ${gm.name.toUpperCase()}`;
  $("game-canvas").hidden = true; show("match-skip", false); $("monitor-led").className = "led busy";
  const alive = () => match === token;
  const names = el("div", { class: "scan-names" }), radar = el("div", { class: "radar" });
  for (let i = 0; i < 5; i++) radar.append(el("span", { class: "blip", style: `left:${20 + Math.random() * 60}%;top:${20 + Math.random() * 60}%;animation-delay:${i * 0.2}s` }));
  setScreen(el("div", { class: "scan" }, radar, el("div", { class: "scan-t" }, t("match.scanning")), el("div", { class: "scan-names" }, `ELO ${fmt(a.elo - 150)}–${fmt(a.elo + 150)} · ${t(`game.${gm.id}.mode`).toUpperCase()}`), names));
  const roll = setInterval(() => { names.textContent = `${randomName().toUpperCase()} · ${ARCHETYPES[Math.floor(Math.random() * 6)].name.toUpperCase()}`; }, 120);
  await wait(forced ? 1400 : 3200 + Math.random() * 1200);
  clearInterval(roll);
  if (!alive()) return;
  const them = forced ? { name: forced.name, archetype: forced.archetype, clan: forced.clan, elo: forced.elo } : { ...randomOpponent(a.elo) };
  them.color = archetype(them.archetype).color; if (them.color === me.color) them.color = "#ff4fa3";
  const side = (x, cls) => el("div", { class: `vs-side ${cls}`, style: `--c:${x.color}` }, portrait(x.archetype, "p"), el("div", { class: "vn" }, x.name.toUpperCase()), el("div", { class: "vm" }, el("img", { src: rankBadge(rankOf(x.elo)), alt: "" }), `${fmt(x.elo)} ELO · ${archetype(x.archetype).name}`));
  setScreen(el("div", {}, el("div", { class: "scan-t", style: "margin-bottom:3vmin;color:var(--gold)" }, t("match.found")), el("div", { class: "vs" }, side(me, "l"), el("div", { class: "vs-mid" }, "VS"), side(them, "r"))));
  await wait(2600);
  if (!alive()) return;
  for (const n of ["3", "2", "1", t("match.fight")]) { setScreen(el("div", { class: "count" }, n)); sound.play(n.length > 1 ? "go" : "beep"); await wait(n.length > 1 ? 650 : 750); if (!alive()) return; }
  setScreen(); $("game-canvas").hidden = false; show("match-skip");
  const g = $("game-canvas").getContext("2d"); g.imageSmoothingEnabled = false;
  const game = createGame(gm.id, { me, them });
  let lt = performance.now(), skip = false;
  $("match-skip").onclick = () => { skip = true; };
  await new Promise((resolve) => {
    const frame = (now) => {
      if (!alive()) return resolve();
      const dt = Math.min(0.05, (now - lt) / 1000); lt = now;
      for (let i = 0; i < (skip ? 60 : 1) && !game.done; i++) game.update(skip ? 1 / 20 : dt);
      game.draw(g);
      if (game.done) return resolve();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  if (!alive()) return;
  show("match-skip", false);
  await wait(700);
  const win = game.winner === 0, p = state.player;
  const dElo = win ? 150 : -25, dArena = win ? gm.reward : 5, dKp = win ? 40 : 10, before = rankOf(p.agent.elo);
  p.agent.elo = Math.max(0, p.agent.elo + dElo);
  if (win) p.agent.wins += 1; else p.agent.losses += 1;
  p.balances.arena += dArena; p.balances.kp += dKp;
  gainXp(win ? 80 : 30);
  if (win) quest("arcade-win");
  addActivity(t("act.match", { result: t(win ? "act.won" : "act.lost"), game: gm.name, name: them.name, elo: `${dElo > 0 ? "+" : ""}${dElo}` }));
  commit();
  const after = rankOf(p.agent.elo);
  sound.play(win ? "win" : "lose");
  $("game-canvas").hidden = true; $("monitor-led").className = "led";
  setScreen(el("div", { class: "result" },
    el("div", { class: `big ${win ? "win" : "lose"}` }, t(win ? "match.victory" : "match.defeat")),
    el("div", { class: "scan-names" }, `${me.name.toUpperCase()} VS ${them.name.toUpperCase()}`),
    el("div", { class: "rows" }, el("span", { class: "ic elo-ic", style: `color:${dElo > 0 ? "var(--green)" : "var(--red)"}` }, `${dElo > 0 ? "+" : ""}${dElo} ELO`), el("span", { class: "ic arena", style: "color:var(--pink)" }, `+${dArena} $ARENA`), el("span", { class: "ic kp", style: "color:var(--gold)" }, `+${dKp} KP`)),
    after.name !== before.name ? el("div", { class: "scan-t", style: `color:${after.color}` }, t("match.rankup", { rank: after.name.toUpperCase() })) : null,
    el("div", { class: "btns" }, el("button", { type: "button", class: "btn primary", onclick: () => startMatch(gm) }, t("match.rematch")), el("button", { type: "button", class: "btn", onclick: backToGames }, t("match.other")))));
  if (win) burst(innerWidth / 2, innerHeight / 2, "#ffc94d", 40);
}
function backToGames() { match = null; show("hub-match", false); show("hub-list"); renderGames(); $("monitor-led").className = "led"; }
$("match-back").addEventListener("click", backToGames);
$("hub-close").addEventListener("click", () => { sound.play("close"); match = null; show("hub", false); });

// ------------------------------------------------------------------ deal room
let negotiation = null;
const KIND_COLOR = { otc: "#4fd8ff", sponsor: "#7ef0a6", partner: "#ff7eb6", license: "#ffc94d" };
function renderDeals() {
  $("deal-grid").replaceChildren(...DEALS.map((d) => el("div", { class: "deal-card", style: `--c:${KIND_COLOR[d.kind]}` },
    el("div", { class: "dc-top" }, el("span", { class: "kind" }, t(`deal.kind.${d.kind}`)), el("span", { class: "muted tiny" }, t("deal.expires", { n: d.mins }))),
    el("div", { class: "dc-title" }, pick(d.title)),
    el("div", { class: "dc-who" }, portrait(d.archetype), el("div", {}, el("b", {}, d.who), el("small", {}, `${archetype(d.archetype).name} · ${t("deal.trust")} ${d.trust}%`))),
    el("div", { class: "dc-foot" }, el("div", {}, el("small", {}, t("deal.ask")), el("b", { class: "ic arena" }, fmt(d.ask))), el("button", { type: "button", class: "btn gold small", onclick: () => negotiate(d) }, t("deal.negotiate"))))));
}
async function negotiate(d) {
  const token = {}; negotiation = token;
  const alive = () => negotiation === token;
  const me = state.player.agent, room = $("deal-room");
  show("deal-list", false); show("deal-room");
  const log = el("div", { class: "chat" }), meter = el("i"), priceTag = el("b", {}, "—");
  room.replaceChildren(
    el("button", { type: "button", class: "btn ghost small", onclick: () => { negotiation = null; show("deal-room", false); show("deal-list"); } }, `‹ ${t("deal.again")}`),
    el("div", { class: "dr-head" },
      el("div", { class: "dr-party" }, portrait(me.archetype), el("div", {}, el("small", {}, t("deal.you")), el("b", {}, me.name))),
      el("div", { class: "dr-mid" }, el("span", { class: "kind", style: `--c:${KIND_COLOR[d.kind]}` }, t(`deal.kind.${d.kind}`)), el("div", { class: "dr-title" }, pick(d.title)), el("div", { class: "dr-meter" }, meter), el("div", { class: "dr-price" }, el("small", {}, t("deal.ask")), ` ${fmt(d.ask)} · `, priceTag)),
      el("div", { class: "dr-party r" }, el("div", {}, el("small", {}, t("deal.counterparty")), el("b", {}, d.who)), portrait(d.archetype))),
    log);
  const say = async (who, key, price, delay = 900) => {
    const typing = el("div", { class: `msg ${who} typing` }, el("span"), el("span"), el("span"));
    log.append(typing); log.scrollTop = log.scrollHeight;
    await wait(delay); typing.remove();
    if (!alive()) return false;
    sound.play("type");
    log.append(el("div", { class: `msg ${who}` }, el("small", {}, who === "me" ? me.name : d.who), pick(DEAL_LINES[key]).split("{price}").join(fmt(price))));
    log.scrollTop = log.scrollHeight;
    priceTag.textContent = `${fmt(price)} $ARENA`; meter.style.width = `${Math.min(100, Math.round((price / d.ask) * 100))}%`;
    return true;
  };
  const bonus = { tactician: 0.12, support: 0.06, hybrid: 0.04 }[me.archetype] || 0, p = 0.4 + d.trust / 400 + bonus;
  const offer = Math.round(d.ask * 0.68), counter = Math.round(d.ask * 0.93), push = Math.round(d.ask * 0.8);
  if (!(await say("me", "open", offer, 700))) return;
  if (!(await say("them", "counter", counter, 1300))) return;
  if (!(await say("me", "push", push))) return;
  let final = null;
  if (Math.random() < p) { if (!(await say("them", "accept", push, 1400))) return; final = push; }
  else {
    const c2 = Math.round(d.ask * 0.88), m2 = Math.round(d.ask * 0.85);
    if (!(await say("them", "counter", c2, 1400))) return;
    if (!(await say("me", "push", m2))) return;
    if (Math.random() < p + 0.2) { if (!(await say("them", "accept", m2, 1400))) return; final = m2; }
    else if (!(await say("them", "walk", m2, 1400))) return;
  }
  const pl = state.player;
  if (final) {
    const saved = d.ask - final, cash = Math.round(saved * 0.2);
    pl.balances.arena += cash; pl.balances.kp += 60; gainXp(70); quest("close-deal");
    addActivity(t("act.deal", { kind: t(`deal.kind.${d.kind}`), name: d.who, price: fmt(final) }));
    commit();
    log.append(el("div", { class: "deal-result win" }, el("div", { class: "big" }, t("deal.closed")), el("div", {}, `${t("deal.terms")}: ${fmt(final)} $ARENA`), el("div", { class: "muted" }, t("deal.saved", { n: fmt(saved) })), el("div", { class: "rows" }, el("span", { class: "ic arena" }, `+${cash} $ARENA`), el("span", { class: "ic kp" }, "+60 KP"))));
    toast(t("toast.deal", { name: d.who }), "good");
    const r = room.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, "#ffc94d", 40);
    sound.play("deal");
  } else { sound.play("lose"); log.append(el("div", { class: "deal-result lose" }, el("div", { class: "big" }, t("deal.walked")))); }
  log.scrollTop = log.scrollHeight;
}

// ------------------------------------------------------------------ agentic marketplace
// Two halves: the Kult agencies (live backend, OKX.AI identities, USDT jobs;
// js/agencies.js) and the agent-for-hire board ($ARENA, simulated).
function customerRef() {
  let id = null;
  try { id = localStorage.getItem("kw.customerId"); if (!id) { id = `kw_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`; localStorage.setItem("kw.customerId", id); } } catch { id ||= `kw_${Math.random().toString(36).slice(2, 14)}`; }
  return { id, name: state.player?.agent?.name || null };
}
const agencies = createAgencies({
  el, t, toast, sound, burst, customer: customerRef,
  onJobAccepted: (a, job) => {
    const p = state.player; quest("hire-agent"); gainXp(60); p.balances.kp += 40;
    addActivity(t("act.agency", { name: a.name, price: job.agreement?.price ?? "" })); commit();
    toast(t("toast.agency", { name: a.name }), "good");
  }
});
let marketTab = "agencies", marketCat = "all";
function renderMarket() {
  $("market-tabs").replaceChildren(...[["agencies", "#4fd8ff"], ["agents", "#ff7eb6"]].map(([k, c]) => el("button", { type: "button", style: `--c:${c}`, "aria-pressed": marketTab === k ? "true" : "false", onclick: () => { if (marketTab !== k) { marketTab = k; renderMarket(); } } }, el("i"), t(`market.tab.${k}`))));
  show("agency-home", marketTab === "agencies"); show("agent-home", marketTab === "agents");
  if (marketTab === "agencies") { if ($("agency-room").hidden) agencies.renderList(); } else renderAgents();
}
function renderAgents() {
  $("market-cats").replaceChildren(...["all", "analytics", "creative", "trading", "dev"].map((c) => el("button", { type: "button", style: "--c:#4fd8ff", "aria-pressed": marketCat === c ? "true" : "false", onclick: () => { marketCat = c; renderAgents(); } }, t(c === "all" ? "market.all" : `market.cat.${c}`))));
  $("market-grid").replaceChildren(...SERVICES.filter((s) => marketCat === "all" || s.cat === marketCat).map((s) => {
    const card = el("div", { class: "svc-card", style: `--c:${archetype(s.archetype).color}` },
      el("div", { class: "svc-top" }, portrait(s.archetype), el("div", {}, el("b", {}, s.who), el("small", {}, `${archetype(s.archetype).name} · ★ ${s.rating} · ${t("market.jobs", { n: fmt(s.jobs) })}`))),
      el("div", { class: "svc-name" }, pick(s.service)),
      el("span", { class: "kind" }, t(`market.cat.${s.cat}`)),
      el("div", { class: "svc-foot" }, el("div", {}, el("b", { class: "ic arena" }, fmt(s.price)), el("small", {}, t("market.delivery", { n: s.secs }))), el("button", { type: "button", class: "btn primary small", onclick: () => hire(s, card) }, t("market.hire"))));
    return card;
  }));
}
async function hire(s, card) {
  const p = state.player;
  if (card.classList.contains("working")) return;
  if (p.balances.arena < s.price) { toast(t("market.broke"), "bad"); card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); return; }
  p.balances.arena -= s.price; commit();
  card.classList.add("working");
  const bar = el("i"), over = el("div", { class: "svc-work" }, portrait(s.archetype), el("div", {}, t("market.working", { name: s.who })), el("div", { class: "bar" }, bar));
  card.append(over);
  const t0 = performance.now();
  await new Promise((res) => { const f = () => { const k = Math.min(1, (performance.now() - t0) / (s.secs * 1000)); bar.style.width = `${k * 100}%`; if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  quest("hire-agent"); gainXp(40); p.balances.kp += 20;
  addActivity(t("act.hire", { name: s.who, service: pick(s.service), price: s.price })); commit();
  const stars = el("div", { class: "stars" }, [1, 2, 3, 4, 5].map((n) => el("button", { type: "button", onclick: () => { [...stars.children].forEach((b, i) => b.classList.toggle("on", i < n)); } }, "★")));
  over.replaceChildren(el("div", { class: "big" }, t("market.delivered")), el("div", { class: "small" }, pick(s.result)), el("small", { class: "muted" }, t("market.rate")), stars,
    el("button", { type: "button", class: "btn small", onclick: () => { over.remove(); card.classList.remove("working"); } }, t("market.done")));
  toast(t("toast.hire", { name: s.who, service: pick(s.service) }), "good");
  const r = card.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, "#4fd8ff", 26);
}
$("market-list-btn").addEventListener("click", () => {
  const p = state.player, name = p.agent.name;
  toast(t("market.listed", { name }), "good");
  setTimeout(() => { const earn = 30 + Math.floor(Math.random() * 40); p.balances.arena += earn; addActivity(`+${earn} $ARENA · ${name} @ Marketplace`); commit(); toast(`+${earn} $ARENA · ${name}`, "good"); }, 6000);
});

// ------------------------------------------------------------------ other agents
// Another agent's card: its model turning on a pedestal beside its profile.
let viewer = null;
function closeAgentCard() { if ($("agent-card").hidden) return; show("agent-card", false); viewer?.hide(); }
function showAgentCard(a) {
  const card = $("agent-card"), arch = archetype(a.archetype), clan = CLANS.find((c) => c.id === a.clan);
  const p = agentProfile(a), r = rankOf(p.elo), nr = nextRank(p.elo), games = p.wins + p.losses;
  a.paused = true; a.path = []; world.emote(a, "Wave");
  setTimeout(() => { a.paused = false; }, 4000);
  sound.play("open");
  card.style.setProperty("--c", arch.color);
  const stage = el("div", { class: "ac-stage" },
    el("span", { class: "ac-plate" }, `INFT #${p.inft}`), el("span", { class: "ac-lv" }, t("ac.level", { n: p.level })),
    el("span", { class: "ac-hint" }, t("ac.drag")));
  card.replaceChildren(
    el("button", { type: "button", class: "close", "aria-label": t("close"), onclick: closeAgentCard }, "×"),
    stage,
    el("div", { class: "ac-info" },
      el("div", { class: "ac-status" }, el("i"), t("ac.online", { place: t(`district.${world.districtAt(a.x, a.y)}`) })),
      el("h2", { class: "ac-name" }, a.name),
      el("div", { class: "tags" },
        el("span", { class: "tag", style: `color:${arch.color}` }, arch.name.toUpperCase()),
        el("span", { class: "tag", style: `color:${clan?.color}` }, clan?.name.toUpperCase()),
        el("span", { class: "tag", style: "color:var(--muted)" }, p.evolution)),
      el("p", { class: "ac-line muted" }, arch.tagline),
      el("div", { class: "rank-row" },
        el("img", { src: rankBadge(r), alt: "" }),
        el("div", {}, el("div", { class: "rn", style: `color:${r.color}` }, r.name.toUpperCase()), el("div", { class: "bar" }, el("i", { style: `--c:${r.color};width:${nr ? Math.round(((p.elo - r.min) / (nr.min - r.min)) * 100) : 100}%` }))),
        el("span", { class: "elo" }, fmt(p.elo), el("small", {}, "ELO"))),
      el("div", { class: "wl four" },
        el("div", {}, el("b", { style: "color:var(--green)" }, p.wins), el("span", {}, t("pp.wins"))),
        el("div", {}, el("b", { style: "color:var(--red)" }, p.losses), el("span", {}, t("pp.losses"))),
        el("div", {}, el("b", {}, `${Math.round((p.wins / games) * 100)}%`), el("span", {}, t("pp.winrate"))),
        el("div", {}, el("b", { style: "color:var(--gold)" }, p.streak), el("span", {}, t("ac.streak")))),
      el("h3", { class: "ac-h" }, t("pp.traits"), el("small", {}, `${t("ac.style")}: ${arch.role.join(" · ")}`)),
      el("div", { class: "traits two" }, TRAITS.map((tr) => el("div", { class: "trait" }, el("span", {}, t(`trait.${tr}`)), el("div", { class: "bar" }, el("i", { style: `--c:${arch.color};width:${p.traits[tr]}%` })), el("b", {}, p.traits[tr])))),
      el("dl", { class: "ac-facts" },
        el("div", {}, el("dt", {}, t("ac.fav")), el("dd", { style: `color:${p.favourite.color}` }, p.favourite.name)),
        el("div", {}, el("dt", {}, t("ac.deals")), el("dd", {}, fmt(p.deals)))),
      el("div", { class: "ac-btns" },
        el("button", { type: "button", class: "btn primary small", onclick: () => { closeAgentCard(); goTo("hub", { challenge: a }); } }, t("agent.challenge")),
        el("button", { type: "button", class: "btn ghost small", onclick: () => { world.emote(world.player, "Wave"); toast(t("toast.wave", { name: a.name })); closeAgentCard(); } }, t("agent.wave")))));
  show("agent-card");
  (viewer ||= new AgentViewer()).show(stage, a.body, world.agentClips(a), arch.color);
}

// ------------------------------------------------------------------ live feed
function feedEvent() {
  if (!state.inWorld || document.hidden) return;
  const agents = [...world.agents.values()].filter((a) => !a.isPlayer);
  if (agents.length < 2) return;
  const a = agents[Math.floor(Math.random() * agents.length)], b = agents.filter((x) => x !== a)[Math.floor(Math.random() * (agents.length - 1))];
  const k = Math.random();
  const [icon, text] = k < 0.4 ? ["⚔", t("feed.won", { a: a.name, b: b.name, game: GAMES[Math.floor(Math.random() * 4)].name })]
    : k < 0.65 ? ["🤝", t("feed.deal", { a: a.name, b: b.name, kind: t(`deal.kind.${["otc", "sponsor", "partner", "license"][Math.floor(Math.random() * 4)]}`) })]
      : k < 0.85 ? ["🛒", t("feed.hire", { a: a.name, b: SERVICES[Math.floor(Math.random() * SERVICES.length)].who })]
        : ["🎮", t("feed.ship", { a: a.name })];
  const item = el("div", { class: "feed-item glass", style: `--c:${a.color}` }, el("span", { class: "fi" }, icon), el("span", {}, text));
  $("feed").prepend(item);
  while ($("feed").children.length > 4) $("feed").lastChild.remove();
  setTimeout(() => item.classList.add("old"), 9000);
}

// ------------------------------------------------------------------ boot
await loadArt();
if (new URLSearchParams(location.search).has("reset")) { resetPlayer(); state.player = null; }
if (state.player && new URLSearchParams(location.search).has("continue")) enterWorld(false);
