// Draws a timing diagram ("waveform"): one row per signal, time left to
// right. 1-bit signals are square waves, buses labelled segments, unknown
// values hatched regions marked X, so shape and text carry the meaning,
// not colour alone.
import { svg } from "../components/kit";
import { t } from "../i18n";
import { segments, shortValue, type Signal } from "./waveform";

const LABEL_W = 64;
const STEP_W = 40;
const ROW_H = 28;
const TOP = 22;

export interface WaveOptions {
  /** Steps to mark as failing (✗ under the step number). */
  failed?: Set<number>;
  /** Step to highlight. */
  current?: number | null;
  /** Called with a step index when a step column is clicked. */
  pick?: (step: number) => void;
  /** First step's number, for labels (live history counts up). */
  first?: number;
}

/** Draws signals into a new SVG element. */
export function drawWaveform(
  signals: Signal[],
  steps: number,
  opts: WaveOptions = {},
): SVGSVGElement {
  const width = LABEL_W + steps * STEP_W + 8;
  const height = TOP + signals.length * ROW_H + 8;
  const root = svg("svg", {
    class: "waveform",
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    "aria-label": t("wave.label", {
      names: signals.map((x) => x.name).join(", "),
      n: steps,
    }),
  });
  const defs = svg("defs", {}, root);
  const hatch = svg(
    "pattern",
    {
      id: "wave-x",
      width: 6,
      height: 6,
      patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(45)",
    },
    defs,
  );
  svg("line", { x1: 0, y1: 0, x2: 0, y2: 6, class: "wave-hatch" }, hatch);
  const x = (step: number) => LABEL_W + step * STEP_W;
  const first = opts.first ?? 1;
  // Step columns: number, highlight, failure mark, click target.
  for (let i = 0; i < steps; i++) {
    const col = svg("g", { class: "wave-col" }, root);
    if (opts.current === i)
      svg(
        "rect",
        { x: x(i), y: 0, width: STEP_W, height, class: "wave-current" },
        col,
      );
    const failed = opts.failed?.has(i);
    svg(
      "text",
      {
        x: x(i) + STEP_W / 2,
        y: 14,
        "text-anchor": "middle",
        class: `wave-step${failed ? " bad" : ""}`,
      },
      col,
      failed ? `${i + first}✗` : String(i + first),
    );
    if (opts.pick) {
      const hit = svg(
        "rect",
        { x: x(i), y: 0, width: STEP_W, height, class: "wave-hit" },
        col,
      );
      svg("title", {}, hit, t("wave.replay", { n: i + first }));
      hit.addEventListener("click", () => opts.pick?.(i));
    }
  }
  signals.forEach((sig, r) => {
    const y0 = TOP + r * ROW_H;
    const hi = y0 + 5;
    const lo = y0 + ROW_H - 7;
    const mid = (hi + lo) / 2;
    if (sig.output && !signals[r - 1]?.output)
      svg(
        "line",
        { x1: 0, x2: width, y1: y0 - 1, y2: y0 - 1, class: "wave-divider" },
        root,
      );
    svg(
      "text",
      { x: 4, y: mid + 4, class: `wave-name${sig.output ? " out" : ""}` },
      root,
      sig.name,
    );
    const g = svg("g", { class: "wave-row" }, root);
    let prevY: number | null = null;
    for (const seg of segments(sig.values.slice(0, steps))) {
      const a = x(seg.from);
      const b = x(seg.to);
      if (seg.value === "") {
        prevY = null;
        continue;
      }
      if (
        seg.value === "X" ||
        (sig.width > 1 && shortValue(seg.value, sig.width) === "X")
      ) {
        svg(
          "rect",
          { x: a, y: hi, width: b - a, height: lo - hi, class: "wave-x" },
          g,
        );
        svg(
          "text",
          {
            x: (a + b) / 2,
            y: mid + 4,
            "text-anchor": "middle",
            class: "wave-val",
          },
          g,
          "X",
        );
        prevY = null;
        continue;
      }
      if (sig.width === 1) {
        const y = seg.value === "1" ? hi : lo;
        if (prevY !== null && prevY !== y)
          svg(
            "line",
            { x1: a, x2: a, y1: prevY, y2: y, class: "wave-line" },
            g,
          );
        svg(
          "line",
          { x1: a, x2: b, y1: y, y2: y, class: `wave-line v${seg.value}` },
          g,
        );
        prevY = y;
        continue;
      }
      // A bus: a segment with slanted ends, labelled with its value.
      const s = Math.min(4, (b - a) / 4);
      svg(
        "path",
        {
          d: `M${a},${mid} L${a + s},${hi} L${b - s},${hi} L${b},${mid} L${b - s},${lo} L${a + s},${lo} Z`,
          class: "wave-bus",
        },
        g,
      );
      svg(
        "text",
        {
          x: (a + b) / 2,
          y: mid + 4,
          "text-anchor": "middle",
          class: "wave-val",
        },
        g,
        shortValue(seg.value, sig.width),
      );
      prevY = null;
    }
  });
  return root;
}
