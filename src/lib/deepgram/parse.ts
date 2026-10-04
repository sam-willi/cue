import { normalize } from "@/lib/cue/lexicon";
import type { CueSession, SessionUpdate } from "@/lib/cue/session";
import type { Word } from "@/lib/cue/types";

interface DgWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export interface DgMessage {
  type: string;
  is_final?: boolean;
  channel?: { alternatives: { words: DgWord[] }[] };
}

/** Words and finality from a Deepgram `Results` message; null for other message types. */
export function parseResults(msg: DgMessage): { words: Word[]; isFinal: boolean } | null {
  if (msg.type !== "Results") return null;
  const words = (msg.channel?.alternatives[0]?.words ?? [])
    .map((w) => ({
      text: w.punctuated_word ?? w.word,
      norm: normalize(w.word),
      start: w.start,
      end: w.end,
      confidence: w.confidence,
      ...(w.speaker !== undefined && { speaker: w.speaker }),
    }))
    .filter((w) => w.norm);
  return { words, isFinal: !!msg.is_final };
}

/** Feed one Deepgram message to a session. Returns the update, or null if the message carried none. */
export function feedMessage(session: CueSession, msg: DgMessage): SessionUpdate | null {
  if (msg.type === "UtteranceEnd") return session.endUtterance();
  const r = parseResults(msg);
  return r ? session.ingest(r.words, r.isFinal) : null;
}
