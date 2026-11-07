// Which hairline figure (from @lucasmarkes/hairline) illustrates which
// page, and the markup that holds its place. Pure: the figures themselves
// are drawn by hairline.ts, loaded only when a page has one.
//
// Only where the figure's object is the chapter's idea: the home page's
// app in layers is the course's stack of layers; lockers, one opened by
// the pointer, are memory cells and an address; the call stack is the
// VM's; tiles settling into a tree is parsing. Chapters with no figure yet
// wait for one drawn for them (the hairline-create skill), not a near miss.

export type FigureName =
  | "exploded"
  | "lockers"
  | "terminal"
  | "stack"
  | "settle"
  | "keyboard"
  | "phosphor";

export const FIGURES: {
  home: FigureName;
  chapters: Record<number, FigureName>;
} = {
  home: "exploded",
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
export function figureSlot(name: FigureName, label: string): string {
  const safe = label
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
  return `<div class="hl-figure" data-figure="${name}" data-label="${safe}"></div>`;
}
