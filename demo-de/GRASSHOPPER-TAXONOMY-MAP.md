# Grasshopper's element taxonomy, mapped to our modules

Written 2026-11-13 for demo-de (noctivagous-linux). Purpose: the
project wants *computational design elements in the UI* — the kind
of elements one sees in Rhino's Grasshopper — not any one geometry
library. This note lays out Grasshopper's element taxonomy and maps
each element to what already exists in the two vendored libraries in
this directory (`NCTGraphite/`, `paramorphic-components/`) and in
demo-de itself, marking each as **have**, **partial**, **gap**, or
**different by design**.

Inspected firsthand: `NCTGraphite/packages/nctgraphite/src/`
(parameters, grid, utilities/graphics, panelization, components),
`paramorphic-components/src/framework/` (relations.ts,
morphs/relation-defs.ts, derivation.ts, tilings.ts, app-kit,
graph-kernel.ts, export/), demo-de's React shell and vanilla demo.

---

## 1. The taxonomy in brief

Grasshopper is a canvas holding a *definition*: typed objects wired
together, re-solving live whenever anything upstream changes.

**Canvas-level objects**

| Element | What it is |
| --- | --- |
| Component | A box with named input ports (left) and output ports (right) that transforms data/geometry. |
| Wire | A visible connection output → input; the dataflow is read off the canvas. Wire display can be default / faint / hidden. |
| Group | A coloured region collecting objects; purely organisational. |
| Scribble | Free text annotation on the canvas. |
| Cluster | A sub-definition packaged as one reusable component (the "user object"). |
| Remote Control Panel (RCP) | A publishable panel of a definition's controls, usable while the canvas is closed. |
| Solution / solve | The evaluation pass; changing a value *expires* everything downstream and recomputes it. Preview can be toggled per component; *Bake* writes geometry into the document permanently. |

**Parameter & control objects** (the leaves of every definition)

| Element | What it holds / does |
| --- | --- |
| Number Slider | A float in a range, the iconic Grasshopper control. |
| Boolean Toggle | True/false switch. |
| Value List | Pick one of named options. |
| Panel | Multiline text: user notes *and* the live readout of whatever is wired into it. |
| Control Knob | A rotary float control. |
| Digit Scroller | Precise stepped number entry. |
| Graph Mapper | A curve (bezier/graph types) remapping a numeric range — a function you draw. |
| Gradient | A colour gradient as a mappable function. |
| Colour Swatch | A colour value. |
| MD Slider | A 2D point picked on a pad. |
| Image Sampler | Sample an image's pixels as data (fields from pictures). |
| Data Dam | A gate that holds data until released — manual control of solve timing. |
| Data Recorder | Records a stream of values over time into a list. |
| Geometry params | Point / Vector / Plane / Curve / Surface / Brep / Mesh / Box parameters — hold *references* to geometry, or values internalised into the file. |

**Component tabs** (the verbs)

| Tab | Representative contents |
| --- | --- |
| Params | The parameter objects above, plus primitive types (number, integer, boolean, text, colour, domain/range). |
| Maths | Operators, trigonometry, polynomials, **Expression** and **script components** (C# / Python code as a component with typed ports). |
| Sets | List surgery (item/list length/shift/cull/dispatch/weave/stream), sequences (series, range, random), text tools, and the **data tree** tools (flatten, graft, simplify, path mapper). |
| Vector | Point/vector construction, attractors in spirit (point charge **fields** live here in spirit via Field components), planes, point grids. |
| Curve | Divide, offset, fillet, join, curve frames, loft inputs (curve through points). |
| Surface | Loft, sweep, revolve, pipe, extrude, offset, isotrim, surface grids, paneling-style subdivision. |
| Mesh | Mesh from surface/brep, triangulate, quad mesh, weld/smooth, mesh colours. |
| Intersect | Booleans, splits, trims, regions. |
| Transform | Move/rotate/scale/mirror, linear & polar arrays, orient on surface. |
| Display | Custom preview (coloured/shaded output), text tags, point lists — how results are *shown*. |

**The data model — the part that is actually Grasshopper**

Values flow as **items, lists, or data trees**: a tree is a set of
branches addressed by paths like `{0;2}`, one branch per "instance"
of the operation. Components match inputs by list/tree rules
(longest-list matching, grafting to branch per item, flattening to
merge). Most of Grasshopper's power — and its learning curve — is
this tree model, not the geometry.

---

## 2. The mapping

| Grasshopper element | Ours | Status |
| --- | --- | --- |
| Number Slider | NCTGraphite `NCTParameterDefinition` type `number` (min/max/step) rendered by `NCTParameterPanel` as a range input (`parameters/NCTGraphiteParameters.tsx`); also paramorphic `PortDef` min/max/step on relation ports, and port-generated sliders in the supershape app | **have** |
| Boolean Toggle | `NCTParameterDefinition` type `boolean` | **have** |
| Value List | `NCTParameterDefinition` type `select`; `PortDef.options` | **have** |
| Panel (readout of a wire) | Nothing renders "the current value flowing on this connection". NCTGraphite panels show parameters, not wire data. | **gap** |
| Control Knob / Digit Scroller | — | **gap** (minor) |
| Graph Mapper (drawn function) | — (rule-chains in paramorphic map values through declared rule sets, but nothing drawn/editable as a curve) | **gap** |
| Gradient / Colour Swatch | Themes exist (NCTGraphite theme tokens; paramorphic classic CSS), but no colour-as-data parameter that flows through a definition | **gap** |
| MD Slider (2D pad) | — (the panelization swarm's attractors are 2D points, but not exposed as a pad control) | **gap** |
| Image Sampler | — | **gap** |
| Data Dam / Data Recorder | — (`path.ride` + traversal triggers record events in a ride, a distant cousin of the recorder) | **gap** |
| Geometry params (geometry as a wire value) | Paramorphic `PortType` includes `point`, `points`, `range`, `bbox` — geometry *does* flow on relation bindings. NCTGraphite parameters are scalar-only (number/boolean/string). A surface is not yet a portable value: panelization takes its surface as a constructor argument, not a wired input. | **partial** |
| Component (ports in/out, one evaluate) | Paramorphic **Relations**: `RelationDef` { id, label, inputs: PortDef[], outputs: PortDef[], evaluate } in a registry (`framework/relations.ts`), instantiated as bindings in plans | **have** |
| Component library / tabs | Registered defs today: `bezier.cubic`, `bezier.pointAt`, `path.ride`, `sheet.formula`, `supershape.polar` (`framework/morphs/relation-defs.ts`) — a seed set, no tab organisation yet | **partial** |
| Wires | Relation *bindings* are wires as data (plan JSON), and the GUI builder has a wireframe/layout layer; there is no end-user canvas where wires are drawn and edited as the primary act | **partial** |
| Solution / solve with expiry | Paramorphic `evaluateItems` — Kahn topological order with failure/cycle **quarantine** (the bad item is isolated, the rest still solve) — plus `derivation.ts` (`orderForRecalc`, `recomputeDerived`) from the spreadsheet, its conformance case. NCTGraphite parameters are plain React state (host re-renders; no expiry graph) | **have** (engine), **partial** (as a user-facing solve model) |
| Expression / script component | `sheet.formula` is exactly this shape: a dynamic relation whose ports come from the formula's references | **have** (one instance) |
| Data trees | Nothing: no branch paths, no graft/flatten, no tree-typed port. Ports carry single values or flat lists (`points`). | **gap — the big one** |
| List/sequence ops (Sets tab) | Scattered: traversal cursors, rule-sets/rule-chains, grid `sampleLattice`; no list-surgery component set | **partial** |
| Curve components | `bezier.cubic` / `bezier.pointAt` relations; nibglider-grade curve machinery exists in other repos but not in these copies | **partial** |
| Surface components (loft etc.) | Panelization builds a lofted funnel per panel and a NURBS surface evaluator (`panelization/NCTGraphiteNurbsSurface.ts`); no general loft/sweep/extrude component set | **partial** |
| Mesh components | Panelization emits a triangle mesh (positions/indices/colors); metaball fields contour via d3-contour (`utilities/graphics/metaballField.ts`); `hull.ts` (convex/concave) | **partial** |
| Tessellation / paneling | NCTGraphite grid geometry: square / hex / triangle tessellations with adjacency + hit-testing (`grid/NCTGraphiteGridGeometry.ts`); paramorphic `tilings.ts` (axial/offset conversions, distances); the panelization hex-panel field itself | **have** |
| Fields (Vector tab) | `utilities/graphics/vectorField.ts` (lattice + inverse-square interpolation), metaball scalar fields, Perlin stamps | **have** |
| Transform components | Viewport transforms (`grid/NCTGraphiteViewport.ts`); graph-kernel tree/occupancy ops are structural, not geometric transforms | **partial** |
| Display / preview | Three.js view for panelization (demo-de), `GuiRenderer` in paramorphic app-kit, NCTGraphite components for layout (Grid, ColumnGuides, Baseline, Overlay) | **partial** |
| Groups / Scribbles | GUI documents (`app-kit/gui-document.ts`) have nodes and layout; no free annotation/grouping layer for definitions | **gap** (minor) |
| Clusters / user objects | **Morph plans** are the analog: named, reusable, parameterised definition fragments applied by scope (paramorphic `morph-plans/*.json`, plan-kits) — but they package *transformations of a document*, not wire-level sub-definitions | **different by design** |
| Remote Control Panel | `NCTParameterPanel` *is* an RCP in embryo: a definition's controls rendered away from its graph | **partial** |
| Bake | Paramorphic's **exporter** (E0–E3: emitted standalone code + diagnostics manifest) is bake-as-code-generation — arguably stronger than bake-into-document | **different by design** |
| Physics / Kangaroo (plugin layer) | The panelization swarm + tension anchors are a small physics core (iGeo dynamics); no constraint solver | **partial** |

---

## 3. What the gaps mean, ranked for demo-de

1. **Data trees.** Grasshopper without trees is a calculator with
   nice sliders. If demo-de definitions ever drive *fields* of
   things (665 panels!), the tree — one branch per panel, per row,
   per attractor — is how a definition stays writable. Our flat
   `points` port type is the seed; paths `{panel}` / `{row;panel}`
   would be the growth.
2. **Wire readouts (Panel-on-a-wire).** The cheapest element with
   the highest atmosphere-per-effort: every wire can show what is
   flowing on it. It is also pure Evangelion — dense live readouts —
   and it is what makes a definition *legible* while it runs.
3. **A canvas that hosts definitions.** Today each demo is a fixed
   page. The Grasshopper move is one canvas, many definitions, with
   wires drawn and edited directly — which is also, verbatim, the
   "Wiring Up The Windows" thesis at component scale.
4. **Geometry as a wired value** (surface/curve params). The
   panelization takes its surface by construction; Grasshopper
   would wire Surface → Panelize → Preview. Making
   `NCTGraphiteNurbsSurface` a `PortType` is a small, high-leverage
   step.
5. **Graph Mapper & friends** (knob, MD pad, gradient): the drawn-
   function controls are Grasshopper's most tactile elements and
   would give the FUD surfaces their distinctive instrument feel.

## 4. Fit with key-click / bimodal control

Grasshopper's canvas is mouse-first, but its *ontology* is
key-click friendly: every element is discrete, labelled, and
port-structured; a wire is a relation between two named ports, not
a gesture. A definition can therefore be navigated and operated as
a labelled field of targets (the nctos window-label model), and
wiring can be a two-target operation — select port, select port —
rather than a drag. This is the same foundation as nibglider,
Floating Marker, and KeyPilot, applied to definitions.

## 5. Suggested first build (unchanged from the earlier proposal)

A definition strip in demo-de's React page, drawn in SVG/d3:
slider/toggle/select parameter nodes (NCTGraphite definitions)
wired into a **Panelization** component (a relation def wrapping
`PanelizationSimulation`, surface exposed as a wired geometry
input), output wire to the three.js preview, and a readout panel on
the output wire showing live counts (panels pushed, mean |dir|).
It exercises rows: sliders/toggles/value lists, component+ports,
wires-as-data, solve-on-change, geometry-as-value, wire readout,
and preview — seven taxonomy rows in one small slice.

---

## Addendum — gap-closing build, 2026-11-13

The definition canvas (`definition.html`, `src/DefinitionApp.jsx`) now
exercises every ranked gap from §3, built from the vendored resources:

1. **Data trees — closed at the model level.** New module
   `NCTGraphite/packages/nctgraphite/src/datatree/NCTGraphiteDataTree.ts`:
   branch paths `{0;2}`, `makeDataTree` / `groupToTree`, `flattenTree`,
   `graftTree`, `simplifyTree`, `mapTree`, `treeStats` (13 headless
   checks pass; strict tsc clean). The panelization's MESH output is a
   tree of per-panel |dir| values, one branch per panel row, and a
   TREE OP node reshapes it on the wire to the readout. Still open:
   tree-typed *ports* in paramorphic Relations, and list-matching
   rules between mismatched trees.
2. **Wire readouts — closed for this definition.** The Panel node
   shows the live MESH summary and the tree's shape (paths, branch
   sizes, per-branch means) as it flows.
3. **Canvas hosting definitions — closed at the first level.** Nodes
   drag by their title bars; wires follow; click an output port then
   an input port to rewire; click a wired input to unwire (input
   falls back to its component default). Still open: adding/removing
   nodes from a palette, saving/loading definitions as files.
4. **Geometry as a wired value — closed.** The SHEET component
   evaluates SURFACE/ARCH into an `NCTGraphiteNurbsSurface` value
   carried on a (violet) wire into Panelization's SURFACE input.
   Still open: a general `surface` PortType in paramorphic Relations.
5. **Drawn controls — mapper and pad closed; knob/gradient open.**
   A Graph Mapper (cubic bezier, draggable control points) remaps
   the REACH wire; an MD pad places the swarm's point attractor live
   in (u, v). Control Knob and Gradient remain gaps.

Also new on the page: a **print layer** — the same content set in
traditional print conventions (kicker, headline, standfirst, three
ruled columns on a 24-unit baseline rhythm, drop cap, figure caption,
marginalia rail), after NCTGraphite's Studio print recipe. The
direction: the futuristic environment reads like a document.
