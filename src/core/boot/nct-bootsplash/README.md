# nct-bootsplash — proof prototype (slice D, offline part)

A proof prototype for the NCT boot splash renderer (slice D of
`src/plans/BOOT-EXPERIENCE.md` in the noctivagous-linux repo).
It renders one 800×600 boot frame — the radial-12 NCT logo,
large and rotated by a caller-supplied angle, above six
labelled category bars — into an offscreen ARGB8888 buffer
with ThorVG, and writes the buffer out as a PNG.

## Build & run

```sh
./build.sh
./nct-bootsplash 0  frames/frame-000deg.png \
    ~/workspace/boot-plan-assets/nct-logo-radial12.svg \
    100 60 100 80 40 25
./nct-bootsplash 15 frames/frame-015deg.png \
    ~/workspace/boot-plan-assets/nct-logo-radial12.svg \
    100 100 100 100 85 60
```

Usage: `nct-bootsplash <angle-deg> <out.png> [logo.svg]
[p_storage p_network p_display p_security p_input p_system]`
(progress values 0–100; a built-in demo state is used when
they are omitted).

`build.sh` clones **ThorVG v1.1.4** (the project pin, same as
the NCT labwc fork's `build-labwc-nct.sh`) and builds it as a
static library with the fork's meson options — CPU engine
(`-Dengines=cpu`; the CPU engine is ThorVG 1.1's software
renderer), `-Dbindings=capi`, `-Dthreads=false`, static —
plus **one addition**: `-Dloaders=svg,ttf` instead of `svg`
alone. The fork needs no text; the splash needs the TTF
loader for its category labels. ThorVG installs into the
local `thorvg-install/` prefix (the fork installs to
/usr/local; the prototype keeps everything in this directory).
Meson needs `-Dlibdir=lib`, otherwise Debian multiarch puts
the library under `lib/x86_64-linux-gnu/` and pkg-config
misses it.

## Measured facts (this sandbox, 2026-11-27)

| Fact | Value |
|---|---|
| `nct-bootsplash` binary | **523,096 bytes** |
| `libthorvg-1.a` (static, cpu+svg+ttf+capi) | 792,376 bytes |
| Render time per frame (draw+sync, 800×600) | **~3.0–3.9 ms** over 7 runs (logo + 6 bars + 12 text labels) |
| Proof frames | `frames/frame-000deg.png` (77,464 B), `frames/frame-015deg.png` (78,024 B), both valid 800×600 RGBA PNGs |

Linkage — **ThorVG is statically linked; the binary as a
whole is NOT fully static.** `ldd nct-bootsplash`:

```
libstdc++.so.6 => /lib/x86_64-linux-gnu/libstdc++.so.6
libm.so.6      => /lib/x86_64-linux-gnu/libm.so.6
libz.so.1      => /lib/x86_64-linux-gnu/libz.so.1
libgomp.so.1   => /lib/x86_64-linux-gnu/libgomp.so.1
libc.so.6      => /lib/x86_64-linux-gnu/libc.so.6
libgcc_s.so.1  => /lib/x86_64-linux-gnu/libgcc_s.so.1
(no libthorvg — it is inside the binary)
```

The dynamic libstdc++/libgomp is the known C++ cost the plan
accepted; a truly initramfs-ready binary still needs a
linking decision (static libstdc++ or shipping the runtime).

## How the frame is composed

- **Logo**: loaded with `tvg_picture_load`. The logo SVG's
  canvas is the full nct_header4 frame, so the code centres
  the logo's *measured content box* (bbox fractions recorded
  in `~/workspace/boot-plan-assets/README.md`) on (400, 178),
  scales it to 292 px diameter, and rotates it with a single
  composed `Tvg_Matrix` passed to `tvg_paint_set_transform`
  (T·R·S·T⁻¹). Rotation is code, as the plan requires —
  ThorVG does not run SMIL.
- **Bars**: ThorVG shapes (rounded rects): dark track
  #26262c, fill in NCT focus blue #4fc3f7, width ∝ progress.
- **Labels + percentages**: ThorVG text, DejaVu Sans loaded
  from `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`.
  Gotcha, verified by test: ThorVG registers the font as
  **`DejaVuSans`** (spaces stripped) — `tvg_text_set_font`
  with `"DejaVu Sans"` returns an error and draws nothing.
- **PNG output**: a ~60-line hand-written encoder in the C
  file (IHDR/IDAT/IEND); it uses system **zlib** only for
  DEFLATE compression and CRC32. No libpng dependency.
- **Proof-angle note**: the logo has 12-fold symmetry, so a
  30° rotation is exactly one repeat and looks identical to
  0°. The second proof frame therefore uses **15°** (half a
  repeat), where the rotation is plainly visible.

## What is proven — and what is not

**Proven** (offline, in this sandbox):
- The pinned ThorVG builds statically from source with the
  fork's recipe (+ttf) and links into a small C program.
- ThorVG's software canvas renders the real NCT logo SVG,
  rotated in code and correctly centred despite the source
  canvas's offset content box, into an ARGB8888 buffer —
  the same pixel format the compositor work already uses.
- A full categorised splash frame (logo + 6 labelled bars +
  percentages) renders in ~3 ms, far inside any boot-time
  budget, and encodes to a valid PNG.

**NOT proven — no work done on these yet:**
- No framebuffer (`/dev/fb0`) or DRM/KMS output: the buffer
  never reaches a display. When a drawable surface exists on
  each rig, relative to plymouthd, is slice D's open
  measurement task and is still unmeasured.
- No initramfs integration: the binary is not fully static
  (see linkage above), is not in any initramfs, and has not
  booted anywhere.
- No event input: progress values come from argv, not from
  the Plymouth socket, the journal, or D-Bus (slices C/E).
- No animation loop: each run renders a single frame; the
  30 s/turn rotation from the source art is not yet a
  running animation.
- No LUKS/passphrase handling — by design (plan decision
  D4): display-only; Plymouth keeps the prompt.
