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

Status: SLICE 1 SKELETON (2026-11-26, agent-build-log/17) —
environment_manager.gd: a module registry (register / look up)
and a bus that is deliberately a log: announcements are recorded
so tests can see who said what. A real message bus replaces the
log behind this same interface when a second consumer arrives.
The modes/ placeholder is unchanged. Plan:
src/plans/ENVIRONMENT-MANAGER.md §1, §8.

SLICE 3 (2026-11-26, agent-build-log/23): the shell's furniture
lives here — furniture/top-bar.nctxml and
furniture/side-tabs.nctxml are shell-kind NCTXML documents,
rendered by the nctxml interpreter and registered with the
window manager as panel windows; their buttons launch apps
through nct-app-registry. The Slice 3 harness
(harness/Slice3Harness.cs) composes root + window manager +
app registry + security policy in one scene. The bus is still
a log — Slice 3's app.launched / app.crashed announcements are
its second real consumer in embryo; the real bus lands when a
module must react, not just record.
