/**
 * Hiroyuki Sato / Paper.js exact metaball necks, plus the four-corner
 * round-rect stamp that necks into a stadium or circle.
 */

import type { NCTGraphitePoint } from '../../grid/NCTGraphiteGridGeometry.js';

export type StampCenter = { x: number; y: number; r: number };

export type RoundRectStamp = {
  centers: StampCenter[];
  halfW: number;
  halfH: number;
  cornerR: number;
};

export type SatoNeck = {
  a: number;
  b: number;
  r1: number;
  r2: number;
  d: number;
  p1: NCTGraphitePoint;
  p2: NCTGraphitePoint;
  p3: NCTGraphitePoint;
  p4: NCTGraphitePoint;
  h1: NCTGraphitePoint;
  h2: NCTGraphitePoint;
  h3: NCTGraphitePoint;
  h4: NCTGraphitePoint;
  escaped: boolean;
  path: string;
};

const PI = Math.PI;
const HALF_PI = PI / 2;

const dist = (a: NCTGraphitePoint, b: NCTGraphitePoint) => Math.hypot(a.x - b.x, a.y - b.y);
const ang = (to: NCTGraphitePoint, from: NCTGraphitePoint) => Math.atan2(to.y - from.y, to.x - from.x);
const polar = (c: NCTGraphitePoint, a: number, r: number): NCTGraphitePoint => ({
  x: c.x + Math.cos(a) * r,
  y: c.y + Math.sin(a) * r,
});
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Four corner-circle centers that Sato-neck into a rounded-rect silhouette.
 * Fully circular (aspect 1, corner 1) collapses to one center; a stadium
 * (corner 1, elongated) collapses to two.
 */
export function roundRectStamp(cx: number, cy: number, stampR: number, aspect = 1.7, cornerT = 0.55): RoundRectStamp {
  const a = Math.max(0.4, aspect);
  const halfW = stampR * Math.max(1, a);
  const halfH = stampR * Math.max(1, 1 / a);
  const cornerR = clamp(cornerT, 0.2, 1) * Math.min(halfW, halfH);
  const ox = Math.max(0, halfW - cornerR);
  const oy = Math.max(0, halfH - cornerR);
  const corners: StampCenter[] = [
    { x: cx - ox, y: cy - oy, r: cornerR },
    { x: cx + ox, y: cy - oy, r: cornerR },
    { x: cx + ox, y: cy + oy, r: cornerR },
    { x: cx - ox, y: cy + oy, r: cornerR },
  ];
  const raw: StampCenter[] = [...corners];
  const step = cornerR * 1.15;
  for (let e = 0; e < 4; e++) {
    const aC = corners[e], bC = corners[(e + 1) % 4];
    const span = dist(aC, bC);
    if (span < 0.75 || step <= 0) continue;
    const n = Math.max(1, Math.ceil(span / step));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      raw.push({ x: aC.x + (bC.x - aC.x) * t, y: aC.y + (bC.y - aC.y) * t, r: cornerR });
    }
  }
  const centers: StampCenter[] = [];
  for (const p of raw) {
    if (!centers.some((q) => dist(p, q) < 0.75)) centers.push(p);
  }
  return { centers, halfW, halfH, cornerR };
}

function neckPathD(
  p1: NCTGraphitePoint, p2: NCTGraphitePoint, p3: NCTGraphitePoint, p4: NCTGraphitePoint,
  h1: NCTGraphitePoint, h2: NCTGraphitePoint, h3: NCTGraphitePoint, h4: NCTGraphitePoint,
  escaped: boolean, r2: number,
) {
  return `M ${p1.x} ${p1.y} C ${h1.x} ${h1.y} ${h3.x} ${h3.y} ${p3.x} ${p3.y} A ${r2} ${r2} 0 ${escaped ? 1 : 0} 0 ${p4.x} ${p4.y} C ${h4.x} ${h4.y} ${h2.x} ${h2.y} ${p2.x} ${p2.y} Z`;
}

/**
 * Paper.js / Hiroyuki Sato exact metaball neck. Returns null when the pair is
 * too far (d > r1 + r2·K), concentric, or one circle contains the other.
 */
export function satoNeck(
  r1: number,
  r2: number,
  c1: NCTGraphitePoint,
  c2: NCTGraphitePoint,
  handleSize = 2.4,
  v = 0.5,
  k = 2.5,
): SatoNeck | null {
  if (r1 === 0 || r2 === 0) return null;
  const d = dist(c1, c2);
  if (d > r1 + r2 * k) return null;
  if (d <= Math.abs(r1 - r2)) return null;
  if (d < 0.0001) return null;
  let u1: number, u2: number;
  if (d < r1 + r2) {
    u1 = Math.acos(clamp((r1 * r1 + d * d - r2 * r2) / (2 * r1 * d), -1, 1));
    u2 = Math.acos(clamp((r2 * r2 + d * d - r1 * r1) / (2 * r2 * d), -1, 1));
  } else {
    u1 = 0;
    u2 = 0;
  }
  const theta = ang(c2, c1);
  const maxSpread = Math.acos(clamp((r1 - r2) / d, -1, 1));
  const a1 = theta + u1 + (maxSpread - u1) * v;
  const a2 = theta - u1 - (maxSpread - u1) * v;
  const a3 = theta + PI - u2 - (PI - u2 - maxSpread) * v;
  const a4 = theta - PI + u2 + (PI - u2 - maxSpread) * v;
  const p1 = polar(c1, a1, r1);
  const p2 = polar(c1, a2, r1);
  const p3 = polar(c2, a3, r2);
  const p4 = polar(c2, a4, r2);
  const total = r1 + r2;
  const d2 = Math.min(v * handleSize, dist(p1, p3) / total) * Math.min(1, (d * 2) / total);
  const h1 = polar(p1, a1 - HALF_PI, r1 * d2);
  const h2 = polar(p2, a2 + HALF_PI, r1 * d2);
  const h3 = polar(p3, a3 + HALF_PI, r2 * d2);
  const h4 = polar(p4, a4 - HALF_PI, r2 * d2);
  const escaped = d > r1;
  return {
    a: -1, b: -1, r1, r2, d, p1, p2, p3, p4, h1, h2, h3, h4, escaped,
    path: neckPathD(p1, p2, p3, p4, h1, h2, h3, h4, escaped, r2),
  };
}
