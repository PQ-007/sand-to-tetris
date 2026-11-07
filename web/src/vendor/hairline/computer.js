/**
 * Computer: a tower PC, built: case, board (I/O cover, socket heatsinks, power
 * connector, M.2, slots), a CPU under a tower cooler, RAM, a graphics card, the
 * power supply and a drive cage, behind a glass side. The number is how far
 * apart it is: every part slides out towards us, a beat apart, the glass
 * furthest. The pointer picks a part: its outline goes bright, it slides out
 * (the glass first makes way), the read-out names it. Hits use the target pose.
 */
const {
  Cam, clamp, facing, fit, hull, poly, prism, proj, rings, rrect, seg, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const L = 84, Wd = 40, H = 92, T = 3, GAP = 15, STEP = 60, PICK = 9, PSTEP = 40;
// how far each part slides at full explode, in gaps (paint order)
const OUT = { case: 0, board: 0.5, psu: 1, drives: 1.2, gpu: 1.7, ram: 1.3, cpu: 2.2, glass: 3.2 };

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.05);
  const far = Wd + 3.2 * GAP + PICK * 1.6 + 2;
  fit(C, [[0, 0, -3], [L, 0, -3], [0, far, -3], [L, far, -3], [0, 0, H], [L, far, H]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  // circles on a face: across y and z at x, across x and y at z, across x and z at y
  const sq = (a, b, r) => rrect(a - r, b - r, a + r, b + r, r, 4);
  const ringX = (x, y, z, r) => poly(sq(y, z, r).map((q) => P(x, q.u, q.v)));
  const ringZ = (x, y, z, r) => poly(sq(x, y, r).map((q) => P(q.u, q.v, z)));
  const ringY = (x, y, z, r) => poly(sq(x, z, r).map((q) => P(q.u, y, q.v)));
  // a fan seen from above: rings and three blades
  const fanZ = (x, y, z, r) => [r, r * 0.68, r * 0.26].map((k) => ringZ(x, y, z, k)).join("")
    + [0, 2.1, 4.2].map((a) => seg(P(x + Math.cos(a) * r * 0.26, y + Math.sin(a) * r * 0.26, z), P(x + Math.cos(a + 0.7) * r * 0.86, y + Math.sin(a + 0.7) * r * 0.86, z))).join("");
  const box = (x0, z0, x1, z1, y) => poly([P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)]);

  const parts = [];
  function part(name, bounds, draw) {
    const grp = mk("g", {}, g), p = { name, bounds, grp, s: [], l: [], tw: tween(0), pk: tween(0), drawn: NaN };
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

  // the case's far walls and floor, on four feet
  part("case", () => [[0, 0, -3], [L, Wd, H]], (p) => {
    [[3, 3], [L - 13, 3], [3, Wd - 7], [L - 13, Wd - 7]].forEach(([x, y], k) => p.blk(4 + k, x, y, x + 10, y + 4, -3, 3, 1.5, 0.6));
    p.blk(0, 0, 0, L, T, 0, H, 3, 1);
    p.blk(1, 0, 0, T, Wd, 0, H, 1.2, 0.6);
    p.blk(2, 0, 0, L, Wd, 0, T, 3, 1);
  });

  // the board: rear I/O cover, socket heatsinks, power connector, M.2, slots
  part("board", (o) => [[8, 3 + o, 28], [74, 9 + o, 88]], (p, o) => {
    const y = 4.5 + o, f = (x, z) => P(x, y, z);
    p.blk(0, 8, 3 + o, 74, y, 28, 60, 1, 0.4);
    p.line(0, [[20, 52, 44, 52], [50, 50, 70, 50], [60, 34, 60, 46], [52, 56, 52, 80]].map(([a, b, c, d]) => seg(f(a, b), f(c, d))).join("")
      + box(12, 47, 70, 49, y) + box(56, 30, 68, 34, y));
    p.blk(1, 9, y, 15, 9 + o, 62, 24, 1, 0.5);
    p.blk(2, 26, y, 48, 8.5 + o, 83, 4, 1, 0.5);
    p.blk(3, 22, y, 25.5, 8.5 + o, 60, 22, 1, 0.5);
    p.blk(4, 70, y, 73, 8 + o, 56, 16, 0.8, 0.4);
    p.blk(5, 16, y, 42, 6.2 + o, 30, 3.5, 0.8, 0.4);
  });

  // the power supply, its fan facing up
  part("psu", (o) => [[6, 4 + o, T], [46, 36 + o, 22]], (p, o) => {
    p.blk(0, 6, 4 + o, 46, 36 + o, T, 19, 2, 1);
    p.line(0, fanZ(26, 20 + o, T + 19, 8));
  });

  // a cage of two drives beside it
  part("drives", (o) => [[52, 6 + o, T], [77, 36 + o, 20]], (p, o) => {
    p.blk(0, 52, 6 + o, 77, 36 + o, T, 17, 1.5, 0.8);
    const y = 36 + o;
    p.line(0, box(54, 6, 75, 11, y) + box(54, 13, 75, 18, y) + [8.5, 15.5].map((z) => ringY(72, y, z, 0.8)).join(""));
  });

  // the graphics card: bracket at the back, two fans, a power plug on top
  part("gpu", (o) => [[8, 4.5 + o, 34], [72, 33 + o, 47.5]], (p, o) => {
    p.blk(0, 8, 4.5 + o, 10.5, 33 + o, 34, 13, 0.6, 0.3);
    p.blk(1, 12, 4.5 + o, 72, 32 + o, 36, 9, 2, 1);
    p.line(0, fanZ(30, 18 + o, 45, 8.5) + fanZ(54, 18 + o, 45, 8.5));
    p.line(1, seg(P(12, 32 + o, 38), P(72, 32 + o, 38)));
    p.blk(2, 64, 22 + o, 70, 28 + o, 45, 2.5, 0.8, 0.4);
  });

  // four RAM sticks beside the CPU, a ridge on each
  part("ram", (o) => [[52, 4.5 + o, 60], [67, 13 + o, 82]], (p, o) => {
    [52, 56, 60, 64].forEach((x, k) => p.blk(k, x, 4.5 + o, x + 2.4, 13 + o, 60, 22, 0.6, 0.3));
    p.line(0, [52, 56, 60, 64].map((x) => seg(P(x + 1.2, 5.5 + o, 82), P(x + 1.2, 12 + o, 82))).join(""));
  });

  // the CPU under a tower cooler: fins, heat pipes over the top, a fan in front
  part("cpu", (o) => [[30, 4.5 + o, 60], [49, 26 + o, 82]], (p, o) => {
    p.blk(0, 30, 4.5 + o, 46, 26 + o, 60, 22, 1.5, 0.8);
    let d = "";
    for (let z = 63; z < 82; z += 2.4) d += seg(P(31.5, 26 + o, z), P(44.5, 26 + o, z));
    for (const x of [33, 36.5, 40, 43.5]) d += seg(P(x, 7 + o, 82), P(x, 24 + o, 82));
    p.line(0, d);
    p.blk(1, 46, 5 + o, 49, 25.5 + o, 61, 20, 1.5, 0.7);
    p.line(1, [9, 6, 2.4].map((r) => ringX(49, 15.2 + o, 71, r)).join("")
      + [0, 2.1, 4.2].map((a) => seg(P(49, 15.2 + o + Math.cos(a) * 2.4, 71 + Math.sin(a) * 2.4), P(49, 15.2 + o + Math.cos(a + 0.7) * 7.6, 71 + Math.sin(a + 0.7) * 7.6))).join(""), "nf lo");
  });

  // the vented top and the front panel: power, reset, USB, a light, vents
  const led = [];
  part("case", () => [[L - 4, 0, 0], [L, Wd, H]], (p) => {
    p.blk(0, 0, 0, L, Wd, H - T, T, 3, 1);
    p.blk(1, L - 4, 0, L, Wd, 0, H, 1.5, 0.7);
    let top = "";
    for (let x = 14; x <= 66; x += 4) top += seg(P(x, 8, H), P(x, 32, H));
    p.line(1, top);
    let d = ringX(L, 14, H - 10, 3) + ringX(L, 30, H - 10, 1.1);
    for (const y of [8, 13]) d += poly([P(L, y, H - 18), P(L, y + 3, H - 18), P(L, y + 3, H - 16.6), P(L, y, H - 16.6)]);
    for (let y = 8; y <= 32; y += 4) d += seg(P(L, y, 10), P(L, y, H - 26));
    p.line(0, d, "nf");
    if (!led.length) led.push(flatDot(p.grp, C, 0.9, "dot"));
    place(led[0], P(L, 22, H - 10));
  });

  // the glass side: only its edges show, and four thumbscrews
  part("glass", (o) => [[0, Wd + o, 0], [L, Wd + 1.5 + o, H]], (p, o) => {
    p.blk(0, 0, Wd + o, L, Wd + 1.5 + o, 0, H, 3, 0.6);
    p.s[0].sil.classList.add("nf");
    p.s[0].cr.classList.add("nf");
    p.line(0, [[5, 5], [L - 5, 5], [5, H - 5], [L - 5, H - 5]].map(([x, z]) => ringY(x, Wd + 1.5 + o, z, 1.4)).join(""));
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
      const [[x0, y0, z0], [x1, y1, z1]] = p.bounds(offset(p, a)), pts = [];
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
  const ORDER = [6, 5, 4, 3, 2, 1, 8, 7, 0];
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
  means: "A tower PC, built: board, CPU and cooler, RAM, graphics card, drives, power supply. Parts slide out; the pointer picks one and names it.",
  rules: [1, 2, 4, 5],
  range: [0, 0.25, 1],
  tour: [[249, 70], [223, 139], [200, 177], null],
  mount,
});
