# nct-app-registry

Programs, as distinct from windows: what exists, how it launches, whether it is still alive.

Owns:
- the app registry — manifests, .desktop equivalents, NCTXML kinds
- launch, lifecycle, crash detection, single-instance
- .pck apps (own Godot process per Model 2), foreign apps (Qt / GTK / …), shell-kind programs; an app owns 0..n windows — the window manager owns the windows

Hosting / language: Shell process — GDScript.

Status: SLICE 3 BUILT (2026-11-26, agent-build-log/23) —
app_registry.gd: the manifest registry (pck / foreign / nctxml
kinds), launch handing the window manager a Window record with
the manifest's requested style (placement stays the manager's,
§6), single-instance with focus of the existing window, the
foundation-chain launch command per kind, lifecycle (running
set, clean close) and crash detection — a dead process loses
its window and is announced as app.crashed on the root's bus.
Real process spawning stays the foundation chain's (tier 1);
the process table here is the liveness seam. Plan:
src/plans/ENVIRONMENT-MANAGER.md §1, §6, §7 Slice 3.
HOSTED IN THE SHIPPED SHELL (2026-11-27, agent-build-log/32):
vendored into godot/shell beside the window manager (layout
mirrors src/modules; tools/sync-shell-modules.sh, drift-
checked). The shell registers one manifest per launch-list
entry, sets placeholder_backings = false (record-only
hosting: own-process and foreign apps get backing-less
records; surfaces attach at the compositor link), and routes
every bar launch through launch() — single-instance focus
included — before starting the program via nct-launch. The
liveness seam stays unfed in the session (nct-launch
detaches; no pid reaches the shell) until nct-launch reports
pids; the self-test feeds it by hand (SHELL_REGISTRY_OK).
