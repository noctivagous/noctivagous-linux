#!/usr/bin/env bash
# sync-wm.sh — copy the window manager + layer stack from their
# source of truth (src/modules/nct-window-manager) into the
# project that hosts them in the shipped session: godot/shell
# (the same source-sync hosting as the NCTXML library, decision
# 1A; check-wm-copies.sh is the drift check). The relative
# layout is preserved (wm/ + wm/nct-layer-stack/) so the
# scripts' preload paths resolve unchanged.
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
WM="$SRC/modules/nct-window-manager"
PROJ="$SRC/godot/shell"

mkdir -p "$PROJ/wm/nct-layer-stack"
cp "$WM/window_manager.gd" "$WM/window_manager.gd.uid" "$PROJ/wm/"
cp "$WM/window_record.gd" "$WM/window_record.gd.uid" "$PROJ/wm/"
cp "$WM/nct-layer-stack/layer_stack.gd" \
   "$WM/nct-layer-stack/layer_stack.gd.uid" "$PROJ/wm/nct-layer-stack/"
echo "synced window manager -> godot/shell/wm"
