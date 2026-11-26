"""Sources for the bridge (plans/SYSTEM-INTERFACE.md §1).

A source feeds raw system facts into the bridge. Two kinds:

- FixtureSource replays a recorded JSONL event stream through the
  exact path a live source uses — how the skeleton is proven in
  environments with no running systemd (this sandbox included).
- SystemdSource is the live backend: systemd over Gio/GDBus
  (Subscribe + ListUnits + PropertiesChanged) and a journal
  follow. It reports its availability honestly; where python3-gi
  is absent it is unavailable, and the bridge says so instead of
  silently reflecting nothing.

Event shapes (what a source emits):
  {"type": "unit",    "id": "greetd.service", "props": {...}}
  {"type": "journal", "unit": "greetd.service", "priority": 6,
   "message": "...", "message_id": "..." (optional)}
  {"type": "coredump", "id": "coredump-1042",
   "binary": "/opt/nct/apps/nct-hello", "app": "NCT Hello",
   "signal": 11, "pid": 1042, "when": "2026-11-26T05:58:11Z"}

CoredumpSource is the live crashes backend (systemd-coredump,
via coredumpctl's data). Like SystemdSource it reports its
availability honestly rather than reflecting nothing.
"""

import shutil

import json


class FixtureSource:
    name = "fixture"

    def __init__(self, path):
        self.path = path
        self.events = []
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    self.events.append(json.loads(line))

    def available(self):
        return True, "recorded fixture stream"

    def pump(self, emit, count=None):
        """Emit up to `count` events (all of them by default)."""
        n = 0
        while self.events and (count is None or n < count):
            emit(self.events.pop(0))
            n += 1
        return n


class CoredumpSource:
    name = "systemd-coredump"

    def available(self):
        if shutil.which("coredumpctl") is None:
            return False, "coredumpctl not present on this machine"
        return True, "systemd-coredump via coredumpctl"

    def pump(self, emit, count=None):
        # The live pump follows coredump arrivals (the daemon
        # watches the coredump journal fields); like the systemd
        # source it is driven by the bridge daemon's serve loop,
        # not by tests.
        raise NotImplementedError(
            "live coredump pump runs under the bridge daemon's serve()")


class SystemdSource:
    name = "systemd"

    def available(self):
        try:
            import gi  # noqa: F401
        except ImportError:
            return False, "python3-gi not present on this machine"
        return True, "systemd via Gio/GDBus"

    def pump(self, emit, count=None):
        # The live pump subscribes (Manager.Subscribe) and follows
        # the journal; it runs an event loop rather than draining a
        # queue, so it is driven by serve(), not by tests. The
        # skeleton keeps the subscription wiring in start_live().
        raise NotImplementedError(
            "live systemd pump runs under serve(); see start_live()")

    def start_live(self, emit):  # pragma: no cover - needs a live systemd
        import gi
        gi.require_version("Gio", "2.0")
        from gi.repository import Gio, GLib

        bus = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)

        def call(method, params, reply_type):
            return bus.call_sync(
                "org.freedesktop.systemd1", "/org/freedesktop/systemd1",
                "org.freedesktop.systemd1.Manager", method, params,
                reply_type, Gio.DBusCallFlags.NONE, -1, None)

        # Subscribe first, then take the initial unit list: the
        # order that cannot miss a change (SYSTEM-INTERFACE §1.1).
        call("Subscribe", None, None)
        units = call("ListUnits", None, GLib.VariantType("(a(ssssssouso))"))
        for u in units.unpack()[0]:
            emit({"type": "unit", "id": u[0], "props": {
                "description": u[1], "load": u[2], "active": u[3],
                "sub": u[4], "job": u[5]}})
        # PropertiesChanged / UnitNew signals drive emit() from the
        # main loop in the shipped daemon; the skeleton's serve()
        # owns that loop.
        return GLib.MainLoop()
