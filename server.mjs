// Kult World static server (no dependencies). Serves public/.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "public");
const PORT = Number(process.env.PORT || 4500);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"ok":true,"service":"kult-world"}'); }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT + sep)) { res.writeHead(403); return res.end("Forbidden"); }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    res.end(await readFile(file));
  } catch {
    if (!extname(rel)) { res.writeHead(200, { "Content-Type": TYPES[".html"], "Cache-Control": "no-cache" }); return res.end(await readFile(join(ROOT, "index.html"))); }
    res.writeHead(404); res.end("Not found");
  }
}).listen(PORT, () => console.log(`[kult-world] http://localhost:${PORT}`));
