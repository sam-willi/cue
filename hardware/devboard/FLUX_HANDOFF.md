# Flux handoff: approved decisions for the Cue rev A dev board

Paste this into a new Flux project or account to restore context. Source of truth for the circuit is
`devboard_circuit.py` in this folder; this file records decisions agreed with Flux's review (Oct 4–5, 2026).
Attach the Ezurio BL54L15µ datasheet (ezurio.com, free login, must list 453-00223) and the Nordic nPM1300 Product
Specification.

```
Context handoff. These decisions were already reviewed and approved in a previous Flux
project. Treat them as settled unless a datasheet contradicts one; if it does, report it
rather than changing it.

SCOPE
- This is the rev A DEV BOARD (~32 x 22 mm, 4-layer), not the final cuff.
- Battery on THIS board: Adafruit #1570, 3.7 V 100 mAh LiPo with BUILT-IN protection
  circuit, JST-PH 2.0 mm plug. J2 = JST-PH S2B-PH-SM4-TB, pin 1 VBAT (+), pin 2 GND,
  polarity silkscreen. No external protection circuit on this board.
- The VARTA CP1254 coin cell is for the later production cuff only. Record "external
  protection required" as a cuff requirement; don't add it here.
- Battery safety on this board: charging stays disabled until firmware enables it;
  charge current 32 mA (nPM1300 minimum, about 0.3C); 10 kΩ NTC next to J2 on the
  nPM1300 NTC pin; series 0 Ω jumper or 2-pin header in VBAT for current measurement.

RADIO MODULE: Ezurio BL54L15µ 453-00223 (chip antenna)
- On the board edge. Antenna keep-out on ALL layers: inner planes (In1 GND, In2 power)
  are solid everywhere except the keep-out. GND stitching vias ≤2 mm pitch around it.
- Ezurio Note 7: P1.09–P1.12 must toggle below 1 MHz with ≥330 Ω series resistance.
  Approved pin map (clock pins confirmed: P1.03, P1.04, P1.08, P1.11, P1.12):
    pad 9  P1.03  PDM_CLK     (clock pin)
    pad 3  P1.08  TDM_BCLK    (clock pin, I2S SCK)
    pad 17 P1.04  I2C_SCL     (clock pin)
    pad 20 P1.13  I2C_SDA
    pad 23 P1.11  TDM_WCLK    via 330 Ω (I2S LRCK, 8–48 kHz)
    pad 21 P1.10  PMIC_INT    via 330 Ω
    pad 19 P1.12  no connect (spare dropped; Note 7: leave unused pins open)
    pad 22 P1.09  no connect
    pad 18 P1.14  PDM_DIN | pad 7 P1.06 TDM_DIN | pad 8 P1.07 IMU_INT1
    pad 15 P1.05  MIC_WAKE | pad 2 P2.00 HAPTIC_EN | pad 6 P2.01 HAPTIC_TRIG
    pad 13 P2.02  MIC_THSEL | pad 38 P0.00 BTN_USER | pad 35 P0.01 EXP (J5 pin 9)
    pad 5 1V8 | pads 25 SWDCLK, 27 SWDIO, 32 nRESET
    GND: 4, 14, 24, 28, 31, 34, 36, 39, G1–G6
    NC: 1, 10, 11, 12, 16, 22, 26, 29, 30, 33, 37, 40–45
  Put the 330 Ω resistors right at the module pads.

I2C (1.8 V): 400 kHz, 4.7k pull-ups to 1V8 in 0402 (swappable), no series resistors.
  Test points on SDA and SCL. DRV2605L margin is 100 mV guaranteed. nPM1300 has
  documented 400 kHz compatibility; its numeric margin is unresolved, to be checked
  on the bench. Firmware falls back to 100 kHz if needed.
  Addresses: DRV2605L 0x5A, LSM6DSV16BX 0x6A (SA0 = GND), nPM1300 0x6B.

PMIC: Nordic nPM1300 QFN-32
  1 1V8 | 2 GND | 3 SW1 | 4 VSYS | 5 SW2 | 6 GND | 7 PMIC_INT | 12 1V8 | 13 SDA | 14 SCL
  15 SHPHLD | 16 VSET2 | 17 VSET1 | 19 VBAT | 20 VSYS | 21 VBUS | 22 VBUSOUT | 23 CC1
  24 CC2 | 28 1V8 (LSIN1) | 29 MIC_1V8 (LSOUT1) | 32 3V0 | 33 GND (EP)
  VSET1 47k (BUCK1 1.8 V), VSET2 150k (BUCK2 3.0 V), 2.2 µH on SW1/SW2, 1 µF on VBUSOUT.
  CC1/CC2 direct to USB-C (internal Rd). Load switch 1 is off at reset, so the
  T5838 (1.98 V max) stays unpowered until firmware confirms BUCK1 = 1.8 V.

SENSORS
- T5838 mic on MIC_1V8, PDM right channel (SELECT = GND), bottom port with a 0.8 mm hole.
- LSM6DSV16BX ON BOARD: primary bone-conduction (TDM to I2S) and Qvar touch.
  1, 7 GND | 2 TDM_DIN | 3 TDM_BCLK | 4 IMU_INT1 | 5, 8, 12 1V8 | 6 QVAR1 -> touch pad
  11 TDM_WCLK | 13 SCL | 14 SDA | 9, 10 NC
- V2S200D NOT on board: its eval board plugs into J5 on jumper wires
  (VDD J5-3 1V8, GND J5-2, CLK J5-7 PDM_CLK, DATA J5-8 PDM_DIN), left PDM channel
  set by its SEL pin.
- DRV2605L on VBAT, LRA on J3 (JST-SH), EN high before register writes.

HEADERS
- J5 EXP 2x5 2.54 mm: 1 VSYS, 2 GND, 3 1V8, 4 3V0, 5 SDA, 6 SCL, 7 PDM_CLK, 8 PDM_DIN,
  9 P0.01, 10 no connect.
- J4 SWD 2x5 1.27 mm: 1 1V8, 2 SWDIO, 3 GND, 4 SWDCLK, 5 GND, 9 GND, 10 nRESET.

STILL OPEN: BUCK1 start-up voltage with VSET1 = 47k (confirm in the PS table),
nPM1300 TWI DC limits, and the shared PDM bus (T5838 right + external V2S200D left).
```
