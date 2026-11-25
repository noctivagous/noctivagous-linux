# 05 — The VM test bed (2026-11-25)

**Asked:** test scripts Muse Code can run on the Windows rig to
find out whether the guesses were right and fix what is not, as it
controls VirtualBox.

**Done:**
- vm/Vagrantfile — Debian 12 bookworm64, VirtualBox, VMSVGA + 3D
  acceleration, 4 GB / 2 CPU, headless by default.
- vm/provision.sh — installs the one package list, the pinned Godot
  runtime (sha256-checked), copies code to /usr/lib/nct mirroring
  the src layout, applies the system/ overlay, creates the greeter
  user and the VM-only test user (nct / nct-test-2026, labelled
  test-only at the top of the file), enables greetd.
- vm/vm-test.sh — host driver: up, run the bed, pull results, grab a
  host-side console screenshot via VBoxManage.
- tests/vm/run-all.sh — in-guest checks 00–08: environment and pins;
  the nested chain re-run with real firefox-esr; greetd armed;
  greeter up (bridge PING + greeter process); **the real login**
  through the bridge's greetd backend, then session processes as the
  test user; launching all three citizens inside the live session;
  rendering drivers; log collection. Each check can run alone.
- tests/vm/TESTBED.md — the runbook for Muse Code: the fix
  loop (read the log, form the cause, fix in the repo, re-prove in
  a disposable guest), and the rules (never weaken a check; never
  judge VM graphics performance; update the registers).
- tests/vm/ASSUMPTIONS.md — A1–A10, every guess in the foundation,
  each tied to the check that settles it. A5 (sway as labwc stand-in
  in automated tests) is already confirmed locally; the rest are open.

**Not done:** the bed has never run — the Windows box has not run
Vagrant yet, and the foundation branch is not pushed (see 06).
