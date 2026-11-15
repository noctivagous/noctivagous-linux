#!/usr/bin/env node
/**
 * UI Space — the environment snapshot generator (slice 13).
 *
 * The space eats its own repo. This script walks the
 * noctivagous-linux repository tree and writes the two generated
 * data files the UI Space imports:
 *
 *   ui-space/src/repo-snapshot.json — the repo as a hierarchy:
 *     directories are { name, children: [...] }, files are
 *     { name, value } with value = the file's size in BYTES
 *     (fs.stat — the honest measure; directory values are sums,
 *     computed by the consumers' layout walks, as with flare).
 *     The walk root's name is "noctivagous-linux". File CONTENTS
 *     never enter the snapshot — names and sizes only — and this
 *     repo is public, so the snapshot is deployable as-is.
 *
 *   ui-space/src/import-graph.json — demo-de's module import
 *     graph, shaped for the tangled tree's second course:
 *     { nodes, edges, levels } where levels are arrays of
 *     { id, parents } (parents = IMPORTERS, mirroring the
 *     genealogy data's shape), a module's level being its
 *     longest path from the entry modules (level 0 = imported
 *     by nobody in the graph).
 *
 * EXCLUSIONS (the tree walk, by entry name, at any depth):
 *   .git, node_modules, dist — plus the two generated files
 *   themselves, by absolute path: repo-snapshot.json's own size
 *   would otherwise change the snapshot on every regeneration
 *   and it could never sit still. A directory left with no
 *   included descendants is dropped (it would stand in the
 *   layouts as a zero-value leaf saying nothing). Children are
 *   sorted by name, files and directories together, so
 *   regeneration is stable byte for byte.
 *
 * THE IMPORT GRAPH, method stated plainly: the modules scanned
 * for imports are the .js/.jsx/.ts/.tsx/.mjs files under
 * demo-de/src and demo-de/ui-space/src. Import specifiers are
 * found with a regular expression over each file's text —
 * static `import ... from "x"`, bare `import "x"` and
 * `export ... from "x"`; dynamic import() is not followed.
 * A relative specifier is resolved against the importing file
 * (exact path, then +.js/.jsx/.ts/.tsx/.mjs, then /index with
 * the same extensions). A resolved file inside this repository
 * becomes a node — including vendored files under
 * demo-de/NCTGraphite and demo-de/paramorphic-components that
 * demo-de's own modules import directly; those are leaves of
 * the graph (they are not scanned for their own imports).
 * Only module files become nodes: an import resolving to a
 * .json or .css file is data the module reads, not a module.
 * Package specifiers (react, three, ...) and anything resolving
 * into node_modules stay outside: they are dependencies, not
 * demo-de modules. Node ids are repo-relative POSIX paths.
 *
 * CYCLES: import cycles may exist, and on a cycle the
 * longest-path level is undefined. The assignment relaxes from
 * the entries; whatever a cycle leaves unlevelled is broken in
 * deterministically — the alphabetically first remaining module
 * takes one level past its deepest levelled importer (or past
 * the deepest level so far), relaxation resumes, and the loop
 * always terminates (every pass levels at least one module).
 * A cycle therefore shows at least one edge running backward
 * across the levels in the tangled tree — the honest picture
 * of a cycle, not a tidied one.
 *
 * Run:  node ui-space/tools/snapshot-repo.mjs   (from demo-de/)
 * The walk functions are exported for the test suite, which
 * runs them over fixture trees.
 */

import {
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Entry names the tree walk never descends into or records. */
export const EXCLUDED_NAMES = new Set([".git", "node_modules", "dist"]);

/** The generated files, by basename — excluded from the walk by path. */
export const GENERATED_BASENAMES = ["repo-snapshot.json", "import-graph.json"];

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* ---------------- the repository tree ---------------- */

function walkDir(absDir, name, generatedAbsPaths) {
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return null;
  }
  entries = entries
    .filter((e) => !EXCLUDED_NAMES.has(e.name))
    .sort((a, b) => byName(a.name, b.name));
  const children = [];
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    if (generatedAbsPaths.has(abs)) continue;
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue; // a dangling link or a file racing the walk — not data
    }
    if (st.isDirectory()) {
      const sub = walkDir(abs, entry.name, generatedAbsPaths);
      if (sub) children.push(sub);
    } else if (st.isFile()) {
      children.push({ name: entry.name, value: st.size });
    }
  }
  if (children.length === 0) return null;
  return { name, children };
}

/**
 * The repository rooted at rootDir as a hierarchy: { name,
 * children } / { name, value }. generatedAbsPaths names files
 * to leave out (the generator's own outputs).
 */
export function walkTree(rootDir, rootName, generatedAbsPaths = new Set()) {
  return walkDir(rootDir, rootName, generatedAbsPaths) || { name: rootName, children: [] };
}

/** Counts over a walked tree: files, directories, total bytes. */
export function treeStats(tree) {
  let files = 0;
  let dirs = 0;
  let bytes = 0;
  const walk = (n) => {
    if (n.children) {
      dirs++;
      for (const c of n.children) walk(c);
    } else {
      files++;
      bytes += n.value || 0;
    }
  };
  walk(tree);
  return { files, dirs, bytes };
}

/* ---------------- the import graph ---------------- */

export const MODULE_EXTS = [".js", ".jsx", ".ts", ".tsx", ".mjs"];

/** The demo-de directories whose modules are scanned for imports. */
export const SCAN_ROOTS = ["src", path.join("ui-space", "src")];

const IMPORT_RE =
  /\b(?:import|export)\b\s*(?:[^'";]*?\bfrom\b\s*)?["']([^"']+)["']/g;

function listModules(absDir, out = []) {
  if (!existsSync(absDir)) return out;
  const entries = readdirSync(absDir, { withFileTypes: true })
    .sort((a, b) => byName(a.name, b.name));
  for (const entry of entries) {
    if (EXCLUDED_NAMES.has(entry.name)) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) listModules(abs, out);
    else if (entry.isFile() && MODULE_EXTS.includes(path.extname(entry.name))) out.push(abs);
  }
  return out;
}

/** Resolve a specifier to an absolute file path inside the repo, or null. */
function resolveSpecifier(spec, importerAbs, repoRoot) {
  if (!spec.startsWith(".")) return null; // a package — external
  const base = path.resolve(path.dirname(importerAbs), spec);
  const candidates = [
    base,
    ...MODULE_EXTS.map((e) => base + e),
    ...MODULE_EXTS.map((e) => path.join(base, `index${e}`)),
  ];
  for (const cand of candidates) {
    if (!MODULE_EXTS.includes(path.extname(cand))) continue; // data, not a module
    let st;
    try {
      st = statSync(cand);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const rel = path.relative(repoRoot, cand);
    if (rel.startsWith("..")) return null; // outside the repo
    const parts = rel.split(path.sep);
    if (parts.includes("node_modules") || parts.includes(".git")) return null;
    return cand;
  }
  return null;
}

/**
 * demo-de's module import graph: { nodes, edges, levels }.
 * nodes are repo-relative POSIX ids, sorted; edges are
 * [importer, imported] pairs, sorted; levels are the tangled
 * tree's input shape — levels[L] = [{ id, parents }] with
 * parents the module's importers, sorted.
 */
export function buildImportGraph(demoDeDir) {
  const repoRoot = path.dirname(demoDeDir);
  const idOf = (abs) => path.relative(repoRoot, abs).split(path.sep).join("/");

  const scanned = [];
  for (const root of SCAN_ROOTS) listModules(path.join(demoDeDir, root), scanned);

  const nodeIds = new Set();
  const edgeKeys = new Set();
  for (const abs of scanned) nodeIds.add(idOf(abs));
  for (const abs of scanned) {
    const importer = idOf(abs);
    const text = readFileSync(abs, "utf8");
    for (const m of text.matchAll(IMPORT_RE)) {
      const target = resolveSpecifier(m[1], abs, repoRoot);
      if (!target) continue;
      const imported = idOf(target);
      if (imported === importer) continue;
      nodeIds.add(imported); // a directly imported repo file joins as a (leaf) node
      edgeKeys.add(`${importer}\n${imported}`);
    }
  }

  const nodes = [...nodeIds].sort(byName);
  const edges = [...edgeKeys].map((k) => k.split("\n")).sort((a, b) => byName(a.join("\n"), b.join("\n")));
  const parents = new Map(nodes.map((id) => [id, new Set()]));
  for (const [importer, imported] of edges) parents.get(imported).add(importer);

  // Levels: longest path from the entries, cycle-safe (header).
  const level = new Map();
  while (level.size < nodes.length) {
    let progressed = false;
    for (const id of nodes) {
      if (level.has(id)) continue;
      const ps = [...parents.get(id)];
      if (ps.length === 0) {
        level.set(id, 0);
        progressed = true;
      } else if (ps.every((p) => level.has(p))) {
        level.set(id, 1 + Math.max(...ps.map((p) => level.get(p))));
        progressed = true;
      }
    }
    if (!progressed) {
      const first = nodes.find((id) => !level.has(id));
      const levelled = [...parents.get(first)].filter((p) => level.has(p));
      const base = levelled.length
        ? Math.max(...levelled.map((p) => level.get(p)))
        : level.size
          ? Math.max(...level.values())
          : -1;
      level.set(first, base + 1);
    }
  }

  const levels = [];
  for (const id of nodes) {
    const L = level.get(id);
    if (!levels[L]) levels[L] = [];
    levels[L].push({ id, parents: [...parents.get(id)].sort(byName) });
  }
  return { nodes, edges, levels };
}

/* ---------------- main ---------------- */

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const toolsDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(toolsDir, "..", "..", "..");
  const demoDeDir = path.join(repoRoot, "demo-de");
  const outDir = path.join(demoDeDir, "ui-space", "src");
  const generated = new Set(
    GENERATED_BASENAMES.map((f) => path.join(outDir, f)),
  );

  const tree = walkTree(repoRoot, "noctivagous-linux", generated);
  const graph = buildImportGraph(demoDeDir);

  const treeJson = `${JSON.stringify(tree, null, 1)}\n`;
  const graphJson = `${JSON.stringify(graph, null, 1)}\n`;
  writeFileSync(path.join(outDir, "repo-snapshot.json"), treeJson);
  writeFileSync(path.join(outDir, "import-graph.json"), graphJson);

  const stats = treeStats(tree);
  const levelOf = new Map();
  graph.levels.forEach((level, li) => level.forEach((n) => levelOf.set(n.id, li)));
  const backward = graph.edges.filter(
    ([a, b]) => levelOf.get(b) <= levelOf.get(a),
  ).length;
  console.log(
    `repo-snapshot.json: ${stats.files} files, ${stats.dirs} directories, ` +
      `${stats.bytes} bytes total, ${treeJson.length} bytes of JSON`,
  );
  console.log(
    `import-graph.json: ${graph.nodes.length} modules, ${graph.edges.length} import edges, ` +
      `${graph.levels.length} levels, ${backward} backward edge(s) (import cycles), ` +
      `${graphJson.length} bytes of JSON`,
  );
}
