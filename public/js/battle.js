// AI Arena battles from the Game Hub, the same way the Kult browser runs them
// (kult-games-v3 AIArenaPage, ArenaGamePage, WarzoneWaveGamePage,
// HighwayHustleGamePage, RobowarGamePage; context_aiarena.md):
//
//   POST /v1/matchmaking → poll GET /v1/matchmaking/status/:agentId every 2 s
//   → matchId → GET /v1/battles/:id → the opponent
//   → Warzone / Wave / Highway Hustle: the Unity WebGL build, given the battle
//     through localStorage + SendMessage("GameManager","SetBattleId"); Unity
//     reports the result with a window CustomEvent
//   → Robowars: the desktop launcher (aiarena://launch?...), which posts the
//     result itself; the page polls the battle until it completes
//   → POST /v1/battles/:id/end, then trait evolution, training, 0G commentary
//     and 0G memory, exactly as the browser does.

import { arenaApi, isDemo } from "./kult.js";
import { createGame, SW, SH } from "./minigames.js";
import { archetype } from "./data.js";

// Demo mode plays the real Unity builds too. Kult World's own arena games
// stand in for the Robowars launcher, and for a Unity build that cannot load
// (offline); they run on the same stage and report the result the same way.
const SIM = { warzone: "warzone", "warzone-wave": "wave", "highway-hustle": "highway", robowar: "robowars" };
async function runSim(canvas, gameId, me, them, isAlive = () => true) {
  const side = (a, fallback) => ({ name: a.name, archetype: String(a.archetype).toLowerCase(), clan: a.clan, elo: a.eloRating ?? 1000, color: archetype(a.archetype).color || fallback });
  const game = createGame(SIM[gameId] || "warzone", { me: side(me, "#4fd8ff"), them: side(them, "#ff4fa3") });
  canvas.width = SW; canvas.height = SH;
  Object.assign(canvas.style, { imageRendering: "pixelated", objectFit: "contain", background: "#05020f" });
  const g = canvas.getContext("2d"); g.imageSmoothingEnabled = false;
  const started = performance.now();
  await new Promise((resolve) => {
    let last = started;
    const frame = (t) => {
      if (!isAlive()) return resolve();
      game.update(Math.min(0.05, (t - last) / 1000)); last = t; game.draw(g);
      if (game.done) return resolve();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return { winner: game.winner === 0 ? me : them, loser: game.winner === 0 ? them : me, seconds: Math.round((performance.now() - started) / 1000) };
}

const UNITY = {
  warzone: { dir: "Warzone2", file: "WarzoneV4", payloadKey: "arenaBattlePayload", event: "arenaBattleEnd" },
  "warzone-wave": { dir: "Warzone4", file: "WarzoneV4", payloadKey: "arenaBattlePayload", event: "waveCoopBattleEnd" },
  "highway-hustle": { dir: "Arena2", file: "HighwayHustle", payloadKey: "hrDuelPayload", event: "hrDuelEnd" }
};
export const LAUNCHER_DOWNLOAD = "https://downloads.aiarena.io/launcher/latest";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class Cancelled extends Error { constructor() { super("cancelled"); } }

/** Queue for a match and wait until AI Arena pairs the agent. */
export async function findMatch({ agentId, gameId, mode, isAlive, onTick }) {
  await arenaApi.joinQueue({ agentId, gameId, mode, eloRange: 200 });
  const started = Date.now();
  try {
    for (;;) {
      await wait(2000);
      if (!isAlive()) throw new Cancelled();
      const st = await arenaApi.queueStatus(agentId);
      onTick?.(Date.now() - started, st);
      if (st.matchId) return st.matchId;
      if (!st.inQueue && Date.now() - started > 8000) throw new Error("AI Arena dropped the agent from the queue. Try again.");
    }
  } catch (e) {
    if (e instanceof Cancelled) await arenaApi.leaveQueue(agentId).catch(() => {});
    throw e;
  }
}

/** A direct challenge: skips the queue and creates the battle at once. */
export async function challenge({ agentId, opponentId, gameId, mode }) {
  const m = await arenaApi.challenge({ agentId, opponentId, gameId, mode });
  if (!m?.battleId) throw new Error("AI Arena did not create the battle");
  return m.battleId;
}

/** The battle and the opponent's full agent record. */
export async function loadBattle(battleId, myAgentId) {
  const battle = await arenaApi.battle(battleId);
  const opponentId = (battle.agentIds || []).find((id) => id !== myAgentId);
  if (!opponentId) throw new Error("The battle has no opponent");
  return { battle, opponent: await arenaApi.agent(opponentId) };
}

// ------------------------------------------------------------------ Unity
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.async = true; s.dataset.unityLoader = "1";
    s.onload = () => resolve(s); s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.body.append(s);
  });
}

/**
 * Runs one Unity battle in `stage` and resolves with the normalised result.
 * `ui` reports progress and owns the exit button (ui.onExit(fn)).
 */
export async function playUnity(opts) {
  const spec = UNITY[opts.gameId];
  if (!spec) throw new Error(`No Unity build for ${opts.gameId}`);
  if (!isDemo()) return playBuild(spec, opts);
  try {
    return await playBuild(spec, opts);
  } catch (e) {
    if (!e.buildMissing) throw e;
    console.warn("[battle] Unity build unavailable, playing the arena game instead", e);
    return playSim(opts);
  }
}

async function playSim({ gameId, battleId, me, them, canvas, ui }) {
  let exited = false;
  ui.onExit(() => { exited = true; });
  for (let p = 0; p <= 1; p += 0.2) { ui.progress(p); await wait(180); }
  ui.loaded();
  const r = await runSim(canvas, gameId, me, them, () => !exited);
  if (exited) throw new Cancelled();
  const stat = () => ({ jumps: 4 + Math.floor(Math.random() * 12), shotsAttempted: 30 + Math.floor(Math.random() * 60), shotsConnected: 10 + Math.floor(Math.random() * 25), timesHit: 5 + Math.floor(Math.random() * 20), distanceCovered: 80 + Math.floor(Math.random() * 300) });
  return normalise(gameId, battleId, gameId === "warzone-wave"
    ? { battleId, winnerAgentId: r.winner.id, loserAgentId: r.loser.id, winnerName: r.winner.name, loserName: r.loser.name, winnerCoins: 40 + Math.floor(Math.random() * 60), loserCoins: 10 + Math.floor(Math.random() * 30), durationSeconds: r.seconds, endReason: "waves" }
    : gameId === "highway-hustle"
      ? { battleId, winnerId: r.winner.id, loserId: r.loser.id, winnerName: r.winner.name, loserName: r.loser.name, winnerDistance: 1800 + Math.floor(Math.random() * 900), loserDistance: 600 + Math.floor(Math.random() * 900), durationSeconds: r.seconds }
      : { battleId, winnerId: r.winner.id, loserId: r.loser.id, winnerName: r.winner.name, loserName: r.loser.name, winnerHpPercent: 20 + Math.floor(Math.random() * 60), loserHpPercent: 0, durationSeconds: r.seconds, endReason: "KO", playerStats: { [r.winner.id]: stat(), [r.loser.id]: stat() } });
}

async function playBuild(spec, { unityBase, gameId, battleId, me, them, mode, canvas, ui }) {
  // The wave build only starts wave co-op when told so (as the Kult browser does).
  if (gameId === "warzone-wave") mode = "WAVECOOP";
  const payload = gameId === "highway-hustle"
    ? { battleId, carAId: me.id, carAName: me.name, carAElo: me.eloRating ?? 1000, carBId: them.id, carBName: them.name, carBElo: them.eloRating ?? 1000, mode }
    : { battleId, myAgentId: me.id, myAgentName: me.name, myAgentArchetype: me.archetype, myAgentElo: me.eloRating ?? 1000, myAgentClan: me.clan,
        opponentId: them.id, opponentName: them.name, opponentArchetype: them.archetype, opponentElo: them.eloRating ?? 1000, opponentClan: them.clan, mode };
  localStorage.setItem(spec.payloadKey, JSON.stringify(payload));

  const build = `${unityBase}/${spec.dir}`;
  let instance = null, script = null;
  const cleanup = () => {
    localStorage.removeItem(spec.payloadKey);
    try { instance?.Quit?.().catch(() => {}); } catch { /* already gone */ }
    script?.remove();
  };

  const result = new Promise((resolve, reject) => {
    const onEnd = (e) => { window.removeEventListener(spec.event, onEnd); resolve(normalise(gameId, battleId, e.detail || {})); };
    window.addEventListener(spec.event, onEnd);
    ui.onExit(() => { window.removeEventListener(spec.event, onEnd); reject(new Cancelled()); });
    const onStart = (e) => ui.preMatch?.(e.detail || {});
    window.addEventListener("arenaMultiplayerStart", onStart, { once: true });
  });

  try {
    try {
      script = await loadScript(`${build}/${spec.file}.loader.js`);
      if (typeof window.createUnityInstance !== "function") throw new Error("The game build did not load");
    } catch (e) {
      throw Object.assign(e, { buildMissing: true });
    }
    Object.assign(canvas.style, { imageRendering: "", objectFit: "", background: "" });
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width); canvas.height = Math.round(r.height);
    instance = await window.createUnityInstance(canvas, {
      arguments: [], dataUrl: `${build}/${spec.file}.data`, frameworkUrl: `${build}/${spec.file}.framework.js`, codeUrl: `${build}/${spec.file}.wasm`,
      streamingAssetsUrl: "StreamingAssets", companyName: "Kult Games", productName: spec.file, productVersion: "1.0",
      // Unity resizing the canvas itself is what stalls loading at 0%.
      matchWebGLToCanvasSize: false, devicePixelRatio: 1
    }, (p) => ui.progress(p));
    ui.loaded();
    setTimeout(() => { try { instance.SendMessage("GameManager", "SetBattleId", battleId); } catch (err) { console.warn("[battle] SetBattleId failed", err); } }, 1500);
    return await result;
  } finally {
    cleanup();
  }
}

function normalise(gameId, battleId, d) {
  if (gameId === "warzone-wave") {
    return { battleId: d.battleId || battleId, winnerId: d.winnerAgentId, loserId: d.loserAgentId, winnerName: d.winnerName, loserName: d.loserName,
      durationSeconds: Number(d.durationSeconds) || 0, endReason: d.endReason || "", score: { winner: d.winnerCoins, loser: d.loserCoins, unit: "coins" } };
  }
  if (gameId === "highway-hustle") {
    return { battleId: d.battleId || battleId, winnerId: d.winnerId, loserId: d.loserId, winnerName: d.winnerName, loserName: d.loserName,
      durationSeconds: Number(d.durationSeconds) || 0, endReason: d.endReason || "race", score: { winner: d.winnerDistance, loser: d.loserDistance, unit: "m" },
      playerStats: { [d.winnerId]: stats({ distanceCovered: d.winnerDistance }), [d.loserId]: stats({ distanceCovered: d.loserDistance }) } };
  }
  return { battleId: d.battleId || battleId, winnerId: d.winnerId, loserId: d.loserId, winnerName: d.winnerName, loserName: d.loserName,
    durationSeconds: Number(d.durationSeconds) || 0, endReason: d.endReason || "", playerStats: d.playerStats,
    hp: { winner: d.winnerHpPercent, loser: d.loserHpPercent }, detail: d };
}
const stats = (o = {}) => ({ jumps: 0, shotsAttempted: 0, shotsConnected: 0, timesHit: 0, distanceCovered: Math.round(Number(o.distanceCovered) || 0), ...o, distanceCovered: Math.round(Number(o.distanceCovered) || 0) });

// ------------------------------------------------------------------ Robowars
/** Hands the battle to the desktop launcher and waits for its result. */
export async function playLauncher({ battleId, me, them, isAlive, onTick, monitor, onStart }) {
  if (isDemo()) {
    // The launcher's match, shown on the monitor; it reports the result as the launcher would.
    await new Promise((r) => setTimeout(r, 2500));
    onStart?.();
    if (monitor) monitor.hidden = false;
    const r = await runSim(monitor || document.createElement("canvas"), "robowar", me, them, isAlive);
    if (monitor) monitor.hidden = true;
    if (!isAlive()) throw new Cancelled();
    await arenaApi.endBattle(battleId, { winnerId: r.winner.id, loserId: r.loser.id });
  } else {
    location.href = `aiarena://launch?matchId=${encodeURIComponent(battleId)}&agentA=${encodeURIComponent(me.id)}&agentB=${encodeURIComponent(them.id)}`;
  }
  const started = Date.now();
  for (;;) {
    await wait(2000);
    if (!isAlive()) throw new Cancelled();
    const b = await arenaApi.battle(battleId);
    onTick?.(Date.now() - started, b);
    if (b.status === "COMPLETED" && b.result?.winnerId) {
      return { battleId, winnerId: b.result.winnerId, loserId: b.result.loserId, winnerName: b.result.winnerId === me.id ? me.name : them.name,
        loserName: b.result.winnerId === me.id ? them.name : me.name, durationSeconds: 0, endReason: "launcher", reported: true };
    }
    if (b.status === "CANCELLED" || b.status === "DISPUTED") throw new Error(`The battle was ${b.status.toLowerCase()}`);
  }
}

// ------------------------------------------------------------------ after the battle
function trainingData(s, outcome, durationSeconds) {
  const shotRate = durationSeconds > 0 ? s.shotsAttempted / durationSeconds : 0;
  const accuracy = s.shotsAttempted > 0 ? s.shotsConnected / s.shotsAttempted : 0;
  const win = outcome === "WIN";
  return [
    { state: { hp: 1, opponentHp: 1, distanceCovered: s.distanceCovered * 0.25, durationSeconds: durationSeconds * 0.25, battlePhase: "early" }, action: { type: shotRate > 0.5 ? "aggressive" : "balanced", jumps: Math.round(s.jumps * 0.3), shotRate }, outcome, reward: win ? 0.4 : -0.2 },
    { state: { hp: win ? 0.7 : 0.5, opponentHp: win ? 0.5 : 0.7, distanceCovered: s.distanceCovered * 0.6, durationSeconds: durationSeconds * 0.6, battlePhase: "mid" }, action: { type: accuracy > 0.5 ? "aggressive" : s.jumps > 10 ? "mobile" : "defensive", jumps: Math.round(s.jumps * 0.5), shotRate }, outcome, reward: win ? 0.7 : -0.3 },
    { state: { hp: win ? 0.4 : 0.1, opponentHp: win ? 0 : 0.8, distanceCovered: s.distanceCovered, durationSeconds, battlePhase: "late" }, action: { type: win ? "aggressive" : "defensive", jumps: s.jumps, shotRate }, outcome, reward: win ? 1 : -0.5 }
  ];
}

/**
 * Reports the result and runs the follow-ups. Resolves once the official
 * result is in; `commentary` resolves later with 0G Compute's text (or "").
 */
export async function report(result, { me, them }) {
  if (!result.reported) {
    await arenaApi.endBattle(result.battleId, { winnerId: result.winnerId, loserId: result.loserId, ...(result.playerStats ? { playerStats: result.playerStats } : {}) })
      .catch((e) => console.warn("[battle] endBattle failed (may already be ended)", e));
  }
  for (const [id, outcome] of [[result.winnerId, "WIN"], [result.loserId, "LOSS"]]) {
    if (!id) continue;
    const s = stats(result.playerStats?.[id]);
    void arenaApi.evolveTraits(id, { outcome, jumps: s.jumps, shotsAttempted: s.shotsAttempted, shotsConnected: s.shotsConnected, timesHit: s.timesHit, distanceCovered: s.distanceCovered, durationSeconds: result.durationSeconds }).catch(() => {});
    if (result.playerStats?.[id]) {
      void arenaApi.trainFromBattle(id, { type: "BEHAVIOUR_CLONING", priority: 5, trainingData: trainingData(s, outcome, result.durationSeconds), baseModel: "Qwen2.5-0.5B-Instruct", config: { source: "arena-battle" } }).catch(() => {});
    }
  }
  const winner = result.winnerId === me.id ? me : them, loser = result.winnerId === me.id ? them : me;
  const commentary = (async () => {
    let text = "";
    try {
      const r = await arenaApi.commentary({
        battleId: result.battleId, winnerName: winner.name, winnerArchetype: winner.archetype, winnerClan: winner.clan, winnerElo: winner.eloRating,
        winnerHpPercent: result.hp?.winner ?? 100, loserName: loser.name, loserArchetype: loser.archetype, loserClan: loser.clan, loserElo: loser.eloRating,
        loserHpPercent: result.hp?.loser ?? 0, durationSeconds: result.durationSeconds, endReason: result.endReason, playerStats: result.playerStats
      });
      text = r?.commentary || "";
    } catch { /* commentary is a bonus */ }
    const content = text || `${winner.name} defeated ${loser.name}${result.durationSeconds ? ` in a ${result.durationSeconds}s clash` : ""}.`;
    for (const [id, outcome] of [[result.winnerId, "WIN"], [result.loserId, "LOSS"]]) {
      if (id) void arenaApi.storeMemory(id, { battleId: result.battleId, outcome, content }).catch(() => {});
    }
    return text;
  })();
  return { commentary };
}
