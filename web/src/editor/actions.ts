// What the right-click (context) menu offers for each thing on the canvas.
// Pure: the play page maps each entry's id to the edit it performs.
import { t } from "../i18n";
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
        ctx.tools.find((tool) => tool.kind === kind)?.label ??
        kind.toUpperCase();
      const entries: (MenuEntry | "separator")[] = [];
      if (ctx.components.has(kind) && ctx.canLookInside(target.id))
        entries.push({
          id: "look-inside",
          label: t("menu.lookInside"),
          hint: "Enter",
        });
      if (ctx.hasOptions(target.id))
        entries.push({ id: "options", label: t("menu.options") });
      if (entries.length) entries.push("separator");
      entries.push(
        { id: "connect", label: t("menu.connect") },
        {
          id: "disconnect",
          label: t("menu.disconnect"),
          disabled: wireCount(ctx.design, { part: target.id }) === 0,
        },
        { id: "duplicate", label: t("menu.duplicate") },
        "separator",
        { id: "delete", label: t("menu.delete"), hint: "Del", danger: true },
      );
      return { title: `${target.id} (${name})`, entries };
    }
    case "wire": {
      const w = ctx.design.wires[target.index];
      const title = w
        ? t("menu.wireTitle", {
            from: endpointLabel(w.from, ctx.inputs),
            to: endpointLabel(w.to, ctx.inputs),
          })
        : t("menu.wire");
      return {
        title,
        entries: [
          {
            id: "delete",
            label: t("menu.deleteWire"),
            hint: "Del",
            danger: true,
          },
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
          label: t(bus ? "menu.setValue" : "menu.flip"),
          hint: "Enter",
        });
      entries.push(
        { id: "connect", label: t("menu.connect") },
        {
          id: "disconnect",
          label: t("menu.disconnect"),
          disabled: wireCount(ctx.design, { port: target.name }) === 0,
        },
        {
          id: "reset-port",
          label: t("menu.reset"),
          disabled: !ctx.design.port_pos?.[target.name],
        },
      );
      return {
        title: t(isInput ? "menu.input" : "menu.output", { name: target.name }),
        entries,
      };
    }
    case "canvas":
      return {
        title: t("menu.canvas"),
        entries: [
          ...ctx.tools.map((tool) => ({
            id: `add:${tool.kind}`,
            label: t("menu.addHere", { name: tool.label }),
          })),
          "separator",
          {
            id: "undo",
            label: t("menu.undo"),
            hint: "Ctrl+Z",
            disabled: !ctx.canUndo,
          },
          {
            id: "redo",
            label: t("menu.redo"),
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

const wires = (n: number) => t("menu.wireCount", { n });

/** Step one of connecting a part: which of its pins. */
export function pinMenu(id: string, pins: string[], design: Design): Menu {
  return {
    title: t("menu.whichPin", { id }),
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
    title: t("menu.connectTo", {
      from: "port" in from ? from.port : `${from.part}.${from.pin}`,
    }),
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
  entries.push("separator", {
    id: "all",
    label: t("menu.allWires"),
    danger: true,
  });
  return {
    title: t("menu.disconnectFrom", {
      name: "part" in owner ? owner.part : owner.port,
    }),
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
