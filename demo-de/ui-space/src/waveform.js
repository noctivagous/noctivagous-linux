/**
 * waveform.js — the audio app's data, pure (no three.js): three
 * composed tracks, honest peak buckets over any window, band
 * energies for the spectrogram waterfall, the window arithmetic
 * the app zooms and drills with, and the app's own nav history.
 *
 * A waveform's components (the reference the user supplied):
 * AMPLITUDE over time is the fence; FREQUENCY over time is the
 * waterfall — frequency across, time into depth, energy as
 * height; HARMONICS give each track its timbre; the ENVELOPE
 * (attack, decay, sustain, release) shapes every phrase; and
 * TRANSIENTS are the brief high bursts riding on top. The tracks
 * are composed from those parts, deterministically: the same seed
 * makes the same samples, here and in the view.
 *
 * The synthetic rate is modest on purpose: 800 samples a second
 * for 18 seconds is 14,400 numbers per track — enough for honest
 * min/max peaks at every zoom the app offers, cheap enough to
 * rebuild the fence on every window change.
 */

// mulberry32, as in lsystems.js: the determinism contract lives here.
export function createRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TRACK_RATE = 800;
export const TRACK_SECONDS = 18;

export const TRACKS = [
  { id: "pulse", name: "Pulse", seed: 1103,
    blurb: "A low fundamental and its harmonics under a slow ADSR swell, with a transient hit every second and a half." },
  { id: "voice", name: "Voice", seed: 2207,
    blurb: "Formant-ish harmonic stacks in gated phrases — attacks, sustains, releases, and silence between." },
  { id: "rain", name: "Rain", seed: 3301,
    blurb: "Seeded high-frequency patter with slow swells — noise with weather in it." },
];

export function trackSpec(id) {
  return TRACKS.find((t) => t.id === id) || null;
}

const TAU = Math.PI * 2;

/* ---------------- the three compositions ---------------- */

function composePulse(spec) {
  const n = TRACK_RATE * TRACK_SECONDS;
  const out = new Float32Array(n);
  const rng = createRng(spec.seed);
  const phaseJitter = [0, 0.5, 1.1, 0.3].map(() => rng() * 0.4);
  const hits = [];
  for (let t = 0.75; t < TRACK_SECONDS; t += 1.5) hits.push(t);
  for (let i = 0; i < n; i++) {
    const t = i / TRACK_RATE;
    // Envelope: a 3 s cycle — fast attack, decay to a sustain,
    // release at the cycle's tail (ADSR, looping).
    const u = (t % 3) / 3;
    const env = u < 0.04 ? u / 0.04
      : u < 0.5 ? 1 - 0.45 * ((u - 0.04) / 0.46)
      : u < 0.85 ? 0.55
      : 0.55 * (1 - (u - 0.85) / 0.15);
    let s = env * (
      0.62 * Math.sin(TAU * 55 * t + phaseJitter[0]) +
      0.30 * Math.sin(TAU * 110 * t + phaseJitter[1]) +
      0.17 * Math.sin(TAU * 165 * t + phaseJitter[2]) +
      0.10 * Math.sin(TAU * 220 * t + phaseJitter[3])
    );
    // Transients: a bright ping and a low thump at each hit.
    for (const h of hits) {
      const dt = t - h;
      if (dt >= 0 && dt < 0.14) {
        s += 0.5 * Math.sin(TAU * 660 * dt) * Math.exp(-dt * 34);
        s += 0.38 * Math.sin(TAU * 82 * dt) * Math.exp(-dt * 20);
      }
    }
    out[i] = s * 0.88;
  }
  return out;
}

function composeVoice(spec) {
  const n = TRACK_RATE * TRACK_SECONDS;
  const out = new Float32Array(n);
  const rng = createRng(spec.seed);
  // The phrases: seeded starts, lengths, pitches — the gaps are
  // part of the composition (a voice breathes).
  const phrases = [];
  let t = 0.4;
  while (t < TRACK_SECONDS - 0.8) {
    const dur = 0.7 + rng() * 0.9;
    phrases.push({ start: t, dur, f0: 112 + rng() * 48, drift: (rng() - 0.5) * 34 });
    t += dur + 0.35 + rng() * 0.85;
  }
  // Harmonic weights: two formants over a 1/k falloff — the stack
  // that makes it read as a voice rather than an organ.
  const weights = [];
  for (let k = 1; k <= 6; k++) {
    const fk = k * 130;
    const formant = Math.exp(-(((fk - 730) / 270) ** 2)) + 0.7 * Math.exp(-(((fk - 1090) / 310) ** 2)) + 0.25;
    weights.push(formant / k);
  }
  for (const ph of phrases) {
    const i0 = Math.floor(ph.start * TRACK_RATE);
    const i1 = Math.min(n, Math.ceil((ph.start + ph.dur) * TRACK_RATE));
    let phase = 0;
    for (let i = i0; i < i1; i++) {
      const lt = i / TRACK_RATE - ph.start;
      const u = lt / ph.dur;
      // Phrase envelope: 50 ms attack, 90 ms release.
      const env = Math.max(0, Math.min(1, lt / 0.05, (ph.dur - lt) / 0.09));
      const f = ph.f0 + ph.drift * u + 4 * Math.sin(TAU * 5 * lt);
      phase += (TAU * f) / TRACK_RATE;
      let s = 0;
      for (let k = 1; k <= 6; k++) s += weights[k - 1] * Math.sin(phase * k);
      out[i] = env ** 1.2 * s * 0.34;
    }
  }
  return out;
}

function composeRain(spec) {
  const n = TRACK_RATE * TRACK_SECONDS;
  const out = new Float32Array(n);
  const rng = createRng(spec.seed);
  let prev = 0;
  let patter = 1;
  let hold = 0;
  for (let i = 0; i < n; i++) {
    const t = i / TRACK_RATE;
    // Patter: the drop density changes every ~30 ms.
    if (hold-- <= 0) { patter = 0.7 + rng() * 0.45; hold = 24; }
    const white = rng() * 2 - 1;
    const hp = white - prev * 0.55; // differenced: hiss stays bright
    prev = white;
    const swell = 0.55 + 0.45 * Math.sin(TAU * 0.11 * t + 1.3);
    out[i] = hp * patter * swell * 0.42;
  }
  return out;
}

const COMPOSERS = { pulse: composePulse, voice: composeVoice, rain: composeRain };
const _cache = new Map();

/**
 * makeTrack(specOrId) → { id, name, seconds, rate, samples }.
 * Tracks are cached by id — the App, the stage and the ring token
 * all read the one build.
 */
export function makeTrack(specOrId) {
  const spec = typeof specOrId === "string" ? trackSpec(specOrId) : specOrId;
  if (!spec || !COMPOSERS[spec.id]) return null;
  if (_cache.has(spec.id)) return _cache.get(spec.id);
  const track = {
    id: spec.id, name: spec.name, blurb: spec.blurb,
    seconds: TRACK_SECONDS, rate: TRACK_RATE,
    samples: COMPOSERS[spec.id](spec),
  };
  _cache.set(spec.id, track);
  return track;
}

/* ---------------- windows: the app's zoom lives here ---------------- */

export const MIN_WINDOW = 0.25; // seconds — the deepest the frame zooms

export function fullWindow(track) {
  return { start: 0, end: track.seconds };
}

const clampWindow = (s, e, trackSeconds) => {
  const w = Math.min(e - s, trackSeconds);
  const start = Math.max(0, Math.min(s, trackSeconds - w));
  return { start, end: start + w };
};

/** Zoom a window by factor (<1 in, >1 out) around a centre fraction. */
export function windowZoom(win, factor, centreFrac = 0.5, trackSeconds = TRACK_SECONDS) {
  const width = win.end - win.start;
  const nw = Math.max(MIN_WINDOW, Math.min(trackSeconds, width * factor));
  const c = win.start + centreFrac * width;
  return clampWindow(c - centreFrac * nw, c + (1 - centreFrac) * nw, trackSeconds);
}

/** Drill into the [fracStart, fracEnd] stretch of a window. */
export function windowDrill(win, fracStart, fracEnd, trackSeconds = TRACK_SECONDS) {
  const width = win.end - win.start;
  let s = win.start + fracStart * width;
  let e = win.start + fracEnd * width;
  if (e - s < MIN_WINDOW) {
    const mid = (s + e) / 2;
    s = mid - MIN_WINDOW / 2;
    e = mid + MIN_WINDOW / 2;
  }
  return clampWindow(s, e, trackSeconds);
}

/** The fence is divided into this many hover zones for drilling. */
export const REGION_ZONES = 6;

/* ---------------- peaks: honest min/max per bucket ---------------- */

/**
 * peaksForWindow(samples, rate, start, end, buckets) → [{min, max}]
 * — the true extremes of the samples inside each bucket of the
 * window, so the fence never invents a peak the zoom didn't earn.
 * The window is clamped to the track; a degenerate window gives
 * silence, not an error.
 */
export function peaksForWindow(samples, rate, start, end, buckets) {
  const dur = samples.length / rate;
  let s = Math.max(0, Math.min(dur, start));
  let e = Math.max(0, Math.min(dur, end));
  if (e < s) [s, e] = [e, s];
  const out = [];
  for (let i = 0; i < buckets; i++) {
    const a = s + ((e - s) * i) / buckets;
    const b = s + ((e - s) * (i + 1)) / buckets;
    const i0 = Math.floor(a * rate);
    const i1 = Math.min(samples.length, Math.max(i0 + 1, Math.ceil(b * rate)));
    let min = Infinity, max = -Infinity;
    for (let j = i0; j < i1; j++) {
      const v = samples[j];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    out.push(min === Infinity ? { min: 0, max: 0 } : { min, max });
  }
  return out;
}

/* ---------------- the waterfall: band energies over the window ---------------- */

/** Log-spaced band edges (Hz) — four bands under the 400 Hz Nyquist. */
export const BAND_EDGES = [30, 75, 150, 260, 401];

/**
 * Goertzel amplitude of one frequency in one slice of samples.
 * The slice is Hann-weighted first: a bare rectangular window's
 * main lobe is so narrow at these lengths that a tone sitting
 * between the band centre and its edge nearly vanishes; the Hann
 * window widens the lobe (its 0.5 coherent gain is divided back
 * out) so a band honestly reports the energy anywhere inside it.
 */
function goertzelAmp(seg, rate, freq) {
  const n = seg.length;
  if (!n) return 0;
  const w = (TAU * freq) / rate;
  const coeff = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const hann = 0.5 - 0.5 * Math.cos((TAU * i) / Math.max(1, n - 1));
    s0 = seg[i] * hann + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return (2 * Math.sqrt(Math.max(0, power))) / (n * 0.5);
}

/**
 * bandEnergies(samples, rate, start, end, slices, bands) →
 * heights[slice][band] in 0..1: for each time slice of the window,
 * the energy in each log-spaced band (Goertzel at the band's
 * geometric centre, on up to 256 samples of the slice). Cheap:
 * slices × bands × ≤256 multiply-adds — a few ten-thousand flops
 * per window change, and fully deterministic.
 */
export function bandEnergies(samples, rate, start, end, slices, bands = BAND_EDGES.length - 1) {
  const dur = samples.length / rate;
  const s = Math.max(0, Math.min(dur, start));
  const e = Math.max(s, Math.min(dur, end));
  const centres = [];
  for (let b = 0; b < bands; b++) {
    centres.push(Math.sqrt(BAND_EDGES[b] * BAND_EDGES[b + 1]));
  }
  const out = [];
  for (let i = 0; i < slices; i++) {
    const a = s + ((e - s) * i) / slices;
    const i0 = Math.floor(a * rate);
    const count = Math.min(256, samples.length - i0);
    const seg = count > 0 ? samples.subarray(i0, i0 + count) : samples.subarray(0, 0);
    const row = [];
    for (let b = 0; b < bands; b++) {
      row.push(Math.min(1, goertzelAmp(seg, rate, centres[b]) * 1.6));
    }
    out.push(row);
  }
  return out;
}

/* ---------------- the app's own history (D walks it back) ---------------- */

/**
 * The audio app's nav stack: every drill, zoom-token step and
 * track change pushes where the app WAS ({ trackId, window });
 * D pops it back. The stack is plain data, replaced not mutated.
 */
export function createNavStack() {
  return [];
}

export function pushNav(stack, entry) {
  if (!entry || !entry.window) return stack;
  return [...stack, { trackId: entry.trackId, window: { ...entry.window } }];
}

/** Pop → { stack, entry }; on an empty stack the entry is null
 *  and the stack comes back unchanged (D notes it and stays). */
export function popNav(stack) {
  if (!stack.length) return { stack, entry: null };
  return { stack: stack.slice(0, -1), entry: stack[stack.length - 1] };
}
