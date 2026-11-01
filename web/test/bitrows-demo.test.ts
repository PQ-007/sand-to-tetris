import { describe, expect, it } from "vitest";
import {
  binary,
  cellsOf,
  flip,
  maxColumn,
  placed,
  rowFate,
} from "../src/demos/bitrows";

describe("Bitfall rows demo", () => {
  it("a row is ten bits, leftmost cell first", () => {
    expect(binary(0b1011001101)).toBe("1011001101");
    expect(cellsOf(0b1000000001)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(flip(0, 0)).toBe(512);
    expect(flip(512, 9)).toBe(513);
  });

  it("full rows and target rows clear; the rest stay", () => {
    expect(rowFate(1023, 5)).toBe("full");
    expect(rowFate(717, 717)).toBe("target");
    expect(rowFate(716, 717)).toBe("stays");
  });

  it("places a piece row as the game does, (mask << 5) >> x", () => {
    expect(binary(placed(0b11100, 0))).toBe("1110000000");
    expect(binary(placed(0b11100, 7))).toBe("0000000111");
    expect(maxColumn(0b11100)).toBe(7);
    expect(maxColumn(0b10000)).toBe(9);
    // Collision is one AND.
    expect(placed(0b11000, 4) & 0b0000110000).not.toBe(0);
    expect(placed(0b11000, 6) & 0b0000110000).toBe(0);
  });
});
