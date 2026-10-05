"""
Export fabrication and assembly files for the Cue rev A dev board (KiCad 7 kicad-cli).

    python3 export_fab.py

fab/gerbers/            Gerber X2 for all 4 copper layers, mask, paste, silk, outline + Excellon drill
fab/cue_devboard_gerbers.zip
fab/bom.csv             JLCPCB BOM (Comment, Designator, Footprint, LCSC Part #) + MPN, qty, sourcing notes
fab/cpl.csv             pick-and-place (JLCPCB column names)
fab/assembly_top.pdf    assembly drawing (reference designators, outlines)
fab/schematic.pdf       schematic (from cue_devboard.kicad_sch)
"""
import csv
import os
import subprocess
import zipfile
from collections import defaultdict

import devboard_circuit as C

HERE = os.path.dirname(os.path.abspath(__file__))
PCB = os.path.join(HERE, "cue_devboard.kicad_pcb")
FAB = os.path.join(HERE, "fab")
GER = os.path.join(FAB, "gerbers")


def run(*args):
    subprocess.run(["kicad-cli", *args], check=True, capture_output=True, text=True)


def main():
    os.makedirs(GER, exist_ok=True)
    for f in os.listdir(GER):
        os.remove(os.path.join(GER, f))
    layers = "F.Cu,In1.Cu,In2.Cu,B.Cu,F.Paste,B.Paste,F.SilkS,B.SilkS,F.Mask,B.Mask,Edge.Cuts"
    run("pcb", "export", "gerbers", "--layers", layers, "--subtract-soldermask", "-o", GER + "/", PCB)
    run("pcb", "export", "drill", "--format", "excellon", "--excellon-separate-th", "--generate-map",
        "--map-format", "pdf", "-o", GER + "/", PCB)
    zpath = os.path.join(FAB, "cue_devboard_gerbers.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(GER)):
            z.write(os.path.join(GER, f), f)

    # pick and place
    pos = os.path.join(FAB, "kicad_pos.csv")
    run("pcb", "export", "pos", "--side", "both", "--format", "csv", "--units", "mm", "-o", pos, PCB)
    with open(pos) as f, open(os.path.join(FAB, "cpl.csv"), "w", newline="") as g:
        w = csv.writer(g, lineterminator="\n")
        w.writerow(["Designator", "Mid X", "Mid Y", "Layer", "Rotation"])
        for r in csv.DictReader(f):
            ref = r["Ref"]
            if ref.startswith(("TP", "FID", "E")):  # pads only, nothing to place
                continue
            w.writerow([ref, r["PosX"] + "mm", r["PosY"] + "mm", "Top" if r["Side"] == "top" else "Bottom", r["Rot"]])
    os.remove(pos)

    # BOM grouped by (value, mpn, footprint)
    groups = defaultdict(list)
    for ref, p in C.PARTS.items():
        if ref.startswith(("TP", "FID", "E")):
            continue  # pads only, nothing to buy
        groups[(p["value"], p["mpn"], p["fp"], p["status"])].append(ref)

    def key(refs):
        r = refs[0]
        return ("".join(c for c in r if c.isalpha()), int("".join(c for c in r if c.isdigit()) or 0))

    with open(os.path.join(FAB, "bom.csv"), "w", newline="") as g:
        w = csv.writer(g, lineterminator="\n")
        w.writerow(["Comment", "Designator", "Footprint", "LCSC Part #", "Manufacturer Part", "Qty", "Status",
                    "Sourcing", "Notes"])
        groups2 = defaultdict(list)
        for (val, mpn, fp, st), refs in groups.items():
            for r in refs:
                smpn, lcsc, snote = C.SOURCING[r]
                groups2[(val, fp, st, smpn, lcsc, snote)].append(r)
        for (val, fp, st, smpn, lcsc, snote), refs in sorted(groups2.items(), key=lambda kv: key(kv[1])):
            refs = sorted(refs, key=lambda r: key([r]))
            notes = " | ".join(sorted({C.PARTS[r]["note"] for r in refs if C.PARTS[r]["note"]}))
            w.writerow([val, ",".join(refs), fp, lcsc, smpn, len(refs), st, snote, notes])

    run("pcb", "export", "pdf", "--layers", "F.Fab,F.CrtYd,Edge.Cuts", "--include-border-title",
        "-o", os.path.join(FAB, "assembly_top.pdf"), PCB)
    sch = os.path.join(HERE, "cue_devboard.kicad_sch")
    if os.path.exists(sch):
        run("sch", "export", "pdf", "-o", os.path.join(FAB, "schematic.pdf"), sch)
    print("fab outputs in", FAB)
    for f in sorted(os.listdir(FAB)):
        print("  ", f)


if __name__ == "__main__":
    main()
