// Data for the switch timeline. Sizes and speeds are rough orders of
// magnitude for comparison (see sources.yaml: switch-scales).
export interface SwitchKind {
  id: string;
  name: string;
  era: string;
  /** Typical size of one switching element, metres. */
  sizeM: number;
  /** Typical time to change state, seconds. */
  switchTimeS: number;
  example: string;
  how: string;
}

export const SWITCHES: readonly SwitchKind[] = [
  {
    id: "gear",
    name: "Gear",
    era: "1640s–1940s",
    sizeM: 1e-2,
    switchTimeS: 1e-1,
    example: "Pascaline, differential analyzer",
    how: "A toothed wheel turns one step. Carrying a digit means one wheel nudging the next.",
  },
  {
    id: "relay",
    name: "Relay",
    era: "1930s–1940s",
    sizeM: 3e-2,
    switchTimeS: 5e-3,
    example: "Harvard Mark I",
    how: "An electromagnet pulls a metal arm, closing or opening a contact.",
  },
  {
    id: "tube",
    name: "Vacuum tube",
    era: "1940s–1950s",
    sizeM: 5e-2,
    switchTimeS: 1e-6,
    example: "ENIAC",
    how: "A voltage on a wire mesh (the grid) lets electrons flow across a vacuum, or blocks them.",
  },
  {
    id: "transistor-1947",
    name: "First transistor",
    era: "1947",
    sizeM: 1e-2,
    switchTimeS: 1e-7,
    example: "Bell Labs point-contact transistor",
    how: "Two gold contacts on germanium: current into one controls the current through the other.",
  },
  {
    id: "transistor-1971",
    name: "Transistor on a chip",
    era: "1971",
    sizeM: 1e-5,
    switchTimeS: 1e-8,
    example: "Intel 4004",
    how: "A MOSFET: voltage on the gate creates or removes a conducting channel in silicon.",
  },
  {
    id: "transistor-today",
    name: "Transistor today",
    era: "2020s",
    sizeM: 5e-8,
    switchTimeS: 1e-11,
    example: "A phone or laptop processor",
    how: "The same MOSFET idea, shrunk until billions fit on a chip the size of a fingernail.",
  },
];

/** Position of `value` between `min` and `max` on a log scale, 0..1. */
export function logPosition(value: number, min: number, max: number): number {
  const p =
    (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return Math.min(1, Math.max(0, p));
}

const WORDS: [number, string][] = [
  [1e12, "a trillion"],
  [1e9, "a billion"],
  [1e6, "a million"],
  [1e3, "a thousand"],
];

/** "about 1,000 times" style wording for a ratio ≥ 1. */
export function describeRatio(ratio: number): string {
  if (ratio < 1.5) return "about the same";
  const exp = Math.round(Math.log10(ratio));
  const rounded = 10 ** exp;
  if (exp <= 2) return `about ${Math.round(ratio)} times`;
  const word = WORDS.find(([v]) => v === rounded)?.[1];
  return word
    ? `about ${word} times`
    : `about ${rounded.toLocaleString("en-US")} times`;
}

/** Sentence comparing two switches, e.g. for "relay vs today". */
export function compare(a: SwitchKind, b: SwitchKind): string {
  const size = a.sizeM / b.sizeM;
  const time = a.switchTimeS / b.switchTimeS;
  const sizePart =
    size >= 1
      ? `${describeRatio(size)} longer`
      : `${describeRatio(1 / size)} shorter`;
  const speedPart =
    time >= 1
      ? `${describeRatio(time)} slower`
      : `${describeRatio(1 / time)} faster`;
  return `A ${a.name.toLowerCase()} is ${sizePart} and ${speedPart} than a ${b.name.toLowerCase()}.`;
}
