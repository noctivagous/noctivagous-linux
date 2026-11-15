import test from "node:test";
import assert from "node:assert/strict";

import {
  sphereCutRadius,
  PLATTER_PROTECTIVE_R,
  PROTECTIVE_CLEARANCE,
  GROUND_Y,
  PLATTER_WELL_R,
} from "../src/space-state.js";

/* The platter's protective sphere (the user's rule): the
   rotating assembly is enclosed by the swept envelope of its
   rotation about its pivot, and the base yields — a circle is
   subtracted from the ground underneath it. These tests hold
   the cut math, the sphere's radius (enumerated from the
   scene's own numbers), and the clearance proof: after the
   cut, no remaining base point lies within the sphere's reach,
   so at ANY yaw/pitch/roll the assembly cannot intersect it.
   Rotation preserves distances from the pivot, so the two
   distance facts — assembly ≤ R, remaining base ≥ R +
   clearance — are the whole proof; the sampling below just
   walks them densely. */

test("sphereCutRadius: a plane through the pivot is cut at the full radius", () => {
  assert.equal(sphereCutRadius(315, 0, 0), 315);
  assert.equal(sphereCutRadius(100, 40, 40), 100);
});

test("sphereCutRadius: off-pivot planes follow sqrt(R² − d²), either side", () => {
  assert.equal(sphereCutRadius(100, 0, 60), 80);
  assert.equal(sphereCutRadius(100, 0, -60), 80);
  assert.equal(sphereCutRadius(100, 10, 70), 80);
  assert.ok(Math.abs(sphereCutRadius(317, 0, -3.6) - 316.98) < 0.01);
});

test("sphereCutRadius: a plane at or beyond the sphere cuts nothing", () => {
  assert.equal(sphereCutRadius(100, 0, 100), null);
  assert.equal(sphereCutRadius(100, 0, 150), null);
  assert.equal(sphereCutRadius(100, 0, -150), null);
  assert.equal(sphereCutRadius(0, 0, 0), null);
  assert.equal(sphereCutRadius(-5, 0, 0), null);
});

/* The assembly's extremes, recomputed from the scene's numbers
   (SpaceView.jsx: WALL {w 368, h 164, z −196}, YZ {x 196, w 368,
   h 164}, the ring's outer edge 235, the drum 205 at y −3.05,
   the layouts and the drag clamp in space-state.js). The wall
   corners are the max; the constant must cover every entry and
   sit within a rounding step of the max it was derived from. */
const EXTREMES = [
  ["XY back wall top corner", Math.hypot(184, 164, 196)],
  ["YZ side wall top corner", Math.hypot(196, 164, 184)],
  ["ring outer edge + app tokens", Math.hypot(235, 14)],
  ["citizen at the drag clamp + its miniature", 184 + 35],
  ["platter drum bottom rim", Math.hypot(205, 3.05)],
  ["botanical tree (centre + grown extent)", Math.hypot(150, 88) + 21],
  ["crystal cluster (centre + extent)", Math.hypot(168, 30) + 22],
  ["waveform stage, full dais + fence", Math.hypot(184, 40)],
  ["atmosphere knots (centre + knot)", Math.hypot(Math.hypot(133.5, 97), 14.5) + 11.2],
  ["inspected citizen (held centre + scaled extent)", 36 + 52],
];

test("the protective radius covers the assembly's enumerated extremes", () => {
  for (const [name, d] of EXTREMES) {
    assert.ok(d <= PLATTER_PROTECTIVE_R, `${name} reaches ${d.toFixed(1)} > ${PLATTER_PROTECTIVE_R}`);
  }
  const max = Math.max(...EXTREMES.map(([, d]) => d));
  assert.ok(PLATTER_PROTECTIVE_R - max < 0.1,
    `the radius ${PLATTER_PROTECTIVE_R} should sit within 0.1 of the true max ${max.toFixed(2)} (the wall corners)`);
});

test("the well is the sphere-plus-clearance cross-section at the ground plane", () => {
  assert.equal(PLATTER_WELL_R, sphereCutRadius(PLATTER_PROTECTIVE_R + PROTECTIVE_CLEARANCE, 0, GROUND_Y));
  assert.ok(Math.abs(PLATTER_WELL_R - 316.98) < 0.01);
  assert.ok(PLATTER_WELL_R > PLATTER_PROTECTIVE_R);
  assert.ok(PLATTER_WELL_R < 900, "the cut leaves a floor annulus, not nothing");
});

test("clearance: every remaining floor point is beyond the sphere's reach", () => {
  const reach = PLATTER_PROTECTIVE_R + PROTECTIVE_CLEARANCE;
  // The nearest remaining point is the annulus's inner edge.
  assert.ok(Math.abs(Math.hypot(PLATTER_WELL_R, Math.abs(GROUND_Y)) - reach) < 1e-6);
  // Sampled densely over the whole remaining annulus.
  for (let r = PLATTER_WELL_R; r <= 900; r += 7.3) {
    for (let a = 0; a < Math.PI * 2; a += 0.31) {
      const d = Math.hypot(r * Math.cos(a), GROUND_Y, r * Math.sin(a));
      assert.ok(d >= reach - 1e-9, `floor point at r=${r.toFixed(1)} is ${d.toFixed(2)} < ${reach}`);
    }
  }
  // The lip ring on the cut's edge (a further clearance out, a
  // hair above the plane) is outside the sphere too.
  for (let r = PLATTER_WELL_R + PROTECTIVE_CLEARANCE; r <= PLATTER_WELL_R + 16; r += 1.7) {
    const d = Math.hypot(r, Math.abs(GROUND_Y + 0.05));
    assert.ok(d > reach, `lip point at r=${r.toFixed(1)} is ${d.toFixed(2)} <= ${reach}`);
  }
});

test("clearance: the assembly's extremes stay within the sphere at any orientation", () => {
  // Rodrigues rotation of the extreme points about sampled axes
  // and angles: distances are preserved, so every rotated
  // extreme remains ≤ R while the base remains ≥ R + clearance.
  const rot = ([x, y, z], [ax, ay, az], t) => {
    const c = Math.cos(t), s = Math.sin(t);
    const dot = ax * x + ay * y + az * z;
    return [
      x * c + (ay * z - az * y) * s + ax * dot * (1 - c),
      y * c + (az * x - ax * z) * s + ay * dot * (1 - c),
      z * c + (ax * y - ay * x) * s + az * dot * (1 - c),
    ];
  };
  const points = [
    [184, 164, -196], [-184, 164, -196], [196, 164, 184], [196, 164, -184],
    [235, 0, 0], [0, 0, 235], [205, -3.05, 0], [0, -3.05, -205],
  ];
  const axes = [[1, 0, 0], [0, 0, 1], [0.577, 0.577, 0.577]];
  for (const p of points) {
    for (const a of axes) {
      for (let t = 0; t < Math.PI * 2; t += 0.37) {
        const [x, y, z] = rot(p, a, t);
        assert.ok(Math.hypot(x, y, z) <= PLATTER_PROTECTIVE_R + 1e-6,
          `rotated extreme escapes the sphere: ${Math.hypot(x, y, z).toFixed(2)}`);
      }
    }
  }
});
