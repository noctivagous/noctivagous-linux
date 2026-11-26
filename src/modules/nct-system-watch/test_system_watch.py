"""Slice B harness: system-watch triage, proven on the real
Slice A bridge (fixture feed) plus crash events in the shape the
bridge's crashes domain will publish.

Proven: a failed unit becomes ONE standing Issue with a plain
title, its journal slice attached, and Fix/Open/Report actions;
failing again updates the same Issue; recovery resolves it; a
crash becomes an Issue whose report bundle carries the signal
and the journal slice; the store persists across a restart of
the watch; dismissal records its reason.

Prints SLICEB_OK and exits 0, or SLICEB_FAIL <reason>, exit 1.
"""

import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "nct-linux-sys-interface"))

from sources import FixtureSource          # noqa: E402
from sys_interface import SysInterface     # noqa: E402
from system_watch import SystemWatch       # noqa: E402

failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


def main():
    store = os.path.join(tempfile.mkdtemp(), "issues.json")
    bridge = SysInterface()
    bridge.attach(FixtureSource(os.path.join(
        HERE, "..", "nct-linux-sys-interface", "fixtures",
        "systemd-journal.jsonl")))
    watch = SystemWatch(store_path=store, tree_get=bridge.tree.get)
    bridge.on_bus(watch.feed)
    bridge.pump()

    inbox = watch.inbox()
    check(len(inbox) == 1, "expected exactly 1 open Issue, got %d" % len(inbox))
    issue = inbox[0]
    check(issue["kind"] == "unit-failed" and issue["subject"] == "bluetooth.service",
          "wrong Issue: %r" % (issue["key"],))
    check(issue["title"] == "Bluetooth service failed",
          "title not in plain language from the tree: %r" % (issue["title"],))
    check(issue["state"] == "new" and issue["occurrences"] == 1,
          "Issue state/occurrences wrong")
    actions = {a["type"] for a in issue["actions"]}
    check(actions == {"fix", "open", "report"},
          "Issue must carry Fix + Open + Report, got %r" % (actions,))
    journal = issue["evidence"]["journal"]
    check(any("adapter not responding" in e["message"] for e in journal),
          "journal slice not attached to the Issue")

    # Failing again updates the SAME Issue (dedupe by cause).
    watch.feed({"event": "unit.changed", "unit": "bluetooth.service",
                "health": "failed", "active": "failed"})
    check(len(watch.inbox()) == 1 and watch.inbox()[0]["occurrences"] == 2,
          "second failure did not dedupe into the same Issue")

    # Acknowledge keeps it in the inbox; recovery resolves it out.
    watch.acknowledge(issue["key"])
    check(watch.inbox()[0]["state"] == "acknowledged", "acknowledge lost")
    watch.feed({"event": "unit.changed", "unit": "bluetooth.service",
                "health": "ok", "active": "active"})
    check(watch.inbox() == [], "recovered unit's Issue should leave the inbox")
    check(watch.issues[issue["key"]]["state"] == "resolved",
          "Issue should remain in the store as resolved history")

    # A crash: its own Issue, report bundle with signal + slice.
    watch.feed({"event": "crash", "binary": "nct-hello", "app": "NCT Hello",
                "signal": 11})
    inbox = watch.inbox()
    check(len(inbox) == 1 and inbox[0]["kind"] == "crash",
          "crash did not raise an Issue")
    bundle = watch.report_bundle(inbox[0]["key"])
    check(bundle["signal"] == 11 and bundle["issue"]["title"] == "NCT Hello crashed",
          "report bundle wrong: %r" % (bundle,))

    # Persistence: a fresh watch over the same store sees history.
    watch2 = SystemWatch(store_path=store)
    check(watch2.issues[issue["key"]]["state"] == "resolved"
          and len(watch2.inbox()) == 1,
          "store did not survive a restart of the watch")

    # Dismissal records its reason and leaves the inbox.
    watch.dismiss(inbox[0]["key"], "known problem, fixed upstream")
    check(watch.inbox() == [], "dismissed Issue should leave the inbox")
    check("dismissed: known problem" in watch.issues[inbox[0]["key"]]["history"][-1],
          "dismissal reason not recorded")

    if failures:
        for f in failures:
            print("SLICEB_FAIL", f)
        return 1
    print("SLICEB_OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
