// The site's languages. `t(key)` gives the text for the current language;
// the Mongolian and Japanese dictionaries are typed against the English
// keys, so a missing translation is a type error. Chapter and level content have their own
// translated files (see web/content).
import { en, type Messages, type Vars } from "./en";
import { ja } from "./ja";
import { mn } from "./mn";

export type Lang = "en" | "mn" | "ja";
export const LANGS: Lang[] = ["en", "mn", "ja"];
const STORE = "s2t-lang";

const DICTS: Record<Lang, Messages> = { en, mn, ja };

/** The learner's saved choice wins; otherwise the browser's languages. */
export function detectLang(
  saved: string | null,
  browser: readonly string[],
): Lang {
  if (LANGS.includes(saved as Lang)) return saved as Lang;
  // The first of the browser's languages that the site has.
  for (const l of browser) {
    const code = l.toLowerCase().slice(0, 2);
    if (LANGS.includes(code as Lang)) return code as Lang;
  }
  return "en";
}

function initial(): Lang {
  let saved: string | null = null;
  try {
    saved = globalThis.localStorage?.getItem(STORE) ?? null;
  } catch {
    saved = null;
  }
  const browser =
    typeof navigator === "undefined"
      ? []
      : (navigator.languages ?? [navigator.language]);
  return detectLang(saved, browser);
}

let current: Lang = initial();

export function getLang(): Lang {
  return current;
}

/** Switches language, remembers it, and tells the page to re-render. */
export function setLang(lang: Lang): void {
  current = lang;
  try {
    globalThis.localStorage?.setItem(STORE, lang);
  } catch {
    // Private mode: the choice lasts for this visit.
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.dispatchEvent(new CustomEvent("s2t-lang"));
  }
}

/** Replaces `{name}` with vars.name. */
export function format(text: string, vars: Vars = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}

export type Key = keyof typeof en;

/** The text for `key` in the current language. */
export function t(key: Key, vars: Vars = {}): string {
  const msg = DICTS[current][key] ?? en[key];
  return typeof msg === "function" ? msg(vars) : format(msg, vars);
}
