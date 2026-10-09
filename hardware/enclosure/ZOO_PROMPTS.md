# Cue enclosure: Zoo prompts (wearable test mule, right ear)

Design background and decisions: `DESIGN.md`.

How to use:

1. Import `models/cue_board_v6_all_parts.glb` into Zoo first, so the board is in the scene at the origin.
   `models/cue_board_v6.step` is the same board as a STEP file, but it's missing four simple part models (radio
   module U1, mic U4, haptic driver U5, battery connector J2). The keep-out boxes below cover them.
2. Paste **Step 0**, then one step at a time.
3. Check each result against its checklist before moving on.

---

## Step 0: context (paste first)

```
I'm designing a 3D-printed enclosure for a wearable test prototype called Cue: a small device worn behind the
RIGHT ear, hanging from a separate ear hook. It holds a 32.9 x 20.8 x 1.6 mm circuit board (corner radius 1 mm),
a small LiPo battery and a coin vibration motor. It will be printed on a RESIN printer (SLA/MSLA) in a tough or
ABS-like resin. Use 1.0 mm walls by default (0.8 mm where space is tight, 0.6 mm only for the thin windows I
call out), 0.15 mm clearance around parts, 0.2 mm for snap and sliding fits, a 0.5 mm minimum feature size and
0.6 mm minimum hole size. Keep the head-side face and the outer face smooth (they'll be printed without supports
on those faces). Units are millimetres.

Coordinate system (matches the imported board model):
- X runs along the board's length, 0 to 32.9. Y runs across it, 0 to 20.8. Z is up.
- The board's BOTTOM face is at Z = 0 and its TOP (component) face is at Z = 1.6.
- When worn: the Z- side (board bottom) faces the head and presses against the skull behind the ear.
  The X = 0 end points UP (toward the top of the ear; the ear hook attaches there). The X = 32.9 end points DOWN.
  The Y = 20.8 edge faces FORWARD (toward the ear/face); the Y = 0 edge faces BACKWARD.

Parts on the board's top side (keep-out boxes: X range, Y range, top Z):
- Radio module U1: X 1.7-11.7, Y 8.0-22.0 (overhangs the Y = 20.8 edge by 1.2 mm), top Z 3.2.
  Its antenna cable socket is at X 10.3, Y 18.5 and needs clearance up to Z 5.0 for the cable plug.
- USB-C port J1: X 26.1-32.9 (opening flush with the X = 32.9 edge), Y 10.4-19.4, top Z 5.2.
- Battery connector J2: X 24.9-32.5, Y 0.9-8.8, top Z 6.4. The battery plug pushes in from the +X side.
- Motor connector J3: X 18.3-22.3, Y 0.9-5.2, top Z 4.6. Its plug enters from the Y = 0 (back) edge.
- Debug header J4: X 4.2-9.7, Y 0.7-7.1, top Z 6.1. No opening needed (the case is opened to reprogram).
- Button SW1 ("calibrate"): X 0.5-3.0, Y 2.4-5.4, top Z 3.2, plunger centre X 1.7, Y 3.9.
- Button SW2 ("power"): X 20.9-23.9, Y 7.4-9.9, top Z 3.2, plunger centre X 22.4, Y 8.6.
- Microphone U4: X 12.2-15.7, Y 7.8-10.5, top Z 2.6. It listens through a 0.6 mm hole through the board at
  X 13.23, Y 9.14, so sound enters from the board's BOTTOM face (Z = 0).
- Everything else on the top side is 1.3 mm tall or less (top Z 2.9). The tallest point is Z 6.4 (J2).

Board bottom face (Z = 0): flat, only bare copper pads, no parts. Two areas matter:
- Bone-conduction sensor U3 sits above X 16.0-19.0, Y 5.6-9.2: the board must press firmly against the
  head-side wall here so skull vibration reaches it (solid contact, no foam, no air gap).
- Wear-detection pad E1 (bare copper) at X 10.6-14.6, Y 4.2-7.2: it senses skin, so the wall under it must be
  thin (0.6 mm) and touch the board.

Other contents:
- Battery: Adafruit #1570 LiPo pouch, 31 x 11.5 x 3.8 mm, 3 g, with a 105 mm lead ending in a JST-PH plug.
  Do NOT shorten the lead; leave a space to tuck the extra wire.
- Vibration motor: Vybronics VG0832022D coin LRA, 8.0 mm diameter x 3.25 mm thick, on 100 mm leads that plug into
  J3. It vibrates perpendicular to its flat face, so the flat face goes against the head-side wall.
- Antenna: Taoglas FXP830 flexible strip, 42 x 7 x 0.1 mm, stuck inside the outer face; its 1.13 mm cable
  (100 mm) plugs into the radio's socket at X 10.3, Y 18.5.
- The device indicates on/off and coaching only by vibrating. There are no lights and no speaker.

Just confirm you understand; don't build anything yet.
```

---

## Step 1: two-part body around the board and battery

```
Create the enclosure as two parts that meet just above the board's top face:
1) a BASE (head side) that the board drops into, and 2) a COVER (outer side).

Inside layout:
- The board sits flat on the base's inner floor at Z = 0 with 0.15 mm clearance around its outline. The floor
  supports the whole board bottom; the board rests directly on it (no standoffs) so the bone-conduction area is
  in solid contact.
- The base floor wall is 1.0 mm thick (Z -1.0 to 0), except a 0.6 mm thin window under the wear pad E1
  (X 10.6-14.6, Y 4.2-7.2).
- The battery lies flat on top of the parts, over the board's forward half: X 0.5-31.5, Y 10.0-21.5,
  Z 5.6-9.4. Add a shallow cradle in the cover to hold it, with 0.5 mm clearance around it (LiPo pouches can
  swell slightly).
- The cover's inner ceiling is at Z 9.6 and its outer face at Z 10.6.
- Extend the body 10 mm past the X = 0 end (to about X -10) for the motor and ear-hook socket (later steps).
- At the X = 32.9 end, the back half (Y 0-10) extends to about X 41 for the battery plug and the coiled extra
  battery wire (a pocket roughly 8 x 9 x 6 mm). The forward half (Y 10-21) stays short so the USB-C port sits
  right behind a thin end wall.

Outside shape: a smooth, rounded behind-the-ear body. Round all outer edges generously (2-3 mm radii), keep the
head-side face gently curved to sit against the skull, and make the overall form taper slightly toward the top.
Roughly 50 mm long, 24 mm wide and 11.6 mm thick overall. Keep all inner keep-out boxes from Step 0 clear.
```

Check: board model drops in without touching anything; battery box clears J1 and the radio's cable socket;
floor is flat under U3 with 0.8 mm under E1.

---

## Step 2: snap fit and holding the board

```
Join the base and cover with a snap fit that can be opened by hand (it gets opened to reprogram the board):
- 4 cantilever snap hooks on the cover (two on each long side), latching into matching windows or ledges in the
  base. Size them for tough resin, keeping bending strain low: hook arm 1.0 mm thick, 7 mm long, 0.4 mm catch
  with a 30-degree lead-in, and a 0.5 mm fillet where the arm meets the wall.
- Add a small pry notch at the seam on the back (Y = 0) edge.
- Add a 0.8 mm alignment lip around the seam.
- Add 4 small ribs or pins on the underside of the cover that press the board down onto the floor, landing
  within 1 mm of the board edge where there are no parts (check against the imported board model), so the
  board can't rattle and stays pressed against the head-side floor.
```

Check: hooks don't land on a component; ribs touch bare board edge only; the cover closes over the battery.

---

## Step 3: openings (USB-C, microphone, battery plug)

```
Add these openings and channels:

1) USB-C charging opening in the bottom end wall (the X = 32.9 end), centred at Y 14.9, Z 3.4:
   9.2 x 3.7 mm with 1.5 mm corner radius. The wall in front of the port is 0.8 mm thick.
   Add an outside recess 12.5 x 7.0 mm, 1.0 mm deep, around it so a USB-C cable's plug body fits.

2) Microphone sound path. The mic hears through a hole in the board's bottom face at X 13.23, Y 9.14.
   The head-side face can't have the port (skin and hair would block it), so:
   - On the base's inner floor, add a gasket seat around that point: a ring 3.0 mm outside diameter,
     1.2 mm inside diameter, recessed 0.5 mm, so a thin foam or silicone gasket seals board to floor.
   - From the ring, cut a channel 0.8 mm wide and 0.5 mm deep in the floor, running in +Y to the forward
     edge (Y = 20.8), staying at X 13.2. Thicken the floor locally to 1.5 mm along the channel.
   - The channel exits through the forward side wall as a 0.8 mm round port, facing forward and slightly
     down toward the mouth, with a 2.5 mm wide, 0.3 mm deep outside recess for an acoustic mesh sticker.

3) Battery plug and wire pocket in the bottom-end extension (back half, Y 0-10, X 32.5-41):
   room for a JST-PH plug pushed into J2 from +X (plug about 6 x 4.5 x 3 mm plus wires) and for about 80 mm of
   coiled 26 AWG wire. Round the inside corners so the wire isn't pinched.

4) Safety-cord loop at the bottom end: a 1.5 mm hole through a solid tab or bridge, at least 1.5 mm of material
   around it, for tying on a thin lanyard.
```

Check: a USB-C cable reaches full depth; the mic channel doesn't cross the E1 window (Y 4.2-7.2) or the U3
area (X 16-19); the battery plug fits.

---

## Step 4: buttons and labels

```
Add two press buttons on the cover's outer face, each a flexing tab with a plunger that reaches down to its
switch on the board (the switch tops are at Z 3.2; the cover's outer face is at Z 10.6). Make each flexure a
U-shaped cut 0.5 mm wide around a tab 0.8 mm thick and at least 6 mm long, so it bends gently in tough resin:
- POWER over SW2, plunger centred at X 22.4, Y 8.6: a raised round button, 4 mm diameter, standing 0.6 mm
  proud of the surface, on a U-shaped flexure cut into the cover. Plunger 1.5 mm diameter, ending 0.2 mm above
  the switch.
- CALIBRATE over SW1, plunger centred at X 1.7, Y 3.9: a flush, rounded-square button, 3.5 mm, with a
  0.3 mm raised ring around it so it can be found by touch but not pressed by accident. Same flexure and
  plunger style.
- The two must feel different: raised round = power, flush square with a ring = calibrate.
- Keep both plungers clear of the battery (the battery starts at Y 10.0).
- Emboss small labels 0.3 mm high beside each button: a power symbol next to POWER, and a sound-wave
  icon (three curved lines) next to CALIBRATE. No other text or logos.
```

Check: both plungers line up with the switch centres in the board model; flexures don't hit snap hooks.

---

## Step 5: motor pocket and head-side contact

```
Add the vibration motor pocket and finish the head-side face:
- Motor pocket in the top extension (X -9 to -1), against the head-side wall: a round seat 8.3 mm diameter,
  3.5 mm deep (motor is 8.0 x 3.25 mm, held with its own adhesive tape, flat face toward the skin), with the wall between motor and skin 0.6 mm thick so the buzz is felt clearly. It sits as far
  from the microphone (X 13.2, Y 9.1) and the bone sensor (X 17.5, Y 7.4) as possible; centre it near
  X -5, Y 5.
- Add a 1.5 mm wide wire channel from the motor pocket along the inside of the back (Y = 0) wall to the motor
  connector J3 at X 18.3-22.3 (its plug enters from the Y = 0 edge).
- Head-side face: make it as large, smooth and gently convex as the body allows (it spreads the ear hook's
  ~0.6 N squeeze against the mastoid). No pads, ridges or soft inserts. The area under the bone sensor
  (X 16-19, Y 5.6-9.2) and the wear pad (X 10.6-14.6, Y 4.2-7.2) should be the part of the face that touches
  the skin first.
```

Check: motor fits without raising the body thickness; contact pad sits under U3 and E1.

---

## Step 6: modular ear-hook slot (right ear)

```
Ear hooks are swappable modules in sizes S/M/L. Each module is a 1.0 mm spring wire (stainless or nitinol) in a
2.5 mm silicone sleeve, with a small printed HOOK BASE on its end: a block 4.0 x 3.0 x 6.0 mm with a 1.1 mm
through-hole for the wire and a 0.8 mm lip on one end. The wire's end is bent 90 degrees into a 3 mm tail
inside the base so it can't rotate.

Add a keyed slot for the hook base at the top end (X = -10 end) of the body:
- A rectangular pocket 4.2 x 3.2 mm (0.1 mm clearance per side; it's a sliding fit), 6 mm deep, open at the seam so the base drops
  in from the cover side, with a matching recess for the 0.8 mm lip.
- When the cover snaps shut, it closes over the base and traps it: no twisting, no pulling out, no glue.
  Opening the cover lets you swap hook sizes.
- Where the wire leaves the body, add a 3.2 mm diameter, 2 mm deep counterbore so the sleeve continues into the
  body and the wire doesn't bend sharply at the edge.
- Place the slot near the forward-top corner of the top end. Angle its axis forward (toward +Y) about
  20 degrees and toward the head (toward -Z) about 10 degrees, so the hook arches over the top of the right ear
  root and sits close to the head.
- At least 1.2 mm of material around the slot. Keep it clear of the motor pocket.
```

Check: the hook base drops in only one way and is locked once the cover is on; the slot doesn't break into the
motor pocket.

---

## Step 7: antenna pocket and final check

```
Add a pocket for the radio's stick-on antenna: a Taoglas FXP830 flexible strip, 42 x 7 x 0.1 mm, with a 1.13 mm
coaxial cable (100 mm long) ending in a small MHF4 plug.
- Put a flat pocket 43 x 8 mm, 0.4 mm deep, on the inside of the cover's outer face over the board's back half
  (about X -3 to 40, Y 1-9), running along the body's length. It must not sit over the battery (battery starts at
  Y 10.0) and should be as far from the head as possible.
- Add a 1.4 mm wide channel for the cable from the pocket to the radio's antenna socket at X 10.3, Y 18.5,
  going around the end of the battery, not over it.
- Add a small recess (about 10 x 6 x 2 mm) next to the battery-wire pocket or under the battery's end where the
  extra cable can be coiled with a 5 mm minimum bend radius.

Then:
- Check the board model fits with 0.15 mm clearance everywhere and nothing intersects.
- Check wall thickness is at least 0.8 mm everywhere except the 0.6 mm windows (E1 area, motor).
- Check there are no fully enclosed hollow pockets (resin gets trapped); add a 1 mm drain hole if there are.
- Export the base and cover as separate STL files (and STEP). For printing, tilt each part about 30 degrees with
  supports only on the inside and on the seam; keep supports off the head-side face, the outer face and the
  button flexures.
```

Check: the antenna strip lies flat away from the battery and head; the cable reaches the socket without sharp
bends.

---

## Step 8: hook bases and fit gauges (separate small parts)

```
Create these small separate parts to print:
1) HOOK BASE: the 4.0 x 3.0 x 6.0 mm keyed block from Step 6, with a 1.1 mm wire hole along its length, a slot
   for the wire's 3 mm 90-degree tail, and the 0.8 mm lip. Print 6.
2) FIT GAUGES, sizes S, M and L: rigid hook shapes used only to find the right size on people's ears (they don't
   need to flex). Each is a 2.5 mm round rod with a hook base on one end. From the base it rises, arches over the
   top of the ear root and continues about 15 mm down the front of the ear root. The arch radius around the ear
   root is 10 mm (S), 12 mm (M) and 14 mm (L), with a flattened 4 mm wide section where it rests on top of the
   ear. It follows the right ear and stays close to the head. Emboss S, M or L on each base.
```

---

## Still open (decide before printing for real)

1. **Antenna: decided.** Taoglas FXP830 strip (not certified with the module; fine for internal test mules).
   Check the radio range in the worn position on the first print.
2. **Motor: confirmed.** Vybronics VG0832013D/022D, 8.0 x 3.25 mm (from the board notes and CUE_CONTEXT.md).
   Order the 022D (100 mm leads) and solder them to a JST-SH 2-pin pigtail for J3.
3. **Size.** This mule comes out around 51 x 25 x 12 mm, mostly because of the 33 x 21 mm board, the
   battery stacked on top, and the big battery and USB connectors. A smaller board is the way to get a
   final-size body.
4. **Firmware to match the hardware:**
   - Hold POWER to turn on or off, with a buzz pattern for each.
   - CALIBRATE starts the read-aloud volume calibration.
   - E1 wear detection starts and stops recording.
   - Plugging in USB shows "charging" instead of starting a session.
5. **Design-doc update.** `CUE_CONTEXT.md` still says on/off is a long press on a touch surface. This mule uses a
   physical power button plus wear detection instead.
