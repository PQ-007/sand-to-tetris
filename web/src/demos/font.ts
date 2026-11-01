// The font demo's model: a 3 x 5 glyph and the 15-bit word that stores it
// (docs/OS.md "Text"): the top row in bits 14-12, each row's leftmost pixel
// in its highest bit. No DOM.

export const ROWS = 5;
export const COLS = 3;

/** The bit of pixel (row, col). */
export function bitOf(row: number, col: number): number {
  return 14 - (row * COLS + col);
}

/** A word as a grid of pixels, rows top first. */
export function gridOf(word: number): boolean[][] {
  return Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ((word >> bitOf(r, c)) & 1) === 1),
  );
}

/** A grid back to its word. */
export function wordOf(grid: boolean[][]): number {
  let w = 0;
  grid.forEach((row, r) =>
    row.forEach((on, c) => {
      if (on) w |= 1 << bitOf(r, c);
    }),
  );
  return w;
}

/** The word with one pixel flipped. */
export function toggle(word: number, row: number, col: number): number {
  return word ^ (1 << bitOf(row, col));
}

/** The word in binary, a space between rows: "010 101 111 101 101". */
export function rowBits(word: number): string {
  return gridOf(word)
    .map((row) => row.map((on) => (on ? "1" : "0")).join(""))
    .join(" ");
}

/** The index of character c in a font from ' ' (32) to '_' (95), the way
 * draw_char picks it: lowercase as capitals, anything else as '?'. */
export function fontIndex(c: string): number {
  let code = c.charCodeAt(0);
  if (code >= 97 && code <= 122) code -= 32;
  if (!(code >= 32 && code <= 95)) code = 63;
  return code - 32;
}
