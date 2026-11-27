# services/bridge — the session's protocol bridges

Two bridges, one shape: each holds a protocol Godot cannot speak on
one side and a one-line TCP protocol on the other.

- nct-greetd-bridge.py — greetd IPC <-> lines on 127.0.0.1:7717, for
  the greeter. See its header for the protocol. One fact to keep:
  the bridge is a session service, not part of the greeter — the
  greeter is an ordinary Godot app that happens to be shown before
  login, and it would work unchanged against any bridge speaking
  the same line protocol.
- nct-wl-bridge.c — wlr-foreign-toplevel <-> lines on
  127.0.0.1:7718, for the shell's WindowTransformer stack (build
  log 36). See its header for the protocol, the fixture backend
  and the build commands. It is the tree's one compiled C
  artifact; build-deb.sh builds it from the vendored protocol
  XML beside it.
