// Lays out the level map as a tech tree: one band per layer, top to
// bottom; inside a band, each row is one step deeper (a level sits below
// every level of its own layer it needs). Rows are ordered so a level sits
// near the levels it needs, which keeps lines from crossing. Pure, so
// it's testable; drawing is in levels.ts.

export interface TreeInput {
  id: string;
  layer: number;
  requires: string[];
}

export interface TreeNode {
  id: string;
  layer: number;
  /** Top-left corner. */
  x: number;
  y: number;
}

export interface TreeEdge {
  from: string;
  to: string;
  /** SVG path from the bottom of `from` to the top of `to`. */
  path: string;
}

export interface TreeBand {
  layer: number;
  y: number;
  height: number;
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  bands: TreeBand[];
  width: number;
  height: number;
}

export const NODE_W = 150;
export const NODE_H = 64;
const GAP_X = 18;
const ROW_H = 100;
const MARGIN = 24;
/** Room for the band's title above its first row. */
const BAND_HEAD = 44;
const BAND_FOOT = 20;
const BAND_GAP = 16;

/** Each level's row inside its layer: 0 if it needs nothing from its own
 * layer, else one below the deepest same-layer level it needs. */
function depths(levels: TreeInput[]): Map<string, number> {
  const byId = new Map(levels.map((l) => [l.id, l]));
  const memo = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const l = byId.get(id);
    if (!l || seen.has(id)) return 0;
    seen.add(id);
    const d = Math.max(
      -1,
      ...l.requires
        .filter((r) => byId.get(r)?.layer === l.layer)
        .map((r) => depth(r, seen)),
    );
    memo.set(id, d + 1);
    return d + 1;
  };
  for (const l of levels) depth(l.id, new Set());
  return memo;
}

export function layoutTree(levels: TreeInput[]): TreeLayout {
  const ids = new Set(levels.map((l) => l.id));
  const depth = depths(levels);
  const layers = [...new Set(levels.map((l) => l.layer))].sort((a, b) => a - b);
  // Rows in order: layer by layer, then depth by depth.
  const rows: { layer: number; levels: TreeInput[] }[] = [];
  for (const layer of layers) {
    const inLayer = levels.filter((l) => l.layer === layer);
    const deepest = Math.max(...inLayer.map((l) => depth.get(l.id) ?? 0));
    for (let d = 0; d <= deepest; d++)
      rows.push({
        layer,
        levels: inLayer.filter((l) => (depth.get(l.id) ?? 0) === d),
      });
  }
  const widest = Math.max(1, ...rows.map((r) => r.levels.length));
  const width = 2 * MARGIN + widest * NODE_W + (widest - 1) * GAP_X;

  const nodes: TreeNode[] = [];
  const centre = new Map<string, number>();
  const bands: TreeBand[] = [];
  let y = MARGIN;
  let band = null as TreeBand | null;
  for (const row of rows) {
    if (row.layer !== band?.layer) {
      if (band) {
        band.height = y - ROW_H + NODE_H + BAND_FOOT - band.y;
        y = band.y + band.height + BAND_GAP;
      }
      band = { layer: row.layer, y, height: 0 };
      bands.push(band);
      y += BAND_HEAD;
    }
    // Order by where the levels they need sit (barycentre), keeping the
    // given order for ties and for levels that need nothing placed.
    const order = row.levels
      .map((l, i) => {
        const xs = l.requires
          .map((r) => centre.get(r))
          .filter((v): v is number => v !== undefined);
        const bary = xs.length
          ? xs.reduce((s, v) => s + v, 0) / xs.length
          : Infinity;
        return { l, i, bary };
      })
      .sort((a, b) => a.bary - b.bary || a.i - b.i);
    const rowWidth = order.length * NODE_W + (order.length - 1) * GAP_X;
    let x = (width - rowWidth) / 2;
    for (const { l } of order) {
      nodes.push({ id: l.id, layer: l.layer, x, y });
      centre.set(l.id, x + NODE_W / 2);
      x += NODE_W + GAP_X;
    }
    y += ROW_H;
  }
  if (band) band.height = y - ROW_H + NODE_H + BAND_FOOT - band.y;
  const height = band ? band.y + band.height + MARGIN : 2 * MARGIN;

  const at = new Map(nodes.map((n) => [n.id, n]));
  const edges: TreeEdge[] = [];
  for (const l of levels)
    for (const r of l.requires) {
      const a = at.get(r);
      const b = at.get(l.id);
      if (!a || !b || !ids.has(r)) continue;
      const x1 = a.x + NODE_W / 2;
      const y1 = a.y + NODE_H;
      const x2 = b.x + NODE_W / 2;
      const y2 = b.y;
      const dy = Math.max(24, (y2 - y1) / 2);
      edges.push({
        from: r,
        to: l.id,
        path: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`,
      });
    }
  return { nodes, edges, bands, width, height };
}

/** The levels `id` needs (that exist) and the levels that need it. */
export function neighbours(
  levels: TreeInput[],
  id: string,
): { needs: string[]; unlocks: string[] } {
  const ids = new Set(levels.map((l) => l.id));
  return {
    needs: (levels.find((l) => l.id === id)?.requires ?? []).filter((r) =>
      ids.has(r),
    ),
    unlocks: levels.filter((l) => l.requires.includes(id)).map((l) => l.id),
  };
}
