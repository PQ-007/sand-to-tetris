// Which hairline figure (from @lucasmarkes/hairline, or drawn for this
// course with the hairline-create skill) illustrates which page, and the
// markup that holds its place. Pure: the figures themselves are drawn by
// hairline.ts, loaded only when a page has one.
//
// Only where the figure's object is the page's idea. The home page shows
// the site's name as one object: an hourglass whose sand settles as falling
// blocks, which a button lets run and turns over (drawn for it:
// vendor/hairline/hourglass.js). Lockers, one opened by the pointer,
// are memory cells and an address; the call stack is the VM's; tiles
// settling into a tree is parsing. Building is wiring (a patch panel); the
// Programs are what glows on the screen (phosphor); the Machine page keeps
// its room for the screen itself; the glossary is for
// looking words up (a loupe); a missing page is a question. A workshop gets
// its chapter's figure. Chapters the package has no figure for got one
// drawn for them: a wafer ruled into dies (sand to silicon), a transistor
// cut away, its channel forming (switches), a ripple-carry adder (logic),
// and a CPU with its die bare, the blocks of Chapter 4 on it.

export type FigureName =
  | "hourglass"
  | "computer"
  | "wafer"
  | "transistor"
  | "carry"
  | "cpu"
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
  | "query"
  | "plug"
  | "cabinet"
  | "slow"
  | "riffle";

export type FigurePage =
  | "home"
  | "levels"
  | "programs"
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
    home: "hourglass",
    levels: "patch",
    programs: "phosphor",
    glossary: "loupe",
    notFound: "query",
    assembler: "terminal",
    translator: "stack",
    compiler: "settle",
    os: "keyboard",
  },
  chapters: {
    0: "wafer",
    1: "transistor",
    2: "carry",
    3: "lockers",
    4: "cpu",
    5: "terminal",
    6: "stack",
    7: "settle",
    8: "keyboard",
  },
};

/** A placeholder the figure is drawn into; `label` is its accessible name. */
export function figureSlot(
  name: FigureName,
  label: string,
  extra = "",
  value?: number,
): string {
  const safe = label
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  const start = value === undefined ? "" : ` data-value="${value}"`;
  return `<div class="hl-figure${extra ? ` ${extra}` : ""}" data-figure="${name}" data-label="${safe}"${start}></div>`;
}

/** The placeholder for a page's figure, with its label in `label`. */
export function pageFigure(
  page: FigurePage,
  label: (name: FigureName) => string,
  extra = "",
  value?: number,
): string {
  const name = FIGURES.pages[page];
  return figureSlot(name, label(name), extra, value);
}
