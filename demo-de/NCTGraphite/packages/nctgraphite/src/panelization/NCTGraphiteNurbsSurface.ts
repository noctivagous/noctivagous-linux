/**
 * A rational B-spline (NURBS) surface with normalized parameters,
 * standing in for iGeo's ISurface in the panelization port.
 *
 * iGeo's tutorial loads its surface from a Rhino file (srf1.3dm);
 * this port defines surfaces in code instead. Parameters `u`/`v`
 * are normalized to 0..1 across the surface, matching how the
 * tutorial addresses it (IParticleOnSurface takes normalized UV).
 *
 * Evaluation follows Piegl & Tiller: basis functions by Cox–de Boor,
 * partial derivatives from the differenced control nets of the
 * homogeneous surface, rational quotient rule applied at the end.
 */

import {
  vec3,
  vAdd,
  vScale,
  vSub,
  vCross,
  vUnit,
  type NCTGraphiteVec3,
} from './NCTGraphiteVec3.js';

export interface NCTGraphiteNurbsSurfaceSpec {
  /** Control net, indexed [v row][u column]. */
  controlPoints: NCTGraphiteVec3[][];
  /** Optional weights, same shape as controlPoints. Defaults to 1. */
  weights?: number[][];
  degreeU?: number;
  degreeV?: number;
  /** Knot vectors in the normalized 0..1 domain. Default: clamped uniform. */
  knotsU?: number[];
  knotsV?: number[];
}

export interface NCTGraphiteSurfaceFrame {
  point: NCTGraphiteVec3;
  tangentU: NCTGraphiteVec3;
  tangentV: NCTGraphiteVec3;
  normal: NCTGraphiteVec3;
}

function clampedUniformKnots(count: number, degree: number): number[] {
  const knots: number[] = [];
  const interior = count - degree - 1;
  for (let i = 0; i <= degree; i++) knots.push(0);
  for (let i = 1; i <= interior; i++) knots.push(i / (interior + 1));
  for (let i = 0; i <= degree; i++) knots.push(1);
  return knots;
}

function findSpan(knots: number[], degree: number, count: number, u: number): number {
  // Piegl & Tiller FindSpan: returns the knot span index i with
  // knots[i] <= u < knots[i + 1]; active control points are
  // i - degree .. i. At the right end the last span is returned.
  const n = count - 1;
  if (u >= knots[n + 1]) return n;
  if (u <= knots[degree]) return degree;
  let lo = degree;
  let hi = n + 1;
  let mid = (lo + hi) >> 1;
  while (u < knots[mid] || u >= knots[mid + 1]) {
    if (u < knots[mid]) hi = mid;
    else lo = mid;
    mid = (lo + hi) >> 1;
  }
  return mid;
}

/** Nonzero basis function values N_{span-degree..span, degree}(u). */
function basisValues(
  knots: number[],
  degree: number,
  span: number,
  u: number,
): number[] {
  const n: number[] = new Array(degree + 1).fill(0);
  const left: number[] = new Array(degree + 1).fill(0);
  const right: number[] = new Array(degree + 1).fill(0);
  n[0] = 1;
  for (let j = 1; j <= degree; j++) {
    left[j] = u - knots[span + 1 - j];
    right[j] = knots[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const denom = right[r + 1] + left[j - r];
      const tmp = denom === 0 ? 0 : n[r] / denom;
      n[r] = saved + right[r + 1] * tmp;
      saved = left[j - r] * tmp;
    }
    n[j] = saved;
  }
  return n;
}

export class NCTGraphiteNurbsSurface {
  readonly controlPoints: NCTGraphiteVec3[][];
  readonly weights: number[][];
  readonly degreeU: number;
  readonly degreeV: number;
  readonly knotsU: number[];
  readonly knotsV: number[];

  constructor(spec: NCTGraphiteNurbsSurfaceSpec) {
    this.controlPoints = spec.controlPoints;
    const rows = spec.controlPoints.length;
    const cols = spec.controlPoints[0].length;
    this.weights =
      spec.weights ??
      Array.from({ length: rows }, () => new Array(cols).fill(1));
    this.degreeU = spec.degreeU ?? Math.min(3, cols - 1);
    this.degreeV = spec.degreeV ?? Math.min(3, rows - 1);
    this.knotsU = spec.knotsU ?? clampedUniformKnots(cols, this.degreeU);
    this.knotsV = spec.knotsV ?? clampedUniformKnots(rows, this.degreeV);
  }

  get countU(): number {
    return this.controlPoints[0].length;
  }

  get countV(): number {
    return this.controlPoints.length;
  }

  /** Surface point at normalized (u, v). iGeo: ISurface.pt(u, v). */
  pointAt(u: number, v: number): NCTGraphiteVec3 {
    return this.evaluate(u, v).point;
  }

  /** Point plus first partials and unit normal at normalized (u, v). */
  frameAt(u: number, v: number): NCTGraphiteSurfaceFrame {
    const { point, du, dv } = this.evaluate(u, v);
    return {
      point,
      tangentU: du,
      tangentV: dv,
      normal: vUnit(vCross(du, dv)),
    };
  }

  /** Weighted sum Σ N_u(i) N_v(j) value[row][col] over the active spans. */
  private blend(
    u: number,
    v: number,
    degreeU: number,
    degreeV: number,
    knotsU: number[],
    knotsV: number[],
    value: (row: number, col: number) => NCTGraphiteVec3,
  ): NCTGraphiteVec3 {
    const countU = knotsU.length - degreeU - 1;
    const countV = knotsV.length - degreeV - 1;
    const spanU = findSpan(knotsU, degreeU, countU, u);
    const spanV = findSpan(knotsV, degreeV, countV, v);
    const bu = basisValues(knotsU, degreeU, spanU, u);
    const bv = basisValues(knotsV, degreeV, spanV, v);
    let acc = vec3();
    for (let j = 0; j <= degreeV; j++) {
      for (let i = 0; i <= degreeU; i++) {
        const b = bu[i] * bv[j];
        if (b === 0) continue;
        acc = vAdd(
          acc,
          vScale(value(spanV - degreeV + j, spanU - degreeU + i), b),
        );
      }
    }
    return acc;
  }

  private evaluate(
    u: number,
    v: number,
  ): { point: NCTGraphiteVec3; du: NCTGraphiteVec3; dv: NCTGraphiteVec3 } {
    const cu = Math.min(1, Math.max(0, u));
    const cv = Math.min(1, Math.max(0, v));
    const wp = (row: number, col: number) =>
      vScale(this.controlPoints[row][col], this.weights[row][col]);
    const ws = (row: number, col: number) =>
      vec3(this.weights[row][col], 0, 0);

    const a = this.blend(cu, cv, this.degreeU, this.degreeV, this.knotsU, this.knotsV, wp);
    const w = this.blend(cu, cv, this.degreeU, this.degreeV, this.knotsU, this.knotsV, ws).x;
    const point = vScale(a, 1 / w);

    // Partial derivatives via differenced control nets (degree p-1,
    // knots with first/last dropped), applied to A and w separately.
    const deriv = (
      alongU: boolean,
    ): { da: NCTGraphiteVec3; dw: number } => {
      const degree = alongU ? this.degreeU : this.degreeV;
      const knots = alongU ? this.knotsU : this.knotsV;
      const count = alongU ? this.countU : this.countV;
      const dKnots = knots.slice(1, -1);
      const factor = (i: number) => {
        const denom = knots[i + degree + 1] - knots[i + 1];
        return denom === 0 ? 0 : degree / denom;
      };
      const dValue =
        (scalar: boolean) =>
        (row: number, col: number): NCTGraphiteVec3 => {
          const i = alongU ? col : row;
          const f = factor(i);
          const get = (r: number, c: number) =>
            scalar ? this.weights[r][c] : this.weights[r][c];
          const p0 = alongU
            ? scalar
              ? vec3(get(row, col), 0, 0)
              : wp(row, col)
            : scalar
              ? vec3(get(row, col), 0, 0)
              : wp(row, col);
          const p1 = alongU
            ? scalar
              ? vec3(get(row, col + 1), 0, 0)
              : wp(row, col + 1)
            : scalar
              ? vec3(get(row + 1, col), 0, 0)
              : wp(row + 1, col);
          return vScale(vSub(p1, p0), f);
        };
      void count;
      const da = alongU
        ? this.blend(cu, cv, degree - 1, this.degreeV, dKnots, this.knotsV, dValue(false))
        : this.blend(cu, cv, this.degreeU, degree - 1, this.knotsU, dKnots, dValue(false));
      const dwv = alongU
        ? this.blend(cu, cv, degree - 1, this.degreeV, dKnots, this.knotsV, dValue(true))
        : this.blend(cu, cv, this.degreeU, degree - 1, this.knotsU, dKnots, dValue(true));
      return { da, dw: dwv.x };
    };

    const duR = deriv(true);
    const dvR = deriv(false);
    const du = vScale(vSub(duR.da, vScale(point, duR.dw)), 1 / w);
    const dv = vScale(vSub(dvR.da, vScale(point, dvR.dw)), 1 / w);
    return { point, du, dv };
  }
}

/**
 * The tutorial's commented-out alternative surface: a flat 200 x 60
 * sheet (bilinear). Kept as a preset because it is the one surface
 * whose definition survives in the tutorial text itself.
 */
export function createFlatSheetSurface(
  width = 200,
  depth = 60,
): NCTGraphiteNurbsSurface {
  return new NCTGraphiteNurbsSurface({
    controlPoints: [
      [vec3(0, 0, 0), vec3(width, 0, 0)],
      [vec3(0, 0, depth), vec3(width, 0, depth)],
    ],
    degreeU: 1,
    degreeV: 1,
  });
}

/**
 * A gently arched sheet of the same 200 x 60 extent, defined in code
 * as a stand-in for the tutorial's srf1.3dm (whose control net is not
 * published). Cubic in u, quadratic in v; the middle rises and rolls
 * so panel normals vary across the field.
 */
export function createDemoSheetSurface(
  archScale = 1,
): NCTGraphiteNurbsSurface {
  const w = 200;
  const d = 60;
  const rowsY = [
    [0, 6, 6, 0],
    [4, 16, 14, 4],
    [0, 4, 4, 0],
  ].map((row) => row.map((y) => y * archScale));
  const net: NCTGraphiteVec3[][] = [];
  for (let j = 0; j < 3; j++) {
    const row: NCTGraphiteVec3[] = [];
    for (let i = 0; i < 4; i++) {
      row.push(vec3((w * i) / 3, rowsY[j][i], (d * j) / 2));
    }
    net.push(row);
  }
  return new NCTGraphiteNurbsSurface({
    controlPoints: net,
    degreeU: 3,
    degreeV: 2,
  });
}
