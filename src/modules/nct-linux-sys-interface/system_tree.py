"""The live system object tree (plans/SYSTEM-INTERFACE.md §1 rule 2).

Mirror, don't copy: the tree holds the bridge's reflection of the
system — units, journal streams, devices, power — and views render
from it, so a view can never drift out of sync with the system.
Nodes are addressed by path (/units/greetd.service); every update
notifies subscribers with the path and the new properties.
"""


class SystemTree:
    def __init__(self):
        self._nodes = {}          # path -> dict of properties
        self._subscribers = []    # fn(path, props)

    def subscribe(self, fn):
        self._subscribers.append(fn)

    def update(self, path, props):
        node = self._nodes.setdefault(path, {})
        node.update(props)
        for fn in self._subscribers:
            fn(path, dict(node))
        return node

    def get(self, path):
        node = self._nodes.get(path)
        return dict(node) if node is not None else None

    def children(self, prefix):
        """Immediate children of a path prefix: {name: props}."""
        out = {}
        cut = len(prefix) + 1
        for path, props in self._nodes.items():
            if path.startswith(prefix + "/"):
                rest = path[cut:]
                if "/" not in rest:
                    out[rest] = dict(props)
        return out

    def paths(self):
        return sorted(self._nodes)

    def snapshot(self):
        return {p: dict(props) for p, props in sorted(self._nodes.items())}
