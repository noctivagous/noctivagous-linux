import test from "node:test";
import assert from "node:assert/strict";

import {
  OBJECT_IDS,
  ANCHOR_H,
  PLANE_AXIS,
  CENTRE_Y,
  PROTECTIVE_R,
  FACING,
  citizenSeatOffsets,
  socketRadius,
} from "../src/space-state.js";

/**
 * CITIZEN REGISTRATION — the enumeration guard. Slice 16 added
 * the orrery to most per-citizen tables but missed ANCHOR_H and
 * PLANE_AXIS, which then lived in SpaceView.jsx where no pure
 * test could see them: ANCHOR_H.orrery read undefined, the Rig's
 * citizen seat computed its look target as undefined × 0.55 =
 * NaN, camera.lookAt poisoned the orientation, and entering the
 * orrery blanked the whole viewport while the DOM chrome stayed.
 * These tests enumerate OBJECT_IDS — the citizen list itself —
 * so a seventeenth citizen cannot ship with a silent gap in any
 * of these tables: the moment it joins OBJECTS, it must join
 * every table, or this suite fails.
 *
 * THERE ARE NO EXCEPTIONS today: every citizen carries every
 * entry. If a future citizen legitimately lacks one, name it
 * explicitly in the relevant test below with its reason — never
 * weaken the enumeration to a subset.
 */

test("every citizen has a finite, positive ANCHOR_H (the seat look / anchor height)", () => {
  for (const id of OBJECT_IDS) {
    assert.ok(
      Number.isFinite(ANCHOR_H[id]) && ANCHOR_H[id] > 0,
      `${id}: ANCHOR_H is ${ANCHOR_H[id]} — the entered seat's look target would be NaN`,
    );
  }
});

test("every citizen has a PLANE_AXIS of \"y\" or \"z\"", () => {
  for (const id of OBJECT_IDS) {
    assert.ok(
      PLANE_AXIS[id] === "y" || PLANE_AXIS[id] === "z",
      `${id}: PLANE_AXIS is ${PLANE_AXIS[id]}`,
    );
  }
});

test("every citizen has finite CENTRE_Y, PROTECTIVE_R and FACING entries", () => {
  for (const id of OBJECT_IDS) {
    assert.ok(Number.isFinite(CENTRE_Y[id]), `${id}: CENTRE_Y is ${CENTRE_Y[id]}`);
    assert.ok(
      Number.isFinite(PROTECTIVE_R[id]) && PROTECTIVE_R[id] > 0,
      `${id}: PROTECTIVE_R is ${PROTECTIVE_R[id]}`,
    );
    assert.ok(Number.isFinite(FACING[id]), `${id}: FACING is ${FACING[id]}`);
  }
});

test("seat sanity: the citizen seat's look height and offsets are finite for every citizen", () => {
  for (const id of OBJECT_IDS) {
    for (const scale of [0.5, 1, 2]) {
      // The exact expression the Rig's citizenSeat() feeds to
      // camera.lookAt — the one that went NaN for the orrery.
      const lookY = ANCHOR_H[id] * 0.55 * scale;
      assert.ok(Number.isFinite(lookY), `${id} @ scale ${scale}: look height is ${lookY}`);
      for (const mul of [0.5, 1]) {
        const off = citizenSeatOffsets(scale, mul);
        assert.ok(
          Number.isFinite(off.radial) && Number.isFinite(off.up),
          `${id} @ scale ${scale}, mul ${mul}: offsets ${JSON.stringify(off)}`,
        );
      }
    }
    assert.ok(
      Number.isFinite(socketRadius(id)) && socketRadius(id) > 0,
      `${id}: socketRadius is ${socketRadius(id)}`,
    );
  }
});

test("the orrery's own entries (the regression that shipped)", () => {
  assert.equal(ANCHOR_H.orrery, 26);
  assert.equal(PLANE_AXIS.orrery, "y");
  assert.equal(CENTRE_Y.orrery, 12.95);
  assert.equal(PROTECTIVE_R.orrery, 24.25);
  assert.equal(FACING.orrery, 0);
});
