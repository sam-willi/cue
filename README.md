# Cue

**Speak with intention.** Cue is a discreet ear-cuff speech coach that gives a private haptic tap when you use a filler word or start rushing, so you notice the habit in the moment and replace it with a pause.

This repository is the **software MVP**: a web app that listens through the microphone, detects fillers and fast speech in real time, and shows an on-screen haptic cue in place of the hardware. Product context, confirmed decisions, and open questions live in [`CUE_CONTEXT.md`](CUE_CONTEXT.md). Read it before proposing changes.

> Status: prototype for validating the behavior loop. Not a medical device. Detection accuracy has not been measured on real users yet.

## How Cue decides to tap

Cue is a behavioral coach, not a filler counter ([`SOFTWARE.md`](SOFTWARE.md)). Detectors notice fillers, repetition, pace, pauses, turn length and volume; a **decision engine** (`src/lib/cue/engine.ts`) asks whether a tap would help right now:

- **Patterns, not single fillers:** 3 fillers or accidental repeats within 12 s, or 8 in a minute. One “um” is normal. (Settings has an "every filler" testing mode.)
- **Pace against your own normal**, learned from your first minute of speech (20% faster in Conversation, 10% in Presentation).
- **No pause for 30 s**, and **a speaking turn over 90 s** ("give the other person space").
- **One tap at a time:** a 15 s gap after any tap; sustained behaviors wait for a natural break so the tap doesn't land mid-word.
- **Did it work?** 8 s after each tap Cue checks whether you paused, slowed down, stopped the fillers or spoke up, and gives more room next time if you did. Review shows "tapped: 3 in 9 s, and it worked".

## What it detects

| Behavior                              | How                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "um", "uh"                            | Deepgram **Flux** streaming ASR (results every ~0.2 s, keeps fillers; Nova-3 drops most fillers live)                                                                                                                                                                                                                                           |
| Filler "like"                         | Rules over neighbouring words, part-of-speech tags, punctuation and pauses. "I like went to the mall" cues; "I like tofu" doesn't. Ambiguous cases never cue, and every decision has a readable reason.                                                                                                                                         |
| Quote "like" ("she was like, no way") | On by default, toggle in Settings                                                                                                                                                                                                                                                                                                               |
| "About" "like" ("like twenty people") | Off by default, toggle in Settings                                                                                                                                                                                                                                                                                                              |
| Speaking too fast                     | Syllables per second over a rolling 8 s window, long pauses excluded, sustained for 3 s. Presets: Conversation 4.5 syl/s (≈190 wpm), Presentation / interview 4.0 syl/s (≈170 wpm).                                                                                                                                                             |
| Speaking too quietly                  | Mic level measured only while you're saying words, compared with your own normal level (learned from your first 15 s of speech) and adjusted for room noise (people naturally speak ~0.6 dB louder per dB of noise). Cues after ~3 s at 6 dB or more below that. Gain control and noise suppression are off so the measurement isn't distorted. |

Each alert has its own haptic rhythm: **one tap** = filler (pause), **two taps** = too fast (slow down), **long pulse** = too quiet (speak up). A setting switches to one tap for everything. Cues are fast: "um"/"uh" cue on the first confident result, and a clear filler "like" cues as soon as the next word is heard. Ambiguous cases wait for more words. Each cue's measured delay appears in the app.

**Cuff touch controls (simulated in the app).** The cuff's touch surface is for controls only: **hold 1.5 s** = Cue on/off, **double-tap** = switch Conversation / Presentation mode. A single tap or a lingering touch does nothing, so adjusting your hair or glasses won't trigger it. Confirmations are swelling or fading _ramps_, never taps, so they can't be mistaken for a coaching cue.

**Only the wearer is coached, by hardware.** On the cuff, a bone-conduction sensor confirms when you're the one speaking; the microphone (which hears everyone) feeds speech-to-text; a vibration motor behind the ear taps. Cue coaches only words the bone sensor confirms. This web prototype has no bone sensor, so it treats all speech as yours; Practice can simulate a friend cutting in.

A cue is withheld when confidence is too low, within the cooldown after the last cue, while muted, or when its category is off. Withheld detections still show in the app's "Why Cue acted" log.

## Quick start

Requires Node 24 (see `.nvmrc`) and a [Deepgram](https://console.deepgram.com) API key with the **Member** role or higher.

```bash
npm install
cp .env.local.example .env.local   # paste your Deepgram key
npm run dev
```

Open http://localhost:3000.

- **Try a sentence** plays typed text through the same detector. It doesn't need a key.
- **Start listening** streams your mic to Deepgram for live detection. With no `DEEPGRAM_API_KEY` on the server (e.g. a public demo), visitors can choose **Use your own Deepgram key**: the key stays in their browser (this tab, or this device if they choose) and connects straight to Deepgram, never through Cue's server.
- **Mark mistakes**: click a word in the transcript, or use the buttons in "Why Cue acted", to flag a wrong buzz or a missed filler.
- **Download session** (after a live session) saves the words and timings Deepgram heard, your corrections and cue delays (no audio). Put the files in `sessions/` and run `npm run eval`.

## Scripts

| Command          | What it does                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`    | Dev server                                                                                                                                                   |
| `npm test`       | Unit tests (Vitest)                                                                                                                                          |
| `npm run eval`   | Replay saved sessions and labeled training recordings; report fillers caught / missed / wrong                                                                |
| `npm run cad`    | Rebuild the 3D cuff on the page (`public/cad/cue-cuff.glb`) from the STEP on the `hardware-rev0` branch (`hardware/rev0/democad.step`) after the CAD changes |
| `npm run check`  | Lint, typecheck, format check and tests, the same as CI                                                                                                      |
| `npm run format` | Format with Prettier                                                                                                                                         |
| `npm run build`  | Production build                                                                                                                                             |

## How it works

```text
mic ──AudioWorklet (16 kHz PCM)──▶ Deepgram live (nova-3, filler_words)
                                           │ timed words (interim + final)
                                           ▼
                         CueSession ── um/uh ─────────┐
                                    ── likeClassifier ┼─▶ policy ─▶ buzz
                                    ── pace ──────────┘   (confidence, cooldown,
                                                           mute, categories)
```

| Path                                  | Role                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/lib/cue/likeClassifier.ts`       | Decides how each "like" is used (filler, quote, approximation, verb, comparison, …) |
| `src/lib/cue/session.ts`              | Consumes streaming words, runs detectors, applies the intervention policy           |
| `src/lib/cue/pace.ts`, `syllables.ts` | Rolling speaking rate                                                               |
| `src/lib/cue/config.ts`               | Defaults and pace presets                                                           |
| `src/lib/deepgram/liveTranscriber.ts` | Mic capture and Deepgram WebSocket client                                           |
| `src/app/api/deepgram-token/route.ts` | Mints 30 s Deepgram tokens so the server's key never reaches the browser            |
| `src/app/CueApp.tsx`                  | The UI                                                                              |

## Privacy

Live mode sends microphone audio to Deepgram for transcription. Cue itself stores nothing: no audio, transcripts, or events leave the browser tab except as an explicit **Download session** file. Don't commit session files; they contain transcripts.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE).
