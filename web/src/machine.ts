// The Machine page: write assembly or VM code, build it, and run it on the
// reference CPU with its screen, keyboard, registers, stack and RAM in view.
import { t, type Key } from "./i18n";
import { EXAMPLES, type Example } from "./machine-programs";
import { asmErrorText, vmErrorText } from "./messages";
import { asmAssemble, disassemble, loadCore, Machine } from "./sim/core";
import type { AsmError, AsmProgram } from "./sim/types";
import { fromAsmErrors, type VmTranslation } from "./translator";
import {
  assemblerChoices,
  builtinTranslate,
  translatorChoices,
  type AssembleFn,
  type TranslateFn,
} from "./workshop-run";

type Lang = Example["lang"];

const LANG_KEY = "s2t-machine-lang";
const SOURCE_KEYS: Record<Lang, string> = {
  asm: "s2t-machine-source",
  vm: "s2t-machine-vm",
};
/** Stack words shown (VM programs). */
const STACK_ROWS = 12;
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

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved; the page still works.
  }
}

function readSource(lang: Lang): string {
  return (
    stored(SOURCE_KEYS[lang]) ??
    EXAMPLES.find((e) => e.lang === lang)?.source ??
    ""
  );
}

export async function mountMachine(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="loading">${esc(t("page.loading"))}</p>`;
  await loadCore();
  new MachinePage(root);
}

class MachinePage {
  private lang: Lang = stored(LANG_KEY) === "vm" ? "vm" : "asm";
  private program: AsmProgram | null = null;
  /** VM programs: the translation the program was assembled from. */
  private translation: VmTranslation | null = null;
  /** The errors shown, in the source's own terms. */
  private problems: { line: number; text: string }[] = [];
  /** The source the current program was built from. */
  private assembled = "";
  private machine: Machine | null = null;
  private running = false;
  private frame = 0;
  private speed: (typeof SPEEDS)[number] = SPEEDS[2];
  private assemble: AssembleFn = async (s) => asmAssemble(s);
  private translate: TranslateFn = builtinTranslate;
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
  private examples: HTMLSelectElement;
  private stackBox: HTMLElement;
  private stackView: HTMLElement;
  private asmBox: HTMLDetailsElement;

  constructor(private root: HTMLElement) {
    const langs = (["asm", "vm"] as const)
      .map(
        (l) =>
          `<option value="${l}"${l === this.lang ? " selected" : ""}>${esc(t(`machine.lang.${l}`))}</option>`,
      )
      .join("");
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
          <label>${esc(t("machine.language"))}
            <select data-lang>${langs}</select></label>
          <label>${esc(t("machine.example"))}
            <select data-example></select></label>
          <label data-translator-box hidden>${esc(t("machine.translator"))}
            <select data-translator></select></label>
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
            <textarea spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"></textarea>
          </div>
          <ul class="asm-errors" aria-live="polite"></ul>
          <details class="machine-asm" hidden><summary></summary><pre></pre></details>
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
          <div class="machine-panel" data-stack hidden>
            <h2 class="panel-title">${esc(t("machine.stack"))}</h2>
            <table class="machine-ram machine-stack"></table>
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
    this.examples = q("[data-example]");
    this.stackBox = q("[data-stack]");
    this.stackView = q(".machine-stack");
    this.asmBox = q(".machine-asm");
    this.asmBox.addEventListener("toggle", () => this.renderTranslation());

    this.editor.value = readSource(this.lang);
    this.editor.addEventListener("input", () => {
      store(SOURCE_KEYS[this.lang], this.editor.value);
      this.renderGutter();
    });
    q<HTMLSelectElement>("[data-lang]").addEventListener("change", (e) => {
      this.lang = (e.target as HTMLSelectElement).value === "vm" ? "vm" : "asm";
      store(LANG_KEY, this.lang);
      this.replaceSource(readSource(this.lang));
      this.renderLang();
    });
    this.editor.addEventListener("scroll", () => {
      this.gutter.scrollTop = this.editor.scrollTop;
    });
    this.examples.addEventListener("change", () => {
      const ex = EXAMPLES.find((x) => x.id === this.examples.value);
      if (!ex) return;
      store(SOURCE_KEYS[this.lang], ex.source);
      this.replaceSource(ex.source);
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
    void this.offerTranslators(
      q("[data-translator-box]"),
      q("[data-translator]"),
    );
    this.renderLang();
    this.renderGutter();
    this.renderState();
    this.draw();
  }

  /** Puts new source in the editor and forgets the built program. */
  private replaceSource(source: string): void {
    this.pause();
    this.editor.value = source;
    this.machine?.free();
    this.machine = null;
    this.program = null;
    this.translation = null;
    this.problems = [];
    this.renderGutter();
    this.renderErrors();
    this.renderState();
  }

  /** What changes with the language: examples, labels, panels. */
  private renderLang(): void {
    this.examples.innerHTML =
      `<option value="">${esc(t("machine.pick"))}</option>` +
      EXAMPLES.filter((e) => e.lang === this.lang)
        .map(
          (e) =>
            `<option value="${e.id}">${esc(t(`machine.ex.${e.id}` as Key))}</option>`,
        )
        .join("");
    this.editor.setAttribute(
      "aria-label",
      t(this.lang === "vm" ? "machine.sourceVm" : "machine.source"),
    );
    const box = this.root.querySelector<HTMLElement>("[data-translator-box]");
    if (box) box.hidden = this.lang !== "vm" || !this.hasOwnTranslator;
    this.stackBox.hidden = this.lang !== "vm";
    this.asmBox.hidden = true;
  }

  private hasOwnTranslator = false;

  /** The learner's own translator, once it passes its tests. */
  private async offerTranslators(
    box: HTMLElement,
    select: HTMLSelectElement,
  ): Promise<void> {
    const choices = await translatorChoices();
    if (choices.length < 2) return;
    select.innerHTML = choices
      .map(
        (c, i) =>
          `<option value="${i}">${esc(t(`machine.tr.${c.id}` as Key))}</option>`,
      )
      .join("");
    this.hasOwnTranslator = true;
    box.hidden = this.lang !== "vm";
    this.translate = choices[0]?.translate ?? this.translate;
    select.addEventListener("change", () => {
      const c = choices[Number(select.value)];
      if (c) this.translate = c.translate;
      this.program = null;
      this.machine = null;
    });
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

  /** Builds if the source changed (translating VM code first); false if
   * it has errors. */
  private async ensureAssembled(): Promise<boolean> {
    const source = this.editor.value;
    if (this.program && this.machine && this.assembled === source)
      return this.problems.length === 0;
    this.assembled = source;
    this.translation = null;
    let asm = source;
    if (this.lang === "vm") {
      this.status.textContent = t("machine.translating");
      this.translation = await this.translate(source);
      if (this.translation.errors.length) {
        this.program = null;
        this.fail(this.translation.errors, vmErrorText);
        return false;
      }
      asm = this.translation.lines.join("\n");
    }
    this.status.textContent = t("machine.assembling");
    this.program = await this.assemble(asm);
    if (this.program.errors.length) {
      // VM code: the assembler's errors on the VM lines they came from.
      if (this.translation)
        this.fail(
          fromAsmErrors(this.program.errors, this.translation.sourceMap),
          vmErrorText,
        );
      else this.fail(this.program.errors, asmErrorText);
      return false;
    }
    this.problems = [];
    this.renderErrors();
    this.renderTranslation();
    this.load();
    return true;
  }

  private fail(errors: AsmError[], text: (e: AsmError) => string): void {
    this.problems = errors.map((e) => ({ line: e.line, text: text(e) }));
    this.machine?.free();
    this.machine = null;
    this.renderErrors();
    this.renderTranslation();
    this.renderState();
  }

  /** VM code: the assembly it became, with ▶ at the current instruction. */
  private renderTranslation(): void {
    const tr = this.translation;
    this.asmBox.hidden = !tr || this.lang !== "vm";
    if (!tr) return;
    const summary = this.asmBox.querySelector("summary");
    const pre = this.asmBox.querySelector("pre");
    if (summary)
      summary.textContent = t("machine.translation", { n: tr.lines.length });
    if (!pre || !this.asmBox.open) return;
    const pc = this.machine?.pc();
    const current = pc !== undefined ? this.program?.sourceMap[pc] : undefined;
    pre.textContent = tr.lines
      .map((l, i) => `${i + 1 === current ? "▶" : " "} ${l}`)
      .join("\n");
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

  /** Line numbers, with ▶ at the line PC is on (for VM code: the VM line
   * its instruction came from). */
  private renderGutter(): void {
    const lines = this.editor.value.split("\n").length;
    const pc = this.machine?.pc();
    let current =
      pc !== undefined && this.assembled === this.editor.value
        ? this.program?.sourceMap[pc]
        : undefined;
    if (current !== undefined && this.translation)
      current = this.translation.sourceMap[current - 1];
    this.gutter.textContent = Array.from({ length: lines }, (_, i) =>
      i + 1 === current ? `▶${i + 1}` : String(i + 1),
    ).join("\n");
    this.gutter.scrollTop = this.editor.scrollTop;
  }

  private renderErrors(): void {
    this.errors.replaceChildren(
      ...this.problems.map((e) => {
        const li = document.createElement("li");
        if (e.line <= 0) {
          li.textContent = e.text;
          return li;
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "linkish";
        b.textContent = t("machine.errorLine", {
          line: e.line,
          message: e.text,
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
      this.status.textContent = this.problems.length
        ? t("machine.hasErrors", { n: this.problems.length })
        : t("machine.ready");
      this.regs.innerHTML = "";
      this.ramView.innerHTML = "";
      this.stackView.innerHTML = "";
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
    this.renderStack();
    this.renderTranslation();
  }

  /** VM code: the words from SP (r6) down to the bottom of the stack. */
  private renderStack(): void {
    if (!this.machine || this.lang !== "vm") return;
    const sp = this.machine.regs()[6] ?? 0;
    const n = sp >= 0x4000 || sp === 0 ? 0 : Math.min(STACK_ROWS, 0x4000 - sp);
    const words = n ? this.machine.ram(sp, n) : new Uint16Array(0);
    this.stackView.innerHTML = n
      ? Array.from(words, (v, i) => {
          const signed = v >= 0x8000 ? v - 0x10000 : v;
          return `<tr><th scope="row">${sp + i}</th><td>${signed} <span class="muted">0x${v.toString(16).padStart(4, "0")}</span></td></tr>`;
        }).join("")
      : `<tr><td class="muted">${esc(t("machine.stackEmpty"))}</td></tr>`;
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
