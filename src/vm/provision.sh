#!/bin/bash
# provision.sh — runs once inside the guest (as root) on `vagrant up`.
# TEST-ONLY CREDENTIALS: user nct / password nct-test-2026 exists only
# inside this disposable VM. Never reuse it anywhere else.
set -eux
SRC=/vagrant/src
export DEBIAN_FRONTEND=noninteractive
apt-get update
# The one package list, shared with the future image (distro/README.md):
grep -v '^#' "$SRC/distro/debian/package-list.txt" | grep -v '^$' | xargs apt-get install -y
# NCT itself arrives as the two Stage 2 .debs — the same artefacts the
# rootfs and the image install (STAGE-2.md S2.6) — built here from the
# synced src/ so the guest never runs a hand-copied tree. curl/unzip
# are build tools for that step only, not part of the distro set.
apt-get install -y curl unzip
bash "$SRC/tools/build-deb.sh"
apt-get install -y "$SRC"/distro/debs/nct-foundation_*_all.deb "$SRC"/distro/debs/nct-godot-runtime_*_amd64.deb
# Users: greeter (for greetd) and the test user.
id greeter >/dev/null 2>&1 || useradd --system --home /var/lib/greetd --shell /usr/sbin/nologin greeter
mkdir -p /var/lib/greetd
id nct >/dev/null 2>&1 || useradd --create-home --shell /bin/bash nct
echo 'nct:nct-test-2026' | chpasswd
usermod -aG video,input,render nct || true
usermod -aG video,input,render greeter || true
# greetd as the display manager (ASSUMPTION A2 — tests/vm check 02/03).
systemctl enable greetd.service || true
systemctl set-default graphical.target || true
echo "provision complete"
