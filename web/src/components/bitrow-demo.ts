import {
  binary,
  cellsOf,
  flip,
  maxColumn,
  placed,
  rowFate,
  WIDTH,
} from "../demos/bitrows";
import { t, type Key } from "../i18n";
import { Demo, figcaption, sheet, slider } from "./kit";

const CSS = sheet(`
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin: 0.4rem 0; }
  .cells { display: grid; grid-template-columns: repeat(10, 1.6rem); gap: 2px; }
  .cells button, .cells span { width: 1.6rem; height: 1.6rem; padding: 0; border-radius: 2px;
    border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--muted);
    font: 600 0.6875rem var(--mono); }
  .cells button { cursor: pointer; }
  .cells [aria-pressed="true"], .cells .on { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .cells .piece { background: var(--copper); color: var(--bg); border-color: var(--copper); }
  .cells .hit { background: var(--error); color: var(--bg); border-color: var(--error); }
  .cells button:focus-visible { outline: 3px solid var(--focus); outline-offset: 1px; }
  .val { font: 0.875rem var(--mono); min-width: 9rem; }
  .fate { font-size: 0.875rem; }
  .fate.full, .fate.target { color: var(--ok); font-weight: 600; }
  .target { font: 600 0.9375rem var(--mono); color: var(--copper); }
  h4 { margin: 1rem 0 0.25rem; font: 600 0.75rem var(--mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .verdict { margin: 0.4rem 0 0; font-size: 0.9375rem; }
`);

const TARGET = 0b1011001101;
const PIECE = 0b11100;

/** <bitrow-demo>: board rows as 10-bit numbers you can edit, the target
 * check, and a piece row sliding along one of them: collision is an AND. */
export class BitrowDemo extends Demo {
  private rows = [0b1111111110, 0b1011001100, 0b0000110000];
  private x = 2;
  private body!: HTMLElement;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("brow.caption"), t("brow.captionText")));
    this.body = document.createElement("div");
    this.body.setAttribute("aria-live", "polite");
    const move = slider(
      t("brow.column"),
      { min: 0, max: maxColumn(PIECE), step: 1, value: this.x },
      (v) => {
        this.x = v;
        move.input.setAttribute("aria-valuetext", String(v));
        this.draw();
      },
    );
    fig.append(this.body, move.label);
    this.root.append(fig);
    this.draw();
  }

  private draw(): void {
    this.body.replaceChildren();
    const target = document.createElement("p");
    target.className = "target";
    target.textContent = t("brow.target", { bits: binary(TARGET) });
    this.body.append(target);
    this.rows.forEach((value, r) => {
      const row = document.createElement("div");
      row.className = "row";
      const cells = document.createElement("div");
      cells.className = "cells";
      cells.setAttribute("role", "group");
      cells.setAttribute("aria-label", t("brow.rowLabel", { n: r + 1 }));
      cellsOf(value).forEach((on, c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = on ? "1" : "0";
        b.setAttribute("aria-pressed", String(on));
        b.setAttribute(
          "aria-label",
          t(on ? "brow.cellOn" : "brow.cellOff", { row: r + 1, col: c + 1 }),
        );
        b.addEventListener("click", () => {
          this.rows[r] = flip(value, c);
          this.draw();
          const again = this.body.querySelectorAll(".cells")[r]?.children[c];
          (again as HTMLElement | undefined)?.focus();
        });
        cells.append(b);
      });
      const val = document.createElement("span");
      val.className = "val";
      val.textContent = `${binary(value)} = ${value}`;
      const fate = rowFate(value, TARGET);
      const f = document.createElement("span");
      f.className = `fate ${fate}`;
      f.textContent = t(`brow.fate.${fate}` as Key);
      row.append(cells, val, f);
      this.body.append(row);
    });
    // The piece row over the last board row.
    const h = document.createElement("h4");
    h.textContent = t("brow.pieceHead");
    const p = placed(PIECE, this.x);
    const under = this.rows[this.rows.length - 1] ?? 0;
    const row = document.createElement("div");
    row.className = "row";
    const cells = document.createElement("div");
    cells.className = "cells";
    cells.setAttribute("role", "img");
    const hits = p & under;
    cells.setAttribute(
      "aria-label",
      t("brow.pieceLabel", { bits: binary(p), col: this.x }),
    );
    for (let c = 0; c < WIDTH; c++) {
      const bit = 1 << (WIDTH - 1 - c);
      const s = document.createElement("span");
      s.className = hits & bit ? "hit" : p & bit ? "piece" : "";
      s.textContent = p & bit ? "1" : "0";
      cells.append(s);
    }
    const val = document.createElement("span");
    val.className = "val";
    val.textContent = `(11100 << 5) >> ${this.x} = ${binary(p)}`;
    row.append(cells, val);
    const verdict = document.createElement("p");
    verdict.className = "verdict";
    verdict.textContent = t(hits ? "brow.blocked" : "brow.fits", {
      and: binary(hits),
    });
    this.body.append(h, row, verdict);
  }
}

customElements.define("bitrow-demo", BitrowDemo);
