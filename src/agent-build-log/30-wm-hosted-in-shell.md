# 30 — The window manager is hosted in the shipped shell

2026-11-27. Branch feat/wm-hosted-in-shell off main c542199.
Direction (user, accepting the recommendation): host the
existing window manager + layer stack in the shipped shell
next; the compositor backend waits until a feature demands
control of foreign surfaces.

Until now the two lived in separate worlds: the modules
project had the environment manager (Window records, the
12-layer stack, style policy) proven against fake windows,
while the shell that actually runs in the session was the
small bar host with no records at all. This slice joins them.

## What was done

- tools/sync-wm.sh + tools/check-wm-copies.sh: the window
  manager and layer stack are vendored into godot/shell/wm/
  from src/modules/nct-window-manager — the same source-sync
  hosting as the NCTXML library (decision 1A), drift-checked
  in tier 0 (WM_COPIES_CLEAN hosts=1). The relative layout is
  preserved (wm/nct-layer-stack/), so the scripts' preload
  paths resolve unchanged.
- godot/shell/main.gd builds the manager in _ready (layers
  root = the shell itself, the modules harness's idiom) and
  registers the launch bar as a Window record: style panel,
  origin shell, kind shell, backing = the bar document's
  root (ShellBar.cs now exposes get_bar_root()). The manager
  seats the backing on the Top layer's CanvasLayer.
- Every launch registers an own-process record (unique id
  per launch, app_id + title from the launch list, style
  normal, NO backing).

## The nct-launch finding (why records carry no pid)

nct-launch detaches: it starts the app with
`nohup sh -c "$cmd" &` and exits, so the pid the shell gets
from create_process is the launcher's, gone in milliseconds.
There is no app pid for the shell to track, and per the plan
(§1 rule 2) processes belong to the app registry, windows to
the window manager — so this slice does not grow pid
tracking, liveness or close for launched apps. The record is
the window manager's half; the surface that becomes its
backing is the compositor link's to attach, and the record
does not change when it does. If launch liveness is ever
wanted shell-side, nct-launch would have to report the app
pid (a pidfile convention) — a contract change to a
rig-proven session script, not made here.

## Proofs

- Shell self-test extended: SHELL_WM_OK records=2 — all
  twelve layer nodes present; the bar record's style, layer
  and focus policy checked, and its backing MEASURED seated
  under the Top CanvasLayer in the live tree (not read back
  from the record); a launch registration produces an
  own-process record with no backing. Tier 0 gained the
  "shell wm hosted" and "wm copies drift check" checks.
- run-chain tiers 0+1: 41/41 (39 + the two new checks).
- run-greeter-ui-test.sh: 8/8 — its session phase drives the
  bar by keyboard with the bar now seated through the layer
  stack; the focus guard still lands on the first button.

## Found on the way

- A GDScript parse error (type inference on `:=` from an
  untyped manager reference) fails the whole script, so the
  self-test never quits and a headless run hangs instead of
  failing. The two inference sites now use plain assignment;
  worth remembering whenever a headless shell run "hangs":
  check for a parse error first.

## Not built / owed

- The compositor backend (records for foreign windows,
  backings, the 12-layer order across backings) — by the
  decision above, it waits for a feature that demands it.
- App-registry hosting in the shell (the processes half).
- Style conversion / freeze exercised on the shipped bar;
  the manager's signals are unconsumed in the shell so far.
- Tier-2 rig proof of the session with the hosted manager
  (the shell's startup path changed).
