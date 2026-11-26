# 23 — Slice 3: shell furniture, app registry + launch, security specced-not-built

Date: 2026-11-26. Asked by: the owner (chose Slice 3 from the
post-landing options). Worktree: ~/workspace/noctivagous-linux-slice1,
branch feat/slice3-shell off main 7c42674. Scope:
plans/ENVIRONMENT-MANAGER.md §7 Slice 3, verbatim: "Bars + side
tabs as shell-kind NCTXML under the window manager; app manager
registry + launch on the proven foundation chain; security
manager at specced-not-built scope (profiles read, indicators
rendered, no plugs yet)."

## What was built

Furniture (nct-environment-manager/furniture/, harness in
nct-environment-manager/harness/):
- top-bar.nctxml and side-tabs.nctxml — shell-kind documents
  (title/clock bound to a DataContext; buttons wired by the
  renderer to the host). The renderer gained the shell kind's
  manifest (Id / Name / RequestedStyle, default panel) — the
  one library change in this slice.
- Registered with the window manager as panel windows: origin
  shell, kind_link shell, layer Top measured from the live
  scene tree (backing's parent IS the Top CanvasLayer), focus
  refused per panel policy. The side tabs are functional:
  pressing Workspace 2 moves the bound label.

App registry (nct-app-registry/app_registry.gd, GDScript per
its README):
- Manifests for three kinds — pck (Model 2, own process via
  the chain), foreign (own command), nctxml (document; the
  host renders it and hands over the backing, as an app
  process hands the compositor a surface). Unknown kinds are
  refused at registration.
- launch() hands the window manager a Window record with the
  manifest's requested style — placement stays the manager's
  (§6). Single-instance returns and focuses the existing
  window. launch_command() states the exact foundation-chain
  command per kind (["nct-godot-run", <pck>]).
- Lifecycle: running set, clean close (app.exited on the root's
  bus), and crash detection — mark a process dead, and
  check_liveness() removes its window, drops it from the
  running set, and announces app.crashed on the bus, where the
  one Issue path (§8) begins.

Security (nct-security-manager/, specced-not-built exactly as
scoped):
- profiles.json — MATRIX-SPEC Axes 1+3 transcribed to data
  (4 profiles × 11 capabilities, plus P3's plug names from
  Axis 4). The spec's draft "?" markers are not carried into
  data; the spec remains the source, and the file says so.
- SecurityPolicy.cs — cell evaluation for any profile ×
  capability, plug lookup. IndicatorTracker computes Axis 5
  states (I0–I5) from the disposition in force.
- Rendering per §6 (security does not draw): the tracker is
  fed the spec's OWN worked examples — Notes/mic/P1 flows to
  I1 then latches I2; game/mic/P3 is I3; game/spawn/P3 is I5;
  mic/P4 is I4 — and the resulting states are rendered by
  indicator-bar.nctxml and carried on the Notes window's
  record (`indicators` field, owned by this module since
  Slice 1).

## Evidence

- SLICE3_OK from the harness scene; wired as an additive
  tier-0 check. Full tiers 0+1 after the slice: 28/28;
  greeter-ui 8/8.
- The launch path is exercised THROUGH the furniture: the
  harness presses the rendered bar's actual buttons (signal
  emission on the live tree), and the windows that appear are
  the registry's records in the window manager.

## What this does not show

- No real processes: the registry's process table is the
  liveness seam, fed by hand in the harness. Real spawning is
  the foundation chain's and is proven at tier 1 (real Firefox,
  Qt, NCT Hello windows) — Slice 3 connects the registry to
  that chain by command and record, not by re-proving it.
  Own-process backings are named placeholders; a real surface
  attaches to the same record via the compositor link, which
  does not exist yet.
- Security enforces NOTHING. No grant is made or refused, no
  plug substitutes a stream, no sandbox contains anything —
  the tracker computes what the indicator should say, and the
  shell renders it. The guard is later work, as the plan's
  scope line states.
- The bus is still a log. app.launched / app.crashed are
  recorded, not yet reacted to; system-watch consuming
  app.crashed into an Issue is the obvious first reaction and
  is not built.
