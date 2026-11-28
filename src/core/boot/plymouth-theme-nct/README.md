# NCT Plymouth theme — STAGING

Status: **STAGING — RUNS ON THE VIRTUALBOX RIG** (2026-11-28).
Slice C of `src/plans/BOOT-EXPERIENCE.md`. Booted twice on the
VBox guest (Debian 13, GRUB BIOS, kernel 6.12.48): the theme
renders, the logo rotates, all six categories populate from
real systemd unit updates, the overall bar tracks Plymouth's
progress fraction, and the guest reaches the greeter normally
afterwards. `boot-vbox-v2.png` in this directory is a real
frame from the second boot (VBoxManage screenshot) — compare
`layout-mock.png`, which is a mock. QEMU-rig boot still owed
(plan D6); the guest there boots its kernel directly with a
build-generated initrd, so the theme rides in with the slice-D
initramfs work rather than this pass.

Findings from the two boots, all fixed in v2 unless noted:
- Plymouth's String natives read the string from `this`:
  call them method-style (`s.Length()`, `s.SubString(a, b)`).
  v1 called them as statics and silently categorised every
  unit as System (System 52, everything else 0).
- Category fill width must be `bar_w * frac` against the
  `bar_w` track; v1's `(bar_w - 92)` stopped a full bar at 84%.
- `Image.Rotate` renders into a same-size buffer; full-bleed
  art gets its rim shaved. `logo.png` is now padded (disc at
  80% of canvas). If the logo should read larger again, raise
  the script's 0.52 size factor — the padding is the headroom.
- Plymouth's own debug log (`plymouth:debug` cmdline) put
  numbers on the plan's slice-D question for this rig:
  vmwgfx DRM is up at kernel t≈5.71 s and the initramfs
  plymouthd has its DRM backend by t≈5.87 s — the drawable
  surface and Plymouth's first frame are ~0.15 s apart here,
  so an own-renderer win on this rig would be control, not
  earliness.

## What it is

A Plymouth *script* theme (no forks, no daemon changes):

- the radial-12 NCT logo (`logo.png`, from
  `src/core/boot/assets/nct-logo-radial12.svg`), large and
  rotating in code at the source art's 30 s/turn — Plymouth
  cannot run the SVG's SMIL animation, so the refresh
  callback rotates the image;
- six category bars (Storage / Network / Display / Security /
  Input / System) fed by the unit-name updates systemd
  already sends Plymouth, categorised by name pattern inside
  the script. Stage-1 semantics: bars show *activity counts*
  (fill = count/8, capped), not true progress fractions —
  real totals arrive with slice E's structured events;
- an overall progress bar driven by Plymouth's own boot
  progress fraction;
- message display, and display-only handling of the LUKS
  passphrase prompt (Plymouth owns the prompt flow; the
  theme renders prompt + bullets) — plan decision D4.

`layout-mock.png` is a layout mock composed from the theme's
own assets and geometry — it is **not** a Plymouth screenshot.

## Files

| File | Role |
|---|---|
| `nct.plymouth` | theme descriptor (ModuleName=script) |
| `nct.script` | the theme itself; API use verified against Plymouth's script-lib sources |
| `logo.png` | 480×480 transparent logo (script themes load PNG, not SVG) |
| `bar-bg.png` / `bar-fill.png` | 32×16 solid tiles, scaled by the script |
| `layout-mock.png` | layout proof (mock, see above) |

## Install (rig, manual — staging only)

```
sudo cp -r plymouth-theme-nct /usr/share/plymouth/themes/nct
sudo plymouth-set-default-theme nct
sudo update-initramfs -u
# kernel cmdline needs: splash (and quiet as usual)
```

Escape hatch, as everywhere in this plan:
`plymouth.enable=0` on the kernel cmdline, or reselect the
previous theme + `update-initramfs -u`.

## Known staging risks

- Script rotation of a large image every 3rd refresh tick is
  the known software-render cost; if it drags on vmwgfx, the
  tuning knobs are logo size, tick divisor, or pre-rendered
  rotation frames. Decide on rig measurements, not here.
- `Image.Text` uses Plymouth's label rendering; font and
  metrics on the rig may differ from the mock.
