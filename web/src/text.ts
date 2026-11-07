// Content and level text in the learner's language.
import { content, levelText } from "virtual:s2t-content";
import { getLang } from "./i18n";
import type { Level } from "./sim/types";

/** Chapters and glossary in the current language. */
export function site() {
  return content[getLang()];
}

/** The level texts of the current language (none for English: the
 * originals are in the level files). */
const tr = () => {
  const lang = getLang();
  return lang === "en" ? undefined : levelText[lang];
};

export function levelName(level: Pick<Level, "id" | "name">): string {
  return tr()?.[level.id]?.name || level.name;
}

export function levelGoal(level: Pick<Level, "id" | "goal">): string {
  return tr()?.[level.id]?.goal || level.goal.trim();
}

/** The level's hint for a kind of failure, in the current language. */
export function levelHint(
  level: Pick<Level, "id">,
  kind: string,
  english: string | null,
): string | null {
  return tr()?.[level.id]?.hints[kind] ?? english;
}
