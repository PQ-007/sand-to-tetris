/*! @license Figures: @lucasmarkes/hairline (https://hairline.lucasmarkes.com),
 * MIT License, Copyright (c) 2026 Lucas Marques. */
// Draws the hairline figures a page asked for (see figures.ts) and stops
// them on the next navigation. Loaded lazily: only pages with a figure pay
// for it, and only the figures named here are bundled.
import {
  exploded,
  keyboard,
  lockers,
  phosphor,
  settle,
  stack,
  terminal,
  type Figure,
} from "@lucasmarkes/hairline";
import type { FigureName } from "./figures";

const DRAW: Record<
  FigureName,
  (el: HTMLElement, o: { label?: string }) => Figure
> = { exploded, keyboard, lockers, phosphor, settle, stack, terminal };

let mounted: Figure[] = [];

/** Stops the figures of the previous page. */
export function unmountFigures(): void {
  for (const f of mounted) f.destroy();
  mounted = [];
}

/** Draws every `.hl-figure` placeholder under `root`. */
export function mountFigures(root: HTMLElement): void {
  unmountFigures();
  root.querySelectorAll<HTMLElement>(".hl-figure").forEach((el) => {
    const draw = DRAW[el.dataset.figure as FigureName];
    if (draw) mounted.push(draw(el, { label: el.dataset.label }));
  });
}
