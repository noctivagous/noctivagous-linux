"""The recovery backend (plans/SYSTEM-INTERFACE.md §5): the
repairs, behind one interface, so the emergency TUI and the
later graphical environment run the SAME repairs and raise the
SAME receipts — a repair done in recovery appears in System
Changes when the desktop next starts.

Slice D scope (§6): boot entry + emergency TUI. The backend here
is the fixture (a recorded broken machine) plus a real backend
whose actions are the named system operations, guarded and not
exercised without a real machine to repair.

The boot entry (boot/nct-recovery.conf) boots the system with
RECOVERY_PARAM on the kernel command line; that parameter is
how the recovery stack knows to start.
"""

import json
import os
from datetime import datetime, timezone

RECOVERY_PARAM = "nct.recovery=1"
FAILED_BOOT_THRESHOLD = 3


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def should_offer_recovery(failed_boots, threshold=FAILED_BOOT_THRESHOLD):
    """Automatic entry (§5): after repeated failed boots, the
    next boot offers recovery first instead of looping."""
    return failed_boots >= threshold


class Receipts:
    def __init__(self, path=None):
        self.path = path
        self.items = []

    def add(self, action, detail):
        receipt = {"action": action, "detail": detail, "when": _now(),
                   "where": "recovery"}
        self.items.append(receipt)
        if self.path:
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(json.dumps(receipt) + "\n")
        return receipt


class FixtureBackend:
    """A recorded broken machine: three failed boots, an fstab
    entry that does not resolve, a nearly full disk, a stale
    package lock whose holder is gone, one interrupted package
    configuration, and a last kernel<->driver pair that booted."""

    name = "fixture"

    def __init__(self, receipts=None):
        self.receipts = receipts or Receipts()
        self.failed_boots = 3
        self.findings = [
            {"id": "fstab-mnt-data", "fixable": True,
             "text": "A mount in /etc/fstab (/mnt/data) points at a "
                     "disk that is not present; boot waits on it."},
            {"id": "disk-full", "fixable": True,
             "text": "The system disk is 98% full; updates and "
                     "logins need space."},
            {"id": "failed-service", "fixable": True,
             "text": "bluetooth.service failed to start."},
        ]
        self.fixed = []
        self.last_good_pair = {"kernel": "6.8", "driver": "nvidia 550",
                               "booted": "the last successful boot"}
        self.rolled_back_to = None
        self.snapshots = [
            {"id": "snap-2026-11-25", "label": "Before the kernel update"},
            {"id": "snap-2026-11-20", "label": "Weekly snapshot"},
        ]
        self.restored = None
        self.lock = {"path": "/var/lib/dpkg/lock", "holder_alive": False}
        self.interrupted_config = ["linux-image-6.9"]
        self.desktop_core = {"nct-desktop-core", "greetd", "labwc"}

    # -- Startup Repair ---------------------------------------------
    def startup_repair_scan(self):
        return [f for f in self.findings if f["id"] not in self.fixed]

    def apply_fix(self, finding_id):
        finding = next(f for f in self.findings if f["id"] == finding_id)
        self.fixed.append(finding_id)
        self.receipts.add("startup-repair", finding["text"])
        return "Fixed: " + finding["text"]

    # -- Driver Rollback ----------------------------------------------
    def driver_rollback(self):
        self.rolled_back_to = dict(self.last_good_pair)
        self.receipts.add("driver-rollback",
                          "kernel %s, %s" % (self.last_good_pair["kernel"],
                                              self.last_good_pair["driver"]))
        return self.rolled_back_to

    # -- Package Rescue -------------------------------------------------
    def package_rescue(self):
        done = []
        for pkg in self.interrupted_config:
            done.append("finished configuring " + pkg)
            self.receipts.add("package-rescue", "finished configuring " + pkg)
        if self.lock and not self.lock["holder_alive"]:
            done.append("cleared the stale lock at %s (its holder is gone)"
                        % self.lock["path"])
            self.receipts.add("package-rescue", "cleared stale lock")
            self.lock = None
        return done

    def remove_package(self, name):
        """Removing a package the desktop depends on is BLOCKED,
        with the reason — never a silent break (§5)."""
        if name in self.desktop_core:
            return {"ok": False,
                    "reason": "%s is part of the desktop's core set; "
                              "removing it would break the desktop." % name}
        self.receipts.add("package-rescue", "removed " + name)
        return {"ok": True, "reason": "removed " + name}

    # -- Snapshots -------------------------------------------------------
    def restore_snapshot(self, snapshot_id):
        snap = next(s for s in self.snapshots if s["id"] == snapshot_id)
        self.restored = snap
        self.receipts.add("snapshot-restore", snap["label"])
        return snap


class RealBackend:  # pragma: no cover - needs a real broken machine
    """The same repairs against the real system. Each action is
    the named operation from the plan; they run only inside the
    recovery environment, never from a test."""

    name = "real"

    def __init__(self, receipts=None):
        self.receipts = receipts or Receipts()
        raise NotImplementedError(
            "the real recovery backend runs in the recovery "
            "environment (Slice D follow-up); the TUI and the "
            "graphical environment share the fixture-proven "
            "interface until then")
