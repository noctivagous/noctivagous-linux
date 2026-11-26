# nct-security-manager

Security as a whole — the repo's security/ directory is its spec source.

Owns:
- policy: graded profiles (P1–P4) and the capability matrix (C1–C11)
- the guard: enforcement — grants, ASK prompts, plugs that redirect a capability to a substitute stream
- hot-topic indicators on windows and launch icons (drawn via the window manager); Monitor attachments

Hosting / language: Split: policy evaluation in the shell (C#); the enforcement point for privileged actions sits in the service layer.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Computer Use: Host = every service LAN-only by default; internet-facing is a per-service ASK under this module's policy; the single 'What's exposed?' screen is a view over its records. Kiosk = locked down by default, settings unreachable without admin auth.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1; repo-root security/SECURITY-MODEL.md, MATRIX-SPEC.md, MONITOR-APP.md.
