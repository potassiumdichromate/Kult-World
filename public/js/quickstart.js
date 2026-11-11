// The quick start: the first thing a new player sees in the city. One card,
// four choices (Create, Play, Hire agents, Explore); each one takes the player
// straight to that experience with a step or two from Nova. It replaces the
// long guided tour, and the menu's Quick start opens it again.

const ICONS = {
  create: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" /><path d="M17 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />',
  play: '<rect x="3" y="8" width="18" height="10" rx="4" /><path d="M8 11v4M6 13h4M15 12.5h.01M17.5 14.5h.01" />',
  hire: '<circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M16 11h5M18.5 8.5v5" />',
  explore: '<circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" />'
};
export const CHOICES = [
  { id: "create", color: "#ff7eb6" },
  { id: "play", color: "#a98bff" },
  { id: "hire", color: "#4fd8ff" },
  { id: "explore", color: "#ffc94d" }
];

/** ctx: { el, t, sound, onPick(id), onSkip() } */
export function createQuickStart(ctx) {
  const { el, t, sound } = ctx;
  const root = el("div", { id: "qs", class: "qs", hidden: true, role: "dialog", "aria-modal": "true", "aria-labelledby": "qs-title" });
  document.body.append(root);
  let name = "";

  function render() {
    const opts = CHOICES.map((c, i) => el("button", { type: "button", class: "qs-opt", style: `--c:${c.color}`, onclick: () => pick(c.id) },
      el("span", { class: "qs-ico" }, svg(ICONS[c.id])),
      el("span", { class: "qs-txt" }, el("b", {}, t(`qs.${c.id}`)), el("span", {}, t(`qs.${c.id}Sub`))),
      el("kbd", {}, String(i + 1))));
    root.replaceChildren(el("div", { class: "qs-card glass" },
      el("div", { class: "qs-head" },
        el("img", { class: "qs-face", src: "art/ceo-tactician-portrait.png", alt: "" }),
        el("div", {}, el("p", { class: "eyebrow" }, t("qs.eyebrow")), el("h2", { id: "qs-title" }, t("qs.title", { name })), el("p", { class: "qs-lead" }, t("qs.lead")))),
      el("div", { class: "qs-grid" }, opts),
      el("div", { class: "qs-foot" },
        el("button", { type: "button", class: "qs-skip", onclick: () => skip() }, t("qs.skip")),
        el("span", { class: "muted tiny" }, t("qs.again")))));
  }
  function svg(paths) { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true"); s.innerHTML = paths; return s; }
  function open(agentName = name) {
    name = agentName; render(); root.hidden = false; sound.play("open");
    root.querySelector(".qs-opt")?.focus({ preventScroll: true });
  }
  function close() { root.hidden = true; }
  function pick(id) { close(); sound.play("whoosh"); ctx.onPick(id); }
  function skip() { close(); sound.play("close"); ctx.onSkip?.(); }
  addEventListener("keydown", (e) => {
    if (root.hidden) return;
    const c = CHOICES[Number(e.key) - 1];
    if (c) { e.preventDefault(); e.stopPropagation(); pick(c.id); }
    else if (e.key === "Escape") { e.stopPropagation(); skip(); }
  }, true);
  return { open, close, relabel: () => { if (!root.hidden) render(); }, get isOpen() { return !root.hidden; } };
}
