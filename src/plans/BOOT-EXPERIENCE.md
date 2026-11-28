# NCT — ThorVG vector engine + boot experience plan

Status: DECIDED PLAN (2026-11-27). All recommendations accepted
by the user ('.') in the ThorVG/boot planning chat of 2026-11-27.
Slice states as of 2026-11-27 evening: A+B DONE and seat-proven
(build logs 40+41, compositor chat, branch feat/labwc-nct-theme);
C RUNS ON VBOX RIG (2026-11-28: two real boots, v2 fixes for
the String method-call bug, fill width and logo padding;
QEMU boot still owed — its initrd is build-generated, theme
rides in with slice D); VBox timing measured: DRM up at
kernel t=5.71s, plymouthd backend at 5.87s (~0.15s gap);
GRUB phase themed + text phase themed (2026-11-28, user's
'yes and do everything'): NCT GRUB theme live in the guest
(VBE caps GRUB at 1024x768 on this rig; geometry made
resolution-robust), plymouth:debug removed (its trace
reached the screen), Plymouth v3 rolling status log renders
the unit stream in-theme (names unescaped from systemd's
\\x2d form); two switches remain (640x480 BIOS -> 1024x768
GRUB/kernel -> 1280x800 splash); D PROTOTYPE PROVEN offline (static ThorVG
renderer, 523,096 B binary, ~3-4 ms/frame, proof frames in
src/core/boot/nct-bootsplash/frames/; framebuffer/initramfs
work not done, its measurement task still first); rig staging
bundle assembled at ~/workspace/boot-staging/ (BUNDLE.md +
MANIFEST.sha256), not yet transferred;
E-G not started. Local file, unpushed.

Companions: POSITIONING.md (why a distinctive boot is ours to
build), ENVIRONMENT-MANAGER.md, the labwc fork build logs
39 (NanoSVG backend) and the ThorVG follow-on in the labwc-fork
worktree. Source research: the user's own boot-splash thread
(~/workspace/user/files/nct-linux-boot-splashscreens-shells.md) —
treated as a starting brief, not as verified fact; its
performance claims are re-measured in slice D before use.

## 0. Decisions (user, 2026-11-27)

| # | Decision |
|---|---|
| D1 | **ThorVG is the single pinned vector engine** for the project: labwc titlebar backend, boot splash, future shell art. It replaces **NanoSVG** (the two-header library vendored in log 39). NanoVG was never used; nothing is replaced under that name. |
| D2 | **Supply: vendored pin, Meson subproject**, one version across compositor and initramfs. (The initramfs consumer needs a static build a Debian package will not provide.) |
| D3 | **Sequence: A+B first** (labwc backend + packaging, already in motion), **then C** (Plymouth theme), **then D** (ThorVG initramfs renderer). E follows; F is gated (D5). |
| D4 | **LUKS is a supported install option, but the splash v1 is display-only.** Where an install is encrypted, Plymouth keeps owning the passphrase prompt. Our renderer never collects a secret in v1. |
| D5 | **No systemd fork in the roadmap.** Stage F (below) is a gated option, decided on slice E's measured event latency/completeness — not before, not by default. |
| D6 | **Test matrix = the two VM rigs** (VirtualBox/vmwgfx hands-on seat, QEMU virtio + std VGA headless proof) through slice E. Bare metal is a gate at slice G, before any public image. All boot claims are scoped to the rigs actually exercised. |
| D7 | **Boot logo = the radial-12 NCT logo ALONE, without the larger ground, large and rotating.** See §2. |

Why ThorVG, checked 2026-11-27: actively maintained (Linux
Foundation, v1.1 2026-07), MIT, Meson, C API (`thorvg_capi.h`),
core ~150–170 KB modular (build only sw engine + svg/lottie
loaders + capi), and its software canvas writes premultiplied
ARGB8888 — exactly labwc's buffer format, so the titlebar seam
needs no pixel conversion. Cost vs NanoSVG: it is C++, so a
static initramfs binary carries libstdc++ (~1–2 MB). Accepted:
NanoSVG can only ever render glyphs; ThorVG is also the boot
renderer and the Lottie path.

## 1. The pin (foundation for every slice)

One vendored ThorVG, one build recipe, three consumers.

    thorvg pin (version TBD at first build; record it here)
    ├── meson options: engines=sw only, loaders=svg,lottie,
    │   bindings=capi, static, threads=0 (callers render on
    │   their own thread), simd per-arch
    ├── consumer A: labwc fork img-svg backend (dynamic link
    │   in the session is fine)
    ├── consumer D: nct-bootsplash (static link, initramfs)
    └── future: Godot/shell art, Lottie animations

Gate: the pin builds clean in the sandbox; a 16 px test glyph
and the radial logo both rasterise to the expected buffers.

## 2. The logo asset

Source: the user's `nct_header4.svg` (supplied 2026-11-18;
re-supplied 2026-11-27, byte-identical). The file contains
two layers, separated and proof-rendered 2026-11-27
(extraction + README in ~/workspace/boot-plan-assets/,
repo home TBD when slice C/D lands):

- **Logo** — 13 paths, stroke #333, widths 14→~2: the name
  "Noctivagous" on a 12-fold radial, shrinking to the centre.
  Extracted as `nct-logo-radial12.svg` (15 KB).
- **Ground** — 13 paths, stroke #000, width 1: the larger
  wireframe spiral of the full header composition. Kept for
  other surfaces (house site); **never part of the boot logo**.

Facts the code must respect:

- In the source canvas the logo sits upper-left (bbox 393×393,
  centre ≈ (233,230) on a 1001×579 render) because the ground
  took the rest. The boot asset is re-cropped to its own bbox
  and centred; the art itself is unchanged.
- The source rotation is SMIL (`<animateTransform>`, 360°/30 s).
  **ThorVG does not run SMIL; neither does Plymouth.**
  Rotation is renderer code (`tvg_paint_rotate` per frame,
  around the logo centre). 30 s/turn is the source rate;
  retune only on judged renders.
- Colour is a single stroke value (#333, tone-on-tone on
  black as the user supplied it). Recolour = one-value remap;
  not changed by this plan.

## 3. Slices

### A. labwc fork — ThorVG SVG backend — DONE (log 40)
State: built and nested-proven; ThorVG pinned v1.1.4, static;
binary 1,188,440 B, zero librsvg, zero shared ThorVG.
- Files: `src/img/img-svg.c` (rewritten), `src/img/img-svg.h`
  (Tvg_Paint handle), `src/img/img.c` (load/free seam),
  `meson.build` (librsvg dep out, thorvg subproject in),
  stored reproducibly as a patch + build script under
  `src/core/compositor/labwc/fork/` on its branch.
- Keep: loader order PNG → SVG → XBM, the NCT theme SVG glyphs
  from log 38, XBM fallbacks.
- Gate: glyph crops match the NanoSVG/librsvg renders (open +
  shaded); binary links zero librsvg; run-chain green.

### B. nct-labwc packaging — DONE + SEAT-PROVEN (log 41)
Directed by the user 2026-11-27 (compositor chat); the VBox
guest seat runs /usr/lib/nct/compositor/labwc.
- Files: packaging in `src/tools/build-deb.sh` (nct-labwc
  package carrying the fork binary), `src/core/session/
  nct-session` (NCT_COMPOSITOR selection; Debian labwc stays
  the fallback value).
- Gate: guest seat session's compositor is our binary
  (read back from /proc/<pid>/exe), shade verified in the
  seat — nested proof does not close this slice. Seat install
  involves a sign-out/sign-in: user's word at the time.

### C. Plymouth Stage 1 — categorised script theme (no forks) — STAGING
Built 2026-11-27 on feat/boot-experience-staging
(src/core/boot/plymouth-theme-nct/); layout mock composed
from the theme's own assets; not yet run under plymouthd.
- Files: a Plymouth script theme (new dir, proposed
  `src/core/boot/plymouth-theme-nct/`): `.script` + `.plymouth`
  descriptor + the logo SVG (§2); initramfs-tools hook
  ordering in the image build (`src/tools/build-image.sh` /
  rootfs assembly) — Debian initramfs-tools, not dracut.
- Behaviour: six category bars (Storage / Network / Display /
  Security / Input / System) driven by the `U` unit-name
  updates systemd already sends to Plymouth; categorisation
  by unit-name pattern, inside the theme. Palette matched to
  the greeter so splash → greeter reads as one line.
- Gate: boots on both rigs (D6) show legible categorised
  progress vs the stock spinner, judged on screenshots;
  `plymouth.enable=0` escape hatch verified.

### D. nct-bootsplash — ThorVG renderer in the initramfs
- First task is measurement, not drawing: when does a
  drawable surface (/dev/fb0 or DRM) actually exist on each
  rig, relative to plymouthd's first frame? The source
  brief's "earlier than Plymouth" claim is used only if
  measured true here.
- Files: one static C binary (proposed
  `src/core/boot/nct-bootsplash/`): ThorVG SwCanvas →
  framebuffer, logo rotation in code (§2), category model
  rendered from Plymouth-socket events (stock protocol in
  this slice; N/T arrive in E).
- Boundary (D4): **display-only**. No passphrase collection,
  no input handling. Where LUKS is present, Plymouth owns
  the prompt and this renderer's coexistence with it is a
  designed, tested state — not an accident.
- Gate: both rigs boot with the renderer up; initramfs size
  delta recorded; failure of the renderer can never block
  boot (text fallback proven by sabotage test).

### E. Plymouth fork + categorisation agent
- Plymouth fork: protocol codes `N` (category|progress|
  total|status) and `T` (phase/target) in ply-boot-protocol
  + server; exposed to the theme (script engine callbacks).
- Agent: small binary, journal + D-Bus UnitNew/JobNew
  subscription, per-category counters, ordered
  Before=basic.target. bootvine is a reference for the
  subscription logic only (it is a VT text UI — wrong
  rendering target, not a dependency).
- Gate: overlay correctness >90% of units on both rigs;
  agent start-vs-first-event latency measured and recorded
  — that measurement is the input to the F decision (D5).

### F. systemd patch — GATED, not scheduled
Only if E's measurement shows the agent's loss/latency
actually hurts. Shape if ever done: one new file
(boot-experience.c) + two call sites (unit state transition,
target activation), categorisation config parsed once.
Accepting F means accepting a permanent PID 1 rebase
obligation; the default answer remains no.

### G. Firmware / bootloader layer + bare-metal gate
- GRUB theme + GFXMODE/GFXPAYLOAD=keep matched to the
  Plymouth mode (flicker is a mode mismatch); USB live
  entries (Try / Install / Persistent) via search --label;
  SeaBIOS bootsplash BMP; OVMF as primary VM firmware path.
- Prerequisite: a partitioned, bootloader-carrying image —
  the current QEMU image loads the kernel directly and
  cannot prove any of this layer.
- Bare metal (D6 gate): first non-VM hardware pass —
  KMS timing, NVIDIA modeset, Secure Boot chain,
  multi-monitor — before any public image.

## 4. Standing constraints

- Fallback is mandatory at every slice: no splash component
  may be able to hang or block a boot. `plymouth.enable=0`
  and renderer-absent boots are tested, not assumed.
- No push without the user's explicit word for that push;
  slices land on branches in their own worktrees (parallel
  chats share this repo's history, not its working tree).
- Claims stay scoped to the environment exercised (D6):
  nested ≠ seat, QEMU ≠ VirtualBox ≠ bare metal.
