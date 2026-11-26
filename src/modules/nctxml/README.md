# nctxml — the NCTXML renderer library

Not a module: the interpreter library every hosting loads
(plans/NCTXML.md §3–§4). Shell-hosted, app-hosted and embedded
hosts all run this same code; it is a library, not a service
only the shell provides.

Contents:

- NctXmlRenderer.cs — the interpreter: XML parse → namespace
  resolution → control registry → logical tree → visual tree →
  properties, handlers, bindings. Preview documents are
  enforced read-only + no-code here, by kind (§2).
- ControlRegistry.cs — the registry and the component contract
  (§6): an entry without an accessibility role does not enter.
  Stock v1 controls + the §7 layout controls.
- BindingEngine.cs — binding v1 (§9): {Path} expressions,
  OneTime / OneWay / TwoWay, named converters, DataContext
  inheritance (resolved by the renderer), component-bag links.
- NctDataObject.cs — the DataContext object: a property bag
  with change notification. No polling anywhere.
- DockContainer.cs — the Dock layout (§7).
- NctDocument.cs — one rendered file: kind, live tree,
  manifest, diagnostics; owns the binding links.
- proofs/ — the five Slice-2 proof files (§12): a component
  (labelled slider), a settings pane, a text/image preview,
  an isolated window, an app.
- harness/ — the headless proof harness (C#; it also drives
  the real Slice 1 window manager for the app proof).

Build: the modules project is a Godot .NET project
(../NCTModules.csproj); `dotnet build` must run before Godot
loads the project. NCTXML files use the .nctxml extension.

Status: SLICE 2 BUILT (2026-11-26, agent-build-log/18) —
interpreter v1 with the §12 proofs green in tier 0. Deferred
per the plan: the compiler/cache, XForms, the designer, Pango,
annotated-SVG theming (§8 — v1 applies no theme beyond Godot
defaults), DataTemplates, relative-source binding.

GRID (2026-11-26, agent-build-log/28): <Grid> is now the
system's own grid — NCTXML §7 semantics ported from
NCTGraphite's grid model (track strings, Proportions weight
form, named Areas, Baseline rhythm with snapping, own-width
Breakpoints with the per-field cascade). Two engines behind
the one surface, chosen per document with Engine=:
  solver (default)  nctxml/NctGridContainer.cs
  native            NctGridNative, a GDExtension
                    (gdextension/, library in bin/; falls
                    back to the solver where not loaded)
Placement (Column/Row/Span/Area) travels as child metadata,
the Dock channel. grid/ holds the measured-rect proofs and
the engines-compared harness.
