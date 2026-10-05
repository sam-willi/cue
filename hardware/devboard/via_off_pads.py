"""Nudge any through via that overlaps an SMD pad (solder would wick into it) clear of the pad, dragging the
track ends that land on it. Skips the designed in-pad vias (U2 exposed pad, test points).

    python3 via_off_pads.py      # edits cue_devboard.kicad_pcb in place, then refills and re-runs DRC
"""
import math
import os

import pcbnew

import build_board as B

mm = pcbnew.ToMM


def offenders(b):
    out = []
    for t in b.GetTracks():
        if t.GetClass() != "PCB_VIA":
            continue
        r = mm(t.GetWidth()) / 2
        for f in b.GetFootprints():
            if f.GetReference().startswith("TP"):
                continue
            for pd in f.Pads():
                if pd.GetAttribute() != pcbnew.PAD_ATTRIB_SMD or not pd.IsOnLayer(pcbnew.F_Cu):
                    continue
                if f.GetReference() == "U2" and pd.GetNumber() == "33":
                    continue
                if pd.HitTest(t.GetPosition(), pcbnew.FromMM(r + 0.05)):
                    out.append((t, pd))
    return out


def fix(b):
    moved = 0
    for v, pd in offenders(b):
        vx, vy = mm(v.GetPosition().x), mm(v.GetPosition().y)
        px, py = mm(pd.GetPosition().x), mm(pd.GetPosition().y)
        base = math.atan2(vy - py, vx - px)
        best = None
        for step in [i * 0.05 for i in range(1, 16)]:
            for da in (0, 20, -20, 45, -45, 70, -70, 90, -90):
                a = base + math.radians(da)
                nx, ny = vx + step * math.cos(a), vy + step * math.sin(a)
                if not B.via_fits(b, nx, ny, mm(v.GetWidth()), 0.13, v.GetNetCode()):
                    continue
                q = pcbnew.VECTOR2I(pcbnew.FromMM(nx), pcbnew.FromMM(ny))
                if any(p2.HitTest(q, pcbnew.FromMM(mm(v.GetWidth()) / 2 + 0.05)) for f in b.GetFootprints()
                       for p2 in f.Pads() if p2.GetAttribute() == pcbnew.PAD_ATTRIB_SMD and not f.GetReference().startswith("TP")):
                    continue
                best = (nx, ny)
                break
            if best:
                break
        if not best:
            print(f"  could not move via at ({vx:.2f}, {vy:.2f}) off {pd.GetParent().GetReference()}.{pd.GetNumber()}")
            continue
        old = v.GetPosition()
        new = B.V(*best)
        for t in b.GetTracks():
            if t.GetClass() == "PCB_TRACK" and t.GetNetCode() == v.GetNetCode():
                if t.GetStart() == old:
                    t.SetStart(new)
                if t.GetEnd() == old:
                    t.SetEnd(new)
        v.SetPosition(new)
        moved += 1
        print(f"  via ({vx:.2f}, {vy:.2f}) -> ({best[0]:.2f}, {best[1]:.2f}), off {pd.GetParent().GetReference()}.{pd.GetNumber()}")
    return moved


if __name__ == "__main__":
    os.environ.setdefault("KICAD7_FOOTPRINT_DIR", "/usr/share/kicad/footprints")
    brd = pcbnew.LoadBoard(B.PCB)
    print("vias moved off pads:", fix(brd))
    pcbnew.SaveBoard(B.PCB, brd)
    brd = pcbnew.LoadBoard(B.PCB)
    brd.BuildConnectivity()
    pcbnew.ZONE_FILLER(brd).Fill(brd.Zones())
    pcbnew.SaveBoard(B.PCB, brd)
    rpt = os.path.join(B.HERE, "drc.rpt")
    pcbnew.WriteDRCReport(brd, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    B.summarize_drc(rpt)
