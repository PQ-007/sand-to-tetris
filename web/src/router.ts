// Hash-based routes, so the static site works on any host (GitHub Pages
// has no server-side rewrites). Sections inside a page use /s/<anchor>.
export type Route =
  | { page: "home" }
  | { page: "chapter"; number: number; anchor?: string }
  | { page: "glossary"; term?: string }
  | { page: "levels" }
  | { page: "play"; level: string }
  | { page: "machine" }
  | { page: "assembler" }
  | { page: "not-found"; hash: string };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "");
  if (path === "" || path === "/") return { page: "home" };
  const chapter = /^\/chapter\/(\d+)(?:\/s\/([\w-]+))?\/?$/.exec(path);
  if (chapter) {
    const anchor = chapter[2];
    return {
      page: "chapter",
      number: Number(chapter[1]),
      ...(anchor ? { anchor } : {}),
    };
  }
  const glossary = /^\/glossary(?:\/([\w-]+))?\/?$/.exec(path);
  if (glossary) {
    const term = glossary[1];
    return { page: "glossary", ...(term ? { term } : {}) };
  }
  if (/^\/levels\/?$/.test(path)) return { page: "levels" };
  if (/^\/machine\/?$/.test(path)) return { page: "machine" };
  if (/^\/assembler\/?$/.test(path)) return { page: "assembler" };
  const play = /^\/play\/([\w-]+)\/?$/.exec(path);
  if (play?.[1]) return { page: "play", level: play[1] };
  return { page: "not-found", hash };
}

export function chapterHref(number: number, anchor?: string): string {
  return `#/chapter/${number}${anchor ? `/s/${anchor}` : ""}`;
}

export function playHref(level: string): string {
  return `#/play/${level}`;
}
