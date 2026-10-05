# Generates the "Bone-conduction kit wiring" artboard (.dc.html) from coordinates.
W, H = 1760, 1160
els_back, els_lines, els_cards, els_labels = [], [], [], []
FONT = "'IBM Plex Sans', 'Helvetica Neue', sans-serif"
MONO = "'IBM Plex Mono', monospace"

def seg(x1, y1, x2, y2, color, w=3):
    if y1 == y2:
        x, n = min(x1, x2), abs(x2 - x1)
        els_lines.append(f'<svg width="{n}" height="8" viewBox="0 0 {n} 8" preserveAspectRatio="none" style="position: absolute; left: {x}px; top: {y1-4}px; width: {n}px; height: 8px; overflow: visible; fill: none; stroke: {color}; stroke-width: {w}; stroke-linecap: round"><path d="M 0 4 L {n} 4"></path></svg>')
    else:
        y, n = min(y1, y2), abs(y2 - y1)
        els_lines.append(f'<svg width="8" height="{n}" viewBox="0 0 8 {n}" preserveAspectRatio="none" style="position: absolute; left: {x1-4}px; top: {y}px; width: 8px; height: {n}px; overflow: visible; fill: none; stroke: {color}; stroke-width: {w}; stroke-linecap: round"><path d="M 4 0 L 4 {n}"></path></svg>')

def path(pts, color, w=3):
    for (a, b), (c, d) in zip(pts, pts[1:]):
        seg(a, b, c, d, color, w)

def card(x, y, w, h, title, sub, border, bg="#1E1F23"):
    els_cards.append(f'<div style="position: absolute; left: {x}px; top: {y}px; width: {w}px; height: {h}px; box-sizing: border-box; background: {bg}; border: 2px solid {border}; border-radius: 16px"></div>')
    els_labels.append(f'<div style="position: absolute; left: {x+20}px; top: {y+16}px; width: {w-40}px; font-size: 18px; line-height: 24px; font-weight: 600">{title}</div>')
    if sub:
        els_labels.append(f'<div style="position: absolute; left: {x+20}px; top: {y+42}px; width: {w-40}px; font-size: 13px; line-height: 18px; color: #A9A69E">{sub}</div>')

def pin(x, y, name, side, color="#ECEAE4", nc=False):
    els_labels.append(f'<div style="position: absolute; left: {x-7}px; top: {y-7}px; width: 14px; height: 14px; box-sizing: border-box; background: {"#16171A" if nc else "#C9A55E"}; border: 2px solid #C9A55E; border-radius: 3px"></div>')
    if side == "L":   # label inside card, to the right of a left-edge pin
        els_labels.append(f'<div style="position: absolute; left: {x+14}px; top: {y-10}px; width: 120px; font-family: {MONO}; font-size: 15px; line-height: 20px; color: {color}">{name}</div>')
    else:             # label inside card, to the left of a right-edge pin
        els_labels.append(f'<div style="position: absolute; left: {x-134}px; top: {y-10}px; width: 120px; text-align: right; font-family: {MONO}; font-size: 15px; line-height: 20px; color: {color}">{name}</div>')

def flag(x, y, text, color, bg):
    els_labels.append(f'<div style="position: absolute; left: {x}px; top: {y-13}px; width: 56px; height: 26px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: {bg}; border: 1.5px solid {color}; border-radius: 13px; font-family: {MONO}; font-size: 13px; font-weight: 500; color: {color}">{text}</div>')

def gnd(x, y):
    # ground symbol: stub down then three bars
    seg(x, y, x, y + 14, "#BDBAB2", 2.5)
    for i, half in enumerate((14, 9, 4)):
        seg(x - half, y + 14 + i * 6, x + half, y + 14 + i * 6, "#BDBAB2", 2.5)

def note(x, y, w, text, size=13, color="#A9A69E"):
    els_labels.append(f'<div style="position: absolute; left: {x}px; top: {y}px; width: {w}px; font-size: {size}px; line-height: {int(size*1.45)}px; color: {color}">{text}</div>')

RED, GND_C, PURP, ORNG, BLUE, YEL, CABLE = "#E5584A", "#BDBAB2", "#9B7BD9", "#E8914A", "#5B8FD9", "#E8C547", "#7A7A80"

# ---------------- XIAO
XL, XR, XT, XB = 640, 940, 236, 790
card(XL, XT, XR - XL, XB - XT, "XIAO nRF54L15 Sense", "Built in: air mic, motion sensor, charger", "#3E6A9E", "#1C2A3D")
els_cards.append(f'<div style="position: absolute; left: 750px; top: 210px; width: 80px; height: 26px; box-sizing: border-box; background: #8E8D88; border-radius: 6px 6px 2px 2px"></div>')
note(742, 180, 100, '<span style="font-family: IBM Plex Mono, monospace">USB-C</span>', 12)
left = [("D0", 330), ("D1", 390), ("D2", 450), ("D3", 510), ("D4", 570), ("D5", 630), ("D6", 690)]
right = [("5V", 330), ("GND", 390), ("3V3", 450), ("D10", 510), ("D9", 570), ("D8", 630), ("D7", 690)]
used = {"D0": ORNG, "D3": BLUE, "D4": PURP, "D5": YEL, "GND": "#ECEAE4", "3V3": RED}
for n, y in left:
    pin(XL, y, n, "L", used.get(n, "#6E6C66"))
for n, y in right:
    pin(XR, y, n, "R", used.get(n, "#6E6C66"))
# battery pads on the underside
els_labels.append(f'<div style="position: absolute; left: 720px; top: 722px; width: 140px; font-size: 12px; line-height: 16px; color: #A9A69E; text-align: center">underside pads</div>')
for nm, x in (("BAT+", 760), ("BAT−", 820)):
    pin(x, XB, "", "L")
    els_labels.append(f'<div style="position: absolute; left: {x-30}px; top: {XB-36}px; width: 60px; text-align: center; font-family: {MONO}; font-size: 13px; line-height: 16px; color: #ECEAE4">{nm}</div>')

# ---------------- V2S200D eval (top left)
VL, VR, VT, VB = 70, 330, 236, 560
card(VL, VT, VR - VL, VB - VT, "Knowles V2S200D eval", "Bone-conduction sensor. Press its face against the skin.", "#9B7BD9")
v2s = [("VDD", 350), ("GND", 390), ("DATA", 430), ("CLK", 470), ("SEL", 510)]
for n, y in v2s:
    pin(VR, y, n, "R", {"VDD": RED, "DATA": ORNG, "CLK": PURP}.get(n, "#ECEAE4"))
# ---------------- 0.1" breakout + LRA Wireling (bottom left)
BL, BR, BT, BB = 70, 330, 600, 880
card(BL, BT, BR - BL, BB - BT, "Breakout Wireling", "0.1&quot; I2C breakout: turns the cable into jumper pins", "#E8C547")
brk = [("3V3", 680), ("GND", 720), ("SDA", 760), ("SCL", 800), ("INT", 840)]
for n, y in brk:
    pin(BR, y, n, "R", {"3V3": RED, "SDA": BLUE, "SCL": YEL, "INT": "#6E6C66"}.get(n, "#ECEAE4"), nc=(n == "INT"))
card(BL, 960, BR - BL, 120, "LRA Wireling", "Vibration motor + DRV2605 driver (I2C 0x5A)", "#5FB37E")
seg(200, BB, 200, 960, CABLE, 10)
note(214, 905, 170, "5-pin Wireling cable", 12)

# ---------------- LiPo (below XIAO)
card(680, 1000, 240, 96, "LiPo 100 mAh", "3.7 V. Solder to the underside pads", "#E5584A")
path([(760, XB), (760, 1000)], RED, 3)
path([(820, XB), (820, 1000)], GND_C, 3)

# ---------------- signal wires (left channel)
path([(VR, 430), (440, 430), (440, 330), (XL, 330)], ORNG)       # V2S DATA -> D0
path([(VR, 470), (480, 470), (480, 570), (XL, 570)], PURP)       # V2S CLK  -> D4
path([(BR, 760), (540, 760), (540, 510), (XL, 510)], BLUE)       # SDA -> D3
path([(BR, 800), (590, 800), (590, 630), (XL, 630)], YEL)        # SCL -> D5
# crossing note at (540, 540)
els_labels.append(f'<div style="position: absolute; left: 548px; top: 582px; width: 70px; font-size: 11px; line-height: 14px; color: #8E8B84">no join</div>')

# ---------------- power flags
for (x, y) in [(VR, 350), (BR, 680)]:
    seg(x, y, x + 34, y, RED, 3)
    flag(x + 34, y, "3V3", RED, "#2A1A18")
seg(XR, 450, XR + 40, 450, RED, 3)
flag(XR + 40, 450, "3V3", RED, "#2A1A18")
for (x, y) in [(VR, 390), (VR, 510), (BR, 720)]:
    seg(x, y, x + 34, y, GND_C, 3)
    gnd(x + 34, y)
seg(XR, 390, XR + 40, 390, GND_C, 3)
gnd(XR + 40, 390)
note(VR + 46, 502, 90, "sets channel", 11)

# ---------------- title
title = ('<div style="position: absolute; left: 64px; top: 48px; font-family: \'Bricolage Grotesque\', Georgia, serif; font-size: 48px; font-weight: 700; letter-spacing: -1px; line-height: 56px">Bone-conduction kit: wiring</div>'
         f'<div style="position: absolute; left: 64px; top: 112px; width: 1300px; font-size: 17px; line-height: 25px; color: #A9A69E">The four parts you have, plus the cable and breakout that make the Wireling usable with jumper wires. Same-colour flags and ground symbols are the same wire: a mini breadboard\'s rails make that easy.</div>')

# ---------------- wire list (right)
rows = [
    ("1", RED, "XIAO 3V3", "V2S VDD, breakout 3V3", "3V3 rail"),
    ("2", GND_C, "XIAO GND", "V2S GND, V2S SEL, breakout GND", "Ground rail"),
    ("3", PURP, "XIAO D4 (P1.10)", "V2S CLK", "Sensor clock (clock pin)"),
    ("4", ORNG, "XIAO D0 (P1.04)", "V2S DATA", "Sensor data"),
    ("5", YEL, "XIAO D5 (P1.11)", "Breakout SCL", "Motor I2C clock (clock pin)"),
    ("6", BLUE, "XIAO D3 (P1.07)", "Breakout SDA", "Motor I2C data"),
    ("7", CABLE, "Breakout", "LRA Wireling", "5-pin Wireling cable"),
    ("8", RED, "LiPo red (+)", "BAT+ pad, underside", "Solder; check polarity"),
    ("9", GND_C, "LiPo black (−)", "BAT− pad, underside", "Solder"),
]
trs = "".join(
    f'<tr><td style="padding: 9px 8px; border-bottom: 1px solid #2F3036; font-family: {MONO}">{n}</td>'
    f'<td style="padding: 9px 8px; border-bottom: 1px solid #2F3036"><span style="display: inline-block; width: 22px; height: 6px; border-radius: 3px; background: {c}; vertical-align: middle"></span></td>'
    f'<td style="padding: 9px 8px; border-bottom: 1px solid #2F3036">{a}</td><td style="padding: 9px 8px; border-bottom: 1px solid #2F3036">{b}</td>'
    f'<td style="padding: 9px 8px; border-bottom: 1px solid #2F3036; color: #A9A69E">{w}</td></tr>'
    for n, c, a, b, w in rows)
table = (f'<div style="position: absolute; left: 1080px; top: 236px; width: 616px; display: flex; flex-direction: column; gap: 14px">'
         f'<div style="font-family: {MONO}; font-size: 13px; letter-spacing: 2px; color: #D9B98A">WIRE LIST</div>'
         f'<table style="width: 616px; border-collapse: collapse; font-size: 14px; line-height: 19px; text-align: left">'
         f'<tr><th style="padding: 8px; font-family: {MONO}; font-size: 12px; font-weight: 500; color: #D9B98A; border-bottom: 1px solid #44454B">#</th><th style="border-bottom: 1px solid #44454B"></th>'
         f'<th style="padding: 8px; font-family: {MONO}; font-size: 12px; font-weight: 500; color: #D9B98A; border-bottom: 1px solid #44454B">FROM</th><th style="padding: 8px; font-family: {MONO}; font-size: 12px; font-weight: 500; color: #D9B98A; border-bottom: 1px solid #44454B">TO</th><th style="padding: 8px; font-family: {MONO}; font-size: 12px; font-weight: 500; color: #D9B98A; border-bottom: 1px solid #44454B">WHAT IT IS</th></tr>'
         f'{trs}</table></div>')
notes = [
    ("ALSO BUY", "TinyCircuits 5-pin Wireling cable and 0.1&quot; Breakout I2C Wireling, a mini breadboard and female-to-male jumpers."),
    ("WHY THESE PINS", "The nRF54L15 needs clock signals on its clock pins. D4 and D5 are the two on the header, so the sensor clock and motor I2C clock take them. The motor's I2C data moves from D4 to D3 in firmware."),
    ("BUILT-IN MIC", "The sensor uses the chip's second mic input, so the XIAO's own air mic keeps working: a side-by-side reference for every test."),
    ("CHECK FIRST", "Match the eval board's printed pin labels to VDD, GND, CLK, DATA, SEL before wiring. No battery yet? Power from USB-C instead and skip wires 8–9."),
]
nh = "".join(f'<div style="background: #1E1F23; border: 1px solid #2F3036; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px"><div style="font-family: {MONO}; font-size: 12px; letter-spacing: 2px; color: #D9B98A">{t}</div><div style="font-size: 14px; line-height: 20px">{b}</div></div>' for t, b in notes)
notes_box = f'<div style="position: absolute; left: 1080px; top: 712px; width: 616px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px">{nh}</div>'

body = "\n".join(els_back + els_lines + els_cards + els_labels) + title + table + notes_box
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bone-conduction kit wiring</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&amp;family=IBM+Plex+Mono:wght@400;500&amp;family=IBM+Plex+Sans:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
a{{color:#D9B98A}}a:hover{{color:#F0D7AE}}
</style>
</helmet>
<div style="position: relative; width: {W}px; height: {H}px; background: #16171A; color: #ECEAE4; font-family: {FONT}; overflow: hidden">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{W},"height":{H}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''
import pathlib
out = pathlib.Path(__file__).with_name("kit_wiring.html")
out.write_text(html)
print("ok", len(html))
