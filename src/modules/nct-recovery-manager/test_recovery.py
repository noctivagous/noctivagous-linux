"""Slice D harness: the recovery TUI's menu model driven through
every repair, the boot entry's consistency with the code, and a
pty smoke test of the real curses front-end.

Proven here: the repairs work against the fixture backend,
receipts are written (they are the System Changes feed), the
desktop-core removal is refused, the auto-offer rule fires at
the threshold, and the boot entry carries the exact kernel
parameter the code looks for. NOT proven: booting into recovery
— a rig proof, owed (agent-build-log/22).

Prints SLICED_OK / SLICED_FAIL <reason>.
"""

import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from recovery_backend import (FAILED_BOOT_THRESHOLD, RECOVERY_PARAM,
                              FixtureBackend, Receipts,
                              should_offer_recovery)
from recovery_tui import MENU, RecoveryMenu

failures = []


def check(cond, what):
    if not cond:
        failures.append(what)


def drive(menu, *keys):
    for k in keys:
        menu.key(k)


def main():
    receipts_path = os.path.join(tempfile.mkdtemp(), "receipts.jsonl")
    backend = FixtureBackend(receipts=Receipts(receipts_path))
    menu = RecoveryMenu(backend)

    # The menu: six items, shell last-but-one and labelled manual.
    labels = [label for _k, label in MENU]
    check(len(MENU) == 6 and labels[4].startswith("Shell"),
          "menu shape wrong: %r" % (labels,))
    check("failed to start 3 times" in "\n".join(menu.lines()),
          "menu does not state the failed-boot count")

    # Startup Repair: findings shown, confirm, all fixed.
    drive(menu, "1", "y")
    check(len(backend.fixed) == 3, "startup repair fixed %r" % (backend.fixed,))
    check(backend.startup_repair_scan() == [], "findings remain after repair")

    # Driver Rollback: confirm screen names the last good pair.
    drive(menu, "q", "2")
    text = "\n".join(menu.lines())
    check("kernel 6.8" in text and "nvidia 550" in text,
          "rollback screen does not name the last good pair")
    drive(menu, "y")
    check(backend.rolled_back_to["kernel"] == "6.8", "rollback did not apply")

    # Package Rescue: interrupted config finished, stale lock
    # cleared; the desktop-core refusal is part of the flow.
    drive(menu, "q", "3")
    text = "\n".join(menu.lines())
    check("finished configuring linux-image-6.9" in text, "rescue missed config")
    check("stale lock" in text, "rescue missed the stale lock")
    check("Refused" in text and "core set" in text,
          "desktop-core refusal not shown: %r" % text)
    check(backend.remove_package("cups")["ok"] is True,
          "a non-core removal should be allowed")

    # Snapshots: restore the newest.
    drive(menu, "q", "4", "y")
    check(backend.restored["id"] == "snap-2026-11-25", "snapshot not restored")

    # Receipts: every repair wrote one — the System Changes feed.
    with open(receipts_path, encoding="utf-8") as f:
        receipts = [json.loads(line) for line in f if line.strip()]
    actions = [r["action"] for r in receipts]
    for expected in ("startup-repair", "driver-rollback",
                     "package-rescue", "snapshot-restore"):
        check(expected in actions, "no receipt for %s: %r" % (expected, actions))
    check(all(r["where"] == "recovery" for r in receipts),
          "receipts must be marked as recovery repairs")

    # The auto-offer rule (§5): at the threshold, not before.
    check(should_offer_recovery(FAILED_BOOT_THRESHOLD) is True,
          "recovery should be offered at the threshold")
    check(should_offer_recovery(FAILED_BOOT_THRESHOLD - 1) is False,
          "recovery should not be offered below the threshold")
    check(should_offer_recovery(backend.failed_boots) is True,
          "the fixture machine (3 failed boots) should be offered recovery")

    # Boot entry consistency: the entry carries the parameter the
    # code looks for, the recovery target, and the title.
    with open(os.path.join(HERE, "boot", "nct-recovery.conf"),
              encoding="utf-8") as f:
        entry = f.read()
    check(RECOVERY_PARAM in entry, "boot entry lacks " + RECOVERY_PARAM)
    check("nct-recovery.target" in entry, "boot entry lacks the recovery target")
    check("title" in entry and "Recovery" in entry, "boot entry lacks a title")

    pty_smoke()

    if failures:
        for f in failures:
            print("SLICED_FAIL", f)
        return 1
    print("SLICED_OK")
    return 0


def pty_smoke():
    """The real curses front-end in a pty: the menu renders, the
    rollback flow runs, and the receipt lands on disk."""
    import pty
    import select
    import time

    receipts_path = os.path.join(tempfile.mkdtemp(), "pty-receipts.jsonl")
    pid, fd = pty.fork()
    if pid == 0:  # child
        os.environ["TERM"] = "xterm"
        os.execvp(sys.executable, [sys.executable,
                                   os.path.join(HERE, "recovery_tui.py"),
                                   "--receipts", receipts_path])
    output = b""

    def drain(seconds):
        nonlocal output
        end = time.time() + seconds
        while time.time() < end:
            r, _w, _x = select.select([fd], [], [], 0.2)
            if r:
                try:
                    chunk = os.read(fd, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                output += chunk

    try:
        drain(2.0)
        check(b"NOCTIVAGOUS RECOVERY" in output, "pty: menu did not render")
        check(b"Driver Rollback" in output, "pty: menu items missing")
        os.write(fd, b"2")
        drain(1.0)
        check(b"kernel 6.8" in output, "pty: rollback screen missing")
        os.write(fd, b"y")
        drain(1.0)
        check(b"Driver Rollback" in output and b"done" in output,
              "pty: rollback did not complete")
    finally:
        try:
            os.write(fd, b"\x03")
        except OSError:
            pass
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass
        os.close(fd)
    if os.path.exists(receipts_path):
        with open(receipts_path, encoding="utf-8") as f:
            check("driver-rollback" in f.read(),
                  "pty: rollback receipt not written")
    else:
        check(False, "pty: no receipts file written")


if __name__ == "__main__":
    sys.exit(main())
