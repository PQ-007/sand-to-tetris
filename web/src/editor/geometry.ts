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
export function portPoint(
  name: string,
  inputs: string[],
  outputs: string[],
): Point | undefined {
  const place = (list: string[], x: number): Point | undefined => {
    const i = list.indexOf(name);
    if (i < 0) return undefined;
    const gap = CANVAS.height / (list.length + 1);
    return [x, Math.round((gap * (i + 1)) / GRID) * GRID];
  };
  return place(inputs, 60) ?? place(outputs, CANVAS.width - 60);
}

export function snap(p: Point): Point {
  return [Math.round(p[0] / GRID) * GRID, Math.round(p[1] / GRID) * GRID];
}

export function clampToCanvas(p: Point): Point {
  return [
    Math.min(CANVAS.width - 130, Math.max(130, p[0])),
    Math.min(CANVAS.height - 40, Math.max(40, p[1])),
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
  for (let y = 80; y <= CANVAS.height - 60; y += 80) {
    for (let x = 200; x <= CANVAS.width - 200; x += 90) {
      if (
        taken.every(
          ([tx, ty]) => Math.abs(tx - x) > 60 || Math.abs(ty - y) > 60,
        )
      )
        return [x, y];
    }
  }
  return [CANVAS.width / 2, CANVAS.height / 2];
}
