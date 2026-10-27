# Kult World: 3D model list

Kult World is now a real-time 3D isometric city (three.js). Every object is a
named **slot**. Today each slot is a stylized placeholder built in code; when
you deliver a `.glb` for a slot, it replaces the placeholder automatically, with
no code changes.

## Art direction: "Neon Dusk"

A floating city island at twilight, seen from a fixed isometric camera.

- **Shapes:** stylized low-poly, chunky and readable from far away. Bevels and
  clear silhouettes, not realism.
- **Palette:** deep violet base (`#1b1838`, `#2a1650`) with three neon accents:
  pink `#ff4fa3`, cyan `#4fd8ff`, gold `#ffc94d`. Grass is teal-green
  (`#2d7a5c`), paving is lavender stone (`#5d5592`).
- **Light:** warm sunset key light from the north-west, cool cyan rim light,
  bloom on anything emissive. **Neon, windows, signs and screens must be
  emissive** (emissive texture or emissive material) so they glow.
- **Mood references:** Monument Valley's clean shapes, Cyberpunk neon, Animal
  Crossing's toy-like scale.

## Technical spec (all models)

| | |
|---|---|
| Format | glTF binary `.glb`, Y-up, metallic-roughness PBR |
| Scale | 1 unit = 1 m. **1 map tile = 2 m.** The game also auto-fits each model to its slot, so exact scale is forgiving |
| Pivot | Bottom centre of the footprint, sitting on y = 0 |
| Facing | The **front / entrance faces +Z** (toward the camera, south) |
| Textures | Up to 2048² for buildings, 1024² for props and characters. Embedded in the `.glb` |
| Compression | None for now (no Draco). Tell me if you want Draco or Meshopt and I'll enable it |
| Animation | Any animation clips inside a `.glb` play on loop (spinning crystals, chasing bulbs, swaying trees). Characters: see below |

**Delivery:** put files in `Desktop/Assets/Kult-World/3d/` named exactly as
below. I'll copy them into `public/models/` and register them in
`public/models/manifest.json`.

## P1: hero models (biggest visual impact)

| # | File | What | Footprint (tiles → metres) | Height | Tris |
|---|---|---|---|---|---|
| 1 | `bld-business-park.glb` | **Kult Business Park HQ.** A sleek glass office tower on a podium, gold entrance canopy, warm and cyan lit windows, gold neon trim, a rooftop billboard panel for "KULT BUSINESS PARK" | 9 × 8 → 18 × 16 m | ~22 m to the top of the sign | 15–35k |
| 2 | `bld-arcade.glb` | **Kult Arcade.** A retro-futurist arcade hall: marquee bulbs along the roofline, an arched neon entrance (front, slightly left of centre), round neon porthole windows, a giant arcade joystick on the roof, a rooftop "KULT ARCADE" sign | 9 × 9 → 18 × 18 m | ~13 m | 15–30k |
| 3–8 | `agent-berserker.glb`, `agent-tactician.glb`, `agent-defender.glb`, `agent-assassin.glb`, `agent-support.glb`, `agent-hybrid.glb` | **The six AI Arena archetypes as rigged 3D characters.** Stylized chibi or anime proportions matching the AI Arena portraits, each with its archetype colour | 0.9 × 0.9 tiles | ~2.3 m (auto-scaled) | 8–15k each |
| 9 | `fountain.glb` | **KULT crystal fountain**, the centrepiece of the plaza: round stone basin with glowing water, a floating pink KULT crystal with orbiting shards. Bake the crystal spin and bob as an animation | 4.4 × 4.4 → ~9 m across | ~6 m | 5–10k |

**Character rig requirements (3–8):**
- **Rig:** a humanoid skeleton (a Mixamo rig is ideal).
- **Animation clips, embedded, with these names:** `Idle`, `Walking`, `Running`, `Wave`, `Dance` (victory) and `Defeat`. Any clip whose name *contains* "idle", "walk" or "run" is picked up automatically.
- **Single-model option:** if you only make one character, name it `agent.glb`. It will be tinted per archetype.

## P2: city kit (props and environment)

| # | File | What | Footprint | Height | Tris |
|---|---|---|---|---|---|
| 10 | `spawn-pad.glb` | Hexagonal teleport pad with a glowing ring (emissive) | 2.4 × 2.4 | 0.4 m | 2k |
| 11 | `tree.glb` | Round stylized tree, teal-green low-poly canopy | 1.6 × 1.6 | 4 m | 1–2k |
| 12 | `pine.glb` | Stylized pine | 1.4 × 1.4 | 5 m | 1–2k |
| 13 | `blossom.glb` | Neon blossom tree, pink canopy with a faint glow (the signature tree of the plaza) | 2 × 2 | 4.6 m | 1–2k |
| 14 | `bush.glb` | Bush | 1.2 × 1.2 | 1.2 m | <1k |
| 15 | `flowers.glb` | Small flower bed with glowing pink, cyan and gold flowers | 1.2 × 1.2 | 0.5 m | <1k |
| 16 | `lamp.glb` | Futuristic street lamp, a single arm with an emissive light capsule | 0.5 × 0.5 | 4.4 m | <1k |
| 17 | `bench.glb` | Park bench | 1.4 × 0.6 | 0.9 m | <1k |
| 18 | `billboard.glb` | Holographic billboard on two posts. Leave the screen as a **separate mesh named `Screen`** so I can play ads on it | 4 × 0.6 | 7 m | 2k |
| 19 | `car.glb` | Hover car (parked and flying traffic), with emissive under-glow and tail lights | 1.8 × 0.9 | 0.9 m | 2–4k |
| 20 | `crane.glb` | Construction tower crane (the New District) | 2 × 2 | 20 m | 2–4k |

## P3: "coming soon" buildings

| # | File | What | Footprint | Height |
|---|---|---|---|---|
| 21 | `holo-dex.glb` | **Kult Dex tower**, a trading tower with stock-chart and coin motifs | 6 × 6 | ~22 m |
| 22 | `holo-production.glb` | **Kult Production studio**, a film studio with a sound-stage roof, spotlights and a marquee | 6 × 7 | ~15 m |

These show as **holograms** (wireframe and glow) until each business launches.
Model them as normal, finished buildings: the same file becomes the real
building on launch day.

## Optional

- **Skyline islands:** 2–3 small floating islands with tower silhouettes for
  the background, each as one `.glb` (I'll scatter them).
- **Landing hero render:** one high-quality render of the whole island, used
  as the share image and loading screen (1920 × 1080).

## 2D art to redo in the new 3D style

The UI is now glass and 3D. These 2D images were made for the pixel version,
so they should be re-rendered to match (same file names in
`Desktop/Assets/Kult-World/`, I'll re-import):

| What | Files | Notes |
|---|---|---|
| Business card art | `card-create.png`, `card-sports.png`, `card-dex.png`, `card-production.png` | 3D-rendered isometric rooms on a transparent background, 1536 × 1024. Ideal: renders of the real building interiors |
| Game thumbnails | `thumb-warzone.png`, `thumb-robowars.png`, `thumb-wave.png`, `thumb-highway.png` | 16:9, 1536 × 864, 3D-rendered key art. Wave needs its own image |
| Token icons | `tokens.png` (same 3 × 2 sheet: $ARENA, KP, KULT, XP, ELO, quest) | Glossy 3D-rendered icons on transparency |
| Passport stamps | `stamps.png` (same 3 × 2 sheet) | Embossed holographic stamps |
| Logo | `logo-kult-world.png` | Optional 3D chrome and neon logo. The landing currently uses a live CSS logo |

## Where the placeholder comes from

- **Characters:** three.js's CC0 "RobotExpressive" model, tinted per
  archetype.
- **Everything else:** built from simple shapes in `public/js/models.js`.
  Slot names, sizes and heights are in `SLOTS` at the top of that file.
- **Arcade games:** the four arcade mini-games are still 2D stand-ins, until
  the real games plug into the monitor.
