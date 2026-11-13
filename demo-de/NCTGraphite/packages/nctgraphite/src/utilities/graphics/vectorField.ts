/**
 * Rectangular vector lattice: cell-centered samples, brush-op stamps,
 * attractor influence, and the original angle→hue style.
 *
 * A new brush is one entry in `VECTOR_BRUSH_OPS`. The stamp loop, mode
 * picker, help line, momentary key, and attractor kind all read that list.
 */

import { perlin2 } from './metaballField.js';

export interface VectorSample {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface VectorAttractor {
  x: number;
  y: number;
  r: number;
  orbit: boolean;
  /** Flip the influence: clockwise orbit, or a radial push instead of pull. */
  reverse?: boolean;
}

export interface VectorStyle {
  skip: boolean;
  m: number;
  hue: number;
  alpha: number;
  width: number;
  arrow: boolean;
  light: number;
}

export function makeVectorField(
  columns: number,
  rows: number,
  width: number,
  height: number,
): VectorSample[] {
  const out: VectorSample[] = [];
  const cellW = width / columns;
  const cellH = height / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      out.push({ x: (i + 0.5) * cellW, y: (j + 0.5) * cellH, vx: 0, vy: 0 });
    }
  }
  return out;
}

export type VectorStyleOptions = {
  /** Pixels of stroke per unit of magnitude. 0 keeps a constant width. */
  weight?: number;
  /** Thinnest painted stroke. Hover-thin preview stays a 1px hairline. */
  minWidth?: number;
};

/**
 * Original angle→color scheme: hue is the vector direction on a 0–360 wheel
 * (canvas y-down), lightness 62% (75% dimmed preview), alpha grows with
 * magnitude. Vectors under an idle brush render dimmed (preview); vectors
 * under a held paint key render full with arrowheads above 0.08.
 * Painted width is `max(minWidth, magnitude * weight)`.
 */
export function vectorStyle(vx: number, vy: number, preview: boolean, options?: VectorStyleOptions): VectorStyle {
  const m = Math.hypot(vx, vy);
  const weight = options?.weight ?? 2.2;
  const minWidth = options?.minWidth ?? 1;
  if (m < 0.01) return { skip: true, m, hue: 0, alpha: 0, width: 0, arrow: false, light: 62 };
  const hue = ((Math.atan2(vy, vx) * 180) / Math.PI + 180) % 360;
  const alpha = Math.min(0.95, 0.25 + m * 0.9) * (preview ? 0.35 : 1);
  return {
    skip: false,
    m,
    hue,
    alpha,
    width: preview ? 1 : Math.max(minWidth, m * weight),
    arrow: !preview && m > 0.08,
    light: preview ? 75 : 62,
  };
}

/** Heading and magnitude gates applied after a stamp or attractor step. */
export type VectorFieldLimits = {
  /** Degrees, atan2 from +x. The open circle is 0 and 360. */
  angleMin: number;
  angleMax: number;
  /**
   * Snap headings to multiples of this many degrees. 0 leaves the arc continuous.
   * The min/max arc still applies, and the step picks the nearest allowed multiple inside it.
   */
  angleStep: number;
  lengthMin: number;
  lengthMax: number;
};

export const DEFAULT_VECTOR_LIMITS: VectorFieldLimits = {
  angleMin: 0,
  angleMax: 360,
  angleStep: 0,
  lengthMin: 0,
  lengthMax: 3,
};

function normDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function circularDistance(a: number, b: number): number {
  const delta = Math.abs(normDeg(a) - normDeg(b));
  return Math.min(delta, 360 - delta);
}

/** CCW arc from min to max. A span of a full turn leaves the heading alone. */
export function snapVectorHeading(deg: number, angleMin: number, angleMax: number): number {
  if (angleMax - angleMin >= 360 - 1e-6 || angleMin - angleMax >= 360 - 1e-6) return normDeg(deg);
  const start = normDeg(angleMin);
  const end = normDeg(angleMax);
  const width = (end - start + 360) % 360;
  const angle = normDeg(deg);
  if (width === 0) return start;
  const rel = (angle - start + 360) % 360;
  if (rel <= width + 1e-6) return angle;
  const toStart = circularDistance(angle, start);
  const toEnd = circularDistance(angle, end);
  return toStart <= toEnd ? start : end;
}

function headingInsideArc(deg: number, angleMin: number, angleMax: number): boolean {
  return circularDistance(deg, snapVectorHeading(deg, angleMin, angleMax)) < 1e-3;
}

/**
 * Nearest multiple of `step` that still lies on the min/max arc.
 * A step of 0 leaves the arc continuous. If the arc holds no multiple, the arc itself wins.
 */
export function quantizeVectorHeading(deg: number, step: number, angleMin: number, angleMax: number): number {
  const gated = snapVectorHeading(deg, angleMin, angleMax);
  if (!(step > 0) || step >= 360) return gated;
  let best = gated;
  let bestDist = Infinity;
  for (let cursor = 0; cursor < 360; cursor += step) {
    const candidate = normDeg(cursor);
    if (!headingInsideArc(candidate, angleMin, angleMax)) continue;
    const dist = circularDistance(gated, candidate);
    if (dist < bestDist - 1e-6) {
      best = candidate;
      bestDist = dist;
    }
  }
  return bestDist === Infinity ? gated : best;
}

/**
 * Pull a vector into the angle arc, then onto the angle step, then into the length interval.
 * A zero vector stays zero, so a length minimum never invents a direction.
 */
export function constrainVector(vx: number, vy: number, limits?: Partial<VectorFieldLimits>): { vx: number; vy: number } {
  const angleMin = limits?.angleMin ?? DEFAULT_VECTOR_LIMITS.angleMin;
  const angleMax = limits?.angleMax ?? DEFAULT_VECTOR_LIMITS.angleMax;
  const angleStep = limits?.angleStep ?? DEFAULT_VECTOR_LIMITS.angleStep;
  const lengthMin = limits?.lengthMin ?? DEFAULT_VECTOR_LIMITS.lengthMin;
  const lengthMax = limits?.lengthMax ?? DEFAULT_VECTOR_LIMITS.lengthMax;
  const mag = Math.hypot(vx, vy);
  if (mag < 1e-4) return { vx, vy };
  const heading = (Math.atan2(vy, vx) * 180) / Math.PI;
  const snapped = quantizeVectorHeading(heading, angleStep, angleMin, angleMax);
  const lo = Math.min(lengthMin, lengthMax);
  const hi = Math.max(lengthMin, lengthMax);
  const nextMag = Math.min(hi, Math.max(lo, mag));
  if (circularDistance(heading, snapped) < 1e-4) {
    if (nextMag === mag) return { vx, vy };
    const scale = nextMag / mag;
    return { vx: vx * scale, vy: vy * scale };
  }
  const rad = (snapped * Math.PI) / 180;
  return { vx: Math.cos(rad) * nextMag, vy: Math.sin(rad) * nextMag };
}

export function constrainVectorField(field: readonly VectorSample[], limits?: Partial<VectorFieldLimits>): VectorSample[] {
  return field.map((sample) => {
    const next = constrainVector(sample.vx, sample.vy, limits);
    return { ...sample, vx: next.vx, vy: next.vy };
  });
}

export type VectorStampAction = 'paint' | 'erase' | 'smooth';

export type VectorBrushContext = {
  sample: VectorSample;
  brushX: number;
  brushY: number;
  /** 1 at the brush center, 0 at the edge. Samples outside the brush are not passed in. */
  falloff: number;
  strength: number;
  paintScale: number;
  velocityX: number;
  velocityY: number;
  neighbors?: readonly VectorSample[];
};

export type VectorBrushOp = {
  id: string;
  label: string;
  /** Compact label for the segmented mode picker. */
  shortLabel: string;
  blurb: string;
  /** Momentary override key. `F` stays the selected mode and is not listed here. */
  key?: string;
  /** Included in the mode picker. Erase and smooth stay dedicated keys. */
  picker?: boolean;
  needsNeighbors?: boolean;
  /** Kept for older op entries. Length limits cap every op after apply. */
  clamp?: boolean;
  attractor?: Pick<VectorAttractor, 'orbit' | 'reverse'>;
  apply: (ctx: VectorBrushContext) => { vx: number; vy: number };
};

function brushOp<const T extends VectorBrushOp>(spec: T): T {
  return spec;
}

function unit(dx: number, dy: number) {
  const m = Math.hypot(dx, dy) || 1;
  return { x: dx / m, y: dy / m };
}

function accumulate(sample: VectorSample, vx: number, vy: number, scale: number) {
  return { vx: sample.vx + vx * scale, vy: sample.vy + vy * scale };
}

function stampScale(ctx: VectorBrushContext) {
  return ctx.strength * ctx.falloff * ctx.paintScale;
}

function rotateVector(vx: number, vy: number, angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { vx: vx * cosine - vy * sine, vy: vx * sine + vy * cosine };
}

/** Unit curl of Perlin noise, so turbulence breaks up a field without a preferred direction. */
function curlKick(x: number, y: number) {
  const epsilon = 0.75;
  const scale = 0.04;
  const dY = perlin2(x * scale, (y + epsilon) * scale) - perlin2(x * scale, (y - epsilon) * scale);
  const dX = perlin2((x + epsilon) * scale, y * scale) - perlin2((x - epsilon) * scale, y * scale);
  return unit(dY, -dX);
}

export const VECTOR_BRUSH_OPS = [
  brushOp({
    id: 'seek',
    label: 'Seek',
    shortLabel: 'SEEK',
    blurb: 'Vectors point at the cursor (inward). Attractors pull.',
    key: 'g',
    picker: true,
    attractor: { orbit: false },
    apply: (ctx) => {
      const toward = unit(ctx.brushX - ctx.sample.x, ctx.brushY - ctx.sample.y);
      return accumulate(ctx.sample, toward.x, toward.y, stampScale(ctx));
    },
  }),
  brushOp({
    id: 'velocity',
    label: 'Velocity',
    shortLabel: 'VEL',
    blurb: 'Vectors follow mouse speed — whip fast for streams.',
    key: 'v',
    picker: true,
    attractor: { orbit: false },
    apply: (ctx) => accumulate(ctx.sample, ctx.velocityX, ctx.velocityY, stampScale(ctx) * 0.05),
  }),
  brushOp({
    id: 'swirl',
    label: 'Swirl',
    shortLabel: 'SWIRL',
    blurb: 'Brush paints vortices. New attractors go orbital.',
    key: 'c',
    picker: true,
    attractor: { orbit: true },
    apply: (ctx) => {
      const away = unit(ctx.sample.x - ctx.brushX, ctx.sample.y - ctx.brushY);
      return accumulate(ctx.sample, -away.y, away.x, stampScale(ctx));
    },
  }),
  brushOp({
    id: 'swirl-rev',
    label: 'Swirl −',
    shortLabel: 'SWIRL−',
    blurb: 'Opposite swirl — clockwise vortex. New attractors orbit the other way.',
    key: 'b',
    picker: true,
    attractor: { orbit: true, reverse: true },
    apply: (ctx) => {
      const away = unit(ctx.sample.x - ctx.brushX, ctx.sample.y - ctx.brushY);
      return accumulate(ctx.sample, away.y, -away.x, stampScale(ctx));
    },
  }),
  brushOp({
    id: 'repel',
    label: 'Seek −',
    shortLabel: 'SEEK−',
    blurb: 'Opposite seek — vectors point away from the cursor. Attractors push.',
    key: 'h',
    picker: true,
    attractor: { orbit: false, reverse: true },
    apply: (ctx) => {
      const toward = unit(ctx.brushX - ctx.sample.x, ctx.brushY - ctx.sample.y);
      return accumulate(ctx.sample, -toward.x, -toward.y, stampScale(ctx));
    },
  }),
  brushOp({
    id: 'amplify',
    label: 'Amplify',
    shortLabel: 'AMP',
    blurb: 'Scale magnitude up. Direction stays put.',
    key: 'a',
    picker: true,
    clamp: false,
    apply: (ctx) => {
      const gain = 1 + stampScale(ctx);
      return { vx: ctx.sample.vx * gain, vy: ctx.sample.vy * gain };
    },
  }),
  brushOp({
    id: 'damp',
    label: 'Damp',
    shortLabel: 'DAMP',
    blurb: 'Scale magnitude down. Direction stays put.',
    key: 'd',
    picker: true,
    clamp: false,
    apply: (ctx) => {
      const gain = 1 / (1 + stampScale(ctx));
      return { vx: ctx.sample.vx * gain, vy: ctx.sample.vy * gain };
    },
  }),
  brushOp({
    id: 'rotate',
    label: 'Rotate',
    shortLabel: 'ROT',
    blurb: 'Twist existing vectors. A moving brush spins them; a still brush steps 15°.',
    key: 'r',
    picker: true,
    clamp: false,
    apply: (ctx) => {
      const speed = Math.hypot(ctx.velocityX, ctx.velocityY);
      let angle = (Math.PI / 12) * stampScale(ctx);
      if (speed > 0.4) {
        const orbit = (ctx.sample.x - ctx.brushX) * ctx.velocityY - (ctx.sample.y - ctx.brushY) * ctx.velocityX;
        angle = Math.sign(orbit || 1) * speed * 0.02 * ctx.falloff * ctx.paintScale;
      }
      return rotateVector(ctx.sample.vx, ctx.sample.vy, angle);
    },
  }),
  brushOp({
    id: 'smudge',
    label: 'Smudge',
    shortLabel: 'SMUDGE',
    blurb: 'Drag existing flow along the stroke.',
    key: 's',
    picker: true,
    needsNeighbors: true,
    clamp: false,
    apply: (ctx) => {
      const speed = Math.hypot(ctx.velocityX, ctx.velocityY);
      if (speed < 0.4) return { vx: ctx.sample.vx, vy: ctx.sample.vy };
      const upstreamX = -ctx.velocityX / speed;
      const upstreamY = -ctx.velocityY / speed;
      let source = ctx.sample;
      let best = 0.2;
      for (const neighbor of ctx.neighbors ?? []) {
        if (neighbor === ctx.sample) continue;
        const dx = neighbor.x - ctx.sample.x;
        const dy = neighbor.y - ctx.sample.y;
        const distance = Math.hypot(dx, dy) || 1;
        const dot = (dx / distance) * upstreamX + (dy / distance) * upstreamY;
        if (dot > best) {
          best = dot;
          source = neighbor;
        }
      }
      const mix = Math.min(1, ctx.falloff * ctx.strength * ctx.paintScale);
      return {
        vx: ctx.sample.vx + (source.vx - ctx.sample.vx) * mix,
        vy: ctx.sample.vy + (source.vy - ctx.sample.vy) * mix,
      };
    },
  }),
  brushOp({
    id: 'drain',
    label: 'Drain',
    shortLabel: 'DRAIN',
    blurb: 'Inward spiral. Swirl plus a pull toward the cursor.',
    key: 'j',
    picker: true,
    attractor: { orbit: false },
    apply: (ctx) => {
      const toward = unit(ctx.brushX - ctx.sample.x, ctx.brushY - ctx.sample.y);
      const away = unit(ctx.sample.x - ctx.brushX, ctx.sample.y - ctx.brushY);
      return accumulate(ctx.sample, toward.x - away.y, toward.y + away.x, stampScale(ctx));
    },
  }),
  brushOp({
    id: 'turbulence',
    label: 'Turbulence',
    shortLabel: 'TURB',
    blurb: 'Curl-noise kick. Breaks up a clean field.',
    key: 't',
    picker: true,
    apply: (ctx) => {
      const kick = curlKick(ctx.sample.x, ctx.sample.y);
      return accumulate(ctx.sample, kick.x, kick.y, stampScale(ctx));
    },
  }),
  brushOp({
    id: 'normalize',
    label: 'Normalize',
    shortLabel: 'NORM',
    blurb: 'Pin magnitude to the strength slider. Direction stays put.',
    key: 'm',
    picker: true,
    clamp: false,
    apply: (ctx) => {
      const magnitude = Math.hypot(ctx.sample.vx, ctx.sample.vy);
      if (magnitude < 1e-4) return { vx: ctx.sample.vx, vy: ctx.sample.vy };
      const target = Math.max(0.2, ctx.strength);
      const next = magnitude + (target - magnitude) * Math.min(1, ctx.falloff * ctx.paintScale);
      return { vx: (ctx.sample.vx / magnitude) * next, vy: (ctx.sample.vy / magnitude) * next };
    },
  }),
  brushOp({
    id: 'invert',
    label: 'Invert',
    shortLabel: 'INVERT',
    blurb: 'Flip vectors already under the brush.',
    key: 'i',
    picker: true,
    clamp: false,
    apply: (ctx) => {
      const scale = 1 - 2 * Math.min(1, ctx.falloff * ctx.strength * ctx.paintScale);
      return { vx: ctx.sample.vx * scale, vy: ctx.sample.vy * scale };
    },
  }),
  brushOp({
    id: 'erase',
    label: 'Erase',
    shortLabel: 'ERASE',
    blurb: 'Zero vectors in the brush.',
    key: 'e',
    clamp: false,
    apply: () => ({ vx: 0, vy: 0 }),
  }),
  brushOp({
    id: 'smooth',
    label: 'Smooth',
    shortLabel: 'SMOOTH',
    blurb: 'Average neighbors in the brush.',
    key: 'q',
    needsNeighbors: true,
    clamp: false,
    apply: (ctx) => {
      const neighbors = ctx.neighbors?.length ? ctx.neighbors : [ctx.sample];
      const count = neighbors.length;
      return {
        vx: neighbors.reduce((sum, sample) => sum + sample.vx, 0) / count,
        vy: neighbors.reduce((sum, sample) => sum + sample.vy, 0) / count,
      };
    },
  }),
] as const;

export type VectorFieldMode = Extract<(typeof VECTOR_BRUSH_OPS)[number], { picker: true }>['id'];

const BRUSH_OPS_BY_ID = new Map<string, VectorBrushOp>(VECTOR_BRUSH_OPS.map((op) => [op.id, op]));

export function vectorBrushOp(id: string): VectorBrushOp {
  const op = BRUSH_OPS_BY_ID.get(id);
  if (!op) throw new Error(`Unknown vector brush op: ${id}`);
  return op;
}

export function findVectorBrushOp(id: string): VectorBrushOp | undefined {
  return BRUSH_OPS_BY_ID.get(id);
}

export function vectorBrushPickerOps(): readonly VectorBrushOp[] {
  return VECTOR_BRUSH_OPS.filter((op) => op.picker);
}

function brushNeighbors(field: readonly VectorSample[], index: number, columns: number, rows: number): VectorSample[] {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const neighbors: VectorSample[] = [];
  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dColumn = -1; dColumn <= 1; dColumn++) {
      const nextColumn = column + dColumn;
      const nextRow = row + dRow;
      if (nextColumn < 0 || nextRow < 0 || nextColumn >= columns || nextRow >= rows) continue;
      neighbors.push(field[nextRow * columns + nextColumn]);
    }
  }
  return neighbors;
}

function resolveBrushOpId(options: { op?: string; action?: VectorStampAction; mode?: string }): string {
  if (options.op) return options.op;
  if (options.action && options.action !== 'paint') return options.action;
  return options.mode ?? 'velocity';
}

export function stampVectorField(
  field: readonly VectorSample[],
  options: {
    columns: number;
    rows: number;
    x: number;
    y: number;
    radius: number;
    action?: VectorStampAction;
    mode?: VectorFieldMode;
    /** Brush op id. Wins over `action` and `mode`. */
    op?: string;
    strength: number;
    velocityX?: number;
    velocityY?: number;
    paintScale?: number;
    /** Defaults match the open angle circle and the length cap of 3. */
    limits?: Partial<VectorFieldLimits>;
  },
): VectorSample[] {
  const brush = vectorBrushOp(resolveBrushOpId(options));
  const paintScale = options.paintScale ?? 1;
  const next = field.map((sample) => ({ ...sample }));
  for (let index = 0; index < next.length; index++) {
    const sample = field[index];
    const distance = Math.hypot(sample.x - options.x, sample.y - options.y);
    if (distance > options.radius) continue;
    const written = brush.apply({
      sample,
      brushX: options.x,
      brushY: options.y,
      falloff: 1 - distance / options.radius,
      strength: options.strength,
      paintScale,
      velocityX: options.velocityX ?? 0,
      velocityY: options.velocityY ?? 0,
      neighbors: brush.needsNeighbors ? brushNeighbors(field, index, options.columns, options.rows) : undefined,
    });
    const limited = constrainVector(written.vx, written.vy, options.limits);
    next[index].vx = limited.vx;
    next[index].vy = limited.vy;
  }
  return next;
}

/** Unit stamp a zero sample would receive at full strength and falloff. */
export function vectorStampDelta(
  mode: VectorFieldMode,
  sampleX: number,
  sampleY: number,
  brushX: number,
  brushY: number,
  velocityX = 0,
  velocityY = 0,
): { vx: number; vy: number } {
  return vectorBrushOp(mode).apply({
    sample: { x: sampleX, y: sampleY, vx: 0, vy: 0 },
    brushX,
    brushY,
    falloff: 1,
    strength: 1,
    paintScale: 1,
    velocityX,
    velocityY,
  });
}

export function applyVectorAttractors(
  field: readonly VectorSample[],
  attractors: readonly VectorAttractor[],
  limits?: Partial<VectorFieldLimits>,
): VectorSample[] {
  if (attractors.length === 0) return field.slice().map((sample) => ({ ...sample }));
  const next = field.map((sample) => ({ ...sample }));
  for (const attractor of attractors) {
    for (const sample of next) {
      const dx = sample.x - attractor.x;
      const dy = sample.y - attractor.y;
      const d = Math.hypot(dx, dy);
      if (d > attractor.r || d < 0.001) continue;
      const fall = 1 - d / attractor.r;
      const sign = attractor.reverse ? -1 : 1;
      if (attractor.orbit) {
        sample.vx += sign * (-dy / d) * fall * 0.06;
        sample.vy += sign * (dx / d) * fall * 0.06;
      } else {
        sample.vx += sign * (-dx / d) * fall * 0.04;
        sample.vy += sign * (-dy / d) * fall * 0.04;
      }
    }
  }
  if (!limits) return next;
  return constrainVectorField(next, limits);
}
