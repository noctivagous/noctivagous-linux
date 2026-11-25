#!/bin/bash
# run-in-rootfs.sh [variant] — STAGE-2 S2.3: run the chain INSIDE the
# assembled rootfs, from the installed /usr/lib/nct copies. This
# proves the assembled system runs the chain — it does NOT prove the
# system boots: no seat, no greetd, no DRM. Booting is S2.5 (image/
# QEMU stretch) and the VM rig's tier 2.
#
# Method: systemd-nspawn is tried first. In the Muse sandbox nspawn
# cannot mount sysfs (the sandbox is itself a container without those
# privileges — observed 2026-11-25), so the script falls back to a
# plain chroot, which runs the same installed files with the same
# kernel. The log header records which method actually ran; claims
# must cite that, not the intention. On an unconfined host (or the
# rig), nspawn is expected to work as-is.
#
# Sandbox limit found 2026-11-25 (S2.3): tier 1 cannot run inside the
# rootfs HERE at all — wlroots needs /dev/urandom, and this sandbox
# denies every way of giving a chroot a real /dev (bind-mount denied,
# devtmpfs denied, mknod denied, nspawn sysfs denied). Tier 0 runs
# and passes in-rootfs; tier 1 in-system is a VM-rig matter (test bed
# checks 01/05), where /dev comes from devtmpfs+udev as in any boot.
# Log + the in-rootfs summary land in src/distro/reports/.
set -u
VARIANT=${1:-test}
BUILD=${NCT_BUILD_DIR:-/var/nct-build}
DIR="$BUILD/rootfs-$VARIANT"
SRC=$(cd "$(dirname "$0")/.." && pwd)
RES="$SRC/distro/reports"; mkdir -p "$RES"
[ -d "$DIR/usr/lib/nct/tools" ] || { echo "rootfs $DIR not built — run tools/build-rootfs.sh $VARIANT first" >&2; exit 1; }
LOG="$RES/nspawn-$VARIANT-run-chain.log"
echo "== trying systemd-nspawn $DIR -> /usr/lib/nct/tools/run-chain.sh (log: $LOG)"
{ echo "method: systemd-nspawn"; systemd-nspawn -D "$DIR" -M "nct-$VARIANT" \
  --setenv=NCT_RENDER_DRIVER=opengl3 \
  /usr/lib/nct/tools/run-chain.sh; } > "$LOG" 2>&1
rc=$?
if [ $rc -ne 0 ] && grep -q "run-chain:" "$LOG"; then
  : # the chain itself ran and reported; its exit code stands
elif [ $rc -ne 0 ]; then
  echo "== nspawn could not run here (see log head); falling back to chroot"
  head -3 "$LOG"
  mount -t proc proc "$DIR/proc" 2>/dev/null || true
  { echo "method: chroot (nspawn unavailable in this environment)"
    chroot "$DIR" /usr/bin/env -i PATH=/usr/lib/nct/core/session:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root NCT_RENDER_DRIVER=opengl3 /usr/lib/nct/tools/run-chain.sh
  } > "$LOG" 2>&1
  rc=$?
  umount "$DIR/proc" 2>/dev/null || true
fi
grep "== run-chain:" "$LOG" || tail -5 "$LOG"
cp "$DIR/usr/lib/nct/tests/results-local/summary.txt" "$RES/nspawn-$VARIANT-summary.txt" 2>/dev/null || true
echo "== in-rootfs run exit: $rc"
exit $rc
