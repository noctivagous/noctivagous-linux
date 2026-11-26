# 24 — Sys-interface breadth: crashes domain + Attention inbox surface

Date: 2026-11-26. Asked by: the owner (chose "sys-interface
breadth work" from the post-Slice-3 board). Worktree:
~/workspace/noctivagous-linux-slice1, branch
feat/sys-interface-breadth off main cdb68d3. Scope: the two
breadth items named when the work was offered — a second
bridge domain in nct-linux-sys-interface, and the Attention
inbox surface for nct-system-watch (SYSTEM-INTERFACE.md §3:
"persistent in the bar until resolved or dismissed,
severity-ordered").

## Why crashes, of the seven remaining domains

Slice B's watch already consumed crash events — but hand-fed,
in "the shape the bridge's crashes domain will publish"
(log 20). The crashes domain is the one that closes an
existing seam instead of opening a new front: build it, and
B's crash path becomes end-to-end real (at fixture grade).
The remaining domains (session/power, network, devices,
packages, firmware, authority) are untouched.

## What was built

Bridge (nct-linux-sys-interface):
- Ingest for {"type": "coredump"} events → tree records at
  /crashes/<id> {binary, app, signal, pid, when}, republished
  on the desktop bus as {"event": "crash", ...} in the exact
  shape SystemWatch.feed consumes, crash_id added.
- fixtures/crashes.jsonl: three coredumps, two binaries (NCT
  Hello twice — the dedupe case).
- CoredumpSource: the live backend stub (systemd-coredump via
  coredumpctl), reporting availability honestly like the
  systemd source does.
- The CLI takes repeated --fixture flags, so one bridge pumps
  several domains into one tree.
- views/crashes-pane.nctxml + the Slice A view harness
  extended: a snapshot containing crashes renders the third
  pane (CRASHES_VIEW_OK alongside SLICEA_VIEWS_OK).

Watch (nct-system-watch):
- inbox_contexts(): the bar context ("Attention: N open" /
  "Attention: clear") and one context per open Issue
  (severity-ordered; Title / Severity / Since / Occurrences /
  Actions as the labels of the Issue's way out).
- inbox_snapshot.py: the seam as a driver — bridge fixtures →
  watch → contexts JSON.
- views/attention-bar.nctxml (shell kind) and
  views/attention-pane.nctxml; harness/AttentionHarness.cs
  renders both and seats the bar item in the window manager
  as a panel window in the Top layer (Slice 3's composition).

## Evidence

- BRIDGE_CRASHES_OK records=3 events=3 — one tree holds units
  and crashes together; republication is in fixture order with
  the watch's fields; the live backend's availability agrees
  with the machine it's running on.
- INBOX_OK issues=3 — end to end over the real feed: the
  bluetooth failure and both crash Issues; NCT Hello's two
  coredumps are ONE Issue with occurrences=2; the unit Issue
  carries Fix + Open + Report, the crash Issue leads with
  Report. Slice B's own harness still passes unchanged.
- ATTENTION_OK — the bar item renders "Attention: 3 open",
  sits under the Top CanvasLayer, and each Issue's pane shows
  its title and its way out.
- Four additive tier-0 checks. Full tiers 0+1: 32/32;
  greeter-ui 8/8.

## What this does not show

- Fixture grade throughout, as with Slice A: no real
  coredump has flowed (this sandbox has no systemd-coredump,
  and CoredumpSource says so). The live pump is the daemon's
  serve loop, unproven until the rig — the same owed proof as
  Slice A's live systemd.
- The inbox surface renders; it does not yet act. The pane's
  Fix/Open/Report are text, not wired actions — wiring Open
  to the notification centre / panels and Fix to the bridge's
  action path (§1 rule 4) is the next layer, and §1 rule 4
  itself (actions back through the bridge) is unbuilt.
- The bar item is seated in a harness composition, not yet in
  the shell's actual top bar document — the top-bar.nctxml
  from Slice 3 does not include it. Composing the real bar
  from furniture + attention item is shell-assembly work.
