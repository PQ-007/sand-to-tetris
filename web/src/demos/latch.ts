// A latch made of two cross-coupled NOR gates, one gate delay at a time:
// q = NOR(r, q̄) and q̄ = NOR(s, q), both gates updating together each step.
// The loop is the memory: with s = r = 0 each output keeps the other one
// where it is.

export type Bit = 0 | 1 | "X";

export interface LatchState {
  q: Bit;
  qn: Bit;
}

/** At power-on nothing is known. */
export const POWER_ON: LatchState = { q: "X", qn: "X" };

/** NOR with unknowns: a 1 on either input decides it (0) regardless. */
export function nor(a: Bit, b: Bit): Bit {
  if (a === 1 || b === 1) return 0;
  if (a === 0 && b === 0) return 1;
  return "X";
}

/** One gate delay: both NORs compute from the values of the moment. */
export function step(s: 0 | 1, r: 0 | 1, st: LatchState): LatchState {
  return { q: nor(r, st.qn), qn: nor(s, st.q) };
}

/**
 * Steps until nothing changes, at most `limit` delays. `trace` holds the
 * state after each delay that changed something.
 */
export function settle(
  s: 0 | 1,
  r: 0 | 1,
  from: LatchState,
  limit = 8,
): { trace: LatchState[]; settled: boolean } {
  const trace: LatchState[] = [];
  let st = from;
  for (let i = 0; i < limit; i++) {
    const next = step(s, r, st);
    if (next.q === st.q && next.qn === st.qn) return { trace, settled: true };
    trace.push(next);
    st = next;
  }
  return { trace, settled: false };
}
