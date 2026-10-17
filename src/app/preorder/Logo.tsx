import Image from "next/image";

/** The horizontal lockup, light or reversed to match the page (DESIGN.md §3). */
export default function Logo() {
  return (
    <>
      <Image
        className="dark:hidden"
        src="/brand/cue-logo-horizontal-fullcolor-light.png"
        alt="Cue"
        width={104}
        height={23}
        priority
      />
      <Image
        className="hidden dark:block"
        src="/brand/cue-logo-horizontal-fullcolor-dark.png"
        alt="Cue"
        width={104}
        height={23}
        priority
      />
    </>
  );
}
