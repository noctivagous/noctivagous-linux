"""Drive the bridge's fixture streams through the watch and
write the Attention inbox contexts as JSON — the data the
shell's inbox surface renders (views/attention-*.nctxml).

This is the seam between the out-of-shell watch and the shell:
the watch publishes contexts; the shell renders them as views
over the watch's data, never a copy of the Issues themselves.

Run:
  python3 inbox_snapshot.py --contexts-out inbox-contexts.json
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BRIDGE = os.path.join(HERE, "..", "nct-linux-sys-interface")
sys.path.insert(0, HERE)
sys.path.insert(0, BRIDGE)

from sources import FixtureSource          # noqa: E402
from sys_interface import SysInterface     # noqa: E402
from system_watch import SystemWatch       # noqa: E402


def build_contexts():
    bridge = SysInterface()
    watch = SystemWatch(tree_get=bridge.tree.get)
    bridge.on_bus(watch.feed)
    for name in ("systemd-journal.jsonl", "crashes.jsonl"):
        bridge.attach(FixtureSource(os.path.join(BRIDGE, "fixtures", name)))
        bridge.pump()
    return watch.inbox_contexts()


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--contexts-out", required=True)
    args = ap.parse_args(argv)
    contexts = build_contexts()
    with open(args.contexts_out, "w", encoding="utf-8") as f:
        json.dump(contexts, f, indent=1, sort_keys=True)
    print("inbox: %s" % contexts["bar"]["AttentionText"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
