import test from "node:test";
import assert from "node:assert/strict";

import {
  OBJECTS,
  createSpaceState,
  applyTransformKey,
  defaultTransform,
  resetTransform,
  resolveRotateTarget,
  captureEntrySeat,
  entrySeatScale,
  citizenSeatOffsets,
  citizenSeatDistance,
  resolveDollyFocus,
  FACING,
  facingYawFor,
} from "../src/space-state.js";
import {
  createMarks,
  toggleMark,
  isMarked,
  marksFor,
  countMarks,
  totalMarks,
} from "../src/subnode-marks.js";
import { resolveKeyboard } from "../src/keyboard.js";

const labelOf = (resolved, code) =>
  resolved.caps.find((c) => c.code === code)?.binding?.label ?? null;

/* ---------------- item A: the entry seat basis ---------------- */

test("captureEntrySeat: a basis is { id, scale, layout }, and only for a real citizen at a real scale", () => {
  assert.deepEqual(captureEntrySeat("mesa", 2, "ring"), { id: "mesa", scale: 2, layout: "ring" });
  assert.deepEqual(captureEntrySeat("mesa", 1), { id: "mesa", scale: 1, layout: null });
  assert.equal(captureEntrySeat(null, 1), null);
  assert.equal(captureEntrySeat("media-1", 1), null); // not a citizen
  assert.equal(captureEntrySeat("mesa", 0), null);
  assert.equal(captureEntrySeat("mesa", NaN), null);
  assert.equal(captureEntrySeat("mesa", "big"), null);
});

test("entrySeatScale: the entered citizen's seat scale is FROZEN at entry, whatever its live scale does", () => {
  const basis = captureEntrySeat("mesa", 2, "ring");
  // MAGNIFY while entered moves the live scale both ways; the
  // seat's scale — and so the seat distance at multiplier 1 —
  // never follows it.
  for (const live of [0.4, 1, 1.7, 2.5]) {
    assert.equal(entrySeatScale(basis, "mesa", live), 2, `live ${live}`);
    assert.equal(
      citizenSeatDistance(entrySeatScale(basis, "mesa", live), 1),
      citizenSeatDistance(2, 1),
    );
  }
  // Another citizen's seat, and any seat with no basis, keep
  // the live scale exactly as before the slice.
  assert.equal(entrySeatScale(basis, "tray", 0.5), 0.5);
  assert.equal(entrySeatScale(null, "mesa", 1.4), 1.4);
});

test("entrySeatScale: the dolly multiplier composes onto the BASIS, not the live scale", () => {
  const basis = captureEntrySeat("mesa", 2, "ring");
  const sc = entrySeatScale(basis, "mesa", 0.9); // live scale has since moved
  assert.deepEqual(citizenSeatOffsets(sc, 0.5), citizenSeatOffsets(2, 0.5));
  assert.deepEqual(citizenSeatOffsets(sc, 2), citizenSeatOffsets(2, 2));
  assert.notDeepEqual(citizenSeatOffsets(sc, 0.5), citizenSeatOffsets(0.9, 0.5));
});

test("resolveDollyFocus while entered: only the entered citizen's own elements resolve", () => {
  const entered = { enteredId: "mesa", currentId: "mesa", cardId: "mesa" };
  // A sub-node anchor of the ENTERED citizen: honoured.
  assert.deepEqual(
    resolveDollyFocus({
      ...entered,
      subAnchor: { point: [1, 2, 3], radius: 4 }, subAnchorObjectId: "mesa",
    }),
    { kind: "point", via: "sub", point: [1, 2, 3], radius: 4 },
  );
  // A sub-node anchor of ANOTHER citizen: rejected — and the
  // other citizen's citizen focus behind it is rejected too,
  // and the cursor point (not on the entered citizen) with it:
  // the press falls to the world dolly, storing nothing.
  assert.deepEqual(
    resolveDollyFocus({
      ...entered,
      subAnchor: { point: [1, 2, 3], radius: 4 }, subAnchorObjectId: "tray",
      hoverId: "tray", cursorPoint: [9, 9, 9], cursorOnEntered: false,
    }),
    { kind: "world" },
  );
  // The entered citizen itself, hovered: its seat focus stands.
  assert.deepEqual(
    resolveDollyFocus({ ...entered, hoverId: "mesa" }),
    { kind: "citizen", id: "mesa" },
  );
  // The cursor point: while entered it is honoured only when
  // it lies ON the entered citizen. (With the card standing,
  // the citizen branch above usually resolves first — the
  // opened citizen outranks the raw point — so this case is
  // stated without the card shortcut, where the point is the
  // only candidate.)
  assert.deepEqual(
    resolveDollyFocus({
      enteredId: "mesa", currentId: "mesa", cardId: null,
      cursorPoint: [5, 6, 7], cursorOnEntered: true,
    }),
    { kind: "point", via: "cursor", point: [5, 6, 7], radius: 0 },
  );
  assert.deepEqual(
    resolveDollyFocus({
      enteredId: "mesa", currentId: "mesa", cardId: null,
      cursorPoint: [5, 6, 7], cursorOnEntered: false,
    }),
    { kind: "world" },
  );
});

test("resolveDollyFocus with nobody entered: slice 13-3's resolution, unchanged", () => {
  assert.deepEqual(
    resolveDollyFocus({
      subAnchor: { point: [1, 2, 3], radius: 4 }, subAnchorObjectId: "tray",
      hoverId: "tray", currentId: "mesa", cardId: "mesa",
    }),
    { kind: "point", via: "sub", point: [1, 2, 3], radius: 4 },
  );
  assert.deepEqual(
    resolveDollyFocus({ hoverId: "tray", currentId: "mesa", cardId: null }),
    { kind: "citizen", id: "tray" },
  );
  assert.deepEqual(resolveDollyFocus({}), { kind: "world" });
});

/* ---------------- item B: reset ---------------- */

test("resetTransform: rotation, plane spin and scale return to the build default — nothing else moves", () => {
  let s = createSpaceState("ring");
  s = applyTransformKey(s, "mesa", "e"); // yaw
  s = applyTransformKey(s, "mesa", "w"); // pitch
  s = applyTransformKey(s, "mesa", "y"); // roll
  s = applyTransformKey(s, "mesa", "n"); // plane spin
  s = applyTransformKey(s, "mesa", "x"); // magnify
  const turned = s.transforms.mesa;
  assert.ok(turned.yaw !== 0 && turned.pitch !== 0 && turned.roll !== 0
    && turned.spin !== 0 && turned.scale !== 1, "the record really is turned");
  const posBefore = s.positions.mesa;
  const trayBefore = s.transforms.tray;
  const out = resetTransform(s, "mesa");
  assert.deepEqual(out.transforms.mesa, defaultTransform());
  assert.deepEqual(out.transforms.mesa, { yaw: 0, pitch: 0, roll: 0, scale: 1, spin: 0 });
  // Position and every other citizen are the very same records.
  assert.equal(out.positions.mesa, posBefore);
  assert.equal(out.transforms.tray, trayBefore);
  // The input state was not mutated.
  assert.equal(s.transforms.mesa, turned);
  // Unknown ids pass through untouched.
  assert.equal(resetTransform(s, "nope"), s);
  assert.equal(resetTransform(s, null), s);
});

test("reset's target is the rotate cluster's resolution: hovered citizen wins, else the current one", () => {
  assert.deepEqual(
    resolveRotateTarget({ hoverId: "tray", currentId: "mesa", ringAddressed: false }),
    { kind: "citizen", id: "tray" },
  );
  assert.deepEqual(
    resolveRotateTarget({ hoverId: null, currentId: "mesa", ringAddressed: false }),
    { kind: "citizen", id: "mesa" },
  );
});

/* ---------------- item C: the mark index ---------------- */

test("marks: toggle on, toggle off, per-citizen, immutable", () => {
  const m0 = createMarks();
  assert.deepEqual(m0, {});
  const m1 = toggleMark(m0, "mesa", "noctivagous-linux/demo-de");
  assert.equal(isMarked(m1, "mesa", "noctivagous-linux/demo-de"), true);
  assert.equal(countMarks(m1, "mesa"), 1);
  assert.deepEqual(m0, {}, "the input was not mutated");
  // A second citizen's index is independent.
  const m2 = toggleMark(m1, "tray", "noctivagous-linux/demo-de");
  assert.equal(countMarks(m2, "mesa"), 1);
  assert.equal(countMarks(m2, "tray"), 1);
  assert.equal(totalMarks(m2), 2);
  // Insertion order is the listing order.
  const m3 = toggleMark(m2, "mesa", "noctivagous-linux/refs");
  assert.deepEqual(marksFor(m3, "mesa"), ["noctivagous-linux/demo-de", "noctivagous-linux/refs"]);
  // Toggling a marked node unmarks it; the citizen's last mark
  // removes its key, so the index returns to the empty object.
  const m4 = toggleMark(m3, "mesa", "noctivagous-linux/demo-de");
  assert.equal(isMarked(m4, "mesa", "noctivagous-linux/demo-de"), false);
  assert.deepEqual(marksFor(m4, "mesa"), ["noctivagous-linux/refs"]);
  const m5 = toggleMark(toggleMark(m4, "mesa", "noctivagous-linux/refs"), "tray", "noctivagous-linux/demo-de");
  assert.deepEqual(m5, {});
  assert.equal(totalMarks(m5), 0);
  // No-ops stay no-ops.
  assert.equal(toggleMark(m0, null, "x"), m0);
  assert.equal(toggleMark(m0, "mesa", null), m0);
  assert.deepEqual(marksFor(null, "mesa"), []);
  assert.equal(isMarked(null, "mesa", "x"), false);
  assert.equal(countMarks(undefined, "mesa"), 0);
});

/* ---------------- item D: first-open facing ---------------- */

test("FACING: the audit's table — the tangle's front is its root side (−Z); every other front is +Z or none", () => {
  for (const o of OBJECTS) {
    assert.equal(FACING[o.id], o.id === "tangle" ? 180 : 0, o.id);
  }
});

test("facingYawFor: the yaw turns the built front onto the entry camera on the radial", () => {
  const s = createSpaceState("ring");
  // Devices at its ring plot: front +Z, so the yaw is exactly
  // the plot's azimuth — and Ry(yaw) then points +Z along the
  // radial (the direction from the citizen to its entry seat).
  const dp = s.positions.devices;
  const dYaw = facingYawFor("devices", dp);
  const az = Math.atan2(dp.x, dp.z);
  assert.ok(Math.abs(dYaw - az * 180 / Math.PI) < 1e-9);
  const dFront = [Math.sin(dYaw * Math.PI / 180), Math.cos(dYaw * Math.PI / 180)];
  const dLen = Math.hypot(dp.x, dp.z);
  assert.ok(Math.abs(dFront[0] - dp.x / dLen) < 1e-9, "front x on the radial");
  assert.ok(Math.abs(dFront[1] - dp.z / dLen) < 1e-9, "front z on the radial");
  // The tangle at its ring plot: its front is −Z, so the yaw
  // is the azimuth minus 180 — and Ry(yaw) points −Z along the
  // radial instead.
  const tp = s.positions.tangle;
  const tYaw = facingYawFor("tangle", tp);
  const tFront = [-Math.sin(tYaw * Math.PI / 180), -Math.cos(tYaw * Math.PI / 180)];
  const tLen = Math.hypot(tp.x, tp.z);
  assert.ok(Math.abs(tFront[0] - tp.x / tLen) < 1e-9, "tangle front x on the radial");
  assert.ok(Math.abs(tFront[1] - tp.z / tLen) < 1e-9, "tangle front z on the radial");
  // Standing at the front of the platter, a +Z-front citizen
  // needs no turn at all; the tangle needs the half-turn.
  assert.equal(facingYawFor("devices", { x: 0, z: 130 }), 0);
  assert.equal(facingYawFor("tangle", { x: 0, z: 130 }), -180);
  // No position: the azimuth is taken as 0.
  assert.equal(facingYawFor("tangle", null), -180);
  assert.equal(facingYawFor("mesa", null), 0);
});

/* ---------------- items B + C + E: the keyboard panel ---------------- */

test("keyboard: copy on L, RESET on H, and L stays the knot's address in label scope", () => {
  const kb = resolveKeyboard({ scope: "space" });
  assert.equal(labelOf(kb, "KeyL"), "COPY");
  assert.equal(labelOf(kb, "KeyH"), "RESET");
  // The U bargain: in label mode the operators suspend — L is
  // the knot's address and H the horizon skyline's.
  const labels = resolveKeyboard({ scope: "labels" });
  assert.equal(labelOf(labels, "KeyL"), "TREFOIL DATA KNOT");
  assert.equal(labelOf(labels, "KeyH"), "HORIZON SKYLINE");
});

test("keyboard: Enter reads MARK while a sub-node is hovered, COMMAND LINE otherwise", () => {
  assert.equal(labelOf(resolveKeyboard({ scope: "space" }), "Enter"), "COMMAND LINE");
  assert.equal(
    labelOf(resolveKeyboard({ scope: "space", markAvailable: true }), "Enter"),
    "MARK",
  );
  // Label scope has no mark press: Enter still arms the line.
  assert.equal(
    labelOf(resolveKeyboard({ scope: "labels", markAvailable: true }), "Enter"),
    "COMMAND LINE",
  );
});

test("keyboard: E's EXPAND cap still wins over its yaw cap", () => {
  const kb = resolveKeyboard({ scope: "space", rotateTarget: "citizen", eKey: "expand" });
  assert.equal(labelOf(kb, "KeyE"), "FULL PLATTER");
  assert.equal(labelOf(kb, "KeyR"), "YAW -");
});
