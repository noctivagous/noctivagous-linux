// nct-bootsplash.c — NCT boot-splash renderer, proof prototype
// (slice D of src/plans/BOOT-EXPERIENCE.md).
//
// Renders ONE 800x600 frame into an offscreen ARGB8888 buffer
// with ThorVG's software canvas and writes it out as a PNG:
//   - the radial-12 NCT logo, large, centred in the upper
//     area, rotated by a caller-supplied angle (rotation is
//     done here, in code, via a paint transform — ThorVG does
//     not run the SMIL animation the source SVG once had);
//   - six labelled category bars (Storage, Network, Display,
//     Security, Input, System) with progress fractions.
//
// Display-only: no framebuffer, no DRM, no input, no secrets.
// This prototype proves offline buffer rendering only.
//
// Usage:
//   nct-bootsplash <angle-deg> <out.png> [logo.svg]
//                  [p_storage p_network p_display p_security
//                   p_input p_system]        (each 0..100)
// Defaults: logo path = ../boot-plan-assets/nct-logo-radial12.svg
// relative to the CWD if not given; progress = demo state.
#define _POSIX_C_SOURCE 200809L
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <zlib.h>
#include <thorvg_capi.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#define W 800
#define H 600

/* The logo SVG's own canvas is the full nct_header4 frame
 * (the ground occupied most of it); the logo itself occupies
 * a measured sub-box. Measured on the 1001x579 proof render
 * in ~/workspace/boot-plan-assets (bbox x 37..430, y 34..427):
 * content centre and diameter as fractions of picture size. */
#define LOGO_CX_FRAC 0.2333f
#define LOGO_CY_FRAC 0.3981f
#define LOGO_D_FRAC  0.3926f   /* of picture width; square logo */

#define LOGO_CENTRE_X 400.0f
#define LOGO_CENTRE_Y 178.0f
#define LOGO_DIAMETER 292.0f

#define FONT_PATH "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
/* ThorVG registers a loaded font under its family name with
 * spaces stripped: DejaVuSans.ttf loads as "DejaVuSans"
 * (tvg_text_set_font with "DejaVu Sans" fails, verified). */
#define FONT_NAME "DejaVuSans"

static const char *kCategories[6] = {
    "Storage", "Network", "Display", "Security", "Input", "System"
};

/* ---------- minimal PNG writer (zlib DEFLATE + CRC32) ---------- */
static void put_u32be(FILE *f, uint32_t v)
{
    fputc((v >> 24) & 0xff, f);
    fputc((v >> 16) & 0xff, f);
    fputc((v >> 8) & 0xff, f);
    fputc(v & 0xff, f);
}

static void write_chunk(FILE *f, const char *type,
                        const uint8_t *data, uint32_t len)
{
    put_u32be(f, len);
    fwrite(type, 1, 4, f);
    if (len) {
        fwrite(data, 1, len, f);
    }
    uint32_t crc = crc32(0L, (const Bytef *)type, 4);
    if (len) {
        crc = crc32(crc, data, len);
    }
    put_u32be(f, crc);
}

static int write_png(const char *path, const uint32_t *px)
{
    /* Raw scanlines: filter byte 0 + RGBA per pixel. */
    size_t raw_len = (size_t)H * (1 + (size_t)W * 4);
    uint8_t *raw = malloc(raw_len);
    if (!raw) return -1;
    for (int y = 0; y < H; y++) {
        uint8_t *row = raw + (size_t)y * (1 + (size_t)W * 4);
        row[0] = 0;
        for (int x = 0; x < W; x++) {
            uint32_t v = px[(size_t)y * W + x]; /* ARGB8888 */
            row[1 + x * 4 + 0] = (v >> 16) & 0xff; /* R */
            row[1 + x * 4 + 1] = (v >> 8) & 0xff;  /* G */
            row[1 + x * 4 + 2] = v & 0xff;         /* B */
            row[1 + x * 4 + 3] = (v >> 24) & 0xff; /* A */
        }
    }
    uLongf comp_len = compressBound((uLong)raw_len);
    uint8_t *comp = malloc(comp_len);
    if (!comp || compress2(comp, &comp_len, raw, (uLong)raw_len,
                           Z_BEST_SPEED) != Z_OK) {
        free(raw);
        free(comp);
        return -1;
    }
    free(raw);

    FILE *f = fopen(path, "wb");
    if (!f) {
        free(comp);
        return -1;
    }
    static const uint8_t sig[8] =
        { 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a };
    fwrite(sig, 1, 8, f);
    uint8_t ihdr[13];
    ihdr[0] = (W >> 24) & 0xff; ihdr[1] = (W >> 16) & 0xff;
    ihdr[2] = (W >> 8) & 0xff;  ihdr[3] = W & 0xff;
    ihdr[4] = (H >> 24) & 0xff; ihdr[5] = (H >> 16) & 0xff;
    ihdr[6] = (H >> 8) & 0xff;  ihdr[7] = H & 0xff;
    ihdr[8] = 8;  /* bit depth */
    ihdr[9] = 6;  /* RGBA */
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    write_chunk(f, "IHDR", ihdr, 13);
    write_chunk(f, "IDAT", comp, (uint32_t)comp_len);
    write_chunk(f, "IEND", NULL, 0);
    fclose(f);
    free(comp);
    return 0;
}

/* ---------- scene helpers ---------- */
static Tvg_Paint rect(float x, float y, float w, float h, float r,
                      uint8_t cr, uint8_t cg, uint8_t cb)
{
    Tvg_Paint s = tvg_shape_new();
    tvg_shape_append_rect(s, x, y, w, h, r, r, true);
    tvg_shape_set_fill_color(s, cr, cg, cb, 255);
    return s;
}

static Tvg_Paint label(const char *text, float x, float y,
                       float size, uint8_t cr, uint8_t cg, uint8_t cb)
{
    Tvg_Paint t = tvg_text_new();
    tvg_text_set_font(t, FONT_NAME);
    tvg_text_set_size(t, size);
    tvg_text_set_color(t, cr, cg, cb);
    tvg_text_set_text(t, text);
    tvg_paint_translate(t, x, y);
    return t;
}

int main(int argc, char **argv)
{
    if (argc < 3) {
        fprintf(stderr,
            "usage: %s <angle-deg> <out.png> [logo.svg] "
            "[p0 p1 p2 p3 p4 p5]\n", argv[0]);
        return 2;
    }
    double angle = atof(argv[1]);
    const char *out_path = argv[2];
    const char *logo_path =
        "../boot-plan-assets/nct-logo-radial12.svg";
    int argi = 3;
    if (argc > 3 && strstr(argv[3], ".svg")) {
        logo_path = argv[3];
        argi = 4;
    }
    int progress[6] = { 100, 60, 100, 80, 40, 25 }; /* demo */
    for (int i = 0; i < 6 && argi + i < argc; i++) {
        progress[i] = atoi(argv[argi + i]);
        if (progress[i] < 0) progress[i] = 0;
        if (progress[i] > 100) progress[i] = 100;
    }

    if (tvg_engine_init(0) != TVG_RESULT_SUCCESS) {
        fprintf(stderr, "tvg_engine_init failed\n");
        return 1;
    }
    if (tvg_font_load(FONT_PATH) != TVG_RESULT_SUCCESS) {
        fprintf(stderr, "font load failed: %s\n", FONT_PATH);
        return 1;
    }

    uint32_t *buf = malloc((size_t)W * H * sizeof(uint32_t));
    if (!buf) return 1;
    for (size_t i = 0; i < (size_t)W * H; i++) {
        buf[i] = 0xFF000000u; /* opaque black */
    }

    Tvg_Canvas canvas = tvg_swcanvas_create(TVG_ENGINE_OPTION_DEFAULT);
    if (!canvas ||
        tvg_swcanvas_set_target(canvas, buf, W, W, H,
                                TVG_COLORSPACE_ARGB8888)
            != TVG_RESULT_SUCCESS) {
        fprintf(stderr, "canvas setup failed\n");
        return 1;
    }

    /* --- logo: load, centre its measured content box on the
     * target centre, scale to LOGO_DIAMETER, rotate by angle.
     * Transform = T(centre) * R(angle) * S(s) * T(-content c). */
    Tvg_Paint logo = tvg_picture_new();
    if (!logo || tvg_picture_load(logo, logo_path)
                     != TVG_RESULT_SUCCESS) {
        fprintf(stderr, "logo load failed: %s\n", logo_path);
        return 1;
    }
    float pw = 0, ph = 0;
    tvg_picture_get_size(logo, &pw, &ph);
    float ccx = LOGO_CX_FRAC * pw;
    float ccy = LOGO_CY_FRAC * ph;
    float s = LOGO_DIAMETER / (LOGO_D_FRAC * pw);
    double rad = angle * M_PI / 180.0;
    float ca = (float)cos(rad), sa = (float)sin(rad);
    Tvg_Matrix m;
    m.e11 = s * ca;  m.e12 = -s * sa;
    m.e21 = s * sa;  m.e22 = s * ca;
    m.e13 = LOGO_CENTRE_X - s * (ca * ccx - sa * ccy);
    m.e23 = LOGO_CENTRE_Y - s * (sa * ccx + ca * ccy);
    m.e31 = 0; m.e32 = 0; m.e33 = 1;
    tvg_paint_set_transform(logo, &m);
    tvg_canvas_add(canvas, logo);

    /* --- category bars --- */
    const float bar_x = 208.0f, bar_w = 472.0f, bar_h = 15.0f;
    const float row0 = 372.0f, row_dy = 35.0f;
    for (int i = 0; i < 6; i++) {
        float y = row0 + i * row_dy;
        tvg_canvas_add(canvas,
            label(kCategories[i], 62.0f, y - 1.0f, 17.0f,
                  0xbb, 0xbb, 0xbb));
        tvg_canvas_add(canvas,
            rect(bar_x, y, bar_w, bar_h, 4.0f, 0x26, 0x26, 0x2c));
        float fw = bar_w * progress[i] / 100.0f;
        if (fw > 0.0f) {
            tvg_canvas_add(canvas,
                rect(bar_x, y, fw, bar_h, 4.0f,
                     0x4f, 0xc3, 0xf7)); /* NCT focus blue */
        }
        char pct[8];
        snprintf(pct, sizeof pct, "%d%%", progress[i]);
        tvg_canvas_add(canvas,
            label(pct, 694.0f, y - 1.0f, 15.0f, 0x88, 0x88, 0x88));
    }

    struct timespec t0, t1;
    clock_gettime(CLOCK_MONOTONIC, &t0);
    if (tvg_canvas_draw(canvas, true) != TVG_RESULT_SUCCESS ||
        tvg_canvas_sync(canvas) != TVG_RESULT_SUCCESS) {
        fprintf(stderr, "render failed\n");
        return 1;
    }
    clock_gettime(CLOCK_MONOTONIC, &t1);
    double ms = (t1.tv_sec - t0.tv_sec) * 1e3 +
                (t1.tv_nsec - t0.tv_nsec) / 1e6;

    if (write_png(out_path, buf) != 0) {
        fprintf(stderr, "png write failed: %s\n", out_path);
        return 1;
    }
    printf("frame: angle=%.1f out=%s render=%.2f ms "
           "progress=%d,%d,%d,%d,%d,%d\n",
           angle, out_path, ms,
           progress[0], progress[1], progress[2],
           progress[3], progress[4], progress[5]);

    tvg_canvas_destroy(canvas);
    free(buf);
    tvg_engine_term();
    return 0;
}
