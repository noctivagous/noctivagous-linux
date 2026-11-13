/**
 * Tangled tree layout — a faithful TypeScript port of Matteo
 * Abrate's `constructTangleLayout` from the Observable notebook
 * "Tangled tree visualization" (@nitaku/tangled-tree-visualization-ii),
 * itself an implementation of the GeneaQuilts idea (Bezerianos et
 * al., IEEE TVCG 2010): a tree with multiple inheritance — a
 * *tangled tree* — drawn as levels of nodes with metro-style
 * bundled links.
 *
 * Data model: the input is an array of levels; each level is an
 * array of `{ id, parents?: string[] }`. Nodes whose parent set is
 * identical share a *bundle*; links run from a child up to its
 * parents through the bundle's vertical lane, with rounded corners
 * (radius c, or bigc for long spans).
 *
 * The port keeps the original's constants, pass order, and its
 * group-indexing quirk (each node's bundle *groups* carry an `i`
 * assigned after a span sort; link offsets read it). It is verified
 * node-for-node against the original algorithm on the notebook's
 * Greek-genealogy data.
 * Renderer-independent: plain coordinates out.
 */

export interface TangleInputNode {
  id: string;
  parents?: string[];
}

export interface TangleBundle {
  id: string;
  parents: TangleNode[];
  level: number;
  span: number;
  i: number;
  x: number;
  y: number;
  links: TangleLink[];
  /** schemeDark2 colour, assigned in bundle discovery order. */
  color: string;
}

/**
 * A group of bundles sharing one parent-set id, as stored in a
 * node's bundlesIndex. The original hangs an `i` property on the
 * array itself — the group's position in the node's span-sorted
 * bundle list — and link offsets read it. Kept, typed.
 */
export type TangleBundleGroup = TangleBundle[] & { i?: number };

export interface TangleNode {
  id: string;
  parents: TangleNode[];
  level: number;
  x: number;
  y: number;
  /** Tick length: grows with the number of bundle groups it feeds. */
  height: number;
  bundle?: TangleBundle;
  bundles: TangleBundleGroup[];
  bundlesIndex: Record<string, TangleBundleGroup>;
}

export interface TangleLink {
  source: TangleNode;
  target: TangleNode;
  bundle: TangleBundle;
  /** Target (parent) point. */
  xt: number;
  yt: number;
  /** Bundle lane point. */
  xb: number;
  yb: number;
  /** Source (child) point. */
  xs: number;
  ys: number;
  /** Corner radii at the bundle lane's top and bottom. */
  c1: number;
  c2: number;
}

export interface TangleLayoutResult {
  levels: TangleNode[][];
  nodes: TangleNode[];
  nodesIndex: Record<string, TangleNode>;
  links: TangleLink[];
  bundles: TangleBundle[];
  layout: {
    width: number;
    height: number;
    nodeHeight: number;
    nodeWidth: number;
    bundleWidth: number;
    levelYPadding: number;
    metroD: number;
  };
}

export interface TangleLayoutOptions {
  /** Corner radius. Original default 16. */
  c?: number;
  /** Corner radius cap for long spans. Default nodeWidth + c. */
  bigc?: number;
}

/** d3.schemeDark2, in order. */
export const TANGLE_PALETTE = [
  "#1b9e77", "#d95f02", "#7570b3", "#e7298a",
  "#66a61e", "#e6ab02", "#a6761d", "#666666",
];

const minOf = <T,>(xs: T[], f: (x: T) => number): number | undefined => {
  let m: number | undefined;
  for (const x of xs) {
    const v = f(x);
    if (v !== undefined && !Number.isNaN(v) && (m === undefined || v < m)) m = v;
  }
  return m;
};
const maxOf = <T,>(xs: T[], f: (x: T) => number): number => {
  let m = -Infinity;
  for (const x of xs) m = Math.max(m, f(x));
  return m;
};

export function constructTangleLayout(
  inputLevels: TangleInputNode[][],
  options: TangleLayoutOptions = {},
): TangleLayoutResult {
  // Deep clone, as the notebook's renderChart does (_.cloneDeep).
  const levelsIn: TangleInputNode[][] = JSON.parse(JSON.stringify(inputLevels));

  const levels: TangleNode[][] = levelsIn.map((l) =>
    l.map((n) => ({
      id: n.id,
      parents: [] as TangleNode[],
      level: 0,
      x: 0,
      y: 0,
      height: 0,
      bundles: [] as TangleBundleGroup[],
      bundlesIndex: {} as Record<string, TangleBundleGroup>,
      _parentIds: n.parents,
    })),
  ) as unknown as TangleNode[][];
  const raw = levels as unknown as Array<Array<TangleNode & { _parentIds?: string[] }>>;

  // precompute level depth
  levels.forEach((l, i) => l.forEach((n) => (n.level = i)));

  const nodes: TangleNode[] = levels.reduce<TangleNode[]>((a, x) => a.concat(x), []);
  const nodesIndex: Record<string, TangleNode> = {};
  nodes.forEach((d) => (nodesIndex[d.id] = d));

  // objectification
  raw.flat().forEach((d) => {
    d.parents = (d._parentIds === undefined ? [] : d._parentIds).map((p) => nodesIndex[p]);
    delete d._parentIds;
  });

  let colorIdx = 0;
  const levelBundles: TangleBundle[][] = [];

  // precompute bundles
  levels.forEach((l, i) => {
    const index: Record<string, TangleBundle> = {};
    l.forEach((n) => {
      if (n.parents.length === 0) return;
      const id = n.parents.map((d) => d.id).sort().join("-X-");
      if (id in index) {
        index[id].parents = index[id].parents.concat(n.parents);
      } else {
        index[id] = {
          id,
          parents: n.parents.slice(),
          level: i,
          span: i - Math.min(...n.parents.map((p) => p.level)),
          i: 0, x: 0, y: 0, links: [],
          color: TANGLE_PALETTE[colorIdx++ % TANGLE_PALETTE.length],
        };
      }
      n.bundle = index[id];
    });
    const bundles = Object.keys(index).map((k) => index[k]);
    bundles.forEach((b, bi) => (b.i = bi));
    levelBundles.push(bundles);
  });

  const links: TangleLink[] = [];
  nodes.forEach((d) => {
    d.parents.forEach((p) =>
      links.push({
        source: d, bundle: d.bundle as TangleBundle, target: p,
        xt: 0, yt: 0, xb: 0, yb: 0, xs: 0, ys: 0, c1: 0, c2: 0,
      }),
    );
  });

  const bundles: TangleBundle[] = levelBundles.reduce<TangleBundle[]>((a, x) => a.concat(x), []);

  // reverse pointer from parent to bundles
  bundles.forEach((b) =>
    b.parents.forEach((p) => {
      if (p.bundlesIndex === undefined) p.bundlesIndex = {};
      if (!(b.id in p.bundlesIndex)) p.bundlesIndex[b.id] = [];
      p.bundlesIndex[b.id].push(b);
    }),
  );

  nodes.forEach((n) => {
    if (n.bundlesIndex !== undefined && Object.keys(n.bundlesIndex).length > 0) {
      n.bundles = Object.keys(n.bundlesIndex).map((k) => n.bundlesIndex[k]);
    } else {
      n.bundlesIndex = {};
      n.bundles = [];
    }
    n.bundles.sort(
      (a, b) =>
        maxOf(b, (d) => d.span) - maxOf(a, (d) => d.span),
    );
    // The original indexes the bundle *groups* (the arrays
    // themselves carry `i`), not the bundles — link yt offsets
    // read the group's i. Replicated deliberately.
    n.bundles.forEach((group, gi) => (group.i = gi));
  });

  links.forEach((l) => {
    l.bundle.links.push(l);
  });

  // layout
  const padding = 8;
  const nodeHeight = 22;
  const nodeWidth = 70;
  const bundleWidth = 14;
  const levelYPadding = 16;
  const metroD = 4;
  const minFamilyHeight = 22;

  const c = options.c || 16;
  const bigc = options.bigc || nodeWidth + c;

  nodes.forEach((n) => (n.height = (Math.max(1, n.bundles.length) - 1) * metroD));

  let xOffset = padding;
  let yOffset = padding;
  levels.forEach((l, li) => {
    xOffset += levelBundles[li].length * bundleWidth;
    yOffset += levelYPadding;
    l.forEach((n) => {
      n.x = n.level * nodeWidth + xOffset;
      n.y = nodeHeight + yOffset + n.height / 2;
      yOffset += nodeHeight + n.height;
    });
  });

  let i = 0;
  levels.forEach((l, li) => {
    levelBundles[li].forEach((b) => {
      b.x =
        maxOf(b.parents, (d) => d.x) +
        nodeWidth +
        (levelBundles[li].length - 1 - b.i) * bundleWidth;
      b.y = i * nodeHeight;
    });
    i += l.length;
  });

  links.forEach((l) => {
    l.xt = l.target.x;
    l.yt =
      l.target.y +
      ((l.target.bundlesIndex[l.bundle.id] as TangleBundleGroup).i ?? 0) * metroD -
      (l.target.bundles.length * metroD) / 2 +
      metroD / 2;
    l.xb = l.bundle.x;
    l.yb = l.bundle.y;
    l.xs = l.source.x;
    l.ys = l.source.y;
  });

  // compress vertical space
  let yNegativeOffset = 0;
  levels.forEach((l, li) => {
    const m = minOf(levelBundles[li], (b) =>
      minOf(b.links, (link) => link.ys - 2 * c - (link.yt + c)) as number,
    );
    yNegativeOffset += (-minFamilyHeight + (m as number)) || 0;
    l.forEach((n) => (n.y -= yNegativeOffset));
  });

  // very ugly, I know (the source's words — second yt pass)
  links.forEach((l) => {
    l.yt =
      l.target.y +
      ((l.target.bundlesIndex[l.bundle.id] as TangleBundleGroup).i ?? 0) * metroD -
      (l.target.bundles.length * metroD) / 2 +
      metroD / 2;
    l.ys = l.source.y;
    l.c1 =
      l.source.level - l.target.level > 1
        ? Math.min(bigc, l.xb - l.xt, l.yb - l.yt) - c
        : c;
    l.c2 = c;
  });

  const layout = {
    width: maxOf(nodes, (n) => n.x) + nodeWidth + 2 * padding,
    height: maxOf(nodes, (n) => n.y) + nodeHeight / 2 + 2 * padding,
    nodeHeight,
    nodeWidth,
    bundleWidth,
    levelYPadding,
    metroD,
  };

  return { levels, nodes, nodesIndex, links, bundles, layout };
}
