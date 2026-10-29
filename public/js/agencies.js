// Kult agencies on OKX.AI: the real marketplace inside the Agentic
// Marketplace building. Unlike the rest of Kult World this talks to a live
// backend (a2a-marketplace-service, /v1/marketplace/agencies): every agency
// has an OKX.AI identity read from X Layer, publishes a service contract, and
// runs a real job: request → negotiate → agree → pay → execute → deliver →
// verify → settle. Nothing here is simulated; when the API is down the panel
// says so.

const STEPS = ["discover", "request", "negotiate", "authorize", "execute", "deliver", "verify", "settle"];
const SAFE_URL = /^https?:\/\//;
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const money = (n) => `${Number(n).toFixed(2)} USDT`;

export function createAgencies(ctx) {
  const { el, t, toast, sound, burst, onJobAccepted, customer } = ctx;
  const $ = (id) => document.getElementById(id);
  const s = { api: null, list: null, paymentMode: "demo", error: null, room: null, pollT: null };

  // ------------------------------------------------------------------ api
  async function apiBase() {
    if (s.api) return s.api;
    const q = new URLSearchParams(location.search).get("api");
    if (q) return (s.api = q.replace(/\/$/, ""));
    try { const c = await fetch("config.json", { cache: "no-store" }).then((r) => r.json()); if (c.agencyApi) return (s.api = c.agencyApi.replace(/\/$/, "")); } catch { /* fall through */ }
    return (s.api = "https://aiarena-gateway.onrender.com/v1/marketplace/agencies");
  }
  async function api(path, opts = {}) {
    const base = await apiBase();
    const res = await fetch(`${base}${path}`, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
    return data;
  }
  const remember = (agencyId, id) => { try { id ? localStorage.setItem(`kw.eng.${agencyId}`, id) : localStorage.removeItem(`kw.eng.${agencyId}`); } catch { /* storage optional */ } };
  const recall = (agencyId) => { try { return localStorage.getItem(`kw.eng.${agencyId}`); } catch { return null; } };

  // ------------------------------------------------------------------ list
  async function load() {
    s.error = null;
    try { const r = await api("/"); s.list = r.agencies; s.paymentMode = r.paymentMode; }
    catch (e) { s.error = e.message; s.list = null; }
  }

  function okxBadge(okx) {
    if (!okx) return el("div", { class: "ag-okx off" }, el("span", { class: "dot" }), t("ag.okx.none"));
    if (okx.status !== "linked") return el("div", { class: "ag-okx off" }, el("span", { class: "dot" }), t(okx.status === "not-found" ? "ag.okx.missing" : "ag.okx.unreachable", { id: okx.agentId }));
    return el("div", { class: "ag-okx" },
      okx.image && SAFE_URL.test(okx.image) ? el("img", { src: okx.image, alt: "" }) : el("span", { class: "dot" }),
      el("div", {}, el("b", {}, `OKX.AI #${okx.agentId}`), el("small", {}, `${okx.name} · ${t("ag.okx.owner")} ${short(okx.owner)}`)));
  }

  function repLine(r) {
    if (!r || !r.jobsDelivered) return t("ag.rep.none");
    return [t("ag.rep.jobs", { n: r.jobsDelivered }), r.averageRating ? `★ ${r.averageRating}` : null, r.averageDeliverySeconds ? t("ag.rep.time", { n: Math.max(1, Math.round(r.averageDeliverySeconds / 60)) }) : null].filter(Boolean).join(" · ");
  }

  async function renderList() {
    const panel = $("agency-panel");
    panel.replaceChildren(el("div", { class: "ag-loading muted" }, t("ag.loading")));
    await load();
    if (s.error) {
      panel.replaceChildren(el("div", { class: "ag-error" }, el("b", {}, t("ag.offline")), el("small", { class: "muted" }, s.error), el("button", { type: "button", class: "btn small", onclick: renderList }, t("ag.retry"))));
      return;
    }
    const mode = el("div", { class: `ag-mode ${s.paymentMode}` }, el("span", { class: "dot" }), t(s.paymentMode === "x402" ? "ag.mode.live" : "ag.mode.demo"));
    panel.replaceChildren(mode, el("div", { class: "agency-grid" }, s.list.map((a) => el("div", { class: "agency-card", style: `--c:${a.color}` },
      el("div", { class: "ag-top" }, el("span", { class: "kind" }, a.vertical), a.service.negotiable ? el("span", { class: "kind", style: "--c:#ffc94d" }, t("ag.negotiable")) : null),
      el("h3", {}, a.name),
      el("p", { class: "muted small" }, a.tagline),
      el("div", { class: "ag-svc" }, el("b", {}, a.service.name), el("small", { class: "muted" }, a.service.summary)),
      okxBadge(a.okx),
      el("div", { class: "ag-foot" },
        el("div", {}, el("b", {}, a.service.price.from === a.service.price.to ? money(a.service.price.from) : `${a.service.price.from}–${a.service.price.to} USDT`),
          el("small", { class: "muted" }, `${t("ag.sla", { n: a.service.slaMinutes })} · ${repLine(a.reputation)}`)),
        el("button", { type: "button", class: "btn primary small", onclick: () => openRoom(a.id) }, t("ag.hire")))))));
  }

  // ------------------------------------------------------------------ room
  function stepState(e) {
    const st = e?.status;
    const at = !e ? 1 : { quoted: 2, agreed: 3, paid: 4, executing: 4, delivered: 6, accepted: 8, rejected: 6, failed: 4, cancelled: 2 }[st] ?? 1;
    return STEPS.map((k, i) => {
      if (st === "delivered" && k === "settle" && e.payment?.settled) return "done";
      if ((st === "rejected" && k === "verify") || (st === "failed" && k === "execute") || (st === "cancelled" && k === "negotiate")) return "bad";
      return i < at ? "done" : i === at ? "now" : "todo";
    });
  }

  function stepsBar(e) {
    const states = stepState(e);
    return el("ol", { class: "ag-steps" }, STEPS.map((k, i) => el("li", { class: states[i] }, el("i", {}, String(i + 1)), t(`ag.step.${k}`))));
  }

  async function openRoom(agencyId) {
    stopPoll();
    show("market-home", false); show("agency-room", true);
    const room = $("agency-room");
    room.replaceChildren(el("div", { class: "muted" }, t("ag.loading")));
    try {
      const agency = await api(`/${agencyId}`);
      let engagement = null;
      const prev = recall(agencyId);
      if (prev) { try { engagement = await api(`/engagements/${prev}`); } catch { remember(agencyId, null); } }
      if (engagement && ["accepted", "rejected", "cancelled", "failed"].includes(engagement.status)) engagement = null;
      s.room = { agency, engagement, showContract: false };
      sound.play("open");
      renderRoom();
    } catch (e) {
      room.replaceChildren(backBtn(), el("div", { class: "ag-error" }, el("b", {}, t("ag.offline")), el("small", { class: "muted" }, e.message)));
    }
  }

  function backBtn() {
    return el("button", { type: "button", class: "btn ghost small", onclick: () => { stopPoll(); s.room = null; show("agency-room", false); show("market-home", true); renderList(); } }, `‹ ${t("ag.back")}`);
  }
  const show = (id, on) => { $(id).hidden = !on; };

  function renderRoom() {
    const { agency: a, engagement: e } = s.room;
    const c = a.contract;
    // Toggled in place, not by re-rendering, so a half-filled form survives.
    const contract = el("pre", { class: "ar-contract", hidden: !s.room.showContract }, JSON.stringify(c, null, 2));
    const toggle = el("button", { type: "button", class: "btn ghost small", onclick: () => {
      s.room.showContract = !s.room.showContract; contract.hidden = !s.room.showContract;
      toggle.textContent = t(s.room.showContract ? "ag.contract.hide" : "ag.contract.show");
    } }, t(s.room.showContract ? "ag.contract.hide" : "ag.contract.show"));
    const head = el("div", { class: "ar-head", style: `--c:${a.color}` },
      el("div", {}, el("span", { class: "kind" }, a.vertical), el("h2", { class: "place-title" }, a.name), el("p", { class: "muted small" }, c.summary)),
      el("div", { class: "ar-side" }, okxBadge(a.okx), toggle));
    const body = !e ? requestForm(a) : jobView(a, e);
    $("agency-room").replaceChildren(backBtn(), head, contract, stepsBar(e), body);
  }

  // request form, generated from the service contract's input_schema
  function requestForm(a) {
    const schema = a.contract.input_schema;
    const fields = Object.entries(schema.properties).map(([key, f]) => {
      const id = `agf-${key}`;
      const input = f.enum
        ? el("select", { id, name: key }, f.enum.map((v, i) => el("option", { value: v, selected: v === f.default ? true : null }, f.enumLabels?.[i] ?? v)))
        : f["x-widget"] === "textarea"
          ? el("textarea", { id, name: key, rows: 3, maxlength: f.maxLength, placeholder: f.description || "" })
          : el("input", { id, name: key, type: "text", maxlength: f.maxLength, placeholder: f.description || "" });
      return el("label", { class: `ag-field${f["x-widget"] === "textarea" ? " wide" : ""}`, for: id }, el("span", {}, f.title, schema.required.includes(key) ? " *" : ""), input);
    });
    const priceTag = el("b", {}, "…");
    const form = el("form", { class: "ag-form" }, fields,
      el("div", { class: "ag-form-foot" },
        el("div", {}, el("small", { class: "muted" }, t("ag.listprice")), " ", priceTag, el("small", { class: "muted" }, ` · ${t("ag.sla", { n: a.contract.execution_policy.slaMinutes })}`)),
        el("button", { type: "submit", class: "btn primary" }, t("ag.send"))),
      el("p", { class: "tiny muted" }, a.contract.negotiation_policy.note, a.contract.disclaimer ? ` ${a.contract.disclaimer}` : ""));
    const values = () => Object.fromEntries(new FormData(form).entries());
    const quote = async () => { try { const q = await api(`/${a.id}/quote`, { method: "POST", body: { input: values() } }); priceTag.textContent = money(q.price); } catch { priceTag.textContent = "—"; } };
    form.addEventListener("change", quote);
    quote();
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
      try {
        const e = await api("/engagements", { method: "POST", body: { agencyId: a.id, input: values(), customer: customer() }, headers: { "Idempotency-Key": `${customer().id}:${Date.now()}` } });
        remember(a.id, e.id); s.room.engagement = e; sound.play("pop"); renderRoom();
      } catch (err) { toast(err.message, "bad"); btn.disabled = false; }
    });
    return form;
  }

  function chat(e, a) {
    const log = el("div", { class: "chat ag-chat" }, e.messages.map((m) => m.from === "system"
      ? el("div", { class: "msg sys" }, m.text)
      : el("div", { class: `msg ${m.from === "customer" ? "me" : "them"}` }, el("small", {}, m.from === "customer" ? (e.customer.name || t("ag.you")) : a.name), m.text)));
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return log;
  }

  async function act(path, body, okSound = "pop") {
    const e = s.room.engagement;
    try {
      const next = await api(`/engagements/${e.id}${path}`, { method: "POST", body: body || {} });
      s.room.engagement = next; sound.play(okSound); renderRoom();
      if (["paid", "executing"].includes(next.status)) startPoll();
      return next;
    } catch (err) { toast(err.message, "bad"); return null; }
  }

  function jobView(a, e) {
    const parts = [chat(e, a)];
    if (e.status === "quoted") {
      const offer = el("input", { type: "number", min: "0", step: "0.01", placeholder: t("ag.offer.ph"), class: "ag-offer" });
      const negotiable = a.contract.negotiation_policy.maxDiscountPct > 0;
      parts.push(el("div", { class: "ag-actions" },
        el("div", { class: "ag-price" }, el("small", { class: "muted" }, t("ag.ask")), el("b", {}, money(e.negotiation.ask)), el("small", { class: "muted" }, t("ag.round", { n: e.negotiation.round, m: e.negotiation.maxRounds }))),
        negotiable ? el("div", { class: "ag-counter" }, offer, el("button", { type: "button", class: "btn small", onclick: () => { if (offer.value) act("/counter", { offer: Number(offer.value) }); } }, t("ag.counter"))) : null,
        el("button", { type: "button", class: "btn gold", onclick: () => act("/accept", null, "deal") }, t("ag.accept", { price: money(e.negotiation.ask) })),
        el("button", { type: "button", class: "btn ghost small", onclick: async () => { const n = await act("/cancel"); if (n) remember(a.id, null); } }, t("ag.cancel"))));
    }
    if (e.agreement && e.status === "agreed") {
      parts.push(agreementCard(e), el("div", { class: "ag-actions" },
        el("button", { type: "button", class: "btn primary", onclick: () => act("/pay", null, "deal") }, t(s.paymentMode === "x402" ? "ag.pay.live" : "ag.pay.demo", { price: money(e.agreement.price) })),
        el("small", { class: "muted" }, t(s.paymentMode === "x402" ? "ag.pay.liveNote" : "ag.pay.demoNote"))));
    }
    if (["paid", "executing"].includes(e.status)) {
      parts.push(el("div", { class: "ag-progress", style: `--c:${a.color}` },
        el("div", { class: "ag-spinner" }), el("div", {}, el("b", {}, e.execution.stage || t("ag.working")), el("div", { class: "bar" }, el("i", { style: `width:${Math.round((e.execution.progress || 0.04) * 100)}%` })))));
      startPoll();
    }
    if (e.deliverable) parts.push(deliverableView(a, e), checksView(e), settlementView(e));
    if (e.status === "delivered") parts.push(reviewBox(a, e));
    if (["accepted", "rejected", "failed", "cancelled"].includes(e.status)) {
      parts.push(el("div", { class: `deal-result ${e.status === "accepted" ? "win" : "lose"}` }, el("div", { class: "big" }, t(`ag.final.${e.status}`)),
        el("button", { type: "button", class: "btn small", onclick: () => { remember(a.id, null); s.room.engagement = null; renderRoom(); } }, t("ag.again"))));
    }
    parts.push(el("details", { class: "ag-audit" }, el("summary", {}, t("ag.audit", { n: e.events.length })),
      el("ol", {}, e.events.map((ev) => el("li", {}, el("code", {}, ev.type), " ", el("small", { class: "muted" }, new Date(ev.at).toLocaleTimeString()), ev.data ? el("small", { class: "muted" }, ` ${JSON.stringify(ev.data)}`) : null)))));
    return el("div", { class: "ag-job" }, parts);
  }

  function agreementCard(e) {
    const g = e.agreement;
    return el("div", { class: "ag-card" }, el("b", {}, t("ag.agreement")),
      el("div", { class: "ag-kv" },
        el("span", {}, t("ag.price")), el("b", {}, money(g.price)),
        el("span", {}, t("ag.deliverable")), el("span", {}, g.deliverable),
        el("span", {}, t("ag.deadline")), el("span", {}, new Date(g.deadline).toLocaleString()),
        el("span", {}, t("ag.hash")), el("code", {}, g.hash)),
      el("small", { class: "muted" }, t("ag.criteria")), el("ul", {}, g.acceptance.map((x) => el("li", {}, x))));
  }

  function checksView(e) {
    return el("div", { class: "ag-card" }, el("b", {}, t("ag.checks")),
      el("ul", { class: "ag-checks" }, e.checks.map((c) => el("li", { class: c.ok ? "ok" : "bad" }, el("i", {}, c.ok ? "✓" : "✕"), c.name, c.detail ? el("small", { class: "muted" }, ` · ${c.detail}`) : null))));
  }

  function settlementView(e) {
    const p = e.payment;
    if (!p) return null;
    return el("div", { class: "ag-card" }, el("b", {}, t("ag.settlement")),
      el("div", { class: "ag-kv" },
        el("span", {}, t("ag.mode")), el("span", {}, p.mode === "x402" ? "x402 · USD₮0 · X Layer" : t("ag.mode.demoShort")),
        el("span", {}, t("ag.amount")), el("b", {}, money(p.amount)),
        el("span", {}, t("ag.status")), el("span", {}, p.settled ? t("ag.settled") : t("ag.notSettled")),
        p.txHash ? el("span", {}, "Tx") : null, p.txHash ? el("a", { href: `https://www.oklink.com/xlayer/tx/${p.txHash}`, target: "_blank", rel: "noopener" }, short(p.txHash)) : null),
      el("small", { class: "muted" }, p.note));
  }

  function reviewBox(a, e) {
    let rating = 5;
    const stars = el("div", { class: "stars" }, [1, 2, 3, 4, 5].map((n) => el("button", { type: "button", class: n <= rating ? "on" : "", onclick: () => { rating = n; [...stars.children].forEach((b, i) => b.classList.toggle("on", i < n)); } }, "★")));
    return el("div", { class: "ag-actions" }, el("small", { class: "muted" }, t("ag.review")), stars,
      el("button", { type: "button", class: "btn gold", onclick: async () => {
        const n = await act("/review", { accepted: true, rating }, "win");
        if (n) { remember(a.id, null); onJobAccepted(a, n); const r = $("agency-room").getBoundingClientRect(); burst(r.left + r.width / 2, r.top + 160, a.color, 36); }
      } }, t("ag.acceptWork")),
      el("button", { type: "button", class: "btn ghost small", onclick: async () => { const n = await act("/review", { accepted: false, rating: 1 }, "lose"); if (n) remember(a.id, null); } }, t("ag.reject")));
  }

  // ------------------------------------------------------------------ deliverables
  function link(href, label) { return SAFE_URL.test(href || "") ? el("a", { href, target: "_blank", rel: "noopener" }, label) : null; }
  function kv(pairs) { return el("div", { class: "ag-kv" }, pairs.filter(Boolean).flatMap(([k, v]) => [el("span", {}, k), typeof v === "object" && v instanceof Node ? v : el("span", {}, String(v))])); }

  function deliverableView(a, e) {
    const d = e.deliverable;
    const engine = d.engine ? el("small", { class: "muted ag-engine" }, `${t("ag.engine")}: ${d.engine}`) : null;
    let body;
    switch (a.id) {
      case "gaming": body = [
        el("div", { class: "ag-game" },
          SAFE_URL.test(d.playUrl || "") ? el("iframe", { src: d.playUrl, title: d.title || "Game", allow: "autoplay; fullscreen" }) : null,
          el("div", {}, el("h3", {}, d.title), el("p", { class: "small" }, d.mechanic || d.description || ""),
            kv([[t("ag.g.recipe"), d.genreRecipe], [t("ag.g.style"), d.style], [t("ag.g.build"), `${d.buildSeconds}s`], [t("ag.g.playtest"), d.qa?.browserPlaytest]]),
            link(d.playUrl, t("ag.g.play"))))]; break;
      case "sports": body = [
        el("div", { class: "ag-pick" }, el("small", { class: "muted" }, `${d.event}${d.competition ? ` · ${d.competition}` : ""}`), el("div", { class: "big" }, d.selection),
          el("div", { class: "bar", style: "--c:#3ddc84" }, el("i", { style: `width:${Math.round((d.probability || 0) * 100)}%` })),
          el("small", {}, `${Math.round((d.probability || 0) * 100)}% · ${d.confidence}`)),
        el("p", { class: "small" }, d.rationale),
        el("div", { class: "ag-two" }, el("div", {}, el("b", {}, t("ag.s.factors")), el("ul", {}, (d.keyFactors || []).map((x) => el("li", {}, x)))), el("div", {}, el("b", {}, t("ag.s.risks")), el("ul", {}, (d.risks || []).map((x) => el("li", {}, x))))),
        d.marketComparison?.outcomes ? el("p", { class: "small" }, `${t("ag.s.market")}: ${d.marketComparison.question} · ${d.marketComparison.outcomes.map((o) => `${o.name} ${Math.round(o.price * 100)}c`).join(", ")} `, link(d.marketComparison.url, "Polymarket")) : el("p", { class: "tiny muted" }, d.marketComparison?.unavailable),
        el("p", { class: "tiny muted" }, `${d.limitations} · ${new Date(d.analysedAt).toLocaleString()}`)]; break;
      case "dex": body = [
        el("div", { class: "ag-pick" }, el("small", { class: "muted" }, `${d.pair} · ${d.protocol} · ${d.chain}`), el("div", { class: `big dir-${(d.direction || "").toLowerCase()}` }, d.direction), el("small", {}, `${t("ag.d.conf")} ${Math.round((d.confidence || 0) * 100)}% · ${d.horizon}`)),
        kv([[t("ag.d.price"), `$${d.priceUsd}`], d.entry ? [t("ag.d.entry"), `$${d.entry.low} – $${d.entry.high}`] : null, d.invalidation ? [t("ag.d.inval"), `$${d.invalidation}`] : null, d.targets?.length ? [t("ag.d.targets"), d.targets.map((x) => `$${x}`).join(" · ")] : null,
          [t("ag.d.liq"), `$${Number(d.pool?.liquidityUsd || 0).toLocaleString()}`], [t("ag.d.expires"), new Date(d.expiresAt).toLocaleString()],
          [t("ag.d.ind"), `momentum ${d.indicators?.momentumPct}% · flow ${d.indicators?.buySellImbalance} · score ${d.indicators?.score}`], [t("ag.d.pool"), link(d.pool?.url, d.pool?.name || short(d.pool?.address)) || "—"]]),
        el("p", { class: "small" }, d.rationale), el("p", { class: "tiny muted" }, `${d.dataSource}. ${d.notAdvice}`)]; break;
      case "media": body = [
        el("h3", {}, d.title), el("p", { class: "small muted" }, d.logline),
        d.keyFrame ? el("img", { class: "ag-keyframe", alt: "Key frame", src: `${s.api}/engagements/${e.id}/files/${encodeURIComponent(d.keyFrame)}` }) : el("p", { class: "tiny muted" }, d.keyFrameNote),
        el("table", { class: "ag-table" }, el("thead", {}, el("tr", {}, ["", t("ag.m.visual"), t("ag.m.text"), t("ag.m.camera")].map((h) => el("th", {}, h)))),
          el("tbody", {}, (d.shots || []).map((x) => el("tr", {}, el("td", {}, `${x.start}–${x.end}s`), el("td", {}, x.visual), el("td", {}, x.onScreenText), el("td", {}, x.camera))))),
        kv([[t("ag.m.vo"), d.voiceover], [t("ag.m.music"), d.music], ["CTA", d.cta]]), el("p", { class: "tiny muted" }, d.renderNote)]; break;
      case "creator": body = [
        el("p", { class: "small" }, d.positioning), el("div", { class: "seg-chips" }, (d.pillars || []).map((p) => el("span", { class: "kind" }, p))),
        el("div", { class: "ag-concepts" }, (d.concepts || []).map((c) => el("div", { class: "ag-card" }, el("b", {}, c.title), el("small", { class: "muted" }, `${c.format} · ${c.platform}`), el("p", { class: "small" }, el("i", {}, `“${c.hook}”`)), el("p", { class: "tiny" }, c.script)))),
        el("table", { class: "ag-table" }, el("tbody", {}, (d.calendar || []).map((x) => el("tr", {}, el("td", {}, `W${x.week} ${x.day}`), el("td", {}, x.concept), el("td", {}, x.platform))))),
        d.kpis?.length ? el("p", { class: "tiny muted" }, `KPIs: ${d.kpis.join(" · ")}`) : null]; break;
      default: body = [el("pre", {}, JSON.stringify(d, null, 2))];
    }
    return el("div", { class: "ag-card ag-deliverable", style: `--c:${a.color}` }, el("b", {}, t("ag.delivered")), body, engine);
  }

  // ------------------------------------------------------------------ polling
  function startPoll() {
    if (s.pollT) return;
    s.pollT = setInterval(async () => {
      const e = s.room?.engagement;
      if (!e || $("market").hidden) return stopPoll();
      try {
        const next = await api(`/engagements/${e.id}`);
        const changed = next.status !== e.status || next.execution.stage !== e.execution.stage || next.execution.progress !== e.execution.progress;
        s.room.engagement = next;
        if (!["paid", "executing"].includes(next.status)) { stopPoll(); sound.play(next.status === "delivered" ? "win" : "error"); renderRoom(); }
        else if (changed) renderRoom();
      } catch { /* keep polling */ }
    }, 2500);
  }
  function stopPoll() { clearInterval(s.pollT); s.pollT = null; }

  return { renderList, stopPoll };
}
