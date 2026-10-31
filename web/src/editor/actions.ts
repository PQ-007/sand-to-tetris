// What the right-click (context) menu offers for each thing on the canvas.
// Pure: the play page maps each entry's id to the edit it performs.
import type { Design, Endpoint } from "../sim/types";
import { endpointKey, endpointLabel, sameEndpoint, wireCount } from "./model";
import type { Point } from "./geometry";

/** What was right-clicked. */
export type MenuTarget =
  | { kind: "part"; id: string }
  | { kind: "wire"; index: number }
  | { kind: "port"; name: string }
  | { kind: "canvas"; at: Point };

export interface MenuEntry {
  id: string;
  label: string;
  /** Keyboard shortcut shown on the right, e.g. "Del". */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuContext {
  design: Design;
  inputs: string[];
  outputs: string[];
  /** Kinds that are components (built in earlier levels). */
  components: Set<string>;
  /** Whether a part's own design can be opened (it has a saved design). */
  canLookInside(partId: string): boolean;
  /** Whether a part has options (bus width, repeat). */
  hasOptions(partId: string): boolean;
  tools: { kind: string; label: string }[];
  /** Bits per port; buses take a typed value instead of a flip. */
  widths?: Record<string, number>;
  canUndo: boolean;
  canRedo: boolean;
}

export function menuFor(
  target: MenuTarget,
  ctx: MenuContext,
): { title: string; entries: (MenuEntry | "separator")[] } {
  switch (target.kind) {
    case "part": {
      const part = ctx.design.parts.find((p) => p.id === target.id);
      const kind = part?.kind ?? "";
      const name =
        ctx.tools.find((t) => t.kind === kind)?.label ?? kind.toUpperCase();
      const entries: (MenuEntry | "separator")[] = [];
      if (ctx.components.has(kind) && ctx.canLookInside(target.id))
        entries.push({
          id: "look-inside",
          label: "Look inside",
          hint: "Enter",
        });
      if (ctx.hasOptions(target.id))
        entries.push({ id: "options", label: "Options…" });
      if (entries.length) entries.push("separator");
      entries.push(
        { id: "connect", label: "Connect…" },
        {
          id: "disconnect",
          label: "Disconnect…",
          disabled: wireCount(ctx.design, { part: target.id }) === 0,
        },
        { id: "duplicate", label: "Duplicate" },
        "separator",
        { id: "delete", label: "Delete", hint: "Del", danger: true },
      );
      return { title: `${target.id} (${name})`, entries };
    }
    case "wire": {
      const w = ctx.design.wires[target.index];
      const title = w
        ? `Wire ${endpointLabel(w.from, ctx.inputs)} — ${endpointLabel(w.to, ctx.inputs)}`
        : "Wire";
      return {
        title,
        entries: [
          { id: "delete", label: "Delete wire", hint: "Del", danger: true },
        ],
      };
    }
    case "port": {
      const isInput = ctx.inputs.includes(target.name);
      const bus = (ctx.widths?.[target.name] ?? 1) > 1;
      const entries: MenuEntry[] = [];
      if (isInput)
        entries.push({
          id: "flip",
          label: bus ? "Set value…" : "Flip 0 ↔ 1",
          hint: "Enter",
        });
      entries.push(
        { id: "connect", label: "Connect…" },
        {
          id: "disconnect",
          label: "Disconnect…",
          disabled: wireCount(ctx.design, { port: target.name }) === 0,
        },
        {
          id: "reset-port",
          label: "Move back to the edge",
          disabled: !ctx.design.port_pos?.[target.name],
        },
      );
      return {
        title: `${isInput ? "Input" : "Output"} ${target.name}`,
        entries,
      };
    }
    case "canvas":
      return {
        title: "Canvas",
        entries: [
          ...ctx.tools.map((t) => ({
            id: `add:${t.kind}`,
            label: `Add ${t.label} here`,
          })),
          "separator",
          { id: "undo", label: "Undo", hint: "Ctrl+Z", disabled: !ctx.canUndo },
          {
            id: "redo",
            label: "Redo",
            hint: "Ctrl+Shift+Z",
            disabled: !ctx.canRedo,
          },
        ],
      };
  }
}

type Menu = { title: string; entries: (MenuEntry | "separator")[] };
type Owner = { part: string } | { port: string };

const ownedBy = (e: Endpoint, o: Owner) =>
  "part" in o
    ? "part" in e && e.part === o.part
    : "port" in e && e.port === o.port;

const wires = (n: number) => (n === 1 ? "1 wire" : `${n} wires`);

/** Step one of connecting a part: which of its pins. */
export function pinMenu(id: string, pins: string[], design: Design): Menu {
  return {
    title: `Connect which pin of ${id}?`,
    entries: pins.map((pin) => {
      const n = wireCount(design, { part: id }, pin);
      return n
        ? { id: `pin:${pin}`, label: pin, hint: wires(n) }
        : { id: `pin:${pin}`, label: pin };
    }),
  };
}

/**
 * Step two: everything `from` can be wired to (ports first, then pins),
 * leaving out itself and what it's already wired to.
 */
export function connectMenu(
  design: Design,
  from: Endpoint,
  endpoints: Endpoint[],
  inputs: string[],
): Menu {
  const joined = design.wires.flatMap((w) =>
    sameEndpoint(w.from, from)
      ? [w.to]
      : sameEndpoint(w.to, from)
        ? [w.from]
        : [],
  );
  const free = endpoints.filter(
    (e) => !sameEndpoint(e, from) && !joined.some((j) => sameEndpoint(j, e)),
  );
  const entry = (e: Endpoint): MenuEntry => ({
    id: `to:${endpointKey(e)}`,
    label: endpointLabel(e, inputs),
  });
  const ports = free.filter((e) => "port" in e).map(entry);
  const pins = free.filter((e) => "part" in e).map(entry);
  return {
    title: `Connect ${"port" in from ? from.port : `${from.part}.${from.pin}`} to…`,
    entries: [
      ...ports,
      ...(ports.length && pins.length ? ["separator" as const] : []),
      ...pins,
    ],
  };
}

/** The wires of a part or port, one by one, then all of them. */
export function disconnectMenu(
  design: Design,
  owner: Owner,
  inputs: string[],
): Menu {
  const entries: (MenuEntry | "separator")[] = [];
  design.wires.forEach((w, i) => {
    const mine = ownedBy(w.from, owner)
      ? w.from
      : ownedBy(w.to, owner)
        ? w.to
        : null;
    if (!mine) return;
    const other = mine === w.from ? w.to : w.from;
    const label = endpointLabel(other, inputs);
    entries.push({
      id: `wire:${i}`,
      label: "part" in mine ? `${mine.pin} — ${label}` : label,
    });
  });
  entries.push("separator", { id: "all", label: "All wires", danger: true });
  return {
    title: `Disconnect a wire from ${"part" in owner ? owner.part : owner.port}`,
    entries,
  };
}

/** What a part or port is wired to, for its screen-reader label. */
export function connectionSummary(
  design: Design,
  owner: Owner,
  inputs: string[],
): string {
  const byPin = new Map<string, string[]>();
  for (const w of design.wires) {
    for (const [mine, other] of [
      [w.from, w.to],
      [w.to, w.from],
    ] as const) {
      if (!ownedBy(mine, owner)) continue;
      const key = "part" in mine ? mine.pin : "";
      byPin.set(key, [...(byPin.get(key) ?? []), endpointLabel(other, inputs)]);
    }
  }
  return [...byPin]
    .map(([pin, others]) =>
      pin ? `${pin}: ${others.join(", ")}` : others.join(", "),
    )
    .join("; ");
}
