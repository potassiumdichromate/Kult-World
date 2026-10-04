# Kult World: asset requirements and prompts

Everything the Kult World landing needs to look final. The demo runs today with
placeholder art drawn in code (ground, buildings, props, cards); each item below
replaces one of those placeholders. The agents already use the real AI Arena
archetype sprites.

Templates are in [`templates/`](templates/). Attach the **`-guide.png`** version
to ChatGPT; the **`-annotated.png`** version is for you to check placement.
They are generated from the real world layout (`node scripts/world-templates.mjs`),
so painted art lines up 1:1.

**Delivery:** save everything to `Desktop/Assets/kult-world/` with the file names
below (PNG, transparent background unless noted). I'll write the importer that
cuts, scales and wires each file in, as we did for Kult Create.

---

## 1. Style bible

| | |
|---|---|
| **Look** | A cosy, neon-lit pixel-art town at night: the home of KULT. Deep violet sky, warm window light, pink and cyan neon, gold accents. Inviting, premium, readable at a glance; it's the landing page. |
| **Projection** | 2:1 isometric, same as Kult Create (tile 64x32, camera from the front-right). The two visible building walls face down-left and down-right. |
| **Pixels** | Chunky pixels, hard edges, no anti-aliasing, no blur, no painterly gradients. A 1-pixel dark outline (`#0d0820`) on every object. 2-3 flat tones per colour, light from the top-left plus neon glow. |
| **Palette** | Night violet `#0b0717` `#1d1640` `#2c2556` `#3b3170`, grass `#1f4a3c` `#2e6a50`, stone `#443c6a` `#524a7a`, KULT pink `#ff7eb6`, KULT cyan `#5ec8f2`, gold `#f2c14e`, window light `#ffd98a`. |
| **Never** | Text or letters inside the art (signs are drawn live), logos you didn't supply, watermarks, guide lines, drop shadows on the background. |

### Style block (paste first in every ChatGPT chat)

```
You are making game art for "Kult World", an isometric pixel-art town at night (the hub of the KULT games platform).
STYLE (apply to every image in this chat):
- 2:1 isometric pixel art, camera from the front-right, same angle as the attached template.
- Chunky pixels, hard edges, NO anti-aliasing, NO blur, NO gradients except soft neon glow.
- 1-pixel dark outline (#0d0820) on every object. Flat cel shading, 2-3 tones per colour.
- Night palette: deep violet (#0b0717, #1d1640, #3b3170), grass #1f4a3c, stone #443c6a, neon pink #ff7eb6, neon cyan #5ec8f2, gold #f2c14e, warm windows #ffd98a.
- NO text, letters or numbers anywhere (signs are added later). NO guide lines, labels or boxes from the template.
- Transparent background unless I say otherwise.
Reply "ready" and wait for my requests.
```

---

## 2. The asset list

Priority **P1** = needed for a great landing; **P2** = polish; **Exists** = already
made, reuse.

### World

| # | File | What | Size | Template | Priority |
|---|---|---|---|---|---|
| 1 | `world-ground.png` | The whole island ground: grass, plaza stone, paths, island edge. **Opaque** (night-sky colour `#0b0717` around the island). | 1536x1024 | `world-ground-guide.png` | P1 |
| 2 | `building-park.png` | Kult Business Park: a modern glass office block with a gold-trim entrance on the right wall. | 1024x1024 | `building-park-guide.png` | P1 |
| 3 | `building-arcade.png` | Kult Arcade: a retro arcade hall with marquee bulbs and a glowing entrance on the left wall. | 1024x1024 | `building-arcade-guide.png` | P1 |
| 4 | `props.png` | 8 props on one sheet: tree, street lamp, bench, bush, flower bed, fountain with the KULT crystal, spawn pad, construction crane. | 1536x1024 | `props-guide.png` | P1 |
| 5 | `building-dex.png`, `building-production.png` | Future buildings for the new district (optional now). | 1024x1024 | park template | P2 |

### Arcade and Business Park

| # | File | What | Size | Template | Priority |
|---|---|---|---|---|---|
| 6 | `monitor.png` | The arcade computer: chunky retro monitor with a bezel, title bar, power LED and stand. **Screen area pure black** (the game is drawn into it). | 1536x1024 | `monitor-guide.png` | P1 |
| 7 | `card-create.png` | Gaming Studio card art | 1536x864 (16:9) | `cards-guide.png` | P1 |
| 8 | `card-sports.png` | Sports Market card art | 1536x864 | `cards-guide.png` | P1 |
| 9 | `card-dex.png` | Dex Trading card art | 1536x864 | `cards-guide.png` | P1 |
| 10 | `card-production.png` | Entertainment Production card art | 1536x864 | `cards-guide.png` | P1 |
| 11 | `thumb-warzone.png` | Warzone Warriors thumbnail | 1536x864 | `cards-guide.png` | P1 |
| 12 | `thumb-robowars.png` | Robowars thumbnail | 1536x864 | `cards-guide.png` | P1 |
| 13 | `thumb-wave.png` | Warzone Warriors Wave thumbnail | 1536x864 | `cards-guide.png` | P1 |
| 14 | `thumb-highway.png` | Highway Hustle thumbnail | 1536x864 | `cards-guide.png` | P1 |

### Passport and UI

| # | File | What | Size | Priority |
|---|---|---|---|---|
| 15 | `logo-kult-world.png` | "KULT WORLD" wordmark for the landing (the **one** asset that has text: you write it, or I keep the live pixel title) | 1536x512 | P1 |
| 16 | `passport-bg.png` | Passport card background: embossed violet booklet cover with a subtle KULT pattern and a gold seal area top-right, no text | 1024x640 | P1 |
| 17 | `stamps.png` | 6 round passport stamps on one 3x2 sheet: Business Park (briefcase), Arcade (joystick), Kult Create (game controller), Kult Sports (football), Kult Dex (candle chart), Kult Production (clapperboard). Ink-stamp style, each in its own colour, no text | 1536x1024 | P2 |
| 18 | `icons.png` | 3x3 icon sheet: $ARENA token, Kult Points star, KULT coin, quest scroll, trophy, map pin, menu, passport book, lock | 1536x1024 | P2 |

### Already exists (reuse)

| What | Where |
|---|---|
| Agent sprites, all 6 archetypes (idle, glance, walk) and portraits | `public/art/ceo-*.png` (from the AI Arena sheets) |
| ELO rank badges (8 tiers) | `public/art/*.png` (from kult-browser `public/ai_arena_icons/`) |
| Clan logos: 0G, Base, Solana | kult-browser `src/assets/0G Logo.png`, `Base Logo.webp`, `solana-sol-logo.png` |
| Kult logo | kult-browser `src/assets/Kult Logo.png` |
| Cinematic game art (fallback for thumbnails, not pixel style) | kult-browser `src/assets/moment-warzone.webp`, `moment-robowars.webp`, `trash-talk-highway-hustle.webp`; `public/Warzone/`, `public/Robowar/`, `public/HighwayHustle/` |

---

## 3. Prompts

### 1. World ground (attach `world-ground-guide.png`)

```
Using the attached guide, paint the ground of the Kult World island in our style. Keep the island EXACTLY where it is: same diamond shape, same size, same isometric angle, every tile edge in place.
- Grass on the green tiles: dark night grass with small tufts and a few tiny flowers, subtle variation.
- Light stone paving on the plaza and paths (the lighter purple tiles), with neat joints and a few cracks; a faint circular inlay pattern on the plaza centre.
- The island edge: a thick earthy cliff with roots and stones on the two front sides.
- Leave the yellow dashed building areas as plain grass (buildings go on top later). Do NOT draw buildings, trees, lamps, the fountain or any props.
- Outside the island: flat night colour #0b0717. No text.
```

### 2. Kult Business Park (attach `building-park-guide.png`)

```
Using the attached guide, draw ONE building that fills the dashed box exactly (footprint diamond at the bottom, roof at the top), same isometric angle:
Kult Business Park, a modern office tower for startups: violet-blue glass walls with a grid of warm-lit windows, a gold trim line at the roof, a grand glass entrance with a gold canopy exactly where the pink door mark is (right wall), small planters by the door.
Leave the blue dashed roof-sign area empty: just a dark sign frame on two posts, NO letters.
Transparent background. No text, no guide lines.
```

### 3. Kult Arcade (attach `building-arcade-guide.png`)

```
Using the attached guide, draw ONE building that fills the dashed box exactly, same isometric angle:
Kult Arcade, a retro neon arcade hall: deep purple walls, round porthole windows glowing pink and cyan, a row of marquee light bulbs under the roof, a glowing arched entrance exactly where the pink door mark is (left wall), posters of robots and race cars beside the door (no text on them).
Leave the blue dashed roof-sign area empty: just a dark sign frame on two posts, NO letters.
Transparent background. No text, no guide lines.
```

### 4. Props (attach `props-guide.png`)

```
Using the attached guide, draw one object in each of the 8 cells, standing on its dark footprint diamond and filling its dashed box, same isometric angle:
1 a round leafy tree, 2 an iron street lamp with a warm glowing lantern, 3 a wooden park bench, 4 a round bush, 5 a small flower bed with pink, gold and cyan flowers, 6 a stone fountain with blue water and a floating pink-and-cyan crystal above it, 7 a flat glowing spawn pad (a cyan ring with a pink inner ring, sci-fi floor plate), 8 a yellow construction crane with a hanging cyan crate.
Transparent background. No text, no guide lines.
```

### 6. Arcade computer (attach `monitor-guide.png`)

```
Using the attached guide, draw a chunky retro computer monitor in pixel art, front view: a thick dark-violet plastic bezel around the black screen area, a slim title bar at the top of the bezel with three small coloured window dots, a small brand plate and a green power LED on the bottom bezel, a sturdy stand below.
The screen area must stay PURE BLACK (#000000) and exactly the size and position of the black rectangle. Subtle cyan glow at the screen edges is fine.
Transparent background. No text, no guide lines.
```

### 7-10. Business cards (attach `cards-guide.png` as size reference)

Ask for each card separately, 16:9, **no text**, subject inside the safe area:

```
A 16:9 pixel-art card illustration, night neon style, no text:
GAMING STUDIO: a cosy indie game studio desk, a big monitor showing a colourful pixel game, controllers, sticky notes, pink-and-cyan glow.
```
```
SPORTS MARKET: a football analysis room, a tactics screen with a green pitch and arrows, a football on a desk, scoreboard glow, green-and-gold accents.
```
```
DEX TRADING: a trading desk with glowing candle charts on several screens, coins and tokens, cyan-and-green glow.
```
```
ENTERTAINMENT PRODUCTION: a film set with a camera on a dolly, a clapperboard, studio lights and a glowing screen, gold-and-pink glow.
```

### 11-14. Game thumbnails

Same format (16:9, no text), each showing the game's action in pixel art:

```
WARZONE WARRIORS: two agent soldiers in a top-down desert arena exchanging glowing tracer fire between crates, explosions, night lighting.
```
```
ROBOWARS: two giant mechs in a neon city arena, one firing a cyan laser, the other punching, sparks flying, red danger lights.
```
```
WARZONE WARRIORS WAVE: two agents back to back holding off a swarm of purple creatures pouring in from all sides, muzzle flashes.
```
```
HIGHWAY HUSTLE: two sports cars racing on a neon night highway, weaving between traffic, motion streaks, city skyline.
```

### 16. Passport background

```
A pixel-art passport cover, landscape 16:10: deep violet embossed leather texture, a fine geometric KULT pattern (diamonds and lines) in slightly lighter violet, a gold foil border, an empty round gold seal area in the top-right corner. NO text, NO letters.
```

### 17. Stamps (3x2 sheet)

```
A 3x2 sheet of 6 round passport ink stamps, pixel art, each in its own cell on a transparent background, slightly tilted, worn ink texture, NO text:
1 a briefcase (gold), 2 an arcade joystick (pink), 3 a game controller (pink), 4 a football (green), 5 candle chart bars (cyan), 6 a film clapperboard (gold).
```

---

## 4. Tips

- One ChatGPT chat per group (world, buildings, cards), with the style block and an approved reference attached.
- If it drifts: *"Same image, but crisp pixel art: hard square pixels, no anti-aliasing, no gradients, transparent background."*
- If it moves things: *"Keep everything exactly on the attached guide's lines, same angle and size."*
- Buildings and props don't need to be pixel-perfect on size: the importer scales them to the footprint. **Placement and angle** matter most.
