// The Kult World intro: five seconds of the emblem coming alive (warp
// starfield, orbit rings, a loader ring filling round it, the wordmark and the
// tagline), then it opens onto the sign-in page. It always runs the full five
// seconds; if the city is still building after that it holds at 99% until it
// is ready (3 s more at most; the city then fills in behind the sign-in page).

const LENGTH = 5000, HOLD_MAX = 3000;

// The page loads this module on its own, ahead of main.js and three.js, so the
// intro starts at once; main.js reports when the city is ready.
let markReady;
const ready = new Promise((r) => { markReady = r; });
export const introDone = runIntro(document.getElementById("intro"), ready);
export function introReady(p) { Promise.resolve(p).then(markReady, markReady); }

function runIntro(root, ready) {
  const pct = root.querySelector("[data-intro-pct]"), ring = root.querySelector(".intro-ring .fill");
  const stop = stars(root.querySelector("canvas"));
  let isReady = false;
  ready.then(() => { isReady = true; }, () => { isReady = true; });

  return new Promise((done) => {
    // The timeline starts once the emblem can be drawn, so its entrance is seen.
    const emblem = root.querySelector(".intro-emblem img");
    const go = () => {
      root.classList.add("play");
      const t0 = performance.now();
      const frame = (now) => {
        const t = now - t0, p = Math.min(1, t / LENGTH);
        // Ease-out so the count moves quickly early and settles at the end.
        const shown = Math.round((1 - Math.pow(1 - p, 2.2)) * 100);
        const holding = p >= 1 && !isReady && t < LENGTH + HOLD_MAX;
        ring.style.strokeDasharray = `${(holding ? 0.99 : 1 - Math.pow(1 - p, 2.2)) * 100} 100`;
        pct.textContent = `${holding ? 99 : shown}%`;
        root.classList.toggle("hold", holding);
        if (p < 1 || holding) return requestAnimationFrame(frame);
        // The sign-in page fades in under the intro as it dissolves.
        root.classList.add("out"); done();
        setTimeout(() => { stop(); root.remove(); }, 750);
      };
      requestAnimationFrame(frame);
    };
    Promise.race([emblem.decode?.() ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).catch(() => {}).then(go);
  });
}

// A warp field: neon specks streaming out of the centre, faster as the intro
// builds. Stops drawing when the intro is gone.
function stars(canvas) {
  const g = canvas.getContext("2d");
  const colors = ["#ff4fa3", "#4fd8ff", "#a98bff", "#ffffff", "#ffc94d"];
  let w = 0, h = 0, raf = 0, alive = true;
  const fit = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit(); addEventListener("resize", fit);
  const spawn = (far) => ({ a: Math.random() * Math.PI * 2, r: far ? Math.random() * 0.9 : Math.random() * 0.05, s: 0.12 + Math.random() * 0.5, c: colors[(Math.random() * colors.length) | 0], z: 0.4 + Math.random() * 1.2 });
  const pts = Array.from({ length: matchMedia("(max-width: 640px)").matches ? 140 : 260 }, () => spawn(true));
  const t0 = performance.now();
  let last = t0;
  const draw = (now) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = Math.min(1, (now - t0) / LENGTH), speed = 0.25 + k * k * 2.4;
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.46, R = Math.hypot(w, h) * 0.6;
    g.globalCompositeOperation = "lighter";
    for (const p of pts) {
      const r0 = p.r;
      p.r += p.s * speed * dt * (0.3 + p.r);
      if (p.r > 1.1) Object.assign(p, spawn(false));
      const x0 = cx + Math.cos(p.a) * r0 * R, y0 = cy + Math.sin(p.a) * r0 * R;
      const x1 = cx + Math.cos(p.a) * p.r * R, y1 = cy + Math.sin(p.a) * p.r * R;
      g.strokeStyle = p.c; g.globalAlpha = Math.min(1, p.r * 2.2) * 0.85;
      g.lineWidth = p.z * (0.6 + p.r * 1.6);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 + (x1 - x0) * speed * 2, y1 + (y1 - y0) * speed * 2); g.stroke();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return () => { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", fit); };
}
