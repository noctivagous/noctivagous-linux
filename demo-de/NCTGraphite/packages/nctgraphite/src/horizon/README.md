# Realtime horizon (activity lanes)

A renderer-independent port of the machinery of the D3 gallery's
**"Realtime horizon chart"** (Observable `@d3/realtime-horizon-chart`),
one of the Flat UI frames named in the noctivagous-linux framing
document `d3-js-uses.txt` ("Realtime horizon chart — activity
monitor contexts").

## What is ported, and how faithfully

Read from the notebook's own module source:

- **The walk** — `walk(v) = max(0, min(1, v + (random − 0.5) · 0.05))`,
  verbatim, with the source of chance injected so demos and tests
  are reproducible (mulberry32).
- **The banding** — a strip of height `step` shows `bands` layers of
  the value range stacked by translation: band i is the column
  translated down by (i + 1) · step. `horizonY` is the original's
  y scale (range [0, −bands · step], domain [0, 1]); `horizonBandFill`
  is the per-band filled height that translation produces.
- **The colours** — the band colour rule
  `scheme[max(3, bands)][i + max(0, 3 − bands)]`, verbatim, with
  d3's schemeGreens (the notebook's default) and schemeBlues values
  carried over exactly.
- **The update** — every tick, each series shifts left by one sample
  and appends a new walk step (`copyWithin` + append, as in the
  original's generator loop).

## Adaptations for the activity-monitor frame

- **Named lanes.** The original plots twenty anonymous random walks
  labelled "0"…"19". An activity monitor's whole point is to say
  what is going on, so the series here are labelled channels —
  network in/out, disk read/write, memory, swap, processor,
  graphics — each with its own baseline, volatility and burstiness,
  and a formatter that turns the normalized value into its unit
  (Mb/s, IOPS, %). The pure original walk is recovered with
  baseline-pull 0, volatility 1, burst 0; the page's walks are
  tempered so a lane reads like the quantity it names (memory sits
  high and drifts slowly; swap idles near zero and spikes).
- **Synthetic data, honestly.** The lanes are simulations. In the
  distribution they bind to real counters; in demo-de they let the
  frame be judged anywhere, and the page says so.
- **Rendering.** The original paints to canvas with a drawImage
  self-shift so only new columns are drawn. This module stays
  renderer-independent; the demo page redraws each strip canvas per
  tick (strips are short and few), which is visually identical.
- **Step.** The original's strip height is 29 px and its period
  250 ms; both are parameters of the frame, set on the page.
- **The 3D form.** `horizonReliefGeometry` stands the chart up:
  each time column becomes a stack of band segments (terraces),
  each segment wearing its band's colour, so a lane renders as a
  terraced skyline — magnitude read as height and as depth of
  colour at once. Renderer-independent (positions + per-vertex
  colours out), used by demo-de's horizon3d.html under an isometric
  camera by default (perspective a parameter away). The page makes
  the tape really travel: it builds the geometry from the newest
  samples one column per sample, slides the mesh one column-depth
  toward the back between ticks, and the tick's rebuild lands
  exactly where the slide left it.
