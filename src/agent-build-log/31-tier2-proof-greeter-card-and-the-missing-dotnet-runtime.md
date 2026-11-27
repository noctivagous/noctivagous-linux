# 31 — Tier-2 proof: the greeter card, and the runtime that isn't there

Date: 2026-11-27. Asked by: the owner ("improve the
appearance of the login screen and then do tier-2 rig proof
of the session in this state"; and their own report: "right
now the modal isn't centered"). Branch:
feat/greeter-look-registry. Scope: the greeter card fix
(commits b7d1326 + 2899d4d), then the session on the QEMU
rig with debs built from that branch tip.

## The centering complaint, in three layers

1. The guest the owner was looking at runs the OLD
   pre-NCTXML greeter from the Nov-25 image. Its code-built
   form pinned the form's top-left CORNER to the screen
   centre (PRESET_CENTER on a plain Control). Measured on
   the live guest before any change: form x 638–921,
   y 400–588 on 1280×800 — the corner sits at the centre;
   it never centred anything.
2. The current NCTXML greeter's mechanism is correct, but
   pixel measurement of the tier-0 screenshot showed the
   visible form 16px high: the stack's last row is the
   status label, empty at rest, so the geometric centre of
   the stack sits below the visible content.
3. The fix is the card itself (below): a reserved status
   row makes the visible and geometric centres the same
   thing. A new tier-0 layout probe pins the real greeter
   scene at 1280×800 and measures the card centre at
   (640, 399.5) against screen centre (640, 400);
   run-chain carries it as "t0 greeter layout".

## The card

login.nctxml is now a centred card: Panel, 32px side
margins, centred title (30px, applied host-side —
font sizes are NCTXML §8 theme vocabulary, not yet
expressible), 320×38 user/password fields, 320×42 login
button, centred status label with a reserved 20px row so
an error never moves the card. The NCTXML library gained
what the card needed (b7d1326): a Margin control,
Separation and Margin* attributes, and enum property
values by name (HorizontalAlignment="Center" previously
parsed silently to 0). Gates at the branch tip:
run-chain 43/43 (with log 32's registry check),
greeter-ui 8/8.

## The rig run — what happened, in order

- Debs built in the sandbox (the WSL build path proved
  unreliable this session: the editor's --export-pack
  segfaulted intermittently on cold trees, and one
  completed build's outputs vanished when WSL
  idle-stopped). Hashes: foundation cab68f69…, runtime
  4e74a099…. The runtime deb reached the rig as 179
  512KB chunks (bulk scp drops on this tunnel) and
  reassembled byte-identical.
- First install failed: the guest's root filesystem was
  FULL (2.1G fs, 95M free; dpkg could not stage the new
  runtime binary). The proof image's fs was grown to 6G
  offline (the rig's own resize recipe; pristine and
  run6 images untouched). Reinstall: both packages ii,
  apt rc=0.
- A guest-initiated reboot then wedged the VM: kernel
  output stopped at 0.4s, and a monitor screendump showed
  SeaBIOS parked after "Probing EDD… ok" — the machine
  had reset and wedged in firmware, VM status running.
  A cold QEMU restart on the same image booted cleanly.
  This is a WHPX warm-reset failure; it is recorded here
  because it cost an hour, and because a guest reboot
  inside QEMU-on-WHPX should not be trusted as a test
  step until it is understood. It is not evidence about
  the software under test.
- On the cold boot: greetd restart-looped to its start
  limit (NRestarts=5). The greeter's own log says why —
  see the finding.

## The finding: the shipped runtime has no .NET runtime

godot-run.log in the guest, every ladder rung:

  ERROR: .NET: One of the dependent libraries is missing…
  Unable to load .NET runtime, specifically hostfxr.
  handle_crash: Program crashed with signal 11 … exit 132

The mono Godot needs hostfxr/coreclr. The editor zip
contains none (binary + GodotSharp API assemblies only),
so nct-godot-runtime ships none; and nothing in
build-deb.sh, src/core or src/system sets DOTNET_ROOT or
otherwise provides one. On any machine without a .NET SDK
installed, the greeter — and by the same construction the
shell and every NCT app — crashes before drawing. The
ladder correctly walked all rungs and reported failure;
greetd correctly start-limited. The chain's failure
handling worked; the payload cannot start.

Reproduced locally in one minute: the same binary on the
greeter project with a clean environment prints the same
hostfxr error ("sh: 1: dotnet: not found"). Tier-0/1 never
saw it because every local run exported DOTNET_ROOT by
hand — an invocation habit, recorded in this log's
predecessor notes as a quirk, that was in fact masking a
packaging gap. The main chat's Step-2 note ("the guest
godot version returned empty", 2026-11-26) was this same
wall, undiagnosed at the time.

Cause, in the standing classes: DESIGN — the runtime pin
(Model 2: packs on one shared mono runtime) implies a
.NET runtime on the target, and no decision ever owned
providing it. IMPLEMENTATION — build-deb.sh packages the
zip as-is; no session script sets DOTNET_ROOT.
KNOWLEDGE — not a gap; the dependency was never carried
into the packaging.

## What this proof does and does not show

Shown: the debs install cleanly on the standard rig path
(once the image has room); the failure chain above is
the session's real state on a bare machine today; the
greeter card is centred and measured at tier 0.
NOT shown: the card on the rig's greeter, a login, or the
session running the new debs — the greeter never starts,
so none of that could be observed. Those verifications
wait on the runtime fix, which is a packaging decision
for the owner (bundle a pinned .NET runtime in
nct-godot-runtime + DOTNET_ROOT in the session scripts is
the shape that fits the pin philosophy; a distro-package
dependency is the lighter alternative and breaks the pin).
The guest is left up with greetd in its failed state on
the throwaway proof31 image; nothing on the rig's other
images was touched.
