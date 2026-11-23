# NCT Desktop — architecture

The root page (`index.html`) is the demo environment of
noctivagous-linux: login screen + desktop. It began as one static
HTML file with two script files; as the environment grows into a
system (more apps, a parametric backdrop, settings that reach across
apps), it is built as a small layered architecture instead. This
document is the map; the code follows it.

## Layers

```
┌──────────────────────────────────────────────────────────────┐
│ APPS          src/desktop/apps/        one module per app    │
│               Home · Files · Terminal · Settings · Monitor · │
│               Notes · About · Trash                          │
├──────────────────────────────────────────────────────────────┤
│ SHELL         src/desktop/shell/       composition + chrome  │
│               DesktopApp (root) · Login · Desktop (sysbar,   │
│               dock, launcher, menus) · Window (frame) ·      │
│               BackdropView (canvas)                          │
├──────────────────────────────────────────────────────────────┤
│ SERVICES      src/desktop/services/    stateful engines      │
│               backdropService (owns the Panelization-        │
│               Simulation) · surfaces · soundService          │
├──────────────────────────────────────────────────────────────┤
│ CORE          src/desktop/core/        framework             │
│               store (observable state) · bus (events) ·      │
│               registry (app catalogue) · react binding       │
├──────────────────────────────────────────────────────────────┤
│ INPUT         src/keyclicks/           bimodal subsystem     │
│               framework-free: operates on the rendered DOM,  │
│               whoever rendered it                            │
├──────────────────────────────────────────────────────────────┤
│ LIBRARIES     NCTGraphite/ · paramorphic-components/         │
│               consumed, never edited from the desktop        │
└──────────────────────────────────────────────────────────────┘
```

Dependencies point **down** only. Apps never import the shell;
the shell never reaches into an app's internals; services know
nothing about React; core knows nothing about the desktop.

## Core

- **store.js** — one observable store, plain JS: `get()`, `set(patch)`,
  `subscribe(fn)`. State is held in named slices:
  `session` (user, session type, lock), `settings` (volume,
  brightness, wallpaper, backdrop parameters), `windows` (the window
  manager's table), `ui` (toast, open menus). The store is the single
  source of truth for anything two modules both need.
- **react.js** — the React binding: `useSlice(name)` over
  `useSyncExternalStore`, plus a `useStore()` for actions. Components
  subscribe to exactly the slice they render.
- **bus.js** — a tiny event emitter for *signals*, not state:
  `toast`, `openApp`, `lock`, `logout`, `shutdown`. Anything may
  raise a signal; the shell handles the session-level ones. If a
  value must persist or be read later, it belongs in the store, not
  on the bus.
- **registry.js** — the app catalogue: for each app, its id, name,
  icon, hint and component. The launcher, dock, desktop icons and
  window manager all read the registry; **adding an app is one
  registry entry plus one component file**, nothing else changes.

## Services

A service owns a stateful engine and exposes a narrow imperative
API; a view component renders whatever the service produces.

- **backdropService.js** — owns the iGeo panelization simulation
  (NCTGraphite's `PanelizationSimulation`) for the desktop backdrop:
  builds it from `settings.backdrop`, rebuilds on structural changes
  (surface, density, swarm count), applies live parameters between
  steps (reach, memory/decay, speed), steps it, and hands frames to
  `BackdropView`, which only projects and paints (Canvas 2D). One
  simulation lives across login and desktop — the shell mounts the
  view once, behind both screens.
- **surfaces.js** — the backdrop's surface presets (ARCH, FLAT
  SHEET, VAULT, WAVE) and density table, built from the library's
  NURBS class — the same sheets the iGeo live demo offers.
- **soundService.js** — the test tone and any future UI sounds;
  reads volume from the store at call time.

## Shell

`DesktopApp` is the composition root: it creates the store, starts
the services and the input subsystem, and renders Login or Desktop.
`Window` is the only window frame — titlebar, drag, shade/min/max/
close — and renders the app component the registry names, passing a
narrow **ctx**: `{ openApp, closeWindow, toast, session }` plus
store hooks. Apps keep private state (terminal history, the open
folder, monitor samples) inside themselves; it dies with the window,
as it should.

**Desktop-layer apps** are the second app form: they render on the
desk area itself, under the window layer, with no window frame.
The open one is named by the store's `ui.layer` field (actions in
`core/layers.js`); the shell mounts it inside the desk area, and
its surface takes pointer events only on its own controls and
content, so the desktop around it keeps working. NavGraph
(`shell/NavGraphLayer.jsx`) is the first: the file system drawn as
a radial cluster or a tidy tree over the desk, fed by the same
`services/fs.js` table the Files window reads.

## Input

Key-clicks is deliberately **not** part of the React tree. It is a
framework-free subsystem (`src/keyclicks/`) in three parts —
**addressing** (the pure label algebra and the text-entry guard),
**board** (the onscreen keyboard's data and per-scope bindings),
**engine** (the mode state machine) — composed by
`startKeyClicks()`, which the shell calls once on mount. It works
over the rendered DOM — mouseover addressing, synthetic clicks
through the elements' own handlers — so it behaves identically
over shell chrome and app content, and survives re-renders because
it resolves its targets at event time. The DOM contract it may
assume is written down in `KEYCLICKS-AUDIT.md`. Two host bridges
keep it honest inside the architecture: where the shell owns the
truth (window geometry), the engine emits `nct:winmove` (and
`nct:winlock` for the drag-lock cast, `nct:vshade` for the
vertical-titlebar collapse) and the
window manager applies it, never a direct DOM write; and its mode
changes go out on the bus as `kc:mode`. Its one concession to
React is using the native value setter on range inputs so React's
change tracking fires. (Theory: `refs/bimodal/`; the model is
KeyPilot's.)

## Settings flow, as the worked example

Settings sliders write `settings` in the store → the sysbar's
volume readout, the login screen's VOL stat and the backdrop
service all read or subscribe to the same slice → one write,
every consumer current. There is no per-app settings state and
no prop-drilling of values through the window manager.

## Growth rules

1. New app → component in `apps/` + registry entry. Nothing else.
2. New cross-app value → a store slice (or a field in one).
3. New engine (simulation, player, indexer) → a service with a
   view; never logic inside a component's render.
4. New input behaviour → the input subsystem, against the DOM
   contract (addressable selectors, `.nwin.focused`, `data-app`,
   `#fileTree`), not against a component; host-owned state changes
   go through a bridge event, never a DOM write.
5. A capability the libraries lack → add it to the library
   (NCTGraphite / paramorphic-components), per the repo's standing
   backwards-derivation rule — not a private copy in the desktop.
