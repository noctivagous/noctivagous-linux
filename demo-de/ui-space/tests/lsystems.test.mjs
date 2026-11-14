// Regression tests for the L-system module (slice 7): rewriting
// determinism, hand-computable segment counts, turtle geometry,
// bracket-error reporting, pipe-model conservation, and the data
// tree's aggregation invariants. Pure node, no three.js.
//
//     node --test demo-de/ui-space/tests/lsystems.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import {
  createRng,
  expand,
  interpret,
  pipeRadii,
  buildBotanicalTree,
  buildDataTree,
  TREE_GRAMMAR,
} from "../src/lsystems.js";
import { FLARE } from "../../src/sunburst-data.js";
import { resolveFAction, labelForIndex, objectById } from "../src/space-state.js";

const EPS = 1e-9;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const vecNear = (a, b, eps = 1e-9) =>
  a.length === b.length && a.every((v, i) => near(v, b[i], eps));

// ---- rewriting --------------------------------------------------------

test("expansion is deterministic per seed, different across seeds", () => {
  const run = (seed) =>
    expand(TREE_GRAMMAR.axiom, TREE_GRAMMAR.rules, 4, createRng(seed));
  assert.equal(run(42), run(42), "same seed must give the identical string");
  assert.notEqual(run(42), run(43), "a different seed must diverge");
  // an array rule without an rng falls back to its first production
  const first = TREE_GRAMMAR.rules.A[0].production;
  assert.equal(expand("A", TREE_GRAMMAR.rules, 1), first);
});

test("hand-computable grammar: exact segment counts at iterations 0/1/2", () => {
  const rules = { F: "F[+F][-F]" };
  const expected = [1, 3, 9];
  for (let it = 0; it <= 2; it++) {
    const program = expand("F", rules, it);
    const { segments, errors } = interpret(program, { pipe: false });
    assert.deepEqual(errors, []);
    assert.equal(segments.length, expected[it], `iteration ${it}`);
  }
});

// ---- turtle geometry ---------------------------------------------------

test("turtle: F[+F][-F] at 90° gives 3 segments with exact endpoints", () => {
  const { segments, errors } = interpret("F[+F][-F]", {
    angle: 90, length: 1, pipe: false,
  });
  assert.deepEqual(errors, []);
  assert.equal(segments.length, 3);
  // trunk straight up; +yaws toward −X (L), − toward +X
  assert.ok(vecNear(segments[0].from, [0, 0, 0]));
  assert.ok(vecNear(segments[0].to, [0, 1, 0]));
  assert.ok(vecNear(segments[1].from, [0, 1, 0]));
  assert.ok(vecNear(segments[1].to, [-1, 1, 0]));
  assert.ok(vecNear(segments[2].from, [0, 1, 0]));
  assert.ok(vecNear(segments[2].to, [1, 1, 0]));
  // both branches parent to the trunk
  assert.equal(segments[1].parent, 0);
  assert.equal(segments[2].parent, 0);
});

test("turtle: pitch, roll, 180° yaw and the length factor stay axis-exact at 90°", () => {
  const pitch = interpret("F&F", { angle: 90, length: 1, pipe: false });
  assert.ok(vecNear(pitch.segments[1].to, [0, 1, -1]), "pitch & about L=[-1,0,0] tips H toward -U");
  const roll = interpret("\\F", { angle: 90, rollAngle: 90, length: 1, pipe: false });
  assert.ok(vecNear(roll.segments[0].to, [0, 1, 0]), "roll about H leaves H unchanged");
  const about = interpret("F|F", { angle: 90, length: 1, pipe: false });
  assert.ok(vecNear(about.segments[1].to, [0, 0, 0]), "| reverses the heading");
  const decay = interpret("'F", { length: 2, lengthFactor: 0.5, pipe: false });
  assert.ok(vecNear(decay.segments[0].to, [0, 1, 0]), "' scales the length state");
});

test("bracket imbalance is reported, never thrown", () => {
  const extra = interpret("F]F", {});
  assert.ok(extra.errors.length >= 1, "an unmatched ] must be reported");
  assert.equal(extra.segments.length, 2, "drawing continues past the error");
  const open = interpret("[F[F", {});
  assert.ok(open.errors.length >= 1, "an unclosed [ must be reported");
  assert.equal(open.segments.length, 2);
});

// ---- pipe model ---------------------------------------------------------

function assertPipeConserved(segments, label) {
  const children = segments.map(() => []);
  segments.forEach((s, i) => {
    if (s.parent >= 0) children[s.parent].push(i);
  });
  segments.forEach((s, i) => {
    assert.ok(Number.isFinite(s.radius) && s.radius > 0, `${label}: radius ${i} positive finite`);
    if (children[i].length > 0) {
      const sum = children[i].reduce((acc, k) => acc + segments[k].radius ** 2, 0);
      const rel = Math.abs(s.radius ** 2 - sum) / s.radius ** 2;
      assert.ok(rel < 1e-6, `${label}: junction ${i} conserves area (rel err ${rel})`);
    }
    if (s.parent >= 0) {
      assert.ok(
        s.radius <= segments[s.parent].radius + 1e-9,
        `${label}: radii non-increasing root→tip at ${i}`
      );
    }
  });
}

test("pipe model: conservation + monotonic radii on the botanical tree", () => {
  const { segments, errors } = buildBotanicalTree(7);
  assert.deepEqual(errors, []);
  assert.ok(segments.length > 50, "the botanical tree is a real tree");
  assertPipeConserved(segments, "botanical");
  const again = buildBotanicalTree(7);
  assert.deepEqual(
    again.segments.map((s) => s.to),
    segments.map((s) => s.to),
    "same seed → identical geometry"
  );
});

test("pipeRadii is exact on a hand-built junction", () => {
  const segs = [
    { from: [0, 0, 0], to: [0, 1, 0], parent: -1, depth: 0 },
    { from: [0, 1, 0], to: [-1, 1, 0], parent: 0, depth: 1 },
    { from: [0, 1, 0], to: [1, 1, 0], parent: 0, depth: 1 },
  ];
  pipeRadii(segs, 0.3);
  assert.ok(near(segs[0].radius, Math.sqrt(2) * 0.3, 1e-12));
  assert.equal(segs[0].tip, false);
  assert.equal(segs[1].tip, true);
});

// ---- data tree ------------------------------------------------------------

const FIXTURE = {
  name: "root",
  children: [
    { name: "a", children: [{ name: "a1", value: 4 }, { name: "a2", value: 6 }] },
    { name: "b", children: [{ name: "b1", value: 10 }] },
    { name: "c", value: 5 },
  ],
};

test("data tree: node count, tips, exact upward sums on a fixture", () => {
  const tree = buildDataTree(FIXTURE);
  assert.equal(tree.nodes.length, 7, "one node per hierarchy node");
  assert.equal(tree.segments.length, 7, "one segment per node");
  assert.equal(tree.tips.length, 4, "a1, a2, b1 and c are tips");
  assert.equal(tree.totalValue, 25);
  assert.equal(tree.leafCount, 4);
  const byName = Object.fromEntries(tree.nodes.map((n) => [n.name, n]));
  assert.equal(byName.a.value, 10, "subtree values sum upward exactly");
  assert.equal(byName.b.value, 10);
  assert.equal(byName.root.value, 25);
  // every hierarchy leaf maps to exactly one tip node
  const tipNames = tree.tips.map((n) => n.name).sort();
  assert.deepEqual(tipNames, ["a1", "a2", "b1", "c"]);
  // geometry sanity: root grows +Y from the origin
  assert.ok(vecNear(tree.segments[0].from, [0, 0, 0]));
  assert.ok(vecNear(tree.segments[0].to, [0, 11, 0]));
  for (const s of tree.segments) {
    for (const p of [s.from, s.to]) assert.ok(p.every(Number.isFinite), "endpoints finite");
  }
  assertPipeConserved(tree.segments, "fixture");
});

test("data tree: depth limiting aggregates deeper leaves into the tip", () => {
  const deep = {
    name: "r",
    children: [{
      name: "x",
      children: [{
        name: "y",
        children: [{ name: "z1", value: 3 }, { name: "z2", value: 7 }],
      }],
    }],
  };
  const tree = buildDataTree(deep, { maxDepth: 2 });
  assert.equal(tree.nodes.length, 3, "r, x, y only — z folds into y");
  const y = tree.nodes.find((n) => n.name === "y");
  assert.equal(y.tip, true);
  assert.equal(y.value, 10, "the tip carries the aggregated value");
  assert.equal(y.leafCount, 2, "and the aggregated leaf count");
});

test("data tree on flare: counts, branches and invariants", () => {
  const tree = buildDataTree(FLARE);
  // independent depth-limited node count of the raw hierarchy
  const count = (n, d) =>
    1 + (d < 3 && n.children ? n.children.reduce((s, k) => s + count(k, d + 1), 0) : 0);
  assert.equal(tree.nodes.length, count(FLARE, 0));
  assert.equal(tree.branches.length, FLARE.children.length, "one branch per top-level child");
  const branchSum = tree.branches.reduce((s, b) => s + b.value, 0);
  assert.equal(branchSum, tree.totalValue, "branch values sum to the total exactly");
  for (const b of tree.branches) {
    assert.ok(b.sphere.radius > 0 && b.sphere.centre.every(Number.isFinite));
    assert.ok(near(b.share, b.value / tree.totalValue, 1e-12));
    assert.equal(b.depth, 1);
  }
  assertPipeConserved(tree.segments, "flare");
});

// ---- the citizen + branch focus resolution ------------------------------

test("the data tree is the twelfth citizen, labelled N", () => {
  const obj = objectById("tree");
  assert.ok(obj, "tree exists in OBJECTS");
  assert.equal(obj.name, "Data tree");
  assert.equal(obj.group, "graphs");
  assert.equal(labelForIndex(11), "N", "appended after the crystal → label N");
});

test("resolveFAction: branch focus reuses the part-focus level", () => {
  const base = { pendingId: null, currentId: "tree", branchId: "flare/analytics" };
  assert.deepEqual(
    resolveFAction({ ...base, hoverId: "tree" }),
    { type: "branchFocus", targetId: "tree", partId: "flare/analytics" }
  );
  // hover wins: a branch id never hijacks another object's F
  assert.deepEqual(
    resolveFAction({ ...base, hoverId: "mesa" }),
    { type: "open", targetId: "mesa" }
  );
  // no branch hovered → the tree itself opens as usual (inspectIds
  // still route it to inspect, exactly like every other citizen)
  assert.deepEqual(
    resolveFAction({ ...base, branchId: null, hoverId: "tree" }),
    { type: "open", targetId: "tree" }
  );
  assert.deepEqual(
    resolveFAction({ ...base, branchId: null, hoverId: "tree", inspectIds: ["tree"] }),
    { type: "inspect", targetId: "tree" }
  );
  assert.deepEqual(
    resolveFAction({ pendingId: null, hoverId: null, currentId: null, branchId: "flare/analytics" }),
    { type: "none", targetId: null }
  );
  // a pending patch still outranks branch focus
  assert.deepEqual(
    resolveFAction({ ...base, pendingId: "mesa", hoverId: "tree" }),
    { type: "completePatch", targetId: "tree" }
  );
});
