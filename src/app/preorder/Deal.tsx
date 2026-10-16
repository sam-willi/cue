import { BALANCE, OFFER } from "@/lib/preorder/offer";
import s from "./preorder.module.css";

/**
 * The deal as one sum, so nobody mistakes the deposit for the price:
 * $20 today + $90 when it ships = $110, and Premium free for life.
 */
export default function Deal({ className }: { className?: string }) {
  return (
    <p
      className={`${s.sum} ${className ?? ""}`}
      aria-label={`$${OFFER.deposit} today, refundable, plus $${BALANCE} when it ships, makes $${OFFER.price} in all, instead of $${OFFER.launchPrice} or more. Premium free for life.`}
    >
      <span className={s.term} aria-hidden="true">
        <b>${OFFER.deposit}</b>
        <small>today, refundable</small>
      </span>
      <span className={s.op} aria-hidden="true">
        +
      </span>
      <span className={s.term} aria-hidden="true">
        <b>${BALANCE}</b>
        <small>when it ships</small>
      </span>
      <span className={s.op} aria-hidden="true">
        =
      </span>
      <span className={`${s.term} ${s.total}`} aria-hidden="true">
        <b>${OFFER.price}</b>
        <small>
          in all, not <s>${OFFER.launchPrice}+</s>
        </small>
      </span>
      <span className={s.op} aria-hidden="true">
        +
      </span>
      <span className={s.term} aria-hidden="true">
        <b>Premium</b>
        <small>free for life</small>
      </span>
    </p>
  );
}
