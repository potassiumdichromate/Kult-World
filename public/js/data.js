// Kult World's catalogues and the mapping from KULT's live data. The player,
// their agent, balances and the city's other agents come from the backends
// (js/kult.js); this module holds what the world itself defines: clans,
// archetypes, ranks, businesses, the Game Hub line-up, the Deal Room's deals,
// and the player's Kult World progression (level, stamps, quests), which is
// kept per wallet because no KULT backend tracks it.
// Shapes and wording follow the Kult browser (kult-games-v3) and AI Arena.

export const CLANS = [
  { id: "ZEROG", name: "0G", color: "#b18cff", logo: "0g-white" },
  { id: "BASE", name: "Base", color: "#3d7bff", logo: "base-mark" },
  { id: "SOLANA", name: "Solana", color: "#14f195", logo: "solana-mark" },
  { id: "OKX", name: "OKX", color: "#e8e8e8", logo: "okx" }
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

// The legacy Kult titles a player plays themself (kult-games-v3 src/pages/Games.tsx).
// `id` is the Kult backend's identification: GET /games/all gives the live
// play URL, plays and rating; this list gives the art, order and genre, so the
// folder shows even while the catalog loads. `cover` is under art/.
export const LEGACY_GAMES = [
  { id: "guesstheai", name: "Guess the AI", genre: "puzzle", color: "#a98bff", cover: "hub/legacy-guesstheai.webp" },
  { id: "highwayhustle", name: "Highway Hustle", genre: "racing", color: "#f2c14e", cover: "world/thumb-highway.webp", modes: true },
  { id: "warzonewarriors", name: "Warzone Warriors", genre: "action", color: "#f78c6b", cover: "world/thumb-warzone.webp" },
  { id: "zerodash", name: "Zero Dash", genre: "arcade", color: "#ff9a3c", cover: "hub/legacy-zerodash.webp", engine: "zerodash" },
  { id: "robowars", name: "Robowars", genre: "action", color: "#5ec8f2", cover: "world/thumb-robowars.webp" },
  { id: "zerogpool", name: "Zero G Pool", genre: "arcade", color: "#4fd8ff", cover: "hub/legacy-zerogpool.webp" }
];
// Highway Hustle's four Unity builds, one per mode (kult-games-v3 src/constants/highwayHustleModes.ts).
export const HIGHWAY_MODES = [
  { id: "one-way", url: "https://pub-0025cff360c44334b8cc47c146e9c55c.r2.dev/OneWay/9/index.html" },
  { id: "two-way", url: "https://pub-0025cff360c44334b8cc47c146e9c55c.r2.dev/TwoWay/6/index.html" },
  { id: "speed-run", url: "https://pub-0025cff360c44334b8cc47c146e9c55c.r2.dev/SpeedRun/5/index.html" },
  { id: "time-bomb", url: "https://pub-0025cff360c44334b8cc47c146e9c55c.r2.dev/TimeBomb/5/index.html" }
];

// ------------------------------------------------------------------ live agents
const TRAIT_KEY = { Aggression: "aggression", Precision: "precision", Adaptability: "adaptability", Creativity: "creativity", Patience: "patience", Resilience: "resilience", Deception: "deception", Loyalty: "loyalty" };

/** An AI Arena agent (GET /v1/agents/...) in Kult World's shape. Missing traits stay null. */
// Agents whose owners never named them carry AI Arena's default name
// ("kult-player_a930696c", "agent-1411"), which reads like a bot account in the
// city. Those show a callsign made from the agent's id instead, the same on
// every screen and for every player; real names are never touched.
const DEFAULT_NAME = /^(?:kult[-_ ]?player|player|user|agent)[-_ ]?[0-9a-f]{3,}$/i;
const CALL_A = ["Neon", "Rift", "Nova", "Volt", "Pixel", "Lunar", "Cyber", "Blaze", "Frost", "Echo", "Prism", "Vortex", "Hyper", "Solar", "Shadow", "Crimson", "Quantum", "Astro", "Turbo", "Glitch"];
const CALL_B = ["Falcon", "Runner", "Viper", "Sage", "Raven", "Wolf", "Ronin", "Comet", "Knight", "Fox", "Titan", "Specter", "Lynx", "Pilot", "Drifter", "Phoenix", "Hawk", "Nomad", "Striker", "Ghost"];
export function displayName(name, id) {
  const n = String(name ?? "").trim();
  if (n && !DEFAULT_NAME.test(n)) return n;
  let h = 2166136261;
  for (const ch of String(id ?? n)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `${CALL_A[h % CALL_A.length]}${CALL_B[(h >>> 8) % CALL_B.length]}${10 + ((h >>> 16) % 90)}`;
}

export function agentFromApi(a) {
  const raw = a?.traits && typeof a.traits === "object" ? a.traits : {};
  const traits = Object.fromEntries(TRAITS.map((t) => {
    const v = Number(raw[TRAIT_KEY[t]] ?? raw[t]);
    return [t, Number.isFinite(v) ? Math.round(v <= 1 ? v * 100 : v) : null];
  }));
  return {
    id: String(a.id), name: displayName(a.name, a.id), rawName: String(a.name ?? ""), archetype: String(a.archetype ?? "hybrid").toLowerCase(),
    clan: String(a.clan ?? "ZEROG").toUpperCase(), backstory: a.description ?? a.metadata?.backstory ?? "",
    inft: a.inftTokenId ?? null, evolution: String(a.evolutionStage ?? "GENESIS"),
    elo: Number(a.eloRating ?? 1000), wins: Number(a.wins ?? 0), losses: Number(a.losses ?? 0), draws: Number(a.draws ?? 0),
    traits, mintedAt: a.createdAt ?? null, status: a.status ?? null
  };
}

// ------------------------------------------------------------------ Kult World progression
// Level, XP, stamps and quests are Kult World's own game layer. No KULT
// backend tracks them, so they live in this browser, keyed by wallet.
// First steps, in order: meet the agent, see it do one verified piece of
// work, then build, hire or play. Kult World is an agent economy with games
// in it, so a battle is one choice among them, not the entry requirement.
const QUESTS = [
  { id: "meet-agent", target: 1, reward: 50 },
  { id: "verified-action", target: 1, reward: 120 },
  { id: "open-business", target: 1, reward: 100 },
  { id: "hire-agent", target: 1, reward: 100 },
  { id: "arcade-win", target: 1, reward: 80 }
];
const progressKey = (wallet) => `kw.progress.v2.${String(wallet || "anon").toLowerCase()}`;

export function loadProgress(wallet) {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(progressKey(wallet)) || "null"); } catch { /* storage optional */ }
  p ||= { citizenSince: new Date().toISOString(), level: 1, xp: 0, xpToNext: 500, stamps: [], quests: [], activity: [] };
  // The definitions set the order, target and reward; a save only keeps progress.
  p.quests = QUESTS.map((q) => { const had = p.quests.find((x) => x.id === q.id); return { ...q, progress: Math.min(q.target, had?.progress ?? 0) }; });
  return p;
}
export function saveProgress(wallet, p) {
  try { localStorage.setItem(progressKey(wallet), JSON.stringify({ citizenSince: p.citizenSince, level: p.level, xp: p.xp, xpToNext: p.xpToNext, stamps: p.stamps, quests: p.quests, activity: p.activity.slice(0, 20) })); } catch { /* private mode */ }
}
