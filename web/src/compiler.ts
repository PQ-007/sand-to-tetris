// The glue around a C Shard compiler's four stages (docs/LANGUAGE.md "How
// it's built"): run them in order and turn what they throw into errors.
// The learner writes the stages; the same glue runs theirs on the Machine
// page. Pure: runs in the worker and in vitest.
import type {
  LangCompiled,
  LangInfo,
  LangProgram,
  LangToken,
} from "./sim/types";
import { errorOf } from "./translator";

export interface CompilerStages {
  tokenize(source: string): LangToken[];
  parse(tokens: LangToken[]): LangProgram;
  check(program: LangProgram): LangInfo;
  generate(program: LangProgram, info: LangInfo): string[];
}

/** All four stages over a source text, like s2t-lang's `compile` (the
 * first mistake stops it; no source map). */
export function compileWith(
  stages: CompilerStages,
  source: string,
): LangCompiled {
  try {
    const program = stages.parse(stages.tokenize(source));
    const vm = stages.generate(program, stages.check(program));
    if (!Array.isArray(vm))
      throw Object.assign(new Error("generate must return VM lines"), {
        code: "not-lines",
      });
    return { vm: vm.map(String), sourceMap: [], errors: [] };
  } catch (e) {
    return { vm: [], sourceMap: [], errors: [errorOf(e, 0)] };
  }
}
