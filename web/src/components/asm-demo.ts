import { bits, fieldsOf } from "../demos/asm";
import { t } from "../i18n";
import { asmErrorText } from "../messages";
import { asmAssemble, disassemble, loadCore } from "../sim/core";
import { chips, Demo, figcaption, sheet } from "./kit";

const CSS = sheet(`
  .line { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .line input { font: 1rem var(--mono); width: min(22rem, 100%); padding: 0.4rem 0.6rem;
    color: var(--text); background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 0.3125rem; }
  .word { margin-top: 1rem; }
  .hex { font: 600 0.875rem var(--mono); color: var(--copper); margin-bottom: 0.4rem; }
  .fields { display: flex; flex-wrap: wrap; gap: 3px; }
  .field { display: flex; flex-direction: column; align-items: center; padding: 0.35rem 0.5rem;
    border: 1px solid var(--border-strong); border-radius: 3px; background: var(--surface-2); }
  .field.group { border-color: var(--accent); }
  .field .b { font: 600 1rem var(--mono); letter-spacing: 0.12em; }
  .field .n { font: 0.6875rem var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .back { margin: 0.75rem 0 0; font-size: 0.9375rem; }
  .back code { font-family: var(--mono); }
  .err { color: var(--error); margin: 0.75rem 0 0; }
`);

const EXAMPLES = [
  "ADD r3, r1, r2",
  "SET r1, 5",
  "LOAD r2, [r1 + 3]",
  "SHL r4, r4, 1",
  "JNZ -2",
  "RET",
  "SET16 r1, 0x4000",
];

/** <asm-demo>: type one instruction and see the bits the assembler makes. */
export class AsmDemo extends Demo {
  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("asmd.caption"), t("asmd.captionText")));
    const line = document.createElement("label");
    line.className = "line";
    line.append(t("asmd.instruction"));
    const input = document.createElement("input");
    input.type = "text";
    input.value = EXAMPLES[0] ?? "";
    input.spellcheck = false;
    input.autocapitalize = "off";
    line.append(input);
    const out = document.createElement("div");
    out.setAttribute("aria-live", "polite");
    const pick = chips(
      t("asmd.try"),
      "asm-example",
      EXAMPLES.map((e) => ({ value: e, label: e })),
      input.value,
      (v) => {
        input.value = v;
        this.show(input.value, out);
      },
    );
    input.addEventListener("input", () => this.show(input.value, out));
    fig.append(pick, line, out);
    this.root.append(fig);
    void loadCore().then(() => this.show(input.value, out));
  }

  private show(text: string, out: HTMLElement): void {
    const p = asmAssemble(text);
    out.replaceChildren();
    const first = p.errors[0];
    if (first) {
      const e = document.createElement("p");
      e.className = "err";
      e.textContent = asmErrorText(first);
      out.append(e);
      return;
    }
    for (const word of p.code) {
      const box = document.createElement("div");
      box.className = "word";
      const hex = document.createElement("div");
      hex.className = "hex";
      hex.textContent = `0x${word.toString(16).padStart(4, "0")}`;
      const row = document.createElement("div");
      row.className = "fields";
      row.setAttribute("role", "img");
      const fields = fieldsOf(word);
      row.setAttribute(
        "aria-label",
        fields
          .map((f) => `${this.label(f.name)} ${bits(f)} (${f.value})`)
          .join(", "),
      );
      for (const f of fields) {
        const cell = document.createElement("div");
        cell.className = `field${f.name === "group" ? " group" : ""}`;
        const b = document.createElement("span");
        b.className = "b";
        b.textContent = bits(f);
        const n = document.createElement("span");
        n.className = "n";
        n.textContent = `${this.label(f.name)} ${f.value}`;
        cell.append(b, n);
        row.append(cell);
      }
      const back = document.createElement("p");
      back.className = "back";
      back.append(t("asmd.readsBack"), " ");
      const code = document.createElement("code");
      code.textContent = disassemble(word);
      back.append(code);
      box.append(hex, row, back);
      out.append(box);
    }
  }

  private label(name: string): string {
    return name === "group"
      ? t("asmd.group")
      : name === "unused"
        ? t("asmd.unused")
        : name;
  }
}

customElements.define("asm-demo", AsmDemo);
