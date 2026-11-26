# nct-settings-service

Settings as a system service — the registry every settings surface reads.

Owns:
- the settings registry: apps declare property lists; the stock settings kit renders them
- system pages (Platform Configuration, profiles, plugs, …)
- change notification to owners — no polling

Hosting / language: Shell process — GDScript (registry + notification).

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Stores the three mode values (modes.computer-use, modes.input-set, modes.interaction-modality), the per-setting divergence from a mode's bundle, and the previous bundle so a mode change can be reversed.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
