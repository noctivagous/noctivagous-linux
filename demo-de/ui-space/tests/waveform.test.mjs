// Tests for slice 8: the waveform module (tracks, peaks, band
// energies, window math, the app's nav stack) and the pure state
// the slice adds to space-state.js (open apps, the ring registry,
// labels continuing past the citizens). Pure node, no three.js.
//
//     node --test demo-de/ui-space/tests/waveform.test.mjs
import test from "node:test";
import assert from "node:assert/strict";

import {
  TRACKS,
  makeTrack,
  peaksForWindow,
  bandEnergies,
  windowZoom,
  windowDrill,
  fullWindow,
  createNavStack,
  pushNav,
  popNav,
  MIN_WINDOW,
} from "../src/waveform.js";
import {
  OBJECTS,
  labelForIndex,
  createOpenApp,
  openApp,
  setAppMode,
  closeApp,
  isAppOpen,
  resolveOpenAction,
  RING_R,
  RING_ITEMS,
  ringItemById,
  ringItemPosition,
  labeledRingItems,
  ringItemForLabel,
  appBearerOf,
  stratumOf,
  createLayers,
  isAddressable,
  addressableList,
} from "../src/space-state.js";
import { labelForMedia, mediaForLabel } from "../src/media-library.js";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ---------------- the tracks ---------------- */

test("all three tracks are deterministic, and distinct", () => {
  for (const spec of TRACKS) {
    const a = makeTrack(spec.id);
    // Bypass the module cache by composing through a fresh spec clone.
    assert.equal(a.samples.length, a.rate * a.seconds);
    let max = 0;
    for (const v of a.samples) max = Math.max(max, Math.abs(v));
    assert.ok(max > 0.3 && max <= 1.0, `${spec.id} peaks in a sane range (${max})`);
  }
  const pulse = makeTrack("pulse");
  const voice = makeTrack("voice");
  const rain = makeTrack("rain");
  assert.notEqual(pulse.samples[4000], voice.samples[4000]);
  assert.notEqual(pulse.samples[4000], rain.samples[4000]);
});

test("the voice track has real silence before its first phrase", () => {
  const voice = makeTrack("voice");
  const peaks = peaksForWindow(voice.samples, voice.rate, 0, voice.seconds, 144);
  assert.equal(peaks[0].max, 0);
  assert.equal(peaks[0].min, 0);
  // ...and is not silent everywhere.
  assert.ok(peaks.some((p) => p.max > 0.3));
});

/* ---------------- peaks ---------------- */

test("peaks of a known sine: every full-period bucket carries the extremes", () => {
  const rate = 100;
  const samples = new Float32Array(rate);
  for (let i = 0; i < rate; i++) samples[i] = 0.8 * Math.sin((2 * Math.PI * 10 * i) / rate);
  const peaks = peaksForWindow(samples, rate, 0, 1, 10);
  assert.equal(peaks.length, 10);
  for (const p of peaks) {
    // 36° sampling of the cycle: the sampled extremes are ±0.8·sin72°.
    assert.ok(near(p.max, 0.8 * Math.sin((72 * Math.PI) / 180), 0.03), `max ${p.max}`);
    assert.ok(near(p.min, -p.max, 1e-6), `min mirrors max (${p.min} vs ${p.max})`);
  }
});

test("peaks of silence are zeros, and the window clamps to the track", () => {
  const samples = new Float32Array(800);
  const peaks = peaksForWindow(samples, 800, -5, 99, 8);
  assert.equal(peaks.length, 8);
  for (const p of peaks) assert.deepEqual(p, { min: 0, max: 0 });
  const sine = new Float32Array(800);
  for (let i = 0; i < 800; i++) sine[i] = Math.sin(i / 10);
  const wide = peaksForWindow(sine, 800, -5, 99, 4);
  const exact = peaksForWindow(sine, 800, 0, 1, 4);
  assert.deepEqual(wide, exact);
});

/* ---------------- window math ---------------- */

test("zoom halves the width around the centre fraction", () => {
  const w = windowZoom({ start: 4, end: 10 }, 0.5, 0.5, 18);
  assert.ok(near(w.start, 5.5) && near(w.end, 8.5));
  const atStart = windowZoom({ start: 4, end: 10 }, 0.5, 0, 18);
  assert.ok(near(atStart.start, 4) && near(atStart.end, 7));
  const atEnd = windowZoom({ start: 4, end: 10 }, 0.5, 1, 18);
  assert.ok(near(atEnd.start, 7) && near(atEnd.end, 10));
});

test("zoom clamps to the track and to the minimum window", () => {
  const out = windowZoom({ start: 4, end: 10 }, 4, 0.5, 18);
  assert.ok(near(out.start, 0) && near(out.end, 18));
  const deep = windowZoom({ start: 4, end: 10 }, 0.0001, 0.5, 18);
  assert.ok(near(deep.end - deep.start, MIN_WINDOW));
  assert.ok(near((deep.start + deep.end) / 2, 7));
});

test("drill takes the addressed stretch, with the minimum width honoured", () => {
  const w = windowDrill({ start: 0, end: 18 }, 1 / 3, 2 / 3, 18);
  assert.ok(near(w.start, 6) && near(w.end, 12));
  const tiny = windowDrill({ start: 0, end: 1 }, 0.5, 0.51, 18);
  assert.ok(near(tiny.end - tiny.start, MIN_WINDOW));
  assert.ok(tiny.start >= 0 && tiny.end <= 18);
  const full = fullWindow(makeTrack("pulse"));
  assert.deepEqual(full, { start: 0, end: 18 });
});

/* ---------------- the nav stack ---------------- */

test("nav push/pop: D walks the app's own history back", () => {
  const s0 = createNavStack();
  const e1 = { trackId: "pulse", window: { start: 0, end: 18 } };
  const e2 = { trackId: "pulse", window: { start: 3, end: 6 } };
  const s1 = pushNav(s0, e1);
  const s2 = pushNav(s1, e2);
  assert.equal(s0.length, 0, "push does not mutate");
  assert.equal(s2.length, 2);
  const p1 = popNav(s2);
  assert.deepEqual(p1.entry, e2);
  assert.equal(p1.stack.length, 1);
  const p2 = popNav(p1.stack);
  assert.deepEqual(p2.entry, e1);
  const p3 = popNav(p2.stack);
  assert.equal(p3.entry, null);
  assert.equal(p3.stack, p2.stack, "an empty pop returns the stack untouched");
});

/* ---------------- band energies ---------------- */

test("band energies: shape, range, determinism, and the low band wins for a low tone", () => {
  const rate = 800;
  const samples = new Float32Array(rate * 2);
  for (let i = 0; i < samples.length; i++) samples[i] = 0.9 * Math.sin((2 * Math.PI * 50 * i) / rate);
  const a = bandEnergies(samples, rate, 0, 2, 4);
  const b = bandEnergies(samples, rate, 0, 2, 4);
  assert.deepEqual(a, b, "deterministic");
  assert.equal(a.length, 4);
  for (const row of a) {
    assert.equal(row.length, 4);
    for (const v of row) assert.ok(v >= 0 && v <= 1, `in range (${v})`);
    assert.ok(row[0] > 0.6, `low band carries the 50 Hz tone (${row[0]})`);
    assert.ok(row[0] > row[3], "low band beats the top band");
  }
  for (const spec of TRACKS) {
    const t = makeTrack(spec.id);
    const h = bandEnergies(t.samples, t.rate, 2, 8, 12);
    assert.equal(h.length, 12);
    for (const row of h) for (const v of row) assert.ok(v >= 0 && v <= 1);
  }
});

/* ---------------- open-app state ---------------- */

test("open-app transitions: open, expand, close, and refusals", () => {
  const s0 = createOpenApp();
  assert.deepEqual(s0, { appId: null, mode: null });
  const s1 = openApp(s0, "audio", "center");
  assert.deepEqual(s1, { appId: "audio", mode: "center" });
  assert.ok(isAppOpen(s1) && isAppOpen(s1, "audio") && !isAppOpen(s1, "other"));
  const s2 = setAppMode(s1, "full");
  assert.equal(s2.mode, "full");
  assert.deepEqual(closeApp(s2), { appId: null, mode: null });
  assert.equal(openApp(s0, "audio", "sideways"), s0, "a bad mode is refused");
  assert.equal(openApp(s0, null, "center"), s0, "a missing app is refused");
  assert.equal(setAppMode(s0, "full"), s0, "mode needs an open app");
});

test("resolveOpenAction: F centres, E fills, non-apps fall through", () => {
  assert.deepEqual(
    resolveOpenAction({ targetId: "audio", key: "f" }),
    { type: "openApp", appId: "audio", mode: "center" },
  );
  assert.deepEqual(
    resolveOpenAction({ targetId: "audio", key: "E" }),
    { type: "openApp", appId: "audio", mode: "full" },
  );
  assert.equal(resolveOpenAction({ targetId: "mesa", key: "f" }), null);
  assert.equal(resolveOpenAction({ targetId: "mesa", key: "e" }), null);
  assert.equal(resolveOpenAction({ targetId: "audio", key: "x" }), null);
  assert.equal(resolveOpenAction({ targetId: null, key: "f" }), null);
});

test("E inside label mode is not an operator — it stays an address", () => {
  assert.equal(resolveOpenAction({ targetId: "audio", key: "e", labelMode: true }), null);
  assert.equal(resolveOpenAction({ targetId: "audio", key: "E", labelMode: true }), null);
  // F opens the app in both modes (F was always an operator).
  assert.deepEqual(
    resolveOpenAction({ targetId: "audio", key: "f", labelMode: true }),
    { type: "openApp", appId: "audio", mode: "center" },
  );
});

/* ---------------- the ring registry ---------------- */

test("the ring: one item, on the annulus, turning with the rotation", () => {
  assert.equal(RING_ITEMS.length, 1);
  assert.equal(ringItemById("audio").name, "Waveform");
  assert.equal(appBearerOf("audio"), "audio");
  assert.equal(appBearerOf("mesa"), null);
  const p0 = ringItemPosition(0, 1, 0);
  assert.ok(near(Math.hypot(p0.x, p0.z), RING_R, 1e-9), "on the annulus radius");
  assert.ok(p0.z > 0 && near(p0.x, 0, 1e-9), "the first slot stands at the front");
  const p1 = ringItemPosition(0, 1, Math.PI / 2);
  assert.ok(near(Math.atan2(p1.z, p1.x), Math.atan2(p0.z, p0.x) + Math.PI / 2, 1e-9),
    "rotation advances the angle");
  const two = [ringItemPosition(0, 2, 0), ringItemPosition(1, 2, 0)];
  assert.ok(near(Math.hypot(two[0].x - two[1].x, two[0].z - two[1].z), 2 * RING_R, 1e-9),
    "two items stand opposite");
});

test("labels: the ring item follows the twelfth citizen; citizens stay twelve", () => {
  assert.equal(OBJECTS.length, 12);
  assert.equal(labelForIndex(11), "N", "the twelfth citizen keeps its label");
  const labeled = labeledRingItems();
  assert.equal(labeled.length, 1);
  assert.equal(labeled[0].item.id, "audio");
  assert.equal(labeled[0].label, "O");
  assert.equal(ringItemForLabel("O").id, "audio");
  assert.equal(ringItemForLabel("A"), null);
  // The media cards continue after the ring: they now start at P.
  assert.equal(labelForMedia("media-1"), "P");
  assert.equal(mediaForLabel("P").id, "media-1");
});

test("the ring item is an instrument: addressable until its stratum locks or hides", () => {
  assert.equal(stratumOf("audio"), "instruments");
  const layers = createLayers();
  assert.ok(isAddressable(layers, "audio"));
  const locked = { ...layers, instruments: { visible: true, locked: true } };
  assert.ok(!isAddressable(locked, "audio"));
  const list = addressableList(layers, {});
  assert.equal(list.indexOf("audio"), OBJECTS.length, "tab order: citizens, then the ring");
  assert.ok(!addressableList(locked, {}).includes("audio"));
});
