# nct-device-centre

Devices and their drivers, with the laptop frictions built in.

Owns:
- the device tree and per-layer driver state (built != signed != enrolled != loaded, for Secure Boot)
- DKMS pre-flight before rebooting into a new kernel; missing firmware named, not silent
- hybrid-GPU wiring, fingerprint support stated plainly, dock / Thunderbolt (bolt) enrolment

Hosting / language: Shell process — GDScript views over the sys-interface object tree; checks run through sys-interface.

Status: SLICE C BUILT (2026-11-26, agent-build-log/21) —
device_centre.py: the Secure Boot four-state check (built /
signed / enrolled / loaded as separate checkable states with
the action for the failing layer), DKMS pre-flight (the update
waits rather than rebooting into a broken pair), the rollback
target, power-backend naming with conflicts stated, and the
view contexts behind device-pane.nctxml. Plan:
src/plans/SYSTEM-INTERFACE.md §4, §6.
