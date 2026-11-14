// The Kult World intro: the Kult World film plays while the city builds behind
// it (main.js loads three.js, the models and the player in parallel), then it
// opens onto the sign-in page. It ends when the film has played AND the city
// is ready; once the city is ready the player can skip the rest. If the city is
// still building when the film ends, it holds on the last frame ("Building
// Kult World…", 99%) for up to HOLD_MAX, then lets the city fill in behind the
// sign-in page as before.
//
// Phones and data-saver get the 480p cut (0.7 MB), everyone else 720p (1.6 MB).
// If the film can't autoplay (data saver, low-power mode, a failed download)
// the poster frame stands in and the intro runs on the clock instead.

const HOLD_MAX = 4000, NO_VIDEO_MS = 3500, STALL_MS = 15000;

// The page loads this module on its own, ahead of main.js and three.js, so the
// film starts at once; main.js reports when the city is ready.
let markReady;
const ready = new Promise((r) => { markReady = r; });
export const introDone = runIntro(document.getElementById("intro"), ready);
export function introReady(p) { Promise.resolve(p).then(markReady, markReady); }

function pickSource() {
  const small = matchMedia("(max-width: 760px), (max-height: 500px)").matches || navigator.connection?.saveData;
  return `art/brand/kw-intro-${small ? 480 : 720}.mp4`;
}

function runIntro(root, ready) {
  const video = root.querySelector(".intro-video"), pct = root.querySelector("[data-intro-pct]");
  const bar = root.querySelector(".intro-bar i"), skip = root.querySelector(".intro-skip");
  const t0 = performance.now();
  let isReady = false, filmOver = false, noVideo = false, finished = false, filmEndedAt = 0;
  ready.then(() => { isReady = true; }, () => { isReady = true; });

  return new Promise((done) => {
    const finish = () => {
      if (finished) return;
      finished = true;
      pct.textContent = "100%"; bar.style.width = "100%";
      // The sign-in page fades in under the intro as it dissolves.
      root.classList.add("out"); done();
      setTimeout(() => { video.pause(); video.removeAttribute("src"); video.load(); root.remove(); }, 750);
    };
    const endFilm = () => { if (!filmOver) { filmOver = true; filmEndedAt = performance.now(); } };

    video.addEventListener("ended", endFilm);
    video.addEventListener("error", () => { noVideo = true; });
    skip.addEventListener("click", finish);
    video.src = pickSource();
    const playing = video.play();
    if (playing?.catch) playing.catch(() => { noVideo = true; });

    const frame = (now) => {
      if (finished) return;
      const t = now - t0;
      // Progress follows the film (or the clock without it); it never shows 100% before the city is ready.
      let p = noVideo ? Math.min(1, t / NO_VIDEO_MS) : video.duration ? video.currentTime / video.duration : 0;
      if (noVideo && p >= 1) endFilm();
      // A film stuck buffering doesn't hold the city hostage.
      if (!filmOver && t > STALL_MS && (isReady || t > STALL_MS * 2)) endFilm();
      if (isReady && skip.hidden && t > 1500) skip.hidden = false;
      const holding = filmOver && !isReady;
      const shown = isReady ? Math.round(p * 100) : Math.min(99, Math.round(p * 100));
      pct.textContent = `${holding ? 99 : shown}%`;
      bar.style.width = `${holding ? 99 : shown}%`;
      root.classList.toggle("hold", holding);
      if (filmOver && (isReady || now - filmEndedAt > HOLD_MAX)) return finish();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
