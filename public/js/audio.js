// Kult World sound: everything is synthesized with WebAudio (no files).
// An ambient dusk bed (pad, wind, a fountain that swells as you walk near it),
// footsteps, and short UI / reward / match cues. Audio starts on the first
// click or key press (browser autoplay rules); mute is remembered per browser.

const KEY = "kw.muted";
let ctx = null, master = null, noiseBuf = null, fountainGain = null, started = false;
let muted = (() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } })();
const listeners = new Set();

function boot() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function noise(loop = false) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; return s; }
function lfo(param, rate, depth, base) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; param.value = base;
  o.connect(g).connect(param); o.start();
}

// Ambient bed: a slow, filtered Am9 pad, soft wind and the fountain.
function ambient() {
  const pad = ctx.createGain(); pad.gain.value = 0; pad.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 4);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7; lfo(lp.frequency, 0.05, 220, 520);
  pad.connect(lp).connect(master);
  for (const [f, det] of [[110, -6], [164.81, 4], [196, -3], [246.94, 7], [329.63, -5]]) {
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = det;
    const g = ctx.createGain(); g.gain.value = f > 300 ? 0.12 : 0.22; o.connect(g).connect(pad); o.start();
  }
  const wind = noise(true), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
  wf.type = "bandpass"; wf.Q.value = 0.5; lfo(wf.frequency, 0.07, 160, 420); lfo(wg.gain, 0.09, 0.008, 0.016);
  wind.connect(wf).connect(wg).connect(master); wind.start();
  const water = noise(true), hf = ctx.createBiquadFilter(), lf2 = ctx.createBiquadFilter();
  hf.type = "highpass"; hf.frequency.value = 900; lf2.type = "lowpass"; lf2.frequency.value = 5200;
  fountainGain = ctx.createGain(); fountainGain.gain.value = 0;
  water.connect(hf).connect(lf2).connect(fountainGain).connect(master); water.start();
}

// One-shot helpers.
function tone(freq, dur, { type = "sine", vol = 0.2, at = 0, to = null, attack = 0.005 } = {}) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dur, { freq = 1200, to = null, q = 1, vol = 0.15, at = 0, type = "bandpass" } = {}) {
  const t = ctx.currentTime + at, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
const arp = (notes, step, opts) => notes.forEach((f, i) => tone(f, opts.dur || 0.35, { ...opts, at: i * step }));

const SOUNDS = {
  click: () => tone(880, 0.06, { type: "triangle", vol: 0.08, to: 620 }),
  open: () => { hiss(0.4, { freq: 300, to: 3200, q: 0.8, vol: 0.12 }); tone(440, 0.3, { vol: 0.07, to: 880 }); },
  close: () => hiss(0.3, { freq: 2600, to: 400, q: 0.8, vol: 0.08 }),
  pop: () => tone(660, 0.12, { vol: 0.1, to: 1050 }),
  coin: () => { tone(1318.5, 0.09, { type: "square", vol: 0.05 }); tone(1975.5, 0.32, { type: "square", vol: 0.05, at: 0.08 }); },
  quest: () => arp([523.25, 659.25, 783.99, 1046.5], 0.09, { type: "triangle", vol: 0.12, dur: 0.4 }),
  level: () => { arp([392, 523.25, 659.25, 783.99, 1046.5, 1318.5], 0.07, { type: "triangle", vol: 0.12, dur: 0.5 }); hiss(1, { freq: 6000, q: 0.5, vol: 0.04, at: 0.3 }); },
  deal: () => { hiss(0.08, { freq: 4000, vol: 0.2 }); tone(1567.98, 0.5, { type: "triangle", vol: 0.12, at: 0.05 }); tone(2093, 0.6, { type: "triangle", vol: 0.1, at: 0.1 }); },
  win: () => arp([392, 523.25, 659.25, 783.99, 1046.5], 0.11, { type: "sawtooth", vol: 0.07, dur: 0.5 }),
  lose: () => arp([329.63, 261.63, 220, 164.81], 0.16, { type: "triangle", vol: 0.12, dur: 0.5 }),
  beep: () => tone(660, 0.14, { type: "square", vol: 0.06 }),
  go: () => tone(990, 0.4, { type: "square", vol: 0.07 }),
  error: () => tone(150, 0.25, { type: "square", vol: 0.07, to: 110 }),
  spawn: () => { hiss(1.2, { freq: 200, to: 5000, q: 0.6, vol: 0.12 }); tone(220, 1, { vol: 0.08, to: 880, attack: 0.3 }); },
  type: () => tone(1400 + Math.random() * 400, 0.025, { type: "square", vol: 0.025 }),
  step: () => hiss(0.06, { freq: 700 + Math.random() * 300, q: 1.4, vol: 0.06, type: "lowpass" }),
  whoosh: () => hiss(0.5, { freq: 500, to: 2400, q: 0.7, vol: 0.08 })
};

let stepAt = 0;
export const sound = {
  get muted() { return muted; },
  // Called from the first user gesture.
  unlock() {
    boot(); if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    if (!started) { started = true; ambient(); }
  },
  toggle() {
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch { /* storage unavailable */ }
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.05);
    for (const f of listeners) f(muted);
    return muted;
  },
  onChange(f) { listeners.add(f); },
  play(name) { if (!ctx || muted || !SOUNDS[name]) return; try { SOUNDS[name](); } catch { /* audio graph busy */ } },
  // Per-frame: footsteps while the player moves, fountain volume by distance.
  update(t, { walking = false, fountainDist = 99 } = {}) {
    if (!ctx || muted) return;
    if (walking && t > stepAt) { stepAt = t + 0.27; SOUNDS.step(); }
    if (fountainGain) fountainGain.gain.setTargetAtTime(Math.max(0, 1 - fountainDist / 26) ** 2 * 0.07, ctx.currentTime, 0.3);
  }
};
