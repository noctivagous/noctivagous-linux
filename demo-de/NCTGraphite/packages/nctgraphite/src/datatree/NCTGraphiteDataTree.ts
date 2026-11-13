/**
 * Data trees — Grasshopper's signature data model, which the
 * vendored libraries did not have (see demo-de's
 * GRASSHOPPER-TAXONOMY-MAP.md, gap 1).
 *
 * A data tree is a set of *branches*. Each branch has a *path* — a
 * list of indices written `{0;2}` — and holds a list of items.
 * Components receive and emit trees; the classic tree operations
 * reshape them without touching the items:
 *
 *  - flatten: every item into one branch, path `{0}`.
 *  - graft:   every item into its own branch, path extended by the
 *             item's index inside its old branch.
 *  - simplify: drop leading path indices that are identical across
 *             all branches (Grasshopper's "simplify" trims
 *             redundant path depth).
 *
 * Trees are immutable values here: every operation returns a new
 * tree, branches sorted lexicographically by path. Paths are the
 * addressing scheme downstream components (and readouts) use.
 */

export type DataPath = readonly number[];

export interface DataBranch<T> {
  path: DataPath;
  items: readonly T[];
}

export interface DataTree<T> {
  branches: readonly DataBranch<T>[];
}

/** "{0;2;1}" — the path as Grasshopper writes it. */
export function formatDataPath(path: DataPath): string {
  return `{${path.join(";")}}`;
}

/** Lexicographic path order: shorter common prefixes first. */
export function compareDataPaths(a: DataPath, b: DataPath): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function sorted<T>(branches: DataBranch<T>[]): DataBranch<T>[] {
  return [...branches].sort((x, y) => compareDataPaths(x.path, y.path));
}

/** Build a tree from [path, items] pairs; duplicate paths merge. */
export function makeDataTree<T>(
  entries: Iterable<readonly [DataPath, Iterable<T>]>,
): DataTree<T> {
  const byKey = new Map<string, { path: number[]; items: T[] }>();
  for (const [path, items] of entries) {
    const key = path.join(";");
    let branch = byKey.get(key);
    if (!branch) {
      branch = { path: [...path], items: [] };
      byKey.set(key, branch);
    }
    branch.items.push(...items);
  }
  return { branches: sorted([...byKey.values()]) };
}

/** Group items into branches by a path key — the usual way a
 *  component's flat output becomes a tree ("one branch per row"). */
export function groupToTree<T>(
  items: Iterable<T>,
  pathOf: (item: T, index: number) => DataPath,
): DataTree<T> {
  const entries = new Map<string, { path: number[]; items: T[] }>();
  let index = 0;
  for (const item of items) {
    const path = pathOf(item, index++);
    const key = path.join(";");
    let branch = entries.get(key);
    if (!branch) {
      branch = { path: [...path], items: [] };
      entries.set(key, branch);
    }
    branch.items.push(item);
  }
  return { branches: sorted([...entries.values()]) };
}

/** All items, in branch order — what flatten feeds downstream when
 *  a component asks for the longest-list view. */
export function treeItems<T>(tree: DataTree<T>): T[] {
  return tree.branches.flatMap((b) => [...b.items]);
}

export function treeBranch<T>(tree: DataTree<T>, path: DataPath): DataBranch<T> | undefined {
  const key = path.join(";");
  return tree.branches.find((b) => b.path.join(";") === key);
}

/** Flatten: all items into a single branch `{0}`. */
export function flattenTree<T>(tree: DataTree<T>): DataTree<T> {
  return { branches: [{ path: [0], items: treeItems(tree) }] };
}

/** Graft: each item gets its own branch, path extended by index. */
export function graftTree<T>(tree: DataTree<T>): DataTree<T> {
  const branches: DataBranch<T>[] = [];
  for (const branch of tree.branches) {
    branch.items.forEach((item, i) => {
      branches.push({ path: [...branch.path, i], items: [item] });
    });
  }
  return { branches: sorted(branches) };
}

/** Simplify: while every branch shares the same first path index
 *  and paths are deeper than one level, drop that index. */
export function simplifyTree<T>(tree: DataTree<T>): DataTree<T> {
  if (tree.branches.length === 0) return tree;
  let branches = tree.branches.map((b) => ({ path: [...b.path], items: b.items }));
  while (
    branches.every((b) => b.path.length > 1 && b.path[0] === branches[0].path[0])
  ) {
    branches = branches.map((b) => ({ path: b.path.slice(1), items: b.items }));
  }
  return { branches: sorted(branches) };
}

/** Map every item, keeping the branch structure untouched. */
export function mapTree<T, U>(tree: DataTree<T>, fn: (item: T) => U): DataTree<U> {
  return {
    branches: tree.branches.map((b) => ({ path: b.path, items: b.items.map(fn) })),
  };
}

export interface DataTreeStats {
  branches: number;
  items: number;
  maxDepth: number;
  largestBranch: number;
}

export function treeStats<T>(tree: DataTree<T>): DataTreeStats {
  let items = 0;
  let maxDepth = 0;
  let largestBranch = 0;
  for (const b of tree.branches) {
    items += b.items.length;
    maxDepth = Math.max(maxDepth, b.path.length);
    largestBranch = Math.max(largestBranch, b.items.length);
  }
  return { branches: tree.branches.length, items, maxDepth, largestBranch };
}
