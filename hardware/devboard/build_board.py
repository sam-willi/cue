"""
Build the Cue rev A dev board in KiCad 7: footprints, nets, placement, planes, autoroute, DRC, fab outputs.

    python3 build_board.py            # full build
    python3 build_board.py --place    # stop after placement (no routing) for a quick look

Inputs:  devboard_circuit.py (parts + nets), Cue.pretty (custom footprints), KiCad 7 libraries,
         freerouting.jar (path in FREEROUTING env var or ./tools/freerouting.jar).
Outputs: cue_devboard.kicad_pcb / .kicad_pro, fab/ (gerbers, drill, BOM, CPL), renders/, drc.rpt
"""
import math
import os
import shutil
import subprocess
import sys

import pcbnew

import devboard_circuit as C

HERE = os.path.dirname(os.path.abspath(__file__))
PCB = os.path.join(HERE, "cue_devboard.kicad_pcb")
CUE_LIB = os.path.join(HERE, "Cue.pretty")
MM = pcbnew.FromMM
W, H = 42.0, 32.0                   # board outline, mm
# BL54L15 (453-00044) on the top edge, centred, inset 0.1 mm so its edge pads keep 0.3 mm copper-to-edge. The MHF4
# variant has no on-board antenna, so there is no Ezurio keep-out; the RF end still faces the edge so the antenna
# cable leaves the board directly, and no tracks or vias run under the RF end (the module's RF trace / connector).
U1_X, U1_Y = W / 2, 7.1              # module centre; footprint rotated 90 so its RF end (+X) faces the top edge
# RF end of the module (footprint BL15_RF rotated 90 deg): x = centre -5 .. +3.5, y = top edge .. centre -2
ANT_KEEPOUT = (U1_X - 5.0, 0.0, U1_X + 3.5, U1_Y - 2.0)


def V(x, y):
    return pcbnew.VECTOR2I(MM(x), MM(y))


# nPM1300 block: U2 and its buck / VSET / VDDIO parts, laid out as Nordic PS 9.3.4 (offsets from U2 centre)
U2_X, U2_Y = 11.0, 18.6
_U2_BLOCK = {
    "U2": (0, 0, 180), "C5": (4.75, 0.25, 0), "L1": (5.35, 2.05, 0), "L2": (5.35, -1.55, 0),
    "C6": (7.9, 3.15, 270), "C7": (7.9, -2.65, 90), "C17": (-4.2, 0.9, 90),
    "R4": (-3.7, -4.8, 0), "R3": (-3.7, -3.8, 0), "C22": (3.7, -4.1, 90),
}
# ------------------------------------------------------------------ fixed placement: ref -> (x, y, rot, side)
FIXED = {
    "U1": (U1_X, U1_Y, 90, "F"),   # module on top edge centre, RF end at the edge
    "J4": (31.5, 4.6, 0, "F"),     # SWD beside the module's SWD pads (5-7, right side)
    "J1": (3.4, 7.8, -90, "F"),    # USB-C, mouth to the left edge
    "SW2": (3.6, 17.6, 0, "F"),    # ship/wake, between USB-C and the battery connector
    "J2": (4.6, H - 4.9, 0, "F"),  # battery (JST-PH), mouth to bottom edge
    "SW1": (28.0, 24.2, 0, "F"),   # user button
    "U5": (30.0, 12.0, 90, "F"),   # DRV2605L beside the HAPTIC pads (8-10, right side)
    "J3": (35.0, H - 3.2, 0, "F"),  # LRA, mouth to bottom edge; right of the mic so the motor lines stay clear of PDM
    "J5": (37.4, 12.6, 0, "F"),    # expansion 2x5 2.54 (origin = pin 1)
    "U3": (21.8, 18.6, 0, "F"),    # LSM6DSV16BX under the module's TDM / I2C pads
    "U4": (26.2, 18.6, 90, "F"),   # T5838 (bottom port hole in footprint)
    "E1": (23.0, H - 3.0, 0, "F"),  # touch pad, under U3 (Qvar)
    "FID1": (W - 1.0, H - 1.0, 0, "F"),
    "FID2": (W - 1.0, 1.2, 0, "F"),
    "FID3": (1.0, 0.8, 0, "F"),
}
for _r, (_dx, _dy, _rot) in _U2_BLOCK.items():
    FIXED[_r] = (round(U2_X + _dx, 2), round(U2_Y + _dy, 2), _rot, "F")
# which pin each small part should sit next to: ref -> (anchor ref, anchor pad)
ANCHOR = {   # placed in this order: Note 7 resistors (must hug the module), buck loop, rail caps, then the rest
    "R7": ("U1", "35"), "R8": ("U1", "28"),

    "C4": ("U2", "20"), "C1": ("U2", "21"), "C3": ("U2", "19"), "C19": ("U2", "29"),
    "R1": ("J5", "5"), "R2": ("J5", "6"), "C2": ("U2", "21"),
    "D1": ("J1", "A9"), "C18": ("U1", "26"), "C16": ("U1", "26"),
    "C8": ("U3", "8"), "C9": ("U3", "5"), "R6": ("U3", "6"),
    "C10": ("U4", "7"),
    "C11": ("U5", "10"), "C12": ("U5", "1"),
    "C20": ("C5", "1"), "C21": ("U2", "4"), "RT1": ("U2", "18"),
}
UNPLACED = []
# plain silkscreen labels (text, x, y) - placed in clear areas, checked by DRC
SILK_LABELS = [("BATT", 11.2, H - 1.2), ("LRA", 35.0, H - 6.8), ("SWD", 37.6, 4.6), ("EXP", 38.7, 10.0),
               ("+", 3.6, 21.4), ("-", 5.6, 21.4), ("SHIP", 3.6, 14.7), ("USER", 28.0, 21.9), ("TOUCH", 23.0, H - 5.5)]
BOTTOM_LABELS = []  # test-point labels are added next to each TP
USED_LIBS = set()
PASSES = 100
POWER_NETS = {"VBUS", "VBAT", "VSYS", "SW1", "SW2", "1V8", "3V0", "MIC_1V8", "LRA_P", "LRA_N", "VBUSOUT"}


MODEL_OVERRIDES = {}  # U5 / J2 now use Cue.pretty copies that carry project-local 3D models


def load_fp(p):
    lib = CUE_LIB if p["lib"] == C.CUE else p["lib"]
    fp = pcbnew.FootprintLoad(lib, p["fp"])
    if fp is None:
        raise SystemExit(f"footprint not found: {lib}:{p['fp']}")
    if p["fp"] in MODEL_OVERRIDES:  # project-local model (see make_3d.py)
        fp.Models().clear()
        m = pcbnew.FP_3DMODEL()
        m.m_Filename = "${KIPRJMOD}/Cue.3dshapes/" + MODEL_OVERRIDES[p["fp"]] + ".wrl"
        fp.Models().push_back(m)
    nick = os.path.basename(lib.rstrip("/")).replace(".pretty", "")
    fp.SetFPID(pcbnew.LIB_ID(nick, p["fp"]))
    USED_LIBS.add(nick)
    return fp


def crtyd_box(fp):
    """Axis-aligned courtyard box in board coords (mm) on the footprint's side."""
    layer = pcbnew.F_CrtYd if not fp.IsFlipped() else pcbnew.B_CrtYd
    xs, ys = [], []
    for g in fp.GraphicalItems():
        if g.GetLayer() == layer:
            bb = g.GetBoundingBox()
            xs += [bb.GetLeft(), bb.GetRight()]
            ys += [bb.GetTop(), bb.GetBottom()]
    if not xs:  # fall back to pads
        bb = fp.GetBoundingBox(False, False)
        xs, ys = [bb.GetLeft(), bb.GetRight()], [bb.GetTop(), bb.GetBottom()]
    return tuple(pcbnew.ToMM(v) for v in (min(xs), min(ys), max(xs), max(ys)))


def overlaps(a, b, m=0.1):
    return not (a[2] + m <= b[0] or b[2] + m <= a[0] or a[3] + m <= b[1] or b[3] + m <= a[1])


def inside(a, m=0.25):
    return a[0] >= m and a[1] >= m and a[2] <= W - m and a[3] <= H - m


def build(place_only=False):
    board = pcbnew.CreateEmptyBoard()
    board.SetCopperLayerCount(4)
    # Stack-up SIG / GND / 1V8 / SIG. Inner layers are typed as power planes so the autorouter keeps
    # every signal on the outer layers and both planes stay solid.
    board.SetLayerType(pcbnew.In1_Cu, pcbnew.LT_POWER)
    board.SetLayerType(pcbnew.In2_Cu, pcbnew.LT_POWER)
    ds = board.GetDesignSettings()
    ds.SetCopperLayerCount(4)
    # JLCPCB 4-layer standard capability with margin
    ds.m_TrackMinWidth = MM(0.1)
    ds.m_MinClearance = MM(0.1)
    ds.m_ViasMinSize = MM(0.4)
    ds.m_MinThroughDrill = MM(0.2)
    ds.m_HoleClearance = MM(0.2)
    ds.m_HoleToHoleMin = MM(0.25)
    ds.m_CopperEdgeClearance = MM(0.3)
    ds.m_SolderMaskMinWidth = MM(0.0)
    nc_default = ds.m_NetSettings.m_DefaultNetClass
    nc_default.SetTrackWidth(MM(0.127))
    nc_default.SetClearance(MM(0.127))   # routes with margin; DRC minimum stays 0.1
    nc_default.SetViaDiameter(MM(0.45))
    nc_default.SetViaDrill(MM(0.2))
    pwr = pcbnew.NETCLASS("Power")
    pwr.SetTrackWidth(MM(0.3))
    pwr.SetClearance(MM(0.12))
    pwr.SetViaDiameter(MM(0.5))
    pwr.SetViaDrill(MM(0.25))
    ds.m_NetSettings.m_NetClasses["Power"] = pwr

    # nets
    netmap = {}
    for name in sorted(C.nets()):
        ni = pcbnew.NETINFO_ITEM(board, name)
        board.Add(ni)
        netmap[name] = ni
    for name in POWER_NETS:
        netmap[name].SetNetClass(ds.m_NetSettings.m_NetClasses["Power"])

    # outline
    for (x1, y1, x2, y2) in [(0, 0, W, 0), (W, 0, W, H), (W, H, 0, H), (0, H, 0, 0)]:
        s = pcbnew.PCB_SHAPE(board, pcbnew.SHAPE_T_SEGMENT)
        s.SetStart(V(x1, y1))
        s.SetEnd(V(x2, y2))
        s.SetLayer(pcbnew.Edge_Cuts)
        s.SetWidth(MM(0.1))
        board.Add(s)

    # footprints
    fps, top_boxes, bot_boxes = {}, [], []
    keep = ANT_KEEPOUT
    for ref, p in C.PARTS.items():
        fp = load_fp(p)
        fp.SetReference(ref)
        fp.SetValue(p["value"])
        fp.SetField("MPN", p["mpn"]) if hasattr(fp, "SetField") else None
        board.Add(fp)
        for pad in fp.Pads():
            net = p["pins"].get(pad.GetNumber())
            if net:
                pad.SetNet(netmap[net])
        fps[ref] = fp
        # reference designators live on the assembly (Fab) layer; silkscreen carries plain labels instead
        rt = fp.Reference()
        rt.SetTextSize(V(0.6, 0.6))
        rt.SetTextThickness(MM(0.1))
        rt.SetLayer(pcbnew.F_Fab)

    def put(ref, x, y, rot, side):
        fp = fps[ref]
        if side == "B" and not fp.IsFlipped():
            fp.Flip(fp.GetPosition(), False)
        fp.SetOrientationDegrees(rot)
        fp.SetPosition(V(x, y))
        return crtyd_box(fp)

    for ref, (x, y, rot, side) in FIXED.items():
        box = put(ref, x, y, rot, side)
        (top_boxes if side == "F" else bot_boxes).append((ref, box))
        if any(pd.GetAttribute() == pcbnew.PAD_ATTRIB_PTH for pd in fps[ref].Pads()):
            bot_boxes.append((ref, box))  # its pins come through to the bottom

    # escape lanes in front of crowded fine-pitch pins: reserved before the small parts are placed
    for ref, pads in LANES.items():
        fp = fps[ref]
        c = fp.GetPosition()
        cx, cy = pcbnew.ToMM(c.x), pcbnew.ToMM(c.y)
        for pad in fp.Pads():
            if pad.GetNumber() not in pads:
                continue
            px, py = pcbnew.ToMM(pad.GetPosition().x), pcbnew.ToMM(pad.GetPosition().y)
            half = max(pcbnew.ToMM(pad.GetSize().x), pcbnew.ToMM(pad.GetSize().y)) / 2
            if abs(px - cx) > abs(py - cy):
                sx = 1 if px > cx else -1
                x1, x2 = sorted((px + sx * half, px + sx * (half + 1.8)))
                top_boxes.append(("lane", (x1, py - 0.25, x2, py + 0.25)))
            else:
                sy = 1 if py > cy else -1
                y1, y2 = sorted((py + sy * half, py + sy * (half + 1.8)))
                top_boxes.append(("lane", (px - 0.25, y1, px + 0.25, y2)))

    # anchored small parts: spiral search around the anchor pad
    def place_near(ref, ax, ay, side, boxes, avoid_keepout=True, rmin=0.0):
        for r in [rmin + i * 0.1 for i in range(0, 120)]:
            steps = max(1, int(2 * math.pi * r / 0.25)) if r > 0 else 1
            for k in range(steps):
                t = 2 * math.pi * k / steps
                x, y = ax + r * math.cos(t), ay + r * math.sin(t)
                for rot in (0, 90):
                    box = put(ref, round(x, 2), round(y, 2), rot, side)
                    if not inside(box):
                        continue
                    if avoid_keepout and overlaps(box, keep, 0.2):
                        continue
                    if any(overlaps(box, b) for _, b in boxes):
                        continue
                    boxes.append((ref, box))
                    return True
        return False

    for ref, (aref, apad) in ANCHOR.items():
        pad = [p for p in fps[aref].Pads() if p.GetNumber() == apad][0]
        pos = pad.GetPosition()
        # leave an escape channel around fine-pitch ICs so the router can fan their pins out
        rmin = {"U2": 2.2, "U3": 1.2}.get(aref, 0.0)
        if not place_near(ref, pcbnew.ToMM(pos.x), pcbnew.ToMM(pos.y), "F", top_boxes, rmin=rmin):
            UNPLACED.append(ref)
    # test points on the bottom, spread along the lower half
    tp_spots = [(2.0, 17.5), (7.0, 25.5), (15.0, 26.0), (28.5, 15.5), (13.0, 4.0), (28.0, 26.0), (3.0, 3.0),
                (17.0, 29.0), (36.0, 26.5), (39.0, 5.5)]
    for i, ref in enumerate(sorted(r for r in C.PARTS if r.startswith("TP"))):
        x, y = tp_spots[i]
        if not place_near(ref, x, y, "B", bot_boxes, avoid_keepout=True):
            raise SystemExit(f"could not place {ref}")

    if UNPLACED:
        print("UNPLACED:", UNPLACED)
    # unplaced check
    placed = set(FIXED) | set(ANCHOR) | {r for r in C.PARTS if r.startswith("TP")}
    missing = set(C.PARTS) - placed
    if missing:
        raise SystemExit(f"no placement rule for {sorted(missing)}")

    # zones: GND on F, In1, B; 1V8 on In2
    def zone(net, layer, pri=0):
        return add_zone(board, netmap[net], layer, pri)


    zone("GND", pcbnew.In1_Cu)
    zone("1V8", pcbnew.In2_Cu)

    # RF end of the module (rule area): no tracks or vias on any layer; ground pours allowed (MHF4 variant)
    ka = pcbnew.ZONE(board)
    ka.SetIsRuleArea(True)
    ka.SetDoNotAllowCopperPour(False)
    ka.SetDoNotAllowTracks(True)
    ka.SetDoNotAllowVias(True)
    ka.SetDoNotAllowPads(False)   # module's own pads may sit at its edge
    ka.SetDoNotAllowFootprints(False)
    ls = pcbnew.LSET()
    for lyr in (pcbnew.F_Cu, pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu):
        ls.AddLayer(lyr)
    ka.SetLayerSet(ls)
    ol = ka.Outline()
    ol.NewOutline()
    x1, y1, x2, y2 = keep
    for x, y in [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]:
        ol.Append(MM(x), MM(y))
    ka.SetZoneName("RF_END_NO_ROUTING")
    board.Add(ka)
    band = 0.35
    for (x1, y1, x2, y2) in [(0, 0, W, band), (0, H - band, W, H), (0, 0, band, H), (W - band, 0, W, H)]:
        e = pcbnew.ZONE(board)
        e.SetIsRuleArea(True)
        e.SetDoNotAllowCopperPour(False)
        e.SetDoNotAllowTracks(True)
        e.SetDoNotAllowVias(True)
        e.SetDoNotAllowPads(False)
        e.SetDoNotAllowFootprints(False)
        e.SetLayerSet(ls)
        o = e.Outline()
        o.NewOutline()
        for x, y in [(x1, y1), (x2, y1), (x2, y2), (x1, y2)]:
            o.Append(MM(x), MM(y))
        e.SetZoneName("EDGE_BAND")
        board.Add(e)

    # silkscreen
    def text(s, x, y, size=0.8, layer=pcbnew.F_SilkS, mirror=False):
        t = pcbnew.PCB_TEXT(board)
        t.SetText(s)
        t.SetPosition(V(x, y))
        t.SetLayer(layer)
        t.SetTextSize(V(size, size))
        t.SetTextThickness(MM(max(0.15, size * 0.15)))
        if mirror:
            t.SetMirrored(True)
        board.Add(t)

    # JLCPCB silkscreen minimum: 1.0 mm text height, 0.15 mm line
    for lbl, x, y in SILK_LABELS:
        text(lbl, x, y, 1.0)
    for lbl, x, y in BOTTOM_LABELS:
        text(lbl, x, y, 1.0, pcbnew.B_SilkS, True)
    for ref, fp in fps.items():   # bottom test points: label each with its net
        if ref.startswith("TP"):
            c = fp.GetPosition()
            net = C.PARTS[ref]["pins"]["1"]
            tx, ty = pcbnew.ToMM(c.x), pcbnew.ToMM(c.y) + 1.4
            text(net.replace("MIC_1V8", "MIC"), tx, ty, 1.0, pcbnew.B_SilkS, True)
    text("CUE rev A dev", 27.0, H - 1.2, 1.0, pcbnew.B_SilkS, True)
    text("2026-10", 37.0, H - 1.2, 1.0, pcbnew.B_SilkS, True)

    pcbnew.SaveBoard(PCB, board)
    return board


def add_zone(board, ni, layer, pri=0):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer)
    z.SetNet(ni)
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_FULL if layer in (pcbnew.F_Cu, pcbnew.B_Cu) else pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetMinThickness(MM(0.15))
    z.SetLocalClearance(MM(0.15))
    z.SetThermalReliefGap(MM(0.2))
    z.SetThermalReliefSpokeWidth(MM(0.25))
    z.SetAssignedPriority(pri)
    z.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)
    ol = z.Outline()
    ol.NewOutline()
    for x, y in [(0, 0), (W, 0), (W, H), (0, H)]:
        ol.Append(MM(x), MM(y))
    board.Add(z)
    return z


def outer_pours_and_stitching(board):
    """GND pours on F.Cu and B.Cu, plus GND stitching vias on a 1.5 mm grid wherever they fit."""
    gnd = board.FindNet("GND")
    add_zone(board, gnd, pcbnew.F_Cu)
    add_zone(board, gnd, pcbnew.B_Cu)
    vd, clr = 0.45, 0.2
    obstacles = []  # (kind, data)
    for t in board.GetTracks():
        if t.GetClass() == "PCB_VIA":
            p = t.GetPosition()
            obstacles.append(("c", pcbnew.ToMM(p.x), pcbnew.ToMM(p.y), pcbnew.ToMM(t.GetWidth()) / 2))
        else:
            a, b = t.GetStart(), t.GetEnd()
            obstacles.append(("s", pcbnew.ToMM(a.x), pcbnew.ToMM(a.y), pcbnew.ToMM(b.x), pcbnew.ToMM(b.y),
                              pcbnew.ToMM(t.GetWidth()) / 2))
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            bb = pad.GetBoundingBox()
            obstacles.append(("r", pcbnew.ToMM(bb.GetLeft()), pcbnew.ToMM(bb.GetTop()),
                              pcbnew.ToMM(bb.GetRight()), pcbnew.ToMM(bb.GetBottom())))
        # keep stitching vias out from under parts (courtyard)
        obstacles.append(("r",) + crtyd_box(fp))

    def seg_dist(px, py, x1, y1, x2, y2):
        dx, dy = x2 - x1, y2 - y1
        L2 = dx * dx + dy * dy
        t = 0 if L2 == 0 else max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / L2))
        return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))

    def free(x, y):
        r = vd / 2 + clr
        kx1, ky1, kx2, ky2 = ANT_KEEPOUT
        if kx1 - r <= x <= kx2 + r and ky1 - r <= y <= ky2 + r:
            return False
        if not (0.6 <= x <= W - 0.6 and 0.6 <= y <= H - 0.6):
            return False
        for o in obstacles:
            if o[0] == "c" and math.hypot(x - o[1], y - o[2]) < o[3] + r:
                return False
            if o[0] == "s" and seg_dist(x, y, o[1], o[2], o[3], o[4]) < o[5] + r:
                return False
            if o[0] == "r" and o[1] - r < x < o[3] + r and o[2] - r < y < o[4] + r:
                return False
        return True

    n = 0
    step = 1.5
    y = 0.75
    while y < H:
        x = 0.75
        while x < W:
            if free(x, y):
                v = pcbnew.PCB_VIA(board)
                v.SetPosition(V(x, y))
                v.SetWidth(MM(vd))
                v.SetDrill(MM(0.2))
                v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
                v.SetNet(gnd)
                board.Add(v)
                obstacles.append(("c", x, y, vd / 2))
                n += 1
            x += step
        y += step
    print("stitching vias:", n)


def stitch_fragments(board):
    """Give every outer-layer GND pour fragment its own via to the In1 GND plane if it has none."""
    gnd = board.FindNet("GND")
    gnd_code = gnd.GetNetCode()
    vd, clr = 0.45, 0.2
    # existing GND drills (vias + PTH pads) that already tie fragments to In1
    drills = []
    for t in board.GetTracks():
        if t.GetClass() == "PCB_VIA" and t.GetNetCode() == gnd_code:
            drills.append(t.GetPosition())
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            if pad.GetNetCode() == gnd_code and pad.GetAttribute() == pcbnew.PAD_ATTRIB_PTH:
                drills.append(pad.GetPosition())
    added = 0
    for z in board.Zones():
        if z.GetIsRuleArea() or z.GetNetCode() != gnd_code:
            continue
        for lyr in (pcbnew.F_Cu, pcbnew.B_Cu):
            if not z.IsOnLayer(lyr):
                continue
            polys = z.GetFilledPolysList(lyr)
            for i in range(polys.OutlineCount()):
                frag = pcbnew.SHAPE_POLY_SET()
                frag.AddOutline(polys.Outline(i))
                if any(frag.Contains(p) for p in drills):
                    continue
                # search a grid inside the fragment for a spot where a via's whole annulus + clearance fits
                bb = polys.Outline(i).BBox()
                x0, y0 = pcbnew.ToMM(bb.GetLeft()), pcbnew.ToMM(bb.GetTop())
                x1, y1 = pcbnew.ToMM(bb.GetRight()), pcbnew.ToMM(bb.GetBottom())
                placed = False
                yy = y0
                while yy <= y1 and not placed:
                    xx = x0
                    while xx <= x1 and not placed:
                        c = V(xx, yy)
                        r = MM(vd / 2 + 0.05)
                        ring = [V(xx + dx, yy + dy) for dx, dy in [(0, 0), (vd / 2, 0), (-vd / 2, 0), (0, vd / 2), (0, -vd / 2)]]
                        if all(frag.Contains(q) for q in ring) and via_fits(board, xx, yy, vd, clr, gnd_code):
                            v = pcbnew.PCB_VIA(board)
                            v.SetPosition(c)
                            v.SetWidth(MM(vd))
                            v.SetDrill(MM(0.2))
                            v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
                            v.SetNet(gnd)
                            board.Add(v)
                            drills.append(c)
                            added += 1
                            placed = True
                        xx += 0.1
                    yy += 0.1
    print("fragment stitching vias:", added)
    return added


def via_fits(board, x, y, vd, clr, net_code, ignore=None):
    """True if a through via at (x, y) clears every other-net track, via and pad on all layers."""
    r = vd / 2 + clr
    for t in board.GetTracks():
        if t.GetNetCode() == net_code:
            continue
        if t.GetClass() == "PCB_VIA":
            p = t.GetPosition()
            if math.hypot(x - pcbnew.ToMM(p.x), y - pcbnew.ToMM(p.y)) < r + pcbnew.ToMM(t.GetWidth()) / 2:
                return False
        else:
            a, b = t.GetStart(), t.GetEnd()
            ax, ay, bx, by = (pcbnew.ToMM(v) for v in (a.x, a.y, b.x, b.y))
            dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy
            u = 0 if L2 == 0 else max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
            if math.hypot(x - (ax + u * dx), y - (ay + u * dy)) < r + pcbnew.ToMM(t.GetWidth()) / 2:
                return False
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            if pad is ignore or (pad.GetNetCode() == net_code and pad.GetAttribute() != pcbnew.PAD_ATTRIB_NPTH):
                continue
            bb = pad.GetBoundingBox()
            if pcbnew.ToMM(bb.GetLeft()) - r < x < pcbnew.ToMM(bb.GetRight()) + r and \
                    pcbnew.ToMM(bb.GetTop()) - r < y < pcbnew.ToMM(bb.GetBottom()) + r:
                return False
    kx1, ky1, kx2, ky2 = ANT_KEEPOUT
    if kx1 - r <= x <= kx2 + r and ky1 - r <= y <= ky2 + r:
        return False
    return 0.6 <= x <= W - 0.6 and 0.6 <= y <= H - 0.6


def write_lib_table():
    rows = []
    for nick in sorted(USED_LIBS):
        uri = "${KIPRJMOD}/Cue.pretty" if nick == "Cue" else "${KICAD7_FOOTPRINT_DIR}/" + nick + ".pretty"
        rows.append(f'  (lib (name "{nick}")(type "KiCad")(uri "{uri}")(options "")(descr ""))')
    with open(os.path.join(HERE, "fp-lib-table"), "w") as f:
        f.write("(fp_lib_table\n  (version 7)\n" + "\n".join(rows) + "\n)\n")


def fanout_planes(board):
    """Tie every GND / 1V8 SMD pad to its inner plane with a short locked track + via before autorouting."""
    nets = {"GND": board.FindNet("GND"), "1V8": board.FindNet("1V8")}
    vd, drill, clr = 0.45, 0.2, 0.15
    n_via = n_inpad = 0
    big_pads = []
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            name = pad.GetNetname()
            if name not in nets or pad.GetAttribute() != pcbnew.PAD_ATTRIB_SMD:
                continue
            if not (pad.IsOnLayer(pcbnew.F_Cu) or pad.IsOnLayer(pcbnew.B_Cu)):
                continue
            ni = nets[name]
            side = pcbnew.F_Cu if pad.IsOnLayer(pcbnew.F_Cu) else pcbnew.B_Cu
            px, py = pcbnew.ToMM(pad.GetPosition().x), pcbnew.ToMM(pad.GetPosition().y)
            sx, sy = pcbnew.ToMM(pad.GetBoundingBox().GetWidth()), pcbnew.ToMM(pad.GetBoundingBox().GetHeight())
            # large pads (QFN exposed pad, module ground pads, touch pad): vias inside the pad
            if fp.GetReference().startswith("TP") and via_fits(board, px, py, vd, clr, ni.GetNetCode(), ignore=pad):
                add_via(board, ni, px, py, vd, drill, locked=True)
                n_inpad += 1
                continue
            if min(sx, sy) >= 0.65 and fp.GetReference() in ("U1", "U2"):
                if min(sx, sy) >= 2.0:  # QFN exposed pad: 4 vias in the gaps between the 3 x 3 paste windows
                    # (windows 0.93 mm at 0 / +-1.15 mm) so solder paste cannot wick down the via holes
                    offs = [(dx, dy) for dx in (-0.575, 0.575) for dy in (-0.575, 0.575)]
                    for dx, dy in offs:
                        add_via(board, ni, px + dx, py + dy, 0.4, drill, locked=True)
                        n_inpad += 1
                else:
                    add_via(board, ni, px, py, vd, drill, locked=True)
                    n_inpad += 1
                continue
            r_pad = max(sx, sy) / 2
            done = False
            for dist in [r_pad + vd / 2 + d for d in (0.15, 0.35, 0.6, 0.9, 1.2)]:
                for ang in range(0, 360, 15):
                    vx = px + dist * math.cos(math.radians(ang))
                    vy = py + dist * math.sin(math.radians(ang))
                    if not via_fits(board, vx, vy, vd, clr, ni.GetNetCode()):
                        continue
                    if not track_fits(board, px, py, vx, vy, 0.25, clr, ni.GetNetCode()):
                        continue
                    t = pcbnew.PCB_TRACK(board)
                    t.SetStart(V(px, py))
                    t.SetEnd(V(vx, vy))
                    t.SetWidth(MM(0.25))
                    t.SetLayer(side)
                    t.SetNet(ni)
                    t.SetLocked(True)
                    board.Add(t)
                    add_via(board, ni, vx, vy, vd, drill, locked=True)
                    n_via += 1
                    done = True
                    break
                if done:
                    break
            if not done:
                print(f"  no fan-out room for {fp.GetReference()}.{pad.GetNumber()} ({name})")
    print(f"plane fan-out: {n_via} vias beside pads, {n_inpad} vias in pads")


def add_via(board, ni, x, y, vd, drill, locked=False):
    v = pcbnew.PCB_VIA(board)
    v.SetPosition(V(x, y))
    v.SetWidth(MM(vd))
    v.SetDrill(MM(drill))
    v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
    v.SetNet(ni)
    v.SetLocked(locked)
    board.Add(v)
    return v


def track_fits(board, x1, y1, x2, y2, w, clr, net_code, steps=8):
    """Sample points along a short track and check pad clearance against other nets and the keep-out."""
    kx1, ky1, kx2, ky2 = ANT_KEEPOUT
    for i in range(steps + 1):
        x = x1 + (x2 - x1) * i / steps
        y = y1 + (y2 - y1) * i / steps
        r = w / 2 + clr
        if kx1 - r <= x <= kx2 + r and ky1 - r <= y <= ky2 + r:
            return False
        for fp in board.GetFootprints():
            for pad in fp.Pads():
                if pad.GetNetCode() == net_code:
                    continue
                bb = pad.GetBoundingBox()
                if pcbnew.ToMM(bb.GetLeft()) - r < x < pcbnew.ToMM(bb.GetRight()) + r and \
                        pcbnew.ToMM(bb.GetTop()) - r < y < pcbnew.ToMM(bb.GetBottom()) + r:
                    return False
    return True


# fine-pitch pins that get boxed in by routed copper: give each a locked stub straight out of the package
# (and a plane via for plane nets) before the autorouter runs, so a channel stays open
ESCAPES = {"U2": ["13", "14", "15", "29"], "U3": ["12"]}
LANES = {"U2": ["12", "13", "14", "15", "28", "29"], "U3": ["12"]}   # kept free of small parts at placement


def escape_stubs(board, length=0.9):
    n = 0
    for ref, pads in ESCAPES.items():
        fp = board.FindFootprintByReference(ref)
        c = fp.GetPosition()
        cx, cy = pcbnew.ToMM(c.x), pcbnew.ToMM(c.y)
        for pad in fp.Pads():
            if pad.GetNumber() not in pads:
                continue
            p = pad.GetPosition()
            px, py = pcbnew.ToMM(p.x), pcbnew.ToMM(p.y)
            dx, dy = px - cx, py - cy
            if abs(dx) > abs(dy):
                ux, uy = (1 if dx > 0 else -1), 0
            else:
                ux, uy = 0, (1 if dy > 0 else -1)
            sz = pad.GetSize()
            half = max(pcbnew.ToMM(sz.x), pcbnew.ToMM(sz.y)) / 2
            ex, ey = px + ux * (half + length), py + uy * (half + length)
            t = pcbnew.PCB_TRACK(board)
            t.SetStart(V(px, py))
            t.SetEnd(V(ex, ey))
            t.SetWidth(MM(0.127))
            t.SetLayer(pcbnew.F_Cu)
            t.SetNet(pad.GetNet())
            t.SetLocked(True)
            board.Add(t)
            if pad.GetNetname() in ("GND", "1V8") and via_fits(board, ex, ey, 0.45, 0.13, pad.GetNetCode(), ignore=pad):
                add_via(board, pad.GetNet(), ex, ey, 0.45, 0.2, locked=True)
            n += 1
    print("escape stubs:", n)


def buck_routes(board, w=0.3):
    """Short, wide, locked SW1/SW2/PVDD connections on F.Cu from the nPM1300 pins to L1/L2/C5 (Nordic PS 9.3.4)."""
    def pad(ref, num):
        fp = board.FindFootprintByReference(ref)
        p = [q for q in fp.Pads() if q.GetNumber() == num][0]
        return pcbnew.ToMM(p.GetPosition().x), pcbnew.ToMM(p.GetPosition().y), p.GetNet()

    def seg(pts, net, width):
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            if math.hypot(x2 - x1, y2 - y1) < 1e-3:
                continue
            t = pcbnew.PCB_TRACK(board)
            t.SetStart(V(x1, y1))
            t.SetEnd(V(x2, y2))
            t.SetWidth(MM(width))
            t.SetLayer(pcbnew.F_Cu)
            t.SetNet(net)
            t.SetLocked(True)
            board.Add(t)

    for upin, lref in (("3", "L1"), ("5", "L2")):
        px, py, net = pad("U2", upin)
        lx, ly, _ = pad(lref, "1")
        ex = px + 0.75                       # straight out of the pin, then 45 degrees to the inductor
        dy = ly - py
        mx = lx - abs(dy) + 0.0
        mx = max(mx, ex)
        seg([(px, py), (ex, py), (mx, py), (lx, ly if abs(lx - mx) < 1e-6 else py + (1 if dy > 0 else -1) * (lx - mx)), (lx, ly)], net, w)
    px, py, net = pad("U2", "4")
    cx, cy, _ = pad("C5", "1")
    seg([(px, py), (cx, cy)], net, 0.25)
    for lref, cref in (("L1", "C6"), ("L2", "C7")):  # inductor output straight into its output cap on F.Cu
        lx, ly, net = pad(lref, "2")
        cx, cy, _ = pad(cref, "1")
        seg([(lx, ly), (cx, ly), (cx, cy)], net, 0.3)
    print("buck routes: SW1, SW2, PVDD, L1-C6, L2-C7")


def widen_power(board, nets=("SW1", "SW2", "VSYS", "VBUS", "VBAT", "1V8", "3V0", "MIC_1V8", "VBUSOUT",
                             "LRA_P", "LRA_N", "U5_REG", "GND"), widths=(0.4, 0.3, 0.25, 0.2), clr=0.135):
    """Widen autorouted power tracks as far as clearance allows (the router uses one thin width everywhere)."""
    n = 0
    tracks = [t for t in board.GetTracks() if t.GetClass() == "PCB_TRACK" and t.GetNetname() in nets
              and not t.IsLocked()]
    for t in tracks:
        p1 = (pcbnew.ToMM(t.GetStart().x), pcbnew.ToMM(t.GetStart().y))
        p2 = (pcbnew.ToMM(t.GetEnd().x), pcbnew.ToMM(t.GetEnd().y))
        cur = pcbnew.ToMM(t.GetWidth())
        for w in widths:
            if w <= cur + 1e-6:
                break
            if straight_track_ok(board, p1, p2, t.GetLayer(), w, t.GetNetCode(), clr=clr):
                t.SetWidth(MM(w))
                n += 1
                break
    print("widened power tracks:", n, "of", len(tracks))


def route(board):
    buck_routes(board)
    escape_stubs(board)
    fanout_planes(board)
    dsn = PCB.replace(".kicad_pcb", ".dsn")
    ses = PCB.replace(".kicad_pcb", ".ses")
    if not pcbnew.ExportSpecctraDSN(board, dsn):
        raise SystemExit("DSN export failed")
    jar = os.environ.get("FREEROUTING", os.path.join(HERE, "tools", "freerouting-1.9.0.jar"))
    if os.path.exists(ses):
        os.remove(ses)
    # Freerouting 1.9 needs a display; xvfb-run provides a virtual one. -mp caps the routing passes.
    cmd = ["xvfb-run", "-a", "java", "-jar", jar, "-de", dsn, "-do", ses, "-mp", str(PASSES), "-mt", "4"]
    print("routing with Freerouting", os.path.basename(jar), "passes", PASSES)
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1500)
    log = (r.stdout + r.stderr).splitlines()
    for ln in log:
        if "completed" in ln or "unrouted" in ln.lower():
            print("  " + ln.split("INFO")[-1].strip())
    if not os.path.exists(ses):
        raise SystemExit("freerouting produced no session file")
    n_tr, n_via = import_ses(board, ses)
    print(f"imported {n_tr} track segments, {n_via} vias")
    print("merged duplicate vias:", merge_vias(board))


def merge_vias(board, min_c2c=0.5):
    """Freerouting sometimes drops a via right beside an existing same-net via; snap it onto the first one."""
    vias = [t for t in board.GetTracks() if t.GetClass() == "PCB_VIA"]
    vias.sort(key=lambda v: not v.IsLocked())  # keep locked (fan-out) vias
    kept, removed = [], 0
    for v in vias:
        p = v.GetPosition()
        twin = next((k for k in kept if k.GetNetCode() == v.GetNetCode() and
                     math.hypot(pcbnew.ToMM(p.x - k.GetPosition().x), pcbnew.ToMM(p.y - k.GetPosition().y)) < min_c2c), None)
        if twin is None:
            kept.append(v)
            continue
        tp = twin.GetPosition()
        for t in board.GetTracks():
            if t.GetClass() == "PCB_VIA" or t.GetNetCode() != v.GetNetCode():
                continue
            if t.GetStart() == p:
                t.SetStart(tp)
            if t.GetEnd() == p:
                t.SetEnd(tp)
        board.Remove(v)
        removed += 1
    return removed


def _sexp(text):
    """Tiny s-expression parser (quoted strings kept as str)."""
    import re
    tokens = re.findall(r'"[^"]*"|\(|\)|[^\s()]+', text)
    stack, cur = [], []
    for t in tokens:
        if t == "(":
            stack.append(cur)
            cur = []
        elif t == ")":
            done = cur
            cur = stack.pop()
            cur.append(done)
        else:
            cur.append(t.strip('"'))
    return cur[0]


def import_ses(board, ses):
    """Add Freerouting's wires and vias (Specctra session) to the board. Units: resolution um 10, y flipped."""
    import re
    tree = _sexp(open(ses).read())
    routes = next(x for x in tree if isinstance(x, list) and x and x[0] == "routes")
    res = next(x for x in routes if isinstance(x, list) and x[0] == "resolution")
    scale = float(res[2]) * 1000.0  # "resolution um 10" = 10 units per um -> units per mm
    to_mm = lambda v: float(v) / scale
    layers = {"F.Cu": pcbnew.F_Cu, "In1.Cu": pcbnew.In1_Cu, "In2.Cu": pcbnew.In2_Cu, "B.Cu": pcbnew.B_Cu}
    netout = next(x for x in routes if isinstance(x, list) and x[0] == "network_out")
    n_tr = n_via = 0
    for net in netout[1:]:
        name = net[1]
        ni = board.FindNet(name)
        for item in net[2:]:
            if item[0] == "wire":
                path = next(x for x in item if isinstance(x, list) and x[0] == "path")
                layer, width = layers[path[1]], to_mm(path[2])
                pts = [(to_mm(path[i]), -to_mm(path[i + 1])) for i in range(3, len(path) - 1, 2)]
                for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
                    t = pcbnew.PCB_TRACK(board)
                    t.SetStart(V(x1, y1))
                    t.SetEnd(V(x2, y2))
                    t.SetWidth(MM(width))
                    t.SetLayer(layer)
                    t.SetNet(ni)
                    board.Add(t)
                    n_tr += 1
            elif item[0] == "via":
                m = re.search(r"_(\d+):(\d+)_um", item[1])
                dia, drill = (int(m.group(1)) / 1000, int(m.group(2)) / 1000) if m else (0.45, 0.2)
                v = pcbnew.PCB_VIA(board)
                v.SetPosition(V(to_mm(item[2]), -to_mm(item[3])))
                v.SetWidth(MM(dia))
                v.SetDrill(MM(drill))
                v.SetViaType(pcbnew.VIATYPE_THROUGH)
                v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
                v.SetNet(ni)
                board.Add(v)
                n_via += 1
    return n_tr, n_via


def finish(board):
    import maze_patch
    write_lib_table()
    # Zone fill crashes on an in-memory CreateEmptyBoard(); save and reload (sets up project settings) first.
    pcbnew.SaveBoard(PCB, board)
    board = pcbnew.LoadBoard(PCB)
    # finish what the autorouter left open while the outer layers are still free of pours and stitching
    rpt = os.path.join(HERE, "drc.rpt")
    board.BuildConnectivity()
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())  # inner planes, so plane pads count as connected
    pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    print("maze-patched:", maze_patch.patch(board, rpt))
    widen_power(board)
    outer_pours_and_stitching(board)
    pcbnew.SaveBoard(PCB, board)
    board = pcbnew.LoadBoard(PCB)
    board.BuildConnectivity()
    filler = pcbnew.ZONE_FILLER(board)
    filler.Fill(board.Zones())
    added = stitch_fragments(board)
    if added:
        filler.Fill(board.Zones())
    pcbnew.SaveBoard(PCB, board)
    pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    if patch_unconnected(board, rpt):
        filler.Fill(board.Zones())
        pcbnew.SaveBoard(PCB, board)
        pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    # cleanup loop: drop unused escape stubs, then route anything a removal (or the router) left open
    import re
    for _ in range(3):
        removed = remove_dangling_stubs(rpt)
        unconn = int((re.search(r"Found (\d+) unconnected", open(rpt).read()) or [0, 0])[1])
        if not removed and not unconn:
            break
        board = pcbnew.LoadBoard(PCB)
        board.BuildConnectivity()
        pcbnew.ZONE_FILLER(board).Fill(board.Zones())
        pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
        print("maze-patched in cleanup:", maze_patch.patch(board, rpt))
        pcbnew.SaveBoard(PCB, board)
        board = pcbnew.LoadBoard(PCB)
        board.BuildConnectivity()
        pcbnew.ZONE_FILLER(board).Fill(board.Zones())
        pcbnew.SaveBoard(PCB, board)
        pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    summarize_drc(rpt)


def remove_dangling_stubs(rpt):
    """Delete escape stubs the router ended up not using (DRC 'track_dangling'), by uuid in the board file."""
    import re
    txt = open(rpt).read()
    spots = [(float(x), float(y)) for x, y in
             re.findall(r"\[track_dangling\][^\n]*\n[^\n]*\n\s*@\(([\d.]+) mm, ([\d.]+) mm\)", txt)]
    if not spots:
        return 0
    board = pcbnew.LoadBoard(PCB)
    uuids = []
    for t in board.GetTracks():
        if t.GetClass() != "PCB_TRACK":
            continue
        for x, y in spots:
            if t.HitTest(V(x, y), MM(0.01)):
                uuids.append(t.m_Uuid.AsString())
    text = open(PCB).read()
    n = 0
    for u in set(uuids):
        m = re.search(r"\n\s*\(segment [^\n]*?\((?:tstamp|uuid) \"?" + re.escape(u) + r"\"?\)\)", text)
        if m:
            text = text[:m.start()] + text[m.end():]
            n += 1
    open(PCB, "w").write(text)
    print("removed dangling stubs:", n)
    return n


def _seg_seg(a1, a2, b1, b2):
    """Minimum distance between segments a1-a2 and b1-b2 (tuples, mm)."""
    def pt_seg(p, s1, s2):
        dx, dy = s2[0] - s1[0], s2[1] - s1[1]
        L2 = dx * dx + dy * dy
        t = 0 if L2 == 0 else max(0, min(1, ((p[0] - s1[0]) * dx + (p[1] - s1[1]) * dy) / L2))
        return math.hypot(p[0] - (s1[0] + t * dx), p[1] - (s1[1] + t * dy))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    d1, d2 = cross(b1, b2, a1), cross(b1, b2, a2)
    d3, d4 = cross(a1, a2, b1), cross(a1, a2, b2)
    if d1 * d2 < 0 and d3 * d4 < 0:
        return 0.0
    return min(pt_seg(a1, b1, b2), pt_seg(a2, b1, b2), pt_seg(b1, a1, a2), pt_seg(b2, a1, a2))


def straight_track_ok(board, p1, p2, layer, w, net_code, clr=0.12):
    """True if a straight track p1-p2 on `layer` clears every other-net copper item and the keep-outs."""
    r = w / 2 + clr
    mm = lambda v: (pcbnew.ToMM(v.x), pcbnew.ToMM(v.y))
    for t in board.GetTracks():
        if t.GetNetCode() == net_code:
            continue
        if t.GetClass() == "PCB_VIA":
            if _seg_seg(p1, p2, mm(t.GetPosition()), mm(t.GetPosition())) < r + pcbnew.ToMM(t.GetWidth()) / 2:
                return False
        elif t.GetLayer() == layer:
            if _seg_seg(p1, p2, mm(t.GetStart()), mm(t.GetEnd())) < r + pcbnew.ToMM(t.GetWidth()) / 2:
                return False
    for fp in board.GetFootprints():
        for pad in fp.Pads():
            if pad.GetNetCode() == net_code or not pad.IsOnLayer(layer):
                continue
            bb = pad.GetBoundingBox()
            x1, y1, x2, y2 = (pcbnew.ToMM(v) for v in (bb.GetLeft(), bb.GetTop(), bb.GetRight(), bb.GetBottom()))
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            half = math.hypot(x2 - x1, y2 - y1) / 2  # conservative: circumscribed circle
            if _seg_seg(p1, p2, (cx, cy), (cx, cy)) < r + half * 0.75 and \
                    _seg_seg(p1, p2, (x1, y1), (x2, y2)) < r + 0.01:
                return False
            # sample the segment against the rectangle
            for i in range(21):
                x = p1[0] + (p2[0] - p1[0]) * i / 20
                y = p1[1] + (p2[1] - p1[1]) * i / 20
                if x1 - r < x < x2 + r and y1 - r < y < y2 + r:
                    return False
    kx1, ky1, kx2, ky2 = ANT_KEEPOUT
    for i in range(21):
        x = p1[0] + (p2[0] - p1[0]) * i / 20
        y = p1[1] + (p2[1] - p1[1]) * i / 20
        if kx1 - r <= x <= kx2 + r and ky1 - r <= y <= ky2 + r:
            return False
    return True


def patch_unconnected(board, rpt):
    """Finish short leftover connections the autorouter missed with a straight, clearance-checked track."""
    import re
    txt = open(rpt).read()
    added = 0
    for blk in re.split(r"\n(?=\[)", txt):
        if not blk.startswith("[unconnected_items]"):
            continue
        pts = re.findall(r"@\(([\d.]+) mm, ([\d.]+) mm\): (Pad|Via|Track) [^\[]*\[([^\]]+)\][^\n]*on ([FB])\.Cu", blk)
        if len(pts) != 2 or pts[0][3] != pts[1][3]:
            continue
        net = board.FindNet(pts[0][3])
        if net is None or net.GetNetname() in ("GND",):
            continue
        (xa, ya, ka, _, la), (xb, yb, kb, _, lb) = pts
        p1, p2 = (float(xa), float(ya)), (float(xb), float(yb))
        if math.hypot(p1[0] - p2[0], p1[1] - p2[1]) > 4.0:
            continue
        layer = pcbnew.F_Cu if la == "F" else pcbnew.B_Cu
        if la != lb and "Via" not in (ka, kb):
            continue
        if straight_track_ok(board, p1, p2, layer, 0.15, net.GetNetCode()):
            t = pcbnew.PCB_TRACK(board)
            t.SetStart(V(*p1))
            t.SetEnd(V(*p2))
            t.SetWidth(MM(0.15))
            t.SetLayer(layer)
            t.SetNet(net)
            board.Add(t)
            added += 1
            print(f"  patched {net.GetNetname()}: {p1} -> {p2}")
    print("patched leftover connections:", added)
    return added


def summarize_drc(rpt):
    import collections
    import re
    txt = open(rpt).read()
    kinds = collections.Counter(re.findall(r"^\[(\w+)\]", txt, re.M))
    unconn = re.search(r"\*\* Found (\d+) unconnected pads", txt)
    viol = re.search(r"\*\* Found (\d+) DRC violations", txt)
    print(f"DRC: {viol.group(1) if viol else '?'} violations, {unconn.group(1) if unconn else '?'} unconnected")
    for k, n in kinds.most_common():
        print(f"  {n:3d} {k}")


if __name__ == "__main__":
    place_only = "--place" in sys.argv
    b = build(place_only)
    if place_only:
        print("placed; saved", PCB)
        raise SystemExit(0)
    if "--reuse-ses" not in sys.argv:
        route(b)
    else:
        b.BuildConnectivity()
        n = import_ses(b, PCB.replace(".kicad_pcb", ".ses"))
        print("imported", n)
    finish(b)
