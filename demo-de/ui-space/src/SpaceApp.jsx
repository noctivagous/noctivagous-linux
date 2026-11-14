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
  resolveFAction,
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
import { buildDataTree, dataBranchById } from "./lsystems.js";
import { FLARE } from "../../src/sunburst-data.js";

// Slice 7: the data tree's own bookkeeping for panels and readout —
// the same buildDataTree(FLARE) the view grows in the scene
// (deterministic, so the two builds agree node for node).
const DATA_TREE = buildDataTree(FLARE);

import {
  NCTParameterPanel,
  useNCTParameters,
} from "../../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";

/**
 * UI Space — an early form of the environment.
 *
 * Twelve of the lab's frames stand on one platter as miniature
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
 * Space plays, 1/2 zoom inside the app's own frame, F activates
 * and drills, D steps back through the app's own history, and
 * Esc leaves the app altogether (the big back).
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
  { id: "ambientMotion", label: "Ambient motion", type: "boolean", defaultValue: true },
  { id: "labelsOn", label: "Key labels", type: "boolean", defaultValue: true },
  { id: "snap", label: "Snap", type: "boolean", defaultValue: true },
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
  { key: "E", label: "app · full platter" },
  { key: "Tab", label: "cycle" },
  { key: "1 / 2", label: "zoom out · in" },
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

/** The whole key-click scheme, grouped by function for the guide. */
const KEY_GROUPS = [
  {
    title: "Address & enter",
    rows: [
      ["hover", "the object under the cursor is the addressee"],
      ["Tab", "cycle everything addressable (Shift+Tab back)"],
      ["F", "open the addressed object — its card stands in space"],
      ["F on the ring", "opens the Waveform app onto the centre stage"],
      ["E", "open the addressed app across the whole platter, citizens hidden"],
      ["D", "back one level: part → patch → card → selection"],
      ["Esc", "release a level; cancels a drag before it drops"],
      ["Alt+L", "label mode — letter chips appear, bare letters target"],
    ],
  },
  {
    title: "Turn & carry",
    rows: [
      ["- =", "yaw the addressed object"],
      ["[ ]", "pitch it"],
      ["; '", "roll it"],
      [". /", "scale it"],
      ["Space", "pick the addressed object up / press again to drop"],
      ["X / Z", "in a drag: lock movement to that world axis"],
    ],
  },
  {
    title: "Camera & layouts",
    rows: [
      ["1", "zoom out — there is no scroll-wheel zoom"],
      ["2", "zoom in — and no mouse orbit"],
      ["3 4 5", "layouts: RING · DISTRICTS · THEATRE"],
      ["v › t/f/s/h", "named views on the command line: top · front · side · home"],
    ],
  },
  {
    title: "Patch, media & clipboard",
    rows: [
      ["G", "start a patch from the addressed object; G / F / click lands it"],
      ["X", "strip every cable touching the addressed object"],
      ["M", "open / close the media library on the XY wall"],
      ["C", "copy the addressed thing to the clipboard"],
      ["I", "inspect the addressed thing — it comes to you"],
      ["Alt+0", "summon / dismiss the clipboard tray"],
      ["Alt+1 2 3", "layer visibility: DATA / INSTRUMENTS / SCENERY"],
    ],
  },
  {
    title: "Modes & the command line",
    rows: [
      ["Enter", "arm the command line: category › action › argument, ⏎ runs"],
      ["Alt+L", "in label mode G is the tangled tree, M the living crystal and E the sunburst cylinder; outside it G patches, M opens the library and E expands an app"],
      ["C / I", "here I inspects and C copies — KeyPilot's stock I-copy lives on C in this layout"],
      ["F on a card / tray", "inspects it, like I"],
      ["knot parts", "with the knot current, hover a part — F zooms into it, D backs out to the knot"],
      ["tree branches", "with the tree current, hover a depth-1 branch — F zooms to the subtree, D backs out to the tree"],
    ],
  },
  {
    title: "In an open app",
    rows: [
      ["Space", "play / pause — the drag lock waits outside the app"],
      ["1 / 2", "zoom the window inside the waveform's own frame — the camera stays"],
      ["F", "activate the addressed ring token; on the waveform, drill into the hovered stretch"],
      ["Tab", "cycle the stage and the app's ring tokens"],
      ["D", "back one step in the app's own history (drills, track changes, zoom-token steps)"],
      ["E", "expand a centre-stage app to the whole platter"],
      ["Esc", "leave the app — the big back, home again"],
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
.us-guide { left:12px; bottom:118px; width:min(404px, calc(100vw - 24px)); max-height:min(500px, calc(100dvh - 500px)); }
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
  // Slice 7: the data tree's depth-1 branch under the cursor while
  // the tree is current — the branch analogue of partHoverId, and
  // branch focus reuses the partFocus state above ({objectId:
  // "tree", partId: the depth-1 node's id}).
  const [branchHoverId, setBranchHoverId] = useState(null);
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
  const camSnapshot = useRef(null);
  const [dynText, setDynText] = useState("");
  const dynTimer = useRef(null);
  // The overlay shell: parameters and the guide are stationary
  // panels over the scene, each collapsible on its own head.
  const [paramsOpen, setParamsOpen] = useState(true);
  const [guideOpen, setGuideOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 1400,
  );
  const [guideTab, setGuideTab] = useState("brief");

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
    objectById(id)?.name || ringItemById(id)?.name || TOKEN_NAMES[id] || mediaById(id)?.title ||
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

  // Part/branch focus belongs to its object being current: if the
  // current thing changes away from the focused object, the focus
  // ends. The D/Esc chain treats both at ONE level (see doBack):
  // sub-address focus → patch → card → selection.
  useEffect(() => {
    if (currentId !== "knot") setPartHoverId(null);
    if (currentId !== "tree") setBranchHoverId(null);
    setPartFocus((f) => (f.partId && f.objectId !== currentId ? endPartFocus() : f));
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
    setAppFocusId("stage");
    setTokenHoverId(null);
    setRegionHover(null);
    if (lockRef.current) lockCancel();
    sharedRef.current.audioPos = audio.window.start;
    touch();
  };

  const closeAudioApp = () => {
    // Esc — the big back. Play pauses, the citizens return (in
    // full mode they were hidden), the camera seat is restored,
    // and the space is exactly as it was, with the ring's app
    // item current, where the whole excursion began.
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

  const appBack = () => {
    // D inside the app walks the APP's history — drills, track
    // changes, zoom-token steps — and nothing else. An empty
    // stack is a note, not a fall-through to the space's chain:
    // app scope owns D while the app holds the stage.
    const { stack, entry } = popNav(audio.nav);
    if (!entry) {
      setEcho({ text: "the app has no further back — Esc leaves the app", error: true });
      return;
    }
    setAudio((a) => ({ ...a, nav: stack, trackId: entry.trackId, window: entry.window }));
    sharedRef.current.audioPos = entry.window.start;
    touch();
  };

  const onTokenHover = (id) => {
    setTokenHoverId(id);
    if (id) setAppFocusId(id);
  };

  const completePatch = (from, to) => {
    // The ring's apps open; they do not take cables.
    if (ringItemById(from) || ringItemById(to)) {
      setPendingId(null);
      setEcho({ text: "the ring's apps open — they don't take cables", error: true });
      return;
    }
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
    // While an app holds the stage, citizen clicks wait — the
    // stage, its tokens and its keys own the interaction.
    if (openAppState.appId) return;
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
    // Slice 8 first: an app-bearing thing (the ring's Waveform)
    // OPENS instead of entering — F takes it to the centre stage.
    // A live patch keeps its F: the patch completes onto the
    // addressed target, as it always has.
    if (!pendingId) {
      const open = resolveOpenAction({
        targetId: addressedId(hoverId, currentId), key: "f", labelMode: uiMode.labelMode,
      });
      if (open) { openAudioApp(open.mode); return; }
    }
    // F lands on the ADDRESSED thing: hover wins, current is the
    // fallback. The decision itself is pure (resolveFAction in
    // space-state.js) and every branch below works from the local
    // action — never from a state value it just asked React to set.
    const action = resolveFAction({
      pendingId,
      hoverId,
      currentId,
      partId: partHoverId && partById(partHoverId) ? partHoverId : null,
      branchId: branchHoverId && dataBranchById(DATA_TREE, branchHoverId) ? branchHoverId : null,
      inspectIds: [...MEDIA_IDS, "clipboard"],
    });
    switch (action.type) {
      case "completePatch":
        completePatch(pendingId, action.targetId);
        return;
      case "partFocus":
        // F on a hovered part of the knot zooms INTO the part —
        // the part focus, one level deeper than entering the knot.
        setCurrentId(action.targetId);
        setPartFocus(beginPartFocus(partFocus, action.targetId, action.partId));
        setCardId(null);
        return;
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
  const doBack = () => {
    // The release chain: a sub-address focus (a knot part, a tree
    // branch — one level, one state) backs out to its object
    // first, then a live patch, then the entered card, then the
    // selection.
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
    // No patch live: G starts from the ADDRESSED object — hover
    // wins, as it does for F — and the source becomes current.
    const source = addressedId(hoverId, currentId);
    if (source && ringItemById(source)) {
      setEcho({ text: "Waveform opens — F centre-stage, E full platter; it does not patch", error: true });
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
    // Inspection is for citizens, cards and the tray — the ring's
    // items open instead (F/E), so they never reach the snapshot.
    if (!objectById(id) && !isMediaId(id) && id !== "clipboard") return;
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
      // APP SCOPE (slice 8): while an app holds the stage, the
      // keys are the app's. The command line (above) and Alt+L
      // still work — the line stays live and label mode still
      // toggles — but the space's manipulation keys suspend:
      // Space is the transport, not the drag lock; 1/2 zoom the
      // window inside the app's frame, not the camera; the
      // transform keys do nothing (the app is not a citizen).
      // Esc here sits after the command line's walk-back (its
      // machine consumed Esc above) and before the space's
      // release chain below: Esc is the big back, D the app's.
      if (openAppState.appId) {
        const k = e.key;
        if (k === "Escape") { e.preventDefault(); closeAudioApp(); return; }
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
        if (k === "1" || k === "2") {
          e.preventDefault();
          const t = makeTrack(audio.trackId);
          const w = audio.window;
          const pos = sharedRef.current.audioPos ?? w.start;
          const frac = Math.max(0, Math.min(1, (pos - w.start) / Math.max(0.001, w.end - w.start)));
          const nw = windowZoom(w, k === "1" ? 1.6 : 1 / 1.6, frac, t.seconds);
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
        if (k === "d" || k === "D") { e.preventDefault(); appBack(); return; }
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
        // Esc order: an axis lock releases first, then the drag
        // cancels (nothing was committed), then label mode, then
        // the release chain (focus → patch → card → selection). The
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
      if (e.key === "1") { e.preventDefault(); setZoomMul((m) => zoomStep(m, -1)); return; }
      if (e.key === "2") { e.preventDefault(); setZoomMul((m) => zoomStep(m, 1)); return; }
      if (LAYOUT_KEYS[e.key]) {
        e.preventDefault();
        setSpace((s) => applyLayout(s, LAYOUT_KEYS[e.key]));
        return;
      }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); doF(); return; }
      if (e.key === "e" || e.key === "E") {
        // E expands an app across the whole platter — an operator
        // OUTSIDE label mode only (resolveOpenAction refuses it
        // inside, where letters are addresses); with no app
        // addressed it falls through, and in label mode the letter
        // targeting below picks E up as the cylinder's address.
        const open = resolveOpenAction({
          targetId: addressedId(hoverId, currentId), key: "e", labelMode: uiMode.labelMode,
        });
        if (open) { e.preventDefault(); openAudioApp(open.mode); return; }
      }
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
    openAppState, audio, tokenHoverId, appFocusId, regionHover, viewName]);

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
    : openAppState.appId ? (openAppState.mode === "full" ? "APP FULL — WAVEFORM" : "APP — WAVEFORM")
    : partFocus.partId
      ? partFocus.objectId === "tree"
        ? `BRANCH FOCUS — ${dataBranchById(DATA_TREE, partFocus.partId)?.name || ""}`
        : `PART FOCUS — ${partById(partFocus.partId)?.name || ""}`
    : cardId ? "ENTERED — the card is open"
    : uiMode.labelMode ? "LABEL MODE"
    : currentId ? "TARGETED"
    : "AT REST";
  const focusPart = partFocus.partId && partFocus.objectId !== "tree" ? partById(partFocus.partId) : null;
  const focusBranch = partFocus.partId && partFocus.objectId === "tree"
    ? dataBranchById(DATA_TREE, partFocus.partId) : null;
  const addressedName = thingName(addressedId(hoverId, currentId));
  const audioTrack = makeTrack(audio.trackId);
  const nextText = inspection.inspectedId
    ? `${thingName(inspection.inspectedId)} is at the inspection position — D / Esc sends it home`
    : dragLock
      ? `carrying ${thingName(dragLock.id)} — move the cursor, Space drops, Esc cancels`
      : pendingId
        ? `patch live from ${pending?.name || thingName(pendingId)} — address a second thing, then G / F / click`
        : openAppState.appId
          ? `${audioTrack.name} holds the stage — Space ${audio.playing ? "pauses" : "plays"} · F drills the hovered stretch · D steps back · Esc leaves the app`
          : partFocus.partId
          ? partFocus.objectId === "tree"
            ? `${focusBranch?.name || "branch"} focused — D backs out to the tree`
            : `${focusPart?.name || "part"} focused — D backs out to the knot`
          : cardId
            ? `${thingName(cardId)} is open — D flies back to the world seat`
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
    if (id === "tree") {
      const o = objectById(id);
      return {
        title: o.name,
        lines: [
          `kind — object · ${o.group} · a grown dataset`,
          `total value — ${DATA_TREE.totalValue}`,
          `leaves — ${DATA_TREE.leafCount} · depth ${DATA_TREE.maxDepth} · ${DATA_TREE.branches.length} branches`,
          "grown from the flare hierarchy by L-system rules",
          "depth-1 branches are sub-addresses — hover one, F zooms to the subtree",
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
            pastes={pastes}
            inspectPanel={inspectPanel}
            openApp={openAppState}
            audio={audio}
            tokenHoverId={tokenHoverId}
            appFocusId={appFocusId}
            regionHover={regionHover}
            sharedRef={sharedRef}
            onHover={onHover}
            onPartHover={onPartHover}
            onBranchHover={onBranchHover}
            onTokenHover={onTokenHover}
            onTokenActivate={activateToken}
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
            <span className="k">ZOOM</span>{"     "}distance ×{zoomMul.toFixed(2)}{"\n"}
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
                <span className="k">SCALE</span>{"    "}{tr.scale.toFixed(2)}×{"\n"}
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
            <span className="k">LIBRARY</span>{"  "}{libraryOpen ? "OPEN" : "CLOSED"} · {MEDIA_ITEMS.length} items{"\n"}
            <span className="k">CLIPBOARD</span>{" "}{clipboardTitle(clip) || "—"}{"\n"}
            {lastPaste ? (
              <>
                <span className="k">PASTE</span>{"    "}CLIPBOARD → {thingName(lastPaste.targetId)}: {lastPaste.item.title}{"\n"}
              </>
            ) : null}
            {openAppState.appId ? (
              <>
                <span className="k">APP</span>{"      "}Waveform · {openAppState.mode === "full" ? "FULL PLATTER" : "CENTRE STAGE"} · {audioTrack.name}{"\n"}
                <span className="k">WINDOW</span>{"   "}{audio.window.start.toFixed(1)}–{audio.window.end.toFixed(1)}s of {audioTrack.seconds}s · {audio.playing ? "PLAYING" : "paused"}{audio.loop ? " · LOOP" : ""} · back-stack {audio.nav.length}{"\n"}
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
                      turn the addressed object with <b>-</b> <b>=</b> <b>[</b> <b>]</b> <b>;</b>{" "}
                      <b>'</b>, scale it with <b>.</b> <b>/</b>, patch it to another with <b>G</b>,
                      pick it up with a <b>Space</b> press (press again to drop), and rearrange
                      the whole space with the layouts on <b>3</b> <b>4</b> <b>5</b>.
                    </p>
                    <p>
                      Key labels are opt-in: <b>Alt+L</b> shows the letter chips and makes letters
                      into addresses. The command line at the foot of the scene — <b>Enter</b> arms
                      it. <b>M</b> opens the MEDIA LIBRARY on the XY wall; <b>C</b> copies the
                      addressed thing to the clipboard, <b>I</b> inspects it, and <b>Alt+0</b>
                      summons the clipboard tray.
                    </p>
                    <p>
                      The platter wears a <b>ring</b> now, and the ring carries the first app:
                      <b>Waveform</b>, for audio. Address it and <b>F</b> opens it onto the centre
                      stage; <b>E</b> opens it across the whole platter. Inside the app the keys
                      change scope: <b>Space</b> plays, <b>1</b> and <b>2</b> zoom inside the
                      waveform's own frame, <b>D</b> steps back through the app's history, and
                      <b>Esc</b> leaves the app altogether.
                    </p>
                    <p>
                      <b>FIG. 1</b> — The space at rest in the RING layout: twelve miniature frames
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
                      of flare, the tray's cuboids are the binary treemap, the cube's faces carry
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
                      render, index, queue, store, sync, egress), the tube's thickness the size of
                      what the part holds, a bright core ghosting through the glass. Make the knot
                      current and its parts become addresses: hover one to name it, and F zooms
                      the camera into that part of the curve to read what it carries. D backs out
                      to the knot again. Two further knots stand on pedestals at the rim as pure
                      atmosphere — a (4,3) torus knot and a cinquefoil — turning slowly, holding
                      nothing, there for the feel of the place. Knot forms after the classic
                      torus-knot parametrizations; see Stemkoski's Parameterized Knots gallery.
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
                      DATA TREE, flare's hierarchy generating the branching directly — each
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
                      like citizens and worked with F. Esc goes back in a big way: it leaves
                      the app and returns the space exactly as it was. D goes back only inside
                      the app: one step of the app's own history at a time.
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
                      THE FRAME — 1 and 2 widen and narrow the window over the samples, F on a
                      hovered stretch drills into it — and the camera does not move. D walks
                      the window back out, one step of history at a time. Space plays; the
                      playhead crosses the fence.
                    </p>
                    <h4>The Operation</h4>
                    <p>
                      The mouse only points. Everything done is done by key, and the scheme is
                      whole: 1 and 2 move the camera in and out — there is deliberately no
                      scroll-wheel zoom, because the wheel is not a key-click. An object is
                      addressed by the cursor's hover or the Tab cycle; its letter joins them
                      only in label mode (Alt+L), which is off by default — and the command line
                      addresses everything by name. The addressed object is lit — glow is address,
                      here as everywhere in this environment — while context stays glass.
                    </p>
                    <p>
                      The punctuation keys are the hands: - and = yaw it on its plot, [ and ]
                      pitch it toward or away from you, ; and ' roll it, . and / scale it, each
                      press a small eased step, holding the key a continuous motion. F is the
                      click: it flies you to a seat before the object and stands its card in the
                      space. D comes back, one level at a time. F goes to the thing — the camera
                      flies, the thing stays home. I brings the thing to you: whatever you
                      address — object, library card, the tray itself — travels to the inspection
                      position before the camera, turns to face you at a legible size, and stands
                      its panel beside itself, while every other mode suspends. D or Esc sends it
                      back to its exact home, position, orientation and scale as they were. The
                      command line doubles as CAD's dynamic input: while a gesture runs it speaks
                      the live value being changed, and clears a breath after the gesture ends;
                      the typed command stays the exact-entry path. Gesture coarsely, line exactly.
                    </p>
                    <h4>Patching and Layouts</h4>
                    <p>
                      Patching is built in, after the patch-bay demo: with an object addressed, G
                      grows a live cable from it that follows the cursor; G again, F, or a click
                      lands it on a second object, and the cable stays — a curved tube between the
                      two anchors with a pulse of light travelling it, data visibly flowing between
                      frames. X strips every cable touching the addressed object. Layouts are the
                      space's arrangements, loaded whole like nibglider's: 3 lays the RING, 4
                      gathers the DISTRICTS — graphs, monitors and instruments in their quarters —
                      and 5 sets the THEATRE, the cube centre-stage under a shallow arc of the
                      rest. Switching eases every object to its new plot over a breath; transforms
                      and cables persist, and the cables follow their objects as they travel.
                    </p>
                    <p>
                      Three letters carry double duty, and the mode decides what they mean: G, M
                      and E are addresses only inside label mode — there G is the tangled tree,
                      M the living crystal and E the sunburst cylinder. Outside it, letters are
                      operators: G patches, M opens the media library, and E expands an app
                      across the whole platter.
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
              <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={onParam} />
            </div>
          ) : null}
        </section>

        <div className="us-bottomdock">
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
