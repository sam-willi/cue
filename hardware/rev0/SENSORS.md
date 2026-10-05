# Rev0 sensors: where to buy

The sensor chips in the cuff design (`cue_rev0_bom.csv`). Links checked Oct 4, 2026.

| Sensor | Job in Cue | Part number | Buy |
| --- | --- | --- | --- |
| TDK T5838 air mic | Hears words (fillers, pace) | MMICT5838-00-012 | [Digi-Key](https://www.digikey.com/en/products/detail/tdk-invensense/MMICT5838-00-012/16903860) |
| ST LSM6DSV16BX motion sensor | Bone conduction, plus touch on the shell (Qvar) | LSM6DSV16BXTR | [Digi-Key](https://www.digikey.com/en/products/detail/stmicroelectronics/LSM6DSV16BXTR/16841542) |
| Knowles V2S200D voice-vibration sensor | Optional, stronger bone-conduction pickup (DNP on rev0) | V2S200D | [Digi-Key](https://www.digikey.com/en/products/detail/knowles/V2S200D/18670159) |
| Azoteq IQS227B touch sensor | Fallback only if Qvar touch fails (DNP) | IQS227B-00000000-DNR | Not stocked at Digi-Key or Mouser; skip for now |

These are tiny bottom-terminated chips: not hand-solderable and not breadboard-friendly. Order the bare chips with the
assembled PCB.

## Eval boards for testing before the PCB

- T5838: [EV-T5838-FX2](https://www.digikey.com/en/products/detail/tdk-invensense/EV-T5838-FX2/16903856)
- LSM6DSV16BX: [STEVAL-MKI241KA adapter kit](https://www.mouser.com/new/stmicroelectronics/stm-steval-mki241ka-kit/)
- V2S200D: [KAS-700-0177](https://www.digikey.com/en/products/detail/syntiant/KAS-700-0177/18670178)

The off-the-shelf parts for the bone-conduction test kit (with buy links) are in [`../kit/README.md`](../kit/README.md).
