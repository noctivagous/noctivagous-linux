# NCT — system interface, reflection and repair plan

Status: DRAFT PLAN (2026-11-26), written at the user's direction
after research. Not built.
Companions: ENVIRONMENT-MANAGER.md (the organisation this plugs
into), NCTXML.md, and user-experience/cli-to-gui-discrepancy.md
at the repo root (the daily-driver evidence this answers).

Evidence base: the 2026-11-26 research pass on how desktop
environments interface with the Linux system (systemd / D-Bus /
journal primary documentation; GNOME, KDE, Xfce mapping; ABRT /
Apport / DrKonqi; recovery facilities; laptop driver frictions),
plus the 2026-11-25 daily-driver barriers research. The pattern
in both: **the system almost always already knows. The desktop
surfaces almost none of it.** Failed systemd units notify nobody
by default; crash reporting is an optional distro add-on; logs
are pull-only viewers; driver state (built / signed / enrolled /
loaded) is knowable at every step and shown at none.

## 1. nct-linux-sys-interface — the bridge

One module is the desktop's only channel to the Linux system.
No other module opens its own D-Bus connection to a system
service, tails a log file, or shells out to a system tool.
(This is the NCT-WL-BRIDGE slot, generalised from foreign-app
hosting to the whole system.)

    nct-linux-sys-interface
    ├── systemd        units, jobs, targets — Subscribe() +
    │                  PropertiesChanged; ListUnits; failed-unit
    │                  signals (UnitNew / JobRemoved)
    ├── journal        structured follow: MESSAGE, MESSAGE_ID,
    │                  PRIORITY 0–7, DOCUMENTATION=, unit fields
    ├── session/power  logind, UPower (battery, sleep, lid)
    ├── network        NetworkManager (the one named backend —
    │                  never co-manage an interface with another)
    ├── devices        udisks2 (mounts, SMART), BlueZ, bolt
    │                  (Thunderbolt authorisation), libfprint
    ├── packages       PackageKit (updates, RequireRestart),
    │                  DKMS status, kernel ↔ driver pairs
    ├── firmware       fwupd / LVFS, staged UEFI capsules
    ├── crashes        systemd-coredump (coredumpctl data)
    └── authority      polkit agent — its presence and health
                       are part of desktop health

Rules:

1. **Subscribe, don't poll or scrape.** Every source above
   pushes live state or offers a follow; the bridge subscribes
   once and republishes on the desktop bus in desktop terms.
2. **Mirror, don't copy.** The bridge maintains the live
   **system object tree** — units, devices, mounts, services,
   power, network — that panels and centres render as views
   (ENVIRONMENT-MANAGER.md §8 rule 5). A view can never drift out
   of sync with the system, because it holds no copy.
3. **One named backend per domain.** Where two system stacks
   can fight (NetworkManager vs systemd-networkd; TLP vs
   power-profiles-daemon), the bridge names the one in force,
   detects the conflict, and says so as an Issue (§3) instead
   of letting a Settings panel silently mean nothing.
4. **Actions go back through the same bridge.** Start / stop /
   restart / reset-failed a unit, enrol a Thunderbolt device,
   apply an update, roll back a driver — modules request the
   action from the bridge, which performs it under polkit.
   The equivalent command is shown in an expandable detail,
   as information, never as the required path.

## 2. Reflection — the desktop as a view of the system

The desktop's structure mirrors the system's own conventions,
so what the user learns in the desktop is true of the system:

- **Processes are units.** The Services view is the unit list,
  in plain language with real state, including user units —
  searchable, with enable / disable / restart and a "what
  slowed this boot" chart (systemd-analyze data, drawn).
- **History is a timeline.** System Changes: updates installed,
  drivers changed, services enabled, mounts added — each with
  its receipt and, where possible, Undo. Support starts from
  "what changed just before it broke".
- **Logs are a named, first-class place.** A Logs view over the
  journal: by boot (incl. Previous Boot), by unit, by priority,
  with export for a helper. Support answers name it.
- **Conventions are not re-invented.** Groups are shown with
  their meanings translated ("USB serial devices (dialout)"),
  mounts are forms validated and test-mounted before saving,
  defaults / alternatives / environment are panels — the
  missing-GUI list from the daily-driver document, built as
  views over the bridge rather than as new machinery.

## 3. nct-system-watch — issues float up, with a way out

A watcher, not a manager: it owns no system state, it triages
what the bridge reports. It runs as its own service, **outside
the shell process**, so the reporter survives the failure it is
reporting (the DrKonqi lesson: the crash reporter crashed when
the compositor was down).

    sources (via sys-interface)
      failed units · coredumps · journal PRIORITY ≤ 3 with a
      MESSAGE_ID · SMART failing / bad sectors · low disk ·
      update requiring restart · DKMS build failure · module
      built but not signed / key not enrolled · missing
      firmware named in the journal · backend conflicts (§1.3)
              ↓
    triage — dedupe, group by cause, attach what is known:
      what happened, in plain language · since when · what
      changed just before (System Changes) · the journal slice
              ↓
    one Issue, one place: the Attention inbox
      persistent in the bar until resolved or dismissed ·
      severity-ordered · never a transient toast alone for
      anything that needs action · never suppressed after
      being shown once (the GNOME SMART-warning lesson)
              ↓
    a way out, attached to the Issue itself:
      [Fix] a wizard or prepared action, where one exists ·
      [Open …] a fix link into the exact panel, device or
      service already selected · [Report] a one-click
      diagnostics bundle, shown to the user first, private
      items removable · [Dismiss] with the reason recorded

An Issue is not a log line and not a notification: it is a
standing item with a state (new / acknowledged / fix offered /
resolved / dismissed) that other modules can also raise through
the same path (ENVIRONMENT-MANAGER.md §8 rule 3). The Monitor app
and nct-security-manager raise Issues too; they do not invent channels.

## 4. nct-device-centre — drivers and laptop frictions, built in

The device tree (from the bridge: udisks2, BlueZ, bolt,
libfprint, kernel modules, firmware) with, per device: what it
is, whether it works, **which layer is failing if not**, and
the action for that layer. The common laptop frictions are
designed cases, not support articles:

| Friction | What the system knows | What the centre does |
|---|---|---|
| Kernel update breaks a DKMS / Nvidia driver | DKMS status per kernel ↔ driver pair; which pairs have booted successfully | **Pre-flight before reboot**: build for the new kernel first; if the build fails, the update waits with the reason shown — never reboot into a known-broken pair. Driver Rollback = return to the last pair that booted |
| Secure Boot blocks a module | built ≠ signed ≠ enrolled ≠ loaded are four separate checkable states; MOK enrolment pending | Shows which of the four states failed; the enrolment wizard explains the one-time reboot screens *before* rebooting |
| Hybrid GPU confusion | switcheroo-control state, per-app GPU preference, which GPU an output is wired to | GPU mode + per-app choice in one place; says plainly when an external display is wired to the discrete GPU and what that implies |
| Wi-Fi "no adapter found" | the journal names the exact missing firmware file | The Issue names the firmware and offers its install; the centre shows adapter present / firmware missing, not absence |
| Fingerprint reader silently unsupported | libfprint's supported-device list by USB ID | States supported / not supported for this exact reader; never just omits the panel |
| Webcam (IPU6-class) "no camera" | per-layer health: sensor, firmware, libcamera, PipeWire | Shows the layer that fails instead of a binary no-camera |
| Suspend battery drain (s2idle) | /sys/power/mem_sleep, S0ix residency, UPower history | A "last sleep" report after resume: how long, how much drain, what blocked deep sleep |
| Power profiles that mean nothing | which backend is in force (PPD vs TLP) | Names the backend; a conflict is an Issue, not a silent no-op |
| Dock attached, half the devices missing | bolt authorisation state (authorised = 0) | Prompts to enrol the dock — video passing while USB / network wait for authorisation is explained, not mysterious |
| Audio "Dummy Output" | codec / DSP firmware / topology layers (SOF) | Per-layer state, as with the webcam |

Driver installation follows the driver-manager precedent
(Ubuntu's Additional Drivers, Manjaro's mhwd) with the gap
closed: those tools verify at install time only — the centre
**re-verifies after every kernel, Secure Boot or driver
change**, through the watch (§3).

## 5. nct-recovery-manager — when the desktop itself is broken

Recovery cannot be an app inside the desktop that failed to
start. It lives beside the session in the hierarchy
(ENVIRONMENT-MANAGER.md §1), booted instead of the normal system,
on its own small known-good display stack (basic driver, fixed
resolution — the render ladder's lowest rung, generalised).

- **Entry**: a boot-menu entry, always; and **automatic** —
  after repeated failed boots or a failed desktop start, the
  next boot offers recovery first instead of looping.
- **Graphical repair environment**, a short menu of repairs:
  - *Startup Repair* — fstab entries that don't resolve, full
    disk, failed services, unfinished kernel install; each
    finding in plain language with a Fix action; edited mount
    configuration is validated and test-mounted before saving.
  - *Driver Rollback* — the kernel ↔ driver pairs that have
    actually booted (§4), return to the last that worked;
    boot parameters (nomodeset and friends) as explained
    checkboxes, not a hand-edited line.
  - *Package Rescue* — finish interrupted configuration,
    repair broken dependencies, clear a stale lock after
    checking its holder is gone, reinstall the desktop's core
    set; removing a package the desktop depends on is blocked
    with a graphical explanation.
  - *Snapshots* — a timeline: pick a point before the
    breakage, see what changed since, restore. Updates take a
    snapshot *before* applying, as a standing guarantee.
  - *Password reset* and *file rescue* to external media.
- **Emergency TUI** when even the recovery graphics cannot
  run: full-screen, menu-driven (arrow keys, no commands to
  recall) — the same repairs, numbered; a shell is the last
  item, labelled as the manual option. (Precedents: Ubuntu
  friendly-recovery, nmtui.)
- **Same grammar as the desktop**: recovery tools are NCTXML
  programs in a reduced hosting, raising the same receipts —
  a repair done in recovery appears in System Changes when
  the desktop next starts.

## 6. Build order

    Slice A  sys-interface skeleton: systemd + journal
             subscriptions republished on the desktop bus;
             the system object tree with a Services view and
             a Logs view as proofs of reflection.
    Slice B  system-watch triage for the two loudest silences:
             failed units and coredumps → Issues in an
             Attention inbox, each with Open / Report actions.
    Slice C  device-centre tree with the Secure Boot four-state
             check and DKMS pre-flight; power-backend naming.
    Slice D  recovery: boot entry + emergency TUI first
             (cheapest, covers the worst case), graphical
             environment and its wizards after.

Later: SMART / firmware / dock / sleep Issues join the watch
as their bridge sources land; snapshot guarantee joins
PackageKit updates; fix links become the form support gives.
