# 13 — the render ladder (A14)

2026-11-25, in Muse, on branch feat/render-ladder (from main af2e01b).
Directed by the user after the A13 report: the software stack should be
what the system falls back to when the native path fails, not a pin —
"can we not check for errors first before going to software rendering?"

## Why not a probe

A device probe (vulkaninfo, /dev/dri checks) cannot see the A13 failure
class: the vmwgfx defect is dmabuf import between client and compositor,
which only appears when the real chain runs — a probe can pass while
the chain still breaks. So "check first" is implemented as *try the real
chain briefly*: an attempt that exits nonzero within a window
(NCT_LADDER_WINDOW, default 10 s) is a broken rendering path; anything
that stays up past the window works.

## Shape

New shared helper `core/session/nct-render-ladder.sh`, sourced by the
three launch points. Rungs change one layer at a time:

| rung | compositor | Godot |
|---|---|---|
| 0 | default renderer | default (Wayland, Vulkan) |
| 1 | default | opengl3, Wayland |
| 2 | default | opengl3, X11 client, software GL |
| 3 | WLR_RENDERER=pixman | as rung 2 (= the A13 configuration) |

- Attempt order: remembered rung first, then down, then wrap to the
  top; each rung at most once. Success = exit 0, or still up at the
  window, or the bridge's login-started marker (below). The working
  rung is written to a render-rung file in the first writable of
  $NCT_RENDER_STATE_DIR, $HOME/.local/state/nct, the state dir — for
  the greeter that is /var/lib/nct-greeter, persistent across boots.
- Inside one session invocation: greetd start-limits a session whose
  command keeps exiting, so the ladder loops internally and greetd
  only ever sees the final exit.
- The bridge (both backends) now writes $NCT_STATE_DIR/login-started
  on a successful START. Without it, a fast successful login followed
  by greetd tearing the greeter session down would look exactly like
  a fast rendering failure and step the ladder down wrongly.
- Explicit configuration wins outright: NCT_RENDER_DRIVER /
  NCT_DISPLAY_DRIVER / WLR_RENDERER already set → one attempt, env
  untouched. NCT_RENDER_RUNG=<n> pins one rung. NCT_RENDER_LADDER=off
  disables. nct-godot-run keeps its old single-exec behaviour whenever
  drivers are set (which is how the session ladder's rung reaches it);
  unset, it runs its own ladder capped at rung 2 (rung 3 differs only
  in the compositor variable a client does not consume).

## Two shell hazards found while building

Both are dash/set -e facts, verified empirically before fixing:

1. `cmd; code=$?` under `set -e` kills the shell before the assignment
   runs. The ladder captures with `cmd || code=$?` throughout. (The
   same pattern sat in the rig's greeter-session edit; harmless there
   because the log that mattered was cage's own output, but the
   "cage exited with code" line could never be written on a failure
   exit. The ladder's greeter path replaces that code.)
2. `exec <shell-function>` is not possible in dash (exit 127).
   nct-godot-run's single-attempt path now calls the function and
   exits with its status.

## Local verification

- tools/test-render-ladder.sh — 16/16: all-rungs-fail returns the last
  code and remembers nothing; fail-fast then stay-up lands on rung 1
  and remembers it; remembered-rung order wraps 2,3,0 and re-remembers;
  explicit env = exactly one attempt; the login marker turns a fast
  exit 5 into success at rung 0; NCT_RENDER_RUNG pins a single attempt.
- tools/run-chain.sh — 16/16 (tiers 0+1 unchanged behaviour; the
  harnesses set NCT_RENDER_DRIVER, so they exercise the
  explicit-config path).
- tools/run-greeter-ui-test.sh — 8/8 (the fixture START now also drops
  the marker; the sway greeter path does not use the ladder).
- build-deb.sh — nct-render-ladder.sh and test-render-ladder.sh are in
  nct-foundation at 755.

One false alarm on the way: the first run-chain run in this worktree
failed tier 1 with "Permission denied" on nct-godot-run. Cause: this
worktree was checked out from origin/main, where every script is mode
644 (the snapshot pushes carry no modes) — a checkout artefact, not a
ladder regression. chmod +x for the tests; the mode debt itself is
already recorded in TESTBED.md.

## Not proven here

Everything about real stacks. On the rig the greeter should step down
from rung 0 by itself on vmwgfx (rung 2 or 3 predicted), remember the
rung, and start there on the next boot; checks 04/05 are the user
session's first ladder run. That is ASSUMPTION A14, settled by the
rig's cage.log / session.log attempt lines.
