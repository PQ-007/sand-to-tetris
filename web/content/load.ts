// Reads docs/ and renders everything the site needs. Used by the Vite
// plugin (build + dev) and by tests that check the real content.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { KNOWN_TAGS } from "../src/components/known-tags";
import { ContentError, parseGlossary, parseSources } from "./data";
import { createRenderer, type RenderedChapter } from "./markdown";

export interface GlossaryItem {
  id: string;
  term: string;
  short: string;
  shortHtml: string;
  longHtml?: string;
  see: string[];
}

export interface LevelFile {
  id: string;
  layer: number;
  /** The raw level.toml; parsed in the browser by the WASM core. */
  toml: string;
}

export interface SiteContent {
  chapters: RenderedChapter[];
  glossary: GlossaryItem[];
}

/**
 * Reads hdl/levels/layerN/<id>/level.toml. Only level definitions are read:
 * reference solutions in the same folders must never reach the website.
 */
export function loadLevels(levelsDir: string): LevelFile[] {
  const out: LevelFile[] = [];
  for (const layer of readdirSync(levelsDir).sort()) {
    const m = /^layer(\d+)$/.exec(layer);
    if (!m) continue;
    for (const id of readdirSync(join(levelsDir, layer)).sort()) {
      const file = join(levelsDir, layer, id, "level.toml");
      if (!existsSync(file)) continue;
      out.push({ id, layer: Number(m[1]), toml: readFileSync(file, "utf8") });
    }
  }
  return out;
}

export interface LoadResult {
  content: SiteContent;
  files: string[];
  errors: string[];
}

export function loadContent(docsDir: string): LoadResult {
  const errors: string[] = [];
  const files: string[] = [];
  const read = (path: string): string => {
    files.push(path);
    return readFileSync(path, "utf8");
  };
  const safely = <T>(file: string, fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (e) {
      errors.push(
        e instanceof ContentError ? e.message : `docs/${file}: ${String(e)}`,
      );
      return fallback;
    }
  };

  const glossary = safely(
    "glossary.yaml",
    () =>
      parseGlossary(read(join(docsDir, "glossary.yaml")), "docs/glossary.yaml"),
    [],
  );
  const sources = safely(
    "sources.yaml",
    () =>
      parseSources(read(join(docsDir, "sources.yaml")), "docs/sources.yaml"),
    [],
  );
  const { renderChapter, renderInline } = createRenderer({
    glossary,
    sources,
    knownTags: KNOWN_TAGS,
  });

  const chapterDir = join(docsDir, "chapters");
  const chapters: RenderedChapter[] = [];
  for (const name of readdirSync(chapterDir)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const result = renderChapter(
      read(join(chapterDir, name)),
      `docs/chapters/${name}`,
    );
    errors.push(...result.errors);
    if (result.chapter) chapters.push(result.chapter);
  }
  const numbers = chapters.map((c) => c.number);
  if (new Set(numbers).size !== numbers.length) {
    errors.push(
      `docs/chapters: duplicate chapter numbers (${numbers.join(", ")})`,
    );
  }
  chapters.sort((a, b) => a.number - b.number);

  const items: GlossaryItem[] = glossary.map((g) => {
    const short = renderInline(g.short, `docs/glossary.yaml (${g.id}.short)`);
    const long = g.long
      ? renderInline(g.long, `docs/glossary.yaml (${g.id}.long)`)
      : undefined;
    errors.push(...short.errors, ...(long?.errors ?? []));
    return {
      id: g.id,
      term: g.term,
      short: g.short.replace(
        /\[\[(?:([^|\]]*)\|)?([^\]]*)\]\]/g,
        (_, shown, id) => shown ?? id,
      ),
      shortHtml: short.html,
      longHtml: long?.html,
      see: g.see ?? [],
    };
  });

  return { content: { chapters, glossary: items }, files, errors };
}
