import { rippleAt, settleSteps } from "../demos/ripple";
import { Demo, reducedMotion, sheet } from "./kit";

const CSS = sheet(`
  .grid { display: grid; grid-template-columns: 6.5rem repeat(9, 2.4rem); gap: 0.25rem; align-items: center; font-variant-numeric: tabular-nums; overflow-x: auto; }
  .grid .h { font-size: 0.8125rem; color: var(--muted); text-align: center; }
  .grid .k { font-size: 0.875rem; color: var(--muted); }
  .cell { text-align: center; border: 1px solid var(--border); border-radius: 0.375rem; padding: 0.2rem 0; background: var(--bg); }
  .cell.unknown { color: var(--muted); border-style: dashed; }
  .cell.carry1 { border-color: var(--accent); font-weight: 700; }
  .cell.new { outline: 2px solid var(--focus); }
  .row-sep { grid-column: 1 / -1; border-top: 2px solid var(--text); margin: 0.125rem 0; }
  input[type=number] { width: 5rem; font: inherit; }
  .presets { display: flex; flex-wrap: wrap; gap: 0.375rem; }
`);

const N = 8;

/**
 * <ripple-adder>: add two 8-bit numbers and watch the carry ripple from
 * column to column, one step at a time.
 */
export class RippleAdder extends Demo {
  private a = 255;
  private b = 1;
  private step = 0;
  private timer = 0;

  constructor() {
    super(CSS);
  }

  disconnectedCallback(): void {
    clearInterval(this.timer);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.innerHTML = `<figcaption><strong>A carry that ripples</strong>
      Each column is a full adder. A column whose two bits are equal knows its carry out
      straight away. Otherwise it must wait for the carry from the column to its right.
      <span class="muted">?</span> means "not known yet".</figcaption>`;
    const controls = document.createElement("div");
    controls.className = "controls";
    const num = (
      label: string,
      get: () => number,
      set: (v: number) => void,
    ) => {
      const l = document.createElement("label");
      l.textContent = label;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "255";
      input.value = String(get());
      input.addEventListener("change", () => {
        set(Math.max(0, Math.min(255, Math.round(Number(input.value)) || 0)));
        input.value = String(get());
        this.reset();
      });
      l.append(input);
      return { l, input };
    };
    const A = num(
      "a ",
      () => this.a,
      (v) => (this.a = v),
    );
    const B = num(
      "b ",
      () => this.b,
      (v) => (this.b = v),
    );
    const btn = (text: string, onClick: () => void) => {
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = text;
      x.addEventListener("click", onClick);
      return x;
    };
    const stepBtn = btn("Step", () => this.advance());
    const playBtn = btn("Play", () => this.play());
    const resetBtn = btn("Reset", () => this.reset());
    controls.append(A.l, B.l, stepBtn, playBtn, resetBtn);
    const presets = document.createElement("div");
    presets.className = "presets";
    const preset = (label: string, a: number, b: number) =>
      btn(label, () => {
        this.a = a;
        this.b = b;
        A.input.value = String(a);
        B.input.value = String(b);
        this.reset();
      });
    presets.append(
      preset("255 + 1 (long carry)", 255, 1),
      preset("255 + 0 (no carry, still waits)", 255, 0),
      preset("12 + 12 (no waiting)", 12, 12),
      preset("100 + 27", 100, 27),
    );
    this.grid = document.createElement("div");
    this.grid.className = "grid";
    this.grid.setAttribute("role", "table");
    this.status = document.createElement("p");
    this.status.className = "note";
    this.status.setAttribute("aria-live", "polite");
    fig.append(controls, presets, this.grid, this.status);
    this.root.append(fig);
    this.draw();
  }

  private grid!: HTMLElement;
  private status!: HTMLElement;

  private reset(): void {
    clearInterval(this.timer);
    this.step = 0;
    this.draw();
  }

  private advance(): void {
    if (rippleAt(this.a, this.b, N, this.step).done) return;
    this.step += 1;
    this.draw();
  }

  private play(): void {
    clearInterval(this.timer);
    if (reducedMotion()) {
      this.advance();
      return;
    }
    this.timer = window.setInterval(() => {
      if (rippleAt(this.a, this.b, N, this.step).done)
        clearInterval(this.timer);
      else this.advance();
    }, 600);
  }

  private draw(): void {
    const s = rippleAt(this.a, this.b, N, this.step);
    const prev =
      this.step > 0 ? rippleAt(this.a, this.b, N, this.step - 1) : null;
    const cols = Array.from({ length: N }, (_, k) => N - 1 - k); // MSB on the left
    const cell = (v: number | null, cls = "", fresh = false) =>
      `<span class="cell${v === null ? " unknown" : ""}${cls}${fresh ? " new" : ""}" role="cell">${v === null ? "?" : v}</span>`;
    const bitOf = (x: number, i: number) => (x >> i) & 1;
    let html = `<span class="h" role="columnheader"></span><span class="h" role="columnheader">carry out</span>`;
    html += cols
      .map((i) => `<span class="h" role="columnheader">bit ${i}</span>`)
      .join("");
    html += `<span class="k" role="rowheader">carry in</span>${cell(s.carries[N] ?? null, s.carries[N] === 1 ? " carry1" : "", prev?.carries[N] === null && s.carries[N] !== null)}`;
    html += cols
      .map((i) =>
        cell(
          s.carries[i] ?? null,
          s.carries[i] === 1 ? " carry1" : "",
          prev?.carries[i] === null && s.carries[i] !== null,
        ),
      )
      .join("");
    html += `<span class="k" role="rowheader">a = ${this.a}</span><span></span>${cols.map((i) => cell(bitOf(this.a, i))).join("")}`;
    html += `<span class="k" role="rowheader">b = ${this.b}</span><span></span>${cols.map((i) => cell(bitOf(this.b, i))).join("")}`;
    html += `<span class="row-sep"></span>`;
    html += `<span class="k" role="rowheader">sum</span><span></span>${cols.map((i) => cell(s.sums[i] ?? null, "", prev?.sums[i] === null && s.sums[i] !== null)).join("")}`;
    this.grid.innerHTML = html;
    const total = settleSteps(this.a, this.b, N);
    const sum = (this.a + this.b) & 255;
    this.status.textContent = s.done
      ? `Done after ${total} step${total === 1 ? "" : "s"}: ${this.a} + ${this.b} = ${sum}${this.a + this.b > 255 ? " (the carry out is dropped: 8 bits can't hold " + (this.a + this.b) + ")" : ""}.`
      : `Step ${this.step} of ${total}: still waiting for the carry to ripple.`;
  }
}

customElements.define("ripple-adder", RippleAdder);
