import { rng } from "../demos/noise";
import {
  depletionWidth,
  diodeCurrent,
  formatAmps,
  junctionState,
} from "../demos/semiconductor";
import { t } from "../i18n";
import {
  Demo,
  figcaption,
  reducedMotion,
  sheet,
  slider,
  svg,
  wide,
} from "./kit";

const CSS = sheet(`
  .p { fill: var(--p-type); }
  .n { fill: var(--n-type); }
  .depl { fill: var(--surface); stroke: var(--muted); stroke-dasharray: 4 3; }
  .carrier text { font-weight: 700; font-size: 13px; }
  .ion { fill: var(--muted); font-size: 11px; }
  .flow { animation: drift 1.6s linear infinite; }
  .flow.rev { animation-direction: reverse; }
  @keyframes drift { from { transform: translateX(-24px); } to { transform: translateX(24px); } }
  .curve { fill: none; stroke: var(--accent); stroke-width: 2; }
  .grid line { stroke: var(--border); }
`);

const W = 620;
const H = 200;
const MID = W / 2;
const TOP = 30;
const BOT = 170;
const BASE_W = 90; // depletion width (px) at zero bias

/** <pn-junction>: drag the bias and watch the depletion region and current. */
export class PnJunction extends Demo {
  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("pn.caption"), t("pn.captionHtml")));
    const pic = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    const ivPlot = svg("svg", {
      viewBox: "0 0 300 185",
      role: "img",
      style: "max-width: 320px",
    });
    const { label, input } = slider(
      t("pn.slider"),
      { min: -2, max: 0.8, step: 0.01, value: 0 },
      () => this.draw(),
    );
    const controls = document.createElement("div");
    controls.className = "controls";
    controls.append(label);
    const readout = document.createElement("ul");
    readout.className = "readout";
    readout.innerHTML = `<li><b>${t("pn.voltage")}</b><output data-v></output></li>
      <li><b>${t("pn.width")}</b><output data-w></output></li>
      <li><b>${t("pn.current")}</b><output data-i></output></li>`;
    const note = document.createElement("p");
    note.className = "note";
    note.setAttribute("aria-live", "polite");
    fig.append(wide(pic), controls, readout, ivPlot, note);
    this.root.append(fig);
    this.input = input;
    this.pic = pic;
    this.ivPlot = ivPlot;
    this.readout = readout;
    this.note = note;
    this.draw();
  }

  private input!: HTMLInputElement;
  private pic!: SVGSVGElement;
  private ivPlot!: SVGSVGElement;
  private readout!: HTMLElement;
  private note!: HTMLElement;

  private draw(): void {
    const v = Number(this.input.value);
    const w = BASE_W * depletionWidth(v);
    const state = junctionState(v);
    const p = this.pic;
    p.replaceChildren();
    p.setAttribute(
      "aria-label",
      t("pn.label", {
        v: v.toFixed(2),
        w: depletionWidth(v).toFixed(2),
        state: t(`pn.${state}`),
      }),
    );
    svg(
      "rect",
      { x: 10, y: TOP, width: MID - 10, height: BOT - TOP, class: "p" },
      p,
    );
    svg(
      "rect",
      { x: MID, y: TOP, width: MID - 10, height: BOT - TOP, class: "n" },
      p,
    );
    svg(
      "rect",
      { x: MID - w / 2, y: TOP, width: w, height: BOT - TOP, class: "depl" },
      p,
    );
    svg("text", { x: 20, y: TOP - 10, "font-weight": 600 }, p, t("pn.pSide"));
    svg(
      "text",
      { x: W - 20, y: TOP - 10, "text-anchor": "end", "font-weight": 600 },
      p,
      t("pn.nSide"),
    );
    svg(
      "text",
      { x: MID, y: BOT + 20, "text-anchor": "middle", class: "muted" },
      p,
      t("pn.depletion"),
    );

    // Fixed ions left behind inside the depletion region.
    for (let y = TOP + 18; y < BOT; y += 26) {
      for (let x = MID - w / 2 + 8; x < MID - 4; x += 16)
        svg("text", { x, y, class: "ion", "text-anchor": "middle" }, p, "⊖");
      for (let x = MID + 8; x < MID + w / 2 - 4; x += 16)
        svg("text", { x, y, class: "ion", "text-anchor": "middle" }, p, "⊕");
    }

    // Free carriers outside the depletion region.
    const rand = rng(7);
    const flowing = state === "conducting" && !reducedMotion();
    const holes = svg("g", { class: `carrier${flowing ? " flow" : ""}` }, p);
    const electrons = svg(
      "g",
      { class: `carrier${flowing ? " flow rev" : ""}` },
      p,
    );
    for (let i = 0; i < 26; i++) {
      const y = TOP + 12 + rand() * (BOT - TOP - 20);
      const hx = 20 + rand() * (MID - w / 2 - 34);
      const ex = MID + w / 2 + 14 + rand() * (MID - w / 2 - 34);
      svg("text", { x: hx, y, "text-anchor": "middle" }, holes, "+");
      svg("text", { x: ex, y, "text-anchor": "middle" }, electrons, "−");
    }

    const i = diodeCurrent(v);
    const out = (sel: string) =>
      this.readout.querySelector(`[${sel}]`) as HTMLOutputElement;
    out("data-v").value = `${v.toFixed(2)} V`;
    out("data-w").value = t("pn.resting", {
      n: depletionWidth(v).toFixed(2),
    });
    out("data-i").value = formatAmps(i);
    this.note.textContent = t(`pn.${state}`);
    this.drawIV(v);
  }

  private drawIV(v: number): void {
    const p = this.ivPlot;
    p.replaceChildren();
    p.setAttribute("aria-label", t("pn.ivLabel"));
    const x = (volts: number) => 40 + ((volts + 2) / 2.8) * 240;
    const imax = 0.01;
    const y = (amps: number) => 140 - Math.min(amps / imax, 1.05) * 120;
    const grid = svg("g", { class: "grid" }, p);
    svg("line", { x1: 40, x2: 280, y1: 140, y2: 140 }, grid);
    svg("line", { x1: x(0), x2: x(0), y1: 15, y2: 140 }, grid);
    svg(
      "text",
      { x: 280, y: 178, "text-anchor": "end", class: "muted" },
      p,
      t("pn.vAxis"),
    );
    svg(
      "text",
      { x: x(0) - 6, y: 18, "text-anchor": "end", class: "muted" },
      p,
      t("pn.iAxis"),
    );
    svg("text", { x: x(-2), y: 158, class: "muted" }, p, "−2 V");
    svg(
      "text",
      { x: x(0), y: 158, "text-anchor": "middle", class: "muted" },
      p,
      "0",
    );
    svg(
      "text",
      { x: x(0.7), y: 158, "text-anchor": "middle", class: "muted" },
      p,
      "0.7",
    );
    let d = "";
    for (let vv = -2; vv <= 0.8; vv += 0.01)
      d += `${d ? "L" : "M"}${x(vv).toFixed(1)},${y(diodeCurrent(vv)).toFixed(1)}`;
    svg("path", { d, class: "curve" }, p);
    svg(
      "circle",
      { cx: x(v), cy: y(diodeCurrent(v)), r: 6, fill: "var(--text)" },
      p,
    );
  }
}

customElements.define("pn-junction", PnJunction);
