# 16 — Launch model 2: apps ship as .pck on the shared runtime (2026-11-25)

**Decision (owner, 2026-11-25):** model 2 is the right design —
one distro-pinned Godot runtime; every NCT Godot app ships as a
.pck pack run by that runtime; each windowed app still gets its own
engine *process* (own heap/Vulkan context, Wayland window, crash
and sandbox isolation), but never its own engine *copy*.
Standalone per-app binaries (model 1) and loading windowed apps as
scenes inside the shell process (model 3) are not the design;
model 3 remains the shape for shell furniture/widgets only.

## What changed

- `export_presets.cfg` (preset "Linux", data-only) added to all
  three projects: greeter, shell, apps/nct-hello.
- `tools/build-pcks.sh <dest-dir>` — exports the three packs with
  the pinned editor binary (`--export-pack`, which needs no export
  templates: it packs project data only). Layout mirrors godot/:
  `greeter.pck`, `shell.pck`, `apps/nct-hello.pck`. Packs are
  build artefacts (`*.pck` now gitignored).
- `core/session/nct-godot-run` accepts a project dir (dev form,
  `--path`, unchanged) or a `.pck` file (shipped form,
  `--main-pack`). It also names `NCT_LAUNCH_LIST` explicitly (the
  list beside the script) when the caller has not — a packed app
  cannot derive it from `res://`, which lives inside the pack;
  this was the one real breakage the spike found (shell pack ran
  with `entries=0` until the list was named).
- `core/session/nct-resolve-cmd` prefers the `.pck` beside each
  project when one exists, else the project dir. Installed trees
  (packs only) and dev trees (dirs, or dirs + locally built packs)
  both resolve correctly.
- `tools/build-deb.sh` — the pinned zip is fetched/verified once
  at the top; its binary packs the projects during the foundation
  build, and the staged tree swaps the three project dirs for
  `greeter.pck`, `shell.pck`, `apps/nct-hello.pck`. The runtime
  deb's payload install reuses the same extracted binary.
- `tools/run-chain.sh` tier 0 gains two checks: pck build, and the
  shell self-test run from the pack through nct-godot-run.
- READMEs (godot/, core/session/) describe the two forms.

## Verification (scoped)

- Spike: `--export-pack` on the pinned 4.3 binary produces packs
  of 2.6–6.2 KB (vs a ~50 MB engine copy per app in model 1);
  `--main-pack` runs all three: NCT Hello prints
  `NCT_HELLO_READY`, greeter exits 0, shell self-test via
  nct-godot-run reports `SHELL_SELFTEST_OK entries=5`.
- run-chain tier 0: **15/15 PASS**, including both new pck checks
  and all pre-existing checks.
- run-chain tier 1: not runnable in this sandbox — `sway` is not
  installed here (`sway: command not found` in sway.log); the
  failure is environmental and identical for the unmodified tree.
  Tier 1 in pck form is a rig/nested-host check, still owed.
- build-deb.sh: both debs build. The foundation deb's listing
  shows exactly `godot/greeter.pck`, `godot/shell.pck`,
  `godot/apps/nct-hello.pck` and no Godot project dirs; the
  runtime deb is the usual ~41 MB single engine.
- Not verified: the installed (pack-only) tree booting the full
  chain on the rig — that is the tier-2 check this change needs
  next, together with the no-splash visual check from log 15.
