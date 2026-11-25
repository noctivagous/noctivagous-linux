# 14 — QEMU re-proof (Windows host rig, 2026-11-25)

The S2.5 loop from agent-build-log/11 (greeter session exits in ~1 s,
greetd start-limits on the QEMU graphical boot) is gone on a rebuilt
image: 02+03+09 and 04+05 all PASS on the bochs-drm/virtio-gpu stack,
and the greeter was seen on screen in the QEMU window.

## What ran

- Host: Windows + MSYS2 QEMU 11.1.3 (ucrt64, WHPX acceleration works).
- Image: test variant rebuilt from the current tree (greeter home fix,
  vt=7, render ladder, nct-session -C all in), booted direct-kernel
  (`-kernel/-initrd`, root=/dev/vda) with virtio-gpu, serial to file.
- `vm-test-qemu.ps1` drives it: WHPX first, TCG fallback, pristine/run
  image split, SSH on host port 2222, `-Checks` runs the in-guest bed.

## Rig bugs found on the way (all fixed in-repo)

- The image ships no DHCP client, so the guest never got an address
  and the hostfwd had nothing behind it (SSH reset at key exchange
  while serial looked healthy). The kernel now brings the NIC up
  itself: `ip=dhcp` on both QEMU cmdlines (vm-test-qemu.ps1,
  tools/boot-image-qemu.sh). A real DHCP client / networkd config is
  still distro debt (A11).
- `localhost` resolves to ::1 first on Windows while QEMU forwards
  IPv4 only — every address in the driver and TESTBED-QEMU.md is now
  127.0.0.1.
- `Start-Process -ArgumentList` splits array items on spaces, so the
  `-append` kernel command line arrived fragmented and QEMU exited
  instantly. Values are quoted in the array now (with a comment).
- The SSH-wait loop hammered sshd during boot until MaxStartups
  shedding kicked in, then every handshake died — including good ones.
  The script now gates on the serial log reaching graphical.target
  and retries gently (10 s cadence).
- Windows PowerShell 5.1 cannot parse the driver without a BOM
  (em-dashes); the file is UTF-8 with BOM now. Committing the
  `src/** eol=lf` rule (still uncommitted) ends this class for good.
- Port hazard, noted for both rigs: the VirtualBox VM and QEMU both
  forward host port 2222. Only one rig runs at a time.

## Evidence

- Serial log: graphical.target reached, greetd started, login prompt.
- `run-all.sh 02 03 09` → 3/3 PASS; `04 05` → 2/2 PASS (identity
  verified: no `vagrant` user, hostname nct-test).
- Greeter observed live in the QEMU window before the checks ran.
