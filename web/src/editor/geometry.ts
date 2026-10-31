// Where things are drawn: part sizes, pin positions, port positions and
// wire routes. Pure functions, so the layout is testable.

export const CANVAS = { width: 760, height: 460 };
export const GRID = 10;

export type Point = [number, number];

export interface PinSpot {
  pin: string;
  /** Offset from the part's position (its centre). */
  at: Point;
  /** Which side the pin's label goes on. */
  side: "left" | "right" | "top" | "bottom";
}

export interface Shape {
  width: number;
  height: number;
  pins: PinSpot[];
}

/** Ports (and bus widths) of each component kind. */
export type ComponentPorts = Record<
  string,
  {
    inputs: string[];
    outputs: string[];
    name: string;
    widths?: Record<string, number>;
  }
>;

/** The fields of a part that affect its shape and pin widths. */
export interface PartLike {
  id?: string;
  kind: string;
  width?: number;
  repeat?: number;
  shared?: string[];
}

/** Splitter and joiner pin spacing (one pin per bit). */
const BIT_GAP = 14;

/**
 * The shape of a part, taking its options into account: splitters and
 * joiners get one pin per bit; repeated components keep their normal shape
 * (their pins just carry more bits).
 */
export function shapeOfPart(part: PartLike, ports: ComponentPorts): Shape {
  if (part.kind === "split" || part.kind === "join") {
    const n = Math.max(2, part.width ?? 2);
    const height = n * BIT_GAP + 16;
    const top = -height / 2 + 8 + BIT_GAP / 2;
    const bits = Array.from({ length: n }, (_, i) => ({
      pin: String(i),
      at: [part.kind === "split" ? 14 : -14, top + i * BIT_GAP] as Point,
      side: (part.kind === "split" ? "right" : "left") as "left" | "right",
    }));
    const bus = {
      pin: part.kind === "split" ? "in" : "out",
      at: [part.kind === "split" ? -14 : 14, 0] as Point,
      side: (part.kind === "split" ? "left" : "right") as "left" | "right",
    };
    return {
      width: 28,
      height,
      pins: part.kind === "split" ? [bus, ...bits] : [...bits, bus],
    };
  }
  return shapeOf(part.kind, ports[part.kind]);
}

/** Bits carried by one pin of a part. */
export function pinWidth(
  part: PartLike,
  pin: string,
  ports: ComponentPorts,
): number {
  if (part.kind === "split") return pin === "in" ? (part.width ?? 1) : 1;
  if (part.kind === "join") return pin === "out" ? (part.width ?? 1) : 1;
  const base = ports[part.kind]?.widths?.[pin] ?? 1;
  return part.shared?.includes(pin) ? base : base * (part.repeat ?? 1);
}

/**
 * Transistor symbols put the gate on the left. NMOS: drain on top, source
 * at the bottom (sources usually go toward GND). PMOS: source on top
 * (toward VDD), drain at the bottom.
 */
export function shapeOf(
  kind: string,
  ports?: { inputs: string[]; outputs: string[] },
): Shape {
  switch (kind) {
    case "nmos":
      return {
        width: 60,
        height: 60,
        pins: [
          { pin: "gate", at: [-30, 0], side: "left" },
          { pin: "drain", at: [10, -30], side: "top" },
          { pin: "source", at: [10, 30], side: "bottom" },
        ],
      };
    case "pmos":
      return {
        width: 60,
        height: 60,
        pins: [
          { pin: "gate", at: [-30, 0], side: "left" },
          { pin: "source", at: [10, -30], side: "top" },
          { pin: "drain", at: [10, 30], side: "bottom" },
        ],
      };
    case "vdd":
      return {
        width: 50,
        height: 30,
        pins: [{ pin: "out", at: [0, 15], side: "bottom" }],
      };
    case "gnd":
      return {
        width: 50,
        height: 30,
        pins: [{ pin: "out", at: [0, -15], side: "top" }],
      };
    default: {
      const ins = ports?.inputs ?? [];
      const outs = ports?.outputs ?? [];
      const rows = Math.max(ins.length, outs.length, 1);
      const height = rows * 20 + 20;
      const column = (names: string[], x: number, side: "left" | "right") =>
        names.map((pin, i) => ({
          pin,
          at: [
            x,
            -height / 2 + 20 + i * 20 + (rows - names.length) * 10,
          ] as Point,
          side,
        }));
      return {
        width: 80,
        height,
        pins: [...column(ins, -40, "left"), ...column(outs, 40, "right")],
      };
    }
  }
}

export function pinPoint(
  pos: Point,
  shape: Shape,
  pin: string,
): Point | undefined {
  const spot = shape.pins.find((p) => p.pin === pin);
  return spot ? [pos[0] + spot.at[0], pos[1] + spot.at[1]] : undefined;
}

/** Inputs down the left edge, outputs down the right edge. */
export interface Size {
  width: number;
  height: number;
}

/** The largest a canvas may grow to. */
export const MAX_CANVAS: Size = { width: 2400, height: 1600 };

/**
 * Canvas size for a set of parts: at least the default, and big enough
 * to leave room around the furthest part (so dragging toward an edge
 * makes the canvas grow).
 */
export function canvasSize(parts: { pos?: Point; shape: Shape }[]): Size {
  let right = 0;
  let bottom = 0;
  for (const { pos, shape } of parts) {
    if (!pos) continue;
    right = Math.max(right, pos[0] + shape.width / 2);
    bottom = Math.max(bottom, pos[1] + shape.height / 2);
  }
  const fit = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.ceil(v / 40) * 40));
  return {
    width: fit(right + 200, CANVAS.width, MAX_CANVAS.width),
    height: fit(bottom + 80, CANVAS.height, MAX_CANVAS.height),
  };
}

export function portPoint(
  name: string,
  inputs: string[],
  outputs: string[],
  size: Size = CANVAS,
): Point | undefined {
  const place = (list: string[], x: number): Point | undefined => {
    const i = list.indexOf(name);
    if (i < 0) return undefined;
    const gap = size.height / (list.length + 1);
    return [x, Math.round((gap * (i + 1)) / GRID) * GRID];
  };
  return place(inputs, 60) ?? place(outputs, size.width - 60);
}

export function snap(p: Point): Point {
  return [Math.round(p[0] / GRID) * GRID, Math.round(p[1] / GRID) * GRID];
}

/** Keeps a part inside the largest canvas (and clear of the ports). */
export function clampToCanvas(p: Point): Point {
  return [
    Math.min(MAX_CANVAS.width - 130, Math.max(130, p[0])),
    Math.min(MAX_CANVAS.height - 40, Math.max(40, p[1])),
  ];
}

/** Right-angle route: across to the midpoint, down/up, then across. */
export function route(a: Point, b: Point): Point[] {
  if (a[0] === b[0] || a[1] === b[1]) return [a, b];
  const midX = Math.round((a[0] + b[0]) / 2 / GRID) * GRID;
  return [a, [midX, a[1]], [midX, b[1]], b];
}

export function pathData(points: Point[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
}

/** Midpoint along a route (for its value label). */
export function labelPoint(points: Point[]): Point {
  const first = points[0] ?? [0, 0];
  const last = points[points.length - 1] ?? first;
  if (points.length === 4) {
    const b = points[1] ?? first;
    const c = points[2] ?? last;
    return [b[0], (b[1] + c[1]) / 2];
  }
  return [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
}

/** A free spot for a new part: scan the grid for room. */
export function freeSpot(taken: Point[]): Point {
  for (let y = 110; y <= CANVAS.height - 70; y += 110) {
    for (let x = 220; x <= CANVAS.width - 200; x += 120) {
      if (
        taken.every(
          ([tx, ty]) => Math.abs(tx - x) > 80 || Math.abs(ty - y) > 80,
        )
      )
        return [x, y];
    }
  }
  return [CANVAS.width / 2, CANVAS.height / 2];
}
