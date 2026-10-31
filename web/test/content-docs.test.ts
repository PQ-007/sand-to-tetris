import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { KNOWN_TAGS } from "../src/components/known-tags";
import { loadContent, loadLevels } from "../content/load";

const docs = new URL("../../docs", import.meta.url).pathname;

// The real content must build cleanly: every glossary link, citation and
// component tag resolves. Errors carry file:line.
describe("docs/ content", () => {
  const { content, errors } = loadContent(docs);

  it("has no broken glossary links, citations or component tags", () => {
    expect(errors).toEqual([]);
  });

  it("every chapter ends with a 'What you built / What you learned' summary", () => {
    for (const ch of content.chapters) {
      expect(ch.html, `chapter ${ch.number}`).toMatch(
        /<aside class="summary">[\s\S]*What you built[\s\S]*What you learned/,
      );
    }
  });

  it("every chapter has a sources section if it cites anything", () => {
    for (const ch of content.chapters) {
      if (ch.html.includes('class="cite'))
        expect(ch.html).toContain('class="sources"');
    }
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

  it("the site gets every level definition, and nothing else from hdl/", () => {
    const levels = loadLevels(
      new URL("../../hdl/levels", import.meta.url).pathname,
    );
    expect(levels.map((l) => l.id).sort()).toEqual([
      "and",
      "nand",
      "nor",
      "not",
    ]);
    for (const l of levels) {
      expect(l.toml).toContain(`id = "${l.id}"`);
      expect(l.toml).not.toContain('"wires"');
    }
  });
});
