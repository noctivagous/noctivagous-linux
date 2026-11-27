#!/usr/bin/env bash
# sync-nctxml.sh — copy the NCTXML library from its source of truth
# (src/modules/nctxml) into the projects that host it (E1 hosting,
# decision 1A: source-sync, drift-checked). The greeter and shell
# are separate Godot projects; a Godot project can only use code
# inside its own folder, so the library is vendored into each host
# and check-nctxml-copies.sh (a tier-0 check) proves the copies
# never diverge.
#
# What travels: the library .cs files, the grid extension
# descriptor + the built Linux library (so Engine="native" behaves
# identically in every hosting), and the per-project
# extension_list.cfg the engine needs to discover the extension
# (generated state, written here, not committed).
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$SRC/modules/nctxml"

for host in greeter shell; do
  proj="$SRC/godot/$host"
  mkdir -p "$proj/nctxml" "$proj/bin" "$proj/.godot"
  cp "$LIB"/*.cs "$LIB"/*.cs.uid "$proj/nctxml/"
  cp "$SRC/modules/nctgrid.gdextension" "$proj/nctgrid.gdextension"
  cp "$SRC/modules/nctgrid.gdextension.uid" "$proj/nctgrid.gdextension.uid" 2>/dev/null || true
  cp "$SRC/modules/bin/libnctgrid.linux.x86_64.so" "$proj/bin/"
  printf 'res://nctgrid.gdextension\n' > "$proj/.godot/extension_list.cfg"
  echo "synced nctxml -> godot/$host"
done
