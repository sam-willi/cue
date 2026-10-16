// The preorder offer on /preorder, in one place so the page, checkout and tests agree.
// Owner decisions, 2026-10-15: $110 with lifetime Premium for preorders against $150+ plus a
// subscription at launch; a $20 refundable deposit today, the rest when the batch ships;
// batch 1 is 500 units shipping summer 2027; three colorways, named by the owner.

export const OFFER = {
  /** What a preorder costs in all, in US dollars. */
  price: 110,
  /** Charged today to hold a place. Refundable until the device ships. */
  deposit: 20,
  /** What Cue is expected to cost at launch, before the Premium subscription. */
  launchPrice: 150,
  batch: { number: 1, size: 500, ships: "summer 2027" },
} as const;

/** Off the expected launch price, before counting the Premium subscription preorders skip. */
export const SAVING = OFFER.launchPrice - OFFER.price;

/** Charged when the batch ships: the price less the deposit. */
export const BALANCE = OFFER.price - OFFER.deposit;

/** Marks a deposit's payment in Stripe, so the page can count how many places are taken. */
export const BATCH_TAG = `batch-${OFFER.batch.number}`;

export type ColorwayId = "graphite" | "silver" | "champagne";

export interface Colorway {
  id: ColorwayId;
  name: string;
  /** One short line about the finish, shown on its card. */
  note: string;
  /** A swatch for the color picker, sampled from the concept renders. */
  swatch: string;
}

export const COLORWAYS: Colorway[] = [
  { id: "graphite", name: "Graphite", note: "Satin dark grey. Disappears into dark hair.", swatch: "#4a4a4c" },
  { id: "silver", name: "Silver", note: "Satin silver. The quiet classic.", swatch: "#c9c9cb" },
  { id: "champagne", name: "Champagne", note: "Satin warm gold. Pairs with gold jewelry.", swatch: "#cbb89f" },
];

export const colorwayFor = (id: unknown): Colorway | undefined =>
  typeof id === "string" ? COLORWAYS.find((c) => c.id === id) : undefined;

export const CONCEPT_NOTE = "Design concept. The finished device may look different.";
