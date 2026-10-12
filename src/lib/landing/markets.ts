/**
 * Copy for the painted-door landing pages at /for/<slug>: one page per market, same layout,
 * so the only thing that differs between them is who the page speaks to.
 *
 * Copy rules (CUE_CONTEXT.md §18, §20, §24; DESIGN.md §17): no numeric claims, nothing that
 * implies sensing or accuracy is proven, no "sound smarter", and Cue is always one
 * behind-the-ear device. Cue's live cues coach delivery (pauses, pace, volume, filler words).
 * The English page also offers grammar help in the report (owner decision, 2026-10-11): that
 * is not built, and the page is how we find out whether people want it.
 */

export type MarketKind = "early-access" | "pilot";

export interface Market {
  slug: string;
  /** Internal name, saved with each sign-up. */
  name: string;
  kind: MarketKind;
  eyebrow: string;
  headline: string;
  lead: string;
  cta: string;
  /** Who wears the device: the reader, or (for schools) the reader's students. */
  wearer: "you" | "students";
  problemTitle: string;
  problems: { title: string; body: string }[];
  /** Where each cue lands for this audience, shown under what the cue detects. */
  moments: { label: string; pause: string; slow: string; speak: string };
  report: { title: string; body: string };
  /** Report areas this page lists after the standard ones. */
  extraReportAreas?: string[];
  faq: { q: string; a: string }[];
  metaTitle: string;
  metaDescription: string;
}

export const MARKETS: Market[] = [
  {
    slug: "speaking",
    name: "Executive coaches / public speaking",
    kind: "early-access",
    eyebrow: "For speakers and speaking coaches",
    headline: "Coaching that comes into the room with you.",
    lead: "You practice the pause, then the stakes rise and the old habits come back. Cue is a discreet behind-the-ear wearable that taps you privately, mid-sentence, when you rush, skip a pause or lean on filler words.",
    cta: "Join early access",
    wearer: "you",
    problemTitle: "Why practice alone doesn’t fix it",
    problems: [
      {
        title: "Rehearsal isn’t the room",
        body: "Habits you fixed in practice return under pressure, when your attention is on the audience and not on your delivery.",
      },
      {
        title: "Feedback arrives too late",
        body: "A recording or a debrief tells you what happened after the talk. By then the moment to change it has passed.",
      },
      {
        title: "A coach can’t be at every talk",
        body: "Between sessions, clients are on their own. Cue carries the same few prompts into the meetings and stages a coach never sees.",
      },
    ],
    moments: {
      label: "In a talk",
      pause: "Moving from one point to the next without letting the first one land.",
      slow: "The opening minute, when adrenaline sets the pace.",
      speak: "Trailing off at the end of a sentence.",
    },
    report: {
      title: "Something concrete to bring to your next session",
      body: "After each talk, Cue reports on pauses, pace, volume, filler words and pitch, with up to three things to work on first.",
    },
    faq: [
      {
        q: "I’m a coach. Can I use Cue with clients?",
        a: "That’s one of the uses we’re building for. Join early access and we’ll ask how you work with clients before we send anything out.",
      },
    ],
    metaTitle: "Cue for speakers and speaking coaches",
    metaDescription:
      "A discreet behind-the-ear wearable that taps you privately, mid-sentence, when you rush, skip a pause or lean on filler words.",
  },
  {
    slug: "sales",
    name: "Sales",
    kind: "early-access",
    eyebrow: "For sales reps",
    headline: "Slow the pitch. Leave room for the buyer.",
    lead: "On a live call, it’s easy to rush, run long and fill every silence. Cue is a discreet behind-the-ear wearable that taps you privately in the moment: pause, slow down, speak up.",
    cta: "Join early access",
    wearer: "you",
    problemTitle: "Why call reviews don’t fix it",
    problems: [
      {
        title: "Call reviews come a day late",
        body: "Recordings and scorecards show you what went wrong after the conversation is over.",
      },
      {
        title: "Nerves set the pace",
        body: "A big meeting or a cold open speeds you up. Fast talk leaves the buyer no room to think or answer.",
      },
      {
        title: "Long turns become monologues",
        body: "When one answer runs on, the buyer stops taking part. It’s hard to notice until you hear the recording.",
      },
    ],
    moments: {
      label: "On a call",
      pause: "After you ask a question, when the urge is to keep talking.",
      slow: "The first half-minute of a cold call.",
      speak: "Getting quieter as you name the price.",
    },
    report: {
      title: "A report after every call",
      body: "Pauses, pace, volume, filler words and your longest stretch without a pause, with up to three things to work on first. Useful on your own, or as a starting point with your manager.",
    },
    faq: [
      {
        q: "Does it work on phone and video calls?",
        a: "Cue is being built to coach only the wearer’s voice, so the plan is for it to work the same in person and on a call. We’re testing that now.",
      },
      {
        q: "Is this for one rep or a whole team?",
        a: "Either. Join with your work email and we’ll ask about team size before early access opens.",
      },
    ],
    metaTitle: "Cue for sales",
    metaDescription:
      "A discreet behind-the-ear wearable that taps you privately on live calls: pause, slow down, speak up.",
  },
  {
    slug: "schools",
    name: "Schools",
    kind: "pilot",
    eyebrow: "For schools and speech programs",
    headline: "Individual speaking feedback for every student.",
    lead: "One teacher can’t coach thirty speakers at once. Cue gives each student a private cue while they’re speaking and a short report afterwards, so class time goes to what the feedback means.",
    cta: "Request a pilot",
    wearer: "students",
    problemTitle: "Why speaking feedback is hard to give",
    problems: [
      {
        title: "Feedback doesn’t scale",
        body: "Individual notes on every presentation take hours a teacher doesn’t have. Most students get a grade and a sentence.",
      },
      {
        title: "It comes after the speech",
        body: "Notes a week later are hard to connect to what a student did at the front of the room.",
      },
      {
        title: "Correcting in public costs confidence",
        body: "Stopping a student mid-speech in front of classmates is hard on them. A cue only they feel isn’t.",
      },
    ],
    moments: {
      label: "In class",
      pause: "Racing from one point to the next in a presentation.",
      slow: "A debate rebuttal against the clock.",
      speak: "A quiet voice in a large classroom.",
    },
    report: {
      title: "A report students can act on",
      body: "Each student gets a report on pauses, pace, volume and filler words, with up to three things to work on first. It describes habits; it doesn’t grade the student.",
    },
    faq: [
      {
        q: "How would a pilot work?",
        a: "We’d start small: one class or one team, a few devices, a few weeks. We’ll plan it with you, including consent and how student data is handled, before any student wears one.",
      },
      {
        q: "Is Cue suitable for students with speech or language needs?",
        a: "Cue is a general speaking-habit tool, not a clinical or therapeutic device, and it isn’t a substitute for speech-language support.",
      },
    ],
    metaTitle: "Cue for schools and speech programs",
    metaDescription:
      "A private cue for each student while they speak, and a short report afterwards. Request a pilot for your class or team.",
  },
  {
    slug: "english",
    name: "Language learners",
    kind: "early-access",
    eyebrow: "For English learners",
    headline: "Know how you sound while you’re still speaking.",
    lead: "When you speak English, your attention goes to finding the words. It’s hard to notice that you’re rushing, getting quieter or repeating the same grammar slips. Cue is a discreet behind-the-ear wearable that taps you privately in the moment, then shows you the grammar to work on afterwards.",
    cta: "Join early access",
    wearer: "you",
    problemTitle: "Why it’s hard to fix on your own",
    problems: [
      {
        title: "You can’t listen to yourself and speak at once",
        body: "Finding words takes all your attention. Pace, volume and small grammar slips go unnoticed until someone asks you to repeat yourself.",
      },
      {
        title: "Apps only help while you practice",
        body: "Lessons and recordings happen alone with a phone. Real conversations get no feedback at all.",
      },
      {
        title: "People are too polite to say",
        body: "Colleagues and friends rarely correct your grammar or tell you that you’re speaking too fast, so the habits stay.",
      },
    ],
    moments: {
      label: "In conversation",
      pause: "Filling the gap while you search for a word.",
      slow: "Speeding up to get a hard sentence over with.",
      speak: "Getting quieter when you’re unsure of a word.",
    },
    report: {
      title: "Your grammar, from your own conversations",
      body: "After each conversation, Cue shows the grammar slips that came up most, each with a corrected version of what you said. The same report covers pauses, pace, volume and filler words, with up to three things to work on first.",
    },
    extraReportAreas: ["Grammar"],
    faq: [
      {
        q: "How does Cue help with grammar?",
        a: "In the report after each conversation: the grammar slips that came up most, each with a corrected version of what you said. The taps while you speak stay on delivery (pace, pauses, filler words and volume), because a tap can’t tell you which word to change.",
      },
      {
        q: "Does Cue correct my pronunciation or accent?",
        a: "No. Cue doesn’t judge your accent and isn’t trying to change it.",
      },
      {
        q: "Will it work with my accent?",
        a: "We’re testing Cue with a range of accents, and it won’t be equally accurate for everyone at first. Early-access feedback is how we find and fix that.",
      },
    ],
    metaTitle: "Cue for English learners",
    metaDescription:
      "A discreet behind-the-ear wearable that taps you privately when you’re rushing or getting quieter, then shows you the grammar to work on.",
  },
  {
    slug: "interviews",
    name: "Interviewees",
    kind: "early-access",
    eyebrow: "For interviews",
    headline: "Nerves speed you up. Cue slows you down.",
    lead: "In an interview, pressure makes people rush, ramble and reach for “um”. Cue is a discreet behind-the-ear wearable that taps you privately so you pause, breathe and answer at your own pace.",
    cta: "Join early access",
    wearer: "you",
    problemTitle: "Why practice alone doesn’t fix it",
    problems: [
      {
        title: "Practiced answers vanish under pressure",
        body: "You know what you want to say. Then the interview starts, your pulse climbs and your pace goes with it.",
      },
      {
        title: "You can’t tell it’s happening",
        body: "Rushing and filler words feel normal from the inside. You find out when you replay the conversation afterwards.",
      },
      {
        title: "Mock interviews aren’t the real one",
        body: "A friend or a practice app helps you rehearse. Neither is there when the real question lands.",
      },
    ],
    moments: {
      label: "In an interview",
      pause: "A long answer to “tell me about yourself”.",
      slow: "The first question, when nerves are highest.",
      speak: "Trailing off at the end of an answer.",
    },
    report: {
      title: "Practice, then see what happened",
      body: "Run a mock interview and get a report on pauses, pace, volume and filler words, with up to three things to work on before the real one.",
    },
    faq: [
      {
        q: "Can I wear it in a real interview?",
        a: "That’s what it’s designed for: one small device behind the ear, with cues meant for you alone. Cue only cues your delivery; it doesn’t feed you answers. You can also use it just for practice.",
      },
      {
        q: "Is it only for interviews?",
        a: "No. The same three cues work in presentations, meetings and everyday conversation.",
      },
    ],
    metaTitle: "Cue for interviews",
    metaDescription:
      "A discreet behind-the-ear wearable that taps you privately so you pause, breathe and answer at your own pace.",
  },
];

export const marketFor = (slug: string): Market | undefined => MARKETS.find((m) => m.slug === slug);

/** Roles offered on the pilot request form. */
export const PILOT_ROLES = ["Teacher", "Administrator", "Speech or debate coach", "Other"] as const;

/** Copy every page shares, worded for whoever wears the device. */
export interface SharedCopy {
  cuesTitle: string;
  cuesIntro: string;
  detects: { pause: string; slow: string; speak: string };
  facts: { title: string; body: string }[];
  joinLine: string;
  faq: { q: string; a: string }[];
}

const AVAILABILITY = {
  q: "Can I get Cue today?",
  a: "Not yet. Cue is a working prototype. Signing up costs nothing, commits you to nothing, and tells us who to build for first.",
};
const LOOKS = {
  q: "What does it look like?",
  a: "One small device that follows the curve behind one ear. Nothing goes in the ear, and it isn’t an earbud.",
};
const PRICE = { q: "What will it cost?", a: "We haven’t set a price." };
const PATTERNS_FACT = {
  title: "Patterns, not every word",
  body: "The occasional “um” is normal. Cue taps when a habit builds, and stays quiet otherwise.",
};

export const SHARED: Record<Market["wearer"], SharedCopy> = {
  you: {
    cuesTitle: "Three cues, while you’re speaking",
    cuesIntro:
      "Cue listens for a habit as it builds, then taps behind your ear. Each cue has its own rhythm, so you know what it’s asking for without looking at anything.",
    detects: {
      pause: "No pause for a while, a long turn, or a run of filler words.",
      slow: "Speaking faster than your own usual pace.",
      speak: "Speaking well below the volume you set.",
    },
    facts: [
      {
        title: "Nothing in your ear",
        body: "One small device follows the curve behind one ear. Your ear stays open.",
      },
      PATTERNS_FACT,
      {
        title: "Your voice stays yours",
        body: "Cue doesn’t script you or score you. It makes room for a pause; what you say next is up to you.",
      },
    ],
    joinLine: "Leave your email and we’ll tell you when early access opens.",
    faq: [
      AVAILABILITY,
      LOOKS,
      {
        q: "Does it record me?",
        a: "Cue has to hear your speech to coach it. Today’s prototype sends audio to a speech-recognition service to do that. Our aim for the product is to process speech on your own devices and keep no recordings by default, and we’ll tell you exactly how audio is handled before you wear one.",
      },
      {
        q: "Will it stop me saying “um” altogether?",
        a: "No, and it isn’t meant to. The occasional filler is normal. Cue taps for patterns, not for every word.",
      },
      PRICE,
    ],
  },
  students: {
    cuesTitle: "Three cues, while a student is speaking",
    cuesIntro:
      "Cue listens for a habit as it builds, then taps behind the student’s ear. Each cue has its own rhythm, so they know what it’s asking for without looking at anything.",
    detects: {
      pause: "No pause for a while, a long turn, or a run of filler words.",
      slow: "Speaking faster than their own usual pace.",
      speak: "Speaking well below the volume set for them.",
    },
    facts: [
      {
        title: "Nothing in the ear",
        body: "One small device follows the curve behind one ear. The ear stays open.",
      },
      PATTERNS_FACT,
      {
        title: "Their voice stays theirs",
        body: "Cue doesn’t script students or score them. It makes room for a pause; what they say next is up to them.",
      },
    ],
    joinLine: "Tell us where you teach and we’ll be in touch about a pilot.",
    faq: [
      AVAILABILITY,
      LOOKS,
      {
        q: "Does it record students?",
        a: "Cue has to hear a student’s speech to coach it. Today’s prototype sends audio to a speech-recognition service to do that. Our aim for the product is to process speech on the wearer’s own devices and keep no recordings by default, and we’ll agree exactly how audio is handled with you before any student wears one.",
      },
      {
        q: "Will it stop students saying “um” altogether?",
        a: "No, and it isn’t meant to. The occasional filler is normal. Cue taps for patterns, not for every word.",
      },
      PRICE,
    ],
  },
};
