// Line drawings for the Chapter 0 demos: one per switch in the timeline and
// one per step from sand to wafer. Pure: SVG markup on an 80 × 56 grid,
// drawn in the demos' ink (classes styled by the component). The words
// beside each picture are the text; the drawings are decorative.

type Pt = [number, number];

const n = (v: number) => Math.round(v * 100) / 100;
const c = (cls?: string) => (cls ? ` class="${cls}"` : "");
const line = (pts: Pt[], cls?: string) =>
  `<path d="M${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(" L")}"${c(cls)}/>`;
const path = (d: string, cls?: string) => `<path d="${d}"${c(cls)}/>`;
const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  cls?: string,
  r = 0,
) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${r}"` : ""}${c(cls)}/>`;
const circle = (x: number, y: number, r: number, cls?: string) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"${c(cls)}/>`;
const dot = (x: number, y: number, r = 1.6) => circle(x, y, r, "k");

function arrow(a: Pt, b: Pt, cls?: string): string {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const head = (d: number): Pt => [
    b[0] - 4.5 * Math.cos(ang + d),
    b[1] - 4.5 * Math.sin(ang + d),
  ];
  return line([a, b], cls) + line([head(0.45), b, head(-0.45)], cls);
}

/** A toothed wheel. */
function gear(
  cx: number,
  cy: number,
  teeth: number,
  rOut: number,
  rIn: number,
): string {
  const pts: Pt[] = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = (2 * Math.PI * i) / teeth;
    const step = (2 * Math.PI) / teeth;
    for (const [f, r] of [
      [0, rIn],
      [0.15, rOut],
      [0.45, rOut],
      [0.6, rIn],
    ] as const)
      pts.push([
        cx + r * Math.cos(a0 + f * step),
        cy + r * Math.sin(a0 + f * step),
      ]);
  }
  return (
    line([...pts, pts[0] as Pt], "f") +
    circle(cx, cy, rIn * 0.55) +
    circle(cx, cy, 2.5, "k")
  );
}

const SWITCH: Record<string, () => string> = {
  // Two meshing wheels: one turning a step moves the next.
  gear: () =>
    gear(30, 28, 12, 18, 14) +
    gear(58, 34, 8, 12, 9.5) +
    path("M18,8 A22,22 0 0 0 10,20", "m") +
    line(
      [
        [10, 20],
        [9, 15],
      ],
      "m",
    ) +
    line(
      [
        [10, 20],
        [14, 17],
      ],
      "m",
    ),
  // A coil and its iron core pull a springy arm onto a contact.
  relay: () => {
    let coil = "";
    for (let i = 0; i < 6; i++) coil += `A3,3 0 0 1 ${14 + (i + 1) * 6},44 `;
    return (
      rect(12, 32, 38, 5, "g") +
      path(`M14,44 ${coil}`) +
      line([
        [6, 44],
        [14, 44],
      ]) +
      line([
        [50, 44],
        [58, 44],
      ]) +
      line([
        [48, 12],
        [48, 22],
      ]) +
      dot(48, 12) +
      line([
        [48, 12],
        [72, 18],
      ]) +
      dot(74, 26) +
      line([
        [74, 26],
        [74, 36],
      ]) +
      arrow([62, 30], [62, 19], "m")
    );
  },
  // A glass bulb: plate on top, a grid of fine wire, the hot cathode below.
  tube: () =>
    path("M26,52 V22 A14,14 0 0 1 54,22 V52 Z", "f") +
    line([
      [32, 18],
      [48, 18],
    ]) +
    line([
      [40, 18],
      [40, 8],
    ]) +
    line(
      [
        [31, 31],
        [49, 31],
      ],
      "d",
    ) +
    line([
      [20, 31],
      [31, 31],
    ]) +
    path("M33,44 Q40,38 47,44") +
    line([
      [33, 44],
      [33, 52],
    ]) +
    line([
      [47, 44],
      [47, 52],
    ]) +
    line([
      [30, 52],
      [30, 56],
    ]) +
    line([
      [40, 52],
      [40, 56],
    ]) +
    line([
      [50, 52],
      [50, 56],
    ]),
  // Bell Labs' point contact: a plastic wedge pressing two gold contacts
  // onto a slab of germanium.
  "transistor-1947": () =>
    rect(16, 38, 48, 10, "g2") +
    path("M40,37 L27,12 H53 Z", "f") +
    line([
      [36, 37],
      [30, 25],
    ]) +
    line([
      [44, 37],
      [50, 25],
    ]) +
    line([
      [33, 18],
      [14, 6],
    ]) +
    line([
      [47, 18],
      [66, 6],
    ]) +
    line([
      [40, 48],
      [40, 55],
    ]) +
    dot(36, 37, 1.3) +
    dot(44, 37, 1.3),
  // A chip in its package: the transistors are inside, too small to see.
  "transistor-1971": () => {
    let out = rect(16, 16, 48, 24, "f", 2) + path("M36,16 A4,4 0 0 0 44,16");
    for (let i = 0; i < 8; i++) {
      const x = 20 + i * 5.7;
      out +=
        line([
          [x, 16],
          [x, 9],
        ]) +
        line([
          [x, 40],
          [x, 47],
        ]);
    }
    return out + rect(29, 23, 22, 10, "g2");
  },
  // Today: a die where billions of transistors make a grid too fine to see.
  "transistor-today": () => {
    let out = rect(22, 6, 36, 36, "f", 1);
    for (let i = 1; i < 12; i++) {
      out += line(
        [
          [22 + i * 3, 6],
          [22 + i * 3, 42],
        ],
        "h",
      );
      out += line(
        [
          [22, 6 + i * 3],
          [58, 6 + i * 3],
        ],
        "h",
      );
    }
    for (let i = 0; i < 6; i++) {
      out +=
        line([
          [26 + i * 6, 42],
          [26 + i * 6, 47],
        ]) +
        line([
          [26 + i * 6, 6],
          [26 + i * 6, 1],
        ]);
      out +=
        line([
          [22, 10 + i * 6],
          [17, 10 + i * 6],
        ]) +
        line([
          [58, 10 + i * 6],
          [63, 10 + i * 6],
        ]);
    }
    return out + rect(35, 19, 10, 10, "k");
  },
};

const WAFER: Record<string, () => string> = {
  // A heap of quartz sand.
  sand: () => {
    let out =
      path("M6,50 Q40,8 74,50 Z", "g2") +
      line([
        [2, 50],
        [78, 50],
      ]);
    const grains: Pt[] = [
      [26, 42],
      [34, 36],
      [42, 40],
      [50, 34],
      [38, 30],
      [30, 46],
      [46, 46],
      [56, 44],
      [20, 46],
      [44, 26],
      [60, 47],
      [36, 45],
    ];
    for (const [x, y] of grains) out += dot(x, y, 1.1);
    return out;
  },
  // Electrodes reach into the charge; liquid silicon pools at the bottom.
  furnace: () =>
    path("M14,54 V22 H66 V54 Z", "f") +
    rect(16, 44, 48, 8, "k") +
    [28, 40, 52]
      .map(
        (x) =>
          rect(x - 2.5, 4, 5, 26, "g", 1) +
          path(`M${x},31 l-3,4 l5,2 l-3,4`, "m"),
      )
      .join(""),
  // A flask boils, the vapour runs down a cooler tube and drips out pure.
  trichlorosilane: () =>
    circle(22, 40, 12, "f") +
    path("M16,44 Q22,40 28,44 Q22,50 16,44", "g") +
    line([
      [19, 29],
      [19, 16],
    ]) +
    line([
      [25, 29],
      [25, 16],
    ]) +
    line([
      [19, 16],
      [25, 16],
    ]) +
    line([
      [25, 19],
      [58, 33],
    ]) +
    line([
      [25, 23],
      [58, 37],
    ]) +
    rect(54, 40, 18, 14, "f", 1) +
    rect(55, 47, 16, 6, "g") +
    dot(64, 41, 1.2) +
    dot(64, 37.5, 1),
  // A bell jar: silicon builds up on a hot U-shaped rod.
  siemens: () =>
    path("M14,52 V24 A26,18 0 0 1 66,24 V52", "f") +
    line([
      [8, 52],
      [72, 52],
    ]) +
    path("M30,52 V18 H50 V52", "b") +
    path("M34,52 V22 H46 V52") +
    arrow([4, 44], [14, 44], "m") +
    dot(26, 30, 1) +
    dot(54, 26, 1) +
    dot(28, 40, 1),
  // A seed pulls one crystal up out of the melt, turning as it goes.
  czochralski: () =>
    path("M18,34 V52 H62 V34", "f") +
    rect(20, 42, 40, 9, "g") +
    path("M37,42 L35,32 Q34,14 40,12 Q46,14 45,32 L43,42 Z", "g2") +
    line([
      [40, 12],
      [40, 2],
    ]) +
    path("M50,6 A10,3 0 1 1 30,6", "m") +
    arrow([62, 20], [62, 8], "m"),
  // A polished wafer, with the chips that will be built on it.
  slice: () => {
    let out = path("M30,52 A24,24 0 1 1 50,52 Z", "f");
    for (let gx = 0; gx < 8; gx++)
      for (let gy = 0; gy < 8; gy++) {
        const x = 21 + gx * 5;
        const y = 5 + gy * 5;
        const inside = [
          [x, y],
          [x + 4, y],
          [x, y + 4],
          [x + 4, y + 4],
        ].every(
          ([px, py]) =>
            Math.hypot((px ?? 0) - 40, (py ?? 0) - 30) < 22 && (py ?? 0) < 50,
        );
        if (inside) out += rect(x, y, 4, 4, "g2");
      }
    return out + path("M24,20 A20,20 0 0 1 34,10", "m");
  },
};

/** The ids that have a picture. */
export const SWITCH_PICTURES: readonly string[] = Object.keys(SWITCH);
export const WAFER_PICTURES: readonly string[] = Object.keys(WAFER);

/** A drawing as the inside of an `<svg viewBox="0 0 80 56">`, or "". */
export function switchPicture(id: string): string {
  return SWITCH[id]?.() ?? "";
}

export function waferPicture(id: string): string {
  return WAFER[id]?.() ?? "";
}
