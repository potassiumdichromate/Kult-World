// KULT-OS: the Game Hub's console screen. Walking into the hub powers it on;
// its desktop holds three folders and two apps:
//
//   AI Gaming          the four AI vs AI games (the match flow in main.js)
//   Legacy Games       the six Kult titles a player plays themself; the
//                      catalog and play URLs come from the Kult backend
//   Kult Create Games  games made by players' studios (kult-create GET /games/public)
//   Leaderboard        the KP and AI Arena ELO boards (js/arena.js)
//   Kult Points        the top bar's KP balance; opens the KP board
//
// A game plays full-screen inside the OS. The art is drawn in CSS until the
// generated assets land (docs/GAME_HUB_ASSETS.md); each one that exists in
// art/world/manifest.json replaces its stand-in.

import { LEGACY_GAMES, HIGHWAY_MODES, GAMES, archetype, rankOf } from "./data.js";
import { kultApi, createApi, session, config } from "./kult.js";

export const FOLDERS = [
  { id: "ai", color: "#5ec8f2" },
  { id: "legacy", color: "#f7a35c" },
  { id: "create", color: "#ff7eb6" }
];

// Folder icons drawn in SVG until hubos-folder-<id>-closed/open exist.
const EMBLEM = {
  ai: '<circle cx="47" cy="61" r="7"/><circle cx="73" cy="61" r="7"/><path d="M58 52l-3 9h6l-3 9" class="bolt"/>',
  legacy: '<rect x="48" y="50" width="20" height="22" rx="2"/><path d="M52 54h12M52 58h12"/><circle cx="77" cy="66" r="4"/><path d="M77 62v-8"/>',
  create: '<path d="M44 62c0-5 4-8 9-8h14c5 0 9 3 9 8l2 8c1 4-4 6-6 3l-3-4H51l-3 4c-2 3-7 1-6-3z"/><path d="M60 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" class="spark"/>'
};
const folderSvg = (id) => `<svg viewBox="0 0 120 100" aria-hidden="true">
  <path class="f-back" d="M10 18h32l8 8h60v62H10z"/>
  <g class="f-cards"><rect class="c c1" x="24" y="22" width="40" height="30" rx="3"/><rect class="c c2" x="40" y="18" width="40" height="30" rx="3"/><rect class="c c3" x="56" y="22" width="40" height="30" rx="3"/></g>
  <path class="f-front" d="M6 38h108l-6 52H12z"/>
  <path class="f-edge" d="M6 38h108"/>
  <g class="f-emb">${EMBLEM[id]}</g>
</svg>`;
const ICON = {
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2 2 0 0 0 0 4h3M16 6h3a2 2 0 0 1 0 4h-3M12 13v4M8 20h8l-1-3H9z"/>',
  kp: '<circle cx="12" cy="12" r="8"/><path d="M12 7l1.4 3.6L17 12l-3.6 1.4L12 17l-1.4-3.6L7 12l3.6-1.4z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  full: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  newtab: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>'
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
// A Kult Create game's stand-in cover colour: one of a few hues that suit the OS, picked by id.
const HUES = [330, 275, 200, 28, 168, 248, 350, 45];
const hue = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return HUES[h % HUES.length]; };
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n));

export function createHubOS(ctx) {
  const { el, t, sound, toast, wart } = ctx;
  const $ = (id) => document.getElementById(id);
  const show = (id, on = true) => { $(id).hidden = !on; };
  const svgEl = (tag, attrs, html) => { const n = el(tag, attrs); n.innerHTML = html; return n; };
  // replaceChildren would print a skipped (null) child as the text "null".
  const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter(Boolean));
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  let pane = null, booted = false, bootT = null, ready = Promise.resolve();
  let legacy = null, legacyAt = 0, created = null, createdAt = 0;

  // ---------------------------------------------------------------- art
  // A generated asset, once imported, replaces its CSS stand-in.
  function applyArt() {
    const root = $("hub");
    for (const [key, prop] of [["hubos-wallpaper", "--os-wall"], ["hubos-wallpaper-mobile", "--os-wall-m"], ["hubos-boot", "--os-boot"], ["kp-coin", "--os-kp"], ["hubos-create-cover", "--os-cc"]]) {
      const src = wart(key);
      if (src) root.style.setProperty(prop, `url("${src}")`); else root.style.removeProperty(prop);
    }
    root.classList.toggle("art-wall", Boolean(wart("hubos-wallpaper")));
    root.classList.toggle("art-boot", Boolean(wart("hubos-boot")));
  }
  const kpIcon = () => wart("kp-coin") || "art/world/token-kp.png";

  // ---------------------------------------------------------------- desktop
  function renderDesktop() {
    const count = { ai: GAMES.length, legacy: LEGACY_GAMES.length, create: created?.games?.length ?? null };
    $("os-folders").replaceChildren(...FOLDERS.map((f) => {
      const closed = wart(`hubos-folder-${f.id}-closed`), open = wart(`hubos-folder-${f.id}-open`);
      const art = closed ? el("span", { class: "f-art" }, el("img", { class: "f-closed", src: closed, alt: "", draggable: "false" }), open ? el("img", { class: "f-open", src: open, alt: "", draggable: "false" }) : null)
        : svgEl("span", { class: "f-art" }, folderSvg(f.id));
      return el("button", { type: "button", class: "os-folder", "data-folder": f.id, style: `--c:${f.color}`, onclick: () => openWin(f.id) },
        art,
        el("span", { class: "f-name" }, t(`os.f.${f.id}`)),
        el("span", { class: "f-sub" }, count[f.id] === null ? t(`os.f.${f.id}Sub`) : t("os.games", { n: count[f.id] })));
    }));
    $("os-apps").replaceChildren(
      el("button", { type: "button", class: "os-app", style: "--c:#f2c14e", onclick: () => openWin("board", "arena") }, svgEl("span", { class: "a-ic" }, icon("trophy")), el("span", {}, t("os.app.board"))),
      el("button", { type: "button", class: "os-app", style: "--c:#f2c14e", onclick: () => openWin("board", "kp") }, el("span", { class: "a-ic kp" }, el("img", { src: kpIcon(), alt: "" })), el("span", {}, t("os.app.kp"))));
  }

  // The top bar: who is playing, their Kult Points, the clock.
  function renderBar() {
    const p = ctx.player();
    const a = p?.agent;
    if (a) {
      const r = rankOf(a.elo);
      $("os-agent").replaceChildren(el("span", { class: "os-dot", style: `--c:${archetype(a.archetype).color}` }), el("b", {}, a.name),
        el("img", { src: `art/${r.badge}`, alt: "" }), el("span", { class: "muted" }, `${a.elo.toLocaleString()} ELO`));
    } else $("os-agent").replaceChildren();
    const kp = p?.balances?.kp, rank = p?.profile?.rank;
    $("os-kp-img").src = kpIcon();
    $("os-kp-n").textContent = kp === null || kp === undefined ? "—" : Math.round(kp).toLocaleString();
    $("os-kp-r").textContent = rank ? `#${Number(rank).toLocaleString()}` : "";
    $("os-kp").title = kp === null || kp === undefined ? t("os.kpOff") : t("os.kpTip");
  }
  const tickClock = () => { $("os-clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); };
  setInterval(() => { if (!$("hub").hidden) tickClock(); }, 1000);

  // ---------------------------------------------------------------- windows
  const PANES = { ai: "os-ai", legacy: "os-legacy", create: "os-create", board: "os-board" };
  const WIN_COLOR = { ai: "#5ec8f2", legacy: "#f7a35c", create: "#ff7eb6", board: "#f2c14e" };
  function openWin(id, mode, quiet = false) {
    if (pane !== id && !quiet) sound.play("open");
    pane = id;
    for (const [k, node] of Object.entries(PANES)) show(node, k === id);
    $("os-win").style.setProperty("--c", WIN_COLOR[id]);
    $("os-win-title").textContent = id === "board" ? t("os.app.board") : t(`os.f.${id}`);
    $("os-path").textContent = ` / ${$("os-win-title").textContent}`;
    show("os-win");
    $("os-win").classList.remove("in"); void $("os-win").offsetWidth; $("os-win").classList.add("in");
    $("os-win-body").scrollTop = 0;
    if (id === "ai") ctx.renderAi();
    if (id === "legacy") void renderLegacy();
    if (id === "create") void renderCreate();
    if (id === "board") void ctx.board($("os-board"), mode);
  }
  function closeWin(quiet = false) {
    if (!pane) return;
    if (pane === "ai") ctx.leaveAi();
    if (!quiet) sound.play("close");
    pane = null; show("os-win", false); $("os-path").textContent = "";
  }

  // ---------------------------------------------------------------- legacy games
  async function loadLegacy(force = false) {
    if (!force && legacy && Date.now() - legacyAt < 5 * 60_000) return legacy;
    const live = await kultApi.games().catch((e) => { console.warn("[kult-world] game catalog", e.message); return null; });
    const byId = new Map((live || []).map((g) => [g.id, g]));
    legacy = { offline: !live, list: LEGACY_GAMES.map((g) => ({ ...g, live: byId.get(g.id) || null })) };
    legacyAt = Date.now();
    return legacy;
  }
  const head = (key, extra = null) => el("div", { class: "os-head" },
    el("div", {}, el("p", { class: "eyebrow" }, t(`os.${key}.eyebrow`)), el("h2", { class: "place-title" }, t(`os.${key}.title`)), el("p", { class: "muted" }, t(`os.${key}.desc`))), extra);
  const coverImg = (src) => el("img", { src: `art/${src}`, alt: "", draggable: "false", loading: "lazy" });

  async function renderLegacy() {
    const body = $("os-legacy");
    if (!legacy) fill(body, head("legacy"), el("p", { class: "muted os-wait" }, t("os.loading")));
    const d = await loadLegacy();
    if (pane !== "legacy") return;
    fill(body, head("legacy"),
      d.offline ? el("p", { class: "os-note" }, t("os.catalogOff")) : null,
      el("div", { class: "os-grid" }, d.list.map((g, i) => {
        const live = g.live, kind = live?.download ? "download" : "browser";
        return el("button", { type: "button", class: "os-tile", style: `--c:${g.color};--i:${i}`, onclick: () => legacyDetail(g) },
          el("span", { class: "tl-cover" }, coverImg(g.cover), el("span", { class: `tl-kind ${kind}` }, t(`os.kind.${kind}`))),
          el("span", { class: "tl-plate" },
            el("span", { class: "tl-genre" }, t(`os.genre.${g.genre}`)),
            el("b", { class: "tl-name" }, g.name),
            el("span", { class: "tl-meta" }, live?.plays ? t("os.plays", { n: compact(live.plays) }) : t("os.f.legacySub"), live?.rating ? el("span", { class: "tl-star" }, `★ ${live.rating}`) : null)));
      })));
  }

  function legacyDetail(g) {
    sound.play("pop");
    const live = g.live, body = $("os-legacy");
    const actions = [];
    if (g.modes) {
      actions.push(el("p", { class: "label" }, t("os.hh.pick")),
        el("div", { class: "os-modes" }, HIGHWAY_MODES.map((m) => el("button", { type: "button", class: "os-mode", onclick: () => playLegacy(g, m) },
          el("b", {}, t(`os.hh.${m.id}`)), el("small", {}, t(`os.hh.${m.id}Sub`))))));
    } else if (live?.download) {
      actions.push(el("div", { class: "os-actions" },
        el("a", { class: "btn primary", href: live.url, target: "_blank", rel: "noopener", onclick: () => ctx.onPlay?.(g.name) }, svgEl("span", { class: "bi" }, icon("download")), t("os.download")),
        g.id === "robowars" ? el("button", { type: "button", class: "btn ghost", onclick: () => openWin("ai") }, t("os.robowarsAi")) : null),
        el("p", { class: "muted tiny" }, t("os.downloadNote")));
    } else if (live?.url) {
      actions.push(el("div", { class: "os-actions" }, el("button", { type: "button", class: "btn primary", onclick: () => playLegacy(g) }, svgEl("span", { class: "bi" }, icon("play")), t("os.play"))));
    } else {
      actions.push(el("p", { class: "os-note" }, t(legacy?.offline ? "os.catalogOff" : "os.noUrl")),
        el("button", { type: "button", class: "btn ghost small", onclick: async () => { await loadLegacy(true); const fresh = legacy.list.find((x) => x.id === g.id); legacyDetail(fresh); } }, svgEl("span", { class: "bi" }, icon("refresh")), t("os.retry")));
    }
    fill(body, 
      el("button", { type: "button", class: "os-crumb", onclick: () => { sound.play("pop"); void renderLegacy(); } }, svgEl("span", { class: "bi" }, icon("back")), t("os.allLegacy")),
      el("div", { class: "os-detail", style: `--c:${g.color}` },
        el("div", { class: "od-cover" }, coverImg(g.cover)),
        el("div", { class: "od-info" },
          el("span", { class: "tl-genre" }, t(`os.genre.${g.genre}`)),
          el("h2", { class: "place-title" }, g.name),
          el("p", {}, t(`os.lg.${g.id}`)),
          el("div", { class: "od-stats" },
            live?.plays ? el("span", {}, el("b", {}, live.plays.toLocaleString()), t("os.playsLabel")) : null,
            live?.rating ? el("span", {}, el("b", {}, `★ ${live.rating}`), t("os.rating")) : null,
            el("span", {}, el("b", {}, t(`os.kind.${live?.download ? "download" : "browser"}`)), t("os.runs"))),
          ...actions)));
    $("os-win-body").scrollTop = 0;
  }

  // The Kult backend's games take the player's Kult session in the URL, as
  // kult-games-v3 src/lib/buildGameIframeUrl.ts sends it.
  function gameUrl(raw, { mode, withSession }) {
    const u = new URL(raw);
    if (mode) u.searchParams.set("mode", mode);
    const wallet = session.kult?.walletAddress || session.wallet;
    if (withSession && wallet) u.searchParams.set("wallet", wallet);
    if (withSession && session.kult?.token) { u.searchParams.set("jwt", session.kult.token); u.searchParams.set("source", "browser"); }
    return u.href;
  }
  function playLegacy(g, mode = null) {
    const raw = mode ? mode.url : g.live?.url;
    if (!raw) return toast(t("os.noUrl"), "bad");
    const withSession = !ctx.isDemo();
    let src, newtab;
    if (g.engine === "zerodash") {
      const page = (s) => { const u = new URL("play/zerodash.html", location.href); u.searchParams.set("build", raw); if (s) { const w = session.kult?.walletAddress || session.wallet; if (w) u.searchParams.set("wallet", w); if (session.kult?.token) u.searchParams.set("jwt", session.kult.token); } return u.href; };
      src = page(withSession); newtab = page(false);
    } else { src = gameUrl(raw, { mode: mode?.id, withSession }); newtab = gameUrl(raw, { mode: mode?.id, withSession: false }); }
    openPlayer({ title: mode ? `${g.name} · ${t(`os.hh.${mode.id}`)}` : g.name, src, newtab, color: g.color });
    ctx.onPlay?.(g.name);
  }

  // ---------------------------------------------------------------- Kult Create games
  async function renderCreate(force = false) {
    const body = $("os-create");
    const make = el("button", { type: "button", class: "os-tile make", style: "--c:#ff7eb6;--i:0", onclick: () => ctx.goStudio() },
      svgEl("span", { class: "tl-cover mk" }, `<span class="mk-ic">${icon("plus")}</span>`),
      el("span", { class: "tl-plate" }, el("span", { class: "tl-genre" }, "KULT CREATE"), el("b", { class: "tl-name" }, t("os.make")), el("span", { class: "tl-meta" }, t("os.makeSub"))));
    if (force || !created || Date.now() - createdAt > 60_000) {
      if (!created) fill(body, head("create"), el("p", { class: "muted os-wait" }, t("os.loading")));
      try { created = { games: await createApi.games(30) }; createdAt = Date.now(); }
      // A down service can answer with an HTML page; only a short plain message is worth showing.
      catch (e) { const m = String(e.message || ""); created = { error: /<|^\s*$/.test(m) || m.length > 160 ? t("os.status", { n: e.status || "—" }) : m, games: null }; createdAt = 0; }
      renderDesktop();
    }
    if (pane !== "create") return;
    if (created.error) {
      const c = await config();
      fill(body, head("create"), el("div", { class: "os-empty" },
        el("b", {}, t("os.createOff")), el("p", { class: "muted" }, created.error),
        el("div", { class: "os-actions" },
          el("button", { type: "button", class: "btn primary small", onclick: () => renderCreate(true) }, svgEl("span", { class: "bi" }, icon("refresh")), t("os.retry")),
          el("a", { class: "btn ghost small", href: `${c.kultCreateUrl}/play`, target: "_blank", rel: "noopener" }, svgEl("span", { class: "bi" }, icon("newtab")), t("os.createSite")))));
      return;
    }
    const games = created.games;
    const coverArt = wart("hubos-create-cover");
    fill(body, head("create"),
      ctx.isDemo() ? el("p", { class: "os-note" }, t("os.createDemo")) : null,
      el("div", { class: "os-grid" }, make, games.map((g, i) => el("button", { type: "button", class: "os-tile", style: `--c:hsl(${hue(g.id)} 80% 70%);--h:${hue(g.id)};--i:${i + 1}`, onclick: () => playCreate(g) },
        el("span", { class: "tl-cover cc" }, coverArt ? el("img", { src: coverArt, alt: "", draggable: "false", loading: "lazy" }) : null,
          coverArt ? null : el("span", { class: "cc-mono", "aria-hidden": "true" }, (g.title.match(/[A-Za-z0-9一-鿿]/)?.[0] || "K").toUpperCase()), g.rank <= 3 ? el("span", { class: "tl-rank" }, `#${g.rank}`) : null),
        el("span", { class: "tl-plate" },
          el("span", { class: "tl-genre" }, g.studio ? t("os.by", { studio: g.studio }) : "KULT CREATE"),
          el("b", { class: "tl-name" }, g.title),
          el("span", { class: "tl-meta" }, t("os.plays", { n: compact(g.plays || 0) }), el("span", { class: "tl-star" }, `♥ ${compact(g.likes || 0)}`)))))),
      games.length ? null : el("p", { class: "muted os-wait" }, t("os.createEmpty")));
  }
  async function playCreate(g) {
    const url = g.playUrl || (ctx.isDemo() ? null : await createApi.playPage(g.id));
    if (!url) return toast(t("os.createDemoPlay"));
    openPlayer({ title: g.studio ? `${g.title} · ${t("os.by", { studio: g.studio })}` : g.title, src: url, newtab: url, color: `hsl(${hue(g.id)} 80% 70%)` });
    ctx.onPlay?.(g.title);
  }

  // ---------------------------------------------------------------- the game player
  function openPlayer({ title, src, newtab, color }) {
    sound.play("whoosh");
    $("os-player-title").textContent = title;
    $("os-newtab").href = newtab;
    $("os-player").style.setProperty("--c", color || "#5ec8f2");
    $("os-iframe").src = src;
    show("os-player");
    $("os-iframe").focus();
  }
  function closePlayer() {
    if ($("os-player").hidden) return false;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    $("os-iframe").src = "about:blank"; show("os-player", false); sound.play("close");
    return true;
  }
  $("os-player-close").addEventListener("click", closePlayer);
  $("os-full").addEventListener("click", () => { const p = $("os-player"); if (document.fullscreenElement) void document.exitFullscreen(); else void p.requestFullscreen?.().catch(() => {}); });

  // ---------------------------------------------------------------- open / close
  function open({ folder = null } = {}) {
    applyArt(); renderBar(); renderDesktop(); tickClock();
    closePlayer(); closeWin(true);
    show("hub");
    const screen = $("os-screen");
    clearTimeout(bootT);
    const boot = !booted && !reduced();
    booted = true;
    screen.classList.remove("on"); void screen.offsetWidth; screen.classList.add("on");
    show("os-boot", boot);
    let done;
    ready = new Promise((r) => { done = r; });
    const go = () => { show("os-boot", false); if (folder) openWin(folder); done(); };
    if (boot) { sound.play("whoosh"); bootT = setTimeout(go, 1150); } else go();
  }
  function close() {
    clearTimeout(bootT);
    closePlayer(); closeWin(true);
    show("hub", false);
  }
  // Escape and the back button step out one level: game, window, then the OS.
  function back() {
    if ($("hub").hidden) return false;
    if (closePlayer()) return true;
    if (pane === "legacy" && !$("os-legacy").querySelector(".os-grid")) { sound.play("pop"); void renderLegacy(); return true; }
    if (pane) { closeWin(); return true; }
    return false;
  }
  $("os-win-close").addEventListener("click", () => closeWin());
  $("os-kp").addEventListener("click", () => openWin("board", "kp"));
  $("os-back").addEventListener("click", () => back());

  function relabel() {
    if ($("hub").hidden) return;
    renderBar(); renderDesktop();
    if (pane) { const keep = pane; pane = null; openWin(keep, undefined, true); }
  }

  return { open, close, back, openWin, relabel, refresh: renderBar, get ready() { return ready; }, get pane() { return pane; }, get isOpen() { return !$("hub").hidden; } };
}
