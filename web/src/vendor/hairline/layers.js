/**
 * Layers: the course as a stepped stack, each layer a plate on the one below
 * and a little narrower, so a band of every top shows. Sand grains at the
 * bottom; then transistors, gates, adders on a carry line, memory cells, a
 * CPU with its pins, code, and on top a falling-block game, lit. The number
 * is how far apart the layers stand: they spread upwards, a beat apart, and
 * every face shows whole. The pointer picks a layer by the top it is over (in
 * the target pose, rule 01): its outline goes bright, the layers above lift
 * to show it, and the read-out names it.
 */
const {
  Cam, clamp, facing, fit, poly, prism, proj, rings, rrect, seg, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid, unproj,
} = HL;

const N = 8, T = 4.5, BASE = 104, SHRINK = 10, REST = 4, GAP = 7, PICK = 9, STEP = 50, PSTEP = 40;
const NAMES = ["sand", "transistors", "gates", "adders", "memory", "cpu", "code", "game"];
const GAME = ["...##..", "....#..", ".......", ".......", "#....##", "##.####", "###.###"];
const half = (i) => (BASE - SHRINK * i) / 2;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.9);
  const top = N * T + (N - 1) * (REST + GAP) + PICK;
  fit(C, [[-52, -52, 0], [52, -52, 0], [-52, 52, 0], [52, 52, 0], [-17, -17, top], [17, 17, top]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);
  // outlines on a plate's top at height z: a rounded square, a segment
  const sq = (x, y, w, h, z, r = 0.8) => poly(rrect(x, y, x + w, y + h, r, 2).map((q) => P(q.u, q.v, z)));
  const ln = (x0, y0, x1, y1, z) => seg(P(x0, y0, z), P(x1, y1, z));

  // the marks on each layer's top, at height z, inside half-width h
  const FACES = [
    (p, z, h) => {
      // sand: grains, scattered the same way every time
      if (!p.dots) {
        p.dots = [];
        let s = 7;
        for (let k = 0; k < 70; k++) {
          s = (s * 75 + 74) % 65537;
          const el = flatDot(p.grp, C, k % 3 ? 0.55 : 0.8, k % 4 ? "dot off" : "dot m");
          p.dots.push([el, ((s % 1000) / 1000) * 2 - 1, (((s >> 3) % 1000) / 1000) * 2 - 1]);
        }
      }
      for (const [el, u, v] of p.dots) place(el, P(u * (h - 2), v * (h - 2), z));
      return "";
    },
    (p, z, h) => {
      // transistors: a channel with its gate across
      let d = "";
      for (let x = -h + 5; x < h - 6; x += 11) for (let y = -h + 5; y < h - 4; y += 11)
        d += sq(x, y, 6, 3.4, z) + ln(x + 3, y - 1.2, x + 3, y + 4.6, z);
      return d;
    },
    (p, z, h) => {
      // gates: a body with two inputs and an output
      let d = "";
      for (let x = -h + 5; x < h - 8; x += 12) for (let y = -h + 5; y < h - 6; y += 12)
        d += sq(x + 2, y, 5, 5, z, 2) + ln(x, y + 1.5, x + 2, y + 1.5, z) + ln(x, y + 3.5, x + 2, y + 3.5, z) + ln(x + 7, y + 2.5, x + 9, y + 2.5, z);
      return d;
    },
    (p, z, h) => {
      // adders: rows of cells joined by their carry
      let d = "";
      for (let y = -h + 6; y < h - 6; y += 12) {
        d += ln(-h + 4, y + 2.5, h - 4, y + 2.5, z);
        for (let x = -h + 5; x < h - 8; x += 10) d += sq(x, y, 6, 5, z);
      }
      return d;
    },
    (p, z, h) => {
      // memory: a grid of cells
      let d = "";
      for (let x = -h + 4; x < h - 5; x += 7) for (let y = -h + 4; y < h - 5; y += 7) d += sq(x, y, 5, 5, z, 0.6);
      return d;
    },
    (p, z, h) => {
      // the CPU: a chip in the middle (its block is drawn on top), pins, traces
      let d = "";
      for (let k = -9; k <= 9; k += 3)
        d += ln(k, -14, k, -18, z) + ln(k, 14, k, 18, z) + ln(-14, k, -18, k, z) + ln(14, k, 18, k, z);
      d += ln(18, 6, h - 3, 6, z) + ln(-6, 18, -6, h - 3, z) + ln(6, 18, 6, h - 3, z) + ln(18, -6, h - 3, -6, z);
      p.blk(1, -13, -13, 13, 13, z, 2.5, 2, 1);
      return d;
    },
    (p, z, h) => {
      // code: lines, indented the way code is
      const LINES = [[0, 22], [3, 26], [6, 14], [6, 20], [3, 8], [0, 18], [3, 24], [0, 6]];
      return LINES.map(([ind, len], k) => ln(-h + 5 + ind * 1.6, -h + 5 + k * 4.4, -h + 5 + ind * 1.6 + len, -h + 5 + k * 4.4, z)).join("");
    },
    (p, z, h) => {
      // the game: a piece falling over rows built below, the lit mark at rest
      if (!p.px) {
        p.px = [];
        GAME.forEach((row) => [...row].forEach((c) => p.px.push(flatDot(p.grp, C, 1.05, c === "#" ? "dot" : "dot off"))));
      }
      let k = 0;
      GAME.forEach((row, r) => [...row].forEach((_, c) => place(p.px[k++], P(-h + 4 + c * ((2 * h - 8) / 6), -h + 4 + r * ((2 * h - 8) / 6), z))));
      return sq(-h + 2, -h + 2, 2 * h - 4, 2 * h - 4, z, 2);
    },
  ];

  const parts = NAMES.map((name, i) => {
    const grp = mk("g", {}, g), p = { name, i, grp, s: [], line: null, tw: tween(0), pk: tween(0), drawn: NaN };
    p.blk = (k, x0, y0, x1, y1, z0, hgt, r, b) => {
      p.s[k] ||= solid(grp);
      const [a, inner] = rings(x0, y0, x1, y1, r, b);
      put(p.s[k], prism(P, front, a, inner, z0, z0 + hgt));
    };
    p.draw = (o) => {
      const h = half(i), z0 = i * T + o;
      p.blk(0, -h, -h, h, h, z0, T, 4, 1.4);
      const d = FACES[i](p, z0 + T, h);
      p.line ||= mk("path", { class: "nf lo" }, grp);
      // the plate's solid goes under its marks; a chip block over them
      if (p.s[1]) grp.append(p.s[1].g);
      p.line.setAttribute("d", d);
    };
    return p;
  });

  // a layer's height: a little apart at rest (rule 05), spread by the number,
  // lifted when one below is picked
  const offset = (p, a, k) => (REST + a * GAP) * p.i + k * PICK;
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

  let spread = 0;
  function aim(a, now) {
    spread = a;
    parts.forEach((p) => tset(p.tw, a, now, p.i * STEP));
    B.wake();
  }

  let act = -2;
  const lift = (k, i) => (i < 0 ? 0 : k > i ? 1 : k === i ? 0.4 : 0);
  /** Picks layer i (-1: none): it rises a little, the layers above lift. */
  function choose(i) {
    if (i === act) return;
    act = i;
    const now = performance.now();
    parts.forEach((p) => {
      tset(p.pk, lift(p.i, i), now, Math.abs(p.i - Math.max(i, 0)) * PSTEP);
      p.s.forEach((s) => s.sil.classList.toggle("hi", p.i === i));
    });
    const lit = i < 0 || i === N - 1;
    parts[N - 1].px.forEach((el) => {
      if (!el.classList.contains("off")) el.setAttribute("class", lit ? "dot" : "dot m");
    });
    read.textContent = i < 0 ? "rest" : NAMES[i];
    B.wake();
  }

  // the highest top under the pointer, in the target pose (rule 01)
  function pick(pt) {
    for (let i = N - 1; i >= 0; i--) {
      const z = i * T + T + (REST + spread * GAP) * i + lift(i, act) * PICK;
      const [x, y] = unproj(C, pt[0], pt[1], z);
      if (Math.abs(x) <= half(i) && Math.abs(y) <= half(i)) return i;
    }
    return -1;
  }

  bag.add(pointer(stage, { move: (pt) => choose(pick(pt)), leave: () => choose(-1) }));
  aim(clamp(value, 0, 1), performance.now());
  choose(-1);
  bag.add(() => svg.replaceChildren());
  return { set: (v) => aim(clamp(v, 0, 1), performance.now()), destroy: bag.dispose };
}

hairline({
  name: "layers",
  means: "The course as a stack: sand, transistors, gates, adders, memory, CPU, code, and a game on top. Point at a layer to lift what it holds up.",
  rules: [1, 2, 4, 5],
  range: [0, 0.25, 1],
  tour: [[200, 117], [240, 188], [264, 268], null],
  mount,
});
