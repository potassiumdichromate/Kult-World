// Kult World's catalogues and the mapping from KULT's live data. The player,
// their agent, balances and the city's other agents come from the backends
// (js/kult.js); this module holds what the world itself defines: clans,
// archetypes, ranks, businesses, the Game Hub line-up, the Deal Room's deals,
// and the player's Kult World progression (level, stamps, quests), which is
// kept per wallet because no KULT backend tracks it.
// Shapes and wording follow the Kult browser (kult-games-v3) and AI Arena.

export const CLANS = [
  { id: "ZEROG", name: "ZeroG", color: "#b18cff" },
  { id: "BASE", name: "Base", color: "#5ea0ff" },
  { id: "SOLANA", name: "Solana", color: "#3ddc84" },
  { id: "OKX", name: "OKX", color: "#e8e8e8" }
];

// AI Arena archetypes (kult-games-v3 src/constants/arenaAgentArchetypes.ts).
export const ARCHETYPES = [
  { id: "berserker", name: "Berserker", tagline: "Overwhelm with relentless pressure.", role: ["Aggression", "Momentum", "Finishers"], color: "#fb923c" },
  { id: "tactician", name: "Tactician", tagline: "Reads the board three moves ahead.", role: ["Control", "Tempo", "Counter-play"], color: "#5ec8f2" },
  { id: "defender", name: "Defender", tagline: "Absorbs chaos and turns it into wins.", role: ["Fortify", "Sustain", "Zone control"], color: "#c792ea" },
  { id: "assassin", name: "Assassin", tagline: "Strikes where the meta is weakest.", role: ["Burst", "Flanks", "Punish mistakes"], color: "#f87171" },
  { id: "support", name: "Support", tagline: "Elevates allies and outlasts the clock.", role: ["Buffs", "Recovery", "Team tempo"], color: "#4ade80" },
  { id: "hybrid", name: "Hybrid", tagline: "Unpredictable, never the same fight twice.", role: ["Adapt", "Pivot", "Meta-break"], color: "#a78bfa" }
];
export const archetype = (id) => ARCHETYPES.find((a) => a.id === String(id).toLowerCase()) || ARCHETYPES[5];

// The 8 agent traits shown in Kult World, and the AI Arena trait each reads.
export const TRAITS = ["Aggression", "Precision", "Adaptability", "Creativity", "Patience", "Resilience", "Deception", "Loyalty"];

// The 8 ELO rank tiers (kult-games-v3 memory.md / ai_arena_icons).
export const RANKS = [
  { name: "Initiate", min: 0, color: "#22c55e", badge: "initiate.png" },
  { name: "Corporal", min: 1500, color: "#f97316", badge: "corporal.png" },
  { name: "Cyber Lieutenant", min: 3000, color: "#06b6d4", badge: "cyber_lt.png" },
  { name: "Quantum Major", min: 5000, color: "#eab308", badge: "quantam_maj.png" },
  { name: "Neural Captain", min: 7500, color: "#a855f7", badge: "neural_capt.png" },
  { name: "Protocol Commander", min: 10000, color: "#8b5cf6", badge: "proto_cmo.png" },
  { name: "Genesis Overlord", min: 15000, color: "#f59e0b", badge: "genesis_ovl.png" },
  { name: "Singularity Prime", min: 25000, color: "#818cf8", badge: "singularity.png" }
];
export const rankOf = (elo) => [...RANKS].reverse().find((r) => elo >= r.min) || RANKS[0];
export const nextRank = (elo) => RANKS.find((r) => r.min > elo) || null;

// Kult Create and Kult Sports open inside Kult World already signed in
// (see openApp in main.js); their addresses come from /config.json.
export const BUSINESSES = [
  { id: "create", name: "Gaming Studio", brand: "Kult Create", status: "open", color: "#ff7eb6", blurb: "Run an indie game studio. Your agent is the CEO; an AI team builds and ships games." },
  { id: "sports", name: "Sports Agency", brand: "Kult Sports", status: "open", color: "#3ddc84", blurb: "Run a football analysis agency. Analysts read every match; real results climb the leaderboard." },
  { id: "dex", name: "Dex Trading", brand: "Kult Dex", status: "soon", color: "#5ec8f2", blurb: "Let your agent trade on-chain markets with the strategies you design." },
  { id: "production", name: "Film Production", brand: "Kult Production", status: "soon", color: "#f2c14e", blurb: "Produce films, trailers and music videos with an AI crew." }
];

// The AI Arena games (kult-games-v3 src/constants/aiArenaMatchmaking.ts).
// `id` keys Kult World's art and text; `arenaId` is what AI Arena calls it.
export const GAMES = [
  { id: "warzone", arenaId: "warzone", name: "Warzone Warriors", color: "#f78c6b", engine: "unity" },
  { id: "robowars", arenaId: "robowar", name: "Robowars", color: "#5ec8f2", engine: "launcher" },
  { id: "wave", arenaId: "warzone-wave", name: "Warzone Warriors Wave", color: "#c792ea", engine: "unity" },
  { id: "highway", arenaId: "highway-hustle", name: "Highway Hustle", color: "#f2c14e", engine: "unity" }
];
export const gameByArenaId = (id) => GAMES.find((g) => g.arenaId === id) || GAMES[0];
export const MATCH_MODES = [
  { id: "RANKED", name: "Ranked" },
  { id: "CASUAL", name: "Casual" }
];

// ------------------------------------------------------------------ Deal Room
// Live deals your agent can negotiate. Text is bilingual: { en, zh }.
export const DEALS = [
  { id: "d1", kind: "otc", title: { en: "Buy 500 KULT below market", zh: "以低于市价购入 500 KULT" }, who: "Vex", archetype: "assassin", ask: 420, trust: 88, mins: 12 },
  { id: "d2", kind: "sponsor", title: { en: "Sponsor Pixel FC's derby match", zh: "赞助 Pixel FC 的德比赛" }, who: "Talon", archetype: "berserker", ask: 300, trust: 74, mins: 25 },
  { id: "d3", kind: "partner", title: { en: "Co-publish a racing game with Orbit Studios", zh: "与 Orbit Studios 联合发行一款赛车游戏" }, who: "Zephyr", archetype: "tactician", ask: 650, trust: 92, mins: 40 },
  { id: "d4", kind: "license", title: { en: "License the 'Neon Space' IP for a film", zh: "授权 Neon Space IP 改编电影" }, who: "Rook", archetype: "hybrid", ask: 520, trust: 67, mins: 8 },
  { id: "d5", kind: "otc", title: { en: "Sell 2,000 $ARENA for KULT", zh: "出售 2,000 $ARENA 换取 KULT" }, who: "Saga", archetype: "support", ask: 260, trust: 95, mins: 18 }
];
export const DEAL_LINES = {
  open: { en: "Opening at {price} $ARENA. That's fair for both sides.", zh: "开价 {price} $ARENA，对双方都公平。" },
  counter: { en: "Can't go that low. {price} and we have a deal.", zh: "太低了。{price}，我们就成交。" },
  push: { en: "Meet me at {price}? I can close right now.", zh: "{price} 怎么样？我现在就能成交。" },
  accept: { en: "Deal at {price}. Pleasure doing business.", zh: "{price} 成交，合作愉快。" },
  walk: { en: "We're too far apart. Maybe next time.", zh: "差距太大了，下次再说吧。" }
};

// ------------------------------------------------------------------ live agents
const TRAIT_KEY = { Aggression: "aggression", Precision: "precision", Adaptability: "adaptability", Creativity: "creativity", Patience: "patience", Resilience: "resilience", Deception: "deception", Loyalty: "loyalty" };

/** An AI Arena agent (GET /v1/agents/...) in Kult World's shape. Missing traits stay null. */
export function agentFromApi(a) {
  const raw = a?.traits && typeof a.traits === "object" ? a.traits : {};
  const traits = Object.fromEntries(TRAITS.map((t) => {
    const v = Number(raw[TRAIT_KEY[t]] ?? raw[t]);
    return [t, Number.isFinite(v) ? Math.round(v <= 1 ? v * 100 : v) : null];
  }));
  return {
    id: String(a.id), name: String(a.name ?? "Agent"), archetype: String(a.archetype ?? "hybrid").toLowerCase(),
    clan: String(a.clan ?? "ZEROG").toUpperCase(), backstory: a.description ?? a.metadata?.backstory ?? "",
    inft: a.inftTokenId ?? null, evolution: String(a.evolutionStage ?? "GENESIS"),
    elo: Number(a.eloRating ?? 1000), wins: Number(a.wins ?? 0), losses: Number(a.losses ?? 0), draws: Number(a.draws ?? 0),
    traits, mintedAt: a.createdAt ?? null, status: a.status ?? null
  };
}

// ------------------------------------------------------------------ Kult World progression
// Level, XP, stamps and quests are Kult World's own game layer. No KULT
// backend tracks them, so they live in this browser, keyed by wallet.
const QUESTS = [
  { id: "visit-park", target: 1, reward: 50 },
  { id: "arcade-win", target: 3, reward: 150 },
  { id: "open-business", target: 1, reward: 100 },
  { id: "close-deal", target: 1, reward: 80 },
  { id: "hire-agent", target: 1, reward: 100 }
];
const progressKey = (wallet) => `kw.progress.v2.${String(wallet || "anon").toLowerCase()}`;

export function loadProgress(wallet) {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(progressKey(wallet)) || "null"); } catch { /* storage optional */ }
  p ||= { citizenSince: new Date().toISOString(), level: 1, xp: 0, xpToNext: 500, stamps: [], quests: [], activity: [] };
  for (const q of QUESTS) if (!p.quests.some((x) => x.id === q.id)) p.quests.push({ ...q, progress: 0 });
  p.quests = p.quests.filter((q) => QUESTS.some((x) => x.id === q.id)).map((q) => ({ ...q, reward: QUESTS.find((x) => x.id === q.id).reward }));
  return p;
}
export function saveProgress(wallet, p) {
  try { localStorage.setItem(progressKey(wallet), JSON.stringify({ citizenSince: p.citizenSince, level: p.level, xp: p.xp, xpToNext: p.xpToNext, stamps: p.stamps, quests: p.quests, activity: p.activity.slice(0, 20) })); } catch { /* private mode */ }
}
