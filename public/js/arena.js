// $ARENA and the leaderboards in Kult World, wired the way the Kult browser
// (kult-games-v3) does it:
//
//   wallet(root)  the player's real $ARENA: an ERC-20 on 0G Chain held in their
//                 own wallet. Live balance from the token contract, every
//                 on-chain event the backend indexed for that wallet (agent
//                 mint rewards, quest and season rewards, staked match
//                 payouts…), the treasury that pays rewards, and 0G explorer
//                 links for all of it.
//   board(root)   the Leaderboard: AI Arena agents by ELO (league tiers, the
//                 podium, your agent's global rank) and KULT players by Kult
//                 Points, weekly, monthly or all time.

import { arenaApi, chainApi, kultApi, explorer } from "./kult.js";
import { RANKS, rankOf, nextRank, CLANS, archetype, displayName } from "./data.js";

const short = (a, n = 6) => (a ? `${a.slice(0, n)}…${a.slice(-4)}` : "—");
const num = (v) => { const n = typeof v === "string" ? Number.parseFloat(v) : Number(v); return Number.isFinite(n) ? n : null; };
export const arenaAmount = (v, digits = 2) => { const n = num(v); return n === null ? "—" : n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }); };

// What each indexed event means for the player, and its sign.
const EVENTS = {
  AGENT_REWARD_GRANTED: { key: "mint", sign: 1, color: "#b18cff" },
  REWARD_GRANTED: { key: "reward", sign: 1, color: "#ffc94d" },
  DAILY_REWARD_CLAIMED: { key: "daily", sign: 1, color: "#6ff0a6" },
  REFERRAL_REWARD_GRANTED: { key: "referral", sign: 1, color: "#4fd8ff" },
  TOURNAMENT_REWARD_GRANTED: { key: "tournament", sign: 1, color: "#ff7eb6" },
  MATCH_CREATED: { key: "stake", sign: -1, color: "#ff6b7d" },
  MATCH_JOINED: { key: "stake", sign: -1, color: "#ff6b7d" },
  MATCH_SETTLED: { key: "won", sign: 1, color: "#6ff0a6" }
};
const eventAmount = (e) => num(e.args?.amount ?? e.args?.payout ?? e.args?.stakeAmount ?? e.args?.pool);

export function createArena(ctx) {
  const { el, t, toast, sound, ago, portrait, player, goHub, closeAll } = ctx;
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast(t("okx.copied"), "good"); } catch { toast(text); } };
  const extLink = (href, label) => el("a", { class: "ext", href, target: "_blank", rel: "noopener" }, label, " ↗");

  // ------------------------------------------------------------------ wallet
  let walletRun = 0;
  async function wallet(root) {
    const run = ++walletRun, p = player(), address = p?.wallet;
    root.replaceChildren(el("div", { class: "aw-head" },
      el("div", {}, el("div", { class: "eyebrow" }, t("aw.eyebrow")), el("h2", { class: "place-title" }, t("aw.title")), el("p", { class: "muted" }, t("aw.desc")))),
    el("div", { class: "muted aw-loading" }, t("aw.loading")));
    if (!address) { root.append(el("div", { class: "ag-error" }, el("b", {}, t("aw.noWallet")))); return; }
    const [bal, act, treasury, cfg] = await Promise.allSettled([chainApi.balance(address), chainApi.activity(address, 1, 12), chainApi.treasury(), chainApi.config()]);
    if (run !== walletRun) return;
    root.querySelector(".aw-loading")?.remove();
    const balance = bal.status === "fulfilled" ? bal.value : null;
    if (balance !== null) ctx.onBalance?.(num(balance));

    const hero = el("section", { class: "aw-hero" },
      el("img", { class: "aw-coin", src: "art/brand/arena-token.webp", alt: "$ARENA" }),
      el("div", { class: "aw-bal" },
        el("div", { class: "aw-label" }, t("aw.live")),
        el("div", { class: "aw-amount" }, el("b", {}, bal.status === "fulfilled" ? arenaAmount(balance) : "—"), el("span", {}, "$ARENA")),
        bal.status === "rejected" ? el("small", { class: "aw-warn" }, t("aw.balanceOff")) : el("span", { class: "aw-chain" }, el("i"), t("aw.onchain"))),
      el("div", { class: "aw-addr" },
        el("div", { class: "aw-label" }, t("aw.address")),
        el("code", { title: address }, short(address, 10)),
        el("div", { class: "aw-btns" },
          el("button", { type: "button", class: "btn ghost small", onclick: () => copy(address) }, t("okx.copy")),
          extLink(explorer.address(address), t("aw.explorer")))));

    const events = act.status === "fulfilled" ? act.value.events : null;
    const activity = el("section", { class: "aw-card" },
      el("h3", {}, t("aw.activity"), act.status === "fulfilled" && act.value.total ? el("small", {}, t("aw.events", { n: act.value.total })) : null),
      events === null ? el("p", { class: "aw-warn" }, t("aw.activityOff"))
        : !events.length ? el("p", { class: "muted tiny" }, t("aw.noActivity"))
          : el("ul", { class: "aw-events" }, events.map((e) => {
            const kind = EVENTS[e.eventName] || { key: "other", sign: 1, color: "#a98bff" }, amt = eventAmount(e);
            const detail = e.args?.reason || e.args?.category || (e.args?.agentTokenId ? `INFT #${e.args.agentTokenId}` : e.args?.tournamentId ? `#${e.args.tournamentId}` : "");
            return el("li", { style: `--c:${kind.color}` },
              el("span", { class: "dot" }),
              el("div", { class: "ev-main" }, el("b", {}, t(`aw.ev.${kind.key}`)), el("small", {}, [detail, e.occurredAt ? ago(e.occurredAt) : null].filter(Boolean).join(" · "))),
              amt !== null ? el("span", { class: `ev-amt ${kind.sign < 0 ? "out" : "in"}` }, `${kind.sign < 0 ? "−" : "+"}${arenaAmount(amt)}`) : null,
              e.txHash ? extLink(explorer.tx(e.txHash), t("aw.tx")) : null);
          })));

    const earn = el("section", { class: "aw-card" },
      el("h3", {}, t("aw.earnTitle")),
      el("ul", { class: "aw-earn" }, ["mint", "reward", "tournament", "won"].map((k) => el("li", { style: `--c:${EVENTS[Object.keys(EVENTS).find((x) => EVENTS[x].key === k)].color}` }, el("b", {}, t(`aw.ev.${k}`)), el("small", {}, t(`aw.earn.${k}`))))));

    const tr = treasury.status === "fulfilled" ? treasury.value : null, c = cfg.status === "fulfilled" ? cfg.value : null;
    const economy = el("section", { class: "aw-card" },
      el("h3", {}, t("aw.economy")),
      el("div", { class: "aw-stats" },
        el("div", {}, el("b", {}, tr ? arenaAmount(tr.totalRewardsPaid, 0) : "—"), el("span", {}, t("aw.paid"))),
        el("div", {}, el("b", {}, tr ? arenaAmount(tr.remaining, 0) : "—"), el("span", {}, t("aw.remaining")))),
      c?.arenaTokenAddress ? el("div", { class: "aw-contract" }, el("span", { class: "muted tiny" }, t("aw.contract")), extLink(explorer.address(c.arenaTokenAddress), short(c.arenaTokenAddress, 8))) : null,
      c?.rewardDistributorAddress ? el("div", { class: "aw-contract" }, el("span", { class: "muted tiny" }, t("aw.distributor")), extLink(explorer.address(c.rewardDistributorAddress), short(c.rewardDistributorAddress, 8))) : null);

    root.append(hero, el("div", { class: "aw-grid" }, activity, el("div", { class: "aw-side" }, earn, economy)));
  }

  // ------------------------------------------------------------------ leaderboard
  const PAGE = 10;
  const s = { mode: "arena", period: "all_time", tier: null, page: 1, kpPage: 1, entries: null, entriesKey: "", run: 0 };
  const clanOf = (id) => CLANS.find((c) => c.id === String(id || "").toUpperCase());
  const tierOf = (elo) => RANKS.indexOf(rankOf(elo));
  const winRate = (e) => { const g = (e.wins ?? 0) + (e.losses ?? 0) + (e.draws ?? 0); return g ? `${Math.round(((e.wins ?? 0) / g) * 100)}%` : "—"; };
  const clanChip = (id) => { const c = clanOf(id); return c ? el("span", { class: "lb-clan", style: `--c:${c.color}`, title: c.name }, el("img", { src: `art/partners/${c.logo}.webp`, alt: c.name })) : el("span", { class: "lb-clan" }); };
  const badge = (elo) => { const r = rankOf(elo); return el("span", { class: "lb-league", style: `color:${r.color}` }, el("img", { src: `art/${r.badge}`, alt: "" }), el("span", {}, r.name)); };

  // mode ("arena" or "kp") picks the tab; without it the last one stays.
  async function board(root, mode) {
    if (mode === "arena" || mode === "kp") { s.mode = mode; s.page = 1; s.kpPage = 1; }
    const run = ++s.run;
    const tabs = el("div", { class: "lb-tabs", role: "tablist" },
      [["arena", t("lb.arena")], ["kp", t("lb.kp")]].map(([m, label]) => el("button", { type: "button", role: "tab", class: s.mode === m ? "on" : "", "aria-selected": String(s.mode === m), onclick: () => { s.mode = m; s.page = 1; s.kpPage = 1; sound.play("pop"); board(root); } }, label)));
    const period = el("label", { class: "lb-period" }, el("span", {}, t("lb.period")),
      el("select", { onchange: (e) => { s.period = e.target.value; s.page = 1; s.kpPage = 1; board(root); } },
        ["weekly", "monthly", "all_time"].map((v) => el("option", { value: v, ...(v === s.period ? { selected: "" } : {}) }, t(`lb.${v}`)))));
    const main = el("div", { class: "lb-main" }, el("div", { class: "muted" }, t("lb.loading")));
    const side = el("aside", { class: "lb-side" });
    root.replaceChildren(
      el("div", { class: "lb-head" }, el("div", {}, el("div", { class: "eyebrow" }, t("lb.eyebrow")), el("h2", { class: "place-title" }, t("lb.title")), el("p", { class: "muted" }, t(s.mode === "arena" ? "lb.descArena" : "lb.descKp")))),
      el("div", { class: "lb-bar" }, tabs, period),
      el("div", { class: "lb-grid" }, main, side));
    if (s.mode === "arena") await arenaBoard(main, side, run); else await kpBoard(main, side, run);
  }

  async function arenaBoard(main, side, run) {
    const key = s.period;
    if (s.entriesKey !== key || !s.entries) {
      try { s.entries = await arenaApi.leaderboard(100, s.period); s.entriesKey = key; s.fetchedAt = new Date(); }
      catch (e) { if (run === s.run) main.replaceChildren(el("div", { class: "ag-error" }, el("b", {}, t("lb.offline")), el("small", { class: "muted" }, e.message))); return; }
    }
    if (run !== s.run) return;
    const p = player(), mine = new Set((ctx.myAgents?.() || []).map((a) => a.id));
    const elo = (e) => Math.round(e.eloRating ?? e.score ?? 0);
    const list = (s.tier === null ? s.entries : s.entries.filter((e) => tierOf(elo(e)) === s.tier)).map((e, i) => ({ ...e, place: s.tier === null ? e.rank ?? i + 1 : i + 1 }));
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    s.page = Math.min(s.page, pages);

    const chips = el("div", { class: "lb-tiers" },
      el("button", { type: "button", class: s.tier === null ? "on" : "", onclick: () => { s.tier = null; s.page = 1; arenaBoard(main, side, run); } }, t("lb.all")),
      RANKS.map((r, i) => el("button", { type: "button", class: s.tier === i ? "on" : "", style: `--c:${r.color}`, title: `${r.name} · ${r.min.toLocaleString()}+ ELO`, onclick: () => { s.tier = i; s.page = 1; arenaBoard(main, side, run); } }, el("img", { src: `art/${r.badge}`, alt: "" }), el("span", {}, r.name))));

    const name = (e) => displayName(e.name, e.agentId);
    const you = (e) => mine.has(e.agentId) ? el("em", { class: "lb-you" }, t("lb.you")) : null;
    const challenge = (e) => p && !mine.has(e.agentId) ? el("button", { type: "button", class: "btn ghost small lb-fight", title: t("agent.challenge"), onclick: () => { closeAll(); goHub({ id: e.agentId }); } }, t("lb.fight")) : el("span");

    const top = s.page === 1 ? list.slice(0, 3) : [];
    const podium = top.length === 3 ? el("div", { class: "lb-podium" }, [1, 0, 2].map((i) => {
      const e = top[i], r = rankOf(elo(e));
      return el("div", { class: `pod pod-${i + 1}${mine.has(e.agentId) ? " me" : ""}`, style: `--c:${r.color}` },
        el("div", { class: "pod-face" }, portrait(e.archetype || "hybrid", "pf"), el("span", { class: "pod-n" }, String(e.place))),
        el("b", { class: "pod-name" }, name(e), you(e)),
        el("div", { class: "pod-meta" }, clanChip(e.clan), el("img", { class: "pod-badge", src: `art/${r.badge}`, alt: r.name, title: r.name })),
        el("div", { class: "pod-elo" }, elo(e).toLocaleString(), el("small", {}, "ELO")),
        el("div", { class: "pod-step" }));
    })) : null;

    const rows = list.slice((s.page - 1) * PAGE, s.page * PAGE).filter((e) => !(podium && top.includes(e)));
    const table = list.length ? el("div", { class: "lb-table", role: "table" },
      el("div", { class: "lb-row lb-th", role: "row" }, ...["#", t("lb.agent"), t("lb.clan"), t("lb.league"), "ELO", t("lb.wld"), t("pp.winrate"), ""].map((h) => el("span", { role: "columnheader" }, h))),
      rows.map((e) => el("div", { class: `lb-row${mine.has(e.agentId) ? " me" : ""}`, role: "row" },
        el("span", { class: "lb-rank" }, `#${e.place}`),
        el("span", { class: "lb-agent" }, portrait(e.archetype || "hybrid", "lf"), el("span", {}, el("b", {}, name(e), you(e)), el("small", {}, archetype(e.archetype || "hybrid").name))),
        clanChip(e.clan), badge(elo(e)),
        el("span", { class: "lb-elo" }, elo(e).toLocaleString()),
        el("span", { class: "lb-wld" }, el("i", { class: "w" }, e.wins ?? 0), "-", el("i", { class: "l" }, e.losses ?? 0), "-", el("i", {}, e.draws ?? 0)),
        el("span", {}, winRate(e)),
        challenge(e)))) : el("p", { class: "muted lb-empty" }, t(s.tier === null ? "lb.empty" : "lb.emptyTier"));

    // How places are decided and when, so the table and "your rank" can be checked against each other.
    const note = el("p", { class: "muted tiny lb-note" }, t("lb.rule", { time: (s.fetchedAt || new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
    main.replaceChildren(chips, podium || "", table, pager(s.page, pages, (n) => { s.page = n; arenaBoard(main, side, run); }), note);
    void arenaSide(side, run);
  }

  async function arenaSide(side, run) {
    const p = player();
    if (!p) { side.replaceChildren(); return; }
    const a = p.agent, r = rankOf(a.elo), nr = nextRank(a.elo);
    const rankBox = el("b", { class: "lbs-rank" }, "…"), topBox = el("small", { class: "muted" }, "");
    side.replaceChildren(el("div", { class: "lbs-card", style: `--c:${archetype(a.archetype).color}` },
      el("div", { class: "eyebrow" }, t("lb.yourAgent")),
      el("div", { class: "lbs-who" }, portrait(a.archetype, "lf big"), el("div", {}, el("b", {}, a.name), clanChip(a.clan))),
      el("div", { class: "lbs-stat" }, el("span", {}, t("lb.globalRank")), rankBox, topBox),
      el("div", { class: "lbs-league", style: `--c:${r.color}` }, el("img", { src: `art/${r.badge}`, alt: "" }),
        el("div", {}, el("b", { style: `color:${r.color}` }, r.name), el("small", {}, `${a.elo.toLocaleString()} ELO${nr ? ` · ${t("lb.toNext", { n: (nr.min - a.elo).toLocaleString(), rank: nr.name })}` : ""}`))),
      el("div", { class: "bar" }, el("i", { style: `--c:${r.color};width:${nr ? Math.round(((a.elo - r.min) / (nr.min - r.min)) * 100) : 100}%` })),
      el("div", { class: "wl" },
        el("div", {}, el("b", { style: "color:var(--green)" }, a.wins), el("span", {}, t("pp.wins"))),
        el("div", {}, el("b", { style: "color:var(--red)" }, a.losses), el("span", {}, t("pp.losses"))),
        el("div", {}, el("b", {}, a.wins + a.losses ? `${Math.round((a.wins / (a.wins + a.losses)) * 100)}%` : "—"), el("span", {}, t("pp.winrate")))),
      el("button", { type: "button", class: "btn primary small", onclick: () => { closeAll(); goHub(null); } }, t("lb.climb"))));
    const [rank, total] = await Promise.allSettled([arenaApi.rank(a.id), arenaApi.agentTotal()]);
    if (run !== s.run) return;
    const n = rank.status === "fulfilled" ? Number(rank.value?.rank) : null, all = total.status === "fulfilled" ? total.value : 0;
    rankBox.textContent = n ? `#${n.toLocaleString()}` : rank.status === "rejected" && rank.reason?.status !== 404 ? "—" : t("lb.unranked");
    topBox.textContent = n && all ? t("lb.top", { n: Math.max(1, Math.ceil((n / all) * 100)), total: all.toLocaleString() }) : "";
  }

  async function kpBoard(main, side, run) {
    let d;
    try { d = await kultApi.leaderboard(s.kpPage, PAGE, s.period); }
    catch (e) { if (run === s.run) main.replaceChildren(el("div", { class: "ag-error" }, el("b", {}, t("lb.offline")), el("small", { class: "muted" }, e.message))); return; }
    if (run !== s.run) return;
    const p = player(), me = String(p?.wallet || "").toLowerCase();
    const isMe = (e) => me && e.wallet.toLowerCase() === me;
    const who = (e) => e.name || short(e.wallet);
    const top = s.kpPage === 1 ? d.entries.slice(0, 3) : [];
    const podium = top.length === 3 ? el("div", { class: "lb-podium kp" }, [1, 0, 2].map((i) => {
      const e = top[i];
      return el("div", { class: `pod pod-${i + 1}${isMe(e) ? " me" : ""}`, style: "--c:#ffc94d" },
        el("div", { class: "pod-face" }, el("span", { class: "pf kp-face" }, el("img", { src: "art/hub/kp-coin.webp", alt: "" })), el("span", { class: "pod-n" }, String(e.rank))),
        el("b", { class: "pod-name", title: e.wallet }, who(e), isMe(e) ? el("em", { class: "lb-you" }, t("lb.you")) : null),
        el("div", { class: "pod-meta" }, e.level !== null ? el("span", { class: "lb-lv" }, t("pp.level", { n: e.level })) : null),
        el("div", { class: "pod-elo" }, Math.round(e.kultPoints).toLocaleString(), el("small", {}, "KP")),
        el("div", { class: "pod-step" }));
    })) : null;
    const rows = d.entries.filter((e) => !(podium && top.includes(e)));
    const table = d.entries.length ? el("div", { class: "lb-table kp", role: "table" },
      el("div", { class: "lb-row lb-th", role: "row" }, ...["#", t("lb.player"), t("lb.level"), t("pp.kp")].map((h) => el("span", { role: "columnheader" }, h))),
      rows.map((e) => el("div", { class: `lb-row${isMe(e) ? " me" : ""}`, role: "row" },
        el("span", { class: "lb-rank" }, `#${e.rank.toLocaleString()}`),
        el("span", { class: "lb-agent", title: e.wallet }, el("span", { class: "lf kp-face" }, el("img", { src: "art/hub/kp-coin.webp", alt: "" })), el("span", {}, el("b", {}, who(e), isMe(e) ? el("em", { class: "lb-you" }, t("lb.you")) : null), e.name ? el("small", {}, short(e.wallet)) : null)),
        el("span", {}, e.level ?? "—"),
        el("span", { class: "lb-elo" }, Math.round(e.kultPoints).toLocaleString())))) : el("p", { class: "muted lb-empty" }, t("lb.empty"));
    main.replaceChildren(el("p", { class: "muted tiny lb-count" }, t("lb.players", { n: d.total.toLocaleString() })), podium || "", table,
      pager(s.kpPage, d.totalPages, (n) => { s.kpPage = n; kpBoard(main, side, run); }));
    const prof = p?.profile;
    side.replaceChildren(p ? el("div", { class: "lbs-card", style: "--c:#ffc94d" },
      el("div", { class: "eyebrow" }, t("lb.yourKp")),
      el("div", { class: "lbs-stat" }, el("span", {}, t("lb.kpRank")), el("b", { class: "lbs-rank" }, prof?.rank ? `#${Number(prof.rank).toLocaleString()}` : "—")),
      el("div", { class: "aw-stats" },
        el("div", {}, el("b", {}, prof ? Math.round(prof.kultPoints).toLocaleString() : "—"), el("span", {}, t("pp.kp"))),
        el("div", {}, el("b", {}, prof?.level ?? "—"), el("span", {}, t("lb.level")))),
      !prof ? el("p", { class: "muted tiny" }, t("lb.kpOff")) : el("p", { class: "muted tiny" }, t("lb.kpHow"))) : "");
  }

  function pager(page, pages, go) {
    if (pages <= 1) return "";
    const btn = (n, label) => el("button", { type: "button", class: "btn ghost small", ...(n < 1 || n > pages || n === page ? { disabled: "" } : {}), onclick: () => { sound.play("pop"); go(n); } }, label);
    return el("div", { class: "lb-pager" }, btn(page - 1, "‹"), el("span", {}, t("lb.page", { n: page.toLocaleString(), of: pages.toLocaleString() })), btn(page + 1, "›"));
  }

  /** Forget the cached ELO list (after a battle, ranks move). */
  const refresh = () => { s.entries = null; };
  return { wallet, board, refresh };
}
