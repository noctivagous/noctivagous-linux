#!/usr/bin/env bash
# check-nctxml-copies.sh — the E1 drift check: every vendored copy
# of the NCTXML library must be byte-identical to the source of
# truth in src/modules. Exit 1 naming the drifted files.
set -uo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
LIB="$SRC/modules/nctxml"
drift=0
for host in greeter shell; do
  proj="$SRC/godot/$host"
  for f in "$LIB"/*.cs "$LIB"/*.cs.uid; do
    base="$(basename "$f")"
    if ! cmp -s "$f" "$proj/nctxml/$base"; then
      echo "DRIFT godot/$host/nctxml/$base"; drift=1
    fi
  done
  cmp -s "$SRC/modules/nctgrid.gdextension" "$proj/nctgrid.gdextension" \
    || { echo "DRIFT godot/$host/nctgrid.gdextension"; drift=1; }
  cmp -s "$SRC/modules/bin/libnctgrid.linux.x86_64.so" \
         "$proj/bin/libnctgrid.linux.x86_64.so" \
    || { echo "DRIFT godot/$host/bin/libnctgrid.linux.x86_64.so"; drift=1; }
done
[ "$drift" -eq 0 ] && echo "NCTXML_COPIES_CLEAN hosts=2"
exit "$drift"
