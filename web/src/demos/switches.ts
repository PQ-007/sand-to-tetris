// Data for the switch timeline. Sizes and speeds are rough orders of
// magnitude for comparison (see sources.yaml: switch-scales).
import { t, type Key } from "../i18n";

export interface SwitchKind {
  id: string;
  /** Typical size of one switching element, metres. */
  sizeM: number;
  /** Typical time to change state, seconds. */
  switchTimeS: number;
}

export const SWITCHES: readonly SwitchKind[] = [
  {
    id: "gear",
    sizeM: 1e-2,
    switchTimeS: 1e-1,
  },
  {
    id: "relay",
    sizeM: 3e-2,
    switchTimeS: 5e-3,
  },
  {
    id: "tube",
    sizeM: 5e-2,
    switchTimeS: 1e-6,
  },
  {
    id: "transistor-1947",
    sizeM: 1e-2,
    switchTimeS: 1e-7,
  },
  {
    id: "transistor-1971",
    sizeM: 1e-5,
    switchTimeS: 1e-8,
  },
  {
    id: "transistor-today",
    sizeM: 5e-8,
    switchTimeS: 1e-11,
  },
];

/** Position of `value` between `min` and `max` on a log scale, 0..1. */
export function logPosition(value: number, min: number, max: number): number {
  const p =
    (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return Math.min(1, Math.max(0, p));
}

/** A switch's name, era or how it works, in the current language. */
export function switchText(
  s: SwitchKind,
  field: "name" | "era" | "how",
): string {
  return t(`sw.${s.id}.${field}` as Key);
}

export interface Factor {
  /** The ratio rounded to a power of ten (≥ 1). */
  factor: number;
  /** True when the first value is the larger one. */
  more: boolean;
}

/** How many times one value is the other, as a power of ten. */
export function factorOf(a: number, b: number): Factor {
  const r = a / b;
  const more = r >= 1;
  return { factor: 10 ** Math.round(Math.log10(more ? r : 1 / r)), more };
}

/** "×1,000,000": a factor written out, the same in every language. */
export const formatFactor = (f: number): string =>
  `×${f.toLocaleString("en-US")}`;

/** What a switch is compared with: today's transistor, or for that one,
 * the gear it replaced. */
export function comparedWith(s: SwitchKind): SwitchKind {
  const today = SWITCHES[SWITCHES.length - 1] as SwitchKind;
  return s === today ? (SWITCHES[0] as SwitchKind) : today;
}
