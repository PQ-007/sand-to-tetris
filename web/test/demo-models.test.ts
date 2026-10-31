import { describe, expect, it } from "vitest";
import {
  buffer,
  errorRates,
  noiseMargins,
  rng,
  runChain,
} from "../src/demos/noise";
import {
  channelStrength,
  depletionWidth,
  diodeCurrent,
  drainCurrent,
  formatAmps,
  isOn,
  junctionState,
  VDD,
} from "../src/demos/semiconductor";
import {
  compare,
  describeRatio,
  logPosition,
  SWITCHES,
} from "../src/demos/switches";
import { WAFER_STEPS } from "../src/demos/wafer";

describe("switch timeline", () => {
  it("ends with the smallest and fastest switch", () => {
    const today = SWITCHES[SWITCHES.length - 1];
    for (const s of SWITCHES) {
      expect(today!.sizeM).toBeLessThanOrEqual(s.sizeM);
      expect(today!.switchTimeS).toBeLessThanOrEqual(s.switchTimeS);
    }
  });

  it("describes ratios in words", () => {
    expect(describeRatio(1)).toBe("about the same");
    expect(describeRatio(50)).toBe("about 50 times");
    expect(describeRatio(1.1e6)).toBe("about a million times");
    expect(describeRatio(1e4)).toBe("about 10,000 times");
  });

  it("compares two switches in one sentence", () => {
    const relay = SWITCHES.find((s) => s.id === "relay")!;
    const today = SWITCHES.find((s) => s.id === "transistor-today")!;
    expect(compare(relay, today)).toBe(
      "A relay is about a million times longer and about a billion times slower than a transistor today.",
    );
  });

  it("places values on a log axis", () => {
    expect(logPosition(1e-6, 1e-9, 1e-3)).toBeCloseTo(0.5);
    expect(logPosition(1e3, 1e-9, 1e-3)).toBe(1);
  });
});

describe("p-n junction", () => {
  it("conducts forward and blocks reverse", () => {
    expect(diodeCurrent(0.7)).toBeGreaterThan(1e-3);
    expect(Math.abs(diodeCurrent(-1))).toBeLessThan(1e-13);
    expect(diodeCurrent(0)).toBe(0);
  });

  it("widens the depletion region under reverse bias", () => {
    expect(depletionWidth(-2)).toBeGreaterThan(depletionWidth(0));
    expect(depletionWidth(0.6)).toBeLessThan(depletionWidth(0));
    expect(depletionWidth(0)).toBeCloseTo(1);
  });

  it("classifies the bias", () => {
    expect(junctionState(-0.5)).toBe("reverse");
    expect(junctionState(0)).toBe("unbiased");
    expect(junctionState(0.02)).toBe("unbiased");
    expect(junctionState(0.3)).toBe("weak-forward");
    expect(junctionState(0.65)).toBe("conducting");
  });
});

describe("MOSFET", () => {
  it("NMOS: off with gate low, on with gate high, a million times apart", () => {
    expect(isOn("nmos", 0)).toBe(false);
    expect(isOn("nmos", VDD)).toBe(true);
    expect(drainCurrent("nmos", VDD) / drainCurrent("nmos", 0)).toBeGreaterThan(
      1e6,
    );
  });

  it("PMOS is the mirror image: on with gate low", () => {
    expect(isOn("pmos", 0)).toBe(true);
    expect(isOn("pmos", VDD)).toBe(false);
    expect(drainCurrent("pmos", 0)).toBeCloseTo(drainCurrent("nmos", VDD), 12);
  });

  it("current grows smoothly with gate voltage", () => {
    let prev = 0;
    for (let v = 0; v <= VDD; v += 0.1) {
      const i = drainCurrent("nmos", v);
      expect(i).toBeGreaterThan(prev);
      prev = i;
    }
  });

  it("channel strength runs 0..1", () => {
    expect(channelStrength("nmos", 0)).toBe(0);
    expect(channelStrength("nmos", VDD)).toBe(1);
    expect(channelStrength("pmos", 0)).toBe(1);
  });

  it("formats currents with SI prefixes", () => {
    expect(formatAmps(3.2e-3)).toBe("3.2 mA");
    expect(formatAmps(45e-9)).toBe("45 nA");
    expect(formatAmps(0)).toBe("≈ 0 A");
  });
});

describe("sand to wafer", () => {
  it("purity only improves along the way", () => {
    const imp = WAFER_STEPS.map((s) => s.impurity).filter(
      (x) => x !== undefined,
    );
    for (let i = 1; i < imp.length; i++)
      expect(imp[i]!).toBeLessThanOrEqual(imp[i - 1]!);
  });
});

describe("noise chain", () => {
  it("is deterministic for a seed", () => {
    const a = rng(42);
    const b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(runChain({ bit: 1, stages: 5, noise: 0.1, seed: 3 })).toEqual(
      runChain({ bit: 1, stages: 5, noise: 0.1, seed: 3 }),
    );
  });

  it("the buffer restores levels: near-0 goes lower, near-1 goes higher", () => {
    expect(buffer(0)).toBeCloseTo(0);
    expect(buffer(1)).toBeCloseTo(1);
    expect(buffer(0.2)).toBeLessThan(0.2);
    expect(buffer(0.8)).toBeGreaterThan(0.8);
  });

  it("without noise both chains deliver the bit perfectly", () => {
    const run = runChain({ bit: 1, stages: 10, noise: 0, seed: 1 });
    expect(run.analog.every((v) => v === 1)).toBe(true);
    expect(run.digital.every((v) => Math.abs(v - 1) < 1e-9)).toBe(true);
  });

  it("digital restoration beats analog over a long noisy chain", () => {
    const rates = errorRates({ stages: 20, noise: 0.08 }, 2000);
    expect(rates.analog).toBeGreaterThan(0.03);
    expect(rates.digital).toBeLessThan(rates.analog / 10);
  });

  it("noise margins are positive and symmetric", () => {
    const m = noiseMargins();
    expect(m.vil).toBeLessThan(0.5);
    expect(m.vih).toBeGreaterThan(0.5);
    expect(m.nmLow).toBeGreaterThan(0.1);
    expect(m.nmLow).toBeCloseTo(m.nmHigh, 6);
  });
});

describe("switch networks", () => {
  it("series is AND, parallel is OR", async () => {
    const { lampOn } = await import("../src/demos/network");
    const rows = [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ] as const;
    expect(rows.map(([a, b]) => lampOn("series", a, b))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(rows.map(([a, b]) => lampOn("parallel", a, b))).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });
});

describe("ripple-carry adder", () => {
  it("settles instantly when no column has to wait", async () => {
    const { settleSteps } = await import("../src/demos/ripple");
    expect(settleSteps(0, 0, 8)).toBe(0);
    expect(settleSteps(0b1100, 0b1100, 8)).toBe(0);
  });

  it("waits one step per column the carry passes through", async () => {
    const { settleSteps } = await import("../src/demos/ripple");
    // 255 + 1: bit 0 makes a carry, which then ripples up 7 more columns.
    expect(settleSteps(255, 1, 8)).toBe(7);
    // 255 + 0: no carry ever happens, but every column must wait to learn that.
    expect(settleSteps(255, 0, 8)).toBe(8);
    expect(settleSteps(3, 0, 8)).toBe(2);
  });

  it("ends with the right sum, and unknown bits on the way", async () => {
    const { rippleAt } = await import("../src/demos/ripple");
    const start = rippleAt(255, 1, 8, 0);
    expect(start.sums[0]).toBe(0);
    expect(start.sums[3]).toBeNull();
    const end = rippleAt(255, 1, 8, 7);
    expect(end.done).toBe(true);
    expect(end.sums.reduce<number>((n, s, i) => n + (s ?? 0) * 2 ** i, 0)).toBe(
      0,
    );
    expect(end.carries[8]).toBe(1); // carry out of the top column
    const mid = rippleAt(100, 27, 8, 10);
    expect(mid.sums.reduce<number>((n, s, i) => n + (s ?? 0) * 2 ** i, 0)).toBe(
      127,
    );
  });
});
