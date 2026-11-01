// TypeScript mirrors of the Rust core's JSON (s2t-netlist / s2t-checker).

export type Endpoint = { port: string } | { part: string; pin: string };

export interface Part {
  id: string;
  kind: string;
  pos?: [number, number];
  /** Bus width of a split/join part. */
  width?: number;
  /** Repeat a component this many times, one copy per bit slice. */
  repeat?: number;
  /** With repeat: input pins every copy shares. */
  shared?: string[];
}

export interface Wire {
  from: Endpoint;
  to: Endpoint;
}

export interface Design {
  format: 1;
  component: string;
  parts: Part[];
  wires: Wire[];
  /** Editor-only: where moved ports are drawn, by port name. */
  port_pos?: Record<string, [number, number]>;
}

export interface Level {
  id: string;
  name: string;
  layer: number;
  goal: string;
  inputs: string[];
  outputs: string[];
  requires: string[];
  optional: boolean;
  /** Rows are steps run in order on one circuit (it has memory). */
  sequential: boolean;
  /** Bits per port, for multi-bit ports only. */
  widths?: Record<string, number>;
  model?: string;
  random_tests?: number;
  truth_table: string;
  hints: Record<string, string>;
}

export interface LevelInfo {
  level: Level;
  table: {
    inputs: [string, number][];
    outputs: [string, number][];
    /** Outputs written `-`: any value is fine (sequential levels). */
    skip: string[];
  }[];
}

export interface Problem {
  severity: "error" | "warning";
  message: string;
  /** Kind of problem (e.g. `output-unconnected`) and the values its message
   * mentions, for showing it in the learner's language. */
  code: string;
  args: Record<string, string>;
  parts: string[];
  ports: string[];
}

/** A single bit (0, 1, Z, X), a bus as a decimal number, or a bus's bits
 * (most significant first) when some are unknown. */
export type Value = string;

export interface SimView {
  blocked: boolean;
  problems: Problem[];
  values: { endpoint: Endpoint; value: Value; width: number }[];
  transistors: { part: string; state: "on" | "off" | "maybe" }[];
  shorts: string[][];
  outputs: [string, Value][];
  settled: boolean;
  /** Gate delays until settled (Layer 2 and up). */
  depth: number;
  /** Gates simulated (Layer 2 and up). */
  cells: number;
  /** What every gate holds now, by gate path; pass it to the next
   * simulate call so memory carries over. */
  state: Record<string, string>;
}

export interface StepsView {
  /** The circuit after the last step (with its state). */
  view: SimView;
  /** Output values after each step. */
  outputs: [string, Value][][];
}

export interface Diagnostic {
  row: number;
  inputs: [string, string][];
  port: string;
  expected: string;
  actual: string;
  kind: "wrong" | "floating" | "short" | "unknown";
  message: string;
  hint: string | null;
  parts: string[];
  ports: string[];
}

export interface Report {
  component: string;
  passed: boolean;
  problems: Problem[];
  rows: {
    inputs: [string, string][];
    outputs: [string, string, string][];
    passed: boolean;
  }[];
  diagnostics: Diagnostic[];
  transistors: number;
  cells: number;
  depth: number;
  random: { run: number; failed: number } | null;
}

/** Every level definition plus the learner's passed designs. */
export interface LibraryInput {
  levels: string[];
  unlocked: Design[];
  /** Components running as fast models. */
  fast?: string[];
}

export interface MatchReport {
  component: string;
  ok: boolean;
  exhaustive: boolean;
  compared: number;
  failed: number;
  mismatches: {
    inputs: [string, string][];
    expected: [string, string][];
    actual: [string, string][];
  }[];
}

/** The reference CPU's state (s2t-isa), as `isaTrace` reports it. */
export interface IsaState {
  pc: number;
  regs: number[];
  z: boolean;
  n: boolean;
  c: boolean;
}

/** A program run from reset: `states[0]` is the start, `states[i + 1]`
 * follows instruction i; `writes[i]` is what it stored, if anything. */
export interface IsaTrace {
  states: IsaState[];
  writes: ([number, number] | null)[];
}

// ---- the assembler (docs/ASSEMBLY.md; mirrors s2t-asm's JSON) ----------------

export type AsmToken =
  | { kind: "label"; name: string }
  | { kind: "ident"; text: string }
  | { kind: "directive"; name: string }
  | { kind: "number"; value: number }
  | { kind: "comma" }
  | { kind: "lbracket" }
  | { kind: "rbracket" }
  | { kind: "plus" };

export type AsmOperand =
  | { kind: "reg"; reg: number }
  | { kind: "num"; value: number }
  | { kind: "sym"; name: string }
  | { kind: "mem"; reg: number; offset: AsmOperand };

export type AsmBody =
  | { kind: "instr"; mnemonic: string; args: AsmOperand[] }
  | { kind: "dir"; name: string; args: AsmOperand[] };

export interface AsmLine {
  label: string | null;
  body: AsmBody | null;
}

export interface AsmSymbol {
  kind: "code" | "data" | "const";
  value: number;
}

export interface AsmPlaced {
  section: "code" | "data";
  address: number;
  size: number;
}

export interface AsmLayout {
  symbols: Record<string, AsmSymbol>;
  lines: (AsmPlaced | null)[];
}

export interface AsmError {
  /** 1-based source line; 0 when a stage runs on its own. */
  line: number;
  code: string;
  args: Record<string, string>;
  message: string;
}

export interface AsmProgram {
  code: number[];
  data: number[];
  symbols: Record<string, AsmSymbol>;
  /** For each code word, its 1-based source line. */
  sourceMap: number[];
  errors: AsmError[];
}

export type StageResult<T> = { ok: T } | { error: AsmError };

// ---- the VM (docs/VM.md; mirrors s2t-vm's JSON) ---------------------------------

export type VmSeg = "const" | "local" | "arg" | "global";

/** The commands without operands. */
export type VmSimpleOp =
  | "pop"
  | "dup"
  | "load"
  | "store"
  | "add"
  | "sub"
  | "and"
  | "or"
  | "xor"
  | "neg"
  | "not"
  | "shl"
  | "shr"
  | "sar"
  | "mul"
  | "div"
  | "mod"
  | "eq"
  | "ne"
  | "lt"
  | "gt"
  | "le"
  | "ge"
  | "return";

export type VmCommand =
  | { op: "push" | "set"; seg: VmSeg; n: number }
  | { op: "label" | "jump" | "jumpif" | "jumpifnot"; name: string }
  | { op: "func"; name: string; args: number; locals: number }
  | { op: "call"; name: string; args: number }
  | { op: VmSimpleOp };

/** What translate gets besides the command. */
export interface VmCtx {
  func: string;
  args: number;
  locals: number;
  line: number;
}

/** Same shape as the assembler's errors. */
export type VmError = AsmError;

export interface VmBuilt {
  /** The assembly, one line each. */
  lines: string[];
  /** For each assembly line, its VM line (0: bootstrap, runtime, data). */
  sourceMap: number[];
  program: AsmProgram;
  errors: VmError[];
}

export type VmRunResult =
  | {
      halted: boolean;
      result: number;
      steps: number;
      /** RAM 0..63 (the globals live at the start). */
      ram: number[];
      screen: number[];
    }
  | { errors: VmError[] };

export interface VmFrame {
  func: string;
  fp: number;
  args: number;
  locals: number;
}
