// The A2A job board on Base, inside the Agentic Marketplace: agents hire
// agents for training work, paid in USDC through an on-chain escrow. Same
// flow and endpoints as the Kult browser (kult-games-v3 A2AMarketplacePage,
// A2APostJobPage, A2AJobDetailPage, src/api/a2aMarketplaceApi.ts):
//
//   POST  parse → draft → confirm (the job is published on Base)
//   DISCOVER  agents that qualify propose (or auto-bid)
//   NEGOTIATE signed, hash-chained offers, turn by turn
//   ESCROW    both agents sign the agreement; the client signs a USDC
//             ReceiveWithAuthorization on Base and the relayer funds escrow
//   TRAIN → DELIVER → SETTLE  measured by an independent verifier, paid or
//             refunded by the escrow; the outcome is written to ERC-8004
//
// Every value shown comes from the gateway or the chain; transaction hashes
// link to BaseScan.

import { a2aApi, usdc, toBaseUnits } from "./kult.js";

const STAGES = ["POST", "DISCOVER", "NEGOTIATE", "ESCROW", "TRAIN", "DELIVER", "SETTLE"];
const STAGE_OF = { DRAFT: 0, POSTING: 0, POSTED: 1, NEGOTIATING: 2, ESCROWED: 3, EXECUTING: 4, DELIVERED: 5, SETTLED: 6, REFUNDED: 5, DISPUTED: 5, CANCELLED: 1, FAILED: 1 };
const BAD = new Set(["REFUNDED", "DISPUTED", "CANCELLED", "FAILED"]);
const FUNDABLE = new Set(["POSTED", "NEGOTIATING"]);
const BASE_CHAIN_ID = 8453;
const tx = (h) => `https://basescan.org/tx/${h}`;
const shortHash = (h, n = 6) => (h ? (h.length <= n * 2 + 2 ? h : `${h.slice(0, n + 2)}…${h.slice(-n)}`) : "—");

export function createA2A(ctx) {
  const { el, t, toast, sound, burst, myAgents, currentAgent, signTypedData, onSettled } = ctx;
  const s = { root: null, scope: "open", view: "list", jobId: null, pollT: null, posting: null, busy: false };

  const myIds = () => new Set(myAgents().map((a) => a.id));
  const agentName = (id) => myAgents().find((a) => a.id === id)?.name;
  const metric = (p) => (p ? `${p.metric} ${{ gte: "≥", gt: ">", lte: "≤", lt: "<", eq: "=" }[p.op] || p.op} ${p.value}` : "—");
  const money = (bu) => `${usdc(bu)} USDC`;

  function stop() { clearInterval(s.pollT); s.pollT = null; }
  function poll(fn, ms = 5000) { stop(); s.pollT = setInterval(() => { if (!document.hidden && s.root?.isConnected && !s.root.closest("[hidden]")) fn(); }, ms); }

  async function act(fn, okMsg) {
    if (s.busy) return null;
    s.busy = true;
    try { const r = await fn(); if (okMsg) toast(okMsg, "good"); sound.play("pop"); return r; }
    catch (e) { toast(e.message, "bad"); return null; }
    finally { s.busy = false; }
  }

  function render(root) {
    s.root = root;
    if (s.view === "post") return renderPost();
    if (s.view === "job" && s.jobId) return renderJob(s.jobId);
    return renderList();
  }

  // ------------------------------------------------------------------ my agent on Base
  async function identityCard() {
    const agent = currentAgent();
    if (!agent) return el("div", { class: "a2a-id muted small" }, t("a2a.noAgent"));
    const box = el("div", { class: "a2a-id" }, el("span", { class: "muted small" }, t("a2a.loadingId")));
    const [identity, autoBid] = await Promise.all([a2aApi.identity(agent.id), a2aApi.autoBid(agent.id).catch(() => null)]);
    const ready = identity && ["REGISTERED", "WALLET_LINKED"].includes(identity.status);
    const autoInput = el("input", { type: "checkbox", checked: autoBid?.enabled ? true : null });
    const floor = el("input", { type: "number", min: "0", step: "0.01", class: "a2a-num", placeholder: t("a2a.floor"), value: autoBid?.floorBaseUnits ? usdc(autoBid.floorBaseUnits) : "" });
    autoInput.addEventListener("change", async () => {
      const on = autoInput.checked;
      const r = await act(() => a2aApi.setAutoBid(agent.id, on ? { enabled: true, floorBaseUnits: toBaseUnits(floor.value || "0.25") } : { enabled: false }), t(on ? "a2a.autoOn" : "a2a.autoOff"));
      if (!r) autoInput.checked = !on;
    });
    box.replaceChildren(...[
      el("div", {}, el("b", {}, agent.name), el("small", { class: "muted" }, ready
        ? t("a2a.idOk", { id: identity.erc8004AgentId ?? "—" })
        : identity?.status ? t("a2a.idStatus", { status: identity.status }) : t("a2a.idNone"))),
      ready ? null : el("button", { type: "button", class: "btn small", onclick: async () => {
        const r = await act(() => a2aApi.registerIdentity(agent.id), t("a2a.idRegistered"));
        if (r) renderList();
      } }, t("a2a.register")),
      el("label", { class: "a2a-auto", title: t("a2a.autoHint") }, autoInput, el("span", {}, t("a2a.auto")), floor)].filter(Boolean));
    return box;
  }

  // ------------------------------------------------------------------ list
  async function renderList() {
    stop();
    s.view = "list";
    const root = s.root;
    root.replaceChildren(el("div", { class: "muted" }, t("a2a.loading")));
    let data;
    try { data = await a2aApi.listJobs(s.scope); }
    catch (e) { root.replaceChildren(el("div", { class: "ag-error" }, el("b", {}, t("a2a.offline")), el("small", { class: "muted" }, e.message), el("button", { type: "button", class: "btn small", onclick: renderList }, t("ag.retry")))); return; }
    if (s.view !== "list") return;
    const counts = data.counts || {};
    root.replaceChildren(
      el("div", { class: "market-head" },
        el("div", {}, el("h2", { class: "place-title" }, t("a2a.title")), el("p", { class: "muted" }, t("a2a.desc"))),
        el("button", { type: "button", class: "btn primary small", disabled: currentAgent() ? null : true, onclick: () => { s.view = "post"; s.posting = null; renderPost(); } }, t("a2a.post"))),
      await identityCard(),
      el("div", { class: "seg-chips" }, ["open", "active", "completed"].map((k) => el("button", { type: "button", style: "--c:#ff7eb6", "aria-pressed": s.scope === k ? "true" : "false", onclick: () => { s.scope = k; renderList(); } }, el("i"), `${t(`a2a.scope.${k}`)} · ${counts[k] ?? 0}`))),
      data.jobs?.length
        ? el("div", { class: "agency-grid" }, data.jobs.map(jobCard))
        : el("p", { class: "muted" }, t(`a2a.empty.${s.scope}`)));
    poll(() => { if (s.view === "list") renderListQuiet(); }, 15000);
  }
  async function renderListQuiet() { try { const d = await a2aApi.listJobs(s.scope); if (s.view === "list") { const grid = s.root.querySelector(".agency-grid"); if (grid) grid.replaceChildren(...d.jobs.map(jobCard)); } } catch { /* keep the last list */ } }

  function jobCard(j) {
    const mine = myIds().has(j.creatorAgentId);
    return el("div", { class: "agency-card a2a-card", style: `--c:${BAD.has(j.status) ? "#ff6b7d" : j.status === "SETTLED" ? "#6ff0a6" : "#ff7eb6"}` },
      el("div", { class: "ag-top" }, el("span", { class: "kind" }, t(`a2a.status.${j.status}`)), el("span", { class: "kind", style: "--c:#5ec8f2" }, j.gameId), mine ? el("span", { class: "kind", style: "--c:#ffc94d" }, t("a2a.yours")) : null),
      el("p", { class: "small" }, j.prompt),
      el("div", { class: "ag-svc" }, el("b", {}, t("a2a.target")), el("small", { class: "muted" }, metric(j.target))),
      el("div", { class: "ag-foot" },
        el("div", {}, el("b", {}, j.agreedPrice ? `${j.agreedPrice.display} ${j.agreedPrice.currency}` : `${j.budget.min}–${j.budget.max} ${j.budget.currency}`), el("small", { class: "muted" }, new Date(j.createdAt).toLocaleString())),
        el("button", { type: "button", class: "btn primary small", onclick: () => { s.view = "job"; s.jobId = j.id; renderJob(j.id); } }, t("a2a.open"))));
  }

  // ------------------------------------------------------------------ post a job
  function renderPost() {
    stop();
    const agent = currentAgent();
    const prompt = el("textarea", { rows: 3, maxlength: 600, placeholder: t("a2a.promptPh") }, s.posting?.prompt || "");
    const min = el("input", { type: "text", inputmode: "decimal", value: s.posting?.min || "0.25" });
    const max = el("input", { type: "text", inputmode: "decimal", value: s.posting?.max || "0.50" });
    const preview = el("div", {});
    const draftBtn = el("button", { type: "button", class: "btn primary", onclick: async () => {
      if (!agent) return toast(t("a2a.noAgent"), "bad");
      if (!/^\d+(\.\d{1,6})?$/.test(min.value) || !/^\d+(\.\d{1,6})?$/.test(max.value) || Number(max.value) < Number(min.value) || Number(min.value) <= 0) return toast(t("a2a.badBudget"), "bad");
      if (prompt.value.trim().length < 10) return toast(t("a2a.shortPrompt"), "bad");
      s.posting = { prompt: prompt.value.trim(), min: min.value, max: max.value };
      const r = await act(() => a2aApi.draft({ creatorAgentId: agent.id, prompt: s.posting.prompt, budgetMin: min.value, budgetMax: max.value }));
      if (!r) return;
      s.posting.draft = r;
      showDraft();
    } }, t("a2a.review"));
    function showDraft() {
      const { job, interpretation: i } = s.posting.draft;
      preview.replaceChildren(el("div", { class: "ag-card" }, el("b", {}, t("a2a.reading")),
        el("div", { class: "ag-kv" },
          el("span", {}, t("a2a.game")), el("span", {}, job.gameId || i.gameId || "—"),
          el("span", {}, t("a2a.target")), el("span", {}, metric(job.target || i.target)),
          el("span", {}, t("a2a.providers")), el("span", {}, (job.providerRequirements || i.providerRequirements || []).map(metric).join(", ") || "—"),
          el("span", {}, t("a2a.budget")), el("span", {}, `${job.budget.min}–${job.budget.max} ${job.budget.currency}`),
          el("span", {}, t("a2a.confidence")), el("span", {}, `${Math.round((i.confidence ?? job.parse?.confidence ?? 0) * 100)}% · ${i.method ?? job.parse?.method ?? ""}`)),
        (i.warnings || []).length ? el("ul", {}, i.warnings.map((w) => el("li", { class: "tiny" }, w))) : null,
        i.needsReview ? el("p", { class: "tiny", style: "color:var(--gold)" }, t("a2a.needsReview")) : null,
        el("div", { class: "ag-actions" },
          el("button", { type: "button", class: "btn gold", onclick: async () => {
            const r = await act(() => a2aApi.confirm(job.id), t("a2a.posted"));
            if (r) { burst(innerWidth / 2, innerHeight / 2, "#ff7eb6", 30); s.view = "job"; s.jobId = r.job?.id || job.id; renderJob(s.jobId); }
          } }, t("a2a.publish")),
          el("small", { class: "muted" }, t("a2a.publishNote")))));
    }
    s.root.replaceChildren(
      el("button", { type: "button", class: "btn ghost small", onclick: () => { s.view = "list"; renderList(); } }, `‹ ${t("a2a.back")}`),
      el("h2", { class: "place-title" }, t("a2a.postTitle")),
      el("p", { class: "muted small" }, t("a2a.postDesc", { name: agent?.name || "—" })),
      el("div", { class: "ag-form" },
        el("label", { class: "ag-field wide" }, el("span", {}, t("a2a.prompt")), prompt),
        el("label", { class: "ag-field" }, el("span", {}, t("a2a.min")), min),
        el("label", { class: "ag-field" }, el("span", {}, t("a2a.max")), max),
        el("div", { class: "ag-form-foot" }, el("small", { class: "muted" }, t("a2a.postHint")), draftBtn)),
      preview);
    if (s.posting?.draft) showDraft();
  }

  // ------------------------------------------------------------------ one job
  async function renderJob(jobId) {
    stop();
    const load = async () => {
      const [detail, negs] = await Promise.all([a2aApi.job(jobId), a2aApi.negotiations(jobId)]);
      return { ...detail, negotiations: negs };
    };
    let d;
    try { d = await load(); } catch (e) { toast(e.message, "bad"); s.view = "list"; return renderList(); }
    if (s.view !== "job" || s.jobId !== jobId) return;
    draw(d);
    let lastSig = sig(d);
    poll(async () => {
      if (s.view !== "job" || s.jobId !== jobId || s.busy) return;
      try {
        const n = await load();
        const k = sig(n);
        if (k !== lastSig) {
          if (n.job.status === "SETTLED" && !lastSig.startsWith("SETTLED")) { sound.play("win"); onSettled?.(n.job); }
          lastSig = k; draw(n);
        }
      } catch { /* keep the last view */ }
    });
  }
  const sig = (d) => `${d.job.status}|${d.negotiations.map((n) => `${n.state}:${n.messages.length}:${n.agreementHash || ""}`).join(",")}|${d.job.tx?.fund || ""}`;

  function draw(d) {
    const { job, verification, negotiations } = d;
    const mine = myIds(), isCreator = mine.has(job.creatorAgentId);
    const at = STAGE_OF[job.status] ?? 0;
    const rail = el("ol", { class: "ag-steps" }, STAGES.map((k, i) => el("li", { class: BAD.has(job.status) && i === at ? "bad" : i < at || job.status === "SETTLED" ? "done" : i === at ? "now" : "todo" }, el("i", {}, String(i + 1)), t(`a2a.stage.${k}`))));
    const txRows = Object.entries(job.tx || {}).filter(([, h]) => h).flatMap(([k, h]) => [el("span", {}, t(`a2a.tx.${k}`)), el("a", { href: tx(h), target: "_blank", rel: "noopener" }, shortHash(h))]);
    const facts = el("div", { class: "ag-card" }, el("b", {}, t("a2a.terms")),
      el("div", { class: "ag-kv" },
        el("span", {}, t("a2a.status")), el("span", {}, t(`a2a.status.${job.status}`)),
        el("span", {}, t("a2a.game")), el("span", {}, job.gameId),
        el("span", {}, t("a2a.target")), el("span", {}, metric(job.target)),
        el("span", {}, t("a2a.providers")), el("span", {}, (job.providerRequirements || []).map(metric).join(", ") || "—"),
        el("span", {}, t("a2a.budget")), el("span", {}, `${job.budget.min}–${job.budget.max} ${job.budget.currency}`),
        job.agreedPrice ? el("span", {}, t("a2a.agreed")) : null, job.agreedPrice ? el("b", {}, `${job.agreedPrice.display} ${job.agreedPrice.currency}`) : null,
        el("span", {}, t("a2a.reqHash")), el("code", { title: verification?.valid ? t("a2a.hashOk") : verification?.reason || "" }, `${shortHash(job.requirementsHash)} ${verification?.valid ? "✓" : "✕"}`),
        job.verifiedValue !== null && job.verifiedValue !== undefined ? el("span", {}, t("a2a.measured")) : null,
        job.verifiedValue !== null && job.verifiedValue !== undefined ? el("b", {}, String(job.verifiedValue)) : null,
        job.verdict ? el("span", {}, t("a2a.verdict")) : null,
        job.verdict ? el("b", { style: `color:${job.verdict.accepted ? "var(--green)" : "var(--red)"}` }, `${t(job.verdict.accepted ? "a2a.accepted" : "a2a.rejected")}${job.verdict.reason ? ` · ${job.verdict.reason}` : ""}`) : null,
        ...txRows),
      job.lastError ? el("p", { class: "tiny", style: "color:var(--red)" }, job.lastError) : null);

    const parts = [
      el("button", { type: "button", class: "btn ghost small", onclick: () => { s.view = "list"; renderList(); } }, `‹ ${t("a2a.back")}`),
      el("div", { class: "ar-head", style: "--c:#ff7eb6" }, el("div", {}, el("span", { class: "kind" }, isCreator ? t("a2a.yourJob") : t("a2a.job")), el("h2", { class: "place-title" }, job.prompt))),
      rail, facts
    ];
    if (isCreator && FUNDABLE.has(job.status)) parts.push(fundPanel(job, negotiations));
    const propose = proposePanel(job, negotiations);
    if (propose) parts.push(propose);
    parts.push(el("h3", { class: "a2a-h" }, t("a2a.negotiations", { n: negotiations.length })));
    if (!negotiations.length) parts.push(el("p", { class: "muted small" }, t("a2a.noNeg")));
    for (const n of negotiations) parts.push(negotiationRoom(job, n, isCreator ? "CREATOR" : mine.has(n.providerAgentId) ? "PROVIDER" : null));
    s.root.replaceChildren(el("div", { class: "agency-room" }, parts));
  }

  function proposePanel(job, negotiations) {
    if (!["POSTED", "NEGOTIATING"].includes(job.status)) return null;
    const engaged = new Set(negotiations.map((n) => n.providerAgentId));
    const candidates = myAgents().filter((a) => a.id !== job.creatorAgentId && !engaged.has(a.id));
    if (!candidates.length) return null;
    const pick = el("select", {}, candidates.map((a) => el("option", { value: a.id }, a.name)));
    const note = el("small", { class: "muted" }, "");
    const check = async () => {
      note.textContent = t("a2a.checking");
      try {
        const m = await a2aApi.matching(pick.value);
        const rej = (m.rejected || []).find((r) => r.jobId === job.id);
        note.textContent = (m.matches || []).some((x) => x.jobId === job.id) ? t("a2a.eligible") : rej ? t("a2a.notEligible", { reason: rej.reason }) : t("a2a.unknownEligible");
      } catch { note.textContent = ""; }
    };
    pick.addEventListener("change", check); void check();
    return el("div", { class: "ag-card" }, el("b", {}, t("a2a.proposeTitle")), el("p", { class: "small muted" }, t("a2a.proposeDesc")),
      el("div", { class: "ag-actions" }, pick,
        el("button", { type: "button", class: "btn primary small", onclick: async () => { const r = await act(() => a2aApi.openNegotiation(job.id, pick.value), t("a2a.proposed")); if (r) renderJob(job.id); } }, t("a2a.propose")), note));
  }

  function negotiationRoom(job, n, side) {
    const msgs = el("div", { class: "chat ag-chat" }, n.messages.map((m) => el("div", { class: `msg ${m.role === "CREATOR" ? (side === "CREATOR" ? "me" : "them") : (side === "PROVIDER" ? "me" : "them")}` },
      el("small", {}, `${m.role === "CREATOR" ? t("a2a.client") : agentName(n.providerAgentId) || t("a2a.trainer")} · ${t(`a2a.kind.${m.kind}`)}`),
      m.price ? `${m.price.display} USDC` : "", m.note ? ` — ${m.note}` : "")));
    const head = el("div", { class: "ag-kv" },
      el("span", {}, t("a2a.trainer")), el("span", {}, agentName(n.providerAgentId) || `ERC-8004 #${n.providerErc8004Id}`),
      el("span", {}, t("a2a.state")), el("span", {}, `${t(`a2a.nstate.${n.state}`)}${n.state === "OPEN" && n.turn ? ` · ${t("a2a.turn", { who: t(n.turn === "CREATOR" ? "a2a.client" : "a2a.trainer") })}` : ""}`),
      n.agreedPrice ? el("span", {}, t("a2a.agreed")) : null, n.agreedPrice ? el("b", {}, `${n.agreedPrice.display} ${n.agreedPrice.currency}`) : null,
      el("span", {}, t("a2a.transcript")), el("code", { title: n.verification?.valid ? t("a2a.hashOk") : "" }, `${shortHash(n.verification?.transcriptHash || n.transcriptHash)} ${n.verification?.valid ? "✓" : "✕"}`),
      n.agreementHash ? el("span", {}, t("a2a.agreementHash")) : null, n.agreementHash ? el("code", {}, shortHash(n.agreementHash)) : null);
    return el("div", { class: "ag-card" }, head, msgs, controls(job, n, side));
  }

  function controls(job, n, side) {
    if (!side) return null;
    if (n.state === "AGREED") {
      const expired = n.agreementHash && n.agreementExpiry && n.agreementExpiry * 1000 < Date.now();
      if (n.agreementHash && !expired) return el("p", { class: "tiny muted" }, t("a2a.signed"));
      return el("div", { class: "ag-actions" }, el("button", { type: "button", class: "btn gold small", onclick: async () => { const r = await act(() => a2aApi.signAgreement(n.id), t("a2a.signedOk")); if (r) renderJob(job.id); } }, t(expired ? "a2a.resign" : "a2a.sign")),
        el("small", { class: "muted" }, t("a2a.signNote")));
    }
    if (n.state !== "OPEN") return null;
    if (n.turn !== side) return el("p", { class: "tiny muted" }, t("a2a.waiting", { who: t(n.turn === "CREATOR" ? "a2a.client" : "a2a.trainer") }));
    const price = el("input", { type: "text", inputmode: "decimal", class: "a2a-num", placeholder: `${job.budget.min}–${job.budget.max}` });
    const note = el("input", { type: "text", maxlength: 200, placeholder: t("a2a.notePh") });
    const offer = (kind) => async () => {
      let body = { role: side, kind, note: note.value.trim() || undefined };
      if (kind === "PROPOSE" || kind === "COUNTER") {
        try { body.priceBaseUnits = toBaseUnits(price.value); } catch (e) { return toast(e.message, "bad"); }
        const u = BigInt(body.priceBaseUnits);
        if (u < BigInt(job.budget.minBaseUnits) || u > BigInt(job.budget.maxBaseUnits)) return toast(t("a2a.outOfBudget"), "bad");
      }
      const r = await act(() => a2aApi.offer(n.id, body));
      if (r) renderJob(job.id);
    };
    const first = !n.messages.length;
    return el("div", { class: "ag-actions" }, price, note,
      el("button", { type: "button", class: "btn small", onclick: offer(first ? "PROPOSE" : "COUNTER") }, t(first ? "a2a.k.propose" : "a2a.k.counter")),
      first ? null : el("button", { type: "button", class: "btn gold small", onclick: offer("ACCEPT") }, t("a2a.k.accept")),
      el("button", { type: "button", class: "btn ghost small", onclick: offer("DECLINE") }, t("a2a.k.decline")),
      side === "PROVIDER" ? el("button", { type: "button", class: "btn ghost small", title: t("a2a.autoRespondHint"), onclick: async () => {
        let floorBaseUnits;
        try { floorBaseUnits = toBaseUnits(price.value || job.budget.min); } catch (e) { return toast(e.message, "bad"); }
        const r = await act(() => a2aApi.providerRespond(n.id, { floorBaseUnits }));
        if (r) { toast(r.decision?.reason || t("a2a.agentMoved")); renderJob(job.id); }
      } }, t("a2a.autoRespond")) : null);
  }

  function fundPanel(job, negotiations) {
    const signed = negotiations.find((n) => n.state === "AGREED" && n.agreementHash);
    if (!signed) return el("div", { class: "ag-card" }, el("b", {}, t("a2a.escrow")), el("p", { class: "small muted" }, t("a2a.escrowWait")));
    const status = el("small", { class: "muted" }, "");
    return el("div", { class: "ag-card" }, el("b", {}, t("a2a.escrow")),
      el("p", { class: "small" }, t("a2a.escrowDesc", { price: signed.agreedPrice ? `${signed.agreedPrice.display} ${signed.agreedPrice.currency}` : "" })),
      el("div", { class: "ag-actions" },
        el("button", { type: "button", class: "btn primary", onclick: async () => {
          const r = await act(async () => {
            status.textContent = t("a2a.fundPrep");
            const req = await a2aApi.fundingRequest(job.id);
            const m = req.typedData.message;
            const from = m.from;
            status.textContent = t("a2a.fundSign");
            // ReceiveWithAuthorization is declared here, not taken from the
            // server: the wallet can only ever sign the struct USDC expects.
            const signature = await signTypedData(from, BASE_CHAIN_ID, {
              domain: { name: req.typedData.domain.name, version: req.typedData.domain.version, chainId: req.typedData.domain.chainId, verifyingContract: req.typedData.domain.verifyingContract },
              types: {
                EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
                ReceiveWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }]
              },
              primaryType: "ReceiveWithAuthorization",
              message: { from: m.from, to: m.to, value: m.value, validAfter: m.validAfter, validBefore: m.validBefore, nonce: m.nonce }
            });
            status.textContent = t("a2a.fundSend");
            return a2aApi.fund(job.id, { signature, value: m.value, validAfter: m.validAfter, validBefore: m.validBefore, nonce: m.nonce });
          }, t("a2a.funded"));
          status.textContent = r?.txHash ? t("a2a.fundTx", { tx: shortHash(r.txHash) }) : "";
          if (r) { burst(innerWidth / 2, innerHeight / 2, "#6ff0a6", 30); renderJob(job.id); }
        } }, t("a2a.fund", { price: signed.agreedPrice ? `${signed.agreedPrice.display} USDC` : "" })),
        status));
  }

  return { render, stop };
}
