# EXT-FWKS — NCT-LIB-EXT-FWKS, the external frameworks support module

External creative and application frameworks — engines and toolkits
the system did not grow itself — are supported through **one**
system module, **NCT-LIB-EXT-FWKS**, not through per-framework work in
the compositor. WAYLAND-MAP.md's hosting rule stands unchanged:

> **A COMPOSITOR feature may depend only on surface-level facts — geometry, state,
> focus, stacking — never on the NCT-WL-KIT contract.**

There is **no framework-specific compositor**, for any framework.
The compositor hosts a Processing sketch, an openFrameworks app, a
JUCE app or a Godot app exactly as it hosts Firefox: as a Wayland
surface it knows nothing about. Everything framework-specific lives
in NCT-LIB-EXT-FWKS, in the layers that are allowed to be specific:

| Piece | Marker | What it is |
| --- | --- | --- |
| NCT-LIB-EXT-FWKS core | `NCT-WL-BRIDGE` | The framework-agnostic bridge, style-token schema, bundle and identity rules, and conformance checks, defined once |
| Per-framework bindings | `NCT-WL-BRIDGE` | One submodule per framework: its runtime or toolchain, its adapter library, its packaging, its reference app |

Godot is the first binding. Its lane — a pinned shared runtime, the
NCT Godot Kit, and the bridge between compositor and kit apps — is
specced in [GODOT-BRIDGE.md](GODOT-BRIDGE.md), and the bridge
messages defined there are the Godot binding of the core defined
here. This spec generalises that core and adds three further
bindings: **Processing**, **openFrameworks**, and **JUCE**.

An app built on a supported framework that uses none of this is
still a first-class surface. It gets the chrome and every
window-level operator. It does not get re-skinned, addressed inside
its own content, or handed its NCT settings — those are bridge
territory, by the same split the Browser's in-page bridge and the
Godot lane already follow.

## NCT-LIB-EXT-FWKS core

### The bridge — one message set for every binding

The bridge is defined **once**, in this core. Every binding speaks
the same messages with the same names, payloads, and semantics;
only the binding — the transport endpoint inside the framework —
differs. The message set is the one first defined for the Godot
binding in GODOT-BRIDGE.md:

**Compositor → app**

| Message | Carries |
| --- | --- |
| `StyleSetChanged` | `set_name` (`panel` / `glass` / `recessed`) and `tokens`, the full token map for the named set — not a delta |
| `DeviceClassChanged` | `class` (`phone` / `tablet` / `desktop`), `orientation`, `width_px`, and `width_band` (≤640 phone, 641–1024 tablet, >1024 desktop) |
| `KeyClickModeChanged` | The compositor's current key-click `mode` for the window, and `text_cast` — whether the shell is showing the text-mode cast |
| `AppSettingsChanged` | `values` — the app's declared settings spec, key → value, complete, not a delta |

**App → compositor**

| Message | Carries |
| --- | --- |
| `TextModeEntered` / `TextModeExited` | `control_id` — the text-entry control that took or released text entry |
| `AddressablesChanged` | The window's addressable controls, wholesale: each record is `id` (stable for the window's lifetime), `label`, and `rect` (x, y, w, h in surface coordinates). Each message replaces the previous list |
| `GenericAction` | `action` from the keymaps generic-action vocabulary (e.g. `HISTORY_BACK`), with an optional `target` addressable `id`. Actions outside the vocabulary are ignored, not extended ad hoc |

File chooser, screencast, and screenshot requests are **not**
bridge messages in any binding. Apps request them through
**xdg-desktop-portal**, like every other app; the bridge carries
NCT-specific state only.

**Transport.** The transport is D-Bus, as recommended in
GODOT-BRIDGE.md: every message is app-level state, none needs
ordering against buffer commits, and the session's service layer —
portals, the settings service — already works this way. The core
interface name is **`org.nct.Bridge1`**; the compositor (or a
session service acting for it) owns the name and each adapted app
registers an object per window. The Godot binding's interface keeps
its established name, `org.nct.GodotBridge1` — it is the same
message set under a binding-specific interface name, kept so the
Godot lane's spec and kit do not churn; new bindings use
`org.nct.Bridge1`. A custom Wayland protocol is added only if a
future message genuinely needs surface binding, and then carries
that message class only.

Receiver obligations are as defined per message in
GODOT-BRIDGE.md and hold for every binding: a `StyleSetChanged`
receiver applies the token map without restarting and without
re-requesting state; an `AddressablesChanged` sender re-sends on
any layout, scroll, or content change that moves a control; the
compositor, not the app, assigns in-content key-click labels from
the address table.

### The style-token schema

`StyleSetChanged` carries a **token map**, and its shape is core
property — every binding consumes the same map:

- **Sets.** One map per style set. The sets are the system's style
  sets: `panel`, `glass`, `recessed`. A binding receives the map
  for the set named in the message, complete.
- **Colours.** Named colour tokens (surface, text, accent, border,
  and their variants) as hex values. Token names are the native
  kit's token names; bindings translate values, never names.
- **Fonts.** Named font tokens: family and size for each text role
  the native kit defines (body, heading, mono, and their variants).
- **Metrics.** Named spacing, padding, radius, and control-height
  tokens as pixel values at the reference scale; bindings apply
  their framework's scaling on top.

What a binding *does* with the map is the binding's own business —
regenerate a Godot Theme resource, set ofxGui's global colours,
build a JUCE LookAndFeel, expose values to sketch code. The schema
guarantees only that the values arriving are the same values the
native kit renders from, so an adapted app and a native app in the
same style set are working from one source.

### Bundle and identity rules

Each binding defines, for its framework:

- a **bundle format** — the on-disk unit the launcher, Files, and
  the software centre recognise as one app of that framework;
- a **generated `.desktop` entry** for every installed bundle,
  produced by the binding at install time, carrying the app's
  name, icon, and bundle path;
- a **stable app-id scheme** — one app-id per bundle, derived
  deterministically from the bundle, identical across reinstalls
  and updates of that bundle.

The point of fixing identity in the core is uniformity downstream:
compositor per-app-id rules, icon lookup, the app's page in
Settings → Applications, and its declared settings spec all key
off the app-id, and they work the same way for a sketch, a JUCE
instrument, and a native app.

### No-bridge invariants

The invariants from GODOT-BRIDGE.md carry over **unchanged**, to
every binding:

- Titlebar and window buttons; shade; freeze; hide; maximize
- H resize (the 8 sections); drag-lock move; focus; stacking
- Window-level key-click operators, including text mode at the
  frame level
- Launcher, dock, and desktop-layer assignment

No bridge message may gate, veto, or alter any of these. An adapted
app that never answers the bridge still shades, freezes, and
resizes. The bridge is cooperation layered on hosting, never a
condition of it.

### Conformance

Each binding ships **one reference app** (named in its section
below), and support is claimed against the core conformance checks,
run with that app against the compositor:

| Check | Pass criterion |
| --- | --- |
| Bridge handshake | The app registers on the bridge at startup; the compositor lists it as a bridged app for its window |
| Style-set switch | On `StyleSetChanged`, the app re-skins from the new token map — or, for bindings whose theming boundary is token receipt (§ Processing, § openFrameworks custom drawing), demonstrably receives the map and exposes the new values — without restarting |
| Device-class change | On `DeviceClassChanged`, the app applies the new class context: per-class layout or property overrides take effect, or the new values are observably in effect in the app |
| Text-mode report | Entering text entry in the app produces `TextModeEntered` and the window's operators suspend as text; leaving produces `TextModeExited` and they resume |
| Fullscreen request | The app's fullscreen or presentation request reaches the compositor through the routes in § Compositor policy, and the compositor's grant or decline — not the app — decides the outcome |

A binding that passes all five is conformant. A framework whose
binding passes some checks is partially supported, named by the
checks it passes (§ The four parts).

## The four parts of a binding

Every binding of NCT-LIB-EXT-FWKS provides four parts:

| Part | What it is |
| --- | --- |
| **Runtime / toolchain** | What the distro ships and pins so apps of this framework run: a runtime binary, a JDK, system libraries, a project template — or an explicit "none, the framework compiles in" |
| **Adapter** | A library **in the framework's own extension form** — a Godot addon, a Processing library, an oF addon, a JUCE module — that the app includes and that speaks the bridge on the app's side |
| **Packaging** | The bundle format, generated `.desktop` entry, and app-id scheme of § Bundle and identity rules, for this framework |
| **Conformance** | The binding's reference app, passing the core conformance checks |

A framework is **supported** when all four parts exist. Partial
support is named by which parts exist — "Processing: runtime and
packaging, no adapter" is a support statement; "Processing is
supported" without the parts is not.

## The Processing binding

**Runtime / toolchain.** The distro ships a **pinned JDK 17**,
the **Processing core** (published upstream as a Java library),
the **JOGL natives** the hardware renderers (P2D / P3D) need, and
a **sketch runner** — a `processing-java`-style command line that
preprocesses, builds, and runs a sketch folder, and exports it as
an application. The **sketch folder is the bundle**: a folder
holding the sketch's `.pde` sources and data is one app under
§ Bundle and identity rules, with its app-id derived from the
folder's identity.

**Windowing.** Java's window stack is X11-shaped. Native Wayland
support for Java (Project Wakefield) is not in a shipped
mainstream JDK, so sketches run **via XWayland** at first. The
binding owns that fallback explicitly: it is the binding's policy,
not an accident of the JDK, and it carries a **review trigger** —
the fallback is re-examined when a JDK shipping Wakefield's
Wayland toolkit is available to pin. Through XWayland a sketch is
still a hosted surface: chrome, operators, and the no-bridge
invariants all hold; what it cannot yet be is a native Wayland
client.

**Adapter.** A **Processing library** — the ecosystem's own
extension form, dropped into the sketchbook's `libraries` folder —
that a sketch imports. It hooks the `PApplet` lifecycle (setup,
surface placement, exit) and is the sketch's bridge endpoint:

- performs the bridge handshake at sketch start;
- exposes the current style set's tokens to sketch code as an
  API — e.g. `nct.color("accent")`, `nct.font("body")`,
  `nct.metric("pad")` — resolved from the most recent
  `StyleSetChanged` map, with the pinned NCT defaults before any
  message arrives;
- reports text entry and **present mode** (below) to the
  compositor, and forwards device-class changes to the sketch as
  values it can branch on.

**Theming boundary.** A sketch draws everything itself, in its
own draw loop, with its own colours. There is no widget tree to
re-skin, and the binding does not attempt one: **support means
the tokens are available as an API, never a forced re-skin.**
A sketch that uses the token API follows the style set; a sketch
that hard-codes its palette keeps it. This is the Processing form
of the Godot lane's rule that forced theming of foreign apps is
not attempted — here it is not even possible, and the binding
says so rather than pretending a `StyleSetChanged` handler
re-skins a canvas.

**Presentation mode.** Sketches commonly run fullscreen — the
PDE's present mode, installations, kiosk pieces. A sketch (or its
launcher entry) requests fullscreen through the compositor policy
routes in § Compositor policy; the binding's part is carrying the
request and the sketch's preferred output, not granting it.

**Reference app.** A token-API sketch: draws its UI from
`nct.*` values, takes text entry, and runs in present mode on
request.

## The openFrameworks binding

**Runtime / toolchain.** None — openFrameworks apps are native
binaries and carry their framework with them. Support is instead
a **pinned openFrameworks toolchain**: the oF release the distro
pins, its system libraries, and a **Project Generator template**
carrying NCT defaults (app-id, icon, bundle layout), so a project
generated on the system is already packaged as a bundle under
§ Bundle and identity rules.

**Windowing.** oF windows are GLFW windows. Upstream oF
**0.12.2 (in progress)** adds GLFW Wayland support alongside X11;
before it, GLFW windows on a Wayland session arrive through
XWayland. The binding **pins the Wayland-capable build** — the
toolchain pin above is taken at or after 0.12.2 — and the adapter
sets the window's **app-id through GLFW** at window creation, so
the compositor sees the bundle's stable identity from the first
configure.

**Adapter.** An **addon, `ofxNctBridge`** — addons are
openFrameworks' distribution form, added to a project through the
Project Generator like any other. It hooks `ofEvents` (setup,
window resize, exit, key and mouse events at the priority the
binding registers) and is the app's bridge endpoint over D-Bus:

- performs the bridge handshake when the app's window is created;
- holds the current token map and device context, and re-sends
  `AddressablesChanged` when the app's registered controls move;
- exposes tokens to app code as `ofColor`, `ofTrueTypeFont`, and
  metric values, for custom-drawn interfaces.

**Theming.** ofxGui — oF's stock parameter GUI — exposes its
appearance through **global setters**: `ofxGuiSetFillColor`,
`ofxGuiSetTextColor`, `ofxGuiSetHeaderColor`, `ofxGuiSetFont`,
and their siblings for border, background, text padding, and
default sizes. The binding maps the token map onto those setters,
so on `StyleSetChanged` every ofxGui panel in an adapted app
re-skins from the same values the native kit renders from — no
per-panel work in app code. Custom-drawn oF interfaces sit under
the same boundary as Processing: tokens are available as values,
never forced. One binding, two theme surfaces, named separately
in the support matrix.

**Reference app.** An ofxGui parameter app: a stock oF guiExample
shape, adapted with `ofxNctBridge`, whose panels re-skin on a
style-set switch.

## The JUCE binding

**Runtime / toolchain.** None — JUCE compiles into each app. The
binding is a **JUCE module, `juce_nct_bridge`**, distributed the
way JUCE modules are, plus a **CMake app template** that includes
the module and carries the NCT packaging defaults, so a generated
app is a bundle under § Bundle and identity rules from its first
build.

**Licensing.** JUCE is dual-licensed, GPL and commercial. The
module is the system's own code and is distributed under the
system's terms; an app built with JUCE carries **its own**
licence, chosen by its author under JUCE's terms. The binding
records this because packaging is where it becomes visible: the
software centre shows the app's licence, not the framework's.

**Windowing.** JUCE's native Wayland support exists upstream as a
**public preview branch**: standalone apps create native Wayland
peers when `WAYLAND_DISPLAY` is set, `libwayland-client` is loaded
at runtime, X11 remains as fallback, and the branch is tested
against Mutter, KWin, Hyprland, and Weston. The binding **tracks
that branch** — it builds against it and reports its state — and
names its **review trigger**: the preview's merge into a JUCE
release, at which point the pin moves from branch to release.
Three upstream limits are recorded as this binding's **support
limits**, not worked around:

- **Plugin editors remain X11 / XWayland.** Standalone apps are
  the Wayland citizens; a plugin's editor window, hosted inside a
  DAW, goes through XWayland.
- **`WebBrowserComponent` is unavailable on Wayland.** Apps using
  it fall back to X11 for that component's window or do without.
- **No global window coordinates.** A JUCE app cannot read or set
  its own screen position on Wayland. This costs the binding
  nothing: placement is the compositor's in NCT policy anyway,
  and JUCE's simulated local coordinates stay inside the app.

**Adapter.** The `juce_nct_bridge` module itself: a component and
message-thread bridge client the app instantiates once. It
performs the handshake, receives the four compositor → app
messages on JUCE's message thread, and raises the app → compositor
messages from the app's own events (text-editor focus for text
mode, component registry for addressables, the app's command
vocabulary mapped onto `GenericAction`).

**Theming.** The strongest theme surface of the three bindings in
this spec. JUCE paints every component through a single
**LookAndFeel** object, swappable at runtime. The module ships an
**NCT LookAndFeel generated from the token map** — colours, fonts,
and metrics from § The style-token schema, drawn the JUCE way —
and on `StyleSetChanged` regenerates it and applies it with
`LookAndFeel::setDefaultLookAndFeel`. Every component without a
local LookAndFeel override re-skins; the mechanism is JUCE's own,
used as designed.

**Audio.** JUCE is an audio framework before it is a GUI one, so
this binding carries a **system audio policy** the other bindings
do not need:

- standalone audio apps route through **PipeWire**, with JACK
  compatibility for pro-audio hosts and tools;
- **low-latency routing** is a system configuration the binding
  declares for its apps (period sizes, sample-rate policy), not
  something each app negotiates alone;
- **realtime privileges** for audio threads are granted through
  **rtkit** under the system's policy, so an adapted JUCE app gets
  realtime scheduling without setuid helpers or manual limits
  configuration;
- **plugin hosting stays XWayland**, per the support limit above:
  a hosted plugin's editor is an XWayland window, and the
  compositor's invariants cover it as they cover any surface.

**Reference app.** A standalone JUCE app on the CMake template:
stock JUCE components under the NCT LookAndFeel, one text editor,
and an audio device path through PipeWire.

## Compositor policy these frameworks motivate

Some features these frameworks need are not extlib's to build.
They are **surface-level, contract-blind, and belong to
NCT-WL-COMPOSITOR** — they work for any app that asks, framework
or not, and are classified there, not smuggled into a binding:

- **Fullscreen on a chosen output** — an app asks for fullscreen
  *on a named output*, not merely fullscreen;
- **Presentation / kiosk mode** — a window state for installations
  and present-mode sketches: fullscreen, no chrome, no operator
  interruption beyond the system's escape;
- **Desktop-layer assignment for installations** — a long-running
  piece lives on the desktop layer, under the windows, as the
  demo's layer apps already model;
- **Per-app-id rules** — placement, layer, and mode rules keyed by
  the stable app-ids of § Bundle and identity rules.

Bindings **request** these through the routes that exist —
`GenericAction` for in-vocabulary requests, xdg-desktop-portal
where the wider system standardises one — and the compositor
**grants or declines by policy**. An app never grants itself
kiosk mode; extlib never promises what only the compositor can
give.

## Support matrix

| Framework | Runtime / toolchain shipped | Windowing today | Adapter form | Theme surface | Reference app | Known gaps |
| --- | --- | --- | --- | --- | --- | --- |
| Godot | One pinned Godot template runtime; apps ship as `.pck` only | Native Wayland client | Godot addon (the NCT Godot Kit) with the `NctBridge` autoload | Generated Theme resource applied at the app root; custom template's built-in theme is the NCT default. Apps with their own themes keep them | Kit app on the pinned runtime | Accessibility younger than GTK/Qt; patch ports have no Godot equivalent |
| Processing | Pinned JDK 17 + Processing core + JOGL natives + sketch runner | XWayland (Java's window stack is X11-shaped; Wakefield not in a shipped JDK) | Processing library in the sketchbook `libraries` folder | None forced — tokens exposed as the `nct.*` API for sketch code | Token-API sketch with text entry and present mode | No native Wayland until a Wakefield JDK can be pinned; no re-skinning is possible or attempted |
| openFrameworks | No runtime; pinned oF toolchain (≥ 0.12.2) + system libraries + Project Generator template | Native Wayland via GLFW (0.12.2, in progress upstream); XWayland before it | Addon, `ofxNctBridge`, hooking `ofEvents` | ofxGui global setters mapped from the token map; custom-drawn apps take tokens as values | Adapted ofxGui parameter app | Pin depends on an in-progress upstream release; custom-drawn interfaces are token-receipt only |
| JUCE | No runtime (compiles into the app); `juce_nct_bridge` module + CMake template | Native Wayland for standalone apps on upstream's preview branch; X11 fallback | JUCE module, `juce_nct_bridge` | NCT LookAndFeel generated from the token map, applied via `setDefaultLookAndFeel` — full component re-skin | Standalone app on the CMake template with PipeWire audio | Plugin editors X11 / XWayland only; `WebBrowserComponent` unavailable on Wayland; no global coordinates; pin tracks a preview branch until it merges into a release |

## Maintenance and upstream tracking

Each binding names its upstream and the **review trigger** that
forces the binding to be re-examined:

| Binding | Upstream | Review trigger |
| --- | --- | --- |
| Godot | The pinned Godot runtime | A runtime version bump — kit apps re-gated on the new pin |
| Processing | Processing core and the JDK | A JDK shipping Wakefield's Wayland toolkit — the XWayland fallback policy is re-examined |
| openFrameworks | openFrameworks releases | The 0.12.2 release — the pin moves from in-progress to released |
| JUCE | JUCE, and its Wayland preview branch | The preview's merge into a JUCE release — the pin moves from branch to release |

Between triggers, a binding tracks its upstream's releases for
security and correctness fixes under the distro's normal update
policy; a trigger is what re-opens design questions (windowing
route, pin shape), not routine updates.

**Adapter size discipline.** An adapter is an **event hook + a
bridge client + a token consumer**. That is the whole shape, in
every binding in this spec. If a proposed adapter grows a fourth
component — its own settings store, its own layout rules, its own
theming engine — the capability belongs in NCT-LIB-EXT-FWKS core,
shared by all bindings, or it is a design smell to be argued
about in the open. The bindings stay thin so that supporting a
fifth framework is a known amount of work: one runtime decision,
one adapter in the framework's extension form, one packaging
definition, one reference app.

## Security

A sketch, an oF app, and a JUCE app are code with
operating-system access, exactly as a Godot app is. The
requirements from GODOT-BRIDGE.md apply to **every binding's**
distribution path, from the first distributed app, not
retrofitted:

- **Signing** — bundles are signed, and unsigned or badly signed
  bundles are refused outside an explicit developer mode;
- **Permissions** — a bundle declares the capabilities it needs
  (filesystem scope, network, devices), and the system enforces
  the declaration; undeclared access is denied, not warned about;
- **Sandboxing** — bundles run confined to their declared
  permissions, with portal-mediated access as the way out of the
  sandbox, as for every other app class on the system.

The sketchbook habit of running a downloaded sketch on sight is
the habit this section exists to break: under NCT-LIB-EXT-FWKS a
downloaded bundle is installed — signed, permissioned, sandboxed —
and then run, in that order.
