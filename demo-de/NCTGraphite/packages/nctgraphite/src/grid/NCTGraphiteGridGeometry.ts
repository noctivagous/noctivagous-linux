/**
 * Framework-free grid geometry shared by canvas, SVG, and WebGL renderers.
 * Coordinates use `q`/`r`: axial for hexes, column/row for squares and
 * triangle pairs. Optional `s` selects a sub-cell (diamond 0–2 inside a hex,
 * or triangle 0/1 inside a pair).
 */

export type NCTGraphiteGridKind =
  | 'square'
  | 'hex-flat'
  | 'hex-pointy'
  | 'hex-flat-diamond'
  | 'tri-horiz'
  | 'tri-vert';

export interface NCTGraphitePoint {
  x: number;
  y: number;
}

export interface NCTGraphiteGridCoordinate {
  q: number;
  r: number;
  /** Diamond index 0–2, or triangle index 0–1. Omitted for square and whole hexes. */
  s?: number;
}

export interface NCTGraphiteGridSpec {
  kind: NCTGraphiteGridKind;
  /**
   * Hex and diamond: radius from center to vertex.
   * Square: half the cell width (side length `size * 2`).
   * Triangle: side length of each triangle.
   */
  size: number;
  origin?: NCTGraphitePoint;
}

export interface NCTGraphiteGridCell extends NCTGraphiteGridCoordinate {
  id: string;
  center: NCTGraphitePoint;
  corners: NCTGraphitePoint[];
}

export interface NCTGraphiteGridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const SQRT_3 = Math.sqrt(3);
const EPSILON = 1e-9;
const HEX_FLAT: NCTGraphiteGridKind = 'hex-flat';

function assertValidSpec(spec: NCTGraphiteGridSpec): void {
  if (!Number.isFinite(spec.size) || spec.size <= 0) {
    throw new Error('NCTGraphite grid size must be a finite number greater than zero.');
  }
}

function originOf(spec: NCTGraphiteGridSpec): NCTGraphitePoint {
  return spec.origin ?? { x: 0, y: 0 };
}

function centroid(points: readonly NCTGraphitePoint[]): NCTGraphitePoint {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function isOdd(value: number): boolean {
  return ((value % 2) + 2) % 2 === 1;
}

function hexFlatSpec(spec: NCTGraphiteGridSpec): NCTGraphiteGridSpec {
  return { ...spec, kind: HEX_FLAT };
}

function hexCorners(spec: NCTGraphiteGridSpec, coordinate: NCTGraphiteGridCoordinate, startDegrees: number): NCTGraphitePoint[] {
  const center = hexCenter(spec, coordinate, startDegrees === 0 ? 'hex-flat' : 'hex-pointy');
  return Array.from({ length: 6 }, (_, index) => {
    const radians = (startDegrees + index * 60) * Math.PI / 180;
    return { x: center.x + spec.size * Math.cos(radians), y: center.y + spec.size * Math.sin(radians) };
  });
}

function hexCenter(spec: NCTGraphiteGridSpec, coordinate: NCTGraphiteGridCoordinate, kind: 'hex-flat' | 'hex-pointy'): NCTGraphitePoint {
  const { q, r } = coordinate;
  const { x, y } = originOf(spec);
  if (kind === 'hex-flat') return { x: x + spec.size * 1.5 * q, y: y + spec.size * SQRT_3 * (r + q / 2) };
  return { x: x + spec.size * SQRT_3 * (q + r / 2), y: y + spec.size * 1.5 * r };
}

function diamondCorners(spec: NCTGraphiteGridSpec, coordinate: NCTGraphiteGridCoordinate): NCTGraphitePoint[] {
  const hex = hexCorners(spec, coordinate, 0);
  const center = hexCenter(spec, coordinate, 'hex-flat');
  const s = coordinate.s ?? 0;
  return [hex[s * 2], hex[(s * 2 + 1) % 6], hex[(s * 2 + 2) % 6], center];
}

function trianglePair(spec: NCTGraphiteGridSpec, coordinate: NCTGraphiteGridCoordinate): [NCTGraphitePoint[], NCTGraphitePoint[]] {
  const size = spec.size;
  const alt = size * SQRT_3 / 2;
  const origin = originOf(spec);
  const odd = isOdd(coordinate.r);
  const baseAlong = coordinate.q * size + (odd ? size / 2 : 0);
  const baseAcross = coordinate.r * alt;
  const project = (along: number, across: number): NCTGraphitePoint => (
    spec.kind === 'tri-vert'
      ? { x: origin.x + across, y: origin.y + along }
      : { x: origin.x + along, y: origin.y + across }
  );
  const p0 = project(baseAlong, baseAcross);
  const p1 = project(baseAlong + size, baseAcross);
  const p2 = project(baseAlong + size + size / 2, baseAcross + alt);
  const p3 = project(baseAlong + size / 2, baseAcross + alt);
  return [[p0, p1, p3], [p1, p2, p3]];
}

function triangleCorners(spec: NCTGraphiteGridSpec, coordinate: NCTGraphiteGridCoordinate): NCTGraphitePoint[] {
  const pair = trianglePair(spec, coordinate);
  return pair[coordinate.s === 1 ? 1 : 0];
}

function subcellRange(kind: NCTGraphiteGridKind): number[] | null {
  if (kind === 'hex-flat-diamond') return [0, 1, 2];
  if (kind === 'tri-horiz' || kind === 'tri-vert') return [0, 1];
  return null;
}

/** Convert an axial hex, square column/row, or sub-cell coordinate into document space. */
export function gridCoordinateToPoint(
  spec: NCTGraphiteGridSpec,
  coordinate: NCTGraphiteGridCoordinate,
): NCTGraphitePoint {
  assertValidSpec(spec);
  const { q, r } = coordinate;
  const { x, y } = originOf(spec);
  if (spec.kind === 'square') return { x: x + q * spec.size * 2, y: y + r * spec.size * 2 };
  if (spec.kind === 'hex-flat') return hexCenter(spec, coordinate, 'hex-flat');
  if (spec.kind === 'hex-pointy') return hexCenter(spec, coordinate, 'hex-pointy');
  if (spec.kind === 'hex-flat-diamond') return centroid(diamondCorners(spec, coordinate));
  return centroid(triangleCorners(spec, coordinate));
}

/** Return the unrounded parent-grid coordinate for a document-space point. */
export function pointToFractionalGridCoordinate(
  spec: NCTGraphiteGridSpec,
  point: NCTGraphitePoint,
): NCTGraphiteGridCoordinate {
  assertValidSpec(spec);
  const origin = originOf(spec);
  const x = point.x - origin.x;
  const y = point.y - origin.y;
  if (spec.kind === 'square') return { q: x / (spec.size * 2), r: y / (spec.size * 2) };
  if (spec.kind === 'hex-flat' || spec.kind === 'hex-flat-diamond') {
    return { q: (2 / 3 * x) / spec.size, r: (-1 / 3 * x + SQRT_3 / 3 * y) / spec.size };
  }
  if (spec.kind === 'hex-pointy') {
    return { q: (SQRT_3 / 3 * x - 1 / 3 * y) / spec.size, r: (2 / 3 * y) / spec.size };
  }
  const along = spec.kind === 'tri-vert' ? y : x;
  const across = spec.kind === 'tri-vert' ? x : y;
  const alt = spec.size * SQRT_3 / 2;
  return { q: along / spec.size, r: across / alt };
}

/** Round a fractional axial hex coordinate while preserving q + r + s = 0. */
export function roundHexCoordinate(coordinate: NCTGraphiteGridCoordinate): NCTGraphiteGridCoordinate {
  let q = Math.round(coordinate.q);
  let r = Math.round(coordinate.r);
  const s = Math.round(-coordinate.q - coordinate.r);
  const qDelta = Math.abs(q - coordinate.q);
  const rDelta = Math.abs(r - coordinate.r);
  const sDelta = Math.abs(s - (-coordinate.q - coordinate.r));
  if (qDelta > rDelta && qDelta > sDelta) q = -r - s;
  else if (rDelta > sDelta) r = -q - s;
  return { q: q === 0 ? 0 : q, r: r === 0 ? 0 : r };
}

function diamondIndex(spec: NCTGraphiteGridSpec, hex: NCTGraphiteGridCoordinate, point: NCTGraphitePoint): number {
  for (const s of [0, 1, 2]) {
    if (pointInPolygon(point, diamondCorners(spec, { ...hex, s }))) return s;
  }
  return 0;
}

function triangleIndex(spec: NCTGraphiteGridSpec, pair: NCTGraphiteGridCoordinate, point: NCTGraphitePoint): number {
  const [first, second] = trianglePair(spec, pair);
  if (pointInPolygon(point, second) && !pointInPolygon(point, first)) return 1;
  return 0;
}

/** Find the cell containing a point. For square grids, q/r are rounded to nearest. */
export function pointToGridCoordinate(
  spec: NCTGraphiteGridSpec,
  point: NCTGraphitePoint,
): NCTGraphiteGridCoordinate {
  const fractional = pointToFractionalGridCoordinate(spec, point);
  if (spec.kind === 'square') return { q: Math.floor(fractional.q + 0.5), r: Math.floor(fractional.r + 0.5) };
  if (spec.kind === 'hex-flat' || spec.kind === 'hex-pointy') return roundHexCoordinate(fractional);
  if (spec.kind === 'hex-flat-diamond') {
    const hex = roundHexCoordinate(fractional);
    return { ...hex, s: diamondIndex(spec, hex, point) };
  }
  const r = Math.round(fractional.r);
  const odd = isOdd(r);
  const q = Math.round(fractional.q - (odd ? 0.5 : 0));
  const pair = { q, r };
  return { ...pair, s: triangleIndex(spec, pair, point) };
}

/** Corners are clockwise in screen coordinates. Hexes begin at the rightmost vertex. */
export function gridCellCorners(
  spec: NCTGraphiteGridSpec,
  coordinate: NCTGraphiteGridCoordinate,
): NCTGraphitePoint[] {
  const center = spec.kind === 'hex-flat-diamond' || spec.kind === 'tri-horiz' || spec.kind === 'tri-vert'
    ? null
    : gridCoordinateToPoint(spec, coordinate);
  if (spec.kind === 'square' && center) {
    const s = spec.size;
    return [
      { x: center.x - s, y: center.y - s },
      { x: center.x + s, y: center.y - s },
      { x: center.x + s, y: center.y + s },
      { x: center.x - s, y: center.y + s },
    ];
  }
  if (spec.kind === 'hex-flat') return hexCorners(spec, coordinate, 0);
  if (spec.kind === 'hex-pointy') return hexCorners(spec, coordinate, 30);
  if (spec.kind === 'hex-flat-diamond') return diamondCorners(spec, coordinate);
  return triangleCorners(spec, coordinate);
}

export function gridCell(
  spec: NCTGraphiteGridSpec,
  coordinate: NCTGraphiteGridCoordinate,
): NCTGraphiteGridCell {
  const corners = gridCellCorners(spec, coordinate);
  const center = centroid(corners);
  return {
    ...coordinate,
    id: gridCellId(coordinate),
    center,
    corners,
  };
}

export function gridCellId({ q, r, s }: NCTGraphiteGridCoordinate): string {
  return s == null ? `${q},${r}` : `${q},${r},${s}`;
}

/** Orthogonal square neighbors, axial hex neighbors, or same-parent sub-cells. */
export function gridNeighbors(
  spec: Pick<NCTGraphiteGridSpec, 'kind'>,
  coordinate: NCTGraphiteGridCoordinate,
): NCTGraphiteGridCoordinate[] {
  if (spec.kind === 'square') {
    return [{ q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }]
      .map((offset) => ({ q: coordinate.q + offset.q, r: coordinate.r + offset.r }));
  }
  if (spec.kind === 'hex-flat' || spec.kind === 'hex-pointy') {
    return [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }]
      .map((offset) => ({ q: coordinate.q + offset.q, r: coordinate.r + offset.r }));
  }
  if (spec.kind === 'hex-flat-diamond') {
    const s = coordinate.s ?? 0;
    return [0, 1, 2].filter((index) => index !== s).map((index) => ({ q: coordinate.q, r: coordinate.r, s: index }));
  }
  const s = coordinate.s === 1 ? 0 : 1;
  return [{ q: coordinate.q, r: coordinate.r, s }];
}

/** Exact polygon test for a candidate cell. Useful with custom or bounded layouts. */
export function pointInGridCell(
  spec: NCTGraphiteGridSpec,
  coordinate: NCTGraphiteGridCoordinate,
  point: NCTGraphitePoint,
): boolean {
  return pointInPolygon(point, gridCellCorners(spec, coordinate));
}

/** Ray-casting polygon test. Points on a boundary count as inside. */
export function pointInPolygon(point: NCTGraphitePoint, polygon: readonly NCTGraphitePoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[previous];
    const b = polygon[index];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    const onSegment = Math.abs(cross) <= EPSILON &&
      point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON &&
      point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON;
    if (onSegment) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Axis-aligned bounds for a cell polygon. */
export function gridCellBounds(
  spec: NCTGraphiteGridSpec,
  coordinate: NCTGraphiteGridCoordinate,
): NCTGraphiteGridBounds {
  const corners = gridCellCorners(spec, coordinate);
  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
}

/** Enumerate grid cells whose polygon bounds intersect a document-space rectangle. */
export function gridCellsInBounds(
  spec: NCTGraphiteGridSpec,
  bounds: NCTGraphiteGridBounds,
): NCTGraphiteGridCell[] {
  const parent = spec.kind === 'hex-flat-diamond' ? hexFlatSpec(spec) : spec;
  const corners = [
    pointToFractionalGridCoordinate(parent, { x: bounds.minX, y: bounds.minY }),
    pointToFractionalGridCoordinate(parent, { x: bounds.minX, y: bounds.maxY }),
    pointToFractionalGridCoordinate(parent, { x: bounds.maxX, y: bounds.minY }),
    pointToFractionalGridCoordinate(parent, { x: bounds.maxX, y: bounds.maxY }),
  ];
  const padding = spec.kind === 'square' ? 1 : 2;
  const minQ = Math.floor(Math.min(...corners.map((corner) => corner.q))) - padding;
  const maxQ = Math.ceil(Math.max(...corners.map((corner) => corner.q))) + padding;
  const minR = Math.floor(Math.min(...corners.map((corner) => corner.r))) - padding;
  const maxR = Math.ceil(Math.max(...corners.map((corner) => corner.r))) + padding;
  const cells: NCTGraphiteGridCell[] = [];
  const subcells = subcellRange(spec.kind);
  for (let q = minQ; q <= maxQ; q++) {
    for (let r = minR; r <= maxR; r++) {
      const coordinates = subcells ? subcells.map((s) => ({ q, r, s })) : [{ q, r }];
      for (const coordinate of coordinates) {
        const cell = gridCell(spec, coordinate);
        const cellBounds = gridCellBounds(spec, cell);
        if (cellBounds.maxX >= bounds.minX && cellBounds.minX <= bounds.maxX && cellBounds.maxY >= bounds.minY && cellBounds.minY <= bounds.maxY) cells.push(cell);
      }
    }
  }
  return cells;
}
