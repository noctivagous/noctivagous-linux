/**
 * NCTGraphiteHorizon — the machinery of the D3 gallery's "Realtime
 * horizon chart" (Observable @d3/realtime-horizon-chart), ported to
 * TypeScript as a renderer-independent module.
 *
 * The original, in its own terms:
 *
 *   - Each series is a random walk clamped into [0, 1]:
 *     walk(v) = max(0, min(1, v + (random − 0.5) · 0.05)).
 *   - A horizon chart squeezes a tall area chart into a short strip
 *     by cutting it into `bands` horizontal layers and stacking them:
 *     the y scale runs over [0, −bands · step] for a strip `step`
 *     pixels high, and band i is drawn translated down by (i + 1) ·
 *     step, so each successive band of the value range lands in the
 *     same strip, in a deeper shade. Value is read as colour depth:
 *     the darker the strip, the higher the signal.
 *   - The palette is a d3 colour scheme (arrays of shades indexed by
 *     band count); the band colour is
 *     scheme[max(3, bands)][i + max(0, 3 − bands)] — ported verbatim
 *     as horizonBandColor below.
 *   - Realtime: every 250 ms each series shifts left by one sample
 *     and appends walk(last); only the changed region is repainted
 *     (the original shifts the canvas onto itself with drawImage;
 *     renderers here may simply redraw — see README).
 *
 * What this module adds for the activity-monitor frame: named
 * ACTIVITY LANES. The original's twenty anonymous walks (labelled
 * only "0"…"19") become labelled system channels — network, disk,
 * memory, and the rest — each lane a walk with its own temperament
 * (baseline, volatility, burstiness) and a formatter for its unit,
 * so the monitor says what is going on, as a monitor should.
 * Randomness is seeded (mulberry32) so a page load is reproducible;
 * pass seedless rngs for live use.
 */

/** One step of the original's random walk, with the source of chance injected. */
export function horizonWalk(v: number, rand: () => number): number {
  return Math.max(0, Math.min(1, v + (rand() - 0.5) * 0.05));
}

/** Deterministic RNG (mulberry32) so demos and tests agree sample for sample. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The original's band colour rule, verbatim:
 *   color = i => scheme[max(3, bands)][i + max(0, 3 − bands)]
 * where `scheme` is a d3 scheme object: shades indexed by band count
 * (scheme[k] holds k colours). `schemes` below are d3's own values.
 */
export function horizonBandColor(
  scheme: Record<number, string[]>,
  bands: number,
  i: number,
): string {
  const row = scheme[Math.max(3, bands)];
  return row[i + Math.max(0, 3 - bands)];
}

/**
 * d3.schemeGreens and d3.schemeBlues, verbatim (the original defaults
 * to Greens). Rows keyed by shade count 3..9 as in d3-scale-chromatic.
 */
export const SCHEME_GREENS: Record<number, string[]> = {
  3: ["#e5f5e0", "#a1d99b", "#31a354"],
  4: ["#edf8e9", "#bae4b3", "#74c476", "#238b45"],
  5: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"],
  6: ["#edf8e9", "#ccebc5", "#a1d99b", "#74c476", "#31a354", "#006d2c"],
  7: ["#edf8e9", "#ccebc5", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#005a32"],
  8: ["#f7fbf2", "#e5f5e0", "#ccebc5", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#005a32"],
  9: ["#f7fbf2", "#e5f5e0", "#ccebc5", "#a1d99b", "#74c476", "#41ab5d", "#238b45", "#006d2c", "#00441b"],
};

export const SCHEME_BLUES: Record<number, string[]> = {
  3: ["#deebf7", "#9ecae1", "#3182bd"],
  4: ["#eff3ff", "#bdd7e7", "#6baed6", "#2171b5"],
  5: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
  6: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"],
  7: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"],
  8: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"],
  9: ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#08306b"],
};

/** The geometry of one horizon strip, in the original's terms. */
export interface HorizonStrip {
  /** Value at the top of the strip's deepest band (always 1 here). */
  max: number;
  /** Strip height in pixels — the original's `step` (29). */
  step: number;
  bands: number;
}

/**
 * How high a column of height `columnPx` (the y scale's output for a
 * value, in (−bands·step, 0]) reaches within band i of the strip:
 * the original draws the whole column translated by (i + 1) · step,
 * so band i shows the part of the column between i·step and
 * (i+1)·step measured from the strip's baseline. Returns the filled
 * height in pixels, 0 when the band is empty.
 */
export function horizonBandFill(columnPx: number, step: number, i: number): number {
  const h = -columnPx; // column height, 0..bands*step
  return Math.max(0, Math.min(step, h - i * step));
}

/** y-scale output for a value: the original's scaleLinear [0, −bands·step] over domain [0, 1]. */
export function horizonY(value: number, bands: number, step: number): number {
  return -value * bands * step;
}

/** A named activity channel: what is going on, in one lane. */
export interface ActivityLane {
  id: string;
  /** The label the monitor shows — what this lane is. */
  label: string;
  /** What the lane measures, in words (for the readout and the print index). */
  what: string;
  /** Unit formatter for the lane's normalized value (0..1). */
  format: (v: number) => string;
  /** Resting level the walk hovers near (0..1). */
  baseline: number;
  /** How far one tick may move it, relative to the original's 0.05 step. */
  volatility: number;
  /** Probability per tick of a burst toward a random high level (0 = never). */
  burst: number;
  /** Pull toward the baseline per tick — how anchored the lane is. */
  pull: number;
  /** Colour scheme family for this lane: 'greens' | 'blues'. */
  scheme: "greens" | "blues";
}

const mbps = (peak: number) => (v: number) => `${(v * peak).toFixed(0)} Mb/s`;
const iops = (peak: number) => (v: number) => `${(v * peak).toFixed(0)}k IOPS`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

/**
 * The standard monitor: the channels an activity view of a machine
 * watches. Synthetic walks, honestly labelled as such in the page —
 * in the distribution these lanes bind to real counters.
 */
export const ACTIVITY_LANES: ActivityLane[] = [
  { id: "net-in", label: "NETWORK IN", what: "incoming traffic on the primary link", format: mbps(940), baseline: 0.32, volatility: 1.1, burst: 0.012, pull: 0.012, scheme: "blues" },
  { id: "net-out", label: "NETWORK OUT", what: "outgoing traffic on the primary link", format: mbps(940), baseline: 0.18, volatility: 0.9, burst: 0.008, pull: 0.012, scheme: "blues" },
  { id: "disk-read", label: "DISK READ", what: "read throughput of the system volume", format: iops(190), baseline: 0.22, volatility: 1.3, burst: 0.02, pull: 0.02, scheme: "greens" },
  { id: "disk-write", label: "DISK WRITE", what: "write throughput of the system volume", format: iops(160), baseline: 0.16, volatility: 1.2, burst: 0.016, pull: 0.02, scheme: "greens" },
  { id: "ram", label: "MEMORY", what: "resident memory pressure, all processes", format: pct, baseline: 0.58, volatility: 0.35, burst: 0.004, pull: 0.02, scheme: "greens" },
  { id: "swap", label: "SWAP", what: "swap traffic — memory pressure made visible", format: mbps(120), baseline: 0.05, volatility: 0.8, burst: 0.006, pull: 0.06, scheme: "greens" },
  { id: "cpu", label: "PROCESSOR", what: "aggregate processor load, all cores", format: pct, baseline: 0.35, volatility: 1.0, burst: 0.01, pull: 0.015, scheme: "blues" },
  { id: "gpu", label: "GRAPHICS", what: "graphics processor load — the 3D desktop's own cost", format: pct, baseline: 0.42, volatility: 1.1, burst: 0.006, pull: 0.015, scheme: "blues" },
];

/**
 * One lane's living series: a bounded buffer of samples in [0, 1]
 * that ticks like the original's — shift left, append a new walk
 * step — except the walk is tempered by the lane: pulled gently
 * toward its baseline, scaled by its volatility, with occasional
 * bursts. The original's pure walk is the special case
 * baseline-pull 0, volatility 1, burst 0.
 */
export class HorizonSeries {
  readonly lane: ActivityLane;
  readonly data: Float64Array;
  private rand: () => number;
  private burstLevel: number | null = null;
  private burstLeft = 0;

  constructor(lane: ActivityLane, length: number, rand: () => number, prefill = true) {
    this.lane = lane;
    this.rand = rand;
    this.data = new Float64Array(length);
    let v = lane.baseline;
    if (prefill) {
      for (let j = 0; j < length; j++) {
        this.data[j] = v;
        v = this.step(v);
      }
    } else {
      this.data.fill(lane.baseline);
    }
  }

  private step(v: number): number {
    const lane = this.lane;
    if (this.burstLeft > 0 && this.burstLevel !== null) {
      this.burstLeft -= 1;
      // Ride near the burst level with walk noise until the burst ends.
      const pulled = this.burstLevel + (this.rand() - 0.5) * 0.05 * lane.volatility;
      return Math.max(0, Math.min(1, pulled));
    }
    if (this.rand() < lane.burst) {
      this.burstLevel = 0.55 + this.rand() * 0.45;
      this.burstLeft = 6 + Math.floor(this.rand() * 22);
      return this.step(v);
    }
    // Tempered walk: the original's step, scaled, plus the lane's pull home.
    const walked = v + (this.rand() - 0.5) * 0.05 * lane.volatility;
    const pulled = walked + (lane.baseline - walked) * lane.pull;
    return Math.max(0, Math.min(1, pulled));
  }

  /** Advance one tick: shift left, append — the original's update, per lane. */
  tick(): void {
    const d = this.data;
    d.copyWithin(0, 1, d.length);
    d[d.length - 1] = this.step(d[d.length - 1]);
  }

  get current(): number {
    return this.data[this.data.length - 1];
  }

  /** Window statistics for the readout. */
  stats(): { min: number; max: number; mean: number } {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const v of this.data) {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    return { min, max, mean: sum / this.data.length };
  }
}

/** Create the full monitor: one series per lane, sharing one seeded source of chance. */
export function createMonitor(
  lanes: ActivityLane[],
  length: number,
  seed: number,
): HorizonSeries[] {
  const rand = mulberry32(seed);
  return lanes.map((lane) => new HorizonSeries(lane, length, rand));
}
