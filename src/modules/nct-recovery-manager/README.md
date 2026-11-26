# nct-recovery-manager

When the desktop itself is broken — beside the session, in the same hierarchy.

Owns:
- a graphical repair environment on its own minimal display stack
- Startup Repair, Driver Rollback (to the last-booted kernel<->driver pair), Package Rescue, the snapshot timeline
- a menu-driven emergency TUI when graphics cannot run; a raw shell is last, not first

Hosting / language: Outside Godot — service stack; the TUI is not a Godot program.

Status: SLICE D BUILT (2026-11-26, agent-build-log/22) —
recovery_backend.py (the repairs behind one interface:
Startup Repair, Driver Rollback, Package Rescue with the
desktop-core removal block, Snapshots; receipts = the System
Changes feed; the failed-boot auto-offer rule), recovery_tui.py
(the emergency TUI: menu model + curses front-end, shell last
and labelled manual), boot/nct-recovery.conf (the boot entry,
carrying nct.recovery=1). Booting into recovery is a rig
proof, owed — not claimed here. The graphical environment and
its wizards are the follow-up. Plan:
src/plans/SYSTEM-INTERFACE.md §5, §6.
