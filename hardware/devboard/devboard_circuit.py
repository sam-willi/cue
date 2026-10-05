"""
Cue rev A dev board - circuit definition.

Same circuits as the production cuff (hardware/rev0), on a ~32 x 22 mm flat board with
bench conveniences: USB-C charging, JST battery and motor connectors, SWD debug
header, expansion header, buttons and test points.

Differences from the rev0 cuff netlist:
  - USB-C (J1) replaces the case pogo pads; nPM1300 CC1/CC2 detect the charger.
  - JST-PH battery (J2) and JST-SH LRA (J3) connectors replace soldered cell and motor.
  - Knowles V2S200D and Azoteq IQS227 are not on this board; their signals
    (PDM, I2C, 3V0) come out on the expansion header (J5) for eval boards.
  - The T5838 mic is powered through nPM1300 load switch 1 (MIC_1V8). Firmware sets
    BUCK1 to 1.8 V before closing the switch, so the 1.98 V-max mic is protected
    even if the BUCK1 start-up voltage were wrong.
  - nRF54L15 pins re-chosen on the BL54L15u pad map: clock signals only on clock pins
    (P1.03, P1.04, P1.08, P1.11, P1.12), interrupts on P0/P1 only, and Ezurio Note 7
    respected (P1.09-P1.12 below 1 MHz behind 330 R).

Every pin is keyed by its footprint pad number.
"""
from collections import defaultdict

FP = "/usr/share/kicad/footprints/"
CUE = "CUE_LOCAL"  # replaced with the project footprint library path at build time

# rail -> (vmin, vmax)
RAILS = {
    "VBUS": (4.75, 5.25), "VBAT": (3.0, 4.2), "VSYS": (3.0, 5.25),  # VSYS may follow VBUS while charging
    "1V8": (1.8, 1.8), "3V0": (3.0, 3.0), "MIC_1V8": (1.8, 1.8),
}

# ref: dict(lib, fp, value, mpn, pins{pad: net}, supply[(pad, vmin, vmax)], i2c, note, status)
PARTS = {}


def part(ref, lib, fp, value, mpn, pins, supply=(), i2c=None, note="", status="FIT", nc=()):
    PARTS[ref] = dict(lib=lib, fp=fp, value=value, mpn=mpn, pins=dict(pins), supply=list(supply),
                      i2c=i2c, note=note, status=status, nc=set(nc))


# --- U1 radio module: Ezurio BL54L15u (453-00223, chip antenna). Pad map from Ezurio datasheet v1.1.
u1 = {
    "2": "HAPTIC_EN",      # P2.00 (output; P2 is fine for outputs)
    "3": "TDM_BCLK",       # P1.08 clock pin  -> I2S SCK
    "5": "1V8",            # VDD_nRF
    "6": "HAPTIC_TRIG",    # P2.01
    "7": "TDM_DIN",        # P1.06 -> I2S SDIN
    "8": "IMU_INT1",       # P1.07 interrupt
    "13": "MIC_THSEL",     # P2.02
    "15": "MIC_WAKE",      # P1.05 interrupt
    "9": "PDM_CLK",        # P1.03 clock pin
    "17": "I2C_SCL",       # P1.04 clock pin
    "18": "PDM_DIN",       # P1.14
    # Ezurio Note 7: P1.09-P1.12 must toggle below 1 MHz with >=330 R series resistance.
    # Only slow push-pull/input signals go there, each through a 330 R (R7-R9); no I2C.
    "20": "I2C_SDA",       # P1.13
    "21": "U1_PMIC_INT",   # P1.10 interrupt via R8
    "23": "U1_TDM_WCLK",   # P1.11 -> I2S LRCK via R7 (8-48 kHz)
    "25": "SWDCLK", "27": "SWDIO", "32": "nRESET",
    "35": "EXP_P0_01",     # P0.01 spare to header
    "38": "BTN_USER",      # P0.00 user button (internal pull-up)
}
for g in ["4", "14", "24", "28", "31", "34", "36", "39", "G1", "G2", "G3", "G4", "G5", "G6"]:
    u1[g] = "GND"
part("U1", CUE, "Ezurio_BL54L15u_453-00223", "BL54L15u", "Ezurio 453-00223", u1,
     supply=[("5", 1.7, 3.5)],
     nc=["1", "10", "19", "11", "12", "16", "22", "26", "29", "30", "33", "37", "40", "41", "42", "43", "44", "45"],
     note="Certified nRF54L15 module, chip antenna, 7.9x6.3x1.75 mm. Place on board edge; no copper under antenna.")

# --- U2 PMIC: Nordic nPM1300 QFN32 (pin numbers from Nordic product spec). EP = AVSS.
part("U2", FP + "Package_DFN_QFN.pretty", "QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm", "nPM1300",
     "Nordic NPM1300-QEAA-R", {
         "1": "1V8", "2": "GND", "3": "SW1", "4": "VSYS", "5": "SW2", "6": "GND",
         "7": "PMIC_INT", "12": "1V8", "13": "I2C_SDA", "14": "I2C_SCL", "15": "SHPHLD",
         "16": "VSET2", "17": "VSET1", "18": "NTC", "19": "VBAT", "20": "VSYS", "21": "VBUS", "22": "VBUSOUT",
         "23": "CC1", "24": "CC2", "28": "1V8", "29": "MIC_1V8", "30": "GND", "31": "GND", "32": "3V0", "33": "GND"},
     supply=[("21", 4.0, 5.5)], i2c=0x6B,
     nc=["8", "9", "10", "11", "25", "26", "27"],
     note="I2C 0x6B. BUCK1=1V8 (VSET1), BUCK2=3V0 (VSET2), LS1 gates MIC_1V8. "
          "Matches nPM1300 PS v1.2.1 Configuration 1 (Table 38/39). LOADSW2 unused: LSIN2/LSOUT2 to GND "
          "per Fig. 57/58. NTC: 10k B3380 thermistor RT1 (Table 11); select it in ADCNTCRSEL. EP size: KiCad 3.45 mm vs 3.5 mm nominal on sister nPM1304 - confirm.")

# --- U3 IMU + bone conduction: ST LSM6DSV16BX LGA-14 (pins from ST AN5845)
part("U3", FP + "Package_LGA.pretty", "LGA-14_3x2.5mm_P0.5mm_LayoutBorder3x4y", "LSM6DSV16BX",
     "ST LSM6DSV16BXTR", {
         "1": "GND", "2": "TDM_DIN", "3": "TDM_BCLK", "4": "IMU_INT1", "5": "1V8", "6": "QVAR1",
         "7": "GND", "8": "1V8", "11": "TDM_WCLK", "12": "1V8", "13": "I2C_SCL", "14": "I2C_SDA"},
     supply=[("8", 1.71, 3.6), ("5", 1.08, 3.6)], i2c=0x6A, nc=["9", "10"],
     note="SA0=GND -> 0x6A. CS=1V8 -> I2C mode. Confirm ST land pattern matches KiCad LGA-14 3x2.5.")

# --- U4 mic: TDK T5838 (pins from TDK DS-000383), bottom port -> board hole
part("U4", CUE, "TDK_T5838", "T5838", "TDK InvenSense T5838", {
    "1": "PDM_DIN", "2": "GND", "3": "GND", "4": "MIC_WAKE", "5": "MIC_THSEL", "6": "PDM_CLK", "7": "MIC_1V8"},
    supply=[("7", 1.62, 1.98)], note="SELECT=GND -> right channel (data after the falling clock edge). Bottom port: 0.6 mm board hole (TDK: 0.5-1.0).")

# --- U5 haptic driver: TI DRV2605L VSSOP-10 (DGS). Pin order from TI datasheet.
part("U5", CUE, "VSSOP-10_3x3mm_P0.5mm", "DRV2605L", "TI DRV2605LDGSR", {
    "1": "U5_REG", "2": "I2C_SCL", "3": "I2C_SDA", "4": "HAPTIC_TRIG", "5": "HAPTIC_EN",
    "6": "VBAT", "7": "LRA_P", "8": "GND", "9": "LRA_N", "10": "VBAT"},
    supply=[("10", 2.0, 5.2)], i2c=0x5A,
    note="I2C 0x5A, 1.8 V logic thresholds (VIH 1.3 V min). EN high before register writes. "
          "Supplied from VBAT (3.0-4.2 V): VSYS can approach VBUS while charging, above the 5.2 V max.")

# --- Connectors
part("J1", FP + "Connector_USB.pretty", "USB_C_Receptacle_GCT_USB4125-xx-x_6P_TopMnt_Horizontal", "USB-C (power)",
     "GCT USB4125-GF-A", {"A9": "VBUS", "B9": "VBUS", "A12": "GND", "B12": "GND", "A5": "CC1", "B5": "CC2", "S1": "GND"},
     note="Charge-only USB-C. CC pull-downs (Rd) are inside the nPM1300.")
part("J2", CUE, "JST_PH_S2B-PH-SM4-TB_1x02-1MP_P2.00mm_Horizontal", "BATT",
     "JST S2B-PH-SM4-TB", {"1": "VBAT", "2": "GND"}, nc=["MP"],
     note="JST-PH to fit the Adafruit #1570 100 mAh LiPo (built-in protection). Check polarity: pin 1 = +.")
part("J3", FP + "Connector_JST.pretty", "JST_SH_SM02B-SRSS-TB_1x02-1MP_P1.00mm_Horizontal", "LRA",
     "JST SM02B-SRSS-TB", {"1": "LRA_P", "2": "LRA_N"}, nc=["MP"], note="Coin LRA on a pigtail (Vybronics VG0832013D).")
part("J4", FP + "Connector_PinHeader_1.27mm.pretty", "PinHeader_2x05_P1.27mm_Vertical_SMD", "SWD",
     "2x5 1.27 mm SMD header", {"1": "1V8", "2": "SWDIO", "3": "GND", "4": "SWDCLK", "5": "GND", "9": "GND", "10": "nRESET"},
     nc=["6", "7", "8"], note="ARM Cortex 10-pin debug pinout. VTref = 1V8.")
part("J5", FP + "Connector_PinHeader_2.54mm.pretty", "PinHeader_2x05_P2.54mm_Vertical", "EXP",
     "2x5 2.54 mm header", {"1": "VSYS", "2": "GND", "3": "1V8", "4": "3V0", "5": "I2C_SDA", "6": "I2C_SCL",
                             "7": "PDM_CLK", "8": "PDM_DIN", "9": "EXP_P0_01"}, nc=["10"],
     note="Expansion: V2S200D eval (PDM left channel), IQS227 eval (3V0), scope probing.")

# --- Protection, passives
part("D1", FP + "Diode_SMD.pretty", "D_SOD-523", "TVS 5V", "onsemi ESD5Z5.0T1G", {"1": "VBUS", "2": "GND"},
     note="Pad 1 = cathode to VBUS.")
part("L1", FP + "Inductor_SMD.pretty", "L_0805_2012Metric", "2.2uH", "Murata DFE201210U-2R2M=P2", {"1": "SW1", "2": "1V8"},
     note="BUCK1. Nordic ref: 2.2 uH, DCR < 400 mOhm. Confirm Murata land pattern vs 0805.")
part("L2", FP + "Inductor_SMD.pretty", "L_0805_2012Metric", "2.2uH", "Murata DFE201210U-2R2M=P2", {"1": "SW2", "2": "3V0"},
     note="BUCK2.")

C0402, C0603, R0402 = (FP + "Capacitor_SMD.pretty", "C_0402_1005Metric"), (FP + "Capacitor_SMD.pretty", "C_0603_1608Metric"), \
    (FP + "Resistor_SMD.pretty", "R_0402_1005Metric")


def cap(ref, val, net, pkg=C0402, note=""):
    part(ref, pkg[0], pkg[1], val, "X5R/X7R ceramic, >=10 V", {"1": net, "2": "GND"}, note=note)


cap("C1", "1uF", "VBUS"); cap("C2", "10uF", "VBUS", C0603)
cap("C3", "2.2uF", "VBAT", C0603, note="nPM1300 ref C6")
cap("C4", "1uF", "VSYS")
cap("C5", "10uF", "VSYS", C0603, note="PVDD, nPM1300 ref C2 (PVSS1 side)")
cap("C20", "10uF", "VSYS", C0603, note="nPM1300 ref C3 (PVSS2 side)")
cap("C21", "10uF", "VSYS", C0603, note="nPM1300 ref C4")
cap("C22", "100nF", "1V8", note="nPM1300 VDDIO pin 12, ref C13")
cap("C6", "10uF", "1V8", C0603); cap("C18", "10uF", "1V8", C0603)
cap("C7", "10uF", "3V0", C0603)
cap("C8", "100nF", "1V8", note="U3 VDD"); cap("C9", "100nF", "1V8", note="U3 VDD_IO")
cap("C10", "100nF", "MIC_1V8", note="U4 VDD, X7R, closest part to pin 7")
cap("C19", "1uF", "MIC_1V8", note="Load switch 1 output")
cap("C11", "1uF", "VBAT", note="U5 VDD"); cap("C12", "1uF", "U5_REG", note="U5 REG")
cap("C16", "4.7uF", "1V8", note="U1 VDD bulk")
cap("C17", "1uF", "VBUSOUT", note="nPM1300 VBUSOUT must be decoupled")


def res(ref, val, a, b, note=""):
    part(ref, R0402[0], R0402[1], val, "1% thick film", {"1": a, "2": b}, note=note)


res("R1", "4.7k", "I2C_SDA", "1V8"); res("R2", "4.7k", "I2C_SCL", "1V8")
res("R3", "47k", "VSET1", "GND", note="VSET1 per Nordic reference circuit (BUCK1 1.8 V) - confirm in PS table")
res("R4", "150k", "VSET2", "GND", note="VSET2 per Nordic reference circuit (BUCK2 3.0 V) - confirm in PS table")
part("RT1", R0402[0], R0402[1], "10k NTC", "Murata NCP15XH103F03RC", {"1": "NTC", "2": "GND"},
     note="10k 1% B25/50 3380 K (nPM1300 PS Table 11). Next to U2: with the cell on a lead it senses board temperature.")
res("R6", "0R", "QVAR1", "TOUCH_E", note="Qvar series element, value TBC with ST guidance")
note7 = "Ezurio Note 7: >=330 R series on P1.09-P1.12; place at U1 pad"
res("R7", "330R", "U1_TDM_WCLK", "TDM_WCLK", note=note7)
res("R8", "330R", "U1_PMIC_INT", "PMIC_INT", note=note7)

part("E1", CUE, "Touch_Pad_4x3mm", "TOUCH", "Copper pad (shell contact)", {"1": "TOUCH_E"},
     note="Qvar touch electrode; solder a wire to the shell or touch directly.")
part("SW1", FP + "Button_Switch_SMD.pretty", "SW_SPST_B3U-1000P", "USER", "Omron B3U-1000P",
     {"1": "BTN_USER", "2": "GND"})
part("SW2", FP + "Button_Switch_SMD.pretty", "SW_SPST_B3U-1000P", "SHIP/WAKE", "Omron B3U-1000P",
     {"1": "SHPHLD", "2": "GND"}, note="Hold to leave ship mode / power on.")

for i, n in enumerate(["VBUS", "VBAT", "VSYS", "1V8", "3V0", "MIC_1V8", "GND", "PMIC_INT", "I2C_SDA", "I2C_SCL"], start=1):
    part(f"TP{i}", FP + "TestPoint.pretty", "TestPoint_Pad_D1.0mm", f"TP {n}", "Test pad", {"1": n})
for i in range(1, 4):
    part(f"FID{i}", FP + "Fiducial.pretty", "Fiducial_0.5mm_Mask1mm", "FID", "Fiducial", {})


# --------------------------------------------------------------------------- checks
def nets():
    n = defaultdict(list)
    for ref, p in PARTS.items():
        for pad, net in p["pins"].items():
            n[net].append((ref, pad))
    return n


def check():
    problems, oks = [], []
    N = nets()
    for name, nodes in N.items():
        if len(nodes) < 2:
            problems.append(f"net {name} has a single node {nodes}")
    for ref, p in PARTS.items():
        for pad, lo_hi in [(s[0], s[1:]) for s in p["supply"]]:
            rail = p["pins"].get(pad)
            if rail not in RAILS:
                problems.append(f"{ref}.{pad} supply on non-rail net {rail}")
                continue
            lo, hi = RAILS[rail]
            vmin, vmax = lo_hi
            (problems if (lo < vmin or hi > vmax) else oks).append(
                f"{ref}.{pad} on {rail} {lo}-{hi} V vs rating {vmin}-{vmax} V")
        both = set(p["pins"]) & p["nc"]
        if both:
            problems.append(f"{ref} pads both connected and NC: {both}")
    addrs = defaultdict(list)
    for ref, p in PARTS.items():
        if p["i2c"] is not None:
            addrs[p["i2c"]].append(ref)
    for a, refs in addrs.items():
        (problems if len(refs) > 1 else oks).append(f"I2C 0x{a:02X} -> {refs}")
    # nRF54L15 port rules (U1 pad -> port.pin from Ezurio map)
    port = {"2": "P2.00", "3": "P1.08", "9": "P1.03", "6": "P2.01", "7": "P1.06", "8": "P1.07", "13": "P2.02", "15": "P1.05",
            "17": "P1.04", "18": "P1.14", "19": "P1.12", "20": "P1.13", "21": "P1.10", "22": "P1.09", "23": "P1.11",
            "35": "P0.01", "38": "P0.00"}
    # Clock pins confirmed in the nRF54L15 pin table (via Flux review, Oct 2026).
    # LRCK (TDM_WCLK) does not need a clock pin.
    clock_pins = {"P1.03", "P1.04", "P1.08", "P1.11", "P1.12"}
    note7 = {"P1.09", "P1.10", "P1.11", "P1.12"}
    u1 = PARTS["U1"]["pins"]
    for pad, net in u1.items():
        pp = port.get(pad)
        if not pp:
            continue
        if pp in note7:
            r = [ref for ref, q in PARTS.items() if q["value"] == "330R" and net in q["pins"].values()]
            if not r:
                problems.append(f"{net} on {pp}: Ezurio Note 7 needs a >=330 R series resistor")
            if net.removeprefix("U1_") in ("I2C_SDA", "I2C_SCL", "PDM_CLK", "TDM_BCLK"):
                problems.append(f"{net} on {pp}: Ezurio Note 7 pins must stay below 1 MHz and off I2C")
        net = net.removeprefix("U1_")
        if net in ("IMU_INT1", "MIC_WAKE", "PMIC_INT", "BTN_USER") and pp.startswith("P2."):
            problems.append(f"{net} on {pp}: port 2 cannot raise interrupts")
        if net in ("I2C_SCL", "PDM_CLK", "TDM_BCLK") and pp not in clock_pins:
            problems.append(f"{net} on {pp}: not a confirmed clock pin")
        if net in ("I2C_SDA", "PDM_DIN", "TDM_DIN") and not pp.startswith("P1."):
            problems.append(f"{net} on {pp}: serial data should stay on port 1")
    return problems, oks


if __name__ == "__main__":
    pr, ok = check()
    N = nets()
    print(f"parts {len(PARTS)} | nets {len(N)} | pads {sum(len(p['pins']) for p in PARTS.values())}")
    for o in ok:
        print("  OK ", o)
    print("PROBLEMS:", len(pr))
    for p in pr:
        print("  !!", p)
    raise SystemExit(1 if pr else 0)


# --------------------------------------------------------------------------- sourcing (JLCPCB assembly)
# ref -> (manufacturer part number, LCSC number or "" if JLCPCB has none, note).
# C-numbers checked on lcsc.com / jlcpcb.com on 2026-10-05.
SOURCING = {}
for refs, mpn, lcsc, note in [
    ("C1 C4 C19 C11 C12 C17", "Samsung CL05A105KA5NQNC (1uF 25V X5R 0402)", "C52923", "Basic"),
    ("C16", "Samsung CL05A475MP5NRNC (4.7uF 10V X5R 0402)", "C23733", "Basic"),
    ("C2 C5 C20 C21 C6 C18 C7", "Samsung CL10A106MA8NRNC (10uF 25V X5R 0603)", "C96446", "Basic"),
    ("C22 C8 C9 C10", "Samsung CL05B104KO5NNNC (100nF 16V X7R 0402)", "C1525", "Basic"),
    ("C3", "Samsung CL10A225KO8NNNC (2.2uF 16V X5R 0603)", "C23630", "Basic"),
    ("D1", "onsemi ESD5Z5.0T1G", "C82044", "Extended"),
    ("J1", "GCT USB4125-GF-A", "C3151650", "Extended; low stock"),
    ("J2", "JST S2B-PH-SM4-TB(LF)(SN)", "C295747", "Extended"),
    ("J3", "JST SM02B-SRSS-TB(LF)(SN)", "C160402", "Extended"),
    ("J4", "Samtec FTSH-105-01-L-DV-K-P-TR", "C2932107", "Extended; check land pattern"),
    ("J5", "XFCN PZ254V-12-10P", "C492422", "Extended; through-hole"),
    ("L1 L2", "Murata DFE201210U-2R2M=P2", "C2049745", "Extended"),
    ("R1 R2", "UniOhm 0402WGF4701TCE", "C25900", "Basic"),
    ("R3", "UniOhm 0402WGF4702TCE", "C25792", "Basic"),
    ("R4", "UniOhm 0402WGF1503TCE", "C25755", "Extended"),
    ("R6", "UniOhm 0402WGF0000TCE", "C17168", "Basic"),
    ("R7 R8", "UniOhm 0402WGF3300TCE", "C25104", "Basic"),
    ("RT1", "Murata NCP15XH103F03RC", "C77131", "Extended"),
    ("SW1 SW2", "Omron B3U-1000P", "C231329", "Extended"),
    ("U1", "Ezurio 453-00223", "", "Not on LCSC: JLCPCB global sourcing or consign"),
    ("U2", "Nordic NPM1300-QEAA-R", "C7466043", "Listed, out of stock: pre-order / global sourcing"),
    ("U3", "ST LSM6DSV16BXTR", "C5381401", "Listed, 0 stock: pre-order / global sourcing"),
    ("U4", "TDK MMICT5838-00-012", "C7230692", "Extended"),
    ("U5", "TI DRV2605LDGSR", "C527464", "Extended"),
]:
    for r in refs.split():
        SOURCING[r] = (mpn, lcsc, note)
