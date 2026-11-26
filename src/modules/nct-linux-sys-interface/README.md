# nct-linux-sys-interface

The bridge to the Linux system — the sole channel between the desktop and everything underneath it.

Owns:
- subscriptions to systemd, the journal, logind, UPower, NetworkManager, udisks2, BlueZ, bolt, PackageKit, fwupd (subscribe, don't poll)
- one live system object tree that panels and centres render as views
- privileged actions, performed by the daemon half under polkit — the shell's say-so is never enough

Hosting / language: Split: daemon half as a system/user service (service stack, bridge pattern); thin GDScript client in the shell.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/SYSTEM-INTERFACE.md §1.
