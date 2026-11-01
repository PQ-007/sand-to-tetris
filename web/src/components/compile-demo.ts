import { tokenLabel, treeLines } from "../demos/compile";
import { t, type Key } from "../i18n";
import { langErrorText } from "../messages";
import { langCompile, langStages, loadCore } from "../sim/core";
import { chips, Demo, figcaption, sheet } from "./kit";

const CSS = sheet(`
  textarea { width: 100%; box-sizing: border-box; min-height: 7.5rem; resize: vertical;
    font: 0.9375rem/1.5 var(--mono); padding: 0.5rem 0.65rem; color: var(--text);
    background: var(--surface-2); border: 1px solid var(--border-strong); border-radius: 0.3125rem; }
  .cols { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr)); margin-top: 0.75rem; align-items: start; }
  .cols > * { min-width: 0; }
  h4 { margin: 0 0 0.4rem; font: 600 0.75rem var(--mono); text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .tokens { display: flex; flex-wrap: wrap; gap: 3px; }
  .tok { display: inline-flex; flex-direction: column; align-items: center; padding: 0.15rem 0.4rem;
    border: 1px solid var(--border-strong); border-radius: 3px; background: var(--surface-2); }
  .tok b { font: 600 0.875rem var(--mono); }
  .tok span { font: 0.625rem var(--mono); color: var(--muted); }
  .tok.kw { border-color: var(--accent); }
  pre { margin: 0; padding: 0.5rem 0.65rem; max-height: 20rem; overflow: auto; font: 0.8125rem/1.45 var(--mono);
    border: 1px solid var(--border); border-radius: 3px; background: var(--surface-2); white-space: pre; }
  .err { color: var(--error); margin: 0.75rem 0 0; }
`);

const EXAMPLES: Record<string, string> = {
  expr: "fn main() -> int {\n    var x = 2 + 3 * 4;\n    return x;\n}",
  if: "fn max(a: int, b: int) -> int {\n    if a > b { return a; }\n    return b;\n}\n\nfn main() -> int {\n    return max(3, 7);\n}",
  loop: "var squares: [int; 5];\n\nfn main() {\n    for i in 0..5 {\n        squares[i] = i * i;\n    }\n}",
};

/** <compile-demo>: type C Shard and see each stage: tokens, the tree, VM
 * code (or the first mistake, with its line). */
export class CompileDemo extends Demo {
  private timer = 0;

  constructor() {
    super(CSS);
  }

  disconnectedCallback(): void {
    clearTimeout(this.timer);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("cmp.caption"), t("cmp.captionText")));
    const input = document.createElement("textarea");
    input.spellcheck = false;
    input.autocapitalize = "off";
    input.value = EXAMPLES.expr ?? "";
    input.setAttribute("aria-label", t("cmp.source"));
    const out = document.createElement("div");
    out.setAttribute("aria-live", "polite");
    const pick = chips(
      t("cmp.try"),
      "compile-example",
      Object.keys(EXAMPLES).map((id) => ({
        value: id,
        label: t(`cmp.ex.${id}` as Key),
      })),
      "expr",
      (id) => {
        input.value = EXAMPLES[id] ?? "";
        this.show(input.value, out);
      },
    );
    input.addEventListener("input", () => {
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.show(input.value, out), 250);
    });
    fig.append(pick, input, out);
    this.root.append(fig);
    void loadCore().then(() => this.show(input.value, out));
  }

  private show(source: string, out: HTMLElement): void {
    out.replaceChildren();
    const fail = (e: Parameters<typeof langErrorText>[0]) => {
      const p = document.createElement("p");
      p.className = "err";
      p.textContent = t("cmp.error", {
        line: e.line,
        message: langErrorText(e),
      });
      out.append(p);
    };
    const tokens = langStages.tokenize(source);
    if ("error" in tokens) return fail(tokens.error);
    const cols = document.createElement("div");
    cols.className = "cols";
    const section = (title: string, body: HTMLElement) => {
      const s = document.createElement("section");
      const h = document.createElement("h4");
      h.textContent = title;
      s.append(h, body);
      cols.append(s);
    };
    const list = document.createElement("div");
    list.className = "tokens";
    for (const tok of tokens.ok.slice(0, 120)) {
      const { text, kind } = tokenLabel(tok);
      const el = document.createElement("span");
      el.className = `tok ${kind}`;
      const b = document.createElement("b");
      b.textContent = text;
      const k = document.createElement("span");
      k.textContent = t(`cmp.kind.${kind}` as Key);
      el.append(b, k);
      list.append(el);
    }
    section(t("cmp.tokens", { n: tokens.ok.length }), list);
    out.append(cols);
    const tree = langStages.parse(tokens.ok);
    if ("error" in tree) return fail(tree.error);
    const pre = document.createElement("pre");
    pre.textContent = treeLines(tree.ok)
      .map((l) => "  ".repeat(l.depth) + l.text)
      .join("\n");
    section(t("cmp.tree"), pre);
    const compiled = langCompile(source);
    const first = compiled.errors[0];
    if (first) return fail(first);
    const vm = document.createElement("pre");
    vm.textContent = compiled.vm.join("\n");
    section(t("cmp.vm", { n: compiled.vm.length }), vm);
  }
}

customElements.define("compile-demo", CompileDemo);
