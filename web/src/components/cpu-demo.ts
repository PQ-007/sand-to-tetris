import {
  changes,
  group,
  haltStep,
  PROGRAMS,
  screenCorner,
  showWord,
  type Change,
  type ProgramId,
} from "../demos/cpu";
import { t, type Key } from "../i18n";
import { disassemble, isaTrace, loadCore } from "../sim/core";
import type { IsaTrace } from "../sim/types";
import { chips, Demo, figcaption, reducedMotion, sheet } from "./kit";

const CSS = sheet(`
  .cols { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); align-items: start; margin-top: 0.75rem; }
  table { border-collapse: collapse; font-variant-numeric: tabular-nums; width: 100%; }
  caption { text-align: left; font-weight: 600; padding-bottom: 0.25rem; }
  td, th { padding: 0.15rem 0.5rem; border-bottom: 1px solid var(--border); text-align: left; }
  td.code { font-family: var(--font-mono, ui-monospace, monospace); white-space: nowrap; }
  tr[aria-current="step"] { background: color-mix(in srgb, var(--accent) 18%, transparent); font-weight: 700; }
  tr.changed td { font-weight: 700; }
  .mark { color: var(--accent); }
  .pixels { display: grid; grid-template-columns: repeat(16, 1fr); gap: 2px; max-width: 16rem; }
  .pixels span { aspect-ratio: 1; background: var(--bg); border: 1px solid var(--border); }
  .pixels span.on { background: var(--text); }
  .what ul { margin: 0.25rem 0 0; }
`);

/**
 * <cpu-demo>: step through a small program on the reference CPU and see
 * what each instruction reads and changes.
 */
export class CpuDemo extends Demo {
  private program: ProgramId = "sum";
  private trace: IsaTrace | null = null;
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
    fig.append(figcaption(t("cpu.caption"), t("cpu.captionText")));
    fig.append(
      chips(
        t("cpu.program"),
        "program",
        (Object.keys(PROGRAMS) as ProgramId[]).map((id) => ({
          value: id,
          label: t(`cpu.${id}` as Key),
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
    this.stepBtn = btn(t("cpu.step"), () => this.advance());
    this.runBtn = btn(t("cpu.run"), () => this.run());
    btn(t("cpu.reset"), () => this.reset());
    this.cols = document.createElement("div");
    this.cols.className = "cols";
    this.what = document.createElement("div");
    this.what.className = "note what";
    this.what.setAttribute("aria-live", "polite");
    fig.append(controls, this.cols, this.what);
    this.root.append(fig);
    void loadCore().then(() => this.reset());
  }

  private stepBtn!: HTMLButtonElement;
  private runBtn!: HTMLButtonElement;
  private cols!: HTMLElement;
  private what!: HTMLElement;

  private get rom(): readonly number[] {
    return PROGRAMS[this.program];
  }

  private get end(): number {
    return this.trace ? haltStep(this.trace, this.rom) : 0;
  }

  private reset(): void {
    clearInterval(this.timer);
    this.trace = isaTrace([...this.rom], 200);
    this.step = 0;
    this.draw();
  }

  private advance(): void {
    if (this.step < this.end) this.step += 1;
    if (this.step >= this.end) clearInterval(this.timer);
    this.draw();
  }

  private run(): void {
    clearInterval(this.timer);
    if (reducedMotion()) {
      this.step = this.end;
      this.draw();
      return;
    }
    this.timer = window.setInterval(() => this.advance(), 450);
  }

  private draw(): void {
    const tr = this.trace;
    const state = tr?.states[this.step];
    if (!tr || !state) return;
    const done = this.step >= this.end;
    this.stepBtn.disabled = done;
    this.runBtn.disabled = done;
    const changed = this.step > 0 ? changes(tr, this.step - 1) : [];
    const regChanged = new Set(
      changed.flatMap((c) => (c.kind === "reg" ? [c.reg] : [])),
    );

    const listing = document.createElement("table");
    listing.innerHTML = `<caption>${t("cpu.listing")}</caption><tr><th>${t("cpu.addr")}</th><th>${t("cpu.instr")}</th></tr>`;
    this.rom.forEach((w, i) => {
      const row = listing.insertRow();
      if (i === state.pc) {
        row.setAttribute("aria-current", "step");
        row.title = t("cpu.current");
      }
      row.insertCell().textContent = String(i);
      const code = row.insertCell();
      code.className = "code";
      code.textContent = `${i === state.pc ? "▶ " : ""}${disassemble(w)}`;
    });

    const regs = document.createElement("table");
    regs.innerHTML = `<caption>${t("cpu.state")}</caption>`;
    const line = (name: string, value: string, isNew: boolean) => {
      const row = regs.insertRow();
      if (isNew) row.className = "changed";
      row.insertCell().textContent = name;
      const v = row.insertCell();
      v.textContent = value;
      if (isNew)
        v.append(
          " ",
          Object.assign(document.createElement("span"), {
            className: "mark",
            textContent: t("cpu.new"),
          }),
        );
    };
    line("PC", String(state.pc), this.step > 0);
    state.regs.forEach((v, r) => line(`r${r}`, showWord(v), regChanged.has(r)));
    line(
      t("cpu.flags"),
      `Z=${+state.z} N=${+state.n} C=${+state.c}`,
      changed.some((c) => c.kind === "flags"),
    );
    this.cols.replaceChildren(listing, regs);

    if (this.program === "screen") {
      const box = document.createElement("div");
      const label = document.createElement("p");
      label.textContent = t("cpu.screenLabel");
      const grid = document.createElement("div");
      grid.className = "pixels";
      grid.setAttribute("role", "img");
      const corner = screenCorner(tr, this.step);
      grid.setAttribute(
        "aria-label",
        corner
          .map((row, y) =>
            t("cpu.pixelRow", { y, bits: row.map(Number).join("") }),
          )
          .join(". "),
      );
      for (const row of corner)
        for (const on of row) {
          const px = document.createElement("span");
          if (on) px.className = "on";
          grid.append(px);
        }
      box.append(label, grid);
      this.cols.append(box);
    }

    this.what.replaceChildren(...this.explain(tr, changed, done));
  }

  /** What the last instruction did, in words. */
  private explain(tr: IsaTrace, changed: Change[], done: boolean): Node[] {
    if (this.step === 0) return [text("p", t("cpu.start"))];
    const prev = tr.states[this.step - 1];
    const word = prev ? (this.rom[prev.pc] ?? 0) : 0;
    const out: Node[] = [
      text(
        "p",
        `${t("cpu.did", { n: this.step, asm: disassemble(word) })} ${t(`cpu.group.${group(word)}` as Key)}`,
      ),
    ];
    const list = document.createElement("ul");
    for (const c of changed) list.append(text("li", describe(c)));
    if (!changed.length) list.append(text("li", t("cpu.nothing")));
    out.push(list);
    if (done) out.push(text("p", t("cpu.halted")));
    return out;
  }
}

function text(tag: string, s: string): HTMLElement {
  const e = document.createElement(tag);
  e.textContent = s;
  return e;
}

function describe(c: Change): string {
  switch (c.kind) {
    case "reg":
      return t("cpu.chReg", {
        r: c.reg,
        from: showWord(c.from),
        to: showWord(c.to),
      });
    case "flags":
      return t("cpu.chFlags", { z: +c.z, n: +c.n, c: +c.c });
    case "mem":
      return t("cpu.chMem", {
        addr: `0x${c.addr.toString(16).padStart(4, "0")}`,
        value: showWord(c.value),
      });
    case "jump":
      return t("cpu.chJump", { to: c.to });
  }
}

customElements.define("cpu-demo", CpuDemo);
