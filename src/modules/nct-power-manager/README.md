# nct-power-manager

Power — energy saver + battery (the user's framing).

Owns:
- battery state, health, charge behaviour (UPower)
- energy saver / power profiles — the backend in force is named; power-profiles-daemon vs TLP in conflict is an Issue
- brightness and DPMS / blanking policy (nct-session-manager acts on it)

Hosting / language: Shell process — GDScript views over sys-interface.

Mode slices (nct-environment-manager/modes/ — PLACEHOLDER):
- Computer Use: Workstation = sleeps when idle; Host = never sleeps, lid-close keeps serving, Wake-on-LAN; Kiosk = screen on a schedule, no sleep during open hours.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/ENVIRONMENT-MANAGER.md §1.
