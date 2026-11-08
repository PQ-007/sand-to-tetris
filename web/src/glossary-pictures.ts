// Small line drawings for glossary entries, drawn for this course: the
// thing itself (a gate, a clock wave, a stack), in the site's hairline ink,
// beside the words. Pure: each is SVG markup on a 160 × 90 grid. Only terms
// a picture helps get one; the definition beside it is the text (so the
// drawing is hidden from screen readers). Labels are symbols, numbers,
// pin names and code; the few words go through `word` (i18n `pic.<word>`).

type Pt = [number, number];

/** The words a picture may show, translated as i18n `pic.<word>`. */
export const PICTURE_WORDS = [
  "on",
  "off",
  "program",
  "data",
  "back",
  "front",
  "fetch",
  "decode",
  "execute",
  "input",
  "update",
  "draw",
  "logic",
  "memory",
] as const;
export type PictureWord = (typeof PICTURE_WORDS)[number];

let word: (w: PictureWord) => string = (w) => w;

const n = (v: number) => Math.round(v * 100) / 100;
const cls = (c?: string) => (c ? ` class="${c}"` : "");

/** A path through points (`M` then `L`s). */
const line = (pts: Pt[], c?: string) =>
  `<path d="M${pts.map(([x, y]) => `${n(x)},${n(y)}`).join(" L")}"${cls(c)}/>`;
const path = (d: string, c?: string) => `<path d="${d}"${cls(c)}/>`;
const rect = (x: number, y: number, w: number, h: number, c?: string, r = 0) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${r ? ` rx="${r}"` : ""}${cls(c)}/>`;
const circle = (x: number, y: number, r: number, c?: string) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"${cls(c)}/>`;
const dot = (x: number, y: number) => circle(x, y, 1.8, "k");
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Text; `a` is the anchor (s)tart, (m)iddle or (e)nd. */
const text = (x: number, y: number, s: string, a = "m", c?: string) =>
  `<text x="${n(x)}" y="${n(y)}" text-anchor="${a === "s" ? "start" : a === "e" ? "end" : "middle"}"${cls(c)}>${esc(s)}</text>`;

/** A line with an open arrowhead at its end. */
function arrow(a: Pt, b: Pt, c?: string): string {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const head = (d: number): Pt => [
    b[0] - 5 * Math.cos(ang + d),
    b[1] - 5 * Math.sin(ang + d),
  ];
  return line([a, b], c) + line([head(0.45), b, head(-0.45)], c);
}

type GateKind = "and" | "or" | "xor" | "not";

/**
 * A gate symbol (the editor's shapes, from symbols.ts) centred at x, y,
 * scaled by s. Returns the markup and where its leads attach.
 */
function gate(x: number, y: number, kind: GateKind, invert = false, s = 1) {
  const body =
    kind === "not"
      ? "M-18,-15 L14,0 L-18,15 Z"
      : kind === "and"
        ? "M-20,-20 H0 A20,20 0 0 1 0,20 H-20 Z"
        : "M-24,-20 Q-12,0 -24,20 Q6,20 20,0 Q6,-20 -24,-20 Z";
  const extra = kind === "xor" ? `<path d="M-30,-20 Q-18,0 -30,20"/>` : "";
  const tip = kind === "not" ? 14 : 20;
  const bubble = invert
    ? `<circle cx="${tip + 4}" cy="0" r="4" class="f"/>`
    : "";
  const back = kind === "not" ? -18 : kind === "and" ? -20 : -19;
  return {
    svg: `<g transform="translate(${n(x)} ${n(y)}) scale(${s})" class="sym"><path d="${body}" class="f"/>${extra}${bubble}</g>`,
    inX: x + back * s,
    outX: x + (tip + (invert ? 8 : 0)) * s,
    dy: 8 * s,
  };
}

/** A gate with its input and output leads and labels. */
function wiredGate(
  x: number,
  y: number,
  kind: GateKind,
  invert: boolean,
  s: number,
  label?: string,
): string {
  const g = gate(x, y, kind, invert, s);
  const ins = kind === "not" ? [y] : [y - g.dy, y + g.dy];
  return (
    ins
      .map((iy) =>
        line([
          [g.inX - 14 * s, iy],
          [g.inX, iy],
        ]),
      )
      .join("") +
    line([
      [g.outX, y],
      [g.outX + 14 * s, y],
    ]) +
    g.svg +
    (label ? text(x, y + 30 * s + 6, label, "m", "tk") : "")
  );
}

/** A MOSFET symbol: channel at x, centred on yc; leads end 20 above/below. */
function fet(x: number, yc: number, p: boolean, lead = 22): string {
  return (
    line([
      [x, yc - 11],
      [x, yc + 11],
    ]) +
    line([
      [x - 5, yc - 9],
      [x - 5, yc + 9],
    ]) +
    line([
      [x, yc - 8],
      [x + 8, yc - 8],
      [x + 8, yc - 20],
    ]) +
    line([
      [x, yc + 8],
      [x + 8, yc + 8],
      [x + 8, yc + 20],
    ]) +
    (p
      ? circle(x - 8.5, yc, 3.2) +
        line([
          [x - 11.7, yc],
          [x - lead, yc],
        ])
      : line([
          [x - 5, yc],
          [x - lead, yc],
        ]))
  );
}

/** A CMOS inverter; `hl` boxes the pull-up or pull-down half. */
function inverter(hl?: "up" | "down"): string {
  const x = 84;
  const box =
    hl === "up"
      ? rect(54, 9, 54, 31, "d", 3)
      : hl === "down"
        ? rect(54, 50, 54, 31, "d", 3)
        : "";
  return (
    box +
    line([
      [80, 4],
      [104, 4],
    ]) +
    text(108, 7, "VDD", "s") +
    fet(x, 24, true) +
    fet(x, 66, false) +
    line([
      [92, 44],
      [92, 46],
    ]) +
    line([
      [92, 45],
      [132, 45],
    ]) +
    dot(92, 45) +
    text(136, 48, "out", "s") +
    line([
      [62, 24],
      [62, 66],
    ]) +
    line([
      [28, 45],
      [62, 45],
    ]) +
    dot(62, 45) +
    text(24, 48, "in", "e") +
    line([
      [80, 86],
      [104, 86],
    ]) +
    text(108, 89, "GND", "s")
  );
}

/** A MOSFET cut open: source and drain wells, oxide, gate. */
function crossSection(hl?: "channel" | "gate" | "ends"): string {
  const strong = (on: boolean) => (on ? "tk" : undefined);
  return (
    rect(10, 46, 140, 36, "g2") +
    text(80, 76, "p") +
    rect(22, 46, 32, 15, "f", 4) +
    text(38, 57, "n+") +
    rect(106, 46, 32, 15, "f", 4) +
    text(122, 57, "n+") +
    rect(54, 40, 52, 6, "g") +
    rect(54, 30, 52, 10, hl === "gate" ? "k" : "f") +
    line([
      [80, 30],
      [80, 20],
    ]) +
    text(80, 15, "G", "m", strong(hl === "gate")) +
    line([
      [38, 46],
      [38, 20],
    ]) +
    text(38, 15, "S", "m", strong(hl === "ends")) +
    line([
      [122, 46],
      [122, 20],
    ]) +
    text(122, 15, "D", "m", strong(hl === "ends")) +
    line(
      [
        [54, 50],
        [106, 50],
      ],
      hl === "channel" ? "b" : "o",
    )
  );
}

/** A switch from a to b (horizontal), open or closed. */
function sw(x: number, y: number, closed: boolean, w = 22): string {
  return (
    dot(x, y) +
    dot(x + w, y) +
    line(
      closed
        ? [
            [x, y],
            [x + w, y],
          ]
        : [
            [x, y],
            [x + w - 3, y - 9],
          ],
    )
  );
}

/** A vertical switch from y to y + h. */
function vsw(x: number, y: number, closed: boolean, h = 18): string {
  return (
    dot(x, y) +
    dot(x, y + h) +
    line(
      closed
        ? [
            [x, y],
            [x, y + h],
          ]
        : [
            [x, y],
            [x - 8, y + h - 3],
          ],
    )
  );
}

/** A square wave: `bits` gives the level of each half-unit step. */
function wave(
  x0: number,
  y: number,
  h: number,
  step: number,
  bits: string,
): string {
  const pts: Pt[] = [];
  let x = x0;
  let prev = "";
  for (const b of bits) {
    const yy = b === "1" ? y - h : y;
    if (prev && prev !== b) pts.push([x, prev === "1" ? y - h : y]);
    pts.push([x, yy]);
    x += step;
    pts.push([x, yy]);
    prev = b;
  }
  return line(pts);
}

/** A labelled box. */
const box = (
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  c = "f",
) => rect(x, y, w, h, c, 3) + text(x + w / 2, y + h / 2 + 3, label, "m", "tk");

/** A row of bit cells. */
function bits(
  x: number,
  y: number,
  v: string,
  w = 12,
  h = 14,
  c?: (i: number) => string | undefined,
): string {
  return [...v]
    .map(
      (b, i) =>
        rect(x + i * w, y, w, h, c?.(i) ?? "f") +
        text(
          x + i * w + w / 2,
          y + h / 2 + 3,
          b,
          "m",
          c?.(i) === "k" ? "inv" : "tk",
        ),
    )
    .join("");
}

/** Points around a circle, from the top, clockwise. */
const around = (
  cx: number,
  cy: number,
  r: number,
  i: number,
  of: number,
): Pt => [
  cx + r * Math.sin((2 * Math.PI * i) / of),
  cy - r * Math.cos((2 * Math.PI * i) / of),
];

/** A cycle of labels round an ellipse, with arrows between them. */
function cycle(labels: string[]): string {
  const at = (i: number): Pt => {
    const a = (2 * Math.PI * i) / labels.length;
    return [80 + 52 * Math.sin(a), 48 - 30 * Math.cos(a)];
  };
  let out = `<ellipse cx="80" cy="48" rx="52" ry="30" class="m"/>`;
  labels.forEach((_, i) => (out += arrow(at(i + 0.42), at(i + 0.5))));
  labels.forEach((l, i) => {
    const [x, y] = at(i);
    const w = l.length * 5.2 + 14;
    out += rect(x - w / 2, y - 8, w, 15, "f", 7) + text(x, y + 3, l, "m", "tk");
  });
  return out;
}

/** A silicon lattice; `odd` puts another atom at the centre. */
function lattice(odd?: { label: string; extra: "electron" | "hole" }): string {
  let out = "";
  const xs = [40, 80, 120];
  const ys = [20, 45, 70];
  for (const y of ys)
    out += line(
      [
        [18, y],
        [142, y],
      ],
      "m",
    );
  for (const x of xs)
    out += line(
      [
        [x, 6],
        [x, 84],
      ],
      "m",
    );
  for (const x of xs)
    for (const y of ys) {
      const centre = x === 80 && y === 45;
      out += circle(x, y, 8, centre && odd ? "f2" : "f");
      out += text(x, y + 3, centre && odd ? odd.label : "Si", "m", "tk sm");
    }
  if (odd?.extra === "electron") out += circle(96, 34, 2.4, "k");
  if (odd?.extra === "hole") out += circle(96, 45, 2.8, "f");
  return out;
}

/** p and n silicon meeting; `w` is the depletion region's width. */
function junction(w: number, note?: "flow" | "block" | "region"): string {
  const mid = 80;
  let out = rect(14, 22, 132, 40, "f");
  out += rect(mid - w / 2, 22, w, 40, "g");
  for (const [x, y] of [
    [26, 32],
    [44, 50],
    [30, 54],
    [52, 30],
  ] as Pt[])
    if (x < mid - w / 2 - 4) out += circle(x, y, 2.6);
  for (const [x, y] of [
    [134, 32],
    [116, 50],
    [130, 54],
    [108, 30],
  ] as Pt[])
    if (x > mid + w / 2 + 4) out += circle(x, y, 2.4, "k");
  out += text(22, 16, "p", "m", "tk") + text(138, 16, "n", "m", "tk");
  if (note === "flow") out += arrow([40, 76], [120, 76]);
  if (note === "block")
    out +=
      line(
        [
          [60, 76],
          [100, 76],
        ],
        "m",
      ) +
      line([
        [74, 70],
        [86, 82],
      ]) +
      line([
        [86, 70],
        [74, 82],
      ]);
  if (note === "region")
    out += line([
      [mid - w / 2, 72],
      [mid - w / 2, 78],
      [mid + w / 2, 78],
      [mid + w / 2, 72],
    ]);
  return out;
}

/** A column of memory words with addresses; `at` points at one. */
function words(
  at?: number,
  values = ["0012", "00ff", "7a31", "0000", "1c04"],
  x = 68,
): string {
  let out = "";
  values.forEach((v, i) => {
    const y = 8 + i * 15;
    out += text(x - 6, y + 10, String(i), "e");
    out += rect(x, y, 52, 15, i === at ? "g" : "f");
    out += text(x + 26, y + 10, v, "m", "tk");
  });
  if (at !== undefined)
    out += arrow([20, 8 + at * 15 + 7.5], [x - 16, 8 + at * 15 + 7.5]);
  return out;
}

/** A stack of cells growing up from y = 84; top first in `cells`. */
function stack(cells: string[], x = 56, w = 48): string {
  let out = line([
    [x - 6, 84],
    [x + w + 6, 84],
  ]);
  [...cells].reverse().forEach((c, i) => {
    const y = 84 - (i + 1) * 15;
    out += rect(x, y, w, 15, "f") + text(x + w / 2, y + 10.5, c, "m", "tk");
  });
  return out;
}

const PICTURES: Record<string, () => string> = {
  // ---- Chapter 0 --------------------------------------------------------
  computer: () =>
    box(14, 32, 30, 22, "in") +
    arrow([44, 43], [58, 43]) +
    rect(58, 20, 46, 48, "f", 3) +
    text(81, 36, "CPU", "m", "tk") +
    line(
      [
        [64, 46],
        [98, 46],
      ],
      "m",
    ) +
    text(81, 60, "RAM", "m", "tk") +
    arrow([104, 43], [118, 43]) +
    box(118, 32, 30, 22, "out"),
  processor: () => chip(true, "CPU"),
  microprocessor: () => chip(true, "μP"),
  "integrated-circuit": () => chip(false, "IC"),
  "stored-program": () =>
    box(56, 8, 48, 22, "CPU") +
    line([
      [80, 30],
      [80, 52],
    ]) +
    rect(36, 52, 88, 30, "f", 3) +
    line(
      [
        [80, 52],
        [80, 82],
      ],
      "m",
    ) +
    text(58, 71, word("program"), "m", "tk sm") +
    text(102, 71, word("data"), "m", "tk sm"),
  "harvard-architecture": () =>
    box(56, 8, 48, 22, "CPU") +
    line([
      [68, 30],
      [68, 40],
      [40, 40],
      [40, 52],
    ]) +
    line([
      [92, 30],
      [92, 40],
      [120, 40],
      [120, 52],
    ]) +
    box(14, 52, 52, 30, word("program")) +
    box(94, 52, 52, 30, word("data")),
  "punched-card": () => {
    let out = path("M14,14 H146 V78 H24 L14,68 Z", "f");
    const holes = ["1001010110", "0110100101", "1010011010", "0101100011"];
    holes.forEach((row, r) =>
      [...row].forEach((b, c) => {
        if (b === "1") out += rect(28 + c * 11.4, 22 + r * 13, 4, 8, "k");
      }),
    );
    return out;
  },
  logarithm: () => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = 0.25 + (i / 40) * 7.75;
      pts.push([20 + (x / 8) * 124, 62 - Math.log2(x) * 14]);
    }
    return (
      line(
        [
          [20, 84],
          [20, 6],
        ],
        "m",
      ) +
      line(
        [
          [14, 62],
          [148, 62],
        ],
        "m",
      ) +
      line(pts) +
      text(144, 74, "x", "m") +
      text(26, 12, "log x", "s") +
      text(35.5, 74, "1") +
      dot(35.5, 62)
    );
  },
  "slide-rule": () => {
    let out =
      rect(8, 18, 144, 18, "f") +
      rect(30, 36, 122, 18, "g2") +
      rect(8, 54, 144, 18, "f");
    for (let k = 1; k <= 10; k++) {
      const x = 12 + Math.log10(k) * 128;
      out += line([
        [x, 36],
        [x, k === 1 || k === 10 ? 26 : 30],
      ]);
      const x2 = 34 + Math.log10(k) * 128;
      if (x2 < 150)
        out += line([
          [x2, 36],
          [x2, 44],
        ]);
    }
    return out + rect(66, 12, 12, 66, "d", 2);
  },
  analog: () => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 60; i++)
      pts.push([12 + i * 2.27, 45 - 26 * Math.sin((i / 60) * Math.PI * 3)]);
    return (
      line(
        [
          [12, 84],
          [12, 8],
        ],
        "m",
      ) + line(pts)
    );
  },
  digital: () =>
    line(
      [
        [12, 84],
        [12, 8],
      ],
      "m",
    ) +
    wave(12, 66, 40, 13.6, "0110100111") +
    text(150, 22, "1", "e") +
    text(150, 80, "0", "e"),
  bit: () =>
    rect(30, 22, 36, 36, "f") +
    text(48, 46, "0", "m", "big") +
    rect(94, 22, 36, 36, "k") +
    text(112, 46, "1", "m", "big inv") +
    text(48, 74, "GND") +
    text(112, 74, "VDD"),
  binary: () =>
    ["8", "4", "2", "1"]
      .map(
        (w, i) =>
          text(38 + i * 22, 22, w) +
          text(38 + i * 22, 48, "1011"[i] ?? "", "m", "big"),
      )
      .join("") +
    line(
      [
        [24, 58],
        [118, 58],
      ],
      "m",
    ) +
    text(80, 76, "8 + 2 + 1 = 11", "m", "tk"),
  "turing-machine": () => {
    let out = "";
    "01101 0".split("").forEach((s, i) => {
      out +=
        rect(10 + i * 20, 44, 20, 22, "f") +
        text(20 + i * 20, 59, s.trim(), "m", "tk");
    });
    return (
      out +
      line(
        [
          [4, 55],
          [10, 55],
        ],
        "o",
      ) +
      line(
        [
          [150, 55],
          [156, 55],
        ],
        "o",
      ) +
      path("M80,40 L72,26 H88 Z", "k") +
      text(80, 20, "q₂", "m", "tk") +
      arrow([94, 80], [116, 80]) +
      arrow([66, 80], [44, 80])
    );
  },
  switch: () =>
    sw(30, 32, false, 30) +
    line([
      [10, 32],
      [30, 32],
    ]) +
    line([
      [60, 32],
      [80, 32],
    ]) +
    text(90, 35, word("off"), "s") +
    sw(30, 64, true, 30) +
    line([
      [10, 64],
      [30, 64],
    ]) +
    line([
      [60, 64],
      [80, 64],
    ]) +
    text(90, 67, word("on"), "s"),
  relay: () => {
    let coil = "";
    for (let i = 0; i < 6; i++) coil += `A5,5 0 0 1 ${24 + (i + 1) * 10},70 `;
    return (
      rect(22, 56, 64, 6, "g") +
      path(`M24,70 ${coil}`) +
      line([
        [12, 70],
        [24, 70],
      ]) +
      line([
        [84, 70],
        [96, 70],
      ]) +
      dot(104, 30) +
      dot(146, 30) +
      line([
        [104, 30],
        [140, 40],
      ]) +
      line([
        [92, 30],
        [104, 30],
      ]) +
      arrow([122, 54], [122, 40], "m")
    );
  },
  "vacuum-tube": () =>
    path("M50,82 V36 A30,30 0 0 1 110,36 V82 Z", "f") +
    line([
      [62, 30],
      [98, 30],
    ]) +
    line(
      [
        [62, 52],
        [98, 52],
      ],
      "d",
    ) +
    path("M66,70 Q80,64 94,70") +
    line([
      [80, 30],
      [80, 8],
    ]) +
    line([
      [56, 52],
      [36, 52],
    ]) +
    line([
      [66, 70],
      [66, 88],
    ]) +
    line([
      [94, 70],
      [94, 88],
    ]),
  transistor: () =>
    fet(84, 45, false, 26) +
    line([
      [92, 25],
      [92, 12],
    ]) +
    line([
      [92, 65],
      [92, 78],
    ]) +
    text(54, 48, "G", "e") +
    text(100, 16, "D", "s") +
    text(100, 80, "S", "s"),
  // Energy bands side by side: an insulator's gap is wide, a metal's bands
  // overlap, a semiconductor's gap is small enough for a few electrons to
  // cross (and for doping and voltage to control how many).
  semiconductor: () =>
    rect(13, 6, 34, 14, "f") +
    rect(13, 56, 34, 14, "g") +
    text(30, 85, "SiO₂") +
    rect(63, 22, 34, 14, "f") +
    rect(63, 48, 34, 14, "g") +
    dot(73, 29) +
    dot(88, 30) +
    circle(75, 55, 2.4, "f") +
    circle(87, 54, 2.4, "f") +
    arrow([80, 47], [80, 37], "m") +
    text(80, 85, "Si", "m", "tk") +
    line([
      [66, 89],
      [94, 89],
    ]) +
    rect(113, 22, 34, 40, "f") +
    rect(113, 42, 34, 20, "g") +
    text(130, 85, "Cu"),
  silicon: () => lattice(),
  germanium: () => lattice().replace(/>Si</g, ">Ge<"),
  "silicon-dioxide": () =>
    rect(14, 46, 132, 34, "g2") +
    text(80, 68, "Si") +
    rect(14, 34, 132, 12, "g") +
    text(80, 43.5, "SiO₂", "m", "tk sm"),
  "band-gap": () =>
    rect(30, 10, 100, 18, "g") +
    rect(30, 62, 100, 18, "g2") +
    line([
      [140, 28],
      [140, 62],
    ]) +
    line([
      [136, 28],
      [144, 28],
    ]) +
    line([
      [136, 62],
      [144, 62],
    ]) +
    text(136, 48, "eV", "e") +
    arrow([62, 66], [62, 22]) +
    circle(62, 20, 2.4, "k") +
    circle(62, 70, 2.8, "f"),
  "leakage-current": () =>
    sw(54, 45, false, 50) +
    line([
      [14, 45],
      [54, 45],
    ]) +
    line([
      [104, 45],
      [146, 45],
    ]) +
    arrow([62, 58], [96, 58], "d") +
    text(80, 76, "I > 0", "m", "tk"),
  wafer: () => {
    let out = path("M58,83 A40,40 0 1 1 102,83 Z", "f");
    for (let gx = 0; gx < 8; gx++)
      for (let gy = 0; gy < 8; gy++) {
        const x = 37 + gx * 11;
        const y = 2 + gy * 11;
        const far = [
          [x, y],
          [x + 9, y],
          [x, y + 9],
          [x + 9, y + 9],
        ].every(
          ([px, py]) =>
            Math.hypot((px ?? 0) - 80, (py ?? 0) - 45) < 38 && (py ?? 0) < 81,
        );
        if (far) out += rect(x, y, 9, 9, "g2");
      }
    return out;
  },
  "moores-law": () => {
    let out =
      line(
        [
          [20, 84],
          [20, 6],
        ],
        "m",
      ) +
      line(
        [
          [20, 84],
          [150, 84],
        ],
        "m",
      );
    for (let i = 0; i < 9; i++) {
      const x = 28 + i * 14;
      const y = 76 - i * 8 + (i % 2 ? 2 : -1);
      out += dot(x, y);
    }
    return (
      out +
      line(
        [
          [24, 78],
          [146, 10],
        ],
        "d",
      ) +
      text(26, 12, "log n", "s")
    );
  },
  "single-crystal": () => {
    let out = "";
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 9; c++)
        out += circle(24 + c * 14, 17 + r * 14, 3, "f");
    return out;
  },
  polysilicon: () => {
    let out = "";
    const grains: [number, number, number][] = [
      [40, 30, 0.4],
      [104, 26, -0.3],
      [64, 66, 0.9],
      [124, 66, 0.1],
    ];
    for (const [gx, gy, a] of grains)
      for (let r = -1; r <= 1; r++)
        for (let c = -1; c <= 1; c++) {
          const x = gx + c * 11 * Math.cos(a) - r * 11 * Math.sin(a);
          const y = gy + c * 11 * Math.sin(a) + r * 11 * Math.cos(a);
          out += circle(x, y, 2.8, "f");
        }
    return out;
  },
  "czochralski-process": () =>
    path("M38,52 V80 H122 V52", "f") +
    rect(40, 62, 80, 17, "g") +
    path("M72,62 L70,50 Q80,30 90,50 L88,62 Z", "g2") +
    line([
      [80, 32],
      [80, 6],
    ]) +
    arrow([80, 22], [80, 8]) +
    path("M94,16 A14,5 0 1 1 66,16", "m"),
  doping: () =>
    lattice({ label: "P", extra: "electron" }) +
    circle(150, 10, 6, "f2") +
    text(150, 12.5, "P", "m", "tk sm") +
    arrow([144, 14], [89, 39], "d"),
  dopant: () => {
    const atom = (x: number, label: string, outer: number) => {
      let out = circle(x, 42, 12, "f2") + text(x, 46, label, "m", "tk");
      for (let i = 0; i < outer; i++) {
        const [dx, dy] = around(x, 42, 21, i, outer);
        out += dot(dx, dy);
      }
      return (
        out +
        circle(x, 42, 21, "m") +
        text(x, 82, label === "P" ? "n" : "p", "m", "tk")
      );
    };
    return atom(48, "P", 5) + atom(112, "B", 3);
  },
  "n-type": () => lattice({ label: "P", extra: "electron" }),
  "p-type": () => lattice({ label: "B", extra: "hole" }),
  hole: () =>
    lattice({ label: "Si", extra: "hole" }) + arrow([118, 40], [101, 44]),
  electron: () =>
    circle(80, 45, 10, "f") +
    text(80, 48.5, "−", "m", "tk") +
    arrow([94, 45], [140, 45], "m") +
    arrow([66, 45], [20, 45], "o"),
  "p-n-junction": () => junction(18),
  "depletion-region": () => junction(30, "region"),
  "forward-bias": () => junction(8, "flow"),
  "reverse-bias": () => junction(46, "block"),
  diode: () =>
    line([
      [14, 45],
      [62, 45],
    ]) +
    path("M62,30 L92,45 L62,60 Z", "f") +
    line([
      [92, 30],
      [92, 60],
    ]) +
    line([
      [92, 45],
      [146, 45],
    ]) +
    arrow([40, 70], [120, 70], "m"),
  mosfet: () => crossSection(),
  "gate-terminal": () => crossSection("gate"),
  "source-and-drain": () => crossSection("ends"),
  channel: () => crossSection("channel"),
  "threshold-voltage": () => {
    const pts: Pt[] = [
      [20, 80],
      [70, 80],
    ];
    for (let i = 1; i <= 20; i++) pts.push([70 + i * 3.6, 80 - (i * i) / 6]);
    return (
      line(
        [
          [20, 84],
          [20, 6],
        ],
        "m",
      ) +
      line(
        [
          [16, 80],
          [148, 80],
        ],
        "m",
      ) +
      line(pts) +
      line(
        [
          [70, 84],
          [70, 20],
        ],
        "d",
      ) +
      text(70, 14, "Vth") +
      text(148, 74, "V", "e") +
      text(26, 12, "I", "s")
    );
  },
  nmos: () =>
    fet(80, 45, false, 28) +
    line([
      [88, 25],
      [88, 12],
    ]) +
    line([
      [88, 65],
      [88, 78],
    ]) +
    text(46, 49, "1", "e", "tk") +
    text(104, 49, word("on"), "s"),
  pmos: () =>
    fet(80, 45, true, 28) +
    line([
      [88, 25],
      [88, 12],
    ]) +
    line([
      [88, 65],
      [88, 78],
    ]) +
    text(46, 49, "0", "e", "tk") +
    text(104, 49, word("on"), "s"),
  cmos: () => inverter(),
  "pull-up-network": () => inverter("up"),
  "pull-down-network": () => inverter("down"),
  voltage: () =>
    line([
      [20, 45],
      [70, 45],
    ]) +
    line([
      [70, 26],
      [70, 64],
    ]) +
    line(
      [
        [80, 34],
        [80, 56],
      ],
      "b",
    ) +
    line([
      [80, 45],
      [140, 45],
    ]) +
    text(64, 22, "+", "e", "tk") +
    text(88, 30, "−", "s", "tk") +
    text(75, 82, "V", "m", "tk"),
  current: () =>
    rect(30, 22, 100, 46, "", 6) +
    arrow([60, 22], [100, 22]) +
    arrow([100, 68], [60, 68]) +
    text(80, 16, "I", "m", "tk"),
  noise: () => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 70; i++) {
      const base = Math.floor(i / 18) % 2 ? 24 : 66;
      pts.push([
        12 + i * 1.95,
        base + 4 * Math.sin(i * 2.7) + 3 * Math.sin(i * 7.1),
      ]);
    }
    return line(pts);
  },
  "logic-level": () => levels(false),
  "noise-margin": () => levels(true),
  "transfer-curve": () => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = i / 40;
      const y = 1 / (1 + Math.exp(18 * (x - 0.5)));
      pts.push([22 + x * 120, 80 - y * 68]);
    }
    return (
      line(
        [
          [22, 84],
          [22, 6],
        ],
        "m",
      ) +
      line(
        [
          [18, 80],
          [148, 80],
        ],
        "m",
      ) +
      line(pts) +
      text(146, 74, "in", "e") +
      text(28, 12, "out", "s")
    );
  },
  "series-and-parallel": () =>
    sw(16, 28, false, 18) +
    sw(42, 28, false, 18) +
    line([
      [34, 28],
      [42, 28],
    ]) +
    text(38, 56, "&") +
    line([
      [100, 20],
      [100, 44],
    ]) +
    line([
      [144, 20],
      [144, 44],
    ]) +
    sw(111, 20, false, 22) +
    sw(111, 44, false, 22) +
    line([
      [100, 20],
      [111, 20],
    ]) +
    line([
      [133, 20],
      [144, 20],
    ]) +
    line([
      [100, 44],
      [111, 44],
    ]) +
    line([
      [133, 44],
      [144, 44],
    ]) +
    text(122, 66, "≥1"),
  input: () =>
    rect(18, 30, 26, 26, "f", 4) +
    text(31, 47, "A", "m", "tk") +
    arrow([50, 43], [80, 43]) +
    box(84, 26, 56, 34, "CPU"),
  output: () => {
    let out = box(14, 26, 50, 34, "CPU") + arrow([68, 43], [92, 43]);
    out += rect(96, 22, 52, 38, "f", 3);
    for (const [x, y] of [
      [104, 30],
      [110, 30],
      [116, 36],
      [122, 42],
      [128, 48],
      [134, 48],
    ] as Pt[])
      out += rect(x, y, 5, 5, "k");
    return (
      out +
      line([
        [114, 60],
        [114, 70],
      ]) +
      line([
        [104, 70],
        [140, 70],
      ])
    );
  },
  program: () =>
    ["SET r1, 5", "ADD r1, r1, r2", "SUBI r1, 1", "JNZ loop"]
      .map(
        (l, i) =>
          text(26, 20 + i * 17, String(i), "e", "sm") +
          text(34, 20 + i * 17, l, "s", "tk code"),
      )
      .join(""),
  algorithm: () =>
    rect(58, 4, 44, 14, "f", 7) +
    arrow([80, 18], [80, 26]) +
    rect(58, 26, 44, 16, "f", 2) +
    arrow([80, 42], [80, 50]) +
    path("M80,50 L98,62 L80,74 L62,62 Z", "f") +
    text(80, 65, "?", "m", "tk") +
    line([
      [98, 62],
      [124, 62],
      [124, 34],
    ]) +
    arrow([124, 34], [102, 34]) +
    arrow([80, 74], [80, 86]) +
    text(128, 74, "1", "s", "sm") +
    text(86, 86, "0", "s", "sm"),
  "general-purpose": () =>
    ["A", "B", "C"]
      .map(
        (c, i) =>
          box(10, 8 + i * 27, 30, 20, c) +
          arrow([40, 18 + i * 27], [92, 45], "m"),
      )
      .join("") + box(96, 30, 52, 30, "CPU"),
  "boolean-algebra": () =>
    text(80, 32, "¬(a ∧ b)", "m", "big") +
    text(80, 52, "=", "m", "tk") +
    text(80, 76, "¬a ∨ ¬b", "m", "big"),
  // ---- Chapter 1 --------------------------------------------------------
  "fast-model": () => {
    let out = rect(8, 18, 58, 54, "d", 4);
    out +=
      gate(26, 34, "and", true, 0.4).svg +
      gate(48, 34, "or", false, 0.4).svg +
      gate(37, 56, "and", false, 0.4).svg;
    return (
      out +
      text(80, 49, "≡", "m", "big") +
      rect(96, 18, 56, 54, "g", 4) +
      text(124, 49, "f(x)", "m", "tk")
    );
  },
  "truth-table": () => {
    const rows = ["0 0  0", "0 1  0", "1 0  0", "1 1  1"];
    let out = text(66, 18, "a b", "m", "tk") + text(104, 18, "out", "m", "tk");
    out +=
      line([
        [44, 24],
        [124, 24],
      ]) +
      line(
        [
          [86, 8],
          [86, 82],
        ],
        "m",
      );
    rows.forEach((r, i) => {
      out +=
        text(66, 38 + i * 14, r.slice(0, 3)) +
        text(104, 38 + i * 14, r.slice(5), "m", "tk");
    });
    return out;
  },
  "logic-gate": () =>
    wiredGate(32, 38, "and", false, 0.6, "AND") +
    wiredGate(82, 38, "or", false, 0.6, "OR") +
    wiredGate(130, 38, "not", true, 0.6, "NOT"),
  "universal-gate": () =>
    wiredGate(50, 38, "and", true, 0.75, "NAND") +
    wiredGate(116, 38, "or", true, 0.75, "NOR"),
  floating: () =>
    text(80, 9, "VDD") +
    vsw(80, 14, false) +
    line([
      [80, 32],
      [80, 58],
    ]) +
    dot(80, 45) +
    line(
      [
        [80, 45],
        [130, 45],
      ],
      "o",
    ) +
    text(136, 48, "Z", "s", "tk") +
    vsw(80, 58, false) +
    text(80, 88, "GND"),
  "short-circuit": () =>
    text(80, 9, "VDD") +
    vsw(80, 14, true) +
    line(
      [
        [80, 32],
        [80, 58],
      ],
      "b",
    ) +
    dot(80, 45) +
    line(
      [
        [80, 45],
        [130, 45],
      ],
      "d",
    ) +
    text(136, 48, "X", "s", "tk") +
    vsw(80, 58, true) +
    text(80, 88, "GND") +
    arrow([62, 20], [62, 70], "m"),
  abstraction: () => {
    let out = rect(10, 12, 62, 66, "d", 4);
    for (const [x, y] of [
      [30, 30],
      [56, 30],
      [30, 60],
      [56, 60],
    ] as Pt[])
      out += fet(x, y, y < 45, 12);
    return (
      out + arrow([80, 45], [100, 45]) + wiredGate(128, 45, "and", true, 0.7)
    );
  },
  "gate-delay": () =>
    text(14, 30, "in", "s") +
    wave(30, 34, 18, 12, "0011111111") +
    text(14, 70, "out", "s") +
    wave(30, 74, 18, 12, "0000111111") +
    line(
      [
        [54, 40],
        [54, 80],
      ],
      "o",
    ) +
    line(
      [
        [78, 40],
        [78, 80],
      ],
      "o",
    ) +
    line([
      [54, 86],
      [78, 86],
    ]) +
    line([
      [54, 83],
      [54, 89],
    ]) +
    line([
      [78, 83],
      [78, 89],
    ]),
  // ---- Chapter 2 --------------------------------------------------------
  multiplexer: () =>
    path("M60,21 L100,31 L100,53 L60,63 Z", "f") +
    line([
      [28, 32],
      [60, 32],
    ]) +
    line([
      [28, 52],
      [60, 52],
    ]) +
    text(24, 35, "a", "e") +
    text(24, 55, "b", "e") +
    line([
      [100, 42],
      [130, 42],
    ]) +
    text(134, 45, "out", "s") +
    line([
      [80, 58],
      [80, 80],
    ]) +
    text(80, 89, "sel"),
  demultiplexer: () =>
    path("M60,31 L100,21 L100,63 L60,53 Z", "f") +
    line([
      [30, 42],
      [60, 42],
    ]) +
    text(26, 45, "in", "e") +
    line([
      [100, 32],
      [130, 32],
    ]) +
    line([
      [100, 52],
      [130, 52],
    ]) +
    text(134, 35, "a", "s") +
    text(134, 55, "b", "s") +
    line([
      [80, 58],
      [80, 80],
    ]) +
    text(80, 89, "sel"),
  bus: () =>
    line(
      [
        [16, 45],
        [144, 45],
      ],
      "b",
    ) +
    line([
      [74, 54],
      [86, 36],
    ]) +
    text(80, 30, "16", "m", "tk"),
  "splitter-and-joiner": () => {
    let out =
      line(
        [
          [10, 45],
          [44, 45],
        ],
        "b",
      ) +
      line(
        [
          [44, 22],
          [44, 68],
        ],
        "b",
      );
    out +=
      line(
        [
          [116, 22],
          [116, 68],
        ],
        "b",
      ) +
      line(
        [
          [116, 45],
          [150, 45],
        ],
        "b",
      );
    [0, 1, 2, 3].forEach((i) => {
      const y = 25 + i * 13.3;
      out +=
        line([
          [44, y],
          [116, y],
        ]) + text(80, y - 2, String(i), "m", "sm");
    });
    return out;
  },
  "half-adder": () => adder(false),
  "full-adder": () => adder(true),
  carry: () =>
    text(72, 16, "1", "m", "tk sm") +
    text(72, 34, "1", "m", "big") +
    text(92, 34, "7", "m", "big") +
    text(52, 54, "+", "m", "big") +
    text(72, 54, "2", "m", "big") +
    text(92, 54, "5", "m", "big") +
    line([
      [44, 62],
      [104, 62],
    ]) +
    text(72, 82, "4", "m", "big") +
    text(92, 82, "2", "m", "big") +
    path("M94,40 Q94,10 78,14", "d"),
  "ripple-carry-adder": () => {
    let out = "";
    for (let i = 0; i < 4; i++) {
      const x = 118 - i * 34;
      out += box(x, 30, 26, 26, "FA");
      out += text(x + 13, 22, String(i), "m", "sm");
      if (i < 3) out += arrow([x, 43], [x - 8, 43]);
    }
    return out;
  },
  "twos-complement": () => {
    let out = circle(80, 46, 30, "m");
    const v = ["0", "1", "2", "3", "−4", "−3", "−2", "−1"];
    v.forEach((s, i) => {
      const [x, y] = around(80, 46, 38, i, 8);
      const [dx, dy] = around(80, 46, 30, i, 8);
      out += dot(dx, dy) + text(x, y + 3, s, "m", i >= 4 ? "tk" : undefined);
    });
    return out;
  },
  alu: () =>
    path("M50,10 L110,26 L110,64 L50,80 L50,54 L60,45 L50,36 Z", "f") +
    line([
      [22, 23],
      [50, 23],
    ]) +
    line([
      [22, 67],
      [50, 67],
    ]) +
    text(18, 26, "x", "e") +
    text(18, 70, "y", "e") +
    line([
      [110, 45],
      [140, 45],
    ]) +
    text(144, 48, "out", "s") +
    text(84, 48, "ALU", "m", "tk"),
  flags: () =>
    [
      ["Z", "0"],
      ["N", "1"],
      ["C", "0"],
    ]
      .map(
        ([f, v], i) =>
          box(30 + i * 36, 30, 28, 28, v ?? "", v === "1" ? "g" : "f") +
          text(44 + i * 36, 74, f ?? "", "m", "tk"),
      )
      .join(""),
  "barrel-shifter": () =>
    bits(32, 14, "10110010") +
    bits(32, 62, "11001000") +
    [0, 1, 2, 3, 4, 5]
      .map((i) =>
        line(
          [
            [38 + (i + 2) * 12, 28],
            [38 + i * 12, 62],
          ],
          "m",
        ),
      )
      .join("") +
    text(140, 48, "≪2", "m", "tk"),
  // ---- Chapter 3 --------------------------------------------------------
  feedback: () =>
    box(52, 24, 44, 34, "f") +
    line([
      [24, 34],
      [52, 34],
    ]) +
    line([
      [96, 41],
      [136, 41],
    ]) +
    line([
      [116, 41],
      [116, 74],
      [40, 74],
      [40, 48],
      [52, 48],
    ]) +
    arrow([60, 74], [50, 74]) +
    dot(116, 41),
  "sequential-circuit": () =>
    box(30, 14, 50, 30, word("logic")) +
    box(30, 54, 50, 26, word("memory")) +
    line([
      [80, 29],
      [118, 29],
    ]) +
    line([
      [100, 29],
      [100, 67],
      [80, 67],
    ]) +
    line([
      [30, 67],
      [18, 67],
      [18, 36],
      [30, 36],
    ]) +
    dot(100, 29) +
    path("M30,74 L36,77 L30,80"),
  latch: () => {
    const top = gate(80, 26, "or", true, 0.6);
    const bot = gate(80, 64, "or", true, 0.6);
    return (
      line([
        [26, 21],
        [top.inX, 21],
      ]) +
      text(22, 24, "R", "e", "tk") +
      line([
        [26, 69],
        [bot.inX, 69],
      ]) +
      text(22, 72, "S", "e", "tk") +
      line([
        [top.outX, 26],
        [140, 26],
      ]) +
      text(144, 29, "Q", "s", "tk") +
      line([
        [bot.outX, 64],
        [140, 64],
      ]) +
      line([
        [114, 26],
        [114, 38],
        [54, 52],
        [54, 59],
        [bot.inX, 59],
      ]) +
      line([
        [122, 64],
        [122, 52],
        [48, 38],
        [48, 31],
        [top.inX, 31],
      ]) +
      dot(114, 26) +
      dot(122, 64) +
      top.svg +
      bot.svg
    );
  },
  "flip-flop": () =>
    rect(60, 18, 44, 54, "f", 3) +
    line([
      [30, 32],
      [60, 32],
    ]) +
    text(26, 35, "D", "e", "tk") +
    line([
      [30, 60],
      [60, 60],
    ]) +
    path("M60,54 L68,60 L60,66") +
    text(26, 63, "clk", "e") +
    line([
      [104, 32],
      [134, 32],
    ]) +
    text(138, 35, "Q", "s", "tk"),
  clock: () => wave(14, 62, 32, 11, "001100110011"),
  "clock-edge": () =>
    wave(14, 62, 32, 11, "001100110011") +
    arrow([47, 86], [37, 66]) +
    circle(36, 46, 4, "k"),
  "setup-time": () =>
    text(12, 30, "D", "s") +
    path("M30,26 L42,26 L46,18 L66,18 L66,18 L148,18", "") +
    path("M30,18 L42,18 L46,26 L148,26") +
    text(12, 68, "clk", "s") +
    wave(30, 74, 18, 12, "0000001111") +
    line([
      [46, 34],
      [102, 34],
    ]) +
    line(
      [
        [102, 10],
        [102, 84],
      ],
      "o",
    ) +
    line(
      [
        [46, 10],
        [46, 34],
      ],
      "o",
    ),
  register: () =>
    bits(32, 26, "01101001", 12, 16) +
    line([
      [80, 42],
      [80, 58],
    ]) +
    text(80, 70, "load"),
  address: () => words(2),
  ram: () => words(3, ["0007", "4a10", "0000", "beef", "0123"]),
  memory: () => {
    let out = "";
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++)
        out += rect(
          20 + c * 15,
          14 + r * 16,
          13,
          14,
          (r * 8 + c) % 5 ? "f" : "g",
        );
    return out;
  },
  "program-counter": () =>
    box(54, 30, 52, 26, "0012") +
    text(80, 22, "PC", "m", "tk") +
    path("M106,36 Q130,43 106,50") +
    text(122, 30, "+1", "s") +
    arrow([80, 56], [80, 80], "d"),
  waveform: () =>
    text(12, 22, "clk", "s") +
    wave(40, 26, 14, 6.5, "0011001100110011") +
    text(12, 52, "a", "s") +
    wave(40, 56, 14, 6.5, "0000111111110000") +
    text(12, 80, "n", "s") +
    path(
      "M40,70 H62 L66,75 L62,80 H40 M66,75 L70,70 H110 L114,75 L110,80 H70 Z M114,75 L118,70 H144 M114,75 L118,80 H144",
    ) +
    text(90, 78, "7", "m", "sm"),
  "magnetic-core-memory": () => {
    let out = "";
    for (let i = 0; i < 4; i++) {
      out += line(
        [
          [14, 18 + i * 18],
          [146, 18 + i * 18],
        ],
        "m",
      );
      out += line(
        [
          [30 + i * 33, 6],
          [30 + i * 33, 84],
        ],
        "m",
      );
    }
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        out += `<ellipse cx="${30 + c * 33}" cy="${18 + r * 18}" rx="6" ry="4" transform="rotate(45 ${30 + c * 33} ${18 + r * 18})" class="f"/>`;
    return out;
  },
  sram: () => {
    const a = gate(80, 34, "not", true, 0.6);
    return (
      a.svg +
      `<g transform="rotate(180 80 56)">${gate(80, 56, "not", true, 0.6).svg}</g>` +
      line([
        [a.outX, 34],
        [104, 34],
        [104, 56],
        [94, 56],
      ]) +
      line([
        [a.inX, 34],
        [56, 34],
        [56, 56],
        [66, 56],
      ]) +
      line([
        [56, 45],
        [30, 45],
      ]) +
      line([
        [104, 45],
        [130, 45],
      ]) +
      dot(56, 45) +
      dot(104, 45)
    );
  },
  dram: () =>
    fet(70, 40, false, 22) +
    line([
      [78, 20],
      [78, 8],
    ]) +
    line([
      [78, 60],
      [78, 66],
    ]) +
    line([
      [66, 66],
      [90, 66],
    ]) +
    line([
      [66, 72],
      [90, 72],
    ]) +
    line([
      [78, 72],
      [78, 84],
    ]) +
    line([
      [48, 40],
      [30, 40],
    ]),
  capacitor: () =>
    line([
      [14, 45],
      [72, 45],
    ]) +
    line([
      [72, 24],
      [72, 66],
    ]) +
    line([
      [88, 24],
      [88, 66],
    ]) +
    line([
      [88, 45],
      [146, 45],
    ]) +
    text(62, 30, "+", "e", "tk") +
    text(98, 30, "−", "s", "tk"),
  // ---- Chapter 4 --------------------------------------------------------
  instruction: () => fields(),
  "machine-code": () =>
    ["4405", "04a0", "4701", "cbfd"]
      .map((w, i) => text(80, 20 + i * 18, w, "m", "tk"))
      .join(""),
  "assembly-language": () =>
    code(["SET r1, 5", "ADD r1, r1, r2", "SUBI r1, 1", "JNZ loop"]),
  "instruction-cycle": () =>
    cycle([word("fetch"), word("decode"), word("execute")]),
  "instruction-set": () =>
    [
      ["000", "ADD …"],
      ["100", "LOAD …"],
      ["101", "STORE …"],
      ["110", "JMP …"],
    ]
      .map(
        ([b, m], i) =>
          text(56, 22 + i * 17, b ?? "", "e", "tk") +
          text(70, 22 + i * 17, m ?? "", "s", "code"),
      )
      .join("") +
    line(
      [
        [62, 8],
        [62, 80],
      ],
      "m",
    ),
  "control-unit": () =>
    text(14, 48, "instr", "s", "sm") +
    arrow([40, 45], [56, 45]) +
    box(56, 24, 46, 42, word("decode"), "g") +
    ["ALU", "rd", "PC", "RAM"]
      .map(
        (l, i) =>
          arrow([102, 30 + i * 10], [128, 18 + i * 18]) +
          text(132, 21 + i * 18, l, "s", "sm"),
      )
      .join(""),
  datapath: () =>
    box(10, 26, 40, 38, "r0–r7") +
    line([
      [50, 36],
      [72, 36],
    ]) +
    line([
      [50, 54],
      [72, 54],
    ]) +
    path("M72,22 L112,34 L112,56 L72,68 L72,50 L78,45 L72,40 Z", "f") +
    text(92, 48, "ALU", "m", "tk sm") +
    line([
      [112, 45],
      [140, 45],
      [140, 82],
      [30, 82],
    ]) +
    arrow([30, 82], [30, 64]),
  risc: () => {
    let out = "";
    ["ADD", "LOAD", "SUB", "STORE"].forEach((m, i) => {
      out +=
        rect(10, 8 + i * 19, 72, 15, "f") +
        text(46, 18.5 + i * 19, m, "m", "tk sm");
      if (m === "LOAD" || m === "STORE")
        out += arrow(
          [82, 15.5 + i * 19],
          [112, 15.5 + i * 19 + (i === 1 ? 14 : -8)],
        );
    });
    return out + box(114, 22, 38, 44, "RAM");
  },
  "register-file": () => {
    let out = "";
    for (let i = 0; i < 8; i++)
      out +=
        rect(64, 4 + i * 10.5, 32, 10.5, "f") +
        text(80, 12 + i * 10.5, `r${i}`, "m", "sm");
    return (
      out +
      arrow([96, 24], [130, 24]) +
      arrow([96, 50], [130, 50]) +
      arrow([30, 70], [64, 70])
    );
  },
  subroutine: () =>
    code(["CALL f", "ADD …", "", "f: SUB …", "RET"]) +
    line(
      [
        [58, 17],
        [96, 17],
        [96, 62],
      ],
      "d",
    ) +
    arrow([96, 62], [84, 62], "d") +
    line([
      [56, 77],
      [116, 77],
      [116, 32],
    ]) +
    arrow([116, 32], [72, 32]),
  "link-register": () =>
    box(54, 30, 52, 26, "0013") +
    text(80, 22, "r7", "m", "tk") +
    arrow([30, 43], [54, 43]),
  // ---- Chapter 5 --------------------------------------------------------
  "memory-mapped-io": () => {
    let out = rect(8, 40, 64, 18, "f") + text(40, 52, "RAM", "m", "tk");
    out +=
      rect(72, 40, 34, 18, "g") +
      rect(106, 40, 14, 18, "k") +
      rect(120, 40, 32, 18, "", 0);
    out +=
      line(
        [
          [120, 40],
          [152, 58],
        ],
        "o",
      ) +
      line(
        [
          [136, 40],
          [152, 50],
        ],
        "o",
      );
    out +=
      text(8, 72, "0000", "s", "sm") +
      text(72, 72, "4000", "s", "sm") +
      text(106, 82, "6000", "s", "sm");
    out +=
      rect(78, 14, 22, 16, "f", 2) +
      line(
        [
          [89, 30],
          [89, 40],
        ],
        "m",
      );
    out +=
      rect(107, 16, 12, 12, "f", 2) +
      text(113, 25, "A", "m", "sm") +
      line(
        [
          [113, 28],
          [113, 40],
        ],
        "m",
      );
    return out;
  },
  assembler: () =>
    rect(8, 22, 66, 40, "f", 3) +
    text(41, 39, "ADD", "m", "tk") +
    text(41, 51, "r1,r1,r2", "m", "sm") +
    arrow([78, 42], [96, 42]) +
    rect(100, 22, 50, 40, "f", 3) +
    text(125, 46, "04a0", "m", "tk"),
  label: () =>
    code(["loop:", "  SUBI r1, 1", "  JNZ loop"]) +
    line([
      [86, 47],
      [112, 47],
      [112, 17],
    ]) +
    arrow([112, 17], [50, 17]),
  "symbol-table": () =>
    [
      ["loop", "4"],
      ["end", "12"],
      ["MAX", "10"],
    ]
      .map(
        ([k, v], i) =>
          text(56, 26 + i * 18, k ?? "", "e", "tk") +
          text(104, 26 + i * 18, v ?? "", "e"),
      )
      .join("") +
    line(
      [
        [66, 10],
        [66, 72],
      ],
      "m",
    ),
  "pseudo-instruction": () =>
    text(14, 30, "HALT", "s", "tk code") +
    arrow([54, 27], [74, 27]) +
    text(80, 30, "JMP 0", "s", "code") +
    text(14, 62, "INC r1", "s", "tk code") +
    arrow([54, 59], [74, 59]) +
    text(80, 62, "ADDI r1, 1", "s", "code"),
  directive: () =>
    text(12, 26, ".equ MAX 10", "s", "tk code") +
    arrow([76, 23], [96, 23]) +
    text(100, 26, "MAX = 10", "s", "sm") +
    text(12, 58, ".word 7", "s", "tk code") +
    arrow([76, 55], [96, 55]) +
    rect(100, 47, 40, 15, "f") +
    text(120, 58, "0007", "m", "tk"),
  loader: () =>
    rect(10, 18, 48, 54, "g2", 3) +
    text(34, 40, ".data", "m", "tk code") +
    text(34, 56, "3, 7", "m", "sm") +
    arrow([62, 45], [84, 45], "d") +
    words(undefined, ["0003", "0007", "0000", "0000", "0000"], 100),
  "two-pass-assembler": () =>
    code(["  JMP end", "  …", "end:"]) +
    arrow([140, 12], [140, 70]) +
    arrow([152, 12], [152, 70]) +
    text(130, 84, "1", "m") +
    text(152, 84, "2", "m"),
  // ---- Chapter 6 --------------------------------------------------------
  stack: () =>
    stack(["7", "3", "9"]) +
    arrow([70, 6], [70, 34]) +
    arrow([90, 34], [90, 6]),
  "stack-pointer": () =>
    stack(["7", "3", "9"]) +
    arrow([22, 47], [50, 47]) +
    text(18, 50, "SP", "e", "tk"),
  "stack-machine": () =>
    stack(["3", "2"], 14, 30) +
    arrow([50, 64], [70, 64]) +
    text(60, 56, "add", "m", "sm") +
    stack(["5"], 80, 30) +
    text(130, 64, "2 + 3", "m"),
  "stack-frame": () =>
    stack(["local", "FP", "ret", "arg"], 50, 56) +
    line([
      [116, 24],
      [124, 24],
      [124, 84],
      [116, 84],
    ]) +
    text(130, 58, "f", "s", "tk"),
  "virtual-machine": () =>
    code(["push 2", "push 3", "add"]) +
    arrow([116, 45], [136, 45]) +
    text(148, 48, "5", "m", "big"),
  interpreter: () =>
    code(["push 2", "push 3", "add"]) + path("M8,16 L14,20 L8,24", "k"),
  "calling-convention": () =>
    stack(["local 0", "local 1", "FP'", "ret", "arg 0"], 70, 56) +
    arrow([34, 16.5], [64, 16.5]) +
    text(30, 19.5, "FP", "e", "tk"),
  recursion: () => {
    let out = "";
    for (let i = 0; i < 3; i++)
      out +=
        rect(14 + i * 16, 8 + i * 14, 132 - i * 32, 74 - i * 28, "f", 3) +
        text(20 + i * 16, 19 + i * 14, `f(${3 - i})`, "s", "sm");
    return out;
  },
  // ---- Chapter 7 --------------------------------------------------------
  token: () =>
    ["if", "x", "<=", "10"]
      .map((tok, i, all) => {
        const x =
          18 + all.slice(0, i).reduce((a, s) => a + s.length * 9 + 22, 0);
        return (
          rect(x, 32, tok.length * 9 + 14, 22, "f", 3) +
          text(x + (tok.length * 9 + 14) / 2, 47, tok, "m", "tk")
        );
      })
      .join(""),
  "syntax-tree": () => tree(),
  precedence: () =>
    text(80, 34, "2 + 3 × 4", "m", "big") +
    path("M76,42 Q100,54 124,42", "") +
    text(100, 64, "12") +
    text(80, 84, "= 14", "m", "tk"),
  "recursive-descent": () => tree(true),
  compiler: () =>
    ["C", "VM", "asm", "0101"]
      .map(
        (s, i) =>
          box(2 + i * 42, 34, 30, 22, s) +
          (i < 3 ? arrow([33 + i * 42, 45], [43 + i * 42, 45]) : ""),
      )
      .join(""),
  "high-level-language": () => code(["while (x < 10) {", "  x = x + 1;", "}"]),
  "type-checker": () =>
    text(10, 32, "var x: int = 7;", "s", "tk code") +
    text(150, 32, "✓", "e", "tk") +
    text(10, 62, "var y: int = true;", "s", "tk code") +
    text(150, 62, "✗", "e", "tk") +
    line([
      [73, 66],
      [92, 66],
    ]),
  "short-circuit-evaluation": () =>
    text(40, 42, "a", "m", "big") +
    text(80, 42, "and", "m", "tk") +
    text(120, 42, "b", "m", "big muted") +
    text(40, 66, "0") +
    line(
      [
        [108, 26],
        [132, 50],
      ],
      "m",
    ),
  // ---- Chapter 8 --------------------------------------------------------
  "operating-system": () =>
    box(30, 8, 100, 22, word("program")) +
    box(30, 34, 100, 22, "OS", "g") +
    box(30, 60, 100, 22, "CPU · RAM"),
  "bit-mask": () =>
    bits(44, 10, "10110110") +
    bits(44, 34, "00001111", 12, 14, (i) => (i >= 4 ? "g" : undefined)) +
    text(36, 45, "&", "e", "tk") +
    line([
      [40, 56],
      [140, 56],
    ]) +
    bits(44, 62, "00000110"),
  "bitmap-font": () => {
    const glyphs = ["010101111101101", "110101110101110"];
    let out = "";
    glyphs.forEach((g, k) =>
      [...g].forEach((b, i) => {
        const x = 40 + k * 48 + (i % 3) * 11;
        const y = 12 + Math.floor(i / 3) * 13;
        out += rect(x, y, 10, 12, b === "1" ? "k" : "f");
      }),
    );
    return out;
  },
  "pseudo-random": () =>
    ["7", "3", "12", "5", "…"]
      .map(
        (s, i) =>
          text(16 + i * 32, 50, s, "m", "big") +
          (i < 4 ? arrow([27 + i * 32, 45], [37 + i * 32, 45], "m") : ""),
      )
      .join(""),
  "random-seed": () =>
    text(30, 50, "7", "m", "big") +
    arrow([42, 46], [64, 46]) +
    text(110, 50, "3 12 5 …", "m", "tk"),
  // ---- Programs ---------------------------------------------------------
  "collision-detection": () => {
    let out = "";
    const board = ["........", "........", "......#.", "##.####.", "########"];
    const piece = [
      [3, 1],
      [3, 2],
      [4, 2],
      [3, 3],
    ];
    board.forEach((row, r) =>
      [...row].forEach((c, i) => {
        out += rect(36 + i * 11, 6 + r * 16, 11, 16, c === "#" ? "g" : "f");
      }),
    );
    for (const [c, r] of piece)
      out += rect(36 + (c ?? 0) * 11 + 2, 6 + (r ?? 0) * 16 + 2, 7, 12, "k");
    return out;
  },
  "game-loop": () => cycle([word("input"), word("update"), word("draw")]),
  "fixed-point": () => {
    let out = line([
      [16, 50],
      [144, 50],
    ]);
    for (let i = 0; i <= 32; i++) {
      const x = 16 + i * 4;
      out += line(
        [
          [x, 50],
          [x, i % 16 === 0 ? 40 : 46],
        ],
        i % 16 === 0 ? undefined : "m",
      );
    }
    out += text(16, 30, "0") + text(80, 30, "1") + text(144, 30, "2");
    return (
      out +
      path("M112,56 L108,64 H116 Z", "k") +
      text(112, 80, "1.5 → 24", "m", "tk")
    );
  },
  "double-buffering": () =>
    rect(14, 18, 54, 40, "f", 3) +
    rect(22, 40, 20, 12, "g") +
    text(41, 74, word("back")) +
    rect(92, 18, 54, 40, "f", 3) +
    rect(100, 26, 38, 26, "g") +
    text(119, 74, word("front"), "m", "tk") +
    arrow([72, 38], [88, 38]),
  "ray-casting": () => {
    let out = rect(10, 8, 140, 76, "f");
    out +=
      rect(110, 8, 40, 30, "g") +
      rect(10, 60, 50, 24, "g") +
      rect(96, 64, 54, 20, "g");
    const p: Pt = [52, 36];
    for (const q of [
      [110, 14],
      [110, 30],
      [112, 64],
      [86, 84],
      [60, 66],
    ] as Pt[])
      out += line([p, q], "m");
    return out + circle(p[0], p[1], 3.5, "k");
  },
};

/** A chip package: DIP (pins on two sides) or square (all four). */
function chip(square: boolean, label: string): string {
  let out = "";
  if (square) {
    out += rect(46, 12, 68, 66, "f", 3);
    for (let i = 0; i < 7; i++) {
      const t = 18 + i * 9;
      out +=
        line([
          [52 + i * 9, 12],
          [52 + i * 9, 4],
        ]) +
        line([
          [52 + i * 9, 78],
          [52 + i * 9, 86],
        ]);
      out +=
        line([
          [46, t + 2],
          [38, t + 2],
        ]) +
        line([
          [114, t + 2],
          [122, t + 2],
        ]);
    }
  } else {
    out += rect(40, 22, 80, 46, "f", 3) + path("M76,22 A4,4 0 0 0 84,22", "");
    for (let i = 0; i < 7; i++) {
      const x = 47 + i * 11;
      out +=
        line([
          [x, 22],
          [x, 12],
        ]) +
        line([
          [x, 68],
          [x, 78],
        ]);
    }
  }
  return out + text(80, 49, label, "m", "tk");
}

/** Voltage bands; `margin` shows outputs inside inputs' bands. */
function levels(margin: boolean): string {
  const col = (x: number, lo: number, hi: number, label: string) =>
    rect(x, 8, 34, hi - 8, "g") +
    rect(x, hi, 34, lo - hi, "f") +
    rect(x, lo, 34, 82 - lo, "g") +
    text(x + 17, 20, "1", "m", "tk") +
    text(x + 17, 76, "0", "m", "tk") +
    text(x + 17, 90, label, "m", "sm");
  if (!margin) return col(63, 54, 36, "V") + text(80, 48, "?");
  return (
    col(36, 70, 20, "out") +
    col(92, 54, 36, "in") +
    line(
      [
        [70, 20],
        [92, 20],
      ],
      "o",
    ) +
    line(
      [
        [70, 36],
        [92, 36],
      ],
      "o",
    ) +
    line([
      [81, 21],
      [81, 35],
    ])
  );
}

/** A half or full adder box. */
function adder(full: boolean): string {
  const ins = full ? ["a", "b", "cin"] : ["a", "b"];
  let out = box(58, 18, 44, 54, full ? "FA" : "HA");
  ins.forEach((s, i) => {
    const y = full ? 30 + i * 15 : 34 + i * 22;
    out +=
      line([
        [32, y],
        [58, y],
      ]) + text(28, y + 3, s, "e");
  });
  out +=
    line([
      [102, 34],
      [128, 34],
    ]) + text(132, 37, "s", "s");
  out +=
    line([
      [102, 56],
      [128, 56],
    ]) + text(132, 59, full ? "cout" : "c", "s");
  return out;
}

/** An instruction word cut into fields. */
function fields(): string {
  // The ALU format (docs/ISA.md): 000 | rd | ra | rb | f₁ f₀ invb cin.
  const parts: [string, number][] = [
    ["000", 3],
    ["rd", 3],
    ["ra", 3],
    ["rb", 3],
    ["f", 4],
  ];
  let x = 16;
  let out = text(16, 28, "15", "s", "sm") + text(144, 28, "0", "e", "sm");
  for (const [name, w] of parts) {
    out +=
      rect(x, 34, w * 8, 24, name === "000" ? "g" : "f") +
      text(x + w * 4, 50, name, "m", "tk");
    x += w * 8;
  }
  return out + text(80, 76, "ADD r1, r1, r2", "m", "code");
}

/** Lines of code in mono, left-aligned. */
function code(lines: string[]): string {
  return lines.map((l, i) => text(18, 20 + i * 15, l, "s", "tk code")).join("");
}

/** The tree of 2 + 3 × 4; `calls` labels the parser functions instead. */
function tree(calls = false): string {
  const nodes: [number, number, string][] = calls
    ? [
        [80, 16, "expr"],
        [44, 46, "term"],
        [116, 46, "term"],
        [92, 76, "factor"],
        [140, 76, "factor"],
      ]
    : [
        [80, 16, "+"],
        [44, 46, "2"],
        [116, 46, "×"],
        [92, 76, "3"],
        [140, 76, "4"],
      ];
  const edges: [number, number][] = [
    [0, 1],
    [0, 2],
    [2, 3],
    [2, 4],
  ];
  let out = edges
    .map(([a, b]) => {
      const p = nodes[a];
      const q = nodes[b];
      return p && q
        ? line(
            [
              [p[0], p[1] + 7],
              [q[0], q[1] - 7],
            ],
            "m",
          )
        : "";
    })
    .join("");
  for (const [x, y, s] of nodes)
    out += calls
      ? rect(x - 20, y - 8, 40, 15, "f", 7) + text(x, y + 3, s, "m", "tk sm")
      : circle(x, y, 9, "f") + text(x, y + 3.5, s, "m", "tk");
  return out;
}

/** The ids that have a picture. */
export const PICTURE_IDS: readonly string[] = Object.keys(PICTURES);

/** A term's picture as inline SVG, or "" if it has none; `words`
 * translates the few words a picture shows. */
export function glossaryPicture(
  id: string,
  words: (w: PictureWord) => string = (w) => w,
): string {
  const draw = PICTURES[id];
  if (!draw) return "";
  word = words;
  return `<svg class="gloss-pic" viewBox="0 0 160 90" aria-hidden="true" focusable="false">${draw()}</svg>`;
}
