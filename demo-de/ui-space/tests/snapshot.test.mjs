import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  walkTree,
  treeStats,
  buildImportGraph,
  EXCLUDED_NAMES,
  GENERATED_BASENAMES,
} from "../tools/snapshot-repo.mjs";

/* The snapshot generator (slice 13): the tree walk over fixture
 * trees (determinism, byte values, the stated exclusions), the
 * import graph over a fixture WITH a cycle (termination, level
 * consistency), and the committed artifacts held to the same
 * rules. */

function fixtureDir(build) {
  const dir = mkdtempSync(path.join(tmpdir(), "ui-space-snapshot-"));
  try {
    build(dir);
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return dir;
}

const write = (root, rel, text) => {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
};

/* ---------------- the tree walk ---------------- */

test("walkTree: byte values, name sorting, exclusions, empty dirs dropped — and deterministic", () => {
  const dir = fixtureDir((root) => {
    write(root, "alpha.txt", "abc"); // 3 bytes
    write(root, "sub/beta.js", "12345"); // 5 bytes
    write(root, "sub/node_modules/dep.js", "excluded");
    write(root, "sub/dist/x.js", "excluded");
    write(root, ".git/ignored.txt", "excluded");
    write(root, "empty/node_modules/y.js", "excluded");
    write(root, "generated.json", "{}");
  });
  try {
    const generated = new Set([path.join(dir, "generated.json")]);
    const expected = {
      name: "fixture-root",
      children: [
        { name: "alpha.txt", value: 3 },
        { name: "sub", children: [{ name: "beta.js", value: 5 }] },
      ],
    };
    const first = walkTree(dir, "fixture-root", generated);
    assert.deepEqual(first, expected);
    const second = walkTree(dir, "fixture-root", generated);
    assert.deepEqual(second, first, "two walks of the same tree agree");
    assert.equal(JSON.stringify(second), JSON.stringify(first), "byte for byte");
    assert.deepEqual(treeStats(first), { files: 2, dirs: 2, bytes: 8 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------- the import graph ---------------- */

test("buildImportGraph: a cycle terminates; levels are consistent modulo the cycle", () => {
  const dir = fixtureDir((root) => {
    // a <-> b is an import cycle; main and entry are entries.
    write(root, "demo-de/src/a.js", 'import "./b.js";\nimport "../ui-space/src/u.js";\n');
    write(root, "demo-de/src/b.js", 'import "./a.js";\n');
    write(root, "demo-de/src/main.js", 'import "./a.js";\n');
    write(root, "demo-de/ui-space/src/u.js", "export const u = 1;\n");
    write(root, "demo-de/ui-space/src/entry.jsx", 'import "./u.js";\nimport "../../src/main.js";\n');
  });
  try {
    const demoDe = path.join(dir, "demo-de");
    const g = buildImportGraph(demoDe);
    assert.deepEqual(g.nodes, [
      "demo-de/src/a.js",
      "demo-de/src/b.js",
      "demo-de/src/main.js",
      "demo-de/ui-space/src/entry.jsx",
      "demo-de/ui-space/src/u.js",
    ]);
    for (const [a, b] of g.edges) {
      assert.ok(g.nodes.includes(a) && g.nodes.includes(b), `edge ${a} -> ${b} endpoints exist`);
    }
    assert.ok(g.edges.some(([a, b]) => a.endsWith("a.js") && b.endsWith("b.js")), "a -> b graphed");
    assert.ok(g.edges.some(([a, b]) => a.endsWith("b.js") && b.endsWith("a.js")), "b -> a graphed (the cycle)");
    // Levels partition the nodes exactly, and parents agree with edges.
    const levelOf = new Map();
    g.levels.forEach((level, li) => level.forEach((n) => levelOf.set(n.id, li)));
    assert.equal(levelOf.size, g.nodes.length);
    for (const level of g.levels) {
      for (const n of level) {
        const fromEdges = g.edges.filter(([, b]) => b === n.id).map(([a]) => a).sort();
        assert.deepEqual([...n.parents].sort(), fromEdges, `${n.id} parents are its importers`);
      }
    }
    // Level consistency: an edge runs downhill (imported deeper
    // than importer) unless it lies on a cycle — checked by
    // reachability: the imported module can reach the importer.
    const reaches = (from, to) => {
      const seen = new Set();
      const stack = [from];
      while (stack.length) {
        const cur = stack.pop();
        if (cur === to) return true;
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const [a, b] of g.edges) if (a === cur) stack.push(b);
      }
      return false;
    };
    for (const [a, b] of g.edges) {
      assert.ok(
        levelOf.get(b) > levelOf.get(a) || reaches(b, a),
        `edge ${a} -> ${b} is downhill or on a cycle`,
      );
    }
    // The entries stand at level 0.
    assert.equal(levelOf.get("demo-de/ui-space/src/entry.jsx"), 0);
    // The graph is deterministic.
    assert.deepEqual(buildImportGraph(demoDe), g);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------- the committed artifacts ---------------- */

const COMMITTED_GRAPH = JSON.parse(
  readFileSync(new URL("../src/import-graph.json", import.meta.url), "utf8"),
);
const COMMITTED_TREE = JSON.parse(
  readFileSync(new URL("../src/repo-snapshot.json", import.meta.url), "utf8"),
);

test("the committed import graph: endpoints exist, levels partition, consistency modulo cycles", () => {
  const { nodes, edges, levels } = COMMITTED_GRAPH;
  assert.ok(nodes.length > 40, "demo-de's real graph is graphed");
  assert.ok(nodes.includes("demo-de/ui-space/src/SpaceApp.jsx"));
  assert.ok(nodes.includes("demo-de/ui-space/src/hierarchy.js"));
  for (const [a, b] of edges) {
    assert.ok(nodes.includes(a), `importer ${a} is a node`);
    assert.ok(nodes.includes(b), `imported ${b} is a node`);
  }
  const levelOf = new Map();
  levels.forEach((level, li) => level.forEach((n) => levelOf.set(n.id, li)));
  assert.equal(levelOf.size, nodes.length, "levels partition the nodes");
  for (const id of nodes) assert.ok(levelOf.has(id), `${id} is levelled`);
  const reaches = (from, to) => {
    const seen = new Set();
    const stack = [from];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === to) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const [a, b] of edges) if (a === cur) stack.push(b);
    }
    return false;
  };
  for (const [a, b] of edges) {
    assert.ok(
      levelOf.get(b) > levelOf.get(a) || reaches(b, a),
      `edge ${a} -> ${b} is downhill or on a cycle`,
    );
  }
  // No module is its own ancestor-level entry: level 0 = imported by nobody.
  const imported = new Set(edges.map(([, b]) => b));
  for (const n of levels[0]) assert.ok(!imported.has(n.id), `${n.id} at level 0 has no importers`);
});

test("the committed snapshot: the stated exclusions hold throughout the tree", () => {
  assert.equal(COMMITTED_TREE.name, "noctivagous-linux");
  const walk = (n) => {
    for (const c of n.children || []) {
      assert.ok(!EXCLUDED_NAMES.has(c.name), `${c.name} is excluded by name`);
      assert.ok(!GENERATED_BASENAMES.includes(c.name), `${c.name} is a generated file, excluded`);
      if (c.children) walk(c);
      else assert.ok(Number.isInteger(c.value) && c.value >= 0, `${c.name} carries a byte size`);
    }
  };
  walk(COMMITTED_TREE);
});
