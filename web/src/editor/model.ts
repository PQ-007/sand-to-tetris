// Pure editing operations on a design. Every operation returns a new
// design (or an error message), which makes undo/redo trivial.
import type { Design, Endpoint, Part } from "../sim/types";

export const PRIMITIVES = ["pmos", "nmos", "vdd", "gnd"] as const;

export function emptyDesign(component: string): Design {
  return { format: 1, component, parts: [], wires: [] };
}

export function endpointKey(e: Endpoint): string {
  return "port" in e ? `port:${e.port}` : `pin:${e.part}.${e.pin}`;
}

export function sameEndpoint(a: Endpoint, b: Endpoint): boolean {
  return endpointKey(a) === endpointKey(b);
}

/** Readable name, e.g. "p1.gate" or "input a". */
export function endpointLabel(
  e: Endpoint,
  inputs: readonly string[] = [],
): string {
  if ("port" in e)
    return `${inputs.includes(e.port) ? "input" : "output"} ${e.port}`;
  return `${e.part}.${e.pin}`;
}

const PREFIX: Record<string, string> = {
  pmos: "p",
  nmos: "n",
  vdd: "vdd",
  gnd: "gnd",
};

/** Next free id for a kind: p1, p2… for PMOS; nand1… for components. */
export function nextId(design: Design, kind: string): string {
  const prefix = PREFIX[kind] ?? kind;
  const used = new Set(design.parts.map((p) => p.id));
  for (let i = 1; ; i++) if (!used.has(`${prefix}${i}`)) return `${prefix}${i}`;
}

export function addPart(
  design: Design,
  kind: string,
  pos: [number, number],
): { design: Design; id: string } {
  const id = nextId(design, kind);
  const part: Part = { id, kind, pos };
  // Buses in this course are 16 bits wide, so wiring parts start there.
  if (kind === "split" || kind === "join") part.width = 16;
  return { design: { ...design, parts: [...design.parts, part] }, id };
}

/**
 * Changes a part's options. A splitter or joiner that gets narrower loses
 * its wires to bits that no longer exist; `repeat: 1` clears the repeat.
 */
export function updatePart(
  design: Design,
  id: string,
  patch: { width?: number; repeat?: number; shared?: string[] },
): Design {
  const parts = design.parts.map((p) => {
    if (p.id !== id) return p;
    const next: Part = { ...p, ...patch };
    if (next.repeat !== undefined && next.repeat <= 1) {
      delete next.repeat;
      delete next.shared;
    }
    if (next.shared && next.shared.length === 0) delete next.shared;
    return next;
  });
  const width = parts.find((p) => p.id === id)?.width;
  const gone = (e: Endpoint) =>
    "part" in e &&
    e.part === id &&
    width !== undefined &&
    /^\d+$/.test(e.pin) &&
    Number(e.pin) >= width;
  return {
    ...design,
    parts,
    wires: design.wires.filter((w) => !gone(w.from) && !gone(w.to)),
  };
}

export function movePart(
  design: Design,
  id: string,
  pos: [number, number],
): Design {
  return {
    ...design,
    parts: design.parts.map((p) => (p.id === id ? { ...p, pos } : p)),
  };
}

/** Puts one of the design's own input/output ports somewhere else. */
export function movePort(
  design: Design,
  name: string,
  pos: [number, number],
): Design {
  return { ...design, port_pos: { ...design.port_pos, [name]: pos } };
}

/** Sends a moved port back to its default spot. */
export function resetPort(design: Design, name: string): Design {
  const rest = Object.fromEntries(
    Object.entries(design.port_pos ?? {}).filter(([k]) => k !== name),
  );
  const next: Design = { ...design, port_pos: rest };
  if (Object.keys(rest).length === 0) delete next.port_pos;
  return next;
}

/** A copy of a part (same kind and options) just below-right of it, unwired. */
export function duplicatePart(
  design: Design,
  id: string,
): { design: Design; id: string } | undefined {
  const part = design.parts.find((p) => p.id === id);
  if (!part) return undefined;
  const [x, y] = part.pos ?? [200, 200];
  const copy: Part = {
    ...part,
    id: nextId(design, part.kind),
    pos: [x + 40, y + 40],
  };
  if (part.shared) copy.shared = [...part.shared];
  return { design: { ...design, parts: [...design.parts, copy] }, id: copy.id };
}

const touches = (e: Endpoint, id: string) => "part" in e && e.part === id;

/** Endpoint belongs to a part, or is a port, of the given target. */
const touchesTarget = (e: Endpoint, t: { part: string } | { port: string }) =>
  "part" in t ? touches(e, t.part) : "port" in e && e.port === t.port;

/** Number of wires attached to a part or a port. */
/** Number of wires attached to a part (or one of its pins) or a port. */
export function wireCount(
  design: Design,
  target: { part: string } | { port: string },
  pin?: string,
): number {
  const at = (e: Endpoint) =>
    touchesTarget(e, target) &&
    (pin === undefined || ("pin" in e && e.pin === pin));
  return design.wires.filter((w) => at(w.from) || at(w.to)).length;
}

/** Removes every wire attached to a part or a port. */
export function disconnect(
  design: Design,
  target: { part: string } | { port: string },
): Design {
  return {
    ...design,
    wires: design.wires.filter(
      (w) => !touchesTarget(w.from, target) && !touchesTarget(w.to, target),
    ),
  };
}

export function removePart(design: Design, id: string): Design {
  return {
    ...design,
    parts: design.parts.filter((p) => p.id !== id),
    wires: design.wires.filter(
      (w) => !touches(w.from, id) && !touches(w.to, id),
    ),
  };
}

export function addWire(
  design: Design,
  from: Endpoint,
  to: Endpoint,
): Design | string {
  if (sameEndpoint(from, to)) return "A wire needs two different ends.";
  const dup = design.wires.some(
    (w) =>
      (sameEndpoint(w.from, from) && sameEndpoint(w.to, to)) ||
      (sameEndpoint(w.from, to) && sameEndpoint(w.to, from)),
  );
  if (dup) return "Those two are already connected.";
  return { ...design, wires: [...design.wires, { from, to }] };
}

export function removeWire(design: Design, index: number): Design {
  return { ...design, wires: design.wires.filter((_, i) => i !== index) };
}

/** Undo/redo over immutable designs. */
export class History {
  private past: Design[] = [];
  private future: Design[] = [];

  constructor(public current: Design) {}

  apply(next: Design): void {
    if (next === this.current) return;
    this.past.push(this.current);
    if (this.past.length > 200) this.past.shift();
    this.future = [];
    this.current = next;
  }

  /** Replaces the current design without a new undo step (e.g. mid-drag). */
  replace(next: Design): void {
    this.current = next;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.current);
    this.current = prev;
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.current);
    this.current = next;
  }
}
