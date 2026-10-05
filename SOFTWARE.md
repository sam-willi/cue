# Cue Software System

> **Purpose:** Canonical description of how Cue's software should behave. Read together with [`CUE_CONTEXT.md`](./CUE_CONTEXT.md) (product context and decisions) and [`DESIGN.md`](./DESIGN.md) (visual and interaction design).
>
> **Added:** 2026-10-04, as written by the product owner.
>
> **Where this document conflicts with a later owner decision**, the decision wins and is recorded in `CUE_CONTEXT.md` §26:
>
> - **§18 Haptic language:** the owner chose **three rhythms** (one tap = pause, two taps = slow down, long pulse = speak up), not a single universal tap. A one-tap mode remains a setting and a test condition.
> - **§4 Speaker identification:** resolved by hardware (`CUE_CONTEXT.md` §26, decision 6). The cuff's **bone-conduction sensor** verifies when the wearer is speaking, the **microphone** captures audio for speech-to-text, and a **vibration motor behind the ear** delivers taps. There is no software voice detection and no voice profile.
> - **§21–23 Processing and privacy:** the software MVP streams audio to Deepgram for transcription; on-device processing is the long-term direction.

Cue should not be designed as a simple filler-word detector.

The basic problem of recognizing words like “um,” “uh,” “like,” and “you know” is already solved by multiple speech-coaching apps. Several existing products can transcribe speech in real time, detect filler words, and even provide immediate feedback through a phone, computer, or Apple Watch.

Cue needs to go one level deeper.

The software should function as a real-time behavioral coaching system for speech. Its job is not simply to notice every undesirable word. Its job is to understand how someone is speaking, identify moments where intervention would actually help, and provide a subtle physical cue at the right time.

The core question Cue should continuously answer is:

> “Would giving the user a tap right now help them speak more intentionally?”

That is a much more interesting problem than:

> “Did the user just say ‘um’?”

## 1. The basic Cue loop

At the highest level, Cue should work like this:

```text
User speaks
↓
Cue captures the user’s voice
↓
Speech is processed continuously
↓
Cue identifies words, pauses, pacing, and speech patterns
↓
Cue determines whether something is actually undesirable
↓
Cue considers the user’s recent speaking behavior
↓
Cue decides whether intervention would be useful
↓
Cue gives a subtle haptic tap
↓
User becomes aware of their speech
↓
User pauses, slows down, or changes their behavior
```

Over time, the goal is for users to start catching these behaviors themselves before Cue even has to intervene.

That last part is extremely important.

Cue should not become something users depend on forever. It should act more like training wheels for intentional speech.

## 2. Continuous audio processing

While Cue is active, the device should continuously listen to the user's speech.

That does not mean Cue needs to record conversations.

Ideally, audio is processed temporarily and discarded as soon as the necessary features have been extracted.

For example:

```text
Microphone audio
↓
Temporary audio buffer
↓
Speech processing
↓
Extract useful information
↓
Delete raw audio
```

The temporary buffer might only contain several seconds of audio at any given time.

Cue needs enough context to understand a sentence, but there is little reason to permanently save a conversation.

This would create an important privacy position:

> Cue listens to how you speak, not what you say.

The device needs language information temporarily because detecting fillers requires some understanding of words, but the product should be designed so conversations do not become a permanent audio archive.

## 3. Voice activity detection

Before Cue performs expensive speech recognition, it should determine whether someone is actually speaking.

This is called voice activity detection, or VAD.

The system continuously classifies the microphone input as something like:

- silence
- speech
- background noise
- music
- environmental sound

This prevents Cue from wasting battery processing random environmental audio.

For example:

Someone sits silently for 30 seconds. Cue does almost nothing. The person begins speaking. Cue recognizes speech activity and activates the rest of the analysis pipeline. When they stop speaking, Cue reduces processing again.

This is especially important for an ear-worn product because battery life will be limited.

## 4. Speaker identification

One of the biggest challenges for Cue is determining:

> Who is actually speaking?

If Sam is having dinner with three people, Cue cannot vibrate every time someone else says “like.”

Cue needs to distinguish the wearer from everyone around them.

There are several possible ways to do this.

The user could complete a short voice calibration when they first set up Cue. They might read something like:

> “Cue helps me speak clearly and intentionally during conversations.”

The software uses that sample to generate a representation of the user's voice. During conversations, Cue compares incoming speech against that voice profile.

The system might calculate something like:

```text
Probability current speaker is Sam: 94%
```

If confidence is high, Cue analyzes the speech. If confidence is low, Cue ignores it.

Because Cue is ear-worn, hardware could eventually make this easier too. The device could potentially use:

- directional microphones
- bone-conduction sensing
- vibration through the ear or skull
- multiple microphones
- proximity information

Those signals could help differentiate the wearer’s voice from other people nearby.

For the MVP, however, speaker recognition can probably be handled primarily through software.

## 5. Speech-to-text

Once Cue knows that the wearer is speaking, it needs some representation of what they are saying.

The easiest way to do this initially is real-time speech-to-text.

For example:

```text
Audio:
“So I was like thinking that maybe we could um move the meeting.”

Speech-to-text:
So I was like thinking that maybe we could um move the meeting.
```

Cue does not necessarily need perfect transcription.

This is important.

A normal transcription service is judged on whether it reproduces every sentence perfectly. Cue has a different goal. Cue mainly needs enough accuracy to detect:

- filler words
- repeated words
- sentence fragments
- speech rate
- pauses
- hesitation patterns
- excessive talking
- possibly vocal confidence signals

If it misunderstands “meeting” as “meaning,” that may not matter. If it fails to recognize “um,” that matters much more.

This means Cue's speech-processing system should eventually be optimized specifically for behavioral speech events, not just normal transcription accuracy.

## 6. Filler detection

The simplest Cue feature is filler-word detection.

Cue should recognize common fillers such as:

- um
- uh
- erm
- ah
- like
- basically
- literally
- actually
- so
- you know
- I mean
- kind of
- sort of
- right

But there is a critical distinction. Cue cannot simply detect whether a word appeared. It needs to determine whether the word is being used as a filler.

Consider:

> “I like this idea.”

The word “like” is grammatically necessary. Cue should do nothing.

Now consider:

> “It was, like, really uncomfortable.”

Here “like” may be functioning as a filler. Cue might count it.

Another example:

> “So what happened next?”

“So” introduces the sentence naturally. Versus:

> “So... um... so... basically what I mean is...”

Now “so” is part of a hesitation pattern.

This means filler detection should be contextual. Cue should consider:

- where the word appears
- nearby pauses
- nearby words
- repetition
- sentence structure
- speaking rhythm
- the user's normal speech habits

The output should not simply be:

```text
Word "like" detected.
```

It should look more like:

```text
Probability "like" was used as a filler: 87%.
```

Cue can then decide whether that event matters.

## 7. Filler density matters more than individual fillers

One of the biggest improvements Cue can make over basic filler detectors is avoiding intervention every single time a filler appears.

Imagine Cue vibrating every time someone says “um.” That would become irritating almost immediately.

People also naturally use occasional fillers. The goal should not be robotic speech.

Instead, Cue should monitor filler density. For example, in the last 60 seconds:

- 1 filler: probably fine
- 3 fillers: slightly elevated
- 7 fillers: noticeable pattern
- 12 fillers: intervention probably useful

Cue could calculate something like fillers per minute, or fillers per 100 words.

It could also use shorter windows. For example, 3 fillers within 12 seconds could trigger a tap even if the overall conversation has been clean.

This allows Cue to respond to patterns, not isolated mistakes.

## 8. Speaking rate

Cue should continuously estimate how quickly the user is speaking.

For example:

```text
Normal pace: 145 words per minute
```

Then during an interview:

```text
Current pace: 192 words per minute
```

Cue recognizes that the person is rushing. Instead of waiting for a filler word, Cue could give a tap.

The meaning of the tap is not necessarily “You just made a mistake.” It could simply mean: “Slow down. Pause. Reset.”

This makes Cue useful even for someone who barely uses filler words.

Speaking-rate detection could also be personalized. A naturally fast speaker should not be judged using the same threshold as a naturally slow speaker. Cue should learn the individual's baseline.

## 9. Pause detection

One of Cue's most important ideas should be teaching people to become comfortable with silence.

People often say “um” because they are uncomfortable leaving a pause. Cue could actively train users to replace fillers with silence.

The software should detect:

- average pause length
- number of intentional pauses
- number of hesitation pauses
- extremely long stretches without pausing
- fillers immediately replacing potential pauses

For example: a user has spoken continuously for 37 seconds without pausing. Cue could recognize that they are rushing through a long explanation. Tap. The user pauses. Then continues.

Over time, Cue reinforces: thinking silently is better than filling the silence.

That should be one of the central behavioral principles behind the product.

## 10. Repetition detection

Another useful signal is repeated language. People often get stuck in patterns such as:

> “I think, I think, I think what I'm trying to say is...”

> “It's basically, basically this idea where...”

> “And then, and then, and then we went...”

Cue could detect repeated words or phrases within a short time window.

Again, the device should not tap for every repetition. It should determine whether the repetition appears accidental or habitual.

A phrase like “very, very important” may be intentional. But “I, I, I think” likely indicates hesitation.

## 11. Long speaking turns

Cue could eventually help people become better conversationalists, not just cleaner speakers.

One useful metric is continuous speaking duration.

Imagine someone at dinner has been talking uninterrupted for 90 seconds. Cue could give a gentle tap. Not because they said anything incorrect. The tap could mean: “Maybe give the other person space.”

This would allow Cue to coach:

- interviews
- dates
- networking
- meetings
- classroom discussions
- social conversations

This starts expanding Cue beyond public speaking. The product becomes a tool for communication awareness. That is a significantly larger vision.

## 12. The behavioral engine

This should be the heart of Cue.

The speech system generates signals. For example:

```text
Current filler rate: 8.2/min
Baseline filler rate: 3.1/min

Current pace: 186 WPM
Baseline pace: 148 WPM

Time since meaningful pause: 31 sec

Repeated phrase detected: true

User spoke 72% of last 3 minutes

Confidence user is speaking: 97%
```

But these signals should not automatically produce haptics. Instead they enter a behavioral decision engine. That engine asks:

> Would a tap help right now?

The decision engine might consider:

```text
Is the behavior significantly outside the user's baseline?
Has Cue already tapped recently?
Is the user currently in the middle of a sentence?
Is this behavior repeating?
How confident is Cue in the detection?
What behaviors has the user asked Cue to train?
Has the user been improving?
Would another tap become annoying?
```

Only then does Cue decide whether to intervene.

This is probably the most important piece of Cue's software.

## 13. Intervention cooldowns

Cue should never become distracting.

Suppose someone says: “Um, so, like, basically...”

Technically Cue might detect four different problems in five seconds. It should not vibrate four times. Instead: first meaningful problem detected. Tap. Then Cue enters a cooldown period, maybe 10 to 20 seconds without another tap.

The precise cooldown can eventually adapt.

If Cue recently tapped because the user was rushing, and the user slowed down, then Cue should recognize that the intervention worked. If they continue rushing for another minute, another tap might be appropriate.

This creates a much more human coaching system.

## 14. Confidence thresholds

Cue should only intervene when reasonably confident.

False positives are especially damaging for a product like this. If Cue taps when someone did nothing wrong, they may think: “Wait, what did I do?” That breaks trust.

So Cue should favor precision over extreme sensitivity. For example:

```text
58% confidence filler detected → do nothing.
94% confidence filler pattern detected → potential tap.
```

Users should feel: “When Cue taps me, there's usually a reason.”

That trust is critical.

## 15. Personalization

Cue should become increasingly personalized over time.

When someone first uses the product, Cue could ask what they want to work on. For example:

- **Filler words:** reduce “um,” “uh,” and “like.”
- **Pace:** stop rushing.
- **Pauses:** become comfortable with silence.
- **Conciseness:** avoid overly long responses.
- **Repetition:** reduce repeated phrases.
- **Conversation balance:** avoid dominating conversations.

The user might choose two or three. Cue then prioritizes those behaviors.

Someone preparing for consulting interviews may care about fillers, pace and concise responses. Someone who speaks too quickly socially may care about pace and pauses. Someone who wants to become a better conversationalist may care about conversation balance, rambling and interruptions.

The same hardware can therefore become different coaches for different people.

## 16. Learning the user's baseline

Cue should not assume everyone needs to speak the same way.

During the first few sessions, it should learn things such as Sam's baseline:

- 148 words/minute
- 4.3 fillers/minute
- average pause: 0.7 seconds
- most common filler: “like”
- second most common filler: “um”
- average continuous speaking segment: 18 seconds

Then Cue can measure improvement relative to the person. Maybe after two weeks:

- 151 words/minute
- 1.8 fillers/minute
- average pause: 1.2 seconds

Cue can show: 58% reduction in filler words.

That is much more meaningful than telling everyone they should speak at exactly the same rate.

## 17. Adaptive coaching

Eventually, Cue should adapt how much it intervenes.

At first, the user says fillers constantly and Cue taps relatively frequently. After two weeks, the behavior improves and Cue becomes less aggressive. Eventually Cue might only intervene when the behavior becomes unusually bad.

This is similar to how training wheels gradually become unnecessary. The product should reward internal awareness. The ideal outcome is:

- **Week 1:** Cue catches the habit.
- **Week 2:** User notices the tap immediately.
- **Week 4:** User begins noticing the behavior before Cue taps.
- **Week 8:** User pauses naturally without thinking.

At that point, Cue has actually changed behavior. That should be the product's ultimate goal.

## 18. Haptic language

> **Superseded by owner decision (2026-10-03, `CUE_CONTEXT.md` §26):** Cue uses three rhythms (one tap = pause, two taps = slow down, long pulse = speak up), with a one-tap mode as a setting. The original text follows.

Cue could eventually use different haptic patterns. However, the MVP should probably remain simple.

One subtle tap could mean: Pause. Think. Continue.

That simplicity is valuable. You don't want someone thinking during a conversation: “Was that two short vibrations followed by a long one? Does that mean pace or fillers?” That defeats the purpose.

Over time, Cue could test whether two or three patterns are useful. For example: single soft tap = slow down or pause; double tap = repeated pattern or excessive filler use.

But the initial product should probably have one universal intervention. The user doesn't necessarily need to know exactly what mistake occurred during the conversation. The goal is simply: become conscious of your speech again.

## 19. The phone app

The physical Cue device handles the immediate intervention. The phone app should handle reflection and long-term improvement.

- During a conversation: ear device = coach.
- After the conversation: app = analysis.

The app could show:

```text
Today's conversation
Duration: 24 min
Cue taps: 6
Fillers: 18
Average pace: 156 WPM
Longest speaking turn: 48 sec

Most common filler
“like” — 11 uses.

Improvement
Fillers down 31% this week.

Coaching insight
You tend to use fillers when your speaking pace exceeds 175 WPM. Slowing down may reduce your fillers naturally.
```

That is much more valuable than just showing graphs. The software should identify relationships. For example:

- “Your filler rate doubles when you speak faster than 180 WPM.”
- “Most of your ‘um’ usage occurs after speaking continuously for more than 20 seconds.”
- “Your filler use has dropped, but you are replacing fillers with repeated words.”

Those insights make Cue feel intelligent.

## 20. Sessions and modes

Cue probably should not listen continuously 24/7 at first. The user could start a Cue Session, for example: Interview, Presentation, Meeting, Date, Networking, Class, Practice.

Different modes could eventually change the coaching rules.

- **Presentation:** pace matters; filler words matter; pauses matter; speaking-turn length does not.
- **Date:** long speaking turns matter; interruption balance matters; excessive filler correction might matter less.
- **Interview:** fillers matter; pace matters; rambling matters; concise answers matter.

That could eventually become a powerful system. For the MVP, however, a generic session mode is enough.

## 21. On-device vs phone processing

For the first version of Cue, it probably does not make sense to put an entire AI speech model inside the ear cuff. The hardware should stay small, lightweight, and power-efficient.

A practical architecture could be:

```text
Cue microphone
↓
Bluetooth audio stream
↓
Phone
↓
Speech recognition + behavioral analysis
↓
Decision made
↓
Bluetooth command
↓
Cue haptic motor taps the user
```

This allows the phone to perform the heavy computation. Later, some processing could move onto the Cue hardware, for example voice activity detection, wearer voice detection, and basic acoustic features. More expensive language processing could remain on the phone.

## 22. Latency

Latency is extremely important. If Cue detects “um” and vibrates three seconds later, the feedback becomes confusing. The user may already be halfway through another sentence.

Cue should ideally intervene within roughly hundreds of milliseconds to perhaps around one second, depending on the behavior. For fillers, immediate response matters. For pace or rambling, slightly slower analysis is fine.

This means Cue cannot depend entirely on slow cloud APIs. Eventually, the product should prioritize on-device speech recognition, local inference, streaming transcription, and lightweight models rather than uploading every sentence to a remote server and waiting for a response.

## 23. Privacy

Privacy could become one of Cue's biggest differentiators. An always-listening wearable sounds creepy unless the architecture is extremely clear.

Cue should aim for:

- No permanent audio recordings.
- No human review.
- No selling conversation data.
- Raw audio deleted immediately after processing.
- Speech analysis performed locally whenever possible.

The product language could emphasize: “Cue listens for how you speak, not what you say.”

Users may optionally choose to save transcripts for practice sessions, but normal conversation mode should probably avoid storing them entirely. The default experience should be privacy-first.

## 24. The MVP

The MVP should not attempt every feature described above. The goal should be proving one thing:

> Can real-time physical feedback meaningfully change someone's speech behavior?

A realistic MVP could include:

- **Input:** phone microphone or prototype Cue microphone.
- **Speech recognition:** streaming speech-to-text.
- **Detect:** um, uh, like, repeated fillers, speaking pace.
- **Decision system:** do not vibrate for every filler. Instead calculate filler density, identify rapid clusters, identify excessive pace, use cooldown periods, require high confidence.
- **Output:** a Bluetooth wearable or simple haptic prototype vibrates.
- **App:** shows filler count, filler rate, speaking pace, number of Cue interventions, and improvement over sessions.

That is enough to test the fundamental behavior loop.

## 25. MVP example

Imagine Sam begins an interview. She starts a Cue session.

For the first minute: pace 145 WPM, fillers 1, Cue taps 0. Everything is normal.

Then she gets asked a difficult question. Her pace jumps to 189 WPM. She says:

> “So, um, I was like working on this project and, um...”

Cue detects: pace significantly above baseline; three fillers in a short window; increasing hesitation.

Instead of vibrating three times, Cue's behavioral engine decides: intervention useful, yes. Cue gives one gentle tap.

Sam notices. She pauses for one second. Then continues:

> “The main challenge we faced was actually customer adoption.”

Her pace drops to 155 WPM. Cue sees that the behavior improved. No additional tap.

That interaction is what Cue should be built around.

## 26. What makes Cue different

Existing speech apps largely fall into three categories.

- **Post-session analysis:** you speak; the app tells you afterward, “You said ‘um’ 19 times.” Useful, but the behavior has already happened.
- **Screen-based real-time coaching:** a screen shows “Slow down” or “Filler word detected.” Useful, but requires looking at a phone or computer.
- **Simple haptic detection:** a filler word is detected and your watch vibrates. This gets closer to Cue, but still treats speech coaching mostly as word detected → buzz.

Cue should be different. Cue should understand speech behavior over time. The core product is:

> speech understanding + behavioral modeling + intelligent intervention.

Not:

> filler detector + vibration motor.

## 27. The long-term vision

Cue could eventually understand a large number of communication behaviors. Not just “Did you say um?” but:

- Are you rushing?
- Are you rambling?
- Are you uncomfortable with silence?
- Are you repeating yourself?
- Are you dominating the conversation?
- Are you interrupting people?
- Are your answers becoming less concise?
- Are your speech habits becoming worse because you're nervous?
- Are you improving over time?

Eventually Cue could even recognize context. The device might know: Sam is speaking 35% faster than her normal rate and using three times as many fillers. That might suggest nervousness. Cue doesn't need to diagnose the emotion. It simply gives a subtle signal: pause.

That one physical cue could interrupt the entire pattern.

## 28. The most important product principle

Cue should never try to make users speak perfectly. Perfect speech would sound unnatural. People use fillers. People pause awkwardly. People repeat themselves. That is normal.

Cue should instead help people recognize when those behaviors stop being intentional. The product philosophy should be:

> Cue does not tell you what to say. It reminds you to be intentional about how you say it.

The software should therefore optimize for useful intervention, not maximum detection.

The best Cue system is not the one that detects the most mistakes. It is the one that knows when not to tap.

That is where the real product intelligence should live.
