# Boot customization — status

The boot sequence, phase by phase, and how far each phase
is customized. (Status table as recorded by the user,
2026-11-28; later changes are appended below the table,
not edited into it.)

| Phase | What you see | Duration | State |
|---|---|---|---|
| 1. GRUB | Blue text menu, 640×480, 5 s countdown | ~5–7 s | Unthemed |
| 2. Kernel text | White text on black, 720×400 — kernel error lines, and on the first boot Plymouth's own debug log scrolling | ~4 s | Unthemed, plus two mode switches (640×480 → 720×400 → 1280×800) |
| 3. Splash | The NCT theme at 1280×800 | ~4–5 s | Done |
| 4. Black beat | Splash quits, screen black until cage/greeter is up | ~1–2 s | Unthemed |
| 5. Greeter | NCT login | — | Done (earlier work) |

## Later changes (2026-11-28, rig-proven on VirtualBox)

- Phase 1 — THEMED: NCT GRUB theme (emblem + menu, focus
  selection), 1024×768 on this rig (BIOS VBE offers GRUB
  no 1280×800), 3 s timeout, entries renamed
  "Noctivagous GNU/Linux" via GRUB_DISTRIBUTOR.
  See grub-theme-nct/.
- Phase 2 — THEMED: "quiet splash" + GRUB_GFXPAYLOAD_LINUX
  =keep, so the kernel console inherits GRUB's mode and
  stays off-screen; plymouth:debug removed after it proved
  to reach the screen even with payload keep. Mode
  switches reduced to 640×480 → 1024×768 → 1280×800. A few
  kernel error lines (RETBleed, iTCO_wdt, vmwgfx warnings)
  still print before Plymouth exists.
- Phase 3 — extended: category bars driven by real unit
  counts, overall progress bar, rolling status log of the
  last 3 unit events, failures pinned in red; v3.2 scales
  the layout by display height. See plymouth-theme-nct/.
- Phase 4 — tried, suspended: the greeter's Godot engine
  splash showed a recreation of the splash's final frame
  (commit 21e645b); the user judged it worse than before
  and suspended it the same day (a56bc17). The black beat
  measured from captures is nearer ~4–8 s on this guest
  (greetd/cage/Godot startup on software rendering);
  closing it needs Plymouth frame retention in the session
  stack — open.

## Display dimensions — behaviour by phase

(As recorded by the user, 2026-11-28.)

| Phase | Behaviour |
|---|---|
| GRUB | Percentage geometry; proven at 1024×768 and 640×480. The mode list ends in auto, so other panels get their native resolution. The 300 px emblem is fixed-size — proportionally smaller on a 4K panel. |
| Plymouth | Fully proportional: logo is 52% of the smaller dimension, bars 44% of width capped at 560 px. Theme v3.2 (this round) scales all vertical spacings by H/800 and drops the rolling log under 640 px height, where logo + bars alone fill the screen — that short-display path is code-reviewed but not yet rig-proven; 1280×800 is unchanged and proven. |
| Greeter splash | The continuation image is 1280×800 with stretch=keep — on other shapes it letterboxes onto the same black Plymouth used. The greeter itself is Godot and resolution-independent. |
| ThorVG prototype | Fixed 800×600 buffer — prototype scope only; the real renderer will take its geometry from the display mode. |

Note: the Greeter splash row describes the suspended
handoff design (see Later changes, phase 4).
