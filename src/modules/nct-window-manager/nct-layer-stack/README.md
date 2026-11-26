# nct-layer-stack

The render-layer list — which surface sits above which, frozen as a table.

Owns:
- the 12 layers: Lock, Switcher, Overlay-OSD, Overlay, Menu, Top, Popup, Workspace-Top, Workspace, Workspace-Bottom, Desktop, Background
- layer assignment on every Window record; surfaces are always windows, placed by layer

Hosting / language: Shell process — GDScript, inside nct-window-manager.

Status: SLICE 1 BUILT (2026-11-26, agent-build-log/17) —
layer_stack.gd holds the frozen table, the style -> default-layer
mapping (a dialog's layer follows its parent, resolved by the
window manager), and the CanvasLayer values the shell renders
with. The compositor-side stacking for foreign surfaces is
driven from this same table when that link lands. Plan:
src/plans/ENVIRONMENT-MANAGER.md §4.
