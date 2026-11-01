// The character-select stage on the mint screen: the chosen archetype's 3D
// model on a glowing hex pedestal, with a spawn beam, rising sparks and a
// tech ring in the archetype's colour. Picking another archetype beams the new
// one in and it waves; while the agent mints it runs in place inside a
// charging beam, and waves again when it is done. Drag to turn it.
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { loadGLB, glowTexture } from "./models.js";

const HEIGHT = 1.75;

// A canvas ring of ticks and arcs, like a HUD reticle, drawn white so it can be tinted.
function ringTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d"); g.translate(256, 256); g.strokeStyle = "#fff"; g.lineCap = "round";
  g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 236, 0.15, 1.9); g.stroke();
  g.beginPath(); g.arc(0, 0, 236, 2.2, 3.9); g.stroke();
  g.beginPath(); g.arc(0, 0, 236, 4.2, 6.0); g.stroke();
  g.lineWidth = 3;
  for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, r0 = i % 6 ? 206 : 192; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * 220, Math.sin(a) * 220); g.stroke(); }
  g.lineWidth = 2; g.setLineDash([10, 14]); g.beginPath(); g.arc(0, 0, 176, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// A vertical fade (bright at the bottom) for the light beam.
function beamTexture() {
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.35, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

export class CharacterStage {
  constructor(host) {
    this.host = host;
    const c = this.canvas = document.createElement("canvas");
    c.className = "cs-canvas";
    host.prepend(c);
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, powerPreference: "high-performance" });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2;
    r.setClearColor(0x000000, 0);
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    s.add(new THREE.HemisphereLight("#e4dcff", "#2a1650", 1.6));
    const key = new THREE.DirectionalLight("#ffe2c8", 2.6); key.position.set(-3, 5, 4); s.add(key);
    this.rim = new THREE.DirectionalLight("#4fd8ff", 3.4); this.rim.position.set(3, 3.5, -4); s.add(this.rim);
    this.under = new THREE.PointLight("#ff4fa3", 2, 3, 2); this.under.position.set(0, 0.15, 0.9); s.add(this.under);

    const additive = (map, opacity) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    // Hex pedestal: dark metal with a neon rim.
    const ped = new THREE.Group(); s.add(ped);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.22, 6), new THREE.MeshStandardMaterial({ color: "#1a1236", metalness: 0.7, roughness: 0.35 }));
    top.position.y = -0.11; top.rotation.y = Math.PI / 6; ped.add(top);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.18, 6), new THREE.MeshStandardMaterial({ color: "#100a24", metalness: 0.6, roughness: 0.5 }));
    base.position.y = -0.3; base.rotation.y = Math.PI / 6; ped.add(base);
    this.rimLine = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.06, 1.06, 0.001, 6)), new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95 }));
    this.rimLine.rotation.y = Math.PI / 6; this.rimLine.position.y = 0.002; ped.add(this.rimLine);
    const flat = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; s.add(m); return m; };
    this.pool = flat(new THREE.PlaneGeometry(4.4, 4.4), additive(glowTexture(), 0.55), -0.39);
    this.ring = flat(new THREE.PlaneGeometry(3.1, 3.1), additive(ringTexture(), 0.85), -0.385);
    this.inner = flat(new THREE.RingGeometry(0.7, 0.74, 64), additive(null, 0.9), 0.006);
    this.pulse = flat(new THREE.RingGeometry(0.74, 0.79, 64), additive(null, 0.6), 0.008);
    // The beam: an open cylinder, bright at the base.
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 3.2, 40, 1, true), additive(beamTexture(), 0));
    this.beam.position.y = 1.6; s.add(this.beam);
    // Sparks rising round the pedestal.
    const n = 90, pos = new Float32Array(n * 3); this.sparkData = [];
    for (let i = 0; i < n; i++) this.sparkData.push({ a: Math.random() * Math.PI * 2, r: 0.5 + Math.random() * 0.9, y: Math.random() * 3, v: 0.3 + Math.random() * 0.7 });
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.05, map: glowTexture(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.add(this.sparks);

    this.turn = new THREE.Group(); s.add(this.turn);
    this.clock = new THREE.Clock(); this.yaw = -0.3; this.vel = 0.25; this.raf = 0;
    this.mode = "idle"; this.flare = 0; this.spawnT = 1; this.pointer = { x: 0, y: 0 };
    this.token = 0; this.color = new THREE.Color("#a78bfa");

    let drag = null;
    c.addEventListener("pointerdown", (e) => { drag = e.clientX; this.vel = 0; c.setPointerCapture(e.pointerId); c.classList.add("grab"); });
    c.addEventListener("pointermove", (e) => {
      const b = c.getBoundingClientRect();
      this.pointer.x = ((e.clientX - b.left) / b.width) * 2 - 1; this.pointer.y = ((e.clientY - b.top) / b.height) * 2 - 1;
      if (drag === null) return;
      const dx = e.clientX - drag; drag = e.clientX; this.yaw += dx * 0.012; this.vel = dx * 0.5;
    });
    const up = () => { drag = null; c.classList.remove("grab"); if (Math.abs(this.vel) < 0.1) this.vel = 0.25 * Math.sign(this.vel || 1); };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    c.addEventListener("pointerleave", () => { this.pointer.x = this.pointer.y = 0; });
    this.dragging = () => drag !== null;
  }

  /** Show an archetype: beams its model in and waves. Resolves once it is on stage. */
  async select(id, color) {
    const token = ++this.token;
    this.color.set(color);
    for (const m of [this.pool, this.ring, this.inner, this.pulse, this.beam]) m.material.color.copy(this.color);
    this.rimLine.material.color.copy(this.color).lerp(new THREE.Color("#ffffff"), 0.3);
    this.sparks.material.color.copy(this.color).lerp(new THREE.Color("#ffffff"), 0.35);
    this.rim.color.copy(this.color).lerp(new THREE.Color("#ffffff"), 0.45);
    this.under.color.copy(this.color);
    this.flare = 1;
    this.host.classList.add("loading");
    let gl;
    try { gl = await loadGLB(`models/agent-${id}.glb`); } catch (e) { console.warn("[charselect]", e); this.host.classList.remove("loading"); return; }
    if (token !== this.token) return;
    this.host.classList.remove("loading");
    if (this.model) { this.turn.remove(this.model); this.mixer?.stopAllAction(); }
    const model = SkeletonUtils.clone(gl.scene);
    model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(model, true), k = HEIGHT / Math.max(0.01, bb.max.y - bb.min.y);
    model.scale.multiplyScalar(k); model.position.y = -bb.min.y * k;
    model.position.x = -((bb.max.x + bb.min.x) / 2) * k; model.position.z = -((bb.max.z + bb.min.z) / 2) * k;
    model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
    this.turn.add(model); this.model = model; this.baseScale = model.scale.x;
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = Object.fromEntries(gl.animations.map((c) => [/idle/i.test(c.name) ? "idle" : /wave/i.test(c.name) ? "wave" : /run/i.test(c.name) ? "run" : /walk/i.test(c.name) ? "walk" : c.name, c]));
    this.current = null;
    this.spawnT = 0; this.flare = 1;
    this.play(this.mode === "charging" ? "run" : "wave");
  }

  /** Cross-fade to a clip; a wave plays once and settles back to idle. */
  play(name) {
    const clip = this.clips?.[name] || this.clips?.idle;
    if (!clip || !this.mixer) return;
    const next = this.mixer.clipAction(clip);
    if (this.current === next) return;
    next.reset(); next.enabled = true;
    if (name === "wave") {
      next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true;
      const back = (e) => { if (e.action === next) { this.mixer.removeEventListener("finished", back); if (this.mode !== "charging") this.play("idle"); } };
      this.mixer.addEventListener("finished", back);
    } else next.setLoop(THREE.LoopRepeat, Infinity);
    if (this.current) next.crossFadeFrom(this.current, 0.35, false);
    next.play(); this.current = next;
  }

  /** idle | charging (minting) | done (minted). */
  setMode(mode) {
    this.mode = mode;
    if (mode === "charging") this.play("run");
    else if (mode === "done") { this.flare = 1.4; this.play("wave"); }
    else this.play("idle");
  }

  start() {
    if (this.raf) return;
    this.clock.getDelta();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) { this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false); }
    // Frame the model and pedestal; narrow screens back off a little.
    const aspect = w / h, cam = this.camera;
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const d = Math.max(3.0 / 2 / tan, 1.7 / (tan * aspect) + 0.6);
    cam.aspect = aspect; cam.updateProjectionMatrix();
    cam.position.set(this.pointer.x * 0.35, 1.3 - this.pointer.y * 0.2, d); cam.lookAt(0, 0.52, 0);

    if (!this.dragging()) { this.vel += (0.25 * Math.sign(this.vel || 1) - this.vel) * Math.min(1, dt * 1.5); this.yaw += this.vel * dt; }
    this.turn.rotation.y = this.yaw;
    this.mixer?.update(dt);
    // Spawn: the model grows out of the beam with a little overshoot.
    if (this.model && this.spawnT < 1) {
      this.spawnT = Math.min(1, this.spawnT + dt * 2.4);
      const x = this.spawnT, e = 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
      this.model.scale.setScalar(this.baseScale * Math.max(0.001, e));
    }
    const charging = this.mode === "charging";
    this.flare = Math.max(charging ? 0.55 + Math.sin(t * 6) * 0.15 : 0, this.flare - dt * 1.3);
    this.beam.material.opacity = Math.min(0.6, this.flare * 0.55);
    this.beam.scale.set(1 - this.flare * 0.25, 1, 1 - this.flare * 0.25);
    this.ring.rotation.z = t * (charging ? 1.6 : 0.25);
    this.inner.material.opacity = 0.6 + Math.sin(t * 3) * 0.25;
    const p = (t * (charging ? 1.5 : 0.6)) % 1;
    this.pulse.scale.setScalar(1 + p * 1.1); this.pulse.material.opacity = 0.7 * (1 - p);
    this.under.intensity = 1.6 + this.flare * 6;
    const pos = this.sparks.geometry.attributes.position.array;
    this.sparkData.forEach((s, i) => {
      s.y += s.v * dt * (charging ? 3 : 1); if (s.y > 3.2) { s.y = 0; s.a = Math.random() * Math.PI * 2; }
      const a = s.a + t * 0.3, r = s.r * (charging ? 0.75 : 1);
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = s.y; pos[i * 3 + 2] = Math.sin(a) * r;
    });
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.renderer.render(this.scene, cam);
  }
}
