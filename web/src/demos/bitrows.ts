// The Bitfall demo's model (docs/GAME.md): a board row is a 10-bit number,
// the leftmost cell in bit 9; a piece row is a 5-bit mask placed with
// (mask << 5) >> x. No DOM.

export const WIDTH = 10;
export const FULL = 1023;

/** The row's cells, leftmost first. */
export function cellsOf(value: number): boolean[] {
  return Array.from(
    { length: WIDTH },
    (_, c) => ((value >> (WIDTH - 1 - c)) & 1) === 1,
  );
}

/** The row with cell c flipped. */
export function flip(value: number, c: number): number {
  return value ^ (1 << (WIDTH - 1 - c));
}

/** A value as 10 binary digits. */
export function binary(value: number): string {
  return value.toString(2).padStart(WIDTH, "0");
}

/** What happens to a row when a piece locks: it clears as full, clears as
 * the target (a bonus), or stays. */
export function rowFate(
  value: number,
  target: number,
): "full" | "target" | "stays" {
  if (value === FULL) return "full";
  if (value === target) return "target";
  return "stays";
}

/** A 5-bit piece row (leftmost cell in bit 4) placed at column x. */
export function placed(mask: number, x: number): number {
  return ((mask << 5) >> x) & FULL;
}

/** The widest column a piece row of this mask can start at. */
export function maxColumn(mask: number): number {
  let w = 0;
  for (let m = mask & 31; m !== 0; m = (m << 1) & 31) w++;
  return WIDTH - w;
}
