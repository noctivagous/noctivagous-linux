import test from "node:test";
import assert from "node:assert/strict";

import {
  PLANETS, planetBySlug, TOTAL_PERIOD_DAYS,
  orbitRadius, planetDisplayRadius, PLANET_SIZE_FLOOR,
  ORBIT_R_MIN, ORBIT_R_MAX,
  planetAngleAt, planetPositionAt,
  MOON_PERIOD_DAYS, MOON_PHASE0_DEG, SUN_AZIMUTH_DEG, EARTH_Y,
  moonAngleAt, moonPositionAt, moonPhaseAt, phaseNameFor, illuminatedFraction,
  ARM_CENTRE_Y, ARM_R, ARM_FIXED_R, ARM_BAND_W, ARM_OUTER_R,
  SIDEREAL_DAY_DAYS, MARCH_EQUINOX_DAY, YEAR_DAYS,
  EQUATOR_TICKS, ECLIPTIC_TICKS,
  cageAngleAt, eclipticLongitudeAt, sunBeadPositionAt,
  EARTH_TILT_DEG,
  modelDate, ORRERY_SPEED_DEFAULT, ORRERY_SPEED_MIN, ORRERY_SPEED_MAX,
} from "../src/orrery.js";
import {
  OBJECTS, OBJECT_IDS, CENTRE_Y, PROTECTIVE_R, FACING,
  socketRadius, labelForIndex, LAYOUTS, applyLayout, createSpaceState,
} from "../src/space-state.js";
import {
  SUBNODE_OBJECT_IDS, isSubnodeObject,
  subnodeById, subnodeRootOf, subnodesFor, subnodeParentOf,
} from "../src/subnodes.js";
import { resolveFAction } from "../src/space-state.js";

/* Slice 16 — the ORRERY citizen: orrery.js's pure math (the
   clock's exactness, the log scale's shape, the phase geometry
   at its cardinal points), the provider's two datasets, and
   the citizen's registration (label, envelope, layouts). */

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ---------------- the planet table ---------------- */

test("the table is NASA/JPL's eight, in order, with the fact-sheet figures", () => {
  assert.deepEqual(PLANETS.map((p) => p.slug),
    ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]);
  const earth = planetBySlug("earth");
  assert.equal(earth.au, 1.0);
  assert.equal(earth.periodDays, 365.256);
  assert.equal(earth.radiusEarth, 1.0);
  assert.equal(earth.moons, 1);
  // Periods strictly increase outward — the table's spine.
  for (let i = 1; i < PLANETS.length; i++) {
    assert.ok(PLANETS[i].periodDays > PLANETS[i - 1].periodDays, PLANETS[i].slug);
    assert.ok(PLANETS[i].au > PLANETS[i - 1].au, PLANETS[i].slug);
  }
  assert.ok(TOTAL_PERIOD_DAYS > 100000 && TOTAL_PERIOD_DAYS < 120000);
  // The starting phases are spread — no opening conjunction line.
  const phases = PLANETS.map((p) => p.phase0Deg).sort((a, b) => a - b);
  for (let i = 1; i < phases.length; i++) assert.ok(phases[i] - phases[i - 1] >= 25);
});

/* ---------------- the log scale ---------------- */

test("orbit radii: log-scaled, monotonic, endpoints exact, Neptune inside the plot", () => {
  assert.ok(near(orbitRadius(0.387), ORBIT_R_MIN));
  assert.ok(near(orbitRadius(30.069), ORBIT_R_MAX));
  let prev = -Infinity;
  for (const p of PLANETS) {
    const r = orbitRadius(p.au);
    assert.ok(r > prev, `${p.slug} ring out of order`);
    prev = r;
  }
  // The outermost ring plus the largest body that rides any
  // ring still fits the citizens' glass plot plate (r 21–22)
  // and the plinth (r 20.5).
  assert.ok(ORBIT_R_MAX + planetDisplayRadius(3.883) < 20.5, "Neptune inside the plinth");
  // Log, not linear: equal RATIOS get equal plot spacing —
  // a doubling at 1 AU spans the same ring gap as a doubling
  // at 10 AU, though the AU gaps differ tenfold.
  const inner = orbitRadius(2) - orbitRadius(1);
  const outer = orbitRadius(20) - orbitRadius(10);
  assert.ok(near(inner, outer, 1e-9), `doubling spacing ${inner.toFixed(3)} vs ${outer.toFixed(3)}`);
});

test("display sizes: exaggerated, floored, true order preserved", () => {
  for (const p of PLANETS) {
    assert.ok(planetDisplayRadius(p.radiusEarth) >= PLANET_SIZE_FLOOR, p.slug);
  }
  assert.ok(planetDisplayRadius(0.01) === PLANET_SIZE_FLOOR, "the floor binds below Mercury");
  const bySize = [...PLANETS].sort((a, b) => a.radiusEarth - b.radiusEarth);
  for (let i = 1; i < bySize.length; i++) {
    assert.ok(
      planetDisplayRadius(bySize[i].radiusEarth) >= planetDisplayRadius(bySize[i - 1].radiusEarth),
      "display order follows true order",
    );
  }
  assert.ok(planetDisplayRadius(11.209) > planetDisplayRadius(1.0), "Jupiter reads largest-class");
});

/* ---------------- the clock ---------------- */

test("period return: after exactly its period a planet is back at its start", () => {
  for (const p of PLANETS) {
    const a0 = planetAngleAt(p, 0);
    assert.ok(near(planetAngleAt(p, p.periodDays), a0, 1e-6), p.slug);
    assert.ok(near(planetAngleAt(p, 2 * p.periodDays + 37), planetAngleAt(p, 37), 1e-6), p.slug);
    const [x0, y0, z0] = planetPositionAt(p, 0);
    const [x1, y1, z1] = planetPositionAt(p, p.periodDays);
    assert.ok(near(x0, x1, 1e-6) && near(y0, y1) && near(z0, z1, 1e-6), `${p.slug} position returns`);
    // And it stands on its ring, in the orbital plane.
    assert.ok(near(Math.hypot(x0, z0), orbitRadius(p.au)), `${p.slug} on its ring`);
  }
  // Mercury visibly outruns Neptune: in one Earth year Mercury
  // laps the circle more than four times, Neptune barely moves.
  assert.ok(planetAngleAt(planetBySlug("mercury"), 365.256) !== undefined);
  const neptuneDrift = ((planetAngleAt(planetBySlug("neptune"), 365.256)
    - planetBySlug("neptune").phase0Deg) + 360) % 360;
  assert.ok(neptuneDrift < 3, `Neptune drifts ${neptuneDrift.toFixed(2)}° in a year`);
});

test("the model date: J2000 plus model days", () => {
  assert.equal(modelDate(0), "2000-01-01");
  assert.equal(modelDate(365.256), "2000-12-31");
  assert.equal(modelDate(366), "2001-01-01");
});

/* ---------------- the Moon's phase ---------------- */

test("phase names at the four cardinal geometries", () => {
  // Drive the geometry directly: with the sun at azimuth 0,
  // a model day whose Moon angle is φ puts the phase at φ.
  const dayForAngle = (phiDeg) =>
    (((phiDeg - MOON_PHASE0_DEG) % 360) + 360) % 360 / 360 * MOON_PERIOD_DAYS;
  const at = (phiDeg) => moonPhaseAt(dayForAngle(phiDeg), SUN_AZIMUTH_DEG);
  // New: the Moon between Earth and Sun.
  assert.equal(at(0).name, "New");
  assert.ok(near(at(0).fraction, 0));
  // First quarter: 90° on, half lit.
  assert.equal(at(90).name, "First Quarter");
  assert.ok(near(at(90).fraction, 0.5));
  // Full: opposite the Sun.
  assert.equal(at(180).name, "Full");
  assert.ok(near(at(180).fraction, 1));
  // Last quarter.
  assert.equal(at(270).name, "Last Quarter");
  assert.ok(near(at(270).fraction, 0.5));
  // The in-between sectors, in the standing order.
  assert.equal(at(45).name, "Waxing Crescent");
  assert.equal(at(135).name, "Waxing Gibbous");
  assert.equal(at(225).name, "Waning Gibbous");
  assert.equal(at(315).name, "Waning Crescent");
  // The geometry itself, checked spatially: at new, the Moon's
  // position is on the sun's side (+Z); at full, opposite.
  const newPos = moonPositionAt(dayForAngle(0));
  assert.ok(newPos[2] > 0 && near(Math.abs(newPos[0]), 0, 1e-6), "new moon stands toward the sun marker");
  const fullPos = moonPositionAt(dayForAngle(180));
  assert.ok(fullPos[2] < 0, "full moon stands opposite");
});

test("phase helpers: fraction is (1 − cos φ)/2 and the name wraps at the year seam", () => {
  assert.ok(near(illuminatedFraction(0), 0));
  assert.ok(near(illuminatedFraction(180), 1));
  assert.equal(phaseNameFor(359), "New");
  assert.equal(phaseNameFor(-10), "New");
  // One full sidereal month later the phase repeats.
  const a = moonPhaseAt(100);
  const b = moonPhaseAt(100 + MOON_PERIOD_DAYS);
  assert.equal(a.name, b.name);
  assert.ok(near(a.fraction, b.fraction, 1e-9));
  // The Moon returns to its start after exactly its period.
  assert.ok(near(moonAngleAt(MOON_PERIOD_DAYS), MOON_PHASE0_DEG, 1e-6));
});

test("the speed parameter's stated range and default", () => {
  assert.equal(ORRERY_SPEED_DEFAULT, 2);
  assert.ok(ORRERY_SPEED_MIN < ORRERY_SPEED_DEFAULT && ORRERY_SPEED_DEFAULT < ORRERY_SPEED_MAX);
  // At the default, the Moon's cycle takes ~14 s of wall time.
  const cycleSeconds = MOON_PERIOD_DAYS / ORRERY_SPEED_DEFAULT;
  assert.ok(cycleSeconds > 10 && cycleSeconds < 20, `cycle ${cycleSeconds.toFixed(1)}s`);
});

/* ---------------- the provider ---------------- */

test("provider (solar): the sun is the root, the planets its children, values are periods", () => {
  assert.ok(isSubnodeObject("orrery"));
  assert.ok(SUBNODE_OBJECT_IDS.includes("orrery"));
  const root = subnodeRootOf("orrery", null, "genealogy", "solar");
  assert.equal(root.id, "orrery");
  assert.equal(root.name, "the solar system");
  assert.ok(near(root.value, TOTAL_PERIOD_DAYS));
  const sun = subnodeById("orrery", "orrery", null, "genealogy", "solar");
  assert.equal(sun.name, "Sun");
  assert.equal(sun.depth, 0);
  assert.equal(sun.isLeaf, false);
  const earth = subnodeById("orrery", "orrery/earth", null, "genealogy", "solar");
  assert.equal(earth.name, "Earth");
  assert.equal(earth.value, 365.256);
  assert.equal(earth.depth, 1);
  assert.equal(earth.parentId, "orrery");
  assert.deepEqual(earth.path, ["Sun", "Earth"]);
  assert.ok(near(earth.share, 365.256 / TOTAL_PERIOD_DAYS));
  const rendered = subnodesFor("orrery", null, "genealogy", "solar");
  assert.equal(rendered.length, 8);
  assert.ok(near(rendered.reduce((s, n) => s + n.share, 0), 1), "planet shares sum to the whole");
  assert.equal(subnodeParentOf("orrery", "orrery/neptune", "genealogy", "solar"), "orrery");
  // The Earth–Moon nodes are not addresses in the solar dressing.
  assert.equal(subnodeById("orrery", "orrery/earth/moon", null, "genealogy", "solar"), null);
});

test("provider (earth–moon): Earth the root, the Moon its child", () => {
  const root = subnodeRootOf("orrery", null, "genealogy", "earthmoon");
  assert.equal(root.id, "orrery/earth");
  assert.equal(root.name, "the Earth–Moon system");
  assert.ok(near(root.value, 365.256 + MOON_PERIOD_DAYS));
  const moon = subnodeById("orrery", "orrery/earth/moon", null, "genealogy", "earthmoon");
  assert.equal(moon.name, "Moon");
  assert.equal(moon.value, MOON_PERIOD_DAYS);
  assert.equal(moon.depth, 1);
  assert.deepEqual(moon.path, ["Earth", "Moon"]);
  assert.ok(near(moon.share, MOON_PERIOD_DAYS / (365.256 + MOON_PERIOD_DAYS)));
  const rendered = subnodesFor("orrery", null, "genealogy", "earthmoon");
  assert.deepEqual(rendered.map((n) => n.id), ["orrery/earth/moon"]);
  // A planet of the solar dressing is not an address here.
  assert.equal(subnodeById("orrery", "orrery/mars", null, "genealogy", "earthmoon"), null);
});

test("F on the sun is the root no-op; F on a planet focuses it (no descent)", () => {
  assert.deepEqual(
    resolveFAction({ currentId: "orrery", subId: "orrery", subRoot: true, subLeaf: false, subTier: 0 }),
    { type: "rootNoop", targetId: "orrery" },
  );
  assert.deepEqual(
    resolveFAction({ currentId: "orrery", subId: "orrery/mars", subLeaf: true, subTier: 1 }),
    { type: "partFocus", targetId: "orrery", partId: "orrery/mars" },
  );
});

/* ---------------- the citizen's registration ---------------- */

test("registration: sixteenth citizen, label R, envelope measured on the built miniature", () => {
  assert.equal(OBJECTS.length, 16);
  assert.equal(OBJECTS[15].id, "orrery");
  assert.equal(labelForIndex(15), "R");
  assert.equal(FACING.orrery, 0);
  // CENTRE_Y is the midpoint of the LARGEST dressing's bounds
  // (the armillary, 0..25.9 — the meridian band's top), the
  // book's page-out precedent. It was 6.1 when the Earth–Moon
  // dressing (0..12.2) was the largest; the armillary extension
  // re-measured it, and the socket grew 22.58 → 22.83 with it.
  assert.ok(near(CENTRE_Y.orrery, 12.95));
  // The binding point is STILL the plinth's bottom rim
  // (r 20.5, y 0) about the pivot; every other part of all
  // three dressings reaches less (the orrery envelope test in
  // sockets.test.mjs holds the table to the point).
  assert.ok(near(PROTECTIVE_R.orrery, Math.hypot(20.5, CENTRE_Y.orrery), 0.01));
  const parts = [
    ["sun marker + its sphere (EM)", Math.hypot(19 + 1.1, EARTH_Y - CENTRE_Y.orrery)],
    ["Neptune at its ring edge + its size", Math.hypot(ORBIT_R_MAX + planetDisplayRadius(3.883), 4.4 - CENTRE_Y.orrery)],
    ["Saturn's ring edge", Math.hypot(orbitRadius(9.537) + planetDisplayRadius(9.449) * 2.35, 4.4 - CENTRE_Y.orrery)],
    ["the axis rod's top end (EM)", Math.hypot(6.5 * Math.sin(23.44 * Math.PI / 180), (EARTH_Y + 6.5 * Math.cos(23.44 * Math.PI / 180)) - CENTRE_Y.orrery)],
    ["the Moon at its ring edge (EM)", Math.hypot(13.5 + 1.4, EARTH_Y - CENTRE_Y.orrery)],
    ["the meridian band's top (ARM)", (ARM_CENTRE_Y + ARM_OUTER_R) - CENTRE_Y.orrery],
    ["the horizon band's rim (ARM)", Math.hypot(ARM_OUTER_R, ARM_CENTRE_Y - CENTRE_Y.orrery)],
    ["the cage's far reach (ARM)", (ARM_R + ARM_BAND_W / 2) + Math.abs(ARM_CENTRE_Y - CENTRE_Y.orrery)],
    ["the stand pillar's top corner (ARM)", Math.hypot(14.25, ARM_CENTRE_Y - CENTRE_Y.orrery, 0.35)],
  ];
  for (const [name, d] of parts) {
    assert.ok(d <= PROTECTIVE_R.orrery + 0.01, `${name} reaches ${d.toFixed(2)}`);
  }
  assert.ok(near(socketRadius("orrery"), 22.83, 0.02), `socket ${socketRadius("orrery")}`);
});


/* ---------------- the armillary sphere ---------------- */

test("the cage's clock: one turn per sidereal day, one extra turn per year", () => {
  assert.equal(cageAngleAt(0), 0);
  // One sidereal day later the cage is back where it stood.
  assert.ok(near(cageAngleAt(SIDEREAL_DAY_DAYS), 0, 1e-6));
  assert.ok(near(cageAngleAt(SIDEREAL_DAY_DAYS / 2), 180, 1e-6));
  assert.ok(near(cageAngleAt(3 * SIDEREAL_DAY_DAYS + SIDEREAL_DAY_DAYS / 4), 90, 1e-6));
  // The sidereal day is the shorter day: after one SOLAR day
  // the cage is already ~1° past its start.
  const past = cageAngleAt(1);
  assert.ok(past > 0.9 && past < 1.1, `cage is ${past.toFixed(3)}° past after one solar day`);
  // And over one year the cage turns 366 times to the sun's
  // 365 — the extra turn is the bead's annual circuit.
  assert.equal(Math.floor(YEAR_DAYS / SIDEREAL_DAY_DAYS), 366);
});

test("the bead's year: longitude runs from the March equinox, one circuit per year", () => {
  assert.ok(near(eclipticLongitudeAt(MARCH_EQUINOX_DAY), 0, 1e-9));
  assert.ok(near(eclipticLongitudeAt(MARCH_EQUINOX_DAY + YEAR_DAYS), 0, 1e-6));
  assert.ok(near(eclipticLongitudeAt(MARCH_EQUINOX_DAY + YEAR_DAYS / 4), 90, 1e-6));
  assert.ok(near(eclipticLongitudeAt(MARCH_EQUINOX_DAY + YEAR_DAYS / 2), 180, 1e-6));
  assert.ok(near(eclipticLongitudeAt(MARCH_EQUINOX_DAY - YEAR_DAYS / 4), 270, 1e-6));
});

test("the bead at the equinox sits on BOTH bands; its declination follows sin(tilt)·sin(λ)", () => {
  // The polar axis in the citizen's frame: +Y tipped toward
  // +Z by the tilt (orrery.js's mount). A point's component
  // along it is its declination arm.
  const tilt = (EARTH_TILT_DEG * Math.PI) / 180;
  const polar = [0, Math.cos(tilt), Math.sin(tilt)];
  const offsetAt = (days, tr = null) => {
    const [x, y, z] = sunBeadPositionAt(days, tr);
    return [x, y - ARM_CENTRE_Y, z];
  };
  const declOf = (days) => {
    const o = offsetAt(days);
    return o[0] * polar[0] + o[1] * polar[1] + o[2] * polar[2];
  };
  // At the March equinox the bead is ON the equator band (zero
  // declination arm) and on the ecliptic band (its radius is
  // the band's centreline) — the crossing, on both at once.
  const eq = offsetAt(MARCH_EQUINOX_DAY);
  assert.ok(near(Math.hypot(...eq), ARM_R, 1e-9), "the bead stands on the ecliptic's centreline");
  assert.ok(near(declOf(MARCH_EQUINOX_DAY), 0, 1e-9), "and in the equator's plane — the crossing");
  assert.ok(near(declOf(MARCH_EQUINOX_DAY + YEAR_DAYS / 2), 0, 1e-6), "the September crossing likewise");
  // The solstices: the full sin(tilt) of the radius, north
  // then south — the June and December postures.
  assert.ok(near(declOf(MARCH_EQUINOX_DAY + YEAR_DAYS / 4), ARM_R * Math.sin(tilt), 1e-6),
    "June solstice: greatest northern declination");
  assert.ok(near(declOf(MARCH_EQUINOX_DAY + (3 * YEAR_DAYS) / 4), -ARM_R * Math.sin(tilt), 1e-6),
    "December solstice: greatest southern");
  // The whole year obeys the one law, and the bead never
  // leaves its band's centreline.
  for (const lambda of [30, 45, 135, 200, 315]) {
    const days = MARCH_EQUINOX_DAY + (lambda / 360) * YEAR_DAYS;
    assert.ok(near(declOf(days), ARM_R * Math.sin(tilt) * Math.sin((lambda * Math.PI) / 180), 1e-6),
      `declination at λ=${lambda}`);
    assert.ok(near(Math.hypot(...offsetAt(days)), ARM_R, 1e-9), `radius at λ=${lambda}`);
  }
  // The bead's anchor follows its band's sub-node transform:
  // a pure scale of the ecliptic scales the bead's radius, a
  // pure turn keeps it.
  const scaled = offsetAt(100, { rotation: [0, 0, 0], scale: 1.16 });
  assert.ok(near(Math.hypot(...scaled), ARM_R * 1.16, 1e-9), "the bead rides its band's scale");
  const turned = offsetAt(100, { rotation: [0.3, -0.5, 0.2], scale: 1 });
  assert.ok(near(Math.hypot(...turned), ARM_R, 1e-9), "and its turn");
});

test("the armillary's frame clears its cage (the real instrument's nesting)", () => {
  // The fixed bands stand outside the turning cage: the cage's
  // outer reach (its bands' centreline + half width, the bead
  // riding the centreline) never reaches the fixed bands'
  // inner edge.
  assert.ok(ARM_R + ARM_BAND_W / 2 < ARM_FIXED_R - ARM_BAND_W / 2,
    `cage reach ${ARM_R + ARM_BAND_W / 2} vs fixed inner ${ARM_FIXED_R - ARM_BAND_W / 2}`);
  assert.ok(near(ARM_OUTER_R, ARM_FIXED_R + ARM_BAND_W / 2));
  // The graduations the guide names: hours on the equator,
  // signs on the ecliptic.
  assert.equal(EQUATOR_TICKS, 24);
  assert.equal(ECLIPTIC_TICKS, 12);
});

test("provider (armillary): the sphere is the root, the bands and bead its equal children", () => {
  const root = subnodeRootOf("orrery", null, "genealogy", "armillary");
  assert.equal(root.id, "orrery");
  assert.equal(root.name, "the armillary sphere");
  assert.equal(root.value, 5);
  const sphere = subnodeById("orrery", "orrery", null, "genealogy", "armillary");
  assert.equal(sphere.name, "Armillary Sphere");
  assert.equal(sphere.depth, 0);
  assert.equal(sphere.isLeaf, false);
  const rendered = subnodesFor("orrery", null, "genealogy", "armillary");
  assert.deepEqual(rendered.map((n) => n.id),
    ["orrery/equator", "orrery/ecliptic", "orrery/meridian", "orrery/horizon", "orrery/sun"]);
  // Equal values BY DESIGN (the bands have no natural
  // magnitude): each child is a fifth of the whole.
  for (const n of rendered) {
    assert.equal(n.value, 1, n.id);
    assert.ok(near(n.share, 0.2), n.id);
    assert.equal(n.depth, 1, n.id);
    assert.equal(n.parentId, "orrery", n.id);
    assert.equal(n.isLeaf, true, n.id);
  }
  assert.ok(near(rendered.reduce((s, n) => s + n.share, 0), 1), "the fifths sum to the whole");
  assert.deepEqual(subnodeById("orrery", "orrery/ecliptic", null, "genealogy", "armillary").path,
    ["Armillary Sphere", "Ecliptic"]);
  assert.equal(subnodeParentOf("orrery", "orrery/sun", "genealogy", "armillary"), "orrery");
  // The other dressings' addresses are not live here: no
  // planet, and no "orrery/earth" — in this dressing the
  // Earth ball IS the root and reports "orrery" itself.
  assert.equal(subnodeById("orrery", "orrery/mars", null, "genealogy", "armillary"), null);
  assert.equal(subnodeById("orrery", "orrery/earth", null, "genealogy", "armillary"), null);
  // And the armillary's addresses are not live in the solar
  // dressing.
  assert.equal(subnodeById("orrery", "orrery/equator", null, "genealogy", "solar"), null);
  assert.equal(subnodeById("orrery", "orrery/sun", null, "genealogy", "solar"), null);
});

test("F on the sphere is the root no-op; F on a band focuses it (no descent)", () => {
  assert.deepEqual(
    resolveFAction({ currentId: "orrery", subId: "orrery", subRoot: true, subLeaf: false, subTier: 0 }),
    { type: "rootNoop", targetId: "orrery" },
  );
  assert.deepEqual(
    resolveFAction({ currentId: "orrery", subId: "orrery/ecliptic", subLeaf: true, subTier: 1 }),
    { type: "partFocus", targetId: "orrery", partId: "orrery/ecliptic" },
  );
});

test("every layout seats the orrery (no layout lacks the sixteenth citizen)", () => {
  for (const name of Object.keys(LAYOUTS)) {
    const state = applyLayout(createSpaceState(), name);
    const p = state.positions.orrery;
    assert.ok(p && Number.isFinite(p.x) && Number.isFinite(p.z), name);
    assert.ok(Math.hypot(p.x, p.z) < 184, `${name}: inside the drag clamp`);
    assert.equal(Object.keys(state.positions).length, OBJECT_IDS.length, name);
  }
});
