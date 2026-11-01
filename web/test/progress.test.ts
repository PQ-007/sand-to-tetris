import { describe, expect, it } from "vitest";
import {
  memoryStore,
  parseProgressFile,
  progressFile,
  workshopFromFile,
} from "../src/progress";
import type { Progress } from "../src/game";

const progress: Progress = {
  not: {
    design: { format: 1, component: "not", parts: [], wires: [] },
    passed: true,
    updated: 1,
  },
};

describe("progress", () => {
  it("memory store keeps copies, not references", async () => {
    const s = memoryStore();
    await s.save("not", progress.not!);
    const loaded = await s.load();
    loaded.not!.passed = false;
    expect((await s.load()).not?.passed).toBe(true);
    expect(s.persistent).toBe(false);
  });

  it("export/import round-trips", () => {
    expect(parseProgressFile(progressFile(progress))).toEqual(progress);
  });

  it("rejects files that aren't progress, with a reason", () => {
    expect(parseProgressFile("nope")).toBe("That file isn't valid JSON.");
    expect(parseProgressFile("{}")).toBe(
      "That file isn't a Sand to Tetris progress file.",
    );
    const bad = JSON.stringify({
      app: "sand-to-tetris",
      progress: {
        not: { passed: true, design: { format: 1, component: "nand" } },
      },
    });
    expect(parseProgressFile(bad)).toBe('The entry for "not" is damaged.');
  });
  it("carries the workshop's code in the same file", () => {
    const workshop = {
      assembler: { code: "export {}", passed: true, updated: 1 },
    };
    const file = progressFile({}, workshop);
    expect(workshopFromFile(file)).toEqual(workshop);
    expect(workshopFromFile(progressFile({}))).toBe(null);
    expect(
      workshopFromFile(
        '{"app":"sand-to-tetris","progress":{},"workshop":{"x":1}}',
      ),
    ).toBe(null);
  });
});
