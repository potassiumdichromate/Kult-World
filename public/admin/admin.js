// The game build editor. Signs in with the same Kult login as Kult World
// (Privy, then a wallet signature for the Kult backend), loads every game's
// build fields from GET /api/admin/games and saves one game at a time with
// PUT /api/admin/games/:identification. The backend checks the wallet against
// its ADMIN_WALLETS and validates and records every change.
import { config, session, kultAdmin, isDemo, ApiError } from "../js/kult.js";
import { HIGHWAY_MODES } from "../js/data.js";

const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
let toastT;
function toast(msg, kind = "") { const n = $("toast"); n.textContent = msg; n.className = kind; n.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { n.hidden = true; }, 3800); }
const short = (w) => (w ? `${w.slice(0, 6)}…${w.slice(-4)}` : "");
const ago = (iso) => { const s = Math.max(1, (Date.now() - Date.parse(iso)) / 1000); return s < 90 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };
const isHttps = (v) => { try { return new URL(v).protocol === "https:"; } catch { return false; } };

// ------------------------------------------------------------------ sign-in
async function start() {
  await config();
  renderWho();
  if (!session.kult?.token) return signInView();
  await load();
}
function renderWho() {
  const w = session.kult?.walletAddress;
  $("who").replaceChildren(...(w ? [el("span", {}, isDemo() ? "Demo · " : "", short(w)), el("button", { type: "button", class: "btn small ghost", onclick: signOut }, "Sign out")] : []));
}
function signInView(message = "") {
  $("app").replaceChildren(el("div", { class: "note" },
    el("b", {}, "Sign in with an admin wallet"),
    el("p", {}, "Use the same KULT login as Kult World. Only wallets listed in the Kult backend's ADMIN_WALLETS can change builds."),
    message ? el("p", { class: "err" }, message) : null,
    el("button", { type: "button", class: "btn primary", onclick: signIn }, "Sign in")));
}
async function signIn(e) {
  const b = e?.currentTarget; if (b) b.disabled = true;
  try {
    await session.signIn();
    if (!session.kult?.token) throw new Error("The Kult backend sign-in didn't finish. Try again.");
    renderWho(); await load();
  } catch (err) { signInView(err.message); }
}
async function signOut() { await session.signOut(); renderWho(); signInView(); }

// ------------------------------------------------------------------ games
async function load() {
  $("app").replaceChildren(el("p", { class: "intro" }, "Loading the games…"));
  let games;
  try { games = await kultAdmin.games(); }
  catch (e) {
    if (e instanceof ApiError && e.status === 401) return signInView("Your session expired. Sign in again.");
    if (e instanceof ApiError && e.status === 403) {
      return $("app").replaceChildren(el("div", { class: "note" }, el("b", {}, "This wallet isn't an admin"),
        el("p", {}, `${session.kult?.walletAddress} isn't in the Kult backend's ADMIN_WALLETS. Add it there (comma-separated), redeploy, then reload this page.`)));
    }
    return $("app").replaceChildren(el("div", { class: "note" }, el("b", {}, "Couldn't load the games"), el("p", {}, e.message),
      el("button", { type: "button", class: "btn", onclick: load }, "Try again")));
  }
  $("app").replaceChildren(...games.map(card));
}

function card(g) {
  const saved = { url: g.url || "", playUrl: g.playUrl || "", downloadUrl: g.downloadUrl || "", isDownloadable: Boolean(g.isDownloadable), modes: (g.modes || []).map((m) => ({ id: m.id, name: m.name || "", url: m.url })) };
  let state = structuredClone(saved);
  const root = el("section", { class: "card" });
  const err = el("span", { class: "err" });
  const save = el("button", { type: "button", class: "btn primary", disabled: true, onclick: () => submit() }, "Save");
  const reset = el("button", { type: "button", class: "btn ghost", hidden: true, onclick: () => { state = structuredClone(saved); render(); } }, "Undo changes");

  const dirty = () => JSON.stringify(state) !== JSON.stringify(saved);
  const changed = () => {
    const d = dirty(); root.classList.toggle("dirty", d); save.disabled = !d; reset.hidden = !d; err.textContent = "";
  };
  const field = (key, label, hint, optional) => {
    const input = el("input", { type: "url", value: state[key], placeholder: optional ? "(not set)" : "https://…", spellcheck: "false" });
    const test = el("a", { class: "btn small", target: "_blank", rel: "noopener", href: state[key] || null }, "Open ↗");
    input.addEventListener("input", () => {
      state[key] = input.value.trim();
      input.classList.toggle("bad", Boolean(state[key]) && !isHttps(state[key]));
      if (isHttps(state[key])) test.href = state[key]; else test.removeAttribute("href");
      changed();
    });
    return el("div", { class: "field" }, el("label", {}, label, el("small", {}, hint)), input, test);
  };

  function modesBlock() {
    const list = el("div");
    const draw = () => {
      list.replaceChildren(...state.modes.map((m, i) => {
        const id = el("input", { type: "text", value: m.id, placeholder: "id (one-way)", spellcheck: "false" });
        const name = el("input", { type: "text", value: m.name, placeholder: "Name (optional)" });
        const url = el("input", { type: "url", value: m.url, placeholder: "https://…/index.html", spellcheck: "false" });
        const test = el("a", { class: "btn small", target: "_blank", rel: "noopener", href: isHttps(m.url) ? m.url : null }, "Open ↗");
        id.addEventListener("input", () => { m.id = id.value.trim(); id.classList.toggle("bad", !/^[a-z0-9-]{1,40}$/.test(m.id)); changed(); });
        name.addEventListener("input", () => { m.name = name.value.trim(); changed(); });
        url.addEventListener("input", () => { m.url = url.value.trim(); url.classList.toggle("bad", Boolean(m.url) && !isHttps(m.url)); if (isHttps(m.url)) test.href = m.url; else test.removeAttribute("href"); changed(); });
        return el("div", { class: "mode" }, id, name, url, test, el("button", { type: "button", class: "btn small ghost", title: "Remove", onclick: () => { state.modes.splice(i, 1); draw(); changed(); } }, "✕"));
      }));
    };
    draw();
    const builtIn = g.identification === "highwayhustle" && !state.modes.length;
    return el("div", { class: "modes" },
      el("h3", {}, "Builds per mode"),
      el("p", {}, "Optional. A game with one build per mode (Highway Hustle) lists them here; players pick a mode before playing. When this is empty, Kult World uses its built-in list for Highway Hustle."),
      list,
      el("div", { class: "actions", style: "justify-content:flex-start;margin-top:4px" },
        el("button", { type: "button", class: "btn small", onclick: () => { state.modes.push({ id: "", name: "", url: "" }); draw(); changed(); } }, "+ Add a mode"),
        builtIn ? el("button", { type: "button", class: "btn small", onclick: () => { state.modes = HIGHWAY_MODES.map((m) => ({ id: m.id, name: "", url: m.url })); draw(); changed(); } }, "Start from Kult World's built-in four") : null));
  }

  async function submit() {
    // Send only what changed; the backend validates again.
    const body = {};
    for (const k of ["url", "playUrl", "downloadUrl", "isDownloadable"]) if (JSON.stringify(state[k]) !== JSON.stringify(saved[k])) body[k] = state[k];
    if (JSON.stringify(state.modes) !== JSON.stringify(saved.modes)) body.modes = state.modes.map((m) => ({ id: m.id, url: m.url, ...(m.name ? { name: m.name } : {}) }));
    if ("url" in body && !isHttps(body.url)) { err.textContent = "The build link must start with https://"; return; }
    if (body.modes?.some((m) => !/^[a-z0-9-]{1,40}$/.test(m.id) || !isHttps(m.url))) { err.textContent = "Each mode needs an id (lowercase, digits, dashes) and an https:// link."; return; }
    save.disabled = true; save.textContent = "Saving…";
    try {
      const updated = await kultAdmin.updateGame(g.identification, body);
      Object.assign(g, updated);
      Object.assign(saved, { url: g.url || "", playUrl: g.playUrl || "", downloadUrl: g.downloadUrl || "", isDownloadable: Boolean(g.isDownloadable), modes: (g.modes || []).map((m) => ({ id: m.id, name: m.name || "", url: m.url })) });
      state = structuredClone(saved);
      toast(`${g.name} saved. Players get the new build on their next play.`, "good");
      render();
    } catch (e) {
      save.textContent = "Save"; save.disabled = false;
      err.textContent = e instanceof ApiError && e.status === 403 ? "This wallet isn't an admin." : e.message;
      toast(`${g.name} wasn't saved.`, "bad");
    }
  }

  function render() {
    save.textContent = "Save";
    const dl = el("input", { type: "checkbox", checked: state.isDownloadable || null });
    dl.addEventListener("change", () => { state.isDownloadable = dl.checked; changed(); });
    root.replaceChildren(
      el("div", { class: "head" },
        el("h2", {}, g.name), el("span", { class: "id" }, g.identification),
        el("span", { class: `tag ${g.released ? "on" : "off"}` }, g.released ? "Released" : "Not released"),
        el("span", { class: "last" }, g.lastChange ? `Changed ${ago(g.lastChange.at)} by ${short(g.lastChange.by)}` : "No changes recorded")),
      field("url", "Build", "Play page, Unity build folder or download file", false),
      field("playUrl", "Play link override", "Used instead of Build for playing", true),
      field("downloadUrl", "Download override", "Used instead of Build for a download", true),
      el("div", { class: "field" }, el("label", {}, "Downloadable", el("small", {}, "A file to download (Robowars), not played in the browser")),
        el("label", { class: "toggle" }, dl, "Players download it")),
      modesBlock(),
      el("div", { class: "actions" }, err, reset, save));
    changed();
  }
  render();
  return root;
}

void start();
