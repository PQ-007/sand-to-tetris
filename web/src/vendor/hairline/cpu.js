/**
 * CPU: a processor in its package on a socket, legs on all four sides, the
 * die bare in the middle. On the die, the parts of the CPU this course
 * builds: the register file (eight thin bars), the ALU (a trapezoid with
 * the notch between its two inputs), the shifter (wires slanting across its
 * lid), the control unit (a grid of cells) and the program counter, joined
 * by bus traces. The pointer picks a block: it lifts off the die and lights,
 * and the blocks near it lift a little, later. At rest the ALU stands lit.
 * The slider is how far the lift reaches, in units.
 *
 * The pattern: one of many. Tweens with a falloff and a stagger by distance
 * from the block picked, and a hit test on the blocks' resting footprints
 * on the die's plane, which never moves.
 */
const {
  Cam, clamp, facing, fillet, fit, open, poly, prism, proj, rings, seg, unproj, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const S0 = 100, LEGS = 12, SUB = 4, DIE0 = 18, DIE1 = 82, DZ = SUB + 2, LIFT = 22, STEP = 50;

/** A ring from a convex outline listed like rrect's (right, near, left, far), rounded. */
function outline(pts, r, b) {
  const p = fillet(pts, pts.map(() => r), 3), n = p.length;
  const ring = p.map(([u, v], i) => {
    const [a, c] = [p[(i + n - 1) % n], p[(i + 1) % n]], tu = c[0] - a[0], tv = c[1] - a[1], l = Math.hypot(tu, tv);
    return { u, v, nu: tv / l, nv: -tu / l };
  });
  return [ring, ring.map((q) => ({ ...q, u: q.u - q.nu * b, v: q.v - q.nv * b }))];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value;
  const C = Cam(45, 0.5, 1.72);
  fit(C, [[-12, -12, -6], [S0 + 12, S0 + 12, -6], [S0 + 12, -12, -6], [-12, S0 + 12, -6], [DIE0, DIE0, DZ + 6 + LIFT]], 200, 170);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const box = (x0, y0, x1, y1, z0, z1, r = 1.2, b = 0.7, at = g) => {
    const s = solid(at), [a, i] = rings(x0, y0, x1, y1, r, Math.min(b, (x1 - x0) / 3, (y1 - y0) / 3));
    put(s, prism(P, front, a, i, z0, z1));
    return s;
  };

  // the socket, then the package's legs (far sides first), its body, its near legs
  box(-12, -12, S0 + 12, S0 + 12, -6, -2, 6, 1.6);
  const legs = (side) => {
    let d = "";
    for (let k = 0; k < LEGS; k++) {
      const t = 10 + (k * (S0 - 20)) / (LEGS - 1);
      const [a, b] = side === 0 ? [[t, 0], [t, -7]] : side === 1 ? [[0, t], [-7, t]] : side === 2 ? [[t, S0], [t, S0 + 7]] : [[S0, t], [S0 + 7, t]];
      d += open([P(a[0], a[1], 2), P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 2), P(b[0], b[1], -2)]);
    }
    return d;
  };
  mk("path", { d: legs(0) + legs(1), class: "nf" }, g);
  box(0, 0, S0, S0, 0, SUB, 3, 1.2);
  mk("path", { d: legs(2) + legs(3), class: "nf" }, g);
  place(flatDot(g, C, 1.2, "dot m"), P(6, 6, SUB));
  box(DIE0, DIE0, DIE1, DIE1, SUB, DZ, 1.5, 0.8);
  // bus traces on the die, under the blocks
  mk("path", { d: [[40, 32, 50, 32], [34, 58, 34, 62], [62, 44, 62, 50], [44, 70, 52, 72], [48, 40, 44, 40]].map(([a, b, c, e]) => seg(P(a, b, DZ), P(c, e, DZ))).join(""), class: "nf lo" }, g);

  // the blocks, back to front; each: name, footprint, height, marks on its lid
  const BLOCKS = [
    ["registers", [22, 22, 40, 56], 3],
    ["alu", [46, 22, 78, 42], 4],
    ["control", [22, 62, 44, 78], 4],
    ["shifter", [52, 50, 78, 60], 3],
    ["pc", [54, 66, 66, 78], 3.5],
  ];
  const blocks = BLOCKS.map(([name, [x0, y0, x1, y1], h]) => {
    const grp = mk("g", {}, g);
    return { name, x0, y0, x1, y1, h, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, grp, s: [], marks: mk("path", { class: "nf lo" }, grp), dots: [], lift: tween(name === "alu" ? LIFT * 0.6 : 0), drawn: NaN };
  });
  const ctrl = blocks[2];
  for (let k = 0; k < 12; k++) ctrl.dots.push(flatDot(ctrl.grp, C, 0.7, "dot off"));
  const pc = blocks[4];
  pc.dots.push(flatDot(pc.grp, C, 0.9, "dot m"));

  function draw(b) {
    const z = DZ + tval(b.lift, performance.now()), t = z + b.h;
    if (z === b.drawn) return;
    b.drawn = z;
    if (b.name === "registers") {
      // eight registers, far to near: thin bars
      for (let k = 0; k < 8; k++) {
        const y = b.y0 + k * 4.3;
        b.s[k] ||= solid(b.grp);
        const [a, i] = rings(b.x0, y, b.x1, y + 3, 0.6, 0.4);
        put(b.s[k], prism(P, front, a, i, z, t));
      }
      return;
    }
    b.s[0] ||= solid(b.grp);
    b.grp.append(b.marks, ...b.dots);
    if (b.name === "alu") {
      // wide where the two inputs come in, narrow at the output
      const [a, i] = outline([[b.x1, b.y0], [b.x1 - 6, b.y1], [b.x0 + 6, b.y1], [b.x0, b.y0]], 2, 0.8);
      put(b.s[0], prism(P, front, a, i, z, t));
      b.marks.setAttribute("d", open([P(b.cx - 4, b.y0 + 0.5, t), P(b.cx, b.y0 + 5, t), P(b.cx + 4, b.y0 + 0.5, t)]));
      return;
    }
    const [a, i] = rings(b.x0, b.y0, b.x1, b.y1, 1.2, 0.7);
    put(b.s[0], prism(P, front, a, i, z, t));
    if (b.name === "shifter") b.marks.setAttribute("d", [0, 1, 2, 3, 4].map((k) => seg(P(b.x0 + 3 + k * 4.5, b.y0 + 2, t), P(b.x0 + 7.5 + k * 4.5, b.y1 - 2, t))).join(""));
    if (b.name === "control") b.dots.forEach((el, k) => place(el, P(b.x0 + 4 + (k % 4) * 4.6, b.y0 + 4 + Math.floor(k / 4) * 4, t)));
    if (b.name === "pc") place(b.dots[0], P(b.cx, b.cy, t));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of blocks) { draw(b); if (!tdone(b.lift, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  let act = -2;
  function choose(a) {
    if (a === act) return;
    act = a;
    const now = performance.now(), from = blocks[a < 0 ? 1 : a];
    blocks.forEach((b, k) => {
      const d = Math.hypot(b.cx - from.cx, b.cy - from.cy);
      const up = a < 0 ? (k === 1 ? LIFT * 0.6 : 0) : k === a ? LIFT : d < reach ? LIFT * 0.35 : 0;
      tset(b.lift, up, now, (d / 12) * STEP);
      const lit = a < 0 ? k === 1 : k === a;
      b.s.forEach((s) => s.sil.classList.toggle("hi", lit));
    });
    read.textContent = a < 0 ? "rest" : blocks[a].name;
    B.wake();
  }

  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], DZ);
    return blocks.findIndex((b) => x >= b.x0 - 2 && x <= b.x1 + 2 && y >= b.y0 - 2 && y <= b.y1 + 2);
  }
  bag.add(pointer(stage, { move: (p) => choose(hit(p)), leave: () => choose(-1) }));
  choose(-1);
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { reach = clamp(v, 0, 80); }, destroy: bag.dispose };
}

hairline({
  name: "cpu",
  means: "A processor with its die bare: point at a block (registers, ALU, shifter, control, counter) and it lifts off the die.",
  rules: [1, 2, 4, 5],
  range: [10, 30, 60],
  tour: [[175, 135], [235, 150], [185, 200], null],
  mount,
});
