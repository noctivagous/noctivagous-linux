# NCTGraphiteTreemapLayout

A renderer-independent TypeScript port of the layout mathematics of
the D3 gallery's **Zoomable treemap** (Observable
@d3/zoomable-treemap, Mike Bostock).

## What was ported

- **Hierarchy**: `d3.hierarchy(data).sum(d => d.value)` and the
  descending-by-value sort, exactly as the notebook builds it.
- **The custom tile**: the notebook's tiling function wraps
  `d3.treemapBinary` — each node's children are laid out by the
  binary tiling in the full 928 × 924 chart space, then scaled into
  the node's own rect. `binaryTileRects` is `treemapBinary`'s
  partition: binary search for the running sum nearest half the
  segment total, cut along the longer axis at the value-weighted
  midpoint, recurse.
- **The unit square**: the notebook never calls `.size()`, so node
  rects live in d3.treemap's default [0, 1]² space; only the binary
  tiling works in 928 × 924. The port keeps both spaces exactly
  where the original has them.
- **Zoom**: the original sets the x/y scale domains to the clicked
  node's extent. `zoomTargets` expresses the same move as target
  rects on every node (the pattern the sunburst module uses), so a
  renderer can interpolate `current → target` over the original's
  750 ms.

## Verification

The port was checked against the real `d3-hierarchy` (v3) running
the notebook's own construction over the notebook's own
flare-2.json: **all 252 nodes' rects and values are bit-identical**
(max delta 0), children tile every parent exactly, and a zoom sends
the focus rect to the full unit square while outside nodes map
wholly outside it.

## The cube distribution

`treemapCubeFaces` serves the cube viewer: a node's children are
spread across a cube's five open faces (top, north, east, south,
west) as five contiguous groups balanced by value — each face's
quota is the value remaining when the face starts divided by the
faces left, so an oversized child takes a face to itself and the
rest still spread evenly. Each group is tiled with
`binaryTileRects` in its face's unit square. Verified headlessly:
every child appears exactly once, every used face tiles fully,
descending order and face order are preserved, and flare's root
layer uses all five faces.

## The one departure

The original is monochrome (root #fff, branches #ccc, leaves #ddd).
The module also exports `SCHEME_CATEGORY10` (d3's, verbatim) and
`treemapHouseColor`, colouring each node by its depth-1 ancestor —
the convention of Bostock's non-zoomable treemap — because the 3D
viewer needs the houses distinguishable at a glance. The layout
mathematics are untouched by this; it is a colour choice, made in
the open.

## Provenance

Notebook module read firsthand at observablehq.com/@d3/zoomable-treemap
(compiled module via api.observablehq.com); dataset is the
notebook's flare-2.json attachment, the same file demo-de already
carries for the sunburst (src/sunburst-data.js).
