# nct-security-manager

Security as a whole — the repo's security/ directory is its spec source.

Owns:
- policy: graded profiles (P1–P4) and the capability matrix (C1–C11)
- the guard: enforcement — grants, ASK prompts, plugs that redirect a capability to a substitute stream
- hot-topic indicators on windows and launch icons (drawn via the window manager); Monitor attachments

Hosting / language: Split: policy evaluation in the shell (C#); the enforcement point for privileged actions sits in the service layer.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Computer Use: Host = every service LAN-only by default; internet-facing is a per-service ASK under this module's policy; the single 'What's exposed?' screen is a view over its records. Kiosk = locked down by default, settings unreachable without admin auth.

Status: SLICE 3, SPECCED-NOT-BUILT SCOPE (2026-11-26,
agent-build-log/23) — exactly the plan's line: profiles READ
(profiles.json, transcribed from security/MATRIX-SPEC.md
Axes 1+3; SecurityPolicy.cs evaluates any profile x capability
cell and names the plug a PLUG cell redirects to) and
indicators RENDERED (IndicatorTracker computes I0-I5 states
per Axis 5 from the disposition in force; the states are
carried on the window record and rendered by the shell via
indicator-bar.nctxml — this module does not draw, §6). NO
enforcement: nothing is granted, denied, plugged or sandboxed
by this code; the guard and its plugs are later work. Plan:
src/plans/ENVIRONMENT-MANAGER.md §7 Slice 3; spec:
repo-root security/SECURITY-MODEL.md, MATRIX-SPEC.md.
