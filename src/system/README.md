# system/ — the installed-filesystem overlay

Every path here is the path on the installed machine (CONVENTIONS.md §1).
The VM provision copies this tree to / and then copies the runtime
pieces of ../ (core/session scripts, godot projects, bridge) into
/usr/lib/nct/. When a file exists in both forms, this copy is config
and the ../ copy is code — never the reverse.
