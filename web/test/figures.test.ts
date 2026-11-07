import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/en";
import { mn } from "../src/i18n/mn";
import { FIGURES, figureSlot } from "../src/figures";
import { CHAPTERS } from "../src/chapters";

describe("hairline figures", () => {
  const all = [
    ...Object.values(FIGURES.pages),
    ...Object.values(FIGURES.chapters),
  ];

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

  it("every named figure exists: in the package, or drawn for the course", async () => {
    const { readdirSync } = await import("node:fs");
    const hairline = await import("@lucasmarkes/hairline");
    const drawn = readdirSync(
      new URL("../src/vendor/hairline", import.meta.url),
    )
      .filter((f) => f.endsWith(".js") && f !== "kernel.js")
      .map((f) => f.replace(/\.js$/, ""));
    for (const name of all)
      expect(
        typeof (hairline as Record<string, unknown>)[name] === "function" ||
          drawn.includes(name),
        name,
      ).toBe(true);
  });

  it("a figure drawn for the course passes the skill's frame: one figure, 400 × 320", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../src/vendor/hairline/computer.js", import.meta.url),
      "utf8",
    );
    expect(src).toMatch(/hairline\(\{\s*name: "computer"/);
    // rule 10: no words in the drawing (no svg text elements)
    expect(src).not.toMatch(/mk\("text"/);
    expect(src.split("\n").length).toBeLessThanOrEqual(200);
  });
});
