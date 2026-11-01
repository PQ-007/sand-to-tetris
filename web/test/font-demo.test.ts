import { describe, expect, it } from "vitest";
import { fontIndex, gridOf, rowBits, toggle, wordOf } from "../src/demos/font";
import { BUILTIN_OS, fontWords } from "../src/os";

describe("font demo", () => {
  const font = fontWords(BUILTIN_OS);

  it("reads the built-in font: 64 glyphs, A as drawn", () => {
    expect(font).toHaveLength(64);
    const a = font[fontIndex("A")]!;
    expect(rowBits(a)).toBe("010 101 111 101 101");
    expect(gridOf(a)[0]).toEqual([false, true, false]);
  });

  it("a grid and its word go both ways, a pixel at a time", () => {
    for (const w of font) expect(wordOf(gridOf(w))).toBe(w);
    expect(toggle(0, 0, 0)).toBe(1 << 14);
    expect(toggle(0, 4, 2)).toBe(1);
    expect(toggle(toggle(0x2be3, 2, 1), 2, 1)).toBe(0x2be3);
  });

  it("picks characters as draw_char does", () => {
    expect(fontIndex(" ")).toBe(0);
    expect(fontIndex("a")).toBe(fontIndex("A"));
    expect(fontIndex("~")).toBe(fontIndex("?"));
    expect(fontIndex("é")).toBe(fontIndex("?"));
  });
});
