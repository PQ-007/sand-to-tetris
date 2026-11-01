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

const WORDS: [number, Key][] = [
  [1e12, "sw.trillion"],
  [1e9, "sw.billion"],
  [1e6, "sw.million"],
  [1e3, "sw.thousand"],
];

/** A switch's name, era, example or how it works, in the current language. */
export function switchText(
  s: SwitchKind,
  field: "name" | "era" | "example" | "how",
): string {
  return t(`sw.${s.id}.${field}` as Key);
}

/** "about 1,000 times" style wording for a ratio ≥ 1. */
export function describeRatio(ratio: number): string {
  if (ratio < 1.5) return t("sw.same");
  const exp = Math.round(Math.log10(ratio));
  const rounded = 10 ** exp;
  if (exp <= 2) return t("sw.times", { n: Math.round(ratio) });
  const word = WORDS.find(([v]) => v === rounded)?.[1];
  return t("sw.times", { n: word ? t(word) : rounded.toLocaleString("en-US") });
}

/** Sentence comparing two switches, e.g. for "relay vs today". */
export function compare(a: SwitchKind, b: SwitchKind): string {
  const size = a.sizeM / b.sizeM;
  const time = a.switchTimeS / b.switchTimeS;
  const sizePart =
    size >= 1
      ? t("sw.longer", { ratio: describeRatio(size) })
      : t("sw.shorter", { ratio: describeRatio(1 / size) });
  const speedPart =
    time >= 1
      ? t("sw.slower", { ratio: describeRatio(time) })
      : t("sw.faster", { ratio: describeRatio(1 / time) });
  return t("sw.compare", {
    a: switchText(a, "name").toLowerCase(),
    b: switchText(b, "name").toLowerCase(),
    size: sizePart,
    speed: speedPart,
  });
}
