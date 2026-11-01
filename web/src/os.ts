// The OS (docs/OS.md): the built-in source, and putting an OS in front of
// a C Shard program with its lines mapped back. Pure.
import BUILTIN from "../../os/os.shard?raw";
import type { LangCompiled } from "./sim/types";

/** The built-in OS's C Shard source. */
export const BUILTIN_OS: string = BUILTIN;

/** The OS, then the program: one source text, and how many lines come
 * before the program's first. */
export function withOs(
  os: string,
  program: string,
): { source: string; offset: number } {
  const body = os.endsWith("\n") ? os : `${os}\n`;
  return { source: body + program, offset: body.split("\n").length - 1 };
}

/** A compiled OS + program, with errors and the source map on the
 * program's own lines; a line in the OS keeps its number and is marked. */
export function programLines(
  c: LangCompiled,
  offset: number,
): LangCompiled & { osErrors: boolean[] } {
  const at = (line: number) => (line > offset ? line - offset : 0);
  return {
    vm: c.vm,
    sourceMap: c.sourceMap.map(at),
    errors: c.errors.map((e) => ({
      ...e,
      line: e.line > offset ? e.line - offset : e.line,
    })),
    osErrors: c.errors.map((e) => e.line > 0 && e.line <= offset),
  };
}
