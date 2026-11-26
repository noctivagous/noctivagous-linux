# 19 — System-interface Slice A: the sys-interface skeleton

Date: 2026-11-26. Asked by: the owner ("Run A–D without
interruption"). Worktree: ~/workspace/noctivagous-linux-slice1,
branch feat/slice1-window-layer. Scope:
plans/SYSTEM-INTERFACE.md §6 Slice A — systemd + journal
subscriptions republished on the desktop bus; the system object
tree with a Services view and a Logs view as proofs of
reflection.

## What was built (src/modules/nct-linux-sys-interface/)

Per the language assignment (plans §9: services outside Godot,
bridge pattern, Python prototypes):

- system_tree.py — the live system object tree (§1 rule 2,
  mirror don't copy): path-addressed nodes, property merges,
  change subscribers, snapshots.
- sources.py — the two source kinds. FixtureSource replays a
  recorded JSONL event stream through the exact ingest path a
  live source uses. SystemdSource is the live backend (systemd
  over Gio/GDBus: Subscribe first, then ListUnits, so no change
  can be missed); it reports its availability honestly.
- sys_interface.py — the bridge: ingest (units → /units/<id>
  with health derived in desktop terms — ok / failed / changing
  / off; journal → /journal/<unit>, capped), republication on
  the desktop bus as desktop-term events, failed_units(), and a
  CLI that writes a snapshot + event log.
- fixtures/systemd-journal.jsonl — four units (one fails
  mid-stream) and their journal entries, including the
  priority-3 line that explains the failure.
- views/services-pane.nctxml + views/logs-pane.nctxml — the two
  reflection proofs, rendered by the Slice 2 interpreter from
  DataContexts the harness builds out of a bridge snapshot.
- harness/ — ViewHarness.cs + scene.
- test_sys_interface.py — the bridge harness. Two additive
  tier-0 checks in run-chain.sh (bridge; views).

## Evidence

- SLICEA_OK units=4 events=9. The tree is proven LIVE, not a
  snapshot: pumped in two stages, bluetooth reads ok after the
  first stage and failed (result exit-code) after the second;
  the bus health sequence for it is exactly [ok, failed]; the
  priority-3 journal entry is attached to its unit; an inactive
  unit reads "off" in desktop terms.
- SLICEA_VIEWS_OK: the Services view shows "bluetooth.service —
  failed" and the summary "4 services · 1 failed" and
  "greetd.service — ok"; the Logs view shows the "adapter not
  responding" line. The views render the tree's contents — they
  hold no copy of their own.
- Full tiers 0+1 after all four system-interface slices:
  27/27; greeter-ui 8/8.

## What this does not show

- No live systemd: this sandbox has none (and no python3-gi),
  and the harness asserts the live backend reports exactly
  that. The Gio subscription path (start_live) is written but
  unproven — a rig proof, owed, in the same class as A12/A14:
  the fixture path is the nested proof, not the real seat.
- Only two of the bridge's nine domains exist (systemd units,
  journal). Power, network, devices, packages, firmware,
  crashes and authority join the same tree as their slices land.
