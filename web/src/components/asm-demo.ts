import { bits, fieldsOf, links, tokensOf, type Field } from "../demos/asm";
import { t } from "../i18n";
import { asmErrorText } from "../messages";
import { asmAssemble, disassemble, loadCore } from "../sim/core";
import { chips, Demo, figcaption, sheet, svg } from "./kit";

const CSS = sheet(`
  .line { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .line input { font: 1rem var(--mono); width: min(22rem, 100%); padding: 0.4rem 0.6rem;
    color: var(--text); background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 0.3125rem; }
  .word { margin-top: 1.25rem; }
  /* Drawn at its natural size; on a narrow screen it scrolls sideways
     instead of shrinking the bits out of reach. */
  .word { overflow-x: auto; }
  .word svg { font: 12px var(--mono); max-width: none; }
  .word + .word { padding-top: 1rem; border-top: 1px solid var(--border); }
  .tok { font: 600 15px var(--mono); }
  .link { stroke: var(--faint); stroke-width: 1; fill: none; }
  .brace { stroke: var(--text); stroke-width: 1.25; fill: none; }
  .cell { stroke: var(--border-strong); stroke-width: 1; fill: var(--surface); }
  .cell.one { fill: var(--text); stroke: var(--text); }
  .bit { font: 600 13px var(--mono); }
  .cell.one + .bit { fill: var(--bg); }
  .fname { font: 500 10px var(--mono); fill: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .fval { font: 600 12px var(--mono); }
  .hex { font: 600 12px var(--mono); fill: var(--muted); }
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

// The word's geometry: 16 bit cells, a gap between fields.
const CELL = 24;
const STEP = 26;
const GAP = 8;
const LEFT = 4;
const TOK_Y = 16;
const BRACE_Y = 52;
const CELL_Y = 58;

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
    for (const word of p.code) out.append(this.drawWord(word));
  }

  /** One word: its parts above, lines down to the fields they fill, the
   * 16 bits (each labelled 0 or 1), and each field's name and value. */
  private drawWord(word: number): HTMLElement {
    const fields = fieldsOf(word);
    const asm = disassemble(word);
    const tokens = tokensOf(asm);
    // Where each field starts and ends.
    const spans: [number, number][] = [];
    let x = LEFT;
    for (const f of fields) {
      spans.push([x, x + f.width * STEP - (STEP - CELL)]);
      x += f.width * STEP + GAP;
    }
    const width = x - GAP + LEFT + 60;
    const box = document.createElement("div");
    box.className = "word";
    const pic = svg("svg", {
      viewBox: `0 0 ${width} 118`,
      role: "img",
      style: `width: ${width}px`,
      "aria-label": `${asm}: ${fields
        .map((f) => `${this.label(f)} ${bits(f)} (${f.value})`)
        .join(", ")}`,
    });

    // The parts, each over the middle of the field it fills.
    const used = new Map<number, number>();
    for (const [tok, fi] of links(fields, tokens)) {
      const [a, b] = spans[fi] ?? [0, 0];
      const mid = (a + b) / 2;
      used.set(fi, tok);
      svg(
        "text",
        { x: mid, y: TOK_Y, "text-anchor": "middle", class: "tok" },
        pic,
        tokens[tok] ?? "",
      );
      svg(
        "path",
        { d: `M${mid},${TOK_Y + 6} V${BRACE_Y - 3}`, class: "link" },
        pic,
      );
      svg(
        "path",
        {
          d: `M${a},${BRACE_Y + 2} V${BRACE_Y} H${b} V${BRACE_Y + 2}`,
          class: "brace",
        },
        pic,
      );
    }

    // The bits, then the field names and values.
    fields.forEach((f, fi) => {
      const [a, b] = spans[fi] ?? [0, 0];
      const s = bits(f);
      for (let i = 0; i < f.width; i++) {
        const cx = a + i * STEP;
        const one = s[i] === "1";
        svg(
          "rect",
          {
            x: cx,
            y: CELL_Y,
            width: CELL,
            height: CELL,
            rx: 3,
            class: one ? "cell one" : "cell",
          },
          pic,
        );
        svg(
          "text",
          {
            x: cx + CELL / 2,
            y: CELL_Y + 17,
            "text-anchor": "middle",
            class: "bit",
          },
          pic,
          s[i] ?? "",
        );
      }
      const mid = (a + b) / 2;
      svg(
        "text",
        { x: mid, y: CELL_Y + 40, "text-anchor": "middle", class: "fname" },
        pic,
        this.label(f),
      );
      svg(
        "text",
        {
          x: mid,
          y: CELL_Y + 56,
          "text-anchor": "middle",
          class: used.has(fi) ? "fval" : "fval muted",
        },
        pic,
        String(f.value),
      );
    });
    svg(
      "text",
      { x: width - 4, y: CELL_Y + 17, "text-anchor": "end", class: "hex" },
      pic,
      `0x${word.toString(16).padStart(4, "0")}`,
    );
    box.append(pic);
    return box;
  }

  private label(f: Field): string {
    return f.name === "group"
      ? t("asmd.group")
      : f.name === "unused"
        ? t("asmd.unused")
        : f.name;
  }
}

customElements.define("asm-demo", AsmDemo);
