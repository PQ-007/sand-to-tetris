/*! @license Figures: @lucasmarkes/hairline (https://hairline.lucasmarkes.com)
 * and its kernel, MIT License, Copyright (c) 2026 Lucas Marques. */
// Draws the hairline figures pages ask for (see figures.ts): the package's
// own, and figures drawn for this course with the hairline-create skill
// (vendor/hairline), hosted here the way the skill's bench page hosts them.
// Loaded lazily: only pages with a figure pay for it.
import {
  cabinet,
  exploded,
  keyboard,
  laptop,
  lockers,
  loupe,
  patch,
  phosphor,
  plug,
  query,
  riffle,
  settle,
  slow,
  stack,
  terminal,
  type Figure,
} from "@lucasmarkes/hairline";
import { HL } from "./vendor/hairline/kernel.js";
import type { FigureName } from "./figures";

/** A figure in the skill's format: what `hairline({...})` is called with. */
interface CustomFigure {
  name: string;
  range: [number, number, number];
  mount(
    host: {
      stage: HTMLElement;
      svg: SVGElement;
      read: { textContent: string };
    },
    value: number,
  ): { set(value: number): void; destroy(): void };
}

// The skill's figures read a global HL and register through a global
// hairline(); give them both, then load them.
const custom = new Map<string, CustomFigure>();
Object.assign(globalThis, {
  HL,
  hairline: (f: CustomFigure) => custom.set(f.name, f),
});
await Promise.all([
  import("./vendor/hairline/computer.js"),
  import("./vendor/hairline/wafer.js"),
  import("./vendor/hairline/transistor.js"),
  import("./vendor/hairline/carry.js"),
  import("./vendor/hairline/cpu.js"),
]);

/** What changes each custom figure's number (a button, not the slider). */
const setters = new WeakMap<HTMLElement, (value: number) => void>();

/** Sets a drawn custom figure's number: for the computer, how far apart. */
export function setFigureValue(el: HTMLElement, value: number): void {
  setters.get(el)?.(value);
}

/** Hosts a custom figure on `el`, as the package dresses its own. */
function host(name: string) {
  return (el: HTMLElement, o: { label?: string }): Figure => {
    const f = custom.get(name);
    if (!f) throw new Error(`no hairline figure "${name}"`);
    HL.inject(document);
    el.setAttribute("data-hairline", f.name);
    el.setAttribute("role", "img");
    if (o.label) el.setAttribute("aria-label", o.label);
    const svg = HL.mk(
      "svg",
      { viewBox: "0 0 400 320", "aria-hidden": "true" },
      el,
    );
    const live = document.createElement("span");
    live.setAttribute("data-hairline-live", "");
    live.setAttribute("aria-live", "polite");
    el.append(live);
    const read = {
      get textContent() {
        return live.textContent ?? "";
      },
      set textContent(v: string) {
        live.textContent = v;
      },
    };
    // A page may start a figure at its own number (data-value), else the
    // figure's default; setFigureValue changes it later.
    const start = Number(el.dataset.value ?? f.range[1]);
    const handle = f.mount({ stage: el, svg, read }, start);
    setters.set(el, (v) => handle.set(v));
    return {
      update: () => {},
      destroy: () => {
        handle.destroy();
        svg.remove();
        live.remove();
        for (const a of ["data-hairline", "role", "aria-label"])
          el.removeAttribute(a);
      },
    };
  };
}

const DRAW: Record<
  FigureName,
  (el: HTMLElement, o: { label?: string }) => Figure
> = {
  cabinet,
  exploded,
  keyboard,
  laptop,
  lockers,
  loupe,
  patch,
  phosphor,
  plug,
  query,
  riffle,
  slow,
  computer: host("computer"),
  wafer: host("wafer"),
  transistor: host("transistor"),
  carry: host("carry"),
  cpu: host("cpu"),
  settle,
  stack,
  terminal,
};

const mounted = new Map<HTMLElement, Figure>();

/**
 * Draws every `.hl-figure` placeholder under `root` not drawn yet, and stops
 * figures whose element has left the page. Safe to call as often as the
 * page changes.
 */
export function syncFigures(root: HTMLElement): void {
  for (const [el, f] of mounted)
    if (!el.isConnected) {
      f.destroy();
      mounted.delete(el);
    }
  root.querySelectorAll<HTMLElement>(".hl-figure").forEach((el) => {
    if (mounted.has(el)) return;
    const draw = DRAW[el.dataset.figure as FigureName];
    if (draw) mounted.set(el, draw(el, { label: el.dataset.label }));
  });
}
