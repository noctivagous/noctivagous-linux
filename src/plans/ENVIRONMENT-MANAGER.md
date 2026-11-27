# NCT — environment manager plan

Status: DRAFT PLAN (2026-11-26). Accepted in discussion by the user
('rec', 2026-11-26), with the user's addition that the window manager
sits alongside sibling managers under the environment manager.
Not built. This plan sits above src/ARCHITECTURE.md: where the two
disagree, ARCHITECTURE.md governs the foundation chain that already
runs, and this plan governs the desktop system to be built on it.

Renamed 2026-11-26 (owner): the root module is nct-environment-manager,
not nct-desktop-manager — "environment" covers desktop, mobile, tablet
and VR form factors naturally, where "desktop" names only one of them.
This file was DESKTOP-MANAGER.md before the rename.

Source material: the framework-topics discussion (MXML / XUL /
XForms lineages, the responsibility map, the render-layer list),
demo-de's DESKTOP-ARCHITECTURE.md and UI-FLOW.md, the foundation
src/ARCHITECTURE.md, and repo-root security/ (SECURITY-MODEL.md,
MATRIX-SPEC.md, MONITOR-APP.md).

## 1. The organisation

One manager at the top. Everything the user sees or that governs
what they see is owned by exactly one manager under it. Managers
own state; no manager reaches into another manager's state —
they ask, through the environment manager's bus and the owning
manager's interface.

    nct-environment-manager                 (shell process)
    │
    ├── nct-linux-sys-interface         the bridge to the Linux system
    │   └── sole channel to systemd, the journal, D-Bus services,
    │       devices and firmware — see SYSTEM-INTERFACE.md
    │
    ├── nct-system-watch                what the system is telling us
    │   ├── triage: failed units, crashes, disk health, driver state
    │   └── raises Issues with a way out (SYSTEM-INTERFACE.md §3)
    │
    ├── nct-device-centre               devices and their drivers
    │   └── device tree, driver state, laptop frictions
    │       (SYSTEM-INTERFACE.md §4)
    │
    ├── nct-window-manager              everything on screen
    │   ├── nct-layer-stack             the render-layer list (§4)
    │   ├── window registry             one Window record per window (§3)
    │   ├── focus, geometry, stacking, decorations
    │   └── workspace assignment of windows (with nct-workspace-manager)
    │
    ├── nct-security-manager         security as a whole — the repo's
    │   │                    security/ directory is its spec source
    │   ├── policy: graded profiles (P1–P4) + capability matrix (C1–C11)
    │   ├── the guard: enforcement — grants, ASK prompts, plugs
    │   ├── hot-topic indicators (latched / active states on windows
    │   │   and launch icons — drawn via the window manager)
    │   └── Monitor attachments (records, conditions, firing log)
    │
    ├── nct-app-registry                 programs, as distinct from windows
    │   ├── app registry (manifests, .desktop equivalents, NCTXML kinds)
    │   ├── launch, lifecycle, crash detection, single-instance
    │   ├── .pck apps (own Godot process per Model 2), foreign apps
    │   │   (Qt / GTK / … via ext-fwks citizenship), shell-kind programs
    │   └── an app owns 0..n windows; the window manager owns the windows
    │
    ├── nct-session-manager             the user's session as a whole
    │   ├── login / logout / switch user (greeter side already proven)
    │   ├── save / restore (open apps, window geometry, workspaces)
    │   ├── lock, idle, suspend / resume, screen blanking
    │   └── the lock surface itself is a window, in the Lock layer
    │
    ├── nct-workspace-manager           workspaces / virtual desktops
    │   ├── workspace set (fixed or dynamic), per-output or global
    │   ├── switching policy and switch surface (via window manager)
    │   └── which workspace a window record belongs to
    │
    ├── nct-input-router               how input reaches windows
    │   ├── key-clicks + bimodal control (the system's native input)
    │   ├── global operators (reserved keys no app may take)
    │   ├── focus policy as input policy: click / follows-cursor / sloppy
    │   └── pointer, touch, tablet, stylus routing by layer priority
    │
    ├── nct-keyboard-manager                   keyboards, separate from routing
    │   ├── layouts by country + variants, layout switching
    │   ├── dead keys, compose, repeat / delay, Platform Configuration
    │   │   (Mac / PC emphasis)
    │   ├── input methods (CJK etc., IBus / Fcitx hosting)
    │   └── on-screen keyboard; defaults proposed by nct-locale-manager
    │
    ├── nct-display-manager              displays
    │   ├── enumerate outputs; geometry, scale, rotation per output
    │   ├── span / extend / mirror; fractional scaling
    │   └── which layers and bars exist per output (window manager draws)
    │
    ├── nct-network-centre              networks
    │   ├── connections: Wi-Fi, wired, VPN, hotspot, tethering
    │   ├── the backend is NetworkManager, via sys-interface only
    │   └── firewall state shown where the system provides it
    │
    ├── nct-print-manager             printing
    │   ├── printers (IPP / driverless first, CUPS queues), discovery
    │   ├── print jobs: state, cancel, reprint
    │   └── a printer with no working path is an Issue, not silence
    │
    ├── nct-audio-manager                sound
    │   ├── devices, profiles, per-app streams (PipeWire / WirePlumber)
    │   └── stack restart + per-layer state via device-centre
    │
    ├── nct-storage-manager              disks, volumes, mounts
    │   ├── mounts as forms (validated, test-mounted before saving)
    │   ├── encryption (LUKS) state, disk health (with system-watch)
    │   └── removable media policy
    │
    ├── nct-account-manager             users and groups
    │   ├── users, login picture, password, auto-login policy
    │   └── group membership with meanings translated
    │       ("USB serial devices (dialout)"), via AccountsService
    │
    ├── nct-power-manager                power — energy saver + battery
    │   ├── battery state, health, charge behaviour (UPower)
    │   ├── energy saver / power profiles (the backend in force
    │   │   is named: power-profiles-daemon vs TLP is an Issue
    │   │   if they conflict, SYSTEM-INTERFACE.md §4)
    │   └── brightness, DPMS / blanking policy (nct-session-manager acts)
    │
    ├── nct-package-coordinator      packages of ALL kinds, one front
    │   │   (a coordinator, not a manager: apt, Flatpak and the
    │   │   rest ARE the package managers — this coordinates them)
    │   ├── kinds: system packages (deb, via PackageKit), Flatpak,
    │   │   NCT apps (.pck / NCTXML), ext-fwks bundles, fonts /
    │   │   themes / icon sets as packages
    │   ├── install / remove / search / sources across all kinds;
    │   │   every backend speaks through sys-interface
    │   ├── updates for every kind (the former update-manager's
    │   │   whole job): policy, snapshot BEFORE applying (the
    │   │   recovery guarantee), restart-required → system-watch
    │   └── protection: removing a package the desktop depends
    │       on is blocked with a plain explanation (Package
    │       Rescue in nct-recovery-manager is its repair arm)
    │
    ├── nct-portal-manager       portals for apps (user's name)
    │   ├── file chooser, camera / microphone / location requests
    │   ├── screen sharing and REMOTE DESKTOP sessions:
    │   │   allow / deny, who is connected, end-session control
    │   └── every portal ask is an ASK under nct-security-manager policy
    │
    ├── nct-locale-manager               language, region, i18n
    │   ├── UI language, region formats (dates, numbers, currency)
    │   ├── time zone (timedated via sys-interface)
    │   └── proposes the default keyboard layout by country;
    │       nct-keyboard-manager owns the layout itself
    │
    ├── nct-notification-centre        notifications
    │   ├── routing, urgency (normal / critical / transient), history
    │   ├── action buttons, do-not-disturb
    │   └── surfaces are windows in the Overlay layer (window manager)
    │
    ├── nct-transfer-service            what moves between apps
    │   ├── clipboard (incl. history), primary selection
    │   └── drag & drop, intra-shell, cross-process and foreign
    │
    ├── nct-settings-service            settings as a system service
    │   ├── the settings registry: apps declare property lists;
    │   │   the stock settings kit renders them
    │   ├── system pages (Platform Configuration, profiles, plugs, …)
    │   └── change notification to owners (no polling)
    │
    ├── nct-ai-gateway                  AI resources, brokered
    │   ├── connections + API keys (keys never handed to consumers),
    │   │   models by modality, verified-only defaults
    │   ├── MCP servers, connectors, skills library, CLI harnesses
    │   └── declared system uses (system-watch troubleshooting,
    │       monitoring summaries) under security-manager grants
    │
    ├── nct-communication-gateway  reaching people, brokered
    │   ├── channels: email (IMAP/SMTP), SMS, phone (modem / SIP),
    │   │   open social protocols (ActivityPub, Matrix, RSS)
    │   ├── identities the user communicates as; sending AS the
    │   │   user is ASK-class under security-manager
    │   └── social platforms by tier: native protocol · official
    │       API connector · the platform's own app (identity,
    │       notifications and share hand-off only — no scraping)
    │
    ├── nct-geo-services                geographic matters, one place
    │   ├── inbound: position sources (GNSS, WiFi, IP, manual);
    │   │   exact position ASK-class; portal location asks are
    │   │   answered here, with who-was-told-what recorded
    │   └── outbound: maps / geocoding / routing (OpenStreetMap
    │       first), weather at a place, offline + placeholder
    │       geographic data badged as placeholder
    │
    ├── nct-theme-manager               appearance
    │   ├── Theme resources, type variations, dark / light, accent
    │   ├── the annotated-SVG chrome set (<g:patch> 9-slice pipeline)
    │   ├── icon set, fonts, cursor theme
    │   └── per-app overrides on top of the system theme
    │
    └── nct-accessibility-manager       access as a first-class service
        ├── AT-SPI2 bridge (screen reader) over the component contract
        ├── semantic roles, focus order, announcements
        └── magnifier, high contrast (surfaces via window manager)

Outside the session, beside it in the same hierarchy:

    nct-recovery-manager                        when the desktop itself is broken
    ├── graphical repair environment (own minimal display stack)
    ├── Startup Repair / Driver Rollback / Package Rescue / snapshots
    └── emergency TUI when graphics cannot run; shell last, not first
        (SYSTEM-INTERFACE.md §5)

Deferred, named so it is not invented twice later:
nct-backup-manager (user-data backup; snapshots of the system itself
belong to nct-recovery-manager / nct-package-coordinator).

Layout in the tree (owner's word, 2026-11-26): the directory is
src/modules/ — one directory per module above, named exactly as
the module, nct-layer-stack nested inside nct-window-manager/,
each holding a README stub (role, owns, hosting/language per §9,
status). src/modules/README.md is the index. The stubs are the
organisation made literal; no module is built yet.

Naming rule (user, 2026-11-26, as refined the same day): every
module name carries a suffix of one kind or another — no bare
nouns. The suffixes are varied role words, not all "manager":
a bridge (sys-interface), a watch (system-watch), a centre
(device-centre, network-centre, notification-centre), a
registry (app-registry), a stack (layer-stack), a router
(input-router), a service (settings-service, transfer-service)
— and "manager" where managing is the job (window, session,
security, package, …). Under one nct- prefix, one lifecycle,
one way of being reached. The hierarchy is one tree with one
root (the unified-design rule, §8); variety is in the suffix
words, never in how a module connects, reports or is configured.

### Rules of the organisation

1. **The environment manager coordinates; it does not implement.**
   Its own state is only: the manager registry, the bus, and the
   session-wide mode (locked / switching / shutting down) that
   managers consult. Anything concrete belongs to a manager.
2. **Windows are not apps.** The app registry owns processes and
   manifests; the window manager owns windows. Killing an app,
   focusing a window, and converting a window's style are three
   different operations owned by two different managers.
3. **Surfaces are always windows.** Anything a manager needs to
   show — a lock screen, a notification, an ASK prompt, a switcher —
   is a Window record in a layer, created through the window
   manager. No manager draws outside it. This is what keeps the
   layer list (§4) the single truth about what is on top of what.
4. **Surface-level facts only.** Following the standing
   NCT-WL-COMPOSITOR rule: the window manager (and the compositor
   beneath it) may depend only on surface-level facts — geometry,
   state, focus, stacking, capability indicators attached to a
   window — never on an app's internal contract (NCTXML tree,
   bindings, document model).
5. **Security is consulted, not bypassed.** Launch, capability
   use, plug redirection and Monitor attachment go through the
   nct-security-manager. Its indicators are attached to window records
   and launch icons; the window manager renders them, nct-security-manager
   owns their state (I0–I5 per MATRIX-SPEC.md).

## 2. Process model (Model 2, unchanged)

- The **shell process** hosts the environment manager and all its
  managers, plus shell furniture and shell-kind NCTXML programs
  (bars, side tabs, dashboard widgets pinned in the shell, panes
  hosted by shell apps).
- Each **windowed app gets its own Godot engine process** on the
  one distro-pinned shared runtime (its own heap / context /
  crash isolation), shipping as a .pck. Never its own engine copy.
- **Foreign apps** (Firefox, Qt, GTK…) run as their own processes
  under the compositor, as proven in the foundation chain.
- The window manager therefore manages **window records and
  policy**, not other apps' pixels (§3).

## 3. The Window record

One record per window, whatever its origin. The record is what
focus, stacking, geometry, workspace, session save/restore and
security indicators all attach to.

| Field | Meaning |
|---|---|
| id | stable for the window's life; survives style conversion |
| origin | shell / own-process (.pck) / foreign (Wayland) |
| backing | a Control subtree in the shell, or a Wayland toplevel the compositor composites |
| app | app-registry id, or none (pure shell furniture) |
| kind link | the NCTXML kind that produced it, if any (see NCTXML.md) |
| style | the policy bundle in §5 |
| layer | current render layer (§4), set by nct-layer-stack |
| geometry | rect, per output; min size; maximised / fullscreen state |
| workspace | owning workspace |
| state | normal / hidden / shaded / frozen / minimised |
| indicators | security indicator state (owned by security manager) |
| title, icon | as declared or as reported by the foreign surface |

## 4. The render-layer list (nct-layer-stack's table)

Top → bottom. Fixed. A window's layer is assigned from its style
and state; nothing renders outside a layer.

| Layer | Contents |
|---|---|
| Lock | session lock surface |
| Switcher | window switcher + live previews |
| Overlay-OSD | volume / brightness OSD, security alert flashes |
| Overlay | notifications, launcher / search overlay, drag ghost |
| Menu | root / desktop menus |
| Top | bars, side tabs, docks (panel-style windows) |
| Popup | menus, tooltips, popups belonging to a window |
| Workspace-Top | windows flagged always-on-top |
| Workspace | normal windows |
| Workspace-Bottom | windows flagged always-on-bottom |
| Desktop | dashboard widgets, desktop icons |
| Background | wallpaper / parametric backdrop |

Mapping: in the shell, one CanvasLayer per layer. For foreign
surfaces, the compositor's stacking / layer-shell assignment is
driven from the same table, so the order a user sees is the order
this list states, regardless of backing.

## 5. Window styles — dashboard widgets are a style of window

A style is a **policy bundle** the window manager applies to a
Window record, not a class of program and not decoration.

| Style | Chrome | Takes focus | Layer | Placement |
|---|---|---|---|---|
| normal | full | yes | Workspace | free |
| dashboard | none / minimal | no (Configure key only) | Desktop | pinned; per-workspace or all workspaces |
| panel | none | no | Top | edge-docked; reserves space |
| dialog | minimal | yes, tied to parent | above parent, in its layer band | parent-relative |
| popup | none | transient | Popup | transient |
| osd | none | no | Overlay-OSD | transient, timed |

Consequences:

- **Converting** a normal window into a dashboard widget is a
  style change on the same Window record — same id, same app,
  same process. (demo-de's window-mode ↔ layer-mode migration and
  freeze are the prototypes of this.)
- **Freeze** is a flag on any style: the window stays in place,
  takes no input, and is treated as absent by input routing
  until unfrozen.
- A program **requests** a style in its manifest (a widget asks
  for dashboard); the **user assigns** styles too, and the user's
  assignment wins.

## 6. What each manager does NOT own (boundary checks)

- Window manager does not launch or kill processes (app manager),
  decide capability grants (security manager), or choose keyboard
  layouts (input manager, from settings).
- nct-security-manager does not draw: indicators and prompts are
  windows and window attachments, rendered by the window manager.
- App registry does not place windows: it hands the window manager
  a new Window record with a requested style and geometry hints;
  placement policy (cascade / centred / smart, tiling, snapping,
  window rules per app class) is the window manager's.
- nct-session-manager does not define what is restored: it stores the
  window registry + workspace state the window and workspace
  managers hand it, and asks the app registry to relaunch.

## 7. Build order

    Slice 0  These two plan documents (this file + NCTXML.md).
    Slice 1  Window + layer manager skeleton in the shell, driven
             by fake windows of every style — including normal →
             dashboard conversion and freeze — verified by DOM /
             scene measurement, not by eye.
    Slice 2  NCTXML interpreter v1 (NCTXML.md) producing one pane,
             one window, one app and one File Navigator preview.
    Slice 3  Bars + side tabs as shell-kind NCTXML under the window
             manager; app manager registry + launch on the proven
             foundation chain; security manager at specced-not-built
             scope (profiles read, indicators rendered, no plugs yet).

Later managers (notification, transfer, accessibility, output)
land as their first consumer arrives, in the organisation above —
not as speculative frameworks.

## 8. Unified design (user, 2026-11-26)

The organisation above is one hierarchy, not a collection of
tools that happen to ship together:

1. **One root.** Every module hangs under nct-environment-manager in the
   tree in §1 — including the system bridge and the watch.
   Recovery sits beside the session in the same hierarchy,
   reached the same way, not as a separate product.
2. **One way in.** Modules are reached through the same shell,
   the same Settings root and the same deep links ("fix links",
   SYSTEM-INTERFACE.md §3) — never through a module's own
   private settings island.
3. **One way up.** Every problem any module or the system
   itself produces travels the single Issue path
   (SYSTEM-INTERFACE.md §3) to the user. No module invents its
   own popups, log corner or alert channel.
4. **One connection grammar.** Varied role names (§1), but one
   nct- prefix, one lifecycle, one bus, one settings
   registration, one Issue path. Modules stay separately
   replaceable behind their interfaces — hierarchy in
   presentation and coordination, modularity underneath
   (the KDE KCM lesson), so one module's failure is not the
   desktop's failure.
5. **Views over one system tree.** Settings panels and centres
   are views over the live system object tree the sys-interface
   mirrors (units, devices, mounts, services) — not private
   copies of system state that can drift out of sync with it.

## 9. Implementation languages (draft, 2026-11-26)

The foundation as built is GDScript + .tscn on the pinned
runtime, GDExtension for native reach, and small services
outside Godot (the greetd bridge pattern). This section assigns
languages per module on three principles:

1. **Language is not a security boundary; process and privilege
   are.** GDScript inside the shell process runs with the
   shell's full user-session rights — it can execute commands
   and write files like any user program. That is fine for
   user-level work, but no language choice makes in-shell code
   "safe anyway": what makes a privileged action safe is that
   it is performed by a separate service, authorised by polkit,
   which does not trust the shell's say-so. Conversely, an
   NCTXML app in its own process is bounded by its process and
   its capability grants, whatever language it is written in —
   and the preview kind is safe because the renderer executes
   no code for it, not because of its language.
2. **Match the language to the weight of the logic.**
   GDScript for scene-tree work and thin clients over the
   sys-interface (most modules are exactly that: subscribe to
   the object tree, render NCTXML views, request actions).
   C# where the logic is the product: the NCTXML interpreter
   and binding engine, transaction and policy evaluation —
   typed, testable, and the app kit's developer-facing language
   (the WPF-portability argument from the topics file).
   GDExtension (C++) only where Godot cannot reach: D-Bus
   client plumbing where a socket bridge will not do, the
   Pango TextServer, the SVG rasteriser, the AT-SPI bridge.
3. **Anything that must survive the shell, or precede it, is
   not in Godot at all.** Services in the bridge pattern
   (Python for prototypes; a compiled service language is a
   later production decision, per service).

Assignment:

| Where | Language | Modules |
|---|---|---|
| System / user services (outside Godot) | service stack (bridge pattern) | nct-linux-sys-interface (daemon half: subscriptions, journal, privileged actions under polkit), nct-system-watch (must survive shell failure), the guard's enforcement point, nct-recovery-manager's TUI |
| Shell process | GDScript | nct-window-manager, nct-layer-stack, bars / shell furniture, notification surfaces, theme application, settings and centre VIEWS (network, print, audio, storage, account, locale, power, device-centre views) — thin clients over the object tree |
| Shell process, logic-heavy | C# | NCTXML interpreter + binding engine (a library every hosting loads), nct-package-coordinator's transaction logic, nct-security-manager's policy evaluation (decisions in-shell; enforcement in the service), System Changes timeline |
| Own app processes | author's choice: GDScript or C# | NCTXML apps; the kit offers both, C# first for business apps |
| Native reach | GDExtension (C++) | D-Bus plumbing, Pango TextServer, resvg, AT-SPI — each adopted only when a module actually needs it |

DECIDED (user, 2026-11-26): the .NET-enabled Godot template
is the one pinned runtime. C# in the shell and in apps
requires it instead of the standard build — a bigger runtime,
and src/godot/runtime/PIN changes to the .NET template when
the shell build next moves (the standard-build pin stands
until then; the proven foundation chain is unaffected, as the
greeter and shell are GDScript either way). Candidate artefact
identified 2026-11-26: Godot 4.7.2-stable (latest stable;
4.8 is still in beta) — Godot_v4.7.2-stable_mono_linux_x86_64
(.NET edition, targets .NET 8). A 4.3 → 4.7.2 bump is a major
version move, not just an edition swap: it takes the PIN
rule's full tier 0–2 re-run and a breaking-changes check
against the foundation's scenes before it is adopted. The alternative —
GDScript everywhere in-shell, C# only in apps — was declined:
it splits the NCTXML engine's language from the shell's for
no structural gain, since the engine is a library both load.
So: the engine is written once, in C#, and GDScript remains
the shell's glue and view language.

DECIDED (user, 2026-11-27; build logs 33–34): **the shipped
environment is GDScript-first, and compiled languages are a
baking step, not a starting point.** The tier-2 proof found
that Godot's C# support has no shipped form for the launch
model's bare packs: --export-pack carries C# *sources*, not
the compiled assemblies the runtime loads, so a C# greeter
in pack form starts with its form class missing. GDScript
has no such gap — the engine itself compiles it, so source
in a pack is runnable as shipped. The strategy that follows:

- The environment itself — greeter, shell, furniture — is
  built in GDScript and ships from source in packs on the
  shared binary. A working interactive environment comes
  first; nothing compiled stands between the source and
  the login screen.
- When a section stabilizes, it is **baked in from source**
  as a compiled artefact, per component and by decision:
  a GDExtension native library, or a C# assembly shipped in
  that app's export layout (binary + pack + data dir — the
  form Godot's C# support actually offers). C# from source
  on the target would need the SDK and build tools there;
  that is a development setup, never a shipping form.
- NCTXML accordingly leaves the shipped environment's
  critical path: the greeter's form and the shell's bar are
  GDScript builds, and the interpreter stays in-tree as a
  baking-track component (its reference views live in
  src/modules/nctxml/examples/). The "logic-heavy C#" row
  above is superseded for the environment itself — those
  components bake when stable rather than hosting live.
- Principle 2 gains a rider: for anything that ships *in
  the environment*, source-shipping is a hard constraint —
  the language must be one the pack carries runnable.
- The mono pin stands: the shared runtime stays the .NET
  edition (the baked C# components and the dev loop need
  it), and the bundled .NET runtime (log 33) stays with it.
  Still open mechanically: the path rule by which a
  GDExtension library placed for the shared binary is found
  in pack form (the projects' bin/ path does not resolve);
  the first baking slice solves it.
