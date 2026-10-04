"""
Derive web assets from the approved logo CONCEPT (assets/brand/cue-logo-concept.png).

These are interim, concept-derived rasters for the software MVP, not production
masters (DESIGN.md §3). Replace them with the vector redraw when it exists.

Outputs (public/brand/):
  cue-lockup-light.png  stacked lockup, transparent, original colors (light surfaces)
  cue-lockup-dark.png   stacked lockup reverse: ink form -> bone, gray form -> lifted
                        warm gray (DESIGN.md §19), NOT an automatic inversion
  cue-symbol-light.png / cue-symbol-dark.png   symbol only
  src/app/icon.png      favicon: symbol on a bone tile

Run: python3 scripts/brand-assets.py   (needs Pillow + numpy)
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/brand/cue-logo-concept.png")
OUT = os.path.join(ROOT, "public/brand")
os.makedirs(OUT, exist_ok=True)

BONE = np.array([0xF7, 0xF4, 0xEE], float)
LIFTED_GRAY = np.array([0xB9, 0xB4, 0xAC], float)  # warm gray raised for ink surfaces

img = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
h, w, _ = img.shape
border = np.concatenate([img[:8].reshape(-1, 3), img[-8:].reshape(-1, 3), img[:, :8].reshape(-1, 3), img[:, -8:].reshape(-1, 3)])
bg = np.median(border, axis=0)

# Color-to-alpha against the background: alpha is how much darker than bg a pixel is
# (relative to black), and fg is the color that, laid over bg at that alpha, reproduces it.
alpha = np.clip(((bg - img) / bg).max(axis=2), 0, 1)
# Noise floor: the concept's background varies by ±1–2 levels, which must not read as ink.
NOISE = 0.03
alpha = np.clip((alpha - NOISE) / (1 - NOISE), 0, 1)
safe = np.maximum(alpha, 1e-6)[..., None]
fg = np.clip((img - (1 - alpha[..., None]) * bg) / safe, 0, 255)

# Which form does each inked pixel belong to? Cores by lightness, then grow each core a
# few px so anti-aliased edges join their own form (the forms never touch).
L = img.mean(axis=2)
ink_core = L < 70
gray_core = (np.abs(L - 155) < 25) & (img.max(axis=2) - img.min(axis=2) < 25)

def grow(mask, r):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out

near_gray = grow(gray_core, 4) & ~grow(ink_core, 2)
gray_alpha_full = 1 - 155 / bg.mean()  # alpha of a fully covered gray-form pixel

def save(rgb, a, box, name, height):
    y0, y1, x0, x1 = box
    rgba = np.dstack([rgb, a[..., None] * 255]).astype(np.uint8)[y0:y1, x0:x1]
    im = Image.fromarray(rgba, "RGBA")
    im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    im.save(os.path.join(OUT, name), optimize=True)
    return im

# Dark reverse: coverage per form, recolored.
cover = np.where(near_gray, np.clip(alpha / gray_alpha_full, 0, 1), alpha)
dark_rgb = np.where(near_gray[..., None], LIFTED_GRAY, BONE)

def bbox(mask, pad):
    ys, xs = np.where(mask)
    return max(ys.min() - pad, 0), min(ys.max() + pad, h), max(xs.min() - pad, 0), min(xs.max() + pad, w)

inked = alpha > 0.1
rows = inked.any(axis=1)
ys = np.where(rows)[0]
# The symbol and wordmark are separated by the widest empty band of rows.
gaps = [(ys[i + 1] - ys[i], ys[i]) for i in range(len(ys) - 1)]
split = max(gaps)[1] + 1
lockup_box = bbox(inked, 12)
symbol_box = bbox(inked & (np.arange(h)[:, None] < split), 12)

save(fg, alpha, lockup_box, "cue-lockup-light.png", 320)
save(dark_rgb, cover, lockup_box, "cue-lockup-dark.png", 320)
save(fg, alpha, symbol_box, "cue-symbol-light.png", 256)
save(dark_rgb, cover, symbol_box, "cue-symbol-dark.png", 256)

# Favicon / app icon: symbol centered on a bone tile (DESIGN.md §4: cue-symbol for favicon).
sym = Image.open(os.path.join(OUT, "cue-symbol-light.png"))
tile = Image.new("RGBA", (256, 256), tuple(int(c) for c in BONE) + (255,))
s = 200 / max(sym.size)
sym = sym.resize((round(sym.width * s), round(sym.height * s)), Image.LANCZOS)
tile.alpha_composite(sym, ((256 - sym.width) // 2, (256 - sym.height) // 2))
tile.resize((64, 64), Image.LANCZOS).save(os.path.join(ROOT, "src/app/icon.png"), optimize=True)

print("split row", split, "lockup", lockup_box, "symbol", symbol_box)
