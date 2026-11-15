import { useEffect, useRef, useState } from "react";
import SpaceView from "./SpaceView.jsx";
import {
  OBJECTS,
  LAYOUTS,
  LAYOUT_KEYS,
  VIEW_KEYS,
  FIELD_SIZES,
  FIELD_DEFAULT_INDEX,
  fieldStep,
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
  createDescent,
  descend,
  climbDescent,
  displayRootOf,
  descentDepth,
  createBookAccess,
  bookAccessTo,
  climbBookAccess,
  bookAccessDepth,
  bookAccessedId,
  bookPageOutId,
  stepSpread,
  beginPartFocus,
  endPartFocus,
  ANGLE_STEP,
  SCALE_STEP,
  VIEWS,
  layersFromValues,
  isAddressable,
  addressableList,
  addressedId,
  resolveFAction,
  EVENTS,
  resolveBackLevels,
  resolveEKey,
  resolveRotateTarget,
  transformOpOf,
  IDENTITY_QUAT,
  stepPlatterQuat,
  stepPlatterSpin,
  resolveScaleTarget,
  resolveDollyTarget,
  stepRingSpin,
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
  createOpenApp,
  openApp as openAppTo,
  setAppMode as setAppModeTo,
  closeApp as closeAppTo,
  resolveOpenAction,
  ringItemById,
  ringItemForLabel,
  labeledRingItems,
} from "./space-state.js";
import {
  makeTrack,
  fullWindow,
  windowZoom,
  windowDrill,
  pushNav,
  popNav,
  REGION_ZONES,
} from "./waveform.js";
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
import { resolveKeyboard, lastKeyEcho } from "./keyboard.js";
import {
  MEDIA_ITEMS,
  MEDIA_IDS,
  mediaById,
  isMediaId,
  mediaForLabel,
  labeledMedia,
  createClipboard,
  copyToClipboard,
  textCardForObject,
  clipboardTitle,
} from "./media-library.js";
import {
  partById,
  partShare,
} from "./knots.js";
import { buildDataTree, dataBranchById } from "./lsystems.js";
import { isSubnodeObject, subnodeById, subnodeRootOf } from "./subnodes.js";
import { BOOK_TOTALS, SPREAD_COUNT, spreadIndexForPage } from "./book.js";
import { HIERARCHY } from "./hierarchy.js";
import {
  ENVIRONMENT,
  deviceList,
  printerOf,
  queueTotals,
  connectionTotals,
  ENV_TOTALS,
} from "./environment.js";
import {
  MAIL_TOTALS,
  folderNodes,
  messageById,
} from "./mail.js";
import {
  WEBFRAME,
  WEB_LAYOUT,
  WEB_TOTALS,
  resolveWebLink,
  pushWebNav,
  popWebNav,
} from "./webframe.js";
import { SPACE_LANES, laneNow, laneSource } from "./horizon-lanes.js";

// Slice 7: the data tree's own bookkeeping for panels and readout —
// the same buildDataTree(HIERARCHY) the view grows in the scene
// (deterministic, so the two builds agree node for node). Slice
// 13: the hierarchy is the repository itself (hierarchy.js).
const DATA_TREE = buildDataTree(HIERARCHY);

import {
  NCTParameterPanel,
  useNCTParameters,
} from "../../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";

/**
 * UI Space — an early form of the environment.
 *
 * Fifteen of the lab's frames stand on one platter as miniature
 * citizens, and for the first time they are not pages to visit but
 * objects in a space. Addressing is the key-click model: the
 * object under the cursor is the addressee, F is the click, Tab
 * also cycles. You turn the addressed object in your hand
 * (Q/W pitch, E/R yaw, T/Y roll, B/N plane-rotate, Z/X magnify —
 * pivoting at the centre of its bounds), patch it to another
 * with cables (G), pick it up with a Space press (the drag lock —
 * press again to drop, Esc cancels), and rearrange the whole space
 * by loading a layout (7 / 8 / 9). There is no scroll-wheel zoom
 * and no mouse orbit: C and V dolly the camera (toward the hovered
 * citizen, when there is one), 5 and 6 change the field (the focal
 * zoom — the lens, not the camera), and the world itself turns
 * slowly when left alone — the turntable rest.
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
 * F is still the click: on the ADDRESSED object — the one under
 * the cursor, or the current one when the cursor addresses
 * nothing — it flies you in to a close seat and stands its card
 * in the space beside it. That is as far as entering goes in
 * this early form — the objects are manipulated, not yet
 * descended into.
 *
 * Slice 8 is the first opening of a different kind: the platter
 * gains a RING, and the ring carries an APP — Waveform, the audio
 * app. A thing that bears an app does not enter; it OPENS: F
 * takes it onto the centre stage (the main circle at the
 * platter's heart, the space remaining around it), E across the
 * whole platter (the citizens hide). While an app holds the
 * stage, the ring belongs to the app — its controls, tools,
 * states and portals ride there — and the keys change scope:
 * Space plays, C/V zoom inside the app's own frame, F activates
 * and drills, and the back events walk the app's own levels.
 *
 * Slice 11 gives the space EVENT MESSAGING: the completion and
 * retreat verbs are named events — A is FINISH, S is GO_BACK_I,
 * D is GO_BACK_II, Esc is CANCEL — resolved against the release
 * stack by one pure resolver (resolveBackLevels in
 * space-state.js). CANCEL and GO_BACK_I pop ONE level, GO_BACK_II
 * up to TWO, so inside an app D is now the big step back and
 * Esc/S the single step (slice 8's "Esc leaves the app" survives
 * only as the appClose level: Esc leaves when the app's nav is
 * already empty). The rotate keys resolve a target — hovered
 * citizen, the ring (which only spins), the current citizen,
 * else the platter itself, which the cluster turns in camera
 * terms (and which cannot be magnified) — and rotations pivot
 * at each citizen's bounds centre. The number row is the film
 * crew's (§14/§15): 1–4 the named views, 5/6 the field sizes,
 * 7/8/9 the object layouts; and the Z/X operation is MAGNIFY
 * (§16) — it enlarges one thing for examination while the rest
 * of the space stays in place (the transform record's factor
 * stays `scale` inside; the operation's name is MAGNIFY).
 *
 * The shell is the space itself: the scene fills the viewport
 * and everything that used to be page furniture around it —
 * parameters, readout, instructions, the citizens index — now
 * stands inside the viewport as stationary overlay panels in
 * the environment's own glass-and-amber conventions. The page
 * never scrolls; panels own their overflow.
 */

const PARAM_DEFS = [
  {
    id: "projection", label: "Projection", type: "select", defaultValue: "perspective", group: "view",
    options: [
      { value: "iso", label: "Isometric" },
      { value: "perspective", label: "Perspective" },
    ],
  },
  { id: "rotation", label: "Rotation", type: "number", min: -180, max: 180, step: 1, defaultValue: 0, group: "view" },
  { id: "elevation", label: "Elevation", type: "number", min: -25, max: 50, step: 1, defaultValue: 50, group: "view" },
  { id: "turntable", label: "Turntable rest", type: "boolean", defaultValue: true },
  { id: "pulses", label: "Cable pulses", type: "boolean", defaultValue: true },
  { id: "ambientMotion", label: "Ambient motion", type: "boolean", defaultValue: true },
  { id: "labelsOn", label: "Key labels", type: "boolean", defaultValue: true },
  { id: "keyboardPanel", label: "Keyboard panel", type: "boolean", defaultValue: true },
  { id: "snap", label: "Snap", type: "boolean", defaultValue: true },
  {
    // Slice 13: the tangled tree's second course. The switch is a
    // parameter — key-click native like every other setting here;
    // subnodes.js holds the two datasets it names.
    id: "tangleData", label: "Tangled tree data", type: "select", defaultValue: "genealogy",
    options: [
      { value: "genealogy", label: "Genealogy — the Greek figures" },
      { value: "imports", label: "Imports — demo-de's own modules" },
    ],
  },
  {
    // Slice 13-2: the cylinder book's presentation — the same
    // state the U key toggles while the book is current.
    id: "bookStyle", label: "Sample Book style", type: "select", defaultValue: "cylinder",
    options: [
      { value: "cylinder", label: "Cylinder — leaves around the drum" },
      { value: "spread", label: "Spread — two pages at a time" },
    ],
  },
  { id: "layerData", label: "Layer · DATA", type: "boolean", defaultValue: true },
  { id: "layerDataLock", label: "Lock · DATA", type: "boolean", defaultValue: false },
  { id: "layerInstruments", label: "Layer · INSTRUMENTS", type: "boolean", defaultValue: true },
  { id: "layerInstrumentsLock", label: "Lock · INSTRUMENTS", type: "boolean", defaultValue: false },
  { id: "layerScenery", label: "Layer · SCENERY", type: "boolean", defaultValue: true },
  { id: "layerSceneryLock", label: "Lock · SCENERY", type: "boolean", defaultValue: true },
];

/** The first moves, as a chip strip standing over the scene at rest. */
const FIRST_MOVES = [
  { key: "F", label: "open" },
  { key: "E", label: "yaw · full platter on the ring" },
  { key: "Tab", label: "cycle" },
  { key: "C / V", label: "dolly out · in" },
  { key: "1–4", label: "views" },
  { key: "5 / 6", label: "field − · +" },
  { key: "7 8 9", label: "object layouts" },
  { key: "A", label: "finish" },
  { key: "D", label: "go back II" },
  { key: "Space", label: "carry" },
  { key: "G", label: "patch" },
  { key: "M", label: "library" },
  { key: "Enter", label: "command line" },
];

/**
 * The open audio app's ring furniture (slice 8): while the app
 * holds the stage the ring carries its transport, its track
 * portals and its state tokens. Tab cycles stage → these, in
 * this order; F (or a click) activates the addressed one.
 */
const APP_TOKEN_IDS = ["tok-play", "tok-pulse", "tok-voice", "tok-rain", "tok-zoom", "tok-loop"];
const TOKEN_NAMES = {
  "tok-play": "Play / pause",
  "tok-pulse": "Pulse",
  "tok-voice": "Voice",
  "tok-rain": "Rain",
  "tok-zoom": "Zoom in",
  "tok-loop": "Loop",
};
const TOKEN_TRACKS = { "tok-pulse": "pulse", "tok-voice": "voice", "tok-rain": "rain" };

/**
 * The open WEB app's ring furniture (slice 15): while the
 * captured page holds the stage the ring carries its reading
 * controls — back to the top, and a section back / forward.
 * Tab cycles stage → these, in this order; F activates the
 * addressed one, as the waveform's tokens are activated.
 */
const WEB_TOKEN_IDS = ["tok-w-top", "tok-w-prev", "tok-w-next"];
const WEB_TOKEN_NAMES = {
  "tok-w-top": "Top of the page",
  "tok-w-prev": "Previous section",
  "tok-w-next": "Next section",
};

/** The whole key-click scheme, grouped by function for the guide. */
const KEY_GROUPS = [
  {
    title: "Address & enter",
    rows: [
      ["hover", "the object under the cursor is the addressee"],
      ["Tab", "cycle everything addressable (Shift+Tab back)"],
      ["F", "open the addressed object — its card stands in space"],
      ["F on the ring", "opens the addressed app — Waveform, or the captured Web page — onto the centre stage"],
      ["E on the ring", "open the addressed app across the whole platter, citizens hidden — on a citizen, E is yaw"],
      ["Alt+L", "label mode — letter chips appear, bare letters target"],
    ],
  },
  {
    title: "Events — finish & back",
    rows: [
      ["A", "FINISH — complete what's in flight: land a live patch on the addressed thing, drop a carry"],
      ["S", "GO BACK I — back exactly one level, the same as Esc"],
      ["D", "GO BACK II — back up to two levels in one press: focus + card, or out of the app and off it"],
      ["Esc", "CANCEL — release one level; cancels a drag before it drops"],
      ["the stack", "drag → inspection → app steps → app close → part / branch / node focus → sunburst descent → book access → patch → card → selection"],
    ],
  },
  {
    title: "Turn & carry",
    rows: [
      ["E R", "yaw — about the centre of the object's bounds, not its base"],
      ["Q W", "pitch it"],
      ["T Y", "roll it"],
      ["B N", "rotate plane — turn it in its own plane, about its own normal; no other axis changes"],
      ["Z X", "magnify it — enlarge one thing for examination while the rest of the space stays in place"],
      ["targets", "rotate lands under the cursor: a hovered citizen first, then the ring (E R B N only spin it), then the current citizen — else the platter, which the cluster turns as the camera sees it, and which cannot be magnified"],
      ["Space", "pick the addressed object up / press again to drop"],
      ["X / Z", "in a drag: lock movement to that world axis — the drag scope owns them while a carry is live"],
    ],
  },
  {
    title: "Object layouts",
    rows: [
      ["7 8 9", "layouts: RING · DISTRICTS · THEATRE — they rearrange the citizens; the camera does not move"],
    ],
  },
  {
    title: "Camera",
    rows: [
      ["C", "dolly out — the camera itself pulls back; there is no scroll-wheel zoom"],
      ["V", "dolly in — and no mouse orbit; pressed over a citizen, the dolly runs toward that citizen"],
      ["5", "field − — one field size wider (the zoom: the lens changes, the camera stays)"],
      ["6", "field + — one field size narrower: LONG · MEDIUM LONG · MEDIUM · MEDIUM CLOSE · CLOSE"],
      ["1 2 3 4", "the named views: PLAN · ELEVATION · SIDE · HOME — the VIEW fieldset's order, the same goView"],
      ["v › t/f/s/h", "the same views on the command line — loading one levels the platter's camera turns"],
    ],
  },
  {
    title: "Patch, media & clipboard",
    rows: [
      ["G", "start a patch from the addressed object; G / F / A / click lands it"],
      ["J", "strip every cable touching the addressed object"],
      ["M", "open / close the media library on the XY wall"],
      ["H", "copy the addressed thing to the clipboard"],
      ["I", "inspect the addressed thing — it comes to you"],
      ["Alt+0", "summon / dismiss the clipboard tray"],
      ["Alt+1 2 3", "layer visibility: DATA / INSTRUMENTS / SCENERY"],
    ],
  },
  {
    title: "Modes & the command line",
    rows: [
      ["Enter", "arm the command line: category › action › argument, ⏎ runs — on the line, Enter is the finish (A is a letter there)"],
      ["K", "hide / show the keyboard panel — inside label mode K is the definition's address"],
      ["Alt+L", "in label mode the letters are addresses (G the tangled tree, M the living crystal, E the sunburst cylinder, B the drum, N the tree, O the sample book, P the devices, Q the mail); outside it they are operators"],
      ["H / I", "here I inspects and H copies — KeyPilot's stock I-copy lives on H in this layout"],
      ["F on a card / tray", "inspects it, like I"],
      ["knot parts", "with the knot current, hover a part — F flies into it, D (GO BACK II) backs out to the knot"],
      ["tree branches", "with the tree current, hover a depth-1 branch — F flies to the subtree, D backs out to the tree"],
      ["treemap nodes", "with the tray current, hover a plate or a cuboid — it lights, its card stands in the space, and F flies into the node"],
      ["tangled figures", "with the tangled tree current, hover a figure — its card names the figure and its line; F flies into it. PARAMETERS switches the tree's course: the Greek genealogy, or demo-de's own module import graph"],
      ["sunburst wedges", "with the mesa or the drum current, hover a wedge to read it — F on a leaf wedge flies into it; F on a branch wedge descends"],
      ["sunburst descent", "F on a branch wedge re-roots the sunburst at that wedge — values and shares are of the new root, and the readout shows the path from the repository root. The backs climb out, one root per level, until the true root stands again. Descent is a display state only: rotation, plane spin and MAGNIFY are exactly as you left them, on the way down and on the way back up"],
      ["the book's tiers", "with the sample book current, its tiers are sub-addresses: hover a CHAPTER band segment (the drum's upper band), a SECTION segment (the lower band) or a PAGE leaf at the rim — it lights, its card stands in the space, and the readout's NODE line follows"],
      ["book access", "F on a chapter or section ACCESSES it: the drum turns so the accessed arc faces the front, and the tiers outside it ghost. F on a page slides the page OUT of the drum to be read in full. The backs climb page → section → chapter → whole book, one tier per level — access is a display state, never a transform"],
      ["book style", "U (or PARAMETERS · Sample Book style) stands the book open instead: two pages at a time, verso left and recto right. The title page stands alone as the first spread's recto, with a blank verso; the pages then pair in reading order"],
      ["spread flipping", "in the spread presentation B and N flip the spread (they read SPREAD − / SPREAD + on the keyboard panel) instead of plane-spinning the book; F on a standing leaf turns to that page's spread. In the cylinder presentation B and N plane-spin as usual"],
      ["devices & hosts", "with Devices current, hover a device on its shelf, the hub, or a host token standing on the ring's back arc — it lights, its card stands in the space, and F flies into it. The printer's card lists its queue: a sheet stands in its tray per job, the printing job's sheet half-fed"],
      ["net lanes", "the horizon citizens' last two lanes are NETWORK IN and NETWORK OUT, driven by the environment snapshot's captured strip of interface rates; the other six lanes keep the tempered walk"],
      ["mail folders", "with Mail current, its folders are sub-addresses in the pigeonhole cabinet: hover a compartment to read its count and unread, F flies into it. Projects' subfolders nest inside its cell"],
      ["the post shelf", "beside the media library on the XY wall stands the POST SHELF: the recent letters as standing cards, sender and subject on their faces. With Mail current, hover a letter to read it; F opens it on the centre stage, and the backs close it like an app — one level, at the app's own tier"],
      ["the web frame", "the ring's second item is WEB: a captured page (Wikipedia's Snow globe), its structure — title, sections, links — laid out as a document on a sheet. It is a capture, not a live page: live pages need the local bridge, a later slice"],
    ],
  },
  {
    title: "In an open app",
    rows: [
      ["Space", "play / pause — the drag lock waits outside the app; in the Web app, step the reading position to the next section"],
      ["C / V", "over the waveform fence, zoom the window inside the app's own frame — the camera stays; over nothing, they do nothing. In the Web app, step the reading position a section back / forward"],
      ["F", "activate the addressed ring token; on the waveform, drill into the hovered stretch; on the web sheet, follow the hovered link or read the hovered section"],
      ["Tab", "cycle the stage and the app's ring tokens"],
      ["S / Esc", "CANCEL / GO BACK I — one step back in the app; with its history empty, the step leaves the app"],
      ["D", "GO BACK II — up to two steps back: two history steps, or a step and out, or out and release"],
      ["E", "expand a centre-stage app to the whole platter"],
    ],
  },
];

const GUIDE_TABS = [
  { id: "brief", label: "Brief" },
  { id: "keys", label: "Keys" },
  { id: "notes", label: "Field notes" },
  { id: "citizens", label: "Citizens" },
];

const css = `
html, body, #root { height:100%; margin:0; overflow:hidden; background:#0b0e10; }
.us-page { position:fixed; inset:0; height:100dvh; overflow:hidden; background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; }
.us-stage { position:absolute; inset:0; overflow:hidden; background:#0b0e10; }
.us-stage-view { position:absolute; inset:0; }
.us-head { position:absolute; z-index:30; top:10px; left:12px; right:12px; min-height:38px; display:flex; align-items:center; gap:16px; padding:5px 10px;
  border:1px solid rgba(44,58,65,.9); border-radius:6px; background:rgba(13,18,22,.86); backdrop-filter:blur(8px); box-shadow:0 8px 28px rgba(0,0,0,.35); }
.us-head h1 { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:18px; letter-spacing:.08em; text-transform:uppercase; color:#e8f3ee; margin:0; white-space:nowrap; }
.us-nav { display:flex; align-items:center; gap:13px; overflow-x:auto; white-space:nowrap; scrollbar-width:none; }
.us-nav::-webkit-scrollbar { display:none; }
.us-nav a { color:#7fd4c1; font-size:12px; text-decoration:none; }
.us-nav a.here { color:#ffa726; }
.us-sub { font-size:12px; color:#8fa3ab; line-height:1.55; margin:0 0 10px; }
.us-sub b { color:#ffa726; }
.us-box { border:1px solid rgba(44,58,65,.95); border-radius:6px; background:rgba(16,22,26,.9); padding:10px 12px; box-shadow:0 10px 30px rgba(0,0,0,.38); backdrop-filter:blur(8px); }
.us-box h3 { margin:0 0 8px; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:14px; letter-spacing:.08em; text-transform:uppercase; color:#e8f3ee; }
.us-overlay-panel { position:absolute; z-index:24; display:flex; flex-direction:column; min-height:0; }
.us-panel-head { flex:none; display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
.us-panel-head h3 { margin:0; }
.us-panel-toggle { flex:none; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  color:#ffa726; background:rgba(255,167,38,.08); border:1px solid rgba(255,167,38,.55); border-radius:3px; padding:2px 7px; cursor:pointer; }
.us-panel-toggle:hover { background:#ffa726; color:#0b0e10; }
.us-hud { left:12px; top:60px; width:304px; max-height:min(322px, calc(100dvh - 190px)); }
.us-hud .us-readout { overflow-y:auto; min-height:0; padding-right:2px; }
.us-params { right:12px; top:60px; width:308px; max-height:calc(100dvh - 196px); }
.us-params-body { overflow-y:auto; min-height:0; padding-right:2px; }
.us-overlay-panel.collapsed { width:auto; }
.us-overlay-panel.collapsed .us-panel-head { margin-bottom:0; }
.us-firstmoves { position:absolute; z-index:23; top:60px; left:354px; right:354px; display:flex; justify-content:center; align-items:flex-start; flex-wrap:wrap; gap:5px; pointer-events:none; }
.us-move { display:inline-flex; align-items:center; gap:6px; padding:3px 7px; border:1px solid rgba(44,58,65,.9); border-radius:3px; background:rgba(13,18,22,.82);
  font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:500; font-size:12px; letter-spacing:.07em; text-transform:uppercase; color:#8fa3ab; backdrop-filter:blur(6px); }
.us-move b { color:#ffa726; font-weight:600; }
/* Slice 11 (§8): the guide's bottom is raised to clear the bottom
   dock WITH the keyboard panel seated in it (the dock is ~350px
   tall then, against ~118px before) at the desktop widths where
   the centred panel would otherwise reach the guide's column. */
.us-guide { left:12px; bottom:360px; width:min(404px, calc(100vw - 24px)); max-height:min(500px, calc(100dvh - 500px)); }
.us-guide-tabs { flex:none; display:flex; flex-wrap:wrap; gap:5px; margin-bottom:9px; }
.us-guide-tab { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:12px; letter-spacing:.08em; text-transform:uppercase;
  color:#8fa3ab; background:#0b0e10; border:1px solid #2c3a41; border-radius:3px; padding:2px 8px; cursor:pointer; }
.us-guide-tab:hover { color:#e8f3ee; border-color:#45565e; }
.us-guide-tab.here { color:#0b0e10; background:#ffa726; border-color:#ffa726; }
.us-guide-body { overflow-y:auto; min-height:0; padding-right:3px; }
.us-guide-body p { font-size:12.5px; line-height:1.62; color:#b8c7cc; margin:0 0 11px; }
.us-guide-body p b, .us-guide-body li b { color:#ffa726; }
.us-guide-body h4 { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:13.5px; letter-spacing:.08em; text-transform:uppercase; color:#7fd4c1; margin:15px 0 6px; }
.us-guide-body h4:first-child { margin-top:0; }
.us-keygroup { margin-bottom:13px; }
.us-keygroup h4 { margin-bottom:5px; }
.us-keyrow { display:flex; gap:9px; align-items:baseline; padding:3px 0; border-top:1px solid rgba(44,58,65,.55); font-size:12px; line-height:1.45; color:#aebcc2; }
.us-keyrow:first-of-type { border-top:none; }
.us-keycap { flex:none; min-width:58px; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:11.5px; letter-spacing:.06em; color:#ffa726;
  border:1px solid rgba(255,167,38,.5); border-radius:3px; padding:0 5px; text-align:center; }
.us-citizen-row { display:flex; gap:8px; align-items:baseline; width:100%; text-align:left; background:none; border:none; border-top:1px solid rgba(44,58,65,.55);
  color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; font-size:12px; line-height:1.45; padding:6px 0; cursor:pointer; }
.us-citizen-row:hover .us-citizen-name { color:#ffa726; text-decoration:underline; }
.us-citizen-name { flex:none; font-weight:bold; }
.us-citizen-meta { color:#8fa3ab; font-size:11px; }
.us-bottomdock { position:absolute; z-index:26; left:0; right:0; bottom:0; display:flex; flex-direction:column; }
.us-statusbar { flex:none; display:flex; align-items:center; gap:14px; padding:4px 12px; border-top:1px solid rgba(44,58,65,.9); background:rgba(13,18,22,.88);
  font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:11px; color:#8fa3ab; backdrop-filter:blur(8px); }
.us-statusbar .mode { color:#ffa726; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:13px; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; }
.us-statusbar .context { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.us-statusbar .dyn { flex:none; max-width:44%; color:#ffa726; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
@media (max-width:1180px) {
  .us-firstmoves { left:12px; right:12px; top:calc(60px + min(322px, calc(100dvh - 190px)) + 10px); justify-content:flex-start; }
  .us-hud { width:282px; }
  .us-params { width:282px; }
  .us-guide { max-height:min(430px, calc(100dvh - 470px)); }
}
@media (max-width:760px) {
  .us-head h1 { font-size:15px; }
  .us-hud { display:none; }
  .us-params { width:min(308px, calc(100vw - 24px)); }
  .us-guide { bottom:112px; }
  .us-firstmoves { display:none; }
}
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
/* Slice 11 (§8): the panel no longer floats at a fixed offset —
   it is rendered INSIDE the bottom dock as its first child, so
   its bottom edge sits directly on the command-line/status
   assembly's top edge in every state (chips row shown or not).
   Centred by the dock's flex column; glass styling unchanged.
   §10: collapsed, it is its head bar only, still on that edge. */
.us-keyboard { align-self:center; width:min(860px, 96vw);
  border:1px solid rgba(44,58,65,.9); border-radius:6px; background:rgba(13,18,22,.66); backdrop-filter:blur(10px);
  box-shadow:0 10px 30px rgba(0,0,0,.38); padding:8px 10px 9px; }
.us-kb-head { display:flex; align-items:center; gap:10px; margin-bottom:7px; }
.us-keyboard.collapsed .us-kb-head { margin-bottom:0; }
.us-kb-head-btns { flex:none; display:flex; gap:5px; }
.us-kb-head h3 { margin:0; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:14px; letter-spacing:.08em; text-transform:uppercase; color:#e8f3ee; }
.us-kb-echo { flex:1; min-width:0; text-align:right; font-family:'IBM Plex Mono', ui-monospace, monospace; font-size:11px; color:#ffa726; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.us-kb-grid { display:flex; flex-direction:column; gap:4px; }
.us-kb-row { display:flex; gap:4px; }
.us-kb-cap { flex-basis:0; min-width:0; min-height:33px; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; gap:1px;
  border:1px solid rgba(44,58,65,.75); border-radius:4px; background:rgba(16,22,26,.5); padding:3px 1px 2px; opacity:.5; }
.us-kb-cap.bound { opacity:1; border-color:rgba(127,212,193,.4); }
.us-kb-cap.op { border-color:rgba(255,167,38,.55); }
.us-kb-cap.active { background:rgba(127,212,193,.3); border-color:#7fd4c1; transform:translateY(-1px); opacity:1; }
.us-kb-glyph { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:13px; letter-spacing:.05em; line-height:1.1; color:#8fa3ab; }
.us-kb-cap.bound .us-kb-glyph { color:#e8f3ee; }
.us-kb-fn { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:500; font-size:7.5px; letter-spacing:.04em; text-transform:uppercase; line-height:1.15; text-align:center; color:#7fd4c1;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.us-kb-cap.op .us-kb-fn { color:#ffa726; }
.us-kb-combos { display:flex; flex-wrap:wrap; gap:5px; margin-top:7px; }
.us-kb-combo { display:inline-flex; align-items:center; gap:6px; padding:2px 7px; border:1px solid rgba(44,58,65,.85); border-radius:3px; background:rgba(13,18,22,.55);
  font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:500; font-size:11px; letter-spacing:.07em; text-transform:uppercase; color:#8fa3ab; }
.us-kb-combo b { color:#ffa726; font-weight:600; }
@media (max-width:1500px) {
  .us-keyboard { width:min(640px, 96vw); }
}
@media (max-width:760px) {
  /* Small screens: only the head shows — in-flow in the dock now,
     where the panel used to float at bottom:112px. */
  .us-keyboard { width:auto; min-width:210px; }
  .us-kb-grid, .us-kb-combos { display:none; }
  .us-kb-head { margin-bottom:0; }
}
.us-view-fieldset { border:1px solid rgba(44,58,65,.95); border-radius:6px; margin:0 0 12px; padding:6px 10px 10px; min-width:0; }
.us-view-fieldset legend { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#7fd4c1; padding:0 5px; }
.us-view-btns { display:flex; gap:5px; margin:2px 0 9px; }
.us-view-btn { flex:1; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:12px; letter-spacing:.08em; text-transform:uppercase;
  color:#8fa3ab; background:#0b0e10; border:1px solid #2c3a41; border-radius:3px; padding:2px 4px; cursor:pointer; }
.us-view-btn:hover { color:#e8f3ee; border-color:#45565e; }
.us-view-btn.here { color:#0b0e10; background:#ffa726; border-color:#ffa726; }
`;

/**
 * The keyboard panel (slice 10): a semitransparent glass board
 * that renders the RESOLVED keymap and owns nothing — the caps
 * are display only, and the board never runs a command (after
 * nibglider's on-screen keyboard, whose panel likewise renders
 * resolved caps from a shared keymap). Its one piece of timing
 * is its own: resolution marks the last-pressed cap active, and
 * the lift lasts ~300 ms from the recorded press; a tick clears
 * it so no cap stays lit after the moment has passed.
 *
 * Slice 11: the panel is seated INSIDE the bottom dock (§8), and
 * its head carries a Collapse button beside Hide (§10) —
 * collapsing reduces it to the head bar alone (title, scope tag,
 * last-key echo and buttons stay live; the cap grid and combos
 * strip are not rendered), and the bar's bottom edge stays on
 * the command line's top edge exactly as the full panel's does.
 * Collapsed is independent of visibility: it persists across
 * Hide/show, and the panel starts expanded.
 */
function KeyboardPanel({ kb, lastKey, onHide, collapsed, onToggleCollapse }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastKey) return undefined;
    const t = setTimeout(() => setTick((x) => x + 1), 320);
    return () => clearTimeout(t);
  }, [lastKey]);
  const fresh = Boolean(lastKey) && performance.now() - lastKey.at <= 300;
  const echo = lastKeyEcho(kb, lastKey?.code || null);
  return (
    <section className={`us-keyboard${collapsed ? " collapsed" : ""}`} data-testid="keyboard-panel" aria-label="Keyboard panel">
      <div className="us-kb-head">
        <h3>KEYBOARD</h3>
        <span className="us-cmdtag">{kb.scopeName}</span>
        <span className="us-kb-echo">{echo}</span>
        <span className="us-kb-head-btns">
          <button
            type="button"
            className="us-panel-toggle"
            aria-expanded={!collapsed}
            onClick={(e) => { onToggleCollapse(); e.currentTarget.blur(); }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button
            type="button"
            className="us-panel-toggle"
            onClick={(e) => { onHide(); e.currentTarget.blur(); }}
          >
            Hide
          </button>
        </span>
      </div>
      {collapsed ? null : (
        <>
          <div className="us-kb-grid">
            {kb.rows.map((row, i) => (
              <div className="us-kb-row" key={i}>
                {row.map((c) => (
                  <div
                    key={c.code}
                    title={c.binding?.hint || undefined}
                    className={`us-kb-cap${c.binding ? " bound" : ""}${c.binding?.operator ? " op" : ""}${c.active && fresh ? " active" : ""}`}
                    style={{ flexGrow: c.width }}
                  >
                    <span className="us-kb-glyph">{c.glyph}</span>
                    {c.binding ? <span className="us-kb-fn">{c.binding.label}</span> : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="us-kb-combos">
            {kb.combos.map((cb) => (
              <span className="us-kb-combo" key={cb.keys}><b>{cb.keys}</b>{cb.label}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function SpaceApp() {
  const { values, setValue } = useNCTParameters(PARAM_DEFS);
  const [space, setSpace] = useState(() => createSpaceState("ring"));
  const [currentId, setCurrentId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [cardId, setCardId] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [zoomMul, setZoomMul] = useState(1);
  // The field size (§15): an INDEX into FIELD_SIZES — the focal
  // zoom is a ladder of named fields, not a dial. It is a lens
  // setting: named views and the projection switch keep it.
  const [fieldIndex, setFieldIndex] = useState(FIELD_DEFAULT_INDEX);
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
  const [inspectRot, setInspectRot] = useState({ yaw: 0, pitch: 0, roll: 0, scale: 1, spin: 0 });
  const [pastes, setPastes] = useState([]);
  // Slice 4: the named view, the drag axis lock, dynamic input.
  const [viewName, setViewName] = useState("home");
  const [axisLock, setAxisLock] = useState(null);
  // Slice 5: the data knot's part focus (F into a hovered part)
  // and the part under the cursor while the knot is current.
  const [partFocus, setPartFocus] = useState(() => createPartFocus());
  const [partHoverId, setPartHoverId] = useState(null);
  // Slice 7: the data tree's depth-1 branch under the cursor while
  // the tree is current — the branch analogue of partHoverId, and
  // branch focus reuses the partFocus state above ({objectId:
  // "tree", partId: the depth-1 node's id}).
  const [branchHoverId, setBranchHoverId] = useState(null);
  // Slice 12 — sub-nodes (tray, tangle, mesa, drum): the hovered
  // sub-node of the current citizen, and each sunburst's descent
  // (one pure descent value per sunburst; a descent in one never
  // disturbs the other, and neither touches a transform).
  const [subHover, setSubHover] = useState(null); // { objectId, nodeId } | null
  const [descents, setDescents] = useState(() => ({ mesa: createDescent(), drum: createDescent() }));
  // Slice 13-2 — the cylinder book's own state: its tier ACCESS
  // (a path of tier ids, descent's pattern, its own citizen's —
  // it waits untouched while other citizens are current) and,
  // for the two-page presentation, the current SPREAD index.
  // The presentation itself is a parameter (bookStyle, below).
  const [bookAccess, setBookAccess] = useState(() => createBookAccess());
  const [bookSpread, setBookSpread] = useState(0);
  // Slice 13: the tangled tree's active course, from PARAMETERS.
  // A figure of one course is not an address in the other, so a
  // tangle hover or focus does not survive the switch.
  const tangleDataset = String(values.tangleData || "genealogy");
  // Slice 13-2: the book's presentation, from PARAMETERS (the U
  // key writes the same parameter while the book is current).
  const bookStyle = String(values.bookStyle || "cylinder");
  const prevTangleDataset = useRef(tangleDataset);
  useEffect(() => {
    if (prevTangleDataset.current === tangleDataset) return;
    prevTangleDataset.current = tangleDataset;
    setSubHover((h) => (h && h.objectId === "tangle" ? null : h));
    setPartFocus((f) => (f.objectId === "tangle" ? createPartFocus() : f));
  }, [tangleDataset]);
  // Slice 8: the open app (pure state in space-state.js), the
  // audio app's own state — track, window, transport, and its nav
  // history, which D walks back — and the app's addressing: the
  // ring token under the cursor, the app's Tab focus (the stage
  // or a token), and the waveform zone under the cursor.
  const [openAppState, setOpenAppState] = useState(() => createOpenApp());
  const [audio, setAudio] = useState(() => ({
    trackId: "pulse",
    window: { start: 0, end: 18 },
    playing: false,
    loop: false,
    nav: [],
  }));
  const [tokenHoverId, setTokenHoverId] = useState(null);
  const [appFocusId, setAppFocusId] = useState("stage");
  const [regionHover, setRegionHover] = useState(null);
  // Slice 15 — the opened MESSAGE: a letter taken from the post
  // shelf and stood on the centre stage to be read. A dedicated
  // state at the appClose tier of the release stack (docClose),
  // not the app state — the app scope's keys are the waveform's
  // own, and a letter has no transport to run.
  const [openMessage, setOpenMessage] = useState(null); // message node id | null
  // Slice 15 — the WEB app's own state: the reading position
  // (the section at the sheet's reading line) and its nav
  // history, which the back events walk like the waveform's;
  // and the sheet's hovers — a section band, a link span —
  // reported by the view while the app holds the stage.
  const [web, setWeb] = useState(() => ({ section: 0, nav: [] }));
  const [webSectionHover, setWebSectionHover] = useState(null);
  const [webLinkHover, setWebLinkHover] = useState(null);
  const camSnapshot = useRef(null);
  const [dynText, setDynText] = useState("");
  const dynTimer = useRef(null);
  // The overlay shell: parameters and the guide are stationary
  // panels over the scene, each collapsible on its own head.
  const [paramsOpen, setParamsOpen] = useState(true);
  // Slice 11 (§9): the guide starts COLLAPSED at every width —
  // it stands as its button until the user opens it.
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState("brief");
  // Slice 11: zoom-at-cursor ({ id } of the citizen the camera is
  // dollied toward, or null), the ring's manual spin offset
  // (degrees), the platter's accumulated camera-space orientation
  // (§12: a quaternion as a plain [x, y, z, w] array, identity at
  // start — §7's platterYaw/platterTilt states were dropped for
  // it), the annulus hover the view reports, and the keyboard
  // panel's collapsed state (§10 — independent of the panel's
  // visibility, starts expanded).
  const [zoomFocus, setZoomFocus] = useState(null);
  const [ringSpin, setRingSpin] = useState(0);
  const [platterQuat, setPlatterQuat] = useState(() => [...IDENTITY_QUAT]);
  const [ringHover, setRingHover] = useState(false);
  const [keyboardCollapsed, setKeyboardCollapsed] = useState(false);
  // Slice 10: the keyboard panel's record of physical key
  // activity — the last keydown's code and when it landed. The
  // panel resolves its active cap and its head echo from this;
  // the record is all the panel ever gets from the handler.
  const [lastKey, setLastKey] = useState(null);

  // The layers, as the PARAMETERS panel holds them.
  const layers = layersFromValues(values);
  const showDyn = (text) => {
    setDynText(text);
    if (dynTimer.current) clearTimeout(dynTimer.current);
    dynTimer.current = setTimeout(() => setDynText(""), 1000);
  };

  const sharedRef = useRef({ lastTouch: 0, drag: null, groundLocal: { x: 0, z: 0 }, audioPos: 0 });
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
    objectById(id)?.name || ringItemById(id)?.name || TOKEN_NAMES[id] || WEB_TOKEN_NAMES[id] || mediaById(id)?.title ||
    (id === "clipboard" ? "Clipboard" : "");

  // A knot part is hovered only while the knot is current — the
  // parts are sub-addresses of the current knot, not free-standing
  // things. The view reports every part crossing; the gate is here.
  const onPartHover = (partId) => {
    setPartHoverId(currentId === "knot" ? partId : null);
  };

  // A tree branch is hovered only while the tree is current — the
  // branches are sub-addresses of the current tree, like the knot's
  // parts are of the knot. The view reports every branch crossing.
  const onBranchHover = (branchId) => {
    setBranchHoverId(currentId === "tree" ? branchId : null);
  };

  // A sub-node (slice 12) is hovered only while its citizen is
  // current — the tray's cuboids, the tangle's figures and the
  // sunbursts' wedges are sub-addresses of their citizen, like
  // the knot's parts. The view reports every crossing; the gate
  // is here. A clear answers only for its own citizen.
  const onSubHover = (objectId, nodeId) => {
    if (nodeId) setSubHover(currentId === objectId ? { objectId, nodeId } : null);
    else setSubHover((h) => (h && h.objectId === objectId ? null : h));
  };

  // Part/branch focus belongs to its object being current: if the
  // current thing changes away from the focused object, the focus
  // ends. The back events treat both at ONE level (see
  // dispatchBack): sub-address focus → patch → card → selection.
  // A selection change also clears the zoom-at-cursor focus
  // (slice 11, §4: it is one of its stated clearing events).
  useEffect(() => {
    if (currentId !== "knot") setPartHoverId(null);
    if (currentId !== "tree") setBranchHoverId(null);
    setSubHover((h) => (h && h.objectId !== currentId ? null : h));
    setPartFocus((f) => (f.partId && f.objectId !== currentId ? endPartFocus() : f));
    setZoomFocus(null);
  }, [currentId]);

  /* ----- slice 8: opening apps, and the audio app's own keys ----- */

  const openAudioApp = (mode) => {
    // The camera seat the app takes is given back on close: the
    // named view is snapshotted (the seats are computed from
    // state, so restoring the state restores the seat — the
    // inspection precedent, one level up).
    camSnapshot.current = { viewName };
    setOpenAppState((s) => openAppTo(s, "audio", mode));
    setCurrentId("audio");
    setCardId(null);
    setPendingId(null);
    setPartFocus(endPartFocus());
    setPartHoverId(null);
    setBranchHoverId(null);
    setSubHover(null);
    setAppFocusId("stage");
    setTokenHoverId(null);
    setRegionHover(null);
    if (lockRef.current) lockCancel();
    sharedRef.current.audioPos = audio.window.start;
    touch();
  };

  const closeAudioApp = () => {
    // The appClose LEVEL of the back chain (slice 11: reached by
    // whichever event's pop lands on it — no longer Esc's private
    // big back). Play pauses, the citizens return (in full mode
    // they were hidden), the camera seat is restored, and the
    // space is exactly as it was, with the ring's app item
    // current, where the whole excursion began.
    setOpenAppState((s) => closeAppTo(s));
    setAudio((a) => ({ ...a, playing: false }));
    setTokenHoverId(null);
    setRegionHover(null);
    setAppFocusId("stage");
    if (camSnapshot.current) {
      setViewName(camSnapshot.current.viewName);
      camSnapshot.current = null;
    }
    setCardId(null);
    setCurrentId("audio");
    touch();
  };

  /* ----- slice 15: the web app, and the opened message ----- */

  const openWebApp = (mode) => {
    // The same opening discipline as the waveform's: the camera
    // seat is snapshotted and given back on close, the space's
    // other states clear, and the ring's web item is current.
    camSnapshot.current = { viewName };
    setOpenAppState((s) => openAppTo(s, "web", mode));
    setCurrentId("web");
    setCardId(null);
    setPendingId(null);
    setPartFocus(endPartFocus());
    setPartHoverId(null);
    setBranchHoverId(null);
    setSubHover(null);
    setAppFocusId("stage");
    setTokenHoverId(null);
    setWebSectionHover(null);
    setWebLinkHover(null);
    if (lockRef.current) lockCancel();
    touch();
  };

  const closeWebApp = () => {
    // The appClose level, for the web app: the camera seat is
    // restored and the space is exactly as it was, with the
    // ring's web item current. The reading position and its
    // history persist — the page stays where you left it, as
    // the waveform's window does.
    setOpenAppState((s) => closeAppTo(s));
    setTokenHoverId(null);
    setWebSectionHover(null);
    setWebLinkHover(null);
    setAppFocusId("stage");
    if (camSnapshot.current) {
      setViewName(camSnapshot.current.viewName);
      camSnapshot.current = null;
    }
    setCardId(null);
    setCurrentId("web");
    touch();
  };

  /** The appClose level's closer, whichever app holds the stage. */
  const closeOpenApp = () => {
    if (openAppState.appId === "web") closeWebApp();
    else closeAudioApp();
  };

  /** Move the web reading position, pushing where it was (the nav discipline). */
  const goToWebSection = (index, { push = true } = {}) => {
    const n = WEB_LAYOUT.sections.length;
    const next = Math.max(0, Math.min(n - 1, index));
    setWeb((w) => (next === w.section
      ? w
      : { section: next, nav: push ? pushWebNav(w.nav, w.section) : w.nav }));
    touch();
    return next;
  };

  // Pop up to `count` of the web nav levels as ONE batch (a
  // GO_BACK_II dispatch may owe two), the waveform precedent.
  const popWebNavLevels = (count) => {
    let nav = web.nav;
    let last = null;
    let popped = 0;
    while (popped < count) {
      const r = popWebNav(nav);
      if (!r.entry) break;
      nav = r.stack;
      last = r.entry;
      popped += 1;
    }
    if (last) {
      setWeb((w) => ({ ...w, nav, section: last.section }));
      touch();
    }
    return popped;
  };

  const activateWebToken = (id) => {
    touch();
    if (id === "tok-w-top") {
      if (web.section === 0) {
        setEcho({ text: "already at the top of the page", error: false });
        return;
      }
      goToWebSection(0);
      showDyn("SECTION 1 — TOP");
      return;
    }
    if (id === "tok-w-prev" || id === "tok-w-next") {
      const next = goToWebSection(web.section + (id === "tok-w-next" ? 1 : -1));
      const s = WEB_LAYOUT.sections[next];
      showDyn(`SECTION ${next + 1} / ${WEB_LAYOUT.sections.length}${s ? ` — ${s.heading}` : ""}`);
    }
  };

  /**
   * F on a link of the captured page: an internal anchor moves
   * the reading position to its section; anything else is a
   * page the proof did not capture, and the echo says so —
   * one page only, honestly.
   */
  const followWebLink = (link) => {
    const res = resolveWebLink(link, WEBFRAME);
    if (res.type === "section") {
      const next = goToWebSection(res.index);
      const s = WEB_LAYOUT.sections[next];
      showDyn(`SECTION ${next + 1} — ${s ? s.heading : ""}`);
    } else {
      setEcho({
        text: `not captured — one page only in this proof: ${link.text} → ${res.href}`,
        error: true,
      });
    }
    touch();
  };

  const openMessageSheet = (messageNodeId) => {
    // A letter opens on the centre stage: the space's other
    // states clear the way they do for an app opening, the mail
    // citizen stays current (the letter is its sub-node), and
    // the docClose level of the chain is now occupied.
    const node = messageById(messageNodeId);
    setOpenMessage(messageNodeId);
    setCardId(null);
    setPendingId(null);
    setPartFocus(endPartFocus());
    setPartHoverId(null);
    setBranchHoverId(null);
    if (lockRef.current) lockCancel();
    showDyn(`READING — ${node ? node.subject : "letter"}`);
    touch();
  };

  const closeMessageSheet = () => {
    setOpenMessage(null);
    touch();
  };

  const activateToken = (id) => {
    touch();
    if (id === "tok-play") {
      setAudio((a) => ({ ...a, playing: !a.playing }));
      return;
    }
    if (id === "tok-loop") {
      setAudio((a) => ({ ...a, loop: !a.loop }));
      return;
    }
    if (id === "tok-zoom") {
      const t = makeTrack(audio.trackId);
      const nw = windowZoom(audio.window, 0.5, 0.5, t.seconds);
      setAudio((a) => ({
        ...a,
        nav: pushNav(a.nav, { trackId: a.trackId, window: a.window }),
        window: nw,
      }));
      sharedRef.current.audioPos = nw.start;
      return;
    }
    const tid = TOKEN_TRACKS[id];
    if (tid) {
      if (tid === audio.trackId) {
        setEcho({ text: `${makeTrack(tid).name} is already on the stage`, error: false });
        return;
      }
      const t = makeTrack(tid);
      setAudio((a) => ({
        ...a,
        nav: pushNav(a.nav, { trackId: a.trackId, window: a.window }),
        trackId: tid,
        window: fullWindow(t),
      }));
      sharedRef.current.audioPos = 0;
    }
  };

  const drillRegion = (zone) => {
    const t = makeTrack(audio.trackId);
    const nw = windowDrill(
      audio.window, zone / REGION_ZONES, (zone + 1) / REGION_ZONES, t.seconds,
    );
    setAudio((a) => ({
      ...a,
      nav: pushNav(a.nav, { trackId: a.trackId, window: a.window }),
      window: nw,
    }));
    sharedRef.current.audioPos = nw.start;
    touch();
  };

  // Pop up to `count` of the app's nav levels as ONE batch (a
  // GO_BACK_II dispatch may owe two): the pops walk the local
  // stack, then a single setAudio lands the result. Returns how
  // many levels actually popped.
  const popAudioNavLevels = (count) => {
    let nav = audio.nav;
    let last = null;
    let popped = 0;
    while (popped < count) {
      const r = popNav(nav);
      if (!r.entry) break;
      nav = r.stack;
      last = r.entry;
      popped += 1;
    }
    if (last) {
      setAudio((a) => ({ ...a, nav, trackId: last.trackId, window: last.window }));
      sharedRef.current.audioPos = last.window.start;
      touch();
    }
    return popped;
  };

  const onTokenHover = (id) => {
    setTokenHoverId(id);
    if (id) setAppFocusId(id);
  };

  const completePatch = (from, to, eventName = null) => {
    // When FINISH (slice 11) drives the completion, its echoes
    // name the event — the messaging made visible.
    const suffix = eventName ? ` — ${eventName}` : "";
    // The ring's apps open; they do not take cables.
    if (ringItemById(from) || ringItemById(to)) {
      setPendingId(null);
      setEcho({ text: `the ring's apps open — they don't take cables${suffix}`, error: true });
      return;
    }
    // A patch completed to or from the clipboard tray is a PASTE,
    // not a cable: the held card attaches onto the other thing's
    // plot, and the clipboard keeps its content (copy, not cut).
    if (from === "clipboard" || to === "clipboard") {
      const target = from === "clipboard" ? to : from;
      setPendingId(null);
      if (!clip.held) {
        setEcho({ text: `clipboard is empty — H copies something first${suffix}`, error: true });
        return;
      }
      setPastes((prev) => [...prev.filter((p) => p.targetId !== target), { targetId: target, item: clip.held }]);
      setEcho({ text: `CLIPBOARD → ${thingName(target)}: ${clip.held.title}${suffix}`, error: false });
      setCurrentId(target);
      return;
    }
    const res = addCable(space, from, to);
    if (res.ok) {
      setSpace(res.state);
      if (eventName) {
        setEcho({ text: `patched ${thingName(from)} ↔ ${thingName(to)}${suffix}`, error: false });
      }
    } else if (eventName) {
      setEcho({ text: `patch refused — ${res.reason}${suffix}`, error: true });
    }
    setPendingId(null);
    setCurrentId(to);
  };

  const onObjectClick = (id) => {
    if (!isAddressable(layers, id)) return; // locked/hidden strata don't take clicks
    // While an app holds the stage, citizen clicks wait — the
    // stage, its tokens and its keys own the interaction. An
    // opened message holds it the same way.
    if (openAppState.appId) return;
    if (openMessage) return;
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

  // A click on a letter of the post shelf: the shelf's letters
  // are the mail citizen's sub-addresses, so a first click takes
  // the citizen (as a citizen click does) and a click while it
  // is current opens the letter, as F does.
  const onMessageActivate = (nodeId) => {
    touch();
    if (openAppState.appId || openMessage) return;
    if (inspection.inspectedId) return;
    if (currentId === "mail") openMessageSheet(nodeId);
    else setCurrentId("mail");
  };

  const doF = () => {
    // Slice 8 first: an app-bearing thing (the ring's Waveform)
    // OPENS instead of entering — F takes it to the centre stage.
    // A live patch keeps its F: the patch completes onto the
    // addressed target, as it always has.
    if (!pendingId) {
      const open = resolveOpenAction({
        targetId: addressedId(hoverId, currentId), key: "f", labelMode: uiMode.labelMode,
      });
      if (open) {
        if (open.appId === "web") openWebApp(open.mode);
        else openAudioApp(open.mode);
        return;
      }
    }
    // F lands on the ADDRESSED thing: hover wins, current is the
    // fallback. The decision itself is pure (resolveFAction in
    // space-state.js) and every branch below works from the local
    // action — never from a state value it just asked React to set.
    // Slice 12: the hovered sub-node of the addressed citizen,
    // resolved against the provider with shares read against the
    // citizen's standing display root (a sunburst under descent
    // seats and descends within its descended hierarchy).
    const addressed = addressedId(hoverId, currentId);
    const subNode =
      subHover && subHover.objectId === addressed && isSubnodeObject(addressed)
        ? subnodeById(addressed, subHover.nodeId, displayRootOf(descents[addressed], addressed), tangleDataset)
        : null;
    const action = resolveFAction({
      pendingId,
      hoverId,
      currentId,
      partId: partHoverId && partById(partHoverId) ? partHoverId : null,
      branchId: branchHoverId && dataBranchById(DATA_TREE, branchHoverId) ? branchHoverId : null,
      subId: subNode ? subNode.id : null,
      subLeaf: subNode ? subNode.isLeaf : false,
      subTier: subNode ? subNode.depth : 0,
      bookStyle,
      inspectIds: [...MEDIA_IDS, "clipboard"],
    });
    switch (action.type) {
      case "completePatch":
        completePatch(pendingId, action.targetId);
        return;
      case "partFocus":
        // F on a hovered part of the knot zooms INTO the part —
        // the part focus, one level deeper than entering the knot.
        // Slice 12: the tray's, tangle's and sunbursts' sub-nodes
        // take the same seat through the same case.
        setCurrentId(action.targetId);
        setPartFocus(beginPartFocus(partFocus, action.targetId, action.partId));
        setCardId(null);
        return;
      case "descend": {
        // F on a sunburst BRANCH wedge descends: the wedge's node
        // becomes the citizen's display root and the miniature
        // rebuilds from it. A display change only — the citizen's
        // transform (rotation, plane spin, MAGNIFY) is untouched,
        // and the backs climb out level by level.
        const node = subnodeById(action.targetId, action.nodeId);
        setCurrentId(action.targetId);
        setDescents((d) => ({ ...d, [action.targetId]: descend(d[action.targetId], action.targetId, action.nodeId) }));
        setPartFocus(endPartFocus());
        setCardId(null);
        setSubHover(null);
        showDyn(`DESCENDED — ${node ? node.path.join(" › ") : action.nodeId}`);
        return;
      }
      case "bookAccess": {
        // Slice 13-2: F on a chapter or section band ACCESSES the
        // tier — the access path becomes the tier's own chain,
        // the drum turns to face it (the view eases the turn),
        // and the tiers outside it ghost. A display state only:
        // the book's transform is untouched, and the backs climb
        // the access one tier per level.
        const node = subnodeById("book", action.nodeId);
        setCurrentId("book");
        setBookAccess(bookAccessTo(bookAccess, action.nodeId));
        setPartFocus(endPartFocus());
        setCardId(null);
        setSubHover(null);
        showDyn(`ACCESSED — ${node ? node.path.join(" › ") : action.nodeId}`);
        return;
      }
      case "bookPage": {
        // F on a page in the cylinder presentation: the page
        // comes OUT of the drum — the access path extended to the
        // page — and its card shows the page's full text. The
        // backs slide it home again, one tier at a time.
        const node = subnodeById("book", action.nodeId);
        setCurrentId("book");
        setBookAccess(bookAccessTo(bookAccess, action.nodeId));
        setPartFocus(endPartFocus());
        setCardId(null);
        setSubHover(null);
        showDyn(`PAGE OUT — ${node ? node.name : action.nodeId}`);
        return;
      }
      case "bookSpreadTo": {
        // F on a standing leaf in the spread presentation turns
        // the book to that page's spread — navigation within the
        // presentation, not a level of the release stack.
        const at = spreadIndexForPage(action.nodeId);
        const node = subnodeById("book", action.nodeId);
        setCurrentId("book");
        if (at >= 0) setBookSpread(at);
        setSubHover(null);
        showDyn(`SPREAD ${at + 1} / ${SPREAD_COUNT} — ${node ? node.name : action.nodeId}`);
        return;
      }
      case "openMessage": {
        // Slice 15: F on a letter of the post shelf opens it —
        // the message stands on the centre stage to be read,
        // and the backs close it at the docClose tier.
        setCurrentId("mail");
        openMessageSheet(action.messageId);
        return;
      }
      case "branchFocus":
        // F on a hovered depth-1 branch of the tree zooms INTO
        // the subtree — the same focus state and the same level
        // of the release chain as the knot's part focus.
        setCurrentId(action.targetId);
        setPartFocus(beginPartFocus(partFocus, action.targetId, action.partId));
        setCardId(null);
        return;
      case "inspect":
        // Cards and the tray are small: for them, F-enter IS inspect.
        beginInspectThing(action.targetId);
        return;
      case "open":
        setCurrentId(action.targetId);
        setCardId(action.targetId);
        return;
      default:
        return;
    }
  };
  /* ----- slice 11: the event layer, dispatched ----- */

  // The release stack's occupancy, as data for the resolver.
  // Slice 12: descent levels count only while the descended
  // citizen is current — a descent is that citizen's display
  // state, in scope only while you are on it (its path waits,
  // untouched, while you are elsewhere).
  const backChain = () => ({
    dragLocked: Boolean(lockRef.current),
    inspection: Boolean(inspection.inspectedId),
    // Slice 15: the nav levels are whichever open app's history
    // is live — the waveform's window stack, or the web's
    // reading-position stack.
    appNav: openAppState.appId === "audio" ? audio.nav.length
      : openAppState.appId === "web" ? web.nav.length : 0,
    appOpen: Boolean(openAppState.appId),
    // Slice 15: an opened message occupies the docClose level,
    // at the appClose tier, immediately after it.
    docOpen: Boolean(openMessage),
    partFocus: Boolean(partFocus.partId),
    descent:
      currentId && descents[currentId] ? descentDepth(descents[currentId]) : 0,
    // Slice 13-2: the book's accessed tiers count at the same
    // tier of the chain, immediately after descent — and, like
    // a descent, only while their citizen is current.
    bookAccess: currentId === "book" ? bookAccessDepth(bookAccess) : 0,
    pending: Boolean(pendingId),
    card: Boolean(cardId),
    selection: Boolean(currentId),
  });

  const BACK_LEVEL_ECHO = {
    drag: "drag cancelled",
    inspection: "inspection ended",
    appClose: "app closed",
    docClose: "message closed",
    partFocus: "focus released",
    patch: "patch released",
    card: "card closed",
    selection: "selection released",
  };

  /**
   * One dispatch for every back event: resolveBackLevels decides
   * which levels the event pops, and each is applied by the
   * closer that already existed for it. CANCEL (Esc/S) carries
   * two pre-steps the chain does not model, in the handlers' old
   * order: a drag's axis lock releases first (the drag itself is
   * the chain's first level), then label mode exits — but only
   * when no drag is live (a locked drag pops as a level first)
   * and no app or inspection holds the scope. The command line's
   * walk-back precedes all of this: its machine consumes Esc
   * while armed, so an armed line never reaches here. Every
   * dispatch clears the zoom-at-cursor focus (§4) and names the
   * EVENT in the echo.
   */
  const dispatchBack = (event) => {
    setZoomFocus(null);
    if (event === EVENTS.CANCEL || event === EVENTS.GO_BACK_I) {
      if (lockRef.current && sharedRef.current.axisLock) {
        clearAxisLock();
        setEcho({ text: `axis lock released — ${event}`, error: false });
        return;
      }
      if (!lockRef.current && !openAppState.appId && !openMessage && !inspection.inspectedId && uiMode.labelMode) {
        setUiMode((m) => exitLabelMode(m));
        setEcho({ text: `label mode off — ${event}`, error: false });
        return;
      }
    }
    const levels = resolveBackLevels(backChain(), event);
    if (!levels.length) {
      setEcho({ text: `nothing to release — ${event}`, error: true });
      return;
    }
    const navPops = levels.filter((l) => l === "appNav").length;
    if (navPops) {
      if (openAppState.appId === "web") popWebNavLevels(navPops);
      else popAudioNavLevels(navPops);
    }
    const said = [];
    if (navPops) said.push(navPops > 1 ? `app steps back ×${navPops}` : "app step back");
    // Descent climbs are threaded through a local: one dispatch
    // may climb two levels, and each climb reads the descent the
    // previous climb produced — not the render's snapshot.
    let nextDescent = currentId ? descents[currentId] : null;
    let climbed = 0;
    // The book's access climbs the same way, through its own local.
    let nextBookAccess = currentId === "book" ? bookAccess : null;
    let bookClimbed = 0;
    for (const level of levels) {
      switch (level) {
        case "appNav": break; // applied as one batch above
        case "drag": lockCancel(); said.push(BACK_LEVEL_ECHO.drag); break;
        case "inspection": endInspectThing(); said.push(BACK_LEVEL_ECHO.inspection); break;
        case "appClose": closeOpenApp(); said.push(BACK_LEVEL_ECHO.appClose); break;
        case "docClose": closeMessageSheet(); said.push(BACK_LEVEL_ECHO.docClose); break;
        case "partFocus": setPartFocus(endPartFocus()); said.push(BACK_LEVEL_ECHO.partFocus); break;
        case "descent":
          if (nextDescent) { nextDescent = climbDescent(nextDescent); climbed++; }
          break;
        case "bookAccess":
          if (nextBookAccess) { nextBookAccess = climbBookAccess(nextBookAccess); bookClimbed++; }
          break;
        case "patch": setPendingId(null); said.push(BACK_LEVEL_ECHO.patch); break;
        case "card": setCardId(null); said.push(BACK_LEVEL_ECHO.card); break;
        case "selection": setCurrentId(null); said.push(BACK_LEVEL_ECHO.selection); break;
        default: break;
      }
    }
    if (climbed && currentId) {
      setDescents((d) => ({ ...d, [currentId]: nextDescent }));
      const rootId = displayRootOf(nextDescent, currentId);
      const rootNode = rootId ? subnodeById(currentId, rootId) : null;
      said.push(
        rootNode
          ? `climbed out to ${rootNode.path.join(" › ")}`
          : `climbed out to ${subnodeRootOf(currentId)?.name || "the root"}`,
      );
    }
    if (bookClimbed && currentId === "book") {
      setBookAccess(nextBookAccess);
      const atId = bookAccessedId(nextBookAccess);
      const atNode = atId ? subnodeById("book", atId) : null;
      said.push(
        atNode
          ? `climbed out to ${atNode.path.join(" › ")}`
          : `climbed out to ${subnodeRootOf("book")?.name || "the whole book"}`,
      );
    }
    setEcho({ text: `${said.join(" · ")} — ${event}`, error: false });
    touch();
  };

  /**
   * FINISH (A): complete the operation in flight, scoped — a
   * live patch lands on the addressed target (no target: the
   * patch stays live and the echo says so); a live drag lock
   * drops at the current point (Space's own drop path). FINISH
   * never closes apps, ends inspections or releases selections.
   * The armed command line never reaches here: while it is
   * armed, A is a letter of its arguments (object names contain
   * "a"), so the line's finish stays Enter — see the guide.
   */
  const doFinish = () => {
    if (pendingId) {
      const target = addressedId(hoverId, currentId);
      if (!target || target === pendingId) {
        setEcho({ text: "FINISH — nothing to finish onto", error: true });
        return;
      }
      completePatch(pendingId, target, EVENTS.FINISH);
      return;
    }
    if (lockRef.current) {
      const id = lockRef.current.id;
      lockDrop();
      setEcho({ text: `dropped ${thingName(id)} — ${EVENTS.FINISH}`, error: false });
      return;
    }
    setEcho({ text: "FINISH — nothing in flight", error: true });
  };

  // Is the RING the rotate keys' addressee? Its item hovered or
  // current, a token hovered (app open), or the cursor over the
  // annulus itself (the view reports that on its own channel).
  const ringAddressedNow = () =>
    hoverId === "audio" || currentId === "audio" || hoverId === "web" || currentId === "web"
    || ringHover || Boolean(tokenHoverId);

  /**
   * C/V: the DOLLY (§14 — the camera itself moves; the focal
   * zoom is 5/6). The dolly's target is resolved purely
   * (resolveDollyTarget): a hovered citizen wins (§4's
   * dolly-at-cursor, unchanged); otherwise the OPENED citizen —
   * the one F flew to, its card standing open — so C/V travel
   * into the opened thing after the pointer has left it, where
   * MAGNIFY (Z/X) only grows the thing in place; otherwise the
   * plain global dolly, and any stale zoom focus goes. A target
   * sets the zoomFocus (cleared when the step lands back on
   * 1.0, and by the standing rules — selection change, back
   * events, layout change), and the Rig seats the camera on
   * that citizen's seat scaled by the dolly: the one seat math
   * for the hovered and the opened citizen alike.
   */
  const pressZoom = (dir) => {
    const target = resolveDollyTarget({ hoverId, currentId, cardId });
    const next = zoomStep(zoomMul, dir);
    setZoomMul(next);
    setZoomFocus(target && next !== 1 ? { id: target } : null);
    touch();
  };

  /**
   * 5/6: the focal ZOOM (§15) — one rung along the field-size
   * ladder. The camera does not move; the lens changes. The
   * step names the new field through the dynamic-input channel,
   * and at the ladder's end it says so.
   */
  const pressField = (dir) => {
    const next = fieldStep(fieldIndex, dir);
    setFieldIndex(next);
    showDyn(`FIELD · ${FIELD_SIZES[next].name}${next === fieldIndex ? " — end of the ladder" : ""}`);
    touch();
  };

  /**
   * One rotate/magnify key press (the Q/W/E/R/T/Y cluster, B/N
   * plane-rotate, Z/X magnify), resolved by target. Magnify
   * keeps the addressed citizen (hover wins) and is DECLINED on
   * the platter (§12). Rotate resolves through resolveRotateTarget:
   * citizen (its transform, bounds-centre pivot in the view),
   * ring (yaw and plane spin the ring's one offset; pitch/roll
   * do not apply), platter (the cluster premultiplies the
   * platter's orientation about the CAMERA's axes; plane steps
   * the rotation parameter, innermost in the composition).
   */
  const handleTransformKey = (tk) => {
    const op = transformOpOf(tk);
    if (!op) return;
    // Slice 13-2: in the book's SPREAD presentation, B and N FLIP
    // the spread instead of plane-spinning the book — resolved
    // here, where B/N are dispatched, so cylinder mode keeps the
    // free plane spin and every other citizen is untouched. (The
    // inspection branch turns its specimen before this is ever
    // reached, so an inspected book still turns in the hand.)
    if ((op === "spin-" || op === "spin+") && currentId === "book" && bookStyle === "spread") {
      const next = stepSpread(bookSpread, op === "spin+" ? 1 : -1, SPREAD_COUNT);
      setBookSpread(next);
      showDyn(`SPREAD ${next + 1} / ${SPREAD_COUNT}`);
      touch();
      return;
    }
    if (op === "scale-" || op === "scale+") {
      const st = resolveScaleTarget({
        hoverId, currentId, ringAddressed: ringAddressedNow(),
      });
      if (st.kind === "citizen") {
        const ns = applyTransformKey(space, st.id, tk);
        setSpace(ns);
        const t = ns.transforms[st.id];
        if (t) showDyn(`MAGNIFY ${thingName(st.id)} ${t.scale.toFixed(2)}×`);
      } else if (st.kind === "platter") {
        // §12+§16: the main platter cannot be magnified.
        setEcho({ text: "the main platter cannot be magnified — C/V dolly the camera", error: true });
      }
      return;
    }
    const target = resolveRotateTarget({
      hoverId, currentId, ringAddressed: ringAddressedNow(),
    });
    const sgn = (v) => (v > 0 ? `+${v}` : `${v}`);
    if (target.kind === "citizen") {
      const ns = applyTransformKey(space, target.id, tk);
      setSpace(ns);
      const t = ns.transforms[target.id];
      if (t) {
        const nm = thingName(target.id);
        if (op.startsWith("yaw")) showDyn(`YAW ${nm} ${sgn(Math.round(t.yaw))}°`);
        else if (op.startsWith("pitch")) showDyn(`PITCH ${nm} ${sgn(Math.round(t.pitch))}°`);
        else if (op.startsWith("roll")) showDyn(`ROLL ${nm} ${sgn(Math.round(t.roll))}°`);
        else if (op.startsWith("spin")) showDyn(`PLANE ${nm} ${sgn(Math.round(t.spin || 0))}°`);
      }
      return;
    }
    if (target.kind === "ring") {
      if (op.startsWith("yaw") || op.startsWith("spin")) {
        const next = stepRingSpin(ringSpin, op);
        setRingSpin(next);
        showDyn(`RING SPIN ${sgn(next)}°`);
      } else {
        setEcho({ text: "the ring spins — pitch and roll do not apply", error: true });
      }
      return;
    }
    // The platter fallback (§12): the cluster turns the world
    // AS THE CAMERA SEES IT — each step premultiplies the
    // platter's orientation about the camera's own axes, which
    // the Rig publishes on the shared ref (the channel the drag
    // point and the playhead already travel). Before the first
    // frame the world axes stand in. B/N is unchanged: it steps
    // the rotation parameter, innermost in the composition, so
    // the disc still spins in its own plane inside these turns.
    if (op.startsWith("spin")) {
      const next = stepPlatterSpin(values.rotation, op);
      setValue("rotation", next);
      showDyn(`PLATTER PLANE ${sgn(next)}°`);
      return;
    }
    const axes = sharedRef.current.cameraAxes
      || { up: [0, 1, 0], right: [1, 0, 0], forward: [0, 0, 1] };
    setPlatterQuat((q) => stepPlatterQuat(q, axes, op));
    const axisName = op.startsWith("yaw") ? "YAW" : op.startsWith("pitch") ? "PITCH" : "ROLL";
    showDyn(`PLATTER · CAMERA ${axisName} ${op.endsWith("-") ? "−" : "+"}`);
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
    // No patch live: G starts from the ADDRESSED object — hover
    // wins, as it does for F — and the source becomes current.
    const source = addressedId(hoverId, currentId);
    if (source && ringItemById(source)) {
      setEcho({ text: `${thingName(source)} opens — F centre-stage, E full platter; it does not patch`, error: true });
      return;
    }
    if (source) { setCurrentId(source); setPendingId(source); return; }
  };

  /* ----- the drag lock: Space picks up, Space drops, Esc cancels ----- */

  const lockOn = (id) => {
    // The ring's items open — they aren't carried.
    if (ringItemById(id)) {
      setEcho({ text: "the ring's items open — F centre-stage, E full platter", error: true });
      return;
    }
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
      case "roll":
      case "spin": {
        if (!currentId) return { error: "nothing is current — select an object first (o › s)" };
        const axis = intent.type;
        setSpace((s) => applyTransformPatch(s, currentId, {
          [axis]: (s.transforms[currentId]?.[axis] ?? 0) + intent.degrees,
        }));
        return `${objectById(currentId).name} ${axis === "spin" ? "plane" : axis} ${intent.degrees > 0 ? "+" : ""}${intent.degrees}°`;
      }
      case "size": {
        if (!currentId) return { error: "nothing is current — select an object first (o › s)" };
        setSpace((s) => applyTransformPatch(s, currentId, { scale: intent.scale }));
        return `${objectById(currentId).name} magnify → ${intent.scale}× (clamped 0.40–2.50)`;
      }
      case "focus": {
        if (pendingId) return { error: "a patch is live — finish it (A) or cancel out (Esc / S)" };
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
        setZoomFocus(null); // a layout change clears dolly-at-cursor (§4)
        return `layout ${LAYOUTS[intent.layout].name}`;
      case "zoom":
        setZoomMul((m) => zoomStep(m, intent.dir));
        return intent.dir > 0 ? "dolly in" : "dolly out";
      case "view": {
        // Choosing a view cancels any in-flight F camera work
        // (the entered card's seat); HOME also releases, as it
        // always did — goView is the one transition, shared with
        // the VIEW fieldset's buttons. Inspection moves the
        // thing, not the camera, so it is not camera work and is
        // unreachable here anyway (the line is disarmed then).
        const hadTurns = platterQuat.some((v, i) => Math.abs(v - IDENTITY_QUAT[i]) > 1e-9);
        goView(intent.view);
        const reset = hadTurns ? " · platter turns reset" : "";
        if (intent.view === "home") return `view HOME — released${reset}`;
        return `view ${VIEWS[intent.view].name}${reset}`;
      }
      case "help":
        return helpText();
      case "clear":
        return null; // the echo itself is cleared
      default:
        return { error: `unknown intent ${intent.type}` };
    }
  };

  // The named views are pure camera moves. The command line's
  // v › t/f/s/h intents and the VIEW fieldset's buttons in the
  // PARAMETERS panel are two doors to this one transition: the
  // view takes its seat, any entered card closes, and HOME also
  // releases — the selection and a live patch end with it.
  // Slice 11 (§12): loading a named view also RESETS the
  // platter's camera-space turns to identity — a named view is
  // an absolute camera position, and leftover world turns
  // would fight it.
  const goView = (view) => {
    setViewName(view);
    setCardId(null);
    setPlatterQuat([...IDENTITY_QUAT]);
    if (view === "home") {
      setPendingId(null);
      setCurrentId(null);
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

  /* ----- copy (H), inspect (I), the library (M), the tray (Alt+0) ----- */

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
    // Inspection is for citizens, cards and the tray — the ring's
    // items open instead (F/E), so they never reach the snapshot.
    if (!objectById(id) && !isMediaId(id) && id !== "clipboard") return;
    // beginInspect snapshots the home exactly and restores any
    // thing already out (exclusivity) — the view eases it back.
    const { inspection: next } = beginInspect(inspection, id, homeFor(id));
    setInspection(next);
    setInspectRot({ yaw: 0, pitch: 0, roll: 0, scale: 1, spin: 0 });
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
    setInspectRot({ yaw: 0, pitch: 0, roll: 0, scale: 1, spin: 0 });
    touch();
  };

  // While inspecting, the transform keys turn the SPECIMEN — a
  // temporary turn held here, never written into the space state,
  // so ending inspection restores the exact home orientation.
  // Plane-rotate (B/N) flows through here too: the specimen's
  // spin is held in inspectRot.spin and applied by the view in
  // the specimen's own plane (see the Rig).
  const stepInspectRot = (key) => {
    const op = transformOpOf(key);
    if (!op) return;
    const n = { ...inspectRot };
    switch (op) {
      case "yaw-": n.yaw -= ANGLE_STEP; break;
      case "yaw+": n.yaw += ANGLE_STEP; break;
      case "pitch-": n.pitch -= ANGLE_STEP; break;
      case "pitch+": n.pitch += ANGLE_STEP; break;
      case "roll-": n.roll -= ANGLE_STEP; break;
      case "roll+": n.roll += ANGLE_STEP; break;
      case "spin-": n.spin = (inspectRot.spin || 0) - ANGLE_STEP; break;
      case "spin+": n.spin = (inspectRot.spin || 0) + ANGLE_STEP; break;
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
    else if (op.startsWith("spin")) showDyn(`PLANE ${nm} ${sgn(n.spin)}°`);
    else showDyn(`MAGNIFY ${nm} ${n.scale.toFixed(2)}×`);
  };

  useEffect(() => {
    const onKey = (e) => {
      // The keyboard panel's record: every physical keydown, by
      // code, before any branch decides what the key means. The
      // panel highlights from this and nothing else.
      if (e.code) setLastKey({ code: e.code, at: performance.now() });
      // While inspecting, almost everything suspends: the back
      // events send the specimen home through the one dispatch
      // (CANCEL / GO_BACK_I pop the inspection level alone;
      // GO_BACK_II pops it and the level beneath), the transform
      // keys turn it, and the rest of the scheme waits. (Modes
      // were already suspended when inspection began.)
      if (inspection.inspectedId) {
        if (e.key === "Escape") { e.preventDefault(); dispatchBack(EVENTS.CANCEL); return; }
        if (e.key === "s" || e.key === "S") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_I); return; }
        if (e.key === "d" || e.key === "D") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_II); return; }
        if (e.key === "a" || e.key === "A") {
          // FINISH never ends an inspection — and nothing else is
          // in flight while one runs.
          e.preventDefault();
          setEcho({ text: "FINISH — nothing in flight", error: true });
          return;
        }
        const tk = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (TRANSFORM_KEYS[tk]) {
          e.preventDefault();
          touch();
          stepInspectRot(tk);
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
      // K toggles the keyboard panel (KeyPilot's K). It stands
      // here — after the armed line, which owns K as a character
      // of its arguments, and before the app scope, whose keys it
      // joins — and OUTSIDE label mode only: inside label mode K
      // is the definition's address and falls through to letter
      // targeting below, as G and M fall to theirs. The toggle
      // writes the same state the PARAMETERS switch holds.
      if ((e.key === "k" || e.key === "K") && !uiMode.labelMode && !e.repeat) {
        e.preventDefault();
        onParam("keyboardPanel", values.keyboardPanel === false);
        return;
      }
      // Slice 13-2: U toggles the BOOK's presentation — cylinder
      // or spread — while the book is current. It stands with the
      // K toggle: outside label mode only (in label mode U is an
      // address, like every letter), never mid-drag, and it
      // writes the same bookStyle parameter the PARAMETERS
      // select holds, so the two never disagree.
      if ((e.key === "u" || e.key === "U") && !uiMode.labelMode && !e.repeat
        && !lockRef.current && currentId === "book") {
        e.preventDefault();
        const next = bookStyle === "spread" ? "cylinder" : "spread";
        onParam("bookStyle", next);
        showDyn(next === "spread"
          ? `BOOK STYLE — SPREAD ${bookSpread + 1} / ${SPREAD_COUNT}`
          : "BOOK STYLE — CYLINDER");
        return;
      }
      // Enter arms the line (when no patch is live and no drag is
      // locked — those keep their Enter-free key worlds).
      if (e.key === "Enter") {
        e.preventDefault();
        if (!pendingId && !lockRef.current) armCmdLine();
        return;
      }
      // MESSAGE SCOPE (slice 15): while a letter stands open on
      // the centre stage, the reading owns the keys the way an
      // app's scope owns its — the back events close it at the
      // docClose tier through the one dispatch, FINISH speaks,
      // and everything else waits outside the reading.
      if (openMessage) {
        const k = e.key;
        if (k === "Escape") { e.preventDefault(); dispatchBack(EVENTS.CANCEL); return; }
        if (k === "s" || k === "S") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_I); return; }
        if (k === "d" || k === "D") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_II); return; }
        if (k === "a" || k === "A") { e.preventDefault(); doFinish(); return; }
        return;
      }
      // APP SCOPE (slice 8): while an app holds the stage, the
      // keys are the app's. The command line (above) and Alt+L
      // still work — the line stays live and label mode still
      // toggles — but the space's manipulation keys suspend:
      // Space is the transport, not the drag lock; C/V zoom the
      // window inside the app's frame, not the camera; the
      // transform keys do nothing (the app is not a citizen, and
      // its ring furniture must hold still).
      // Slice 11: the back events run through the one dispatch —
      // in app scope CANCEL / GO_BACK_I pop ONE of the app's
      // levels (a nav step, or leaving the app when its nav is
      // empty) and GO_BACK_II up to two. This refines slice 8:
      // Esc here is no longer automatically the big back; D is.
      if (openAppState.appId) {
        const k = e.key;
        // Slice 15: the WEB app's scope — the captured page's
        // own keys. The back events are shared (the one
        // dispatch walks the reading history, then closes);
        // Space and C/V move the reading position within the
        // sheet's own frame — the camera stays, as the
        // waveform's window zoom keeps it; F activates a token,
        // follows a hovered link, or reads a hovered section.
        if (openAppState.appId === "web") {
          if (k === "Escape") { e.preventDefault(); dispatchBack(EVENTS.CANCEL); return; }
          if (k === "s" || k === "S") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_I); return; }
          if (k === "d" || k === "D") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_II); return; }
          if (k === "a" || k === "A") { e.preventDefault(); doFinish(); return; }
          if (k === " ") {
            e.preventDefault();
            if (!e.repeat) {
              if (web.section >= WEB_LAYOUT.sections.length - 1) {
                setEcho({ text: "the end of the captured page", error: false });
              } else {
                const next = goToWebSection(web.section + 1);
                const s = WEB_LAYOUT.sections[next];
                showDyn(`SECTION ${next + 1} / ${WEB_LAYOUT.sections.length}${s ? ` — ${s.heading}` : ""}`);
              }
            }
            return;
          }
          if (k === "Tab") {
            e.preventDefault();
            const ids = ["stage", ...WEB_TOKEN_IDS];
            setAppFocusId(cycleInList(ids, appFocusId, e.shiftKey ? -1 : 1));
            return;
          }
          if (k === "c" || k === "C" || k === "v" || k === "V") {
            e.preventDefault();
            const next = goToWebSection(web.section + (k === "c" || k === "C" ? -1 : 1));
            const s = WEB_LAYOUT.sections[next];
            showDyn(`SECTION ${next + 1} / ${WEB_LAYOUT.sections.length}${s ? ` — ${s.heading}` : ""}`);
            return;
          }
          if (k === "f" || k === "F") {
            e.preventDefault();
            const tok = tokenHoverId || (appFocusId !== "stage" ? appFocusId : null);
            if (tok) activateWebToken(tok);
            else if (webLinkHover) followWebLink(webLinkHover);
            else if (webSectionHover != null) {
              const next = goToWebSection(webSectionHover);
              const s = WEB_LAYOUT.sections[next];
              showDyn(`SECTION ${next + 1} / ${WEB_LAYOUT.sections.length}${s ? ` — ${s.heading}` : ""}`);
            }
            return;
          }
          if (k === "e" || k === "E") {
            e.preventDefault();
            if (openAppState.mode === "center") {
              setOpenAppState((s) => setAppModeTo(s, "full"));
            }
            return;
          }
          return; // everything else waits outside the app
        }
        if (k === "Escape") { e.preventDefault(); dispatchBack(EVENTS.CANCEL); return; }
        if (k === "s" || k === "S") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_I); return; }
        if (k === "d" || k === "D") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_II); return; }
        if (k === "a" || k === "A") { e.preventDefault(); doFinish(); return; }
        if (k === " ") {
          e.preventDefault();
          if (!e.repeat) setAudio((a) => ({ ...a, playing: !a.playing }));
          return;
        }
        if (k === "Tab") {
          e.preventDefault();
          const ids = ["stage", ...APP_TOKEN_IDS];
          setAppFocusId(cycleInList(ids, appFocusId, e.shiftKey ? -1 : 1));
          return;
        }
        if (k === "c" || k === "C" || k === "v" || k === "V") {
          e.preventDefault();
          // Zoom lands under the cursor: over the waveform fence
          // it is the window zoom; over nothing, there is no
          // stage zoom to have — an echo instead.
          if (regionHover == null) {
            setEcho({ text: "nothing under the cursor accepts zoom here — hover the waveform fence", error: true });
            return;
          }
          const t = makeTrack(audio.trackId);
          const w = audio.window;
          const pos = sharedRef.current.audioPos ?? w.start;
          const frac = Math.max(0, Math.min(1, (pos - w.start) / Math.max(0.001, w.end - w.start)));
          const out = k === "c" || k === "C";
          const nw = windowZoom(w, out ? 1.6 : 1 / 1.6, frac, t.seconds);
          setAudio((a) => ({ ...a, window: nw }));
          showDyn(`WINDOW ${nw.start.toFixed(1)}–${nw.end.toFixed(1)}s of ${t.seconds}s`);
          return;
        }
        if (k === "f" || k === "F") {
          e.preventDefault();
          const tok = tokenHoverId || (appFocusId !== "stage" ? appFocusId : null);
          if (tok) activateToken(tok);
          else if (regionHover != null) drillRegion(regionHover);
          return;
        }
        if (k === "e" || k === "E") {
          e.preventDefault();
          if (openAppState.mode === "center") {
            setOpenAppState((s) => setAppModeTo(s, "full"));
          }
          return;
        }
        return; // everything else waits outside the app
      }
      if (e.key === " ") {
        e.preventDefault(); // always: no page scroll, no button press
        if (!e.repeat) toggleDragLock();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // CANCEL, through the one dispatch: its pre-steps (a
        // drag's axis lock releases first, then label mode) and
        // the chain itself (drag → focus → patch → card →
        // selection) keep the old Esc order whole, inside
        // dispatchBack. The command line's Esc never reaches
        // here — its machine consumed it above.
        dispatchBack(EVENTS.CANCEL);
        return;
      }
      // Drag-locked: the transform keys and patching suspend. X
      // and Z are the axis locks (press again to release); Space
      // (drop) and Esc (axis, then cancel) act, and both are
      // above. The event keys still speak: A finishes (the
      // drop), S goes back one (the axis pre-step rides along),
      // D goes back two — the drag, and the level beneath it.
      if (lockRef.current) {
        if (e.key === "x" || e.key === "X") { e.preventDefault(); toggleAxisLock("x"); }
        else if (e.key === "z" || e.key === "Z") { e.preventDefault(); toggleAxisLock("z"); }
        else if ((e.key === "a" || e.key === "A") && !uiMode.labelMode) { e.preventDefault(); doFinish(); }
        else if ((e.key === "s" || e.key === "S") && !uiMode.labelMode) { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_I); }
        else if (e.key === "d" || e.key === "D") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_II); }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        if (!pendingId) {
          // Order: the twelve objects, then the library's cards
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
      // C/V dolly (slice 11, named §14): OUTSIDE label mode
      // only — inside it, C and V are addresses (the tray's, a
      // card's) and fall through to letter targeting below.
      if (!uiMode.labelMode && (e.key === "c" || e.key === "C")) { e.preventDefault(); pressZoom(-1); return; }
      if (!uiMode.labelMode && (e.key === "v" || e.key === "V")) { e.preventDefault(); pressZoom(1); return; }
      // The number row (§14/§15): digits are not letters, so
      // they work in label mode too — 1–4 the named views (the
      // same goView as the buttons), 5/6 the field sizes, 7/8/9
      // the object layouts. In app scope the app branch above
      // has already returned: digits stay bare there.
      if (VIEW_KEYS[e.key]) { e.preventDefault(); goView(VIEW_KEYS[e.key]); return; }
      if (e.key === "5") { e.preventDefault(); pressField(-1); return; }
      if (e.key === "6") { e.preventDefault(); pressField(1); return; }
      if (LAYOUT_KEYS[e.key]) {
        e.preventDefault();
        setSpace((s) => applyLayout(s, LAYOUT_KEYS[e.key]));
        setZoomFocus(null); // a layout change clears dolly-at-cursor (§4)
        return;
      }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); doF(); return; }
      if (e.key === "e" || e.key === "E") {
        // E's collision, resolved by resolveEKey: on the
        // app-bearing RING item, E expands the app across the
        // whole platter (outside label mode only); on a citizen
        // E is yaw- and falls through to the transform cluster
        // below; in label mode the letter targeting below picks
        // E up as the cylinder's address.
        if (!uiMode.labelMode
          && resolveEKey({ targetId: addressedId(hoverId, currentId), appOpen: false, appMode: null }) === "expand") {
          e.preventDefault();
          const bearer = addressedId(hoverId, currentId);
          if (bearer === "web") openWebApp("full");
          else openAudioApp("full");
          return;
        }
      }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_II); return; }
      if ((e.key === "s" || e.key === "S") && !uiMode.labelMode) { e.preventDefault(); dispatchBack(EVENTS.GO_BACK_I); return; }
      if ((e.key === "a" || e.key === "A") && !uiMode.labelMode) { e.preventDefault(); doFinish(); return; }
      if (e.key === "g" || e.key === "G") { e.preventDefault(); doG(); return; }
      if ((e.key === "j" || e.key === "J") && !uiMode.labelMode) {
        // J strips cables — outside label mode only; inside it,
        // J is the arch's address and falls through.
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
      // The transform cluster (slice 11): the letter keys Q/W
      // pitch, E/R yaw, T/Y roll, B/N plane, Z/X magnify — OUTSIDE
      // label mode only. Inside it they are addresses and fall
      // through to letter targeting. handleTransformKey resolves
      // the target (citizen / ring / platter) and speaks the live
      // value as dynamic input while the gesture runs.
      {
        const tk = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (!uiMode.labelMode && TRANSFORM_KEYS[tk]) {
          e.preventDefault();
          touch();
          handleTransformKey(tk);
          return;
        }
      }
      // H copies and I inspect the addressed thing. OUR LAYOUT's
      // choice, stated plainly: in KeyPilot's stock layout I copies
      // an image; here I INSPECTS and copy lives on H (slice 11 —
      // it lived on C until C became dolly out). Like G before
      // them, the operators are mode-scoped: inside label mode H
      // is the horizon skyline's address and I the horizon
      // panel's, and letter targeting below picks them up.
      if ((e.key === "h" || e.key === "H") && !uiMode.labelMode) {
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
      if (uiMode.labelMode) {
        // The ring's items continue the labeled set past the
        // citizens (theirs is the letter after the tree's).
        const rit = ringItemForLabel(e.key);
        if (rit && isAddressable(layers, rit.id)) {
          e.preventDefault(); setCurrentId(rit.id); return;
        }
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
    inspection, inspectRot, libraryOpen, clip, clipSummoned, values,
    openAppState, audio, tokenHoverId, appFocusId, regionHover, viewName,
    partFocus, zoomMul, ringSpin, platterQuat, ringHover, fieldIndex, subHover, descents,
    bookAccess, bookSpread, openMessage, web, webSectionHover, webLinkHover]);

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
  // Slice 12: a part focus held on a sub-node citizen is a NODE
  // focus (the knot keeps PART, the tree keeps BRANCH); the
  // hovered sub-node is resolved for the readout the same way.
  const focusSub = partFocus.partId && isSubnodeObject(partFocus.objectId)
    ? subnodeById(partFocus.objectId, partFocus.partId, displayRootOf(descents[partFocus.objectId], partFocus.objectId), tangleDataset)
    : null;
  const hoverSub = subHover && subHover.objectId === currentId
    ? subnodeById(subHover.objectId, subHover.nodeId, displayRootOf(descents[subHover.objectId], subHover.objectId), tangleDataset)
    : null;
  const descentRootId = currentId ? displayRootOf(descents[currentId], currentId) : null;
  const descentRoot = descentRootId ? subnodeById(currentId, descentRootId) : null;
  const mode = inspection.inspectedId ? `INSPECTING — ${thingName(inspection.inspectedId)}`
    : dragLock ? "DRAG-LOCKED"
    : cmd.armed ? "COMMAND LINE"
    : pendingId ? "PATCHING — a cable is live"
    : openMessage ? `READING — ${messageById(openMessage)?.subject || "letter"}`
    : openAppState.appId ? (openAppState.mode === "full"
      ? `APP FULL — ${openAppState.appId === "web" ? "WEB" : "WAVEFORM"}`
      : `APP — ${openAppState.appId === "web" ? "WEB" : "WAVEFORM"}`)
    : partFocus.partId
      ? partFocus.objectId === "tree"
        ? `BRANCH FOCUS — ${dataBranchById(DATA_TREE, partFocus.partId)?.name || ""}`
        : focusSub
          ? `NODE FOCUS — ${focusSub.name}`
          : `PART FOCUS — ${partById(partFocus.partId)?.name || ""}`
    : currentId === "book" && bookPageOutId(bookAccess)
      ? `PAGE OUT — ${subnodeById("book", bookPageOutId(bookAccess))?.name || ""}`
    : currentId === "book" && bookAccessedId(bookAccess)
      ? `IN THE BOOK — ${subnodeById("book", bookAccessedId(bookAccess))?.name || ""}`
    : cardId ? "ENTERED — the card is open"
    : uiMode.labelMode ? "LABEL MODE"
    : currentId ? "TARGETED"
    : "AT REST";
  const focusPart = partFocus.partId && partFocus.objectId === "knot" ? partById(partFocus.partId) : null;
  const focusBranch = partFocus.partId && partFocus.objectId === "tree"
    ? dataBranchById(DATA_TREE, partFocus.partId) : null;
  const addressedName = thingName(addressedId(hoverId, currentId));
  const audioTrack = makeTrack(audio.trackId);
  const nextText = inspection.inspectedId
    ? `${thingName(inspection.inspectedId)} is at the inspection position — Esc / S (one level) or D (two) sends it home`
    : dragLock
      ? `carrying ${thingName(dragLock.id)} — move the cursor, Space or A (FINISH) drops, Esc (CANCEL) cancels`
      : pendingId
        ? `patch live from ${pending?.name || thingName(pendingId)} — address a second thing, then G / F / A (FINISH) / click lands it`
        : openMessage
          ? `${messageById(openMessage)?.subject || "the letter"} stands open on the stage — Esc / S (one level) closes it; D closes it and releases the level beneath`
          : openAppState.appId === "web"
            ? `${WEBFRAME.title} holds the stage — section ${web.section + 1} of ${WEB_LAYOUT.sections.length} at the reading line · Space / V next section · F follows a hovered link · D (GO BACK II) up to two steps back · Esc / S one step`
            : openAppState.appId
              ? `${audioTrack.name} holds the stage — Space ${audio.playing ? "pauses" : "plays"} · F drills the hovered stretch · D (GO BACK II) up to two steps back · Esc / S one step`
          : partFocus.partId
          ? partFocus.objectId === "tree"
            ? `${focusBranch?.name || "branch"} focused — D (GO BACK II) backs out to the tree`
            : focusSub
              ? `${focusSub.name} focused — D (GO BACK II) backs out${descentRoot ? `, then climbs toward ${descentRoot.name}` : ` to the ${current?.name || "citizen"}`}`
              : `${focusPart?.name || "part"} focused — D (GO BACK II) backs out to the knot`
          : currentId === "book" && bookPageOutId(bookAccess)
            ? `${subnodeById("book", bookPageOutId(bookAccess))?.name || "the page"} stands out of the drum — S / Esc (one level) slides it home; D climbs two tiers`
            : currentId === "book" && bookAccessedId(bookAccess)
              ? `in the book at ${subnodeById("book", bookAccessedId(bookAccess))?.path.join(" › ") || ""} — the backs climb out, one tier per level`
              : cardId
                ? `${thingName(cardId)} is open — D (GO BACK II) flies back to the world seat`
                : addressedName
                  ? `${addressedName} addressed — F opens it`
                  : "hover an object, or Tab to one — F opens it";

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
          "turn it with Q W E R T Y · B N turns it in its own plane · D / Esc — send it home",
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
          : ["holds — nothing yet (the EMPTY plate)", "H on a thing copies it here", "D / Esc — send it home"],
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
    if (id === "tree") {
      const o = objectById(id);
      return {
        title: o.name,
        lines: [
          `kind — object · ${o.group} · a grown dataset`,
          `total value — ${DATA_TREE.totalValue}`,
          `leaves — ${DATA_TREE.leafCount} · depth ${DATA_TREE.maxDepth} · ${DATA_TREE.branches.length} branches`,
          "grown from the noctivagous-linux repository itself by L-system rules — file sizes are the values",
          "depth-1 branches are sub-addresses — hover one, F zooms to the subtree",
          "D / Esc — send it home, exactly as it was",
        ],
      };
    }
    if (id === "mail") {
      const o = objectById(id);
      return {
        title: o.name,
        lines: [
          `kind — object · ${o.group} · the mailbox, as a cabinet`,
          MAIL_TOTALS.sample
            ? "the mailbox is a SAMPLE — sample correspondence about the space, on example domains"
            : "from this machine's mailbox",
          `${MAIL_TOTALS.messages} messages · ${MAIL_TOTALS.unread} unread · ${MAIL_TOTALS.recent} recent letters on the post shelf`,
          ...folderNodes().map((f) => `${f.path.join(" › ")} — ${f.value} messages${f.unread ? ` · ${f.unread} unread` : ""}`),
          "folders and letters are sub-addresses — hover one; F flies to a folder, F opens a letter on the centre stage",
          "D / Esc — send it home, exactly as it was",
        ],
      };
    }
    if (id === "devices") {
      const o = objectById(id);
      const printer = printerOf(ENVIRONMENT);
      const queue = queueTotals(printer);
      const conns = connectionTotals(ENVIRONMENT);
      return {
        title: o.name,
        lines: [
          `kind — object · ${o.group} · the machine's attachments`,
          ENV_TOTALS.sample
            ? "the environment snapshot is a SAMPLE machine — it names sample devices and example hosts"
            : "from this machine's environment snapshot",
          ...deviceList(ENVIRONMENT).map((d) => `${d.name} — ${d.state || d.kind}`),
          ...(printer
            ? [`queue — ${queue.jobs} jobs · ${queue.pagesKnown ? `${queue.pages} pages` : "pages not reported"} · ${queue.printing} printing`]
            : []),
          `network — ${conns.count} connections · cables from the hub to host tokens on the ring`,
          "devices, the hub and the hosts are sub-addresses — hover one, F flies into it",
          "D / Esc — send it home, exactly as it was",
        ],
      };
    }
    if (id === "horizon3d" || id === "horizonflat") {
      const o = objectById(id);
      return {
        title: o.name,
        lines: [
          `kind — object · ${o.group} · the activity monitor`,
          "eight lanes of machine life — the last two are the network, driven by the environment snapshot's captured strip",
          ...SPACE_LANES.map((l) => `${l.label} — ${laneNow(l)} · ${laneSource(l)}`),
          "D / Esc — send it home, exactly as it was",
        ],
      };
    }
    if (id === "book") {
      const o = objectById(id);
      return {
        title: o.name,
        lines: [
          `kind — object · ${o.group} · a book in tiers`,
          `the book — ${BOOK_TOTALS.chapters} chapters · ${BOOK_TOTALS.sections} sections · ${BOOK_TOTALS.pages} pages · ${BOOK_TOTALS.words} words`,
          `presentation — ${bookStyle === "spread" ? `spread ${bookSpread + 1} of ${SPREAD_COUNT}` : "cylinder"}`,
          "chapters and sections are bands on the drum; pages are leaves at the rim — hover a tier, F accesses it, a page comes out to be read",
          "U stands the book open, two pages at a time; B and N flip the spread",
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
        `home transform — yaw ${Math.round(space.transforms[id].yaw)}° · pitch ${Math.round(space.transforms[id].pitch)}° · roll ${Math.round(space.transforms[id].roll)}° · plane ${Math.round(space.transforms[id].spin || 0)}° · magnify ${space.transforms[id].scale.toFixed(2)}×`,
        `inspection turn — yaw ${inspectRot.yaw}° · pitch ${inspectRot.pitch}° · roll ${inspectRot.roll}° · plane ${inspectRot.spin || 0}° · size ×${inspectRot.scale.toFixed(2)}`,
        "D / Esc — send it home, exactly as it was",
      ],
    };
  })();

  const lastPaste = pastes.length ? pastes[pastes.length - 1] : null;

  // The keyboard panel's board, resolved from the sparse keymap
  // for this moment (keyboard.js): scope by the handler's own
  // precedence — an open app first, then the armed line, then
  // label mode, then the space at rest. The rotate caps name the
  // resolved target and E's cap its resolved meaning (slice 11).
  const kb = resolveKeyboard({
    scope: openAppState.appId ? "app" : cmd.armed ? "command" : uiMode.labelMode ? "labels" : "space",
    appKind: openAppState.appId || null,
    playing: audio.playing,
    pending: Boolean(pendingId),
    dragLocked: Boolean(dragLock),
    appMode: openAppState.mode,
    rotateTarget: resolveRotateTarget({
      hoverId, currentId, ringAddressed: ringAddressedNow(),
    }).kind,
    eKey: resolveEKey({
      targetId: addressedId(hoverId, currentId),
      appOpen: Boolean(openAppState.appId),
      appMode: openAppState.mode,
    }),
    fieldName: FIELD_SIZES[fieldIndex].name,
    cardLabels: libraryOpen
      ? labeledMedia().map(({ item, label }) => ({ label, title: item.title, id: item.id }))
      : [],
    // Slice 13-2: the book's caps — U is BOOK STYLE only while
    // the book is current, and in its spread presentation B/N
    // read SPREAD − / SPREAD +.
    bookStyle: currentId === "book" ? bookStyle : null,
    bookFlip: currentId === "book" && bookStyle === "spread",
    lastKey: lastKey?.code || null,
  });

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
            zoomFocusId={zoomFocus?.id || null}
            platterQuat={platterQuat}
            ringSpinDeg={ringSpin}
            fieldIndex={fieldIndex}
            turntableOn={Boolean(values.turntable)}
            pulsesOn={Boolean(values.pulses)}
            ambientOn={values.ambientMotion !== false}
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
            branchHoverId={branchHoverId}
            subHover={subHover}
            descents={descents}
            bookStyle={bookStyle}
            bookAccess={bookAccess}
            bookSpread={bookSpread}
            tangleDataset={tangleDataset}
            pastes={pastes}
            inspectPanel={inspectPanel}
            openApp={openAppState}
            audio={audio}
            openMessage={openMessage}
            web={web}
            webSectionHover={webSectionHover}
            webLinkHover={webLinkHover}
            tokenHoverId={tokenHoverId}
            appFocusId={appFocusId}
            regionHover={regionHover}
            sharedRef={sharedRef}
            onHover={onHover}
            onRingHover={setRingHover}
            onPartHover={onPartHover}
            onBranchHover={onBranchHover}
            onSubHover={onSubHover}
            onTokenHover={onTokenHover}
            onTokenActivate={activateToken}
            onWebTokenActivate={activateWebToken}
            onWebSectionHover={setWebSectionHover}
            onWebLinkHover={setWebLinkHover}
            onWebSectionActivate={(index) => { goToWebSection(index); }}
            onWebLinkActivate={followWebLink}
            onMessageActivate={onMessageActivate}
            onRegionHover={setRegionHover}
            onRegionActivate={drillRegion}
            onAudioEnd={() => setAudio((a) => (a.playing ? { ...a, playing: false } : a))}
            onObjectClick={onObjectClick}
            onSelect={onSelect}
            onTouch={touch}
          />
        </div>

        <header className="us-head">
          <h1>DEMO-DE · UI SPACE</h1>
          <nav className="us-nav" aria-label="demo-de pages">
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
        </header>

        <section className="us-box us-overlay-panel us-hud" data-testid="space-hud" aria-label="Space readout">
          <div className="us-panel-head">
            <h3>READOUT</h3>
            <span className="us-cmdtag">{mode}</span>
          </div>
          <div className="us-readout">
            <span className="k">LAYOUT</span>{"   "}{layout.name}{"\n"}
            <span className="k">VIEW</span>{"     "}{VIEWS[viewName].name}{"\n"}
            <span className="k">DOLLY</span>{"    "}distance ×{zoomMul.toFixed(2)}{"\n"}
            <span className="k">FIELD</span>{"    "}{FIELD_SIZES[fieldIndex].name}{"\n"}
            <span className="k">LAYERS</span>{"   "}DATA {layers.data.visible ? "shown" : "hidden"}{layers.data.locked ? " · locked" : ""}{"\n"}
            <span className="k">LAYERS</span>{"   "}INST {layers.instruments.visible ? "shown" : "hidden"}{layers.instruments.locked ? " · locked" : ""}{"\n"}
            <span className="k">LAYERS</span>{"   "}SCEN {layers.scenery.visible ? "shown" : "hidden"}{layers.scenery.locked ? " · locked" : ""}{"\n"}
            {currentId ? (
              <>
                <span className="k">CURRENT</span>{"  "}{thingName(currentId)}{current ? ` — ${current.group}` : ""}{currentId === "crystal" ? " · 8 faces · values live" : ""}{"\n"}
              </>
            ) : (
              <>
                <span className="k">CURRENT</span>{"  "}—{"\n"}
              </>
            )}
            {current && tr ? (
              <>
                <span className="k">YAW</span>{"      "}{Math.round(tr.yaw)}°{"  "}
                <span className="k">PITCH</span> {Math.round(tr.pitch)}°{"  "}
                <span className="k">ROLL</span> {Math.round(tr.roll)}°{"\n"}
                <span className="k">PLANE</span>{"    "}{Math.round(tr.spin || 0)}°{"  "}
                <span className="k">MAGNIFY</span>{"  "}{tr.scale.toFixed(2)}×{"\n"}
              </>
            ) : null}
            <span className="k">CABLES</span>{"   "}{space.cables.length}{"\n"}
            {focusPart ? (
              <>
                <span className="k">PART</span>{"     "}{focusPart.name} — value {focusPart.value} · {(partShare(focusPart) * 100).toFixed(1)}% of the knot{"\n"}
              </>
            ) : null}
            {focusBranch ? (
              <>
                <span className="k">BRANCH</span>{"   "}{focusBranch.name} — value {focusBranch.value} · {(focusBranch.share * 100).toFixed(1)}% of the tree · {focusBranch.leafCount} leaves · depth 1{"\n"}
              </>
            ) : null}
            {focusSub ? (
              <>
                <span className="k">NODE</span>{"     "}{focusSub.name} — value {focusSub.value} · {(focusSub.share * 100).toFixed(1)}% of {descentRoot ? descentRoot.name : current?.name || "the citizen"} · depth {focusSub.depth}{"\n"}
              </>
            ) : null}
            {hoverSub && !focusSub ? (
              <>
                <span className="k">NODE</span>{"     "}{hoverSub.name} — value {hoverSub.value} · {(hoverSub.share * 100).toFixed(1)}% of {descentRoot ? descentRoot.name : current?.name || "the citizen"} · depth {hoverSub.depth} · hovered{"\n"}
              </>
            ) : null}
            {descentRoot ? (
              <>
                <span className="k">DESCENT</span>{"  "}{current?.name || currentId} rooted at {descentRoot.path.join(" › ")} — values and shares are of this root{"\n"}
              </>
            ) : null}
            {currentId === "book" ? (
              <>
                <span className="k">BOOK</span>{"     "}{bookStyle === "spread" ? `SPREAD — spread ${bookSpread + 1} of ${SPREAD_COUNT}` : "CYLINDER — leaves around the drum"} · {BOOK_TOTALS.chapters} chapters · {BOOK_TOTALS.sections} sections · {BOOK_TOTALS.pages} pages · {BOOK_TOTALS.words} words{"\n"}
              </>
            ) : null}
            {currentId === "book" && bookAccessedId(bookAccess) ? (
              <>
                <span className="k">ACCESS</span>{"   "}in the book at {subnodeById("book", bookAccessedId(bookAccess))?.path.join(" › ") || ""}{bookPageOutId(bookAccess) ? " — the page stands out" : ""} — the backs climb out{"\n"}
              </>
            ) : null}
            <span className="k">LIBRARY</span>{"  "}{libraryOpen ? "OPEN" : "CLOSED"} · {MEDIA_ITEMS.length} items{"\n"}
            <span className="k">CLIPBOARD</span>{" "}{clipboardTitle(clip) || "—"}{"\n"}
            {lastPaste ? (
              <>
                <span className="k">PASTE</span>{"    "}CLIPBOARD → {thingName(lastPaste.targetId)}: {lastPaste.item.title}{"\n"}
              </>
            ) : null}
            {openAppState.appId === "audio" ? (
              <>
                <span className="k">APP</span>{"      "}Waveform · {openAppState.mode === "full" ? "FULL PLATTER" : "CENTRE STAGE"} · {audioTrack.name}{"\n"}
                <span className="k">WINDOW</span>{"   "}{audio.window.start.toFixed(1)}–{audio.window.end.toFixed(1)}s of {audioTrack.seconds}s · {audio.playing ? "PLAYING" : "paused"}{audio.loop ? " · LOOP" : ""} · back-stack {audio.nav.length}{"\n"}
              </>
            ) : null}
            {openAppState.appId === "web" ? (
              <>
                <span className="k">APP</span>{"      "}Web · {openAppState.mode === "full" ? "FULL PLATTER" : "CENTRE STAGE"} · {WEBFRAME.title} — captured {WEBFRAME.captured}{"\n"}
                <span className="k">SECTION</span>{"  "}{web.section + 1} of {WEB_LAYOUT.sections.length} — {WEB_LAYOUT.sections[web.section]?.heading || ""} · {WEB_LAYOUT.sections[web.section]?.words || 0} words · back-stack {web.nav.length}{"\n"}
              </>
            ) : null}
            {openMessage ? (
              <>
                <span className="k">MESSAGE</span>{"  "}{messageById(openMessage)?.subject || ""} — from {messageById(openMessage)?.from.name || ""} · {messageById(openMessage)?.date || ""}{"\n"}
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
        </section>

        <div className="us-firstmoves" data-testid="first-moves" aria-label="First moves">
          {FIRST_MOVES.map((m) => (
            <span className="us-move" key={m.key}><b>{m.key}</b>{m.label}</span>
          ))}
        </div>

        <section className={`us-box us-overlay-panel us-guide${guideOpen ? "" : " collapsed"}`} data-testid="guide-panel" aria-label="UI Space guide">
          <div className="us-panel-head">
            <h3>GUIDE</h3>
            <button
              type="button"
              className="us-panel-toggle"
              aria-expanded={guideOpen}
              onClick={(e) => { setGuideOpen((v) => !v); e.currentTarget.blur(); }}
            >
              {guideOpen ? "Collapse" : "Open"}
            </button>
          </div>
          {guideOpen ? (
            <>
              <div className="us-guide-tabs" role="tablist" aria-label="Guide sections">
                {GUIDE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={guideTab === t.id}
                    className={`us-guide-tab${guideTab === t.id ? " here" : ""}`}
                    onClick={(e) => { setGuideTab(t.id); e.currentTarget.blur(); }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="us-guide-body">
                {guideTab === "brief" ? (
                  <div>
                    <p>
                      An early form of the UI space: the lab's frames stand on one platter as
                      miniature citizens, and they are worked the bimodal way, entirely by key —
                      there is no scroll-wheel zoom and no mouse orbit. The object under the
                      cursor is the addressee and <b>F</b> is the click (<b>Tab</b> cycles too);
                      turn the addressed object with <b>E</b>/<b>R</b> (yaw), <b>Q</b>/<b>W</b>{" "}
                      (pitch), <b>T</b>/<b>Y</b> (roll) and <b>B</b>/<b>N</b> (in its own plane),
                      magnify it with <b>Z</b>/<b>X</b> — every turn pivoting at the centre of
                      the object's bounds — patch it to another with <b>G</b>, pick it up with a{" "}
                      <b>Space</b> press (press again to drop), and rearrange the whole space
                      with the layouts on <b>7</b> <b>8</b> <b>9</b>. <b>C</b> and <b>V</b> dolly
                      the camera out and in — toward the citizen under the cursor, when there
                      is one — and <b>5</b> and <b>6</b> change the field: the zoom, the lens
                      rather than the camera.
                    </p>
                    <p>
                      Completion and retreat are EVENTS, and the readout names them:{" "}
                      <b>A</b> is FINISH (land the patch, drop the carry), <b>S</b> is GO BACK I
                      and <b>Esc</b> is CANCEL — each goes back exactly one level — and{" "}
                      <b>D</b> is GO BACK II, up to two levels in one press. Key labels are
                      opt-in: <b>Alt+L</b> shows the letter chips and makes letters into
                      addresses. The command line at the foot of the scene — <b>Enter</b> arms
                      it. <b>M</b> opens the MEDIA LIBRARY on the XY wall; <b>H</b> copies the
                      addressed thing to the clipboard, <b>I</b> inspects it, and <b>Alt+0</b>
                      summons the clipboard tray.
                    </p>
                    <p>
                      The space opens in <b>perspective</b> at elevation <b>50</b>. The
                      PARAMETERS gather the camera into a <b>VIEW</b> fieldset — projection,
                      rotation, elevation — with the named seats on buttons beside them:
                      <b> PLAN</b> (top), <b>ELEVATION</b> (front, square-on to the XY wall),
                      <b>SIDE</b> and <b>HOME</b>, the same views the command line speaks as
                      v › t/f/s/h. The number row is the camera and the room: <b>1</b>–<b>4</b>{" "}
                      call those same views in the fieldset's order, <b>5</b> and <b>6</b> step
                      the field size, <b>7</b>–<b>9</b> load the object layouts — while
                      Alt+digits stay the layer and clipboard chords they always were.
                    </p>
                    <p>
                      The platter wears a <b>ring</b> now, and the ring carries the first app:
                      <b>Waveform</b>, for audio. Address it and <b>F</b> opens it onto the centre
                      stage; <b>E</b> opens it across the whole platter. Inside the app the keys
                      change scope: <b>Space</b> plays, <b>C</b> and <b>V</b> over the waveform
                      fence zoom inside its own frame, and the back events walk the app's own
                      levels — <b>D</b> is now the big step back (two levels: out of a drill
                      and out of the app), <b>Esc</b> and <b>S</b> the single step (one level,
                      which leaves the app only when its history is already empty). The ring
                      has a second item now: <b>Web</b>, one captured page standing as a sheet —
                      the field notes tell what it is, and what it is not.
                    </p>
                    <p>
                      <b>FIG. 1</b> — The space at rest in the RING layout: fifteen miniature frames
                      on the platter, each one a working object — the mesa and drum really are the
                      sunburst layout, the tray and cube really are the treemap, tiled by the same
                      NCTGraphite modules as their own pages. Left alone for eight seconds the
                      world turns slowly on its platter; any key takes control back.
                    </p>
                    <p>
                      This is an early form: the objects are manipulated, not yet entered for
                      real — full descent is later work.
                    </p>
                  </div>
                ) : null}
                {guideTab === "keys" ? (
                  <div>
                    {KEY_GROUPS.map((g) => (
                      <div className="us-keygroup" key={g.title}>
                        <h4>{g.title}</h4>
                        {g.rows.map(([key, text]) => (
                          <div className="us-keyrow" key={`${g.title}-${key}`}>
                            <span className="us-keycap">{key}</span>
                            <span>{text}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
                {guideTab === "notes" ? (
                  <div>
                    <h4>The Space</h4>
                    <p>
                      The world is the lab's platter, and its citizens are the frames themselves,
                      miniaturised but not faked: the mesa's terraces are the sunburst partition
                      of the repository itself, the tray's cuboids are the binary treemap, the cube's faces carry
                      the treemap's children exactly as the cube page spreads them. Around them
                      the stylised citizens — the tangled tree's figures on their glass level
                      sheets, the horizon skyline, the panelization arch, the definition's wired
                      nodes. Containers are glass — the drum's wall, the cube's shell, the tray —
                      so what is inside ghosts through before anything is opened. Nothing here is
                      a picture of the lab; it is the lab, at tabletop scale.
                    </p>
                    <p>
                      At the back stands the first of the principal planes, the XY datum wall,
                      and on it the environment's first app: the MEDIA LIBRARY, a glass cabinet
                      (M) whose saved items fold out onto the wall as cards. The clipboard
                      (Alt+0) is a tray that flies to the platter's front edge; what it holds can
                      be pasted onto any object with G, and stays held.
                    </p>
                    <p>
                      The DATA KNOT works by a new convention: a trefoil is one closed curve, and
                      here its tube is glass because it contains things — the arc is divided into
                      eight parts, each part holding one datum of a system's life (ingress, cache,
                      render, index, queue, store, sync, egress). The tube is ONE CONTINUOUS
                      SURFACE whose girth swells and narrows with the size of what each part
                      holds — the change blended smoothly across each boundary, so a part's
                      share reads along the curve's whole length, not at a marker. Make the knot
                      current and its parts become addresses: hover one to name it, and F zooms
                      the camera into that part of the curve to read what it carries. D backs out
                      to the knot again. Two further knots stand on pedestals at the rim as pure
                      atmosphere — a (4,3) torus knot and a cinquefoil — turning slowly, holding
                      nothing, there for the feel of the place. Knot forms after the classic
                      torus-knot parametrizations; see Stemkoski's Parameterized Knots gallery.
                    </p>
                    <p>
                      The knot's surface is a SWEEP, and the sweep is a general instrument here:
                      a 2D contour carried along a 3D path. At each step the contour sits in the
                      plane given by the path's PARALLEL-TRANSPORT frame — each frame turned by
                      the smallest rotation from the last, never spun by the curve's own torsion
                      — and the cross-section may SCALE, ROTATE and SHEAR at every vertex, so a
                      single operation yields tapers, drill-bit twists and sheared tubes as
                      readily as plain ones. The data knot is a circular contour swept along the
                      trefoil with its radius driven by the data; the rim knots are the same
                      sweep wearing a gentle periodic swell for a profile. Ported to TypeScript
                      as sweeps.js from Linas Vepstas's GLE tubing and extrusion library (1991).
                      GLE's JOIN STYLES — its mitered, rounded and beveled geometry for sharp
                      path corners — are the part not yet ported: a sweep here rounds a corner
                      only as finely as the path itself is sampled.
                    </p>
                    <p>
                      Crystals work two ways here. At the eastern rim stands the CRYSTAL CLUSTER —
                      beta-quartz, a cube, a trapezohedron and a rhombic dodecahedron on a rock
                      plinth — still, because minerals are: they do not turn, and only their lit
                      cores breathe, very slowly. None of them was modelled. A crystal form is a
                      group of faces related by symmetry, so each solid is generated: one seed
                      face multiplied by its point group — m-3m for the isometric three, 6/mmm for
                      the beta-quartz — until the faces close into a solid. The second use is a
                      citizen: the LIVING CRYSTAL, the same machinery turned to data. Its
                      octahedron's eight faces carry eight values, each face's distance from the
                      centre set by its value, so the shape is the chart; as the values drift, the
                      solid regrows, faces advancing and retreating, turning slowly on its
                      pedestal, with the values pinned to its faces while you hold it. Crystal
                      forms generated by point-group symmetry, after OpenGeology's Mineralogy:
                      Crystal Morphology and Symmetry.
                    </p>
                    <p>
                      The trees are grown, not modelled, by L-SYSTEMS: a grammar rewrites a
                      string of symbols in parallel, generation after generation, and a turtle
                      walks the final string in 3D — F draws a segment, brackets fork and
                      return, + − & ^ \ and / turn its frame — while da Vinci's pipe model
                      gives every branch its thickness: a parent's radius is the square root
                      of the sum of its children's squared radii, so the wood's cross-section
                      is conserved at every fork. Two uses, as with the knots and crystals. At
                      the western rim a BOTANICAL TREE stands on its mound as scenery, grown
                      from a small stochastic grammar — no data, only the feel of a grown
                      thing, swaying almost imperceptibly. The second use is a citizen: the
                      DATA TREE, the repository's own hierarchy generating the branching directly — each
                      child spirals off its parent at a golden angle, its length set by its
                      share of the whole, its tips budded with the leaves it aggregates. Its
                      depth-1 branches are sub-addresses, like the knot's parts: with the tree
                      current, hover a branch to light its whole subtree, and F zooms the
                      camera to that subtree to read its value, its share and its leaf count;
                      D backs out. In label mode the branches name themselves at their forks.
                      Depth-2 branches are not separately addressable in this slice — the
                      depth-1 branch is the unit of address. After Lindenmayer (1968);
                      Prusinkiewicz &amp; Lindenmayer, The Algorithmic Beauty of Plants.
                    </p>
                    <p>
                      Slice 12 extends the same sub-addressing to the remaining data
                      citizens. The TREEMAP TRAY's plates and cuboids, the TANGLED TREE's
                      figures and the two SUNBURSTS' wedges are all sub-nodes now: with the
                      citizen current, hovering one lights it (its siblings dim), a card
                      stands in the space at the node itself naming it with its value, its
                      share and its depth, and the readout carries a NODE line. F on a tray
                      node, a figure or a sunburst leaf wedge takes the focus seat on it,
                      as with the knot's parts. A figure's value is its progeny — itself
                      plus every figure descended from it — the genealogy carrying no
                      weights of its own.
                    </p>
                    <p>
                      The sunbursts go one step further: they DESCEND. F on a branch wedge
                      makes that wedge's node the citizen's display root — the mesa
                      rebuilds its terraces, the drum its blocks, from that node down, and
                      every value and share is read against the new root while the card
                      and the readout keep the full path from the root in view. Descent sits
                      in the release stack at the focus tier, one level per root: the
                      backs climb out level by level, and at the true root the level is
                      simply gone. It is a display state, never a transform — a citizen
                      you turned, spun or magnified stays turned, spun and magnified
                      through the whole descent and the whole climb back.
                    </p>
                    <p>
                      Slice 13 makes the data real: THE SPACE EATS ITS OWN REPO. The
                      hierarchy citizens no longer read d3's flare placeholder — a
                      snapshot generator (ui-space/tools/snapshot-repo.mjs) walks the
                      noctivagous-linux repository itself and writes the hierarchy the
                      mesa, drum, tray, cube and data tree all consume: directories
                      and files, a file's value its size in bytes. Sub-node ids are
                      repo paths now, and the sunbursts descend through the repo's
                      real directories. A few huge files dominate their citizens —
                      that is the truth of this repo, not a defect of the picture.
                      The data arrives as a generated snapshot, never a live bridge:
                      regenerate it and the space eats the repo as it then stands.
                    </p>
                    <p>
                      The TANGLED TREE gains a second course beside the Greek
                      genealogy: DEMO-DE'S OWN MODULE IMPORT GRAPH, from the same
                      snapshot — every module of demo-de's sources a figure, its
                      parents its importers, its level its longest path from the
                      entry modules, its progeny its dependency closure. Switch
                      courses in PARAMETERS (Tangled tree data). The figures stay
                      sub-addresses in both courses: hover to read a module and its
                      line, F flies into it.
                    </p>
                    <p>
                      The newest citizen is a BOOK, and it is built the way the
                      space builds everything: in tiers. THE CYLINDER BOOK — "A
                      Sample Book of the Space", three chapters, nine sections,
                      twenty pages, written about the space itself — stands its
                      pages as radial leaves around a drum. The drum's surface
                      carries the tiers as two arc bands, chapters above and
                      sections below, each segment's span proportional to its
                      page count: a sunburst unwrapped around a cylinder, in the
                      chapter's own colour. A page's value is its word count,
                      and the tiers sum, as values do here. Reading it is the
                      sub-address discipline one level up: hover a band or a
                      leaf to read its card; F ACCESSES a chapter or a section
                      — the drum turns to face it and the rest of the book
                      ghosts — and F on a page slides the page out of the drum
                      so its whole text stands clear. The backs climb the tiers
                      exactly as they climb a descent, because access sits in
                      the release stack at the same tier. Or the book changes
                      its stance entirely: U stands it open as a codex, two
                      pages at a time — the title page alone on the first
                      recto, as title pages stand — and B and N, which
                      everywhere else turn a thing in its plane, flip the
                      spread. One object, two bindings; the transform you gave
                      it survives both, as transforms survive everything here.
                    </p>
                    <p>
                      Slice 14 turns the same trick outward: THE SPACE EATS ITS
                      OWN MACHINE. A second snapshot generator
                      (ui-space/tools/snapshot-environment.mjs) writes the
                      ENVIRONMENT — the machine's devices and its network —
                      and each kind feeds a form the space already has. The
                      devices stand as one citizen, DEVICES: a shelf at its
                      plot carrying the machine's attachments as small forms —
                      the printer a little press, the keyboard a slab of keys,
                      the pointer a pebble, the display a small screen, the
                      volumes slabs — and the printer carries its QUEUE as
                      geometry: a sheet of paper stands in its output tray for
                      every queued job, and the job being printed wears its
                      sheet half-fed into the press. Its hub stands at the
                      shelf's edge with a port per connection. The network
                      arrives twice. In the HORIZON citizens — the skyline's
                      rows and the panel's strips alike — the last two of the
                      eight lanes are NETWORK IN and NETWORK OUT, driven by the
                      snapshot's captured strip of interface rates; the other
                      six lanes keep the tempered walk they always had. And
                      each CONNECTION is a cable: from the hub an arc runs out
                      to a host token standing on the ring's back arc — the
                      tokens are world-anchored there, not riders on the
                      ring's spin, and they carry no letters — its thickness
                      and its glow the connection's bytes, on a log scale.
                      The hosts are sub-addresses of the devices citizen, like
                      its devices: hover one and its card names the host, the
                      port and the bytes; F flies to it. The committed
                      snapshot is a SAMPLE machine, and it says so wherever it
                      shows; regenerate with node
                      ui-space/tools/snapshot-environment.mjs --real to show
                      this machine — review before committing, it names real
                      devices and endpoints.
                    </p>
                    <p>
                      The platter keeps one rule at two scales — THE PROTECTIVE
                      SPHERE: a thing that turns is enclosed by the sphere its
                      turning sweeps about its pivot, and the base yields to
                      the sphere; geometry is subtracted, and the thing is
                      never confined to fit inside it. Beneath the platter the
                      rule is cut into the ground itself — the floor is a
                      static base with a circular well under the whole
                      assembly, so the world tips over ground it can never
                      reach. The same rule is now cut at citizen scale, into
                      the platter's own top: EVERY CITIZEN SITS IN A SOCKET, a
                      circular through-hole in the slab at its plot, the
                      cross-section of its own protective sphere — the tray's
                      the widest, the crystal's the narrowest, the book's
                      sized for a page slid out, its largest turning state —
                      with a machined lip on the hole's edge, so each citizen
                      tumbles in a gimbal seat and the platter is simply
                      absent where its swing would pass. The slab is three
                      units thick and every sphere reaches deeper than that,
                      so the holes go through, as the well does: the base
                      gives way entirely. And the sockets follow their
                      citizens — load a layout, or carry a citizen somewhere
                      new and drop it, and its hole is cut at its new home.
                    </p>
                    <p>
                      Slice 15 adds the last two data kinds. THE MAIL arrives
                      as a citizen: a PIGEONHOLE SORTING CABINET whose
                      compartments are the mailbox's folders, each one's
                      area its message count — the Archive's broad strip
                      across the top, Inbox, Projects and Sent sharing the
                      row beneath, Projects' own cell split between its
                      subfolders, unread counts riding as amber on the
                      compartments' edges, an envelope slot and a small
                      stack of letters on the cabinet's top. And because a
                      mailbox is read one letter at a time, the RECENT
                      MESSAGES stand as letters on a POST SHELF on the XY
                      wall, beside the media library — sender and subject
                      on each card's face. Make Mail current and both
                      become sub-addresses in the one discipline: hover a
                      folder or a letter to read its card; F flies into a
                      folder, and F on a letter OPENS it — the letter
                      stands as a sheet on the centre stage, from,
                      subject, date and full body, and the backs close it
                      at the same tier an app closes at, because a reading
                      is an opening. The mailbox is a SAMPLE — sample
                      correspondence about the space and its building, on
                      example domains — and it says so wherever it shows.
                    </p>
                    <p>
                      THE WEB arrives the converter's way: CARRY, DETACH,
                      NATIVE — and this slice is the DETACH proof. A
                      capture tool (ui-space/tools/snapshot-web.mjs)
                      fetched ONE public page ahead of time — Wikipedia's
                      SNOW GLOBE article, the master view's own subject,
                      its text CC BY-SA and the attribution carried in the
                      capture — and wrote its STRUCTURE: title, sections,
                      the first paragraphs of each, and the links those
                      paragraphs carry. That structure is what stands on
                      the stage when the ring's WEB item opens: not a
                      screenshot, not a raster of a browser, but the page
                      laid out as a document on a tall sheet — headings,
                      text and link spans in one layout, computed once, so
                      the thing you read is the thing that lights. Hover a
                      section and it highlights, its heading and word
                      count on the readout; F on a section moves the
                      reading line to it; F on a link follows it — an
                      anchor to a captured section moves the reading
                      position, and any other link answers honestly: not
                      captured, one page only in this proof. Space and
                      C/V step the reading position inside the sheet's
                      own frame, and the backs walk the reading history
                      before they leave, as they walk the waveform's.
                      What this is NOT is a live page: no browser renders
                      inside the deployed space, and none is pretended.
                      The live version needs a LOCAL BRIDGE driving your
                      own browser — the Mission Desk pattern — and that
                      is a later slice, named here so the proof is not
                      mistaken for it.
                    </p>
                    <h4>Media, the Ring and the Apps</h4>
                    <p>
                      Media representations for files matter, because the aim is parity with the
                      conventional 2D desktop: there, a file is opened by an app and edited in a
                      window; here, a file wears a 3D form and is edited in the space itself, in
                      the isometric and perspective views, with d3's conventions underneath —
                      scales, hierarchies and layouts doing the same work they do on the lab's
                      flat pages. The first media form is AUDIO, and its app is WAVEFORM.
                    </p>
                    <p>
                      Around the circular platter runs a RING — an annulus of things to open,
                      one ring to start. At rest it turns slowly, like the platter's own
                      turntable; it stops when anything on it is addressed, and it stops for an
                      open app, because an open app's furniture must hold still. Apps open two
                      ways. F takes an app onto the CENTRE STAGE: the main circle at the
                      platter's heart, the rest of the space remaining around it. E takes it
                      across the WHOLE PLATTER: the citizens hide, and the app has the full
                      disc. In both, THE RING BELONGS TO WHOEVER HOLDS THE STAGE — the app
                      places its controls, tools, states and portal objects there, addressed
                      like citizens and worked with F. The back events walk the app's levels
                      like any others: Esc and S (CANCEL, GO BACK I) take one step of the
                      app's own history — and leave the app, returning the space exactly as
                      it was, only when that history is already empty; D (GO BACK II) takes
                      up to two steps at once. The ring itself can be turned by hand: address
                      it — its item, or the annulus under the cursor — and the yaw and plane
                      keys (E R, B N) spin it; pitch and roll do not apply to a ring.
                    </p>
                    <p>
                      The Waveform app works a track the way the reference describes a waveform:
                      amplitude, frequency, phase, harmonics, an envelope of attack, decay,
                      sustain and release, and transients riding on top. On the stage the
                      AMPLITUDE stands as a fence of peaks over time — honest min/max buckets
                      of the samples, so zooming never invents detail. Behind it falls the
                      WATERFALL: frequency across, time into depth, energy as height — the
                      spectrogram made solid. Three composed tracks are on the ring's portals:
                      PULSE, a low fundamental and its harmonics under a slow swell, hit by
                      transients; VOICE, formant stacks in gated phrases, with silence between;
                      RAIN, seeded patter with weather in it. Zooming changes the zoom WITHIN
                      THE FRAME — C and V over the fence widen and narrow the window over the
                      samples, F on a hovered stretch drills into it — and the camera does not
                      move. D (GO BACK II) walks the window back out, up to two steps of
                      history at a time; Esc and S take the single step. Space plays; the
                      playhead crosses the fence.
                    </p>
                    <h4>The Operation</h4>
                    <p>
                      The mouse only points. Everything done is done by key, and the scheme is
                      whole: C and V dolly the camera out and in — there is deliberately no
                      scroll-wheel zoom, because the wheel is not a key-click. The dolly
                      moves the camera; the zoom changes the lens, and they feel different:
                      5 and 6 step the field through its named sizes — LONG, MEDIUM LONG,
                      MEDIUM, MEDIUM CLOSE, CLOSE — the camera itself not moving at all;
                      that is what makes it a zoom and not a dolly. Operations land
                      under the cursor when something there accepts them: pressed while a
                      citizen is hovered, the dolly runs toward that citizen instead of the
                      whole scene, and the rotate keys turn what the cursor addresses. While
                      a citizen stands open, C and V dolly on it whether the cursor still
                      hovers it or not — you travel toward the opened thing, which is how
                      you zoom in on it; MAGNIFY is the other way (the thing grows, you
                      stay). An
                      object is addressed by the cursor's hover or the Tab cycle; its letter
                      joins them only in label mode (Alt+L), which is off by default — and the
                      command line addresses everything by name. The addressed object is lit —
                      glow is address, here as everywhere in this environment — while context
                      stays glass.
                    </p>
                    <p>
                      The letter keys are the hands: E and R yaw the addressed object, Q and W
                      pitch it toward or away from you, T and Y roll it, Z and X magnify it —
                      enlarge it for examination while the rest of the space stays in place —
                      and B and N rotate it in its own plane, about its own normal, leaving
                      every other axis untouched. Every turn pivots at the centre of the
                      object's bounds, so a thing tumbles in place instead of swinging around
                      its base.
                      Each press is a small eased step; holding the key is a continuous motion.
                      The rotate keys resolve a target: a hovered citizen, then the ring
                      (which only spins), then the current citizen — and with nothing
                      addressed, the platter itself. On the platter the cluster turns the
                      whole space as the camera sees it — yaw about the camera's up, pitch
                      about its right, roll about its view axis — while B and N still spin
                      the platter in its own plane, inside those turns; the platter cannot be
                      magnified (C and V dolly the camera instead), and loading a named view
                      levels its turns again. F is the click: it flies you to a seat before the
                      object and stands its card in the space. The backs are events: S and Esc
                      come back one level, D up to two. F goes to the thing — the camera
                      flies, the thing stays home. I brings the thing to you: whatever you
                      address — object, library card, the tray itself — travels to the inspection
                      position before the camera, turns to face you at a legible size, and stands
                      its panel beside itself, while every other mode suspends. D or Esc sends it
                      back to its exact home, position, orientation and scale as they were. The
                      command line doubles as CAD's dynamic input: while a gesture runs it speaks
                      the live value being changed, and clears a breath after the gesture ends;
                      the typed command stays the exact-entry path. Gesture coarsely, line exactly.
                    </p>
                    <h4>The Keyboard Panel</h4>
                    <p>
                      The scheme is a full keyboard layout, not scattered hotkeys, and in the
                      bottom dock — its lower edge resting on the command line's top edge —
                      stands its living map: the KEYBOARD PANEL, a glass board resolved
                      afresh for every scope from the same sparse table the scopes themselves
                      use — in most scopes most keys bind nothing and their caps stand dim with
                      the bare glyph, and where a cap names a function, that is what the key
                      does here, now. In label mode the letter caps name their actual targets;
                      in the app they carry the transport; under a drag they shrink to the
                      four keys the lock leaves alive. The event caps are named by their
                      events — FINISH, GO BACK I, GO BACK II, CANCEL — and the rotate caps
                      name the target they would turn. What a cap says is what the key does,
                      because both are read from one database. The panel is glass because it
                      belongs to the picture plane, not the world — the scene ghosts through
                      it, and the last key you pressed lifts on it for a moment. Its head
                      carries a Collapse button that folds it down to the bar alone, and{" "}
                      <b>K</b> hides it (the PARAMETERS hold the same switch); its caps do not
                      click yet: they are a map, not a second set of controls.
                    </p>
                    <h4>Patching and Layouts</h4>
                    <p>
                      Patching is built in, after the patch-bay demo: with an object addressed, G
                      grows a live cable from it that follows the cursor; G again, F, A (FINISH),
                      or a click lands it on a second object, and the cable stays — a curved tube
                      between the two anchors with a pulse of light travelling it, data visibly
                      flowing between frames. J strips every cable touching the addressed object.
                      Layouts are the space's arrangements, loaded whole like nibglider's: 7 lays
                      the RING, 8 gathers the DISTRICTS — graphs, monitors and instruments in
                      their quarters — and 9 sets the THEATRE, the cube centre-stage under a
                      shallow arc of the rest. Switching eases every object to its new plot over a
                      breath; transforms and cables persist, and the cables follow their objects
                      as they travel.
                    </p>
                    <p>
                      The letters carry double duty, and the mode decides what they mean: inside
                      label mode they are addresses — G the tangled tree, M the living crystal,
                      E the sunburst cylinder, B the drum, N the tree, J the arch, C the tray.
                      Outside it, letters are operators: G patches, M opens the media library,
                      E yaws (and expands an app from the ring), H copies, J strips, C and V
                      zoom, A finishes, S and D go back. One letter, two lives, and the mode
                      is always visible — the chips are showing, or they are not. On the armed
                      command line the letters are characters again, and Enter is the finish
                      there: A cannot both type and finish, so the line keeps its own key.
                    </p>
                  </div>
                ) : null}
                {guideTab === "citizens" ? (
                  <div>
                    <p className="us-sub">Click a citizen to target it. Its letter is its label-mode address.</p>
                    {labeledObjects().map(({ object, label }) => (
                      <button
                        className="us-citizen-row"
                        key={object.id}
                        type="button"
                        onClick={(e) => { onSelect(object.id); e.currentTarget.blur(); }}
                      >
                        <span className="us-keycap">{label}</span>
                        <span className="us-citizen-name">{object.name}</span>
                        <span className="us-citizen-meta">{object.group} · {object.blurb}</span>
                      </button>
                    ))}
                    <p className="us-sub" style={{ marginTop: 12 }}>
                      On the ring — not citizens; they open. F centre-stage, E full platter.
                    </p>
                    {labeledRingItems().map(({ item, label }) => (
                      <button
                        className="us-citizen-row"
                        key={item.id}
                        type="button"
                        onClick={(e) => { onSelect(item.id); e.currentTarget.blur(); }}
                      >
                        <span className="us-keycap">{label}</span>
                        <span className="us-citizen-name">{item.name}</span>
                        <span className="us-citizen-meta">app · the ring · {item.blurb}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>

        <section className={`us-box us-overlay-panel us-params${paramsOpen ? "" : " collapsed"}`} data-testid="parameters-panel" aria-label="Parameters">
          <div className="us-panel-head">
            <h3>PARAMETERS</h3>
            <button
              type="button"
              className="us-panel-toggle"
              aria-expanded={paramsOpen}
              onClick={(e) => { setParamsOpen((v) => !v); e.currentTarget.blur(); }}
            >
              {paramsOpen ? "Collapse" : "Open"}
            </button>
          </div>
          {paramsOpen ? (
            <div className="us-params-body">
              <fieldset className="us-view-fieldset">
                <legend>VIEW</legend>
                <div className="us-view-btns">
                  {[["top", "PLAN"], ["front", "ELEVATION"], ["side", "SIDE"], ["home", "HOME"]].map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      className={`us-view-btn${viewName === view ? " here" : ""}`}
                      aria-pressed={viewName === view}
                      onClick={(e) => { goView(view); e.currentTarget.blur(); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <NCTParameterPanel definitions={PARAM_DEFS.filter((d) => d.group === "view")} values={values} onChange={onParam} />
              </fieldset>
              <NCTParameterPanel definitions={PARAM_DEFS.filter((d) => d.group !== "view")} values={values} onChange={onParam} />
            </div>
          ) : null}
        </section>

        <div className="us-bottomdock">
          {/* Slice 11 (§8): the keyboard panel is the dock's first
              child — its bottom edge sits directly on the status /
              command assembly's top edge in every state. */}
          {values.keyboardPanel !== false ? (
            <KeyboardPanel
              kb={kb}
              lastKey={lastKey}
              onHide={() => onParam("keyboardPanel", false)}
              collapsed={keyboardCollapsed}
              onToggleCollapse={() => setKeyboardCollapsed((v) => !v)}
            />
          ) : null}
          <div className="us-statusbar" data-testid="space-status">
            <span className="mode">{mode}</span>
            <span className="context">{nextText}</span>
            {dynText ? <span className="dyn">{dynText}</span> : null}
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
            data-testid="command-bar"
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
      </div>
    </div>
  );
}
