# nct-window-manager

Everything on screen: window records and policy for every window, whoever owns the pixels.

Owns:
- one Window record per window (plans §3); focus, geometry, stacking, decorations
- window style bundles — normal, dashboard, panel, dialog, popup, osd; freeze is a flag on any style
- workspace assignment of windows, with nct-workspace-manager

Hosting / language: Shell process — GDScript.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Computer Use: Kiosk = one app fullscreen, no launcher or window switching (a window-policy bundle — dashboard widgets are the same mechanism, a style of window). Interaction: Touchscreen = no hover-dependent behaviour, touch-sized hit areas; Mouse Only / Keyboard Only = focus policy must never require the absent device.

Status: SLICE 1 BUILT (2026-11-26, agent-build-log/17) — the
skeleton: window_record.gd (the §3 record + §5 style policy),
window_manager.gd (registry, focus, style conversion, freeze;
shell-backed windows on one CanvasLayer per layer), and a
headless harness (harness/) driving fake windows of every style.
Own-process and foreign backings attach to the same records in
Slice 3; chrome drawing, input routing and workspace assignment
are later work. Plan: src/plans/ENVIRONMENT-MANAGER.md §1–§5, §7.
