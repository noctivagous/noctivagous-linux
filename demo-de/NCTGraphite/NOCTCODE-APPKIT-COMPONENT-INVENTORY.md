# noct-code-appkit Component Inventory

Source: `noct-code-appkit/src/lib/` (Lit 3 + TypeScript, entry at `src/main.ts`).
Descriptions below are the components' own `NoctXxxMeta.description` strings —
what each component should do. Tags are the registered custom-element names.

Counts: 63 components in 8 groups, plus core base infrastructure.

```
noct-code-appkit/src/lib/
├── core/            base class + metadata contract (not renderable components)
├── layout/          11 components — spatial composition
├── data/             4 components — state, forms, tables, charts
├── logic/           17 components — declarative behavior without JS
├── meta/             2 components — runtime definition + AI introspection
├── widgets/          8 components — compact pro-app controls
├── flow/             2 components — visual data-flow editor
├── gui/              4 components — drag-and-drop GUI builder (NOCTGUI)
└── app/             15 components — app shell, chrome, and services
```

## core/ — base infrastructure

No tags. Everything else builds on these.

- `core/NoctElement.ts` — base class for all components (lifecycle, metadata support, debug mode).
- `core/metadata.ts` — `NoctComponentMeta` contract and `WithMetadata` decorator; every component exports metadata so AI can query capability without vector search.

## layout/ — spatial composition (11)

- `noct-grid` (`layout/noct-grid.ts`) — CSS Grid layout with deterministic behavior for reliable AI composition.
- `noct-stack` (`layout/noct-stack.ts`) — flexbox stack layout for vertical or horizontal arrangement.
- `noct-slot` (`layout/noct-slot.ts`) — named slot container for slot-based composition.
- `noct-scene` (`layout/noct-scene.ts`) — GUI scene container with snap points and zoom/pan support.
- `noct-splitter` (`layout/noct-splitter.ts`) — resizable split panes with mouse-drag and keyboard-adjustable divider.
- `noct-tabview` (`layout/noct-tabview.ts`) — tab view with selectable tabs and associated content panels via named slots.
- `noct-tag` (`layout/noct-tag.ts`) — generic container element replacing div/header/span in NoctCode apps.
- `noct-toolbar` (`layout/noct-toolbar.ts`) — toolbar grouping icon buttons, toggles, and actions.
- `noct-panel` (`layout/noct-panel.ts`) — titled app panel: beveled container with titlebar (title, optional subtitle and actions) plus body slot.
- `noct-pane` (`layout/noct-pane.ts`) — headerless beveled container for control clusters, toolbar rows, and sidebar sections.
- `noct-well` (`layout/noct-well.ts`) — recessed readout surface for outputs, logs, previews, and read-only values.

## data/ — state and structured display (4)

- `noct-store` (`data/noct-store.ts`) — reactive signal store for state management.
- `noct-form` (`data/noct-form.ts`) — form component with schema-based field generation.
- `noct-table` (`data/noct-table.ts`) — data table with sorting, selection, and store binding.
- `noct-chart` (`data/noct-chart.ts`) — chart with bar, line, and pie chart types.

## logic/ — declarative behavior without JavaScript (17)

- `noct-action` (`logic/noct-action.ts`) — declarative event-to-action binding without JavaScript.
- `noct-api` (`logic/noct-api.ts`) — declarative HTTP requests, no handwritten `fetch()`.
- `noct-query` (`logic/noct-query.ts`) — declarative data query with cache, polling, and store binding.
- `noct-if` (`logic/noct-if.ts`) — conditional rendering on an expression (removes from DOM).
- `noct-show` (`logic/noct-show.ts`) — conditional rendering via `hidden` attribute (keeps in DOM).
- `noct-for` (`logic/noct-for.ts`) — iterates an array and stamps a template per item.
- `noct-switch` (`logic/noct-switch.ts`) — multi-way conditional; renders the first matching `noct-case`.
- `noct-case` (`logic/noct-case.ts`) — one branch inside `noct-switch`; renders when its value matches.
- `noct-default` (`logic/noct-default.ts`) — fallback branch inside `noct-switch`; renders when no `noct-case` matches.
- `noct-computed` (`logic/noct-computed.ts`) — derived state that updates automatically when its source changes.
- `noct-effect` (`logic/noct-effect.ts`) — reactive side-effect watching store values and running a function on change.
- `noct-debounce` (`logic/noct-debounce.ts`) — debounces rapid store changes, emitting the settled value after a quiet period.
- `noct-defer` (`logic/noct-defer.ts`) — delays slot-content rendering until a condition holds, a timeout elapses, or the browser is idle.
- `noct-history` (`logic/noct-history.ts`) — undo/redo history manager tracking and reverting state changes.
- `noct-command` (`logic/noct-command.ts`) — named command with optional keyboard shortcut, invocable programmatically or via command palette.
- `noct-validate` (`logic/noct-validate.ts`) — validates store data against declarative rules with structured results.
- `noct-custom` (`logic/noct-custom.ts`) — escape hatch for custom JavaScript when no component fits.

## meta/ — runtime definition and introspection (2)

- `noct-define` (`meta/noct-define.ts`) — defines new components at runtime via HTML (a `<template>` plus optional module script).
- `noct-registry` (`meta/noct-registry.ts`) — component introspection for AI; lists registered components with their metadata, props, and descriptions.

## widgets/ — compact pro-app controls (8)

- `noct-slider` (`widgets/noct-slider.ts`) — compact slider for timelines, volumes, and scrubbers with pointer and keyboard control.
- `noct-meter` (`widgets/noct-meter.ts`) — compact level meter for audio peaks, render progress, and export status.
- `noct-listbox` (`widgets/noct-listbox.ts`) — compact listbox for tracks, takes, layers, and document lists with full keyboard support.
- `noct-toggle` (`widgets/noct-toggle.ts`) — compact switch for snap, solo, mute, and link toggles with keyboard support.
- `noct-segmented` (`widgets/noct-segmented.ts`) — compact single-select segmented control for tool modes and snap units.
- `noct-tooltip` (`widgets/noct-tooltip.ts`) — hover- and focus-triggered tooltip for icon buttons and meters, dismissible with Escape.
- `noct-key` (`widgets/noct-key.ts`) — beveled keypad key for calculators and pro-app key grids; emits `key-press` with its key value.
- `noct-display` (`widgets/noct-display.ts`) — recessed right-aligned readout with an expression history line and a main value line.
- Supporting (not a component): `widgets/calc-engine.ts` — framework-free calculator engine (token evaluation, result formatting) shared by views and future components.

## flow/ — visual data-flow editor (2)

- `noct-flow` (`flow/noct-flow.ts`) — visual data-flow wiring editor canvas with nodes, ports, and SVG wires.
- `noct-flow-node` (`flow/noct-flow-node.ts`) — one node in that editor, with input/output ports.
- Supporting (not a component): `flow/noct-flow-types.ts` — shared port/node/wire types.

## gui/ — drag-and-drop GUI builder, NOCTGUI (4)

- `noct-gui-canvas` (`gui/noct-gui-canvas.ts`) — drag-and-drop builder canvas; the main NOCTGUI workspace.
- `noct-gui-item` (`gui/noct-gui-item.ts`) — draggable, resizable wrapper for components placed on the canvas.
- `noct-palette` (`gui/noct-palette.ts`) — component palette listing available components for drag-and-drop.
- `noct-properties` (`gui/noct-properties.ts`) — property editor panel showing and editing the selected component's properties.

## app/ — app shell, chrome, and services (15)

- `noct-app` (`app/noct-app.ts`) — root application component wrapping the entire app.
- `noct-theme` (`app/noct-theme.ts`) — theme provider injecting CSS design tokens and managing app modes.
- `noct-router` (`app/noct-router.ts`) — SPA router with hash-based routing.
- `noct-window` (`app/noct-window.ts`) — floating, draggable, resizable window panel.
- `noct-modal` (`app/noct-modal.ts`) — modal dialog with focus trapping, animations, and store binding.
- `noct-toast` (`app/noct-toast.ts`) — toast notification system with stackable messages and action callbacks.
- `noct-menubar` (`app/noct-menubar.ts`) — desktop menubar with keyboard-navigable dropdown menus.
- `noct-statusbar` (`app/noct-statusbar.ts`) — desktop status bar with left, center, and right sections.
- `noct-player` (`app/noct-player.ts`) — media player for audio/video with custom controls and playlist support.
- `noct-auth-form` (`app/noct-auth-form.ts`) — login/signup form with email and password, bindable to an auth store.
- `noct-protected` (`app/noct-protected.ts`) — conditionally renders content based on authentication state from a store.
- `noct-upload` (`app/noct-upload.ts`) — drag-and-drop file upload with progress tracking, previews, and store binding.
- `noct-user-menu` (`app/noct-user-menu.ts`) — user avatar dropdown menu with name, email, and logout action.
- `noct-app-settings` (`app/noct-app-settings.ts`) — application settings panel with organized sections.
- `noct-demo-page` (`app/noct-demo-page.ts`) — demo view chrome: title, description, content slot, and back navigation.

## Supporting files outside `src/lib/`

- `src/main.ts` — public ESM entry; re-exports every component above plus `VERSION`/`NAME`.
- `src/styles/rectangular-dark.css`, `src/styles/theme-tokens.css` — reference theme and token baseline.
- `src/demos/` — one HTML demo page per group (`layout`, `data`, `logic`, `flow`, `gui`, `modal`, `toast`, …) plus routed `views/` and shared `spa.css`.
- `docs/demo-app-chrome.md`, `docs/plans/2026-09-26-desktop-usability-mobile-foundation.md` — app-shell reference and desktop/mobile baseline contract.
