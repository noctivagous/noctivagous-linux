/**
 * NCTGraphiteTreemapLayout — the layout mathematics of the D3
 * gallery's "Zoomable treemap" (Observable @d3/zoomable-treemap),
 * ported to TypeScript as a renderer-independent module.
 *
 * The original works like this:
 *
 *   - d3.hierarchy(data).sum(d => d.value).sort(descending by value)
 *   - d3.treemap() with a CUSTOM tiling function: the built-in
 *     binary tiling (d3.treemapBinary) adapted for zooming — each
 *     node's children are first laid out by treemapBinary in the
 *     full [0, 0, width, height] space (928 × 924), then scaled
 *     into the node's own rect. Because every subtree is laid out
 *     in the same full space, a zoomed subtree keeps the aspect
 *     treatment it would have had at the top.
 *   - treemapBinary itself: recursively split the children at the
 *     point where the running sum crosses half the total, cutting
 *     along the longer axis at the value-weighted midpoint, until
 *     each child stands alone in its rect.
 *   - The notebook never calls .size(), so the tree's own rects
 *     live in d3.treemap's default unit square [0, 1]² — only the
 *     binary tiling works in 928 × 924 space, inside the tile.
 *     Zooming sets the x/y scale domains to the clicked node's
 *     extent, so that node's rect fills the chart and everything
 *     else is re-mapped around it; clicking the header band (the
 *     current node drawn above the chart) zooms back out. The
 *     transition runs 750 ms.
 *   - The original colours are monochrome (#fff / #ccc / #ddd).
 *     This module also carries d3.schemeCategory10, because the 3D
 *     viewer colours each leaf by its depth-1 ancestor ("house"),
 *     as Bostock's non-zoomable treemap does — the one deliberate
 *     departure, recorded in the README.
 *
 * What this module adds for the 3D viewer: nothing to the
 * mathematics. Each node carries `current` and `target` rects, as
 * in the sunburst module; a zoom re-maps every node's rect through
 * the focus node's frame (zoomTargets), and the renderer
 * interpolates. See README.md in this directory for provenance.
 */

export interface TreemapData {
  name: string;
  /** Leaf weight; branch nodes usually omit it (their value is summed). */
  value?: number;
  children?: TreemapData[];
}

/** An axis-aligned rect in layout space. */
export interface TreemapRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TreemapNode {
  data: TreemapData;
  name: string;
  /** Summed value (own value plus all descendants). */
  value: number;
  depth: number;
  height: number;
  parent: TreemapNode | null;
  children: TreemapNode[];
  /** This node's rect in the root frame (its position at rest). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Where the rect currently sits (animated by the renderer). */
  current: TreemapRect;
  /** Where the current zoom has sent it. */
  target: TreemapRect;
}

/** The notebook's chart dimensions — the binary tile's working space. */
export const TREEMAP_WIDTH = 928;
export const TREEMAP_HEIGHT = 924;

/**
 * d3.treemapBinary, ported: split `values` (in order) into rects
 * tiling (x0, y0)–(x1, y1). The split point is found by binary
 * search for the running sum nearest half the segment total; the
 * cut runs along the longer axis at the value-weighted midpoint.
 * Returns one rect per value, in order.
 */
export function binaryTileRects(
  values: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): TreemapRect[] {
  const n = values.length;
  const rects: TreemapRect[] = new Array(n);
  const sums: number[] = new Array(n + 1);
  sums[0] = 0;
  for (let i = 0; i < n; i++) sums[i + 1] = sums[i] + values[i];
  const total = sums[n];

  const partition = (
    i: number, j: number, value: number,
    ax0: number, ay0: number, ax1: number, ay1: number,
  ): void => {
    if (i >= j - 1) {
      rects[i] = { x0: ax0, y0: ay0, x1: ax1, y1: ay1 };
      return;
    }
    const valueOffset = sums[i];
    const valueTarget = value / 2 + valueOffset;
    let k = i + 1;
    let hi = j - 1;
    while (k < hi) {
      const mid = (k + hi) >>> 1;
      if (sums[mid] < valueTarget) k = mid + 1;
      else hi = mid;
    }
    if (valueTarget - sums[k - 1] < sums[k] - valueTarget && i + 1 < k) --k;

    const valueLeft = sums[k] - valueOffset;
    const valueRight = value - valueLeft;
    if (ax1 - ax0 > ay1 - ay0) {
      const xk = (ax0 * valueRight + ax1 * valueLeft) / value;
      partition(i, k, valueLeft, ax0, ay0, xk, ay1);
      partition(k, j, valueRight, xk, ay0, ax1, ay1);
    } else {
      const yk = (ay0 * valueRight + ay1 * valueLeft) / value;
      partition(i, k, valueLeft, ax0, ay0, ax1, yk);
      partition(k, j, valueRight, ax0, yk, ax1, ay1);
    }
  };

  if (n > 0) partition(0, n, total, x0, y0, x1, y1);
  return rects;
}

function buildHierarchy(
  data: TreemapData,
  parent: TreemapNode | null,
  depth: number,
): TreemapNode {
  const node: TreemapNode = {
    data,
    name: data.name,
    value: 0,
    depth,
    height: 0,
    parent,
    children: [],
    x0: 0, y0: 0, x1: 0, y1: 0,
    current: { x0: 0, y0: 0, x1: 0, y1: 0 },
    target: { x0: 0, y0: 0, x1: 0, y1: 0 },
  };
  const kids = (data.children ?? []).map((d) => buildHierarchy(d, node, depth + 1));
  // d3's hierarchy.sort: descending by summed value (stable).
  kids.sort((a, b) => b.value - a.value);
  node.children = kids;
  node.value = (data.value ?? 0) + kids.reduce((s, c) => s + c.value, 0);
  node.height = kids.length === 0 ? 0 : 1 + Math.max(...kids.map((c) => c.height));
  return node;
}

/**
 * The notebook's custom tile, recursively: a node's children are
 * laid out by the binary tiling in the full 928 × 924 tile space,
 * then scaled into the node's own rect (in unit space); then each
 * child is tiled in turn (d3's preorder walk).
 */
function tileNode(node: TreemapNode): void {
  if (node.children.length === 0) return;
  const full = binaryTileRects(
    node.children.map((c) => c.value),
    0, 0, TREEMAP_WIDTH, TREEMAP_HEIGHT,
  );
  const w = node.x1 - node.x0;
  const h = node.y1 - node.y0;
  node.children.forEach((child, i) => {
    const r = full[i];
    child.x0 = node.x0 + (r.x0 / TREEMAP_WIDTH) * w;
    child.x1 = node.x0 + (r.x1 / TREEMAP_WIDTH) * w;
    child.y0 = node.y0 + (r.y0 / TREEMAP_HEIGHT) * h;
    child.y1 = node.y0 + (r.y1 / TREEMAP_HEIGHT) * h;
  });
  node.children.forEach((child) => tileNode(child));
}

/** Build the laid-out tree: hierarchy, sums, sort, binary tiling. */
export function buildTreemap(data: TreemapData): TreemapNode {
  const root = buildHierarchy(data, null, 0);
  root.x0 = 0;
  root.y0 = 0;
  root.x1 = 1;
  root.y1 = 1;
  tileNode(root);
  for (const node of descendants(root)) {
    node.current = { x0: node.x0, y0: node.y0, x1: node.x1, y1: node.y1 };
    node.target = { ...node.current };
  }
  return root;
}

/** All nodes under (and including) `node`, preorder. */
export function descendants(node: TreemapNode): TreemapNode[] {
  const out: TreemapNode[] = [];
  const walk = (n: TreemapNode): void => {
    out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

/** The chain from the root down to (and including) `node`. */
export function ancestors(node: TreemapNode): TreemapNode[] {
  const out: TreemapNode[] = [];
  let n: TreemapNode | null = node;
  while (n) {
    out.unshift(n);
    n = n.parent;
  }
  return out;
}

/** The original's name(): ancestors joined with "/". */
export function treemapPath(node: TreemapNode): string {
  return ancestors(node).map((n) => n.name).join("/");
}

/**
 * A zoom, as target rects: re-map every node's own rect through
 * the focus node's frame so the focus rect fills the unit square
 * — the original's scale-domain change, applied to the whole tree.
 * Nodes outside the focus get rects outside the square; renderers
 * clip. Returns the focus node.
 */
export function zoomTargets(root: TreemapNode, focus: TreemapNode): TreemapNode {
  const fx = 1 / (focus.x1 - focus.x0);
  const fy = 1 / (focus.y1 - focus.y0);
  for (const node of descendants(root)) {
    node.target = {
      x0: (node.x0 - focus.x0) * fx,
      y0: (node.y0 - focus.y0) * fy,
      x1: (node.x1 - focus.x0) * fx,
      y1: (node.y1 - focus.y0) * fy,
    };
  }
  return focus;
}

/** Set every node's current rect to its own rect (the rest state). */
export function resetCurrents(root: TreemapNode): void {
  for (const node of descendants(root)) {
    node.current = { x0: node.x0, y0: node.y0, x1: node.x1, y1: node.y1 };
    node.target = { ...node.current };
  }
}

/**
 * The cube form. A node's children are spread across the five
 * open faces of a cube — top, north, east, south, west (the bottom
 * rests) — in their descending order, cut into five contiguous
 * groups balanced by value: each face's quota is the value left
 * when the face starts divided by the faces left, so every face
 * holds a comparable share of the layer's value and rect area
 * stays comparable from face to face. Within a face, the group is
 * tiled with the same binary tiling, in the face's unit square
 * (u eastward as the face is viewed from outside, v down).
 */
export type TreemapCubeFace = "top" | "north" | "east" | "south" | "west";
export const TREEMAP_CUBE_FACES: TreemapCubeFace[] = ["top", "north", "east", "south", "west"];

export interface TreemapCubePiece {
  node: TreemapNode;
  face: TreemapCubeFace;
  /** The piece's rect in its face's unit square. */
  rect: TreemapRect;
}

export function treemapCubeFaces(node: TreemapNode): TreemapCubePiece[] {
  const kids = node.children;
  if (kids.length === 0) return [];
  const total = node.value;
  const groups: TreemapNode[][] = TREEMAP_CUBE_FACES.map(() => []);
  // Balanced contiguous groups: each face's quota is the value
  // remaining when the face starts, divided by the faces left —
  // so one oversized child takes a face to itself (it cannot be
  // split) and the rest still spread evenly over the faces left,
  // instead of leaving a face empty.
  let faceIdx = 0;
  let faceAcc = 0;
  let faceQuota = total / 5;
  let consumed = 0;
  for (const kid of kids) {
    groups[faceIdx].push(kid);
    faceAcc += kid.value;
    consumed += kid.value;
    if (faceIdx < 4 && faceAcc >= faceQuota) {
      faceIdx++;
      faceAcc = 0;
      faceQuota = (total - consumed) / (5 - faceIdx);
    }
  }
  const pieces: TreemapCubePiece[] = [];
  groups.forEach((group, i) => {
    if (group.length === 0) return;
    const rects = binaryTileRects(group.map((c) => c.value), 0, 0, 1, 1);
    group.forEach((kid, j) => {
      pieces.push({ node: kid, face: TREEMAP_CUBE_FACES[i], rect: rects[j] });
    });
  });
  return pieces;
}

/** d3.schemeCategory10, verbatim. */
export const SCHEME_CATEGORY10: string[] = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
];

/** The depth-1 ancestor ("house") a node belongs to (itself at depth ≤ 1). */
export function treemapHouse(node: TreemapNode): TreemapNode {
  let n = node;
  while (n.depth > 1 && n.parent) n = n.parent;
  return n;
}

/** The house colour: an ordinal scale over the root's children, in order. */
export function treemapHouseColor(root: TreemapNode, node: TreemapNode): string {
  const house = treemapHouse(node);
  const idx = root.children.indexOf(house);
  return SCHEME_CATEGORY10[(idx < 0 ? 0 : idx) % SCHEME_CATEGORY10.length];
}
