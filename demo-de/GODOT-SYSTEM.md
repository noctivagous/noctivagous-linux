# GODOT-SYSTEM — the Godot system: Godot greeter, shell, and apps over a thin core

The **Godot system** is the maximal-Godot architecture for NCT:
**every user-facing surface of the desktop environment is a Godot
application** — the greeter, the shell furniture, the apps, the
settings pages, the service front-ends. Underneath sits a thin
non-Godot core, which exists for two reasons only: foreign apps
must be hostable, and the session must survive a shell failure.

This document records the architecture **as an option, for
decision**. It is not the plan of record. It builds on
[GODOT-BRIDGE.md](GODOT-BRIDGE.md), which specs the **Godot lane**:
a pinned shared runtime, the NCT Godot Kit, and the bridge between
compositor and kit apps. The lane is the subset of this
architecture in which Godot apps are citizens among others. The
Godot system is the superset: Godot is also the greeter and the
shell. Everything GODOT-BRIDGE.md defines — the runtime model, the
kit, the bridge messages, the no-bridge invariants — carries into
this architecture unchanged.

WAYLAND-MAP.md's hosting rule stands unchanged, and this
architecture depends on it more than the lane does:

> **A COMPOSITOR feature may depend only on surface-level facts — geometry, state,
> focus, stacking — never on the NCT-WL-KIT contract.**

The compositor in this architecture is the same contract-blind
compositor as in every other NCT architecture. What changes is
who writes the clients.

## 1. The two layers

### (a) The core — NCT-LIB-EXT-CORE

The core is a **library-grade layer, not an environment**:

- a **wlroots-class compositor**: it owns DRM/KMS, the outputs,
  and surface hosting for *any* Wayland client, and it holds the
  compositor policy defined in WAYLAND-MAP.md — placement, the
  key-click operators, shade / freeze / hide, focus, stacking.
  Those are things the compositor does **to** surfaces, using only
  their rectangles and state; they work identically over a Godot
  window, a native window, and Firefox;
- **logind**, owning the seat and the session: VT switching, DRM
  master handover, suspend and lock signals;
- **XWayland**, hosting X11 clients as surfaces of the same
  compositor.

Nothing in the core knows what Godot is. The core's dependency
set is exactly the taxonomy's **NCT-LIB-EXT-CORE** tier: external
libraries the system's own foundation relies on (the compositor
library, libwayland, the graphics and text stack), with
**NCT-LIB-EXT-CORE-UTILS** beneath it for the leaf utilities
(parsers, loaders) that no layer above ever names directly.

### (b) The Godot system layer

Every surface a person actually touches is a Godot process,
running as an ordinary client of the core:

- the **greeter**, shown before login;
- the **shell**: launch bar, dock, sysbar, HUD, transformer stack
  — as layer-shell surfaces, per the correspondences in
  WAYLAND-MAP.md;
- the **apps**, on the shared pinned runtime of GODOT-BRIDGE.md;
- **Settings** and the **service front-ends** (network, power,
  audio, updates): Godot apps whose system reach comes from the
  extension layer (§ 4), not from any privilege of their own.

```
                        NCT — the Godot system

  ┌───────────────────────────────────────────────────────────┐
  │  GODOT SYSTEM LAYER — every user-facing surface           │
  │                                                           │
  │   greeter      shell        apps        settings /        │
  │   (fullscreen) (layer-      (.pck on    service           │
  │                 shell)       the pinned front-ends        │
  │                              runtime)                     │
  │        Godot processes — Wayland clients, all of them     │
  └───────┬──────────────┬──────────────┬─────────────────────┘
          │  Wayland     │  Wayland     │  Wayland
  ┌───────┴──────────────┴──────────────┴─────────────────────┐
  │  CORE — NCT-LIB-EXT-CORE                                  │
  │                                                           │
  │   wlroots-class compositor ── operators, placement,       │
  │   shade / freeze / hide, focus, stacking (policy over     │
  │   ANY surface)                                            │
  │   logind — seat, session, VT / DRM master                 │
  │   XWayland — X11 clients as surfaces                      │
  └───────▲──────────────────────────────▲────────────────────┘
          │  Wayland                     │  Wayland / XWayland
   Firefox, GTK and Qt apps,        Processing / openFrameworks /
   EXT-FWKS guests of every kind    JUCE apps (EXT-FWKS bindings)
```

Foreign apps enter at the core, beside the Godot processes —
never through them. Firefox is a sibling of the shell, not its
guest.

## 2. Process model

- **Greeter.** A fullscreen Godot app, run by the session before
  login on the greeter's own seat session. The **Greeter
  Dashboard** — the widget surround specced and built for the
  demo's greeter — is this app's dashboard module: the same
  configuration (profile switcher, responsive shedding to the
  login modal alone) at system scale.
- **Shell.** A separate Godot process presenting layer-shell
  surfaces. The session manager **restarts it on crash** without
  touching the compositor or any app. This is the crash-isolation
  rule, and it is the load-bearing wall of the whole
  architecture:

  > A shell crash is a blink. A compositor crash is a lost
  > session. Therefore Godot never runs inside the compositor
  > process — not the shell, not an embedded instance, not a
  > convenience plugin.

- **Apps.** The shared pinned runtime + `.pck` model of
  GODOT-BRIDGE.md, unchanged: one engine binary shipped by the
  distro, apps as data packs, the NCT Godot Kit as the toolkit
  contract (`NCT-WL-KIT`), the bridge (`NCT-WL-BRIDGE`) as the
  cooperation channel. In this architecture the kit is also the
  shell's toolkit (§ 3).
- **libgodot.** If the embedded form is used at all, it lives
  **inside the shell process only** — the shell is one Godot
  instance hosting all its furniture, which is what libgodot's
  one-instance-per-process limit permits. It never lives in the
  compositor, and apps do not embed it; apps are processes on the
  shared runtime. (GODOT-BRIDGE.md records the same constraint
  for the lane.)

Process supervision — start order, restart policies, watchdog
behaviour — belongs to the session's service manager (§ 4, item
5), not to any Godot process supervising another.

## 3. What Godot provides natively here

The reason this architecture is available at all is that Godot
already assembles, in one engine, the pieces a shell is made of:

- **The scene graph is the desktop's spatial model.** A window's
  place in the Flat arrangement, a desktop-layer piece, and the
  ZUI / spatial arrangements are all scene arrangements — nodes,
  transforms, nesting. The shell does not maintain a second model
  of the desktop beside the one it renders; the scene *is* the
  model, for flat and spatial layouts alike.
- **Control + Containers layout** — anchors, offsets, and
  minimum-size negotiation — is the layout system for shell
  furniture exactly as for app interfaces.
- **Theme resources fed by the style-set tokens.** The token maps
  of EXT-FWKS.md's schema generate the Theme resources the shell
  and kit apps render from, by the same mechanism GODOT-BRIDGE.md
  defines for a `StyleSetChanged`: one source of values, native
  and Godot surfaces in a style set working from the same map.
- **TextServer shaping** — complex text, bidirectional layout,
  font fallback — is the text path for every Godot surface,
  shell furniture included.
- **`.tscn` is the authoring format for shell furniture as much
  as for apps.** A launch bar and an app window are the same kind
  of artefact: a text scene tree, authored and edited with the
  same tools, carrying the same kit controls. Shell furniture is
  authored *like apps, with the Kit* — there is no separate
  shell-widget technology to learn, staff, or keep consistent.

## 4. The extension layer — GDExtension

Godot's own reach stops at the engine's API. The system functions
the Godot layer needs beyond that come from **GDExtension**
modules — native libraries the pinned runtime loads — listed here
in dependency order. Each is classified under the external
taxonomy; an extension is a dependency the system *relies on*,
so these sit in the EXT-CORE family, not in NCT-LIB-EXT-FWKS
(which is frameworks the system *hosts*).

1. **D-Bus client — the master key.** NetworkManager, UPower,
   UDisks, logind, the notification server, and the portals are
   all D-Bus services. One extension exposing D-Bus to the Godot
   layer covers most service front-ends: network state and
   control, power and battery, storage devices, session actions
   (lock, suspend, switch user), notifications sent and received.
   Without it, every front-end is a separate native hack; with
   it, they are ordinary Godot apps calling services.
   *Classification: NCT-LIB-EXT-CORE* (the Godot layer's
   foundation depends on it).
2. **xdg-desktop-portal client helpers.** File chooser,
   screencast, screenshot, and global-shortcut requests travel
   over D-Bus to the portal backend — the same standard channel
   GODOT-BRIDGE.md already assigns them to, never the bridge.
   The helpers are grouped with (1) mechanically and named
   separately because **apps consume them directly**, not only
   the shell: a kit app asking for a file chooser uses the same
   helper the shell's own surfaces use.
   *Classification: NCT-LIB-EXT-CORE* (shipped and versioned with
   (1), as its app-facing half).
3. **Wayland client extras.** Godot's DisplayServer speaks core
   Wayland and xdg-shell; it does not expose everything the
   shell needs as a *client*. This extension covers, above all,
   **layer-shell** — the shell process's surfaces exist by it
   (launch bar, dock, sysbar, HUD, desktop layer, per
   WAYLAND-MAP.md) — plus the **foreign-toplevel list** (the
   dock's and task surfaces' data about other clients' windows)
   and **screencopy** (window previews and thumbnails). This
   extension exists because of a named gap in Godot's Wayland
   client (§ 8), and it is the extension whose absence blocks
   the architecture outright.
   *Classification: NCT-LIB-EXT-CORE.*
4. **PipeWire routing.** Godot's audio server models an app's
   own audio. System audio surfaces — the volume and routing
   front-end, per-app stream control, capture sharing — need
   PipeWire's session view: nodes, streams, and routing between
   them. This extension exposes that view to the shell's audio
   front-end. App audio itself stays on Godot's audio server and
   reaches PipeWire as streams, like every other app's.
   *Classification: NCT-LIB-EXT-CORE-UTILS* — a leaf utility
   under the shell's audio surface; nothing above that surface
   names it.
5. **Process and session helpers — not an extension.**
   Supervision is **systemd user services**: the greeter, the
   shell, and the session's Godot services are units, with
   restart policies declared there. The recommendation is that
   no GDExtension is built for this at all — process supervision
   is a solved problem at the session layer, and a Godot-side
   supervisor would only shadow it. Godot processes *are*
   supervised; they do not supervise.

The discipline of GODOT-BRIDGE.md's security section applies to
the extension layer with full force: an extension is native code
inside the runtime's processes, so extensions are the distro's
own — built, signed, and shipped with the runtime — never
app-supplied.

## 5. What is NOT Godot, and why

| Not Godot | Why it sits below the line |
| --- | --- |
| **The compositor** | Godot is a Wayland **client** by construction: its DisplayServer connects *to* a display server; it does not implement one. It cannot receive another client's buffers, arbitrate outputs, or own DRM/KMS. A Godot compositor is not a hard version of this architecture; it is a different program wearing the engine as a renderer (see § 6) |
| **Seat and session ownership** | logind owns the seat: VT switching, DRM master, input device assignment, suspend/lock authority. A user process that tried to hold these would be reimplementing logind against logind — and its failure would strand the console, not just the session |
| **XWayland hosting** | XWayland is a client of the compositor and a server to X11 apps; it is started, supervised, and restarted by the core's session machinery. Nothing in the Godot layer has a role in it, and an X11 app's surface is the compositor's business alone |
| **Display-manager handover** | The VT/DRM handover into the session — the display manager yielding the seat to the user's session and the compositor taking DRM master — happens before any Godot process exists. The greeter is *run by* this machinery; it cannot be the machinery |

The pattern under the table: each item is either something Godot
structurally cannot do (it is a client), or something whose
failure must not be able to take the session with it. The Godot
layer is everything else — which is to say, everything a person
sees.

## 6. The embedded-compositor variant — recorded, and declined

**The variant.** Embed wlroots in a GDExtension inside a Godot
process. Foreign Wayland surfaces arrive as textures on scene
nodes; windows become literal 3D objects in the scene graph —
arranged, transformed, and nested by the same machinery that
arranges everything else.

**Why it tempts.** For the spatial desktop it is the most direct
realisation imaginable: no translation between the compositor's
window model and the shell's scene model, because there is only
one model. ZUI arrangements of *foreign* windows — a GTK app
tilted in space, a browser on a curved wall — become scene
operations instead of compositor research.

**Why it is declined as the plan of record.** It inverts the
dependency. The moment wlroots lives inside the engine, the work
is no longer "a Godot shell" — it is **writing a compositor in
C++, against Godot's presentation assumptions** (its main loop,
its rendering server, its own ideas about surfaces and timing),
which happens to host Godot. The hard problems of compositing
(buffer timing, output arbitration, input routing, protocol
correctness) return in full, now with an engine in the way; the
crash-isolation rule of § 2 is void, because the compositor and
the shell are one process; and Godot's upgrade cadence becomes
the compositor's. The variant spends exactly the advantage —
Godot's finished, maintained client machinery — that makes the
Godot system attractive.

**Revisit condition.** A dedicated **research spike**, time-boxed
and judged on evidence, could reopen it — for the spatial
desktop specifically. It is never the shipping path by default,
and no part of the shipping architecture may quietly depend on
its outcome.

## 7. Relationship to the existing documents

- **GODOT-BRIDGE.md is phase one, and a strict subset.** The
  lane — pinned runtime, kit, bridge — is built and specced
  independently of this decision, and adopting the Godot system
  later consumes it whole: the greeter and shell are written
  against the same kit and bridge the lane defines for apps.
  Declining this architecture loses nothing the lane provides.
- **EXT-FWKS.md is unaffected.** The NCT-LIB-EXT-FWKS bindings —
  Processing, openFrameworks, JUCE — remain hosted frameworks at
  the core, with their adapters and reference apps, exactly as
  specced there. In the Godot system they are guests of the
  compositor beside the Godot processes (§ 1's diagram), not
  inputs to the Godot layer.
- **The demo's markers, as a modelling note.** In this
  architecture the `NCT-WL-KIT` layer has **two citizens**: the
  paramorphic native kit the demo models, and the Godot Kit of
  the real system. The demo models one kit; the real system, in
  this option, has two, rendering from one token schema. This is
  recorded as a modelling note only — **no marker changes**: the
  markers classify demo code, and the demo's code is unchanged
  by an architecture it does not implement.
- **What the demo can and cannot model.** The demo *can* model
  this architecture's surfaces: its greeter already carries the
  Greeter Dashboard, and its shell furniture is the furniture
  this architecture renders as Godot scenes. The demo *cannot*
  model the two-process split (its shell and apps share one
  runtime by design), the crash-isolation behaviour, or the
  D-Bus extension layer. Those are properties of the real
  system's process and service structure, beyond the demo's
  scope, and this document does not pretend the demo evidences
  them.

## 8. Risks and open questions

- **Godot's Wayland client maturity.** The architecture leans on
  Godot as a Wayland client, and that client is the youngest
  part of the stack: **layer-shell is absent** — which is why
  extension (3) of § 4 exists at all — and the state of
  **input-method (IME) support and fractional scaling** on
  Wayland must be verified against the pinned runtime, not
  assumed from the engine's other platforms. Each gap found is
  either an extension, a runtime patch the distro carries, or a
  blocker; the classification is per gap, at pin time.
- **Accessibility.** Shell accessibility is a **hard
  requirement**: the greeter and shell are the surfaces every
  user, including assistive-technology users, must pass through.
  Godot's accessibility support is young (the same gap
  GODOT-BRIDGE.md records for kit apps). What the shell needs
  beyond it — AT-SPI exposure of shell furniture, keyboard-only
  operation of the greeter — is unscoped, and this architecture
  is not adoptable until it is scoped and closable.
- **The single-runtime pin.** The distro owns Godot upgrades
  (GODOT-BRIDGE.md), and in this architecture that ownership
  extends to the shell and greeter: a runtime regression is a
  *desktop* regression. Pin cadence and the re-gating of shell +
  greeter + kit apps on a new pin are one policy, decided
  together.
- **Text-heavy apps.** Editors, terminals, and long-form writing
  tools are the app classes least served by a game engine's text
  and control heritage. TextServer covers shaping; editing
  behaviour, IME depth, and very large documents are fitness
  questions per app, and a native or EXT-FWKS answer for a given
  app is not a failure of this architecture.
- **The open decision.** This document leaves one decision open,
  deliberately: **Godot-system versus Godot-lane-only.** The
  lane is the default — it is specced, subset-shaped, and useful
  under every outcome. The Godot system is adopted only by a
  decision that names it, taken with § 4's extension costs and
  this section's gaps in view.

## 9. Why this route bootstraps fast

The speed of this route is a **compression**: three bootstrap
problems that a custom desktop environment normally solves
separately, with three different toolchains, are solved here
by one.

- **The shell problem.** A conventional custom environment
  writes its shell in C/GTK or QML against compositor APIs, and
  every panel is bespoke work. Here the shell is scenes and
  scripts in an editor with live preview, authored with the
  same kit as the apps — shell furniture is app-shaped work,
  done with app tools.
- **The apps problem.** A new environment normally launches
  with no apps of its own and borrows another environment's,
  which is why most custom environments end up as reskins of
  the environment they borrowed from. Here first-party apps
  are the cheapest component in the system — `.tscn` +
  GDScript, hot-reloadable, generatable — so the environment
  can have its own file manager, settings, and showcase early,
  rather than eventually.
- **The consistency problem.** One scene graph, one Theme
  cascade, one bridge: greeter, shell, and apps agree visually
  and behaviourally by construction. Conventional stacks spend
  years chasing that agreement across toolkits after the fact;
  here there is nothing to chase, because there is one toolkit
  surface for everything the user sees.

What the route does **not** accelerate is stated as plainly:

- **The compositor core remains real systems work.** A
  wlroots-class library shrinks it from writing a Wayland
  server to configuring and extending one — a large reduction,
  not an elimination.
- **The extension layer is genuine C++.** The D-Bus and
  layer-shell extensions of § 4 precede anything booting; they
  are engine-level work on the critical path, not scripting.
- **The distribution plumbing is untouched.** Installer,
  drivers, packaging, and updates cost what they cost under
  any architecture. The acceleration applies to everything
  above the core line of § 1, and to nothing below it.

The strategic property follows from § 7: **lane-first makes
the Godot system a free option.** Every artifact of the Godot
lane — the kit, the bridge, the token schema, `.pck`
packaging, the pinned runtime — becomes a Godot-system
artifact unchanged if the system is adopted later, because
the system is the lane plus the greeter and shell built the
same way. No lane work is stranded by adopting the system,
and no system ambition is required to justify lane work. The
fast path and the cautious path are the same path, walked to
different depths.

## 10. Text rendering in a Vulkan 3D shell

A shell rendered by a Vulkan 3D engine raises one question
the conventional stacks never face: whether fonts and type
stay sharp — both as ordinary UI text and as text living on
surfaces inside 3D space, as window titles and labels do in
the spatial arrangements. Godot answers the two cases with
two different mechanisms, and neither is texture-mapped text
of the kind that blurs.

- **UI text (2D canvas).** TextServer shapes the text
  (HarfBuzz / ICU) and FreeType rasterises the glyphs.
  **Font oversampling** re-rasterises at the effective scale
  rather than stretching a bitmap, so greeter, shell, and app
  text stays crisp at any window size and at fractional
  scales. Hinting is configurable at font import (none /
  light / full). This path is a raster path, not a 3D path,
  and it does not inherit the blur of one.
- **Text in the 3D scene.** A font can be imported as a
  **multi-channel signed distance field** (MSDF) instead of
  a bitmap atlas. The shader reconstructs the glyph edge
  analytically, so `Label3D` text and text on rotating or
  zooming surfaces stays sharp at glancing angles and in
  motion — the classic mip-blur of texture-mapped text is
  designed out. MSDF is the designated approach for in-scene
  type: the spatial desktop's titles and labels rely on it,
  with `Label3D`'s `pixel_size` set for the intended viewing
  distance.

The caveats are font policy, not architecture:

- **MSDF rounds very sharp glyph corners slightly** and can
  look soft at tiny sizes. Small static labels use the
  raster path; the choice is per font.
- **There is no subpixel (ClearType-style) antialiasing.**
  Glyph antialiasing is grayscale / SDF. At modern display
  densities this is a non-issue; on low-DPI panels, hinted
  raster text carries the sharpness.

None of these block the architecture. They resolve into one
rule for the NCT Godot Kit: **its font assets ship with the
rendering mode chosen per use** — MSDF for in-scene and
display type, raster with oversampling for UI text.
