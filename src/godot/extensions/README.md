# godot/extensions — GDExtension modules

Marker: NCT-LIB-EXT-CORE (the Godot layer's foundation depends on these).
Native modules the pinned runtime loads: D-Bus client (the master key to
system services), layer-shell client extras, PipeWire routing — specced
in demo-de/GODOT-SYSTEM.md §4. None built in the foundation run; this
directory is their slot, and tests/vm/ASSUMPTIONS.md tracks the
layer-shell gap (A4) they exist to close.
