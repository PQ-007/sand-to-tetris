import { COLS, fontIndex, gridOf, ROWS, rowBits, toggle } from "../demos/font";
import { t } from "../i18n";
import { BUILTIN_OS, fontWords } from "../os";
import { chips, Demo, figcaption, sheet } from "./kit";

const CSS = sheet(`
  .body { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start; margin-top: 0.75rem; }
  .grid { display: grid; grid-template-columns: repeat(3, 2.75rem); gap: 4px; }
  .grid button { width: 2.75rem; height: 2.75rem; padding: 0; border-radius: 3px;
    border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--muted);
    font: 600 0.75rem var(--mono); cursor: pointer; }
  .grid button[aria-pressed="true"] { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .grid button:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
  .word { font: 600 1.125rem var(--mono); color: var(--copper); margin: 0 0 0.35rem; }
  .bits { font: 0.9375rem var(--mono); letter-spacing: 0.06em; margin: 0 0 0.75rem; }
  .bits span { color: var(--muted); }
  .note { margin: 0; font-size: 0.9375rem; max-width: 28rem; }
  label.pick { display: inline-flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem; }
  label.pick input { width: 3rem; font: 1rem var(--mono); text-align: center; padding: 0.3rem;
    color: var(--text); background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 3px; }
`);

const PICKS = ["A", "S", "7", "?"];

/** <font-demo>: a character of the OS font as 15 pixels and the word that
 * stores them; click (or press) a pixel to flip its bit. */
export class FontDemo extends Demo {
  private font = fontWords(BUILTIN_OS);
  private word = 0;
  private char = "A";
  private grid!: HTMLElement;
  private wordEl!: HTMLElement;
  private bitsEl!: HTMLElement;
  private input!: HTMLInputElement;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("font.caption"), t("font.captionText")));
    fig.append(
      chips(
        t("font.try"),
        "font-char",
        PICKS.map((c) => ({ value: c, label: c })),
        this.char,
        (c) => this.pick(c),
      ),
    );
    const pick = document.createElement("label");
    pick.className = "pick";
    pick.append(t("font.char"));
    this.input = document.createElement("input");
    this.input.maxLength = 1;
    this.input.value = this.char;
    this.input.addEventListener("input", () => {
      if (this.input.value) this.pick(this.input.value);
    });
    pick.append(this.input);
    const body = document.createElement("div");
    body.className = "body";
    this.grid = document.createElement("div");
    this.grid.className = "grid";
    this.grid.setAttribute("role", "group");
    const info = document.createElement("div");
    this.wordEl = document.createElement("p");
    this.wordEl.className = "word";
    this.bitsEl = document.createElement("p");
    this.bitsEl.className = "bits";
    this.bitsEl.setAttribute("aria-live", "polite");
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = t("font.note");
    info.append(this.wordEl, this.bitsEl, note);
    body.append(this.grid, info);
    fig.append(pick, body);
    this.root.append(fig);
    this.pick(this.char);
  }

  private pick(c: string): void {
    this.char = c;
    if (this.input.value !== c) this.input.value = c;
    this.word = this.font[fontIndex(c)] ?? 0;
    this.draw();
  }

  private draw(): void {
    this.grid.setAttribute(
      "aria-label",
      t("font.gridLabel", { char: this.char }),
    );
    const grid = gridOf(this.word);
    this.grid.replaceChildren();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const on = grid[r]?.[c] ?? false;
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-pressed", String(on));
        b.setAttribute(
          "aria-label",
          t(on ? "font.pixelOn" : "font.pixelOff", { row: r + 1, col: c + 1 }),
        );
        b.textContent = on ? "1" : "0";
        b.addEventListener("click", () => {
          this.word = toggle(this.word, r, c);
          this.draw();
          (
            this.grid.children[r * COLS + c] as HTMLElement | undefined
          )?.focus();
        });
        this.grid.append(b);
      }
    this.wordEl.textContent = `0x${this.word.toString(16).toUpperCase().padStart(4, "0")}`;
    const rows = rowBits(this.word).split(" ");
    this.bitsEl.innerHTML = `<span>0</span> ${rows.join(" ")}`;
    this.bitsEl.title = t("font.bitsTitle");
  }
}

customElements.define("font-demo", FontDemo);
