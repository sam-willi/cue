# Continuous learning

> Decision 27 in [`CUE_CONTEXT.md`](../CUE_CONTEXT.md) §26, 2026-10-16. Every threshold below is a **working assumption**: the learning has been exercised on simulated speakers and on synthetic speech through Deepgram, not yet on real wearers.

Cue learns each wearer across sessions and changes how it coaches them. The aim isn't to collect more data about someone's habits; it's for each session to coach better than the last because of what earlier sessions showed.

```text
 OBSERVE        DISCOVER          REMEMBER        ADAPT                 EVALUATE                  IMPROVE
 session  ──▶  patterns across ─▶ profile in ──▶ coaching plan ──▶ taps vs. holdouts,     ──▶ adopt what works,
 digest        sessions           the browser    (live engine       strategy A vs. B          step back, new focus
 (numbers)     (sign tests)                       reads it)          across sessions
     ▲                                                                                              │
     └──────────────────────────────── next session is coached with the new plan ◀──────────────────┘
```

## The pieces

| Component                      | Where                                                             | What it does                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal communication profile | `src/lib/learning/types.ts`, `store.ts`                           | Versioned, in `localStorage` (`cue.learning.v1`). Session digests, every tap and holdout with its before and after, patterns, preferences, experiments, adaptations, the timeline, Cue updated moments, the focus, and the current plan.                                                                                               |
| Observation                    | `digest.ts`, `live.ts`                                            | When a session ends: pace (median, share rushing, first minute against the rest, steadiness in long against short turns), fillers (per minute, by word, at the start of a turn, while faster than usual, first against second half), pauses, turns, restarts ("I think I think"), and short phrases said 3+ times. Words are not kept. |
| Pattern discovery engine       | `patterns.ts`                                                     | Each pattern is a comparison inside each session, checked across sessions with a sign test: at least 3 sessions, 75% agreeing, p ≤ 0.13. Filler patterns also need 6+ pooled fillers and a binomial test (p ≤ 0.05) against the share of time. Patterns that stop holding are marked stale.                                            |
| Adaptive coaching engine       | `coaching.ts` → `src/lib/cue/plan.ts` → `engine.ts`, `session.ts` | Derives the plan from the profile. Each personalized value carries its reason; comparing the plan before and after gives the adaptations, so every "what I changed" is a real difference in the next session.                                                                                                                          |
| Feedback evaluation system     | `evaluation.ts`                                                   | Taps against holdouts (Beta posteriors), session metrics across strategies (experiments), progress against the wearer's first sessions.                                                                                                                                                                                                |
| Learning event history         | `learn.ts` (`events`, `adaptations`, `updates`)                   | Everything Cue discovered and changed, with why, on two tracks: how you improved, how Cue improved.                                                                                                                                                                                                                                    |
| Personal memory interface      | `src/app/learning/`                                               | Your focus, Cue updated cards, the post-session check-in, What Cue has learned (A patterns, B preferences, C how Cue adapted), the learning timeline, and data controls.                                                                                                                                                               |

## What changes Cue's coaching, exactly

| Cause                                                                                                                                                           | Change in the live engine                                                                                                                                                                                   | When                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| A session with 60 s+ of measurable pace                                                                                                                         | Rushing is judged against your pace in that mode (median of your recent sessions × 1.2, or × 1.1 presenting) from the first word, not after a minute of each session. Moves only if the baseline moves 4%+. | Next session (provisional until 3) |
| You rate a cue "Too many" or "Distracting"                                                                                                                      | That behavior taps 1.6× less often in that mode, and switches to its alternative strategy (rushing: only after 8 s; fillers: rate only; no pause: 10 s more).                                               | Immediately                        |
| "Distracting" in 2+ sessions                                                                                                                                    | Inferred preference for gentle taps (shorter pulses here; amplitude on the device). Marked as inferred until you confirm.                                                                                   | Immediately                        |
| You ask not to be coached on something (in a mode or anywhere)                                                                                                  | That behavior never taps there; detections are logged as "you asked Cue not to coach this".                                                                                                                 | Immediately                        |
| You set a priority, or choose a focus                                                                                                                           | The focus decides first when several cues are due, other habits tap 1.3× less often; conciseness lowers the long-turn limit to 60 s.                                                                        | Immediately                        |
| 3+ sessions and 5+ minutes (returning wearer)                                                                                                                   | About 1 in 5 due taps (1 in 7 for the focus) is held back at random, to measure what happens without a tap.                                                                                                 | From session 4                     |
| Taps don't beat holdouts (8+ taps, 4+ holdouts, P(tap better) < 0.75, difference < 15 points)                                                                   | Sessions alternate between the current strategy and the alternative.                                                                                                                                        | Next session                       |
| The alternative does as well (metric within tolerance) with fewer taps, fewer complaints or taps that work more often, or clearly better, over 3+ sessions each | The alternative is adopted. Otherwise Cue goes back.                                                                                                                                                        | After the comparison               |
| A behavior improved 40%+ against your first three sessions, all of the last three better                                                                        | Cue steps back: 1.5× fewer taps, more holdouts.                                                                                                                                                             | Next session                       |
| …then slipped back for three sessions                                                                                                                           | Support returns.                                                                                                                                                                                            | Next session                       |
| The focus improved 30%+ with each of the last 3 sessions better than its start (4+ sessions on it)                                                              | A new focus (a habit that stands out, or intentional pauses as a new skill). Switched automatically only if Cue chose the last one.                                                                         | Next session                       |
| You reject a pattern or inferred preference, or say "That's not right" on an update                                                                             | What it caused is undone, and logged with your correction as the reason.                                                                                                                                    | Immediately                        |

Inferred changes need several sessions; what the wearer says applies at once. Patterns that are only observations ("you often say 'most of'") don't change coaching.

**Why holdouts.** A wearer often slows down or stops filling on their own, so "they slowed down after the tap" proves nothing. Cue only credits a tap with the difference between what happens after taps and after randomly held-back taps (CUE_CONTEXT §7, policy 6). In the simulated scenario, prompt slow-down taps were followed by slowing down 79% of the time, and holdouts 75%: almost all of that was bursts ending anyway.

## The two-session demonstration

`src/lib/learning/__tests__/scenarios.test.ts` runs simulated speakers through the real `CueSession`:

- **Same speech twice.** A naturally quick talker (about 215 words a minute, steady) is tapped "slow down" in session 1 before Cue has learned their pace; in session 2, with the same speech, Cue knows their pace from the start and doesn't tap.
- **Same speech twice, after feedback.** A wearer who rushes in bursts rates slow-down taps "too many"; in session 2 Cue taps only for the longer bursts.
- **Correction.** Rejecting "Your natural pace is about 196 words a minute" brings the taps back in session 3.
- **Twenty sessions.** Holdouts reveal prompt slow-down taps aren't helping this speaker, Cue alternates strategies, then adopts the sparser one once it does as well with fewer taps.

The same simulations are in the app under **What Cue has learned → Practice sandbox**, in a separate memory. The simulated speaker reacts to taps by a stated rule (`src/lib/learning/simulate.ts`); it shows how Cue's learning behaves, not how people do.

## Privacy

- Stored in this browser only, under its own keys; nothing is sent to a server.
- Numbers per session, the filler words themselves, and up to five short phrases said three or more times. No audio, no transcripts.
- Real sessions and simulated or practice ones are in separate memories.
- The wearer can pause learning, switch off holdouts, forget a session, delete or correct any preference or pattern, and reset everything.

## Not done yet

- **Real wearers.** Nothing here is validated on people. The thresholds, the holdout rate, and the strategies are starting points.
- **Hardware.** Tap strength is shortened pulses in the browser; real intensity needs the DRV2605L's amplitude control over Web Bluetooth. Bone-sensor gating of what counts as the wearer's speech applies once the device exists.
- **Sync.** The profile lives in one browser; there's no account or cross-device sync, export, or server.
- **Contexts.** Session kinds come from the wearer's tag after a session; Cue doesn't detect a question being asked (turn starts stand in for "answering").
- **Repetition** is observed and can be a focus, but isn't tapped live (decision 15).
- **Machine learning.** None: sign tests, binomial tests, Beta posteriors and rules. A learned per-person policy would need far more data than a few sessions give.
