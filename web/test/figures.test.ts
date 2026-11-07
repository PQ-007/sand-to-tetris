import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { mn } from "../src/i18n/mn";
import { FIGURES, figureSlot } from "../src/figures";
import { CHAPTERS } from "../src/chapters";

describe("hairline figures", () => {
  const all = [FIGURES.home, ...Object.values(FIGURES.chapters)];

  it("every figure has an accessible name in both languages", () => {
    for (const name of all)
      for (const dict of [en, mn] as Record<string, unknown>[])
        expect(dict[`figure.${name}`], name).toBeTruthy();
  });

  it("only illustrates chapters that exist", () => {
    const numbers = new Set(CHAPTERS.map((c) => c.number));
    for (const n of Object.keys(FIGURES.chapters))
      expect(numbers.has(Number(n)), n).toBe(true);
  });

  it("escapes the label in the placeholder", () => {
    expect(figureSlot("stack", 'A "stack" <frames> & more')).toBe(
      '<div class="hl-figure" data-figure="stack" data-label="A &quot;stack&quot; &lt;frames> &amp; more"></div>',
    );
  });

  it("every named figure exists in the package", async () => {
    const hairline = await import("@lucasmarkes/hairline");
    for (const name of all)
      expect(typeof (hairline as Record<string, unknown>)[name], name).toBe(
        "function",
      );
  });
});
