# godot/ — the Godot system layer

Marker: NCT-WL-KIT (kit, apps) over NCT-WL-COMPOSITOR surfaces.
Every user-facing process is a Godot project on the one pinned runtime
(runtime/PIN.md): greeter/, shell/, apps/<id>/. Processes, never one big
scene — a shell crash must be a restart, not a lost session
(demo-de/GODOT-SYSTEM.md §2).

- runtime/ — the pin. No binary in git.
- kit/ — the NCT Godot Kit; today: tokens.json, the style-token source.
- extensions/ — GDExtension modules (D-Bus, layer-shell, PipeWire) when
  they land; distro-built and signed only, never app-supplied.
- greeter/ — the greeter. Auth via services/bridge (it has no other
  privilege; it is an ordinary Godot app shown before login).
- shell/ — the shell bar: clock + one button per launch-list entry.
- apps/ — our own apps, one project each. nct-hello/ is the foundation
  placeholder proving our apps launch as citizens.
