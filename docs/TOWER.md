# KULT Agent Tower in Kult World

[KULT Agent Tower](https://github.com/potassiumdichromate/Kult-Tower) is a
management game: the player's Agent directs a tower of rooms, three crew
Agents take client contracts, and each 60-minute shift ends with a report and
two client offers. Every finished shift leaves a signed receipt. Kult World
hosts it as an experience of its own.

## In the city

- The **Agent Tower** district sits on the avenue between Kult Plaza and the
  Financial Quarter. Its building is a Meshy model
  (`public/models/bld-agent-tower.glb`, slot `bld-agent-tower`, with the
  procedural `agentTower()` in `public/js/models.js` as the fallback) and a
  lit forecourt in front of its door.
- The dock has a **Tower** button (key **8**), and it's in the menu. The tower
  has a passport stamp.
- Walking in (or the dock button) opens the tower full screen, directed by
  the player's own AI Arena Agent: its name, portrait and archetype show as
  the Director, and it narrates the first-visit tour.
- Back in the city, the Passport's **Agent Tower record** lists the Agent's
  verified shifts. Each new receipt gets a 0G Compute debrief (AI Arena's
  TEE-verified commentary) and is written to the Agent's **0G memory**
  (`POST /v1/memory/:agentId/memory/episode`). Receipts never change XP, ELO
  or balances.

## How it's connected

The tower only allows same-origin embedding, so Kult World serves it from its
own origin. `tower/tower.mjs` is the server side; `public/js/tower.js` the
client side.

| Route | What it does |
|---|---|
| `/world/tower/*` | Proxied to `TOWER_URL` with the path kept (cookies, CSRF and Origin pass through). `/world/tower/api/service/*` is blocked (404). |
| `POST /api/tower/launch` | `{ agentId }` with the player's AI Arena token. AI Arena must list the Agent in the player's `GET /v1/agents/mine`. Answers a signed, single-use, 90-second launch link. |
| `GET /api/tower/record?agentId=` | The Agent's newest 50 shift receipts (the same ownership check). Read from the tower with the result secret, and each one's signature, owner and version checked. |

The tower save belongs to `kult:agent:<AI Arena Agent id>`, so each Agent runs
its own tower. The frame reads `window.KultWorldBridge` (the same profile
Syndicates uses) for the Director's look, and only when its Agent id matches
the signed session.

## Settings (Kult World)

| Env var | Value |
|---|---|
| `TOWER_URL` | The tower service, e.g. `https://kult-agent-tower.onrender.com`. Unset turns the tower off. |
| `KULT_WORLD_ORIGIN` | `https://world.kult.games`, used in launch links. |
| `TOWER_LAUNCH_SECRET` | 32+ random characters; the same as the tower's `KULT_TOWER_SECRET`. |
| `TOWER_RESULT_SECRET` | 32+ random characters; the same as the tower's `KULT_TOWER_RESULT_SECRET`. |

## Deploying

1. Deploy Kult-Tower with its `render.yaml` (hosted mode, `/data` disk,
   `KULT_TOWER_BASE_PATH=/world/tower`). Set its two secrets.
2. Set `TOWER_URL` and the two matching secrets on Kult World and redeploy.
3. Open `https://world.kult.games/world/tower/api/health`: it should report
   `"mode": "hosted"` and `"basePath": "/world/tower"`.
4. In Kult World walk into the tower, play a shift to its report and come
   back. The Passport shows the shift.

In demo mode (`?demo=1`) the Passport shows two sample shifts, and the tower
opens without a launch ticket. A tower in hosted mode refuses that ("Launch
from KULT World to play"), so the demo needs a tower running with
`KULT_TOWER_DEMO=1`.
