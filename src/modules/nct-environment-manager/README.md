# nct-environment-manager

The root: coordinates every module under it; implements nothing itself.

Named "environment", not "desktop" (owner, 2026-11-26; renamed from
nct-desktop-manager): the root coordinates the user's whole environment,
which is not tied to the desktop form factor — the same hierarchy must
cover desktop, mobile, tablet and VR naturally. "Desktop" remains the
name of the desktop form factor's shell and spaces, not of the root.

Owns:
- the module registry and the bus modules talk through
- the one Settings root and the one Issue path (unified-design rules)
- the meta-configurations (modes/ — PLACEHOLDER): Computer Use Mode,
  Input Set, and Interaction Modality. The definitions live in modes/;
  each module implements its own slice of a mode's bundle

Hosting / language: Shell process — GDScript (coordination only).

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1, §8.
