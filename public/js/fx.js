// Kult World ambient and gameplay particles: fireflies, falling blossom petals,
// fountain sparkles and footstep dust. One small point shader serves all of
// them, sized in world units so they scale with the camera zoom.
import * as THREE from "three";
import { glowTexture } from "./models.js";

class Layer {
  constructor(scene, n, additive) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n); this.col = new Float32Array(n * 3);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 10 }, uMap: { value: glowTexture() } },
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 color; uniform float uPx; varying float vA; varying vec3 vC;
        void main() { vA = aAlpha; vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uPx; }`,
      fragmentShader: `uniform sampler2D uMap; varying float vA; varying vec3 vC;
        void main() { float a = texture2D(uMap, gl_PointCoord).a * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  flush(px) {
    this.mat.uniforms.uPx.value = px;
    for (const k of ["position", "aSize", "aAlpha"]) this.geo.attributes[k].needsUpdate = true;
  }
  color(i, c) { c.toArray(this.col, i * 3); this.geo.attributes.color.needsUpdate = true; }
}

export class FX {
  constructor(scene, { toWorld, map }) {
    this.toWorld = toWorld; this.map = map; this.enabled = true;
    // Fireflies / neon dust drifting over the whole island.
    this.ff = new Layer(scene, 220, true);
    const pal = ["#ff7eb6", "#4fd8ff", "#ffc94d", "#c79bff"].map((c) => new THREE.Color(c));
    this.ffSeeds = Array.from({ length: this.ff.n }, (_, i) => { this.ff.color(i, pal[i % 4]); return [Math.random() * map, Math.random() * map, 0.8 + Math.random() * 7, Math.random() * 10]; });
    // Petals, sparkles and dust are filled in once their sources exist.
    this.petals = null; this.sparks = null;
    this.dust = new Layer(scene, 40, false);
    const dc = new THREE.Color("#b9a8e8");
    for (let i = 0; i < this.dust.n; i++) { this.dust.color(i, dc); this.dust.alpha[i] = 0; }
    this.dustLife = new Float32Array(this.dust.n).fill(1); this.dustNext = 0; this.dustAt = 0;
  }
  // Petals drift down from the canopies of these points (world positions of blossom trees).
  setBlossoms(scene, trees) {
    if (!trees.length) return;
    const L = this.petals = new Layer(scene, Math.min(180, trees.length * 9), false), pink = ["#ff9ccf", "#ffc2e2", "#ff7eb6"].map((c) => new THREE.Color(c));
    this.petalSeeds = Array.from({ length: L.n }, (_, i) => { L.color(i, pink[i % 3]); return { tree: trees[i % trees.length], ph: Math.random(), dur: 5 + Math.random() * 4, ox: (Math.random() - 0.5) * 2.4, oz: (Math.random() - 0.5) * 2.4 }; });
  }
  // Sparkles rising and falling around the plaza fountain.
  setFountain(scene, pos) {
    const L = this.sparks = new Layer(scene, 70, true), c = [new THREE.Color("#9fe8ff"), new THREE.Color("#ff9ccf")];
    this.sparkSeeds = Array.from({ length: L.n }, (_, i) => { L.color(i, c[i % 5 === 0 ? 1 : 0]); return { a: Math.random() * 6.28, r: 1 + Math.random() * 3, ph: Math.random(), dur: 1.4 + Math.random() * 1.6 }; });
    this.fountainPos = pos;
  }
  // Spray where the waterfall leaves the island.
  setMist(scene, pos) {
    const L = this.mist = new Layer(scene, 40, true), c = new THREE.Color("#d8f6ff");
    this.mistSeeds = Array.from({ length: L.n }, (_, i) => { L.color(i, c); return { ph: Math.random(), dur: 1.2 + Math.random() * 1.4, a: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.2 }; });
    this.mistPos = pos;
  }
  update(t, dt, px, player) {
    if (!this.enabled) return;
    const ff = this.ff;
    this.ffSeeds.forEach(([x, y, h, p], i) => {
      const w = this.toWorld(x + Math.sin(t * 0.2 + p) * 1.5, y + Math.cos(t * 0.17 + p) * 1.5);
      ff.pos[i * 3] = w.x; ff.pos[i * 3 + 1] = h + Math.sin(t * 0.8 + p) * 0.6; ff.pos[i * 3 + 2] = w.z;
      ff.size[i] = 0.32; ff.alpha[i] = 0.35 + 0.55 * Math.max(0, Math.sin(t * 1.7 + p * 3));
    });
    ff.flush(px);
    if (this.petals) {
      const L = this.petals;
      this.petalSeeds.forEach((s, i) => {
        const k = ((t / s.dur + s.ph) % 1), tr = s.tree, sway = Math.sin(t * 1.3 + i) * 0.5;
        L.pos[i * 3] = tr.x + s.ox + k * 2.2 + sway; L.pos[i * 3 + 1] = tr.y + 3.6 * (1 - k) + 0.2; L.pos[i * 3 + 2] = tr.z + s.oz + k * 1.4;
        L.size[i] = 0.2; L.alpha[i] = k < 0.1 ? k * 9 : k > 0.85 ? (1 - k) * 6 : 0.9;
      });
      L.flush(px);
    }
    if (this.sparks) {
      const L = this.sparks, f = this.fountainPos;
      this.sparkSeeds.forEach((s, i) => {
        const k = ((t / s.dur + s.ph) % 1), a = s.a + t * 0.3, r = s.r * (0.4 + k * 0.6);
        L.pos[i * 3] = f.x + Math.cos(a) * r; L.pos[i * 3 + 1] = f.y + 1 + Math.sin(k * Math.PI) * 3.4; L.pos[i * 3 + 2] = f.z + Math.sin(a) * r;
        L.size[i] = 0.18; L.alpha[i] = Math.sin(k * Math.PI) * 0.9;
      });
      L.flush(px);
    }
    if (this.mist) {
      const L = this.mist, m = this.mistPos;
      this.mistSeeds.forEach((s, i) => {
        const k = ((t / s.dur + s.ph) % 1);
        L.pos[i * 3] = m.x + Math.cos(s.a) * s.sp * k * 1.6; L.pos[i * 3 + 1] = m.y + Math.sin(k * Math.PI) * 0.8 - k * 2.5; L.pos[i * 3 + 2] = m.z + Math.sin(s.a) * s.sp * k * 1.6;
        L.size[i] = 0.35 + k * 0.6; L.alpha[i] = Math.sin(k * Math.PI) * 0.35;
      });
      L.flush(px);
    }
    // Footstep dust behind the player.
    const D = this.dust;
    if (player?.walking && t > this.dustAt) {
      this.dustAt = t + 0.11;
      const i = this.dustNext; this.dustNext = (i + 1) % D.n;
      const p = player.group.position;
      D.pos[i * 3] = p.x + (Math.random() - 0.5) * 0.4; D.pos[i * 3 + 1] = p.y + 0.12; D.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.4;
      this.dustLife[i] = 0;
    }
    for (let i = 0; i < D.n; i++) {
      const l = this.dustLife[i] = Math.min(1, this.dustLife[i] + dt / 0.7);
      D.pos[i * 3 + 1] += dt * 0.35; D.size[i] = 0.25 + l * 0.7; D.alpha[i] = l < 1 ? (1 - l) * 0.45 : 0;
    }
    D.flush(px);
  }
  setEnabled(on) {
    this.enabled = on;
    for (const L of [this.ff, this.petals, this.sparks, this.dust, this.mist]) if (L) L.points.visible = on;
  }
}
