"""render.py <pcb> <outprefix>: PNG renders of top copper, bottom copper and inner planes via kicad-cli SVG export."""
import subprocess
import sys

import cairosvg

pcb, out = sys.argv[1], sys.argv[2]
views = {
    "top": ("F.Cu,F.SilkS,F.Mask,Edge.Cuts", False),
    "bottom": ("B.Cu,B.SilkS,B.Mask,Edge.Cuts", True),
    "in1-gnd": ("In1.Cu,Edge.Cuts", False),
    "in2-1v8": ("In2.Cu,Edge.Cuts", False),
    "assembly": ("F.Fab,F.CrtYd,Edge.Cuts", False),
}
for name, (layers, mirror) in views.items():
    svg = f"{out}-{name}.svg"
    cmd = ["kicad-cli", "pcb", "export", "svg", "--layers", layers, "--page-size-mode", "2",
           "--exclude-drawing-sheet", "-o", svg, pcb]
    if mirror:
        cmd.insert(4, "--mirror")
    subprocess.run(cmd, check=True, capture_output=True)
    cairosvg.svg2png(url=svg, write_to=f"{out}-{name}.png", output_width=1800, background_color="white")
    print(f"{out}-{name}.png")
