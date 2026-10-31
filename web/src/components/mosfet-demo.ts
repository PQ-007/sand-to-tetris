import {
  channelStrength,
  drainCurrent,
  formatAmps,
  isOn,
  type MosType,
  VDD,
  VTH,
} from "../demos/semiconductor";
import { t } from "../i18n";
import { Demo, chips, figcaption, sheet, slider, svg, wide } from "./kit";

const CSS = sheet(`
  .p { fill: var(--p-type); }
  .n { fill: var(--n-type); }
  .oxide { fill: var(--oxide); }
  .gate { fill: var(--metal); }
  .channel { fill: var(--channel); }
  .wire { stroke: var(--text); stroke-width: 2; fill: none; }
  .curve { fill: none; stroke: var(--accent); stroke-width: 2; }
  .grid line { stroke: var(--border); }
  .state { font-weight: 700; }
`);

const W = 600;
const H = 250;

/** <mosfet-demo type="nmos|pmos">: gate voltage opens and closes the channel. */
export class MosfetDemo extends Demo {
  private type: MosType = "nmos";
  private gate = 0;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    this.type = this.getAttribute("type") === "pmos" ? "pmos" : "nmos";
    const fig = document.createElement("figure");
    fig.append(figcaption(t("mos.caption"), t("mos.captionHtml")));
    fig.append(
      chips(
        t("mos.type"),
        "mostype",
        [
          { value: "nmos", label: t("mos.nmos") },
          { value: "pmos", label: t("mos.pmos") },
        ],
        this.type,
        (v) => {
          this.type = v as MosType;
          this.draw();
        },
      ),
    );
    this.pic = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    const { label } = slider(
      t("mos.gateSlider"),
      { min: 0, max: VDD, step: 0.05, value: 0 },
      (v) => {
        this.gate = v;
        this.draw();
      },
    );
    const controls = document.createElement("div");
    controls.className = "controls";
    controls.append(label);
    this.readout = document.createElement("ul");
    this.readout.className = "readout";
    this.readout.innerHTML = `<li><b>${t("mos.gate")}</b><output data-g></output></li>
      <li><b>${t("mos.switch")}</b><output data-s class="state"></output></li>
      <li><b>${t("mos.current")}</b><output data-i></output></li>`;
    this.plot = svg("svg", {
      viewBox: "0 0 320 180",
      role: "img",
      style: "max-width: 340px",
    });
    this.note = document.createElement("p");
    this.note.className = "note";
    this.note.setAttribute("aria-live", "polite");
    fig.append(wide(this.pic), controls, this.readout, this.plot, this.note);
    this.root.append(fig);
    this.draw();
  }

  private pic!: SVGSVGElement;
  private plot!: SVGSVGElement;
  private readout!: HTMLElement;
  private note!: HTMLElement;

  private draw(): void {
    const kind = this.type;
    const g = this.gate;
    const on = isOn(kind, g);
    const strength = channelStrength(kind, g);
    const body = kind === "nmos" ? "p" : "n";
    const wells = kind === "nmos" ? "n" : "p";
    const carrier = kind === "nmos" ? "−" : "+";
    const sourceV = kind === "nmos" ? "0 V" : `${VDD} V`;

    const p = this.pic;
    p.replaceChildren();
    p.setAttribute(
      "aria-label",
      t("mos.label", {
        type: kind.toUpperCase(),
        g: g.toFixed(2),
        state: t(on ? "mos.stateOn" : "mos.stateOff"),
      }),
    );
    const subY = 110;
    svg("rect", { x: 20, y: subY, width: W - 40, height: 120, class: body }, p);
    svg(
      "text",
      { x: W / 2, y: 220, "text-anchor": "middle", "font-weight": 600 },
      p,
      t("mos.body", { body }),
    );
    // Source and drain regions.
    svg(
      "rect",
      { x: 70, y: subY, width: 130, height: 55, rx: 10, class: wells },
      p,
    );
    svg(
      "rect",
      { x: W - 200, y: subY, width: 130, height: 55, rx: 10, class: wells },
      p,
    );
    svg(
      "text",
      { x: 135, y: subY + 34, "text-anchor": "middle", "font-weight": 600 },
      p,
      t("mos.source", { wells }),
    );
    svg(
      "text",
      { x: W - 135, y: subY + 34, "text-anchor": "middle", "font-weight": 600 },
      p,
      t("mos.drain", { wells }),
    );
    // Channel: appears as gate voltage passes threshold.
    svg(
      "rect",
      {
        x: 200,
        y: subY,
        width: W - 400,
        height: 4 + 12 * strength,
        class: "channel",
        opacity: strength > 0 ? 0.35 + 0.65 * strength : 0,
      },
      p,
    );
    for (let i = 0; i < Math.round(strength * 10); i++) {
      svg(
        "text",
        {
          x: 212 + i * 18,
          y: subY + 13,
          "font-weight": 700,
          "text-anchor": "middle",
        },
        p,
        carrier,
      );
    }
    // Oxide and gate.
    svg(
      "rect",
      { x: 190, y: subY - 10, width: W - 380, height: 10, class: "oxide" },
      p,
    );
    svg(
      "rect",
      { x: 190, y: subY - 40, width: W - 380, height: 30, class: "gate" },
      p,
    );
    svg(
      "text",
      {
        x: W / 2,
        y: subY - 20,
        "text-anchor": "middle",
        fill: "var(--on-metal)",
        "font-weight": 600,
      },
      p,
      t("mos.gateV", { v: g.toFixed(2) }),
    );
    svg(
      "text",
      { x: W / 2 + 114, y: subY - 2, class: "muted" },
      p,
      t("mos.oxide"),
    );
    // Terminals.
    svg("path", { d: `M135,${subY} V30 H90`, class: "wire" }, p);
    svg(
      "text",
      { x: 84, y: 34, "text-anchor": "end" },
      p,
      t("mos.sourceV", { v: sourceV }),
    );
    svg("path", { d: `M${W - 135},${subY} V30 H${W - 90}`, class: "wire" }, p);
    svg("text", { x: W - 84, y: 34 }, p, t("mos.drainLabel"));
    svg("path", { d: `M${W / 2},${subY - 40} V20`, class: "wire" }, p);
    svg(
      "text",
      { x: W / 2, y: 14, "text-anchor": "middle" },
      p,
      t("mos.gateLabel"),
    );

    const out = (sel: string) =>
      this.readout.querySelector(`[${sel}]`) as HTMLOutputElement;
    out("data-g").value = `${g.toFixed(2)} V`;
    out("data-s").value = t(on ? "mos.on" : "mos.off");
    out("data-i").value = formatAmps(drainCurrent(kind, g));

    this.note.textContent = t(`mos.${kind}${on ? "On" : "Off"}`, {
      vth: VTH,
      vdd: VDD,
    });
    this.drawPlot();
  }

  private drawPlot(): void {
    const p = this.plot;
    p.replaceChildren();
    p.setAttribute("aria-label", t("mos.plotLabel"));
    const x = (v: number) => 50 + (v / VDD) * 250;
    const lo = -14;
    const hi = -2;
    const y = (a: number) =>
      150 - ((Math.log10(Math.max(a, 1e-14)) - lo) / (hi - lo)) * 135;
    const grid = svg("g", { class: "grid" }, p);
    for (let e = lo; e <= hi; e += 3) {
      svg("line", { x1: 50, x2: 300, y1: y(10 ** e), y2: y(10 ** e) }, grid);
      svg(
        "text",
        { x: 46, y: y(10 ** e) + 4, "text-anchor": "end", class: "muted" },
        p,
        `1e${e} A`,
      );
    }
    svg(
      "text",
      { x: 300, y: 172, "text-anchor": "end", class: "muted" },
      p,
      t("mos.gAxis"),
    );
    svg("text", { x: x(0), y: 172, class: "muted" }, p, "0 V");
    let d = "";
    for (let v = 0; v <= VDD + 1e-9; v += 0.02)
      d += `${d ? "L" : "M"}${x(v).toFixed(1)},${y(drainCurrent(this.type, v)).toFixed(1)}`;
    svg("path", { d, class: "curve" }, p);
    svg(
      "circle",
      {
        cx: x(this.gate),
        cy: y(drainCurrent(this.type, this.gate)),
        r: 6,
        fill: "var(--text)",
      },
      p,
    );
    svg(
      "text",
      { x: 300, y: 12, "text-anchor": "end", class: "muted" },
      p,
      t("mos.grid"),
    );
  }
}

customElements.define("mosfet-demo", MosfetDemo);
