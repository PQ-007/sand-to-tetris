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
  /** What every gate holds now, by gate path; pass it to the next
   * simulate call so memory carries over. */
  state: Record<string, string>;
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
