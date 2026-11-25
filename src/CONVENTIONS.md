# NCT — conventions for everything that ships in this repo

Status: FOUNDATION RUN (2026-11-25). These rules apply to src/ and to any
new material added beside demo-de/ and refs/. When a rule and the code
disagree, fix one of them in the same commit — never let them drift.

## Filetree

1. **src/ is what we author; src/system/ is where it lands.** Every path
   under src/system/ is the path on the installed machine. A file there is
   either generated from src/ by a build step or is pure configuration.
   Never hand-maintain two copies of one thing.
2. **One directory per subsystem, named for its layer.** Directory names
   are kebab-case. Every subsystem directory carries a README.md whose
   first lines state: what it is, which layer/marker it belongs to
   (NCT-WL-COMPOSITOR / KIT / BRIDGE, NCT-LIB-EXT-*), and who may depend
   on it.
3. **Dependencies point down only**: godot layer → services → session →
   core. A dependency that needs to point up is a reclassification,
   recorded in ARCHITECTURE.md in the same commit.
4. **Foreign programs have no source here.** Bundles and .desktop files
   for foreign or framework apps live under the ext-fwks rules, never
   under src/godot/apps/ (that directory is ours only).

## Libraries and resources

5. **Every library or resource directory ships four things**: README.md,
   a VERSION or pin record, a LICENSE / provenance note for anything not
   written here, and its tests beside it. No orphan assets: fonts, icons,
   themes live under src/godot/kit/ or src/system/usr/share/nct/, each
   with source and licence recorded in its README.
6. **Pins, not binaries.** Runtimes and engines (Godot first) are pinned
   by version + sha256 + download/build recipe in a PIN file
   (src/godot/runtime/PIN.md). No large binary is committed to git.
7. **Vendored code is marked vendored**, with upstream, version, and the
   local changes (or "none") in its README. Prefer submodules or pins
   over copies, as with demo-de's paramorphic-components / NCTGraphite.

## Code

8. **Text formats for anything an agent or a person must diff**: .tscn,
   .tres, .toml/.tsv/.json for data, shell for glue. A binary format
   needs a written reason in its subsystem README.
9. **Scripts are POSIX-sh or bash with `set -eu`, parse-checked in tier 0.**
   Every script that launches something logs what it launched, where, to
   $NCT_STATE_DIR (default ~/.local/state/nct/).
10. **One list, one launcher.** Programs the session can start are named
    once, in core/session/launch-list.tsv. No hard-coded program paths in
    scenes, scripts, or configs; fallbacks and overrides live in
    core/session/nct-resolve-cmd.
11. **Guesses are labelled.** Anything written ahead of verification gets
    an `ASSUMPTION A<n>` marker and an entry in tests/vm/ASSUMPTIONS.md
    naming the check that will prove or kill it. A guess without a check
    is not allowed to land.

## Builds and tests

12. **One entry point per tier**: tools/run-chain.sh (tiers 0–1),
    vm/vm-test.sh (tier 2 from the Windows host). A change that breaks a
    tier says so in its commit message.
13. **Commits are local until the owner says push**, batched into a single
    push when the word comes (standing repo rule).
