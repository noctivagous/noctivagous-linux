# GODOT-BRIDGE — the Godot lane: shared runtime, kit, and bridge

Godot support in the real NCT system is a **lane**, not a compositor.
WAYLAND-MAP.md's hosting rule stands unchanged:

> **A COMPOSITOR feature may depend only on surface-level facts — geometry, state,
> focus, stacking — never on the NCT-WL-KIT contract.**

There is **no Godot-specific compositor**. The compositor hosts a Godot
app exactly as it hosts Firefox or a GTK app: as a Wayland surface it
knows nothing about. Everything Godot-specific lives in the two layers
that are allowed to be specific:

| Piece | Marker | What it is |
| --- | --- | --- |
| Shared Godot runtime | — (distro packaging) | One pinned Godot template binary, shipped by the distro |
| NCT Godot Kit | `NCT-WL-KIT` | A Godot addon: NCT controls, themes generated from the NCT style sets, device hooks, and the bridge autoload |
| Godot bridge | `NCT-WL-BRIDGE` | The channel defined in this document, between the compositor and a kit app that cooperates |

A Godot app that uses none of this is still a first-class surface. It
gets the chrome and every window-level operator. It does not get
re-skinned, addressed inside its own content, or handed its NCT
settings — those are kit and bridge territory, by the same split the
Browser's in-page bridge already follows.

The bridge messages defined in this document are the **first
binding** of a framework-agnostic core: [EXT-FWKS.md](EXT-FWKS.md)
specs **NCT-LIB-EXT-FWKS**, the external frameworks support module, which
defines the same message set, style-token schema, and no-bridge
invariants once for every supported framework, with per-framework
bindings — Godot here, and Processing, openFrameworks, and JUCE
there.

## Shared runtime

- The distro ships **one pinned Godot runtime** (an export-template
  build). Godot apps for the system ship as a `.pck` only and run on
  that runtime; no app carries its own engine binary.
- The runtime version is part of the distro release. Kit apps target
  the pinned version; the distro owns runtime upgrades, and a runtime
  upgrade is gated on the kit apps still running under it.
- The runtime is a **custom template build** in one respect: its
  built-in default theme is the NCT default theme, generated from the
  NCT style tokens. A vanilla Godot app that uses stock controls and
  sets no theme of its own therefore renders in the NCT look.
- Forced theming of foreign Godot apps is **impossible**, and the lane
  does not attempt it. Godot resolves a control's theme inside the
  project — local overrides first, then the nearest ancestor theme,
  then the project default theme, then the engine's built-in theme.
  An app that ships its own project theme, or overrides its controls
  locally, keeps its own look. The custom template reaches only the
  last step of that chain: apps that fall through to the built-in
  theme.

## The kit surface the bridge assumes

The bridge's app-side endpoint is the NCT Godot Kit's autoload,
**`NctBridge`** — a singleton the kit registers in every kit app.
`NctBridge`:

- owns the app's connection to the bridge transport (§ Transport);
- applies compositor-originated state: it regenerates and applies the
  Theme resource at the app root, forwards device-class changes to
  the kit's device hooks, switches the key-click mode state, and
  writes app-settings values where the app reads them;
- collects app-originated state: text-mode entry and exit, the
  addressable-control list, and generic actions;
- is the only bridge-aware object in the app. Controls and scenes
  talk to it through the kit's own signals, never to the transport
  directly.

An app without the kit has no `NctBridge` and speaks no bridge. The
compositor detects the bridge by the app's session registration
(§ Transport), never by inspecting the surface.

## Transport

**Decision to make, with a recommendation.** Two candidate transports:

| Candidate | Shape | Assessment |
| --- | --- | --- |
| D-Bus session interface `org.nct.GodotBridge1` | The compositor (or a session service acting for it) owns the name; each kit app registers an object per window | Matches the session's existing service layer — portals and the settings service already work this way. No surface binding: messages are per-app, not per-surface |
| Custom Wayland protocol `nct_godot_bridge_v1` | A global bound to the app's `xdg_toplevel` | Surface-bound by construction, but adds a protocol to design, version, and implement on both sides before any message flows |

**Recommendation: D-Bus first.** Every message defined below is
app-level state, not surface-level state; none of them needs to be
ordered against buffer commits. The Wayland protocol is added only
if a future message genuinely needs surface binding — at which point
it carries that message class, and the D-Bus interface keeps the rest.

On either transport the message set, names, and semantics are the
same; only the binding differs.

## Messages — compositor → app

### `StyleSetChanged`

| | |
| --- | --- |
| Payload | `set_name` (string: `panel` / `glass` / `recessed`); `tokens` (map: colours, fonts, metrics — the full token set for the named set, not a delta) |
| Receiver must | `NctBridge` regenerates the Theme resource from `tokens` and applies it at the app root, replacing the previous generated theme. Controls with local overrides keep them; everything else re-skins. The app does not restart and does not re-request state |

### `DeviceClassChanged`

| | |
| --- | --- |
| Payload | `class` (`phone` / `tablet` / `desktop`); `orientation` (`portrait` / `landscape`); `width_px` (integer); `width_band` (the band `width_px` falls in: ≤640 phone, 641–1024 tablet, >1024 desktop) |
| Receiver must | `NctBridge` updates the kit's device context. Controls resolve their per-class property overrides against the new context, exactly as native kit controls do; layout that depends on the class reflows |

### `KeyClickModeChanged`

| | |
| --- | --- |
| Payload | `mode` (string: the compositor's current key-click mode for this window); `text_cast` (boolean: whether the shell is showing the text-mode cast for this window) |
| Receiver must | The kit aligns its in-content state with the compositor's mode: in text mode, text-entry controls take the keyboard and operator keys pass through as text; outside it, the kit's controls expose themselves to addressing. The app never originates a mode; it only follows |

### `AppSettingsChanged`

| | |
| --- | --- |
| Payload | `values` (map: the app's declared settings spec, key → value, complete — not a delta) |
| Receiver must | `NctBridge` stores `values` as the app's current settings. The app reads its settings from the kit, so a change lands without the app holding its own settings file or settings UI |

## Messages — app → compositor

### `TextModeEntered` / `TextModeExited`

| | |
| --- | --- |
| Payload | `control_id` (string: the text-entry control that took / released text entry) |
| Receiver must | The compositor switches the window's key-click mode accordingly: operators are suspended as text while any kit app reports text entry, and the text-mode cast is shown at the frame level. This is the Godot form of the Browser bridge's in-content text-mode detection |

### `AddressablesChanged`

| | |
| --- | --- |
| Payload | `addressables` (list of records: `id` — stable per control for the window's lifetime; `label` — the control's display text or accessible name; `rect` — x, y, w, h in surface coordinates) |
| Receiver must | The compositor rebuilds the window's in-content address table from the list, wholesale (each message replaces the previous list). Alt+L labels inside the app are assigned from this table by the compositor's addressing algebra, not by the app. The app re-sends on any layout, scroll, or content change that moves a control |

### `GenericAction`

| | |
| --- | --- |
| Payload | `action` (string from the keymaps generic-action vocabulary, e.g. `HISTORY_BACK`); `target` (optional string: the addressable `id` the action applies to) |
| Receiver must | The compositor performs the action with its system meaning — for `HISTORY_BACK`, back *within the app's own history*, the Godot form of the Browser's D-as-back. Actions outside the vocabulary are ignored, not extended ad hoc |

### Portal requests — not bridge messages

File chooser, screencast, and screenshot requests do **not** travel
this bridge. A Godot app requests them through
**xdg-desktop-portal**, like every other app, and the portal backend
for the session answers. The bridge carries NCT-specific state only;
anything the wider system already standardises stays on the standard
channel.

## Sequence — a style-set switch

1. The user switches the style set in Settings.
2. The compositor sends `StyleSetChanged` (`glass`, full token map)
   to every registered kit app, Godot and native alike.
3. In a Godot kit app, `NctBridge` regenerates the Theme resource
   from the tokens and applies it at the app root.
4. Godot's theme cascade re-skins the whole control tree from that
   root assignment; local overrides, where a control deliberately
   set them, survive.
5. The window's surface, chrome, and operators never changed hands:
   the compositor did nothing but send a message.

## What needs no bridge

The following are compositor policy over the surface and hold for
every Godot window, kit or no kit, as invariants:

- Titlebar and window buttons; shade; freeze; hide; maximize
- H resize (the 8 sections); drag-lock move; focus; stacking
- Window-level key-click operators, including text mode at the
  frame level
- Launcher, dock, and desktop-layer assignment

No bridge message may gate, veto, or alter any of these. A kit app
that never answers the bridge still shades, freezes, and resizes.

## Key-click integration

- The compositor owns the **reserved operators** — F above all, as
  the system left-click — for Godot windows exactly as for every
  window. The bridge never carries reserved operators.
- The bridge carries only the **opt-in** side: in-content addressing
  (`AddressablesChanged`), mode following (`KeyClickModeChanged`),
  text-mode reporting, and generic actions. This is the keymaps
  split — reserved slots are compositor policy, overridable slots
  bind to the generic-action vocabulary — with the bridge as its
  transport for Godot apps.
- **Kit requirement:** a kit app disables Godot's built-in focus
  navigation (focus neighbours, `ui_accept`-driven traversal) for
  its control tree. Godot's navigation and the key-click operators
  are two answers to the same question; in a kit app the operators
  are the answer, and a control tree that also navigates itself
  fights them.

## libgodot variant — open, not the plan of record

Embedding libgodot — the engine built as a library — to render
shell furniture as Godot scenes is recorded as an **open variant**,
under two constraints:

- The embedded instance lives in a **separate shell process** (a
  layer-shell client), never inside the compositor process. The
  compositor restarts the shell process if it crashes; a crash of
  the compositor itself takes the session, and nothing embeddable
  is allowed to add failure modes to it.
- libgodot admits **one Godot instance per process**. A shell built
  on it is therefore one instance hosting all its furniture, with
  no per-piece isolation inside that process.

The plan of record remains the lane above: Godot apps as ordinary
Wayland clients of the compositor, on the shared runtime.

## Security and ecosystem

A Godot app is code with operating-system access — GDScript and
native extensions alike reach the filesystem, the network, and
process execution. Rapid generation lowers the cost of writing an
app; it does not lower what an app can do once installed. Any
distribution of Godot apps for the system therefore requires, from
the first distributed app, not retrofitted:

- **Signing** — apps are signed, and the runtime refuses unsigned
  or badly signed packs outside an explicit developer mode;
- **Permissions** — an app declares the capabilities it needs
  (filesystem scope, network, devices), and the system enforces the
  declaration; undeclared access is denied, not warned about;
- **Sandboxing** — apps run confined to their declared permissions,
  with portal-mediated access (file chooser, screencast) as the way
  out of the sandbox, as for every other app class on the system.

## Open questions

- **Transport confirmation** — D-Bus `org.nct.GodotBridge1` is the
  recommendation above; the `nct_godot_bridge_v1` Wayland protocol
  stays unbuilt unless a surface-bound message appears.
- **Runtime pin cadence** — how often the pinned Godot runtime
  advances, and how long kit apps built against an older pin keep
  running across a pin change.
- **Accessibility** — Godot's accessibility support is younger than
  GTK's or Qt's AT-SPI path. What the kit must add so Godot apps
  expose the same accessibility surface as native apps is unscoped.
- **Patch ports** — the native kit's dataflow (ports and cords) has
  no Godot equivalent yet. Whether kit Godot apps get ports, and
  whether a port can cross between a native app and a Godot app, is
  undecided.
