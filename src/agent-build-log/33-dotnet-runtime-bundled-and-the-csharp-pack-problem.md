# 33 — The .NET runtime, bundled; and the C# pack problem it uncovered

Date: 2026-11-27. Asked by: the owner, accepting the
recommendations in log 31's report (bundle the pinned .NET
runtime; the fix as its own slice). Branch:
feat/greeter-look-registry, on top of main 69d571f.
Scope: (1) bundle .NET 8.0.34 in nct-godot-runtime and
select it in nct-godot-run; (2) re-run the tier-2 rig proof
of log 31 with the fixed debs.

## The bundling fix

- PIN.md gains a ".NET runtime" section: Microsoft.NETCore
  .App 8.0.34 (the version the distro SDK builds against),
  artefact dotnet-runtime-8.0.34-linux-x64.tar.gz, sha256
  eeeccf58…, cross-checked at download against Microsoft's
  published sha512 in the 8.0 release metadata. PIN.md's
  old sentence claiming GDScript projects make a dotnet
  installation unnecessary is corrected: the zip carries no
  runtime, and every shipped project loads C#.
- build-deb.sh fetches/verifies the tarball exactly like
  the engine zip (cache keyed by artefact name), stages
  muxer + host/fxr + Microsoft.NETCore.App beside the
  engine binary at /usr/lib/nct/godot/dotnet (AspNetCore is
  not shipped), and FAILS THE BUILD if the staged tree
  lacks an executable muxer, libhostfxr.so or
  libcoreclr.so — the absence that reached a rig before
  anyone noticed (log 31) is now unshippable.
- nct-godot-run — the single choke point every Godot
  invocation funnels through (greeter via greetd's session,
  shell and apps via nct-launch/resolve-cmd) — exports
  DOTNET_ROOT=<godot-dir>/dotnet and prepends it to PATH
  when the bundle sits beside the resolved binary. A
  shipped machine needs no dotnet of its own; an ambient
  one never replaces the pin. Dev trees (bare NCT_GODOT, no
  bundle beside it) are untouched.
- run-chain gains "t0 dotnet runtime bundled pin" (the
  three legs — PIN, build, runner — must agree).

Proofs, local: run-chain 44/44, greeter-ui 8/8. And a
before/after on the exact shipped artefacts: both debs
extracted to a staging root, the staged shell pack run via
the staged nct-godot-run under env -i (no PATH dotnet, no
DOTNET_ROOT): with the bundle, SHELL_SELFTEST_OK +
SHELL_REGISTRY_OK, rc=0; with the bundle directory renamed
away, the guest's exact failure (dotnet: not found,
hostfxr missing, rc=134).

## The rig re-proof: greetd holds

Debs (foundation c27a4ac0…, runtime 00eeadc3…, the runtime
deb now 119MB) transferred (227 chunks, hash-verified),
installed rc=0, greetd restarted IN PLACE (no guest
reboot — log 31's WHPX wedge). Result: **greetd active,
NRestarts=0** — where log 31 recorded a start-limit after
5 crashes. The greeter's engine now starts and stays up.

But the screendump is a black screen with a cursor, and
godot-run.log shows the next defect, plainly:

  ERROR: Cannot instantiate C# script because the
  associated class could not be found. Script:
  'res://GreeterForm.cs'.

The form never builds, so nothing draws. (The shell pack
has the same disease: its self-test log carries one such
error for ShellBar.cs — its assertions are GDScript-side,
so it "passed" anyway. Every C# proof before tonight ran
the loose projects; pack-form C# had never been exercised.)

## The C# pack problem, as established by experiment

1. --export-pack does not ship C# assemblies. Listing the
   shipped greeter.pck: 28 files — the .cs SOURCES are
   packed, no .dll anywhere. build-pcks' comment ("packs
   project data only") is the mechanism and the mistake.
2. Publishing into the project first changes nothing:
   with .godot/mono/publish/linux-x64 populated, the
   export-pack output is byte-identical (118,360).
3. Assemblies beside the pack are not probed (tested:
   NCTGreeter.dll + deps.json + runtimeconfig beside
   greeter.pck — same error).
4. A full --export-release (templates pinned by the same
   download pattern; the projects also needed .sln files —
   they ship .csproj only, and the export's .NET step
   silently skips without one) produces the real layout:
   binary + .pck + **data_<Assembly>_linuxbsd_x86_64/** —
   a self-contained publish (187 files, 77MB, including
   libhostfxr/libcoreclr) BESIDE the binary. That layout,
   run as exported under env -i, works: rc=0, no errors.
5. The shared editor binary does not honour that layout
   the way the template does. With the data dir beside it:
   no DOTNET_ROOT → its own mono init fails (the editor
   needs a runtime for itself) and the process crashes
   signal 11 when C# is touched; with DOTNET_ROOT set to
   our bundle → mono init succeeds, but project-assembly
   resolution then goes through the standard host and the
   data dir is NOT consulted (GreeterForm missing again).
   Both halves were bisected experimentally (exe name and
   cwd ruled out; DOTNET_ROOT is the switch).
6. The template binary refuses --main-pack outright
   ("compiled without support for path overrides") — it
   runs only the pack named after itself beside it. So
   "one shared binary loads any pack by name" is a
   property of the editor binary only, and the editor
   binary cannot load C# project assemblies from a pack.

In short: launch model 2's shipped form — packs against
one shared binary — works for GDScript and is not a form
Godot's C# support offers. The greeter, shell and any C#
app cannot ship as bare packs against the editor binary.

## What this slice leaves decided and undecided

Done and proven: the .NET runtime bundling (necessary
under every option below — the editor binary needs it for
dev and project-form running; greetd no longer
crash-loops). The tier-2 verification of the greeter card
and the session remains blocked, now by this pack problem
rather than the runtime.

The shipping shape for C# apps is the owner's decision:
(1) per-app named template binaries — the layout Godot
itself ships (binary copies can be hardlinks to one inode;
data dir per app; build-pcks becomes export-release and
discards nothing but the illusion of a bare pack);
(2) C# apps ship in project form with published assemblies
(the resolve-cmd fallback that already exists; packs stay
for GDScript-only apps); (3) a from-source template build
with path overrides enabled (heavy); (4) defer — ship the
GDScript surface and treat C# packs as their own design
slice. Also folded into any of these: the NCTGrid
GDExtension library placement (export-release puts
libnctgrid beside the binary; the pack's 'bin/' reference
does not resolve in pack form).
