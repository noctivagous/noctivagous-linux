#!/usr/bin/env bash
# sync-shell-modules.sh — copy the GDScript modules the shipped
# shell hosts (the window manager + layer stack, the app
# registry) from their source of truth (src/modules/) into
# godot/shell, MIRRORING the modules layout, so the scripts'
# relative preload paths resolve unchanged (the app registry
# preloads ../nct-window-manager/window_record.gd). The same
# source-sync hosting as the NCTXML library (decision 1A);
# check-shell-modules-copies.sh is the drift check. (This
# supersedes sync-wm.sh, whose wm/ layout could not host a
# second module beside the first.)
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
MOD="$SRC/modules"
PROJ="$SRC/godot/shell"

mkdir -p "$PROJ/nct-window-manager/nct-layer-stack" \
         "$PROJ/nct-app-registry"
cp "$MOD/nct-window-manager/window_manager.gd" \
   "$MOD/nct-window-manager/window_manager.gd.uid" \
   "$MOD/nct-window-manager/window_record.gd" \
   "$MOD/nct-window-manager/window_record.gd.uid" \
   "$PROJ/nct-window-manager/"
cp "$MOD/nct-window-manager/nct-layer-stack/layer_stack.gd" \
   "$MOD/nct-window-manager/nct-layer-stack/layer_stack.gd.uid" \
   "$PROJ/nct-window-manager/nct-layer-stack/"
cp "$MOD/nct-app-registry/app_registry.gd" \
   "$MOD/nct-app-registry/app_registry.gd.uid" \
   "$PROJ/nct-app-registry/"
echo "synced shell modules -> godot/shell/{nct-window-manager,nct-app-registry}"
