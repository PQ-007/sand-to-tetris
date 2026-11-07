// The Programs section (docs/programs/): each page's program, its language,
// its source file and the Machine example that runs it. A test checks every
// page has an entry and every example exists.
import type { Example } from "./machine-programs";

export interface ProgramInfo {
  example: Example["id"];
  lang: "c" | "shard";
  file: string;
}

export const PROGRAMS: Record<string, ProgramInfo> = {
  c: { example: "c-hello", lang: "c", file: "os/machine.h" },
  bitfall: { example: "bitfall", lang: "shard", file: "games/bitfall.shard" },
  wyrm: { example: "wyrm", lang: "c", file: "games/wyrm.c" },
  rally: { example: "rally", lang: "c", file: "games/rally.c" },
  shatter: { example: "shatter", lang: "c", file: "games/shatter.c" },
  swarm: { example: "swarm", lang: "c", file: "games/swarm.c" },
  debris: { example: "debris", lang: "c", file: "games/debris.c" },
  prowl: { example: "prowl", lang: "c", file: "games/prowl.c" },
  corridors: { example: "corridors", lang: "c", file: "games/corridors.c" },
};
