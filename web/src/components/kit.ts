// Shared helpers for demo components (shadow DOM + constructable styles).
const NS = "http://www.w3.org/2000/svg";

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
  text?: string,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  parent?.append(el);
  return el;
}

export function reducedMotion(): boolean {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

export function sheet(css: string): CSSStyleSheet {
  const s = new CSSStyleSheet();
  s.replaceSync(css);
  return s;
}

/** Styles every demo shares. Colours come from site tokens on :root. */
export const BASE = sheet(`
  :host { display: block; margin: 1.5rem 0; color: var(--text); container-type: inline-size; }
  figure { margin: 0; padding: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; }
  figcaption { margin: 0 0 0.75rem; color: var(--muted); font-size: 0.9375rem; }
  figcaption strong { color: var(--text); display: block; font-size: 1rem; }
  svg { display: block; width: 100%; height: auto; font: 12px system-ui, sans-serif; }
  svg text { fill: var(--text); }
  .muted, svg .muted { color: var(--muted); fill: var(--muted); }
  .controls { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; align-items: center; margin: 0.75rem 0; }
  label { display: inline-flex; gap: 0.5rem; align-items: center; font-size: 0.9375rem; }
  input[type=range] { width: min(16rem, 60vw); accent-color: var(--accent); }
  button, select { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 0.375rem; padding: 0.3rem 0.7rem; cursor: pointer; }
  button[aria-pressed=true], .chip input:checked + span { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  :focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
  a { color: var(--accent); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.375rem; border: 0; padding: 0; margin: 0 0 0.75rem; }
  .chips legend { font-size: 0.875rem; color: var(--muted); margin-bottom: 0.375rem; }
  .chip { position: relative; }
  .chip input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
  .chip span { display: inline-block; padding: 0.25rem 0.7rem; border: 1px solid var(--border); border-radius: 999px; font-size: 0.875rem; }
  .chip input:focus-visible + span { outline: 3px solid var(--focus); outline-offset: 2px; }
  .readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.5rem; margin: 0.75rem 0 0; padding: 0; list-style: none; }
  .readout li { background: var(--bg); border-radius: 0.5rem; padding: 0.5rem 0.75rem; }
  .readout b { display: block; font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .readout output, .readout span { font-variant-numeric: tabular-nums; font-size: 1.0625rem; }
  .note { font-size: 0.9375rem; margin: 0.75rem 0 0; }
  /* Wide diagrams keep a readable minimum size on phones and pan sideways
     inside their frame instead (the page itself never scrolls sideways). */
  .wide { overflow-x: auto; }
  @container (max-width: 600px) { .wide > svg { min-width: 560px; } }
`);

export function formatLength(m: number): string {
  const units: [number, string][] = [
    [1e-2, "cm"],
    [1e-3, "mm"],
    [1e-6, "µm"],
    [1e-9, "nm"],
  ];
  const [s, u] = units.find(([s]) => m >= s) ?? [1e-9, "nm"];
  return `≈ ${+(m / s).toPrecision(2)} ${u}`;
}

export function formatTime(t: number): string {
  const units: [number, string][] = [
    [1, "s"],
    [1e-3, "ms"],
    [1e-6, "µs"],
    [1e-9, "ns"],
    [1e-12, "ps"],
  ];
  const [s, u] = units.find(([s]) => t >= s) ?? [1e-12, "ps"];
  return `≈ ${+(t / s).toPrecision(2)} ${u}`;
}

/** Builds a fieldset of radio "chips"; calls onChange with the chosen value. */
export function chips(
  legend: string,
  name: string,
  options: { value: string; label: string }[],
  selected: string,
  onChange: (value: string) => void,
): HTMLFieldSetElement {
  const fs = document.createElement("fieldset");
  fs.className = "chips";
  const lg = document.createElement("legend");
  lg.textContent = legend;
  fs.append(lg);
  for (const o of options) {
    const label = document.createElement("label");
    label.className = "chip";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = o.value;
    input.checked = o.value === selected;
    input.addEventListener("change", () => onChange(o.value));
    const span = document.createElement("span");
    span.textContent = o.label;
    label.append(input, span);
    fs.append(label);
  }
  return fs;
}

export function slider(
  text: string,
  opts: { min: number; max: number; step: number; value: number },
  onInput: (v: number) => void,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(opts.min);
  input.max = String(opts.max);
  input.step = String(opts.step);
  input.value = String(opts.value);
  input.addEventListener("input", () => onInput(Number(input.value)));
  label.append(text, input);
  return { label, input };
}

/** Wraps a wide diagram so it can pan on narrow screens. */
export function wide(el: SVGSVGElement): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "wide";
  div.tabIndex = 0;
  div.setAttribute("role", "group");
  div.setAttribute("aria-label", "Diagram (scroll sideways on small screens)");
  div.append(el);
  return div;
}

/** Base class: opens a shadow root with the shared styles plus extra CSS. */
export abstract class Demo extends HTMLElement {
  protected root: ShadowRoot;
  private built = false;

  constructor(...extra: CSSStyleSheet[]) {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.adoptedStyleSheets = [BASE, ...extra];
  }

  connectedCallback(): void {
    if (this.built) return;
    this.built = true;
    this.build();
  }

  protected abstract build(): void;
}
