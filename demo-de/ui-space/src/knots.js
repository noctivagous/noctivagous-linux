/**
 * UI Space — the knot lib: torus-knot curves and the DATA KNOT.
 *
 * Two roles for knots in this environment. ATMOSPHERE: parametric
 * knot sculptures for the futuristic feel. CONVENTION: a knot can
 * be a way of holding data — its arc is divided into PARTS, each
 * part contains a datum, and you zoom INTO a part to read what it
 * holds. This module is the pure mathematics of both: no three.js,
 * no React, no DOM, so it can be exercised headless.
 *
 * The curve family is the torus-knot family of Lee Stemkoski's
 * "Parameterized Knots" gallery (home.adelphi.edu/~stemkoski/
 * knotgallery): a (p, q) torus knot winds p times around the axis
 * of a torus while winding q times through its hole. We write our
 * own curve code from the standard parametrization:
 *
 *   r(t) = 2 + cos(q·t)
 *   x(t) = r(t)·cos(p·t),  y(t) = r(t)·sin(p·t),  z(t) = sin(q·t)
 *
 * for t in [0, 2π). The curve is closed by construction (every
 * term is periodic with the period dividing 2π when p and q are
 * integers). Points are returned in mathematical axes — x and y in
 * the torus's plane, z along its axis; the view maps them to
 * three.js's y-up world.
 */

/**
 * One point on a (p, q) torus knot at parameter t.
 * Returns [x, y, z] with |x|, |y| ≤ 3 and |z| ≤ 1.
 */
export function torusKnotPoint(p, q, t) {
  const r = 2 + Math.cos(q * t);
  return [r * Math.cos(p * t), r * Math.sin(p * t), Math.sin(q * t)];
}

/**
 * The gallery's three forms. A trefoil IS the (2, 3) torus knot;
 * the cinquefoil is (5, 2); the gallery's second figure is the
 * (4, 3), listed here in the gallery's own (p, q) order.
 */
export const KNOT_FORMS = {
  trefoil: { id: "trefoil", name: "Trefoil", p: 2, q: 3 },
  torus43: { id: "torus43", name: "(4, 3) torus knot", p: 4, q: 3 },
  cinquefoil: { id: "cinquefoil", name: "Cinquefoil", p: 5, q: 2 },
};

/* ---------------- the data knot's dataset ---------------- */

/**
 * The data knot is a trefoil whose eight equal arcs are PARTS,
 * each holding one datum of a small systems picture. `value` is
 * the size of what the part holds — it drives the tube's radius
 * (radiusFor), so a part's share of the whole reads in its girth.
 * Values are distinct, so the parts' radii are distinct too.
 */
export const KNOT_PARTS = [
  { id: "ingress", name: "ingress", value: 84, hue: 187 },
  { id: "cache", name: "cache", value: 47, hue: 212 },
  { id: "render", name: "render", value: 91, hue: 265 },
  { id: "index", name: "index", value: 73, hue: 150 },
  { id: "queue", name: "queue", value: 35, hue: 28 },
  { id: "store", name: "store", value: 58, hue: 320 },
  { id: "sync", name: "sync", value: 26, hue: 95 },
  { id: "egress", name: "egress", value: 62, hue: 200 },
];

export const KNOT_TOTAL = KNOT_PARTS.reduce((s, p) => s + p.value, 0);

export function partById(id) {
  return KNOT_PARTS.find((p) => p.id === id) || null;
}

export function partIndex(partOrId) {
  if (typeof partOrId === "number") {
    return partOrId >= 0 && partOrId < KNOT_PARTS.length ? partOrId : -1;
  }
  return KNOT_PARTS.findIndex((p) => p.id === (partOrId?.id || partOrId));
}

/**
 * The arc of part i: the parts partition [0, 2π) into eight equal
 * arcs, in order — part i owns [i·π/4, (i+1)·π/4). No gaps, no
 * overlaps; part 7's arc ends exactly where part 0's begins.
 */
export function partArc(i) {
  const step = (Math.PI * 2) / KNOT_PARTS.length;
  return [i * step, (i + 1) * step];
}

export function partArcFor(partOrId) {
  const i = partIndex(partOrId);
  return i >= 0 ? partArc(i) : null;
}

/** The parameter at a part's arc midpoint — where its core sits. */
export function partMidT(partOrId) {
  const arc = partArcFor(partOrId);
  return arc ? (arc[0] + arc[1]) / 2 : null;
}

/** A part's point at its arc midpoint, on a given form. */
export function partMidpoint(form, partOrId) {
  const t = partMidT(partOrId);
  return t == null ? null : torusKnotPoint(form.p, form.q, t);
}

/** A part's share of everything the knot holds, 0..1. */
export function partShare(partOrId) {
  const part = partById(partOrId?.id || partOrId);
  return part ? part.value / KNOT_TOTAL : 0;
}

/* ---------------- value → tube radius ---------------- */

/**
 * radiusFor maps a part's value to its tube radius. The value
 * domain is [0, 100]; the radius band is [0.95, 2.15] (in the
 * view's units, where the knot's disc radius is ~18) — thick
 * enough to read as a tube at miniature scale, thin enough that
 * neighbouring parts never swallow each other. The map is linear,
 * hence strictly monotonic: a bigger value is always a thicker
 * part, and the parts' ranking by eye is their ranking by value.
 */
export const RADIUS_BAND = [0.95, 2.15];
export const VALUE_DOMAIN = [0, 100];

export function radiusFor(value) {
  const [v0, v1] = VALUE_DOMAIN;
  const [r0, r1] = RADIUS_BAND;
  const v = Math.max(v0, Math.min(v1, Number(value) || 0));
  return r0 + ((v - v0) / (v1 - v0)) * (r1 - r0);
}
