// Which hairline figure (from @lucasmarkes/hairline, or drawn for this
// course with the hairline-create skill) illustrates which page, and the
// markup that holds its place. Pure: the figures themselves are drawn by
// hairline.ts, loaded only when a page has one.
//
// Only where the figure's object is the page's idea. The home page shows
// what the course builds: a computer made by hand on a breadboard, chips
// you can lift out and a screen with a falling block (drawn for it:
// vendor/hairline/breadboard.js). Lockers, one opened by the pointer,
// are memory cells and an address; the call stack is the VM's; tiles
// settling into a tree is parsing. Building is wiring (a patch panel); the
// Machine runs on the computer you built (a laptop); the glossary is for
// looking words up (a loupe); a missing page is a question. A workshop gets
// its chapter's figure. Chapters with no figure yet wait for one drawn for
// them, not a near miss.

export type FigureName =
  | "breadboard"
  | "exploded"
  | "lockers"
  | "terminal"
  | "stack"
  | "settle"
  | "keyboard"
  | "phosphor"
  | "patch"
  | "laptop"
  | "loupe"
  | "query";

export type FigurePage =
  | "home"
  | "levels"
  | "machine"
  | "glossary"
  | "notFound"
  | "assembler"
  | "translator"
  | "compiler"
  | "os";

export const FIGURES: {
  pages: Record<FigurePage, FigureName>;
  chapters: Record<number, FigureName>;
} = {
  pages: {
    home: "breadboard",
    levels: "patch",
    machine: "laptop",
    glossary: "loupe",
    notFound: "query",
    assembler: "terminal",
    translator: "stack",
    compiler: "settle",
    os: "keyboard",
  },
  chapters: {
    3: "lockers",
    5: "terminal",
    6: "stack",
    7: "settle",
    8: "keyboard",
    9: "phosphor",
  },
};

/** A placeholder the figure is drawn into; `label` is its accessible name. */
export function figureSlot(
  name: FigureName,
  label: string,
  extra = "",
): string {
  const safe = label
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return `<div class="hl-figure${extra ? ` ${extra}` : ""}" data-figure="${name}" data-label="${safe}"></div>`;
}

/** The placeholder for a page's figure, with its label in `label`. */
export function pageFigure(
  page: FigurePage,
  label: (name: FigureName) => string,
  extra = "",
): string {
  const name = FIGURES.pages[page];
  return figureSlot(name, label(name), extra);
}
