import type { CueSession } from "@/lib/cue/session";
import { digestSession } from "./digest";
import { learnFromSession, type LearnResult } from "./learn";
import type { Profile, SessionDigest, SessionSource } from "./types";

/**
 * The bridge between a live session and continuous learning: when a session ends, digest what
 * it heard and learn from it. The words are only read here, never stored.
 */
export function finishSession(
  profile: Profile,
  session: CueSession,
  meta: { id: string; at: string; source: SessionSource; context?: string | null },
): LearnResult & { digest: SessionDigest } {
  const { digest, interventions } = digestSession({
    id: meta.id,
    at: meta.at,
    source: meta.source,
    mode: session.config.mode,
    context: meta.context ?? null,
    words: session.words.filter((w) => session.isWearerWord(w)),
    history: session.history,
    records: session.engineRecords(),
    paceLimit: session.paceLimit(),
    noPauseLimit: session.noPauseLimit(),
    plan: session.plan,
  });
  return { ...learnFromSession(profile, digest, interventions), digest };
}
