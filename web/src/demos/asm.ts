// The assembler demo's model: an instruction word split into its named bit
// fields (docs/ISA.md "Instruction formats"). No DOM.

export interface Field {
  /** A key for the field's label: group, rd, ra, rb, f, invb, cin, unused,
   * k, imm, reg, right, arith, amount, rs, off, cond, kind, link. */
  name: string;
  width: number;
  value: number;
}

/** The fields of `word`, from bit 15 down; their widths add up to 16. */
export function fieldsOf(word: number): Field[] {
  const w = word & 0xffff;
  const group = w >> 13;
  // Take fields from bit 12 down.
  let bit = 13;
  const take = (name: string, width: number): Field => {
    bit -= width;
    return { name, width, value: (w >> bit) & ((1 << width) - 1) };
  };
  const out: Field[] = [{ name: "group", width: 3, value: group }];
  const alu = () => [take("f", 2), take("invb", 1), take("cin", 1)];
  switch (group) {
    case 0:
      out.push(take("rd", 3), take("ra", 3), take("rb", 3), ...alu());
      break;
    case 1:
      out.push(take("unused", 3), take("ra", 3), take("rb", 3), ...alu());
      break;
    case 2:
      out.push(take("rd", 3), take("k", 2), take("imm", 8));
      break;
    case 3: {
      out.push(take("rd", 3), take("ra", 3));
      const reg = take("reg", 1);
      out.push(reg, take("right", 1), take("arith", 1));
      if (reg.value) out.push(take("unused", 1), take("rb", 3));
      else out.push(take("amount", 4));
      break;
    }
    case 4:
      out.push(take("rd", 3), take("ra", 3), take("off", 7));
      break;
    case 5:
      out.push(take("rs", 3), take("ra", 3), take("off", 7));
      break;
    case 6:
      out.push(take("cond", 3), take("off", 10));
      break;
    default: {
      const kind = take("kind", 1);
      out.push(kind);
      if (kind.value)
        out.push(take("link", 1), take("ra", 3), take("unused", 8));
      else out.push(take("off", 12));
    }
  }
  return out;
}

/** A field's bits as text, most significant first. */
export function bits(f: Field): string {
  return f.value.toString(2).padStart(f.width, "0");
}
