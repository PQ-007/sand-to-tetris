// How values are written for the learner: the same on the canvas, the
// inputs and the truth table. Pure.

/** `5 (0101)` for small buses, `0x1235` for wide ones (as the checker). */
export function formatValue(v: number, width: number): string {
  if (width === 1) return String(v);
  if (width <= 8) return `${v} (${v.toString(2).padStart(width, "0")})`;
  return `0x${v.toString(16).padStart(Math.ceil(width / 4), "0")}`;
}

/**
 * A simulated value: a number when every bit is known, otherwise the bits
 * (most significant first, with Z and X). All-floating or all-unknown
 * buses are one letter; mixed ones are grouped by four from the right.
 */
export function showValue(v: string, width: number): string {
  if (/^\d+$/.test(v)) return formatValue(Number(v), width);
  if (v.length <= 1 || !/^[01ZX]+$/.test(v)) return v;
  if (/^(Z+|X+)$/.test(v)) return v.charAt(0);
  const groups: string[] = [];
  for (let end = v.length; end > 0; end -= 4)
    groups.unshift(v.slice(Math.max(0, end - 4), end));
  return groups.join(" ");
}

/** The bits of a number, most significant first. */
export function bitsOf(v: number, width: number): number[] {
  return Array.from(
    { length: width },
    (_, i) => Math.floor(v / 2 ** (width - 1 - i)) % 2,
  );
}

/** Parses `13`, `0xd` or `0b1101` (underscores allowed). */
export function parseNumber(text: string): number | undefined {
  const t = text.trim().replace(/_/g, "").toLowerCase();
  const n = t.startsWith("0x")
    ? parseInt(t.slice(2), 16)
    : t.startsWith("0b")
      ? parseInt(t.slice(2), 2)
      : /^\d+$/.test(t)
        ? Number(t)
        : NaN;
  return Number.isFinite(n) && /^(0x[0-9a-f]+|0b[01]+|\d+)$/.test(t)
    ? n
    : undefined;
}
