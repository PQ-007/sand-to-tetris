import {
  channelStrength,
  drainCurrent,
  formatAmps,
  isOn,
  type MosType,
  VDD,
  VTH,
} from "../demos/semiconductor";
import { Demo, chips, sheet, slider, svg, wide } from "./kit";

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
    fig.innerHTML = `<figcaption><strong>A MOSFET: a switch with no moving parts</strong>
      A thin layer of glass-like oxide separates the gate from the silicon. Voltage on
      the gate pulls carriers up to the surface, forming a <em>channel</em> that connects
      source to drain. Drag the gate voltage.</figcaption>`;
    fig.append(
      chips(
        "Transistor type",
        "mostype",
        [
          { value: "nmos", label: "NMOS (n-channel)" },
          { value: "pmos", label: "PMOS (p-channel)" },
        ],
        this.type,
        (t) => {
          this.type = t as MosType;
          this.draw();
        },
      ),
    );
    this.pic = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    const { label } = slider(
      "Gate voltage",
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
    this.readout.innerHTML = `<li><b>Gate</b><output data-g></output></li>
      <li><b>Switch</b><output data-s class="state"></output></li>
      <li><b>Current, source → drain</b><output data-i></output></li>`;
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
    const t = this.type;
    const g = this.gate;
    const on = isOn(t, g);
    const strength = channelStrength(t, g);
    const body = t === "nmos" ? "p" : "n";
    const wells = t === "nmos" ? "n" : "p";
    const carrier = t === "nmos" ? "−" : "+";
    const sourceV = t === "nmos" ? "0 V" : `${VDD} V`;

    const p = this.pic;
    p.replaceChildren();
    p.setAttribute(
      "aria-label",
      `${t.toUpperCase()} transistor, gate at ${g.toFixed(2)} volts: switch ${on ? "on, channel formed" : "off, no channel"}.`,
    );
    const subY = 110;
    svg("rect", { x: 20, y: subY, width: W - 40, height: 120, class: body }, p);
    svg(
      "text",
      { x: W / 2, y: 220, "text-anchor": "middle", "font-weight": 600 },
      p,
      `${body}-type silicon (the body)`,
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
      `${wells}+ source`,
    );
    svg(
      "text",
      { x: W - 135, y: subY + 34, "text-anchor": "middle", "font-weight": 600 },
      p,
      `${wells}+ drain`,
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
      `gate: ${g.toFixed(2)} V`,
    );
    svg("text", { x: W / 2 + 114, y: subY - 2, class: "muted" }, p, "oxide");
    // Terminals.
    svg("path", { d: `M135,${subY} V30 H90`, class: "wire" }, p);
    svg(
      "text",
      { x: 84, y: 34, "text-anchor": "end" },
      p,
      `source: ${sourceV}`,
    );
    svg("path", { d: `M${W - 135},${subY} V30 H${W - 90}`, class: "wire" }, p);
    svg("text", { x: W - 84, y: 34 }, p, "drain");
    svg("path", { d: `M${W / 2},${subY - 40} V20`, class: "wire" }, p);
    svg("text", { x: W / 2, y: 14, "text-anchor": "middle" }, p, "gate");

    const out = (sel: string) =>
      this.readout.querySelector(`[${sel}]`) as HTMLOutputElement;
    out("data-g").value = `${g.toFixed(2)} V`;
    out("data-s").value = on ? "ON (closed)" : "OFF (open)";
    out("data-i").value = formatAmps(drainCurrent(t, g));

    this.note.textContent =
      t === "nmos"
        ? on
          ? `Gate is more than ${VTH} V above the source: electrons gather under the oxide and form an n-type channel. Current flows.`
          : `Gate is below the threshold (${VTH} V): no channel, so the switch is open. Only a tiny leakage current flows.`
        : on
          ? `Gate is at least ${VTH} V below the source (${VDD} V): holes gather under the oxide and form a p-type channel. Current flows. A PMOS turns on when its gate is LOW.`
          : `Gate is too close to the source voltage (${VDD} V): no channel. A PMOS is off when its gate is HIGH, the opposite of an NMOS.`;
    this.drawPlot();
  }

  private drawPlot(): void {
    const p = this.plot;
    p.replaceChildren();
    p.setAttribute(
      "aria-label",
      "Graph of current against gate voltage on a logarithmic scale, spanning more than a million-fold between off and on.",
    );
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
      "gate voltage →",
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
      "each gridline: 1,000× more current",
    );
  }
}

customElements.define("mosfet-demo", MosfetDemo);
