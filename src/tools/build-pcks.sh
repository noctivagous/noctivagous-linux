#!/bin/bash
# build-pcks.sh <dest-dir> — export every Godot project to a .pck
# (launch model 2, GODOT-SYSTEM.md §12: apps ship as packs against
# the one pinned runtime, never as standalone binaries).
#
# Layout under <dest-dir>, mirroring godot/:
#   greeter.pck  shell.pck  apps/nct-hello.pck
#
# Uses the pinned editor binary (NCT_GODOT, else the usual search
# path). --export-pack needs no export templates: it packs project
# data only, which is exactly the model — the runtime is separate.
set -eu
SRC=$(cd "$(dirname "$0")/.." && pwd)
DEST=${1:?usage: build-pcks.sh <dest-dir>}
mkdir -p "$DEST/apps"

GODOT=${NCT_GODOT:-}
if [ -z "$GODOT" ]; then
  for c in /usr/lib/nct/godot/godot "$(command -v godot || true)" "$HOME/workspace/.nct-tools/godot"; do
    if [ -n "$c" ] && [ -x "$c" ]; then GODOT=$c; break; fi
  done
fi
[ -n "$GODOT" ] || { echo "build-pcks: no godot runtime found (see godot/runtime/PIN.md)" >&2; exit 3; }

pack() { # <project-dir> <dest-pck>
  echo "pack $1 -> $2"
  "$GODOT" --headless --path "$SRC/$1" --export-pack "Linux" "$2" >/dev/null 2>&1 \
    || { echo "build-pcks: export-pack failed for $1" >&2; exit 1; }
  [ -s "$2" ] || { echo "build-pcks: empty pack for $1" >&2; exit 1; }
}

pack godot/greeter        "$DEST/greeter.pck"
pack godot/shell          "$DEST/shell.pck"
pack godot/apps/nct-hello "$DEST/apps/nct-hello.pck"
echo "built packs in $DEST:"; ls -la "$DEST" "$DEST/apps"
