# 12 — S2.6: convergence + registers (2026-11-25)

**Done:** the VM rig now consumes the same artefacts as everything
else, instead of its own parallel assembly:
- vm/provision.sh installs curl+unzip (a latent gap: the package
  list has neither), runs src/tools/build-deb.sh in the guest, and
  apt-installs the two debs from the synced tree — replacing the
  manual Godot download and the cp -r tree copy. Package-list
  install, greeter + test users, and greetd enable are unchanged.
- tests/vm/ASSUMPTIONS.md: A2 updated for Debian 13 and given the
  S2.5 evidence (greetd starts and opens the greeter PAM session in
  a real boot; the greeter session staying up is now A13's
  question, not A2's). A11 added earlier for trixie downstream
  effects; A12 for real-pointer input reaching Godot; **A13** for
  the greeter session exiting under a real seat (QEMU evidence in
  file 11).
- tests/vm/run-all.sh gains **check 09**: after a rig boot, greetd
  is active (not start-limited) and a greeter process persists —
  the in-guest form of the S2.5 graphical-boot question.
- VM-RIG.md: guest row is Debian 13; the Stage 2 log entry records
  the deb convergence, the rootfs results, the sandbox /dev wall
  (file 10), and both QEMU boots (file 11).

**Stage 2, whole:** S2.1 debs ✓ · S2.2 rootfs base+test ✓ ·
S2.3 chain in rootfs — tier 0 12/12, tier 1 sandbox-blocked
(file 10) · S2.4 human-shaped greeter 8/8 (file 08) · S2.5 image +
QEMU boots (file 11) · S2.6 this file. Everything is committed
locally on feat/foundation-src; nothing is pushed — the branch
still needs the user's push word before the Windows rig can pull
it. What nobody has checked: everything tier 2 — a real seat, a
real pointer, VirtualBox's graphics — which is the rig's whole
reason to exist.
