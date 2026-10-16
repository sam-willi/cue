"use client";

import { track } from "@vercel/analytics";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_CONFIG } from "@/lib/cue/config";
import { PATTERNS, patternFor, type CuePattern } from "@/lib/cue/patterns";
import type { CueSession } from "@/lib/cue/session";
import type { Word } from "@/lib/cue/types";
import type { LiveTranscriber } from "@/lib/deepgram/liveTranscriber";
import { panel } from "@/lib/preorder/offer";
import { ON_EAR_MOTOR } from "./Hero";
import Rings, { type CuePlay } from "./Rings";
import s from "./preorder.module.css";

/** How long one try runs: enough for a few sentences, short enough to keep the cost small. */
const LIMIT_S = 45;
const LABEL: Record<CuePattern, string> = { tap: "pause", steps: "slow down", push: "speak up" };

type Status = "idle" | "starting" | "listening" | "done" | "error";

/**
 * "Try it with your voice": the coaching engine the app uses (CueSession), on the visitor's own
 * speech, through the same Deepgram stream. Each tap shows on the photo and, on a phone that can,
 * vibrates in the cue's rhythm. Nothing is kept: the words live in this component until it unmounts.
 */
export default function VoiceDemo() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [fillerStarts, setFillerStarts] = useState<number[]>([]);
  const [cues, setCues] = useState<{ id: string; pattern: CuePattern; why: string }[]>([]);
  const [play, setPlay] = useState<CuePlay | null>(null);
  const [left, setLeft] = useState(LIMIT_S);
  const [wpm, setWpm] = useState<number | null>(null);
  const transcriber = useRef<LiveTranscriber | null>(null);
  const session = useRef<CueSession | null>(null);
  const timer = useRef(0);

  const stop = (final: Status = "done") => {
    window.clearInterval(timer.current);
    transcriber.current?.stop();
    transcriber.current = null;
    setStatus((s) => (s === "error" ? s : final));
  };

  // Leaving the page mid-try releases the microphone.
  useEffect(
    () => () => {
      window.clearInterval(timer.current);
      transcriber.current?.stop();
    },
    [],
  );

  const start = async () => {
    setStatus("starting");
    setError(null);
    setWords([]);
    setFillerStarts([]);
    setCues([]);
    setWpm(null);
    setLeft(LIMIT_S);
    track("voice_demo_start");
    // Loaded on demand: the engine and the stream aren't needed until someone presses the button.
    const [{ LiveTranscriber }, { CueSession }, { feedMessage }] = await Promise.all([
      import("@/lib/deepgram/liveTranscriber"),
      import("@/lib/cue/session"),
      import("@/lib/deepgram/parse"),
    ]);
    const sess = new CueSession(DEFAULT_CONFIG);
    session.current = sess;
    let n = 0;
    const t = new LiveTranscriber({
      onMessage: (msg) => {
        const u = feedMessage(sess, msg);
        if (!u) return;
        setWords(sess.words.filter((w) => sess.isWearerWord(w)).slice(-40));
        if (u.pace) setWpm(Math.round(u.pace.wpm));
        const fillers = u.decisions.filter((d) => d.event.type.startsWith("filler_")).map((d) => d.event.start);
        if (fillers.length) setFillerStarts((f) => [...f, ...fillers]);
        for (const d of u.decisions.filter((x) => x.delivered)) {
          const pattern = patternFor(d.event.type);
          n += 1;
          setPlay({ pattern, n });
          navigator.vibrate?.(PATTERNS[pattern].vibrate);
          sess.hapticPlayed(PATTERNS[pattern].vibrate.reduce((a, b) => a + b, 0) / 1000);
          setCues((c) => [...c, { id: d.event.id, pattern, why: d.trigger ?? "" }].slice(-4));
        }
      },
      onLevel: (at, db) => sess.ingestLevel(at, db),
      onVoice: (at, voice) => sess.ingestVoice(at, voice),
      onStatus: (st, detail, code) => {
        if (st === "listening") {
          setStatus("listening");
          const began = Date.now();
          timer.current = window.setInterval(() => {
            const remaining = LIMIT_S - Math.floor((Date.now() - began) / 1000);
            setLeft(remaining);
            if (remaining <= 0) stop();
          }, 250);
        }
        if (st === "error") {
          setStatus("error");
          setError(
            code
              ? "The voice demo is resting right now. The three cues above show what it does."
              : (detail ?? "Listening couldn’t start. Check that the page may use your microphone."),
          );
          window.clearInterval(timer.current);
        }
      },
    });
    transcriber.current = t;
    try {
      await t.start();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Listening couldn’t start.");
    }
  };

  const isFiller = (w: Word) => fillerStarts.some((f) => Math.abs(f - w.start) < 0.05);
  const listening = status === "listening" || status === "starting";

  return (
    <div className={s.voice}>
      <div>
        <span className={s.eyebrow}>Your turn</span>
        <h2 className={s.h3}>try it with your voice.</h2>
        <p className={s.body} style={{ fontSize: 17 }}>
          Explain what you worked on this week, out loud, for {LIMIT_S} seconds. This runs the same coaching engine as
          the device. On a phone, you’ll feel each tap.
        </p>
        <div className={s.actions}>
          {listening ? (
            <button type="button" className={s.button} onClick={() => stop()}>
              stop <span className={s.buttonPrice}>{status === "starting" ? "…" : `${left}s`}</span>
            </button>
          ) : (
            <button type="button" className={s.button} onClick={start}>
              {status === "done" ? "try again" : "start talking"} <span aria-hidden="true">●</span>
            </button>
          )}
        </div>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <p className={s.privacy}>
          Your microphone is used only while this runs. The audio goes to our speech-recognition provider to be turned
          into words, and neither Cue nor this page keeps it.
        </p>
      </div>

      <div>
        <figure className={s.demoPhoto} style={{ marginBottom: 8 }}>
          <Image
            src={panel("champagne", "on-ear")}
            alt="Cue in Champagne, worn behind the ear"
            width={509}
            height={298}
            sizes="(max-width: 860px) 100vw, 50vw"
          />
          <Rings {...ON_EAR_MOTOR.champagne} play={play} />
        </figure>
        <div className={s.voiceStage}>
          <p className={s.liveWords} aria-live="polite">
            {words.length ? (
              words.map((w, i) => (
                <span key={`${w.start}-${i}`} className={`${s.liveWord} ${isFiller(w) ? s.filler : ""}`}>
                  {w.text}{" "}
                </span>
              ))
            ) : (
              <span className={s.hint}>
                {status === "listening" ? "Listening…" : "Your words will show up here as you talk."}
              </span>
            )}
          </p>
          <div className={s.voiceCues} aria-live="assertive">
            {cues.map((c) => (
              <span key={c.id} className={s.pill}>
                <span className={s.dot} style={{ background: "var(--bg)" }} /> {LABEL[c.pattern]}
                <span style={{ opacity: 0.6, fontWeight: 400 }}>{c.why}</span>
              </span>
            ))}
          </div>
          <div className={s.voiceBar}>
            <span>{wpm ? `${wpm} wpm` : "pace —"}</span>
            <span>
              {cues.length} {cues.length === 1 ? "tap" : "taps"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
