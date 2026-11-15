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
 *   G patch · J strip cables · H copy · Space press toggles the
 *   drag lock (press to pick up, press again to drop, Esc cancels).
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
 * key of each pair is the negative step). The punctuation keys
 * are UNBOUND in the space scope now. Letters are matched on
 * e.key, lower-cased by the App; these operators live OUTSIDE
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
  e: "yaw-", r: "yaw+",
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
 *   appClose → partFocus → descent (each descended level its own)
 *   → bookAccess (each accessed tier its own) → patch → card →
 *   selection
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
 * yaw- (the rotate cluster's first yaw key) and the app
 * expander slice 8 gave it. The ruling: E on an ADDRESSED
 * CITIZEN is yaw-; E when the addressed thing is the app-bearing
 * RING item, or while the app is open in CENTRE mode, is EXPAND
 * TO FULL (in app scope the transforms are suspended, so there
 * is no conflict inside the app; in centre mode the app's own
 * scope owns the key and E expands). While the app is FULL, E
 * does nothing (null). R is yaw+ unconditionally.
 */
export function resolveEKey({ targetId = null, appOpen = false, appMode = null } = {}) {
  if (appOpen) return appMode === "center" ? "expand" : null;
  if (targetId && appBearerOf(targetId)) return "expand";
  if (targetId && OBJECT_IDS.includes(targetId)) return "yaw-";
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
 * sub-nodes take the part-focus seat, like the knot's parts. The
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
    if (subTier >= 3) {
      return bookStyle === "spread"
        ? { type: "bookSpreadTo", targetId, nodeId: subId }
        : { type: "bookPage", targetId, nodeId: subId };
    }
    return { type: "bookAccess", targetId, nodeId: subId };
  }
  if ((targetId === "tray" || targetId === "tangle") && subId) {
    return { type: "partFocus", targetId, partId: subId };
  }
  if ((targetId === "mesa" || targetId === "drum") && subId) {
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

/* ---------------- the dolly (C/V) and the focal zoom (5/6) ---------------- */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 1.15;

/**
 * One DOLLY step of the camera distance multiplier (C/V — the
 * camera itself moves; §14 separated this from the focal zoom
 * and named it honestly). dir +1 dollies IN (key V, distance
 * shrinks), dir -1 dollies OUT (key C). Clamped. (The function's
 * name predates the film-terms scheme; it is internal.)
 */
export function zoomStep(mul, dir) {
  const next = dir > 0 ? mul / ZOOM_STEP : mul * ZOOM_STEP;
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
 * The view keys (§14): digits 1–4 call the same goView() as the
 * VIEW fieldset buttons and the command line, in the fieldset's
 * order — 1 PLAN, 2 ELEVATION, 3 SIDE, 4 HOME. Space-scope
 * only: in app scope digits stay bare (the camera is parked
 * while an app holds the stage).
 */
export const VIEW_KEYS = { "1": "top", "2": "front", "3": "side", "4": "home" };

/**
 * Named views are pure camera moves — a seat and a look target,
 * nothing else changes. TOP is above, looking down at the XZ
 * ground plane (a hair of z offset keeps the camera's up vector
 * stable); FRONT is square-on to the XY wall; SIDE is square-on
 * to the YZ plane; HOME is the parametric seat the parameters
 * describe (no fixed seat — the Rig computes it). The C/V dolly
 * scales a named seat toward its look target.
 */
export const VIEWS = {
  home: { name: "HOME", seat: null, look: null },
  top: { name: "TOP", seat: [0, 560, 28], look: [0, 0, 0] },
  front: { name: "FRONT", seat: [0, 80, 330], look: [0, 80, -196] },
  side: { name: "SIDE", seat: [330, 80, 0], look: [196, 80, 0] },
};

export function viewSeat(name, zoomMul = 1) {
  const v = VIEWS[name];
  if (!v || !v.seat) return null;
  const seat = v.look.map((l, i) => l + (v.seat[i] - l) * zoomMul);
  return { seat, look: [...v.look] };
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
 */
export function createPartFocus() {
  return { objectId: null, partId: null };
}

export function beginPartFocus(focus, objectId, partId) {
  if (!objectId || !partId) return focus;
  return { objectId, partId };
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
 * without gaining more plots. One ring to start, and on it exactly
 * one home item: the WAVEFORM app. Ring items are NOT citizens —
 * they have no plot, no transform, no cables; they ride the ring
 * (which turns slowly at rest) and they OPEN.
 *
 * Ring items join the labeled set AFTER the twelve citizens, so
 * the citizens' labels never move and the media cards' labels
 * continue after the ring (media-library.js derives its start
 * from here). Their stratum is INSTRUMENTS (see stratumOf): the
 * ring is the space's furniture, and hiding or locking
 * INSTRUMENTS takes the ring's addressing with it.
 */
export const RING_R = 222; // mid-annulus radius; the platter is 198
export const RING_ITEMS = [
  { id: "audio", name: "Waveform", kind: "app", stratum: "instruments",
    blurb: "The audio app: a track's waveform as a fence of peaks on the stage, its spectrum falling away behind as a waterfall. F opens it centre-stage, E across the whole platter." },
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
