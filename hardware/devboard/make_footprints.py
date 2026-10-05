"""
Custom footprints for the Cue dev board, written into Cue.pretty with the KiCad 7 API.

TDK_T5838            from TDK DS-000383 v1.1, Figure 34 (outline, bottom view) mirrored to top view.
                     Checked against Figure 3 pin map and Figure 32 land pattern (1:1 with package pads).
Touch_Pad_4x3mm      plain copper pad for the Qvar touch electrode.
Ezurio_BL54L15u_...  PROVISIONAL until Ezurio's land pattern is imported (see README). Pad numbers and
                     signals are real (Ezurio datasheet v1.1 pad table); pad POSITIONS are a stand-in.
"""
import os
import sys

import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, "Cue.pretty")
MM = pcbnew.FromMM


def V(x, y):
    return pcbnew.VECTOR2I(MM(x), MM(y))


def new_fp(name, desc):
    fp = pcbnew.FOOTPRINT(None)
    fp.SetFPID(pcbnew.LIB_ID("Cue", name))
    fp.SetDescription(desc)
    fp.Reference().SetText("REF**")
    fp.Value().SetText(name)
    return fp


def smd(fp, num, x, y, w, h, shape=pcbnew.PAD_SHAPE_RECT):
    p = pcbnew.PAD(fp)
    p.SetNumber(num)
    p.SetAttribute(pcbnew.PAD_ATTRIB_SMD)
    p.SetShape(shape)
    p.SetSize(V(w, h))
    p.SetPos0(V(x, y))
    p.SetPosition(V(x, y))
    p.SetLayerSet(pcbnew.PAD.SMDMask())
    fp.Add(p)
    return p


def line(fp, layer, x1, y1, x2, y2, w=0.12):
    s = pcbnew.FP_SHAPE(fp, pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(V(x1, y1))
    s.SetEnd(V(x2, y2))
    s.SetLayer(layer)
    s.SetWidth(MM(w))
    s.SetLocalCoord()
    fp.Add(s)


def rect(fp, layer, x1, y1, x2, y2, w=0.12):
    for a, b, c, d in [(x1, y1, x2, y1), (x2, y1, x2, y2), (x2, y2, x1, y2), (x1, y2, x1, y1)]:
        line(fp, layer, a, b, c, d, w)


def save(fp, name):
    os.makedirs(LIB, exist_ok=True)
    if not os.path.exists(os.path.join(LIB, "")):
        pcbnew.FootprintLibCreate(LIB)
    pcbnew.FootprintSave(LIB, fp)
    print("wrote", os.path.join(LIB, name + ".kicad_mod"))


def t5838():
    """TDK T5838, 3.5 x 2.65 mm, bottom port. Origin = package centre, top view."""
    fp = new_fp("TDK_T5838", "TDK T5838 PDM mic, LGA_CAV 3.5x2.65x0.98, bottom port. DS-000383 v1.1 Fig 34/32.")
    # bottom-view centres (from package left/top edge) -> top view: x = -(bx - 1.75), y = by - 1.325
    cx, cy = 1.75, 1.325
    big = {"1": (0.386, 0.4875), "2": (1.208, 0.4875), "7": (0.386, 2.1625), "6": (1.208, 2.1625)}
    for n, (bx, by) in big.items():
        smd(fp, n, -(bx - cx), by - cy, 0.522, 0.725)
    small = {"4": (3.225, 0.275), "5": (3.225, 2.375)}
    for n, (bx, by) in small.items():
        smd(fp, n, -(bx - cx), by - cy, 0.30, 0.30)
    # pad 3: GND ring, OD 1.625 / ID 1.025, centred on the sound port (bx 2.46, by 1.35)
    rx, ry = -(2.46 - cx), 1.35 - cy
    r_mid, ring_w = (1.625 + 1.025) / 4, (1.625 - 1.025) / 2
    p = pcbnew.PAD(fp)
    p.SetNumber("3")
    p.SetAttribute(pcbnew.PAD_ATTRIB_SMD)
    p.SetShape(pcbnew.PAD_SHAPE_CUSTOM)
    p.SetAnchorPadShape(pcbnew.PAD_SHAPE_CIRCLE)
    p.SetSize(V(ring_w, ring_w))
    p.SetPos0(V(rx + r_mid, ry))  # anchor sits on the ring
    p.SetPosition(V(rx + r_mid, ry))
    p.SetLayerSet(pcbnew.PAD.SMDMask())
    p.AddPrimitiveCircle(V(-r_mid, 0), MM(r_mid), MM(ring_w), False)
    p.SetLocalSolderPasteMargin(MM(-0.05))  # stencil ring OD ~1.525 per Fig 33
    fp.Add(p)
    # sound hole through the board, inside the ring (0.5-1.0 mm recommended; 0.6 keeps 0.21 mm to copper)
    h = pcbnew.PAD(fp)
    h.SetNumber("")
    h.SetAttribute(pcbnew.PAD_ATTRIB_NPTH)
    h.SetShape(pcbnew.PAD_SHAPE_CIRCLE)
    h.SetSize(V(0.6, 0.6))
    h.SetDrillSize(V(0.6, 0.6))
    h.SetPos0(V(rx, ry))
    h.SetPosition(V(rx, ry))
    h.SetLayerSet(pcbnew.PAD.UnplatedHoleMask())
    fp.Add(h)
    # outline + pin-1 mark (top view)
    rect(fp, pcbnew.F_Fab, -1.75, -1.325, 1.75, 1.325, 0.1)
    rect(fp, pcbnew.F_CrtYd, -2.0, -1.575, 2.0, 1.575, 0.05)
    line(fp, pcbnew.F_SilkS, 1.95, -1.5, 1.95, -0.3)       # silk beside pin-1 side
    line(fp, pcbnew.F_SilkS, 1.6, -1.5, 1.95, -1.5)
    fp.Reference().SetPosition(V(0, -2.1))
    fp.Value().SetPosition(V(0, 2.1))
    fp.Value().SetLayer(pcbnew.F_Fab)
    save(fp, "TDK_T5838")


def touch_pad():
    fp = new_fp("Touch_Pad_4x3mm", "Qvar touch electrode pad, 4x3 mm, exposed copper")
    smd(fp, "1", 0, 0, 4.0, 3.0, pcbnew.PAD_SHAPE_ROUNDRECT).SetRoundRectRadiusRatio(0.2)
    ls = pcbnew.LSET(); ls.AddLayer(pcbnew.F_Cu); ls.AddLayer(pcbnew.F_Mask)
    fp.Pads()[0].SetLayerSet(ls)  # no paste
    rect(fp, pcbnew.F_CrtYd, -2.25, -1.75, 2.25, 1.75, 0.05)
    fp.Reference().SetPosition(V(0, -2.4))
    fp.Value().SetLayer(pcbnew.F_Fab)
    save(fp, "Touch_Pad_4x3mm")


def bl54l15u_provisional():
    """Stand-in: correct pad NUMBERS/count, invented positions. Antenna end = -Y (top)."""
    fp = new_fp("Ezurio_BL54L15u_453-00223",
                "PROVISIONAL stand-in for Ezurio BL54L15u (7.9x6.3 mm). Replace with Ezurio land pattern before ordering.")
    W, H = 6.3, 7.9
    pitch, pw, ph = 0.65, 0.35, 0.7
    nums = [str(i) for i in range(1, 46)]
    pos = []
    # outer row: left side 10 pads, bottom 8, right side 10 (antenna end at top kept free)
    ys = [-1.4 + i * pitch for i in range(10)]
    pos += [(-W / 2 + 0.4, y, pw if False else ph, pw) for y in ys]
    xs = [-2.275 + i * pitch for i in range(8)]
    pos += [(x, H / 2 - 0.4, pw, ph) for x in xs]
    pos += [(W / 2 - 0.4, y, ph, pw) for y in reversed(ys)]
    # inner row: 17 more pads inset by 1.0 mm
    ys2 = [-0.8 + i * pitch for i in range(7)]
    pos += [(-W / 2 + 1.4, y, ph, pw) for y in ys2]
    xs2 = [-1.3 + i * pitch for i in range(3)]
    pos += [(x, H / 2 - 1.4, pw, ph) for x in xs2]
    pos += [(W / 2 - 1.4, y, ph, pw) for y in reversed(ys2)]
    for n, (x, y, w, h) in zip(nums, pos):
        smd(fp, n, x, y, w, h)
    for i, (x, y) in enumerate([(-0.6, -0.4), (0.6, -0.4), (-0.6, 0.8), (0.6, 0.8), (-0.6, 2.0), (0.6, 2.0)], start=1):
        smd(fp, f"G{i}", x, y, 0.7, 0.7)
    rect(fp, pcbnew.F_Fab, -W / 2, -H / 2, W / 2, H / 2, 0.1)
    rect(fp, pcbnew.F_SilkS, -W / 2 - 0.15, -H / 2 - 0.15, W / 2 + 0.15, H / 2 + 0.15, 0.12)
    rect(fp, pcbnew.F_CrtYd, -W / 2 - 0.3, -H / 2 - 0.3, W / 2 + 0.3, H / 2 + 0.3, 0.05)
    t = pcbnew.FP_TEXT(fp)
    t.SetText("ANT")
    t.SetPosition(V(0, -H / 2 + 1.0))
    t.SetLayer(pcbnew.F_Fab)
    fp.Add(t)
    fp.Reference().SetPosition(V(0, H / 2 + 0.8))
    fp.Value().SetLayer(pcbnew.F_Fab)
    save(fp, "Ezurio_BL54L15u_453-00223")


if __name__ == "__main__":
    which = sys.argv[1:] or ["t5838", "touch", "bl54"]
    if "t5838" in which:
        t5838()
    if "touch" in which:
        touch_pad()
    if "bl54" in which:
        bl54l15u_provisional()
