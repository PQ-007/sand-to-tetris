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
  tr[aria-current="step"] { background: color-mix(in srgb, var(--accent) 18%, transparent); font-weight: 600; }
  /* The stack, drawn as a pile of words, top first. A frame's words share
     a thick left edge (ink, then grey, alternating per call). */
  .stackviz h4 { margin: 0 0 0.25rem; font-size: 1rem; }
  .sp { font: 600 0.75rem var(--mono); color: var(--muted); margin: 0 0 0.25rem; }
  .pile { display: flex; flex-direction: column; }
  .word { display: grid; grid-template-columns: 4.5rem minmax(0, 1fr) auto; gap: 0.75rem; align-items: center;
    padding: 0.35rem 0.75rem; border: 1px solid var(--border-strong); border-top-width: 0; border-left-width: 5px; background: var(--surface); }
  .word:first-child { border-top-width: 1px; border-radius: var(--radius-sm) var(--radius-sm) 0 0; }
  .word:last-child { border-radius: 0 0 var(--radius-sm) var(--radius-sm); }
  .word.f0 { border-left-color: var(--text); }
  .word.f1 { border-left-color: var(--faint); }
  .word.top { background: var(--surface-2); }
  .word b { font: 600 1.125rem var(--mono); font-variant-numeric: tabular-nums; }
  .word .what { font-size: 0.875rem; }
  .word .addr { font: 0.75rem var(--mono); color: var(--muted); }
  .empty { padding: 0.75rem; border: 1px dashed var(--border-strong); border-radius: var(--radius-sm); color: var(--muted); text-align: center; }
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

    const stack = document.createElement("div");
    stack.className = "stackviz";
    const title = document.createElement("h4");
    title.textContent = t("stk.stack");
    stack.append(title);
    if (s.rows.length) {
      const sp = document.createElement("p");
      sp.className = "sp";
      sp.textContent = `SP → 0x${s.rows[0]?.addr.toString(16) ?? ""}`;
      const pile = document.createElement("div");
      pile.className = "pile";
      pile.setAttribute("role", "list");
      s.rows.forEach((r, i) => {
        const word = document.createElement("div");
        const stripe = r.depth === undefined ? "" : `f${r.depth % 2}`;
        word.className = `word ${stripe}${i === 0 ? " top" : ""}`;
        word.setAttribute("role", "listitem");
        const v = document.createElement("b");
        v.textContent =
          r.role === "return"
            ? "↩"
            : r.role === "saved-fp"
              ? `0x${r.value.toString(16)}`
              : String(signed(r.value));
        const what = document.createElement("span");
        what.className = "what";
        what.textContent = this.what(r);
        const addr = document.createElement("span");
        addr.className = "addr";
        addr.textContent = `0x${r.addr.toString(16)}`;
        word.append(v, what, addr);
        pile.append(word);
      });
      stack.append(sp, pile);
    } else {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = t("stk.empty");
      stack.append(empty);
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
