"""
Custom footprints for the Cue dev board, written into Cue.pretty with the KiCad 7 API.

TDK_T5838            from TDK DS-000383 v1.1, Figure 34 (outline, bottom view) mirrored to top view.
                     Checked against Figure 3 pin map and Figure 32 land pattern (1:1 with package pads).
Touch_Pad_4x3mm      plain copper pad for the Qvar touch electrode.
Ezurio_BL54L15u_...  Ezurio BL54L15u datasheet (2026) p.25 recommended land pattern, 453-00223 chip antenna.
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


# BL54L15u land pattern, Ezurio datasheet "BL54L15u" (2026), Host PCB Land Pattern for the 453-00223 (p. 25),
# top view. Module 7.9 x 6.3 mm; 51 square 0.40 mm pads. Coordinates below are pad centres from the module's
# top-left corner; the footprint origin is the module centre. Antenna end (keep-out) is +X.
BL54_W, BL54_H = 7.9, 6.3
_COLS = {"a": 0.40, "b": 1.05, "c": 1.70, "d": 2.35, "e": 3.00, "f": 3.65, "g": 4.375,
         "G1": 5.20, "G2": 6.35, "G3": 7.50}
_ROWS = [0.40, 1.05, 1.85, 2.50, 3.15, 3.80, 4.45, 5.25, 5.90]
BL54_PADS = {
    0: [("1", "a"), ("2", "b"), ("45", "c"), ("43", "d"), ("41", "e"), ("39", "f"), ("37", "g"),
        ("G1", "G1"), ("G2", "G2"), ("G3", "G3")],
    1: [("3", "a"), ("4", "b"), ("44", "c"), ("42", "d"), ("40", "e"), ("38", "f"), ("36", "g")],
    2: [("5", "a"), ("6", "b"), ("35", "f")],
    3: [("7", "a"), ("8", "b"), ("33", "f"), ("34", "g")],
    4: [("9", "a"), ("10", "b"), ("32", "f")],
    5: [("11", "a"), ("12", "b"), ("30", "f"), ("31", "g")],
    6: [("13", "a"), ("14", "b"), ("29", "f")],
    7: [("15", "a"), ("16", "b"), ("20", "c"), ("22", "d"), ("24", "e"), ("26", "f"), ("28", "g")],
    8: [("17", "a"), ("18", "b"), ("19", "c"), ("21", "d"), ("23", "e"), ("25", "f"), ("27", "g"),
        ("G4", "G1"), ("G5", "G2"), ("G6", "G3")],
}
# antenna keep-out (no copper, any layer): 3.00 x 5.00 mm against the antenna-end edge, relative to origin
BL54_KEEPOUT = (BL54_W - 3.00 - BL54_W / 2, 0.65 - BL54_H / 2, BL54_W / 2, 5.65 - BL54_H / 2)


def bl54l15u_pads():
    out = {}
    for row, pads in BL54_PADS.items():
        for num, col in pads:
            out[num] = (round(_COLS[col] - BL54_W / 2, 4), round(_ROWS[row] - BL54_H / 2, 4))
    return out


def bl54l15u():
    """Ezurio BL54L15u 453-00223 (chip antenna). Origin = module centre, antenna end at +X."""
    fp = new_fp("Ezurio_BL54L15u_453-00223",
                "Ezurio BL54L15u 453-00223, 7.9x6.3x1.75 mm LGA-51, 0.40 mm pads. Ezurio datasheet p.25 land "
                "pattern. Antenna keep-out 3.0x5.0 mm on all layers at the +X end, module on the board edge.")
    pads = bl54l15u_pads()
    assert len(pads) == 51, len(pads)
    for num, (x, y) in pads.items():
        smd(fp, num, x, y, 0.40, 0.40)
    w, h = BL54_W / 2, BL54_H / 2
    rect(fp, pcbnew.F_Fab, -w, -h, w, h, 0.1)
    kx1, ky1, kx2, ky2 = BL54_KEEPOUT
    rect(fp, pcbnew.F_Fab, kx1, ky1, kx2, ky2, 0.05)
    rect(fp, pcbnew.Dwgs_User, kx1, ky1, kx2, ky2, 0.1)
    # silkscreen: outline corners only (no silk over the antenna end), pin-1 dot
    for (x1, y1, x2, y2) in [(-w - 0.15, -h - 0.15, -w + 1.0, -h - 0.15), (-w - 0.15, -h - 0.15, -w - 0.15, -h + 1.0),
                             (-w - 0.15, h + 0.15, -w + 1.0, h + 0.15), (-w - 0.15, h + 0.15, -w - 0.15, h - 1.0)]:
        line(fp, pcbnew.F_SilkS, x1, y1, x2, y2, 0.12)
    dot = pcbnew.FP_SHAPE(fp, pcbnew.SHAPE_T_CIRCLE)
    dot.SetStart(V(-w - 0.45, -h + 0.40))
    dot.SetEnd(V(-w - 0.35, -h + 0.40))
    dot.SetLayer(pcbnew.F_SilkS)
    dot.SetWidth(MM(0.15))
    dot.SetLocalCoord()
    fp.Add(dot)
    rect(fp, pcbnew.F_CrtYd, -w - 0.25, -h - 0.25, w + 0.25, h + 0.25, 0.05)
    t = pcbnew.FP_TEXT(fp)
    t.SetText("ANT KEEP-OUT")
    t.SetPosition(V((kx1 + kx2) / 2, 0))
    t.SetTextSize(V(0.4, 0.4))
    t.SetLayer(pcbnew.F_Fab)
    fp.Add(t)
    fp.Reference().SetPosition(V(-1.0, 0))
    fp.Value().SetLayer(pcbnew.F_Fab)
    save(fp, "Ezurio_BL54L15u_453-00223")


if __name__ == "__main__":
    which = sys.argv[1:] or ["t5838", "touch", "bl54"]
    if "t5838" in which:
        t5838()
    if "touch" in which:
        touch_pad()
    if "bl54" in which:
        bl54l15u()
