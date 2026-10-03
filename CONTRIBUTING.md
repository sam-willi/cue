# Contributing to Cue

## Ground rules

- Read [`CUE_CONTEXT.md`](CUE_CONTEXT.md) first. Preserve **[CONFIRMED]** decisions; if a change alters one, update that file in the same PR with the date and rationale.
- **Precision over recall.** A false buzz costs more trust than a missed filler. When a rule is unsure, it should not cue.
- **Every decision is explainable.** Detection rules return a human-readable reason; keep it that way.
- **Never commit secrets or speech data**: no `.env.local`, API keys, session downloads, recordings, or transcripts.

## Workflow

1. Branch from `main` (`git checkout -b short-description`).
2. Make the change with tests.
3. Run `npm run check` (lint, typecheck, format check, tests). CI runs the same checks plus a build.
4. Open a PR using the template. `main` is protected: changes land through PRs with passing CI.

## Fixing a detection miss

1. Reproduce it as a test. Add the phrase to the `FILLER` or `SEMANTIC` table in `src/lib/cue/__tests__/likeClassifier.test.ts`, or a streaming case to `session.test.ts`.
2. Watch it fail (`npm run test:watch`).
3. Adjust the rule in `src/lib/cue/likeClassifier.ts` (or a word list in `lexicon.ts`). Keep the rule's `reason` string accurate.
4. Make sure all existing cases still pass. A fix that causes a false buzz elsewhere isn't a fix.

### Checking against real sessions

1. During a live session, click words in the transcript to mark wrong buzzes and misses, then **Download session**.
2. Move the file into `sessions/` (git-ignored; session files contain transcripts and must never be committed).
3. Run `npm run eval`. It replays each session through the current rules and reports which marked mistakes are still wrong, plus false buzzes per speaking hour.
4. After changing a rule, run it again. The goal is fewer "still firing" and "still missed" without new ones elsewhere.

## Troubleshooting

**`Cannot find native binding` when running tests.** This is an npm optional-dependency bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) that can happen after `npm install <pkg>`. Fix with:

```bash
rm -rf node_modules package-lock.json && npm install
```

**"API key needs the Member role" in the app.** Create a Deepgram key with the Member role or higher; default-role keys can't mint browser tokens.
