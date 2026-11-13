# NCTGraphite — One App Kit, One Tag Language, One Builder

**How this repository builds the shared React library for the external
`nct-project-manager` and `nibglider` applications, then mines the external
`noct-code-appkit` project into it**

Date: 2026-10-29 · Revised 2026-10-29 · Adapted for this repository:
2026-10-29 · Status: recommendation, no application code changed
Scope originally reviewed: `noct-code-appkit/` (Lit),
`nct-project-manager/` (React), `nibglider/` (React) — source, docs, task
files, and tests read directly from companion checkouts.

> **Repository-location note.** This is the standalone NCTGraphite GitHub
> repository. In this copy, `NCTGraphite/` and root-relative paths such as
> `packages/nctgraphite/` refer to this repository. Paths beginning with
> `noct-code-appkit/`, `nct-project-manager/`, or `nibglider/` refer to the
> separate companion projects examined during the original audit; they are
> not directories in this repository.

> **Revision note (shared library first, React, full NCTGraphite name).**
> The previous version converted `@noct-code-appkit/` to React first and
> made it the kit. This revision reverses that order. The two functional
> projects — `@nct-project-manager/` and `@nibglider/` — are the proven
> requirements source, so the kit now starts as a **new shared React
> library in a top-level `NCTGraphite/` project** that unifies what those
> two apps already duplicate. `@noct-code-appkit/` is mined afterwards,
> component by component, only where a functional app needs what it has.
> The runtime stays React (no Lit, no wrappers); the XML dialect, safe
> binding language, metadata catalog, single token theme, and tree-based
> builder are unchanged in intent. **Naming rule: the project is always
> shown as `NCTGraphite`, never by the shorter suffix alone** — this
> applies to this repository, its folder in consuming checkouts, packages,
> files, themes, functions, components, and every public tag (§9). All
> public tags carry the full prefix, e.g. `<NCTGraphiteStack>`,
> `NCTGraphiteView`, and `NCTGraphiteScope`.

---

## 1. Executive recommendation

You do not have three separate problems. You have **one kit that currently
exists in three incompatible dialects**, plus a builder that edits the wrong
model. The fix is convergence, not another rewrite:

1. **Canonize the name NCTGraphite for the whole system, always in full**
   — repository, package, kit, tag language, and builder. `NCTGraphite`
   is already the mandated name in the companion
   `nct-project-manager/AGENTS.md`. Never
   shorten the project name to its suffix alone in prose, code, files, or
   tags. Every public tag carries the full prefix (`NCTGraphiteStack`,
   `NCTGraphitePanel`, `NCTGraphiteField`, …; §9). Retire "NoctCode" as a
   product name; `noct-` survives only as a temporary XML input alias
   where old documents are imported (§9).
2. **Use this repository as the shared React library, and unify the
   two functional projects into it first.** The library package is
   `@nct/nctgraphite` in `packages/nctgraphite/` and is consumed by the
   external `nct-project-manager` and `nibglider` projects as a real,
   versioned dependency — never as copied source. Seed it only with what
   both functional apps already duplicate or demonstrably both need
   (the **rule of two**, §4.1): tokens/theme, layout primitives, the
   duplicated controls, app chrome, and the settings-window pattern.
   Build each library component fresh against the NCTGraphite tokens and
   catalog, using both apps' implementations as references — do not
   copy-paste either app's compromises into the library. Migrate one real
   screen per app onto each new component and delete the original.
3. **Mine the external `noct-code-appkit` project afterwards, on demand
   — do not convert it wholesale.** Its 63 Lit tags become a donor
   backlog ordered by the functional apps' needs (§7 Phase 3): build the
   simple proven pieces (`Panel/Pane/Well`, `Splitter`, `Tabview`,
   `Menubar`, `Statusbar`, `Slider`, `Meter`, `Listbox`, `Segmented`,
   `Tooltip`) fresh in React in this repository's `packages/nctgraphite/`
   when an app asks, using the inventory descriptions and `*Meta` as the
   spec; redesign the eval-based logic tags,
   `Store`, and `Flow` rather than rebuilding from donor code; defer `Player`, `Upload`,
   `AuthForm`, and the absolute-position GUI canvas until a functional
   app needs them. Its per-component metadata idea is adopted from the
   start. This avoids spending the conversion budget on experimental
   components no shipping app has validated.
4. **Runtime is React everywhere; the XML language renders as React.**
   Both functional apps are React 19, and there is no named non-React
   consumer, third-party embed, or CDN requirement to justify Lit or a
   wrapper layer. Kit components use hooks, context, refs, and the hosts'
   Zod stores directly. The XML tags do **not** need Web Components:
   NibGlider already proves XML can parse to a typed tree and render as
   React components, exactly as XAML tags compile to objects.
5. **Promote the external NibGlider project's XML machinery into this
   repository as the language front-end.** Its dependency-free parser,
   typed-error discipline, and
   test style are the best engineering in the three repos. Generalize its
   three narrow parsers (`menuXML`, `windowXML`, `inCanvasGui`) into
   **one NCTGraphite XML dialect** with one parser, one AST, and
   validators plus a React renderer (`NCTGraphiteView`).
6. **Use both functional apps as joint proving grounds.** Every library
   capability must land in a real screen in at least one of
   `nct-project-manager` or `nibglider`, and graduate to "kit" status only
   when the second app uses it (or its need is already on that app's
   roadmap). Do not build kit features in the abstract, and do not let
   `nct-project-manager` alone define the kit — NibGlider's windows,
   menus, and in-canvas overlays are equally binding requirements.
7. **Rebuild the builder around a layout tree, not absolute pixels.** The
   current NOCTGUI canvas (`noct-gui-canvas`/`noct-gui-item`) drags
   absolutely-positioned boxes and exports an absolute-positioned
   `<noct-scene>`. That cannot produce the StackPanel/Grid-style apps you
   want. The builder's document model must be the XML tree itself; absolute
   positioning survives only as a special "scene/canvas" mode for
   NibGlider-style in-canvas overlays.
8. **Replace string-eval logic with a safe binding language.** The
   `noct-*` logic tags are conceptually right (they are your MXML-style
   logic layer) but they evaluate attribute strings with `new Function`
   in at least nine files. That breaks under CSP, is un-typecheckable, and
   is the single largest correctness/security liability in the kit. Adopt
   NibGlider's `key → binding` record pattern plus `nct-project-manager`'s
   Zod-schema-as-source-of-truth as the binding contract.

Everything below is evidence for these eight points and a phased plan to get
there without pausing any of the three projects.

---

## 2. What the companion projects contain today (inventory)

> The paths in this section belonged to the companion checkouts examined
> for the original audit. They are retained as evidence and migration
> pointers; they are not directories in the NCTGraphite repository.

### 2.1 External `noct-code-appkit` — the kit prototype (Lit 3 + TypeScript + Vite)

The fullest component catalog of the three. `src/main.ts` exports 63 tags in 8 groups (plus `core/` base infrastructure):

```
src/lib/ — app (15) · layout (11) · logic (17) · widgets (8)
           · data (4) · gui (4) · flow (2) · meta (2)
```

Per-tag descriptions with source-file paths: `NOCTCODE-APPKIT-COMPONENT-INVENTORY.md` (this repository).

| Category | Tags (in `src/lib/…`) | Notes |
|---|---|---|
| Core | `NoctElement`, `WithMetadata`, `getComponentMetadata` (`core/`) | Every component exports a `*Meta` object: tag, category, description, typed props, slots, emits, dependencies, examples. This is the AI-discovery contract. |
| Layout | `noct-grid`, `noct-stack`, `noct-splitter`, `noct-slot`, `noct-scene`, `noct-tag`, `noct-toolbar`, `noct-tabview`, `noct-panel`, `noct-pane`, `noct-well` (`layout/`) | `noct-stack` *is* your StackPanel (flex row/column, gap/align/justify/wrap); `noct-grid` is CSS Grid; `noct-panel`/`noct-pane`/`noct-well` encode the pro-app chrome idiom (titled panel, headerless cluster, recessed readout). |
| Data | `noct-store`, `noct-table`, `noct-form`, `noct-chart` (`data/`) | `noct-store` is a reactive store addressed as `#id` with `get(path)`/`set(path)`/`subscribe(path, cb)`. |
| Logic | `noct-if`, `noct-show`, `noct-for`, `noct-switch`/`noct-case`/`noct-default`, `noct-action`, `noct-api`, `noct-query`, `noct-computed`, `noct-effect`, `noct-debounce`, `noct-defer`, `noct-validate`, `noct-history`, `noct-command`, `noct-custom` (`logic/`, 17 files) | The MXML-style logic layer you asked for. Attributes hold expressions like `#store.count > 0`, templates use `{{ item.name }}`. |
| Widgets | `noct-slider`, `noct-meter`, `noct-listbox`, `noct-toggle`, `noct-segmented`, `noct-tooltip`, `noct-key`, `noct-display` + `calc-engine` (`widgets/`) | Pro-density controls (24px class), keyboard-operable. |
| App chrome | `noct-app`, `noct-theme`, `noct-menubar`, `noct-statusbar`, `noct-modal`, `noct-toast`, `noct-window`, `noct-router`, `noct-auth-form`, `noct-user-menu`, `noct-protected`, `noct-upload`, `noct-player`, `noct-app-settings`, `noct-demo-page` (`app/`) | Complete desktop shell vocabulary; reference shell demo in `src/demos/app-shell-demo.html`. |
| Flow | `noct-flow`, `noct-flow-node` (`flow/`) | NOCTAPPCODE visual data-flow wiring (nodes, ports, SVG wires, `binding-generate` events). |
| GUI builder | `noct-gui-canvas`, `noct-gui-item`, `noct-palette`, `noct-properties` (`gui/`) | Palette → drag to canvas → property editor → `exportCanvas()` JSON / `exportAsNoctDefine()`. See gaps in §3. |
| Meta | `noct-define`, `noct-registry` (`meta/`) | Runtime component definition from `<template>`; registry dump for AI introspection. |
| Theming | `src/styles/theme-tokens.css`, `src/styles/rectangular-dark.css`, `noct-theme` | CSS-variable tokens (`--bg-*`, `--bevel-*`, `--space-*` on a 4px unit, `--baseline: 4px` type grid, `--font-mono-tech`), `data-app-mode="desktop|responsive|mobile"`, `data-density`. Desktop-first; 44px touch targets only under `mobile`. |

Strengths to keep: the metadata-per-component pattern, slot-based tree
composition ("AI thinks in trees"), token-with-fallback styling
(`var(--token, <current value>)`), pointer-event drag with keyboard
alternatives, and the demo SPA (`src/demos/index.html` + `src/demos/views/`).

### 2.2 External `nibglider` — the XML renderer in production (React 19 + Paper.js)

NibGlider is a key-click vector editor, but for this plan its relevant part
is `src/ui/`: the only **working, tested, shipping** XML→UI pipeline you own.

- **One shared parser**: `src/ui/xmlParser.ts` — hand-written, dependency-free
  (explicitly *not* `DOMParser`, so the identical code runs in the browser
  and the Node test suite), returns `XmlNode | string` (node tree or error
  message, never throws). Limitation, by design today: **only elements and
  attributes; any text content is an error.**
- **Three dialects on top of it**, each with its own validator producing a
  typed spec, and its own React renderer:
  - `src/ui/menuXML.ts` → `MenuDef[]` from `src/ui/menus/menus.xml`
    (`<menus><menu><item command shortcut icon><option>…`, `<group>` headers,
    `Primary+`/`Opt+` shortcut resolution). Consumed via `PanelsManager`.
  - `src/ui/windowXML.ts` → `WindowSpec` from `src/ui/windows/settings.xml`
    and `document-settings.xml` (`<window><section|tabview><tab>`,
    `<switch>`, `<toggle>`, `<field type="text|number|password">`,
    `<table>`, `<accordion><pane>`, `<custom id>` escape hatch). Rendered by
    `SettingsWindow.tsx` and `DocumentSettingsWindow.tsx` with shared
    `WindowFieldControls.tsx` + `WindowFieldBindings.ts`
    (`Record<key, {get, set}>`, commit-only `SecretBinding` for passwords).
  - `src/ui/inCanvasGui.ts` → `InCanvasSpec` from `src/ui/inCanvas/*.xml`
    (`<inCanvas><edge side="top|right|bottom|left">`, `<field>`, `<select>`,
    `<toggle>`, `<exportButton>`, `<popoverButton>`), with an edge-budget
    overflow algorithm (`resolveInCanvasPlacement`) that spills trailing
    controls into a widget strip. Rendered by `ExportFramePopover`,
    `InterlacePopover`, etc.
- **Discipline worth copying**: malformed XML degrades to an error box, never
  a crash; unbound keys render as disabled "Unknown setting" rows instead of
  being silently dropped; specs are flattened/normalized (e.g. tabs hold
  `sectionIds` into a flat section list); every dialect has Node tests
  (`tests/window-xml.test.mjs`, `tests/menu-xml.test.mjs`,
  `tests/export-frame.test.mjs`, …) including a test that every menu command
  is either wired or an explicitly listed placeholder.

### 2.3 External `nct-project-manager` — the designated reference app (React 19)

A task manager (Kanban/Gantt/Task list/Acquisitions/Activity) whose
companion-checkout `AGENTS.md` already states the strategy this document
recommends: two related efforts developed together, NCTGraphite as a
tag-based pro kit, the app as its reference implementation, kit reuse
preferred over app-local convenience, kit in the app's `src/controls/`,
views compose kit tags and add no one-off controls.

Reality vs. that mandate, today:

- `src/controls/` has only **6 controls** (`ProButton`, `Checkbox`,
  `TextInput`, `StatusMenu`, `Modal`, `EmptyState` in `controls.css`), all
  thin wrappers over native elements. **Zero layout primitives** — no
  `Grid`/`Stack`/`Columns`/`Baseline`, despite AGENTS.md requiring them.
- Views (`src/views/*.tsx`) are bespoke JSX + per-view CSS (~90 `className`
  usages, **0** kit `ctl-` classes): the repetition problem you described,
  still happening in the very app meant to end it.
- Its durable assets are not visual but structural: **Zod schemas as the
  single source of truth** (`src/schemas.ts` → types inferred in
  `src/types.ts`, reused later for REST/MCP per `TASKS.md` Phases 7–8), a
  context+reducer store with versioned `localStorage` persistence
  (`src/store/taskStore.tsx`), and category feature presets
  (`src/projectPresets.ts`).
- Naming already drifted: the app adopted the NCTGraphite name in its
  AGENTS.md and commit history while the package is still
  `nct-task-manager` and its components carry no NCTGraphite identity.

---

## 3. Diagnosis: why the repetition persists

The inefficiency you feel is not a lack of components — between the three
repos you have 55+ Lit tags, 6 React controls, ~30 NibGlider React
components, and 3 XML dialects. It is **divergence**: nothing is shared, so
every app re-solves the same problems. Concretely:

1. **Three component models, zero sharing.** Lit `noct-*` custom elements
   (`noct-code-appkit`), React `ctl-*` class components
   (`nct-project-manager/src/controls/`), and React `settings-*`/`settings-row`
   class components (NibGlider windows). A button, toggle, select, modal,
   segmented control, and tab view each exist **three times** with three
   APIs. NibGlider even duplicates its own `SwitchControl`/`ToggleControl`
   verbatim between `SettingsWindow.tsx` and `DocumentSettingsWindow.tsx`.
2. **Three token vocabularies for one visual idea.** All three aim at
   "dark pro, layered grays, dense controls," yet define unrelated CSS
   variables: `--bg-base/--bg-raised/--bevel-*` (NoctCode,
   `theme-tokens.css`), `--bg-0…--bg-3/--border/--accent:#3ec6a7` with
   6–14px radii (`nct-project-manager/src/index.css`), and
   `--dp-bg-0…/--dp-accent:#4f8ff7` (NibGlider `src/styles/main.css`).
   NoctCode additionally duplicates its token table in code:
   `noct-theme.ts#getDefaultTokensCSS()` hardcodes a second copy of
   `theme-tokens.css`. Theming therefore cannot travel between apps.
3. **Two incompatible answers to "what is a tag?"** In NoctCode the tag is
   the runtime object (HTML *is* the app). In NibGlider the tag is a
   *compile-time description* parsed into a typed spec and rendered by
   hand-written React. Both are legitimate (runtime vs. compiled dialect);
   having both, unconnected, means the builder (which needs the compiled,
   inspectable tree) and the runtime (which needs live objects) cannot
   share a document format.
4. **The builder edits geometry, not structure.** `GuiItemData` is
   `{itemId, tag, label, x, y, width, height, props}` — a flat list of
   absolutely positioned boxes. `exportAsNoctDefine()` emits those boxes
   with `style="position:absolute;left:…;top:…"` inside a `<noct-scene>`.
   Consequences (all confirmed in `noct-code-appkit/TASKS.txt`): no nesting
   (can't drop into containers), no component tree/layers panel, no
   save/load, placeholder rendering inside items, export that is "not just
   noct-define wrapper" still missing. A StackPanel app cannot be expressed
   as absolute boxes, so the builder is unusable for the apps you build most.
5. **Logic by string evaluation.** `noct-if`, `noct-show`, `noct-for`,
   `noct-computed`, `noct-action`, `noct-command`, `noct-query`,
   `noct-custom`, `noct-toast` (action callbacks) all build functions with
   `new Function(...)` from attribute strings; stores are located with
   `document.querySelector('#'+id)`; computed values leak onto
   `window.__noctComputed`. This is the MXML idea with an `eval` engine:
   it fails CSP, defeats TypeScript, hides errors until runtime, and makes
   the builder unable to validate or refactor bindings. It is also why the
   logic tags cannot be safely generated by AI today — the AI must invent
   correct JS expression strings with no schema to check against.
6. **Registries that lie.** `noct-registry.ts` hardcodes its tag list (and
   `TASKS.txt` notes it already misses newer components); `noct-palette.ts`
   hardcodes a *second* component list (`PALETTE_COMPONENTS`) with empty
   `props: {}` for every entry, while the real prop schemas sit unused in
   each component's `*Meta`. `noct-properties.ts` *does* read
   `getComponentMetadata(tag)` — proof the metadata-driven path works —
   but palette and registry bypass it. Any builder/AI feature built on the
   hardcoded lists will silently drift from the kit.
7. **No text content in the XML language.** NibGlider's parser rejects all
   text nodes. That is fine for settings forms; it makes the dialect unable
   to express headings, paragraphs, button labels as content, or any
   document-like UI — i.e. most of an app. NoctCode HTML has text but no
   validation. Neither alone can be "the" app language.
8. **Missing layout vocabulary where it was promised.** `nct-project-manager`
   AGENTS.md requires `<Grid>`, `<Columns>`, `<Baseline>` layout tags,
   baseline-grid typography, and role font tokens. The app has
   `--font-technical/--font-ui/--font-reading` (good) but no layout tags
   at all; meanwhile NoctCode has the layout tags but under different names
   and a different grid discipline. The Windows comparison you made is
   apt: you have StackPanel (`noct-stack`) and Grid (`noct-grid`) — they
   are just not the *same* StackPanel in all three places.

None of this requires discarding work. It requires picking, per concern,
**which existing implementation becomes canonical** (§4) and demoting the
others to adapters.

---

## 4. Target architecture: NCTGraphite

One name, always in full, four layers. Each layer's canonical home is this
NCTGraphite repository. External functional apps consume the library; they do
not reimplement it. The external `noct-code-appkit` project is a donor backlog
that feeds Layer 2 over time; it is not a layer.

```
┌──────────────────────────────────────────────────────────────────┐
│ 4. BUILDER  (NCTGraphite Studio — apps/NCTGraphiteStudio)        │
│    Tree editor + layout canvas + properties + logic wiring       │
│    Reads/writes NCTGraphite XML documents; never owns widgets    │
├──────────────────────────────────────────────────────────────────┤
│ 3. LANGUAGE  (.nctgraphite.xml documents, NCTGraphite tags)      │
│    One parser (from external nibglider xmlParser) → one AST →  │
│    validators (per tag, from metadata) → NCTGraphiteView         │
├──────────────────────────────────────────────────────────────────┤
│ 2. LIBRARY  (this repository — @nct/nctgraphite, React)        │
│    Seeded from nct-project-manager + nibglider unification;      │
│    mined from noct-code-appkit afterwards, on demand             │
├──────────────────────────────────────────────────────────────────┤
│ 1. HOSTS  External React apps (nct-project-manager, nibglider) │
│    Provide stores/bindings (Zod-typed) + commands; render kit    │
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 Layer 2 — the library (canonical home: this repository)

- **Location and consumption.** The library package is `@nct/nctgraphite`
  in this repository's `packages/nctgraphite/` (React 19 + TypeScript +
  Vite, matching the hosts). The external applications include this entire
  repository as a git submodule and depend on the library through an npm
  workspace path (see §4.5). Source is never copied between repositories:
  copied code re-creates the three-dialect problem this plan ends. The
  external `noct-code-appkit` project keeps its own repository and becomes
  a donor backlog (Phase 3); it is not renamed, not converted wholesale,
  and hosts never depend on it directly.
- **The rule of two (what earns a place in the library).** A component or
  utility enters `NCTGraphite/` only when (a) both functional apps already
  duplicate it, or (b) one app needs it now and the other app's roadmap
  already names the same need. Anything else stays in its app until the
  second instance appears. This is the guard against building a second
  speculative kit: the first library release is small, proven, and
  entirely covered by real screens in two different apps.
- **Runtime: React, built fresh from the two functional apps.** Why React:
  both hosts are React 19, there is no named non-React consumer or CDN
  requirement, and a Lit or wrapper seam would be paid in every host on
  every feature. Library components are ordinary React components using
  hooks, context, portals, and refs; hosts pass real objects and
  functions, never stringified props. Each seeded component is **designed
  fresh** against the NCTGraphite tokens and metadata catalog, with both
  apps' implementations open as references — NibGlider's engine-typed,
  class-CSS window controls and NCT's thin native wrappers each carry
  compromises the library should not inherit by copy-paste. Migration is
  per screen: one NCT view and one NibGlider window/panel move onto the
  new component, the app-local originals are deleted, and the apps' tests
  guard the move.
- **Public names always carry the full NCTGraphite prefix.** Every exported
  component, hook, provider, and XML tag is named `NCTGraphite…`:
  `NCTGraphiteStack`, `NCTGraphitePanel`, `NCTGraphiteField`,
  `NCTGraphiteView`, `NCTGraphiteScope`, `useNCTGraphiteBinding`, and in
  XML `<NCTGraphiteStack>`, `<NCTGraphiteField …>`, etc. No public API,
  file, theme, or tag ever shows the project name shortened to its suffix
  alone (§9). The prefix is long by design: tags are read by AI, by the
  builder, and in mixed JSX/XML files, where an unprefixed `Stack` or
  `Field` collides with app-local names. App code may not re-alias the
  imports to shorter local names in checked-in source, or documents and
  code will drift apart again.
- **Consumption: direct imports through a git submodule, no wrapper
  layer.** Each external functional app includes this NCTGraphite GitHub
  repository as a git submodule at `<app>/NCTGraphite/` and depends on
  `packages/nctgraphite/` by workspace path (see §4.5 for the mechanics).
  Hosts write
  `import { NCTGraphiteStack, NCTGraphitePanel } from '@nct/nctgraphite'`.
  `nct-project-manager/src/controls/` is *deleted by replacement* as its
  screens migrate (`ProButton` → `NCTGraphiteButton`, etc.). Hand-writing
  library-class controls in an app becomes a lint error (the AGENTS.md
  rule, mechanically: views may not contain raw
  `<button>/<input>/<select>` outside the library). XML documents render
  through `NCTGraphiteView` (§4.2), so JSX and XML are two spellings of
  the same component tree — a view can move between them without changing
  its components.
- **One metadata registry as the single source of truth.** Adopt
  NoctCode's per-component metadata idea from day one (it is the best idea
  in that repo), but generate the registry so it cannot drift the way
  `noct-registry`/`noct-palette` did: a build step walks the library's
  component exports, collects every `NCTGraphite…Meta` const, and emits
  (a) the runtime registry used by the palette/properties components,
  (b) `nctgraphite.catalog.json` for AI/builder consumption, (c) docs
  tables. Each component's typed React props are the schema (derive
  catalog prop types from the TypeScript prop types where practical;
  the metadata const holds descriptions, defaults, and what types cannot
  express). Hardcoded tag lists become generated files that fail CI when
  stale. Metadata carries what the builder and validator need:
  `children` (allowed child tags / content model, e.g.
  `NCTGraphiteCase` only inside `NCTGraphiteSwitch`), `bindable` props
  (which props accept `bind="…"`, and their value types), and `design`
  hints (default size, palette icon, is-container). This metadata is also
  your AI affordance — see §6.
- **Layout vocabulary (the StackPanel layer), seeded from the apps.**
  First release, each justified by both apps' shells today:
  `NCTGraphiteStack`, `NCTGraphiteGrid`, `NCTGraphiteDock` (edge-docked
  shell layout — menubar top, statusbar bottom, sidebar left/right, fill
  center; today hand-composed with flex in every shell),
  `NCTGraphiteColumns` (multi-column modular grid with named areas, as
  required by `nct-project-manager` AGENTS.md), `NCTGraphiteSplitter`,
  `NCTGraphitePanel`, `NCTGraphitePane`, `NCTGraphiteWell`,
  `NCTGraphiteScroll` (owns internal scroll regions — the recurring
  "scroll inside the control, never the page" rule),
  `NCTGraphiteSpacer`, and a `NCTGraphiteBaseline` typography context
  (expose `leading`/`measure` as props/utilities rather than new tags
  where possible). NoctCode's `noct-stack`/`noct-grid` are design
  references for behavior, not code to port first. Every layout tag takes
  grid props in the dialect (`columns="240px 1fr"`, `gap="2"` in 4px
  units) so AI and builder never emit raw CSS for structure.
- **Controls, first tranche = the two apps' actual duplication.**
  `NCTGraphiteButton`, `NCTGraphiteTextInput`, `NCTGraphiteNumberInput`,
  `NCTGraphiteSelect`, `NCTGraphiteCheckbox`, `NCTGraphiteToggle`,
  `NCTGraphiteSwitch` (segmented single-select), `NCTGraphiteField`
  (label + control + error row — the unit every settings window in both
  apps re-implements), `NCTGraphiteModal`, `NCTGraphiteWindow`,
  `NCTGraphiteTabs`, `NCTGraphiteMenu`, `NCTGraphiteContextMenu`,
  `NCTGraphiteToolbar`, `NCTGraphiteMenubar`, `NCTGraphiteStatusbar`,
  and `NCTGraphiteEmptyState`. Sources: NCT's `src/controls/` and
  NibGlider's `WindowFieldControls`/settings-window markup, redesigned
  fresh (§4.1). Everything beyond this tranche — slider, meter, listbox,
  data grid, tree, calendar lane — enters through the rule of two or the
  NoctCode mining backlog (Phase 3), not speculation. Freeze new
  *app-specific* standard widgets in the apps; if a view needs markup
  the library lacks, the work item is a library addition first.
- **One theme, built from the two apps plus NoctCode's token design.**
  Canonize one NCTGraphite token vocabulary in `NCTGraphite/`'s
  `NCTGraphiteTheme.css`. Use NoctCode's token *naming* as the starting
  point (`--bg-base/raised/input/…`, `--bevel-*`, `--space-*`, `--font-*`,
  `--line-*`, `--height-*`, `data-app-mode`, `data-density`) because it is
  the most complete of the three, and reconcile the *values* against the
  two shipping apps so neither app's look regresses. The React
  `NCTGraphiteTheme` component only sets `data-app-mode`/`data-density`
  attributes and token overrides via CSS variables; token values live in
  the one CSS file (never duplicated in component code the way
  `noct-theme.ts` duplicates its token table). With plain React CSS, the
  global token cascade reaches every component directly.
  `nct-project-manager`'s `--bg-0…3` and NibGlider's `--dp-*` become
  one-time mappings onto the canonical names (aliases may live one release,
  then are removed — per your standing rule, no permanent shims). The
  rectangular/bevel vs. rounded question must be settled as *theme*,
  not code: `NCTGraphiteDark` (NCT's current look — dark pro, teal
  accent, rounded) is the default theme, and the NoctCode rectangular
  bevelled styleguide ships as `NCTClassicDark`, a second theme file over
  the same tokens/components, so "themeable" is proven by two real
  themes instead of asserted. `NCTTechDesMVD` is reserved for
  technical minimum-viable-demo web artifacts in the grid-paint-labs
  idiom. Radius stays a token; that is the right seam. The registry is
  `themes.json` (names, descriptions, token tables, sources).

### 4.2 Layer 3 — the NCTGraphite XML language

Generalize NibGlider's stack; do not start a new parser.

- **Parser**: reimplement the companion `nibglider/src/ui/xmlParser.ts`
  design in `packages/nctgraphite/src/xml/` as `@nct/nctgraphite/xml`.
  Evolve it in place: add **text nodes** (the one
  breaking change — represent as `{text}` children or a `text` field,
  with whitespace rules: preserve in content tags, ignore between
  structural children), comments and prolog as now. Keep the contract:
  returns tree-or-error-string, never throws, runs identically in Node
  tests and browser, zero dependencies.
- **One AST, per-tag validators.** Replace `parseMenuXML`/`parseWindowXML`/
  `parseInCanvasXML` as *entry points* with a single `parseNCTGraphite(xml)`
  that returns the generic tree, then a **validator driven by the metadata
  registry** (§4.1): unknown tag, unknown prop, wrong child, missing
  required prop, and bad enum/number ranges are all metadata checks.
  Domain invariants that metadata cannot express (e.g. "`<switch>` needs
  ≥2 `<option>`s", "`<accordion>` cannot nest") stay as small hand-written
  rules keyed by tag — the pattern NibGlider already uses — registered
  alongside the metadata, not as separate parsers.
- **Dialect = the library catalog, with the full NCTGraphite prefix on
  every tag.** XML tag names are the library component names, always
  spelled out in full: `<NCTGraphiteStack>`, `<NCTGraphiteGrid>`,
  `<NCTGraphitePanel>`, `<NCTGraphiteField>`, `<NCTGraphiteSwitch>`, …
  No unprefixed variant, no kebab variant, no shortened project name in
  a tag — ever (§9). The prefix makes NCTGraphite documents unambiguous to AI,
  to the builder, and when JSX and XML appear side by side, and it can
  never collide with an app-local component of the same short name.
  Attributes are the metadata props. Children are composition. That is
  the whole language: **if an NCTGraphite tag is in the catalog, it is in
  the language** — the palette, validator, docs, and AI prompt all read
  the same list. The runtime mapping is the library's React component
  registry (`{ NCTGraphiteStack, NCTGraphiteGrid, … }`):
  `NCTGraphiteView` looks a tag up by its full name and renders that
  component with the node's props/children. No custom-element registry
  and no alias element names — the old `noct-*` and NibGlider lowercase
  spellings exist only as accepted XML *input* aliases in the validator
  during migration (§9), and are always written back out in full
  NCTGraphite form.
- **Subsumed dialects become profiles, not parsers.** Menus
  (`<NCTGraphiteMenus>…`) and in-canvas overlays
  (`<NCTGraphiteInCanvas>…`) remain valid documents — they are just
  NCTGraphite documents using the menu/canvas tag subset, rendered by the
  menu/canvas renderers instead of `NCTGraphiteView`. NibGlider keeps its
  `MenuDef`/`WindowSpec`/`InCanvasSpec` types during migration as
  *projections* of the AST (adapters in §8), then deletes them.
- **Document kinds.** An NCTGraphite file declares its root:
  `<NCTGraphiteApp>`, `<NCTGraphiteWindow>`, `<NCTGraphiteView>`,
  `<NCTGraphiteMenus>`, `<NCTGraphiteInCanvas>`, `<NCTGraphiteDefine>`
  (component definition, the successor idea to `noct-define`). Each root
  names its renderer. Files keep NibGlider's import style
  (`import doc from './x.nctgraphite.xml?raw'` in Vite apps today; the
  builder and Node tests read the same text).

### 4.3 Bindings and logic (replace eval, keep the tags)

Keep the logic-tag *surface* — it is the most original part of NoctCode
and the piece AI generates best — and replace its engine:

- **Binding syntax, path-based only.** `bind="tasks.selected.title"`,
  `bind:value="settings.quadMapping"`, `on:command="save"`,
  `visible-when="tasks.count > 0"` where the expression grammar is a
  small, documented subset: paths, literals, comparison, `and/or/not`,
  and calls to *host-registered functions only*. Implement it as a real
  tiny parser/evaluator in the kit (testable in Node like NibGlider's
  parsers), never `new Function`. `{{ path }}` interpolation in text and
  attribute values uses the same evaluator.
- **Hosts provide bindings; documents name them.** Generalize NibGlider's
  `Record<key, FieldBinding>` and NCT's Zod store into an
  `NCTGraphiteBindingScope`:
  the host registers named stores (validated by Zod schemas where the
  host has them — `nct-project-manager/src/schemas.ts` is the model) and
  named commands (`command="export-raster-canvas"` is already NibGlider's
  menu contract, with a test enforcing every command is wired or declared
  a placeholder — keep that test for all documents). Unknown bindings
  degrade to disabled controls with a visible "Unknown binding" state,
  as NibGlider already does. In React the scope is a context
  (`<NCTGraphiteScope value={scope}>`, with a `useNCTGraphiteBinding(path)`
  hook for hand-written components that need the same stores); an
  `NCTGraphiteStore` component remains for self-contained documents/demos,
  and hosted apps pass their store in through the provider. No DOM lookup
  anywhere.
- **Logic tags v2 (NCTGraphite React components).** `<NCTGraphiteIf>`,
  `<NCTGraphiteShow>`, `<NCTGraphiteFor each="…" as="item">`,
  `<NCTGraphiteSwitch>`/`<NCTGraphiteCase>`/`<NCTGraphiteDefault>`,
  `<NCTGraphiteComputed>`, `<NCTGraphiteEffect>`, `<NCTGraphiteAction>`,
  `<NCTGraphiteCommand>`, `<NCTGraphiteValidate>`, `<NCTGraphiteHistory>`,
  `<NCTGraphiteQuery>`/`<NCTGraphiteApi>` keep the NoctCode logic-tag
  *surface* where sensible, but are implemented fresh in `NCTGraphite/`
  as ordinary React components/hooks over the binding evaluator and the
  scope context — `NCTGraphiteIf` evaluates and renders or withholds
  children, `NCTGraphiteFor` maps a bound array to its template child —
  never `document.querySelector('#id')` and never `window.*`. In JSX the
  same logic is available as the same components or plain hooks, so
  hand-written views and XML views share one semantics.
  `<NCTGraphiteCustom>` (the JS escape hatch) stays but is marked in
  metadata as `unsafe: true` so the validator/builder/AI treat it as an
  explicit, greppable exception — and it is excluded from documents the
  builder round-trips.
- **Flow wiring binds to the same scope.** A future `NCTGraphiteFlow`
  component's nodes/ports (the redesign successor to `noct-flow`, mined
  in Phase 3) should reference binding paths and commands from the
  catalog, so a wiring diagram and an XML document describe the same
  connections and can be checked by the same validator.

### 4.4 Layer 4 — the builder (NCTGraphite Studio)

Build on the document tree as a React app, once the library catalog is
stable (Phase 4); reuse the good ideas from NoctCode's builder pieces
(the metadata-driven fields of `noct-properties`, the categorization of
`noct-palette` once it reads the registry, `NCTGraphiteFlow` for wiring).
Because the library is React, the builder's preview is not a separate
renderer: the layout surface mounts the *same* `NCTGraphiteView` the apps
ship, with selection state layered on top.

- **Document model = parsed NCTGraphite AST with stable node ids.** Every
  edit (insert, delete, move, reparent, prop change) is a tree operation
  with undo/redo over the AST (the old canvas's undo-stack idea becomes
  tree-history; `NCTGraphiteHistory` can serve a running app, the builder
  needs its own structural history). Save/load is serialization of the
  AST back to XML text (formatted deterministically so diffs are clean) —
  this also gives you git-friendly UI files, which absolute JSON never will.
- **Two editing surfaces over one model.**
  (a) *Layout surface* (default): renders the live component tree
  (actual library components via `NCTGraphiteView`, not placeholders —
  fixing the old builder's "placeholder rendering" gap) with selection
  outlines, drag-to-reparent into highlighted container children areas,
  and layout guides from the parent layout tag (grid tracks, stack axis).
  Position is expressed as layout props (order, span, alignment), never x/y.
  (b) *Scene surface* (for `NCTGraphiteScene`/in-canvas overlays): a new
  React absolute-position surface informed by the old `noct-gui-canvas`
  and NibGlider's in-canvas overlays (real rendering, multi-select,
  alignment guides) for the UI class where absolute placement *is* the
  semantics.
- **Tree/layers panel + properties + palette** are three views of the
  registry: palette lists insertable tags (registry + `design` hints),
  tree shows the document, properties edits the selected node's props
  through metadata field types (string/number/boolean/enum/path-picker
  for `bindable` props). Adding a kit component automatically adds it to
  all three — no builder code change. This is the payoff of §4.1's
  generated registry.
- **Home: build NCTGraphite Studio inside the NCTGraphite repo**
  (Phase 4). NCTGraphite Studio edits the two functional apps' real
  screens through the same public library API every other app uses —
  not through private access — so a gap the Studio hits while editing
  NCT or NibGlider screens is a library gap, fixed in the library. The
  standalone NoctCode `gui-demo` becomes a fixture, not the product.

---

### 4.5 Repository and dependency model (adopted)

This is how NCTGraphite is shared while it is still being built.

- **One library repo, included — not copied — by every consumer.**
  This repository already uses the intended package layout:
  `packages/nctgraphite/` (the library) plus `apps/NCTGraphiteStudio/`
  (the builder, Phase 4). Each consuming project — `nct-project-manager`,
  `nibglider`, and later the noctappcode project — checks this repository
  in as a **git submodule** at `<app>/NCTGraphite/` and depends on the
  library by local workspace path (`"workspaces": ["NCTGraphite"]`,
  `"@nct/nctgraphite": "*"` in the consuming app). The submodule gives
  every app the full, editable library source, its own git history, and
  an exact pinned commit; the workspace link makes the app resolve that
  checkout at build/dev time instead of downloading a published package.
- **Fast co-development loop (the normal case).** With the submodule
  checked out and Vite pointed at the library source, editing
  `<app>/NCTGraphite/packages/nctgraphite/src/components/NCTGraphiteField.tsx`
  hot-reloads the host app — no publish, no version bump, no reinstall.
  Library change order is: (1) implement + test the library change in
  this repository's `packages/nctgraphite/` against its own suite,
  (2) commit and push it here (that commit is the NCTGraphite release for
  this purpose), (3) commit the consuming app with the new submodule
  pointer plus the app code that uses the change. Never edit the
  installed copy under `node_modules`; it is generated.
- **Stability through the submodule pointer.** The other app updates only
  when it chooses to: pull the submodule forward, test, commit its own
  pointer bump. A library change therefore cannot silently break
  NibGlider from inside an NCT commit — breakage is opt-in at upgrade
  time, where the diff is visible. CI builds the app against its recorded
  submodule commit (clone with `--recurse-submodules`); tagged library
  releases/npm publishing are added later for outside consumers, not
  required while the consumers are your own sibling projects.
- **Contextual contribution, as requested.** Noctappcode adds this
  repository as the same submodule, builds new components for its own
  screens, and contributes them back through the same workflow: library
  commit first, then the app's pointer bump. Once everything worth keeping
  from the external `noct-code-appkit` project lives in this repository's
  `packages/nctgraphite/`, archive the noctcode repo with a README
  pointer — the dependency arrow between noctappcode and NCTGraphite is
  consumer → library, never the reverse.
- **Why a submodule and not a git or npm URL dependency.** A
  `github:`/`git+ssh:` dependency also pins a commit, but the checked-out
  library source lives read-only inside `node_modules` and the edit loop
  degrades to push → reinstall → rebuild. Use URL/npm dependencies only
  for stable outside consumers later; keep submodule + workspace linking
  for every project that edits the library while building its app.

## 5. A worked example (what "done" looks like)

The same screen in the three worlds, to make the target concrete.
NibGlider's real `src/ui/windows/settings.xml` today:

```xml
<window id="settings" title="Settings">
  <section id="projection" title="Projection">
    <switch key="quadMapping" label="Frame mapping">
      <option value="bilinear" label="Bilinear" />
      <option value="projective" label="Perspective" />
    </switch>
    <toggle key="perspectiveCircle" label="Use perspective on Circle" />
  </section>
</window>
```

The NCTGraphite version of an equivalent NCT Project Manager settings view —
one dialect for layout *and* controls *and* logic, bindings instead of
hand-written `BINDINGS` records per window:

```xml
<NCTGraphiteView id="project-settings" title="Project Settings">
  <NCTGraphiteStore name="project" schema="Project" />  <!-- host-supplied in apps -->
  <NCTGraphiteDock>
    <NCTGraphiteToolbar dock="top">
      <NCTGraphiteButton command="project.save" label="Save" primary="true" />
      <NCTGraphiteButton command="project.close" label="Close" />
    </NCTGraphiteToolbar>
    <NCTGraphiteStack dock="fill" direction="column" gap="3" padding="4">
      <NCTGraphitePanel title="General">
        <NCTGraphiteField bind:value="project.name" label="Name" type="text" />
        <NCTGraphiteField bind:value="project.category" label="Category" type="text" />
        <NCTGraphiteSwitch bind:value="project.mode" label="Mode">
          <NCTGraphiteOption value="individual" label="Individual" />
          <NCTGraphiteOption value="overview" label="Overview" />
        </NCTGraphiteSwitch>
      </NCTGraphitePanel>
      <NCTGraphitePanel title="Modules">
        <NCTGraphiteFor each="features.all" as="f">
          <NCTGraphiteToggle bind:value="f.enabled" label="{{ f.label }}" />
        </NCTGraphiteFor>
      </NCTGraphitePanel>
      <NCTGraphiteIf when="project.dirty">
        <NCTGraphiteWell mono="true">Unsaved changes</NCTGraphiteWell>
      </NCTGraphiteIf>
    </NCTGraphiteStack>
    <NCTGraphiteStatusbar dock="bottom" bind:text="project.statusLine" />
  </NCTGraphiteDock>
</NCTGraphiteView>
```

In React the host shrinks to supplying scope and mounting the document —
no per-window renderer, no duplicated `SwitchControl`:

```tsx
const scope = createNCTGraphiteScope({ stores: { project: projectStore },
                            commands: { 'project.save': save, 'project.close': close } });
return <NCTGraphiteView document={settingsXml} scope={scope} />;
```

And in NCTGraphite Studio, that file *is* the canvas: the tree panel shows
`NCTGraphiteView > NCTGraphiteDock > NCTGraphiteStack > NCTGraphitePanel >
NCTGraphiteField…`, the properties panel edits `columns`/`gap`/`bind:value`
from metadata, and "export" is just saving the XML. An AI asked for "add a
tags field under Category" emits one
`<NCTGraphiteField bind:value="project.tags" …/>` line that the validator,
NCTGraphite Studio, the runtime, and the React host all accept unchanged.
That is the repetition fix.

---

## 6. Designing for the AI author (not just the human author)

Your first paragraph named the real constraint: today the only authoring
surface is a text prompt, so the AI invents fresh markup every time and
there is nothing to adjust afterward except more generated code. The kit
only pays off if AI generation becomes *assembly with a checkable contract*:

1. **The catalog is the prompt.** Generate `nctgraphite.catalog.json` +
   a compact Markdown rendering from the registry (§4.1) and give it to
   the coding agent as context (an `AGENTS.md` include, as both React
   repos already use that mechanism). The AI selects NCTGraphite tags/props
   from a closed vocabulary instead of inventing DOM/CSS. Regenerate on
   every library build; stale catalogs fail the build like NibGlider's
   wired-command test fails on unwired commands.
2. **Validation is the feedback loop.** `parseNCTGraphite` + registry
   validator run in Node with no browser, so an agent (or CI, or
   NCTGraphite Studio on save) gets `"<NCTGraphiteField> prop 'colour' is
   not a prop of NCTGraphiteField (did you mean 'color'?)"`-class errors
   before anything renders. This
   is the property NibGlider's parsers already demonstrate
   (`tests/window-xml.test.mjs` asserts specific rejection cases); extend
   it from 3 dialects to the whole catalog. Unknown *bindings* are a
   validator warning with the host's scope listing valid paths — the AI
   can then fix its own output in one iteration.
3. **Deterministic layout removes the un-checkable part.** AI-generated
   raw flex/CSS cannot be verified without rendering; AI-generated
   `<NCTGraphiteStack gap="2">` / `<NCTGraphiteGrid columns="240px 1fr">`
   either validates or does not, and its result is predictable from the
   tokens. Keep raw CSS out of documents (a `style` escape prop may exist
   but is flagged like `<NCTGraphiteCustom>`), so generated UI stays
   inside the NCTGraphite theme by construction.
4. **Small documents, composable by reference.** `<NCTGraphiteDefine>`
   (the validated successor idea to `noct-define`, registered in the
   NCTGraphite component registry with metadata instead of
   `new Function` script evaluation) lets a repeated pattern become a
   named NCTGraphite tag once and be reused — by humans, the NCTGraphite
   Studio palette, and the AI — instead of being re-expanded on every
   generation.
5. **Round-trip is the adjustability story.** Because NCTGraphite Studio,
   the runtime, and the AI all read/write the same XML text, "adjust the
   UI after it is made" becomes: open the file in NCTGraphite Studio,
   drag in the tree, edit a prop, save — the diff is a few XML lines,
   reviewable in git. JSX does not round-trip through a GUI builder;
   XML does. This is the strongest argument for the XML investment and
   should be stated as the project's purpose in the NCTGraphite README.

---

## 7. Phased plan (each phase leaves all three projects working)

Ordering principle: **functional projects first, donor project last.**
Unify what the external `nct-project-manager` and `nibglider` projects
already duplicate into this repository's library; add the XML/binding
core; only then mine the external `noct-code-appkit` project against the
two apps' backlogs; build NCTGraphite Studio last, on a stabilized
catalog. No phase requires pausing feature work in either functional app;
library work lands as ordinary versioned dependencies, one migrated
screen at a time.

### Phase 0 — Stand up this repository from the two functional apps

- **Use the existing project**: this standalone `NCTGraphite` GitHub
  repository already contains `packages/nctgraphite/` (package
  `@nct/nctgraphite`) in the layout described in `README.md`. Wire this
  repository into both external functional apps as a git submodule
  (`<app>/NCTGraphite/`) + npm workspace dependency (§4.5), with Vite
  resolving `packages/nctgraphite/src/` so edits hot-reload in both apps.
  Naming per §9: every export, file, and tag is `NCTGraphite…` in full.
- **Duplication inventory (the seed list)**: diff the two apps' UI code
  and record, per candidate, both call sites. Expected first tranche
  (verify, don't assume): button, text/number input, select, checkbox,
  toggle, segmented switch, field row, modal/window chrome, tabs, menus,
  toolbar/menubar/statusbar, empty state, plus the layout primitives both
  shells hand-roll (`NCTGraphiteStack/Grid/Dock/Panel/Well/Splitter`) and
  the token theme (NCT `--bg-0…3` × NibGlider `--dp-*` × NoctCode token
  naming). Anything with only one call site stays in its app (rule of two).
- **Build the seed components fresh** in `packages/nctgraphite/`
  against the canonical tokens, with both external apps' code open as
  reference (§4.1). Each component lands with its `NCTGraphite…Meta`, a
  generated-registry entry, and tests. The metadata idea comes from the
  external NoctCode project; no NoctCode code is ported in this phase.
- **Prove it in both apps, one screen each**: migrate NCT Project Settings
  (or the app shell) and one NibGlider settings window onto the library,
  deleting the app-local originals (`src/controls/*`, the duplicated
  `SwitchControl`/`ToggleControl`). Token aliases for the old variable
  names live exactly one release, then are deleted.
- Ship the second theme (`NCTClassicDark`, rectangular bevelled, from
  the NoctCode styleguide) alongside the default `NCTGraphiteDark` so
  theming is proven, not asserted.

*Exit criteria:* both apps build and pass their existing tests while
importing `@nct/nctgraphite` via the submodule + workspace (§4.5);
at least one real screen in each app renders entirely from library
components with no app-local standard controls left on that screen; the
generated `nctgraphite.catalog.json` lists every exported NCTGraphite
tag; no library component lacks a call site in at least one functional
app; both external apps' repositories record the same `NCTGraphite`
submodule commit in CI (cloned with `--recurse-submodules`).

### Phase 1 — Language core (into this repository; NibGlider as donor)

- Reimplement `xmlParser.ts` from the external NibGlider checkout in
  `packages/nctgraphite/src/xml/`; add text nodes + tests ported from
  NibGlider's suites. Implement `parseNCTGraphite` + the registry
  validator + hand-written domain rules for the structural NCTGraphite tags.
- Implement the safe binding evaluator (paths/comparison/logic/host
  functions) with Node tests; define `NCTGraphiteBindingScope`, the
  `NCTGraphiteScope` context provider, the `useNCTGraphiteBinding` hook,
  and the `NCTGraphiteStore` component; implement the logic tags on them
  as NCTGraphite React components/hooks (no eval anywhere — grep for
  `new Function` in `packages/nctgraphite/` returns only the marked
  `NCTGraphiteCustom` escape hatch).
- React renderer: `NCTGraphiteView` walks the AST and renders the
  NCTGraphite component registry (full tag name → React component),
  wiring `bind:` props through the scope context. This is small *because*
  the library is React: no property/attribute translation, no event
  bridging.
- First XML proofs in the functional apps: NCT Project Settings as a
  `.nctgraphite.xml` document bound to its Zod store, and one NibGlider
  window (`settings` or `document-settings`) rendered through
  `NCTGraphiteView` with an engine-backed `NCTGraphiteBindingScope`
  (keeping commit-only secrets semantics).

*Exit criteria:* NibGlider's three XML fixtures and the two proof screens
parse as NCTGraphite documents and render via `NCTGraphiteView`; invalid
documents produce specific validator errors in Node tests; no
`new Function` outside the marked escape hatch.

### Phase 2 — Widen adoption in both functional apps

- **NCT**: migrate the app shell (`App.tsx` header/mode-switch/tabs/
  bottom-nav) and then the views onto NCTGraphite components, JSX first;
  convert views to `.nctgraphite.xml` documents where the XML form pays
  (settings, forms, lists with repeated structure). Delete
  `src/controls/` as its screens migrate. Views contain no raw
  `<button>/<input>/<select>` (lint-enforced).
- **NibGlider**: migrate windows, then menus, then panels onto the
  library in that order — windows via Phase 1's renderer, menus from
  NCTGraphite menu documents through `NCTGraphiteMenubar`/
  `NCTGraphiteContextMenu`, panels onto layout primitives. Its three
  parsers shrink to AST→spec projection adapters during this phase and
  are deleted as each surface moves. In-canvas overlays come last.
  Paper.js canvas UI, drawing tools, and the key-click system stay
  app-local throughout — they are NibGlider's product, not library material.
- New standard-control needs discovered during adoption go to the library
  backlog (rule of two), not into app-local markup.

*Exit criteria (per surface):* the surface renders from NCTGraphite
components/documents in the running app; the app-local originals for that
surface are deleted, not dual-maintained; both apps' existing test suites
pass (NibGlider's XML tests now run against the NCTGraphite parser).

### Phase 3 — Mine external `noct-code-appkit` into this repository (on demand)

Only now does the donor project enter, and only against named needs from
Phases 0–2. Triage its 63 tags into three buckets, in this order
(per-tag spec: `NOCTCODE-APPKIT-COMPONENT-INVENTORY.md` in this repository):

- **Build fresh in React in `packages/nctgraphite/`** (simple, proven, and asked for):
  `NCTGraphiteSlider`, `NCTGraphiteMeter`, `NCTGraphiteListbox`,
  `NCTGraphiteSegmented` (if distinct from `NCTGraphiteSwitch`),
  `NCTGraphiteTooltip`, `NCTGraphiteKey`, `NCTGraphiteDisplay`,
  `NCTGraphiteScene`, `NCTGraphiteChart` — each as a new
  `NCTGraphite…` React component written from scratch against the
  inventory description plus the Noct component's `*Meta` (props, slots,
  emits, examples) as the behavior contract. Mine the donor source only
  for visual and interaction details (CSS values, keyboard handling,
  edge cases); no donor logic code crosses over, so donor defects
  (`new Function()` evaluators, `querySelector` store lookup,
  `window`-leaked state, hardcoded registry/palette lists) are not
  carried forward. A build is scheduled only when a
  functional app (or NCTGraphite Studio, Phase 4) has a screen for it.
- **Redesign, never rebuild-from-donor**: the logic tags (already rebuilt in Phase 1
  from their surface design), `noct-store` (superseded by
  `NCTGraphiteStore`/`NCTGraphiteScope`), `noct-flow`/`noct-flow-node`
  (rebuilt as `NCTGraphiteFlow` for Studio's wiring view), and
  `noct-define` (superseded by `NCTGraphiteDefine` in the registry).
- **Defer indefinitely**: `noct-player`, `noct-upload`, `noct-auth-form`,
  `noct-user-menu`, `noct-protected`, and the absolute-position
  `noct-gui-canvas`/`noct-gui-item` model (superseded by NCTGraphite
  Studio's tree builder; its interaction ideas inform the scene surface).
  These move only when a functional app files a concrete need.
- When a bucket empties, archive the external `noct-code-appkit`
  project with a README pointer to this NCTGraphite repository; do not
  keep two kits building.

*Exit criteria:* every ported component has a shipping call site in a
functional app (or Studio) in the same change that adds it; no component
is ported "for completeness."

### Phase 4 — NCTGraphite Studio, the builder (inside the NCTGraphite repo)

- `apps/NCTGraphiteStudio/` in the `NCTGraphite` repo, consuming the
  `packages/nctgraphite/` library through the repo's own workspace —
  exactly like an external project. It opens and edits the functional
  apps' `.nctgraphite.xml` files with no private access to either app.
- AST document model with ids + structural undo/redo + deterministic
  XML serialization (save/load to the apps' own `.nctgraphite.xml` files).
- Layout surface (live rendering via the shipped `NCTGraphiteView`,
  reparent-into-container, layout guides), tree panel, metadata properties
  panel (the `noct-properties` idea, built as NCTGraphite React
  components), registry palette (the `noct-palette` idea, reading the
  generated NCTGraphite registry). Use `NCTGraphiteFlow` for a
  bindings/wiring view over the same scope.
- Build a new React scene surface for `NCTGraphiteScene`/overlay
  documents only (informed by the old canvas and NibGlider overlays).

*Exit criteria:* the Phase-1 NCT settings document can be opened in
NCTGraphite Studio, restructured (move an `NCTGraphiteField`, add an
`NCTGraphiteToggle`, change a binding), saved back into the NCT app
checkout, and the running NCT app reflects it; round-trip produces a
clean, minimal XML diff; every NCTGraphite tag in the catalog appears in
the Studio palette with its metadata props editable, with no Studio code
change per component.

### Phase 5 — Logic & data depth (as the functional apps demand)

- Harden `NCTGraphiteTable` into the data grid; add `NCTGraphiteTree`,
  and the calendar/schedule lane (NCT `TASKS.md` Phase 5 spec) as
  NCTGraphite tags with metadata — each admitted by the rule of two.
- `NCTGraphiteQuery`/`NCTGraphiteApi` with caching/polling on the binding
  evaluator; form validation (`NCTGraphiteValidate` + field errors) wired
  to Zod schemas where hosts provide them. NCT Phases 7–8 (REST/MCP) then
  validate the same schemas server-side, as already planned in its
  `TASKS.md`.

### Phase 6 — NCTGraphite Studio hardening & mobile pass (only when earned)

- Harden NCTGraphite Studio inside the `NCTGraphite` repo until it can
  rebuild the NCT shell *and* a NibGlider window unaided; its shippable
  builds are produced from the repo's own workspace, independent of
  either app's release cycle.
- Mobile: the foundation is carried into the NCTGraphite theme from the
  start (`data-app-mode`, density, pointer events, 44px targets scoped
  to mobile). Do the touch/layout pass per view with NCTGraphite
  Studio's responsive preview; no component fork.

---

## 8. Project-by-project: what each contributes and what changes

| Concern | Canonical source | This NCTGraphite repository | `nct-project-manager` | `nibglider` | `noct-code-appkit` |
|---|---|---|---|---|---|
| Component runtime | NCTGraphite (React) | Own GitHub repo `@nct/nctgraphite`, included by each app as a submodule + workspace dep (§4.5) | Imports NCTGraphite components; deletes `src/controls/` as screens migrate | Imports NCTGraphite for windows/menus/panels | Donor backlog from Phase 3; later a consumer itself, never a host dependency |
| Layout system | NCTGraphite `NCTGraphiteStack/Grid/Dock/…` | Builds the primitives both shells hand-roll | First consumer; edits own views in NCTGraphite Studio | Consumer for panels/shell | `noct-stack/grid` are behavior references |
| Theming | `NCTGraphiteTheme.css` + `themes.json` | Owns tokens + all three themes (`NCTGraphiteDark` default, `NCTClassicDark`, reserved `NCTTechDesMVD`) | `--bg-0…` mapped once; its current look is the default theme | `--dp-*` mapped once, window chrome first | Token naming + styleguide are design input (→ `NCTClassicDark`) |
| XML parser | NCTGraphite (from NibGlider) | Hosts parser + validator + `NCTGraphiteView` | Imports `.nctgraphite.xml` via `?raw` | Donates parser; deletes its 3 parsers via adapters (Phase 2) | XML surface ideas (`noct-define`) mined in Phase 3 |
| Bindings/logic | NCTGraphite evaluator + `NCTGraphiteScope` | Implements evaluator, scope, logic tags | Zod store is the model host scope | `FieldBinding` contract generalizes to `NCTGraphiteBindingScope` | Logic-tag surface is the design; eval engine is discarded |
| Builder | NCTGraphite Studio (in NCTGraphite repo) | `apps/NCTGraphiteStudio`; consumes the library like an external app | Opens its views in NCTGraphite Studio; contributes back through the submodule loop | Scene-surface customer (in-canvas overlays) | Palette/properties/flow ideas mined in Phase 4 |
| Tests | Node-runner pattern (NibGlider) | Catalog/parser/validator/component tests | Keeps app tests; adds NCTGraphite XML validity tests | Existing suites guard every migration step | No tests to inherit; its demos are fixtures |

What each project should **stop** doing immediately (cheap, high value):

- This repository: stop admitting components without a functional-app
  call site (rule of two); stop any shortened form of the project name in
  new code, files, or tags (§9).
- External `noct-code-appkit`: stop treating it as the future kit. Freeze
  new component work except fixes its demos need; its roadmap items enter
  this repository's backlog only through Phase 3 triage. Stop any new
  `new Function` logic anywhere.
- External `nct-project-manager`: stop adding `ctl-*` controls and
  per-view bespoke markup for standard chrome; enforce its own AGENTS.md
  rule (new control need → NCTGraphite library proposal first). Its
  Zod/store/preset work continues unchanged — it is already
  library-shaped thinking.
- External `nibglider`: stop extending the three dialects with new tags
  (new window controls go through the NCTGraphite validator design); stop
  duplicating renderer controls between windows (share via
  `WindowFieldControls`, as already begun, until the NCTGraphite window
  renderer replaces both).

---

## 9. Naming and migration rules

- **The project name is always shown in full as NCTGraphite.** This
  repository, its `NCTGraphite/` checkout folder in consuming projects,
  package `@nct/nctgraphite`, documents `*.nctgraphite.xml`, themes
  `NCTGraphiteTheme.css`/`NCTGraphiteDark`, catalog
  `nctgraphite.catalog.json`, builder **NCTGraphite Studio**.
  The shortened suffix form of the name never appears on its own — not
  in prose, package names, file names, theme names, function names, or
  tags. (Lowercase `nctgraphite` inside file/package identifiers is the
  same full name in the casing those contexts require; it is not a
  shortening.) "NoctCode/Noct" survives only in git history and in
  temporary XML input aliases (below).
- **Tags always say NCTGraphite.** Every public library name carries the
  full prefix in PascalCase: components (`NCTGraphiteStack`,
  `NCTGraphitePanel`, `NCTGraphiteField`), providers and hooks
  (`NCTGraphiteScope`, `NCTGraphiteView`, `useNCTGraphiteBinding`),
  metadata consts (`NCTGraphiteStackMeta`), and — identically — XML tags
  (`<NCTGraphiteStack>`, `<NCTGraphiteField …>`). JSX and XML therefore
  name the same component the same way, and NCTGraphite tags can never
  collide with app-local `Stack`/`Field` components. Checked-in app code
  must not re-alias NCTGraphite imports to shorter local names.
- XML input aliases are migration-only: during Phases 1–2 the validator
  may accept the old `noct-*` spellings and NibGlider's lowercase tags on
  *input*, but NCTGraphite Studio and every serializer always write the
  full `NCTGraphite…` form back out. Aliases are deleted at the end of
  Phase 2 (no permanent dual naming — it would double every validator
  and palette surface). There are no custom-element names in this plan;
  the old shortened element-prefix idea is dropped with Lit.
- No backward-compatible shims beyond a single migration window, per your
  standing instruction: token aliases and tag aliases are deleted at the
  end of the phase that introduces their replacements, with the deletion
  listed as an exit criterion so it cannot be forgotten.

---

## 10. Risks, alternatives considered, and open decisions

**Why a shared library from the functional apps, and why React.** This
revision's central judgment is ordering: the previous version converted
the experimental kit first, which would have spent the build budget on
63 components no shipping app has validated, with APIs answerable to
demos rather than to two different real applications. Seeding
`NCTGraphite/` from the functional apps' actual duplication means every
library API is forced to generalize across a task manager and a vector
editor from its first release — the strongest available test of "is this
really kit material." React is settled for the reason given earlier:
both hosts are React 19, no non-React consumer or CDN requirement is
named, and any Lit/wrapper seam would be paid in both apps on every
feature. **Reversal trigger (runtime only):** revisit Lit only when a
*specific, named* non-React consumer, third-party embed, or public
CDN/HTML distribution exists — and even then, prefer a thin Web-Component
shell around the NCTGraphite React library for that one surface.

**Risks.**
(1) *Premature abstraction* — extracting after a single use, or designing
library APIs from one app's habits. Mitigate with the rule of two, the
Phase-0 duplication inventory with both call sites recorded, and the
exit criterion that no library component lacks a functional-app call site.
(2) *Lowest-common-denominator design* — a shared button/settings window
that fits neither app well. Mitigate by designing fresh against the
NCTGraphite tokens (not averaging the two sources), keeping genuinely
app-specific behavior behind props/bindings/commands, and letting an app
keep a local component when the shared API would need app-domain concepts.
(3) *Extraction by copy-paste* — importing NibGlider's engine coupling or
NCT's thin-wrapper shallowness into the library. Mitigate: both apps'
code is reference material; the library implementation is new, and the
type boundary is explicit (no engine types, no task-domain types in
`NCTGraphite/` — hosts adapt through `NCTGraphiteBindingScope`).
(4) *XML verbosity, amplified by the full NCTGraphite prefix* — tags are
long (`<NCTGraphiteStatusbar …>`). Accepted deliberately: documents are
authored by AI and NCTGraphite Studio, read in diffs, and never confused
with app-local components. Mitigate by metadata defaults (only
non-default props are written on save) — never by shortening the name.
(5) *Scope creep in NCTGraphite Studio* — the old canvas accumulated
undo, multi-select, guides, and export ambitions at once (`TASKS.txt`).
The Phase-4 MVP is deliberately only: tree ops, live layout surface,
properties, save/load. Flow wiring and the scene surface follow.
(6) *NibGlider disruption* — it is the most mature codebase; Phase 2 is
per-surface, adapter-first, test-guarded, chrome-only, and reversible
per step. Its Paper.js/key-click core is never in scope.

**Alternatives considered and rejected.**
(a) *Convert `noct-code-appkit` to React first and make it the kit* (the
previous version of this plan): one mechanical conversion, but it validates
nothing — APIs stay hypothetical until the functional apps adopt them,
and the build budget is spent on components that may never be used.
Demoted to Phase-3 donor mining, where each fresh build is justified by a
named screen.
(b) *Keep Lit + generated React wrappers* (the first version of this
plan): preserves framework-agnostic tags and CDN delivery, but pays the
wrapper seam forever for consumers that do not exist. Fallback only if
the reversal trigger fires.
(c) *Keep three dialects, just document them*: preserves all duplication
in §3; NCTGraphite Studio would need three document models.
(d) *Absolute-position builder with smarter export* (e.g. emit flex):
layout inference from pixels is lossy and unreviewable; structural
authoring is the point of StackPanel-style layout.
(e) *Adopt an off-the-shelf React kit (MUI/shadcn) + separate builder*:
fastest to a polished app, but abandons the NCTGraphite tag language, the
AI catalog contract, the dark-pro density you have art-directed, and the
NibGlider XML investment — i.e. abandons the stated goal.

**Decisions needed from you** (runtime, sequencing, name, the
submodule dependency model, and the default theme are now settled per
your answers; NCTGraphite Studio lives in the NCTGraphite repo per your
answers):
1. ~~Confirm `NCTGraphiteDark` (rectangular, bevelled) as the default
   NCTGraphite theme with NCT's teal/rounded look as theme #2~~ —
   resolved: `NCTGraphiteDark` is NCT's current look (default);
   NoctCode rectangular ships as `NCTClassicDark`; `NCTTechDesMVD`
   reserved for grid-paint-labs-idiom demo artifacts. See `themes.json`.

---

## 11. Immediate next actions (first two weeks)

1. This repository already exists; keep its package
   (`packages/nctgraphite/`, `@nct/nctgraphite`) and naming rule (§9) as
   created. Add this repository as a submodule + workspace dependency in
   both external apps (§4.5); write the token-mapping table for NCT and
   NibGlider.
2. Run the Phase-0 duplication inventory across the external
   `nct-project-manager` and `nibglider` checkouts: per candidate
   component, record both call sites (or the roadmap citation). That list
   — not NoctCode's catalog — is the library's first backlog, in priority
   order.
3. Build the seed layout + controls in `packages/nctgraphite/` with
   `NCTGraphite…Meta` on each; generate the registry/catalog; migrate one
   pilot screen per app (NCT Project Settings; one NibGlider settings
   window) and delete the app-local originals on those screens.
4. Reimplement NibGlider's `xmlParser.ts` design plus its parser tests in
   `packages/nctgraphite/src/xml/`; spec (one page) the binding grammar +
   `NCTGraphiteBindingScope` API against NibGlider's `FieldBinding` and
   NCT's Zod store. This is Phase 1's design input.
5. Triage the external `noct-code-appkit` project into the Phase-3
   buckets (port / redesign / defer) in a backlog file in this repository,
   so donor mining is a queue, not a future rediscovery project.

If those five land, every later step is incremental: each migrated NCT
view and NibGlider window makes the NCTGraphite library, the language,
and eventually NCTGraphite Studio more real at the same time — which is
the property the current three-way split cannot give you.

---

### Sources (read directly from companion checkouts during the original review)

These files are evidence and migration pointers. They live in the three
separate companion projects, not in this repository.

- NoctCode kit donor: `noct-code-appkit/src/main.ts`,
  `src/lib/core/{NoctElement,metadata}.ts`, `src/lib/layout/*.ts`,
  `src/lib/logic/*.ts`, `src/lib/gui/*.ts`, `src/lib/meta/*.ts`,
  `src/lib/app/noct-theme.ts`, `src/styles/theme-tokens.css`,
  `src/demos/views/demo-{gui,flow}.ts`, `README.md`, `TASKS.txt`,
  `TASKS-1.md`, `docs/demo-app-chrome.md`,
  `docs/plans/2026-09-26-desktop-usability-mobile-foundation.md`
- NCT reference app: `nct-project-manager/AGENTS.md`, `TASKS.md`,
  `src/App.tsx`, `src/controls/*`, `src/index.css`, `src/schemas.ts`,
  `src/types.ts`, `src/views/*.tsx`
- NibGlider XML renderer: `nibglider/src/ui/{xmlParser,menuXML,windowXML,inCanvasGui}.ts`,
  `src/ui/{menus/menus.xml,windows/*.xml,inCanvas/*.xml}`,
  `src/components/{SettingsWindow,DocumentSettingsWindow,WindowFieldControls,WindowFieldBindings}.tsx`,
  `tests/{window-xml,menu-xml,export-frame}.test.mjs`, `agents.md`



