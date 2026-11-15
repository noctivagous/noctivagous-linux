import test from "node:test";
import assert from "node:assert/strict";

import {
  EVENTS,
  TRANSFORM_KEYS,
  transformOpOf,
  resolveBackLevels,
  backChainLevels,
  resolveEKey,
  resolveRotateTarget,
  resolveScaleTarget,
  IDENTITY_QUAT,
  quatAxisAngle,
  quatMultiply,
  stepPlatterQuat,
  stepPlatterSpin,
  stepRingSpin,
  zoomStep,
  LAYOUT_KEYS,
  VIEW_KEYS,
  FIELD_SIZES,
  FIELD_DEFAULT_INDEX,
  fieldStep,
  createSpaceState,
  applyTransformKey,
  applyTransformOp,
  addressedId,
  ANGLE_STEP,
} from "../src/space-state.js";

/* ---------------- the key map ---------------- */

test("TRANSFORM_KEYS is exactly the slice-11 map, with slice 13-4's E/R yaw swap", () => {
  // Slice 13-4 (item E) swaps the yaw pair: E is the POSITIVE
  // step, R the negative — the one deliberate change to the
  // slice-11 map; every other entry stands as it was.
  assert.deepEqual(TRANSFORM_KEYS, {
    q: "pitch-", w: "pitch+",
    e: "yaw+", r: "yaw-",
    t: "roll-", y: "roll+",
    z: "scale-", x: "scale+",
    b: { axis: "spin", dir: -1 },
    n: { axis: "spin", dir: 1 },
  });
  // The punctuation keys are unbound in the space scope.
  for (const p of ["-", "=", "[", "]", ";", "'", ".", "/"]) {
    assert.equal(TRANSFORM_KEYS[p], undefined, `punctuation ${p}`);
  }
  // Digits are not transforms (they are the camera/room row, §14).
  assert.equal(TRANSFORM_KEYS["1"], undefined);
  assert.equal(TRANSFORM_KEYS["7"], undefined);
  // The { axis, dir } entries normalise to op names.
  assert.equal(transformOpOf("b"), "spin-");
  assert.equal(transformOpOf("n"), "spin+");
  // Slice 13-4 (item E): E normalises to yaw+ after the swap.
  assert.equal(transformOpOf("e"), "yaw+");
  assert.equal(transformOpOf("r"), "yaw-");
  assert.equal(transformOpOf("?"), null);
});

test("the number row maps (§14): layouts on 7/8/9, views on 1–4 and 0", () => {
  assert.deepEqual(LAYOUT_KEYS, { "7": "ring", "8": "districts", "9": "theatre" });
  // Slice 13-5 (item 4) reordered the views: 1 FRONT, 2 ELEVATION
  // L, 3 ELEVATION R, 4 PLAN, 0 HOME (the old SIDE split in two).
  assert.deepEqual(VIEW_KEYS, { "1": "front", "2": "left", "3": "right", "4": "top", "0": "home" });
});

test("FIELD_SIZES (§15): the ladder, exact — widest to narrowest", () => {
  assert.deepEqual(FIELD_SIZES, [
    { name: "LONG", fov: 70, iso: 1.61 },
    { name: "MEDIUM LONG", fov: 58, iso: 1.27 },
    { name: "MEDIUM", fov: 47, iso: 1.0 },
    { name: "MEDIUM CLOSE", fov: 37, iso: 0.77 },
    { name: "CLOSE", fov: 28, iso: 0.57 },
  ]);
  for (let i = 1; i < FIELD_SIZES.length; i++) {
    assert.ok(FIELD_SIZES[i].fov < FIELD_SIZES[i - 1].fov, "fov descends");
    assert.ok(FIELD_SIZES[i].iso < FIELD_SIZES[i - 1].iso, "iso factor descends");
  }
  // The default rung is the one nearest the Rig's standing 40°.
  const nearest = FIELD_SIZES.reduce((b, f, i) =>
    Math.abs(f.fov - 40) < Math.abs(FIELD_SIZES[b].fov - 40) ? i : b, 0);
  assert.equal(FIELD_DEFAULT_INDEX, nearest);
  assert.equal(FIELD_SIZES[FIELD_DEFAULT_INDEX].name, "MEDIUM CLOSE");
});

test("fieldStep (§15): one rung at a time, clamped at the ladder's ends", () => {
  assert.equal(fieldStep(2, -1), 1); // wider
  assert.equal(fieldStep(2, 1), 3); // narrower
  assert.equal(fieldStep(0, -1), 0); // widest already
  assert.equal(fieldStep(4, 1), 4); // narrowest already
  assert.equal(fieldStep(0, 1), 1);
  assert.equal(fieldStep(4, -1), 3);
});

test("EVENTS is the four-word vocabulary", () => {
  assert.deepEqual(EVENTS, {
    FINISH: "FINISH",
    GO_BACK_I: "GO_BACK_I",
    GO_BACK_II: "GO_BACK_II",
    CANCEL: "CANCEL",
  });
});

/* ---------------- resolveBackLevels ---------------- */

const FULL = {
  dragLocked: true, inspection: true, appNav: 2, appOpen: true,
  partFocus: true, pending: true, card: true, selection: true,
};

test("the chain order is drag → inspection → appNav → appClose → focus → patch → card → selection", () => {
  assert.deepEqual(backChainLevels(FULL), [
    "drag", "inspection", "appNav", "appNav", "appClose",
    "partFocus", "patch", "card", "selection",
  ]);
  assert.deepEqual(backChainLevels({}), []);
  assert.deepEqual(backChainLevels({ appNav: 0, appOpen: true }), ["appClose"]);
});

test("CANCEL and GO_BACK_I pop exactly one level", () => {
  assert.deepEqual(resolveBackLevels(FULL, EVENTS.CANCEL), ["drag"]);
  assert.deepEqual(resolveBackLevels(FULL, EVENTS.GO_BACK_I), ["drag"]);
  const space = { partFocus: true, pending: true, card: true, selection: true };
  assert.deepEqual(resolveBackLevels(space, EVENTS.CANCEL), ["partFocus"]);
  assert.deepEqual(resolveBackLevels(space, EVENTS.GO_BACK_I), ["partFocus"]);
});

test("GO_BACK_II pops up to two levels, stopping at the chain's end", () => {
  assert.deepEqual(resolveBackLevels(FULL, EVENTS.GO_BACK_II), ["drag", "inspection"]);
  const space = { partFocus: true, pending: true, card: true, selection: true };
  assert.deepEqual(resolveBackLevels(space, EVENTS.GO_BACK_II), ["partFocus", "patch"]);
  assert.deepEqual(resolveBackLevels({ card: true, selection: true }, EVENTS.GO_BACK_II), ["card", "selection"]);
  assert.deepEqual(resolveBackLevels({ selection: true }, EVENTS.GO_BACK_II), ["selection"]);
  assert.deepEqual(resolveBackLevels({}, EVENTS.GO_BACK_II), []);
});

/* ---------------- descent in the chain (slice 12) ---------------- */

test("descent sits at the partFocus tier: focus first, then one level per descended root", () => {
  const chain = { partFocus: true, descent: 2, pending: true, card: true, selection: true };
  assert.deepEqual(backChainLevels(chain), [
    "partFocus", "descent", "descent", "patch", "card", "selection",
  ]);
  // CANCEL climbs exactly one root; GO_BACK_II releases the focus, then climbs one.
  assert.deepEqual(resolveBackLevels(chain, EVENTS.CANCEL), ["partFocus"]);
  assert.deepEqual(resolveBackLevels(chain, EVENTS.GO_BACK_II), ["partFocus", "descent"]);
  // With no focus held, the backs climb: one, or two at once.
  const descended = { descent: 2, card: true, selection: true };
  assert.deepEqual(resolveBackLevels(descended, EVENTS.CANCEL), ["descent"]);
  assert.deepEqual(resolveBackLevels(descended, EVENTS.GO_BACK_I), ["descent"]);
  assert.deepEqual(resolveBackLevels(descended, EVENTS.GO_BACK_II), ["descent", "descent"]);
  // At the true root the descent level is absent.
  assert.deepEqual(resolveBackLevels({ descent: 0, selection: true }, EVENTS.CANCEL), ["selection"]);
  assert.deepEqual(backChainLevels({ descent: 1 }), ["descent"]);
});

test("app chains: nav entries first, then close, then the space's levels", () => {
  const app = { appNav: 2, appOpen: true, selection: true };
  assert.deepEqual(resolveBackLevels(app, EVENTS.CANCEL), ["appNav"]);
  assert.deepEqual(resolveBackLevels(app, EVENTS.GO_BACK_II), ["appNav", "appNav"]);
  const oneNav = { appNav: 1, appOpen: true, selection: true };
  assert.deepEqual(resolveBackLevels(oneNav, EVENTS.GO_BACK_II), ["appNav", "appClose"]);
  const noNav = { appNav: 0, appOpen: true, selection: true };
  assert.deepEqual(resolveBackLevels(noNav, EVENTS.CANCEL), ["appClose"]);
  assert.deepEqual(resolveBackLevels(noNav, EVENTS.GO_BACK_II), ["appClose", "selection"]);
});

test("FINISH is not a back event, and unknown events pop nothing", () => {
  assert.deepEqual(resolveBackLevels(FULL, EVENTS.FINISH), []);
  assert.deepEqual(resolveBackLevels(FULL, "BOGUS"), []);
  assert.deepEqual(resolveBackLevels(FULL, undefined), []);
});

/* ---------------- resolveEKey ---------------- */

test("resolveEKey: citizen yaws, ring item expands, centre app expands, full app nothing", () => {
  // Slice 13-4 (item E): on a citizen E resolves to yaw+ (the
  // swap); its EXPAND rulings are unchanged.
  assert.equal(resolveEKey({ targetId: "mesa" }), "yaw+");
  assert.equal(resolveEKey({ targetId: "tree" }), "yaw+");
  assert.equal(resolveEKey({ targetId: "audio" }), "expand");
  assert.equal(resolveEKey({ targetId: null, appOpen: true, appMode: "center" }), "expand");
  assert.equal(resolveEKey({ targetId: "mesa", appOpen: true, appMode: "center" }), "expand");
  assert.equal(resolveEKey({ targetId: "mesa", appOpen: true, appMode: "full" }), null);
  assert.equal(resolveEKey({ targetId: null }), null);
  assert.equal(resolveEKey({ targetId: "media-1" }), null);
  assert.equal(resolveEKey({ targetId: "clipboard" }), null);
  assert.equal(resolveEKey({}), null);
});

/* ---------------- resolveRotateTarget ---------------- */

test("resolveRotateTarget: hovered citizen → ring → current citizen → platter", () => {
  // (1) a hovered citizen wins over everything, the ring included.
  assert.deepEqual(
    resolveRotateTarget({ hoverId: "drum", currentId: "mesa", ringAddressed: true }),
    { kind: "citizen", id: "drum" },
  );
  // (2) the ring, when it is the addressee.
  assert.deepEqual(
    resolveRotateTarget({ hoverId: "audio", currentId: "mesa", ringAddressed: true }),
    { kind: "ring" },
  );
  assert.deepEqual(
    resolveRotateTarget({ hoverId: null, currentId: "mesa", ringAddressed: true }),
    { kind: "ring" },
  );
  // (3) the current citizen.
  assert.deepEqual(
    resolveRotateTarget({ hoverId: null, currentId: "cube", ringAddressed: false }),
    { kind: "citizen", id: "cube" },
  );
  // A hovered non-citizen (a card) does not block the current citizen.
  assert.deepEqual(
    resolveRotateTarget({ hoverId: "media-1", currentId: "cube", ringAddressed: false }),
    { kind: "citizen", id: "cube" },
  );
  // (4) the fallback: the platter.
  assert.deepEqual(resolveRotateTarget({}), { kind: "platter" });
  assert.deepEqual(
    resolveRotateTarget({ hoverId: "audio", currentId: "audio", ringAddressed: false }),
    { kind: "platter" },
  );
});

/* ---------------- the platter: parameter spin, camera-space turns, scale ---------------- */

test("stepPlatterSpin steps ANGLE_STEP and clamps to the parameter's range", () => {
  assert.equal(stepPlatterSpin(0, "spin+"), ANGLE_STEP);
  assert.equal(stepPlatterSpin(0, "spin-"), -ANGLE_STEP);
  assert.equal(stepPlatterSpin(179, "spin+"), 180);
  assert.equal(stepPlatterSpin(-179, "spin-"), -180);
  assert.equal(stepPlatterSpin(30, "yaw+"), 30); // yaw does not spin the parameter
});

const AXES = { up: [0, 1, 0], right: [1, 0, 0], forward: [0, 0, 1] };
const near = (a, b, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test("stepPlatterQuat: identity start; yaw premultiplies about the camera's up", () => {
  const q = stepPlatterQuat(IDENTITY_QUAT, AXES, "yaw+");
  const s = Math.sin((ANGLE_STEP * Math.PI) / 360);
  const c = Math.cos((ANGLE_STEP * Math.PI) / 360);
  assert.ok(near(q, [0, s, 0, c]), `yaw+ from identity: ${q}`);
  // And it is exactly the axis-angle step premultiplied.
  assert.ok(near(q, quatMultiply(quatAxisAngle(AXES.up, ANGLE_STEP), IDENTITY_QUAT)));
  const qm = stepPlatterQuat(IDENTITY_QUAT, AXES, "yaw-");
  assert.ok(near(qm, [0, -s, 0, c]));
});

test("stepPlatterQuat: pitch turns about the camera's right, roll about its forward", () => {
  const s = Math.sin((ANGLE_STEP * Math.PI) / 360);
  const c = Math.cos((ANGLE_STEP * Math.PI) / 360);
  assert.ok(near(stepPlatterQuat(IDENTITY_QUAT, AXES, "pitch+"), [s, 0, 0, c]));
  assert.ok(near(stepPlatterQuat(IDENTITY_QUAT, AXES, "pitch-"), [-s, 0, 0, c]));
  assert.ok(near(stepPlatterQuat(IDENTITY_QUAT, AXES, "roll+"), [0, 0, s, c]));
  // The axes are the CAMERA's, not the world's: a pitched camera
  // yaws about its own up, wherever that points.
  const tilted = { up: [0, Math.SQRT1_2, Math.SQRT1_2], right: [1, 0, 0], forward: [0, -Math.SQRT1_2, Math.SQRT1_2] };
  const q = stepPlatterQuat(IDENTITY_QUAT, tilted, "yaw+");
  assert.ok(near(q, quatAxisAngle(tilted.up, ANGLE_STEP)));
});

test("stepPlatterQuat: steps accumulate, and premultiplication order matters", () => {
  const two = stepPlatterQuat(stepPlatterQuat(IDENTITY_QUAT, AXES, "yaw+"), AXES, "yaw+");
  const s2 = Math.sin((2 * ANGLE_STEP * Math.PI) / 360);
  const c2 = Math.cos((2 * ANGLE_STEP * Math.PI) / 360);
  assert.ok(near(two, [0, s2, 0, c2]), `two yaw steps: ${two}`);
  // Yaw-then-pitch is not pitch-then-yaw: each step premultiplies
  // in the camera frame, so the composition is not commutative.
  const yp = stepPlatterQuat(stepPlatterQuat(IDENTITY_QUAT, AXES, "yaw+"), AXES, "pitch+");
  const py = stepPlatterQuat(stepPlatterQuat(IDENTITY_QUAT, AXES, "pitch+"), AXES, "yaw+");
  assert.ok(!near(yp, py, 1e-6), "camera-frame steps must not commute");
  // Spin and scale ops leave the quaternion alone.
  assert.deepEqual(stepPlatterQuat(IDENTITY_QUAT, AXES, "spin+"), [...IDENTITY_QUAT]);
  assert.deepEqual(stepPlatterQuat(IDENTITY_QUAT, AXES, "scale-"), [...IDENTITY_QUAT]);
  assert.deepEqual(stepPlatterQuat(null, AXES, "yaw+"), stepPlatterQuat(IDENTITY_QUAT, AXES, "yaw+"));
});

test("resolveScaleTarget: citizen addressed scales; the platter declines; the ring is neither", () => {
  assert.deepEqual(
    resolveScaleTarget({ hoverId: "drum", currentId: "mesa" }),
    { kind: "citizen", id: "drum" },
  );
  assert.deepEqual(
    resolveScaleTarget({ hoverId: null, currentId: "mesa" }),
    { kind: "citizen", id: "mesa" },
  );
  // Nothing addressed: the platter — scale is declined there.
  assert.deepEqual(resolveScaleTarget({}), { kind: "platter" });
  assert.deepEqual(
    resolveScaleTarget({ hoverId: "media-1", currentId: null }),
    { kind: "platter" },
  );
  // The ring addressed is not the platter and holds no scale.
  assert.deepEqual(
    resolveScaleTarget({ hoverId: "audio", currentId: null, ringAddressed: true }),
    { kind: "none" },
  );
});

test("stepRingSpin: yaw and plane pairs drive the one offset; pitch/roll do nothing", () => {
  assert.equal(stepRingSpin(0, "yaw+"), ANGLE_STEP);
  assert.equal(stepRingSpin(0, "yaw-"), -ANGLE_STEP);
  assert.equal(stepRingSpin(12, "spin+"), 12 + ANGLE_STEP);
  assert.equal(stepRingSpin(12, "spin-"), 12 - ANGLE_STEP);
  assert.equal(stepRingSpin(12, "pitch+"), 12);
  assert.equal(stepRingSpin(12, "roll-"), 12);
});

/* ---------------- transforms, hover-first, spin ---------------- */

test("applyTransformKey steps the NEW letter keys, spin included", () => {
  const s0 = createSpaceState("ring");
  // Slice 13-4 (item E): E steps yaw POSITIVE after the swap
  // (it was −ANGLE_STEP before it).
  const s1 = applyTransformKey(s0, "mesa", "e");
  assert.equal(s1.transforms.mesa.yaw, ANGLE_STEP);
  const s2 = applyTransformKey(s1, "mesa", "b");
  assert.equal(s2.transforms.mesa.spin, -ANGLE_STEP);
  // Plane-rotate leaves every other axis untouched.
  assert.equal(s2.transforms.mesa.yaw, ANGLE_STEP);
  assert.equal(s2.transforms.mesa.pitch, 0);
  assert.equal(s2.transforms.mesa.roll, 0);
  assert.equal(s2.transforms.mesa.scale, 1);
  const s3 = applyTransformKey(s2, "mesa", "n");
  assert.equal(s3.transforms.mesa.spin, 0);
  // Scale still clamps through the letter keys.
  const s4 = applyTransformKey(s0, "mesa", "z");
  assert.ok(s4.transforms.mesa.scale < 1);
  // Punctuation keys no longer transform anything.
  assert.equal(applyTransformKey(s0, "mesa", "-"), s0);
  assert.equal(applyTransformKey(s0, "mesa", "/"), s0);
});

test("hover wins: a transform addressed by hover lands on the hovered citizen", () => {
  const s0 = createSpaceState("ring");
  const id = addressedId("drum", "mesa");
  assert.equal(id, "drum");
  // Slice 13-4 (item E): R steps yaw NEGATIVE after the swap
  // (it was +ANGLE_STEP before it) — the landing is unchanged.
  const s1 = applyTransformKey(s0, id, "r");
  assert.equal(s1.transforms.drum.yaw, -ANGLE_STEP);
  assert.equal(s1.transforms.mesa.yaw, 0);
  // And with nothing hovered, the current citizen takes it.
  const s2 = applyTransformKey(s0, addressedId(null, "mesa"), "r");
  assert.equal(s2.transforms.mesa.yaw, -ANGLE_STEP);
});

test("applyTransformOp with a spin op on a state without the field starts from 0", () => {
  const s0 = createSpaceState("ring");
  delete s0.transforms.mesa.spin;
  const s1 = applyTransformOp(s0, "mesa", "spin+");
  assert.equal(s1.transforms.mesa.spin, ANGLE_STEP);
});

/* ---------------- zoom ---------------- */

test("zoomStep: V in, C out, clamped — fine unshifted, coarse on Shift (13-5)", () => {
  // Slice 13-5 (item 2) changed the DEFAULT step: unshifted C/V
  // is the FINE step now (1.045); the old 1.15 sweep survives
  // as the explicit coarse step (Shift+C/V, and the typed
  // command). The clamps are unchanged.
  assert.equal(zoomStep(1, 1), 1 / 1.045);
  assert.equal(zoomStep(1, -1), 1.045);
  assert.equal(zoomStep(1, 1, true), 1 / 1.15);
  assert.equal(zoomStep(1, -1, true), 1.15);
  assert.equal(zoomStep(0.5, 1), 0.5); // at MIN, in stays
  assert.equal(zoomStep(2.0, -1), 2.0); // at MAX, out stays
  assert.equal(zoomStep(0.5, 1, true), 0.5);
  assert.equal(zoomStep(2.0, -1, true), 2.0);
});
