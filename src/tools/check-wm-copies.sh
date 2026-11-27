#!/usr/bin/env bash
# check-wm-copies.sh — the drift check for the window manager's
# vendored copies in godot/shell: byte-identical to the source
# of truth in src/modules/nct-window-manager, or exit 1 naming
# the drifted files.
set -uo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
WM="$SRC/modules/nct-window-manager"
PROJ="$SRC/godot/shell"
drift=0
for f in window_manager.gd window_manager.gd.uid \
         window_record.gd window_record.gd.uid; do
  cmp -s "$WM/$f" "$PROJ/wm/$f" \
    || { echo "DRIFT godot/shell/wm/$f"; drift=1; }
done
for f in layer_stack.gd layer_stack.gd.uid; do
  cmp -s "$WM/nct-layer-stack/$f" "$PROJ/wm/nct-layer-stack/$f" \
    || { echo "DRIFT godot/shell/wm/nct-layer-stack/$f"; drift=1; }
done
[ "$drift" -eq 0 ] && echo "WM_COPIES_CLEAN hosts=1"
exit "$drift"
