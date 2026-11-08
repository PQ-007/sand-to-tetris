import { describe, expect, it } from "vitest";
import type { GlossaryItem } from "../content/load";
import { ContentError, parseGlossary } from "../content/data";
import { loadContent } from "../content/load";
import { PICTURE_IDS, glossaryPicture } from "../src/glossary-pictures";
import {
  fold,
  groupByChapter,
  linkedTerms,
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

describe("chapter groups", () => {
  const link = (id: string) => `<a class="term" data-term="${id}">x</a>`;
  const items = ["bit", "latch", "gate", "fps", "lonely"].map((id) => ({ id }));
  const chapters = [
    { number: 3, html: link("latch") + link("bit") },
    { number: 0, html: link("gate") + link("bit") + link("gate") },
  ];
  const programs = [{ html: link("fps") }, { html: link("latch") }];

  it("puts each term under the chapter that first links it, in reading order", () => {
    const groups = groupByChapter(items, chapters, programs);
    expect(groups.map((g) => [g.section, g.items.map((i) => i.id)])).toEqual([
      [{ kind: "chapter", number: 0 }, ["gate", "bit"]],
      [{ kind: "chapter", number: 3 }, ["latch"]],
      [{ kind: "programs" }, ["fps"]],
      [{ kind: "other" }, ["lonely"]],
    ]);
  });

  it("reads the links out of rendered HTML", () => {
    expect(linkedTerms(link("a") + "text" + link("b-c"))).toEqual(["a", "b-c"]);
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

  it("gives every term a chapter or a Programs page, in every language", () => {
    for (const lang of ["en", "mn", "ja"] as const) {
      const site = content[lang];
      const groups = groupByChapter(
        site.glossary,
        site.chapters,
        site.programs,
      );
      expect(
        groups
          .filter((g) => g.section.kind === "other")
          .flatMap((g) => g.items.map((i) => i.id)),
        lang,
      ).toEqual([]);
      expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(
        site.glossary.length,
      );
    }
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

describe("pictures", () => {
  const { content } = loadContent(
    new URL("../../docs", import.meta.url).pathname,
  );
  const ids = new Set(content.en.glossary.map((g) => g.id));

  it("are only for real glossary terms", () => {
    for (const id of PICTURE_IDS) expect(ids.has(id), id).toBe(true);
    expect(glossaryPicture("no-such-term")).toBe("");
  });

  it("are well-formed SVG with finite numbers, hidden from screen readers", () => {
    for (const id of PICTURE_IDS) {
      const svg = glossaryPicture(id, (w) => `[${w}]`);
      expect(svg, id).toMatch(/^<svg class="gloss-pic"[^>]*aria-hidden="true"/);
      expect(svg, id).not.toMatch(/NaN|undefined|Infinity/);
      // Every opened element is closed, in order.
      const open: string[] = [];
      for (const m of svg.matchAll(/<(\/?)([a-z]+)[^>]*?(\/?)>/g)) {
        if (m[3]) continue;
        if (m[1]) expect(open.pop(), `${id}: </${m[2]}>`).toBe(m[2]);
        else open.push(m[2] ?? "");
      }
      expect(open, id).toEqual([]);
    }
  });

  it("show their words in the learner's language", () => {
    const svg = glossaryPicture("switch", (w) => `«${w}»`);
    expect(svg).toContain("«on»");
    expect(svg).toContain("«off»");
  });
});
