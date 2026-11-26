# nct-accessibility-manager

Access as a first-class service.

Owns:
- the AT-SPI2 bridge (screen reader) over the NCTXML component contract
- semantic roles, focus order, announcements
- magnifier, high contrast — surfaces via the window manager

Hosting / language: Shell process — GDScript, plus a GDExtension (C++) AT-SPI bridge when built.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Input Set: Mouse Only and Keyboard Only are also accessibility configurations, not only hardware ones — this module carries their access slice and keeps them available regardless of detected hardware.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1; plans/NCTXML.md (component contract).
