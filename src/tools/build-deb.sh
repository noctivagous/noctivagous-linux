#!/bin/bash
# build-deb.sh — build the two Stage 2 .debs from src/ (STAGE-2.md S2.1):
#   nct-foundation    — /usr/lib/nct/{core,godot,services,tools,tests}
#                       + the system/ overlay at its real paths
#   nct-godot-runtime — the pinned engine at /usr/lib/nct/godot/godot
# Output: src/distro/debs/ (gitignored artefacts). Version: NCT_VERSION
# env or 0.1.0. The runtime build verifies the zip against PIN.md's sha256.
set -eu
SRC=$(cd "$(dirname "$0")/.." && pwd)
OUT="$SRC/distro/debs"; mkdir -p "$OUT"
VERSION=${NCT_VERSION:-0.1.0}
# Staging lives under NCT_BUILD_DIR, NOT /tmp: the runtime deb's
# staging (engine binary + zip + tar) overflows a small tmpfs
# (found 2026-11-25: 512 MB /tmp, dpkg-deb died with "No space left"
# mid-compression and left a stub .deb behind).
WORK=$(mktemp -d "${NCT_BUILD_DIR:-/var/nct-build}/deb-build.XXXXXX" 2>/dev/null || mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# ---------- nct-foundation ----------
PKG="$WORK/nct-foundation"
mkdir -p "$PKG/DEBIAN" "$PKG/usr/lib/nct"
for d in core godot services tools tests; do
  cp -r "$SRC/$d" "$PKG/usr/lib/nct/$d"
done
# strip build/test residue from the shipped tree
find "$PKG/usr/lib/nct" -name '.godot' -type d -prune -exec rm -rf {} + 2>/dev/null || true
rm -rf "$PKG/usr/lib/nct/tests/results-local" "$PKG/usr/lib/nct/tests/vm/results"
# the system overlay, at its real paths
cp -r "$SRC/system/etc" "$PKG/"
mkdir -p "$PKG/usr/share" "$PKG/usr/lib/systemd"
cp -r "$SRC/system/usr/share/wayland-sessions" "$PKG/usr/share/"
cp -r "$SRC/system/usr/lib/systemd/user" "$PKG/usr/lib/systemd/"
find "$PKG/usr/lib/nct" -name 'nct-*' -type f -exec chmod 755 {} +
find "$PKG/usr/lib/nct/tools" "$PKG/usr/lib/nct/tests" -name '*.sh' -exec chmod 755 {} +
# The control's "Replaces: greetd" is load-bearing: Debian's greetd
# package ships its own /etc/greetd/config.toml and this package ships
# ours at the same path; without Replaces, dpkg refuses the overwrite
# (found by the S2.2 rootfs install, 2026-11-25). Known cost: removing
# nct-foundation removes the config with it — greetd's stock file is
# not restored (no dpkg-divert at this stage).
cat > "$PKG/DEBIAN/control" <<EOF
Package: nct-foundation
Version: $VERSION
Architecture: all
Maintainer: Noctivagous <nct@localhost>
Depends: greetd, cage, labwc, sway, xwayland, foot, qterminal, firefox-esr, grim, wtype, python3
Replaces: greetd
Description: Noctivagous foundation — session chain, Godot greeter/shell/apps, auth bridge
 The foundation run of the NCT desktop: greeter, auth bridge, session
 scripts, launch list and launcher, Godot shell and proof apps, plus
 the installed-filesystem configuration (greetd, wayland-sessions).
EOF
chmod 755 "$PKG" "$PKG/DEBIAN"
dpkg-deb --build --root-owner-group "$PKG" "$OUT/nct-foundation_${VERSION}_all.deb"

# ---------- nct-godot-runtime ----------
URL=$(grep -o 'https://[^ ]*Godot[^ ]*\.zip' "$SRC/godot/runtime/PIN.md" | head -1)
SHA=$(grep -oE '[0-9a-f]{64}' "$SRC/godot/runtime/PIN.md" | head -1)
CACHE="${NCT_CACHE:-$HOME/.cache/nct-build}"; mkdir -p "$CACHE"
if [ ! -f "$CACHE/godot.zip" ]; then curl -sL -o "$CACHE/godot.zip" "$URL"; fi
echo "$SHA  $CACHE/godot.zip" | sha256sum -c -
PKG2="$WORK/nct-godot-runtime"
mkdir -p "$PKG2/DEBIAN" "$PKG2/usr/lib/nct/godot"
cd "$WORK" && unzip -o -q "$CACHE/godot.zip"
install -m755 "$WORK"/Godot_v*-stable_linux.x86_64 "$PKG2/usr/lib/nct/godot/godot"
cp "$SRC/godot/runtime/PIN.md" "$PKG2/usr/lib/nct/godot/PIN.md"
cat > "$PKG2/DEBIAN/control" <<EOF
Package: nct-godot-runtime
Version: $VERSION
Architecture: amd64
Maintainer: Noctivagous <nct@localhost>
Description: Noctivagous — the pinned Godot runtime
 One shared engine binary for every NCT Godot process (greeter, shell,
 apps), pinned in PIN.md. Apps ship as projects/.pck against it.
EOF
chmod 755 "$PKG2" "$PKG2/DEBIAN"
dpkg-deb --build --root-owner-group "$PKG2" "$OUT/nct-godot-runtime_${VERSION}_amd64.deb"
echo "built in $OUT:"; ls -la "$OUT"
