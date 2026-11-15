import test from "node:test";
import assert from "node:assert/strict";

import { FLARE } from "../../src/sunburst-data.js";
import { TANGLE_LEVELS } from "../../src/tangle-data.js";
import {
  SUBNODE_OBJECT_IDS,
  isSubnodeObject,
  subnodeRootOf,
  subnodeById,
  subnodesFor,
  subnodeParentOf,
  flareDataOf,
} from "../src/subnodes.js";
import {
  EVENTS,
  createDescent,
  descend,
  climbDescent,
  displayRootOf,
  descentDepth,
  createSpaceState,
  applyTransformKey,
} from "../src/space-state.js";

/* Independent walks over the raw data — the expectations are
 * computed here, from FLARE / TANGLE_LEVELS directly, never from
 * the provider's own tables. */

function rawFlareStats() {
  let nodes = 0;
  let total = 0;
  const byPath = new Map();
  const walk = (d, path) => {
    nodes++;
    const p = [...path, d.name];
    let v = d.value || 0;
    for (const c of d.children || []) v += walk(c, p);
    byPath.set(p.join("/"), { value: v, depth: p.length - 1, leaf: !(d.children && d.children.length) });
    return v;
  };
  total = walk(FLARE, []);
  return { nodes, total, byPath };
}
const RAW = rawFlareStats();

function rawProgeny(id) {
  const children = new Map();
  for (const level of TANGLE_LEVELS) {
    for (const n of level) {
      for (const p of n.parents || []) {
        if (!children.has(p)) children.set(p, []);
        children.get(p).push(n.id);
      }
    }
  }
  const seen = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const c of children.get(cur) || []) stack.push(c);
  }
  return seen.size;
}
const TANGLE_COUNT = TANGLE_LEVELS.reduce((n, l) => n + l.length, 0);

/* ---------------- the flare citizens (tray, mesa, drum) ---------------- */

test("the sub-node citizens are tray, tangle, mesa, drum", () => {
  assert.deepEqual(SUBNODE_OBJECT_IDS, ["tray", "tangle", "mesa", "drum"]);
  assert.ok(isSubnodeObject("mesa"));
  assert.ok(!isSubnodeObject("knot")); // the knot has its own parts table
  assert.ok(!isSubnodeObject("tree")); // the tree has its own branches
});

test("the flare whole: the root's value is the raw leaf sum, over 252 unique path ids", () => {
  assert.equal(RAW.nodes, 252);
  for (const id of ["tray", "mesa", "drum"]) {
    const root = subnodeRootOf(id);
    assert.equal(root.id, "flare");
    assert.equal(root.value, RAW.total);
  }
});

test("tray provider: exactly flare's depth-1 plates and depth-2 cuboids, ids unique", () => {
  const nodes = subnodesFor("tray");
  const expected = [...RAW.byPath.entries()].filter(([, s]) => s.depth >= 1 && s.depth <= 2);
  assert.equal(nodes.length, expected.length);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length, "ids unique");
  for (const n of nodes) {
    const raw = RAW.byPath.get(n.id);
    assert.ok(raw, `${n.id} exists in the raw walk`);
    assert.equal(n.value, raw.value, `${n.id} value`);
    assert.equal(n.depth, raw.depth, `${n.id} depth`);
    assert.equal(n.isLeaf, raw.leaf, `${n.id} isLeaf`);
    assert.ok(Math.abs(n.share - raw.value / RAW.total) < 1e-12, `${n.id} share`);
    assert.equal(n.path.join("/"), n.id, "the id IS the name path");
  }
});

test("a known flare node: flare/analytics/cluster, its value, share and path", () => {
  const raw = RAW.byPath.get("flare/analytics/cluster");
  const n = subnodeById("tray", "flare/analytics/cluster");
  assert.equal(n.name, "cluster");
  assert.equal(n.value, raw.value);
  assert.equal(n.depth, 2);
  assert.equal(n.isLeaf, false);
  assert.deepEqual(n.path, ["flare", "analytics", "cluster"]);
  assert.equal(n.parentId, "flare/analytics");
  assert.ok(Math.abs(n.share - raw.value / RAW.total) < 1e-12);
  // A depth-3 leaf under it: a true leaf, whose parent is the cluster.
  const leaf = subnodeById("mesa", "flare/analytics/cluster/AgglomerativeCluster");
  assert.equal(leaf.value, 3938);
  assert.equal(leaf.isLeaf, true);
  assert.equal(leaf.depth, 3);
  assert.equal(subnodeParentOf("mesa", leaf.id), "flare/analytics/cluster");
  assert.equal(subnodeParentOf("mesa", "flare/analytics"), "flare");
  assert.equal(subnodeParentOf("mesa", "flare"), null);
});

test("mesa and drum at rest render the same wedge set as the tray's plates + cuboids", () => {
  const trayIds = subnodesFor("tray").map((n) => n.id).sort();
  for (const id of ["mesa", "drum"]) {
    assert.deepEqual(subnodesFor(id).map((n) => n.id).sort(), trayIds);
    for (const n of subnodesFor(id)) assert.equal(n.relDepth, n.depth);
  }
});

test("under descent, the sunburst provider re-roots: relative depths, shares of the display root", () => {
  const vis = subnodeById("mesa", "flare/vis");
  const under = subnodesFor("mesa", "flare/vis");
  assert.ok(under.length > 0);
  for (const n of under) {
    assert.ok(n.id.startsWith("flare/vis/"), `${n.id} is under vis`);
    assert.ok(n.relDepth >= 1 && n.relDepth <= 2, `${n.id} relDepth`);
    assert.equal(n.relDepth, n.depth - vis.depth);
    assert.ok(Math.abs(n.share - n.value / vis.value) < 1e-12, `${n.id} share of vis`);
  }
  // Relative depth 1 is exactly vis's own children (branches and
  // any direct leaves alike); their children appear at depth 2.
  const visRaw = FLARE.children.find((c) => c.name === "vis");
  const groups = under.filter((n) => n.relDepth === 1);
  assert.equal(groups.length, visRaw.children.length, "rel-1 set is vis's children");
  assert.ok(groups.every((g) => g.parentId === "flare/vis"), "rel-1 parents are vis");
  assert.ok(under.some((n) => n.relDepth === 2 && n.isLeaf), "leaves show at rel depth 2");
  // subnodeById against the descended root resolves the same shares.
  const g = subnodeById("drum", groups[0].id, "flare/vis");
  assert.ok(Math.abs(g.share - groups[0].share) < 1e-12);
  assert.equal(subnodeRootOf("mesa", "flare/vis").value, vis.value);
  // The raw subtree the view rebuilds from is the data under the id.
  assert.equal(flareDataOf("flare/vis").name, "vis");
  assert.equal(flareDataOf("flare/nope"), null);
});

/* ---------------- the tangled tree ---------------- */

test("tangle provider: every figure, progeny as value, share of the genealogy", () => {
  const nodes = subnodesFor("tangle");
  assert.equal(nodes.length, TANGLE_COUNT);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length, "ids unique");
  assert.equal(subnodeRootOf("tangle").value, TANGLE_COUNT);
  for (const id of ["Chaos", "Gaea", "Zeus"]) {
    const n = subnodeById("tangle", id);
    assert.ok(n, `${id} exists`);
    assert.equal(n.value, rawProgeny(id), `${id} progeny`);
    assert.ok(Math.abs(n.share - rawProgeny(id) / TANGLE_COUNT) < 1e-12, `${id} share`);
    assert.equal(n.path[n.path.length - 1], id, "path ends at the figure");
  }
  const chaos = subnodeById("tangle", "Chaos");
  assert.equal(chaos.depth, 0);
  assert.deepEqual(chaos.path, ["Chaos"]);
  assert.equal(chaos.parentId, null);
  // A leaf figure: progeny of one (itself), and a leaf.
  const leaf = nodes.find((n) => n.isLeaf);
  assert.equal(leaf.value, 1);
});

/* ---------------- descent transitions (space-state) ---------------- */

test("descend sets the display root; displayRootOf answers per citizen", () => {
  let d = createDescent();
  assert.equal(displayRootOf(d, "mesa"), null);
  d = descend(d, "mesa", "flare/vis");
  assert.equal(displayRootOf(d, "mesa"), "flare/vis");
  assert.equal(displayRootOf(d, "drum"), null, "the drum is undisturbed");
  assert.equal(descentDepth(d), 1);
  const d2 = descend(d, "mesa", "flare/vis/operator");
  assert.equal(displayRootOf(d2, "mesa"), "flare/vis/operator");
  assert.equal(descentDepth(d2), 2);
  // Descending onto the standing root again is a no-op; junk is refused.
  assert.equal(descend(d2, "mesa", "flare/vis/operator"), d2);
  assert.equal(descend(d2, "mesa", null), d2);
  assert.equal(descend(d2, null, "flare/vis"), d2);
});

test("climb restores the parent root; at the true root it is a no-op", () => {
  let d = descend(createDescent(), "drum", "flare/analytics");
  d = descend(d, "drum", "flare/analytics/cluster");
  d = climbDescent(d);
  assert.equal(displayRootOf(d, "drum"), "flare/analytics");
  d = climbDescent(d);
  assert.equal(displayRootOf(d, "drum"), null, "back at the true root");
  assert.deepEqual(d, createDescent());
  assert.deepEqual(climbDescent(d), createDescent(), "climbing at the true root changes nothing");
  assert.deepEqual(climbDescent(createDescent()), createDescent());
});

test("the two sunbursts' descents are independent values", () => {
  const mesa = descend(createDescent(), "mesa", "flare/vis");
  const drum = descend(createDescent(), "drum", "flare/data");
  assert.equal(displayRootOf(mesa, "mesa"), "flare/vis");
  assert.equal(displayRootOf(drum, "drum"), "flare/data");
  assert.equal(displayRootOf(mesa, "drum"), null);
  assert.equal(displayRootOf(drum, "mesa"), null);
  assert.equal(displayRootOf(climbDescent(mesa), "mesa"), null);
  assert.equal(displayRootOf(drum, "drum"), "flare/data", "climbing the mesa left the drum alone");
});

test("descent never touches a transform: MAGNIFY and rotation persist by construction", () => {
  // The ruling: sub-node traversal must not replace or consume
  // MAGNIFY. Descent state and the space's transform records are
  // separate values — running descent transitions cannot reach a
  // transform, and the record a citizen carries into a descent is
  // the record it carries out.
  const s0 = createSpaceState("ring");
  const s1 = applyTransformKey(s0, "mesa", "x"); // MAGNIFY +
  const s2 = applyTransformKey(s1, "mesa", "r"); // yaw +
  const before = s2.transforms.mesa;
  let d = descend(createDescent(), "mesa", "flare/vis");
  d = descend(d, "mesa", "flare/vis/operator");
  d = climbDescent(climbDescent(d));
  assert.equal(s2.transforms.mesa, before, "the transform record is the same object");
  assert.ok(before.scale > 1 && before.yaw > 0, "magnified and turned, untouched");
  assert.equal(displayRootOf(d, "mesa"), null);
});

test("EVENTS is intact for the descent chain tests", () => {
  assert.equal(EVENTS.GO_BACK_II, "GO_BACK_II");
});
