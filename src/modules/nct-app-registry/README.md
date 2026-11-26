# nct-app-registry

Programs, as distinct from windows: what exists, how it launches, whether it is still alive.

Owns:
- the app registry — manifests, .desktop equivalents, NCTXML kinds
- launch, lifecycle, crash detection, single-instance
- .pck apps (own Godot process per Model 2), foreign apps (Qt / GTK / …), shell-kind programs; an app owns 0..n windows — the window manager owns the windows

Hosting / language: Shell process — GDScript.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
