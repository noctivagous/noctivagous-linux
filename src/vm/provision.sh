#!/bin/bash
# provision.sh — runs once inside the guest (as root) on `vagrant up`.
# TEST-ONLY CREDENTIALS: user nct / password nct-test-2026 exists only
# inside this disposable VM. Never reuse it anywhere else.
set -eux
SRC=/vagrant/src
export DEBIAN_FRONTEND=noninteractive
apt-get update
# The one package list, shared with the future image (distro/README.md):
# Windows checkouts carry CRLF, so strip CR: otherwise apt looks for
# "greetd\r" and every entry fails with "Unable to locate package".
tr -d '\r' < "$SRC/distro/debian/package-list.txt" | grep -v '^#' | grep -v '^$' | xargs apt-get install -y
# NCT itself arrives as the two Stage 2 .debs — the same artefacts the
# rootfs and the image install (STAGE-2.md S2.6) — built here from the
# synced src/ so the guest never runs a hand-copied tree. curl/unzip
# are build tools for that step only, not part of the distro set.
apt-get install -y curl unzip
bash "$SRC/tools/build-deb.sh"
# --reinstall: the version stays 0.1.0 across rig iterations, so a plain
# install would be a no-op and the fix under test would never land.
apt-get install --reinstall -y "$SRC"/distro/debs/nct-foundation_*_all.deb "$SRC"/distro/debs/nct-godot-runtime_*_amd64.deb
# Users: greeter (for greetd) and the test user.
# The greeter user needs its OWN writable home: /var/lib/greetd belongs
# to the Debian greetd package's _greetd user, and the Godot greeter
# segfaults when it cannot create its user-data dir under $HOME (A13).
id greeter >/dev/null 2>&1 || useradd --system --home /var/lib/nct-greeter --shell /usr/sbin/nologin greeter
usermod -d /var/lib/nct-greeter greeter
mkdir -p /var/lib/nct-greeter
chown greeter: /var/lib/nct-greeter
id nct >/dev/null 2>&1 || useradd --create-home --shell /bin/bash nct
echo 'nct:nct-test-2026' | chpasswd
usermod -aG video,input,render nct || true
usermod -aG video,input,render greeter || true
# greetd as the display manager (ASSUMPTION A2 — tests/vm check 02/03).
systemctl enable greetd.service || true
systemctl set-default graphical.target || true
echo "provision complete"
