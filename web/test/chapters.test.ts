import { describe, expect, it } from "vitest";
import { CHAPTERS, STATUS_LABEL } from "../src/chapters";

describe("chapter list", () => {
  it("has one chapter per layer, numbered 0 to 8 in order", () => {
    expect(CHAPTERS.map((c) => c.number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("gives every chapter a title, summary and known status", () => {
    for (const ch of CHAPTERS) {
      expect(ch.title, `chapter ${ch.number} title`).not.toBe("");
      expect(ch.summary, `chapter ${ch.number} summary`).not.toBe("");
      expect(STATUS_LABEL[ch.status]).toBeDefined();
    }
  });
});
