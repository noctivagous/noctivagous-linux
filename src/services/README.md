# services/ — session services that are not Godot

Marker: NCT-WL-BRIDGE (bridge/) — services cross between the compositor
world and the kit world with the apps' cooperation, by definition.

- bridge/ — nct-greetd-bridge.py: greetd IPC <-> TCP line protocol, so
  the Godot greeter can authenticate and start a session. Protocol and
  rationale are in the file's header. ASSUMPTION A3 lives here.
