"""Slim Cue body: inside fit study (v0). Draws a side section and a plan view with the parts to scale (mm)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch, Circle

WALL = 0.8
BODY = dict(L=38.0, B=12.0, T=8.6)          # outer: length, depth (front-back), thickness (head to outside)
IN = dict(L=BODY["L"] - 2 * WALL, B=BODY["B"] - 2 * WALL, T=BODY["T"] - 2 * WALL)
parts = {  # name: (x0 along length from the bottom inside wall, length, z0 from the head-side inside wall, height, depth, colour)
    "motor 8 x 3.25":            (0.4, 8.0, 0.0, 3.25, 8.0, "#8a8f98"),
    "board 0.6 (24.5 x 9.6)":    (8.9, 24.5, 0.0, 0.6, 9.6, "#2e7d5b"),
    "power chip, sensor, mic,\ndriver, passives (<= 1.0)": (9.4, 14.5, 0.6, 1.0, 9.0, "#555b66"),
    "radio BL54L15u 7.9 x 6.3 x 1.75": (25.0, 7.9, 0.6, 1.75, 6.3, "#3b6ea8"),
    "battery 351020 + PCM\n3.5 x 10 x 22, ~55 mAh": (0.9, 22.0, 3.45, 3.5, 10.0, "#c98a2b"),
    "charge pads": (33.6, 2.2, 0.0, 0.3, 6.0, "#d4b24a"),
}
fig, ax = plt.subplots(2, 1, figsize=(11, 7.2), gridspec_kw=dict(height_ratios=[1, 1.25]))
for a, title in zip(ax, ["Side section (head side at the bottom)", "Plan view from outside (looking at the head)"]):
    a.set_aspect("equal"); a.set_title(title, loc="left", fontsize=11); a.axis("off")
a = ax[0]
a.add_patch(FancyBboxPatch((0, 0), BODY["L"], BODY["T"], boxstyle="round,pad=0,rounding_size=2.2", fc="#e9e6e1", ec="#444", lw=1.5))
a.add_patch(FancyBboxPatch((WALL, WALL), IN["L"], IN["T"], boxstyle="round,pad=0,rounding_size=1.4", fc="white", ec="#999", lw=0.8))
for name, (x0, ln, z0, h, d, c) in parts.items():
    a.add_patch(Rectangle((WALL + x0, WALL + z0), ln, h, fc=c, ec="k", lw=0.6, alpha=0.9))
    a.text(WALL + x0 + ln / 2, WALL + z0 + h / 2, name, ha="center", va="center", fontsize=6.5, color="white" if c not in ("#d4b24a",) else "k")
a.annotate("flat head-side wall: bone sensor presses here", (19, 0), (19, -2.3), ha="center", fontsize=8, arrowprops=dict(arrowstyle="->", lw=0.8))
a.annotate("wire / hook end ->", (BODY["L"], BODY["T"] / 2), (BODY["L"] + 1, BODY["T"] / 2), fontsize=8, va="center")
a.text(-1, BODY["T"] / 2, "bottom", fontsize=8, ha="right", va="center")
a.text(BODY["L"] / 2, BODY["T"] + 0.7, f"{BODY['L']:.0f} mm long x {BODY['T']} mm thick (inside {IN['T']:.1f})", ha="center", fontsize=8)
a.set_xlim(-6, BODY["L"] + 12); a.set_ylim(-3.5, BODY["T"] + 2)
a = ax[1]
a.add_patch(FancyBboxPatch((0, 0), BODY["L"], BODY["B"], boxstyle="round,pad=0,rounding_size=4.5", fc="#e9e6e1", ec="#444", lw=1.5))
a.add_patch(FancyBboxPatch((WALL, WALL), IN["L"], IN["B"], boxstyle="round,pad=0,rounding_size=3.7", fc="white", ec="#999", lw=0.8))
cy = BODY["B"] / 2
for name, (x0, ln, z0, h, d, c) in parts.items():
    if name.startswith("motor"):
        a.add_patch(Circle((WALL + x0 + 4, cy), 4, fc=c, ec="k", lw=0.6, alpha=0.9))
    else:
        a.add_patch(Rectangle((WALL + x0, cy - d / 2), ln, d, fc=c, ec="k", lw=0.6, alpha=0.55 if name.startswith("battery") else 0.9))
a.text(WALL + 0.9 + 11, cy + 4.0, "battery (above board and motor)", ha="center", fontsize=7)
a.text(BODY["L"] / 2, BODY["B"] + 0.7, f"{BODY['B']:.0f} mm deep (inside {IN['B']:.1f})", ha="center", fontsize=8)
a.set_xlim(-6, BODY["L"] + 12); a.set_ylim(-2, BODY["B"] + 2)
fig.suptitle("Cue slim body: inside fit study v0 (straight section; the curved neck above holds only the wire)", fontsize=12, y=0.98)
fig.tight_layout()
fig.savefig("slim/fit_study.png", dpi=170)
# volume + stack numbers
stack = 0.6 + 1.0 + 3.5
print(f"inside: {IN['L']:.1f} x {IN['B']:.1f} x {IN['T']:.1f} mm")
print(f"thickness stack over the board: board 0.6 + parts 1.0 + battery 3.5 = {stack:.1f} of {IN['T']:.1f} mm ({IN['T']-stack:.1f} spare)")
print(f"thickness stack at the motor: motor 3.25 + gap 0.2 + battery 3.5 = {3.25+0.2+3.5:.2f} of {IN['T']:.1f} mm")
print(f"length used: battery end {0.9+22:.1f}, radio end {25+7.9:.1f}, pads end {33.6+2.2:.1f} of {IN['L']:.1f} mm")
print(f"depth: battery 10.0 of {IN['B']:.1f} mm ({(IN['B']-10)/2:.1f} mm clearance each side)")
