# Cue hardware — rev 0

Production cuff electronics as a checked netlist, plus the parts list. This is a **draft for review**: nothing here has been laid out, built or measured, and items marked **TBC** still need a datasheet check (see [Still to confirm](#still-to-confirm)).

## Files

| File                            | What it is                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `rev0/cue_netlist.py`           | Single source of truth: every part, pin and net. Edit here, then rerun.        |
| `rev0/cue_rev0.net`             | KiCad netlist (s-expression). Import in the KiCad PCB editor.                  |
| `rev0/cue_rev0_bom.csv`         | Bill of materials grouped by value, with part numbers, footprints and FIT/DNP. |
| `rev0/cue_rev0_connections.csv` | Every pin of every part and the net it is on.                                  |
| `rev0/SENSORS.md`               | Where to buy each sensor chip, plus eval boards for testing.                   |
| `kit/`                          | Wiring for the off-the-shelf bone-conduction test kit (XIAO nRF54L15 Sense).   |

Regenerate and recheck:

```bash
python3 hardware/rev0/cue_netlist.py
```

The script fails loudly (`PROBLEMS: n`) on floating pins, pins on two nets, a supply outside a chip's rated range, I2C address clashes, interrupts on port 2, and serial buses off port 1.

## Current state

- **43 parts** (35 fitted, 8 DNP options), **35 nets**, **157 pins**, 18 deliberately unconnected. **0 problems.**
- Rails: 5 V from the case pogo pins → nPM1300 → VSYS (3.0–4.2 V, haptic driver), **1V8** (all logic), 3V0 (fallback touch chip only).
- I2C on 1.8 V: DRV2605L `0x5A`, LSM6DSV16BX `0x6A`, nPM1300 `0x6B`.

## Key design decisions

- **1.8 V logic.** The TDK T5838 mic only runs on 1.62–1.98 V, so all logic sits on one 1.8 V rail.
- **Certified radio module for rev A.** The Ezurio BL54L15µ (7.9 × 6.3 × 1.75 mm, FCC/CE/ISED/MIC/RCM) contains the nRF54L15, 32 MHz crystal and chip antenna. Nordic requires the RF section to copy their reference design exactly; the module removes that risk and the certification work.
- **Larger packages first.** nPM1300 in QFN32 and DRV2605L in VSSOP-10, so rev A avoids the 0.3 mm-pitch HDI board process. Shrink to chip-scale packages later.
- **Touch via Qvar.** The LSM6DSV16BX's Qvar input reads the shell as a touch electrode. The Azoteq IQS227 stays on the board as a DNP fallback.
- **nRF54L15 pin rules.** I2C, PDM and I2S live on port 1, with clocks on port 1 clock pins. Interrupt inputs stay off port 2, which cannot raise pin interrupts.

## Prototype (engineering mule) pin fix

The XIAO nRF54L15 Sense harness was corrected for the same pin rules: the sensor interrupt and bone-conduction TDM audio moved from port 2 to port 1 (D0–D3), and the touch chip moved to the back pads (D11/D12). The XIAO exposes only six port 1 pins, so the bone-conduction sensor (setup A) and the Knowles V2S / extra mic (setup B) take turns on D0–D2.

## Still to confirm

- Pad numbers for the BL54L15µ module, nPM1300, DRV2605L and V2S200D (pins are keyed by name until then).
- Which port 1 pins are clock pins (Nordic pin-assignment table).
- nPM1300 VSET1/VSET2 resistor values for 1.8 V and 3.0 V; PVDD tie to VSYS; handling of the unused CC1/CC2, NTC and load-switch pins.
- ESD diode part; whether the coin cell needs its own protection circuit; DRV2605L logic thresholds at 1.8 V.

## Sources

Nordic nPM1300 product spec and reference circuitry · Nordic nRF54L15 docs and DevZone pin guidance · Ezurio BL54L15µ datasheet · ST AN5845 (LSM6DSV16BX) · TDK DS-000383 (T5838) · TI DRV2605L datasheet · Azoteq IQS227D datasheet v1.17 · Syntiant V2S200D (Mouser) · Seeed XIAO nRF54L15 wiki.
