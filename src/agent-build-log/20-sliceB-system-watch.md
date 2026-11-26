# 20 — System-interface Slice B: system-watch triage

Date: 2026-11-26. Asked by: the owner ("Run A–D without
interruption"). Same worktree/branch as log 19. Scope:
plans/SYSTEM-INTERFACE.md §6 Slice B — triage for the two
loudest silences: failed units and coredumps → Issues in an
Attention inbox, each with Open / Report actions (and a Fix
where one exists).

## What was built (src/modules/nct-system-watch/)

- system_watch.py — SystemWatch, a standalone Python service
  (outside the shell, per §3: the reporter must survive the
  failure). It consumes the desktop-bus events the Slice A
  bridge republishes, plus crash events in the shape the
  bridge's crashes domain will publish. Issues are standing
  items with the §3 shape: plain-language title (taken from
  the tree's description), state (new / acknowledged / fix
  offered / resolved / dismissed), severity, since, occurrence
  count, evidence, actions (Fix restart-unit / Open fix-link /
  Report), and a history. Dedupe is by cause: a second failure
  updates the same Issue. Recovery resolves the Issue out of
  the inbox while it stays in the store as history. The store
  is a JSON file, written on every change. report_bundle()
  assembles the diagnostics bundle from the Issue's own
  evidence only and returns it for the user to see first —
  nothing is sent anywhere.
- test_system_watch.py — the harness, driving the REAL Slice A
  bridge (fixture feed) rather than a mock of it. One additive
  tier-0 check.

## A design point the fixture exposed

The journal line that explains a failure arrives AFTER the
failure event (in the fixture, as in life: the unit fails,
then its daemon's last words land). Evidence is therefore a
LIVING slice: an open Issue keeps collecting its unit's
journal entries after it is raised. The first harness run
failed on exactly this; the fix is in the feed, not the test.

## Evidence

- SLICEB_OK. One open Issue from the fixture's failure, titled
  "Bluetooth service failed" (the tree's description, not the
  unit id), carrying Fix + Open + Report and the "adapter not
  responding" line in its evidence. Second failure → same
  Issue, occurrences 2. Acknowledge holds it in the inbox;
  recovery resolves it out, retained as resolved history.
  Crash event → its own Issue; its report bundle carries the
  signal (11) and the title "NCT Hello crashed". A fresh watch
  over the same store sees the same state (persistence).
  Dismissal leaves the inbox with its reason recorded in the
  Issue's history.

## What this does not show

- The Attention inbox as a surface (a bar item / panel) is not
  built — the inbox here is the watch's data, severity-ordered,
  ready for a view. The crash feed is the event SHAPE, not a
  real coredump source: systemd-coredump joins when the
  bridge's crashes domain lands. Later sources (SMART, DKMS,
  firmware, conflicts) join the same feed per the plan.
