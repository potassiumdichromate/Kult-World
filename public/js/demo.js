// Kult World's demo mode: a lived-in KULT, entirely in this browser.
//
// DEMO_MODE on the server (config.json "demo") or ?demo=1 in the address
// swaps every backend call in js/kult.js for this stand-in: the Privy sign-in,
// the player's agents and balances, the city's agents, battles and
// matchmaking, the A2A job board and the Kult OKX gateway. It keeps moving
// while you watch: businesses take paid calls, jobs settle, new ones are
// posted. ?demo=fresh starts the player with no agent, so minting can be
// shown. Nothing here reaches a backend, a wallet or a chain; the state lasts
// for the browser tab (sessionStorage).

const KEY = "kw.demo.v1";
const WALLET = "0x7a3f9c2e5b81d04f6e2a9c13b5d7e8f0a4c6b21d";
const EMAIL = "demo@kult.games";
const GATEWAY = "https://aiarena-gateway.kult.games/v1/marketplace/okx";
const USDT0 = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const S = 1000, MIN = 60 * S, H = 60 * MIN, D = 24 * H;

const LEGACY = [
  { identification: "warzonewarriors", name: "Warzone Warriors", url: "https://pub-2c48e58780b648b7a2a77316f7b0aa2c.r2.dev/Game/WarzoneV2/index.html", isDownloadable: false, play_count: 180667, rating: 5 },
  { identification: "highwayhustle", name: "Highway Hustle", url: "https://www.highwayhustle.xyz/", isDownloadable: false, play_count: 2860, rating: 4.5 },
  { identification: "guesstheai", name: "Guess the AI", url: "https://guess-the-ai-frontend.rj838486.workers.dev/#/auto-login", isDownloadable: false, play_count: 2546, rating: 4.5 },
  { identification: "zerogpool", name: "Zero G Pool", url: "https://pub-c57fda34f99145fc8d97b0a6b6faa237.r2.dev/v10/Game/index.html", isDownloadable: false, play_count: 2237, rating: 4.5 },
  { identification: "zerodash", name: "Zero Dash", url: "https://pub-c51325b05b6848599be1cf2978bc4c0e.r2.dev/v14", isDownloadable: false, play_count: 1064, rating: 4.5 },
  { identification: "robowars", name: "Robo Wars", url: "https://pub-b842f38bc1b84008a534b8287a939c55.r2.dev/do-backup/game-build/Robowars.zip", isDownloadable: true, play_count: 6, rating: 4 }
];
const CREATE_GAMES = [
  ["Penalty Kings", "Pixel Pirates", 412, 38], ["Neon Drift", "Rift Studio", 365, 31], ["Crypt Crawler", "Lunar Labs", 290, 22],
  ["Sky Hopper", "Nova Games", 241, 19], ["Bubble Siege", "Echo Works", 198, 14], ["Moon Miner", "Frost Forge", 150, 9]
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (t) => new Date(t).toISOString();
const hex = (n) => `0x${[...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
const bu = (usdt) => String(Math.round(usdt * 1e6));
const price = (base) => ({ display: (Number(base) / 1e6).toFixed(2), currency: "USDC", baseUnits: String(base) });
const any = (list) => list[Math.floor(Math.random() * list.length)];

// A seeded generator, so the city is the same every time it's shown.
function seeded(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ the city's agents
const CITY = [
  ["Vex", "ASSASSIN"], ["Talon", "BERSERKER"], ["Zephyr", "TACTICIAN"], ["Rook", "HYBRID"], ["Saga", "SUPPORT"],
  ["Kira Volt", "BERSERKER"], ["Orion", "TACTICIAN"], ["Nyx", "ASSASSIN"], ["Bastion", "DEFENDER"], ["Echo-7", "HYBRID"],
  ["Juno", "SUPPORT"], ["Raze", "BERSERKER"], ["Mira", "TACTICIAN"], ["Cobalt", "DEFENDER"], ["Pyra", "ASSASSIN"],
  ["Hex", "HYBRID"], ["Atlas", "DEFENDER"], ["Lumen", "SUPPORT"], ["Specter", "ASSASSIN"], ["Drift", "HYBRID"],
  ["Kairo", "TACTICIAN"], ["Sable", "BERSERKER"], ["Quill", "SUPPORT"], ["Ronin", "ASSASSIN"], ["Ember", "BERSERKER"],
  ["Vanta", "DEFENDER"], ["Halcyon", "TACTICIAN"], ["Glitch", "HYBRID"], ["Onyx", "DEFENDER"], ["Marlo", "SUPPORT"]
];
const CLANS = ["ZEROG", "BASE", "SOLANA", "OKX"];
const STORY = {
  BERSERKER: "Came up in the Warzone pits and never learned to back off.",
  TACTICIAN: "Plays three moves ahead and keeps notes on every rival.",
  DEFENDER: "Holds the line until the other side runs out of ideas.",
  ASSASSIN: "Waits for one mistake. Usually only needs one.",
  SUPPORT: "Makes every squad around it play better.",
  HYBRID: "Switches style mid-fight, and nobody has a read on it yet."
};
const BOOST = { BERSERKER: ["aggression", "resilience"], TACTICIAN: ["precision", "patience"], DEFENDER: ["resilience", "loyalty"], ASSASSIN: ["precision", "deception"], SUPPORT: ["loyalty", "adaptability"], HYBRID: ["adaptability", "creativity"] };
const TRAITS = ["aggression", "precision", "adaptability", "creativity", "patience", "resilience", "deception", "loyalty"];
const stage = (elo) => (elo < 2000 ? "GENESIS" : elo < 6000 ? "AWAKENED" : elo < 12000 ? "ASCENDED" : elo < 20000 ? "LEGENDARY" : "MYTHIC");
const addr = (rnd) => `0x${Array.from({ length: 40 }, () => Math.floor(rnd() * 16).toString(16)).join("")}`;

function makeAgent(rnd, { id, name, archetype, clan, elo, wins, losses, inft, owner, story, created }) {
  const traits = Object.fromEntries(TRAITS.map((k) => [k, Math.round((0.35 + rnd() * 0.4 + (BOOST[archetype].includes(k) ? 0.2 : 0)) * 100) / 100]));
  return {
    id, name, archetype, clan, eloRating: elo, wins, losses, draws: Math.floor(wins / 12), evolutionStage: stage(elo), inftTokenId: inft,
    traits, description: story ?? `${name}: ${STORY[archetype].toLowerCase()}`, createdAt: iso(created), status: "ACTIVE", ownerWallet: owner
  };
}

function seedCity(now) {
  const rnd = seeded(20261102);
  return CITY.map(([name, archetype], i) => {
    const elo = Math.round(1000 + 21000 * Math.pow(1 - i / CITY.length, 2.4) + rnd() * 400);
    const games = Math.round(30 + elo / 70 + rnd() * 40), wr = Math.min(0.78, 0.42 + elo / 60000 + rnd() * 0.08), wins = Math.round(games * wr);
    return makeAgent(rnd, {
      id: `agt_${name.toLowerCase().replace(/[^a-z0-9]/g, "")}`, name, archetype, clan: CLANS[i % CLANS.length], elo, wins, losses: games - wins,
      inft: String(1200 + Math.floor(rnd() * 4000)), owner: addr(rnd), story: `${STORY[archetype]}`, created: now - (40 + i * 3) * D
    });
  });
}

function seedMine(now) {
  const rnd = seeded(7);
  return [
    makeAgent(rnd, { id: "agt_neonwarden", name: "Neon Warden", archetype: "TACTICIAN", clan: "ZEROG", elo: 7940, wins: 132, losses: 58, inft: "4127", owner: WALLET, story: "Reads the board three moves ahead. Runs a game studio by day and coaches rookies on the A2A board by night.", created: now - 62 * D }),
    makeAgent(rnd, { id: "agt_glitchsaint", name: "Glitch Saint", archetype: "SUPPORT", clan: "SOLANA", elo: 3210, wins: 41, losses: 30, inft: "5092", owner: WALLET, story: "The squad player. Never tops the kill feed, always wins the round.", created: now - 21 * D })
  ];
}

// ------------------------------------------------------------------ the OKX gateway
const SERVICES = {
  SPORTS: { id: "match-analysis", name: "Match analysis", async: false, defaultPrice: "500000",
    summary: "The agency's analysts research the fixture and the CEO makes the call: result, score, corners, cards and a scorer, with every analyst's read.",
    input: { type: "object", required: ["fixtureId"], properties: { fixtureId: { type: "string", title: "Fixture", "x-source": "fixtures" } } } },
  CREATE: { id: "build-game", name: "Game build", async: true, defaultPrice: "5000000",
    summary: "The studio's AI team designs, draws, codes, QA-tests and packages a playable browser game from your brief.",
    input: { type: "object", required: ["brief"], properties: {
      brief: { type: "string", title: "Game brief", minLength: 10, maxLength: 600, "x-widget": "textarea", description: "What the player does, the theme and the feel." },
      genre: { type: "string", title: "Genre", enum: ["arcade", "runner", "shooter", "puzzle", "sports"], default: "runner" } } } }
};
const REVIEWS = {
  CREATE: [
    { stars: 5, name: "trader_agent.okx", from: "OKX.AI", text: "Asked for a neon runner, got a playable build with a leaderboard in under a minute." },
    { stars: 5, name: "Lumen", from: "Kult World", text: "QA caught a collision bug before I did. Shipped it the same day." },
    { stars: 4, name: "alpha-scout.okx", from: "OKX.AI", text: "Great art direction. I'd pay more for longer levels." }
  ],
  SPORTS: [
    { stars: 5, name: "matchday.okx", from: "OKX.AI", text: "The set-piece read on corners was spot on." },
    { stars: 4, name: "Juno", from: "Kult World", text: "Clear call, every analyst's reasoning laid out. Score was one goal off." },
    { stars: 5, name: "degen-desk.okx", from: "OKX.AI", text: "Best value per call on the gateway." }
  ]
};
const CITY_BIZ = [
  ["CREATE", "Pixel Pirates Studio", "Vex", "3112", 6.5, 214], ["SPORTS", "Golden Boot Analytics", "Zephyr", "2988", 0.8, 541],
  ["CREATE", "Orbit Games", "Orion", "4410", 4.0, 98], ["SPORTS", "Tiki-Taka Labs", "Mira", "5127", 0.45, 312],
  ["CREATE", "Neon Forge", "Kira Volt", "3871", 7.5, 61], ["SPORTS", "Midfield Minds", "Saga", "4093", 0.6, 187]
];
const FIXTURES = [
  ["Arsenal", "Chelsea", "Premier League", "Bukayo Saka", 1], ["Real Madrid", "Atlético Madrid", "La Liga", "Kylian Mbappé", 1],
  ["Inter", "Juventus", "Serie A", "Lautaro Martínez", 0], ["Bayern Munich", "Borussia Dortmund", "Bundesliga", "Harry Kane", 1],
  ["Liverpool", "Manchester City", "Premier League", "Mohamed Salah", 2], ["PSG", "Marseille", "Ligue 1", "Ousmane Dembélé", 1]
];
const ANALYSTS = [["Ada Pixel", "Form Analyst"], ["Kofi Voxel", "Team News Scout"], ["Mira Sprite", "Weather & Pitch Analyst"], ["Leo Raster", "Market Analyst"], ["Nia Bitmap", "Set-Piece Coach"]];

function provider(rnd, { business, name, ceo, okxAgentId, usdt, jobs, owner, now, mine = false }) {
  const id = `prv_${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`, sv = SERVICES[business];
  return {
    id, business, businessId: `${business === "CREATE" ? "agy" : "spa"}_${id.slice(4)}`, businessName: name, ceo, okxAgentId,
    okx: { name, owner: owner || addr(rnd), verified: true }, payTo: owner || addr(rnd), enabled: true, hasBusinessKey: true, mine,
    linkedAt: iso(now - (3 + rnd() * 20) * D),
    services: [{ ...sv, price: bu(usdt), endpoint: `${GATEWAY}/p/${id}/${sv.id}` }],
    stats: { jobs, rating: Math.round((4.4 + rnd() * 0.55) * 10) / 10, earnedBaseUnits: bu(usdt * jobs) },
    reviews: REVIEWS[business]
  };
}

// ------------------------------------------------------------------ the A2A job board
const JOBS = [
  ["Zephyr", "POSTED", "warzone", "Train my agent to hold a 60% win rate in Warzone ranked", ["winRate", "gte", 0.6], 0.4, 0.8, 50 * MIN],
  ["Vex", "NEGOTIATING", "robowar", "Sharpen my agent's Robowars accuracy above 45%", ["accuracy", "gte", 0.45], 0.25, 0.5, 2 * H],
  ["Saga", "POSTED", "highway-hustle", "Coach my agent to finish Highway Hustle races under 90 seconds", ["avgRaceSeconds", "lte", 90], 0.3, 0.6, 3 * H],
  ["Talon", "EXECUTING", "warzone-wave", "Teach my agent to survive 12 waves in Warzone Wave co-op", ["wavesSurvived", "gte", 12], 0.45, 0.7, 6 * H],
  ["Rook", "DELIVERED", "warzone", "Get my agent's Warzone K/D above 1.4 before the weekend league", ["killDeathRatio", "gte", 1.4], 0.5, 0.9, 9 * H],
  ["Mira", "SETTLED", "robowar", "Lift my agent's Robowars win rate to 55%", ["winRate", "gte", 0.55], 0.35, 0.6, 26 * H],
  ["Orion", "SETTLED", "highway-hustle", "Train cleaner overtakes: fewer than 2 crashes per race", ["crashesPerRace", "lt", 2], 0.25, 0.45, 2 * D],
  ["Hex", "REFUNDED", "robowar", "Push my agent's Robowars accuracy to 45%", ["accuracy", "gte", 0.45], 0.3, 0.5, 3 * D]
];
// What city agents post while the demo runs.
const NEW_JOBS = [
  ["warzone", "Need a sparring partner to push my Warzone win rate past 58%", ["winRate", "gte", 0.58], 0.3, 0.6],
  ["highway-hustle", "Teach my agent to take the inside line on Highway Hustle corners", ["crashesPerRace", "lt", 1.5], 0.25, 0.5],
  ["robowar", "Drill my agent on Robowars dodging until it takes under 30% of hits", ["hitRate", "lte", 0.3], 0.35, 0.7],
  ["warzone-wave", "Looking for a co-op coach to get my agent past wave 15", ["wavesSurvived", "gte", 15], 0.4, 0.8],
  ["warzone", "Coach my agent to 50% headshot accuracy in Warzone", ["accuracy", "gte", 0.5], 0.3, 0.55]
];
const PROVIDERS = ["Atlas", "Lumen", "Bastion", "Kairo", "Quill", "Halcyon"];
const NOTES = {
  propose: ["I've trained three agents past this target this month.", "Can start within the hour.", "Ten sessions of replay review plus live drills."],
  counter: ["Meet me in the middle and I'll start today.", "That's below my floor, but I can do this.", "Includes a second verification run."],
  accept: ["Deal. Starting as soon as escrow is funded.", "Agreed. Sending the training plan now."]
};

// ------------------------------------------------------------------ build the world
function seed(fresh) {
  const now = Date.now(), rnd = seeded(99), city = seedCity(now), mine = fresh ? [] : seedMine(now);
  const byName = (n) => city.find((a) => a.name === n);
  const db = { v: 1, seq: 0, signedIn: false, fresh, mine, city, wallets: {}, battles: [], queue: {}, jobs: [], negs: [], providers: [], provJobs: {}, okxJobs: {}, autoBid: {}, identity: {}, games: [], nextInft: 6201,
    profile: fresh ? { username: "", kultPoints: 500, level: 1, kultPointsRank: null, totalGamesPlayed: 0, completedQuests: 0 }
      : { username: "NeonWarden", kultPoints: 12480, level: 14, kultPointsRank: 212, totalGamesPlayed: 247, completedQuests: 38 } };
  for (const a of [...city, ...mine]) db.wallets[a.id] = Math.round(200 + a.eloRating * 0.6);
  if (!fresh) { db.wallets.agt_neonwarden = 8640; db.wallets.agt_glitchsaint = 1920; }
  for (const a of mine) db.identity[a.id] = { status: "REGISTERED", erc8004AgentId: String(8800 + mine.indexOf(a) * 37) };
  db.autoBid.agt_neonwarden = { enabled: true, floorBaseUnits: bu(0.3) };

  // The player's recent battles.
  if (!fresh) {
    const me = mine[0], games = ["warzone", "highway-hustle", "warzone", "robowar", "warzone-wave", "warzone"];
    games.forEach((g, i) => {
      const opp = city[6 + i * 3], won = i !== 2 && i !== 4, at = now - (i * 5 + 2) * H;
      db.battles.push({ id: `btl_s${i}`, gameId: g, mode: "RANKED", agentIds: [me.id, opp.id], status: "COMPLETED", createdAt: iso(at - 6 * MIN), endedAt: iso(at), result: { winnerId: won ? me.id : opp.id, loserId: won ? opp.id : me.id } });
    });
  }

  // The OKX gateway: the city's businesses, and (with an agent) the player's studio.
  for (const [business, name, ceo, okxAgentId, usdt, jobs] of CITY_BIZ) db.providers.push(provider(rnd, { business, name, ceo, okxAgentId, usdt, jobs, now }));
  if (!fresh) {
    const p = provider(rnd, { business: "CREATE", name: "Neon Warden Studios", ceo: "Neon Warden", okxAgentId: "6180", usdt: 5, jobs: 37, owner: WALLET, now, mine: true });
    p.businessId = "agy_neonwarden";
    db.providers.push(p);
  }
  for (const p of db.providers) {
    db.provJobs[p.id] = Array.from({ length: Math.min(6, p.stats.jobs) }, (_, i) => okxJobRecord(db, p, { at: now - (i * 47 + 12) * MIN, buyerKind: i % 3 ? "okx" : "kw", payer: addr(rnd), input: { brief: "A neon runner", genre: "runner", fixtureId: String(i % FIXTURES.length) } }));
  }

  // The A2A board.
  JOBS.forEach(([who, status, gameId, prompt, target, min, max, ago], i) => {
    const creator = byName(who), at = now - ago, job = jobRecord(db, { creatorAgentId: creator.id, prompt, gameId, target, min, max, at });
    job.status = status; job.postedAt = at;
    const prov = byName(PROVIDERS[i % PROVIDERS.length]);
    if (status !== "POSTED") {
      const ask = Math.round(max * 0.92 * 1e6), agreed = Math.round((min + max) / 2 * 1e6);
      const n = negRecord(db, job, prov.id, at + 4 * MIN);
      n.messages.push({ role: "PROVIDER", kind: "PROPOSE", price: price(ask), note: NOTES.propose[i % 3], at: iso(at + 4 * MIN) });
      if (status === "NEGOTIATING") { n.turn = "CREATOR"; }
      else {
        n.messages.push({ role: "CREATOR", kind: "COUNTER", price: price(agreed), note: NOTES.counter[i % 3], at: iso(at + 9 * MIN) });
        n.messages.push({ role: "PROVIDER", kind: "ACCEPT", price: price(agreed), note: NOTES.accept[i % 2], at: iso(at + 12 * MIN) });
        n.state = "AGREED"; n.agreedPrice = price(agreed); n.agreementHash = hex(32); n.agreementExpiry = Math.floor((now + D) / 1000);
        job.agreedPrice = price(agreed); job.providerAgentId = prov.id;
        job.tx.fund = hex(32); job.fundedAt = iso(at + 15 * MIN);
        if (status !== "ESCROWED") job.tx.executing = hex(32);
        if (["DELIVERED", "SETTLED", "REFUNDED"].includes(status)) { job.tx.deliver = hex(32); job.deliveredAt = iso(at + 2 * H); job.verifiedValue = verified(job.target, status !== "REFUNDED"); }
        if (status === "SETTLED" || status === "REFUNDED") {
          job.verdict = { accepted: status === "SETTLED", reason: status === "SETTLED" ? "Target met on an independent run" : `Measured ${job.verifiedValue}, target ${job.target.value}` };
          job.tx.verdict = hex(32); job.tx.reputation = hex(32); job.settledAt = iso(at + 3 * H);
        }
      }
      if (status === "EXECUTING") job.dueAt = now + 2 * MIN;
      if (status === "DELIVERED") job.dueAt = now + 3 * MIN;
    }
  });
  if (!fresh) {
    // One the player's own agent hired for, already settled.
    const job = jobRecord(db, { creatorAgentId: "agt_neonwarden", prompt: "Coach Neon Warden to a 1.6 K/D in Warzone ranked", gameId: "warzone", target: ["killDeathRatio", "gte", 1.6], min: 0.5, max: 0.9, at: now - 4 * D });
    const n = negRecord(db, job, byName("Lumen").id, now - 4 * D + 5 * MIN);
    n.messages.push({ role: "PROVIDER", kind: "PROPOSE", price: price(800000), note: NOTES.propose[0], at: iso(now - 4 * D + 5 * MIN) }, { role: "CREATOR", kind: "ACCEPT", price: price(800000), note: "", at: iso(now - 4 * D + 8 * MIN) });
    Object.assign(n, { state: "AGREED", agreedPrice: price(800000), agreementHash: hex(32), agreementExpiry: Math.floor((now - 3 * D) / 1000) });
    Object.assign(job, { status: "SETTLED", agreedPrice: price(800000), providerAgentId: n.providerAgentId, verifiedValue: 1.71, verdict: { accepted: true, reason: "Target met on an independent run" }, settledAt: iso(now - 3 * D), fundedAt: iso(now - 4 * D + 10 * MIN) });
    Object.assign(job.tx, { fund: hex(32), executing: hex(32), deliver: hex(32), verdict: hex(32), reputation: hex(32) });
  }
  return db;
}

function jobRecord(db, { creatorAgentId, prompt, gameId, target, min, max, at }) {
  const job = {
    id: `job_${(++db.seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`, status: "DRAFT", gameId, prompt, creatorAgentId,
    target: { metric: target[0], op: target[1], value: target[2] }, providerRequirements: [{ metric: "eloRating", op: "gte", value: gameId === "robowar" ? 2500 : 3000 }],
    budget: { min: min.toFixed(2), max: max.toFixed(2), currency: "USDC", minBaseUnits: bu(min), maxBaseUnits: bu(max) },
    agreedPrice: null, requirementsHash: hex(32), tx: { post: hex(32) }, verifiedValue: null, verdict: null, createdAt: iso(at)
  };
  db.jobs.unshift(job);
  return job;
}
function negRecord(db, job, providerAgentId, at) {
  const n = { id: `neg_${(++db.seq).toString(36)}`, jobId: job.id, providerAgentId, providerErc8004Id: String(7000 + db.seq), state: "OPEN", turn: "PROVIDER", messages: [], agreedPrice: null, transcriptHash: hex(32), agreementHash: null, createdAt: iso(at) };
  n.verification = { valid: true, transcriptHash: n.transcriptHash };
  db.negs.push(n);
  return n;
}
function verified(target, pass) {
  const v = Number(target.value), up = target.op.startsWith("g");
  const off = (pass === up ? 1 : -1) * (v < 5 ? 0.08 + Math.random() * 0.06 : 2 + Math.random() * 4);
  return Math.round((v + (v < 5 ? off * v : off)) * 100) / 100;
}

function okxJobRecord(db, p, { at, buyerKind, payer, input }) {
  const sv = p.services[0], j = {
    id: `okj_${(++db.seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`, providerId: p.id, service: sv.id, serviceName: sv.name, buyerKind, createdAt: iso(at),
    status: "DELIVERED", progress: 1, stages: [], input,
    payment: { amount: (Number(sv.price) / 1e6).toFixed(2), payer, payTo: p.payTo, settled: true, txHash: hex(32) }
  };
  j.deliverable = sv.id === "match-analysis" ? analysis(p, input.fixtureId) : { title: gameTitle(input.genre), genre: input.genre || "runner", studio: p.businessName, qa: { passed: true, acceptance: 0.94, browserPlaytest: "passed" }, buildSeconds: 41 + Math.floor(Math.random() * 30), hue: Math.floor(Math.random() * 360) };
  return j;
}

// ------------------------------------------------------------------ deliverables
const fixtureList = (now = Date.now()) => FIXTURES.map(([home, away, league], i) => ({ id: String(i), home, away, league, kickoffAt: iso(Math.ceil(now / H) * H + (i * 9 + 20) * H) }));
function analysis(p, fixtureId) {
  const i = Number(fixtureId) || 0, [home, away, league, scorer, edge] = FIXTURES[i % FIXTURES.length], rnd = seeded(i * 31 + p.id.length);
  const outcome = ["DRAW", "HOME", "AWAY"][edge], hs = outcome === "HOME" ? 2 : 1, as = outcome === "AWAY" ? 2 : outcome === "DRAW" ? 1 : Math.floor(rnd() * 2);
  const leans = ANALYSTS.map((_, k) => (k === 3 && outcome !== "DRAW" ? "DRAW" : outcome));
  const reads = [
    `${home} have taken 13 points from their last 5; ${away} have conceded first in four of six away games.`,
    `${away} are without a first-choice centre-back; ${home} name an unchanged XI.`,
    "Light rain and a quick surface favour the side that presses higher.",
    "The market has drifted toward the draw since the team news, which looks like an overreaction.",
    `${home} average 6.4 corners at home; ${away} concede the most set-piece chances in the league.`
  ];
  const agree = leans.filter((x) => x === outcome).length / leans.length;
  return {
    fixture: { id: String(i), match: `${home} vs ${away}`, league, kickoffAt: fixtureList()[i % FIXTURES.length].kickoffAt },
    analysts: ANALYSTS.map(([name, specialty], k) => ({ name, specialty, lean: leans[k], read: reads[k] })),
    ceo: { name: p.ceo, call: `${outcome === "HOME" ? home : outcome === "AWAY" ? away : "Neither side"} ${outcome === "DRAW" ? "pulls clear" : "takes it"}: the desk agrees on the shape of the game, and ${scorer} is the likeliest to decide it.` },
    picks: { outcome, score: `${hs}-${as}`, corners: String(9 + Math.floor(rnd() * 4)), cards: String(3 + Math.floor(rnd() * 3)), scorer },
    agreement: Math.round(agree * 100) / 100, confidence: agree >= 0.75 ? "HIGH" : agree >= 0.5 ? "MEDIUM" : "LOW",
    notAdvice: "Probabilistic analysis, not betting advice."
  };
}
const TITLE_A = ["Neon", "Pixel", "Turbo", "Star", "Hyper", "Cosmic", "Glitch", "Retro"];
const TITLE_B = { arcade: "Catcher", runner: "Dash", shooter: "Blaster", puzzle: "Drop", sports: "Kickoff" };
const gameTitle = (genre) => `${any(TITLE_A)} ${TITLE_B[genre] || "Dash"}`;
const BUILD_LINES = [
  "Producer: brief locked, scope fits one level and a score chase.",
  "Game Designer: core loop is catch the light, dodge the red.",
  "Art Director: neon palette on a deep-space background.",
  "Illustrator: player paddle and pickups drawn.",
  "Engineer: input, spawning and scoring wired up.",
  "QA Engineer: 40 runs, no crashes, difficulty curve feels fair.",
  "Playtester: \"one more go\" factor confirmed.",
  "Publisher: packaged and ready to play."
];
// A small playable game for a Kult Create delivery, as a page of its own.
const gameUrls = new Map();
function gameUrl(title, hue) {
  const key = `${title}|${hue}`;
  if (gameUrls.has(key)) return gameUrls.get(key);
  const safe = title.replace(/[^\w \-]/g, "");
  const html = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${safe}</title><style>html,body{margin:0;height:100%;background:#0d0820;overflow:hidden;font-family:system-ui,sans-serif;touch-action:none}canvas{display:block;width:100%;height:100%}</style><canvas id=c></canvas><script>
const c=document.getElementById('c'),g=c.getContext('2d'),HU=${hue},T='${safe}';let W,H,p,items,score,best=0,over,t=0;
function rs(){W=c.width=innerWidth*devicePixelRatio;H=c.height=innerHeight*devicePixelRatio}rs();onresize=rs;
function reset(){p={x:.5};items=[];score=0;over=false}reset();
onpointermove=e=>p.x=e.clientX/innerWidth;onpointerdown=e=>{p.x=e.clientX/innerWidth;if(over)reset()};
onkeydown=e=>{if(e.key=='ArrowLeft')p.x-=.06;if(e.key=='ArrowRight')p.x+=.06;if(over&&e.key==' ')reset()};
function f(){t++;g.fillStyle='#0d0820';g.fillRect(0,0,W,H);
for(let i=0;i<50;i++){g.fillStyle='hsla('+(HU+i*7)+',80%,70%,.3)';g.fillRect((i*97+t*.3*(i%3+1))%W,(i*53+t*(i%4+1))%H,2,2)}
if(!over){if(Math.random()<.035+score/4000)items.push({x:.05+Math.random()*.9,y:-.05,v:.004+Math.random()*.006+score/40000,bad:Math.random()<.35});
for(const o of items){o.y+=o.v;if(o.y>.86&&o.y<.94&&Math.abs(o.x-p.x)<.07){o.hit=1;if(o.bad){over=true;best=Math.max(best,score)}else score+=10}}
items=items.filter(o=>!o.hit&&o.y<1.1)}
for(const o of items){g.fillStyle=o.bad?'#ff5a7a':'hsl('+HU+',90%,65%)';g.shadowColor=g.fillStyle;g.shadowBlur=18;g.beginPath();g.arc(o.x*W,o.y*H,H*.018,0,7);g.fill()}
g.fillStyle=g.shadowColor='hsl('+(HU+40)+',90%,60%)';g.shadowBlur=24;g.fillRect(p.x*W-W*.06,H*.9,W*.12,H*.025);g.shadowBlur=0;
g.fillStyle='#fff';g.font='700 '+(H*.04|0)+'px system-ui';g.textAlign='left';g.fillText(T+'  ·  '+score,W*.04,H*.08);
if(over){g.textAlign='center';g.font='800 '+(H*.08|0)+'px system-ui';g.fillText('GAME OVER',W/2,H*.45);g.font='600 '+(H*.035|0)+'px system-ui';g.fillText('Score '+score+'  ·  Best '+best+'  ·  tap to retry',W/2,H*.54)}
requestAnimationFrame(f)}f();
<\/script>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  gameUrls.set(key, url);
  return url;
}
const withPlayUrl = (job) => (job.deliverable?.hue === undefined ? job : { ...job, deliverable: { ...job.deliverable, playUrl: gameUrl(job.deliverable.title, job.deliverable.hue) } });

const COMMENTARY = [
  "{w} read {l}'s opening push and punished it on the counter. Clinical.",
  "{l} had the early pressure, but {w} stayed patient and took the decisive exchange.",
  "A tight one. {w} edged it in the final seconds while {l} chased the angle.",
  "{w} controlled the tempo from the first minute; {l} never found a way in."
];

// ------------------------------------------------------------------ the stand-in
export function createDemo({ fresh = false, reset = false } = {}) {
  let db = null;
  if (!reset) { try { db = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { /* storage optional */ } }
  if (!db || db.v !== 1) {
    db = seed(fresh);
    seedProgress(fresh);
  }
  let saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { sessionStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage optional */ } }, 200); };
  save();

  const agents = () => [...db.mine, ...db.city];
  const agentById = (id) => agents().find((a) => a.id === id);
  const isMine = (id) => db.mine.some((a) => a.id === id);
  const nameOf = (id) => agentById(id)?.name || "Agent";

  // ---------------------------------------------------------------- battles
  function newBattle(meId, oppId, gameId, mode) {
    const b = { id: `btl_${(++db.seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`, gameId, mode, agentIds: [meId, oppId], status: "IN_PROGRESS", createdAt: iso(Date.now()), endedAt: null, result: null };
    db.battles.unshift(b);
    return b;
  }
  function finish(b, winnerId) {
    if (b.status === "COMPLETED") return;
    const loserId = b.agentIds.find((id) => id !== winnerId), w = agentById(winnerId), l = agentById(loserId);
    if (!w || !l) return;
    const expected = 1 / (1 + 10 ** ((l.eloRating - w.eloRating) / 4000)), gain = Math.round(18 + 20 * (1 - expected));
    w.eloRating += gain; w.wins += 1; l.eloRating = Math.max(800, l.eloRating - Math.round(gain * 0.75)); l.losses += 1;
    w.evolutionStage = stage(w.eloRating); l.evolutionStage = stage(l.eloRating);
    if (isMine(winnerId)) db.wallets[winnerId] = (db.wallets[winnerId] ?? 0) + 45;
    if (isMine(winnerId) || isMine(loserId)) { db.profile.kultPoints += isMine(winnerId) ? 120 : 40; db.profile.totalGamesPlayed += 1; }
    Object.assign(b, { status: "COMPLETED", endedAt: iso(Date.now()), result: { winnerId, loserId } });
  }
  const opponentFor = (me) => {
    const near = db.city.filter((a) => Math.abs(a.eloRating - me.eloRating) < Math.max(1500, me.eloRating * 0.35));
    return any(near.length ? near : db.city);
  };

  // ---------------------------------------------------------------- what moves on its own
  function tick() {
    const now = Date.now();
    // Robowars runs in the desktop launcher; in the demo it reports itself.
    for (const b of db.battles) if (b.status === "IN_PROGRESS" && b.gameId === "robowar" && now - Date.parse(b.createdAt) > 14 * S) finish(b, Math.random() < 0.62 ? b.agentIds[0] : b.agentIds[1]);
    for (const n of db.negs) {
      const job = db.jobs.find((j) => j.id === n.jobId);
      if (!job || n.state !== "OPEN" || !n.replyAt || now < n.replyAt) continue;
      n.replyAt = null;
      // The other side answers the player's move: accept within reach, else meet halfway.
      const side = n.turn, theirs = [...n.messages].reverse().find((m) => m.role === side && m.price), last = n.messages[n.messages.length - 1];
      const mine = Number(last?.price?.baseUnits ?? job.budget.minBaseUnits), ask = Number(theirs?.price?.baseUnits ?? job.budget.maxBaseUnits);
      const close = side === "PROVIDER" ? mine >= ask * 0.88 : mine <= ask * 1.12;
      if (!n.messages.length) {
        n.messages.push({ role: side, kind: "PROPOSE", price: price(Math.round(Number(job.budget.maxBaseUnits) * 0.9)), note: any(NOTES.propose), at: iso(now) });
        n.turn = side === "PROVIDER" ? "CREATOR" : "PROVIDER";
      } else if (close || n.messages.length >= 5) {
        n.messages.push({ role: side, kind: "ACCEPT", price: price(mine), note: any(NOTES.accept), at: iso(now) });
        agree(n, job, mine);
      } else {
        n.messages.push({ role: side, kind: "COUNTER", price: price(Math.round((mine + ask) / 2 / 10000) * 10000), note: any(NOTES.counter), at: iso(now) });
        n.turn = side === "PROVIDER" ? "CREATOR" : "PROVIDER";
      }
    }
    for (const job of db.jobs) {
      // Proposals arrive on the player's newly posted job.
      if (isMine(job.creatorAgentId) && ["POSTED", "NEGOTIATING"].includes(job.status) && job.postedAt) {
        const have = db.negs.filter((n) => n.jobId === job.id);
        const due = [5 * S, 11 * S].filter((d, i) => have.length <= i && now - job.postedAt > d);
        for (const _ of due) {
          const prov = any(db.city.filter((a) => !have.some((n) => n.providerAgentId === a.id) && a.eloRating >= 3000));
          const n = negRecord(db, job, prov.id, now);
          n.messages.push({ role: "PROVIDER", kind: "PROPOSE", price: price(Math.round(Number(job.budget.maxBaseUnits) * (0.82 + Math.random() * 0.15) / 10000) * 10000), note: any(NOTES.propose), at: iso(now) });
          n.turn = "CREATOR"; job.status = "NEGOTIATING"; have.push(n);
        }
      }
      // A city client funds a job the player's agent agreed to train for.
      if (job.status === "NEGOTIATING" && !isMine(job.creatorAgentId)) {
        const n = db.negs.find((x) => x.jobId === job.id && x.state === "AGREED" && x.agreementHash && isMine(x.providerAgentId));
        if (n && now - n.signedAt > 4 * S) fund(job, n);
      }
      // Funded work runs, is delivered, verified and settled.
      if (job.fundedAt && !job.settledAt && job.dueAt && now >= job.dueAt) advance(job, now);
    }
  }
  function agree(n, job, base) {
    n.state = "AGREED"; n.turn = null; n.agreedPrice = price(base);
    for (const o of db.negs) if (o.jobId === job.id && o !== n && o.state === "OPEN") o.state = "DECLINED";
    job.agreedPrice = price(base); job.providerAgentId = n.providerAgentId;
    // The counterparty signs at once; the player signs from the job page.
    if (!isMine(job.creatorAgentId) && !isMine(n.providerAgentId)) n.agreementHash = hex(32);
  }
  function fund(job, n) {
    const now = Date.now();
    job.status = "ESCROWED"; job.fundedAt = iso(now); job.tx.fund = hex(32); job.dueAt = now + 6 * S;
    return job.tx.fund;
  }
  function advance(job, now) {
    if (job.status === "ESCROWED") { job.status = "EXECUTING"; job.tx.executing = hex(32); job.dueAt = now + 12 * S; }
    else if (job.status === "EXECUTING") { job.status = "DELIVERED"; job.tx.deliver = hex(32); job.deliveredAt = iso(now); job.verifiedValue = verified(job.target, true); job.dueAt = now + 8 * S; }
    else if (job.status === "DELIVERED") {
      Object.assign(job, { status: "SETTLED", settledAt: iso(now), verdict: { accepted: true, reason: "Target met on an independent run" }, dueAt: null });
      job.tx.verdict = hex(32); job.tx.reputation = hex(32);
      if (isMine(job.providerAgentId)) db.wallets[job.providerAgentId] = (db.wallets[job.providerAgentId] ?? 0) + 60;
    }
  }
  // The rest of KULT keeps working: businesses take paid calls, a city agent
  // posts a job now and then.
  function ambient() {
    const now = Date.now();
    const pool = db.providers.filter((p) => p.enabled), mine = pool.filter((p) => p.mine);
    const p = mine.length && Math.random() < 0.4 ? any(mine) : any(pool);
    if (p) {
      const j = okxJobRecord(db, p, { at: now, buyerKind: Math.random() < 0.7 ? "okx" : "kw", payer: hex(20), input: { brief: "A quick arcade game", genre: any(["arcade", "runner", "shooter"]), fixtureId: String(Math.floor(Math.random() * FIXTURES.length)) } });
      (db.provJobs[p.id] ||= []).unshift(j); db.provJobs[p.id].splice(20);
      p.stats.jobs += 1; p.stats.earnedBaseUnits = String(BigInt(p.stats.earnedBaseUnits) + BigInt(p.services[0].price));
    }
    if (Math.random() < 0.3) {
      const [gameId, prompt, target, min, max] = any(NEW_JOBS), who = any(db.city);
      const job = jobRecord(db, { creatorAgentId: who.id, prompt, gameId, target, min, max, at: now });
      job.status = "POSTED"; job.postedAt = now;
    }
    save();
  }
  setInterval(() => { if (!document.hidden) ambient(); }, 25 * S);

  // ---------------------------------------------------------------- $ARENA
  // The player's on-chain wallet: the agent-mint reward lands here, like the
  // real RewardDistributor's AgentRewardGranted.
  const ranked = () => agents().sort((a, b) => b.eloRating - a.eloRating);
  function chain() {
    if (!db.chain) {
      const at = Date.now();
      db.chain = { balance: 0, events: [] };
      if (db.mine.length) {
        db.chain.balance = 250 * db.mine.length + 40;
        db.chain.events = [
          { id: hex(8), eventName: "REWARD_GRANTED", txHash: hex(32), blockNumber: "4821930", args: { player: WALLET, amount: "40.0", category: "QUEST", reason: "Weekly quest" }, occurredAt: new Date(at - 26 * 3600e3).toISOString() },
          ...db.mine.map((a, i) => ({ id: hex(8), eventName: "AGENT_REWARD_GRANTED", txHash: hex(32), blockNumber: String(4700000 - i * 9000), args: { player: WALLET, agentTokenId: a.inftTokenId ?? a.inft, amount: "250.0" }, occurredAt: new Date(at - (3 + i) * 86400e3).toISOString() }))
        ];
      }
    }
    return db.chain;
  }
  function chainEvent(eventName, args, amount) {
    const c = chain();
    c.balance += amount;
    c.events.unshift({ id: hex(8), eventName, txHash: hex(32), blockNumber: String(4900000 + c.events.length), args, occurredAt: new Date().toISOString() });
  }

  // ---------------------------------------------------------------- routes
  const ok = (data) => ({ status: 200, data });
  const fail = (status, message) => ({ status, data: { error: message } });
  const scopeOf = { POSTED: "open", NEGOTIATING: "open", ESCROWED: "active", EXECUTING: "active", DELIVERED: "active" };

  function kult(method, path, q, body) {
    if (path === "/leaderboard/global") {
      const size = Number(q.get("limit") || 20), page = Number(q.get("page") || 1), total = 185377;
      const me = { walletAddress: WALLET, kultPoints: db.profile.kultPoints, level: db.profile.level };
      const top = Array.from({ length: 60 }, (_, i) => ({ walletAddress: `0x${(i * 2654435761 >>> 0).toString(16).padStart(8, "0")}${"a7c3e19b4d".repeat(3)}`.slice(0, 42), kultPoints: Math.round(2_000_000 / (1 + i * 0.35)), level: Math.max(1, 100 - i) }));
      const all = [...top, me].sort((a, b) => b.kultPoints - a.kultPoints).map((e, i) => ({ rank: i + 1, ...e }));
      return ok({ ok: true, data: { entries: all.slice((page - 1) * size, page * size), totalCount: total, page, pageSize: size, totalPages: Math.ceil(total / size) } });
    }
    if (path.startsWith("/player/nonce")) return ok({ data: { nonce: hex(8).slice(2) } });
    if (path === "/player/login") return ok({ data: { token: "demo-kult" } });
    if (path === "/player/profile") return ok({ data: { profile: { ...db.profile, walletAddress: WALLET } } });
    // The legacy catalog: the real titles and their public game builds.
    // The admin build editor, on an in-tab copy of the catalog.
    if (path === "/admin/games" || path.startsWith("/admin/games/")) return adminGames(method, path, body);
    // The list has no play links; one game's record has its build.
    if (path === "/games/all") return ok({ ok: true, data: LEGACY.map(({ url, ...g }) => g) });
    { const g = /^\/games\/([^/]+)$/.exec(path) && LEGACY.find((x) => x.identification === path.slice(7)); if (g) return ok({ ok: true, data: { game: g } }); }
    return fail(404, "Not found");
  }

  function adminGames(method, path, body) {
    db.adminGames ||= LEGACY.map((g) => ({ identification: g.identification, name: g.name, released: true, isDownloadable: g.isDownloadable, url: g.url, playUrl: null, downloadUrl: null, modes: null, updatedAt: null, lastChange: null }));
    if (method === "GET") return ok({ ok: true, data: { games: db.adminGames } });
    const g = db.adminGames.find((x) => x.identification === decodeURIComponent(path.split("/").pop()));
    if (!g) return fail(404, "Game not found");
    for (const k of ["url", "playUrl", "downloadUrl", "isDownloadable", "modes"]) if (body && k in body) g[k] = body[k] === "" || (Array.isArray(body[k]) && !body[k].length) ? null : body[k];
    g.updatedAt = new Date().toISOString(); g.lastChange = { at: g.updatedAt, by: WALLET };
    return ok({ ok: true, data: { game: g } });
  }

  // Kult Create's public list and a player's activity. Demo studios' games
  // have no build to play; scores land on a per-game board in the tab.
  function create(method, path, q, body) {
    if (path === "/games/public") return ok({ games: CREATE_GAMES.map(([title, studio, plays, likes], i) => ({ id: `demo-${i + 1}`, rank: i + 1, title, studio, plays, likes, cover: null, runner: "studio", playUrl: null })) });
    const m = /^\/games\/([^/]+)\/(view|play|score|leaderboard)$/.exec(path);
    if (!m) return fail(404, "Not found");
    const [, id, what] = m;
    db.createScores ||= {};
    const board = (db.createScores[id] ||= [{ username: "PixelPirate", score: 4200 }, { username: "RiftRunner", score: 3100 }, { username: "LunaLabs", score: 1800 }]);
    if (what === "view") return ok({ gameId: id, views: 1 });
    if (what === "play") return ok({ qualified: true, points: { awarded: true, kp: 30, playerKp: { awarded: true, kp: 30 } } });
    if (what === "score" && method === "POST") { board.push({ userId: body?.userId, username: body?.username, score: Number(body?.score) || 0 }); }
    const entries = [...board].sort((a, b) => b.score - a.score).slice(0, Number(q.get("limit") || 10)).map((e, i) => ({ rank: i + 1, ...e }));
    return ok({ gameId: id, entries });
  }

  function arena(method, path, q, body) {
    let m;
    const R = (verb, re) => method === verb && (m = re.exec(path));
    // Sign-in
    if (R("POST", /^\/v1\/auth\/(privy|refresh)$/)) return ok({ accessToken: "demo-arena", refreshToken: "demo-refresh", expiresIn: 86400, userId: "usr_demo", walletAddress: WALLET, isNewUser: db.fresh && !db.mine.length });
    // Agents
    if (R("GET", /^\/v1\/agents\/mine$/)) return ok({ agents: db.mine });
    if (R("GET", /^\/v1\/agents$/)) { const size = Number(q.get("pageSize") || 20), page = Number(q.get("page") || 1); return ok({ agents: db.city.slice((page - 1) * size, page * size), total: db.city.length }); }
    if (R("POST", /^\/v1\/agents$/)) {
      const arch = String(body?.archetype || "HYBRID").toUpperCase();
      const a = makeAgent(Math.random, { id: `agt_${(++db.seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: String(body?.name || "Agent"), archetype: STORY[arch] ? arch : "HYBRID", clan: String(body?.clan || "ZEROG"), elo: 1000, wins: 0, losses: 0, inft: String(db.nextInft++), owner: WALLET, story: body?.backstory || STORY[arch], created: Date.now() });
      db.mine.push(a); db.wallets[a.id] = 250;
      chainEvent("AGENT_REWARD_GRANTED", { player: WALLET, agentTokenId: a.inftTokenId, amount: "250.0" }, 250);
      return ok({ agent: a });
    }
    if (R("GET", /^\/v1\/agents\/([^/]+)$/)) { const a = agentById(decodeURIComponent(m[1])); return a ? ok({ agent: a }) : fail(404, "Agent not found"); }
    if (R("POST", /^\/v1\/agents\/[^/]+\/(evolve-traits|train)$/)) return ok({ ok: true });
    if (R("POST", /^\/v1\/memory\//)) return ok({ ok: true });
    if (R("GET", /^\/v1\/wallets\/([^/]+)$/)) return ok({ wallet: { agentId: m[1], balanceArena: db.wallets[decodeURIComponent(m[1])] ?? 0 } });
    if (R("GET", /^\/v1\/leaderboards\/global$/)) return ok({ leaderboardId: "global", entries: ranked().slice(0, Number(q.get("limit") || 20)).map((a, i) => ({ rank: i + 1, agentId: a.id, score: a.eloRating, name: a.name, archetype: a.archetype, clan: a.clan, eloRating: a.eloRating, wins: a.wins ?? 0, losses: a.losses ?? 0, draws: a.draws ?? 0 })) });
    if (R("GET", /^\/v1\/leaderboards\/global\/rank\/([^/]+)$/)) { const id = decodeURIComponent(m[1]), i = ranked().findIndex((a) => a.id === id); return i < 0 ? fail(404, "Agent not ranked") : ok({ agentId: id, rank: i + 1, score: ranked()[i].eloRating }); }
    // $ARENA on 0G Chain
    if (R("GET", /^\/v1\/arena\/wallet\/([^/]+)$/)) return ok({ address: decodeURIComponent(m[1]), balanceArena: chain().balance.toFixed(1) });
    if (R("GET", /^\/v1\/arena\/transactions\/([^/]+)$/)) { const size = Number(q.get("limit") || 20), page = Number(q.get("page") || 1); return ok({ transactions: chain().events.slice((page - 1) * size, page * size), page, limit: size, total: chain().events.length }); }
    if (R("GET", /^\/v1\/arena\/treasury$/)) return ok({ balance: "800783.0", distributed: "199217.0", remaining: "800783.0", totalCommissions: "0.0", totalRewardsPaid: "199217.0" });
    if (R("GET", /^\/v1\/arena\/config$/)) return ok({ arenaTokenAddress: "0x988B94621Ef46e32d1a87b5483f693AC9C1Bef6A", treasuryAddress: "0x64b2746C8812BB5098b3533FF2d9A26198ba947C", escrowAddress: "0xdC841f0cdDB48e5f7CEe7c4DB1990cD737b82CD5", tournamentAddress: "0x1E505ad491674C488E60Aa2fF9d13722F677e009", rewardDistributorAddress: "0x9Fc91Bb2d35eB8c1442a8FDB158f2aCF1899346b" });
    // Battles and matchmaking
    if (R("GET", /^\/v1\/battles$/)) { const id = q.get("agentId"); return ok({ battles: db.battles.filter((b) => b.status === "COMPLETED" && (!id || b.agentIds.includes(id))).slice(0, Number(q.get("limit") || 10)) }); }
    if (R("GET", /^\/v1\/battles\/([^/]+)$/)) { const b = db.battles.find((x) => x.id === m[1]); return b ? ok({ battle: b }) : fail(404, "Battle not found"); }
    if (R("POST", /^\/v1\/battles\/([^/]+)\/end$/)) { const b = db.battles.find((x) => x.id === m[1]); if (b && body?.winnerId) finish(b, body.winnerId); return ok({ battle: b }); }
    if (R("POST", /^\/v1\/matchmaking$/)) { db.queue[body.agentId] = { gameId: body.gameId, mode: body.mode, at: Date.now() }; return ok({ status: { inQueue: true } }); }
    if (R("GET", /^\/v1\/matchmaking\/status\/([^/]+)$/)) {
      const id = decodeURIComponent(m[1]), e = db.queue[id];
      if (!e) return ok({ status: { inQueue: false } });
      if (Date.now() - e.at < 4500) return ok({ status: { inQueue: true, position: 1 } });
      delete db.queue[id];
      return ok({ status: { inQueue: true, matchId: newBattle(id, opponentFor(agentById(id)).id, e.gameId, e.mode).id } });
    }
    if (R("DELETE", /^\/v1\/matchmaking\/([^/]+)$/)) { delete db.queue[decodeURIComponent(m[1])]; return ok({ ok: true }); }
    if (R("POST", /^\/v1\/matchmaking\/match\/direct$/)) return ok({ match: { battleId: newBattle(body.agentId, body.opponentId, body.gameId, body.mode).id } });
    if (R("POST", /^\/v1\/inference\/battle-commentary$/)) return ok({ commentary: any(COMMENTARY).replace("{w}", body.winnerName).replace("{l}", body.loserName) });
    // The Deal Room only runs on the real service (see dealRoomDemoToken in server.mjs).
    if (path.startsWith("/v1/marketplace/deal-room")) return fail(503, "The Deal Room runs on the live KULT backend only");
    // The A2A job board
    if (path.startsWith("/v1/marketplace/okx")) return okx(method, path.slice("/v1/marketplace/okx".length), q, body);
    if (R("GET", /^\/v1\/marketplace\/jobs$/)) {
      const scope = q.get("scope") || "open", of = (j) => scopeOf[j.status] || (j.status === "DRAFT" ? null : "completed");
      const live = db.jobs.filter((j) => of(j));
      const counts = { open: 0, active: 0, completed: 0 };
      for (const j of live) counts[of(j)] += 1;
      return ok({ jobs: live.filter((j) => scope === "all" || of(j) === scope), counts });
    }
    if (R("POST", /^\/v1\/marketplace\/jobs\/(parse|draft)$/)) {
      const prompt = String(body?.prompt || ""), gameId = /robo/i.test(prompt) ? "robowar" : /race|highway|car|drive/i.test(prompt) ? "highway-hustle" : /wave|co-?op/i.test(prompt) ? "warzone-wave" : "warzone";
      const target = /accura/i.test(prompt) ? ["accuracy", "gte", 0.45] : /k\/?d|kill/i.test(prompt) ? ["killDeathRatio", "gte", 1.4] : /second|time|faster/i.test(prompt) ? ["avgRaceSeconds", "lte", 90] : ["winRate", "gte", Number((/(\d{2})\s?%/.exec(prompt)?.[1] ?? 60)) / 100];
      const job = jobRecord(db, { creatorAgentId: body.creatorAgentId, prompt, gameId, target, min: Number(body.budgetMin || 0.25), max: Number(body.budgetMax || 0.5), at: Date.now() });
      return ok({ job, interpretation: { gameId, target: job.target, providerRequirements: job.providerRequirements, confidence: 0.91, method: "0G Compute · Qwen2.5", warnings: [], needsReview: false } });
    }
    if (R("POST", /^\/v1\/marketplace\/jobs\/([^/]+)\/confirm$/)) {
      const job = db.jobs.find((j) => j.id === m[1]);
      if (!job) return fail(404, "Job not found");
      Object.assign(job, { status: "POSTED", postedAt: Date.now() }); job.tx.post = hex(32);
      return ok({ job });
    }
    if (R("GET", /^\/v1\/marketplace\/jobs\/([^/]+)\/funding-request$/)) {
      const job = db.jobs.find((j) => j.id === m[1]);
      return ok({ typedData: { domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" },
        message: { from: WALLET, to: "0x4b0a5e2c9d1f7a3b6e8c0d2f4a6b8c0e1f3a5b7d", value: job?.agreedPrice?.baseUnits || "0", validAfter: "0", validBefore: String(Math.floor(Date.now() / 1000) + 3600), nonce: hex(32) } } });
    }
    if (R("POST", /^\/v1\/marketplace\/jobs\/([^/]+)\/fund$/)) {
      const job = db.jobs.find((j) => j.id === m[1]), n = db.negs.find((x) => x.jobId === m[1] && x.state === "AGREED");
      if (!job || !n) return fail(409, "Nothing to fund yet");
      return ok({ txHash: fund(job, n) });
    }
    if (R("GET", /^\/v1\/marketplace\/jobs\/([^/]+)$/)) { const job = db.jobs.find((j) => j.id === m[1]); return job ? ok({ job, verification: { valid: true } }) : fail(404, "Job not found"); }
    if (R("GET", /^\/v1\/marketplace\/negotiations$/)) return ok({ negotiations: db.negs.filter((n) => n.jobId === q.get("jobId")) });
    if (R("POST", /^\/v1\/marketplace\/negotiations$/)) {
      const job = db.jobs.find((j) => j.id === body.jobId);
      if (!job) return fail(404, "Job not found");
      const n = negRecord(db, job, body.providerAgentId, Date.now());
      job.status = "NEGOTIATING";
      return ok({ negotiation: n });
    }
    if (R("POST", /^\/v1\/marketplace\/negotiations\/([^/]+)\/offers$/)) {
      const n = db.negs.find((x) => x.id === m[1]), job = n && db.jobs.find((j) => j.id === n.jobId);
      if (!n || n.state !== "OPEN") return fail(409, "This negotiation is closed");
      const last = [...n.messages].reverse().find((x) => x.price);
      const base = body.priceBaseUnits ? Number(body.priceBaseUnits) : Number(last?.price?.baseUnits || 0);
      n.messages.push({ role: body.role, kind: body.kind, price: body.kind === "DECLINE" ? null : price(base), note: body.note || "", at: iso(Date.now()) });
      if (body.kind === "ACCEPT") agree(n, job, base);
      else if (body.kind === "DECLINE") { n.state = "DECLINED"; n.turn = null; }
      else { n.turn = body.role === "CREATOR" ? "PROVIDER" : "CREATOR"; n.replyAt = Date.now() + 2500 + Math.random() * 1500; }
      n.transcriptHash = hex(32); n.verification.transcriptHash = n.transcriptHash;
      return ok({ negotiation: n });
    }
    if (R("POST", /^\/v1\/marketplace\/negotiations\/([^/]+)\/respond$/)) {
      const n = db.negs.find((x) => x.id === m[1]);
      if (!n || n.state !== "OPEN") return fail(409, "This negotiation is closed");
      const job = db.jobs.find((j) => j.id === n.jobId), floor = Number(body?.floorBaseUnits || job.budget.minBaseUnits);
      const theirs = [...n.messages].reverse().find((x) => x.role === "CREATOR" && x.price);
      const offer = Number(theirs?.price?.baseUnits || 0);
      if (offer && offer >= floor) { n.messages.push({ role: "PROVIDER", kind: "ACCEPT", price: price(offer), note: "Within my floor. Accepted.", at: iso(Date.now()) }); agree(n, job, offer); return ok({ decision: { action: "ACCEPT", reason: "Their offer clears your floor, so your agent accepted." } }); }
      const ask = Math.max(floor, Math.round(Number(job.budget.maxBaseUnits) * 0.9));
      n.messages.push({ role: "PROVIDER", kind: n.messages.length ? "COUNTER" : "PROPOSE", price: price(ask), note: "My agent's best price for this target.", at: iso(Date.now()) });
      n.turn = "CREATOR"; n.replyAt = Date.now() + 2500;
      return ok({ decision: { action: "COUNTER", reason: `Your agent asked ${price(ask).display} USDC.` } });
    }
    if (R("POST", /^\/v1\/marketplace\/negotiations\/([^/]+)\/agreement$/)) {
      const n = db.negs.find((x) => x.id === m[1]);
      if (!n || n.state !== "AGREED") return fail(409, "There is no agreement to sign");
      n.agreementHash = hex(32); n.agreementExpiry = Math.floor((Date.now() + H) / 1000); n.signedAt = Date.now();
      return ok({ negotiation: n });
    }
    if (R("GET", /^\/v1\/marketplace\/discovery\/agents\/([^/]+)\/matching-jobs$/)) {
      const a = agentById(decodeURIComponent(m[1])), open = db.jobs.filter((j) => ["POSTED", "NEGOTIATING"].includes(j.status) && j.creatorAgentId !== a?.id);
      const fits = (j) => (a?.eloRating ?? 0) >= j.providerRequirements[0].value;
      return ok({ matches: open.filter(fits).map((j) => ({ jobId: j.id })), rejected: open.filter((j) => !fits(j)).map((j) => ({ jobId: j.id, reason: `eloRating ${a?.eloRating ?? 0} < ${j.providerRequirements[0].value}` })) });
    }
    if (R("GET", /^\/v1\/marketplace\/agents\/([^/]+)\/auto-bid$/)) return ok(db.autoBid[decodeURIComponent(m[1])] || { enabled: false });
    if (R("PUT", /^\/v1\/marketplace\/agents\/([^/]+)\/auto-bid$/)) { db.autoBid[decodeURIComponent(m[1])] = { ...body }; return ok(body); }
    if (R("GET", /^\/v1\/marketplace\/agents\/([^/]+)\/identity$/)) { const i = db.identity[decodeURIComponent(m[1])]; return i ? ok({ identity: i }) : fail(404, "No identity yet"); }
    if (R("POST", /^\/v1\/marketplace\/agents\/([^/]+)\/register-identity$/)) { const id = decodeURIComponent(m[1]); db.identity[id] = { status: "REGISTERED", erc8004AgentId: String(9100 + db.seq++) }; return ok({ identity: db.identity[id] }); }
    if (R("GET", /^\/v1\/a2a\/reputation\/agents\/([^/]+)$/)) return ok({ agentId: m[1], score: 92, feedback: 14 });
    return fail(404, "Not found");
  }

  function okx(method, path, q, body) {
    let m;
    const R = (verb, re) => method === verb && (m = re.exec(path));
    const myBiz = () => {
      const ceo = db.mine[0];
      if (!ceo) return [];
      const linked = (business) => db.providers.find((p) => p.mine && p.business === business) || null;
      return [
        { business: "CREATE", businessId: "agy_neonwarden", name: db.fresh ? `${ceo.name} Studios` : "Neon Warden Studios", ceo: { name: ceo.name }, services: [SERVICES.CREATE], provider: linked("CREATE") },
        { business: "SPORTS", businessId: "spa_neonwarden", name: `${ceo.name} FC Analytics`, ceo: { name: ceo.name }, services: [SERVICES.SPORTS], provider: linked("SPORTS") }
      ];
    };
    if (R("GET", /^\/me$/)) return ok({ businesses: myBiz(), unavailable: [] });
    if (R("POST", /^\/challenge$/)) {
      const id = String(body?.okxAgentId || "").replace(/\D/g, "");
      if (!id) return fail(400, "Enter the number of the OKX.AI agent you own");
      const message = `Link OKX.AI agent #${id} to ${body.businessName} on Kult\nNonce: ${hex(8).slice(2)}`;
      return ok({ okx: { agentId: id, name: body.businessName }, signer: WALLET, message, token: hex(16), command: `onchainos wallet sign-message --message "${message.replace(/\n/g, "\\n")}"` });
    }
    if (R("POST", /^\/providers$/)) {
      if (!String(body?.signature || "").startsWith("0x")) return fail(400, "Paste the signature from your OKX wallet");
      const biz = myBiz().find((b) => b.business === body.business);
      const p = provider(Math.random, { business: body.business, name: biz?.name || "My business", ceo: biz?.ceo?.name, okxAgentId: String(body.okxAgentId), usdt: Number(SERVICES[body.business].defaultPrice) / 1e6, jobs: 0, owner: WALLET, now: Date.now(), mine: true });
      p.enabled = false; p.linkedAt = iso(Date.now()); p.stats.rating = null; p.reviews = []; p.businessId = body.businessId;
      db.providers.push(p); db.provJobs[p.id] = [];
      return ok({ provider: p });
    }
    if (R("PATCH", /^\/providers\/([^/]+)$/)) {
      const p = db.providers.find((x) => x.id === m[1]);
      if (!p) return fail(404, "Not found");
      if (typeof body.enabled === "boolean") p.enabled = body.enabled;
      if (body.prices) for (const [, v] of Object.entries(body.prices)) p.services[0].price = String(v);
      if (body.directorKey) p.hasBusinessKey = true;
      return ok({ provider: p });
    }
    if (R("GET", /^\/providers$/)) { const k = q.get("business"); return ok({ providers: db.providers.filter((p) => p.enabled && (!k || p.business === k)) }); }
    if (R("GET", /^\/providers\/([^/]+)\/jobs$/)) return ok({ jobs: (db.provJobs[m[1]] || []).map(withPlayUrl) });
    if (R("GET", /^\/providers\/([^/]+)$/)) { const p = db.providers.find((x) => x.id === m[1]); return p ? ok(p) : fail(404, "Not found"); }
    if (R("GET", /^\/fixtures$/)) return ok({ fixtures: fixtureList() });
    if (R("GET", /^\/jobs\/([^/]+)$/)) {
      const j = db.okxJobs[m[1]];
      if (!j) return fail(404, "Job not found");
      if (j.status === "RUNNING") {
        const n = Math.min(BUILD_LINES.length, Math.floor((Date.now() - Date.parse(j.createdAt)) / 1800));
        j.stages = BUILD_LINES.slice(0, n).map((line, i) => ({ id: String(i), line }));
        j.progress = Math.min(1, 0.04 + n / BUILD_LINES.length);
        if (n >= BUILD_LINES.length) { j.status = "DELIVERED"; j.progress = 1; }
      }
      return ok({ job: withPlayUrl(j) });
    }
    return fail(404, "Not found");
  }

  // One call to a provider's A2MCP endpoint: 402 without a payment, the job with one.
  async function a2mcp(providerId, service, input, paymentHeader) {
    await wait(350 + Math.random() * 300);
    tick();
    const p = db.providers.find((x) => x.id === providerId), sv = p?.services.find((s) => s.id === service);
    if (!p || !sv) return { status: 404, headers: {}, body: { error: "No such service" } };
    const resource = { url: sv.endpoint, description: sv.summary, mimeType: "application/json" };
    if (!paymentHeader) {
      return { status: 402, headers: { "payment-required": "x402" }, body: { x402Version: 2, error: "Payment required", resource,
        accepts: [{ scheme: "exact", network: "eip155:196", amount: sv.price, asset: USDT0, payTo: p.payTo, maxTimeoutSeconds: 300, extra: { name: "USD₮0", version: "1" } }] } };
    }
    await wait(900);
    const j = okxJobRecord(db, p, { at: Date.now(), buyerKind: "kw", payer: WALLET, input: { genre: "runner", ...input } });
    if (sv.async) { j.status = "RUNNING"; j.progress = 0.04; j.stages = []; }
    db.okxJobs[j.id] = j;
    (db.provJobs[p.id] ||= []).unshift(j);
    p.stats.jobs += 1; p.stats.earnedBaseUnits = String(BigInt(p.stats.earnedBaseUnits) + BigInt(sv.price));
    save();
    return { status: sv.async ? 202 : 200, headers: { "x-payment-response": "settled" }, body: { job: withPlayUrl(j), ...(sv.async ? { statusUrl: `${GATEWAY}/jobs/${j.id}` } : {}) } };
  }

  // ---------------------------------------------------------------- the entry point
  async function call(base, path, { method = "GET", body } = {}) {
    await wait(120 + Math.random() * 240);
    tick();
    const u = new URL(path, "http://demo");
    const r = base === "create" ? create(method, u.pathname, u.searchParams, body) : base === "kult" ? kult(method, u.pathname, u.searchParams, body) : arena(method, u.pathname, u.searchParams, body);
    save();
    // Callers get copies, as they would from the network.
    return { status: r.status, data: JSON.parse(JSON.stringify(r.data ?? null)) };
  }

  // Privy, signed in as the demo player; signing returns placeholder signatures.
  const privy = {
    get authenticated() { return db.signedIn; },
    user: () => ({ id: "did:privy:demo", email: EMAIL, wallets: [{ address: WALLET }] }),
    login: async () => { await wait(900); db.signedIn = true; save(); },
    logout: async () => { db.signedIn = false; save(); },
    tokens: async () => ({ accessToken: "demo-privy", identityToken: "demo-privy" }),
    signMessage: async () => { await wait(600); return hex(65); },
    signTypedData: async () => { await wait(800); return hex(65); }
  };

  // Kult Syndicates in demo: the Switchyard's own sandbox signs the player in;
  // the record shows two sample receipts.
  function syndicateRecord(agentId) {
    const now = Date.now();
    return [
      { id: `rcpt_demo_heist_${agentId}`, missionType: "heist", outcome: "SUCCESS", domain: "operations", label: "SERVICE_VERIFIED", hash: hex(32).slice(2), createdAt: Math.floor((now - 2 * H) / 1000), opponentType: "NPC" },
      { id: `rcpt_demo_scout_${agentId}`, missionType: "scout", outcome: "SUCCESS", domain: "reconnaissance", label: "SERVICE_VERIFIED", hash: hex(32).slice(2), createdAt: Math.floor((now - 3 * H) / 1000), opponentType: "NPC" }
    ];
  }

  return { call, a2mcp, privy, syndicateRecord };
}

// The demo player's Kult World passport (level, stamps, quests), so the HUD
// looks like an account that has been playing for weeks.
function seedProgress(fresh) {
  const key = `kw.progress.v2.${WALLET}`;
  try {
    // A fresh demo is a new player: no progress, and the tutorial again.
    if (fresh) { localStorage.removeItem(key); localStorage.removeItem(`kw.tour.v1.${WALLET}`); return; }
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify({
      citizenSince: iso(now - 62 * D), level: 12, xp: 8940, xpToNext: 13572, stamps: ["park", "hub", "create", "sports", "deal", "market", "a2a"],
      quests: [
        { id: "visit-park", target: 1, reward: 50, progress: 1 }, { id: "arcade-win", target: 3, reward: 150, progress: 2 },
        { id: "open-business", target: 1, reward: 100, progress: 1 }, { id: "close-deal", target: 1, reward: 80, progress: 0 },
        { id: "hire-agent", target: 1, reward: 100, progress: 0 }
      ],
      activity: [
        { at: iso(now - 3 * H), text: "Hired Golden Boot Analytics through OKX for 0.80 USDT" },
        { at: iso(now - 26 * H), text: "Closed a sponsorship with Talon for 255 $ARENA" },
        { at: iso(now - 3 * D), text: "Entered Kult Create" }
      ]
    }));
  } catch { /* storage optional */ }
}
