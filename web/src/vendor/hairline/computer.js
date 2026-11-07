/**
 * Computer: a desktop computer that comes apart. A case (a base and a
 * cover), a board inside it with a CPU, two RAM sticks and two small chips,
 * a monitor standing on the cover with a block falling on its screen, and a
 * keyboard in front. The number is how far apart it is: at 0 it is whole;
 * as it grows the cover, the board and the monitor lift apart in layers,
 * each a beat after the one below, and the keyboard slides forward. The
 * pointer picks a part; its outline goes bright and the read-out names it.
 * At rest it stands slightly apart, the screen lit.
 *
 * The pattern: scrub and pick. One tween per part toward the number (with a
 * stagger by layer), and a hit test on each part's outline in its target
 * pose, so a part moving out from under the pointer cannot flip the choice.
 */
const {
  Cam, clamp, facing, fit, hull, poly, prism, proj, rings, rrect, seg, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const W = 100, D = 64, GAP = 22, STEP = 60, PICK = 11, PSTEP = 40;
const BASE = 9, PLATE = 1.5, COVER = 5, MON = 46, MD = 8;
// the screen's 8 × 6 dots, top row first: a block falling onto two rows
const PIXELS = ["...##...", "...##...", "........", "........", "##.#####", "####.###"];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.68);
  const top = BASE + PLATE + COVER + MON + 3 * GAP + PICK;
  fit(C, [[0, 0, 0], [W, 0, 0], [0, D + 34 + GAP + PICK, 0], [W, D + 34 + GAP + PICK, 0], [8, 6, top], [W - 8, 6, top]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const box = (x0, y0, x1, y1, r, b) => rings(x0, y0, x1, y1, r, b);

  // Each part: its layer (how many gaps up), how it draws at an offset, and
  // the box of world points its outline is taken from.
  const parts = [];
  function part(name, layer, draw, corners) {
    const grp = mk("g", {}, g), p = { name, layer, grp, tw: tween(0), pk: tween(0), drawn: NaN, corners, sils: [] };
    p.draw = (o) => draw(p, o);
    parts.push(p);
    return p;
  }
  const solidIn = (p) => { const s = solid(p.grp); p.sils.push(s.sil); return s; };

  // the base of the case, standing on the desk
  const [br, bi] = box(0, 0, W, D, 6, 1.6);
  const base = part("case", 0, (p) => {
    if (!p.s) p.s = solidIn(p);
    put(p.s, prism(P, front, br, bi, 0, BASE));
  }, () => [[0, 0, 0], [W, D, BASE]]);

  // the board, with its chips: far to near, so nearer chips cover farther ones
  const CHIPS = [[14, 12, 26, 22, 2], [14, 40, 30, 50, 2], [40, 18, 62, 40, 3.5], [70, 10, 73, 54, 6], [76, 10, 79, 54, 6]];
  const [pr, pi] = box(4, 4, W - 4, D - 4, 3, 1);
  part("board", 1, (p, o) => {
    if (!p.s) { p.s = solidIn(p); p.chips = CHIPS.map(() => solidIn(p)); p.cpu = mk("path", { class: "nf lo" }, p.grp); }
    const z = BASE + o;
    put(p.s, prism(P, front, pr, pi, z, z + PLATE));
    CHIPS.forEach(([x0, y0, x1, y1, h], k) => {
      const [r, i] = box(x0, y0, x1, y1, Math.min(1.5, (x1 - x0) / 3), Math.min(0.8, (x1 - x0) / 5));
      put(p.chips[k], prism(P, front, r, i, z + PLATE, z + PLATE + h));
    });
    // the CPU's die, a square set into its lid
    p.cpu.setAttribute("d", poly([[46, 24], [56, 24], [56, 34], [46, 34]].map(([x, y]) => P(x, y, z + PLATE + 3.5))));
  }, (o) => [[4, 4, BASE + o], [W - 4, D - 4, BASE + o + PLATE + 6]]);

  // the cover, with vent slots along its front edge
  const cover = part("cover", 2, (p, o) => {
    if (!p.s) { p.s = solidIn(p); p.vents = mk("path", { class: "nf lo" }, p.grp); }
    const z = BASE + PLATE + o;
    put(p.s, prism(P, front, br, bi, z, z + COVER));
    let d = "";
    for (let k = 0; k < 6; k++) d += seg(P(58 + k * 6, D - 10, z + COVER), P(58 + k * 6, D - 4, z + COVER));
    p.vents.setAttribute("d", d);
  }, (o) => [[0, 0, BASE + PLATE + o], [W, D, BASE + PLATE + COVER + o]]);

  // the monitor, standing at the back of the cover; its screen faces us
  const [mr, mi] = box(10, 2, W - 10, 2 + MD, 3, 1.2);
  const px = [];
  const mon = part("screen", 3, (p, o) => {
    if (!p.s) {
      p.s = solidIn(p); p.glass = mk("path", { class: "nf" }, p.grp);
      PIXELS.forEach((row) => [...row].forEach((c) => {
        const el = flatDot(p.grp, C, 1, c === "#" ? "dot" : "dot off");
        if (c === "#") px.push(el);
        (p.dots ||= []).push(el);
      }));
    }
    const z = BASE + PLATE + COVER + o, yf = 2 + MD + 0.2;
    put(p.s, prism(P, front, mr, mi, z, z + MON));
    p.glass.setAttribute("d", poly(rrect(17, z + 6, W - 17, z + MON - 6, 3, 4).map((q) => P(q.u, yf, q.v))));
    let k = 0;
    PIXELS.forEach((row, r) => [...row].forEach((_, c) => place(p.dots[k++], P(25 + c * 7, yf, z + MON - 12 - r * 5.4))));
  }, (o) => [[10, 2, BASE + PLATE + COVER + o], [W - 10, 2 + MD, BASE + PLATE + COVER + MON + o]]);

  // the keyboard, on the desk in front; apart, it slides toward us
  const KY = D + 10;
  part("keys", 1, (p, o) => {
    if (!p.s) { p.s = solidIn(p); p.keys = []; for (let k = 0; k < 4 * 13; k++) p.keys.push(flatDot(p.grp, C, 0.9, "dot off")); p.bar = mk("path", { class: "nf lo" }, p.grp); }
    const y = KY + o;
    const [kr, ki] = box(8, y, W - 8, y + 24, 3, 1.2);
    put(p.s, prism(P, front, kr, ki, 0, 3.5));
    p.keys.forEach((el, k) => place(el, P(15 + (k % 13) * 6, y + 4 + Math.floor(k / 13) * 4.2, 3.5)));
    p.bar.setAttribute("d", seg(P(32, y + 21, 3.5), P(W - 32, y + 21, 3.5)));
  }, (o) => [[8, KY + o, 0], [W - 8, KY + o + 24, 3.5]]);

  let apart = clamp(value, 0, 1);
  // an offset for each part: how many gaps it sits up (the keyboard slides),
  // plus the lift that opens it up when it is picked
  const offset = (p, a, k = 0) => a * GAP * p.layer + k * PICK;

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const p of parts) {
      const o = offset(p, tval(p.tw, now), tval(p.pk, now));
      if (o !== p.drawn) { p.drawn = o; p.draw(o); }
      if (!tdone(p.tw, now) || !tdone(p.pk, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  /** Each part's outline in its target pose, for the hit test. */
  let outlines = [];
  function aim(a, now) {
    apart = a;
    parts.forEach((p, i) => tset(p.tw, a, now, i * STEP));
    outlines = parts.map((p) => {
      const [[x0, y0, z0], [x1, y1, z1]] = p.corners(offset(p, a));
      const pts = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(P(x, y, z));
      return hull(pts);
    });
    B.wake();
  }
  const inside = (pt, h) => {
    let ok = false;
    for (let i = 0, j = h.length - 1; i < h.length; j = i++) {
      const [xi, yi] = h[i], [xj, yj] = h[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ok = !ok;
    }
    return ok;
  };

  let act = -2;
  /** Picks part i (-1: none). The parts stacked above it lift to show it
   * (the monitor, with nothing above, lifts itself; the keyboard slides
   * out), spreading out from it. */
  function choose(i) {
    if (i === act) return;
    act = i;
    const now = performance.now();
    parts.forEach((p, k) => {
      const up = i < 0 ? 0 : i === 4 ? +(k === 4) : k === 4 ? 0 : i === 3 ? +(k === 3) : +(k > i);
      tset(p.pk, up, now, Math.abs(k - Math.max(i, 0)) * PSTEP);
    });
    B.wake();
    parts.forEach((p, k) => p.sils.forEach((s) => s.classList.toggle("hi", k === i)));
    // the screen keeps the bright mark at rest, or when it is the one chosen
    const lit = i < 0 || parts[i] === mon;
    px.forEach((el) => el.classList.toggle("m", !lit));
    read.textContent = i < 0 ? "rest" : parts[i].name;
  }

  bag.add(pointer(stage, {
    // nearest first: the keyboard, then the stack from the top down
    move: (pt) => {
      const order = [4, 3, 2, 1, 0];
      choose(order.find((k) => inside(pt, outlines[k])) ?? -1);
    },
    leave: () => choose(-1),
  }));
  aim(apart, performance.now());
  choose(-1);
  bag.add(() => svg.replaceChildren());
  void base; void cover;
  return { set: (v) => aim(clamp(v, 0, 1), performance.now()), destroy: bag.dispose };
}

hairline({
  name: "computer",
  means: "A desktop computer that comes apart in layers: cover, board, monitor. The pointer picks a part and names it.",
  rules: [1, 2, 4, 5],
  range: [0, 0.25, 1],
  tour: [[200, 108], [212, 196], [150, 262], null],
  mount,
});
