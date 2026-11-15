import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  OBJECT_IDS,
  LAYOUTS,
  PLATTER_R,
  GROUND_CLAMP_R,
  PROTECTIVE_CLEARANCE,
  CENTRE_Y,
  PROTECTIVE_R,
  sphereCutRadius,
  socketRadius,
  socketCircles,
} from "../src/space-state.js";
import { buildPlatterSolid, PLATTER_SLAB } from "../src/platter-top.js";

/* The citizens' sockets (the user's protective-sphere rule at
   citizen scale): every citizen tumbles about its bounds-centre
   pivot, its turning sweeps a sphere, and the platter's top
   yields — a circular through-hole at the citizen's plot, the
   sphere's cross-section at the platter plane, clearance grown
   into the sphere first (the ground well's convention). These
   tests hold the table to the measured analysis, prove the
   clearance by sampled rotation (the analysis' method), pin
   the per-layout overlap configuration the CSG technique was
   chosen for, and verify the CSG solid itself: holes where the
   sockets are, surface everywhere else. */

test("the socket table covers every citizen", () => {
  for (const id of OBJECT_IDS) {
    assert.ok(CENTRE_Y[id] > 0, `${id} has a pivot height`);
    assert.ok(PROTECTIVE_R[id] > 0, `${id} has a protective radius`);
    const r = socketRadius(id);
    assert.ok(Number.isFinite(r) && r > 0, `${id} has a socket radius`);
  }
  assert.equal(socketRadius("no-such-citizen"), null);
});

test("socketRadius is the sphere-plus-clearance cross-section at the standing plane", () => {
  for (const id of OBJECT_IDS) {
    assert.equal(
      socketRadius(id),
      sphereCutRadius(PROTECTIVE_R[id] + PROTECTIVE_CLEARANCE, CENTRE_Y[id], 0),
      id,
    );
    // The raw sphere's own cross-section fits inside the cut,
    // with the clearance visible as margin.
    const raw = Math.sqrt(PROTECTIVE_R[id] ** 2 - CENTRE_Y[id] ** 2);
    assert.ok(socketRadius(id) - raw > 1.9, `${id}: clearance margin ${(socketRadius(id) - raw).toFixed(2)}`);
  }
});

/* The pinned radii, from the analysis' measured R values. */
const PINNED = {
  mesa: 27.21, drum: 29.66, tray: 41.01, cube: 25.64, tangle: 36.82,
  horizon3d: 35.06, horizonflat: 28.83, arch: 30.73, definition: 32.10,
  knot: 18.15, crystal: 16.76, tree: 23.88, book: 43.65, devices: 25.10,
};

test("the socket radii match the measured analysis", () => {
  for (const [id, want] of Object.entries(PINNED)) {
    assert.ok(Math.abs(socketRadius(id) - want) < 0.02,
      `${id}: got ${socketRadius(id).toFixed(3)}, want ~${want}`);
  }
});

test("the book is sized for its page-out state, not its standing form", () => {
  assert.equal(PROTECTIVE_R.book, 43.54);
  const standing = sphereCutRadius(28.30 + PROTECTIVE_CLEARANCE, CENTRE_Y.book, 0);
  assert.ok(socketRadius("book") > standing + 10,
    `page-out socket ${socketRadius("book").toFixed(2)} vs standing ${standing.toFixed(2)}`);
});

test("the crystal's radius is its pedestal's — state-independent by construction", () => {
  // The pedestal rim (r 14 at y 0) about the pivot: the living
  // solid reaches at most 16.8 in any drift state, so the
  // pedestal figure governs every state the citizen can be in.
  assert.ok(Math.abs(PROTECTIVE_R.crystal - Math.hypot(14, CENTRE_Y.crystal)) < 0.01);
  assert.ok(PROTECTIVE_R.crystal > 16.8);
});

test("devices: the envelope measured on MiniDevices (it postdates the analysis)", () => {
  // The shelf is a 38 × 26 box standing 0..1.6; its bottom
  // corners (±19, 0, ±13) about the pivot (0, 7, 0) bind, like
  // the tray's, tangle's and definition's base plates. Every
  // other part of the shelf's furniture reaches less:
  const parts = [
    ["shelf bottom corner", Math.hypot(19, 7, 13)],
    ["shelf top corner", Math.hypot(19, 7 - 1.6, 13)],
    ["storage slab corner", Math.hypot(16.75, 7 - 1.6, 12.25)],
    ["hub corner", Math.hypot(18, 7 - 1.6, 5.25)],
    ["display screen corner", Math.hypot(14, 9.8 + 4.46 - 7, 8.63)],
    ["printer tray corner", Math.hypot(15.25, 7 - 2.7, 6.34)],
  ];
  for (const [name, d] of parts) {
    assert.ok(d <= PROTECTIVE_R.devices + 0.01, `${name} reaches ${d.toFixed(2)}`);
  }
  assert.ok(Math.abs(PROTECTIVE_R.devices - Math.hypot(19, 7, 13)) < 0.01,
    "the shelf's bottom corners set the radius");
});

/* Each citizen's binding point, in standing coords (the
   analysis names what sets R); the pivot is (0, CENTRE_Y, 0). */
const BINDING = {
  tray: [[29.5, 0, 25.5]],
  horizon3d: [[33, 0, 0]],
  tangle: [[26, 0, 23]],
  definition: [[26, 0, 15]],
  mesa: [[25.15, 0, 0]],
  drum: [[27.5, 0, 0]],
  arch: [[22, 0, 18]],
  horizonflat: [[25, 0, 9]],
  book: [[42.2, 2.3, 0]], // the page-out leaf's outer edge
  cube: [[16.25, -0.25, 16.25]], // a shell corner — the shell already sits 0.25 into the plane at rest
  tree: [[21.5, 0, 0]],
  knot: [[-10.3, 12.3, -17.2]], // the measured sweep vertex, pivot-centred (−10.3, −0.2, −17.2)
  crystal: [[14, 0, 0]],
  devices: [[19, 0, 13]],
};

test("the table's radii are the binding points' reaches (tight, not padded)", () => {
  for (const [id, points] of Object.entries(BINDING)) {
    for (const [x, y, z] of points) {
      const d = Math.hypot(x, y - CENTRE_Y[id], z);
      assert.ok(Math.abs(d - PROTECTIVE_R[id]) <= 0.1,
        `${id}: binding point reaches ${d.toFixed(2)}, table says ${PROTECTIVE_R[id]}`);
    }
  }
  // The book's standing binding point, against the standing
  // measure the table deliberately does NOT use:
  const standing = Math.hypot(26.2, 2.3 - CENTRE_Y.book, 0);
  assert.ok(Math.abs(standing - 28.30) <= 0.1, `standing book reaches ${standing.toFixed(2)}`);
});

const rotAboutPivot = ([x, y, z], cy, [ax, ay, az], t) => {
  // Rodrigues, about the pivot (0, cy, 0).
  const px = x, py = y - cy, pz = z;
  const c = Math.cos(t), s = Math.sin(t);
  const dot = ax * px + ay * py + az * pz;
  return [
    px * c + (ay * pz - az * py) * s + ax * dot * (1 - c),
    py * c + (az * px - ax * pz) * s + ay * dot * (1 - c) + cy,
    pz * c + (ax * py - ay * px) * s + az * dot * (1 - c),
  ];
};

test("clearance proof: sampled rotations never cross the plane outside the socket", () => {
  const axes = [[1, 0, 0], [0, 0, 1], [0.577, 0.577, 0.577]];
  for (const [id, points] of Object.entries(BINDING)) {
    const r = socketRadius(id);
    for (const p of points) {
      for (const a of axes) {
        for (let t = 0; t < Math.PI * 2; t += 0.37) {
          const [x, y, z] = rotAboutPivot(p, CENTRE_Y[id], a, t);
          if (y <= 0) {
            const plan = Math.hypot(x, z);
            assert.ok(plan < r - 1.5,
              `${id}: rotated binding point crosses y=0 at plan ${plan.toFixed(2)}, socket is ${r.toFixed(2)}`);
          }
        }
      }
    }
  }
});

test("socketCircles follows the positions map — layout plots and drag drops alike", () => {
  const positions = {};
  for (const id of OBJECT_IDS) {
    const [x, z] = LAYOUTS.districts.positions[id];
    positions[id] = { x, z };
  }
  const circles = socketCircles(positions);
  assert.equal(circles.length, OBJECT_IDS.length);
  const tray = circles.find((c) => c.id === "tray");
  assert.deepEqual([tray.x, tray.z], LAYOUTS.districts.positions.tray);
  // A drag drop rewrites one entry of the map; the circle follows.
  positions.tray = { x: 40, z: -60 };
  const moved = socketCircles(positions).find((c) => c.id === "tray");
  assert.deepEqual([moved.x, moved.z, moved.r], [40, -60, tray.r]);
});

/* The measured configuration, per layout (from LAYOUTS and the
   table): sockets overlap each other everywhere — the fact
   that rules out a flat Shape-with-holes and puts CSG in —
   they reach under the centre dais's footprint (the dais is a
   separate solid standing on the top, so its base covers what
   it stands over), and no layout socket crosses the rim. Only
   a free drag to the clamp can push one past it. */
function layoutPositions(name) {
  const positions = {};
  for (const id of OBJECT_IDS) {
    const [x, z] = LAYOUTS[name].positions[id];
    positions[id] = { x, z };
  }
  return positions;
}

/* Re-measured at the slice-15 integration (fifteen citizens):
   the ring respaced for the mail citizen (one more overlapping
   pair among the old citizens), and mail's socket reaches
   under the dais in districts. Theatre's counts are unchanged. */
const MEASURED = {
  ring: { overlaps: 10, dais: 9, maxReach: ["book", 173.6] },
  districts: { overlaps: 7, dais: 14, maxReach: ["book", 178.0] },
  theatre: { overlaps: 6, dais: 13, maxReach: ["horizon3d", 173.3] },
};

for (const [name, want] of Object.entries(MEASURED)) {
  test(`layout ${name}: the overlap configuration, measured`, () => {
    const cs = socketCircles(layoutPositions(name));
    let overlaps = 0;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        if (Math.hypot(cs[i].x - cs[j].x, cs[i].z - cs[j].z) < cs[i].r + cs[j].r) overlaps++;
      }
    }
    assert.equal(overlaps, want.overlaps, "pairwise socket overlaps");
    const dais = cs.filter((c) => Math.hypot(c.x, c.z) - c.r < 104).length;
    assert.equal(dais, want.dais, "sockets reaching under the dais footprint (r 104)");
    const reach = cs
      .map((c) => ({ id: c.id, reach: Math.hypot(c.x, c.z) + c.r }))
      .sort((a, b) => b.reach - a.reach)[0];
    assert.equal(reach.id, want.maxReach[0]);
    assert.ok(Math.abs(reach.reach - want.maxReach[1]) < 0.15, `max reach ${reach.reach.toFixed(1)}`);
    assert.ok(reach.reach < PLATTER_R, "no layout socket crosses the rim");
  });
}

test("a socket dragged to the clamp crosses the rim — the CSG must tolerate it", () => {
  assert.ok(GROUND_CLAMP_R + socketRadius("book") > PLATTER_R);
  const positions = layoutPositions("ring");
  positions.book = { x: GROUND_CLAMP_R, z: 0 };
  const geo = buildPlatterSolid(socketCircles(positions));
  assert.ok(geo.attributes.position.count > 0);
  const mesh = new THREE.Mesh(geo);
  const ray = (x, z) => new THREE.Raycaster(
    new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0),
  ).intersectObject(mesh);
  assert.equal(ray(GROUND_CLAMP_R + 10, 0).length, 0, "the book's hole is cut at its dragged home");
  geo.dispose();
});

/* The CSG solid itself, per layout: a vertical ray inside any
   socket finds no slab; a ray on open surface finds the top
   face at PLATTER_SLAB.topY. */
const rayDown = (mesh, x, z) => new THREE.Raycaster(
  new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0),
).intersectObject(mesh);

for (const name of Object.keys(LAYOUTS)) {
  test(`CSG (${name}): holes where the sockets are, surface elsewhere`, () => {
    const circles = socketCircles(layoutPositions(name));
    const geo = buildPlatterSolid(circles);
    assert.ok(geo.attributes.position.count > 0, "the evaluation produced geometry");
    const mesh = new THREE.Mesh(geo);
    for (const c of circles) {
      for (const [fx, fz] of [[0.5, 0], [-0.3, 0.4], [0.1, -0.55]]) {
        const hits = rayDown(mesh, c.x + c.r * fx, c.z + c.r * fz);
        assert.equal(hits.length, 0,
          `${name}/${c.id}: ray inside the socket hit the slab`);
      }
    }
    // Open surface: the four compass points near the rim are
    // outside every socket in every layout (max reach 178).
    for (const [x, z] of [[190, 0], [-190, 0], [0, 190], [0, -190]]) {
      for (const c of circles) {
        assert.ok(Math.hypot(x - c.x, z - c.z) > c.r + 1, "compass point precondition");
      }
      const hits = rayDown(mesh, x, z);
      assert.ok(hits.length > 0, `${name}: ray at (${x}, ${z}) found no surface`);
      assert.ok(Math.abs(hits[0].point.y - PLATTER_SLAB.topY) < 0.01,
        `${name}: top face at y=${hits[0].point.y}`);
    }
    geo.dispose();
  });
}

test("the slab stays a closed solid: side and bottom answer rays too", () => {
  const geo = buildPlatterSolid(socketCircles(layoutPositions("ring")));
  const mesh = new THREE.Mesh(geo);
  const side = new THREE.Raycaster(
    new THREE.Vector3(300, PLATTER_SLAB.centreY, 0), new THREE.Vector3(-1, 0, 0),
  ).intersectObject(mesh);
  assert.ok(side.length > 0, "the side wall is present and outward-facing");
  assert.ok(Math.abs(side[0].point.x - 201.5) < 1.5,
    `the side at mid-height is the frustum's ~201.5, got ${side[0].point.x.toFixed(2)}`);
  // The probe point must be open slab: in the fifteen-citizen
  // ring layout the tangle's socket covers (150, 0), so the ray
  // samples (190, 0) — outside every socket in every layout,
  // the compass precondition above.
  const bottom = new THREE.Raycaster(
    new THREE.Vector3(190, -10, 0), new THREE.Vector3(0, 1, 0),
  ).intersectObject(mesh);
  assert.ok(bottom.length > 0, "the bottom face is present and downward-facing");
  assert.ok(Math.abs(bottom[0].point.y - (PLATTER_SLAB.topY - PLATTER_SLAB.height)) < 0.01,
    `the bottom at y=${bottom[0].point.y}`);
  geo.dispose();
});
