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
    title: "The assembler",
    summary:
      "Write programs with names instead of numbers, and the program that turns them into binary.",
  },
  {
    number: 6,
    title: "The virtual machine",
    summary:
      "A stack machine of our own, and the translator that turns it into assembly.",
  },
  {
    number: 7,
    title: "The compiler",
    summary: "C Shard, a language we design together, and its compiler.",
  },
  {
    number: 8,
    title: "The operating system",
    summary: "Screen, text, keyboard, timer and random numbers, in C Shard.",
  },
  {
    number: 9,
    title: "Bitfall",
    summary:
      "An original falling-block game, played on the computer you built.",
  },
];
