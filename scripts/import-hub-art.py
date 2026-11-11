"""Imports the Game Hub (KULT-OS) art into public/art/hub/ and adds it to
public/art/world/manifest.json, keeping every entry already there.

    python scripts/import-hub-art.py ["<folder with the ChatGPT PNGs>"]

The art and its prompts: docs/GAME_HUB_ASSETS.md. Needs Pillow and numpy.

- Solid white backgrounds (the window and the medals came that way) are
  keyed out from the border inward.
- Two-state images (folders, tiles) and sheets (icons, medals) are cut apart
  and each piece is trimmed to its content.
- Everything is saved as WebP at the size the page shows it.
- The frame and window keep their full canvas: hubos.js stretches them as
  9-slices with the slice sizes measured here. The tile records where its
  cover window and nameplate are, so the page lines its content up with them.
"""
import hashlib
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser("~"), "Desktop", "Kult World Graphics", "GameHubUI")
OUT = os.path.join(ROOT, "public", "art", "hub")
MANIFEST = os.path.join(ROOT, "public", "art", "world", "manifest.json")
os.makedirs(OUT, exist_ok=True)

files = {}
digest = hashlib.sha1()


def load(name):
    path = os.path.join(SRC, name)
    if not os.path.exists(path):
        print(f"  missing {name}, skipped")
        return None
    return Image.open(path).convert("RGBA")


def key_white(im, lum=205, sat=34):
    """Make the white background connected to the border transparent, and fade its fringe."""
    a = np.array(im)
    rgb = a[:, :, :3].astype(int)
    white = (rgb.mean(axis=2) > lum) & ((rgb.max(axis=2) - rgb.min(axis=2)) < sat)
    h, w = white.shape
    seen = np.zeros_like(white)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    a[seen, 3] = 0
    # One pixel of anti-aliased fringe next to the removed area: fade by how light it is.
    edge = np.zeros_like(seen)
    edge[1:, :] |= seen[:-1, :]; edge[:-1, :] |= seen[1:, :]; edge[:, 1:] |= seen[:, :-1]; edge[:, :-1] |= seen[:, 1:]
    edge &= ~seen
    light = rgb.mean(axis=2)
    fade = np.clip((255 - light) / 120, 0, 1)
    a[edge, 3] = (a[edge, 3] * fade[edge]).astype(np.uint8)
    return Image.fromarray(a)


def trim(im, th=12, pad=2):
    al = np.array(im)[:, :, 3]
    ys, xs = np.where(al > th)
    if not len(xs):
        return im
    return im.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + 1 + pad), min(im.height, ys.max() + 1 + pad)))


def fit(im, max_w=None, max_h=None):
    s = 1.0
    if max_w and im.width > max_w: s = min(s, max_w / im.width)
    if max_h and im.height > max_h: s = min(s, max_h / im.height)
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS) if s < 1 else im


def save(key, im, name, q=88, **extra):
    path = os.path.join(OUT, name)
    im.save(path, "WEBP", quality=q, method=6)
    data = open(path, "rb").read()
    digest.update(data)
    files[key] = {"file": f"hub/{name}", "w": im.width, "h": im.height, **extra}
    print(f"  {key:28} {im.width}x{im.height}  {len(data) // 1024} KB")


def halves(im):
    """A two-state image: the left and right halves, split at the empty column between them."""
    al = np.array(im)[:, :, 3]
    used = (al > 12).any(axis=0)
    mid = im.width // 2
    gap = [x for x in range(im.width // 3, 2 * im.width // 3) if not used[x]]
    cut = gap[len(gap) // 2] if gap else mid
    return im.crop((0, 0, cut, im.height)), im.crop((cut, 0, im.width, im.height))


def grid(im, cols, rows):
    w, h = im.width / cols, im.height / rows
    return [im.crop((round(c * w), round(r * h), round((c + 1) * w), round((r + 1) * h))) for r in range(rows) for c in range(cols)]


print(f"Importing the Game Hub art from {SRC}")

# ---------------------------------------------------------------- screens
if (im := load("hubos-wallpaper.png")): save("hubos-wallpaper", fit(im.convert("RGB"), 1672), "wallpaper.webp", q=84)
if (im := load("hubos-wallpaper-mobile.png")): save("hubos-wallpaper-mobile", fit(im.convert("RGB"), None, 1672), "wallpaper-mobile.webp", q=84)

# The frame's border (outer edge to the screen) on each side, and the top
# notch: the page draws it as a 9-slice and puts the screen inside it.
if (im := load("hubos-frame.png")):
    al = np.array(im)[:, :, 3] > 20
    h, w = al.shape
    def first_gap(v):
        on = False
        for i, x in enumerate(v):
            on = on or x
            if on and not x: return i
        return 0
    left = first_gap(al[h // 2]); right = w - first_gap(al[h // 2][::-1])
    top_side = first_gap(al[:, w // 4]); top_mid = first_gap(al[:, w // 2]); bottom = h - first_gap(al[:, w // 2][::-1])
    save("hubos-frame", im, "frame.webp", q=90, slice=[top_mid, w - right, h - bottom, left], screen=[top_side, w - right, h - bottom, left])

# The window: keyed, cropped to its body. Title bar height and the corner
# width (which holds the three lights) are measured for the 9-slice.
if (im := load("hubos-window.png")):
    win = trim(key_white(im), pad=0)
    a = np.array(win).astype(int)
    col = a[:, win.width // 2, :3].mean(axis=1)
    # the title bar's bright underline: the first light row below the top edge
    bar = next((y for y in range(40, win.height // 3) if col[y] > 120), 90)
    save("hubos-window", win, "window.webp", q=90, bar=int(bar) + 4, slice=[int(bar) + 6, 130, 36, 130])

# ---------------------------------------------------------------- folders
for fid in ("ai", "legacy", "create"):
    if (im := load(f"hubos-folder-{fid}.png")):
        closed, opened = halves(im)
        save(f"hubos-folder-{fid}-closed", fit(trim(closed), 440), f"folder-{fid}-closed.webp")
        save(f"hubos-folder-{fid}-open", fit(trim(opened), 440), f"folder-{fid}-open.webp")

# ---------------------------------------------------------------- tiles
# Normal: cropped to the frame body. Selected: cropped with its glow, plus
# where its body sits inside that crop, so it lines up with the normal one.
if (im := load("hubos-tile.png")):
    normal, selected = halves(im)
    def body(part, th):
        al = np.array(part)[:, :, 3]; ys, xs = np.where(al > th); return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    nb = body(normal, 200)
    n = normal.crop(nb)
    na = np.array(n)[:, :, 3] > 40
    # the cover window: the transparent hole around the centre of the upper half
    cx, cy = n.width // 2, int(n.height * 0.4)
    l = cx; r = cx; t = cy; b = cy
    while l > 0 and not na[cy, l - 1]: l -= 1
    while r < n.width - 1 and not na[cy, r + 1]: r += 1
    while t > 0 and not na[t - 1, cx]: t -= 1
    while b < n.height - 1 and not na[b + 1, cx]: b += 1
    pct = lambda v, s: round(v / s * 100, 2)
    hole = [pct(t, n.height), pct(n.width - 1 - r, n.width), pct(n.height - 1 - b, n.height), pct(l, n.width)]
    plate = [pct(b + 1, n.height), hole[1], 6.5, hole[3]]
    nW = fit(n, 520)
    save("hubos-tile-normal", nW, "tile-normal.webp", q=90, ratio=round(n.width / n.height, 4), hole=hole, plate=plate)
    gb, sb = body(selected, 20), body(selected, 200)
    s = selected.crop(gb)
    bw, bh = sb[2] - sb[0], sb[3] - sb[1]
    save("hubos-tile-selected", fit(s, 560), "tile-selected.webp", q=90,
         box=[pct(sb[1] - gb[1], bh), pct(gb[2] - sb[2], bw), pct(gb[3] - sb[3], bh), pct(sb[0] - gb[0], bw)])

# ---------------------------------------------------------------- icons
NAMES = {
    "hubos-icons-a.png": ["trophy", "kp", "play", "back", "close", "full", "search", "sound", "mute", "live", "players", "star"],
    "hubos-icons-b.png": ["ranked", "casual", "wager", "download", "launcher", "ai", "new", "hot", "info", "settings", "newtab", "refresh"]
}
for sheet, names in NAMES.items():
    if (im := load(sheet)):
        for name, cell in zip(names, grid(im, 4, 3)):
            save(f"hubos-icon-{name}", fit(trim(cell), 128, 128), f"icon-{name}.webp")

# ---------------------------------------------------------------- Kult Points, leaderboard, pictures
if (im := load("kp-coin.png")): save("kp-coin", fit(trim(im), 256), "kp-coin.webp")
if (im := load("kp-burst.png")): save("kp-burst", fit(trim(im), 560), "kp-burst.webp")
if (im := load("lb-podium.png")):
    p = trim(im, th=20, pad=0)
    save("lb-podium", fit(p, 1000), "podium.webp", q=88)
if (im := load("lb-medals.png")):
    m = key_white(im, lum=225, sat=26)
    al = np.array(m)[:, :, 3] > 20
    used = al.any(axis=0)
    spans, on, start = [], False, 0
    for x, u in enumerate(used):
        if u and not on: on, start = True, x
        if not u and on: on = False; spans.append((start, x))
    if on: spans.append((start, len(used)))
    for name, (x0, x1) in zip(["gold", "silver", "bronze", "you"], [s for s in spans if s[1] - s[0] > 40]):
        save(f"lb-medal-{name}", fit(trim(m.crop((x0, 0, x1, m.height))), 160, 160), f"medal-{name}.webp")
if (im := load("hubos-boot.png")): save("hubos-boot", fit(trim(im), 420), "boot.webp")
if (im := load("hubos-empty.png")): save("hubos-empty", fit(trim(im), 420), "empty.webp")
if (im := load("hubos-launcher.png")): save("hubos-launcher", fit(trim(im), 560), "launcher.webp")
# Delivered portrait; tiles are landscape, so keep the cartridge and its pad.
if (im := load("hubos-create-cover.png")):
    c = im.convert("RGB")
    h = round(c.width * 3 / 4)
    top = max(0, min(c.height - h, round(c.height * 0.06)))
    save("hubos-create-cover", fit(c.crop((0, top, c.width, top + h)), 800), "create-cover.webp", q=84)

# ---------------------------------------------------------------- manifest
manifest = json.load(open(MANIFEST, encoding="utf-8"))
manifest["files"].update(files)
manifest["rev"] = hashlib.sha1((manifest.get("rev", "") + digest.hexdigest()).encode()).hexdigest()[:10]
with open(MANIFEST, "w", encoding="utf-8", newline="\n") as out:
    json.dump(manifest, out, indent=1)
print(f"{len(files)} files, manifest rev {manifest['rev']}")
