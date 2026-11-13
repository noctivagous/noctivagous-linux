/**
 * Minimal immutable 3D vector helpers for the panelization module.
 *
 * iGeo's IVec is a mutable fluent vector; this port keeps the same
 * operations as pure functions on plain { x, y, z } records so the
 * geometry core stays framework-free and serializable, in the style of
 * the grid geometry module.
 */

export interface NCTGraphiteVec3 {
  x: number;
  y: number;
  z: number;
}

export function vec3(x = 0, y = 0, z = 0): NCTGraphiteVec3 {
  return { x, y, z };
}

export function vAdd(a: NCTGraphiteVec3, b: NCTGraphiteVec3): NCTGraphiteVec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vSub(a: NCTGraphiteVec3, b: NCTGraphiteVec3): NCTGraphiteVec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vScale(a: NCTGraphiteVec3, s: number): NCTGraphiteVec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function vMid(a: NCTGraphiteVec3, b: NCTGraphiteVec3): NCTGraphiteVec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function vDot(a: NCTGraphiteVec3, b: NCTGraphiteVec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vCross(a: NCTGraphiteVec3, b: NCTGraphiteVec3): NCTGraphiteVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vLen(a: NCTGraphiteVec3): number {
  return Math.sqrt(vDot(a, a));
}

export function vDist(a: NCTGraphiteVec3, b: NCTGraphiteVec3): number {
  return vLen(vSub(a, b));
}

export function vUnit(a: NCTGraphiteVec3): NCTGraphiteVec3 {
  const l = vLen(a);
  return l === 0 ? vec3() : vScale(a, 1 / l);
}

/** Returns `a` rescaled to length `len` (iGeo's `len(double)` setter). */
export function vWithLen(a: NCTGraphiteVec3, len: number): NCTGraphiteVec3 {
  const l = vLen(a);
  return l === 0 ? vec3() : vScale(a, len / l);
}
