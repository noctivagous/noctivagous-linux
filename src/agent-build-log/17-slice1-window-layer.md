# 17 — Modules Slice 1: window + layer manager skeleton

Date: 2026-11-26. Asked by: the owner ("Start Slice 1 in a fresh
worktree off main"). Worktree: ~/workspace/noctivagous-linux-slice1,
branch feat/slice1-window-layer, based on origin/main e1ca0d1.
Scope: plans/ENVIRONMENT-MANAGER.md §7 Slice 1 — window + layer
manager skeleton in the shell, driven by fake windows of every
style, including normal → dashboard conversion and freeze,
verified by scene measurement, not by eye.

## What was built

- src/modules/project.godot — the modules get one Godot project
  whose root is src/modules/, so every module's shell code is a
  res:// path and the harness can load it all. (The production
  shell assembles from these sources in a later slice; nothing
  in godot/ was touched.)
- nct-environment-manager/environment_manager.gd — the root at
  skeleton scope: a module registry (register / look up) and a
  bus that is deliberately a log (announcements recorded for
  tests), behind an interface a real bus can replace.
- nct-window-manager/window_record.gd — the §3 Window record as
  data: id, origin, backing, app, kind link, style, layer,
  geometry, workspace, state, frozen flag, indicators, title,
  parent — plus the §5 style policy table (chrome / takes-focus /
  placement per style) and takes_focus()/takes_input() answered
  from the record.
- nct-window-manager/window_manager.gd — the registry and policy:
  register/unregister, one CanvasLayer per layer, focus that
  follows the record's policy, set_frozen, and set_style — THE
  conversion: same record, same id, same backing node instance,
  new policy bundle, backing reparented to the new layer,
  focus dropped if the new style cannot hold it. Dialogs resolve
  their layer from their parent record's layer band.
- nct-window-manager/nct-layer-stack/layer_stack.gd — the §4
  table as code: the 12 layers in frozen order, style → default
  layer, CanvasLayer values (topmost layer highest, spaced 10).
- nct-window-manager/harness/ — a headless harness scene that
  builds fake windows (PanelContainer + Label) of all six styles
  at the SAME rect, so only layers separate them, and measures
  everything from the live tree.
- tools/run-chain.sh — one additive tier-0 check: the modules
  self-test (SLICE1_SELFTEST_OK). Nothing else in the script
  changed.

## Evidence

- Modules self-test, standalone: SLICE1_SELFTEST_OK windows=7
  layers=12, exit 0. It measures: the 12 CanvasLayer nodes exist
  with strictly decreasing canvas values in table order; each
  style sits in its §5 layer (dialog in its parent's band);
  stacking read back from actual parents (OSD > panel > popup >
  normal > dashboard); focus refused by dashboard/panel/osd and
  held by normal; conversion moves the SAME backing instance
  from the Workspace canvas layer (value 40) to Desktop (20),
  printed as SLICE1_MEASURE; freeze clears focus and input while
  the record stays registered; unfreeze restores focusability;
  the root's registry finds the window manager and the bus log
  holds its registration.
- Full tiers 0+1 (tools/run-chain.sh) in this worktree on the
  pinned 4.7.2 mono runtime: 19 passed, 0 failed — including the
  new check and the .pck steps. Greeter UI test: 8/8.
- The three module READMEs (environment-manager, window-manager,
  layer-stack) now record their built state; the other 26 stubs
  are untouched.

## Two findings about main, neither caused by this slice

1. **Every script on main has lost its executable bit.** The
   e1ca0d1 snapshot push carried file contents only: all of
   src/core/session/nct-* and src/tools/*.sh are mode 100644 in
   git. Any fresh checkout cannot run the chain at all
   (nct-godot-run: Permission denied). The older worktrees never
   showed it because their files were created locally with exec
   bits. This branch chmod +x's the 19 scripts that are executed
   (nct-render-ladder.sh is sourced, not executed, and was left
   alone) — the mode changes are part of this branch's diff, and
   landing them needs a push path that carries modes (a real git
   push does; the snapshot flow that produced e1ca0d1 does not).
2. **The mono editor needs a .NET SDK for editor operations.**
   With the 4.7.2 mono runtime and no SDK present, --import
   crashes (signal 11, after the engine's own "will lead to a
   crash" warning) and build-pcks.sh's --export-pack aborts.
   Game runs are unaffected. A .NET SDK 8.0.428 was installed
   into ~/.nct-tools/dotnet in this sandbox (with TMPDIR on the
   home filesystem — the 512 MB /tmp tmpfs breaks both the SDK
   installer and deb staging); with it on PATH/DOTNET_ROOT the
   .pck steps pass. Distro consequence, still open from log 13:
   a machine that builds .pck packs or C# needs the SDK present.

## Implementation notes

- No class_name anywhere in the new code: cross-file class_name
  types resolve only through the editor-generated global class
  cache, which headless game runs do not produce. The code uses
  preload() with explicit paths — which also matches the
  foundation's existing GDScript style.
- Shell-backed windows only, as scoped. Own-process and foreign
  backings attach to the same records in Slice 3 (app registry +
  compositor link); the record does not change.

## What this does not show

- Nothing renders for a user yet: the harness is headless, the
  fake windows are placeholders, and the production shell does
  not use the window manager. No tier-2 (rig) run — the rig
  proves the foundation chain, which this slice does not touch.
- Workspaces are a field on the record, not yet a manager;
  chrome, decorations, input routing and session save/restore
  are not built.

## Left open

- The branch is uncommitted, awaiting the owner's word — and
  see finding 1: HOW it lands decides whether the exec-bit fix
  lands with it.
- Next per the plan: Slice 2 (NCTXML interpreter v1) or
  SYSTEM-INTERFACE Slice A (sys-interface skeleton).
