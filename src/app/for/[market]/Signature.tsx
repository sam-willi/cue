import type { ReactNode } from "react";

/**
 * One illustration per audience, drawn from their own setting: a speech script, a call's talk
 * track, a classroom, a grammar report, an interview answer. Each is an example, not data.
 */

/** Where Cue taps. */
function Tap() {
  return (
    <span className="mx-[0.35em] inline-block size-[0.5em] rounded-full bg-cue align-middle ring-4 ring-cue-soft">
      <span className="sr-only"> (Cue taps once) </span>
    </span>
  );
}

/** A breath mark, as a speaker would pencil into a script. */
function Breath() {
  return <span aria-hidden="true" className="mx-[0.45em] inline-block h-[0.85em] w-[2px] bg-muted align-baseline" />;
}

function Speaking() {
  return (
    <>
      <p className="landing-display max-w-4xl text-[24px]/[1.55] sm:text-[34px]/[1.5]">
        Good evening.
        <Breath />
        Thank you for having me.
        <Breath />I want to start with the first talk I ever gave and how badly it went and what it taught me and why I
        still think about it
        <Tap />
        <Breath />I was twenty-two.
      </p>
      <figcaption className="mt-8 max-w-xl text-body text-muted">
        A breath after each thought. Where one goes missing, Cue taps once.
      </figcaption>
    </>
  );
}

function Sales() {
  const lane = "flex h-9 items-center gap-[2%]";
  const you = "h-full rounded-[4px] bg-text";
  const buyer = "h-full rounded-[4px] bg-muted/45";
  return (
    <>
      <div aria-hidden="true" className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3">
        <span className="text-label font-medium">You</span>
        <div className={lane}>
          <span className={`${you} w-[8%]`} />
          <span className="w-[10%]" />
          <span className={`${you} relative w-[52%]`}>
            <span className="absolute -right-2 top-1/2 size-4 -translate-y-1/2 rounded-full bg-cue ring-4 ring-cue-soft" />
          </span>
          <span className="w-[16%]" />
          <span className={`${you} w-[6%]`} />
        </div>
        <span className="text-label font-medium">Buyer</span>
        <div className={lane}>
          <span className="w-[10%]" />
          <span className={`${buyer} w-[8%]`} />
          <span className="w-[56%]" />
          <span className={`${buyer} w-[14%]`} />
        </div>
      </div>
      <figcaption className="mt-8 max-w-xl text-body text-muted">
        A call, drawn as who was talking. One tap at the end of a long turn, and the buyer has a way back in.
      </figcaption>
    </>
  );
}

function Schools() {
  const seats = Array.from({ length: 30 }, (_, i) => i);
  const room = "grid w-fit grid-cols-10 gap-2 sm:gap-3.5";
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16">
      <div>
        <div aria-hidden="true" className={room}>
          {seats.map((i) => (
            <span
              key={i}
              className={`size-4 rounded-full sm:size-6 ${i === 13 ? "bg-cue ring-4 ring-cue-soft" : "bg-text/15"}`}
            />
          ))}
        </div>
        <p className="mt-6 max-w-xs text-body text-muted">
          <span className="font-medium text-text">One teacher.</span> One student gets feedback at a time.
        </p>
      </div>
      <div>
        <div aria-hidden="true" className={room}>
          {seats.map((i) => (
            <span key={i} className="size-4 rounded-full bg-cue sm:size-6" />
          ))}
        </div>
        <p className="mt-6 max-w-xs text-body text-muted">
          <span className="font-medium text-text">With Cue.</span> Every student gets a cue while they speak.
        </p>
      </div>
    </div>
  );
}

function English() {
  const rows: { said: ReactNode; fixed: ReactNode }[] = [
    {
      said: (
        <>
          Yesterday I <del className="text-muted">go</del> to the office.
        </>
      ),
      fixed: (
        <>
          Yesterday I <ins className="font-bold text-cue no-underline">went</ins> to the office.
        </>
      ),
    },
    {
      said: (
        <>
          She <del className="text-muted">don’t</del> like coffee.
        </>
      ),
      fixed: (
        <>
          She <ins className="font-bold text-cue no-underline">doesn’t</ins> like coffee.
        </>
      ),
    },
  ];
  return (
    <>
      <dl className="grid max-w-3xl gap-4">
        {rows.map((row, i) => (
          <div key={i} className="grid gap-3 rounded-control bg-surface p-5 sm:grid-cols-2 sm:gap-8 sm:p-6">
            <div>
              <dt className="text-label font-medium text-muted">You said</dt>
              <dd className="mt-1 text-title-m sm:text-title">{row.said}</dd>
            </div>
            <div>
              <dt className="text-label font-medium text-muted">Try</dt>
              <dd className="mt-1 text-title-m sm:text-title">{row.fixed}</dd>
            </div>
          </div>
        ))}
      </dl>
      <figcaption className="mt-8 max-w-xl text-body text-muted">
        An example of the grammar part of a report: what you said, and a corrected version.
      </figcaption>
    </>
  );
}

function Filler({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-cue-soft px-1.5 py-0.5 text-cue">{children}</span>;
}

function Interviews() {
  const bubble = "max-w-xl rounded-[22px] px-5 py-4 text-body-lg-m sm:text-body-lg";
  return (
    <>
      <div className="flex flex-col gap-4">
        <p className={`${bubble} self-start bg-surface`}>Tell me about yourself.</p>
        <p className={`${bubble} self-end bg-surface`}>
          So, <Filler>um</Filler>, I’m a final-year student and, <Filler>like</Filler>, I’ve basically always been into,{" "}
          <Filler>um</Filler>, design and
          <Tap />
        </p>
        <p className={`${bubble} self-end bg-text text-bg`}>
          I’m a final-year design student. Last summer I led the redesign of our campus app.
        </p>
      </div>
      <figcaption className="mt-8 max-w-xl text-body text-muted">
        An example. Cue taps for a run of filler words, not for each one. You pause, then start the answer you meant to
        give.
      </figcaption>
    </>
  );
}

const ART: Record<string, { label: string; Art: () => ReactNode }> = {
  speaking: { label: "A speech with a pause mark after each thought and one tap from Cue", Art: Speaking },
  sales: { label: "A sales call drawn as who was talking, with one tap from Cue", Art: Sales },
  schools: { label: "A class of thirty with one teacher, and with Cue", Art: Schools },
  english: { label: "Grammar corrections from a report", Art: English },
  interviews: { label: "An interview answer before and after a tap from Cue", Art: Interviews },
};

export default function Signature({ slug }: { slug: string }) {
  const entry = ART[slug];
  if (!entry) return null;
  return (
    <figure aria-label={entry.label} className="mt-24 rounded-card bg-surface-2 px-6 py-10 sm:mt-32 sm:px-12 sm:py-14">
      <entry.Art />
    </figure>
  );
}
