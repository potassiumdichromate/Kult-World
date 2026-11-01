// Kult World: the intro, landing, Privy sign-in, minting (a 3D character
// select), the 3D city, the passport
// drawer and every place: the Business Park (four businesses), the Game Hub,
// the Deal Room and the Agentic Marketplace. The player, their agent, the
// city's agents, battles, businesses and the marketplace are live KULT data
// (js/kult.js); the Deal Room is a labeled preview. All text is
// English / 中文 (js/i18n.js).

import { World, BUILDINGS, MAP } from "./world3d.js";
import { randomStreetTile } from "./layout.js";
import { setSignTranslator } from "./models.js";
import { drawThumb } from "./minigames.js";
import { t, setLang, getLang, applyI18n, onLang } from "./i18n.js";
import { sound } from "./audio.js";
import { AgentViewer } from "./agentview.js";
import { CharacterStage } from "./charselect.js";
import { introDone, introReady } from "./intro.js";
import { createOkx } from "./okx.js";
import { createA2A } from "./a2a.js";
import {
  CLANS, ARCHETYPES, archetype, TRAITS, rankOf, nextRank, BUSINESSES, GAMES, gameByArenaId, MATCH_MODES, DEALS, DEAL_LINES,
  agentFromApi, loadProgress, saveProgress
} from "./data.js";
import { config, privyClient, session, arenaApi, kultApi, a2aApi, okxApi } from "./kult.js";
import { findMatch, challenge as directChallenge, loadBattle, playUnity, playLauncher, report, Cancelled, LAUNCHER_DOWNLOAD } from "./battle.js";

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
// state.player: { wallet, email, agent (Kult World shape), raw (the AI Arena
// agent), balances { arena, kp } (null = unavailable), profile (Kult backend),
// passport (Kult World progression), quests, activity }.
const state = { player: null, agents: [], inWorld: false, manifest: null, urlOf: (f) => `art/${f}`, wart: null };
const world = new World($("world"));
let firstFrames;
const framesReady = new Promise((r) => { firstFrames = r; });
if (new URLSearchParams(location.search).has("debug")) window.kw = { world, state, sound, session };
{ const q = { low: 0, medium: 1, high: 2 }[new URLSearchParams(location.search).get("quality")]; if (q !== undefined) { world.setQuality(q); world.qualityLocked = true; } }

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
// Portraits follow one file pattern, so they show even if the art manifest is
// missing; one that fails to load becomes the archetype's coloured initial.
const portraitUrl = (arch) => {
  const id = String(arch).toLowerCase(), m = state.manifest?.ceo?.[id];
  return m?.portrait ? state.urlOf(m.portrait) : ARCHETYPES.some((a) => a.id === id) ? `art/ceo-${id}-portrait.png` : null;
};
const rankBadge = (r) => `art/${r.badge}`;
function portrait(arch, cls = "") {
  const a = archetype(arch), ph = () => el("span", { class: `${cls} ph`, style: `--c:${a.color}` }, a.name[0]);
  const src = portraitUrl(arch);
  if (!src) return ph();
  const img = el("img", { class: `${cls} face`, src, alt: "", decoding: "async" });
  img.addEventListener("error", () => img.replaceWith(ph()), { once: true });
  return img;
}

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
  // A frame stamped before the loop started would make dt (and the clock) negative.
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  world.update(dt); world.draw();
  if (state.inWorld) {
    world.autoQuality(dt);
    const p = world.player;
    sound.update(world.t, { walking: p?.walking, fountainDist: p && world.fountainPos ? p.group.position.distanceTo(world.fountainPos) : 99 });
  }
  if (++frames === 3) firstFrames();
  if (state.inWorld && now - slowAt > 100) { slowAt = now; updateLocation(); updatePrompt(); world.minimap($("minimap")); }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
const worldReady = world.init();
// The city's other agents are real AI Arena agents walking the streets; the
// player's own are left out. With AI Arena unreachable the streets stay empty.
async function populateCity() {
  await worldReady;
  let list = [];
  try { list = (await arenaApi.agents(1, 30))?.agents ?? []; } catch (e) { console.warn("[kult-world] city agents unavailable:", e.message); }
  const mine = new Set(state.agents.map((a) => a.id));
  for (const id of mine) {
    const a = world.agents.get(id);
    if (a) { world.scene.remove(a.group); a.label.element.remove(); world.agents.delete(id); }
  }
  for (const raw of list.filter((a) => !mine.has(a.id)).slice(0, 16)) {
    const a = agentFromApi(raw), [x, y] = randomStreetTile();
    if (!world.agents.has(a.id)) world.addAgent(a.id, { id: a.id, name: a.name, archetype: a.archetype, clan: a.clan, elo: a.elo, x: x + 0.5, y: y + 0.5 });
  }
}

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
// Sign in with Privy (the shared KULT account), then into the world with the
// player's agent, or to minting when they have none.
// The button's label is a text key, so a language switch keeps the right text.
function enterLabel(key) { const n = $("enter-label"); n.dataset.i18n = key; n.textContent = t(key); }
async function signInAndEnter() {
  const btn = $("enter-btn"), key = $("enter-label").dataset.i18n;
  btn.disabled = true; enterLabel("login.connecting2");
  try {
    if (!(await session.restore())) await session.signIn();
    enterLabel("login.checking");
    await loadPlayer();
    if (!state.player) return openMint();
    enterWorld(false);
  } catch (e) {
    if (!/closed|exited|cancel/i.test(e.message)) toast(e.message, "bad");
  } finally { btn.disabled = false; enterLabel(key); }
}
$("enter-btn").addEventListener("click", signInAndEnter);

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const agentPrefKey = () => `kw.agent.${String(session.wallet).toLowerCase()}`;

/** The signed-in player: their AI Arena agents, then balances and history. */
async function loadPlayer(preferId) {
  state.agents = await arenaApi.myAgents();
  if (!state.agents.length) { state.player = null; return null; }
  let saved = preferId;
  try { saved ||= localStorage.getItem(agentPrefKey()); } catch { /* optional */ }
  const raw = state.agents.find((a) => a.id === saved) || [...state.agents].sort((a, b) => (b.eloRating ?? 0) - (a.eloRating ?? 0))[0];
  try { localStorage.setItem(agentPrefKey(), raw.id); } catch { /* optional */ }
  const wallet = session.wallet, progress = loadProgress(wallet), email = (await privyClient()).user().email;
  const agent = agentFromApi(raw);
  progress.id = `KW-${String(wallet || raw.id).replace(/^0x/, "").slice(0, 6).toUpperCase()}`;
  progress.username = email || short(wallet);
  progress.wallet = short(wallet);
  progress.citizenSince = agent.mintedAt || progress.citizenSince;
  state.player = { wallet, email, agent, raw, balances: { arena: null, kp: null }, profile: null, battles: [], passport: progress, quests: progress.quests, activity: progress.activity };
  void refreshLive();
  return state.player;
}

/** Balances, KP, the latest agent stats and recent battles, each on its own. */
async function refreshLive() {
  const p = state.player;
  if (!p) return;
  const [wallet, profile, battles, agent] = await Promise.allSettled([arenaApi.wallet(p.agent.id), kultApi.profile(), arenaApi.battles(p.agent.id, 6), arenaApi.agent(p.agent.id)]);
  if (state.player !== p) return;
  if (wallet.status === "fulfilled" && wallet.value) p.balances.arena = Number(wallet.value.balanceArena ?? 0);
  if (profile.status === "fulfilled") { p.profile = profile.value; p.balances.kp = profile.value.kultPoints; if (profile.value.username) p.passport.username = profile.value.username; }
  if (battles.status === "fulfilled") p.battles = battles.value;
  if (agent.status === "fulfilled" && agent.value?.id) { p.raw = agent.value; p.agent = agentFromApi(agent.value); }
  if (state.inWorld) { renderPassport(); renderQuests(); }
}

async function switchAgent(id) {
  try { await loadPlayer(id); } catch (e) { return toast(e.message, "bad"); }
  const a = state.player.agent;
  world.spawnPlayer({ name: a.name, archetype: a.archetype, clan: a.clan, elo: a.elo });
  renderPassport(); renderQuests();
  toast(t("toast.switched", { name: a.name }), "good");
}
for (const b of document.querySelectorAll("[data-close]")) b.addEventListener("click", () => { sound.play("close"); show(b.dataset.close, false); if (b.dataset.close === "deal") negotiation = null; });

// ------------------------------------------------------------------ mint
// A character select: pick an archetype on the 3D stage (js/charselect.js),
// a clan and a name. AI Arena's Create Agent (POST /v1/agents) makes the agent,
// its personality and its INFT; the stage charges up while it works.
const mintSel = { clan: "ZEROG", archetype: "support" };
let stage = null, minting = false;
const NAME_A = ["Neon", "Vex", "Nova", "Rift", "Echo", "Pixel", "Volt", "Onyx", "Zero", "Halo", "Glitch", "Cipher"];
const NAME_B = ["Runner", "Fang", "Warden", "Spark", "Shade", "Pilot", "Rogue", "Sage", "Drift", "Byte", "Nomad", "Saint"];
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];
const randomName = () => `${pickOne(NAME_A)}${pickOne(NAME_B)}${Math.floor(Math.random() * 90) + 10}`;
function openMint() {
  $("mint-name").value = randomName();
  $("mint-story").value = t("mint.storyDefault");
  setMinting(false);
  show("mint");
  stage ||= new CharacterStage($("cs-stage"));
  stage.setMode("idle"); stage.start();
  renderMint(true);
}
function closeMint() {
  if (minting) return;
  sound.play("close"); stage?.stop(); show("mint", false);
}
function setMinting(on) {
  minting = on;
  $("cs-form").hidden = on; $("cs-progress").hidden = !on;
  $("mint").classList.toggle("is-minting", on);
  $("cs-back").disabled = on;
  for (const b of document.querySelectorAll("#mint-archetypes button, .cs-nav")) b.disabled = on;
}
// spawn: also beam the archetype's model onto the stage.
function renderMint(spawn = false) {
  const a = archetype(mintSel.archetype);
  $("mint").style.setProperty("--ac", a.color);
  $("mint-selected").replaceChildren(
    el("b", { class: "cs-name" }, a.name.toUpperCase()),
    el("span", { class: "cs-tag" }, a.tagline),
    el("span", { class: "role-chips" }, a.role.map((r) => el("span", {}, r))));
  $("mint-clans").replaceChildren(...CLANS.map((c) => el("button", { type: "button", style: `--c:${c.color}`, "aria-pressed": mintSel.clan === c.id ? "true" : "false", onclick: () => { mintSel.clan = c.id; sound.play("pop"); renderMint(); } }, el("i"), c.name)));
  $("mint-archetypes").replaceChildren(...ARCHETYPES.map((x, i) => el("button", {
    type: "button", role: "radio", "aria-checked": mintSel.archetype === x.id ? "true" : "false", style: `--c:${x.color}`, disabled: minting,
    onclick: () => pickArchetype(x.id)
  }, portrait(x.id, "cs-face"), el("span", { class: "cs-rn" }, x.name.toUpperCase()), el("kbd", {}, i + 1))));
  if (spawn) {
    void stage?.select(a.id, a.color);
    // On a phone the roster is a strip: keep the picked one in view.
    $("mint-archetypes").querySelector('[aria-checked="true"]')?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }
}
function pickArchetype(id) {
  if (minting || id === mintSel.archetype) return;
  mintSel.archetype = id; sound.play("whoosh");
  renderMint(true);
}
const stepArchetype = (d) => { const i = ARCHETYPES.findIndex((a) => a.id === mintSel.archetype); pickArchetype(ARCHETYPES[(i + d + ARCHETYPES.length) % ARCHETYPES.length].id); };
for (const b of document.querySelectorAll(".cs-nav")) b.addEventListener("click", () => stepArchetype(Number(b.dataset.step)));
$("cs-back").addEventListener("click", closeMint);
$("mint-dice").addEventListener("click", () => { $("mint-name").value = randomName(); sound.play("type"); });
addEventListener("keydown", (e) => {
  if ($("mint").hidden || minting || e.target.closest("input, textarea, select")) return;
  if (e.key === "ArrowLeft") stepArchetype(-1);
  else if (e.key === "ArrowRight") stepArchetype(1);
  else if (e.key === "Escape") closeMint();
  else if (ARCHETYPES[Number(e.key) - 1]) pickArchetype(ARCHETYPES[Number(e.key) - 1].id);
});
$("mint-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (minting) return;
  const name = $("mint-name").value.trim(), backstory = $("mint-story").value.trim();
  if (name.length < 2) return toast(t("mint.nameShort"), "bad");
  const list = $("minting-steps");
  list.replaceChildren(...["mint.s1", "mint.s2", "mint.s3", "mint.s4", "mint.s5"].map((k) => el("li", {}, el("span", { class: "s" }), t(k))));
  setMinting(true);
  stage?.setMode("charging"); sound.play("spawn");
  let created = null, failure = null;
  const job = arenaApi.createAgent({ name, clan: mintSel.clan, archetype: mintSel.archetype.toUpperCase(), backstory })
    .then((a) => { created = a; }, (err) => { failure = err; });
  const steps = [...list.children];
  for (let i = 0; i < steps.length; i++) {
    steps[i].className = "run"; sound.play("beep");
    // The last step waits for AI Arena; the others pace the animation.
    if (i === steps.length - 1) await job; else await Promise.race([wait(900 + Math.random() * 400), job.then(() => wait(250))]);
    if (failure) break;
    steps[i].className = "ok";
  }
  if (failure || !created?.id) {
    setMinting(false); stage?.setMode("idle");
    return toast(failure?.message || t("mint.failed"), "bad");
  }
  stage?.setMode("done"); sound.play("level");
  $("mint").classList.add("minted");
  await wait(1500);
  try { await loadPlayer(created.id); } catch (err) { $("mint").classList.remove("minted"); setMinting(false); stage?.setMode("idle"); return toast(err.message, "bad"); }
  $("mint").classList.remove("minted"); minting = false; stage?.stop();
  addActivity(t("act.minted", { name: state.player.agent.name }));
  enterWorld(true);
});

// ------------------------------------------------------------------ the world
let feedTimer = null, liveTimer = null;
function enterWorld(fresh) {
  for (const id of ["landing", "mint"]) show(id, false);
  stage?.stop();
  for (const id of ["passport", "topbar", "hint", "dock", "minimap-wrap", "feed"]) show(id, true);
  state.inWorld = true;
  const a = state.player.agent;
  world.spawnPlayer({ name: a.name, archetype: a.archetype, clan: a.clan, elo: a.elo });
  sound.play("spawn");
  renderPassport(); renderQuests();
  setTimeout(() => toast(t(fresh ? "toast.spawned" : "toast.welcome", { name: a.name }), "good"), 900);
  setTimeout(() => show("hint", false), 14000);
  void populateCity();
  clearInterval(feedTimer); feedTimer = setInterval(feedEvent, 30000); setTimeout(feedEvent, 2500);
  clearInterval(liveTimer); liveTimer = setInterval(() => { if (!document.hidden) void refreshLive(); }, 60000);
}

// ------------------------------------------------------------------ passport drawer
const STAMPS = [["park", "PARK", "#ffc94d"], ["hub", "HUB", "#ff4fa3"], ["create", "CREATE", "#ff7eb6"], ["sports", "SPORTS", "#3ddc84"], ["deal", "DEAL", "#ffd27a"], ["market", "MARKET", "#4fd8ff"], ["dex", "DEX", "#5ec8f2"], ["production", "FILM", "#ffc94d"]];
const STAMP_ART = { hub: "arcade" };
const balText = (v) => (v === null || v === undefined ? "—" : fmt(v));
function battleLine(b, me) {
  const won = b.result?.winnerId === me, gm = gameByArenaId(b.gameId);
  return t("act.battle", { result: t(won ? "act.won" : "act.lost"), game: gm.name });
}
function renderPassport() {
  const p = state.player, a = p.agent, arch = archetype(a.archetype), clan = CLANS.find((c) => c.id === a.clan);
  const r = rankOf(a.elo), nr = nextRank(a.elo), games = a.wins + a.losses;
  if (p.passport.stamps.includes("arcade") && !p.passport.stamps.includes("hub")) p.passport.stamps.push("hub");
  setBalance("bal-arena", p.balances.arena); setBalance("bal-kp", p.balances.kp);
  $("hp-name").textContent = a.name; $("hp-level").textContent = p.passport.level;
  $("hp-rank").textContent = r.name; $("hp-elo").textContent = t("agent.elo", { n: fmt(a.elo) }); $("hp-badge").src = rankBadge(r);
  $("hp-xp").style.width = `${Math.round((p.passport.xp / p.passport.xpToNext) * 100)}%`;
  const face = $("hp-img");
  face.onerror = () => { face.onerror = null; face.removeAttribute("src"); face.classList.add("ph"); };
  if (portraitUrl(a.archetype) && face.getAttribute("src") !== portraitUrl(a.archetype)) { face.classList.remove("ph"); face.src = portraitUrl(a.archetype); }
  $("hud-player").style.setProperty("--ac", arch.color);
  $("hud-player").title = t("passport");
  const section = (title, small, ...kids) => el("section", { class: "pp-section" }, el("h3", {}, title, small ? el("small", {}, small) : null), ...kids);
  const others = state.agents.filter((x) => x.id !== a.id);
  const history = [
    ...p.battles.map((b) => ({ at: b.endedAt || b.createdAt, text: battleLine(b, a.id) })),
    ...p.activity
  ].filter((x) => x.at).sort((x, y) => Date.parse(y.at) - Date.parse(x.at)).slice(0, 6);
  $("passport-body").replaceChildren(
    el("div", { class: "pp-card" },
      el("div", { class: "pp-head" }, el("span", { class: "t" }, t("pp.title")), el("span", { class: "seal", title: r.name }, el("img", { src: rankBadge(r), alt: "" }))),
      el("div", { class: "pp-id" }, p.passport.id),
      el("dl", { class: "pp-rows" },
        el("dt", {}, t("pp.citizen")), el("dd", {}, p.passport.username),
        el("dt", {}, t("pp.wallet")), el("dd", { title: p.wallet || "" }, p.passport.wallet),
        el("dt", {}, t("pp.since")), el("dd", {}, new Date(p.passport.citizenSince).toLocaleDateString(getLang() === "zh" ? "zh-CN" : undefined))),
      el("div", { class: "pp-level" }, el("span", { class: "lv ic xp" }, t("pp.level", { n: p.passport.level })), el("span", { class: "muted" }, `${fmt(p.passport.xp)} / ${fmt(p.passport.xpToNext)} XP`)),
      el("div", { class: "bar" }, el("i", { style: `width:${Math.round((p.passport.xp / p.passport.xpToNext) * 100)}%` })),
      el("div", { class: "stamps", title: t("pp.visited") }, STAMPS.map(([id, label, c]) => {
        const on = p.passport.stamps.includes(id), img = wart(`stamp-${STAMP_ART[id] || id}`);
        return el("span", { class: `stamp${on ? " on" : ""}`, style: `--c:${c}`, title: `${label}${on ? "" : ` (${t("pp.notVisited")})`}` }, img ? el("img", { src: img, alt: label }) : label);
      }))),
    section(t("pp.identity"), a.inft ? `INFT #${a.inft}` : t("pp.noInft"),
      el("div", { class: "agent-row" }, portrait(a.archetype),
        el("div", {}, el("div", { class: "n" }, a.name), el("div", { class: "tags" },
          el("span", { class: "tag", style: `color:${arch.color}` }, arch.name.toUpperCase()),
          el("span", { class: "tag", style: `color:${clan?.color}` }, (clan?.name || a.clan).toUpperCase()),
          el("span", { class: "tag", style: "color:var(--muted)" }, a.evolution)))),
      el("div", { class: "rank-row" },
        el("img", { src: rankBadge(r), alt: "" }),
        el("div", {}, el("div", { class: "rn", style: `color:${r.color}` }, r.name.toUpperCase()), el("div", { class: "bar" }, el("i", { style: `--c:${r.color};width:${nr ? Math.round(((a.elo - r.min) / (nr.min - r.min)) * 100) : 100}%` })), el("div", { class: "muted tiny", style: "margin-top:3px" }, nr ? t("pp.toRank", { n: fmt(nr.min - a.elo), rank: nr.name }) : t("pp.topRank"))),
        el("span", { class: "elo ic elo-ic", title: "ELO" }, fmt(a.elo))),
      el("div", { class: "wl" },
        el("div", {}, el("b", { style: "color:var(--green)" }, a.wins), el("span", {}, t("pp.wins"))),
        el("div", {}, el("b", { style: "color:var(--red)" }, a.losses), el("span", {}, t("pp.losses"))),
        el("div", {}, el("b", {}, games ? `${Math.round((a.wins / games) * 100)}%` : "—"), el("span", {}, t("pp.winrate")))),
      others.length ? el("label", { class: "pp-switch" }, el("span", {}, t("pp.switch")),
        el("select", { onchange: (e) => { if (e.target.value) void switchAgent(e.target.value); } },
          el("option", { value: "" }, a.name), others.map((x) => el("option", { value: x.id }, `${x.name} · ${fmt(x.eloRating ?? 1000)} ELO`)))) : null),
    section(t("pp.traits"), arch.role.join(" · "),
      el("div", { class: "traits" }, TRAITS.map((tr) => el("div", { class: "trait" }, el("span", {}, t(`trait.${tr}`)), el("div", { class: "bar" }, el("i", { style: `--c:${arch.color};width:${a.traits[tr] ?? 0}%` })), el("b", {}, a.traits[tr] ?? "—"))))),
    section(t("pp.balances"), null,
      el("div", { class: "bal-grid two" },
        el("div", { class: "bal arena", style: "--c:var(--pink)", title: t("pp.arenaSrc") }, el("b", {}, balText(p.balances.arena)), el("span", {}, "$ARENA")),
        el("div", { class: "bal kp", style: "--c:var(--gold)", title: t("pp.kpSrc") }, el("b", {}, balText(p.balances.kp)), el("span", {}, t("pp.kp")))),
      p.balances.kp === null && session.signedIn ? el("button", { type: "button", class: "btn ghost small", onclick: async () => { try { await session.retryKult(); await refreshLive(); } catch (e) { toast(e.message, "bad"); } } }, t("pp.kpConnect")) : null),
    section(t("pp.businesses"), null,
      el("div", { class: "biz-list" }, BUSINESSES.map((b) => el("div", { class: "biz-row", style: `--c:${b.color}` }, el("span", { class: "dot" }),
        el("div", { style: "min-width:0" }, el("div", { class: "bn" }, t(`biz.${b.id}.name`)), el("div", { class: "bs" }, t(b.status === "open" ? "biz.openIt" : "biz.soonSub", { brand: b.brand }))),
        el("span", { class: `st ${b.status}` }, t(b.status === "open" ? "st.open" : "st.soon"))))),
      el("button", { type: "button", class: "btn ghost small", onclick: () => { togglePassport(false); openOkxOwner(); } }, t("okx.manage"))),
    section(t("pp.quests"), t("pp.questsLocal"), p.quests.map((q) => el("div", { class: `quest${q.progress >= q.target ? " done" : ""}` },
      el("div", { class: "qh" }, el("span", { class: "ic ic-quest" }, t(`quest.${q.id}`)), el("span", { class: "qr" }, `+${q.reward} XP`)),
      el("div", { class: "bar" }, el("i", { style: `--c:var(--green);width:${Math.round((Math.min(q.progress, q.target) / q.target) * 100)}%` })),
      el("span", { class: "muted tiny" }, `${Math.min(q.progress, q.target)} / ${q.target}`)))),
    section(t("pp.activity"), null, history.length ? el("ul", { class: "activity" }, history.map((x) => el("li", {}, x.text, el("time", {}, ago(x.at))))) : el("p", { class: "muted tiny" }, t("pp.noActivity"))),
    el("button", { type: "button", class: "btn ghost small pp-signout", onclick: signOut }, t("pp.signout")));
}
// Gamified quest tracker (under the balances): the next open quests.
function renderQuests() {
  const qs = state.player.quests.filter((q) => q.progress < q.target).slice(0, 3);
  $("quest-tracker").hidden = !state.inWorld || !qs.length;
  $("quest-tracker").replaceChildren(el("div", { class: "qt-head" }, el("span", { class: "ic ic-quest" }, t("quest.tracker")), el("b", {}, `${state.player.quests.filter((q) => q.progress >= q.target).length}/${state.player.quests.length}`)),
    ...qs.map((q) => el("div", { class: "qt-row" }, el("span", {}, t(`quest.${q.id}`)), el("small", {}, `${q.progress}/${q.target} · +${q.reward} XP`), el("div", { class: "bar" }, el("i", { style: `--c:var(--gold);width:${Math.round((q.progress / q.target) * 100)}%` })))));
}
function setBalance(id, v) {
  const n = $(id), old = n.dataset.v;
  n.textContent = balText(v); n.dataset.v = v ?? "";
  if (old !== undefined && old !== "" && v !== null && Number(old) !== v) { const pill = n.closest(".pill"); pill.classList.remove("bump"); void pill.offsetWidth; pill.classList.add("bump"); }
}
function addActivity(text) { state.player.activity.unshift({ at: new Date().toISOString(), text }); state.player.activity.splice(20); }
function stamp(id) { const s = state.player.passport.stamps; if (!s.includes(id)) { s.push(id); gainXp(60); } }
function quest(id, by = 1) {
  const q = state.player.quests.find((x) => x.id === id);
  if (!q || q.progress >= q.target) return;
  q.progress += by;
  if (q.progress >= q.target) {
    gainXp(q.reward);
    toast(t("toast.quest", { title: t(`quest.${q.id}`), reward: `${q.reward} XP` }), "good"); sound.play("quest");
    burst(innerWidth - 170, 150, "#ffc94d", 24);
  }
}
function gainXp(n) { const pp = state.player.passport; pp.xp += n; while (pp.xp >= pp.xpToNext) { pp.xp -= pp.xpToNext; pp.level += 1; pp.xpToNext = Math.round(pp.xpToNext * 1.35); toast(t("toast.level", { n: pp.level }), "good"); sound.play("level"); } }
function commit() { if (!state.player) return; saveProgress(state.player.wallet, state.player.passport); renderPassport(); renderQuests(); }
async function signOut() { await session.signOut(); location.href = location.pathname; }

function togglePassport(force) { const o = $("passport").classList.toggle("open", force); $("passport-toggle").setAttribute("aria-expanded", String(o)); }
$("passport-toggle").addEventListener("click", () => togglePassport());
$("hud-player").addEventListener("click", () => togglePassport());
for (const b of document.querySelectorAll("[data-act]")) b.addEventListener("click", () => { if (b.dataset.act === "passport") togglePassport(); else world.recenter(); });
$("menu-btn").addEventListener("click", () => show("menu", $("menu").hidden));
for (const b of document.querySelectorAll("[data-goto]")) b.addEventListener("click", () => { show("menu", false); goTo(b.dataset.goto); });
$("sign-out").addEventListener("click", () => signOut());
addEventListener("keydown", (e) => {
  if (!state.inWorld || e.target.closest("input, textarea, select")) return;
  if (e.key === "Escape") { if (anyOpen()) closeOverlays(); else { togglePassport(false); closeAgentCard(); } return; }
  if (anyOpen()) return;
  const k = e.key.toLowerCase();
  const go = { 1: "park", 2: "hub", 3: "deal", 4: "market" }[k];
  if (go) goTo(go); else if (k === "p") togglePassport(); else if (k === "c") world.recenter();
  else if (k === "e") { const b = world.nearDoor(2.2); if (b) openPlace(b); }
});
function closeOverlays() { sound.play("close"); cancelMatch(); negotiation = null; okx.stop(); a2a.stop(); for (const id of ["park", "hub", "deal", "market", "okx"]) show(id, false); }

// ------------------------------------------------------------------ places
function openPlace(b, then) {
  closeAgentCard();
  sound.play("open"); flash(b.color);
  // Walking into an open business goes straight inside it; the campus gate
  // and the coming-soon buildings show the Business Park.
  const biz = b.kind === "biz" ? BUSINESSES.find((x) => x.id === b.id && x.status === "open") : null;
  if (biz) { stamp("park"); quest("visit-park"); void openApp(biz); }
  else if (b.kind === "biz" || b.kind === "park") { renderBiz(b.kind === "biz" ? b.id : null); show("park"); stamp("park"); quest("visit-park"); }
  if (b.kind === "hub") { renderGames(); show("hub-list"); show("hub-match", false); show("hub"); stamp("hub"); if (then?.challenge) startMatch(GAMES[0], then.challenge); }
  if (b.kind === "deal") { renderDeals(); show("deal-list"); show("deal-room", false); show("deal"); stamp("deal"); }
  if (b.kind === "market") { renderMarket(); show("market"); stamp("market"); }
  commit();
}

// ------------------------------------------------------------------ business park
function bizArt(b) { const c = el("canvas", { width: 160, height: 90 }), g = c.getContext("2d"); g.fillStyle = b.color; g.globalAlpha = 0.25; g.fillRect(40, 20, 80, 50); return c; }
function renderBiz(focus = null) {
  $("biz-grid").replaceChildren(...BUSINESSES.map((b) => {
    const card = el("button", { type: "button", class: `biz-card ${b.status}${focus === b.id ? " focus" : ""}`, style: `--c:${b.color}`, "aria-label": t(`biz.${b.id}.name`) },
      b.status === "soon" ? el("span", { class: "lock", "aria-hidden": "true" }, "🔒") : null,
      el("div", { class: "biz-art" }, wart(`card-${b.id}`) ? el("img", { src: wart(`card-${b.id}`), alt: "", draggable: "false" }) : bizArt(b)),
      el("div", { class: "biz-body" },
        el("span", { class: "brand2" }, b.brand.toUpperCase()),
        el("span", { class: "name" }, t(`biz.${b.id}.name`)),
        el("p", {}, t(`biz.${b.id}.blurb`)),
        el("div", { class: "biz-foot" }, el("span", { class: "muted" }, b.status === "open" ? t(`biz.${b.id}.live`) : t("biz.soon")), el("span", { class: "go" }, b.status === "open" ? t("biz.enter") : t("biz.soon")))));
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
  setTimeout(() => { card.classList.remove("activate"); show("park", false); void openApp(b); }, 1000);
}
function locked(card) {
  sound.play("error");
  card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
  const s = el("span", { class: "stampfx" }, t("biz.comingStamp")); card.append(s); setTimeout(() => s.remove(), 1650);
}
function loadScriptOnce(src) {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => { const s = el("script", { src }); s.onload = resolve; s.onerror = () => reject(new Error(t("biz.unreachable"))); document.head.append(s); });
}
// Both businesses open signed in as the same KULT player: Kult Create takes
// the Privy session through its embed.js, Kult Sports takes the AI Arena
// token in ?jwt= (both as their READMEs describe for Kult World).
async function openApp(b) {
  const c = await config();
  stamp(b.id); quest("open-business");
  if (b.id === "create") {
    try {
      await loadScriptOnce(`${c.kultCreateUrl}/embed.js`);
      const privy = await privyClient();
      window.KultCreate.open({
        getSession: async () => (privy.authenticated ? privy.tokens() : null),
        login: async () => { await privy.login(); },
        onExit: () => toast(t("toast.back"))
      });
      addActivity(t("act.entered", { brand: b.brand }));
    } catch (e) { toast(e.message, "bad"); }
  } else if (b.id === "sports") {
    const url = new URL(`${c.kultSportsUrl}/`);
    if (session.arena?.accessToken) { url.searchParams.set("jwt", session.arena.accessToken); url.searchParams.set("source", "kult-world"); }
    $("app-title").textContent = `${b.brand} · ${t(`biz.${b.id}.name`)}`;
    $("app-newtab").href = `${c.kultSportsUrl}/`;
    $("app-iframe").src = url.href;
    show("app-frame");
    addActivity(t("act.entered", { brand: b.brand }));
  }
  commit();
}
$("app-back").addEventListener("click", () => { show("app-frame", false); $("app-iframe").src = "about:blank"; toast(t("toast.back")); });

// ------------------------------------------------------------------ game hub
// Real AI Arena battles (js/battle.js): matchmaking, the Unity builds and the
// Robowars launcher, the official result, then trait evolution, training,
// 0G commentary and memory.
let matchMode = "RANKED";
function renderGames() {
  $("hub-modes").replaceChildren(...MATCH_MODES.map((m) => el("button", { type: "button", style: "--c:#ff4fa3", "aria-pressed": matchMode === m.id ? "true" : "false", onclick: () => { matchMode = m.id; renderGames(); } }, el("i"), t(`mode.${m.id}`))));
  $("game-grid").replaceChildren(...GAMES.map((gm) => {
    const src = wart(`thumb-${gm.id}`);
    let thumb;
    if (src) thumb = el("div", { class: "thumb" }, el("img", { src, alt: "", draggable: "false" }), gm.id === "wave" ? el("span", { class: "ribbon" }, t("hub.wave")) : null);
    else { thumb = el("canvas"); requestAnimationFrame(() => drawThumb(thumb, gm.id, gm.color)); }
    return el("button", { type: "button", class: "game-card", style: `--c:${gm.color}`, onclick: () => startMatch(gm) },
      thumb, el("div", { class: "gb" }, el("span", { class: "gg" }, t(`game.${gm.id}.genre`).toUpperCase()), el("span", { class: "gn" }, gm.name), el("p", {}, t(`game.${gm.id}.blurb`)),
        el("div", { class: "gf" }, el("span", {}, t(`game.${gm.id}.mode`)), el("span", { class: "muted" }, t(gm.engine === "launcher" ? "hub.engine.launcher" : "hub.engine.unity")))));
  }));
}
let match = null;
function cancelMatch() { if (match) match.cancelled = true; match = null; closeStage(); }
function setScreen(...kids) { $("screen-ui").replaceChildren(...kids); }
setInterval(() => { $("monitor-clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }, 1000);

const vsSide = (x, cls) => {
  const arch = archetype(x.archetype), elo = x.eloRating ?? 1000;
  return el("div", { class: `vs-side ${cls}`, style: `--c:${x.color || arch.color}` }, portrait(arch.id, "p"), el("div", { class: "vn" }, String(x.name).toUpperCase()), el("div", { class: "vm" }, el("img", { src: rankBadge(rankOf(elo)), alt: "" }), `${fmt(elo)} ELO · ${arch.name}`));
};

// The full-screen stage the Unity builds run in.
let stageExit = null;
function openStage(gm, me, them) {
  $("stage-title").textContent = `${gm.name} · ${me.name} vs ${them.name}`;
  $("stage-bar").style.width = "0%"; $("stage-pct").textContent = "0%";
  show("stage-loading"); show("stage-prematch", false); show("battle-stage");
  return {
    progress: (p) => { const n = Math.round(p * 100); $("stage-bar").style.width = `${n}%`; $("stage-pct").textContent = `${n}%`; },
    loaded: () => show("stage-loading", false),
    preMatch: (d) => { $("stage-prematch-t").textContent = t("stage.prematch", { a: d.myAgentName || me.name, b: d.opponentName || them.name }); show("stage-prematch"); setTimeout(() => show("stage-prematch", false), 9000); },
    onExit: (fn) => { stageExit = fn; }
  };
}
function closeStage() { show("battle-stage", false); stageExit = null; }
$("stage-exit").addEventListener("click", () => { const fn = stageExit; closeStage(); fn?.(); });

async function startMatch(gm, opponent = null) {
  cancelMatch();
  const token = { cancelled: false }; match = token;
  const alive = () => match === token && !token.cancelled;
  const me = state.player.raw, a = state.player.agent, startElo = a.elo;
  show("hub-list", false); show("hub-match");
  $("monitor-title").textContent = `KULT-OS · ${gm.name.toUpperCase()} · ${t(`mode.${matchMode}`).toUpperCase()}`;
  $("game-canvas").hidden = true; show("match-skip", false); $("monitor-led").className = "led busy";
  const status = el("div", { class: "scan-names" }), radar = el("div", { class: "radar" });
  for (let i = 0; i < 5; i++) radar.append(el("span", { class: "blip", style: `left:${20 + Math.random() * 60}%;top:${20 + Math.random() * 60}%;animation-delay:${i * 0.2}s` }));
  setScreen(el("div", { class: "scan" }, radar, el("div", { class: "scan-t" }, t(opponent ? "match.challenging" : "match.scanning")), el("div", { class: "scan-names" }, `${a.name.toUpperCase()} · ${fmt(a.elo)} ELO`), status));
  try {
    const battleId = opponent
      ? await directChallenge({ agentId: me.id, opponentId: opponent.id, gameId: gm.arenaId, mode: matchMode })
      : await findMatch({ agentId: me.id, gameId: gm.arenaId, mode: matchMode, isAlive: alive, onTick: (ms) => { status.textContent = t("match.queued", { n: Math.round(ms / 1000) }); } });
    if (!alive()) return;
    const { opponent: them } = await loadBattle(battleId, me.id);
    if (!alive()) return;
    setScreen(el("div", {}, el("div", { class: "scan-t", style: "margin-bottom:3vmin;color:var(--gold)" }, t("match.found")), el("div", { class: "vs" }, vsSide(me, "l"), el("div", { class: "vs-mid" }, "VS"), vsSide(them, "r"))));
    sound.play("go");
    await wait(2600);
    if (!alive()) return;
    for (const n of ["3", "2", "1"]) { setScreen(el("div", { class: "count" }, n)); sound.play("beep"); await wait(700); if (!alive()) return; }

    let result;
    if (gm.engine === "unity") {
      setScreen(el("div", { class: "scan" }, el("div", { class: "scan-t" }, t("match.live")), el("div", { class: "scan-names" }, `${me.name.toUpperCase()} VS ${them.name.toUpperCase()}`)));
      const c = await config();
      result = await playUnity({ unityBase: c.unityBuildUrl, gameId: gm.arenaId, battleId, me, them, mode: matchMode, canvas: $("unity-canvas"), ui: openStage(gm, me, them) });
      closeStage();
    } else {
      const wait2 = el("div", { class: "scan-names" }, t("match.launcherWait", { n: 0 }));
      setScreen(el("div", { class: "scan" }, el("div", { class: "scan-t" }, t("match.launcher")), el("p", { class: "launcher-note" }, t("match.launcherNote")),
        el("a", { class: "btn small", href: LAUNCHER_DOWNLOAD, target: "_blank", rel: "noopener" }, t("match.launcherGet")), wait2));
      result = await playLauncher({ battleId, me, them, isAlive: alive, onTick: (ms) => { wait2.textContent = t("match.launcherWait", { n: Math.round(ms / 1000) }); } });
    }
    if (!alive()) return;

    $("monitor-led").className = "led";
    setScreen(el("div", { class: "scan" }, el("div", { class: "scan-t" }, t("match.reporting"))));
    const { commentary } = await report(result, { me, them });
    const win = result.winnerId === me.id;
    await refreshLive();
    const after = state.player.agent, dElo = after.elo - startElo, before = rankOf(startElo), now = rankOf(after.elo);
    if (win) quest("arcade-win");
    gainXp(win ? 80 : 30);
    commit();
    sound.play(win ? "win" : "lose");
    const commentaryBox = el("p", { class: "commentary muted" }, t("match.commentaryWait"));
    setScreen(el("div", { class: "result" },
      el("div", { class: `big ${win ? "win" : "lose"}` }, t(win ? "match.victory" : "match.defeat")),
      el("div", { class: "scan-names" }, `${me.name.toUpperCase()} VS ${them.name.toUpperCase()}`),
      el("div", { class: "rows" },
        el("span", { class: "ic elo-ic", style: `color:${dElo >= 0 ? "var(--green)" : "var(--red)"}` }, `${dElo >= 0 ? "+" : ""}${dElo} ELO`),
        result.score ? el("span", {}, `${fmt(result.score.winner)} vs ${fmt(result.score.loser)} ${result.score.unit}`) : null),
      now.name !== before.name ? el("div", { class: "scan-t", style: `color:${now.color}` }, t("match.rankup", { rank: now.name.toUpperCase() })) : null,
      commentaryBox,
      el("div", { class: "btns" }, el("button", { type: "button", class: "btn primary", onclick: () => startMatch(gm, opponent) }, t("match.rematch")), el("button", { type: "button", class: "btn", onclick: backToGames }, t("match.other")))));
    void commentary.then((text) => { commentaryBox.textContent = text || t("match.noCommentary"); });
    if (win) burst(innerWidth / 2, innerHeight / 2, "#ffc94d", 40);
  } catch (e) {
    closeStage();
    // Leaving the battle stage goes back to the game list.
    if (e instanceof Cancelled && alive()) return backToGames();
    if (e instanceof Cancelled || !alive()) return;
    $("monitor-led").className = "led";
    sound.play("error");
    setScreen(el("div", { class: "result" }, el("div", { class: "big lose" }, t("match.error")), el("p", { class: "muted" }, e.message),
      el("div", { class: "btns" }, el("button", { type: "button", class: "btn primary", onclick: () => startMatch(gm, opponent) }, t("match.retry")), el("button", { type: "button", class: "btn", onclick: backToGames }, t("match.other")))));
  }
}
function backToGames() { cancelMatch(); show("hub-match", false); show("hub-list"); renderGames(); $("monitor-led").className = "led"; }
$("match-back").addEventListener("click", backToGames);
$("hub-close").addEventListener("click", () => { sound.play("close"); cancelMatch(); show("hub", false); });

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
  if (final) {
    // The Deal Room is a labeled preview (no backend), so it pays out Kult World XP
    // only; it never touches the player's real $ARENA or KP.
    const saved = d.ask - final;
    gainXp(70); quest("close-deal");
    addActivity(t("act.deal", { kind: t(`deal.kind.${d.kind}`), name: d.who, price: fmt(final) }));
    commit();
    log.append(el("div", { class: "deal-result win" }, el("div", { class: "big" }, t("deal.closed")), el("div", {}, `${t("deal.terms")}: ${fmt(final)} $ARENA`), el("div", { class: "muted" }, t("deal.saved", { n: fmt(saved) })), el("div", { class: "rows" }, el("span", { class: "ic xp" }, "+70 XP")), el("div", { class: "tiny muted" }, t("deal.demo"))));
    toast(t("toast.deal", { name: d.who }), "good");
    const r = room.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, "#ffc94d", 40);
    sound.play("deal");
  } else { sound.play("lose"); log.append(el("div", { class: "deal-result lose" }, el("div", { class: "big" }, t("deal.walked")))); }
  log.scrollTop = log.scrollHeight;
}

// ------------------------------------------------------------------ agentic marketplace
// Two halves: the Kult OKX gateway (js/okx.js), where OKX.AI users hire the
// AI teams of players' businesses per call, and the A2A job board on Base
// (js/a2a.js), where agents hire agents through escrow.
const okx = createOkx({
  el, t, toast, sound, burst,
  wallet: () => session.wallet,
  signTypedData: async (chainId, typedData) => (await privyClient()).signTypedData(session.wallet, chainId, typedData),
  signMessage: async (address, message) => (await privyClient()).signMessage(address, message),
  openDirectory: (providerId) => { show("okx", false); marketTab = "okx"; renderMarket(providerId); show("market"); stamp("market"); },
  onHired: (p, job) => {
    quest("hire-agent"); gainXp(60);
    addActivity(t("act.okxHire", { name: p.businessName, price: job.payment.amount })); commit();
    toast(t("toast.okxHire", { name: p.businessName }), "good");
  },
  onLinked: (b) => { gainXp(100); addActivity(t("act.okxLinked", { name: b.name })); commit(); }
});
const a2a = createA2A({
  el, t, toast, sound, burst,
  myAgents: () => state.agents,
  currentAgent: () => state.player?.raw,
  wallet: () => session.wallet,
  signTypedData: async (address, chainId, typedData) => (await privyClient()).signTypedData(address, chainId, typedData),
  onSettled: (job) => { quest("hire-agent"); gainXp(80); addActivity(t("act.a2a", { status: job.status })); commit(); }
});
let marketTab = "okx";
function renderMarket(focusProvider = null) {
  $("market-tabs").replaceChildren(...[["okx", "#9fe8ff"], ["jobs", "#ff7eb6"]].map(([k, c]) => el("button", { type: "button", style: `--c:${c}`, "aria-pressed": marketTab === k ? "true" : "false", onclick: () => { if (marketTab !== k) { marketTab = k; renderMarket(); } } }, el("i"), t(`market.tab.${k}`))));
  show("agency-home", marketTab === "okx"); show("agent-home", marketTab === "jobs");
  if (marketTab === "okx") { a2a.stop(); okx.directory($("agency-home"), focusProvider); }
  else { okx.stop(); a2a.render($("agent-home")); }
}
// The player's own businesses on OKX.AI: link, go live, prices, incoming calls.
function openOkxOwner() {
  closeAgentCard();
  sound.play("open"); flash("#9fe8ff");
  show("okx"); okx.owner($("okx-body"));
}
$("okx-close").addEventListener("click", () => { sound.play("close"); okx.stop(); show("okx", false); });
$("okx-owner-btn").addEventListener("click", () => { show("park", false); openOkxOwner(); });

// ------------------------------------------------------------------ other agents
// Another agent's card: its model on a pedestal beside its live AI Arena profile.
let viewer = null;
function closeAgentCard() { if ($("agent-card").hidden) return; show("agent-card", false); viewer?.hide(); }
async function showAgentCard(a) {
  const card = $("agent-card");
  a.paused = true; a.path = []; world.emote(a, "Wave");
  setTimeout(() => { a.paused = false; }, 4000);
  sound.play("open");
  let raw = null;
  try { raw = await arenaApi.agent(a.id); } catch (e) { toast(e.message, "bad"); return; }
  const p = agentFromApi(raw), arch = archetype(p.archetype), clan = CLANS.find((c) => c.id === p.clan);
  const r = rankOf(p.elo), nr = nextRank(p.elo), games = p.wins + p.losses;
  card.style.setProperty("--c", arch.color);
  const stage = el("div", { class: "ac-stage" },
    p.inft ? el("span", { class: "ac-plate" }, `INFT #${p.inft}`) : null, el("span", { class: "ac-lv" }, p.evolution),
    el("span", { class: "ac-hint" }, t("ac.drag")));
  card.replaceChildren(
    el("button", { type: "button", class: "close", "aria-label": t("close"), onclick: closeAgentCard }, "×"),
    stage,
    el("div", { class: "ac-info" },
      el("div", { class: "ac-status" }, el("i"), t("ac.online", { place: t(`district.${world.districtAt(a.x, a.y)}`) })),
      el("h2", { class: "ac-name" }, p.name),
      el("div", { class: "tags" },
        el("span", { class: "tag", style: `color:${arch.color}` }, arch.name.toUpperCase()),
        el("span", { class: "tag", style: `color:${clan?.color}` }, (clan?.name || p.clan).toUpperCase()),
        el("span", { class: "tag", style: "color:var(--muted)" }, p.evolution)),
      el("p", { class: "ac-line muted" }, p.backstory || arch.tagline),
      el("div", { class: "rank-row" },
        el("img", { src: rankBadge(r), alt: "" }),
        el("div", {}, el("div", { class: "rn", style: `color:${r.color}` }, r.name.toUpperCase()), el("div", { class: "bar" }, el("i", { style: `--c:${r.color};width:${nr ? Math.round(((p.elo - r.min) / (nr.min - r.min)) * 100) : 100}%` }))),
        el("span", { class: "elo" }, fmt(p.elo), el("small", {}, "ELO"))),
      el("div", { class: "wl" },
        el("div", {}, el("b", { style: "color:var(--green)" }, p.wins), el("span", {}, t("pp.wins"))),
        el("div", {}, el("b", { style: "color:var(--red)" }, p.losses), el("span", {}, t("pp.losses"))),
        el("div", {}, el("b", {}, games ? `${Math.round((p.wins / games) * 100)}%` : "—"), el("span", {}, t("pp.winrate")))),
      el("h3", { class: "ac-h" }, t("pp.traits"), el("small", {}, `${t("ac.style")}: ${arch.role.join(" · ")}`)),
      el("div", { class: "traits two" }, TRAITS.map((tr) => el("div", { class: "trait" }, el("span", {}, t(`trait.${tr}`)), el("div", { class: "bar" }, el("i", { style: `--c:${arch.color};width:${p.traits[tr] ?? 0}%` })), el("b", {}, p.traits[tr] ?? "—")))),
      el("div", { class: "ac-btns" },
        state.player ? el("button", { type: "button", class: "btn primary small", onclick: () => { closeAgentCard(); goTo("hub", { challenge: { id: p.id } }); } }, t("agent.challenge")) : null,
        el("button", { type: "button", class: "btn ghost small", onclick: () => { world.emote(world.player, "Wave"); toast(t("toast.wave", { name: p.name })); closeAgentCard(); } }, t("agent.wave")))));
  show("agent-card");
  (viewer ||= new AgentViewer()).show(stage, a.body, world.agentClips(a), arch.color);
}

// ------------------------------------------------------------------ live feed
// What is happening on KULT right now: A2A jobs moving and businesses
// serving OKX.AI users through the gateway.
const feedSeen = new Set();
async function feedEvent() {
  if (!state.inWorld || document.hidden) return;
  const items = [];
  const [jobs, providers] = await Promise.allSettled([a2aApi.listJobs("all"), okxApi.providers()]);
  if (jobs.status === "fulfilled") for (const j of (jobs.value?.jobs ?? []).slice(0, 6)) items.push({ key: `job:${j.id}:${j.status}`, at: j.settledAt || j.deliveredAt || j.fundedAt || j.createdAt, icon: "🤝", text: t("feed.job", { status: t(`a2a.status.${j.status}`), prompt: String(j.prompt || "").slice(0, 60) }), c: "#ff7eb6" });
  if (providers.status === "fulfilled") for (const p of (providers.value?.providers ?? []).slice(0, 6)) items.push({ key: `okx:${p.id}:${p.stats.jobs}`, at: p.linkedAt, icon: "🛒", text: t("feed.okx", { name: p.businessName, service: p.services[0].name, n: p.stats.jobs }), c: "#9fe8ff" });
  for (const it of items.filter((x) => !feedSeen.has(x.key)).sort((x, y) => Date.parse(x.at) - Date.parse(y.at)).slice(-3)) {
    feedSeen.add(it.key);
    const item = el("div", { class: "feed-item glass", style: `--c:${it.c}` }, el("span", { class: "fi" }, it.icon), el("span", {}, it.text));
    $("feed").prepend(item);
    while ($("feed").children.length > 4) $("feed").lastChild.remove();
    setTimeout(() => item.classList.add("old"), 9000);
  }
}

// ------------------------------------------------------------------ boot
introReady(Promise.all([worldReady, framesReady]));
await loadArt();
void populateCity();
// ?debug: enter with an existing AI Arena session, without the Privy modal.
if (window.kw) { window.kw.enter = async () => { await loadPlayer(); if (state.player) enterWorld(false); else openMint(); }; window.kw.openMint = openMint; window.kw.stage = () => stage; }
void introDone.then(() => { if (!state.inWorld && $("mint").hidden) show("landing"); });
{
  const params = new URLSearchParams(location.search);
  try {
    const privy = await privyClient();
    if (params.has("reset")) await session.signOut();
    else if (privy.authenticated && session.signedIn && (await session.restore())) {
      enterLabel("landing.continue");
      if (params.has("continue")) { await loadPlayer(); if (state.player) enterWorld(false); }
    }
  } catch (e) {
    console.warn("[kult-world] sign-in unavailable:", e.message);
  }
}
