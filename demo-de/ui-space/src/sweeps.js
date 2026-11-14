/**
 * sweeps.js — SWEEPS for the UI Space, pure (no three.js): a 2D
 * contour carried along a 3D path, the cross-section free to scale,
 * rotate and shear at every path vertex. Ported from the operation
 * at the heart of Linas Vepstas's GLE Tubing and Extrusion Library
 * (1991): gleExtrusion / glePolyCylinder and friends. GLE's JOIN
 * STYLES for path corners (its miter / round / bevel geometry) are
 * the part NOT ported — a sweep here rounds a corner only as finely
 * as the caller's path samples it.
 *
 * THE OPERATION (sweep): `contour` is a polyline in its own 2D
 * plane, [[x, y], …]. It is NOT implicitly closed: to sweep a tube,
 * repeat the first point at the end (circleContour does this for
 * you). `path` is a polyline in 3D, [[x, y, z], …]. At each path
 * point the contour is placed in the plane perpendicular to the
 * path, oriented by a PARALLEL-TRANSPORT frame (below), then the
 * point's SECTION affine is applied to the 2D contour, in this
 * documented order: rotate (radians, in the contour plane) →
 * scale (a number, or [sx, sy]) → translate ([tx, ty]). This is
 * GLE's per-vertex 2×3 affine in friendlier dress: scale a circle
 * section-by-section and a cylinder becomes any taper; rotate it
 * and the tube twists like a drill bit; translate it and the tube
 * shears. Quads join consecutive rings; vertex order is RING-MAJOR
 * (ring 0's contour points, then ring 1's, …).
 *
 * FRAMES (parallelTransportFrames): each path point gets
 * { tangent, normal, binormal }, right-handed (normal × binormal =
 * tangent). The first normal is the world axis least aligned with
 * the first tangent, orthogonalised. Each later frame is the
 * previous one ROTATED BY THE SMALLEST ROTATION taking tangent[i-1]
 * to tangent[i] (Rodrigues' formula) — the contour is carried by
 * "Gaussian translation", never spun by the path's own torsion, so
 * a sweep cannot suffer the Frenet frame's flip at an inflection.
 * Degenerate steps (a zero-length segment) keep the previous
 * tangent; near-antiparallel consecutive tangents fall back to a
 * half-turn about the previous binormal. For a CLOSED path the
 * transported frame generally returns twisted by the loop's
 * holonomy; that residual cannot be removed (it is the path's own
 * total twist), but it can be SPREAD: each frame is twisted by
 * residual·i/N about its own tangent, so every step of the field —
 * the seam step included — carries the same residual/N of twist
 * relative to raw transport, the field is single-valued on the
 * loop, and a closed sweep's seam is invisible.
 *
 * OUTPUT (sweep): { positions, normals, uvs, colors, indices } —
 * flat arrays, ring-major. uvs: u is the path parameter (open:
 * cumulative chord length / total; closed: i/N), v is the contour
 * parameter j/(C−1). A CLOSED sweep emits one extra SEAM RING
 * duplicating ring 0 with u = 1 (positions, frame and section taken
 * from ring 0), so uv.x interpolates honestly across the join
 * instead of wrapping through the whole range inside one quad band.
 * colors is null unless some section carries a color: [r, g, b]
 * per ring, rings without one interpolating between the nearest
 * rings that have one (cyclically, for closed paths).
 *
 * NORMALS: when `contourNormals` are given (circleContourNormals
 * matches circleContour), each is rotated by the section's rotation
 * and carried by the frame — exact for uniform scale; NON-UNIFORM
 * scale normals are approximate (the inverse-transpose is not
 * applied; GLE's lighting has the same caveat in spirit). Without
 * contour normals, smooth normals are accumulated from the surface
 * itself (a contour's repeated seam point then keeps a faint seam
 * in the normals — pass contour normals for a seamless tube, as
 * tubeAlong does).
 *
 * CAPS: with caps=true on an OPEN path, a centre vertex + triangle
 * fan is added at each end, the centre vertices carrying axial
 * normals (−tangent at the start, +tangent at the end). Caps are
 * meaningless on a closed path and are ignored there.
 */

// ------------------------------------------------- vector helpers --
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a) => {
  const l = vlen(a);
  return l > 0 ? vscale(a, 1 / l) : [0, 0, 0];
};

/** Rodrigues' rotation of v about the UNIT axis k by `angle`. */
function rotateAbout(v, k, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const kv = vcross(k, v);
  const kd = vdot(k, v) * (1 - c);
  return [
    v[0] * c + kv[0] * s + k[0] * kd,
    v[1] * c + kv[1] * s + k[1] * kd,
    v[2] * c + kv[2] * s + k[2] * kd,
  ];
}

/** Signed angle from a to b about the unit axis k (right-hand rule). */
function signedAngle(a, b, k) {
  return Math.atan2(vdot(vcross(a, b), k), vdot(a, b));
}

const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** A unit vector perpendicular to the unit vector t: the world axis
 *  least aligned with t, orthogonalised — never near-degenerate,
 *  since the least-aligned axis has |dot| ≤ 1/√3. */
function anyPerp(t) {
  let best = AXES[0], bestD = Infinity;
  for (const a of AXES) {
    const d = Math.abs(vdot(a, t));
    if (d < bestD) { bestD = d; best = a; }
  }
  return vnorm(vsub(best, vscale(t, vdot(best, t))));
}

/**
 * Carry `normal` from tangent t0 to tangent t1 by the smallest
 * rotation taking t0 to t1. Antiparallel tangents have no smallest
 * rotation; the fallback is a half-turn about the previous
 * binormal, which keeps the frame right-handed and untwisted in
 * the only sense a hairpin allows.
 */
function transportNormal(normal, binormal, t0, t1) {
  const axis = vcross(t0, t1);
  const s = vlen(axis);
  const c = vdot(t0, t1);
  if (s < 1e-12) {
    if (c > 0) return normal; // same direction: nothing to do
    // half-turn about the binormal: n → −n (b·n = 0), b unchanged
    return vscale(normal, -1);
  }
  return rotateAbout(normal, vscale(axis, 1 / s), Math.atan2(s, c));
}

// -------------------------------------------------------- frames --
/**
 * parallelTransportFrames(points, { closed }) → one
 * { tangent, normal, binormal } per point, as documented above.
 * Throws on fewer than two points (a programming error, not data).
 */
export function parallelTransportFrames(points, { closed = false } = {}) {
  const n = points.length;
  if (n < 2) throw new Error("parallelTransportFrames needs at least two points");

  // Tangents: central differences (cyclic when closed), one-sided
  // at the open ends. A zero difference leaves the slot empty; the
  // fill pass below borrows the nearest real direction, so a
  // duplicated point cannot NaN the whole sweep.
  const tangents = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    let d;
    if (closed) d = vsub(points[(i + 1) % n], points[(i - 1 + n) % n]);
    else if (i === 0) d = vsub(points[1], points[0]);
    else if (i === n - 1) d = vsub(points[n - 1], points[n - 2]);
    else d = vsub(points[i + 1], points[i - 1]);
    if (vlen(d) > 1e-14) tangents[i] = vnorm(d);
  }
  const firstGood = tangents.findIndex(Boolean);
  if (firstGood < 0) {
    // The whole path is one repeated point: any frame will do.
    return points.map(() => ({ tangent: [0, 0, 1], normal: [1, 0, 0], binormal: [0, 1, 0] }));
  }
  let prev = tangents[firstGood];
  for (let k = 1; k < n; k++) {
    const i = (firstGood + k) % n;
    if (tangents[i]) prev = tangents[i];
    else tangents[i] = prev;
  }

  const frames = new Array(n);
  let normal = anyPerp(tangents[0]);
  frames[0] = { tangent: tangents[0], normal, binormal: vcross(tangents[0], normal) };
  for (let i = 1; i < n; i++) {
    normal = transportNormal(normal, frames[i - 1].binormal, tangents[i - 1], tangents[i]);
    frames[i] = { tangent: tangents[i], normal, binormal: vcross(tangents[i], normal) };
  }

  if (closed) {
    // Transport the last frame's normal across the seam and measure
    // the residual twist against ring 0's normal; then spread it:
    // frame i is twisted by residual·i/N about its tangent. The
    // sign is set by closure — with it, the twist measured across
    // the seam step equals the twist at every other step
    // (residual/N); with the opposite sign the seam step would
    // carry the whole residual twice over.
    const seam = transportNormal(normal, frames[n - 1].binormal, tangents[n - 1], tangents[0]);
    const residual = signedAngle(seam, frames[0].normal, tangents[0]);
    if (Math.abs(residual) > 1e-14) {
      for (let i = 1; i < n; i++) {
        const f = frames[i];
        const nn = rotateAbout(f.normal, f.tangent, (residual * i) / n);
        frames[i] = { tangent: f.tangent, normal: nn, binormal: vcross(f.tangent, nn) };
      }
    }
  }
  return frames;
}

// ------------------------------------------------------ contours --
/**
 * A circle as a sweep-ready contour: n segments, n+1 points, the
 * last repeating the first — a closed ring, per the sweep contract.
 */
export function circleContour(n, r = 1) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** The radial unit normals matching circleContour(n), point for point. */
export function circleContourNormals(n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  return pts;
}

// --------------------------------------------------------- sweep --
const IDENTITY_SECTION = { scale: 1, rotate: 0, translate: [0, 0], color: null };

function sectionAt(sections, i) {
  if (!sections || !sections[i]) return IDENTITY_SECTION;
  const s = sections[i];
  return {
    scale: s.scale ?? 1,
    rotate: s.rotate ?? 0,
    translate: s.translate ?? [0, 0],
    color: s.color ?? null,
  };
}

/** Rotate → scale → translate, in the contour plane (documented order). */
function applySection(p, s) {
  let [x, y] = p;
  if (s.rotate) {
    const c = Math.cos(s.rotate), sn = Math.sin(s.rotate);
    const rx = x * c - y * sn;
    y = x * sn + y * c;
    x = rx;
  }
  if (Array.isArray(s.scale)) { x *= s.scale[0]; y *= s.scale[1]; }
  else { x *= s.scale; y *= s.scale; }
  return [x + s.translate[0], y + s.translate[1]];
}

function rotate2(p, angle) {
  if (!angle) return p;
  const c = Math.cos(angle), s = Math.sin(angle);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Per-ring colours: a ring with no colour of its own interpolates
 *  between the nearest rings that carry one (cyclic when closed,
 *  clamped to the nearest end when open). */
function resolveRingColors(sections, count, closed) {
  const own = [];
  for (let i = 0; i < count; i++) own.push(sectionAt(sections, i).color);
  if (!own.some(Boolean)) return null;
  const defined = own.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  const out = new Array(count);
  for (let i = 0; i < count; i++) {
    if (own[i]) { out[i] = own[i]; continue; }
    let lo = null, hi = null, loD = Infinity, hiD = Infinity;
    for (const d of defined) {
      const back = closed ? (i - d + count) % count : i - d;
      const fwd = closed ? (d - i + count) % count : d - i;
      if (back >= 0 && back < loD) { loD = back; lo = d; }
      if (fwd >= 0 && fwd < hiD) { hiD = fwd; hi = d; }
    }
    if (lo == null) out[i] = own[hi];
    else if (hi == null || loD + hiD === 0) out[i] = own[lo];
    else {
      const t = loD / (loD + hiD);
      const a = own[lo], b = own[hi];
      out[i] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
  }
  return out;
}

/**
 * sweep({ contour, contourNormals?, path, frames?, sections?,
 * caps?, closed? }) → { positions, normals, uvs, colors, indices }.
 * See the module header for the full contract.
 */
export function sweep({
  contour,
  contourNormals = null,
  path,
  frames = null,
  sections = null,
  caps = false,
  closed = false,
} = {}) {
  const N = path.length;
  const C = contour.length;
  if (N < 2) throw new Error("sweep needs a path of at least two points");
  if (C < 2) throw new Error("sweep needs a contour of at least two points");
  if (sections && sections.length !== N) {
    throw new Error("sweep sections must match the path length");
  }
  const fr = frames || parallelTransportFrames(path, { closed });

  // u along the path: cumulative chord / total (open) or i/N (closed).
  const us = new Array(N);
  if (closed) {
    for (let i = 0; i < N; i++) us[i] = i / N;
  } else {
    let total = 0;
    const cum = [0];
    for (let i = 1; i < N; i++) { total += vlen(vsub(path[i], path[i - 1])); cum.push(total); }
    for (let i = 0; i < N; i++) us[i] = total > 0 ? cum[i] / total : 0;
  }

  const ringColors = resolveRingColors(sections, N, closed);
  const rings = closed ? N + 1 : N; // +1: the seam ring (see header)
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = ringColors ? [] : null;

  for (let r = 0; r < rings; r++) {
    const i = closed ? r % N : r;
    const f = fr[i];
    const s = sectionAt(sections, i);
    const origin = path[i];
    const u = closed ? r / N : us[i];
    for (let j = 0; j < C; j++) {
      const [px, py] = applySection(contour[j], s);
      positions.push(
        origin[0] + f.normal[0] * px + f.binormal[0] * py,
        origin[1] + f.normal[1] * px + f.binormal[1] * py,
        origin[2] + f.normal[2] * px + f.binormal[2] * py,
      );
      if (contourNormals) {
        const [nx, ny] = rotate2(contourNormals[j], s.rotate);
        const wn = vnorm([
          f.normal[0] * nx + f.binormal[0] * ny,
          f.normal[1] * nx + f.binormal[1] * ny,
          f.normal[2] * nx + f.binormal[2] * ny,
        ]);
        normals.push(wn[0], wn[1], wn[2]);
      }
      uvs.push(u, C > 1 ? j / (C - 1) : 0);
      if (colors) {
        const c = ringColors[i];
        colors.push(c[0], c[1], c[2]);
      }
    }
  }

  const indices = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let j = 0; j < C - 1; j++) {
      const a = r * C + j;
      const b = (r + 1) * C + j;
      const c = a + 1;
      const d = b + 1;
      indices.push(a, c, b, c, d, b);
    }
  }

  // Caps: a centre vertex + fan at each end of an OPEN path. The
  // centre vertices carry axial normals: written directly when
  // contour normals are in use; under computed normals the fans'
  // own accumulation gives them the same direction by symmetry.
  if (caps && !closed) {
    const capStart = positions.length / 3;
    positions.push(path[0][0], path[0][1], path[0][2]);
    if (contourNormals) normals.push(-fr[0].tangent[0], -fr[0].tangent[1], -fr[0].tangent[2]);
    uvs.push(0, 0.5);
    if (colors) { const c = ringColors[0]; colors.push(c[0], c[1], c[2]); }
    for (let j = 0; j < C - 1; j++) indices.push(capStart, j + 1, j);

    const capEnd = positions.length / 3;
    const last = path[N - 1];
    positions.push(last[0], last[1], last[2]);
    if (contourNormals) {
      const t = fr[N - 1].tangent;
      normals.push(t[0], t[1], t[2]);
    }
    uvs.push(1, 0.5);
    if (colors) { const c = ringColors[N - 1]; colors.push(c[0], c[1], c[2]); }
    const base = (rings - 1) * C;
    for (let j = 0; j < C - 1; j++) indices.push(capEnd, base + j, base + j + 1);
  }

  if (!contourNormals) {
    // Smooth normals from the surface itself: accumulate each
    // triangle's (unnormalised) face normal at its vertices.
    const acc = new Float64Array(positions.length);
    for (let k = 0; k < indices.length; k += 3) {
      const ia = indices[k] * 3, ib = indices[k + 1] * 3, ic = indices[k + 2] * 3;
      const ab = [
        positions[ib] - positions[ia], positions[ib + 1] - positions[ia + 1], positions[ib + 2] - positions[ia + 2],
      ];
      const ac = [
        positions[ic] - positions[ia], positions[ic + 1] - positions[ia + 1], positions[ic + 2] - positions[ia + 2],
      ];
      const fn = vcross(ab, ac);
      for (const ii of [ia, ib, ic]) {
        acc[ii] += fn[0]; acc[ii + 1] += fn[1]; acc[ii + 2] += fn[2];
      }
    }
    for (let v = 0; v < positions.length; v += 3) {
      const l = Math.hypot(acc[v], acc[v + 1], acc[v + 2]);
      if (l > 1e-14) normals.push(acc[v] / l, acc[v + 1] / l, acc[v + 2] / l);
      else normals.push(0, 1, 0);
    }
  }

  return { positions, normals, uvs, colors, indices };
}

// ----------------------------------------------------- tubeAlong --
/**
 * tubeAlong(points, radiusAt, { radialSegments, closed, colorAt,
 * caps }) — the convenience every current use needs: a circular
 * tube along a path. radiusAt is a number, an array per point, or
 * a function (t, i) → radius, where t is the path parameter (i/N
 * closed, i/(N−1) open). colorAt, when given, is (t, i) → [r,g,b].
 * Built on sweep + circleContour, with true radial normals.
 */
export function tubeAlong(points, radiusAt, {
  radialSegments = 12,
  closed = false,
  colorAt = null,
  caps = false,
} = {}) {
  const N = points.length;
  const contour = circleContour(radialSegments, 1);
  const contourNormals = circleContourNormals(radialSegments);
  const sections = points.map((_, i) => {
    const t = closed ? i / N : i / (N - 1);
    const s = {
      scale: typeof radiusAt === "function" ? radiusAt(t, i)
        : Array.isArray(radiusAt) ? radiusAt[i]
        : radiusAt,
    };
    if (colorAt) s.color = colorAt(t, i);
    return s;
  });
  return sweep({ contour, contourNormals, path: points, sections, caps, closed });
}

// ---------------------------------------------------- utilities --
/**
 * A helix as a path: `samples` points, `turns` revolutions, rising
 * `height` (centred on y=0) at the given radius, y-up. A few lines,
 * kept because a contour swept along it is GLE's signature figure
 * (the generalized torus / drill) and the lab will want one.
 */
export function helixPath({ turns = 3, height = 10, radius = 4, samples = 128 } = {}) {
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const s = i / (samples - 1);
    const a = s * turns * Math.PI * 2;
    pts.push([Math.cos(a) * radius, (s - 0.5) * height, Math.sin(a) * radius]);
  }
  return pts;
}
