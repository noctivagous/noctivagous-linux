import { useEffect, useRef, useState } from "react";
import SpaceView from "./SpaceView.jsx";
import {
  OBJECTS,
  LAYOUTS,
  LAYOUT_KEYS,
  TRANSFORM_KEYS,
  createSpaceState,
  createUiMode,
  enterLabelMode,
  exitLabelMode,
  armCmdMode,
  disarmCmdMode,
  letterTarget,
  beginDragLock,
  dropDragLock,
  cycleInList,
  createInspection,
  beginInspect,
  endInspect,
  createPartFocus,
  beginPartFocus,
  endPartFocus,
  ANGLE_STEP,
  SCALE_STEP,
  VIEWS,
  layersFromValues,
  isAddressable,
  addressableList,
  addressedId,
  applyTransformKey,
  applyTransformPatch,
  applyLayout,
  addCable,
  removeCablesTouching,
  cablesTouching,
  objectForLabel,
  objectById,
  labeledObjects,
  zoomStep,
} from "./space-state.js";
import {
  CMD_CATEGORIES,
  createCommandState,
  armCommand,
  disarmCommand,
  feedCommandKey,
  stepOf,
  stepHint,
  validNextKeys,
  actionOf,
  helpText,
} from "./space-command.js";
import {
  MEDIA_ITEMS,
  MEDIA_IDS,
  mediaById,
  isMediaId,
  mediaForLabel,
  createClipboard,
  copyToClipboard,
  textCardForObject,
  clipboardTitle,
} from "./media-library.js";
import {
  partById,
  partShare,
} from "./knots.js";

import {
  NCTParameterPanel,
  useNCTParameters,
} from "../../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";

/**
 * UI Space — an early form of the environment.
 *
 * Eleven of the lab's frames stand on one platter as miniature
 * citizens, and for the first time they are not pages to visit but
 * objects in a space. Addressing is the key-click model: the
 * object under the cursor is the addressee, F is the click, Tab
 * also cycles. You turn the addressed object in your hand
 * (- = yaw, [ ] pitch, ; ' roll, . / scale), patch it to another
 * with cables (G), pick it up with a Space press (the drag lock —
 * press again to drop, Esc cancels), and rearrange the whole space
 * by loading a layout (3 / 4 / 5). There is no scroll-wheel zoom
 * and no mouse orbit: 1 and 2 move the camera, and the world
 * itself turns slowly when left alone — the turntable rest.
 *
 * KEY LABELS ARE OPT-IN: Alt+L enters label mode — the letter
 * chips appear and bare letters type-to-target; outside it, bare
 * letters are not addresses (G is purely the patch operator;
 * inside label mode G addresses the tangled tree). The stage's
 * footer is a command line (Enter arms it) speaking the CLI-v2
 * Category › Action › Argument grammar; it and label mode are
 * mutually exclusive, and its intents dispatch through the same
 * transitions as the keys.
 *
 * F is still the click: on the current object it flies you in to a
 * close seat and stands its card in the space beside it. That is as
 * far as entering goes in this early form — the objects are
 * manipulated, not yet descended into.
 */

const PARAM_DEFS = [
  {
    id: "projection", label: "Projection", type: "select", defaultValue: "iso",
    options: [
      { value: "iso", label: "Isometric" },
      { value: "perspective", label: "Perspective" },
    ],
  },
  { id: "rotation", label: "Rotation", type: "number", min: -180, max: 180, step: 1, defaultValue: 0 },
  { id: "elevation", label: "Elevation", type: "number", min: -25, max: 50, step: 1, defaultValue: 0 },
  { id: "turntable", label: "Turntable rest", type: "boolean", defaultValue: true },
  { id: "pulses", label: "Cable pulses", type: "boolean", defaultValue: true },
  { id: "labelsOn", label: "Key labels", type: "boolean", defaultValue: true },
  { id: "snap", label: "Snap", type: "boolean", defaultValue: true },
  { id: "layerData", label: "Layer · DATA", type: "boolean", defaultValue: true },
  { id: "layerDataLock", label: "Lock · DATA", type: "boolean", defaultValue: false },
  { id: "layerInstruments", label: "Layer · INSTRUMENTS", type: "boolean", defaultValue: true },
  { id: "layerInstrumentsLock", label: "Lock · INSTRUMENTS", type: "boolean", defaultValue: false },
  { id: "layerScenery", label: "Layer · SCENERY", type: "boolean", defaultValue: true },
  { id: "layerSceneryLock", label: "Lock · SCENERY", type: "boolean", defaultValue: true },
];

const css = `
.us-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.us-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.us-head h1 { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:21px; letter-spacing:.08em; text-transform:uppercase; color:#e8f3ee; margin:0; }
.us-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.us-nav a.here { color:#ffa726; }
.us-sub { padding:0 20px 10px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.us-sub b { color:#ffa726; }
.us-main { display:flex; gap:14px; margin:0 20px; align-items:stretch; }
.us-stage { flex:1; border:1px solid #2c3a41; border-radius:6px; overflow:hidden; min-width:0; height:560px; display:flex; flex-direction:column; background:#0b0e10; }
.us-stage-view { flex:1; min-height:0; position:relative; }
.us-rail { width:296px; flex:none; display:flex; flex-direction:column; gap:14px; }
.us-box { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; }
.us-box h3 { margin:0 0 8px; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:14px; letter-spacing:.08em; text-transform:uppercase; color:#e8f3ee; }
.us-readout { font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; white-space:pre-wrap; word-break:break-word; }
.us-readout .k { color:#ffa726; }
.us-keyline { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:500; font-size:13.5px; letter-spacing:.08em; text-transform:uppercase; color:#8fa3ab; line-height:1.65; }
.us-keyline b { color:#ffa726; font-weight:600; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:118px; }
.nct-parameter output { font-family:'IBM Plex Mono', ui-monospace, monospace; color:#ffa726; min-width:30px; text-align:right; }
.nct-parameter select { background:#0b0e10; color:#ffa726; border:1px solid #2c3a41; font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:11px; }
.us-chip { position:absolute; left:0; top:0; pointer-events:auto; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:11px; letter-spacing:.08em;
  padding:1px 5px; border-radius:3px; border:1px solid rgba(255,167,38,.65); background:rgba(6,12,14,.82); color:#ffa726; cursor:pointer; will-change:transform; }
.us-chip:hover { background:#ffa726; color:#0b0e10; }
.us-chip.target { background:#ffa726; color:#0b0e10; }
.us-chip.pending { background:#cc7a00; color:#0b0e10; }
.us-name { position:absolute; left:0; top:0; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:#e8f3ee;
  text-shadow:0 1px 5px #000; pointer-events:none; white-space:nowrap; will-change:transform; }
.us-compass { position:absolute; left:0; top:0; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:15px; letter-spacing:.08em;
  color:#8fa3ab; text-shadow:0 1px 6px #000; pointer-events:none; will-change:transform; }
.us-info { position:absolute; left:0; top:0; font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:11px; line-height:1.6; color:#e8f3ee;
  background:rgba(6,12,14,.66); border:1px solid rgba(255,167,38,.6); border-radius:5px; padding:7px 10px;
  pointer-events:none; max-width:250px; will-change:transform; backdrop-filter:blur(2px); }
.us-info b { color:#ffa726; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:14px; letter-spacing:.08em; text-transform:uppercase; }
.us-info span { color:#8fa3ab; font-size:10px; }
.us-plane-tag { position:absolute; left:0; top:0; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:13px; letter-spacing:.08em;
  color:#7fd4c1; border:1px solid rgba(127,212,193,.55); border-radius:3px; padding:0 5px; background:rgba(6,12,14,.7); pointer-events:none; will-change:transform; }
.us-inspect { position:absolute; left:0; top:0; font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:11px; line-height:1.65; color:#e8f3ee;
  background:rgba(6,12,14,.78); border:1px solid rgba(127,212,193,.65); border-radius:5px; padding:8px 11px;
  pointer-events:none; max-width:290px; will-change:transform; backdrop-filter:blur(2px); }
.us-inspect b { color:#7fd4c1; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:15px; letter-spacing:.08em; text-transform:uppercase; }
.us-inspect span { color:#a9bcc4; font-size:10.5px; }
.figcap { margin:8px 20px 0; font-size:11.5px; line-height:17px; color:#8fa3ab; }
.figcap b { color:#cfd8dc; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; letter-spacing:.08em; font-size:12.5px; }
.print { margin:24px 20px 34px; border-top:3px double #45565e; padding-top:18px; color:#d7dee2; font-family:Georgia, 'Times New Roman', serif; }
.print .kicker { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:12.5px; letter-spacing:.08em; color:#ffa726; text-transform:uppercase; }
.print h2 { font-size:28px; line-height:34px; margin:8px 0 6px; font-weight:normal; color:#eef4f1; }
.print .standfirst { font-size:15px; line-height:24px; font-style:italic; color:#aebcc2; max-width:620px; margin:0 0 14px; }
.print .rule { border-top:1px solid #45565e; margin:0 0 16px; }
.print .cols { column-count:3; column-gap:28px; column-rule:1px solid #2c3a41; font-size:13.5px; line-height:24px; text-align:justify; }
.print .cols p { margin:0 0 24px; }
.print .cols h3 { font-size:13.5px; letter-spacing:.08em; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; text-transform:uppercase; color:#7fd4c1; margin:0 0 6px; break-after:avoid; }
.print .index { margin-top:6px; }
.print .index h3 { font-size:13.5px; letter-spacing:.08em; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; text-transform:uppercase; color:#7fd4c1; margin:0 0 10px; }
.print .obj-row { font-size:12.5px; line-height:23px; }
.print .obj-row button { background:none; border:none; color:#cfd8dc; font:inherit; cursor:pointer; padding:0; }
.print .obj-row button:hover { color:#ffa726; text-decoration:underline; }
.print .obj-row .meta { font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:10.5px; color:#8fa3ab; }
.print .obj-row .key { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:11px; letter-spacing:.08em; color:#ffa726; border:1px solid rgba(255,167,38,.5); border-radius:3px; padding:0 4px; margin-right:7px; }
.us-cmdchips { flex:none; display:flex; flex-wrap:wrap; gap:5px; align-items:center; padding:6px 10px; background:#0d1216; border-top:1px solid #2c3a41;
  font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:500; letter-spacing:.08em; text-transform:uppercase; }
.us-cmdchips .lead { color:#5f737c; font-size:11.5px; margin-right:2px; }
.us-cmdchip { font-size:12px; color:#cfd8dc; border:1px solid #2c3a41; border-radius:3px; padding:1px 6px; background:#10161a; white-space:nowrap; }
.us-cmdchip b { color:#ffa726; font-weight:600; margin-right:4px; }
.us-cmdbar { flex:none; display:flex; align-items:center; gap:8px; padding:7px 10px; background:#0d1216; border-top:1px solid #2c3a41; cursor:text;
  font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:11.5px; color:#8fa3ab; min-height:19px; }
.us-cmdbar.armed { border-top-color:#ffa726; box-shadow:inset 0 1px 0 rgba(255,167,38,.35); }
.us-cmdtag { flex:none; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:12.5px; letter-spacing:.08em; color:#5f737c;
  border:1px solid #2c3a41; border-radius:3px; padding:0 5px; }
.us-cmdbar.armed .us-cmdtag { color:#0b0e10; background:#ffa726; border-color:#ffa726; }
.us-cmdbar .sep { color:#45565e; flex:none; }
.us-cmdfield { flex:none; min-width:34px; }
.us-cmdfield .dim { color:#45565e; }
.us-cmdhint { flex:1; min-width:0; color:#5f737c; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.us-cmdecho { flex:none; max-width:46%; color:#a9f0dd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.us-cmdecho.err { color:#ff8a75; }
`;

export default function SpaceApp() {
  const { values, setValue } = useNCTParameters(PARAM_DEFS);
  const [space, setSpace] = useState(() => createSpaceState("ring"));
  const [currentId, setCurrentId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [cardId, setCardId] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [zoomMul, setZoomMul] = useState(1);
  // Modes: label mode (Alt+L) and the armed command line exclude
  // each other; the transitions live in space-state.js.
  const [uiMode, setUiMode] = useState(() => createUiMode());
  const [cmd, setCmd] = useState(() => createCommandState());
  const [echo, setEcho] = useState({ text: "", error: false });
  // The drag lock: { id, origin } while Space has an object picked
  // up. The committed position does not move until the drop.
  const [dragLock, setDragLock] = useState(null);
  // Slice 3: the media library, the clipboard, and inspection.
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [clip, setClip] = useState(() => createClipboard());
  const [clipSummoned, setClipSummoned] = useState(false);
  const [inspection, setInspection] = useState(() => createInspection());
  const [inspectRot, setInspectRot] = useState({ yaw: 0, pitch: 0, roll: 0, scale: 1 });
  const [pastes, setPastes] = useState([]);
  // Slice 4: the named view, the drag axis lock, dynamic input.
  const [viewName, setViewName] = useState("home");
  const [axisLock, setAxisLock] = useState(null);
  // Slice 5: the data knot's part focus (F into a hovered part)
  // and the part under the cursor while the knot is current.
  const [partFocus, setPartFocus] = useState(() => createPartFocus());
  const [partHoverId, setPartHoverId] = useState(null);
  const [dynText, setDynText] = useState("");
  const dynTimer = useRef(null);

  // The layers, as the PARAMETERS panel holds them.
  const layers = layersFromValues(values);
  const showDyn = (text) => {
    setDynText(text);
    if (dynTimer.current) clearTimeout(dynTimer.current);
    dynTimer.current = setTimeout(() => setDynText(""), 1000);
  };

  const sharedRef = useRef({ lastTouch: 0, drag: null, groundLocal: { x: 0, z: 0 } });
  const lockRef = useRef(null);
  const hoverTimer = useRef(null);
  const touch = () => { sharedRef.current.lastTouch = performance.now(); };

  // Parameter changes: layer toggles additionally reconcile the
  // selection — a thing whose stratum just hid or locked stops
  // being current, hovered, pending, entered or inspected.
  const onParam = (id, value) => {
    setValue(id, value);
    if (!id.startsWith("layer")) return;
    const L = layersFromValues({ ...values, [id]: value });
    if (currentId && !isAddressable(L, currentId)) setCurrentId(null);
    if (hoverId && !isAddressable(L, hoverId)) setHoverId(null);
    if (pendingId && !isAddressable(L, pendingId)) setPendingId(null);
    if (cardId && !isAddressable(L, cardId)) setCardId(null);
    if (inspection.inspectedId && !isAddressable(L, inspection.inspectedId)) endInspectThing();
  };

  const onHover = (id) => {
    // Hover consults the layers like every addressing path.
    if (id && !isAddressable(layers, id)) id = null;
    if (id) {
      clearTimeout(hoverTimer.current);
      setHoverId(id);
    } else {
      // Moving between an object's own meshes flickers out/in;
      // clear the hover only if nothing re-asserts it at once.
      clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => setHoverId(null), 90);
    }
  };

  const thingName = (id) =>
    objectById(id)?.name || mediaById(id)?.title ||
    (id === "clipboard" ? "Clipboard" : "");

  // A knot part is hovered only while the knot is current — the
  // parts are sub-addresses of the current knot, not free-standing
  // things. The view reports every part crossing; the gate is here.
  const onPartHover = (partId) => {
    setPartHoverId(currentId === "knot" ? partId : null);
  };

  // Part focus belongs to the knot being current: if the current
  // thing changes away from the focused object, the focus ends.
  useEffect(() => {
    if (currentId !== "knot") setPartHoverId(null);
    setPartFocus((f) => (f.partId && f.objectId !== currentId ? endPartFocus() : f));
  }, [currentId]);

  const completePatch = (from, to) => {
    // A patch completed to or from the clipboard tray is a PASTE,
    // not a cable: the held card attaches onto the other thing's
    // plot, and the clipboard keeps its content (copy, not cut).
    if (from === "clipboard" || to === "clipboard") {
      const target = from === "clipboard" ? to : from;
      setPendingId(null);
      if (!clip.held) {
        setEcho({ text: "clipboard is empty — C copies something first", error: true });
        return;
      }
      setPastes((prev) => [...prev.filter((p) => p.targetId !== target), { targetId: target, item: clip.held }]);
      setEcho({ text: `CLIPBOARD → ${thingName(target)}: ${clip.held.title}`, error: false });
      setCurrentId(target);
      return;
    }
    const res = addCable(space, from, to);
    if (res.ok) setSpace(res.state);
    setPendingId(null);
    setCurrentId(to);
  };

  const onObjectClick = (id) => {
    if (!isAddressable(layers, id)) return; // locked/hidden strata don't take clicks
    // While inspecting, clicking another thing inspects THAT thing
    // (beginInspect restores the first to its home first).
    if (inspection.inspectedId) {
      if (id !== inspection.inspectedId) beginInspectThing(id);
      return;
    }
    if (pendingId && id !== pendingId) { completePatch(pendingId, id); return; }
    setCurrentId(id);
  };
  const onSelect = (id) => { touch(); onObjectClick(id); };

  const doF = () => {
    if (pendingId) {
      const target = addressedId(hoverId, currentId);
      if (target && target !== pendingId) completePatch(pendingId, target);
      return;
    }
    if (!currentId) return;
    // F on a hovered part of the current knot zooms INTO the part
    // — the part focus, one level deeper than entering the knot.
    if (currentId === "knot" && partHoverId && partById(partHoverId)) {
      setPartFocus(beginPartFocus(partFocus, "knot", partHoverId));
      setCardId(null);
      return;
    }
    // Cards and the tray are small: for items, F-enter IS inspect.
    if (isMediaId(currentId) || currentId === "clipboard") {
      beginInspectThing(currentId);
      return;
    }
    setCardId(currentId);
  };
  const doBack = () => {
    // The release chain: a part focus backs out to its knot first,
    // then a live patch, then the entered card, then the selection.
    if (partFocus.partId) { setPartFocus(endPartFocus()); return; }
    if (pendingId) { setPendingId(null); return; }
    if (cardId) { setCardId(null); return; }
    if (currentId) setCurrentId(null);
  };
  const doG = () => {
    // G's precedence is modal, plainly: INSIDE label mode letters
    // are pure addresses, so G is the tangled tree. OUTSIDE it, G
    // is purely the patch operator and addresses nothing.
    if (uiMode.labelMode) {
      const obj = objectForLabel("G");
      if (obj) setCurrentId(obj.id);
      return;
    }
    if (pendingId) {
      const target = addressedId(hoverId, currentId);
      if (target && target !== pendingId) completePatch(pendingId, target);
      return;
    }
    if (currentId) { setPendingId(currentId); return; }
  };

  /* ----- the drag lock: Space picks up, Space drops, Esc cancels ----- */

  const lockOn = (id) => {
    // Platter objects lock with their plot as origin. Wall cards
    // and the tray have mount homes instead of plots: they can be
    // carried while locked, but a drop lets them go home (their
    // position is not the space state's to commit).
    const lock = beginDragLock(space, id) || { id, origin: null };
    lockRef.current = lock;
    sharedRef.current.drag = { id, point: lock.origin ? { ...lock.origin } : { x: 0, z: 0 } };
    sharedRef.current.axisLock = null;
    sharedRef.current.axisOrigin = lock.origin
      ? { x: lock.origin.x, z: lock.origin.z }
      : { x: 0, z: 0 };
    setAxisLock(null);
    setDragLock(lock);
    setCurrentId(id);
    setPendingId(null);
    setCardId(null);
    setPartFocus(endPartFocus());
  };
  const clearAxisLock = () => {
    sharedRef.current.axisLock = null;
    setAxisLock(null);
  };
  const toggleAxisLock = (axis) => {
    const next = sharedRef.current.axisLock === axis ? null : axis;
    sharedRef.current.axisLock = next;
    setAxisLock(next);
    touch();
  };
  const lockDrop = () => {
    const lock = lockRef.current;
    if (!lock) return;
    if (lock.origin) {
      const point = sharedRef.current.drag?.point || lock.origin;
      setSpace((s) => dropDragLock(s, lock, point.x, point.z));
    }
    sharedRef.current.drag = null;
    lockRef.current = null;
    clearAxisLock();
    setDragLock(null);
    touch();
  };
  const lockCancel = () => {
    // The committed position never moved during the lock, so
    // letting go is the whole cancel: the object eases home.
    sharedRef.current.drag = null;
    lockRef.current = null;
    clearAxisLock();
    setDragLock(null);
    touch();
  };
  const toggleDragLock = () => {
    if (lockRef.current) { lockDrop(); return; }
    const id = addressedId(hoverId, currentId);
    if (id) lockOn(id);
  };

  /* ----- modes: label mode and the command line exclude each other ----- */

  const toggleLabelMode = () => {
    if (uiMode.labelMode) {
      setUiMode((m) => exitLabelMode(m));
    } else {
      setUiMode((m) => enterLabelMode(m));
      setCmd((c) => (c.armed ? disarmCommand() : c));
    }
  };
  const armCmdLine = () => {
    setCmd((c) => armCommand(c));
    setUiMode((m) => armCmdMode(m));
    setEcho({ text: "", error: false });
  };

  /* ----- command intents: dispatched through the keys' own paths ----- */

  const dispatchIntent = (intent) => {
    switch (intent.type) {
      case "select":
        setCurrentId(intent.id);
        return `selected ${intent.name}`;
      case "yaw":
      case "pitch":
      case "roll": {
        if (!currentId) return { error: "nothing is current — select an object first (o › s)" };
        const axis = intent.type;
        setSpace((s) => applyTransformPatch(s, currentId, {
          [axis]: (s.transforms[currentId]?.[axis] ?? 0) + intent.degrees,
        }));
        return `${objectById(currentId).name} ${axis} ${intent.degrees > 0 ? "+" : ""}${intent.degrees}°`;
      }
      case "size": {
        if (!currentId) return { error: "nothing is current — select an object first (o › s)" };
        setSpace((s) => applyTransformPatch(s, currentId, { scale: intent.scale }));
        return `${objectById(currentId).name} scale → ${intent.scale}× (clamped 0.40–2.50)`;
      }
      case "focus": {
        if (pendingId) return { error: "a patch is live — finish it or Esc out first" };
        if (!currentId) return { error: "nothing is current — select an object first (o › s)" };
        setCardId(currentId);
        return `entered ${objectById(currentId).name}`;
      }
      case "strip": {
        if (!currentId) return { error: "nothing is current — select an object first (o › s)" };
        const n = cablesTouching(space, currentId).length;
        setSpace((s) => removeCablesTouching(s, currentId));
        return n ? `stripped ${n} cable${n === 1 ? "" : "s"} from ${objectById(currentId).name}` : `${objectById(currentId).name} has no cables`;
      }
      case "connect": {
        // The resolver already applied the G rules (no self, no
        // duplicate); addCable applies them again at the state.
        const res = addCable(space, currentId, intent.id);
        if (!res.ok) return { error: `patch refused — ${res.reason}` };
        setSpace(res.state);
        setCurrentId(intent.id);
        return `patched ${objectById(currentId).name} ↔ ${intent.name}`;
      }
      case "layout":
        setSpace((s) => applyLayout(s, intent.layout));
        return `layout ${LAYOUTS[intent.layout].name}`;
      case "zoom":
        setZoomMul((m) => zoomStep(m, intent.dir));
        return intent.dir > 0 ? "zoom in" : "zoom out";
      case "view": {
        // Named views are pure camera moves. Choosing one cancels
        // any in-flight F camera work (the entered card's seat);
        // HOME also releases, as it always did. Inspection moves
        // the thing, not the camera, so it is not camera work and
        // is unreachable here anyway (the line is disarmed then).
        setViewName(intent.view);
        setCardId(null);
        if (intent.view === "home") {
          setPendingId(null);
          setCurrentId(null);
          return "view HOME — released";
        }
        return `view ${VIEWS[intent.view].name}`;
      }
      case "help":
        return helpText();
      case "clear":
        return null; // the echo itself is cleared
      default:
        return { error: `unknown intent ${intent.type}` };
    }
  };

  const feedCmd = (key) => {
    const res = feedCommandKey(cmd, key, {
      currentId,
      cables: space.cables,
      isAddressable: (id) => isAddressable(layers, id),
    });
    setCmd(res.state);
    if (!res.state.armed) setUiMode((m) => (m.cmdArmed ? disarmCmdMode(m) : m));
    if (res.error) { setEcho({ text: res.error, error: true }); return; }
    if (res.intent) {
      const out = dispatchIntent(res.intent);
      if (out === null) setEcho({ text: "", error: false });
      else if (typeof out === "object") setEcho({ text: out.error, error: true });
      else setEcho({ text: `${res.intent.text} → ${out}`, error: false });
      return;
    }
    setEcho((prev) => (prev.error ? { text: "", error: false } : prev));
  };

  /* ----- copy (C), inspect (I), the library (M), the tray (Alt+0) ----- */

  const copyThing = (id) => {
    const card = isMediaId(id)
      ? mediaById(id)
      : id === "clipboard"
        ? clip.held
        : objectById(id)
          ? textCardForObject(objectById(id))
          : null;
    if (!card) { setEcho({ text: "nothing to copy", error: true }); return; }
    const next = copyToClipboard(clip, card);
    setClip(next);
    setEcho(next === clip
      ? { text: `already on the clipboard — ${card.title}`, error: false }
      : { text: `copied — ${card.title}`, error: false });
  };

  const homeFor = (id) => {
    if (isMediaId(id)) {
      return { kind: "card", index: MEDIA_ITEMS.findIndex((m) => m.id === id), libraryOpen };
    }
    if (id === "clipboard") return { kind: "tray", summoned: clipSummoned };
    return {
      kind: "object",
      position: { ...space.positions[id] },
      transform: { ...space.transforms[id] },
    };
  };

  const beginInspectThing = (id) => {
    // beginInspect snapshots the home exactly and restores any
    // thing already out (exclusivity) — the view eases it back.
    const { inspection: next } = beginInspect(inspection, id, homeFor(id));
    setInspection(next);
    setInspectRot({ yaw: 0, pitch: 0, roll: 0, scale: 1 });
    setCurrentId(id);
    setCardId(null);
    setPendingId(null);
    setPartFocus(endPartFocus());
    setPartHoverId(null);
    if (lockRef.current) lockCancel();
    if (cmd.armed) { setCmd(disarmCommand()); setUiMode((m) => disarmCmdMode(m)); }
    if (uiMode.labelMode) setUiMode((m) => exitLabelMode(m));
    touch();
  };

  const endInspectThing = () => {
    setInspection(endInspect(inspection).inspection);
    setInspectRot({ yaw: 0, pitch: 0, roll: 0, scale: 1 });
    touch();
  };

  // While inspecting, the transform keys turn the SPECIMEN — a
  // temporary turn held here, never written into the space state,
  // so ending inspection restores the exact home orientation.
  const stepInspectRot = (key) => {
    const op = TRANSFORM_KEYS[key];
    if (!op) return;
    const n = { ...inspectRot };
    switch (op) {
      case "yaw-": n.yaw -= ANGLE_STEP; break;
      case "yaw+": n.yaw += ANGLE_STEP; break;
      case "pitch-": n.pitch -= ANGLE_STEP; break;
      case "pitch+": n.pitch += ANGLE_STEP; break;
      case "roll-": n.roll -= ANGLE_STEP; break;
      case "roll+": n.roll += ANGLE_STEP; break;
      case "scale-": n.scale = Math.max(0.5, inspectRot.scale / SCALE_STEP); break;
      case "scale+": n.scale = Math.min(2, inspectRot.scale * SCALE_STEP); break;
      default: return;
    }
    setInspectRot(n);
    const nm = thingName(inspection.inspectedId);
    const sgn = (v) => (v > 0 ? `+${v}` : `${v}`);
    if (op.startsWith("yaw")) showDyn(`YAW ${nm} ${sgn(n.yaw)}°`);
    else if (op.startsWith("pitch")) showDyn(`PITCH ${nm} ${sgn(n.pitch)}°`);
    else if (op.startsWith("roll")) showDyn(`ROLL ${nm} ${sgn(n.roll)}°`);
    else showDyn(`SCALE ${nm} ${n.scale.toFixed(2)}×`);
  };

  useEffect(() => {
    const onKey = (e) => {
      // While inspecting, almost everything suspends: D / Esc send
      // the specimen home, the transform keys turn it, and the
      // rest of the scheme waits. (Modes were already suspended
      // when inspection began.)
      if (inspection.inspectedId) {
        if (e.key === "Escape" || e.key === "d" || e.key === "D") {
          e.preventDefault();
          endInspectThing();
          return;
        }
        if (TRANSFORM_KEYS[e.key]) {
          e.preventDefault(); // '/' would otherwise open quick-find
          touch();
          stepInspectRot(e.key);
          return;
        }
        return;
      }
      // Alt+L toggles label mode. It is checked BEFORE the modifier
      // guard below, and preventDefaulted when seen: Alt+L is also
      // a browser/OS gesture on some platforms, but here it is ours.
      if (e.altKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        touch();
        toggleLabelMode();
        return;
      }
      // Alt+0 summons / dismisses the clipboard tray.
      if (e.altKey && e.key === "0") {
        e.preventDefault();
        touch();
        setClipSummoned((v) => !v);
        return;
      }
      // Alt+1 / Alt+2 / Alt+3 toggle DATA / INSTRUMENTS / SCENERY
      // visibility (the same values the PARAMETERS toggles hold).
      if (e.altKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        touch();
        const pid = { "1": "layerData", "2": "layerInstruments", "3": "layerScenery" }[e.key];
        onParam(pid, !values[pid]);
        return;
      }
      // The key-focus rule: only genuinely text-entering controls
      // keep their keys. A slider, checkbox or select holding focus
      // must not swallow the control scheme. (While the command line
      // is armed IT is the text-entering context — by mode, below,
      // not by element.)
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const type = (el?.type || "").toLowerCase();
      const textLike = tag === "textarea" || Boolean(el?.isContentEditable) ||
        (tag === "input" && ["text", "search", "password", "email", "url", "number"].includes(type));
      if (textLike || e.metaKey || e.ctrlKey || e.altKey) return;
      touch();

      // The armed command line owns the keyboard: printable keys
      // feed its machine, the label keys suspend, and its Esc walks
      // the composition back (ARG → ACT → CAT → disarmed).
      if (cmd.armed) {
        const k = e.key;
        if (k === "Tab" || k === "Enter" || k === "Backspace" || k === "Delete" || k === " " || k === "Escape") {
          e.preventDefault();
        }
        feedCmd(k);
        return;
      }
      // Enter arms the line (when no patch is live and no drag is
      // locked — those keep their Enter-free key worlds).
      if (e.key === "Enter") {
        e.preventDefault();
        if (!pendingId && !lockRef.current) armCmdLine();
        return;
      }
      if (e.key === " ") {
        e.preventDefault(); // always: no page scroll, no button press
        if (!e.repeat) toggleDragLock();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // Esc order: an axis lock releases first, then the drag
        // cancels (nothing was committed), then label mode, then
        // the release chain (patch → card → selection). The
        // command line's Esc never reaches here — its machine
        // consumed it above.
        if (lockRef.current && sharedRef.current.axisLock) { clearAxisLock(); touch(); return; }
        if (lockRef.current) { lockCancel(); return; }
        if (uiMode.labelMode) { setUiMode((m) => exitLabelMode(m)); return; }
        doBack();
        return;
      }
      // Drag-locked: the transform keys and patching suspend. X
      // and Z are the axis locks (press again to release); Space
      // (drop) and Esc (axis, then cancel) act, and both are above.
      if (lockRef.current) {
        if (e.key === "x" || e.key === "X") { e.preventDefault(); toggleAxisLock("x"); }
        else if (e.key === "z" || e.key === "Z") { e.preventDefault(); toggleAxisLock("z"); }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (!pendingId) {
          // Order: the eleven objects, then the library's cards
          // (while open), then the clipboard tray (while summoned)
          // — filtered through the layers, like every other path.
          const ids = addressableList(layers, {
            cardIds: libraryOpen ? MEDIA_IDS : [],
            clipboardPresent: clipSummoned,
          });
          setCurrentId(cycleInList(ids, currentId, e.shiftKey ? -1 : 1));
        }
        return;
      }
      if (e.key === "1") { e.preventDefault(); setZoomMul((m) => zoomStep(m, -1)); return; }
      if (e.key === "2") { e.preventDefault(); setZoomMul((m) => zoomStep(m, 1)); return; }
      if (LAYOUT_KEYS[e.key]) {
        e.preventDefault();
        setSpace((s) => applyLayout(s, LAYOUT_KEYS[e.key]));
        return;
      }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); doF(); return; }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); doBack(); return; }
      if (e.key === "g" || e.key === "G") { e.preventDefault(); doG(); return; }
      if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        const id = addressedId(hoverId, currentId);
        if (id) setSpace((s) => removeCablesTouching(s, id));
        return;
      }
      if (e.key === "m" || e.key === "M") {
        // M is the library operator — EXCEPT inside label mode,
        // where letters are addresses and M is the living
        // crystal's label (index 10). The same mode-scoped
        // resolution as G: fall through to letter targeting below
        // and let M address the crystal.
        if (!uiMode.labelMode) {
          e.preventDefault();
          const nextOpen = !libraryOpen;
          setLibraryOpen(nextOpen);
          if (!nextOpen) {
            if (isMediaId(currentId)) setCurrentId(null);
            if (isMediaId(hoverId)) setHoverId(null);
          }
          return;
        }
      }
      if (TRANSFORM_KEYS[e.key]) {
        const id = addressedId(hoverId, currentId);
        if (id) {
          e.preventDefault(); // '/' would otherwise open quick-find
          const ns = applyTransformKey(space, id, e.key);
          setSpace(ns);
          // Dynamic input: the footer speaks the live value while
          // the gesture runs (and for a second after).
          const t = ns.transforms[id];
          if (t) {
            const op = TRANSFORM_KEYS[e.key];
            const nm = thingName(id);
            const sgn = (v) => (v > 0 ? `+${v}` : `${v}`);
            if (op.startsWith("yaw")) showDyn(`YAW ${nm} ${sgn(Math.round(t.yaw))}°`);
            else if (op.startsWith("pitch")) showDyn(`PITCH ${nm} ${sgn(Math.round(t.pitch))}°`);
            else if (op.startsWith("roll")) showDyn(`ROLL ${nm} ${sgn(Math.round(t.roll))}°`);
            else showDyn(`SCALE ${nm} ${t.scale.toFixed(2)}×`);
          }
        }
        return;
      }
      // C copies and I inspects the addressed thing. OUR LAYOUT's
      // choice, stated plainly: in KeyPilot's stock layout I copies
      // an image; here I INSPECTS and copy moved to C. Like G before
      // them, the operators win when there is work in hand — with
      // an empty hand they fall through and are letters again
      // (C is the tray's label, I the horizon panel's).
      if (e.key === "c" || e.key === "C") {
        const id = addressedId(hoverId, currentId);
        if (id) { e.preventDefault(); copyThing(id); return; }
      }
      if (e.key === "i" || e.key === "I") {
        const id = addressedId(hoverId, currentId);
        if (id) { e.preventDefault(); beginInspectThing(id); return; }
      }
      // Bare letters target ONLY in label mode (off by default):
      // the objects' labels, then the cards' continuation labels
      // (while the library is open) — and only what the layers
      // leave addressable.
      const target = letterTarget(uiMode, e.key);
      if (target && isAddressable(layers, target.id)) {
        e.preventDefault(); setCurrentId(target.id); return;
      }
      if (uiMode.labelMode && libraryOpen) {
        const item = mediaForLabel(e.key);
        if (item && isAddressable(layers, item.id)) {
          e.preventDefault(); setCurrentId(item.id);
        }
      }
    };
    // No keyup drop and no blur drop any more — the lock is a
    // toggle. A window blur while locked DROPS IN PLACE (the
    // object stays where the cursor left it) rather than stranding
    // the lock across a focus change.
    const onBlur = () => { if (lockRef.current) lockDrop(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space, currentId, hoverId, cardId, pendingId, cmd, uiMode,
    inspection, inspectRot, libraryOpen, clip, clipSummoned, values]);

  // Dynamic input during a locked drag: the footer follows the
  // drag point (platter units) while the lock holds.
  useEffect(() => {
    if (!dragLock) return undefined;
    const iv = setInterval(() => {
      const drag = sharedRef.current.drag;
      if (drag) {
        const axis = sharedRef.current.axisLock;
        showDyn(`DRAG ${thingName(drag.id)} x ${Math.round(drag.point.x)} · z ${Math.round(drag.point.z)}${axis ? ` · ${axis.toUpperCase()} LOCK` : ""}`);
      }
    }, 120);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragLock]);

  const current = currentId ? objectById(currentId) : null;
  const pending = pendingId ? objectById(pendingId) : null;
  const tr = currentId ? space.transforms[currentId] : null;
  const layout = LAYOUTS[space.layout];
  const mode = inspection.inspectedId ? `INSPECTING — ${thingName(inspection.inspectedId)}`
    : dragLock ? "DRAG-LOCKED"
    : cmd.armed ? "COMMAND LINE"
    : pendingId ? "PATCHING — a cable is live"
    : partFocus.partId ? `PART FOCUS — ${partById(partFocus.partId)?.name || ""}`
    : cardId ? "ENTERED — the card is open"
    : uiMode.labelMode ? "LABEL MODE"
    : currentId ? "TARGETED"
    : "AT REST";
  const focusPart = partFocus.partId ? partById(partFocus.partId) : null;

  // The inspected thing's object-born panel: title, kind, and its
  // provenance or state, stood beside it in the space by the view.
  const inspectPanel = (() => {
    const id = inspection.inspectedId;
    if (!id) return null;
    if (isMediaId(id)) {
      const m = mediaById(id);
      return {
        title: m.title,
        lines: [
          `kind — ${m.kind} · media library`,
          `source — ${m.sourcePage}`,
          `domain — ${m.sourceDomain}`,
          `size — ${m.width} × ${m.height}`,
          `hash — ${m.hash}`,
          "turn it with - = [ ] ; ' · D / Esc — send it home",
        ],
      };
    }
    if (id === "clipboard") {
      return {
        title: "Clipboard",
        lines: clip.held
          ? [
              `holds — ${clip.held.title}`,
              `kind — ${clip.held.kind}`,
              `hash — ${clip.held.hash}`,
              "G from the tray onto a thing pastes it there",
              "D / Esc — send it home",
            ]
          : ["holds — nothing yet (the EMPTY plate)", "C on a thing copies it here", "D / Esc — send it home"],
      };
    }
    if (id === "crystal") {
      const o = objectById(id);
      const vals = sharedRef.current.crystalValues || [];
      return {
        title: o.name,
        lines: [
          `kind — object · ${o.group} · living`,
          "an octahedron whose 8 faces carry 8 values — the shape is the chart",
          ...vals.map((v) => `${v.label} — ${v.value.toFixed(2)}`),
          "faces advance and retreat as the values drift",
          "D / Esc — send it home, exactly as it was",
        ],
      };
    }
    const o = objectById(id);
    if (!o) return null;
    return {
      title: o.name,
      lines: [
        `kind — object · ${o.group}`,
        o.blurb,
        `home transform — yaw ${Math.round(space.transforms[id].yaw)}° · pitch ${Math.round(space.transforms[id].pitch)}° · roll ${Math.round(space.transforms[id].roll)}° · scale ${space.transforms[id].scale.toFixed(2)}×`,
        `inspection turn — yaw ${inspectRot.yaw}° · pitch ${inspectRot.pitch}° · roll ${inspectRot.roll}° · size ×${inspectRot.scale.toFixed(2)}`,
        "D / Esc — send it home, exactly as it was",
      ],
    };
  })();

  const lastPaste = pastes.length ? pastes[pastes.length - 1] : null;

  // The command line's fields, straight from the composing state.
  const cmdCat = cmd.cat ? CMD_CATEGORIES[cmd.cat] : null;
  const cmdAct = actionOf(cmd);
  const cmdStep = stepOf(cmd);
  const cmdChips = cmd.armed ? validNextKeys(cmd) : [];

  // The view also needs the active layout's presence scales.
  const viewSpace = { ...space, layoutScales: layout.scales || {} };

  return (
    <div className="us-page">
      <style>{css}</style>
      <div className="us-head">
        <h1>DEMO-DE · UI SPACE</h1>
        <nav className="us-nav">
          <a href="../">key-clicks</a>
          <a href="../react.html">shell + panelization</a>
          <a href="../definition.html">definition</a>
          <a href="../tangled.html">tangled tree 3D</a>
          <a href="../sunburst.html">sunburst 3D</a>
          <a href="../sunburst-cylinder.html">sunburst cylinder</a>
          <a href="../horizon.html">horizon monitor</a>
          <a href="../horizon3d.html">horizon 3D</a>
          <a href="../treemap.html">treemap 3D</a>
          <a href="../treemap-cube.html">treemap cube</a>
          <a className="here" href="./">ui space</a>
        </nav>
      </div>
      <p className="us-sub">
        An early form of the UI space: the lab's frames stand on one platter as
        miniature citizens, and they are worked the bimodal way, entirely by key —
        there is no scroll-wheel zoom and no mouse orbit. The object under the
        cursor is the addressee and <b>F</b> is the click (<b>Tab</b> cycles too);
        turn the addressed object with <b>-</b> <b>=</b> <b>[</b> <b>]</b> <b>;</b>{" "}
        <b>'</b>, scale it with <b>.</b> <b>/</b>, patch it to another with <b>G</b>,
        pick it up with a <b>Space</b> press (press again to drop), and rearrange
        the whole space with the layouts on <b>3</b> <b>4</b> <b>5</b>. Key labels
        are opt-in: <b>Alt+L</b> shows the letter chips and makes letters into
        addresses. The stage's footer is a command line — <b>Enter</b> arms it.
        <b>M</b> opens the MEDIA LIBRARY on the XY wall; <b>C</b> copies the
        addressed thing to the clipboard, <b>I</b> inspects it, and <b>Alt+0</b>
        summons the clipboard tray. This is an early form: the objects are
        manipulated, not yet entered for real — full descent is later work.
      </p>
      <div className="us-main">
        <div className="us-stage">
          <div className="us-stage-view">
            <SpaceView
              space={viewSpace}
              currentId={currentId}
              hoverId={hoverId}
              cardId={cardId}
              pendingId={pendingId}
              projection={String(values.projection)}
              rotation={Number(values.rotation)}
              elevation={Number(values.elevation)}
              zoomMul={zoomMul}
              turntableOn={Boolean(values.turntable)}
              pulsesOn={Boolean(values.pulses)}
              labelsOn={Boolean(values.labelsOn) && uiMode.labelMode}
              viewName={viewName}
              snapOn={Boolean(values.snap)}
              strata={{
                data: layers.data.visible,
                instruments: layers.instruments.visible,
                scenery: layers.scenery.visible,
              }}
              layers={layers}
              libraryOpen={libraryOpen}
              clipHeld={clip.held}
              clipSummoned={clipSummoned}
              inspectedId={inspection.inspectedId}
              inspectRot={inspectRot}
              partFocus={partFocus}
              partHoverId={partHoverId}
              pastes={pastes}
              inspectPanel={inspectPanel}
              sharedRef={sharedRef}
              onHover={onHover}
              onPartHover={onPartHover}
              onObjectClick={onObjectClick}
              onSelect={onSelect}
              onTouch={touch}
            />
          </div>
          {cmd.armed ? (
            <div className="us-cmdchips">
              <span className="lead">{cmdStep === "arg" ? "ARG" : cmdStep === "act" ? "ACT" : "CAT"}</span>
              {cmdChips.map((chip, i) => (
                <span className="us-cmdchip" key={`${chip.key}-${i}`} style={chip.color ? { borderColor: chip.color } : undefined}>
                  {chip.key !== chip.label ? (<><b>{chip.key}</b>{chip.label}</>) : chip.label}
                </span>
              ))}
            </div>
          ) : null}
          <div
            className={`us-cmdbar${cmd.armed ? " armed" : ""}`}
            onClick={() => { if (!cmd.armed && !pendingId && !lockRef.current) armCmdLine(); }}
            title="Command line — Enter or click to arm"
          >
            <span className="us-cmdtag">CMD</span>
            <span className="us-cmdfield" style={cmdCat ? { color: cmdCat.color } : undefined}>
              {cmdCat ? cmdCat.name : <span className="dim">cat</span>}
            </span>
            <span className="sep">›</span>
            <span className="us-cmdfield" style={cmdCat ? { color: cmdCat.color } : undefined}>
              {cmdAct ? cmdAct.name : <span className="dim">act</span>}
            </span>
            <span className="sep">›</span>
            <span className="us-cmdfield" style={{ color: "#ffa726", minWidth: 60 }}>
              {cmd.arg || (cmdStep === "arg" ? "…" : <span className="dim">arg</span>)}
            </span>
            <span
              className="us-cmdhint"
              style={!cmd.armed && dynText ? { color: "#ffa726" } : undefined}
            >
              {!cmd.armed && dynText ? dynText : stepHint(cmd)}
            </span>
            <span className={`us-cmdecho${echo.error ? " err" : ""}`}>{echo.text}</span>
          </div>
        </div>
        <div className="us-rail">
          <div className="us-box">
            <h3>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={onParam} />
          </div>
          <div className="us-box">
            <h3>READOUT</h3>
            <div className="us-readout">
              <span className="k">LAYOUT</span>{"   "}{layout.name}{"\n"}
              <span className="k">VIEW</span>{"     "}{VIEWS[viewName].name}{"\n"}
              <span className="k">ZOOM</span>{"     "}distance ×{zoomMul.toFixed(2)}{"\n"}
              <span className="k">LAYERS</span>{"   "}DATA {layers.data.visible ? "shown" : "hidden"}{layers.data.locked ? " · locked" : ""}{"\n"}
              <span className="k">LAYERS</span>{"   "}INST {layers.instruments.visible ? "shown" : "hidden"}{layers.instruments.locked ? " · locked" : ""}{"\n"}
              <span className="k">LAYERS</span>{"   "}SCEN {layers.scenery.visible ? "shown" : "hidden"}{layers.scenery.locked ? " · locked" : ""}{"\n"}
              {current ? (
                <>
                  <span className="k">CURRENT</span>{"  "}{current.name} — {current.group}{current.id === "crystal" ? " · 8 faces · values live" : ""}{"\n"}
                  <span className="k">YAW</span>{"      "}{Math.round(tr.yaw)}°{"  "}
                  <span className="k">PITCH</span> {Math.round(tr.pitch)}°{"  "}
                  <span className="k">ROLL</span> {Math.round(tr.roll)}°{"\n"}
                  <span className="k">SCALE</span>{"    "}{tr.scale.toFixed(2)}×{"\n"}
                </>
              ) : (
                <>
                  <span className="k">CURRENT</span>{"  "}—{"\n"}
                </>
              )}
              <span className="k">CABLES</span>{"   "}{space.cables.length}{"\n"}
              {focusPart ? (
                <>
                  <span className="k">PART</span>{"     "}{focusPart.name} — value {focusPart.value} · {(partShare(focusPart) * 100).toFixed(1)}% of the knot{"\n"}
                </>
              ) : null}
              <span className="k">LIBRARY</span>{"  "}{libraryOpen ? "OPEN" : "CLOSED"} · {MEDIA_ITEMS.length} items{"\n"}
              <span className="k">CLIPBOARD</span>{" "}{clipboardTitle(clip) || "—"}{"\n"}
              {lastPaste ? (
                <>
                  <span className="k">PASTE</span>{"    "}CLIPBOARD → {thingName(lastPaste.targetId)}: {lastPaste.item.title}{"\n"}
                </>
              ) : null}
              {pending ? (
                <>
                  <span className="k">PATCH</span>{"    "}from {pending.name}{"\n"}
                </>
              ) : null}
              {dragLock ? (
                <>
                  <span className="k">CARRYING</span>{" "}{thingName(dragLock.id)}{axisLock ? ` · ${axisLock.toUpperCase()} LOCK` : ""}{"\n"}
                </>
              ) : null}
              <span className="k">LABELS</span>{"   "}{uiMode.labelMode ? "ON" : "off"}{"\n"}
              <span className="k">MODE</span>{"     "}{mode}
            </div>
          </div>
          <div className="us-box">
            <h3>KEY-CLICKS</h3>
            <p className="us-keyline">
              <b>hover</b> address{" · "}<b>F</b> enter / click{" · "}<b>Tab</b> cycle{" · "}
              <b>1</b> zoom out{" · "}<b>2</b> zoom in{" · "}<b>3 4 5</b> layouts{" · "}
              <b>- =</b> yaw{" · "}<b>[ ]</b> pitch{" · "}<b>; '</b> roll{" · "}<b>. /</b> scale{" · "}
              <b>G</b> patch{" · "}<b>X</b> strip cables{" · "}
              <b>Space</b> pick up / drop{" · "}<b>D</b> back{" · "}<b>Esc</b> release a level{" · "}
              <b>Alt+L</b> label mode — letters target, <b>G</b> = tangled tree, <b>M</b> = living crystal; outside it <b>G</b> only patches and <b>M</b> opens the library{" · "}
              <b>Enter</b> command line: cat › act › arg, <b>⏎</b> runs{" · "}
              <b>M</b> media library{" · "}<b>C</b> copy{" · "}<b>I</b> inspect{" · "}<b>Alt+0</b> clipboard tray{" · "}
              our layout: <b>I</b> inspects, <b>C</b> copies — KeyPilot's stock I-copy lives on <b>C</b> here{" · "}
              <b>F</b> on a card or the tray inspects it{" · "}
              with the knot current, hover one of its parts — <b>F</b> zooms into the part, <b>D</b> backs out to the knot{" · "}
              views on the command line: <b>v › t</b> top{" · "}<b>v › f</b> front{" · "}<b>v › s</b> side{" · "}<b>v › h</b> home{" · "}
              in a drag: <b>X</b> / <b>Z</b> axis lock — <b>Esc</b> releases the axis before it cancels the drag{" · "}
              <b>Alt+1 2 3</b> layer visibility: data / instruments / scenery
            </p>
          </div>
        </div>
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — The space at rest in the RING layout: eleven miniature frames on
        the platter, each one a working object — the mesa and drum really are the
        sunburst layout, the tray and cube really are the treemap, tiled by the same
        NCTGraphite modules as their own pages. Left alone for eight seconds the
        world turns slowly on its platter; any key takes control back.
      </p>

      <div className="print">
        <div className="kicker">The environment · an early form of the UI space</div>
        <h2>One space, worked by hand</h2>
        <p className="standfirst">
          Every earlier page in this lab is a single frame, visited alone. Here the
          frames share a world. The point is not the miniatures — it is the operation:
          a complete key-click scheme for living among objects, with patching and
          layouts built in from the start.
        </p>
        <div className="rule" />
        <div className="cols">
          <div>
            <h3>THE SPACE</h3>
            <p>
              The world is the lab's platter, and its citizens are the frames
              themselves, miniaturised but not faked: the mesa's terraces are the
              sunburst partition of flare, the tray's cuboids are the binary treemap,
              the cube's faces carry the treemap's children exactly as the cube page
              spreads them. Around them the stylised citizens — the tangled tree's
              figures on their glass level sheets, the horizon skyline, the
              panelization arch, the definition's wired nodes. Containers are glass:
              the drum's wall, the cube's shell, the tray — so what is inside ghosts
              through before anything is opened. Nothing here is a picture of the
              lab; it is the lab, at tabletop scale. At the back stands the first
              of the principal planes, the XY datum wall, and on it the
              environment's first app: the MEDIA LIBRARY, a glass cabinet (M)
              whose saved items fold out onto the wall as cards. The clipboard
              (Alt+0) is a tray that flies to the platter's front edge; what it
              holds can be pasted onto any object with G, and stays held.
            </p>
            <p>
              The newest citizen works by a new convention: the DATA KNOT. A
              trefoil is one closed curve, and here its tube is glass because
              it contains things — the arc is divided into eight parts, each
              part holding one datum of a system's life (ingress, cache,
              render, index, queue, store, sync, egress), the tube's
              thickness the size of what the part holds, a bright core
              ghosting through the glass. Make the knot current and its parts
              become addresses: hover one to name it, and F zooms the camera
              into that part of the curve to read what it carries — the part
              panel gives its value and its share of the whole knot. D backs
              out to the knot again. Two further knots stand on pedestals at
              the rim as pure atmosphere — a (4,3) torus knot and a
              cinquefoil — turning slowly, holding nothing, there for the
              feel of the place. Knot forms after the classic torus-knot
              parametrizations; see Stemkoski's Parameterized Knots
              gallery.
            </p>
            <p>
              Crystals work two ways here. At the eastern rim stands the
              CRYSTAL CLUSTER — beta-quartz, a cube, a trapezohedron and a
              rhombic dodecahedron on a rock plinth — still, because minerals
              are: they do not turn, and only their lit cores breathe, very
              slowly. None of them was modelled. A crystal form is a group
              of faces related by symmetry, so each solid is generated: one
              seed face multiplied by its point group — m-3m for the
              isometric three, 6/mmm for the beta-quartz — until the faces
              close into a solid. (The trapezohedron's 24 faces belong to
              the isometric {"{211}"} form in this class; trapezohedra in
              other classes run to 6, 8 or 12, and the class's general form,
              the hexoctahedron, carries the full 48 — as many faces as the
              order of the group.) The second use is a citizen: the LIVING
              CRYSTAL, the same machinery turned to data. Its octahedron's
              eight faces carry eight values, each face's distance from the
              centre set by its value, so the shape is the chart; as the
              values drift, the solid regrows, faces advancing and
              retreating, turning slowly on its pedestal, with the values
              pinned to its faces while you hold it. Crystal forms
              generated by point-group symmetry, after OpenGeology's
              Mineralogy: Crystal Morphology and Symmetry.
            </p>
          </div>
          <div>
            <h3>THE OPERATION</h3>
            <p>
              The mouse only points. Everything done is done by key, and the scheme is
              whole: 1 and 2 move the camera in and out — there is deliberately no
              scroll-wheel zoom, because the wheel is not a key-click. An object is
              addressed by the cursor's hover or the Tab cycle; its letter joins
              them only in label mode (Alt+L), which is off by default — and the
              footer's command line addresses everything by name. The addressed object is lit — glow is address, here as
              everywhere in this environment — while context stays glass. The
              punctuation keys are the hands: - and = yaw it on its plot, [ and ]
              pitch it toward or away from you, ; and ' roll it, . and / scale it,
              each press a small eased step, holding the key a continuous motion. F
              is the click: it flies you to a seat before the object and stands its
              card in the space. D comes back, one level at a time. F goes to the
              thing — the camera flies, the thing stays home. I brings the thing
              to you: whatever you address — object, library card, the tray
              itself — travels to the inspection position before the camera,
              turns to face you at a legible size, and stands its panel beside
              itself (provenance for a media item, state for an object), while
              every other mode suspends. D or Esc sends it back to its exact
              home, position, orientation and scale as they were. The footer
              line doubles as CAD's dynamic input: while a gesture runs — a
              yaw repeating, a drag locked — it speaks the live value being
              changed, and clears a breath after the gesture ends; the typed
              command stays the exact-entry path. Gesture coarsely, line
              exactly.
            </p>
          </div>
          <div>
            <h3>PATCHING AND LAYOUTS</h3>
            <p>
              Patching is built in, after the patch-bay demo: with an object current,
              G grows a live cable from it that follows the cursor; G again, F, or a
              click lands it on a second object, and the cable stays — a curved tube
              between the two anchors with a pulse of light travelling it, data
              visibly flowing between frames. X strips every cable touching the
              addressed object. Layouts are the space's arrangements, loaded whole
              like nibglider's: 3 lays the RING, 4 gathers the DISTRICTS — graphs,
              monitors and instruments in their quarters — and 5 sets the THEATRE,
              the cube centre-stage under a shallow arc of the rest. Switching eases
              every object to its new plot over a breath; transforms and cables
              persist, and the cables follow their objects as they travel. Two
              letters carry double duty, and the mode decides what they mean: G
              and M are addresses only inside label mode — there G is the tangled
              tree and M the living crystal. Outside it, letters are operators:
              G patches, and M opens the media library.
            </p>
          </div>
        </div>
        <div className="index">
          <h3>THE CITIZENS — CLICK TO TARGET</h3>
          {labeledObjects().map(({ object, label }) => (
            <div className="obj-row" key={object.id}>
              <span className="key">{label}</span>
              <button onClick={() => onSelect(object.id)}>{object.name}</button>{" "}
              <span className="meta">— {object.group} · {object.blurb}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
