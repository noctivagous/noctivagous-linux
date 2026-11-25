#!/bin/bash
# run-all.sh — the in-guest tier-2 test bed. Run as root (sudo).
# Usage: run-all.sh [check numbers...]   (default: all)
# Output: /tmp/nct-results/summary.txt + per-check logs; mirrored to
# $SRC/tests/vm/results/ when the synced folder is present.
set -u
SRC=${SRC:-/vagrant/src}
RES=/tmp/nct-results; mkdir -p "$RES"
MIRROR=""; [ -d "$SRC/tests/vm" ] && MIRROR="$SRC/tests/vm/results" && mkdir -p "$MIRROR"
PASS=0; FAIL=0
: > "$RES/summary.txt"
ok()  { PASS=$((PASS+1)); echo "PASS $1" | tee -a "$RES/summary.txt"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL $1 — $2 (log: $RES/${1%%-*}.log)" | tee -a "$RES/summary.txt"; }
want() { [ $# -eq 0 ] || true; }
SELECTED="$*"
run() { # run <id> <fn>
  if [ -z "$SELECTED" ] || echo " $SELECTED " | grep -q " $1 "; then "$2"; fi
}

check00() { # environment & pins
  local missing=""
  for c in greetd cage labwc sway foot qterminal firefox-esr grim python3; do
    command -v $c >/dev/null || missing="$missing $c"
  done
  [ -x /usr/lib/nct/godot/godot ] || missing="$missing godot-runtime"
  if [ -z "$missing" ]; then ok 00-environment; else bad 00-environment "missing:$missing"; fi
  /usr/lib/nct/godot/godot --version > "$RES/00.log" 2>&1 || true
}
check01() { # nested chain re-run in the guest (tiers 0-1, real firefox-esr)
  if NCT_GODOT=/usr/lib/nct/godot/godot "$SRC/tools/run-chain.sh" > "$RES/01.log" 2>&1; then
    ok 01-nested-chain
  else bad 01-nested-chain "run-chain failed in guest; see log + $SRC/tests/results-local"; fi
}
check02() { # greetd armed
  if [ -f /etc/greetd/config.toml ] && systemctl is-enabled greetd >/dev/null 2>&1; then
    ok 02-greetd-armed
  else bad 02-greetd-armed "config missing or greetd not enabled"; fi
  { systemctl status greetd --no-pager; ls -la /etc/greetd/; } > "$RES/02.log" 2>&1 || true
}
check03() { # greeter up: bridge listening, greeter process present
  local tries=0
  while [ $tries -lt 15 ]; do
    (python3 -c "import socket; s=socket.create_connection(('127.0.0.1',7717),2); s.sendall(b'PING\n'); print(s.recv(64))" 2>/dev/null | grep -q PONG) && break
    sleep 2; tries=$((tries+1))
  done
  if [ $tries -lt 15 ] && pgrep -f "nct-greeter|cage" >/dev/null; then ok 03-greeter-up
  else bad 03-greeter-up "bridge not answering PING or no greeter process (is greetd the running DM? did the VM boot to it?)"; fi
  { pgrep -af "greetd|cage|godot|bridge"; journalctl -u greetd --no-pager -n 100; } > "$RES/03.log" 2>&1 || true
}
check04() { # the real login, through the bridge's greetd backend
  python3 - > "$RES/04.log" 2>&1 <<'PY'
import socket, sys, time
s = socket.create_connection(("127.0.0.1", 7717), timeout=10)
f = s.makefile("rw")
def ask(line):
    f.write(line + "\n"); f.flush()
    r = f.readline().strip(); print(line.split()[0], "->", r); return r
if ask("AUTH nct nct-test-2026") != "OK":
    sys.exit(1)
if ask("START") != "STARTED":
    sys.exit(1)
print("login accepted, session start requested")
PY
  [ $? -eq 0 ] || { bad 04-login "bridge AUTH/START failed — ASSUMPTION A3 territory"; return; }
  # wait for the user session: labwc + shell as user nct
  local tries=0
  while [ $tries -lt 30 ]; do
    if pgrep -u nct -f "labwc" >/dev/null && pgrep -u nct -f "godot.*shell" >/dev/null; then break; fi
    sleep 2; tries=$((tries+1))
  done
  if [ $tries -lt 30 ]; then ok 04-login; else bad 04-login "session processes not found after START (A10)"; fi
  { pgrep -afu nct; ls /run/user/1000/ 2>/dev/null; } >> "$RES/04.log" 2>&1 || true
}
check05() { # launch the three citizens inside the live session
  local uid_nct; uid_nct=$(id -u nct)
  local disp; disp=$(ls /run/user/$uid_nct/wayland-* 2>/dev/null | grep -v lock | head -1 | xargs -n1 basename 2>/dev/null)
  [ -n "$disp" ] || { bad 05-launch "no wayland socket for nct (session running?)"; return; }
  sudo -u nct env XDG_RUNTIME_DIR=/run/user/$uid_nct WAYLAND_DISPLAY=$disp NCT_SRC=/usr/lib/nct \
    PATH=/usr/lib/nct/core/session:$PATH NCT_STATE_DIR=/home/nct/.local/state/nct \
    sh -c 'nct-launch firefox; nct-launch qt; nct-launch hello' > "$RES/05.log" 2>&1 || true
  sleep 8
  local missing=""
  pgrep -u nct -f "firefox" >/dev/null || missing="$missing firefox"
  pgrep -u nct -f "qterminal" >/dev/null || missing="$missing qterminal"
  pgrep -u nct -f "godot.*nct-hello" >/dev/null || missing="$missing nct-hello"
  if [ -z "$missing" ]; then ok 05-launch; else bad 05-launch "not running:$missing (A1/A8)"; fi
  sudo -u nct ls -la /home/nct/.local/state/nct/ >> "$RES/05.log" 2>&1 || true
}
check07() { # rendering: which Godot driver works in this VM?
  local r=""
  if timeout 20 /usr/lib/nct/godot/godot --headless --path /usr/lib/nct/godot/apps/nct-hello --quit-after 5 >> "$RES/07.log" 2>&1; then r="headless-ok"; fi
  if command -v vulkaninfo >/dev/null && vulkaninfo --summary >> "$RES/07.log" 2>&1; then r="$r vulkan-present"; fi
  [ -n "$r" ] && ok 07-rendering || bad 07-rendering "godot headless run failed (A7)"
  echo "rendering: $r" >> "$RES/summary.txt"
}
check09() { # greetd survived boot and the greeter session stayed up (S2.5/A13)
  # In the QEMU graphical boot the session command exited in ~1 s and
  # greetd start-limited. Here: greetd must be active (not failed),
  # and a greeter-side process must persist across a 30 s window.
  systemctl is-active greetd >/dev/null 2>&1 || { bad 09-greeter-stays-up "greetd not active after boot"; systemctl status greetd --no-pager > "$RES/09.log" 2>&1 || true; return; }
  local before after
  before=$(pgrep -f "cage|nct-greeter|godot.*greeter" | head -1)
  sleep 30
  after=$(pgrep -f "cage|nct-greeter|godot.*greeter" | head -1)
  if [ -n "$before" ] && [ -n "$after" ]; then ok 09-greeter-stays-up
  else bad 09-greeter-stays-up "no persistent greeter process (before='$before' after='$after') — A13"; fi
  { systemctl status greetd --no-pager; journalctl -u greetd --no-pager -n 100; pgrep -af "cage|godot|greetd"; } > "$RES/09.log" 2>&1 || true
}
check08() { # collect logs for everything above
  { journalctl -u greetd --no-pager -n 200; echo ===; cat /tmp/nct-greeter-state/bridge.log 2>/dev/null; echo ===; cat /home/nct/.local/state/nct/*.log 2>/dev/null; } > "$RES/08.log" 2>&1 || true
  ok 08-logs-collected
}

run 00 check00; run 01 check01; run 02 check02; run 03 check03
# 09 before 04: a successful login (04 START) legitimately ends the
# greeter session, so the greeter-persistence check must measure the
# pre-login seat — not the post-login one.
run 09 check09; run 04 check04; run 05 check05; run 07 check07; run 08 check08
echo "== run-all: $PASS passed, $FAIL failed ==" | tee -a "$RES/summary.txt"
[ -n "$MIRROR" ] && cp -r "$RES/"* "$MIRROR/" 2>/dev/null || true
[ "$FAIL" = 0 ]
