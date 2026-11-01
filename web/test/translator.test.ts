import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import type { AsmProgram, VmBuilt, VmCommand, VmError } from "../src/sim/types";
import {
  checkProgram,
  fromAsmErrors,
  translateWith,
  type TranslatorStages,
} from "../src/translator";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

const j = <T>(s: string) => JSON.parse(s) as T;

/** The reference's stages through WASM, as a learner's would be called. */
const reference: TranslatorStages = {
  parse(line) {
    const r = j<{ ok: VmCommand | null } | { error: VmError }>(
      wasm.vmParse(line),
    );
    if ("error" in r) throw r.error;
    return r.ok;
  },
  translate: (cmd, ctx) =>
    j<string[]>(wasm.vmTranslate(JSON.stringify(cmd), JSON.stringify(ctx))),
  bootstrap: () => j<{ bootstrap: string[] }>(wasm.vmStart()).bootstrap,
  runtime: () => j<{ runtime: string[] }>(wasm.vmStart()).runtime,
};

const PROGRAMS = [
  "func main 0 0\npush 2\npush 3\nadd\nreturn",
  "func main 0 1\n; comment\n\npush global 7\nset local 0\npush 6\npush 7\nmul\nreturn\n",
  "func main 0 0\npush 3\ncall f 1\nreturn\nfunc f 1 0\npush arg 0\njumpif x\nlabel x\npush 9\nreturn",
  // Errors of every kind, several at once.
  "push 1\nfunc main 0 0\nreturn",
  "func main 0 0\npush 12ab\nfrob\njump nowhere\nreturn",
  "func main 0 0\npush 0\nreturn\nfunc main 0 0\npush 0\nreturn",
  "func main 0 0\nlabel a\nlabel a\npush 0\nreturn",
  "func main 0 0\ncall f 0\nreturn",
  "func main 0 0\npush 1\ncall f 1\nreturn\nfunc f 2 0\npush 0\nreturn",
  "func f 0 0\npush 0\nreturn",
  "func main 1 0\npush 0\nreturn",
  "func main 0 0\npush 0",
  "func main 0 0\nfunc f 0 0\npush 0\nreturn",
  "func main 0 1\npush local 1\nset arg 0\nreturn",
  "",
];

describe("translator glue", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("with the reference's stages, translates exactly as s2t-vm does", () => {
    for (const src of PROGRAMS) {
      const ours = translateWith(reference, src);
      const theirs = j<VmBuilt>(wasm.vmBuild(src));
      const key = (e: VmError) => [e.line, e.code, e.args];
      expect(ours.errors.map(key), src).toEqual(theirs.errors.map(key));
      expect(ours.lines, src).toEqual(theirs.lines);
      expect(ours.sourceMap, src).toEqual(theirs.sourceMap);
    }
  });

  it("the checks match s2t-vm's check on parsed commands", () => {
    for (const src of PROGRAMS) {
      const commands = src.split("\n").map((l) => {
        const r = j<{ ok?: VmCommand | null }>(wasm.vmParse(l));
        return r.ok ?? null;
      });
      expect(checkProgram(commands), src).toEqual(
        j<VmError[]>(wasm.vmCheck(JSON.stringify(commands))),
      );
    }
  });

  it("maps assembler errors back to the VM line", () => {
    const src = `func main 0 0\nlabel top\n${"push 1\npop\n".repeat(130)}jump top\npush 0\nreturn`;
    const t = translateWith(reference, src);
    const p = j<AsmProgram>(wasm.asmAssemble(t.lines.join("\n")));
    const errs = fromAsmErrors(p.errors, t.sourceMap);
    expect(errs.map((e) => [e.line, e.code])).toEqual([
      [263, "function-too-long"],
    ]);
    expect(j<VmBuilt>(wasm.vmBuild(src)).errors.map((e) => e.line)).toEqual([
      263,
    ]);
  });

  it("a stage that throws becomes an error on its line", () => {
    const broken: TranslatorStages = {
      ...reference,
      translate: (cmd, ctx) => {
        if (cmd.op === "add") throw { code: "todo", message: "TODO" };
        return reference.translate(cmd, ctx);
      },
    };
    const t = translateWith(
      broken,
      "func main 0 0\npush 1\npush 2\nadd\nreturn",
    );
    expect(t.errors.map((e) => [e.line, e.code])).toEqual([[4, "todo"]]);
    expect(t.lines).toEqual([]);
  });
});
