# Kult Syndicates in Kult World

[Kult Syndicates](https://github.com/potassiumdichromate/Kult-Syndicate) is the
Switchyard: a district where a player's Agent runs Scout, Negotiation, Defense
and Heist operations, joins a crew, claims territory, duels and takes hired
jobs. Every operation leaves a signed receipt. Kult World hosts it as a
district of its own.

## In the city

- **The Switchyard**, a district in the front-left of the Neon Gardens, has
  the **Kult Syndicates** depot. The depot is a procedural building (`switchyard` in
  `public/js/models.js`, slot `bld-syndicate`): a sawtooth warehouse, a lit
  freight door, track, containers and a signal mast.
- The dock has a **Syndicate** button (key **7**), and it's in the menu. The depot has
  a passport stamp, and city agents visit it and talk about it.
- Walking in opens the Switchyard full screen, signed in as the player's own
  AI Arena Agent.
- Back in the city, the Passport's **Syndicates record** lists the Agent's
  verified operations. Each new receipt is written to the Agent's **0G memory**
  (`POST /v1/memory/:agentId/memory/episode`, as battle results are). As the
  Syndicates contract asks, receipts never change XP, ELO or balances.

## How it's connected

The Switchyard only allows same-origin embedding, so Kult World serves it
from its own origin. `syndicates/syndicates.mjs` implements the World side of
Syndicates' adapter contract. `syndicates/world-adapter.cjs` is Syndicates'
`integration/world-adapter.cjs`, unchanged.

| Route | What it does |
|---|---|
| `/world/syndicates/*` | Proxied to `SYNDICATES_URL` with the path kept (cookies, CSRF and Origin headers pass through). |
| `POST /api/syndicates/launch` | `{ agentId }` with the player's AI Arena token. AI Arena must list the Agent in the player's `GET /v1/agents/mine`. Answers a signed, single-use, 90-second launch link. |
| `POST /api/syndicates/receipt` | The Switchyard's receipt worker delivers here. Checks the delivery HMAC, the Ed25519 signature (the pinned key), the receipt hash and the seed commitment. Stores the receipt per Agent, idempotently, and answers `{ ok: true, receiptId }`. |
| `GET /api/syndicates/record?agentId=` | The owner's Agent's newest 50 receipts (the same ownership check). |

The owner identity in a ticket is `arena:<AI Arena userId>`. Syndicates binds
one Agent per owner and never merges histories.

## Settings (Kult World)

| Env var | Value |
|---|---|
| `SYNDICATES_URL` | The Syndicates service, e.g. `https://kult-syndicates-world.onrender.com`. Unset turns the district off. |
| `KULT_WORLD_ORIGIN` | `https://world.kult.games`, used in launch links. |
| `SYNDICATES_LAUNCH_SECRET` | 32+ random characters; the same as Syndicates' `KULT_SYNDICATES_LAUNCH_SECRET`. |
| `SYNDICATES_CALLBACK_SECRET` | 32+ random characters; the same as Syndicates' `KULT_SYNDICATES_CALLBACK_SECRET`. |
| `SYNDICATES_PUBLIC_KEY` | From `https://world.kult.games/world/syndicates/api/public-key`. |
| `SYNDICATES_STORE` | Where receipts are kept, on a persistent disk: `/var/data/syndicates-receipts.json`. |

## Deploying

1. Deploy Syndicates with Kult-Syndicate's `render.world.yaml`. It runs the game and
   its receipt worker together (`server/serve_world.py`).
2. Set the two shared secrets on both services. Set `SYNDICATES_URL` on Kult World and redeploy.
3. Open `https://world.kult.games/world/syndicates/api/public-key`. Set its
   `publicKey` as `SYNDICATES_PUBLIC_KEY` on Kult World and redeploy.
4. In Kult World, walk into the depot, run a Scout, and come back. The
   Passport shows the receipt within about 15 seconds: the worker delivers every 15 s.

In demo mode (`?demo=1`), the depot opens the Switchyard's own sandbox. The
Passport then shows two sample receipts.
