// "Tidy up": lays a design out again so signals read left to right. Pure.
//
// Components (Layer 2 up) go in columns by how far they are from the
// inputs (the longest chain of parts feeding them), and each column is
// ordered to keep wires short and uncrossed (the barycentre heuristic:
// a part sits near the average height of what it's wired to). Feedback
// loops (latches) are cut where they turn back, so they still lay out.
//
// Transistor circuits (Layer 1) read top to bottom instead, like a CMOS
// schematic: VDD on top, PMOS below it, then NMOS, GND at the bottom, each
// transistor on the row its distance from the rail puts it on.
//
// Ports go beside what they're wired to: inputs on the left, outputs on
// the right. Only positions change, never the circuit.
import type { Design, Endpoint, Part } from "../sim/types";
import { GRID, type Point, type Shape } from "./geometry";

const INPUT_X = 100;
/** Room between columns for the wires' vertical runs. */
const COLUMN_GAP = 110;
/** Room between parts in a column, for names above and `sel` below. */
const ROW_GAP = 50;
const TOP = 70;
/** From the last column's right edge to the output pins (label boxes sit
 * right of them). */
const OUTPUT_GAP = 110;
/** Smallest distance between two ports on one side. */
const PORT_GAP = 40;

const TRANSISTORS = new Set(["nmos", "pmos", "vdd", "gnd"]);

const snapTo = (v: number) => Math.round(v / GRID) * GRID;

/** Whether a part pin carries signals into the part. */
function isInputPin(shape: Shape, pin: string): boolean {
  const spot = shape.pins.find((p) => p.pin === pin);
  return Boolean(spot && (spot.side === "left" || spot.vertical));
}

interface Ctx {
  design: Design;
  inputs: string[];
  outputs: string[];
  shapes: Map<string, Shape>;
}

/** The new positions: every part's centre and every port's pin. */
export interface Layout {
  parts: Record<string, Point>;
  ports: Record<string, Point>;
}

/**
 * Lays `design` out again. `shapeOf` gives each part's shape (as the
 * canvas draws it). Returns the design with new `pos` on every part and a
 * `port_pos` for every port.
 */
export function tidy(
  design: Design,
  inputs: string[],
  outputs: string[],
  shapeOf: (part: Part) => Shape,
): Design {
  if (!design.parts.length) return design;
  const ctx: Ctx = {
    design,
    inputs,
    outputs,
    shapes: new Map(design.parts.map((p) => [p.id, shapeOf(p)])),
  };
  const layout = design.parts.some((p) => TRANSISTORS.has(p.kind))
    ? cmos(ctx)
    : columns(ctx);
  return {
    ...design,
    parts: design.parts.map((p) => ({
      ...p,
      pos: layout.parts[p.id] ?? p.pos,
    })),
    port_pos: layout.ports,
  };
}

// ---- components: columns, left to right ---------------------------------------

function columns(ctx: Ctx): Layout {
  const { design, shapes } = ctx;
  const ids = design.parts.map((p) => p.id);
  // Which part drives which: a wire from an output pin (or an input port)
  // to an input pin.
  const preds = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
  const succs = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
  /** Each part's wires to ports: for ordering and for placing the ports. */
  const portLinks: { port: string; part: string; pin: string }[] = [];
  const side = (e: Endpoint): "src" | "sink" => {
    if ("port" in e) return ctx.inputs.includes(e.port) ? "src" : "sink";
    const shape = shapes.get(e.part);
    return shape && isInputPin(shape, e.pin) ? "sink" : "src";
  };
  for (const w of design.wires) {
    const [a, b] = side(w.from) === "src" ? [w.from, w.to] : [w.to, w.from];
    if ("part" in a && "part" in b && a.part !== b.part) {
      succs.get(a.part)?.add(b.part);
      preds.get(b.part)?.add(a.part);
    }
    for (const [p, q] of [
      [a, b],
      [b, a],
    ] as const)
      if ("port" in p && "part" in q)
        portLinks.push({ port: p.port, part: q.part, pin: q.pin });
  }

  // Cut feedback: depth-first from the parts nearest the inputs, dropping
  // edges back into the path being walked.
  const fedByInput = new Set(
    portLinks.filter((l) => ctx.inputs.includes(l.port)).map((l) => l.part),
  );
  const roots = [
    ...ids.filter((id) => fedByInput.has(id)),
    ...ids.filter((id) => !preds.get(id)?.size),
    ...ids,
  ];
  const state = new Map<string, 1 | 2>();
  const forward = new Map<string, string[]>(ids.map((id) => [id, []]));
  const visit = (id: string) => {
    state.set(id, 1);
    for (const next of succs.get(id) ?? []) {
      const s = state.get(next);
      if (s === 1) continue; // back edge: a loop
      forward.get(id)?.push(next);
      if (!s) visit(next);
    }
    state.set(id, 2);
  };
  for (const id of roots) if (!state.has(id)) visit(id);

  // Longest path from the inputs: a part's column.
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  const order: string[] = [];
  const done = new Set<string>();
  const topo = (id: string) => {
    if (done.has(id)) return;
    done.add(id);
    for (const n of forward.get(id) ?? []) topo(n);
    order.unshift(id);
  };
  for (const id of roots) topo(id);
  for (const id of order)
    for (const n of forward.get(id) ?? [])
      rank.set(n, Math.max(rank.get(n) ?? 0, (rank.get(id) ?? 0) + 1));

  const cols: string[][] = [];
  for (const id of ids) {
    const r = rank.get(id) ?? 0;
    (cols[r] ??= []).push(id);
  }
  const filled = cols.filter((c) => c?.length);

  // Order inside columns: start from where the learner had them, then a
  // few sweeps each way, each part moving toward its neighbours' average.
  const pos = new Map(design.parts.map((p) => [p.id, p.pos ?? [0, 0]]));
  for (const c of filled)
    c.sort((a, b) => (pos.get(a)?.[1] ?? 0) - (pos.get(b)?.[1] ?? 0));
  const index = new Map<string, number>();
  const portIndex = (port: string) =>
    ctx.inputs.includes(port)
      ? ctx.inputs.indexOf(port) / Math.max(1, ctx.inputs.length - 1)
      : ctx.outputs.indexOf(port) / Math.max(1, ctx.outputs.length - 1);
  const reindex = () =>
    filled.forEach((c) =>
      c.forEach((id, i) =>
        index.set(id, c.length > 1 ? i / (c.length - 1) : 0.5),
      ),
    );
  reindex();
  const centre = (
    id: string,
    near: Set<string> | undefined,
    ports: string[],
  ) => {
    const vals = [
      ...[...(near ?? [])].map((n) => index.get(n) ?? 0.5),
      ...ports.map(portIndex),
    ];
    return vals.length
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : (index.get(id) ?? 0.5);
  };
  const portsOf = (id: string, wantInputs: boolean) =>
    portLinks
      .filter(
        (l) => l.part === id && ctx.inputs.includes(l.port) === wantInputs,
      )
      .map((l) => l.port);
  for (let sweep = 0; sweep < 4; sweep++) {
    const list = sweep % 2 === 0 ? filled : [...filled].reverse();
    for (const c of list) {
      const key = new Map(
        c.map((id) => [
          id,
          sweep % 2 === 0
            ? centre(id, preds.get(id), portsOf(id, true))
            : centre(id, succs.get(id), portsOf(id, false)),
        ]),
      );
      c.sort((a, b) => (key.get(a) ?? 0) - (key.get(b) ?? 0));
      reindex();
    }
  }

  // Coordinates: columns side by side, each centred on the tallest.
  const heights = filled.map(
    (c) =>
      c.reduce((h, id) => h + (shapes.get(id)?.height ?? 40), 0) +
      ROW_GAP * (c.length - 1),
  );
  const tallest = Math.max(...heights);
  const parts: Record<string, Point> = {};
  let x = INPUT_X + 70;
  filled.forEach((c, i) => {
    const width = Math.max(...c.map((id) => shapes.get(id)?.width ?? 80));
    const cx = x + width / 2;
    let y = TOP + (tallest - (heights[i] ?? 0)) / 2;
    for (const id of c) {
      const h = shapes.get(id)?.height ?? 40;
      parts[id] = [snapTo(cx), snapTo(y + h / 2)];
      y += h + ROW_GAP;
    }
    x += width + COLUMN_GAP;
  });
  const right = x - COLUMN_GAP;
  return {
    parts,
    ports: placePorts(
      ctx,
      parts,
      portLinks,
      INPUT_X,
      snapTo(right + OUTPUT_GAP),
    ),
  };
}

// ---- transistors: rows, top to bottom ----------------------------------------------

function cmos(ctx: Ctx): Layout {
  const { design, shapes } = ctx;
  const kind = new Map(design.parts.map((p) => [p.id, p.kind]));
  // Channel connections: wires between transistor ends and rails (not
  // gates), part to part, or through a shared port.
  const channel = new Map<string, Set<string>>(
    design.parts.map((p) => [p.id, new Set()]),
  );
  const portLinks: { port: string; part: string; pin: string }[] = [];
  const isChannel = (e: Endpoint) =>
    "part" in e && TRANSISTORS.has(kind.get(e.part) ?? "") && e.pin !== "gate";
  const byPort = new Map<string, string[]>();
  for (const w of design.wires) {
    const { from: a, to: b } = w;
    if ("part" in a && "part" in b && isChannel(a) && isChannel(b)) {
      channel.get(a.part)?.add(b.part);
      channel.get(b.part)?.add(a.part);
    }
    for (const [p, q] of [
      [a, b],
      [b, a],
    ] as const)
      if ("port" in p && "part" in q) {
        portLinks.push({ port: p.port, part: q.part, pin: q.pin });
        if (isChannel(q))
          (byPort.get(p.port) ?? byPort.set(p.port, []).get(p.port))?.push(
            q.part,
          );
      }
  }
  // A shared output port joins the channels it touches (out ties the
  // PMOS and NMOS halves together).
  for (const list of byPort.values())
    for (const a of list)
      for (const b of list) if (a !== b) channel.get(a)?.add(b);

  /** Hops from the nearest rail of `rail` kind, through `via` transistors. */
  const distance = (rail: string, via: string) => {
    const d = new Map<string, number>();
    const queue = design.parts.filter((p) => p.kind === rail).map((p) => p.id);
    for (const id of queue) d.set(id, 0);
    while (queue.length) {
      const id = queue.shift() as string;
      for (const n of channel.get(id) ?? []) {
        if (d.has(n) || kind.get(n) !== via) continue;
        d.set(n, (d.get(id) ?? 0) + 1);
        queue.push(n);
      }
    }
    return d;
  };
  const fromVdd = distance("vdd", "pmos");
  const fromGnd = distance("gnd", "nmos");
  const pmosRows = Math.max(
    1,
    ...[...fromVdd.entries()]
      .filter(([id]) => kind.get(id) === "pmos")
      .map(([, v]) => v),
  );
  const nmosRows = Math.max(
    1,
    ...[...fromGnd.entries()]
      .filter(([id]) => kind.get(id) === "nmos")
      .map(([, v]) => v),
  );
  // Row 0: VDD; then PMOS rows; then NMOS rows (nearest GND lowest); GND.
  const rowOf = (p: Part): number => {
    if (p.kind === "vdd") return 0;
    if (p.kind === "pmos") return fromVdd.get(p.id) ?? 1;
    if (p.kind === "nmos")
      return pmosRows + 1 + nmosRows - (fromGnd.get(p.id) ?? nmosRows);
    if (p.kind === "gnd") return pmosRows + nmosRows + 1;
    return -1;
  };
  const rows: string[][] = [];
  const others: string[] = [];
  for (const p of design.parts) {
    const r = rowOf(p);
    if (r < 0) others.push(p.id);
    else (rows[r] ??= []).push(p.id);
  }
  // Inside a row: by the input driving the gate, then where it was.
  const gateInput = (id: string) => {
    const l = portLinks.find((x) => x.part === id && x.pin === "gate");
    const i = l ? ctx.inputs.indexOf(l.port) : -1;
    return i < 0 ? ctx.inputs.length : i;
  };
  const pos = new Map(design.parts.map((p) => [p.id, p.pos ?? [0, 0]]));
  const ROW_H = 100;
  const COL_W = 130;
  const left = INPUT_X + 110;
  // `rows` has holes (rows nobody sits on): count only the real ones.
  const widest = Math.max(1, ...rows.filter(Boolean).map((r) => r.length));
  const parts: Record<string, Point> = {};
  rows.forEach((r, i) => {
    if (!r) return;
    r.sort(
      (a, b) =>
        gateInput(a) - gateInput(b) ||
        (pos.get(a)?.[0] ?? 0) - (pos.get(b)?.[0] ?? 0),
    );
    const start = left + ((widest - r.length) * COL_W) / 2;
    r.forEach((id, k) => {
      parts[id] = [snapTo(start + k * COL_W), snapTo(TOP + i * ROW_H)];
    });
  });
  // Anything else (a component in Layer 1's optional levels) in a column
  // to the right.
  const otherX = left + widest * COL_W + 40;
  let y = TOP;
  for (const id of others) {
    const h = shapes.get(id)?.height ?? 40;
    parts[id] = [snapTo(otherX), snapTo(y + h / 2)];
    y += h + ROW_GAP;
  }
  const right = Math.max(
    ...Object.entries(parts).map(
      ([id, p]) => p[0] + (shapes.get(id)?.width ?? 60) / 2,
    ),
  );
  return {
    parts,
    ports: placePorts(
      ctx,
      parts,
      portLinks,
      INPUT_X,
      snapTo(right + OUTPUT_GAP),
    ),
  };
}

// ---- ports ------------------------------------------------------------------------------

/**
 * Each port beside the pins it's wired to (the average height), in the
 * level's order where it can't tell, and never closer than PORT_GAP.
 */
function placePorts(
  ctx: Ctx,
  parts: Record<string, Point>,
  links: { port: string; part: string; pin: string }[],
  inX: number,
  outX: number,
): Record<string, Point> {
  const out: Record<string, Point> = {};
  const pinY = (part: string, pin: string) => {
    const at = parts[part];
    const spot = ctx.shapes.get(part)?.pins.find((p) => p.pin === pin);
    return at && spot ? at[1] + spot.at[1] : undefined;
  };
  const ys = Object.values(parts).map((p) => p[1]);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const side = (names: string[], x: number) => {
    const wanted = names.map((name, i) => {
      const hits = links
        .filter((l) => l.port === name)
        .map((l) => pinY(l.part, l.pin))
        .filter((v): v is number => v !== undefined);
      const even = top + ((bottom - top) * (i + 1)) / (names.length + 1);
      return {
        name,
        y: hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : even,
        i,
      };
    });
    wanted.sort((a, b) => a.y - b.y || a.i - b.i);
    let last = -Infinity;
    for (const w of wanted) {
      const y = snapTo(Math.max(w.y, last + PORT_GAP, 30));
      out[w.name] = [x, y];
      last = y;
    }
  };
  side(ctx.inputs, inX);
  side(ctx.outputs, outX);
  return out;
}
