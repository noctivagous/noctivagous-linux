# nct-layer-stack

The render-layer list — which surface sits above which, frozen as a table.

Owns:
- the 12 layers: Lock, Switcher, Overlay-OSD, Overlay, Menu, Top, Popup, Workspace-Top, Workspace, Workspace-Bottom, Desktop, Background
- layer assignment on every Window record; surfaces are always windows, placed by layer

Hosting / language: Shell process — GDScript, inside nct-window-manager.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §4.
