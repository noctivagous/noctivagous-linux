import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveDollyTarget,
  citizenSeatScale,
  citizenSeatOffsets,
  citizenSeatDistance,
  zoomStep,
  ZOOM_MIN,
  CITIZEN_SEAT_MIN,
} from "../src/space-state.js";

/* The dolly's target (C/V): hover wins, the opened citizen next,
   the world dolly when neither. "Opened" is the state F's open
   action produces: the citizen is current AND its card stands
   open (cardId === currentId). */

test("dolly target: a hovered citizen wins over the opened one", () => {
  assert.equal(
    resolveDollyTarget({ hoverId: "tray", currentId: "mesa", cardId: "mesa" }),
    "tray",
  );
});

test("dolly target: the opened citizen when nothing is hovered", () => {
  assert.equal(
    resolveDollyTarget({ hoverId: null, currentId: "mesa", cardId: "mesa" }),
    "mesa",
  );
});

test("dolly target: null when neither hovered nor opened (the world dolly)", () => {
  assert.equal(resolveDollyTarget({ hoverId: null, currentId: null, cardId: null }), null);
  assert.equal(resolveDollyTarget({}), null);
  assert.equal(resolveDollyTarget(), null);
});

test("dolly target: current but not open is not a dolly target", () => {
  // Tab-cycled onto a citizen: current, but F never opened it.
  assert.equal(resolveDollyTarget({ hoverId: null, currentId: "mesa", cardId: null }), null);
});

test("dolly target: a card open on a different citizen than the current one does not count", () => {
  assert.equal(resolveDollyTarget({ hoverId: null, currentId: "tray", cardId: "mesa" }), null);
});

test("dolly target: hovering a non-citizen (the ring's app item) is not a citizen hover", () => {
  assert.equal(
    resolveDollyTarget({ hoverId: "audio", currentId: "mesa", cardId: "mesa" }),
    "mesa",
  );
  assert.equal(resolveDollyTarget({ hoverId: "audio", currentId: null, cardId: null }), null);
});

/* The citizen seat's pure math: mul 1 is the F seat itself; the
   dolly remaps its inward range so the deepest step stands at
   CITIZEN_SEAT_MIN × the F-seat distance. */

test("citizen seat: the F seat at rest (mul 1), offsets as shipped", () => {
  assert.deepEqual(citizenSeatOffsets(1, 1), { radial: 72, up: 34 });
  assert.deepEqual(citizenSeatOffsets(2, 1), { radial: 102, up: 43 });
  assert.equal(citizenSeatDistance(1, 1), Math.hypot(72, 34));
});

test("citizen seat scale: 1 at rest, the floor at the dolly's deepest step, pass-through above 1", () => {
  assert.equal(citizenSeatScale(1), 1);
  assert.equal(citizenSeatScale(ZOOM_MIN), CITIZEN_SEAT_MIN);
  assert.equal(CITIZEN_SEAT_MIN, 0.4);
  assert.equal(citizenSeatScale(2), 2);
  // A multiplier below the dolly's own floor cannot push the seat deeper.
  assert.equal(citizenSeatScale(0.2), CITIZEN_SEAT_MIN);
});

test("citizen seat scale: monotonic across the whole dolly range", () => {
  let prev = -Infinity;
  for (let mul = ZOOM_MIN; mul <= 2.0001; mul += 0.05) {
    const s = citizenSeatScale(mul);
    assert.ok(s > prev, `scale rises with the multiplier (${mul})`);
    prev = s;
  }
});

test("dolly in from the opened seat: V steps move the seat monotonically inward to the floor factor", () => {
  const rest = citizenSeatDistance(1, 1);
  let mul = 1;
  let prev = rest;
  let steps = 0;
  while (mul > ZOOM_MIN) {
    mul = zoomStep(mul, 1);
    steps += 1;
    const d = citizenSeatDistance(1, mul);
    assert.ok(d < prev, `step ${steps}: the seat moves inward (${d} < ${prev})`);
    prev = d;
  }
  assert.ok(steps >= 4, "several V steps of travel from the F seat");
  assert.equal(mul, ZOOM_MIN);
  const closest = citizenSeatDistance(1, ZOOM_MIN);
  assert.ok(
    Math.abs(closest - CITIZEN_SEAT_MIN * rest) < 1e-9,
    `closest approach is ${CITIZEN_SEAT_MIN} × the F-seat distance`,
  );
});

test("dolly out restores: C steps move the seat monotonically back out through the same range", () => {
  // Slice 13-5 (item 2): this loop measures the SWEEP's travel,
  // so it steps with the COARSE step explicitly (Shift+C) — the
  // unshifted step is fine now (1.045) and needs more than the
  // old 12 presses to cross the same range (asserted below).
  const rest = citizenSeatDistance(1, 1);
  let mul = ZOOM_MIN;
  let prev = citizenSeatDistance(1, mul);
  let steps = 0;
  while (mul < 1 && steps < 12) {
    mul = zoomStep(mul, -1, true);
    steps += 1;
    const d = citizenSeatDistance(1, mul);
    assert.ok(d > prev, `step ${steps}: the seat moves back out (${d} > ${prev})`);
    prev = d;
  }
  assert.ok(mul >= 1, "Shift+C steps return the multiplier to rest");
  assert.ok(prev >= rest * 0.999, "and the seat distance with it");
  // The fine step crosses the same range monotonically, in
  // strictly more presses than the sweep.
  let fineMul = ZOOM_MIN;
  let fineSteps = 0;
  let finePrev = citizenSeatDistance(1, fineMul);
  while (fineMul < 1 && fineSteps < 40) {
    fineMul = zoomStep(fineMul, -1);
    fineSteps += 1;
    const d = citizenSeatDistance(1, fineMul);
    assert.ok(d > finePrev, `fine step ${fineSteps}: the seat moves back out`);
    finePrev = d;
  }
  assert.ok(fineMul >= 1, "fine C steps still reach rest");
  assert.ok(fineSteps > steps, `fine takes more presses (${fineSteps} > ${steps})`);
});

test("citizen seat: the floor factor is the same at any citizen scale", () => {
  for (const sc of [0.5, 1, 2, 2.5]) {
    const ratio = citizenSeatDistance(sc, ZOOM_MIN) / citizenSeatDistance(sc, 1);
    assert.ok(Math.abs(ratio - CITIZEN_SEAT_MIN) < 1e-12, `scale ${sc}: ratio ${ratio}`);
  }
});
