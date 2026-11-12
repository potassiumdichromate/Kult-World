// The live KULT backends behind Kult World: sign-in and every API call.
//
//   Privy (the shared KULT app)  → who the player is, and their wallets
//   AI Arena gateway (/api/arena) → agents, battles, matchmaking, wallets,
//                                   leaderboards, the A2A marketplace and
//                                   $ARENA on 0G Chain (same calls as the
//                                   Kult browser, kult-games-v3 src/api/)
//   Kult backend (/api/kult)      → player profile, KP and the KP
//                                   leaderboard, via SIWE
//   Kult World referrals          → hardcoded in js/constants.js
//                                   (https://api-backend-v2.kult.games/api/kult-world/referrals)
//
// Sign-in follows the Kult browser's AuthContext: Privy login, then the
// Privy access token is exchanged for an AI Arena token (POST /v1/auth/privy),
// then the player signs a SIWE message for the Kult backend. That sign-in
// is sent to the hardcoded Kult World API so a referral code is credited
// there. The Kult login is optional: when it fails, KP is shown as
// unavailable, never invented.

import { KULT_WORLD_REFERRALS_URL } from "./constants.js";

const KEYS = { arena: "kw.arena.session.v1", kult: "kw.kult.session.v1" };
// Same host as the Kult World referral list, without the /kult-world/referrals path.
const KULT_WORLD_API = KULT_WORLD_REFERRALS_URL.replace(/\/kult-world\/referrals\/?$/, "");
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch { /* private mode */ } };

// Demo mode (js/demo.js) answers every call below in the browser: DEMO_MODE
// on the server ("1" or "fresh"), or ?demo=1 / ?demo=fresh in the address;
// ?demo=0 turns it off.
let cfg = null, cfgLoading = null, demo = null;
export function config() {
  cfgLoading ||= fetch("config.json", { cache: "no-store" }).then((r) => r.json()).then(async (c) => {
    const params = new URLSearchParams(location.search), asked = params.get("demo");
    const mode = asked ?? c.demo;
    c.demo = mode && mode !== "0" ? mode : false;
    if (c.demo) {
      demo = (await import("./demo.js")).createDemo({ fresh: c.demo === "fresh", reset: asked === "fresh" });
      // A reload keeps what was just set up rather than starting over.
      if (asked === "fresh") { params.set("demo", "1"); history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`); }
    }
    cfg = c;
    return c;
  });
  return cfgLoading;
}
export const isDemo = () => Boolean(demo);

// ------------------------------------------------------------------ Privy
let privy = null, privyLoading = null;
export function privyClient() {
  privyLoading ||= (async () => {
    const c = await config();
    if (demo) return (privy = demo.privy);
    // Privy needs a secure page (HTTPS or localhost); a phone on http://<LAN IP> hangs.
    if (!window.isSecureContext) throw new Error("Sign-in needs HTTPS. Open Kult World over https:// (or localhost) to log in.");
    const { init } = await import(new URL("../privy/kult-privy.js", import.meta.url).href);
    privy = await init({ appId: c.privyAppId, clientId: c.privyClientId });
    return privy;
  })();
  return privyLoading;
}

// ------------------------------------------------------------------ HTTP
export class ApiError extends Error {
  constructor(message, status, body) { super(message); this.status = status; this.body = body; }
}
const errorText = (body, status) => body?.error?.message || body?.error || body?.message || `Request failed (${status})`;

const DR = "/v1/marketplace/deal-room";
async function call(base, path, { method = "GET", body, headers = {}, token } = {}) {
  // Local development: demo mode can still run the Deal Room on a real service.
  if (demo && cfg.dealRoomDemoToken && base === cfg.arenaApi && path.startsWith(DR)) token = cfg.dealRoomDemoToken;
  else if (demo) {
    const kultCall = base === cfg.kultApi || base === KULT_WORLD_API;
    const { status, data } = await demo.call(base === cfg.createApi ? "create" : kultCall ? "kult" : "arena", path, { method, body });
    if (status >= 400) throw new ApiError(errorText(data, status), status, data);
    return data;
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok) throw new ApiError(errorText(data, res.status), res.status, data);
  return data;
}

// ------------------------------------------------------------------ session
export const session = {
  arena: read(KEYS.arena),   // { accessToken, refreshToken, expiresAt, userId, walletAddress }
  kult: read(KEYS.kult),     // { token, walletAddress }
  get signedIn() { return Boolean(this.arena?.accessToken); },
  get wallet() { return this.arena?.walletAddress || null; }
};

// Referral links: <site>?referral=<code>. The first code seen is kept until
// the Kult backend sign-in sends it. Only a brand-new Kult player is credited.
const REFERRAL_KEY = "kult.referral";
(function captureReferral() {
  try {
    const code = new URLSearchParams(location.search).get("referral")?.trim();
    if (code && /^[A-Za-z0-9_-]{1,64}$/.test(code) && !localStorage.getItem(REFERRAL_KEY)) {
      localStorage.setItem(REFERRAL_KEY, code);
    }
  } catch { /* storage blocked */ }
})();
function readReferral() {
  try { return localStorage.getItem(REFERRAL_KEY) || undefined; } catch { return undefined; }
}

async function exchangePrivy() {
  const p = await privyClient();
  const { accessToken } = await p.tokens();
  const c = await config();
  const data = await call(c.arenaApi, "/v1/auth/privy", { method: "POST", body: { accessToken } });
  session.arena = {
    accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: Date.now() + (data.expiresIn || 900) * 1000,
    userId: data.userId, walletAddress: data.walletAddress, isNewUser: Boolean(data.isNewUser)
  };
  write(KEYS.arena, session.arena);
  return session.arena;
}

async function refreshArena() {
  const c = await config();
  try {
    const data = await call(c.arenaApi, "/v1/auth/refresh", { method: "POST", body: { refreshToken: session.arena?.refreshToken } });
    session.arena = { ...session.arena, accessToken: data.accessToken, expiresAt: Date.now() + (data.expiresIn || 900) * 1000 };
    write(KEYS.arena, session.arena);
  } catch {
    // The refresh token is gone or expired: Privy can mint a fresh session.
    const p = await privyClient();
    if (!p.authenticated) throw new ApiError("Your session expired. Sign in again.", 401);
    await exchangePrivy();
  }
}

/** The Kult backend's SIWE login (kult-games-v3 src/lib/siwe.ts). Referral credit goes to the hardcoded Kult World API. */
async function kultLogin(address) {
  const p = await privyClient();
  const nonceRes = await call(KULT_WORLD_API, `/player/nonce?walletAddress=${encodeURIComponent(address)}`);
  const nonce = (nonceRes?.data ?? nonceRes)?.nonce;
  if (!nonce) throw new Error("No sign-in nonce from the Kult backend");
  const message = [
    `${location.host} wants you to sign in with your Ethereum account:`, address, "",
    "Sign in to Kult Games, your on-chain gaming identity.", "",
    `URI: ${location.origin}`, "Version: 1", "Chain ID: 16661", `Nonce: ${nonce}`, `Issued At: ${new Date().toISOString()}`
  ].join("\n");
  const signature = await p.signMessage(address, message);
  const kultWorldReferralCode = readReferral();
  const res = await call(KULT_WORLD_API, "/player/login", { method: "POST", body: { walletAddress: address, message, signature, kultWorldReferralCode } });
  const token = (res?.data ?? res)?.token || res?.token;
  if (!token) throw new Error("The Kult backend returned no session");
  if (kultWorldReferralCode) { try { localStorage.removeItem(REFERRAL_KEY); } catch { /* ignore */ } }
  session.kult = { token, walletAddress: address };
  write(KEYS.kult, session.kult);
}

/** Opens Privy, then establishes both backend sessions. */
session.signIn = async function signIn() {
  const p = await privyClient();
  await p.login();
  const arena = await exchangePrivy();
  try { await kultLogin(arena.walletAddress || p.user().wallets[0]?.address); }
  catch (e) { console.warn("[kult] Kult backend sign-in failed; KP unavailable:", e.message); session.kult = null; write(KEYS.kult, null); }
  return arena;
};

/** On page load: keep a stored session only while Privy still says signed in. */
session.restore = async function restore() {
  const p = await privyClient();
  if (!p.authenticated) { session.clear(); return false; }
  if (!session.arena?.accessToken) await exchangePrivy();
  return true;
};

session.retryKult = async function retryKult() {
  await kultLogin(session.wallet);
};

session.clear = function clear() {
  session.arena = null; session.kult = null;
  write(KEYS.arena, null); write(KEYS.kult, null);
};

session.signOut = async function signOut() {
  session.clear();
  try { await (await privyClient()).logout(); } catch { /* already signed out */ }
};

async function arena(path, opts = {}) {
  const c = await config();
  if (opts.auth !== false && session.arena && session.arena.expiresAt - Date.now() < 30_000) await refreshArena();
  try {
    return await call(c.arenaApi, path, { ...opts, token: opts.auth === false ? undefined : session.arena?.accessToken });
  } catch (e) {
    if (e.status !== 401 || opts.auth === false || !session.arena) throw e;
    await refreshArena();
    return call(c.arenaApi, path, { ...opts, token: session.arena?.accessToken });
  }
}

async function kult(path, opts = {}) {
  const c = await config();
  if (opts.auth === false) return call(c.kultApi, path, opts);
  if (!session.kult?.token) throw new ApiError("Not signed in to the Kult backend", 401);
  try {
    return await call(c.kultApi, path, { ...opts, token: session.kult.token });
  } catch (e) {
    if (e.status === 401) { session.kult = null; write(KEYS.kult, null); }
    throw e;
  }
}

const q = (o) => { const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString(); return s ? `?${s}` : ""; };
const enc = encodeURIComponent;

// ------------------------------------------------------------------ AI Arena
export const arenaApi = {
  myAgents: async () => (await arena(`/v1/agents/mine${q({ page: 1, pageSize: 50 })}`))?.agents ?? [],
  agent: async (id) => { const d = await arena(`/v1/agents/${enc(id)}`); return d?.agent ?? d; },
  agents: (page = 1, pageSize = 20) => arena(`/v1/agents${q({ page, pageSize })}`),
  createAgent: async (body) => { const d = await arena("/v1/agents", { method: "POST", body }); return d?.agent ?? d; },
  wallet: async (agentId) => (await arena(`/v1/wallets/${enc(agentId)}`))?.wallet ?? null,
  leaderboard: async (limit = 20, period = "all_time") => (await arena(`/v1/leaderboards/global${q({ limit, period })}`, { auth: false }))?.entries ?? [],
  /** An agent's place on the global ELO leaderboard: { rank, score }. */
  rank: (agentId) => arena(`/v1/leaderboards/global/rank/${enc(agentId)}`, { auth: false }),
  agentTotal: async () => Number((await arena(`/v1/agents${q({ page: 1, pageSize: 1 })}`, { auth: false }))?.total ?? 0),
  battles: async (agentId, limit = 10) => (await arena(`/v1/battles${q({ agentId, status: "COMPLETED", limit })}`))?.battles ?? [],
  battle: async (id) => { const d = await arena(`/v1/battles/${enc(id)}`); return d?.battle ?? d; },
  joinQueue: (body, headers) => arena("/v1/matchmaking", { method: "POST", body, headers }),
  queueStatus: async (agentId) => (await arena(`/v1/matchmaking/status/${enc(agentId)}`))?.status ?? {},
  leaveQueue: (agentId) => arena(`/v1/matchmaking/${enc(agentId)}`, { method: "DELETE" }),
  challenge: async (body) => (await arena("/v1/matchmaking/match/direct", { method: "POST", body }))?.match,
  endBattle: (id, body) => arena(`/v1/battles/${enc(id)}/end`, { method: "POST", body }),
  evolveTraits: (agentId, body) => arena(`/v1/agents/${enc(agentId)}/evolve-traits`, { method: "POST", body }),
  trainFromBattle: (agentId, body) => arena(`/v1/agents/${enc(agentId)}/train`, { method: "POST", body }),
  commentary: (body) => arena("/v1/inference/battle-commentary", { method: "POST", body }),
  storeMemory: (agentId, body) => arena(`/v1/memory/${enc(agentId)}/memory/episode`, { method: "POST", body })
};

// ------------------------------------------------------------------ $ARENA on 0G Chain
// The player's own wallet holds $ARENA, an ERC-20 on 0G Chain: the backend's
// RewardDistributor pays it out (agent mint, quests, League wins) and the
// arena-chain service reads balances and indexes every event. Same calls as
// kult-games-v3 src/api/arenaChainApi.ts. Amounts are decimal strings.
export const chainApi = {
  balance: async (address) => (await arena(`/v1/arena/wallet/${enc(address)}`, { auth: false }))?.balanceArena ?? null,
  activity: async (address, page = 1, limit = 8) => {
    const d = await arena(`/v1/arena/transactions/${enc(address)}${q({ page, limit })}`, { auth: false });
    // The service answers { transactions }; older builds answered { events }.
    return { events: d?.transactions ?? d?.events ?? [], total: Number(d?.total ?? 0) };
  },
  config: () => arena("/v1/arena/config", { auth: false }),
  treasury: () => arena("/v1/arena/treasury", { auth: false })
};
export const explorer = {
  tx: (hash) => `https://chainscan.0g.ai/tx/${hash}`,
  address: (address) => `https://chainscan.0g.ai/address/${address}`
};

// ------------------------------------------------------------------ Kult backend
const gameText = (v) => (typeof v === "string" ? v : v?.en ?? Object.values(v ?? {})[0] ?? "");
// A Kult backend game in Kult World's shape (kult-games-v3 src/api/gamesApi.ts
// normalizeGame and src/lib/gameDownload.ts).
function gameFromApi(g) {
  const md = g.metadata ?? {};
  const download = Boolean(g.isDownloadable ?? g.is_downloadable);
  return {
    id: String(g.identification ?? g.slug ?? g.id ?? "").toLowerCase().replace(/[\s_-]+/g, ""),
    name: gameText(g.name),
    url: (download ? md.download_url || md.downloadUrl : md.play_url) || g.url || null,
    download,
    plays: pickNum(g.play_count, g.plays),
    rating: pickNum(g.rating)
  };
}
const pickNum = (...v) => { for (const x of v) { const n = Number(x); if (x !== null && x !== undefined && x !== "" && Number.isFinite(n)) return n; } return null; };
export const kultApi = {
  /** The KP leaderboard (public). Same call as kult-games-v3 src/api/leaderboardApi.ts. */
  leaderboard: async (page = 1, limit = 20, period = "all_time") => {
    const d = await kult(`/leaderboard/global${q({ page, page_size: limit, limit, period })}`, { auth: false });
    const raw = d?.data ?? d ?? {}, entries = Array.isArray(raw.entries) ? raw.entries : [];
    const total = pickNum(raw.totalCount, raw.total, raw.count) ?? entries.length, size = pickNum(raw.pageSize, raw.page_size, raw.limit) ?? limit;
    return {
      entries: entries.map((e, i) => ({
        rank: pickNum(e.rank) ?? (page - 1) * size + i + 1,
        wallet: e.walletAddress ?? e.wallet_address ?? e.player ?? "",
        name: e.username ?? e.name ?? null,
        kultPoints: pickNum(e.kultPoints, e.kult_points, e.score) ?? 0,
        level: pickNum(e.level)
      })),
      total, page: pickNum(raw.page) ?? page, totalPages: pickNum(raw.totalPages) ?? Math.max(1, Math.ceil(total / size))
    };
  },
  /** The legacy game catalog (public): GET /games/all, as kult-games-v3 src/api/gamesApi.ts reads it. */
  /** The legacy game list (public). It has no play links: those come from game(). */
  games: async () => {
    const d = await kult("/games/all", { auth: false });
    const list = Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.games) ? d.data.games : Array.isArray(d) ? d : [];
    return list.map(gameFromApi);
  },
  /**
   * One legacy game with its build: url is the game's play page (or Unity
   * build folder), or the file to download. The old browser's play page reads
   * it from here too (kult-games-v3 gamesApi.getById, GET /games/:id).
   */
  game: async (id) => {
    const d = await kult(`/games/${enc(id)}`, { auth: false });
    const raw = d?.data?.game ?? d?.data ?? d?.game ?? d;
    return raw && typeof raw === "object" ? gameFromApi(raw) : null;
  },
  profile: async () => {
    const d = await kult("/player/profile");
    const raw = d?.data ?? d, p = raw?.profile ?? raw ?? {};
    return {
      username: p.username ?? p.name ?? "", walletAddress: p.walletAddress ?? p.wallet_address ?? session.kult?.walletAddress,
      kultPoints: Number(p.kultPoints ?? p.kult_points ?? 0), level: Number(p.level ?? 1), rank: p.kultPointsRank ?? p.rank ?? null,
      totalGamesPlayed: Number(p.totalGamesPlayed ?? p.total_games_played ?? 0), completedQuests: Number(p.completedQuests ?? p.completed_quests ?? 0)
    };
  }
};

// ------------------------------------------------------------------ Kult Create
// The games players' studios made, and a player's activity on one: the same
// calls Creator Studio's own player makes (creator-studio-frontend-tg
// src/lib/api/social.ts and leaderboards.ts), relayed by Kult Create.
// A random id per browser goes along as x-device-id for its anti-fraud.
function deviceId() {
  try {
    let id = localStorage.getItem("kw.device");
    if (!id) { id = `kw-${crypto.randomUUID()}`; localStorage.setItem("kw.device", id); }
    return id;
  } catch { return undefined; }
}
const createCall = async (path, body) => {
  const c = await config(), id = deviceId();
  return call(c.createApi, path, body === undefined ? {} : { method: "POST", body, headers: id ? { "x-device-id": id } : {} });
};
export const createApi = {
  games: async (limit = 30) => (await createCall(`/games/public${q({ limit })}`))?.games ?? [],
  /** The sandboxed runner for a studio game: it runs the game with the score bridge. */
  runUrl: async (id) => `${(await config()).kultCreateUrl}/play/${enc(id)}/game.html`,
  /** Kult Create's own play page for a game, for opening in a new tab. */
  playPage: async (id) => `${(await config()).kultCreateUrl}/play?gameId=${enc(id)}`,
  view: (id, userId) => createCall(`/games/${enc(id)}/view`, userId ? { userId } : {}),
  /** After 30 s of play: KP for the player, creator score for the studio. */
  qualifyPlay: (id, body) => createCall(`/games/${enc(id)}/play`, body),
  score: (id, body) => createCall(`/games/${enc(id)}/score`, body),
  leaderboard: async (id, limit = 10) => (await createCall(`/games/${enc(id)}/leaderboard${q({ limit })}`))?.entries ?? []
};

// ------------------------------------------------------------------ legacy games
// The session-start call each legacy game's backend records on-chain when a
// signed-in player starts it, as the old Kult browser made it.
// Zero Dash has none: its backend accepts the Kult token the game is given.
const LEGACY_SESSION = {
  highwayhustle: (w) => ["/api/legacy/highwayhustle/player/login", { walletAddress: w.toLowerCase() }, {}],
  zerogpool: (w) => ["/api/legacy/zerogpool/auth/login", { walletAddress: w }, {}]
};
export const legacyApi = {
  sessionStart: async (gameId, wallet) => {
    const make = LEGACY_SESSION[gameId];
    if (!make || !wallet || demo) return;
    const [path, body, headers] = make(wallet);
    try { await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }); }
    catch (e) { console.warn(`[kult-world] ${gameId} session start failed`, e.message); }
  }
};

// ------------------------------------------------------------------ A2A marketplace
// Same endpoints as kult-games-v3 src/api/a2aMarketplaceApi.ts.
export const a2aApi = {
  listJobs: (scope = "open") => arena(`/v1/marketplace/jobs${q({ scope })}`),
  job: (id) => arena(`/v1/marketplace/jobs/${enc(id)}`),
  parse: (prompt) => arena("/v1/marketplace/jobs/parse", { method: "POST", body: { prompt } }),
  draft: (body) => arena("/v1/marketplace/jobs/draft", { method: "POST", body }),
  confirm: (id) => arena(`/v1/marketplace/jobs/${enc(id)}/confirm`, { method: "POST", body: {} }),
  negotiations: async (jobId) => (await arena(`/v1/marketplace/negotiations${q({ jobId })}`))?.negotiations ?? [],
  openNegotiation: (jobId, providerAgentId) => arena("/v1/marketplace/negotiations", { method: "POST", body: { jobId, providerAgentId } }),
  offer: (id, body) => arena(`/v1/marketplace/negotiations/${enc(id)}/offers`, { method: "POST", body }),
  providerRespond: (id, policy) => arena(`/v1/marketplace/negotiations/${enc(id)}/respond`, { method: "POST", body: policy }),
  signAgreement: (id) => arena(`/v1/marketplace/negotiations/${enc(id)}/agreement`, { method: "POST", body: {} }),
  fundingRequest: (jobId) => arena(`/v1/marketplace/jobs/${enc(jobId)}/funding-request`),
  fund: (jobId, auth) => arena(`/v1/marketplace/jobs/${enc(jobId)}/fund`, { method: "POST", body: auth }),
  matching: (agentId) => arena(`/v1/marketplace/discovery/agents/${enc(agentId)}/matching-jobs`),
  autoBid: (agentId) => arena(`/v1/marketplace/agents/${enc(agentId)}/auto-bid`),
  setAutoBid: (agentId, body) => arena(`/v1/marketplace/agents/${enc(agentId)}/auto-bid`, { method: "PUT", body }),
  identity: async (agentId) => { try { const d = await arena(`/v1/marketplace/agents/${enc(agentId)}/identity`); return d?.identity ?? (typeof d?.status === "string" ? d : null); } catch { return null; } },
  registerIdentity: (agentId) => arena(`/v1/marketplace/agents/${enc(agentId)}/register-identity`, { method: "POST", body: {} }),
  reputation: (erc8004Id) => arena(`/v1/a2a/reputation/agents/${enc(erc8004Id)}`)
};

// ------------------------------------------------------------------ Deal Room
// The first Verified Arena (Negotiation): a2a-marketplace-service
// src/routes/deal-room.routes.ts. Matches run on the server; the page polls.
export const dealRoomApi = {
  arena: () => arena(`${DR}/arena`, { auth: false }),
  profile: (agentId) => arena(`${DR}/agents/${enc(agentId)}/profile`),
  start: async (agentId, kind) => (await arena(`${DR}/matches`, { method: "POST", body: { agentId, kind } }))?.match,
  match: (id) => arena(`${DR}/matches/${enc(id)}`, { auth: false }),
  audit: (id) => arena(`${DR}/matches/${enc(id)}/audit`, { auth: false }),
  buy: (pairId, serviceId) => arena(`${DR}/purchases`, { method: "POST", body: { pairId, serviceId } }),
  retest: async (pairId) => (await arena(`${DR}/pairs/${enc(pairId)}/retest`, { method: "POST", body: {} }))?.match,
  abandon: (pairId) => arena(`${DR}/pairs/${enc(pairId)}/abandon`, { method: "POST", body: {} }),
  discover: async (minNegotiation, minReliability) => (await arena(`${DR}/discover${q({ minNegotiation, minReliability })}`, { auth: false }))?.agents ?? [],
  hire: async (providerAgentId, assetKey) => (await arena(`${DR}/hires`, { method: "POST", body: { providerAgentId, assetKey } }))?.hire,
  hireStatus: async (id) => (await arena(`${DR}/hires/${enc(id)}`))?.hire,
  wallet: () => arena(`${DR}/wallet`)
};

// ------------------------------------------------------------------ Kult OKX gateway
// A player's business linked to the OKX.AI agent they own, sold to OKX users
// per call (A2MCP: x402, USDT on X Layer). Paths are the gateway's own.
const OKX = "/v1/marketplace/okx";
export const okxApi = {
  me: () => arena(`${OKX}/me`),
  challenge: (body) => arena(`${OKX}/challenge`, { method: "POST", body }),
  link: (body) => arena(`${OKX}/providers`, { method: "POST", body }),
  update: (id, body) => arena(`${OKX}/providers/${enc(id)}`, { method: "PATCH", body }),
  providers: (business) => arena(`${OKX}/providers${q({ business })}`, { auth: false }),
  provider: (id) => arena(`${OKX}/providers/${enc(id)}`, { auth: false }),
  jobs: (id) => arena(`${OKX}/providers/${enc(id)}/jobs`),
  fixtures: async (providerId) => (await arena(`${OKX}/fixtures${q({ provider: providerId })}`, { auth: false }))?.fixtures ?? [],
  job: async (id) => (await arena(`${OKX}/jobs/${enc(id)}`, { auth: false }))?.job,
  /**
   * One raw call to a provider's A2MCP endpoint, exactly as an OKX user's
   * agent makes it: without payment it answers 402 with the x402 challenge;
   * with PAYMENT-SIGNATURE it runs the job. Returns status, headers and body.
   */
  call: async (providerId, service, input, paymentHeader) => {
    const c = await config();
    if (demo) return demo.a2mcp(providerId, service, input, paymentHeader);
    const res = await fetch(`${c.arenaApi}${OKX}/p/${enc(providerId)}/${enc(service)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Kult-World": "1", ...(paymentHeader ? { "PAYMENT-SIGNATURE": paymentHeader } : {}) },
      body: JSON.stringify(input)
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { error: text.slice(0, 200) }; }
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
  }
};

export const usdc = (baseUnits) => {
  if (baseUnits === null || baseUnits === undefined || baseUnits === "") return "—";
  const u = BigInt(baseUnits), whole = u / 1_000_000n, frac = (u % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
};
export const toBaseUnits = (display) => {
  const [w, f = ""] = String(display).trim().split(".");
  if (!/^\d+$/.test(w || "0") || !/^\d*$/.test(f)) throw new Error("Enter an amount like 5 or 2.50");
  return (BigInt(w || "0") * 1_000_000n + BigInt((f + "000000").slice(0, 6))).toString();
};
