# Cue

**Speak with intention.** Cue is a discreet ear-cuff speech coach that gives a private haptic tap when you use a filler word or start rushing, so you notice the habit in the moment and replace it with a pause.

This repository is the **software MVP**: a web app that listens through the microphone, detects fillers and fast speech in real time, and shows an on-screen haptic cue in place of the hardware. Product context, confirmed decisions, and open questions live in [`CUE_CONTEXT.md`](CUE_CONTEXT.md). Read it before proposing changes.

> Status: prototype for validating the behavior loop. Not a medical device. Detection accuracy has not been measured on real users yet.

## What it detects

| Behavior                              | How                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "um", "uh"                            | Deepgram streaming ASR with `filler_words=true` (most engines silently drop these)                                                                                                                      |
| Filler "like"                         | Rules over neighbouring words, part-of-speech tags, punctuation and pauses. "I like went to the mall" cues; "I like tofu" doesn't. Ambiguous cases never cue, and every decision has a readable reason. |
| Quote "like" ("she was like, no way") | On by default, toggle in Settings                                                                                                                                                                       |
| "About" "like" ("like twenty people") | Off by default, toggle in Settings                                                                                                                                                                      |
| Speaking too fast                     | Syllables per second over a rolling 8 s window, long pauses excluded, sustained for 3 s. Presets: Conversation 4.5 syl/s (≈190 wpm), Presentation / interview 4.0 syl/s (≈170 wpm).                     |

Cues are fast: "um"/"uh" cue on the first confident result, and a clear filler "like" cues as soon as the next word is heard. Ambiguous cases wait for more words. Each cue's measured delay appears in the app.

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
- **Start listening** streams your mic to Deepgram for live detection.
- **Mark mistakes**: click a word in the transcript, or use the buttons in "Why Cue acted", to flag a wrong buzz or a missed filler.
- **Download session** (after a live session) saves the words and timings Deepgram heard, your corrections and cue delays (no audio). Put the files in `sessions/` and run `npm run eval`.

## Scripts

| Command          | What it does                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `npm run dev`    | Dev server                                                                   |
| `npm test`       | Unit tests (Vitest)                                                          |
| `npm run eval`   | Replay saved sessions in `sessions/` and score them against your corrections |
| `npm run check`  | Lint, typecheck, format check and tests, the same as CI                      |
| `npm run format` | Format with Prettier                                                         |
| `npm run build`  | Production build                                                             |

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
| `src/app/api/deepgram-token/route.ts` | Mints 30 s Deepgram tokens so the API key never reaches the browser                 |
| `src/app/CueApp.tsx`                  | The UI                                                                              |

## Privacy

Live mode sends microphone audio to Deepgram for transcription. Cue itself stores nothing: no audio, transcripts, or events leave the browser tab except as an explicit **Download session** file. Don't commit session files; they contain transcripts.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE).
