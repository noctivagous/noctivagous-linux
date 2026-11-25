# src/

# Noctivagous Linux system's source

Noctivagous Linux is a Linux distribution driven by
key-clicks rather than the mouse, but always backwards-compatible

with mouse clicks.   The first objective is to get a “flat space"

desktop environment working, but there is a set of spatial explorations.

`demo-de/` at the repo root is
where the flat space desktop environment is designed and prototyped

in React/TypeScript; this tree is the
real system being built, on Debian 13 with a Godot
greeter and shell hosting ordinary foreign programs (Firefox, Qt
apps) alongside its own.

This is first to see whether can Godot can allow the construction of

a robust desktop environment.

## What This Is

Noctivagous Linux sits on Debian.  Debian itself is never in this tree.

What's in `src/`:

- **Our source** — the session scripts (`core/`), the Godot greeter/shell/apps (`godot/`), the auth bridge (`services/`), the kit tokens.
- **Our files at their installed paths** — `system/` is an overlay that mirrors the installed filesystem exactly: `system/etc/greetd/config.toml` is the file that lands at `/etc/greetd/config.toml`, and so on.
- **The recipe for the Debian underneath** — `distro/debian/package-list.txt` is just a list of Debian package names. No Debian binaries, no archive mirror, nothing of Debian's is copied in.

Debian enters only at build time, from the public Debian archive, when the tools run:

debootstrap (Debian 13 base, downloaded)

  → apt installs the package-list packages + kernel

    → our two .debs install on top:

        nct-foundation     (built from this tree by tools/build-deb.sh)

        nct-godot-runtime  (the pinned engine, downloaded + hash-verified)

      → greeter/test users created, greetd enabled

The Vagrant (VirtualBox) route does the same thing into a stock Debian guest instead of a debootstrap rootfs. Even the Godot engine follows the pattern — git holds only its pin (version + SHA-256 in `godot/runtime/PIN.md`); the binary is fetched at build time. And everything produced (debs, rootfs, disk image) is a build output that lives outside git.

**`So, src/`&#32;is everything that is&#32;*ours*&#32;— source, overlay, package list, and builders — and Debian is pulled in underneath it, by name, when you build.**

> How would someone put it on a USB stick then and boot it someday, from Windows or Mac (or Linux?

Today: they can't — yet. The image we build (`nct-test.img`) is a bare ext4 filesystem with no partition table and no bootloader. Firmware can't boot that; only QEMU can, because QEMU loads the kernel directly and skips firmware entirely. That's the "image needs a partition table and bootloader" debt in the README's next-work list. Here's the whole picture:

The one missing piece is a variant of the image built for real firmware:

- GPT partition table with two partitions: a small FAT32 EFI System Partition holding a bootloader (GRUB, or systemd-boot) plus the kernel and initrd, and the ext4 root partition holding the system.
- Bootloader config and `fstab` that find the root partition by UUID — on a stick it might be `/dev/sda` on one machine and `/dev/sdb` on another, so the `/dev/vda` our QEMU image uses can't survive contact with real hardware.
- Secure Boot: either the image uses Debian's signed shim+GRUB (Secure Boot stays on) or the person turns Secure Boot off in firmware setup. Ours would start as the second, simpler thing.

That variant is a modest extension of `build-image.sh`, and it can be assembled in this sandbox without loop devices (partitions written at file offsets). Nothing else in the system has to change — it's the same rootfs.

Once that image exists, putting it on a stick is the standard raw-image write — the stick *becomes* the system disk and boots the distro directly:

| Host | Tool | How |
| --- | --- | --- |
| Windows | Rufus (choose DD mode when asked) or balenaEtcher | Select the `.img`, select the stick, write |
| Mac | balenaEtcher, or Terminal: `diskutil unmountDisk /dev/diskN` then `sudo dd if=nct.img of=/dev/rdiskN bs=4m` | Same idea |
| Linux | `sudo dd if=nct.img of=/dev/sdX bs=4M status=progress`, or GNOME Disks → "Restore Disk Image" | Same idea |

Then: plug the stick into the target machine, open its boot menu (usually F12/F8/Esc at power-on), pick the USB entry, and it boots into greetd — the same chain, on real hardware, which would also make it the first true tier-2 test outside a VM.

Two  footnotes: writing the image erases the stick, obviously; and this is a *bootable system stick*, not an installer — a live environment that installs onto a machine's internal disk is a separate, larger piece of work for later.

## Status

The greeter (what produces the login screen) and sample nct-hello

program that launches after login are made from Godot programs.

The current stage is the foundation: one
end-to-end chain — boot, greeter, login, session, launching pre-set
programs — proven before anything else is added. That chain is
proven in nested tests and in QEMU boots of the assembled distro;
proving it on the VirtualBox test rig is the next step (see \*State
of things\*, below).

## Options to run

Four ways to run what is here, depending on what you have. All
disposable-machine routes use the same test credentials — user
**`nct`**, password **`nct-test-2026`** — in the VM guest and the
`test` image variant only; never reuse them anywhere else.

If you cloned from GitHub: scripts in this tree may check out
without their executable bits (they were published by a snapshot
push, which does not carry file modes). Everything the *installed*
system executes gets its mode back from the .deb packaging, so an
installed system is unaffected. Scripts you run straight from the
tree, run via `bash <path>` (or `chmod +x` them once).

| Route | Host you need | Extra installs | What you end up with |
| --- | --- | --- | --- |
| **A1 · VirtualBox + Vagrant** | Windows / Intel Mac / Linux, x86-64 | VirtualBox, Vagrant | A Debian 13 guest with the system provisioned into it — the project's test rig |
| **A2 · VirtualBox app only** | Windows / Intel Mac / Linux, x86-64 | VirtualBox | The same guest, created and installed by hand in the app |
| **B · QEMU disk image** | Debian/Ubuntu Linux | qemu-system-x86, debootstrap | The whole distro built into a disk image, booted directly — no guest install step |
| **C · No VM (harness)** | Debian/Ubuntu Linux with wlroots | sway, the pinned Godot (fetched by the tools) | The chain running nested on your desktop/host — tests, not a boot |

### The Vagrant vs. manual question (Routes A1 and A2)

Both VirtualBox routes produce **the identical guest**, because
both end with the same provisioning script (`vm/provision.sh`)
doing the same work: package list in, the two .debs built from this
tree and installed, `greeter` + `nct` users created, greetd
enabled. Vagrant is only a wrapper around the manual steps:

|  | A1 · Vagrant | A2 · Manual |
| --- | --- | --- |
| Creates the VM | The Vagrantfile, one command | You, in the VirtualBox app (\~5 minutes) |
| Operating system | A prebuilt `debian/trixie64` box, unattended | You run the Debian 13 installer from the netinst ISO |
| Repo reaches the guest | Synced folder mounted at `/vagrant`, automatic | You clone in the guest and link it to `/vagrant` (or use Shared Folders) |
| Provisioning | Automatic on `vagrant up` | You run `provision.sh` once, by hand |
| Rebuild from scratch | `vagrant destroy` + `vagrant up` | Delete the machine, repeat the steps |
| SSH from the host | Built in (host port 2222) | Your own NAT port-forward rule, or just use the VM console |
| You need on the host | VirtualBox **and** Vagrant | VirtualBox only |

So: use A1 if you have (or can install) Vagrant and want the
repeatable, scriptable rig — that is what the test bed is written
against. Use A2 if you simply have the VirtualBox app on your
desktop and want to look at the system. Nothing about the guest
differs; only who performs the setup steps.

### Route A — VirtualBox

Guest specification (both A1 and A2): \*\*4 GB RAM, 2 CPUs, 20 GB or
more of virtual disk, VMSVGA graphics with 3D acceleration.\*\* The
disk figure is a ceiling, not a footprint: VirtualBox disks are
dynamically allocated, and the installed system is ≈1.6 GB (the
built disk image is ≈2.1 GB), so the machine occupies ~2 GB on the
host — the rest is headroom for building packages and snapshots in
the guest. The host needs an x86-64 machine with hardware
virtualization (VT-x/AMD-V) and roughly 25 GB free. This system is amd64 and VirtualBox
virtualizes rather than emulates, so \*\*Apple Silicon Macs cannot
run this route\*\* — on one of those, use Route B under QEMU. The
guest needs internet access while provisioning (apt, and the
Godot engine download, which is hash-verified).

**A1 · With Vagrant:**

```powershell
cd <clone>\src\vm
vagrant up            # first run provisions; SSH ends up on host port 2222
vagrant ssh -c "sudo bash /vagrant/src/tests/vm/run-all.sh"
```

Or `bash vm-test.sh` from Git Bash in `src/vm`, which also grabs a
host-side console screenshot.

**A2 · With the VirtualBox app alone:**

1. Create a new machine: type Debian (64-bit), 4 GB RAM, 2 CPUs,
   a virtual hard disk of 20 GB or more (dynamically allocated —
   the system itself is ≈1.6 GB). In Settings → Display,
   set the graphics controller to **VMSVGA** and enable \*\*3D
   acceleration\*\*. Under Network, the default NAT is fine; for
   SSH from the host, add a port forwarding rule (host 2222 →
   guest 22).
2. Start the machine with the **Debian 13 netinst ISO** attached
   and install normally — any username; include the SSH server if
   you want it.
3. In the running guest, put this repository at the path the
   provisioning script expects, `/vagrant`:

```bash
   git clone https://github.com/noctivagous/noctivagous-linux.git
   sudo ln -s "$HOME/noctivagous-linux" /vagrant
```

   (Or share a host clone through VirtualBox Shared Folders and
   mount/link that folder at `/vagrant` — needs Guest Additions.)

4. Provision, then reboot:

```bash
   sudo bash /vagrant/src/vm/provision.sh
   sudo reboot
```

   The machine should come back up into greetd. From then on it
   is an ordinary VirtualBox machine — start, stop and snapshot
   it from the app as you like. Run the test bed in the guest
   with `sudo bash /vagrant/src/tests/vm/run-all.sh`.

Test-bed results land in the guest's `/tmp/nct-results/` and,
with the synced/shared folder mounted, in `tests/vm/results/` —
a one-line summary per check (00–09), a log per failing check,
screenshots. `tests/vm/TESTBED.md` is the runbook for working
from those results; `tests/vm/ASSUMPTIONS.md` is the register of
guesses each check settles.

### Route B — QEMU, from a Linux host

This builds the distro itself — packages, rootfs, disk image —
and boots the image. There is no guest install step; the image
*is* the system.

| Requirement |  |
| --- | --- |
| Host | Debian/Ubuntu Linux, x86-64, with root (sudo) — the builders use debootstrap and chroot |
| Installed on the host | `debootstrap`, `dpkg-deb` (dpkg-dev), `qemu-system-x86_64`, e2fsprogs |
| Free disk | \~10 GB (rootfs ≈ 1.6 GB, image ≈ 2.1 GB, plus build staging under `/var/nct-build`, overridable via `NCT_BUILD_DIR`) |
| Internet | During the build (apt archives, and the hash-verified engine download) |
| KVM | Optional. With `/dev/kvm` the boot is fast; without it QEMU emulates and the boot takes minutes — the recorded boots were emulated |

```bash
cd src
tools/build-deb.sh              # the two .debs -> distro/debs/
tools/build-rootfs.sh test      # Debian 13 rootfs: package list +
                                # kernel + the two debs, greetd
                                # enabled, test user nct created
tools/build-image.sh test       # bootable ext4 image (bare image,
                                # no bootloader — see below)
tools/boot-image-qemu.sh test   # boot it, serial console logged to
                                # distro/reports/qemu-test-boot.log
```

`build-rootfs.sh base` builds the same system without the test
user. The boot script boots to a multi-user console: success is a
`nct-test login:` prompt on the serial log, and you can sign in
with the test credentials. To boot the graphical target instead —
the one that starts greetd — run QEMU directly:

```bash
IMG=/var/nct-build/image-test
qemu-system-x86_64 -m 2048 -smp 2 -machine q35 -display none \
  -serial file:qemu-graphical.log -monitor none \
  -kernel "$IMG/vmlinuz" -initrd "$IMG/initrd.img" \
  -append "root=/dev/vda rw console=ttyS0" \
  -drive "file=$IMG/nct-test.img,format=raw,if=virtio" \
  -netdev user,id=n0 -device virtio-net-pci,netdev=n0
```

The image has no partition table or bootloader, so both QEMU
commands boot the kernel directly. For the same reason the raw
image does not boot standalone in VirtualBox — Route A provisions
a stock guest instead of using this image.

### Route C — no VM: the harness

Two scripts run the chain on the build host itself, inside a
nested headless compositor — this is how most development is
checked: `tools/run-chain.sh` (the whole chain; window tree and
screenshots as evidence) and `tools/run-greeter-ui-test.sh` (the
real greeter UI driven with synthesized keyboard input only:
wrong password, then right password, then Enter on the shell's
Firefox button). `tools/run-in-rootfs.sh` runs the chain inside
an assembled rootfs. None of this proves anything about booting
or real display hardware — that is what Routes A and B are for.

## The documents

- **ARCHITECTURE.md** — layers, the chain, the test tiers.
- **CONVENTIONS.md** — the rules everything shipped here follows.
- **VM-RIG.md** — the Windows/VirtualBox test rig (living file).
- **STAGE-2.md** — the plan for the assembly stage, as executed.
- **agent-build-log/** — what was actually done, section by section,
  including what each result does and does not show.
- **foundation-overview.html** — this same picture as one readable page.

## The chain

The foundation exists to make one sequence work, end to end:

1. **Boot** — greetd starts the greeter session.
2. **Greeter** — the Godot greeter runs fullscreen.
3. **Login** — credentials are checked through the auth bridge.
4. **Session** — the compositor starts; the shell comes up.
5. **Launch** — pre-set programs open from inside the session.

The step-5 programs are set up in advance, in one list
(`core/session/launch-list.tsv`), and cover the three kinds of
citizen the desktop has to host from the first day: a foreign browser
(Firefox), a foreign toolkit app (a Qt program — QTerminal), and one
of our own apps on the pinned Godot runtime (`nct-hello`). A program
is added to the desktop by adding a line to the list, not by editing
the shell.

How the pieces fit: greetd starts a single-app session — a small
compositor (cage) running the greeter fullscreen. Godot has no
Unix-socket API, so a small bridge service speaks greetd's protocol
on one side and a one-line local protocol on the other; the greeter
offers credentials through it and, on success, asks it to start the
session. In tests without greetd, the same bridge checks a fixture
account, so the greeter and the protocol are exercised identically.
The session script starts the compositor (labwc as the stand-in);
its autostart starts the shell — a separate Godot process, so a
shell failure is a restart, not a lost session — and the launch
list's autostart entries.

## Three kinds of work

The system is three kinds of work with three different build-and-test
loops, kept in separate parts of the tree so they never blur:

| Kind | Where | What it is | How it is tested |
| --- | --- | --- | --- |
| Core | `core/` | A wlroots-class compositor (stand-in in the foundation), seat and session glue, the session scripts | On real DRM and seat hardware — in the virtual machine |
| Godot system layer | `godot/` | The greeter, the shell, the kit and the apps: GDScript and scenes on one pinned engine runtime (4.3.stable) | Headless and in a nested Wayland session — most of it never needs the VM |
| Distro plumbing | `distro/`, `system/` | The Debian 13 (trixie) base: package lists, .deb packaging, and an overlay that mirrors the installed filesystem path for path | By booting the installed image |

Foreign programs are not a fourth kind of work. A foreign app is a
surface the compositor hosts; its own source never lives here. Only
its bundle and registration — if it takes them — are recorded, under
the external-frameworks rules (`ext-fwks/`).

**The hosting rule.** A compositor feature may depend only on
surface-level facts — geometry, state, focus, stacking — never on
the native kit contract. That is what lets the same desktop host
Firefox, a Qt app, and a Godot app without knowing anything about
what is inside them.

## The tree

```
src/
  ARCHITECTURE.md           layers, the chain, the test tiers
  CONVENTIONS.md            the rules everything shipped here follows
  VM-RIG.md                 the Windows / VirtualBox test rig (living file)
  STAGE-2.md                the assembly-stage plan
  agent-build-log/          the build record, one file per work section
  foundation-overview.html  the overview as one readable page

  core/                     NCT-LIB-EXT-CORE — the foundation layer
    compositor/             the compositor (stand-in: labwc) and its config
    session/                greeter session, session start, the launch
                            list, the one launcher, command resolution
  godot/
    runtime/                the pinned engine: version, hash, recipe —
                            no binary in git
    extensions/             GDExtension native modules (planned)
    kit/                    the NCT Godot Kit: controls and style tokens
    greeter/                the greeter, a Godot project
    shell/                  the shell, a Godot project
    apps/                   our own apps, one Godot project each
  ext-fwks/                 NCT-LIB-EXT-FWKS — hosted frameworks
                            (Godot, Processing, openFrameworks, JUCE)
  ext-core-utils/           NCT-LIB-EXT-CORE-UTILS — leaf utilities
  services/                 session services that are not Godot:
                            the greeter auth bridge first
  keyclicks/                the key-click input policy, native port

  system/                   the installed-filesystem overlay — every path
                            here is the path on the installed machine
    etc/greetd/                   the display-manager configuration
    usr/share/wayland-sessions/   the session entry
    usr/lib/systemd/user/         the session's user units
  distro/
    debian/                 package lists and image configuration
    debs/                   the built packages (build output, not in git)
    reports/                build manifests and boot/chain logs
  tools/                    the development harness: packaging, rootfs
                            and image builders, the chain runners
  tests/
    headless/  vm/          the test beds — vm/ is the VM one:
                            TESTBED.md runbook, run-all.sh checks
                            00–09, ASSUMPTIONS.md
  vm/                       Vagrantfile, provisioning, host-side driver
```

## State of things (2026-11-25)

What has actually been run, and what each result establishes:

| Check | Result | What it establishes |
| --- | --- | --- |
| Chain, nested on the build host (`tools/run-chain.sh`) | 15/15 | Greeter → login → session → all three citizens open, against the window tree and screenshots |
| Greeter, human-shaped (`tools/run-greeter-ui-test.sh`) | 8/8 | The real greeter UI, keyboard only: wrong password rejected with no session, right password starts the session, Enter on the shell's Firefox button opens Firefox |
| Chain inside the assembled rootfs | tier 0: 12/12 | The installed system's own files execute correctly against its own libraries (tier 1 in-rootfs was blocked by the build sandbox's device restrictions, not by the system) |
| QEMU boot, multi-user | login prompt reached | The assembled distro boots: kernel, systemd, seatd, logind, ssh |
| QEMU boot, graphical | greetd starts; **greeter session exits** | greetd runs and opens the greeter's PAM session in a real boot — but the greeter session command then exits within \~1 s and greetd restarts until it hits its start limit. Registered as assumption **A13**; the open item below |
| VirtualBox / test bed (tier 2) | **not yet run** | Boot, greetd, seat and rendering on virtual GPU hardware — the rig's job |

Nothing here has been checked by anyone independent. The desktop
environment itself is still being designed in `demo-de/`; this tree
is the foundation under it, not the desktop.

## Work that needs to be done next

In order:

1. **Run the test bed on the VirtualBox rig** (`tests/vm/TESTBED.md`).
   First question is A13: on the rig's VMSVGA graphics, does the
   greeter session stay up (check 09), and if it exits there too,
   why — the greeter's own error output needs capturing on a real
   console, which the QEMU boot could not do. The same run settles
   A11 (Debian 13 downstream effects) and A12 (whether real pointer
   input reaches Godot windows — synthesized pointer input did not,
   in the nested tests).
2. **Work the fix loop the test bed defines**: read each failing
   check's log, fix in the repo (never only in the guest), update
   ASSUMPTIONS.md with the evidence, re-run.
3. **Known smaller debts**, recorded in the build log: the greeter
   session's logs live on a tmpfs at boot and are lost — they should
   land somewhere persistent; removing `nct-foundation` does not
   restore greetd's stock config (no dpkg-divert yet); the disk
   image needs a partition table and bootloader before it can boot
   without QEMU's direct-kernel path; the scripts' executable bits
   on GitHub await a mode-only commit from a real git client.
4. Only after the chain holds on the rig does further building make
   sense — and what that building is gets decided from the rig's
   results, in `demo-de/` first, where the desktop is designed.