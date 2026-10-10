# Cue

**Speak with intention.** Cue is a discreet behind-the-ear (BTE) speech coach that gives a private haptic tap when a speaking habit (a run of fillers, rushing, no pauses, a long turn, speaking too quietly) is getting in your way, so you notice it in the moment and replace it with a pause.

This repository is the **software MVP**: a web app that listens through the microphone, detects these behaviors in real time, and shows each haptic cue on a 3D model of the device in place of the hardware. Product context, confirmed decisions, and open questions live in [`CUE_CONTEXT.md`](CUE_CONTEXT.md). Read it before proposing changes.

**Live demo:** https://cue-samanthajwilliamson-2541.vercel.app (it has no server Deepgram key, so use your own; see [Your own Deepgram key](#your-own-deepgram-key)).

> Status: prototype for validating the behavior loop. Not a medical device. Detection accuracy has not been measured on real users yet.

## How Cue decides to tap

Cue is a behavioral coach, not a filler counter ([`SOFTWARE.md`](SOFTWARE.md)). Detectors notice fillers, pace, pauses, turn length and volume; a **decision engine** (`src/lib/cue/engine.ts`) asks whether a tap would help right now. There are two modes, switched in the app or by double-tapping the device:

|                  | Conversation                              | Presentation                                                               |
| ---------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| Fillers          | 3 fillers within 12 s, or 8 per min       | um/uh above 5 per min over the last 60 s; "like"/"lowkey" count half       |
| Rushing          | 4.5 syl/s, then 20% over your own pace    | 4.0 syl/s, then 10% over your own pace                                     |
| No pause         | 30 s without a pause                      | 22 s without a ≥0.6 s pause                                                |
| Long turn        | 90 s                                      | Not live (a talk is one long turn)                                         |
| Too quiet        | 6 dB under your calibrated volume for 3 s | 6 dB under your calibrated volume for 10 s                                 |
| Gap between taps | 15 s cooldown (setting: 10–20 s)          | At least 25 s, at most 2 taps per minute; only the highest priority taps\* |

\* Presentation priority when several are due at once: rushing > no pause > filler > too quiet. The Presentation numbers are research-based starting points to test ([`CUE_CONTEXT.md`](CUE_CONTEXT.md) §26, decision 11).

- **Patterns, not single fillers.** One "um" is normal. Settings has an "every filler" testing mode (cooldown drops to 1.5 s). Whether patterns or every filler helps more is still a working assumption to test.
- **Pace against your own normal.** Rushing starts at the preset and, after your first minute of speech, becomes 20% (Conversation) or 10% (Presentation) over your own pace, never below 3.6 syl/s.
- **Sustained behaviors wait for a natural break** (up to a few seconds) so the tap doesn't land mid-word.
- **Did it work?** 8 s after each tap Cue checks whether you paused, slowed down, stopped the fillers or spoke up, and gives more room next time if you did. Review shows "tapped: 3 in 9 s, and it worked".

## What it detects

| Behavior                              | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "um", "uh" (also "er", "erm", "ah")   | Deepgram **Flux** streaming ASR (results every ~0.2 s, keeps fillers; Nova-3 drops most fillers live). "hmm" is not counted: it's often a listening sound.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Filler "like"                         | Rules over neighbouring words, part-of-speech tags, punctuation and pauses. "I like went to the mall" counts; "I like tofu" doesn't. Ambiguous cases never count, and every decision has a readable reason.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Quote "like" ("she was like, no way") | On by default, toggle in Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| "About" "like" ("like twenty people") | Off by default, toggle in Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Filler "lowkey"                       | Its own classifier (`lowkeyClassifier.ts`): "it's lowkey good" counts; "keep it low-key" doesn't.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Speaking too fast                     | Syllables per second over a rolling 8 s window, pauses over 0.6 s excluded, sustained for 3 s. Thresholds above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| No pause                              | Time since your last meaningful pause.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Long turn                             | How long your current speaking turn has run ("give the other person space"). Conversation only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Speaking too quietly (calibrated)     | You set the target with a short read-aloud (**Set my volume**) for each mode, saved on this device only as one loudness number per mode (no audio). Mic level is measured only while you're saying words and adjusted for room noise (0.6 dB per dB of noise change, capped at ±10 dB). Without a calibration for the current mode, too-quiet cues are off and the app asks you to set it. A **Volume feedback** switch per mode turns volume coaching off entirely, so you never have to set a volume for that mode (saved on this device). Gain control and noise suppression are off so the measurement isn't distorted. |

"um"/"uh" are detected on the first confident result (confidence ≥ 0.8), and a clear filler "like" as soon as the next word is heard; ambiguous cases wait for more words. Detection is not the same as a tap: taps follow the pattern rules above. Each cue's measured delay appears in the app.

### Three cues

Live, Cue only ever asks for three things (decision 18). Every cue starts with a sharp onset (`src/lib/cue/patterns.ts`).

| Cue       | Haptic                                         | When                                                        |
| --------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Pause     | One tap (50 ms)                                | No pause for a while, a long turn, or a run of filler words |
| Slow down | Slow steps (three 100 ms pulses, 250 ms apart) | Rushing                                                     |
| Speak up  | Long push (450 ms)                             | Too quiet                                                   |

On screen, each cue is drawn as rings leaving the motor on the 3D device. A faint gray ring means "noticed, not a pattern yet", a testing aid.

**Your own filler words.** In Settings you can add up to 20 words or short phrases you lean on ("so", "basically", "you know"). Cue counts one every time it's said (there's no check of how it was used, unlike "like"), and they feed the same pattern rules as the built-in fillers. The list is saved on this device.

### Session report

When a session ends, the app builds a report (decision 19, `src/lib/cue/report.ts`): up to three things to work on, then one card per area.

| Area               | What it reports                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Pauses             | How often you paused and your longest stretch without one.                                                                                   |
| Pace               | Average and fastest words per minute, the share of the session spent rushing, and a small chart of pace from start to finish.                |
| Volume             | How much of the session you spent well below the volume you set (needs a set volume).                                                        |
| Filler words       | Fillers per minute and a count of each word, including your own.                                                                             |
| Pitch and tone     | How much your pitch moved, from the microphone (`src/lib/cue/pitch.ts`). Under 2 semitones of spread reads as flat.                          |
| Reading from notes | If you paste your notes or script, the share of your talk that matched them word for word (runs of 5+ words). Notes stay in the browser tab. |
| Inclusive language | Terms from a short built-in list (`src/lib/cue/inclusive.ts`), each with an alternative.                                                     |

Pitch and volume need a microphone session. All of the report's thresholds are starting points that haven't been tested with users yet.

**Touch controls (simulated in the app).** The device's touch surface is for controls only: **hold 1.5 s** = Cue on/off, **double-tap** = switch Conversation / Presentation mode. A single tap or a lingering touch does nothing, so adjusting your hair or glasses won't trigger it. Confirmations are swelling or fading _ramps_ with no sharp onset, drawn as a neutral glow without rings, so they can't be mistaken for a coaching cue.

**Only the wearer is coached, by hardware.** On the device, a bone-conduction sensor confirms when you're the one speaking; the microphone (which hears everyone) feeds speech-to-text; a vibration motor behind the ear taps. Cue coaches only words the bone sensor confirms. This web prototype has no bone sensor, so it treats all speech as yours; Practice can simulate a friend cutting in.

A detection is withheld (not tapped) when confidence is too low, when it isn't a pattern yet, within the gap after the last tap, while muted, when its category is off, or when the behavior isn't live in the current mode. Withheld detections still show in the app's "Why Cue acted" log.

## Testing with AirPods

Until the device exists, AirPods (or any headphones with a mic) can stand in for it in user tests. This is a testing
stand-in, not the product: Cue stays one behind-the-ear device that taps.

1. Connect the AirPods, open the app, and switch on **Cue sounds in AirPods**. Each cue then also plays as a quiet sound
   in the ear, with the same rhythm as its tap and one pitch per family (Space high, Pace middle, Voice low).
   Confirmations swell in softly so they never sound like a cue. Volume and a test sound are in **Settings → Testing
   with AirPods**.
2. On a laptop, pick the AirPods under **Settings → Microphone**. On iPhone, connected AirPods are used automatically.
   While listening, the app shows which mic it's using.
3. **Set my volume** again with the AirPods in. Volume targets are saved per microphone, because the AirPods mic hears
   you at a different level from a laptop or phone mic.
4. Keep the page open while you talk: the screen stays on while listening, because a locked phone stops the mic.

Limits: the AirPods mic still picks up other people (more quietly), so their fillers can tap too; Bluetooth adds a
little delay to each sound; on iPhone, test with the ring switch both ways the first time.

## Quick start

Requires Node 24 (see `.nvmrc`). A Deepgram key on the server is optional.

```bash
npm install
cp .env.local.example .env.local   # optional: paste a Deepgram key
npm run dev
```

Open http://localhost:3000.

- **Try a sentence** plays typed text through the same detectors. It doesn't need a key.
- **Start listening** streams your mic to Deepgram for live detection, using the server's `DEEPGRAM_API_KEY` if it has one (the key needs the **Member** role or higher to mint browser tokens) or your own key.
- **Mark mistakes**: click a word in the transcript, or use the buttons in "Why Cue acted", to flag a wrong tap or a missed filler.
- **Download session** (after a live session) saves the words and timings Deepgram heard, your corrections, cue delays, your settings and mic loudness levels (no audio). Put the files in `sessions/` and run `npm run eval`.
- **Training** (only under `npm run dev`; hidden on deployed sites) records a labeled session to `training/` on your machine. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Your own Deepgram key

**Use your own Deepgram key** is always available, and when set it overrides the server's key. The key is kept in this browser only: `sessionStorage` (this tab), or `localStorage` if you tick **Remember on this device**. The browser connects straight to Deepgram with the key as a WebSocket `token` subprotocol; it never passes through Cue's server. If Deepgram rejects the key, the form reopens. Without a server key and without your own, **Start listening** opens the form (the token route answers 503).

## Scripts

| Command                           | What it does                                                                                                                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Dev server (also the only place the Training section appears)                                                                                                                                                                                      |
| `npm test`                        | Unit tests (Vitest)                                                                                                                                                                                                                                |
| `npm run test:watch`              | Unit tests in watch mode                                                                                                                                                                                                                           |
| `npm run eval`                    | Replay saved sessions and labeled training recordings; report fillers caught / missed / wrong                                                                                                                                                      |
| `npm run lint`                    | ESLint                                                                                                                                                                                                                                             |
| `npm run typecheck`               | Route type generation and `tsc --noEmit`                                                                                                                                                                                                           |
| `npm run format:check`            | Prettier check                                                                                                                                                                                                                                     |
| `npm run check`                   | Lint, typecheck, format check and tests, the same as CI                                                                                                                                                                                            |
| `npm run format`                  | Format with Prettier                                                                                                                                                                                                                               |
| `npm run build`                   | Production build                                                                                                                                                                                                                                   |
| `npm run cad`                     | Rebuild the 3D device (`public/cad/cue-bte.glb`) after the CAD changes. Accepts a zoo.dev GLB or STEP (`npm run cad -- in.glb`); by default reads `origin/hardware-rev0:hardware/rev0/democad.step`, so run `git fetch origin hardware-rev0` first |
| `python3 scripts/brand-assets.py` | Regenerate the interim logo and favicon rasters in `public/brand/` (needs Pillow and numpy)                                                                                                                                                        |

## How it works

```text
mic ──AudioWorklet (16 kHz PCM)──▶ Deepgram Flux (v2/listen, flux-general-en)
                                           │ timed words (updates every ~0.2 s)
                                           ▼
                                   parse (src/lib/deepgram/parse.ts)
                                           ▼
       CueSession: bone gate (wearer's words only) ─▶ detectors
         um/uh · like · lowkey · your words · pace · no pause · long turn · too quiet
                                           ▼
       DecisionEngine: pattern? confident? mode? gap since last tap? natural break?
                                           ▼
                                  haptic pattern (three cues)
```

| Path                                  | Role                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/cue/session.ts`              | Consumes streaming words, applies the bone gate, runs the detectors                         |
| `src/lib/cue/engine.ts`               | The decision engine: patterns, modes, gaps between taps, natural breaks, did-it-work checks |
| `src/lib/cue/likeClassifier.ts`       | Decides how each "like" is used (filler, quote, approximation, verb, comparison, …)         |
| `src/lib/cue/lowkeyClassifier.ts`     | Decides whether "lowkey" is a filler                                                        |
| `src/lib/cue/pace.ts`, `syllables.ts` | Rolling speaking rate                                                                       |
| `src/lib/cue/loudness.ts`             | Speech loudness, room noise and the too-quiet check                                         |
| `src/lib/cue/patterns.ts`             | The five haptic cues and the touch-control ramps                                            |
| `src/lib/cue/touch.ts`                | Touch gestures (hold = on/off, double-tap = mode)                                           |
| `src/lib/cue/evaluate.ts`             | Scores saved sessions and training recordings for `npm run eval`                            |
| `src/lib/cue/config.ts`               | Defaults and mode presets                                                                   |
| `src/lib/deepgram/liveTranscriber.ts` | Mic capture and Deepgram WebSocket client                                                   |
| `public/pcm-worklet.js`               | AudioWorklet that turns mic audio into 16 kHz PCM                                           |
| `src/app/api/deepgram-token/route.ts` | Mints 30 s Deepgram tokens from the server's key; 503 when the server has none              |
| `src/app/api/training/route.ts`       | Saves training recordings to `training/` (local development only)                           |
| `src/app/CueApp.tsx`                  | The UI                                                                                      |
| `src/app/DeviceModel.tsx`             | The 3D device, with haptics drawn as rings from the motor                                   |
| `scripts/cad-to-glb.mjs`              | Converts the device CAD (zoo.dev GLB or STEP) into `public/cad/cue-bte.glb`                 |
| `scripts/brand-assets.py`             | Builds the interim logo rasters from the approved concept                                   |

## Privacy

Live mode sends microphone audio to Deepgram for transcription. This is a disclosed exception for the MVP; the product is meant to move to on-device or phone-local recognition before launch ([`CUE_CONTEXT.md`](CUE_CONTEXT.md) §26, decision 9). Cue itself stores nothing on a server: no audio, transcripts, or events leave the browser tab except as an explicit **Download session** file. What stays in your browser: your own Deepgram key if you entered one (see above) and one volume number per mode if you calibrated. **Training recordings** are opt-in, only possible under `npm run dev`, and are written to `./training/` on your machine (git-ignored). Don't commit session files or training recordings; they contain transcripts and audio.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE).
