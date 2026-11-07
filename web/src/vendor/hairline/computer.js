/**
 * Computer: a tower PC, built. Inside a case with a glass side: the board on
 * the far wall, a CPU under a tower cooler with its fan, four RAM sticks, a
 * graphics card with two fans and, below, the power supply with its fan.
 * The front has a power button, a light and vents. The number is how far
 * apart it is: every part slides out of the case towards us, a beat apart,
 * the glass furthest. The pointer picks a part: its outline goes bright, it
 * slides out (the glass first makes way) and the read-out names it. Hits are
 * tested on the target pose (rule 01).
 */
const {
  Cam, clamp, facing, fit, hull, poly, prism, proj, rings, rrect, seg, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const L = 84, Wd = 40, H = 92, T = 3, GAP = 15, STEP = 60, PICK = 9, PSTEP = 40;
// how far each part slides at full explode, in gaps (paint order)
const OUT = { case: 0, board: 0.5, psu: 1, gpu: 1.7, ram: 1.3, cpu: 2.2, front: 0, glass: 3.2 };

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.1);
  const far = Wd + 3.2 * GAP + PICK * 1.6 + 2;
  fit(C, [[0, 0, 0], [L, 0, 0], [0, far, 0], [L, far, 0], [0, 0, H], [L, far, H]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  // a circle standing on a face: across y and z at x, or across x and y at z
  const ringX = (x, y, z, r) => poly(rrect(y - r, z - r, y + r, z + r, r, 4).map((q) => P(x, q.u, q.v)));
  const ringZ = (x, y, z, r) => poly(rrect(x - r, y - r, x + r, y + r, r, 4).map((q) => P(q.u, q.v, z)));

  const parts = [];
  function part(name, box, draw) {
    const grp = mk("g", {}, g), p = { name, box, grp, s: [], l: [], tw: tween(0), pk: tween(0), drawn: NaN };
    p.blk = (k, x0, y0, x1, y1, z0, h, r = 1.2, b = 0.7) => {
      p.s[k] ||= solid(grp);
      const [a, i] = rings(x0, y0, x1, y1, r, Math.min(b, (x1 - x0) / 3, (y1 - y0) / 3));
      put(p.s[k], prism(P, front, a, i, z0, z0 + h));
    };
    p.line = (k, d, cls = "nf lo") => { (p.l[k] ||= mk("path", { class: cls }, grp)).setAttribute("d", d); };
    p.draw = (o) => draw(p, o);
    parts.push(p);
    return p;
  }

  // the case's far walls and floor
  part("case", () => [[0, 0, 0], [L, Wd, H]], (p) => {
    p.blk(0, 0, 0, L, T, 0, H, 3, 1);
    p.blk(1, 0, 0, T, Wd, 0, H, 1.2, 0.6);
    p.blk(2, 0, 0, L, Wd, 0, T, 3, 1);
  });

  // the board on the far wall: traces, slots and a chipset on its face
  part("board", (o) => [[8, 3 + o, 28], [74, 4.5 + o, 88]], (p, o) => {
    const y = 4.5 + o;
    p.blk(0, 8, 3 + o, 74, y, 28, 60, 1, 0.4);
    const f = (x, z) => P(x, y, z);
    p.line(0, [[14, 84, 30, 84], [14, 84, 14, 60], [50, 50, 70, 50], [60, 32, 60, 46], [20, 52, 44, 52]].map(([a, b, c, d]) => seg(f(a, b), f(c, d))).join("")
      + [33, 48].map((z) => poly([f(12, z), f(70, z), f(70, z + 2), f(12, z + 2)])).join("")
      + poly([f(56, 34), f(66, 34), f(66, 42), f(56, 42)]));
  });

  // the power supply below, its fan facing up
  part("psu", (o) => [[6, 4 + o, T], [46, 36 + o, 22]], (p, o) => {
    p.blk(0, 6, 4 + o, 46, 36 + o, T, 19, 2, 1);
    p.line(0, [8, 5.6, 3.2].map((r) => ringZ(26, 20 + o, T + 19, r)).join("") + seg(P(18, 20 + o, T + 19), P(34, 20 + o, T + 19)), "nf lo");
  });

  // the graphics card: a long card standing out of the board, two fans on it
  part("gpu", (o) => [[12, 4.5 + o, 36], [72, 32 + o, 45]], (p, o) => {
    p.blk(0, 12, 4.5 + o, 72, 32 + o, 36, 9, 2, 1);
    p.line(0, [30, 54].map((x) => [8.5, 5.5, 2].map((r) => ringZ(x, 18 + o, 45, r)).join("")).join(""), "nf lo");
    p.line(1, seg(P(12, 32 + o, 38), P(72, 32 + o, 38)));
  });

  // four RAM sticks beside the CPU
  part("ram", (o) => [[52, 4.5 + o, 60], [67, 13 + o, 82]], (p, o) => {
    [52, 56, 60, 64].forEach((x, k) => p.blk(k, x, 4.5 + o, x + 2.4, 13 + o, 60, 22, 0.6, 0.3));
  });

  // the CPU under a tower cooler: fins stacked up its side, a fan in front
  part("cpu", (o) => [[30, 4.5 + o, 60], [49, 26 + o, 82]], (p, o) => {
    p.blk(0, 30, 4.5 + o, 46, 26 + o, 60, 22, 1.5, 0.8);
    let d = "";
    for (let z = 63; z < 82; z += 2.4) d += seg(P(30, 26 + o, z), P(46, 26 + o, z));
    p.line(0, d);
    p.blk(1, 46, 5 + o, 49, 25.5 + o, 61, 20, 1.5, 0.7);
    p.line(1, [9, 6, 2.4].map((r) => ringX(49, 15.2 + o, 71, r)).join(""), "nf lo");
  });

  // the top and the front panel: a power button, a light, vents
  const led = [];
  part("case", () => [[L - 4, 0, 0], [L, Wd, H]], (p) => {
    p.blk(0, 0, 0, L, Wd, H - T, T, 3, 1);
    p.blk(1, L - 4, 0, L, Wd, 0, H, 1.5, 0.7);
    let d = ringX(L, 14, H - 10, 3);
    for (let y = 8; y <= 32; y += 4) d += seg(P(L, y, 10), P(L, y, H - 24));
    p.line(0, d, "nf");
    if (!led.length) led.push(flatDot(p.grp, C, 0.9, "dot"));
    place(led[0], P(L, 24, H - 10));
  });

  // the glass side: only its edges show
  part("glass", (o) => [[0, Wd + o, 0], [L, Wd + 1.5 + o, H]], (p, o) => {
    p.blk(0, 0, Wd + o, L, Wd + 1.5 + o, 0, H, 3, 0.6);
    p.s[0].sil.classList.add("nf");
    p.s[0].cr.classList.add("nf");
  });

  const offset = (p, a, k = 0) => a * GAP * OUT[p.name] + k * PICK;
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

  let outlines = [];
  function aim(a, now) {
    parts.forEach((p, i) => tset(p.tw, a, now, (parts.length - 1 - i) * STEP));
    outlines = parts.map((p) => {
      const [[x0, y0, z0], [x1, y1, z1]] = p.box(offset(p, a)), pts = [];
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
  /** Picks part i (-1: none): it slides out, the glass makes way first. */
  function choose(i) {
    if (i === act) return;
    act = i;
    const now = performance.now(), gl = parts.length - 1, inner = i > 0 && i < gl && parts[i].name !== "case";
    parts.forEach((p, k) => {
      const out = k === i && p.name !== "case" ? 1 : k === gl && inner ? 1.6 : 0;
      tset(p.pk, out, now, Math.abs(k - Math.max(i, 0)) * PSTEP);
      p.s.forEach((s) => s.sil.classList.toggle("hi", k === i || (p.name === "case" && parts[i]?.name === "case")));
    });
    led[0].setAttribute("class", i < 0 ? "dot" : "dot m");
    read.textContent = i < 0 ? "rest" : parts[i].name;
    B.wake();
  }

  // nearest first: the parts inside, then the glass, then the case
  const ORDER = [5, 4, 3, 2, 1, 7, 6, 0];
  bag.add(pointer(stage, {
    move: (pt) => choose(ORDER.find((k) => inside(pt, outlines[k])) ?? -1),
    leave: () => choose(-1),
  }));
  aim(clamp(value, 0, 1), performance.now());
  choose(-1);
  bag.add(() => svg.replaceChildren());
  return { set: (v) => aim(clamp(v, 0, 1), performance.now()), destroy: bag.dispose };
}

hairline({
  name: "computer",
  means: "A tower PC, built: board, CPU and cooler, RAM, graphics card, power supply. Its parts slide out; the pointer picks one and names it.",
  rules: [1, 2, 4, 5],
  range: [0, 0.25, 1],
  tour: [[249, 70], [223, 139], [200, 177], null],
  mount,
});
