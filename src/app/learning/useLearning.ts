"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CoachedBehavior, FocusKey } from "@/lib/cue/plan";
import type { CueSession } from "@/lib/cue/session";
import {
  chooseFocus,
  correctUpdate,
  deletePreference,
  emptyProfile,
  forgetSession,
  judgeItem,
  markUpdateSeen,
  rateCues,
  resetProfile,
  setExperiments,
  setLearning,
  setPreference,
  setSessionContext,
  type LearnResult,
  type PreferenceRequest,
} from "@/lib/learning/learn";
import { finishSession } from "@/lib/learning/live";
import { simulateSessions, SPEAKERS, type SpeakerModel } from "@/lib/learning/simulate";
import { localStore, STORAGE_KEY, type MemoryStore } from "@/lib/learning/store";
import type { Profile, Rating, SessionSource } from "@/lib/learning/types";

/** Which memory is in view: the wearer's own, or the practice sandbox (simulated sessions). */
export type MemoryView = "real" | "sandbox";

/** The session that just ended, for the check-in: which memory it went to and what Cue tapped. */
export interface JustEnded {
  view: MemoryView;
  sessionId: string;
  taps: Partial<Record<CoachedBehavior, number>>;
  ratings: Partial<Record<CoachedBehavior, Rating>>;
  context: string | null;
  skipped?: string;
}

const now = () => new Date().toISOString();

/**
 * Continuous learning in the app: both memories (real and sandbox), saved to this browser after
 * every change, and every action the app can take on them.
 */
export function useLearning() {
  const stores = useRef<Record<MemoryView, MemoryStore> | null>(null);
  const [profiles, setProfiles] = useState<Record<MemoryView, Profile>>(() => ({
    real: emptyProfile(now()),
    sandbox: emptyProfile(now()),
  }));
  const profilesRef = useRef(profiles);
  const [view, setView] = useState<MemoryView>("real");
  const [justEnded, setJustEnded] = useState<JustEnded | null>(null);

  useEffect(() => {
    try {
      stores.current = {
        real: localStore(STORAGE_KEY.real, localStorage),
        sandbox: localStore(STORAGE_KEY.sandbox, localStorage),
      };
      const loaded = { real: stores.current.real.load(), sandbox: stores.current.sandbox.load() };
      profilesRef.current = loaded;
      setProfiles(loaded);
    } catch {
      // Storage blocked: learning lasts until the page closes.
    }
  }, []);

  const put = useCallback((which: MemoryView, p: Profile) => {
    profilesRef.current = { ...profilesRef.current, [which]: p };
    setProfiles(profilesRef.current);
    stores.current?.[which].save(p);
  }, []);

  const apply = useCallback(
    (which: MemoryView, fn: (p: Profile) => LearnResult | Profile) => {
      const out = fn(profilesRef.current[which]);
      put(which, "profile" in out ? out.profile : out);
      return out;
    },
    [put],
  );

  /** A session ended: learn from it. Live sessions teach the real memory; practice goes to the sandbox. */
  const finish = useCallback(
    (session: CueSession, source: SessionSource) => {
      const which: MemoryView = source === "live" ? "real" : "sandbox";
      const at = now();
      const res = finishSession(profilesRef.current[which], session, { id: `s-${at}`, at, source });
      put(which, res.profile);
      const taps: JustEnded["taps"] = {};
      for (const r of session.engineRecords()) if (!r.holdout) taps[r.behavior] = (taps[r.behavior] ?? 0) + 1;
      setJustEnded({
        view: which,
        sessionId: res.digest.id,
        taps,
        ratings: {},
        context: null,
        skipped: res.skipped,
      });
      return res;
    },
    [put],
  );

  /** Simulated sessions by a model speaker, into the sandbox only. */
  const simulate = useCallback(
    (model: SpeakerModel, count: number) => {
      const before = profilesRef.current.sandbox;
      const last = before.sessions.at(-1)?.at;
      const spacing = 3600_000;
      const start = new Date(Math.max(last ? Date.parse(last) + spacing : 0, Date.now() - (count - 1) * spacing));
      const run = simulateSessions(model, {
        count,
        seconds: 240,
        seed: before.sessions.length * 13 + 1,
        profile: before,
        start,
        spacing,
      });
      put("sandbox", run.profile);
      setView("sandbox");
      const lastRun = run.sessions.at(-1)!;
      setJustEnded({
        view: "sandbox",
        sessionId: run.profile.sessions.at(-1)!.id,
        taps: lastRun.taps,
        ratings: {},
        context: null,
      });
      return run;
    },
    [put],
  );

  const rate = useCallback(
    (b: CoachedBehavior, rating: Rating) => {
      if (!justEnded || justEnded.skipped) return;
      apply(justEnded.view, (p) => rateCues(p, justEnded.sessionId, b, rating, now()));
      setJustEnded({ ...justEnded, ratings: { ...justEnded.ratings, [b]: rating } });
    },
    [apply, justEnded],
  );

  const tagSession = useCallback(
    (context: string | null) => {
      if (!justEnded || justEnded.skipped) return;
      apply(justEnded.view, (p) => setSessionContext(p, justEnded.sessionId, context, now()));
      setJustEnded({ ...justEnded, context });
    },
    [apply, justEnded],
  );

  return {
    profiles,
    view,
    setView,
    profile: profiles[view],
    justEnded,
    dismissCheckIn: () => setJustEnded(null),
    finish,
    simulate,
    speakers: SPEAKERS,
    rate,
    tagSession,
    judge: (id: string, verdict: "confirm" | "reject" | "restore") =>
      apply(view, (p) => judgeItem(p, id, verdict, now())),
    prefer: (req: PreferenceRequest) => apply(view, (p) => setPreference(p, req, now())),
    removePreference: (id: string) => apply(view, (p) => deletePreference(p, id, now())),
    focus: (key: FocusKey | null) => apply(view, (p) => chooseFocus(p, key, now())),
    seeUpdate: (which: MemoryView, id: string) => apply(which, (p) => markUpdateSeen(p, id)),
    correct: (which: MemoryView, id: string) => apply(which, (p) => correctUpdate(p, id, now())),
    forget: (id: string) => apply(view, (p) => forgetSession(p, id, now())),
    setLearningOn: (on: boolean) => apply(view, (p) => setLearning(p, on)),
    setExperimentsOn: (on: boolean) => apply(view, (p) => setExperiments(p, on, now())),
    reset: () => {
      apply(view, (p) => resetProfile(p, now()));
      if (justEnded?.view === view) setJustEnded(null);
    },
  };
}

export type Learning = ReturnType<typeof useLearning>;
