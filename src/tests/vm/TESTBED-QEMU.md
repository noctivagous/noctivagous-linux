# TESTBED-QEMU — runbook for the QEMU-on-Windows rig

The second rig. Where the VirtualBox rig (TESTBED.md) tests a
*provisioned guest* — stock Debian plus our .debs — this rig boots the
**built distro image itself** (`tools/build-image.sh` output) under
QEMU for Windows. The image is the artifact that would eventually be
written to a USB stick, so this is the rig that proves the product
rather than the installation path.

The two rigs are complements: the graphics stacks differ on purpose
(virtio-gpu here, VirtualBox's vmwgfx there), and a failure that
appears on only one of them is information about that stack.

## What you need

- Windows 10/11 with QEMU for Windows installed
  (https://qemu.weilnetz.de/w64/ — put `qemu-system-x86_64.exe` on
  PATH or at `C:\Program Files\qemu\`).
- For acceleration: the **Windows Hypervisor Platform** feature on
  (Windows Features → Windows Hypervisor Platform), which lets QEMU
  use `-accel whpx`. Without it the script falls back to TCG
  emulation — correct, but slow.
- The three image files, copied into `src/vm/qemu-image/`:
  `nct-test.img`, `vmlinuz`, `initrd.img`. They are build outputs
  (whoever ran `tools/build-image.sh test` has them under the build
  dir's `image-test/`); they are not in git.
- For `-Checks` mode only: an SSH key in the guest (one-time setup,
  below). Interactive use needs nothing — log in in the QEMU window.

## Run it

```powershell
cd src\vm
.\vm-test-qemu.ps1              # boot; the greeter opens in a window
.\vm-test-qemu.ps1 -Reset       # throw away guest changes, boot pristine
.\vm-test-qemu.ps1 -Checks "03 09"   # headless boot + test-bed checks
.\vm-test-qemu.ps1 -Stop        # stop a VM left running by -Checks
```

The script boots a *copy* of the image (`nct-test-run.img`); the
pristine file is never written to. SSH is forwarded to host port
2222 (`ssh -p 2222 nct@localhost`, test password `nct-test-2026` —
VM-only by design, same as the other rig). The serial console goes
to `src/vm/qemu-image/qemu-serial.log` — the first place to look
when a boot misbehaves.

### One-time SSH key setup (for -Checks)

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\nct-qemu
.\vm-test-qemu.ps1                       # boot interactively
ssh -p 2222 nct@localhost "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys" `
  < $env:USERPROFILE\.ssh\nct-qemu.pub   # password: nct-test-2026
```

(After a `-Reset`, the guest copy of the key is gone with the rest of
the run image — redo the second step, or treat `-Checks` as a
fresh-image smoke run and use the VirtualBox rig for check depth.)

## The iteration loop

Same shape as the VirtualBox rig, different artifact:

1. Boot the image; read the serial log and, over SSH, the ladder
   evidence: the greeter's `/tmp/nct-greeter-state/cage.log` and the
   user's `~/.local/state/nct/session.log` (`ladder: attempt` lines),
   plus the remembered rung in `~/.local/state/nct/render-rung`
   (greeter: `/var/lib/nct-greeter/.local/state/nct/`).
2. For code fixes, don't rebuild the image per iteration: build the
   .debs wherever the tree is checked out, `scp -P 2222` them in, and
   `apt-get install --reinstall` — the provision.sh loop, by hand.
3. Rebuild the image only when the assembly itself changes
   (package list, rootfs, image layout) — or for a final clean proof.

### Known failure signature: the session command never runs

If greetd restarts until it hits its start limit and every greeter
session dies within ~1 s, check whether the session command ran at
all: if `/tmp/nct-greeter-state/` was never created, it didn't —
nct-greeter-session creates that directory first thing. The cause
found on 2026-11-25 was packaging, not graphics: the .debs had
inherited restrictive directory modes from the build tree (2770),
leaving `/usr/lib/nct` untraversable by the greeter user, so the
session command could not exec. build-deb.sh now normalizes modes
when packing; if this signature reappears, inspect the .deb's modes
(`dpkg-deb --fsys-tarfile … | tar -tv`) before suspecting the stack.

## What this rig settles

- The image boots end-to-end on a stack that is not VirtualBox:
  greetd → greeter (ladder on virtio-gpu) → login → user session.
- The ladder on a second DRM stack — with one expectation set
  correctly: standard Windows QEMU builds have no virglrenderer, so
  virtio-gpu here means clean 2D DRM plus software rendering in the
  guest. Expect the ladder to settle on a software rung; that still
  discriminates the DRM/dmabuf stack and the image chain, but it
  does NOT prove the ladder's native GPU rung. A14's proof stands
  on the VirtualBox rig, where the ladder walked rungs 0→3.
- A12 (real pointer) can be exercised in the QEMU window with the
  host mouse, the same manual check as the VirtualBox console.

## Rules

- Same as TESTBED.md: do not weaken a check to make it pass; fix in
  the repo, not only in the guest; the owner handles pushes.
- The pristine image in `qemu-image/` is an input, not a workspace —
  if it goes stale (fixes landed since it was built), say so and get
  it rebuilt rather than testing around it.
