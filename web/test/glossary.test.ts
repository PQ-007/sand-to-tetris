import { describe, expect, it } from "vitest";
import type { GlossaryItem } from "../content/load";
import { ContentError, parseGlossary } from "../content/data";
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
  it("files alphabet terms by letter, symbols under #", () => {
    expect(initialOf("bit")).toBe("B");
    expect(initialOf("Ömnö")).toBe("O");
    expect(initialOf("санах ой")).toBe("С");
    expect(initialOf("6502")).toBe("#");
  });

  it("files kana by row, as a Japanese index does, and kanji not at all", () => {
    expect(initialOf("ラッチ")).toBe("ら");
    expect(initialOf("ゲート")).toBe("か");
    expect(initialOf("ぜんかさんき")).toBe("さ");
    expect(initialOf("バス")).toBe("は");
    expect(initialOf("ヴ")).toBe("あ");
    expect(initialOf("ンー")).toBe("わ");
    expect(initialOf("論理ゲート")).toBeNull();
  });

  it("files a term by its reading when it has one", () => {
    const groups = groupByLetter([
      { term: "論理ゲート", reading: "ろんりげーと" },
      { term: "ラッチ" },
    ]);
    expect(groups.map((g) => g.letter)).toEqual(["ら"]);
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
    const groups = groupByLetter([{ term: "Bit" }, { term: "論理" }]);
    expect(groups).toEqual([
      { letter: null, items: [{ term: "Bit" }, { term: "論理" }] },
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

  it("has every term in Japanese, each kanji term with its reading", () => {
    for (const g of content.ja.glossary) {
      expect(g.untranslated, g.id).toBeUndefined();
      if (/^\p{Script=Han}/u.test(g.term))
        expect(g.reading, `${g.id} (${g.term}) needs a reading`).toBeTruthy();
    }
  });

  it("files the Japanese glossary under kana rows, あ to わ", () => {
    const letters = groupByLetter(content.ja.glossary).map((g) => g.letter);
    expect(letters).not.toContain(null);
    const kana = letters.filter((l) => l && /\p{Script=Hiragana}/u.test(l));
    expect(kana).toEqual([...kana].sort((a, b) => a!.localeCompare(b!, "ja")));
    expect(kana[0]).toBe("あ");
  });
});

describe("readings", () => {
  const yaml = (reading: string) =>
    `- id: logic-gate\n  term: "論理ゲート"\n  reading: "${reading}"\n  short: "回路。"\n`;

  it("are kept for sorting and must be kana", () => {
    expect(parseGlossary(yaml("ろんりげーと"))[0]?.reading).toBe(
      "ろんりげーと",
    );
    expect(() => parseGlossary(yaml("ronri"))).toThrow(ContentError);
  });
});
