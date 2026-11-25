# 14 — the QEMU rig variant, a packaging bug it caught, and the image boot smoke

2026-11-25, in Muse, on branch feat/qemu-rig (from main a1a6c8f, the
settled VirtualBox round). Directed by the user after that round: a
QEMU-on-Windows rig boots the *built image itself* — the artifact a
USB stick would carry — where the VirtualBox rig tests a provisioned
guest. Own worktree, own files; the VirtualBox rig's files untouched.

## What was built

- `vm/vm-test-qemu.ps1` — the Windows driver. WHPX acceleration
  (`whpx,kernel-irqchip=off`) with automatic TCG fallback;
  virtio-gpu-pci; direct-kernel boot naming graphical.target
  explicitly; the guest runs on a throwaway copy (`nct-test-run.img`)
  so the pristine image is never written; serial log to
  `vm/qemu-image/qemu-serial.log`; SSH hostfwd 2222; `-Reset`,
  `-Stop`, and `-Checks` (runs the test bed's run-all.sh in-guest
  over key SSH).
- `tests/vm/TESTBED-QEMU.md` — the runbook for the Muse Code
  instance on the Windows machine: prerequisites (QEMU for Windows,
  Windows Hypervisor Platform), the three image files copied into
  `vm/qemu-image/` (build outputs, never in git), the one-time SSH
  key setup, the iteration loop (evidence first; fixes in as .debs
  over SCP with --reinstall, not an image rebuild per iteration),
  and what this rig settles: the image chain on a non-VirtualBox
  stack, A14's landing rung on virtio-gpu, A12 via the QEMU window.
- `vm/.gitignore` — `qemu-image/` ignored.
- `tools/test-render-ladder.sh` — updated to the rig-proven ladder
  semantics from a1a6c8f (a nonzero exit is a failure whenever it
  happens; the window only labels the log line). 19/19.
  `core/session/nct-render-ladder.sh` header comment corrected to
  match; ASSUMPTIONS.md A14 status cell caught up to CONFIRMED.

## The bug the first smoke boot caught (packaging, not graphics)

The previous image in the build dir predated A13 and the ladder, so
the chain was rebuilt from current main (debs → rootfs → image) and
booted here under QEMU TCG (q35, std VGA/bochs, direct kernel,
graphical target). greetd looped: each greeter session died in ~1 s,
five restarts, start-limit-hit — the A13 shape. The serial log alone
looked quiet; the guest journal told the truth, and a serial-console
login into the still-running guest gave the decisive evidence:

- greetd's installed config was correct; cage was installed; the
  greeter's home was correctly owned (the A13 fix is in the image).
- `/tmp/nct-greeter-state/` was never created — nct-greeter-session
  creates it first thing, so the session command *never ran*.
- `ls /usr/lib/nct/core/session/` as an ordinary user: Permission
  denied.

Cause: `tools/build-deb.sh` assembled the packages with `cp -r` and
chmod'd only the script files, so the packages inherited the build
tree's directory modes. This sandbox's worktrees are mode 2770
(group-only), so the .deb shipped a `/usr/lib/nct` the greeter user
could not traverse — greetd's session command could not exec at all.
The VirtualBox rig never saw it: its checkout had ordinary modes.
The bug would have bitten anyone building the .debs from a
restrictive checkout, on any rig.

Fix (build-deb.sh, both packages): normalize every mode in the
staging tree — dirs 755, files 644, executables back to 755 — so a
package never depends on the build tree's umask. Verified in the
rebuilt .deb's tar listing. The failure signature is also recorded
in TESTBED-QEMU.md so the next instance checks package modes before
suspecting the graphics stack.

## The boot smoke, second attempt — PASS (scoped)

Same boot as above, image rebuilt with the fixed .debs. Evidence
taken live in the guest over the serial console, ~9 minutes of guest
uptime:

- `systemctl is-active greetd` → active; NRestarts = 0.
- `/tmp/nct-greeter-state/` exists (bridge.log, cage.log,
  godot-run.log) — the session chain ran.
- cage.log: ladder attempt rung 0. Cage's GLES2/EGL init failed on
  the bochs adapter (1234:1111, no driver) and cage fell back
  internally (Xwayland software path) without exiting, so the ladder
  held on its first attempt; no rung file is written until an
  attempt resolves, so none exists yet — expected, not a gap.
- Processes alive on tty7: cage, the nct-godot-run chain, and the
  Godot greeter (rendering on llvmpipe under TCG).
- A QEMU monitor screendump shows the NOCTIVAGOUS login form
  rendered (username focused, password, Log In) —
  `tests/vm/results/qemu-smoke-greeter.png` (local record).
  Cosmetic note: the form sits right of centre at 1280×800; compare
  on the Windows rig before treating it as a greeter layout bug.

Scope, stated plainly: this proves the built image boots to a held,
rendering greeter under QEMU TCG on the emulated bochs adapter, in
this sandbox. It does not prove WHPX performance, virtio-gpu
behaviour, or the login → user-session half of the chain on QEMU —
those are the Windows rig's first runs, from TESTBED-QEMU.md.

## Handoff state

The three image files from this build are the ones to copy to the
Windows machine (`nct-test.img`, `vmlinuz`, `initrd.img` from the
build dir's `image-test/`). The branch was pushed to main at the
user's word ("push it once the smoke passes", given in advance for
this push).
