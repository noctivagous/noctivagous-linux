# 13 — Runtime upgrade: Godot 4.3 standard → 4.7.2 .NET (mono)

Date: 2026-11-26. Asked by: the owner ("sure upgrade it"), after
deciding the same day that the one pinned runtime is the
.NET-enabled template (plans/DESKTOP-MANAGER.md §9).

## What was done

- PIN.md: 4.3.stable.official (standard) → 4.7.2.stable.mono.
  official.ed1daf0bf; artefact Godot_v4.7.2-stable_mono_linux_
  x86_64.zip, sha256 129f82db7bafd54ae14bb5bb284041c73860e8c7a0
  09a3a026ca5e946cbff247 (downloaded from the GitHub release;
  size and hash prefix match the published release listing).
  4.7.2 is the latest stable (checked godotengine.org archive
  2026-11-26; 4.8 is in beta and was not considered).
- The mono zip unpacks to a DIRECTORY (binary + GodotSharp/),
  not a single binary like the standard zip. tools/build-deb.sh
  now handles both shapes: mono installs the binary plus
  GodotSharp beside it at /usr/lib/nct/godot/ (C# projects
  cannot resolve the Godot API assemblies otherwise), and the
  download cache is keyed by artefact name so a stale zip from
  a previous pin cannot be silently reused.
- README.md's runtime line updated to match.
- Dev-machine runtime installed at ~/.nct-tools/godot-4.7.2-mono/
  (the 4.3 binary at ~/.nct-tools/godot is untouched, for A/B).

## Evidence

- tiers 0+1 (tools/run-chain.sh) on 4.7.2-mono: 15 passed,
  0 failed — imports, shell self-test, bridge fixture auth, and
  the nested-sway chain (greeter auto-login → shell + Firefox +
  QTerminal + NCT Hello) all green with no scene changes.
- tools/run-greeter-ui-test.sh on 4.7.2-mono: 8 passed, 0 failed
  (after the fix below); on 4.3 with the same script: 8/8.
- nct-godot-runtime deb rebuilt: 93,378,134 bytes; extracted and
  verified — godot binary reports 4.7.2.stable.mono.official.
  ed1daf0bf, GodotSharp (82 MB) and PIN.md ship beside it.
  (Two earlier attempts failed on this sandbox only: a timeout
  truncated the archive, then staging fell back to the 512 MB
  /tmp tmpfs and ran out of space; NCT_BUILD_DIR on the home
  filesystem fixed it. No script change resulted.)
- GDScript runs on the mono build with no dotnet installed
  (this sandbox has none); the engine logs a hostfxr error at
  startup and continues. A machine that will BUILD or run C#
  projects still needs the .NET 8 SDK/runtime — that is now a
  distro package question, recorded here, not yet answered.

## The one real finding: synthesized keyboard input on 4.7

run-greeter-ui-test.sh failed deterministically on 4.7.2 at the
second login attempt (5/8): the bridge never received the second
AUTH. Diagnosis before fixes, per house rule:

- Control: same script, 4.3 binary — 8/8. So the regression is
  in the engine/input path, not the greeter or the bridge.
- Probes (nested sway, fixture bridge): the greeter's own code
  is exonerated — when keys arrive, AUTH/START proceed. What
  fails is delivery from wtype's virtual-keyboard devices:
  whole devices silently deliver nothing. One probe run showed
  clean alternation (devices 1, 3, 5 landed; 2, 4 did not);
  in the test environment the pattern shifted (more devices
  dropped, some presses partially landing). Refocus via swaymsg
  did not fix it; waiting 12 s did not fix it.
- Class: synthesized input ≠ real input — the same family as
  the A12 pointer finding (ASSUMPTIONS.md). Real keyboards do
  not vanish and reappear between password attempts. Whether a
  real keyboard on the rig shows any of this is a rig question;
  nothing here shows it would.
- Fix, in the test only: the right-password phase now retries
  (up to 4 attempts, checking for the shell after each) — the
  same idiom the script's shell phase already used, with the
  reasoning written into the script's comments. No product code
  changed.

## What this does not show

- Tier 2 (the VM rig) has NOT been re-run: the chain as proven
  on the VirtualBox rig (a1a6c8f) was proven on 4.3. The rig
  run-all suite against the 4.7.2 runtime deb is still owed,
  and the render ladder's behaviour on the mono build under
  vmwgfx is unchecked.
- No C# project has been built or run yet — the pin makes C#
  possible; the first C# proof belongs to the NCTXML engine
  work (plans/NCTXML.md, Slice 2), and needs a .NET SDK present.
- QEMU smoke has not been re-run on the new runtime either.

## Left open

- Rig re-run of run-all against 4.7.2 (above).
- Whether the distro image ships a .NET SDK/runtime for C#
  development, or only the runtime components Godot bundles.
- Local changes are uncommitted on feat/foundation-src, as
  usual awaiting the owner's word.

## Addendum — build-machine requirement found at push preparation (2026-11-26)

Merging this upgrade with main's Launch Model 2 build (build-pcks.sh
exports the .pck packs with the pinned binary) surfaced a requirement
the tier checks above did not exercise: the mono editor's
--export-pack CRASHES (segfault in mono initialisation, hostfxr not
found) when no .NET runtime is present on the BUILD machine.
GDScript projects still RUN without one; only the editor/export path
insists. With a .NET 8 runtime (8.0.11) on the build machine, the
merged build-deb.sh — main's version plus this upgrade's
artefact-keyed cache, mono-aware binary resolution and GodotSharp
shipping — built both .debs from the exact tree pushed to main:
the foundation package carries greeter/shell/nct-hello .pcks with
normalized modes, and the runtime package carries the mono binary
plus GodotSharp/ beside it. Build environments therefore need a
.NET 8 runtime as a build dependency of the .pck step; whether the
distro's own build image declares one is an open packaging question,
same family as the SDK question in the verdict above.
