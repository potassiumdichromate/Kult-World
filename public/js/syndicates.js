// Kult Syndicates in Kult World: the Switchyard depot opens the Syndicates
// district (served by this site at /world/syndicates/) signed in as the
// player's own Agent, and publishes that Agent's profile (archetype, clan,
// rank, 0G INFT, portrait, 3D model) as window.KultWorldBridge, so the
// district shows and walks the player's own character. When the player comes
// back, each new verified Syndicates receipt gets a 0G Compute debrief
// (AI Arena's TEE-verified commentary), which goes into the Agent's 0G memory
// and the Passport. As the Syndicates contract asks, receipts never change
// XP, ELO or balances.
import { config, syndicatesApi, arenaApi, isDemo } from "./kult.js";

const MISSION = { scout: "syn.m.scout", negotiate: "syn.m.negotiate", defend: "syn.m.defend", heist: "syn.m.heist", pvp: "syn.m.pvp", a2a: "syn.m.a2a" };

export function createSyndicates(ctx) {
  const { el, t, toast, sound } = ctx;
  const $ = (id) => document.getElementById(id);
  let open = false, syncing = null;

  const missionName = (r) => t(MISSION[r.missionType] || "syn.m.op");
  const outcomeName = (r) => t(`syn.o.${String(r.outcome || "").toLowerCase()}`);
  const memoryKey = (agentId) => `kw.syn.memory.v1.${agentId}`;
  const debriefKey = (agentId) => `kw.syn.debrief.v1.${agentId}`;
  const readMap = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
  const writeMap = (k, m) => { try { const keys = Object.keys(m).slice(-30); localStorage.setItem(k, JSON.stringify(Object.fromEntries(keys.map((x) => [x, m[x]])))); } catch { /* storage blocked */ } };
  // The opposing side, by operation (Kult-Syndicate server/content.py).
  const FACTION = { scout: "Glasswatch", heist: "Glasswatch", negotiate: "Verdant Union", defend: "Railjack Collective", pvp: "a rival Agent", a2a: "the client" };

  // A 0G Compute debrief for one operation (AI Arena POST /v1/inference/battle-commentary).
  async function debrief(p, r) {
    const a = p.agent, won = r.outcome === "SUCCESS", side = FACTION[r.missionType] || "the Switchyard";
    const me = { name: a.name, archetype: a.archetype, clan: a.clan || "ZEROG", elo: a.elo };
    const them = { name: side, archetype: "syndicate crew", clan: "Switchyard", elo: 1000 };
    const [w, l] = won ? [me, them] : [them, me];
    const out = await arenaApi.commentary({
      battleId: `syndicates:${r.id}`, gameName: `Kult Syndicates: ${missionName(r)} (${r.domain})`,
      winnerName: w.name, winnerArchetype: w.archetype, winnerClan: w.clan, winnerElo: w.elo, winnerHpPercent: won ? 100 : 100,
      loserName: l.name, loserArchetype: l.archetype, loserClan: l.clan, loserElo: l.elo, loserHpPercent: 0,
      durationSeconds: 90, endReason: `${missionName(r)} ${outcomeName(r).toLowerCase()} at the Switchyard`
    });
    return out?.commentary ? { text: String(out.commentary).slice(0, 600), tee: Boolean(out.teeVerified) } : null;
  }
  const readSet = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || "[]")); } catch { return new Set(); } };
  const writeSet = (k, set) => { try { localStorage.setItem(k, JSON.stringify([...set].slice(-300))); } catch { /* storage blocked */ } };

  /** Opens the Switchyard full screen, signed in as the player's Agent. */
  async function enter() {
    const p = ctx.player();
    if (!p) return;
    const c = await config();
    if (!c.syndicates && !isDemo()) return toast(t("syn.off"), "bad");
    let link;
    try { link = await syndicatesApi.launch(p.agent.id); }
    catch (e) { return toast(e.status === 403 ? t("syn.notYours") : e.message || t("syn.fail"), "bad"); }
    // Same origin, so the district's frame reads this; presentation only.
    window.KultWorldBridge = ctx.agentBridge?.() || null;
    $("app-title").textContent = t("syn.title");
    // The ticket is single use; a new tab reuses the session it just made.
    $("app-newtab").href = "/world/syndicates/";
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

  // The record from Kult World's store, then each new receipt into 0G memory.
  function sync(announce = false) {
    syncing ||= (async () => {
      const p = ctx.player();
      if (!p) return;
      let receipts;
      try { receipts = await syndicatesApi.record(p.agent.id); }
      catch (e) { console.warn("[kult-world] Syndicates record", e.message); return; }
      if (ctx.player() !== p) return;
      const before = new Set((p.syndicate || []).map((r) => r.id));
      p.syndicate = receipts;
      const fresh = receipts.filter((r) => !before.has(r.id));
      if (announce && before.size && fresh.length) {
        for (const r of fresh.slice(0, 3)) ctx.onReceipt?.(r, missionName(r), outcomeName(r));
        toast(t("syn.recorded", { n: fresh.length }), "good");
      }
      if (!isDemo()) {
        // New receipts: a 0G Compute debrief, then into the Agent's 0G memory.
        const key = memoryKey(p.agent.id), done = readSet(key), dk = debriefKey(p.agent.id), notes = readMap(dk);
        for (const r of receipts.filter((x) => !done.has(x.id)).slice(0, 10)) {
          const note = notes[r.id] || await debrief(p, r).catch((e) => { console.warn("[kult-world] 0G debrief", e.message); return null; });
          if (note) notes[r.id] = note;
          const line = `Kult Syndicates · ${missionName(r)} (${r.domain}) · ${outcomeName(r)} · verified receipt ${r.hash.slice(0, 12)}`;
          try {
            await arenaApi.storeMemory(p.agent.id, { battleId: `syndicates:${r.id}`, outcome: r.outcome, content: note ? `${line}. ${note.text}` : line });
            done.add(r.id);
          } catch (e) { console.warn("[kult-world] Syndicates memory", e.message); break; }
        }
        writeSet(key, done); writeMap(dk, notes);
      }
      ctx.onRecord?.();
    })().finally(() => { syncing = null; });
    return syncing;
  }

  /** The Passport's Syndicates section. */
  function section(sectionEl) {
    const p = ctx.player(), list = p?.syndicate;
    const wins = (list || []).filter((r) => r.outcome === "SUCCESS").length;
    const note = list?.length ? readMap(debriefKey(p.agent.id))[list[0].id] : null;
    return sectionEl(t("syn.pp"), list?.length ? t("syn.ppSummary", { n: list.length, w: wins }) : null,
      note ? el("blockquote", { class: "syn-debrief" }, el("small", {}, t(note.tee ? "syn.debriefTee" : "syn.debrief")), note.text) : null,
      list?.length
        ? el("ul", { class: "syn-list" }, list.slice(0, 5).map((r) => el("li", { class: `o-${String(r.outcome).toLowerCase()}` },
          el("b", {}, missionName(r)), el("span", { class: "syn-o" }, outcomeName(r)), el("time", {}, ctx.ago(new Date(r.createdAt * 1000).toISOString())))))
        : el("p", { class: "muted tiny" }, t("syn.ppEmpty")),
      el("button", { type: "button", class: "btn ghost small", onclick: () => ctx.goSwitchyard() }, t("syn.go")));
  }

  return { enter, left, sync, section, get isOpen() { return open; } };
}
