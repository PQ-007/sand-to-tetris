// Schematic symbols: which shape each component is drawn with, and the SVG
// path data for it. Gates get the usual distinctive shapes (a D for AND, a
// shield for OR, a triangle for NOT, a bubble for "inverted"), selectors get
// trapezoids, and everything else stays a labelled box. Pure, so the shapes
// are testable; canvas.ts and the toolbox draw them.
import type { Point, Shape } from "./geometry";

export type Gate = "not" | "and" | "or" | "xor";

export type PartSymbol =
  /** A logic gate; `bits` is shown inside when it works on a whole bus. */
  | { kind: "gate"; gate: Gate; invert: boolean; bits?: number }
  /** Many inputs, one chosen by `sel` (pin at the bottom). */
  | { kind: "mux" }
  /** One input, sent to the output `sel` picks (pin at the bottom). */
  | { kind: "dmux" }
  /** A fixed 0 or 1. */
  | { kind: "const"; value: 0 | 1 }
  | { kind: "box" };

const SYMBOLS: Record<string, PartSymbol> = {
  not: { kind: "gate", gate: "not", invert: true },
  nand: { kind: "gate", gate: "and", invert: true },
  nor: { kind: "gate", gate: "or", invert: true },
  and: { kind: "gate", gate: "and", invert: false },
  or: { kind: "gate", gate: "or", invert: false },
  xor: { kind: "gate", gate: "xor", invert: false },
  not16: { kind: "gate", gate: "not", invert: true, bits: 16 },
  and16: { kind: "gate", gate: "and", invert: false, bits: 16 },
  or16: { kind: "gate", gate: "or", invert: false, bits: 16 },
  xor16: { kind: "gate", gate: "xor", invert: false, bits: 16 },
  or8way: { kind: "gate", gate: "or", invert: false, bits: 8 },
  mux: { kind: "mux" },
  mux16: { kind: "mux" },
  mux4way16: { kind: "mux" },
  mux8way16: { kind: "mux" },
  dmux: { kind: "dmux" },
  dmux4way: { kind: "dmux" },
  dmux8way: { kind: "dmux" },
  one: { kind: "const", value: 1 },
  zero: { kind: "const", value: 0 },
};

export function symbolOf(kind: string): PartSymbol {
  return SYMBOLS[kind] ?? { kind: "box" };
}

/** True for symbols that already say what the part is (no pin names). */
export function hidesPinNames(sym: PartSymbol): boolean {
  return sym.kind === "gate" || sym.kind === "const";
}

/** Gate bodies are this tall, centred on the part's position. */
const BODY = 40;
const BUBBLE = 4;

/** Where the body's back edge is at height `y` (input leads end there). */
function backX(gate: Gate, y: number): number {
  if (gate === "not") return -18;
  if (gate === "and") return -20;
  // The back of OR is a quadratic curve from (-24,-20) through (-18,0).
  const t = (y / (BODY / 2) + 1) / 2;
  const x = -24 + 24 * t * (1 - t);
  return gate === "xor" ? x - 6 : x;
}

/** Where the body's tip is (the output lead, or the bubble, starts there). */
function tipX(gate: Gate): number {
  return gate === "not" ? 14 : 20;
}

export interface SymbolPaths {
  /** The filled outline. */
  body: string;
  /** Extra strokes: input and output leads, XOR's second curve. */
  lines: string;
  /** Centre of the inversion bubble, if any. */
  bubble?: Point;
  /** Where text inside the body goes (a bus width, a constant's value). */
  text?: { at: Point; value: string };
}

/**
 * Path data for a symbol drawn on `shape` (its pins decide where the leads
 * go). Undefined for plain boxes.
 */
export function symbolPaths(
  sym: PartSymbol,
  shape: Shape,
): SymbolPaths | undefined {
  const leads: string[] = [];
  const lead = (from: Point, to: Point) =>
    leads.push(`M${from[0]},${from[1]} L${to[0]},${to[1]}`);
  switch (sym.kind) {
    case "gate": {
      const h = BODY / 2;
      const body =
        sym.gate === "not"
          ? "M-18,-15 L14,0 L-18,15 Z"
          : sym.gate === "and"
            ? `M-20,-${h} H0 A${h},${h} 0 0 1 0,${h} H-20 Z`
            : `M-24,-${h} Q-12,0 -24,${h} Q6,${h} 20,0 Q6,-${h} -24,-${h} Z`;
      if (sym.gate === "xor") leads.push(`M-30,-${h} Q-18,0 -30,${h}`);
      const tip = tipX(sym.gate);
      const out = tip + (sym.invert ? 2 * BUBBLE : 0);
      for (const p of shape.pins) {
        if (p.side === "left") lead(p.at, [backX(sym.gate, p.at[1]), p.at[1]]);
        else lead([out, p.at[1]], p.at);
      }
      return {
        body,
        lines: leads.join(" "),
        bubble: sym.invert ? [tip + BUBBLE, 0] : undefined,
        text: sym.bits
          ? {
              at: [sym.gate === "not" ? -6 : -4, 4],
              value: String(sym.bits),
            }
          : undefined,
      };
    }
    case "mux":
    case "dmux": {
      const top = -shape.height / 2;
      const bottom = shape.height / 2;
      // The wide side faces the many pins: inputs for a MUX, outputs for a
      // DMUX.
      const [l, r] = sym.kind === "mux" ? [4, 14] : [14, 4];
      const body = `M-20,${top + l} L20,${top + r} L20,${bottom - r} L-20,${bottom - l} Z`;
      for (const p of shape.pins) {
        if (p.side === "left") lead(p.at, [-20, p.at[1]]);
        else if (p.side === "right") lead([20, p.at[1]], p.at);
        else lead([p.at[0], bottom - (l + r) / 2], p.at);
      }
      return { body, lines: leads.join(" ") };
    }
    case "const":
      lead([8, 0], [shape.width / 2, 0]);
      return {
        body: "M-20,-10 H8 V10 H-20 Z",
        lines: leads.join(" "),
        text: { at: [-6, 4], value: String(sym.value) },
      };
    case "box":
      return undefined;
  }
}
