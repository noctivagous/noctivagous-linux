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
 *   1 zoom out · 2 zoom in · 3/4/5 layouts · Tab cycle · F enter ·
 *   D back · Esc release a level · - = yaw · [ ] pitch · ; ' roll ·
 *   . / scale · G patch · X strip cables · Space press toggles the
 *   drag lock (press to pick up, press again to drop, Esc cancels).
 *
 *   Slice 8 adds APPS and the RING (see the section at the foot of
 *   this file): a thing that bears an app opens with F onto the
 *   centre stage, or with E across the whole platter; while an app
 *   holds the stage, Esc leaves it (the big back) and D steps back
 *   inside the app's own history.
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
    blurb: "The zoomable sunburst as a terraced mesa — flare's houses as annular prisms, area and angle doing the talking." },
  { id: "drum", name: "Sunburst cylinder", group: "graphs",
    blurb: "The same sunburst stood up as a drum of wedge blocks; a leaf's wedge slides out of the drum with its card." },
  { id: "tray", name: "Treemap tray", group: "graphs",
    blurb: "Bostock's binary-tiled treemap as a tray of cuboids — the file-system frame, area as value." },
  { id: "cube", name: "Treemap cube", group: "graphs",
    blurb: "The treemap layer spread across a cube's five open faces; bright tiles are leaves, dark framed doors open." },
  { id: "tangle", name: "Tangled tree", group: "instruments",
    blurb: "The Greek genealogy as a tangled tree — metro lines bundling through seven levels of descent." },
  { id: "horizon3d", name: "Horizon skyline", group: "monitors",
    blurb: "The activity monitor in relief: eight lanes of machine life as terraced skylines on a platter." },
  { id: "horizonflat", name: "Horizon panel", group: "monitors",
    blurb: "The flat horizon chart — the machine's vitals as layered bands on a panel, the Flat UI frame." },
  { id: "arch", name: "Panelization arch", group: "instruments",
    blurb: "The iGeo agent panelization on its arched sheet — panels pushed around by a swarm you cannot see." },
  { id: "definition", name: "Definition", group: "instruments",
    blurb: "The Grasshopper-style definition: nodes and wires, geometry as a value travelling the graph." },
  { id: "knot", name: "Trefoil data knot", group: "graphs",
    blurb: "A trefoil whose parts contain data — eight arcs of one closed curve, each holding a system's datum, its thickness the size of what it holds. Hover a part, then F zooms into it." },
  { id: "crystal", name: "Living crystal", group: "graphs",
    blurb: "An octahedron that is alive: its eight faces carry eight values, each face's distance from the centre set by its value, so the shape is the chart. It turns slowly on its pedestal, and the faces regrow as the values drift." },
  { id: "tree", name: "Data tree", group: "graphs",
    blurb: "The flare hierarchy grown as a branching tree by L-system rules — its depth-1 branches are sub-addresses: hover one, then F zooms into the subtree." },
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

/** e.key → transform op. Punctuation is matched on e.key, never code. */
export const TRANSFORM_KEYS = {
  "-": "yaw-", "=": "yaw+",
  "[": "pitch-", "]": "pitch+",
  ";": "roll-", "'": "roll+",
  ".": "scale-", "/": "scale+",
};

export const defaultTransform = () => ({ yaw: 0, pitch: 0, roll: 0, scale: 1 });

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
    case "scale-": next.scale = clampScale(cur.scale / SCALE_STEP); break;
    case "scale+": next.scale = clampScale(cur.scale * SCALE_STEP); break;
    default: return state;
  }
  return { ...state, transforms: { ...state.transforms, [id]: next } };
}

/** Apply the transform bound to an e.key value; unknown keys pass through. */
export function applyTransformKey(state, id, key) {
  const op = TRANSFORM_KEYS[key];
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
 */
export function resolveFAction({
  pendingId = null,
  hoverId = null,
  currentId = null,
  partId = null,
  branchId = null,
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

/** X: strip every cable touching the object. */
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
    },
    scales: { cube: 1.6 },
  },
};

export const LAYOUT_KEYS = { "3": "ring", "4": "districts", "5": "theatre" };

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

/* ---------------- zoom ---------------- */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 1.15;

/**
 * One zoom step of the camera distance multiplier. dir +1 zooms IN
 * (key 2, distance shrinks), dir -1 zooms OUT (key 1). Clamped.
 */
export function zoomStep(mul, dir) {
  const next = dir > 0 ? mul / ZOOM_STEP : mul * ZOOM_STEP;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
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
 * Named views are pure camera moves — a seat and a look target,
 * nothing else changes. TOP is above, looking down at the XZ
 * ground plane (a hair of z offset keeps the camera's up vector
 * stable); FRONT is square-on to the XY wall; SIDE is square-on
 * to the YZ plane; HOME is the parametric seat the parameters
 * describe (no fixed seat — the Rig computes it). The 1/2 zoom
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
 * targeting picks the letter up instead. This is the G/M
 * mode-scoping rule, extended to a third letter: G patches
 * outside / addresses inside, M opens the library outside /
 * addresses inside, E expands outside / addresses inside.
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
