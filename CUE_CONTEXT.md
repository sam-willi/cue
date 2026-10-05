# Cue — Canonical Product Context

> **Purpose:** This document is the canonical source of truth for coding, hardware, design, research, marketing, and strategy agents working on Cue. Software behavior is specified in [`SOFTWARE.md`](./SOFTWARE.md); visual design in [`DESIGN.md`](./DESIGN.md). Read it before proposing or implementing work. If another artifact conflicts with this one, use this document unless a human owner explicitly supersedes it.
>
> **Last updated:** 2026-10-03 (see §26 Decision log)  
> **Maturity:** Product concept / validation and prototyping  
> **Not a claim of:** production readiness, medical efficacy, patent clearance, manufacturability, or validated technical feasibility.

## 1. Decision-status legend

Every material statement should be interpreted using these labels:

- **[CONFIRMED]** — A product decision explicitly made in the founding conversation. Treat as a requirement unless a human owner changes it.
- **[WORKING ASSUMPTION]** — A useful current direction that has not yet been validated. Build so it can be tested or changed.
- **[OPEN QUESTION]** — Unresolved; do not silently choose an answer if the choice materially affects product scope, hardware, privacy, cost, or user experience.
- **[RESEARCH CONTEXT]** — Evidence or background that motivates the product but is not itself a Cue product decision.

## 2. Product in one paragraph

**[CONFIRMED]** Cue is a discreet, single-ear **ear-cuff wearable speech coach** that helps people reduce habitual filler words such as “like,” “um,” and “uh,” slow rushed speech, use better pauses, and build speaking confidence. Its defining experience is real-time, subtle haptic feedback during actual speech: Cue notices a relevant speech behavior, privately taps the wearer, and helps them replace the habit with a calm pause or slower delivery. Cue is not meant to make people sound scripted or eliminate every natural disfluency. It should help users keep their personality while sounding more intentional.

**Core promise:** Notice the habit while it is happening, practice a better response, and gradually need less help.

**Simple positioning:** “Stop saying ‘like.’ Then learn to speak with fewer fillers, better pauses, and more confidence.”

**Working tagline:** “Speak with intention.”

## 3. Product vision

### Confirmed direction

- **[CONFIRMED]** Cue is a behavior-training product, not merely a speech analytics dashboard or filler counter.
- **[CONFIRMED]** The hero feature is: detect a true filler in real time and provide a private haptic cue.
- **[CONFIRMED]** Cue also addresses rushing, inadequate pauses, and repetitive speaking patterns.
- **[CONFIRMED]** It is designed for real conversations and high-stakes moments, not only scripted practice sessions.
- **[CONFIRMED]** The desired long-term outcome is learning and independence. Intervention should decrease as the user improves.
- **[CONFIRMED]** Occasional filler words are normal. “Zero fillers” is not the product goal.

### Vision statement

Cue should make invisible speaking habits perceptible at the moment they occur. A small, well-timed tap creates awareness without publicly interrupting the wearer. With repeated use, the user learns to recognize the same moment independently and substitute a more effective response—usually a pause, a breath, or a slower start. The product succeeds when the behavior persists during periods with little or no feedback.

### Product hierarchy

1. **[CONFIRMED] Real-time filler detection** — the magical, instantly understandable feature.
2. **[CONFIRMED] Context awareness** — distinguish filler usage from meaningful usage.
3. **[CONFIRMED] Discreet haptic feedback** — usable in ordinary social and professional situations.
4. **[CONFIRMED] Adaptive intervention** — do not buzz for every event forever.
5. **[CONFIRMED] Replacement behavior** — help the user pause, breathe, formulate, or slow down.
6. **[CONFIRMED] Progress and self-awareness** — show improvement and self-correction, not only mistakes.
7. **[CONFIRMED] Fading and retention** — withdraw help and test whether learning remains.

## 4. Target users and use cases

### Primary target

**[WORKING ASSUMPTION]** Initial users are teens and young adults who are self-conscious about fillers or rushed speech and care about sounding confident in important situations. The visual identity should feel Gen Z–relevant without becoming childish, meme-heavy, or short-lived.

Likely early adopter segments:

- Students giving presentations, participating in class, interviewing, or networking.
- Job candidates preparing for and participating in interviews.
- Founders pitching, fundraising, or speaking with customers.
- Salespeople, recruiters, and customer-facing professionals.
- Content creators, podcasters, and streamers.
- People who ramble or speed up when nervous.
- People who specifically want to reduce habitual “like,” “um,” “uh,” “so,” or “you know.”
- People who have tried recording/practice apps but want help during live speech.

### Core use cases

- **Everyday training:** Wear Cue during normal conversations and receive sparse, private cues.
- **High-stakes mode:** Use during an interview, pitch, presentation, date, meeting, or networking event with a conservative feedback policy.
- **Practice session:** Deliberately record a short speech, review detected events, and train context recognition.
- **Baseline/calibration:** Speak naturally for several minutes so the system can estimate pace, pause patterns, common fillers, and usable sensor thresholds.
- **Retention assessment:** Receive no or very little feedback during selected windows so Cue can measure whether improvement persists.
- **Self-caught event:** The user notices and corrects their own filler, rushing, or near-miss before Cue intervenes. The cuff's touch surface is reserved for controls, not coaching (see Decision log, 2026-10-03), so self-catches must be inferred from speech; how to do that reliably is an **[OPEN QUESTION]**.

### Accessibility and clinical boundary

- **[CONFIRMED]** Cue is a general consumer speaking-confidence and habit-training product, not currently a medical device or speech-disorder treatment.
- **[WORKING ASSUMPTION]** The experience should allow sensitivity adjustment or disabling categories for users who find feedback distracting or anxiety-producing.
- **[OPEN QUESTION]** Whether Cue should eventually support clinician-guided or accessibility modes requires separate research, validation, regulatory review, and inclusive design work.

## 5. Core behavioral loop

### Primary loop

```text
wearer speaks
    ↓
Cue detects a likely target behavior
    ↓
context + confidence + recent-history checks
    ↓
intervention policy decides whether a cue would help
    ↓
one subtle haptic cue (rhythm depends on the behavior)
    ↓
wearer notices → pauses / breathes / slows / continues
    ↓
system observes the next speech segment
    ↓
model updates event history and future intervention rate
```

### Behavioral thesis

- **[RESEARCH CONTEXT]** Awareness training and habit-reversal research suggest that learning to notice one’s own disfluencies can reduce them. Replacing filler with silence is a plausible competing response, but awareness may itself account for much of the improvement.
- **[CONFIRMED]** The tap must be framed as a helpful cue, not punishment or an error alarm.
- **[CONFIRMED]** Cue should reward increasing self-awareness: device-caught events should fall while self-caught events rise.
- **[WORKING ASSUMPTION]** Short no-feedback periods can estimate whether improvement is retained rather than dependent on the wearable.

### Default semantic contract

**[CONFIRMED]** Keep the live haptic language simple: a small, fixed vocabulary that is learnable mid-conversation.

**[WORKING ASSUMPTION — owner decision 2026-10-03, to validate with users]** Three cues, distinguished by **rhythm** (vibrotactile research finds rhythm is identified far more reliably than intensity or texture, and only ~3 intensity levels are absolutely identifiable):

| Cue | Behavior | Meaning |
|---|---|---|
| **One tap** | Filler word | Pause |
| **Two quick taps** | Speaking too fast | Slow down |
| **One long pulse** | Speaking too quietly | Speak up |

A single-tap mode ("**Tap = make space.** Pause, breathe, or slow down.") remains available as a setting, both as a fallback for users who prefer one cue and as the comparison condition for testing. Do not add patterns beyond these three without user testing.

**[WORKING ASSUMPTION — 2026-10-03]** Touch-control confirmations use **ramps** (smoothly rising or falling vibration), never taps, so they can't be mistaken for a coaching cue: rising ramp = Cue on, falling ramp = Cue off, one ramp = Conversation mode, two ramps = Presentation mode.

## 6. Live detection behavior and context awareness

### Required behaviors

- **[CONFIRMED]** Detect common fillers including at least “um,” “uh,” and filler-use “like.”
- **[CONFIRMED]** Do not treat every lexical occurrence as a filler.
- **[CONFIRMED]** Example: “I like your shirt” should not trigger merely because it contains “like.”
- **[CONFIRMED]** Example: “And I was, like… I don’t know” is a likely filler/contextual discourse-marker event.
- **[CONFIRMED]** Detect or estimate rushing and insufficient pauses in addition to lexical fillers.
- **[CONFIRMED — 2026-10-03]** Detect speaking **too quietly**, relative to the wearer's own normal speaking level (not an absolute loudness). Speaking too loudly is **not** a target.
- **[CONFIRMED]** Use recent history so clusters and escalating patterns can influence whether Cue intervenes.
- **[CONFIRMED]** Feedback must be near enough to the behavior that the user understands the association, without interrupting every word.

### Candidate live features

These are **[WORKING ASSUMPTION]** features, not guaranteed feasible on final hardware:

- Token/phrase hypotheses with timestamps and confidence.
- Filler classification using surrounding words, timing, prosody, duration, and position in the utterance.
- Speech rate over a rolling window, ideally using syllables or phonetic timing rather than words alone.
- Pause duration, phrase length, continuous speaking runs, and change from personal baseline.
- Filler clusters, repeated phrases, and recent intervention history.
- Post-cue response: whether the user paused, slowed, restarted, or continued unchanged.
- A “planning pressure” or “pause debt” score inferred from speeding up, shorter pauses, and clustered hesitation.

### Latency and confidence

- **[WORKING ASSUMPTION]** A useful cue should arrive roughly within 0.3–1.5 seconds after a confidently detected target event. The acceptable range must be tested; semantic context may require delaying the decision.
- **[WORKING ASSUMPTION]** Precision matters more than maximizing recall in social settings. Repeated false taps will erode trust quickly.
- **[WORKING ASSUMPTION]** Low-confidence events should be logged for offline analysis but should not trigger live feedback.
- **[OPEN QUESTION]** How much right-context is needed to classify “like” reliably without making feedback feel late?
- **[OPEN QUESTION]** Should rushing cues happen proactively, while lexical filler cues happen reactively?

### Modes and safety valves

- Easy pause/mute from the cuff or app.
- Configurable training intensity and target categories.
- A meeting/presentation mode with a higher intervention threshold.
- A visible explanation in the app of what Cue believed happened.
- A user correction path for false positives and missed events.
- Rate limits and cooldowns to prevent feedback storms.

## 7. Adaptive intervention

### Confirmed principles

- **[CONFIRMED]** Do not vibrate for every filler indefinitely.
- **[CONFIRMED]** Intervention should consider patterns, context, recent cues, and whether a cue is likely to help.
- **[CONFIRMED]** Feedback should fade as performance and self-awareness improve.
- **[CONFIRMED]** The system should include assessment windows with little or no feedback.

### Suggested policy, subject to testing

**[WORKING ASSUMPTION]** Start with a transparent rules-based policy before attempting reinforcement learning or complex personalization:

1. Reject low-confidence or non-target events.
2. Apply per-category confidence thresholds.
3. Apply a short cooldown after a cue.
4. Increase cue likelihood for clusters, high filler rate, or a strong change from baseline.
5. Reduce cue likelihood when the user has already corrected course.
6. Randomly withhold a controlled portion of otherwise valid cues to test learning.
7. Gradually lower the feedback probability when no-feedback performance improves.
8. Restore more frequent cues after sustained regression, not after a single bad session.

### Training stages

| Stage | Feedback | Purpose |
|---|---:|---|
| Awareness | Relatively frequent, high-confidence cues | Establish the event–cue association |
| Practice | Moderate, adaptive cues | Practice replacement behavior |
| Independence | Sparse cues | Transfer awareness to the user |
| Assessment | Little or no feedback | Measure retention |
| Booster | Temporarily increased support | Recover after meaningful regression |

Exact schedules such as “100% in week one, 70% in week two” were illustrative in the original exploration and are **not confirmed product requirements**.

## 8. App experience

### Experience principles

- **[CONFIRMED]** The app should be intentionally simple, not an overwhelming AI dashboard.
- **[CONFIRMED]** Live use should not require looking at a screen.
- **[CONFIRMED]** Emphasize learning, confidence, and self-correction—not shame or a daily “mistake count.”
- **[CONFIRMED]** Support deeper opt-in practice and post-session review.

### Suggested information architecture

1. **Today**
   - Current training focus.
   - Sessions/time speaking, with confidence/coverage disclosure.
   - High-confidence filler or rushing events.
   - Device-caught vs self-caught moments.
   - Average pace/pause change from personal baseline.
   - Longest interval without needing intervention.
2. **Session review**
   - Timeline of cues and detected behaviors.
   - Optional transcript/audio clips only when explicitly recorded.
   - Explanations and user corrections.
   - “What changed after the cue?”
3. **Progress**
   - Fillers per minute, pace, pause duration, and cluster frequency over time.
   - Device intervention down / self-correction up.
   - No-feedback retention performance.
4. **Practice**
   - Short prompts.
   - Awareness exercises using recordings the user explicitly chooses to capture.
   - Recognition quiz: identify fillers and effective pauses.
5. **Device and privacy**
   - Battery, fit, firmware, intensity, categories, processing/storage controls, deletion/export.

### Avoid misleading metrics

- Never show precision-implying counts when capture coverage or model confidence is low.
- Do not compare users against a universal “perfect” filler rate.
- Separate measured facts from estimates.
- Explain that fillers can serve normal conversational functions.
- Avoid streaks or red alerts that encourage anxiety, unnatural silence, or compulsive monitoring.

## 9. Hardware design and form factor

### Confirmed industrial-design direction

- **[CONFIRMED]** Cue is an **ear cuff**, not an earbud.
- **[CONFIRMED]** It must not block the ear canal.
- **[CONFIRMED]** It is a single-ear product.
- **[CONFIRMED]** It should be small, discreet, elegant, and logically wearable.
- **[CONFIRMED]** It should read more like jewelry/premium consumer hardware than a hearing aid or medical device.
- **[CONFIRMED]** Metallic finishes are preferred.
- **[CONFIRMED]** All concept imagery must depict one consistent product geometry across angles, on-ear views, case views, and colorways.

### Candidate physical arrangement

**[WORKING ASSUMPTION]** A plausible architecture is a spring/compliant cuff that grips a stable part of the outer ear, with:

- a skin-contact face for vibration sensing and/or haptic transfer;
- a small outer jewelry-like shell containing electronics;
- a compliant silicone or elastomer contact surface for comfort and grip;
- an inward-facing or shielded microphone port if acoustic sensing is required;
- a capacitive touch surface (e.g. the metal shell) **for controls only** (decision 2026-10-03): **long press (~1.5 s) = Cue on/off**, **double tap = switch Conversation / Presentation mode**; no touch gestures for coaching; other settings live in the app;
- charging contacts or a sealed wireless/contact charging interface;
- no always-visible LED during wear; any status light should be subtle and disableable.

The exact ear location, clamp force, dimensions, mass, left/right symmetry, glasses compatibility, hair interference, skin-contact stability, and all-day comfort are **[OPEN QUESTION]** items requiring physical prototypes and human-factors testing. Do not invent dimensions from renders.

### Candidate electronics

All components below are suggestions for prototyping, not a locked bill of materials:

- BLE-capable low-power MCU/SoC: Nordic nRF52840/nRF5340 class for connected prototypes, or a newer BLE/ML-capable part after benchmarking.
- Digital MEMS microphone for acoustic capture/calibration.
- Contact microphone, piezoelectric sensor, accelerometer, or bone-conduction/contact vibration transducer for wearer-dominant sensing experiments.
- Low-power 6-axis IMU for motion/contact-quality context.
- LRA haptic actuator plus a haptic driver such as DRV2605L-class hardware; ERM may be acceptable only for crude prototypes.
- Small Li-Po cell, protected charging/power-management IC, battery gauge as needed, and thermal/current safeguards.
- Flash sized for firmware, model assets, and a small encrypted event buffer—not indefinite raw-audio storage.

**[OPEN QUESTION]** Whether a single compact ear cuff can simultaneously achieve adequate microphone/contact-sensor signal quality, perceptible but private haptics, useful battery life, comfort, RF performance, and a jewelry-scale package.

## 10. Charging case and colorways

### Confirmed direction

- **[CONFIRMED]** The retail system is expected to include one Cue device, not a left/right pair.
- **[CONFIRMED]** Cue should have a dedicated charging case.
- **[CONFIRMED]** Product storytelling should show the device itself prominently from multiple consistent angles, not let the case dominate.
- **[CONFIRMED]** Offer metallic, jewelry-like color variants.

### Working case concept

**[WORKING ASSUMPTION]** A compact pocketable case cradles the cuff in only one obvious orientation, protects the contact surfaces, aligns charging reliably, and communicates case/device charge without looking like an earbud case containing a missing second earbud.

Potential details:

- Magnetic or shaped mechanical alignment.
- USB-C case charging; wireless case charging is optional and not MVP-critical.
- A single restrained charge indicator.
- Enough case capacity for multiple device recharges, subject to size validation.
- Cleanable well and replaceable/cleanable skin-contact insert if necessary.

### Working colorways

- **[WORKING ASSUMPTION]** Silver/chrome.
- **[WORKING ASSUMPTION]** Warm gold/champagne.
- **[WORKING ASSUMPTION]** Graphite/gunmetal.
- **[OPEN QUESTION]** Whether to add one Gen Z–oriented accent finish (for example, iridescent, soft lilac, or enamel) without weakening the premium jewelry positioning.

Color names, finishes, coating processes, scratch resistance, skin compatibility, and manufacturing cost are not confirmed.

## 11. Technical architecture

### Reference system

```text
Ear cuff
  sensors → signal conditioning → wearer-speech/activity features
      ↓ BLE
Phone
  streaming ASR or audio model
      ↓
  word timestamps + acoustic/prosodic features
      ↓
  contextual filler / pacing classifier
      ↓
  intervention policy + personalization
      ↓ BLE command
Ear cuff
  subtle haptic cue

App storage
  session summaries + events + model/policy metadata
  raw audio/transcript only under explicit, separately communicated modes
```

### MVP architecture recommendation

- **[WORKING ASSUMPTION]** Begin phone-centric. The cuff acts as sensor, haptic endpoint, touch controls, and BLE peripheral.
- Use the phone’s microphone or an off-the-shelf headset first to validate behavior before relying on unproven cuff acoustics.
- Run streaming ASR and contextual classification on the phone where platform support allows.
- Use cloud processing only for experiments that cannot run locally, with explicit consent and clear indication.
- Keep device firmware simple and deterministic during early behavioral trials.

### Potential production evolution

- On-cuff voice-activity/contact-quality features.
- On-device keyword or acoustic filler detection for a small vocabulary.
- Phone-side contextual disambiguation and intervention policy.
- Optional server-side model improvement using consented, de-identified research data.

This hybrid path is a hypothesis. Model size, thermals, battery life, microphone geometry, mobile OS background restrictions, BLE latency, and offline accuracy must be measured.

## 12. Sensing and audio options

### Option A — Phone/earphone microphone

Best for behavioral MVP speed. It avoids custom acoustic hardware but is less private-looking, may capture other speakers, and may not prove the dedicated cuff’s value.

### Option B — Air microphone on Cue

Could support lexical ASR, but may capture bystanders, wind, clothing/hair noise, and room speech. Speaker attribution remains difficult in noisy or multi-speaker settings.

### Option C — Contact/body-conducted sensing

A contact mic, piezo sensor, accelerometer, or related transducer could preferentially measure the wearer’s own voicing and cadence. This may help with wearer attribution and privacy, but **[IMPORTANT]** it is not yet proven that an elegant ear cuff at a comfortable location will yield sufficient signal quality for robust lexical recognition.

### Option D — Sensor fusion

Combine contact sensing with a small acoustic microphone. Contact energy can gate or weight the acoustic stream, potentially reducing bystander attribution errors. This is a promising **[WORKING ASSUMPTION]**, not a validated solution.

### Important distinction

Detecting **when the wearer is speaking** is easier than reliably identifying **what the wearer said**. Contact sensing may work well for voice activity, pace, pause, or cadence while still being inadequate for distinguishing “like” from “I like.” Do not conflate these capabilities.

## 13. Edge vs phone vs cloud processing

| Location | Best suited for | Advantages | Constraints |
|---|---|---|---|
| Ear cuff edge | Voice activity, contact quality, simple features, haptic control | Lowest latency, privacy, offline | Very limited power, memory, heat, model capacity |
| Phone | Streaming ASR, contextual classification, personalization, event storage | More compute, updateable, existing radios/UI | OS background rules, phone proximity, battery use |
| Cloud | Large-model experiments, opt-in post-session analysis, aggregate research | Highest compute, rapid iteration | Privacy, connectivity, latency, cost, trust |

### Default stance

- **[CONFIRMED]** Privacy should favor local/on-device processing.
- **[WORKING ASSUMPTION]** MVP live inference should be phone-local wherever practical.
- **[CONFIRMED]** Cue should not require continuous cloud recording of everyday conversations.
- **[OPEN QUESTION]** Whether production lexical detection can be fully local while meeting accuracy, latency, and battery requirements.

## 14. ML pipeline

### Proposed inference pipeline

1. **Input and quality assessment** — audio/contact streams, timestamps, packet loss, motion, fit/contact estimate.
2. **Wearer activity gating** — infer whether the wearer is vocalizing; do not assume all nearby speech belongs to the wearer.
3. **Speech recognition/features** — streaming tokens/phonemes with timestamps plus pace, pause, duration, and prosodic features.
4. **Candidate extraction** — detect filler sounds/words/phrases and pacing anomalies.
5. **Context classification** — lexical, syntactic, temporal, and prosodic decision: filler vs semantic use.
6. **Behavior state** — recent event rate, cluster score, pause behavior, deviation from personal baseline, recent cue history.
7. **Intervention policy** — cue, withhold, or log-only based on confidence, cooldown, mode, and training stage.
8. **Outcome attribution** — estimate whether speech changed after the cue.
9. **Personalization** — update thresholds slowly and reversibly; retain a stable global fallback.

### Training and evaluation

- Begin with public/licensed disfluency and conversational-speech data where usage permits.
- Collect opt-in Cue-specific recordings across accents, dialects, speech rates, ages, genders, noise conditions, and conversational contexts.
- Annotate token boundaries, filler function, speaker identity/attribution, noise, pacing, pauses, cue eligibility, and post-cue outcome.
- Evaluate at event level and session level, not only word error rate.
- Report false cues per speaking hour, missed target events, cue latency, context classification by filler type, and subgroup performance.
- Maintain a hard separation among raw signals, model predictions, policy decisions, and user corrections.

### Feasibility caveats

- Real-time ASR alone does not solve pragmatic/contextual filler classification.
- “Like” is especially difficult because semantic, quotative, approximative, and discourse-marker uses overlap.
- Accents, code-switching, overlapping speakers, music, wind, and informal speech will affect performance.
- Predicting a filler or planning breakdown before it occurs is an interesting research direction, **not a promised feature**.
- Measuring “self-correction” automatically is ambiguous, and the cuff's touch input is reserved for controls, so there is no physical self-caught label; any automatic measure must be validated before it drives progress metrics.

## 15. Data model and events

### Core entities

- `UserProfile` — preferences, locale/language, consent state, baseline references.
- `Device` — hardware/firmware revision, fit side, capabilities, battery metadata.
- `TrainingPlan` — active targets, stage, intensity, start date, policy version.
- `Session` — start/end, mode, capture source, coverage/quality, privacy settings.
- `SpeechEvent` — model-observed behavior candidate.
- `CueEvent` — an actual haptic intervention or intentionally withheld eligible cue.
- `SelfCaughtEvent` — a self-correction inferred from speech (touch is reserved for controls; method is an open question).
- `OutcomeWindow` — measurable speech behavior after a cue/self-caught event.
- `DailySummary` — aggregates with confidence and coverage.
- `ModelFeedback` — user correction/confirmation of a prediction.

### Suggested event envelope

```json
{
  "event_id": "uuid",
  "session_id": "uuid",
  "occurred_at_ms": 0,
  "event_type": "speech_candidate|cue|self_caught|outcome",
  "source": "cuff|phone|user",
  "model_version": "string|null",
  "policy_version": "string|null",
  "confidence": 0.0,
  "privacy_tier": "features_only|transcript|audio_opt_in",
  "payload": {}
}
```

### `SpeechEvent.payload` examples

- `behavior_type`: `filler_um`, `filler_uh`, `filler_like`, `filler_phrase`, `rushing`, `too_quiet`, `short_pause_cluster`, `long_run`.
- `token_text`: nullable and omitted in features-only mode.
- `start_ms`, `end_ms`, `context_class`, `speech_rate`, `pause_before_ms`, `pause_after_ms`.
- `wearer_probability`, `audio_quality`, `contact_quality`.
- `eligible_for_cue`, `ineligibility_reason`.

### `CueEvent.payload` examples

- `trigger_event_ids`, `delivered`, `withheld_reason`, `pattern`, `intensity`.
- `training_stage`, `cooldown_remaining_ms`, `decision_factors`.

### Data rules

- Store derived events by default, not raw continuous audio.
- If audio or transcript is retained, bind it to explicit session-level consent and a retention policy.
- Keep model inference separate from intervention: a detected event may correctly produce no cue.
- Store data-quality/coverage fields so the app never presents incomplete capture as an exact daily total.
- All schemas should be versioned and migratable.

## 16. Privacy and security assumptions

### Product stance

- **[CONFIRMED]** Cue should not depend on continuously uploading conversations.
- **[CONFIRMED]** The user must be able to use core live coaching without reviewing a transcript.
- **[WORKING ASSUMPTION]** Default everyday mode stores derived events and short-lived processing buffers, not raw audio.
- **[WORKING ASSUMPTION]** Recording/practice mode is explicit, visually clear, and separate from passive live coaching.

### Baseline controls

- Encrypt data in transit and at rest using platform-standard mechanisms.
- Use authenticated, signed firmware updates and rollback protection where hardware supports it.
- Pair devices securely; do not expose speech/event data over unauthenticated BLE characteristics.
- Minimize cloud identifiers and separate account identity from research datasets.
- Give users meaningful delete/export controls and document retention periods.
- Treat transcripts, voice data, and inferred behavioral traits as sensitive personal data.
- Avoid voiceprints/speaker-identification templates unless clearly needed and specifically consented to.
- Provide an immediate hardware/app mute and an obvious recording-state indication.
- Threat-model lost devices, malicious pairing, mobile compromise, API abuse, debug logs, model telemetry, and insider access.

### Bystander privacy

**[OPEN QUESTION]** Legal and social expectations vary by jurisdiction and context. Even if raw audio is not stored, a microphone-enabled wearable can capture bystander speech during processing. Product copy must accurately distinguish “processed locally,” “not stored,” and “not captured”—they are not equivalent.

## 17. MVP implementation plan

### Phase 0 — Define and validate the behavior (1–2 weeks)

- Interview target users about pain, willingness to wear, acceptable feedback timing, and anxiety/social concerns.
- Establish annotation definitions for fillers, semantic “like,” rushing, cue eligibility, and self-correction.
- Prototype the tap experience with phone + Apple Watch or another existing haptic device.
- Decide initial success and stopping criteria before collecting results.

### Phase 1 — Wizard-of-Oz / software behavioral prototype (2–3 weeks)

- Phone microphone or headset audio.
- Streaming/local ASR where feasible.
- Rules/classifier for `um`, `uh`, and an intentionally conservative subset of filler-use `like`.
- Simple cooldown and cluster-aware intervention policy.
- Haptics via watch/phone or a basic BLE haptic puck.
- Manual review and event correction tooling.

**Goal:** Determine whether correctly timed taps are understandable, tolerable, and behaviorally useful. Do not wait for custom hardware.

### Phase 2 — Ear-cuff electronics proof of concept (2–4 weeks)

- Rapid ergonomic shells in several cuff geometries.
- BLE MCU, haptic actuator, touch sensing for controls, battery, and one or more candidate sensors.
- Benchmark air mic, contact sensor, and fused sensing against phone audio.
- Measure contact stability, wearer-activity gating, BLE latency, battery draw, temperature, and haptic audibility.

**Goal:** Establish which functions the cuff can credibly perform. A bulky engineering mule is acceptable; do not confuse it with the final industrial design.

### Phase 3 — Seven-day pilot

- Approximately 10–20 users, subject to research ethics and recruiting constraints.
- Baseline day(s), supported training days, and at least one no-feedback retention period.
- Measure filler rate, false cues, cue latency, pauses/pace, self-caught events, wear time, comfort, embarrassment, and perceived confidence.
- Review failures qualitatively; raw percentage reduction alone is insufficient.

### Phase 4 — Productization decision

Proceed toward custom hardware only if evidence supports all three:

1. Users care enough to wear and potentially pay for Cue.
2. Real-time haptics create value beyond post-session software.
3. Ear-worn hardware materially improves discretion, sensing, or availability beyond phone/watch/AirPods alternatives.

### Suggested implementation components

- Mobile: native iOS first is a reasonable hypothesis for low-latency audio/BLE integration; confirm target-market platform needs before locking scope.
- Prototype firmware: Zephyr or vendor SDK on an nRF52/nRF53-class board.
- Audio: platform speech framework, a small local ASR engine, or a research cloud ASR behind explicit consent; benchmark instead of assuming.
- Analytics: local event store first, with an encrypted opt-in backend for study synchronization.
- Experimentation: policy/config versioning and feature flags from day one.

## 18. Success metrics

### Behavioral outcome metrics

- Change in high-confidence fillers per speaking minute from baseline.
- Change in filler clusters per speaking minute.
- Change in speaking rate and pause distribution relative to the user’s own baseline.
- Retention during no-feedback periods and after device removal.
- Device-caught vs self-caught ratio over time.
- Post-cue response rate: pause/slowdown within a defined window.

### Model and system metrics

- Precision/recall by filler type and context.
- False haptic cues per speaking hour.
- End-to-end cue latency.
- Wearer-vs-bystander attribution error.
- Percent of speaking time with usable signal/model coverage.
- Battery life, reconnection rate, packet loss, and crash-free sessions.

### Experience and business metrics

- Daily wear time and seven-day completion.
- Percent of users who choose to continue after the trial.
- Comfort, discretion, trust, and perceived embarrassment scores.
- User-reported confidence and perceived helpfulness.
- Willingness to pay and preference versus phone/watch-only alternatives.
- Return/refund reasons in later stages.

### Guardrail metrics

- Anxiety, distraction, or speech suppression caused by cues.
- Reports of unnatural pauses or reduced conversational presence.
- Skin irritation, pain, pressure, heat, or hearing interference.
- Privacy concerns or misunderstood recording state.
- Performance gaps across accents, dialects, demographics, and environments.

No numeric product claims should be published until measured in appropriate studies.

## 19. UX principles

1. **Private, not secretive.** The cue belongs to the wearer; privacy behavior must still be transparent.
2. **Awareness, not punishment.** No shocks, scolding, red error states, or shame language.
3. **One rhythm, one idea.** Each cue has a single meaning (pause / slow down / speak up), and the vocabulary stays small.
4. **Natural voice over perfect speech.** Preserve personality and normal conversational fillers.
5. **Precision before frequency.** A few trusted cues beat constant questionable taps.
6. **Progress toward independence.** The product should become quieter as learning improves.
7. **Personal baseline over universal score.** Coach the individual, not an arbitrary ideal speaker.
8. **No-screen live use.** Configuration and reflection live in the app; conversation does not.
9. **Explain uncertainty.** Let users see and correct why Cue acted.
10. **Social acceptability is a feature.** Comfort, aesthetics, haptic audibility, and recording perceptions are core product requirements.

## 20. Branding and tone

### Confirmed brand direction

- **[CONFIRMED]** Name: **Cue**.
- **[CONFIRMED]** Brand should be modern, creative, Gen Z–aware, and more than plain wordmark typography.
- **[CONFIRMED]** Visual identity may incorporate a person speaking, a speech gesture, a subtle waveform, a pause, or a “cue” signal.
- **[CONFIRMED]** Product aesthetic: discreet, elegant, premium, metallic, jewelry-like.
- **[CONFIRMED]** Avoid medical-device, hearing-aid, surveillance, punishment, and corporate presentation-software aesthetics.

### Voice

Cue should sound calm, direct, supportive, and socially fluent. It should never sound preachy, clinical, or like it is grading a user’s intelligence.

Prefer:

- “Make space.”
- “You caught yourself.”
- “Your pauses felt steadier today.”
- “Speak with intention.”
- “Keep your voice. Lose the habits that get in its way.”

Avoid:

- “You failed.”
- “Bad word detected.”
- “Eliminate all disfluencies.”
- “Sound smarter.”
- Claims that fillers make someone incompetent or untrustworthy.

### Logo/icon considerations

The identity should be distinctive at small app-icon and product-mark sizes. A speaking profile, quotation/pause form, or signal motif can be explored, but avoid a literal microphone icon if it makes Cue resemble a recording app. Any speaking-person motif should feel inclusive and abstract rather than gendered. Logo work must remain visually coherent with the physical cuff.

## 21. Patent and IP context

> **Legal disclaimer:** This section is planning context, not legal advice, a validity opinion, or freedom-to-operate clearance. Patent status and claim scope must be verified by qualified counsel before fundraising claims, filing strategy, manufacturing commitments, or launch.

### Known relevant application

- **[CONFIRMED FROM PROVIDED RECORD]** `US20240144956A1`, “Systems for providing real-time feedback to reduce undesired speaking patterns,” is a published U.S. patent application that closely overlaps the broad concept of receiving speech, detecting filler speech, verifying a target speaker, and giving discreet sensory feedback.
- **[CONFIRMED FROM PROVIDED RECORD]** The application was marked **abandoned on April 17, 2026** for failure to respond to an Office Action.
- **[CONFIRMED LEGAL CONTEXT]** An abandoned application that never issued is not itself an enforceable issued U.S. patent.
- **[CONFIRMED LEGAL CONTEXT]** The publication remains prior art and does not disappear. It may affect Cue’s ability to patent overlapping subject matter.
- **[IMPORTANT]** Abandonment may sometimes be petitioned for revival, and U.S. status does not establish the status of foreign or related family members. Counsel should recheck official records.
- The published independent claim discussed in prior research included a speaker-verification limitation. Cue should not treat that limitation as a guaranteed safe harbor or base product architecture solely around avoiding one claim.

### Other prior-art context

Prior exploration identified earlier work involving ear-worn speech assessment, filler recognition, wearable/haptic coaching, and research prototypes such as WSCoach. This makes “detect filler → buzz” a crowded concept even when a particular application is abandoned.

### Potentially differentiating Cue territory

The most interesting product/IP direction is the complete adaptive learning loop:

```text
contextual behavior detection
→ decide whether intervention would help
→ cue a replacement behavior
→ observe the response
→ measure self-awareness and retention
→ progressively withdraw assistance
```

Possible areas for counsel and patent research:

- Sensor fusion that attributes speech to the wearer through physical coupling without a conventional stored voiceprint.
- Context- and history-aware intervention rather than event-by-event alerts.
- Measuring device-caught vs self-caught behavior.
- Feedback fading and randomized no-feedback retention tests.
- Outcome-driven personalization of cue timing and frequency.
- Prediction of speech-planning pressure before a filler, if it proves technically real and novel.

### Required next IP steps

1. Obtain a current claim-family/status map across relevant jurisdictions.
2. Review the September 2025 Office Action and cited prior art for `US20240144956A1`.
3. Conduct a broader professional freedom-to-operate search against the final architecture.
4. Keep dated invention records and evaluation results.
5. Discuss provisional filing strategy before public disclosure of genuinely novel mechanisms.

Do not say Cue is “patent cleared,” “non-infringing,” or “patented” without an appropriate legal basis.

## 22. Non-goals

- Eliminating every filler or enforcing a single “correct” way to speak.
- Diagnosing or treating speech, anxiety, neurological, or hearing disorders in the initial product.
- Scoring intelligence, honesty, competence, warmth, or employability.
- Recording and storing all-day conversations by default.
- Identifying or analyzing bystanders.
- Becoming a general-purpose earbud, music player, hearing aid, or notification device.
- Showing live transcripts or requiring phone interaction during conversation.
- Shipping a complex library of vibration codes (the vocabulary is capped at three rhythms).
- Building custom production hardware before validating user value and the behavioral loop.
- Claiming that contact sensing alone can perform robust lexical recognition before evidence exists.
- Promising pre-filler prediction, perfect context detection, or universal accuracy.

## 23. Open technical and product questions

### Detection and ML

- What precision and latency are achievable for filler-use “like” in spontaneous speech?
- Which languages and filler vocabularies are in the first release?
- Can a contact sensor at an acceptable cuff location reliably attribute wearer speech? Can it support lexical recognition or only timing features?
- What is the best microphone/contact-sensor geometry under hair, motion, traffic, wind, and overlapping speech?
- What false-cue rate remains acceptable in interviews or presentations?
- How should Cue detect and score rushing across different natural speech styles?
- Can post-cue behavior be measured without overinterpreting correlation as effect?

### Intervention and behavior

- Should the first cue follow a single high-confidence filler or only a cluster?
- What timing maximizes recognition without derailing thought?
- How quickly should feedback fade, and when should booster support return?
- Does haptic intensity vary by context, or should it remain fixed?
- Does Cue help outside practice, and does improvement persist after feedback removal?
- For whom does real-time feedback increase anxiety or worsen fluency?

### Hardware

- Exact cuff placement, fit range, clamp force, mass, and all-day comfort.
- Left/right ear strategy and compatibility with glasses, earrings, hair, and headwear.
- Haptic transfer that is clearly felt by the wearer but inaudible nearby.
- Realistic battery life and case recharge count at the required sensing duty cycle.
- Water/sweat resistance, cleanability, skin-contact materials, and drop durability.
- Antenna/RF performance within a metallic-looking shell.
- Charging interface and manufacturing tolerances.

### Product and business

- Is the pain strong enough for daily wear and hardware pricing?
- Does dedicated hardware outperform an Apple Watch/AirPods/phone experience enough to justify itself?
- Is initial positioning “stop saying like,” “speak with intention,” or a combination of hook and broader promise?
- Which user segment has the highest urgency and retention?
- What should remain free vs subscription-based, if anything?
- What research/consent framework is required for pilots involving recorded conversation?

### Legal and privacy

- Current status of all relevant patent family members and other blocking claims.
- Jurisdiction-specific consent requirements for microphone processing.
- Appropriate recording indicators and bystander communication.
- Whether any planned claims would make Cue a regulated medical device.

## 24. Working rules for agents

1. Start from this document and preserve all **[CONFIRMED]** decisions.
2. Clearly label proposals, hypotheses, estimates, and invented examples.
3. Do not depict Cue as an earbud or as a two-device pair.
4. Keep industrial-design geometry consistent across every render and view.
5. Do not imply that sensing, ML accuracy, battery life, or miniaturization has been proven.
6. Optimize the MVP around validating behavior, not producing a cosmetic hardware demo.
7. Treat raw voice data as highly sensitive and minimize it by default.
8. Avoid legal conclusions; distinguish published applications, issued patents, abandonment, prior art, and foreign family status.
9. Prefer testable, versioned rules before opaque personalization.
10. When changing a confirmed decision, update this file and record the rationale/date.

## 25. Concise agent handoff summary

Cue is a **single, discreet, jewelry-like ear cuff**—not an earbud—that coaches speaking during real conversations. The hero loop is **true filler detected in context → private haptic cue → user pauses/slows/speaks up → Cue observes improvement**. It must distinguish filler “like” from semantic “like,” also address rushing, poor pauses and speaking too quietly, use a three-rhythm haptic vocabulary (tap / double tap / long pulse), use the cuff's touch surface only for on/off and mode switching (not coaching), avoid cueing every event, and fade feedback to test retained learning. The companion app is simple, supportive, and progress-oriented; everyday mode should favor local processing and derived events rather than stored audio. Start with a phone/watch or BLE-haptic behavioral prototype, then validate cuff sensing, fit, battery, and miniaturization before promising production feasibility. The hardware aesthetic is small, elegant, metallic, Gen Z–aware, and consistent across all angles, with one-device charging case and jewelry-like colorways. `US20240144956A1` was abandoned in April 2026 but remains prior art; Cue is not patent-cleared, and its adaptive intervention/learning loop is the more interesting differentiation. Preserve confirmed choices, label assumptions, and do not overclaim.

## 26. Decision log

Changes to **[CONFIRMED]** decisions, newest first (rule 10 in §24).

### 2026-10-04 — Hardware roles for wearer verification

6. **The cuff's bone-conduction sensor verifies who is speaking; there is no software voice detection.** Roles: the **bone-conduction sensor** confirms when the wearer's own voice is vibrating through the skull (wearer voice activity); the **microphone** captures audio for speech-to-text, which hears everyone; a **vibration motor behind the ear** delivers the taps. The software coaches only words the bone sensor confirms. Removed from the software: speaker labels (diarization), loudness-based attribution, voice calibration, and any voice profile, so `SOFTWARE.md` §4's open question is closed: **no voiceprint**. *Rationale:* physical coupling identifies the wearer more reliably and privately than voice matching. *Consequences:* the bone sensor (e.g. rev 0's V2S200D, currently DNP) becomes a required part; whether a comfortable cuff position gives a clean enough bone signal remains to be validated on hardware (§12 Option C/D); the web prototype has no bone sensor, so it treats all speech as the wearer's.

### 2026-10-04 — Software system spec adopted

5. **`SOFTWARE.md` is canonical for software behavior.** Cue is a behavioral coaching system, not a filler detector: a decision engine asks "would a tap help right now?" using filler density and clusters, pace against the wearer's own baseline, time without a pause, repetition, and speaking-turn length, with 10–20 s cooldowns, high confidence, and checks on whether a tap worked. *Where it conflicts with earlier decisions:* the three-rhythm haptic vocabulary (decision 1) stands over `SOFTWARE.md` §18's single universal tap; whether to add an opt-in stored voice profile (`SOFTWARE.md` §4) is an **[OPEN QUESTION]**; no voiceprint is stored today.

### 2026-10-03 (later) — Touch for controls

4. **Touch input returns, for controls only.** Amends decision 2 below. The cuff gets a touch surface for **on/off (long press)** and **switching Conversation / Presentation mode (double tap)**, confirmed by vibration *ramps* that can't be confused with coaching taps. Touch is still **not** used mid-conversation for coaching (e.g. no self-catch tap). *Rationale:* these are occasional controls between conversations, not something the wearer must do while talking; gestures are deliberately few and hard to trigger by accident (people touch their ears often). The rev 0 hardware's Qvar shell-electrode touch (with IQS227 fallback) fits this.

### 2026-10-03 — Owner decisions during software MVP development

1. **Three haptic rhythms instead of one tap.** Previously **[CONFIRMED]** "Tap = make space" as the single default cue. Now: one tap = filler (pause), two quick taps = too fast (slow down), one long pulse = too quiet (speak up). *Rationale:* each behavior asks for a different action, and a single tap can't say which; rhythm is the most reliably distinguished vibrotactile dimension. Kept as a **[WORKING ASSUMPTION]** to validate with users; the single-tap mode stays available as a setting and test condition.
2. **No button or touch input on the cuff.** *(Amended by decision 4: touch is back for controls only.)* Previously a **[WORKING ASSUMPTION]** of capacitive touch for self-caught events and pause/mute. *Rationale:* the wearer won't have anything to press mid-conversation; controls live in the app. *Consequence:* the **[CONFIRMED]** goal "device-caught events fall while self-caught events rise" still stands, but self-catches must be inferred from speech (**[OPEN QUESTION]**). The software MVP's "I caught it" button was removed for the same reason.
3. **Detect speaking too quietly.** New **[CONFIRMED]** target behavior, measured against the wearer's own normal level. Speaking too loudly is out of scope.
