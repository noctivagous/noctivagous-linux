# 22 — System-interface Slice D: recovery (boot entry + TUI)

Date: 2026-11-26. Asked by: the owner ("Run A–D without
interruption"). Same worktree/branch as log 19. Scope:
plans/SYSTEM-INTERFACE.md §6 Slice D — boot entry + emergency
TUI first (cheapest, covers the worst case); the graphical
environment and its wizards after.

## What was built (src/modules/nct-recovery-manager/)

- recovery_backend.py — the repairs behind ONE interface, so
  the TUI and the later graphical environment run the same
  repairs and raise the same receipts (§5): Startup Repair
  (findings in plain language, each fixable), Driver Rollback
  (to the last kernel↔driver pair that booted — Slice C's
  rollback target), Package Rescue (finish interrupted
  configuration; clear a stale lock only after checking its
  holder is gone; removing a desktop-core package is BLOCKED
  with the reason), Snapshots (restore a point). Every action
  writes a receipt (JSONL) — the System Changes feed the
  desktop will show on next start. should_offer_recovery():
  the automatic entry rule (offer recovery first at 3 failed
  boots). FixtureBackend is a recorded broken machine;
  RealBackend names its status plainly rather than pretending.
- recovery_tui.py — the emergency TUI: a menu model
  (RecoveryMenu: screens as line lists, keys as data) with a
  thin curses front-end over it. Six items; the shell is the
  last-but-one, labelled "(manual option)". Confirm screens
  name what will happen before it happens (the rollback
  screen names the exact kernel/driver pair).
- boot/nct-recovery.conf — the systemd-boot entry: always in
  the boot menu, booting nct-recovery.target with the kernel
  parameter nct.recovery=1 (recovery_backend.RECOVERY_PARAM —
  the test asserts the entry and the code agree).
- test_recovery.py — the harness. One additive tier-0 check.

## Evidence

- SLICED_OK. The menu model drives every repair against the
  fixture backend: Startup Repair fixes all three findings;
  rollback applies kernel 6.8 / nvidia 550 after a confirm
  screen that names them; Package Rescue finishes the
  interrupted kernel configuration, clears the stale lock,
  and the flow itself shows the desktop-core refusal ("part
  of the desktop's core set") while a non-core removal is
  allowed; the newest snapshot restores. Receipts on disk
  cover all four repair kinds, each marked where=recovery.
  The auto-offer rule fires at the threshold and not below.
- The pty smoke test runs the REAL curses front-end: the menu
  renders in a pty ("NOCTIVAGOUS RECOVERY"), the rollback flow
  completes from keystrokes, and its receipt lands on disk.

## What this does not show — read this before calling D done

- NOTHING here has booted. The boot entry is a data file whose
  consistency with the code is checked; whether the machine
  actually boots into the recovery target, on the ladder's
  lowest rung, with the TUI on a real console, is a tier-2
  rig proof and it is OWED. Slice D is built, not proven —
  the same distinction as the QEMU smoke in log 14.
- The graphical repair environment and its wizards are the
  named follow-up (§6), not built. The real backend's actions
  are interfaced but unimplemented; the fixture backend is
  what every proof above ran against.
