# 04 — Chain verification, tiers 0–1 (2026-11-25)

**Done:** tools/run-chain.sh — 15 checks, all passing on this machine:
- Tier 0: every session script parses; the bridge parses and answers
  its real protocol against the fixture backend (PING→PONG, wrong
  password→FAIL, right password→OK); all three Godot projects import
  headless; the shell's --self-test parses the launch list.
- Tier 1: nested headless sway (WLR_BACKENDS=headless, pixman) —
  the greeter auto-logs in through the bridge, the bridge starts
  nct-session-apps, and the compositor's window tree then contains
  all four citizens: NCT Shell, Firefox, QTerminal (Qt), NCT Hello.
  A grim screenshot is captured per run.

**Evidence:** the tier-1 screenshot (tests/results-local/tier1.png,
regenerated each run) shows all four windows, the shell's clock
ticking, its launch buttons, and Firefox on a real New Tab page.

**Findings during verification (both fixed in the runner):**
1. Godot's Vulkan driver fails where no Vulkan ICD exists
   (VK_KHR_surface) — the runner defaults to --rendering-driver
   opengl3 (llvmpipe); the VM is expected to answer with lavapipe.
2. Firefox opens a "Profile Missing" dialog unless its profile
   directory is created fresh beforehand — the runner now does so.
   (Local Firefox is Mozilla's tarball build, v161; the VM uses
   Debian's firefox-esr.)

**What this does not show:** anything about greetd, DRM, a seat, or
booting — tier 1's compositor is nested and its login is the fixture
backend. Nobody independent has checked any of it.
