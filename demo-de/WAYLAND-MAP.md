# NCT-WL — how this demo maps onto the real stack

The NCT Desktop demo is a **model** of the real NCT desktop environment, not the
environment itself. The real system is layered:

```
apps (ours, and other people's)
  ↕  TOOLKIT — an NCT toolkit apps talk to (the GTK/Qt slot);
               foreign apps bring their own (GTK, Qt, Godot's Controls)
  ↕  COMPOSITOR — window management, chrome, input policy
  ↕  PROTOCOL — Wayland: surfaces, xdg-shell, layer-shell, seats
the graphics/input stack
```

The demo models the top layers in one codebase, so its code is **marked** with
three greppable tokens that say which layer a piece belongs to and, for the
compositor, whether it may assume anything about the app inside a window:

| Marker | Meaning |
| --- | --- |
| `NCT-WL-COMPOSITOR` | Compositor-model code. Must work for **any** surface, including apps we know nothing about (Firefox, a GTK app, a Godot game). |
| `NCT-WL-KIT` | Native toolkit-model code: the contract only NCT apps satisfy (the paramorphic app kit, the settings kit, patch ports). Foreign apps never touch this layer. |
| `NCT-WL-BRIDGE` | Code that hosts **foreign content** and crosses into it with its cooperation (the Browser window and its in-page bridge). |

Find them all: `grep -rn "NCT-WL-" src/ proxy/`. Markers sit at subsystem
boundaries (one header line per module), never line-by-line, and they record
**correspondences, not commitments** — where the real stack is still undecided
(e.g. Godot's place), the map says so.

## The hosting rule

> **A COMPOSITOR feature may depend only on surface-level facts — geometry, state,
> focus, stacking — never on the NCT-WL-KIT contract.**

This is the difference between a desktop environment that hosts other people's
apps and a walled garden. When a proposed shell feature breaks the rule, it is
reclassified as KIT or BRIDGE deliberately, in this document — not smuggled
into the compositor. When you add a shell feature, classify it here.

Why the compositor can be contract-blind here: the shell owns the chrome and the
operators for every window regardless of its app. Shade, freeze, hide,
H resize and drag-lock move are things the compositor does **to** a window, using
only its rectangle and state — which is why, in the real system, the key-click
operators will work over a foreign window exactly as they work over a native
one.

## COMPOSITOR — correspondences to Wayland

| Demo piece | Wayland counterpart |
| --- | --- |
| `core/windows.js` — window records (geometry, z, min/max, shaded, hidden, frozen, flipped) | `xdg_toplevel` state, negotiated by `configure` events |
| `shell/Window.jsx` — the titlebar, buttons, resize handles the shell draws | Server-side decorations: the compositor owns the frame, the client owns the content |
| `keyclicks/engine.js` — the cursor's window vs the focused window; all operators | `wl_seat`: pointer focus vs keyboard focus. The operators are **compositor input policy** — in the real system key-clicks live inside the compositor, which is precisely what makes them universal |
| H resize — the 8 sections around a window | The `xdg_toplevel.resize` edge enum — the same 8 edges |
| Space drag-lock move | `xdg_toplevel.move` (interactive move) |
| `core/layers.js`, `shell/Desktop.jsx` — sysbar, dock, launcher, HUD, transformer stack | Layer-shell surfaces. The launcher **position setting is layer-shell anchoring** (edge + flyout away from the edge); the sysbar's height is an exclusive zone |
| Desktop-layer apps (NavGraph) | A layer-shell surface on the background/below layer |
| `core/keymaps.js` — reserved operators vs per-app overridables | Compositor key policy vs an opt-in vocabulary: a foreign app never opts in, and the global semantics still hold |

**Named divergences** (demo features with no core-protocol equivalent — they
are compositor policy or custom-protocol territory, and the map says so rather
than pretending otherwise): freeze, shade, hide and the transformer stack are
compositor-internal states; the parametric backdrop is compositor rendering.

## KIT — correspondences to a toolkit

| Demo piece | Toolkit counterpart |
| --- | --- |
| `core/registry.jsx` — the app catalogue (component, size, settings spec, ports) | The **native app contract**: what the shell may assume about an NCT app. A foreign app satisfies none of it, and the compositor must not care |
| The paramorphic app kit (submodule: GuiDocuments, the control registry, prop schemas) | The widget layer: a registry control ≈ a widget class, its prop schema ≈ the widget's property surface |
| `apps/settingsKit.jsx` | The toolkit's stock property controls |
| Style sets (panel / glass / recessed) | Toolkit theming (the GTK CSS / Qt stylesheet slot) |
| `core/devices.js` — device classes, orientation, breakpoints | The toolkit's responsive layer: hooks every native control carries |
| `core/patchbay.js` — ports and cords | Native inter-app dataflow. In the real system this is a custom protocol / IPC channel, **not** Wayland core |

## BRIDGE — hosting foreign content

`apps/BrowserApp.jsx` + `proxy/bridge.mjs` are the demo's standing model of a
foreign surface: a shell-owned frame around content the shell does not
control. The split the bridge embodies is the general rule for foreign apps:

- **Without cooperation** (pure compositor): chrome, focus, geometry, stacking, the
  window-level operators, text mode at the frame level.
- **With cooperation** (bridge): in-content key-click addressing (Alt+L labels
  inside a page), text-mode detection inside the content, D meaning "back"
  *within* the content's own history.

## Godot, if it goes native

A native Godot is **another Wayland client plus a second toolkit citizen**:
its DisplayServer talks to the compositor like any client, and its scene graph
+ Control nodes are its own toolkit surface. Two consequences worth recording
while the decision is open:

- The COMPOSITOR layer does not change. Godot windows get the chrome and the
  window-level operators for free, because those are compositor policy.
- What needs bridging is the toolkit surface: Godot themes against NCT style
  sets, and in-app key-click addressing, which needs Godot-side cooperation
  exactly as the Browser's in-page addressing needs the bridge.

The Godot lane — a pinned shared runtime, the NCT Godot Kit, and the
bridge between compositor and kit apps — is specced in
[GODOT-BRIDGE.md](GODOT-BRIDGE.md). There is no Godot-specific
compositor; the lane is KIT plus BRIDGE over the unchanged
COMPOSITOR layer.

Godot is the first binding of the general pattern:
[EXT-FWKS.md](EXT-FWKS.md) specs **NCT-LIB-EXT-FWKS**, the external lib
support module — one framework-agnostic bridge core, style-token
schema, and bundle rules, with a binding per external framework
(Godot, Processing, openFrameworks, JUCE). Framework support lives
in that module, never in per-framework compositor work.

## Current features, classified

| Universal (COMPOSITOR) | Native-only (KIT) | Bridged (BRIDGE) |
| --- | --- | --- |
| Titlebar + buttons, shade, freeze, hide, maximize | Patch ports + Patch Viewer | In-content key-click labels |
| H resize, drag-lock move, focus, stacking | Per-app Settings pages; `\` Configure opening them | Text-mode detection in web content |
| Launcher, dock, sysbar, HUD, transformer stack | App settings specs, the UI builder | D as back within an app's history |
| Desktop-layer assignment, app modes | The UI Showcase catalogue itself | |
