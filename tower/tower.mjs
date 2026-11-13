// KULT Agent Tower inside Kult World (Kult-Tower, INTEGRATION.md):
//
//   /world/tower/*           the tower, served from this origin (it only
//                            allows same-origin embedding), proxied to
//                            TOWER_URL with its path kept
//   POST /api/tower/launch   an owner's verified AI Arena Agent → a signed,
//                            single-use 90 s launch ticket in the link; the
//                            Agent directs its own tower (owner "agent:<id>")
//   GET  /api/tower/record   that Agent's shift receipts, read from the tower
//                            with the result secret and verified one by one
//
// Ownership is checked with AI Arena: the player's own token must list the
// Agent in GET /v1/agents/mine. Shift receipts never change XP, ELO or balances.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-authenticate", "proxy-authorization", "te", "trailer", "host", "content-length", "accept-encoding"]);
const BACK_SKIP = new Set(["connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length", "set-cookie",
  "server", "date", "alt-svc", "cf-ray", "cf-cache-status", "nel", "report-to", "rndr-id", "x-render-origin-server", "x-render-routing"]);
const MAX_BODY = 64 * 1024;
const RECEIPT_VERSIONS = new Set(["tower-1.4"]);

export function createTower({ arenaApi, env = process.env }) {
  const trim = (u) => String(u || "").replace(/\/+$/, "");
  const upstream = trim(env.TOWER_URL);
  const launchSecret = env.TOWER_LAUNCH_SECRET || "";
  const resultSecret = env.TOWER_RESULT_SECRET || "";
  const enabled = Boolean(upstream);

  const b64 = (buf) => Buffer.from(buf).toString("base64url");
  const sign = (secret, text) => createHmac("sha256", secret).update(text).digest("base64url");
  const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
  const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
  const fail = (status, message) => Object.assign(new Error(message), { status });
  async function readRaw(req) {
    const chunks = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > MAX_BODY) throw fail(413, "Request too large"); chunks.push(c); }
    return Buffer.concat(chunks);
  }
  async function readJson(req) { try { return JSON.parse((await readRaw(req)).toString("utf8") || "{}"); } catch (e) { throw e.status ? e : fail(400, "Invalid JSON"); } }
  const originOf = (req) => env.KULT_WORLD_ORIGIN ? trim(env.KULT_WORLD_ORIGIN) : `${String(req.headers["x-forwarded-proto"] || "http").split(",")[0]}://${req.headers.host}`;

  // The player's own Agent, checked with AI Arena using their token.
  async function ownedAgent(req, agentId) {
    const auth = String(req.headers.authorization || "");
    if (!auth.startsWith("Bearer ") || !agentId) throw fail(401, "Sign in to Kult World first");
    let r;
    try { r = await fetch(`${arenaApi}/v1/agents/mine?page=1&pageSize=50`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(15_000) }); }
    catch { throw fail(502, "AI Arena is unreachable right now"); }
    if (r.status === 401) throw fail(401, "Your session expired. Sign in again.");
    if (!r.ok) throw fail(502, `AI Arena answered ${r.status}`);
    const agents = (await r.json().catch(() => ({})))?.agents ?? [];
    const agent = agents.find((a) => String(a.id) === String(agentId));
    if (!agent) throw fail(403, "That Agent isn't yours");
    return agent;
  }
  const towerName = (name) => String(name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 40) || "Director";
  const ownerOf = (agentId) => `kult:agent:${agentId}`;

  // A one-time ticket the tower exchanges for its session (server.py verify_launch).
  function issueLaunch(agent, origin) {
    const claims = { aud: "kult-agent-tower", sub: `agent:${agent.id}`, nonce: b64(randomBytes(24)), exp: Math.floor(Date.now() / 1000) + 90, parent_origin: origin, agent: { id: String(agent.id), name: towerName(agent.name) } };
    const payload = b64(JSON.stringify(claims));
    return { launchUrl: `${origin}/world/tower/?embed=1#launch=${payload}.${sign(launchSecret, payload)}`, expiresAt: claims.exp };
  }

  // The Agent's verified shift receipts, newest first.
  async function records(agentId) {
    const owner = ownerOf(agentId), stamp = String(Math.floor(Date.now() / 1000));
    let r;
    try { r = await fetch(`${upstream}/world/tower/api/service/records?owner=${encodeURIComponent(owner)}`, { headers: { "X-Tower-Service": `${stamp}.${sign(resultSecret, `${owner}.${stamp}`)}` }, signal: AbortSignal.timeout(15_000) }); }
    catch { throw fail(502, "The Agent Tower is unreachable right now"); }
    if (!r.ok) throw fail(502, `The Agent Tower answered ${r.status}`);
    const out = [];
    for (const item of (await r.json().catch(() => ({})))?.receipts ?? []) {
      if (typeof item?.payload !== "string" || !same(item.sig, sign(resultSecret, item.payload))) continue; // unsigned or altered: drop it
      let body; try { body = JSON.parse(Buffer.from(item.payload, "base64url").toString("utf8")); } catch { continue; }
      if (body.owner !== owner || !RECEIPT_VERSIONS.has(body.version)) continue;
      out.push({ id: body.id, version: body.version, shift: body.shift, delivered: body.delivered, missed: body.missed, creditsDelta: body.creditsDelta, reputationDelta: body.reputationDelta,
        credits: body.credits, reputation: body.reputation, rank: body.rank, completed: body.completed, commendations: body.commendations, goal: body.goal, crew: body.crew, createdAt: body.createdAt });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  }

  // ---------------------------------------------------------------- the mount
  async function proxy(req, res, path) {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k)) headers[k] = v;
    const fwd = req.headers["x-forwarded-for"];
    headers["x-forwarded-for"] = fwd ? `${fwd}, ${req.socket.remoteAddress}` : req.socket.remoteAddress;
    headers["x-forwarded-proto"] ||= "https";
    let up;
    try {
      const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readRaw(req);
      up = await fetch(`${upstream}${path}`, { method: req.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      if (e.status) return json(res, e.status, { error: e.message });
      return json(res, 502, { error: "The Agent Tower is unreachable right now. Try again in a minute." });
    }
    const out = {};
    up.headers.forEach((v, k) => { if (!BACK_SKIP.has(k)) out[k] = v; });
    const cookies = up.headers.getSetCookie?.() ?? [];
    if (cookies.length) out["set-cookie"] = cookies;
    const data = Buffer.from(await up.arrayBuffer());
    out["content-length"] = String(data.length);
    res.writeHead(up.status, out);
    res.end(data);
  }

  // ---------------------------------------------------------------- routes
  async function handle(req, res, url) {
    const p = url.pathname;
    if (p === "/world/tower" || p.startsWith("/world/tower/")) {
      if (!enabled) return json(res, 503, { error: "The Agent Tower isn't connected on this server (TOWER_URL)." }), true;
      // The service endpoint is for this server only.
      if (p.startsWith("/world/tower/api/service/")) return json(res, 404, { error: "Not found" }), true;
      await proxy(req, res, p + url.search);
      return true;
    }
    if (!p.startsWith("/api/tower/")) return false;
    try {
      if (p === "/api/tower/launch" && req.method === "POST") {
        if (!enabled || launchSecret.length < 32) throw fail(503, "The Agent Tower isn't connected on this server.");
        const { agentId } = await readJson(req);
        const agent = await ownedAgent(req, String(agentId || ""));
        return json(res, 200, issueLaunch(agent, originOf(req))), true;
      }
      if (p === "/api/tower/record" && req.method === "GET") {
        if (!enabled || resultSecret.length < 32) throw fail(503, "The Agent Tower isn't connected on this server.");
        const agentId = url.searchParams.get("agentId") || "";
        await ownedAgent(req, agentId);
        return json(res, 200, { receipts: await records(agentId) }), true;
      }
      return json(res, 404, { error: "Not found" }), true;
    } catch (e) {
      return json(res, e.status || 500, { error: e.status ? e.message : "Agent Tower request failed" }), true;
    }
  }

  return { enabled, handle };
}
