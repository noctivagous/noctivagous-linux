"""Breadth harness: the Attention inbox, end to end.

The bridge's two fixture streams (systemd/journal + coredumps)
flow through the watch's real feed; the inbox contexts are what
the shell surface renders. The crash Issue now originates from
the bridge's crashes domain — deduped by binary, so NCT Hello's
two coredumps are one Issue with two occurrences.

Prints INBOX_OK / INBOX_FAIL <reason>.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from inbox_snapshot import build_contexts

failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


def main():
    contexts = build_contexts()
    bar, issues = contexts["bar"], contexts["issues"]

    check(bar["OpenCount"] == 3, "expected 3 open issues: %r" % (bar,))
    check(bar["AttentionText"] == "Attention: 3 open",
          "bar text wrong: %r" % (bar,))

    titles = [i["Title"] for i in issues]
    check("Bluetooth service failed" in titles,
          "unit issue missing: %r" % (titles,))
    check("NCT Hello crashed" in titles, "crash issue missing: %r" % (titles,))
    check("Fake Browser crashed" in titles,
          "second crash issue missing: %r" % (titles,))

    hello = next(i for i in issues if i["Title"] == "NCT Hello crashed")
    check(hello["Occurrences"] == 2,
          "two coredumps of one binary must be ONE issue, twice: %r" % (hello,))
    check(hello["Actions"].startswith("Report"),
          "crash issue's way out should lead with Report: %r" % (hello,))

    unit = next(i for i in issues if i["Title"] == "Bluetooth service failed")
    check("Restart the service" in unit["Actions"]
          and "Open the service" in unit["Actions"]
          and "Report" in unit["Actions"],
          "unit issue must carry Fix + Open + Report: %r" % (unit,))
    check(all(i["Severity"] == "high" for i in issues),
          "fixture issues should all be high severity")

    if failures:
        for f in failures:
            print("INBOX_FAIL", f)
        return 1
    print("INBOX_OK issues=%d" % len(issues))
    return 0


if __name__ == "__main__":
    sys.exit(main())
