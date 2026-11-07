import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../src/chapters";
import { KNOWN_TAGS } from "../src/components/known-tags";
import { en } from "../src/i18n/en";
import { mn } from "../src/i18n/mn";
import { loadContent, loadLevelText, loadLevels } from "../content/load";

const docs = new URL("../../docs", import.meta.url).pathname;

// The real content must build cleanly: every glossary link, citation and
// component tag resolves. Errors carry file:line.
describe("docs/ content", () => {
  const { content, errors } = loadContent(docs);

  it("has no broken glossary links, citations or component tags", () => {
    expect(errors).toEqual([]);
  });

  it("every chapter ends with a 'What you built / What you learned' summary", () => {
    for (const ch of content.en.chapters) {
      expect(ch.html, `chapter ${ch.number}`).toMatch(
        /<aside class="summary">[\s\S]*What you built[\s\S]*What you learned/,
      );
    }
    for (const ch of content.mn.chapters) {
      expect(ch.html, `mn chapter ${ch.number}`).toContain(
        '<aside class="summary">',
      );
    }
  });

  it("every chapter in every language is there, with the same sections", () => {
    expect(content.mn.chapters.map((c) => c.number)).toEqual(
      content.en.chapters.map((c) => c.number),
    );
    content.en.chapters.forEach((ch, i) => {
      expect(content.mn.chapters[i]?.headingIds).toEqual(ch.headingIds);
    });
    expect(content.mn.glossary.length).toBe(content.en.glossary.length);
  });

  it("every program page is translated with the same sections, and runs", async () => {
    const { PROGRAMS } = await import("../src/programs");
    const { EXAMPLES } = await import("../src/machine-programs");
    expect(content.en.programs.length).toBeGreaterThan(0);
    expect(content.mn.programs.map((p) => p.id)).toEqual(
      content.en.programs.map((p) => p.id),
    );
    content.en.programs.forEach((p, i) => {
      expect(content.mn.programs[i]?.headingIds, p.id).toEqual(p.headingIds);
      const info = PROGRAMS[p.id];
      expect(info, `${p.id}: an entry in src/programs.ts`).toBeTruthy();
      expect(
        EXAMPLES.some((e) => e.id === info?.example && e.lang === info?.lang),
        `${p.id}: its Machine example`,
      ).toBe(true);
    });
    expect(Object.keys(PROGRAMS).sort()).toEqual(
      content.en.programs.map((p) => p.id).sort(),
    );
  });

  it("every chapter has a sources section if it cites anything", () => {
    for (const ch of [...content.en.chapters, ...content.mn.chapters]) {
      if (ch.html.includes('class="cite'))
        expect(ch.html).toContain('class="sources"');
    }
  });

  // The course nav, home page and level map take titles from the outline.
  it("the course outline lists every chapter under its own title", () => {
    expect(CHAPTERS.map((c) => c.number)).toEqual(
      content.en.chapters.map((c) => c.number),
    );
    for (const [lang, strings] of [
      ["en", en],
      ["mn", mn],
    ] as const) {
      for (const ch of content[lang].chapters) {
        const key = `outline.${ch.number}.title` as keyof typeof en;
        expect(strings[key], `${lang} chapter ${ch.number}`).toBe(ch.title);
      }
    }
    for (const ch of content.en.chapters)
      expect(CHAPTERS[ch.number]?.title).toBe(ch.title);
  });
});

describe("component registry", () => {
  it("KNOWN_TAGS matches the components that call customElements.define", () => {
    const dir = new URL("../src/components/", import.meta.url).pathname;
    const defined = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .flatMap((f) =>
        [
          ...readFileSync(dir + f, "utf8").matchAll(
            /customElements\.define\("([a-z0-9-]+)"/g,
          ),
        ].map((m) => m[1]),
      )
      .filter((tag) => tag !== "s2t-core-status");
    expect([...defined].sort()).toEqual([...KNOWN_TAGS].sort());
  });
});

describe("spoiler guard", () => {
  it("website code never reads reference solutions (only level.toml files)", () => {
    const roots = ["../src/", "../content/"].map(
      (r) => new URL(r, import.meta.url).pathname,
    );
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = dir + entry.name;
        if (entry.isDirectory()) {
          if (entry.name !== "pkg") walk(path + "/");
        } else if (
          /\.(ts|js)$/.test(entry.name) &&
          /reference\.json/.test(readFileSync(path, "utf8"))
        ) {
          offenders.push(path);
        }
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });

  it.each(["mn", "ja"])(
    "every level has a %s name, goal and the same hints",
    (lang) => {
      const dir = new URL("../../hdl/levels", import.meta.url).pathname;
      const text = loadLevelText(`${dir}/${lang}.yaml`);
      for (const l of loadLevels(dir)) {
        const tr = text[l.id];
        expect(tr?.name, `${l.id} name`).toBeTruthy();
        expect(tr?.goal, `${l.id} goal`).toBeTruthy();
        const hints = l.toml.split("[hints]")[1] ?? "";
        const keys = [...hints.matchAll(/^(\w+)\s*=/gm)].map((m) => m[1]);
        expect(Object.keys(tr?.hints ?? {}).sort(), `${l.id} hints`).toEqual(
          keys.sort(),
        );
      }
      const ids = new Set(loadLevels(dir).map((l) => l.id));
      expect(Object.keys(text).filter((id) => !ids.has(id))).toEqual([]);
    },
  );

  it("the site gets every level definition, and nothing else from hdl/", () => {
    const levels = loadLevels(
      new URL("../../hdl/levels", import.meta.url).pathname,
    );
    const ids = levels.map((l) => l.id);
    for (const id of ["not", "nand", "nor", "zero", "one", "and", "add16"]) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of levels) {
      expect(l.toml).toContain(`id = "${l.id}"`);
      expect(l.toml).not.toContain('"wires"');
    }
  });
});
