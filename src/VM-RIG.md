# VM-RIG — the Windows / VirtualBox test rig (LIVING FILE)

This file is the rig's memory. Update it in the same commit as any change
to the rig, the VM definition, or a rig result. Newest entries at the top
of the log. Owner's rig: a spare Windows machine with Muse Code
installed; Muse Code controls VirtualBox there and runs the test bed in
tests/vm/, fixing what the checks expose.

## The setup (as decided 2026-11-25)

| Piece | Choice | Why |
|---|---|---|
| Host | Windows, spare machine | The machine the owner has |
| Agent on host | Muse Code | Runs terminal commands, edits the clone, drives the VM |
| Hypervisor | VirtualBox 7.x | Best-supported on Windows for a Wayland guest; QEMU loses KVM on Windows |
| VM definition | vm/Vagrantfile (Vagrant + VirtualBox provider) | One text file = the whole VM; `vagrant up/ssh/snapshot` reproducible |
| Guest | Debian 13 (debian/trixie64 box) | Base changed 2026-11-25: bookworm has no labwc package (ASSUMPTIONS A11); firefox-esr without snap |
| Control spine | VBoxManage + SSH (NAT 2222→22) | VBoxManage is VirtualBox's full CLI; SSH is the agent's hands inside |
| Optional add-on | mcp-virtualbox MCP server (community, VirtualBox 7.x + Node 18+) | Screenshot/keyboard vision loop for the installer/first-boot phase where SSH doesn't exist yet. Vet before trusting; the rig must never depend on it |

## How Muse Code works the rig

1. `git pull` in the Windows clone of this repo.
2. `cd src/vm && vagrant up` (first run provisions via provision.sh).
3. Run the test bed: `vagrant ssh -c "sudo /opt/nct/src/tests/vm/run-all.sh"`
   or from the host: `src/vm/vm-test.sh` — or `src/vm/vm-test.ps1`
   on PowerShell — (does up + test + pulls artifacts).
4. Read `tests/vm/results/` (pulled to the host): one line per check,
   PASS/FAIL, plus logs and screenshots for the failures.
5. Fix in the repo (provision, scripts, configs — the guest is disposable),
   `vagrant destroy -f && vagrant up` for a clean re-prove, or
   `vagrant snapshot` around risky steps.
6. Update this file's log and tests/vm/ASSUMPTIONS.md statuses.

Rules for the agent on the rig:
- The guest is disposable; the repo is the truth. Never fix only in the guest.
- A check that fails is information, not an obstacle: read its log first.
- Do not judge graphics performance in VirtualBox. Software rendering
  (lavapipe/llvmpipe) or VMSVGA 3D is enough for "does it run / does the
  chain hold", meaningless for frame rates.

## Guest facts the provision must establish

- Packages: greetd, cage, labwc, sway (test compositor), foot, qterminal
  (the Qt proof app), firefox-esr (the foreign-browser proof), grim, wtype,
  mesa-vulkan-drivers (lavapipe software Vulkan for Godot), xwayland.
- Test user: `nct` with the password set in provision.sh (test-only,
  VM-only; the file says so at the top).
- /opt/nct/src is this repo's src/ (synced folder or clone inside the
  guest — provision.sh decides; see ASSUMPTION A6).
- greetd config: src/system/etc/greetd/config.toml, greeter session =
  nct-greeter-session, user session = nct-session.

## Known rig facts (verified here, Muse side, 2026-11-25)

- Godot 4.3.stable runs headless on Ubuntu 24.04 with no GPU.
- Godot 4.3 windowed under headless sway (WLR_BACKENDS=headless,
  pixman renderer): the **Vulkan driver fails** (VK_KHR_surface missing,
  no Vulkan ICD in that sandbox); **--rendering-driver opengl3 works**
  (llvmpipe) via XWayland, and the native --display-driver wayland also
  starts. Screenshot via grim shows the rendered window.
  → In the VM, expect to need mesa-vulkan-drivers (lavapipe) for Vulkan,
  or run Godot with opengl3. The test bed checks both (check 07).
- Firefox: the VM uses Debian's firefox-esr package. (Muse side used
  Mozilla's tarball build, Firefox 161, only as a local stand-in binary.)

## Log

- 2026-11-25 (rig) — **A13 CLOSED: 02+03+09 3/3 PASS.** The greeter session stays up (bento/debian-13, VMSVGA, host 7.2.22). Three stacked causes, all fixed in-repo: unwritable $HOME for the greeter user (Debian's _greetd owned /var/lib/greetd → Godot segfault; greeter now owns /var/lib/nct-greeter, also fixed in build-rootfs.sh so the QEMU image inherits it); vt=1 fought getty@tty1 (now vt=7); vmwgfx dmabuf import broken (host 3D defect, confirmed live on 7.2) so the greeter session is fully software (cage WLR_RENDERER=pixman; Godot x11 + opengl3 + LIBGL_ALWAYS_SOFTWARE=1). The cage stdout+stderr capture added to nct-greeter-session is what cracked it. Next: 04/05 will likely need the same software treatment for the user session (labwc + shell apps).
- 2026-11-25 (rig) — First bring-up findings. `debian/trixie64` ships
  libvirt only, so `vagrant up` on Windows/VirtualBox fails before
  creating the VM; Vagrantfile now uses `bento/debian-13` (still Debian
  13, A11 intact) with `box_architecture = "amd64"` pinned (`vagrant up`
  does not auto-resolve the arch; an explicit `vagrant box add
  --provider virtualbox --architecture amd64` succeeds). The Vagrantfile
  also syncs the repo root at `/vagrant`, which provision.sh, run-all.sh
  and vm-test.sh all assume (`/vagrant/src/...`); the default sync of the
  Vagrantfile's own directory breaks that. Windows checkouts share CRLF
  into the guest and every guest-run shell script breaks on it
  (`$'\r': command not found` in build-deb.sh); the tracked tree was
  normalized to LF in place (binary-safe pass, `git diff --name-only`
  shows only the three intended files) and provision.sh strips CR from
  package-list.txt defensively. Open hardening: `eol=lf` attributes so
  future Windows clones check out LF.
- 2026-11-25 (Stage 2, complete in Muse) — **The assembled system
  boots.** QEMU boots of the built image (agent-build-log/11):
  multi-user boot reached a login prompt; graphical boot started
  greetd and opened the greeter PAM session, but the greeter
  session command exits within ~1 s and greetd start-limits — that
  is now **ASSUMPTION A13** and test-bed **check 09**, the rig's
  first job alongside A11/A12. Serial logs and manifests are in
  src/distro/reports/.
- 2026-11-25 (Stage 2, in progress in Muse) — Three changes the rig
  inherits: (1) **Base is now Debian 13 (trixie)** — bookworm has no
  labwc package (A11); the Vagrant box is debian/trixie64.
  (2) **provision.sh installs the two Stage 2 .debs** (nct-foundation,
  nct-godot-runtime), built in the guest from the synced src/ by
  tools/build-deb.sh — no more manual Godot download or hand-copied
  tree. (3) A **human-shaped greeter proof** passed locally
  (tools/run-greeter-ui-test.sh, 8/8: typed wrong password rejected,
  typed right password starts the session, Enter on the shell's
  Firefox button opens Firefox — keyboard only; synthesized pointer
  input never reached Godot, which is now ASSUMPTION A12 for the rig
  to settle with a real pointer). **Rootfs assembly has since
  landed** (agent-build-log/09): base + test rootfs both build
  end-to-end (1.6 GB, 463 packages, kernel 6.12, greetd enabled, test
  user only in test); the foundation deb declares Replaces: greetd
  to take over /etc/greetd/config.toml. **Chain-in-rootfs**
  (agent-build-log/10): tier 0 passes 12/12 inside the rootfs;
  tier 1 could not run in the Muse sandbox at all (no way to give
  a chroot/nspawn a real /dev there — bind, devtmpfs, mknod and
  nspawn's sysfs are all denied), so tier-1-in-system is squarely
  the rig's checks 01/05. New rig homework from Stage 2: confirm
  A11 (trixie downstream effects) and A12 (real pointer), and the
  S2.5 QEMU result, whatever it turns out to be, becomes check 09.
- 2026-11-25 (later) — Foundation built and tiers 0–1 verified in Muse:
  tools/run-chain.sh reports **15 passed, 0 failed**. The tier-1
  screenshot (tests/results-local/tier1.png, regenerated per run) shows
  all four windows in the nested compositor: QTerminal (Qt), the NCT
  Shell bar (clock running, launch buttons), NCT Hello, and a real
  Firefox window on a New Tab page. Two findings from the runs, both
  fixed in the runner: (1) Godot's Vulkan driver fails where no Vulkan
  ICD exists — opengl3 is the runner default, lavapipe is the VM's
  expected answer (check 07); (2) Firefox opens a "Profile Missing"
  dialog unless its profile directory is created fresh beforehand —
  the runner now does that; the VM's firefox-esr uses the test user's
  real profile, and check 05 will show whether the same care is needed
  there. ASSUMPTION A5 (sway as labwc stand-in in tests) is confirmed
  locally. Everything else in ASSUMPTIONS.md is still open — that is
  the test bed's workload.
- 2026-11-25 — Rig designed; foundation run built in Muse (tiers 0–1
  verified locally). VM tier not yet run — the Windows box has not run
  Vagrant yet. First rig task for Muse Code: `vagrant up` and the
  tests/vm/ test bed, top to bottom.
