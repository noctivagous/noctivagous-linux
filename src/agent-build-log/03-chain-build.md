# 03 — The chain, built (2026-11-25)

**Done:** the working pieces of the chain, all in src/:
- core/session/ — nct-greeter-session (bridge + greeter under cage),
  nct-session (compositor + autostart), nct-session-apps,
  nct-launch (the one launcher), nct-resolve-cmd (the one place
  program paths/fallbacks/overrides live), nct-godot-run (pinned
  runtime runner), launch-list.tsv (shell, firefox, qt, hello,
  terminal — the one list).
- services/bridge/nct-greetd-bridge.py — greetd IPC (length-prefixed
  JSON over $GREETD_SOCK) on one side, a one-line TCP protocol on
  127.0.0.1:7717 on the other (PING / AUTH / START). Fixture backend
  when greetd is absent, so tests exercise the identical protocol.
  Exists because Godot has no Unix-socket API.
- godot/greeter — Godot project; UI built in code; AUTH then START
  against the bridge; `-- --auto-login <user> <pass>` for automation.
- godot/shell — Godot project; a bar with a clock and one button per
  launch-list entry, each running nct-launch. No program paths in it.
- godot/apps/nct-hello — the first-party proof app.
- godot/runtime/PIN.md — Godot 4.3.stable, zip sha256 recorded.
- core/compositor/labwc/ — near-stock rc.xml + autostart; labwc is a
  recorded stand-in in the compositor slot, not the NCT compositor.
- system/ overlay — greetd config.toml, wayland-sessions/nct.desktop,
  a reference systemd user unit for the shell.
- distro/debian/package-list.txt — the one package list (greetd,
  cage, labwc, sway, xwayland, foot, qterminal, firefox-esr, grim,
  wtype, mesa-vulkan-drivers, python3, git, openssh-server, sudo).

**Design choices worth remembering:** the greeter is an ordinary
Godot app with no privilege of its own; session state and logs go to
$NCT_STATE_DIR; in the greeter session that defaults to
/tmp/nct-greeter-state because the greeter user's $HOME is not
assumed writable (ASSUMPTION A9).
