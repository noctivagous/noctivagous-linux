# Linux Desktop Environments — System Interface Research

Research date: 2026-11-26. All sources read via web index (`browser_search`) on 2026-11-26 unless otherwise noted; no live-browser verification was performed. Primary documentation (freedesktop/systemd, GNOME/KDE/Xfce, Ubuntu, Microsoft, Apple) was favoured; forum/how-to sources are used only as evidence of current user experience and known failure modes.

## Summary

A modern Linux desktop does not need to invent system interfaces: systemd, logind, the journal, and a family of D-Bus system services (UPower, NetworkManager, BlueZ, udisks2, PackageKit, polkit, AccountsService, hostnamed/timedated/localed, firewalld, fwupd) already expose almost all relevant state **with live change notification** — D-Bus signals and `PropertiesChanged`, journal follow/cursors, and `Subscribe()` on the systemd Manager. The failure of current desktops is not lack of data; it is lack of *surfacing*. By default a failed systemd unit, a DKMS build failure, a missing firmware file, an unauthorised Thunderbolt dock, or a failing disk's early SMART warnings either produce no desktop notification at all or produce one only if a specific optional component happens to be installed and running. Recovery is similarly fragmented: GRUB text menus, a text recovery menu (Ubuntu), TTYs, initramfs shells, snapshot rollback (openSUSE/Mint/Fedora Atomic) and live USBs exist, but there is no mainstream Linux equivalent of the single graphical repair environment that Windows (WinRE) and macOS (Recovery) provide. Sections 1–4 document the interface surface, how GNOME/KDE/Xfce map it, what actually reaches the user, and what repair paths exist. Section 5 distils design lessons, including the user's unified-hierarchy constraint (§5.4). Section 6 covers driver and laptop frictions in the same three-part pattern: what the system already knows, what the user currently experiences, and what mechanism a new desktop could adopt or improve.

---

## 1. System interface surface

### 1.1 systemd — units, jobs, targets

- Interface: `org.freedesktop.systemd1`, Manager object at `/org/freedesktop/systemd1`. Methods include `ListUnits`/`ListUnitsFiltered`, `StartUnit`/`StopUnit`/`RestartUnit`/`ResetFailedUnit`, `GetDefaultTarget`/`SetDefaultTarget`. Unit objects expose `LoadState`, `ActiveState`, `SubState`, plus per-type properties.
- Live notification: **yes, but opt-in.** A client must call `Subscribe()`; only then does it receive `UnitNew`/`UnitRemoved`, `JobNew`/`JobRemoved` (job result includes `failed`), and `StartupFinished`, plus `org.freedesktop.DBus.Properties.PropertiesChanged` per unit. A desktop that does not subscribe sees nothing — this is the root of the failed-unit silence in §3.
- Privileged operations are gated by polkit, so a desktop can offer restart/reset actions without running privileged itself.
- Source: https://www.freedesktop.org/wiki/Software/systemd/dbus/

### 1.2 systemd journal — structured, followable logs

- Structured fields a desktop can render/filter on: `MESSAGE` (primary user-facing text), `MESSAGE_ID` (128-bit, stable per event type — suitable for deduplication and "don't show again for this exact event"), `PRIORITY` 0 (`emerg`) to 7 (`debug`), `CODE_FILE`/`CODE_LINE`/`CODE_FUNC`, a `DOCUMENTATION=` URL field, trusted fields `_PID`/`_UID`/`_GID`, and kernel fields.
- Kernel messages reach journald via `/dev/kmsg`; unlike the fixed-size dmesg ring buffer (which wraps), journald persists them.
- Live notification: **follow, not signals.** Consumption is cursor/seek plus `sd_journal_wait` / `journalctl -f`. A desktop health service should hold a cursor and tail new entries filtered by priority and `MESSAGE_ID`, rather than polling or scraping `dmesg`.
- Source: https://www.freedesktop.org/software/systemd/man/261/systemd.journal-fields.html

### 1.3 logind — sessions, seats, power keys, sleep/shutdown preparation

- Interface: `org.freedesktop.login1`. Signals `SessionNew`/`SessionRemoved`, `UserNew`/`UserRemoved`, `SeatNew`/`SeatRemoved`, `PrepareForShutdown`, `PrepareForSleep`. Properties include `IdleHint`, `BlockInhibited`/`DelayInhibited`, and configuration reflection such as `HandlePowerKey`/`HandleLidSwitch`.
- Live notification: yes, signals + properties. `PrepareForSleep`/`PrepareForShutdown` are what let a desktop (and apps) react *before* the transition — and, for §6, correlate sleep/wake with battery drain.
- Source: https://www.freedesktop.org/wiki/Software/systemd/dbus/ (logind interfaces documented alongside systemd D-Bus APIs)

### 1.4 The D-Bus system-service family

| Service | State/events a desktop can show | Live notification? |
|---|---|---|
| **UPower** (`org.freedesktop.UPower`) | `EnumerateDevices`, `OnBattery`, `LidIsClosed`, per-device battery level, energy-rate, energy-full vs energy-full-design (wear) | Yes — `DeviceAdded`/`DeviceRemoved`, per-device `PropertiesChanged` |
| **NetworkManager** | Overall `State`, connectivity check result, per-device `StateChanged` **with reason** | Yes — `StateChanged`, `PropertiesChanged`, `CheckConnectivity`. GNOME Control Center, KDE applets and `nmcli` all consume the same API via libnm |
| **BlueZ** | `org.bluez.Adapter1` / `Device1` objects, pairing/connection state | Yes — ObjectManager `InterfacesAdded`/`Removed` + `PropertiesChanged` |
| **udisks2** | Drive/Block/Filesystem objects; SMART via `org.freedesktop.UDisks2.Drive.Ata` (see §1.6) | Yes — standard D-Bus property changes |
| **PackageKit** | Available updates, transaction progress/results, restart-required | Yes — `UpdatesChanged`, `TransactionListChanged`, `RepoListChanged`, `RestartSchedule`; transaction signals `Package`, `ErrorCode`, `Finished`, `RequireRestart`, `UpdateDetail` |
| **polkit** | Authorisation decisions for privileged actions | Authority lives on the system bus; the **per-DE authentication agent in the session** shows the prompt. If no agent is running, privileged GUI actions cannot prompt and appear to silently fail — a desktop must treat "agent present" as part of its own health |
| **AccountsService** | `org.freedesktop.Accounts` / `.User`, user add/remove/change | Yes — signals on add/remove/change |
| **hostnamed / timedated / localed** | `org.freedesktop.hostname1` / `timedate1` / `locale1` | Yes — `PropertiesChanged`; polkit actions e.g. `org.freedesktop.hostname1.set-hostname`; daemons activate on request and exit when idle |
| **firewalld** | Zones, runtime vs permanent configuration | Yes — D-Bus interface documented in `firewalld.dbus(5)` |

Sources: UPower https://upower.freedesktop.org/docs/UPower.html ; NetworkManager https://people.freedesktop.org/%7Elkundrak/nm-docs/gdbus-org.freedesktop.NetworkManager.html ; PackageKit https://packagekit.freedesktop.org/doc/dbus-org.freedesktop.packagekit1.html ; AccountsService https://www.freedesktop.org/projects/AccountsService/ ; firewalld https://manpages.debian.org/bullseye/firewalld/firewalld.1 ; polkit https://doc.opensuse.org/documentation/leap/security/html/book-security/cha-security-polkit.html

### 1.5 Crashes — systemd-coredump and coredumpctl

- systemd-coredump is the kernel `core_pattern` pipe handler: it compresses cores to `/var/lib/systemd/coredump/` and writes a journal entry (one secondary source gives MESSAGE_ID `fc2e22bc6ee647b6b90729ab34a250b1`). `coredumpctl list/info/dump/debug` queries that data.
- Crucially, coredump by itself **pushes nothing to the user**. Something else (ABRT, Apport, DrKonqi — §2/§3) must watch and present it. A new desktop should treat the coredump journal entry as its crash event source.
- Source: https://manpages.debian.org/unstable/systemd-coredump/coredumpctl.1.en.html

### 1.6 SMART disk health — udisks2

- `org.freedesktop.UDisks2.Drive.Ata` exposes `SmartFailing`, `SmartNumAttributesFailing`, `SmartNumBadSectors`, `SmartSelftestStatus`, plus `SmartUpdate()` and `SmartGetAttributes()`. Because these are ordinary D-Bus properties, a desktop can be notified on change rather than polling `smartctl`.
- Source: https://storaged.org/doc/udisks2-api/latest/gdbus-org.freedesktop.UDisks2.Drive.Ata.html

### 1.7 Firmware updates — fwupd / LVFS

- fwupd is a system-activated daemon with a D-Bus interface usable by unprivileged clients; privileged operations are polkit-gated. GNOME Software queries fwupd over D-Bus at session start, downloads LVFS metadata/firmware, and the user must explicitly agree. UEFI updates are staged on the ESP and applied at reboot via capsule update — i.e. firmware has a *pending-reboot* state a desktop can and should display.
- Source: https://lvfs.readthedocs.io/en/latest/intro.html

### 1.8 xdg-desktop-portal — the app↔desktop boundary (not a health channel)

- Session-bus portals for sandboxed apps include Notification (`AddNotification`, actions via `ActionInvoked`; notifications can outlive the app), Settings (read-only standardised settings with a change signal), FileChooser, ScreenCast, NetworkMonitor, PowerProfileMonitor, MemoryMonitor, etc.
- Design note: portals standardise how *apps* ask the desktop for things. They are not a channel for system health; system problems need the systemd/D-Bus/journal path above, presented through the desktop's own notification system.
- Source: https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Notification.html

---

## 2. How existing DEs map the system

### 2.1 GNOME

- **Settings:** gnome-control-center panels over the D-Bus services in §1 (network via NetworkManager, power via UPower/power-profiles-daemon, users via AccountsService, etc.).
- **Logs:** GNOME Logs is a journal viewer categorising events (applications / system / security / hardware). It is **pull-only**: the user must already suspect a problem and open it.
- **Disks/health:** GNOME Disks plus a gnome-settings-daemon plug-in that warns on SMART failure — with deliberate suppression ("Don't present 'disk is failing' notification more than once"). gsd-housekeeping issues low-disk-space warnings governed by `org.gnome.settings-daemon.plugins.housekeeping` thresholds/ignore-paths; users report warnings that are hard to suppress per-path.
- **Crashes:** via the distro layer (ABRT on Fedora, Apport on Ubuntu), not GNOME itself.

### 2.2 KDE Plasma

- **System Settings** built from KCM modules; **KInfoCenter** provides read-only modular system/hardware information (About System, Memory, Energy, Device Viewer, graphics/Wayland, and a firmware-security module `kcm_firmware_security`) — the closest existing thing to a unified "system status" view, but it is informational, not a triage inbox.
- **Logs:** KSystemLog / Journald browser — again pull-only.
- **Crashes:** DrKonqi (see §3).

### 2.3 Xfce

- xfce4-settings provides a Settings Manager/Editor covering **desktop-scoped** dialogs only (appearance, display, keyboard, session, panel, workspaces, per the official docs). There is no system-services view, no journal integration, and no problem-reporting integration: system state is left to distro tools and the CLI. This is a deliberate lightness trade-off, but it means the "system" half of the computer is invisible in the desktop.
- Source: https://docs.xfce.org/xfce/xfce4-settings/4.18/start

### 2.4 Where they fall short / "out of sync"

- **Failed services fail silently in all three** by default (see §3) — the single clearest gap.
- **Duplicate/competing network stacks:** NetworkManager and systemd-networkd (or dhcpcd/iwd) cannot manage the same interfaces simultaneously; distro guidance for GNOME explicitly advises disabling systemd-networkd when enabling NetworkManager, otherwise GNOME Settings' network panel does not reflect reality. Sources (index): Arch forum discussion; Gentoo GNOME guide.
- **Settings fighting the system:** a documented (2011, so dated) GNOME case: the Settings network panel erroring "The system network services are not compatible with this version" on a NetworkManager API mismatch — the desktop presenting an error about its own backend rather than the system's state. Source (index): GNOME mailing list, 2011.
- No single authoritative source was found that phrases the problem as desktops being "out of sync" with the system; that framing is the mission's. The concrete, citable instances are the two above plus the silent-failure gap. Treat the broader claim as synthesis, not as a cited fact.

---

## 3. Floating problems up — what the user actually sees

| Problem | Mechanism today | What the user actually sees |
|---|---|---|
| App/service crash | ABRT (Fedora/RHEL), Apport (Ubuntu), DrKonqi (KDE) | See below — inconsistent, distro-dependent |
| systemd unit fails at boot | systemd state + journal only | **Nothing, by default.** No desktop notification exists; DIY `OnFailure=` + `notify-send` how-tos exist precisely because of this gap |
| Disk failing (SMART) | udisks2 → GNOME Disks / gsd plug-in | A warning, but deliberately shown at most once in GNOME; nothing continuous |
| Low disk space | gsd-housekeeping (GNOME) | Warning notification; per-path suppression is awkward (user reports) |
| Updates available / restart required | PackageKit signals → GNOME Software / KDE Discover | Generally works — the best-functioning channel, because PackageKit was designed with signals (`UpdatesChanged`, `RequireRestart`) and the DEs consume them |
| Firmware update pending | fwupd → GNOME Software | Works when the user opens Software / at session start; reboot-to-apply state is shown there, not in a persistent system status |

### 3.1 Crash reporting in practice

- **ABRT (Fedora/RHEL):** hooks forward crashes to `abrtd`; reports are stored in `/var/spool/abrt`. A desktop pop-up appears **only if `abrt-desktop` is installed**. Investigation is via `gnome-abrt` GUI or `abrt-cli`. Anonymous µReports go to ABRT Analytics/FAF; Bugzilla reporting requires an account and a sensitive-data review step. Sources: https://developer.fedoraproject.org/tools/abrt/about.html ; https://abrt.readthedocs.io/en/latest/howitworks.html
- **Apport (Ubuntu):** intercepts crashes and writes `/var/crash/*.crash`; update-notifier watches `/var/crash` and launches the dialog; whoopsie uploads `.upload`-marked reports to the error tracker (daisy / errors.ubuntu.com). Ubuntu's own docs note Apport's automatic interception is **not enabled by default in stable releases** (sensitive data among the reasons), and error reporting is managed in Settings → Privacy & Security → Telemetry (Manual by default). Source: https://ubuntu.com/project/docs/contributors/debugging/error-tracker/
- **DrKonqi (KDE):** since Plasma 5.24, crashes are routed through systemd-coredump: `drkonqi-coredump-processor@.service` is `WantedBy=systemd-coredump@.service`, waits for the journal entry, then socket-activates `drkonqi-coredump-launcher` in the crashed user's session — enabling after-the-fact reporting of past crashes. Source: https://www.haraldsitter.eu/posts/plasma-crash-course-drkonqi/
  - **Documented failure mode:** KDE bug 500179 (Plasma 6.3.0) — DrKonqi itself crashed when a crash occurred in a non-graphics environment (KWin Wayland down, "Failed to create wl_display"). The reporter depends on the very compositor whose failure it is meant to report. This is a direct design lesson for §5: the problem-surfacing path must not depend solely on the graphical session it monitors.

### 3.2 The central gap: failed units

By default systemd only flips a unit to `failed` and writes to the journal. Multiple independent how-tos exist solely to bolt on notification with `OnFailure=` plus a templated `notify-send -u critical` unit, and they explicitly note you will "probably miss failures" if you rely on checking `systemctl --failed`. A mechanism that requires every user to hand-write a systemd unit to learn that a service failed is, by definition, a desktop-layer omission.

Sources: https://makandracards.com/operations/529660-desktop-notification-failed-systemd-user-services ; https://www.pingwire.dev/blog/systemd-service-failure-alerts

### 3.3 Assessment

The pattern across §3: surfacing works where (a) the backend was designed with signals **and** (b) a dedicated desktop component was written to consume them (PackageKit→Software, fwupd→Software, udisks→gsd). It fails where either half is missing: systemd has the signals but no consumer; coredump has the data but needs ABRT/Apport/DrKonqi as an optional add-on; the journal has everything but only pull-only viewers (GNOME Logs, KSystemLog).

---

## 4. Emergency and repair

### 4.1 What Linux has today

- **systemd targets:** `emergency.target` — emergency shell on the main console, no other services or mounts, root filesystem read-only; the most minimal state. `rescue.target` — single-user mode with local filesystems mounted. `graphical.target` is the normal default. Any target can be forced at boot with the `systemd.unit=` kernel command line. Source: https://manpages.ubuntu.com/manpages/jammy/man7/systemd.special.7.html
- **Ubuntu friendly-recovery:** the GRUB "(recovery mode)" entry boots to rescue plus a text Recovery Menu: resume, clean (free space), dpkg (repair broken packages), fsck, grub (update bootloader), network, root shell, system-summary. (A graphical failsafeX existed in older releases and is gone.) This is the closest mainstream Linux gets to WinRE — and it is a text menu reached via GRUB.
- **TTY fallback:** logind provides virtual consoles (`NAutoVTs=6`, `autovt@` → `getty@`); Ctrl+Alt+F3 login works when the GUI does not. (Fedora 45 Beta reportedly switches the console to kmscon — index-only, unverified in a primary source.)
- **Initramfs fallback:** an initramfs shell (e.g. `break=mount`) and, as a last resort, `init=/bin/bash` — powerful, entirely undocumented from within the system itself.
- **Snapshots/rollback:**
  - openSUSE **Snapper** on Btrfs: pre/post snapshots around each zypper transaction, integrated into the boot menu; boot a read-only snapshot, verify, then `snapper rollback`. Rollback covers root only (`/home`, `/var`, `/srv`, `/opt` excluded, so logs survive a rollback). Known weakness: snapshots can fill the root partition and Btrfs free-space estimates are unreliable. Source: https://www.theregister.com/software/2024/08/01/linux-updates-with-an-undo-function-some-distros-have-that/618233?td=rt-4a
  - **Timeshift** (shipped by Linux Mint): Btrfs snapshots or an rsync fallback; restore usually performed from a live USB.

### 4.2 Comparison: WinRE and macOS Recovery

- **Windows WinRE** (Microsoft, official) offers, in **one graphical environment**: System Restore to a point in time, Reset this PC (keep or remove files), Startup Repair (automatic diagnosis), Startup Settings (including Safe Mode), Command Prompt, Uninstall Updates, and UEFI Firmware Settings. Secondary sources report WinRE is entered automatically after repeated failed boots. Source: https://support.microsoft.com/en-us/windows/experience/backup-recovery/windows-recovery-environment
- **macOS Recovery** (Apple, official) offers: Time Machine system restore, Reinstall macOS, Disk Utility (First Aid repair/erase), a web browser, safe mode, and security-policy tools. Source: https://support.apple.com/guide/mac-help/macos-recovery-a-mac-apple-silicon-mchl82829c17/mac
- **Gap:** mainstream Linux has every *capability* on those lists (fsck, package repair, snapshot rollback, reinstall) but split across GRUB menus, a text menu, TTYs and live USBs, with no single graphical repair environment and no automatic entry after repeated failed boots.

### 4.3 Newer work that changes the picture

- **systemd-sysupdate:** atomic A/B (or A/B/C…) partition/file/directory updates, driven by `systemd-sysupdate.service`/`.timer` with a separate reboot timer/service. It is the update mechanism behind GNOME OS (per a secondary explainer; GNOME OS downloads ~2 GB full images, delta updates planned). Source: https://www.freedesktop.org/software/systemd/man/261/systemd-sysupdate.html
- **systemd soft-reboot** (since systemd 254): a userspace-only reboot via `soft-reboot.target` / `systemd-soft-reboot.service` — SIGTERM then SIGKILL to userspace, optional root switch via `/run/nextroot/`, PID 1 re-executes. Kernel, firmware, bootloader and initrd are **not** re-run, so it speeds up userspace restarts but cannot fix kernel-level breakage. Source: https://man.archlinux.org/man/systemd-soft-reboot.service.8.en
- **Fedora Atomic (Silverblue etc.):** rpm-ostree/OSTree deployments; update via GNOME Software or `rpm-ostree update`; deployments can be pinned; rollback is choosing the previous GRUB entry and/or `rpm-ostree rollback`. bootc (container-image-based) is the successor direction. Source: https://fedoramagazine.org/how-to-rebase-to-fedora-linux-42-on-silverblue/
- **Ubuntu Core:** named in the mission; its recovery/update model was **not substantively verified** in this research — see Could-not-verify. No claims are made about it here.

---

## 5. Design lessons

### 5.1 Faithful live reflection of system state

1. **Subscribe, don't poll, and don't scrape.** The interfaces already push: systemd `Subscribe()` + `PropertiesChanged`, D-Bus signals from UPower/NetworkManager/BlueZ/PackageKit/AccountsService, journal follow with a persistent cursor, udisks2 property changes. A desktop built on these is live by construction; a desktop built on periodic `systemctl`/`dmesg` scraping will always lag and miss transient failures (§1.1–1.6).
2. **One backend per domain, visibly.** The NetworkManager-vs-networkd conflict (§2.4) shows what happens when two managers own one domain: Settings stops reflecting reality. The desktop should name its backend per domain and warn when a competing manager is active.
3. **Keep the polkit agent and the notification path in the desktop's own health model.** If the auth agent is not running, privileged actions fail silently (§1.4); the desktop should detect and report its own missing pieces.

### 5.2 A triage path, not a log line

4. **Every surfaced problem needs: what happened, in plain language; why it matters; and an action.** The journal already supplies the raw material — `MESSAGE` for text, `PRIORITY` for severity ranking, `MESSAGE_ID` for deduplication, `DOCUMENTATION=` for a help link (§1.2). Failed units (§3.2), coredump entries (§1.5), SMART changes (§1.6) and PackageKit `ErrorCode`/`RequireRestart` (§1.4) should all land in one triage inbox with actions (restart unit, reset-failed, view journal entry, run disk self-test, roll back update), not in five separate apps.
5. **Do not suppress like GNOME's SMART warning.** "Show at most once" (§2.1) converts a worsening hardware failure into a forgotten one. Persistent-but-quiet status (an icon/inbox entry that stays until resolved or explicitly dismissed with the risk stated) beats both nagging and one-shot warnings.
6. **The reporter must survive the reported failure.** DrKonqi crashing because KWin was down (KDE bug 500179, §3.1) is the canonical anti-pattern: crash/problem presentation needs a fallback path that does not require the full compositor — e.g. a minimal Wayland/X fallback presenter, or deferral to next successful login with the report preserved (DrKonqi's coredump-processor design already preserves it; only the presentation failed).

### 5.3 A repair environment that works when the desktop doesn't

7. **Ship one graphical repair environment, entered automatically.** WinRE/macOS Recovery (§4.2) set the bar: one place with restore-point/snapshot rollback, package/update repair, disk check, network, and a shell — and automatic entry after repeated failed boots. Linux has all the pieces (§4.1); the work is integration: a minimal graphical session on its own target, a boot counter that drops into it after N failed graphical boots, and menu entries wired to fsck, package repair, snapshot rollback (Snapper/Timeshift/OSTree) and previous-kernel boot.
8. **Make rollback a first-class, pre-update guarantee.** Snapper's pre/post transaction snapshots and Fedora Atomic's pinned deployments (§4.1, §4.3) prove the model. A new desktop on an image-based or snapshot-based base can offer "undo this update" as a button; on a traditional package base it cannot honestly do so.
9. **Know the limits of soft-reboot.** Soft-reboot (§4.3) is a fast userspace restart, useful for applying userspace updates — it is not a repair mechanism for kernel/driver breakage, and the repair design must not pretend otherwise.

### 5.4 Unified design: one hierarchy under a single root (user's design constraint)

The user requires the new desktop's modules to be arranged in **one hierarchy under a single root**, so the system does not feel fragmented and disconnected, and will apply this as a design rule regardless of the evidence. What the sources say, for and against:

**Supporting a unified hierarchy:**

- **systemd is the existence proof at the system layer.** It was explicitly built to "unify service configuration and behavior across Linux distributions" and, as an integrated suite, it *replaced* a loose collection of separate tools — init scripts, syslog, cron/atd, pm-utils, inetd, acpid, watchdog, login and device handling — with one framework: one service manager, one logging interface (journald), one dependency model, one configuration format. Contemporary analyses credit exactly this unification for its adoption: distributions had been dealing with "boot scripts, logging systems, device managers, and session managers [that] were often loosely connected components developed for completely different projects," and systemd "brought many of these responsibilities together under a single framework." A desktop hierarchy rooted in that already-unified layer (units → journal → D-Bus services, §1) inherits a coherent tree instead of inventing one. Sources: https://en.wikipedia.org/wiki/eudev (systemd overview as returned by the index) ; https://www.howtogeek.com/4-linux-init-systems-that-almost-replaced-systemd-and-why-they-failed/
- **GNOME's own design research reached the same conclusion for settings.** GNOME's Settings research states the goal verbatim: "GNOME should have a unified System Settings window for configuring anything that is not application-specific," replacing the split "Preferences" / "Administration" menus, with one shell providing categorisation, history navigation and search across all panels — and it notes Windows' Control Panel, macOS System Preferences and KDE's System Settings had all already converged on the unified-window model. GNOME as a project likewise describes itself as "primarily united around a single effort — the creation of the GNOME desktop experience… a tightly-integrated desktop environment… Above all else, our interest is to create a cohesive product." Sources: https://wiki.gnome.org/Design(2f)Apps(2f)Settings(2f)Research.html ; https://lists.gnome.org/archives/release-team/2012-July/msg00064.html
- **KDE shows a hierarchy can stay modular underneath.** Plasma's settings are individual KCMs (KDE Config Modules) that can also run standalone via `kcmshell6`, yet they are presented inside the single System Settings application; KDE's HIG describes KCMs as pages that "can either appear in Plasma's System Settings app, or as standalone configuration dialogs." Unity of *presentation* does not require monolithic *implementation*. Sources: https://wiki.manjaro.org/index.php?title=Special:MobileDiff/53686&mobileaction=toggle_view_mobile ; https://www.my-scratch.de/HIG/platform/settings.html
- **Fragmentation is the most-cited user-facing criticism of the Linux desktop generally.** Commentary across the spectrum describes distros as "assembled haphazardly from a thousand disparate components, with little to no integration," and new users as disoriented by facing disconnected choices at every layer. Even the pro-fragmentation counter-argument (It's FOSS) concedes the perception and reframes it as an ecosystem property — i.e. it defends diversity *between* platforms, not disconnectedness *within* one product. Sources: https://WWW.Dedoimedo.com/computers/linux-old-problems-new-solutions.html ; https://pbxscience.com/the-linux-desktop-fragmentation-problem-and-the-slow-road-to-unity/ ; https://itsfoss.com/opinion/linux-fragmentation-as-positive/

**Undermining / cautioning:**

- **Xfce demonstrates the opposite, deliberate philosophy — and its users value it.** Xfce "embodies the traditional UNIX philosophy of modularity and re-usability. It consists of a number of components… packaged separately, and you can pick among the available packages." Its Settings Manager does gather component settings into one window, but the components remain genuinely separate and replaceable (Xfwm, Xfdesktop, Xfce4-session, Xfconf). The caution for a unified hierarchy: if the single root becomes a single point of failure or forces fusion of components, it loses the replaceability that makes Xfce resilient — notably, a fused shell is exactly what made DrKonqi's failure mode (§3.1) possible. Sources: https://www.fosslinux.com/41430/top-10-reasons-to-use-xfce-as-your-desktop-environment.htm ; https://opensource.com/article/19/12/xfce-linux-desktop
- **systemd's unification is also the main criticism of systemd.** The same sources note critics charge it with feature creep, a larger attack surface, and violating the "small tools" Unix philosophy, to the point of distributions existing solely to replace it. A unified desktop hierarchy should expect — and design for — the same objection: keep module boundaries and external interfaces (D-Bus, portals) clean so a module can be replaced without breaking the tree.
- **A unified window does not by itself unify the system.** GNOME's research predates GNOME 3, yet §2.4's conflicts (two network managers, settings panels erroring against their own backend) occurred *inside* unified settings apps. The hierarchy must be rooted in the actual system object tree (systemd units, D-Bus objects, devices) — one root over real objects — rather than being a launcher skin over disconnected tools, or it reproduces the fragmentation it was meant to hide. The GNOME/KDE "System Settings" name-collision dispute (LWN) is a small illustration: two hierarchies with the same root name confused users precisely where environments were mixed. Source: https://lwn.net/Articles/453076/

**Net assessment for the design rule:** the evidence supports a single-root hierarchy as the *presentation and navigation* model (GNOME's research, KDE's KCM-in-one-app model, systemd as the unified substrate), provided (a) modules remain separately replaceable behind standard interfaces (the Xfce/KCM lesson), and (b) the root of the tree is the real system state (§1), so health, settings, drivers (§6) and repair (§4) are branches of one tree rather than separate applications.

---

## 6. Driver and laptop frictions

For each friction: **what the system already knows** → **current user experience** → **mechanism to adopt/improve**.

### 6.1 NVIDIA drivers, kernel updates and DKMS

- **Knows:** whether a module is built for the *target* kernel (`dkms status`, DKMS build log in the journal), and whether a signed pre-built driver exists. Ubuntu's official docs recommend `ubuntu-drivers` / Additional Drivers, which by default installs pre-built **signed** drivers "known to work with Secure Boot"; the DKMS package instead "builds the NVIDIA driver for the exact kernel that you're running" — so every kernel update is a rebuild event whose success or failure is knowable *before* reboot.
- **Current UX:** users typically discover a failed rebuild only as a black screen or fallback graphics at next login.
- **Adopt/improve:** a pre-flight check before rebooting into a new kernel (module built for that kernel? previous bootable kernel retained?), and a DKMS-failure notification with actions: boot previous kernel / rebuild / switch to the signed pre-built driver.
- Source: https://ubuntu.com/desktop/docs/en/26.04/how-to/graphics/install-nvidia-drivers/

### 6.2 Secure Boot / MOK enrolment blocking modules

- **Knows:** four distinguishable states — module *built*, *signed*, key *enrolled*, module *loaded* — via `mokutil --sb-state` / `--test-key`, `modinfo` signer fields, and dmesg lockdown lines ("Loading of unsigned module is rejected").
- **Current UX:** a documented case (NVIDIA forums, 2025): `dkms status` reports `installed`, but `modprobe nvidia` fails with "Key was rejected by service" because `/var/lib/shim-signed/mok/MOK.der` was never enrolled. The fix — `mokutil --import`, reboot, complete the blue MOK Manager screen with a one-time password, and point `/etc/dkms/framework.conf` at the MOK key so future builds are signed — is entirely CLI + firmware-screen archaeology. DKMS's job ends when the `.ko` is in place; **signing ≠ enrolment**, and no mainstream DE displays any of the four states.
- **Adopt/improve:** surface a pending-enrolment state *before* reboot ("Reboot and enrol — you will see a blue screen; choose Enroll MOK; enter the password you just set"), then verify enrolment and module load after boot.
- Sources: https://forums.developer.nvidia.com/t/unexpected-driver-behavior-secure-boot-blocks-drivers-or-primary-display-freezes/334350 ; https://www.ssdnodes.com/learn/nvidia-module-key-was-rejected-secure-boot

### 6.3 Hybrid graphics (Optimus / PRIME)

- **Knows:** GPU topology and per-app GPU assignment. PRIME render offload runs selected apps on the dGPU (`__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia`, `prime-run`); `prime-select` switches between `on-demand|nvidia|intel` modes. **switcheroo-control** is the existing DE-integrated mechanism: a D-Bus dual-GPU service that defaults to the iGPU to save power, gives GNOME a right-click "Launch using Dedicated Graphics Card", and honours the `PrefersNonDefaultGPU` desktop-entry key (`switcherooctl list/launch`).
- **Current UX / traps:** three opaque mode names; per EnvyControl's FAQ, many laptops wire external HDMI ports to the dGPU only, so integrated-only mode silently kills external displays; full-NVIDIA mode costs heavy battery/heat; reverse-PRIME external screens can be laggy.
- **Adopt/improve:** show the topology — which port is wired to which GPU, which GPU an app is running on, dGPU power state — instead of mode names alone.
- Sources: https://devtalk.nvidia.com/default/topic/957814/linux/prime-and-prime-synchronization ; https://packages.debian.org/ca/sid/amd64/switcheroo-control ; https://github.com/bayasdev/envycontrol/wiki/Frequently-Asked-Questions

### 6.4 Driver managers: what exists to build on

- **Ubuntu Additional Drivers / `ubuntu-drivers`:** hardware detection → candidate packages → one marked "recommended / proprietary, tested", signed-by-default for Secure Boot.
- **Manjaro `mhwd`:** auto-detects and installs free/nonfree drivers with hybrid-graphics support, runs automatically in the installer; Manjaro's own wiki recommends the Settings Manager "Hardware Detection" GUI for beginners — but mhwd still only installs drivers for PCI graphics cards.
- **Gap both share:** they are *install-time* tools. Neither continuously verifies that the installed driver still works after kernel, Secure Boot or firmware changes (§6.1–6.2). A new desktop should turn the driver manager into a persistent device-health branch of the system tree (§5.4), not a one-off installer.
- Sources: https://ubuntu.com/desktop/docs/en/26.04/how-to/graphics/install-nvidia-drivers/ ; https://wiki.manjaro.org/index.php/Manjaro_Hardware_Detection_Overview ; https://wiki.manjaro.org/index.php?title=Configure_Graphics_Cards&oldid=1049

### 6.5 Wi-Fi / Bluetooth firmware

- **Knows:** the kernel logs the exact missing file, e.g. `iwlwifi … firmware: failed to load iwlwifi-QuZ-a0-hr-b0-77.ucode (-2)`, "no suitable firmware found!" — the same pattern for Bluetooth `intel/ibt-*.sfi` and i915 DMC firmware.
- **Current UX:** Settings says only "No Wi-Fi Adapter Found". The fix (install/reinstall `linux-firmware`, or enable Debian's `non-free-firmware` component) requires tethering or another connection and reading dmesg.
- **Adopt/improve:** translate the journal's exact missing filename into a device card: "Intel AX201 found; firmware file X missing; package Y provides it; connect via USB tethering/Ethernet to install."
- Source: https://www.cyberciti.biz/faq/intel-wifi-on-debian-linux-when-you-get-firmware-failed-to-load-iwlwifi-8265-36-error/

### 6.6 Fingerprint readers

- **Knows:** support is a per-USB-ID list in libfprint; the reader's ID is visible via `lsusb`, and fprintd reports "No devices available" when no driver claims it.
- **Current UX:** documented case — the ThinkPad T480s reader `06cb:009a` is on libfprint's *unsupported* list, so GNOME Settings → Users simply offers no Fingerprint Login option at all; the user must discover the ID themselves and resort to third-party drivers (python-validity/PPAs). When a reader *is* supported, enrolment is properly integrated in GNOME/KDE Settings via fprintd.
- **Adopt/improve:** always show the detected reader with its ID and an explicit state — "no Linux driver exists" vs "driver exists but is not installed" — instead of omitting the panel, which makes a missing driver indistinguishable from missing hardware.
- Sources: https://ubuntuhandbook.org/index.php/2024/02/fingerprint-reader-t480s/ ; https://docs.shani.dev/doc/security/hardware-auth/

### 6.7 Webcams — Intel IPU6 / MIPI cameras

- **Knows:** each layer separately — sensor probe in dmesg (`grep ipu6`), libcamera enumeration (`cam -l`), PipeWire nodes. These are not UVC cameras: they need a sensor driver + firmware + a userspace pipeline.
- **Current UX:** the old stack (out-of-tree DKMS + proprietary HAL + v4l2loopback relay) "broke on kernel updates" and on suspend/resume. The mainline path is kernel IPU6 (in-tree since 6.10) + libcamera's Simple pipeline/SoftISP via PipeWire. In a documented Ubuntu case the stack was present but the sensor ID was not whitelisted by the HAL, so apps saw no camera or cryptic Cheese errors; the realistic advice given was "use a USB webcam and wait for updates".
- **Adopt/improve:** per-layer camera health (sensor seen? firmware loaded? libcamera sees it? apps see it?) instead of a binary "no camera".
- Sources: https://github.com/jetm/blog/blob/HEAD/content/posts/ipu6-webcam-libcamera-on-linux/index.md ; https://discourse.ubuntu.com/t/intel-mipi-laptop-camera-not-working-24-04/63403

### 6.8 Suspend / s2idle battery drain

- **Knows:** the configured sleep state in `/sys/power/mem_sleep` (e.g. `[s2idle] deep`), UPower battery data across the sleep interval, S0ix residency counters, and enumerable blockers (USB wakeup flags in `/sys/bus/usb/devices/*/power/wakeup`). logind's `PrepareForSleep` (§1.3) brackets the interval precisely.
- **Current UX:** a measured Framework 13 (Intel, Ubuntu 24.04) write-up found ~0.53 W / ~0.9 %/h in s2idle at 98.9 % S0ix residency is "about as low as it goes" — s2idle is not S3 deep sleep, and the firmware was validated for s2idle only. Most users just find a drained battery and are sent to forums for CLI spelunking; the mitigation they reach for is logind `HibernateDelaySec` / suspend-then-hibernate.
- **Adopt/improve:** a "last sleep" report after resume — duration, % lost, estimated watts, deepest state reached, top wakeup sources — computed from data already recorded, with suspend-then-hibernate offered as the action when drain is high.
- Source: https://www.sjg.io/writing/suspend-battery-drain-framework-13-ubuntu/

### 6.9 Power management — power-profiles-daemon vs TLP

- **Knows:** power-profiles-daemon (PPD) offers exactly three D-Bus profiles (power-saver / balanced / performance, including the platform profile) and is what GNOME/KDE Settings actually drive. TLP tunes far more — SATA/NVMe/USB/Wi-Fi/PCIe power and ThinkPad charge thresholds via `/sys/class/power_supply/BAT0/charge_control_*_threshold`. UPower already exposes energy-rate and energy-full vs energy-full-design (battery wear).
- **Current UX:** PPD and TLP **conflict and cannot coexist**; installing TLP without removing/masking PPD leaves the desktop showing profiles that no longer mean what they claim — a §2.4-style "settings fighting the system" case at the power layer.
- **Adopt/improve:** one owner of power state, visibly named in Settings; detect a second manager and say so; surface per-model charge-threshold support in the UI instead of a config file.
- Sources: https://www.bigiron.cc/guides/linux-laptop-power-management-tlp-vs-power-profiles-daemon ; https://parrotlinux.org/parrot-linux-battery-life/

### 6.10 Fn keys, keyboard backlight, fan control, vendor features

- **Knows:** these depend on per-vendor platform drivers (ACPI/WMI). Kernel documentation for `thinkpad_acpi` shows it exposing Fn-key combinations, fan control/monitoring, brightness, LEDs and temperature sensors via sysfs. The Huawei-WMI gap list is the negative example: without the WMI driver users lose Fn-lock, keyboard backlight, the microphone-mute LED, fan/temperature readings and charge thresholds.
- **Current UX:** in the desktop these controls are simply **absent** when the driver is missing — indistinguishable from "this laptop never had them".
- **Adopt/improve:** a hardware-capability inventory with three states per feature — present in hardware / driver present / exposed to the desktop — so a missing platform driver is a diagnosable state, not an invisible one.
- Sources: https://docs.kernel.org/6.4/admin-guide/laptops/thinkpad-acpi.html ; https://deepwiki.com/aymanbagabas/Huawei-WMI/1.1-what-is-huawei-wmi

### 6.11 Docks, Thunderbolt and external displays

- **Knows:** bolt's security model: at `user`/`secure` security levels a new dock arrives with `authorized=0` and its PCIe functions (dock USB, Ethernet) stay invisible until authorised/enrolled, while DisplayPort video may pass through. Dock and controller firmware updates arrive via fwupd/LVFS (§1.7).
- **Current UX:** documented Dell WD22TB4 case — displays worked, USB and network were ignored, until `boltctl authorize`/`enroll <uuid>` was run. GNOME/KDE do have a Thunderbolt settings panel for the same action, but **nothing prompts** when a half-working dock is plugged in, so the symptom looks like broken hardware. DisplayLink docks are a separate fragility (out-of-tree `evdi` module, lags new kernels/Wayland).
- **Adopt/improve:** on dock connect, show authorisation state plus per-function status (video / USB / network / audio) and offer enrolment in the notification itself.
- Sources: https://forums.linuxmint.com/viewtopic.php?t=454363 ; https://www.linuxdoc.org/HOWTO/PCMCIA-HOWTO.html

### 6.12 Audio quirks — SOF (Sound Open Firmware)

- **Knows:** modern Intel laptops route audio through a DSP needing SOF firmware **plus** an ALSA topology file, and often model-specific amplifier firmware in linux-firmware — kernel.org's cs35l56 documentation stresses the amp firmware is customised per laptop and "not interchangeable between laptops". The journal shows which module claimed the hardware (`snd_sof_pci` vs legacy `snd_hda_intel`) and any SOF load errors.
- **Current UX:** PipeWire/PulseAudio shows a useless "Dummy Output". The established fix chain is pure CLI: install `sof-firmware` + `alsa-ucm-conf`, check the bound module, check journal SOF errors.
- **Adopt/improve:** an audio device card naming the missing layer (codec seen / DSP firmware missing / topology missing / wrong driver bound) with the providing package as the action.
- Sources: https://kernel.org/doc/html/latest/sound/codecs/cs35l56.html ; https://techaeris.com/2026/09/29/linux-audio-still-breaks-hearts-in-2026/

---

## Could not verify

- **Ubuntu Core's recovery/update model** — named in the mission; not substantively researched. No claims made.
- **How often users actually see ABRT/Apport/DrKonqi dialogs** — no rigorous user-study evidence was found; practice claims in §3 rest on documentation, one KDE bug report (500179), and forum/how-to evidence.
- **The "out of sync" framing (§2.4)** — no single documented source uses that exact framing; it is supported only by the concrete conflict examples cited.
- **Fedora's reported switch to kmscon for virtual consoles** — index-only, secondary source; not confirmed in primary Fedora/systemd documentation.
- **All evidence is web-index only.** Nothing was verified live in a browser, and no live/availability checks apply to this mission.

## Sources

All read 2026-11-26 via web index. Primary documentation first within each group.

**Systemd / freedesktop / system services**
- https://www.freedesktop.org/wiki/Software/systemd/dbus/
- https://www.freedesktop.org/software/systemd/man/261/systemd.journal-fields.html
- https://www.freedesktop.org/software/systemd/man/261/systemd-sysupdate.html
- https://manpages.ubuntu.com/manpages/jammy/man7/systemd.special.7.html
- https://man.archlinux.org/man/systemd-soft-reboot.service.8.en
- https://storaged.org/doc/udisks2-api/latest/gdbus-org.freedesktop.UDisks2.Drive.Ata.html
- https://upower.freedesktop.org/docs/UPower.html
- https://people.freedesktop.org/%7Elkundrak/nm-docs/gdbus-org.freedesktop.NetworkManager.html
- https://packagekit.freedesktop.org/doc/dbus-org.freedesktop.packagekit1.html
- https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Notification.html
- https://manpages.debian.org/unstable/systemd-coredump/coredumpctl.1.en.html
- https://lvfs.readthedocs.io/en/latest/intro.html
- https://www.freedesktop.org/projects/AccountsService/
- https://manpages.debian.org/bullseye/firewalld/firewalld.1
- https://doc.opensuse.org/documentation/leap/security/html/book-security/cha-security-polkit.html

**Desktops, problem reporting, recovery**
- https://developer.fedoraproject.org/tools/abrt/about.html
- https://abrt.readthedocs.io/en/latest/howitworks.html
- https://ubuntu.com/project/docs/contributors/debugging/error-tracker/
- https://www.haraldsitter.eu/posts/plasma-crash-course-drkonqi/
- https://manpages.debian.org/bullseye/gnome-logs/gnome-logs.1.en.html
- https://docs.xfce.org/xfce/xfce4-settings/4.18/start
- https://makandracards.com/operations/529660-desktop-notification-failed-systemd-user-services
- https://www.pingwire.dev/blog/systemd-service-failure-alerts
- https://www.theregister.com/software/2024/08/01/linux-updates-with-an-undo-function-some-distros-have-that/618233?td=rt-4a
- https://fedoramagazine.org/how-to-rebase-to-fedora-linux-42-on-silverblue/
- https://support.microsoft.com/en-us/windows/experience/backup-recovery/windows-recovery-environment
- https://support.apple.com/guide/mac-help/macos-recovery-a-mac-apple-silicon-mchl82829c17/mac

**Unified design (§5.4)**
- https://wiki.gnome.org/Design(2f)Apps(2f)Settings(2f)Research.html
- https://lists.gnome.org/archives/release-team/2012-July/msg00064.html
- https://www.my-scratch.de/HIG/platform/settings.html
- https://wiki.manjaro.org/index.php?title=Special:MobileDiff/53686&mobileaction=toggle_view_mobile
- https://lwn.net/Articles/453076/
- https://en.wikipedia.org/wiki/eudev
- https://www.howtogeek.com/4-linux-init-systems-that-almost-replaced-systemd-and-why-they-failed/
- https://www.fosslinux.com/41430/top-10-reasons-to-use-xfce-as-your-desktop-environment.htm
- https://opensource.com/article/19/12/xfce-linux-desktop
- https://itsfoss.com/opinion/linux-fragmentation-as-positive/
- https://WWW.Dedoimedo.com/computers/linux-old-problems-new-solutions.html
- https://pbxscience.com/the-linux-desktop-fragmentation-problem-and-the-slow-road-to-unity/

**Driver and laptop frictions (§6)**
- https://ubuntu.com/desktop/docs/en/26.04/how-to/graphics/install-nvidia-drivers/
- https://forums.developer.nvidia.com/t/unexpected-driver-behavior-secure-boot-blocks-drivers-or-primary-display-freezes/334350
- https://www.ssdnodes.com/learn/nvidia-module-key-was-rejected-secure-boot
- https://devtalk.nvidia.com/default/topic/957814/linux/prime-and-prime-synchronization
- https://packages.debian.org/ca/sid/amd64/switcheroo-control
- https://github.com/bayasdev/envycontrol/wiki/Frequently-Asked-Questions
- https://wiki.manjaro.org/index.php/Manjaro_Hardware_Detection_Overview
- https://wiki.manjaro.org/index.php?title=Configure_Graphics_Cards&oldid=1049
- https://www.cyberciti.biz/faq/intel-wifi-on-debian-linux-when-you-get-firmware-failed-to-load-iwlwifi-8265-36-error/
- https://ubuntuhandbook.org/index.php/2024/02/fingerprint-reader-t480s/
- https://docs.shani.dev/doc/security/hardware-auth/
- https://github.com/jetm/blog/blob/HEAD/content/posts/ipu6-webcam-libcamera-on-linux/index.md
- https://discourse.ubuntu.com/t/intel-mipi-laptop-camera-not-working-24-04/63403
- https://www.sjg.io/writing/suspend-battery-drain-framework-13-ubuntu/
- https://parrotlinux.org/parrot-linux-battery-life/
- https://www.bigiron.cc/guides/linux-laptop-power-management-tlp-vs-power-profiles-daemon
- https://docs.kernel.org/6.4/admin-guide/laptops/thinkpad-acpi.html
- https://deepwiki.com/aymanbagabas/Huawei-WMI/1.1-what-is-huawei-wmi
- https://forums.linuxmint.com/viewtopic.php?t=454363
- https://www.linuxdoc.org/HOWTO/PCMCIA-HOWTO.html
- https://kernel.org/doc/html/latest/sound/codecs/cs35l56.html
- https://techaeris.com/2026/09/29/linux-audio-still-breaks-hearts-in-2026/
