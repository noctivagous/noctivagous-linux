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
# A checkout on a VirtualBox shared folder cannot run this chain:
# while one process executes a script from the share, a second
# concurrent exec of the same file is refused ("Permission denied")
# by the host-side lock — and session-apps launches the shell and
# NCT Hello through the same nct-godot-run a second apart, so the
# later launch dies before Godot even starts. Stage a local copy
# and re-exec from it; results are copied back so callers find
# them in the usual place.
if [ -z "${NCT_CHAIN_STAGED:-}" ] && [ "$(stat -f -c %T "$SRC" 2>/dev/null)" = "vboxsf" ]; then
  stage=$(mktemp -d /tmp/nct-chain-stage.XXXXXX)
  mkdir -p "$stage/src"
  tar -C "$SRC" --exclude='./vm/qemu-image' --exclude='./tests/results-local' --exclude='*/.godot' -cf - . | tar -C "$stage/src" -xf -
  NCT_CHAIN_STAGED=1 "$stage/src/tools/run-chain.sh" "$@"; code=$?
  mkdir -p "$RES"
  cp -a "$stage/src/tests/results-local/." "$RES/" 2>/dev/null || true
  rm -rf "$stage"
  exit "$code"
fi
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
  echo "$out" | grep -q "SHELL_WM_OK" && ok "t0 shell wm hosted" || bad "t0 shell wm hosted" "$out"
  # Modules Slice 1: window + layer manager skeleton, fake windows of
  # every style, conversion + freeze measured from the scene tree.
  out=$("$GODOT" --headless --path "$SRC/modules" -- --self-test 2>&1)
  echo "$out" | grep -q "SLICE1_SELFTEST_OK" && ok "t0 modules slice1 self-test" || bad "t0 modules slice1 self-test" "$out"
  # Modules Slice 2: the NCTXML interpreter (C#). The assembly must
  # be built before Godot runs — a .NET SDK on the build machine is
  # required (agent-build-log/17, finding 2).
  DOTNET="${DOTNET:-dotnet}"
  if command -v "$DOTNET" > /dev/null 2>&1 && "$DOTNET" build -v q -nologo "$SRC/modules" > "$RES/nctxml-build.log" 2>&1; then
    ok "t0 nctxml assembly build"
    out=$("$GODOT" --headless --path "$SRC/modules" res://nctxml/harness/main.tscn -- --self-test 2>&1)
    echo "$out" | grep -q "NCTXML_SELFTEST_OK" && ok "t0 nctxml slice2 self-test" || bad "t0 nctxml slice2 self-test" "$out"
  else
    bad "t0 nctxml assembly build" "dotnet SDK missing or build failed — see nctxml-build.log"
  fi
  # System-interface Slice A: the sys-interface bridge against its
  # fixture feed, then the Services/Logs views rendered from the
  # bridge's snapshot by the NCTXML interpreter.
  out=$(python3 "$SRC/modules/nct-linux-sys-interface/test_sys_interface.py" 2>&1)
  echo "$out" | grep -q "SLICEA_OK" && ok "t0 sys-interface sliceA bridge" || bad "t0 sys-interface sliceA bridge" "$out"
  if python3 "$SRC/modules/nct-linux-sys-interface/sys_interface.py" --fixture "$SRC/modules/nct-linux-sys-interface/fixtures/systemd-journal.jsonl" --snapshot-out "$RES/sys-tree.json" > /dev/null 2>&1; then
    out=$("$GODOT" --headless --path "$SRC/modules" res://nct-linux-sys-interface/harness/main.tscn -- --snapshot "$RES/sys-tree.json" 2>&1)
    echo "$out" | grep -q "SLICEA_VIEWS_OK" && ok "t0 sys-interface sliceA views" || bad "t0 sys-interface sliceA views" "$out"
  else
    bad "t0 sys-interface sliceA views" "snapshot generation failed"
  fi
  # System-interface Slice B: system-watch triage on the Slice A
  # bridge (failed units + coredumps -> standing Issues).
  out=$(python3 "$SRC/modules/nct-system-watch/test_system_watch.py" 2>&1)
  echo "$out" | grep -q "SLICEB_OK" && ok "t0 system-watch sliceB triage" || bad "t0 system-watch sliceB triage" "$out"
  # System-interface Slice C: device-centre logic (Secure Boot
  # four-state, DKMS pre-flight, power naming) + its NCTXML view.
  out=$(python3 "$SRC/modules/nct-device-centre/test_device_centre.py" 2>&1)
  echo "$out" | grep -q "SLICEC_OK" && ok "t0 device-centre sliceC logic" || bad "t0 device-centre sliceC logic" "$out"
  if python3 "$SRC/modules/nct-device-centre/device_centre.py" --fixture "$SRC/modules/nct-device-centre/fixtures/devices.json" --contexts-out "$RES/device-contexts.json" > /dev/null 2>&1; then
    out=$("$GODOT" --headless --path "$SRC/modules" res://nct-device-centre/harness/main.tscn -- --contexts "$RES/device-contexts.json" 2>&1)
    echo "$out" | grep -q "SLICEC_VIEW_OK" && ok "t0 device-centre sliceC view" || bad "t0 device-centre sliceC view" "$out"
  else
    bad "t0 device-centre sliceC view" "context generation failed"
  fi
  # System-interface Slice D: recovery TUI (menu model + pty
  # smoke) and boot-entry consistency. Booting into recovery is
  # a tier-2 rig proof, not claimed here (agent-build-log/22).
  out=$(python3 "$SRC/modules/nct-recovery-manager/test_recovery.py" 2>&1)
  echo "$out" | grep -q "SLICED_OK" && ok "t0 recovery sliceD tui+entry" || bad "t0 recovery sliceD tui+entry" "$out"
  # Slice 3: shell furniture as shell-kind NCTXML under the
  # window manager, app registry + launch, security profiles +
  # indicators at specced-not-built scope (agent-build-log/23).
  out=$("$GODOT" --headless --path "$SRC/modules" res://nct-environment-manager/harness/main.tscn 2>&1)
  echo "$out" | grep -q "SLICE3_OK" && ok "t0 slice3 shell+registry+security" || bad "t0 slice3 shell+registry+security" "$out"
  # Sys-interface breadth: the crashes domain in the bridge
  # (tree + republication in the watch's shape + the Crashes
  # view) and the Attention inbox surface (agent-build-log/24).
  out=$(python3 "$SRC/modules/nct-linux-sys-interface/test_crashes.py" 2>&1)
  echo "$out" | grep -q "BRIDGE_CRASHES_OK" && ok "t0 sys-interface crashes domain" || bad "t0 sys-interface crashes domain" "$out"
  if python3 "$SRC/modules/nct-linux-sys-interface/sys_interface.py" --fixture "$SRC/modules/nct-linux-sys-interface/fixtures/systemd-journal.jsonl" --fixture "$SRC/modules/nct-linux-sys-interface/fixtures/crashes.jsonl" --snapshot-out "$RES/tree-crashes.json" > /dev/null 2>&1; then
    out=$("$GODOT" --headless --path "$SRC/modules" res://nct-linux-sys-interface/harness/main.tscn -- --snapshot "$RES/tree-crashes.json" 2>&1)
    echo "$out" | grep -q "CRASHES_VIEW_OK" && ok "t0 sys-interface crashes view" || bad "t0 sys-interface crashes view" "$out"
  else
    bad "t0 sys-interface crashes view" "snapshot generation failed"
  fi
  out=$(python3 "$SRC/modules/nct-system-watch/test_inbox.py" 2>&1)
  echo "$out" | grep -q "INBOX_OK" && ok "t0 system-watch inbox end-to-end" || bad "t0 system-watch inbox end-to-end" "$out"
  if python3 "$SRC/modules/nct-system-watch/inbox_snapshot.py" --contexts-out "$RES/inbox-contexts.json" > /dev/null 2>&1; then
    out=$("$GODOT" --headless --path "$SRC/modules" res://nct-system-watch/harness/main.tscn -- --contexts "$RES/inbox-contexts.json" 2>&1)
    echo "$out" | grep -q "ATTENTION_OK" && ok "t0 attention inbox surface" || bad "t0 attention inbox surface" "$out"
  else
    bad "t0 attention inbox surface" "context generation failed"
  fi
  # The grid comparison below needs the native engine, which Godot
  # finds through .godot/extension_list.cfg — an artefact only an
  # editor import writes. A fresh checkout has none and plain --path
  # runs do not create it, so import once here. The importer's own
  # exit code is unreliable on this build (it can crash on exit after
  # writing the artefact); the comparison remains the judge.
  "$GODOT" --headless --import --path "$SRC/modules" > "$RES/import-modules.log" 2>&1 || true
  # NCTXML Grid: the system's own grid model (ported from
  # NCTGraphite), two engines (agent-build-log/28). The
  # comparison check needs the committed native library
  # (src/modules/bin/) — present in any Linux checkout.
  out=$("$GODOT" --headless --path "$SRC/modules" res://nctxml/grid/main.tscn 2>&1)
  echo "$out" | grep -q "NCTGRID_OK" && ok "t0 nctxml grid solver" || bad "t0 nctxml grid solver" "$out"
  out=$("$GODOT" --headless --path "$SRC/modules" res://nctxml/grid/compare.tscn 2>&1)
  echo "$out" | grep -q "GRID_COMPARE_OK" && ok "t0 nctxml grid engines compared" || bad "t0 nctxml grid engines compared" "$out"
  # E2: the XForms layer — instance/binds/submission + layout
  # annotations, one model in two layouts over a shared instance.
  out=$("$GODOT" --headless --path "$SRC/modules" res://nctxml/forms/main.tscn 2>&1)
  echo "$out" | grep -q "NCTFORM_OK" && ok "t0 nctxml forms (xforms layer)" || bad "t0 nctxml forms (xforms layer)" "$out"
  # E5: the TitleBar component — an app window wearing it as
  # client-side chrome; commands mapped per instance.
  out=$("$GODOT" --headless --path "$SRC/modules" res://nctxml/components/main.tscn 2>&1)
  echo "$out" | grep -q "TITLEBAR_OK" && ok "t0 nctxml titlebar component" || bad "t0 nctxml titlebar component" "$out"
  # E1 hosting: the NCTXML library vendored into the greeter and
  # shell projects (decision 1A, source-sync) — copies drift-checked,
  # each project builds and renders a document from its own copy.
  out=$(bash "$SRC/tools/check-nctxml-copies.sh" 2>&1)
  echo "$out" | grep -q "NCTXML_COPIES_CLEAN" && ok "t0 nctxml copies drift check" || bad "t0 nctxml copies drift check" "$out"
  # WM hosting: the window manager + layer stack vendored into
  # the shell project the same way — drift-checked here, and
  # proven live by the "t0 shell wm hosted" check above.
  out=$(bash "$SRC/tools/check-wm-copies.sh" 2>&1)
  echo "$out" | grep -q "WM_COPIES_CLEAN" && ok "t0 wm copies drift check" || bad "t0 wm copies drift check" "$out"
  for host in greeter shell; do
    if command -v "$DOTNET" > /dev/null 2>&1 && "$DOTNET" build -v q -nologo "$SRC/godot/$host" > "$RES/nctxml-$host-build.log" 2>&1; then
      out=$("$GODOT" --headless --path "$SRC/godot/$host" res://nctxml-smoke/main.tscn 2>&1)
      echo "$out" | grep -q "NCTXML_SMOKE_OK" && ok "t0 nctxml hosted in $host" || bad "t0 nctxml hosted in $host" "$out"
    else
      bad "t0 nctxml hosted in $host" "dotnet build failed (see nctxml-$host-build.log)"
    fi
  done
  # Launch model 2: the same projects as .pck packs on the shared
  # runtime (the shipped form). Build to the results dir, then run
  # the shell pack through nct-godot-run's --main-pack path.
  if NCT_GODOT="$GODOT" bash "$SRC/tools/build-pcks.sh" "$RES/pcks" > "$RES/pcks.log" 2>&1; then
    ok "t0 pck build (greeter, shell, nct-hello)"
    out=$(NCT_DISPLAY_DRIVER=headless NCT_RENDER_DRIVER=opengl3 "$SRC/core/session/nct-godot-run" "$RES/pcks/shell.pck" -- --self-test 2>&1)
    echo "$out" | grep -q "SHELL_SELFTEST_OK entries=5" && ok "t0 shell self-test via .pck" || bad "t0 shell self-test via .pck" "$out"
  else
    bad "t0 pck build (greeter, shell, nct-hello)" "see pcks.log"
  fi
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
# cleanup — only what this run started, by PID. A blanket
# pkill -f nct-greetd-bridge also kills a real greeter session's
# bridge when the chain runs inside a booted system (the tier-2
# guest), leaving the greeter up but unanswerable; the nested
# qterminal is this run's only if it carries this run's runtime
# dir in its environment.
kill $GPID $GSESS $SWAYPID 2>/dev/null
for p in $(pgrep qterminal 2>/dev/null); do
  tr '\0' '\n' < "/proc/$p/environ" 2>/dev/null | grep -q "^XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR$" && kill "$p" 2>/dev/null
done
sleep 1
echo "== run-chain: $PASS passed, $FAIL failed ==" | tee -a "$RES/summary.txt"
[ "$FAIL" = 0 ]
