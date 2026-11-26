# 18 — Modules Slice 2: the NCTXML interpreter v1

Date: 2026-11-26. Asked by: the owner ("Slice 2"). Worktree:
~/workspace/noctivagous-linux-slice1, branch
feat/slice1-window-layer (Slice 1's branch — Slice 2 builds on
it), based on origin/main e1ca0d1. Scope:
plans/ENVIRONMENT-MANAGER.md §7 Slice 2 + plans/NCTXML.md §12 —
the interpreter producing one pane, one window, one app and one
File Navigator preview, plus the component they all use.

## What was built

The modules project is now a Godot .NET project
(src/modules/NCTModules.csproj, Godot.NET.Sdk 4.7.2, net8.0) —
the first C# in the foundation, per the language assignment
(plans §9: the interpreter + binding engine are C# because the
logic is the product). New library directory src/modules/nctxml/
(a library, not a module — every hosting loads it):

- NctXmlRenderer.cs — the interpreter (NCTXML.md §4): XML parse
  → namespace resolution → control registry → logical tree →
  visual tree → properties, handlers, bindings → Godot
  Containers. Kinds: component / pane / preview / window / app /
  shell. Preview enforcement lives HERE, by kind: handlers are
  refused at wire time (counted), TwoWay bindings are downgraded
  to OneWay (noted), and interactive controls are made read-only
  after the build — a host never trusts the file (§2).
- ControlRegistry.cs — the registry + component contract (§6):
  an entry without an accessibility role cannot register. All
  sixteen stock v1 controls + the five §7 layout controls
  (Stack, Box, Grid, Dock, Free, Scroll). Depth where the proofs
  need it (Label, Button, TextField, CheckBox, Slider, Image),
  factory-level breadth elsewhere.
- BindingEngine.cs — binding v1 (§9): {Path} expressions with
  OneTime / OneWay / TwoWay and named converters (Negate,
  Visibility, Upper, Round, Percent); write-back through each
  control's change signal; component-bag ↔ outer-context links.
  DataContext is NctDataObject.cs — a property bag with a
  PropertyChanged signal; inheritance and scoping (a DataContext
  attribute naming a sub-object) are resolved on the logical
  tree. No polling anywhere.
- DockContainer.cs — the Dock layout (§7): children carry a
  dock metadata value; edges consume space in order, Fill takes
  the rest.
- proofs/ — the five §12 files: labelled-slider.nctxml (the
  component), settings-pane.nctxml, text-preview.nctxml,
  hello-window.nctxml, notes-app.nctxml + notes-settings.nctxml.
- harness/ — a C# harness scene that plays the hosts (Settings,
  File Navigator, the shell, a minimal app host) and drives the
  REAL Slice 1 window manager (GDScript, loaded from C#) for the
  window/app records.
- tools/run-chain.sh — two additive tier-0 checks: the assembly
  build (dotnet build; fails the tier if no SDK is present) and
  the NCTXML self-test.

## Evidence — the five proofs (§12), all measured

NCTXML_SELFTEST_OK proofs=5, and full tiers 0+1 in this
worktree: 21 passed, 0 failed; greeter-ui 8/8.

1. Component: LabelledSlider registers from its file and is
   found inside the pane, the window and the app trees.
2. Pane: hosted by a Settings window the host supplies (the
   pane has no window of its own). Host context Volume=30 →
   slider 30; host sets 55 → slider 55 (OneWay through the
   component bag); slider set to 70 → host context 70 (TwoWay),
   and the component's own value label reads "70" through the
   Round converter. TextField and CheckBox TwoWay both ways.
   Layout measured: the Stack's children stack in order.
3. Preview: declares For="txt,md,png". After rendering, its
   TextField is not editable and its Button is disabled BY THE
   RENDERER; the file's handler was counted as blocked and does
   not run when the button's pressed signal is emitted; its
   TwoWay binding was downgraded — editing the field does not
   write back; its image loads through a Src binding.
4. Window: registers with the window manager in the Workspace
   layer; the app registry stays empty (isolation); its handler
   DOES run (contrast with the preview).
5. App: manifest parsed (id nct.notes, requested style,
   single-instance, settings pane resolved relative to the app
   file). Second launch returns the same window, count unmoved.
   Its settings pane hosts as a dialog in the app's layer band
   and binds to the app's context both ways. Its button delivers
   one notification, surfaced as an OSD window in Overlay-OSD.
   Conversion: the window manager's set_style moves the app to
   the Desktop layer with the SAME live tree object as backing —
   conversion without restart, on Slice 1's machinery.

## Findings from the build

- Engine property names are snake_case; NCTXML attributes are
  PascalCase. Every Set/Get crossing into the engine must
  convert (Text → text, ButtonPressed → button_pressed). The
  first harness run failed exactly there: write-back (typed C#
  signals) worked while every engine Set silently no-opped.
  The conversion now lives at one boundary in the engine.
- GDScript cannot instantiate this project's C# classes by name
  in headless runs (parse-time "identifier not declared");
  scene-attached C# scripts work, and C# driving GDScript
  (GD.Load<GDScript>, New, Call) works. Consequence for later
  slices: the GDScript shell will host the renderer as a
  scene-attached C# node, not by name-instantiation. The Slice 2
  harness is C# for this reason.
- dotnet build of the modules project takes ~2 minutes cold
  (NuGet restore of Godot.NET.Sdk) and ~3 s warm.

## What this does not show

- No theme beyond Godot defaults: annotated-SVG chrome (§8) is
  not in v1. DataTemplates, view states, relative-source
  binding and the compiler/cache are deferred per the plan.
- The app host in the harness is a stand-in: registration and
  single-instance are proven against the manifest the format
  carries, but nct-app-registry as a module is Slice 3 work,
  as are bars/side tabs as shell-kind NCTXML and the security
  manager's specced-not-built scope.
- Nothing renders for a user; the harness is headless. No
  tier-2 (rig) run — this slice does not touch the proven
  chain's code paths.

## Left open

- The branch (Slice 1 + Slice 2 together) is uncommitted,
  awaiting the owner's word — and log 17's finding stands:
  landing the exec-bit fixes needs a push path that carries
  file modes.
- Next per the plan: Slice 3 (bars + side tabs as shell-kind
  NCTXML; app registry + launch on the foundation chain;
  security manager specced-not-built) or SYSTEM-INTERFACE
  Slice A.
