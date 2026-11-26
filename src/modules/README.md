# modules/ — the desktop module family

Every module of the desktop system (plans/ENVIRONMENT-MANAGER.md §1),
laid out as directories on 2026-11-26 at the owner's direction.
One directory per module, named exactly as the module. Each holds
a README stub: what the module is, what it owns, where it runs
and in what language (plans §9), and its status. Nothing here is
built yet — the stubs make the plan's hierarchy literal in the
tree so work can start module by module without re-deciding the
organisation.

The hierarchy (one root, one tree — the unified-design rule):

    nct-environment-manager
    ├── modes/                      the meta-configurations (PLACEHOLDER):
    │                               computer-use/ (workstation · host · kiosk),
    │                               input-set/ (keyboard-mouse · touchscreen ·
    │                               mouse-only · keyboard-only),
    │                               interaction-modality/ (bimodal-mouse-buttons
    │                               · bimodal · conventional · direct-touch)
    ├── nct-linux-sys-interface     the bridge to the Linux system
    ├── nct-system-watch            failures triaged into Issues
    ├── nct-device-centre           devices and drivers
    ├── nct-window-manager          everything on screen
    │   └── nct-layer-stack         the 12 render layers
    ├── nct-security-manager        security as a whole (repo security/)
    ├── nct-app-registry            programs, distinct from windows
    ├── nct-session-manager         the user's session
    ├── nct-workspace-manager       workspaces
    ├── nct-input-router            how input reaches windows
    ├── nct-keyboard-manager        layouts, input methods
    ├── nct-display-manager         displays
    ├── nct-network-centre          networks
    ├── nct-print-manager           printing
    ├── nct-audio-manager           sound
    ├── nct-storage-manager         disks, volumes, mounts
    ├── nct-account-manager         users and groups
    ├── nct-power-manager           energy saver + battery
    ├── nct-package-coordinator     packages of ALL kinds, one front
    ├── nct-portal-manager          portals, incl. remote desktop
    ├── nct-locale-manager          language, region, i18n
    ├── nct-notification-centre     notifications
    ├── nct-transfer-service        clipboard, drag & drop
    ├── nct-settings-service        the settings registry
    ├── nct-ai-gateway              AI resources for services and apps
    ├── nct-communication-gateway     email, SMS, phone, social
    ├── nct-geo-services            position, maps, weather
    ├── nct-theme-manager           appearance
    └── nct-accessibility-manager   access as a first-class service

Beside the session, in the same hierarchy:

    nct-recovery-manager            when the desktop itself is broken

Deferred, named so it is not invented twice later:

    nct-backup-manager              user-data backup

Conventions:

- The directory name (owner, 2026-11-26): "modules" here means
  DESKTOP modules — the units of this family. It is not the
  kernel sense, and the collision was considered and accepted.
  To keep the two apart in writing: in this tree and its docs,
  a kernel module is always called a "kernel module" in full
  (DKMS builds kernel modules; nct-device-centre watches them),
  never a bare "module".
- Naming (owner, 2026-11-26): every module name carries a suffix
  of one kind or another — no bare nouns. The suffixes are varied
  role words (manager / centre / registry / router / stack /
  watch / interface / service / coordinator), not all "manager":
  a coordinator sits above things that are themselves managers
  (the package coordinator coordinates the package managers).
- A module's directory is where its code will live when built,
  whatever its hosting: service modules hold their daemon code
  here, shell modules their GDScript/C#, even though the shell
  binary assembles them from godot/. The directory is the
  module's home in the source tree, not a deployment unit.
- Existing homes stay: the greetd bridge remains in
  services/bridge/ (session infrastructure, referenced by the
  proven foundation chain), the greeter and shell remain in
  godot/. Modules that grow out of those (nct-session-manager,
  nct-window-manager) point at them from their stubs rather than
  moving proven code.
- When a module's first slice is built, its README stub is
  replaced by a real README in the house style and the build is
  recorded in agent-build-log/.
