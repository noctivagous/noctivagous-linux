# Touchscreen — Input Set

Status: PLACEHOLDER — definition reserved, design pass owed.

What it declares: the display is a touchscreen and touch is
the input the system may rely on — the case of someone
buying a touchscreen desktop display. A physical keyboard
and mouse may also be attached, but the UI must be fully
usable without them: the on-screen keyboard (nct-keyboard-
manager) becomes a primary device, not an extra.

Bundle sketch:
- theme: larger targets and density for touch
- window: no hover-dependent behaviour; long-press stands
  in for right-click
- keyboard: on-screen keyboard summoned for text entry
- input-router: touch routing is first-class, not emulated
  pointer events

Detection: nct-device-centre seeing a touch display may
propose this value; it never imposes it. Scope is an open
question (see modes/README.md): touch is a property of one
display, so a per-display override is reserved.

Stored as: modes.input-set = touchscreen
