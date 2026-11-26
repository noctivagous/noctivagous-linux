# nct-display-manager

Displays.

Owns:
- enumerate outputs; geometry, scale, rotation per output; span / extend / mirror; fractional scaling
- which layers and bars exist per output — the window manager draws them

Hosting / language: Shell process — GDScript.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Input Set: knows which display is the touch display (the fact nct-device-centre detects and this axis may be proposed from); per-display override of Input Set is a reserved question (modes/README.md).

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
