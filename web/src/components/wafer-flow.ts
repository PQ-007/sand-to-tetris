import { WAFER_STEPS } from "../demos/wafer";
import { Demo, sheet } from "./kit";

const CSS = sheet(`
  ol.flow { list-style: none; display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: 0.5rem; padding: 0; margin: 0; counter-reset: step; }
  ol.flow li { counter-increment: step; }
  ol.flow button { width: 100%; height: 100%; text-align: left; padding: 0.5rem 0.625rem; }
  ol.flow button::before { content: counter(step) " → "; color: var(--muted); font-variant-numeric: tabular-nums; }
  ol.flow button[aria-pressed=true]::before { color: inherit; }
  ol.flow li:last-child button::before { content: counter(step) " ✓ "; }
  .panel { background: var(--bg); border-radius: 0.5rem; padding: 0.75rem 1rem; margin-top: 0.75rem; }
  .panel h3 { margin: 0 0 0.25rem; }
  .panel p { margin: 0.375rem 0; }
  .meter { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem; font-size: 0.9375rem; }
  .bar { flex: 1; max-width: 16rem; height: 0.625rem; background: var(--border); border-radius: 999px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--accent); }
  .nav { display: flex; justify-content: space-between; margin-top: 0.75rem; }
`);

/** How many "nines" of purity, e.g. 1e-7 impurity → 99.99999 %. */
function purityText(impurity: number): string {
  const nines = Math.round(-Math.log10(impurity));
  const pct = (100 - impurity * 100).toFixed(Math.max(0, nines - 2));
  const ratio = Math.round(1 / impurity).toLocaleString("en-US");
  return `≈ ${pct}% silicon: about 1 stray atom in ${ratio}`;
}

/** <wafer-flow>: step through the journey from quartz sand to a polished wafer. */
export class WaferFlow extends Demo {
  private index = 0;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.innerHTML = `<figcaption><strong>From sand to wafer</strong>
      Six steps turn quartz into a disc of nearly perfect crystal. Select a step.</figcaption>`;
    const list = document.createElement("ol");
    list.className = "flow";
    const buttons = WAFER_STEPS.map((step, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = step.title;
      b.addEventListener("click", () => this.go(i));
      li.append(b);
      list.append(li);
      return b;
    });
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("aria-live", "polite");
    const nav = document.createElement("div");
    nav.className = "nav";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "← Previous step";
    prev.addEventListener("click", () => this.go(this.index - 1));
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "Next step →";
    next.addEventListener("click", () => this.go(this.index + 1));
    nav.append(prev, next);
    fig.append(list, panel, nav);
    this.root.append(fig);

    this.render = () => {
      const s = WAFER_STEPS[this.index];
      if (!s) return;
      buttons.forEach((b, i) =>
        b.setAttribute("aria-pressed", String(i === this.index)),
      );
      prev.disabled = this.index === 0;
      next.disabled = this.index === WAFER_STEPS.length - 1;
      panel.innerHTML = "";
      const h = document.createElement("h3");
      h.textContent = `Step ${this.index + 1}: ${s.title}`;
      const what = document.createElement("p");
      what.innerHTML = `<strong></strong>`;
      what.firstElementChild!.textContent = s.what;
      const detail = document.createElement("p");
      detail.textContent = s.detail;
      panel.append(h, what, detail);
      if (s.temperature) {
        const t = document.createElement("p");
        t.className = "muted";
        t.textContent = `Temperature: ${s.temperature}`;
        panel.append(t);
      }
      if (s.impurity !== undefined) {
        const m = document.createElement("div");
        m.className = "meter";
        const nines = -Math.log10(s.impurity);
        m.innerHTML = `<span>Purity</span><span class="bar" role="img"><span style="width:${Math.min(100, (nines / 9) * 100)}%"></span></span>`;
        const text = document.createElement("span");
        text.textContent = purityText(s.impurity);
        m.querySelector(".bar")?.setAttribute("aria-label", text.textContent);
        m.append(text);
        panel.append(m);
      }
      for (const id of s.sources) {
        const a = document.createElement("a");
        a.href = `#/chapter/0/s/src-${id}`;
        a.textContent = "Source";
        const p = document.createElement("p");
        p.className = "muted";
        p.append(a);
        panel.append(p);
      }
    };
    this.render();
  }

  private render: () => void = () => {};

  private go(i: number): void {
    this.index = Math.max(0, Math.min(WAFER_STEPS.length - 1, i));
    this.render();
  }
}

customElements.define("wafer-flow", WaferFlow);
