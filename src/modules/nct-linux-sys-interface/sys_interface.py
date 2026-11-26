"""nct-linux-sys-interface — the bridge (plans/SYSTEM-INTERFACE.md §1).

The desktop's only channel to the Linux system. Sources feed raw
facts in; the bridge keeps the live system object tree and
republishes changes on the desktop bus in desktop terms — a unit's
health, not its D-Bus property bag. Nothing else in the desktop
opens its own connection to a system service.

Slice A scope: systemd units + journal. Breadth (2026-11-26):
the crashes domain (systemd-coredump) joins the tree at
/crashes/<id> and is republished in the exact event shape
nct-system-watch consumes — Slice B's crash feed is now the
bridge's, not a hand-fed shape. Other domains (power, network,
devices, packages, firmware, authority) join the same tree as
their sources land.

Run standalone:
  python3 sys_interface.py --fixture fixtures/systemd-journal.jsonl \
      --fixture fixtures/crashes.jsonl \
      --snapshot-out tree.json --events-out events.jsonl
"""

import json
import sys

from system_tree import SystemTree

JOURNAL_CAP = 200  # entries kept per unit in the tree


def unit_health(props):
    """A unit's state, in desktop terms."""
    active = props.get("active", "")
    if active == "failed":
        return "failed"
    if active == "active":
        return "ok"
    if active in ("activating", "deactivating"):
        return "changing"
    return "off"


class SysInterface:
    def __init__(self):
        self.tree = SystemTree()
        self._bus = []        # desktop-bus subscribers: fn(event dict)
        self.backend = {"name": None, "available": None, "detail": ""}

    # -- desktop bus ------------------------------------------------
    def on_bus(self, fn):
        self._bus.append(fn)

    def _publish(self, event):
        for fn in self._bus:
            fn(event)

    # -- sources ----------------------------------------------------
    def attach(self, source):
        ok, detail = source.available()
        self.backend = {"name": source.name, "available": ok, "detail": detail}
        self._source = source
        return ok

    def pump(self, count=None):
        return self._source.pump(self._ingest, count)

    # -- ingest: raw facts -> tree + desktop terms ------------------
    def _ingest(self, event):
        kind = event.get("type")
        if kind == "unit":
            unit = event["id"]
            props = dict(event.get("props", {}))
            props["health"] = unit_health(props)
            self.tree.update("/units/" + unit, props)
            self._publish({"event": "unit.changed", "unit": unit,
                           "health": props["health"],
                           "active": props.get("active", "")})
        elif kind == "journal":
            unit = event.get("unit", "")
            path = "/journal/" + unit if unit else "/journal"
            node = self.tree.get(path) or {"entries": []}
            entries = list(node.get("entries", []))
            entries.append({"priority": event.get("priority", 6),
                            "message": event.get("message", ""),
                            "message_id": event.get("message_id", "")})
            self.tree.update(path, {"entries": entries[-JOURNAL_CAP:]})
            self._publish({"event": "journal.entry", "unit": unit,
                           "priority": event.get("priority", 6),
                           "message": event.get("message", "")})
        elif kind == "coredump":
            crash_id = event["id"]
            props = {"binary": event.get("binary", ""),
                     "app": event.get("app", ""),
                     "signal": event.get("signal"),
                     "pid": event.get("pid"),
                     "when": event.get("when", "")}
            self.tree.update("/crashes/" + crash_id, props)
            # Republished in the shape the watch's crash triage
            # consumes (SYSTEM-INTERFACE §3): the bridge is the
            # feed now, not a parallel channel.
            self._publish({"event": "crash", "crash_id": crash_id,
                           "binary": props["binary"],
                           "app": props["app"],
                           "signal": props["signal"]})

    # -- views over the tree ----------------------------------------
    def failed_units(self):
        return sorted(u for u, p in self.tree.children("/units").items()
                      if p.get("health") == "failed")

    def crashes(self):
        """Crash records by id: {id: {binary, app, signal, ...}}."""
        return self.tree.children("/crashes")

    def snapshot(self):
        return {"backend": self.backend, "tree": self.tree.snapshot()}


def main(argv):
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", required=True, action="append",
                    help="a fixture stream; repeat for several domains")
    ap.add_argument("--snapshot-out")
    ap.add_argument("--events-out")
    args = ap.parse_args(argv)

    from sources import FixtureSource
    bridge = SysInterface()
    events = []
    bridge.on_bus(events.append)
    for fixture in args.fixture:
        bridge.attach(FixtureSource(fixture))
        bridge.pump()
    if args.snapshot_out:
        with open(args.snapshot_out, "w", encoding="utf-8") as f:
            json.dump(bridge.snapshot(), f, indent=1, sort_keys=True)
    if args.events_out:
        with open(args.events_out, "w", encoding="utf-8") as f:
            for e in events:
                f.write(json.dumps(e) + "\n")
    print("sys-interface: backend=%s units=%d failed=%s crashes=%d" % (
        bridge.backend["name"],
        len(bridge.tree.children("/units")),
        ",".join(bridge.failed_units()) or "none",
        len(bridge.crashes())))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
