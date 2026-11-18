/**
 * UI Space — the ORRERY (slice 16): the astronomy citizen's
 * data and mathematics, pure like every other dataset here
 * (book.js is the precedent). The data is CONSTANTS, not a
 * probe — no snapshot JSON: the planets' approximate orbital
 * elements and physical measures, as published in NASA/JPL's
 * planetary fact sheets (semi-major axis, sidereal orbital
 * period, mean radius, axial tilt, satellite counts as of the
 * mid-2020s counts). Moon counts drift as surveys announce new
 * small satellites; the values here are the fact-sheet figures
 * and are stated as such.
 *
 * THE MODEL'S HONEST SIMPLIFICATIONS (the guide repeats them):
 * orbits are CIRCLES at the semi-major axis — eccentricity is
 * a later refinement, not this slice — lying in one plane;
 * distances are LOG-SCALED into the plot (true distances would
 * put Neptune 78× farther out than Mercury and every planet
 * invisibly small); planet sizes are EXAGGERATED from their
 * radii with a visibility floor. What stays true: the ORDER of
 * the planets, their relative periods (the clock is honest —
 * a planet returns to its start after exactly its period),
 * their relative sizes' order, and the Earth–Moon phase
 * geometry, which is derived from the actual sun–Moon angle.
 *
 * ANGLES: degrees throughout (the space's convention), measured
 * like a yaw — atan2(x, z), so 0 is +Z and a position at angle
 * a and radius r is (r·sin a, ·, r·cos a). Model time is DAYS
 * since the start epoch, J2000 (2000-01-01, 12:00 UTC).
 */

/* ---------------- the planets ---------------- */

export const PLANETS = [
  { slug: "mercury", name: "Mercury", au: 0.387, periodDays: 87.969, radiusEarth: 0.383, tiltDeg: 0.03, moons: 0, color: 0x9c8e82, phase0Deg: 20 },
  { slug: "venus", name: "Venus", au: 0.723, periodDays: 224.701, radiusEarth: 0.949, tiltDeg: 177.4, moons: 0, color: 0xd9b380, phase0Deg: 95 },
  { slug: "earth", name: "Earth", au: 1.000, periodDays: 365.256, radiusEarth: 1.000, tiltDeg: 23.44, moons: 1, color: 0x5b8fd6, phase0Deg: 170 },
  { slug: "mars", name: "Mars", au: 1.524, periodDays: 686.980, radiusEarth: 0.532, tiltDeg: 25.19, moons: 2, color: 0xc96f4a, phase0Deg: 240 },
  { slug: "jupiter", name: "Jupiter", au: 5.203, periodDays: 4332.589, radiusEarth: 11.209, tiltDeg: 3.13, moons: 95, color: 0xc8a97e, phase0Deg: 305 },
  { slug: "saturn", name: "Saturn", au: 9.537, periodDays: 10759.22, radiusEarth: 9.449, tiltDeg: 26.73, moons: 146, color: 0xd8c49a, phase0Deg: 45 },
  { slug: "uranus", name: "Uranus", au: 19.191, periodDays: 30688.5, radiusEarth: 4.007, tiltDeg: 97.77, moons: 28, color: 0x9fd8d8, phase0Deg: 130 },
  { slug: "neptune", name: "Neptune", au: 30.069, periodDays: 60182, radiusEarth: 3.883, tiltDeg: 28.32, moons: 16, color: 0x5a7fd6, phase0Deg: 215 },
];

export const planetBySlug = (slug) => PLANETS.find((p) => p.slug === slug) || null;

/** The solar dataset's whole: the planets' periods summed (days). */
export const TOTAL_PERIOD_DAYS = PLANETS.reduce((s, p) => s + p.periodDays, 0);

/* ---------------- the plot's scales ---------------- */

/**
 * ORBIT RADII: a log scale mapping the AU range onto the plot.
 * r(au) = ORBIT_R_MIN + (log10(au) − log10(AU_MIN)) /
 * (log10(AU_MAX) − log10(AU_MIN)) × (ORBIT_R_MAX − ORBIT_R_MIN).
 * Mercury's ring (5.2) clears the sun (r 3.2) with room for its
 * sphere; Neptune's (17.5) leaves margin inside the citizens'
 * glass plot plate (r 21–22) and the plinth (r 20.5).
 */
export const AU_MIN = 0.387;
export const AU_MAX = 30.069;
export const ORBIT_R_MIN = 5.2;
export const ORBIT_R_MAX = 17.5;

export function orbitRadius(au) {
  const t = (Math.log10(au) - Math.log10(AU_MIN)) / (Math.log10(AU_MAX) - Math.log10(AU_MIN));
  return ORBIT_R_MIN + t * (ORBIT_R_MAX - ORBIT_R_MIN);
}

/**
 * PLANET DISPLAY SIZES: exaggerated from the true radius —
 * r = 0.5 + 0.38·√(radius in Earth radii), floored at 0.55 so
 * even Mercury reads as a body, not a bead. The order is the
 * true order; the proportions are compressed, as every orrery
 * compresses them.
 */
export const PLANET_SIZE_FLOOR = 0.55;
export function planetDisplayRadius(radiusEarth) {
  return Math.max(PLANET_SIZE_FLOOR, 0.5 + 0.38 * Math.sqrt(radiusEarth));
}

/** The sun's sphere radius, and the orbital plane's height. */
export const SUN_R = 3.2;
export const ORBIT_PLANE_Y = 4.4;

/* ---------------- solar motion ---------------- */

/** A planet's orbital angle (degrees, [0, 360)) at a model time. */
export function planetAngleAt(planet, modelDays) {
  const a = (planet.phase0Deg + (360 * modelDays) / planet.periodDays) % 360;
  return a < 0 ? a + 360 : a;
}

/**
 * A planet's position at a model time, in the citizen's local
 * frame: on its log-scaled ring, in the orbital plane.
 * [x, y, z] with y = ORBIT_PLANE_Y.
 */
export function planetPositionAt(planet, modelDays) {
  const a = (planetAngleAt(planet, modelDays) * Math.PI) / 180;
  const r = orbitRadius(planet.au);
  return [Math.sin(a) * r, ORBIT_PLANE_Y, Math.cos(a) * r];
}

/* ---------------- the Earth–Moon system ---------------- */

export const EARTH_R = 5;
export const EARTH_Y = 6.2;
export const EARTH_TILT_DEG = 23.44;
export const MOON_ORBIT_R = 13.5;
export const MOON_R = 1.4;
/** The Moon's sidereal period, days (NASA fact sheet: 27.321661). */
export const MOON_PERIOD_DAYS = 27.321661;
/**
 * The model's fixed sun direction in the Earth–Moon dressing:
 * azimuth 0 — the +Z direction, the space's standing front —
 * so the sun marker stands where a citizen's front points and
 * FACING needs no special case (space-state.js).
 */
export const SUN_AZIMUTH_DEG = 0;
/** The sun marker's distance from Earth in the dressing. */
export const SUN_MARKER_R = 19;
/** The Moon's angle at model day 0: a waxing crescent stands at the opening. */
export const MOON_PHASE0_DEG = 60;

/** The Moon's orbital angle (degrees, [0, 360)) at a model time. */
export function moonAngleAt(modelDays) {
  const a = (MOON_PHASE0_DEG + (360 * modelDays) / MOON_PERIOD_DAYS) % 360;
  return a < 0 ? a + 360 : a;
}

/** The Moon's position at a model time, in the citizen's local frame. */
export function moonPositionAt(modelDays) {
  const a = (moonAngleAt(modelDays) * Math.PI) / 180;
  return [Math.sin(a) * MOON_ORBIT_R, EARTH_Y, Math.cos(a) * MOON_ORBIT_R];
}

/**
 * THE PHASE, from the geometry: the phase angle φ is the
 * Moon's angle minus the sun's azimuth — the elongation of the
 * Moon from the Sun as seen from Earth. φ = 0: the Moon stands
 * between Earth and Sun (NEW). φ = 180: Earth stands between
 * (FULL). The illuminated fraction of the disc is (1 − cos φ)/2
 * — 0 at new, ½ at the quarters, 1 at full. The NAME is the
 * 45° sector of φ centred on each cardinal point, in the
 * standing order new → waxing crescent → first quarter →
 * waxing gibbous → full → waning gibbous → last quarter →
 * waning crescent (φ in (0°, 180°) is the waxing half: the
 * Moon travels away from the Sun through the quarters to full).
 */
export const PHASE_NAMES = [
  "New", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
  "Full", "Waning Gibbous", "Last Quarter", "Waning Crescent",
];

export function phaseNameFor(angleDeg) {
  const a = ((angleDeg % 360) + 360) % 360;
  return PHASE_NAMES[Math.floor(((a + 22.5) % 360) / 45)];
}

export function illuminatedFraction(angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return (1 - Math.cos(a)) / 2;
}

/**
 * The Moon's phase at a model time, against a sun azimuth:
 * { name, fraction, angleDeg } — angleDeg is φ in [0, 360).
 */
export function moonPhaseAt(modelDays, sunAzimuthDeg = SUN_AZIMUTH_DEG) {
  const angleDeg = ((moonAngleAt(modelDays) - sunAzimuthDeg) % 360 + 360) % 360;
  return {
    name: phaseNameFor(angleDeg),
    fraction: illuminatedFraction(angleDeg),
    angleDeg,
  };
}

/* ---------------- the armillary sphere ---------------- */

/**
 * THE ARMILLARY DRESSING (slice 16 extension): the same plot
 * re-dressed as the instrument that reads the sky FROM Earth
 * — the opposite viewpoint to the orrery's outside one, and
 * the miniature's purpose is to teach how a REAL armillary
 * sphere works. A small Earth ball at the centre; a FIXED
 * frame — the HORIZON band, level, and the MERIDIAN band,
 * standing through the zenith in the front plane (YZ); and a
 * ROTATING CAGE about the polar axis — the CELESTIAL EQUATOR
 * band, the ECLIPTIC band and the axis rod — mounted with the
 * axis tipped 23.4° from vertical toward +Z (the front), the
 * same tilt the Earth–Moon dressing's rod wears.
 *
 * THE BANDS ARE BANDS, not wire lines, because a real
 * armillary's rings ARE bands, wide enough to carry engraved
 * scales: the equator band carries 24 HOUR divisions, the
 * ecliptic band 12 (the signs, the months). The miniature
 * engraves them as ticks at the divisions EQUATOR_TICKS /
 * ECLIPTIC_TICKS name (SpaceView builds the tick geometry).
 * The fixed frame's bands are WIDER-SET than the cage's —
 * centreline ARM_FIXED_R against the cage's ARM_R — as on a
 * real instrument, where the meridian ring stands outside the
 * cage it carries: the cage's outer reach (11.2) clears the
 * fixed bands' inner edge (11.5), so the cage turns inside
 * its frame without ever touching it.
 *
 * THE KINEMATICS, from the one model clock (no second clock):
 * the cage turns about the polar axis once per SIDEREAL day
 * (0.99727 d — the stars' day, a little shorter than the
 * sun's; over one year the cage therefore makes 366¼ turns
 * while the sun makes 365¼, and that one extra turn IS the
 * sun's annual circuit, seen from the other side). The SUN
 * BEAD is fixed ON the ecliptic band at the day's ecliptic
 * longitude — measured on the band's own scale from its
 * equinox mark, as a bead is set by hand on a real one —
 * advancing one full circuit per year. At the March equinox
 * (the model's day 79) the longitude is 0 and the bead sits
 * at an equator/ecliptic crossing, on both bands at once.
 */
export const ARM_CENTRE_Y = 12.8;
/** The cage bands' centreline radius (equator, ecliptic). */
export const ARM_R = 10.4;
/** The fixed bands' centreline radius (meridian, horizon). */
export const ARM_FIXED_R = 12.3;
/** The bands' width — real bands carry their scales on it. */
export const ARM_BAND_W = 1.6;
/** The dressing's reach from its centre: the fixed bands bind. */
export const ARM_OUTER_R = ARM_FIXED_R + ARM_BAND_W / 2;
/** The Earth ball at the cage's centre. */
export const ARM_EARTH_R = 2.3;
/** The sun bead's radius — a bead threaded on the ecliptic band. */
export const ARM_BEAD_R = 0.55;
/** The sidereal day, in model (solar) days — the stars' day. */
export const SIDEREAL_DAY_DAYS = 0.99726968;
/** The model's March equinox: model day 79 (J2000 + 79 d ≈ 2000-03-20). */
export const MARCH_EQUINOX_DAY = 79;
/** The sun's annual circuit, days — Earth's period, the table's own figure. */
export const YEAR_DAYS = 365.256;
/** The hour divisions engraved on the equator band. */
export const EQUATOR_TICKS = 24;
/** The sign/month divisions engraved on the ecliptic band. */
export const ECLIPTIC_TICKS = 12;

/** A value's fractional part, always in [0, 1). */
const frac = (v) => v - Math.floor(v);

/**
 * The cage's turn about the polar axis (degrees, [0, 360)):
 * one full turn per sidereal day, from the model clock alone.
 */
export function cageAngleAt(modelDays) {
  return 360 * frac(modelDays / SIDEREAL_DAY_DAYS);
}

/**
 * The sun bead's ecliptic longitude (degrees, [0, 360)),
 * measured on the ecliptic band's own scale from its equinox
 * mark: 0 at the March equinox, one circuit per year.
 */
export function eclipticLongitudeAt(modelDays) {
  return 360 * frac((modelDays - MARCH_EQUINOX_DAY) / YEAR_DAYS);
}

const DEG2RAD = Math.PI / 180;

/* Rotation helpers in three.js's own conventions (a point is
   carried by the matrix, exactly as SpaceView's nested groups
   carry the bead's mesh): Rx about +X, Ry about +Y. */
const rotX = ([x, y, z], deg) => {
  const a = deg * DEG2RAD, c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
};
const rotY = ([x, y, z], deg) => {
  const a = deg * DEG2RAD, c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
};
const rotZ = ([x, y, z], deg) => {
  const a = deg * DEG2RAD, c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c, z];
};

/**
 * A three.js "YXZ" Euler (RADIANS, sub-transforms.js's resolved
 * shape) applied to a point: R = Ry·Rx·Rz, then the uniform
 * scale — a group's own composition, mirrored so the bead's
 * anchor can follow its band's sub-node transform exactly.
 */
function applyEulerYXZ([x, y, z], rotation, scale) {
  const d = 180 / Math.PI;
  let p = rotZ([x, y, z], rotation[2] * d);
  p = rotX(p, rotation[0] * d);
  p = rotY(p, rotation[1] * d);
  return [p[0] * scale, p[1] * scale, p[2] * scale];
}

/**
 * The sun bead's position in the citizen's local frame. The
 * bead stands on the ecliptic band's centreline at the day's
 * longitude, and the band stands in the cage — mount tilt
 * (EARTH_TILT_DEG about X), the cage's turn (about the polar
 * axis), the ecliptic's tilt (EARTH_TILT_DEG about X again, in
 * the cage's frame) — the same nesting SpaceView builds with
 * groups, so this function and the mesh never disagree.
 * Longitude 0 is the bands' +X crossing; the longitude grows
 * toward the northern solstice point (λ = 90: the bead stands
 * sin(tilt) of its radius along the polar axis — the June
 * posture, the sun at its greatest northern declination).
 *
 * `eclipticTransform` is the ecliptic band's resolved sub-node
 * transform ({ rotation: [x, y, z] radians YXZ, scale }, as
 * sub-transforms.js resolves it) or null: the bead rides its
 * band's wrapper group in the View, so when the band itself is
 * turned or scaled the bead — and therefore its anchor — goes
 * with it, and this function composes that step too.
 */
export function sunBeadPositionAt(modelDays, eclipticTransform = null) {
  const lambda = eclipticLongitudeAt(modelDays) * DEG2RAD;
  let p = [ARM_R * Math.cos(lambda), 0, -ARM_R * Math.sin(lambda)];
  p = rotX(p, EARTH_TILT_DEG);
  if (eclipticTransform) {
    p = applyEulerYXZ(p, eclipticTransform.rotation, eclipticTransform.scale);
  }
  p = rotY(p, cageAngleAt(modelDays));
  p = rotX(p, EARTH_TILT_DEG);
  return [p[0], p[1] + ARM_CENTRE_Y, p[2]];
}

/* ---------------- the model clock ---------------- */

/** The start epoch: J2000, 2000-01-01 12:00 UTC, in epoch ms. */
export const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

/** The model date at a model time, formatted YYYY-MM-DD. */
export function modelDate(modelDays) {
  const d = new Date(EPOCH_MS + modelDays * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The orrery's datasets, in the PARAMETERS panel's order. */
export const ORRERY_DATASETS = ["solar", "earthmoon", "armillary"];

/**
 * The clock's speed parameter (PARAMETERS · Orrery speed):
 * model days per second. At the default 2 d/s an Earth year
 * takes ~3 minutes and the Moon's cycle ~14 seconds — the
 * Earth–Moon dressing reads its phases inside a visit, and the
 * solar dressing keeps Mercury visibly quicker than Neptune
 * without either becoming a blur or a statue.
 */
export const ORRERY_SPEED_MIN = 0.1;
export const ORRERY_SPEED_MAX = 20;
export const ORRERY_SPEED_DEFAULT = 2;
