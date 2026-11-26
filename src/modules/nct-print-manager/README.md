# nct-print-manager

Printing.

Owns:
- printers — IPP / driverless first, CUPS queues; discovery
- print jobs: state, cancel, reprint
- a printer with no working path is an Issue (via system-watch), not silence

Hosting / language: Shell process — GDScript views over sys-interface.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
