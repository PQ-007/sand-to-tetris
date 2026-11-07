/**
 * Computer: a desktop computer that comes apart. In the base, a power supply
 * with its fan and a drive cage; above it the board: a CPU under a finned
 * heatsink, four RAM sticks, capacitors, chips, a slot, back connectors and
 * traces; the cover (vents, power button, light, drive bays) encloses both;
 * a monitor on its stand shows a block falling; a keyboard and a mouse lie in
 * front. The number is how far apart it is: the layers lift one gap each, a
 * beat apart, and the keyboard slides forward. The pointer picks a part: its
 * outline goes bright, what is stacked above it lifts to show it, and the
 * read-out names it. Hits are tested on the target pose (rule 01).
 */
const {
  Cam, clamp, facing, fit, hull, poly, prism, proj, rings, rrect, seg, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const W = 100, D = 64, GAP = 20, STEP = 60, PICK = 10, PSTEP = 40;
const BASE = 6, IN = 7, PLATE = 1.5, CASE = 20, MON = 36, KY = D + 10, LIFTS = [0, 1, 3.2, 4.2, 1];
const PIXELS = ["...##...", "...##...", "........", "........", "##.#####", "####.###"];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.42);
  const top = BASE + CASE + 14 + MON + 4.2 * GAP + PICK;
  fit(C, [[0, 0, 0], [W, 0, 0], [0, KY + 26 + GAP + PICK, 0], [W + 14, KY + 26 + GAP + PICK, 0], [8, 6, top], [W - 8, 6, top]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const face = (y, pts) => pts.map(([x, z]) => P(x, y, z));
  const ring = (x, z, r, y) => face(y, rrect(x - r, z - r, x + r, z + r, r, 4).map((q) => [q.u, q.v]));

  // A part: a group of solids and lines, redrawn at an offset; `box` gives
  // the world box its outline (for the hit test) is taken from.
  const parts = [];
  function part(name, layer, box, draw) {
    const grp = mk("g", {}, g), p = { name, layer, box, grp, s: [], l: [], tw: tween(0), pk: tween(0), drawn: NaN };
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

  // the base: a power supply with its fan at the back, a drive cage in front
  part("case", 0, () => [[0, 0, 0], [W, D, BASE + 7]], (p) => {
    p.blk(0, 0, 0, W, D, 0, BASE, 6, 1.6);
    p.blk(1, 8, 6, 38, 30, BASE, 7, 2, 1);
    p.blk(2, 8, 40, 34, 58, BASE, 5);
    p.line(0, [8, 6, 4.4, 2.6].map((r) => poly(rrect(23 - r, 18 - r, 23 + r, 18 + r, r, 4).map((q) => P(q.u, q.v, BASE + 7)))).join(""));
    p.line(1, [44, 48, 52].map((y) => seg(P(10, y, BASE + 5), P(32, y, BASE + 5))).join(""));
  });

  // the board: far to near, so nearer parts cover farther ones
  const CAPS = [[30, 44], [34, 47], [64, 18], [64, 24]];
  part("board", 1, (o) => [[4, 4, BASE + IN + o], [W - 4, D - 4, BASE + IN + o + PLATE + 6]], (p, o) => {
    const z = BASE + IN + o, t = z + PLATE;
    p.blk(0, 4, 4, W - 4, D - 4, z, PLATE, 3, 1);
    p.line(0, [[26, 30, 66, 30], [48, 40, 48, 50], [20, 20, 36, 20], [60, 46, 84, 46]].map(([a, b, c, d]) => seg(P(a, b, t), P(c, d, t))).join(""));
    p.blk(1, 70, 6, 80, 11, t, 4);
    p.blk(2, 84, 6, 92, 11, t, 4);
    p.blk(3, 12, 10, 22, 18, t, 2);
    p.blk(4, 36, 16, 60, 40, t, 6, 1.5, 0.8);
    p.line(1, [0, 1, 2, 3, 4, 5, 6].map((k) => seg(P(38, 18 + k * 3.3, t + 6), P(58, 18 + k * 3.3, t + 6))).join(""), "nf");
    [66, 70, 74, 78].forEach((x, k) => p.blk(5 + k, x, 12, x + 2.5, 54, t, 5.5, 0.6, 0.3));
    CAPS.forEach(([x, y], k) => p.blk(9 + k, x - 1.8, y - 1.8, x + 1.8, y + 1.8, t, 4, 1.8, 0.6));
    p.blk(13, 10, 48, 50, 51, t, 3, 0.8, 0.4);
    p.blk(14, 84, 40, 94, 50, t, 2);
  });

  // the cover: vents on top; a power button, a light and two drive bays in front
  part("cover", 2, (o) => [[0, 0, BASE + o], [W, D, BASE + CASE + o]], (p, o) => {
    const z = BASE + o, t = z + CASE, m = z + CASE / 2;
    p.blk(0, 0, 0, W, D, z, CASE, 6, 1.6);
    let d = "";
    for (let k = 0; k < 8; k++) d += seg(P(50 + k * 5, D - 14, t), P(50 + k * 5, D - 6, t));
    p.line(0, d);
    p.line(1, poly(face(D + 0.2, [[10, m + 3], [40, m + 3], [40, m + 6], [10, m + 6]])) + poly(face(D + 0.2, [[10, m - 4], [40, m - 4], [40, m - 1], [10, m - 1]])));
    p.line(2, poly(ring(W - 14, m, 2.6, D + 0.2)), "nf");
    p.led ||= flatDot(p.grp, C, 0.9, "dot m");
    place(p.led, P(W - 24, D + 0.2, m));
  });

  // the monitor on its stand; its screen faces us
  const px = [];
  const mon = part("screen", 3, (o) => [[8, 4, BASE + CASE + o], [W - 8, 20, BASE + CASE + 14 + MON + o]], (p, o) => {
    const z = BASE + CASE + o, zp = z + 14, yf = 12.2;
    p.blk(0, 34, 4, 66, 20, z, 1.5, 4, 1);
    p.blk(1, 46, 7, 54, 11, z + 1.5, 13);
    p.blk(2, 8, 6, W - 8, 12, zp, MON, 3, 1.2);
    p.line(0, poly(face(yf, rrect(14, zp + 5, W - 14, zp + MON - 5, 2.5, 4).map((q) => [q.u, q.v]))), "nf");
    if (!p.dots) {
      p.dots = [];
      PIXELS.forEach((row) => [...row].forEach((c) => {
        const el = flatDot(p.grp, C, 0.95, c === "#" ? "dot" : "dot off");
        p.dots.push(el);
        if (c === "#") px.push(el);
      }));
      p.pow = flatDot(p.grp, C, 0.7, "dot m");
    }
    let k = 0;
    PIXELS.forEach((row, r) => [...row].forEach((_, c) => place(p.dots[k++], P(23 + c * 7.7, yf, zp + MON - 10 - r * 4.4))));
    place(p.pow, P(W - 12, yf, zp + 2.5));
  });

  // the keyboard and the mouse; apart, they slide toward us
  part("keys", 1, (o) => [[8, KY + o, 0], [W + 12, KY + o + 24, 4]], (p, o) => {
    const y = KY + o, t = 3.5;
    p.blk(0, 8, y, W - 8, y + 24, 0, t, 3, 1.2);
    let d = "";
    for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++)
      d += poly(rrect(13 + c * 6.3, y + 3 + r * 4.2, 17.6 + c * 6.3, y + 6.4 + r * 4.2, 0.8, 2).map((q) => P(q.u, q.v, t)));
    p.line(0, d + poly(rrect(32, y + 20, W - 32, y + 22.4, 0.8, 2).map((q) => P(q.u, q.v, t))));
    p.blk(1, W - 2, y + 4, W + 10, y + 20, 0, 3.5, 5, 1.2);
    p.line(1, seg(P(W + 4, y + 4.5, 3.5), P(W + 4, y + 10, 3.5)));
  });

  // the cover lifts furthest: it has to clear the board it covers
  const offset = (p, a, k = 0) => a * GAP * LIFTS[parts.indexOf(p)] + k * PICK;
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

  // each part's outline in its target pose, for the hit test
  let outlines = [];
  function aim(a, now) {
    parts.forEach((p, i) => tset(p.tw, a, now, i * STEP));
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
  /** Picks part i (-1: none): what is stacked above it lifts to show it. */
  function choose(i) {
    if (i === act) return;
    act = i;
    const now = performance.now();
    parts.forEach((p, k) => {
      const up = i < 0 ? 0 : i === 4 ? +(k === 4) : k === 4 ? 0 : i === 3 ? +(k === 3) : +(k > i);
      tset(p.pk, up, now, Math.abs(k - Math.max(i, 0)) * PSTEP);
      p.s.forEach((s) => s.sil.classList.toggle("hi", k === i));
    });
    const lit = i < 0 || parts[i] === mon;
    px.forEach((el) => el.classList.toggle("m", !lit));
    read.textContent = i < 0 ? "rest" : parts[i].name;
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (pt) => choose([4, 3, 2, 1, 0].find((k) => inside(pt, outlines[k])) ?? -1),
    leave: () => choose(-1),
  }));
  aim(clamp(value, 0, 1), performance.now());
  choose(-1);
  bag.add(() => svg.replaceChildren());
  return { set: (v) => aim(clamp(v, 0, 1), performance.now()), destroy: bag.dispose };
}

hairline({
  name: "computer",
  means: "A desktop computer that comes apart in layers: base, board, cover, monitor. The pointer picks a part and names it.",
  rules: [1, 2, 4, 5],
  range: [0, 0.25, 1],
  tour: [[200, 96], [212, 196], [150, 262], null],
  mount,
});
