// TypeScript mirrors of the Rust core's JSON (s2t-netlist / s2t-checker).

export type Endpoint = { port: string } | { part: string; pin: string };

export interface Part {
  id: string;
  kind: string;
  pos?: [number, number];
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
  truth_table: string;
  hints: Record<string, string>;
}

export interface LevelInfo {
  level: Level;
  table: { inputs: [string, number][]; outputs: [string, number][] }[];
}

export interface Problem {
  severity: "error" | "warning";
  message: string;
  parts: string[];
  ports: string[];
}

export type Value = "0" | "1" | "Z" | "X";

export interface SimView {
  blocked: boolean;
  problems: Problem[];
  values: { endpoint: Endpoint; value: Value }[];
  transistors: { part: string; state: "on" | "off" | "maybe" }[];
  shorts: string[][];
  outputs: [string, Value][];
  settled: boolean;
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
}

/** Every level definition plus the learner's passed designs. */
export interface LibraryInput {
  levels: string[];
  unlocked: Design[];
}
