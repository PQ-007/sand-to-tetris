// The glossary page's logic, pure and tested: each term in the other
// languages, letter groups, and what the filter matches.
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

/**
 * The letter a term is filed under: its first letter in capitals, for
 * alphabets (Latin, Cyrillic); `#` for a digit or symbol; `null` for a
 * script without an alphabet order (Japanese kana and kanji).
 */
export function initialOf(term: string): string | null {
  const first = [...fold(term)][0];
  if (first === undefined) return "#";
  if (/[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(first))
    return first.toUpperCase();
  if (/\p{L}/u.test(first)) return null;
  return "#";
}

export interface LetterGroup<T> {
  /** `null`: one list without letters. */
  letter: string | null;
  items: T[];
}

/**
 * Groups items (already sorted) by their term's letter, in order of first
 * appearance. If any term has no letter, the page is one plain list: half a
 * letter index would hide the rest.
 */
export function groupByLetter<T extends { term: string }>(
  items: readonly T[],
): LetterGroup<T>[] {
  const letters = items.map((i) => initialOf(i.term));
  if (letters.some((l) => l === null))
    return items.length ? [{ letter: null, items: [...items] }] : [];
  const groups = new Map<string, T[]>();
  items.forEach((item, i) => {
    const l = letters[i] ?? "#";
    const g = groups.get(l) ?? [];
    g.push(item);
    groups.set(l, g);
  });
  return [...groups].map(([letter, items]) => ({ letter, items }));
}
