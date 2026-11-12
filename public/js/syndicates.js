// Kult Syndicates in Kult World: the Switchyard depot opens the Syndicates
// district (served by this site at /world/syndicates/) signed in as the
// player's own Agent. When the player comes back, the Agent's verified
// Syndicates receipts are read, shown in the Passport and written to the
// Agent's 0G memory, once each, the way battle results are. As the
// Syndicates contract asks, receipts never change XP, ELO or balances.
import { config, syndicatesApi, arenaApi, isDemo } from "./kult.js";

const MISSION = { scout: "syn.m.scout", negotiate: "syn.m.negotiate", defend: "syn.m.defend", heist: "syn.m.heist", pvp: "syn.m.pvp", a2a: "syn.m.a2a" };

export function createSyndicates(ctx) {
  const { el, t, toast, sound } = ctx;
  const $ = (id) => document.getElementById(id);
  let open = false, syncing = null;

  const missionName = (r) => t(MISSION[r.missionType] || "syn.m.op");
  const outcomeName = (r) => t(`syn.o.${String(r.outcome || "").toLowerCase()}`);
  const memoryKey = (agentId) => `kw.syn.memory.v1.${agentId}`;
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
        const key = memoryKey(p.agent.id), done = readSet(key);
        for (const r of receipts.filter((x) => !done.has(x.id)).slice(0, 10)) {
          try {
            await arenaApi.storeMemory(p.agent.id, { battleId: `syndicates:${r.id}`, outcome: r.outcome, content: `Kult Syndicates · ${missionName(r)} (${r.domain}) · ${outcomeName(r)} · verified receipt ${r.hash.slice(0, 12)}` });
            done.add(r.id);
          } catch (e) { console.warn("[kult-world] Syndicates memory", e.message); break; }
        }
        writeSet(key, done);
      }
      ctx.onRecord?.();
    })().finally(() => { syncing = null; });
    return syncing;
  }

  /** The Passport's Syndicates section. */
  function section(sectionEl) {
    const p = ctx.player(), list = p?.syndicate;
    const wins = (list || []).filter((r) => r.outcome === "SUCCESS").length;
    return sectionEl(t("syn.pp"), list?.length ? t("syn.ppSummary", { n: list.length, w: wins }) : null,
      list?.length
        ? el("ul", { class: "syn-list" }, list.slice(0, 5).map((r) => el("li", { class: `o-${String(r.outcome).toLowerCase()}` },
          el("b", {}, missionName(r)), el("span", { class: "syn-o" }, outcomeName(r)), el("time", {}, ctx.ago(new Date(r.createdAt * 1000).toISOString())))))
        : el("p", { class: "muted tiny" }, t("syn.ppEmpty")),
      el("button", { type: "button", class: "btn ghost small", onclick: () => ctx.goSwitchyard() }, t("syn.go")));
  }

  return { enter, left, sync, section, get isOpen() { return open; } };
}
