"""The emergency TUI (plans/SYSTEM-INTERFACE.md §5): full-screen,
menu-driven — arrow keys and numbers, no commands to recall —
for when even the recovery graphics cannot run. The shell is the
LAST item, labelled as the manual option.

The menu model (RecoveryMenu) is separate from the curses
rendering so the repairs can be proven without a terminal; the
curses front-end is a thin shell over it. Both drive the same
backend the graphical environment will use.

Run: python3 recovery_tui.py [--fixture] [--receipts PATH]
"""

import sys

MENU = [
    ("startup", "Startup Repair"),
    ("rollback", "Driver Rollback"),
    ("packages", "Package Rescue"),
    ("snapshots", "Snapshots"),
    ("shell", "Shell (manual option)"),
    ("reboot", "Reboot"),
]


class RecoveryMenu:
    """The TUI's model: a screen is a list of text lines; keys
    move, select, confirm. Screens: menu / findings / confirm /
    result."""

    def __init__(self, backend):
        self.backend = backend
        self.screen = "menu"
        self.index = 0
        self.message = []
        self._pending = None      # (action, payload) awaiting y/n

    # -- rendering (as lines; curses draws them) -------------------
    def lines(self):
        if self.screen == "menu":
            out = ["NOCTIVAGOUS RECOVERY", "",
                   "This machine has failed to start %d times."
                   % self.backend.failed_boots,
                   "Choose a repair:", ""]
            for i, (_key, label) in enumerate(MENU):
                cursor = ">" if i == self.index else " "
                out.append("%s %d. %s" % (cursor, i + 1, label))
            return out
        return list(self.message)

    # -- keys ---------------------------------------------------------
    def key(self, k):
        if self.screen == "confirm":
            if k in ("y", "Y"):
                action, payload = self._pending
                self._pending = None
                self._do(action, payload)
            elif k in ("n", "N", "q"):
                self.screen, self.message = "menu", []
            return
        if self.screen != "menu":
            if k in ("q", "m", "\n", " "):
                self.screen, self.message = "menu", []
            return
        if k == "up":
            self.index = (self.index - 1) % len(MENU)
        elif k == "down":
            self.index = (self.index + 1) % len(MENU)
        elif k == "\n":
            self._select(MENU[self.index][0])
        elif k.isdigit() and 1 <= int(k) <= len(MENU):
            self.index = int(k) - 1
            self._select(MENU[self.index][0])

    def _select(self, action):
        b = self.backend
        if action == "startup":
            findings = b.startup_repair_scan()
            if not findings:
                self._show(["Startup Repair", "", "No problems found."])
                return
            lines = ["Startup Repair", ""]
            for f in findings:
                lines.append("- " + f["text"])
            lines.append("")
            lines.append("Apply all fixes? (y/n)")
            self._pending = ("fix-all", None)
            self.screen, self.message = "confirm", lines
        elif action == "rollback":
            pair = b.last_good_pair
            self._pending = ("rollback", None)
            self.screen = "confirm"
            self.message = [
                "Driver Rollback", "",
                "Return to the last kernel and driver that booted:",
                "  kernel %s, %s (%s)" % (pair["kernel"], pair["driver"],
                                          pair["booted"]),
                "", "Roll back? (y/n)"]
        elif action == "packages":
            self._do("packages", None)
        elif action == "snapshots":
            lines = ["Snapshots", ""]
            for s in b.snapshots:
                lines.append("- %s — %s" % (s["id"], s["label"]))
            lines.append("")
            lines.append("Restore the newest? (y/n)")
            self._pending = ("snapshot", b.snapshots[0]["id"])
            self.screen, self.message = "confirm", lines
        elif action == "shell":
            self._show(["Shell", "",
                        "A shell is the manual option: everything "
                        "the menu does can be done by hand there.",
                        "(In the live TUI this drops to /bin/sh.)"])
        elif action == "reboot":
            self._show(["Reboot", "", "The machine would reboot now."])

    def _do(self, action, payload):
        b = self.backend
        if action == "fix-all":
            done = [b.apply_fix(f["id"]) for f in b.startup_repair_scan()]
            self._show(["Startup Repair — done", ""] + done)
        elif action == "rollback":
            pair = b.driver_rollback()
            self._show(["Driver Rollback — done", "",
                        "The next boot uses kernel %s, %s."
                        % (pair["kernel"], pair["driver"])])
        elif action == "packages":
            done = b.package_rescue()
            blocked = b.remove_package("nct-desktop-core")
            self._show(["Package Rescue — done", ""] + done +
                       ["", "Refused: " + blocked["reason"]])
        elif action == "snapshot":
            snap = b.restore_snapshot(payload)
            self._show(["Snapshots — done", "",
                        "Restored: " + snap["label"]])

    def _show(self, lines):
        self.screen, self.message = "result", lines


def run_curses(backend):  # pragma: no cover - interactive front-end
    import curses

    def main(stdscr):
        curses.curs_set(0)
        menu = RecoveryMenu(backend)
        while True:
            stdscr.clear()
            for i, line in enumerate(menu.lines()):
                stdscr.addstr(i, 0, line[:79])
            stdscr.refresh()
            ch = stdscr.getch()
            if ch == curses.KEY_UP:
                menu.key("up")
            elif ch == curses.KEY_DOWN:
                menu.key("down")
            elif ch in (10, 13):
                menu.key("\n")
            elif ch < 256:
                menu.key(chr(ch))

    curses.wrapper(main)


def main(argv):
    from recovery_backend import FixtureBackend, Receipts
    receipts = Receipts(argv[argv.index("--receipts") + 1]
                        if "--receipts" in argv else None)
    backend = FixtureBackend(receipts=receipts)
    run_curses(backend)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
