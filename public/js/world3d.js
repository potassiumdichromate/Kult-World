// Kult World in 3D: an isometric floating city at neon dusk.
// three.js scene with an orthographic isometric camera, warm key light + cool
// rim light, soft shadows, fog and bloom. Layout and pathfinding live in
// layout.js; every model is a swappable slot in models.js.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { MAP, tiles, BUILDINGS, CAMPUS, WALL, MONUMENT, FOUNTAIN, SPAWN, PROPS, DISTRICTS, POND, CENTER, SHAPES, walkable, findPath, randomStreetTile, islandSD } from "./layout.js";
import { T, build, glowTexture, lightPool, loadProvided, loadGLB, providedModel, capsuleAgent, AGENT_PLACEHOLDER_URL, SLOTS, M, sign, instanceProps, swayTime } from "./models.js";
import { buildTerrain, heightAt } from "./terrain.js";
import { FX } from "./fx.js";
import { archetype } from "./data.js";

export { BUILDINGS, MAP, walkable, SPAWN, DISTRICTS, heightAt };
const HALF = (MAP * T) / 2;
export const toWorld = (x, y) => new THREE.Vector3(x * T - HALF, 0, y * T - HALF);
const ISO_AZ = Math.PI / 4;
// Minimap framing in tile space: the island plus the start of the bridges.
const MM = { x0: -6, span: 68 };
// Soft contact shadow under wandering agents (cheaper than a real shadow).
const BLOB = { geo: new THREE.PlaneGeometry(1.6, 1.6), m: null, mat() { return this.m ||= new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#000000", transparent: true, opacity: 0.5, depthWrite: false }); } };
// Repeated props drawn as instanced meshes once their model is provided.
const INSTANCED = { tree: { sway: 0.03, shadow: true }, pine: { sway: 0.022, shadow: true }, blossom: { sway: 0.03, shadow: true }, bush: {}, flowers: {}, bench: {}, lamp: {} };

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.t = 0;
    this.agents = new Map();
    this.anims = [];
    this.hoverId = null;
    this.zoom = 1;
    this.cinematic = true;
    this.az = ISO_AZ; this.azTarget = ISO_AZ;
    this.viewH = 52; this.viewHTarget = 52;
    this.target = toWorld(...CENTER);
    this.tr = (k) => k;
    this.quality = 2;

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;

    const s = this.scene = new THREE.Scene();
    s.background = skyTexture();
    s.fog = new THREE.Fog("#2b1652", 170, 380);
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 800);

    // Lighting: warm sunset key, cool neon rim, violet sky fill.
    s.add(new THREE.HemisphereLight("#a596ff", "#24143c", 1.15));
    const key = this.key = new THREE.DirectionalLight("#ffb184", 2.6);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -64, right: 64, top: 64, bottom: -64, near: 10, far: 280 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
    s.add(key, key.target);
    const rim = new THREE.DirectionalLight("#4fd8ff", 0.9); rim.position.set(80, 45, -70); s.add(rim);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "2" });
    this.labels.domElement.className = "tags-layer";
    document.body.append(this.labels.domElement);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(s, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.buildIsland();
  }

  async init() {
    await loadProvided();
    this.populate();
    const url = providedModel("agent") ? `models/${providedModel("agent")}` : AGENT_PLACEHOLDER_URL;
    loadGLB(url).then((g) => { this.agentGLB = g; for (const a of this.agents.values()) this.dressAgent(a); })
      .catch((e) => console.warn("[world] agent model not loaded, using capsule bots", e?.message || e));
  }
  // Translated labels (districts, door prompts). tr(key) -> string.
  setTranslator(tr) { this.tr = tr; for (const l of this.districtLabels || []) l.el.querySelector("b").textContent = tr(`district.${l.id}`); this.promptKey = null; }

  // ---------------------------------------------------------------- island, sky, water
  buildIsland() {
    const s = this.scene, size = MAP * T;
    const terrain = buildTerrain(s);
    this.anims.push(...terrain.anims);
    this.waterfallTop = terrain.waterfallTop; this.features = terrain.features;
    const o = new THREE.Object3D(), oct = new THREE.OctahedronGeometry(1, 0);
    const hanging = ["#4fd8ff", "#ff4fa3"].map((c) => new THREE.InstancedMesh(oct, M.glow(c, 1.6), 15));
    for (let i = 0; i < 30; i++) {
      const sz = 0.8 + Math.random() * 1.6, p = terrain.undersidePoints(1)[0];
      o.position.set(p.x, p.y - sz * 1.4, p.z); o.rotation.set(0, 0, Math.PI); o.scale.set(sz, sz * 2.2, sz); o.updateMatrix();
      hanging[i % 2].setMatrixAt(i >> 1, o.matrix);
    }
    s.add(...hanging);
    // Floating rocks orbiting the island, each with a crystal on top.
    const rockGeo = jitter(new THREE.IcosahedronGeometry(1, 0), 0.5, true);
    const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: "#3a2a5c", flatShading: true, roughness: 1 }), 12);
    const tips = ["#ff4fa3", "#4fd8ff"].map((c) => new THREE.InstancedMesh(oct, M.glow(c, 2), 6));
    const floaters = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3, R = size * 0.66 + Math.random() * 20; return { x: Math.cos(a) * R, z: Math.sin(a) * R, h: -4 + Math.random() * 14, r: 1.5 + Math.random() * 2.5, ph: Math.random() * 6 }; });
    s.add(rocks, ...tips);
    this.anims.push((t) => {
      floaters.forEach((f, i) => {
        const y = f.h + Math.sin(t * 0.5 + f.ph) * 1.2, ry = t * 0.1 + f.ph;
        o.position.set(f.x, y, f.z); o.rotation.set(0, ry, 0); o.scale.setScalar(f.r); o.updateMatrix(); rocks.setMatrixAt(i, o.matrix);
        o.position.y = y + f.r * 0.8; o.scale.set(f.r * 0.35, f.r * 0.63, f.r * 0.35); o.updateMatrix(); tips[i % 2].setMatrixAt(i >> 1, o.matrix);
      });
      rocks.instanceMatrix.needsUpdate = true; tips[0].instanceMatrix.needsUpdate = tips[1].instanceMatrix.needsUpdate = true;
    });
    // Clouds drifting below: one instanced draw.
    const clouds = new THREE.InstancedMesh(new THREE.PlaneGeometry(100, 56), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.35, depthWrite: false, fog: false }), 16);
    const cloudData = Array.from({ length: 16 }, (_, i) => { clouds.setColorAt(i, new THREE.Color(i % 3 ? "#7a4ab8" : "#c05a9a")); return { x: (Math.random() - 0.5) * 400, y: -44 - Math.random() * 30, z: (Math.random() - 0.5) * 400, v: 2 + Math.random() * 3 }; });
    s.add(clouds);
    this.anims.push((t, dt) => {
      cloudData.forEach((c, i) => { c.x += c.v * dt; if (c.x > 220) c.x = -220; o.position.set(c.x, c.y, c.z); o.rotation.set(-Math.PI / 2, 0, 0); o.scale.setScalar(1); o.updateMatrix(); clouds.setMatrixAt(i, o.matrix); });
      clouds.instanceMatrix.needsUpdate = true;
    });
    farIslands(s, [[-170, -130, 1], [190, -160, 1.3], [-210, 100, 0.9], [140, 210, 0.8], [-40, -250, 1.1], [260, 30, 1]]);
    // Pond: water, lily pads with glowing lotus, ripples.
    const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r * T * 0.95, 48), new THREE.MeshStandardMaterial({ color: "#123d7a", emissive: "#1f7fd6", emissiveIntensity: 0.55, roughness: 0.06, metalness: 0.5 }));
    water.rotation.x = -Math.PI / 2; water.position.copy(toWorld(POND.x, POND.y)).setY(0.15); s.add(water);
    const pc = toWorld(POND.x, POND.y);
    const rimStone = new THREE.Mesh(new THREE.TorusGeometry(POND.r * T * 0.95, 0.32, 8, 64), terrain.materials.curb);
    rimStone.rotation.x = -Math.PI / 2; rimStone.position.copy(pc).setY(0.15); rimStone.scale.z = 0.6; rimStone.receiveShadow = true; s.add(rimStone);
    const pads = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 10, 1, false, 0.4, Math.PI * 1.8), M.leaf("#2f9a6a"), 9);
    const lotus = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22, 0), M.glow("#ff7eb6", 2.4), 5);
    for (let i = 0; i < 9; i++) {
      const a = i * 2.3, rr = 1.5 + (i % 4) * 1.4;
      o.position.set(pc.x + Math.cos(a) * rr, 0.18, pc.z + Math.sin(a) * rr); o.rotation.set(0, a, 0); o.scale.setScalar(1); o.updateMatrix(); pads.setMatrixAt(i, o.matrix);
      if (i % 2 === 0) { o.position.y = 0.4; o.updateMatrix(); lotus.setMatrixAt(i / 2, o.matrix); }
    }
    s.add(pads, lotus);
    const ripples = Array.from({ length: 4 }, (_, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), new THREE.MeshBasicMaterial({ color: "#9fe8ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.userData.ph = i * 0.9; s.add(m); return m; });
    this.anims.push((t) => {
      water.material.emissiveIntensity = 0.5 + Math.sin(t * 1.3) * 0.1;
      ripples.forEach((m) => { const k = ((t + m.userData.ph) % 3.6) / 3.6; if (k < 0.02) { const a = Math.random() * 6.28, rr = Math.random() * POND.r * 1.4; m.position.set(pc.x + Math.cos(a) * rr, 0.17, pc.z + Math.sin(a) * rr); } m.scale.setScalar(1 + k * 6); m.material.opacity = (1 - k) * 0.6; });
    });
    // Grass tufts (instanced).
    const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.4, 3), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), 2600);
    const col = new THREE.Color(); let n = 0;
    for (let i = 0; i < 9000 && n < 2600; i++) {
      const x = 1 + Math.random() * (MAP - 2), y = 1 + Math.random() * (MAP - 2), k = tiles[Math.floor(x)][Math.floor(y)];
      if ((k !== "g" && k !== "c") || islandSD(x, y) < 0.9) continue;
      o.position.copy(toWorld(x, y)).setY(heightAt(x, y) + 0.18); o.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4); o.scale.setScalar(0.7 + Math.random() * 0.7); o.updateMatrix();
      tuft.setMatrixAt(n, o.matrix); tuft.setColorAt(n, col.set(["#2f8a62", "#3aa070", "#256e50", "#47b07a"][n % 4])); n++;
    }
    tuft.count = n; s.add(tuft);
    this.addSkyLife();
  }

  // ---------------------------------------------------------------- buildings & props
  populate() {
    const s = this.scene;
    this.bld = new Map();
    this.hitboxes = [];
    for (const b of BUILDINGS) {
      const W = (b.x1 - b.x0) * T, D = (b.y1 - b.y0) * T, c = toWorld((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      c.y = heightAt((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      const g = build(b.slot, { W, D }); g.position.copy(c); s.add(g); this.register(g);
      const h = (SLOTS[b.slot]?.height || b.h) + 4;
      const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(W, 4), h, Math.max(D, 3)), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(c).setY(h / 2); hit.userData.building = b; s.add(hit); this.hitboxes.push(hit);
      const door = toWorld(b.door[0] + 0.5, b.door[1] + 0.15);
      door.y = heightAt(b.door[0] + 0.5, b.door[1] + 0.5);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.copy(door).setY(door.y + 4.5); s.add(beam);
      const pool = lightPool(b.color, 3, 0.7); pool.position.copy(door).setY(door.y + 0.05); s.add(pool);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), M.glow(b.color, 3)); marker.scale.y = 1.6; s.add(marker);
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.6, D + 1.6), new THREE.MeshBasicMaterial({ map: frameTexture(), color: b.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      hl.rotation.x = -Math.PI / 2; hl.position.copy(c).setY(c.y + 0.06); s.add(hl);
      this.bld.set(b.id, { b, g, door });
      this.anims.push((t) => {
        const hot = this.hoverId === b.id;
        marker.position.copy(door).setY(door.y + 5.4 + Math.sin(t * 2.4) * 0.35); marker.rotation.y = t * 1.6;
        beam.material.opacity = (hot ? 0.3 : 0.12) + Math.sin(t * 3) * 0.03;
        hl.material.opacity += ((hot ? 0.9 : 0) - hl.material.opacity) * 0.2;
      });
      if (b.status === "soon") this.comingSoon(b, c, W, D, h);
    }
    // Campus wall: low walls with a glowing cap, posts at the corners.
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(T, 1.1, T * 0.5), M.frame(), WALL.length), cap = new THREE.InstancedMesh(new THREE.BoxGeometry(T, 0.12, T * 0.5 + 0.06), M.glow("#ffc94d", 1.6), WALL.length);
    const o = new THREE.Object3D();
    WALL.forEach(([x, y], i) => {
      const vertical = x === CAMPUS.x0 || x === CAMPUS.x1 - 1;
      o.position.copy(toWorld(x + 0.5, y + 0.5)).setY(0.79); o.rotation.y = vertical && !(y === CAMPUS.y0 || y === CAMPUS.y1 - 1) ? Math.PI / 2 : 0; o.updateMatrix(); wall.setMatrixAt(i, o.matrix);
      o.position.y = 1.39; o.updateMatrix(); cap.setMatrixAt(i, o.matrix);
    });
    wall.castShadow = wall.receiveShadow = true; s.add(wall, cap);
    const onGround = (x, y) => toWorld(x, y).setY(heightAt(x, y));
    const mon = build("monument"); mon.position.copy(onGround(MONUMENT.x, MONUMENT.y)); s.add(mon); this.register(mon);
    const f = build("fountain"); f.position.copy(onGround(FOUNTAIN.x, FOUNTAIN.y)); s.add(f); this.register(f);
    const pad = build("spawn-pad"); pad.position.copy(onGround(...SPAWN)); s.add(pad); this.register(pad);
    const groups = {};
    for (const p of PROPS) {
      if (p.kind === "car") continue;
      const pos = onGround(p.x, p.y);
      if (INSTANCED[p.kind] && providedModel(p.kind)) { (groups[p.kind] ||= []).push({ pos, rot: p.rot || 0, s: p.s || 1, glow: p.glow }); continue; }
      const g = p.kind === "lamp" ? build("lamp", p.glow) : p.kind === "billboard" ? build("billboard", p.ad) : build(p.kind, p.s || 1);
      g.position.copy(pos); g.rotation.y = p.rot || 0;
      // Only trees and the crane cast shadows; small props would cost hundreds of draw calls.
      if (!["tree", "pine", "blossom", "crane"].includes(p.kind)) { g.userData.noShadow = true; g.traverse((o) => { o.castShadow = false; }); }
      s.add(g); this.register(g);
    }
    for (const [kind, items] of Object.entries(groups)) instanceProps(kind, items, INSTANCED[kind]).then((g) => s.add(g)).catch((e) => console.warn(`[world] ${kind}: ${e?.message || e}`));
    // Lamp light pools in one instanced draw.
    if (groups.lamp) {
      const L = groups.lamp, pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(4.8, 4.8), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), L.length);
      const o2 = new THREE.Object3D(), col = new THREE.Color();
      L.forEach((it, i) => { o2.position.copy(it.pos).setY(it.pos.y + 0.03); o2.rotation.set(-Math.PI / 2, 0, 0); o2.updateMatrix(); pools.setMatrixAt(i, o2.matrix); pools.setColorAt(i, col.set(it.glow || "#ffd27a")); });
      pools.renderOrder = 1; s.add(pools);
    }
    // Particles: fireflies, petals from the blossom trees, fountain sparkles, footstep dust.
    this.fx = new FX(s, { toWorld, map: MAP });
    this.fx.setBlossoms(s, PROPS.filter((p) => p.kind === "blossom").map((p) => onGround(p.x, p.y)));
    this.fx.setFountain(s, onGround(FOUNTAIN.x, FOUNTAIN.y));
    this.fountainPos = onGround(FOUNTAIN.x, FOUNTAIN.y);
    if (this.waterfallTop) this.fx.setMist(s, this.waterfallTop);

    // District labels (shown when zoomed out) and the door prompt.
    this.districtLabels = DISTRICTS.map((d) => {
      const el = document.createElement("div"); el.className = "district-label"; el.innerHTML = "<b></b>";
      el.querySelector("b").textContent = this.tr(`district.${d.id}`);
      const o2 = new CSS2DObject(el); o2.position.copy(toWorld((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2)).setY(d.id === "plaza" ? 9 : 22); s.add(o2);
      return { id: d.id, el };
    });
    const pe = document.createElement("div"); pe.className = "door-prompt"; pe.hidden = true;
    this.prompt = new CSS2DObject(pe); s.add(this.prompt);

    // Click marker and spawn beam (reused).
    this.clickRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: "#ffc94d", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.clickRing.rotation.x = -Math.PI / 2; this.clickRing.position.y = 0.08; s.add(this.clickRing);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: "#9fe8ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.position.copy(toWorld(...SPAWN)).setY(30); s.add(this.beam);
  }
  register(g) { this.anims.push((t, dt) => g.userData.anim?.(t, dt)); }

  // A "coming soon" business: holographic scaffold, scan line and a banner.
  // Over a real model it is only a faint outline, so the building shows.
  comingSoon(b, c, W, D, h) {
    const real = !!providedModel(b.slot), base = real ? 0.3 : 0.55;
    const geo = new THREE.BoxGeometry(W + 0.6, h, D + 0.6);
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
    lines.position.copy(c).setY(h / 2); this.scene.add(lines);
    if (!real) {
      const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.025, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      shell.position.copy(lines.position); this.scene.add(shell);
    }
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(W + 1, D + 1), new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: real ? 0.06 : 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    scan.rotation.x = -Math.PI / 2; scan.position.copy(c); this.scene.add(scan);
    const banner = sign([["sign.soon", "COMING SOON"]], 9, 1.6, { colors: ["#ffc94d"] });
    banner.position.copy(c).add(new THREE.Vector3(0, h + 1.6, D / 2)); this.scene.add(banner);
    this.anims.push((t) => { scan.position.y = (t * 4) % h; lines.material.opacity = base + Math.sin(t * 7) * 0.15 + (Math.random() < 0.02 ? -0.4 : 0); banner.position.y = h + 1.6 + Math.sin(t * 1.5) * 0.25; });
  }

  // Sky life: a few delivery drones circling the districts.
  addSkyLife() {
    for (let i = 0; i < 5; i++) {
      const d = new THREE.Group(); d.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), M.frame()));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), M.glow(i % 2 ? "#ff3355" : "#4fd8ff", 4)); led.position.y = -0.15; d.add(led);
      this.scene.add(d);
      const c = toWorld(...[[14, 14], [38, 10], [28.5, 28.5], [49.5, 7], [13, 39]][i]), r = 9 + i * 2, h = 15 + i * 3;
      this.anims.push((t) => { const a = t * (0.35 + i * 0.07) + i; d.position.set(c.x + Math.cos(a) * r, h + Math.sin(t * 1.7 + i) * 0.8, c.z + Math.sin(a) * r); led.visible = Math.floor(t * 3 + i) % 2 === 0; });
    }
  }

  // ---------------------------------------------------------------- agents
  addAgent(id, { name, archetype: arch, clan, elo, isPlayer = false, x, y }) {
    const color = archetype(arch).color;
    const group = new THREE.Group(); this.scene.add(group);
    const tag = document.createElement("div");
    tag.className = `agent-tag${isPlayer ? " me" : ""}`; tag.style.setProperty("--c", color);
    tag.innerHTML = `<i></i><span></span>`; tag.querySelector("span").textContent = name;
    const label = new CSS2DObject(tag); label.position.y = 2.9; group.add(label);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.6, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1.3; group.add(hit);
    if (!isPlayer) { const blob = new THREE.Mesh(BLOB.geo, BLOB.mat()); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; group.add(blob); }
    const a = { id, name, archetype: arch, clan, elo, color, isPlayer, x, y, path: [], walking: false, yaw: Math.random() * 6, group, label, hit, body: null, mixer: null, actions: {}, current: null, idleUntil: this.t + Math.random() * 4 };
    hit.userData.agent = a;
    a.group.position.copy(toWorld(x, y));
    if (isPlayer) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), new THREE.MeshBasicMaterial({ color: "#ffc94d", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; group.add(ring); a.ring = ring;
      group.add(lightPool("#ffc94d", 1.8, 0.5));
    }
    this.agents.set(id, a);
    this.dressAgent(a);
    return a;
  }
  // A model listed as agent-<archetype> in models/manifest.json is used as-is
  // for that archetype; otherwise the shared agent model is tinted.
  dressAgent(a) {
    const own = providedModel(`agent-${a.archetype}`);
    if (own && !a.ownGLB && !a.ownLoading) { a.ownLoading = true; loadGLB(`models/${own}`).then((g) => { a.ownGLB = g; this.dressAgent(a); }).catch((e) => console.warn(`[world] ${own}`, e?.message || e)); }
    const src = a.ownGLB || this.agentGLB;
    if (a.body) { a.group.remove(a.body); a.mixer?.stopAllAction(); a.mixer = null; }
    if (!src) { a.body = capsuleAgent(a.color); a.group.add(a.body); return; }
    const body = SkeletonUtils.clone(src.scene);
    body.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(body);
    body.scale.setScalar(SLOTS.agent.height / (bb.max.y - bb.min.y));
    const tint = new THREE.Color(a.color);
    body.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = a.isPlayer; o.frustumCulled = !o.isSkinnedMesh;
      o.material = o.material.clone();
      if (!a.ownGLB && o.material.name === "Main") { o.material.color = tint.clone(); o.material.emissive = tint.clone(); o.material.emissiveIntensity = 0.12; }
    });
    a.body = body; a.group.add(body);
    a.mixer = new THREE.AnimationMixer(body); a.actions = {};
    for (const clip of src.animations) a.actions[clip.name] = a.mixer.clipAction(clip);
    a.current = null; this.play(a, a.walking ? "Walking" : "Idle");
  }
  play(a, name, once = false) {
    if (!a.mixer || (a.current === name && !once)) return;
    const find = (n) => a.actions[n] || Object.entries(a.actions).find(([k]) => k.toLowerCase().includes(n.toLowerCase()))?.[1];
    const next = find(name) || (name === "Running" && find("Walk")) || find("Idle"); if (!next) return;
    next.reset().fadeIn(0.25).play();
    if (once) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; a.emoteUntil = this.t + next.getClip().duration; }
    if (a.current && a.actions[a.current] && a.actions[a.current] !== next) a.actions[a.current].fadeOut(0.25);
    a.current = name;
  }
  emote(a, name) { this.play(a, name, true); }
  get player() { return this.agents.get("me"); }

  spawnPlayer(agent) {
    if (this.player) { this.scene.remove(this.player.group); this.player.label.element.remove(); this.agents.delete("me"); }
    const p = this.addAgent("me", { ...agent, isPlayer: true, x: SPAWN[0], y: SPAWN[1] });
    p.spawnAt = this.t; p.group.scale.setScalar(0.01);
    this.cinematic = false; this.azTarget = ISO_AZ; this.viewHTarget = 32;
    this.target.copy(p.group.position);
    const n = 90, pos = new Float32Array(n * 3), vel = [], geo = new THREE.BufferGeometry(), c0 = toWorld(...SPAWN);
    for (let i = 0; i < n; i++) { pos.set([c0.x, 0.5, c0.z], i * 3); const a = Math.random() * 6.28, sp = 2 + Math.random() * 5; vel.push([Math.cos(a) * sp, 4 + Math.random() * 8, Math.sin(a) * sp]); }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, map: glowTexture(), color: "#9fe8ff", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(pts);
    const t0 = this.t;
    const fx = (t, dt) => {
      const k = t - t0;
      for (let i = 0; i < n; i++) { vel[i][1] -= 9 * dt; pos[i * 3] += vel[i][0] * dt; pos[i * 3 + 1] = Math.max(0.1, pos[i * 3 + 1] + vel[i][1] * dt); pos[i * 3 + 2] += vel[i][2] * dt; }
      geo.attributes.position.needsUpdate = true; pts.material.opacity = Math.max(0, 1 - k / 1.8);
      this.beam.material.opacity = Math.max(0, 0.75 * (1 - k / 1.6));
      if (k > 2) { this.scene.remove(pts); this.anims.splice(this.anims.indexOf(fx), 1); }
    };
    this.anims.push(fx);
    setTimeout(() => this.emote(p, "Wave"), 900);
    return p;
  }

  walk(a, target, done) {
    const path = findPath([a.x, a.y], target);
    if (!path) return false;
    a.path = path; a.onArrive = done || null; a.emoteUntil = 0;
    if (!path.length) { a.onArrive = null; done?.(); }
    return true;
  }
  walkToBuilding(id, done) {
    const b = BUILDINGS.find((x) => x.id === id), p = this.player;
    if (!b || !p) return false;
    const ok = this.walk(p, b.door, () => { p.yaw = Math.PI; done?.(b); });
    if (ok) this.mark(b.door[0] + 0.5, b.door[1] + 0.5);
    return ok;
  }
  walkToTile(gx, gy) {
    const p = this.player; if (!p) return false;
    gx = Math.floor(gx); gy = Math.floor(gy);
    if (!walkable(gx, gy)) {
      let best = null;
      for (let r = 1; r <= 4 && !best; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (walkable(gx + dx, gy + dy) && (!best || Math.hypot(dx, dy) < best.d)) best = { x: gx + dx, y: gy + dy, d: Math.hypot(dx, dy) };
      if (!best) return false;
      gx = best.x; gy = best.y;
    }
    if (!this.walk(p, [gx, gy])) return false;
    this.mark(gx + 0.5, gy + 0.5);
    return true;
  }
  mark(x, y) { this.clickRing.position.copy(toWorld(x, y)).setY(heightAt(x, y) + 0.08); this.markAt = this.t; }
  // The enterable building whose door the player is standing at (or null).
  nearDoor(max = 2.2) {
    const p = this.player; if (!p || p.walking) return null;
    return BUILDINGS.find((b) => Math.hypot(p.x - b.door[0] - 0.5, p.y - b.door[1] - 0.5) < max) || null;
  }
  showPrompt(b, html) {
    const el = this.prompt?.element; if (!el) return;
    if (!b) { el.hidden = true; return; }
    el.hidden = false; el.innerHTML = html; el.style.setProperty("--c", b.color);
    this.prompt.position.copy(toWorld(b.door[0] + 0.5, b.door[1] + 0.15)).setY(7.4);
  }

  // Screen -> world.
  ndc(sx, sy) { return new THREE.Vector2((sx / this.cw) * 2 - 1, -(sy / this.ch) * 2 + 1); }
  buildingAt(sx, sy) {
    if (!this.hitboxes) return null;
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    return this.raycaster.intersectObjects(this.hitboxes, false)[0]?.object.userData.building || null;
  }
  agentAt(sx, sy) {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    const hits = this.raycaster.intersectObjects([...this.agents.values()].filter((a) => !a.isPlayer).map((a) => a.hit), false);
    return hits[0]?.object.userData.agent || null;
  }
  walkToScreen(sx, sy) {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return false;
    return this.walkToTile((p.x + HALF) / T, (p.z + HALF) / T);
  }
  set hover(id) { this.hoverId = id; }
  get hover() { return this.hoverId; }
  zoomBy(f) { this.zoom = Math.min(1.8, Math.max(0.45, this.zoom * f)); }
  recenter() { this.zoom = 1; }

  // ---------------------------------------------------------------- frame
  resize(cw, ch, dpr) {
    cw = Math.max(1, cw); ch = Math.max(1, ch);
    this.cw = cw; this.ch = ch; this.baseDpr = dpr;
    dpr = this.quality === 1 ? Math.min(dpr, 1) : this.quality === 0 ? Math.min(dpr, 0.8) : dpr;
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(cw, ch, false);
    this.canvas.style.width = `${cw}px`; this.canvas.style.height = `${ch}px`;
    this.composer.setPixelRatio(dpr); this.composer.setSize(cw, ch);
    this.labels.setSize(cw, ch);
    this.mobileK = cw < 700 ? 1.25 : 1;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    for (const a of this.agents.values()) this.stepAgent(a, dt);
    for (const f of [...this.anims]) f(t, dt);
    if (this.markAt !== undefined) { const k = (t - this.markAt) / 0.9; this.clickRing.material.opacity = k < 1 ? 1 - k : 0; this.clickRing.scale.setScalar(1 + k * 1.4); }
    // District labels fade in when zoomed out (or on the landing).
    const showLabels = this.cinematic || this.zoom < 0.8;
    for (const l of this.districtLabels || []) l.el.classList.toggle("on", showLabels);

    if (this.cinematic) { this.azTarget = ISO_AZ + Math.sin(t * 0.06) * 0.55; this.target.lerp(toWorld(CENTER[0] + Math.sin(t * 0.05) * 6, CENTER[1] - 4 + Math.cos(t * 0.04) * 4), 0.02); }
    else if (this.player) this.target.lerp(this.player.group.position, Math.min(1, dt * 3.2));
    this.az += (this.azTarget - this.az) * Math.min(1, dt * 1.6);
    this.viewH += (this.viewHTarget - this.viewH) * Math.min(1, dt * 1.8);
    const vh = (this.viewH * (this.mobileK || 1)) / this.zoom, aspect = this.cw / this.ch;
    Object.assign(this.camera, { left: (-vh * aspect) / 2, right: (vh * aspect) / 2, top: vh / 2, bottom: -vh / 2 });
    this.camera.updateProjectionMatrix();
    swayTime.value = t;
    this.fx?.update(t, dt, (this.ch * this.renderer.getPixelRatio()) / vh, this.player);
    const dir = new THREE.Vector3(Math.cos(this.az) * Math.SQRT2, 1.1, Math.sin(this.az) * Math.SQRT2).normalize();
    this.camera.position.copy(this.target).addScaledVector(dir, 240);
    this.camera.lookAt(this.target);
    this.key.position.copy(this.target).add(new THREE.Vector3(-70, 90, 40)); this.key.target.position.copy(this.target);
  }

  stepAgent(a, dt) {
    if (a.path.length) {
      a.walking = true;
      const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), step = (a.isPlayer ? 3.8 : 1.5) * dt;
      a.yaw = Math.atan2(dx, dy);
      if (d <= step) { a.x = tx; a.y = ty; a.path.shift(); if (!a.path.length) { a.walking = false; const f = a.onArrive; a.onArrive = null; f?.(); } }
      else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
    } else {
      a.walking = false;
      if (!a.isPlayer && this.t > a.idleUntil && !a.paused) {
        for (let i = 0; i < 10; i++) { const [x, y] = randomStreetTile(); if (Math.hypot(x - a.x, y - a.y) > 4 && Math.hypot(x - a.x, y - a.y) < 20 && this.walk(a, [x, y])) break; }
        a.idleUntil = this.t + 3 + Math.random() * 7;
      }
    }
    if (!(a.emoteUntil > this.t)) this.play(a, a.walking ? (a.isPlayer ? "Running" : "Walking") : "Idle");
    a.mixer?.update(dt);
    const gy = heightAt(a.x, a.y); a.gy = a.gy === undefined ? gy : a.gy + (gy - a.gy) * Math.min(1, dt * 12);
    a.group.position.copy(toWorld(a.x, a.y)).setY(a.gy);
    const cur = a.group.rotation.y; let diff = a.yaw - cur; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    a.group.rotation.y = cur + diff * Math.min(1, dt * 10);
    if (!a.mixer && a.body) a.body.position.y = a.walking ? Math.abs(Math.sin(this.t * 10)) * 0.15 : Math.sin(this.t * 2) * 0.03;
    if (a.isPlayer) {
      const k = Math.min(1, (this.t - a.spawnAt) / 0.7); a.group.scale.setScalar(k < 1 ? 0.01 + k * k * (1.3 - 0.3 * k) : 1);
      a.ring.material.opacity = 0.55 + Math.sin(this.t * 4) * 0.35; a.ring.rotation.z = this.t;
    }
  }

  draw() {
    this.frame = (this.frame || 0) + 1;
    if (this.quality !== 0 && this.frame % (this.quality === 1 ? 4 : 2) === 0) this.renderer.shadowMap.needsUpdate = true;
    this.composer.render(); this.labels.render(this.scene, this.camera);
  }

  // Quality: 2 full, 1 lower resolution and fewer shadow updates, 0 no bloom,
  // no shadows, no particles. auto() steps down when frames stay slow.
  setQuality(q) {
    q = Math.max(0, Math.min(2, q));
    if (q === this.quality) return;
    this.quality = q;
    this.bloom.enabled = q > 0;
    this.key.castShadow = q > 0;
    const ms = q === 2 ? 2048 : 1024;
    if (this.key.shadow.mapSize.x !== ms) { this.key.shadow.mapSize.set(ms, ms); this.key.shadow.map?.dispose(); this.key.shadow.map = null; }
    this.fx?.setEnabled(q > 0);
    if (this.cw) this.resize(this.cw, this.ch, this.baseDpr);
  }
  autoQuality(dt) {
    if (this.qualityLocked) return;
    this.perf ||= { sum: 0, n: 0, wait: 4 };
    const P = this.perf;
    if ((P.wait -= dt) > 0) return;
    P.sum += dt; P.n++;
    if (P.n < 90) return;
    const avg = P.sum / P.n; P.sum = 0; P.n = 0;
    if (avg > 0.034 && this.quality > 0) { this.setQuality(this.quality - 1); P.wait = 4; console.info(`[world] quality -> ${this.quality} (avg ${(avg * 1000).toFixed(0)} ms)`); }
  }

  // ---------------------------------------------------------------- minimap
  // A drawn map: the coast with a soft glow, lawns and paving, smooth roads
  // with neon edges, buildings in their colours, the pond and its waterfall,
  // bridges to the beacon islets, the camera's view and everyone on the island.
  minimapToTile(fx, fy) { return [MM.x0 + fx * MM.span, MM.x0 + fy * MM.span]; }
  minimapBase(S) {
    const c = document.createElement("canvas"); c.width = c.height = S;
    const g = c.getContext("2d"), k = S / MM.span, f = this.features || { ends: [] };
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bg = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75); bg.addColorStop(0, "#1d1142"); bg.addColorStop(1, "#08051a");
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 110; i++) { g.fillStyle = `rgba(220,210,255,${0.12 + rnd() * 0.5})`; const z = rnd() < 0.15 ? 2 : 1; g.fillRect(rnd() * S, rnd() * S, z, z); }
    // Land, shaded from the coast inward, with a glow just off the coast.
    const img = g.getImageData(0, 0, S, S), d = img.data;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const sd = islandSD(MM.x0 + (px + 0.5) / k, MM.x0 + (py + 0.5) / k), i = (py * S + px) * 4;
      if (sd < -1.6) continue;
      const glow = sd < 0 ? (1 + sd / 1.6) ** 2 * 0.5 : 0;
      d[i] += (79 - d[i]) * glow; d[i + 1] += (216 - d[i + 1]) * glow; d[i + 2] += (255 - d[i + 2]) * glow;
      const land = Math.min(1, Math.max(0, sd * k + 0.5));
      if (!land) continue;
      const t = Math.min(1, sd / 7), rim = sd < 0.35 ? 1 - sd / 0.35 : 0;
      const cr = 30 + t * 16 + rim * 90, cg = 84 + t * 40 + rim * 130, cb = 70 + t * 26 + rim * 110;
      d[i] += (cr - d[i]) * land; d[i + 1] += (cg - d[i + 1]) * land; d[i + 2] += (cb - d[i + 2]) * land;
    }
    g.putImageData(img, 0, 0);
    g.save(); g.scale(k, k); g.translate(-MM.x0, -MM.x0);
    const glowLine = (color, blur) => { g.shadowColor = color; g.shadowBlur = blur; };
    // Trees as soft dots give the lawns texture.
    for (const p of PROPS) {
      if (!["tree", "pine", "blossom", "bush"].includes(p.kind)) continue;
      g.fillStyle = p.kind === "blossom" ? "rgba(255,140,200,0.75)" : "rgba(18,70,52,0.85)";
      g.beginPath(); g.arc(p.x, p.y, p.kind === "bush" ? 0.35 : 0.55, 0, Math.PI * 2); g.fill();
    }
    // Campus lawn and its wall.
    const cw = CAMPUS.x1 - CAMPUS.x0, ch = CAMPUS.y1 - CAMPUS.y0;
    g.fillStyle = "#2f8a62"; g.beginPath(); g.roundRect(CAMPUS.x0, CAMPUS.y0, cw, ch, 1.2); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.05)"; g.lineWidth = 1;
    for (let y = CAMPUS.y0 + 1; y < CAMPUS.y1; y += 2) { g.beginPath(); g.moveTo(CAMPUS.x0, y); g.lineTo(CAMPUS.x1, y); g.stroke(); }
    // Paving (plaza, paths, forecourts).
    g.fillStyle = "#5c5294";
    for (const sh of SHAPES) {
      if (sh.k !== "p") continue;
      g.beginPath();
      if (sh.rect) { const [x0, y0, x1, y1] = sh.rect; g.roundRect(x0, y0, x1 - x0, y1 - y0, 0.5); } else { const [x, y, r] = sh.circle; g.arc(x, y, r, 0, Math.PI * 2); }
      g.fill();
    }
    glowLine("#ffc94d", 6); g.strokeStyle = "#ffc94d"; g.lineWidth = 0.35; g.beginPath(); g.roundRect(CAMPUS.x0 + 0.2, CAMPUS.y0 + 0.2, cw - 0.4, ch - 0.4, 1); g.stroke();
    // Bridges and islets, under the roads so the joins are clean.
    for (const e of f.ends) {
      const [cx, cy] = e.coast, [ix, iy] = e.islet;
      g.shadowBlur = 0; g.strokeStyle = "#2a2450"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(ix, iy); g.stroke();
      glowLine(e.color, 8); g.strokeStyle = e.color; g.lineWidth = 0.18;
      const nx = -e.dir[1] * 1.2, ny = e.dir[0] * 1.2;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + nx * s, cy + ny * s); g.lineTo(ix + nx * s - e.dir[0] * 3, iy + ny * s - e.dir[1] * 3); g.stroke(); }
      g.shadowBlur = 0; g.fillStyle = "#2f8a62"; g.beginPath(); g.arc(ix, iy, 3.2, 0, Math.PI * 2); g.fill();
      glowLine(e.color, 10); g.strokeStyle = e.color; g.lineWidth = 0.3; g.stroke();
    }
    // Avenues, coast to coast: asphalt, neon edges, dashed centre line.
    g.shadowBlur = 0;
    const [W, E, N, Sx] = f.ends.length ? f.ends : [{ coast: [3, 28.5] }, { coast: [54, 28.5] }, { coast: [28.5, 3] }, { coast: [28.5, 54] }];
    g.fillStyle = "#231d3c"; g.fillRect(W.coast[0], 27, E.coast[0] - W.coast[0], 3); g.fillRect(27, N.coast[1], 3, Sx.coast[1] - N.coast[1]);
    const line = (x0, y0, x1, y1, color, width, dash) => { g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash || []); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); };
    glowLine("#4fd8ff", 6); line(W.coast[0], 27.15, E.coast[0], 27.15, "#4fd8ff", 0.22); line(W.coast[0], 29.85, E.coast[0], 29.85, "#4fd8ff", 0.22);
    glowLine("#ff4fa3", 6); line(27.15, N.coast[1], 27.15, Sx.coast[1], "#ff4fa3", 0.22); line(29.85, N.coast[1], 29.85, Sx.coast[1], "#ff4fa3", 0.22);
    g.shadowBlur = 0; line(W.coast[0], 28.5, E.coast[0], 28.5, "rgba(232,182,74,0.8)", 0.14, [0.9, 0.9]); line(28.5, N.coast[1], 28.5, Sx.coast[1], "rgba(232,182,74,0.8)", 0.14, [0.9, 0.9]);
    // The plaza over the crossing, with its rings.
    const [px0, py0] = CENTER;
    g.fillStyle = "#5c5294"; g.beginPath(); g.arc(px0, py0, 7.6, 0, Math.PI * 2); g.fill();
    for (const [r, c] of [[7.2, "#ff4fa3"], [6.1, "#4fd8ff"], [3.4, "#ffc94d"]]) { glowLine(c, 6); g.strokeStyle = c; g.lineWidth = 0.22; g.beginPath(); g.arc(px0, py0, r, 0, Math.PI * 2); g.stroke(); }
    // Pond, stream and the waterfall's lip.
    g.shadowBlur = 0;
    if (f.stream) { glowLine("#4fb8ff", 6); line(f.stream.a[0], f.stream.a[1], f.stream.b[0], f.stream.b[1], "#3aa0f0", 1.1); g.fillStyle = "#e8f8ff"; g.beginPath(); g.arc(f.stream.b[0], f.stream.b[1], 0.7, 0, Math.PI * 2); g.fill(); }
    const pg = g.createRadialGradient(POND.x - 1, POND.y - 1, 0.5, POND.x, POND.y, POND.r); pg.addColorStop(0, "#6cc8ff"); pg.addColorStop(1, "#1a5cc0");
    glowLine("#4fb8ff", 8); g.fillStyle = pg; g.beginPath(); g.arc(POND.x, POND.y, POND.r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0; g.strokeStyle = "rgba(220,240,255,0.6)"; g.lineWidth = 0.2; g.stroke();
    // Buildings, each in its own colour.
    for (const b of BUILDINGS) {
      if (b.kind === "park") continue;
      const x = b.x0 + 0.35, y = b.y0 + 0.35, bw = b.x1 - b.x0 - 0.7, bh = b.y1 - b.y0 - 0.7, gr = g.createLinearGradient(x, y, x + bw, y + bh);
      gr.addColorStop(0, b.color); gr.addColorStop(1, "#1a1032");
      g.globalAlpha = b.status === "soon" ? 0.6 : 1;
      glowLine(b.color, 10); g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, bw, bh, 0.9); g.fill();
      g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 0.15; g.setLineDash(b.status === "soon" ? [0.6, 0.5] : []); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 1;
    }
    // The fountain at the heart of the plaza.
    glowLine("#ff4fa3", 10); g.fillStyle = "#ff8cc6"; g.beginPath(); g.arc(px0, py0, 1.1, 0, Math.PI * 2); g.fill();
    g.restore();
    // Soft vignette.
    const v = g.createRadialGradient(S / 2, S / 2, S * 0.4, S / 2, S / 2, S * 0.72); v.addColorStop(0, "rgba(6,3,18,0)"); v.addColorStop(1, "rgba(6,3,18,0.55)");
    g.fillStyle = v; g.fillRect(0, 0, S, S);
    return c;
  }
  minimap(canvas) {
    const S = canvas.width, g = canvas.getContext("2d"), k = S / MM.span, X = (t) => (t - MM.x0) * k, u = S / 176, t = this.t;
    if (!this.mapBase || this.mapBase.width !== S) this.mapBase = this.minimapBase(S);
    g.clearRect(0, 0, S, S); g.drawImage(this.mapBase, 0, 0);
    // What the camera sees.
    const v = new THREE.Vector2(), hit = new THREE.Vector3();
    const view = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([nx, ny]) => { this.raycaster.setFromCamera(v.set(nx, ny), this.camera); this.raycaster.ray.intersectPlane(this.ground, hit); return [X((hit.x + HALF) / T), X((hit.z + HALF) / T)]; });
    g.beginPath(); view.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.fillStyle = "rgba(255,255,255,0.07)"; g.fill(); g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 1 * u; g.setLineDash([4 * u, 3 * u]); g.stroke(); g.setLineDash([]);
    // Pulsing beacons on the islets.
    for (const e of this.features?.ends || []) {
      const r = (1.6 + (Math.sin(t * 3) + 1) * 0.9) * u;
      g.shadowColor = e.color; g.shadowBlur = 10 * u; g.fillStyle = e.color; g.beginPath(); g.arc(X(e.islet[0]), X(e.islet[1]), r, 0, Math.PI * 2); g.fill();
    }
    // Everyone else.
    for (const a of this.agents.values()) {
      if (a.isPlayer) continue;
      g.shadowColor = a.color; g.shadowBlur = 6 * u; g.fillStyle = a.color; g.beginPath(); g.arc(X(a.x), X(a.y), 1.8 * u, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
    // You: a pulse ring and a heading arrow.
    const p = this.player;
    if (p) {
      const px = X(p.x), py = X(p.y), pulse = (t * 0.8) % 1;
      g.strokeStyle = `rgba(255,201,77,${1 - pulse})`; g.lineWidth = 1.5 * u; g.beginPath(); g.arc(px, py, (4 + pulse * 12) * u, 0, Math.PI * 2); g.stroke();
      g.save(); g.translate(px, py); g.rotate(-p.group.rotation.y + Math.PI);
      g.fillStyle = "#ffc94d"; g.shadowColor = "#ffc94d"; g.shadowBlur = 10 * u;
      g.beginPath(); g.moveTo(0, -7 * u); g.lineTo(5 * u, 5.5 * u); g.lineTo(0, 3 * u); g.lineTo(-5 * u, 5.5 * u); g.closePath(); g.fill();
      g.shadowBlur = 0; g.strokeStyle = "#1a1030"; g.lineWidth = 1.2 * u; g.stroke(); g.restore();
    }
  }
  districtAt(x, y) { return DISTRICTS.find((d) => x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1)?.id || "city"; }
}

// ------------------------------------------------------------------ helpers
function skyTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 1024;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 1024);
  gr.addColorStop(0, "#08051f"); gr.addColorStop(0.42, "#26105a"); gr.addColorStop(0.72, "#6a2a7a"); gr.addColorStop(0.9, "#c2508c"); gr.addColorStop(1, "#ff9a7a");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  // Aurora ribbons.
  for (let i = 0; i < 3; i++) {
    const ag = g.createLinearGradient(0, 120 + i * 70, 0, 260 + i * 70); ag.addColorStop(0, "rgba(79,216,255,0)"); ag.addColorStop(0.5, i === 1 ? "rgba(255,79,163,0.16)" : "rgba(79,216,255,0.14)"); ag.addColorStop(1, "rgba(79,216,255,0)");
    g.fillStyle = ag; g.beginPath(); g.moveTo(0, 200 + i * 60);
    for (let x = 0; x <= 1024; x += 32) g.lineTo(x, 160 + i * 60 + Math.sin(x / 120 + i * 2) * 40);
    g.lineTo(1024, 320 + i * 60); for (let x = 1024; x >= 0; x -= 32) g.lineTo(x, 260 + i * 60 + Math.sin(x / 140 + i) * 30); g.fill();
  }
  for (let i = 0; i < 320; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.85})`; const s = Math.random() < 0.08 ? 2 : 1; g.fillRect(Math.random() * 1024, Math.random() * 600, s, s); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  // A painted ringed gas giant, loaded after the first frame; its cropped
  // right and bottom edges fade into the sky.
  const img = new Image();
  img.onload = () => {
    const pw = 470, ph = Math.round(pw * img.height / img.width), px = 1024 - pw + 30, py = 70;
    const halo = g.createRadialGradient(px + pw * 0.62, py + ph * 0.5, 40, px + pw * 0.62, py + ph * 0.5, 300); halo.addColorStop(0, "rgba(255,150,210,0.32)"); halo.addColorStop(1, "rgba(255,150,210,0)");
    g.fillStyle = halo; g.fillRect(px - 120, py - 160, pw + 240, ph + 320);
    const p = document.createElement("canvas"); p.width = pw; p.height = ph; const q = p.getContext("2d");
    q.drawImage(img, 0, 0, pw, ph); q.globalCompositeOperation = "destination-in";
    const fx = q.createLinearGradient(0, 0, pw, 0); fx.addColorStop(0, "#000"); fx.addColorStop(0.82, "#000"); fx.addColorStop(1, "rgba(0,0,0,0)"); q.fillStyle = fx; q.fillRect(0, 0, pw, ph);
    const fy = q.createLinearGradient(0, 0, 0, ph); fy.addColorStop(0, "#000"); fy.addColorStop(0.78, "#000"); fy.addColorStop(1, "rgba(0,0,0,0)"); q.fillStyle = fy; q.fillRect(0, 0, pw, ph);
    g.globalAlpha = 0.95; g.drawImage(p, px, py); g.globalAlpha = 1;
    t.needsUpdate = true;
  };
  img.src = "art/sky/planet.webp";
  return t;
}

function frameTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.strokeStyle = "#fff"; g.lineWidth = 10; g.shadowColor = "#fff"; g.shadowBlur = 18; g.strokeRect(14, 14, 228, 228);
  return new THREE.CanvasTexture(c);
}
function jitter(geo, amt, all = false) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (all || p.getY(i) < 24) p.setXYZ(i, p.getX(i) + (Math.random() - 0.5) * amt, p.getY(i) + (all ? (Math.random() - 0.5) * amt : 0), p.getZ(i) + (Math.random() - 0.5) * amt);
  geo.computeVertexNormals(); return geo;
}
function farIslands(scene, list) {
  const o = new THREE.Object3D(), r = Math.random;
  const base = new THREE.InstancedMesh(new THREE.BoxGeometry(40, 2, 40), new THREE.MeshStandardMaterial({ color: "#3a2a64", roughness: 1 }), list.length);
  const rock = new THREE.InstancedMesh(new THREE.ConeGeometry(28.8, 24, 4), new THREE.MeshStandardMaterial({ color: "#24183e", flatShading: true }), list.length);
  const box = new THREE.BoxGeometry(1, 1, 1), cols = ["#4fd8ff", "#ff4fa3"];
  const towers = cols.map((c) => new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: "#2a2050", emissive: c, emissiveIntensity: 0.18 }), list.length * 3));
  const caps = cols.map((c) => new THREE.InstancedMesh(box, M.glow(c, 2), list.length * 3));
  list.forEach(([x, z, sc], k) => {
    const y = -6 - r() * 10, w = 40 * sc;
    o.position.set(x, y, z); o.rotation.set(0, 0, 0); o.scale.set(sc, 1, sc); o.updateMatrix(); base.setMatrixAt(k, o.matrix);
    o.position.set(x, y - 13 * sc, z); o.rotation.set(Math.PI, Math.PI / 4, 0); o.scale.setScalar(sc); o.updateMatrix(); rock.setMatrixAt(k, o.matrix);
    for (let i = 0; i < 6; i++) {
      const h = 8 + r() * 26 * sc, tw = 3 + r() * 5, px = x + (r() - 0.5) * w * 0.7, pz = z + (r() - 0.5) * w * 0.7, slot = k * 3 + (i >> 1);
      o.rotation.set(0, 0, 0);
      o.position.set(px, y + h / 2 + 1, pz); o.scale.set(tw, h, tw); o.updateMatrix(); towers[i % 2].setMatrixAt(slot, o.matrix);
      o.position.set(px, y + h + 1, pz); o.scale.set(tw + 0.2, 0.3, tw + 0.2); o.updateMatrix(); caps[i % 2].setMatrixAt(slot, o.matrix);
    }
  });
  scene.add(base, rock, ...towers, ...caps);
}
