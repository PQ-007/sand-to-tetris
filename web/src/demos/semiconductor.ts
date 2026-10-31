// Simplified device physics for the p-n junction and MOSFET demos.
// These are textbook idealisations, chosen so the shapes are right, not
// to model any particular device.

/** Thermal voltage kT/q at room temperature (≈300 K), volts. */
export const VT = 0.02585;

// ---- p-n junction ---------------------------------------------------------

/** Built-in potential of a silicon junction, volts (typical). */
export const VBI = 0.7;
/** Saturation current, amps (small, so 0.7 V gives a few mA). */
const IS = 1e-14;

/** Ideal diode equation: I = Is (e^(V/VT) − 1). */
export function diodeCurrent(v: number): number {
  return IS * Math.expm1(v / VT);
}

/**
 * Depletion width relative to the zero-bias width. It grows with reverse
 * bias and shrinks with forward bias (W ∝ √(Vbi − V)).
 */
export function depletionWidth(v: number): number {
  const headroom = Math.max(VBI - v, 0.02);
  return Math.sqrt(headroom / VBI);
}

export type JunctionState =
  "reverse" | "unbiased" | "weak-forward" | "conducting";

export function junctionState(v: number): JunctionState {
  if (Math.abs(v) < 0.03) return "unbiased";
  if (v < 0) return "reverse";
  return v < 0.5 ? "weak-forward" : "conducting";
}

// ---- MOSFET -----------------------------------------------------------------

export const VDD = 3;
/** Threshold voltage magnitude, volts. */
export const VTH = 0.7;
/** Transconductance parameter k'·W/L, A/V². */
const K = 2e-3;
/** Subthreshold slope factor. */
const N = 1.5;

export type MosType = "nmos" | "pmos";

/**
 * Gate-to-source "overdrive" voltage that turns the device on. An NMOS's
 * source is at 0 V; a PMOS's source is at VDD, so it turns on when the
 * gate is pulled *low*.
 */
export function gateDrive(type: MosType, gate: number): number {
  return type === "nmos" ? gate : VDD - gate;
}

/**
 * Drain current in saturation using the EKV interpolation, which runs
 * smoothly from the exponential "off" region to the square law "on" region.
 */
export function drainCurrent(type: MosType, gate: number): number {
  const vgs = gateDrive(type, gate);
  const x = Math.log1p(Math.exp((vgs - VTH) / (2 * N * VT)));
  return 2 * N * K * VT * VT * x * x;
}

export function isOn(type: MosType, gate: number): boolean {
  return gateDrive(type, gate) > VTH;
}

/** How strongly the channel has formed, 0 (none) .. 1 (fully on). */
export function channelStrength(type: MosType, gate: number): number {
  const vgs = gateDrive(type, gate);
  return Math.min(1, Math.max(0, (vgs - VTH) / (VDD - VTH)));
}

/** Formats a current with an SI prefix, e.g. 3.2e-3 → "3.2 mA". */
export function formatAmps(a: number): string {
  const abs = Math.abs(a);
  const units: [number, string][] = [
    [1, "A"],
    [1e-3, "mA"],
    [1e-6, "µA"],
    [1e-9, "nA"],
    [1e-12, "pA"],
    [1e-15, "fA"],
  ];
  if (abs < 1e-15) return "≈ 0 A";
  const [scale, unit] = units.find(([s]) => abs >= s) ?? [1e-15, "fA"];
  const v = a / scale;
  return `${v.toFixed(Math.abs(v) < 10 ? 1 : 0)} ${unit}`;
}
