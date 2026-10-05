# Cue rev A dev board — work in progress

**Status: not ready to order.** The radio module footprint (`Cue.pretty/Ezurio_BL54L15u_453-00223`) is a stand-in with
the right pad numbers but invented pad positions, until Ezurio's land pattern is imported. Scope may also narrow to the
bone-conduction feature only.

A ~34 × 24 mm, 4-layer (signal / GND / 1V8 / signal) board carrying the cuff circuits plus USB-C charging, JST battery
and motor connectors, SWD debug and an expansion header.

| File                  | What it does                                                                          |
| --------------------- | ------------------------------------------------------------------------------------- |
| `devboard_circuit.py` | Parts, pad-level nets and electrical checks (supply ranges, I2C addresses, pin rules) |
| `make_footprints.py`  | Writes `Cue.pretty`: TDK T5838 (from DS-000383 Fig. 34), touch pad, module stand-in   |
| `build_board.py`      | KiCad 7 board: placement, plane fan-out, Freerouting, pours, stitching, DRC           |
| `export_fab.py`       | Gerbers, drill, BOM, pick-and-place, assembly PDF                                     |
| `render.py`           | PNG renders of each layer                                                             |

Needs KiCad 7, Freerouting 1.9 (`FREEROUTING=/path/to/freerouting-1.9.0.jar`) and `xvfb-run`.

```bash
python3 devboard_circuit.py   # electrical checks
python3 make_footprints.py
python3 build_board.py        # ~5-8 min, writes cue_devboard.kicad_pcb and drc.rpt
```
