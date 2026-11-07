// The course roadmap: every level in the order we teach it, in small
// stages. Inside a stage, each level builds on the one just before it
// (AND, then AND16 from AND; MUX, then MUX16 from MUX, ...), so the next
// step always reuses what the learner just made. A test checks that every
// level appears exactly once and only after everything it requires.
// Stage titles and intros are in i18n (`stage.<id>`, `stage.<id>.intro`).

export interface Stage {
  id: string;
  layer: number;
  levels: string[];
}

export const ROADMAP: Stage[] = [
  { id: "gates", layer: 1, levels: ["not", "nand", "nor"] },
  { id: "const", layer: 1, levels: ["one", "zero"] },
  { id: "logic", layer: 2, levels: ["and", "or", "xor"] },
  { id: "wide", layer: 2, levels: ["not16", "and16", "or16", "xor16"] },
  {
    id: "choose",
    layer: 2,
    levels: ["mux", "mux16", "mux4way16", "mux8way16"],
  },
  { id: "route", layer: 2, levels: ["dmux", "dmux4way", "dmux8way"] },
  {
    id: "add",
    layer: 2,
    levels: ["halfadder", "fulladder", "add16", "addc16", "inc16"],
  },
  { id: "alu", layer: 2, levels: ["or8way", "shifter", "alu"] },
  { id: "bit", layer: 3, levels: ["srlatch", "dlatch", "dff", "bit"] },
  { id: "registers", layer: 3, levels: ["register", "regfile", "pc"] },
  {
    id: "ram",
    layer: 3,
    levels: ["ram8", "ram64", "ram512", "ram4k", "ram16k"],
  },
  { id: "control", layer: 4, levels: ["decode"] },
  { id: "cpu", layer: 4, levels: ["cpu"] },
  { id: "machine", layer: 4, levels: ["memory", "computer"] },
];

/** Each level's position in the roadmap (levels not in it are absent). */
export const ROADMAP_INDEX: ReadonlyMap<string, number> = new Map(
  ROADMAP.flatMap((s) => s.levels).map((id, i) => [id, i]),
);

/** The stage a level belongs to. */
export function stageOf(id: string): Stage | undefined {
  return ROADMAP.find((s) => s.levels.includes(id));
}

export interface Step {
  id: string;
  /** 1-based step number across the whole course. */
  n: number;
  stage: Stage;
  /** Parts it's built from that the step just before made (or used). */
  fresh: string[];
}

/**
 * The roadmap as numbered steps, keeping only levels that exist. `fresh`
 * marks the requirements the learner met one step earlier, which is what
 * makes a step feel like the next small move rather than a new topic.
 */
export function roadmapSteps(
  levels: { id: string; requires: string[] }[],
): Step[] {
  const byId = new Map(levels.map((l) => [l.id, l]));
  const steps: Step[] = [];
  let prev: { id: string; requires: string[] } | undefined;
  for (const stage of ROADMAP)
    for (const id of stage.levels) {
      const l = byId.get(id);
      if (!l) continue;
      const recent = new Set(prev ? [prev.id, ...prev.requires] : []);
      steps.push({
        id,
        n: steps.length + 1,
        stage,
        fresh: l.requires.filter((r) => recent.has(r)),
      });
      prev = l;
    }
  return steps;
}
