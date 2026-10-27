// Kult World in 3D: an isometric floating city at neon dusk.
// three.js scene with an orthographic isometric camera, warm key light +
// cool rim light, soft shadows, fog and bloom. Layout and pathfinding live in
// layout.js, every model is a swappable slot in models.js.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { MAP, tiles, BUILDINGS, HOLOS, FOUNTAIN, SPAWN, PROPS, DISTRICTS, CONSTRUCTION as C, POND, walkable, findPath, randomStreetTile } from "./layout.js";
import { T, build, hoverCar, glowTexture, lightPool, loadProvided, loadGLB, providedModel, capsuleAgent, AGENT_PLACEHOLDER_URL, SLOTS, M } from "./models.js";
import { archetype } from "./data.js";

export { BUILDINGS, MAP, walkable, SPAWN, DISTRICTS };
const HALF = (MAP * T) / 2;
export const toWorld = (x, y) => new THREE.Vector3(x * T - HALF, 0, y * T - HALF);
const ISO_AZ = Math.PI / 4;

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
    this.viewH = 46; this.viewHTarget = 46;
    this.target = toWorld(24.5, 24.5);
    this.ready = false;

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.08;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;

    const s = this.scene = new THREE.Scene();
    s.background = skyTexture();
    s.fog = new THREE.Fog("#2b1652", 150, 330);
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 700);

    // Lighting: warm sunset key, cool neon rim, violet sky fill.
    s.add(new THREE.HemisphereLight("#a596ff", "#24143c", 1.15));
    const key = this.key = new THREE.DirectionalLight("#ffb184", 2.6);
    key.position.set(-70, 90, 40); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 260 });
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
    this.buildWorld();
  }

  async init() {
    await loadProvided();
    this.populate();
    const url = providedModel("agent") ? `models/${providedModel("agent")}` : AGENT_PLACEHOLDER_URL;
    loadGLB(url).then((g) => { this.agentGLB = g; for (const a of this.agents.values()) this.dressAgent(a); })
      .catch((e) => console.warn("[world] agent model not loaded, using capsule bots", e?.message || e));
    this.ready = true;
  }

  // ---------------------------------------------------------------- static world
  buildWorld() {
    const s = this.scene, size = MAP * T;
    // Island top (painted ground) and its rocky underside.
    const gt = groundTextures();
    const top = new THREE.MeshStandardMaterial({ map: gt.map, emissiveMap: gt.emissive, emissive: "#ffffff", emissiveIntensity: 1.3, roughness: 0.92 });
    const side = new THREE.MeshStandardMaterial({ color: "#3b2c5e", roughness: 0.9, flatShading: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 2, size), [side, side, top, side, side, side]);
    slab.position.y = -1; slab.receiveShadow = true; s.add(slab);
    const rock = new THREE.Mesh(jitter(new THREE.ConeGeometry(size * 0.74, 46, 4, 6, true), 2.6), new THREE.MeshStandardMaterial({ color: "#2a1d48", roughness: 1, flatShading: true }));
    rock.rotation.set(Math.PI, Math.PI / 4, 0); rock.position.y = -25; s.add(rock);
    for (let i = 0; i < 26; i++) { // glowing crystals on the underside
      const a = (i / 26) * Math.PI * 2, rr = size * (0.3 + Math.random() * 0.25);
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(1 + Math.random() * 1.6, 0), M.glow(i % 2 ? "#4fd8ff" : "#ff4fa3", 1.6));
      c.position.set(Math.cos(a) * rr, -6 - Math.random() * 18, Math.sin(a) * rr); c.scale.y = 2.2; c.rotation.z = Math.PI; s.add(c);
    }
    // Neon rim along the island edge.
    const rimMat = M.glow("#4fd8ff", 2.2);
    for (const [w, d, x, z] of [[size, 0.25, 0, size / 2], [0.25, size, size / 2, 0], [size, 0.25, 0, -size / 2], [0.25, size, -size / 2, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), rimMat); m.position.set(x, 0.1, z); s.add(m); }

    // Pond water.
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.4 * T, 40), new THREE.MeshStandardMaterial({ color: "#123d7a", emissive: "#1f7fd6", emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.5 }));
    water.rotation.x = -Math.PI / 2; water.position.copy(toWorld(POND.x, POND.y)).setY(0.04); s.add(water);
    this.anims.push((t) => { water.material.emissiveIntensity = 0.5 + Math.sin(t * 1.3) * 0.1; });

    // Clouds drifting below the island, distant islands with skylines.
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(90, 50), new THREE.MeshBasicMaterial({ map: glowTexture(), color: i % 3 ? "#7a4ab8" : "#c05a9a", transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
      c.rotation.x = -Math.PI / 2; c.position.set((Math.random() - 0.5) * 360, -40 - Math.random() * 30, (Math.random() - 0.5) * 360); s.add(c);
      const v = 2 + Math.random() * 3; this.anims.push((t, dt) => { c.position.x += v * dt; if (c.position.x > 200) c.position.x = -200; });
    }
    for (const [x, z, sc] of [[-150, -120, 1], [170, -150, 1.3], [-190, 90, 0.9], [120, 190, 0.8], [-40, -230, 1.1], [240, 30, 1]]) s.add(farIsland(x, z, sc));
    this.addSkyLife();
  }

  // Buildings, props and plaza (some may be replaced by real GLBs).
  populate() {
    const s = this.scene;
    this.bld = new Map();
    this.hitboxes = [];
    for (const b of BUILDINGS) {
      const slot = b.id === "park" ? "bld-business-park" : "bld-arcade";
      const g = build(slot), c = toWorld((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      g.position.copy(c); s.add(g); this.register(g);
      // Click target: the whole volume.
      const h = SLOTS[slot].height + 6;
      const hit = new THREE.Mesh(new THREE.BoxGeometry((b.x1 - b.x0) * T, h, (b.y1 - b.y0) * T), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(c).setY(h / 2); hit.userData.building = b; s.add(hit); this.hitboxes.push(hit);
      // Door beacon: a light column and a floating marker.
      const door = toWorld(b.door.tile[0] + 0.5, b.door.tile[1] + 0.1);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 9, 16, 1, true), new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.copy(door).setY(4.5); s.add(beam);
      const pool = lightPool(b.color, 3.2, 0.7); pool.position.copy(door).setY(0.05); s.add(pool);
      const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), M.glow(b.color, 3)); marker.scale.y = 1.6; s.add(marker);
      const light = new THREE.PointLight(b.color, 18, 12, 1.6); light.position.copy(door).setY(2.5); s.add(light);
      // Footprint highlight on hover.
      const hl = new THREE.Mesh(new THREE.PlaneGeometry((b.x1 - b.x0) * T + 1.6, (b.y1 - b.y0) * T + 1.6), new THREE.MeshBasicMaterial({ map: frameTexture(), color: b.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      hl.rotation.x = -Math.PI / 2; hl.position.copy(c).setY(0.06); s.add(hl);
      this.bld.set(b.id, { b, g, beam, marker, hl, light, door });
      this.anims.push((t) => {
        const hot = this.hoverId === b.id;
        marker.position.copy(door).setY(5.4 + Math.sin(t * 2.4) * 0.35); marker.rotation.y = t * 1.6;
        beam.material.opacity = (hot ? 0.3 : 0.12) + Math.sin(t * 3) * 0.03;
        hl.material.opacity += ((hot ? 0.9 : 0) - hl.material.opacity) * 0.2;
        light.intensity = hot ? 40 : 18;
      });
    }
    for (const h of HOLOS) { const g = build(`holo-${h.id}`); g.position.copy(toWorld((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2)); s.add(g); this.register(g); }
    // Construction fence around the New District.
    const fenceMat = M.glow("#ffc94d", 1.4);
    for (let x = C.x0; x <= C.x1; x += 1.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), M.frame()); p.position.copy(toWorld(x, C.y1)).setY(0.55); s.add(p); }
    for (let y = C.y0; y <= C.y1; y += 1.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), M.frame()); p.position.copy(toWorld(C.x1, y)).setY(0.55); s.add(p); }
    for (const [w, d, x, y] of [[(C.x1 - C.x0) * T, 0.1, (C.x0 + C.x1) / 2, C.y1], [0.1, (C.y1 - C.y0) * T, C.x1, (C.y0 + C.y1) / 2]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), fenceMat); b.position.copy(toWorld(x, y)).setY(0.9); s.add(b); }

    const f = build("fountain"); f.position.copy(toWorld(FOUNTAIN.x, FOUNTAIN.y)); s.add(f); this.register(f);
    const pad = build("spawn-pad"); pad.position.copy(toWorld(...SPAWN)); s.add(pad); this.register(pad);
    for (const p of PROPS) {
      const g = p.kind === "lamp" ? build("lamp", p.glow) : p.kind === "billboard" ? build("billboard", p.ad) : p.kind === "car" ? build("car", p.color) : build(p.kind, p.s || 1);
      g.position.copy(toWorld(p.x, p.y)); g.rotation.y = p.rot || 0;
      s.add(g); this.register(g);
    }
    // Fireflies / neon dust.
    const n = 260, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seeds = [];
    const palette = ["#ff7eb6", "#4fd8ff", "#ffc94d", "#c79bff"].map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) { seeds.push([Math.random() * MAP, Math.random() * MAP, 0.6 + Math.random() * 7, Math.random() * 10]); palette[i % 4].toArray(col, i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, map: glowTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.add(pts);
    this.anims.push((t) => { seeds.forEach(([x, y, h, p], i) => { const w = toWorld(x + Math.sin(t * 0.2 + p) * 1.5, y + Math.cos(t * 0.17 + p) * 1.5); pos[i * 3] = w.x; pos[i * 3 + 1] = h + Math.sin(t * 0.8 + p) * 0.6; pos[i * 3 + 2] = w.z; }); geo.attributes.position.needsUpdate = true; });

    // Click marker and spawn beam (reused).
    this.clickRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 32), new THREE.MeshBasicMaterial({ color: "#ffc94d", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.clickRing.rotation.x = -Math.PI / 2; this.clickRing.position.y = 0.08; s.add(this.clickRing);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: "#9fe8ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.position.copy(toWorld(...SPAWN)).setY(30); s.add(this.beam);
    this.sparks = [];
  }
  register(g) { if (g.userData.anim) this.anims.push((t, dt) => g.userData.anim?.(t, dt)); }

  // Flying traffic and drones.
  addSkyLife() {
    for (let i = 0; i < 7; i++) {
      const car = hoverCar(["#ff4fa3", "#4fd8ff", "#ffc94d", "#a98bff"][i % 4]), r = 62 + (i % 3) * 9, h = 18 + (i % 4) * 5, sp = (0.05 + Math.random() * 0.05) * (i % 2 ? 1 : -1), ph = Math.random() * 6.28;
      car.scale.setScalar(1.3); this.scene.add(car);
      const trail = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.4), new THREE.MeshBasicMaterial({ color: car.children[0].material.color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      trail.position.set(-3.6, 0.55, 0); car.add(trail);
      this.anims.push((t) => { const a = ph + t * sp; car.position.set(Math.cos(a) * r, h + Math.sin(t + i) * 0.6, Math.sin(a) * r); car.rotation.y = -a + (sp > 0 ? -Math.PI / 2 : Math.PI / 2); });
    }
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Group(); d.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.7), M.frame()));
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), M.glow(i % 2 ? "#ff3355" : "#4fd8ff", 4)); led.position.y = -0.15; d.add(led);
      this.scene.add(d);
      const c = toWorld(...[[13, 17], [31, 11], [24.5, 24.5], [10, 6]][i]), r = 9 + i * 2, h = 13 + i * 3;
      this.anims.push((t) => { const a = t * (0.35 + i * 0.07) + i; d.position.set(c.x + Math.cos(a) * r, h + Math.sin(t * 1.7 + i) * 0.8, c.z + Math.sin(a) * r); led.visible = Math.floor(t * 3 + i) % 2 === 0; });
    }
  }

  // ---------------------------------------------------------------- agents
  addAgent(id, { name, archetype: arch, clan, isPlayer = false, x, y }) {
    const color = archetype(arch).color;
    const group = new THREE.Group(); this.scene.add(group);
    const tag = document.createElement("div");
    tag.className = `agent-tag${isPlayer ? " me" : ""}`; tag.style.setProperty("--c", color);
    tag.innerHTML = `<i></i><span></span>`; tag.querySelector("span").textContent = name;
    const label = new CSS2DObject(tag); label.position.y = 2.9; group.add(label);
    const a = { id, name, archetype: arch, clan, color, isPlayer, x, y, path: [], walking: false, yaw: Math.random() * 6, group, label, body: null, mixer: null, actions: {}, current: null, idleUntil: this.t + Math.random() * 4 };
    a.group.position.copy(toWorld(x, y));
    if (isPlayer) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), new THREE.MeshBasicMaterial({ color: "#ffc94d", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; group.add(ring); a.ring = ring;
      const pool = lightPool("#ffc94d", 1.8, 0.5); group.add(pool);
    }
    this.agents.set(id, a);
    this.dressAgent(a);
    return a;
  }
  // Give an agent its body: the rigged model when loaded, else a capsule bot.
  // A model listed as agent-<archetype> in models/manifest.json is used
  // as-is for that archetype; otherwise the shared agent model is tinted.
  dressAgent(a) {
    const own = providedModel(`agent-${a.archetype}`);
    if (own && !a.ownGLB && !a.ownLoading) { a.ownLoading = true; loadGLB(`models/${own}`).then((g) => { a.ownGLB = g; this.dressAgent(a); }).catch((e) => console.warn(`[world] ${own}`, e?.message || e)); }
    const src = a.ownGLB || this.agentGLB;
    if (a.body) { a.group.remove(a.body); a.mixer?.stopAllAction(); a.mixer = null; }
    if (!src) { a.body = capsuleAgent(a.color); a.group.add(a.body); return; }
    const body = SkeletonUtils.clone(src.scene);
    body.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(body), h = bb.max.y - bb.min.y;
    body.scale.setScalar(SLOTS.agent.height / h);
    const tint = new THREE.Color(a.color);
    body.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      o.material = o.material.clone();
      if (!a.ownGLB && o.material.name === "Main") { o.material.color = tint.clone(); o.material.emissive = tint.clone(); o.material.emissiveIntensity = 0.12; }
    });
    a.body = body; a.group.add(body);
    a.mixer = new THREE.AnimationMixer(body); a.actions = {};
    for (const clip of src.animations) a.actions[clip.name] = a.mixer.clipAction(clip);
    a.current = null; this.play(a, a.walking ? "Walking" : "Idle");
  }
  play(a, name) {
    if (!a.mixer || a.current === name) return;
    const find = (n) => a.actions[n] || Object.entries(a.actions).find(([k]) => k.toLowerCase().includes(n.toLowerCase()))?.[1];
    const next = find(name) || (name === "Running" && find("Walk")) || find("Idle"); if (!next) return;
    next.reset().fadeIn(0.25).play();
    if (a.current && a.actions[a.current]) a.actions[a.current].fadeOut(0.25);
    a.current = name;
  }
  get player() { return this.agents.get("me"); }

  spawnPlayer(agent) {
    if (this.player) { this.scene.remove(this.player.group); this.player.label.element.remove(); this.agents.delete("me"); }
    const p = this.addAgent("me", { ...agent, isPlayer: true, x: SPAWN[0], y: SPAWN[1] });
    p.spawnAt = this.t; p.group.scale.setScalar(0.01);
    this.cinematic = false; this.azTarget = ISO_AZ; this.viewHTarget = 30;
    this.target.copy(p.group.position);
    // Spark burst.
    const n = 90, pos = new Float32Array(n * 3), vel = [], geo = new THREE.BufferGeometry();
    const c0 = toWorld(...SPAWN);
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
    return p;
  }

  walk(a, target, done) {
    const path = findPath([a.x, a.y], target);
    if (!path) return false;
    a.path = path; a.onArrive = done || null;
    if (!path.length) { a.onArrive = null; done?.(); }
    return true;
  }
  walkToBuilding(id, done) {
    const b = BUILDINGS.find((x) => x.id === id), p = this.player;
    if (!b || !p) return;
    if (this.walk(p, b.door.tile, () => { p.yaw = Math.PI; done?.(b); })) this.mark(b.door.tile[0] + 0.5, b.door.tile[1] + 0.5);
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
  mark(x, y) { this.clickRing.position.copy(toWorld(x, y)).setY(0.08); this.markAt = this.t; }

  // Screen -> world.
  ndc(sx, sy) { return new THREE.Vector2((sx / this.cw) * 2 - 1, -(sy / this.ch) * 2 + 1); }
  buildingAt(sx, sy) {
    if (!this.hitboxes) return null;
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    const hit = this.raycaster.intersectObjects(this.hitboxes, false)[0];
    return hit?.object.userData.building || null;
  }
  walkToScreen(sx, sy) {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return false;
    return this.walkToTile((p.x + HALF) / T, (p.z + HALF) / T);
  }
  set hover(id) { this.hoverId = id; }
  get hover() { return this.hoverId; }
  zoomBy(f) { this.zoom = Math.min(1.8, Math.max(0.55, this.zoom * f)); }
  recenter() { this.zoom = 1; }

  // ---------------------------------------------------------------- frame
  resize(cw, ch, dpr) {
    cw = Math.max(1, cw); ch = Math.max(1, ch);
    this.cw = cw; this.ch = ch;
    this.renderer.setPixelRatio(dpr); this.renderer.setSize(cw, ch, false);
    this.canvas.style.width = `${cw}px`; this.canvas.style.height = `${ch}px`;
    this.composer.setPixelRatio(dpr); this.composer.setSize(cw, ch);
    this.labels.setSize(cw, ch);
    // Phones see a bit more of the map.
    this.mobileK = cw < 700 ? 1.25 : 1;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    for (const a of this.agents.values()) this.stepAgent(a, dt);
    for (const f of [...this.anims]) f(t, dt);
    if (this.markAt !== undefined) { const k = (t - this.markAt) / 0.9; this.clickRing.material.opacity = k < 1 ? 1 - k : 0; this.clickRing.scale.setScalar(1 + k * 1.4); }

    // Camera: slow cinematic orbit on the landing, isometric follow in play.
    if (this.cinematic) { this.azTarget = ISO_AZ + Math.sin(t * 0.06) * 0.55; this.target.lerp(toWorld(24.5 + Math.sin(t * 0.05) * 4, 24.5 + Math.cos(t * 0.04) * 3), 0.02); }
    else if (this.player) this.target.lerp(this.player.group.position, Math.min(1, dt * 3.2));
    this.az += (this.azTarget - this.az) * Math.min(1, dt * 1.6);
    this.viewH += (this.viewHTarget - this.viewH) * Math.min(1, dt * 1.8);
    const vh = (this.viewH * (this.mobileK || 1)) / this.zoom, aspect = this.cw / this.ch;
    Object.assign(this.camera, { left: (-vh * aspect) / 2, right: (vh * aspect) / 2, top: vh / 2, bottom: -vh / 2 });
    this.camera.updateProjectionMatrix();
    const dir = new THREE.Vector3(Math.cos(this.az) * Math.SQRT2, 1.1, Math.sin(this.az) * Math.SQRT2).normalize();
    this.camera.position.copy(this.target).addScaledVector(dir, 220);
    this.camera.lookAt(this.target);
    this.key.position.copy(this.target).add(new THREE.Vector3(-70, 90, 40)); this.key.target.position.copy(this.target);
  }

  stepAgent(a, dt) {
    if (a.path.length) {
      a.walking = true;
      const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy), step = (a.isPlayer ? 3.6 : 1.5) * dt;
      a.yaw = Math.atan2(dx, dy);
      if (d <= step) { a.x = tx; a.y = ty; a.path.shift(); if (!a.path.length) { a.walking = false; const f = a.onArrive; a.onArrive = null; f?.(); } }
      else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
    } else {
      a.walking = false;
      if (!a.isPlayer && this.t > a.idleUntil) {
        for (let i = 0; i < 10; i++) { const [x, y] = randomStreetTile(); if (Math.hypot(x - a.x, y - a.y) > 4 && Math.hypot(x - a.x, y - a.y) < 18 && this.walk(a, [x, y])) break; }
        a.idleUntil = this.t + 3 + Math.random() * 7;
      }
    }
    this.play(a, a.walking ? (a.isPlayer ? "Running" : "Walking") : "Idle");
    a.mixer?.update(dt);
    a.group.position.copy(toWorld(a.x, a.y));
    const cur = a.group.rotation.y; let diff = a.yaw - cur; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    a.group.rotation.y = cur + diff * Math.min(1, dt * 10);
    if (!a.mixer && a.body) a.body.position.y = a.walking ? Math.abs(Math.sin(this.t * 10)) * 0.15 : Math.sin(this.t * 2) * 0.03;
    if (a.isPlayer) {
      const k = Math.min(1, (this.t - a.spawnAt) / 0.7); a.group.scale.setScalar(k < 1 ? 0.01 + k * k * (1.3 - 0.3 * k) : 1);
      a.ring.material.opacity = 0.55 + Math.sin(this.t * 4) * 0.35; a.ring.rotation.z = this.t;
    }
  }

  draw() { this.composer.render(); this.labels.render(this.scene, this.camera); }

  // ---------------------------------------------------------------- minimap
  minimap(canvas) {
    const g = canvas.getContext("2d"), W = canvas.width, k = W / MAP;
    if (!this.mapBase) {
      const c = document.createElement("canvas"); c.width = c.height = W;
      const m = c.getContext("2d");
      const col = { g: "#235e4a", r: "#3a3360", p: "#6a5fa6", w: "#2a6cc0", c: "#5a4030", e: "#1a1230" };
      for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) { m.fillStyle = col[tiles[x][y]]; m.fillRect(x * k, y * k, k + 0.5, k + 0.5); }
      for (const b of BUILDINGS) { m.fillStyle = b.color; m.fillRect(b.x0 * k, b.y0 * k, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k); }
      for (const h of HOLOS) { m.strokeStyle = h.color; m.lineWidth = 1.5; m.setLineDash([3, 2]); m.strokeRect(h.x0 * k, h.y0 * k, (h.x1 - h.x0) * k, (h.y1 - h.y0) * k); }
      m.fillStyle = "#ff7eb6"; m.beginPath(); m.arc(FOUNTAIN.x * k, FOUNTAIN.y * k, 2.5, 0, 7); m.fill();
      this.mapBase = c;
    }
    g.clearRect(0, 0, W, W); g.drawImage(this.mapBase, 0, 0);
    for (const a of this.agents.values()) {
      if (a.isPlayer) continue;
      g.fillStyle = a.color; g.beginPath(); g.arc(a.x * k, a.y * k, 2, 0, 7); g.fill();
    }
    const p = this.player;
    if (p) {
      g.save(); g.translate(p.x * k, p.y * k); g.rotate(-p.group.rotation.y + Math.PI);
      g.fillStyle = "#ffc94d"; g.shadowColor = "#ffc94d"; g.shadowBlur = 8;
      g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(0, 2.5); g.lineTo(-4.5, 5); g.closePath(); g.fill(); g.restore();
    }
  }
  districtAt(x, y) { return DISTRICTS.find((d) => x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1)?.name || "Kult City"; }
}

// ------------------------------------------------------------------ helpers
function skyTexture() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 1024;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0, 0, 0, 1024);
  gr.addColorStop(0, "#0a0626"); gr.addColorStop(0.45, "#2a1258"); gr.addColorStop(0.75, "#6a2a7a"); gr.addColorStop(0.92, "#c2508c"); gr.addColorStop(1, "#ff8a7a");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; const s = Math.random() < 0.1 ? 2 : 1; g.fillRect(Math.random() * 1024, Math.random() * 560, s, s); }
  // Big ringed planet.
  const px = 800, py = 230;
  const pg = g.createRadialGradient(px - 30, py - 30, 10, px, py, 90); pg.addColorStop(0, "#ffd0e8"); pg.addColorStop(0.6, "#b05aa8"); pg.addColorStop(1, "#4a1e6a");
  g.fillStyle = pg; g.beginPath(); g.arc(px, py, 80, 0, 7); g.fill();
  g.strokeStyle = "rgba(255,200,230,0.55)"; g.lineWidth = 6; g.beginPath(); g.ellipse(px, py, 140, 26, -0.35, 0, 7); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Painted island top: grass, roads with neon edges, the plaza inlay.
function groundTextures() {
  const P = 32, S = MAP * P;
  const mk = () => { const c = document.createElement("canvas"); c.width = c.height = S; return [c, c.getContext("2d")]; };
  const [mc, m] = mk(), [ec, e] = mk();
  e.fillStyle = "#000"; e.fillRect(0, 0, S, S);
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) {
    const k = tiles[x][y], X = x * P, Y = y * P;
    if (k === "g") {
      m.fillStyle = ["#2d7a5c", "#2a7356", "#318262"][Math.floor(rnd() * 3)]; m.fillRect(X, Y, P, P);
      for (let i = 0; i < 5; i++) { m.fillStyle = rnd() < 0.5 ? "rgba(120,220,160,0.18)" : "rgba(10,40,30,0.18)"; m.fillRect(X + rnd() * P, Y + rnd() * P, 3, 3); }
    } else if (k === "r") { m.fillStyle = "#29233f"; m.fillRect(X, Y, P, P); }
    else if (k === "p") { m.fillStyle = (x + y) % 2 ? "#5d5592" : "#564e88"; m.fillRect(X, Y, P, P); m.strokeStyle = "rgba(20,10,40,0.35)"; m.strokeRect(X + 0.5, Y + 0.5, P - 1, P - 1); }
    else if (k === "w") { m.fillStyle = "#123d7a"; m.fillRect(X, Y, P, P); }
    else if (k === "c") { m.fillStyle = (x + y) % 3 ? "#4a3a2e" : "#433428"; m.fillRect(X, Y, P, P); }
    else { m.fillStyle = "#3b3366"; m.fillRect(X, Y, P, P); }
  }
  // Road markings: neon edges (emissive) and dashed gold centre lines.
  const line = (ctx, x0, y0, x1, y1, color, w, dash = []) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); };
  line(e, 3 * P, 23 * P + 3, 45 * P, 23 * P + 3, "#2bb7e8", 3); line(e, 3 * P, 26 * P - 3, 45 * P, 26 * P - 3, "#2bb7e8", 3);
  line(e, 23 * P + 3, 3 * P, 23 * P + 3, 45 * P, "#e84f9a", 3); line(e, 26 * P - 3, 3 * P, 26 * P - 3, 45 * P, "#e84f9a", 3);
  line(m, 3 * P, 24.5 * P, 45 * P, 24.5 * P, "#e8b64a", 3, [18, 14]); line(m, 24.5 * P, 3 * P, 24.5 * P, 45 * P, "#e8b64a", 3, [18, 14]);
  // Repaint the plaza over the road crossing, with its rings.
  for (let x = 0; x < MAP; x++) for (let y = 0; y < MAP; y++) if (Math.hypot(x + 0.5 - 24.5, y + 0.5 - 24.5) <= 7) { m.fillStyle = (x + y) % 2 ? "#5d5592" : "#564e88"; m.fillRect(x * P, y * P, P, P); e.fillStyle = "#000"; e.fillRect(x * P, y * P, P, P); }
  for (const [r, c, w] of [[6.6, "#ff4fa3", 4], [5.6, "#4fd8ff", 3], [3.2, "#ffc94d", 3]]) { e.strokeStyle = c; e.lineWidth = w; e.beginPath(); e.arc(24.5 * P, 24.5 * P, r * P, 0, 7); e.stroke(); m.strokeStyle = c; m.lineWidth = w; m.beginPath(); m.arc(24.5 * P, 24.5 * P, r * P, 0, 7); m.stroke(); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(e, 24.5 * P + Math.cos(a) * 3.4 * P, 24.5 * P + Math.sin(a) * 3.4 * P, 24.5 * P + Math.cos(a) * 5.4 * P, 24.5 * P + Math.sin(a) * 5.4 * P, "#7a5cff", 2); }
  // Construction site hazard border.
  for (let i = C.x0 * P; i < C.x1 * P; i += 24) { e.fillStyle = "#ffb43a"; e.fillRect(i, C.y1 * P - 6, 12, 6); }
  for (let i = C.y0 * P; i < C.y1 * P; i += 24) { e.fillStyle = "#ffb43a"; e.fillRect(C.x1 * P - 6, i, 6, 12); }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { map: tex(mc), emissive: tex(ec) };
}
function frameTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.strokeStyle = "#fff"; g.lineWidth = 10; g.shadowColor = "#fff"; g.shadowBlur = 18; g.strokeRect(14, 14, 228, 228);
  return new THREE.CanvasTexture(c);
}
function jitter(geo, amt) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 22) p.setXYZ(i, p.getX(i) + (Math.random() - 0.5) * amt, p.getY(i), p.getZ(i) + (Math.random() - 0.5) * amt);
  geo.computeVertexNormals(); return geo;
}
function farIsland(x, z, sc) {
  const g = new THREE.Group(), w = 40 * sc;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 2, w), new THREE.MeshStandardMaterial({ color: "#3a2a64", roughness: 1 })); g.add(top);
  const rock = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 24 * sc, 4), new THREE.MeshStandardMaterial({ color: "#24183e", flatShading: true })); rock.rotation.set(Math.PI, Math.PI / 4, 0); rock.position.y = -13 * sc; g.add(rock);
  for (let i = 0; i < 6; i++) {
    const h = 8 + Math.random() * 26 * sc, tw = 3 + Math.random() * 5;
    const tw2 = new THREE.Mesh(new THREE.BoxGeometry(tw, h, tw), new THREE.MeshStandardMaterial({ color: "#2a2050", emissive: i % 2 ? "#ff4fa3" : "#4fd8ff", emissiveIntensity: 0.18 }));
    tw2.position.set((Math.random() - 0.5) * w * 0.7, h / 2 + 1, (Math.random() - 0.5) * w * 0.7); g.add(tw2);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(tw + 0.2, 0.3, tw + 0.2), M.glow(i % 2 ? "#ff4fa3" : "#4fd8ff", 2)); cap.position.copy(tw2.position).setY(h + 1); g.add(cap);
  }
  g.position.set(x, -6 - Math.random() * 10, z);
  return g;
}
