/**
 * Transistor: a MOSFET, cut away at the front. A block of silicon with two
 * wells set into it, the source and the drain, each with a contact post; a
 * thin oxide and the gate across the gap between them, with its own post.
 * The cut face shows the wells and, under the gate, the band where the
 * channel forms. The pointer is the gate voltage: the nearer the gate, the
 * higher. Electrons gather in the band as it rises; past the threshold the
 * channel joins source to drain and goes bright. The slider is how near the
 * pointer must come for the full voltage, in units.
 *
 * The pattern: a field on one number. A spring on the voltage, a falloff by
 * the pointer's distance from the gate on the ground plane, which never
 * moves, and a rest that already shows the band, faintly.
 */
const {
  Cam, clamp, facing, fit, open, poly, prism, proj, rings, unproj, spring, stepS,
  flatDot, mk, place, pointer, put, register, disposer, solid,
} = HL;

const L = 120, D = 52, BODY = 18, VMAX = 1.4, VT = 0.7;
const WELLS = [[8, 38], [82, 112]], GX0 = 40, GX1 = 80;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let reach = value;
  const C = Cam(45, 0.5, 2.3);
  fit(C, [[0, 0, -BODY], [L, D, -BODY], [L, 0, -BODY], [0, D, -BODY], [0, 0, 26], [L, 0, 26]], 200, 172);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const blk = (x0, y0, x1, y1, z0, z1, r = 1.5, b = 0.8) => {
    const s = solid(g), [a, i] = rings(x0, y0, x1, y1, r, b);
    put(s, prism(P, front, a, i, z0, z1));
    return s;
  };
  const onFace = (pts) => pts.map(([x, z]) => P(x, D + 0.15, z));

  // the silicon body; on its cut face the two wells
  blk(0, 0, L, D, -BODY, 0, 4, 1.4);
  mk("path", { d: WELLS.map(([a, b]) => open(onFace([[a, 0], [a, -6], [a + 3, -8], [b - 3, -8], [b, -6], [b, 0]]))).join(""), class: "nf" }, g);
  // far to near (+x is nearer): the source well and its post, the oxide,
  // the gate with its charge marks and its post, then the drain
  const well = ([a, b]) => {
    blk(a, 8, b, D - 8, 0, 1, 1.5, 0.7);
    blk((a + b) / 2 - 3, 20, (a + b) / 2 + 3, 32, 1, 20, 1.2, 0.6);
  };
  well(WELLS[0]);
  blk(GX0 - 2, 4, GX1 + 2, D - 4, 0, 1.2, 1, 0.5);
  const gate = blk(GX0, 6, GX1, D - 6, 1.2, 9, 1.5, 0.8);
  // the gate's charge, along its lid's front edge: as many marks as it holds
  const plus = [];
  for (let k = 0; k < 8; k++) place((plus[k] = flatDot(g, C, 0.85, "dot off")), P(GX0 + 4 + k * 4.6, D - 11, 9));
  blk((GX0 + GX1) / 2 - 3, 20, (GX0 + GX1) / 2 + 3, 32, 9, 24, 1.2, 0.6);
  well(WELLS[1]);

  // the band under the gate, on the cut face: electrons and the channel
  const e = [];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) {
    const el = flatDot(g, C, 0.85, "dot off");
    place(el, P(GX0 + 1 + k * 4.2, D + 0.15, -1.5 - r * 1.8));
    e.push({ el, at: (r + 1) / 4 - (k % 2 ? 0.08 : 0) });
  }
  const channel = mk("path", { d: open(onFace([[WELLS[0][1] - 2, -0.6], [WELLS[1][0] + 2, -0.6]])), class: "nf lo" }, g);

  const v = spring(0.25 * VMAX, { eps: 0.002 });
  let drawn = NaN;
  function draw() {
    const x = clamp(v.x / VMAX, 0, 1);
    if (Math.abs(x - drawn) < 0.002) return;
    drawn = x;
    e.forEach((d) => d.el.setAttribute("class", "dot " + (x >= d.at ? "" : x >= d.at - 0.35 ? "m" : "off")));
    plus.forEach((el, k) => el.setAttribute("class", "dot " + (k / plus.length < x ? "m" : "off")));
    const on = v.x >= VT;
    channel.setAttribute("class", on ? "nf hi" : "nf lo");
    gate.sil.classList.toggle("hi", on);
  }
  draw();

  const B = register(stage, (dt) => { const m = stepS(v, dt); draw(); return m; });
  bag.add(B.unregister);

  function aim(target) {
    v.t = target;
    const on = target >= VT;
    read.textContent = target === null ? "rest" : `${target.toFixed(1)} V · ${on ? "on" : "off"}`;
    B.wake();
  }
  bag.add(pointer(stage, {
    move: (p) => {
      const [x, y] = unproj(C, p[0], p[1], 0);
      const d = Math.hypot(clamp(x, GX0, GX1) - x, clamp(y, 6, D - 6) - y);
      v.t = VMAX * clamp(1 - d / reach, 0, 1);
      aim(Math.round(v.t * 10) / 10);
    },
    leave: () => { v.t = 0.25 * VMAX; read.textContent = "rest"; B.wake(); },
  }));
  read.textContent = "rest";
  bag.add(() => svg.replaceChildren());
  return { set: (r) => { reach = clamp(r, 10, 120); }, destroy: bag.dispose };
}

hairline({
  name: "transistor",
  means: "A transistor, cut away: bring the pointer to the gate and electrons gather under it, until the channel joins source to drain.",
  rules: [1, 3, 4, 8],
  range: [25, 50, 90],
  tour: [[110, 200], [200, 150], [215, 135], null],
  mount,
});
