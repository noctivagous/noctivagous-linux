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
 *
 * THE CYLINDER BOOK (slice 13-2) joins as a fifth provider: its
 * tiers — chapters, sections, pages — are sub-nodes whose ids
 * are name paths under the root "book" (book.js holds the book
 * itself: a page's value is its word count, the tiers sum, and
 * shares read against the whole book). Its access state is NOT
 * a descent and does not re-root anything: the book's shares
 * are always of the whole book.
 *
 * THE DEVICES (slice 14) join as a sixth provider, and theirs
 * is the environment snapshot's table (environment.js): the
 * machine's attachments as sub-nodes under the root "devices"
 * — one node per shelf device (devices/<slug>), a NETWORK HUB
 * node (devices/net) standing for the machine's connections,
 * and one node per HOST under it (devices/net/<host>), the
 * hosts' anchors out on the ring where their tokens stand.
 * The measure here is a COUNT, as the tangle's is: a device's
 * value is 1 (it is one attached thing), the hub's is its
 * connection count, and the whole is the count of attached
 * things — the cards carry the specifics (the printer's
 * queue, a host's bytes), as the book's cards carry its text.
 *
 * THE MAIL (slice 15) joins as a seventh provider, from the
 * sample mailbox's table (mail.js): the FOLDERS as sub-nodes
 * under the root "mail" (mail/<folder>, Projects' children
 * nested), a folder's value its message count — its own plus
 * its subfolders', the hierarchy rule — and the RECENT
 * MESSAGES as sub-nodes too (mail/msg/<id>), each worth 1,
 * one letter. Their anchors split the difference the devices
 * proved: the folders' anchors stand in the citizen's
 * pigeonhole cabinet at its plot, and the messages' anchors
 * stand OUTSIDE the plot, on the post shelf beside the media
 * library on the XY wall, republished into the citizen's frame
 * each frame exactly as the devices' hosts are.
 *
 * THE ORRERY (slice 16) joins as an eighth provider, and it is
 * the second with DATASETS — the tangle's precedent, a flat
 * PARAMETERS switch (not a descent): pass `orreryMode`
 * ("solar" by default) to the orrery calls. SOLAR: the root
 * "orrery" is the SUN itself (its centre-disc precedent: a
 * card, no descent — F there is the resolver's rootNoop) and
 * the planets are its children (orrery/<planet>), a planet's
 * value its ORBITAL PERIOD IN DAYS, the root's the planets'
 * periods summed — the hierarchy rule, a parent's value its
 * own plus its descendants', the sun's own being nothing.
 * EARTH–MOON: the root is "orrery/earth" (Earth, its own value
 * its year) and its one child "orrery/earth/moon" (the Moon,
 * value its sidereal period). ARMILLARY (the slice-16
 * extension): the root "orrery" is the SPHERE itself (the same
 * rootNoop treatment) and its children are the instrument's
 * teaching set — the four bands (orrery/equator, orrery/
 * ecliptic, orrery/meridian, orrery/horizon) and the sun bead
 * (orrery/sun) — at EQUAL values by design: bands have no
 * natural magnitude, so each of the five carries a fifth of
 * the whole, stated here rather than dressed as a measure.
 * The data is orrery.js's table — NASA/JPL's published
 * elements, constants, no snapshot.
 */

import { HIERARCHY } from "./hierarchy.js";
import { TANGLE_LEVELS } from "../../src/tangle-data.js";
import importGraph from "./import-graph.json" with { type: "json" };
import { bookTable } from "./book.js";
import { ENVIRONMENT, deviceList, connectionsOf, connectionIds } from "./environment.js";
import { mailTable } from "./mail.js";
import { PLANETS, TOTAL_PERIOD_DAYS, MOON_PERIOD_DAYS, planetBySlug } from "./orrery.js";

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

/* ---------------- the devices (slice 14) ---------------- */

function buildDevicesTable() {
  const byId = new Map();
  const all = [];
  const root = {
    id: "devices", name: "Devices", depth: 0, parentId: null,
    path: ["Devices"], value: 0, children: [], isLeaf: false,
  };
  byId.set(root.id, root);
  all.push(root);
  for (const device of deviceList(ENVIRONMENT)) {
    const node = {
      id: `devices/${device.slug}`, name: device.name, depth: 1,
      parentId: root.id, path: ["Devices", device.name], value: 1,
      children: [], isLeaf: true,
    };
    byId.set(node.id, node);
    all.push(node);
    root.children.push(node);
    root.value += 1;
  }
  const conns = connectionsOf(ENVIRONMENT);
  if (conns.length) {
    const hub = {
      id: "devices/net", name: "Network hub", depth: 1,
      parentId: root.id, path: ["Devices", "Network hub"],
      value: conns.length, children: [], isLeaf: false,
    };
    byId.set(hub.id, hub);
    all.push(hub);
    root.children.push(hub);
    root.value += conns.length;
    const ids = connectionIds(ENVIRONMENT);
    conns.forEach((conn, i) => {
      const node = {
        id: ids[i], name: conn.host, depth: 2,
        parentId: hub.id, path: ["Devices", "Network hub", conn.host],
        value: 1, children: [], isLeaf: true,
      };
      byId.set(node.id, node);
      all.push(node);
      hub.children.push(node);
    });
  }
  return { root, byId, all };
}

const DEVICES_TABLE = buildDevicesTable();

/* ---------------- the mail (slice 15) ---------------- */

const MAIL_TABLE = mailTable();

/* ---------------- the orrery (slice 16) ---------------- */

/** The orrery's datasets, in the PARAMETERS panel's order. */
export const ORRERY_MODES = ["solar", "earthmoon", "armillary"];

function buildOrreryTables() {
  const solarById = new Map();
  const solarAll = [];
  const sun = {
    id: "orrery", name: "Sun", depth: 0, parentId: null,
    path: ["Sun"], value: TOTAL_PERIOD_DAYS, children: [], isLeaf: false,
  };
  solarById.set(sun.id, sun);
  solarAll.push(sun);
  for (const planet of PLANETS) {
    const node = {
      id: `orrery/${planet.slug}`, name: planet.name, depth: 1,
      parentId: sun.id, path: ["Sun", planet.name], value: planet.periodDays,
      children: [], isLeaf: true,
    };
    solarById.set(node.id, node);
    solarAll.push(node);
    sun.children.push(node);
  }
  const emById = new Map();
  const emAll = [];
  const earth = planetBySlug("earth");
  const earthNode = {
    id: "orrery/earth", name: "Earth", depth: 0, parentId: null,
    path: ["Earth"], value: earth.periodDays + MOON_PERIOD_DAYS,
    children: [], isLeaf: false,
  };
  emById.set(earthNode.id, earthNode);
  emAll.push(earthNode);
  const moonNode = {
    id: "orrery/earth/moon", name: "Moon", depth: 1,
    parentId: earthNode.id, path: ["Earth", "Moon"], value: MOON_PERIOD_DAYS,
    children: [], isLeaf: true,
  };
  emById.set(moonNode.id, moonNode);
  emAll.push(moonNode);
  earthNode.children.push(moonNode);
  const armById = new Map();
  const armAll = [];
  const sphere = {
    id: "orrery", name: "Armillary Sphere", depth: 0, parentId: null,
    path: ["Armillary Sphere"], value: 5, children: [], isLeaf: false,
  };
  armById.set(sphere.id, sphere);
  armAll.push(sphere);
  for (const [id, name] of [
    ["orrery/equator", "Celestial Equator"],
    ["orrery/ecliptic", "Ecliptic"],
    ["orrery/meridian", "Meridian"],
    ["orrery/horizon", "Horizon"],
    ["orrery/sun", "Sun"],
  ]) {
    const node = {
      id, name, depth: 1,
      parentId: sphere.id, path: ["Armillary Sphere", name], value: 1,
      children: [], isLeaf: true,
    };
    armById.set(node.id, node);
    armAll.push(node);
    sphere.children.push(node);
  }
  return {
    solar: { root: sun, byId: solarById, all: solarAll, wholeName: "the solar system" },
    earthmoon: { root: earthNode, byId: emById, all: emAll, wholeName: "the Earth–Moon system" },
    armillary: { root: sphere, byId: armById, all: armAll, wholeName: "the armillary sphere" },
  };
}

const ORRERY_TABLES = buildOrreryTables();

function orreryTable(mode = "solar") {
  return ORRERY_TABLES[mode] || ORRERY_TABLES.solar;
}

/* ---------------- the provider API ---------------- */

const BOOK_TABLE = bookTable();

/** The citizens with sub-nodes, in the order the guide names them. */
export const SUBNODE_OBJECT_IDS = ["tray", "tangle", "mesa", "drum", "book", "devices", "mail", "orrery"];

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
export function subnodeRootOf(objectId, rootId = null, dataset = "genealogy", orreryMode = "solar") {
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
  if (objectId === "book") {
    const root = BOOK_TABLE.root;
    return { id: root.id, name: root.name, value: root.value };
  }
  if (objectId === "devices") {
    const root = DEVICES_TABLE.root;
    return { id: root.id, name: root.name, value: root.value };
  }
  if (objectId === "mail") {
    const root = MAIL_TABLE.root;
    return { id: root.id, name: root.name, value: root.value };
  }
  if (objectId === "orrery") {
    const table = orreryTable(orreryMode);
    return { id: table.root.id, name: table.wholeName, value: table.root.value };
  }
  return null;
}

/**
 * One sub-node by id, with its share resolved against the whole
 * `rootId` names (the true whole when omitted). Null when the
 * citizen has no such node. `dataset` selects the tangle's
 * active course; the hierarchy citizens ignore it.
 */
export function subnodeById(objectId, nodeId, rootId = null, dataset = "genealogy", orreryMode = "solar") {
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
  if (objectId === "book") {
    const node = BOOK_TABLE.byId.get(nodeId);
    if (!node) return null;
    return publicNode(node, BOOK_TABLE.root.value ? node.value / BOOK_TABLE.root.value : 0, node.depth);
  }
  if (objectId === "devices") {
    const node = DEVICES_TABLE.byId.get(nodeId);
    if (!node) return null;
    return publicNode(node, DEVICES_TABLE.root.value ? node.value / DEVICES_TABLE.root.value : 0, node.depth);
  }
  if (objectId === "mail") {
    const node = MAIL_TABLE.byId.get(nodeId);
    if (!node) return null;
    return publicNode(node, MAIL_TABLE.root.value ? node.value / MAIL_TABLE.root.value : 0, node.depth);
  }
  if (objectId === "orrery") {
    const table = orreryTable(orreryMode);
    const node = table.byId.get(nodeId);
    if (!node) return null;
    return publicNode(node, table.root.value ? node.value / table.root.value : 0, node.depth);
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
export function subnodesFor(objectId, rootId = null, dataset = "genealogy", orreryMode = "solar") {
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
  if (objectId === "book") {
    // Every tier under the root: chapters, sections and pages —
    // the bands and the leaves are all rendered, all addressed.
    const whole = BOOK_TABLE.root;
    return BOOK_TABLE.all
      .filter((n) => n.depth >= 1)
      .map((n) => publicNode(n, whole.value ? n.value / whole.value : 0, n.depth));
  }
  if (objectId === "devices") {
    // Every attached thing: the shelf devices, the hub, and the
    // hosts out on the ring — all rendered, all addressed.
    const whole = DEVICES_TABLE.root;
    return DEVICES_TABLE.all
      .filter((n) => n.depth >= 1)
      .map((n) => publicNode(n, whole.value ? n.value / whole.value : 0, n.depth));
  }
  if (objectId === "mail") {
    // Every folder in the cabinet and every letter on the post
    // shelf — all rendered, all addressed.
    const whole = MAIL_TABLE.root;
    return MAIL_TABLE.all
      .filter((n) => n.depth >= 1)
      .map((n) => publicNode(n, whole.value ? n.value / whole.value : 0, n.depth));
  }
  if (objectId === "orrery") {
    // The active dressing's nodes under its root: the eight
    // planets, or the Moon, or the armillary's bands and bead.
    // (The roots themselves — the sun, Earth, the sphere — are
    // reported by their own meshes, as the mesa's centre disc
    // is.)
    const table = orreryTable(orreryMode);
    const whole = table.root;
    return table.all
      .filter((n) => n.depth >= 1)
      .map((n) => publicNode(n, whole.value ? n.value / whole.value : 0, n.depth));
  }
  return [];
}

/** A sub-node's parent id (the descent's climb target), or null at the top. */
export function subnodeParentOf(objectId, nodeId, dataset = "genealogy", orreryMode = "solar") {
  const node = subnodeById(objectId, nodeId, null, dataset, orreryMode);
  return node ? node.parentId : null;
}
