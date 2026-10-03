"""
Cue ear cuff - rev 0 production netlist generator.

Defines every part, pin and net of the rev A cuff board, then writes:
  cue_rev0.net              KiCad netlist (s-expression, import in Pcbnew or KiCad 8/9)
  cue_rev0_bom.csv          Bill of materials, grouped by value
  cue_rev0_connections.csv  Every pin -> net, one row per pin
and prints an electrical check report.

Status labels on parts:
  FIT  = populated on rev A
  DNP  = footprint placed, not populated (option / fallback)
  TBC  = value or pin number still to confirm against a datasheet

Pin naming: where a datasheet pin NUMBER was verified, the pin is "number:name"
(e.g. "3:BCLK"). Otherwise the pin is keyed by its datasheet NAME and must be
mapped to a pad number when the KiCad symbol/footprint is made.

Sources: Nordic nPM1300 product spec + reference circuitry, Nordic nRF54L15
docs and DevZone pin guidance, Ezurio BL54L15u datasheet, ST AN5845
(LSM6DSV16BX), TDK DS-000383 (T5838), TI DRV2605L datasheet, Azoteq IQS227D
datasheet v1.17, Syntiant/Knowles V2S200D (Mouser), Seeed XIAO nRF54L15 wiki.
"""
import csv
import os
from collections import defaultdict

OUT = os.path.dirname(os.path.abspath(__file__))

# --------------------------------------------------------------------------
# Rails and the supply range each one sits at (volts, min..max)
# --------------------------------------------------------------------------
RAILS = {
    "5V_IN": (4.75, 5.25),   # from the charging case pogo pins
    "VBAT":  (3.0, 4.2),     # Li-ion coin cell
    "VSYS":  (3.0, 4.2),     # nPM1300 system rail, follows battery when unplugged
    "1V8":   (1.8, 1.8),     # nPM1300 BUCK1
    "3V0":   (3.0, 3.0),     # nPM1300 BUCK2, only used by the IQS227 fallback
}

# --------------------------------------------------------------------------
# Parts: ref -> dict(value, mpn, footprint, status, pins, note, supply)
# supply: list of (pin, vmin, vmax) - checked against the rail on that pin
# --------------------------------------------------------------------------
P = {}

def part(ref, value, mpn, footprint, pins, status="FIT", note="", supply=(), i2c=None):
    P[ref] = dict(value=value, mpn=mpn, footprint=footprint, pins=list(pins),
                  status=status, note=note, supply=list(supply), i2c=i2c)

# U1 - Bluetooth: Ezurio BL54L15u module (nRF54L15 + 32 MHz crystal + chip antenna, certified)
part("U1", "BL54L15u", "Ezurio 453-00223 (chip antenna)", "Ezurio_BL54L15u_LGA45_7.9x6.3mm",
     ["VDD", "GND", "P1.04", "P1.05", "P1.06", "P1.07", "P1.08", "P1.09",
      "P1.10", "P1.11", "P1.12", "P1.13", "P2.00", "P2.01", "P2.02", "SWDIO", "SWDCLK", "nRESET"],
     note="7.9 x 6.3 x 1.75 mm, FCC/CE/ISED/MIC/RCM. Pad numbers TBC from module datasheet. "
          "Clock signals (SCL, PDM CLK, I2S BCLK/WCLK) must land on P1 clock pins - confirm in Nordic pin table. "
          "Interrupt inputs on P0/P1 only (P2 cannot raise pin interrupts).",
     supply=[("VDD", 1.7, 3.5)])

# U2 - Power: Nordic nPM1300 (QFN32 for rev A; CSP 3.1 x 2.4 mm later)
part("U2", "nPM1300", "Nordic NPM1300-QEAA-R", "QFN-32_5x5mm_P0.5mm",
     ["VBUS", "VBAT", "VSYS", "PVDD", "SW1", "VOUT1", "SW2", "VOUT2", "PVSS1", "PVSS2", "AVSS",
      "VDDIO", "SDA", "SCL", "GPIO0", "GPIO1", "GPIO2", "GPIO3", "GPIO4", "SHPHLD", "NTC",
      "VSET1", "VSET2", "CC1", "CC2", "VBUSOUT", "LED0", "LED1", "LED2",
      "LSIN1", "LSOUT1", "LSIN2", "LSOUT2"],
     note="I2C 0x6B. Pad numbers TBC. PVDD (buck input) tied to VSYS - confirm against reference circuit (TBC). "
          "CC1/CC2/NTC/LSIN-LSOUT handling per datasheet (TBC).",
     supply=[("VBUS", 4.0, 5.5)], i2c=0x6B)

# U3 - Motion + bone conduction: ST LSM6DSV16BX, LGA-14 (pin numbers verified, AN5845)
part("U3", "LSM6DSV16BX", "ST LSM6DSV16BXTR", "ST_LGA-14_2.5x3.0mm",
     ["1:SDO_SA0", "2:TDMout", "3:BCLK", "4:INT1", "5:VDD_IO", "6:QVAR1", "7:GND",
      "8:VDD", "9:QVAR2", "10:INT2", "11:WCLK", "12:CS", "13:SCL", "14:SDA"],
     note="SA0 low -> I2C 0x6A (avoids nPM1300 0x6B). Qvar touch on QVAR1.",
     supply=[("8:VDD", 1.71, 3.6), ("5:VDD_IO", 1.08, 3.6)], i2c=0x6A)

# U4 - Air mic: TDK T5838 (pin numbers verified, DS-000383)
part("U4", "T5838", "TDK InvenSense T5838", "TDK_T5838_LGA-7_3.5x2.65mm",
     ["1:DATA", "2:SELECT", "3:GND", "4:WAKE", "5:THSEL", "6:CLK", "7:VDD"],
     note="Supply 1.62-1.98 V only - this sets the board's 1.8 V logic.",
     supply=[("7:VDD", 1.62, 1.98)])

# U5 - Haptic driver: TI DRV2605L, VSSOP-10 for rev A (DSBGA-9 later)
part("U5", "DRV2605L", "TI DRV2605LDGSR", "VSSOP-10_3x3mm_P0.5mm",
     ["VDD", "VDD_NC", "GND", "EN", "IN_TRIG", "SDA", "SCL", "REG", "OUT+", "OUT-"],
     note="I2C 0x5A. EN high before register writes. Confirm 1.8 V I2C logic thresholds (TBC). Pad numbers TBC.",
     supply=[("VDD", 2.0, 5.2)], i2c=0x5A)

# U6 - Optional voice-vibration sensor: Knowles/Syntiant V2S200D
part("U6", "V2S200D", "Syntiant V2S200D", "V2S200D_3.30x2.30mm",
     ["VDD", "GND", "CLK", "DATA", "SEL"], status="DNP",
     note="Option: shares PDM bus on the left channel. Pin names/numbers TBC from datasheet.",
     supply=[("VDD", 1.65, 3.3)])

# U7 - Fallback touch: Azoteq IQS227B, DFN-6 (pin numbers verified, IQS227D datasheet)
part("U7", "IQS227B", "Azoteq IQS227B-00000000-DNR", "DFN-6_2x2mm",
     ["1:TOUT", "2:GND", "3:POUT", "4:VREG", "5:VDDHI", "6:CX"], status="DNP",
     note="Fallback only if Qvar touch fails. Outputs swing to VDDHI (3.0 V): add a level translator before U1 if fitted.",
     supply=[("5:VDDHI", 2.4, 5.0)])

part("M1", "LRA 8 mm", "Vybronics VG0832013D", "LRA_Coin_8mm_Pads", ["1", "2"],
     note="Alt: VG0640001D (6 mm). Mounted on flex, pressed toward skin.")
part("BT1", "CP1254 A4X", "VARTA CoinPower CP 1254 A4X", "VARTA_CP1254_Tabs", ["+", "-"],
     note="3.7 V, 74 mAh, 12.1 mm dia. Alt CP1240 A4X (50 mAh, thinner). Confirm whether cell needs external protection.")
part("J1", "Pogo pads", "Gold pads for case pogo pins", "Pads_2x1.5mm", ["1:5V", "2:GND"])
part("D1", "TVS 5V", "TBC (0201/0402 ESD diode, 5 V working)", "D_0201", ["1:K", "2:A"], note="Part TBC.")
part("L1", "2.2uH", "DCR<400mOhm, +/-20%", "L_0806", ["1", "2"], note="BUCK1 (nPM1300 ref).")
part("L2", "2.2uH", "DCR<400mOhm, +/-20%", "L_0806", ["1", "2"], note="BUCK2 (nPM1300 ref).")

def cap(ref, val, fp="C_0402", status="FIT", note=""):
    part(ref, val, "X5R/X7R ceramic", fp, ["1", "2"], status=status, note=note)

cap("C1", "1uF", note="VBUS")
cap("C2", "10uF", fp="C_0603", note="VBUS")
cap("C3", "10uF", fp="C_0603", note="VBAT")
cap("C4", "1uF", note="VSYS")
cap("C5", "2.2uF", note="VSYS")
cap("C6", "10uF", fp="C_0603", note="1V8 out")
cap("C7", "10uF", fp="C_0603", note="3V0 out")
cap("C8", "100nF", fp="C_0201", note="U3 VDD (typ.)")
cap("C9", "100nF", fp="C_0201", note="U3 VDD_IO (typ.)")
cap("C10", "100nF", fp="C_0201", note="U4 VDD, X7R, closest part to pin 7")
cap("C11", "1uF", note="U5 VDD")
cap("C12", "1uF", note="U5 REG")
cap("C13", "1uF", status="DNP", note="U7 VDDHI")
cap("C14", "1uF", status="DNP", note="U7 VREG")
cap("C15", "100nF", fp="C_0201", status="DNP", note="U6 VDD (typ.)")
cap("C16", "TBC", note="U1 VDD bulk, value per BL54L15u datasheet (TBC)")

def res(ref, val, status="FIT", note=""):
    part(ref, val, "1% thick film", "R_0201", ["1", "2"], status=status, note=note)

res("R1", "4.7k", note="I2C SDA pull-up to 1V8")
res("R2", "4.7k", note="I2C SCL pull-up to 1V8")
res("R3", "TBC", note="nPM1300 VSET1 - pick value for 1.8 V from datasheet table")
res("R4", "TBC", note="nPM1300 VSET2 - pick value for 3.0 V from datasheet table")
res("R5", "470R", status="DNP", note="U7 CX series (ESD), per IQS227 datasheet")
res("R6", "TBC", note="U3 QVAR1 series to shell electrode (TBC)")

part("E1", "Shell electrode", "Contact to metal shell / touch area", "Pad_Spring_Contact", ["1"],
     note="Qvar touch surface. Shared by R5 (U7 fallback) and R6 (Qvar); fit one.")
for i, n in enumerate(["SWDIO", "SWDCLK", "1V8", "GND", "SHPHLD"], start=1):
    part(f"TP{i}", f"TP {n}", "Test pad", "TestPoint_Pad_D1.0mm", ["1"])
part("TP6", "TP TOUT", "Test pad", "TestPoint_Pad_D1.0mm", ["1"], status="DNP")
part("TP7", "TP POUT", "Test pad", "TestPoint_Pad_D1.0mm", ["1"], status="DNP")

# --------------------------------------------------------------------------
# Nets: name -> list of (ref, pin)
# --------------------------------------------------------------------------
N = defaultdict(list)
NC = set()   # (ref, pin) deliberately not connected

def net(name, *nodes):
    for n in nodes:
        N[name].append(n)

def nc(ref, *pins):
    for p in pins:
        NC.add((ref, p))

# Power input and battery
net("5V_IN", ("J1", "1:5V"), ("D1", "1:K"), ("U2", "VBUS"), ("C1", "1"), ("C2", "1"))
net("VBAT", ("BT1", "+"), ("U2", "VBAT"), ("C3", "1"))
net("VSYS", ("U2", "VSYS"), ("U2", "PVDD"), ("C4", "1"), ("C5", "1"),
    ("U5", "VDD"), ("U5", "VDD_NC"), ("C11", "1"))
net("SW1", ("U2", "SW1"), ("L1", "1"))
net("SW2", ("U2", "SW2"), ("L2", "1"))
net("1V8", ("L1", "2"), ("U2", "VOUT1"), ("C6", "1"), ("U2", "VDDIO"),
    ("U1", "VDD"), ("C16", "1"),
    ("U3", "8:VDD"), ("U3", "5:VDD_IO"), ("U3", "12:CS"), ("C8", "1"), ("C9", "1"),
    ("U4", "7:VDD"), ("C10", "1"),
    ("U6", "VDD"), ("U6", "SEL"), ("C15", "1"),
    ("R1", "2"), ("R2", "2"), ("TP3", "1"))
net("3V0", ("L2", "2"), ("U2", "VOUT2"), ("C7", "1"), ("U7", "5:VDDHI"), ("C13", "1"))

gnd = [("J1", "2:GND"), ("D1", "2:A"), ("BT1", "-"), ("U1", "GND"),
       ("U2", "PVSS1"), ("U2", "PVSS2"), ("U2", "AVSS"),
       ("U3", "7:GND"), ("U3", "1:SDO_SA0"), ("U4", "3:GND"), ("U4", "2:SELECT"),
       ("U5", "GND"), ("U6", "GND"), ("U7", "2:GND"), ("TP4", "1")]
gnd += [(c, "2") for c in ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10",
                           "C11", "C12", "C13", "C14", "C15", "C16"]]
net("GND", *gnd)
net("VSET1", ("U2", "VSET1"), ("R3", "1"))
net("VSET2", ("U2", "VSET2"), ("R4", "1"))
N["GND"] += [("R3", "2"), ("R4", "2")]

# I2C bus (1.8 V)
net("I2C_SDA", ("U1", "P1.10"), ("U2", "SDA"), ("U3", "14:SDA"), ("U5", "SDA"), ("R1", "1"))
net("I2C_SCL", ("U1", "P1.11"), ("U2", "SCL"), ("U3", "13:SCL"), ("U5", "SCL"), ("R2", "1"))

# PDM bus: T5838 right channel (SELECT low), V2S200D left channel (SEL high)
net("PDM_CLK", ("U1", "P1.12"), ("U4", "6:CLK"), ("U6", "CLK"))
net("PDM_DIN", ("U1", "P1.13"), ("U4", "1:DATA"), ("U6", "DATA"))

# TDM / I2S from LSM6DSV16BX bone-conduction channel
net("TDM_BCLK", ("U1", "P1.04"), ("U3", "3:BCLK"))
net("TDM_WCLK", ("U1", "P1.05"), ("U3", "11:WCLK"))
net("TDM_DIN", ("U1", "P1.06"), ("U3", "2:TDMout"))

# Interrupts (P1 - interrupt capable)
net("IMU_INT1", ("U3", "4:INT1"), ("U1", "P1.07"))
net("MIC_WAKE", ("U4", "4:WAKE"), ("U1", "P1.08"))
net("PMIC_INT", ("U2", "GPIO0"), ("U1", "P1.09"))

# Control outputs (P2 is fine for outputs)
net("HAPTIC_EN", ("U1", "P2.00"), ("U5", "EN"))
net("HAPTIC_TRIG", ("U1", "P2.01"), ("U5", "IN_TRIG"))
net("MIC_THSEL", ("U1", "P2.02"), ("U4", "5:THSEL"))

# Haptics
net("U5_REG", ("U5", "REG"), ("C12", "1"))
net("LRA_P", ("U5", "OUT+"), ("M1", "1"))
net("LRA_N", ("U5", "OUT-"), ("M1", "2"))

# Touch: Qvar (fit) or IQS227 (DNP fallback) onto the shell electrode
net("QVAR1", ("U3", "6:QVAR1"), ("R6", "1"))
net("TOUCH_E", ("R6", "2"), ("R5", "2"), ("E1", "1"))
net("IQS_CX", ("U7", "6:CX"), ("R5", "1"))
net("IQS_VREG", ("U7", "4:VREG"), ("C14", "1"))
net("IQS_TOUT", ("U7", "1:TOUT"), ("TP6", "1"))
net("IQS_POUT", ("U7", "3:POUT"), ("TP7", "1"))

# Debug / service
net("SWDIO", ("U1", "SWDIO"), ("TP1", "1"))
net("SWDCLK", ("U1", "SWDCLK"), ("TP2", "1"))
net("SHPHLD", ("U2", "SHPHLD"), ("TP5", "1"))

# Deliberately unconnected
nc("U1", "nRESET")
nc("U2", "GPIO1", "GPIO2", "GPIO3", "GPIO4", "LED0", "LED1", "LED2", "VBUSOUT",
   "CC1", "CC2", "NTC", "LSIN1", "LSOUT1", "LSIN2", "LSOUT2")
nc("U3", "9:QVAR2", "10:INT2")

# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------
def checks():
    problems, notes = [], []
    used = defaultdict(list)
    for name, nodes in N.items():
        for ref, pin in nodes:
            if ref not in P:
                problems.append(f"{name}: unknown part {ref}")
            elif pin not in P[ref]["pins"]:
                problems.append(f"{name}: {ref} has no pin '{pin}'")
            used[(ref, pin)].append(name)
        fitted = [n for n in nodes if n[0] in P and P[n[0]]["status"] == "FIT"]
        if len(nodes) < 2:
            problems.append(f"net {name} has only {len(nodes)} node(s)")
        elif len(fitted) < 2:
            notes.append(f"net {name} only has DNP parts or one fitted node (option net)")
    for (ref, pin), nets in used.items():
        if len(nets) > 1:
            problems.append(f"{ref}.{pin} is on several nets: {nets}")
    for ref, p in P.items():
        for pin in p["pins"]:
            if (ref, pin) not in used and (ref, pin) not in NC:
                problems.append(f"{ref}.{pin} is floating (not on a net, not marked NC)")
            if (ref, pin) in used and (ref, pin) in NC:
                problems.append(f"{ref}.{pin} marked NC but connected")
    # supply range vs rail
    pin_net = {k: v[0] for k, v in used.items()}
    for ref, p in P.items():
        for pin, vmin, vmax in p["supply"]:
            rail = pin_net.get((ref, pin))
            if rail not in RAILS:
                problems.append(f"{ref}.{pin} supply pin is on '{rail}', not a rail")
                continue
            lo, hi = RAILS[rail]
            if lo < vmin or hi > vmax:
                problems.append(f"{ref}.{pin} on {rail} ({lo}-{hi} V) is outside its {vmin}-{vmax} V rating")
            else:
                notes.append(f"OK  {ref}.{pin} on {rail} ({lo}-{hi} V) within {vmin}-{vmax} V")
    # I2C addresses on the shared bus
    addrs = defaultdict(list)
    for ref, p in P.items():
        if p["i2c"] is not None and p["status"] == "FIT":
            addrs[p["i2c"]].append(ref)
    for a, refs in addrs.items():
        if len(refs) > 1:
            problems.append(f"I2C address clash 0x{a:02X}: {refs}")
        else:
            notes.append(f"OK  I2C 0x{a:02X} -> {refs[0]}")
    # interrupt inputs must not be on port 2
    for name in ("IMU_INT1", "MIC_WAKE", "PMIC_INT"):
        for ref, pin in N[name]:
            if ref == "U1" and pin.startswith("P2."):
                problems.append(f"{name} on {pin}: port 2 cannot raise pin interrupts")
    # bus nets on port 1
    for name in ("I2C_SDA", "I2C_SCL", "PDM_CLK", "PDM_DIN", "TDM_BCLK", "TDM_WCLK", "TDM_DIN"):
        for ref, pin in N[name]:
            if ref == "U1" and not pin.startswith("P1."):
                problems.append(f"{name} on {pin}: serial peripherals should sit on port 1")
    return problems, notes

# --------------------------------------------------------------------------
# Writers
# --------------------------------------------------------------------------
def q(s):
    return '"' + str(s).replace('"', "'") + '"'

def write_kicad_netlist(path):
    lines = ['(export (version "E")',
             '  (design (source "cue_netlist.py") (date "2026-10-03") (tool "Cue netlist generator")',
             '    (sheet (number "1") (name "/") (tstamps "/")',
             '      (title_block (title "Cue ear cuff") (company "Cue") (rev "0"))))',
             '  (components']
    for ref in sorted(P, key=sortkey):
        p = P[ref]
        lines.append(f'    (comp (ref {q(ref)}) (value {q(p["value"])}) (footprint {q(p["footprint"])})')
        lines.append(f'      (fields (field (name "MPN") {q(p["mpn"])}) (field (name "Status") {q(p["status"])}))'
                     f' (libsource (lib "cue") (part {q(p["value"])}) (description {q(p["note"][:120])})))')
    lines.append('  )')
    lines.append('  (nets')
    for code, name in enumerate(sorted(N), start=1):
        lines.append(f'    (net (code {q(code)}) (name {q("/" + name)})')
        for ref, pin in N[name]:
            num = pin.split(":")[0]
            lines.append(f'      (node (ref {q(ref)}) (pin {q(num)}) (pinfunction {q(pin)}))')
        lines.append('    )')
    lines.append('  )')
    lines.append(')')
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")

def sortkey(ref):
    head = "".join(c for c in ref if c.isalpha())
    tail = "".join(c for c in ref if c.isdigit())
    return (head, int(tail or 0))

def write_bom(path):
    groups = defaultdict(list)
    for ref in sorted(P, key=sortkey):
        p = P[ref]
        groups[(p["value"], p["mpn"], p["footprint"], p["status"])].append(ref)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Refs", "Qty", "Value", "Manufacturer part", "Footprint", "Status", "Notes"])
        for (val, mpn, fp, st), refs in sorted(groups.items(), key=lambda kv: sortkey(kv[1][0])):
            note = " | ".join(sorted({P[r]["note"] for r in refs if P[r]["note"]}))
            w.writerow([" ".join(refs), len(refs), val, mpn, fp, st, note])

def write_connections(path):
    pin_net = {}
    for name, nodes in N.items():
        for n in nodes:
            pin_net[n] = name
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Ref", "Part", "Pin", "Net", "Status"])
        for ref in sorted(P, key=sortkey):
            for pin in P[ref]["pins"]:
                w.writerow([ref, P[ref]["value"], pin,
                            pin_net.get((ref, pin), "NC" if (ref, pin) in NC else "??"),
                            P[ref]["status"]])

if __name__ == "__main__":
    problems, notes = checks()
    write_kicad_netlist(os.path.join(OUT, "cue_rev0.net"))
    write_bom(os.path.join(OUT, "cue_rev0_bom.csv"))
    write_connections(os.path.join(OUT, "cue_rev0_connections.csv"))
    fit = sum(1 for p in P.values() if p["status"] == "FIT")
    print(f"parts: {len(P)} ({fit} fitted, {len(P) - fit} DNP) | nets: {len(N)} | "
          f"pins: {sum(len(p['pins']) for p in P.values())} | NC pins: {len(NC)}")
    for n in notes:
        print("  " + n)
    print(f"PROBLEMS: {len(problems)}")
    for p in problems:
        print("  !! " + p)
    raise SystemExit(1 if problems else 0)
