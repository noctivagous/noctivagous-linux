# Boot customization — status

The boot sequence, phase by phase, and how far each phase
is customized. Current state, rig-proven on VirtualBox
(guest "nct-test", 1280×800) unless a row says otherwise.

| Phase | What you see | Duration | State |
|---|---|---|---|
| 1. GRUB | The NCT GRUB theme: radial emblem + menu with focus-blue selection, entries titled "Noctivagous GNU/Linux" (via GRUB_DISTRIBUTOR, src/distro/identity/), 1024×768 on this rig — VirtualBox BIOS VBE offers GRUB no 1280×800 — 3 s countdown | ~3 s | Themed (grub-theme-nct/) |
| 2. Kernel phase | Nothing, by design: "quiet splash" + GRUB_GFXPAYLOAD_LINUX=keep, so the kernel console inherits GRUB's mode and stays off-screen. A few kernel error lines (RETBleed, iTCO_wdt, vmwgfx warnings) still print before Plymouth exists. Mode switches: 640×480 → 1024×768 → 1280×800 | ~4 s | Themed; the pre-Plymouth error lines are open |
| 3. Splash | The NCT Plymouth theme at 1280×800: rotating radial logo, six category bars driven by real unit counts, overall progress bar, rolling log of the last 3 unit events, failures pinned in red above it | ~4–5 s | Done (plymouth-theme-nct/) |
| 4. Black beat | Splash quits; screen black until the greeter's first frame — greetd → cage → Godot starting on software rendering | ~4–8 s on this guest | Open. A greeter engine-splash continuation was tried and suspended by the user (21e645b / a56bc17 on main); closing the beat needs Plymouth frame retention (deactivate) in the session stack |
| 5. Greeter | NCT login (Godot; engine splash disabled, as before) | — | Done (earlier work) |

## Display dimensions — behaviour by phase

| Phase | Behaviour |
|---|---|
| GRUB | Percentage geometry; proven at 1024×768 and 640×480. The mode list ends in auto, so other panels get their native resolution. The 300 px emblem is fixed-size — proportionally smaller on a 4K panel. |
| Plymouth | Fully proportional: logo is 52% of the smaller dimension, bars 44% of width capped at 560 px. Theme v3.2 scales all vertical spacings by H/800 and drops the rolling log under 640 px height, where logo + bars alone fill the screen — that short-display path is code-reviewed but not yet rig-proven; 1280×800 is unchanged and proven. |
| Greeter | Godot — resolution-independent. No engine splash (the continuation-image design is suspended; see phase 4). |
| ThorVG prototype | Fixed 800×600 buffer — prototype scope only; the real renderer will take its geometry from the display mode. |
