// Demo backends, in the browser. install() answers every call Kult World
// makes to /api/arena/* (AI Arena gateway, A2A marketplace, Kult OKX
// gateway) and /api/kult/* (Kult backend) with the response shapes the real
// services return, so every screen runs its real code path. State lives in
// localStorage, so a demo survives a reload; kultDemo.reset() starts over.
//
// The Kult OKX gateway routes (/v1/marketplace/okx/*) are the contract the
// real gateway implements: a player links their business to the OKX.AI agent
// they own, OKX users call it per use (x402, USDT on X Layer), the business's
// AI team does the work, and the payment goes to the owner.

import { DEMO_WALLET } from "./mock-privy.js";

const KEY = "kw.demo.state.v3";
const PUBLIC_GATEWAY = "https://aiarena-gateway.kult.games";
const OKX_BASE = "/v1/marketplace/okx";
const DAY = 864e5;
const now = () => Date.now();
const iso = (t = now()) => new Date(t).toISOString();
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const uid = (p) => `${p}-${hex(6)}`;
const pick = (a, r = Math.random()) => a[Math.floor(r * a.length) % a.length];
function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const usdt = (bu) => `${(Number(bu) / 1e6).toFixed(2)}`;

let S = null;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* optional */ } };

// ------------------------------------------------------------------ seed
const TRAITS = (r) => Object.fromEntries(["aggression", "precision", "adaptability", "creativity", "patience", "resilience", "deception", "loyalty"].map((k) => [k, Math.round((0.35 + r() * 0.55) * 100) / 100]));
function agent(id, name, archetype, clan, elo, wins, losses, userId = null, extra = {}) {
  const r = rng(id);
  return {
    id, userId, name, archetype, clan, eloRating: elo, wins, losses, draws: 0, status: "ACTIVE",
    evolutionStage: elo >= 3000 ? "ASCENDED" : elo >= 1500 ? "AWAKENED" : "GENESIS", inftTokenId: String(4000 + Math.floor(r() * 5000)),
    traits: TRAITS(r), description: extra.description || `${name} fights for the ${clan} clan.`, createdAt: iso(now() - (20 + Math.floor(r() * 60)) * DAY), ...extra
  };
}
const CITY = [
  ["Kraken", "ASSASSIN", "SOLANA", 2140], ["Vex", "HYBRID", "ZEROG", 1890], ["Orion", "DEFENDER", "BASE", 1420], ["Saga", "SUPPORT", "OKX", 1310],
  ["Rook", "BERSERKER", "SOLANA", 1755], ["Echo", "TACTICIAN", "ZEROG", 1580], ["Mako", "ASSASSIN", "BASE", 1205], ["Rune", "HYBRID", "SOLANA", 2410],
  ["Talon", "BERSERKER", "OKX", 1660], ["Zephyr", "TACTICIAN", "BASE", 3120], ["Halo", "SUPPORT", "ZEROG", 990], ["Glitch", "DEFENDER", "SOLANA", 1480],
  ["Quill", "HYBRID", "OKX", 1130], ["Blaze", "BERSERKER", "ZEROG", 2015]
];
const TEAMS = [
  ["Arsenal", "Chelsea", "Premier League"], ["Liverpool", "Manchester City", "Premier League"], ["Real Madrid", "Barcelona", "La Liga"],
  ["Bayern Munich", "Borussia Dortmund", "Bundesliga"], ["Inter", "AC Milan", "Serie A"], ["PSG", "Marseille", "Ligue 1"],
  ["Tottenham", "Manchester United", "Premier League"], ["Atletico Madrid", "Sevilla", "La Liga"]
];

function seed(fresh) {
  const me = { userId: "u-demo", wallet: DEMO_WALLET };
  const city = CITY.map(([n, a, c, e], i) => agent(`agt-${n.toLowerCase()}`, n, a, c, e, 12 + i * 3, 6 + i, `u-${n.toLowerCase()}`));
  const mine = fresh ? [] : [
    agent("agt-nova", "Nova", "TACTICIAN", "ZEROG", 1640, 23, 9, me.userId, { description: "Built for smart plays, sharp banter and a long climb up the arena ladder." }),
    agent("agt-ember", "Ember", "BERSERKER", "BASE", 1180, 4, 6, me.userId)
  ];
  const fixtures = TEAMS.map(([home, away, league], i) => ({ id: 51001 + i, home, away, league, kickoffAt: iso(now() + (1 + i * 0.6) * DAY + 3600e3 * (i % 3)) }));
  const others = [
    provider("CREATE", "biz-arcade-owls", "Arcade Owls", "u-kraken", "7342", "4000000", 41, 4.8),
    provider("CREATE", "biz-neon-forge", "Neon Forge Studios", "u-zephyr", "8120", "6500000", 27, 4.6),
    provider("SPORTS", "biz-rune-fc", "Rune FC", "u-rune", "6911", "500000", 118, 4.7),
    provider("SPORTS", "biz-kraken-analytics", "Kraken Analytics", "u-vex", "7788", "750000", 64, 4.5),
    provider("CREATE", "biz-orbit-games", "Orbit Games", "u-blaze", "9031", "3500000", 15, 4.9)
  ];
  return {
    v: 3, fresh: Boolean(fresh), me, agents: [...mine, ...city],
    wallets: Object.fromEntries([...mine, ...city].map((a) => [a.id, a.userId === me.userId ? (a.id === "agt-nova" ? 1840 : 320) : 500])),
    kp: fresh ? 0 : 4210, battles: seedBattles(mine), queue: {},
    businesses: [], providers: fresh ? others : [novaStudio(), ...others], okxJobs: [], fixtures,
    a2aJobs: seedA2A(fresh), negotiations: seedNegotiations(fresh)
  };
}
function novaStudio() {
  const p = provider("CREATE", "biz-my-studio", "Pixel Pirates", "u-demo", "2170", "5000000", 0, 4.8);
  Object.assign(p, { id: "prv-my-studio", enabledAt: iso(now() - 170000), stats: { jobs: 0, earnedBaseUnits: "0", rating: 4.8, reviews: 3 } });
  return p;
}
function provider(business, businessId, name, ownerUserId, okxAgentId, price, jobs, rating) {
  const service = business === "CREATE" ? "build-game" : "match-analysis";
  return {
    id: `prv-${businessId.slice(4)}`, business, businessId, businessName: name, ownerUserId, okxAgentId,
    okx: { agentId: okxAgentId, name, image: null, owner: `0x${hex(20)}`, agentWallet: `0x${hex(20)}`, registry: "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432", chain: "X Layer (196)" },
    payTo: `0x${hex(20)}`, prices: { [service]: price }, enabled: true, linkedAt: iso(now() - 12 * DAY),
    stats: { jobs, earnedBaseUnits: String(jobs * Number(price)), rating, reviews: Math.round(jobs * 0.6) }
  };
}
function seedBattles(mine) {
  if (!mine.length) return [];
  return [
    { id: "btl-old-1", status: "COMPLETED", gameId: "robowar", mode: "RANKED", agentIds: ["agt-nova", "agt-kraken"], result: { winnerId: "agt-nova", loserId: "agt-kraken", rounds: 1 }, createdAt: iso(now() - 3 * 3600e3), endedAt: iso(now() - 3 * 3600e3 + 120e3) },
    { id: "btl-old-2", status: "COMPLETED", gameId: "warzone", mode: "RANKED", agentIds: ["agt-nova", "agt-echo"], result: { winnerId: "agt-echo", loserId: "agt-nova", rounds: 1 }, createdAt: iso(now() - 26 * 3600e3), endedAt: iso(now() - 26 * 3600e3 + 90e3) }
  ];
}
function a2aJob(id, creator, erc, status, gameId, prompt, target, req, min, max, createdAgo) {
  return {
    id, status, gameId, prompt, creatorAgentId: creator, creatorErc8004Id: erc, requirementsHash: `0x${hex(32)}`, requirementsRootHash: null,
    target, providerRequirements: req, budget: { minBaseUnits: String(min), maxBaseUnits: String(max), min: usdt(min).replace(/\.?0+$/, ""), max: usdt(max).replace(/\.?0+$/, ""), currency: "USDC" },
    executionWindowSeconds: 86400, parse: { method: "llm+deterministic", confidence: 0.91, warnings: [] },
    agreedPrice: null, providerAgentId: null, providerErc8004Id: null, agreementHash: null, deliverableHash: null, verifiedValue: null, verdict: null,
    tx: { post: `0x${hex(32)}`, fund: null, executing: null, deliver: null, verdict: null, reputation: null },
    fundedAt: null, deliveredAt: null, settledAt: null, postTxHash: null, postBlock: null, explorer: null, lastError: null, createdAt: iso(now() - createdAgo)
  };
}
function seedA2A(fresh) {
  const jobs = [
    a2aJob("job-warzone-precision", fresh ? "agt-rook" : "agt-nova", "42", "NEGOTIATING", "warzone", "Train my agent in Warzone until its precision is at least 75. Trainer needs 1500+ ELO.", { metric: "precision", op: "gte", value: 75 }, [{ metric: "eloRating", op: "gte", value: 1500 }], 250000, 500000, 20 * 3600e3),
    a2aJob("job-highway-distance", "agt-saga", "77", "POSTED", "highway-hustle", "Coach my racer in Highway Hustle to a 2,000 m average distance.", { metric: "distanceCovered", op: "gte", value: 2000 }, [], 500000, 1000000, 5 * 3600e3),
    a2aJob("job-robowar-wins", "agt-glitch", "88", "POSTED", "robowar", "Get my Robowars agent to 10 wins with a trainer that has 60%+ win rate.", { metric: "wins", op: "gte", value: 10 }, [{ metric: "winRate", op: "gte", value: 60 }], 400000, 900000, 2 * 3600e3)
  ];
  const done = a2aJob("job-settled-1", "agt-zephyr", "15", "SETTLED", "warzone", "Raise my agent's adaptability to 70 in Warzone.", { metric: "adaptability", op: "gte", value: 70 }, [], 300000, 600000, 4 * DAY);
  Object.assign(done, { agreedPrice: { baseUnits: "450000", display: "0.45", currency: "USDC" }, providerAgentId: "agt-rune", verifiedValue: 74, verdict: { accepted: true, reason: "Target met under a fresh seed", reportHash: `0x${hex(32)}` }, settledAt: iso(now() - 3 * DAY) });
  for (const k of ["fund", "executing", "deliver", "verdict", "reputation"]) done.tx[k] = `0x${hex(32)}`;
  return [...jobs, done];
}
function seedNegotiations() {
  return [{
    id: "neg-warzone-1", jobId: "job-warzone-precision", providerAgentId: "agt-vex", providerErc8004Id: "51", providerWallet: `0x${hex(20)}`,
    state: "OPEN", turn: "CREATOR", agreedPrice: null, transcriptHash: `0x${hex(32)}`, agreementHash: null, agreementExpiry: null, signatures: { creator: null, provider: null },
    verification: { valid: true, issues: [], transcriptHash: `0x${hex(32)}` },
    messages: [{ seq: 1, role: "PROVIDER", kind: "PROPOSE", price: { baseUnits: "450000", display: "0.45" }, note: "I can get it there within a day.", prevHash: "0x0", digest: `0x${hex(32)}`, signature: `0x${hex(65)}`, signerAddress: `0x${hex(20)}`, expiresAt: 0 }],
    createdAt: iso(now() - 18 * 3600e3)
  }];
}

// ------------------------------------------------------------------ helpers
const mine = () => S.agents.filter((a) => a.userId === S.me.userId);
const agentById = (id) => S.agents.find((a) => a.id === id);
const res = (status, body, headers = {}) => ({ status, body, headers });
const ok = (body) => res(200, body);
const notFound = (what) => res(404, { error: `${what} not found` });
const fail = (status, error) => res(status, { error });

// The player's businesses: one Kult Create studio and one Kult Sports agency
// once they have an agent, named after it (as a player who opened both).
function myBusinesses() {
  const lead = mine()[0];
  if (!lead) return [];
  const veteran = lead.id === "agt-nova";
  if (!S.businesses.length) {
    S.businesses = [
      { business: "CREATE", businessId: "biz-my-studio", name: veteran ? "Pixel Pirates" : `${lead.name} Studios`, ceo: { name: lead.name, archetype: lead.archetype }, credits: 960 },
      { business: "SPORTS", businessId: "biz-my-agency", name: veteran ? "Pixel FC" : `${lead.name} FC`, ceo: { name: lead.name, archetype: lead.archetype }, credits: 1380,
        analysts: [["Juno", "Form"], ["Rio", "Tactics"], ["Vera", "Set pieces"], ["Byte", "Data"]] }
    ];
    save();
  }
  return S.businesses;
}

// ------------------------------------------------------------------ AI Arena
function battleFor(agentId, opponentId, gameId, mode) {
  const b = { id: uid("btl"), status: "IN_PROGRESS", gameId, mode, agentIds: [agentId, opponentId], createdAt: iso(), startedAt: iso() };
  S.battles.unshift(b); save();
  return b;
}
function opponentFor(agentId) {
  const me = agentById(agentId);
  const pool = S.agents.filter((a) => a.userId !== S.me.userId);
  return pool.sort((x, y) => Math.abs(x.eloRating - me.eloRating) - Math.abs(y.eloRating - me.eloRating))[Math.floor(Math.random() * 4)];
}
function endBattle(b, winnerId, loserId) {
  if (b.status === "COMPLETED") return b;
  const w = agentById(winnerId), l = agentById(loserId);
  const dw = 14 + Math.floor(Math.random() * 10), dl = 9 + Math.floor(Math.random() * 8);
  if (w) { w.eloRating += dw; w.wins += 1; S.wallets[w.id] = (S.wallets[w.id] || 0) + (b.mode === "RANKED" ? 40 : 10); }
  if (l) { l.eloRating = Math.max(0, l.eloRating - dl); l.losses += 1; }
  Object.assign(b, { status: "COMPLETED", endedAt: iso(), result: { winnerId, loserId, rounds: 1, eloChange: { [winnerId]: dw, [loserId]: -dl } } });
  save();
  return b;
}
const COMMENTARY = [
  "{w} read the opening perfectly, baited the charge and punished it from range. {l} never found the angle back in.",
  "A scrappy duel that turned on one exchange: {w} held cover, {l} overcommitted, and the arena crowd felt the swing.",
  "{l} pushed early and nearly broke through, but {w}'s patience in the final seconds sealed it."
];

function arena(method, path, q, body, headers) {
  let m;
  if (path === "/v1/auth/privy" && method === "POST") return ok({ accessToken: `demo.${hex(24)}`, refreshToken: `demo-r.${hex(24)}`, expiresIn: 86400, userId: S.me.userId, walletAddress: S.me.wallet, isNewUser: !mine().length });
  if (path === "/v1/auth/refresh") return ok({ accessToken: `demo.${hex(24)}`, expiresIn: 86400 });
  if (path === "/v1/agents" && method === "GET") return ok({ agents: S.agents.filter((a) => a.userId !== S.me.userId), total: 12840, page: 1, pageSize: Number(q.get("pageSize") || 20) });
  if (path === "/v1/agents" && method === "POST") {
    if (!body.name || String(body.name).length < 2) return fail(400, "Name is required");
    const a = agent(uid("agt"), String(body.name).slice(0, 40), body.archetype || "HYBRID", body.clan || "ZEROG", 1000, 0, 0, S.me.userId, { description: body.backstory || "", createdAt: iso() });
    S.agents.unshift(a); S.wallets[a.id] = 0; S.businesses = []; save();
    return res(201, { agent: a });
  }
  if (path.startsWith("/v1/agents/mine")) return ok({ agents: mine(), total: mine().length });
  if ((m = path.match(/^\/v1\/agents\/([^/]+)$/))) { const a = agentById(m[1]); return a ? ok({ agent: a }) : notFound("Agent"); }
  if ((m = path.match(/^\/v1\/agents\/([^/]+)\/evolve-traits$/))) {
    const a = agentById(m[1]); if (!a) return notFound("Agent");
    const k = pick(Object.keys(a.traits)); a.traits[k] = Math.min(0.99, Math.round((a.traits[k] + (body.outcome === "WIN" ? 0.02 : 0.01)) * 100) / 100); save();
    return ok({ agentId: a.id, traits: a.traits, deltas: { [k]: 0.02 } });
  }
  if (path.match(/^\/v1\/agents\/[^/]+\/train$/)) return ok({ job: { id: uid("trn"), status: "QUEUED", type: body.type } });
  if ((m = path.match(/^\/v1\/wallets\/([^/]+)$/))) return ok({ wallet: { id: `w-${m[1]}`, agentId: m[1], solanaAddress: "", balanceArena: S.wallets[m[1]] ?? 0, balanceSol: 0, isFrozen: false } });
  if (path === "/v1/battles" && method === "GET") return ok({ battles: S.battles.filter((b) => b.status === "COMPLETED" && b.agentIds.includes(q.get("agentId"))).slice(0, Number(q.get("limit") || 10)) });
  if (path === "/v1/matchmaking" && method === "POST") { S.queue[body.agentId] = { since: now(), gameId: body.gameId, mode: body.mode }; save(); return ok({ queued: true, agentId: body.agentId }); }
  if ((m = path.match(/^\/v1\/matchmaking\/status\/([^/]+)$/))) {
    const qd = S.queue[m[1]];
    if (!qd) return ok({ status: { inQueue: false } });
    if (now() - qd.since < 4500) return ok({ status: { inQueue: true, waitTimeMs: now() - qd.since, gameId: qd.gameId, mode: qd.mode, joinedAt: qd.since } });
    const b = battleFor(m[1], opponentFor(m[1]).id, qd.gameId, qd.mode);
    delete S.queue[m[1]]; save();
    return ok({ status: { inQueue: false, matchId: b.id } });
  }
  if ((m = path.match(/^\/v1\/matchmaking\/([^/]+)$/)) && method === "DELETE") { delete S.queue[m[1]]; save(); return ok({ left: true }); }
  if (path === "/v1/matchmaking/match/direct") { const b = battleFor(body.agentId, body.opponentId, body.gameId, body.mode); return ok({ match: { battleId: b.id, agentIds: b.agentIds, gameId: b.gameId, mode: b.mode, status: b.status } }); }
  if ((m = path.match(/^\/v1\/battles\/([^/]+)$/))) {
    const b = S.battles.find((x) => x.id === m[1]); if (!b) return notFound("Battle");
    // Robowars runs in the desktop launcher, which reports the result itself.
    if (b.gameId === "robowar" && b.status !== "COMPLETED" && now() - Date.parse(b.createdAt) > 16000) {
      const [me, them] = b.agentIds, win = Math.random() < 0.6;
      endBattle(b, win ? me : them, win ? them : me);
    }
    return ok({ battle: b });
  }
  if ((m = path.match(/^\/v1\/battles\/([^/]+)\/end$/))) { const b = S.battles.find((x) => x.id === m[1]); if (!b) return notFound("Battle"); return ok({ battle: endBattle(b, body.winnerId, body.loserId) }); }
  if (path === "/v1/inference/battle-commentary") return ok({ commentary: pick(COMMENTARY).replaceAll("{w}", body.winnerName).replaceAll("{l}", body.loserName), model: "glm-5.1" });
  if (path.startsWith("/v1/memory/")) return ok({ snapshotRootHash: `0x${hex(32)}` });
  if (path.startsWith("/v1/marketplace/okx")) return okx(method, path.slice(OKX_BASE.length), q, body, headers);
  if (path.startsWith("/v1/marketplace") || path.startsWith("/v1/a2a")) return a2a(method, path, q, body);
  return fail(404, `No demo route for ${method} ${path}`);
}

// ------------------------------------------------------------------ A2A marketplace
function advanceA2A(j) {
  if (!j.fundedAt || ["SETTLED", "REFUNDED"].includes(j.status)) return j;
  const t = now() - Date.parse(j.fundedAt);
  if (t > 9000 && j.status === "ESCROWED") { j.status = "EXECUTING"; j.tx.executing = `0x${hex(32)}`; }
  if (t > 22000 && j.status === "EXECUTING") { j.status = "DELIVERED"; j.deliveredAt = iso(); j.tx.deliver = `0x${hex(32)}`; j.deliverableHash = `0x${hex(32)}`; j.verifiedValue = j.target.value + 3; }
  if (t > 32000 && j.status === "DELIVERED") {
    j.status = "SETTLED"; j.settledAt = iso(); j.tx.verdict = `0x${hex(32)}`; j.tx.reputation = `0x${hex(32)}`;
    j.verdict = { accepted: true, reason: `Measured ${j.verifiedValue} against a target of ${j.target.value} under a fresh seed`, reportHash: `0x${hex(32)}` };
  }
  save();
  return j;
}
function a2a(method, path, q, body) {
  let m;
  const scopeOf = (j) => (["POSTED", "NEGOTIATING"].includes(j.status) ? "open" : ["SETTLED", "REFUNDED", "CANCELLED", "FAILED"].includes(j.status) ? "completed" : "active");
  if (path === "/v1/marketplace/jobs" && method === "GET") {
    S.a2aJobs.forEach(advanceA2A);
    const scope = q.get("scope") || "open";
    const counts = { open: 0, active: 0, completed: 0 }; for (const j of S.a2aJobs) counts[scopeOf(j)]++;
    counts.completed += 37;
    return ok({ jobs: S.a2aJobs.filter((j) => scope === "all" || scopeOf(j) === scope).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), scope, counts });
  }
  if (path === "/v1/marketplace/jobs/parse" || path === "/v1/marketplace/jobs/draft") {
    const p = String(body.prompt || ""), game = /highway/i.test(p) ? "highway-hustle" : /robo/i.test(p) ? "robowar" : "warzone";
    const num = Number((p.match(/(\d{2,4})/) || [])[1] || 70), metric = /distance|m\b/i.test(p) ? "distanceCovered" : /win/i.test(p) ? "wins" : /adapt/i.test(p) ? "adaptability" : "precision";
    const elo = Number((p.match(/(\d{4})\+?\s*ELO/i) || [])[1] || 0);
    const interpretation = { gameId: game, target: { metric, op: "gte", value: num }, providerRequirements: elo ? [{ metric: "eloRating", op: "gte", value: elo }] : [], method: "llm+deterministic", confidence: 0.88, warnings: [], needsReview: false };
    if (path.endsWith("/parse")) return ok(interpretation);
    const toBU = (v) => String(Math.round(Number(v) * 1e6));
    const j = a2aJob(uid("job"), body.creatorAgentId, "42", "DRAFT", game, p, interpretation.target, interpretation.providerRequirements, toBU(body.budgetMin), toBU(body.budgetMax), 0);
    j.tx.post = null; S.a2aJobs.unshift(j); save();
    return ok({ job: j, interpretation });
  }
  if ((m = path.match(/^\/v1\/marketplace\/jobs\/([^/]+)\/confirm$/))) { const j = S.a2aJobs.find((x) => x.id === m[1]); j.status = "POSTED"; j.tx.post = `0x${hex(32)}`; save(); return ok({ job: j, explorer: `https://basescan.org/tx/${j.tx.post}` }); }
  if ((m = path.match(/^\/v1\/marketplace\/jobs\/([^/]+)\/funding-request$/))) {
    const j = S.a2aJobs.find((x) => x.id === m[1]), n = S.negotiations.find((x) => x.jobId === j.id && x.agreementHash);
    if (!n) return fail(409, "Both agents must sign the agreement before escrow can be funded");
    return ok({ jobId: j.id, amount: { baseUnits: n.agreedPrice.baseUnits, display: n.agreedPrice.display, currency: "USDC" }, typedData: {
      domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      types: {}, primaryType: "ReceiveWithAuthorization",
      message: { from: S.me.wallet, to: "0x8a2a5ce3a2a1f2b5d9e0c1b7f4e6d3a2c1b0e9f8", value: n.agreedPrice.baseUnits, validAfter: "0", validBefore: String(Math.floor(now() / 1000) + 3600), nonce: `0x${hex(32)}` } } });
  }
  if ((m = path.match(/^\/v1\/marketplace\/jobs\/([^/]+)\/fund$/))) {
    const j = S.a2aJobs.find((x) => x.id === m[1]), n = S.negotiations.find((x) => x.jobId === j.id && x.agreementHash);
    Object.assign(j, { status: "ESCROWED", fundedAt: iso(), agreedPrice: { ...n.agreedPrice, currency: "USDC" }, providerAgentId: n.providerAgentId, providerErc8004Id: n.providerErc8004Id, agreementHash: n.agreementHash });
    j.tx.fund = `0x${hex(32)}`; save();
    return ok({ txHash: j.tx.fund, blockNumber: 22000000 + Math.floor(Math.random() * 99999), explorer: `https://basescan.org/tx/${j.tx.fund}`, alreadyFunded: false });
  }
  if ((m = path.match(/^\/v1\/marketplace\/jobs\/([^/]+)$/))) { const j = S.a2aJobs.find((x) => x.id === m[1]); if (!j) return notFound("Job"); advanceA2A(j); return ok({ job: j, verification: { valid: true, computedHash: j.requirementsHash }, onChain: null }); }
  if (path === "/v1/marketplace/negotiations" && method === "GET") return ok({ negotiations: S.negotiations.filter((n) => n.jobId === q.get("jobId")) });
  if (path === "/v1/marketplace/negotiations" && method === "POST") {
    const p = agentById(body.providerAgentId), j = S.a2aJobs.find((x) => x.id === body.jobId);
    const n = { id: uid("neg"), jobId: j.id, providerAgentId: p.id, providerErc8004Id: "64", providerWallet: S.me.wallet, state: "OPEN", turn: "PROVIDER", agreedPrice: null, transcriptHash: `0x${hex(32)}`, agreementHash: null, agreementExpiry: null, signatures: { creator: null, provider: null }, verification: { valid: true, issues: [], transcriptHash: `0x${hex(32)}` }, messages: [], createdAt: iso() };
    S.negotiations.push(n); if (j.status === "POSTED") j.status = "NEGOTIATING"; save();
    return ok(n);
  }
  if ((m = path.match(/^\/v1\/marketplace\/negotiations\/([^/]+)\/(offers|respond|agreement)$/))) {
    const n = S.negotiations.find((x) => x.id === m[1]), j = S.a2aJobs.find((x) => x.id === n.jobId);
    const push = (role, kind, baseUnits, note) => n.messages.push({ seq: n.messages.length + 1, role, kind, price: baseUnits ? { baseUnits, display: usdt(baseUnits).replace(/\.?0+$/, "") } : null, note: note || "", prevHash: `0x${hex(32)}`, digest: `0x${hex(32)}`, signature: `0x${hex(65)}`, signerAddress: `0x${hex(20)}`, expiresAt: Math.floor(now() / 1000) + 3600 });
    const last = () => [...n.messages].reverse().find((x) => x.price)?.price?.baseUnits;
    const agree = () => { n.state = "AGREED"; n.turn = null; n.agreedPrice = { baseUnits: last(), display: usdt(last()).replace(/\.?0+$/, ""), currency: "USDC" }; };
    if (m[2] === "agreement") { n.agreementHash = `0x${hex(32)}`; n.agreementExpiry = Math.floor(now() / 1000) + 3600; n.signatures = { creator: `0x${hex(65)}`, provider: `0x${hex(65)}` }; save(); return ok({ negotiation: n, agreementHash: n.agreementHash, signatures: n.signatures }); }
    if (m[2] === "respond") {
      const floor = BigInt(body.floorBaseUnits || j.budget.minBaseUnits), ask = BigInt(last() || j.budget.maxBaseUnits);
      const price = ask - (ask - floor) / 3n;
      if (n.messages.length && BigInt(last()) >= floor && n.messages.at(-1).role === "CREATOR") { push("PROVIDER", "ACCEPT", last(), "Deal."); agree(); }
      else { push("PROVIDER", n.messages.length ? "COUNTER" : "PROPOSE", String(price), "My agent's offer."); n.turn = "CREATOR"; }
      save(); return ok({ decision: { kind: n.messages.at(-1).kind, reason: n.state === "AGREED" ? "The offer cleared my floor." : "Countered within my floor." }, negotiation: n });
    }
    push(body.role, body.kind, body.priceBaseUnits || (body.kind === "ACCEPT" ? last() : null), body.note);
    if (body.kind === "ACCEPT") agree();
    else if (body.kind === "DECLINE") { n.state = "DECLINED"; n.turn = null; }
    else {
      n.turn = body.role === "CREATOR" ? "PROVIDER" : "CREATOR";
      // The other side's agent answers on its own after a moment.
      if (body.role === "CREATOR") { const mid = (BigInt(body.priceBaseUnits) + BigInt(n.messages.at(-2)?.price?.baseUnits || body.priceBaseUnits)) / 2n; push("PROVIDER", "COUNTER", String(mid), "Meet me in the middle."); n.turn = "CREATOR"; }
    }
    save(); return ok(n);
  }
  if ((m = path.match(/^\/v1\/marketplace\/agents\/([^/]+)\/identity$/))) return ok({ identity: { agentId: m[1], status: "WALLET_LINKED", erc8004AgentId: m[1] === "agt-nova" ? "42" : "64", eoaAddress: `0x${hex(20)}`, ownerWallet: S.me.wallet, agentURI: null, cardRootHash: null, registerTxHash: `0x${hex(32)}`, setWalletTxHash: `0x${hex(32)}`, lastError: null } });
  if ((m = path.match(/^\/v1\/marketplace\/agents\/([^/]+)\/register-identity$/))) return ok({ identity: { agentId: m[1], status: "WALLET_LINKED", erc8004AgentId: "64" }, explorer: { registerTx: null, token: null } });
  if ((m = path.match(/^\/v1\/marketplace\/agents\/([^/]+)\/auto-bid$/))) {
    const a = agentById(m[1]);
    if (method === "PUT") { a.autoBid = { enabled: Boolean(body.enabled), floorBaseUnits: body.floorBaseUnits ?? null }; save(); return ok({ enabled: a.autoBid.enabled, agentId: a.id }); }
    return ok(a.autoBid || { enabled: false, floorBaseUnits: null });
  }
  if (path.match(/^\/v1\/marketplace\/discovery\/agents\/[^/]+\/matching-jobs$/)) return ok({ matches: S.a2aJobs.filter((j) => ["POSTED", "NEGOTIATING"].includes(j.status)).map((j) => ({ jobId: j.id, gameId: j.gameId, budget: j.budget })), rejected: [] });
  if (path.startsWith("/v1/a2a/reputation/")) return ok({ agentId: "42", totalFeedback: 12, distinctClients: 9, averageValue: 4.7, completionRatePercent: 92, registry: "0x8004" });
  return fail(404, `No demo route for ${method} ${path}`);
}

// ------------------------------------------------------------------ Kult OKX gateway
export const OKX_SERVICES = {
  SPORTS: [{
    id: "match-analysis", name: "Match analysis", async: false, defaultPrice: "500000",
    summary: "The agency's analysts research the fixture and the CEO agent makes the call: result, score, corners, cards and a scorer, with every analyst's read.",
    input: { type: "object", required: ["fixtureId"], properties: { fixtureId: { type: "string", title: "Fixture", "x-source": "fixtures" } } }
  }],
  CREATE: [{
    id: "build-game", name: "Game build", async: true, defaultPrice: "5000000",
    summary: "The studio's AI team designs, draws, codes, QA-tests and packages a playable browser game from your brief.",
    input: { type: "object", required: ["brief"], properties: {
      brief: { type: "string", title: "Game brief", minLength: 10, maxLength: 600, "x-widget": "textarea", description: "What the player does, the theme and the feel." },
      genre: { type: "string", title: "Genre", enum: ["arcade", "runner", "shooter", "puzzle", "sports"], default: "runner" } } }
  }]
};
const endpointFor = (p, service) => `${PUBLIC_GATEWAY}${OKX_BASE}/p/${p.id}/${service}`;
function providerView(p) {
  const svcs = OKX_SERVICES[p.business].map((s) => ({ ...s, price: p.prices[s.id] ?? s.defaultPrice, endpoint: endpointFor(p, s.id) }));
  return { ...p, services: svcs };
}
// Live buyers for the player's own provider: calls arrive over time once it
// is enabled, as they would from OKX.AI.
function incomingJobs(p) {
  if (!p.enabled || p.ownerUserId !== S.me.userId || !p.enabledAt) return;
  const due = Math.min(6, Math.floor((now() - Date.parse(p.enabledAt)) / 40000));
  const have = S.okxJobs.filter((j) => j.providerId === p.id && j.buyerKind === "okx").length;
  for (let i = have; i < due; i++) {
    const svc = OKX_SERVICES[p.business][0], fx = S.fixtures[i % S.fixtures.length];
    const input = p.business === "SPORTS" ? { fixtureId: String(fx.id) } : { brief: pick(["A neon runner where a cat dodges lasers on rooftops", "A pixel shooter defending X Layer from meteor swarms", "A tap-to-jump football juggling game"]), genre: "runner" };
    const job = newJob(p, svc, input, `0x${hex(20)}`, "okx", Date.parse(p.enabledAt) + (i + 1) * 40000);
    finishJob(job, p, true);
  }
}
function newJob(p, svc, input, payer, buyerKind, at = now()) {
  const amount = p.prices[svc.id] ?? svc.defaultPrice;
  const job = { id: uid("okxjob"), providerId: p.id, providerName: p.businessName, okxAgentId: p.okxAgentId, service: svc.id, serviceName: svc.name, status: svc.async ? "RUNNING" : "DELIVERED", input, deliverable: null, error: null, buyerKind,
    payment: { scheme: "x402", network: "eip155:196", asset: "USD₮0", amountBaseUnits: String(amount), amount: usdt(amount), payer, payTo: p.payTo, settled: false, txHash: null, settledAt: null },
    stages: svc.async ? [] : null, createdAt: iso(at), deliveredAt: null };
  S.okxJobs.unshift(job);
  return job;
}
function finishJob(job, p, settle = true) {
  job.deliverable = job.service === "match-analysis" ? analysis(p, job.input.fixtureId) : gameBuild(p, job.input, job.id);
  job.status = "DELIVERED"; job.deliveredAt = job.deliveredAt || iso();
  if (settle) Object.assign(job.payment, { settled: true, txHash: `0x${hex(32)}`, settledAt: iso() });
  p.stats.jobs += 1; p.stats.earnedBaseUnits = String(BigInt(p.stats.earnedBaseUnits) + BigInt(job.payment.amountBaseUnits));
  save();
}
const BUILD_STAGES = [["brief", "Producer wrote the brief", 3], ["design", "Game designer locked the rules", 8], ["art", "Art director set the look", 14], ["code", "Engineer wrote the game", 21], ["qa", "QA bot played the build", 26], ["package", "Publisher packaged the game", 30]];
function advanceJob(job) {
  if (job.status !== "RUNNING") return job;
  const t = (now() - Date.parse(job.createdAt)) / 1000;
  job.stages = BUILD_STAGES.filter(([, , at]) => t >= at).map(([id, line]) => ({ id, line }));
  job.progress = Math.min(1, t / 30);
  if (t >= 30) finishJob(job, S.providers.find((p) => p.id === job.providerId));
  else save();
  return job;
}
function analysis(p, fixtureId) {
  const fx = S.fixtures.find((f) => String(f.id) === String(fixtureId)) || S.fixtures[0];
  const r = rng(`${p.id}:${fx.id}`), biz = S.businesses.find((b) => b.businessId === p.businessId);
  const staff = biz?.analysts || [["Atlas", "Form"], ["Mira", "Tactics"], ["Dex", "Set pieces"]];
  const hp = 0.32 + r() * 0.3, dp = 0.2 + r() * 0.1, outcome = hp > 0.45 ? "HOME" : hp < 0.36 ? "AWAY" : "DRAW";
  const hs = outcome === "HOME" ? 2 : outcome === "DRAW" ? 1 : Math.floor(r() * 2), as = outcome === "AWAY" ? 2 : outcome === "DRAW" ? 1 : Math.floor(r() * 2);
  const side = outcome === "AWAY" ? fx.away : fx.home;
  const scorer = pick({ Arsenal: ["Saka", "Ødegaard"], Chelsea: ["Palmer", "Jackson"], Liverpool: ["Salah", "Núñez"], "Manchester City": ["Haaland", "Foden"], "Real Madrid": ["Vinícius Jr", "Mbappé"], Barcelona: ["Lewandowski", "Yamal"], "Bayern Munich": ["Kane", "Musiala"], "Borussia Dortmund": ["Guirassy", "Brandt"], Inter: ["Lautaro", "Thuram"], "AC Milan": ["Leão", "Pulisic"], PSG: ["Dembélé", "Barcola"], Marseille: ["Greenwood", "Rabiot"], Tottenham: ["Son", "Solanke"], "Manchester United": ["Fernandes", "Højlund"], "Atletico Madrid": ["Griezmann", "Álvarez"], Sevilla: ["Isaac Romero", "Lukébakio"] }[side] || ["the No. 9"], r());
  const reads = {
    Form: `${fx.home} have won 4 of their last 6 at home; ${fx.away} have conceded first in 5 of 8 away games.`,
    Tactics: `${fx.away}'s high line leaves space behind the full-backs, exactly where ${fx.home} like to attack.`,
    "Set pieces": `${fx.home} average 6.1 corners at home; expect a set-piece heavy second half.`,
    Data: `xG trend favours ${side}: ${(1.2 + r()).toFixed(2)} vs ${(0.8 + r() * 0.6).toFixed(2)} over the last five.`
  };
  return {
    fixture: { id: fx.id, match: `${fx.home} vs ${fx.away}`, league: fx.league, kickoffAt: fx.kickoffAt },
    agency: p.businessName,
    analysts: staff.map(([name, specialty]) => ({ name, specialty, read: reads[specialty] || reads.Form, lean: pick(["HOME", "DRAW", "AWAY", outcome, outcome], r()) })),
    ceo: { name: biz?.ceo?.name || S.agents.find((x) => x.userId === p.ownerUserId)?.name || p.businessName, call: `${outcome === "DRAW" ? "A draw" : `${side} to win`}, ${hs}-${as}. The desk agrees on the shape of the game; I back the set-piece edge.` },
    picks: { outcome, score: `${hs}-${as}`, corners: r() > 0.5 ? "Over 9.5" : "Under 9.5", cards: r() > 0.5 ? "Over 3.5" : "Under 3.5", scorer },
    probability: Math.round((outcome === "HOME" ? hp : outcome === "DRAW" ? dp : 1 - hp - dp) * 100) / 100,
    confidence: hp > 0.5 || hp < 0.33 ? "HIGH" : "MEDIUM",
    analysedAt: iso(),
    notAdvice: "Probabilistic analysis, not betting advice."
  };
}
function gameBuild(p, input, seed) {
  const words = String(input.brief || "Arcade game").replace(/[^\w\s]/g, "").split(/\s+/).filter((w) => w.length > 3);
  const title = `${(words[1] || words[0] || "Neon").replace(/^./, (c) => c.toUpperCase())} ${pick(["Rush", "Dash", "Blitz", "Run", "Frenzy"], rng(seed)())}`;
  const params = new URLSearchParams({ title, genre: input.genre || "runner", seed: String(seed), studio: p.businessName });
  return { title, genre: input.genre || "runner", studio: p.businessName, playUrl: `${location.origin}/demo/game.html?${params}`, qa: { passed: true, reachedPlay: true, reachedGameOver: true, restartWorks: true, browserPlaytest: "passed" }, buildSeconds: 30 };
}
const b64json = (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))));
const fromB64json = (s) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0))));

function okx(method, path, q, body, headers) {
  let m;
  for (const p of S.providers) incomingJobs(p);
  if (path === "/me") {
    const list = myBusinesses().map((b) => {
      const p = S.providers.find((x) => x.business === b.business && x.businessId === b.businessId);
      return { ...b, provider: p ? providerView(p) : null, services: OKX_SERVICES[b.business] };
    });
    return ok({ wallet: S.me.wallet, businesses: list });
  }
  if (path === "/challenge" && method === "POST") {
    const id = String(body.okxAgentId || "").replace(/^#/, "");
    if (!/^\d{1,12}$/.test(id)) return fail(400, "Enter your OKX.AI agent ID (a number, e.g. 6180)");
    if (S.providers.some((p) => p.okxAgentId === id && p.ownerUserId !== S.me.userId)) return fail(409, `OKX.AI agent #${id} is already linked to another business`);
    const owner = `0x5ec0${hex(18)}`, nonce = hex(8);
    const message = `Kult World links OKX.AI agent #${id} to ${body.businessName || "my business"}.\nBusiness: ${body.businessId}\nNonce: ${nonce}\nIssued: ${iso()}`;
    return ok({ okx: { agentId: id, name: body.businessName, owner, agentWallet: owner, chain: "X Layer (196)", registry: "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432" }, message, token: `chl.${nonce}.${id}.${owner}`, signer: owner,
      command: `onchainos wallet sign-message --type personal --chain 196 --from ${owner} --message "${message.replace(/\n/g, "\\n")}"` });
  }
  if (path === "/providers" && method === "POST") {
    const [, , id, owner] = String(body.token || "").split(".");
    if (!body.signature || !/^0x[0-9a-f]{130}$/i.test(body.signature)) return fail(400, "Paste the signature from your OKX wallet (0x followed by 130 hex characters)");
    const biz = myBusinesses().find((b) => b.businessId === body.businessId);
    if (!biz || id !== String(body.okxAgentId)) return fail(400, "The link request does not match");
    let p = S.providers.find((x) => x.businessId === biz.businessId);
    if (!p) {
      p = provider(biz.business, biz.businessId, biz.name, S.me.userId, id, OKX_SERVICES[biz.business][0].defaultPrice, 0, null);
      Object.assign(p, { id: `prv-${biz.businessId.slice(4)}`, payTo: owner, linkedAt: iso(), enabled: false, stats: { jobs: 0, earnedBaseUnits: "0", rating: null, reviews: 0 } });
      p.okx.owner = owner; p.okx.agentWallet = owner;
      S.providers.unshift(p);
    }
    save();
    return res(201, providerView(p));
  }
  if ((m = path.match(/^\/providers\/([^/]+)$/)) && method === "PATCH") {
    const p = S.providers.find((x) => x.id === m[1] && x.ownerUserId === S.me.userId); if (!p) return notFound("Provider");
    if (body.prices) for (const [k, v] of Object.entries(body.prices)) if (/^\d+$/.test(String(v))) p.prices[k] = String(v);
    if (typeof body.enabled === "boolean") { if (body.enabled && !p.enabled) p.enabledAt = iso(); p.enabled = body.enabled; }
    save();
    return ok(providerView(p));
  }
  if (path === "/providers" && method === "GET") {
    const kind = q.get("business");
    return ok({ providers: S.providers.filter((p) => p.enabled && (!kind || p.business === kind)).map(providerView) });
  }
  if ((m = path.match(/^\/providers\/([^/]+)$/))) {
    const p = S.providers.find((x) => x.id === m[1]); if (!p) return notFound("Provider");
    const r = rng(p.id), names = ["DeFi Scout", "Atlas Research", "Moonbeam", "Quant Owl", "Hermes"];
    const reviews = p.stats.reviews ? Array.from({ length: 3 }, (_, i) => ({ from: `OKX.AI #${1000 + Math.floor(r() * 9000)}`, name: names[i], stars: r() > 0.25 ? 5 : 4, text: p.business === "SPORTS" ? pick(["Sharp read on the set pieces, landed the score.", "Clear, structured and fast. Will call again.", "The analyst breakdown is the best part."], r()) : pick(["Playable in under a minute. Great value.", "Delivered exactly the brief, QA-tested.", "Fun little game, our community loved it."], r()), at: iso(now() - (i + 1) * DAY) })) : [];
    return ok({ ...providerView(p), reviews });
  }
  if ((m = path.match(/^\/providers\/([^/]+)\/jobs$/))) { const list = S.okxJobs.filter((j) => j.providerId === m[1]).map(advanceJob); return ok({ jobs: list.slice(0, 20) }); }
  if (path === "/fixtures") return ok({ fixtures: S.fixtures.filter((f) => Date.parse(f.kickoffAt) > now()) });
  if ((m = path.match(/^\/jobs\/([^/]+)$/))) { const j = S.okxJobs.find((x) => x.id === m[1]); return j ? ok({ job: advanceJob(j) }) : notFound("Job"); }
  // The A2MCP endpoint OKX users call: 402 with the x402 challenge, then the
  // paid replay runs the job. Same contract as services/okx-payment-proxy.
  if ((m = path.match(/^\/p\/([^/]+)\/([^/]+)$/))) {
    const p = S.providers.find((x) => x.id === m[1]), svc = p && OKX_SERVICES[p.business].find((s) => s.id === m[2]);
    if (!p || !svc) return notFound("Service");
    if (!p.enabled) return fail(503, `${p.businessName} is not taking OKX calls right now`);
    const accepts = [{ scheme: "exact", network: "eip155:196", asset: "0x779ded0c9e1022225f8e0630b35a9b54be713736", amount: String(p.prices[svc.id] ?? svc.defaultPrice), payTo: p.payTo, maxTimeoutSeconds: svc.async ? 3600 : 300, extra: { name: "USD₮0", version: "1", decimals: 6 } }];
    const challenge = { x402Version: 2, resource: { url: endpointFor(p, svc.id), description: `${p.businessName} · ${svc.name}`, mimeType: "application/json" }, accepts, nonce: hex(16), error: "Payment required" };
    const header = headers["payment-signature"] || headers["x-payment"];
    if (!header) return res(402, challenge, { "PAYMENT-REQUIRED": b64json(challenge) });
    let paid;
    try { paid = fromB64json(header); } catch { return fail(400, "Payment header is not valid base64-encoded JSON"); }
    const input = { ...Object.fromEntries(q.entries()), ...(body || {}) };
    for (const k of svc.input.required) if (!input[k]) return fail(400, `${svc.input.properties[k].title} is required`);
    const job = newJob(p, svc, input, paid.payload?.authorization?.from || S.me.wallet, "kult-world");
    if (!svc.async) {
      finishJob(job, p, true);
      return res(200, { job }, { "X-PAYMENT-RESPONSE": b64json({ settled: true, transaction: job.payment.txHash, network: "eip155:196" }) });
    }
    save();
    return res(202, { job, statusUrl: `${PUBLIC_GATEWAY}${OKX_BASE}/jobs/${job.id}` });
  }
  return fail(404, `No demo route for ${method} ${OKX_BASE}${path}`);
}

// ------------------------------------------------------------------ Kult backend
function kultBackend(method, path) {
  if (path === "/player/nonce") return ok({ data: { nonce: hex(12) } });
  if (path === "/player/login") return ok({ data: { token: `demo-kult.${hex(16)}`, player: { wallet_address: S.me.wallet, name: "" } } });
  if (path === "/player/profile") return ok({ data: { cached: false, profile: { walletAddress: S.me.wallet, username: "", kultPoints: S.kp, level: S.kp ? 7 : 1, kultPointsRank: S.kp ? 128 : null, totalGamesPlayed: S.kp ? 42 : 0, completedQuests: 0 } } });
  return fail(404, `No demo route for ${method} ${path}`);
}

// ------------------------------------------------------------------ install
export async function install() {
  const fresh = new URLSearchParams(location.search).has("fresh");
  try { S = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { S = null; }
  if (!S || S.v !== 3 || fresh) { S = seed(fresh); save(); }
  const real = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const isArena = url.pathname.startsWith("/api/arena/"), isKult = url.pathname.startsWith("/api/kult/");
    if (url.origin !== location.origin || (!isArena && !isKult)) return real(input, init);
    const method = (init.method || "GET").toUpperCase();
    const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { body = {}; }
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 260));
    let out;
    try {
      out = isArena ? arena(method, url.pathname.slice("/api/arena".length), url.searchParams, body, headers) : kultBackend(method, url.pathname.slice("/api/kult".length));
    } catch (e) {
      console.error("[demo]", e);
      out = fail(500, "Something went wrong in the demo backend");
    }
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { "Content-Type": "application/json", ...out.headers } });
  };
  window.kultDemo = {
    reset: (opts = {}) => { S = seed(Boolean(opts.fresh)); save(); try { localStorage.removeItem("kw.demo.privy.v1"); } catch { /* optional */ } },
    state: () => S
  };
}
