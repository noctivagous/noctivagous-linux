# 15 — No engine splash on Godot launches (2026-11-25)

**Prompt:** every NCT launch relaunching the Godot engine and showing
its background image. Checked against the latest commit on main,
`d769944` (QEMU rig re-proof — docs/scripts only, no Godot changes).

## Audit (at d769944)

- Exactly three Godot projects exist: `godot/greeter`,
  `godot/shell`, `godot/apps/nct-hello`. All three are launched the
  same way — `core/session/nct-godot-run <project-dir>` on the one
  pinned runtime (4.3.stable, `godot/runtime/PIN.md`), via
  `nct-resolve-cmd` / the launch list. The engine binary is already
  shared; what is per-launch is the process.
- **None** of the three `project.godot` files set any
  `application/boot_splash/*` key, so Godot's defaults applied on
  every start: boot image shown, boot background at the engine
  default — a visible engine flash before each scene's first frame.
- No other splash path exists: grep over `src/` for
  `boot_splash|splash` outside docs found nothing.

## Fix (this change, local branch `fix/no-splash`, not pushed)

In each of the three `project.godot` files:

- `boot_splash/show_image=false` — no Godot boot image, ever.
- `boot_splash/bg_color` set to the colour that project paints
  first, so the boot phase is indistinguishable from the scene:
  - greeter: `Color(0.07, 0.07, 0.08)` — its `main.gd` ColorRect
  - nct-hello: `Color(0.1, 0.1, 0.12)` — its `main.gd` ColorRect
  - shell: `#232329` — the kit panel surface in
    `godot/kit/tokens.json` (the shell paints no ColorRect of its own)
- `rendering/environment/defaults/default_clear_color` set to the
  same colour, so there is no second flash between boot and the
  scene's first frame.

## What this does / does not do

- Does: removes the visible engine splash/background flash from
  every current Godot launch, at zero runtime cost.
- Does not: change the launch model. Greeter, shell and apps still
  start as separate engine processes on the shared pinned runtime.
  The longer-term direction in GODOT-SYSTEM.md §12 stands — shell
  furniture living in one long-lived shell process, standalone apps
  shipping as `.pck` against the pinned runtime — and is not
  implemented here.

## Verification

- Pinned Godot 4.3.stable, headless: `--import` on all three
  projects exits 0 with no errors.
- Shell self-test: `SHELL_SELFTEST_OK entries=5`.
- Not verified: the visual result on a real seat / in the VM — that
  needs a rig boot with the rebuilt debs, same tier as the other
  greeter/session visual checks.
