# 10 — S2.3: the chain run inside the assembled rootfs (2026-11-25)

**Done:** tools/run-in-rootfs.sh runs tools/run-chain.sh inside
/var/nct-build/rootfs-test, from the installed /usr/lib/nct copies.
Log and summary in src/distro/reports/ (nspawn-test-*).

**Method, honestly:** systemd-nspawn was tried first and cannot run
in this sandbox — it fails mounting sysfs ("Operation not
permitted"; the sandbox is itself a container). The run therefore
used a plain chroot, which executes the same installed files against
the rootfs's own trixie libraries. The log header records the method
that actually ran.

**Result: tier 0 — 12 passed, 0 failed, inside the rootfs.**
Every session script parses, the bridge parses and passes fixture
auth (PING / wrong password / right password), Godot imports all
three projects from the installed copies, and the shell self-test
passes — all with the rootfs's own python3, glibc and libraries,
not the host's.

**Tier 1 did not run, and the reason is the sandbox, not the
system.** wlroots opens /dev/urandom before anything else; sway
died on exactly that ("Failed to open random device"). Every way of
giving a chroot a real /dev was tried and is denied here:
bind-mount of /dev (rc 32), devtmpfs (permission denied), mknod
(operation not permitted), and nspawn's own mounts (above). In any
real boot, /dev comes from devtmpfs+udev and this wall does not
exist; tier-1-in-system therefore belongs to the VM test bed
(checks 01/05), which was always its tier-2 home. The same tier
passes on this host against the identical code the deb installs
(run-chain 15/15; the human-shaped UI test 8/8, file 08).

**What this shows / does not show:** the assembled system's files
execute correctly as an installed system, not just as a source tree
— that was S2.3's question, and tier 0 answers it. It does not show
the window chain running inside the rootfs in this sandbox (proven
impossible here, for stated reasons), and it does not show booting.
Nobody independent has checked any of this.
