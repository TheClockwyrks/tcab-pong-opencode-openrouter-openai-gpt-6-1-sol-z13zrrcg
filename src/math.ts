/** Bound a logical value without depending on rendering or engine state. */
export const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));
