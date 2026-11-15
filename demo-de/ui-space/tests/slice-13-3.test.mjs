import test from "node:test";
import assert from "node:assert/strict";

import {
  ANGLE_STEP,
  OBJECT_IDS,
  PLATTER_SPIN_KEYS,
  platterSpinOpFor,
  stepPlatterSpin,
  resolveViewTarget,
  citizenViewSeat,
  citizenSeatOffsets,
  resolveDollyFocus,
  pointSeatDistance,
  DOLLY_POINT_BASE,
  DOLLY_POINT_MIN,
  resolveFAction,
  createBookAccess,
  bookAccessTo,
  bookTierChain,
  quatAxisAngle,
  quatMultiply,
  quatInvert,
  quatRotateVec,
  quatYawOf,
  gimbalQuatFor,
  CENTRE_Y,
  PROTECTIVE_R,
  citizenSocketRadius,
  mesaWedgeHeight,
  mesaWedgeLabelVisible,
  MESA_BASE_H,
} from "../src/space-state.js";
import { spreadIndexForPage } from "../src/book.js";
import { resolveKeyboard } from "../src/keyboard.js";

/* Slice 13-3: citizen-relative views (1), the generalised
 * dolly (2), the book F fix (3), the mesa's terraces (4), the
 * gimbal (5), and the platter plane keys + opening view (8). */

const CH = "book/the-room";
const SEC = "book/the-room/the-platter";
const PAGE = "book/the-room/the-platter/title-page";
const CH2 = "book/the-hands";
const SEC2 = "book/the-hands/keys";
const PAGE2 = "book/the-hands/keys/the-click";

/* ---------------- item 8: [ and ] turn the platter ---------------- */

test("platter spin keys: [ is the negative step, ] the positive", () => {
  assert.equal(platterSpinOpFor("["), "spin-");
  assert.equal(platterSpinOpFor("]"), "spin+");
  assert.deepEqual(PLATTER_SPIN_KEYS, { "[": "spin-", "]": "spin+" });
  // Nothing else resolves: not the citizens' plane pair, not digits.
  assert.equal(platterSpinOpFor("b"), null);
  assert.equal(platterSpinOpFor("n"), null);
  assert.equal(platterSpinOpFor("5"), null);
  assert.equal(platterSpinOpFor("x"), null);
  // The ops step the rotation parameter like B/N-on-platter does.
  assert.equal(stepPlatterSpin(0, platterSpinOpFor("]")), ANGLE_STEP);
  assert.equal(stepPlatterSpin(0, platterSpinOpFor("[")), -ANGLE_STEP);
  assert.equal(stepPlatterSpin(178, platterSpinOpFor("]")), 180, "clamped at the parameter's edge");
  assert.equal(stepPlatterSpin(-178, platterSpinOpFor("[")), -180);
});

test("keyboard: [ and ] light as PLATTER PLANE in space and label scopes only", () => {
  const labelOf = (kb, code) => kb.caps.find((c) => c.code === code)?.binding?.label ?? null;
  const space = resolveKeyboard({ scope: "space" });
  assert.equal(labelOf(space, "BracketLeft"), "PLATTER PLANE -");
  assert.equal(labelOf(space, "BracketRight"), "PLATTER PLANE +");
  assert.equal(space.caps.find((c) => c.code === "BracketLeft").binding.operator, true);
  const labels = resolveKeyboard({ scope: "labels" });
  assert.equal(labelOf(labels, "BracketLeft"), "PLATTER PLANE -",
    "not letters — they work in label mode, like the digit camera keys");
  assert.equal(labelOf(resolveKeyboard({ scope: "command" }), "BracketLeft"), null,
    "the armed line owns them as characters");
  assert.equal(labelOf(resolveKeyboard({ scope: "app" }), "BracketLeft"), null,
    "an open app keeps its scope");
  assert.equal(labelOf(resolveKeyboard({ scope: "space", dragLocked: true }), "BracketLeft"), null,
    "a drag lock shrinks the board to its four keys");
});

/* ---------------- item 1: citizen-relative named views ---------------- */

test("resolveViewTarget: entered citizen + PLAN/ELEVATION resolves to the citizen", () => {
  // Slice 13-5 (item 4): the single SIDE view split into the two
  // elevations — both resolve citizen-relative while entered.
  for (const view of ["top", "front", "left", "right"]) {
    assert.deepEqual(resolveViewTarget({ view, enteredId: "mesa" }),
      { kind: "citizen", view, id: "mesa" });
  }
  // HOME stays the space's, even while entered.
  assert.deepEqual(resolveViewTarget({ view: "home", enteredId: "mesa" }),
    { kind: "global", view: "home" });
  // No citizen entered: everything is global, as before.
  for (const view of ["top", "front", "left", "right", "home"]) {
    assert.deepEqual(resolveViewTarget({ view, enteredId: null }), { kind: "global", view });
  }
  // A ring item or a card is not an entered citizen.
  assert.deepEqual(resolveViewTarget({ view: "top", enteredId: "audio" }), { kind: "global", view: "top" });
  assert.deepEqual(resolveViewTarget({ view: "top", enteredId: "clipboard" }), { kind: "global", view: "top" });
});

test("citizenViewSeat: front is the entered seat, the elevations its quarter-turns, plan above", () => {
  const off = citizenSeatOffsets(1, 1); // { radial: 72, up: 34 }
  const anchorY = 16 * 0.55;
  const base = [130, 0, 0]; // a citizen due east of the centre: radial = +X
  const front = citizenViewSeat("front", base, off, anchorY);
  assert.deepEqual(front.seat, [202, 34, 0], "out along the radial, raised — the card seat's composition");
  assert.deepEqual(front.look, [130, anchorY, 0]);
  // Slice 13-5 (item 4): ELEVATION L keeps the old side's seat
  // (the tangent (−rz, rx)); ELEVATION R mirrors it.
  const side = citizenViewSeat("left", base, off, anchorY);
  assert.deepEqual(side.seat, [130, 34, 72], "out along the tangent at the same offsets");
  const sideOffset = [side.seat[0] - 130, side.seat[2] - 0];
  assert.ok(Math.abs(sideOffset[0] * 1 + sideOffset[1] * 0) < 1e-9, "the side offset is perpendicular to the radial");
  assert.deepEqual(side.look, front.look, "side looks where front looks");
  const right = citizenViewSeat("right", base, off, anchorY);
  assert.deepEqual(right.seat, [130, 34, -72], "ELEVATION R mirrors L about the radial");
  assert.deepEqual(right.look, front.look, "both elevations look where front looks");
  const top = citizenViewSeat("top", base, off, anchorY);
  const dist = Math.hypot(off.radial, off.up);
  assert.ok(Math.abs(top.seat[1] - dist) < 1e-9, "plan stands the seat distance above");
  assert.ok(Math.abs(top.seat[0] - (130 + off.radial * 0.12)) < 1e-9, "a hair of the radial kept, for a stable up vector");
  assert.equal(top.seat[2], 0);
  assert.ok(Math.abs(top.look[1] - anchorY * 0.4) < 1e-9, "plan looks down at the citizen's heart");
  // A citizen on the axis has no radial: the fallback faces it from the south.
  const centred = citizenViewSeat("front", [0, 0, 0], off, anchorY);
  assert.deepEqual(centred.seat, [0, 34, 72]);
  // Every variant stands at the seat distance (front/elevations)
  // — the citizen's own scale of framing, never the global
  // seats'.
  const d = (s) => Math.hypot(s[0] - 130, s[1] - 0, s[2] - 0);
  assert.ok(Math.abs(d(front.seat) - dist) < 1e-9);
  assert.ok(Math.abs(d(side.seat) - dist) < 1e-9);
  assert.ok(Math.abs(d(right.seat) - dist) < 1e-9);
});

/* ---------------- item 2: the generalised dolly ---------------- */

test("resolveDollyFocus: sub-node anchor, then citizen, then cursor point, then world", () => {
  const anchor = { point: [10, 20, 30], radius: 5 };
  // (a) a hovered sub-node's anchor beats even a hovered citizen.
  assert.deepEqual(
    resolveDollyFocus({ subAnchor: anchor, hoverId: "mesa", currentId: "mesa", cardId: "mesa", cursorPoint: [1, 2, 3] }),
    { kind: "point", via: "sub", point: [10, 20, 30], radius: 5 });
  // (b) the hovered citizen's seat (existing behaviour).
  assert.deepEqual(
    resolveDollyFocus({ hoverId: "mesa", currentId: "book", cardId: null, cursorPoint: [1, 2, 3] }),
    { kind: "citizen", id: "mesa" });
  // (b) the OPENED citizen, after the pointer has left it.
  assert.deepEqual(
    resolveDollyFocus({ hoverId: null, currentId: "book", cardId: "book", cursorPoint: null }),
    { kind: "citizen", id: "book" });
  // (c) the raw cursor point — over the slab, say, with nothing hovered.
  assert.deepEqual(
    resolveDollyFocus({ hoverId: null, currentId: null, cardId: null, cursorPoint: [40, 0, -25] }),
    { kind: "point", via: "cursor", point: [40, 0, -25], radius: 0 });
  // (d) nothing under the hand: the world dolly.
  assert.deepEqual(resolveDollyFocus({}), { kind: "world" });
  assert.deepEqual(
    resolveDollyFocus({ hoverId: "audio", currentId: null, cardId: null, cursorPoint: null }),
    { kind: "world" }, "a ring item is not a dolly citizen");
  // A malformed anchor falls through to the citizen.
  assert.deepEqual(
    resolveDollyFocus({ subAnchor: { point: null }, hoverId: "mesa" }),
    { kind: "citizen", id: "mesa" });
});

test("pointSeatDistance: the citizen curve's deepening, floored at the stand-off", () => {
  assert.equal(pointSeatDistance(1), DOLLY_POINT_BASE, "60 at rest");
  assert.equal(pointSeatDistance(0.5), 24, "the deepest step: 60 × the seat floor 0.4");
  assert.equal(pointSeatDistance(2), 120, "out steps pass the multiplier through");
  assert.ok(pointSeatDistance(0.5) > DOLLY_POINT_MIN, "the floor is a floor, not the working distance");
  assert.ok(DOLLY_POINT_MIN >= 14, "the stand-off clears every anchored element (radii ≤ ~9)");
});

/* ---------------- item 3: the book F enumeration ---------------- */

test("book F: every (access × sub-hover × presentation) case resolves inside the book", () => {
  const accesses = {
    none: createBookAccess(),
    chapter: bookAccessTo(createBookAccess(), CH),
    section: bookAccessTo(createBookAccess(), SEC),
    pageOut: bookAccessTo(createBookAccess(), PAGE),
  };
  const subs = [
    { name: "chapter", subId: CH2, subTier: 1, cyl: "bookAccess", spread: "bookAccess" },
    { name: "section", subId: SEC2, subTier: 2, cyl: "bookAccess", spread: "bookAccess" },
    { name: "page", subId: PAGE2, subTier: 3, cyl: "bookPage", spread: "bookSpreadTo" },
    { name: "root", subId: "book", subTier: 0, cyl: "bookNoop", spread: "bookNoop" },
    // No sub-hover — the pointer on the plinth or between
    // bands, or a hover the drum's access turn made stale (the
    // App's provider lookup returns null, so subId is null).
    // The RESOLVER's contract is "open" (enter); the App turns
    // it into the bookNoop echo while the book stands entered,
    // and into entering while it is merely current.
    { name: "none", subId: null, subTier: 0, cyl: "open", spread: "open" },
    { name: "stale", subId: null, subTier: 0, cyl: "open", spread: "open" },
  ];
  for (const [accessName, access] of Object.entries(accesses)) {
    for (const sub of subs) {
      for (const bookStyle of ["cylinder", "spread"]) {
        const action = resolveFAction({
          hoverId: "book", currentId: "book",
          subId: sub.subId, subTier: sub.subTier, bookStyle,
        });
        const expected = bookStyle === "spread" ? sub.spread : sub.cyl;
        assert.equal(action.type, expected,
          `access=${accessName} sub=${sub.name} style=${bookStyle}`);
        assert.notEqual(action.type, "inspect");
        if (action.type === "bookAccess" || action.type === "bookPage") {
          // From ANY access depth, the action lands on the
          // addressed tier's own chain — never a reset, never
          // an exit. (The App half of the fix keeps the card
          // open through these cases; the resolver half is
          // pinned here.)
          assert.deepEqual(bookAccessTo(access, action.nodeId).path, bookTierChain(action.nodeId),
            `access=${accessName} sub=${sub.name}: access lands on the tier's chain`);
        }
        if (action.type === "bookSpreadTo") {
          assert.ok(spreadIndexForPage(action.nodeId) >= 0);
        }
      }
    }
  }
});

test("book F: the root tier is an honest no-op, never a silent access reset", () => {
  // Before the fix this resolved bookAccess to the root, whose
  // tier chain is EMPTY — F quietly un-accessed everything.
  assert.deepEqual(bookTierChain("book"), []);
  assert.deepEqual(
    resolveFAction({ hoverId: "book", currentId: "book", subId: "book", subTier: 0 }),
    { type: "bookNoop", targetId: "book" });
});

test("sunburst F: the centre disc (the display root) is a no-op, wedges unchanged", () => {
  assert.deepEqual(
    resolveFAction({ hoverId: "mesa", currentId: "mesa", subId: "noctivagous-linux", subRoot: true }),
    { type: "rootNoop", targetId: "mesa" });
  assert.deepEqual(
    resolveFAction({ hoverId: "mesa", currentId: "mesa", subId: "noctivagous-linux/demo-de", subLeaf: false }),
    { type: "descend", targetId: "mesa", nodeId: "noctivagous-linux/demo-de" },
    "a branch wedge still descends");
  assert.deepEqual(
    resolveFAction({ hoverId: "mesa", currentId: "mesa", subId: "noctivagous-linux/README.md", subLeaf: true }),
    { type: "partFocus", targetId: "mesa", partId: "noctivagous-linux/README.md" },
    "a leaf wedge still takes the focus seat");
});

/* ---------------- item 4: the mesa's terraces ---------------- */

test("mesaWedgeHeight: the standalone's terrace formula, today's heights at the defaults", () => {
  assert.equal(mesaWedgeHeight(1), 12, "the inner ring stands at 12, as shipped");
  assert.equal(mesaWedgeHeight(2), 6.5, "the outer ring at 6.5, as shipped");
  assert.equal(mesaWedgeHeight(1, 0), MESA_BASE_H, "terrace 0 flattens the mesa");
  assert.equal(mesaWedgeHeight(2, 0), MESA_BASE_H);
  assert.equal(mesaWedgeHeight(1, 12), MESA_BASE_H + 12, "the parameter's top end");
  assert.equal(mesaWedgeHeight(3, 9), MESA_BASE_H, "nothing below the outer ring's base");
});

test("mesaWedgeLabelVisible: the standalone's room-to-hold-text rule, off the share", () => {
  assert.equal(mesaWedgeLabelVisible(0.005), true, "span 0.0314 > 0.03");
  assert.equal(mesaWedgeLabelVisible(0.004), false, "span 0.0251 < 0.03");
  assert.equal(mesaWedgeLabelVisible(0), false);
  assert.equal(mesaWedgeLabelVisible(0.5), true);
});

/* ---------------- item 5: the gimbal ---------------- */

const Y = [0, 1, 0];
const slabQuat = (yaw, pitch, roll) => quatMultiply(
  quatAxisAngle(Y, yaw),
  quatMultiply(quatAxisAngle([1, 0, 0], pitch), quatAxisAngle([0, 0, 1], roll)),
);

test("the envelope tables cover every citizen", () => {
  for (const id of OBJECT_IDS) {
    assert.ok(CENTRE_Y[id] != null, `CENTRE_Y.${id}`);
    assert.ok(PROTECTIVE_R[id] > CENTRE_Y[id], `PROTECTIVE_R.${id} exceeds its pivot height`);
    assert.ok(citizenSocketRadius(id) > 0, `a socket radius for ${id}`);
  }
  // The socket radii agree with the sockets analysis' table.
  assert.ok(Math.abs(citizenSocketRadius("mesa") - 27.21) < 0.05);
  assert.ok(Math.abs(citizenSocketRadius("tray") - 41.01) < 0.05);
  assert.ok(Math.abs(citizenSocketRadius("book") - 43.65) < 0.05, "the book is sized page-out");
});

test("gimbalQuatFor: Q ∘ gimbal is exactly the slab's yaw — level, facing kept", () => {
  const angles = [-75, -40, -15, 0, 15, 40, 75];
  for (const yaw of [0, 33, 90, 180]) {
    for (const pitch of angles) {
      for (const roll of angles) {
        const q = slabQuat(yaw, pitch, roll);
        const composed = quatMultiply(q, gimbalQuatFor(q));
        const up = quatRotateVec(composed, [0, 1, 0]);
        assert.ok(Math.hypot(up[0], up[1] - 1, up[2]) < 1e-9,
          `level at yaw ${yaw} pitch ${pitch} roll ${roll}: up = ${up}`);
        const fwd = quatRotateVec(composed, [0, 0, 1]);
        assert.ok(Math.abs(fwd[1]) < 1e-9, "the facing stays horizontal");
        const dyaw = Math.atan2(
          Math.sin(Math.atan2(fwd[0], fwd[2]) - quatYawOf(q)),
          Math.cos(Math.atan2(fwd[0], fwd[2]) - quatYawOf(q)));
        assert.ok(Math.abs(dyaw) < 1e-9, "the facing is the slab's own yaw");
      }
    }
  }
  assert.deepEqual(gimbalQuatFor([0, 0, 0, 1]).map((v) => Math.abs(v)), [0, 0, 0, 1],
    "identity in, identity out");
});

test("gimbal clearance: a level-kept citizen's sphere never crosses the slab plane outside its socket", () => {
  // Binding points: a fibonacci sphere at each citizen's
  // protective radius about its pivot, plus the sphere's
  // bottom point (the deepest a swing can reach).
  const dirs = [];
  const N = 220;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963;
    dirs.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  dirs.push([0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]);
  const angles = [-75, -40, -15, 0, 15, 40, 75];
  let crossings = 0;
  for (const id of OBJECT_IDS) {
    const R = PROTECTIVE_R[id];
    const CY = CENTRE_Y[id];
    const socketR = citizenSocketRadius(id);
    for (const yaw of [0, 33, 90]) {
      for (const pitch of angles) {
        for (const roll of angles) {
          const q = slabQuat(yaw, pitch, roll);
          // The citizen's orientation RELATIVE to the slab:
          // Q⁻¹ ∘ (its world orientation, Ry(yaw(Q)) ∘ identity).
          const rel = quatMultiply(quatInvert(q),
            quatAxisAngle(Y, (quatYawOf(q) * 180) / Math.PI));
          for (const d of dirs) {
            const local = quatRotateVec(rel, [d[0] * R, d[1] * R, d[2] * R]);
            const p = [local[0], CY + local[1], local[2]]; // the pivot stands CY above the plane
            if (p[1] < 0) {
              crossings += 1;
              const radial = Math.hypot(p[0], p[2]);
              assert.ok(radial <= socketR + 1e-6,
                `${id} at yaw ${yaw} pitch ${pitch} roll ${roll}: crosses at radius ${radial.toFixed(2)} > socket ${socketR.toFixed(2)}`);
            }
          }
        }
      }
    }
  }
  assert.ok(crossings > 1000, `the sampling actually crosses the plane (${crossings} crossings checked)`);
});
