export type ChapterStatus = "planned" | "in-progress" | "ready";

export interface Chapter {
  number: number;
  title: string;
  summary: string;
  status: ChapterStatus;
}

// One chapter per layer; each layer uses only what the layers below built.
export const CHAPTERS: readonly Chapter[] = [
  {
    number: 0,
    title: "From sand to switch",
    summary:
      "What a computer is, how people computed before electronics, and how silicon becomes a transistor.",
    status: "planned",
  },
  {
    number: 1,
    title: "Transistors to gates",
    summary: "Wire NMOS and PMOS transistors into NOT, NAND and NOR gates.",
    status: "planned",
  },
  {
    number: 2,
    title: "Combinational logic",
    summary: "Multiplexers, decoders, adders and a 16-bit ALU.",
    status: "planned",
  },
  {
    number: 3,
    title: "Memory",
    summary: "Latches, flip-flops, registers, RAM and a program counter.",
    status: "planned",
  },
  {
    number: 4,
    title: "The CPU",
    summary:
      "An instruction set we design together, a datapath and a control unit.",
    status: "planned",
  },
  {
    number: 5,
    title: "Assembler",
    summary: "Turn readable assembly into the machine's binary.",
    status: "planned",
  },
  {
    number: 6,
    title: "VM and a language",
    summary:
      "A virtual machine, then a small high-level language compiled to it.",
    status: "planned",
  },
  {
    number: 7,
    title: "Mini OS",
    summary: "Screen, keyboard, timer and random numbers.",
    status: "planned",
  },
  {
    number: 8,
    title: "Tetris",
    summary: "Write Tetris in your language and play it on your computer.",
    status: "planned",
  },
];

export const STATUS_LABEL: Record<ChapterStatus, string> = {
  planned: "Coming soon",
  "in-progress": "In progress",
  ready: "Ready",
};
