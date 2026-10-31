// Analog vs digital signals passing through a chain of stages with noise.
// Voltages are fractions of the supply: 0 = ground, 1 = supply.

/** Small, fast, seedable random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample (Box–Muller). */
export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Gain of the restoring stage's S-curve around the midpoint. */
export const GAIN = 12;

const sig = (v: number) => 1 / (1 + Math.exp(-GAIN * (v - 0.5)));
const S0 = sig(0);
const S1 = sig(1);

/**
 * Transfer curve of a digital buffer (two inverters in a row): inputs near
 * 0 come out closer to 0, inputs near 1 come out closer to 1. This
 * "restoring" S-curve is what makes digital signals robust.
 */
export function buffer(v: number): number {
  return (sig(v) - S0) / (S1 - S0);
}

export interface ChainRun {
  analog: number[];
  digital: number[];
}

export interface ChainOptions {
  bit: 0 | 1;
  stages: number;
  /** Standard deviation of noise added at every stage. */
  noise: number;
  seed: number;
}

/**
 * Sends one bit through `stages` stages. Analog stages copy their input
 * (gain 1), so noise piles up. Digital stages pass the signal through the
 * buffer curve first, pulling it back toward 0 or 1 before noise is added.
 */
export function runChain({ bit, stages, noise, seed }: ChainOptions): ChainRun {
  const rand = rng(seed);
  const analog = [bit as number];
  const digital = [bit as number];
  for (let i = 0; i < stages; i++) {
    const a = analog[i] ?? 0;
    const d = digital[i] ?? 0;
    analog.push(a + noise * gaussian(rand));
    digital.push(buffer(d) + noise * gaussian(rand));
  }
  return { analog, digital };
}

/** Reads a voltage as a bit, using the midpoint as the threshold. */
export const readBit = (v: number): 0 | 1 => (v >= 0.5 ? 1 : 0);

/** Fraction of `trials` bits that arrive wrong, for each chain. */
export function errorRates(
  opts: Omit<ChainOptions, "seed" | "bit">,
  trials: number,
  seed = 1,
) {
  let analog = 0;
  let digital = 0;
  for (let t = 0; t < trials; t++) {
    const bit: 0 | 1 = t % 2 === 0 ? 1 : 0;
    const run = runChain({ ...opts, bit, seed: seed + t * 7919 });
    if (readBit(run.analog[opts.stages] ?? 0) !== bit) analog++;
    if (readBit(run.digital[opts.stages] ?? 0) !== bit) digital++;
  }
  return { analog: analog / trials, digital: digital / trials };
}

export interface Margins {
  /** Highest input still guaranteed to read as 0. */
  vil: number;
  /** Lowest input guaranteed to read as 1. */
  vih: number;
  /** Output for a valid 0 / 1 input. */
  vol: number;
  voh: number;
  /** Noise margins: how much noise a valid output can take and still be read correctly. */
  nmLow: number;
  nmHigh: number;
}

/**
 * Noise margins from the unity-gain points of the transfer curve (where
 * its slope is exactly 1): the standard textbook definition.
 */
export function noiseMargins(f: (v: number) => number = buffer): Margins {
  const slope = (v: number) => (f(v + 1e-5) - f(v - 1e-5)) / 2e-5;
  const findUnity = (lo: number, hi: number) => {
    // slope − 1 changes sign exactly once in each half of the S-curve.
    let a = lo;
    let b = hi;
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2;
      if (slope(a) - 1 < 0 === slope(m) - 1 < 0) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const vil = findUnity(0, 0.5);
  const vih = findUnity(0.5, 1);
  const vol = f(vil);
  const voh = f(vih);
  return { vil, vih, vol, voh, nmLow: vil - vol, nmHigh: voh - vih };
}
