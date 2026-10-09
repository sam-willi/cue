# Cue wearable test mule: hardware design

Status: design agreed 2026-10-08, ready to model in Zoo. Covers the electronics (dev board v6), the enclosure, the ear
hook and retention, and what's still open. Board files: `hardware/devboard/`. Enclosure prompts: `ZOO_PROMPTS.md`
in this folder.

> **The product shape is a different design:** see [`slim/SLIM_BODY.md`](slim/SLIM_BODY.md), a slim
> hearing-aid-style body that needs a new, narrow board. This document covers only the test mule.

The test mule is a working device worn behind the right ear for real-world testing: microphone, bone conduction,
haptics and comfort. It is deliberately bigger than the final product. It's built around the current 33 × 21 mm
board, and a smaller board is the route to a final-size body.

---

## 1. How Cue is used

1. Press the **power button**. Cue gives a short **buzz** to confirm it's on. There are no lights.
2. Put it **behind the right ear**. It hangs from a swappable ear hook and rests flat on the mastoid (the bone
   behind the ear).
3. When the **wear pad** senses it's on the head, it starts listening. Take it off and it pauses.
4. The **bone-conduction sensor** confirms the wearer is the one speaking, and the **microphone** hears the words.
5. It **buzzes** when the wearer speaks too quietly, too fast, or uses too many filler words.
6. Press the **calibrate button** and read a sentence aloud to set the target speaking volume.
7. Press power again to turn it off (different buzz pattern). Charge it from a **USB-C** charger.

Differs from `CUE_CONTEXT.md` (on `main`): the docs say on/off is a long press on a touch surface. The mule uses a
physical power button plus automatic wear detection instead. Update `CUE_CONTEXT.md` if this sticks.

| Step                                 | Hardware                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Power on/off                         | SW2 "SHIP/WAKE" on the nPM1300 power chip (wakes from ship mode; firmware reads it to turn off) |
| On/off confirmation, coaching alerts | Coin LRA vibration motor on J3, driven by U5 (TI DRV2605L)                                      |
| Worn / not worn                      | E1 copper pad on the board's back, read by U3's Qvar input                                      |
| Own-voice detection                  | U3 (ST LSM6DSV16BX) accelerometer as bone-conduction sensor                                     |
| Words                                | U4 (TDK T5838) MEMS microphone, through a 0.6 mm hole in the board                              |
| Volume calibration                   | SW1 "USER" button to the radio, repurposed as CALIBRATE                                         |
| Charging                             | J1 USB-C (charge only) into the nPM1300; Adafruit #1570 LiPo on J2                              |
| Radio / app                          | U1 Ezurio BL54L15 (nRF54L15), Bluetooth to the web app                                          |

## 2. Electronics (dev board v6)

33 × 21 mm (32.9 × 20.8), 4 layers, 1.6 mm. Re-laid out by Big A from the earlier 42 × 32 mm board; merged to
`hardware-rev0` as cue_devboard 6 (#33). Order-ready fab files are in `hardware/devboard/fab/`. See
`hardware/devboard/README.md` for the full design notes and ordering steps.

- **U1** radio module (Ezurio BL54L15 453-00044, nRF54L15). Needs a plug-in 2.4 GHz antenna (MHF4). Hand-soldered.
- **U2** power chip (Nordic nPM1300).
  - BUCK1 makes 1.8 V for everything. BUCK2 is unused and tied off per the PS (Configuration 2).
  - Load switch 1 gates the mic supply. The charger is set to 32 mA; RT1 is the 10k thermistor for safe charging.
- **U3** motion sensor (ST LSM6DSV16BX): bone conduction, motion, and Qvar (wear detection through E1/R6). Pin 9
  (QVAR2) is tied to GND, as ST requires.
- **U4** microphone (TDK T5838), bottom port through a 0.6 mm board hole. Powered through load switch 1, so firmware
  can switch it fully off.
- **U5** haptic driver (TI DRV2605L) for the coin LRA on **J3** (JST-SH 2-pin).
- **J1** USB-C (power only), **D1** ESD protection, **J2** battery (JST-PH 2-pin), **J4** 10-pin SWD debug header.
- **SW1** USER (now CALIBRATE), **SW2** SHIP/WAKE (power). Both are Omron B3U-1000P, hand-soldered.
- **TP1–TP13** (no TP5): test pads on the back.
- Not on the board: no LED, no speaker, no 3.0 V rail.

Checks done:

- DRC: 0 unconnected, 0 parity issues, no copper errors.
- Schematic = `devboard_circuit.py` = PCB, pad for pad.
- Every pin map and footprint checked against the manufacturer datasheets.

### Firmware the hardware depends on

1. **POWER (SW2):**
   - Hold to turn on: wake from ship mode, one buzz.
   - Hold again to turn off: different buzz, then ship mode.
   - Configure SHPHLDCONFIG before entering ship mode.
2. **USB plugged in** (this also wakes the chip): show "charging" and don't start a session. Select the NTC and set
   32 mA charge current before enabling charging.
3. **CALIBRATE (SW1):** run the read-aloud volume calibration for the current mode, then buzz when the target is saved.
4. **Wear detection:**
   - Enable Qvar on U3 and start/stop listening when E1 reads skin.
   - Keep Qvar enabled. If it's disabled, pin 6 is effectively floating.
5. **Mic power:** enable load switch 1 only after BUCK1 is confirmed at 1.8 V (the T5838's maximum is 1.98 V).
6. **Buzz vs sensors:** the motor shakes the board. Ignore the bone sensor and mic for the length of each buzz.

## 3. Enclosure

### Placement

- **Flat on the mastoid**, behind the right ear, hanging from a wrap-style ear hook.
  - The mastoid is the best spot for bone conduction and has a flat area that suits a flat board.
  - The ear groove, where hearing aids sit, is too narrow for a 21 mm wide board.
- **Must work with glasses.** **Function first:** sticking out a bit is acceptable for a test mule.

### Orientation and coordinates

The board model (`models/cue_board_v6_all_parts.glb`) has its corner at the origin.

- X: 0 → 32.9 along the board, Y: 0 → 20.8 across it, Z up.
- Board bottom face at Z = 0, top (component) face at Z = 1.6.
- **Worn:**
  - The board's **bottom faces the head**.
  - The **X = 0 end is up**: hook end, motor.
  - The **X = 32.9 end is down**: USB-C, battery plug.
  - **Y = 20.8 faces forward** (toward the ear and face).

### Layout

- **Board:** sits flat on the base floor, with the back pressed directly on the head-side wall (no standoffs).
  - Wall under the bone sensor U3 (X 16–19, Y 5.6–9.2): solid contact.
  - Wall under the wear pad E1 (X 10.6–14.6, Y 4.2–7.2): 0.6 mm thick.
- **Battery:** Adafruit #1570, 31 × 11.5 × 3.8 mm, 100 mAh. Lies flat over the component side, on the forward half
  (X 0.5–31.5, Y 10–21.5, Z 5.6–9.4), above the tallest parts beneath it.
  - The 105 mm lead is **not shortened**: cutting LiPo leads risks a short (Tanisha).
  - The extra lead coils in a pocket at the bottom end.
- **Motor:** Vybronics coin LRA, **8.0 × 3.25 mm**, 1.8 V rms, 235 Hz. The VG0832013D is named in
  `devboard_circuit.py` and `CUE_CONTEXT.md`.
  - **Order the VG0832022D:** the same motor with 100 mm leads. The 013D's short leads may not reach J3, about
    25–30 mm away.
  - The leads are bare wire. Solder them to a JST-SH 2-pin pigtail (heat-shrink the joints) to plug into J3.
  - It vibrates perpendicular to its flat face, so the flat face goes against the skin. It's held by its own
    adhesive tape in a pocket at the top end (about X −5, Y 5) with a 0.6 mm wall to the skin.
  - It sits as far as possible from the mic and the bone sensor, with a wire channel to J3.
- **Microphone:** sound enters from the board's bottom face. A gasket seat around the hole leads to a sealed
  channel in the floor, then to a 1 mm port on the forward edge pointing toward the mouth (with a mesh recess).
  It isn't on the head side, where skin and hair would block it.
- **USB-C:** 9.4 × 3.9 mm opening in the bottom end wall (at most 1 mm thick), with an outside recess for the
  cable's plug body.
- **Debug header J4:** no opening. The shell is opened to reprogram (Tanisha).
- **Buttons:** both on the outer face, each a flexure plus plunger down to its switch.
  - **POWER:** raised, round, 4 mm.
  - **CALIBRATE:** flush, rounded-square, 3.5 mm, with a raised ring.
  - Each has a small embossed icon (power symbol, sound wave). No other markings.
- **Antenna:** Taoglas FXP830 flexible strip, 42 × 7 × 0.1 mm, MHF4 plug on a 100 mm, 1.13 mm cable. It lies in a
  flat pocket on the inside of the outer face over the board's back half (beside the battery, away from the head),
  with a cable channel to the radio's socket and a small coil recess for the extra cable.
  - It isn't on Ezurio's certified list. That's fine for internal test mules (Sam, 2026-10-08), not for devices
    that are sold.
  - Backup: Kyocera AVX 1003893FT (40 × 8 mm), offered with a 25 mm cable. Check that it comes with an MHF4 plug.
- **Safety-cord loop:** 1.5 mm hole at the bottom end, for tethering during active tests.

### Shape, size, material

- Two parts: a **base** (head side) and a **cover** (outer side). Snap fit with 4 hooks, a pry notch, an alignment
  lip, and ribs that press the board down.
- Smooth, rounded behind-the-ear form with a gently convex head-side face. **No silicone pads** (see section 4).
- About **50 × 24 × 11.6 mm**. This is set by the board, the battery stacked on top, and the battery/USB connectors.
- **Resin printed (SLA/MSLA), in a tough or ABS-like resin.** Standard resin is too brittle for the snap hooks
  and button flexures.
  - Walls 1.0 mm (0.8 mm where tight), thin windows 0.6 mm (wear pad, motor).
  - Clearance 0.15 mm around parts, 0.2 mm for snap and sliding fits; 0.5 mm minimum feature, 0.6 mm minimum hole.
  - Print each part tilted about 30° with supports only inside and on the seam, keeping the head-side face, the
    outer face and the flexures support-free. No trapped hollow pockets.
  - **Skin contact:** wash and fully post-cure, since under-cured resin can irritate skin during hours of wear.
    Use a skin-safe resin if available.
  - Print a small tolerance test (the hook slot and one snap hook) first: resins shrink differently.

## 4. Retention: ear hook and squeeze

### How existing devices do it

- **Regular hearing aids (2–4 g):** the anchor is the tube into the ear canal. Cue has nothing in the canal, so it
  loses that. ([hear.com](https://www.hear.com/resources/hearing-aids/retention-wire/))
- **Cochlear implant processors (~10 g, closest to Cue):** standard hook, plus wrap-around options (Snugfit in
  3 sizes, Hugfit silicone band), ear-bowl anchors and safety cords.
  ([Cochlear](https://www.cochlear.com/us/en/home/products-and-accessories/our-accessories/keeping-your-device-in-place))
- **Bone-conduction devices:** the signal depends on steady contact force against the head, held with headbands,
  adhesive pads on the mastoid, or magnets.
  ([AudiologyOnline](https://www.audiologyonline.com/articles/adhear-revolution-in-bone-conduction-23691),
  [PubMed](https://pubmed.ncbi.nlm.nih.gov/35042247/))

### Monte Carlo comparison (`sim/`)

Method:

- 300 "worlds", each drawing the uncertain physics: mass, friction, hook stiffness, fit spread, pressure tolerance,
  hair effect, glasses conflict.
- 4,000 simulated wearers per world: ear fit, hair, glasses, activity, tolerance.
- Success means it stays on, gives good bone-sensor contact, is comfortable for ~4 h, and works with glasses.
- These are estimates, so use the results to **rank** options, not to predict real numbers.

| Option                                      | Success, median (10–90%) | Stays on | Contact | Comfort | Glasses | Best in |
| ------------------------------------------- | ------------------------ | -------- | ------- | ------- | ------- | ------- |
| **Wrap hook S/M/L + light squeeze (0.5 N)** | **80%** (59–91%)         | 99%      | 92%     | 99%     | 85%     | **55%** |
| Wrap + light squeeze + silicone pads        | 74%                      | 100%     | 92%     | 93%     | 85%     | 26%     |
| Wrap + medium squeeze (1.0 N)               | 61%                      | 100%     | 100%    | 65%     | 85%     | 18%     |
| Simple hook + adhesive pad                  | 44%                      | 91%      | 60%     | 87%     | 88%     | 1%      |
| Simple hook + squeeze                       | 38%                      | 80%      | 86%     | 62%     | 87%     | 0%      |
| Simple hook (hearing-aid style)             | 0%                       | 9%       | 0%      | 100%    | 88%     | 0%      |
| Wrap hook, no squeeze                       | 0%                       | 92%      | 0%      | 100%    | 85%     | 0%      |

Squeeze sweep, wrap hook, no pads:

| Squeeze | 0.2 N | 0.3 N | 0.4 N | 0.5 N | **0.6 N** | 0.7 N | 0.8 N | 1.0 N | 1.2 N |
| ------- | ----- | ----- | ----- | ----- | --------- | ----- | ----- | ----- | ----- |
| Success | 13%   | 41%   | 64%   | 81%   | **84%**   | 82%   | 78%   | 61%   | 42%   |

What the results say:

1. A simple hook fails: it can't hold ~12 g, and it gives the bone sensor no contact.
2. Squeeze is required. **About 0.5–0.7 N** (roughly the weight of 60 g) works best. Less loses bone contact;
   more makes the ear root sore.
3. Silicone pads concentrate pressure and lower comfort. A large smooth face is better.
4. Adhesive pads fail on hair and irritate skin over a day.

Assumptions that matter most, to measure first:

1. The minimum contact force the bone sensor needs.
2. How much hair weakens the bone signal.
3. Hook contact width on the ear root.
4. Glasses conflicts.
5. How well S/M/L covers real ears.

Not modelled: the outward tipping from the battery being on the outer side, and long-term sweat.

### Hook design

- **Wrap path:** from the top of the body, over the top of the ear root and partway down its front, so the ear root
  is gently held between hook and body. It stays thin and in the crease where the ear meets the head, leaving
  room for glasses.
- **Squeeze:** the hook's resting shape is slightly too tight (very roughly 5–10 mm). When worn it flexes and
  presses the body onto the mastoid at about 0.6 N.
- **Wire:**
  - Use **1.0 mm stainless spring wire** for the first mules: it can be bent by hand with pliers.
  - Move to **1.0 mm superelastic nitinol** once the shapes are settled. It must be heat-set at about 500 °C in a
    jig.
  - Bending stress at 0.6 N is about 120 MPa, far below either wire's limit.
  - On/off cycles: about 2,000 a year, not a fatigue concern.
- **Sleeve:** frosted silicone, 1.0 mm ID / about 2.5 mm OD. **Ear-root saddle:** a flattened section about 4 mm
  wide where the hook rests on top of the ear, to spread pressure.
- **Sizes:** S / M / L. Start with ear-root arcs of about 10 / 12 / 14 mm radius and refine after fitting 5–10
  people.
- **Why not a printed hook?** Plastic relaxes under constant load, faster at body temperature, so the squeeze fades
  over hours and the bone-sensor data drifts. Resin can crack, and a strong enough printed hook is thicker and
  clashes with glasses. Printed hooks are used only as **fit gauges** (shape and size, no squeeze).

### Modular hook interface

- Each hook module is a wire, sleeve and saddle, plus a small **printed hook base** (a keyed block on the wire end).
- The base slides into a **keyed slot** at the top end of the body. The slot is angled about 20° forward and 10°
  toward the head.
- The base is **captured by the cover** when the shell snaps shut: it can't twist or pull out, and no glue is
  needed. Open the shell to swap sizes.
- The wire leaves the base through a counterbore with the sleeve continuing into it, so it doesn't kink at the edge.

### Tuning the squeeze

1. Hook a luggage or fishing scale onto the safety-cord loop.
2. Pull straight out from the head and read the force when the body just lifts off. Aim for about **60 g**.
   - Bend tighter if it reads under about 40 g.
   - Bend looser if it reads over about 80 g, or the ear root is sore after an hour.
3. Record the setting for each size.

## Build status in Zoo (2026-10-09)

Modelled in Zoo Design Studio and checked against the board model with `sim/fitcheck.py`.

- **Steps 1–2 pass** (two-part body, internal snaps, five foam-tipped hold-down fingers):
  - no collisions; board edge clearance 0.145–0.15 mm
  - board flat on the floor under U3 and E1
  - walls at least 0.6–0.7 mm
  - 52 × 25.55 × 11.8 mm
- **Step 3 (openings) is partly done.** The USB-C opening and mic channel are in the right place, with fixes
  requested:
  - USB opening entirely in the cover, starting at the seam
  - no plug recess
  - mic channel rising inside the forward wall to a slot on the forward face
  - no feathered edges
  - cord hole through a solid corner
- **Exterior shaping in Zoo was not adopted.** Rounding the box after the fact failed (lofts and fillets failed,
  and the last attempt grew to about 53 × 30.5 mm). The mule stays a plain rounded pebble.
- Also changed:
  - the top-end hold-down finger is a post from the cover ceiling
  - the motor pocket moves to X −5.3, Y 6.0, to clear a snap arm
- Still to do: finish the Step 3 fixes, then buttons, motor pocket, hook slot, antenna pocket, hook bases and fit
  gauges.

## 5. Decisions

| Decision                                                                                       | By                   |
| ---------------------------------------------------------------------------------------------- | -------------------- |
| Wearable test mule, function first; resin print (tough/ABS-like)                               | Sam                  |
| Right ear; flat on the mastoid; must work with glasses                                         | Sam                  |
| Back of board to the head; snap-fit two-part shell                                             | Sam                  |
| Vibration as the only on/off indicator (no LED, no board change)                               | Sam                  |
| Physical power button (SW2); SW1 becomes CALIBRATE (volume calibration)                        | Sam                  |
| Keep E1 as a wear sensor: auto start/stop listening                                            | Sam                  |
| USB-C opening for charging                                                                     | Sam                  |
| Adafruit #1570 battery, lead not shortened, tuck space for the wire                            | Tanisha              |
| No debug-port opening; open the shell to reprogram                                             | Tanisha              |
| Antenna: Taoglas FXP830 strip, non-certified OK for internal mules                             | Sam                  |
| Wrap hook S/M/L, ~0.6 N squeeze, no pads, wire hooks as modular units (Monte Carlo + research) | Sam, with simulation |
| Board: J5 → test pads, BUCK2 removed, U3 pin 9 to GND, 33 × 21 mm layout                       | Big A, Sam           |

## 6. Open items and risks

1. **Antenna: decided for the mule.** Taoglas FXP830 (42 × 7 × 0.1 mm), not certified with the module, which is
   acceptable for internal testing. The Ezurio-approved ones don't fit the body:
   - [mFlexPIFA](https://www.ezurio.com/internal-antennas/24-5-6-ghz-wi-fi-and-bluetooth/mflexpifa-flexible-adhesive-backed-pifa-internal-antenna)
     is 29.5 × 26.5 mm and made for metal surfaces.
   - [NanoBlue](https://www.ezurio.com/internal-antennas/24-5-6-ghz-wi-fi-and-bluetooth/nanoblue-series-bluetooth-internal-antenna)
     is 44.5 × 12.7 mm.

   Check the radio range in the worn position on the first mule.

2. **Motor: confirmed** as the Vybronics VG0832013D (8.0 × 3.25 mm). Order the 022D variant (100 mm leads) plus
   a JST-SH 2-pin pigtail.
3. **Size and weight:** about 50 × 24 × 11.6 mm and 10–15 g. Fine for a mule; a final-size body needs a smaller board.
4. **Battery tipping:** the battery on the outer side shifts weight away from the head. The squeeze counters it,
   but watch for tipping in testing.
5. **Wear detection through the shell is untested.** It may need a thinner window or an opening over E1.
6. **R6 value:** it's 0 Ω now. ST's Qvar example uses about 500 Ω, so confirm against ST AN5755.
7. **J4 debug header:** keyed Arm cables need the -007 part (pin 7 removed), or pull pin 7.
8. **Optional board tidy-ups:**
   - C2 (extra 10 µF on VBUS) and C4 (extra 1 µF on VSYS) aren't in Nordic's reference.
   - A 1V8 via and the end of PMIC_INT sit under the radio's RF end.

## 7. Test plan (first mules)

1. Find hook sizes with printed fit gauges on 5–10 people. Then bend stainless hooks and tune each to about 60 g.
2. **Bone-sensor contact:** record speech at 30 / 60 / 90 g squeeze, on bare skin vs on hair.
3. **Comfort:** 2–4 h wear at about 60 g; check the ear root and mastoid.
4. **Glasses:** do the hook and glasses arms coexist?
5. **Stability:** walking, head turns, a short jog. Does it stay on without tipping?
6. **Wear detection:** does E1 reliably tell on-head from on-desk through the shell?
7. **Mic:** speech clarity through the forward port; noise during buzzes.
8. **Buzz:** is it clearly felt but private?
9. **Radio range:** Bluetooth link to a phone or laptop in a pocket, across a room, and behind the head.

## 8. Files

- `ZOO_PROMPTS.md`: step-by-step prompts for Zoo (text-to-CAD), including printed hook fit gauges.
- `models/cue_board_v6_all_parts.glb`: board with all parts at true height. Import this into Zoo; origin at the
  board corner.
- `models/cue_board_v6.step`: same board as STEP, missing four simple part models (U1, U4, U5, J2). The prompts
  give keep-out boxes for them.
- `sim/retention_mc.py`, `sim/retention_sweep.py`: the Monte Carlo. Requires numpy; re-run with real measurements.
- Regenerate the models from the board (KiCad 10):
  `kicad-cli pcb export glb --subst-models --user-origin 67.9x112.7mm -o models/cue_board_v6_all_parts.glb ../devboard/cue_devboard.kicad_pcb`
  (same flags for `export step` and `export stl`).
