// The data side of a timing diagram ("waveform"): signals, runs of equal
// values, short bus labels. Pure, so it's testable; drawing is in
// waveform-view.ts.

export interface Signal {
  name: string;
  width: number;
  /** One value per step: "0", "1", a decimal number for a bus, "X", or
   * "" (no value, e.g. not simulated). */
  values: string[];
  /** Outputs are drawn after a divider. */
  output?: boolean;
  /** A longer description of a bus value (e.g. an instruction's assembly):
   * shown as a tooltip, and instead of the short label where it fits. */
  describe?: (value: string) => string;
}

export interface Segment {
  from: number;
  /** Exclusive. */
  to: number;
  value: string;
}

/** Runs of equal values. */
export function segments(values: string[]): Segment[] {
  const out: Segment[] = [];
  values.forEach((value, i) => {
    const last = out[out.length - 1];
    if (last && last.value === value) last.to = i + 1;
    else out.push({ from: i, to: i + 1, value });
  });
  return out;
}

/** A bus value as short text: hex digits for wide buses, decimal for
 * narrow ones, "X" if any bit is unknown. */
export function shortValue(value: string, width: number): string {
  if (value === "" || width === 1) return value;
  if (!/^\d+$/.test(value)) return "X";
  const n = Number(value);
  return width > 8
    ? n.toString(16).padStart(Math.ceil(width / 4), "0")
    : String(n);
}

/** The label for a bus segment `room` pixels wide: the description if it
 * fits (about 7 px per character), else the short value. */
export function segmentLabel(
  signal: Pick<Signal, "width" | "describe">,
  value: string,
  room: number,
): string {
  const short = shortValue(value, signal.width);
  const long = signal.describe?.(value);
  return long && long.length * 7 <= room ? long : short;
}
