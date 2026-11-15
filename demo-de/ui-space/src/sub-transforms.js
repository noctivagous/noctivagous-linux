/**
 * UI Space — the SUB-NODE TRANSFORM store (slice 13-5, item 3).
 *
 * Slice 11's scale doctrine said magnification ≠ revelation, and
 * the transform keys have always landed on whole citizens. This
 * store gives the keys a finer address: when a sub-node is
 * hovered on the CURRENT citizen, Z/X and Q/W/E/R/T/Y/B/N apply
 * to THAT SUB-NODE's own transform — its rotation about its own
 * centre/anchor in the citizen's local frame, B/N its in-plane
 * spin about its own plane normal, Z/X its scale about its
 * anchor — held here, per (citizen, subId), in the citizen
 * transform's own shape ({ yaw, pitch, roll, spin, scale },
 * degrees and a ratio, stepped by space-state.js's rules).
 *
 * Pure — no React, no three.js, no DOM — in the subnode-marks.js
 * mould: SpaceApp holds one store in state, the key handlers step
 * it through applySubTransformOp, H resets through
 * resetSubTransform (the same hierarchy: a hovered sub-node's
 * transform resets before its citizen's), and SpaceView applies
 * the records per form family where the form has per-node
 * geometry: the sunbursts' wedges, the tray's plates and cuboids,
 * the tangle's figures (instanced — the instance matrix is
 * composed about the figure's own position), the tree's branches
 * (instanced likewise, about the branch's bounding-sphere
 * centre), the book's leaves and bands, the devices' shelf forms,
 * and the mail's folder compartments.
 *
 * THE KNOT IS EXCLUDED, honestly: its parts are one continuous
 * GLE sweep with no per-part geometry — a part has no mesh of
 * its own to turn, and transforming it would mean re-sweeping
 * the tube with a bent spine. So the knot's parts never resolve
 * as sub-transform targets (resolveSubTransformTarget ignores
 * the part-hover channel) and the keys keep landing on the knot
 * citizen itself, as they always have. The devices' host tokens
 * are excluded the same practical way: they stand on the ring,
 * not in the citizen's group, and their form is the ring token.
 * Citizens without sub-node providers are unaffected — no hover
 * channel exists for them, so nothing ever resolves.
 *
 * Node ids are the providers' TRUE-ROOT path ids (subnodes.js),
 * so a record survives its citizen's descent: a descended
 * display still applies the node's transform, because the
 * rendered set carries the same true ids. The tree's branches
 * ride the store through their own hover channel (branch ids),
 * like their marks do.
 *
 * Shape: { [citizenId]: { [nodeId]: transform } } — a citizen
 * whose last record is reset loses its key, so the untouched
 * store is the empty object.
 */

import {
  applyTransformOp,
  defaultTransform,
} from "./space-state.js";

export function createSubTransforms() {
  return {};
}

/** One node's transform record — the stored one, or the default. */
export function subTransformOf(store, citizenId, nodeId) {
  if (!store || !citizenId || !nodeId) return defaultTransform();
  const rec = store[citizenId] ? store[citizenId][nodeId] : null;
  return rec ? { ...defaultTransform(), ...rec } : defaultTransform();
}

/** Is this record the identity (no turn, no spin, scale 1)? */
export function isDefaultSubTransform(tr) {
  if (!tr) return true;
  return (tr.yaw || 0) === 0 && (tr.pitch || 0) === 0 && (tr.roll || 0) === 0
    && (tr.spin || 0) === 0 && (tr.scale == null || tr.scale === 1);
}

export function hasSubTransform(store, citizenId, nodeId) {
  return !isDefaultSubTransform(subTransformOf(store, citizenId, nodeId));
}

/**
 * Step one node's transform by one transform op ("yaw+" …
 * "scale-", transformOpOf's vocabulary), under the citizens'
 * own step rules (ANGLE_STEP, SCALE_STEP, clamped scale) —
 * applied through applyTransformOp on a one-record shim state,
 * so a sub-node's step can never drift from a citizen's.
 * Returns a NEW store; the input is never mutated. A record
 * stepped back to the identity is dropped, keeping the store
 * (and the View's change signatures) honest.
 */
export function applySubTransformOp(store, citizenId, nodeId, op) {
  if (!citizenId || !nodeId || !op) return store || createSubTransforms();
  const key = `${citizenId}${nodeId}`;
  const shim = { transforms: { [key]: subTransformOf(store, citizenId, nodeId) } };
  const next = applyTransformOp(shim, key, op);
  if (next === shim) return store || createSubTransforms();
  const rec = next.transforms[key];
  const out = { ...(store || {}) };
  const inner = { ...(out[citizenId] || {}) };
  if (isDefaultSubTransform(rec)) delete inner[nodeId];
  else inner[nodeId] = rec;
  if (Object.keys(inner).length) out[citizenId] = inner;
  else delete out[citizenId];
  return out;
}

/** H's finer address: drop one node's record entirely. */
export function resetSubTransform(store, citizenId, nodeId) {
  if (!store || !citizenId || !nodeId || !store[citizenId]) {
    return store || createSubTransforms();
  }
  const inner = { ...store[citizenId] };
  if (!(nodeId in inner)) return store;
  delete inner[nodeId];
  const out = { ...store };
  if (Object.keys(inner).length) out[citizenId] = inner;
  else delete out[citizenId];
  return out;
}

/**
 * A citizen's records as one signature string, for the View's
 * change detection (the marksKeyOf precedent): the instanced
 * forms rewrite their matrices exactly when this changes.
 */
export function subTransformKey(store, citizenId) {
  if (!store || !citizenId || !store[citizenId]) return "";
  return Object.entries(store[citizenId])
    .map(([id, tr]) => `${id}:${tr.yaw || 0},${tr.pitch || 0},${tr.roll || 0},${tr.spin || 0},${tr.scale ?? 1}`)
    .join("");
}

/**
 * THE TARGET RESOLUTION the transform keys and H share — the
 * hierarchy's new top level. A sub-node hovered on the CURRENT
 * citizen wins over the citizen itself: the provider channel
 * (tray, tangle, mesa, drum, book, devices, mail — the App's
 * subHover, live only while its citizen is current) or the
 * tree's branch channel. The KNOT's part channel is NOT read
 * (see the head note: no per-part geometry to transform), and
 * a hover that names any citizen but the current one resolves
 * to nothing — the channels are current-gated in the App, and
 * this resolution keeps the same discipline purely.
 * Returns { citizenId, nodeId } or null.
 */
export function resolveSubTransformTarget({ currentId = null, subHover = null, branchHoverId = null } = {}) {
  if (!currentId) return null;
  if (subHover && subHover.objectId === currentId && subHover.nodeId) {
    return { citizenId: currentId, nodeId: subHover.nodeId };
  }
  if (currentId === "tree" && branchHoverId) {
    return { citizenId: "tree", nodeId: branchHoverId };
  }
  return null;
}

const DEG = Math.PI / 180;

/**
 * A record as R3F-ready placement: an Euler triple (YXZ order,
 * radians — the citizens' own order) and a uniform scale, for a
 * wrapper group standing at the node's anchor. The SPIN folds
 * onto the family's PLANE AXIS — the axis of the node's own
 * plane normal, which the View takes from the citizen's own
 * PLANE_AXIS table (the convention its B/N already turns by):
 * "y" for forms lying in the ground plane (the sunburst
 * wedges, the tray's plates and cuboids, the book's bands and
 * leaves, the devices' shelf forms — their spin adds to yaw,
 * both being turns about Y in the node's frame, innermost like
 * the citizens' spin group), "z" for forms facing +Z (the
 * mail's compartments — spin adds to roll), "x" where a form's
 * normal is its local X.
 */
export function subTransformEuler(tr, planeAxis = "y") {
  const t = tr || defaultTransform();
  let { yaw = 0, pitch = 0, roll = 0, spin = 0 } = t;
  if (planeAxis === "z") roll += spin;
  else if (planeAxis === "x") pitch += spin;
  else yaw += spin;
  return {
    rotation: [pitch * DEG, yaw * DEG, roll * DEG],
    scale: t.scale == null ? 1 : t.scale,
  };
}
