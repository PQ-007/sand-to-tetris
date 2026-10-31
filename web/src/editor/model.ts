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
  return { design: { ...design, parts: [...design.parts, part] }, id };
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

const touches = (e: Endpoint, id: string) => "part" in e && e.part === id;

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
