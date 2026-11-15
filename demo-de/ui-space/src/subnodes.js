/**
 * UI Space — the SUB-NODE providers (slice 12).
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
 * the View (picking, highlight): for the flare citizens the id
 * is the node's name path from the root ("flare/vis/operator"),
 * the tree's branchId precedent generalised; the tangled tree's
 * figures keep the ids their data already carries. The tables
 * are built here, once, from the raw data — the hierarchy
 * mathematics is the layouts' own (branch value = own value plus
 * all descendants, as d3.hierarchy().sum() and the NCTGraphite
 * builders compute it), so the App's table and the View's layout
 * agree node for node, as the tree's two builds do.
 *
 * SHARE is always relative to a stated whole: at rest, the
 * citizen's whole (the flare total; the genealogy's figure
 * count). While a sunburst is DESCENDED (space-state.js holds
 * the descent), the whole is the display root — pass its id as
 * `rootId` and shares, and the rendered set, resolve against it.
 */

import { FLARE } from "../../src/sunburst-data.js";
import { TANGLE_LEVELS } from "../../src/tangle-data.js";

/* ---------------- the flare hierarchy (tray, mesa, drum) ---------------- */

function buildFlareTable() {
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
  const root = walk(FLARE, null, 0, []);
  return { root, byId, all };
}

const FLARE_TABLE = buildFlareTable();

/** The flare root as a provider node ("flare" itself). */
export function flareRoot() {
  return publicNode(FLARE_TABLE.root, 1, 0);
}

/** A flare node by its path id, or null. No share — see subnodeById. */
export function flareNodeById(id) {
  return FLARE_TABLE.byId.get(id) || null;
}

/** The raw flare data subtree under a path id (the descent rebuild's input). */
export function flareDataOf(id) {
  const n = FLARE_TABLE.byId.get(id);
  return n ? n.data : null;
}

/* ---------------- the tangled tree's figures ---------------- */

function buildTangleTable() {
  const byId = new Map();
  const all = [];
  TANGLE_LEVELS.forEach((level, li) => {
    for (const raw of level) {
      const node = {
        id: raw.id,
        name: raw.id,
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
  // The genealogy is a DAG with several roots (Uranus has no
  // parents at all), so the path is a representative ancestry,
  // stated as such — the first parent is the data's own order.
  const pathOf = (node, seen = new Set()) => {
    if (node.path) return node.path;
    if (seen.has(node.id)) return [node.id];
    seen.add(node.id);
    const parent = node.parentId ? byId.get(node.parentId) : null;
    node.path = parent ? [...pathOf(parent, seen), node.id] : [node.id];
    return node.path;
  };
  // A figure's VALUE is its progeny: itself plus every figure
  // that descends from it. The genealogy carries no weights of
  // its own; the size of a figure's line is its honest measure,
  // and its share is that count over the whole genealogy.
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

const TANGLE_TABLE = buildTangleTable();

/* ---------------- the provider API ---------------- */

/** The citizens with sub-nodes, in the order the guide names them. */
export const SUBNODE_OBJECT_IDS = ["tray", "tangle", "mesa", "drum"];

export const isSubnodeObject = (id) => SUBNODE_OBJECT_IDS.includes(id);

const FLARE_CITIZENS = ["tray", "mesa", "drum"];

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
 * otherwise the citizen's own whole — the flare root, or the
 * genealogy itself (id null: it is not a node).
 */
export function subnodeRootOf(objectId, rootId = null) {
  if (FLARE_CITIZENS.includes(objectId)) {
    const root = rootId ? FLARE_TABLE.byId.get(rootId) : FLARE_TABLE.root;
    if (!root) return null;
    return { id: root.id, name: root.name, value: root.value };
  }
  if (objectId === "tangle") {
    return { id: null, name: "the genealogy", value: TANGLE_TABLE.total };
  }
  return null;
}

/**
 * One sub-node by id, with its share resolved against the whole
 * `rootId` names (the true whole when omitted). Null when the
 * citizen has no such node.
 */
export function subnodeById(objectId, nodeId, rootId = null) {
  if (!nodeId) return null;
  if (FLARE_CITIZENS.includes(objectId)) {
    const node = FLARE_TABLE.byId.get(nodeId);
    if (!node) return null;
    const whole = subnodeRootOf(objectId, rootId);
    const relDepth = whole && rootId ? node.depth - (FLARE_TABLE.byId.get(rootId)?.depth ?? 0) : node.depth;
    return publicNode(node, whole ? node.value / whole.value : 0, relDepth);
  }
  if (objectId === "tangle") {
    const node = TANGLE_TABLE.byId.get(nodeId);
    if (!node) return null;
    return publicNode(node, node.value / TANGLE_TABLE.total, node.depth);
  }
  return null;
}

/**
 * The sub-nodes a citizen currently RENDERS, with shares against
 * the whole `rootId` names:
 *   tray   — flare's depth-1 plates and depth-2 cuboids;
 *   mesa / drum — the display root's relative depth 1..2 wedges
 *     (at rest, the true root's: flare's depth 1..2);
 *   tangle — every figure, on its level sheet.
 */
export function subnodesFor(objectId, rootId = null) {
  if (objectId === "tray") {
    const whole = FLARE_TABLE.root;
    return FLARE_TABLE.all
      .filter((n) => n.depth >= 1 && n.depth <= 2)
      .map((n) => publicNode(n, n.value / whole.value, n.depth));
  }
  if (objectId === "mesa" || objectId === "drum") {
    const root = rootId ? FLARE_TABLE.byId.get(rootId) : FLARE_TABLE.root;
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
    return TANGLE_TABLE.all.map((n) => publicNode(n, n.value / TANGLE_TABLE.total, n.depth));
  }
  return [];
}

/** A sub-node's parent id (the descent's climb target), or null at the top. */
export function subnodeParentOf(objectId, nodeId) {
  const node = subnodeById(objectId, nodeId);
  return node ? node.parentId : null;
}
