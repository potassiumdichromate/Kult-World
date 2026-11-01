# Kult World × OKX: AMA script

About 20 minutes of walkthrough, then Q&A. **Bold** lines are actions; the rest
is what to say (adapt freely). The OKX gateway is the heart of the show:
scenes 4 and 5.

Open: `https://world.kult.games`. Everything on screen is live: real sign-in,
real agents and battles, real x402 payments on X Layer.

---

## Before going live (the day before)

Everything in scenes 4 and 5 moves real money, so set it up in advance:

- **Your account:** sign in once, with an AI Arena agent.
- **A game studio:** open the Gaming Studio and register one (Kult Create).
  Give it credits for at least one Pro build (40).
- **A sports agency:** open the Sports Agency and start one (Kult Sports), hire
  analysts, link your Hello Mind (Your Mind) and create a **director key**.
- **An OKX.AI agent you own** for each business you will link, created with
  Onchain OS (`onchainos agent create --role asp ...`). Link the studio ahead
  of time; keep the agency to link on stage.
- **USD₮0 on X Layer** in the wallet you sign in with: about 6 USDT covers one
  analysis and one game build.
- **Warm up the games:** play one Warzone match; the Unity game downloads once
  (about 40 seconds), then the browser caches it.
- On the day: one tab, sound on, browser zoom 100%, this script on a second
  screen.

**If asked what's live:** all of it. The Deal Room is the one labeled preview;
everything else runs on the production backends.

---

## 1. Welcome to Kult World (2 min)

**Show the landing page.**

> Welcome to Kult World. This is where every KULT product lives in one place:
> a 3D floating city where your AI agent lives, battles, runs businesses and
> does business with other agents.

**Click Enter Kult World → sign in.**

> One KULT account for everything: the same sign-in as AI Arena, Kult Create
> and Kult Sports.

## 2. Your agent and passport (1 min)

**Press P.**

> This is my agent. Real identity: an INFT on 0G, an ELO rating and rank, wins
> and losses, and eight personality traits that evolve as it fights. $ARENA in
> its wallet, Kult Points on my profile, and my recent battles.

## 3. Businesses your agent runs (3 min)

**Walk into the Gaming Studio.**

> Agents don't just fight here. They run businesses. This is my game studio on
> Kult Create. My agent is the CEO, and the whole team is AI: a producer, a
> designer, artists, an engineer, QA and a playtester.

**Walk into the Sports Agency.**

> And this is my football analysis agency on Kult Sports. Analysts research
> every match, and the CEO makes the call. Real results, a real leaderboard.

> These AI teams are good. Why should only Kult players be able to use them?

## 4. Selling your business on OKX.AI (5 min, the core)

**Press 1, then click "Sell your businesses on OKX.AI".**

> This is the Kult OKX gateway. Any business in Kult World can be linked to an
> OKX.AI identity, and from that moment any OKX user, or any OKX agent, can
> hire its AI team and pay per call in USDT on X Layer.

**Point at the studio you linked yesterday: its OKX.AI agent number, price and
calls served.**

> Now let's put the agency on OKX too.

**In the agency's card, enter your OKX.AI agent ID and click Next.**

> Your OKX.AI agent is an ERC-8004 identity on X Layer. Kult reads the registry
> and asks that agent's wallet to sign once, to prove it's yours. If the agent
> lives in your OKX Agentic Wallet, this is the exact Onchain OS command.

**Sign (connected wallet or the command), paste the director key, click Link.**

> The director key lets the agency's own analysts work on paid calls. Kult
> stores it encrypted.

**Open "Add this service to your OKX.AI listing", then tick "Live on OKX.AI".**

> One command adds the endpoint to my OKX.AI listing, and OKX reviews it like
> any other service. The buyer pays my wallet directly, and only for work
> that was delivered.

## 5. Hiring a Kult business as an OKX user (5 min, the core)

**Close the panel, press 4. The OKX gateway tab opens.**

> Now I'm on the other side: an OKX user, or an OKX agent, that needs
> something done. This is every Kult business live on OKX.AI.

**Hire your agency. Pick a match. Click Pay and run.**

> This is exactly what an agent on OKX does. Watch the protocol log.

**When the 402 appears:**

> First call: HTTP 402, Payment Required, with the price, the token, USD₮0,
> the network, X Layer, and the owner's wallet.

**Approve the payment.**

> My wallet signs a payment authorization for exactly that amount to exactly
> that wallet. That's x402.

**When the analysis appears:**

> The call goes again with the payment. OKX verifies it, the analysts work, and
> I get the analysis: every analyst's read, the CEO's call, score, corners,
> cards and scorer, and a receipt with the settlement on X Layer.

**Back → hire your studio. Type a brief → Pay → Approve.**

> A game takes longer. The endpoint says 202, Accepted, with a job link. The
> payment is verified now and settled only when the game is delivered. If the
> build fails, I'm never charged.

(A Pro build takes a few minutes. Keep talking, or go to scene 6 and come back.)

## 6. Agents hiring agents (2 min)

**Marketplace → A2A jobs. Open a job you posted.**

> Agents also hire each other for training work. A trainer agent proposes, both
> agents sign the agreement, I fund escrow in USDC on Base, an independent
> verifier measures the result, and the escrow pays out on its own.

## 7. The Game Hub (1 min, optional)

**Press 2, pick Warzone Warriors.**

> And of course, the agents fight. Matchmaking finds an opponent of my level,
> the battle plays out, ELO moves, and 0G Compute writes the commentary.

## 8. Close (1 min)

> That's Kult World: your agent, its businesses, and through OKX, a gateway
> that lets anyone on OKX.AI hire those businesses' AI teams. OKX gives us the
> identity layer, ERC-8004 on X Layer; the payment rail, x402 in USDT; and the
> marketplace where people find them. Kult gives the AI teams and the world
> they live in.

---

## Q&A cheat sheet

**Is this live?** Yes. Sign-in, agents, battles, businesses and the OKX
gateway all run on the production backends. The Deal Room is a labeled
preview.

**Who gets paid?** The business owner, directly. The buyer's signed payment
names the owner's wallet; Kult never holds the funds.

**What if the work fails?** The payment is verified first and settled only
after delivery. A failed job is never charged.

**What do I need to list my business?** An OKX.AI agent (ERC-8004 on X Layer,
created with Onchain OS), a Kult World business, one signature to link them
(plus a director key for an agency), and one command to add the endpoint to
your OKX.AI listing.

**Which chains?** Identity and payments on X Layer (USD₮0). Agents and their
INFTs on 0G. The A2A escrow runs on Base.

**What's A2MCP vs A2A?** A2MCP is pay-per-call: fixed price, instant. A2A is
negotiated work with escrow. The gateway is A2MCP; the agent job board is the
negotiated side.

**Can OKX agents call it without a Kult account?** Yes. The endpoint only needs
an x402 payment.

**What's next?** More business types (DEX trading, film production), and A2A
jobs on OKX.AI once we're whitelisted.
