# Cue rev A dev board

A 33 × 21 mm, 4-layer board (signal / GND / 1V8 / signal) with the cuff circuits plus bench conveniences: USB-C
charging, JST-PH battery and JST-SH motor connectors, SWD debug and back-side test pads (TP1–TP13) for probing.

**Radio module: Ezurio BL54L15 453-00044** (14 × 10 mm, MHF4 antenna connector). The cuff's BL54L15µ (453-00223) is
out of stock everywhere until about Dec 2026, so the dev board uses its bigger sibling. Same nRF54L15 chip and the
same port pins as the cuff, so firmware is identical. It needs a plug-in 2.4 GHz antenna (see below).

**Status: ready to order (2026-10-08).** Big A re-laid the board out at 33 × 21 mm (from 42 × 32). Checked: DRC 0
unconnected / 0 schematic-parity issues / no copper clearance, short or hole errors (nothing under the 0.127 mm rule);
schematic = `devboard_circuit.py` = PCB pad for pad; every pin map and footprint checked against the manufacturers'
datasheets. Remaining DRC warnings are accepted: courtyard overlaps, small silkscreen text, single-spoke thermals, J2
mounting pads 0.2 mm from the edge. The schematic and PCB are now hand-edited in KiCad 10: `make_schematic.py` and
`build_board.py` reproduce the older 42 × 32 board only.

Changes in the 33 × 21 board:

- J5 expansion header removed; PDM_CLK, PDM_DIN and EXP_P0_01 moved to test pads TP11–TP13 (back side).
- BUCK2 removed (the 3.0 V rail only fed J5): L2, C7, R4, TP5 gone; SW2 open, VSET2 to GND (off at start-up),
  VOUT2 to VSYS, per nPM1300 PS Configuration 2 (Fig. 57).
- U3 pin 9 (AH2/QVAR2) tied to GND: ST DS13771 Table 2 says never leave it floating.
- J1 shield pads are "SH" (KiCad 10 footprint) and on GND. Fiducials removed (JLCPCB adds them on the edge rails).

Open before or at order:

- J4: Arm's keyed 10-pin cable needs position 7 empty. Order FTSH-105-01-L-DV-**007**-K (check -P-TR availability)
  or pull pin 7.
- Radio keep-out: a 1V8 via at (71.8, 93.3) and the end of PMIC_INT (B.Cu, ~0.8 mm) sit under the BL54L15's RF end.
  Low risk with the MHF4 module (ground pour is allowed there); move them on the next spin.
- C2 (extra 10 µF on VBUS, 11 µF total vs the USB 10 µF limit) and C4 (extra 1 µF on VSYS) are not in Nordic's
  reference; both are optional.
- R6 is 0 Ω; ST's Qvar example uses ~500 Ω per electrode. Confirm against AN5755.

## Open it

Install KiCad (free, kicad.org) and open `cue_devboard.kicad_pro`. The schematic is `cue_devboard.kicad_sch`; the
board is `cue_devboard.kicad_pcb`. A PDF of the schematic is in `fab/schematic.pdf`.

## Order it (JLCPCB)

| File                           | Upload as                         |
| ------------------------------ | --------------------------------- |
| `fab/cue_devboard_gerbers.zip` | Gerber files (4 layers, 1.6 mm)   |
| `fab/bom.csv`                  | BOM (has an `LCSC Part #` column) |
| `fab/cpl.csv`                  | CPL / pick-and-place              |

Not stocked at LCSC (checked 2026-10-05), so use JLCPCB **global sourcing** or buy them and send them in (consigned parts). Standard PCBA is needed.

| Ref      | Part                                               | Where                                                                                                                                                                                      |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| U1       | Ezurio BL54L15 **453-00044C** (radio module, MHF4) | **Not assembled by JLCPCB** (left out of `bom.csv` / `cpl.csv`). Buy from Newark (184 in stock, ~US$4, 2026-10-05) and hand-solder; see below                                              |
| U2       | Nordic nPM1300-QEAA-R (power)                      | LCSC C7466043 (check stock)                                                                                                                                                                |
| SW1, SW2 | Omron B3U-1000P buttons                            | Out of stock at LCSC: left out of `bom.csv` / `cpl.csv`; hand-solder                                                                                                                       |
| J1       | GCT USB4125-GF-A-0190 (USB-C)                      | C5246813 showed 0 stock in the JLCPCB BOM check (2026-10-05): search "USB4125" and pick any in-stock USB4125-GF-A variant (same footprint), or untick it and hand-solder one from Digi-Key |

**Hand-soldering U1:** the module has castellated pads on three edges only (none underneath), 0.75 mm pitch.
JLCPCB's stencil still pastes the U1 pads, so they arrive pre-tinned; if the module rocks, flatten them with wick. Align
the module with the silk outline (MHF4 connector at the top edge, next to the pin-1 dot), tack two opposite corners,
check alignment, then solder every pad with flux and a fine tip (or hot air). Check for bridges with a meter: VDD_nRF
(pad 26) to GND must not be shorted. Click the antenna on before powering the radio.

**JLCPCB BOM check (2026-10-05):** 22 of 23 BOM lines matched the intended LCSC numbers. U1 is now left out of the
JLCPCB order entirely (global sourcing added 10–15 business days; buying from Newark and hand-soldering is faster). The PCBA quantity sets how many
boards get populated (2 is enough for a first spin).

Also buy one **2.4 GHz antenna with an MHF4 plug** per board and click it onto the module (not assembled by JLCPCB).
Ezurio's approved list: mFlexPIFA **EFA2400A3S-10MH4L** (stick-on flex, recommended), FlexPIFA 001-0022, NanoBlue
EBL2400A1-10MH4L. Don't power the radio on without an antenna.

In JLCPCB's placement preview, check the rotation of U1, U4, J1, J2 and J3 (`fab/placement_check.png` shows the
right answer): U1's MHF4 connector in the module's top-right corner at the board's top edge, next to the pin-1 dot;
U4's port over the sound hole. Choose "edge rails added by JLCPCB" (connectors and the module sit at the board edges).

**Battery polarity:** J2 pin 1 is + (silk "+"). JST-PH battery leads are not standardised, so meter the cell's plug
before connecting: red (+) must land on the "+" pin.

Everything else has an LCSC number in `fab/bom.csv` (from `devboard_circuit.SOURCING`). The LSM6DSV16BX is in stock
under its second LCSC listing, C5267394 (the older C5381401 listing is dead).

LCSC-stocked alternatives, if you want everything sourced through JLCPCB (each needs a redesign):

| Instead of     | Alternative                                                    | LCSC                         | What changes                                                                                         |
| -------------- | -------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| BL54L15 module | u-blox BMD-340 (nRF52840)                                      | C5456944 (19 in stock)       | New footprint and pin map, nRF52 firmware port, more current. No nRF54L15 module is stocked at LCSC. |
| nPM1300        | TI BQ25180 charger + TPS62840 1.8 V buck + TPS7A0230 3.0 V LDO | C3682423, C2071859, C3747031 | Three chips instead of one; new power section.                                                       |

## Design notes

- **Radio module** (BL54L15 453-00044, Ezurio BL54L10/BL54L15 datasheet): footprint from the host PCB land pattern
  (39 pads, 0.45 × 0.60 mm, 0.75 mm pitch). Module centred on the top edge with its RF / MHF4 end at the edge, inset
  0.1 mm for copper-to-edge clearance. No tracks or vias under the RF end (5 × 8.5 mm); ground pour is allowed, since
  this variant has no on-board antenna.
- **Pin map** (same nRF54L15 pins as the cuff): PDM_CLK P1.03 (pad 14), I2C_SCL P1.04 (23), TDM_BCLK P1.08 (30),
  I2C_SDA P1.13 (33), PDM_DIN P1.14 (32), TDM_DIN P1.06 (21), IMU_INT1 P1.07 (20), MIC_WAKE P1.05 (22),
  TDM_WCLK P1.11 (35, via R7), PMIC_INT P1.10 (28, via R8), MIC_THSEL P2.02 (8), HAPTIC_EN P2.00 (9),
  HAPTIC_TRIG P2.01 (10), BTN_USER P0.00 (17), EXP_P0_01 P0.01 (18). Clock signals are on pins the datasheet marks as
  clock pins.
- **R7, R8 (330 Ω)**: the cuff's BL54L15µ Note 7 needs them on P1.09–P1.12; the BL54L15 doesn't, but they stay so
  both boards behave the same.
- **nPM1300**: BUCK1 and the VSYS caps follow Nordic's PS v1.2.1 Configuration 1 (VSET1 47k = 1.8 V, 3 × 10 µF on
  VSYS); BUCK2 and LOADSW2 are unused and tied off per Configuration 2. 100 nF on VDDIO, 10k B3380 thermistor RT1 on NTC.
- **Mic safety**: the T5838 (1.98 V max) is behind load switch 1, which is off at reset.

- **Regulator layout** (nPM1300 PS 9.3.4 / Fig. 62–65): SW1/SW2 run 2.5 mm at 0.3 mm straight to L1/L2 with no vias,
  PVDD cap C5 1.5 mm from pin 4, output caps at the inductor outputs, 3 × 3 vias in the exposed pad. Other power
  traces are widened to 0.2–0.4 mm where clearance allows; keep the charge current at or below ~200 mA.

## Review (2026-10-05, second pass after the module change)

An independent review of the re-routed board found one must-check (battery polarity, now marked "+" / "-") and these,
all fixed: motor (LRA) lines ran beside PDM_CLK under the mic (J3 moved; now 2.1 mm away and 5 mm from the sound hole);
U2 exposed-pad vias sat inside the paste openings (now 4 vias in the gaps between them); vias touching the RT1, C6 and
C8 pads (moved off: `via_off_pads.py`); silkscreen below JLCPCB's 1.0 mm / 0.15 mm minimum (all text now 1.0 mm, test
points labelled on the bottom, button labels on top); L1 output now joins C6 directly on the top layer. U3 pin 7 (GND)
was isolated on one routing pass; it is now tied to C9's ground. Left as-is (fine at these currents): some
VSYS / VBAT / VBUS segments are 0.127 mm where the router had no room.

Checked against Ezurio's own CAD footprint (BL54L10/BL54L15 PCB footprint rev 4.0, May 2026: DXF, Altium PcbLib and
PDF): all 39 pads match in number, position and size (largest difference 0.003 mm, the left column at x = 0.503 vs
0.50 mm). Ezurio's files are not committed (their licence prohibits redistribution).

## Review (2026-10-05, first pass)

Every footprint and pin map was checked against the manufacturer's drawing (nPM1300, T5838 from the PDFs;
LSM6DSV16BX, DRV2605L, USB4125, FTSH-105, JST PH/SH, DFE201210U, B3U-1000P, ESD5Z, NCP15 from the web): no errors.
The BL54L15 footprint, pin map and placement were re-checked by a second reviewer against the Ezurio datasheet: no
errors. DRC: 0 violations, 0 unconnected; board = circuit pad for pad (56 parts).

Firmware must:

- select the 10k NTC and a 32 mA charge current before enabling charging;
- enable LOADSW1 (mic supply) only after BUCK1 is confirmed at 1.8 V;
- keep P1.09–P1.12 below 1 MHz (cuff rule; harmless here);
- configure the NFC pins as GPIO (UICR NFCPINS): PDM_CLK is on P1.03/NFC2;
- read the T5838 as the PDM channel sampled on the rising edge (SELECT = GND);
- enable Qvar on the LSM6DSV16BX (else tie-off is recommended) and drive/pull the TDM pins before use;
- enable pulls on inputs that can float (BTN_USER, EXP_P0_01).

Optional improvements for a rev B: T5838 paste openings 0.05 mm smaller with a vented ground ring; move C10 closer
to the mic; add the RF-end rule area to the footprint; move back to the BL54L15µ once it is in stock.

## Rebuild

`export_fab.py` regenerates `fab/` from the committed board with KiCad 10's `kicad-cli` (put it on `PATH`; on macOS
it is in `/Applications/KiCad/KiCad.app/Contents/MacOS`). The scripted build below produced the earlier 42 × 32 board.

Needs KiCad 7, Java, `xvfb-run`, and Freerouting 1.9 at `tools/freerouting-1.9.0.jar` (or `FREEROUTING=`).

```bash
export KICAD7_FOOTPRINT_DIR=/usr/share/kicad/footprints
python3 devboard_circuit.py      # electrical checks
python3 make_3d.py               # Cue.3dshapes (simple 3D models)
python3 make_footprints.py       # Cue.pretty footprints
python3 make_schematic.py        # cue_devboard.kicad_sch
kicad-cli sch export netlist --format kicadsexpr -o sch.net cue_devboard.kicad_sch
python3 check_schematic.py sch.net   # schematic == circuit, pad for pad
python3 build_board.py           # place, autoroute, pour, DRC (~10 min)
python3 via_off_pads.py          # move any via that touches an SMD pad
python3 export_fab.py            # fab/
```

| File                                       | What it does                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `devboard_circuit.py`                      | Parts, pad-level nets, sourcing, electrical checks (rails, I2C, clock pins, Note 7) |
| `make_footprints.py`                       | `Cue.pretty`: BL54L15 (dev board), BL54L15µ (cuff), TDK T5838, touch pad            |
| `make_schematic.py` / `check_schematic.py` | Schematic generator and netlist cross-check                                         |
| `build_board.py`                           | Placement, plane fan-out, Freerouting, pours, stitching, DRC                        |
| `export_fab.py`                            | Gerbers, drill, JLCPCB BOM and CPL, assembly and schematic PDFs                     |
| `via_off_pads.py`                          | Nudges vias off SMD pads after routing                                              |

The committed `cue_devboard.kicad_pcb` is the source of truth for fabrication. After the scripted build it was finished
by hand: C8 moved 0.4 mm right and QVAR1 re-routed so U3 pin 7 reaches ground, the via between R4 and RT1 removed (R4's
ground goes through RT1's pad to its via), and the SHIP label set vertically beside SW2. A fresh `build_board.py` run
will not reproduce those edits exactly.
| `render.py` | PNG renders of each layer |
| `make_3d.py` | Simple 3D models for the radio modules, mic and two connectors (`Cue.3dshapes`) |
