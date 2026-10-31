// Two switches, wired in series or in parallel, lighting a lamp.
export type Arrangement = "series" | "parallel";

/** Does current reach the lamp? Series needs both closed; parallel either. */
export function lampOn(
  arrangement: Arrangement,
  a: boolean,
  b: boolean,
): boolean {
  return arrangement === "series" ? a && b : a || b;
}

/** The logic function each arrangement computes. */
export const LOGIC: Record<Arrangement, string> = {
  series: "AND",
  parallel: "OR",
};
