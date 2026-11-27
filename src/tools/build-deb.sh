#!/bin/bash
# build-deb.sh — build the two Stage 2 .debs from src/ (STAGE-2.md S2.1):
#   nct-foundation    — /usr/lib/nct/{core,godot,services,tools,tests}
#                       + the system/ overlay at its real paths
#   nct-godot-runtime — the pinned engine at /usr/lib/nct/godot/godot,
#                       plus the pinned .NET runtime beside it
#                       (/usr/lib/nct/godot/dotnet, PIN.md)
# Output: src/distro/debs/ (gitignored artefacts). Version: NCT_VERSION
# env or 0.1.0. The runtime build verifies both artefacts against
# PIN.md's sha256 values.
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

# The pinned Godot binary, fetched once: it is both the packing tool
# (below) and the nct-godot-runtime package's payload (further down).
URL=$(grep -o 'https://[^ ]*Godot[^ ]*\.zip' "$SRC/godot/runtime/PIN.md" | head -1)
SHA=$(grep -oE '[0-9a-f]{64}' "$SRC/godot/runtime/PIN.md" | head -1)
CACHE="${NCT_CACHE:-$HOME/.cache/nct-build}"; mkdir -p "$CACHE"
# The cache is keyed by artefact name, not a fixed godot.zip: a pin
# bump must never be silently served the previous pin's zip from
# cache (the sha check would catch it, but as a confusing failure
# far from its cause).
ZIP="$CACHE/$(basename "$URL")"
if [ ! -f "$ZIP" ]; then curl -sL -o "$ZIP" "$URL"; fi
echo "$SHA  $ZIP" | sha256sum -c -
mkdir -p "$WORK/godot-bin"
(cd "$WORK/godot-bin" && unzip -o -q "$ZIP")
# The standard edition unpacks to a single binary file; the .NET
# (mono) edition — the current pin — unpacks to a DIRECTORY holding
# the binary plus GodotSharp/. Resolve the binary either way.
PACK_GODOT=$(find "$WORK/godot-bin" -type f -name 'Godot_v*' | head -1)

# The pinned .NET runtime, fetched the same way (PIN.md's .NET
# section): the mono zip ships no hostfxr, and without one every
# C# project crashes before it draws (agent-build-log/31). The
# runtime deb bundles it beside the engine binary. Only
# Microsoft.NETCore.App is staged; the tarball's AspNetCore
# shared framework is not shipped.
DURL=$(grep -o 'https://[^ ]*dotnet-runtime[^ ]*\.tar\.gz' "$SRC/godot/runtime/PIN.md" | head -1)
DSHA=$(awk '/^## The .NET runtime/,0' "$SRC/godot/runtime/PIN.md" | grep -oE '[0-9a-f]{64}' | head -1)
DTAR="$CACHE/$(basename "$DURL")"
if [ ! -f "$DTAR" ]; then curl -sL -o "$DTAR" "$DURL"; fi
echo "$DSHA  $DTAR" | sha256sum -c -
mkdir -p "$WORK/dotnet-runtime"
# --no-same-owner: the tarball's files carry the .NET build's
# uid, which tar cannot always chown to (restricted build
# sandboxes); the deb's mode normalization below settles the
# final ownership/modes anyway (dpkg-deb --root-owner-group).
tar --no-same-owner -xzf "$DTAR" -C "$WORK/dotnet-runtime"

# ---------- nct-foundation ----------
PKG="$WORK/nct-foundation"
mkdir -p "$PKG/DEBIAN" "$PKG/usr/lib/nct"
for d in core godot services tools tests; do
  cp -r "$SRC/$d" "$PKG/usr/lib/nct/$d"
done
# strip build/test residue from the shipped tree
find "$PKG/usr/lib/nct" -name '.godot' -type d -prune -exec rm -rf {} + 2>/dev/null || true
rm -rf "$PKG/usr/lib/nct/tests/results-local" "$PKG/usr/lib/nct/tests/vm/results"
# Launch model 2 (§12): the installed system ships Godot apps as
# .pck packs against the shared runtime, not as loose project dirs.
# Export the packs from the source projects, then swap them in.
NCT_GODOT="$PACK_GODOT" bash "$SRC/tools/build-pcks.sh" "$WORK/pcks" > "$WORK/pcks.log" 2>&1 \
  || { cat "$WORK/pcks.log" >&2; echo "build-deb: build-pcks failed" >&2; exit 1; }
rm -rf "$PKG/usr/lib/nct/godot/greeter" "$PKG/usr/lib/nct/godot/shell" \
       "$PKG/usr/lib/nct/godot/apps/nct-hello"
cp "$WORK/pcks/greeter.pck" "$PKG/usr/lib/nct/godot/greeter.pck"
cp "$WORK/pcks/shell.pck" "$PKG/usr/lib/nct/godot/shell.pck"
cp "$WORK/pcks/apps/nct-hello.pck" "$PKG/usr/lib/nct/godot/apps/nct-hello.pck"
# The WindowTransformer bridge (log 36) is the shipped tree's one
# compiled C artifact: wayland-scanner + cc against the vendored
# protocol XML beside its source. Build machines need
# libwayland-dev and the scanner (libwayland-bin) — the same class
# of build-time requirement as the .NET SDK the .pck step needs.
wayland-scanner client-header "$SRC/services/bridge/wlr-foreign-toplevel-management-unstable-v1.xml" "$WORK/wlr-foreign-toplevel.h"
wayland-scanner private-code "$SRC/services/bridge/wlr-foreign-toplevel-management-unstable-v1.xml" "$WORK/wlr-foreign-toplevel.c"
cc -O2 -I"$WORK" -o "$PKG/usr/lib/nct/services/bridge/nct-wl-bridge" \
  "$SRC/services/bridge/nct-wl-bridge.c" "$WORK/wlr-foreign-toplevel.c" \
  -lwayland-client
# the system overlay, at its real paths
cp -r "$SRC/system/etc" "$PKG/"
mkdir -p "$PKG/usr/share" "$PKG/usr/lib/systemd"
cp -r "$SRC/system/usr/share/wayland-sessions" "$PKG/usr/share/"
cp -r "$SRC/system/usr/lib/systemd/user" "$PKG/usr/lib/systemd/"
# Normalize ALL modes in the staging tree. cp -r inherits the build
# tree's modes, and a checkout can carry restrictive ones: this
# sandbox's worktrees are mode 2770 dirs / 0660 files, and the .deb
# built from them shipped a /usr/lib/nct the greeter user could not
# even traverse — greetd's session command failed to exec, the
# greeter exited within ~1 s, and greetd start-limited (found by the
# QEMU image boot smoke, 2026-11-25; the VirtualBox rig never saw it
# because its checkout had ordinary modes). A package must not depend
# on the build tree's umask: dirs 755, files 644, executables back
# to 755.
find "$PKG" -type d -exec chmod 755 {} +
find "$PKG" -type f -exec chmod 644 {} +
find "$PKG/usr/lib/nct" -name 'nct-*' -type f -exec chmod 755 {} +
find "$PKG/usr/lib/nct/tools" "$PKG/usr/lib/nct/tests" -name '*.sh' -type f -exec chmod 755 {} +
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
# (URL/SHA/CACHE and the verified zip are set up at the top of this
# script; the binary was already extracted to $WORK/godot-bin.)
PKG2="$WORK/nct-godot-runtime"
mkdir -p "$PKG2/DEBIAN" "$PKG2/usr/lib/nct/godot"
install -m755 "$PACK_GODOT" "$PKG2/usr/lib/nct/godot/godot"
# The .NET edition must ship GodotSharp beside the binary, or C#
# projects cannot resolve the Godot API assemblies (PIN.md). The
# standard edition has no GodotSharp directory; the test is the
# merge point between the two zip shapes.
if [ -d "$(dirname "$PACK_GODOT")/GodotSharp" ]; then
  cp -r "$(dirname "$PACK_GODOT")/GodotSharp" "$PKG2/usr/lib/nct/godot/GodotSharp"
fi
# The bundled .NET runtime (see the fetch at the top): muxer,
# host/fxr and the NETCore.App shared framework, beside the
# binary where nct-godot-run looks for it.
mkdir -p "$PKG2/usr/lib/nct/godot/dotnet/shared"
cp "$WORK/dotnet-runtime/dotnet" "$PKG2/usr/lib/nct/godot/dotnet/dotnet"
cp -r "$WORK/dotnet-runtime/host" "$PKG2/usr/lib/nct/godot/dotnet/host"
cp -r "$WORK/dotnet-runtime/shared/Microsoft.NETCore.App" "$PKG2/usr/lib/nct/godot/dotnet/shared/"
cp "$WORK/dotnet-runtime/LICENSE.txt" "$WORK/dotnet-runtime/ThirdPartyNotices.txt" "$PKG2/usr/lib/nct/godot/dotnet/"
cp "$SRC/godot/runtime/PIN.md" "$PKG2/usr/lib/nct/godot/PIN.md"
# Same mode normalization as the foundation package (see above).
find "$PKG2" -type d -exec chmod 755 {} +
find "$PKG2" -type f -exec chmod 644 {} +
chmod 755 "$PKG2/usr/lib/nct/godot/godot" "$PKG2/usr/lib/nct/godot/dotnet/dotnet"
# Fail the build rather than ship a runtime that cannot start:
# the muxer must be executable and hostfxr must be staged
# (the absence of exactly this went unnoticed until a tier-2
# rig run, agent-build-log/31).
[ -x "$PKG2/usr/lib/nct/godot/dotnet/dotnet" ] || { echo "build-deb: staged dotnet muxer missing/not executable" >&2; exit 1; }
find "$PKG2/usr/lib/nct/godot/dotnet" -name 'libhostfxr.so' | grep -q . || { echo "build-deb: staged .NET runtime lacks libhostfxr.so" >&2; exit 1; }
find "$PKG2/usr/lib/nct/godot/dotnet/shared/Microsoft.NETCore.App" -name 'libcoreclr.so' | grep -q . || { echo "build-deb: staged .NET runtime lacks libcoreclr.so" >&2; exit 1; }
cat > "$PKG2/DEBIAN/control" <<EOF
Package: nct-godot-runtime
Version: $VERSION
Architecture: amd64
Maintainer: Noctivagous <nct@localhost>
Description: Noctivagous — the pinned Godot runtime
 One shared engine binary for every NCT Godot process (greeter, shell,
 apps), pinned in PIN.md, with the pinned .NET runtime bundled beside
 it (the mono engine ships none). Apps ship as .pck packs against it.
EOF
chmod 755 "$PKG2" "$PKG2/DEBIAN"
dpkg-deb --build --root-owner-group "$PKG2" "$OUT/nct-godot-runtime_${VERSION}_amd64.deb"
echo "built in $OUT:"; ls -la "$OUT"
