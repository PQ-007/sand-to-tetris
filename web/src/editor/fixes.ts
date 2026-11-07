// One-click fixes for the commonest bus mistake: a wire whose two ends
// carry different numbers of bits because a component isn't repeated (or a
// repeated one doesn't share its 1-bit input). Plus one-click wiring for
// the most repetitive job, wiring splitter and joiner bits one by one.
// Pure.
import type { Design, Endpoint, Part, Wire } from "../sim/types";
import { pinWidth, type ComponentPorts } from "./geometry";
import { sameEndpoint } from "./model";

export type Fix =
  | { kind: "repeat"; part: string; pin: string; n: number }
  | { kind: "share"; part: string; pin: string };

export function widthFixes(
  design: Design,
  portWidths: Record<string, number>,
  ports: ComponentPorts,
): Fix[] {
  const parts = new Map(design.parts.map((p) => [p.id, p]));
  const width = (e: Endpoint) => {
    if ("port" in e) return portWidths[e.port] ?? 1;
    const part = parts.get(e.part);
    return part ? pinWidth(part, e.pin, ports) : 1;
  };
  const fixes: Fix[] = [];
  const repeated = new Set<string>();
  const shared = new Set<string>();
  for (const w of design.wires) {
    const ends: [Endpoint, Endpoint][] = [
      [w.from, w.to],
      [w.to, w.from],
    ];
    for (const [end, other] of ends) {
      if (!("part" in end)) continue;
      const part = parts.get(end.part);
      if (!part || !ports[part.kind]) continue;
      const want = width(other);
      if (width(end) === want || part.shared?.includes(end.pin)) continue;
      const base = ports[part.kind]?.widths?.[end.pin] ?? 1;
      const repeat = part.repeat ?? 1;
      if (repeat > 1 && want === base) {
        const key = `${part.id}.${end.pin}`;
        if (!shared.has(key)) {
          shared.add(key);
          fixes.push({ kind: "share", part: part.id, pin: end.pin });
        }
      } else if (want % base === 0 && want > base && !repeated.has(part.id)) {
        repeated.add(part.id);
        fixes.push({
          kind: "repeat",
          part: part.id,
          pin: end.pin,
          n: want / base,
        });
      }
    }
  }
  return fixes;
}

export type WireFix =
  /** Continue the last splitter/joiner bit wire: bit i+k to bit j+k. */
  | { kind: "bits"; wires: Wire[] }
  /** Connect the last wire's source to every other free joiner bit. */
  | { kind: "fill"; part: string; source: Endpoint; wires: Wire[] };

interface BitPin {
  part: Part;
  bit: number;
  /** Joiner bits are inputs (one driver each); splitter bits are outputs. */
  input: boolean;
}

function bitPin(design: Design, e: Endpoint): BitPin | null {
  if (!("part" in e) || !/^\d+$/.test(e.pin)) return null;
  const part = design.parts.find((p) => p.id === e.part);
  if (!part || (part.kind !== "split" && part.kind !== "join")) return null;
  const bit = Number(e.pin);
  if (bit >= (part.width ?? 0)) return null;
  return { part, bit, input: part.kind === "join" };
}

/**
 * Wiring helpers offered after the learner's latest wire (the last one in
 * the design): if it joins a splitter bit to a joiner bit, the same
 * pattern continued over the following bits (or the preceding ones, if
 * it was drawn at the top bit); if it feeds a joiner bit from a 1-bit
 * source (a constant, an input), that source on every other free bit.
 * A joiner bit that already has a wire is never given a second one.
 */
export function bitWireFixes(
  design: Design,
  inputs: readonly string[],
  ports: ComponentPorts,
): WireFix[] {
  const last = design.wires[design.wires.length - 1];
  if (!last) return [];
  const wired = (e: Endpoint) =>
    design.wires.some((w) => sameEndpoint(w.from, e) || sameEndpoint(w.to, e));
  const at = (p: BitPin, bit: number): Endpoint => ({
    part: p.part.id,
    pin: String(bit),
  });
  const a = bitPin(design, last.from);
  const b = bitPin(design, last.to);

  if (a && b && a.input !== b.input) {
    // Usable means: in range, and a joiner bit with no wire yet.
    const usable = (p: BitPin, bit: number) =>
      bit >= 0 && bit < (p.part.width ?? 0) && !(p.input && wired(at(p, bit)));
    for (const step of [1, -1]) {
      const wires: Wire[] = [];
      for (let k = step; ; k += step) {
        if (!usable(a, a.bit + k) || !usable(b, b.bit + k)) break;
        wires.push({ from: at(a, a.bit + k), to: at(b, b.bit + k) });
      }
      if (wires.length) return [{ kind: "bits", wires }];
    }
    return [];
  }

  // A joiner bit fed from something that drives one bit.
  const drives = (e: Endpoint) => {
    if ("port" in e) return inputs.includes(e.port);
    const part = design.parts.find((p) => p.id === e.part);
    return Boolean(part && ports[part.kind]?.outputs.includes(e.pin));
  };
  const fill = (j: BitPin, source: Endpoint, sourceFirst: boolean) => {
    const wires: Wire[] = [];
    for (let bit = 0; bit < (j.part.width ?? 0); bit++) {
      const pin = at(j, bit);
      if (bit === j.bit || wired(pin)) continue;
      wires.push(
        sourceFirst ? { from: source, to: pin } : { from: pin, to: source },
      );
    }
    return wires.length
      ? [{ kind: "fill" as const, part: j.part.id, source, wires }]
      : [];
  };
  if (b?.input && !a && drives(last.from)) return fill(b, last.from, true);
  if (a?.input && !b && drives(last.to)) return fill(a, last.to, false);
  return [];
}
