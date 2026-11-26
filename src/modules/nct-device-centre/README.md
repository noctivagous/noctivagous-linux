# nct-device-centre

Devices and their drivers, with the laptop frictions built in.

Owns:
- the device tree and per-layer driver state (built != signed != enrolled != loaded, for Secure Boot)
- DKMS pre-flight before rebooting into a new kernel; missing firmware named, not silent
- hybrid-GPU wiring, fingerprint support stated plainly, dock / Thunderbolt (bolt) enrolment

Hosting / language: Shell process — GDScript views over the sys-interface object tree; checks run through sys-interface.

Status: STUB — laid out 2026-11-26, not built. Plan: src/plans/SYSTEM-INTERFACE.md §4.
