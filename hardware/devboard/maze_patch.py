"""Finish connections the autorouter left open, with a small grid router (outer layers + through vias).

    python3 maze_patch.py          # reads drc.rpt, patches cue_devboard.kicad_pcb, refills, re-runs DRC

Obstacles (other-net tracks, vias, pads, antenna keep-out, edge band) are rasterised at 0.1 mm with the track
clearance added, then each open connection is A*-routed from one side to any copper of the other side. Nets that
own an inner plane (GND, 1V8) only need a via that reaches the plane.
"""
import heapq
import math
import os
import re

import pcbnew

import build_board as B

G = 0.1                       # grid, mm
TW, CLR, VD, VDRILL = 0.127, 0.127, 0.45, 0.2
PLANE_NETS = {"GND", "1V8"}
NX, NY = int(B.W / G) + 1, int(B.H / G) + 1
LAYERS = (pcbnew.F_Cu, pcbnew.B_Cu)
mm = pcbnew.ToMM


def cell(x, y):
    return int(round(x / G)), int(round(y / G))


def raster(board, net_code, acc):
    """blocked[layer] = set of cells within `acc` of other-net copper on that layer."""
    blocked = {l: set() for l in LAYERS}

    def mark(item, layers, pad=False):
        bb = item.GetBoundingBox()
        x1, y1 = cell(mm(bb.GetLeft()) - acc, mm(bb.GetTop()) - acc)
        x2, y2 = cell(mm(bb.GetRight()) + acc, mm(bb.GetBottom()) + acc)
        a = pcbnew.FromMM(acc)
        for i in range(max(0, x1), min(NX, x2 + 1)):
            for j in range(max(0, y1), min(NY, y2 + 1)):
                p = pcbnew.VECTOR2I(pcbnew.FromMM(i * G), pcbnew.FromMM(j * G))
                if item.HitTest(p, a):
                    for l in layers:
                        blocked[l].add((i, j))

    for t in board.GetTracks():
        if t.GetNetCode() == net_code:
            continue
        mark(t, LAYERS if t.GetClass() == "PCB_VIA" else [t.GetLayer()] if t.GetLayer() in LAYERS else [])
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            if pad.GetNetCode() == net_code and pad.GetAttribute() != pcbnew.PAD_ATTRIB_NPTH:
                continue
            mark(pad, [l for l in LAYERS if pad.IsOnLayer(l)])
    kx1, ky1, kx2, ky2 = B.ANT_KEEPOUT
    edge = 0.35 + acc
    for i in range(NX):
        for j in range(NY):
            x, y = i * G, j * G
            if (kx1 - acc <= x <= kx2 + acc and ky1 - acc <= y <= ky2 + acc) or \
                    x < edge or y < edge or x > B.W - edge or y > B.H - edge:
                for l in LAYERS:
                    blocked[l].add((i, j))
    return blocked


def item_cells(item, layers):
    bb = item.GetBoundingBox()
    x1, y1 = cell(mm(bb.GetLeft()), mm(bb.GetTop()))
    x2, y2 = cell(mm(bb.GetRight()), mm(bb.GetBottom()))
    out = set()
    for i in range(x1, x2 + 1):
        for j in range(y1, y2 + 1):
            if item.HitTest(pcbnew.VECTOR2I(pcbnew.FromMM(i * G), pcbnew.FromMM(j * G)), 0):
                for l in layers:
                    out.add((l, i, j))
    return out


def item_layers(item):
    if item.GetClass() == "PCB_VIA":
        return list(LAYERS)
    if item.GetClass() == "PCB_PAD":
        return [l for l in LAYERS if item.IsOnLayer(l)]
    return [item.GetLayer()] if item.GetLayer() in LAYERS else []


def astar(starts, goal_fn, blocked, via_ok, near):
    """starts: set of (layer, i, j). Returns list of (layer, i, j) or None."""
    gx, gy = near
    h = lambda i, j: math.hypot(i - gx, j - gy) * 0.7
    openq, came, cost = [], {}, {}
    for s in starts:
        cost[s] = 0
        heapq.heappush(openq, (h(s[1], s[2]), s))
    steps = [(1, 0, 1), (-1, 0, 1), (0, 1, 1), (0, -1, 1), (1, 1, 1.42), (1, -1, 1.42), (-1, 1, 1.42), (-1, -1, 1.42)]
    n = 0
    while openq and n < 400000:
        _, cur = heapq.heappop(openq)
        n += 1
        if goal_fn(cur):
            path = [cur]
            while cur in came:
                cur = came[cur]
                path.append(cur)
            return path[::-1]
        l, i, j = cur
        nbrs = []
        for di, dj, c in steps:
            nb = (l, i + di, j + dj)
            if 0 <= nb[1] < NX and 0 <= nb[2] < NY and ((nb[1], nb[2]) not in blocked[l] or nb in starts):
                nbrs.append((nb, c))
        if (i, j) in via_ok:
            other = LAYERS[1] if l == LAYERS[0] else LAYERS[0]
            nbrs.append(((other, i, j), 12))
        for nb, c in nbrs:
            nc = cost[cur] + c
            if nc < cost.get(nb, 1e18):
                cost[nb] = nc
                came[nb] = cur
                heapq.heappush(openq, (nc + h(nb[1], nb[2]), nb))
    return None


def add_path(board, net, path, end_via=False):
    """Turn a cell path into tracks (collinear runs merged) and vias at layer changes."""
    segs, vias = [], []
    run = [path[0]]
    for a, b in zip(path, path[1:]):
        if a[0] != b[0]:
            vias.append((a[1], a[2]))
            if len(run) > 1:
                segs.append((run[0], run[-1]))
            run = [b]
            continue
        if len(run) >= 2:
            d1 = (run[-1][1] - run[-2][1], run[-1][2] - run[-2][2])
            d2 = (b[1] - a[1], b[2] - a[2])
            if d1 != d2:
                segs.append((run[0], run[-1]))
                run = [a]
        run.append(b)
    if len(run) > 1:
        segs.append((run[0], run[-1]))
    if end_via:
        vias.append((path[-1][1], path[-1][2]))
    for s, e in segs:
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(B.V(s[1] * G, s[2] * G))
        t.SetEnd(B.V(e[1] * G, e[2] * G))
        t.SetWidth(B.MM(TW))
        t.SetLayer(s[0])
        t.SetNet(net)
        board.Add(t)
    for i, j in vias:
        v = pcbnew.PCB_VIA(board)
        v.SetPosition(B.V(i * G, j * G))
        v.SetWidth(B.MM(VD))
        v.SetDrill(B.MM(VDRILL))
        v.SetViaType(pcbnew.VIATYPE_THROUGH)
        v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
        v.SetNet(net)
        board.Add(v)
    return len(segs), len(vias)


def _touch(p, q):
    """Copper items p and q of one net overlap (checked at track ends / pad and via centres, layer-aware)."""
    if not set(item_layers(p)) & set(item_layers(q)):
        return False
    for it, other in ((p, q), (q, p)):
        pts = [it.GetStart(), it.GetEnd()] if it.GetClass() == "PCB_TRACK" else [it.GetPosition()]
        for pt in pts:
            if other.HitTest(pt, 0):
                return True
    return False


def cluster(board, item):
    """All tracks, vias and pads of item's net that are copper-connected to item."""
    code = item.GetNetCode()
    items = [t for t in board.GetTracks() if t.GetNetCode() == code]
    items += [pd for fp in board.GetFootprints() for pd in fp.Pads() if pd.GetNetCode() == code]
    seen, todo = {id(item)}, [item]
    out = [item]
    while todo:
        cur = todo.pop()
        for it in items:
            if id(it) not in seen and _touch(cur, it):
                seen.add(id(it))
                todo.append(it)
                out.append(it)
    return out


def find_item(board, kind, x, y, netname):
    p = pcbnew.VECTOR2I(pcbnew.FromMM(x), pcbnew.FromMM(y))
    if kind == "Pad":
        for fp in board.GetFootprints():
            for pad in fp.Pads():
                if pad.GetNetname() == netname and pad.HitTest(p, pcbnew.FromMM(0.01)):
                    return pad
    for t in board.GetTracks():
        if t.GetNetname() == netname and t.HitTest(p, pcbnew.FromMM(0.01)):
            return t
    return None


def patch(board, rpt):
    """Route every open connection listed in a DRC report. Returns the number routed."""
    txt = open(rpt).read()
    done = 0
    for blk in re.split(r"\n(?=\[)", txt):
        if not blk.startswith("[unconnected_items]"):
            continue
        pts = re.findall(r"@\(([\d.]+) mm, ([\d.]+) mm\): (Pad|Via|Track)[^\[]*\[([^\]]+)\]", blk)
        if len(pts) != 2:
            continue
        (xa, ya, ka, na), (xb, yb, kb, nb) = pts
        net = board.FindNet(na)
        a = find_item(board, ka, float(xa), float(ya), na)
        b = find_item(board, kb, float(xb), float(yb), nb)
        if a is None or b is None:
            print("  maze: item not found:", na)
            continue
        blocked = raster(board, net.GetNetCode(), CLR + TW / 2 + 0.075)
        vblock = raster(board, net.GetNetCode(), CLR + VD / 2 + 0.05)
        holes = [(mm(t.GetPosition().x), mm(t.GetPosition().y)) for t in board.GetTracks() if t.GetClass() == "PCB_VIA"]
        near_hole = set()
        for hx, hy in holes:  # keep drill-to-drill spacing to every via, any net
            ci, cj = cell(hx, hy)
            for i in range(ci - 7, ci + 8):
                for j in range(cj - 7, cj + 8):
                    if math.hypot(i * G - hx, j * G - hy) < VDRILL + 0.3:  # drill-to-drill >= 0.3 mm edge gap
                        near_hole.add((i, j))
        via_ok = {(i, j) for i in range(NX) for j in range(NY)
                  if (i, j) not in vblock[LAYERS[0]] and (i, j) not in vblock[LAYERS[1]] and (i, j) not in near_hole}
        starts = item_cells(a, item_layers(a))
        if na in PLANE_NETS and ka == "Pad":
            start_xy = {(s_[1], s_[2]) for s_ in starts}
            path = astar(starts, lambda c: (c[1], c[2]) in via_ok and (c[1], c[2]) not in start_xy,
                         blocked, set(), cell(float(xa), float(ya)))
            if path:
                ns, _ = add_path(board, net, path, end_via=True)
                print(f"  maze {na}: pad -> plane via ({ns} segments)")
                done += 1
                continue
        targets = set()
        for it in cluster(board, b):
            targets |= item_cells(it, item_layers(it))
        targets -= starts
        path = astar(starts, lambda c: c in targets, blocked, via_ok, cell(float(xb), float(yb)))
        if path:
            ns, nv = add_path(board, net, path)
            print(f"  maze {na}: routed ({ns} segments, {nv} vias)")
            done += 1
        else:
            print(f"  maze {na}: NO PATH")
    return done


if __name__ == "__main__":
    os.environ.setdefault("KICAD7_FOOTPRINT_DIR", "/usr/share/kicad/footprints")
    brd = pcbnew.LoadBoard(B.PCB)
    rpt_ = os.path.join(B.HERE, "drc.rpt")
    print("maze-patched:", patch(brd, rpt_))
    pcbnew.SaveBoard(B.PCB, brd)
