#!/bin/bash
# build-image.sh [variant] — STAGE-2 S2.5 (stretch): turn a built
# rootfs into a bootable ext4 disk image + extracted kernel/initrd
# for a direct-kernel QEMU boot (tools/boot-image-qemu.sh).
#
# Method notes (this sandbox has no loop devices, so no partitioning
# or bootloader install is possible here): the image is a bare ext4
# filesystem made with mkfs.ext4 -d <dir> (populated from the tree,
# no mount), and QEMU boots the rootfs's own kernel with
# -kernel/-initrd/-append root=/dev/vda. A real installer image
# (partition table, GRUB/systemd-boot, ESP) is distro work beyond
# this stretch slice; what this proves is only "the assembled system
# boots to greetd under emulation", if it does.
#
# The image copy STRIPS the build-machine-only files that
# build-rootfs.sh mirrored in: the apt proxy config
# (etc/apt/apt.conf.d/99nct-build-proxy), the proxy alias lines in
# etc/hosts, and the copied host etc/resolv.conf. Those must never
# ship. It also writes a minimal /etc/fstab for /dev/vda.
set -eu
VARIANT=${1:-test}
BUILD=${NCT_BUILD_DIR:-/var/nct-build}
ROOTFS="$BUILD/rootfs-$VARIANT"
SRC=$(cd "$(dirname "$0")/.." && pwd)
OUT="$BUILD/image-$VARIANT"
[ -d "$ROOTFS/usr/lib/nct" ] || { echo "rootfs $ROOTFS not built — run tools/build-rootfs.sh $VARIANT first" >&2; exit 1; }
rm -rf "$OUT"; mkdir -p "$OUT"
WORK="$OUT/tree"
echo "== copy rootfs -> $WORK"
cp -a "$ROOTFS" "$WORK"
echo "== strip build-machine-only files"
rm -f "$WORK/etc/apt/apt.conf.d/99nct-build-proxy"
# debootstrap's minbase /etc/hosts can be nothing but the mirrored
# proxy lines (observed 2026-11-25) — filtering alone would ship an
# empty hosts file. Write the minimal sane one instead.
printf '127.0.0.1 localhost\n127.0.1.1 nct-%s\n::1 localhost ip6-localhost ip6-loopback\n' "$VARIANT" > "$WORK/etc/hosts"
rm -f "$WORK/etc/resolv.conf"
printf 'proc /proc proc defaults 0 0\n/dev/vda / ext4 defaults 0 1\n' > "$WORK/etc/fstab"
echo "== extract kernel + initrd"
cp "$WORK"/boot/vmlinuz-* "$OUT/vmlinuz"
cp "$WORK"/boot/initrd.img-* "$OUT/initrd.img"
echo "== mkfs.ext4 -d (size: rootfs + 512M headroom)"
SIZE=$(( $(du -sb "$WORK" | cut -f1) + 512*1024*1024 ))
truncate -s "$SIZE" "$OUT/nct-$VARIANT.img"
mkfs.ext4 -q -d "$WORK" -L "nct-$VARIANT" "$OUT/nct-$VARIANT.img"
rm -rf "$WORK"
ls -la "$OUT"
echo "== done: $OUT/nct-$VARIANT.img (+ vmlinuz, initrd.img)"
