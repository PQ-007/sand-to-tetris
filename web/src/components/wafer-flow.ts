import { waferPicture } from "../demos/pictures";
import { WAFER_STEPS, type WaferStep } from "../demos/wafer";
import { t, type Key } from "../i18n";
import { Demo, sheet, svg } from "./kit";

const CSS = sheet(`
  ol.flow { list-style: none; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.5rem; padding: 0; margin: 0; }
  @container (max-width: 560px) { ol.flow { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  ol.flow button { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.5rem 0.25rem 0.45rem; border-color: var(--border); text-align: center; font-size: 0.8125rem; font-weight: 600; line-height: 1.25; }
  ol.flow button[aria-pressed=true] { background: var(--surface-2); color: var(--text); border-color: var(--text); box-shadow: inset 0 0 0 1px var(--text); }
  ol.flow button svg { width: 100%; max-width: 5rem; }
  .n { position: absolute; top: 0.3rem; left: 0.4rem; font: 500 0.6875rem var(--mono); color: var(--muted); }
  .pic { fill: none; stroke: var(--text); stroke-width: 1.25; stroke-linecap: round; stroke-linejoin: round; }
  .pic * { vector-effect: non-scaling-stroke; }
  .pic .f { fill: var(--surface); }
  .pic .g { fill: var(--surface-3); }
  .pic .g2 { fill: var(--surface-2); }
  .pic .k { fill: var(--text); stroke: none; }
  .pic .m { stroke: var(--faint); }
  .pic .b { stroke-width: 2.5; }
  .stage { display: grid; grid-template-columns: 11rem minmax(0, 1fr); gap: 1.25rem; align-items: center; margin-top: 1rem; padding: 1rem; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); }
  @container (max-width: 480px) { .stage { grid-template-columns: minmax(0, 1fr); } .stage > svg { max-width: 12rem; } }
  .stage .pic .f { fill: var(--surface-2); }
  .stage h3 { margin: 0 0 0.375rem; font-size: 1.0625rem; }
  .stage p { margin: 0; }
  .tags { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; margin-top: 0.75rem; font-size: 0.875rem; }
  .tag { font-family: var(--mono); font-size: 0.8125rem; padding: 0.15rem 0.5rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); }
  .meter { display: flex; align-items: center; gap: 0.5rem; }
  .bar { width: 7rem; height: 0.5rem; background: var(--border); border-radius: 999px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--text); }
  .src { font-size: 0.8125rem; }
  .nav { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; }
  .nav button { min-width: 2.75rem; }
`);

/** How many "nines" of purity, e.g. 1e-7 impurity → 99.99999 %. */
function purityText(impurity: number): string {
  const nines = Math.round(-Math.log10(impurity));
  const pct = (100 - impurity * 100).toFixed(Math.max(0, nines - 2));
  const ratio = Math.round(1 / impurity).toLocaleString("en-US");
  return t("wafer.purityText", { pct, ratio });
}

function text(s: WaferStep, field: "title" | "what" | "temperature"): string {
  return t(`wafer.${s.id}.${field}` as Key);
}

function picture(s: WaferStep): SVGSVGElement {
  const pic = svg("svg", {
    viewBox: "0 0 80 56",
    class: "pic",
    "aria-hidden": "true",
  });
  pic.innerHTML = waferPicture(s.id);
  return pic;
}

/** <wafer-flow>: step through the journey from quartz sand to a polished wafer. */
export class WaferFlow extends Demo {
  private index = 0;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    const caption = document.createElement("figcaption");
    const strong = document.createElement("strong");
    strong.textContent = t("wafer.caption");
    caption.append(strong, " ", t("wafer.captionText"));
    fig.append(caption);

    // The six steps as pictures, numbered.
    const list = document.createElement("ol");
    list.className = "flow";
    const buttons = WAFER_STEPS.map((step, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      const num = document.createElement("span");
      num.className = "n";
      num.textContent = String(i + 1);
      num.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = text(step, "title");
      b.append(num, picture(step), label);
      b.addEventListener("click", () => this.go(i));
      li.append(b);
      list.append(li);
      return b;
    });

    // The chosen step, large, with its one-line summary.
    const stage = document.createElement("div");
    stage.className = "stage";
    stage.setAttribute("aria-live", "polite");

    const nav = document.createElement("div");
    nav.className = "nav";
    const prev = document.createElement("button");
    prev.type = "button";
    prev.textContent = "←";
    prev.setAttribute("aria-label", t("wafer.prev"));
    prev.addEventListener("click", () => this.go(this.index - 1));
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "→";
    next.setAttribute("aria-label", t("wafer.next"));
    next.addEventListener("click", () => this.go(this.index + 1));
    nav.append(prev, next);
    fig.append(list, stage, nav);
    this.root.append(fig);

    this.render = () => {
      const s = WAFER_STEPS[this.index];
      if (!s) return;
      buttons.forEach((b, i) =>
        b.setAttribute("aria-pressed", String(i === this.index)),
      );
      prev.disabled = this.index === 0;
      next.disabled = this.index === WAFER_STEPS.length - 1;

      const info = document.createElement("div");
      const h = document.createElement("h3");
      h.textContent = t("wafer.step", {
        n: this.index + 1,
        title: text(s, "title"),
      });
      const what = document.createElement("p");
      what.textContent = text(s, "what");
      info.append(h, what);

      const tags = document.createElement("div");
      tags.className = "tags";
      if (s.heated) {
        const temp = document.createElement("span");
        temp.className = "tag";
        temp.textContent = text(s, "temperature");
        temp.setAttribute(
          "aria-label",
          t("wafer.temperature", { t: text(s, "temperature") }),
        );
        tags.append(temp);
      }
      if (s.impurity !== undefined) {
        const m = document.createElement("span");
        m.className = "meter";
        const nines = -Math.log10(s.impurity);
        const bar = document.createElement("span");
        bar.className = "bar";
        bar.setAttribute("role", "img");
        const fill = document.createElement("span");
        fill.style.width = `${Math.min(100, (nines / 9) * 100)}%`;
        bar.append(fill);
        const label = document.createElement("span");
        label.textContent = purityText(s.impurity);
        bar.setAttribute("aria-label", label.textContent);
        m.append(bar, label);
        tags.append(m);
      }
      for (const id of s.sources) {
        const a = document.createElement("a");
        a.className = "src";
        a.href = `#/chapter/0/s/src-${id}`;
        a.textContent = t("wafer.source");
        tags.append(a);
      }
      if (tags.childElementCount) info.append(tags);
      stage.replaceChildren(picture(s), info);
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
