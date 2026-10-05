# Cue rev A dev board

A 42 × 32 mm, 4-layer board (signal / GND / 1V8 / signal) with the cuff circuits plus bench conveniences: USB-C
charging, JST-PH battery and JST-SH motor connectors, SWD debug and an expansion header for the V2S200D eval board.

**Radio module: Ezurio BL54L15 453-00044** (14 × 10 mm, MHF4 antenna connector). The cuff's BL54L15µ (453-00223) is
out of stock everywhere until about Dec 2026, so the dev board uses its bigger sibling. Same nRF54L15 chip and the
same port pins as the cuff, so firmware is identical. It needs a plug-in 2.4 GHz antenna (see below).

**Status: pre-manufacturing.** Schematic, layout and JLCPCB fab files are generated and checked: DRC 0 violations / 0 unconnected, schematic = circuit = PCB pad for pad. Before
ordering, open the board in KiCad and review it by eye, and confirm sourcing for the two parts LCSC doesn't stock.

## Open it

Install KiCad (free, kicad.org) and open `cue_devboard.kicad_pro`. The schematic is `cue_devboard.kicad_sch`; the
board is `cue_devboard.kicad_pcb`. A PDF of the schematic is in `fab/schematic.pdf`.

## Order it (JLCPCB)

| File | Upload as |
| --- | --- |
| `fab/cue_devboard_gerbers.zip` | Gerber files (4 layers, 1.6 mm) |
| `fab/bom.csv` | BOM (has an `LCSC Part #` column) |
| `fab/cpl.csv` | CPL / pick-and-place |

Not stocked at LCSC (checked 2026-10-05), so use JLCPCB **global sourcing** or buy them and send them in (consigned parts). Standard PCBA is needed.

| Ref | Part | Where |
| --- | --- | --- |
| U1 | Ezurio BL54L15 **453-00044C** (radio module, MHF4) | JLCPCB global sourcing: Chip1stop, 231 in stock, ~$15 (2026-10-05) |
| U2 | Nordic nPM1300-QEAA-R (power) | LCSC C7466043 (check stock) |
| SW1, SW2 | Omron B3U-1000P buttons | Out of stock at LCSC: left out of `bom.csv` / `cpl.csv`; hand-solder |

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

| Instead of | Alternative | LCSC | What changes |
| --- | --- | --- | --- |
| BL54L15 module | u-blox BMD-340 (nRF52840) | C5456944 (19 in stock) | New footprint and pin map, nRF52 firmware port, more current. No nRF54L15 module is stocked at LCSC. |
| nPM1300 | TI BQ25180 charger + TPS62840 1.8 V buck + TPS7A0230 3.0 V LDO | C3682423, C2071859, C3747031 | Three chips instead of one; new power section. |

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
- **nPM1300** matches Nordic's PS v1.2.1 Configuration 1: VSET1 47k = 1.8 V, VSET2 150k = 3.0 V, 3 × 10 µF on VSYS,
  100 nF on VDDIO, 10k B3380 thermistor RT1 on NTC, unused LOADSW2 tied to GND.
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

Not checked: Ezurio's own CAD footprint (behind a free sign-in on ezurio.com); ours is from the datasheet drawing and
was checked against it by two reviewers.

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

| File | What it does |
| --- | --- |
| `devboard_circuit.py` | Parts, pad-level nets, sourcing, electrical checks (rails, I2C, clock pins, Note 7) |
| `make_footprints.py` | `Cue.pretty`: BL54L15 (dev board), BL54L15µ (cuff), TDK T5838, touch pad |
| `make_schematic.py` / `check_schematic.py` | Schematic generator and netlist cross-check |
| `build_board.py` | Placement, plane fan-out, Freerouting, pours, stitching, DRC |
| `export_fab.py` | Gerbers, drill, JLCPCB BOM and CPL, assembly and schematic PDFs |
| `via_off_pads.py` | Nudges vias off SMD pads after routing |

The committed `cue_devboard.kicad_pcb` is the source of truth for fabrication. After the scripted build it was finished
by hand: C8 moved 0.4 mm right and QVAR1 re-routed so U3 pin 7 reaches ground, the via between R4 and RT1 removed (R4's
ground goes through RT1's pad to its via), and the SHIP label set vertically beside SW2. A fresh `build_board.py` run
will not reproduce those edits exactly.
| `render.py` | PNG renders of each layer |
| `make_3d.py` | Simple 3D models for the radio modules, mic and two connectors (`Cue.3dshapes`) |
