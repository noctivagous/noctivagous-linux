// Tests for the sweep module (slice 9): parallel-transport frames
// (straight, planar-closed, inflecting, and a closed trefoil with
// real holonomy), the GLE affine (rotate / scale per section),
// honest radius along a tube, caps, per-vertex colours, and
// determinism. Pure node, no three.js.
//
//     node --test demo-de/ui-space/tests/sweeps.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import {
  parallelTransportFrames,
  circleContour,
  circleContourNormals,
  sweep,
  tubeAlong,
  helixPath,
} from "../src/sweeps.js";
import { torusKnotPoint, KNOT_FORMS } from "../src/knots.js";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const vecNear = (a, b, eps = 1e-9) =>
  a.length === b.length && a.every((v, i) => near(v, b[i], eps));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));

/** Central-difference tangents, cyclic — the test's own copy. */
function tangentsOf(points, closed) {
  const n = points.length;
  return points.map((_, i) => {
    if (closed) return norm(sub(points[(i + 1) % n], points[(i - 1 + n) % n]));
    if (i === 0) return norm(sub(points[1], points[0]));
    if (i === n - 1) return norm(sub(points[n - 1], points[n - 2]));
    return norm(sub(points[i + 1], points[i - 1]));
  });
}

/** Parallel transport by PROJECTION — a different mechanism from
 *  the module's smallest-rotation transport, so agreement between
 *  the two is a real cross-check, not the code grading itself. */
function projTransport(normal, t1) {
  const d = dot(normal, t1);
  return norm([normal[0] - t1[0] * d, normal[1] - t1[1] * d, normal[2] - t1[2] * d]);
}

function rotateAbout(v, k, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const kv = [
    k[1] * v[2] - k[2] * v[1],
    k[2] * v[0] - k[0] * v[2],
    k[0] * v[1] - k[1] * v[0],
  ];
  const kd = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * kd,
          v[1] * c + kv[1] * s + k[1] * kd,
          v[2] * c + kv[2] * s + k[2] * kd];
}

/** Smallest-rotation transport, written out in the test from the
 *  definition (the module's mechanism, independently re-derived —
 *  projection transport, above, drifts ~1e-4 of accumulated angle
 *  over a 256-step loop, too coarse an oracle at 1e-6 tolerances;
 *  the two are cross-checked against each other below). */
function rotTransport(normal, t0, t1) {
  const ax = [t0[1] * t1[2] - t0[2] * t1[1], t0[2] * t1[0] - t0[0] * t1[2], t0[0] * t1[1] - t0[1] * t1[0]];
  const s = Math.hypot(ax[0], ax[1], ax[2]);
  if (s < 1e-12) return normal;
  return rotateAbout(normal, [ax[0] / s, ax[1] / s, ax[2] / s], Math.atan2(s, dot(t0, t1)));
}

const signedAngle = (a, b, k) =>
  Math.atan2(dot([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], k), dot(a, b));

// ---- frames -------------------------------------------------------

test("frames on a straight path are constant and orthogonal", () => {
  const frames = parallelTransportFrames([[0, 0, 0], [0, 0, 1], [0, 0, 2], [0, 0, 3]]);
  for (const f of frames) {
    assert.ok(vecNear(f.tangent, [0, 0, 1], 1e-12), "tangent is +Z");
    assert.ok(vecNear(f.normal, frames[0].normal, 1e-12), "normal never moves");
    assert.ok(near(dot(f.normal, f.tangent), 0, 1e-12), "normal ⊥ tangent");
    assert.ok(vecNear(
      [f.normal[1] * f.binormal[2] - f.normal[2] * f.binormal[1],
       f.normal[2] * f.binormal[0] - f.normal[0] * f.binormal[2],
       f.normal[0] * f.binormal[1] - f.normal[1] * f.binormal[0]],
      f.tangent, 1e-12), "right-handed: normal × binormal = tangent");
  }
});

test("frames on a closed planar circle: no flips, seam closes", () => {
  const N = 64;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push([5 * Math.cos(a), 5 * Math.sin(a), 0]);
  }
  const frames = parallelTransportFrames(pts, { closed: true });
  const T = tangentsOf(pts, true);
  for (let i = 0; i < N - 1; i++) {
    assert.ok(dot(frames[i].normal, frames[i + 1].normal) > 0.99,
      `consecutive normals agree at ${i}`);
  }
  // First/last agreement: the last frame's normal, transported
  // across the seam, lands on the first frame's normal — a planar
  // curve has no holonomy, so this must hold to float precision.
  const across = projTransport(frames[N - 1].normal, T[0]);
  assert.ok(angleBetween(across, frames[0].normal) < 1e-6,
    `seam mismatch ${angleBetween(across, frames[0].normal)} rad`);
});

test("frames on an inflecting S-path never flip", () => {
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const x = i * 0.25;
    pts.push([x, 0, 2 * Math.sin(x * 0.55)]);
  }
  const frames = parallelTransportFrames(pts);
  for (let i = 0; i < frames.length - 1; i++) {
    const d = dot(frames[i].normal, frames[i + 1].normal);
    assert.ok(d > 0.9, `normal step ${i} has dot ${d} — a flip or a lurch`);
    assert.ok(near(dot(frames[i].normal, frames[i].tangent), 0, 1e-9), "stays ⊥");
  }
});

test("closed trefoil: holonomy is measured and distributed evenly", () => {
  const N = 256;
  const { p, q } = KNOT_FORMS.trefoil;
  const pts = [];
  for (let i = 0; i < N; i++) pts.push(torusKnotPoint(p, q, (i / N) * Math.PI * 2));
  const frames = parallelTransportFrames(pts, { closed: true });
  const T = tangentsOf(pts, true);

  // The loop's holonomy, measured the test's own way: carry ring
  // 0's normal all the way around and see how far it lands from
  // where it started. (Projection transport, a genuinely different
  // mechanism, must agree on the magnitude to ~1e-3.)
  let carried = frames[0].normal;
  for (let i = 1; i < N; i++) carried = rotTransport(carried, T[i - 1], T[i]);
  carried = rotTransport(carried, T[N - 1], T[0]);
  const H = signedAngle(carried, frames[0].normal, T[0]);
  let carriedP = frames[0].normal;
  for (let i = 1; i < N; i++) carriedP = projTransport(carriedP, T[i]);
  carriedP = projTransport(carriedP, T[0]);
  const HP = signedAngle(carriedP, frames[0].normal, T[0]);
  assert.ok(Math.abs(H) > 1e-3, `the trefoil loop really twists (H = ${H})`);
  assert.ok(near(H, HP, 1e-3), `both transports agree on the holonomy (${H} vs ${HP})`);

  // Every step of the distributed field — including across the
  // seam — carries the same share of that twist, H/N: the raw
  // holonomy, spread evenly instead of dumped at the join.
  const twists = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const moved = rotTransport(frames[i].normal, T[i], T[j]);
    twists.push(signedAngle(moved, frames[j].normal, T[j]));
  }
  for (let i = 0; i < N; i++) {
    assert.ok(near(twists[i], H / N, 1e-6),
      `step ${i} twist ${twists[i]} != shared ${H / N}`);
  }
  // Closure: one more shared step across the seam lands on ring 0.
  const seamVec = rotTransport(frames[N - 1].normal, T[N - 1], T[0]);
  const closed = rotateAbout(seamVec, T[0], H / N);
  assert.ok(angleBetween(closed, frames[0].normal) < 1e-6,
    `seam residual after distribution: ${angleBetween(closed, frames[0].normal)} rad`);
});

// ---- tubes --------------------------------------------------------

test("constant tube along +Z: ring counts and exact radius", () => {
  const path = [[0, 0, 0], [0, 0, 2], [0, 0, 4], [0, 0, 6]];
  const g = tubeAlong(path, 2, { radialSegments: 10 });
  const C = 11; // circleContour(10) repeats its first point
  assert.equal(g.positions.length, 4 * C * 3, "ring-major vertex count");
  assert.equal(g.indices.length, 3 * (C - 1) * 6, "quad index count");
  assert.equal(g.colors, null, "no colour without a colour source");
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < C; j++) {
      const v = (i * C + j) * 3;
      const off = [g.positions[v] - path[i][0], g.positions[v + 1] - path[i][1], g.positions[v + 2] - path[i][2]];
      assert.ok(near(Math.hypot(off[0], off[1], off[2]), 2, 1e-9),
        `ring ${i} vertex ${j} sits at the tube radius`);
      const n = [g.normals[v], g.normals[v + 1], g.normals[v + 2]];
      assert.ok(near(dot(n, norm(off)), 1, 1e-9), "radial normal");
    }
  }
  // u runs the path: uniform spacing → exact thirds.
  assert.ok(near(g.uvs[0], 0) && near(g.uvs[3 * C * 2], 1), "u spans 0..1");
});

test("varying radius: radiusAt as an array is honoured ring by ring", () => {
  const path = [[0, 0, 0], [0, 0, 3], [0, 0, 9]];
  const radii = [1, 2, 3];
  const g = tubeAlong(path, radii, { radialSegments: 8 });
  const C = 9;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < C; j++) {
      const v = (i * C + j) * 3;
      const d = Math.hypot(g.positions[v] - path[i][0], g.positions[v + 1] - path[i][1]);
      assert.ok(near(d, radii[i], 1e-9), `ring ${i} radius ${d} != ${radii[i]}`);
    }
  }
});

test("closed tube: seam ring duplicates ring 0 exactly", () => {
  const N = 32;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push([5 * Math.cos(a), 5 * Math.sin(a), 0]);
  }
  const g = tubeAlong(pts, 1, { radialSegments: 12, closed: true });
  const C = 13;
  assert.equal(g.positions.length, (N + 1) * C * 3, "N rings + the seam ring");
  assert.equal(g.indices.length, N * (C - 1) * 6, "bands wrap via the seam ring");
  for (let k = 0; k < C * 3; k++) {
    assert.equal(g.positions[N * C * 3 + k], g.positions[k], "seam ring == ring 0");
  }
  assert.equal(g.uvs[N * C * 2], 1, "seam ring carries u = 1");
});

// ---- the GLE affine ------------------------------------------------

test("section affine: rotation lands the square's corners on the axes", () => {
  const square = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const path = [[0, 0, 0], [0, 0, 10]];
  const g = sweep({ contour: square, path, sections: [{}, { rotate: Math.PI / 4 }] });
  const S2 = Math.SQRT2;
  const expected = [[0, S2, 10], [-S2, 0, 10], [0, -S2, 10], [S2, 0, 10]];
  for (let j = 0; j < 4; j++) {
    const v = (4 + j) * 3;
    assert.ok(vecNear([g.positions[v], g.positions[v + 1], g.positions[v + 2]], expected[j], 1e-9),
      `end vertex ${j} on an axis at √2`);
  }
  // And the un-rotated start ring keeps the square's own corners.
  for (let j = 0; j < 4; j++) {
    const v = j * 3;
    assert.ok(vecNear([g.positions[v], g.positions[v + 1], g.positions[v + 2]],
      [square[j][0], square[j][1], 0], 1e-9), `start vertex ${j}`);
  }
});

test("section affine: scale at the end ring doubles its distances", () => {
  const square = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const path = [[0, 0, 0], [0, 0, 10]];
  const g = sweep({ contour: square, path, sections: [{}, { scale: 2 }] });
  for (let j = 0; j < 4; j++) {
    const v0 = j * 3, v1 = (4 + j) * 3;
    const d0 = Math.hypot(g.positions[v0], g.positions[v0 + 1]);
    const d1 = Math.hypot(g.positions[v1], g.positions[v1 + 1]);
    assert.ok(near(d0, Math.SQRT2, 1e-9), "start corner at √2");
    assert.ok(near(d1, 2 * Math.SQRT2, 1e-9), "end corner doubled");
  }
});

// ---- caps and colours ----------------------------------------------

test("caps add exactly two fans and axial centre normals", () => {
  const path = [[0, 0, 0], [0, 0, 5], [0, 0, 10]];
  const open = tubeAlong(path, 1.5, { radialSegments: 8 });
  const capped = tubeAlong(path, 1.5, { radialSegments: 8, caps: true });
  assert.equal(capped.positions.length, open.positions.length + 2 * 3,
    "two centre vertices");
  assert.equal(capped.indices.length, open.indices.length + 2 * 8 * 3,
    "index count grows by exactly the two fans");
  const verts = capped.positions.length / 3;
  const n0 = [capped.normals[(verts - 2) * 3], capped.normals[(verts - 2) * 3 + 1], capped.normals[(verts - 2) * 3 + 2]];
  const n1 = [capped.normals[(verts - 1) * 3], capped.normals[(verts - 1) * 3 + 1], capped.normals[(verts - 1) * 3 + 2]];
  assert.ok(vecNear(n0, [0, 0, -1], 1e-9), "start cap faces −tangent");
  assert.ok(vecNear(n1, [0, 0, 1], 1e-9), "end cap faces +tangent");
});

test("colours: colorAt endpoints are exact, the middle interpolates", () => {
  const path = [[0, 0, 0], [0, 0, 1], [0, 0, 2], [0, 0, 3]];
  const g = tubeAlong(path, 1, { radialSegments: 6, colorAt: (t) => [t, 0, 1 - t] });
  assert.ok(g.colors, "colours present");
  const C = 7;
  for (let j = 0; j < C; j++) {
    const c0 = j * 3, c3 = (3 * C + j) * 3, c1 = (C + j) * 3;
    assert.ok(vecNear([g.colors[c0], g.colors[c0 + 1], g.colors[c0 + 2]], [0, 0, 1], 0),
      "t=0 colour exact");
    assert.ok(vecNear([g.colors[c3], g.colors[c3 + 1], g.colors[c3 + 2]], [1, 0, 0], 0),
      "t=1 colour exact");
    assert.ok(vecNear([g.colors[c1], g.colors[c1 + 1], g.colors[c1 + 2]], [1 / 3, 0, 2 / 3], 1e-9),
      "t=1/3 colour");
  }
});

// ---- determinism & utilities ----------------------------------------

test("a data-bearing sweep is deterministic, byte for byte", () => {
  const { p, q } = KNOT_FORMS.trefoil;
  const build = () => {
    const pts = [];
    for (let i = 0; i < 128; i++) pts.push(torusKnotPoint(p, q, (i / 128) * Math.PI * 2));
    return tubeAlong(pts, (t) => 1 + 0.5 * Math.sin(t * Math.PI * 6), {
      radialSegments: 10, closed: true,
      colorAt: (t) => [t, 0.25, 1 - t],
    });
  };
  const a = build(), b = build();
  assert.deepEqual(a.positions, b.positions);
  assert.deepEqual(a.normals, b.normals);
  assert.deepEqual(a.colors, b.colors);
  assert.deepEqual(a.indices, b.indices);
});

test("circleContour closes its ring; helixPath spans its height", () => {
  const c = circleContour(8, 2);
  assert.equal(c.length, 9);
  assert.ok(vecNear(c[0], c[8], 1e-12), "first point repeated at the end (to float dust)");
  assert.ok(near(Math.hypot(c[2][0], c[2][1]), 2, 1e-12), "points on the circle");
  const cn = circleContourNormals(8);
  assert.ok(vecNear(cn[0], [1, 0], 0), "radial normals");
  const h = helixPath({ turns: 2, height: 10, radius: 3, samples: 41 });
  assert.equal(h.length, 41);
  assert.ok(near(h[0][1], -5) && near(h[40][1], 5), "height centred and spanned");
  assert.ok(near(Math.hypot(h[10][0], h[10][2]), 3, 1e-9), "points on the cylinder");
});
