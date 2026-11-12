# Kult Game Hub: KULT-OS screen, asset list and ChatGPT prompts

The Game Hub becomes the biggest building in the city. Walking in opens
**KULT-OS**, a sci-fi game console screen. Its desktop holds three folders and
two apps:

| On the desktop | What opens |
|---|---|
| **AI Gaming** folder | The 4 AI vs AI games. Your agent is matched with another agent and plays live: Warzone Warriors, Robowars, Warzone Warriors Wave, Highway Hustle. |
| **Legacy Games** folder | The 6 classic Kult titles you play yourself: Guess the AI, Highway Hustle, Warzone Warriors, Zero Dash, Robowars, Zero G Pool. |
| **Kult Create Games** folder | Games made by players' AI studios in Kult Create, newest and top first. |
| **Kult Points** (top bar) | Your KP balance and rank. Tap it for how to earn more. |
| **Leaderboard** app | Kult Points and AI Arena ELO rankings, global and per game. |

This file lists every 2D asset the screen needs and gives a ChatGPT prompt for each one.
Only items marked **Generate** need new art. Everything marked **Reuse** already
exists, and everything marked **CSS** is built in code.

---

## 1. How the screen works

```
DESKTOP (1536 x 1024 design size, scales to the window)
+------------------------------------------------------------------+
|  [frame: sci-fi bezel around everything]                          |
|  +------------------------------------------------------------+  |
|  | KULT-OS   AGENT NAME · 1,240 ELO       (KP) 12,480   [TROPHY] [X] |  <- top bar (CSS + icons)
|  |                                                            |  |
|  |   wallpaper                                                |  |
|  |      [AI GAMING]     [LEGACY GAMES]    [KULT CREATE]       |  |  <- 3 folder icons
|  |       folder           folder            folder            |  |
|  |                                                            |  |
|  |   [LEADERBOARD app]                                        |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+

FOLDER OPEN -> a window slides up over the desktop
+-------------------------------------------------+
| (o)(o)(o)  AI GAMING           [search] [ - ][x]|  <- window frame (9-slice)
|  [Ranked] [Casual]                              |  <- mode chips (CSS)
|  +---------+ +---------+ +---------+ +---------+|
|  | cover   | | cover   | | cover   | | cover   ||  <- game tiles (tile frame + cover art)
|  |---------| |---------| |---------| |---------||
|  | title   | | title   | | title   | | title   ||
|  +---------+ +---------+ +---------+ +---------+|
+-------------------------------------------------+
```

- **Entering:** the screen powers on in about one second: the boot emblem, then the desktop.
- **AI Gaming:** picking a game runs today's match flow (matchmaking, the
  Unity stage or the Robowars launcher, the result). It runs inside the
  window instead of the old monitor.
- **Legacy Games:** picking a game opens its window: cover, short blurb and
  Play. Play runs the game full-screen inside the OS. Highway Hustle first asks
  for a mode: One Way, Two Way, Speed Run or Time Bomb.
- **Kult Create Games:** picking a game plays it in the same full-screen
  window, with "Made by <studio>".
- **Mobile:** the frame is dropped. The OS fills the screen, and folders and
  tiles stack in one column.

---

## 2. What already exists (Reuse)

| What | Where it is | Used for |
|---|---|---|
| AI Gaming covers (4) | `kult-world/public/art/world/thumb-warzone.webp`, `thumb-robowars`, `thumb-wave`, `thumb-highway` | AI Gaming tiles |
| Legacy covers (6, 1200x670, title painted in) | `app.kult.games/kult-games-v3/src/assets/games/allGameImages/*.webp` | Legacy tiles |
| Legacy banners (6, 1600x536) | `kult-games-v3/src/assets/games/<game>/hero-banner.webp` | Top of each legacy game's window |
| Legacy screenshots (4–9 per game) | `kult-games-v3/src/assets/games/<game>/*.webp` | Screenshot strip in the game window |
| Legacy logos | `kult-games-v3/src/assets/games/<game>/logo.png` (4 of 6) | Small badge on the tile |
| ELO rank badges (8 tiers) | `kult-world/public/art/*.png` | Leaderboard rows, agent line in the top bar |
| Small KP token (64 px) | `kult-world/public/art/world/token-kp.png` | Replaced by the new hi-res coin (G9) |
| Agent portraits | `kult-world/public/art/ceo-*-portrait.png` | Leaderboard podium, match VS screen |

## 3. Built in code (CSS), no art needed

Top bar, window title text, the taskbar/clock, mode chips (Ranked/Casual),
genre tags, progress bars, scanlines, the "LIVE" pulse, tooltips, list rows,
the Kult Create title overlay, and all text and numbers.

---

## 4. Style block (paste this first in every ChatGPT chat)

```
You are making 2D UI art for "KULT-OS", the sci-fi game console screen inside the Kult Game Hub, a building in Kult World (the KULT games platform).
STYLE (apply to every image in this chat):
- Premium sci-fi interface, like the console of a starship: hard-surface panels, chamfered 45-degree corners, thin engraved panel lines, small vents and screws, very fine hexagon and circuit micro-detail.
- Materials: dark smoked glass and dark gunmetal (#0b0717, #141029, #1d1640, #2c2556), edge-lit by thin light strips.
- Accent colours, used sparingly: cyan #5ec8f2 (main UI light), violet #9b5cff (0G), pink #ff7eb6 (actions and Kult Create), amber #f7a35c (Legacy Games), gold #f2c14e (Kult Points and rewards only).
- Calm, restrained glow: thin and soft. Never blown-out neon, no lens flares, no heavy bloom, no smoke.
- Crisp clean edges, high detail, no blur, no grain, no painterly brushwork.
- NO text, letters, numbers, logos or watermarks anywhere (labels are added later in code).
- Real transparent background (PNG alpha) unless I say otherwise. No shadow outside the object.
Reply "ready" and wait for my requests.
```

**Tips for ChatGPT**

- Generate one asset per message, in the same chat, so the style stays consistent.
- If it paints a grey checkerboard instead of real transparency, reply:
  *"Same image, but as a real transparent PNG with an alpha channel."*
  If that still fails, ask for a pure `#00ff00` background and I'll key it out.
- If text sneaks in, reply: *"Same image, remove every letter and number."*
- Download at full size. Don't crop or resize; the importer does that.

---

## 5. Asset list

**P1** = needed for the first version. **P2** = polish, can come later.

| # | File | What | Size | BG | Priority |
|---|---|---|---|---|---|
| G1 | `hubos-frame.png` | The screen bezel around the whole OS. Inside is empty. | 1536x1024 | transparent | P1 |
| G2 | `hubos-wallpaper.png` | Desktop wallpaper, calm and dark | 1536x1024 | opaque | P1 |
| G3 | `hubos-boot.png` | Boot emblem: crystal inside HUD rings | 1024x1024 | transparent | P1 |
| G4 | `hubos-folder-ai.png` | AI Gaming folder: closed (left) and open (right) | 1536x1024 | transparent | P1 |
| G5 | `hubos-folder-legacy.png` | Legacy Games folder: closed and open | 1536x1024 | transparent | P1 |
| G6 | `hubos-folder-create.png` | Kult Create Games folder: closed and open | 1536x1024 | transparent | P1 |
| G7 | `hubos-window.png` | Folder/app window frame (9-slice) | 1536x1024 | transparent | P1 |
| G8 | `hubos-tile.png` | Game tile frame: normal (left) and selected (right) | 1536x1024 | transparent | P1 |
| G9 | `kp-coin.png` | Kult Points coin, hi-res | 1024x1024 | transparent | P1 |
| G10 | `hubos-icons-a.png` | 12 core icons, 4x3 sheet | 1536x1024 | transparent | P1 |
| G11 | `lb-podium.png` | Leaderboard top-3 podium | 1536x1024 | transparent | P1 |
| G12 | `lb-medals.png` | Gold, silver and bronze rank medals, plus a "you" marker | 1536x1024 | transparent | P1 |
| G13 | `hubos-create-cover.png` | Default cover for Kult Create games | 1536x1024 | opaque | P1 |
| G14 | `hubos-icons-b.png` | 12 extra icons, 4x3 sheet | 1536x1024 | transparent | P2 |
| G15 | `hubos-wallpaper-mobile.png` | Portrait wallpaper for phones | 1024x1536 | opaque | P2 |
| G16 | `hubos-empty.png` | Empty state: "no games here yet" | 1024x1024 | transparent | P2 |
| G17 | `hubos-launcher.png` | Robowars needs the desktop launcher | 1024x1024 | transparent | P2 |
| G18 | `kp-burst.png` | KP reward burst (after a win or a quest) | 1024x1024 | transparent | P2 |

That is 13 images for P1 and 5 for P2.

---

## 6. Prompts

### G1 · Screen bezel `hubos-frame.png` (1536x1024, transparent)

```
Draw the outer bezel of a large sci-fi game console screen, front view, perfectly straight and symmetric, filling the whole 1536x1024 canvas.
- It is a FRAME ONLY: the entire inside area (about 88% of the width and 84% of the height, centred) is fully transparent. Nothing is drawn inside.
- Thick dark gunmetal bezel with chamfered 45-degree outer corners. The corners carry the detail: angled armour plates, small vents, tiny status lights (one cyan, one violet, one pink).
- The top edge has a raised centre notch, like a header bracket. Keep it empty; a title goes there later.
- The bottom edge has a slim centre plate with a thin cyan light strip.
- A thin cyan inner light line runs around the inside edge of the frame, soft glow, facing inward.
- The long straight edges between the corners are plain and uniform, so they can stretch.
No text, no logos. Transparent background and transparent inside.
```

### G2 · Wallpaper `hubos-wallpaper.png` (1536x1024, opaque)

```
Paint the desktop wallpaper for the KULT-OS console. Opaque, filling the canvas.
- Deep night-violet space (#0b0717 to #1d1640), very dark and calm, so icons placed on it read clearly.
- Lower third: a faint perspective grid floor in thin cyan lines, fading out toward a horizon line.
- At the horizon centre: a large, soft, abstract hexagonal crystal silhouette in violet, barely visible, glowing faintly from within.
- A few distant thin light arcs and tiny stars. No planets, no characters, no buildings.
- Keep the middle band (where three folder icons will sit) the calmest part: low contrast, no bright details.
No text, no logos, no UI elements.
```

### G3 · Boot emblem `hubos-boot.png` (1024x1024, transparent)

```
Draw the KULT-OS boot emblem, centred, front view, symmetric.
- Centre: a faceted hexagonal crystal, violet (#9b5cff) with a cyan core light.
- Around it: three concentric thin HUD rings in cyan. The inner ring is segmented in short dashes, the middle ring has four small bracket marks at 12, 3, 6 and 9 o'clock, and the outer ring is thin with tick marks.
- A soft, restrained glow around the crystal only.
- Leave generous empty space around the outer ring.
No text, no letters. Transparent background.
```

### G4 · AI Gaming folder `hubos-folder-ai.png` (1536x1024, transparent)

```
Draw a sci-fi data-folder desktop icon in TWO states side by side, both the same size and on the same baseline: CLOSED on the left half, OPEN on the right half. Icon view: front, slightly from above.
- The folder is a hard-surface armoured case shaped like a classic folder (a back panel with a tab and a front flap), dark gunmetal with a CYAN (#5ec8f2) edge light.
- On the front flap is an engraved emblem: two robot heads in profile facing each other, with a small lightning bolt between them (AI vs AI). The emblem glows cyan.
- CLOSED: the flap is shut, with a calm glow.
- OPEN: the flap is tilted forward, and four small glowing game cards rise out of the folder in a fan, cyan light spilling up from inside.
Each state is centred in its half with empty space around it. No text. Transparent background.
```

### G5 · Legacy Games folder `hubos-folder-legacy.png` (1536x1024, transparent)

```
Same layout and exactly the same folder shape, size and angle as the AI Gaming folder: CLOSED on the left half, OPEN on the right half.
- Edge light and emblem colour: AMBER (#f7a35c) instead of cyan.
- Emblem on the front flap: a retro game cartridge with a small joystick beside it (classic games).
- OPEN: six small glowing game cards rise out in a fan, with amber light from inside.
No text. Transparent background.
```

### G6 · Kult Create Games folder `hubos-folder-create.png` (1536x1024, transparent)

```
Same layout and exactly the same folder shape, size and angle as the previous folders: CLOSED on the left half, OPEN on the right half.
- Edge light and emblem colour: PINK (#ff7eb6) with a touch of violet.
- Emblem on the front flap: a game controller with a small four-point sparkle above it (games made by AI).
- OPEN: several small glowing game cards rise out with tiny sparkles, and pink light comes from inside.
No text. Transparent background.
```

### G7 · Window frame `hubos-window.png` (1536x1024, transparent)

```
Draw an empty sci-fi app window frame, front view, filling the canvas, for a game-console OS.
- Top: a title bar about 90 px tall, dark gunmetal with a thin cyan underline. On its left are three small round light slots (empty sockets, no colour). The rest of the title bar is plain; text goes there later.
- Body: dark smoked glass panel (#141029 at about 92% opacity), very subtle hexagon micro-pattern, mostly flat and plain.
- Border: thin gunmetal rim with chamfered 45-degree corners and a thin cyan edge light. Small corner brackets at all four corners.
- IMPORTANT: all detail sits in the corners and the title bar. The straight edges between the corners are plain and uniform, so the window can stretch to any size.
No text, no icons, no buttons drawn. Transparent outside the frame.
```

### G8 · Game tile frame `hubos-tile.png` (1536x1024, transparent)

```
Draw a game tile frame in TWO states side by side, same size: NORMAL on the left half, SELECTED on the right half. Front view. Each tile is portrait, about 560 px wide by 620 px tall.
- Shape: a data-cartridge card with chamfered corners, dark gunmetal rim.
- Top part: an empty 16:10 window for the game cover art. FULLY TRANSPARENT inside, with a thin inner edge line.
- Bottom part: a plain dark nameplate, about 110 px tall, for the title (left empty).
- NORMAL: dim cyan edge light, quiet.
- SELECTED: brighter cyan edge light, four bracket marks hugging the corners, and a soft glow outside the rim.
No text. Transparent background and transparent cover window.
```

### G9 · Kult Points coin `kp-coin.png` (1024x1024, transparent)

```
Draw the Kult Points coin, front view, centred, filling about 80% of the canvas.
- A thick GOLD coin (#f2c14e, darker gold edges) with a notched sci-fi rim.
- Centre: an embossed four-point star crystal, raised, catching the light.
- Between the centre and the rim: a thin ring of violet (#9b5cff) enamel inlay with tiny circuit lines.
- Soft top-left light, a crisp highlight on the rim, a gentle warm glow. Not overly shiny.
No letters or numbers on the coin. Transparent background.
```

### G10 · Core icons `hubos-icons-a.png` (1536x1024, transparent)

```
Draw an icon sheet: 12 icons on a 4 x 3 grid, each centred in its own equal cell (384 x 341 px), filling about 60% of the cell. All in the same style: clean sci-fi line icons, 2-tone (cyan #5ec8f2 lines, darker gunmetal fill), the same stroke weight, a subtle glow.
Row 1: trophy (leaderboard) | small gold coin with a four-point star (Kult Points, gold not cyan) | play triangle | back arrow
Row 2: close X | fullscreen (four corner brackets) | search magnifier | speaker with sound waves
Row 3: speaker muted (with a slash) | live broadcast (a dot with two arcs, the dot in pink) | two people (players) | star (rating)
No text, no grid lines, no cell borders. Transparent background.
```

### G11 · Leaderboard podium `lb-podium.png` (1536x1024, transparent)

```
Draw a holographic three-step winners podium, front view, centred.
- Three hard-surface sci-fi blocks: centre tallest (1st), left middle height (2nd), right lowest (3rd).
- Each block has a thin edge light strip in its rank colour: centre gold #f2c14e, left silver #cfd6e6, right bronze #d08a5a.
- On top of each block, a flat glowing ring (a hologram pad) where an avatar will stand.
- The front face of each block is plain and dark (the rank number is added later).
- Keep clear empty space above each pad for the avatar portraits.
No numbers, no text, no people. Transparent background.
```

### G12 · Rank medals `lb-medals.png` (1536x1024, transparent)

```
Draw four badges in one row, evenly spaced, same size, front view:
1) GOLD rank medal: a hexagonal sci-fi badge with a short ribbon tail, gold #f2c14e.
2) SILVER: the same shape, silver #cfd6e6.
3) BRONZE: the same shape, bronze #d08a5a.
4) a "YOU" marker: a cyan downward chevron arrow inside a small hexagon outline.
The centre of each medal is plain and smooth (the number is added later).
No numbers, no text. Transparent background.
```

### G13 · Kult Create default cover `hubos-create-cover.png` (1536x1024, opaque)

```
Paint a game cover image for games made by AI studios in Kult Create. Opaque, filling the canvas.
- Scene: a glowing blank game cartridge floating above a holographic build table in a dark studio. Small drones and thin light beams are assembling it, with sparks of pink light.
- Palette: deep violet background, pink #ff7eb6 and violet #9b5cff light, a touch of cyan.
- Keep the lower 30% darker and calm: the game's title is written over it in code.
No text, no letters, no logos.
```

### G14 · Extra icons `hubos-icons-b.png` (1536x1024, transparent), P2

```
Same style and grid as the core icon sheet (12 icons, 4 x 3, cyan line icons).
Row 1: shield with a chevron (Ranked) | game controller (Casual) | stack of coins (Wager, gold) | download arrow into a tray
Row 2: rocket leaving a window (launch the desktop launcher) | four-point sparkle (made by AI, pink) | starburst badge (New) | flame (Hot, amber)
Row 3: info (a circle with a dot and a bar) | gear (settings) | arrow leaving a square (open in new tab) | circular refresh arrows
No text, no grid lines. Transparent background.
```

### G15 · Mobile wallpaper `hubos-wallpaper-mobile.png` (1024x1536, opaque), P2

```
The same wallpaper as before (dark violet space, faint cyan perspective grid floor, faint violet hexagonal crystal at the horizon), recomposed for a tall portrait phone screen. The horizon sits at about 65% height. The upper two thirds is the calmest area, for stacked folder icons.
No text.
```

### G16 · Empty state `hubos-empty.png` (1024x1024, transparent), P2

```
A small friendly maintenance drone, front view, centred, holding up an empty holographic game card, slightly puzzled. Gunmetal body with a cyan eye light. It is the "no games here yet" picture.
No text. Transparent background.
```

### G17 · Launcher needed `hubos-launcher.png` (1024x1024, transparent), P2

```
A desktop computer tower and monitor in the same sci-fi style, front three-quarter view. A small rocket lifts off from the monitor screen with a cyan trail: "this game launches in the desktop app".
No text, no brand logos. Transparent background.
```

### G18 · KP reward burst `kp-burst.png` (1024x1024, transparent), P2

```
A celebratory burst behind a coin slot: radiating thin gold light rays, small gold coins and four-point star sparkles flying outward from an EMPTY centre circle (the Kult Points coin is placed there in code). Gold #f2c14e with a touch of violet.
No text. Transparent background.
```

---

## 7. Delivery

Save everything to `Desktop/Assets/kult-world/hub-os/` with the file names
above. I'll write the importer (as with `scripts/import-art.mjs`). It slices the two-state and sheet
images, trims and scales them, writes them to `public/art/world/`, and adds
them to `manifest.json`. The legacy covers, banners and logos are copied over
from `kult-games-v3` at the same time.

---

## 8. Build notes (for the code side, no art needed)

**Status (2026-11-12): all 18 assets are imported.** To bring in new or
changed art, re-run the importer (it needs Pillow and numpy):

```bash
python scripts/import-hub-art.py   # default folder: ~/Desktop/Kult World Graphics/GameHubUI
```

The importer:
- writes WebP files to `public/art/hub/`;
- merges their entries into `public/art/world/manifest.json`, keeping the
  entries already there;
- removes the solid white background the window and medals came on;
- cuts the two-state images and the icon and medal sheets apart;
- crops the portrait Kult Create cover to landscape;
- measures the frame and window 9-slices and the tile's cover and nameplate
  slots, so `public/js/hubos.js` can line the page up with the art.

The CSS stand-ins remain the fallback for any key that is missing.

**Bigger building.** The hub is now `bld-game-hub` at 10 x 11 tiles, 14 m tall
(`public/js/models.js`, `public/js/layout.js`). The hub district (x 30–45,
y 2–26) has room for about 13 x 15 tiles and 20 m, without touching the
avenue at y 27. The 0G Gaming Hub model just scales up. The sign, door and
agent paths move with it.

**AI Gaming.** No new backend work. It reuses `GAMES` in `public/js/data.js` and
the match flow in `public/js/main.js` and `battle.js`: Unity builds for Warzone,
Wave and Highway, and the Windows launcher for Robowars. The old browser also
had a **Wager** mode (5 ARENA + x402); Kult World only has Ranked and Casual,
and adding Wager is optional.

**Legacy Games.** These work like they did in the old browser (`kult-games-v3`):
- Catalog: `GET /games/all` and `GET /games/:id` on the Kult backend.
  Kult World already proxies it at `/api/kult`.
- Play URL: `metadata.play_url`, or `game.url` when the game isn't a download.
  The URL gets `jwt=<Kult token>&source=browser&wallet=<address>`.
  Kult World already holds a Kult token (`session.kult.token`).
- Special cases:

  | Game | What it needs |
  |---|---|
  | Zero G Pool | Its R2 build URL comes from the catalog (now `v10`). |
  | Highway Hustle | 4 mode URLs: One Way, Two Way, Speed Run, Time Bomb. |
  | Zero Dash | Runs as a Unity build with the `zeroDashBridge` score bridge, on its own page (`public/play/zerodash.html`). |
  | Downloadable games | Show Download instead of Play. |

- Sign-in: as in the old browser, a game starts signed in to Kult. A player
  whose Kult sign-in did not finish is asked for it once, then plays either way.
- Session start: Play also makes the call each game's backend records
  on-chain, through Kult World's server (`/api/legacy/*`):

  | Game | Call |
  |---|---|
  | Highway Hustle | `POST /player/login` |
  | Zero G Pool | `POST /player/auth/login` |
  | Zero Dash | `POST /player/game-sync` (Zero Dash's in-game score sync goes the same way) |

  Their addresses are the `HIGHWAY_HUSTLE_API_URL`, `ZEROGPOOL_API_URL` and
  `ZERODASH_API_URL` env vars.

**Kult Create Games.** These are hosted the way Creator Studio's player
hosted them (`creator-studio-frontend-tg`).

- **List:** kult-create `GET /games/public`, Kult World `/api/create/games/public`.
  It returns each game's id, title, studio, plays, likes, cover and runner.
- **Running a game:**
  - Studio games run in kult-create's runner, `/play/:gameId/game.html`.
    This is Creator Studio's harness: an iframe with `sandbox="allow-scripts"`
    (opaque origin), in-memory storage, and a score bridge.
  - Games only the compute pipeline can play open its play page instead.
- **Score bridge:** the game calls `window.reportScore(n)`. For older games,
  the harness reads the score off the HUD when game-over text shows. Either
  way it sends `postMessage({ __kultGameScore })` to the Game Hub.
- **Play tracking:** the same calls Creator Studio's player makes. Kult Create
  relays them to Creator Studio with the player's IP and device id, for its
  anti-fraud.
  - A view when the game starts.
  - A qualified play after 30 s: KP for the player (+30 the first time, +5
    after that) and creator score for the studio.
  - Every score, to the game's leaderboard. The trophy in the player bar
    shows its top scores.

**Kult Points and leaderboard.** Already wired in Kult World:
- KP balance and rank come from the Kult profile.
- The KP leaderboard is `kultApi.leaderboard` in `public/js/arena.js`.
- AI Arena ELO comes from the arena leaderboard.

The OS reuses this data in the new window and top bar.
