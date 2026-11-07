import { describe, expect, it } from "vitest";
import { loadLevels } from "../content/load";
import { en } from "../src/i18n/en";
import { mn } from "../src/i18n/mn";
import { ROADMAP, roadmapSteps, stageOf } from "../src/roadmap";

const levels = loadLevels(
  new URL("../../hdl/levels", import.meta.url).pathname,
).map((l) => {
  const id = /^id = "(.+)"$/m.exec(l.toml)?.[1] ?? "";
  const layer = Number(/^layer = (\d+)$/m.exec(l.toml)?.[1]);
  const req = /^requires = \[(.*)\]$/m.exec(l.toml)?.[1] ?? "";
  const requires = [...req.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
  return { id, layer, requires };
});

describe("course roadmap", () => {
  it("has every level exactly once", () => {
    const listed = ROADMAP.flatMap((s) => s.levels);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(levels.map((l) => l.id).sort());
  });

  it("puts every level in a stage of its own layer", () => {
    for (const l of levels) expect(stageOf(l.id)?.layer).toBe(l.layer);
  });

  it("goes up the layers in order", () => {
    const layers = ROADMAP.map((s) => s.layer);
    expect(layers).toEqual([...layers].sort((a, b) => a - b));
  });

  it("never asks for a part before the step that builds it", () => {
    const at = new Map(roadmapSteps(levels).map((s) => [s.id, s.n]));
    for (const l of levels)
      for (const r of l.requires)
        expect(at.get(r), `${l.id} needs ${r}`).toBeLessThan(at.get(l.id) ?? 0);
  });

  it("marks what the step before just built", () => {
    const steps = roadmapSteps(levels);
    const step = (id: string) => steps.find((s) => s.id === id);
    expect(step("mux16")?.fresh).toEqual(["mux"]);
    expect(step("ram64")?.fresh).toContain("ram8");
    expect(step("not")?.fresh).toEqual([]);
    expect(steps.map((s) => s.n)).toEqual(steps.map((_, i) => i + 1));
  });

  it("has a title and an intro for every stage in both languages", () => {
    for (const s of ROADMAP)
      for (const dict of [en, mn] as Record<string, unknown>[]) {
        expect(dict[`stage.${s.id}`], s.id).toBeTruthy();
        expect(dict[`stage.${s.id}.intro`], s.id).toBeTruthy();
      }
  });
});
