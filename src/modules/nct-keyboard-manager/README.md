# nct-keyboard-manager

Keyboards — separate from routing: what the keys mean, not where they go.

Owns:
- layouts by country + variants, layout switching; dead keys, compose, repeat / delay
- Platform Configuration (Mac / PC emphasis); input methods (CJK etc., IBus / Fcitx hosting)
- the on-screen keyboard; default layout proposed by nct-locale-manager, owned here

Hosting / language: Shell process — GDScript.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Input Set: Touchscreen and Mouse Only = the on-screen keyboard is a primary device, summoned for text entry; otherwise available and collapsed, as built. Interaction: under bimodal modalities the keyboard's input modes (key-click / text) are this module's states, not settings.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
