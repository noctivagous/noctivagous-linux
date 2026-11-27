#!/bin/bash
# run-greeter-ui-test.sh — S2.4: the human-shaped greeter proof.
# Nested headless sway; the REAL greeter UI (no --auto-login), driven
# by synthesized KEYBOARD input only (wtype):
#   wrong password -> FAIL shows, no session
#   right password -> session starts, shell appears
#   Enter on the shell's Firefox button -> Firefox window
#
# Why keyboard only (found 2026-11-25, probe-verified): key events from
# the wlroots virtual keyboard DO reach Godot apps, but pointer events
# from wlrctl's virtual pointer do NOT reach Godot 4.3 (a bare probe
# project logged keys and never a click, while foot/QTerminal in the
# same session took both). Whether a real pointer on the VM behaves
# the same is a VM-rig question, not assumed here. Two more recipes
# this script encodes: the greeter grabs field focus itself (product
# behaviour), and the first keystroke after a focus change can be
# eaten, so each focus change is followed by a sacrificial Shift.
# Results: tests/results-local/greeter-ui/ (screenshots + summary).
set -u
SRC=$(cd "$(dirname "$0")/.." && pwd)
RES="$SRC/tests/results-local/greeter-ui"; mkdir -p "$RES"
export NCT_SRC="$SRC" NCT_STATE_DIR="$RES/state"; mkdir -p "$NCT_STATE_DIR"
export NCT_RENDER_DRIVER=${NCT_RENDER_DRIVER:-opengl3}
export NCT_DISPLAY_DRIVER=${NCT_DISPLAY_DRIVER:-wayland}
export PATH="$SRC/core/session:$PATH"
GODOT=${NCT_GODOT:-$HOME/workspace/.nct-tools/godot}; export NCT_GODOT="$GODOT"
# The greeter's main scene hosts C# now (the NCTXML form, E3):
# its assembly must be built before the runtime can start it.
if command -v dotnet > /dev/null 2>&1; then
  dotnet build -v q -nologo "$SRC/godot/greeter" > "$RES/greeter-build.log" 2>&1 \
    || { echo "FAIL greeter build — see greeter-build.log"; exit 1; }
fi
# Same host-Firefox arrangement as run-chain.sh: this machine has no
# firefox on PATH (the VM/rootfs use firefox-esr, which resolves
# plainly), so point the resolver at the local tarball build with a
# fresh profile (a missing profile dir makes Firefox open a
# "Profile Missing" dialog instead of a window).
if [ -z "${NCT_CMD_FIREFOX:-}" ] && [ -x "$HOME/workspace/.nct-tools/firefox/firefox" ]; then
  rm -rf "$RES/ff-profile"; mkdir -p "$RES/ff-profile"
  export NCT_CMD_FIREFOX="$HOME/workspace/.nct-tools/firefox/firefox -profile $RES/ff-profile --new-window about:blank"
fi
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "PASS $1" | tee -a "$RES/summary.txt"; }
bad() { FAIL=$((FAIL+1)); echo "FAIL $1 — $2" | tee -a "$RES/summary.txt"; }
: > "$RES/summary.txt"

export XDG_RUNTIME_DIR="/tmp/nct-ui-$$"; mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"
export WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman
printf 'output * resolution 1280x800\ndefault_border none\nexec echo ready > %s/sway-ready\n' "$RES" > "$RES/sway.conf"
rm -f "$RES/sway-ready"
sway -c "$RES/sway.conf" > "$RES/sway.log" 2>&1 &
SWAYPID=$!
for i in $(seq 1 50); do [ -f "$RES/sway-ready" ] && break; sleep 0.2; done
export SWAYSOCK=$(ls "$XDG_RUNTIME_DIR"/sway-ipc.*.sock 2>/dev/null | head -1)
export WAYLAND_DISPLAY=$(ls "$XDG_RUNTIME_DIR"/wayland-* 2>/dev/null | grep -v lock | head -1 | xargs -n1 basename)
export DISPLAY=:0
tree() { swaymsg -t get_tree 2>/dev/null; }
waitfor() { local n=0; while [ $n -lt "$2" ]; do tree | grep -qi "$1" && return 0; sleep 1; n=$((n+1)); done; return 1; }
focus() { # focus <criteria> — and verify sway reports it focused
  swaymsg "[$1] focus" > /dev/null 2>&1
  local n=0
  while [ $n -lt 10 ]; do
    tree | python3 -c 'import json,sys; t=json.load(sys.stdin)
def w(n):
    if n.get("focused"): print(n.get("name") or "")
    for c in n.get("nodes",[])+n.get("floating_nodes",[]): w(c)
w(t)' | grep -qi "$2" && return 0
    sleep 0.5; n=$((n+1))
  done
  return 1
}

FIX="$RES/fixture-users.txt"; printf 'nct:nct-test-2026\n' > "$FIX"
NCT_AUTH_FIXTURE="$FIX" NCT_SESSION_CMD="$SRC/core/session/nct-session-apps" \
  python3 "$SRC/services/bridge/nct-greetd-bridge.py" > "$RES/bridge.log" 2>&1 &
BPID=$!
sleep 1
"$SRC/core/session/nct-godot-run" "$SRC/godot/greeter" > "$RES/greeter.log" 2>&1 &
GPID=$!
if waitfor "NCT Greeter" 20; then ok "greeter window up"; else bad "greeter window up" "not in tree"; fi
focus 'app_id="NCT Greeter"' "NCT Greeter" && ok "greeter window focused" || bad "greeter window focused" "sway focus did not settle"
sleep 1; grim "$RES/1-greeter.png" 2>/dev/null
# One wtype process per phase (see header: per-process device churn
# eats key presses; a sacrificial Shift_L takes the loss inside the
# process). The greeter focuses the username field itself.
wtype -d 150 -k Shift_L "nct" -k Tab "wrong-pass" -k Return
sleep 3
grim "$RES/2-wrong-password.png" 2>/dev/null
if tree | grep -qi "NCT Greeter" && ! tree | grep -qi "NCT Shell"; then
  ok "wrong password: no session started"
else bad "wrong password" "greeter gone or shell present unexpectedly"; fi
grep -q "AUTH user=nct -> FAIL" "$RES/bridge.log" && ok "bridge rejected the wrong password" || bad "bridge rejected the wrong password" "no AUTH FAIL line in bridge log"
grep -q "GREETER_FAIL" "$RES/greeter.log" && ok "greeter showed the failure" || bad "greeter showed the failure" "no GREETER_FAIL in greeter log"
# After a failure the greeter re-focuses the password field, contents
# selected: typing replaces it. Right password, Enter.
# On Godot 4.7 (not 4.3) the synthesized-keyboard path drops input
# unpredictably — probe-verified 2026-11-26: whole virtual-keyboard
# devices silently deliver nothing (in one probe run devices 1, 3, 5
# landed and 2, 4 did not; in the test environment the pattern
# shifted), and neither refocus nor waiting changes it. Real
# keyboards do not vanish and reappear between attempts; this is the
# synthesized-input path, same family as the A12 pointer finding.
# So retry, exactly as the shell phase below does: a dropped attempt
# leaves the field reselected after its FAIL (or unsubmitted), the
# next attempt types clean, and the check is the shell window, not
# the keystroke count.
logged_in=0
for attempt in 1 2 3 4; do
  wtype -d 150 -k Shift_L -k Shift_L "nct-test-2026" -k Return
  if waitfor "NCT Shell" 12; then logged_in=1; break; fi
done
if [ $logged_in = 1 ]; then ok "right password: session shell up"; else bad "right password" "shell not in tree"; fi
if tree | grep -qi "NCT Greeter"; then bad "greeter exited after login" "greeter window still present"; else ok "greeter exited after login"; fi
sleep 1; grim "$RES/3-session.png" 2>/dev/null
# Drive the shell by keyboard: focus its window; the bar's first
# button (Firefox) already holds control focus (product behaviour),
# so Enter presses it. Synthetic key presses are occasionally eaten
# outright by the virtual-keyboard path (observed repeatedly; a
# press that never arrives cannot be distinguished from a refusal),
# so Enter is retried — a second Enter into a started Firefox is
# harmless, and the check is the window, not the keystroke count.
if focus 'title="NCT Shell"' "NCT Shell"; then
  launched=0
  for attempt in 1 2 3; do
    wtype -d 100 -k Shift_L -k Shift_L -k Return -k Return
    if waitfor "firefox" 15; then launched=1; break; fi
  done
  if [ $launched = 1 ]; then ok "shell Firefox button launched Firefox (keyboard)"; else bad "shell Firefox button" "no firefox window after Enter retries"; fi
else
  bad "shell Firefox button" "could not focus the shell window"
fi
sleep 1; grim "$RES/4-firefox-launched.png" 2>/dev/null
kill $GPID $BPID $SWAYPID 2>/dev/null
echo "== greeter-ui: $PASS passed, $FAIL failed ==" | tee -a "$RES/summary.txt"
[ "$FAIL" = 0 ]
