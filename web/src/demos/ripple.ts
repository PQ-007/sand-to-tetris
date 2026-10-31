// A ripple-carry adder, step by step. The carry into column i+1 is known
// immediately if column i's two input bits are equal (both 1: carry for
// sure; both 0: no carry for sure). Otherwise it has to wait for column i's
// own carry: the carry "ripples". One step = one column of waiting.

export interface RippleState {
  /** Carry into each column (index 0..n), null while still unknown. */
  carries: (0 | 1 | null)[];
  /** Sum bit of each column, null while unknown. */
  sums: (0 | 1 | null)[];
  done: boolean;
}

const bit = (x: number, i: number): 0 | 1 => ((x >> i) & 1) as 0 | 1;

/** Step at which each carry becomes known (carry 0 is known at step 0). */
export function carryTimes(a: number, b: number, n: number): number[] {
  const t = [0];
  for (let i = 0; i < n; i++) {
    const prev = t[i] ?? 0;
    t.push(bit(a, i) === bit(b, i) ? 0 : prev + 1);
  }
  return t;
}

/** Steps until every sum and the carry out are known. */
export function settleSteps(a: number, b: number, n: number): number {
  return Math.max(...carryTimes(a, b, n));
}

/** The adder's state after `step` steps. */
export function rippleAt(
  a: number,
  b: number,
  n: number,
  step: number,
): RippleState {
  const times = carryTimes(a, b, n);
  const full: (0 | 1)[] = [0];
  for (let i = 0; i < n; i++) {
    const s = bit(a, i) + bit(b, i) + (full[i] ?? 0);
    full.push(s >= 2 ? 1 : 0);
  }
  const carries = full.map((c, i) => ((times[i] ?? 0) <= step ? c : null));
  const sums = Array.from({ length: n }, (_, i) => {
    const c = carries[i];
    return c === null || c === undefined
      ? null
      : (((bit(a, i) + bit(b, i) + c) & 1) as 0 | 1);
  });
  return { carries, sums, done: step >= settleSteps(a, b, n) };
}
