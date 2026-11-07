/**
 * Breadboard: a computer built by hand. Four chips straddle the channel of a
 * long breadboard, a few jumper wires loop between them, and a small dot
 * screen stands at the end with a falling block on it. The chip under the
 * pointer lifts out of the board on its legs; its neighbours lift a little,
 * a beat later. At rest the RAM sits half pushed in, and the screen is lit.
 * The slider is the stagger, in ms.
 *
 * The pattern: one of many. Tweens, a stagger and a falloff by distance from
 * the chip pulled, and a hit test on each part's resting footprint on the
 * ground plane, which never moves.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, open, seg, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const BX = 170, BY = 60, BT = 6, MID = 30, CH = 4.5, LEG = 3.5, LIFT = 15;
// the chips: name, x0, x1, depth (y), height, legs per side, resting lift
const CHIPS = [
  ["clock", 8, 22, 12, 4.5, 3, 0],
  ["cpu", 28, 70, 16, 5.5, 9, 0],
  ["alu", 76, 102, 14, 5, 6, 0],
  ["ram", 108, 140, 14, 5, 7, 4],
];
const SX = 150, SY0 = 10, SY1 = 50, SH = 36;
// the screen's 6 × 7 dots, top row first: a square block falling onto two rows
const PIXELS = ["..##..", "..##..", "......", "......", "......", "##.###", "####.#"];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let step = value;
  const C = Cam(45, 0.5, 2.02);
  fit(C, [[-4, -4, -BT], [BX + 4, BY + 4, -BT], [BX + 4, -4, -BT], [-4, BY + 4, -BT], [SX + 4, SY0, SH], [70, MID, LIFT + 8]], 200, 172);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // the board, its rows of holes, the channel down the middle and the rails
  const [br, bi] = rings(-4, -4, BX + 4, BY + 4, 5, 1.6);
  put(solid(g), prism(P, front, br, bi, -BT, 0));
  const holes = mk("g", {}, g);
  for (let x = 4; x < BX; x += 5) {
    for (const y of [3, 6.5, 53.5, 57, 11, 15, 19, 23, 37, 41, 45, 49]) place(flatDot(holes, C, 0.42, "dot off"), P(x, y, 0));
  }
  mk("path", { d: seg(P(2, MID - 2, 0), P(BX - 2, MID - 2, 0)) + seg(P(2, MID + 2, 0), P(BX - 2, MID + 2, 0)), class: "nf lo" }, g);
  mk("path", { d: seg(P(2, 9, 0), P(BX - 2, 9, 0)) + seg(P(2, 51, 0), P(BX - 2, 51, 0)), class: "nf lo" }, g);

  // jumper wires along the far rows, arching from hole to hole
  const arc = (x0, x1, y, h) => open(Array.from({ length: 13 }, (_, k) => {
    const t = k / 12;
    return P(x0 + (x1 - x0) * t, y, h * Math.sin(Math.PI * t));
  }));
  mk("path", { d: arc(19, 39, 15, 9) + arc(54, 84, 11, 12) + arc(94, 124, 19, 8), class: "nf" }, g);

  // the chips, far to near; each: back legs, body, pin-1 dot, front legs
  const chips = CHIPS.map(([name, x0, x1, d, h, n, rest]) => {
    const y0 = MID - d / 2, y1 = MID + d / 2, grp = mk("g", {}, g);
    const back = mk("path", { class: "nf" }, grp), body = solid(grp);
    const dot = flatDot(grp, C, 0.9, "dot m"), fwd = mk("path", { class: "nf" }, grp);
    const [ring, inner] = rings(x0, y0, x1, y1, 1.2, 0.8);
    const xs = Array.from({ length: n }, (_, k) => x0 + 2 + (k * (x1 - x0 - 4)) / Math.max(1, n - 1));
    return { name, x0, x1, y0, y1, h, rest, xs, back, body, dot, fwd, ring, inner, lift: tween(rest), drawn: NaN };
  });

  // the screen, standing at the near end, its dots on the face toward us
  const scr = solid(g);
  const [sr, si] = rings(SX, SY0, SX + 4, SY1, 1.4, 0.7);
  put(scr, prism(P, front, sr, si, 0, SH));
  const px = [];
  PIXELS.forEach((row, r) => [...row].forEach((c, k) => {
    const el = flatDot(g, C, 0.85, c === "#" ? "dot" : "dot off");
    place(el, P(SX + 4.2, SY0 + 7 + k * 5.2, SH - 5 - r * 4.4));
    if (c === "#") px.push(el);
  }));

  function draw(c, now) {
    const z = tval(c.lift, now);
    if (Math.abs(z - c.drawn) < 0.01) return;
    c.drawn = z;
    const zb = z + 1.5, zl = Math.max(0, zb - LEG);
    const legs = (y) => c.xs.map((x) => seg(P(x, y, zl), P(x, y, zb))).join("");
    c.back.setAttribute("d", legs(c.y0 + 0.6));
    c.fwd.setAttribute("d", legs(c.y1 - 0.6));
    put(c.body, prism(P, front, c.ring, c.inner, zb, zb + c.h));
    place(c.dot, P(c.x0 + 2.4, c.y1 - 2.4, zb + c.h));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const c of chips) { draw(c, now); if (!tdone(c.lift, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  let act = null;
  const FALL = [1, 0.3, 0.1];
  /** Pulls chip a out (-1: none, the resting pose; 4: the screen). */
  function choose(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 && a < 4 ? a : act >= 0 && act < 4 ? act : 0;
    act = a;
    chips.forEach((c, i) => {
      const d = Math.abs(i - from), up = a >= 0 && a < 4 ? LIFT * (FALL[d] ?? 0) : a < 0 ? c.rest : 0;
      tset(c.lift, up, now, d * step);
      c.body.sil.classList.toggle("hi", i === a);
    });
    // the screen keeps the bright mark at rest, or when it is the one chosen
    const lit = a < 0 || a === 4;
    px.forEach((el) => el.classList.toggle("m", !lit));
    scr.sil.classList.toggle("hi", a === 4);
    read.textContent = a < 0 ? "rest" : a === 4 ? "screen" : chips[a].name;
    B.wake();
  }

  /** Which part's resting footprint holds the ground point under the pointer. */
  function hit([x, y]) {
    if (y < -6 || y > BY + 6) return -1;
    if (x >= SX - 3 && x <= SX + 9) return 4;
    return chips.findIndex((c) => x >= c.x0 - 2.5 && x <= c.x1 + 2.5);
  }

  bag.add(pointer(stage, {
    move: (p) => choose(hit(unproj(C, p[0], p[1], 0))),
    leave: () => choose(-1),
  }));
  choose(-1);
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { step = clamp(v, 0, 200); }, destroy: bag.dispose };
}

hairline({
  name: "breadboard",
  means: "A computer built by hand on a breadboard: the chip under the pointer lifts out, and the screen shows a falling block.",
  rules: [1, 2, 4, 5],
  range: [0, 45, 90],
  tour: [[150, 150], [205, 175], [262, 175], null],
  mount,
});
