// Copies the offline demos of the two Kult World businesses into
// public/biz/, so Kult World can open them in demo mode without their own
// services running:
//
//   ../kult-create  public/office/  → public/biz/create/   (?demo=1: a scripted production)
//   ../kult-sports  public/         → public/biz/sports/   (?demo=1: an in-memory agency)
//
// Only committed files are copied (git HEAD), never work in progress, and
// built bundles (privy/, minds/) are skipped: the demos don't use them.
// Run again after either business changes:  node scripts/sync-business-demos.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SOURCES = [
  { id: "create", repo: join(ROOT, "..", "kult-create"), path: "public/office", skip: ["privy/"] },
  { id: "sports", repo: join(ROOT, "..", "kult-sports"), path: "public", skip: ["privy/", "minds/"] }
];

const git = (repo, args, opts = {}) => execFileSync("git", ["-C", repo, ...args], { maxBuffer: 64 * 1024 * 1024, ...opts });
const manifest = {};

for (const src of SOURCES) {
  const dest = join(ROOT, "public", "biz", src.id);
  rmSync(dest, { recursive: true, force: true });
  const files = git(src.repo, ["ls-tree", "-r", "--name-only", "HEAD", `${src.path}/`], { encoding: "utf8" }).split("\n").filter(Boolean);
  let copied = 0;
  for (const file of files) {
    const rel = file.slice(src.path.length + 1);
    if (src.skip.some((s) => rel.startsWith(s))) continue;
    const out = join(dest, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, git(src.repo, ["show", `HEAD:${file}`]));
    copied++;
  }
  manifest[src.id] = { repo: git(src.repo, ["remote", "get-url", "origin"], { encoding: "utf8" }).trim(), commit: git(src.repo, ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(), files: copied };
  console.log(`[biz] ${src.id}: ${copied} files from ${manifest[src.id].commit}`);
}
writeFileSync(join(ROOT, "public", "biz", "SOURCES.json"), `${JSON.stringify(manifest, null, 2)}\n`);
