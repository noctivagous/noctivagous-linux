# 11 — S2.5: bootable image + QEMU boot attempts (2026-11-25)

**Done:** tools/build-image.sh <variant> turns a rootfs into a bare
ext4 image (mkfs.ext4 -d; no loop devices exist here, so no
partition table/bootloader — QEMU boots the extracted kernel+initrd
directly against the image as root=/dev/vda). Build-machine-only
files are stripped (apt proxy config, copied resolv.conf). The
strip caught a real defect: debootstrap's minbase /etc/hosts held
*nothing but* our mirrored proxy lines, so filtering would have
shipped an empty hosts file — build-image.sh and build-rootfs.sh
now both write the minimal sane hosts file instead. Verified in the
finished image with debugfs.

tools/boot-image-qemu.sh boots the image under pure emulation
(no /dev/kvm here) with the serial console to
src/distro/reports/qemu-<variant>-boot.log. (The repo's root
.gitignore excludes *.log, so the serial logs stay on this machine;
the findings below are quoted from them and from the guest journal
in full, so nothing the rig needs lives only in those files.)

**Boot 1 (multi-user target): SUCCESS.** The assembled system
booted to "Debian GNU/Linux 13 nct-test ttyS0 — nct-test login:",
multi-user.target reached, seatd/logind/dbus/ssh up. The distro
boots; this is no longer inference from a chroot.

**Boot 2 (default graphical target): greetd starts, the greeter
session does not stay up.** Evidence extracted from the guest's own
journal (read out of the image with debugfs afterwards):
greetd.service starts, graphical.target is reached, greetd opens a
PAM session for user greeter, logind registers the session — then
"greeter exited without creating a session". greetd restarts, the
session command exits again within ~1 s, and after 5 attempts
greetd hits systemd's start limit and stops. So the failure is
inside the greeter session command (nct-greeter-session → cage →
greeter) under real boot conditions, and it is now the single
sharpest open item in the project. The greeter's own stderr did not
reach the journal, and its state dir lives on the guest's tmpfs
/tmp, so the boot itself kept no more evidence — on the rig,
check 03 + the new check 09 (file 12) own this, with a real
console to read. Working suspects, in order: cage failing to
acquire a seat/DRM backend on QEMU's bochs-drm; the greeter
process dying at start under cage. VirtualBox's VMSVGA stack is
different enough that the rig may simply not reproduce it.

**What this shows / does not show:** the chain now has boot-level
proof up to greetd, from declared inputs, in this sandbox. It does
not show a greeter on screen anywhere outside the nested tests,
and nobody independent has checked any of this.
