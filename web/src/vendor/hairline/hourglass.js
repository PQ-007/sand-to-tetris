/**
 * Hourglass: sand to Tetris in one object. A round glass between two plates
 * on two posts; sand in the top bulb runs through the neck, and in the bottom
 * bulb the grains settle as blocks: rows of cubes, and a piece falling under
 * the stream, the lit mark at rest. The number is how far the sand has run:
 * the sand sinks, the rows build up cube by cube. The pointer picks the sand,
 * the neck, a row or the frame: its outline goes bright, a row lifts (with
 * what is on it) cube by cube from the pointer out, the read-out names it. Hits
 * are tested on the rest pose (rule 01).
 */
const {
  Cam, clamp, facing, fit, hull, open, poly, prism, proj, put, rings, ringAt, rrect, run, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, register, disposer, solid, unproj,
} = HL;

const R = 22, NECK = 3.2, Z0 = 5, ZB = 44, ZN0 = 72, ZN1 = 78, ZT = 106, ZTOP = 141, H = 146;
const CELL = 7.5, LIFT = 6, STEP = 40, FULL = 128, EMPTY = ZN1 + 1;
// the order the cubes settle in: three layers of a 4 × 4 well, holes left
const FILL = [];
for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
  const keep = k === 0 ? !(i === 2 && j === 1) : k === 1 ? (i + 2 * j) % 4 !== 1 : i + j < 2;
  if (keep) FILL.push([i, j, k]);
}
const PIECE = [[1, 1], [2, 1], [2, 2], [3, 2]];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.62);
  fit(C, [[-31, -31, 0], [31, -31, 0], [-31, 31, 0], [31, 31, 0], [-31, -31, H], [31, 31, H]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  const disc = (r) => rrect(-r, -r, r, r, r - 0.01, r > 8 ? 12 : 4);
  const radius = (z) => (z <= ZB ? R : z < ZN0 ? R + ((NECK - R) * (z - ZB)) / (ZN0 - ZB) : z <= ZN1 ? NECK
    : z < ZT ? NECK + ((R - NECK) * (z - ZN1)) / (ZT - ZN1) : R);
  // a round solid whose top differs from its foot (rule 09's two rings)
  function frustum(s, r0, z0, r1, z1, b = 1.2) {
    const inner = disc(Math.max(r1 - b, 0.5));
    put(s, { sil: poly(hull(ringAt(P, disc(r0), z0).concat(ringAt(P, disc(r1), z1)))), crease: open(ringAt(P, run(inner, front), z1)) });
  }
  const box = (s, x0, y0, x1, y1, z0, h, r, b) => {
    const [a, i] = rings(x0, y0, x1, y1, r, b);
    put(s, prism(P, front, a, i, z0, z0 + h));
  };
  const none = (s) => put(s, { sil: "", crease: "" });
  const glassy = (s) => { s.sil.classList.add("nf"); s.cr.classList.add("nf"); return s; };
  // dots come and go by leaving their group (no styles of our own)
  const show = (el, grp, on) => { if (on && !el.parentNode) grp.append(el); if (!on && el.parentNode) el.remove(); };

  // back to front: base, posts, what the glass holds, the glass, the top
  const base = solid(g);
  box(base, -31, -31, 31, 31, 0, Z0, 8, 1.5);
  const posts = [[27, -27], [-27, 27]].map(([x, y]) => {
    const s = solid(g);
    box(s, x - 2.4, y - 2.4, x + 2.4, y + 2.4, Z0, ZTOP - Z0, 2.3, 0.8);
    return s;
  });
  // the glass behind what it holds; its front rims are drawn again over it
  const glass = [0, 1, 2, 3, 4].map(() => glassy(solid(g)));
  frustum(glass[0], R, Z0, R, ZB);
  frustum(glass[1], R, ZB, NECK, ZN0, 0.6);
  frustum(glass[2], NECK, ZN0, NECK, ZN1, 0.6);
  frustum(glass[3], NECK, ZN1, R, ZT);
  frustum(glass[4], R, ZT, R, ZTOP);
  const order = FILL.map((c, n) => ({ c, n })).sort((p, q) => p.c[2] - q.c[2] || p.c[0] + p.c[1] - (q.c[0] + q.c[1]));
  const cubes = [];
  for (const { c, n } of order) cubes[n] = { c, s: solid(g), tw: tween(0), drawn: NaN };
  const piece = PIECE.map(() => solid(g));
  const streamG = mk("g", {}, g), stream = [0, 1, 2, 3, 4, 5].map(() => flatDot(streamG, C, 0.7, "dot m"));
  const sandLo = solid(g), sandHi = solid(g);
  const grainG = mk("g", {}, g), grains = [];
  for (let k = 0, s = 11; k < 24; k++) {
    s = (s * 75 + 74) % 65537;
    const a = ((s % 997) / 997) * 6.283, d = Math.sqrt(((s >> 4) % 997) / 997);
    grains.push([flatDot(grainG, C, 0.6, "dot off"), Math.cos(a) * d, Math.sin(a) * d]);
  }
  const rims = mk("path", { class: "nf" }, g);
  rims.setAttribute("d", [[R, Z0], [R, ZB], [NECK, ZN0], [NECK, ZN1], [R, ZT]].map(([r, z]) => open(ringAt(P, run(disc(r), front), z))).join(""));
  const top = solid(g);
  box(top, -31, -31, 31, 31, ZTOP, H - ZTOP, 8, 1.5);

  const at = (i, j) => [-1.5 * CELL + i * CELL, -1.5 * CELL + j * CELL];
  const sand = tween(clamp(value, 0, 1));
  let shown = -1;
  function draw(t, now) {
    const n = Math.round(t * FILL.length);
    let moving = false;
    cubes.forEach((cube, k) => {
      const lift = tval(cube.tw, now);
      if (!tdone(cube.tw, now)) moving = true;
      const key = k < n ? lift : -1;
      if (key === cube.drawn) return;
      cube.drawn = key;
      if (k >= n) return none(cube.s);
      const [i, j, l] = cube.c, [x, y] = at(i, j), e = CELL / 2 - 0.35;
      box(cube.s, x - e, y - e, x + e, y + e, Z0 + l * CELL + lift * LIFT, CELL - 0.7, 1, 0.6);
    });
    if (n === shown) return moving;
    shown = n;
    // the pile's top, the piece hovering over it, the stream above that
    const pile = n ? Z0 + (FILL[n - 1][2] + 1) * CELL : Z0;
    const falling = t > 0.02 && t < 0.98, pz = pile + 8;
    PIECE.forEach(([i, j], k) => {
      if (!falling) return none(piece[k]);
      const [x, y] = at(i, j), e = CELL / 2 - 0.35;
      box(piece[k], x - e, y - e, x + e, y + e, pz, CELL - 0.7, 1, 0.6);
    });
    stream.forEach((el, k) => {
      show(el, streamG, falling);
      place(el, P(0, 0, ZN1 - 3 - k * ((ZN1 - 3 - pz - CELL) / 5.5)));
    });
    // the sand left in the top bulb, its surface strewn with grains
    const level = EMPTY + (1 - t) * (FULL - EMPTY), has = t < 0.99;
    if (has) frustum(sandLo, NECK - 0.5, ZN1, radius(Math.min(level, ZT)) - 1, Math.min(level, ZT));
    else none(sandLo);
    if (has && level > ZT) frustum(sandHi, R - 1, ZT, R - 1, level);
    else none(sandHi);
    const h = radius(level) - 3;
    for (const [el, u, v] of grains) {
      show(el, grainG, has && h > 2);
      place(el, P(u * h, v * h, level));
    }
    return moving;
  }
  const B = register(stage, (_dt, now) => draw(tval(sand, now), now) || !tdone(sand, now));
  bag.add(B.unregister);

  // the rest pose's regions on screen, for the hit test
  const region = (r, z0, z1) => hull(ringAt(P, disc(r), z0).concat(ringAt(P, disc(r), z1)));
  const inside = (pt, h) => {
    let ok = false;
    for (let i = 0, j = h.length - 1; i < h.length; j = i++) {
      const [xi, yi] = h[i], [xj, yj] = h[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ok = !ok;
    }
    return ok;
  };
  const PARTS = [
    ["neck", region(7, ZN0 - 8, ZN1 + 6)],
    ["sand", region(R, ZN1 + 6, ZTOP)],
    ["glass", region(R, Z0, ZN0 - 8)],
    ["frame", hull([[-31, -31, 0], [31, -31, 0], [-31, 31, 0], [31, 31, 0], [-31, -31, H], [31, -31, H], [-31, 31, H], [31, 31, H]].map(([x, y, z]) => P(x, y, z)))],
  ];

  let act = "";
  function choose(name, pt) {
    if (name === act) return;
    act = name;
    const now = performance.now(), row = name.startsWith("row") ? Number(name.slice(4)) - 1 : undefined;
    // a row lifts, cube by cube from the pointer's column out (rule 02)
    const col = row === undefined ? 0 : unproj(C, pt[0], pt[1], Z0 + (row + 1) * CELL)[0] / CELL + 1.5;
    // (the rows above it go up with it)
    cubes.forEach((cube) => tset(cube.tw, row !== undefined && cube.c[2] >= row ? 1 : 0, now, Math.abs(cube.c[0] - col) * STEP));
    const lit = (s, on) => s.sil.classList.toggle("hi", on);
    piece.forEach((s) => lit(s, !name));
    cubes.forEach((cube) => lit(cube.s, cube.c[2] === row));
    [sandLo, sandHi].forEach((s) => lit(s, name === "sand"));
    glass.forEach((s, k) => lit(s, (name === "neck" && k > 0 && k < 4) || (name === "glass" && (k === 0 || k === 4))));
    [base, top, ...posts].forEach((s) => lit(s, name === "frame"));
    read.textContent = name || "rest";
    B.wake();
  }

  // a row: the highest one with cubes whose top the pointer is over
  const rowAt = (pt) => {
    const n = Math.round(tval(sand, Infinity) * FILL.length);
    for (let k = 2; k >= 0; k--) {
      const [x, y] = unproj(C, pt[0], pt[1], Z0 + (k + 1) * CELL);
      if (Math.abs(x) <= 2 * CELL && Math.abs(y) <= 2 * CELL && FILL.slice(0, n).some((c) => c[2] === k)) return k;
    }
    return -1;
  };
  bag.add(pointer(stage, {
    move: (pt) => {
      const k = inside(pt, PARTS[2][1]) ? rowAt(pt) : -1;
      choose(k >= 0 ? `row ${k + 1}` : PARTS.find((p) => inside(pt, p[1]))?.[0] ?? "", pt);
    },
    leave: () => choose("", [0, 0]),
  }));
  choose("", [0, 0]);
  bag.add(() => svg.replaceChildren());
  return {
    set: (v) => { tset(sand, clamp(v, 0, 1), performance.now(), 0); shown = -1; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "hourglass",
  means: "Sand to Tetris in one object: sand runs through the neck and settles as blocks, rows of them, a piece falling. Point at a row to lift it.",
  rules: [1, 2, 4, 5],
  range: [0, 0.6, 1],
  tour: [[200, 89], [200, 163], [191, 255], null],
  mount,
});
