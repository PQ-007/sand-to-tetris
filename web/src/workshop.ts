// The assembler workshop: the learner writes their assembler in TypeScript,
// stage by stage, and runs the tests. Passing every test lets the Machine
// page use it.
import { getLang, t, type Key } from "./i18n";
import { chapterHref } from "./router";
import { loadCore } from "./sim/core";
import { STARTERS } from "./workshop-starter";
import { workshopStore, type WorkshopEntry } from "./workshop-store";
import { runWorkshopTests, workshopTests } from "./workshop-run";
import type { StageName, TestResult } from "./workshop-tests";

const ID = "assembler";
const STAGES: StageName[] = [
  "tokenize",
  "parse",
  "layout",
  "encode",
  "program",
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A value as short JSON for the results list. */
function show(v: unknown): string {
  const s = JSON.stringify(v);
  return s && s.length > 400 ? `${s.slice(0, 400)}…` : (s ?? "undefined");
}

export async function mountWorkshop(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="loading">${esc(t("page.loading"))}</p>`;
  await loadCore();
  const store = await workshopStore();
  const saved = (await store.load())[ID];
  new WorkshopPage(root, saved);
}

class WorkshopPage {
  private editor: HTMLTextAreaElement;
  private gutter: HTMLElement;
  private results: HTMLElement;
  private saveState: HTMLElement;
  private runBtn: HTMLButtonElement;
  private timer = 0;
  /** The code that last passed every test. */
  private passedCode: string | null;

  constructor(root: HTMLElement, saved: WorkshopEntry | undefined) {
    this.passedCode = saved?.passed ? saved.code : null;
    const total = workshopTests().length;
    root.innerHTML = `
      <div class="page-head workshop-head">
        <div>
          <h1 tabindex="-1">${esc(t("workshop.title"))}</h1>
          <p class="lead">${esc(t("workshop.lead"))}</p>
          <p class="help">${esc(t("workshop.how", { n: total }))}
            <a href="${chapterHref(5)}">${esc(t("workshop.chapter"))}</a></p>
        </div>
      </div>
      <div class="workshop-grid">
        <section class="workshop-code" aria-label="${esc(t("workshop.codeLabel"))}">
          <div class="toolbar">
            <button type="button" class="primary" data-run>${esc(t("workshop.run"))}</button>
            <button type="button" data-starter>${esc(t("workshop.starter"))}</button>
            <span class="spacer"></span>
            <span class="muted save-state" aria-live="polite"></span>
          </div>
          <div class="asm-editor tall">
            <pre class="asm-gutter" aria-hidden="true"></pre>
            <textarea spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off"
              aria-label="${esc(t("workshop.source"))}"></textarea>
          </div>
        </section>
        <section class="workshop-results" aria-live="polite"></section>
      </div>`;
    const q = <T extends Element>(s: string) => root.querySelector(s) as T;
    this.editor = q("textarea");
    this.gutter = q(".asm-gutter");
    this.results = q(".workshop-results");
    this.saveState = q(".save-state");
    this.runBtn = q("[data-run]");
    this.editor.value = saved?.code ?? STARTERS[getLang()];
    this.editor.addEventListener("input", () => {
      this.renderGutter();
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => void this.save(), 500);
    });
    this.editor.addEventListener("scroll", () => {
      this.gutter.scrollTop = this.editor.scrollTop;
    });
    // Tab indents instead of leaving the editor; Escape then Tab leaves it.
    let escaped = false;
    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Escape") escaped = true;
      else if (e.key === "Tab" && !escaped && !e.shiftKey) {
        e.preventDefault();
        this.editor.setRangeText(
          "  ",
          this.editor.selectionStart,
          this.editor.selectionEnd,
          "end",
        );
        this.editor.dispatchEvent(new Event("input"));
      } else escaped = false;
    });
    this.runBtn.addEventListener("click", () => void this.run());
    q("[data-starter]").addEventListener("click", () => {
      if (!confirm(t("workshop.confirmStarter"))) return;
      this.editor.value = STARTERS[getLang()];
      this.renderGutter();
      void this.save();
    });
    this.renderGutter();
    this.results.innerHTML = `<p class="muted">${esc(t(this.passedCode === this.editor.value ? "workshop.passedBefore" : "workshop.notRun"))}</p>`;
  }

  private renderGutter(): void {
    const n = this.editor.value.split("\n").length;
    this.gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join(
      "\n",
    );
    this.gutter.scrollTop = this.editor.scrollTop;
  }

  private async save(): Promise<void> {
    const code = this.editor.value;
    await (
      await workshopStore()
    ).save(ID, {
      code,
      passed: code === this.passedCode,
      updated: Date.now(),
    });
    this.saveState.textContent = t("workshop.saved");
  }

  private async run(): Promise<void> {
    const code = this.editor.value;
    this.runBtn.disabled = true;
    this.results.innerHTML = `<p class="muted">${esc(t("workshop.running"))}</p>`;
    const r = await runWorkshopTests(code);
    this.runBtn.disabled = false;
    if ("error" in r) {
      this.results.innerHTML = `<div class="workshop-problem"><h2>${esc(t(`workshop.err.${r.error.code}` as Key))}</h2>
        ${r.error.message ? `<pre>${esc(r.error.message)}</pre>` : ""}</div>`;
      return;
    }
    const all = r.results.every((x) => x.ok);
    this.passedCode = all ? code : null;
    await this.save();
    this.renderResults(r.results, all);
  }

  private renderResults(results: TestResult[], all: boolean): void {
    const groups = STAGES.map((stage) => {
      const mine = results.filter((x) => x.stage === stage);
      const passed = mine.filter((x) => x.ok).length;
      const failed = mine.filter((x) => !x.ok);
      const done = passed === mine.length;
      const items = failed
        .slice(0, 12)
        .map(
          (
            f,
          ) => `<li><details><summary><code>${esc(f.name || t("workshop.emptyLine"))}</code></summary>
            <dl>
              <dt>${esc(t("workshop.input"))}</dt><dd><code>${esc(show(f.args))}</code></dd>
              <dt>${esc(t("workshop.expected"))}</dt><dd><code>${esc("ok" in f.expected ? show(f.expected.ok) : t("workshop.throws", { code: f.expected.error }))}</code></dd>
              <dt>${esc(t("workshop.got"))}</dt><dd><code>${esc("ok" in f.got ? show(f.got.ok) : t("workshop.threw", { code: f.got.error, message: f.got.message }))}</code></dd>
            </dl></details></li>`,
        )
        .join("");
      const more =
        failed.length > 12
          ? `<li class="muted">${esc(t("workshop.more", { n: failed.length - 12 }))}</li>`
          : "";
      return `<section class="stage" data-done="${done}">
        <h2><span class="stage-name">${esc(t(`workshop.stage.${stage}` as Key))}</span>
          <span class="pill ${done ? "pill-passed" : "pill-broken"}">${passed}/${mine.length}</span></h2>
        ${failed.length ? `<ul class="fails">${items}${more}</ul>` : ""}
      </section>`;
    }).join("");
    const head = all
      ? `<div class="workshop-pass"><p><strong>${esc(t("workshop.allPassed", { n: results.length }))}</strong></p>
         <p><a class="button primary" href="#/machine">${esc(t("workshop.toMachine"))}</a></p></div>`
      : "";
    this.results.innerHTML = head + groups;
  }
}
