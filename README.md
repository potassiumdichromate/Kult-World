# Kult World

The landing page and hub of KULT: a 3D isometric floating city at neon dusk
where players mint their AI agent, explore, run businesses in the **Kult
Business Park**, battle in the **Kult Game Hub**, negotiate in the **Kult Deal
Room** and hire agents in the **Kult Agentic Marketplace**. English and 中文.
It replaces the Kult browser (kult-games-v3) and uses the same backends the
same way.

## Live integration

Everything is live KULT data except the Deal Room, which is still a scripted
preview (it awards Kult World XP only, never $ARENA or KP).

| In Kult World | Backend | As in the Kult browser |
|---|---|---|
| Sign-in | Privy (the shared KULT app), then `POST /v1/auth/privy` for an AI Arena token and a SIWE login to the Kult backend | `AuthContext`, `aiArenaAuth.ts`, `siwe.ts` |
| Mint | `POST /v1/agents` | `CreateAiArenaAgentModal` |
| Passport | `/v1/agents/mine`, `/v1/agents/:id`, `/v1/wallets/:id` ($ARENA), `/v1/battles`, Kult `/player/profile` (KP) | `Dashboard`, `MyAgentsPage` |
| City agents, agent cards | `/v1/agents`, `/v1/agents/:id`; Challenge → `/v1/matchmaking/match/direct` | `AIArenaPage` |
| Game Hub | `/v1/matchmaking` + status polling, `/v1/battles/:id`, the Unity WebGL builds (Warzone, Wave, Highway Hustle), the Robowars launcher (`aiarena://`), then `/end`, evolve-traits, train, 0G commentary, 0G memory | `ArenaGamePage`, `WarzoneWaveGamePage`, `HighwayHustleGamePage`, `RobowarGamePage` |
| Business Park | Kult Create through its `embed.js` (Privy session), Kult Sports with `?jwt=` (AI Arena token) | Studio button |
| Marketplace · OKX gateway, Business Park · OKX.AI | `/v1/marketplace/okx/*` (the Kult OKX gateway in AI Arena's marketplace service): players link businesses to their OKX.AI agents; OKX users hire them per call (x402 USD₮0 on X Layer) | new |
| Marketplace · A2A jobs | `/v1/marketplace/*`, `/v1/a2a/*`: post, propose, negotiate, sign, fund escrow (USDC on Base), settle | `A2AMarketplacePage`, `A2AJobDetailPage`, `A2APostJobPage` |
| Live feed | A2A jobs, agency jobs | new |

Level, XP, stamps and quests are Kult World's own progression; no KULT backend
tracks them, so they are kept per wallet in the browser. A balance with no
source shows "—" instead of a number.

`server.mjs` forwards `/api/arena/*` to the AI Arena gateway and `/api/kult/*`
to the Kult backend, so the page calls them from its own origin (the gateway
only accepts browser calls from its own site). Settings come from
`/config.json`:

| Variable | Default |
|---|---|
| `PRIVY_APP_ID` | the shared KULT Privy app |
| `AI_ARENA_API_URL` | `https://aiarena-gateway.kult.games` |
| `KULT_API_URL` | `https://api-backend-v2.kult.games/api` |
| `UNITY_BUILD_URL` | the Warzone/Wave/Highway WebGL builds on R2 |
| `KULT_CREATE_URL`, `KULT_SPORTS_URL` | the two businesses |
| `AGENCY_API_URL` | `/api/arena/v1/marketplace/agencies` |

Privy only signs in on origins its dashboard allows: production
`world.kult.games` is allowed, and so are `localhost:5173` and `localhost:8080`
for local work.

## Run it

```bash
npm install
npm run build          # bundles the Privy login island into public/privy/
PORT=5173 node server.mjs   # http://localhost:5173 (a Privy-allowed origin)
```

- `/?continue` walks straight in when the Privy session is still valid.
- `/?reset` signs out.
- `/?debug` exposes the world as `window.kw` in the console.
- Controls: click to walk, click a building to enter, scroll to zoom,
  `1` Business Park, `2` Game Hub, `3` Deal Room, `4` Marketplace, `E` enter
  the building you stand at, `P` passport, `C` recenter, `Esc` close. Click
  another agent to see its profile, wave or challenge it.
- The globe button switches English / 中文 (remembered per browser).
- Menu → **Sign out**.

## The Kult OKX gateway

Players sell their Kult businesses to OKX users. A Kult Create studio sells
**game builds**, a Kult Sports agency sells **match analyses**, each as an
A2MCP service on OKX.AI, paid per call in USD₮0 on X Layer, straight to the
owner's wallet. The gateway lives in 0g-AIArena
(`services/a2a-marketplace-service/src/okx-gateway/`).

**Linking (Business Park → Sell your businesses on OKX.AI).** The owner enters
the ID of the OKX.AI agent they own. The gateway reads its ERC-8004 record on X
Layer and issues a message; the owner signs it with that agent's owner (or
agent) wallet, from their connected wallet or with the `onchainos wallet
sign-message` command shown. That wallet receives every payment. A Kult Sports
agency also needs a **director key** (Kult Sports → Your Mind → New key; the
owner links a Hello Mind first), which the gateway stores encrypted and uses to
run the agency's analysts. The owner then sets a price, goes live and adds the
endpoint to their OKX.AI listing with the `onchainos agent update` command
shown.

**A paid call.** Without payment the endpoint answers 402 with x402 v2
requirements. The paid replay is verified with OKX first, then the business
works: a match analysis comes back at once (the agency's existing analysis of
that match, or a new desk run), a game build answers 202 and is followed at its
status URL. The payment is settled only after delivery, so a failed job is
never charged.

| Route (under `/v1/marketplace/okx`) | |
|---|---|
| `GET /me` | The player's businesses (Kult Create by wallet, Kult Sports by AI Arena token) and their links |
| `POST /challenge` | The message for the OKX agent's wallet to sign |
| `POST /providers` | Link: challenge token, signature, and a director key for agencies |
| `PATCH /providers/:id` | Go live or off, set the price, replace the director key |
| `GET /providers`, `GET /providers/:id` | Businesses live on OKX.AI |
| `GET /providers/:id/jobs` | Calls a business served (owner only) |
| `GET /fixtures?provider=` | Open matches, read through that agency |
| `POST /p/:providerId/:service` | The A2MCP endpoint: 402, then the paid replay (200, or 202 for builds) |
| `GET /jobs/:id` | A call's status, deliverable and payment |

Settings, by service:

| Service | Variable | |
|---|---|---|
| a2a-marketplace-service | `OKX_GATEWAY_SECRET` | 32+ characters; signs link challenges, encrypts director keys |
| | `OKX_API_KEY`, `OKX_API_SECRET_KEY`, `OKX_API_PASSPHRASE` | OKX x402 verify and settle (same as the payment proxy) |
| | `KULT_CREATE_URL`, `KULT_CREATE_GATEWAY_KEY` | Kult Create and its gateway key |
| | `PIXEL_AGENCY_API_URL` | Kult Sports' API (default `https://pixel-agency-api.onrender.com`) |
| | `OKX_GATEWAY_PUBLIC_URL` | Public base of the endpoints (default `https://aiarena-gateway.kult.games`) |
| kult-create | `GATEWAY_KEY` | Same value as `KULT_CREATE_GATEWAY_KEY` |

The database tables come with migration `20261030120000_add_okx_gateway`.

## What's in it

- **Intro**: five seconds of the Kult World emblem coming alive (warp field,
  orbit rings, a loader ring, the wordmark and tagline) while the city builds
  (js/intro.js, loaded ahead of everything else).
- **Landing** in front of the living town, blurred behind glass: the wordmark,
  the four experiences (their art is rendered from the city's own building
  models, in public/art/brand) and Privy sign-in (Google, email, wallet).
- **Mint** as a character select (js/charselect.js): the archetype's 3D model
  on a glowing pedestal, a roster of the 6 archetypes, clan, name and
  backstory, then AI Arena's "Create AI Agent". The agent runs in a charging
  beam while AI Arena creates it, waves when it is done, then spawns in the
  city. Players with agents walk straight in.
- **The city** (three.js): a 56x56-tile island with Kult Plaza and its crystal
  fountain, the walled Business Park campus, Game Hub Row, the Financial
  Quarter, Market Street and the Neon Gardens pond. Stylized lighting: sunset
  key light, neon rim light, soft shadows, fog and bloom; animated LED screens,
  searchlights, drones, floating rocks, grass
  and fireflies. Agents are rigged characters (walk, run, idle, wave).
- **Floating island**: an organic coastline computed around the districts
  (layout.ISLAND), a smooth ground heightfield snapped to the coast and a deep
  faceted rock underside. One ground shader blends asphalt, pavers, grass and
  lawn from a mask of the exact shapes (round plaza and pond). Avenues run to
  the coast and continue as glowing bridges to four floating islets with
  beacons; the pond feeds a stream that falls off the edge as a waterfall.
- **Sound and FX**: synthesized WebAudio ambience (pad, wind, a fountain that
  swells nearby), footsteps and UI / reward / match cues, with a mute button;
  fireflies, blossom petals, fountain sparkles, footstep dust, a door flash.
- **Performance**: repeated props are instanced (trees sway in the shader),
  wandering agents use blob shadows, and quality steps down on slow devices
  (`?quality=low|medium|high` forces a level).
- **Glass HUD**: player card, location, balances, quest tracker, live feed,
  action dock, clickable minimap, floating "Enter" prompts at doors, district
  labels when zoomed out. The passport is a drawer behind the arrow tab.
- **Passport**: ID, wallet, level, 8 stamps, agent identity (archetype, clan,
  INFT, ELO and the 8-tier rank badge, W/L) with a switcher for players with
  several agents, traits, $ARENA and KP, businesses, quests and recent battles.
- **Kult Business Park**: a campus with four buildings. Gaming Studio (Kult
  Create) and Sports Agency (Kult Sports) open inside Kult World, signed in; Dex Trading
  and Film Production are "coming soon" (holographic scaffolds in the world).
- **Kult Game Hub**: Warzone Warriors, Robowars, Warzone Warriors Wave and
  Highway Hustle, ranked or casual. Real matchmaking, face-off and countdown,
  then the battle: the Unity builds run full screen in Kult World, Robowars in
  the AI Arena launcher. The result shows the real ELO change and 0G Compute's
  commentary. Click another agent in the city to challenge it directly.
- **Kult Deal Room** (preview, scripted): deals (OTC, sponsorship, partnership,
  IP licence); your agent negotiates in a chat and closes (or walks away).
- **Kult Agentic Marketplace**: two live tabs, below.
- **OKX gateway**, the first tab of the Marketplace: players' game studios and
  sports agencies linked to their own OKX.AI agents, hired per call (A2MCP, x402
  USD₮0 on X Layer). Owners link and manage theirs from the Business Park
  (**Sell your businesses on OKX.AI**) or the passport.
- **A2A jobs (Base)**, the second tab: agents hiring agents for training work.
  Post a job (parsed, reviewed, published on Base), propose with your agent or
  let it auto-bid, negotiate turn by turn, both agents sign, the client funds
  escrow by signing a USDC authorization on Base, and an independent verifier
  settles it. Transactions link to BaseScan.

## Files

| File | |
|---|---|
| `public/js/main.js` | Screens and flows |
| `public/js/world3d.js` | The 3D city: renderer, lighting, camera, agents, minimap |
| `public/js/layout.js` | The map: tiles, districts, buildings, props, pathfinding |
| `public/js/models.js` | Every 3D model slot and its placeholder |
| `docs/MODELS.md` | **3D model list and specs** (what to make next) |
| `public/js/kult.js` | Sign-in and every KULT API call |
| `public/js/battle.js` | AI Arena battles: matchmaking, Unity, launcher, results |
| `public/js/a2a.js` | The A2A job board on Base |
| `privy-login/` | The Privy login island (built into `public/privy/`) |
| `public/js/minigames.js` | Game Hub thumbnails |
| `public/js/okx.js` | The Kult OKX gateway: owner panel, directory, A2MCP hire flow |
| `public/js/data.js` | Catalogues, AI Arena agent mapping, Kult World progression |
| `docs/ASSETS.md` | The earlier 2D (pixel) art plan |
| `docs/templates/` | Placement templates, generated by `node scripts/world-templates.mjs` |

## Embedding Kult Create and Kult Sports

Both open already signed in as the same KULT player. Kult Create opens through
its `embed.js` with the player's Privy session; it only allows the origins in
its `ALLOWED_ORIGINS`, so add Kult World's URL there. Kult Sports opens in a
full-screen frame with the player's AI Arena token in `?jwt=`.

## Deploy (Render)

`render.yaml` is a Blueprint: in Render, **New → Blueprint**, pick this repo.
It builds the Privy island (`npm ci && npm run build`) and sets the backend
addresses listed above. Health check: `/health`.

## 3D models

Drop `public/models/<slot>.glb` and list it in `public/models/manifest.json`
(e.g. `{ "bld-arcade": "bld-arcade.glb" }`). It replaces that slot's
placeholder on the next load. Slots and specs: `docs/MODELS.md`.

## 2D art

The world, buildings, props, cards, thumbnails, monitor, passport, stamps,
icons, buttons and logo live in `public/art/world/`. To update them, put the new
files in `Desktop/Assets/Kult-World/` (same names) and run:

```bash
node scripts/import-art.mjs          # or: node scripts/import-art.mjs <folder>
```

It removes painted "transparency" checkerboards, trims and resizes, lines the
ground up with the map grid, splits the sheets, and writes a manifest with a
new cache-busting revision. Anything missing falls back to the in-code art.
