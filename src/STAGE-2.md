# STAGE 2 — assemble the distro (plan)

Status: PLANNED 2026-11-25, not started. Stage 1 (the foundation run)
proved the chain from a repo checkout. Stage 2 turns the checkout into
an assembled Debian system — packaged, rooted, and run as a system —
using this machine (Muse) for everything except the one proof only
the Windows/VirtualBox rig can give: a real boot on a real seat.

Feasibility, checked on this machine before planning: debootstrap is
installed and deb.debian.org answers; systemd-nspawn is present;
qemu-system-x86, squashfs-tools, xorriso and live-build are installable
from the Ubuntu archive. Disk is the binding constraint: ~7 GB free,
so every slice measures and reports its artefact sizes, and apt caches
are cleaned inside the rootfs, never carried.

## The slices, in order

### S2.1 — Package NCT as .debs

`tools/build-deb.sh` builds, from src/:
- **nct-foundation** — /usr/lib/nct/{core,godot,services} + the system/
  overlay (greetd config, wayland-sessions entry, user unit).
- **nct-godot-runtime** — the pinned engine at /usr/lib/nct/godot/,
  built from the PIN (URL + sha256 verified at build time).

Gate: `dpkg-deb --contents` matches the intended tree; both debs
install into a bare chroot and every script lands executable at the
path the configs name. *Why first: from here on, the VM provision, the
rootfs and the image all consume the same two artefacts — no more
cp -r, no drift between "what we tested" and "what got installed".*

### S2.2 — Assemble the rootfs

`tools/build-rootfs.sh`: debootstrap bookworm (minbase) → install
distro/debian/package-list.txt + kernel + the two debs + the Godot
projects' data → users and services per system/. Two variants from one
script: **base** (no test user) and **test** (adds the VM-only
nct / nct-test-2026 account, exactly as provision.sh does today).
Output: a rootfs directory + a tarball + a manifest (dpkg -l, file
count, total size) committed as a report, not as data.

Gate: the manifest is complete and the size is reported honestly;
the tree contains greetd config, session entry, /usr/lib/nct, and no
apt cache or test residue in base.

### S2.3 — Run the assembled system (nspawn)

Boot the test rootfs under systemd-nspawn and run the chain *inside
it* (tools/run-chain.sh, tiers 0–1) via the installed /usr/lib/nct
copies — not the checkout.

Gate: run-chain passes inside the assembled system. This is the slice
that changes the claim from "the repo works" to "the distro, as
assembled, works". greetd under nspawn gets no real seat; that stays
VM territory and the run says so.

### S2.4 — The human-shaped greeter proof (nested, here)

Stage 1 logged in with `--auto-login`. This slice drives the real
greeter UI in the nested compositor with synthesized input (wtype /
wlrctl): wrong password → the FAIL state is visible and no session
starts; right password → session starts. Then, inside the session, a
synthesized click on the shell's Firefox button launches Firefox —
proving the shell as a launcher, not only the autostart path.

Gate: screenshots + window-tree assertions for both halves.

### S2.5 — Bootable image + emulated boot attempt (stretch, time-boxed)

Build a bootable image from the S2.2 rootfs (squashfs + kernel +
initramfs + bootloader via xorriso, or a raw disk image — the
simpler of the two at build time). Attempt a QEMU boot: no KVM here,
so pure emulation (TCG), serial console logged, a hard time box on
the attempt, screenshot if it reaches the greeter.

Gate: either it boots (evidence kept) or the attempt is recorded with
its logs and the boot proof passes to the VM test bed as a new
check 09 — an honest outcome either way, decided by evidence, not
by how long we stare at it.

### S2.6 — Converge and hand over

provision.sh switches from copying the tree to installing the two
debs, so the VM installs exactly what S2.3 ran. ASSUMPTIONS.md and
VM-RIG.md updated with what Stage 2 settled (A6 in particular);
the VM test bed gains check 09 if S2.5 produced an image.

## What Stage 2 is not

- Not the real NCT compositor (labwc still stands in), not the kit
  beyond tokens, not the key-clicks port, not real apps, not an
  installer. Those are later stages, each with this one's artefacts
  underneath it.
- Not a push. Local commits per slice; the branch reaches GitHub —
  and therefore the Windows rig — only on the owner's word.

## Risks, named

| Risk | Handling |
|---|---|
| Disk (~7 GB free) vs rootfs + image | Measure per slice; clean caches in-rootfs; if the image does not fit beside the rootfs, the rootfs tarball is the artefact and the image build moves to the rig |
| QEMU without KVM is slow | S2.5 is time-boxed and last; failure there blocks nothing |
| nspawn is not a seat | S2.3 claims the system runs, never that it boots; boot stays a VM check |
| Debian archive drift | Package list is unpinned today; if a build breaks on a moved package, pin via snapshot.debian.org in that slice and record it here |
