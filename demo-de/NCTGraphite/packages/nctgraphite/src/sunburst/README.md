# Sunburst layout (zoomable)

A renderer-independent port of the layout mathematics of Mike
Bostock's **"Zoomable sunburst"** — the D3 gallery sunburst
(Observable `@d3/zoomable-sunburst`), one of the ZUI viewers named in
the noctivagous-linux framing document `d3-js-uses.txt`.

## What is ported, and how faithfully

Read from the notebook's own module source and carried over
construct for construct:

- **Hierarchy** — `d3.hierarchy(data).sum(d => d.value)` (a node's
  value is its own `value`, default 0, plus its children's sums),
  children sorted descending by value.
- **Partition** — `d3.partition().size([2π, height + 1])`: each
  node's children dice its angular span in proportion to value; its
  radial band is its depth, in depth units.
- **Zoom** — the `clicked()` handler's re-mapping, verbatim: every
  node's target span is clamped and rescaled into the clicked node's
  frame; radial bands shift up by the clicked node's depth. The
  centre circle's datum (the node a centre click zooms to) is the
  clicked node's parent, or the root.
- **Visibility** — `arcVisible`: `y1 ≤ 3 && y0 ≥ 1 && x1 > x0` (two
  rings around the centre); `labelVisible` adds the original's area
  threshold, `(y1 − y0) · (x1 − x0) > 0.03`.
- **Colour** — `d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow,
  n + 1))`, with a slice coloured by its depth-1 ancestor.
  `interpolateRainbow` is ported exactly, including d3-color's
  cubehelix→rgb constants, so the palette matches the original's
  colour for colour.

## Adaptations for the 3D viewer

- Nodes carry `current` and `target` spans (as the original's
  tweens do) but the interpolation lives here
  (`interpolateSlice`) rather than in a DOM transition, so any
  renderer can drive it.
- The original's sub-pixel arc padding (`padAngle`, `padRadius`,
  the 1-unit outer-radius shave) is the renderer's business in 3D;
  the viewer applies a small angular pad and radial gap in world
  units instead.
- In the original only branch arcs are clickable. In the 3D viewer,
  key-clicking a leaf selects it for the readout without zooming —
  leaves are endpoints, and the key-click environment must be able
  to *address* everything it shows. Branch keys descend; Esc climbs
  to the centre node's target, as a centre click does in 2D.
- The demo dataset is the notebook's own `flare-2.json` (the Flare
  class hierarchy, 252 nodes), copied verbatim into
  `demo-de/src/sunburst-data.js`.
