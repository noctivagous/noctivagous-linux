# nct-window-manager

Everything on screen: window records and policy for every window, whoever owns the pixels.

Owns:
- one Window record per window (plans §3); focus, geometry, stacking, decorations
- window style bundles — normal, dashboard, panel, dialog, popup, osd; freeze is a flag on any style
- workspace assignment of windows, with nct-workspace-manager

Hosting / language: Shell process — GDScript.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Computer Use: Kiosk = one app fullscreen, no launcher or window switching (a window-policy bundle — dashboard widgets are the same mechanism, a style of window). Interaction: Touchscreen = no hover-dependent behaviour, touch-sized hit areas; Mouse Only / Keyboard Only = focus policy must never require the absent device.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1–§5.
