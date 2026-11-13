// KULT Agent Tower in Kult World: the tower building opens the Agent Tower
// (served by this site at /world/tower/) directed by the player's own Agent,
// and publishes that Agent's profile as window.KultWorldBridge so the tower
// shows it as the Director. When the player comes back, each new verified
// shift receipt gets a 0G Compute debrief (AI Arena's TEE-verified
// commentary), which goes into the Agent's 0G memory and the Passport.
// Shift receipts never change XP, ELO or balances.
import { config, towerApi, arenaApi, isDemo } from "./kult.js";

export function createTowerClient(ctx) {
  const { el, t, toast } = ctx;
  const $ = (id) => document.getElementById(id);
  let open = false, syncing = null;

  const memoryKey = (agentId) => `kw.tower.memory.v1.${agentId}`;
  const debriefKey = (agentId) => `kw.tower.debrief.v1.${agentId}`;
  const readSet = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || "[]")); } catch { return new Set(); } };
  const writeSet = (k, s) => { try { localStorage.setItem(k, JSON.stringify([...s].slice(-300))); } catch { /* storage blocked */ } };
  const readMap = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
  const writeMap = (k, m) => { try { const keys = Object.keys(m).slice(-30); localStorage.setItem(k, JSON.stringify(Object.fromEntries(keys.map((x) => [x, m[x]])))); } catch { /* storage blocked */ } };
  const won = (r) => Boolean(r.goal?.achieved) || r.delivered > r.missed;
  const line = (r) => `KULT Agent Tower · shift ${r.shift} · ${r.delivered} delivered, ${r.missed} missed · objective ${r.goal?.achieved ? "met" : "missed"} (${r.goal?.title || "shift goal"}) · rank ${r.rank} · signed receipt ${String(r.id).slice(0, 18)}`;

  // A 0G Compute debrief for one shift (AI Arena POST /v1/inference/battle-commentary).
  async function debrief(p, r) {
    const a = p.agent, me = { name: a.name, archetype: a.archetype, clan: a.clan || "ZEROG", elo: a.elo };
    const shift = { name: `Shift ${r.shift} clients`, archetype: "agency shift", clan: "Agent Tower", elo: 1000 };
    const [w, l] = won(r) ? [me, shift] : [shift, me];
    const out = await arenaApi.commentary({
      battleId: `tower:${r.id}`, gameName: `KULT Agent Tower · shift ${r.shift}`,
      winnerName: w.name, winnerArchetype: w.archetype, winnerClan: w.clan, winnerElo: w.elo, winnerHpPercent: 100,
      loserName: l.name, loserArchetype: l.archetype, loserClan: l.clan, loserElo: l.elo, loserHpPercent: 0,
      durationSeconds: 60, endReason: `${r.delivered} contracts delivered, ${r.missed} missed, ${r.creditsDelta >= 0 ? "+" : ""}${r.creditsDelta} credits, objective ${r.goal?.achieved ? "met" : "missed"}`
    });
    return out?.commentary ? { text: String(out.commentary).slice(0, 600), tee: Boolean(out.teeVerified) } : null;
  }

  /** Opens the Agent Tower full screen, directed by the player's Agent. */
  async function enter() {
    const p = ctx.player();
    if (!p) return;
    const c = await config();
    if (!c.tower && !isDemo()) return toast(t("tw.off"), "bad");
    let link;
    try { link = await towerApi.launch(p.agent.id); }
    catch (e) { return toast(e.status === 403 ? t("tw.notYours") : e.message || t("tw.fail"), "bad"); }
    // Same origin, so the tower's frame reads this; presentation only.
    window.KultWorldBridge = ctx.agentBridge?.() || null;
    $("app-title").textContent = t("tw.title");
    $("app-newtab").href = "/world/tower/";
    $("app-iframe").src = link.launchUrl;
    ctx.show("app-frame");
    open = true;
    ctx.onEnter?.();
  }

  /** Called when the player leaves the full-screen frame. */
  function left() {
    if (!open) return;
    open = false;
    void sync(true);
  }

  // The verified shift receipts, then each new one into 0G memory.
  function sync(announce = false) {
    syncing ||= (async () => {
      const p = ctx.player();
      if (!p) return;
      let receipts;
      try { receipts = await towerApi.record(p.agent.id); }
      catch (e) { console.warn("[kult-world] Agent Tower record", e.message); return; }
      if (ctx.player() !== p) return;
      const before = new Set((p.tower || []).map((r) => r.id));
      p.tower = receipts;
      const fresh = receipts.filter((r) => !before.has(r.id));
      if (announce && before.size && fresh.length) {
        for (const r of fresh.slice(0, 3)) ctx.onReceipt?.(r);
        toast(t("tw.recorded", { n: fresh.length }), "good");
      }
      if (!isDemo()) {
        const key = memoryKey(p.agent.id), done = readSet(key), dk = debriefKey(p.agent.id), notes = readMap(dk);
        for (const r of receipts.filter((x) => !done.has(x.id)).slice(0, 10)) {
          const note = notes[r.id] || await debrief(p, r).catch((e) => { console.warn("[kult-world] 0G debrief", e.message); return null; });
          if (note) notes[r.id] = note;
          try {
            await arenaApi.storeMemory(p.agent.id, { battleId: `tower:${r.id}`, outcome: won(r) ? "SUCCESS" : "MISS", content: note ? `${line(r)}. ${note.text}` : line(r) });
            done.add(r.id);
          } catch (e) { console.warn("[kult-world] Agent Tower memory", e.message); break; }
        }
        writeSet(key, done); writeMap(dk, notes);
      }
      ctx.onRecord?.();
    })().finally(() => { syncing = null; });
    return syncing;
  }

  /** The Passport's Agent Tower section. */
  function section(sectionEl) {
    const p = ctx.player(), list = p?.tower;
    const top = list?.[0], delivered = (list || []).reduce((n, r) => n + r.delivered, 0);
    const note = top ? readMap(debriefKey(p.agent.id))[top.id] : null;
    return sectionEl(t("tw.pp"), list?.length ? t("tw.ppSummary", { n: list.length, r: top.rank, d: delivered }) : null,
      note ? el("blockquote", { class: "syn-debrief tw-debrief" }, el("small", {}, t(note.tee ? "syn.debriefTee" : "syn.debrief")), note.text) : null,
      list?.length
        ? el("ul", { class: "syn-list tw-list" }, list.slice(0, 5).map((r) => el("li", { class: r.goal?.achieved ? "o-success" : "o-miss" },
          el("b", {}, t("tw.shift", { n: r.shift })), el("span", { class: "syn-o" }, `${r.delivered} ✓ · ${r.missed} ✕ · ${t(r.goal?.achieved ? "tw.goalWon" : "tw.goalMissed")}`), el("time", {}, ctx.ago(new Date(r.createdAt * 1000).toISOString())))))
        : el("p", { class: "muted tiny" }, t("tw.ppEmpty")),
      el("button", { type: "button", class: "btn ghost small", onclick: () => ctx.goTower() }, t("tw.go")));
  }

  return { enter, left, sync, section, get isOpen() { return open; } };
}
