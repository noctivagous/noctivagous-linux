#!/bin/bash
# run-chain.sh — tiers 0+1: the foundation chain, proven locally.
#   tier 0: scripts parse, bridge fixture auth, Godot projects import + self-test
#   tier 1: nested headless sway — greeter --auto-login -> bridge -> session-apps
#           -> shell + Firefox + QTerminal (Qt) + NCT Hello all open as windows
# Results: tests/results-local/ (summary.txt, tier1-tree.json, tier1.png, logs)
# Overrides: NCT_GODOT, NCT_CMD_FIREFOX, NCT_RENDER_DRIVER (default opengl3 —
# software Vulkan is absent on most dev sandboxes; see VM-RIG.md).
set -u
SRC=$(cd "$(dirname "$0")/.." && pwd)
RES="$SRC/tests/results-local"; mkdir -p "$RES"
export NCT_SRC="$SRC"
export NCT_STATE_DIR="$RES/state"; mkdir -p "$NCT_STATE_DIR"
export NCT_RENDER_DRIVER=${NCT_RENDER_DRIVER:-opengl3}
export PATH="$SRC/core/session:$PATH"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS $1" | tee -a "$RES/summary.txt"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL $1 — $2" | tee -a "$RES/summary.txt"; }
: > "$RES/summary.txt"

# ---------- tier 0 ----------
for f in "$SRC"/core/session/nct-*; do
  sh -n "$f" 2>/dev/null && ok "t0 sh-parse $(basename "$f")" || bad "t0 sh-parse $(basename "$f")" "sh -n failed"
done
python3 -c "import ast; ast.parse(open('$SRC/services/bridge/nct-greetd-bridge.py').read())" \
  && ok "t0 bridge parses" || bad "t0 bridge parses" "python ast failed"
GODOT=${NCT_GODOT:-}
if [ -z "$GODOT" ]; then
  for c in /usr/lib/nct/godot/godot "$(command -v godot || true)" "$HOME/workspace/.nct-tools/godot"; do
    [ -n "$c" ] && [ -x "$c" ] && { GODOT=$c; break; }
  done
fi
export NCT_GODOT="$GODOT"
if [ -n "$GODOT" ]; then
  for p in godot/greeter godot/shell godot/apps/nct-hello; do
    "$GODOT" --headless --path "$SRC/$p" --quit-after 10 > "$RES/import-$(basename "$p").log" 2>&1 \
      && ok "t0 godot import $p" || bad "t0 godot import $p" "see import log"
  done
  out=$("$GODOT" --headless --path "$SRC/godot/shell" -- --self-test 2>&1)
  echo "$out" | grep -q "SHELL_SELFTEST_OK" && ok "t0 shell self-test" || bad "t0 shell self-test" "$out"
else
  bad "t0 godot present" "no godot runtime found (godot/runtime/PIN.md)"
fi
# bridge fixture auth, standalone
FIX="$RES/fixture-users.txt"; printf 'nct:nct-test-2026\n' > "$FIX"
NCT_AUTH_FIXTURE="$FIX" NCT_SESSION_CMD="true" python3 "$SRC/services/bridge/nct-greetd-bridge.py" > "$RES/bridge-t0.log" 2>&1 &
BPID=$!
sleep 1
auth=$(python3 - <<'PY'
import socket
s = socket.create_connection(("127.0.0.1", 7717), timeout=5)
f = s.makefile("rw")
f.write("PING\n"); f.flush(); print("ping:", f.readline().strip())
f.write("AUTH nct wrong\n"); f.flush(); print("wrong:", f.readline().strip())
f.write("AUTH nct nct-test-2026\n"); f.flush(); print("right:", f.readline().strip())
PY
)
kill $BPID 2>/dev/null
echo "$auth" > "$RES/bridge-t0.out"
echo "$auth" | grep -q "ping: PONG" && echo "$auth" | grep -q "wrong: FAIL" && echo "$auth" | grep -q "right: OK" \
  && ok "t0 bridge fixture auth (PING/wrong/right)" || bad "t0 bridge fixture auth" "$auth"

# ---------- tier 1 ----------
export XDG_RUNTIME_DIR="/tmp/nct-chain-$$"; mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
export WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman
printf 'output * resolution 1280x800\ndefault_border none\nexec echo ready > %s/sway-ready\n' "$RES" > "$RES/sway-chain.conf"
rm -f "$RES/sway-ready"
sway -c "$RES/sway-chain.conf" > "$RES/sway.log" 2>&1 &
SWAYPID=$!
for i in $(seq 1 50); do [ -f "$RES/sway-ready" ] && break; sleep 0.2; done
export SWAYSOCK=$(ls "$XDG_RUNTIME_DIR"/sway-ipc.*.sock 2>/dev/null | head -1)
export WAYLAND_DISPLAY=$(ls "$XDG_RUNTIME_DIR"/wayland-* 2>/dev/null | grep -v lock | head -1 | xargs -n1 basename)
export DISPLAY=:0
if [ -z "${NCT_CMD_FIREFOX:-}" ] && [ -x "$HOME/workspace/.nct-tools/firefox/firefox" ]; then
  # Fresh, pre-created profile dir: a missing/unwritable one makes Firefox
  # open a "Profile Missing" dialog instead of a browser window.
  rm -rf "$RES/ff-profile"; mkdir -p "$RES/ff-profile"
  export NCT_CMD_FIREFOX="$HOME/workspace/.nct-tools/firefox/firefox -profile $RES/ff-profile --new-window about:blank"
fi
# The bridge in fixture mode; START runs session-apps into THIS compositor.
# (The full greeter-session stage — cage/greetd — is tier-2 work: tests/vm/.)
NCT_AUTH_FIXTURE="$FIX" NCT_SESSION_CMD="$SRC/core/session/nct-session-apps" \
  NCT_EXTRA_AUTOSTART="firefox qt hello" \
  python3 "$SRC/services/bridge/nct-greetd-bridge.py" > "$RES/bridge-t1.log" 2>&1 &
GSESS=$!
sleep 1
# Drive the greeter with --auto-login: it auths against the bridge, the
# bridge starts the session apps, and the greeter quits.
"$SRC/core/session/nct-godot-run" "$SRC/godot/greeter" -- --auto-login nct nct-test-2026 \
  > "$RES/greeter-auto.log" 2>&1 &
GPID=$!
# Poll the window tree for all four citizens
found=""
for i in $(seq 1 60); do
  swaymsg -t get_tree > "$RES/tier1-tree.json" 2>/dev/null || true
  t=$(cat "$RES/tier1-tree.json" 2>/dev/null)
  echo "$t" | grep -qi "NCT Shell" && echo "$t" | grep -qi "qterminal" && \
  echo "$t" | grep -qi "NCT Hello" && echo "$t" | grep -qiE "firefox|Navigator|about:blank" && { found=1; break; }
  sleep 1
done
if [ -n "$found" ]; then ok "t1 chain: shell + firefox + qt + hello windows all present"; else
  t=$(cat "$RES/tier1-tree.json" 2>/dev/null)
  echo "$t" | grep -qi "NCT Shell"  || bad "t1 shell window" "not in tree"
  echo "$t" | grep -qi "qterminal"  || bad "t1 qt window" "not in tree"
  echo "$t" | grep -qi "NCT Hello"  || bad "t1 hello window" "not in tree"
  echo "$t" | grep -qiE "firefox|Navigator|about:blank" || bad "t1 firefox window" "not in tree"
fi
grep -q "GREETER_LOGIN_OK" "$RES/greeter-auto.log" && ok "t1 greeter auto-login via bridge" \
  || bad "t1 greeter auto-login" "see greeter-auto.log"
grim "$RES/tier1.png" 2>/dev/null && ok "t1 screenshot captured" || bad "t1 screenshot" "grim failed"
# cleanup
kill $GPID $GSESS $SWAYPID 2>/dev/null
pkill -f "nct-greetd-bridge" 2>/dev/null; pkill qterminal 2>/dev/null
sleep 1
echo "== run-chain: $PASS passed, $FAIL failed ==" | tee -a "$RES/summary.txt"
[ "$FAIL" = 0 ]
