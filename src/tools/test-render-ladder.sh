#!/bin/sh
# test-render-ladder.sh — unit tests for core/session/nct-render-ladder.sh.
# No compositor, no Godot: fake commands stand in for the session
# command and the ladder's decisions (attempt order, step-down,
# remembered rung, explicit-config bypass, login marker) are asserted
# from its log and rung file. Run: bash tools/test-render-ladder.sh
set -u
here=$(cd "$(dirname "$0")" && pwd)
helper="$here/../core/session/nct-render-ladder.sh"
work=$(mktemp -d /tmp/nct-ladder-test.XXXXXX)
trap 'rm -rf "$work"' EXIT
pass=0; fail=0
check() { # check <name> <0|1>
  if [ "$2" -eq 0 ]; then echo "PASS $1"; pass=$((pass+1));
  else echo "FAIL $1"; fail=$((fail+1)); fi
}

# --- fake commands ---------------------------------------------------
cat > "$work/fail.sh" <<'EOF'
#!/bin/sh
exit 3
EOF
cat > "$work/flaky.sh" <<'EOF'
#!/bin/sh
# fails fast on the first invocation, then stays up and exits clean
c=$(cat "$COUNTFILE" 2>/dev/null || echo 0); c=$((c+1)); echo "$c" > "$COUNTFILE"
[ "$c" -lt 2 ] && exit 3
sleep 3; exit 0
EOF
cat > "$work/slowfail.sh" <<'EOF'
#!/bin/sh
# rung 0 (no driver env): stays up past the window, THEN dies nonzero —
# the rig's labwc case (A14 as proven): still a failure, keep stepping.
# rung >= 1 (driver env set): exits clean at once.
[ -n "${NCT_RENDER_DRIVER:-}" ] && exit 0
sleep 3; exit 7
EOF
cat > "$work/rungcheck.sh" <<'EOF'
#!/bin/sh
# fails on rungs 1-3 (identified by their env), succeeds on rung 0
[ -n "${WLR_RENDERER:-}" ] && exit 3
[ -n "${NCT_DISPLAY_DRIVER:-}" ] && exit 3
[ -n "${NCT_RENDER_DRIVER:-}" ] && exit 3
exit 0
EOF
cat > "$work/marker.sh" <<'EOF'
#!/bin/sh
# simulates a successful login: bridge marker appears, then a
# "bad" exit (greetd tearing the session down) — must count as success
mkdir -p "$STATEDIR"; : > "$STATEDIR/login-started"
exit 5
EOF
chmod +x "$work"/*.sh

# run_case <name> <cmd...> -- each case gets a fresh HOME/state;
# extra environment goes in CASE_ENV (e.g. CASE_ENV=NCT_RENDER_RUNG=3)
run_case() {
  _name=$1; shift
  _casedir="$work/$_name"; mkdir -p "$_casedir/home" "$_casedir/state"
  env -i PATH="$PATH" HOME="$_casedir/home" NCT_LADDER_WINDOW=2 \
      STATEDIR="$_casedir/state" COUNTFILE="$_casedir/count" ${CASE_ENV:-} \
      sh -eu -c '. "$1"; shift; ladder_run "$@"' _ "$helper" \
        "$_casedir/state" test.log "$@"
}

# 1. every rung dies fast -> last code, 4 attempts in order, no memory
run_case allfail "$work/fail.sh" >/dev/null 2>&1; code=$?
[ "$code" -eq 3 ]; check "all-fail returns last exit code" $?
[ "$(grep -c 'attempt rung=' "$work/allfail/state/test.log")" -eq 4 ]; check "all-fail tries 4 rungs" $?
grep -q 'attempt rung=0' "$work/allfail/state/test.log" && grep -q 'attempt rung=3' "$work/allfail/state/test.log"; check "all-fail order spans 0..3" $?
[ ! -f "$work/allfail/home/.local/state/nct/render-rung" ]; check "all-fail remembers nothing" $?

# 2. fail fast on rung 0, stay up then exit clean on rung 1 -> success at 1
run_case flaky "$work/flaky.sh" >/dev/null 2>&1; code=$?
[ "$code" -eq 0 ]; check "flaky returns the clean exit code" $?
[ "$(cat "$work/flaky/home/.local/state/nct/render-rung")" = "1" ]; check "flaky remembers rung 1" $?

# 2b. nonzero exit PAST the window still steps down (rig-proven A14:
# labwc died 17 s in with the fast failures' signature)
run_case slowfail "$work/slowfail.sh" >/dev/null 2>&1; code=$?
[ "$code" -eq 0 ]; check "slowfail steps down and succeeds" $?
grep -q 'failed after window' "$work/slowfail/state/test.log"; check "slowfail logs the after-window failure" $?
[ "$(cat "$work/slowfail/home/.local/state/nct/render-rung")" = "1" ]; check "slowfail remembers rung 1" $?

# 3. remembered rung 2 tried first, wraps to 0 which succeeds
_casedir="$work/wrap"; mkdir -p "$_casedir/home/.local/state/nct" "$_casedir/state"
printf '2\n' > "$_casedir/home/.local/state/nct/render-rung"
env -i PATH="$PATH" HOME="$_casedir/home" NCT_LADDER_WINDOW=2 \
    sh -eu -c '. "$1"; shift; ladder_run "$@"' _ "$helper" \
      "$_casedir/state" test.log "$work/rungcheck.sh" >/dev/null 2>&1; code=$?
[ "$code" -eq 0 ]; check "wrap succeeds at rung 0" $?
_order=$(grep 'attempt rung=' "$_casedir/state/test.log" | sed 's/.*rung=\([0-9]\).*/\1/' | tr -d '\n')
[ "$_order" = "230" ]; check "wrap attempt order is 2,3,0 (got $_order)" $?
[ "$(cat "$_casedir/home/.local/state/nct/render-rung")" = "0" ]; check "wrap re-remembers rung 0" $?

# 4. explicit driver env -> single attempt, environment untouched
CASE_ENV=NCT_RENDER_DRIVER=opengl3 run_case pinned "$work/fail.sh" >/dev/null 2>&1; code=$?
[ "$code" -eq 3 ]; check "explicit-config returns its code" $?
grep -q 'single attempt (explicit config)' "$work/pinned/state/test.log" && [ "$(grep -c 'attempt rung=' "$work/pinned/state/test.log")" -eq 0 ]; check "explicit-config makes one attempt" $?

# 5. login marker turns a fast bad exit into success at rung 0
run_case marker "$work/marker.sh" >/dev/null 2>&1; code=$?
[ "$code" -eq 0 ]; check "marker success returns 0" $?
grep -q 'login started' "$work/marker/state/test.log"; check "marker success is logged" $?
[ "$(cat "$work/marker/home/.local/state/nct/render-rung")" = "0" ]; check "marker remembers rung 0" $?

# 6. NCT_RENDER_RUNG pins a single rung even though it fails
CASE_ENV=NCT_RENDER_RUNG=3 run_case rungpin "$work/rungcheck.sh" >/dev/null 2>&1; code=$?
[ "$code" -eq 3 ]; check "rung pin returns its code" $?
[ "$(grep -c 'attempt rung=' "$work/rungpin/state/test.log")" -eq 1 ] && grep -q 'attempt rung=3' "$work/rungpin/state/test.log"; check "rung pin attempts only rung 3" $?

echo "---"
echo "render-ladder: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
