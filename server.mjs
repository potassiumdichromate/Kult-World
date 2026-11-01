// Kult World server (no dependencies). Serves public/, the page's settings at
// /config.json, and forwards API calls to KULT's backends from the same
// origin:
//
//   /api/arena/*  → AI Arena gateway (agents, battles, matchmaking, wallets,
//                   the A2A marketplace and the Kult agencies)
//   /api/kult/*   → Kult backend (player profile, KP, SIWE login)
//
// The gateway only accepts browser calls from its own site, so Kult World
// calls it server to server, as Kult Sports does for its Privy exchange.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const PORT = Number(process.env.PORT || 4500);
const trim = (u) => String(u).replace(/\/+$/, "");
const ARENA_API = trim(process.env.AI_ARENA_API_URL || "https://aiarena-gateway.kult.games");
const KULT_API = trim(process.env.KULT_API_URL || "https://api-backend-v2.kult.games/api");
const CONFIG = JSON.stringify({
  privyAppId: process.env.PRIVY_APP_ID || "cmhfx1cl20001l10d4l0w8u4j",
  privyClientId: process.env.PRIVY_CLIENT_ID || undefined,
  arenaApi: "/api/arena",
  kultApi: "/api/kult",
  agencyApi: process.env.AGENCY_API_URL || "/api/arena/v1/marketplace/agencies",
  unityBuildUrl: trim(process.env.UNITY_BUILD_URL || "https://pub-2c48e58780b648b7a2a77316f7b0aa2c.r2.dev/v4/WarzoneV4"),
  kultCreateUrl: trim(process.env.KULT_CREATE_URL || "https://kult-create.onrender.com"),
  kultSportsUrl: trim(process.env.KULT_SPORTS_URL || "https://kult-sports.onrender.com")
});
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".wasm": "application/wasm" };

// Request headers worth forwarding; everything else (cookies, origin, host)
// stays here.
const FORWARD = ["authorization", "content-type", "accept", "idempotency-key", "payment-signature", "x-payment", "x-kult-access-token", "x-payment-tx-hash", "x-payment-agent-id", "x-training-source", "x-kult-world"];
const RETURN = ["content-type", "payment-required", "x-payment-response", "retry-after", "cache-control"];

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function proxy(req, res, upstream, path) {
  const headers = {};
  for (const h of FORWARD) if (req.headers[h]) headers[h] = req.headers[h];
  const fwd = req.headers["x-forwarded-for"];
  headers["x-forwarded-for"] = fwd ? `${fwd}, ${req.socket.remoteAddress}` : req.socket.remoteAddress;
  let up;
  try {
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readBody(req);
    up = await fetch(`${upstream}${path}`, { method: req.method, headers, body, signal: AbortSignal.timeout(120_000) });
  } catch {
    res.writeHead(502, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "That KULT service is unreachable right now. Try again in a minute." }));
  }
  const out = {};
  for (const h of RETURN) { const v = up.headers.get(h); if (v) out[h] = v; }
  res.writeHead(up.status, out);
  res.end(Buffer.from(await up.arrayBuffer()));
}

// The page links its stylesheet and scripts under /v/<build>/, so each deploy
// has new URLs and no cache in front (Cloudflare's browser TTL included) can
// keep an old Kult World; the scripts' relative imports follow the prefix.
// The page itself is never cached. Locally (no commit id) they revalidate
// instead, so edits show on reload without restarting the server.
const BUILD = (process.env.RENDER_GIT_COMMIT || "").slice(0, 12) || Date.now().toString(36);
const IMMUTABLE = Boolean(process.env.RENDER_GIT_COMMIT);
const PAGE = readFileSync(join(ROOT, "index.html"), "utf8")
  .replace(/(<link rel="stylesheet" href="|<script type="module" src=")(?![a-z]+:|\/)([^"]+")/g, `$1v/${BUILD}/$2`);
function sendPage(res) {
  res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-store" });
  res.end(PAGE);
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"ok":true,"service":"kult-world"}'); }
  if (url.pathname === "/config.json") { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" }); return res.end(CONFIG); }
  if (url.pathname.startsWith("/api/arena/")) return proxy(req, res, ARENA_API, url.pathname.slice("/api/arena".length) + url.search);
  if (url.pathname.startsWith("/api/kult/")) return proxy(req, res, KULT_API, url.pathname.slice("/api/kult".length) + url.search);
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  if (rel === "/index.html") return sendPage(res);
  const v = /^\/v\/([^/]+)(\/.*)$/.exec(rel);
  if (v) rel = v[2];
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end("Forbidden"); }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    const cache = IMMUTABLE && v?.[1] === BUILD ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": cache, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    res.end(await readFile(file));
  } catch {
    if (!extname(rel)) return sendPage(res);
    res.writeHead(404); res.end("Not found");
  }
}).listen(PORT, () => console.log(`[kult-world] http://localhost:${PORT}`));
