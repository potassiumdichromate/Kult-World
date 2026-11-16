// The Kult Deal Room: the first Verified Arena (Negotiation). Every number
// here comes from the server (a2a-marketplace-service deal-room); this file
// only shows it.
//
//   Arena   the agent's verified Negotiation capability and the loop:
//           COMPETE → MEASURE → IMPROVE → RE-VERIFY → REPUTATION
//   Watch   a match replayed for spectators: both hidden limits revealed, the
//           ZOPA, every offer, then the "why this match mattered" card
//   Hire    agents found by verified capability, hired to negotiate a buy
//   Record  verified matches, improvements and applied interventions

import { dealRoomApi } from "./kult.js";
import { archetype } from "./data.js";

const DIMS = ["valueCapture", "strategicPatience", "counterpartyReading", "dealCompletion"];
const usd = (n) => (n === null || n === undefined ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const num = (n, d = 1) => (n === null || n === undefined ? "—" : Number(n).toFixed(d).replace(/\.0$/, ""));
const pct = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);
const short = (h, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-6)}` : "—");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createDealRoom(ctx) {
  const { el, t, toast, sound, burst, portrait, ago, player } = ctx;
  const s = { tab: "arena", info: null, prof: null, root: null, run: 0, minNeg: 0, minRel: 0 };
  const alive = (run) => run === s.run && s.root?.isConnected && !s.root.closest("[hidden]");
  const err = (e) => el("div", { class: "ag-error" }, el("b", {}, t("dr.offline")), el("small", { class: "muted" }, e.message));
  // Percentages from a handful of tests read as guarantees ("Reliability
  // 100%" after one match). Below MIN_SAMPLE, show the count and say so.
  const MIN_SAMPLE = 5;
  const rates = (x) => {
    const n = Number(x.verifiedMatches) || 0;
    if (n < MIN_SAMPLE) {
      const won = x.successRate === null || x.successRate === undefined ? null : Math.round(x.successRate * n);
      return [el("span", {}, t("dr.success"), " ", el("b", {}, won === null ? "—" : t("dr.ofTests", { k: won, n }))),
        el("span", { class: "dr-few" }, t("dr.fewTests", { n: MIN_SAMPLE }))];
    }
    return [el("span", {}, t("dr.success"), " ", el("b", {}, pct(x.successRate))), el("span", {}, t("dr.reliability"), " ", el("b", {}, pct(x.reliability)))];
  };
  const confChip = (c) => el("span", { class: `dr-conf ${c ? c.toLowerCase() : "none"}` }, c ? t(`dr.conf.${c.toLowerCase()}`) : t("dr.unrated"));
  const dimName = (d) => t(`dr.dim.${d}`);
  /** Native append prints null; skip the empty slots. */
  const add = (node, ...kids) => node.append(...kids.filter((k) => k !== null && k !== undefined && k !== false && k !== ""));

  /** Open the Deal Room on the player's agent, or straight onto a match. */
  async function open(root, matchId = null) {
    s.root = root; const run = ++s.run;
    root.replaceChildren(el("div", { class: "muted" }, t("dr.loading")));
    try { s.info = await dealRoomApi.arena(); } catch (e) { if (alive(run)) root.replaceChildren(err(e)); return; }
    if (matchId) return watch(matchId, { back: player() ? () => open(root) : null });
    await draw(run);
  }
  const stop = () => { s.run += 1; };

  async function draw(run = ++s.run) {
    const me = player();
    if (!me) { s.root.replaceChildren(err(new Error(t("dr.needAgent")))); return; }
    try { s.prof = await dealRoomApi.profile(me.agent.id); } catch (e) { if (alive(run)) s.root.replaceChildren(err(e)); return; }
    if (!alive(run)) return;
    const tabs = el("div", { class: "lb-tabs dr-tabs", role: "tablist" },
      ["arena", "versus", "hire", "record"].map((k) => el("button", { type: "button", role: "tab", class: s.tab === k ? "on" : "", "aria-selected": String(s.tab === k), onclick: () => { s.tab = k; sound.play("pop"); draw(); } }, t(`dr.tab.${k}`))));
    const body = el("div", { class: "dr-body" });
    s.root.replaceChildren(header(), tabs, body);
    if (s.tab === "arena") arenaTab(body, run);
    else if (s.tab === "versus") versusTab(body, run);
    else if (s.tab === "hire") hireTab(body, run);
    else recordTab(body);
  }

  function header() {
    return el("div", { class: "dr-head2" },
      el("div", {},
        el("div", { class: "eyebrow" }, t("dr.eyebrow")),
        el("h2", { class: "place-title" }, t("dr.title")),
        el("p", { class: "muted" }, t("dr.desc"))),
      el("div", { class: "dr-head-side" },
        el("div", { class: "dr-cert", title: t("dr.certTip") }, el("i"), el("b", {}, t("dr.verifiedArena")), el("span", {}, t("dr.negotiation"))),
        engineChip()));
  }
  /** Which mind plays the agents: 0G Compute (the AI engine) or the trait policy; red when the AI is down. */
  function engineChip() {
    const st = s.info?.engineStatus;
    if (!st) return null;
    if (!st.available) return el("div", { class: "dr-engine off", title: st.detail ?? "" }, el("i"), el("b", {}, t("dr.engineOff")), el("small", {}, st.detail ?? ""));
    return el("div", { class: `dr-engine ${st.mode}` }, el("i"), el("b", {}, st.mode === "llm" ? t("dr.engineAi") : t("dr.enginePolicy")), el("small", {}, st.engine));
  }
  const engineDown = () => s.info?.engineStatus && !s.info.engineStatus.available;

  // ------------------------------------------------------------------ payments
  // On-chain $ARENA (0G): the first call returns a permit, the player's wallet
  // signs it (free, no gas), the second call pays. The permit is checked here
  // before it is signed: our wallet, the price shown, a short deadline.
  async function signedCall(call, expectArena, onSign) {
    const first = await call({});
    if (first?.stage !== "sign") return first;
    const p = first.permit, msg = p.message;
    const want = BigInt(Math.round(expectArena * 100)) * 10n ** 16n;
    if (BigInt(msg.value) !== want) throw new Error(t("dr.payMismatch"));
    if (Number(msg.deadline) * 1000 - Date.now() > 3600_000) throw new Error(t("dr.payMismatch"));
    onSign?.();
    const typedData = {
      domain: { name: p.domain.name, version: p.domain.version, chainId: p.domain.chainId, verifyingContract: p.domain.verifyingContract },
      types: {
        EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
        Permit: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }]
      },
      primaryType: "Permit",
      message: { owner: msg.owner, spender: msg.spender, value: msg.value, nonce: msg.nonce, deadline: msg.deadline }
    };
    const signature = await ctx.signPermit(typedData);
    return call({ paymentRef: first.payment.payment_ref, signature });
  }
  const txLink = (hash) => hash && /^0x[0-9a-f]{64}$/i.test(hash) ? el("a", { class: "dr-tx", href: `https://chainscan.0g.ai/tx/${hash}`, target: "_blank", rel: "noopener" }, t("dr.viewTx"), " ↗") : null;

  // ------------------------------------------------------------------ arena
  function capabilityCard() {
    const c = s.prof.capability, me = player().agent;
    return el("section", { class: "dr-cap" },
      el("div", { class: "dr-cap-top" },
        portrait(me.archetype, "lf big"),
        el("div", {}, el("small", { class: "muted" }, t("dr.capOf", { name: me.name })), el("div", { class: "dr-cap-name" }, t("dr.domain"), " › ", el("b", {}, t("dr.negotiation")))),
        el("div", { class: "dr-rating" }, el("b", {}, num(c.rating)), confChip(c.confidence), el("small", {}, t("dr.matches", { n: c.verifiedMatches })))),
      el("div", { class: "dr-dims" }, DIMS.map((d) => {
        const r = c.dimensions?.[d]?.rating;
        return el("div", { class: "dr-dim" }, el("span", {}, dimName(d)), el("div", { class: "bar" }, el("i", { style: `--c:var(--gold);width:${r ?? 0}%` })), el("b", {}, num(r)));
      })),
      el("div", { class: "dr-cap-foot" },
        ...rates(c),
        s.prof.hirePriceArena ? el("span", {}, t("dr.hireable"), " ", el("b", {}, `${s.prof.hirePriceArena} $ARENA`)) : el("span", { class: "muted" }, t("dr.notHireable"))));
  }

  function stepper(active) {
    const steps = ["compete", "measure", "improve", "reverify", "reputation"];
    const at = steps.indexOf(active);
    return el("ol", { class: "dr-steps" }, steps.map((k, i) => el("li", { class: i < at ? "done" : i === at ? "on" : "" }, el("b", {}, String(i + 1)), el("span", {}, t(`dr.step.${k}`)))));
  }

  function arenaTab(body, run) {
    const loop = s.prof.loop;
    const action = el("section", { class: "dr-action" });
    if (!loop) {
      const last = s.prof.improvements?.[0];
      add(action, stepper(last ? "reputation" : "compete"),
        last ? improvementLine(last) : null,
        el("p", { class: "muted" }, t("dr.compete")),
        el("div", { class: "dr-btns" },
          el("button", { type: "button", class: "btn ghost", disabled: engineDown() ? true : null, onclick: () => start("TRAINING") }, t("dr.train")),
          el("button", { type: "button", class: "btn primary", disabled: engineDown() ? true : null, onclick: () => start("VERIFIED") }, t("dr.prove"))),
        el("p", { class: "tiny muted" }, t("dr.trainNote")));
    } else if (loop.status === "OPEN") {
      add(action, stepper("improve"),
        el("div", { class: "dr-gap" }, el("small", {}, t("dr.gapFound")), el("b", {}, t("dr.gapLine", { dim: dimName(loop.gap.dimension), n: num(loop.gap.score) })),
          el("button", { type: "button", class: "btn ghost small", onclick: () => watch(loop.baseline.id, { back: () => draw() }) }, t("dr.watchBaseline"))),
        el("p", { class: "muted" }, t("dr.improveNote")),
        shop(loop, run),
        el("button", { type: "button", class: "linkish", onclick: async () => { try { await dealRoomApi.abandon(loop.pairId); toast(t("dr.abandoned")); draw(); } catch (e) { toast(e.message, "bad"); } } }, t("dr.abandon")));
    } else {
      const iv = loop.intervention;
      add(action, stepper("reverify"),
        el("div", { class: "dr-proof" },
          el("div", { class: "eyebrow" }, t("dr.applied")),
          el("b", {}, iv.service?.name, el("small", {}, ` · ${iv.service?.provider.name}`)),
          el("dl", {},
            el("dt", {}, "intervention_id"), el("dd", {}, short(iv.intervention_id, 8)),
            el("dt", {}, "intervention_type"), el("dd", {}, iv.intervention_type),
            el("dt", {}, "target_capability"), el("dd", {}, iv.target_capability),
            el("dt", {}, "content_hash"), el("dd", { title: iv.content_hash }, short(iv.content_hash, 16)),
            el("dt", {}, "applied_at"), el("dd", {}, new Date(iv.applied_at).toLocaleString()))),
        el("p", { class: "muted" }, t("dr.retestNote")),
        el("div", { class: "dr-btns" }, el("button", { type: "button", class: "btn primary", disabled: engineDown() ? true : null, onclick: () => retest(loop.pairId) }, t("dr.retest"))));
    }
    body.append(el("div", { class: "dr-grid" }, capabilityCard(), action));
  }

  function improvementLine(i) {
    const up = i.delta > 0;
    return el("div", { class: `dr-improve ${up ? "up" : "down"}` },
      el("small", {}, t("dr.lastImprovement")),
      el("b", {}, `${num(i.baselineScore)} → ${num(i.retestScore)}`), el("span", {}, `${up ? "+" : ""}${num(i.delta)}`),
      el("small", { class: "muted" }, t("dr.poweredBy", { what: t(`dr.via.${i.service.type}`), who: i.service.provider.name })));
  }

  function shop(loop, run) {
    const box = el("div", { class: "dr-shop" });
    const spend = el("small", { class: "muted" }, t("dr.spendableLoading"));
    let all = false;
    const list = el("div", { class: "dr-services" });
    const fill = () => {
      const svcs = all ? s.info.services : loop.recommended;
      list.replaceChildren(...svcs.map((v) => el("div", { class: `dr-svc${v.capability === loop.gap.dimension ? " match" : ""}` },
        el("div", { class: "dr-svc-top" }, el("span", { class: "kind" }, t(`dr.type.${v.type}`)), el("small", {}, dimName(v.capability))),
        el("b", {}, v.name), el("small", { class: "muted" }, `${v.provider.name} · ${v.provider.title}`),
        el("p", {}, v.summary),
        el("button", { type: "button", class: "btn gold small", onclick: (e) => buy(loop.pairId, v, e.currentTarget) }, t("dr.buy", { n: v.priceArena })))));
    };
    fill();
    box.append(el("div", { class: "dr-shop-head" }, el("b", {}, t("dr.shopTitle")), spend,
      el("button", { type: "button", class: "linkish", onclick: (e) => { all = !all; e.currentTarget.textContent = t(all ? "dr.showMatched" : "dr.showAll"); fill(); } }, t("dr.showAll"))), list,
      el("p", { class: "tiny muted" }, t("dr.claimNote")));
    dealRoomApi.wallet().then((w) => { if (alive(run)) spend.textContent = t(w.rail === "arena-onchain" ? "dr.inWallet" : "dr.spendable", { n: num(w.spendable, 2) }); }).catch(() => { if (alive(run)) spend.textContent = t("dr.spendableOff"); });
    return box;
  }

  async function buy(pairId, svc, btn) {
    btn.disabled = true;
    const label = btn.textContent;
    try {
      const out = await signedCall((extra) => dealRoomApi.buy(pairId, svc.id, extra), svc.priceArena, () => { btn.textContent = t("dr.signing"); toast(t("dr.signPrompt", { n: svc.priceArena }), "info"); });
      sound.play("coin");
      toast(t("dr.bought", { name: svc.name }), "good");
      ctx.onPurchase?.(svc, out);
      await draw();
      if (out?.payment?.txHash) toast(t("dr.paidOnChain", { n: svc.priceArena }), "good");
    } catch (e) { btn.disabled = false; btn.textContent = label; toast(e.message, "bad"); }
  }

  async function start(kind) {
    try {
      const m = await dealRoomApi.start(player().agent.id, kind);
      sound.play("go");
      await watch(m.id, { back: () => draw() });
    } catch (e) { toast(e.message, "bad"); }
  }
  async function retest(pairId) {
    try { const m = await dealRoomApi.retest(pairId); sound.play("go"); await watch(m.id, { back: () => draw() }); }
    catch (e) { toast(e.message, "bad"); }
  }

  // ------------------------------------------------------------------ watch (spectator)
  async function watch(id, { back } = {}) {
    const run = ++s.run, root = s.root;
    root.replaceChildren(el("div", { class: "dr-live" }, el("div", { class: "radar" }), el("div", { class: "scan-t" }, t("dr.negotiating"))));
    let m;
    for (let i = 0; ; i++) {
      try { m = await dealRoomApi.match(id); } catch (e) { if (alive(run)) root.replaceChildren(err(e)); return; }
      if (!alive(run)) return;
      if (m.status !== "RUNNING") break;
      await wait(Math.min(2000, 300 + i * 150));
    }
    const sc = m.scenario, agentName = m.agent?.name ?? "Agent";
    const lo = Math.min(sc.sellerMin, ...m.transcript.filter((x) => x.price).map((x) => x.price)) * 0.94, hi = sc.openingAsk * 1.03;
    const pos = (v) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
    const askDot = el("i", { class: "zp-ask" }), offerDot = el("i", { class: "zp-offer" });
    const zopa = el("div", { class: "zp" },
      el("div", { class: "zp-band", style: `left:${pos(sc.sellerMin)};width:calc(${pos(sc.buyerMax)} - ${pos(sc.sellerMin)})` }, el("span", {}, t("dr.zopa"))),
      el("div", { class: "zp-line seller", style: `left:${pos(sc.sellerMin)}` }, el("small", {}, t("dr.sellerFloor")), el("b", {}, usd(sc.sellerMin))),
      el("div", { class: "zp-line buyer", style: `left:${pos(sc.buyerMax)}` }, el("small", {}, t("dr.agentLimit")), el("b", {}, usd(sc.buyerMax))),
      askDot, offerDot);
    const roundTag = el("b", {}, t("dr.round", { n: 1, of: sc.roundLimit }));
    const log = el("div", { class: "chat dr-chat" });
    const end = el("div", { class: "dr-end" });
    const skip = el("button", { type: "button", class: "btn ghost small" }, t("dr.skip"));
    let fast = false;
    skip.onclick = () => { fast = true; skip.hidden = true; };
    root.replaceChildren(
      el("div", { class: "dr-watch-top" },
        back ? el("button", { type: "button", class: "btn ghost small", onclick: back }, `‹ ${t("dr.back")}`) : el("span"),
        el("span", { class: `dr-kind ${m.kind.toLowerCase()}` }, m.isRetest ? t("dr.kind.retest") : t(`dr.kind.${m.kind}`)), skip),
      el("div", { class: "dr-vs" },
        el("div", { class: "dr-party" }, portrait(m.agent?.archetype ?? "hybrid", "lf big"), el("div", {}, el("small", {}, t("dr.buyer")), el("b", {}, agentName))),
        el("div", { class: "dr-mid" }, el("div", { class: "dr-asset" }, sc.asset.name), el("small", { class: "muted" }, sc.publicFraming), el("div", { class: "dr-roundtag" }, roundTag, el("small", {}, ` · ${t(`dr.bucket.${sc.difficulty.bucket}`)}`))),
        el("div", { class: "dr-party r" }, el("div", {}, el("small", {}, t("dr.seller")), el("b", {}, sc.asset.seller)), el("span", { class: "lf big dr-bot" }, "◆"))),
      zopa, el("p", { class: "tiny muted dr-irony" }, t("dr.irony")), log, end);

    // Replay the transcript turn by turn.
    for (const turn of m.transcript) {
      if (!alive(run)) return;
      if (["rejected-response", "timeout"].includes(turn.action)) {
        log.append(el("div", { class: "msg sys" }, t(turn.action === "timeout" ? "dr.timeout" : "dr.rejected", { why: turn.error ?? "" })));
        continue;
      }
      roundTag.textContent = t("dr.round", { n: turn.round, of: sc.roundLimit });
      const mine = turn.actor === "agent";
      if (!fast) { const typing = el("div", { class: `msg ${mine ? "me" : "them"} typing` }, el("span"), el("span"), el("span")); log.append(typing); log.scrollTop = log.scrollHeight; await wait(mine ? 650 : 800); typing.remove(); }
      if (!alive(run)) return;
      if (turn.price) { if (mine) { offerDot.style.left = pos(turn.price); offerDot.dataset.v = usd(turn.price); } else if (["open", "counter"].includes(turn.action)) { askDot.style.left = pos(turn.price); askDot.dataset.v = usd(turn.price); } }
      const verb = mine ? t(`dr.act.${turn.action}`) : t(`dr.bot.${turn.action}`);
      log.append(el("div", { class: `msg ${mine ? "me" : "them"}` },
        el("small", {}, mine ? agentName : sc.asset.seller, ` · ${verb}`, turn.price ? ` · ${usd(turn.price)}` : "", turn.bluff ? el("em", { class: "dr-bluff" }, t("dr.bluff")) : null),
        turn.message || "—"));
      log.scrollTop = log.scrollHeight;
      if (!fast) sound.play("type");
    }
    skip.hidden = true;
    if (!alive(run)) return;
    if (m.closePrice) { offerDot.style.left = pos(m.closePrice); askDot.style.left = pos(m.closePrice); zopa.classList.add("closed"); }
    end.append(resultCard(m));
    if (m.status === "COMPLETED") {
      sound.play(m.outcome === "DEAL" ? "deal" : "lose");
      if (m.outcome === "DEAL") { const r = end.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + 40, "#ffc94d", 36); }
      ctx.onMatch?.(m);
    }
    log.scrollTop = log.scrollHeight;
  }

  /** "WHY THIS MATCH MATTERED" (spec §17): the shareable unit. */
  function resultCard(m) {
    if (m.status !== "COMPLETED") {
      return el("div", { class: "dr-card fail" }, el("div", { class: "dr-card-h" }, t(m.status === "VOID" ? "dr.void" : "dr.incomplete")),
        el("p", {}, m.failureDetail ?? ""), el("p", { class: "tiny muted" }, t("dr.noRating")));
    }
    const c = m.card, name = (m.agent?.name ?? "Agent").toUpperCase();
    const imp = c.improvement;
    const card = el("div", { class: `dr-card ${c.headline === "WON_DEAL" ? "win" : "lose"}` },
      el("div", { class: "dr-card-eyebrow" }, t("dr.why")),
      el("div", { class: "dr-card-h" }, t(`dr.head.${c.headline}`, { name })),
      el("div", { class: "dr-card-row" },
        c.paid ? el("span", {}, t("dr.paid"), " ", el("b", {}, usd(c.paid))) : null,
        el("span", {}, t("dr.range"), " ", el("b", {}, `${usd(c.rangeLow)}–${usd(c.rangeHigh)}`))),
      el("div", { class: "dr-card-score" }, el("span", {}, t("dr.negotiation")), el("b", {}, num(c.negotiation))),
      el("div", { class: "dr-card-dims" }, DIMS.map((d) => el("span", { class: d === c.weakness?.dimension ? "weak" : "" }, dimName(d), el("b", {}, num(m.scores?.[d]))))),
      c.weakness ? el("div", { class: "dr-card-weak" }, t("dr.weakness", { dim: dimName(c.weakness.dimension), n: num(c.weakness.score) })) : null,
      imp ? el("div", { class: `dr-card-imp ${imp.delta > 0 ? "up" : "down"}` },
        el("small", {}, t(imp.delta > 0 ? "dr.verifiedImprovement" : "dr.verifiedNoImprovement")),
        el("b", {}, `${num(imp.from)} → ${num(imp.to)}`),
        el("small", {}, t("dr.poweredBy", { what: t(`dr.via.${imp.service.type}`), who: imp.service.provider.name }))) : null,
      el("div", { class: "tiny muted" }, m.reputationBearing ? t("dr.counts") : t(m.kind === "SERVICE" ? "dr.serviceNote" : "dr.trainingNote")),
      el("div", { class: "dr-btns" },
        el("button", { type: "button", class: "btn small", onclick: () => share(m) }, t("dr.share")),
        el("button", { type: "button", class: "btn ghost small", onclick: (e) => verification(m, e.currentTarget) }, t("dr.verify"))));
    return card;
  }

  async function share(m) {
    const url = `${location.origin}${location.pathname}?dealroom=${encodeURIComponent(m.id)}`;
    const name = m.agent?.name ?? "Agent";
    const text = m.card?.improvement ? t("dr.shareImp", { name, a: num(m.card.improvement.from), b: num(m.card.improvement.to) }) : t("dr.shareText", { name, n: num(m.negotiation) });
    try {
      if (navigator.share) await navigator.share({ title: "KULT Deal Room", text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast(t("okx.copied"), "good"); }
    } catch { /* closed the share sheet */ }
  }

  async function verification(m, btn) {
    const host = btn.closest(".dr-card");
    host.querySelector(".dr-audit")?.remove();
    const box = el("div", { class: "dr-audit" }, el("small", { class: "muted" }, t("dr.loading")));
    host.append(box);
    let a;
    try { a = await dealRoomApi.audit(m.id); } catch (e) { box.replaceChildren(err(e)); return; }
    const v = a.verification, sc = a.match.scenario, cp = sc.counterparty, inp = m.scoreInputs ?? {};
    const check = (ok, label) => el("li", { class: ok ? "ok" : ok === null ? "na" : "bad" }, ok ? "✓ " : ok === null ? "– " : "✗ ", label);
    box.replaceChildren(
      el("ul", { class: "dr-checks" },
        check(v.scenarioReproduced, t("dr.chk.scenario")), check(v.scoresReproduced, t("dr.chk.scores")), check(v.appliedBeforeMatch, t("dr.chk.applied"))),
      el("dl", {},
        el("dt", {}, t("dr.v.arena")), el("dd", {}, `${m.arena.certification} · ${m.kind}${m.isRetest ? " · RE-TEST" : ""}`),
        el("dt", {}, t("dr.v.engine")), el("dd", {}, m.engine),
        el("dt", {}, t("dr.v.scoring")), el("dd", {}, a.match.scoringVersion ?? "—"),
        el("dt", {}, t("dr.v.seed")), el("dd", { title: a.match.scenarioSeed }, short(a.match.scenarioSeed, 14)),
        el("dt", {}, t("dr.v.difficulty")), el("dd", {}, `${sc.difficulty.bucket} · ZOPA ${(sc.difficulty.zopaFraction * 100).toFixed(1)}%`),
        el("dt", {}, t("dr.v.counterparty")), el("dd", {}, `open ${usd(cp.openingAsk)} · floor ${usd(cp.floor)} · curve ${cp.profile.concessionExponent} · bluff ${cp.profile.bluffRound ?? "none"}`),
        el("dt", {}, t("dr.v.inputs")), el("dd", {}, `concession ${num(inp.concessionFraction, 3)} / rounds ${num(inp.roundFraction, 2)} · speed −${num(inp.speedPenalty, 3)} · stall −${num(inp.stallPenalty, 2)} · proximity ${num(inp.proximity, 3)} · bluff ${inp.bluffIssued ? (inp.bluffCapitulated ? "capitulated" : inp.bluffCapitulated === false ? "held (+0.1)" : "—") : "none"}`),
        ...a.interventionsInContext.flatMap((i) => [el("dt", {}, i.intervention_type), el("dd", { title: i.content_hash }, `${i.service?.name ?? ""} · ${short(i.content_hash, 14)} · ${new Date(i.applied_at).toLocaleString()}`)])),
      el("p", { class: "tiny muted" }, t("dr.auditNote")));
  }

  // ------------------------------------------------------------------ hire
  async function hireTab(body, run) {
    const list = el("div", { class: "dr-hire-list" }, el("div", { class: "muted" }, t("dr.loading")));
    const minNeg = el("input", { type: "range", min: "0", max: "100", step: "5", value: String(s.minNeg) });
    const minRel = el("input", { type: "range", min: "0", max: "100", step: "10", value: String(s.minRel) });
    const negOut = el("b", {}, String(s.minNeg)), relOut = el("b", {}, `${s.minRel}%`);
    const load = async () => {
      let agents;
      try { agents = await dealRoomApi.discover(s.minNeg, s.minRel); } catch (e) { if (alive(run)) list.replaceChildren(err(e)); return; }
      if (!alive(run)) return;
      const mine = player()?.agent.id;
      list.replaceChildren(...(agents.length ? agents.map((x) => hireRow(x, x.agent.id === mine)) : [el("p", { class: "muted" }, t("dr.noneFound"))]));
    };
    let deb;
    minNeg.oninput = () => { s.minNeg = Number(minNeg.value); negOut.textContent = minNeg.value; clearTimeout(deb); deb = setTimeout(load, 250); };
    minRel.oninput = () => { s.minRel = Number(minRel.value); relOut.textContent = `${minRel.value}%`; clearTimeout(deb); deb = setTimeout(load, 250); };
    body.append(el("p", { class: "muted" }, t("dr.hireDesc")),
      el("div", { class: "dr-filters" },
        el("label", {}, el("span", {}, t("dr.minNeg"), " ", negOut), minNeg),
        el("label", {}, el("span", {}, t("dr.minRel"), " ", relOut), minRel)),
      list);
    await load();
  }

  function hireRow(x, mine) {
    const n = x.negotiation, a = x.agent;
    const row = el("div", { class: "dr-hire" },
      portrait(a.archetype, "lf"),
      el("div", { class: "dr-hire-who" }, el("b", {}, a.name, mine ? el("em", { class: "lb-you" }, t("lb.you")) : null), el("small", {}, `${archetype(a.archetype).name} · ${a.clan}`)),
      el("div", { class: "dr-hire-cap" }, el("b", {}, num(n.rating)), confChip(n.confidence), el("small", {}, t("dr.matches", { n: n.verifiedMatches }))),
      el("div", { class: "dr-hire-stats" }, ...rates(n)),
      mine ? el("span", { class: "muted tiny" }, t("dr.yours")) : el("button", { type: "button", class: "btn gold small", onclick: () => hireForm(row, x) }, t("dr.hireFor", { n: x.hirePriceArena })));
    return row;
  }

  function hireForm(row, x) {
    row.parentElement.querySelector(".dr-hire-form")?.remove();
    const pick = el("select", {}, s.info.assets.map((a) => el("option", { value: a.key }, `${a.name} · ${a.seller}`)));
    const go = el("button", { type: "button", class: "btn primary small" }, t("dr.hireGo", { n: x.hirePriceArena }));
    const out = el("div", { class: "dr-hire-out" });
    const form = el("div", { class: "dr-hire-form" }, el("label", {}, el("span", {}, t("dr.hireAsset", { name: x.agent.name })), pick), go, out);
    go.onclick = async () => {
      go.disabled = true; pick.disabled = true;
      out.replaceChildren(el("span", { class: "muted" }, t("dr.hiring", { name: x.agent.name })));
      let h;
      try {
        const r = await signedCall((extra) => dealRoomApi.hire(x.agent.id, pick.value, extra), x.hirePriceArena, () => out.replaceChildren(el("span", { class: "muted" }, t("dr.signPrompt", { n: x.hirePriceArena }))));
        h = r.hire;
        out.replaceChildren(el("span", { class: "muted" }, t("dr.hiring", { name: x.agent.name })));
      } catch (e) { go.disabled = false; pick.disabled = false; out.replaceChildren(el("span", { class: "bad" }, e.message)); return; }
      for (let i = 0; i < 150 && (h.status === "RUNNING" || h.status === "PENDING"); i++) { await wait(800); try { h = await dealRoomApi.hireStatus(h.id); } catch { /* keep polling */ } }
      if (h.status !== "DELIVERED") { out.replaceChildren(el("span", { class: "bad" }, t("dr.hireFailed", { why: h.result?.error ?? h.status }))); return; }
      const r = h.result;
      sound.play(r.outcome === "DEAL" ? "deal" : "lose");
      ctx.onHire?.(x, h);
      out.replaceChildren(
        el("b", {}, r.outcome === "DEAL" ? t("dr.hireDeal", { name: x.agent.name, asset: r.asset, price: usd(r.closePrice), list: usd(r.listPrice), saved: usd(r.saved) }) : t("dr.hireNoDeal", { name: x.agent.name, asset: r.asset })),
        el("button", { type: "button", class: "btn ghost small", onclick: () => watch(r.matchId, { back: () => draw() }) }, t("dr.watchIt")));
    };
    row.after(form);
  }

  // ------------------------------------------------------------------ record
  function recordTab(body) {
    const p = s.prof;
    body.append(
      el("section", { class: "aw-card" }, el("h3", {}, t("dr.recent")),
        p.recent.length ? el("ul", { class: "dr-rec" }, p.recent.map((m) => el("li", { onclick: () => watch(m.id, { back: () => draw() }), tabindex: "0" },
          el("span", { class: `dr-kind ${m.kind.toLowerCase()}` }, m.isRetest ? t("dr.kind.retest") : t(`dr.kind.${m.kind}`)),
          el("span", { class: "dr-rec-asset" }, m.asset),
          el("span", {}, m.status === "COMPLETED" ? t(`dr.out.${m.outcome}`) : t(`dr.st.${m.status}`)),
          el("b", {}, num(m.negotiation)),
          el("small", { class: "muted" }, ago(m.createdAt))))) : el("p", { class: "muted tiny" }, t("dr.noMatches"))),
      el("section", { class: "aw-card" }, el("h3", {}, t("dr.improvements")),
        p.improvements.length ? el("ul", { class: "dr-rec" }, p.improvements.map((i) => el("li", { onclick: () => watch(i.retestMatchId, { back: () => draw() }), tabindex: "0" },
          el("span", { class: "kind" }, i.service.name), el("span", {}, `${num(i.baselineScore)} → ${num(i.retestScore)}`),
          el("b", { class: i.delta > 0 ? "up" : "down" }, `${i.delta > 0 ? "+" : ""}${num(i.delta)}`), el("small", { class: "muted" }, ago(i.createdAt))))) : el("p", { class: "muted tiny" }, t("dr.noImprovements"))),
      p.interventions?.length ? el("section", { class: "aw-card" }, el("h3", {}, t("dr.owned")),
        el("ul", { class: "dr-rec" }, p.interventions.map((i) => el("li", {},
          el("span", { class: "kind" }, t(`dr.type.${i.intervention_type}`)), el("span", {}, i.service?.name ?? ""),
          el("small", { title: i.content_hash }, short(i.content_hash, 14)), el("small", { class: i.status === "APPLIED" ? "up" : "down" }, i.status))))) : "");
  }

  // ------------------------------------------------------------------ versus (agent vs agent)
  // Your agent against another player's agent: one buys, one sells, each
  // knowing only its own limit. The agents play themselves; ratings move by Elo.
  async function versusTab(body, run) {
    const me = player().agent;
    const top = el("div", { class: "dr-grid" });
    const board = el("section", { class: "aw-card" }, el("h3", {}, t("dr.vs.board")), el("div", { class: "muted" }, t("dr.loading")));
    const recent = el("section", { class: "aw-card" }, el("h3", {}, t("dr.vs.recent")), el("div", { class: "muted" }, t("dr.loading")));
    body.append(el("p", { class: "muted" }, t("dr.vs.desc")), top, el("div", { class: "dr-vs-cols" }, board, recent));
    let mine, rows;
    try { [mine, rows] = await Promise.all([dealRoomApi.versusOf(me.id), dealRoomApi.versusBoard()]); }
    catch (e) { if (alive(run)) body.replaceChildren(err(e)); return; }
    if (!alive(run)) return;
    const r = mine.rating;
    top.append(
      el("section", { class: "dr-cap" },
        el("div", { class: "dr-cap-top" }, portrait(me.archetype, "lf big"),
          el("div", {}, el("small", { class: "muted" }, t("dr.vs.ratingOf", { name: me.name })), el("div", { class: "dr-cap-name" }, t("dr.vs.title"))),
          el("div", { class: "dr-rating" }, el("b", {}, num(r.rating, 0)), el("small", {}, t("dr.vs.record", { w: r.wins, l: r.losses, e: r.evens })))),
        el("p", { class: "tiny muted" }, t("dr.vs.how"))),
      el("section", { class: "dr-action" },
        el("p", { class: "muted" }, t("dr.vs.challengeNote")),
        el("div", { class: "dr-btns" }, el("button", { type: "button", class: "btn primary", disabled: engineDown() ? true : null, onclick: () => challenge() }, t("dr.vs.challenge")))));
    board.replaceChildren(el("h3", {}, t("dr.vs.board")), rows.length ? el("ol", { class: "dr-vs-board" }, rows.map((x) => el("li", { class: x.agent.id === me.id ? "you" : "" },
      el("span", { class: "rk" }, `#${x.rank}`), portrait(x.agent.archetype, "lf"),
      el("span", { class: "who" }, el("b", {}, x.agent.name), el("small", {}, t("dr.vs.record", { w: x.wins, l: x.losses, e: x.evens }))),
      el("b", { class: "rt" }, num(x.rating, 0)),
      x.agent.id === me.id ? el("em", { class: "lb-you" }, t("lb.you")) : el("button", { type: "button", class: "btn ghost small", disabled: engineDown() ? true : null, onclick: () => challenge(x.agent.id) }, t("dr.vs.vs"))))) : el("p", { class: "muted tiny" }, t("dr.vs.noBoard")));
    recent.replaceChildren(el("h3", {}, t("dr.vs.recent")), mine.recent.length ? el("ul", { class: "dr-rec" }, mine.recent.map((m) => el("li", { tabindex: "0", onclick: () => watchVersus(m.id, { back: () => draw() }) },
      el("span", { class: `dr-kind ${m.side}` }, t(`dr.vs.as.${m.side}`)),
      el("span", { class: "dr-rec-asset" }, t("dr.vs.against", { name: m.opponent?.name ?? "—" })),
      el("span", {}, m.status === "COMPLETED" ? t(`dr.out.${m.outcome}`) : t(`dr.st.${m.status}`)),
      el("b", { class: m.delta > 0 ? "up" : m.delta < 0 ? "down" : "" }, m.delta === null ? "—" : `${m.delta > 0 ? "+" : ""}${num(m.delta)}`),
      el("small", { class: "muted" }, ago(m.createdAt))))) : el("p", { class: "muted tiny" }, t("dr.vs.noMatches")));
  }

  async function challenge(opponentAgentId) {
    try { const m = await dealRoomApi.versus(player().agent.id, opponentAgentId); sound.play("go"); await watchVersus(m.id, { back: () => draw() }); }
    catch (e) { toast(e.message, "bad"); }
  }

  async function watchVersus(id, { back } = {}) {
    const run = ++s.run, root = s.root;
    root.replaceChildren(el("div", { class: "dr-live" }, el("div", { class: "radar" }), el("div", { class: "scan-t" }, t("dr.vs.live"))));
    let m;
    for (let i = 0; ; i++) {
      try { m = await dealRoomApi.versusMatch(id); } catch (e) { if (alive(run)) root.replaceChildren(err(e)); return; }
      if (!alive(run)) return;
      if (m.status !== "RUNNING") break;
      await wait(Math.min(2000, 300 + i * 150));
    }
    const sc = m.scenario, buyer = m.buyer ?? { name: "Buyer", archetype: "hybrid" }, seller = m.seller ?? { name: "Seller", archetype: "hybrid" };
    const prices = m.transcript.filter((x) => x.price).map((x) => x.price);
    const lo = Math.min(sc.sellerMin, ...prices) * 0.94, hi = Math.max(sc.buyerMax, ...prices) * 1.04;
    const pos = (v) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
    const askDot = el("i", { class: "zp-ask" }), offerDot = el("i", { class: "zp-offer" });
    const zopa = el("div", { class: "zp" },
      el("div", { class: "zp-band", style: `left:${pos(sc.sellerMin)};width:calc(${pos(sc.buyerMax)} - ${pos(sc.sellerMin)})` }, el("span", {}, t("dr.zopa"))),
      el("div", { class: "zp-line seller", style: `left:${pos(sc.sellerMin)}` }, el("small", {}, t("dr.vs.sellerMin", { name: seller.name })), el("b", {}, usd(sc.sellerMin))),
      el("div", { class: "zp-line buyer", style: `left:${pos(sc.buyerMax)}` }, el("small", {}, t("dr.vs.buyerMax", { name: buyer.name })), el("b", {}, usd(sc.buyerMax))),
      askDot, offerDot);
    const roundTag = el("b", {}, t("dr.round", { n: 1, of: sc.roundLimit }));
    const log = el("div", { class: "chat dr-chat" }), end = el("div", { class: "dr-end" });
    const skip = el("button", { type: "button", class: "btn ghost small" }, t("dr.skip"));
    let fast = false;
    skip.onclick = () => { fast = true; skip.hidden = true; };
    const youSide = m.buyer?.id === player()?.agent.id ? "buyer" : m.seller?.id === player()?.agent.id ? "seller" : null;
    root.replaceChildren(
      el("div", { class: "dr-watch-top" },
        back ? el("button", { type: "button", class: "btn ghost small", onclick: back }, `‹ ${t("dr.back")}`) : el("span"),
        el("span", { class: "dr-kind versus" }, t("dr.vs.kind")), skip),
      el("div", { class: "dr-vs" },
        el("div", { class: "dr-party" }, portrait(buyer.archetype, "lf big"), el("div", {}, el("small", {}, t("dr.vs.as.buyer")), el("b", {}, buyer.name), el("small", { class: "muted" }, m.engines?.buyer ?? ""))),
        el("div", { class: "dr-mid" }, el("div", { class: "dr-asset" }, sc.asset.name), el("small", { class: "muted" }, t("dr.vs.framing", { buyer: sc.asset.buyer, seller: sc.asset.seller })), el("div", { class: "dr-roundtag" }, roundTag)),
        el("div", { class: "dr-party r" }, el("div", {}, el("small", {}, t("dr.vs.as.seller")), el("b", {}, seller.name), el("small", { class: "muted" }, m.engines?.seller ?? "")), portrait(seller.archetype, "lf big"))),
      zopa, el("p", { class: "tiny muted dr-irony" }, t("dr.vs.irony")), log, end);

    for (const turn of m.transcript) {
      if (!alive(run)) return;
      const who = turn.actor === "buyer" ? buyer.name : seller.name;
      if (["rejected-response", "timeout"].includes(turn.action)) {
        log.append(el("div", { class: "msg sys" }, `${who}: `, t(turn.action === "timeout" ? "dr.timeout" : "dr.rejected", { why: turn.error ?? "" })));
        continue;
      }
      roundTag.textContent = t("dr.round", { n: turn.round, of: sc.roundLimit });
      const left = turn.actor === "buyer";
      if (!fast) { const typing = el("div", { class: `msg ${left ? "me" : "them"} typing` }, el("span"), el("span"), el("span")); log.append(typing); log.scrollTop = log.scrollHeight; await wait(700); typing.remove(); }
      if (!alive(run)) return;
      if (turn.price && turn.action === "offer") { if (left) { offerDot.style.left = pos(turn.price); offerDot.dataset.v = usd(turn.price); } else { askDot.style.left = pos(turn.price); askDot.dataset.v = usd(turn.price); } }
      log.append(el("div", { class: `msg ${left ? "me" : "them"}` },
        el("small", {}, who, ` · ${t(`dr.vs.act.${turn.action}`)}`, turn.price ? ` · ${usd(turn.price)}` : ""), turn.message || "—"));
      log.scrollTop = log.scrollHeight;
      if (!fast) sound.play("type");
    }
    skip.hidden = true;
    if (!alive(run)) return;
    if (m.closePrice) { offerDot.style.left = pos(m.closePrice); askDot.style.left = pos(m.closePrice); zopa.classList.add("closed"); }
    end.append(versusCard(m, buyer, seller, youSide));
    if (m.status === "COMPLETED") {
      const won = youSide && m.result?.winner === youSide;
      sound.play(m.outcome === "DEAL" ? (won || !youSide ? "deal" : "pop") : "lose");
      if (won) { const r = end.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + 40, "#ffc94d", 36); }
    }
    log.scrollTop = log.scrollHeight;
  }

  function versusCard(m, buyer, seller, youSide) {
    if (m.status === "VOID") return el("div", { class: "dr-card fail" }, el("div", { class: "dr-card-h" }, t("dr.void")), el("p", {}, m.failureDetail ?? ""), el("p", { class: "tiny muted" }, t("dr.noRating")));
    const res = m.result ?? { share: { buyer: 0, seller: 0 }, winner: null }, rt = m.ratings ?? {};
    const name = (sd) => (sd === "buyer" ? buyer.name : seller.name);
    const head = m.status === "INCOMPLETE" ? t("dr.vs.forfeit", { name: name(m.failedSide) })
      : m.outcome !== "DEAL" ? t("dr.vs.noDeal")
      : res.winner === "even" ? t("dr.vs.even", { price: usd(m.closePrice) })
      : t("dr.vs.won", { name: name(res.winner), price: usd(m.closePrice), n: Math.round(res.share[res.winner] * 100) });
    const delta = (sd) => rt[sd] ? el("span", { class: rt[sd].delta > 0 ? "up" : rt[sd].delta < 0 ? "down" : "" }, `${name(sd)} ${num(rt[sd].before, 0)} → ${num(rt[sd].after, 0)} (${rt[sd].delta > 0 ? "+" : ""}${num(rt[sd].delta)})`) : null;
    return el("div", { class: `dr-card ${youSide && res.winner === youSide ? "win" : youSide && res.winner && res.winner !== "even" ? "lose" : ""}` },
      el("div", { class: "dr-card-eyebrow" }, t("dr.vs.result")),
      el("div", { class: "dr-card-h" }, head),
      m.outcome === "DEAL" ? el("div", { class: "dr-vs-split" },
        el("div", { class: "b", style: `flex:${Math.max(0.02, res.share.buyer)}` }, `${buyer.name} ${Math.round(res.share.buyer * 100)}%`),
        el("div", { class: "s", style: `flex:${Math.max(0.02, res.share.seller)}` }, `${seller.name} ${100 - Math.round(res.share.buyer * 100)}%`)) : null,
      el("div", { class: "dr-card-row" }, el("span", {}, t("dr.range"), " ", el("b", {}, `${usd(m.scenario.sellerMin)}–${usd(m.scenario.buyerMax)}`))),
      el("div", { class: "dr-card-row dr-vs-deltas" }, delta("buyer"), delta("seller")),
      el("div", { class: "tiny muted" }, t("dr.vs.note")));
  }

  return { open, stop, watch, watchVersus };
}
