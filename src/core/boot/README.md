# core/boot - STAGING

Boot-experience code, per src/plans/BOOT-EXPERIENCE.md.
Everything under this directory is **STAGING** until its
slice gate passes on the rigs (plan decision D6); nothing
here is wired into the image build yet.

- `assets/` - the radial-12 NCT logo, separated from the
  larger ground of nct_header4.svg (see the plan, section 2):
  `nct-logo-radial12.svg` is the centred, boot-ready logo;
  `nct-logo-radial12-source-framing.svg` keeps the source
  framing; `nct-ground-wireframe.svg` is the ground layer,
  kept for other surfaces, never part of the boot logo.
- `plymouth-theme-nct/` - slice C, the categorised Plymouth
  script theme.
- `nct-bootsplash/` - slice D, the ThorVG initramfs
  renderer (arrives from the prototype in
  ~/workspace/boot-prototype/ once it proves out).
