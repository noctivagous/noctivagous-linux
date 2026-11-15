import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION, ADDITION } from "three-bvh-csg";
import { PLATTER_R } from "./space-state.js";

/**
 * THE PLATTER'S SLAB, CUT WITH THE CITIZENS' SOCKETS.
 *
 * The drum is a watertight solid — the same tapered frustum
 * the View always drew (top r PLATTER_R at y −0.05, bottom
 * r PLATTER_R + 7 at y −3.05) — minus one cylinder per citizen
 * socket (space-state.js's socketCircles: plot centre + the
 * protective sphere's cross-section radius). The subtraction
 * is CSG (three-bvh-csg) because the sockets overlap — each
 * other in every layout, the centre dais's footprint in two —
 * so no flat Shape-with-holes can carry them; the solid takes
 * any overlap, including a socket dragged past the rim, where
 * the hole simply breaks through the drum's side.
 *
 * Each cutter is a closed cylinder extended 1 unit past the
 * slab's top and bottom, so no cutter face is coplanar with a
 * slab face. The evaluation runs ONCE per positions change
 * (the View memoises on the positions map — a layout switch, a
 * drag drop), never per frame; the result is a single-material
 * geometry (useGroups off), so the slab keeps the one finish
 * it always had, top, side and socket walls alike.
 *
 * HOW THE CUT IS STAGED — three measured facts, each found by
 * ray-scanning built solids over thousands of points (the
 * three layouts plus scattered drag configurations):
 *
 * 1. THE BASE IS A POLAR GRID, not a cylinder primitive. A
 *    cylinder's caps are fans of long thin triangles running
 *    centre to rim, and a cutter boundary crossing them can
 *    make the evaluator misclassify a whole fan sector
 *    (the districts tangle cut silently ate a patch of top).
 *    The grid's triangles are small and bounded in aspect
 *    everywhere, so no cutter gets long triangles to trip on.
 *    The rim line the View draws over the edge carries the
 *    true circle regardless.
 * 2. THE CUTTERS ARE UNIONED FIRST, then subtracted in ONE
 *    operation. Chained subtraction re-splits the base at
 *    every step, and where several cutter boundaries cross —
 *    a cluster of citizens around the centre — a patch of top
 *    can be misclassified away. One union, one subtraction:
 *    the base is split exactly once, against a clean solid.
 * 3. EVERY CUTTER IS ROTATED HALF A SEGMENT (π/36) about its
 *    own axis before the union. The solid is unchanged — a
 *    cylinder is rotationally symmetric — but its tessellation
 *    seams move off the azimuths the other cutters and the
 *    base grid share; unrotated, the ring layout lost a sliver
 *    of top beside the tangle's hole. With the phase, every
 *    scanned configuration is exact.
 *
 * The evaluator carries position + normal only (the slab's one
 * material maps nothing, so uv would be dead weight through
 * every split). Cost, measured: the full build — union plus
 * subtraction — runs ~0.5–0.9 s on the heaviest configurations
 * in node, once per positions change.
 */
export const PLATTER_SLAB = {
  topY: -0.05,
  centreY: -1.55,
  height: 3,
  topR: PLATTER_R,
  bottomR: PLATTER_R + 7,
};

const BASE_SECTORS = 72;
const BASE_RINGS = 12;
const CUTTER_SEGMENTS = 36;
/** Half a cutter segment: the tessellation phase (fact 3). */
const CUTTER_PHASE = Math.PI / CUTTER_SEGMENTS;

/**
 * The slab as a watertight polar-grid solid: two grid caps
 * (centre vertex, BASE_RINGS rings of BASE_SECTORS) and a side
 * wall on its own rim vertices, so the cap/wall edges stay
 * crisp under computeVertexNormals. Winding: caps face out
 * (top up, bottom down), the wall faces outward.
 */
function polarSlabGeometry() {
  const S = BASE_SECTORS;
  const positions = [];
  const indices = [];
  const vert = (x, y, z) => {
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  };
  const cap = (radius, y, flip) => {
    const centre = vert(0, y, 0);
    const rings = [];
    for (let k = 1; k <= BASE_RINGS; k++) {
      const r = (radius * k) / BASE_RINGS;
      const ring = [];
      for (let i = 0; i < S; i++) {
        const a = (i / S) * Math.PI * 2;
        ring.push(vert(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      rings.push(ring);
    }
    const tri = (a, b, c) => {
      if (flip) indices.push(a, c, b);
      else indices.push(a, b, c);
    };
    for (let i = 0; i < S; i++) tri(centre, rings[0][i], rings[0][(i + 1) % S]);
    for (let k = 0; k < BASE_RINGS - 1; k++) {
      for (let i = 0; i < S; i++) {
        const j = (i + 1) % S;
        tri(rings[k][i], rings[k + 1][i], rings[k + 1][j]);
        tri(rings[k][i], rings[k + 1][j], rings[k][j]);
      }
    }
  };
  cap(PLATTER_SLAB.topR, PLATTER_SLAB.topY, true);
  cap(PLATTER_SLAB.bottomR, PLATTER_SLAB.topY - PLATTER_SLAB.height, false);
  const wallTop = [];
  const wallBottom = [];
  for (let i = 0; i < S; i++) {
    const a = (i / S) * Math.PI * 2;
    wallTop.push(vert(Math.cos(a) * PLATTER_SLAB.topR, PLATTER_SLAB.topY, Math.sin(a) * PLATTER_SLAB.topR));
    wallBottom.push(vert(
      Math.cos(a) * PLATTER_SLAB.bottomR, PLATTER_SLAB.topY - PLATTER_SLAB.height,
      Math.sin(a) * PLATTER_SLAB.bottomR,
    ));
  }
  for (let i = 0; i < S; i++) {
    const j = (i + 1) % S;
    indices.push(wallTop[i], wallBottom[j], wallBottom[i]);
    indices.push(wallTop[i], wallTop[j], wallBottom[j]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildPlatterSolid(circles) {
  const base = polarSlabGeometry();
  if (!circles || !circles.length) return base;
  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  evaluator.attributes = ["position", "normal"];
  // The cutters, unioned into one solid (fact 2), each rotated
  // by the tessellation phase (fact 3). The grid geometry is
  // built in place (its y values are the slab's own), so the
  // base brush stands at the origin; the cutters, centred
  // primitives, take their plots and the slab's centre height.
  let cutterAll = null;
  for (const c of circles) {
    const geo = new THREE.CylinderGeometry(c.r, c.r, PLATTER_SLAB.height + 2, CUTTER_SEGMENTS);
    geo.rotateY(CUTTER_PHASE);
    const cutter = new Brush(geo);
    cutter.position.set(c.x, PLATTER_SLAB.centreY, c.z);
    cutter.updateMatrixWorld();
    if (!cutterAll) {
      cutterAll = cutter;
    } else {
      const next = evaluator.evaluate(cutterAll, cutter, ADDITION);
      cutterAll.geometry.dispose();
      cutter.geometry.dispose();
      cutterAll = next;
    }
    cutterAll.updateMatrixWorld();
  }
  const baseBrush = new Brush(base);
  baseBrush.updateMatrixWorld();
  const result = evaluator.evaluate(baseBrush, cutterAll, SUBTRACTION);
  baseBrush.geometry.dispose();
  cutterAll.geometry.dispose();
  return result.geometry;
}
