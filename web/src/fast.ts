// Which components run as their fast model. A per-browser preference in
// localStorage: losing it only means components run as the learner's own
// designs again, which is always correct. Each entry remembers a
// fingerprint of the design that passed the match check; if the design
// changes, the entry no longer applies until it's checked again.
import type { Design } from "./sim/types";

const KEY = "s2t-fast-models";

export type FastSet = Record<string, string>;

/** A short, stable fingerprint of a design's logic (ignores positions). */
export function fingerprint(d: Design): string {
  const logic = JSON.stringify({
    parts: d.parts.map(({ id, kind, width, repeat, shared }) => [
      id,
      kind,
      width,
      repeat,
      shared,
    ]),
    wires: d.wires,
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < logic.length; i++)
    h = Math.imul(h ^ logic.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
}

export function loadFast(): FastSet {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw ? JSON.parse(raw) : {};
    return typeof data === "object" && data !== null ? (data as FastSet) : {};
  } catch {
    return {};
  }
}

export function saveFast(set: FastSet): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(set));
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
}

/** Components whose fast mode still applies to their current design. */
export function activeFast(
  set: FastSet,
  designs: Record<string, Design | undefined>,
): string[] {
  return Object.entries(set)
    .filter(([id, print]) => {
      const d = designs[id];
      return d !== undefined && fingerprint(d) === print;
    })
    .map(([id]) => id)
    .sort();
}
