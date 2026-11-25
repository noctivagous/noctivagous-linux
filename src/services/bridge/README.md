# services/bridge — the greeter auth bridge

See nct-greetd-bridge.py's header for the protocol. One fact to keep:
the bridge is a session service, not part of the greeter — the greeter
is an ordinary Godot app that happens to be shown before login, and it
would work unchanged against any bridge speaking the same line protocol.
