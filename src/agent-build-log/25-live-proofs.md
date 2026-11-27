# 25 — Rig live proofs: sys-interface, coredump dedupe, recovery boot

Date: 2026-11-26 (evening). Asked by: the owner ("Run all
three proofs as the next rig session", from the prepared
checklist). Track: the QEMU guest on the Windows rig (WHPX),
module source staged from the rig checkout at 796d161.
Scope: the three proofs that were fixture-grade only after
logs 19, 20, 22 and 24 — live systemd for the sys-interface
bridge (Slice A), a live coredump through the crashes domain
into the system-watch Attention inbox (breadth), and a real
recovery boot for Slice D.

## Proof 1 — live systemd (Slice A): PASS

- SystemdSource reports available (systemd via Gio/GDBus)
  and start_live's Subscribe + ListUnits flowed 207 real
  units through the bridge's own ingest into the tree;
  greetd.service reads with its real description and health
  "ok" in desktop terms. Final tree: 213 units.
- A new unit (nct-proof1.service), created and started
  mid-run, entered the tree on a UnitNew subscription signal
  as (active, ok) — a real state change visible end-to-end.
- Bounds, located in the module as shipped: there is no
  serve() and no signal wiring — the session driver supplied
  signal -> ListUnits re-emit through the module's own
  ingest. The tree has no removal or staleness semantics:
  after the unit was stopped, systemd showed it inactive/dead
  while the tree kept its last-listed state. The reflection
  is accurate at list time, not continuously;
  PropertiesChanged wiring and a removal rule are the serve
  loop's owed work.

## Proof 2 — live coredump (breadth): PASS

- Two real SIGSEGV crashes of /usr/bin/python3.13 were
  registered by systemd-coredump; events built from live
  coredumpctl data entered the tree at /crashes/<id> and
  were republished in the watch's shape; SystemWatch
  deduped by binary into ONE Issue, "python3.13 crashed",
  severity high, occurrences=2, with the Attention bar
  context reading "Attention: 1 open".
- Bound: CoredumpSource.pump raises NotImplementedError by
  design; the driver implemented the source's documented
  contract over live coredumpctl output. The live pump is
  the same unwritten serve loop as Proof 1's.

## Proof 3 — real recovery boot (Slice D): PASS on entry

- The recovery environment was assembled into the run image
  from the module (recovery_backend.py + recovery_tui.py in
  /usr/lib/nct/recovery/, plus an nct-recovery.target and an
  nct-recovery-tui.service on /dev/tty1 — assembled for the
  proof; none of it ships in the image or the deb today).
- Booted with the shipped boot entry's options
  (nct.recovery=1, systemd.unit=nct-recovery.target) on the
  kernel command line; the target isolated and the TUI
  rendered on the real console: "NOCTIVAGOUS RECOVERY" with
  the six designed items. Driven by keyboard: Startup
  Repair enumerated three findings, applied the fixes on
  confirm, and wrote three receipts marked where=recovery,
  read back verbatim on the next normal boot.
- The pre-proof snapshot was restored (SHA-256 verified)
  and the short chain re-proven: greeter, login, NCT Shell
  session with the full launch set.

## What this does not show

- The machine the recovery TUI enumerated and repaired was
  the fixture backend's recorded one. RealBackend raises
  NotImplementedError on construction by design ("Slice D
  follow-up") and the TUI's main wires FixtureBackend —
  real-state enumeration and repair do not exist yet.
- The failed-boot auto-offer (should_offer_recovery) has no
  boot counter wired in the image; the menu's "failed to
  start 3 times" is the fixture's count. The systemd-boot
  menu entry itself is unexercised: this track boots
  direct-kernel and the image has no systemd-boot.
- Two spec/packaging mismatches found: the boot entry's
  root=LABEL=NCTROOT does not match the image (root label
  "nct-test"; root=/dev/vda was substituted for the proof),
  and ACPI powerdown is not handled inside the recovery
  target (no logind there).
- Guest provisioning gaps the proofs needed, all fixed in
  the run image only: the image ships no /etc/resolv.conf
  (outbound DNS dead), no python3-gi, and no
  systemd-coredump.

## Tallies

No product failures. Two invalid runs, both operator error
and kept out of the failure tally per the owner's accounting
rule: a printf piped into a sudo -S tee truncated the first
test unit file to empty (systemd reads an empty unit file
as masked), and the first coredump driver assumed the wrong
coredumpctl column layout. Each was located by direct
checks and re-run valid.
