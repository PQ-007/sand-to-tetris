// The Machine page: write assembly, assemble it, and run it on the
// reference CPU with its screen, keyboard, registers and RAM in view.
import { t, type Key } from "./i18n";
import { EXAMPLES } from "./machine-programs";
import { asmErrorText } from "./messages";
import { asmAssemble, disassemble, loadCore, Machine } from "./sim/core";
import type { AsmProgram } from "./sim/types";
import { assemblerChoices, type AssembleFn } from "./workshop-run";

const SOURCE_KEY = "s2t-machine-source";
const W = 128;
const H = 96;

/** Instructions per animation frame. */
const SPEEDS = [
  { id: "slow", perFrame: 1 },
  { id: "medium", perFrame: 250 },
  { id: "fast", perFrame: 60_000 },
] as const;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A browser key name → its keyboard code (docs/ASSEMBLY.md), or null for
 * keys the machine doesn't take (Tab keeps moving focus). */
export function keyCode(key: string): number | null {
  const named: Record<string, number> = {
    Enter: 13,
    Backspace: 8,
    Escape: 27,
    ArrowLeft: 128,
    ArrowUp: 129,
    ArrowRight: 130,
    ArrowDown: 131,
  };
  if (key in named) return named[key] ?? null;
  if (key.length === 1) {
    const c = key.charCodeAt(0);
    return c >= 32 && c <= 126 ? c : null;
  }
  return null;
}

function readSource(): string {
  try {
    return localStorage.getItem(SOURCE_KEY) ?? EXAMPLES[0]?.source ?? "";
  } catch {
    return EXAMPLES[0]?.source ?? "";
  }
}

function saveSource(text: string): void {
  try {
    localStorage.setItem(SOURCE_KEY, text);
  } catch {
    // Not saved; the editor still works.
  }
}

export async function mountMachine(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="loading">${esc(t("page.loading"))}</p>`;
  await loadCore();
  new MachinePage(root);
}

class MachinePage {
  private program: AsmProgram | null = null;
  /** The source the current program was assembled from. */
  private assembled = "";
  private machine: Machine | null = null;
  private running = false;
  private frame = 0;
  private speed: (typeof SPEEDS)[number] = SPEEDS[2];
  private assemble: AssembleFn = async (s) => asmAssemble(s);
  private colors = { on: [77, 163, 255], off: [10, 15, 22] };

  private editor: HTMLTextAreaElement;
  private gutter: HTMLElement;
  private errors: HTMLElement;
  private status: HTMLElement;
  private canvas: HTMLCanvasElement;
  private keyState: HTMLElement;
  private regs: HTMLElement;
  private ramStart: HTMLInputElement;
  private ramView: HTMLElement;
  private runBtn: HTMLButtonElement;

  constructor(root: HTMLElement) {
    const examples = EXAMPLES.map(
      (e) =>
        `<option value="${e.id}">${esc(t(`machine.ex.${e.id}` as Key))}</option>`,
    ).join("");
    const speeds = SPEEDS.map(
      (s) =>
        `<option value="${s.id}"${s === this.speed ? " selected" : ""}>${esc(t(`machine.speed.${s.id}` as Key))}</option>`,
    ).join("");
    root.innerHTML = `
      <div class="page-head machine-head">
        <div>
          <h1 tabindex="-1">${esc(t("machine.title"))}</h1>
          <p class="lead">${esc(t("machine.lead"))}</p>
        </div>
        <div class="machine-pickers">
          <label>${esc(t("machine.example"))}
            <select data-example><option value="">${esc(t("machine.pick"))}</option>${examples}</select></label>
          <label data-assembler-box hidden>${esc(t("machine.assembler"))}
            <select data-assembler></select></label>
        </div>
      </div>
      <div class="machine-grid">
        <section class="machine-code" aria-label="${esc(t("machine.codeLabel"))}">
          <div class="toolbar">
            <button type="button" class="primary" data-run>${esc(t("machine.run"))}</button>
            <button type="button" data-step>${esc(t("machine.step"))}</button>
            <button type="button" data-reset>${esc(t("machine.reset"))}</button>
            <span class="spacer"></span>
            <label class="speed">${esc(t("machine.speed"))}
              <select data-speed>${speeds}</select></label>
          </div>
          <div class="asm-editor">
            <pre class="asm-gutter" aria-hidden="true"></pre>
            <textarea spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"
              aria-label="${esc(t("machine.source"))}"></textarea>
          </div>
          <ul class="asm-errors" aria-live="polite"></ul>
        </section>
        <section class="machine-side">
          <div class="screen-box">
            <canvas width="${W}" height="${H}" tabindex="0" role="img"
              aria-label="${esc(t("machine.screenLabel"))}"></canvas>
            <p class="help">${esc(t("machine.keysHelp"))} <span class="key-state"></span></p>
          </div>
          <div class="machine-panel">
            <p class="machine-status" role="status"></p>
            <table class="machine-regs"></table>
          </div>
          <div class="machine-panel">
            <label class="ram-start">${esc(t("machine.ramFrom"))}
              <input type="text" inputmode="numeric" value="0" data-ram></label>
            <table class="machine-ram"></table>
          </div>
        </section>
      </div>`;
    const q = <T extends Element>(s: string) => root.querySelector(s) as T;
    this.editor = q("textarea");
    this.gutter = q(".asm-gutter");
    this.errors = q(".asm-errors");
    this.status = q(".machine-status");
    this.canvas = q("canvas");
    this.keyState = q(".key-state");
    this.regs = q(".machine-regs");
    this.ramStart = q("[data-ram]");
    this.ramView = q(".machine-ram");
    this.runBtn = q("[data-run]");

    this.editor.value = readSource();
    this.editor.addEventListener("input", () => {
      saveSource(this.editor.value);
      this.renderGutter();
    });
    this.editor.addEventListener("scroll", () => {
      this.gutter.scrollTop = this.editor.scrollTop;
    });
    q<HTMLSelectElement>("[data-example]").addEventListener("change", (e) => {
      const ex = EXAMPLES.find(
        (x) => x.id === (e.target as HTMLSelectElement).value,
      );
      if (!ex) return;
      this.pause();
      this.editor.value = ex.source;
      saveSource(ex.source);
      this.machine = null;
      this.program = null;
      this.renderGutter();
      this.renderErrors();
      this.renderState();
    });
    q<HTMLSelectElement>("[data-speed]").addEventListener("change", (e) => {
      const id = (e.target as HTMLSelectElement).value;
      this.speed = SPEEDS.find((s) => s.id === id) ?? this.speed;
    });
    this.runBtn.addEventListener("click", () => void this.toggleRun());
    q("[data-step]").addEventListener("click", () => void this.step());
    q("[data-reset]").addEventListener("click", () => void this.reset());
    this.ramStart.addEventListener("change", () => this.renderRam());
    this.canvas.addEventListener("keydown", (e) => this.key(e, true));
    this.canvas.addEventListener("keyup", (e) => this.key(e, false));
    this.canvas.addEventListener("blur", () => this.setKey(0));
    this.readColors();
    window
      .matchMedia?.("(prefers-color-scheme: dark)")
      .addEventListener?.("change", () => {
        this.readColors();
        this.draw();
      });
    window.addEventListener("hashchange", () => this.pause(), { once: true });
    void this.offerAssemblers(q("[data-assembler-box]"), q("[data-assembler]"));
    this.renderGutter();
    this.renderState();
    this.draw();
  }

  /** The learner's own assembler, once it passes its tests. */
  private async offerAssemblers(
    box: HTMLElement,
    select: HTMLSelectElement,
  ): Promise<void> {
    const choices = await assemblerChoices();
    if (choices.length < 2) return;
    select.innerHTML = choices
      .map(
        (c, i) =>
          `<option value="${i}">${esc(t(`machine.asm.${c.id}` as Key))}</option>`,
      )
      .join("");
    box.hidden = false;
    this.assemble = choices[0]?.assemble ?? this.assemble;
    select.addEventListener("change", () => {
      const c = choices[Number(select.value)];
      if (c) this.assemble = c.assemble;
      this.program = null;
      this.machine = null;
    });
  }

  /** Screen colours from the theme: lit pixels in the accent colour. */
  private readColors(): void {
    const probe = document.createElement("span");
    document.body.append(probe);
    const rgb = (v: string): number[] => {
      probe.style.color = `var(${v})`;
      const m = getComputedStyle(probe).color.match(/\d+/g) ?? [];
      return m.slice(0, 3).map(Number);
    };
    this.colors = { on: rgb("--accent"), off: rgb("--bg") };
    probe.remove();
  }

  /** Assembles if the source changed; false if it has errors. */
  private async ensureAssembled(): Promise<boolean> {
    const source = this.editor.value;
    if (this.program && this.machine && this.assembled === source)
      return this.program.errors.length === 0;
    this.status.textContent = t("machine.assembling");
    this.program = await this.assemble(source);
    this.assembled = source;
    this.renderErrors();
    if (this.program.errors.length) {
      this.machine = null;
      this.renderState();
      return false;
    }
    this.load();
    return true;
  }

  /** A fresh machine: the program in ROM, the data image in RAM. */
  private load(): void {
    if (!this.program) return;
    this.machine?.free();
    this.machine = new Machine(
      Uint16Array.from(this.program.code),
      Uint16Array.from(this.program.data),
    );
  }

  private async toggleRun(): Promise<void> {
    if (this.running) {
      this.pause();
      return;
    }
    if (!(await this.ensureAssembled())) return;
    if (this.machine?.halted()) this.load();
    this.running = true;
    this.runBtn.textContent = t("machine.pause");
    this.canvas.focus({ preventScroll: true });
    const tick = () => {
      if (!this.running || !this.machine) return;
      this.machine.run(this.speed.perFrame);
      this.draw();
      this.renderState();
      if (this.machine.halted()) this.pause();
      else this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private pause(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.runBtn.textContent = t("machine.run");
    this.renderState();
  }

  private async step(): Promise<void> {
    this.pause();
    if (!(await this.ensureAssembled()) || !this.machine) return;
    this.machine.run(1);
    this.draw();
    this.renderState();
  }

  private async reset(): Promise<void> {
    this.pause();
    if (!(await this.ensureAssembled())) return;
    this.load();
    this.draw();
    this.renderState();
  }

  private key(e: KeyboardEvent, down: boolean): void {
    const code = keyCode(e.key);
    if (code === null) return;
    e.preventDefault();
    this.setKey(down ? code : 0);
  }

  private setKey(code: number): void {
    this.machine?.setKey(code);
    this.keyState.textContent = code ? t("machine.keyHeld", { code }) : "";
  }

  private draw(): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const words = this.machine?.screen() ?? new Uint16Array(768);
    const img = ctx.createImageData(W, H);
    const { on, off } = this.colors;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const word = words[y * 8 + (x >> 4)] ?? 0;
        const c = (word >> (15 - (x & 15))) & 1 ? on : off;
        const i = (y * W + x) * 4;
        img.data[i] = c[0] ?? 0;
        img.data[i + 1] = c[1] ?? 0;
        img.data[i + 2] = c[2] ?? 0;
        img.data[i + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }

  /** Line numbers, with ▶ at the line PC is on. */
  private renderGutter(): void {
    const lines = this.editor.value.split("\n").length;
    const pc = this.machine?.pc();
    const current =
      pc !== undefined && this.assembled === this.editor.value
        ? this.program?.sourceMap[pc]
        : undefined;
    this.gutter.textContent = Array.from({ length: lines }, (_, i) =>
      i + 1 === current ? `▶${i + 1}` : String(i + 1),
    ).join("\n");
    this.gutter.scrollTop = this.editor.scrollTop;
  }

  private renderErrors(): void {
    const errs = this.program?.errors ?? [];
    this.errors.replaceChildren(
      ...errs.map((e) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "linkish";
        b.textContent = t("machine.errorLine", {
          line: e.line,
          message: asmErrorText(e),
        });
        b.addEventListener("click", () => this.selectLine(e.line));
        li.append(b);
        return li;
      }),
    );
  }

  private selectLine(line: number): void {
    const lines = this.editor.value.split("\n");
    const start = lines
      .slice(0, line - 1)
      .reduce((n, l) => n + l.length + 1, 0);
    this.editor.focus();
    this.editor.setSelectionRange(
      start,
      start + (lines[line - 1]?.length ?? 0),
    );
  }

  private renderState(): void {
    this.renderGutter();
    const m = this.machine;
    if (!m) {
      this.status.textContent = this.program?.errors.length
        ? t("machine.hasErrors", { n: this.program.errors.length })
        : t("machine.ready");
      this.regs.innerHTML = "";
      this.ramView.innerHTML = "";
      return;
    }
    const steps = m.steps().toLocaleString("en-US");
    this.status.textContent = m.halted()
      ? t("machine.halted", { steps })
      : this.running
        ? t("machine.running", { steps })
        : t("machine.paused", { steps });
    const regs = m.regs();
    const flags = m.flags();
    const pc = m.pc();
    const word = this.program?.code[pc] ?? 0;
    const hex = (v: number) => `0x${v.toString(16).padStart(4, "0")}`;
    const rows = [
      ["PC", `${pc} <span class="muted">${esc(disassemble(word))}</span>`],
      [
        t("machine.flags"),
        `Z=${(flags >> 2) & 1} N=${(flags >> 1) & 1} C=${flags & 1}`,
      ],
      ...Array.from(regs, (v, i) => [
        `r${i}`,
        `${v} <span class="muted">${hex(v)}</span>`,
      ]),
    ];
    this.regs.innerHTML = rows
      .map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`)
      .join("");
    this.renderRam();
  }

  private renderRam(): void {
    if (!this.machine) return;
    const n = Number(this.ramStart.value.trim());
    const start = Number.isFinite(n) ? Math.max(0, Math.min(16368, n)) : 0;
    const words = this.machine.ram(start, 16);
    this.ramView.innerHTML = Array.from(words, (v, i) => {
      const addr = start + i;
      return `<tr><th scope="row">${addr}</th><td>${v} <span class="muted">0x${v.toString(16).padStart(4, "0")}</span></td></tr>`;
    }).join("");
  }
}
