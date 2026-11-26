# nct-session-manager

The user's session as a whole.

Owns:
- login / logout / switch user (the greeter side is already proven in the foundation chain)
- save / restore — open apps, window geometry, workspaces
- lock, idle, suspend / resume, screen blanking; the lock surface itself is a window, in the Lock layer

Hosting / language: Shell process — GDScript, over the session scripts in core/session/.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Computer Use: Workstation = normal login/lock/logout; Host = services survive logout, lock and shell crash (and says so, per service); Kiosk = auto-login, auto-launch of the one app.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
