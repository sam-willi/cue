# Cue tap device (MVP stand-in for the cuff)

A thumbnail-sized Bluetooth board and a vibration motor, worn at the collar or ear. When the Cue web app detects a filler
or rushing, it sends the rhythm over Bluetooth and the motor taps silently. A vibration motor, not a buzzer: a buzzer
beeps loud enough for others to hear, which breaks the private-cue idea.

This is for the demo, not the product. The cuff electronics live on the `hardware-rev0` branch.

## Parts

Order with next-day delivery. Buy the board with **pre-soldered pins** so nothing needs soldering.

| Part                                                     | What to look for                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Seeed Studio XIAO nRF52840 (or nRF52840 Sense)           | "pre-soldered" headers; USB-C                                                |
| Vibration motor module, 3 pins (VCC, GND, IN or SIG)     | Sold for Arduino, coin motor on a small board with its own driver transistor |
| 3 female-to-female jumper wires                          | 10 cm                                                                        |
| USB-C cable + small power bank, or a 3.7 V LiPo with JST | Power bank is simplest; a LiPo solders to the XIAO's battery pads            |
| Android phone with Chrome, or a laptop with Chrome       | Web Bluetooth is not available on iPhone                                     |

Optional: a DJI Mic Mini (mobile receiver) clipped at the collar as the microphone. It keeps your voice dominant, so the
"only coach my voice" setting works better than with the phone's own mic.

## Wiring

| Motor module | XIAO |
| ------------ | ---- |
| VCC          | 3V3  |
| GND          | GND  |
| IN / SIG     | D0   |

## Flash the firmware

1. Install the Arduino IDE.
2. **Boards Manager**: add Seeed's board URL
   `https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json`, then install **Seeed nRF52 mbed-enabled
   Boards**.
3. **Library Manager**: install **ArduinoBLE**.
4. Open `cue_tap/cue_tap.ino`, select **Seeed XIAO BLE - nRF52840**, plug in the board and click Upload. If upload
   fails, double-tap the board's reset button and try again.

On power-up the motor gives two short buzzes. The board's LED lights while the app is connected.

## Use it

1. Run the app (`npm run dev`, see the main README) and open it in Chrome.
2. **Settings, How Cue taps, Connect tap device**: pick "Cue Tap" from the browser's list.
3. **Test tap** should buzz once. Then **Start listening** and talk.

Each cue plays the same rhythm the phone would: one tap for a filler, two taps for speaking fast, a long pulse for
speaking quietly. The cuff-control "ramps" are approximations; a plain coin motor can't swell smoothly the way the
cuff's DRV2605L driver will.

## Notes

- Protocol: one write to characteristic `7a0b0002-…` = one rhythm. Bytes alternate on, off, on, … in 10 ms units (up
  to 20 bytes). Service `7a0b0001-6c75-4e43-8a2c-43554554a501`. See `src/lib/cue/tapDevice.ts`.
- Not yet tested on hardware. The firmware hasn't been compiled here; flash it as soon as the parts arrive so there's
  time to fix anything before the demo.
