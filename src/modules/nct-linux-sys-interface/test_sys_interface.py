"""Slice A harness: the bridge, proven against the fixture feed.

The fixture replays through the same ingest path the live systemd
source uses. What is proven: the tree mirrors the system, changes
republish in desktop terms in order, journal entries attach to
their units, and the live backend reports its availability
honestly. What is NOT proven: a live systemd (none runs here) —
that is a rig proof, owed.

Prints SLICEA_OK and exits 0, or SLICEA_FAIL <reason> and exits 1.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sources import FixtureSource, SystemdSource
from sys_interface import SysInterface

HERE = os.path.dirname(os.path.abspath(__file__))
failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


def main():
    bridge = SysInterface()
    events = []
    bridge.on_bus(events.append)
    src = FixtureSource(os.path.join(HERE, "fixtures", "systemd-journal.jsonl"))
    check(bridge.attach(src), "fixture source not available")

    # Pump in two stages to prove the tree is LIVE, not a snapshot:
    # after 6 events bluetooth is still running...
    bridge.pump(6)
    bt = bridge.tree.get("/units/bluetooth.service")
    check(bt is not None and bt["health"] == "ok",
          "stage 1: bluetooth should be ok, got %r" % (bt,))
    check(bridge.failed_units() == [], "stage 1: no unit should be failed")

    # ...the remaining events fail it, and the bus says so in order.
    bridge.pump()
    bt = bridge.tree.get("/units/bluetooth.service")
    check(bt["health"] == "failed" and bt["result"] == "exit-code",
          "stage 2: bluetooth should be failed/exit-code, got %r" % (bt,))
    check(bridge.failed_units() == ["bluetooth.service"],
          "failed_units wrong: %r" % (bridge.failed_units(),))

    health_events = [e for e in events
                     if e["event"] == "unit.changed" and e["unit"] == "bluetooth.service"]
    check([e["health"] for e in health_events] == ["ok", "failed"],
          "bus health sequence wrong: %r" % (health_events,))

    units = bridge.tree.children("/units")
    check(sorted(units) == ["NetworkManager.service", "bluetooth.service",
                            "cups.service", "greetd.service"],
          "tree units wrong: %r" % (sorted(units),))
    check(units["cups.service"]["health"] == "off",
          "inactive unit should read 'off' in desktop terms")

    journal = bridge.tree.get("/journal/bluetooth.service")
    check(journal is not None and len(journal["entries"]) == 2,
          "bluetooth journal should hold 2 entries")
    err = [e for e in journal["entries"] if e["priority"] == 3]
    check(len(err) == 1 and "adapter not responding" in err[0]["message"],
          "the priority-3 journal entry is missing or wrong")

    # The live backend, honestly: unavailable in this sandbox.
    ok, detail = SystemdSource().available()
    check(ok is False and "gi" in detail,
          "systemd backend should report unavailable (no python3-gi): %r %r"
          % (ok, detail))

    snap = bridge.snapshot()
    check(snap["backend"]["name"] == "fixture", "snapshot backend wrong")

    if failures:
        for f in failures:
            print("SLICEA_FAIL", f)
        return 1
    print("SLICEA_OK units=%d events=%d" % (len(units), len(events)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
