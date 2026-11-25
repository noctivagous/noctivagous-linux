# core/ — NCT-LIB-EXT-CORE

Marker: NCT-WL-COMPOSITOR. The foundation layer: compositor slot and
session glue. Nothing in this layer knows what Godot is; the Godot layer
is a client of it like any other.

- compositor/ — the compositor slot (stand-in: labwc) and its config.
- session/ — greeter session, user session, session-apps, the launch
  list and the launcher. The chain lives here: ARCHITECTURE.md §"The chain".
