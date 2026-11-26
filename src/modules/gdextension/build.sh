#!/bin/sh
# Build the NCTXML Grid native engine (GDExtension).
#
#   bash build.sh
#
# Needs: a C++ toolchain and scons (on PATH, or the sandbox
# venv at ~/workspace/.nct-tools/gdext-venv). godot-cpp is
# cloned (tag godot-4.5-stable — GDExtension libraries are
# forward-compatible, so it loads on the pinned 4.7 runtime)
# into ./godot-cpp on first run; that clone is deliberately
# NOT committed. The built library IS committed
# (src/modules/bin/), so a checkout can load the native
# engine without a C++ toolchain.
set -e
cd "$(dirname "$0")"

if [ ! -d godot-cpp ]; then
  git clone --depth 1 -b godot-4.5-stable \
    https://github.com/godotengine/godot-cpp.git godot-cpp
fi

SCONS="scons"
command -v scons >/dev/null 2>&1 || \
  SCONS="$HOME/workspace/.nct-tools/gdext-venv/bin/scons"

mkdir -p ../bin
"$SCONS" platform=linux target=template_release arch=x86_64 -j4
echo "built: src/modules/bin/libnctgrid.linux.x86_64.so"
