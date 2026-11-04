// The guided tutorial: Nova, the city guide, walks a new player from minting
// their agent through the city, one step at a time. A step spotlights one
// thing on screen (the rest is dimmed and blocked) and either waits for the
// player to do it or explains it with a Next button. Steps that send the
// player walking go quiet until they arrive.

const GUIDE = "art/ceo-tactician-portrait.png";
const ARROW = '<svg viewBox="0 0 48 60" aria-hidden="true"><path d="M17 2h14v30h13L24 58 4 32h13z" /></svg>';

/**
 * ctx: { el, t, sound, world, $, isOpen(id), inWorld(), minting(), togglePassport(open),
 *        closeAgentCard(), reward(), doneKey() }
 */
export function createTour(ctx) {
  const { el, t, sound, world, $ } = ctx;
  const steps = buildSteps(ctx);
  const hole = el("div", { class: "tour-hole" });
  const blocks = ["t", "l", "r", "b"].map((s) => el("div", { class: `tour-block ${s}`, onclick: nudge }));
  const arrow = el("div", { class: "tour-arrow" });
  arrow.innerHTML = ARROW;
  const text = el("p", { class: "tour-text", onclick: () => finishTyping() });
  const count = el("span", { class: "tour-count" });
  const next = el("button", { type: "button", class: "btn gold small tour-next", onclick: () => advance() });
  const skip = el("button", { type: "button", class: "tour-skip", onclick: () => stop(true) });
  const guide = el("div", { class: "tour-guide glass" },
    el("div", { class: "tour-face" }, el("img", { src: GUIDE, alt: "" }), el("span", { class: "tour-name" }, "NOVA")),
    el("div", { class: "tour-say" }, el("div", { class: "tour-top" }, el("b", {}, ""), count), text, el("div", { class: "tour-btns" }, skip, next)));
  const root = el("div", { id: "tour", class: "tour", hidden: true }, hole, ...blocks, arrow, guide);
  document.body.append(root);

  let i = -1, step = null, enteredAt = 0, doneAt = 0, raf = 0, typing = null, full = "", scrolled = false;

  function start(fromId = steps[0].id) {
    i = Math.max(0, steps.findIndex((s) => s.id === fromId));
    root.hidden = false;
    if (!raf) raf = requestAnimationFrame(frame);
    enter();
  }
  function stop(skipped = false) {
    if (!step) return;
    step.leave?.();
    step = null; i = -1; root.hidden = true;
    cancelAnimationFrame(raf); raf = 0; clearInterval(typing);
    try { localStorage.setItem(ctx.doneKey(), skipped ? "skipped" : "done"); } catch { /* storage optional */ }
    if (skipped) sound.play("close");
  }
  function enter() {
    step = steps[i];
    if (step.skip?.()) return advance();
    enteredAt = performance.now(); doneAt = 0; scrolled = false;
    root.className = `tour${step.target || step.free ? "" : " center"}${step.free ? " free" : ""}`;
    guide.querySelector(".tour-top b").textContent = t(step.title || "tour.guide");
    const phase = steps.filter((s) => s.phase === step.phase);
    count.textContent = `${phase.indexOf(step) + 1} / ${phase.length}`;
    next.hidden = !step.next; next.textContent = t(step.nextKey || "tour.next");
    skip.hidden = Boolean(step.last); skip.textContent = t("tour.skip");
    guide.classList.remove("in"); void guide.offsetWidth; guide.classList.add("in");
    sound.play("pop");
    step.enter?.();
    type(t(`tour.${step.id}`));
  }
  function advance() {
    if (!step) return;
    step.leave?.();
    if (step.last || i + 1 >= steps.length) return stop(false);
    i++; enter();
  }
  function goto(id) { step?.leave?.(); i = steps.findIndex((s) => s.id === id); enter(); }

  // Nova's lines type themselves out; a click shows the rest at once.
  function type(s) {
    clearInterval(typing); full = s;
    let n = 0;
    text.textContent = "";
    typing = setInterval(() => {
      n += 2; text.textContent = full.slice(0, n);
      if (n % 6 === 0) sound.play("type");
      if (n >= full.length) clearInterval(typing);
    }, 22);
  }
  function finishTyping() { clearInterval(typing); text.textContent = full; }
  // A click on the dimmed part: the arrow jumps to say "here".
  function nudge() { arrow.classList.remove("nudge"); void arrow.offsetWidth; arrow.classList.add("nudge"); sound.play("error"); }

  function rectOf(target) {
    const r = typeof target === "function" ? target() : unionRect(target);
    if (!r || r.width < 2 || r.height < 2) return null;
    if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null;
    return r;
  }
  function unionRect(sel) {
    const rs = [...document.querySelectorAll(sel)].map((n) => n.getBoundingClientRect()).filter((r) => r.width && r.height);
    if (!rs.length) return null;
    const left = Math.min(...rs.map((r) => r.left)), top = Math.min(...rs.map((r) => r.top));
    const right = Math.max(...rs.map((r) => r.right)), bottom = Math.max(...rs.map((r) => r.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!step) return;
    const s = step;
    if (s.lost?.() && now - enteredAt > 600) return goto(s.fallback);
    if (s.done && now - enteredAt > 400 && s.done()) {
      doneAt ||= now;
      if (now - doneAt >= (s.doneDelay ?? 250)) { sound.play("coin"); return advance(); }
    }
    const quiet = Boolean(s.quiet?.());
    root.classList.toggle("quiet", quiet);
    if (quiet) return;
    // A target below the fold (a phone's mint form) scrolls into view once.
    if (typeof s.target === "string" && !scrolled) {
      const n = document.querySelector(s.target), b = n?.getBoundingClientRect();
      if (b?.height && (b.top < 60 || b.bottom > innerHeight - 20)) { n.scrollIntoView({ block: "center", behavior: "smooth" }); scrolled = true; }
    }
    const r = s.target ? rectOf(s.target) : null;
    layout(r, s);
  }

  function layout(r, s) {
    const W = innerWidth, H = innerHeight;
    const pad = s.pad ?? 8;
    // The spotlight (and, for steps the player acts on, a hole in the blockers).
    if (r) {
      const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
      Object.assign(hole.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, borderRadius: s.round ? "50%" : "18px" });
      hole.hidden = false;
      const open = !s.next || s.interactive;
      place(blocks[0], 0, 0, W, open ? y : H);
      place(blocks[1], 0, y, x, h); place(blocks[2], x + w, y, W - x - w, h);
      place(blocks[3], 0, y + h, W, H - y - h);
      for (const b of blocks.slice(1)) b.hidden = !open;
      // The arrow points at it from the roomier side; at a tall target, from beside it.
      if (h > H * 0.55) {
        const fromRight = x + w + 64 < W;
        arrow.style.left = `${fromRight ? x + w + 4 : x - 52}px`; arrow.style.top = `${y + h / 2 - 30}px`;
        arrow.dataset.dir = fromRight ? "left" : "right";
      } else {
        const below = r.top + r.height / 2 < H * 0.45;
        arrow.style.left = `${Math.min(W - 40, Math.max(16, r.left + r.width / 2 - 24))}px`;
        arrow.style.top = below ? `${y + h + 6}px` : `${y - 66}px`;
        arrow.dataset.dir = below ? "up" : "down";
      }
      arrow.hidden = Boolean(s.noArrow);
      // Nova sits away from it.
      guide.classList.toggle("top", r.top + r.height / 2 > H * 0.5 && !s.guideBottom);
      guide.classList.toggle("right", r.left + r.width / 2 < W * 0.5);
    } else {
      hole.hidden = true; arrow.hidden = true;
      place(blocks[0], 0, 0, W, H);
      for (const b of blocks.slice(1)) b.hidden = true;
      guide.classList.remove("top", "right");
    }
    blocks[0].hidden = false;
  }
  const place = (n, x, y, w, h) => Object.assign(n.style, { left: `${x}px`, top: `${y}px`, width: `${Math.max(0, w)}px`, height: `${Math.max(0, h)}px` });

  addEventListener("keydown", (e) => {
    if (!step || root.classList.contains("quiet")) return;
    if (e.key === "Enter" && step.next && !e.target.closest("input, textarea, select")) { e.preventDefault(); advance(); }
  });

  return {
    start,
    stop,
    get running() { return Boolean(step); },
    /** After a language switch: the current step in the new language. */
    relabel() {
      if (!step) return;
      guide.querySelector(".tour-top b").textContent = t(step.title || "tour.guide");
      next.textContent = t(step.nextKey || "tour.next"); skip.textContent = t("tour.skip");
      clearInterval(typing); full = t(`tour.${step.id}`); text.textContent = full;
    },
    /** Starts the tour unless this player has finished or skipped it. */
    offer(fromId, force = false) {
      if (step) return;
      let seen = null;
      try { seen = localStorage.getItem(ctx.doneKey()); } catch { /* storage optional */ }
      if (!seen || force) start(fromId);
    }
  };
}

// ------------------------------------------------------------------ the steps
// Text is t(`tour.<id>`). target: a selector (several are joined) or a function
// returning a rect. next: explained with a Next button (the target can't be
// clicked unless interactive). done: waits for the player to do it. quiet: hides
// the tour while the player walks or a screen loads. lost + fallback: the
// player closed what the step was showing, so go back a step.
function buildSteps(c) {
  const { $, world } = c;
  const open = (id) => c.isOpen(id);
  const walking = () => Boolean(world.player?.walking);
  const mintQuiet = () => $("mint").hidden || c.minting();
  const playerRect = () => {
    const p = world.player && world.screenAt(world.player, 0.95);
    return p ? { left: p.x - 60, top: p.y - 30, width: 120, height: 130, right: p.x + 60, bottom: p.y + 100 } : null;
  };
  const groundRect = () => {
    const p = world.player && world.screenAt(world.player, 0.95);
    if (!p) return null;
    const x = Math.min(innerWidth - 80, p.x + 170), y = Math.min(innerHeight - 160, p.y + 150);
    return { left: x - 30, top: y - 30, width: 60, height: 60, right: x + 30, bottom: y + 30 };
  };
  // The city agent nearest the player that's on screen (but clear of it); the
  // same one while it stays in view.
  let buddy = null;
  const agentRect = () => {
    const me = world.player && world.screenAt(world.player, 0.95);
    let at = buddy && world.screenAt(buddy, 0.8);
    if (!at && me) {
      if (buddy) buddy.paused = false;
      buddy = null;
      let best = Infinity;
      for (const a of world.agents.values()) {
        const p = !a.isPlayer && world.screenAt(a, 0.8), d = p ? Math.hypot(p.x - me.x, p.y - me.y) : Infinity;
        if (d > 130 && d < best) { best = d; buddy = a; at = p; }
      }
      // It waits for the player to tap it.
      if (buddy) { buddy.paused = true; buddy.path = []; }
    }
    return at ? { left: at.x - 45, top: at.y - 10, width: 90, height: 110, right: at.x + 45, bottom: at.y + 100 } : null;
  };
  const dock = (k) => `#dock [data-goto="${k}"]`;
  let walked = false, met = false;
  return [
    // Minting: from the character select to the city.
    { id: "mint-hello", phase: "mint", next: true, nextKey: "tour.letsgo", quiet: mintQuiet },
    { id: "mint-arch", phase: "mint", target: "#mint-archetypes", next: true, interactive: true, quiet: mintQuiet },
    { id: "mint-clan", phase: "mint", target: "#mint-clans", next: true, interactive: true, quiet: mintQuiet },
    { id: "mint-name", phase: "mint", target: "#cs-form .name-row", next: true, interactive: true, quiet: mintQuiet },
    { id: "mint-go", phase: "mint", target: "#mint-form .cs-mint", done: c.inWorld, doneDelay: 1800, quiet: mintQuiet },

    // The city.
    { id: "w-arrive", phase: "world", target: playerRect, round: true, next: true, guideBottom: true },
    { id: "w-card", phase: "world", target: "#hud-player", next: true },
    { id: "w-money", phase: "world", target: "#topbar .pill", next: true },
    { id: "w-walk", phase: "world", target: groundRect, round: true, free: true,
      enter: () => { walked = false; }, done: () => (walked ||= walking()), doneDelay: 1400 },
    { id: "w-map", phase: "world", target: "#minimap-wrap", next: true },
    { id: "w-hub-go", phase: "world", target: dock("hub"), done: () => open("hub"), doneDelay: 700, quiet: walking },
    { id: "w-hub", phase: "world", target: "#game-grid", next: true, lost: () => !open("hub"), fallback: "w-hub-go" },
    { id: "w-hub-close", phase: "world", target: "#hub-close", done: () => !open("hub") },
    { id: "w-park-go", phase: "world", target: dock("park"), done: () => open("park"), doneDelay: 700, quiet: walking },
    { id: "w-park", phase: "world", target: "#biz-grid", next: true, lost: () => !open("park"), fallback: "w-park-go" },
    { id: "w-okx", phase: "world", target: "#okx-owner-btn", next: true, lost: () => !open("park"), fallback: "w-park-go" },
    { id: "w-park-close", phase: "world", target: "#park .close", done: () => !open("park") },
    { id: "w-market-go", phase: "world", target: dock("market"), done: () => open("market"), doneDelay: 700, quiet: walking },
    { id: "w-market", phase: "world", target: "#market-tabs", next: true, lost: () => !open("market"), fallback: "w-market-go" },
    { id: "w-market-close", phase: "world", target: "#market .close", done: () => !open("market") },
    { id: "w-pass-go", phase: "world", target: '#dock [data-act="passport"]', done: () => $("passport").classList.contains("open"), doneDelay: 600 },
    { id: "w-pass", phase: "world", target: "#passport-body", pad: 0, next: true, lost: () => !$("passport").classList.contains("open"), fallback: "w-pass-go",
      leave: () => c.togglePassport(false) },
    { id: "w-quests", phase: "world", target: "#quest-tracker", next: true, skip: () => $("quest-tracker").hidden },
    // Quiet while the player reads an agent's card; done once they close it.
    { id: "w-agents", phase: "world", target: agentRect, round: true, free: true, next: true, nextKey: "tour.later",
      enter: () => { buddy = null; met = false; }, leave: () => { if (buddy) buddy.paused = false; },
      quiet: () => { const on = !$("agent-card").hidden; met ||= on; return on; }, done: () => met && $("agent-card").hidden },
    { id: "w-done", phase: "world", next: true, nextKey: "tour.finish", last: true, title: "tour.doneTitle",
      enter: () => { c.closeAgentCard(); c.reward(); } }
  ];
}
