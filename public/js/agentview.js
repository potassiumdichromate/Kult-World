// The 3D turntable on the agent card: a copy of the agent's model playing its
// Idle clip on a glowing pedestal, with its own small renderer. It turns
// slowly on its own; drag to spin it. It only renders while the card is open.
import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { glowTexture } from "./models.js";

const HEIGHT = 1.7;

export class AgentViewer {
  constructor() {
    const c = this.canvas = document.createElement("canvas");
    c.className = "av-canvas";
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    r.setClearColor(0x000000, 0);
    const s = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    this.radius = 0.7;
    s.add(new THREE.HemisphereLight("#d9d0ff", "#2a1650", 1.7));
    const key = new THREE.DirectionalLight("#ffd9b8", 2.6); key.position.set(-3, 5, 4); s.add(key);
    this.rim = new THREE.DirectionalLight("#4fd8ff", 3); this.rim.position.set(3, 3, -4); s.add(this.rim);
    // Pedestal: a soft pool of the archetype's colour, a neon ring and a pulse.
    const add = (geo, opacity) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; s.add(m); return m; };
    this.pool = add(new THREE.PlaneGeometry(2.6, 2.6), 0.6); this.pool.material.map = glowTexture();
    this.ring = add(new THREE.RingGeometry(0.6, 0.65, 72), 0.95); this.ring.position.y = 0.004;
    this.pulse = add(new THREE.RingGeometry(0.62, 0.66, 72), 0.6); this.pulse.position.y = 0.006;
    this.turn = new THREE.Group(); s.add(this.turn);
    this.clock = new THREE.Clock(); this.yaw = 0; this.vel = 0.4; this.raf = 0;
    let drag = null;
    c.addEventListener("pointerdown", (e) => { drag = e.clientX; this.vel = 0; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", (e) => { if (drag === null) return; const dx = e.clientX - drag; drag = e.clientX; this.yaw += dx * 0.012; this.vel = dx * 0.6; });
    const up = () => { drag = null; if (Math.abs(this.vel) < 0.15) this.vel = 0.4 * Math.sign(this.vel || 1); };
    c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
    this.dragging = () => drag !== null;
  }

  // body: the agent's model in the world; clips: its animations.
  show(host, body, clips, color) {
    this.hide();
    host.append(this.canvas);
    const tint = new THREE.Color(color);
    for (const m of [this.pool, this.ring, this.pulse]) m.material.color.copy(tint);
    this.rim.color.copy(tint).lerp(new THREE.Color("#4fd8ff"), 0.4);
    if (body) {
      const model = SkeletonUtils.clone(body);
      model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.updateMatrixWorld(true);
      // Measured on the skinned vertices in the current pose (the cached box can be stale).
      const bb = new THREE.Box3().setFromObject(model, true), k = HEIGHT / Math.max(0.01, bb.max.y - bb.min.y);
      model.scale.multiplyScalar(k); model.position.y = -bb.min.y * k;
      const cx = (bb.max.x + bb.min.x) / 2, cz = (bb.max.z + bb.min.z) / 2;
      this.radius = Math.max(0.7, k * Math.max(bb.max.x - cx, bb.max.z - cz));
      model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
      this.turn.add(model); this.model = model;
      const idle = clips.find((c) => /idle/i.test(c.name)) || clips[0];
      if (idle) { this.mixer = new THREE.AnimationMixer(model); this.mixer.clipAction(idle).play(); }
    }
    this.yaw = -0.35; this.vel = 0.4; this.aspect = 0; this.clock.getDelta();
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  hide() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.mixer?.stopAllAction(); this.mixer = null;
    if (this.model) { this.turn.remove(this.model); this.model = null; }
    this.canvas.remove();
  }

  // Back the camera off until the model (any way it turns) and its pedestal fit.
  frameModel(aspect) {
    this.aspect = aspect;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const d = Math.max((HEIGHT * 1.22) / 2 / tan, (this.radius * 1.15) / (tan * aspect) + this.radius);
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    this.camera.position.set(0, HEIGHT * 0.62, d); this.camera.lookAt(0, HEIGHT * 0.47, 0);
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
    }
    if (this.aspect !== w / h) this.frameModel(w / h);
    if (!this.dragging()) { this.vel += (0.4 * Math.sign(this.vel || 1) - this.vel) * Math.min(1, dt * 1.5); this.yaw += this.vel * dt; }
    this.turn.rotation.y = this.yaw;
    this.mixer?.update(dt);
    const p = (t * 0.6) % 1;
    this.pulse.scale.setScalar(1 + p * 0.9); this.pulse.material.opacity = 0.6 * (1 - p);
    this.renderer.render(this.scene, this.camera);
  }
}
