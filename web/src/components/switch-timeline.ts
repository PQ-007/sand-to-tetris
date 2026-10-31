import { compare, logPosition, SWITCHES } from "../demos/switches";
import { Demo, chips, formatLength, formatTime, sheet, svg, wide } from "./kit";

const CSS = sheet(`
  .card { background: var(--bg); border-radius: 0.5rem; padding: 0.75rem 1rem; margin-top: 0.75rem; }
  .card h3 { margin: 0 0 0.25rem; font-size: 1.0625rem; }
  .card p { margin: 0.25rem 0; }
  .compare { margin-top: 0.75rem; }
  .axis line { stroke: var(--border); }
  .dot { fill: var(--muted); }
  .dot.on { fill: var(--accent); }
`);

const W = 640;
const AXES = [
  {
    key: "sizeM" as const,
    title: "Size of one switch",
    min: 1e-8,
    max: 1,
    ticks: [1e-8, 1e-6, 1e-4, 1e-2, 1],
    fmt: formatLength,
    y: 40,
  },
  {
    key: "switchTimeS" as const,
    title: "Time to flip once",
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
  private other = SWITCHES[SWITCHES.length - 1]!;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.innerHTML = `<figcaption><strong>Switches through time</strong>
      Pick a switch to see its rough size and speed. Both scales are logarithmic:
      each step along an axis is 100 or 1,000 times bigger than the last.</figcaption>`;
    fig.append(
      chips(
        "Choose a switch",
        "switch",
        SWITCHES.map((s) => ({ value: s.id, label: `${s.name} (${s.era})` })),
        this.selected.id,
        (id) => {
          this.selected = SWITCHES.find((s) => s.id === id) ?? this.selected;
          this.update();
        },
      ),
    );
    const plot = svg("svg", { viewBox: `0 0 ${W} 180`, role: "img" });
    fig.append(wide(plot));
    const card = document.createElement("div");
    card.className = "card";
    card.setAttribute("aria-live", "polite");
    fig.append(card);

    const cmp = document.createElement("p");
    cmp.className = "compare";
    const label = document.createElement("label");
    label.textContent = "Compare with ";
    const select = document.createElement("select");
    for (const s of SWITCHES)
      select.add(new Option(s.name, s.id, false, s === this.other));
    select.addEventListener("change", () => {
      this.other = SWITCHES.find((s) => s.id === select.value) ?? this.other;
      this.update();
    });
    label.append(select);
    const sentence = document.createElement("output");
    sentence.style.display = "block";
    sentence.style.marginTop = "0.5rem";
    cmp.append(label, sentence);
    fig.append(cmp);
    this.root.append(fig);

    this.update = () => {
      const s = this.selected;
      plot.replaceChildren();
      plot.setAttribute(
        "aria-label",
        `${s.name}: size ${formatLength(s.sizeM)}, switching time ${formatTime(s.switchTimeS)}`,
      );
      for (const axis of AXES) {
        const g = svg("g", { class: "axis" }, plot);
        const x0 = 40;
        const x1 = W - 40;
        svg(
          "text",
          { x: x0, y: axis.y - 18, "font-weight": 600 },
          g,
          axis.title,
        );
        svg(
          "line",
          { x1: x0, x2: x1, y1: axis.y, y2: axis.y, "stroke-width": 2 },
          g,
        );
        for (const t of axis.ticks) {
          const x = x0 + logPosition(t, axis.min, axis.max) * (x1 - x0);
          svg("line", { x1: x, x2: x, y1: axis.y - 4, y2: axis.y + 4 }, g);
          svg(
            "text",
            { x, y: axis.y + 18, "text-anchor": "middle", class: "muted" },
            g,
            tickLabel[t] ?? "",
          );
        }
        for (const sw of SWITCHES) {
          const x =
            x0 + logPosition(sw[axis.key], axis.min, axis.max) * (x1 - x0);
          const on = sw === s;
          svg(
            "circle",
            { cx: x, cy: axis.y, r: on ? 9 : 5, class: on ? "dot on" : "dot" },
            g,
          );
        }
        const x = x0 + logPosition(s[axis.key], axis.min, axis.max) * (x1 - x0);
        svg(
          "text",
          { x, y: axis.y + 36, "text-anchor": "middle", "font-weight": 600 },
          g,
          axis.fmt(s[axis.key]),
        );
      }
      card.innerHTML = "";
      const h = document.createElement("h3");
      h.textContent = `${s.name} · ${s.era}`;
      const how = document.createElement("p");
      how.textContent = s.how;
      const ex = document.createElement("p");
      ex.className = "muted";
      ex.textContent = `Example: ${s.example}. Size ${formatLength(s.sizeM)}, flips in ${formatTime(s.switchTimeS)}.`;
      card.append(h, how, ex);
      sentence.textContent =
        s === this.other
          ? "Pick a different switch to compare."
          : compare(s, this.other);
    };
    this.update();
  }

  private update: () => void = () => {};
}

customElements.define("switch-timeline", SwitchTimeline);
