"""
Fit check: Zoo enclosure (base + cover STLs, assembled, PCB coordinates) vs the board STL.

    env/bin/python fitcheck.py board.stl base.stl cover.stl

Reports:
  - board/part surface points INSIDE the case (collisions) or closer than 0.15 mm, grouped by component
  - board flat on the base floor under the bone sensor (U3) and wear pad (E1)
  - hold-down features: cover faces just above the board, and what is underneath each
  - minimum wall thickness (ray cast along the inward normal)
  - overall size
"""
import sys
import numpy as np
import trimesh
from scipy.cluster.hierarchy import fcluster, linkage

board_p, base_p, cover_p = sys.argv[1:4]
CLR = 0.15
BOARD_TOP_MODEL = 1.51   # KiCad's 3D board body leaves out copper/mask; the real board is 1.6 mm +/-10%

BOXES = {
    "U1 radio": (1.7, 11.7, 8.0, 22.0, 3.2), "J1 USB-C": (26.1, 32.9, 10.4, 19.4, 5.2),
    "J2 battery conn": (24.9, 32.5, 0.9, 8.8, 6.4), "J3 motor conn": (18.3, 22.3, 0.9, 5.2, 4.6),
    "J4 debug": (4.2, 9.7, 0.7, 7.1, 6.1), "SW1 calibrate": (0.5, 3.0, 2.4, 5.4, 3.2),
    "SW2 power": (20.9, 23.9, 7.4, 9.9, 3.2), "U4 mic": (12.2, 15.7, 7.8, 10.5, 2.6),
    "U2 power chip": (16.5, 21.5, 3.0, 8.0, 2.4),
}


def label(p):
    x, y, z = p
    if z < 0.2:
        return "board underside"
    if z <= 1.65:
        return "board edge/top"
    for k, (x0, x1, y0, y1, zt) in BOXES.items():
        if x0 - 0.3 <= x <= x1 + 0.3 and y0 - 0.3 <= y <= y1 + 0.3 and z <= zt + 0.3:
            return k
    return "small part"


def load(p):
    m = trimesh.load(p, force="mesh")
    m.merge_vertices(digits_vertex=4)
    print(f"  {p.split('/')[-1]}: {len(m.faces)} faces, watertight={m.is_watertight}, "
          f"bounds {np.round(m.bounds[0], 2)} .. {np.round(m.bounds[1], 2)}")
    return m


print("loading")
board = load(board_p)
base = load(base_p)
cover = load(cover_p)
both = np.vstack([base.bounds, cover.bounds])
print(f"  overall size: {np.round(both.max(0) - both.min(0), 2)} mm (X, Y, Z)")

pts, _ = trimesh.sample.sample_surface_even(board, 250000)
pts = np.vstack([pts, board.vertices])

for name, case in (("BASE", base), ("COVER", cover)):
    print(f"\n=== {name}: clearance to the board and parts")
    near = case.nearest.on_surface(pts)[1]
    inside = case.contains(pts)
    sd = np.where(inside, -near, near)
    under = pts[:, 2] < 0.2
    bad = np.where(under & (name == "BASE"), sd < -0.05, sd < CLR - 0.006)
    groups = {}
    for p, d in zip(pts[bad], sd[bad]):
        g = groups.setdefault(label(p), [np.inf, None, 0])
        g[2] += 1
        if d < g[0]:
            g[0], g[1] = d, p
    if not groups:
        print("  OK: nothing closer than 0.15 mm, no collisions")
    for k, (dmin, p, n) in sorted(groups.items(), key=lambda kv: kv[1][0]):
        kind = "INSIDE the case (collision)" if dmin < -0.01 else ("touching" if dmin < 0.01 else "closer than 0.15 mm")
        print(f"  {k:18} worst {dmin:+.3f} mm at ({p[0]:.2f}, {p[1]:.2f}, {p[2]:.2f}) - {kind}, {n} pts")

print("\n=== floor contact (board underside to base)")
for k, (x0, x1, y0, y1) in {"U3 bone sensor": (16.0, 19.0, 5.6, 9.2), "E1 wear pad": (10.6, 14.6, 4.2, 7.2)}.items():
    g = np.array([[x, y, -0.001] for x in np.linspace(x0, x1, 12) for y in np.linspace(y0, y1, 12)])
    d = base.nearest.on_surface(g)[1]
    print(f"  {k:16} gap to floor: max {d.max():.3f} mm")

print("\n=== hold-down features (cover faces facing down, over the board, below Z 3)")
c, n = cover.triangles_center, cover.face_normals
F = np.where((n[:, 2] < -0.9) & (c[:, 0] > -0.2) & (c[:, 0] < 33.1) & (c[:, 1] > -0.2) & (c[:, 1] < 21.0) & (c[:, 2] < 3.0))[0]
if len(F) > 1:
    L = fcluster(linkage(c[F][:, :2], "single"), 1.0, "distance")
    for k in np.unique(L):
        p = c[F[L == k]]
        (x0, y0), (x1, y1), z = p[:, :2].min(0), p[:, :2].max(0), p[:, 2].min()
        tops = []
        for x in np.linspace(x0, x1, 4):
            for y in np.linspace(y0, y1, 4):
                loc, _, _ = board.ray.intersects_location([[x, y, 9.0]], [[0, 0, -1]])
                tops.append(loc[:, 2].max() if len(loc) else np.nan)
        tops = np.array(tops)
        if np.all(np.isnan(tops)):
            what = "MISSES the board"
        elif np.nanmax(tops) > BOARD_TOP_MODEL + 0.03:
            what = f"over a PART (top Z {np.nanmax(tops):.2f})"
        else:
            what = f"bare board, {z - 1.6:+.2f} mm above a nominal 1.6 mm board"
        print(f"  X {x0:5.2f}-{x1:5.2f}  Y {y0:5.2f}-{y1:5.2f}  underside Z {z:.2f}  size {x1 - x0:.2f} x {y1 - y0:.2f}: {what}")
else:
    print("  none found")

print("\n=== minimum wall thickness (ray cast)")
for name, case in (("BASE", base), ("COVER", cover)):
    s, fi = trimesh.sample.sample_surface_even(case, 40000)
    nn_ = -case.face_normals[fi]
    o = s + nn_ * 1e-4
    loc, ri, _ = case.ray.intersects_location(o, nn_, multiple_hits=False)
    t = np.full(len(s), np.inf)
    t[ri] = np.linalg.norm(loc - o[ri], axis=1)
    ok = np.isfinite(t)
    tt, ss = t[ok], s[ok]
    order = np.argsort(tt)[:5]
    thin = "; ".join(f"{tt[i]:.2f} @ ({ss[i][0]:.1f}, {ss[i][1]:.1f}, {ss[i][2]:.1f})" for i in order)
    print(f"  {name}: thinnest {thin}")
    print(f"  {name}: share of surface under 0.55 mm: {(tt < 0.55).mean():.1%}")
