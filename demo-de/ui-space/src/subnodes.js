/**
 * UI Space — the SUB-NODE providers (slice 12; repo data, slice 13).
 *
 * Slice 5 gave the data KNOT parts and slice 7 gave the data TREE
 * depth-1 branches: sub-addresses that exist while their citizen
 * is current — hovered, they highlight and name themselves; F
 * flies the camera into them; the back events release them. This
 * module generalises the pattern to the remaining data citizens:
 * the TREEMAP TRAY's plates and cuboids, the TANGLED TREE's
 * figures, and the two SUNBURSTS' wedges (mesa and drum — one
 * hierarchy wearing two forms).
 *
 * A provider is a pure table per citizen: every sub-node as data
 * — { id, name, value, share, depth, path, isLeaf } — computed
 * from the SAME layouts the miniatures render. Node ids are
 * stable and shared between the App (info, focus, descent) and
 * the View (picking, highlight): for the hierarchy citizens the
 * id is the node's name path from the root
 * ("noctivagous-linux/demo-de/ui-space"), the tree's branchId
 * precedent generalised; the tangled tree's figures keep the ids
 * their data already carries. The tables are built here, once,
 * from the raw data — the hierarchy mathematics is the layouts'
 * own (branch value = own value plus all descendants, as
 * d3.hierarchy().sum() and the NCTGraphite builders compute it),
 * so the App's table and the View's layout agree node for node,
 * as the tree's two builds do.
 *
 * THE HIERARCHY (slice 13) is the space's one hierarchy source
 * (hierarchy.js): the noctivagous-linux repository itself,
 * snapshot-generated — file sizes in bytes are the values.
 * Until this slice it was d3's FLARE placeholder.
 *
 * THE TANGLED TREE HAS TWO COURSES (slice 13): the GENEALOGY
 * (the Greek figures, the original data) and IMPORTS (demo-de's
 * own module import graph, snapshot-generated into
 * import-graph.json: a module's parents are its importers, its
 * level its longest path from the entry modules). The provider
 * follows the ACTIVE course — pass `dataset` ("genealogy" by
 * default) to the tangle calls; the App holds the switch (the
 * PARAMETERS panel's "Tangled tree data").
 *
 * SHARE is always relative to a stated whole: at rest, the
 * citizen's whole (the repository total; the active course's
 * figure count). While a sunburst is DESCENDED (space-state.js
 * holds the descent), the whole is the display root — pass its
 * id as `rootId` and shares, and the rendered set, resolve
 * against it.
 */

import { HIERARCHY } from "./hierarchy.js";
import { TANGLE_LEVELS } from "../../src/tangle-data.js";
import importGraph from "./import-graph.json" with { type: "json" };

/* ---------------- the hierarchy (tray, mesa, drum) ---------------- */

function buildHierarchyTable() {
  const byId = new Map();
  const all = [];
  const walk = (data, parent, depth, pathNames) => {
    const path = [...pathNames, data.name];
    const node = {
      id: path.join("/"),
      name: data.name,
      data,
      depth,
      parentId: parent ? parent.id : null,
      path,
      value: 0,
      children: [],
      isLeaf: !(data.children && data.children.length),
    };
    byId.set(node.id, node);
    all.push(node);
    let sum = data.value || 0;
    for (const childData of data.children || []) {
      const child = walk(childData, node, depth + 1, path);
      node.children.push(child);
      sum += child.value;
    }
    node.value = sum;
    // The layouts sort children by descending value (d3's sort);
    // the table keeps the same order so lists read as rendered.
    node.children.sort((a, b) => b.value - a.value);
    return node;
  };
  const root = walk(HIERARCHY, null, 0, []);
  return { root, byId, all };
}

const HIERARCHY_TABLE = buildHierarchyTable();

/** The hierarchy root as a provider node ("noctivagous-linux" itself). */
export function hierarchyRoot() {
  return publicNode(HIERARCHY_TABLE.root, 1, 0);
}

/** A hierarchy node by its path id, or null. No share — see subnodeById. */
export function hierarchyNodeById(id) {
  return HIERARCHY_TABLE.byId.get(id) || null;
}

/** The raw hierarchy data subtree under a path id (the descent rebuild's input). */
export function hierarchyDataOf(id) {
  const n = HIERARCHY_TABLE.byId.get(id);
  return n ? n.data : null;
}

/* ---------------- the tangled tree's two courses ---------------- */

/** The tangle's datasets, in the PARAMETERS panel's order. */
export const TANGLE_DATASETS = ["genealogy", "imports"];

const TANGLE_LEVEL_SETS = {
  genealogy: TANGLE_LEVELS,
  imports: importGraph.levels,
};

const TANGLE_WHOLE_NAMES = {
  genealogy: "the genealogy",
  imports: "the import graph",
};

/** A course's raw levels ([[{ id, parents }], ...]) — the View's input too. */
export function tangleLevels(dataset = "genealogy") {
  return TANGLE_LEVEL_SETS[dataset] || TANGLE_LEVELS;
}

function buildTangleTable(levels, nameOf) {
  const byId = new Map();
  const all = [];
  levels.forEach((level, li) => {
    for (const raw of level) {
      const node = {
        id: raw.id,
        name: nameOf(raw.id),
        depth: li,
        parentId: raw.parents && raw.parents.length ? raw.parents[0] : null,
        parents: raw.parents || [],
        path: null, // resolved below, once every node exists
        value: 0, // progeny, resolved below
        children: [],
        isLeaf: true,
      };
      byId.set(node.id, node);
      all.push(node);
    }
  });
  for (const node of all) {
    for (const p of node.parents) {
      const parent = byId.get(p);
      if (parent) parent.children.push(node);
    }
  }
  for (const node of all) node.isLeaf = node.children.length === 0;
  // A figure's PATH: its first-parent line up to a root figure.
  // Both courses are DAGs with several roots (Uranus has no
  // parents at all; the import graph has eleven entry modules),
  // so the path is a representative ancestry, stated as such —
  // the first parent is the data's own order.
  const pathOf = (node, seen = new Set()) => {
    if (node.path) return node.path;
    if (seen.has(node.id)) return [node.id];
    seen.add(node.id);
    const parent = node.parentId ? byId.get(node.parentId) : null;
    node.path = parent ? [...pathOf(parent, seen), node.id] : [node.id];
    return node.path;
  };
  // A figure's VALUE is its progeny: itself plus every figure
  // that descends from it. Neither course carries weights of its
  // own; the size of a figure's line is its honest measure, and
  // its share is that count over the whole course. (For the
  // import graph, a module's progeny is its dependency closure:
  // itself plus everything it imports, directly or not.)
  const progenyOf = (node) => {
    const seen = new Set();
    const stack = [node];
    while (stack.length) {
      const n = stack.pop();
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      for (const c of n.children) stack.push(c);
    }
    return seen.size;
  };
  for (const node of all) {
    pathOf(node);
    node.value = progenyOf(node);
  }
  return { byId, all, total: all.length };
}

const TANGLE_TABLES = {
  // The genealogy's figures are named by their ids; a module's
  // NAME is its file name — its id is the full repo path.
  genealogy: buildTangleTable(TANGLE_LEVELS, (id) => id),
  imports: buildTangleTable(importGraph.levels, (id) => id.split("/").pop()),
};

function tangleTable(dataset) {
  return TANGLE_TABLES[dataset] || TANGLE_TABLES.genealogy;
}

/* ---------------- the provider API ---------------- */

/** The citizens with sub-nodes, in the order the guide names them. */
export const SUBNODE_OBJECT_IDS = ["tray", "tangle", "mesa", "drum"];

export const isSubnodeObject = (id) => SUBNODE_OBJECT_IDS.includes(id);

const HIERARCHY_CITIZENS = ["tray", "mesa", "drum"];

function publicNode(node, share, relDepth) {
  return {
    id: node.id,
    name: node.name,
    value: node.value,
    share,
    depth: node.depth,
    relDepth,
    parentId: node.parentId,
    path: [...node.path],
    isLeaf: node.isLeaf,
  };
}

/**
 * The whole a citizen's shares are of, as { id, name, value }:
 * for a sunburst under descent, the display root (pass rootId);
 * otherwise the citizen's own whole — the repository root, or
 * the tangle's active course itself (id null: it is not a node).
 */
export function subnodeRootOf(objectId, rootId = null, dataset = "genealogy") {
  if (HIERARCHY_CITIZENS.includes(objectId)) {
    const root = rootId ? HIERARCHY_TABLE.byId.get(rootId) : HIERARCHY_TABLE.root;
    if (!root) return null;
    return { id: root.id, name: root.name, value: root.value };
  }
  if (objectId === "tangle") {
    const table = tangleTable(dataset);
    return {
      id: null,
      name: TANGLE_WHOLE_NAMES[dataset] || TANGLE_WHOLE_NAMES.genealogy,
      value: table.total,
    };
  }
  return null;
}

/**
 * One sub-node by id, with its share resolved against the whole
 * `rootId` names (the true whole when omitted). Null when the
 * citizen has no such node. `dataset` selects the tangle's
 * active course; the hierarchy citizens ignore it.
 */
export function subnodeById(objectId, nodeId, rootId = null, dataset = "genealogy") {
  if (!nodeId) return null;
  if (HIERARCHY_CITIZENS.includes(objectId)) {
    const node = HIERARCHY_TABLE.byId.get(nodeId);
    if (!node) return null;
    const whole = subnodeRootOf(objectId, rootId);
    const relDepth = whole && rootId ? node.depth - (HIERARCHY_TABLE.byId.get(rootId)?.depth ?? 0) : node.depth;
    return publicNode(node, whole ? node.value / whole.value : 0, relDepth);
  }
  if (objectId === "tangle") {
    const table = tangleTable(dataset);
    const node = table.byId.get(nodeId);
    if (!node) return null;
    return publicNode(node, node.value / table.total, node.depth);
  }
  return null;
}

/**
 * The sub-nodes a citizen currently RENDERS, with shares against
 * the whole `rootId` names:
 *   tray   — the repository's depth-1 plates and depth-2 cuboids;
 *   mesa / drum — the display root's relative depth 1..2 wedges
 *     (at rest, the true root's: the repository's depth 1..2);
 *   tangle — every figure of the active course, on its level sheet.
 */
export function subnodesFor(objectId, rootId = null, dataset = "genealogy") {
  if (objectId === "tray") {
    const whole = HIERARCHY_TABLE.root;
    return HIERARCHY_TABLE.all
      .filter((n) => n.depth >= 1 && n.depth <= 2)
      .map((n) => publicNode(n, n.value / whole.value, n.depth));
  }
  if (objectId === "mesa" || objectId === "drum") {
    const root = rootId ? HIERARCHY_TABLE.byId.get(rootId) : HIERARCHY_TABLE.root;
    if (!root) return [];
    const out = [];
    const walk = (node) => {
      for (const child of node.children) {
        const rel = child.depth - root.depth;
        if (rel >= 1 && rel <= 2) out.push(publicNode(child, child.value / root.value, rel));
        if (rel < 2) walk(child);
      }
    };
    walk(root);
    return out;
  }
  if (objectId === "tangle") {
    const table = tangleTable(dataset);
    return table.all.map((n) => publicNode(n, n.value / table.total, n.depth));
  }
  return [];
}

/** A sub-node's parent id (the descent's climb target), or null at the top. */
export function subnodeParentOf(objectId, nodeId, dataset = "genealogy") {
  const node = subnodeById(objectId, nodeId, null, dataset);
  return node ? node.parentId : null;
}
