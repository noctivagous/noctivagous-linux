# modes/ — the meta-configurations

PLACEHOLDER — laid out 2026-11-26 at the owner's direction.
The axes and their values are named and reserved here; the
design pass that fills them in has not happened yet.

A mode is a meta-configuration: a declaration from which many
modules take a coherent bundle of defaults. Modes are NOT
modules — they implement nothing, and they get no module
directory. The definitions live here, under the root that
coordinates them; each module implements its own slice of a
bundle (see the "Mode slices" section in the affected module
stubs). Mode values are stored as ordinary settings in
nct-settings-service:

    modes.computer-use          workstation | host | kiosk
    modes.input-set             keyboard-mouse | touchscreen |
                                mouse-only | keyboard-only
    modes.interaction-modality  bimodal-mouse-buttons |
                                bimodal | conventional |
                                direct-touch

The three axes are orthogonal — any combination that the
hardware allows is legal (Kiosk + Touchscreen + Direct Touch
is a shop exhibit; Kiosk + Keyboard Only + Bimodal is a
catalogue terminal; Workstation + Keyboard+Mouse +
Bimodal+MouseButtons is the normal desk):

1. computer-use/ — Computer Use Mode: what the machine is FOR.
   Workstation (default) / Host / Kiosk. Further values are
   expected in the future; a new value is a new definition
   file here plus a bundle entry in each affected module.
2. input-set/ — Input Set: what input equipment the system
   may ASSUME is present. Keyboard+Mouse (default) /
   Touchscreen / Mouse Only / Keyboard Only. Hardware can
   inform this axis: nct-device-centre detecting a touch
   display may PROPOSE a change, never impose one.
3. interaction-modality/ — Interaction Modality: how
   steering and activation are DIVIDED among the devices in
   the Input Set. Bimodal+MouseButtons (default) / Bimodal /
   Conventional / Direct Touch. Primary slice-owner:
   nct-input-router.

Naming rules (owner, 2026-11-26) — written down so the three
axes are never confused with each other or with bimodal:

- "Mode" unqualified means Computer Use Mode.
- The device axis is a Set, not a mode; the pattern axis is a
  Modality, not a mode.
- Key-clicks are neither an axis nor a value: they are the
  activation mechanism inside the bimodal modalities. Within
  a bimodal modality the keyboard lives in its input modes —
  key-click and text — switching moment to moment by named
  flows (refs/bimodal/desktopUI-KeyboardInputModesForBimodal
  .txt). Those are states, not settings.

Rules that apply to every axis (from the design discussion,
2026-11-26; to be confirmed in the design pass):

- A mode is a bundle of DEFAULTS, not a cage: an individual
  setting may diverge, and the UI then shows the divergence
  ("Host — with 2 changes") with a reset to mode defaults.
- Changing a mode shows the diff of what will change, before
  it is applied; switching back restores the previous bundle.
- Computer Use Mode is per-machine (it affects boot, login
  and power, before any user signs in). The scope of Input
  Set is an OPEN QUESTION, reserved here: a touchscreen is a
  property of one display, so "machine default, per-display
  override possible" is the placeholder position.
- The axes constrain each other: Input Set Mouse Only leaves
  only Conventional available as a modality; Keyboard Only
  leaves the keyboard-steered Bimodal. Illegal combinations
  are refused at the point of setting, not discovered later.
