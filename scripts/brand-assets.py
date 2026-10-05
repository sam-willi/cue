"""
Derive interim web assets from the approved logo CONCEPT (assets/brand/cue-logo-concept.png).

These are concept-derived rasters for the software MVP, not production masters
(DESIGN.md §3, §22). Replace them with exports of the vector redraw when it exists.

Outputs, named per DESIGN.md §22 (cue-logo-[form]-[color]-[background]-[size]):
  public/brand/cue-logo-stacked-fullcolor-{light,dark}.png      stacked lockup (Tier 1)
  public/brand/cue-logo-horizontal-fullcolor-{light,dark}.png   horizontal lockup (Tier 2, navigation)
  public/brand/cue-logo-symbol-fullcolor-{light,dark}.png       symbol only (Tier 4)
  public/brand/cue-logo-symbol-fullcolor-{light,dark}-64.png    favicon / app icon on a bone or ink field
  scripts/out/favicon-preview.png                               16/20/24/32 px review sheet (not shipped)

"dark" assets are the full-color dark form from §3: warm-white wearer voice and wordmark,
light warm-gray first voice, recolored per form rather than inverted (§19).

Run: python3 scripts/brand-assets.py   (needs Pillow + numpy)
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets/brand/cue-logo-concept.png")
OUT = os.path.join(ROOT, "public/brand")
REVIEW = os.path.join(ROOT, "scripts/out")
os.makedirs(OUT, exist_ok=True)
os.makedirs(REVIEW, exist_ok=True)

BONE = np.array([0xF7, 0xF4, 0xEE], float)  # bone-50
INK = np.array([0x11, 0x11, 0x11], float)  # ink-950
WARM_WHITE = BONE
LIGHT_WARM_GRAY = np.array([0xB9, 0xB4, 0xAC], float)

img = np.asarray(Image.open(SRC).convert("RGB")).astype(float)
h, w, _ = img.shape
border = np.concatenate([img[:8].reshape(-1, 3), img[-8:].reshape(-1, 3), img[:, :8].reshape(-1, 3), img[:, -8:].reshape(-1, 3)])
bg = np.median(border, axis=0)

# Color-to-alpha against the concept's background: alpha is how much darker than bg a
# pixel is (relative to black); fg is the color that, laid over bg at that alpha,
# reproduces the pixel. A small noise floor keeps background grain from reading as ink.
alpha = np.clip(((bg - img) / bg).max(axis=2), 0, 1)
NOISE = 0.03
alpha = np.clip((alpha - NOISE) / (1 - NOISE), 0, 1)
fg = np.clip((img - (1 - alpha[..., None]) * bg) / np.maximum(alpha, 1e-6)[..., None], 0, 255)

# Which voice does each inked pixel belong to? Cores by lightness, grown a few px so
# anti-aliased edges join their own form (the forms never touch).
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
gray_alpha_full = 1 - 155 / bg.mean()
dark_alpha = np.where(near_gray, np.clip(alpha / gray_alpha_full, 0, 1), alpha)
dark_rgb = np.where(near_gray[..., None], LIGHT_WARM_GRAY, WARM_WHITE)

LIGHT = (fg, alpha)
DARK = (dark_rgb, dark_alpha)

inked = alpha > 0.1
ys = np.where(inked.any(axis=1))[0]
gaps = [(ys[i + 1] - ys[i], ys[i]) for i in range(len(ys) - 1)]
split = max(gaps)[1] + 1  # widest empty band separates symbol (above) from wordmark


def bbox(mask):
    yy, xx = np.where(mask)
    return yy.min(), yy.max() + 1, xx.min(), xx.max() + 1


rows = np.arange(h)[:, None]
SYMBOL = bbox(inked & (rows < split))
WORDMARK = bbox(inked & (rows >= split))
STACKED = bbox(inked)


def crop(variant, box, pad=0):
    rgb, a = variant
    y0, y1, x0, x1 = box
    y0, x0 = max(y0 - pad, 0), max(x0 - pad, 0)
    y1, x1 = min(y1 + pad, h), min(x1 + pad, w)
    return Image.fromarray(np.dstack([rgb, a[..., None] * 255]).astype(np.uint8)[y0:y1, x0:x1], "RGBA")


def fit_height(im, height):
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def horizontal(variant):
    """Tier 2 lockup (§3 provisional targets): symbol height ≈ 1.15 × the wordmark's
    lowercase height x, gap ≈ 0.5x, symbol centered on the wordmark's x-height."""
    sym, word = crop(variant, SYMBOL), crop(variant, WORDMARK)
    x = word.height  # all-lowercase "cue": the crop height is the x-height
    sym = fit_height(sym, round(1.15 * x))
    gap = round(0.5 * x)
    canvas = Image.new("RGBA", (sym.width + gap + word.width, sym.height), (0, 0, 0, 0))
    canvas.alpha_composite(sym, (0, 0))
    canvas.alpha_composite(word, (sym.width + gap, (sym.height - word.height) // 2))
    return canvas


def save(im, name, height):
    fit_height(im, height).save(os.path.join(OUT, name), optimize=True)


for bgname, variant in (("light", LIGHT), ("dark", DARK)):
    save(crop(variant, STACKED, 12), f"cue-logo-stacked-fullcolor-{bgname}.png", 320)
    save(horizontal(variant), f"cue-logo-horizontal-fullcolor-{bgname}.png", 96)
    save(crop(variant, SYMBOL, 12), f"cue-logo-symbol-fullcolor-{bgname}.png", 256)


def icon(variant, field, size=256, clear=0.16):
    """Symbol centered on a solid field with ≥14% clear space per side (§3 App icon).
    Square, no inner rounded container: the OS or browser applies its own mask."""
    sym = crop(variant, SYMBOL)
    inner = round(size * (1 - 2 * clear))
    s = inner / max(sym.size)
    sym = sym.resize((round(sym.width * s), round(sym.height * s)), Image.LANCZOS)
    tile = Image.new("RGBA", (size, size), tuple(int(c) for c in field) + (255,))
    tile.alpha_composite(sym, ((size - sym.width) // 2, (size - sym.height) // 2))
    return tile


icons = {"light": icon(LIGHT, BONE), "dark": icon(DARK, INK)}
for bgname, tile in icons.items():
    tile.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, f"cue-logo-symbol-fullcolor-{bgname}-64.png"), optimize=True)

# Review sheet (§3 Favicon: test at 16, 20, 24 and 32 px on light and dark browser chrome).
sizes = [16, 20, 24, 32]
sheet = Image.new("RGBA", (40 + 60 * len(sizes) * 2, 160), (255, 255, 255, 255))
for row, chrome in enumerate([(0xDE, 0xE1, 0xE6), (0x20, 0x21, 0x24)]):
    band = Image.new("RGBA", (sheet.width, 80), chrome + (255,))
    for k, size in enumerate(sizes):
        for j, tile in enumerate(icons.values()):
            band.alpha_composite(tile.resize((size, size), Image.LANCZOS), (20 + (k * 2 + j) * 60, (80 - size) // 2))
    sheet.alpha_composite(band, (0, row * 80))
sheet.convert("RGB").resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(os.path.join(REVIEW, "favicon-preview.png"))

print("split", split, "symbol", SYMBOL, "wordmark", WORDMARK)
