/**
 * Carry: eight one-bit adders in a row, bit 0 at the back. Each takes two
 * input pins on its lid and puts its sum out on a tab in front; a link
 * carries its carry to the next. The pointer picks a bit: the carry ripples
 * to it from bit 0, one adder after another, each lifting and lighting as
 * the carry reaches it, the way a ripple-carry adder makes the top bit wait
 * for every bit below. At rest the carry has reached bit 2. The slider is
 * the time per hop, in ms: one adder's delay.
 *
 * The pattern: a path that lights hop by hop, as in the package's Relay.
 * Tweens with a delay per hop from the source, and a hit test on each
 * adder's resting footprint on its lid's plane, which never moves.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, tween, tset, tval, tdone,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const N = 8, PITCH = 18, BW = 13, BD = 22, BH = 10, LIFT = 5, REST = 2;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let hop = value;
  const C = Cam(45, 0.5, 2.15);
  const X1 = (N - 1) * PITCH + BW;
  fit(C, [[-2, -2, 0], [X1 + 2, -2, 0], [-2, BD + 8, 0], [X1 + 2, BD + 8, 0], [0, 0, BH + LIFT + 2], [X1, 0, BH + LIFT + 2]], 200, 170);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // a plinth under the row
  const base = solid(g), [pr, pi] = rings(-6, -6, X1 + 6, BD + 10, 5, 1.6);
  put(base, prism(P, front, pr, pi, -4, 0));

  // the adders, back to front (bit 0 is farthest); each: link to the next
  // drawn after it, so the nearer adder covers the link's far end
  const bits = [];
  for (let i = 0; i < N; i++) {
    const x0 = i * PITCH, grp = mk("g", {}, g);
    const body = solid(grp), tab = solid(grp);
    const pins = [flatDot(grp, C, 1, "dot off"), flatDot(grp, C, 1, "dot off")];
    const link = i < N - 1 ? solid(grp) : null;
    bits.push({ x0, body, tab, pins, link, lift: tween(i <= REST ? LIFT : 0), drawn: NaN });
  }

  function draw(b, i, now) {
    // a link sits at the lower of its two adders, so both heights matter
    const z = tval(b.lift, now), nz = b.link ? Math.min(z, tval(bits[i + 1].lift, now)) : 0;
    const key = z + "," + nz;
    if (key === b.drawn) return;
    b.drawn = key;
    const [r, ri] = rings(b.x0, 0, b.x0 + BW, BD, 2, 0.9);
    put(b.body, prism(P, front, r, ri, z, z + BH));
    const [t, ti] = rings(b.x0 + 4, BD, b.x0 + BW - 4, BD + 5, 1, 0.5);
    put(b.tab, prism(P, front, t, ti, z + 3, z + 6));
    b.pins.forEach((el, k) => place(el, P(b.x0 + BW / 2, 6 + k * 9, z + BH)));
    if (b.link) {
      const [l, li] = rings(b.x0 + BW - 1, 9, b.x0 + PITCH + 1, 13, 1, 0.5);
      put(b.link, prism(P, front, l, li, nz + 5, nz + 8));
    }
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    bits.forEach((b, i) => {
      draw(b, i, now);
      if (!tdone(b.lift, now)) moving = true;
    });
    return moving;
  });
  bag.add(B.unregister);

  let to = -2;
  /** The carry reaches bit `a` (-1: back to rest), hop by hop from bit 0. */
  function reach(a) {
    if (a === to) return;
    to = a;
    const now = performance.now(), end = a < 0 ? REST : a;
    bits.forEach((b, i) => {
      const on = i <= end;
      tset(b.lift, on ? LIFT : 0, now, on ? i * hop : 0);
      b.body.sil.classList.toggle("hi", on);
      if (b.link) b.link.sil.classList.toggle("hi", i < end);
      b.pins.forEach((el) => el.setAttribute("class", on ? "dot m" : "dot off"));
    });
    read.textContent = a < 0 ? "rest" : `bit ${a}`;
    B.wake();
  }

  /** Which adder's resting lid holds the pointer. */
  function hit(p) {
    const [x, y] = unproj(C, p[0], p[1], BH);
    if (y < -6 || y > BD + 8 || x < -4 || x > X1 + 4) return -1;
    return clamp(Math.floor((x + (PITCH - BW) / 2) / PITCH), 0, N - 1);
  }

  bag.add(pointer(stage, { move: (p) => reach(hit(p)), leave: () => reach(-1) }));
  reach(-1);
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { hop = clamp(v, 0, 300); }, destroy: bag.dispose };
}

hairline({
  name: "carry",
  means: "Eight adders in a row: point at a bit and the carry ripples to it from bit 0, one adder after another.",
  rules: [1, 2, 4, 5],
  range: [40, 90, 160],
  tour: [[150, 120], [230, 175], [290, 205], null],
  mount,
});
