# NCT Plymouth theme — STAGING

Status: **STAGING** (2026-11-27). Slice C of
`src/plans/BOOT-EXPERIENCE.md`. Written and layout-checked on
the build machine; **not yet run under a real plymouthd** and
not yet in any image. The gate for leaving staging is a boot
on each rig (VirtualBox + QEMU) with screenshots, per plan
decision D6.

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
