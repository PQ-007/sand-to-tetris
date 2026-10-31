import { describe, expect, it } from "vitest";
import { segments, shortValue } from "../src/editor/waveform";

describe("waveform segments", () => {
  it("merges steps that keep the same value", () => {
    expect(segments(["0", "0", "1", "1", "1", "0"])).toEqual([
      { from: 0, to: 2, value: "0" },
      { from: 2, to: 5, value: "1" },
      { from: 5, to: 6, value: "0" },
    ]);
  });

  it("keeps unknown and missing values as their own segments", () => {
    expect(segments(["X", "X", "1", "", "1"])).toEqual([
      { from: 0, to: 2, value: "X" },
      { from: 2, to: 3, value: "1" },
      { from: 3, to: 4, value: "" },
      { from: 4, to: 5, value: "1" },
    ]);
    expect(segments([])).toEqual([]);
  });
});

describe("bus values in a waveform", () => {
  it("writes buses short: hex for 16 bits, decimal for small ones", () => {
    expect(shortValue("4660", 16)).toBe("1234");
    expect(shortValue("5", 3)).toBe("5");
    expect(shortValue("1", 1)).toBe("1");
    // Partly unknown buses (bit strings) and blanks stay readable.
    expect(shortValue("XXXX1111XXXX0000", 16)).toBe("X");
    expect(shortValue("", 16)).toBe("");
  });
});
