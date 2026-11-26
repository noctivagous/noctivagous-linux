# nct-storage-manager

Disks, volumes, mounts.

Owns:
- mounts as forms — validated, test-mounted before saving
- encryption (LUKS) state; disk health, with system-watch
- removable media policy

Hosting / language: Shell process — GDScript views over sys-interface (udisks2).

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
