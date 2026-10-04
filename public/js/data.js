// Simulated data for the Kult World demo. Everything the real backends will
// provide later (player, passport, agent, balances, businesses, arcade games,
// opponents) lives here, so wiring the APIs means replacing this module.
// Shapes and wording follow the Kult browser (kult-games-v3) and AI Arena.

export const CLANS = [
  { id: "ZEROG", name: "ZeroG", color: "#b18cff" },
  { id: "BASE", name: "Base", color: "#5ea0ff" },
  { id: "SOLANA", name: "Solana", color: "#3ddc84" }
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

// The 8 agent traits (kult-games-v3 TraitsPanel), 0-100.
export const TRAITS = ["Aggression", "Precision", "Adaptability", "Creativity", "Patience", "Resilience", "Deception", "Loyalty"];
const TRAIT_BIAS = {
  berserker: { Aggression: 30, Resilience: 10, Patience: -20 },
  tactician: { Precision: 20, Patience: 20, Aggression: -10 },
  defender: { Resilience: 30, Loyalty: 15, Aggression: -15 },
  assassin: { Deception: 30, Precision: 15, Loyalty: -10 },
  support: { Loyalty: 30, Patience: 15, Deception: -15 },
  hybrid: { Adaptability: 30, Creativity: 15 }
};

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

export const BUSINESSES = [
  {
    id: "create", name: "Gaming Studio", brand: "Kult Create", status: "open", color: "#ff7eb6",
    blurb: "Run an indie game studio. Your agent is the CEO; an AI team builds and ships games.",
    stat: "1,284 studios", url: "https://kult-create.onrender.com/office/?demo=1"
  },
  {
    id: "sports", name: "Sports Market", brand: "Kult Sports", status: "open", color: "#3ddc84",
    blurb: "Run a football analysis agency. Analysts read every match; real results climb the leaderboard.",
    stat: "862 agencies", url: "https://kult-sports.onrender.com/?demo=1"
  },
  {
    id: "dex", name: "Dex Trading", brand: "Kult Dex", status: "soon", color: "#5ec8f2",
    blurb: "Let your agent trade on-chain markets with the strategies you design.", stat: "Coming soon"
  },
  {
    id: "production", name: "Entertainment Production", brand: "Kult Production", status: "soon", color: "#f2c14e",
    blurb: "Produce shows, trailers and music videos with an AI crew.", stat: "Coming soon"
  }
];

export const GAMES = [
  { id: "warzone", name: "Warzone Warriors", genre: "Top-down shooter", blurb: "Two agents, one arena, last one standing.", color: "#f78c6b", mode: "1v1 duel", reward: 40, players: "2,140 playing" },
  { id: "robowars", name: "Robowars", genre: "Mech brawler", blurb: "Giant robots trade lasers and punches.", color: "#5ec8f2", mode: "1v1 duel", reward: 40, players: "1,382 playing" },
  { id: "wave", name: "Warzone Warriors Wave", genre: "Wave survival", blurb: "Hold out against endless waves. Top score wins.", color: "#c792ea", mode: "1v1 score attack", reward: 50, players: "906 playing" },
  { id: "highway", name: "Highway Hustle", genre: "Racing", blurb: "Weave through traffic at full speed. Furthest wins.", color: "#f2c14e", mode: "1v1 race", reward: 35, players: "1,775 playing" }
];

const NAMES = ["Kraken", "Vex", "Orion", "Nyx", "Bolt", "Saga", "Rook", "Echo", "Mako", "Rune", "Pip", "Zephyr", "Halo", "Glitch", "Nova", "Blaze", "Talon", "Quill"];
export const randomName = () => NAMES[Math.floor(Math.random() * NAMES.length)];
export function randomOpponent(myElo = 1200) {
  const a = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)], c = CLANS[Math.floor(Math.random() * CLANS.length)];
  return { name: randomName(), archetype: a.id, clan: c.id, elo: Math.max(900, Math.round(myElo + (Math.random() - 0.5) * 220)), wins: 10 + Math.floor(Math.random() * 90), losses: 5 + Math.floor(Math.random() * 40) };
}

// Other players' agents walking around the world.
export function wanderers(n = 8) {
  return Array.from({ length: n }, (_, i) => ({ id: `npc${i}`, name: NAMES[(i * 5 + 3) % NAMES.length], archetype: ARCHETYPES[(i + 2) % ARCHETYPES.length].id, clan: CLANS[i % CLANS.length].id }));
}

// ------------------------------------------------------------------ the player
const KEY = "kultworld.demo.player.v1";
const seed = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// A freshly minted agent and the player's passport.
export function mintAgent({ name, archetype: arch, clan, backstory, username }) {
  const h = seed(name + arch);
  const traits = Object.fromEntries(TRAITS.map((t, i) => [t, Math.max(8, Math.min(96, 45 + ((h >> i) % 21) - 10 + (TRAIT_BIAS[arch]?.[t] || 0)))]));
  return {
    passport: {
      id: `KW-${String(100000 + (h % 900000))}`, username: username || "kultplayer", wallet: `0x${(h * 2654435761 >>> 0).toString(16).padStart(8, "0")}…${(h % 65536).toString(16).padStart(4, "0")}`,
      citizenSince: new Date().toISOString(), level: 1, xp: 0, xpToNext: 500, stamps: []
    },
    agent: {
      name, archetype: arch, clan, backstory, inft: 4000 + (h % 6000), evolution: "GENESIS",
      elo: 1000, wins: 0, losses: 0, traits, mintedAt: new Date().toISOString()
    },
    balances: { arena: 250, kp: 100, kult: 0 },
    businesses: {
      create: { owned: false }, sports: { owned: false }, dex: { owned: false }, production: { owned: false }
    },
    quests: [
      { id: "visit-park", title: "Visit the Kult Business Park", target: 1, progress: 0, reward: "50 KP" },
      { id: "arcade-win", title: "Win 3 battles in the Kult Arcade", target: 3, progress: 0, reward: "100 $ARENA" },
      { id: "open-business", title: "Open your first business", target: 1, progress: 0, reward: "250 KP" }
    ],
    activity: [{ at: new Date().toISOString(), text: `${name} was minted and spawned in Kult World.` }]
  };
}

// A returning player with history (for the "existing player" demo path).
export function veteranPlayer() {
  const p = mintAgent({ name: "Nova", archetype: "tactician", clan: "ZEROG", backstory: "Built for smart plays, sharp banter, and a long climb up the arena ladder.", username: "nova.eth" });
  Object.assign(p.passport, { level: 7, xp: 320, xpToNext: 900, citizenSince: new Date(Date.now() - 41 * 864e5).toISOString(), stamps: ["park", "arcade", "create", "sports"] });
  Object.assign(p.agent, { elo: 1640, wins: 23, losses: 9, evolution: "AWAKENED", mintedAt: new Date(Date.now() - 41 * 864e5).toISOString() });
  p.balances = { arena: 1840, kp: 4210, kult: 12 };
  p.businesses = {
    create: { owned: true, name: "Pixel Pirates", credits: 960, gamesShipped: 4, plays: 1203 },
    sports: { owned: true, name: "Pixel FC", credits: 1380, level: 2, points: 61.5, rank: 7 },
    dex: { owned: false }, production: { owned: false }
  };
  p.quests = [
    { id: "visit-park", title: "Visit the Kult Business Park", target: 1, progress: 1, reward: "50 KP" },
    { id: "arcade-win", title: "Win 3 battles in the Kult Arcade", target: 3, progress: 2, reward: "100 $ARENA" },
    { id: "open-business", title: "Open your first business", target: 1, progress: 1, reward: "250 KP" }
  ];
  p.activity = [
    { at: new Date(Date.now() - 3600e3).toISOString(), text: "Won Robowars vs Kraken (+150 ELO)" },
    { at: new Date(Date.now() - 5 * 3600e3).toISOString(), text: "Pixel FC locked picks for Arsenal v Chelsea" },
    { at: new Date(Date.now() - 26 * 3600e3).toISOString(), text: "Pixel Pirates shipped “Neon Space Shooter”" }
  ];
  return p;
}

export function loadPlayer() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
export function savePlayer(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ } }
export function resetPlayer() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
