import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { TANGLE_LEVELS } from "../../src/tangle-data.js";
import { HIERARCHY } from "../src/hierarchy.js";
import {
  SUBNODE_OBJECT_IDS,
  TANGLE_DATASETS,
  isSubnodeObject,
  subnodeRootOf,
  subnodeById,
  subnodesFor,
  subnodeParentOf,
  hierarchyDataOf,
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
 * computed here, from the committed snapshot JSON /
 * TANGLE_LEVELS / import-graph JSON directly, never from the
 * provider's own tables. */

const SNAPSHOT = JSON.parse(
  readFileSync(new URL("../src/repo-snapshot.json", import.meta.url), "utf8"),
);
const IMPORT_GRAPH = JSON.parse(
  readFileSync(new URL("../src/import-graph.json", import.meta.url), "utf8"),
);

function rawHierarchyStats() {
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
  total = walk(SNAPSHOT, []);
  return { nodes, total, byPath };
}
const RAW = rawHierarchyStats();

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

/* A module's progeny in the import graph: its dependency closure —
 * itself plus everything it imports, directly or not (the edges
 * point importer → imported, the provider's children direction). */
function rawImportProgeny(id) {
  const imports = new Map();
  for (const [a, b] of IMPORT_GRAPH.edges) {
    if (!imports.has(a)) imports.set(a, []);
    imports.get(a).push(b);
  }
  const seen = new Set();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const c of imports.get(cur) || []) stack.push(c);
  }
  return seen.size;
}

/* ---------------- the hierarchy citizens (tray, mesa, drum) ---------------- */

test("the sub-node citizens are tray, tangle, mesa, drum, book, devices, mail, orrery", () => {
  // Slice 16 adds the orrery as the eighth provider.
  assert.deepEqual(SUBNODE_OBJECT_IDS, ["tray", "tangle", "mesa", "drum", "book", "devices", "mail", "orrery"]);
  assert.ok(isSubnodeObject("mesa"));
  assert.ok(!isSubnodeObject("knot")); // the knot has its own parts table
  assert.ok(!isSubnodeObject("tree")); // the tree has its own branches
});

test("hierarchy.js re-exports the committed snapshot JSON, unchanged", () => {
  assert.deepEqual(HIERARCHY, SNAPSHOT);
  assert.equal(HIERARCHY.name, "noctivagous-linux");
});

test("the hierarchy whole: the root's value is the raw byte sum, over unique path ids", () => {
  assert.ok(RAW.nodes > 400, `the snapshot is the real repo (${RAW.nodes} nodes)`);
  assert.equal(RAW.byPath.size, RAW.nodes, "every name path in the raw walk is unique");
  for (const id of ["tray", "mesa", "drum"]) {
    const root = subnodeRootOf(id);
    assert.equal(root.id, "noctivagous-linux");
    assert.equal(root.value, RAW.total);
  }
  // Every node of the snapshot resolves through the provider,
  // with the raw walk's value, depth and leafness.
  for (const [pathId, raw] of RAW.byPath) {
    const n = subnodeById("tray", pathId);
    assert.ok(n, `${pathId} resolves`);
    assert.equal(n.value, raw.value, `${pathId} value`);
    assert.equal(n.depth, raw.depth, `${pathId} depth`);
    assert.equal(n.isLeaf, raw.leaf, `${pathId} isLeaf`);
  }
});

test("tray provider: exactly the snapshot's depth-1 plates and depth-2 cuboids, ids unique", () => {
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

test("known repo nodes: demo-de the branch, a root file the leaf", () => {
  const raw = RAW.byPath.get("noctivagous-linux/demo-de");
  const n = subnodeById("tray", "noctivagous-linux/demo-de");
  assert.equal(n.name, "demo-de");
  assert.equal(n.value, raw.value);
  assert.equal(n.depth, 1);
  assert.equal(n.isLeaf, false);
  assert.deepEqual(n.path, ["noctivagous-linux", "demo-de"]);
  assert.equal(n.parentId, "noctivagous-linux");
  assert.ok(Math.abs(n.share - raw.value / RAW.total) < 1e-12);
  // A file at the root: a true leaf, whose parent is the root.
  const leafRaw = RAW.byPath.get("noctivagous-linux/d3-js-uses.txt");
  const leaf = subnodeById("mesa", "noctivagous-linux/d3-js-uses.txt");
  assert.equal(leaf.value, leafRaw.value);
  assert.ok(leaf.value > 0, "the leaf's value is its byte size");
  assert.equal(leaf.isLeaf, true);
  assert.equal(leaf.depth, 1);
  assert.equal(subnodeParentOf("mesa", leaf.id), "noctivagous-linux");
  assert.equal(subnodeParentOf("mesa", "noctivagous-linux/demo-de/ui-space"), "noctivagous-linux/demo-de");
  assert.equal(subnodeParentOf("mesa", "noctivagous-linux"), null);
});

test("mesa and drum at rest render the same wedge set as the tray's plates + cuboids", () => {
  const trayIds = subnodesFor("tray").map((n) => n.id).sort();
  for (const id of ["mesa", "drum"]) {
    assert.deepEqual(subnodesFor(id).map((n) => n.id).sort(), trayIds);
    for (const n of subnodesFor(id)) assert.equal(n.relDepth, n.depth);
  }
});

test("under descent, the sunburst provider re-roots: relative depths, shares of the display root", () => {
  const rootId = "noctivagous-linux/demo-de";
  const dd = subnodeById("mesa", rootId);
  const under = subnodesFor("mesa", rootId);
  assert.ok(under.length > 0);
  for (const n of under) {
    assert.ok(n.id.startsWith(`${rootId}/`), `${n.id} is under demo-de`);
    assert.ok(n.relDepth >= 1 && n.relDepth <= 2, `${n.id} relDepth`);
    assert.equal(n.relDepth, n.depth - dd.depth);
    assert.ok(Math.abs(n.share - n.value / dd.value) < 1e-12, `${n.id} share of demo-de`);
  }
  // Relative depth 1 is exactly demo-de's own children (branches
  // and direct files alike); their children appear at depth 2.
  const ddRaw = SNAPSHOT.children.find((c) => c.name === "demo-de");
  const groups = under.filter((n) => n.relDepth === 1);
  assert.equal(groups.length, ddRaw.children.length, "rel-1 set is demo-de's children");
  assert.ok(groups.every((g) => g.parentId === rootId), "rel-1 parents are demo-de");
  assert.ok(under.some((n) => n.relDepth === 2), "children show at rel depth 2");
  // subnodeById against the descended root resolves the same shares.
  const g = subnodeById("drum", groups[0].id, rootId);
  assert.ok(Math.abs(g.share - groups[0].share) < 1e-12);
  assert.equal(subnodeRootOf("mesa", rootId).value, dd.value);
  // The raw subtree the view rebuilds from is the data under the id.
  assert.equal(hierarchyDataOf(rootId).name, "demo-de");
  assert.equal(hierarchyDataOf("noctivagous-linux/nope"), null);
});

/* ---------------- the tangled tree: the genealogy ---------------- */

test("tangle provider (genealogy, the default): every figure, progeny as value, share of the genealogy", () => {
  assert.deepEqual(TANGLE_DATASETS, ["genealogy", "imports"]);
  const nodes = subnodesFor("tangle");
  assert.equal(nodes.length, TANGLE_COUNT);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length, "ids unique");
  assert.equal(subnodeRootOf("tangle").value, TANGLE_COUNT);
  assert.equal(subnodeRootOf("tangle").name, "the genealogy");
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

/* ---------------- the tangled tree: the import graph ---------------- */

test("tangle provider (imports): every module, progeny = dependency closure, share of the graph", () => {
  const nodes = subnodesFor("tangle", null, "imports");
  assert.equal(nodes.length, IMPORT_GRAPH.nodes.length);
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length, "ids unique");
  const whole = subnodeRootOf("tangle", null, "imports");
  assert.equal(whole.value, IMPORT_GRAPH.nodes.length);
  assert.equal(whole.name, "the import graph");
  for (const n of nodes) {
    assert.ok(IMPORT_GRAPH.nodes.includes(n.id), `${n.id} is a graph node`);
    assert.equal(n.value, rawImportProgeny(n.id), `${n.id} progeny`);
    assert.ok(Math.abs(n.share - rawImportProgeny(n.id) / IMPORT_GRAPH.nodes.length) < 1e-12, `${n.id} share`);
    // Depth is the level the generator assigned (levels partition the nodes).
    const li = IMPORT_GRAPH.levels.findIndex((l) => l.some((x) => x.id === n.id));
    assert.equal(n.depth, li, `${n.id} depth is its level`);
  }
  // A known module: SpaceApp, named by its file name, path by ids.
  const app = subnodeById("tangle", "demo-de/ui-space/src/SpaceApp.jsx", null, "imports");
  assert.ok(app, "SpaceApp is a figure of the imports course");
  assert.equal(app.name, "SpaceApp.jsx");
  assert.equal(app.path[app.path.length - 1], app.id, "path ends at the module");
  assert.equal(app.parentId, "demo-de/ui-space/src/space-main.jsx", "its importer is its parent");
  // An entry module: no importers, depth 0, its own path.
  const entry = subnodeById("tangle", "demo-de/ui-space/src/space-main.jsx", null, "imports");
  assert.equal(entry.depth, 0);
  assert.equal(entry.parentId, null);
  assert.deepEqual(entry.path, [entry.id]);
  // A module importing nothing in the graph: progeny of one, a leaf.
  const leafId = IMPORT_GRAPH.nodes.find(
    (id) => !IMPORT_GRAPH.edges.some(([a]) => a === id),
  );
  const leaf = subnodeById("tangle", leafId, null, "imports");
  assert.equal(leaf.value, 1);
  assert.equal(leaf.isLeaf, true);
  // The courses are separate worlds: no id leaks across.
  assert.equal(subnodeById("tangle", "Chaos", null, "imports"), null);
  assert.equal(subnodeById("tangle", "demo-de/ui-space/src/SpaceApp.jsx"), null);
});

/* ---------------- descent transitions (space-state) ---------------- */

test("descend sets the display root; displayRootOf answers per citizen", () => {
  let d = createDescent();
  assert.equal(displayRootOf(d, "mesa"), null);
  d = descend(d, "mesa", "noctivagous-linux/demo-de");
  assert.equal(displayRootOf(d, "mesa"), "noctivagous-linux/demo-de");
  assert.equal(displayRootOf(d, "drum"), null, "the drum is undisturbed");
  assert.equal(descentDepth(d), 1);
  const d2 = descend(d, "mesa", "noctivagous-linux/demo-de/ui-space");
  assert.equal(displayRootOf(d2, "mesa"), "noctivagous-linux/demo-de/ui-space");
  assert.equal(descentDepth(d2), 2);
  // Descending onto the standing root again is a no-op; junk is refused.
  assert.equal(descend(d2, "mesa", "noctivagous-linux/demo-de/ui-space"), d2);
  assert.equal(descend(d2, "mesa", null), d2);
  assert.equal(descend(d2, null, "noctivagous-linux/demo-de"), d2);
});

test("climb restores the parent root; at the true root it is a no-op", () => {
  let d = descend(createDescent(), "drum", "noctivagous-linux/demo-de");
  d = descend(d, "drum", "noctivagous-linux/demo-de/src");
  d = climbDescent(d);
  assert.equal(displayRootOf(d, "drum"), "noctivagous-linux/demo-de");
  d = climbDescent(d);
  assert.equal(displayRootOf(d, "drum"), null, "back at the true root");
  assert.deepEqual(d, createDescent());
  assert.deepEqual(climbDescent(d), createDescent(), "climbing at the true root changes nothing");
  assert.deepEqual(climbDescent(createDescent()), createDescent());
});

test("the two sunbursts' descents are independent values", () => {
  const mesa = descend(createDescent(), "mesa", "noctivagous-linux/demo-de");
  const drum = descend(createDescent(), "drum", "noctivagous-linux/refs");
  assert.equal(displayRootOf(mesa, "mesa"), "noctivagous-linux/demo-de");
  assert.equal(displayRootOf(drum, "drum"), "noctivagous-linux/refs");
  assert.equal(displayRootOf(mesa, "drum"), null);
  assert.equal(displayRootOf(drum, "mesa"), null);
  assert.equal(displayRootOf(climbDescent(mesa), "mesa"), null);
  assert.equal(displayRootOf(drum, "drum"), "noctivagous-linux/refs", "climbing the mesa left the drum alone");
});

test("descent never touches a transform: MAGNIFY and rotation persist by construction", () => {
  // The ruling: sub-node traversal must not replace or consume
  // MAGNIFY. Descent state and the space's transform records are
  // separate values — running descent transitions cannot reach a
  // transform, and the record a citizen carries into a descent is
  // the record it carries out.
  const s0 = createSpaceState("ring");
  const s1 = applyTransformKey(s0, "mesa", "x"); // MAGNIFY +
  // Slice 13-4 (item E) swapped the yaw pair, so the positive
  // yaw step is E now (it was R when this test was written).
  const s2 = applyTransformKey(s1, "mesa", "e"); // yaw +
  const before = s2.transforms.mesa;
  let d = descend(createDescent(), "mesa", "noctivagous-linux/demo-de");
  d = descend(d, "mesa", "noctivagous-linux/demo-de/ui-space");
  d = climbDescent(climbDescent(d));
  assert.equal(s2.transforms.mesa, before, "the transform record is the same object");
  assert.ok(before.scale > 1 && before.yaw > 0, "magnified and turned, untouched");
  assert.equal(displayRootOf(d, "mesa"), null);
});

test("EVENTS is intact for the descent chain tests", () => {
  assert.equal(EVENTS.GO_BACK_II, "GO_BACK_II");
});
