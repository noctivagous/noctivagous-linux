#!/bin/bash
# build.sh — build the NCT boot-splash proof prototype.
#
# Builds pinned ThorVG v1.1.4 from source as a static library
# (same pin and meson options as the NCT labwc fork's
# build-labwc-nct.sh, with ONE addition: the `ttf` loader,
# which the fork does not need — it renders no text — but the
# boot splash needs for category labels), installs it into a
# local prefix inside this directory, then compiles
# nct-bootsplash.c against the static library.
#
# Usage: ./build.sh
# Deps (Debian): meson ninja-build git gcc g++ pkg-config
# zlib1g-dev (PNG encoder uses zlib for DEFLATE + CRC32).
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
THORVG_VERSION=1.1.4
SRC="$HERE/thorvg-$THORVG_VERSION"
PREFIX="$HERE/thorvg-install"

# --- ThorVG (pinned, static, C API, CPU engine, SVG + TTF) ---
if [ ! -f "$PREFIX/lib/libthorvg-1.a" ]; then
  if [ ! -d "$SRC" ]; then
    git clone --depth 1 --branch "v$THORVG_VERSION" \
      https://github.com/thorvg/thorvg.git "$SRC"
  fi
  cd "$SRC"
  rm -rf build-tvg
  meson setup build-tvg --buildtype=release --prefix="$PREFIX" \
    -Dlibdir=lib \
    -Ddefault_library=static -Dstatic=true \
    -Dengines=cpu -Dloaders=svg,ttf -Dsavers= -Dtools= \
    -Dbindings=capi -Dthreads=false -Dtests=false
  ninja -C build-tvg
  ninja -C build-tvg install
fi

# --- nct-bootsplash ---
cd "$HERE"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
gcc -O2 -Wall -Wextra -std=c11 \
  $(pkg-config --cflags thorvg-1) \
  nct-bootsplash.c -o nct-bootsplash \
  "$PREFIX/lib/libthorvg-1.a" -lstdc++ -lm -lz
echo "built: $HERE/nct-bootsplash"
