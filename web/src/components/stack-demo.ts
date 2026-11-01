import {
  labelStack,
  PROGRAMS,
  signed,
  type ProgramId,
  type StackRow,
} from "../demos/stack";
import { t, type Key } from "../i18n";
import { loadCore, VmRunner } from "../sim/core";
import type { VmFrame } from "../sim/types";
import { chips, Demo, figcaption, reducedMotion, sheet } from "./kit";

const CSS = sheet(`
  .cols { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr)); align-items: start; margin-top: 0.75rem; }
  table { border-collapse: collapse; font-variant-numeric: tabular-nums; width: 100%; }
  caption { text-align: left; font-weight: 600; padding-bottom: 0.25rem; }
  td, th { padding: 0.15rem 0.5rem; border-bottom: 1px solid var(--border); text-align: left; }
  .cols > * { min-width: 0; }
  .code td { font-family: var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
  .code td.n { color: var(--muted); width: 2.5rem; }
  tr[aria-current="step"] { background: color-mix(in srgb, var(--accent) 18%, transparent); font-weight: 700; }
  .stack td.v { font-family: var(--mono); }
  .stack tr.f0 td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
  .stack tr.f1 td:first-child { box-shadow: inset 3px 0 0 var(--copper); }
  .stack tr.top td { font-weight: 700; }
  .muted { color: var(--muted); }
`);

interface Snapshot {
  /** The line that runs next (0 once halted). */
  line: number;
  rows: StackRow[];
}

/**
 * <stack-demo>: step through a small VM program and watch the stack: what
 * each word is (a working value, a local, an argument, a frame's saved
 * FP and return address).
 */
export class StackDemo extends Demo {
  private program: ProgramId = "expr";
  private snaps: Snapshot[] = [];
  private step = 0;
  private timer = 0;
  private stepBtn!: HTMLButtonElement;
  private backBtn!: HTMLButtonElement;
  private runBtn!: HTMLButtonElement;
  private cols!: HTMLElement;
  private note!: HTMLElement;

  constructor() {
    super(CSS);
  }

  disconnectedCallback(): void {
    clearInterval(this.timer);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("stk.caption"), t("stk.captionText")));
    fig.append(
      chips(
        t("stk.program"),
        "stack-program",
        (Object.keys(PROGRAMS) as ProgramId[]).map((id) => ({
          value: id,
          label: t(`stk.${id}` as Key),
        })),
        this.program,
        (id) => {
          this.program = id as ProgramId;
          this.reset();
        },
      ),
    );
    const controls = document.createElement("div");
    controls.className = "controls";
    const btn = (label: string, onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", onClick);
      controls.append(b);
      return b;
    };
    this.stepBtn = btn(t("stk.step"), () => this.go(1));
    this.backBtn = btn(t("stk.back"), () => this.go(-1));
    this.runBtn = btn(t("stk.run"), () => this.run());
    btn(t("stk.reset"), () => this.reset());
    this.cols = document.createElement("div");
    this.cols.className = "cols";
    this.note = document.createElement("p");
    this.note.className = "note";
    this.note.setAttribute("aria-live", "polite");
    fig.append(controls, this.note, this.cols);
    this.root.append(fig);
    void loadCore().then(() => this.reset());
  }

  /** Runs the whole program once, keeping the stack after every step. */
  private reset(): void {
    clearInterval(this.timer);
    const r = new VmRunner(PROGRAMS[this.program]);
    const snap = (): Snapshot => ({
      line: r.line(),
      rows: labelStack(
        r.sp(),
        Array.from(r.stack()),
        JSON.parse(r.frames()) as VmFrame[],
      ),
    });
    this.snaps = [snap()];
    for (let i = 0; i < 500 && !r.halted(); i++) {
      r.step();
      this.snaps.push(snap());
    }
    r.free();
    this.step = 0;
    this.draw();
  }

  private go(by: number): void {
    this.step = Math.max(0, Math.min(this.snaps.length - 1, this.step + by));
    if (this.step >= this.snaps.length - 1) clearInterval(this.timer);
    this.draw();
  }

  private run(): void {
    clearInterval(this.timer);
    if (reducedMotion()) {
      this.step = this.snaps.length - 1;
      this.draw();
      return;
    }
    this.timer = window.setInterval(() => this.go(1), 500);
  }

  private what(r: StackRow): string {
    const vars = { func: r.func, index: r.index ?? 0 };
    return t(`stk.${r.role}` as Key, vars);
  }

  private draw(): void {
    const s = this.snaps[this.step];
    if (!s) return;
    const last = this.step >= this.snaps.length - 1;
    this.stepBtn.disabled = last;
    this.runBtn.disabled = last;
    this.backBtn.disabled = this.step === 0;

    const code = document.createElement("table");
    code.className = "code";
    code.innerHTML = `<caption>${t("stk.code")}</caption>`;
    PROGRAMS[this.program].split("\n").forEach((text, i) => {
      const row = code.insertRow();
      if (i + 1 === s.line) {
        row.setAttribute("aria-current", "step");
        row.title = t("stk.current");
      }
      const n = row.insertCell();
      n.className = "n";
      n.textContent = `${i + 1 === s.line ? "▶" : ""}${i + 1}`;
      row.insertCell().textContent = text;
    });

    const stack = document.createElement("table");
    stack.className = "stack";
    stack.innerHTML = `<caption>${t("stk.stack")}</caption><tr><th>${t("stk.addr")}</th><th>${t("stk.value")}</th><th>${t("stk.what")}</th></tr>`;
    // Alternate a stripe per call, so frames stand apart (the text says
    // which function too).
    s.rows.forEach((r, i) => {
      const row = stack.insertRow();
      const stripe = r.depth === undefined ? "" : `f${r.depth % 2}`;
      row.className = `${stripe}${i === 0 ? " top" : ""}`;
      row.insertCell().textContent = `0x${r.addr.toString(16)}`;
      const v = row.insertCell();
      v.className = "v";
      v.textContent =
        r.role === "return"
          ? "↩"
          : r.role === "saved-fp"
            ? `0x${r.value.toString(16)}`
            : String(signed(r.value));
      row.insertCell().textContent = this.what(r);
    });
    if (!s.rows.length) {
      const row = stack.insertRow();
      const c = row.insertCell();
      c.colSpan = 3;
      c.className = "muted";
      c.textContent = t("stk.empty");
    }
    this.cols.replaceChildren(code, stack);

    const result = s.rows[0];
    this.note.textContent =
      last && result
        ? t("stk.done", { value: signed(result.value) })
        : this.step === 0
          ? t("stk.start")
          : t("stk.next", { n: this.step, line: s.line });
  }
}

customElements.define("stack-demo", StackDemo);
