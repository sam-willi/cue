import { normalize } from "@/lib/cue/lexicon";
import type { CueSession, SessionUpdate } from "@/lib/cue/session";
import type { Word } from "@/lib/cue/types";

interface DgWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
}

export interface DgMessage {
  type: string;
  // Nova (v1 /listen): Results messages
  is_final?: boolean;
  channel?: { alternatives: { words: DgWord[] }[] };
  // Flux (v2 /listen): TurnInfo messages carry the current turn's words so far
  event?: "Update" | "StartOfTurn" | "EagerEndOfTurn" | "TurnResumed" | "EndOfTurn" | string;
  words?: DgWord[];
  audio_window_start?: number;
}

const toWords = (ws: DgWord[], offset = 0): Word[] =>
  ws
    .map((w) => ({
      text: w.punctuated_word ?? w.word,
      norm: normalize(w.word),
      start: w.start + offset,
      end: w.end + offset,
      confidence: w.confidence,
    }))
    .filter((w) => w.norm);

/**
 * Words and finality from a Deepgram message; null if it carries none.
 *  - Nova `Results`: interim results, then a final one per segment.
 *  - Flux `TurnInfo`: each update repeats the whole turn so far (interim); `EndOfTurn` is final.
 */
export function parseResults(msg: DgMessage): { words: Word[]; isFinal: boolean } | null {
  if (msg.type === "Results")
    return { words: toWords(msg.channel?.alternatives[0]?.words ?? []), isFinal: !!msg.is_final };
  if (msg.type === "TurnInfo" && msg.words?.length) {
    // Word times should be stream-relative; if they look turn-relative, shift by the window start.
    const start = msg.audio_window_start ?? 0;
    const offset = start > 0 && msg.words[0].start + 0.05 < start ? start : 0;
    return { words: toWords(msg.words, offset), isFinal: msg.event === "EndOfTurn" };
  }
  return null;
}

/** Feed one Deepgram message to a session. Returns the update, or null if the message carried none. */
export function feedMessage(session: CueSession, msg: DgMessage): SessionUpdate | null {
  if (msg.type === "UtteranceEnd") return session.endUtterance();
  const r = parseResults(msg);
  if (!r) return null;
  const update = session.ingest(r.words, r.isFinal);
  // A Flux turn ending is a real pause in speech, like Nova's UtteranceEnd.
  return msg.type === "TurnInfo" && msg.event === "EndOfTurn" ? session.endUtterance() : update;
}
