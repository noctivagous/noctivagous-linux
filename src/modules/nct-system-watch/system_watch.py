"""nct-system-watch — issues float up, with a way out
(plans/SYSTEM-INTERFACE.md §3).

A watcher, not a manager: it owns no system state, it triages
what the bridge reports. It runs as its own service, OUTSIDE the
shell process, so the reporter survives the failure it is
reporting (the DrKonqi lesson).

An Issue is a standing item — not a log line, not a toast — with
a state (new / acknowledged / fix offered / resolved /
dismissed), held in one Attention inbox until resolved or
dismissed, never suppressed after being shown once. Each Issue
carries its way out: a Fix where one exists, an Open fix-link
into the exact panel, and a Report bundle the user sees first.

Slice B scope: the two loudest silences — failed units and
coredumps. Later sources (SMART, DKMS, firmware, conflicts)
join through the same feed as their bridge domains land.

The watch consumes desktop-bus events (the shapes
nct-linux-sys-interface republishes) plus crash events of the
shape the bridge's crashes domain will publish:
  {"event": "crash", "binary": "...", "app": "...", "signal": 11}
"""

import json
import os
from datetime import datetime, timezone

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
JOURNAL_SLICE = 5  # journal entries kept as evidence per unit


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class SystemWatch:
    def __init__(self, store_path=None, tree_get=None, now=_now):
        self.store_path = store_path
        self._tree_get = tree_get          # fn(path) -> props | None
        self._now = now
        self.issues = {}                   # key -> Issue dict
        self._journal = {}                 # unit -> [entries]
        if store_path and os.path.exists(store_path):
            with open(store_path, encoding="utf-8") as f:
                self.issues = json.load(f)

    # -- persistence --------------------------------------------------
    def save(self):
        if not self.store_path:
            return
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(self.issues, f, indent=1, sort_keys=True)

    # -- the feed -------------------------------------------------------
    def feed(self, event):
        kind = event.get("event")
        if kind == "journal.entry":
            unit = event.get("unit", "")
            entries = self._journal.setdefault(unit, [])
            entries.append({"priority": event.get("priority", 6),
                            "message": event.get("message", "")})
            del entries[:-JOURNAL_SLICE]
            # Evidence is a living slice: the journal line that
            # explains a failure usually arrives AFTER the failure
            # event itself, so an open Issue keeps collecting its
            # unit's entries.
            issue = self.issues.get("unit-failed:" + unit)
            if issue and issue["state"] not in ("resolved", "dismissed"):
                issue["evidence"]["journal"] = list(entries)
        elif kind == "unit.changed":
            if event.get("health") == "failed":
                self._unit_failed(event["unit"])
            elif event.get("health") == "ok":
                self._resolve("unit-failed:" + event["unit"],
                              "the service is running again")
        elif kind == "crash":
            self._crash(event)
        self.save()

    # -- triage ---------------------------------------------------------
    def _unit_failed(self, unit):
        key = "unit-failed:" + unit
        issue = self.issues.get(key)
        if issue and issue["state"] not in ("resolved", "dismissed"):
            issue["occurrences"] += 1
            issue["last_seen"] = self._now()
            issue["history"].append("failed again")
            return
        description = unit
        if self._tree_get:
            node = self._tree_get("/units/" + unit) or {}
            description = node.get("description") or unit
        self.issues[key] = {
            "key": key, "kind": "unit-failed", "subject": unit,
            "title": "%s failed" % description,
            "state": "new", "severity": "high",
            "since": self._now(), "last_seen": self._now(),
            "occurrences": 1,
            "evidence": {"journal": list(self._journal.get(unit, []))},
            "actions": [
                {"type": "fix", "action": "restart-unit", "unit": unit,
                 "label": "Restart the service"},
                {"type": "open", "target": "service:" + unit,
                 "label": "Open the service"},
                {"type": "report", "label": "Report…"},
            ],
            "history": ["raised"],
        }

    def _crash(self, event):
        binary = event.get("binary", "unknown")
        key = "crash:" + binary
        issue = self.issues.get(key)
        if issue and issue["state"] not in ("resolved", "dismissed"):
            issue["occurrences"] += 1
            issue["last_seen"] = self._now()
            issue["history"].append("crashed again")
            return
        app = event.get("app") or binary
        self.issues[key] = {
            "key": key, "kind": "crash", "subject": binary,
            "title": "%s crashed" % app,
            "state": "new", "severity": "high",
            "since": self._now(), "last_seen": self._now(),
            "occurrences": 1,
            "evidence": {"signal": event.get("signal"),
                         "journal": list(self._journal.get(binary, []))},
            "actions": [
                {"type": "report", "label": "Report…"},
                {"type": "open", "target": "app:" + binary,
                 "label": "Open the app"},
            ],
            "history": ["raised"],
        }

    def _resolve(self, key, how):
        issue = self.issues.get(key)
        if issue and issue["state"] not in ("resolved", "dismissed"):
            issue["state"] = "resolved"
            issue["history"].append("resolved: " + how)
            issue["last_seen"] = self._now()

    # -- the inbox ------------------------------------------------------
    def inbox(self):
        """Open Issues, severity-ordered. Resolved and dismissed
        Issues stay in the store as history; they leave the inbox."""
        open_issues = [i for i in self.issues.values()
                       if i["state"] not in ("resolved", "dismissed")]
        return sorted(open_issues,
                      key=lambda i: (SEVERITY_ORDER[i["severity"]], i["since"]))

    def acknowledge(self, key):
        issue = self.issues.get(key)
        if issue and issue["state"] == "new":
            issue["state"] = "acknowledged"
            issue["history"].append("acknowledged")
            self.save()
        return issue

    def dismiss(self, key, reason):
        issue = self.issues.get(key)
        if issue:
            issue["state"] = "dismissed"
            issue["history"].append("dismissed: " + reason)
            self.save()
        return issue

    # -- the way out ------------------------------------------------------
    def report_bundle(self, key):
        """The diagnostics bundle for an Issue — assembled from the
        Issue's own evidence only, and returned for the user to see
        (and trim) before anything is sent. Nothing is sent here."""
        issue = self.issues[key]
        bundle = {
            "issue": {k: issue[k] for k in
                      ("key", "kind", "title", "since", "occurrences")},
            "journal_slice": issue["evidence"].get("journal", []),
        }
        if issue["kind"] == "unit-failed" and self._tree_get:
            bundle["unit_now"] = self._tree_get("/units/" + issue["subject"])
        if issue["kind"] == "crash":
            bundle["signal"] = issue["evidence"].get("signal")
        return bundle
