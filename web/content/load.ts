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
  /** How a Japanese term is read, in kana (sorts and groups it). */
  reading?: string;
  /** Still the English term (a staged translation without this entry). */
  untranslated?: boolean;
}

export interface LevelFile {
  id: string;
  layer: number;
  /** The raw level.toml; parsed in the browser by the WASM core. */
  toml: string;
}

/** A page of the Programs section (docs/programs/NN-id.md). */
export type RenderedProgram = RenderedChapter & {
  id: string;
  untranslated?: boolean;
};

export interface SiteContent {
  /** `untranslated`: shown in English while this language's text is missing
   * (only for a language still being translated). */
  chapters: (RenderedChapter & { untranslated?: boolean })[];
  programs: RenderedProgram[];
  glossary: GlossaryItem[];
}

/** A program page's id: its file name without the number, `02-wyrm.md` →
 * `wyrm`. */
export const programId = (file: string) =>
  file.replace(/^\d+-/, "").replace(/\.md$/, "");

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

export type Lang = "en" | "mn" | "ja";

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
  ja: {
    sources: "出典",
    contested: "異説あり:",
    checked: "確認方法:",
    estimate: "概算:",
  },
};

/**
 * Translations of the original. A complete one (Mongolian, and Japanese
 * since 2026-11-08) must translate every chapter, program page, glossary
 * entry and source, or the build fails. A staged one (a language still
 * being translated) falls back to the English original for what's missing,
 * and that chapter is marked `untranslated`; whatever it does translate is
 * checked just as strictly.
 */
const TRANSLATIONS: { lang: Exclude<Lang, "en">; complete: boolean }[] = [
  { lang: "mn", complete: true },
  { lang: "ja", complete: true },
];

/** The demo tags a chapter uses, in order (a figure with its name). */
const tagsOf = (src: string) =>
  [...src.matchAll(/^<([a-z0-9]+-[a-z0-9-]+)(?:\s+name="([^"]+)")?>/gm)].map(
    (m) => (m[2] ? `${m[1]}:${m[2]}` : m[1]),
  );
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
  const programDir = join(docsDir, "programs");
  const programNames = existsSync(programDir)
    ? readdirSync(programDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
    : [];
  const programOriginals = new Map(
    programNames.map((n) => [n, read(join(programDir, n))] as const),
  );
  const en = renderLanguage(
    "en",
    glossary,
    sources,
    originals,
    programOriginals,
    "docs",
    errors,
  );

  const ids = new Map(
    en.chapters.map((c, i) => [names[i] ?? "", c.headingIds] as const),
  );
  const programIds = new Map(
    en.programs.map((c) => [`${c.id}`, c.headingIds] as const),
  );
  const content = { en } as Record<Lang, SiteContent>;
  for (const { lang, complete } of TRANSLATIONS) {
    const dir = join(docsDir, lang);
    const at = `docs/${lang}`;
    // A staged translation may not have a file at all yet.
    const optional = (file: string) =>
      !complete && !existsSync(join(dir, file));
    const trGlossary = optional("glossary.yaml")
      ? []
      : safely(
          `${lang}/glossary.yaml`,
          () =>
            parseGlossary(
              read(join(dir, "glossary.yaml")),
              `${at}/glossary.yaml`,
            ),
          [],
        );
    const terms = new Map(trGlossary.map((g) => [g.id, g]));
    for (const g of glossary)
      if (complete && !terms.has(g.id))
        errors.push(`${at}/glossary.yaml: no translation of \`${g.id}\``);
    for (const g of trGlossary)
      if (!glossary.some((o) => o.id === g.id))
        errors.push(
          `${at}/glossary.yaml: \`${g.id}\` isn't in docs/glossary.yaml`,
        );
    const glossaryTr = glossary.map((g) => {
      const tr = terms.get(g.id);
      return tr
        ? {
            ...g,
            term: tr.term,
            short: tr.short,
            long: tr.long,
            reading: tr.reading,
          }
        : { ...g, untranslated: true };
    });
    const trSources = optional("sources.yaml")
      ? []
      : safely(
          `${lang}/sources.yaml`,
          () =>
            parseSourceTexts(
              read(join(dir, "sources.yaml")),
              `${at}/sources.yaml`,
            ),
          [],
        );
    const claims = new Map(trSources.map((x) => [x.id, x]));
    const sourcesTr = sources.map((src) => {
      const tr = claims.get(src.id);
      if (!tr) {
        if (complete)
          errors.push(`${at}/sources.yaml: no translation of \`${src.id}\``);
        return src;
      }
      if (Boolean(src.uncertain) !== Boolean(tr.uncertain))
        errors.push(
          `${at}/sources.yaml: \`${src.id}\` must say why it's contested exactly when the original does`,
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
    const fallback = new Set<string>();
    for (const n of names) {
      const path = join(dir, "chapters", n);
      if (!existsSync(path)) {
        if (complete)
          errors.push(
            `${at}/chapters/${n}: missing (translate docs/chapters/${n})`,
          );
        else {
          translations.set(n, originals.get(n) ?? "");
          fallback.add(n);
        }
        continue;
      }
      const src = read(path);
      const orig = originals.get(n) ?? "";
      if (tagsOf(src).join() !== tagsOf(orig).join())
        errors.push(
          `${at}/chapters/${n}: uses demos ${tagsOf(src).join(", ") || "none"}, the original ${tagsOf(orig).join(", ") || "none"}`,
        );
      if (citesOf(src).join() !== citesOf(orig).join())
        errors.push(
          `${at}/chapters/${n}: cites ${citesOf(src).join(", ") || "nothing"}, the original ${citesOf(orig).join(", ") || "nothing"}`,
        );
      translations.set(n, src);
    }
    // The Programs pages: the same rules as chapters.
    const programTr = new Map<string, string>();
    const programFallback = new Set<string>();
    for (const n of programNames) {
      const path = join(dir, "programs", n);
      if (!existsSync(path)) {
        if (complete)
          errors.push(
            `${at}/programs/${n}: missing (translate docs/programs/${n})`,
          );
        else {
          programTr.set(n, programOriginals.get(n) ?? "");
          programFallback.add(programId(n));
        }
        continue;
      }
      const src = read(path);
      const orig = programOriginals.get(n) ?? "";
      if (tagsOf(src).join() !== tagsOf(orig).join())
        errors.push(
          `${at}/programs/${n}: uses demos ${tagsOf(src).join(", ") || "none"}, the original ${tagsOf(orig).join(", ") || "none"}`,
        );
      if (citesOf(src).join() !== citesOf(orig).join())
        errors.push(
          `${at}/programs/${n}: cites ${citesOf(src).join(", ") || "nothing"}, the original ${citesOf(orig).join(", ") || "nothing"}`,
        );
      programTr.set(n, src);
    }
    const rendered = renderLanguage(
      lang,
      glossaryTr,
      sourcesTr,
      translations,
      programTr,
      at,
      errors,
      ids,
      programIds,
    );
    rendered.programs = rendered.programs.map((p) =>
      programFallback.has(p.id) ? { ...p, untranslated: true } : p,
    );
    // Chapters still in English say so (by number: names line up 1:1).
    const untranslated = new Set(
      names
        .map((n, i) => (fallback.has(n) ? en.chapters[i]?.number : undefined))
        .filter((x) => x !== undefined),
    );
    rendered.chapters = rendered.chapters.map((c) =>
      untranslated.has(c.number) ? { ...c, untranslated: true } : c,
    );
    for (const c of rendered.chapters) {
      if (!en.chapters.some((o) => o.number === c.number))
        errors.push(`${at}/chapters: chapter ${c.number} has no original`);
    }
    content[lang] = rendered;
  }
  return { content, files, errors };
}

/** Renders one language's chapters and glossary. */
function renderLanguage(
  lang: Lang,
  glossary: GlossaryEntry[],
  sources: SourceEntry[],
  chapterSources: Map<string, string>,
  programSources: Map<string, string>,
  dir: string,
  errors: string[],
  ids?: Map<string, string[]>,
  programIds?: Map<string, string[]>,
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
  const programs: RenderedProgram[] = [];
  for (const [name, src] of programSources) {
    const id = programId(name);
    const result = renderChapter(src, `${dir}/programs/${name}`, {
      ids: programIds?.get(id),
      routeBase: `#/programs/${id}`,
    });
    errors.push(...result.errors);
    if (result.chapter) programs.push({ ...result.chapter, id });
  }
  programs.sort((a, b) => a.number - b.number);
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
      ...(g.reading ? { reading: g.reading } : {}),
      ...(g.untranslated ? { untranslated: true } : {}),
    };
  });
  // Sorted by the term as shown in this language (Japanese by its reading,
  // so kanji terms fall in あいうえお order).
  items.sort((a, b) =>
    (a.reading ?? a.term).localeCompare(b.reading ?? b.term, lang),
  );
  return { chapters, programs, glossary: items };
}
