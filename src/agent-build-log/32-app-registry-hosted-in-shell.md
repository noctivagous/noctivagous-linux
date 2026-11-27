# 32 — App registry hosted in the shipped shell

Date: 2026-11-27. Asked by: the owner ("the app-registry
hosting — the processes half that pairs with these records",
following the window-manager hosting of log 30). Branch:
feat/greeter-look-registry (after the greeter-look commits).
Scope: host src/modules/nct-app-registry in godot/shell the
way the window manager is hosted, and route the shell's
launches through it — the registry owns the programs, the
manager owns the windows (plans §1 rule 2).

## The one module change: record-only hosting

The registry as built (Slice 3) substitutes a placeholder
surface when launch() gets no backing — right for hosts that
render app surfaces in-process (its harness), wrong for the
shipped shell: a launched Firefox would have drawn a fake
"Firefox (foreign surface)" panel into the shell's scene.
The registry gains `placeholder_backings` (default true, so
the module's own proofs are untouched). A host whose apps
live in their own processes under a compositor sets it
false: the record registers with NO backing, and the real
surface attaches when the compositor link lands — the same
record shape the shell already used for launches (log 30).
The Slice 3 harness proves the new mode: a record-only
launch whose record's backing is null (SLICE3_OK).

## Vendoring: the layout now mirrors src/modules

The registry preloads ../nct-window-manager/window_record.gd
— a relative path that only resolves if the two modules sit
side by side as they do in src/modules. The wm/ layout from
log 30 could not express that, so the vendored copies moved:
godot/shell/nct-window-manager/ + godot/shell/
nct-app-registry/, byte-identical, synced by
tools/sync-shell-modules.sh and drift-checked by
tools/check-shell-modules-copies.sh (SHELL_MODULES_CLEAN),
which supersede the sync-wm pair. The window manager's own
files did not change; only their vendored address did.

## The shell's integration

- _setup_registry: one manifest per launch-list entry except
  "shell" (furniture, not a launchable app). Kinds/entries
  from the resolve-key: hello → pck, entry the shipped pack
  path (/usr/lib/nct/godot/apps/nct-hello.pck); firefox/qt/
  terminal → foreign, entry the program name nct-resolve-cmd
  resolves to. The entries are the registry's RECORD of how
  an app launches (launch_command derives from them); live
  resolution stays nct-resolve-cmd's and starting stays
  nct-launch's — the shell still contains no program paths
  of its own beyond this record.
- launch_entry: a running app is focused through the
  registry and never respawned (single-instance now holds in
  the real session, where log 30 registered a fresh record
  per launch); a new app is registered first, then started
  via nct-launch exactly as before.
- The records the WM slice created by hand are now the
  registry's: window ids are the registry's (<app>-win-<n>),
  origin comes from the manifest kind.

## What is NOT fed, stated plainly

The registry's crash detection needs a process table, and
the session still cannot supply one: nct-launch detaches
(nohup … &) and exits, so no app pid ever reaches the shell
(the same wall log 30 recorded). check_liveness() is hosted
and proven — the self-test feeds the seam by hand
(mark_process_dead → the record is removed and the crash
reported) — but in the live session nothing marks processes
dead yet. Feeding it is a contract change to nct-launch
(report the started pid, e.g. a pidfile per launch id),
which stays a session-chain decision, not this slice's.

## Proofs

- Slice 3 harness: SLICE3_OK (record-only mode asserted).
- Shell --self-test: SHELL_REGISTRY_OK manifests=4 —
  manifests for every non-shell entry; a hello launch
  registers a backing-less own-process record; a second
  launch returns the same window and adds none; the crash
  seam removes the record. SHELL_WM_OK unchanged.
- run-chain tiers 0+1: 43/43 (the wm drift check became the
  shell-modules drift check; a shell-registry check added).
- greeter-ui: 8/8 — the bar still launches Firefox in the
  nested session, now through the registry.

## What this does not show

Tier-2: the session on the rig in this state is log 31's
proof (its debs carry the window-manager hosting and the
greeter card; this registry slice landed after those debs
were built and gets its own rig run when the owner sends
it). Single-instance focus in the live session is asserted
from the registry's semantics + the self-test, not yet
observed on the rig.
