#!/bin/bash
# boot-image-qemu.sh [variant] [timeout-seconds] — STAGE-2 S2.5
# (stretch): boot the image from tools/build-image.sh under QEMU
# pure emulation (this sandbox has no /dev/kvm), serial console to a
# log, and look for evidence the boot reached greetd / a login
# prompt. Time-boxed by design: success is evidence, failure is a
# recorded finding for the VM test bed (new check 09), not a blocker.
# Requires: qemu-system-x86_64 on the host (apt-get install
# qemu-system-x86) — not installed in the Muse sandbox by default.
set -u
VARIANT=${1:-test}
TIMEOUT=${2:-240}
BUILD=${NCT_BUILD_DIR:-/var/nct-build}
IMG="$BUILD/image-$VARIANT"
SRC=$(cd "$(dirname "$0")/.." && pwd)
RES="$SRC/distro/reports"; mkdir -p "$RES"
LOG="$RES/qemu-$VARIANT-boot.log"
command -v qemu-system-x86_64 >/dev/null || { echo "qemu-system-x86_64 not installed (apt-get install qemu-system-x86)" >&2; exit 2; }
[ -f "$IMG/nct-$VARIANT.img" ] || { echo "image not built — run tools/build-image.sh $VARIANT first" >&2; exit 1; }
echo "== qemu boot (emulation, ${TIMEOUT}s time box) -> $LOG"
timeout "$TIMEOUT" qemu-system-x86_64 \
  -m 2048 -smp 2 -machine q35 -display none -serial "file:$LOG" -monitor none \
  -kernel "$IMG/vmlinuz" -initrd "$IMG/initrd.img" \
  -append "root=/dev/vda rw console=ttyS0 systemd.unit=multi-user.target ip=dhcp" \
  -drive "file=$IMG/nct-$VARIANT.img,format=raw,if=virtio" \
  -netdev user,id=n0 -device virtio-net-pci,netdev=n0 || true
echo "== boot log tail:"
tail -20 "$LOG" 2>/dev/null || true
if grep -qiE "greetd|login:" "$LOG"; then
  echo "RESULT: boot reached greetd/login evidence (see $LOG)"
else
  echo "RESULT: no greetd/login evidence in ${TIMEOUT}s — recorded as a finding for the VM test bed (check 09)"
fi
