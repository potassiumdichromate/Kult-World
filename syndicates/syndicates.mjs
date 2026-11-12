// Kult Syndicates inside Kult World: the World side of the Syndicates
// adapter contract (Kult-Syndicate DEPLOY.md and integration/world-adapter.cjs,
// vendored here unchanged as world-adapter.cjs).
//
//   /world/syndicates/*         the Switchyard, served from this origin (it
//                               only allows same-origin embedding), proxied
//                               to SYNDICATES_URL with its path kept
//   POST /api/syndicates/launch an owner's verified AI Arena Agent → a signed,
//                               single-use 90 s launch ticket in the link
//   POST /api/syndicates/receipt the Switchyard's receipt worker delivers
//                               signed receipts here; verified, stored per
//                               Agent, acknowledged with { ok, receiptId }
//   GET  /api/syndicates/record the signed-in owner's Agent's receipts
//
// Ownership is checked with AI Arena: the player's own token must list the
// Agent in GET /v1/agents/mine. Receipts never change XP, ELO or balances.
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const adapter = createRequire(import.meta.url)("./world-adapter.cjs");
const HOP = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "proxy-authenticate", "proxy-authorization", "te", "trailer", "host", "content-length", "accept-encoding"]);
// Hop-by-hop headers, plus the Syndicates host's own edge headers (its
// Cloudflare and Render ones), which don't belong on Kult World's responses.
const BACK_SKIP = new Set(["connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length", "set-cookie",
  "server", "date", "alt-svc", "cf-ray", "cf-cache-status", "nel", "report-to", "rndr-id", "x-render-origin-server", "x-render-routing"]);
const MAX_BODY = 64 * 1024;

export function createSyndicates({ arenaApi, env = process.env, root }) {
  const trim = (u) => String(u || "").replace(/\/+$/, "");
  const upstream = trim(env.SYNDICATES_URL);
  const launchSecret = env.SYNDICATES_LAUNCH_SECRET || "";
  const callbackSecret = env.SYNDICATES_CALLBACK_SECRET || "";
  const publicKey = env.SYNDICATES_PUBLIC_KEY || "";
  const storeFile = env.SYNDICATES_STORE || join(root, "data", "syndicates-receipts.json");
  const enabled = Boolean(upstream);

  // ---------------------------------------------------------------- store
  // One JSON file: { agents: { <agentId>: { syndicatesReceipts: { <id>: receipt } } } }.
  // Keep it on a persistent disk in production (render.yaml).
  let store = null;
  const load = () => {
    if (store) return store;
    try { store = JSON.parse(readFileSync(storeFile, "utf8")); } catch { store = { agents: {} }; }
    store.agents ||= {};
    return store;
  };
  const save = () => {
    mkdirSync(dirname(storeFile), { recursive: true });
    const tmp = `${storeFile}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, storeFile);
  };

  // ---------------------------------------------------------------- helpers
  const json = (res, status, body, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }); res.end(JSON.stringify(body)); };
  async function readJson(req) {
    const chunks = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > MAX_BODY) throw Object.assign(new Error("Request too large"), { status: 413 }); chunks.push(c); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
  }
  // The AI Arena user behind a token the gateway has just accepted.
  const tokenUser = (token) => {
    try { const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); return String(p.userId ?? p.sub ?? ""); } catch { return ""; }
  };
  // The player's own Agent, checked with AI Arena using their token.
  async function ownedAgent(req, agentId) {
    const auth = String(req.headers.authorization || "");
    if (!auth.startsWith("Bearer ") || !agentId) throw Object.assign(new Error("Sign in to Kult World first"), { status: 401 });
    const token = auth.slice(7);
    let r;
    try { r = await fetch(`${arenaApi}/v1/agents/mine?page=1&pageSize=50`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }); }
    catch { throw Object.assign(new Error("AI Arena is unreachable right now"), { status: 502 }); }
    if (r.status === 401) throw Object.assign(new Error("Your session expired. Sign in again."), { status: 401 });
    if (!r.ok) throw Object.assign(new Error(`AI Arena answered ${r.status}`), { status: 502 });
    const agents = (await r.json().catch(() => ({})))?.agents ?? [];
    const agent = agents.find((a) => String(a.id) === String(agentId));
    if (!agent) throw Object.assign(new Error("That Agent isn't yours"), { status: 403 });
    const user = tokenUser(token) || String(agent.userId ?? agent.ownerId ?? "");
    if (!user) throw Object.assign(new Error("Couldn't read your AI Arena identity"), { status: 401 });
    return { ownerId: `arena:${user}`, agent };
  }
  // Syndicates accepts 2–32 letters, numbers, spaces and ._- as a name.
  const syndicateName = (name) => {
    const n = String(name || "").replace(/[^A-Za-z0-9 _.-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 32).trim();
    return n.length >= 2 ? n : "KULT Agent";
  };
  const originOf = (req) => env.KULT_WORLD_ORIGIN ? trim(env.KULT_WORLD_ORIGIN) : `${String(req.headers["x-forwarded-proto"] || "http").split(",")[0]}://${req.headers.host}`;

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
      return json(res, 502, { error: "Kult Syndicates is unreachable right now. Try again in a minute." });
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
  async function readRaw(req) {
    const chunks = []; let n = 0;
    for await (const c of req) { n += c.length; if (n > MAX_BODY) throw Object.assign(new Error("Request too large"), { status: 413 }); chunks.push(c); }
    return Buffer.concat(chunks);
  }

  // ---------------------------------------------------------------- routes
  async function handle(req, res, url) {
    const p = url.pathname;
    if (p === "/world/syndicates" || p.startsWith("/world/syndicates/")) {
      if (!enabled) return json(res, 503, { error: "Kult Syndicates isn't connected on this server (SYNDICATES_URL)." }), true;
      if (p === "/world/syndicates") { res.writeHead(308, { Location: `/world/syndicates/${url.search}` }); res.end(); return true; }
      await proxy(req, res, p + url.search);
      return true;
    }
    if (!p.startsWith("/api/syndicates/")) return false;
    try {
      if (p === "/api/syndicates/launch" && req.method === "POST") {
        if (!enabled || launchSecret.length < 32) throw Object.assign(new Error("Kult Syndicates isn't connected on this server."), { status: 503 });
        const { agentId } = await readJson(req);
        const { ownerId, agent } = await ownedAgent(req, String(agentId || ""));
        const out = adapter.issueLaunch({ ownerId, agent: { id: String(agent.id), name: syndicateName(agent.name) }, secret: launchSecret, baseUrl: `${originOf(req)}/world/syndicates/?embed=1`, identityMode: "kult-gateway" });
        return json(res, 200, out), true;
      }
      if (p === "/api/syndicates/receipt" && req.method === "POST") {
        const body = await readJson(req);
        let receipt;
        try { receipt = adapter.verifyDelivery(body, req.headers, { secret: callbackSecret, publicKey }); }
        catch (e) { return json(res, 400, { ok: false, error: e.message }), true; }
        const s = load();
        const owner = { agent: (s.agents[receipt.agentId] ||= { id: receipt.agentId, syndicatesReceipts: {} }) };
        owner.agent.id = receipt.agentId;
        let result;
        try { result = adapter.ingestIntoOwner(owner, receipt); }
        catch (e) { return json(res, 409, { ok: false, error: e.message }), true; }
        if (!result.duplicate) {
          // Keep the newest 200 per Agent.
          const all = Object.values(owner.agent.syndicatesReceipts).sort((a, b) => b.createdAt - a.createdAt);
          for (const r of all.slice(200)) delete owner.agent.syndicatesReceipts[r.id];
          save();
        }
        return json(res, 200, { ok: true, receiptId: receipt.id, duplicate: result.duplicate }), true;
      }
      if (p === "/api/syndicates/record" && req.method === "GET") {
        const agentId = url.searchParams.get("agentId") || "";
        await ownedAgent(req, agentId);
        const a = load().agents[agentId];
        return json(res, 200, { receipts: a ? adapter.passportSummary(a) : [] }), true;
      }
      return json(res, 404, { error: "Not found" }), true;
    } catch (e) {
      return json(res, e.status || 500, { error: e.status ? e.message : "Kult Syndicates request failed" }), true;
    }
  }

  return { enabled, handle, publicKeyId: publicKey ? createHash("sha256").update(Buffer.from(publicKey, "base64url")).digest("hex").slice(0, 16) : null };
}
