# NCT — NCTXML plan

Status: DRAFT PLAN (2026-11-26). Accepted in discussion by the user
('rec', 2026-11-26). Not built.
Companion: ENVIRONMENT-MANAGER.md in this directory, which owns the
window / layer / manager side. This document owns the format and
its renderer.

NCTXML is the system's own declarative UI format. It takes after
MXML (grammar, superclass pattern, beads-style composition) and
XUL (box layout, declarative bindings / handlers, a desktop-grade
component set), and takes the essential aspects listed in the
framework-topics discussion: binding, inheritance and hierarchy,
layout, component architecture, templating, styling and theming,
events, state, extension, design-time / runtime separation,
packaging, IPC, accessibility, resources and i18n, animation.
.pck launch remains supported — NCTXML programs ship inside .pck
packages; NCTXML is the authoring format, .pck is the package.

## 1. Three axes, kept separate

Every confusion in this area comes from conflating these:

| Axis | Question | Decided by |
|---|---|---|
| File kind | what the NCTXML root declares itself to be (§2) | the file |
| Hosting | which process runs the renderer (§3) | the kind + the host |
| Window policy | how the window manager treats its window | style, in ENVIRONMENT-MANAGER.md §5 |

The same renderer runs in every hosting. A file kind does not
imply a window style: a dashboard widget is an `app` or `window`
kind whose manifest requests, or whose user assigns, the
dashboard style.

## 2. File kinds

The root element declares the kind. One grammar for all six.

| Kind | Declares | Window of its own | Links into the system |
|---|---|---|---|
| `component` | a class, under a namespace | no | no — the basis of the NCTXML UI component library |
| `pane` | a fragment | no — a host supplies the frame | inherits the host's DataContext and theme |
| `preview` | a pane subtype: read-only, no code execution by default, registered per file type | no | hosted by File Navigator (and any host that asks for a preview of that type) |
| `window` | an isolated window | yes | the window manager only — no services, no registry entry beyond its window |
| `app` | an app id + manifest | yes, 0..n via the app manager | registry, single-instance, notifications, settings registration, security profile / plugs / Monitor |
| `shell` | shell furniture (bar, side tab, pinned widget) | a panel- or dashboard-style window | privileged — system-shipped only, hosted in the shell process |

Notes:

- `preview` being a kind in its own right is what makes File
  Navigator previews safe and uniform: the renderer enforces
  read-only + no-code for the kind, a host never has to trust
  the file to behave.
- `component` files are how the component library grows: a
  component file's root is its class declaration (the MXML
  superclass pattern), usable from any other NCTXML file by
  namespace, and from code.
- An `app` manifest carries: id, name, icon, kinds of windows it
  opens, requested window style, settings property list (rendered
  by the stock settings kit), capabilities requested (decided by
  the security manager), file types it previews / opens.

## 3. Hosting

| Hosting | Renderer runs in | Used by |
|---|---|---|
| shell-hosted | the shell process | `shell` kind; `pane` / `preview` hosted by shell apps; dashboard-styled programs the shell pins |
| app-hosted | the app's own Godot process (Model 2) | `window` and `app` kinds; `pane` / `preview` hosted inside that app |
| embedded | a host app's process, inside one of its windows | `pane`, `preview`, `component` instances |

The renderer is a library every hosting loads, not a service
only the shell provides — otherwise File Navigator could not
render a preview inside its own window, and an app could not
embed a pane.

## 4. The renderer

Runtime interpreter first; a compiler / cache to .tscn may come
later for shipped apps, with the grammar unchanged.

    .nctml file
      → XML parse
      → namespace resolution → control registry
        (Godot ClassDB classes + NCTXML component library)
      → build the LOGICAL tree (§5)
      → expand templates → the VISUAL tree (Godot Control nodes)
      → set properties, wire signals / handlers, establish bindings
      → layout pass (Godot Containers, §7)
      → theme applied (Theme resources + annotated-SVG StyleBoxes, §8)
      → live tree, owned by the host

Why interpreter-first: panes and previews must load from a file
selection instantly, with no build step; widgets and shell
furniture must be editable as text and reloaded; the form
designer (later) edits NCTXML directly. Compilation is an
optimisation, not a prerequisite.

## 5. Logical tree ≠ visual tree (not retrofittable)

- NCTXML nesting is the **logical** tree: what the program means.
- Templates expand a logical node into a **visual** tree of Godot
  Controls: how it looks. A control's behaviour lives in its
  class; its visual tree is replaceable (lookless controls,
  ControlTemplate in the XAML sense).
- DataTemplates select a visual tree by data type, for lists,
  trees and repeats.
- Binding scope, DataContext inheritance and event routing are
  defined on the logical tree, never on the visual tree.

If nesting were the visual tree, templating, data templates and
clean binding scope would all be lost. This is settled now,
before the first control ships.

## 6. The component contract

Every control in the registry — stock, library or an app's own
`component` — provides:

1. **Typed properties**, settable from NCTXML attributes, from
   code, and by binding; property changes raise signals.
2. **Signals / handlers**, declared in NCTXML as attributes or
   `<handler>` elements (XUL `<bindings>` pattern).
3. **A template slot**: a default visual tree, replaceable per
   theme or per use.
4. **Accessibility facts**: a semantic role and a label, exposed
   to the accessibility manager's AT-SPI2 bridge. A control
   without these does not enter the registry.
5. **Keyboard facts**: focusable or not, its key-click / bimodal
   operation, its place in focus order. Controls are operable
   without a mouse from the start; mouse stays backwards-
   compatible, per the standing key-click rule.
6. **Theme facts**: its theme type name and variations, and the
   annotated-SVG assets its states use (§8).

Stock controls for v1 (from the topics file's opening list,
kept deliberately small): Button, Label, TextField, TextArea,
CheckBox, Radio, Slider, Select / ComboBox, List, Tree, Tabs,
Menu, Scroll, Image, Progress, plus the layout controls in §7.
The breadth problem (dialogs, rich text, grids, charts…) is
real and is P2 work, grown by backwards derivation from apps —
the paramorphic rule applied here: a gap an app hits becomes a
library control, not a hand-rolled one-off in the app.

## 7. Layout

Layout controls map onto Godot Containers; the rules are the
system's, written once, so separate apps lay out alike:

| NCTXML | Rule | Godot |
|---|---|---|
| Grid | rows / columns, spans, fixed / proportional / fill tracks | GridContainer + custom track solver where needed |
| Dock | top / bottom / left / right / fill | custom Container |
| Stack | horizontal / vertical, spacing, alignment | HBox / VBoxContainer |
| Box | XUL box model: pack, fill, expand along one axis | HBox / VBox with size flags |
| Free | absolute position | plain Control children |

Plus:

- **Alignment is a property of the controls**, set by the
  developer, not a global mode.
- **Device classes** (phone / tablet / desktop; orientation a
  modifier; the demo-de breakpoints) may override properties
  per class, resolved toward larger classes then base — the
  device model already decided for demo-de.
- **Sizing vocabulary** is fixed: fixed, proportional, fill,
  huggable (min-content). No other sizing words enter the format.

## 8. Styling, theming, vector chrome

- Theming rides Godot Theme resources and theme type variations,
  owned system-wide by the theme manager, overridable per app.
- Control backgrounds and window chrome are **annotated SVG**:
  a `g:` namespace (ignored by regular SVG renderers) carrying
  `<g:patch>` 9-slice margins + content area, so corners never
  stretch and art re-rasterises sharply at any DPI. The runtime
  path is rasterise-at-load at the target DPI → StyleBoxTexture
  with the patch margins (Path A in the topics discussion).
- Later `g:` additions, each independent: hatch and mesh
  gradients (from the abandoned SVG 2 drafts), patch repeat
  modes (stretch / tile / none), shape primitives (independent
  corner radii, chamfer, capsule, polygon, star, bevel) that
  desugar to standard paths.
- State variants of one control share identical `<g:patch>`
  geometry; a theme may swap the art but not the geometry.
  A design-time check validates patch margins ≥ corner radius.

## 9. Binding and state (v1 scope)

In v1:

- `{expression}` bindings with modes **OneTime, OneWay, TwoWay**
  (Explicit / UpdateSourceTrigger arrives with the forms work).
- **DataContext inheritance**: set at any logical node, flows
  down, overridable below — the mechanism that lets a `pane`
  bind to its host's data without knowing the host.
- Property-path addressing; simple converters (format, negate,
  visibility-from-truth) as named library converters.
- **View states**: named states on a root, `includeIn`-style
  membership, state-driven property sets.
- Change notification via the property system's signals — no
  polling, no frame-loop checks.

Deferred: relative-source / ancestor binding beyond DataContext,
a full expression language (v1 expressions are paths, literals
and named converters only), transactional submit semantics —
those arrive with the XForms layer (§11).

## 10. Resources, i18n, keyboard

- Strings, images, fonts and sounds are typed resources,
  referenced by name / path from NCTXML, resolved by the host's
  resource scope (app → system).
- All user-visible strings are localisable from the start:
  NCTXML text attributes take resource keys; no hard-coded UI
  strings in shipped NCTXML.
- Keyboard: every program declares nothing about global keys —
  global operators belong to the input manager, and reserved
  keys (F above all) cannot be taken by any NCTXML handler.
  Local handlers receive what the input manager routes to the
  focused window.

## 11. Deferred layers (named, not designed here)

- **XForms offshoot** — a model layer under NCTXML: instance
  data, types, constraints, calculations, relevance, repeats;
  NCTXML as its view; a web adapter rendering the same form.
  It binds to the finished binding engine; it does not precede it.
  BUILT v1 (2026-11-26, agent-build-log/29): instance + binds
  (type/required/readonly/relevant/calculate) + submissions
  (transactional, with a pending state for async hosts) +
  repeats, in nctxml/FormModel.cs. Per the topics file's
  extension-module pattern, the model carries LAYOUT
  ANNOTATIONS in the platform's own layout vocabulary, so a
  form of data renders with a default layout (the auto-view)
  and can equally be laid out any other way by a hand-written
  view — both over one shared instance (proofs in
  nctxml/forms/). Still deferred here: the web adapter,
  per-item validation of repeats, XPath (expressions stay the
  small path/arithmetic language of FormExpr.cs).
- **Form / GUI designer** — edits NCTXML (+ the XForms model)
  directly: palette, canvas, property grid, live preview as a
  real runtime instance; design-time model kept separate from
  the runtime model. demo-de's Showcase / Builder is its
  prototype. Needs the component library stable first.
- **Pango text layout** — a TextServerExtension GDExtension for
  document-class apps (justification, tab stops, paragraph
  attributes). Not needed by the shell or the v1 kit.
- **Metafont font pipeline** — a font-source question, tracked
  with NCT-LIB-EXT-FWKS, independent of NCTXML.
- **Animation** — declarative transitions between view states;
  v1 state changes are instant (and must not defeat Low
  Processor Mode: no always-running animations in shipped
  shell NCTXML).

## 12. Proofs for the first build (Slice 2 of ENVIRONMENT-MANAGER.md)

One of each, all rendered by the same interpreter:

1. A `component` — a labelled slider — used from the other three.
2. A `pane` — a settings page, hosted by the shell's Settings,
   binding to the host's DataContext.
3. A `preview` — a text / image preview registered for its file
   types, shown by File Navigator, read-only.
4. A `window` — an isolated window with no system linkage.
5. An `app` — registered, single-instance, with a settings page
   and one notification; convertible to the dashboard style by
   the user, live, without restart.
