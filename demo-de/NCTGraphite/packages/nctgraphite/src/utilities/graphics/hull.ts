/**
 * Polygon hulls: convex monotone chain, shared-edge clustering, and
 * perimeter tracing. Topology-agnostic — callers pass cell polygons so
 * diamond and triangle grids stay distinct from hexes.
 */

import type { NCTGraphitePoint } from '../../grid/NCTGraphiteGridGeometry.js';

export type HullMode = 'tight' | 'smooth' | 'convex' | 'concave';

export interface HullPolygon {
  id: string;
  corners: readonly NCTGraphitePoint[];
}

export interface HullLoop {
  points: NCTGraphitePoint[];
  hole: boolean;
}

export function convexHull(points: readonly NCTGraphitePoint[]): NCTGraphitePoint[] {
  if (points.length <= 1) return points.slice();
  const sorted = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: NCTGraphitePoint, a: NCTGraphitePoint, b: NCTGraphitePoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: NCTGraphitePoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper: NCTGraphitePoint[] = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function chaikinSmooth(points: readonly NCTGraphitePoint[], iterations = 1): NCTGraphitePoint[] {
  let current = points.slice();
  for (let step = 0; step < iterations; step++) {
    const next: NCTGraphitePoint[] = [];
    for (let index = 0; index < current.length; index++) {
      const a = current[index];
      const b = current[(index + 1) % current.length];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    current = next;
  }
  return current;
}

export function polygonArea(points: readonly NCTGraphitePoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function pointKey(point: NCTGraphitePoint): string {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
}

function undirectedEdgeKey(a: NCTGraphitePoint, b: NCTGraphitePoint): string {
  const left = pointKey(a);
  const right = pointKey(b);
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

/** Clusters polygons that share an edge. Isolated cells are their own cluster. */
export function clusterPolygons(cells: readonly HullPolygon[]): string[][] {
  const edgeOwners = new Map<string, string[]>();
  for (const cell of cells) {
    for (let index = 0; index < cell.corners.length; index++) {
      const key = undirectedEdgeKey(cell.corners[index], cell.corners[(index + 1) % cell.corners.length]);
      const owners = edgeOwners.get(key) ?? [];
      owners.push(cell.id);
      edgeOwners.set(key, owners);
    }
  }
  const adjacency = new Map<string, Set<string>>();
  for (const owners of edgeOwners.values()) {
    if (owners.length < 2) continue;
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        if (!adjacency.has(owners[i])) adjacency.set(owners[i], new Set());
        if (!adjacency.has(owners[j])) adjacency.set(owners[j], new Set());
        adjacency.get(owners[i])!.add(owners[j]);
        adjacency.get(owners[j])!.add(owners[i]);
      }
    }
  }
  const remaining = new Set(cells.map((cell) => cell.id));
  const clusters: string[][] = [];
  for (const start of remaining) {
    const cluster: string[] = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const id = queue.pop()!;
      cluster.push(id);
      for (const next of adjacency.get(id) ?? []) {
        if (!remaining.has(next)) continue;
        remaining.delete(next);
        queue.push(next);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

/** Outer and hole loops from edges used by exactly one polygon. */
export function tracePerimeter(cells: readonly HullPolygon[]): NCTGraphitePoint[][] {
  const edgeUses = new Map<string, { a: NCTGraphitePoint; b: NCTGraphitePoint; count: number }>();
  for (const cell of cells) {
    for (let index = 0; index < cell.corners.length; index++) {
      const a = cell.corners[index];
      const b = cell.corners[(index + 1) % cell.corners.length];
      const key = undirectedEdgeKey(a, b);
      const entry = edgeUses.get(key);
      if (entry) entry.count += 1;
      else edgeUses.set(key, { a, b, count: 1 });
    }
  }
  const perimeter = [...edgeUses.values()].filter((edge) => edge.count === 1);
  const atVertex = new Map<string, { a: NCTGraphitePoint; b: NCTGraphitePoint }[]>();
  for (const edge of perimeter) {
    const start = pointKey(edge.a);
    const end = pointKey(edge.b);
    if (!atVertex.has(start)) atVertex.set(start, []);
    if (!atVertex.has(end)) atVertex.set(end, []);
    atVertex.get(start)!.push(edge);
    atVertex.get(end)!.push(edge);
  }
  const used = new Set<string>();
  const loops: NCTGraphitePoint[][] = [];
  for (const edge of perimeter) {
    const startKey = undirectedEdgeKey(edge.a, edge.b);
    if (used.has(startKey)) continue;
    const loop: NCTGraphitePoint[] = [edge.a];
    used.add(startKey);
    let current = edge.b;
    let guard = 0;
    while (guard++ < perimeter.length + 2) {
      loop.push(current);
      if (pointKey(current) === pointKey(loop[0]) && loop.length > 2) {
        loop.pop();
        break;
      }
      const next = (atVertex.get(pointKey(current)) ?? []).find((candidate) => !used.has(undirectedEdgeKey(candidate.a, candidate.b)));
      if (!next) break;
      used.add(undirectedEdgeKey(next.a, next.b));
      current = pointKey(next.a) === pointKey(current) ? next.b : next.a;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
}

export function hullLoopsFromPolygons(
  cells: readonly HullPolygon[],
  mode: HullMode,
): HullLoop[] {
  if (cells.length === 0) return [];
  if (mode === 'convex') {
    const points = convexHull(cells.flatMap((cell) => cell.corners.slice()));
    return points.length >= 3 ? [{ points, hole: false }] : [];
  }
  const loops: HullLoop[] = [];
  for (const ids of clusterPolygons(cells)) {
    const cluster = cells.filter((cell) => ids.includes(cell.id));
    const traced = tracePerimeter(cluster);
    traced.forEach((points, index) => {
      const smoothed = mode === 'smooth' ? chaikinSmooth(points, 2) : points;
      loops.push({ points: smoothed, hole: index > 0 });
    });
  }
  return loops;
}
