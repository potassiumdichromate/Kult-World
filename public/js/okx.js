// The Kult OKX gateway in Kult World: OKX.AI users hire the AI teams of
// players' businesses, per call. Two views:
//
//   directory(root)  every business live on OKX.AI; hire one the way an OKX
//                    user's agent does: call the A2MCP endpoint, get a 402
//                    x402 challenge, sign a USD₮0 payment on X Layer, replay,
//                    receive the work. Each HTTP step is shown in a log.
//   owner(root)      the player's own businesses: link the OKX.AI agent they
//                    own (signed by its wallet), go live, set prices, copy
//                    the endpoint for their OKX.AI listing, watch jobs come in.

import { okxApi, usdc, toBaseUnits, isDemo } from "./kult.js";

const XLAYER = 196;
const KIND = { CREATE: { label: "Game studio", brand: "Kult Create", color: "#ff7eb6" }, SPORTS: { label: "Sports agency", brand: "Kult Sports", color: "#3ddc84" } };
const short = (a, n = 6) => (a ? `${a.slice(0, n)}…${a.slice(-4)}` : "—");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (bu) => Number(usdc(bu)).toFixed(2);

export function createOkx(ctx) {
  const { el, t, toast, sound, burst, signTypedData, signMessage, wallet } = ctx;
  const s = { pollT: null, filter: "ALL" };
  const stop = () => { clearInterval(s.pollT); s.pollT = null; };
  const poll = (root, fn, ms) => { stop(); s.pollT = setInterval(() => { if (!document.hidden && root.isConnected && !root.closest("[hidden]")) fn(); else if (!root.isConnected) stop(); }, ms); };
  const txLink = (h) => (isDemo() ? el("code", { title: t("okx.demoTx") }, short(h, 10)) : el("a", { href: `https://www.oklink.com/xlayer/tx/${h}`, target: "_blank", rel: "noopener" }, short(h, 10)));
  const copyBtn = (text) => el("button", { type: "button", class: "btn ghost small", onclick: async () => { try { await navigator.clipboard.writeText(text); toast(t("okx.copied"), "good"); } catch { toast(text); } } }, t("okx.copy"));
  const kindChip = (b) => el("span", { class: "kind", style: `--c:${KIND[b].color}` }, KIND[b].label);
  const okxBadge = (p) => el("div", { class: "ag-okx" }, el("span", { class: "dot" }), el("div", {}, el("b", {}, `OKX.AI #${p.okxAgentId}`), el("small", {}, `${t("okx.payTo")} ${short(p.payTo)}`)));
  const stars = (r) => (r ? `★ ${r.toFixed(1)}` : t("okx.new"));

  // ------------------------------------------------------------------ directory
  async function directory(root, focusId = null) {
    stop();
    root.replaceChildren(el("div", { class: "muted" }, t("okx.loading")));
    let list;
    try { list = (await okxApi.providers()).providers; }
    catch (e) { root.replaceChildren(el("div", { class: "ag-error" }, el("b", {}, t("okx.offline")), el("small", { class: "muted" }, e.message))); return; }
    if (focusId) { const p = list.find((x) => x.id === focusId); if (p) return hire(root, p.id); }
    const shown = list.filter((p) => s.filter === "ALL" || p.business === s.filter);
    root.replaceChildren(
      el("div", { class: "market-head" },
        el("div", {}, el("h2", { class: "place-title" }, t("okx.title")), el("p", { class: "muted" }, t("okx.desc")))),
      el("div", { class: "okx-how" }, ["okx.how1", "okx.how2", "okx.how3", "okx.how4"].map((k, i) => el("div", {}, el("i", {}, String(i + 1)), t(k)))),
      el("div", { class: "seg-chips" }, [["ALL", "okx.all"], ["CREATE", "okx.studios"], ["SPORTS", "okx.agencies"]].map(([k, label]) => el("button", { type: "button", style: "--c:#9fe8ff", "aria-pressed": s.filter === k ? "true" : "false", onclick: () => { s.filter = k; directory(root); } }, el("i"), label && t(label)))),
      shown.length ? el("div", { class: "agency-grid" }, shown.map((p) => el("div", { class: "agency-card", style: `--c:${KIND[p.business].color}` },
        el("div", { class: "ag-top" }, kindChip(p.business), el("span", { class: "kind", style: "--c:#9fe8ff" }, "A2MCP")),
        el("h3", {}, p.businessName),
        okxBadge(p),
        p.services.map((sv) => el("div", { class: "ag-svc" }, el("b", {}, sv.name), el("small", { class: "muted" }, sv.summary))),
        el("div", { class: "ag-foot" },
          el("div", {}, el("b", {}, `${money(p.services[0].price)} USDT`), el("small", { class: "muted" }, `${t("okx.perCall")} · ${stars(p.stats.rating)} · ${t("okx.jobs", { n: p.stats.jobs })}`)),
          el("button", { type: "button", class: "btn primary small", onclick: () => hire(root, p.id) }, t("okx.hire")))))) : el("p", { class: "muted" }, t("okx.none")));
  }

  // ------------------------------------------------------------------ hire (the A2MCP call)
  async function hire(root, providerId) {
    stop();
    const p = await okxApi.provider(providerId).catch((e) => { toast(e.message, "bad"); return null; });
    if (!p) return directory(root);
    const sv = p.services[0];
    const fields = {};
    const form = el("div", { class: "ag-form" });
    for (const [key, f] of Object.entries(sv.input.properties)) {
      let input;
      if (f["x-source"] === "fixtures") {
        input = el("select", {}, el("option", { value: "" }, t("okx.loadingFixtures")));
        okxApi.fixtures().then((fx) => input.replaceChildren(...fx.map((x) => el("option", { value: String(x.id) }, `${x.home} vs ${x.away} · ${x.league} · ${new Date(x.kickoffAt).toLocaleDateString()}`)))).catch(() => {});
      } else if (f.enum) input = el("select", {}, f.enum.map((v) => el("option", { value: v, selected: v === f.default ? true : null }, v)));
      else if (f["x-widget"] === "textarea") input = el("textarea", { rows: 3, maxlength: f.maxLength, placeholder: f.description || "" });
      else input = el("input", { type: "text", maxlength: f.maxLength });
      fields[key] = input;
      form.append(el("label", { class: `ag-field${f["x-widget"] === "textarea" ? " wide" : ""}` }, el("span", {}, f.title, sv.input.required.includes(key) ? " *" : ""), input));
    }
    const log = el("ol", { class: "okx-log" });
    const out = el("div", { class: "ag-job" });
    const step = (cls, title, detail) => { const li = el("li", { class: cls }, el("b", {}, title), detail ? el("pre", {}, typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)) : null); log.append(li); return li; };
    const go = el("button", { type: "button", class: "btn gold" }, t("okx.pay", { price: money(sv.price) }));
    go.addEventListener("click", async () => {
      const input = Object.fromEntries(Object.entries(fields).map(([k, n]) => [k, n.value.trim()]));
      for (const k of sv.input.required) if (!input[k]) return toast(t("okx.required", { field: sv.input.properties[k].title }), "bad");
      const from = wallet();
      if (!from) return toast(t("okx.signIn"), "bad");
      go.disabled = true; log.replaceChildren(); out.replaceChildren();
      try {
        // 1. Call the endpoint like any client: the gateway answers 402.
        const first = await okxApi.call(p.id, sv.id, input);
        step(first.status === 402 ? "ok" : "bad", `POST ${new URL(sv.endpoint).pathname} → ${first.status}`, first.status === 402 ? { accepts: first.body.accepts.map((a) => ({ network: a.network, asset: a.extra?.name, amount: `${money(a.amount)} USDT`, payTo: a.payTo })) } : first.body);
        if (first.status !== 402) throw new Error(first.body?.error || `Unexpected ${first.status}`);
        const req = first.body.accepts[0];
        // 2. Sign a USD₮0 TransferWithAuthorization on X Layer for exactly that.
        const nonce = `0x${[...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
        const authorization = { from, to: req.payTo, value: req.amount, validAfter: "0", validBefore: String(Math.floor(Date.now() / 1000) + req.maxTimeoutSeconds), nonce };
        const signing = step("run", t("okx.step.sign"));
        const signature = await signTypedData(XLAYER, {
          domain: { name: req.extra.name, version: req.extra.version, chainId: XLAYER, verifyingContract: req.asset },
          types: {
            EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
            TransferWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }]
          },
          primaryType: "TransferWithAuthorization", message: authorization
        });
        signing.className = "ok";
        signing.append(el("pre", {}, JSON.stringify({ x402Version: 2, scheme: "exact", network: req.network, signature: short(signature, 12), authorization: { ...authorization, nonce: short(nonce, 10) } }, null, 2)));
        // 3. Replay with the payment: the gateway verifies it with OKX and runs the job.
        const header = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ x402Version: 2, resource: first.body.resource, accepted: req, payload: { signature, authorization } }))));
        const paid = await okxApi.call(p.id, sv.id, input, header);
        step(paid.status < 300 ? "ok" : "bad", `POST ${new URL(sv.endpoint).pathname} + PAYMENT-SIGNATURE → ${paid.status}`, paid.status < 300 ? { job: paid.body.job.id, status: paid.body.job.status, ...(paid.body.statusUrl ? { statusUrl: paid.body.statusUrl } : {}) } : paid.body);
        if (paid.status >= 300) throw new Error(paid.body?.error || `Payment failed (${paid.status})`);
        sound.play("deal");
        let job = paid.body.job;
        // 4. Long jobs (game builds) are followed until they are delivered.
        if (job.status === "RUNNING") {
          const prog = el("div", { class: "ag-progress", style: `--c:${KIND[p.business].color}` }, el("div", { class: "ag-spinner" }), el("div", {}, el("b", {}, t("okx.building")), el("ul", { class: "okx-stages" }), el("div", { class: "bar" }, el("i", { style: "width:4%" }))));
          out.replaceChildren(prog);
          while (job.status === "RUNNING" && root.isConnected) {
            await wait(2000);
            job = await okxApi.job(job.id);
            prog.querySelector(".okx-stages").replaceChildren(...(job.stages || []).map((x) => el("li", {}, `✓ ${x.line}`)));
            prog.querySelector(".bar > i").style.width = `${Math.round((job.progress || 0.04) * 100)}%`;
          }
          step("ok", `GET ${new URL(paid.body.statusUrl).pathname} → ${job.status}`);
        }
        out.replaceChildren(deliverable(job), receipt(job));
        sound.play("win");
        const r = root.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + 200, KIND[p.business].color, 36);
        ctx.onHired?.(p, job);
      } catch (e) {
        step("bad", e.message.startsWith("closed") ? t("okx.cancelled") : e.message);
        if (!e.message.startsWith("closed")) toast(e.message, "bad");
      } finally { go.disabled = false; }
    });
    root.replaceChildren(...[
      el("button", { type: "button", class: "btn ghost small", onclick: () => directory(root) }, `‹ ${t("okx.back")}`),
      el("div", { class: "ar-head", style: `--c:${KIND[p.business].color}` },
        el("div", {}, kindChip(p.business), el("h2", { class: "place-title" }, p.businessName), el("p", { class: "muted small" }, sv.summary)),
        el("div", { class: "ar-side" }, okxBadge(p), el("small", { class: "muted" }, `${stars(p.stats.rating)} · ${t("okx.jobs", { n: p.stats.jobs })} · ${t("okx.earned", { n: money(p.stats.earnedBaseUnits) })}`))),
      el("div", { class: "ag-card okx-listing" }, el("b", {}, t("okx.listing")),
        el("div", { class: "ag-kv" },
          el("span", {}, t("okx.agent")), el("span", {}, `#${p.okxAgentId} · ${p.okx.name}`),
          el("span", {}, t("okx.service")), el("span", {}, `${sv.name} · A2MCP`),
          el("span", {}, t("okx.price")), el("b", {}, `${money(sv.price)} USDT ${t("okx.perCall")}`),
          el("span", {}, t("okx.endpoint")), el("code", {}, sv.endpoint),
          el("span", {}, t("okx.settlement")), el("span", {}, t("okx.settlementText")))),
      p.reviews?.length ? el("div", { class: "ag-card" }, el("b", {}, t("okx.reviews")), el("ul", { class: "okx-reviews" }, p.reviews.map((r) => el("li", {}, el("b", {}, `${"★".repeat(r.stars)} ${r.name}`), el("small", { class: "muted" }, ` ${r.from}`), el("p", { class: "small" }, r.text))))) : null,
      form,
      el("div", { class: "ag-actions" }, go, el("small", { class: "muted" }, t("okx.payNote"))),
      el("details", { class: "ag-audit", open: true }, el("summary", {}, t("okx.log")), log),
      out].filter(Boolean));
  }

  function deliverable(job) {
    const d = job.deliverable;
    if (job.service === "match-analysis") {
      return el("div", { class: "ag-card ag-deliverable", style: "--c:#3ddc84" }, el("b", {}, t("okx.delivered")),
        el("div", { class: "ag-pick" }, el("small", { class: "muted" }, `${d.fixture.match} · ${d.fixture.league}`), el("div", { class: "big" }, `${d.picks.outcome === "HOME" ? d.fixture.match.split(" vs ")[0] : d.picks.outcome === "AWAY" ? d.fixture.match.split(" vs ")[1] : t("okx.draw")} · ${d.picks.score}`),
          el("div", { class: "bar", style: "--c:#3ddc84" }, el("i", { style: `width:${Math.round(d.probability * 100)}%` })), el("small", {}, `${Math.round(d.probability * 100)}% · ${d.confidence}`)),
        el("div", { class: "ag-kv" }, el("span", {}, t("okx.corners")), el("span", {}, d.picks.corners), el("span", {}, t("okx.cards")), el("span", {}, d.picks.cards), el("span", {}, t("okx.scorer")), el("span", {}, d.picks.scorer)),
        el("p", { class: "small" }, el("b", {}, `${d.ceo.name} (CEO): `), d.ceo.call),
        el("div", { class: "ag-concepts" }, d.analysts.map((a) => el("div", { class: "ag-card" }, el("b", {}, a.name), el("small", { class: "muted" }, a.specialty), el("p", { class: "tiny" }, a.read)))),
        el("p", { class: "tiny muted" }, d.notAdvice));
    }
    return el("div", { class: "ag-card ag-deliverable", style: "--c:#ff7eb6" }, el("b", {}, t("okx.delivered")),
      el("div", { class: "ag-game" }, el("iframe", { src: d.playUrl, title: d.title, allow: "autoplay; fullscreen" }),
        el("div", {}, el("h3", {}, d.title), el("p", { class: "small" }, `${d.studio} · ${d.genre}`),
          el("div", { class: "ag-kv" }, el("span", {}, "QA"), el("span", {}, d.qa.passed ? t("okx.qaPassed") : "—"), el("span", {}, t("okx.buildTime")), el("span", {}, `${d.buildSeconds}s`)),
          el("a", { href: d.playUrl, target: "_blank", rel: "noopener" }, t("okx.openGame")))));
  }
  function receipt(job) {
    const pm = job.payment;
    return el("div", { class: "ag-card" }, el("b", {}, t("okx.receipt")),
      el("div", { class: "ag-kv" },
        el("span", {}, t("okx.amount")), el("b", {}, `${pm.amount} USD₮0`),
        el("span", {}, t("okx.network")), el("span", {}, "X Layer (eip155:196) · x402"),
        el("span", {}, t("okx.from")), el("code", {}, short(pm.payer)),
        el("span", {}, t("okx.to")), el("code", {}, short(pm.payTo)),
        el("span", {}, t("okx.status")), el("span", {}, pm.settled ? t("okx.settled") : t("okx.pending")),
        pm.txHash ? el("span", {}, "Tx") : null, pm.txHash ? txLink(pm.txHash) : null),
      el("small", { class: "muted" }, t("okx.receiptNote")));
  }

  // ------------------------------------------------------------------ owner
  async function owner(root) {
    stop();
    root.replaceChildren(el("div", { class: "muted" }, t("okx.loading")));
    let me;
    try { me = await okxApi.me(); } catch (e) { root.replaceChildren(el("div", { class: "ag-error" }, el("b", {}, t("okx.offline")), el("small", { class: "muted" }, e.message))); return; }
    if (!me.businesses.length) { root.replaceChildren(el("h2", { class: "place-title" }, t("okx.mineTitle")), el("p", { class: "muted" }, t("okx.noBusiness"))); return; }
    root.replaceChildren(
      el("div", { class: "market-head" }, el("div", {}, el("h2", { class: "place-title" }, t("okx.mineTitle")), el("p", { class: "muted" }, t("okx.mineDesc")))),
      ...me.businesses.map((b) => businessCard(root, b)));
    // Calls keep arriving while the panel is open: refresh the list and the counters.
    poll(root, async () => {
      const fresh = await okxApi.me().catch(() => null);
      for (const b of (fresh?.businesses ?? []).filter((x) => x.provider?.enabled)) {
        const box = root.querySelector(`[data-jobs="${b.provider.id}"]`);
        if (box) fillJobs(box, b.provider.id);
        root.querySelector(`[data-stats="${b.provider.id}"]`)?.replaceWith(statsEl(b.provider));
      }
    }, 8000);
  }

  function statsEl(p) {
    return el("div", { class: "okx-stats", "data-stats": p.id },
      el("div", {}, el("b", {}, `#${p.okxAgentId}`), el("span", {}, t("okx.okxId"))),
      el("div", {}, el("b", {}, String(p.stats.jobs)), el("span", {}, t("okx.calls"))),
      el("div", {}, el("b", {}, `${money(p.stats.earnedBaseUnits)}`), el("span", {}, t("okx.earnedUsdt"))),
      el("div", {}, el("b", {}, p.stats.rating ? p.stats.rating.toFixed(1) : "—"), el("span", {}, t("okx.rating"))));
  }

  function businessCard(root, b) {
    const p = b.provider, k = KIND[b.business];
    const card = el("div", { class: "ag-card okx-biz", style: `--c:${k.color}` },
      el("div", { class: "okx-biz-head" }, el("div", {}, kindChip(b.business), el("h3", {}, b.name), el("small", { class: "muted" }, `${k.brand} · CEO ${b.ceo?.name || "—"}`)),
        p ? el("span", { class: `okx-live ${p.enabled ? "on" : ""}` }, t(p.enabled ? "okx.live" : "okx.off")) : el("span", { class: "okx-live" }, t("okx.notLinked"))));
    if (!p) card.append(linkFlow(root, b));
    else card.append(linkedView(root, b, p));
    return card;
  }

  function linkFlow(root, b) {
    const id = el("input", { type: "text", inputmode: "numeric", placeholder: t("okx.agentIdPh"), class: "a2a-num" });
    const box = el("div", { class: "okx-link" });
    const start = el("button", { type: "button", class: "btn primary small", onclick: async () => {
      start.disabled = true;
      try {
        const ch = await okxApi.challenge({ okxAgentId: id.value.trim(), business: b.business, businessId: b.businessId, businessName: b.name });
        const sig = el("textarea", { rows: 2, placeholder: "0x…" });
        box.replaceChildren(
          el("p", { class: "small" }, t("okx.found", { id: ch.okx.agentId, owner: short(ch.signer) })),
          el("small", { class: "muted" }, t("okx.signWith")),
          el("pre", { class: "okx-cmd" }, ch.command), copyBtn(ch.command),
          el("label", { class: "ag-field wide" }, el("span", {}, t("okx.pasteSig")), sig),
          el("div", { class: "ag-actions" },
            el("button", { type: "button", class: "btn ghost small", title: t("okx.walletSignHint"), onclick: async () => { try { sig.value = await signMessage(ch.signer, ch.message); } catch (e) { if (!e.message.startsWith("closed")) toast(e.message, "bad"); } } }, t("okx.walletSign")),
            el("button", { type: "button", class: "btn gold small", onclick: async () => {
              try {
                await okxApi.link({ business: b.business, businessId: b.businessId, okxAgentId: ch.okx.agentId, token: ch.token, signature: sig.value.trim() });
                sound.play("deal"); toast(t("okx.linked", { name: b.name, id: ch.okx.agentId }), "good");
                ctx.onLinked?.(b);
                owner(root);
              } catch (e) { toast(e.message, "bad"); }
            } }, t("okx.link"))));
      } catch (e) { toast(e.message, "bad"); start.disabled = false; }
    } }, t("okx.next"));
    box.replaceChildren(el("p", { class: "small muted" }, t("okx.linkDesc")), el("div", { class: "ag-actions" }, id, start),
      el("small", { class: "muted" }, t("okx.noAgent")), el("pre", { class: "okx-cmd" }, `onchainos agent create --role asp --name "${b.name}" --description "..." --picture <avatar-url> --service '[{"serviceName":"${b.services[0].name}","serviceType":"A2MCP","fee":${money(b.services[0].defaultPrice)},"endpoint":"<from Kult after linking>"}]'`));
    return box;
  }

  function linkedView(root, b, p) {
    const sv = p.services[0];
    const price = el("input", { type: "text", inputmode: "decimal", class: "a2a-num", value: usdc(sv.price) });
    const live = el("input", { type: "checkbox", checked: p.enabled ? true : null });
    live.addEventListener("change", async () => {
      try { await okxApi.update(p.id, { enabled: live.checked }); toast(t(live.checked ? "okx.nowLive" : "okx.nowOff", { name: b.name }), "good"); owner(root); }
      catch (e) { live.checked = !live.checked; toast(e.message, "bad"); }
    });
    const register = `onchainos agent update --agent-id ${p.okxAgentId} --service '[{"serviceName":"${sv.name}","serviceDescription":"${sv.summary.replace(/'/g, "")}","serviceType":"A2MCP","fee":${money(sv.price)},"endpoint":"${sv.endpoint}"}]'`;
    const jobs = el("div", { "data-jobs": p.id });
    if (p.enabled) fillJobs(jobs, p.id);
    return el("div", { class: "okx-linked" },
      statsEl(p),
      el("div", { class: "ag-kv" },
        el("span", {}, t("okx.owner")), el("code", {}, short(p.okx.owner)),
        el("span", {}, t("okx.payTo")), el("code", {}, short(p.payTo)),
        el("span", {}, t("okx.service")), el("span", {}, `${sv.name} · A2MCP${sv.async ? ` · ${t("okx.async")}` : ""}`),
        el("span", {}, t("okx.endpoint")), el("code", {}, sv.endpoint)),
      el("div", { class: "ag-actions" },
        el("label", { class: "a2a-auto" }, live, el("span", {}, t("okx.goLive"))),
        el("span", { class: "muted small" }, t("okx.price")), price, el("span", { class: "muted small" }, "USDT"),
        el("button", { type: "button", class: "btn small", onclick: async () => {
          try { await okxApi.update(p.id, { prices: { [sv.id]: toBaseUnits(price.value) } }); toast(t("okx.priceSaved"), "good"); owner(root); } catch (e) { toast(e.message, "bad"); }
        } }, t("okx.save")),
        p.enabled ? el("button", { type: "button", class: "btn ghost small", onclick: () => ctx.openDirectory?.(p.id) }, t("okx.tryIt")) : null),
      el("details", { class: "ag-audit" }, el("summary", {}, t("okx.registerTitle")), el("p", { class: "tiny muted" }, t("okx.registerDesc")), el("pre", { class: "okx-cmd" }, register), copyBtn(register)),
      p.enabled ? el("h4", { class: "a2a-h" }, t("okx.incoming")) : el("p", { class: "tiny muted" }, t("okx.goLiveHint")),
      jobs);
  }

  async function fillJobs(box, providerId) {
    try {
      const { jobs } = await okxApi.jobs(providerId);
      box.replaceChildren(jobs.length ? el("table", { class: "ag-table" },
        el("thead", {}, el("tr", {}, [t("okx.when"), t("okx.buyer"), t("okx.service"), t("okx.amount"), t("okx.status"), "Tx"].map((x) => el("th", {}, x)))),
        el("tbody", {}, jobs.map((j) => el("tr", {},
          el("td", {}, new Date(j.createdAt).toLocaleTimeString()),
          el("td", {}, j.buyerKind === "okx" ? t("okx.okxBuyer", { w: short(j.payment.payer, 5) }) : t("okx.kwBuyer")),
          el("td", {}, j.service === "match-analysis" ? j.deliverable?.fixture?.match || j.serviceName : j.deliverable?.title || j.serviceName),
          el("td", {}, `${j.payment.amount} USDT`),
          el("td", {}, j.status === "RUNNING" ? t("okx.running") : j.payment.settled ? t("okx.settled") : t(`okx.st.${j.status}`)),
          el("td", {}, j.payment.txHash ? txLink(j.payment.txHash) : "—"))))) : el("p", { class: "tiny muted" }, t("okx.waitingCalls")));
    } catch { /* keep the last list */ }
  }

  return { directory, owner, stop };
}
