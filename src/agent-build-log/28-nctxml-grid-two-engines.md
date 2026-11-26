# 28 — NCTXML Grid: our own grid model, two engines

Date: 2026-11-26. Asked by: the owner — NCTXML layout
conventions first (rec on the post-breadth board), with the
owner's correction that the grid systems were already
described in the repo (NCTGraphite) and the direction to build
a GDExtension engine alongside a solver engine, compare them,
and allow both. Worktree: ~/workspace/noctivagous-linux-slice1,
branch feat/nctxml-grid off main eb12d0f.

## The semantics are a port, not an invention

Source model (demo-de/NCTGraphite, the user's 2026-11-13 grid
direction): NCTGraphiteGrid (track strings, named areas via
template, ordered breakpoints with a per-field cascade),
NCTGraphiteBaseline (a line unit + offset — a GUIDE only),
AppShell's proportion (track list or weight array). The two
gaps the repo's own audit names — no proportion system beyond
that prop, no baseline snapping API — are the two things this
build adds, as NCTXML conventions:

- Tracks: "220px 1fr 300px" — fixed px, Nfr (float weights,
  so 1.618fr is a golden split), fill = 1fr, hug/auto =
  min-content; a bare integer means that many 1fr tracks.
  Proportions="1 2 1" is the weight-array form, ported.
- Areas="'nav main' 'nav foot'" + Area / Column / Row /
  ColumnSpan / RowSpan placement, travelling as child
  metadata (the Dock channel), read identically by both
  engines. Unpinned children auto-flow row-major.
- Baseline="24" (+ offset): row pitches quantize to whole
  units, gap inside the pitch, fr rows trimmed/grown by
  whole units — row tops sit on the rhythm. This is the
  snapping API, in the layout engine rather than a guide.
- Breakpoints="700:200px 1fr; ...": the last entry at/below
  the width wins per field (the source cascade) — measured
  against the GRID'S OWN width, a deliberate porting
  difference: NCTGraphite keys on the viewport, but an
  NCTXML host ranges from a full window to a small pane, so
  the grid is a container query. §7's device classes remain
  the viewport-level mechanism, separate and unbuilt.

## Two engines, one surface

- Solver: nctxml/NctGridContainer.cs (C# Container, sibling
  of DockContainer). Default. No toolchain beyond dotnet.
- Native: NctGridNative, a GDExtension in C++
  (src/modules/gdextension/, godot-cpp tag godot-4.5-stable —
  GDExtension libraries are forward-compatible, so it loads
  on the pinned 4.7.2 runtime; the built library is committed
  at src/modules/bin/, the godot-cpp clone is not).
- Engine="native" on a <Grid> selects the native class; where
  the extension is not loaded, the factory falls back to the
  solver, so documents render everywhere.
- Placement/spec plumbing is engine-neutral: the registry
  factory hands the native class its spec through one
  set_grid_spec call; the renderer consumes the spec and
  placement attributes for both engines alike.

## Evidence (all rects measured, per the layout rule)

- NCTGRID_OK — the solver on four documents: named areas
  with spans over fixed/fr tracks; baseline pitches
  48/72/24 from content heights 30/50/10 on a 24-unit rhythm;
  the breakpoint flipping 1 column → 200px+1fr at the grid's
  own 700px; proportions 1:2:1 → 100/200/100 at 400px.
- GRID_COMPARE_OK — the same four documents at three sizes
  each through BOTH engines: every named child's rect agrees
  within 0.05px. Stress grid, 2000 cells, 60 forced refits:
  solver 114,212 µs/fit, native 47,045 µs/fit — the native
  engine is ~2.4x faster per pass at that scale; both are
  dominated by the per-child minimum-size walk they share.
  At realistic pane sizes (tens of children) both are far
  under a millisecond's relevance; the difference buys
  headroom for very large grids, not everyday UI.

## Findings worth keeping

- GDExtension discovery needs .godot/extension_list.cfg,
  an editor-scan artefact: a bare checkout does not load ANY
  extension until the project has been imported once (or the
  file written). Silent — no error, the class simply does
  not exist. The file now exists in this worktree's .godot/
  (generated state, not committed); any fresh checkout that
  wants the native engine must import once. The solver
  fallback is what makes this safe rather than fatal.
- String::split in godot-cpp takes ONE literal delimiter;
  the C# Split takes a char set. The proportions parse
  differed (one token instead of three) and the comparison
  harness caught it — the port's semantics now normalise
  commas first. This is the class of bug the two-engines
  comparison exists to catch.
- The native build is slow once (godot-cpp, ~15 min on this
  sandbox) and seconds incrementally; build.sh re-clones and
  rebuilds. Committing the .so keeps checkouts toolchain-free.

## What this does not show

- The comparison runs on Linux x86_64 only; other platforms
  need their own library builds before Engine="native" means
  anything there (until then: solver, by fallback).
- Device-class property overrides (§7) are designed into the
  plan but not built; the modes work owns them.
- Box stays an HBox/VBox alias, as registered in Slice 2;
  the XUL pack/fill semantics are not separately built.
- NCTGraphite's cell-geometry grids (hex/triangle) were
  deliberately not ported — they are the data layer's, for
  diagrams, not app layout.
