"""Breadth harness: the crashes domain in the bridge.

A coredump fixture stream joins the systemd/journal stream in
ONE tree; crashes are republished on the desktop bus in the
exact shape nct-system-watch's triage consumes — the bridge is
the crash feed now (Slice B's hand-fed shape is retired).

Prints BRIDGE_CRASHES_OK / BRIDGE_CRASHES_FAIL <reason>.
"""

import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sources import CoredumpSource, FixtureSource
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
    for name in ("systemd-journal.jsonl", "crashes.jsonl"):
        bridge.attach(FixtureSource(os.path.join(HERE, "fixtures", name)))
        bridge.pump()

    # The domains coexist in one tree.
    check(len(bridge.tree.children("/units")) == 4,
          "units missing beside crashes")
    check(bridge.failed_units() == ["bluetooth.service"],
          "failed unit lost: %r" % (bridge.failed_units(),))

    # Crash records: all three coredumps, as recorded facts.
    crashes = bridge.crashes()
    check(sorted(crashes) == ["coredump-1042", "coredump-1177",
                              "coredump-1203"],
          "crash records wrong: %r" % (sorted(crashes),))
    first = crashes.get("coredump-1042", {})
    check(first.get("binary") == "/opt/nct/apps/nct-hello"
          and first.get("app") == "NCT Hello"
          and first.get("signal") == 11,
          "coredump-1042 props wrong: %r" % (first,))

    # Republication: the watch's shape, in fixture order.
    crash_events = [e for e in events if e.get("event") == "crash"]
    check([e["signal"] for e in crash_events] == [11, 6, 11],
          "crash events wrong: %r" % (crash_events,))
    check(all(e.get("binary") and e.get("app") and e.get("crash_id")
              for e in crash_events),
          "crash events missing fields: %r" % (crash_events,))

    # The live backend reports its availability honestly.
    ok, detail = CoredumpSource().available()
    check(isinstance(ok, bool) and isinstance(detail, str) and detail,
          "coredump availability malformed")
    check(ok == (shutil.which("coredumpctl") is not None),
          "coredump availability disagrees with the machine: %r %r"
          % (ok, detail))

    if failures:
        for f in failures:
            print("BRIDGE_CRASHES_FAIL", f)
        return 1
    print("BRIDGE_CRASHES_OK records=%d events=%d" % (len(crashes),
                                                      len(crash_events)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
