/**
 * Wafer: a silicon wafer on a chuck, ruled into dies. Each die is a thin
 * plate; under the pointer the dies rise out of the wafer, the nearest
 * most, the farther less, each on its own spring. At rest a few dies near
 * one edge stand up, as if being picked out, the highest lit. The slider is
 * the radius, in dies.
 *
 * The pattern: a continuous field, as in Terrain. Springs, a falloff by
 * distance that reaches a floor, and a hit test on the wafer's top plane,
 * which never moves.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rrect, rings, unproj, spring, stepS,
  mk, pointer, put, register, disposer, solid,
} = HL;

const R = 62, CELL = 10, DIE = 8.4, T = 3, CHUCK = 8, HMAX = 22;

/** Share of full height at u radii from the pointer: 1 → .3 at 45% → .06 beyond. */
const falloff = (u) => (u <= 0.45 ? 1 - (u / 0.45) * 0.7 : u <= 1 ? 0.3 - ((u - 0.45) / 0.55) * 0.24 : 0.06);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.2);
  fit(C, [[-R, -R, -CHUCK], [R, R, -CHUCK], [R, -R, -CHUCK], [-R, R, -CHUCK], [-R, -R, T + HMAX]], 200, 170);
  const P = proj(C), front = facing(C);
  let rad = value * CELL, over = null;
  const g = mk("g", {}, svg);

  // the chuck under it, then the wafer: big rounds, so 14 steps a corner
  const disk = (r, b) => [rrect(-r, -r, r, r, r, 14), rrect(-r + b, -r + b, r - b, r - b, r - b, 14)];
  const [cr, ci] = disk(R - 10, 1.6);
  put(solid(g), prism(P, front, cr, ci, -CHUCK, 0));
  const [wr, wi] = disk(R, 1.2);
  put(solid(g), prism(P, front, wr, wi, 0, T));

  // the dies: every whole square inside the wafer, painted far to near
  const dies = [], N = Math.floor((2 * R) / CELL);
  for (let s = 0; s <= 2 * N; s++) for (let i = 0; i <= N; i++) {
    const j = s - i;
    if (j < 0 || j > N) continue;
    const x0 = -R + i * CELL + (CELL - DIE) / 2, y0 = -R + j * CELL + (CELL - DIE) / 2;
    if (Math.hypot(Math.max(Math.abs(x0), Math.abs(x0 + DIE)), Math.max(Math.abs(y0), Math.abs(y0 + DIE))) > R - 3) continue;
    const cx = x0 + DIE / 2, cy = y0 + DIE / 2;
    const h0 = 0.6 + 14 * Math.exp(-((cx - 26) ** 2 + (cy + 18) ** 2) / 120);
    const [ring, inner] = rings(x0, y0, x0 + DIE, y0 + DIE, 1, 0.5);
    dies.push({ i, j, cx, cy, h0, ring, inner, sp: spring(h0, { eps: 0.03 }), el: solid(g), drawn: NaN });
  }

  function draw(d) {
    const h = Math.max(0.6, d.sp.x);
    if (h === d.drawn) return;
    d.drawn = h;
    put(d.el, prism(P, front, d.ring, d.inner, T, T + h));
    d.el.sil.classList.toggle("hi", h > HMAX * 0.55);
  }

  const B = register(stage, (dt) => {
    let m = false;
    for (const d of dies) { if (stepS(d.sp, dt)) m = true; draw(d); }
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    let near = null, best = Infinity;
    for (const d of dies) {
      if (!over) { d.sp.t = d.h0; continue; }
      const dist = Math.hypot(d.cx - over[0], d.cy - over[1]);
      d.sp.t = HMAX * falloff(dist / rad);
      if (dist < best) { best = dist; near = d; }
    }
    read.textContent = over && near && best < CELL ? `die ${near.i}·${near.j}` : "rest";
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => {
      const q = unproj(C, p[0], p[1], T);
      over = Math.hypot(q[0], q[1]) <= R + 4 ? q : null;
      retarget();
    },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { rad = clamp(v, 1, 6) * CELL; if (over) retarget(); }, destroy: bag.dispose };
}

hairline({
  name: "wafer",
  means: "A silicon wafer ruled into dies: under the pointer the dies rise out of it, the nearest most.",
  rules: [1, 3, 5, 9],
  range: [1.5, 2.5, 4],
  tour: [[150, 150], [250, 150], [200, 205], null],
  mount,
});
