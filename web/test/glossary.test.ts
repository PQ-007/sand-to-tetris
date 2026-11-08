import { describe, expect, it } from "vitest";
import type { GlossaryItem } from "../content/load";
import { loadContent } from "../content/load";
import {
  fold,
  groupByLetter,
  initialOf,
  matches,
  otherTerms,
  searchKey,
  termIndex,
} from "../src/glossary";

const item = (
  id: string,
  term: string,
  untranslated?: boolean,
): GlossaryItem => ({
  id,
  term,
  short: "",
  shortHtml: "",
  see: [],
  ...(untranslated ? { untranslated } : {}),
});

const index = termIndex({
  en: { glossary: [item("latch", "Latch"), item("memory", "Memory")] },
  mn: { glossary: [item("latch", "Latch"), item("memory", "Санах ой")] },
  ja: {
    glossary: [item("latch", "ラッチ"), item("memory", "Memory", true)],
  },
});
const order = ["en", "mn", "ja"] as const;

describe("otherTerms", () => {
  it("lists the term in the other languages, English first", () => {
    expect(otherTerms(index, "latch", "ja", "ラッチ", order)).toEqual([
      { lang: "en", term: "Latch" },
    ]);
    expect(otherTerms(index, "memory", "mn", "Санах ой", order)).toEqual([
      { lang: "en", term: "Memory" },
    ]);
    expect(otherTerms(index, "memory", "en", "Memory", order)).toEqual([
      { lang: "mn", term: "Санах ой" },
    ]);
  });

  it("leaves out untranslated languages and spellings already shown", () => {
    // ja has no own word for memory yet; mn's "Latch" is the English one.
    expect(otherTerms(index, "latch", "en", "Latch", order)).toEqual([
      { lang: "ja", term: "ラッチ" },
    ]);
    expect(otherTerms(index, "nothing", "en", "x", order)).toEqual([]);
  });
});

describe("filter", () => {
  it("matches the term in any language, its id, case and accents aside", () => {
    const key = searchKey("logic-gate", ["Logic gate", "Логик гейт"]);
    expect(matches(key, "")).toBe(true);
    expect(matches(key, "  GATE ")).toBe(true);
    expect(matches(key, "логик")).toBe(true);
    expect(matches(key, "logic gate")).toBe(true);
    expect(matches(key, "latch")).toBe(false);
    expect(fold("Éclair  Ünit")).toBe("eclair unit");
  });
});

describe("letters", () => {
  it("files alphabet terms by letter, symbols under #, kana under none", () => {
    expect(initialOf("bit")).toBe("B");
    expect(initialOf("Ömnö")).toBe("O");
    expect(initialOf("санах ой")).toBe("С");
    expect(initialOf("6502")).toBe("#");
    expect(initialOf("ラッチ")).toBeNull();
  });

  it("groups in order of first appearance", () => {
    const groups = groupByLetter([
      { term: "Adder" },
      { term: "ALU" },
      { term: "Bit" },
    ]);
    expect(groups.map((g) => [g.letter, g.items.length])).toEqual([
      ["A", 2],
      ["B", 1],
    ]);
  });

  it("is one plain list when a term has no letter", () => {
    const groups = groupByLetter([{ term: "Bit" }, { term: "ラッチ" }]);
    expect(groups).toEqual([
      { letter: null, items: [{ term: "Bit" }, { term: "ラッチ" }] },
    ]);
    expect(groupByLetter([])).toEqual([]);
  });
});

describe("the real glossary", () => {
  const { content } = loadContent(
    new URL("../../docs", import.meta.url).pathname,
  );
  const real = termIndex(content);

  it("has the English and Mongolian term for every entry", () => {
    for (const g of content.en.glossary) {
      const terms = real.get(g.id);
      expect(terms?.en, g.id).toBe(g.term);
      expect(terms?.mn, g.id).toBeTruthy();
    }
  });

  it("doesn't pass off a fallback as a Japanese term", () => {
    for (const g of content.ja.glossary)
      if (g.untranslated) expect(real.get(g.id)?.ja).toBeUndefined();
  });
});
