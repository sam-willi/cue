# Cue rev A dev board

A 38 × 28 mm, 4-layer board (signal / GND / 1V8 / signal) with the cuff circuits plus bench conveniences: USB-C
charging, JST-PH battery and JST-SH motor connectors, SWD debug and an expansion header for the V2S200D eval board.
P1.12 (the old J5 pin 10 spare) is left unconnected per Ezurio Note 7.

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

Not stocked at LCSC (checked 2026-10-05), so use JLCPCB **global sourcing** or buy them and send them in (consigned parts):

| Ref | Part | Where |
| --- | --- | --- |
| U1 | Ezurio BL54L15µ 453-00223 (radio module) | Not on LCSC; Digi-Key / Mouser / Ezurio |
| U2 | Nordic nPM1300-QEAA-R (power) | LCSC C7466043, out of stock |


Everything else has an LCSC number in `fab/bom.csv` (from `devboard_circuit.SOURCING`). The LSM6DSV16BX is in stock
under its second LCSC listing, C5267394 (the older C5381401 listing is dead).

LCSC-stocked alternatives, if you want everything sourced through JLCPCB (each needs a redesign):

| Instead of | Alternative | LCSC | What changes |
| --- | --- | --- | --- |
| BL54L15µ module | u-blox BMD-340 (nRF52840) | C5456944 (19 in stock) | New footprint and pin map, nRF52 firmware port, more current. No nRF54L15 module is stocked at LCSC. |
| nPM1300 | TI BQ25180 charger + TPS62840 1.8 V buck + TPS7A0230 3.0 V LDO | C3682423, C2071859, C3747031 | Three chips instead of one; new power section. |

## Design notes

- **Radio module** (BL54L15µ, Ezurio datasheet 2026, p.25): footprint from the recommended land pattern. Module on
  the top edge, centred, so there is ≥ 15 mm of board edge each side; inset 0.1 mm for copper-to-edge clearance.
  3.0 × 5.0 mm antenna keep-out on all layers out to the edge.
- **Ezurio Note 7**: P1.09–P1.12 toggle below 1 MHz behind ≥ 330 Ω. Only slow signals use them, through R7–R8 at the
  module pads; fast clocks are on clock pins P1.03 (PDM), P1.08 (TDM BCLK), P1.04 (I2C SCL).
- **nPM1300** matches Nordic's PS v1.2.1 Configuration 1: VSET1 47k = 1.8 V, VSET2 150k = 3.0 V, 3 × 10 µF on VSYS,
  100 nF on VDDIO, 10k B3380 thermistor RT1 on NTC, unused LOADSW2 tied to GND.
- **Mic safety**: the T5838 (1.98 V max) is behind load switch 1, which is off at reset.

- **Regulator layout** (nPM1300 PS 9.3.4 / Fig. 62–65): SW1/SW2 run 2.5 mm at 0.3 mm straight to L1/L2 with no vias,
  PVDD cap C5 1.5 mm from pin 4, output caps at the inductor outputs, 3 × 3 vias in the exposed pad. Other power
  traces are widened to 0.2–0.4 mm where clearance allows; keep the charge current at or below ~200 mA.

## Review (2026-10-05)

Every footprint and pin map was checked against the manufacturer's drawing (BL54L15µ, nPM1300, T5838 from the PDFs;
LSM6DSV16BX, DRV2605L, USB4125, FTSH-105, JST PH/SH, DFE201210U, B3U-1000P, ESD5Z, NCP15 from the web): no errors.
DRC: 0 errors, 0 unconnected (2 warnings: the J2/U5 board footprints differ cosmetically from their library copies).

Firmware must:
- select the 10k NTC and a 32 mA charge current before enabling charging;
- enable LOADSW1 (mic supply) only after BUCK1 is confirmed at 1.8 V;
- keep P1.09–P1.12 below 1 MHz;
- configure the NFC pins as GPIO (UICR NFCPINS): PDM_CLK is on P1.03/NFC2;
- read the T5838 as the PDM channel sampled on the rising edge (SELECT = GND);
- enable Qvar on the LSM6DSV16BX (else tie-off is recommended) and drive/pull the TDM pins before use;
- enable pulls on inputs that can float (BTN_USER, EXP_P0_01).

Optional improvements for a rev B: T5838 paste openings 0.05 mm smaller with a vented ground ring; move C10 closer
to the mic; GCT USB4125-GF-A-0190 (longer stakes) for a 1.6 mm board; add the antenna keep-out as a footprint rule area.

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
python3 export_fab.py            # fab/
```

| File | What it does |
| --- | --- |
| `devboard_circuit.py` | Parts, pad-level nets, sourcing, electrical checks (rails, I2C, clock pins, Note 7) |
| `make_footprints.py` | `Cue.pretty`: BL54L15µ, TDK T5838, touch pad |
| `make_schematic.py` / `check_schematic.py` | Schematic generator and netlist cross-check |
| `build_board.py` | Placement, plane fan-out, Freerouting, pours, stitching, DRC |
| `export_fab.py` | Gerbers, drill, JLCPCB BOM and CPL, assembly and schematic PDFs |
| `render.py` | PNG renders of each layer |
| `make_3d.py` | Simple 3D models for the radio module and mic (`Cue.3dshapes`) |
