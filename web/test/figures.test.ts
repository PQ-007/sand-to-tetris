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

  it("figures drawn for the course keep the skill's format and limits", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const dir = new URL("../src/vendor/hairline/", import.meta.url);
    const figures = readdirSync(dir).filter(
      (f) => f.endsWith(".js") && f !== "kernel.js",
    );
    expect(figures.length).toBeGreaterThan(0);
    for (const f of figures) {
      const src = readFileSync(new URL(f, dir), "utf8");
      const name = f.replace(/\.js$/, "");
      expect(src, f).toMatch(new RegExp(`hairline\\(\\{\\s*name: "${name}"`));
      // rule 10: no words in the drawing (no svg text elements)
      expect(src, f).not.toMatch(/mk\("text"/);
      expect(src.split("\n").length, f).toBeLessThanOrEqual(200);
    }
  });
});
