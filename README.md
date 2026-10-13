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
- **Pace against your own normal.** Rushing starts at the preset and, after your first minute of speech, becomes 20% (Conversation) or 10% (Presentation) over your own pace, never below 3.6 syl/s and never above 6 syl/s (about 250 words a minute), so a session that opens with very fast talking can't teach Cue that it is normal. A pace just over the limit has to hold for 3 s; at 1.25 times the limit or more, 1.5 s is enough.
- **Sustained behaviors wait for a natural break** (up to 3 s; 1 s for rushing, since someone racing ahead rarely leaves one) so the tap doesn't land mid-word.
- **Did it work?** 8 s after each tap Cue checks whether you paused, slowed down, stopped the fillers or spoke up, and gives more room next time if you did. Review shows "tapped: 3 in 9 s, and it worked".

## What it detects

| Behavior                              | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "um", "uh" (also "er", "erm", "ah")   | Deepgram **Flux** streaming ASR (results every ~0.2 s, keeps fillers; Nova-3 drops most fillers live). "hmm" is not counted: it's often a listening sound.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Filler "like"                         | Rules over neighbouring words, part-of-speech tags, punctuation and pauses. "I like went to the mall" counts; "I like tofu" doesn't. Ambiguous cases never count, and every decision has a readable reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Quote "like" ("she was like, no way") | On by default, toggle in Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| "About" "like" ("like twenty people") | Off by default, toggle in Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Filler "lowkey"                       | Its own classifier (`lowkeyClassifier.ts`): "it's lowkey good" counts; "keep it low-key" doesn't.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Speaking too fast                     | Syllables per second over a rolling 8 s window, pauses over 0.6 s excluded, sustained for 3 s. Thresholds above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| No pause                              | Time since your last meaningful pause. A pause is a gap of 0.6 s or more between your words, or the same length of real silence in the mic audio (Silero voice detection, `src/lib/audio/voiceDetector.ts`): word timings from the transcript drift, so either counts. If the voice detector can't load, word timing is used alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Long turn                             | How long your current speaking turn has run ("give the other person space"). Conversation only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Speaking too quietly (calibrated)     | You set the target with a short read-aloud (**Set my volume**) for each mode, saved on this device only as one loudness number per mode (no audio). Mic level is K-weighted (the ITU-R BS.1770 filter, so low rumble doesn't count) and measured only while you're actually voicing a word: inside a word's time span from the transcript, and where the voice detector heard a voice (the "active speech level" idea from ITU-T P.56). It is and adjusted for room noise (0.6 dB per dB of noise change, capped at ±10 dB). Without a calibration for the current mode, too-quiet cues are off and the app asks you to set it. A **Volume feedback** switch per mode turns volume coaching off entirely, so you never have to set a volume for that mode (saved on this device). Gain control and noise suppression are off so the measurement isn't distorted. |

"um"/"uh" are detected on the first confident result (confidence ≥ 0.8), and a clear filler "like" as soon as the next word is heard; ambiguous cases wait for more words. Detection is not the same as a tap: taps follow the pattern rules above. Each cue's measured delay appears in the app.

### Three cues

Live, Cue only ever asks for three things (decision 18). Every cue starts with a sharp onset (`src/lib/cue/patterns.ts`).

| Cue       | Haptic                                         | When                                                        |
| --------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Pause     | One tap (50 ms)                                | No pause for a while, a long turn, or a run of filler words |
| Slow down | Slow steps (three 100 ms pulses, 250 ms apart) | Rushing                                                     |
| Speak up  | Long push (450 ms)                             | Too quiet                                                   |

On screen, each cue is drawn as rings leaving the motor on the 3D device. A faint gray ring means "noticed, not a pattern yet", a testing aid.

**Your own filler words.** In Settings you can add up to 20 words or short phrases you lean on ("so", "basically", "you know"). Cue counts one every time it's said (there's no check of how it was used, unlike "like"), and they feed the same pattern rules as the built-in fillers. The list is saved on this device. The list is also sent to Deepgram as "keyterms", words to listen for specially, so they are transcribed more reliably.

### Session report

When a session ends, the app builds a report (decision 19, `src/lib/cue/report.ts`, drawn by `src/app/ReportView.tsx`): a **Speak score**, up to three things to work on, then one card per area.

**Speak score (decision 25).** One number out of 100 with a level (Very low, Low, OK, High, Very high), built from points per area the way a sleep score is: pace 30, pauses 25, filler words 25, volume 10, pitch 10. Each area earns points on a sliding scale, not pass or fail. An area that couldn't be measured (no microphone, no volume set) is left out and the rest are scaled to 100. Fillers at or under two a minute earn full points, so it is not a test of saying none. It needs about 30 seconds of talking. Reading from notes and wording are not scored.

**Graphics.** Pace is a line over the comfortable range with any rushing picked out; pauses are a strip of the session where each bar is a stretch of talking and each gap a pause; pitch is a contour around your typical pitch; fillers are bars; volume and reading from notes are meters with the line worth working on marked. **Color (decision 26).** Each scored area has its own vivid color wherever it appears (its ring segment, icon, chart and technique), in rainbow order round the ring: pauses red, pace orange, volume green, filler words blue, pitch violet. Colors are used at full strength on gray, with no pale washes. Color says which area, never good or bad. The part worth working on is drawn in ink, so it stands apart from every hue for any kind of color vision. The colors are tokens in `globals.css` (`--area-*`), with brighter steps for dark mode. Each area has a **technique** (decision 24): one physical action plus a drill, such as "Land the last word" for rushing. It is written out in full under "Work on next" for the areas that need work, and every card has it one press away, so it can be read even when a session flagged nothing. It appears under **Speaking insights**. The button of the same name beside Start listening opens it and scrolls to it; while a session is running the button reads "Stop and see insights" and ends the session first.

| Area               | What it reports                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pauses             | How often you paused and your longest stretch without one.                                                                                                                                                    |
| Pace               | Average and fastest words per minute, the share of the session spent rushing, a chart of pace from start to finish, and what you were saying where you sped up: up to three quoted passages with their times. |
| Volume             | How much of the session you spent well below the volume you set (needs a set volume).                                                                                                                         |
| Filler words       | Fillers per minute and a count of each word, including your own. If you leaned on a common habit word that isn't on your list ("basically", "you know"), the report offers to add it.                         |
| Pitch and tone     | How much your pitch moved, from the microphone (`src/lib/cue/pitch.ts`, using the pitchy library). Under 2 semitones of spread reads as flat.                                                                 |
| Reading from notes | If you paste your notes or script, the share of your talk that matched them word for word (runs of 5+ words). Notes stay in the browser tab.                                                                  |
| Inclusive language | Terms from a list of about 570 (`src/lib/cue/inclusive.ts`), each with an alternative. Most come from retext-equality, cut down to what suits speech by `scripts/build-inclusive.mjs`.                        |

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

## Landing pages

Five pages for a painted-door test, one per market, at `/for/<market>`: `speaking`, `sales`, `schools`, `english` and `interviews`. They share one layout (`src/app/for/[market]/page.tsx`) and differ only in copy (`src/lib/landing/markets.ts`). Search engines are asked not to index them, so visits come from ads.

The photos are panels cut from one product concept sheet, [`assets/product/cue-concept-sheet.webp`](assets/product/cue-concept-sheet.webp), by `node scripts/landing-images.mjs`, which writes them to `public/landing/`. The sheet is the owner's image and is kept in the repo so other pages and materials can use it.

Each page has a sign-up form. A sign-up records the market, the email, and the `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_term` tags on the page address, so tag each ad's link (`/for/sales?utm_source=meta&utm_campaign=sales-a`). The schools page asks for a pilot; the school is an optional field, so an email alone is enough. On every page the email field and button come first in the form, so they show on a phone without scrolling.

**Where sign-ups go.** A Google Sheet with one tab per landing page (Speaking, Sales, Schools, English learners, Interviews), through a small script that lives in the sheet:

1. Create a Google Sheet. Open **Extensions → Apps Script**, replace the editor's contents with [`scripts/signups-sheet.gs`](scripts/signups-sheet.gs), and save.
2. Optional: choose `setup` in the editor's function menu and press **Run** to create the five tabs now. Otherwise each tab appears when its page gets its first sign-up.
3. **Deploy → New deployment → Web app**. Set **Execute as** to _Me_ and **Who has access** to _Anyone_, deploy, and approve the access prompt. Copy the web app URL (it ends in `/exec`).
4. In Vercel, add that URL as the environment variable `SIGNUPS_SHEET_URL` (Project → Settings → Environment Variables), then redeploy.

Each sign-up is added as a row on its page's tab within a second or two of the visitor pressing the button. A sign-up from a page the script doesn't list goes to a tab called Other, so add new pages to `TABS` at the top of the script. Anyone with the URL can add rows, so treat it like a password: it stays in Vercel and is never sent to the browser. If you change the script later, publish it with **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

Without `SIGNUPS_SHEET_URL`, `npm run dev` saves sign-ups to `./signups/signups.jsonl` (git-ignored), and a deployed site tells the visitor it couldn't save and keeps nothing.

**Counting visits.** The landing pages load [Vercel Web Analytics](https://vercel.com/docs/analytics) (`<Analytics />` in `src/app/for/[market]/page.tsx`), so the project's **Analytics** tab in Vercel shows visitors and page views per page. Turn it on once under Project → Analytics → Enable. It uses no cookies, counts nothing under `npm run dev`, and is not loaded on the coaching app at `/`. Compare each page's visitors with the rows on its tab in the sheet to get a sign-up rate.

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
| `npm run build`                   | Production build. Like `npm run dev`, it first copies the voice detector's runtime and model into `public/vad/` (`scripts/copy-vad-assets.mjs`)                                                                                                    |
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

## Open-source pieces

| Piece                                                                                                                         | Used for                                                                                               | License   |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------- |
| [Silero VAD](https://github.com/snakers4/silero-vad) model, shipped by [@ricky0123/vad-web](https://github.com/ricky0123/vad) | Hearing real pauses in the mic audio                                                                   | MIT / ISC |
| [onnxruntime-web](https://github.com/microsoft/onnxruntime)                                                                   | Running that model in the browser (about 14 MB, fetched from this site when listening starts)          | MIT       |
| [libebur128](https://github.com/jiixyj/libebur128) and [pyloudnorm](https://github.com/csteinmetz1/pyloudnorm)                | Reference for the K-weighting formulas in `src/lib/cue/loudness.ts` (no code copied, not a dependency) | MIT       |
| [pitchy](https://github.com/ianprime0509/pitchy)                                                                              | Voice pitch for the report                                                                             | 0BSD      |
| [retext-equality](https://github.com/retextjs/retext-equality)                                                                | Source of most of the inclusive-language list (build time only)                                        | MIT       |
| [compromise](https://github.com/spencermountain/compromise)                                                                   | Part-of-speech tags for the "like" rules                                                               | MIT       |

## Privacy

Live mode sends microphone audio to Deepgram for transcription. This is a disclosed exception for the MVP; the product is meant to move to on-device or phone-local recognition before launch ([`CUE_CONTEXT.md`](CUE_CONTEXT.md) §26, decision 9). The coaching app stores nothing on a server: no audio, transcripts, or events leave the browser tab except as an explicit **Download session** file. The landing pages are separate: a sign-up sends the email address, market and ad tags to the sign-up sheet, and each visit is counted by Vercel Web Analytics without cookies (see Landing pages). What stays in your browser: your own Deepgram key if you entered one (see above) and one volume number per mode if you calibrated. **Training recordings** are opt-in, only possible under `npm run dev`, and are written to `./training/` on your machine (git-ignored). Don't commit session files or training recordings; they contain transcripts and audio.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues privately as described in [SECURITY.md](SECURITY.md).

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE).
