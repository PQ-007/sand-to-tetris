/**
 * Hourglass: sand runs through the neck and settles as blocks: cubes drop into
 * rows, a piece hovers under the stream (the lit mark). The number is how far
 * the sand has run; turned over (back to 0) it spins half a turn and, edge-on,
 * the blocks are sand again. The pointer picks the sand, the neck, a row or the
 * frame; a row lifts cube by cube from the pointer out (rules 01, 02).
 */
const {
  Cam, clamp, facing, fit, hull, open, poly, prism, proj, put, rings, ringAt, rrect, run, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, register, disposer, solid, unproj, reducedMotion,
} = HL;

const R = 22, NECK = 3.2, Z0 = 5, ZB = 44, ZN0 = 72, ZN1 = 78, ZT = 106, ZTOP = 141, H = 146, ZC = H / 2;
const CELL = 7.5, LIFT = 6, STEP = 40, FULL = 128, EMPTY = ZN1 + 1, SKY = ZB - 4;
// sand drains steadily (how an hourglass keeps time); a turn eases; falls land
const RUN = 4, DROP = 420, TURN = 1.2, GLIDE = 500;
const FILL = [];
for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
  const keep = k === 0 ? !(i === 2 && j === 1) : k === 1 ? (i + 2 * j) % 4 !== 1 : i + j < 2;
  if (keep) FILL.push([i, j, k]);
}
const PIECE = [[1, 1], [2, 1], [2, 2], [3, 2]];

function mount({ stage, svg, read }, value) {
  const bag = disposer(), C = Cam(45, 0.5, 1.62);
  fit(C, [[-31, -31, 0], [31, -31, 0], [-31, 31, 0], [31, 31, 0], [-31, -31, H], [31, 31, H]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg), V = Math.SQRT1_2;
  // the turn: everything spins by phi round the middle, across the screen
  let phi = 0;
  const Q = (x, y, z) => {
    if (!phi) return P(x, y, z);
    const a = (x - y) * V, b = (x + y) * V, c = z - ZC, cs = Math.cos(phi), sn = Math.sin(phi);
    const a2 = a * cs - c * sn;
    return P((a2 + b) * V, (b - a2) * V, ZC + a * sn + c * cs);
  };
  const disc = (r) => rrect(-r, -r, r, r, r - 0.01, r > 8 ? 12 : 4);
  const radius = (z) => (z <= ZB ? R : z < ZN0 ? R + ((NECK - R) * (z - ZB)) / (ZN0 - ZB) : z <= ZN1 ? NECK
    : z < ZT ? NECK + ((R - NECK) * (z - ZN1)) / (ZT - ZN1) : R);
  // round solids from two rings (rule 09); no crease while the figure turns
  const frustum = (s, r0, z0, r1, z1, b = 1.2) => put(s, {
    sil: poly(hull(ringAt(Q, disc(r0), z0).concat(ringAt(Q, disc(r1), z1)))),
    crease: phi ? "" : open(ringAt(Q, run(disc(Math.max(r1 - b, 0.5)), front), z1)),
  });
  const box = (s, x0, y0, x1, y1, z0, h, r, b) => {
    const [a, i] = rings(x0, y0, x1, y1, r, b), pr = prism(Q, front, a, i, z0, z0 + h);
    put(s, phi ? { sil: pr.sil, crease: "" } : pr);
  };
  const none = (s) => put(s, { sil: "", crease: "" });
  const glassy = (s) => { s.sil.classList.add("nf"); s.cr.classList.add("nf"); return s; };
  const show = (el, grp, on) => { if (on && !el.parentNode) grp.append(el); if (!on && el.parentNode) el.remove(); };

  // back to front: base, posts, glass, what it holds, front rims, top
  const base = solid(g), posts = [solid(g), solid(g)], glass = [0, 1, 2, 3, 4].map(() => glassy(solid(g)));
  const order = FILL.map((c, n) => ({ c, n })).sort((p, q) => p.c[2] - q.c[2] || p.c[0] + p.c[1] - (q.c[0] + q.c[1]));
  const cubes = [];
  for (const { c, n } of order) cubes[n] = { c, s: solid(g), tw: tween(0), drop: tween(1, DROP), on: false, key: "" };
  const piece = PIECE.map(() => solid(g)), glide = tween(Z0 + 8, GLIDE), streamG = mk("g", {}, g);
  const stream = [0, 1, 2, 3, 4, 5].map(() => flatDot(streamG, C, 0.7, "dot m"));
  const sandLo = solid(g), sandHi = solid(g), grainG = mk("g", {}, g), grains = [];
  for (let k = 0, s = 11, a, d; k < 24; k++, s = (s * 75 + 74) % 65537, a = ((s % 997) / 997) * 6.283, d = Math.sqrt(((s >> 4) % 997) / 997))
    grains.push([flatDot(grainG, C, 0.6, "dot off"), Math.cos(a || 1) * (d || 0.4), Math.sin(a || 1) * (d || 0.4)]);
  const rims = mk("path", { class: "nf" }, g), top = solid(g);
  let still = NaN;
  function frame() {
    if (phi === still) return;
    still = phi;
    box(base, -31, -31, 31, 31, 0, Z0, 8, 1.5);
    [[27, -27], [-27, 27]].forEach(([x, y], k) => box(posts[k], x - 2.4, y - 2.4, x + 2.4, y + 2.4, Z0, ZTOP - Z0, 2.3, 0.8));
    [[R, Z0, R, ZB], [R, ZB, NECK, ZN0, 0.6], [NECK, ZN0, NECK, ZN1, 0.6], [NECK, ZN1, R, ZT], [R, ZT, R, ZTOP]]
      .forEach((a, k) => frustum(glass[k], ...a));
    rims.setAttribute("d", phi ? "" : [[R, Z0], [R, ZB], [NECK, ZN0], [NECK, ZN1], [R, ZT]].map(([r, z]) => open(ringAt(Q, run(disc(r), front), z))).join(""));
    box(top, -31, -31, 31, 31, ZTOP, H - ZTOP, 8, 1.5);
  }

  const at = (i, j) => [-1.5 * CELL + i * CELL, -1.5 * CELL + j * CELL];
  const cube = (s, i, j, z) => { const [x, y] = at(i, j), e = CELL / 2 - 0.35; box(s, x - e, y - e, x + e, y + e, z, CELL - 0.7, 1, 0.6); };
  let t = clamp(value, 0, 1), goal = t, turn = -1, after = 0;
  function draw(dt, now) {
    let moving = false;
    if (turn >= 0) {
      turn = reducedMotion() ? 1 : Math.min(1, turn + dt / TURN);
      const u = turn < 0.5 ? 4 * turn ** 3 : 1 - (2 - 2 * turn) ** 3 / 2;
      // past edge-on, the blocks are sand again, and it lands upright
      if (u >= 0.5 && goal !== 0) { t = goal = 0; cubes.forEach((c) => (c.on = false)); }
      phi = u < 0.5 ? u * Math.PI : (u - 1) * Math.PI;
      if (turn >= 1) { turn = -1; phi = 0; goal = after; }
      moving = true;
    }
    frame();
    const running = t !== goal && turn < 0;
    if (running) t = reducedMotion() ? goal : t < goal ? Math.min(goal, t + dt / RUN) : Math.max(goal, t - dt / RUN);
    const n = Math.round(t * FILL.length);
    cubes.forEach((c, k) => {
      if (k < n && !c.on) { c.on = true; c.drop = tween(0, DROP); tset(c.drop, 1, now, 0); }
      if (k >= n) c.on = false;
      const lift = tval(c.tw, now), d = tval(c.drop, now), [i, j, l] = c.c, slot = Z0 + l * CELL;
      if (!tdone(c.tw, now) || !tdone(c.drop, now)) moving = true;
      const key = c.on ? `${lift} ${d} ${phi}` : "off";
      if (key === c.key) return;
      c.key = key;
      // a new cube falls from under the neck into its row
      c.on ? cube(c.s, i, j, slot + (1 - d) * (SKY - slot) + lift * LIFT) : none(c.s);
    });
    // the piece glides down as the pile grows; the stream runs above it
    const pile = n ? Z0 + (FILL[n - 1][2] + 1) * CELL : Z0, falling = t > 0.02 && t < 0.98;
    tset(glide, pile + 8, now, 0);
    const pz = tval(glide, now);
    if (!tdone(glide, now)) moving = true;
    PIECE.forEach(([i, j], k) => (falling ? cube(piece[k], i, j, pz) : none(piece[k])));
    const flow = running ? (now / 140) % 1 : 0, gap = (ZN1 - 3 - pz - CELL) / 5.5;
    stream.forEach((el, k) => {
      show(el, streamG, falling && turn < 0);
      place(el, Q(0, 0, ZN1 - 3 - (k + flow) * gap));
    });
    // the sand left in the top bulb, its surface strewn with grains
    const level = EMPTY + (1 - t) * (FULL - EMPTY), has = t < 0.99;
    has ? frustum(sandLo, NECK - 0.5, ZN1, radius(Math.min(level, ZT)) - 1, Math.min(level, ZT)) : none(sandLo);
    has && level > ZT ? frustum(sandHi, R - 1, ZT, R - 1, level) : none(sandHi);
    const h = radius(level) - 3;
    for (const [el, gu, gv] of grains) {
      show(el, grainG, has && h > 2);
      place(el, Q(gu * h, gv * h, level));
    }
    return moving || running;
  }
  const B = register(stage, (dt, now) => draw(dt, now));
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
  // a row: the highest one with cubes whose top the pointer is over
  const rowAt = (pt) => {
    const n = Math.round(goal * FILL.length);
    for (let k = 2; k >= 0; k--) {
      const [x, y] = unproj(C, pt[0], pt[1], Z0 + (k + 1) * CELL), on = FILL.slice(0, n).some((c) => c[2] === k);
      if (on && Math.abs(x) <= 2 * CELL && Math.abs(y) <= 2 * CELL) return k;
    }
    return -1;
  };

  let act = "";
  function choose(name, pt) {
    if (name === act) return;
    act = name;
    const now = performance.now(), row = name.startsWith("row") ? Number(name.slice(4)) - 1 : undefined;
    const col = row === undefined ? 0 : unproj(C, pt[0], pt[1], Z0 + (row + 1) * CELL)[0] / CELL + 1.5;
    cubes.forEach((c) => tset(c.tw, row !== undefined && c.c[2] >= row ? 1 : 0, now, Math.abs(c.c[0] - col) * STEP));
    const lit = (s, on) => s.sil.classList.toggle("hi", on);
    piece.forEach((s) => lit(s, !name));
    cubes.forEach((c) => lit(c.s, c.c[2] === row));
    [sandLo, sandHi].forEach((s) => lit(s, name === "sand"));
    glass.forEach((s, k) => lit(s, (name === "neck" && k > 0 && k < 4) || (name === "glass" && (k === 0 || k === 4))));
    [base, top, ...posts].forEach((s) => lit(s, name === "frame"));
    read.textContent = name || "rest";
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (pt) => {
      if (turn >= 0) return;
      const k = inside(pt, PARTS[2][1]) ? rowAt(pt) : -1;
      choose(k >= 0 ? `row ${k + 1}` : PARTS.find((p) => inside(pt, p[1]))?.[0] ?? "", pt);
    },
    leave: () => choose("", [0, 0]),
  }));
  cubes.forEach((c, k) => (c.on = k < Math.round(clamp(value, 0, 1) * FILL.length)));
  choose("", [0, 0]);
  bag.add(() => svg.replaceChildren());
  function set(v) {
    const to = clamp(v, 0, 1); // less sand run than now: turn it over
    if (turn < 0 && to < t - 0.01) [after, turn] = [to, 0];
    else if (turn < 0) goal = to;
    B.wake();
  }
  return { set, destroy: bag.dispose };
}

hairline({
  name: "hourglass",
  means: "Sand to Tetris in one object: sand runs through the neck and settles as blocks, rows of them, a piece falling. Point at a row to lift it.",
  rules: [1, 2, 4, 5],
  range: [0, 0.6, 1],
  tour: [[200, 89], [200, 163], [191, 255], null],
  mount,
});
