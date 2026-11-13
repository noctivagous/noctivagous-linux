/**
 * Edge-aligned rectangular sample lattice used by Dot Shading. Positions sit
 * on a cols×rows grid (spacing = width / columns, matching the lab). Jitter
 * is hashed from column/row/seed so a document reopens with the same scatter.
 */

export type SampleGainPoint = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  col: number;
  row: number;
  radius: number;
  rotation: number;
};

export type ShadingFalloff = 'Linear' | 'Smoothstep' | 'Gaussian' | 'Sharp';
export type SampleStampAction = 'grow' | 'shrink' | 'smooth' | 'clear';
export type SampleRotationMode = 'None' | 'Random' | 'Brush Direction' | 'Radial' | 'Brush + Random' | 'Spiral';

export function sampleSpacing(columns: number, width: number): number {
  return width / Math.max(1, columns);
}

function hashUnit(col: number, row: number, seed: number, salt: number): number {
  let n = (Math.imul(col + 1, 374761393) ^ Math.imul(row + 1, 668265263) ^ Math.imul(seed + 1, 1274126177) ^ Math.imul(salt, 1103515245)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return (n >>> 0) / 4294967296;
}

export function makeSampleLattice(
  columns: number,
  rows: number,
  width: number,
  height: number,
  options: { jitter?: number; seed?: number; radius?: number } = {},
): SampleGainPoint[] {
  const spacing = sampleSpacing(columns, width);
  const offsetX = (width - (columns - 1) * spacing) / 2;
  const offsetY = (height - (rows - 1) * spacing) / 2;
  const jitter = options.jitter ?? 0;
  const seed = options.seed ?? 1;
  const baseRadius = options.radius ?? 1;
  const out: SampleGainPoint[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const baseX = offsetX + col * spacing;
      const baseY = offsetY + row * spacing;
      const jx = jitter ? (hashUnit(col, row, seed, 1) - 0.5) * spacing * jitter : 0;
      const jy = jitter ? (hashUnit(col, row, seed, 2) - 0.5) * spacing * jitter : 0;
      const rotation = hashUnit(col, row, seed, 3) * Math.PI * 2;
      out.push({
        x: baseX + jx,
        y: baseY + jy,
        baseX,
        baseY,
        col,
        row,
        radius: baseRadius,
        rotation,
      });
    }
  }
  return out;
}

export function shadingFalloff(norm: number, type: ShadingFalloff, power: number): number {
  let value = norm;
  if (type === 'Smoothstep') value = norm * norm * (3 - 2 * norm);
  else if (type === 'Gaussian') {
    const d = 1 - norm;
    value = Math.exp(-(d * d) * 5.5);
  } else if (type === 'Sharp') {
    value = Math.pow(Math.pow(norm, 0.5) * norm, 0.7);
  }
  return Math.pow(Math.max(0, value), power);
}

export function stampSampleGain(
  points: readonly SampleGainPoint[],
  options: {
    columns: number;
    rows: number;
    width: number;
    x: number;
    y: number;
    radius: number;
    action: SampleStampAction;
    intensity: number;
    falloffType: ShadingFalloff;
    falloffPower: number;
    minRadius: number;
    maxRadius: number;
    rotationMode: SampleRotationMode;
    rotationJitter: number;
    brushAngle?: number;
    height?: number;
  },
): SampleGainPoint[] {
  const next = points.map((point) => ({ ...point }));
  const spacing = sampleSpacing(options.columns, options.width);
  const neighbor = spacing * 1.8;
  const neighbor2 = neighbor * neighbor;
  if (options.action === 'smooth') {
    const averages = next.map((point) => {
      if (Math.hypot(point.x - options.x, point.y - options.y) > options.radius) return point.radius;
      let sum = 0, count = 0;
      for (const other of next) {
        const dx = point.x - other.x, dy = point.y - other.y;
        if (dx * dx + dy * dy < neighbor2) {
          sum += other.radius;
          count += 1;
        }
      }
      return count ? sum / count : point.radius;
    });
    for (let index = 0; index < next.length; index++) {
      const point = next[index];
      const dist = Math.hypot(point.x - options.x, point.y - options.y);
      if (dist >= options.radius) continue;
      const infl = shadingFalloff(1 - dist / options.radius, options.falloffType, options.falloffPower) * options.intensity * 0.22;
      point.radius = point.radius + (averages[index] - point.radius) * infl;
      applyRotation(point, options);
    }
    return next;
  }
  for (const point of next) {
    const dist = Math.hypot(point.x - options.x, point.y - options.y);
    if (dist >= options.radius) continue;
    if (options.action === 'clear') {
      point.radius = 1;
      continue;
    }
    const infl = shadingFalloff(1 - dist / options.radius, options.falloffType, options.falloffPower) * options.intensity * 0.4;
    if (options.action === 'grow') point.radius = Math.min(options.maxRadius, point.radius + infl);
    else point.radius = Math.max(options.minRadius, point.radius - infl);
    applyRotation(point, options);
  }
  return next;
}

function applyRotation(
  point: SampleGainPoint,
  options: {
    x: number;
    y: number;
    width: number;
    height?: number;
    rotationMode: SampleRotationMode;
    rotationJitter: number;
    brushAngle?: number;
  },
) {
  const jitter = ((options.rotationJitter * Math.PI) / 180) * (hashUnit(point.col, point.row, 9, 4) - 0.5);
  if (options.rotationMode === 'None') {
    point.rotation = 0;
    return;
  }
  if (options.rotationMode === 'Random') {
    point.rotation = hashUnit(point.col, point.row, 11, 5) * Math.PI * 2;
    return;
  }
  if (options.rotationMode === 'Brush Direction' || options.rotationMode === 'Brush + Random') {
    point.rotation = (options.brushAngle ?? point.rotation) + jitter * (options.rotationMode === 'Brush + Random' ? 3 : 1);
    return;
  }
  if (options.rotationMode === 'Radial') {
    point.rotation = Math.atan2(point.y - options.y, point.x - options.x) + Math.PI / 2;
    return;
  }
  const cx = options.width / 2;
  const cy = (options.height ?? options.width * 0.75) / 2;
  const ang = Math.atan2(point.y - cy, point.x - cx);
  const dist = Math.hypot(point.x - cx, point.y - cy);
  point.rotation = ang + dist * 0.01;
}
