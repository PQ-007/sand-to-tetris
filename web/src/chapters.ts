export interface PlannedChapter {
  number: number;
  title: string;
  summary: string;
}

// The full course outline. Chapters with content in docs/chapters/ become
// links; the rest show as "coming soon".
export const CHAPTERS: readonly PlannedChapter[] = [
  {
    number: 0,
    title: "From sand to switch",
    summary:
      "What a computer is, how people computed before electronics, and how silicon becomes a transistor.",
  },
  {
    number: 1,
    title: "Transistors to gates",
    summary: "Wire NMOS and PMOS transistors into NOT, NAND and NOR gates.",
  },
  {
    number: 2,
    title: "Combinational logic",
    summary: "Multiplexers, decoders, adders and a 16-bit ALU.",
  },
  {
    number: 3,
    title: "Memory",
    summary: "Latches, flip-flops, registers, RAM and a program counter.",
  },
  {
    number: 4,
    title: "The CPU",
    summary:
      "An instruction set we design together, a datapath and a control unit.",
  },
  {
    number: 5,
    title: "Assembler",
    summary: "Turn readable assembly into the machine's binary.",
  },
  {
    number: 6,
    title: "VM and a language",
    summary:
      "A virtual machine, then a small high-level language compiled to it.",
  },
  {
    number: 7,
    title: "Mini OS",
    summary: "Screen, keyboard, timer and random numbers.",
  },
  {
    number: 8,
    title: "Tetris",
    summary: "Write Tetris in your language and play it on your computer.",
  },
];
