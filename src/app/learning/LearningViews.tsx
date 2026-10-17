"use client";

import { useState } from "react";
import { toApproxWpm, type CueMode } from "@/lib/cue/config";
import { COACHED, type CoachedBehavior, type FocusKey } from "@/lib/cue/plan";
import {
  activeAdaptations,
  BEHAVIOR_NAME,
  REMINDER_NAME,
  STAGE_LABEL,
  stageOf,
  STRATEGY_TEXT,
} from "@/lib/learning/coaching";
import { formatMetric, METRIC_NAME } from "@/lib/learning/evaluation";
import { canRecommend, currentFocusMetric, FOCUS_KEYS, FOCUS_LABEL } from "@/lib/learning/focus";
import { GOAL_TEXT } from "@/lib/learning/learn";
import type { CueUpdate, Insight, LearningEvent, Profile, Rating } from "@/lib/learning/types";
import type { JustEnded, Learning } from "./useLearning";

/*
 * Continuous learning in the app: the focus, "Cue updated" moments, the check-in after a
 * session, "What Cue has learned", and the learning timeline. Everything shown here is read from
 * the profile; nothing is written for effect.
 */

/** A focus in its report area's color (CUE_CONTEXT.md decision 26); the two that aren't report areas stay ink. */
const FOCUS_COLOR: Record<FocusKey, string> = {
  pace: "var(--area-pace)",
  fillers: "var(--area-fillers)",
  pauses: "var(--area-pauses)",
  conciseness: "var(--text)",
  repetition: "var(--text)",
};

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const MODE_NAME: Record<CueMode, string> = { conversation: "Conversation", presentation: "Presentation" };
const ACTION: Record<CoachedBehavior, string> = {
  rushing: "Slow down",
  fillers: "Pause, for fillers",
  no_pause: "Pause, no pause",
  long_turn: "Pause, long turn",
  too_quiet: "Speak up",
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-caption font-medium uppercase tracking-[0.08em] text-muted">{children}</p>
);

function SmallButton({
  onClick,
  children,
  on,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  on?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`min-h-9 rounded-full border px-3.5 text-label transition-colors duration-200 ${
        on ? "border-text bg-text text-bg" : "border-line hover:border-text"
      }`}
    >
      {children}
    </button>
  );
}

/** Three dots for how sure Cue is: emerging, likely, strong. */
function Confidence({ level }: { level: Insight["level"] }) {
  const n = level === "strong" ? 3 : level === "likely" ? 2 : 1;
  const word = level === "strong" ? "Strong evidence" : level === "likely" ? "Likely" : "Early sign";
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-muted">
      <span className="flex gap-0.5" aria-hidden>
        {[0, 1, 2].map((k) => (
          <span key={k} className={`size-1.5 rounded-full ${k < n ? "bg-text" : "bg-line"}`} />
        ))}
      </span>
      {word}
    </span>
  );
}

// --- Your focus ----------------------------------------------------------------------------

export function FocusCard({ learning }: { learning: Learning }) {
  const p = learning.profile;
  const f = p.focus;
  const [choosing, setChoosing] = useState(false);
  // A new focus is announced by its "Cue updated" card first; this card takes over once that's read.
  if (p.updates.some((u) => u.status === "new" && u.ref.focus)) return null;
  const key = f.current;
  const now = key ? currentFocusMetric(p, key) : null;
  const metricKey =
    key === "pace"
      ? "rushing"
      : key === "fillers"
        ? "fillers"
        : key === "pauses"
          ? "no_pause"
          : key === "conciseness"
            ? "long_turn"
            : null;
  return (
    <div className="relative mt-10 w-full overflow-hidden rounded-[28px] bg-surface p-6 text-left sm:p-7">
      {key && (
        <span
          aria-hidden
          className="absolute -right-10 -top-12 size-36 rounded-full opacity-90"
          style={{ background: FOCUS_COLOR[key] }}
        />
      )}
      <div className="relative">
        <Eyebrow>{key ? (f.chosenBy === "you" ? "Your focus · chosen by you" : "Your focus") : "Your focus"}</Eyebrow>
        {key ? (
          <>
            <p className="mt-2 max-w-[80%] font-display text-heading-3-m font-semibold tracking-[-0.015em] sm:text-heading-3">
              {FOCUS_LABEL[key]}
            </p>
            <p className="mt-2 max-w-prose text-body text-muted">{f.why}</p>
            {f.since && f.startMetric !== null && now !== null && metricKey && f.sessionsOnFocus > 0 && (
              <p className="mt-3 text-body-sm">
                <span className="text-muted">Since {date(f.since)}: </span>
                {METRIC_NAME[metricKey]} {formatMetric(metricKey, f.startMetric)} → {formatMetric(metricKey, now)}
                <span className="text-muted">
                  , over {f.sessionsOnFocus} {f.sessionsOnFocus === 1 ? "session" : "sessions"}
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 max-w-prose text-body text-muted">
            {canRecommend(p)
              ? "No focus right now. Pick one, or let Cue choose from your recent sessions."
              : "Cue picks one skill to work on after your first two sessions, from what it hears. You can choose one now if you know what you want."}
          </p>
        )}
        {f.suggestion && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-body-sm">
            <span>
              Cue suggests moving on to{" "}
              <strong className="font-medium">{FOCUS_LABEL[f.suggestion.key].toLowerCase()}</strong>.
            </span>
            <SmallButton onClick={() => learning.focus(f.suggestion!.key)}>Switch</SmallButton>
          </div>
        )}
        <div className="mt-4">
          {choosing ? (
            <div className="flex flex-wrap gap-2">
              {FOCUS_KEYS.map((k) => (
                <SmallButton
                  key={k}
                  on={k === key}
                  onClick={() => {
                    learning.focus(k);
                    setChoosing(false);
                  }}
                >
                  {FOCUS_LABEL[k]}
                </SmallButton>
              ))}
              <SmallButton
                onClick={() => {
                  learning.focus(null);
                  setChoosing(false);
                }}
              >
                Let Cue choose
              </SmallButton>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="text-label text-muted underline-offset-4 hover:text-text hover:underline"
            >
              {key ? "Change focus" : "Choose a focus"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** What's personal about the coaching right now, in a few words each, for the live screen. */
export function TunedToYou({ profile, mode, sandbox }: { profile: Profile; mode: CueMode; sandbox?: boolean }) {
  const mp = profile.plan.modes[mode];
  const chips: string[] = [];
  if (mp.paceBaselineSps !== null)
    chips.push(
      `Slow down above ~${toApproxWpm(Math.min(6, Math.max(3.6, mp.paceBaselineSps * (mode === "presentation" ? 1.1 : 1.2))))} wpm`,
    );
  for (const b of COACHED) {
    const bp = mp.behaviors[b];
    if (!bp.enabled) chips.push(`No ${BEHAVIOR_NAME[b]} feedback`);
    else if (bp.strategy === "sustained") chips.push("Pace: long stretches only");
    else if (bp.strategy === "rate") chips.push("Fillers: high rate only");
    else if (bp.strategy === "patient") chips.push("Pause: 10 s more room");
    if (bp.enabled && bp.gapScale >= 1.5) chips.push(`Fewer ${REMINDER_NAME[b]}`);
  }
  if (profile.plan.intensity !== "standard") chips.push(`${capitalize(profile.plan.intensity)} taps`);
  if (mp.longTurnSec) chips.push(`Wrap up after ${mp.longTurnSec} s`);
  if (!chips.length) return null;
  return (
    <div
      className="mt-4 flex max-w-xl flex-wrap items-center justify-center gap-1.5"
      aria-label="Coaching tuned to you"
    >
      <span className="mr-1 text-caption text-muted">{sandbox ? "Tuned (practice sandbox):" : "Tuned to you:"}</span>
      {chips.map((c) => (
        <span key={c} className="rounded-full bg-surface-2 px-2.5 py-1 text-caption">
          {c}
        </span>
      ))}
    </div>
  );
}

// --- Cue updated -----------------------------------------------------------------------------

export function CueUpdateCard({ learning }: { learning: Learning }) {
  const which = learning.justEnded?.view ?? learning.view;
  const update: CueUpdate | undefined = learning.profiles[which].updates.findLast((u) => u.status === "new");
  if (!update) return null;
  return (
    <div
      className="cue-card mt-8 w-full rounded-[28px] border border-line bg-surface p-6 text-left sm:p-7"
      role="status"
    >
      <p className="flex items-center gap-2 text-caption font-medium uppercase tracking-[0.08em] text-cue-ink">
        <span aria-hidden className="size-2 rounded-full bg-cue" />
        {update.label}
        {which === "sandbox" && (
          <span className="font-normal normal-case tracking-normal text-muted">· practice sandbox</span>
        )}
      </p>
      <p className="mt-3 text-body-lg-m sm:text-body-lg">{update.text}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <SmallButton onClick={() => learning.seeUpdate(which, update.id)}>Got it</SmallButton>
        <SmallButton onClick={() => learning.correct(which, update.id)}>That’s not right</SmallButton>
      </div>
    </div>
  );
}

// --- After a session -------------------------------------------------------------------------

const RATINGS: { value: Rating; label: string }[] = [
  { value: "helpful", label: "Helpful" },
  { value: "too_many", label: "Too many" },
  { value: "distracting", label: "Distracting" },
];
const CONTEXTS = ["Casual chat", "Meeting", "Interview", "Presentation", "Class"];

export function CheckIn({ learning, session }: { learning: Learning; session: JustEnded }) {
  const kinds = (Object.keys(session.taps) as CoachedBehavior[]).filter((b) => session.taps[b]);
  if (session.skipped)
    return (
      <p className="mt-6 max-w-md text-body-sm text-muted" role="status">
        {session.skipped} Cue learns from sessions with at least 30 seconds of talking.
      </p>
    );
  return (
    <div className="mt-8 w-full rounded-[28px] bg-surface-2 p-6 text-left sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>After this session{session.view === "sandbox" ? " · practice sandbox" : ""}</Eyebrow>
          <p className="mt-2 font-display text-title-m font-medium sm:text-title">
            {kinds.length ? "How were the taps?" : "Cue didn’t tap this time."}
          </p>
        </div>
        <button
          type="button"
          onClick={learning.dismissCheckIn}
          aria-label="Close"
          className="text-muted hover:text-text"
        >
          ×
        </button>
      </div>
      {kinds.length > 0 && (
        <ul className="mt-4 space-y-3">
          {kinds.map((b) => (
            <li key={b} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="min-w-36 text-body">
                {ACTION[b]} <span className="text-muted">×{session.taps[b]}</span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {RATINGS.map((r) => (
                  <SmallButton
                    key={r.value}
                    on={session.ratings[b] === r.value}
                    onClick={() => learning.rate(b, r.value)}
                  >
                    {r.label}
                  </SmallButton>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-body-sm text-muted">What kind of session was it? Cue compares how you speak in each.</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CONTEXTS.map((c) => {
          const v = c.toLowerCase();
          return (
            <SmallButton
              key={c}
              on={session.context === v}
              onClick={() => learning.tagSession(session.context === v ? null : v)}
            >
              {c}
            </SmallButton>
          );
        })}
      </div>
    </div>
  );
}

// --- What Cue has learned -----------------------------------------------------------------------

function Section({
  letter,
  title,
  intro,
  children,
}: {
  letter: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-2">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-title-m font-semibold text-muted">{letter}</span>
        <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">{title}</h3>
      </div>
      <p className="mt-1 max-w-prose text-body-sm text-muted">{intro}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-5 text-body-sm text-muted">{children}</p>;
}

export function LearnedView({ learning }: { learning: Learning }) {
  const p = learning.profile;
  const stage = stageOf(p);
  const minutes = p.sessions.reduce((n, d) => n + d.talkSec, 0) / 60;
  const patterns = p.insights.filter((i) => !i.kind.startsWith("coaching:"));
  const shown = patterns.filter((i) => i.status !== "rejected");
  const corrected = patterns.filter((i) => i.status === "rejected");
  const coaching = p.insights.filter((i) => i.kind.startsWith("coaching:") && i.status !== "rejected");
  // One card per observation, with every change it led to.
  const adaptations: { learned: string; changes: { text: string; since: string | null }[] }[] = [];
  for (const a of activeAdaptations(p)) {
    const card = adaptations.find((c) => c.learned === a.learned);
    if (card) card.changes.push({ text: a.changed, since: a.since });
    else adaptations.push({ learned: a.learned, changes: [{ text: a.changed, since: a.since }] });
  }
  const running = p.experimentsLog.filter((e) => e.status === "running");

  return (
    <div className="space-y-14">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SmallButton on={learning.view === "real"} onClick={() => learning.setView("real")}>
            Your sessions
          </SmallButton>
          <SmallButton on={learning.view === "sandbox"} onClick={() => learning.setView("sandbox")}>
            Practice sandbox
          </SmallButton>
        </div>
        {learning.view === "sandbox" && (
          <div className="rounded-2xl bg-surface-2 p-5 text-body-sm">
            <p className="max-w-prose text-muted">
              A separate memory for practice sentences and simulated speakers, so they never teach Cue about your real
              speech. A simulated speaker talks for four minutes through the same live engine and reacts to its taps by
              a stated rule; it shows how Cue learns, not how people behave.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <SmallButton onClick={() => learning.simulate(learning.speakers.quickTalker, 1)}>
                A quick talker: 1 session
              </SmallButton>
              <SmallButton onClick={() => learning.simulate(learning.speakers.burstyRusher, 1)}>
                A rusher: 1 session
              </SmallButton>
              <SmallButton onClick={() => learning.simulate(learning.speakers.burstyRusher, 5)}>
                A rusher: 5 sessions
              </SmallButton>
            </div>
          </div>
        )}
        <p className="text-body">
          <span className="font-medium">{STAGE_LABEL[stage]}.</span>{" "}
          <span className="text-muted">
            {p.sessions.length
              ? `Cue has learned from ${p.sessions.length} ${p.sessions.length === 1 ? "session" : "sessions"}, ${minutes >= 1 ? `${Math.round(minutes)} minutes` : "under a minute"} of you talking.`
              : "Nothing yet. Cue starts learning from your first session."}
          </span>
        </p>
      </div>

      <Section
        letter="A"
        title="Your speaking patterns"
        intro="What Cue has noticed across your sessions. A pattern appears only when at least three sessions show it, and fades if it stops holding."
      >
        {shown.length === 0 ? (
          <Empty>Nothing yet. Cue needs a few sessions before it says anything about how you speak.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((i) => (
              <li key={i.id} className="py-5">
                <p className="text-body-lg-m sm:text-body-lg">{i.statement}</p>
                <p className="mt-1 max-w-prose text-body-sm text-muted">{i.detail}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Confidence level={i.level} />
                  {i.combination && <span className="text-caption text-muted">Two habits together</span>}
                  {i.stale && <span className="text-caption text-muted">Not seen in recent sessions</span>}
                  {i.status === "confirmed" ? (
                    <span className="text-caption text-muted">You confirmed this</span>
                  ) : (
                    <SmallButton onClick={() => learning.judge(i.id, "confirm")}>That’s right</SmallButton>
                  )}
                  <SmallButton onClick={() => learning.judge(i.id, "reject")}>Not right</SmallButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        {corrected.length > 0 && (
          <div className="mt-6">
            <Eyebrow>You corrected</Eyebrow>
            <ul className="mt-2 space-y-2">
              {corrected.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 text-body-sm text-muted">
                  <span className="line-through">{i.statement}</span>
                  <SmallButton onClick={() => learning.judge(i.id, "restore")}>Restore</SmallButton>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Preferences learning={learning} />

      <Section
        letter="C"
        title="How Cue has adapted"
        intro="Every way Cue coaches you differently from someone new, and the observation behind it."
      >
        {adaptations.length === 0 ? (
          <Empty>Cue coaches you with its standard settings until it learns something about you.</Empty>
        ) : (
          <ul className="space-y-3">
            {adaptations.map((a) => (
              <li key={a.learned} className="grid gap-4 rounded-2xl bg-surface p-5 sm:grid-cols-2">
                <div>
                  <Eyebrow>What I learned</Eyebrow>
                  <p className="mt-1.5 text-body">{a.learned}</p>
                </div>
                <div>
                  <Eyebrow>What I changed{a.changes[0].since ? ` · ${date(a.changes[0].since)}` : ""}</Eyebrow>
                  {a.changes.map((c) => (
                    <p key={c.text} className="mt-1.5 text-body">
                      {c.text}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {running.length > 0 && (
          <div className="mt-8">
            <Eyebrow>Testing now</Eyebrow>
            <ul className="mt-3 space-y-3">
              {running.map((e) => {
                const cand = e.arms.filter((a) => a.arm === "candidate").length;
                const ctrl = e.design === "switch" ? e.before.length : e.arms.filter((a) => a.arm === "control").length;
                return (
                  <li key={e.id} className="rounded-2xl border border-line p-5 text-body">
                    <p>
                      {e.design === "switch" ? "Since you asked, I" : "In some sessions I"} {STRATEGY_TEXT[e.candidate]}
                      {e.design === "alternate" ? `, in others I ${STRATEGY_TEXT[e.control]}` : ""},{" "}
                      {e.mode === "conversation" ? "in conversations" : "in presentations"}.
                    </p>
                    <p className="mt-1 text-body-sm text-muted">
                      {e.design === "switch"
                        ? `So far: ${cand} ${cand === 1 ? "session" : "sessions"} the new way, against ${ctrl} from before you asked. After 3, I check ${METRIC_NAME[e.behavior]} hasn’t got worse; either way I keep the change unless you say otherwise.`
                        : `Compared so far: ${cand} ${cand === 1 ? "session" : "sessions"} the new way, ${ctrl} the usual way. I decide after at least 3 of each, on ${METRIC_NAME[e.behavior]}, how often I tap, and what you tell me.`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {coaching.length > 0 && (
          <div className="mt-8">
            <Eyebrow>What I’ve learned about coaching you</Eyebrow>
            <ul className="mt-3 divide-y divide-line">
              {coaching.map((i) => (
                <li key={i.id} className="py-4">
                  <p className="text-body">{i.statement}</p>
                  <p className="mt-1 max-w-prose text-body-sm text-muted">{i.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <YourData learning={learning} />
    </div>
  );
}

function Preferences({ learning }: { learning: Learning }) {
  const p = learning.profile;
  const prefs = p.preferences.filter((x) => x.status !== "rejected");
  const intensity = prefs.find((x) => x.kind === "intensity")?.value ?? "standard";
  const [offBehavior, setOffBehavior] = useState<CoachedBehavior>("fillers");
  const [offMode, setOffMode] = useState<CueMode | "any">("conversation");
  return (
    <Section
      letter="B"
      title="Your preferences"
      intro="What you’ve told Cue, and what it has inferred from your feedback. Inferred ones are marked; confirm or correct them."
    >
      {prefs.length === 0 ? (
        <Empty>No preferences yet. Rate the taps after a session, or set them below.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {prefs.map((x) => (
            <li key={x.id} className="py-5">
              <p className="text-body-lg-m sm:text-body-lg">{x.statement}</p>
              <p className="mt-1 text-body-sm text-muted">{x.why}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-caption ${x.source === "you" ? "bg-text text-bg" : "border border-line text-muted"}`}
                >
                  {x.source === "you"
                    ? "You told Cue"
                    : x.status === "confirmed"
                      ? "Inferred, you confirmed"
                      : "Inferred by Cue"}
                </span>
                {x.source === "cue" && x.status !== "confirmed" && (
                  <SmallButton onClick={() => learning.judge(x.id, "confirm")}>That’s right</SmallButton>
                )}
                {x.source === "cue" ? (
                  <SmallButton onClick={() => learning.judge(x.id, "reject")}>Not right</SmallButton>
                ) : (
                  <SmallButton onClick={() => learning.removePreference(x.id)}>Remove</SmallButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 space-y-5 rounded-2xl bg-surface p-5">
        <div>
          <p className="text-body-sm text-muted">Tap strength</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["gentle", "standard", "firm"] as const).map((v) => (
              <SmallButton
                key={v}
                on={intensity === v}
                onClick={() => learning.prefer({ kind: "intensity", value: v })}
              >
                {capitalize(v)}
              </SmallButton>
            ))}
          </div>
        </div>
        <div>
          <p className="text-body-sm text-muted">Your priority</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FOCUS_KEYS.map((k) => (
              <SmallButton
                key={k}
                on={prefs.some((x) => x.kind === "goal" && x.value === k)}
                onClick={() => learning.prefer({ kind: "goal", value: k })}
              >
                {capitalize(GOAL_TEXT[k])}
              </SmallButton>
            ))}
          </div>
        </div>
        <div>
          <p className="text-body-sm text-muted">Don’t coach me on</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Behavior"
              value={offBehavior}
              onChange={(e) => setOffBehavior(e.target.value as CoachedBehavior)}
              className="min-h-9 rounded-full border border-line bg-surface px-3 text-label"
            >
              {COACHED.map((b) => (
                <option key={b} value={b}>
                  {capitalize(BEHAVIOR_NAME[b])}
                </option>
              ))}
            </select>
            <select
              aria-label="Where"
              value={offMode}
              onChange={(e) => setOffMode(e.target.value as CueMode | "any")}
              className="min-h-9 rounded-full border border-line bg-surface px-3 text-label"
            >
              <option value="conversation">in conversations</option>
              <option value="presentation">in presentations</option>
              <option value="any">anywhere</option>
            </select>
            <SmallButton
              onClick={() =>
                learning.prefer({ kind: "dont_coach", behavior: offBehavior, mode: offMode === "any" ? null : offMode })
              }
            >
              Add
            </SmallButton>
            <SmallButton
              on={prefs.some((x) => x.kind === "fewer_taps")}
              onClick={() => learning.prefer({ kind: "fewer_taps" })}
            >
              Fewer taps overall
            </SmallButton>
          </div>
        </div>
      </div>
    </Section>
  );
}

function YourData({ learning }: { learning: Learning }) {
  const p = learning.profile;
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <section>
      <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">Your learning data</h3>
      <p className="mt-1 max-w-prose text-body-sm text-muted">
        Kept in this browser only. Cue remembers numbers from each session (pace, pauses, filler counts and the filler
        words themselves, a few phrases you repeat), never audio or transcripts.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <SmallButton on={p.learning} onClick={() => learning.setLearningOn(!p.learning)}>
          {p.learning ? "Learning from my sessions" : "Learning paused"}
        </SmallButton>
        <SmallButton on={p.experiments} onClick={() => learning.setExperimentsOn(!p.experiments)}>
          {p.experiments ? "Cue may hold back a few taps to test itself" : "No test holdbacks"}
        </SmallButton>
      </div>
      {p.sessions.length > 0 && (
        <ul className="mt-5 divide-y divide-line text-body-sm">
          {p.sessions
            .slice(-5)
            .reverse()
            .map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <span className="tabular-nums text-muted">{date(d.at)}</span>
                <span className="flex-1">
                  {MODE_NAME[d.mode]}
                  {d.context ? `, ${d.context}` : ""} · {Math.round(d.talkSec / 60) || "<1"} min · {d.taps}{" "}
                  {d.taps === 1 ? "tap" : "taps"}
                </span>
                <button
                  type="button"
                  onClick={() => learning.forget(d.id)}
                  className="text-label text-muted hover:text-text"
                >
                  Forget
                </button>
              </li>
            ))}
        </ul>
      )}
      <div className="mt-5">
        {confirmReset ? (
          <span className="flex flex-wrap items-center gap-2 text-body-sm">
            Forget everything Cue has learned{learning.view === "sandbox" ? " in the sandbox" : ""}?
            <SmallButton
              onClick={() => {
                learning.reset();
                setConfirmReset(false);
              }}
            >
              Yes, reset
            </SmallButton>
            <SmallButton onClick={() => setConfirmReset(false)}>Cancel</SmallButton>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-label text-muted underline-offset-4 hover:text-text hover:underline"
          >
            Reset what Cue has learned
          </button>
        )}
      </div>
    </section>
  );
}

// --- Learning timeline ---------------------------------------------------------------------------

export function LearningTimeline({ profile }: { profile: Profile }) {
  const [all, setAll] = useState(false);
  const tracks: { key: LearningEvent["track"]; title: string; empty: string }[] = [
    {
      key: "you",
      title: "How you’ve improved",
      empty: "Progress shows here once Cue can compare your recent sessions with your first ones.",
    },
    { key: "cue", title: "How Cue has improved", empty: "What Cue discovers and changes shows here." },
  ];
  return (
    <div className="grid gap-10 sm:grid-cols-2">
      {tracks.map((t) => {
        const events = profile.events.filter((e) => e.track === t.key);
        const shown = all ? events : events.slice(-12);
        return (
          <div key={t.key}>
            <h3 className="font-display text-title-m font-medium tracking-[-0.01em] sm:text-title">{t.title}</h3>
            {events.length === 0 ? (
              <p className="mt-3 text-body-sm text-muted">{t.empty}</p>
            ) : (
              <ol className="relative mt-4 space-y-5 border-l border-line pl-5">
                {shown.map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${t.key === "cue" ? "bg-cue" : "bg-text"}`}
                    />
                    <p className="text-caption tabular-nums text-muted">{date(e.at)}</p>
                    <p className="mt-0.5 text-body">{e.title}</p>
                    {e.why && <p className="mt-0.5 text-body-sm text-muted">{e.why}</p>}
                  </li>
                ))}
              </ol>
            )}
            {events.length > 12 && (
              <button type="button" onClick={() => setAll(!all)} className="mt-4 text-label text-muted hover:text-text">
                {all ? "Show recent only" : `Show all ${events.length}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
