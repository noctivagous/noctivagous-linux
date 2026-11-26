#!/bin/bash
# build-rootfs.sh <base|test> — assemble the Debian rootfs (STAGE-2 S2.2).
# Output: $NCT_BUILD_DIR/rootfs-<variant>/ (default /var/nct-build —
# the workspace volume refuses chown to non-owner gids, which tar
# extraction in debootstrap requires; the overlay root fs allows it)
# plus a manifest in src/distro/reports/. The test variant adds ONLY the
# VM-only test user (nct / nct-test-2026); base never carries it.
set -eu
VARIANT=${1:?usage: build-rootfs.sh <base|test>}
SRC=$(cd "$(dirname "$0")/.." && pwd)
BUILD=${NCT_BUILD_DIR:-/var/nct-build}
DIR="$BUILD/rootfs-$VARIANT"
DEBS="$SRC/distro/debs"
[ -f "$DEBS/nct-foundation_0.1.0_all.deb" ] || { echo "run tools/build-deb.sh first" >&2; exit 1; }
rm -rf "$DIR"; mkdir -p "$DIR"
echo "== debootstrap trixie minbase -> $DIR"
debootstrap --variant=minbase \
  --include=systemd,systemd-sysv,dbus,udev,ca-certificates,iproute2,psmisc \
  trixie "$DIR" http://deb.debian.org/debian
cp /etc/resolv.conf "$DIR/etc/resolv.conf" || true
# Build-machine networking: if the host reaches archives through a
# proxy configured for apt, mirror that into the chroot so its apt
# works too. This file is BUILD-ONLY — it must never ship in an image
# (build-image.sh strips it; see S2.5).
if [ -f /etc/apt/apt.conf.d/80hatch-egress-proxy ]; then
  { echo '// nct build-machine only: proxy so chroot apt can reach the archive. NOT part of the distro.'
    cat /etc/apt/apt.conf.d/80hatch-egress-proxy
  } > "$DIR/etc/apt/apt.conf.d/99nct-build-proxy"
  # The proxy's name resolves via the host's /etc/hosts (a gateway
  # alias), not DNS — mirror those lines too, marked the same way.
  { echo '# nct build-machine only: egress proxy alias. NOT part of the distro.'
    grep 'hatch-egress-proxy' /etc/hosts || true
  } >> "$DIR/etc/hosts"
  echo "note: build-machine apt proxy config mirrored into chroot"
fi
mount -t proc proc "$DIR/proc" 2>/dev/null || echo "note: no /proc mount (continuing)"
mount --bind /dev "$DIR/dev" 2>/dev/null || echo "note: no /dev bind (continuing)"
mount --bind /dev/pts "$DIR/dev/pts" 2>/dev/null || true
cleanup_mounts() { umount "$DIR/dev/pts" 2>/dev/null || true; umount "$DIR/dev" 2>/dev/null || true; umount "$DIR/proc" 2>/dev/null || true; }
trap cleanup_mounts EXIT
PKGS=$(grep -v '^#' "$SRC/distro/debian/package-list.txt" | grep -v '^$' | tr '\n' ' ')
echo "== chroot apt install: $PKGS linux-image-amd64"
chroot "$DIR" /usr/bin/env DEBIAN_FRONTEND=noninteractive apt-get update
chroot "$DIR" /usr/bin/env DEBIAN_FRONTEND=noninteractive apt-get install -y $PKGS linux-image-amd64
cp "$DEBS"/*.deb "$DIR/tmp/"
echo "== install the NCT debs"
chroot "$DIR" /usr/bin/env DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/nct-foundation_0.1.0_all.deb /tmp/nct-godot-runtime_0.1.0_amd64.deb
rm -f "$DIR"/tmp/*.deb
# The mirrored proxy alias was needed only for the chroot apt steps
# above. Replace /etc/hosts with the minimal sane file now so the
# rootfs itself carries no build-machine residue (debootstrap's
# minbase hosts can be empty apart from our appended lines — an
# image built by filtering alone would ship an empty hosts file).
printf '127.0.0.1 localhost\n127.0.1.1 nct-%s\n::1 localhost ip6-localhost ip6-loopback\n' "$VARIANT" > "$DIR/etc/hosts"
echo "== users and services"
chroot "$DIR" sh -c 'id greeter >/dev/null 2>&1 || useradd --system --home /var/lib/nct-greeter --shell /usr/sbin/nologin greeter; usermod -d /var/lib/nct-greeter greeter; mkdir -p /var/lib/nct-greeter; chown greeter: /var/lib/nct-greeter; usermod -aG video,input,render greeter || true'
if [ "$VARIANT" = test ]; then
  chroot "$DIR" sh -c 'id nct >/dev/null 2>&1 || useradd --create-home --shell /bin/bash nct; echo "nct:nct-test-2026" | chpasswd; usermod -aG video,input,render,sudo nct || true'
fi
chroot "$DIR" systemctl enable greetd.service || echo "note: greetd enable failed (check in S2.3)"
echo "nct-$VARIANT" > "$DIR/etc/hostname"
echo "== clean"
chroot "$DIR" apt-get clean || true
rm -rf "$DIR"/var/lib/apt/lists/* "$DIR"/tmp/* "$DIR"/var/tmp/*
cleanup_mounts; trap - EXIT
mkdir -p "$SRC/distro/reports"
{
  echo "rootfs variant: $VARIANT"
  echo "built: $(date -Is)"
  echo "size: $(du -sh "$DIR" | cut -f1) ($(du -sb "$DIR" | cut -f1) bytes)"
  echo "files: $(find "$DIR" | wc -l)"
  echo "packages: $(chroot "$DIR" dpkg-query -W 2>/dev/null | wc -l)"
  echo "kernel: $(ls "$DIR"/boot/vmlinuz-* 2>/dev/null | head -1)"
  echo "godot: $(chroot "$DIR" /usr/lib/nct/godot/godot --version 2>/dev/null || echo MISSING)"
  echo "greetd enabled: $(ls "$DIR"/etc/systemd/system/display-manager.service 2>/dev/null || echo check-manually)"
  echo "test user present: $(grep -c '^nct:' "$DIR/etc/passwd" || true)"
} | tee "$SRC/distro/reports/rootfs-$VARIANT-manifest.txt"
echo "== done: $DIR"
