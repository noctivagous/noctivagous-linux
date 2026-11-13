/**
 * NCTGraphiteSunburstLayout — the layout mathematics of Mike Bostock's
 * "Zoomable sunburst" (Observable @d3/zoomable-sunburst, the D3 gallery
 * sunburst), ported to TypeScript as a renderer-independent module.
 *
 * The original works like this:
 *
 *   - d3.hierarchy(data).sum(d => d.value).sort(descending by value)
 *   - d3.partition().size([2π, hierarchy.height + 1]) — each node gets
 *     an angular span (x0..x1, radians) proportional to its value and a
 *     radial band (y0..y1) equal to its depth, in depth units.
 *   - Clicking a node p re-maps every node's span into p's frame:
 *     target.x = clamp((x − p.x0) / (p.x1 − p.x0)) · 2π,
 *     target.y = max(0, y − p.depth). The clicked node fills the disc;
 *     its parent becomes the centre circle's datum ("click the centre
 *     to climb back out").
 *   - A slice is visible iff y1 ≤ 3, y0 ≥ 1 and x1 > x0 — the disc
 *     shows two rings around the centre at a time.
 *   - Colour: an ordinal scale over quantize(interpolateRainbow,
 *     topLevelCount + 1); a slice takes the colour of its depth-1
 *     ancestor. interpolateRainbow (a cubehelix rainbow) is ported
 *     exactly below, so the palette is the original's, colour for
 *     colour.
 *
 * What this module adds for the 3D viewer: nothing to the mathematics.
 * Each node carries `current` (where its slice is now) and `target`
 * (where the last zoom sent it), as in the original; the renderer
 * interpolates between them and reads heights off `current.y0`.
 * See README.md in this directory for provenance and adaptations.
 */

export interface SunburstData {
  name: string;
  /** Leaf weight; branch nodes usually omit it (their value is summed). */
  value?: number;
  children?: SunburstData[];
}

/** An angular/radial span: x in radians [0, 2π], y in depth units. */
export interface SunburstSlice {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface SunburstNode {
  data: SunburstData;
  name: string;
  /** Summed value (own value plus all descendants). */
  value: number;
  depth: number;
  height: number;
  parent: SunburstNode | null;
  children: SunburstNode[];
  /** This node's own partition span (its position at rest, root frame). */
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Where the slice currently sits (animated by the renderer). */
  current: SunburstSlice;
  /** Where the current zoom has sent it. */
  target: SunburstSlice;
}

const TAU = Math.PI * 2;

function buildHierarchy(
  data: SunburstData,
  parent: SunburstNode | null,
  depth: number,
): SunburstNode {
  const node: SunburstNode = {
    data,
    name: data.name,
    value: 0,
    depth,
    height: 0,
    parent,
    children: [],
    x0: 0,
    x1: 0,
    y0: depth,
    y1: depth + 1,
    current: { x0: 0, x1: 0, y0: depth, y1: depth + 1 },
    target: { x0: 0, x1: 0, y0: depth, y1: depth + 1 },
  };
  // d3.hierarchy().sum(d => d.value): a node's value is its own
  // `value` (defaulting to 0) plus the sum of its children's.
  let value = data.value ?? 0;
  if (data.children) {
    node.children = data.children.map((child) =>
      buildHierarchy(child, node, depth + 1),
    );
    for (const child of node.children) value += child.value;
    node.height =
      node.children.length > 0
        ? 1 + Math.max(...node.children.map((c) => c.height))
        : 0;
  }
  node.value = value;
  return node;
}

/**
 * d3's partition dice: children tile their parent's angular span in
 * proportion to value, in order (children are sorted descending by
 * value before this runs, as in the original).
 */
function dice(node: SunburstNode): void {
  const k = node.value > 0 ? (node.x1 - node.x0) / node.value : 0;
  let x = node.x0;
  for (const child of node.children) {
    child.x0 = x;
    child.x1 = x + child.value * k;
    x = child.x1;
    dice(child);
  }
}

/**
 * Build the laid-out hierarchy for `data`, exactly as the original
 * does: sum, sort children descending by value, partition over
 * [2π, height + 1]. Every node's `current` and `target` start at its
 * own span.
 */
export function buildSunburst(data: SunburstData): SunburstNode {
  const root = buildHierarchy(data, null, 0);
  sortDesc(root);
  root.x0 = 0;
  root.x1 = TAU;
  root.y0 = 0;
  root.y1 = 1;
  dice(root);
  for (const node of descendants(root)) {
    node.current = { x0: node.x0, x1: node.x1, y0: node.y0, y1: node.y1 };
    node.target = { ...node.current };
  }
  return root;
}

function sortDesc(node: SunburstNode): void {
  node.children.sort((a, b) => b.value - a.value);
  for (const child of node.children) sortDesc(child);
}

/** All nodes below (and including) root, in pre-order — d3's descendants(). */
export function descendants(root: SunburstNode): SunburstNode[] {
  const out: SunburstNode[] = [];
  const walk = (n: SunburstNode) => {
    out.push(n);
    for (const child of n.children) walk(child);
  };
  walk(root);
  return out;
}

/** The node's ancestors, root first, itself last — d3's ancestors(). */
export function ancestors(node: SunburstNode): SunburstNode[] {
  const out: SunburstNode[] = [];
  let n: SunburstNode | null = node;
  while (n) {
    out.unshift(n);
    n = n.parent;
  }
  return out;
}

/**
 * The zoom, verbatim from the original's clicked() handler: re-map
 * every node's span into p's frame and store it as its `target`.
 * The centre circle's datum after this zoom is `p.parent || root` —
 * clicking it zooms to that node. Returns that centre node.
 */
export function zoomTargets(root: SunburstNode, p: SunburstNode): SunburstNode {
  const span = p.x1 - p.x0;
  for (const d of descendants(root)) {
    d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / span)) * TAU,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / span)) * TAU,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth),
    };
  }
  return p.parent ?? root;
}

/** The original's visibility rule: two rings around the centre. */
export function arcVisible(d: SunburstSlice): boolean {
  return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
}

/** The original's label rule: visible, with room to hold text. */
export function labelVisible(d: SunburstSlice): boolean {
  return (
    d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03
  );
}

/** Component-wise interpolation between two slices (the zoom tween). */
export function interpolateSlice(
  a: SunburstSlice,
  b: SunburstSlice,
  t: number,
): SunburstSlice {
  return {
    x0: a.x0 + (b.x0 - a.x0) * t,
    x1: a.x1 + (b.x1 - a.x1) * t,
    y0: a.y0 + (b.y0 - a.y0) * t,
    y1: a.y1 + (b.y1 - a.y1) * t,
  };
}

/** The depth-1 ancestor a slice takes its colour from (itself at depth ≤ 1). */
export function colourAncestor(node: SunburstNode): SunburstNode {
  let n = node;
  while (n.depth > 1 && n.parent) n = n.parent;
  return n;
}

// ——— The original's palette: interpolateRainbow, ported exactly ———

const RADIANS = Math.PI / 180;

/** d3-color's cubehelix → rgb conversion, verbatim constants. */
function cubehelixToRgb(h: number, s: number, l: number): [number, number, number] {
  const hr = (h + 120) * RADIANS;
  const a = s * l * (1 - l);
  const cosh = Math.cos(hr);
  const sinh = Math.sin(hr);
  return [
    255 * (l + a * (-0.14861 * cosh + 1.78277 * sinh)),
    255 * (l + a * (0.29227 * cosh - 0.90649 * sinh)),
    255 * (l + a * (1.97294 * cosh)),
  ];
}

/** d3.interpolateRainbow, verbatim. t wraps into [0, 1]. */
export function interpolateRainbow(t: number): [number, number, number] {
  if (t < 0 || t > 1) t -= Math.floor(t);
  const ts = Math.abs(t - 0.5);
  return cubehelixToRgb(360 * t - 100, 1.5 - 1.5 * ts, 0.8 - 0.9 * ts);
}

/**
 * d3.quantize(interpolateRainbow, count): `count` evenly spaced
 * samples of the rainbow, returned as CSS rgb() strings.
 */
export function rainbowPalette(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const [r, g, b] = interpolateRainbow(t);
    const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    out.push(`rgb(${c(r)}, ${c(g)}, ${c(b)})`);
  }
  return out;
}

/**
 * The original's colour scale: an ordinal palette of
 * topLevelCount + 1 rainbow samples; the i-th top-level branch (in
 * the order given) takes the i-th sample. Build the lookup once per
 * dataset: colourOf(node) walks to the depth-1 ancestor, as the
 * original's fill accessor does.
 */
export function sunburstColourScale(
  topLevelNames: string[],
): (node: SunburstNode) => string {
  const palette = rainbowPalette(topLevelNames.length + 1);
  const byName = new Map(topLevelNames.map((name, i) => [name, palette[i]]));
  return (node: SunburstNode) =>
    byName.get(colourAncestor(node).name) ?? "#888888";
}
