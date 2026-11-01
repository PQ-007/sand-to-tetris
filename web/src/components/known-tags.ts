// Custom elements that chapter Markdown may use. The content build rejects
// any other hyphenated tag, and a test checks this list matches the
// components that actually call customElements.define.
export const KNOWN_TAGS = [
  "switch-timeline",
  "pn-junction",
  "mosfet-demo",
  "wafer-flow",
  "noise-chain",
  "switch-network",
  "ripple-adder",
  "latch-demo",
  "cpu-demo",
  "asm-demo",
  "stack-demo",
  "compile-demo",
  "font-demo",
  "bitrow-demo",
] as const;
