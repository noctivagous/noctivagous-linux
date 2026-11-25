# keyclicks/ — the key-click input policy (native)

Marker: NCT-WL-COMPOSITOR (input policy lives in the compositor — that
is what makes the operators work over foreign windows too).
The demo's key-click subsystem (demo-de/src/keyclicks/) is the model:
addressing algebra, board, engine, operating on surfaces through the
compositor. The native port lands here when the real compositor does;
the foundation run does not port it, and the launch chain does not
depend on it. Rules it must keep are in demo-de/KEYCLICKS-AUDIT.md.
