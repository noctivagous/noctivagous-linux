# 37 — The stack joins the keyboard: focus wiring for the WindowTransformer

2026-11-27. Branch feat/greeter-look-registry, on e4e97a6 (log 36).

## The defect this closes

Log 36's guest proof found the transformer mouse-complete
and keyboard-partial: the stack rows were not in the
keyboard focus chain. Tab cycled the four bar buttons only,
so in the guest, restore and close had to be issued through
the bridge client. In a key-click-first environment that is
the difference between a feature and a demo of one.

## Diagnosis (measured, two wrong theories discarded)

A headless probe walked the engine's own next-focus
computation (Control.find_next_valid_focus) with one
stacked item in the feed. Measured facts:

- Every button — bar and stack alike — is focus_mode ALL
  and visible. Nothing was opted out.
- The stack rows formed a closed 2-cycle (row → × → row);
  the bar formed its own 4-cycle. Two chains, no crossing,
  in either direction.

First theory: the stack panel sat in the default canvas
while the bar's root is seated in the Top CanvasLayer, and
the chain would not cross canvases. The panel was therefore
registered as a window-manager furniture record
("stack-region", panel style) and seated in the Top layer
beside the bar — architecturally right regardless (the
stack IS Top-layer furniture, and the WM self-test now
asserts its seating). Re-measured: the panel's parent was
the Top layer and the chains were STILL separate. Theory
discarded on evidence.

What the measurements support: the automatic chain keeps
each Control-rooted island under a CanvasLayer to itself —
BarRoot's subtree is one island, the stack panel's another,
and no automatic traversal merges sibling islands. The
engine's sanctioned override for exactly this is explicit
focus_next / focus_previous paths.

## The fix

- stack_host.gd: a `rows_changed` signal, emitted whenever
  the row set is rebuilt; `get_panel_root()` for the WM
  record, mirroring the bar's get_bar_root().
- main.gd: the stack-region record above, plus
  `_rewire_focus()` — collect the bar buttons and the
  stack rows and wire them as ONE cycle (bar in order,
  then each row's title and ×, wrapping to the first bar
  button). It runs at startup and on every rows_changed,
  so the chain is correct for any stack depth, including
  zero. If a focused row vanishes (restored or closed) and
  the shell window holds focus with no owner, focus returns
  to the first bar button.

The chain's stack test grew the keyboard legs: it walks
the chain from the first bar button and requires a stack
button in it, then grabs the row, pushes a real ui_accept
press+release through the viewport, and requires the
window to leave the stack. STACK_FOCUS_OK chain=6.

## Gates

- run-chain **47 passed, 6 failed** — the same profile as
  log 36: the 6 are the tier-1 nested-sway checks, proven
  environmental in this sandbox (no sway binary; pristine
  HEAD fails them identically). Tier 0 fully green,
  including "t0 shell stack transformer" (now carrying the
  keyboard legs) and the WM self-test's new stack-seating
  assertions inside "t0 shell self-test".

## Tier-2 proof (VirtualBox guest)

Foundation deb sha256
`eabbd8c5eb8ef29be3f1a94f735acaf5c243dac2b3cccc7e1d4f93ad990067e9`
installed in the nct-test guest; real greeter login.
Firefox and QTerminal were both shaded into the stack
(bridge list: both 0 1 1), then the keyboard walk was done
one key at a time, screenshot after each (shot37-w1/w2):

- Tab: focus outline on the Terminal (foot) bar button.
- Tab: focus outline on the QTerminal stack row — the bar
  → stack transition that no Tab count could reach in
  log 36.
- Enter: QTerminal restored and active
  (`qterminal 1 0 0`); Firefox still stacked, untouched.
  Final screenshot: QTerminal's window on the desktop, one
  row left in the stack.

Firefox was then restored via the bridge client for
tidiness; the guest is left logged in with both windows
open.

## Notes / limits

- Key injection through VBoxManage was visibly uneven
  during this proof: two activations arrived tens of
  seconds after the batch that sent them (an Enter from the
  login batch launched QTerminal inside the fresh session;
  a later Enter launched NCT Hello and, seconds after,
  foot). The strays were closed and the walk redone one
  key at a time with a screenshot after each key — the
  proof above rests only on those verified steps. The
  injection channel, not the shell, is the suspect: every
  activation matched a key actually sent, only late.
- One unexplained observation, not chased: in several
  screenshots the Firefox bar button showed no green
  running strip while QTerminal's showed, though Firefox's
  pid record (1504) and live process were verified over
  SSH. The strip mechanism was proven at log 35 and the
  chain's liveness check passes; if it recurs it wants its
  own diagnosis.
- Push awaits the owner's word, as always. Route 1c's
  second half (the labwc in-place shade patch) remains
  queued behind it.
