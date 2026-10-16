import { SAVING } from "@/lib/preorder/offer";
import s from "./preorder.module.css";

/**
 * The preorder saving as a tag: at least $40 off the launch price, and no Premium subscription.
 * `long` adds the subscription half where there's room for it.
 */
export default function Save({ long = false, className }: { long?: boolean; className?: string }) {
  return (
    <span className={`${s.save} ${className ?? ""}`}>
      save ${SAVING}+{long ? " · no Premium subscription, ever" : ""}
    </span>
  );
}
