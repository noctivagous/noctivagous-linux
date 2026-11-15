/**
 * UI Space — the pure interaction state of the space.
 *
 * Everything the control scheme does to plain data lives here, with
 * no React, no three.js and no DOM, so it can be exercised headless:
 * the object table and its key labels, the Tab cycle, the transform
 * ops the punctuation keys drive, the patch cables (add / reject /
 * strip), the loadable layouts, the zoom steps and the ground clamp.
 *
 * SpaceApp holds one of these states in React state; SpaceView
 * renders it and eases the displayed values toward it. The scheme:
 *
 *   C dolly out · V dolly in · 1/2/3/4 named views · 5/6 field
 *   sizes (the focal zoom) · 7/8/9 object layouts · Tab cycle ·
 *   F enter · Q/W pitch · E/R yaw · T/Y roll · Z/X magnify ·
 *   G patch · J strip cables · L copy · H reset · Space press
 *   toggles the drag lock (press to pick up, press again to
 *   drop, Esc cancels).
 *
 *   Slice 13-4: E and R swap yaw directions (E is the POSITIVE
 *   step now); copy moves H → L and H becomes RESET (the
 *   examined citizen's rotation, plane spin and scale return to
 *   default — resetTransform below); an entered citizen's seat
 *   is captured at entry and authored by camera actions only
 *   (the entry seat basis, below); sub-nodes carry a stored
 *   MARK index (subnode-marks.js); and a citizen entered for
 *   the first time in a session turns to its FACING (below).
 *
 *   Slice 8 adds APPS and the RING (see the section at the foot of
 *   this file): a thing that bears an app opens with F onto the
 *   centre stage, or with E across the whole platter.
 *
 *   Slice 11 adds EVENT MESSAGING (see the events section below):
 *   the backs and the finish are named events — A is FINISH,
 *   S is GO_BACK_I, D is GO_BACK_II, Esc is CANCEL — and one pure
 *   resolver (resolveBackLevels) decides which levels of the
 *   release stack each back event pops. Inside an app the same
 *   events walk the app's own levels: CANCEL / GO_BACK_I pop ONE
 *   level (one app-nav step, or leaving the app when its nav is
 *   empty), GO_BACK_II up to two — so D is now the big step back
 *   and Esc/S the single step, a refinement of slice 8's rule
 *   that Esc in the app was automatically the big back.
 *
 *   Slice 12 adds SUB-NODES (subnodes.js) and SUNBURST DESCENT:
 *   the tray's, tangle's and sunbursts' nodes are sub-addresses
 *   like the knot's parts, and F on a sunburst branch wedge
 *   DESCENDS — the citizen re-roots at that wedge (the descent
 *   state below), one chain level per descended root.
 *
 *   Addressing is the key-click model: the object under the cursor
 *   is the addressee and F is the click. KEY LABELS ARE OPT-IN:
 *   Alt+L enters label mode — the chips appear and bare letters
 *   type-to-target; Alt+L again or Esc leaves it. In label mode G
 *   is the tangled tree's address; outside it, G is only the patch
 *   operator. Label mode and the armed command line (space-command
 *   .js) are mutually exclusive.
 */

/** Key-label alphabet: every letter except the operators D and F. */
export const LABEL_ALPHABET = "ABCEGHIJKLMNOPQRSTUVWXYZ";

export function labelForIndex(i) {
  const A = LABEL_ALPHABET;
  if (i < A.length) return A[i];
  const j = i - A.length;
  return A[Math.floor(j / A.length)] + A[j % A.length];
}

/**
 * The citizens of the space, in reading order (the order Tab cycles
 * and the labels are handed out). Each is a miniature of one of the
 * lab's frames, standing on the platter as a manipulable object.
 */
export const OBJECTS = [
  { id: "mesa", name: "Sunburst mesa", group: "graphs",
    blurb: "The zoomable sunburst as a terraced mesa — the noctivagous-linux repository itself as annular prisms, file sizes as values, area and angle doing the talking. Its wedges are sub-addresses: hover one to read it, F on a branch wedge descends — the mesa re-roots at that wedge — and F on a leaf flies into it." },
  { id: "drum", name: "Sunburst cylinder", group: "graphs",
    blurb: "The same sunburst stood up as a drum of wedge blocks — the repository in the round; a leaf's wedge slides out of the drum with its card. Its wedges descend like the mesa's: F on a branch wedge re-roots the drum there." },
  { id: "tray", name: "Treemap tray", group: "graphs",
    blurb: "Bostock's binary-tiled treemap as a tray of cuboids — the repository's own files, area as byte size. Its plates and cuboids are sub-addresses: hover one to read it, F flies into the node." },
  { id: "cube", name: "Treemap cube", group: "graphs",
    blurb: "The treemap layer spread across a cube's five open faces; bright tiles are leaves, dark framed doors open." },
  { id: "tangle", name: "Tangled tree", group: "instruments",
    blurb: "A tangled tree with two courses — the Greek genealogy, and demo-de's own module import graph (switch in PARAMETERS) — metro lines bundling through levels of descent. Its figures are sub-addresses: hover one to read it and its line, F flies into it." },
  { id: "horizon3d", name: "Horizon skyline", group: "monitors",
    blurb: "The activity monitor in relief: eight lanes of machine life as terraced skylines on a platter." },
  { id: "horizonflat", name: "Horizon panel", group: "monitors",
    blurb: "The flat horizon chart — the machine's vitals as layered bands on a panel, the Flat UI frame." },
  { id: "arch", name: "Panelization arch", group: "instruments",
    blurb: "The iGeo agent panelization on its arched sheet — panels pushed around by a swarm you cannot see." },
  { id: "definition", name: "Definition", group: "instruments",
    blurb: "The Grasshopper-style definition: nodes and wires, geometry as a value travelling the graph." },
  { id: "knot", name: "Trefoil data knot", group: "graphs",
    blurb: "A trefoil whose parts contain data — eight arcs of one closed curve, each holding a system's datum; the tube is one continuous surface that swells and narrows with the size of what each part holds. Hover a part, then F zooms into it." },
  { id: "crystal", name: "Living crystal", group: "graphs",
    blurb: "An octahedron that is alive: its eight faces carry eight values, each face's distance from the centre set by its value, so the shape is the chart. It turns slowly on its pedestal, and the faces regrow as the values drift." },
  { id: "tree", name: "Data tree", group: "graphs",
    blurb: "The noctivagous-linux repository grown as a branching tree by L-system rules — file sizes are the values; its depth-1 branches are sub-addresses: hover one, then F zooms into the subtree." },
  { id: "book", name: "Sample Book", group: "instruments",
    blurb: "A sample book whose leaves stand around a cylinder, in tiers: chapters on the drum's upper band, sections on the lower, pages as radial leaves at the rim. Hover a tier to read it, F accesses it — a page slides out of the drum to be read — and U stands the book open instead, two pages at a time, flipped with B and N." },
  { id: "devices", name: "Devices", group: "instruments",
    blurb: "The machine's own attachments on one shelf, from the environment snapshot: the printer a small press whose output tray holds a sheet for every queued job (the printing job's sheet half-fed), keyboard, pointer, display and volumes beside it, and a hub whose connections arc out as cables to host tokens standing on the ring. Its devices, its hub and its hosts are sub-addresses: hover one to read it, F flies into it." },
  { id: "mail", name: "Mail", group: "instruments",
    blurb: "The sample mailbox as a pigeonhole sorting cabinet: its folders are compartments sized by their message counts, Projects' subfolders nested in its cell, an envelope slot on top. Its folders are sub-addresses, and so are the recent messages standing as letters on the post shelf beside the library on the XY wall — F on a folder flies into it; F on a letter opens it on the centre stage to be read." },
];

export const OBJECT_IDS = OBJECTS.map((o) => o.id);

export function objectById(id) {
  return OBJECTS.find((o) => o.id === id) || null;
}

/** Labels in reading order: [{ object, label }]. */
export function labeledObjects() {
  return OBJECTS.map((object, i) => ({ object, label: labelForIndex(i) }));
}

export function objectForLabel(label) {
  const hit = labeledObjects().find((l) => l.label === label);
  return hit ? hit.object : null;
}

/* ---------------- transforms ---------------- */

export const ANGLE_STEP = 6; // degrees per key press (auto-repeat keeps stepping)
export const SCALE_STEP = 1.08; // ratio per key press
export const SCALE_MIN = 0.4;
export const SCALE_MAX = 2.5;

/**
 * e.key → transform op (slice 11: the rotate/magnify cluster
 * moved onto the letter keys — Q/W pitch, E/R yaw, T/Y roll,
 * Z/X magnify, and B/N ROTATE PLANE, a fourth rotation kind:
 * rotation about the shape's own plane normal, in its own
 * plane, leaving every other axis untouched. The first-listed
 * key of each pair is the negative step — EXCEPT yaw: slice
 * 13-4 (item E) swaps E and R, so E is the POSITIVE yaw step
 * and R the negative. E's separate EXPAND role (the ring's app
 * item, a centre-stage app) is not this table's business —
 * resolveEKey rules it before the cluster is consulted). The punctuation keys
 * stood UNBOUND in the space scope until slice 13-3, which put
 * the PLATTER's plane spin on [ and ] (PLATTER_SPIN_KEYS below);
 * the rest of the punctuation row stays unbound. Letters are
 * matched on e.key, lower-cased by the App; these operators live OUTSIDE
 * label mode only — inside it, letters are addresses (B is the
 * drum, N the tree). The typed transforms on the command line
 * (o › y/t/r/z/p) are a different input path.
 *
 * Most entries name their op directly ("yaw-"); the plane pair
 * carries the { axis, dir } form — transformOpOf normalises both
 * shapes to the "axis±" string the appliers switch on.
 *
 * §16 — the two truths of Z/X: the OPERATION is MAGNIFY (it
 * enlarges one thing for examination while the rest of the
 * space stays in place — every user-facing name says so), and
 * the FACTOR it steps is a scale: the transform record's
 * `scale` field, SCALE_STEP / SCALE_MIN / SCALE_MAX, and the
 * "scale±" axis id below keep the geometric name inside the
 * code, deliberately.
 */
export const TRANSFORM_KEYS = {
  q: "pitch-", w: "pitch+",
  e: "yaw+", r: "yaw-",
  t: "roll-", y: "roll+",
  z: "scale-", x: "scale+",
  b: { axis: "spin", dir: -1 },
  n: { axis: "spin", dir: 1 },
};

/** Normalise a TRANSFORM_KEYS entry to its "axis±" op name. */
export function transformOpOf(key) {
  const v = TRANSFORM_KEYS[key];
  if (!v) return null;
  return typeof v === "string" ? v : `${v.axis}${v.dir < 0 ? "-" : "+"}`;
}

export const defaultTransform = () => ({ yaw: 0, pitch: 0, roll: 0, scale: 1, spin: 0 });

const clampScale = (s) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));

/** Apply one transform op to one object; returns a new state. */
export function applyTransformOp(state, id, op) {
  const cur = state.transforms[id];
  if (!cur) return state;
  const next = { ...cur };
  switch (op) {
    case "yaw-": next.yaw -= ANGLE_STEP; break;
    case "yaw+": next.yaw += ANGLE_STEP; break;
    case "pitch-": next.pitch -= ANGLE_STEP; break;
    case "pitch+": next.pitch += ANGLE_STEP; break;
    case "roll-": next.roll -= ANGLE_STEP; break;
    case "roll+": next.roll += ANGLE_STEP; break;
    case "spin-": next.spin = (cur.spin || 0) - ANGLE_STEP; break;
    case "spin+": next.spin = (cur.spin || 0) + ANGLE_STEP; break;
    case "scale-": next.scale = clampScale(cur.scale / SCALE_STEP); break;
    case "scale+": next.scale = clampScale(cur.scale * SCALE_STEP); break;
    default: return state;
  }
  return { ...state, transforms: { ...state.transforms, [id]: next } };
}

/** Apply the transform bound to an e.key value; unknown keys pass through. */
export function applyTransformKey(state, id, key) {
  const op = transformOpOf(key);
  if (!op || !id) return state;
  return applyTransformOp(state, id, op);
}

/**
 * Merge absolute values into one object's transform, scale clamped
 * to the same bounds the step keys respect. The command line's
 * yaw/pitch/roll/size intents land here, so a typed value and a
 * key-stepped one live under identical rules.
 */
export function applyTransformPatch(state, id, patch) {
  const cur = state.transforms[id];
  if (!cur) return state;
  const next = { ...cur, ...patch };
  next.scale = clampScale(next.scale);
  return { ...state, transforms: { ...state.transforms, [id]: next } };
}

/**
 * Slice 13-4 (item B): RESET — one citizen's transform record
 * returns to the BUILD default (defaultTransform: identity
 * rotation, no plane spin, scale 1). The H key's whole action.
 * It touches the transform record ONLY: not the citizen's
 * position, not its descent or book access (those are display
 * states held elsewhere), not part focus, not the camera, not
 * its marks. The default is the BUILD orientation — a separate
 * concept from the first-open FACING (below), which is a
 * one-time courtesy turn at first entry, not a home the reset
 * returns to. Unknown ids pass through untouched.
 */
export function resetTransform(state, id) {
  if (!id || !state.transforms[id]) return state;
  return { ...state, transforms: { ...state.transforms, [id]: defaultTransform() } };
}

/* ---------------- events: the messaging vocabulary (slice 11) ---------------- */

/**
 * EVENT MESSAGING: the space's verbs of completion and retreat
 * are named events, carried as data. A is FINISH (complete the
 * operation in flight), S is GO_BACK_I and Esc is CANCEL (both
 * pop exactly ONE level of the release stack), D is GO_BACK_II
 * (pop up to TWO levels). The readout echo names the event when
 * it fires, and the keyboard panel labels these caps by their
 * event names — the messaging is visible, not just internal.
 */
export const EVENTS = {
  FINISH: "FINISH",
  GO_BACK_I: "GO_BACK_I",
  GO_BACK_II: "GO_BACK_II",
  CANCEL: "CANCEL",
};

/**
 * The release stack, as an ordered list of level names, from the
 * occupancy `chain` describes. The order is the existing
 * doBack/doEsc truth of the handlers, extended so the app scope's
 * levels sit in it:
 *
 *   drag → inspection → appNav (each nav entry its own level) →
 *   appClose → docClose → partFocus → descent (each descended
 *   level its own) → bookAccess (each accessed tier its own) →
 *   patch → card → selection
 *
 * Slice 15 adds DOCCLOSE at the appClose tier, immediately
 * after it: an opened MESSAGE (a letter taken from the post
 * shelf and stood on the centre stage to be read) is a document
 * holding the stage the way an app does, and it closes at the
 * same tier an app closes at. It is a dedicated state, not the
 * app state — the app scope's keys are the waveform's own, and
 * a letter has no transport — but it sits in the chain exactly
 * where an appClose sits, so the backs treat a reading like an
 * opening: one level, popped before any focus beneath it.
 *
 * Slice 12 adds DESCENT at the partFocus tier: a sunburst focus
 * (a leaf seat) releases before the climb beneath it, and each
 * level of a descent is one chain level, so CANCEL climbs one
 * root and GO_BACK_II up to two. The App counts descent levels
 * only while the descended citizen is current — a descent is
 * that citizen's display state, and its stack is only in scope
 * while you are on it.
 *
 * Slice 13-2 adds BOOK ACCESS at the same tier, immediately
 * after descent: the cylinder book's accessed tiers (chapter,
 * then section, then the page standing out of the drum) are one
 * chain level each, counted only while the book is current,
 * exactly as descents count only while their citizen is.
 *
 * The command line's walk-back is handled BEFORE this layer (its
 * machine consumes Esc while armed) and is not part of the chain;
 * so are CANCEL's two pre-steps in the App — clearing a drag's
 * axis lock, and exiting label mode — which release sub-states
 * the chain does not model.
 */
export function backChainLevels(chain = {}) {
  const levels = [];
  if (chain.dragLocked) levels.push("drag");
  if (chain.inspection) levels.push("inspection");
  const nav = Math.max(0, Math.floor(chain.appNav || 0));
  for (let i = 0; i < nav; i++) levels.push("appNav");
  if (chain.appOpen) levels.push("appClose");
  if (chain.docOpen) levels.push("docClose");
  if (chain.partFocus) levels.push("partFocus");
  const descent = Math.max(0, Math.floor(chain.descent || 0));
  for (let i = 0; i < descent; i++) levels.push("descent");
  const bookAccess = Math.max(0, Math.floor(chain.bookAccess || 0));
  for (let i = 0; i < bookAccess; i++) levels.push("bookAccess");
  if (chain.pending) levels.push("patch");
  if (chain.card) levels.push("card");
  if (chain.selection) levels.push("selection");
  return levels;
}

/**
 * Which levels an event pops, in chain order. CANCEL and
 * GO_BACK_I pop exactly ONE level; GO_BACK_II pops up to TWO
 * (stopping at the chain's end). FINISH is not a back event —
 * it completes the operation in flight instead — so the
 * resolver produces no levels for it, and an unknown event
 * produces none either.
 */
export function resolveBackLevels(chain, event) {
  const count = event === EVENTS.GO_BACK_II ? 2
    : event === EVENTS.CANCEL || event === EVENTS.GO_BACK_I ? 1
    : 0;
  if (!count) return [];
  return backChainLevels(chain).slice(0, count);
}

/**
 * E's collision, resolved contextually (slice 11): E is both
 * yaw+ (the rotate cluster's first yaw key — slice 13-4 swapped
 * E and R, so E is the POSITIVE step now) and the app
 * expander slice 8 gave it. The ruling: E on an ADDRESSED
 * CITIZEN is yaw+; E when the addressed thing is the app-bearing
 * RING item, or while the app is open in CENTRE mode, is EXPAND
 * TO FULL (in app scope the transforms are suspended, so there
 * is no conflict inside the app; in centre mode the app's own
 * scope owns the key and E expands). While the app is FULL, E
 * does nothing (null). R is yaw- unconditionally.
 */
export function resolveEKey({ targetId = null, appOpen = false, appMode = null } = {}) {
  if (appOpen) return appMode === "center" ? "expand" : null;
  if (targetId && appBearerOf(targetId)) return "expand";
  if (targetId && OBJECT_IDS.includes(targetId)) return "yaw+";
  return null;
}

/**
 * The rotate keys' TARGET (slice 11, §7), in priority order:
 * (1) a hovered citizen; (2) the RING, when it is addressed —
 * its item hovered or current, or the cursor over the annulus
 * itself (the caller folds those into `ringAddressed`);
 * (3) the current citizen; (4) the fallback: THE MAIN PLATTER.
 * Scale and zoom keys do not resolve through here — they keep
 * the addressed citizen, as they always have.
 */
export function resolveRotateTarget({ hoverId = null, currentId = null, ringAddressed = false } = {}) {
  if (hoverId && OBJECT_IDS.includes(hoverId)) return { kind: "citizen", id: hoverId };
  if (ringAddressed) return { kind: "ring" };
  if (currentId && OBJECT_IDS.includes(currentId)) return { kind: "citizen", id: currentId };
  return { kind: "platter" };
}

/**
 * Platter PLANE-ROTATE (the fallback target's B/N): steps the
 * EXISTING "rotation" parameter value via setValue — that
 * parameter is the disc's own spin, so the panel and the keys
 * always agree (the goView precedent) — ANGLE_STEP-sized,
 * clamped to the parameter's −180..180 range. The Rig applies
 * it INNERMOST in the world composition, so the disc spins in
 * its own plane even after camera-space turns (§12).
 */
export function stepPlatterSpin(rotation, op) {
  const cur = Number(rotation) || 0;
  if (op === "spin-") return Math.max(-180, cur - ANGLE_STEP);
  if (op === "spin+") return Math.min(180, cur + ANGLE_STEP);
  return cur;
}

/**
 * Slice 13-3 (item 8): [ and ] — the PLATTER's plane spin on
 * dedicated keys. They step the same "rotation" parameter
 * stepPlatterSpin steps when B/N falls back to the platter, but
 * they are PLATTER-SCOPED: they always turn the platter, never
 * a hovered or current citizen (citizens keep B/N for their own
 * plane). [ is the negative step, ] the positive — the house
 * convention that a pair's first-listed key steps negative. As
 * seen from overhead (the plan view the space now opens in):
 * the parameter turns about +Y, which takes the platter's
 * north edge toward the west — so ] turns the platter
 * counter-clockwise from above and [ clockwise. The keys are
 * not letters, so they stand outside the label alphabet and
 * work in label mode too; like the digit camera keys they live
 * in the space scope — the armed command line owns them as
 * characters, an open app or message keeps its own scope, and
 * a drag lock suspends them.
 */
export const PLATTER_SPIN_KEYS = { "[": "spin-", "]": "spin+" };

/** The platter-spin op a key carries, or null (pure resolution). */
export function platterSpinOpFor(key) {
  return PLATTER_SPIN_KEYS[key] || null;
}

/**
 * Slice 13-5 (item 4): the BACKQUOTE key — a QUARTER TURN of
 * the platter's plane, 90° per press in the ] direction
 * (counter-clockwise seen from overhead). Unlike the fine
 * steps, which clamp at the parameter's ends, the quarter
 * WRAPS: the parameter is an angle, and 170° + 90° is −100°,
 * the same heading — the Rig's new damped spin glides the
 * short way round to it either way.
 */
export function stepPlatterQuarter(rotation) {
  const cur = Number(rotation) || 0;
  return ((cur + 90 + 180) % 360 + 360) % 360 - 180;
}

/* ---------------- the platter's camera-space orientation (§12) ---------------- */

/**
 * When the rotate target is THE PLATTER, the cluster turns the
 * world AS THE CAMERA SEES IT: each step PREMULTIPLIES the
 * platter's accumulated orientation by a rotation about the
 * camera's own axes — yaw about the camera's up, pitch about
 * its right, roll about its view axis. The orientation is one
 * quaternion, held by the App as a plain [x, y, z, w] array
 * (identity at start) and stepped by these dependency-free
 * helpers; the view only supplies the camera's axes (through
 * the shared ref the Rig already publishes) and applies the
 * result. Loading a named view resets it to identity — a named
 * view is an absolute camera position, and leftover world
 * turns would fight it.
 */
export const IDENTITY_QUAT = [0, 0, 0, 1];

/** A quaternion ([x,y,z,w]) for `deg` about `axis` (need not be unit). */
export function quatAxisAngle(axis, deg) {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const half = (deg * Math.PI) / 360;
  const s = Math.sin(half) / len;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
}

/** Hamilton product a ⊗ b (the rotation b, then a, in world terms). */
export function quatMultiply(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** The inverse rotation (conjugate, normalised). */
export function quatInvert(q) {
  const [x, y, z, w] = q;
  const n = x * x + y * y + z * z + w * w || 1;
  return [-x / n, -y / n, -z / n, w / n];
}

/** Rotate a vector [x, y, z] by a quaternion [x, y, z, w]. */
export function quatRotateVec(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

/**
 * A rotation's YAW: the heading of its +Z axis on the ground
 * plane, in radians — the same extraction the Rig publishes as
 * frame.worldYaw (atan2 of the rotated +Z), as a pure function.
 */
export function quatYawOf(q) {
  const z = quatRotateVec(q && q.length === 4 ? q : IDENTITY_QUAT, [0, 0, 1]);
  return Math.atan2(z[0], z[2]);
}

/**
 * Slice 13-3 (item 5) — THE GIMBAL. The counter-rotation a
 * citizen's mount applies against the platter's composed
 * rotation Q (platterQuat ∘ rotation parameter ∘ turntable
 * yaw): gimbal = Q⁻¹ ∘ Ry(yaw(Q)), so that
 *
 *   Q ∘ gimbal = Ry(yaw(Q))   exactly.
 *
 * A citizen whose pivot is fixed in the slab at its plot point
 * and whose orientation is composed as Q ∘ gimbal ∘ (its own
 * transform) therefore ends up oriented by slab YAW ∘ its own
 * transform alone: it rides its plot point as the slab turns
 * (its position follows the slab completely), keeps its facing
 * relative to the platter as the turntable turns, and does NOT
 * inherit the slab's pitch or roll — a level-keeping gimbal
 * mount. Pitch the platter and you see the citizens' own
 * undersides swing over their sockets, not the slab's underside
 * with everything frozen to it. Clearance is the socket's own
 * argument: the citizen's geometry lies inside its protective
 * sphere about its pivot (PROTECTIVE_R, below); the pivot stays
 * CENTRE_Y above the slab plane at the plot point under ANY
 * slab rotation (the mount is slab-fixed), and a sphere's
 * cross-section at that plane is a disc of
 * sphereCutRadius(R + clearance, CENTRE_Y, 0) — the socket
 * radius — whatever the relative tilt, because the relative
 * rotation is a rotation about the pivot and a sphere is
 * invariant under those. The numeric test in
 * tests/slice-13-3.test.mjs samples exactly this claim.
 */
export function gimbalQuatFor(platterQuat) {
  const q = platterQuat && platterQuat.length === 4 ? platterQuat : IDENTITY_QUAT;
  const yawDeg = (quatYawOf(q) * 180) / Math.PI;
  return quatMultiply(quatInvert(q), quatAxisAngle([0, 1, 0], yawDeg));
}

const PLATTER_AXIS_FOR_OP = { yaw: "up", pitch: "right", roll: "forward" };

/**
 * One cluster step of the platter's orientation: premultiply
 * `quat` by ANGLE_STEP about the camera axis the op names
 * (axes = { up, right, forward }, world-space unit vectors the
 * Rig reports). Spin/scale ops are not the quaternion's
 * business and return it unchanged.
 */
export function stepPlatterQuat(quat, axes, op) {
  const cur = quat && quat.length === 4 ? quat : IDENTITY_QUAT;
  if (!axes || !op) return [...cur];
  const axisName = PLATTER_AXIS_FOR_OP[op.slice(0, -1)];
  const axis = axisName ? axes[axisName] : null;
  if (!axis) return [...cur];
  const dir = op.endsWith("-") ? -1 : 1;
  return quatMultiply(quatAxisAngle(axis, dir * ANGLE_STEP), cur);
}

/**
 * The SCALE keys' target, decided purely: the addressed citizen
 * when the addressee is one (hover wins, as always — scale is
 * not part of the rotate resolution); "platter" when the
 * rotate resolution falls back to the platter — where scale is
 * DECLINED (the main platter does not scale; C/V dolly the
 * camera); otherwise "none" (the ring addressed: scale simply
 * has no purchase there, as it never has).
 */
export function resolveScaleTarget({ hoverId = null, currentId = null, ringAddressed = false } = {}) {
  const id = addressedId(hoverId, currentId);
  if (id && OBJECT_IDS.includes(id)) return { kind: "citizen", id };
  const t = resolveRotateTarget({ hoverId, currentId, ringAddressed });
  return t.kind === "platter" ? { kind: "platter" } : { kind: "none" };
}

/**
 * The ring's manual spin offset (degrees): E/R yaw steps it by
 * ANGLE_STEP while the ring is the rotate target, and B/N
 * plane-rotate drives the SAME offset (the ring's plane is its
 * own plane; both pairs turn it). The view adds the offset to
 * the same group rotation the ring's rest machinery drives
 * (see PlatterRing in SpaceView.jsx for the reconciliation).
 * Pitch/roll do not apply to the ring — the ring only spins.
 */
export function stepRingSpin(offsetDeg, op) {
  const cur = Number(offsetDeg) || 0;
  if (op === "yaw-" || op === "spin-") return cur - ANGLE_STEP;
  if (op === "yaw+" || op === "spin+") return cur + ANGLE_STEP;
  return cur;
}

/* ---------------- selection ---------------- */

/**
 * The Tab cycle: reading order, wrapping both ways. From nothing,
 * forward selects the first object, backward the last.
 */
export function cycleSelection(currentId, dir) {
  const ids = OBJECT_IDS;
  const i = ids.indexOf(currentId);
  if (i < 0) return dir < 0 ? ids[ids.length - 1] : ids[0];
  return ids[(i + dir + ids.length) % ids.length];
}

/** The object the transform and patch keys act on. */
export function addressedId(hoverId, currentId) {
  return hoverId || currentId || null;
}

/**
 * F is the click, and the click lands on the ADDRESSED thing —
 * the one under the cursor when there is one, otherwise the
 * current one. F's decision is pure so the regression the user
 * hit (hover an object, press F, nothing opens, because only a
 * previously-clicked current object was consulted) stays caught:
 *
 *   - a live patch completes onto the addressed target;
 *   - the knot with one of its parts hovered focuses that part;
 *   - an inspect-on-F target (a media card, the clipboard tray)
 *     inspects;
 *   - any other addressed thing opens (its card stands in space);
 *   - nothing addressed is a no-op.
 *
 * `inspectIds` names the inspect-on-F targets; `partId` is the
 * hovered knot part, already validated by the caller, and only
 * applies when the addressed target is the knot itself. `branchId`
 * (slice 7) is the data tree's analogue: the hovered depth-1 branch,
 * validated by the caller, applying only when the addressed target
 * is the tree — it resolves to a branchFocus action that reuses the
 * part-focus state, with partId = the depth-1 node's id.
 *
 * `subId` (slice 12) is the hovered SUB-NODE of the tray, the
 * tangled tree or a sunburst, validated by the caller against the
 * provider (subnodes.js) and applying only when the addressed
 * target is that sub-node's citizen. The tray's and the tangle's
 * sub-nodes take the part-focus seat, like the knot's parts —
 * and so do the DEVICES citizen's (slice 14): its shelf devices,
 * its network hub, and its hosts, whose anchors stand out on the
 * ring while their addresses belong to the shelf. The
 * sunbursts split on `subLeaf`: a LEAF wedge seats; a BRANCH
 * wedge DESCENDS — the citizen re-roots at that wedge (see the
 * descent state below).
 *
 * The BOOK (slice 13-2) splits on `subTier` — the hovered node's
 * depth in its tiers (1 chapter, 2 section, 3 page): a chapter
 * or a section is ACCESSED (the drum turns to it; see the book
 * access state below), and a PAGE, in the CYLINDER presentation,
 * comes OUT of the drum — the access path extended to the page.
 * In the SPREAD presentation a page instead turns the book to
 * that page's spread. `bookStyle` carries the presentation.
 */
export function resolveFAction({
  pendingId = null,
  hoverId = null,
  currentId = null,
  partId = null,
  branchId = null,
  subId = null,
  subLeaf = false,
  subTier = 0,
  subRoot = false,
  bookStyle = "cylinder",
  inspectIds = [],
} = {}) {
  const targetId = addressedId(hoverId, currentId);
  if (pendingId) {
    return targetId && targetId !== pendingId
      ? { type: "completePatch", targetId }
      : { type: "none", targetId: null };
  }
  if (!targetId) return { type: "none", targetId: null };
  if (targetId === "knot" && partId) {
    return { type: "partFocus", targetId, partId };
  }
  if (targetId === "tree" && branchId) {
    return { type: "branchFocus", targetId, partId: branchId };
  }
  if (targetId === "book" && subId) {
    // Slice 13-3 (item 3): the book's ROOT tier (subTier 0 —
    // the whole book itself) is not an access target: its tier
    // chain is empty, so "accessing" it would silently reset
    // every accessed tier — an F that undoes the book's state
    // while claiming to act inside it. It resolves to an
    // honest no-op instead; the backs are how access unwinds.
    if (subTier < 1) return { type: "bookNoop", targetId };
    if (subTier >= 3) {
      return bookStyle === "spread"
        ? { type: "bookSpreadTo", targetId, nodeId: subId }
        : { type: "bookPage", targetId, nodeId: subId };
    }
    return { type: "bookAccess", targetId, nodeId: subId };
  }
  if (targetId === "mail" && subId) {
    // Slice 15: the mail citizen splits on the node's kind — a
    // FOLDER takes the part-focus seat, like the tray's plates;
    // a MESSAGE (mail/msg/<id>, a letter on the post shelf)
    // OPENS: it stands on the centre stage to be read, at the
    // docClose tier of the release stack.
    return subId.startsWith("mail/msg/")
      ? { type: "openMessage", targetId, messageId: subId }
      : { type: "partFocus", targetId, partId: subId };
  }
  if ((targetId === "tray" || targetId === "tangle" || targetId === "devices") && subId) {
    return { type: "partFocus", targetId, partId: subId };
  }
  if ((targetId === "mesa" || targetId === "drum") && subId) {
    // Slice 13-3 (item 4): the centre disc reports the DISPLAY
    // ROOT itself as its sub-node (subRoot) — F there is an
    // honest no-op, never a descent into the root (whose
    // "descent" would rebuild the same wedges under a phantom
    // level of the release stack). The centre names the whole;
    // F descends into a wedge.
    if (subRoot) return { type: "rootNoop", targetId };
    return subLeaf
      ? { type: "partFocus", targetId, partId: subId }
      : { type: "descend", targetId, nodeId: subId };
  }
  if (inspectIds.includes(targetId)) return { type: "inspect", targetId };
  return { type: "open", targetId };
}

/**
 * The Tab cycle over EVERYTHING addressable, in a stated order:
 * the objects first, then the media library's cards (only
 * while the library is open — closed, they are inside the cabinet
 * and not addressable), then the clipboard tray (only while it is
 * summoned). Wraps both ways.
 */
export function cycleInList(ids, currentId, dir) {
  if (!ids.length) return null;
  const i = ids.indexOf(currentId);
  if (i < 0) return dir < 0 ? ids[ids.length - 1] : ids[0];
  return ids[(i + dir + ids.length) % ids.length];
}

export function cycleAddressable(currentId, dir, { cardIds = [], clipboardPresent = false } = {}) {
  const ids = [...OBJECT_IDS, ...RING_IDS, ...cardIds, ...(clipboardPresent ? ["clipboard"] : [])];
  return cycleInList(ids, currentId, dir);
}

/* ---------------- cables ---------------- */

/** Cables are unordered pairs, stored in one canonical order. */
export function cableKey(a, b) {
  return [a, b].sort().join("|");
}

export function hasCable(state, a, b) {
  const k = cableKey(a, b);
  return state.cables.some(([x, y]) => cableKey(x, y) === k);
}

/**
 * Complete a patch from a to b. Rejects a self-patch and a
 * duplicate (in either direction) without touching the state.
 */
export function addCable(state, a, b) {
  if (!a || !b) return { state, ok: false, reason: "missing end" };
  if (a === b) return { state, ok: false, reason: "self-patch" };
  if (hasCable(state, a, b)) return { state, ok: false, reason: "duplicate" };
  const pair = cableKey(a, b).split("|");
  return { state: { ...state, cables: [...state.cables, pair] }, ok: true, reason: null };
}

/** J: strip every cable touching the object. */
export function removeCablesTouching(state, id) {
  if (!id) return state;
  const cables = state.cables.filter(([a, b]) => a !== id && b !== id);
  if (cables.length === state.cables.length) return state;
  return { ...state, cables };
}

export function cablesTouching(state, id) {
  return state.cables.filter(([a, b]) => a === id || b === id);
}

/* ---------------- layouts ---------------- */

export const PLATTER_R = 198;
/** Dragging keeps an object's centre inside this radius. */
export const GROUND_CLAMP_R = 184;

export function clampGround(x, z, r = GROUND_CLAMP_R) {
  const d = Math.hypot(x, z);
  if (d <= r || d === 0) return { x, z };
  return { x: (x / d) * r, z: (z / d) * r };
}

const ringPositions = () => {
  const pos = {};
  OBJECT_IDS.forEach((id, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / OBJECT_IDS.length;
    pos[id] = [Math.cos(a) * 130, Math.sin(a) * 130];
  });
  return pos;
};

/**
 * Loadable arrangements, in the spirit of nibglider's layouts.
 * `positions` are platter-plane [x, z] per object; `scales` is a
 * presence multiplier for the layout only (the object's own scale
 * transform multiplies on top of it).
 */
export const LAYOUTS = {
  ring: {
    name: "RING",
    blurb: "Every object on the circle, equal citizens.",
    positions: ringPositions(),
    scales: {},
  },
  districts: {
    name: "DISTRICTS",
    blurb: "Graphs together, monitors together, instruments together.",
    positions: {
      mesa: [-100, -72], drum: [-38, -80], tray: [-102, -18], cube: [-40, -22],
      horizon3d: [52, -78], horizonflat: [112, -52],
      tangle: [-30, 72], arch: [38, 52], definition: [92, 86],
      knot: [-100, 34],
      crystal: [-52, 30],
      tree: [-148, -30],
      book: [-95, 95],
      devices: [30, 108],
      mail: [96, 30],
    },
    scales: {},
  },
  theatre: {
    name: "THEATRE",
    blurb: "The cube centre-stage; the rest in a shallow arc behind it.",
    positions: {
      cube: [0, 18],
      mesa: [-118, -72], drum: [-64, -98], tray: [0, -108],
      tangle: [64, -98], horizon3d: [118, -72],
      horizonflat: [-126, -2], arch: [126, -2], definition: [0, -48],
      knot: [-92, 46],
      crystal: [92, 46],
      tree: [-56, 84],
      book: [0, 92],
      devices: [58, 102],
      mail: [-112, 84],
    },
    scales: { cube: 1.6 },
  },
};

/**
 * The layout keys (slice 11, §13+§14): OBJECT keys — they
 * rearrange the citizens on the platter; the camera does not
 * move. They live at 7/8/9 since the number row became the
 * camera's (§14): 1–4 are the named views, 5/6 the field sizes.
 */
export const LAYOUT_KEYS = { "7": "ring", "8": "districts", "9": "theatre" };

/** Switch arrangement: positions change, transforms and cables persist. */
export function applyLayout(state, name) {
  const layout = LAYOUTS[name];
  if (!layout) return state;
  const positions = {};
  for (const id of OBJECT_IDS) {
    const [x, z] = layout.positions[id];
    positions[id] = { x, z };
  }
  return { ...state, layout: name, positions };
}

/** Drop an object where a drag left it. */
export function setObjectPosition(state, id, x, z) {
  if (!state.positions[id]) return state;
  const p = clampGround(x, z);
  return { ...state, positions: { ...state.positions, [id]: { x: p.x, z: p.z } } };
}

/* ---------------- the protective sphere: the platter's well ---------------- */

/**
 * THE PROTECTIVE SPHERE (the user's rule): a rotating thing is
 * enclosed by the swept envelope of its rotation about its
 * pivot — a sphere — and the BASE yields to it: geometry is
 * subtracted from the base wherever the sphere would intersect
 * it. The thing is never confined to fit inside a semisphere;
 * the base is cut instead. This section is the rule's first
 * application, to the main platter itself.
 *
 * THE ASSEMBLY: the world group — everything that receives the
 * composed rotation (platterQuat ∘ the rotation parameter +
 * turntable yaw) in the Rig. Its pivot is the group origin,
 * the platter's centre at its surface plane (0,0,0). Riding it:
 * the platter drum (the pedestal cylinder, r 198/205, top at
 * y −0.05, bottom −3.05) and rim, all twelve citizens and their
 * cables, the ring and its tokens, the waveform stage, the XY
 * media wall and the YZ datum wall, and the scenery (atmosphere
 * knots, crystal cluster, botanical tree).
 *
 * PLATTER_PROTECTIVE_R is the assembly's farthest reach from
 * the pivot, enumerated from the scene's own numbers (the
 * platter-well tests recompute each and hold the constant to
 * them):
 *   XY back wall top corners (±184, 164, −196) .... 314.9  ← max
 *   YZ side wall top corners (196, 164, ±184) ..... 314.9
 *   ring outer edge + app tokens (235, ~14) ....... 235.4
 *   a citizen at the drag clamp (184) + its
 *     miniature's extent (≤ ~35) .................. ≤ ~219
 *   platter drum bottom rim (205, −3.05) .......... 205.0
 *   botanical tree (centre 174.1 + ~21 grown) ..... ~196
 *   crystal cluster ............................... ~192
 *   waveform stage, full dais + fence ............. ~188
 *   atmosphere knots .............................. ~177
 *   an inspected citizen (centre held at 36 by the
 *     facing math, + its scaled extent ≤ ~52) ..... ≤ ~88
 * Citizens in standing form are inside it. A citizen's OWN
 * envelope under its own transforms (magnify, its private
 * turns) is the same rule's next application — its socket in
 * the platter's top — and is not this sphere's business.
 */
export const PLATTER_PROTECTIVE_R = 315;
/** Extra radius the base keeps beyond the sphere itself. */
export const PROTECTIVE_CLEARANCE = 2;

/**
 * Each citizen's own envelope — CENTRE_Y (its rotation pivot)
 * and PROTECTIVE_R (its protective sphere) — is tabulated
 * below, beside the socket math that consumes it; the gimbal
 * (slice 13-3, item 5) and its clearance proof read the same
 * tables. citizenSocketRadius is that section's socketRadius
 * under the name slice 13-3 gave it.
 */

/** The ground plane's height — the one static base's surface. */
export const GROUND_Y = -3.6;

/**
 * The radius of the circle a protective sphere of the given
 * radius cuts in a horizontal plane at planeY, for a pivot at
 * pivotY: sqrt(R² − d²) where d is the plane's distance from
 * the pivot. Null when the plane never meets the sphere (at or
 * beyond its reach, or a degenerate radius) — nothing to cut.
 */
export function sphereCutRadius(sphereRadius, pivotY, planeY) {
  if (!(sphereRadius > 0)) return null;
  const d = Math.abs(planeY - pivotY);
  if (d >= sphereRadius) return null;
  return Math.sqrt(sphereRadius * sphereRadius - d * d);
}

/**
 * The well cut into the ground for the platter's sphere: the
 * sphere, grown by the clearance, cross-sectioned at the
 * ground plane. Every point of the floor that remains is at
 * least PLATTER_PROTECTIVE_R + PROTECTIVE_CLEARANCE from the
 * pivot, and every point of the assembly is within
 * PLATTER_PROTECTIVE_R of it — rotation preserves distances,
 * so at ANY yaw/pitch/roll the assembly cannot reach the
 * floor. ≈316.98.
 */
export const PLATTER_WELL_R = sphereCutRadius(
  PLATTER_PROTECTIVE_R + PROTECTIVE_CLEARANCE, 0, GROUND_Y,
);

/* ---------------- the citizens' sockets: the rule at citizen scale ---------------- */

/**
 * Slice 11 (§5): the ROTATION PIVOT of each citizen — the centre
 * of its local 3D bounds, as built. The citizen's rotation group
 * sits at (0, CENTRE_Y, 0) with the content offset by −CENTRE_Y
 * inside it, so yaw/pitch/roll turn the object about its bounds
 * centre in all three axes, not about its ground origin. Each
 * value is the midpoint of the miniature's built height range.
 * (The table lives here, beside the socket math that consumes
 * it; SpaceView imports it for the rotation groups.)
 */
export const CENTRE_Y = {
  mesa: 6, // sunburst wedges stack 0..12
  drum: 11.5, // drum wall and wedges 0..22.9, rim torus at 22.2
  tray: 4, // tray floor and cuboids 0..8.2
  cube: 16, // the shell is centred at 16, 32.5 across
  tangle: 12, // base plate plus seven level sheets to ~23.8
  horizon3d: 8, // base at 1.6, towers to ~15.6
  horizonflat: 14.5, // the panel stands ~1..29 (group at y 15, panel 28 tall)
  arch: 17, // the sheet cylinder is centred at 17, 31 tall
  definition: 9.5, // base plate plus nodes/wires to ~19
  knot: 12.5, // KNOT_CY — the tube rides ±~8 about it
  crystal: 14.5, // pedestal 0..4; the solid ±12.1 about CRYSTAL_CY 17 → bounds 0..29
  tree: 14.7, // segments 0..27.2 in the sway group at 2.2, soil 0..2.2 → bounds 0..29.4
  book: 13, // plinth 0..1.6, drum body to 25.6, cap rim ~26.3 → bounds 0..26.3
  devices: 7, // shelf 0..1.6, the display's screen top ~14.4 → bounds 0..14.4
  mail: 12.5, // plinth 0..1.6, cabinet body to ~23.6, letters on top ~25 → bounds 0..25
};

/**
 * THE PROTECTIVE SPHERE AT CITIZEN SCALE — the user's rule
 * again, the same one that cut the well beneath the platter:
 * each citizen tumbles about its pivot, its turning sweeps a
 * sphere, and the base yields to it. Here the base is the
 * platter's own top, and it yields with a SOCKET: a circular
 * through-hole at the citizen's plot, of the sphere's
 * cross-section radius at the platter plane, so the citizen
 * dips through the slab instead of into it. The slab is 3
 * thick and every sphere's reach below the plane is deeper
 * than that (5.7–35.2, per the measurement), so no socket
 * could be a mere dish — the base gives way entirely, exactly
 * as the ground did.
 *
 * PROTECTIVE_R is each citizen's sphere radius: the farthest
 * reach of its geometry from its pivot, measured on the built
 * miniatures (the sockets analysis; the binding point is named
 * per citizen). Each citizen is sized for the LARGEST state it
 * can be in while it can tumble — see the book.
 */
export const PROTECTIVE_R = {
  tray: 39.20, // the glass tray's own bottom corners (±29.5, 0, ±25.5)
  horizon3d: 33.96, // the base cylinder's bottom rim (r 33 at y 0)
  tangle: 36.73, // the base plate's bottom corners (±26, 0, ±23) — either course
  definition: 31.48, // the base plate's bottom corners (±26, 0, ±15)
  mesa: 25.86, // the depth-2 wedge rim (r 25.15 at y 0)
  drum: 29.81, // the plinth's bottom rim (r 27.5 at y 0)
  arch: 33.12, // a foot block's bottom outer corner (22, 0, 18) — the feet bind, not the sheet
  horizonflat: 30.27, // the foot block's back-bottom corner (25, 0, 9)
  book: 43.54, // PAGE OUT: a slid-out leaf's edge reaches r 42.2 (the standing form measures 28.30)
  cube: 28.22, // face-tile corners ≈ shell corners
  tree: 26.04, // the soil disc's bottom rim (r 21.5 at y 0); its ambient sway is small — the clearance covers it
  knot: 20.04, // a sweep vertex, measured on the tube geometry itself
  crystal: 20.16, // the pedestal's bottom rim (r 14 at y 0); the living solid never reaches it, in any drift state — state-independent
  devices: 24.06, // the shelf's bottom corners (±19, 0, ±13) about (0, 7, 0): √579 — measured on MiniDevices, which postdates the analysis
  mail: 23.65, // the cabinet's plinth corners bind (√559.5) — measured on the built MiniMail in slice 13-3's session; the mail citizen postdates the sockets slice, so its sphere joins the table at this integration
};

/**
 * The radius of citizen id's socket: its protective sphere,
 * grown by PROTECTIVE_CLEARANCE — the well's convention exactly
 * (the clearance grows the sphere before the cross-section is
 * taken; it is not added to the cut radius) — cross-sectioned
 * at the citizens' standing plane, y = 0. The slab's top face
 * lies 0.05 below that plane, where the sphere's section is a
 * hair smaller, so the cut is conservative at the face itself;
 * and below the plane the section only shrinks, so this one
 * radius clears the whole slab.
 */
export function socketRadius(id) {
  const r = PROTECTIVE_R[id];
  const cy = CENTRE_Y[id];
  if (r == null || cy == null) return null;
  return sphereCutRadius(r + PROTECTIVE_CLEARANCE, cy, 0);
}

/** Slice 13-3's name for the same radius — its gimbal clearance
 *  proof reads it under this name. One function, two call sites'
 *  vocabularies. */
export const citizenSocketRadius = socketRadius;

/**
 * The socket circles for a positions map ({ id: {x, z} } — the
 * App state's plots, rewritten by layout switches and drag
 * drops): one circle per citizen at its current home. The View
 * cuts exactly these into the platter's top (platter-top.js)
 * and cuts them again when the map changes; during a drag the
 * map does not move, so no socket is ever cut mid-carry.
 */
export function socketCircles(positions) {
  const out = [];
  for (const id of OBJECT_IDS) {
    const p = positions ? positions[id] : null;
    const r = socketRadius(id);
    if (!p || r == null) continue;
    out.push({ id, x: p.x, z: p.z, r });
  }
  return out;
}

/* ---------------- slice 13-5 (item 6): the info card stands clear ---------------- */

/**
 * THE INFO CARD'S PLACEMENT. The in-space info card (.us-info —
 * the citizen's entered card and the sub-node card) is a
 * projected overlay, and left to its anchor it can land ON TOP
 * of the citizen it describes. The rule: the card's rectangle
 * must not intersect the citizen's PROTECTIVE SPHERE projected
 * to screen space (centre = the citizen's pivot — plot +
 * CENTRE_Y — radius = PROTECTIVE_R × its scale, the same sphere
 * the sockets are cut from). The card is displaced OUTWARD from
 * the sphere: above it first, then its right, then its left,
 * then below — each candidate clamped inside the viewport —
 * and the first candidate that clears the circle wins. If the
 * sphere covers so much of the screen that no candidate clears
 * it, the candidate with the most clearance is used, still
 * clamped on-screen: the card never leaves the viewport.
 * Pure: (anchor point, sphere screen circle, card size,
 * viewport) → the card's top-left { x, y }. The anchor is the
 * card's subject point (the citizen's anchor, the sub-node's
 * centre) — candidates centre on it horizontally (above/below)
 * or vertically (the sides), so the card still reads as
 * belonging to its anchor; only its placement changes.
 */
export function rectCircleIntersects(rect, circle) {
  const nx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - nx;
  const dy = circle.y - ny;
  return dx * dx + dy * dy < circle.r * circle.r;
}

/** How far a rect stands clear of a circle (negative = overlap depth). */
export function rectCircleClearance(rect, circle) {
  const nx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  return Math.hypot(circle.x - nx, circle.y - ny) - circle.r;
}

export function placeInfoCard({ anchor, sphere, card, viewport, gap = 10, margin = 8 } = {}) {
  const w = Math.max(0, card ? card.w : 0);
  const h = Math.max(0, card ? card.h : 0);
  const vw = viewport ? viewport.w : 0;
  const vh = viewport ? viewport.h : 0;
  const clampX = (x) => Math.max(margin, Math.min(Math.max(margin, vw - margin - w), x));
  const clampY = (y) => Math.max(margin, Math.min(Math.max(margin, vh - margin - h), y));
  const ax = anchor ? anchor.x : vw / 2;
  const ay = anchor ? anchor.y : vh / 2;
  if (!sphere || !(sphere.r > 0)) {
    // No sphere to clear: the standing placement — above the
    // anchor, centred on it, clamped on-screen.
    return { x: clampX(ax - w / 2), y: clampY(ay - h - gap) };
  }
  const candidates = [
    // Above the sphere, centred on the anchor.
    { x: clampX(ax - w / 2), y: clampY(sphere.y - sphere.r - gap - h) },
    // Right of the sphere, centred on the anchor's height.
    { x: clampX(sphere.x + sphere.r + gap), y: clampY(ay - h / 2) },
    // Left of the sphere.
    { x: clampX(sphere.x - sphere.r - gap - w), y: clampY(ay - h / 2) },
    // Below the sphere.
    { x: clampX(ax - w / 2), y: clampY(sphere.y + sphere.r + gap) },
  ];
  let best = null;
  let bestClear = -Infinity;
  for (const c of candidates) {
    const rect = { x: c.x, y: c.y, w, h };
    const clear = rectCircleClearance(rect, sphere);
    if (clear >= 0) return c;
    if (clear > bestClear) { bestClear = clear; best = c; }
  }
  return best || candidates[0];
}

/* ---------------- the dolly (C/V) and the focal zoom (5/6) ---------------- */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
/**
 * Slice 13-5 (item 2): the dolly has TWO step sizes now. The
 * COARSE step (1.15, the historical ZOOM_STEP) is the SWEEP —
 * it lives on Shift+C / Shift+V. The FINE step (1.045) is the
 * bare keys': a small proportional nudge the Rig's damping
 * eases to, with the rotate keys' feel — at the world range a
 * press moves the seat ~4.5% of its distance, and at the
 * entered seat's range the same proportion, so the control
 * reads as fine in both. Both steps clamp to the same range.
 */
export const ZOOM_STEP = 1.15;
export const DOLLY_COARSE_STEP = ZOOM_STEP;
export const DOLLY_FINE_STEP = 1.045;

/**
 * One DOLLY step of the camera distance multiplier (C/V — the
 * camera itself moves; §14 separated this from the focal zoom
 * and named it honestly). dir +1 dollies IN (key V, distance
 * shrinks), dir -1 dollies OUT (key C). Clamped. `coarse`
 * selects the sweep step (Shift+C/V); the default is the fine
 * step of the bare keys. (The function's name predates the
 * film-terms scheme; it is internal.)
 */
export function zoomStep(mul, dir, coarse = false) {
  const step = coarse ? DOLLY_COARSE_STEP : DOLLY_FINE_STEP;
  const next = dir > 0 ? mul / step : mul * step;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
}

/**
 * The DOLLY's target citizen (C/V), decided purely. A HOVERED
 * citizen wins — slice 11 §4's dolly-at-cursor, unchanged.
 * Otherwise the OPENED citizen: the one F flew to, whose card
 * stands open in the space — in the shipped state that is
 * cardId === currentId, exactly what the F "open" action sets —
 * so the dolly travels INTO the opened thing after the pointer
 * has left it, instead of falling back to the world dolly.
 * Otherwise null: the plain world dolly toward the platter
 * centre. (The Waveform app's scope never reaches here — its
 * C/V are the window zoom, handled in its own branch.)
 */
export function resolveDollyTarget({ hoverId = null, currentId = null, cardId = null } = {}) {
  if (hoverId && OBJECT_IDS.includes(hoverId)) return hoverId;
  if (cardId && cardId === currentId && OBJECT_IDS.includes(cardId)) return cardId;
  return null;
}

/**
 * The CITIZEN SEAT's floor: at the dolly's deepest step the seat
 * stands at this fraction of the F-seat distance. The world
 * dolly's own range (ZOOM_MIN..ZOOM_MAX) is untouched — the
 * remap below lives only in the citizen seat's scaling.
 */
export const CITIZEN_SEAT_MIN = 0.4;

/**
 * The citizen seat's offset scale for a dolly multiplier. Below
 * 1, the multiplier's range [ZOOM_MIN..1] is remapped onto
 * [CITIZEN_SEAT_MIN..1], so travelling in from the F seat does
 * not stop at the world dolly's half distance: at the floor the
 * seat is CITIZEN_SEAT_MIN × the F-seat distance. At 1 the scale
 * is exactly 1 (the F seat itself), and above 1 the multiplier
 * passes through, so C pulls back out through the same range V
 * came in on. The floor keeps a sane stand-off: at citizen
 * scale 1 the seat's radial offset is (42 + 30) × 0.4 ≈ 29 from
 * the citizen's base — outside the largest miniature's
 * half-extent (the treemap tray's 27) — and the offsets grow
 * with the citizen's own scale, as they do at the F seat.
 */
export function citizenSeatScale(mul) {
  if (mul >= 1) return mul;
  const t = Math.max(0, Math.min(1, (mul - ZOOM_MIN) / (1 - ZOOM_MIN)));
  return CITIZEN_SEAT_MIN + t * (1 - CITIZEN_SEAT_MIN);
}

/**
 * The citizen seat's offsets from the citizen's base, as data:
 * out along the citizen's radial, and up. mul 1 is the F seat
 * itself (the entered card's seat, and the dolly seat at rest);
 * a dolly multiplier scales
 * the offsets by citizenSeatScale. The view makes vectors of
 * these — this is the seat math's pure core.
 */
export function citizenSeatOffsets(scale = 1, mul = 1) {
  const s = citizenSeatScale(mul);
  return { radial: (42 + 30 * scale) * s, up: (25 + 9 * scale) * s };
}

/** The citizen seat's distance from the citizen's base (the offsets' length). */
export function citizenSeatDistance(scale = 1, mul = 1) {
  const o = citizenSeatOffsets(scale, mul);
  return Math.hypot(o.radial, o.up);
}

/* ---------------- slice 13-4 (item A): the entry seat basis ---------------- */

/**
 * THE ENTRY SEAT BASIS. The camera is authored by camera
 * actions only: when a citizen's card opens, the seat it is
 * entered at is captured from the citizen's state AT THAT
 * MOMENT — its effective scale (transform scale × the layout's
 * presence scale) — and while the card stands, the Rig seats
 * from this stored basis, never from the citizen's live scale.
 * MAGNIFY while entered then changes only the citizen's
 * transform; the camera does not reframe. The dolly multiplier
 * still composes onto the basis (citizenSeatOffsets(basis.
 * scale, mul)), so C/V travel the seat line the entry made.
 * The basis invalidates exactly when the card closes or the
 * layout changes — the App holds it in state keyed by the card
 * and the layout, and passes it to the View, which resolves
 * the scale for any seat through entrySeatScale.
 */
export function captureEntrySeat(id, scale, layout = null) {
  if (!id || !OBJECT_IDS.includes(id)) return null;
  const s = Number(scale);
  if (!Number.isFinite(s) || s <= 0) return null;
  return { id, scale: s, layout };
}

/**
 * The scale a seat for `id` is computed from: the ENTRY basis's
 * scale while the basis names this citizen, else the citizen's
 * live (display) scale — so seats outside an entered citizen
 * (the plain dolly seat, a hovered citizen) behave exactly as
 * they always have, and only the entered citizen's seat is
 * frozen at its entry.
 */
export function entrySeatScale(entrySeat, id, liveScale) {
  return entrySeat && entrySeat.id === id ? entrySeat.scale : liveScale;
}

/**
 * Slice 13-3 (item 2): the dolly's focus, generalised from a
 * citizen to whatever the hand is on. The priority is the
 * brief's: (a) the hovered SUB-NODE's anchor point — a wedge, a
 * book page, a device, a host token, a mail folder or letter,
 * at the world anchor the sub-node system publishes for its
 * cards; (b) the hovered citizen's seat, else the OPENED
 * citizen's (resolveDollyTarget, unchanged); (c) the raw
 * CURSOR POINT — the world point under the pointer, published
 * by the View's hover raycast (a citizen body with no sub-node
 * hovered, the platter, the slab); (d) the world dolly.
 * `subAnchor` is the View's published anchor for the CURRENT
 * sub-hover ({ point: [x, y, z], radius } | null — the caller
 * validates it against the live sub-hover); `cursorPoint` is
 * [x, y, z] | null. Point foci seat the camera along its
 * current view direction toward the point (the Rig's half);
 * citizen foci keep the citizen seat. The release rules are
 * the standing zoomFocus rules, unchanged: the focus clears on
 * selection change, on any back event, on a layout change, and
 * when the multiplier returns to 1.
 *
 * Slice 13-4 (item A): while a citizen stands ENTERED
 * (`enteredId` — its card open and it current), the focus
 * narrows to that citizen's own world: a sub-node anchor is
 * honoured only when it belongs to the entered citizen
 * (`subAnchorObjectId`), a citizen focus only when it IS the
 * entered citizen, and the raw cursor point only when the
 * cursor is on the entered citizen (`cursorOnEntered`). A
 * focus for a DIFFERENT citizen is never resolved while a card
 * is open, so none can sit suppressed and apply all at once
 * when the card closes. With no citizen entered, the three
 * extra inputs are inert and the resolution is slice 13-3's.
 */
export function resolveDollyFocus({
  subAnchor = null, hoverId = null, currentId = null, cardId = null, cursorPoint = null,
  enteredId = null, subAnchorObjectId = null, cursorOnEntered = false,
} = {}) {
  const entered = enteredId && OBJECT_IDS.includes(enteredId) ? enteredId : null;
  if (subAnchor && Array.isArray(subAnchor.point)
    && (!entered || subAnchorObjectId === entered)) {
    return { kind: "point", via: "sub", point: [...subAnchor.point], radius: subAnchor.radius || 0 };
  }
  const citizen = resolveDollyTarget({ hoverId, currentId, cardId });
  if (citizen && (!entered || citizen === entered)) return { kind: "citizen", id: citizen };
  if (Array.isArray(cursorPoint) && (!entered || cursorOnEntered)) {
    return { kind: "point", via: "cursor", point: [...cursorPoint], radius: 0 };
  }
  return { kind: "world" };
}

/** A point focus's standing reading distance at multiplier 1. */
export const DOLLY_POINT_BASE = 60;
/**
 * A point focus's minimum stand-off: the camera never enters
 * the point. Sub-node anchors carry radii up to ~9 (a book
 * leaf, a host plate); 14 stands clear of every element the
 * anchors name, with the element still framed.
 */
export const DOLLY_POINT_MIN = 14;

/**
 * A point focus's seat distance for a dolly multiplier: the
 * base distance scaled by the citizen seat's deepening curve
 * (citizenSeatScale — the inward range remaps onto
 * [CITIZEN_SEAT_MIN..1], so V travels as deep on an element as
 * it does on a citizen), floored at the minimum stand-off.
 */
export function pointSeatDistance(mul = 1) {
  return Math.max(DOLLY_POINT_MIN, DOLLY_POINT_BASE * citizenSeatScale(mul));
}

/* ---------------- slice 13-4 (item D): first-open facing ---------------- */

/**
 * FACING: each citizen's BUILT FRONT, as the angle (degrees)
 * of the direction its readable face points in its own local
 * space, measured like a yaw — atan2(x, z), so 0 is +Z, the
 * direction a front normally points. Audited miniature by
 * miniature against the entry seat (which stands on the
 * citizen's radial, looking in):
 *
 *   mesa / drum / knot / crystal / tree — radial forms, no
 *     front: 0. tray — a flat tray of cuboids, read from
 *     above: 0. cube — five open faces, the south face +Z
 *     like the rest: 0. horizon3d — its rows read back to
 *     front, the net lanes the FRONT pair (+Z): 0.
 *     horizonflat — the panel's face is +Z: 0. arch — its
 *     sheet segment is centred on +Z: 0. definition — its
 *     node slabs face +Z: 0. book — access turns the accessed
 *     arc to angle 0, which is +Z, and the spread's leaves
 *     face +Z: 0. mail — the cabinet's compartments face
 *     +Z: 0. devices — the display's screen and the printer's
 *     output tray both face +Z: 0 (devices read as "not
 *     facing" only because nothing turned it to its radial;
 *     the facing turn itself is the correction).
 *   tangle — its levels RISE in Y as they step toward +Z, so
 *     from +Z the tallest sheet stands in front and hides
 *     the staircase; the course reads from the ROOT side,
 *     the low sheet nearest and each generation rising away:
 *     its front is −Z: 180.
 *
 * When a citizen is entered for the FIRST time in a session,
 * the App sets its yaw to facingYawFor: the plot's azimuth
 * (the entry camera stands on the radial, so the azimuth IS
 * the direction from the citizen to the camera) minus the
 * built front — the yaw that turns the front onto the camera.
 * Only the yaw changes. Later entries leave the rotation as
 * the user left it, and H's RESET returns to the BUILD
 * default (identity), which is a different home from facing
 * and stays one.
 */
export const FACING = {
  mesa: 0, drum: 0, tray: 0, cube: 0, tangle: 180,
  horizon3d: 0, horizonflat: 0, arch: 0, definition: 0,
  knot: 0, crystal: 0, tree: 0, book: 0, devices: 0, mail: 0,
};

/**
 * The yaw (degrees) that turns citizen `id`, standing at
 * `position` ({ x, z } in platter coordinates), so its built
 * front meets the entry camera on its radial.
 */
export function facingYawFor(id, position) {
  const front = FACING[id] || 0;
  const az = position
    ? Math.atan2(Number(position.x) || 0, Number(position.z) || 0) * 180 / Math.PI
    : 0;
  return az - front;
}

/* ---------------- the sunburst mesa's terraces (slice 13-3, item 4) ---------------- */

/**
 * Ported from the standalone sunburst page (sunburst.html):
 * its mesa is a TERRACED amphitheatre — each ring stands a
 * `terrace` step below the ring inside it (the page's
 * top = base + (2 − depth) × terrace, read off its animated
 * y0), and a ring GAP separates the rings radially. The
 * miniature mesa had two unrelated flat heights instead (12
 * for the inner ring, 6.5 for the outer); the formula below
 * reproduces them exactly at the defaults — MESA_BASE_H is
 * the outer ring's height and the default terrace the step
 * between the rings — and makes both adjustable PARAMETERS
 * (mesaTerrace / mesaGap in the App's panel), rebuilt into the
 * wedge geometry whenever they change, at rest and under
 * descent alike (a descended set is the same two rings of its
 * display root, so the same formula keeps descent coherent).
 * Rendering only: the sub-node provider's values, shares and
 * totals never read these numbers.
 */
export const MESA_BASE_H = 6.5;
export const MESA_TERRACE_DEFAULT = 5.5;
export const MESA_GAP_DEFAULT = 0.35;

/** A mesa wedge's height for its (display-relative) depth. */
export function mesaWedgeHeight(depth, terrace = MESA_TERRACE_DEFAULT) {
  return MESA_BASE_H + Math.max(0, 2 - depth) * terrace;
}

/**
 * The standalone's label rule (labelVisible in the layout
 * module): a slice carries a label when its span has room —
 * (y1 − y0) × (x1 − x0) > 0.03. A mesa wedge's radial span is
 * one unit, so the rule reads off its angular span, which is
 * its share of the display root × 2π. Used for the wedge name
 * labels the space's label mode shows (slice 13-3, item 4).
 */
export function mesaWedgeLabelVisible(share) {
  return share * Math.PI * 2 > 0.03;
}

/**
 * FIELD SIZES (§15): the focal zoom is a LADDER, not a dial —
 * five named rungs from cinematography, widest to narrowest.
 * Each rung carries its perspective field of view and its
 * isometric frustum factor (relative scale, widest largest;
 * the factors are tan(fov/2) ratios against MEDIUM, so the two
 * projections step through the same fields). 5 steps one rung
 * wider, 6 one rung narrower. The camera does not move — that
 * is what makes it a zoom and not a dolly.
 */
export const FIELD_SIZES = [
  { name: "LONG", fov: 70, iso: 1.61 },
  { name: "MEDIUM LONG", fov: 58, iso: 1.27 },
  { name: "MEDIUM", fov: 47, iso: 1.0 },
  { name: "MEDIUM CLOSE", fov: 37, iso: 0.77 },
  { name: "CLOSE", fov: 28, iso: 0.57 },
];

/**
 * The App's field state starts at the rung nearest the Rig's
 * standing default fov (40°), so the space opens framed as it
 * always has until 5/6 are touched.
 */
export const FIELD_DEFAULT_INDEX =
  FIELD_SIZES.reduce((best, f, i) =>
    Math.abs(f.fov - 40) < Math.abs(FIELD_SIZES[best].fov - 40) ? i : best, 0);

/** One field step: dir -1 wider (key 5), dir +1 narrower (key 6), clamped at the ladder's ends. */
export function fieldStep(index, dir) {
  const cur = Math.max(0, Math.min(FIELD_SIZES.length - 1, Math.floor(index) || 0));
  return Math.max(0, Math.min(FIELD_SIZES.length - 1, cur + (dir > 0 ? 1 : -1)));
}

/* ---------------- UI modes: labels, command line, drag lock ---------------- */

/**
 * The modal flags SpaceApp holds beside the space state. Label mode
 * and the armed command line are mutually exclusive — entering one
 * always clears the other.
 */
export function createUiMode() {
  return { labelMode: false, cmdArmed: false };
}

/** Alt+L in: chips appear, letters become addresses. Disarms the line. */
export function enterLabelMode(mode) {
  return { ...mode, labelMode: true, cmdArmed: false };
}

export function exitLabelMode(mode) {
  return { ...mode, labelMode: false };
}

/** Arming the command line withdraws the labels. */
export function armCmdMode(mode) {
  return { ...mode, labelMode: false, cmdArmed: true };
}

export function disarmCmdMode(mode) {
  return { ...mode, cmdArmed: false };
}

/**
 * Letter targeting exists ONLY in label mode: outside it a bare
 * letter is not an address at all (operators keep their letters in
 * both modes; G in particular is the patch operator outside label
 * mode and the tangled tree's address inside it).
 */
export function letterTarget(mode, key) {
  if (!mode.labelMode) return null;
  if (!/^[a-zA-Z]$/.test(key)) return null;
  return objectForLabel(key.toUpperCase());
}

/**
 * The drag lock (Space toggles it). While locked, an object follows
 * the cursor's ground projection WITHOUT its committed position
 * moving — the lock remembers where it was picked up, a drop
 * commits the landing point, and a cancel simply lets go, so the
 * object eases back to its pre-drag position on its own.
 */
export function beginDragLock(state, id) {
  if (!id || !state.positions[id]) return null;
  return { id, origin: { ...state.positions[id] } };
}

/** Second Space press: the object stays where the lock leaves it. */
export function dropDragLock(state, lock, x, z) {
  if (!lock) return state;
  return setObjectPosition(state, lock.id, x, z);
}

/** Esc during a lock: nothing was ever committed, so nothing moves. */
export function cancelDragLock(state, lock) {
  return state;
}

/* ---------------- glow: the two tiers of address ---------------- */

/**
 * GLOW is address, in two tiers. HOVERED — under the cursor, not
 * yet taken — is a highlight only: a mild emissive lift (its ring
 * is teal). SELECTED — the current object, however it was taken
 * (F, Tab, label mode, a command), and the entered object while its
 * panel is out — is the glow: the strong emissive plus the amber
 * ring, HELD for as long as the object stays current, never a
 * flash. Release to none and the object returns to matte. A patch
 * source mid-gesture sits between the tiers. Exactly one object can
 * hold the selected tier, because there is exactly one currentId.
 */
export const GLOW_TIERS = { selected: 0.55, patching: 0.45, hovered: 0.3, none: 0 };

export function glowTierName({ entered = false, current = false, pending = false, hovered = false } = {}) {
  if (entered || current) return "selected";
  if (pending) return "patching";
  if (hovered) return "hovered";
  return "none";
}

export function glowLevel(flags) {
  return GLOW_TIERS[glowTierName(flags)];
}

/* ---------------- named plane views (command line: v › t/f/s/h) ---------------- */

/**
 * The view keys (§14): digits call the same goView() as the
 * VIEW fieldset buttons and the command line, in the fieldset's
 * order. Slice 13-5 (item 4) REORDERED them: 1 FRONT,
 * 2 ELEVATION L, 3 ELEVATION R, 4 PLAN, 0 HOME — the old single
 * SIDE split into the two side elevations, and HOME moved to 0
 * (bare 0; Alt+0 stays the clipboard chord, a different press).
 * Space-scope only: in app scope digits stay bare (the camera
 * is parked while an app holds the stage).
 */
export const VIEW_KEYS = { "1": "front", "2": "left", "3": "right", "4": "top", "0": "home" };

/**
 * Named views are pure camera moves — a seat and a look target,
 * nothing else changes. PLAN (top) is above, looking down at
 * the XZ ground plane (a hair of z offset keeps the camera's
 * up vector stable); FRONT is square-on to the XY wall;
 * ELEVATION L / R are square-on to the YZ plane from −X / +X
 * (azimuths −90° / +90° at the standing elevation profile —
 * R keeps the old SIDE's seat); HOME is the parametric seat
 * the parameters describe (no fixed seat — the Rig computes
 * it). The C/V dolly scales a named seat toward its look
 * target. The space still OPENS in plan — viewName "top".
 */
export const VIEWS = {
  home: { name: "HOME", seat: null, look: null },
  top: { name: "PLAN", seat: [0, 560, 28], look: [0, 0, 0] },
  front: { name: "FRONT", seat: [0, 80, 330], look: [0, 80, -196] },
  left: { name: "ELEVATION L", seat: [-330, 80, 0], look: [-196, 80, 0] },
  right: { name: "ELEVATION R", seat: [330, 80, 0], look: [196, 80, 0] },
};

export function viewSeat(name, zoomMul = 1) {
  const v = VIEWS[name];
  if (!v || !v.seat) return null;
  const seat = v.look.map((l, i) => l + (v.seat[i] - l) * zoomMul);
  return { seat, look: [...v.look] };
}

/**
 * Slice 13-3 (item 1): CITIZEN-RELATIVE named views. When a
 * citizen view is ENTERED — a citizen stands open, its card up
 * (cardId === currentId, a citizen id) — FRONT / ELEVATION L /
 * ELEVATION R / PLAN stop naming seats around the whole space
 * and name seats around THE ENTERED CITIZEN instead: plan
 * above it looking down, front before it, the elevations
 * beside it left and right, all at the citizen's own seat
 * distance (the citizenSeat offsets). HOME stays the space's
 * global home view, and with no citizen entered every view is
 * global, exactly as before. The resolution is pure: entered
 * citizen + view name → a citizen seat spec; anything else →
 * the global view. The App's one goView transition serves the
 * fieldset buttons, the digit keys and the command line alike,
 * so all three doors resolve here. (Slice 13-5 split the old
 * "side" into "left" and "right"; both are citizen-relative.)
 */
export function resolveViewTarget({ view = null, enteredId = null } = {}) {
  if (enteredId && OBJECT_IDS.includes(enteredId)
    && (view === "top" || view === "front" || view === "left" || view === "right")) {
    return { kind: "citizen", view, id: enteredId };
  }
  return { kind: "global", view };
}

/**
 * A citizen-relative view's seat, as data — the direction
 * variants of the one citizen seat. `base` is the citizen's
 * world base [x, y, z]; `offsets` are citizenSeatOffsets(scale,
 * mul) (radial + up); `anchorY` is the look height the entered
 * card's seat uses (ANCHOR_H × 0.55 × scale, the View's table).
 * FRONT is the entered seat itself — out along the citizen's
 * radial, raised, looking at the anchor height — the same
 * composition the Rig's card branch makes, so FRONT while
 * entered is the seat F flew to. ELEVATION L / R are that seat
 * turned a quarter-turn about the citizen: out along the
 * TANGENT at the same offsets, the same look — L along the
 * tangent (−rz, rx) (for a citizen on the +Z radial, the seat
 * at its −X, matching the global ELEVATION L's −X seat), R
 * along the mirrored tangent (rz, −rx). PLAN is above: up the
 * seat distance (the offsets' length) with a hair of the radial
 * kept — the global top view's own trick, keeping the camera's
 * up vector stable — looking down at the citizen's heart.
 * A citizen standing on the platter's axis has no radial; the
 * fallback faces it from the south, as the Rig's seat does.
 */
export function citizenViewSeat(view, base, offsets, anchorY) {
  const [bx, by, bz] = base;
  let rx = bx;
  let rz = bz;
  const rl = Math.hypot(rx, rz);
  if (rl < 1) { rx = 0; rz = 1; } else { rx /= rl; rz /= rl; }
  const look = [bx, by + anchorY, bz];
  if (view === "left" || view === "side") {
    // The tangent: the radial turned a quarter-turn in the plane.
    // ("side" is the pre-13-5 name of this seat; it read as L.)
    return {
      seat: [bx + -rz * offsets.radial, by + offsets.up, bz + rx * offsets.radial],
      look,
    };
  }
  if (view === "right") {
    // The mirrored tangent: the quarter-turn the other way.
    return {
      seat: [bx + rz * offsets.radial, by + offsets.up, bz + -rx * offsets.radial],
      look,
    };
  }
  if (view === "top") {
    const dist = Math.hypot(offsets.radial, offsets.up);
    return {
      seat: [bx + rx * offsets.radial * 0.12, by + dist, bz + rz * offsets.radial * 0.12],
      look: [bx, by + anchorY * 0.4, bz],
    };
  }
  // "front" — and any other name — is the entered seat itself.
  return {
    seat: [bx + rx * offsets.radial, by + offsets.up, bz + rz * offsets.radial],
    look,
  };
}

/* ---------------- drag snapping + axis lock ---------------- */

export const SNAP_GRID = 12;
export const SNAP_ANCHOR_DIST = 10;

/**
 * Where a drag-locked object lands. With snapping ON (the Snap
 * parameter, default on): within SNAP_ANCHOR_DIST of another
 * object's plot centre, the point snaps to that centre (anchor
 * wins); elsewhere it quantizes to the SNAP_GRID grid. With
 * snapping OFF the point passes through untouched (free drag).
 * `anchors` are the OTHER objects' centres: [{ id, x, z }].
 */
export function snapGroundPoint(point, anchors = [], snapOn = true) {
  if (!snapOn) return { x: point.x, z: point.z, mode: "free", anchorId: null };
  let best = null;
  let bestD = Infinity;
  for (const a of anchors) {
    const d = Math.hypot(a.x - point.x, a.z - point.z);
    if (d < bestD) { bestD = d; best = a; }
  }
  if (best && bestD <= SNAP_ANCHOR_DIST) {
    return { x: best.x, z: best.z, mode: "anchor", anchorId: best.id };
  }
  return {
    x: Math.round(point.x / SNAP_GRID) * SNAP_GRID,
    z: Math.round(point.z / SNAP_GRID) * SNAP_GRID,
    mode: "grid", anchorId: null,
  };
}

/**
 * The axis lock: while drag-locked, X or Z constrains movement to
 * that world axis through the drag's origin — the locked point
 * keeps the origin's other coordinate, so a delta along the lock
 * has exactly zero of the other axis in it.
 */
export function axisLockPoint(point, origin, axis) {
  if (axis === "x") return { x: point.x, z: origin.z };
  if (axis === "z") return { x: origin.x, z: point.z };
  return { x: point.x, z: point.z };
}

/* ---------------- layers (strata) with lock ---------------- */

/**
 * Three strata, CAD-style: DATA (the ten objects), INSTRUMENTS
 * (the datum planes, the library wall + cabinet + cards, the
 * clipboard tray), SCENERY (platter, compass, rim). Each is
 * visible on/off and locked on/off. A thing is ADDRESSABLE only
 * when its stratum is visible and unlocked — and every addressing
 * path (hover, Tab, labels, click, commands) consults the one
 * function, isAddressable. Hidden means NOT RENDERED, for every
 * stratum including scenery (no ghost exception). Defaults: all
 * visible; SCENERY locked — it was never addressable, the lock
 * makes it law; DATA and INSTRUMENTS unlocked.
 */
export const STRATA = ["data", "instruments", "scenery"];

export function createLayers() {
  return {
    data: { visible: true, locked: false },
    instruments: { visible: true, locked: false },
    scenery: { visible: true, locked: true },
  };
}

/** The layers object as the PARAMETERS panel holds it. */
export function layersFromValues(v) {
  return {
    data: { visible: v.layerData !== false, locked: Boolean(v.layerDataLock) },
    instruments: { visible: v.layerInstruments !== false, locked: Boolean(v.layerInstrumentsLock) },
    scenery: { visible: v.layerScenery !== false, locked: Boolean(v.layerSceneryLock) },
  };
}

export function stratumOf(id) {
  if (!id) return null;
  if (OBJECT_IDS.includes(id)) return "data";
  // The ring's items are instruments of the space (slice 8, below):
  // the ring is furniture the apps ride on, not a datum.
  if (RING_IDS.includes(id)) return "instruments";
  if (id === "clipboard" || id.startsWith("media-")) return "instruments";
  return null;
}

export function isAddressable(layers, id) {
  const s = stratumOf(id);
  if (!s) return false;
  const L = layers[s];
  return Boolean(L && L.visible && !L.locked);
}

/** The Tab list, filtered through the layers. */
export function addressableList(layers, { cardIds = [], clipboardPresent = false } = {}) {
  return [...OBJECT_IDS, ...RING_IDS, ...cardIds, ...(clipboardPresent ? ["clipboard"] : [])]
    .filter((id) => isAddressable(layers, id));
}

/* ---------------- inspection (I) ---------------- */

/**
 * INSPECT brings a thing to the viewer: the thing itself travels
 * to the inspection position before the camera (F, by contrast,
 * flies the camera to the thing and the thing stays home). Any
 * addressable thing can be inspected — a platter object, a wall /
 * library card, the clipboard tray.
 *
 * The inspection value holds the inspected id and a deep SNAPSHOT
 * of its home (position / orientation / scale, however the caller
 * describes home) taken at begin. Ending returns the snapshot so
 * the view can ease the thing back to its EXACT home. Beginning a
 * second inspection first restores the thing already out
 * (exclusivity): the returned `restored` names it.
 */
export function createInspection() {
  return { inspectedId: null, home: null };
}

const deepCopy = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

export function beginInspect(insp, id, home) {
  if (!id) return { inspection: insp, restored: null };
  const restored = insp.inspectedId
    ? { id: insp.inspectedId, home: deepCopy(insp.home) }
    : null;
  return {
    inspection: { inspectedId: id, home: deepCopy(home) },
    restored,
  };
}

export function endInspect(insp) {
  if (!insp.inspectedId) return { inspection: createInspection(), restored: null };
  return {
    inspection: createInspection(),
    restored: { id: insp.inspectedId, home: deepCopy(insp.home) },
  };
}

export const isInspecting = (insp, id) =>
  Boolean(insp.inspectedId) && (id === undefined || insp.inspectedId === id);

/**
 * Inspection scales (display scale at the inspection position):
 * platter objects come to a standard 1.15 — big enough to read,
 * small enough to stay a citizen of the platter's world; library
 * cards are small, so they come up to 2.6; the clipboard tray
 * to 1.4.
 */
export const INSPECT_SCALE = { object: 1.15, card: 2.6, tray: 1.4 };

export function inspectScaleFor(kind) {
  return INSPECT_SCALE[kind] ?? INSPECT_SCALE.object;
}

/* ---------------- part focus: zooming INTO a part of the knot ---------------- */

/**
 * The data knot's parts are SUB-ADDRESSES: they belong to the knot
 * and exist as addresses only while the knot is the current object
 * (the App enforces that; this state just holds the fact). F on a
 * hovered part begins a PART FOCUS — the camera flies to a seat
 * before that part of the curve and the part's panel stands. The
 * focus is a distinct state from the entered card (cardId): a card
 * says "I am at this object"; a part focus says "I am inside this
 * object's data, at this part". The release chain backs out
 * part → knot → release, so ending a focus returns to the knot
 * simply being current, exactly where it was.
 *
 * Slice 13-5 (item 1): the focus carries a SEATED flag. F focuses
 * a sub-node WITHOUT moving the camera (seated false): the focus
 * state — highlight, card, readout — is exactly as it always was,
 * but the Rig does not take the part seat. G flies to it (seated
 * true): the same focus, with the seat. G on an already-focused
 * node seats it; F on a seated node unseats it. The back chain's
 * partFocus level pops the same either way (it counts partId).
 */
export function createPartFocus() {
  return { objectId: null, partId: null, seated: false };
}

export function beginPartFocus(focus, objectId, partId, seated = true) {
  if (!objectId || !partId) return focus;
  return { objectId, partId, seated: Boolean(seated) };
}

export function endPartFocus() {
  return createPartFocus();
}

export const isPartFocused = (focus, partId) =>
  Boolean(focus && focus.partId) &&
  (partId === undefined || focus.partId === partId);

/* ---------------- sunburst descent (slice 12) ---------------- */

/**
 * DESCENT: a sunburst citizen (mesa or drum) displays its
 * hierarchy from a DISPLAY ROOT — at rest the true root, and
 * after F on a branch wedge, that wedge's node: the miniature
 * rebuilds from the node as its root, and values and shares are
 * read against it. The state is the PATH of node ids descended
 * through, from just below the true root down to the display
 * root. The value holds ONE citizen's descent; the App keeps
 * one value per sunburst (mesa and drum), so a descent in one
 * never disturbs the other, and displayRootOf is always asked
 * about a named citizen.
 *
 * Descent is a DISPLAY state, not a transform: it never touches
 * the citizen's transform record — rotation, plane spin and
 * MAGNIFY persist through descend and climb exactly as they
 * were, and climbing back to the true root restores the prior
 * display untouched. The back events climb it one level per
 * chain level (see backChainLevels): climbDescent pops the
 * deepest id, and at the true root it is a no-op — the level is
 * simply absent from the chain there.
 */
export function createDescent() {
  return { objectId: null, path: [] };
}

/** F on a branch wedge: the wedge's node becomes the display root. */
export function descend(descent, objectId, nodeId) {
  if (!objectId || !nodeId) return descent;
  if (!descent || descent.objectId !== objectId) return { objectId, path: [nodeId] };
  if (descent.path[descent.path.length - 1] === nodeId) return descent;
  return { objectId, path: [...descent.path, nodeId] };
}

/** One climb: the display root's parent becomes the root. At the true root, a no-op. */
export function climbDescent(descent) {
  if (!descent || !descent.objectId || !descent.path.length) return descent || createDescent();
  const path = descent.path.slice(0, -1);
  return path.length ? { objectId: descent.objectId, path } : createDescent();
}

/** The display root's node id for a citizen, or null when it stands at its true root. */
export function displayRootOf(descent, objectId) {
  if (!descent || descent.objectId !== objectId || !descent.path.length) return null;
  return descent.path[descent.path.length - 1];
}

/** How many chain levels a descent occupies (its depth below the true root). */
export function descentDepth(descent) {
  return descent && descent.path ? descent.path.length : 0;
}

/* ---------------- the cylinder book: access + spreads (slice 13-2) ---------------- */

/**
 * BOOK ACCESS: the cylinder book is read by TIERS — F on a
 * chapter band accesses the chapter, F on a section band the
 * section, F on a page brings the page OUT of the drum. The
 * state is the PATH of tier ids accessed, from the chapter down
 * to the deepest tier in hand: because a book sub-node's id IS
 * its name path ("book/<chapter>/<section>/<page>"), the access
 * path of any tier is its own ancestor chain, and accessing a
 * tier sets the path to that chain — every tier is always
 * addressable on the drum, so access is a position in the book,
 * not a history. The drum turns to the accessed tier (the View
 * eases it), the other tiers ghost, and the back events CLIMB
 * the path one tier per chain level — the access sits in the
 * release stack at the descent tier (see backChainLevels),
 * counted only while the book is current.
 *
 * Like descent, access is a DISPLAY state: it never touches the
 * book's transform — rotation, plane spin and MAGNIFY persist
 * through access and climb exactly as they were. Only ONE page
 * stands out at a time: the path's deepest entry, when it is a
 * page (depth 3 in the tiers).
 */
export function createBookAccess() {
  return { path: [] };
}

/** The access path a tier id stands at: its ancestor chain, root excluded. */
export function bookTierChain(nodeId) {
  if (!nodeId || typeof nodeId !== "string") return [];
  const segs = nodeId.split("/");
  if (segs[0] !== "book" || segs.length < 2) return [];
  const chain = [];
  for (let i = 2; i <= segs.length; i++) chain.push(segs.slice(0, i).join("/"));
  return chain;
}

/** F on a tier (chapter, section, or — the page coming out — a page). */
export function bookAccessTo(access, nodeId) {
  const chain = bookTierChain(nodeId);
  if (!chain.length) return access || createBookAccess();
  return { path: chain };
}

/** One climb: the deepest tier releases. At the whole book, a no-op. */
export function climbBookAccess(access) {
  if (!access || !access.path || !access.path.length) return access || createBookAccess();
  return access.path.length > 1 ? { path: access.path.slice(0, -1) } : createBookAccess();
}

/** How many chain levels an access occupies (its tier depth). */
export function bookAccessDepth(access) {
  return access && access.path ? access.path.length : 0;
}

/** The deepest accessed tier's id, or null at the whole book. */
export function bookAccessedId(access) {
  return access && access.path && access.path.length
    ? access.path[access.path.length - 1]
    : null;
}

/** The accessed chapter's id (the path's first entry), or null. */
export function bookAccessChapter(access) {
  return access && access.path && access.path.length ? access.path[0] : null;
}

/** The accessed section's id (the path's second entry), or null. */
export function bookAccessSection(access) {
  return access && access.path && access.path.length > 1 ? access.path[1] : null;
}

/**
 * The page standing OUT of the drum: the path's deepest entry,
 * when the access reaches page depth (three tiers). Null when
 * no page is out — only one page is ever out at a time.
 */
export function bookPageOutId(access) {
  return access && access.path && access.path.length >= 3
    ? access.path[access.path.length - 1]
    : null;
}

/**
 * One step of the SPREAD index (the two-page presentation):
 * dir +1 flips forward, −1 back, clamped at the book's ends —
 * flipping is navigation within the presentation, not a level
 * of the release stack, so it neither pushes nor pops anything.
 */
export function stepSpread(index, dir, count) {
  const n = Math.max(1, Math.floor(count) || 1);
  const cur = Math.max(0, Math.min(n - 1, Math.floor(index) || 0));
  return Math.max(0, Math.min(n - 1, cur + (dir > 0 ? 1 : -1)));
}

/* ---------------- apps and the ring (slice 8) ---------------- */

/**
 * THE RING: an annulus around the circular platter holding things
 * to open — the platter's way of gaining more items of interest
 * without gaining more plots. One ring to start. On it, slice 8
 * put one home item, the WAVEFORM app; slice 15 adds the second:
 * the WEB app, the captured page. Ring items are NOT citizens —
 * they have no plot, no transform, no cables; they ride the ring
 * (which turns slowly at rest) and they OPEN.
 *
 * Ring items join the labeled set AFTER the citizens, so the
 * citizens' labels never move and the media cards' labels
 * continue after the ring (media-library.js derives its start
 * from here). Their stratum is INSTRUMENTS (see stratumOf): the
 * ring is the space's furniture, and hiding or locking
 * INSTRUMENTS takes the ring's addressing with it.
 */
export const RING_R = 222; // mid-annulus radius; the platter is 198
export const RING_ITEMS = [
  { id: "audio", name: "Waveform", kind: "app", stratum: "instruments",
    blurb: "The audio app: a track's waveform as a fence of peaks on the stage, its spectrum falling away behind as a waterfall. F opens it centre-stage, E across the whole platter." },
  { id: "web", name: "Web", kind: "app", stratum: "instruments",
    blurb: "The web, detached: one captured page — Wikipedia's Snow globe, its structure taken ahead of time — standing as a readable sheet on the stage, its sections and links addressable. F opens it centre-stage, E across the whole platter. A captured structure, not a live page: live pages need the local bridge, a later slice." },
];

export const RING_IDS = RING_ITEMS.map((r) => r.id);

export function ringItemById(id) {
  return RING_ITEMS.find((r) => r.id === id) || null;
}

/**
 * Which app a thing bears, if any: a ring item of kind "app" bears
 * the app of its own id. Citizens bear no apps in this slice.
 */
export function appBearerOf(id) {
  const item = ringItemById(id);
  return item && item.kind === "app" ? item.id : null;
}

/**
 * A ring item's place on the annulus: index/count around the
 * circle, advanced by the ring's rotation. Angle 0 is the +X rim;
 * the first slot stands at the front (+Z, toward the viewer), and
 * a positive rotation carries every item the same way around.
 */
export function ringItemPosition(index, count, rotationRad = 0) {
  const a = Math.PI / 2 + rotationRad + (index * 2 * Math.PI) / Math.max(1, count);
  return { x: Math.cos(a) * RING_R, z: Math.sin(a) * RING_R, angle: a };
}

/** Ring items in the labeled set, continuing past the citizens. */
export function labeledRingItems() {
  return RING_ITEMS.map((item, i) => ({ item, label: labelForIndex(OBJECTS.length + i) }));
}

export function ringItemForLabel(label) {
  const hit = labeledRingItems().find((l) => l.label === String(label || "").toUpperCase());
  return hit ? hit.item : null;
}

/* ---------------- open apps ---------------- */

/**
 * An OPEN APP holds the stage. It opens in one of two ways:
 * "center" — the app stands on the centre stage, the main circle
 * at the platter's heart, and the rest of the space remains
 * around it; or "full" — the app takes the whole main platter
 * and the citizens hide. The value is just the fact: which app,
 * which mode. The space's other states (selection, cards, focus)
 * are cleared by the App when an app opens, and the camera seat
 * the app took is restored from a snapshot when it closes.
 */
export function createOpenApp() {
  return { appId: null, mode: null };
}

export const APP_MODES = ["center", "full"];

export function openApp(state, appId, mode) {
  if (!appId || !APP_MODES.includes(mode)) return state;
  return { appId, mode };
}

export function setAppMode(state, mode) {
  if (!state.appId || !APP_MODES.includes(mode)) return state;
  return { ...state, mode };
}

export function closeApp(state) {
  return createOpenApp();
}

export const isAppOpen = (state, appId) =>
  Boolean(state && state.appId) && (appId === undefined || state.appId === appId);

/**
 * The F/E opening decision, pure like resolveFAction: given the
 * ADDRESSED thing and the key, an app-bearing thing opens — F to
 * the centre stage, E across the whole platter — and anything
 * else returns null (the key falls through to its ordinary work).
 *
 * E is an operator OUTSIDE label mode only: inside label mode the
 * letters are pure addresses and E is the sunburst cylinder's, so
 * resolveOpenAction refuses E there and the App's letter
 * targeting picks the letter up instead. Since slice 11, whether
 * an E press MEANS expand at all is decided one level up by
 * resolveEKey (E on a citizen is yaw- now); this resolver still
 * answers the opening question for the presses that reach it.
 * The mode-scoping family: G patches outside / addresses inside,
 * M opens the library outside / addresses inside, E expands
 * outside / addresses inside.
 */
export function resolveOpenAction({ targetId = null, key = null, labelMode = false } = {}) {
  if (!targetId || !key) return null;
  const k = String(key).toLowerCase();
  if (k !== "f" && k !== "e") return null;
  const appId = appBearerOf(targetId);
  if (!appId) return null;
  if (k === "e" && labelMode) return null;
  return { type: "openApp", appId, mode: k === "e" ? "full" : "center" };
}

/* ---------------- the state ---------------- */

export function createSpaceState(layoutName = "ring") {
  const transforms = {};
  for (const id of OBJECT_IDS) transforms[id] = defaultTransform();
  const base = { transforms, cables: [], layout: "ring", positions: {} };
  return applyLayout(base, LAYOUTS[layoutName] ? layoutName : "ring");
}
