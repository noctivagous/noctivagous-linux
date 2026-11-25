# 08 — S2.4: the human-shaped greeter proof (2026-11-25)

**Gate, passed: tools/run-greeter-ui-test.sh — 8 passed, 0 failed.**
Nested headless sway; the real greeter UI (no --auto-login), driven
by synthesized keyboard input: wrong password → bridge logs
`AUTH user=nct -> FAIL`, greeter shows the failure, no session;
right password → session starts, shell appears, greeter exits;
Enter on the shell's Firefox button → a Firefox window. Screenshots
in tests/results-local/greeter-ui/. tools/run-chain.sh still passes
15/15 after every change below.

**What it took to get there — the diagnosis chain, because each
layer looked like a different bug:**

1. Typed text never landed. A bare probe Godot project (prints every
   input event) proved keyboard events from wtype's virtual keyboard
   DO reach Godot, but only help a control that holds GUI focus —
   and nothing held it. **Product fix:** the greeter grabs focus to
   the username field at startup (deferred — a plain grab in _ready
   is dropped before the window owns focus), re-focuses the password
   field with contents selected after a failed login, and re-grabs
   on window activation (NOTIFICATION_WM_WINDOW_FOCUS_IN) if focus
   was cleared. The shell got the same treatment for its first
   launch button. These are behaviours a real greeter/shell should
   have anyway; the test just exposed their absence.
2. Key presses are eaten, unreliably. Probe logs showed individual
   presses (never releases) vanishing — typically the first press of
   a fresh wtype process or after an idle gap. Working recipe: one
   wtype process per phase, a sacrificial Shift_L first, 100–150 ms
   between keys. The shell-button step additionally sends Enter
   twice per attempt and retries; the check is the resulting
   window, not the keystrokes.
3. Pointer input does not reach Godot at all here. wlrctl clicks
   produced no event in the probe, while foot and QTerminal in the
   same session took clicks and keys. Whether a *real* pointer
   behaves the same is unknown — flagged for the VM rig (its input
   path is different), not assumed either way.
4. The button fired and nothing happened — twice, for two different
   silent reasons. (a) nct-launch found through PATH had a bare $0,
   so its dirname-based `here` resolved to the caller's CWD and
   nct-resolve-cmd was never found. **Fix:** all five session
   scripts resolve $0 through `command -v` when it has no slash.
   (b) On this host, `firefox` is not on PATH and NCT_CMD_FIREFOX
   was unset in the test env, so the resolver exited 3 and
   nct-launch died under set -e *before* its log line, with stderr
   swallowed by Godot's create_process. **Fixes:** the test sets
   NCT_CMD_FIREFOX exactly as run-chain does (the VM/rootfs resolve
   firefox-esr plainly); and nct-launch now logs a FAILED line and
   exits 3 when a key cannot be resolved — a missing program is
   diagnosable from launch.log from now on.
5. The bridge logged nothing about auth attempts, which made (4)
   hard to see. **Fix:** the bridge logs `AUTH user=<u> -> OK|FAIL
   <why>` and `START -> spawned session cmd` (never passwords).
   The VM test bed's greps can use these lines too.

**Also fixed along the way:** the greeter could not retry a login —
its single StreamPeerTCP was already connected; _connect_and_auth
now reuses a live connection for a second AUTH.

**What this does not show:** real greetd, a real seat, real input
hardware. The typed-login proof is against the fixture backend over
the same protocol the greetd backend speaks; tier 2 remains the
rig's job, unchanged.
