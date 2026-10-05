"""Simple VRML 3D models for the custom footprints (Cue.3dshapes/), so the KiCad 3D view and renders look complete.

    python3 make_3d.py

Sizes from the datasheets; shapes are boxes (good enough for renders and enclosure fit, not for MCAD detail).
KiCad VRML units are 0.1 inch; footprint origin = model origin, +Z up from the board.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "Cue.3dshapes")
U = 1 / 2.54  # mm -> VRML units (0.1 inch)


def box(cx, cy, z0, w, h, t, rgb, shine=0.2):
    return f"""Transform {{ translation {cx * U:.4f} {-cy * U:.4f} {(z0 + t / 2) * U:.4f}
  children Shape {{
    appearance Appearance {{ material Material {{ diffuseColor {rgb} specularColor 0.5 0.5 0.5 shininess {shine} }} }}
    geometry Box {{ size {w * U:.4f} {h * U:.4f} {t * U:.4f} }} }} }}
"""


def write(name, parts):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + ".wrl"), "w") as f:
        f.write("#VRML V2.0 utf8\n" + "".join(parts))
    print("wrote", os.path.join(OUT, name + ".wrl"))


# Ezurio BL54L15u: 7.9 x 6.3 x 1.75 mm; 0.6 mm blue PCB, shield can over the chip, chip antenna at the +X end
write("Ezurio_BL54L15u_453-00223", [
    box(0, 0, 0, 7.9, 6.3, 0.6, "0.05 0.2 0.55"),
    box(-1.05, 0, 0.6, 5.4, 5.7, 1.15, "0.78 0.78 0.8", 0.6),
    box(3.15, -2.2, 0.6, 1.1, 0.6, 0.45, "0.1 0.1 0.12"),
])
# TDK T5838: 3.5 x 2.65 x 0.98 mm metal can on a laminate base
write("TDK_T5838", [
    box(0, 0, 0, 3.5, 2.65, 0.2, "0.15 0.35 0.15"),
    box(0, 0, 0.2, 3.3, 2.45, 0.78, "0.8 0.8 0.82", 0.6),
])
