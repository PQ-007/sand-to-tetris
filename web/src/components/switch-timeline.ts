import { switchPicture } from "../demos/pictures";
import {
  comparedWith,
  factorOf,
  formatFactor,
  logPosition,
  SWITCHES,
  switchText,
} from "../demos/switches";
import { t } from "../i18n";
import { Demo, formatLength, formatTime, sheet, svg, wide } from "./kit";

const CSS = sheet(`
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.5rem; border: 0; padding: 0; margin: 0 0 1rem; }
  @container (max-width: 560px) { .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .tile { position: relative; display: block; }
  .tile input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
  .face { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; height: 100%; padding: 0.5rem 0.25rem 0.45rem; border: 1px solid var(--border); border-radius: var(--radius-sm); text-align: center; }
  .tile:hover .face { border-color: var(--border-strong); background: var(--surface-2); }
  .tile input:checked + .face { border-color: var(--text); box-shadow: inset 0 0 0 1px var(--text); background: var(--surface-2); }
  .tile input:focus-visible + .face { outline: 2px solid var(--focus); outline-offset: 2px; }
  .face svg { width: 100%; max-width: 5rem; }
  .name { font-size: 0.8125rem; font-weight: 600; line-height: 1.25; }
  .era { font: 0.6875rem var(--mono); color: var(--muted); }
  .pic { fill: none; stroke: var(--text); stroke-width: 1.25; stroke-linecap: round; stroke-linejoin: round; }
  .pic * { vector-effect: non-scaling-stroke; }
  .pic .f { fill: var(--surface); }
  .pic .g { fill: var(--surface-3); }
  .pic .g2 { fill: var(--surface-2); }
  .pic .k { fill: var(--text); stroke: none; }
  .pic .m { stroke: var(--faint); }
  .pic .h { stroke-width: 0.5; stroke: var(--faint); }
  .pic .d { stroke-dasharray: 3 2.5; }
  .pic .b { stroke-width: 2.5; }
  .axis line { stroke: var(--border-strong); }
  .dot { fill: var(--faint); }
  .dot.on { fill: var(--text); }
  .how { margin: 0.5rem 0 0; font-size: 0.9375rem; }
  .vs { margin-top: 1rem; padding-top: 0.875rem; border-top: 1px solid var(--border); }
  .vs-label { font-size: 0.8125rem; color: var(--muted); }
  .stats { display: flex; flex-wrap: wrap; gap: 0.5rem 2.5rem; margin-top: 0.25rem; }
  .stat b { font: 600 1.5rem/1.2 var(--mono); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .stat span { margin-left: 0.4rem; color: var(--muted); }
`);

const W = 640;
const AXES = [
  {
    key: "sizeM" as const,
    title: "sw.sizeAxis" as const,
    min: 1e-8,
    max: 1,
    ticks: [1e-8, 1e-6, 1e-4, 1e-2, 1],
    fmt: formatLength,
    y: 40,
  },
  {
    key: "switchTimeS" as const,
    title: "sw.timeAxis" as const,
    min: 1e-12,
    max: 1,
    ticks: [1e-12, 1e-9, 1e-6, 1e-3, 1],
    fmt: formatTime,
    y: 130,
  },
];
const tickLabel: Record<number, string> = {
  1e-8: "10 nm",
  1e-6: "1 µm",
  1e-4: "0.1 mm",
  1e-2: "1 cm",
  1: "1 m / 1 s",
  1e-12: "1 ps",
  1e-9: "1 ns",
  1e-3: "1 ms",
};

/** <switch-timeline>: gears → relays → tubes → transistors, on log scales. */
export class SwitchTimeline extends Demo {
  private selected = SWITCHES[1]!;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    const caption = document.createElement("figcaption");
    const strong = document.createElement("strong");
    strong.textContent = t("sw.caption");
    caption.append(strong, " ", t("sw.captionText"));
    fig.append(caption);

    // One tile per switch: its picture, name and era.
    const tiles = document.createElement("fieldset");
    tiles.className = "tiles";
    const legend = document.createElement("legend");
    legend.className = "visually-hidden";
    legend.textContent = t("sw.choose");
    tiles.append(legend);
    for (const s of SWITCHES) {
      const label = document.createElement("label");
      label.className = "tile";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "switch";
      input.value = s.id;
      input.checked = s === this.selected;
      input.addEventListener("change", () => {
        this.selected = s;
        this.update();
      });
      const face = document.createElement("span");
      face.className = "face";
      const pic = svg("svg", {
        viewBox: "0 0 80 56",
        class: "pic",
        "aria-hidden": "true",
      });
      pic.innerHTML = switchPicture(s.id);
      const name = document.createElement("span");
      name.className = "name";
      name.textContent = switchText(s, "name");
      const era = document.createElement("span");
      era.className = "era";
      era.textContent = switchText(s, "era");
      face.append(pic, name, era);
      label.append(input, face);
      tiles.append(label);
    }
    fig.append(tiles);

    const plot = svg("svg", { viewBox: `0 0 ${W} 180`, role: "img" });
    const frame = wide(plot);
    fig.append(frame);
    const how = document.createElement("p");
    how.className = "how";
    how.setAttribute("aria-live", "polite");
    fig.append(how);

    // The comparison as two numbers, not a sentence.
    const vs = document.createElement("div");
    vs.className = "vs";
    const vsLabel = document.createElement("div");
    vsLabel.className = "vs-label";
    const stats = document.createElement("div");
    stats.className = "stats";
    vs.append(vsLabel, stats);
    fig.append(vs);
    this.root.append(fig);

    this.update = () => {
      const s = this.selected;
      plot.replaceChildren();
      plot.setAttribute(
        "aria-label",
        t("sw.plotLabel", {
          name: switchText(s, "name"),
          size: formatLength(s.sizeM),
          time: formatTime(s.switchTimeS),
        }),
      );
      for (const axis of AXES) {
        const g = svg("g", { class: "axis" }, plot);
        const x0 = 40;
        const x1 = W - 40;
        svg(
          "text",
          { x: x0, y: axis.y - 18, "font-weight": 600 },
          g,
          t(axis.title),
        );
        svg(
          "line",
          { x1: x0, x2: x1, y1: axis.y, y2: axis.y, "stroke-width": 1.25 },
          g,
        );
        for (const tick of axis.ticks) {
          const x = x0 + logPosition(tick, axis.min, axis.max) * (x1 - x0);
          svg("line", { x1: x, x2: x, y1: axis.y - 4, y2: axis.y + 4 }, g);
          svg(
            "text",
            { x, y: axis.y + 18, "text-anchor": "middle", class: "muted" },
            g,
            tickLabel[tick] ?? "",
          );
        }
        for (const sw of SWITCHES) {
          if (sw === s) continue;
          const x =
            x0 + logPosition(sw[axis.key], axis.min, axis.max) * (x1 - x0);
          svg("circle", { cx: x, cy: axis.y, r: 4, class: "dot" }, g);
        }
        const x = x0 + logPosition(s[axis.key], axis.min, axis.max) * (x1 - x0);
        svg("circle", { cx: x, cy: axis.y, r: 8, class: "dot on" }, g);
        svg(
          "text",
          { x, y: axis.y + 36, "text-anchor": "middle", "font-weight": 600 },
          g,
          axis.fmt(s[axis.key]),
        );
      }
      how.textContent = switchText(s, "how");
      // On a narrow screen the chart scrolls sideways: bring the chosen
      // switch's dots into view.
      if (frame.scrollWidth > frame.clientWidth) {
        const p = logPosition(s.sizeM, AXES[0]!.min, AXES[0]!.max);
        const q = logPosition(s.switchTimeS, AXES[1]!.min, AXES[1]!.max);
        const mid = ((40 + ((p + q) / 2) * (W - 80)) / W) * frame.scrollWidth;
        frame.scrollLeft = mid - frame.clientWidth / 2;
      }

      const other = comparedWith(s);
      vsLabel.textContent = t(
        other === SWITCHES[0] ? "sw.vsGear" : "sw.vsToday",
      );
      const size = factorOf(s.sizeM, other.sizeM);
      const time = factorOf(s.switchTimeS, other.switchTimeS);
      stats.replaceChildren();
      for (const [f, word] of [
        [size, size.more ? "sw.bigger" : "sw.smaller"],
        [time, time.more ? "sw.slowerWord" : "sw.fasterWord"],
      ] as const) {
        const stat = document.createElement("div");
        stat.className = "stat";
        const b = document.createElement("b");
        b.textContent = formatFactor(f.factor);
        const span = document.createElement("span");
        span.textContent = t(word);
        stat.append(b, span);
        stats.append(stat);
      }
    };
    this.update();
  }

  private update: () => void = () => {};
}

customElements.define("switch-timeline", SwitchTimeline);
