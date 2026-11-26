# nct-package-coordinator

Packages of ALL kinds, one front. A coordinator, not a manager: apt, Flatpak and the rest ARE the package managers — this coordinates them.

Owns:
- kinds: system packages (deb, via PackageKit), Flatpak, NCT apps (.pck / NCTXML), ext-fwks bundles, fonts / themes / icon sets as packages
- install / remove / search / sources across all kinds; every backend speaks through sys-interface
- updates for every kind: policy, a snapshot BEFORE applying (the recovery guarantee), restart-required handed to system-watch
- protection: removing a package the desktop depends on is blocked with a plain explanation; Package Rescue in nct-recovery-manager is its repair arm

Hosting / language: Shell process — C# (transaction logic) with GDScript views.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Computer Use: Host = updates notify-only, snapshot before update, reboot in a chosen window; Kiosk = updates in a maintenance window only, then return to the app.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
