# NCT — foundation architecture (src/)

Marker: NCT-WL-COMPOSITOR / NCT-WL-KIT / NCT-WL-BRIDGE layers, per demo-de/WAYLAND-MAP.md.
Status: FOUNDATION RUN (2026-11-25). This tree is the real system's source.
demo-de/ remains the model; nothing here is the finished desktop environment —
the desktop is still being designed in demo-de while this foundation is built.

## Purpose of this run

Prove the whole chain, end to end, with a basic setup — not reach any
particular desktop feature:

    boot → greeter runs → login succeeds → session starts →
    shell is up → pre-set programs launch from inside the session:
    a foreign browser (Firefox), a foreign Qt app, and one of our own
    Godot apps — each set up in advance in core/session/launch-list.tsv.

If that chain works, every later piece (the real shell furniture, the kit,
more apps) has somewhere true to land.

## The three kinds of work

| Kind | Where | Form | Test loop |
|---|---|---|---|
| Core | src/core/ | wlroots-class compositor (stand-in: labwc), seat/session glue, scripts | Real DRM/seat — needs the VM (tier 2) |
| Godot system layer | src/godot/ | GDScript + .tscn on the pinned runtime; GDExtension for native reach | Headless + nested Wayland (tiers 0–1), no VM for most of it |
| Distro plumbing | src/distro/, src/system/ | Debian package lists; installed-filesystem overlay | Boot the image in the VM |

Foreign programs are NOT a fourth kind of work in src/. A foreign app is a
Wayland surface hosted by the core, plus — only if it wants NCT citizenship —
a bundle under src/ext-fwks/ rules. Its source never lives here.

The desktop module family (plans/ENVIRONMENT-MANAGER.md) has its homes in
src/modules/ — one directory per module, README stubs only for now;
the modules span the kinds above (services and Godot-layer code) and
are built slice by slice under the plan, not under this document.

## Layers and the hosting rule

    apps (ours: Godot; foreign: Firefox, Qt, GTK…)
      ↕ KIT      — src/godot/kit/, src/ext-fwks/   (NCT-WL-KIT / BRIDGE)
      ↕ SESSION  — src/core/session/  greeter bridge, session scripts, launch list
      ↕ CORE     — src/core/compositor/            (NCT-WL-COMPOSITOR)
    Wayland / logind / DRM

> A compositor feature may depend only on surface-level facts — geometry,
> state, focus, stacking — never on the kit contract. (demo-de/WAYLAND-MAP.md)

## The chain, piece by piece

1. **Display manager**: greetd (VM) starts the greeter session.
   Locally and in tests, the same scripts run without greetd.
2. **Greeter session** (`core/session/nct-greeter-session`): a single-app
   compositor (cage in the VM; the test compositor in nested tests) running
   the Godot greeter fullscreen.
3. **Auth bridge** (`services/bridge/nct-greetd-bridge.py`): Godot has no
   Unix-socket API, so the greeter cannot speak greetd's IPC directly.
   The bridge speaks greetd IPC (JSON over $GREETD_SOCK) on one side and a
   one-line TCP protocol on 127.0.0.1:7717 on the other:
   `AUTH <user> <password>` → `OK` / `FAIL <why>`; `START` → start session.
   Without greetd (tests), the bridge uses a fixture backend — same
   protocol, credentials from a fixture file that exists only in tests.
4. **Session** (`core/session/nct-session`): starts the compositor
   (labwc by default; NCT_COMPOSITOR=sway in automated tests, where
   swaymsg gives the test bed a window tree to assert against), whose
   autostart runs `nct-session-apps`.
5. **Session apps** (`core/session/nct-session-apps`): starts the Godot
   shell, then every launch-list entry marked autostart.
6. **Launcher** (`core/session/nct-launch <id>`): the shell's buttons and
   the autostart both go through this one script and the one launch list.
   One list, one launcher — the shell never hard-codes a program path.

## Test tiers

| Tier | Where | Proves |
|---|---|---|
| 0 headless | anywhere | Godot projects import, validate, self-test; scripts parse; bridge fixture auth |
| 1 nested | anywhere with wlroots | Chain steps 2–6 under a headless compositor; screenshots; window-tree assertions |
| 2 VM | Windows box, VirtualBox | Boot, greetd, DRM/seat, greeter→login→session on virtio-gpu. Test bed: tests/vm/ |

## What is deliberately not here yet

- The real NCT compositor (labwc is a stand-in binding, recorded as such).
- The NCT Godot Kit beyond a token file (src/godot/kit/tokens.json).
- Key-clicks native port (src/keyclicks/ is a placeholder with the rules).
- Any finished app. nct-hello exists only to prove our own apps launch.
