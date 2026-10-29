// Privy login for Kult World: the same KULT Privy app as AI Arena, Kult Create
// and Kult Sports (Google, email or a wallet; every account gets an embedded
// EVM wallet). Kult World is plain JavaScript, so this small React island is
// built separately (npm run build → public/privy/kult-privy.js) and exposes:
//
//   const privy = await init({ appId, clientId })
//   privy.authenticated            boolean, kept current
//   privy.onChange(fn)             called when sign-in state or wallets change
//   await privy.login()            opens the Privy modal; resolves when signed in
//   await privy.tokens()           { accessToken, identityToken }
//   privy.user()                   { id, email, wallets: [{ address, type }] }
//   await privy.signMessage(addr, message)                personal_sign
//   await privy.signTypedData(addr, chainId, typedData)   eth_signTypedData_v4
//   await privy.logout()
//
// Signing switches the wallet to the chain the signature is for (Base for A2A
// escrow, X Layer for OKX x402): a signature for the wrong domain is valid but
// useless, so the island never signs on whatever chain happens to be active.

import { createElement as h, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider, usePrivy, useLogin, useWallets, getAccessToken, getIdentityToken } from "@privy-io/react-auth";
import { defineChain } from "viem";
import { mainnet, base } from "viem/chains";

const zeroGMainnet = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
  blockExplorers: { default: { name: "0G Chainscan", url: "https://chainscan.0g.ai" } }
});

const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
  blockExplorers: { default: { name: "OKLink", url: "https://www.oklink.com/xlayer" } }
});

const WALLET_LIST = [
  "okx_wallet", "metamask", "bitget_wallet", "coinbase_wallet", "binance", "bybit_wallet", "kraken_wallet",
  "cryptocom", "uniswap", "rainbow", "zerion", "safe", "base_account", "robinhood_wallet", "universal_profile",
  "detected_ethereum_wallets", "wallet_connect"
];

// Privy verifies wallet sign-in on auth.privy.io, which rejects 0G's chain id,
// so sign-in happens on Ethereum and signatures switch chain as needed.
const privyConfig = {
  loginMethods: ["google", "email", "wallet"],
  defaultChain: mainnet,
  supportedChains: [mainnet, zeroGMainnet, base, xLayer],
  embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
  appearance: {
    theme: "dark",
    accentColor: "#FF4FA3",
    landingHeader: "Sign in to Kult World",
    loginMessage: "Use your KULT account from AI Arena, Kult Create and Kult Sports.",
    showWalletLoginFirst: false,
    walletChainType: "ethereum-only",
    walletList: WALLET_LIST
  }
};

const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out`)), ms))]);

export function init({ appId, clientId }) {
  return new Promise((resolveReady) => {
    const api = { authenticated: false };
    const listeners = new Set();
    let pendingLogin = null;
    let privyLogout = null;
    let openLogin = null;
    let privyUser = null;
    let wallets = [];

    function Bridge() {
      const { ready, authenticated, logout, user } = usePrivy();
      const { wallets: connected } = useWallets();
      const { login } = useLogin({
        onComplete: () => { pendingLogin?.resolve(); pendingLogin = null; },
        onError: (error) => { pendingLogin?.reject(new Error(String(error || "closed"))); pendingLogin = null; }
      });
      const announced = useRef(false);
      privyLogout = logout;
      openLogin = login;
      privyUser = user;
      wallets = connected;
      api.authenticated = authenticated;
      useEffect(() => {
        if (ready && !announced.current) { announced.current = true; resolveReady(api); }
      }, [ready]);
      useEffect(() => { for (const fn of listeners) fn(api); }, [authenticated, connected.length, user?.id]);
      return null;
    }

    const walletFor = (address) => {
      const w = wallets.find((x) => x.address.toLowerCase() === String(address).toLowerCase());
      if (!w) throw new Error(`Wallet ${address} is not connected. Reconnect it in the sign-in window.`);
      return w;
    };

    api.onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
    api.login = () => {
      if (api.authenticated) return Promise.resolve();
      return new Promise((resolve, reject) => { pendingLogin = { resolve, reject }; openLogin(); });
    };
    api.tokens = async () => {
      const [accessToken, identityToken] = await Promise.all([
        withTimeout(getAccessToken(), 8000, "Privy access token"),
        withTimeout(getIdentityToken(), 8000, "Privy identity token")
      ]);
      if (!accessToken && !identityToken) throw new Error("Privy returned no session. Sign in again.");
      return { accessToken: accessToken || undefined, identityToken: identityToken || undefined };
    };
    api.user = () => ({
      id: privyUser?.id ?? null,
      email: privyUser?.email?.address ?? privyUser?.google?.email ?? null,
      wallets: wallets.map((w) => ({ address: w.address, type: w.walletClientType === "privy" ? "embedded" : w.walletClientType }))
    });
    api.signMessage = async (address, message) => {
      const provider = await walletFor(address).getEthereumProvider();
      return provider.request({ method: "personal_sign", params: [message, address] });
    };
    api.signTypedData = async (address, chainId, typedData) => {
      const w = walletFor(address);
      await w.switchChain(chainId);
      const provider = await w.getEthereumProvider();
      return provider.request({ method: "eth_signTypedData_v4", params: [address, JSON.stringify(typedData)] });
    };
    api.logout = async () => { await privyLogout?.(); };

    const host = document.createElement("div");
    host.id = "kult-privy-root";
    document.body.append(host);
    createRoot(host).render(h(PrivyProvider, { appId, clientId, config: privyConfig }, h(Bridge)));
  });
}
