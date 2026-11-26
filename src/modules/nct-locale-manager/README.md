# nct-locale-manager

Language, region, i18n.

Owns:
- UI language; region formats (dates, numbers, currency); time zone (timedated via sys-interface)
- proposes the default keyboard layout by country — nct-keyboard-manager owns the layout itself

Hosting / language: Shell process — GDScript views over sys-interface.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
