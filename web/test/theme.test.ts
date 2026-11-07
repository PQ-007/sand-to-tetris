import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "../src/theme";

describe("theme", () => {
  it("a saved pick wins over the system", () => {
    expect(resolve("light", true)).toBe("light");
    expect(resolve("dark", false)).toBe("dark");
  });

  it("follows the system until the learner picks", () => {
    expect(resolve(null, true)).toBe("dark");
    expect(resolve(null, false)).toBe("light");
    expect(resolve("purple", true)).toBe("dark");
  });

  it("dark colours hang off data-theme, never the system setting alone", () => {
    const css = readFileSync(
      new URL("../src/style.css", import.meta.url),
      "utf8",
    );
    // The early script in index.html sets data-theme from the same rule,
    // so a media query here would ignore the learner's pick.
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).toContain(':root[data-theme="dark"]');
    const html = readFileSync(
      new URL("../index.html", import.meta.url),
      "utf8",
    );
    expect(html).toContain("s2t-theme");
  });
});
