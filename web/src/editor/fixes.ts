// One-click fixes for the commonest bus mistake: a wire whose two ends
// carry different numbers of bits because a component isn't repeated (or a
// repeated one doesn't share its 1-bit input). Pure.
import type { Design, Endpoint } from "../sim/types";
import { pinWidth, type ComponentPorts } from "./geometry";

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
