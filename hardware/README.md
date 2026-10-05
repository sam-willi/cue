# Cue hardware

Three stages of the same design, from what you can wire today to the finished cuff:

| Folder | What it is | Status |
| --- | --- | --- |
| [`kit/`](kit/) | Off-the-shelf parts (XIAO nRF54L15 Sense, V2S200D eval board, LRA Wireling, LiPo) wired on a breadboard to test bone conduction now. Wiring diagram and buy links. | Wiring final; firmware not written |
| [`devboard/`](devboard/) | **Rev A dev board**: a 38 × 28 mm custom PCB with the cuff's real chips plus USB-C, battery and motor connectors, debug and expansion headers. KiCad schematic, layout and JLCPCB fab files. | **Pre-manufacturing**: DRC clean, ready for a human review and ordering |
| [`rev0/`](rev0/) | The finished cuff's electronics as a checked netlist and parts list (coin cell, pogo-pin charging, no connectors). | Netlist only; not laid out |

The dev board and the cuff use the same chips and the same pin map, so firmware written for the dev board carries over.

## The chips

| Job | Part |
| --- | --- |
| Bluetooth + processor | Ezurio BL54L15µ module (Nordic nRF54L15, chip antenna, pre-certified) |
| Power: charger, 1.8 V and 3.0 V rails | Nordic nPM1300 |
| Hearing words | TDK T5838 PDM microphone |
| Bone conduction + touch | ST LSM6DSV16BX (TDM audio-band accelerometer, Qvar touch) |
| Tap | TI DRV2605L driver + LRA vibration motor |
| Optional bone-conduction comparison | Knowles V2S200D (eval board on the dev board's expansion header) |

Where to buy each sensor: [`rev0/SENSORS.md`](rev0/SENSORS.md).

## Design decisions (both boards)

- **1.8 V logic.** The T5838 mic is rated 1.62–1.98 V, so all logic shares one 1.8 V rail. The mic sits behind the
  nPM1300's load switch 1, which is off at reset, so it is only powered once firmware confirms the rail.
- **nPM1300 per Nordic's reference** (PS v1.2.1, Configuration 1): VSET1 47k = 1.8 V, VSET2 150k = 3.0 V,
  3 × 10 µF on VSYS, 100 nF on VDDIO, 10k B3380 thermistor on NTC, unused load switch 2 tied to GND.
- **Certified radio module.** The BL54L15µ includes the crystal and antenna, so there is no RF layout or certification
  work. It sits edge-centred with a 3 × 5 mm antenna keep-out on all layers (Ezurio datasheet p.25).
- **nRF54L15 pin map.** Clock signals on clock pins (P1.03 PDM, P1.08 TDM BCLK, P1.04 I2C SCL); interrupts off port 2;
  Ezurio Note 7: P1.09–P1.12 carry only slow signals (< 1 MHz) behind 330 Ω, unused ones left open.
- **I2C at 1.8 V, 400 kHz, 4.7k pull-ups**: DRV2605L `0x5A`, LSM6DSV16BX `0x6A`, nPM1300 `0x6B`.

## Still open

- **Cuff battery protection.** The VARTA CP1254 coin cell needs an external protection circuit; not in `rev0/` yet.
  (The dev board uses an Adafruit LiPo with protection built in.)
- **Sourcing.** JLCPCB doesn't stock the BL54L15µ, and its nPM1300 and LSM6DSV16BX listings show no stock: use JLCPCB
  global sourcing or consign them (see `devboard/README.md`).
- **Bench checks on the first dev boards:** I2C low level at 400 kHz (nPM1300 DC limits aren't tabulated), and the
  shared PDM bus (T5838 right channel, V2S200D left).
- **ESD diode** part for the cuff's charging pads.

## Sources

Nordic nPM1300 Product Specification v1.2.1 · Ezurio BL54L15µ datasheet (453-00223) · Nordic nRF54L15 pin assignments ·
ST AN5845 (LSM6DSV16BX) · TDK DS-000383 (T5838) · TI DRV2605L datasheet · Syntiant V2S200D · Seeed XIAO nRF54L15 wiki.
