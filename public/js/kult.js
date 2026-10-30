// The live KULT backends behind Kult World: sign-in and every API call.
//
//   Privy (the shared KULT app)  → who the player is, and their wallets
//   AI Arena gateway (/api/arena) → agents, battles, matchmaking, wallets,
//                                   the A2A marketplace (same calls as the
//                                   Kult browser, kult-games-v3 src/api/)
//   Kult backend (/api/kult)      → player profile and KP, via SIWE
//
// Sign-in follows the Kult browser's AuthContext: Privy login, then the
// Privy access token is exchanged for an AI Arena token (POST /v1/auth/privy),
// then the player signs a SIWE message for the Kult backend. The Kult login is
// optional: when it fails, KP is shown as unavailable, never invented.

const KEYS = { arena: "kw.arena.session.v1", kult: "kw.kult.session.v1" };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const write = (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch { /* private mode */ } };

// Demo mode (DEMO_MODE=1 on the server, or ?demo in the address) answers
// every backend call in the browser with the same shapes the real backends
// return (js/demo/), and swaps Privy for a look-alike sign-in. Nothing else
// in Kult World knows the difference.
let CFG = null, cfgLoading = null;
export function config() {
  cfgLoading ||= (async () => {
    const c = await fetch("config.json", { cache: "no-store" }).then((r) => r.json());
    if (new URLSearchParams(location.search).has("demo")) c.demo = true;
    if (c.demo) await (await import("./demo/mock-api.js")).install(c);
    CFG = c;
    return c;
  })();
  return cfgLoading;
}
export const isDemo = () => Boolean(CFG?.demo);

// ------------------------------------------------------------------ Privy
let privy = null, privyLoading = null;
export function privyClient() {
  privyLoading ||= (async () => {
    const c = await config();
    if (c.demo) return (privy = await (await import("./demo/mock-privy.js")).init());
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

async function call(base, path, { method = "GET", body, headers = {}, token } = {}) {
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

/** The Kult backend's SIWE login (kult-games-v3 src/lib/siwe.ts). */
async function kultLogin(address) {
  const c = await config(), p = await privyClient();
  const nonceRes = await call(c.kultApi, `/player/nonce?walletAddress=${encodeURIComponent(address)}`);
  const nonce = (nonceRes?.data ?? nonceRes)?.nonce;
  if (!nonce) throw new Error("No sign-in nonce from the Kult backend");
  const message = [
    `${location.host} wants you to sign in with your Ethereum account:`, address, "",
    "Sign in to Kult Games, your on-chain gaming identity.", "",
    `URI: ${location.origin}`, "Version: 1", "Chain ID: 16661", `Nonce: ${nonce}`, `Issued At: ${new Date().toISOString()}`
  ].join("\n");
  const signature = await p.signMessage(address, message);
  const res = await call(c.kultApi, "/player/login", { method: "POST", body: { walletAddress: address, message, signature } });
  const token = (res?.data ?? res)?.token || res?.token;
  if (!token) throw new Error("The Kult backend returned no session");
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
  if (!session.kult?.token) throw new ApiError("Not signed in to the Kult backend", 401);
  const c = await config();
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
  leaderboard: async (limit = 20) => (await arena(`/v1/leaderboards/global${q({ limit, period: "all_time" })}`))?.entries ?? [],
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

// ------------------------------------------------------------------ Kult backend
export const kultApi = {
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
  fixtures: async () => (await arena(`${OKX}/fixtures`, { auth: false }))?.fixtures ?? [],
  job: async (id) => (await arena(`${OKX}/jobs/${enc(id)}`, { auth: false }))?.job,
  /**
   * One raw call to a provider's A2MCP endpoint, exactly as an OKX user's
   * agent makes it: without payment it answers 402 with the x402 challenge;
   * with PAYMENT-SIGNATURE it runs the job. Returns status, headers and body.
   */
  call: async (providerId, service, input, paymentHeader) => {
    const c = await config();
    const res = await fetch(`${c.arenaApi}${OKX}/p/${enc(providerId)}/${enc(service)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(paymentHeader ? { "PAYMENT-SIGNATURE": paymentHeader } : {}) },
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
