#!/usr/bin/env bash
# check-shell-modules-copies.sh — the drift check for the
# shell's vendored GDScript modules: byte-identical to the
# source of truth in src/modules, or exit 1 naming the
# drifted files.
set -uo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
MOD="$SRC/modules"
PROJ="$SRC/godot/shell"
drift=0
for f in window_manager.gd window_manager.gd.uid \
         window_record.gd window_record.gd.uid; do
  cmp -s "$MOD/nct-window-manager/$f" "$PROJ/nct-window-manager/$f" \
    || { echo "DRIFT godot/shell/nct-window-manager/$f"; drift=1; }
done
for f in layer_stack.gd layer_stack.gd.uid; do
  cmp -s "$MOD/nct-window-manager/nct-layer-stack/$f" \
         "$PROJ/nct-window-manager/nct-layer-stack/$f" \
    || { echo "DRIFT godot/shell/nct-window-manager/nct-layer-stack/$f"; drift=1; }
done
for f in app_registry.gd app_registry.gd.uid; do
  cmp -s "$MOD/nct-app-registry/$f" "$PROJ/nct-app-registry/$f" \
    || { echo "DRIFT godot/shell/nct-app-registry/$f"; drift=1; }
done
[ "$drift" -eq 0 ] && echo "SHELL_MODULES_CLEAN hosts=1"
exit "$drift"
