import { describe, expect, it } from "vitest";
import { ContentError, parseGlossary, parseSources } from "../content/data";
import { createRenderer, slugify } from "../content/markdown";

const glossary = parseGlossary(`
- id: transistor
  term: Transistor
  short: An electrically controlled switch.
- id: p-n-junction
  term: p-n junction
  short: Where p-type meets n-type silicon.
`);
const sources = parseSources(`
- id: solid
  claim: A settled fact.
  sources: [{ title: A book, url: "https://example.org/a" }]
  checked: test
- id: shaky
  claim: A disputed fact.
  sources: [{ title: A paper, url: "https://example.org/b" }]
  checked: test
  uncertain: Historians disagree.
`);
const { renderChapter } = createRenderer({
  glossary,
  sources,
  knownTags: ["mosfet-demo"],
});

const front = "---\nnumber: 0\ntitle: T\nsummary: S\n---\n";

describe("glossary links", () => {
  it("links [[term]] and [[shown|id]] to the glossary", () => {
    const { chapter, errors } = renderChapter(
      `${front}A [[transistor]] and a [[junction|p-n-junction]].\n`,
      "c.md",
    );
    expect(errors).toEqual([]);
    expect(chapter?.html).toContain(
      '<a class="term" href="#/glossary/transistor" data-term="transistor">transistor</a>',
    );
    expect(chapter?.html).toContain('data-term="p-n-junction">junction</a>');
  });

  it("keeps emphasis around and next to links", () => {
    const { chapter } = renderChapter(
      `${front}Bold **[[transistor]]** and *plain* and **in series**.\n`,
      "c.md",
    );
    expect(chapter?.html).toContain('<strong><a class="term"');
    expect(chapter?.html).toContain("<em>plain</em>");
    expect(chapter?.html).toContain("<strong>in series</strong>");
    expect(chapter?.html).not.toContain("**");
  });

  it("allows a [[shown\\|id]] link inside a table cell", () => {
    const { chapter, errors } = renderChapter(
      `${front}| a | b |\n|---|---|\n| 1 | **[[junction\\|p-n-junction]]** |\n`,
      "c.md",
    );
    expect(errors).toEqual([]);
    expect(chapter?.html).toContain(
      '<strong><a class="term" href="#/glossary/p-n-junction" data-term="p-n-junction">junction</a></strong>',
    );
  });

  it("reports a glossary link that a table cut in half", () => {
    const { errors } = renderChapter(
      `${front}| a | b |\n|---|---|\n| 1 | [[junction|p-n-junction]] |\n`,
      "c.md",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(
      /^c\.md:8: .*\[\[junction.*wasn't rendered.*\\\|/,
    );
  });

  it("wraps tables so they can scroll on narrow screens", () => {
    const { chapter } = renderChapter(
      `${front}| a | b |\n|---|---|\n| 1 | 2 |\n`,
      "c.md",
    );
    expect(chapter?.html).toMatch(/^<div class="table-scroll"><table>/);
    expect(chapter?.html).toContain("</table></div>");
  });

  it("reports an unknown term with file and line", () => {
    const { errors } = renderChapter(
      `${front}\nFine line.\n\nA [[flux capacitor]].\n`,
      "c.md",
    );
    expect(errors).toEqual([
      "c.md:9: [[flux capacitor]] → no glossary entry `flux-capacitor`",
    ]);
  });
});

describe("citations", () => {
  it("numbers sources by first use and reuses numbers", () => {
    const { chapter, errors } = renderChapter(
      `${front}One[@solid]. Two[@shaky]. Again[@solid].\n`,
      "c.md",
    );
    expect(errors).toEqual([]);
    const nums = [
      ...(chapter?.html ?? "").matchAll(/title="Source[^"]*">([^<]+)</g),
    ].map((m) => m[1]);
    expect(nums).toEqual(["1", "2?", "1"]);
  });

  it("lists cited sources at the end, with contested notes visible", () => {
    const { chapter } = renderChapter(`${front}Two[@shaky].\n`, "c.md");
    expect(chapter?.html).toMatch(
      /<section class="sources"[\s\S]*id="src-shaky"/,
    );
    expect(chapter?.html).toContain(
      "<strong>Contested:</strong> Historians disagree.",
    );
    expect(chapter?.html).toContain('href="#/chapter/0/s/src-shaky"');
  });

  it("reports an unknown source", () => {
    const { errors } = renderChapter(`${front}Hm[@nope].\n`, "c.md");
    expect(errors).toEqual([
      "c.md:6: [@nope] → no entry `nope` in sources.yaml",
    ]);
  });
});

describe("chapter structure", () => {
  it("builds a table of contents from h2 headings", () => {
    const { chapter } = renderChapter(
      `${front}## What is a computer?\n\n## Sand\n`,
      "c.md",
    );
    expect(chapter?.toc).toEqual([
      { id: "what-is-a-computer", text: "What is a computer?" },
      { id: "sand", text: "Sand" },
    ]);
    expect(chapter?.html).toContain('<h2 id="sand">');
  });

  it("allows registered components and rejects unknown ones", () => {
    const ok = renderChapter(`${front}<mosfet-demo></mosfet-demo>\n`, "c.md");
    expect(ok.errors).toEqual([]);
    const bad = renderChapter(`${front}\n<warp-drive></warp-drive>\n`, "c.md");
    expect(bad.errors[0]).toMatch(
      /^c\.md:7: <warp-drive> is not a registered component/,
    );
  });

  it("requires frontmatter", () => {
    expect(renderChapter("# Hi\n", "c.md").errors).toEqual([
      "c.md:1: frontmatter needs `number`, `title` and `summary`",
    ]);
  });
});

describe("data files", () => {
  it("rejects a source without an https url", () => {
    expect(() =>
      parseSources(
        "- id: x\n  claim: c\n  checked: t\n  sources: [{ title: T, url: http://x }]\n",
      ),
    ).toThrow(/needs a `title` and an https `url`/);
  });

  it("requires a note on estimates", () => {
    expect(() =>
      parseSources(
        "- id: x\n  claim: c\n  checked: t\n  sources: [{ estimate: true }]\n",
      ),
    ).toThrow(ContentError);
  });

  it("rejects duplicate ids and dangling see-also links", () => {
    expect(() =>
      parseGlossary(
        "- {id: a, term: A, short: s}\n- {id: a, term: B, short: s, see: [zz]}\n",
      ),
    ).toThrow(/duplicate id `a`[\s\S]*see: `zz`/);
  });

  it("slugifies headings and terms", () => {
    expect(slugify("p-n Junction!")).toBe("p-n-junction");
    expect(slugify("What is a computer?")).toBe("what-is-a-computer");
  });
});
