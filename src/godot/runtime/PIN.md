# PIN — the Godot runtime

Marker: NCT-LIB-EXT-FWKS binding (godot) / NCT-WL-KIT runtime.

| Field | Value |
|---|---|
| Engine | Godot |
| Version | 4.3.stable.official.77dcf97d8 |
| Artefact | Godot_v4.3-stable_linux.x86_64.zip |
| URL | https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip |
| sha256 (zip) | 7de56444b130b10af84d19c7e0cf63cf9e9937ee4ba94364c3b7dd114253ca21 |
| Installs to | /usr/lib/nct/godot/godot (VM provision); dev machines: $NCT_GODOT |

Rules (CONVENTIONS.md §6): one pinned runtime serves every Godot process —
greeter, shell, apps ship as projects/.pck against it, never with a baked
per-app binary. A version bump is one deliberate commit changing this file,
followed by a full tier 0–2 re-run.
