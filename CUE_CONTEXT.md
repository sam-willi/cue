# Cue — Canonical Product Context

> **Purpose:** This document is the canonical source of truth for coding, hardware, design, research, marketing, and strategy agents working on Cue. Software behavior is specified in [`SOFTWARE.md`](./SOFTWARE.md); visual design in [`DESIGN.md`](./DESIGN.md). Read it before proposing or implementing work. If another artifact conflicts with this one, use this document unless a human owner explicitly supersedes it.
>
> **Last updated:** 2026-10-05 (see §26 Decision log)  
> **Maturity:** Product concept / validation and prototyping  
> **Not a claim of:** production readiness, medical efficacy, patent clearance, manufacturability, or validated technical feasibility.

## 1. Decision-status legend

Every material statement should be interpreted using these labels:

- **[CONFIRMED]** — A product decision explicitly made in the founding conversation. Treat as a requirement unless a human owner changes it.
- **[WORKING ASSUMPTION]** — A useful current direction that has not yet been validated. Build so it can be tested or changed.
- **[OPEN QUESTION]** — Unresolved; do not silently choose an answer if the choice materially affects product scope, hardware, privacy, cost, or user experience.
- **[RESEARCH CONTEXT]** — Evidence or background that motivates the product but is not itself a Cue product decision.

## 2. Product in one paragraph

**[CONFIRMED]** Cue is a discreet, single-ear **behind-the-ear (BTE) wearable speech coach** that helps people reduce habitual filler words such as “like,” “um,” and “uh,” slow rushed speech, use better pauses, and build speaking confidence. Its defining experience is real-time, subtle haptic feedback during actual speech: Cue notices a relevant speech behavior, privately taps the wearer, and helps them replace the habit with a calm pause or slower delivery. Cue is not meant to make people sound scripted or eliminate every natural disfluency. It should help users keep their personality while sounding more intentional.

**Core promise:** Notice the habit while it is happening, practice a better response, and gradually need less help.

**Simple positioning:** “Stop saying ‘like.’ Then learn to speak with fewer fillers, better pauses, and more confidence.”

**Working tagline:** “Speak with intention.”

## 3. Product vision

### Confirmed direction

- **[CONFIRMED]** Cue is a behavior-training product, not merely a speech analytics dashboard or filler counter.
- **[CONFIRMED]** The hero feature is: detect a true filler in real time and provide a private haptic cue.
- **[WORKING ASSUMPTION — decision 14, 2026-10-05]** By default the cue follows a **filler pattern** (a cluster or a high rate), not every single filler; an "every filler" testing mode is the comparison condition.
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
- **Presentation mode:** Use during a talk, pitch, or interview with rarer, prioritized cues (decision 11): rushing, no pause, filler rate, and too quiet are live; long turn is not. **Conversation mode** is the everyday default.
- **Practice session:** Deliberately record a short speech, review detected events, and train context recognition.
- **Baseline/calibration:** Speak naturally for several minutes so the system can estimate pace, pause patterns, common fillers, and usable sensor thresholds.
- **Retention assessment:** Receive no or very little feedback during selected windows so Cue can measure whether improvement persists.
- **Self-caught event:** The user notices and corrects their own filler, rushing, or near-miss before Cue intervenes. The device's touch surface is reserved for controls, not coaching (see Decision log, 2026-10-03), so self-catches must be inferred from speech; how to do that reliably is an **[OPEN QUESTION]**.

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

**[WORKING ASSUMPTION — owner decisions 12 and 15, 2026-10-05, to validate with users]** Five cues in three families, distinguished by **rhythm** (vibrotactile research finds rhythm is identified far more reliably than intensity or texture). Every cue starts with a sharp onset:

| Family | Behavior | Cue | Rhythm | Action |
|---|---|---|---|---|
| Space | No pause | **One tap** ("full stop") | 50 ms | Breathe |
| Space | Long turn | **Two knocks** ("knock-knock, let them in") | 50 on, 150 off, 50 on | Give space |
| Pace | Rushing | **Slow steps** ("the pace to aim for") | three 100 ms pulses, 250 ms apart (~800 ms) | Slow down |
| Voice | Filler pattern | **Tap and hum** ("uh… mmm") | 40 ms tap, 90 ms gap, 280 ms soft hum | Pause |
| Voice | Too quiet | **Long push** ("push your voice out") | 450 ms | Speak up |

A **Simpler cues** setting plays only each family's root (Space → one tap, Pace → slow steps, Voice → long push), as a fallback for users who find five too many. Planned pilot: at least 8 users learn the set to 80%, are tested while reading aloud and in conversation, and retested after a week; any pair confused more than 15% of the time is merged. Bench checks still open: gap crispness on the VG0832013D motor, whether the soft hum is audible through bone at the mastoid, and whether it is felt while talking. Do not add patterns beyond these five without user testing.

**[WORKING ASSUMPTION — 2026-10-03]** Touch-control confirmations use **ramps** (smoothly rising or falling vibration with no sharp onset), never taps, so they can't be mistaken for a coaching cue: rising ramp = Cue on, falling ramp = Cue off, one ramp = Conversation mode, two ramps = Presentation mode.

## 6. Live detection behavior and context awareness

### Required behaviors

- **[CONFIRMED]** Detect common fillers including at least “um,” “uh,” and filler-use “like.”
- **[CONFIRMED — 2026-10-05]** The MVP filler set: “um” and “uh” (also “er,” “erm,” “ah”), “like” in context, and “lowkey.” Repeated words (“I, I, I think”) are not coached (decision 15). “Hmm” is **not** counted (it is often a listening sound). The other fillers in `SOFTWARE.md` §6 (basically, literally, actually, so, you know, I mean, kind of, sort of, right) come later.
- **[CONFIRMED]** Do not treat every lexical occurrence as a filler.
- **[CONFIRMED]** Example: “I like your shirt” should not trigger merely because it contains “like.”
- **[CONFIRMED]** Example: “And I was, like… I don’t know” is a likely filler/contextual discourse-marker event.
- **[CONFIRMED]** Detect or estimate rushing and insufficient pauses in addition to lexical fillers.
- **[CONFIRMED — 2026-10-03, amended by decision 13]** Detect speaking **too quietly**, against a target volume the wearer sets for each mode with a short read-aloud (not an absolute loudness, and not a level learned during the session). Speaking too loudly is **not** a target.
- **[CONFIRMED]** Use recent history so clusters and escalating patterns can influence whether Cue intervenes.
- **[CONFIRMED]** Feedback must be near enough to the behavior that the user understands the association, without interrupting every word.

### Candidate live features

These are **[WORKING ASSUMPTION]** features, not guaranteed feasible on final hardware:

- Token/phrase hypotheses with timestamps and confidence.
- Filler classification using surrounding words, timing, prosody, duration, and position in the utterance.
- Speech rate over a rolling window, ideally using syllables or phonetic timing rather than words alone.
- Pause duration, phrase length, continuous speaking runs, and change from personal baseline.
- Filler clusters and recent intervention history.
- Post-cue response: whether the user paused, slowed, restarted, or continued unchanged.
- A “planning pressure” or “pause debt” score inferred from speeding up, shorter pauses, and clustered hesitation.

### Latency and confidence

- **[WORKING ASSUMPTION]** A useful cue should arrive roughly within 0.3–1.5 seconds after a confidently detected target event. The acceptable range must be tested; semantic context may require delaying the decision.
- **[WORKING ASSUMPTION]** Precision matters more than maximizing recall in social settings. Repeated false taps will erode trust quickly.
- **[WORKING ASSUMPTION]** Low-confidence events should be logged for offline analysis but should not trigger live feedback.
- **[OPEN QUESTION]** How much right-context is needed to classify “like” reliably without making feedback feel late?
- **[OPEN QUESTION]** Should rushing cues happen proactively, while lexical filler cues happen reactively?

### Modes and safety valves

- Easy pause/mute from the device or app.
- Configurable training intensity and target categories.
- Conversation and Presentation modes (decision 11); Presentation taps less often (at least 25 s apart, at most 2 per minute) and only for its highest-priority due behavior.
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

- **[CONFIRMED]** Cue is a **behind-the-ear (BTE)** device: the body rests behind the ear and hangs from an **ear hook** over the top of the ear. It is not an ear cuff (which clips around the rim of the ear) and not an earbud (decision 7, 2026-10-05).
- **[CONFIRMED]** It must not block the ear canal.
- **[CONFIRMED]** It is a single-ear product.
- **[CONFIRMED]** It should be small, discreet, elegant, and logically wearable.
- **[CONFIRMED]** **Discreetness comes first** (decision 8, 2026-10-05): it should go unnoticed in conversation. When it is noticed, it should read as premium consumer hardware rather than a hearing aid or medical device; BTE is also a hearing-aid form factor, so finish, proportion, and styling carry this distinction.
- **[CONFIRMED]** A frosted translucent ear hook and an opaque body (decision 8); the body is **satin metallic grey**, a soft brushed sheen rather than a mirror finish (decision 16, which amends decision 8's matte, hair-matched body). Metal only in small details, if at all.
- **[CONFIRMED]** All concept imagery must depict one consistent product geometry across angles, on-ear views, case views, and colorways.

### Candidate physical arrangement

**[WORKING ASSUMPTION]** A plausible architecture is a BTE body resting in the groove behind the ear, held by an ear hook over the top of the ear (as in `hardware/rev0/democad.step` on the `hardware-rev0` branch), with:

- a skin-contact face, against the skin behind the ear, for vibration sensing and/or haptic transfer;
- a small, opaque shell containing electronics, in satin metallic grey (decision 16);
- a compliant silicone or elastomer contact surface for comfort and grip;
- an ear hook with a ~1 mm nitinol wire core in a frosted, faintly tinted silicone or aliphatic-TPU sleeve, sitting close to the head (decision 8);
- an inward-facing or shielded microphone port if acoustic sensing is required;
- a capacitive touch surface (a small metal touch area, or sensing through the matte shell, is an **[OPEN QUESTION]** for Tanisha) **for controls only** (decision 2026-10-03): **long press (~1.5 s) = Cue on/off**, **double tap = switch Conversation / Presentation mode**; no touch gestures for coaching; other settings live in the app;
- charging contacts or a sealed wireless/contact charging interface;
- no always-visible LED during wear; any status light should be subtle and disableable.

The exact ear location, clamp force, dimensions, mass, left/right symmetry, glasses compatibility, hair interference, skin-contact stability, and all-day comfort are **[OPEN QUESTION]** items requiring physical prototypes and human-factors testing. Do not invent dimensions from renders.

### Current electronics draft (rev 0)

**[WORKING ASSUMPTION — 2026-10-05]** The current draft, which may change, is on the `hardware-rev0` branch (`hardware/README.md`):

- **Radio and processor:** Ezurio BL54L15µ module (453-00223, Nordic nRF54L15, chip antenna, pre-certified). It is out of stock until about Dec 2026, so dev boards temporarily use the larger BL54L15 (453-00044, same nRF54L15 and pin map) until the small one is back.
- **Power:** Nordic nPM1300 (charger, 1.8 V and 3.0 V rails). **Battery:** VARTA CP1254 coin cell; its external protection circuit is still open.
- **Microphone:** TDK T5838 PDM mic; all logic runs at 1.8 V to suit it.
- **Bone conduction and touch:** ST LSM6DSV16BX, whose bone-conduction (audio-band accelerometer) channel is the current wearer-voice sensor and whose Qvar input senses touch; an IQS227B touch controller is a do-not-populate (DNP) fallback. Knowles V2S200D is the alternative bone sensor (optional, DNP); the choice is made after the kit test on real ears.
- **Haptics:** TI DRV2605L driver and an 8 mm Vybronics VG0832013D LRA, pressed toward the skin.
- **Charging:** pogo-pin pads; no connectors and no external flash.

Status: the breadboard **kit** is wired but has no firmware; the **Rev A dev board** is pre-manufacturing (ready for review and ordering); **rev 0** is a checked netlist only, not laid out. Treat none of this as a locked bill of materials.

**[OPEN QUESTION]** Whether a single compact BTE device can simultaneously achieve adequate microphone/contact-sensor signal quality, perceptible but private haptics, useful battery life, comfort, RF performance, and a small, discreet package.

## 10. Charging case and colorways

### Confirmed direction

- **[CONFIRMED]** The retail system is expected to include one Cue device, not a left/right pair.
- **[CONFIRMED]** Cue should have a dedicated charging case.
- **[CONFIRMED]** Product storytelling should show the device itself prominently from multiple consistent angles, not let the case dominate.
- **[CONFIRMED]** The body is satin metallic grey (decision 16); the standard ear hook is frosted translucent (decision 8).

### Working case concept

**[WORKING ASSUMPTION]** A compact pocketable case cradles the BTE device in only one obvious orientation, protects the contact surfaces, aligns charging reliably, and communicates case/device charge without looking like an earbud case containing a missing second earbud.

Potential details:

- Magnetic or shaped mechanical alignment.
- USB-C case charging; wireless case charging is optional and not MVP-critical.
- A single restrained charge indicator.
- Enough case capacity for multiple device recharges, subject to size validation.
- Cleanable well and replaceable/cleanable skin-contact insert if necessary.

### Working colorways

- **[WORKING ASSUMPTION]** Body: satin metallic grey as the standard (decision 16). Matte hair-matched tones (black, dark brown, light brown / dark blonde, gray) remain possible later variants. (The earlier silver, champagne, and graphite metallic set is superseded by decision 8.)
- **[WORKING ASSUMPTION]** Ear hook: frosted translucent with a faint neutral or smoke tint as the standard; matte skin- or hair-matched hooks as optional extras.
- **[OPEN QUESTION]** Which body tones and hook tint disappear on the widest range of skin tones, hair colors, and hairstyles; test on people, not renders.
- **[OPEN QUESTION]** Whether to offer any expressive accent finish (for example, iridescent or soft lilac) as an opt-in variant, given that discreetness comes first.

Color names, finishes, coating processes, scratch resistance, skin compatibility, and manufacturing cost are not confirmed.

## 11. Technical architecture

### Reference system

```text
BTE device
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
BTE device
  subtle haptic cue

App storage
  session summaries + events + model/policy metadata
  raw audio/transcript only under explicit, separately communicated modes
```

### MVP architecture recommendation

- **[CONFIRMED — decision 10]** The MVP is a **web app**. It talks to the device over Web Bluetooth (Chrome on Android and desktop; not iPhone). Native iOS comes later. The BTE device acts as sensor, haptic endpoint, touch controls, and BLE peripheral.
- Use the computer's or phone's microphone first to validate behavior before relying on unproven BTE acoustics.
- **[CONFIRMED — decision 9]** For the MVP, live audio streams to Deepgram Flux (cloud ASR) with clear disclosure; contextual classification and the decision engine run in the browser. Move toward on-device or phone-local recognition before launch.
- Keep device firmware simple and deterministic during early behavioral trials.

### Potential production evolution

- On-device voice-activity/contact-quality features.
- On-device keyword or acoustic filler detection for a small vocabulary.
- Phone-side contextual disambiguation and intervention policy.
- Optional server-side model improvement using consented, de-identified research data.

This hybrid path is a hypothesis. Model size, thermals, battery life, microphone geometry, mobile OS background restrictions, BLE latency, and offline accuracy must be measured.

## 12. Sensing and audio options

### Option A — Phone/earphone microphone

Best for behavioral MVP speed. It avoids custom acoustic hardware but is less private-looking, may capture other speakers, and may not prove the dedicated BTE device’s value.

### Option B — Air microphone on Cue

Could support lexical ASR, but may capture bystanders, wind, clothing/hair noise, and room speech. Speaker attribution remains difficult in noisy or multi-speaker settings.

### Option C — Contact/body-conducted sensing

A contact mic, piezo sensor, accelerometer, or related transducer could preferentially measure the wearer’s own voicing and cadence. This may help with wearer attribution and privacy, but **[IMPORTANT]** it is not yet proven that an elegant BTE device at a comfortable location will yield sufficient signal quality for robust lexical recognition.

### Option D — Sensor fusion

Combine contact sensing with a small acoustic microphone. Contact energy can gate or weight the acoustic stream, potentially reducing bystander attribution errors. This is a promising **[WORKING ASSUMPTION]**, not a validated solution.

### Important distinction

Detecting **when the wearer is speaking** is easier than reliably identifying **what the wearer said**. Contact sensing may work well for voice activity, pace, pause, or cadence while still being inadequate for distinguishing “like” from “I like.” Do not conflate these capabilities.

## 13. Edge vs phone vs cloud processing

| Location | Best suited for | Advantages | Constraints |
|---|---|---|---|
| BTE device edge | Voice activity, contact quality, simple features, haptic control | Lowest latency, privacy, offline | Very limited power, memory, heat, model capacity |
| Phone | Streaming ASR, contextual classification, personalization, event storage | More compute, updateable, existing radios/UI | OS background rules, phone proximity, battery use |
| Cloud | Large-model experiments, opt-in post-session analysis, aggregate research | Highest compute, rapid iteration | Privacy, connectivity, latency, cost, trust |

### Default stance

- **[CONFIRMED]** Privacy should favor local/on-device processing.
- **[CONFIRMED — decision 9]** The MVP uses cloud ASR (Deepgram Flux) with clear disclosure; the product should move to on-device or phone-local inference before launch.
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
- Measuring “self-correction” automatically is ambiguous, and the device's touch input is reserved for controls, so there is no physical self-caught label; any automatic measure must be validated before it drives progress metrics.

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
  "source": "device|phone|user",
  "model_version": "string|null",
  "policy_version": "string|null",
  "confidence": 0.0,
  "privacy_tier": "features_only|transcript|audio_opt_in",
  "payload": {}
}
```

### `SpeechEvent.payload` examples

- `behavior_type`: `filler_um`, `filler_uh`, `filler_like`, `filler_lowkey`, `rushing`, `no_pause`, `long_turn`, `too_quiet`.
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

- **[CONFIRMED]** Cue should not depend on continuously uploading conversations. The software MVP's disclosed cloud transcription is a prototype exception (decision 9).
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
- No voiceprints or speaker-identification templates (decision 6): the bone sensor identifies the wearer.
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
- Haptics shown on screen (a 3D model of the device), then a basic BLE haptic device (see below).
- Manual review and event correction tooling.

**Goal:** Determine whether correctly timed taps are understandable, tolerable, and behaviorally useful. Do not wait for custom hardware.

### Phase 2 — BTE electronics proof of concept (2–4 weeks)

- Rapid ergonomic shells in several BTE body and ear-hook geometries.
- BLE MCU, haptic actuator, touch sensing for controls, battery, and one or more candidate sensors.
- Benchmark air mic, contact sensor, and fused sensing against phone audio.
- Measure contact stability, wearer-activity gating, BLE latency, battery draw, temperature, and haptic audibility.

**Goal:** Establish which functions the BTE device can credibly perform. A bulky engineering mule is acceptable; do not confuse it with the final industrial design.

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

- App: a **web app** for the MVP (decision 10), with Web Bluetooth to the device (Chrome on Android and desktop; not iPhone). Native iOS later.
- Device firmware: Zephyr / nRF Connect SDK on the nRF54L15 (BL54L15µ module; BL54L15 on dev boards). A simple tap device on the `tap-device` branch (Web Bluetooth to a Seeed XIAO nRF52840) exists but is untested.
- Audio: Deepgram Flux cloud ASR with clear disclosure for the MVP (decision 9); benchmark on-device or phone-local recognition before launch.
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
3. **One rhythm, one idea.** Each cue has a single meaning (breathe / give space / slow down / pause / speak up), and the vocabulary stays small: five cues in three families (decisions 12 and 15).
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
- **[CONFIRMED]** Product aesthetic: discreet first, then elegant and premium: a satin metallic grey body and a frosted ear hook (decisions 8 and 16).
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

The identity should be distinctive at small app-icon and product-mark sizes. A speaking profile, quotation/pause form, or signal motif can be explored, but avoid a literal microphone icon if it makes Cue resemble a recording app. Any speaking-person motif should feel inclusive and abstract rather than gendered. Logo work must remain visually coherent with the physical BTE device.

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
- Shipping a complex library of vibration codes (the vocabulary is capped at five cues in three families, decisions 12 and 15).
- Building custom production hardware before validating user value and the behavioral loop.
- Claiming that contact sensing alone can perform robust lexical recognition before evidence exists.
- Promising pre-filler prediction, perfect context detection, or universal accuracy.

## 23. Open technical and product questions

### Detection and ML

- What precision and latency are achievable for filler-use “like” in spontaneous speech?
- Which languages and filler vocabularies are in the first release?
- Can a contact sensor at an acceptable spot behind the ear reliably attribute wearer speech? Can it support lexical recognition or only timing features?
- What is the best microphone/contact-sensor geometry under hair, motion, traffic, wind, and overlapping speech?
- What false-cue rate remains acceptable in interviews or presentations?
- How should Cue detect and score rushing across different natural speech styles?
- Can post-cue behavior be measured without overinterpreting correlation as effect?

### Intervention and behavior

- **[WORKING ASSUMPTION — decision 14]** Fillers tap as a pattern (cluster or rate), not one at a time; a small comparison against the "every filler" testing mode decides. Neither is proven more helpful yet.
- Do the Presentation-mode numbers (decision 11) hold up on real recordings? Cue's syllables/s excludes pauses over 0.6 s, so it reads higher than WPM-based figures.
- What timing maximizes recognition without derailing thought?
- How quickly should feedback fade, and when should booster support return?
- Does haptic intensity vary by context, or should it remain fixed?
- Does Cue help outside practice, and does improvement persist after feedback removal?
- For whom does real-time feedback increase anxiety or worsen fluency?

### Hardware

- Exact BTE placement, ear-hook fit range, clamp force, mass, and all-day comfort.
- Left/right ear strategy and compatibility with glasses, earrings, hair, and headwear.
- Haptic transfer that is clearly felt by the wearer but inaudible nearby.
- Realistic battery life and case recharge count at the required sensing duty cycle.
- Water/sweat resistance, cleanability, skin-contact materials, and drop durability.
- Antenna/RF performance with the battery and any metal touch area close to the antenna.
- Touch area: a small metal spot, or sensing through the matte shell? (Ask Tanisha.)
- Bone sensor: LSM6DSV16BX bone channel or V2S200D, decided after the kit test on real ears.
- BL54L15µ supply: out of stock until about Dec 2026; dev boards use the larger BL54L15 meanwhile.
- Coin-cell protection circuit (not yet in rev 0).
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
- **FCC:** the BL54L15µ has its own modular FCC ID (SQG-BL54L15U). The product still needs unintentional-radiator testing and "Contains FCC ID" labeling, and must stay within the module grant's antenna conditions.
- **Bluetooth SIG** qualification and listing apply.
- **EU RED cybersecurity (EN 18031)** applies to wearables since August 2025.
- **EU Battery Regulation 2023/1542** requires user-removable portable batteries from February 2027; whether the small-wearable exemption covers Cue is unverified. This is an open legal and hardware risk for a soldered coin cell.

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

Cue is a **single, discreet behind-the-ear (BTE) device** with a satin metallic grey body and a thin frosted ear hook—not an ear cuff and not an earbud—that coaches speaking during real conversations. The hero loop is **filler pattern detected in context → private haptic cue → user pauses/slows/speaks up → Cue observes improvement** (tapping on patterns rather than every filler is a working assumption, decision 14). It must distinguish filler “like” from semantic “like,” also address rushing, poor pauses and speaking too quietly, use six rhythm-coded haptic cues in three families (Space, Pace, Voice; decision 12), use the device's touch surface only for on/off and Conversation/Presentation switching (not coaching), avoid cueing every event, and fade feedback to test retained learning. The companion app is simple, supportive, and progress-oriented; everyday mode should favor local processing and derived events rather than stored audio (the MVP's disclosed cloud transcription is a prototype exception, decision 9). Start with the web app and a simple BLE haptic device (decision 10), then validate device sensing, fit, battery, and miniaturization before promising production feasibility. The hardware aesthetic is discreet first (matte, wearer-matched body tones, a thin frosted translucent ear hook, no metallic sheen), then small, elegant, Gen Z–aware, and consistent across all angles, with a one-device charging case. `US20240144956A1` was abandoned in April 2026 but remains prior art; Cue is not patent-cleared, and its adaptive intervention/learning loop is the more interesting differentiation. Preserve confirmed choices, label assumptions, and do not overclaim.

## 26. Decision log

Changes to **[CONFIRMED]** decisions, newest first (rule 10 in §24).

### 2026-10-05 — Owner decisions for the software MVP

16. **The body is satin metallic grey.** Amends decision 8's matte, hair-matched body: the shell is a grey with a soft brushed-metal sheen, not a mirror or chrome finish. The ear hook stays frosted translucent, and discreetness still comes first: no gloss or chrome. *Previously:* an opaque matte body in hair-matched tones (dark brown, then matte black on the site). *Rationale:* owner preference; a satin rather than polished finish keeps the sheen soft so it draws less attention.

15. **Repeated words are not coached.** Cue no longer detects or taps for accidental repetition ("I, I, I think", "and then, and then"), and its "rattle" cue is gone, leaving five cues; the Pace family is rushing alone. *Previously:* repetition counted toward the filler pattern in Conversation, with its own rattle cue (decision 12), and was shown after the session in Presentation. *Rationale:* owner decision: the behavior and its fix (pause, then restart the sentence) were unclear to users, and the fix is the same pause the filler cue already asks for.

14. **Tapping on filler patterns, not every filler, is a working assumption to test.** The default stays patterns (`SOFTWARE.md` §7); a small comparison against the "every filler" testing mode decides. *Previously:* **[OPEN QUESTION]** "Should the first cue follow a single high-confidence filler or only a cluster?", while the app already defaulted to patterns. *Rationale:* neither is proven more helpful yet; patterns avoid irritating users, but a reactive cue may teach the association faster.
13. **Too quiet uses a calibrated volume per mode.** The user sets the target with a short read-aloud ("Set my volume") for each mode, saved on this device only as one loudness number per mode (no audio). Too quiet = at least 6 dB below that target, adjusted for room noise (0.6 dB per dB of noise change, capped at ±10 dB), for 3 s in Conversation or 10 s in Presentation. Without a calibration for the current mode, too-quiet cues are off and the app asks the user to set their volume. *Previously:* decision 3 measured against "the wearer's own normal level", learned from the first 15 s of each session. *Rationale:* a session can't tell whether a person's own normal is already too quiet, so the user sets the target.
12. **Six distinct haptics in three families.** Supersedes decision 1's three rhythms. Space: no pause → one tap, long turn → two knocks. Pace: rushing → slow steps (repetition → rattle was removed by decision 15). Voice: filler pattern → tap and hum, too quiet → long push (rhythms and actions in §5). Every cue starts with a sharp onset; confirmations stay smooth ramps. A "Simpler cues" setting plays only each family's root. *Previously:* three rhythms (one tap, two taps, long pulse) with a single-tap setting. *Rationale:* rhythm is the strongest vibrotactile dimension (Brown, Brewster & Purchase 2006); family-based icon sets reach 80–95% identification (Chan, MacLean & McGrenere 2005; Enriquez & MacLean 2008, 86% retained at two weeks); about five patterns is the ceiling on one actuator (Azadi & Jones 2013). Expected ~85–92% after 5–15 minutes of practice, lower mid-conversation. Kept as a **[WORKING ASSUMPTION]**: planned pilot of at least 8 users, merge any pair confused more than 15% of the time; bench checks on the VG0832013D still open.
11. **Presentation mode, research-based.** Live: rushing (4.0 syl/s, or 10% over the person's own baseline), no pause (22 s without a ≥0.6 s pause), filler rate (um/uh above 5 per minute over a rolling 60 s; "like"/"lowkey" count half; no cluster rule; single fillers never tap), and too quiet (against the Presentation calibration). Not live: long turn (a talk is one long turn). (Repetition was also not live; it was removed entirely by decision 15.) Taps are at least 25 s apart and at most 2 per minute; when several are due, only the highest priority taps: rushing > no pause > filler > too quiet. Conversation is unchanged: 3 fillers within 12 s or 8 per minute, 15 s cooldown (setting 10–20 s), no pause 30 s, long turn 90 s. *Previously:* "a meeting/presentation mode with a higher intervention threshold", and Presentation changed only the pace threshold. *Rationale:* Rhema (Tanveer et al., IUI 2015: sparse ~20 s feedback beat continuous); Logue (Damian et al., CHI 2015: rate was the effective live signal); Laske et al. 2024 (fillers hurt ratings around 5–12 per minute, mostly um/uh); PowerPoint Speaker Coach (100–165 WPM, repetition reported afterwards); O'Leary & Wingfield 2023 (pauses at phrase boundaries aid recall). The numbers are starting points to test; Cue's syllables/s excludes pauses over 0.6 s, so it reads higher than WPM-based figures, and the 4.0 default needs checking against real recordings.
10. **The web app is the MVP platform.** Bluetooth to the device uses Web Bluetooth (Chrome on Android and desktop; not iPhone). Native iOS comes later. *Previously:* **[WORKING ASSUMPTION]** "native iOS first" (§17). *Rationale:* the web app already exists and runs the full loop; Web Bluetooth reaches the device without an app-store build.
9. **Cloud ASR for the MVP only.** Live audio streams to Deepgram Flux (`flux-general-en`) for the prototype and pilots, with clear disclosure. Move toward on-device or phone-local recognition before launch. *Previously:* **[WORKING ASSUMPTION]** "MVP live inference should be phone-local wherever practical", with cloud only for experiments. *Rationale:* Flux keeps fillers and returns results fast enough to test the behavior loop now. The **[CONFIRMED]** rule that Cue "should not depend on continuously uploading conversations" stands for the product; the prototype is a disclosed exception.

### 2026-10-05 — Discreetness first: matte, wearer-matched finishes

8. **Discreetness is the top industrial-design priority, so finishes are matte and matched to the wearer, not metallic.** *Previously:* **[CONFIRMED]** "Metallic finishes are preferred" and "offer metallic, jewelry-like color variants." *Rationale:* shine is what draws the eye, more than color or shape, and the ear hook crossing the top of the ear is the part people see; the body mostly sits hidden behind the ear and in the hair. The spec:
   - **Ear hook:** a nickel-titanium (nitinol) wire core of about 1 mm, in a thin **frosted (matte) translucent** sleeve of silicone or non-yellowing (aliphatic) TPU with a faint neutral or smoke tint that hides the core. Frosted, not glossy clear: glossy clear glints, and yellows and clouds with sweat, skin oil, and UV. The hook sits close to the head, curves only as far as it needs to grip, and nothing rises above the top of the ear. Nitinol springs back after bending to fit each ear and holds the device at this thickness.
   - **Body:** opaque (a transparent body would show the electronics), matte, in a small range of hair-matched tones, and as small as the battery allows.
   - **Later options:** matte skin- or hair-matched hooks as optional extras, using a separable snap-on hook.
   - **Metal:** kept to small details, such as the touch area or the logo, if at all.

   Still true: it should read as premium consumer hardware rather than a hearing aid when it is noticed. Materials, tints, and dimensions remain to be validated with prototypes on a range of skin tones, hair colors, and hairstyles.

### 2026-10-05 — Form factor: behind-the-ear, not an ear cuff

7. **Cue is a behind-the-ear (BTE) device, not an ear cuff.** The hardware CAD (`hardware/rev0/democad.step`) has the body behind the ear on an ear hook, the hearing-aid BTE form factor, and the LRA motor on the skin side behind the ear. *Previously:* **[CONFIRMED]** "Cue is an ear cuff." *Rationale:* the documents and app now describe the hardware being built. Still true: single ear, nothing in or blocking the ear canal, never an earbud, and it should read as premium consumer hardware rather than a hearing aid. Earlier entries and source documents that say "cuff" refer to this same device.

### 2026-10-04 — Hardware roles for wearer verification

6. **The device's bone-conduction sensor verifies who is speaking; there is no software voice detection.** Roles: the **bone-conduction sensor** confirms when the wearer's own voice is vibrating through the skull (wearer voice activity); the **microphone** captures audio for speech-to-text, which hears everyone; a **vibration motor behind the ear** delivers the taps. The software coaches only words the bone sensor confirms. Removed from the software: speaker labels (diarization), loudness-based attribution, voice calibration, and any voice profile, so `SOFTWARE.md` §4's open question is closed: **no voiceprint**. *Rationale:* physical coupling identifies the wearer more reliably and privately than voice matching. *Consequences:* the bone sensor becomes a required part (rev 0: the LSM6DSV16BX's bone-conduction channel; Knowles V2S200D optional, DNP; chosen after the kit test); whether a comfortable spot behind the ear gives a clean enough bone signal remains to be validated on hardware (§12 Option C/D); the web prototype has no bone sensor, so it treats all speech as the wearer's.

### 2026-10-04 — Software system spec adopted

5. **`SOFTWARE.md` is canonical for software behavior.** Cue is a behavioral coaching system, not a filler detector: a decision engine asks "would a tap help right now?" using filler density and clusters, pace against the wearer's own baseline, time without a pause, repetition, and speaking-turn length, with 10–20 s cooldowns, high confidence, and checks on whether a tap worked. *Where it conflicts with earlier decisions:* the three-rhythm haptic vocabulary (decision 1) stands over `SOFTWARE.md` §18's single universal tap; whether to add an opt-in stored voice profile (`SOFTWARE.md` §4) is an **[OPEN QUESTION]** *(closed by decision 6: no voice profile)*; no voiceprint is stored today.

### 2026-10-03 (later) — Touch for controls

4. **Touch input returns, for controls only.** Amends decision 2 below. The device gets a touch surface for **on/off (long press)** and **switching Conversation / Presentation mode (double tap)**, confirmed by vibration *ramps* that can't be confused with coaching taps. Touch is still **not** used mid-conversation for coaching (e.g. no self-catch tap). *Rationale:* these are occasional controls between conversations, not something the wearer must do while talking; gestures are deliberately few and hard to trigger by accident (people touch their ears often). The rev 0 hardware's Qvar shell-electrode touch (with IQS227 fallback) fits this.

### 2026-10-03 — Owner decisions during software MVP development

1. *(Superseded by decision 12, now five cues in three families after decision 15.)* **Three haptic rhythms instead of one tap.** Previously **[CONFIRMED]** "Tap = make space" as the single default cue. Now: one tap = filler (pause), two quick taps = too fast (slow down), one long pulse = too quiet (speak up). *Rationale:* each behavior asks for a different action, and a single tap can't say which; rhythm is the most reliably distinguished vibrotactile dimension. Kept as a **[WORKING ASSUMPTION]** to validate with users; the single-tap mode stays available as a setting and test condition.
2. **No button or touch input on the device.** *(Amended by decision 4: touch is back for controls only.)* Previously a **[WORKING ASSUMPTION]** of capacitive touch for self-caught events and pause/mute. *Rationale:* the wearer won't have anything to press mid-conversation; controls live in the app. *Consequence:* the **[CONFIRMED]** goal "device-caught events fall while self-caught events rise" still stands, but self-catches must be inferred from speech (**[OPEN QUESTION]**). The software MVP's "I caught it" button was removed for the same reason.
3. **Detect speaking too quietly.** New **[CONFIRMED]** target behavior, measured against the wearer's own normal level. Speaking too loudly is out of scope.
