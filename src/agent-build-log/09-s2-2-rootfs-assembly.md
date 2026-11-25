# 09 — S2.2: Debian rootfs assembly, base + test (2026-11-25)

**Done:** tools/build-rootfs.sh <base|test> assembles the distro
rootfs: debootstrap minbase → chroot apt install of
distro/debian/package-list.txt + linux-image-amd64 → apt install of
the two S2.1 debs → greeter system user (+ the test user only in the
test variant) → greetd enabled → hostname nct-<variant> → caches
cleaned → manifest in src/distro/reports/.

**Result, both variants built and gate-checked:**
- test: 1.6 GB, 463 packages, kernel 6.12.117+deb13, greetd enabled,
  our /etc/greetd/config.toml in place, /usr/lib/nct complete,
  nct.desktop session entry present, godot run from inside the
  rootfs reports 4.3.stable.official.77dcf97d8, test user present,
  apt archives/lists stripped.
- base: same manifest, and the gate's point — **test user absent**.

**Four findings on the way, in the order they bit:**

1. **The workspace volume refuses chown to non-owner gids** (tar
   extraction in debootstrap died on setgid directories). Build dir
   moved from ~/workspace/.nct-build to /var/nct-build; the overlay
   root filesystem allows chown. (Same reason build-deb.sh staging
   moved off /tmp later: a 512 MB tmpfs overflowed mid-compression
   and left a stub .deb — staging now lives under /var/nct-build.)
2. **A chroot has no network here.** This host reaches archives
   through an egress proxy configured for apt; the proxy's name
   resolves only via the host's /etc/hosts, not DNS. build-rootfs.sh
   mirrors the proxy apt config and the hosts alias into the chroot,
   both marked build-machine-only / NOT part of the distro; the
   image build (S2.5) strips them.
3. **Debian bookworm has no labwc package** — checked against
   bookworm's full 63,440-package index (0 matches; every other
   package-list entry exists). The base therefore moved to
   **Debian 13 (trixie)**: build-rootfs.sh, the package-list header,
   and the Vagrant box (debian/trixie64) all changed. Downstream
   trixie effects are ASSUMPTIONS.md A11, for the rig to settle.
4. **Our foundation deb collided with greetd's own config.**
   Debian's greetd ships /etc/greetd/config.toml; dpkg refused ours
   at the same path. Fixed the standard way: nct-foundation declares
   **Replaces: greetd** (install log: "Replacing files in old
   package greetd"). Recorded cost: removing nct-foundation does
   not restore greetd's stock config — no dpkg-divert at this stage.

One trixie attempt was also killed mid-download by the agent's own
over-broad pkill matching its own command line — an operator error,
not a build failure; process discipline note is in file 08's arc
(use PID lists, never pattern pkills, in this environment).

**What this shows / does not show:** the distro assembles from
declared inputs into a complete, self-consistent tree, twice, with
the variant difference exactly where it should be. It does not show
the system boots or that greetd runs in it — that is S2.3/S2.5 and
the VM test bed. Nobody independent has checked any of this.
