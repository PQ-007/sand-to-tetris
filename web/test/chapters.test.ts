import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../src/chapters";

describe("course outline", () => {
  it("has one chapter per layer, numbered 0 to 8 in order", () => {
    expect(CHAPTERS.map((c) => c.number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("gives every chapter a title and summary", () => {
    for (const ch of CHAPTERS) {
      expect(ch.title, `chapter ${ch.number} title`).not.toBe("");
      expect(ch.summary, `chapter ${ch.number} summary`).not.toBe("");
    }
  });
});
