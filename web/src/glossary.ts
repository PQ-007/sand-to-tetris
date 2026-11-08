// The glossary page's logic, pure and tested: each term in the other
// languages, chapter groups, and what the filter matches.
import type { GlossaryItem, Lang } from "../content/load";

/** Each language's name in that language (how a speaker looks for it). */
export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  mn: "Монгол",
  ja: "日本語",
};

export interface OtherTerm {
  lang: Lang;
  term: string;
}

/** Glossary id → its term in every language that really has one. */
export type TermIndex = Map<string, Partial<Record<Lang, string>>>;

export function termIndex(
  content: Partial<Record<Lang, { glossary: GlossaryItem[] }>>,
): TermIndex {
  const index: TermIndex = new Map();
  for (const [lang, site] of Object.entries(content) as [
    Lang,
    { glossary: GlossaryItem[] },
  ][]) {
    for (const g of site.glossary) {
      // A staged translation's fallback is just the English term again.
      if (g.untranslated) continue;
      const terms = index.get(g.id) ?? {};
      terms[lang] = g.term;
      index.set(g.id, terms);
    }
  }
  return index;
}

/**
 * The term in the other languages: English (the original) first, then the
 * rest in `order`. A language without its own translation is left out, and
 * so is a spelling already shown (Mongolian keeps many English terms in
 * Latin letters, e.g. "Latch").
 */
export function otherTerms(
  index: TermIndex,
  id: string,
  lang: Lang,
  shown: string,
  order: readonly Lang[],
): OtherTerm[] {
  const terms = index.get(id) ?? {};
  const seen = new Set([fold(shown)]);
  const langs = ["en" as Lang, ...order.filter((l) => l !== "en")];
  const out: OtherTerm[] = [];
  for (const l of langs) {
    const term = terms[l];
    if (l === lang || term === undefined || seen.has(fold(term))) continue;
    seen.add(fold(term));
    out.push({ lang: l, term });
  }
  return out;
}

/** Lower case, accents dropped: what the filter compares. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The text a filter is matched against: the term in every language and
 * its id, so a learner can type a word in any of them. */
export function searchKey(id: string, terms: readonly string[]): string {
  return [id.replace(/-/g, " "), ...terms].map(fold).join("\n");
}

/** Whether a typed filter matches an entry's `searchKey`. */
export function matches(key: string, query: string): boolean {
  const q = fold(query);
  return q === "" || key.includes(q);
}

/** Where a group of terms comes from: a chapter, the Programs pages, or
 * nowhere yet. */
export type Section =
  | { kind: "chapter"; number: number }
  | { kind: "programs" }
  | { kind: "other" };

export interface SectionGroup<T> {
  section: Section;
  items: T[];
}

/** The glossary ids a rendered page links, in reading order. */
export function linkedTerms(html: string): string[] {
  return [...html.matchAll(/data-term="([^"]+)"/g)].map((m) => m[1] ?? "");
}

/**
 * Groups terms the way the course meets them: each under the chapter that
 * first links it, in the order a reader comes to them; then those only the
 * Programs pages link; then any no page links (none today, a test checks).
 */
export function groupByChapter<T extends { id: string }>(
  items: readonly T[],
  chapters: readonly { number: number; html: string }[],
  programs: readonly { html: string }[],
): SectionGroup<T>[] {
  const pages: { section: Section; html: string }[] = [
    ...[...chapters]
      .sort((a, b) => a.number - b.number)
      .map((c) => ({
        section: { kind: "chapter", number: c.number } as Section,
        html: c.html,
      })),
    {
      section: { kind: "programs" },
      html: programs.map((p) => p.html).join(""),
    },
  ];
  // id → [page, position on it] of its first link.
  const first = new Map<string, [number, number]>();
  pages.forEach((page, i) =>
    linkedTerms(page.html).forEach((id, at) => {
      if (!first.has(id)) first.set(id, [i, at]);
    }),
  );
  const groups = pages.map((p) => ({ section: p.section, items: [] as T[] }));
  const other: T[] = [];
  for (const item of items) {
    const where = first.get(item.id);
    if (where) groups[where[0]]?.items.push(item);
    else other.push(item);
  }
  for (const g of groups)
    g.items.sort(
      (a, b) => (first.get(a.id)?.[1] ?? 0) - (first.get(b.id)?.[1] ?? 0),
    );
  if (other.length) groups.push({ section: { kind: "other" }, items: other });
  return groups.filter((g) => g.items.length > 0);
}
