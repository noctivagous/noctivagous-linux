# godot/shell — the shell (foundation form)

A Godot project: the desktop itself, fullscreen — the demo's
wallpaper (backdrop.gd) and a launch bar across the top (bar_host.gd)
with the NCT mark, a clock, and one button per launch-list entry.
Launching goes through the hosted app registry and `nct-launch <id>`;
the shell holds no program paths. The window manager and app
registry modules are hosted here (vendored under nct-window-manager/
and nct-app-registry/, drift-checked). GDScript throughout
(build log 34) — the project ships as a .pck on the shared runtime.
`-- --self-test` prints the parsed list, proves the bar present
(SHELL_BAR_OK) and exercises the hosted modules (tier-0 check).
The full shell furniture (launch bars, dock, sysbar, widgets) is designed
in demo-de and lands here piece by piece; this is its landing slot.
