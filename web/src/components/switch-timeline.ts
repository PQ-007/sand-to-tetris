import { compare, logPosition, SWITCHES, switchText } from "../demos/switches";
import { t } from "../i18n";
import { Demo, chips, formatLength, formatTime, sheet, svg, wide } from "./kit";

const CSS = sheet(`
  .card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 3px; padding: 0.85rem 1rem; margin-top: 0.75rem; }
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
  private other = SWITCHES[SWITCHES.length - 1]!;

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
    fig.append(
      chips(
        t("sw.choose"),
        "switch",
        SWITCHES.map((s) => ({
          value: s.id,
          label: `${switchText(s, "name")} (${switchText(s, "era")})`,
        })),
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
    label.textContent = t("sw.compareWith");
    const select = document.createElement("select");
    for (const s of SWITCHES)
      select.add(
        new Option(switchText(s, "name"), s.id, false, s === this.other),
      );
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
      h.textContent = `${switchText(s, "name")} · ${switchText(s, "era")}`;
      const how = document.createElement("p");
      how.textContent = switchText(s, "how");
      const ex = document.createElement("p");
      ex.className = "muted";
      ex.textContent = t("sw.example", {
        example: switchText(s, "example"),
        size: formatLength(s.sizeM),
        time: formatTime(s.switchTimeS),
      });
      card.append(h, how, ex);
      sentence.textContent =
        s === this.other ? t("sw.pickOther") : compare(s, this.other);
    };
    this.update();
  }

  private update: () => void = () => {};
}

customElements.define("switch-timeline", SwitchTimeline);
