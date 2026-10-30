// Runs the whole Kult World showcase on this machine:
//
//   Kult World    http://localhost:5173/?demo   (this repo, demo mode)
//   Kult Create   http://localhost:4300/office/  (../kult-create)
//   Kult Sports   http://localhost:4400/         (../kult-sports, the Pixel Agency)
//
// Walking into the Gaming Studio or the Sports Agency opens the local Kult
// Create and Kult Sports apps in their demo mode (BIZ_DEMO=local), so they
// show their working copies, not the copies bundled in public/biz/.
// An app already listening on its port is reused. Ctrl+C stops the rest.
//
//   npm run local

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CREATE = "http://localhost:4300", SPORTS = "http://localhost:4400", WORLD = "http://localhost:5173";

const APPS = [
  { name: "kult-create", dir: join(ROOT, "..", "kult-create"), args: ["src/server.js"], port: 4300,
    env: { PORT: "4300", PUBLIC_URL: CREATE, ALLOWED_ORIGINS: "*" } },
  { name: "kult-sports", dir: join(ROOT, "..", "kult-sports"), args: ["server.mjs"], port: 4400,
    env: { PORT: "4400" } },
  { name: "kult-world", dir: ROOT, args: ["server.mjs"], port: 5173,
    env: { PORT: "5173", DEMO_MODE: "1", BIZ_DEMO: "local", KULT_CREATE_URL: CREATE, KULT_SPORTS_URL: SPORTS } }
];
const COLORS = { "kult-create": 35, "kult-sports": 32, "kult-world": 36 };

const listening = (port) => new Promise((resolve) => {
  const s = net.connect(port, "127.0.0.1");
  s.once("connect", () => { s.destroy(); resolve(true); });
  s.once("error", () => resolve(false));
});

const children = [];
for (const app of APPS) {
  const tag = `\x1b[${COLORS[app.name]}m[${app.name}]\x1b[0m`;
  if (!existsSync(app.dir)) { console.error(`${tag} missing folder ${app.dir}`); process.exitCode = 1; continue; }
  if (await listening(app.port)) {
    console.log(`${tag} already running on :${app.port}, reusing it`);
    if (app.name === "kult-world") console.log(`${tag} make sure it runs with DEMO_MODE=1 BIZ_DEMO=local, or stop it and run this again`);
    continue;
  }
  const child = spawn(process.execPath, app.args, { cwd: app.dir, env: { ...process.env, ...app.env }, stdio: ["ignore", "pipe", "pipe"] });
  const pipe = (stream, out) => stream.on("data", (d) => { for (const line of String(d).split(/\r?\n/)) if (line) out.write(`${tag} ${line}\n`); });
  pipe(child.stdout, process.stdout); pipe(child.stderr, process.stderr);
  child.on("exit", (code) => console.log(`${tag} exited (${code})`));
  children.push(child);
}

const stop = () => { for (const c of children) c.kill(); process.exit(); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);

setTimeout(() => console.log(`
  Kult World   ${WORLD}/?demo
  Kult Create  ${CREATE}/office/?demo=1
  Kult Sports  ${SPORTS}/?demo=1
`), 1500);
