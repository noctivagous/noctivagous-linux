# nct-input-router

How input reaches windows.

Owns:
- key-clicks + bimodal control — the system's native input
- global operators: reserved keys no app may take
- focus policy as input policy (click / follows-cursor / sloppy); pointer, touch, tablet, stylus routing by layer priority

Hosting / language: Shell process — GDScript, over the key-click layer in keyclicks/.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Interaction Modality (PRIMARY slice-owner): Bimodal+MouseButtons (default) / Bimodal / Conventional / Direct Touch — this module decides what a key, a click and a touch each do under the declared modality. Input Set constrains which modalities are legal. Computer Use: Kiosk = input restricted to what the one app needs.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
