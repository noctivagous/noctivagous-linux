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
C# projects cannot resolve the Godot API assemblies. The zip
carries NO .NET runtime, though — and the mono engine needs
one (hostfxr) to start any project that loads C#, which the
greeter, shell and apps all do. That runtime is pinned
separately below and bundled by the runtime deb; without it
the greeter crashes before drawing (agent-build-log/31).

History: 4.3.stable.official.77dcf97d8 (standard edition) until
2026-11-26 — the version the foundation chain was proven on.
The 4.3 → 4.7.2 upgrade record is in agent-build-log/13.

Rules (CONVENTIONS.md §6): one pinned runtime serves every Godot process —
greeter, shell, apps ship as projects/.pck against it, never with a baked
per-app binary. A version bump is one deliberate commit changing this file,
followed by a full tier 0–2 re-run.

## The .NET runtime

The mono engine's other half: the runtime GodotSharp runs on.
Pinned to the version the distro's SDK builds against, bundled
into nct-godot-runtime beside the engine binary, and selected
by nct-godot-run (DOTNET_ROOT) whenever the bundle is present —
so a shipped machine needs no dotnet installation of its own,
and an ambient one never silently replaces the pin.

| Field | Value |
|---|---|
| Runtime | Microsoft.NETCore.App |
| Version | 8.0.34 |
| Artefact | dotnet-runtime-8.0.34-linux-x64.tar.gz |
| URL | https://builds.dotnet.microsoft.com/dotnet/Runtime/8.0.34/dotnet-runtime-8.0.34-linux-x64.tar.gz |
| sha256 (tarball) | eeeccf584ed7f114294eb8feec068f995573c9c2fe058294b5f46df46bbbd10c |
| Installs to | /usr/lib/nct/godot/dotnet (inside nct-godot-runtime) |

The sha256 above was taken from the artefact as downloaded
2026-11-27 and cross-checked against Microsoft's published
sha512 for the same file in the 8.0 release metadata
(3949c533…c27ddb). Only Microsoft.NETCore.App is bundled;
the tarball's AspNetCore shared framework is not shipped —
nothing in the system hosts ASP.NET.
