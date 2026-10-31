import {
  buffer,
  errorRates,
  noiseMargins,
  readBit,
  runChain,
} from "../demos/noise";
import { t } from "../i18n";
import { Demo, chips, figcaption, sheet, slider, svg, wide } from "./kit";

const CSS = sheet(`
  .band0, .band1 { fill: var(--zone-ok); }
  .forbidden { fill: var(--zone-bad); }
  .analog { stroke: var(--analog); fill: none; stroke-width: 2.5; stroke-dasharray: 7 5; }
  .digital { stroke: var(--digital); fill: none; stroke-width: 2.5; }
  .analog-pt { fill: var(--analog); }
  .digital-pt { fill: var(--digital); }
  .curve { fill: none; stroke: var(--accent); stroke-width: 2; }
  .ref { stroke: var(--muted); stroke-dasharray: 3 3; }
  .grid line { stroke: var(--border); }
  .two { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); align-items: start; margin-top: 0.75rem; }
  h3 { font-size: 1rem; margin: 0 0 0.25rem; }
`);

const W = 620;
const H = 250;
const PAD = { l: 44, r: 14, t: 14, b: 30 };

/**
 * <noise-chain>: one bit passes through a chain of stages that each add
 * noise. Analog stages just copy; digital stages restore the level first.
 */
export class NoiseChain extends Demo {
  private bit: 0 | 1 = 1;
  private stages = 12;
  private noise = 0.06;
  private seed = 1;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("noise.caption"), t("noise.captionHtml")));
    const controls = document.createElement("div");
    controls.className = "controls";
    const bitChips = chips(
      t("noise.bit"),
      "bit",
      [
        { value: "1", label: "1" },
        { value: "0", label: "0" },
      ],
      "1",
      (v) => {
        this.bit = v === "1" ? 1 : 0;
        this.draw();
      },
    );
    bitChips.style.margin = "0";
    const stages = slider(
      t("noise.stages"),
      { min: 1, max: 30, step: 1, value: this.stages },
      (v) => {
        this.stages = v;
        this.draw();
      },
    );
    const noise = slider(
      t("noise.noise"),
      { min: 0, max: 0.2, step: 0.005, value: this.noise },
      (v) => {
        this.noise = v;
        this.draw();
      },
    );
    const again = document.createElement("button");
    again.type = "button";
    again.textContent = t("noise.again");
    again.addEventListener("click", () => {
      this.seed += 1;
      this.draw();
    });
    controls.append(bitChips, stages.label, noise.label, again);
    this.chart = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    this.readout = document.createElement("ul");
    this.readout.className = "readout";
    this.readout.innerHTML = `<li><b>${t("noise.analog")}</b><output data-a></output></li>
      <li><b>${t("noise.digital")}</b><output data-d></output></li>
      <li><b>${t("noise.errors")}</b><output data-e></output></li>`;
    const two = document.createElement("div");
    two.className = "two";
    const why = document.createElement("div");
    why.innerHTML = `<h3>${t("noise.whyTitle")}</h3>
      <p class="note">${t("noise.whyHtml")}</p>`;
    this.curve = svg("svg", { viewBox: "0 0 260 230", role: "img" });
    two.append(why, this.curve);
    fig.append(controls, wide(this.chart), this.readout, two);
    this.root.append(fig);
    this.drawCurve();
    this.draw();
  }

  private chart!: SVGSVGElement;
  private curve!: SVGSVGElement;
  private readout!: HTMLElement;

  private draw(): void {
    const run = runChain({
      bit: this.bit,
      stages: this.stages,
      noise: this.noise,
      seed: this.seed,
    });
    const m = noiseMargins();
    const p = this.chart;
    p.replaceChildren();
    const x = (i: number) => PAD.l + (i / this.stages) * (W - PAD.l - PAD.r);
    const y = (v: number) =>
      PAD.t +
      (1 - (Math.max(-0.3, Math.min(1.3, v)) + 0.3) / 1.6) *
        (H - PAD.t - PAD.b);
    svg(
      "rect",
      {
        x: PAD.l,
        y: y(1.3),
        width: W - PAD.l - PAD.r,
        height: y(m.vih) - y(1.3),
        class: "band1",
      },
      p,
    );
    svg(
      "rect",
      {
        x: PAD.l,
        y: y(m.vih),
        width: W - PAD.l - PAD.r,
        height: y(m.vil) - y(m.vih),
        class: "forbidden",
      },
      p,
    );
    svg(
      "rect",
      {
        x: PAD.l,
        y: y(m.vil),
        width: W - PAD.l - PAD.r,
        height: y(-0.3) - y(m.vil),
        class: "band0",
      },
      p,
    );
    svg(
      "text",
      { x: W - PAD.r - 6, y: y(1.22), "text-anchor": "end", class: "muted" },
      p,
      t("noise.reads1"),
    );
    svg(
      "text",
      { x: W - PAD.r - 6, y: y(0.5) + 4, "text-anchor": "end", class: "muted" },
      p,
      t("noise.unreliable"),
    );
    svg(
      "text",
      { x: W - PAD.r - 6, y: y(-0.22), "text-anchor": "end", class: "muted" },
      p,
      t("noise.reads0"),
    );
    for (const v of [0, 0.5, 1]) {
      svg(
        "line",
        { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), class: "ref" },
        p,
      );
      svg(
        "text",
        { x: PAD.l - 6, y: y(v) + 4, "text-anchor": "end", class: "muted" },
        p,
        `${v} V`,
      );
    }
    svg("text", { x: PAD.l, y: H - 8, class: "muted" }, p, t("noise.sender"));
    svg(
      "text",
      { x: W - PAD.r, y: H - 8, "text-anchor": "end", class: "muted" },
      p,
      t("noise.stageN", { n: this.stages }),
    );
    const line = (vals: number[]) =>
      vals
        .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        .join("");
    svg("path", { d: line(run.analog), class: "analog" }, p);
    svg("path", { d: line(run.digital), class: "digital" }, p);
    run.analog.forEach((v, i) =>
      svg("circle", { cx: x(i), cy: y(v), r: 3.5, class: "analog-pt" }, p),
    );
    run.digital.forEach((v, i) =>
      svg(
        "rect",
        {
          x: x(i) - 3.5,
          y: y(v) - 3.5,
          width: 7,
          height: 7,
          class: "digital-pt",
        },
        p,
      ),
    );

    const last = (vals: number[]) => vals[vals.length - 1] ?? 0;
    const verdict = (v: number) => {
      const b = readBit(v);
      return `${b} ${t(b === this.bit ? "noise.correct" : "noise.wrong")} (${v.toFixed(2)} V)`;
    };
    const a = last(run.analog);
    const d = last(run.digital);
    p.setAttribute(
      "aria-label",
      t("noise.label", {
        bit: this.bit,
        n: this.stages,
        a: a.toFixed(2),
        d: d.toFixed(2),
      }),
    );
    const rates = errorRates({ stages: this.stages, noise: this.noise }, 1000);
    const out = (sel: string) =>
      this.readout.querySelector(`[${sel}]`) as HTMLOutputElement;
    out("data-a").value = verdict(a);
    out("data-d").value = verdict(d);
    out("data-e").value = t("noise.errorCounts", {
      a: Math.round(rates.analog * 1000),
      d: Math.round(rates.digital * 1000),
    });
  }

  private drawCurve(): void {
    const p = this.curve;
    const m = noiseMargins();
    const s = 180;
    const ox = 50;
    const oy = 200;
    const x = (v: number) => ox + v * s;
    const y = (v: number) => oy - v * s;
    p.setAttribute(
      "aria-label",
      t("noise.curveLabel", {
        vil: m.vil.toFixed(2),
        vih: m.vih.toFixed(2),
        nm: m.nmLow.toFixed(2),
      }),
    );
    const grid = svg("g", { class: "grid" }, p);
    svg("line", { x1: x(0), x2: x(1), y1: y(0), y2: y(0) }, grid);
    svg("line", { x1: x(0), x2: x(0), y1: y(0), y2: y(1) }, grid);
    svg("line", { x1: x(0), x2: x(1), y1: y(0), y2: y(1), class: "ref" }, p);
    let d = "";
    for (let v = 0; v <= 1.0001; v += 0.01)
      d += `${d ? "L" : "M"}${x(v).toFixed(1)},${y(buffer(v)).toFixed(1)}`;
    svg("path", { d, class: "curve" }, p);
    for (const [v, label] of [
      [m.vil, "V_IL"],
      [m.vih, "V_IH"],
    ] as const) {
      svg(
        "line",
        { x1: x(v), x2: x(v), y1: y(0), y2: y(buffer(v)), class: "ref" },
        p,
      );
      svg("text", { x: x(v), y: oy + 14, "text-anchor": "middle" }, p, label);
    }
    svg(
      "text",
      { x: x(0.5), y: oy + 28, "text-anchor": "middle", class: "muted" },
      p,
      t("noise.inAxis"),
    );
    svg(
      "text",
      { x: x(0) - 6, y: y(1) + 4, "text-anchor": "end", class: "muted" },
      p,
      "1 V",
    );
    svg(
      "text",
      { x: x(0) - 6, y: y(0) + 4, "text-anchor": "end", class: "muted" },
      p,
      "0 V",
    );
    svg(
      "text",
      { x: x(0.02), y: y(0.98), class: "muted" },
      p,
      t("noise.outAxis"),
    );
    // Lower-right corner is empty (the curve is near 1 V there).
    svg(
      "text",
      { x: x(1), y: y(0.3), "text-anchor": "end" },
      p,
      t("noise.margin"),
    );
    svg(
      "text",
      { x: x(1), y: y(0.2), "text-anchor": "end" },
      p,
      `≈ ${m.nmLow.toFixed(2)} V`,
    );
  }
}

customElements.define("noise-chain", NoiseChain);
