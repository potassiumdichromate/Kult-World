// Demo stand-in for the Privy island (privy-login/main.js): same interface,
// a look-alike sign-in sheet, and a wallet that asks before it signs, like
// Privy's embedded wallet. Signatures are placeholders; the simulated
// backends (mock-api.js) accept them.

const KEY = "kw.demo.privy.v1";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const write = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch { /* optional */ } };
export const DEMO_WALLET = "0x6b0e2f4a9c71d35e8b14f02a7c9d6e3b5a1f8c42";
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
const CHAINS = { 1: "Ethereum", 196: "X Layer", 8453: "Base", 16661: "0G" };

function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}

function sheet(...kids) {
  const wrap = h("div", { class: "overlay demo-privy" }, h("div", { class: "sheet glass narrow" }, ...kids));
  document.body.append(wrap);
  return wrap;
}

export async function init() {
  let state = read();
  const listeners = new Set();
  const api = { authenticated: Boolean(state) };
  const emit = () => { api.authenticated = Boolean(state); for (const fn of listeners) fn(api); };

  api.onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  api.login = () => {
    if (state) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const status = h("p", { class: "muted small", hidden: "" });
      const email = h("input", { type: "email", placeholder: "your@email.com", class: "demo-input" });
      const done = (method, who) => {
        status.hidden = false; status.textContent = `Signing in with ${method}…`;
        for (const b of wrap.querySelectorAll("button")) b.disabled = true;
        setTimeout(() => { state = { method, email: who || null, at: Date.now() }; write(state); wrap.remove(); emit(); resolve(); }, 900);
      };
      const wrap = sheet(
        h("button", { type: "button", class: "close", "aria-label": "Close", onclick: () => { wrap.remove(); reject(new Error("closed")); } }, "×"),
        h("h2", {}, "Sign in to Kult World"),
        h("p", { class: "muted small" }, "Use your KULT account from AI Arena, Kult Create and Kult Sports."),
        h("div", { class: "demo-email" }, email, h("button", { type: "button", class: "btn small", onclick: () => done("email", email.value.trim() || "player@kult.world") }, "Submit")),
        h("div", { class: "login-opts" },
          h("button", { type: "button", class: "login-opt", onclick: () => done("Google", "player@gmail.com") }, h("span", {}, "Continue with Google")),
          h("button", { type: "button", class: "login-opt", onclick: () => done("wallet", null) }, h("span", {}, "Continue with a wallet"))),
        status,
        h("p", { class: "muted tiny" }, "Demo sign-in. In production this is the shared KULT Privy app."));
    });
  };
  api.tokens = async () => {
    if (!state) throw new Error("Not signed in");
    return { accessToken: `demo-privy.${hex(16)}`, identityToken: `demo-id.${hex(16)}` };
  };
  api.user = () => ({ id: state ? "did:privy:demo" : null, email: state?.email ?? null, wallets: state ? [{ address: DEMO_WALLET, type: "embedded" }] : [] });

  // The wallet asks before it signs, as Privy's embedded wallet does.
  const confirm = (title, rows) => new Promise((resolve, reject) => {
    const wrap = sheet(
      h("h2", {}, title),
      h("dl", { class: "demo-sign" }, rows.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
      h("div", { class: "demo-actions" },
        h("button", { type: "button", class: "btn ghost small", onclick: () => { wrap.remove(); reject(new Error("closed: the signature was declined")); } }, "Cancel"),
        h("button", { type: "button", class: "btn primary small", onclick: () => { wrap.remove(); resolve(); } }, "Approve")),
      h("p", { class: "muted tiny" }, "Kult wallet · demo"));
  });
  api.signMessage = async (address, message) => {
    await confirm("Signature request", [["Wallet", address], ["Message", String(message).slice(0, 220)]]);
    return `0x${hex(65)}`;
  };
  api.signTypedData = async (address, chainId, typedData) => {
    const m = typedData.message || {};
    const amount = m.value ? `${(Number(m.value) / 1e6).toFixed(2)} ${typedData.domain?.name || ""}` : "";
    await confirm("Approve payment", [
      ["Network", CHAINS[chainId] || `chain ${chainId}`], ["From", address], ...(m.to ? [["To", m.to]] : []),
      ...(amount ? [["Amount", amount]] : []), ["Type", typedData.primaryType]
    ]);
    return `0x${hex(65)}`;
  };
  api.logout = async () => { state = null; write(null); emit(); };
  return api;
}
