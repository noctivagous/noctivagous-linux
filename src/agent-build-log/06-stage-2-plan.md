# 06 — Stage 2 plan (2026-11-25)

**Done:** STAGE-2.md written and committed (84cb18a): assemble the
distro on this machine — S2.1 two debs, S2.2 debootstrap rootfs
(base + test), S2.3 run the chain inside the assembled rootfs under
systemd-nspawn, S2.4 the human-shaped greeter proof (typed login,
shell button click), S2.5 a time-boxed bootable-image + QEMU
emulated-boot stretch, S2.6 converge provision.sh onto the debs.
Feasibility was checked first (debootstrap, nspawn, archive access;
disk ~7 GB named as the binding constraint).

**Decided (owner, 'do this' on the plan's recommendations,
2026-11-25):** two debs; S2.5 kept, last and time-boxed; the test
user only in the test variant; start at S2.1 and proceed slice by
slice, logging each in this directory.

**Still open, unchanged:** the branch has never been pushed. The
Windows handover waits on the owner's push word.
