// Meshy pipeline for Kult World art (docs/MODELS.md): a concept image, then
// image-to-3D, the same settings as the city's buildings.
//
//   node scripts/meshy.mjs concepts <jobs.json>        start a concept per job
//   node scripts/meshy.mjs models <jobs.json>          image-to-3D from each job's chosen concept
//   node scripts/meshy.mjs status <jobs.json>          poll and download what finished
//
// jobs.json: { "dir": "art-src/meshy/syndicates", "jobs": [{ "name", "prompt",
// "variants"?: n, "concepts"?: [taskIds], "pick"?: taskId, "model"?: taskId }] }.
// The script writes task ids back into the file, so it can be re-run safely.
// Needs MESHY_API_KEY. Costs credits: nano-banana-pro concept 9, Meshy 7.1 with
// a 4K Meshy 7 texture 30 (https://docs.meshy.ai/en/api/pricing).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.meshy.ai/openapi/v1";
const KEY = process.env.MESHY_API_KEY;
if (!KEY) { console.error("Set MESHY_API_KEY"); process.exit(1); }
const [cmd, file] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(file, "utf8"));
const save = () => writeFileSync(file, JSON.stringify(spec, null, 2));
mkdirSync(spec.dir, { recursive: true });

async function api(method, path, body) {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
}
async function download(url, to) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  writeFileSync(to, Buffer.from(await r.arrayBuffer()));
}

if (cmd === "concepts") {
  for (const j of spec.jobs) {
    j.concepts ||= [];
    while (j.concepts.length < (j.variants || 1)) {
      const { result } = await api("POST", "/text-to-image", { ai_model: "nano-banana-pro", prompt: j.prompt, aspect_ratio: "1:1" });
      j.concepts.push(result); save();
      console.log(`${j.name}: concept ${result}`);
    }
  }
} else if (cmd === "models") {
  for (const j of spec.jobs) {
    if (j.model || !j.pick) continue;
    const { result } = await api("POST", "/image-to-3d", {
      input_task_id: j.pick, ai_model: "meshy-7.1", should_texture: true, texture_model: "meshy-7",
      texture_resolution: "4k", enable_pbr: true, should_remesh: false, target_formats: ["glb"]
    });
    j.model = result; save();
    console.log(`${j.name}: model ${result}`);
  }
} else if (cmd === "status") {
  for (const j of spec.jobs) {
    for (const [i, id] of (j.concepts || []).entries()) {
      const to = join(spec.dir, `${j.name}-concept${(j.concepts.length > 1) ? `-${i + 1}` : ""}.png`);
      if (existsSync(to)) continue;
      const t = await api("GET", `/text-to-image/${id}`);
      if (t.status === "SUCCEEDED") { await download(t.image_urls[0], to); console.log(`${j.name}: saved ${to}`); }
      else console.log(`${j.name}: concept ${t.status} ${t.progress ?? ""}% ${t.task_error?.message ?? ""}`);
    }
    if (j.model) {
      const to = join(spec.dir, `${j.name}.glb`);
      if (existsSync(to)) continue;
      const t = await api("GET", `/image-to-3d/${j.model}`);
      if (t.status === "SUCCEEDED") { await download(t.model_urls.glb, to); console.log(`${j.name}: saved ${to} (${t.consumed_credits} credits)`); }
      else console.log(`${j.name}: model ${t.status} ${t.progress ?? ""}% ${t.task_error?.message ?? ""}`);
    }
  }
} else {
  console.error("Usage: node scripts/meshy.mjs concepts|models|status <jobs.json>");
  process.exit(1);
}
