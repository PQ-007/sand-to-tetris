// Reads docs/ and renders everything the site needs. Used by the Vite
// plugin (build + dev) and by tests that check the real content.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { KNOWN_TAGS } from "../src/components/known-tags";
import { parse } from "yaml";
import {
  ContentError,
  parseGlossary,
  parseSourceTexts,
  parseSources,
  type GlossaryEntry,
  type SourceEntry,
} from "./data";
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

export type Lang = "en" | "mn";

export interface LoadResult {
  content: Record<Lang, SiteContent>;
  files: string[];
  errors: string[];
}

/** Translated texts of a level (hdl/levels/mn.yaml). */
export interface LevelText {
  name: string;
  goal: string;
  hints: Record<string, string>;
}

/**
 * Reads the translation of every level's name, goal and hints. Not a
 * reference solution: only text the learner sees on the level page.
 */
export function loadLevelText(file: string): Record<string, LevelText> {
  if (!existsSync(file)) return {};
  const data: unknown = parse(readFileSync(file, "utf8"));
  if (typeof data !== "object" || data === null) return {};
  const out: Record<string, LevelText> = {};
  for (const [id, raw] of Object.entries(data as Record<string, unknown>)) {
    const r = (raw ?? {}) as Record<string, unknown>;
    out[id] = {
      name: String(r.name ?? "").trim(),
      goal: String(r.goal ?? "").trim(),
      hints: Object.fromEntries(
        Object.entries((r.hints ?? {}) as Record<string, unknown>).map(
          ([k, v]) => [k, String(v).trim()],
        ),
      ),
    };
  }
  return out;
}

const LABELS: Record<
  Lang,
  { sources: string; contested: string; checked: string; estimate: string }
> = {
  en: {
    sources: "Sources",
    contested: "Contested:",
    checked: "Checked:",
    estimate: "Estimate:",
  },
  mn: {
    sources: "Эх сурвалж",
    contested: "Маргаантай:",
    checked: "Шалгасан:",
    estimate: "Ойролцоо тооцоо:",
  },
};

/** The demo tags a chapter uses, in order. */
const tagsOf = (src: string) =>
  [...src.matchAll(/^<([a-z0-9]+-[a-z0-9-]+)>/gm)].map((m) => m[1]);
/** Source ids a chapter cites. */
const citesOf = (src: string) =>
  [...new Set([...src.matchAll(/\[@([a-z0-9-]+)\]/g)].map((m) => m[1]))].sort();

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

  // ---- English: the original ----
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
  const chapterDir = join(docsDir, "chapters");
  const names = readdirSync(chapterDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const originals = new Map(
    names.map((n) => [n, read(join(chapterDir, n))] as const),
  );
  const en = renderLanguage("en", glossary, sources, originals, "docs", errors);

  // ---- Mongolian: every text translated, lined up with the original ----
  const mnDir = join(docsDir, "mn");
  const mnGlossary = safely(
    "mn/glossary.yaml",
    () =>
      parseGlossary(
        read(join(mnDir, "glossary.yaml")),
        "docs/mn/glossary.yaml",
      ),
    [],
  );
  const mnTerms = new Map(mnGlossary.map((g) => [g.id, g]));
  for (const g of glossary)
    if (!mnTerms.has(g.id))
      errors.push(`docs/mn/glossary.yaml: no translation of \`${g.id}\``);
  for (const g of mnGlossary)
    if (!glossary.some((o) => o.id === g.id))
      errors.push(
        `docs/mn/glossary.yaml: \`${g.id}\` isn't in docs/glossary.yaml`,
      );
  const glossaryMn = glossary.map((g) => {
    const tr = mnTerms.get(g.id);
    return tr ? { ...g, term: tr.term, short: tr.short, long: tr.long } : g;
  });
  const mnSources = safely(
    "mn/sources.yaml",
    () =>
      parseSourceTexts(
        read(join(mnDir, "sources.yaml")),
        "docs/mn/sources.yaml",
      ),
    [],
  );
  const mnClaims = new Map(mnSources.map((x) => [x.id, x]));
  const sourcesMn = sources.map((src) => {
    const tr = mnClaims.get(src.id);
    if (!tr) {
      errors.push(`docs/mn/sources.yaml: no translation of \`${src.id}\``);
      return src;
    }
    if (Boolean(src.uncertain) !== Boolean(tr.uncertain))
      errors.push(
        `docs/mn/sources.yaml: \`${src.id}\` must say why it's contested exactly when the original does`,
      );
    return {
      ...src,
      claim: tr.claim,
      uncertain: tr.uncertain,
      checked: tr.checked ?? src.checked,
      sources: src.sources.map((r) =>
        r.estimate && tr.note ? { ...r, note: tr.note } : r,
      ),
    };
  });
  const translations = new Map<string, string>();
  for (const n of names) {
    const path = join(mnDir, "chapters", n);
    if (!existsSync(path)) {
      errors.push(
        `docs/mn/chapters/${n}: missing (translate docs/chapters/${n})`,
      );
      continue;
    }
    const src = read(path);
    const orig = originals.get(n) ?? "";
    if (tagsOf(src).join() !== tagsOf(orig).join())
      errors.push(
        `docs/mn/chapters/${n}: uses demos ${tagsOf(src).join(", ") || "none"}, the original ${tagsOf(orig).join(", ") || "none"}`,
      );
    if (citesOf(src).join() !== citesOf(orig).join())
      errors.push(
        `docs/mn/chapters/${n}: cites ${citesOf(src).join(", ") || "nothing"}, the original ${citesOf(orig).join(", ") || "nothing"}`,
      );
    translations.set(n, src);
  }
  const ids = new Map(
    en.chapters.map((c, i) => [names[i] ?? "", c.headingIds] as const),
  );
  const mn = renderLanguage(
    "mn",
    glossaryMn,
    sourcesMn,
    translations,
    "docs/mn",
    errors,
    ids,
  );
  for (const c of mn.chapters) {
    if (!en.chapters.some((o) => o.number === c.number))
      errors.push(`docs/mn/chapters: chapter ${c.number} has no original`);
  }
  return { content: { en, mn }, files, errors };
}

/** Renders one language's chapters and glossary. */
function renderLanguage(
  lang: Lang,
  glossary: GlossaryEntry[],
  sources: SourceEntry[],
  chapterSources: Map<string, string>,
  dir: string,
  errors: string[],
  ids?: Map<string, string[]>,
): SiteContent {
  const { renderChapter, renderInline } = createRenderer({
    glossary,
    sources,
    knownTags: KNOWN_TAGS,
    labels: LABELS[lang],
  });
  const chapters: RenderedChapter[] = [];
  for (const [name, src] of chapterSources) {
    const result = renderChapter(src, `${dir}/chapters/${name}`, {
      ids: ids?.get(name),
    });
    errors.push(...result.errors);
    if (result.chapter) chapters.push(result.chapter);
  }
  const numbers = chapters.map((c) => c.number);
  if (new Set(numbers).size !== numbers.length) {
    errors.push(
      `${dir}/chapters: duplicate chapter numbers (${numbers.join(", ")})`,
    );
  }
  chapters.sort((a, b) => a.number - b.number);
  const file = `${dir}/glossary.yaml`;
  const items: GlossaryItem[] = glossary.map((g) => {
    const short = renderInline(g.short, `${file} (${g.id}.short)`);
    const long = g.long
      ? renderInline(g.long, `${file} (${g.id}.long)`)
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
  // Sorted by the term as shown in this language.
  items.sort((a, b) => a.term.localeCompare(b.term, lang));
  return { chapters, glossary: items };
}
