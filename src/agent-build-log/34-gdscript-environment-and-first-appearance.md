# 34 — The GDScript environment: greeter + shell rebuilt, styled, and proven on the rig

Date: 2026-11-27. Asked by: the owner — the GDScript-first
decision (below), then "build everything… a relatively
presentable first appearance for the login screen and
desktop shell based on our TypeScript demo styling such
that the person can log in, launch one of the apps from
the Launch Bar". Branch: feat/greeter-look-registry, on top
of 783870b (log 33's bundling fix, still unpushed).

## The decision this implements (owner, 2026-11-27)

Log 33 established that C# has no shipped form in the
launch model's bare packs (sources travel, assemblies do
not). The owner's strategy, in their words across the
turn: files that run from source means GDScript (an
interpreted language the engine itself compiles); C# from
source would need the SDK, compiler and build tools on
the target. So: **get a working interactive environment
in GDScript; sections that stabilize are baked in from
source** as compiled artefacts (GDExtension libraries, or
C# assemblies in that app's export layout). C# stops being
the environment's implementation language and becomes a
baking target alongside GDExtension. Recorded in
plans/ENVIRONMENT-MANAGER.md §9 as a DECIDED block.

Supporting fact the owner added: typed GDScript narrows
the compute gap to C# considerably (benchmarks they cited:
34–59% faster than untyped GDScript over 1B iterations of
arithmetic/Vector2 work on an M2 Max). The bake threshold
is therefore higher than "any real logic" — a component
should have to earn compilation.

## What was built

- **Greeter form in GDScript** (godot/greeter/form_host.gd):
  the login card from the greeter-look slice, built in
  code — CenterContainer → Panel "LoginCard" → margins
  32/32/28/28 → stack: NOCTIVAGOUS title (30px), SESSION
  LOGIN subtitle, UserField/PassField (320×38), Log In
  button (320×42), reserved 20px status row. Same host
  contract main.gd always used (set_status / resolve_login
  / refocus_password / ensure_focus; submission calls
  form_attempt_login and stays pending). Prints
  GREETER_FORM_OK at ready.
- **Shell bar in GDScript** (godot/shell/bar_host.gd): a
  48px bar — NCT wordmark plate, one button per
  launch-list entry (shell excluded), clock + date at the
  right, first button focus-held from the start. Same host
  contract (get_bar_root / ensure_focus), plus
  button_count() so the self-test can prove the bar exists
  (SHELL_BAR_OK) — the assertion whose absence let log
  33's form-less shell "pass".
- **The demo's styling, carried over** (demo-de
  styles/nct-desktop.css tokens): backdrop.gd, a twin copy
  in each project, draws the demo wallpaper — near-black
  gradient (#1c1c1c→#0a0a0a), 44px grid at 2.8% alpha,
  corner registration marks, coordinates readout, the NCT
  mark at 3%. Card/fields/buttons take the demo's panel
  tones, black 1px borders, 6px/4px radii, the blue focus
  ring (#4fc3f7), the primary button in dark green with
  bright-green text (#66ff66), failures in the demo red
  (#e05a4e). Fonts are the engine default for now; the
  demo's faces (Space Grotesk / Inter / JetBrains Mono)
  are a named later polish.
- **Two placement bugs the render exposed** (found by
  reading the tier-1 session screenshot, not the source):
  (1) the shell window requested 1280×56, so compositors
  placed it as a strip window — the shell is now
  fullscreen from engine start (window/size/mode=3,
  1280×800), the greeter's established pattern, because
  the shell IS the desktop; (2) the window manager seats
  backings at their record geometry, and the bar's record
  carried full-viewport geometry — harmless under the old
  transparent NCTXML panel, but a styled PanelContainer
  seated at that size would stretch across the screen.
  A panel's geometry is now its strip (full width × 48).
- **C# leaves the shipped projects**: GreeterForm.cs,
  ShellBar.cs, both csproj files, the vendored nctxml/
  copies, the nctxml-smoke scenes, the grid descriptor +
  .so copies and both projects' [dotnet] sections are
  deleted. The NCTXML login/bar documents move to
  src/modules/nctxml/examples/ as the baking track's
  reference; the E1 source-sync hosting (sync-nctxml.sh,
  check-nctxml-copies.sh, the drift + hosted tier-0
  checks) is retired with them — the library's own tests
  in src/modules carry it until it bakes.
- **Shipped-form gates** (run-chain): the packs must build
  their UI — SHELL_BAR_OK via .pck, GREETER_FORM_OK via
  .pck — and neither pack's run may contain "Cannot
  instantiate". run-greeter-ui-test.sh drops its dotnet
  build step (there is no assembly to build).

## Gates

- run-chain: **45 passed, 0 failed** (the five new
  shipped-form checks included; the greeter layout probe
  passes on the GDScript card unchanged — it looks for
  "LoginCard", which the GDScript build keeps).
- greeter-ui (nested sway, keyboard only): **8 passed,
  0 failed** — wrong password shows the failure in the
  card, right password starts the session, Enter on the
  bar's Firefox button launches Firefox. Screenshots read
  by eye: card centred and clean; desktop = demo wallpaper
  with the bar across the top.
- Shipped artefacts under a bare environment (`env -i`,
  staged debs, staged nct-godot-run): greeter pack rc=0,
  GREETER_FORM_OK, zero "Cannot instantiate"; shell pack
  rc=0, all four OK markers, zero "Cannot instantiate".
  This is the exact configuration that failed in log 33.

## Tier-2 rig proof (the one owed since log 31)

Proof guest (proof31 image, grown fs), cold-booted earlier
and left up. Only the foundation deb changed
(95,384 B, sha256 2308f31b…; the guest's runtime is
already log 33's build of the same pinned engine +
bundled .NET). Hash verified at both transfer hops;
apt rc=0; greetd restarted in place (no guest reboot):
**active, NRestarts=0**.

- **Greeter**: screendump shows the login card rendered —
  the first time the shipped greeter has ever drawn on
  the rig (log 33's was a black screen). Measured from
  the pixels: the focused field's blue ring spans
  x 480–798 (centre 639), the title text spans x 536–744
  (centre 640.0) on the 1280×800 screen.
- **Login**: credentials typed through the QEMU monitor
  (sendkey). The session came up: screendump shows the
  desktop — demo wallpaper, bar across the top, Firefox
  button focus-ringed, clock reading 09:52 UTC. Guest
  state confirms a seat0 session and greetd active.
- **Launch from the bar**: Enter through the monitor on
  the focused Firefox button → Firefox opened (first-run
  welcome, fullscreen; its guest processes confirmed over
  SSH). The user's acceptance story — log in, see the
  shell, launch an app from the Launch Bar — is proven
  end to end on the rig.

Rig note: the Windows host's SSH server now refuses the
default (SFTP) scp — transfers need `scp -O` (legacy
protocol); recorded in TOOLS.md.

## Still open (unchanged, or named by this slice)

- The GDExtension path rule in pack form (log 33): the
  first baking slice's problem to solve.
- Fonts: bundle the demo's faces as a polish slice.
- The registry liveness seam stays unfed until nct-launch
  reports pids.
- Push state: this slice and log 33's fix (783870b) are
  local, awaiting the owner's word.
