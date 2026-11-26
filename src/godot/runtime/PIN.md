# PIN — the Godot runtime

Marker: NCT-LIB-EXT-FWKS binding (godot) / NCT-WL-KIT runtime.

| Field | Value |
|---|---|
| Engine | Godot |
| Version | 4.7.2.stable.mono.official.ed1daf0bf |
| Artefact | Godot_v4.7.2-stable_mono_linux_x86_64.zip |
| URL | https://github.com/godotengine/godot/releases/download/4.7.2-stable/Godot_v4.7.2-stable_mono_linux_x86_64.zip |
| sha256 (zip) | 129f82db7bafd54ae14bb5bb284041c73860e8c7a009a3a026ca5e946cbff247 |
| Installs to | /usr/lib/nct/godot/godot (VM provision); dev machines: $NCT_GODOT |

This is the .NET (mono) edition — DECIDED 2026-11-26 (see
src/plans/ENVIRONMENT-MANAGER.md §9): the one pinned runtime serves
GDScript and C# alike; C# projects target .NET 8. The mono zip
unpacks to a DIRECTORY holding the binary
(Godot_v4.7.2-stable_mono_linux.x86_64) plus GodotSharp/ (Api,
Tools): the install must ship GodotSharp beside the binary, or
C# projects cannot resolve the Godot API assemblies. GDScript
projects run on it without a dotnet installation present.

History: 4.3.stable.official.77dcf97d8 (standard edition) until
2026-11-26 — the version the foundation chain was proven on.
The 4.3 → 4.7.2 upgrade record is in agent-build-log/13.

Rules (CONVENTIONS.md §6): one pinned runtime serves every Godot process —
greeter, shell, apps ship as projects/.pck against it, never with a baked
per-app binary. A version bump is one deliberate commit changing this file,
followed by a full tier 0–2 re-run.
