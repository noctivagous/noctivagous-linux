# 21 — System-interface Slice C: device-centre

Date: 2026-11-26. Asked by: the owner ("Run A–D without
interruption"). Same worktree/branch as log 19. Scope:
plans/SYSTEM-INTERFACE.md §6 Slice C — the device-centre tree
with the Secure Boot four-state check and DKMS pre-flight;
power-backend naming.

## What was built (src/modules/nct-device-centre/)

- device_centre.py — the logic:
  - four_state(module, kernel): built / signed / enrolled /
    loaded as four separate checkable states (§4: they fail
    separately, so they are checked separately).
  - secure_boot_verdict: the FIRST failing state in the chain,
    in plain language ("built and signed, key not enrolled"),
    with the action for that layer — the enrolment action
    explains the one-time reboot screens before rebooting.
  - device_health: working / blocked-at-a-layer / unsupported.
    An unsupported device (the fixture's fingerprint reader,
    by USB ID against libfprint's list) is STATED as
    unsupported with its source named — never omitted (§4).
  - dkms_preflight(pairs, new_kernel): every kernel↔driver
    pair must build for the new kernel; if one fails, the
    update waits with the reason — never reboot into a
    known-broken pair. rollback_target: the last pair that
    booted (Driver Rollback's target, used by Slice D).
  - power_backend: names the one backend in force; two at
    once reads as a conflict with a plain statement, not a
    silent no-op.
  - view_contexts: per-device contexts (the four states as
    words + the verdict) for the NCTXML view.
- fixtures/devices.json — one device per failing layer
  (working GPU, Wi-Fi blocked at enrolled, vboxdrv blocked at
  signed), the unsupported reader, DKMS pairs where rtw89 does
  not build for the new kernel, one power backend.
- device-pane.nctxml + harness/DeviceViewHarness.cs — the
  view proof: the pane rendered from the logic's own contexts.
- test_device_centre.py — the logic harness. Two additive
  tier-0 checks (logic; view).

## Evidence

- SLICEC_OK: each device lands on its designed layer
  (enrolled / signed / built), the unsupported reader is
  stated with libfprint named, pre-flight blocks on rtw89 for
  kernel 6.9 with the reason naming both, the nvidia-only
  pre-flight passes, the rollback target is the booted 6.8
  pair, PPD is named when alone and a conflict when TLP joins.
- SLICEC_VIEW_OK: the rendered pane for the Wi-Fi device reads
  Signed "yes", Enrolled "NO", verdict "built and signed, key
  not enrolled"; for the GPU, Loaded "yes", verdict "working".

## What this does not show

- The device data is a fixture, not the bridge's devices
  domain (udisks2 / BlueZ / bolt / kernel modules / firmware)
  — that source joins the tree when it lands, behind the same
  model. The other §4 frictions (hybrid GPU, missing firmware
  by name, IPU6 layers, sleep report, dock enrolment) are
  designed cases in the plan, not built here; Slice C is the
  three named in §6. Re-verification after kernel/Secure Boot
  changes (§4's gap-closure) is the watch's job once the
  devices domain feeds it.
