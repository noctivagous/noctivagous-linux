import test from "node:test";
import assert from "node:assert/strict";

/**
 * Slice 13-5 — the focus/flight key split (F focuses, G flies,
 * patch moves to U), the fine eased dolly (Shift+C/V keeps the
 * sweep), hierarchical transforms (the hovered sub-node takes
 * the transform keys first; the knot excluded), the reordered
 * view keys (1 FRONT, 2 ELEVATION L, 3 ELEVATION R, 4 PLAN,
 * 0 HOME) with ` turning the platter a quarter, the treemap
 * dolly fix's resolver half, and the info card's placement rule.
 * Pure layers only — the App/View halves are gated by the build,
 * the SSR smoke, and the route check.
 */

import {
  ANGLE_STEP,
  DOLLY_COARSE_STEP,
  DOLLY_FINE_STEP,
  EVENTS,
  SCALE_MAX,
  SCALE_MIN,
  SCALE_STEP,
  VIEW_KEYS,
  VIEWS,
  ZOOM_MAX,
  ZOOM_MIN,
  beginPartFocus,
  citizenSeatOffsets,
  citizenViewSeat,
  createPartFocus,
  placeInfoCard,
  rectCircleIntersects,
  resolveBackLevels,
  resolveDollyFocus,
  resolveViewTarget,
  stepPlatterQuarter,
  viewSeat,
  zoomStep,
} from "../src/space-state.js";
import {
  applySubTransformOp,
  createSubTransforms,
  hasSubTransform,
  isDefaultSubTransform,
  resetSubTransform,
  resolveSubTransformTarget,
  subTransformEuler,
  subTransformKey,
  subTransformOf,
} from "../src/sub-transforms.js";

/* ---------------- item 1: the seated flag ---------------- */

test("item 1: one focus state, two seatings — F unseated, G seated", () => {
  const empty = createPartFocus();
  assert.deepEqual(empty, { objectId: null, partId: null, seated: false });
  // F's form: the focus stands, the camera does not move.
  const focused = beginPartFocus(empty, "tray", "tray/docs", false);
  assert.deepEqual(focused, { objectId: "tray", partId: "tray/docs", seated: false });
  // G on the already-focused node seats the SAME focus.
  const seated = beginPartFocus(focused, "tray", "tray/docs", true);
  assert.deepEqual(seated, { objectId: "tray", partId: "tray/docs", seated: true });
  // The default seating (the pre-13-5 callers' form) is seated.
  assert.equal(beginPartFocus(empty, "mesa", "mesa/a").seated, true);
  // A focus needs both ids; a bare call changes nothing.
  assert.equal(beginPartFocus(empty, null, "x"), empty);
  assert.equal(beginPartFocus(empty, "tray", null), empty);
});

test("item 1: the back chain's partFocus level pops the same either way", () => {
  // The chain sees the focus's PRESENCE only — resolveBackLevels
  // reads chain.partFocus as a boolean, so a seated and an
  // unseated focus release identically under S and D.
  for (const seated of [false, true]) {
    const focus = beginPartFocus(createPartFocus(), "tray", "tray/docs", seated);
    const chain = { partFocus: Boolean(focus.partId), card: true };
    assert.deepEqual(resolveBackLevels(chain, EVENTS.GO_BACK_I), ["partFocus"]);
    assert.deepEqual(resolveBackLevels(chain, EVENTS.GO_BACK_II), ["partFocus", "card"]);
    assert.deepEqual(resolveBackLevels(chain, EVENTS.CANCEL), ["partFocus"]);
  }
});

/* ---------------- item 2: fine dolly, Shift sweep ---------------- */

test("item 2: the step resolution — fine unshifted, coarse on Shift, same clamps", () => {
  assert.equal(DOLLY_FINE_STEP, 1.045);
  assert.equal(DOLLY_COARSE_STEP, 1.15);
  // Unshifted: a small proportional nudge in both directions.
  assert.equal(zoomStep(1, 1), 1 / DOLLY_FINE_STEP);
  assert.equal(zoomStep(1, -1), DOLLY_FINE_STEP);
  // Shift: the sweep — the historical step, unchanged.
  assert.equal(zoomStep(1, 1, true), 1 / DOLLY_COARSE_STEP);
  assert.equal(zoomStep(1, -1, true), DOLLY_COARSE_STEP);
  // The clamps are the standing ones, for both step sizes.
  for (const coarse of [false, true]) {
    assert.equal(zoomStep(ZOOM_MIN, 1, coarse), ZOOM_MIN);
    assert.equal(zoomStep(ZOOM_MAX, -1, coarse), ZOOM_MAX);
  }
  // Fine is strictly finer: crossing the whole range takes more
  // fine presses than coarse ones, in or out.
  const presses = (coarse) => {
    let mul = ZOOM_MIN;
    let n = 0;
    while (mul < ZOOM_MAX && n < 200) { mul = zoomStep(mul, -1, coarse); n += 1; }
    return n;
  };
  assert.ok(presses(false) > presses(true) * 2,
    `fine ${presses(false)} vs coarse ${presses(true)} presses across the range`);
});

/* ---------------- item 3: the sub-transform store ---------------- */

test("item 3: records default to the identity; stepping applies the citizens' rules", () => {
  const store = createSubTransforms();
  assert.deepEqual(store, {});
  assert.equal(isDefaultSubTransform(subTransformOf(store, "tray", "tray/docs")), true);
  assert.equal(hasSubTransform(store, "tray", "tray/docs"), false);
  // One yaw step is the citizens' ANGLE_STEP; the input store is
  // never mutated.
  const s1 = applySubTransformOp(store, "tray", "tray/docs", "yaw+");
  assert.equal(subTransformOf(s1, "tray", "tray/docs").yaw, ANGLE_STEP);
  assert.deepEqual(store, {}, "the input store is untouched");
  // Scale steps by SCALE_STEP and clamps at the citizens' range.
  let s = s1;
  for (let i = 0; i < 40; i++) s = applySubTransformOp(s, "tray", "tray/docs", "scale+");
  assert.equal(subTransformOf(s, "tray", "tray/docs").scale, SCALE_MAX);
  for (let i = 0; i < 80; i++) s = applySubTransformOp(s, "tray", "tray/docs", "scale-");
  assert.equal(subTransformOf(s, "tray", "tray/docs").scale, SCALE_MIN);
  assert.equal(SCALE_STEP, 1.08);
});

test("item 3: a record stepped back to the identity is dropped; H's reset drops it outright", () => {
  let s = applySubTransformOp(createSubTransforms(), "mesa", "mesa/a/b", "spin+");
  assert.equal(hasSubTransform(s, "mesa", "mesa/a/b"), true);
  s = applySubTransformOp(s, "mesa", "mesa/a/b", "spin-");
  assert.deepEqual(s, {}, "identity records do not linger");
  let s2 = applySubTransformOp(createSubTransforms(), "mail", "mail/inbox", "roll+");
  s2 = applySubTransformOp(s2, "mail", "mail/projects", "yaw+");
  const after = resetSubTransform(s2, "mail", "mail/inbox");
  assert.equal(hasSubTransform(after, "mail", "mail/inbox"), false);
  assert.equal(hasSubTransform(after, "mail", "mail/projects"), true,
    "a sibling node's record survives another's reset");
  // Resetting a node with no record is a no-op (same reference).
  assert.equal(resetSubTransform(after, "mail", "mail/inbox"), after);
});

test("item 3: the target resolution — hovered sub-node on the CURRENT citizen only", () => {
  // The provider channel: a hover on the current citizen wins.
  assert.deepEqual(
    resolveSubTransformTarget({ currentId: "tray", subHover: { objectId: "tray", nodeId: "tray/docs" } }),
    { citizenId: "tray", nodeId: "tray/docs" });
  // A hover naming another citizen resolves to nothing.
  assert.equal(
    resolveSubTransformTarget({ currentId: "mesa", subHover: { objectId: "tray", nodeId: "tray/docs" } }),
    null);
  // The tree's branch channel resolves on the tree alone.
  assert.deepEqual(
    resolveSubTransformTarget({ currentId: "tree", branchHoverId: "tree/a/b" }),
    { citizenId: "tree", nodeId: "tree/a/b" });
  assert.equal(resolveSubTransformTarget({ currentId: "mesa", branchHoverId: "tree/a/b" }), null);
  // No current citizen, no target — and the knot's part channel
  // is not an input at all: a knot current with only a part
  // hovered resolves to nothing (the parts are one continuous
  // sweep with no per-part geometry; see sub-transforms.js).
  assert.equal(resolveSubTransformTarget({ currentId: null, subHover: { objectId: "tray", nodeId: "tray/docs" } }), null);
  assert.equal(resolveSubTransformTarget({ currentId: "knot" }), null);
});

test("item 3: the Euler folds the spin onto the family's plane axis", () => {
  const tr = { yaw: 10, pitch: 20, roll: 30, spin: 6, scale: 1.5 };
  const y = subTransformEuler(tr, "y");
  assert.deepEqual(y.rotation.map((r) => Math.round(r * 180 / Math.PI)), [20, 16, 30],
    "ground-plane forms: the spin adds to yaw");
  assert.equal(y.scale, 1.5);
  const z = subTransformEuler(tr, "z");
  assert.deepEqual(z.rotation.map((r) => Math.round(r * 180 / Math.PI)), [20, 10, 36],
    "the mail cabinet's forms face +Z: the spin adds to roll");
  const x = subTransformEuler(tr, "x");
  assert.deepEqual(x.rotation.map((r) => Math.round(r * 180 / Math.PI)), [26, 10, 30],
    "an X-normal form: the spin adds to pitch");
  // The default record is the identity placement.
  const id = subTransformEuler(null, "y");
  assert.deepEqual(id.rotation, [0, 0, 0]);
  assert.equal(id.scale, 1);
});

test("item 3: the change signature tracks a citizen's records", () => {
  const s0 = createSubTransforms();
  assert.equal(subTransformKey(s0, "tangle"), "");
  const s1 = applySubTransformOp(s0, "tangle", "tangle/a", "yaw+");
  assert.notEqual(subTransformKey(s1, "tangle"), "");
  assert.equal(subTransformKey(s1, "tree"), "", "another citizen's key is untouched");
  const s2 = applySubTransformOp(s1, "tangle", "tangle/a", "yaw-");
  assert.equal(subTransformKey(s2, "tangle"), "", "back to identity, back to empty");
});

/* ---------------- item 4: view keys, Home on 0, the quarter turn ---------------- */

test("item 4: the view keys and definitions — 1 FRONT, 2 L, 3 R, 4 PLAN, 0 HOME", () => {
  assert.deepEqual(VIEW_KEYS, { "1": "front", "2": "left", "3": "right", "4": "top", "0": "home" });
  assert.equal(VIEWS.front.name, "FRONT");
  assert.equal(VIEWS.left.name, "ELEVATION L");
  assert.equal(VIEWS.right.name, "ELEVATION R");
  assert.equal(VIEWS.top.name, "PLAN");
  assert.equal(VIEWS.home.name, "HOME");
  // The elevations are the two side seats: mirror images across
  // the front axis, at the standing elevation profile (y 80).
  assert.deepEqual(VIEWS.left.seat, [-330, 80, 0]);
  assert.deepEqual(VIEWS.right.seat, [330, 80, 0]);
  assert.deepEqual(VIEWS.left.look, [-196, 80, 0]);
  assert.deepEqual(VIEWS.right.look, [196, 80, 0]);
  // The old single "side" is gone from the definitions.
  assert.equal(VIEWS.side, undefined);
  // Named seats still fly (item 2's exemption): viewSeat scales
  // the seat toward its look by the dolly multiplier as before.
  const near = viewSeat("left", 0.5);
  assert.ok(Math.hypot(...near.seat.map((v, i) => v - VIEWS.left.look[i]))
    < Math.hypot(...VIEWS.left.seat.map((v, i) => v - VIEWS.left.look[i])));
});

test("item 4: citizen-relative views cover front/L/R/plan; home stays global", () => {
  for (const view of ["front", "left", "right", "top"]) {
    assert.deepEqual(resolveViewTarget({ view, enteredId: "tray" }),
      { kind: "citizen", view, id: "tray" }, view);
  }
  assert.deepEqual(resolveViewTarget({ view: "home", enteredId: "tray" }),
    { kind: "global", view: "home" });
  // The two elevations stand at mirrored tangents, same offsets,
  // same look — at the citizen's own seat distance.
  const off = citizenSeatOffsets(1, 1);
  const base = [0, 0, 130]; // due south: radial +Z
  const l = citizenViewSeat("left", base, off, 9);
  const r = citizenViewSeat("right", base, off, 9);
  assert.deepEqual(l.seat, [-off.radial, off.up, 130], "L stands at the citizen's −X");
  assert.deepEqual(r.seat, [off.radial, off.up, 130], "R at its +X");
  assert.deepEqual(l.look, r.look);
});

test("item 4: the backquote steps the platter a quarter turn, wrapping", () => {
  assert.equal(stepPlatterQuarter(0), 90);
  assert.equal(stepPlatterQuarter(45), 135);
  // The parameter is an angle in −180..180: the quarter WRAPS
  // (170° + 90° is −100°, the same heading), where the fine
  // steps clamp.
  assert.equal(stepPlatterQuarter(90), -180);
  assert.equal(stepPlatterQuarter(170), -100);
  assert.equal(stepPlatterQuarter(-180), -90);
  // Four presses return to the start.
  let r = 30;
  for (let i = 0; i < 4; i++) r = stepPlatterQuarter(r);
  assert.equal(r, 30);
});

/* ---------------- item 5: the treemap dolly regression ---------------- */

test("item 5: with the tray ENTERED, its sub-node anchor resolves to a point focus", () => {
  // The resolver half of the fix (the Rig half — the card branch
  // composing a stored point focus — is View code; this pins
  // what pressZoom stores while a tray sub-node is hovered with
  // the tray open, the exact state the bug report named).
  const anchor = { point: [12, 30, -40], radius: 6 };
  assert.deepEqual(
    resolveDollyFocus({
      subAnchor: anchor, subAnchorObjectId: "tray",
      hoverId: "tray", currentId: "tray", cardId: "tray", enteredId: "tray",
    }),
    { kind: "point", via: "sub", point: [12, 30, -40], radius: 6 });
  // The same class on the mesa (per-node wedges): its anchor
  // resolves identically while the mesa is entered.
  assert.deepEqual(
    resolveDollyFocus({
      subAnchor: anchor, subAnchorObjectId: "mesa",
      hoverId: "mesa", currentId: "mesa", cardId: "mesa", enteredId: "mesa",
    }),
    { kind: "point", via: "sub", point: [12, 30, -40], radius: 6 });
  // The entered gate still holds: another citizen's anchor is
  // never honoured while the tray is open — the resolution
  // lands on the entered citizen itself (the resolver's
  // standing priority: sub-node, then citizen, then cursor).
  const gatedCitizen = resolveDollyFocus({
    subAnchor: anchor, subAnchorObjectId: "mesa",
    hoverId: "tray", currentId: "tray", cardId: "tray", enteredId: "tray",
    cursorPoint: [1, 2, 3], cursorOnEntered: true,
  });
  assert.deepEqual(gatedCitizen, { kind: "citizen", id: "tray" });
  const gatedBare = resolveDollyFocus({
    subAnchor: anchor, subAnchorObjectId: "mesa",
    hoverId: null, currentId: "tray", cardId: "tray", enteredId: "tray",
    cursorPoint: [1, 2, 3], cursorOnEntered: true,
  });
  assert.deepEqual(gatedBare, { kind: "citizen", id: "tray" },
    "even with nothing hovered, the entered citizen (card === current) "
    + "is the target — the foreign anchor never surfaces");
  // And with the tray merely current (not entered), a hovered
  // tray sub-node's anchor resolves as it always did.
  assert.equal(
    resolveDollyFocus({
      subAnchor: anchor, subAnchorObjectId: "tray",
      hoverId: "tray", currentId: "tray", cardId: null, enteredId: null,
    }).via, "sub");
});

/* ---------------- item 6: the card clears the sphere ---------------- */

const VIEWPORT = { w: 1280, h: 800 };
const CARD = { w: 260, h: 120 };
const onScreen = (pos) => {
  assert.ok(pos.x >= 8 && pos.y >= 8, `inside the margins: ${JSON.stringify(pos)}`);
  assert.ok(pos.x + CARD.w <= VIEWPORT.w - 8, "right edge on-screen");
  assert.ok(pos.y + CARD.h <= VIEWPORT.h - 8, "bottom edge on-screen");
};

test("item 6: the card never intersects the sphere's projected circle", () => {
  const spots = [
    { x: 640, y: 400 },   // centre
    { x: 60, y: 60 },     // top-left corner
    { x: 1220, y: 60 },   // top-right corner
    { x: 60, y: 740 },    // bottom-left corner
    { x: 1220, y: 740 },  // bottom-right corner
    { x: 640, y: 40 },    // top edge
    { x: 640, y: 760 },   // bottom edge
    { x: 40, y: 400 },    // left edge
    { x: 1240, y: 400 },  // right edge
  ];
  for (const c of spots) {
    for (const r of [60, 140, 220]) {
      const sphere = { ...c, r };
      const pos = placeInfoCard({ anchor: c, sphere, card: CARD, viewport: VIEWPORT });
      onScreen(pos);
      assert.equal(
        rectCircleIntersects({ x: pos.x, y: pos.y, w: CARD.w, h: CARD.h }, sphere), false,
        `sphere at ${c.x},${c.y} r${r}: the card ${JSON.stringify(pos)} must clear it`);
    }
  }
});

test("item 6: the preference order — above first, then the sides, then below", () => {
  // Room above: the card sits above the sphere, centred on the
  // anchor.
  const above = placeInfoCard({
    anchor: { x: 640, y: 500 }, sphere: { x: 640, y: 500, r: 100 },
    card: CARD, viewport: VIEWPORT,
  });
  assert.equal(above.y + CARD.h, 500 - 100 - 10, "above the sphere, one gap clear");
  assert.equal(above.x, 640 - CARD.w / 2);
  // No room above (the sphere rides the top edge): a side wins.
  const side = placeInfoCard({
    anchor: { x: 640, y: 120 }, sphere: { x: 640, y: 120, r: 110 },
    card: CARD, viewport: VIEWPORT,
  });
  assert.ok(side.x >= 640 + 110 + 10 || side.x + CARD.w <= 640 - 110 - 10,
    "displaced to a side of the sphere");
  onScreen(side);
});

test("item 6: a sphere too big to clear still lands on-screen; no sphere keeps the standing placement", () => {
  const huge = placeInfoCard({
    anchor: { x: 640, y: 400 }, sphere: { x: 640, y: 400, r: 900 },
    card: CARD, viewport: VIEWPORT,
  });
  onScreen(huge); // the best-clearance fallback never leaves the viewport
  // No sphere: above the anchor, centred, clamped — the
  // placement the cards had before the rule.
  const plain = placeInfoCard({
    anchor: { x: 100, y: 300 }, sphere: null, card: CARD, viewport: VIEWPORT,
  });
  assert.equal(plain.y, 300 - CARD.h - 10);
  assert.equal(plain.x, 8, "clamped to the margin, not centred off-screen");
});
