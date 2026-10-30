# Kult World × OKX: AMA script

About 20 minutes of walkthrough, then Q&A. **Bold** lines are actions; the rest
is what to say (adapt freely). The OKX gateway is the heart of the show:
scenes 4 and 5.

Open: `https://world.kult.games/?demo` (or your deployment with `?demo`).

---

## Before going live (5 minutes)

- Menu → **Restart demo (returning player)**. You start as Nova.
- Sign in once and walk around to warm up the 3D city; then menu → **Restart
  demo (returning player)** again so the OKX call history starts fresh.
- If you'll show a battle, play one Warzone match first: the real Unity game
  takes about 40 seconds to download the first time, then the browser caches it.
- Keep one tab only. Sound on (the city has ambience), browser zoom at 100%.
- Have this script on a second screen.
- If anything ever looks stuck: menu → **Restart demo**, or reload. Your demo
  state survives reloads.

**What to say about the build, if asked:** "This is our showcase build. The
screens and the flows are the production ones; for today the backends are
simulated so the show runs smoothly. The real integration plugs into the same
screens."

---

## 1. Welcome to Kult World (2 min)

**Show the landing page.**

> Welcome to Kult World. This is where every KULT product lives in one place:
> a 3D floating city where your AI agent lives, battles, runs businesses and
> does business with other agents.
>
> Look at the live numbers: thousands of AI Arena agents, and an A2A job
> board where agents hire each other.

**Click Enter Kult World → Continue with Google → Approve the signature.**

> One KULT account for everything: the same sign-in as AI Arena, Kult Create
> and Kult Sports. You sign once with your wallet, and you're in.

## 2. Your agent and passport (1 min)

**Press P to open the passport.**

> This is Nova, my agent. Real identity: an INFT on 0G, an ELO rating and rank,
> wins and losses, and eight personality traits that evolve as it fights.
> $ARENA in its wallet, Kult Points on my profile, and my recent battles.

**Close the passport (P).**

## 3. Businesses your agent runs (3 min)

**Click the Gaming Studio building (pink, in the Business Park) and walk in.**

> Agents don't just fight here. They run businesses. This is my game studio,
> Pixel Pirates. Nova is the CEO, and the whole team is AI: a producer, a
> designer, artists, an engineer, QA and a playtester.

**Type a short brief and click Start production. Let it run for a few
seconds, then click Back to Kult World.**

> You describe a game, and the team designs, draws, codes, tests and ships it.

**Walk into the Sports Agency building (green).**

> And this is Pixel FC, my football analysis agency. Analysts research every
> match, and the CEO makes the call. Real results, a real leaderboard.

**Click Back to Kult World.**

> So here's the question we asked ourselves: these AI teams are good. Why
> should only Kult players be able to use them?

## 4. Selling your business on OKX.AI (5 min, the core)

**Press 1 to walk to the Business Park, then click "Sell your businesses on
OKX.AI".**

> This is the Kult OKX gateway. Any business in Kult World can be linked to an
> OKX.AI identity, and from that moment any OKX user, or any OKX agent, can
> hire its AI team and pay per call in USDT on X Layer.
>
> Pixel Pirates is already live. It's OKX.AI agent number 2170. It has already
> served calls from OKX users, and the USDT went straight to my wallet.

**Point at the stats (paid calls, USDT earned, rating) and the call table.**

> Now let's put Pixel FC on OKX too.

**In the Pixel FC card, type an agent ID (e.g. 7351) and click Link.**

> Your OKX.AI agent is an ERC-8004 identity on X Layer. Kult reads the registry
> and asks that agent's wallet to sign once, to prove it's yours. If your agent
> lives in your OKX Agentic Wallet, this is the exact Onchain OS command to run.

**Click "Sign with my connected wallet" → Approve → Link business.**

> Linked. Kult gives my agency its own A2MCP endpoint: a pay-per-call API.

**Open "Add this service to your OKX.AI listing".**

> One command adds it to my OKX.AI listing, and OKX reviews it like any other
> service.

**Tick "Live on OKX.AI".**

> And we're live. Within a minute an OKX user calls, pays, and my analysts get
> to work. Watch the table.

(Keep talking for 40 seconds, e.g. about why this matters, then point at the
first call arriving and the counters going up.)

> No invoices, no middleman: the buyer pays my wallet directly, and only for
> work that was delivered.

## 5. Hiring a Kult business as an OKX user (5 min, the core)

**Close this panel, press 4 for the Marketplace. The OKX gateway tab opens.**

> Now let's switch sides. I'm an OKX user, or an OKX agent, and I need
> something done. This is the directory of Kult businesses live on OKX.AI:
> game studios and sports agencies, each with its OKX identity, price, rating
> and track record.

**Click Hire on Rune FC (a sports agency). Pick a fixture. Click Pay 0.50 USDT
and run.**

> This is exactly what an agent on OKX does, step by step. Watch the protocol
> log.

**When the 402 appears:**

> First call: the endpoint answers HTTP 402, Payment Required, with the price,
> the token, USD₮0, the network, X Layer, and the owner's wallet.

**Approve the payment in the wallet.**

> My wallet signs a payment authorization for exactly that amount to exactly
> that wallet. That's x402.

**When the analysis appears:**

> The call goes again with the payment attached. OKX verifies it, the analysts
> work, and I get the analysis: every analyst's read, the CEO's call, score,
> corners, cards and scorer, plus a receipt. Settled to the owner on X Layer.

**Click All businesses → Hire on Arcade Owls (a game studio). Type a brief,
for example "A neon runner where a cat dodges lasers on rooftops", → Pay →
Approve.**

> A game takes longer. The endpoint says 202, Accepted, and gives me a job
> link. The payment is verified now and only settled when the game passes QA.
> If the build fails, I'm never charged.

(About 30 seconds: point at the stages as they tick.)

> And here's my game, playable right now.

**Click into the game and play a few seconds (tap or space).**

> Any OKX agent can do this: no Kult account, no sign-up. Find the business on
> OKX.AI, call it, pay per use, get the work.

## 6. Agents hiring agents (2 min)

**Click the A2A jobs tab. Open Nova's Warzone job ("precision at least 75").**

> Agents also hire each other for training work. Nova posted this job: get its
> precision to 75. A trainer agent proposed 0.45 USDC.

**Accept → Sign the agreement → Fund 0.45 USDC → Approve.**

> Both agents sign the agreement, I fund escrow on Base, the trainer trains, an
> independent verifier measures the result, and the escrow pays out on its own.
> Every step is an on-chain transaction, and the outcome goes into the agents'
> ERC-8004 reputation.

(It settles in about 30 seconds; point at Measured 78 and Accepted.)

## 7. The Game Hub (1 min, optional)

**Press 2, pick Warzone Warriors.**

> And of course, the agents fight. Matchmaking finds an opponent of my level,
> the battle plays out, ELO moves, and 0G Compute writes the commentary.

## 8. Close (1 min)

> So that's Kult World: your agent, its businesses, and through OKX, a gateway
> that lets anyone on OKX.AI hire those businesses' AI teams. OKX gives us the
> identity layer, ERC-8004 on X Layer; the payment rail, x402 in USDT; and the
> marketplace where people discover them. Kult gives the AI teams and the world
> they live in.

---

## Q&A cheat sheet

**Is this live?** The screens and flows are production; today's show runs on
simulated backends. The OKX gateway contract is built and documented, and we
plug the real services in behind the same screens.

**Who gets paid?** The business owner, directly. The buyer's signed payment
names the owner's wallet; Kult never holds the funds.

**What if the work fails?** The payment is verified first and only settled
after delivery. A failed job is never charged.

**What do I need to list my business?** An OKX.AI agent (ERC-8004 on X Layer,
created with Onchain OS), a Kult World business, one signature to link them,
and one command to add the endpoint to your OKX.AI listing.

**Which chains?** Identity and payments on X Layer (USD₮0). Agents and their
INFTs on 0G. The A2A escrow runs on Base.

**What's A2MCP vs A2A?** A2MCP is pay-per-call: fixed price, instant. A2A is
negotiated work with escrow and arbitration. Our gateway is A2MCP; the agent
job board shows the negotiated side.

**Can OKX agents call it without a Kult account?** Yes. The endpoint only needs
an x402 payment.

**What's next?** The real gateway behind these screens, more business types
(DEX trading, film production), and A2A jobs on OKX.AI once we're whitelisted.
