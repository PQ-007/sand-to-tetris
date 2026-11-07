/**
 * Sandfall: a tray of sand, ruled into a ten by ten board. Under the pointer,
 * four grains of sand rise into blocks: a piece grown from that cell, the way
 * Bitfall grows its pieces. Each block rises a beat after the one before it,
 * outwards from the pointer, and the last piece sinks back into the sand. At
 * rest one piece already stands near the middle, lit. The slider is the
 * stagger, in ms.
 *
 * The pattern: one of many (a piece per cell). Tweens, a stagger by distance
 * from the pointed cell, a hit test on the ground plane (which never moves),
 * and the bright stroke on the one piece that stands.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const N = 10, CELL = 12, FOOT = 10.8, H = 10.8, EXT = N * CELL, PB = 5, GRAINS = 4;
const REST = [4, 5];

/** A small seeded random, so a cell always grows the same piece. */
function rand(seed) {
  let s = seed * 2654435761 % 4294967296;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

/** Four connected cells grown from (i, j): each new cell beside one already in it. */
function grow(i, j) {
  const r = rand(i * 31 + j * 7 + 3), cells = [[i, j]];
  const has = (a, b) => cells.some(([x, y]) => x === a && y === b);
  for (let tries = 0; cells.length < 4 && tries < 64; tries++) {
    const [x, y] = cells[Math.floor(r() * cells.length)];
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)];
    const a = x + dx, b = y + dy;
    if (a >= 0 && a < N && b >= 0 && b < N && !has(a, b)) cells.push([a, b]);
  }
  return cells;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let step = value;
  const C = Cam(45, 0.5, 1.98);
  fit(C, [[-7, -7, -PB], [EXT + 7, EXT + 7, -PB], [EXT + 7, -7, -PB], [-7, EXT + 7, -PB], [0, 0, H]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [tr, ti] = rings(-7, -7, EXT + 7, EXT + 7, 10, 2.2);
  put(solid(g), prism(P, front, tr, ti, -PB, 0));

  // Diagonal by diagonal from the far corner: appending is painting back to front.
  const cells = new Map();
  for (let s = 0; s <= 2 * (N - 1); s++) for (let i = 0; i < N; i++) {
    const j = s - i;
    if (j < 0 || j >= N) continue;
    const grp = mk("g", {}, g), r = rand(i * 97 + j * 13 + 1);
    // a few grains per cell, scattered: sand, not a grid of dots
    for (let k = 0; k < GRAINS; k++) {
      const d = flatDot(grp, C, 0.6, r() < 0.4 ? "dot m" : "dot off");
      place(d, P(i * CELL + 2 + r() * (CELL - 4), j * CELL + 2 + r() * (CELL - 4), 0));
    }
    const x0 = i * CELL + (CELL - FOOT) / 2, y0 = j * CELL + (CELL - FOOT) / 2;
    const [ring, inner] = rings(x0, y0, x0 + FOOT, y0 + FOOT, 1.3, 0.8);
    // The block lives in its cell's group, after the grains; sunk, it
    // leaves the drawing altogether.
    const el = solid(grp);
    el.g.remove();
    cells.set(i + "," + j, { grp, ring, inner, el, lift: tween(0), drawn: 0 });
  }

  /** A block at its lift: hidden in the sand at 0, a full block at 1. */
  function draw(c, now) {
    const h = tval(c.lift, now) * H;
    if (Math.abs(h - c.drawn) < 0.01) return;
    c.drawn = h;
    if (h < 0.3) return c.el.g.remove();
    if (!c.el.g.isConnected) c.grp.append(c.el.g);
    put(c.el, prism(P, front, c.ring, c.inner, 0, h));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const c of cells.values()) { draw(c, now); if (!tdone(c.lift, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  let anchor = null, piece = [];
  const key = ([i, j]) => i + "," + j;
  const far = ([i, j], [a, b]) => Math.abs(i - a) + Math.abs(j - b);

  /** Raise the piece grown from `at` (null: the resting piece), sink the last one. */
  function show(at) {
    const from = at || REST;
    if (anchor && key(anchor) === key(from)) return;
    const now = performance.now(), next = grow(from[0], from[1]), keep = new Set(next.map(key));
    for (const p of piece) if (!keep.has(key(p))) {
      const c = cells.get(key(p));
      tset(c.lift, 0, now, far(p, anchor) * step);
      c.el.sil.classList.remove("hi");
    }
    for (const p of next) {
      const c = cells.get(key(p));
      tset(c.lift, 1, now, far(p, from) * step);
      c.el.sil.classList.add("hi");
    }
    anchor = from; piece = next;
    read.textContent = at ? `cell ${at[0]}·${at[1]}` : "rest";
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => {
      const [x, y] = unproj(C, p[0], p[1], 0);
      if (x < -CELL || y < -CELL || x > EXT + CELL || y > EXT + CELL) return show(null);
      show([clamp(Math.floor(x / CELL), 0, N - 1), clamp(Math.floor(y / CELL), 0, N - 1)]);
    },
    leave: () => show(null),
  }));
  show(null);
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { step = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "sandfall",
  means: "A tray of sand: under the pointer, four grains rise into blocks, the way this course turns sand into a game.",
  rules: [1, 2, 4, 5],
  range: [0, 45, 90],
  tour: [[150, 150], [250, 130], [215, 205], null],
  mount,
});
