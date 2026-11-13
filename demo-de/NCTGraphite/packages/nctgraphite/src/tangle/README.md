# tangle — tangled tree layout

A faithful TypeScript port of Matteo Abrate's `constructTangleLayout`
from the Observable notebook *Tangled tree visualization*
(@nitaku/tangled-tree-visualization-ii; the technique follows
GeneaQuilts — Bezerianos, Dragicevic, Fekete, Bae & Watson, IEEE
TVCG 2010).

A *tangled tree* is a tree with multiple inheritance: the input is
an array of levels of `{ id, parents?: string[] }`. Children
sharing an identical parent set share a **bundle**; links run from
child to parents through the bundle's vertical metro lane with
rounded corners (radius `c`, capped at `bigc` for long spans).

`constructTangleLayout(levels, options)` returns nodes (with x, y,
tick height, bundle memberships), links (metro path points
xt/yt → xb lane → xs/ys with corner radii c1/c2), bundles (lane x,
span, schemeDark2 colour in discovery order), and the layout size.
Renderer-independent: the demo-de page `tangled.html` renders it in
3D (bundle lanes separated in depth) with key-click labels.

Fidelity notes — the port keeps the original's constants, pass
order, vertical-compression pass, and its group-indexing quirk:
each node's bundle *groups* (arrays) carry an `i` assigned after a
span-descending sort, and link yt offsets read that group index.
Verified node-for-node against the original algorithm run on the
notebook's Greek-genealogy data (67 nodes, 25 bundles, 92 links):
every coordinate, tick height, lane position and corner radius
identical.
