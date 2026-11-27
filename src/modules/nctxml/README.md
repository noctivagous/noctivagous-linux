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
per the plan: the compiler/cache, the designer, Pango,
annotated-SVG theming (§8 — v1 applies no theme beyond Godot
defaults), DataTemplates, relative-source binding.

HOSTING (2026-11-26, agent-build-log/29): the library was
vendored into godot/greeter and godot/shell, source-synced
with a tier-0 drift check. RETIRED (2026-11-27, build
log 34): under the GDScript-first strategy the shipped
environment no longer hosts the library — the greeter's
form and the shell's bar are GDScript builds, and the
vendored copies, the smoke scenes and the sync/check
scripts are gone. The library's own tests in src/modules
carry it now. Its production views over the greeter form
and the shell bar are kept in examples/ as the reference
for the baking slice that brings the interpreter back —
baked, in an app's export layout, when it is stable.

FORMS — the XForms layer (2026-11-26, agent-build-log/29;
plans/NCTXML.md §11, built): FormModel.cs + FormExpr.cs.
A .nctform file declares a form as data: an <instance> XML
tree (the data itself — serializable, diffable), <bind>
constraints per node (type, required, readonly, relevant,
calculate — expressions are paths/literals/arithmetic, not
XPath), <submission> transactions (validate, then call the
host action with the instance; async hosts answer
{"state":"pending"} and resolve later), and <layout>
ANNOTATIONS in the platform's layout vocabulary (container,
columns/areas/breakpoints; per-field area/row/column/span/
order) so a form carries a default layout. A view declares
Model="f.nctform" and binds the instance like any context;
<FormView Model="..."/> renders the form from its model +
annotations alone. One model, any layout — forms/ holds the
proofs: the login model in a hand grid AND the auto-view over
one shared instance, calculate/relevance/repeat proofs.
<Repeat Items="{path}"> renders a template per item (form
repeats or context arrays); inside a template, handlers
receive their item as argument. Components gained commands:
a template button declares Command="Close", the instance
maps it with onClose="hostMethod" (unmapped = disabled).
components/title-bar.nctxml is the stock TitleBar — client
chrome for NCT windows (Drag="window" makes a control its
window's drag handle).

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
