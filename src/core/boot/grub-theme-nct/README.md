# NCT GRUB theme — STAGING

Status: **STAGING — RUNS ON THE VIRTUALBOX RIG** (2026-11-28).
The first phase of the boot sequence, themed to match the
Plymouth splash that follows it: black ground, the radial-12
logo, a short menu with a focus-blue selection bar.
`boot-vbox-v2.png` here is a real frame from the rig.

Rig findings across two boots: VirtualBox's BIOS VBE does
not offer 1280x800 to GRUB — with the preference list
"1280x800,1024x768,auto" GRUB runs at 1024x768 and the theme
must lay out cleanly there and at 640x480 (v1 geometry,
sized for 1280x800, collapsed at 640x480: logo over menu).
v2 geometry is resolution-robust (300px emblem, menu at 70%).
The boot's mode switches are now 640x480 (BIOS) -> 1024x768
(GRUB + kernel console) -> 1280x800 (Plymouth/greeter).
Menu entries still read "Debian GNU/Linux" — that text is
the menuentry title in grub.cfg, not theme territory.

Installed by hand on the rig (see BUNDLE/install notes):
theme files go to /boot/grub/themes/nct/, and
/etc/default/grub gains:

    GRUB_THEME="/boot/grub/themes/nct/theme.txt"
    GRUB_GFXMODE=1280x800
    GRUB_GFXPAYLOAD_LINUX=keep
    GRUB_TIMEOUT=3

GFXMODE + GFXPAYLOAD=keep are half the point: the kernel
inherits GRUB's 1280x800 mode, so the console and Plymouth
open at the final resolution instead of switching
640x480 -> 720x400 -> 1280x800 between phases.

The countdown stays visible and interruptible (3 s) — this
menu is also the recovery path, so it is styled, not hidden.
If the named fonts are absent in GRUB, it falls back to its
default font; layout and colours are unaffected.
