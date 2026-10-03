# Cue — software MVP

Real-time detection of filler words ("um", "uh", filler "like") and fast speech, with an on-screen haptic buzz. See `CUE_CONTEXT.md` for the product context.

## Run

```bash
npm install
cp .env.local.example .env.local   # add a Deepgram key with the Member role or higher
npm run dev
```

Open http://localhost:3000. **Try a sentence** works without a key; **Start listening** streams the mic to Deepgram (`nova-3`, `filler_words=true`).

## How detection works

- `src/lib/cue/likeClassifier.ts` — decides how each "like" is used from neighbouring words, part-of-speech tags, commas and pauses. Ambiguous cases are never cued (precision over recall). Every decision carries a human-readable reason.
- `src/lib/cue/session.ts` — consumes streaming words, detects um/uh/like and pace, and applies the intervention policy (confidence threshold, cooldown, mute, per-category toggles).
- `src/lib/cue/pace.ts` — rolling words-per-minute, excluding long pauses.
- `src/app/api/deepgram-token/route.ts` — mints a 30-second Deepgram token so the API key never reaches the browser.

## Test

```bash
npx vitest run
```
