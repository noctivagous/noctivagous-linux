import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { scaleLinear } from "d3-scale";
import {
  buildSunburst,
  descendants as sunburstDescendants,
  sunburstColourScale,
} from "../../NCTGraphite/packages/nctgraphite/src/sunburst/NCTGraphiteSunburstLayout.ts";
import {
  buildTreemap,
  descendants as treemapDescendants,
  treemapCubeFaces,
  treemapHouseColor,
} from "../../NCTGraphite/packages/nctgraphite/src/treemap/NCTGraphiteTreemapLayout.ts";
import { TANGLE_PALETTE } from "../../NCTGraphite/packages/nctgraphite/src/tangle/NCTGraphiteTangleLayout.ts";
import {
  SCHEME_GREENS,
  SCHEME_BLUES,
  horizonBandColor,
} from "../../NCTGraphite/packages/nctgraphite/src/horizon/NCTGraphiteHorizon.ts";
import { HIERARCHY } from "./hierarchy.js";
import {
  ENVIRONMENT,
  deviceList,
  deviceBySlug,
  printerOf,
  queueTotals,
  connectionsOf,
  connectionIds,
  connectionBytes,
  connectionTotals,
  cableRadiusForBytes,
  cableGlowForBytes,
  formatBytes,
  ENV_TOTALS,
} from "./environment.js";
import { SPACE_LANES } from "./horizon-lanes.js";
import {
  OBJECTS,
  OBJECT_IDS,
  objectById,
  labeledObjects,
  labeledRingItems,
  ringItemById,
  ringItemPosition,
  RING_R,
  PLATTER_R,
  GROUND_Y,
  PLATTER_WELL_R,
  PROTECTIVE_CLEARANCE,
  CENTRE_Y,
  socketCircles,
  clampGround,
  glowLevel,
  inspectScaleFor,
  viewSeat,
  citizenSeatOffsets,
  FIELD_SIZES,
  FIELD_DEFAULT_INDEX,
  snapGroundPoint,
  axisLockPoint,
  isAddressable,
  displayRootOf,
  bookAccessedId,
  bookPageOutId,
} from "./space-state.js";
import { buildPlatterSolid } from "./platter-top.js";
import { subnodeById, subnodeRootOf, hierarchyDataOf, tangleLevels } from "./subnodes.js";
import { bookTable, bookSpreads, bookNodeById, BOOK_TOTALS, SPREAD_COUNT } from "./book.js";
import {
  makeTrack,
  peaksForWindow,
  bandEnergies,
  REGION_ZONES,
} from "./waveform.js";
import { MEDIA_ITEMS, mediaById, labeledMedia } from "./media-library.js";
import {
  KNOT_FORMS,
  KNOT_PARTS,
  torusKnotPoint,
  partMidT,
  radiusFor,
  partById,
  partShare,
} from "./knots.js";
import { tubeAlong } from "./sweeps.js";
import {
  buildCrystal,
  formPlanes,
  solidFromForms,
  distanceForValue,
  FACE_DATA,
} from "./crystals.js";
import {
  buildBotanicalTree,
  buildDataTree,
  createRng,
} from "./lsystems.js";

/**
 * UI Space — SpaceView: the R3F scene.
 *
 * Fourteen miniature frames stand on the platter as citizens of one
 * space. The scene is declared (one component per object, cables as
 * components), and ONE useFrame driver (the Rig) eases every
 * displayed value toward the pure state in space-state.js: object
 * positions (layout flights and drags), yaw/pitch/roll/scale, the
 * parametric camera (home seat from the parameters and the C/V dolly,
 * or a close seat before the entered object), the turntable rest,
 * and the glow. A sibling rAF loop projects the DOM overlay — key
 * chips, compass, name tag, the entered object's card — from the
 * same frame snapshot.
 *
 * The visual language maps to meaning: GLOW is address in two
 * tiers — hovered is a highlight only, selected/entered is the
 * full glow, held while the object is current; cable pulses are
 * bright; ordinary objects stay matte. The key chips ride the
 * overlay only when the App passes labelsOn, which it does solely
 * in label mode (Alt+L) — labels are opt-in. TRANSLUCENCY is
 * layers and attention (level sheets, the arch sheet, tray and drum
 * and cube shells are glass, so contents ghost through); the
 * addressed object stays solid.
 *
 * Slice 8 adds the RING around the platter (a glass annulus that
 * turns slowly at rest, carrying the Waveform app's token) and
 * the STAGE the app opens onto: a dais at the platter's centre
 * (centre mode) or the whole platter (full mode, citizens
 * hidden), holding the waveform fence and the spectrogram
 * waterfall. While the app is open the ring stops and carries
 * the app's own furniture instead — transport, track portals,
 * zoom and loop tokens. The ring and the stage live in the
 * INSTRUMENTS stratum with the wall and the tray.
 */

export const COMPASS = [
  { t: "N", x: 0, z: -PLATTER_R + 17 },
  { t: "S", x: 0, z: PLATTER_R - 17 },
  { t: "W", x: -PLATTER_R + 17, z: 0 },
  { t: "E", x: PLATTER_R - 17, z: 0 },
];

/** Height of each miniature's cable anchor / chip point, at scale 1. */
export const ANCHOR_H = {
  mesa: 16, drum: 24, tray: 10, cube: 36, tangle: 26,
  horizon3d: 16, horizonflat: 28, arch: 32, definition: 18, knot: 26, crystal: 32,
  tree: 30, book: 28, devices: 16,
};

/* CENTRE_Y — each citizen's rotation pivot, the midpoint of
   its built height range — lives in space-state.js, beside the
   socket table that consumes it; it is imported above. */

/**
 * Slice 11 (§11): each citizen's PLANE AXIS — the normal of the
 * plane the miniature actually lies in, as built, about which
 * B/N plane-rotate turns it (in its local frame, inside the
 * tumble). Most citizens are XZ-plane shapes (normal = local Y):
 * discs, trays, towers, the knot (its torus axis maps to Y), the
 * arch (a cylinder segment about the Y axis — its circle is XZ),
 * the tangle (horizontal level sheets on an XZ base), the crystal
 * (equator in XZ) and the tree (XZ footprint, growing +Y). Two
 * stand in XY (normal = local Z): the flat horizon panel, and
 * the definition — its node slabs face +Z, thin in z, spread in
 * x and y like the canvas they miniaturise.
 */
export const PLANE_AXIS = {
  mesa: "y", drum: "y", tray: "y", cube: "y", tangle: "y",
  horizon3d: "y", horizonflat: "z", arch: "y", definition: "z",
  knot: "y", crystal: "y", tree: "y", book: "y", devices: "y",
};

const DEG = Math.PI / 180;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const damp = THREE.MathUtils.damp;

/* ---------- the XY datum wall, the library cabinet, the tray ---------- */

/** The XY datum plane: a glass sheet at the platter's back (the N
 *  side), parallel to the picture plane. The library lives on it. */
export const WALL = { z: -196, w: 368, h: 164, cy: 82 };
export const CABINET = { w: 176, h: 106, d: 16, cy: 64, z: -188 };

/** A card's home: out on the wall in a 4×2 grid when the library
 *  is open; withdrawn into the cabinet (smaller, behind the door)
 *  when it is closed. */
export function cardSlot(i, open) {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return open
    ? { x: (col - 1.5) * 39, y: 92 - row * 33, z: -174, scale: 1 }
    : { x: (col - 1.5) * 30, y: 88 - row * 28, z: -188, scale: 0.5 };
}

export const TRAY_HOME = { x: 0, y: 0, z: 166 };
export const TRAY_PARKED = { x: 0, y: -95, z: 235 };

export function thingName(id) {
  return objectById(id)?.name || ringItemById(id)?.name || mediaById(id)?.title ||
    (id === "clipboard" ? "Clipboard" : "");
}

/* Generated card art — no external images. A coloured panel by the
 * item's hue with a seeded pattern and its initials; a text card
 * gets ruled lines of its body instead. */
const _texCache = new Map();
const _seed = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export function cardTexture(card) {
  const key = `${card.kind}:${card.hash}`;
  if (_texCache.has(key)) return _texCache.get(key);
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 184;
  const g = cv.getContext("2d");
  if (card.kind === "text") {
    g.fillStyle = "#18222b"; g.fillRect(0, 0, 256, 184);
    g.strokeStyle = "rgba(127,212,193,.25)";
    for (let y = 52; y < 170; y += 16) { g.beginPath(); g.moveTo(14, y); g.lineTo(242, y); g.stroke(); }
    g.fillStyle = "#ffa726"; g.font = "600 19px 'IBM Plex Mono', monospace";
    g.fillText(card.title.slice(0, 22), 14, 30);
    g.fillStyle = "#cfd8dc"; g.font = "13px 'IBM Plex Mono', monospace";
    const words = String(card.body || "").split(/\s+/);
    let line = "", ly = 66;
    for (const w of words) {
      if ((line + " " + w).length > 30) { g.fillText(line, 14, ly); ly += 16; line = w; if (ly > 168) break; }
      else line = line ? line + " " + w : w;
    }
    if (ly <= 168 && line) g.fillText(line, 14, ly);
    g.fillStyle = "#5f737c"; g.font = "600 11px 'IBM Plex Mono', monospace";
    g.fillText("TEXT CARD — COPIED FROM AN OBJECT", 14, 178);
  } else {
    const hue = card.hue ?? 200;
    g.fillStyle = `hsl(${hue} 42% 30%)`; g.fillRect(0, 0, 256, 184);
    let s = _seed(card.hash);
    const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    g.fillStyle = `hsla(${hue + 40} 60% 65% / .35)`;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(rnd() * 256, rnd() * 150, 14 + rnd() * 34, 0, 7); g.fill(); }
    g.fillStyle = `hsla(${hue} 30% 12% / .35)`;
    for (let i = 0; i < 5; i++) g.fillRect(0, 18 + i * 30 + rnd() * 8, 256, 5);
    const initials = card.title.split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
    g.fillStyle = "rgba(255,255,255,.88)"; g.font = "600 84px 'Barlow Condensed', sans-serif";
    g.textAlign = "center"; g.fillText(initials, 128, 112); g.textAlign = "left";
    g.fillStyle = "rgba(5,10,12,.72)"; g.fillRect(0, 148, 256, 36);
    g.fillStyle = "#e8f3ee"; g.font = "500 16px 'Barlow Condensed', sans-serif";
    g.fillText(card.title.slice(0, 30), 12, 171);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  _texCache.set(key, tex);
  return tex;
}

function plateTexture(text) {
  const key = `plate:${text}`;
  if (_texCache.has(key)) return _texCache.get(key);
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 56;
  const g = cv.getContext("2d");
  g.fillStyle = "#10161a"; g.fillRect(0, 0, 512, 56);
  g.strokeStyle = "rgba(255,167,38,.7)"; g.strokeRect(2, 2, 508, 52);
  g.fillStyle = "#ffa726"; g.font = "600 30px 'Barlow Condensed', sans-serif";
  g.textAlign = "center"; g.fillText(text.split("").join(" "), 256, 39);
  const tex = new THREE.CanvasTexture(cv);
  _texCache.set(key, tex);
  return tex;
}

/** A spread leaf's page number, as a small amber plate at its foot. */
function pageNumberTexture(n) {
  const key = `pageno:${n}`;
  if (_texCache.has(key)) return _texCache.get(key);
  const cv = document.createElement("canvas");
  cv.width = 96; cv.height = 96;
  const g = cv.getContext("2d");
  g.fillStyle = "#10161a"; g.fillRect(0, 0, 96, 96);
  g.strokeStyle = "rgba(255,167,38,.7)"; g.strokeRect(3, 3, 90, 90);
  g.fillStyle = "#ffa726"; g.font = "600 46px 'Barlow Condensed', sans-serif";
  g.textAlign = "center"; g.fillText(String(n), 48, 63);
  const tex = new THREE.CanvasTexture(cv);
  _texCache.set(key, tex);
  return tex;
}

function emptyTexture() {
  const key = "plate:empty";
  if (_texCache.has(key)) return _texCache.get(key);
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 184;
  const g = cv.getContext("2d");
  g.fillStyle = "#131a1e"; g.fillRect(0, 0, 256, 184);
  g.strokeStyle = "rgba(143,163,171,.5)"; g.setLineDash([6, 6]); g.strokeRect(10, 10, 236, 164);
  g.fillStyle = "#8fa3ab"; g.font = "600 30px 'Barlow Condensed', sans-serif";
  g.textAlign = "center"; g.fillText("E M P T Y", 128, 104);
  const tex = new THREE.CanvasTexture(cv);
  _texCache.set(key, tex);
  return tex;
}

/* ---------- geometry library: the real layouts, miniaturised ---------- */

function sectorGeometry(x0, x1, y0, y1, ring, base, height, gapA = 0.008, gapR = 0.35) {
  const a0 = x0 + Math.min((x1 - x0) / 2, gapA);
  const a1 = x1 - Math.min((x1 - x0) / 2, gapA);
  if (a1 - a0 < 0.002) return null;
  const r0 = Math.max(0, y0 * ring);
  const r1 = Math.max(r0 + 0.4, y1 * ring - gapR);
  const top = base + height;
  const segs = Math.max(1, Math.min(40, Math.ceil((a1 - a0) / (Math.PI / 24))));
  const pos = [];
  const pt = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
  const quad = (p1, p2, p3, p4) => { pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4); };
  for (let i = 0; i < segs; i++) {
    const t0 = a0 + ((a1 - a0) * i) / segs;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
    if (r0 < 0.75) pos.push(...pt(0, 0, top), ...pt(t0, r1, top), ...pt(t1, r1, top));
    else quad(pt(t0, r0, top), pt(t0, r1, top), pt(t1, r1, top), pt(t1, r0, top));
    quad(pt(t0, r1, top), pt(t0, r1, base), pt(t1, r1, base), pt(t1, r1, top));
    if (r0 >= 0.75) quad(pt(t0, r0, base), pt(t0, r0, top), pt(t1, r0, top), pt(t1, r0, base));
    if (i === 0) quad(pt(t0, r0, base), pt(t0, r1, base), pt(t0, r1, top), pt(t0, r0, top));
    if (i === segs - 1) quad(pt(t1, r0, top), pt(t1, r1, top), pt(t1, r1, base), pt(t1, r0, base));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Slice 12 — a layout node's provider id: its name path from the
 * hierarchy's root, joined with "/" — the same id subnodes.js
 * computes from the raw data, so the View's picking and the App's
 * provider name one node. For a descended rebuild the walk stops
 * at the LOCAL root; the caller prefixes the display root's true
 * id. (Slice 13: the hierarchy is the repository itself, so the
 * ids are repo paths.)
 */
function hierarchyPathId(node) {
  const names = [];
  let n = node;
  while (n) {
    names.push(n.data ? n.data.name : n.name);
    n = n.parent;
  }
  return names.reverse().join("/");
}

/**
 * Slice 12 — a sunburst wedge set built from an arbitrary root:
 * the descent rebuild. Same builders, same geometry, same colour
 * rule (the scale is taken over the given root's children, as
 * the standalone pages re-root) — only the root differs. Wedges
 * carry LOCAL path ids; the caller prefixes the display root's
 * true id to recover provider ids.
 */
function buildWedgeSet(rootData, kind) {
  const root = buildSunburst(rootData);
  const colour = sunburstColourScale(root.children.map((c) => c.name));
  const out = [];
  for (const n of sunburstDescendants(root)) {
    if (n.depth < 1 || n.depth > 2) continue;
    const geo = kind === "mesa"
      ? sectorGeometry(n.x0, n.x1, n.y0, n.y1, 8.5, 0, n.depth === 1 ? 12 : 6.5)
      : sectorGeometry(n.x0, n.x1, n.y0, n.y1, 8.5, 0, 20);
    if (geo) out.push({ geo, color: colour(n), node: n, id: hierarchyPathId(n) });
  }
  return out;
}

/**
 * One tangled-tree course made spatial (slice 13): the figures
 * stand on level sheets, parents linked by line segments. The
 * genealogy and the import graph share this builder — only the
 * levels differ. Levels are centred on z, so a course with more
 * or fewer sheets than the genealogy's seven still stands
 * centred on its platter.
 */
function buildTangleSet(levels) {
  const pos = new Map();
  levels.forEach((level, li) => {
    const n = level.length;
    level.forEach((node, i) => {
      const spread = n <= 1 ? 0 : Math.min(6.4, 44 / (n - 1));
      pos.set(node.id, {
        id: node.id,
        x: (i - (n - 1) / 2) * spread,
        y: 2.5 + li * 3.4,
        z: (li - (levels.length - 1) / 2) * 5.6,
        level: li,
        parents: node.parents || [],
      });
    });
  });
  const nodes = [...pos.values()];
  const linePts = [];
  for (const p of nodes) {
    for (const par of p.parents) {
      const q = pos.get(par);
      if (q) linePts.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePts, 3));
  return { nodes, lineGeo, levelCount: levels.length };
}

let _lib = null;
function geoLib() {
  if (_lib) return _lib;
  const sbRoot = buildSunburst(HIERARCHY);
  const sbColour = sunburstColourScale(sbRoot.children.map((c) => c.name));
  const sbNodes = sunburstDescendants(sbRoot).filter((n) => n.depth >= 1 && n.depth <= 2);
  const RING = 8.5;
  const mesaWedges = [];
  const drumBlocks = [];
  for (const n of sbNodes) {
    const color = sbColour(n);
    // Slice 12: each wedge carries its layout node and its
    // provider id (the name path from the true root — the same
    // id subnodes.js computes), so picking, highlight and the
    // App's info all name the same node.
    const mesaGeo = sectorGeometry(n.x0, n.x1, n.y0, n.y1, RING, 0, n.depth === 1 ? 12 : 6.5);
    if (mesaGeo) mesaWedges.push({ geo: mesaGeo, color, node: n, id: hierarchyPathId(n) });
    const drumGeo = sectorGeometry(n.x0, n.x1, n.y0, n.y1, RING, 0, 20);
    if (drumGeo) drumBlocks.push({ geo: drumGeo, color, node: n, id: hierarchyPathId(n) });
  }

  const tmRoot = buildTreemap(HIERARCHY);
  const trayPlates = [];
  const trayCuboids = [];
  for (const n of treemapDescendants(tmRoot)) {
    if (n.depth === 1) trayPlates.push({ node: n, color: treemapHouseColor(tmRoot, n) });
    else if (n.depth === 2) trayCuboids.push({ node: n, color: treemapHouseColor(tmRoot, n) });
  }
  const cubePieces = treemapCubeFaces(tmRoot).map((p) => ({
    ...p, color: treemapHouseColor(tmRoot, p.node), isLeaf: p.node.children.length === 0,
  }));

  // Tangled tree fan: BOTH courses are built (slice 13) — the
  // genealogy and demo-de's import graph; the miniature renders
  // the active one, the other costs nothing beyond its geometry.
  const tangles = {
    genealogy: buildTangleSet(tangleLevels("genealogy")),
    imports: buildTangleSet(tangleLevels("imports")),
  };

  // Horizon citizens (slice 14): BOTH read the one lane table
  // (horizon-lanes.js — NCTGraphite's activity lanes, shared
  // with the standalone horizon pages; the last two lanes are
  // NET IN / NET OUT, driven by the environment snapshot's
  // captured strip). The SKYLINE is the lanes as terraced
  // towers: eight rows, one per lane, reading back to front in
  // lane order — so the net lanes are the FRONT pair of rows —
  // by nine time columns. The PANEL is the lanes as the horizon
  // chart itself: eight strips, lane order top to bottom — the
  // net lanes the BOTTOM pair — each strip a row of twenty
  // ticks. A tower's or tick's height is its lane value at that
  // column; its colour is the horizon chart's own band colour
  // for the lane's scheme family.
  const laneColor = (lane, v) => {
    const scheme = lane.scheme === "blues" ? SCHEME_BLUES : SCHEME_GREENS;
    const band = Math.max(0, Math.min(3, Math.floor(v * 4)));
    return horizonBandColor(scheme, 4, band);
  };
  const laneSampleAt = (lane, frac) =>
    lane.samples[Math.min(lane.samples.length - 1, Math.floor(frac * lane.samples.length))];
  const skyline = [];
  SPACE_LANES.forEach((lane, li) => {
    for (let ci = 0; ci < 9; ci++) {
      const v = laneSampleAt(lane, (ci + 0.5) / 9);
      skyline.push({ x: (ci - 4) * 5.6, z: (li - 3.5) * 3.6, h: 1.2 + v * 12.5, v, color: laneColor(lane, v) });
    }
  });
  const panelTicks = [];
  SPACE_LANES.forEach((lane, li) => {
    for (let ci = 0; ci < 20; ci++) {
      const v = laneSampleAt(lane, (ci + 0.5) / 20);
      panelTicks.push({ x: -21.5 + ci * 2.26, lane: li, v, h: 0.3 + v * 2.9, color: laneColor(lane, v) });
    }
  });

  // Definition wires.
  const wireGeos = [
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-16, 11, 0), new THREE.Vector3(-7, 18, 3), new THREE.Vector3(2, 15, 5)), 16, 0.45, 6),
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(2, 15, 5), new THREE.Vector3(9, 19, 1), new THREE.Vector3(17, 10, -3)), 16, 0.45, 6),
  ];

  // The data tree (slice 7): the hierarchy grown by lsystems.js —
  // since slice 13, the repository itself. Segments are annotated
  // with their depth-1 branch and its house colour — the same
  // sunburst scale the mesa and drum wear, so a branch of the
  // tree reads as the same family as its wedge.
  const dataTree = buildDataTree(HIERARCHY, { maxDepth: 3 });
  const topColour = new Map(sbRoot.children.map((c) => [c.data.name, sbColour(c)]));
  const branchOf = (node) => {
    let n = node;
    while (n && n.depth > 1) n = dataTree.byId.get(n.parentId);
    return n && n.depth === 1 ? n : null;
  };
  const treeSegs = dataTree.segments.map((s) => {
    const node = dataTree.byId.get(s.nodeId);
    const branch = node.depth === 0 ? null : branchOf(node);
    return {
      ...s,
      branchId: branch ? branch.id : null,
      branchColor: branch ? topColour.get(branch.name) : "#6b543a",
    };
  });
  const treeBuds = dataTree.tips.map((n) => {
    const branch = branchOf(n);
    return {
      pos: n.end,
      branchId: branch ? branch.id : null,
      color: branch ? topColour.get(branch.name) : "#8a97a5",
      r: 0.5 + 2.1 * Math.sqrt(Math.max(0, n.value) / dataTree.totalValue),
    };
  });

  _lib = {
    mesaWedges, drumBlocks, trayPlates, trayCuboids, cubePieces,
    tangles, skyline, panelTicks, wireGeos,
    dataTree, treeSegs, treeBuds,
    unitBox: new THREE.BoxGeometry(1, 1, 1),
  };
  return _lib;
}

/** Cube-face piece placement, scaled from the cube page (S = 32). */
function cubePiecePlacement(face, rect, isLeaf) {
  const S = 32;
  const T = isLeaf ? 3.2 : 1.7;
  const GAP = 0.8;
  const CY = S / 2;
  const uc = (rect.x0 + rect.x1) / 2;
  const vc = (rect.y0 + rect.y1) / 2;
  const w = Math.max(0.5, (rect.x1 - rect.x0) * S - GAP);
  const d = Math.max(0.5, (rect.y1 - rect.y0) * S - GAP);
  const y = (0.5 - vc) * S + CY;
  switch (face) {
    case "top": return { pos: [(uc - 0.5) * S, S, (vc - 0.5) * S], scale: [w, T, d] };
    case "north": return { pos: [(uc - 0.5) * S, y, -S / 2], scale: [w, d, T] };
    case "south": return { pos: [(0.5 - uc) * S, y, S / 2], scale: [w, d, T] };
    case "east": return { pos: [S / 2, y, (0.5 - uc) * S], scale: [T, d, w] };
    case "west": return { pos: [-S / 2, y, (uc - 0.5) * S], scale: [T, d, w] };
    default: return { pos: [0, CY, 0], scale: [w, T, d] };
  }
}

/* ---------- miniatures (matFor registers every material for the glow) ---------- */

/**
 * AMBIENT MOTION gate, shared by the miniatures' own useFrame
 * drivers: a 0..1 amplitude eased toward the PARAMETERS toggle
 * (stateRef.ambientOn), so switching ambient motion off settles
 * every citizen smoothly home instead of freezing it mid-gesture,
 * and switching it on fades the life back in. The motion itself is
 * INTERNAL to each miniature — it never writes the user's transform
 * state, and the Rig's outer/inner groups (drag, carry, the entered
 * seat) compose on top of it untouched.
 */
function ambientAmp(ampRef, ctx, dt) {
  const on = ctx.stateRef.current.ambientOn !== false;
  ampRef.current = damp(ampRef.current, on ? 1 : 0, 3, Math.min(0.05, dt || 0.016));
  return ampRef.current;
}

/**
 * Slice 12 — the sunbursts' wedges, shared by the mesa and the
 * drum (one hierarchy, two forms; the geometry differs, the
 * sub-node machinery is one). At rest the set is the library's;
 * under DESCENT it is rebuilt from the display root's subtree
 * (buildWedgeSet), with provider ids recovered by prefixing the
 * display root's true id. Wedges are per-node meshes, so picking
 * is direct: hover reports the node id while the citizen is
 * current, and the highlight is the knot/tree colour-factor
 * treatment on owned materials — hovered or focused brightens,
 * siblings dim. Each wedge's anchor (mid-angle, mid-radius, its
 * top) is published in the citizen's local frame for the Rig's
 * seats and the in-space info card.
 */
function SunburstWedges({ kind, lib, matFor, ctx, descentRootId }) {
  const wedges = useMemo(() => {
    if (!descentRootId) return kind === "mesa" ? lib.mesaWedges : lib.drumBlocks;
    const data = hierarchyDataOf(descentRootId);
    if (!data) return kind === "mesa" ? lib.mesaWedges : lib.drumBlocks;
    return buildWedgeSet(data, kind).map((w) => ({
      ...w,
      id: descentRootId + w.id.slice(w.id.indexOf("/")),
    }));
  }, [lib, kind, descentRootId]);
  const owned = useMemo(() => {
    const map = new Map();
    for (const w of wedges) {
      if (map.has(w.id)) continue;
      map.set(w.id, {
        mat: kind === "mesa"
          ? matFor(w.color, { opacity: 0.86, glowScale: 0.7, keepDepth: true })
          : matFor(w.color, { rough: 0.5 }),
        base: new THREE.Color(w.color),
      });
    }
    return map;
  }, [wedges, kind, matFor]);
  // A descended set owns its geometries and materials; the
  // library's are shared and stay. Replaced owned sets dispose.
  useEffect(() => {
    if (!descentRootId) return undefined;
    return () => {
      for (const w of wedges) w.geo.dispose();
      for (const e of owned.values()) e.mat.dispose();
    };
  }, [wedges, owned, descentRootId]);
  const groupRef = useRef(null);
  useEffect(() => {
    const frame = ctx.frame;
    frame.subGroupRefs.set(kind, groupRef.current);
    const anchors = new Map();
    for (const w of wedges) {
      const n = w.node;
      const a = (n.x0 + n.x1) / 2;
      const r = ((n.y0 + n.y1) / 2) * 8.5;
      const top = kind === "mesa" ? (n.depth === 1 ? 12 : 6.5) : 21.6;
      anchors.set(w.id, {
        centre: new THREE.Vector3(Math.cos(a) * r, top, Math.sin(a) * r),
        radius: Math.max(3, n.y1 * 8.5 * 0.45),
      });
    }
    frame.subLocal.set(kind, anchors);
    return () => {
      frame.subGroupRefs.delete(kind);
      if (frame.subLocal.get(kind) === anchors) frame.subLocal.delete(kind);
    };
  }, [ctx, kind, wedges]);
  const lastHi = useRef(undefined);
  useFrame(() => {
    const st = ctx.stateRef.current;
    const hov = st.currentId === kind && st.subHover && st.subHover.objectId === kind
      ? st.subHover.nodeId : null;
    const foc = st.partFocus && st.partFocus.objectId === kind ? st.partFocus.partId : null;
    const hi = foc || hov || null;
    if (hi === lastHi.current) return;
    lastHi.current = hi;
    for (const [id, e] of owned) {
      const f = !hi ? 1 : id === hi ? 1.9 : 0.55;
      e.mat.color.copy(e.base).multiplyScalar(f);
    }
  });
  const st = () => ctx.stateRef.current;
  const report = (id) => {
    if (st().currentId !== kind || !st().onSubHover) return;
    st().onSubHover(kind, id);
  };
  const clear = () => { if (st().onSubHover) st().onSubHover(kind, null); };
  return (
    <group ref={groupRef}>
      {wedges.map((w) => (
        <mesh key={w.id} geometry={w.geo}
          position={kind === "drum" ? [0, 1.6, 0] : undefined}
          material={owned.get(w.id).mat}
          onPointerOver={() => report(w.id)}
          onPointerMove={() => report(w.id)}
          onPointerOut={clear} />
      ))}
    </group>
  );
}

function MiniMesa({ lib, matFor, ctx, descentRootId }) {
  const sweep = useRef(null);
  const amp = useRef(1);
  useFrame((_, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    if (sweep.current) {
      sweep.current.rotation.y -= dt * 0.22 * a;
      sweep.current.children[0].material.opacity = 0.34 * a;
    }
  });
  return (
    <group>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[7.6, 8.4, 6, 40]} />
        <primitive object={matFor(0x8a97a0, { rough: 0.5 })} attach="material" />
      </mesh>
      <SunburstWedges kind="mesa" lib={lib} matFor={matFor} ctx={ctx} descentRootId={descentRootId} />
      {/* A light sweep travels the rings — the disc itself never turns. */}
      <group ref={sweep}>
        <mesh position={[0, 12.7, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[3.2, 8.4, 24, 1, 0, 0.85]} />
          <meshBasicMaterial color={0xffc46b} transparent opacity={0.34} side={THREE.DoubleSide}
            depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}

function MiniDrum({ lib, matFor, ctx, descentRootId }) {
  const band = useRef(null);
  const amp = useRef(1);
  useFrame((_, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    if (band.current) {
      band.current.rotation.y += dt * 0.3 * a;
      band.current.children[0].material.opacity = 0.26 * a;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[26.5, 27.5, 1.6, 48]} />
        <primitive object={matFor(0x27313a, { rough: 0.85 })} attach="material" />
      </mesh>
      <mesh position={[0, 10.8, 0]}>
        <cylinderGeometry args={[8.1, 8.6, 20, 40]} />
        <primitive object={matFor(0x39434b, { rough: 0.7 })} attach="material" />
      </mesh>
      <SunburstWedges kind="drum" lib={lib} matFor={matFor} ctx={ctx} descentRootId={descentRootId} />
      {/* A light band circles inside the glass, past the blocks. */}
      <group ref={band}>
        <mesh position={[9.4, 11.4, 0]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[1.4, 18]} />
          <meshBasicMaterial color={0x9fe8dc} transparent opacity={0.26} side={THREE.DoubleSide}
            depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      {/* The drum's wall is glass: the blocks ghost through it. */}
      <mesh position={[0, 11.6, 0]}>
        <cylinderGeometry args={[26.2, 26.2, 20.5, 48, 1, true]} />
        <primitive object={matFor(0x9fd8e8, { opacity: 0.16, double: true, glowScale: 0.3 })} attach="material" />
      </mesh>
      <mesh position={[0, 22.2, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[26.2, 0.7, 8, 48]} />
        <primitive object={matFor(0x8a97a0, { rough: 0.45 })} attach="material" />
      </mesh>
    </group>
  );
}

function MiniTray({ lib, matFor, ctx }) {
  const W = 54, H = 46;
  const rect = (n) => ({
    cx: ((n.x0 + n.x1) / 2 - 0.5) * W, cz: ((n.y0 + n.y1) / 2 - 0.5) * H,
    w: (n.x1 - n.x0) * W, d: (n.y1 - n.y0) * H,
  });
  // Breathing: a handful of cuboids ease up and down in a slow
  // cycle, each on its own phase — the tray stays a tray.
  const cuboidRefs = useRef([]);
  const plateRefs = useRef([]);
  const groupRef = useRef(null);
  const amp = useRef(1);
  const chosen = useMemo(() => {
    const idx = [];
    const step = Math.max(1, Math.floor(lib.trayCuboids.length / 6));
    for (let i = 0; i < lib.trayCuboids.length && idx.length < 6; i += step) idx.push(i);
    return idx;
  }, [lib]);
  // Slice 12: plates and cuboids are sub-nodes. Their materials
  // are owned (the knot's pattern) so the highlight can rewrite
  // colours; each mesh reports its provider id on hover while
  // the tray is current, and anchors are published for the Rig.
  const owned = useMemo(() => {
    const plates = lib.trayPlates.map(({ node, color }) => ({
      id: hierarchyPathId(node),
      mat: matFor(new THREE.Color(color).multiplyScalar(0.4).getHex(), { rough: 0.9 }),
      base: new THREE.Color(color).multiplyScalar(0.4),
    }));
    const cuboids = lib.trayCuboids.map(({ node, color }) => ({
      id: hierarchyPathId(node),
      mat: matFor(color, { rough: 0.5 }),
      base: new THREE.Color(color),
    }));
    return { plates, cuboids, all: [...plates, ...cuboids] };
  }, [lib, matFor]);
  useEffect(() => {
    const frame = ctx.frame;
    frame.subGroupRefs.set("tray", groupRef.current);
    const anchors = new Map();
    lib.trayPlates.forEach(({ node }, i) => {
      const r = rect(node);
      anchors.set(owned.plates[i].id, {
        centre: new THREE.Vector3(r.cx, 2.4, r.cz),
        radius: Math.max(3, Math.max(r.w, r.d) * 0.35),
      });
    });
    lib.trayCuboids.forEach(({ node }, i) => {
      const r = rect(node);
      anchors.set(owned.cuboids[i].id, {
        centre: new THREE.Vector3(r.cx, 8.6, r.cz),
        radius: Math.max(2.5, Math.max(r.w, r.d) * 0.35),
      });
    });
    frame.subLocal.set("tray", anchors);
    return () => {
      frame.subGroupRefs.delete("tray");
      if (frame.subLocal.get("tray") === anchors) frame.subLocal.delete("tray");
    };
  }, [ctx, lib, owned]); // eslint-disable-line react-hooks/exhaustive-deps
  const lastHi = useRef(undefined);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    const t = state.clock.elapsedTime;
    chosen.forEach((ci, k) => {
      const m = cuboidRefs.current[ci];
      if (!m) return;
      const sy = 6 * (1 + a * 0.13 * Math.sin(t * 0.45 + k * 1.93));
      m.scale.y = sy;
      m.position.y = 2.2 + sy / 2;
    });
    const st = ctx.stateRef.current;
    const hov = st.currentId === "tray" && st.subHover && st.subHover.objectId === "tray"
      ? st.subHover.nodeId : null;
    const foc = st.partFocus && st.partFocus.objectId === "tray" ? st.partFocus.partId : null;
    const hi = foc || hov || null;
    if (hi !== lastHi.current) {
      lastHi.current = hi;
      for (const e of owned.all) {
        const f = !hi ? 1 : e.id === hi ? 1.9 : 0.55;
        e.mat.color.copy(e.base).multiplyScalar(f);
      }
    }
  });
  const st = () => ctx.stateRef.current;
  const report = (id) => {
    if (st().currentId !== "tray" || !st().onSubHover) return;
    st().onSubHover("tray", id);
  };
  const clear = () => { if (st().onSubHover) st().onSubHover("tray", null); };
  return (
    <group ref={groupRef}>
      {/* The tray itself is glass; the cuboids stand solid in it. */}
      <mesh position={[0, 0.7, 0]} geometry={lib.unitBox} scale={[W + 5, 1.4, H + 5]}
        material={matFor(0x9fd8e8, { opacity: 0.28, glowScale: 0.3 })} />
      {lib.trayPlates.map(({ node }, i) => {
        const r = rect(node);
        return (
          <mesh key={`p${i}`} geometry={lib.unitBox} position={[r.cx, 1.7, r.cz]}
            ref={(el) => { plateRefs.current[i] = el; }}
            scale={[Math.max(0.4, r.w - 0.7), 1, Math.max(0.4, r.d - 0.7)]}
            material={owned.plates[i].mat}
            onPointerOver={() => report(owned.plates[i].id)}
            onPointerMove={() => report(owned.plates[i].id)}
            onPointerOut={clear} />
        );
      })}
      {lib.trayCuboids.map(({ node }, i) => {
        const r = rect(node);
        return (
          <mesh key={`c${i}`} geometry={lib.unitBox} position={[r.cx, 2.2 + 3, r.cz]}
            ref={(el) => { cuboidRefs.current[i] = el; }}
            scale={[Math.max(0.4, r.w - 1.4), 6, Math.max(0.4, r.d - 1.4)]}
            material={owned.cuboids[i].mat}
            onPointerOver={() => report(owned.cuboids[i].id)}
            onPointerMove={() => report(owned.cuboids[i].id)}
            onPointerOut={clear} />
        );
      })}
    </group>
  );
}

function MiniCube({ lib, matFor, ctx }) {
  // Breathing: a few leaf tiles swell and settle by a few percent,
  // each on its own phase — the cube's faces stay formed.
  const pieceRefs = useRef([]);
  const amp = useRef(1);
  const chosen = useMemo(() => {
    const leaves = lib.cubePieces.map((p, i) => (p.isLeaf ? i : -1)).filter((i) => i >= 0);
    const idx = [];
    const step = Math.max(1, Math.floor(leaves.length / 5));
    for (let i = 0; i < leaves.length && idx.length < 5; i += step) idx.push(leaves[i]);
    return idx;
  }, [lib]);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    const t = state.clock.elapsedTime;
    chosen.forEach((pi, k) => {
      const m = pieceRefs.current[pi];
      if (!m) return;
      const p = lib.cubePieces[pi];
      const { scale } = cubePiecePlacement(p.face, p.rect, p.isLeaf);
      const s = 1 + a * 0.05 * Math.sin(t * 0.4 + k * 2.13);
      m.scale.set(scale[0] * s, scale[1] * s, scale[2] * s);
    });
  });
  return (
    <group>
      {/* Glass shell: the face pieces stay solid and ghost through. */}
      <mesh position={[0, 16, 0]} geometry={lib.unitBox} scale={[32.5, 32.5, 32.5]}
        material={matFor(0x9fd8e8, { opacity: 0.15, glowScale: 0.25 })} />
      <mesh position={[0, 16, 0]} geometry={lib.unitBox} scale={[28.5, 28.5, 28.5]}
        material={matFor(0x11171b, { rough: 0.95 })} />
      {lib.cubePieces.map((p, i) => {
        const { pos, scale } = cubePiecePlacement(p.face, p.rect, p.isLeaf);
        const color = p.isLeaf ? p.color : new THREE.Color(p.color).multiplyScalar(0.45).getHex();
        return (
          <mesh key={i} geometry={lib.unitBox} position={pos} scale={scale}
            ref={(el) => { pieceRefs.current[i] = el; }}
            material={matFor(color, { rough: p.isLeaf ? 0.4 : 0.85 })} />
        );
      })}
    </group>
  );
}

function MiniTangle({ lib, matFor, ctx, tangleDataset }) {
  const ref = useRef(null);
  // Slice 13: the ACTIVE course — the genealogy or demo-de's
  // import graph; the App's PARAMETERS switch chooses, and the
  // miniature (geometry, sheets, picking, anchors) follows it.
  const tg = lib.tangles[tangleDataset] || lib.tangles.genealogy;
  // Flow: a handful of light points travel the tree's own link
  // segments, end to end, each on its own offset.
  const flow = useMemo(() => {
    const attr = tg.lineGeo.getAttribute("position");
    const segCount = Math.floor(attr.count / 2);
    const N = Math.min(10, segCount);
    const segs = [];
    for (let k = 0; k < N; k++) {
      const si = Math.floor((k / N) * segCount) * 2;
      segs.push({
        a: [attr.getX(si), attr.getY(si), attr.getZ(si)],
        b: [attr.getX(si + 1), attr.getY(si + 1), attr.getZ(si + 1)],
        off: k / N,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffd28a, size: 2.4, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    return { segs, geo, mat };
  }, [tg]);
  useEffect(() => () => { flow.geo.dispose(); flow.mat.dispose(); }, [flow]);
  const amp = useRef(1);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    flow.mat.opacity = 0.9 * a;
    if (a < 0.02) return;
    const t = state.clock.elapsedTime;
    const attr = flow.geo.getAttribute("position");
    flow.segs.forEach((s, k) => {
      const f = (t * 0.07 + s.off) % 1;
      attr.setXYZ(k,
        s.a[0] + (s.b[0] - s.a[0]) * f,
        s.a[1] + (s.b[1] - s.a[1]) * f,
        s.a[2] + (s.b[2] - s.a[2]) * f);
    });
    attr.needsUpdate = true;
  });
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const M = new THREE.Matrix4();
    const C = new THREE.Color();
    tg.nodes.forEach((p, i) => {
      M.makeTranslation(p.x, p.y, p.z);
      m.setMatrixAt(i, M);
      m.setColorAt(i, C.set(TANGLE_PALETTE[p.level % TANGLE_PALETTE.length]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [tg]);
  // Slice 12: the figures are sub-nodes. The instanced mesh picks
  // by instanceId (the tree's precedent); the highlight rewrites
  // instance colours with the tree's factors; anchors are the
  // figures' own positions, published for the Rig and the card.
  const groupRef = useRef(null);
  useEffect(() => {
    const frame = ctx.frame;
    frame.subGroupRefs.set("tangle", groupRef.current);
    const anchors = new Map();
    for (const p of tg.nodes) {
      anchors.set(p.id, { centre: new THREE.Vector3(p.x, p.y, p.z), radius: 2 });
    }
    frame.subLocal.set("tangle", anchors);
    return () => {
      frame.subGroupRefs.delete("tangle");
      if (frame.subLocal.get("tangle") === anchors) frame.subLocal.delete("tangle");
    };
  }, [ctx, tg]);
  const lastHi = useRef(undefined);
  useFrame(() => {
    const st = ctx.stateRef.current;
    const hov = st.currentId === "tangle" && st.subHover && st.subHover.objectId === "tangle"
      ? st.subHover.nodeId : null;
    const foc = st.partFocus && st.partFocus.objectId === "tangle" ? st.partFocus.partId : null;
    const hi = foc || hov || null;
    if (hi === lastHi.current) return;
    lastHi.current = hi;
    const m = ref.current;
    if (!m) return;
    const C = new THREE.Color();
    tg.nodes.forEach((p, i) => {
      const f = !hi ? 1 : p.id === hi ? 2.1 : 0.55;
      m.setColorAt(i, C.set(TANGLE_PALETTE[p.level % TANGLE_PALETTE.length]).multiplyScalar(f));
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  const st = () => ctx.stateRef.current;
  const reportInst = (e) => {
    if (st().currentId !== "tangle" || !st().onSubHover) return;
    if (e.instanceId == null) return;
    const p = tg.nodes[e.instanceId];
    if (p) st().onSubHover("tangle", p.id);
  };
  const clearInst = () => { if (st().onSubHover) st().onSubHover("tangle", null); };
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.8, 0]} geometry={lib.unitBox} scale={[52, 1.6, 46]}
        material={matFor(0x1a2227, { rough: 0.9 })} />
      {/* Level sheets are glass; the figures stand solid on them. */}
      {Array.from({ length: tg.levelCount }, (_, li) => (
        <mesh key={li} position={[0, 2.3 + li * 3.4, (li - (tg.levelCount - 1) / 2) * 5.6]} geometry={lib.unitBox}
          scale={[50, 0.35, 5.2]} material={matFor(0x9fd8e8, { opacity: 0.13, glowScale: 0.3 })} />
      ))}
      <lineSegments geometry={tg.lineGeo}>
        <lineBasicMaterial color={0x6f8894} transparent opacity={0.75} />
      </lineSegments>
      <points geometry={flow.geo} material={flow.mat} />
      <instancedMesh ref={ref} args={[undefined, undefined, tg.nodes.length]} key={`${tangleDataset}:${tg.nodes.length}`}
        onPointerOver={reportInst} onPointerMove={reportInst} onPointerOut={clearInst}>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <primitive object={matFor(0xffffff, { rough: 0.5 })} attach="material" />
      </instancedMesh>
    </group>
  );
}

function MiniSkyline({ lib, matFor, ctx }) {
  const ref = useRef(null);
  // The monitor lives: every tower's height breathes a few percent
  // on its own phase, so the lanes keep updating in place. The
  // towers ARE the lanes (slice 14): eight rows back to front in
  // lane order — the front pair of rows is NET IN / NET OUT.
  const amp = useRef(1);
  const scratch = useMemo(() => ({
    M: new THREE.Matrix4(), Q: new THREE.Quaternion(),
    S: new THREE.Vector3(), P: new THREE.Vector3(),
  }), []);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const { M, Q, S, P } = scratch;
    lib.skyline.forEach((b, i) => {
      const h = b.h * (1 + a * 0.07 * Math.sin(t * 0.8 + i * 1.37));
      P.set(b.x, 1.6 + h / 2, b.z);
      S.set(4.8, h, 3.2);
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const S = new THREE.Vector3();
    const P = new THREE.Vector3();
    const C = new THREE.Color();
    lib.skyline.forEach((b, i) => {
      P.set(b.x, 1.6 + b.h / 2, b.z);
      S.set(4.8, b.h, 3.2);
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
      m.setColorAt(i, C.set(b.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [lib]);
  return (
    <group>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[31, 33, 1.6, 40]} />
        <primitive object={matFor(0x27313a, { rough: 0.85 })} attach="material" />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, lib.skyline.length]} key={lib.skyline.length}>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={matFor(0xffffff, { rough: 0.55 })} attach="material" />
      </instancedMesh>
    </group>
  );
}

/** A lane strip's baseline on the panel (panel-local y): lane
 *  order top to bottom, so the net lanes are the bottom pair. */
const PANEL_STRIP_Y = (li) => 10.9 - li * 3.1;

function MiniHorizonPanel({ lib, matFor, ctx }) {
  // The flat monitor, as the horizon chart itself (slice 14):
  // eight lane strips, each a row of ticks whose heights are
  // the lane's samples and whose colours are the chart's band
  // colours — the last two strips are NET IN and NET OUT,
  // driven by the environment snapshot. The ticks ride a slow
  // shimmer, each on its own phase, feet planted on their
  // strip's baseline.
  const ref = useRef(null);
  const amp = useRef(1);
  const scratch = useMemo(() => ({
    M: new THREE.Matrix4(), Q: new THREE.Quaternion(),
    S: new THREE.Vector3(), P: new THREE.Vector3(),
  }), []);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const { M, Q, S, P } = scratch;
    lib.panelTicks.forEach((b, i) => {
      const h = b.h * (1 + a * 0.09 * Math.sin(t * 1.05 + i * 0.87));
      P.set(b.x, PANEL_STRIP_Y(b.lane) + h / 2, 1.1);
      S.set(1.7, h, 0.7);
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const S = new THREE.Vector3();
    const P = new THREE.Vector3();
    const C = new THREE.Color();
    lib.panelTicks.forEach((b, i) => {
      P.set(b.x, PANEL_STRIP_Y(b.lane) + b.h / 2, 1.1);
      S.set(1.7, b.h, 0.7);
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
      m.setColorAt(i, C.set(b.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [lib]);
  return (
    <group>
      <mesh position={[0, 1, 4]} geometry={lib.unitBox} scale={[50, 2, 10]}
        material={matFor(0x27313a, { rough: 0.85 })} />
      <group position={[0, 15, 0]} rotation-x={-0.1}>
        <mesh geometry={lib.unitBox} scale={[48, 28, 1.6]} material={matFor(0x131a1e, { rough: 0.8 })} />
        {/* The strips' backings: a shade per lane, alternating. */}
        {SPACE_LANES.map((lane, li) => (
          <mesh key={lane.id} geometry={lib.unitBox}
            position={[0, PANEL_STRIP_Y(li) + 1.45, 0.85]} scale={[46.5, 2.9, 0.2]}
            material={matFor(li % 2 === 0 ? 0x182228 : 0x11181d, { rough: 0.9 })} />
        ))}
        <instancedMesh ref={ref} args={[undefined, undefined, lib.panelTicks.length]} key={lib.panelTicks.length}>
          <boxGeometry args={[1, 1, 1]} />
          <primitive object={matFor(0xffffff, { rough: 0.45 })} attach="material" />
        </instancedMesh>
        {/* A glass sheet over the panel face. */}
        <mesh position={[0, 0, 1.8]} geometry={lib.unitBox} scale={[48, 28, 0.3]}
          material={matFor(0x9fd8e8, { opacity: 0.13, glowScale: 0.3 })} />
      </group>
    </group>
  );
}

function MiniArch({ lib, matFor, ctx }) {
  const panels = [];
  const R = 21, start = -0.95, len = 1.9;
  for (let v = 0; v < 5; v++) {
    for (let u = 0; u < 6; u++) {
      const a = start + ((u + 0.5) / 6) * len;
      panels.push({
        pos: [Math.sin(a) * R, 5 + v * 5.8, Math.cos(a) * R],
        rotY: a,
        color: new THREE.Color().setHSL(0.36 + 0.3 * (u / 5), 0.5, 0.3 + 0.22 * (v / 4)).getHex(),
      });
    }
  }
  // The swarm is still at work: each panel drifts a fraction of a
  // unit in and out along its own radius, almost imperceptibly.
  const panelRefs = useRef([]);
  const amp = useRef(1);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    const t = state.clock.elapsedTime;
    panels.forEach((p, i) => {
      const m = panelRefs.current[i];
      if (!m) return;
      const d = a * 0.32 * Math.sin(t * 0.22 + i * 0.71);
      m.position.set(
        p.pos[0] + Math.sin(p.rotY) * d,
        p.pos[1],
        p.pos[2] + Math.cos(p.rotY) * d,
      );
    });
  });
  return (
    <group>
      <mesh position={[-17, 1, 12]} geometry={lib.unitBox} scale={[10, 2, 12]}
        material={matFor(0x27313a, { rough: 0.85 })} />
      <mesh position={[17, 1, 12]} geometry={lib.unitBox} scale={[10, 2, 12]}
        material={matFor(0x27313a, { rough: 0.85 })} />
      {/* The sheet is glass; the panels on it are solid. The sheet is
          a cylinder segment on the same axis the panels are placed
          by (x = R sin a, z = R cos a), so the two coincide. */}
      <mesh position={[0, 17, 0]}>
        <cylinderGeometry args={[R, R, 31, 24, 1, true, start, len]} />
        <primitive object={matFor(0x9fd8e8, { opacity: 0.3, double: true, glowScale: 0.3 })} attach="material" />
      </mesh>
      {panels.map((p, i) => (
        <mesh key={i} geometry={lib.unitBox} position={p.pos} rotation-y={p.rotY} scale={[4.6, 3.4, 0.6]}
          ref={(el) => { panelRefs.current[i] = el; }}
          material={matFor(p.color, { rough: 0.55 })} />
      ))}
    </group>
  );
}

function MiniDefinition({ lib, matFor, ctx }) {
  const nodes = [
    { pos: [-16, 11, 0], color: 0x8e6cc8 },
    { pos: [2, 15, 5], color: 0xb8c7cc },
    { pos: [17, 10, -3], color: 0x8e6cc8 },
  ];
  // Pulses travel the wires: the same two bezier paths the wire
  // tubes were swept along (geoLib above), one pulse per wire.
  const curves = useMemo(() => [
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-16, 11, 0), new THREE.Vector3(-7, 18, 3), new THREE.Vector3(2, 15, 5)),
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(2, 15, 5), new THREE.Vector3(9, 19, 1), new THREE.Vector3(17, 10, -3)),
  ], []);
  const pulseRefs = useRef([]);
  const amp = useRef(1);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    const t = state.clock.elapsedTime;
    pulseRefs.current.forEach((m, k) => {
      if (!m) return;
      m.visible = a > 0.02;
      if (!m.visible) return;
      const f = (t * 0.055 + k * 0.5) % 1;
      m.position.copy(curves[k % curves.length].getPoint(f));
      m.material.opacity = 0.85 * a;
    });
  });
  return (
    <group>
      <mesh position={[0, 0.8, 0]} geometry={lib.unitBox} scale={[52, 1.6, 30]}
        material={matFor(0x1a2227, { rough: 0.9 })} />
      {lib.wireGeos.map((g, i) => (
        <mesh key={i} geometry={g} material={matFor(0xb79ce0, { rough: 0.4 })} />
      ))}
      {curves.map((_, k) => (
        <mesh key={`pulse${k}`} ref={(el) => { pulseRefs.current[k] = el; }}>
          <sphereGeometry args={[0.95, 10, 10]} />
          <meshBasicMaterial color={k ? 0x7fd4c1 : 0xffc46b} transparent opacity={0.85}
            depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      {nodes.map((n, i) => (
        <group key={i} position={n.pos}>
          <mesh geometry={lib.unitBox} scale={[12.5, 7.5, 2.4]} material={matFor(n.color, { rough: 0.5 })} />
          <mesh position={[6.9, 0, 0]}>
            <sphereGeometry args={[1.1, 10, 10]} />
            <primitive object={matFor(0xffa726, { rough: 0.35 })} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- knots: the data knot citizen + atmosphere sculptures ---------- */

/**
 * The display scale of every knot in the space: knots.js speaks in
 * mathematical units (disc radius ≤ 3, axis ≤ 1); multiplied by 6
 * the data knot's disc spans ~36 units on its plot. Points map
 * [x, y, z] → (x, z, y): the torus's axis becomes three.js's up.
 */
export const KNOT_SCALE = 6;
/** Height of the data knot's centre above its plot. */
export const KNOT_CY = 12.5;

/** A sweeps.js geometry payload as a three.js BufferGeometry. */
function sweepGeometry(g) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(g.positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(g.normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uvs, 2));
  if (g.colors) geo.setAttribute("color", new THREE.Float32BufferAttribute(g.colors, 3));
  geo.setIndex(g.indices);
  return geo;
}

/* The data knot's sweep sampling: 256 rings around the loop, 12
 * points around the tube. The radius and the hue are BLENDED
 * across each part boundary over ±3% of the loop (smoothstepped,
 * so the blend is C1 in radius — no step, no crease, at a seam),
 * and the parts' weights below drive both, so girth and colour
 * change together exactly where one part hands over to the next. */
const KNOT_RINGS = 256;
const KNOT_RADIAL = 12;
const KNOT_BLEND = 0.03;

const smooth01 = (x) => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};

/** [[partIndex, weight], …] at loop fraction tau (0..1). */
function knotPartBlend(tau) {
  const count = KNOT_PARTS.length;
  const u = (((tau % 1) + 1) % 1) * count; // position in part units
  const w = KNOT_BLEND * count; // blend half-window, same units
  const own = Math.floor(u) % count;
  const frac = u - Math.floor(u);
  if (frac < w) {
    const s = smooth01((frac + w) / (2 * w));
    return [[(own + count - 1) % count, 1 - s], [own, s]];
  }
  if (frac > 1 - w) {
    const s = smooth01((frac - (1 - w)) / (2 * w));
    return [[own, 1 - s], [(own + 1) % count, s]];
  }
  return [[own, 1]];
}

/**
 * The DATA KNOT. One continuous SWEEP (sweeps.js): a circular
 * contour carried around the trefoil by parallel transport, its
 * radius at every ring set by the part that owns that arc —
 * radiusFor on the part's value — blended across the boundaries,
 * so the curve itself swells and narrows with what its parts
 * hold, along one surface with no joins. Per-vertex colours carry
 * the parts' hues through the same blend. (There used to be a
 * bright core bead at each arc's midpoint, faking the emphasis
 * the radius now states directly; the beads are gone.) Per the
 * opacity law the tube is SEMI-TRANSPARENT because it contains
 * data: glass at 0.45, clearing toward 0.72 while a part is
 * addressed. The material is NOT in the Rig's glow list: this
 * component drives it itself — the knot's own tier lifts the
 * whole surface through the material colour, and a hovered or
 * focused part brightens past it by REWRITING THE VERTEX COLOURS
 * (the data tree's trick): the addressed part's rings ×2.1, the
 * others ×0.55, base colours kept to restore. The whole knot
 * turns slowly on its own (a living sculpture, independent of
 * the turntable), pausing while it is inspected or a part is
 * zoomed. Parts are addressed off the single mesh: the sweep
 * stores each vertex's arc fraction as uv.x, so an intersection
 * names its part directly (the App gates the report on the knot
 * being current).
 */
function MiniKnot({ lib, matFor, ctx }) {
  const spin = useRef(null);
  const lastHi = useRef(undefined);
  const data = useMemo(() => {
    const form = KNOT_FORMS.trefoil;
    const radii = KNOT_PARTS.map((p) => radiusFor(p.value));
    const hues = KNOT_PARTS.map((p) => new THREE.Color().setHSL(p.hue / 360, 0.55, 0.55));
    const path = [];
    for (let i = 0; i < KNOT_RINGS; i++) {
      const [x, y, z] = torusKnotPoint(form.p, form.q, (i / KNOT_RINGS) * Math.PI * 2);
      path.push([x * KNOT_SCALE, z * KNOT_SCALE, y * KNOT_SCALE]);
    }
    const swept = tubeAlong(path, (t) => {
      let r = 0;
      for (const [k, w] of knotPartBlend(t)) r += w * radii[k];
      return r;
    }, {
      radialSegments: KNOT_RADIAL,
      closed: true,
      colorAt: (t) => {
        let r = 0, g = 0, b = 0;
        for (const [k, w] of knotPartBlend(t)) {
          const c = hues[k];
          r += w * c.r; g += w * c.g; b += w * c.b;
        }
        return [r, g, b];
      },
    });
    const geo = sweepGeometry(swept);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.25, metalness: 0.1,
      transparent: true, opacity: 0.45, depthWrite: false,
    });
    // Which part owns each ring (the seam ring, KNOT_RINGS, closes
    // the loop inside the last part's arc).
    const ringPart = new Int16Array(KNOT_RINGS + 1);
    for (let r = 0; r <= KNOT_RINGS; r++) {
      ringPart[r] = Math.min(
        KNOT_PARTS.length - 1,
        Math.floor((r / KNOT_RINGS) * KNOT_PARTS.length),
      );
    }
    return {
      geo, mat, ringPart,
      baseColors: Float32Array.from(swept.colors),
      contourPts: KNOT_RADIAL + 1,
    };
  }, []);

  useEffect(() => {
    ctx.frame.knotSpinRef = spin.current;
    return () => {
      if (ctx.frame.knotSpinRef === spin.current) ctx.frame.knotSpinRef = null;
      data.geo.dispose();
      data.mat.dispose();
    };
  }, [ctx, data]);

  const applyPartColours = (hi) => {
    const attr = data.geo.getAttribute("color");
    const C = data.contourPts;
    for (let r = 0; r < data.ringPart.length; r++) {
      const pid = KNOT_PARTS[data.ringPart[r]].id;
      const f = !hi ? 1 : pid === hi ? 2.1 : 0.55;
      for (let j = 0; j < C; j++) {
        const o = (r * C + j) * 3;
        attr.array[o] = data.baseColors[o] * f;
        attr.array[o + 1] = data.baseColors[o + 1] * f;
        attr.array[o + 2] = data.baseColors[o + 2] * f;
      }
    }
    attr.needsUpdate = true;
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    const st = ctx.stateRef.current;
    const paused = st.inspectedId === "knot" || Boolean(st.partFocus && st.partFocus.partId);
    if (spin.current && !paused && st.ambientOn !== false) spin.current.rotation.y += dt * 0.25;
    const base = glowLevel({
      entered: st.cardId === "knot",
      current: st.currentId === "knot",
      pending: st.pendingId === "knot",
      hovered: st.hoverId === "knot",
    });
    const hov = st.currentId === "knot" ? st.partHoverId : null;
    const foc = st.partFocus && st.partFocus.objectId === "knot" ? st.partFocus.partId : null;
    // The knot's own tier lifts the whole surface (the material
    // colour multiplies the vertex colours); the addressed part
    // lifts past it in the vertex colours themselves, rewritten
    // only when the addressed part changes (the tree's pattern).
    const lift = damp(data.mat.color.r, 1 + base * 0.6, 10, dt);
    data.mat.color.setScalar(lift);
    data.mat.opacity = damp(data.mat.opacity, hov || foc ? 0.72 : 0.45, 10, dt);
    const hi = foc || hov || null;
    if (hi !== lastHi.current) {
      lastHi.current = hi;
      applyPartColours(hi);
    }
  });

  const st = () => ctx.stateRef.current;
  const reportPart = (e) => {
    if (!st().onPartHover) return;
    let t = e.uv ? e.uv.x : null;
    if (t == null && e.face) {
      t = Math.floor(e.face.a / data.contourPts) / KNOT_RINGS;
    }
    if (t == null) return;
    const idx = Math.min(
      KNOT_PARTS.length - 1,
      Math.floor((((t % 1) + 1) % 1) * KNOT_PARTS.length),
    );
    st().onPartHover(KNOT_PARTS[idx].id);
  };
  const clearPart = () => { if (st().onPartHover) st().onPartHover(null); };
  return (
    <group>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[11.5, 13, 4, 28]} />
        <primitive object={matFor(0x27313a, { rough: 0.85 })} attach="material" />
      </mesh>
      <group ref={spin} position={[0, KNOT_CY, 0]}>
        <mesh
          geometry={data.geo}
          material={data.mat}
          onPointerOver={reportPart}
          onPointerMove={reportPart}
          onPointerOut={clearPart}
        />
      </group>
    </group>
  );
}

/**
 * Atmosphere knots (SCENERY): the gallery's other two forms as
 * single-sweep sculptures on low pedestals at the rim — a (4,3)
 * torus knot in teal at the south-east rim, a cinquefoil in amber
 * at the north-west. Dim emissive, thin tubes, turning slowly at
 * slightly different rates. Each is a sweep too (sweeps.js), with
 * a gentle radius profile — base 0.8 swelling by ±16% through
 * `swell` full waves around the loop, phase-free constants on the
 * table below — so the technique shows on the scenery as well as
 * on the citizen. They hold no data and take no address:
 * no pointer handlers, and they render inside the scenery stratum,
 * so the SCENERY layer hides them with the platter.
 */
const ATMOS_KNOTS = [
  { form: "torus43", pos: [133.5, -97], tilt: 0.55, rate: 0.12, color: 0x9fd8cf, emissive: 0x2e7d74, ei: 0.5, swell: 3 },
  { form: "cinquefoil", pos: [-133.5, 97], tilt: 0.85, rate: -0.09, color: 0xd8b25c, emissive: 0xffa726, ei: 0.35, swell: 5 },
];
const ATMOS_BASE_R = 0.8;
const ATMOS_SWELL = 0.16;

function AtmosphereKnots({ ctx }) {
  const spins = useRef([]);
  const geos = useMemo(() => ATMOS_KNOTS.map((k) => {
    const f = KNOT_FORMS[k.form];
    const SAMPLES = 220;
    const path = [];
    for (let i = 0; i < SAMPLES; i++) {
      const [x, y, z] = torusKnotPoint(f.p, f.q, (i / SAMPLES) * Math.PI * 2);
      path.push([x * 3.4, z * 3.4, y * 3.4]);
    }
    return sweepGeometry(tubeAlong(
      path,
      (t) => ATMOS_BASE_R * (1 + ATMOS_SWELL * Math.sin(t * Math.PI * 2 * k.swell)),
      { radialSegments: 10, closed: true },
    ));
  }), []);
  useEffect(() => () => { for (const g of geos) g.dispose(); }, [geos]);
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    if (ctx.stateRef.current.ambientOn === false) return;
    ATMOS_KNOTS.forEach((k, i) => {
      const g = spins.current[i];
      if (g) g.rotation.y += dt * k.rate;
    });
  });
  return (
    <group>
      {ATMOS_KNOTS.map((k, i) => (
        <group key={k.form} position={[k.pos[0], 0, k.pos[1]]}>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[12, 13.5, 4.4, 28]} />
            <meshStandardMaterial color={0x1a2227} roughness={0.9} />
          </mesh>
          <group position={[0, 14.5, 0]} rotation-x={k.tilt}>
            <group ref={(el) => { spins.current[i] = el; }}>
              <mesh geometry={geos[i]}>
                <meshStandardMaterial color={k.color} emissive={k.emissive}
                  emissiveIntensity={k.ei} metalness={0.35} roughness={0.35} />
              </mesh>
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

/* ---------- crystals: symmetry-made minerals, still and living ---------- */

/** A crystals.js solid as a flat-faceted BufferGeometry (fan
 *  triangulation of each face loop, non-indexed, so computeVertex
 *  Normals yields true per-face normals). */
function crystalGeometry(solid, scale) {
  const pos = [];
  for (const loop of solid.faces) {
    const vs = loop.map((vi) => solid.vertices[vi]);
    for (let i = 1; i + 1 < vs.length; i++) {
      for (const v of [vs[0], vs[i], vs[i + 1]]) {
        pos.push(v[0] * scale, v[1] * scale, v[2] * scale);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A crystals.js solid's edges as line-segment positions. */
function crystalEdgesGeometry(solid, scale) {
  const pos = [];
  for (const [a, b] of solid.edges) {
    const va = solid.vertices[a], vb = solid.vertices[b];
    pos.push(va[0] * scale, va[1] * scale, va[2] * scale, vb[0] * scale, vb[1] * scale, vb[2] * scale);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/**
 * THE CRYSTAL CLUSTER (SCENERY): four of the named solids on a
 * low rock plinth at the eastern rim — a tall beta-quartz
 * combination, a cube, a {211} trapezohedron, a rhombic
 * dodecahedron — each GENERATED by crystals.js from one seed face
 * multiplied by its point group, never modelled. Flat-shaded
 * glass shells over emissive inner cores (the same solid at
 * 0.55), edges drawn from the module's edge set so the facets
 * read. Minerals don't spin: the cluster is still, but the cores
 * BREATHE — the Rig eases each core's emissiveIntensity on a slow
 * sine, a few percent, a different phase per crystal (entries
 * registered in frame.crystalCores). Non-addressable; lives in
 * the scenery stratum with the atmosphere knots.
 */
const CLUSTER_CENTRE = [168, -30];
const CLUSTER = [
  { id: "betaQuartz", pos: [-7, -5], scale: 5.5, color: 0xe8f1ee, tilt: [0.05, 0.3, 0.04] },
  { id: "cube", pos: [-12, 6], scale: 4.2, color: 0xffa726, tilt: [0, 0.5, 0.06] },
  { id: "trapezohedron", pos: [11, -8], scale: 3.2, color: 0xd4697a, tilt: [0.08, 0.2, 0] },
  { id: "rhombicDodecahedron", pos: [3, 10], scale: 3.4, color: 0x9a7fd4, tilt: [0, 0.9, 0.05] },
];

function CrystalCluster({ ctx }) {
  const built = useMemo(() => CLUSTER.map((c) => {
    const solid = buildCrystal(c.id);
    let maxZ = 0;
    for (const v of solid.vertices) maxZ = Math.max(maxZ, Math.abs(v[2]));
    const tint = new THREE.Color(c.color).lerp(new THREE.Color(0xffffff), 0.35);
    return {
      ...c,
      geo: crystalGeometry(solid, c.scale),
      edges: crystalEdgesGeometry(solid, c.scale),
      halfH: maxZ * c.scale,
      shell: new THREE.MeshStandardMaterial({
        color: c.color, roughness: 0.15, metalness: 0.1, transparent: true,
        opacity: 0.5, flatShading: true, emissive: c.color, emissiveIntensity: 0.05,
        depthWrite: false,
      }),
      core: new THREE.MeshStandardMaterial({
        color: 0x0b0e10, roughness: 1, transparent: true, opacity: 0.92,
        emissive: c.color, emissiveIntensity: 0.85,
      }),
      line: new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: 0.7 }),
    };
  }), []);
  useEffect(() => {
    const frame = ctx.frame;
    const entries = built.map((b, i) => ({
      mat: b.core, base: 0.85, amp: 0.07, speed: 0.22 + i * 0.06, phase: i * 1.7,
    }));
    frame.crystalCores.push(...entries);
    return () => {
      frame.crystalCores = frame.crystalCores.filter((e) => !entries.includes(e));
      for (const b of built) {
        b.geo.dispose(); b.edges.dispose();
        b.shell.dispose(); b.core.dispose(); b.line.dispose();
      }
    };
  }, [ctx, built]);
  return (
    <group position={[CLUSTER_CENTRE[0], 0, CLUSTER_CENTRE[1]]}>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[24, 27, 4, 7]} />
        <meshStandardMaterial color={0x1a2027} roughness={1} />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[17, 20, 2, 7]} />
        <meshStandardMaterial color={0x232b31} roughness={1} />
      </mesh>
      {built.map((b) => (
        <group key={b.id} position={[b.pos[0], 6 + b.halfH, b.pos[1]]} rotation={b.tilt}>
          <mesh geometry={b.geo} material={b.core} scale={0.55} />
          <mesh geometry={b.geo} material={b.shell} />
          <lineSegments geometry={b.edges} material={b.line} />
        </group>
      ))}
    </group>
  );
}

/* ---------- trees: L-systems, grown not modelled (slice 7) ---------- */

/** Compose the instance matrix for one pipe-model segment, grown to
 *  fraction g of its length (g = 1 at full growth): a unit cylinder
 *  (radius 1 at the base, 0.55 at the tip) stood along the segment. */
const _segUp = new THREE.Vector3(0, 1, 0);
function segMatrix(s, g, M, Q, P, S, D) {
  D.set(s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]);
  const len = Math.max(1e-6, D.length());
  D.divideScalar(len);
  Q.setFromUnitVectors(_segUp, D);
  P.set(
    s.from[0] + D.x * len * g * 0.5,
    s.from[1] + D.y * len * g * 0.5,
    s.from[2] + D.z * len * g * 0.5,
  );
  const r = Math.max(0.02, s.radius * (0.25 + 0.75 * g));
  S.set(r, Math.max(0.02, len * g), r);
  M.compose(P, Q, S);
  return M;
}

/**
 * THE BOTANICAL TREE (SCENERY): a grammar-grown tree on a low earth
 * mound at the western rim — clear of every layout's plots (the
 * nearest, the districts tree plot, is ~58 units away), the knot
 * pedestals, the crystal plinth, the tray spot and the inspection
 * centre. Segments are instanced tapered cylinders coloured by
 * depth; the tips carry instanced leaf discs in muted green-teals
 * with seeded per-leaf variance. It sways a fraction of a degree
 * through the ambient-motion gate and is still when ambient motion
 * is off. Non-addressable; lives in the scenery stratum.
 */
const BOTANICAL_POS = [-150, -88];

function BotanicalTree({ ctx }) {
  const sway = useRef(null);
  const segRef = useRef(null);
  const leafRef = useRef(null);
  const amp = useRef(1);
  const built = useMemo(() => {
    const { segments, tips } = buildBotanicalTree(7);
    const segGeo = new THREE.CylinderGeometry(0.55, 1, 1, 6);
    const barkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    const leafGeo = new THREE.CircleGeometry(1, 6);
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide,
    });
    const rng = createRng(99);
    const leaves = tips.map((s) => ({
      pos: s.to,
      rot: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI],
      scale: 1.1 + rng() * 1.3,
      color: new THREE.Color().setHSL(0.36 + (rng() - 0.5) * 0.12, 0.42, 0.3 + rng() * 0.14),
    }));
    return { segments, segGeo, barkMat, leafGeo, leafMat, leaves };
  }, []);
  useEffect(() => () => {
    built.segGeo.dispose(); built.barkMat.dispose();
    built.leafGeo.dispose(); built.leafMat.dispose();
  }, [built]);
  useLayoutEffect(() => {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    const P = new THREE.Vector3(), S = new THREE.Vector3(), D = new THREE.Vector3();
    const C = new THREE.Color();
    const sm = segRef.current;
    if (sm) {
      built.segments.forEach((s, i) => {
        sm.setMatrixAt(i, segMatrix(s, 1, M, Q, P, S, D));
        const f = Math.min(1, s.depth / 9);
        sm.setColorAt(i, C.setHSL(0.07, 0.32, 0.13 + 0.13 * f));
      });
      sm.instanceMatrix.needsUpdate = true;
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    }
    const lm = leafRef.current;
    if (lm) {
      const E = new THREE.Euler();
      built.leaves.forEach((leaf, i) => {
        E.set(leaf.rot[0], leaf.rot[1], leaf.rot[2]);
        Q.setFromEuler(E);
        P.set(leaf.pos[0], leaf.pos[1], leaf.pos[2]);
        S.setScalar(leaf.scale);
        M.compose(P, Q, S);
        lm.setMatrixAt(i, M);
        lm.setColorAt(i, leaf.color);
      });
      lm.instanceMatrix.needsUpdate = true;
      if (lm.instanceColor) lm.instanceColor.needsUpdate = true;
    }
  }, [built]);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    if (sway.current) {
      const t = state.clock.elapsedTime;
      sway.current.rotation.z = a * 0.011 * Math.sin(t * 0.45);
      sway.current.rotation.x = a * 0.008 * Math.sin(t * 0.32 + 1.1);
    }
    if (leafRef.current) {
      const t = state.clock.elapsedTime;
      const s = 1 + a * 0.03 * Math.sin(t * 1.35);
      leafRef.current.scale.setScalar(s);
    }
  });
  return (
    <group position={[BOTANICAL_POS[0], 0, BOTANICAL_POS[1]]}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[15, 19, 3.2, 24]} />
        <meshStandardMaterial color={0x222a1e} roughness={1} />
      </mesh>
      <mesh position={[0, 3.6, 0]}>
        <cylinderGeometry args={[9.5, 12.5, 1.6, 24]} />
        <meshStandardMaterial color={0x2a3323} roughness={1} />
      </mesh>
      <group position={[0, 4.2, 0]} scale={1.55}>
        <group ref={sway}>
          <instancedMesh ref={segRef} args={[undefined, undefined, built.segments.length]}
            geometry={built.segGeo} material={built.barkMat} />
          <instancedMesh ref={leafRef} args={[undefined, undefined, built.leaves.length]}
            geometry={built.leafGeo} material={built.leafMat} />
        </group>
      </group>
    </group>
  );
}

/**
 * THE LIVING CRYSTAL — the eleventh citizen. An octahedron whose
 * eight faces carry the FACE_DATA values: face i's plane distance
 * is distanceForValue(value_i), so the shape is the chart. The
 * values drift in the horizon monitor's tempered-walk style
 * (each walks toward a wandering target, stepped at ~2 Hz), and
 * when any distance has moved more than 0.01 (crystals.js units)
 * since the last build, the solid is REGENERATED from the
 * symmetry machinery and the geometry swapped — faces visibly
 * advance and retreat, at most ~2 regrowths a second for an
 * 8-face solid. It turns slowly (~3°/s) on its pedestal, always;
 * the spin pauses while it is inspected or drag-locked, and the
 * Rig's transform group still applies on top when addressed.
 * Each frame it publishes its faces (label, live value, world
 * centroid) to frame.crystalFaces — the overlay pins a value chip
 * on every face while the crystal is current or inspected — and
 * a values snapshot to shared.crystalValues for its panels.
 */
const CRYSTAL_CY = 17;
const CRYSTAL_SCALE = 7;

function MiniCrystal({ lib, matFor, ctx }) {
  const spin = useRef(null);
  const shellRef = useRef(null);
  const coreRef = useRef(null);
  const edgeRef = useRef(null);
  const sim = useRef(null);
  if (!sim.current) {
    sim.current = {
      values: FACE_DATA.map((f) => f.value),
      targets: FACE_DATA.map((f) => f.value),
      builtDistances: null, solid: null, geo: null, edgeGeo: null,
      rng: 987654321, acc: 0,
    };
  }
  const mats = useMemo(() => ({
    shell: matFor(0xbfe3da, { opacity: 0.55, glowScale: 0.8, rough: 0.2 }),
    core: matFor(0x7fd4c1, { opacity: 0.85, glowScale: 1.1, rough: 0.4 }),
    line: new THREE.LineBasicMaterial({ color: 0xd8f3ec, transparent: true, opacity: 0.55 }),
  }), [matFor]);

  const buildGeo = (values) => {
    const S = sim.current;
    const solid = solidFromForms([formPlanes("m-3m", [1, 1, 1], values.map(distanceForValue))]);
    S.solid = solid;
    S.builtDistances = values.map(distanceForValue);
    S.geo = crystalGeometry(solid, CRYSTAL_SCALE);
    S.edgeGeo = crystalEdgesGeometry(solid, CRYSTAL_SCALE);
    return S;
  };

  useLayoutEffect(() => {
    const S = buildGeo(sim.current.values);
    if (shellRef.current) shellRef.current.geometry = S.geo;
    if (coreRef.current) coreRef.current.geometry = S.geo;
    if (edgeRef.current) edgeRef.current.geometry = S.edgeGeo;
  }, []);
  useEffect(() => () => {
    const S = sim.current;
    S.geo?.dispose();
    S.edgeGeo?.dispose();
    mats.line.dispose();
  }, [mats]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    const st = ctx.stateRef.current;
    const S = sim.current;
    const paused = st.inspectedId === "crystal"
      || (st.shared.drag && st.shared.drag.id === "crystal");
    const ambient = st.ambientOn !== false;
    if (spin.current && !paused && ambient) spin.current.rotation.y += dt * 3 * DEG;
    // Drift: tempered walk, stepped at 2 Hz. The Ambient motion
    // toggle stills the crystal too: no drift, no regrowth.
    S.acc += ambient ? dt : 0;
    if (S.acc >= 0.5) {
      S.acc %= 0.5;
      for (let i = 0; i < 8; i++) {
        const dv = S.targets[i] - S.values[i];
        S.values[i] += Math.sign(dv) * Math.min(Math.abs(dv), FACE_DATA[i].wander * 0.5);
        if (Math.abs(S.targets[i] - S.values[i]) < 0.02) {
          S.rng = (S.rng * 1103515245 + 12345) % 2147483648;
          S.targets[i] = 0.15 + 0.7 * (S.rng / 2147483648);
        }
      }
    }
    // Regrow only when a face's distance moved past the threshold.
    const distances = S.values.map(distanceForValue);
    if (!S.builtDistances || distances.some((d, i) => Math.abs(d - S.builtDistances[i]) > 0.01)) {
      const prevGeo = S.geo, prevEdge = S.edgeGeo;
      buildGeo(S.values);
      if (shellRef.current) shellRef.current.geometry = S.geo;
      if (coreRef.current) coreRef.current.geometry = S.geo;
      if (edgeRef.current) edgeRef.current.geometry = S.edgeGeo;
      if (prevGeo && prevGeo !== S.geo) prevGeo.dispose();
      if (prevEdge && prevEdge !== S.edgeGeo) prevEdge.dispose();
    }
    // Publish the faces: chips ride the centroids; panels read
    // the snapshot. Face i is FACE_DATA[i] by canonical ordering.
    if (spin.current && S.solid && S.solid.faces.length === 8) {
      spin.current.updateWorldMatrix(true, false);
      ctx.frame.crystalFaces = S.solid.faces.map((loop, i) => {
        const c = new THREE.Vector3();
        for (const vi of loop) {
          const v = S.solid.vertices[vi];
          c.x += v[0]; c.y += v[1]; c.z += v[2];
        }
        c.multiplyScalar(CRYSTAL_SCALE / loop.length);
        return { label: FACE_DATA[i].label, value: S.values[i], world: spin.current.localToWorld(c) };
      });
      st.shared.crystalValues = FACE_DATA.map((f, i) => ({ label: f.label, value: S.values[i] }));
    }
  });

  return (
    <group>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[12.5, 14, 4, 28]} />
        <primitive object={matFor(0x27313a, { rough: 0.85 })} attach="material" />
      </mesh>
      <group ref={spin} position={[0, CRYSTAL_CY, 0]}>
        <mesh ref={coreRef} material={mats.core} scale={0.55} />
        <mesh ref={shellRef} material={mats.shell} />
        <lineSegments ref={edgeRef} material={mats.line} />
      </group>
    </group>
  );
}

/**
 * THE DATA TREE — the twelfth citizen. Flare's hierarchy grown by
 * lsystems.js into instanced tapered segments on a soil plot, with
 * an emissive bud at every tip scaled by the value the tip
 * aggregates. Branch hues are the sunburst house colours (geoLib),
 * darkened to bark on the wood. It GROWS IN on first mount —
 * segment lengths staged by depth over ~1.6 s, a one-time
 * animation; the data state is untouched — and afterwards sways
 * very slowly through the ambient gate.
 *
 * Depth-1 branches are sub-addresses (the knot-part pattern):
 * instanced pointer events report the instance's branch to the
 * App, which gates it on the tree being current; the hovered or
 * focused branch's whole subtree brightens (instance colours)
 * while the rest dims. The sway group registers as
 * frame.treeGroupRef and the branches' local spheres as
 * frame.branchLocal — the Rig turns them into frame.branchWorld
 * for the focus seat and the overlay chips.
 */
function MiniTree({ lib, matFor, ctx }) {
  const sway = useRef(null);
  const segRef = useRef(null);
  const budRef = useRef(null);
  const amp = useRef(1);
  const grown = useRef(0);
  const lastHi = useRef("__init");
  const data = useMemo(() => ({
    segMat: matFor(0xffffff, { rough: 0.85 }),
    budMat: matFor(0xffffff, { rough: 0.35, glowScale: 1.2 }),
    base: lib.treeSegs.map((s) => new THREE.Color(s.branchColor).multiplyScalar(0.42)),
    budBase: lib.treeBuds.map((b) => new THREE.Color(b.color)),
  }), [lib, matFor]);

  useEffect(() => {
    const frame = ctx.frame;
    frame.treeGroupRef = sway.current;
    const local = new Map();
    for (const b of lib.dataTree.branches) {
      local.set(b.id, {
        centre: new THREE.Vector3(...b.sphere.centre),
        radius: b.sphere.radius,
        tip: new THREE.Vector3(...b.tipPoint),
      });
    }
    frame.branchLocal = local;
    return () => {
      if (frame.treeGroupRef === sway.current) frame.treeGroupRef = null;
      if (frame.branchLocal === local) frame.branchLocal = null;
    };
  }, [ctx, lib]);

  const growthFor = (depth, t) => {
    const x = Math.min(1, Math.max(0, (t - depth * 0.38) / 0.5));
    return x * x * (3 - 2 * x);
  };
  const writeInstances = (t) => {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    const P = new THREE.Vector3(), S = new THREE.Vector3(), D = new THREE.Vector3();
    const sm = segRef.current;
    if (sm) {
      lib.treeSegs.forEach((s, i) => {
        sm.setMatrixAt(i, segMatrix(s, growthFor(s.depth, t), M, Q, P, S, D));
      });
      sm.instanceMatrix.needsUpdate = true;
    }
    const bm = budRef.current;
    if (bm) {
      const g = growthFor(lib.dataTree.maxDepth, t);
      lib.treeBuds.forEach((b, i) => {
        P.set(b.pos[0], b.pos[1], b.pos[2]);
        Q.identity();
        S.setScalar(Math.max(0.02, b.r * g));
        M.compose(P, Q, S);
        bm.setMatrixAt(i, M);
      });
      bm.instanceMatrix.needsUpdate = true;
    }
  };
  const applyColours = (hiId) => {
    const C = new THREE.Color();
    const sm = segRef.current;
    if (sm) {
      lib.treeSegs.forEach((s, i) => {
        const f = !hiId ? 1 : s.branchId === hiId ? 2.1 : 0.55;
        sm.setColorAt(i, C.copy(data.base[i]).multiplyScalar(f));
      });
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    }
    const bm = budRef.current;
    if (bm) {
      lib.treeBuds.forEach((b, i) => {
        const f = !hiId ? 1 : b.branchId === hiId ? 1.7 : 0.6;
        bm.setColorAt(i, C.copy(data.budBase[i]).multiplyScalar(f));
      });
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
    }
  };
  useLayoutEffect(() => {
    writeInstances(0);
    applyColours(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    const a = ambientAmp(amp, ctx, dt);
    if (sway.current) {
      const t = state.clock.elapsedTime;
      sway.current.rotation.z = a * 0.009 * Math.sin(t * 0.4);
      sway.current.rotation.x = a * 0.007 * Math.sin(t * 0.29 + 0.7);
    }
    // Grow-in: one pass staged by depth, then the matrices rest.
    if (grown.current < 2.2) {
      grown.current += dt;
      writeInstances(grown.current);
    }
    const st = ctx.stateRef.current;
    const hov = st.currentId === "tree" ? st.branchHoverId : null;
    const foc = st.partFocus && st.partFocus.objectId === "tree" ? st.partFocus.partId : null;
    const hi = hov || foc || null;
    if (hi !== lastHi.current) {
      lastHi.current = hi;
      applyColours(hi);
    }
  });

  const st = () => ctx.stateRef.current;
  const reportSeg = (e) => {
    if (e.instanceId == null) return;
    const bid = lib.treeSegs[e.instanceId].branchId;
    if (bid && st().onBranchHover) st().onBranchHover(bid);
  };
  const reportBud = (e) => {
    if (e.instanceId == null) return;
    const bid = lib.treeBuds[e.instanceId].branchId;
    if (bid && st().onBranchHover) st().onBranchHover(bid);
  };
  const clearReport = () => { if (st().onBranchHover) st().onBranchHover(null); };

  return (
    <group>
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[19, 21.5, 2.2, 28]} />
        <primitive object={matFor(0x2a241b, { rough: 1 })} attach="material" />
      </mesh>
      <group ref={sway} position={[0, 2.2, 0]}>
        <instancedMesh
          ref={segRef}
          args={[undefined, undefined, lib.treeSegs.length]}
          material={data.segMat}
          onPointerOver={reportSeg}
          onPointerOut={clearReport}
        >
          <cylinderGeometry args={[0.55, 1, 1, 7]} />
        </instancedMesh>
        <instancedMesh
          ref={budRef}
          args={[undefined, undefined, lib.treeBuds.length]}
          material={data.budMat}
          onPointerOver={reportBud}
          onPointerOut={clearReport}
        >
          <sphereGeometry args={[1, 10, 10]} />
        </instancedMesh>
      </group>
    </group>
  );
}

/* ---------------- slice 13-2: the cylinder book ---------------- */

const BOOK_VIEW = bookTable();
const BOOK_SPREADS_VIEW = bookSpreads();

/** The book's geometry, in citizen units (bounds 0..~26.3). */
const BK = {
  drumR: 13, drumY: 13.6, drumH: 24, // the drum body, y 1.6..25.6
  bandR: 13.25,
  chBandY: 22.3, chBandH: 5, // the CHAPTER band, upper
  secBandY: 16.4, secBandH: 4.6, // the SECTION band, lower
  leafY: 12.3, leafH: 20, leafMidR: 19.7, // leaves: r 13.2..26.2, y 2.3..22.3
  pageOut: 16, // how far a page slides out of the drum
};
const BK_BAR_Y = [6.2, 9.3, 12.4, 15.5, 18.6];

const chapterOfId = (id) => id.split("/").slice(0, 2).join("/");
const sectionOfId = (id) => (id.split("/").length > 2 ? id.split("/").slice(0, 3).join("/") : null);

/**
 * One tier node's light factor under the book's two attentions:
 * ACCESS ghosts what stands outside it (another chapter's pages
 * to a ghost, its bands half; another section's pages half), and
 * the ADDRESSED node — hovered, or the deepest accessed tier —
 * lights its own subtree while the rest of the book dims, the
 * slice-12 treatment (1.9 / 0.55) carried into the tiers.
 */
function bookTierFactor(node, hi, accCh, accSec) {
  let f = 1;
  if (accCh && chapterOfId(node.id) !== accCh) f *= node.kind === "page" ? 0.32 : 0.5;
  else if (accSec && node.kind === "page" && sectionOfId(node.id) !== accSec) f *= 0.5;
  else if (accSec && node.kind === "section" && node.id !== accSec) f *= 0.8;
  if (hi) {
    if (node.id === hi) f *= 1.9;
    else if (hi.startsWith(`${node.id}/`)) f *= node.kind === "chapter" ? 1.3 : 1.5;
    else if (node.id.startsWith(`${hi}/`)) f *= 1.15;
    else f *= 0.55;
  }
  return f;
}

/**
 * The CYLINDER presentation: a drum at the plot (r 13, body
 * y 1.6..25.6 on a plinth), its surface carrying the tiers as
 * two arc bands — CHAPTERS above (y 19.8..24.8), SECTIONS below
 * (y 14.1..18.7) — each segment's angular span proportional to
 * its page count (book.js's partition: a sunburst unwrapped
 * around the cylinder), coloured by chapter. At the rim, one
 * RADIAL LEAF per page: a thin vertical plane (0.45 thick,
 * 20 high) running from the drum surface outward 13 units, its
 * angle its page's arc midpoint, thin line-bars on both faces
 * suggesting print, in its chapter's hue family.
 *
 * The whole drum assembly TURNS (an eased display rotation,
 * here) so the accessed tier's arc midpoint faces the front;
 * accessing ghosts the tiers outside (bookTierFactor — the
 * accessed chapter's leaves do NOT fan: the leaves are
 * slot-centred on arcs they already fill, so a fan would overlap
 * the neighbours; the read is carried by the turn and the
 * ghosting). A page F'd out slides radially outward 16 units on
 * its own eased offset. Anchors are republished every frame in
 * the wrapper's local frame, turn and slide applied, so the
 * in-space card rides the node it names.
 */
function BookCylinder({ ctx, matFor, anchors }) {
  const table = BOOK_VIEW;
  const owned = useMemo(() => {
    const map = new Map();
    for (const n of table.all) {
      if (n.kind === "chapter") {
        map.set(n.id, { mat: matFor(n.color, { rough: 0.5 }), base: new THREE.Color(n.color) });
      } else if (n.kind === "section") {
        const base = new THREE.Color(n.color).multiplyScalar(0.72);
        map.set(n.id, { mat: matFor(base, { rough: 0.55 }), base });
      } else if (n.kind === "page") {
        const base = new THREE.Color(n.color).multiplyScalar(0.92);
        const barBase = new THREE.Color(n.color).multiplyScalar(1.55);
        map.set(n.id, {
          mat: matFor(base, { rough: 0.6 }), base,
          barMat: matFor(barBase, { rough: 0.5 }), barBase,
        });
      }
    }
    return map;
  }, [table, matFor]);
  const bandGeos = useMemo(() => {
    const map = new Map();
    for (const n of table.all) {
      if (n.kind !== "chapter" && n.kind !== "section") continue;
      const span = n.a1 - n.a0;
      const gap = Math.min(0.02, span * 0.1);
      map.set(n.id, new THREE.CylinderGeometry(
        BK.bandR, BK.bandR, n.kind === "chapter" ? BK.chBandH : BK.secBandH,
        Math.max(2, Math.ceil(span / 0.08)), 1, true,
        n.a0 + gap, Math.max(0.01, span - gap * 2),
      ));
    }
    return map;
  }, [table]);
  const leafGeo = useMemo(() => new THREE.BoxGeometry(0.45, BK.leafH, 13), []);
  const barGeo = useMemo(() => new THREE.BoxGeometry(0.1, 0.55, 9.2), []);
  const turnRef = useRef(null);
  const turnCur = useRef(0);
  const slideRefs = useRef(new Map());
  const outCur = useRef(new Map());
  const lastHi = useRef(undefined);
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    const st = ctx.stateRef.current;
    const access = st.bookAccess;
    // The turn: ease toward the accessed tier's midpoint brought
    // to the front (angle 0), by the wrapped delta — the drum
    // never spins the long way round.
    const deepId = bookAccessedId(access);
    const deep = deepId ? table.byId.get(deepId) : null;
    const target = deep ? -deep.mid : 0;
    let d = target - turnCur.current;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    turnCur.current += d * (1 - Math.exp(-4.5 * dt));
    if (turnRef.current) turnRef.current.rotation.y = turnCur.current;
    // The page out: one leaf's radial slide, eased per leaf.
    const outId = bookPageOutId(access);
    for (const p of table.pages) {
      const cur = damp(outCur.current.get(p.id) || 0, outId === p.id ? BK.pageOut : 0, 6, dt);
      outCur.current.set(p.id, cur);
      const g = slideRefs.current.get(p.id);
      if (g) g.position.z = cur;
    }
    // Anchors in the wrapper's local frame, turn and slide in.
    const turn = turnCur.current;
    for (const n of table.all) {
      if (n.kind === "root") continue;
      let a = anchors.get(n.id);
      if (!a) { a = { centre: new THREE.Vector3(), radius: 0 }; anchors.set(n.id, a); }
      const ang = n.mid + turn;
      if (n.kind === "page") {
        const r = BK.leafMidR + (outCur.current.get(n.id) || 0);
        a.centre.set(Math.sin(ang) * r, 17, Math.cos(ang) * r);
        a.radius = 3;
      } else {
        a.centre.set(Math.sin(ang) * 14.6, n.kind === "chapter" ? BK.chBandY : BK.secBandY, Math.cos(ang) * 14.6);
        a.radius = Math.max(3, (n.a1 - n.a0) * 14.6 * 0.4);
      }
    }
    // The highlight, rewritten only when its signature changes.
    const hov = st.currentId === "book" && st.subHover && st.subHover.objectId === "book"
      ? st.subHover.nodeId : null;
    const accCh = access && access.path && access.path.length ? access.path[0] : null;
    const accSec = access && access.path && access.path.length > 1 ? access.path[1] : null;
    const hi = hov || deepId;
    const sig = `${hi}|${accCh}|${accSec}`;
    if (sig !== lastHi.current) {
      lastHi.current = sig;
      for (const n of table.all) {
        const e = owned.get(n.id);
        if (!e) continue;
        const f = bookTierFactor(n, hi, accCh, accSec);
        e.mat.color.copy(e.base).multiplyScalar(f);
        if (e.barMat) e.barMat.color.copy(e.barBase).multiplyScalar(f);
      }
    }
  });
  const st = () => ctx.stateRef.current;
  const report = (id) => {
    if (st().currentId !== "book" || !st().onSubHover) return;
    st().onSubHover("book", id);
  };
  const clear = () => { if (st().onSubHover) st().onSubHover("book", null); };
  return (
    <group>
      {/* The plinth stands still; the drum turns on it. */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[15.5, 16.5, 1.6, 48]} />
        <primitive object={matFor(0x27313a, { rough: 0.85 })} attach="material" />
      </mesh>
      <group ref={turnRef}>
        <mesh position={[0, BK.drumY, 0]}>
          <cylinderGeometry args={[BK.drumR, BK.drumR, BK.drumH, 48]} />
          <primitive object={matFor(0x39434b, { rough: 0.7 })} attach="material" />
        </mesh>
        <mesh position={[0, 25.75, 0]}>
          <cylinderGeometry args={[13.2, 13.2, 0.7, 48]} />
          <primitive object={matFor(0x8a97a0, { rough: 0.45 })} attach="material" />
        </mesh>
        <mesh position={[0, 26.1, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[13.2, 0.55, 8, 48]} />
          <primitive object={matFor(0x8a97a0, { rough: 0.45 })} attach="material" />
        </mesh>
        {table.root.children.map((ch) => (
          <mesh key={ch.id} geometry={bandGeos.get(ch.id)} position={[0, BK.chBandY, 0]}
            material={owned.get(ch.id).mat}
            onPointerOver={() => report(ch.id)}
            onPointerMove={() => report(ch.id)}
            onPointerOut={clear} />
        ))}
        {table.all.filter((n) => n.kind === "section").map((sec) => (
          <mesh key={sec.id} geometry={bandGeos.get(sec.id)} position={[0, BK.secBandY, 0]}
            material={owned.get(sec.id).mat}
            onPointerOver={() => report(sec.id)}
            onPointerMove={() => report(sec.id)}
            onPointerOut={clear} />
        ))}
        {table.pages.map((p) => (
          <group key={p.id} rotation-y={p.mid}>
            <group ref={(el) => {
              if (el) slideRefs.current.set(p.id, el);
              else slideRefs.current.delete(p.id);
            }}>
              <mesh geometry={leafGeo} position={[0, BK.leafY, BK.leafMidR]}
                material={owned.get(p.id).mat}
                onPointerOver={() => report(p.id)}
                onPointerMove={() => report(p.id)}
                onPointerOut={clear} />
              {[-1, 1].map((f) => BK_BAR_Y.map((y, i) => (
                <mesh key={`${f}:${i}`} geometry={barGeo}
                  position={[f * 0.28, y, BK.leafMidR]}
                  material={owned.get(p.id).barMat} />
              )))}
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/** One standing leaf of the spread: its page's line-bars on the
 *  front face (the first, shorter and amber, is the title), its
 *  page number at its foot — or, for a blank side, a plain leaf
 *  that only clears the hover. */
function SpreadLeaf({ side, page, owned, blankMat, report, clear }) {
  const x = side === "verso" ? -8.4 : 8.4;
  const ry = side === "verso" ? 0.3 : -0.3;
  if (!page) {
    return (
      <group position={[x, 0, 0]} rotation-y={ry}>
        <group position={[0, 13.1, 0]} rotation-x={-0.1}>
          <mesh material={blankMat} onPointerOver={clear} onPointerMove={clear}>
            <boxGeometry args={[16.5, 23, 0.5]} />
          </mesh>
        </group>
      </group>
    );
  }
  const bars = [8, 12.4, 11.2, 12.6, 10.8, 12.2, 9.4];
  return (
    <group position={[x, 0, 0]} rotation-y={ry}>
      <group position={[0, 13.1, 0]} rotation-x={-0.1}>
        <mesh material={owned.mat}
          onPointerOver={() => report(page.id)}
          onPointerMove={() => report(page.id)}
          onPointerOut={clear}>
          <boxGeometry args={[16.5, 23, 0.5]} />
        </mesh>
        {bars.map((w, i) => (
          <mesh key={i} position={[i === 0 ? -1.5 : 0, 8.6 - i * 2.7, 0.31]}>
            <boxGeometry args={[w, i === 0 ? 0.8 : 0.55, 0.1]} />
            {i === 0 ? (
              <meshStandardMaterial color={0xffc46b} roughness={0.5} />
            ) : (
              <primitive object={owned.barMat} attach="material" />
            )}
          </mesh>
        ))}
        <mesh position={[side === "verso" ? -5.6 : 5.6, -9.4, 0.31]}>
          <planeGeometry args={[3.2, 3.2]} />
          <meshBasicMaterial map={pageNumberTexture(page.number)} transparent />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The SPREAD presentation: the drum unmounts and an open codex
 * stands at the same plot — a slab, and two leaves angled toward
 * each other (verso left, recto right, a slight dihedral of
 * 0.30 rad each way, leaning back a touch). The pairing is
 * book.js's: the title page stands alone as the first spread's
 * recto with a blank verso; pages then pair in reading order.
 * B and N flip the spread (the App dispatches them here while
 * the presentation stands); F on a standing leaf turns to its
 * page's spread.
 */
function BookSpread({ ctx, matFor, anchors, spreadIndex }) {
  const spread = BOOK_SPREADS_VIEW[
    Math.max(0, Math.min(SPREAD_COUNT - 1, spreadIndex || 0))
  ] || { verso: null, recto: null };
  const owned = useMemo(() => {
    const map = new Map();
    for (const page of [spread.verso, spread.recto]) {
      if (!page) continue;
      const base = new THREE.Color(page.color).multiplyScalar(0.95);
      const barBase = new THREE.Color(page.color).multiplyScalar(1.55);
      map.set(page.id, {
        mat: matFor(base, { rough: 0.6 }), base,
        barMat: matFor(barBase, { rough: 0.5 }), barBase,
      });
    }
    return map;
  }, [spread, matFor]);
  const blankMat = useMemo(() => matFor(0x232b31, { rough: 0.85 }), [matFor]);
  useEffect(() => {
    // Only the standing pages hold anchors in this presentation;
    // every other tier parks at the book's centre, unaddressed.
    for (const n of BOOK_VIEW.all) {
      if (n.kind === "root") continue;
      let a = anchors.get(n.id);
      if (!a) { a = { centre: new THREE.Vector3(), radius: 0 }; anchors.set(n.id, a); }
      a.centre.set(0, 20, 4);
      a.radius = 0;
    }
    if (spread.verso) {
      const a = anchors.get(spread.verso.id);
      a.centre.set(-8.4, 17, 2);
      a.radius = 4;
    }
    if (spread.recto) {
      const a = anchors.get(spread.recto.id);
      a.centre.set(8.4, 17, 2);
      a.radius = 4;
    }
  }, [anchors, spread]);
  const lastHi = useRef(undefined);
  useFrame(() => {
    const st = ctx.stateRef.current;
    const hov = st.currentId === "book" && st.subHover && st.subHover.objectId === "book"
      ? st.subHover.nodeId : null;
    if (hov === lastHi.current) return;
    lastHi.current = hov;
    for (const [id, e] of owned) {
      const f = !hov ? 1 : id === hov ? 1.9 : 0.8;
      e.mat.color.copy(e.base).multiplyScalar(f);
      e.barMat.color.copy(e.barBase).multiplyScalar(f);
    }
  });
  const st = () => ctx.stateRef.current;
  const report = (id) => {
    if (st().currentId !== "book" || !st().onSubHover) return;
    st().onSubHover("book", id);
  };
  const clear = () => { if (st().onSubHover) st().onSubHover("book", null); };
  return (
    <group>
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[42, 1.6, 27]} />
        <primitive object={matFor(0x27313a, { rough: 0.85 })} attach="material" />
      </mesh>
      <mesh position={[0, 1.85, 0]}>
        <boxGeometry args={[2, 0.5, 26]} />
        <primitive object={matFor(0x141a1e, { rough: 0.9 })} attach="material" />
      </mesh>
      <SpreadLeaf side="verso" page={spread.verso}
        owned={spread.verso ? owned.get(spread.verso.id) : null}
        blankMat={blankMat} report={report} clear={clear} />
      <SpreadLeaf side="recto" page={spread.recto}
        owned={spread.recto ? owned.get(spread.recto.id) : null}
        blankMat={blankMat} report={report} clear={clear} />
    </group>
  );
}

/**
 * The cylinder book citizen (slice 13-2): one wrapper group —
 * the registered sub-node group, whose local anchors the Rig
 * turns into world for the in-space card — holding whichever
 * presentation stands: the CYLINDER (drum, bands, radial leaves)
 * or the SPREAD (the open codex). The presentation is the App's
 * bookStyle parameter (U toggles it while the book is current);
 * the access and the transform live outside, untouched by the
 * switch, as everywhere in the space.
 */
function MiniBook({ lib, matFor, ctx, bookStyle, bookSpread }) {
  const wrapRef = useRef(null);
  const anchors = useMemo(() => new Map(), []);
  useEffect(() => {
    const frame = ctx.frame;
    frame.subGroupRefs.set("book", wrapRef.current);
    frame.subLocal.set("book", anchors);
    return () => {
      frame.subGroupRefs.delete("book");
      if (frame.subLocal.get("book") === anchors) frame.subLocal.delete("book");
    };
  }, [ctx, anchors]);
  return (
    <group ref={wrapRef}>
      {bookStyle === "spread" ? (
        <BookSpread ctx={ctx} matFor={matFor} anchors={anchors} spreadIndex={bookSpread} />
      ) : (
        <BookCylinder ctx={ctx} matFor={matFor} anchors={anchors} />
      )}
    </group>
  );
}

/* ---------- slice 14: the devices citizen and its network ---------- */

/**
 * A host token's place on the ring (world-group coordinates):
 * the connections spread across the BACK arc of the annulus —
 * the front belongs to the Waveform token and, while an app
 * holds the stage, to the app's furniture. The tokens stand on
 * the annulus geometrically but are WORLD-ANCHORED: they are
 * not in the rotating ring group (PlatterRing's), so the ring's
 * rest spin never carries them; they ride the world group like
 * everything else in the space. Angle 0 is the +X rim and the
 * spread runs 202°..338°, through the back (−Z).
 */
export function netTokenPosition(index, count) {
  const deg = count <= 1 ? 270 : 202 + (index * 136) / (count - 1);
  const a = deg * DEG;
  return {
    x: Math.cos(a) * RING_R,
    z: Math.sin(a) * RING_R,
    rotY: Math.atan2(-Math.cos(a), -Math.sin(a)),
  };
}

/** An arc for a connection cable: the endpoints, and a midpoint
 *  lifted above both — a cable thrown from the shelf's hub out
 *  to the ring, hanging in the air of the space. */
function netArcCurve(pa, pb) {
  const mid = pa.clone().add(pb).multiplyScalar(0.5);
  mid.y = Math.max(pa.y, pb.y) + 14 + pa.distanceTo(pb) * 0.08;
  return new THREE.CatmullRomCurve3([pa.clone(), mid, pb.clone()]);
}

/**
 * THE DEVICES CITIZEN (slice 14): the machine's own attachments
 * on one shelf, from the environment snapshot (environment.js).
 * The shelf is a low plinth at the plot; on it, one small form
 * per device the snapshot carries — a kind absent from the
 * snapshot builds no form. The PRINTER is a small press (body,
 * lid, an amber output slot, a tray), and it carries its QUEUE
 * as geometry: one sheet of paper stands in the output tray
 * per queued job, and the printing job's sheet is half-fed
 * into the press. The keyboard is a slab with a grid of keys;
 * the pointer a pebble; the display a small screen on a stand;
 * the volumes slabs with a lit stripe. At the shelf's right
 * edge stands the HUB, a small switch with a port per
 * connection — the cables' home end (NetworkLayer, below).
 *
 * Every device, the hub and (through the per-frame anchor
 * republication) the hosts are SUB-NODES (subnodes.js): hover
 * lights the form and stands its card, F takes the part-focus
 * seat — the slice-12 treatment, on owned materials. The host
 * anchors are the one wrinkle: the tokens stand on the ring,
 * OUTSIDE this citizen's plot, so each frame their anchors are
 * recomputed into this group's local frame (token world →
 * group local), and the Rig's sub-node pass turns them back
 * into world for the card and the seat, exactly like every
 * other sub-node's. The hub's top is published each frame in
 * world-group coordinates (frame.netHubLocal) for the cables.
 */
function MiniDevices({ lib, matFor, ctx }) {
  const wrapRef = useRef(null);
  const hubTopRef = useRef(null);
  const keysRef = useRef(null);
  const anchors = useMemo(() => new Map(), []);
  const devices = useMemo(() => deviceList(ENVIRONMENT), []);
  const printer = useMemo(() => printerOf(ENVIRONMENT), []);
  const conns = useMemo(() => connectionsOf(ENVIRONMENT), []);
  const connIds = useMemo(() => connectionIds(ENVIRONMENT), []);
  const scratch = useMemo(() => ({ v: new THREE.Vector3() }), []);

  // The stands on the shelf: fixed per kind; the volumes take
  // the two left-hand stands in data order.
  const plots = useMemo(() => {
    const map = new Map();
    let vol = 0;
    for (const d of devices) {
      if (d.kind === "printer") map.set(d.slug, { x: -10.5, z: -1.5, top: 9.4, r: 4.5 });
      else if (d.kind === "keyboard") map.set(d.slug, { x: 2.5, z: 7.5, top: 5, r: 3.5 });
      else if (d.kind === "pointer") map.set(d.slug, { x: 12, z: 7.5, top: 4.6, r: 2.5 });
      else if (d.kind === "display") map.set(d.slug, { x: 6.5, z: -8, top: 12.6, r: 4.5 });
      else if (d.kind === "storage") {
        map.set(d.slug, vol === 0
          ? { x: -13.5, z: 8, top: 6, r: 3 }
          : { x: -13.5, z: -8, top: 6, r: 3 });
        vol++;
      }
    }
    return map;
  }, [devices]);

  const owned = useMemo(() => {
    const map = new Map();
    const mats = {};
    const own = (id, key, color, opts) => {
      const mat = matFor(color, opts);
      if (!map.has(id)) map.set(id, []);
      map.get(id).push({ mat, base: new THREE.Color(color) });
      mats[key] = mat;
      return mat;
    };
    for (const d of devices) {
      const id = `devices/${d.slug}`;
      if (d.kind === "printer") {
        own(id, "printerBody", 0x9fb2ba, { rough: 0.5 });
        own(id, "printerAccent", 0xffa726, { rough: 0.4 });
        own(id, "printerPaper", 0xe8e4d8, { rough: 0.85 });
      } else if (d.kind === "keyboard") {
        own(id, "keyboardBody", 0x39434b, { rough: 0.6 });
        own(id, "keyboardKeys", 0x51707c, { rough: 0.5 });
      } else if (d.kind === "pointer") {
        own(id, "pointer", 0x8e6cc8, { rough: 0.45 });
      } else if (d.kind === "display") {
        own(id, "displayFrame", 0x2b3941, { rough: 0.55 });
        own(id, "displayScreen", 0x5b8fd6, { rough: 0.35 });
      } else if (d.kind === "storage") {
        own(id, `vol-${d.slug}`, 0x2e5d43, { rough: 0.55 });
        own(id, `volStripe-${d.slug}`, 0x74c476, { rough: 0.45 });
      }
    }
    if (conns.length) {
      own("devices/net", "hubBody", 0x2e7d74, { rough: 0.45 });
      own("devices/net", "hubPorts", 0xc9f7e8, { rough: 0.35 });
    }
    return { map, mats };
  }, [devices, conns, matFor]);

  useEffect(() => {
    const frame = ctx.frame;
    frame.subGroupRefs.set("devices", wrapRef.current);
    for (const d of devices) {
      const p = plots.get(d.slug);
      if (p) {
        anchors.set(`devices/${d.slug}`, {
          centre: new THREE.Vector3(p.x, p.top, p.z), radius: p.r,
        });
      }
    }
    if (conns.length) {
      anchors.set("devices/net", { centre: new THREE.Vector3(14.5, 6.4, -3), radius: 3 });
      for (const id of connIds) {
        anchors.set(id, { centre: new THREE.Vector3(), radius: 3.5 });
      }
    }
    frame.subLocal.set("devices", anchors);
    frame.devicesAnchors = anchors;
    return () => {
      frame.subGroupRefs.delete("devices");
      if (frame.subLocal.get("devices") === anchors) frame.subLocal.delete("devices");
      if (frame.devicesAnchors === anchors) frame.devicesAnchors = null;
    };
  }, [ctx, anchors, devices, plots, conns, connIds]);

  // The keyboard's key grid: 4 rows of 11, set once.
  useLayoutEffect(() => {
    const m = keysRef.current;
    if (!m) return;
    const M = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 11; c++) {
        M.setPosition(-5.5 + c * 1.1, 0.95, -1.65 + r * 1.1);
        m.setMatrixAt(i++, M);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }, [devices]);

  const lastHi = useRef(undefined);
  useFrame(() => {
    const st = ctx.stateRef.current;
    const frame = ctx.frame;
    // The hub's top, in world-group coordinates, for the cables.
    if (hubTopRef.current && frame.worldGroup) {
      hubTopRef.current.getWorldPosition(scratch.v);
      frame.netHubLocal = frame.worldGroup.worldToLocal(scratch.v.clone());
    }
    // Host anchors, republished every frame: the tokens stand
    // on the ring, outside this plot — token world → this
    // group's local frame (see the head comment).
    const wrap = wrapRef.current;
    if (wrap && frame.worldGroup && conns.length) {
      wrap.updateWorldMatrix(true, false);
      conns.forEach((conn, i) => {
        const a = anchors.get(connIds[i]);
        if (!a) return;
        const p = netTokenPosition(i, conns.length);
        const world = frame.worldGroup.localToWorld(
          scratch.v.set(p.x, 9.6, p.z).clone(),
        );
        a.centre.copy(wrap.worldToLocal(world));
        a.radius = 3.5;
      });
    }
    // The highlight, rewritten only when its signature changes.
    const hov = st.currentId === "devices" && st.subHover && st.subHover.objectId === "devices"
      ? st.subHover.nodeId : null;
    const foc = st.partFocus && st.partFocus.objectId === "devices" ? st.partFocus.partId : null;
    const hi = foc || hov || null;
    if (hi !== lastHi.current) {
      lastHi.current = hi;
      for (const [id, parts] of owned.map) {
        const f = !hi ? 1 : id === hi ? 1.9 : 0.55;
        for (const part of parts) part.mat.color.copy(part.base).multiplyScalar(f);
      }
    }
  });

  const st = () => ctx.stateRef.current;
  const report = (id) => {
    if (st().currentId !== "devices" || !st().onSubHover) return;
    st().onSubHover("devices", id);
  };
  const clear = () => { if (st().onSubHover) st().onSubHover("devices", null); };
  const hoverProps = (id) => ({
    onPointerOver: () => report(id),
    onPointerMove: () => report(id),
    onPointerOut: clear,
  });
  const byKind = (kind) => devices.find((d) => d.kind === kind);
  const queue = printer ? printer.queue || [] : [];
  const printingJob = queue.some((j) => j.status === "printing");
  const kb = byKind("keyboard");
  const ptr = byKind("pointer");
  const disp = byKind("display");

  return (
    <group ref={wrapRef}>
      {/* The shelf itself: context, like the citizens' plot plates. */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[38, 1.6, 26]} />
        <primitive object={matFor(0x27313a, { rough: 0.85 })} attach="material" />
      </mesh>
      {printer ? (
        <group position={[-10.5, 1.6, -1.5]}>
          <mesh position={[0, 2.1, 0]} material={owned.mats.printerBody} {...hoverProps("devices/printer")}>
            <boxGeometry args={[11, 4.2, 8]} />
          </mesh>
          <mesh position={[0, 4.55, 0]} material={owned.mats.printerBody} {...hoverProps("devices/printer")}>
            <boxGeometry args={[9, 0.7, 6]} />
          </mesh>
          <mesh position={[0, 3.1, 4.05]} material={owned.mats.printerAccent} {...hoverProps("devices/printer")}>
            <boxGeometry args={[8, 0.5, 0.3]} />
          </mesh>
          {/* The output tray, and the QUEUE as geometry: one
              sheet stands in the tray per queued job; the job
              being printed wears its sheet half-fed. */}
          <mesh position={[0, 0.9, 5.6]} rotation-x={0.18} material={owned.mats.printerBody} {...hoverProps("devices/printer")}>
            <boxGeometry args={[9.5, 0.35, 4.5]} />
          </mesh>
          {queue.map((job, i) => (
            <mesh key={i} position={[0, 1.18 + i * 0.22, 5.6]} rotation-x={0.18}
              material={owned.mats.printerPaper} {...hoverProps("devices/printer")}>
              <boxGeometry args={[8.2, 0.16, 3.4]} />
            </mesh>
          ))}
          {printingJob ? (
            <mesh position={[0, 3.35, 3.1]} rotation-x={-0.42}
              material={owned.mats.printerPaper} {...hoverProps("devices/printer")}>
              <boxGeometry args={[8.2, 0.14, 4.6]} />
            </mesh>
          ) : null}
        </group>
      ) : null}
      {kb ? (
        <group position={[2.5, 1.6, 7.5]}>
          <mesh position={[0, 0.4, 0]} material={owned.mats.keyboardBody} {...hoverProps(`devices/${kb.slug}`)}>
            <boxGeometry args={[13, 0.8, 5]} />
          </mesh>
          <instancedMesh ref={keysRef} args={[undefined, undefined, 44]}
            material={owned.mats.keyboardKeys}
            onPointerOver={() => report(`devices/${kb.slug}`)}
            onPointerMove={() => report(`devices/${kb.slug}`)}
            onPointerOut={clear}>
            <boxGeometry args={[0.95, 0.35, 0.95]} />
          </instancedMesh>
        </group>
      ) : null}
      {ptr ? (
        <group position={[12, 1.6, 7.5]}>
          <mesh position={[0, 1.05, 0]} scale={[1.3, 0.62, 1.8]}
            material={owned.mats.pointer} {...hoverProps(`devices/${ptr.slug}`)}>
            <sphereGeometry args={[1.9, 20, 14]} />
          </mesh>
        </group>
      ) : null}
      {disp ? (
        <group position={[6.5, 1.6, -8]}>
          <mesh position={[0, 0.3, 0.8]} material={owned.mats.displayFrame} {...hoverProps(`devices/${disp.slug}`)}>
            <boxGeometry args={[6, 0.6, 3]} />
          </mesh>
          <mesh position={[0, 2.75, 0.8]} material={owned.mats.displayFrame} {...hoverProps(`devices/${disp.slug}`)}>
            <boxGeometry args={[1.2, 5.5, 1.2]} />
          </mesh>
          <group position={[0, 8.2, 0]} rotation-x={-0.14}>
            <mesh material={owned.mats.displayFrame} {...hoverProps(`devices/${disp.slug}`)}>
              <boxGeometry args={[15, 9, 0.7]} />
            </mesh>
            <mesh position={[0, 0, 0.42]} material={owned.mats.displayScreen} {...hoverProps(`devices/${disp.slug}`)}>
              <boxGeometry args={[13.8, 7.8, 0.1]} />
            </mesh>
          </group>
        </group>
      ) : null}
      {devices.filter((d) => d.kind === "storage").map((d) => {
        const p = plots.get(d.slug);
        if (!p) return null;
        return (
          <group key={d.slug} position={[p.x, 1.6, p.z]}>
            <mesh position={[0, 1.2, 0]} material={owned.mats[`vol-${d.slug}`]} {...hoverProps(`devices/${d.slug}`)}>
              <boxGeometry args={[6.5, 2.4, 8.5]} />
            </mesh>
            <mesh position={[0, 2.6, 0]} material={owned.mats[`volStripe-${d.slug}`]} {...hoverProps(`devices/${d.slug}`)}>
              <boxGeometry args={[6.5, 0.45, 8.5]} />
            </mesh>
          </group>
        );
      })}
      {conns.length ? (
        <group position={[14.5, 1.6, -3]}>
          <mesh position={[0, 1.3, 0]} material={owned.mats.hubBody} {...hoverProps("devices/net")}>
            <boxGeometry args={[7, 2.6, 4.5]} />
          </mesh>
          {conns.map((conn, i) => (
            <mesh key={i}
              position={[conns.length > 1 ? -2.7 + (i * 5.4) / (conns.length - 1) : 0, 1.9, 2.3]}
              material={owned.mats.hubPorts} {...hoverProps("devices/net")}>
              <boxGeometry args={[0.85, 0.5, 0.25]} />
            </mesh>
          ))}
          {/* The cables' home end: an empty group at the hub's
              top, whose world position MiniDevices' frame loop
              publishes for NetworkLayer. */}
          <group ref={hubTopRef} position={[0, 3.2, 0]} />
        </group>
      ) : null}
    </group>
  );
}

/** The host tokens' colours, in connection order. */
const NET_TOKEN_COLORS = [0x5b8fd6, 0x2e7d74, 0x8e6cc8, 0xe0a458, 0x7fb069, 0xd66ba0, 0x6baed6, 0xc7b458];

/**
 * ONE CONNECTION, drawn: a host TOKEN standing on the ring's
 * back arc (a slab, a pillar, a coloured plate — the audio
 * token's stance, without its letter: these are not ring
 * items, carry no labels, and do not ride the ring's spin),
 * and its CABLE, an arc from the devices shelf's hub to the
 * token's plate, rebuilt each frame like the citizens' patch
 * cables because the hub end moves with its citizen. The
 * cable's thickness is the connection's bytes (environment.js's
 * log scale) and its glow likewise; a hovered or focused host
 * lifts both, on the citizens' two tiers.
 */
function NetLink({ ctx, conn, nodeId, index, count }) {
  const tube = useRef(null);
  const prevGeo = useRef(null);
  const pos = netTokenPosition(index, count);
  const bytes = connectionBytes(conn);
  const radius = cableRadiusForBytes(bytes);
  const baseGlow = cableGlowForBytes(bytes);
  const mats = useMemo(() => ({
    slab: stdMat(0x2b3941, { rough: 0.6 }),
    pillar: stdMat(0x39434b, { rough: 0.55 }),
    plate: stdMat(NET_TOKEN_COLORS[index % NET_TOKEN_COLORS.length], { rough: 0.45 }),
    cable: stdMat(0x2e7d74, { rough: 0.4 }),
  }), [index]);
  const initGeo = useMemo(
    () => new THREE.TubeGeometry(
      netArcCurve(new THREE.Vector3(0, 8, 120), new THREE.Vector3(pos.x, 8.4, pos.z)), 24, radius, 6),
    [pos.x, pos.z, radius],
  );
  useEffect(() => () => {
    for (const m of Object.values(mats)) m.dispose();
    initGeo.dispose();
    if (prevGeo.current) prevGeo.current.dispose();
  }, [mats, initGeo]);
  useFrame(() => {
    const st = ctx.stateRef.current;
    const frame = ctx.frame;
    const hov = st.currentId === "devices" && st.subHover
      && st.subHover.objectId === "devices" && st.subHover.nodeId === nodeId;
    const foc = st.partFocus && st.partFocus.objectId === "devices"
      && st.partFocus.partId === nodeId;
    const tier = foc ? 0.55 : hov ? 0.3 : 0;
    mats.plate.emissiveIntensity = Math.max(baseGlow * 0.7, tier);
    mats.cable.emissiveIntensity = Math.max(baseGlow, tier);
    const hub = frame.netHubLocal;
    if (!hub || !tube.current) {
      if (tube.current) tube.current.visible = false;
      return;
    }
    tube.current.visible = true;
    const geo = new THREE.TubeGeometry(
      netArcCurve(hub, new THREE.Vector3(pos.x, 8.4, pos.z)), 24, radius, 6);
    tube.current.geometry = geo;
    if (prevGeo.current) prevGeo.current.dispose();
    prevGeo.current = geo;
  });
  const st = () => ctx.stateRef.current;
  const report = () => {
    if (st().currentId !== "devices" || !st().onSubHover) return;
    st().onTouch();
    st().onSubHover("devices", nodeId);
  };
  const clear = () => { if (st().onSubHover) st().onSubHover("devices", null); };
  const hoverProps = {
    onPointerOver: report,
    onPointerMove: report,
    onPointerOut: clear,
  };
  return (
    <group>
      <mesh ref={tube} geometry={initGeo} material={mats.cable} {...hoverProps} />
      <group position={[pos.x, 0, pos.z]} rotation-y={pos.rotY}>
        <mesh position={[0, 2.4, 0]} material={mats.slab} {...hoverProps}>
          <boxGeometry args={[17, 2.2, 11.5]} />
        </mesh>
        <mesh position={[0, 5.6, 0]} material={mats.pillar} {...hoverProps}>
          <boxGeometry args={[2.2, 4.4, 2.2]} />
        </mesh>
        <mesh position={[0, 8.2, 0]} material={mats.plate} {...hoverProps}>
          <boxGeometry args={[8.5, 0.9, 8.5]} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * THE NETWORK LAYER: every connection in the snapshot, drawn
 * (NetLink). It lives in the world group beside the citizens —
 * in the DATA stratum's block, so hiding DATA or opening an
 * app full-platter takes the tokens and cables with their
 * citizen — and NOT in the ring's rotating group: the tokens
 * stand on the annulus but are world-anchored (see
 * netTokenPosition).
 */
function NetworkLayer({ ctx }) {
  const conns = connectionsOf(ENVIRONMENT);
  const ids = connectionIds(ENVIRONMENT);
  if (!conns.length) return null;
  return (
    <group>
      {conns.map((conn, i) => (
        <NetLink key={ids[i]} ctx={ctx} conn={conn} nodeId={ids[i]} index={i} count={conns.length} />
      ))}
    </group>
  );
}

const MINIATURES = {
  mesa: MiniMesa, drum: MiniDrum, tray: MiniTray, cube: MiniCube,
  tangle: MiniTangle, horizon3d: MiniSkyline, horizonflat: MiniHorizonPanel,
  arch: MiniArch, definition: MiniDefinition, knot: MiniKnot, crystal: MiniCrystal,
  tree: MiniTree, book: MiniBook, devices: MiniDevices,
};

/* ---------- one citizen of the space ---------- */

function SpaceObject({ def, ctx, lib, descentRootId, tangleDataset, bookStyle, bookAccess, bookSpread }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const spin = useRef(null);
  const ring = useRef(null);

  const mats = useMemo(() => {
    const list = [];
    const matFor = (color, opts = {}) => {
      const m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: opts.rough ?? 0.62,
        metalness: 0.08,
        transparent: opts.opacity != null,
        opacity: opts.opacity ?? 1,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0,
        side: opts.double ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (opts.opacity != null && !opts.keepDepth) m.depthWrite = false;
      m.userData.glowScale = opts.glowScale ?? 1;
      list.push(m);
      return m;
    };
    return { list, matFor };
  }, []);

  useEffect(() => {
    const frame = ctx.frame;
    frame.outerRefs.set(def.id, outer.current);
    frame.innerRefs.set(def.id, inner.current);
    frame.spinRefs.set(def.id, spin.current);
    frame.ringRefs.set(def.id, ring.current);
    frame.matsMap.set(def.id, mats.list);
    if (inner.current) inner.current.rotation.order = "YXZ";
    const st = ctx.stateRef.current;
    const p = st.space.positions[def.id] || { x: 0, z: 0 };
    if (!frame.disp.has(def.id)) {
      frame.disp.set(def.id, {
        x: p.x, z: p.z, lift: 0,
        yaw: 0, pitch: 0, roll: 0, spin: 0,
        scale: st.space.transforms[def.id]?.scale ?? 1, glow: 0,
      });
    }
    return () => {
      frame.outerRefs.delete(def.id);
      frame.innerRefs.delete(def.id);
      frame.spinRefs.delete(def.id);
      frame.ringRefs.delete(def.id);
      frame.matsMap.delete(def.id);
    };
  }, [ctx, def.id, mats.list]);

  const Mini = MINIATURES[def.id];
  const st = () => ctx.stateRef.current;
  return (
    <group
      ref={outer}
      onPointerOver={(e) => { e.stopPropagation(); st().onTouch(); st().onHover(def.id); }}
      onPointerOut={() => st().onHover(null)}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        st().onTouch();
        st().onObjectClick(def.id);
      }}
    >
      {/* The plot plate: context, so it is glass. */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[21, 22, 1.1, 36]} />
        <meshStandardMaterial color={0x9fd8e8} transparent opacity={0.14} roughness={0.4}
          emissive={0x9fd8e8} emissiveIntensity={0.05} depthWrite={false} />
      </mesh>
      <mesh ref={ring} position={[0, 1.25, 0]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[21.6, 23.4, 40]} />
        <meshBasicMaterial color={0xffa726} transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
      {/* Slice 11 (§5 + §11): the rotation group sits at the
          bounds centre (0, CENTRE_Y, 0) and the content is offset
          by −CENTRE_Y inside it, so the tumble (the Rig drives
          this group's YXZ rotation and scale) pivots at the
          bounds centre in all three axes. Inside it, the SPIN
          group carries B/N plane-rotate in the object's LOCAL
          frame — its rotation multiplies inside the tumble, so
          the geometry turns about its own plane normal (PLANE_
          AXIS) before the tumble orients it. The Rig never sets
          this group's position, so the declarative pivot stands. */}
      <group ref={inner} position={[0, CENTRE_Y[def.id] || 0, 0]}>
        <group ref={spin}>
          <group position={[0, -(CENTRE_Y[def.id] || 0), 0]}>
            <Mini lib={lib} matFor={mats.matFor} ctx={ctx} descentRootId={descentRootId} tangleDataset={tangleDataset}
              bookStyle={bookStyle} bookAccess={bookAccess} bookSpread={bookSpread} />
          </group>
        </group>
      </group>
    </group>
  );
}

/* ---------- the XY wall + media library cabinet ---------- */

function MediaWall({ ctx }) {
  const door = useRef(null);
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    if (door.current) {
      const open = ctx.stateRef.current.libraryOpen;
      door.current.position.x = damp(door.current.position.x, open ? -CABINET.w - 6 : 0, 5.5, dt);
    }
  });
  return (
    <group>
      {/* The datum sheet itself: glass, per the opacity law a
          container/plane you can see through. */}
      <mesh position={[0, WALL.cy, WALL.z]}>
        <planeGeometry args={[WALL.w, WALL.h]} />
        <meshStandardMaterial color={0x9fd8e8} transparent opacity={0.07} roughness={0.3}
          emissive={0x9fd8e8} emissiveIntensity={0.04} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, WALL.cy + WALL.h / 2, WALL.z]}>
        <boxGeometry args={[WALL.w, 1.1, 1.1]} />
        <meshStandardMaterial color={0x3a4a52} roughness={0.6} />
      </mesh>
      <mesh position={[0, WALL.cy - WALL.h / 2, WALL.z]}>
        <boxGeometry args={[WALL.w, 1.1, 1.1]} />
        <meshStandardMaterial color={0x3a4a52} roughness={0.6} />
      </mesh>
      {/* The cabinet: a semi-transparent container on the wall. */}
      <group position={[0, CABINET.cy, CABINET.z]}>
        <mesh>
          <boxGeometry args={[CABINET.w, CABINET.h, CABINET.d]} />
          <meshStandardMaterial color={0x9fd8e8} transparent opacity={0.13} roughness={0.35}
            emissive={0x9fd8e8} emissiveIntensity={0.05} depthWrite={false} />
        </mesh>
        <mesh position={[0, CABINET.h / 2 - 8, CABINET.d / 2 + 1.2]}>
          <planeGeometry args={[118, 13]} />
          <meshBasicMaterial map={plateTexture("MEDIA LIBRARY")} transparent />
        </mesh>
        {/* The door: glass, slides aside when the library opens. */}
        <mesh ref={door} position={[0, -6, CABINET.d / 2 + 0.8]}>
          <boxGeometry args={[CABINET.w - 10, CABINET.h - 24, 1.4]} />
          <meshStandardMaterial color={0x9fd8e8} transparent opacity={0.26} roughness={0.25}
            emissive={0x9fd8e8} emissiveIntensity={0.06} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

/** The YZ datum plane: a glass sheet at the platter's right side
 *  (the E side). Nothing mounts on it in this slice — it stands so
 *  the SIDE view has something to be square-on to. */
export const YZ = { x: 196, w: 368, h: 164, cy: 82 };

function DatumYZ() {
  return (
    <group>
      <mesh position={[YZ.x, YZ.cy, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[YZ.w, YZ.h]} />
        <meshStandardMaterial color={0x9fd8e8} transparent opacity={0.07} roughness={0.3}
          emissive={0x9fd8e8} emissiveIntensity={0.04} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[YZ.x, YZ.cy + YZ.h / 2, 0]}>
        <boxGeometry args={[1.1, 1.1, YZ.w]} />
        <meshStandardMaterial color={0x3a4a52} roughness={0.6} />
      </mesh>
      <mesh position={[YZ.x, YZ.cy - YZ.h / 2, 0]}>
        <boxGeometry args={[1.1, 1.1, YZ.w]} />
        <meshStandardMaterial color={0x3a4a52} roughness={0.6} />
      </mesh>
    </group>
  );
}

/** The axis-lock guide: a thin line along the locked world axis
 *  through the carried thing, while a drag is axis-locked. */
function AxisGuide({ ctx }) {
  const ref = useRef(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const st = ctx.stateRef.current;
    const drag = st.shared.drag;
    const axis = st.shared.axisLock;
    const d = drag ? ctx.frame.disp.get(drag.id) : null;
    if (!drag || !axis || !d) { m.visible = false; return; }
    m.visible = true;
    if (axis === "x") {
      m.position.set(0, 2, d.z);
      m.rotation.set(0, 0, 0);
    } else {
      m.position.set(d.x, 2, 0);
      m.rotation.set(0, Math.PI / 2, 0);
    }
  });
  return (
    <mesh ref={ref} visible={false}>
      <boxGeometry args={[PLATTER_R * 2, 0.45, 0.45]} />
      <meshBasicMaterial color={0xffa726} transparent opacity={0.55} />
    </mesh>
  );
}

/* ---------- one media card ---------- */

function MediaCard({ item, index, ctx }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const mats = useMemo(() => {
    const tex = cardTexture(item);
    const frame = new THREE.MeshStandardMaterial({
      color: 0x2b3941, roughness: 0.55, metalness: 0.1,
      emissive: 0x2b3941, emissiveIntensity: 0,
    });
    frame.userData.glowScale = 1;
    const art = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.6, metalness: 0,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0,
    });
    art.userData.glowScale = 0.5;
    return { list: [frame, art], frame, art };
  }, [item]);

  useEffect(() => {
    const frame = ctx.frame;
    frame.outerRefs.set(item.id, outer.current);
    frame.innerRefs.set(item.id, inner.current);
    frame.matsMap.set(item.id, mats.list);
    if (inner.current) inner.current.rotation.order = "YXZ";
    if (!frame.disp.has(item.id)) {
      const s = cardSlot(index, false);
      frame.disp.set(item.id, { x: s.x, y: s.y, z: s.z, yaw: 0, pitch: 0, roll: 0, scale: s.scale, glow: 0 });
    }
    return () => {
      frame.outerRefs.delete(item.id);
      frame.innerRefs.delete(item.id);
      frame.matsMap.delete(item.id);
    };
  }, [ctx, item.id, index, mats.list]);

  const st = () => ctx.stateRef.current;
  return (
    <group
      ref={outer}
      onPointerOver={(e) => { e.stopPropagation(); st().onTouch(); st().onHover(item.id); }}
      onPointerOut={() => st().onHover(null)}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        st().onTouch();
        st().onObjectClick(item.id);
      }}
    >
      <group ref={inner}>
        <mesh material={mats.frame}>
          <boxGeometry args={[32, 23, 1.4]} />
        </mesh>
        <mesh position={[0, 0, 0.85]} material={mats.art}>
          <planeGeometry args={[29.5, 20.5]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- the clipboard tray (Alt+0) ---------- */

function ClipboardTray({ ctx, held }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const mats = useMemo(() => {
    const base = new THREE.MeshStandardMaterial({
      color: 0x27313a, roughness: 0.7, metalness: 0.1,
      emissive: 0x27313a, emissiveIntensity: 0,
    });
    base.userData.glowScale = 1;
    const tex = held ? cardTexture(held) : emptyTexture();
    const art = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.6, metalness: 0,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0,
    });
    art.userData.glowScale = 0.5;
    return { list: [base, art], base, art };
  }, [held]);

  useEffect(() => {
    const frame = ctx.frame;
    frame.outerRefs.set("clipboard", outer.current);
    frame.innerRefs.set("clipboard", inner.current);
    frame.matsMap.set("clipboard", mats.list);
    if (inner.current) inner.current.rotation.order = "YXZ";
    if (!frame.disp.has("clipboard")) {
      frame.disp.set("clipboard", { ...TRAY_PARKED, yaw: 0, pitch: 0, roll: 0, scale: 1, glow: 0 });
    }
    return () => {
      frame.outerRefs.delete("clipboard");
      frame.innerRefs.delete("clipboard");
      frame.matsMap.delete("clipboard");
    };
  }, [ctx, mats.list]);

  const st = () => ctx.stateRef.current;
  return (
    <group
      ref={outer}
      onPointerOver={(e) => { e.stopPropagation(); st().onTouch(); st().onHover("clipboard"); }}
      onPointerOut={() => st().onHover(null)}
      onClick={(e) => {
        if (e.delta > 5) return;
        e.stopPropagation();
        st().onTouch();
        st().onObjectClick("clipboard");
      }}
    >
      <group ref={inner}>
        <mesh position={[0, 1.5, 0]} material={mats.base}>
          <boxGeometry args={[46, 3, 32]} />
        </mesh>
        <mesh position={[-19, 4, -13]} material={mats.base}>
          <boxGeometry args={[3, 8, 3]} />
        </mesh>
        <mesh position={[19, 4, -13]} material={mats.base}>
          <boxGeometry args={[3, 8, 3]} />
        </mesh>
        {/* The held card, standing tilted on the tray. */}
        <mesh position={[0, 13.5, -2]} rotation-x={-0.3} material={mats.art}>
          <planeGeometry args={[30, 21.5]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------- a pasted card, riding its target's anchor ---------- */

function PasteCard({ targetId, item, frame }) {
  const ref = useRef(null);
  const tex = useMemo(() => cardTexture(item), [item]);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const a = frame.anchorWorld.get(targetId);
    if (!a) { m.visible = false; return; }
    m.visible = true;
    const out = new THREE.Vector3(a.x, 0, a.z);
    if (out.lengthSq() < 1) out.set(0, 0, 1);
    out.normalize().multiplyScalar(7);
    m.position.set(a.x + out.x, a.y - 3, a.z + out.z);
    m.lookAt(state.camera.position);
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[22, 15.8]} />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} transparent />
    </mesh>
  );
}

/* ---------- cables ---------- */

function cableCurve(pa, pb, lift = 0) {
  const mid = pa.clone().add(pb).multiplyScalar(0.5);
  mid.y = Math.max(5, Math.min(pa.y, pb.y) - 7) + lift;
  return new THREE.CatmullRomCurve3([pa.clone(), mid, pb.clone()]);
}

function Cable({ a, b, offset, ctx }) {
  const tube = useRef(null);
  const pulse = useRef(null);
  const prevGeo = useRef(null);
  const initGeo = useMemo(
    () => new THREE.TubeGeometry(cableCurve(new THREE.Vector3(-50, 20, 0), new THREE.Vector3(50, 20, 0)), 32, 0.55, 6),
    [],
  );
  useFrame((state) => {
    const frame = ctx.frame;
    const pa = frame.anchorWorld.get(a);
    const pb = frame.anchorWorld.get(b);
    if (!pa || !pb || !tube.current) return;
    const curve = cableCurve(pa, pb);
    const geo = new THREE.TubeGeometry(curve, 32, 0.55, 6);
    tube.current.geometry = geo;
    if (prevGeo.current) prevGeo.current.dispose();
    prevGeo.current = geo;
    if (pulse.current) {
      pulse.current.visible = ctx.stateRef.current.pulsesOn;
      const t = (state.clock.elapsedTime * 0.22 + offset) % 1;
      pulse.current.position.copy(curve.getPointAt(t));
    }
  });
  return (
    <group>
      <mesh ref={tube} geometry={initGeo}>
        <meshStandardMaterial color={0x2e7d74} emissive={0x7fd4c1} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      <mesh ref={pulse}>
        <sphereGeometry args={[1.7, 12, 12]} />
        <meshBasicMaterial color={0xc9f7e8} />
      </mesh>
    </group>
  );
}

function PendingCable({ ctx }) {
  const tube = useRef(null);
  const prevGeo = useRef(null);
  const initGeo = useMemo(
    () => new THREE.TubeGeometry(cableCurve(new THREE.Vector3(0, 20, 0), new THREE.Vector3(30, 6, 0)), 24, 0.5, 6),
    [],
  );
  useFrame(() => {
    const st = ctx.stateRef.current;
    const frame = ctx.frame;
    if (!tube.current) return;
    const from = st.pendingId ? frame.anchorWorld.get(st.pendingId) : null;
    if (!from || !frame.worldGroup) { tube.current.visible = false; return; }
    tube.current.visible = true;
    const g = st.shared.groundLocal;
    const end = frame.worldGroup.localToWorld(new THREE.Vector3(g.x, 1.5, g.z));
    const curve = cableCurve(from, end, 2);
    const geo = new THREE.TubeGeometry(curve, 24, 0.5, 6);
    tube.current.geometry = geo;
    if (prevGeo.current) prevGeo.current.dispose();
    prevGeo.current = geo;
  });
  return (
    <mesh ref={tube} geometry={initGeo} visible={false}>
      <meshStandardMaterial color={0xcc7a00} emissive={0xffa726} emissiveIntensity={0.7}
        roughness={0.4} transparent opacity={0.85} />
    </mesh>
  );
}

/* ---------- the ring and the open app's stage (slice 8) ---------- */

/** The app tokens' places on the ring while an app holds the
 *  stage: an arc across the front of the annulus, transport at
 *  the centre, portals and states spread either side. */
const TOKEN_SLOTS = [
  { id: "tok-loop", deg: 165 },
  { id: "tok-rain", deg: 135 },
  { id: "tok-pulse", deg: 105 },
  { id: "tok-play", deg: 75 },
  { id: "tok-voice", deg: 45 },
  { id: "tok-zoom", deg: 15 },
];

/** Token captions for the overlay: the state tokens speak their
 *  state, so the ring reads at a glance. */
export const APP_TOKEN_UI = [
  { id: "tok-play", caption: (a) => (a.playing ? "❚❚ PAUSE" : "▶ PLAY") },
  { id: "tok-pulse", caption: () => "PULSE" },
  { id: "tok-voice", caption: () => "VOICE" },
  { id: "tok-rain", caption: () => "RAIN" },
  { id: "tok-zoom", caption: (a) => `ZOOM ${(a.window.end - a.window.start).toFixed(1)}s` },
  { id: "tok-loop", caption: (a) => (a.loop ? "LOOP ON" : "LOOP OFF") },
];

const TRACK_HUES = { pulse: 0x2e7d74, voice: 0x8e6cc8, rain: 0x5b8fd6 };

function stdMat(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.rough ?? 0.55,
    metalness: 0.08,
    transparent: opts.opacity != null,
    opacity: opts.opacity ?? 1,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0,
  });
  if (opts.opacity != null) m.depthWrite = false;
  return m;
}

/** A tiny peak fence for a slab top: `buckets` bars of a track's
 *  full-window peaks, written into an instanced mesh once. */
function writeMiniFence(mesh, track, buckets, width, maxH, baseY) {
  if (!mesh || !track) return;
  const peaks = peaksForWindow(track.samples, track.rate, 0, track.seconds, buckets);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
  const P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
  peaks.forEach((p, i) => {
    const peak = Math.max(Math.abs(p.min), Math.abs(p.max));
    const h = 0.5 + peak * maxH;
    P.set(-width / 2 + ((i + 0.5) * width) / buckets, baseY + h / 2, 0);
    S.set(Math.max(0.4, width / buckets - 0.35), h, 1.6);
    M.compose(P, Q, S);
    mesh.setMatrixAt(i, M);
    mesh.setColorAt(i, C.setRGB(0.16 + 0.84 * peak, 0.42 + 0.23 * peak, 0.38 - 0.23 * peak));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/**
 * THE RING: a glass annulus floating just above the platter's
 * level, centred on RING_R. It turns SLOWLY — 1.5°/s — as part of
 * the space's rest behaviour, under this rule: rotation pauses
 * while its item is hovered or current, while an app is open
 * (either mode — an app's controls must hold still), and for
 * three seconds after any interaction (the turntable-rest
 * lastTouch pattern). At rest at home it carries one item: the
 * WAVEFORM app's token, a slab with a miniature peak fence.
 * While an app holds the stage the ring belongs to the app: the
 * home token withdraws, the ring eases to its canonical angle,
 * and the app's furniture — transport, three track portals, the
 * zoom and loop state tokens — stands on the arc instead, each
 * hovered and clicked like a citizen, each wearing a caption
 * that speaks its state.
 */
function PlatterRing({ ctx }) {
  const group = useRef(null);
  const homeFence = useRef(null);
  const trackFences = useRef({});
  const playTri = useRef(null);
  const playBars = useRef(null);
  const mats = useMemo(() => ({
    band: stdMat(0x9fd8e8, { opacity: 0.13 }),
    slab: stdMat(0x2b3941, { rough: 0.6 }),
    homeSlab: stdMat(0x39434b, { rough: 0.55 }),
    homeBars: stdMat(0xffffff, { rough: 0.5 }),
    playButton: stdMat(0xffa726, { rough: 0.35 }),
    glyph: new THREE.MeshBasicMaterial({ color: 0xffc46b, side: THREE.DoubleSide }),
    loop: stdMat(0x7fd4c1, { rough: 0.4 }),
    zoom: stdMat(0xb79ce0, { rough: 0.4 }),
    track: {
      pulse: stdMat(TRACK_HUES.pulse, { rough: 0.5 }),
      voice: stdMat(TRACK_HUES.voice, { rough: 0.5 }),
      rain: stdMat(TRACK_HUES.rain, { rough: 0.5 }),
    },
    trackBars: {
      pulse: stdMat(0xffffff, { rough: 0.5 }),
      voice: stdMat(0xffffff, { rough: 0.5 }),
      rain: stdMat(0xffffff, { rough: 0.5 }),
    },
  }), []);
  const triGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(
      [0, 0, -5.6, -3.6, 0, 4.2, 3.6, 0, 4.2], 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const pulse = useMemo(() => makeTrack("pulse"), []);

  useEffect(() => () => {
    for (const m of Object.values(mats)) {
      if (m && typeof m.dispose === "function") m.dispose();
    }
    for (const m of Object.values(mats.track)) m.dispose();
    for (const m of Object.values(mats.trackBars)) m.dispose();
    triGeo.dispose();
  }, [mats, triGeo]);

  useLayoutEffect(() => {
    writeMiniFence(homeFence.current, pulse, 28, 25, 3.4, 3.8);
  }, [pulse]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    const st = ctx.stateRef.current;
    const frame = ctx.frame;
    const g = group.current;
    if (!g) return;
    const appOpen = Boolean(st.openApp && st.openApp.appId);
    if (appOpen) {
      // The app's furniture must stand at its designed slots:
      // ease the ring to the nearest whole turn (angle 0).
      const target = Math.round(frame.ringAngle / (Math.PI * 2)) * Math.PI * 2;
      frame.ringAngle = damp(frame.ringAngle, target, 4, dt);
    } else {
      const still = st.turntableOn === false
        || st.hoverId === "audio" || st.currentId === "audio"
        || performance.now() - (st.shared.lastTouch || 0) <= 3000;
      if (!still) frame.ringAngle += dt * 1.5 * DEG;
    }
    // Slice 11 (§7): the user's manual spin offset (E/R yaw and
    // B/N plane-rotate on the ring drive ONE offset state) rides
    // on the SAME group rotation this machinery drives: the base
    // angle keeps its rules — the rest spin, and easing to whole
    // turns while an app is open — and the offset is added on
    // top, so it persists while an app is open (the ring eases
    // to whole turns UNDER the offset). While the ring is
    // addressed, the `still` rule above has already paused the
    // rest spin, so the offset is the only motion; the rest spin
    // resumes once the ring is released.
    g.rotation.y = frame.ringAngle + (st.ringSpinDeg || 0) * DEG;
    // Home token glow: the citizens' two tiers, on its own slab.
    const homeT = appOpen ? 0 : glowLevel({
      current: st.currentId === "audio",
      hovered: st.hoverId === "audio",
    });
    mats.homeSlab.emissiveIntensity = damp(mats.homeSlab.emissiveIntensity, homeT, 10, dt);
    mats.homeBars.emissiveIntensity = damp(mats.homeBars.emissiveIntensity, homeT * 0.7, 10, dt);
    if (appOpen && st.audio) {
      // The transport glyph flips with the state.
      if (playTri.current) playTri.current.visible = !st.audio.playing;
      if (playBars.current) playBars.current.visible = Boolean(st.audio.playing);
      const addressed = (id) => (st.tokenHoverId === id || st.appFocusId === id) ? 0.55 : 0;
      mats.playButton.emissiveIntensity = damp(mats.playButton.emissiveIntensity,
        Math.max(addressed("tok-play"), st.audio.playing ? 0.3 : 0), 10, dt);
      mats.loop.emissiveIntensity = damp(mats.loop.emissiveIntensity,
        Math.max(addressed("tok-loop"), st.audio.loop ? 0.5 : 0), 10, dt);
      mats.zoom.emissiveIntensity = damp(mats.zoom.emissiveIntensity, addressed("tok-zoom"), 10, dt);
      for (const tid of Object.keys(mats.trackBars)) {
        const tokId = `tok-${tid}`;
        const lit = st.audio.trackId === tid ? 0.45 : 0;
        mats.trackBars[tid].emissiveIntensity = damp(
          mats.trackBars[tid].emissiveIntensity, Math.max(addressed(tokId), lit), 10, dt);
      }
    }
  });

  const st = () => ctx.stateRef.current;
  const frame = ctx.frame;
  const appOpen = Boolean(ctx.stateRef.current.openApp && ctx.stateRef.current.openApp.appId);
  const home = ringItemPosition(0, 1, 0);
  const slotPos = (deg) => {
    const a = deg * DEG;
    return [Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R];
  };
  const slotRot = (deg) => {
    const a = deg * DEG;
    return Math.atan2(-Math.cos(a), -Math.sin(a));
  };

  return (
    <group ref={group}>
      {/* The annulus itself: glass, per the translucency law — a
          place things stand, not a thing. The cursor over the
          annulus itself addresses the RING for the rotate keys
          (slice 11, §7): the band reports its own hover on a
          separate channel from the item's. */}
      <mesh
        position={[0, 1.2, 0]}
        rotation-x={-Math.PI / 2}
        material={mats.band}
        onPointerOver={(e) => { e.stopPropagation(); st().onTouch(); if (st().onRingHover) st().onRingHover(true); }}
        onPointerOut={() => { if (st().onRingHover) st().onRingHover(false); }}
      >
        <ringGeometry args={[209, 235, 96]} />
      </mesh>
      <mesh position={[0, 1.25, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[233.6, 235, 96]} />
        <meshBasicMaterial color={0xffa726} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {!appOpen ? (
        <group
          position={[home.x, 0, home.z]}
          rotation-y={Math.PI}
          ref={(el) => {
            if (el) frame.ringItemRefs.set("audio", el);
            else frame.ringItemRefs.delete("audio");
          }}
          onPointerOver={(e) => { e.stopPropagation(); st().onTouch(); st().onHover("audio"); }}
          onPointerOut={() => st().onHover(null)}
          onClick={(e) => {
            if (e.delta > 5) return;
            e.stopPropagation();
            st().onTouch();
            st().onObjectClick("audio");
          }}
        >
          <mesh position={[0, 2.5, 0]} material={mats.homeSlab}>
            <boxGeometry args={[30, 2.6, 20]} />
          </mesh>
          <instancedMesh ref={homeFence} args={[undefined, undefined, 28]} material={mats.homeBars}>
            <boxGeometry args={[1, 1, 1]} />
          </instancedMesh>
        </group>
      ) : null}
      {appOpen ? TOKEN_SLOTS.map((slot) => {
        const tid = slot.id.replace("tok-", "");
        const isTrack = Boolean(TRACK_HUES[tid]);
        return (
          <group
            key={slot.id}
            position={slotPos(slot.deg)}
            rotation-y={slotRot(slot.deg)}
            ref={(el) => {
              if (el) frame.tokenRefs.set(slot.id, el);
              else frame.tokenRefs.delete(slot.id);
            }}
            onPointerOver={(e) => { e.stopPropagation(); st().onTouch(); st().onTokenHover(slot.id); }}
            onPointerOut={() => st().onTokenHover(null)}
            onClick={(e) => {
              if (e.delta > 5) return;
              e.stopPropagation();
              st().onTouch();
              st().onTokenActivate(slot.id);
            }}
          >
            <mesh position={[0, 2.5, 0]} material={mats.slab}>
              <boxGeometry args={[30, 2.6, 20]} />
            </mesh>
            {slot.id === "tok-play" ? (
              <>
                <mesh position={[0, 4.1, 0]} material={mats.playButton}>
                  <cylinderGeometry args={[5.2, 5.2, 1, 24]} />
                </mesh>
                <mesh ref={playTri} geometry={triGeo} material={mats.glyph} position={[0, 4.75, 0]} />
                <group ref={playBars} visible={false}>
                  <mesh position={[-2.1, 4.75, 0]} material={mats.glyph}>
                    <boxGeometry args={[1.7, 1.1, 5.2]} />
                  </mesh>
                  <mesh position={[2.1, 4.75, 0]} material={mats.glyph}>
                    <boxGeometry args={[1.7, 1.1, 5.2]} />
                  </mesh>
                </group>
              </>
            ) : null}
            {slot.id === "tok-loop" ? (
              <mesh position={[0, 4.3, 0]} rotation-x={Math.PI / 2} material={mats.loop}>
                <torusGeometry args={[3.6, 0.95, 10, 28]} />
              </mesh>
            ) : null}
            {slot.id === "tok-zoom" ? (
              <group position={[0, 4.2, 0]}>
                <mesh rotation-x={0.5} material={mats.zoom}>
                  <torusGeometry args={[2.9, 0.8, 10, 24]} />
                </mesh>
                <mesh position={[2.7, -0.9, 0]} rotation-z={0.7} material={mats.zoom}>
                  <boxGeometry args={[1.1, 4.6, 1.1]} />
                </mesh>
              </group>
            ) : null}
            {isTrack ? (
              <>
                <mesh position={[0, 3.95, -6.5]} material={mats.track[tid]}>
                  <boxGeometry args={[26, 0.5, 0.8]} />
                </mesh>
                <TrackFence
                  trackId={tid}
                  mat={mats.trackBars[tid]}
                  register={(el) => { trackFences.current[tid] = el; }}
                />
              </>
            ) : null}
          </group>
        );
      }) : null}
    </group>
  );
}

/** One track portal's miniature fence (its track's full window). */
function TrackFence({ trackId, mat, register }) {
  const ref = useRef(null);
  const track = useMemo(() => makeTrack(trackId), [trackId]);
  useLayoutEffect(() => {
    register(ref.current);
    writeMiniFence(ref.current, track, 10, 24, 3.2, 3.8);
  }, [track, register]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 10]} material={mat}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

/* ---------- the waveform app's stage ---------- */

const STAGE_R = 104; // the centre stage's radius (full: the platter's 184)
const BED_TOP = 5;
const FENCE_W = 168;
const FENCE_Z = 30;
const FENCE_BUCKETS = 96;
const FALL_SLICES = 12;
const FALL_BANDS = 4;

/**
 * THE WAVEFORM STAGE: the audio app stood in the space. A dais —
 * radius 104 at the platter's centre in centre mode, easing out
 * to the whole platter (184) in full mode — carries a trackbed;
 * on the bed stands the FENCE (amplitude over time: instanced
 * bars, one per bucket, time laid along X by a d3 linear scale,
 * height the bucket's peak, colour rising teal→amber with it,
 * bars on a centre rail) and behind it the WATERFALL (the
 * spectrogram as terrain: frequency across in four bands, time
 * receding into depth in twelve slices, energy as height, from
 * waveform.js bandEnergies over the current window). The
 * PLAYHEAD is a translucent plane crossing the fence at the play
 * position; this component advances it while the app plays —
 * the window is the frame being played, so the head wraps per
 * the loop state or stops at the window's end. Six invisible
 * zones over the fence report the hovered stretch (the App
 * gates; F drills, a click drills too).
 */
function WaveformStage({ ctx }) {
  const group = useRef(null);
  const fence = useRef(null);
  const fall = useRef(null);
  const head = useRef(null);
  const scaleT = useRef(1);
  const dataKey = useRef("");
  const scales = useRef(null);
  const mats = useMemo(() => ({
    dais: stdMat(0x1d262c, { rough: 0.85 }),
    rim: new THREE.MeshBasicMaterial({ color: 0xffa726, transparent: true, opacity: 0.5 }),
    bed: stdMat(0x141b1f, { rough: 0.9 }),
    bar: stdMat(0xffffff, { rough: 0.45 }),
    fall: stdMat(0xffffff, { rough: 0.65 }),
    head: new THREE.MeshBasicMaterial({
      color: 0xffc46b, transparent: true, opacity: 0.32,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
    rail: new THREE.MeshBasicMaterial({ color: 0xffa726 }),
    zone: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  }), []);
  const tracks = useMemo(() => ({
    pulse: makeTrack("pulse"), voice: makeTrack("voice"), rain: makeTrack("rain"),
  }), []);

  useEffect(() => {
    ctx.frame.stageGroupRef = group.current;
    return () => {
      if (ctx.frame.stageGroupRef === group.current) ctx.frame.stageGroupRef = null;
      for (const m of Object.values(mats)) m.dispose();
    };
  }, [ctx, mats]);

  const rebuild = (st) => {
    const track = tracks[st.audio.trackId];
    const w = st.audio.window;
    const x = scaleLinear().domain([w.start, w.end]).range([-FENCE_W / 2, FENCE_W / 2]);
    scales.current = { x, w };
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    const P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
    const fm = fence.current;
    if (fm) {
      const peaks = peaksForWindow(track.samples, track.rate, w.start, w.end, FENCE_BUCKETS);
      peaks.forEach((p, i) => {
        const peak = Math.max(Math.abs(p.min), Math.abs(p.max));
        const h = 1.2 + peak * 23;
        const t0 = w.start + ((w.end - w.start) * i) / FENCE_BUCKETS;
        const t1 = w.start + ((w.end - w.start) * (i + 1)) / FENCE_BUCKETS;
        P.set((x(t0) + x(t1)) / 2, BED_TOP + h / 2, FENCE_Z);
        S.set(Math.max(0.6, x(t1) - x(t0) - 0.45), h, 2.2);
        M.compose(P, Q, S);
        fm.setMatrixAt(i, M);
        C.setRGB(0.13 + 0.87 * peak, 0.4 + 0.25 * peak, 0.36 - 0.21 * peak);
        if (st.regionHover === Math.floor(i / (FENCE_BUCKETS / REGION_ZONES))) {
          C.multiplyScalar(1.5);
        }
        fm.setColorAt(i, C);
      });
      fm.instanceMatrix.needsUpdate = true;
      if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    }
    const wm = fall.current;
    if (wm) {
      const energies = bandEnergies(track.samples, track.rate, w.start, w.end, FALL_SLICES, FALL_BANDS);
      let idx = 0;
      energies.forEach((row, si) => {
        row.forEach((e, b) => {
          const h = 0.7 + e * 16;
          P.set(-FENCE_W / 2 + (b + 0.5) * (FENCE_W / FALL_BANDS),
            BED_TOP + h / 2, 16 - (si + 0.5) * 4.5);
          S.set(FENCE_W / FALL_BANDS - 3, h, 3.4);
          M.compose(P, Q, S);
          wm.setMatrixAt(idx, M);
          wm.setColorAt(idx, C.setRGB(0.1 + 0.9 * e, 0.34 + 0.31 * e, 0.32 - 0.17 * e));
          idx++;
        });
      });
      wm.instanceMatrix.needsUpdate = true;
      if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
    }
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    const st = ctx.stateRef.current;
    const g = group.current;
    if (!g) return;
    const open = Boolean(st.openApp && st.openApp.appId === "audio" && st.audio);
    g.visible = open;
    if (!open) return;
    const target = st.openApp.mode === "full" ? 184 / STAGE_R : 1;
    scaleT.current = damp(scaleT.current, target, 5, dt);
    g.scale.set(scaleT.current, 1, scaleT.current);
    const key = `${st.audio.trackId}|${st.audio.window.start}|${st.audio.window.end}|${st.regionHover}`;
    if (key !== dataKey.current) { dataKey.current = key; rebuild(st); }
    // The playhead: the window is the frame being played.
    const w = st.audio.window;
    let pos = st.shared.audioPos ?? w.start;
    if (pos < w.start) pos = w.start;
    if (st.audio.playing) {
      pos += dt;
      if (pos >= w.end) {
        if (st.audio.loop) pos = w.start + ((pos - w.end) % Math.max(0.001, w.end - w.start));
        else {
          pos = w.end;
          if (st.onAudioEnd) st.onAudioEnd();
        }
      }
      st.shared.audioPos = pos;
    }
    if (head.current && scales.current) {
      head.current.position.set(
        scales.current.x(Math.max(w.start, Math.min(w.end, pos))), BED_TOP + 14, FENCE_Z);
    }
  });

  const st = () => ctx.stateRef.current;
  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 1.5, 0]} material={mats.dais}>
        <cylinderGeometry args={[STAGE_R, STAGE_R + 3, 3, 72]} />
      </mesh>
      <mesh position={[0, 3.1, 0]} rotation-x={Math.PI / 2} material={mats.rim}>
        <torusGeometry args={[STAGE_R, 0.7, 8, 72]} />
      </mesh>
      <mesh position={[0, 4, 0]} material={mats.bed}>
        <boxGeometry args={[176, 2, 92]} />
      </mesh>
      {/* The centre rail the fence stands on. */}
      <mesh position={[0, BED_TOP + 0.25, FENCE_Z]} material={mats.rail}>
        <boxGeometry args={[FENCE_W, 0.5, 0.5]} />
      </mesh>
      <instancedMesh ref={fence} args={[undefined, undefined, FENCE_BUCKETS]} material={mats.bar}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={fall} args={[undefined, undefined, FALL_SLICES * FALL_BANDS]} material={mats.fall}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <mesh ref={head} position={[0, BED_TOP + 14, FENCE_Z]} material={mats.head}>
        <planeGeometry args={[1.4, 30]} />
      </mesh>
      {/* Hover zones over the fence: six stretches of the window. */}
      {Array.from({ length: REGION_ZONES }, (_, i) => (
        <mesh
          key={i}
          position={[-FENCE_W / 2 + (i + 0.5) * (FENCE_W / REGION_ZONES), BED_TOP + 13, FENCE_Z]}
          material={mats.zone}
          onPointerOver={(e) => { e.stopPropagation(); st().onTouch(); st().onRegionHover(i); }}
          onPointerOut={() => st().onRegionHover(null)}
          onClick={(e) => {
            if (e.delta > 5) return;
            e.stopPropagation();
            st().onTouch();
            if (st().onRegionActivate) st().onRegionActivate(i);
          }}
        >
          <boxGeometry args={[FENCE_W / REGION_ZONES - 1, 27, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- the driver ---------- */

/**
 * The inspection position: platter centre, raised to reading
 * height, in world-group local coordinates — with the yaw that
 * turns the thing's front to the camera, plus whatever turn the
 * transform keys have added on top (st.inspectRot). Scale is the
 * documented inspection scale for the kind of thing.
 */
const _inspectV = new THREE.Vector3();
const _qPlatter = new THREE.Quaternion();
const _qSpin = new THREE.Quaternion();
const _zVec = new THREE.Vector3();
const _Y_AXIS = new THREE.Vector3(0, 1, 0);
function inspectTargetFor(st, frame, camera, kind) {
  const wg = frame.worldGroup;
  _inspectV.set(0, 36, 0);
  const lp = wg ? wg.worldToLocal(_inspectV.clone()) : _inspectV;
  const worldYaw = Math.atan2(camera.position.x, camera.position.z) / DEG;
  // The world group's facing under the composed rotation (slice
  // 11): the Rig publishes its outermost yaw on the frame.
  const localYaw = worldYaw - (frame.worldYaw || 0) / DEG;
  const rot = st.inspectRot || { yaw: 0, pitch: 0, roll: 0, scale: 1 };
  return {
    x: lp.x, y: lp.y, z: lp.z,
    yaw: localYaw + rot.yaw, pitch: rot.pitch, roll: rot.roll,
    spin: rot.spin || 0,
    scale: inspectScaleFor(kind) * rot.scale,
  };
}

function Rig({ ctx, cameras }) {
  const set = useThree((s) => s.set);
  const anim = useRef({ look: new THREE.Vector3(0, 8, 0), init: false });

  const projection = ctx.stateRef.current.projection;
  useEffect(() => {
    set({ camera: projection === "iso" ? cameras.ortho : cameras.persp });
  }, [projection, cameras, set]);

  useFrame((state, dtRaw) => {
    const st = ctx.stateRef.current;
    const frame = ctx.frame;
    const dt = Math.min(0.05, dtRaw || 0.016);
    const camera = state.camera;
    frame.camera = camera;
    const A = anim.current;

    const aspect = state.size.width / Math.max(1, state.size.height);
    // The field size (§15): the focal zoom. In perspective it
    // drives the fov; in isometric it scales the frustum by the
    // rung's inverse-direction factor — the same ladder, the
    // same gesture, honestly named. A lens setting: it applies
    // every frame regardless of seats, and named views do not
    // reset it.
    const field = FIELD_SIZES[st.fieldIndex ?? FIELD_DEFAULT_INDEX] || FIELD_SIZES[FIELD_DEFAULT_INDEX];
    cameras.persp.aspect = aspect;
    cameras.persp.fov = field.fov;
    cameras.persp.updateProjectionMatrix();
    const orthoHalf = cameras.orthoHalf * field.iso;
    cameras.ortho.left = -orthoHalf * aspect;
    cameras.ortho.right = orthoHalf * aspect;
    cameras.ortho.top = orthoHalf;
    cameras.ortho.bottom = -orthoHalf;
    cameras.ortho.updateProjectionMatrix();

    // The cursor's ground point, in world-group local coordinates —
    // where drags go and where a pending cable reaches.
    const wg = frame.worldGroup;
    if (wg) {
      const hit = new THREE.Vector3();
      state.raycaster.setFromCamera(state.pointer, camera);
      if (state.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
        wg.worldToLocal(hit);
        const c = clampGround(hit.x, hit.z);
        st.shared.groundLocal = c;
        if (st.shared.drag) {
          // CAD drag discipline: the axis lock first (movement
          // constrained to one world axis through the origin of
          // the drag), then snapping — grid, or another object's
          // plot centre when close (the anchor wins).
          let p = { ...c };
          if (st.shared.axisLock && st.shared.axisOrigin) {
            p = axisLockPoint(p, st.shared.axisOrigin, st.shared.axisLock);
          }
          const anchors = OBJECT_IDS
            .filter((oid) => oid !== st.shared.drag.id)
            .map((oid) => ({ id: oid, x: st.space.positions[oid].x, z: st.space.positions[oid].z }));
          const snapped = snapGroundPoint(p, anchors, st.snapOn !== false);
          st.shared.drag.point = { x: snapped.x, z: snapped.z };
        }
      }
    }

    // Turntable rest: nothing touched for 8 s, no mode active.
    const shared = st.shared;
    const idle = performance.now() - (shared.lastTouch || 0) > 8000;
    const modeActive = Boolean(shared.drag || st.pendingId || st.cardId || st.inspectedId
      || (st.partFocus && st.partFocus.partId) || (st.openApp && st.openApp.appId));
    if (wg) {
      frame.turntabling = Boolean(st.turntableOn && idle && !modeActive);
      if (frame.turntabling) frame.turntableAngle += dt * 2 * DEG;
      // The world group's rotation, composed (slice 11, §11+§12),
      // outermost to innermost:
      //   platterQuat — the cluster's CAMERA-SPACE turns (§12):
      //     the App accumulates one quaternion, each step
      //     premultiplied about the camera's own axes;
      //   the rotation PARAMETER plus the turntable's yaw — the
      //     disc's own spin, innermost, so B/N (which steps the
      //     parameter) still spins the platter cleanly in its
      //     own plane inside the camera-space turns.
      // Before slice 11 the parameter orbited the CAMERA instead
      // and the group carried only the turntable's yaw; now the
      // parameter is the disc's spin, applied here, and the
      // camera seats below no longer add it (no double turn).
      // §7's platterYaw/platterTilt states were dropped for the
      // quaternion — this composition replaces them whole.
      _qPlatter.fromArray(st.platterQuat || [0, 0, 0, 1]);
      _qSpin.setFromAxisAngle(_Y_AXIS, (st.rotation || 0) * DEG + frame.turntableAngle);
      wg.quaternion.copy(_qPlatter).multiply(_qSpin);
      // The world frame's effective yaw, for the inspection
      // facing correction (inspectTargetFor): the composed
      // quaternion's +Z axis, projected on the ground plane.
      _zVec.set(0, 0, 1).applyQuaternion(wg.quaternion);
      frame.worldYaw = Math.atan2(_zVec.x, _zVec.z);
    }

    // Objects: ease every displayed value toward the state.
    const tmpV = new THREE.Vector3();
    for (const def of OBJECTS) {
      const d = frame.disp.get(def.id);
      const outer = frame.outerRefs.get(def.id);
      const inner = frame.innerRefs.get(def.id);
      if (!d || !outer || !inner) continue;
      const dragging = shared.drag && shared.drag.id === def.id;
      const posT = dragging ? shared.drag.point : st.space.positions[def.id];
      const tr = st.space.transforms[def.id] || { yaw: 0, pitch: 0, roll: 0, scale: 1 };
      const layoutScale = (st.space.layoutScales && st.space.layoutScales[def.id]) || 1;
      let tX = posT ? posT.x : d.x;
      let tZ = posT ? posT.z : d.z;
      let tLift = dragging ? 7 : 0;
      let tYaw = tr.yaw, tPitch = tr.pitch, tRoll = tr.roll;
      let tScale = tr.scale * layoutScale;
      // Plane-rotate (B/N): the transform's spin, plus the
      // inspection turn's spin while this citizen is the specimen.
      let tSpin = tr.spin || 0;
      if (st.inspectedId === def.id) {
        // INSPECT: the thing itself travels to the inspection
        // position and faces the viewer; its home targets resume
        // the moment inspection ends, so it eases exactly back.
        const t = inspectTargetFor(st, frame, camera, "object");
        tX = t.x; tZ = t.z; tLift = t.y;
        tYaw = t.yaw; tPitch = t.pitch; tRoll = t.roll; tScale = t.scale;
        tSpin += (st.inspectRot && st.inspectRot.spin) || 0;
      }
      d.x = damp(d.x, tX, 5.5, dt);
      d.z = damp(d.z, tZ, 5.5, dt);
      d.lift = damp(d.lift, tLift, 6, dt);
      d.yaw = damp(d.yaw, tYaw, 10, dt);
      d.pitch = damp(d.pitch, tPitch, 10, dt);
      d.roll = damp(d.roll, tRoll, 10, dt);
      d.spin = damp(d.spin || 0, tSpin, 10, dt);
      d.scale = damp(d.scale, tScale, 8, dt);
      outer.position.set(d.x, d.lift, d.z);
      inner.rotation.set(d.pitch * DEG, d.yaw * DEG, d.roll * DEG);
      inner.scale.setScalar(Math.max(0.05, d.scale));
      // The spin group turns about the citizen's plane axis, in
      // its local frame, inside the tumble above.
      const spinG = frame.spinRefs.get(def.id);
      if (spinG) {
        if (PLANE_AXIS[def.id] === "z") spinG.rotation.set(0, 0, d.spin * DEG);
        else spinG.rotation.set(0, d.spin * DEG, 0);
      }

      // Glow is address, two tiers (space-state.js): hovered is a
      // highlight only (0.30, teal ring); selected/entered is the
      // glow (0.55, amber ring), held while the object is current.
      const glowT = glowLevel({
        entered: st.cardId === def.id,
        current: st.currentId === def.id,
        pending: st.pendingId === def.id,
        hovered: st.hoverId === def.id,
      });
      d.glow = damp(d.glow, glowT, 10, dt);
      const mats = frame.matsMap.get(def.id);
      if (mats) for (const m of mats) m.emissiveIntensity = d.glow * (m.userData.glowScale ?? 1);

      const ring = frame.ringRefs.get(def.id);
      if (ring) {
        const isCur = st.currentId === def.id;
        const isHov = st.hoverId === def.id && !isCur;
        const isPend = st.pendingId === def.id;
        ring.visible = Boolean(isCur || isHov || isPend);
        if (ring.visible) {
          ring.material.color.set(isCur || isPend ? 0xffa726 : 0x7fd4c1);
          ring.material.opacity = isPend
            ? 0.65 + 0.35 * Math.sin(performance.now() / 180)
            : isCur ? 0.95 : 0.75;
        }
      }

      outer.getWorldPosition(tmpV);
      frame.baseWorld.set(def.id, tmpV.clone());
      tmpV.y += ANCHOR_H[def.id] * d.scale;
      frame.anchorWorld.set(def.id, tmpV.clone());
    }

    // The data knot's parts: each part's world midpoint, from the
    // spin group's live matrix — so the part chip rides the part
    // as the knot turns, and the part-focus seat (below) is
    // computed from where the part actually is this frame. The
    // knot's centre rides along under "__centre".
    {
      const spin = frame.knotSpinRef;
      if (spin && frame.disp.has("knot")) {
        spin.updateWorldMatrix(true, false);
        const form = KNOT_FORMS.trefoil;
        for (let i = 0; i < KNOT_PARTS.length; i++) {
          const part = KNOT_PARTS[i];
          const mid = torusKnotPoint(form.p, form.q, partMidT(i));
          const v = new THREE.Vector3(
            mid[0] * KNOT_SCALE, mid[2] * KNOT_SCALE, mid[1] * KNOT_SCALE,
          );
          frame.partWorld.set(part.id, spin.localToWorld(v));
        }
        const c = new THREE.Vector3();
        spin.getWorldPosition(c);
        frame.partWorld.set("__centre", c);
      }
    }

    // The data tree's branches: each depth-1 branch's world
    // bounding sphere and fork tip, from the sway group's live
    // matrix — the branch-focus seat and the overlay chips read
    // where the branch actually is this frame.
    {
      const g = frame.treeGroupRef;
      if (g && frame.branchLocal && frame.disp.has("tree")) {
        g.updateWorldMatrix(true, false);
        const sc = new THREE.Vector3();
        g.getWorldScale(sc);
        for (const [id, b] of frame.branchLocal) {
          frame.branchWorld.set(id, {
            centre: g.localToWorld(b.centre.clone()),
            radius: b.radius * Math.abs(sc.x),
            tip: g.localToWorld(b.tip.clone()),
          });
        }
      }
    }

    // Slice 12: sub-node world anchors for the tray, the tangle
    // and the sunbursts — the branch precedent: each citizen's
    // registered local anchors turned into world by its node
    // group's live matrix (through display transform, pivot and
    // spin). Only the citizens that can need them this frame —
    // the current one and the focus holder — are transformed.
    frame.subWorld.clear();
    {
      const wanted = new Set();
      if (st.currentId) wanted.add(st.currentId);
      if (st.partFocus && st.partFocus.objectId) wanted.add(st.partFocus.objectId);
      for (const oid of wanted) {
        const g = frame.subGroupRefs.get(oid);
        const local = frame.subLocal.get(oid);
        if (!g || !local || !frame.disp.has(oid)) continue;
        g.updateWorldMatrix(true, false);
        const sc = new THREE.Vector3();
        g.getWorldScale(sc);
        for (const [nid, a] of local) {
          frame.subWorld.set(`${oid}:${nid}`, {
            centre: g.localToWorld(a.centre.clone()),
            radius: a.radius * Math.abs(sc.x),
          });
        }
      }
    }

    // The wall cards and the clipboard tray: same easing discipline,
    // different homes — a wall slot inside/outside the cabinet, the
    // tray's front-edge stand or its parked place below the platter.
    for (const id of [...MEDIA_ITEMS.map((m) => m.id), "clipboard"]) {
      const d = frame.disp.get(id);
      const outer = frame.outerRefs.get(id);
      const inner = frame.innerRefs.get(id);
      if (!d || !outer || !inner) continue;
      let t;
      if (st.inspectedId === id) {
        t = inspectTargetFor(st, frame, camera, id === "clipboard" ? "tray" : "card");
        // Inspection plane-rotate (B/N) flows here too: a card
        // stands in XY, so its in-plane turn is the inner group's
        // z (innermost under YXZ); the tray lies in XZ, so its
        // in-plane turn is its yaw.
        if (t.spin) {
          t = id === "clipboard" ? { ...t, yaw: t.yaw + t.spin } : { ...t, roll: t.roll + t.spin };
        }
      } else if (shared.drag && shared.drag.id === id) {
        t = { x: shared.drag.point.x, y: 3, z: shared.drag.point.z, yaw: 0, pitch: 0, roll: 0, scale: d.scale };
      } else if (id === "clipboard") {
        const home = st.clipSummoned ? TRAY_HOME : TRAY_PARKED;
        t = { ...home, yaw: 0, pitch: 0, roll: 0, scale: 1 };
      } else {
        const idx = MEDIA_ITEMS.findIndex((m) => m.id === id);
        t = { ...cardSlot(idx, st.libraryOpen), yaw: 0, pitch: 0, roll: 0 };
      }
      d.x = damp(d.x, t.x, 5.5, dt);
      d.y = damp(d.y, t.y, 5.5, dt);
      d.z = damp(d.z, t.z, 5.5, dt);
      d.yaw = damp(d.yaw, t.yaw, 10, dt);
      d.pitch = damp(d.pitch, t.pitch, 10, dt);
      d.roll = damp(d.roll, t.roll, 10, dt);
      d.scale = damp(d.scale, t.scale, 8, dt);
      outer.position.set(d.x, d.y, d.z);
      inner.rotation.set(d.pitch * DEG, d.yaw * DEG, d.roll * DEG);
      inner.scale.setScalar(Math.max(0.05, d.scale));
      const glowT = glowLevel({
        current: st.currentId === id || st.inspectedId === id,
        pending: st.pendingId === id,
        hovered: st.hoverId === id,
      });
      d.glow = damp(d.glow, glowT, 10, dt);
      const mats = frame.matsMap.get(id);
      if (mats) for (const m of mats) m.emissiveIntensity = d.glow * (m.userData.glowScale ?? 1);
      outer.getWorldPosition(tmpV);
      frame.baseWorld.set(id, tmpV.clone());
      tmpV.y += (id === "clipboard" ? 20 : 15) * d.scale;
      frame.anchorWorld.set(id, tmpV.clone());
    }

    // The crystal cluster's cores breathe: each registered core's
    // emissive rides a slow sine, a few percent either way, on its
    // own phase — the only motion the still minerals are allowed.
    if (frame.crystalCores) {
      for (const c of frame.crystalCores) {
        c.mat.emissiveIntensity = st.ambientOn !== false
          ? c.base + c.amp * Math.sin(state.clock.elapsedTime * c.speed + c.phase)
          : damp(c.mat.emissiveIntensity, c.base, 4, dt);
      }
    }

    // Camera: a part-focus seat before the focused knot part, else
    // a close seat before the entered object, else home. The part
    // seat is recomputed EVERY frame from the part's current world
    // midpoint — outward from the knot's centre at reading
    // distance — so when the transform keys turn the knot while a
    // part is focused, the seat tracks and the part stays framed.
    let seat, look;
    const partW = st.partFocus && st.partFocus.partId && st.partFocus.objectId === "knot"
      ? frame.partWorld.get(st.partFocus.partId) : null;
    const branchW = st.partFocus && st.partFocus.partId && st.partFocus.objectId === "tree"
      ? frame.branchWorld.get(st.partFocus.partId) : null;
    const subW = st.partFocus && st.partFocus.partId
      ? frame.subWorld.get(`${st.partFocus.objectId}:${st.partFocus.partId}`) || null : null;
    const cardBase = st.cardId ? frame.baseWorld.get(st.cardId) : null;
    // The entered-card seat and the DOLLY seat are the same seat
    // (slice 11, §4): out from the citizen's base along its
    // radial, raised, looking at its anchor height, its offsets
    // computed by citizenSeatOffsets in space-state.js. The
    // card's offsets are fixed (its zoom lives in the ortho
    // factor alone) UNLESS the dolly's focus is the card's own
    // citizen — C/V pressed while it stands open — in which case
    // the offsets scale and the camera travels in from the
    // F seat with the card open, exactly as the dolly seat does
    // without one.
    const citizenSeat = (id, base, scaleOffsets) => {
      const d = frame.disp.get(id);
      const sc = d ? d.scale : 1;
      const off = citizenSeatOffsets(sc, scaleOffsets ? st.zoomMul : 1);
      const radial = new THREE.Vector3(base.x, 0, base.z);
      if (radial.lengthSq() < 1) radial.set(0, 0, 1);
      radial.normalize();
      return {
        seat: base.clone()
          .addScaledVector(radial, off.radial)
          .add(new THREE.Vector3(0, off.up, 0)),
        look: base.clone().add(new THREE.Vector3(0, ANCHOR_H[id] * 0.55 * sc, 0)),
      };
    };
    if (st.partFocus && st.partFocus.partId && branchW) {
      // Branch focus: seat off the subtree's bounding sphere —
      // centre + outward (from the tree's own base) by the sphere
      // radius and a reading margin, looking at the centre.
      const base = frame.baseWorld.get("tree") || new THREE.Vector3();
      const dir = branchW.centre.clone().sub(base);
      dir.y = 0;
      if (dir.lengthSq() < 1) dir.set(0, 0, 1);
      dir.normalize();
      seat = branchW.centre.clone().addScaledVector(dir, branchW.radius + 40)
        .add(new THREE.Vector3(0, 12, 0));
      look = branchW.centre.clone();
      if (camera === cameras.ortho) { camera.zoom = 1.5 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else if (st.partFocus && st.partFocus.partId && subW) {
      // Sub-node focus (slice 12): the branch seat's shape — off
      // the node's world anchor, outward from the citizen's own
      // base by the node's radius and a reading margin.
      const base = frame.baseWorld.get(st.partFocus.objectId) || new THREE.Vector3();
      const dir = subW.centre.clone().sub(base);
      dir.y = 0;
      if (dir.lengthSq() < 1) dir.set(0, 0, 1);
      dir.normalize();
      seat = subW.centre.clone().addScaledVector(dir, subW.radius + 34)
        .add(new THREE.Vector3(0, 10, 0));
      look = subW.centre.clone();
      if (camera === cameras.ortho) { camera.zoom = 1.5 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else if (st.partFocus && st.partFocus.partId && partW) {
      const centre = frame.partWorld.get("__centre") || partW;
      const dir = partW.clone().sub(centre);
      if (dir.lengthSq() < 1) dir.set(0, 0, 1);
      dir.normalize();
      seat = partW.clone().addScaledVector(dir, 52).add(new THREE.Vector3(0, 12, 0));
      look = partW.clone();
      if (camera === cameras.ortho) { camera.zoom = 1.5 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else if (st.openApp && st.openApp.appId && st.openApp.mode === "center") {
      // An app on the CENTRE STAGE: the seat stands off the stage
      // centre along the home azimuth, framing the dais (radius
      // 104). Full mode falls through to the home overview below
      // — the app owns the camera, so named views are suppressed
      // while it is open (see the viewName guard there).
      const centre = frame.worldGroup
        ? frame.worldGroup.localToWorld(new THREE.Vector3(0, 10, 0))
        : new THREE.Vector3(0, 10, 0);
      // The seat's azimuth is fixed: the rotation parameter spins
      // the WORLD now (see the composition above), not the camera.
      const az = Math.PI / 4;
      const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
      seat = centre.clone().addScaledVector(dir, 168).add(new THREE.Vector3(0, 108, 0));
      look = centre.clone();
      if (camera === cameras.ortho) { camera.zoom = 1.3 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else if (st.cardId && cardBase) {
      const cs = citizenSeat(st.cardId, cardBase, st.zoomFocusId === st.cardId);
      seat = cs.seat;
      look = cs.look;
      if (camera === cameras.ortho) { camera.zoom = 1.35 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else if (st.zoomFocusId && frame.baseWorld.get(st.zoomFocusId)) {
      // THE DOLLY SEAT: C/V with a dolly focus — the camera
      // dollies toward THAT citizen (its card-seat, offsets
      // scaled by the dolly) without opening its card. (When the
      // focused citizen's card IS open, the card branch above
      // takes the same seat with its offsets scaled.)
      const zs = citizenSeat(st.zoomFocusId, frame.baseWorld.get(st.zoomFocusId), true);
      seat = zs.seat;
      look = zs.look;
      if (camera === cameras.ortho) { camera.zoom = 1.35 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else if (st.viewName && st.viewName !== "home" && viewSeat(st.viewName, st.zoomMul)
      && !(st.openApp && st.openApp.appId)) {
      // A named plane view: a pure camera move to the table's seat.
      const vs = viewSeat(st.viewName, st.zoomMul);
      seat = new THREE.Vector3(...vs.seat);
      look = new THREE.Vector3(...vs.look);
      if (camera === cameras.ortho) { camera.zoom = 1 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else {
      // The home seat's azimuth is fixed (persp from the front,
      // ortho at π/4): the rotation parameter spins the WORLD
      // (innermost in the composition above), not the camera —
      // before slice 11 it orbited the camera from here instead.
      const tilt = (st.elevation ?? 0) * DEG;
      if (camera === cameras.persp) {
        const radius = 520 * st.zoomMul;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(190, 486) + tilt));
        seat = new THREE.Vector3(
          0,
          Math.sin(elev) * radius,
          Math.cos(elev) * radius,
        );
      } else {
        const radius = 1000;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(574, 790) + tilt));
        const az = Math.PI / 4;
        seat = new THREE.Vector3(
          Math.sin(az) * Math.cos(elev) * radius,
          Math.sin(elev) * radius,
          Math.cos(az) * Math.cos(elev) * radius,
        );
        camera.zoom = 1 / st.zoomMul;
        camera.updateProjectionMatrix();
      }
      look = new THREE.Vector3(0, 6, 0);
    }
    if (!A.init) {
      A.init = true;
      camera.position.copy(seat);
      A.look.copy(look);
    }
    camera.position.set(
      damp(camera.position.x, seat.x, 3.4, dt),
      damp(camera.position.y, seat.y, 3.4, dt),
      damp(camera.position.z, seat.z, 3.4, dt),
    );
    A.look.set(
      damp(A.look.x, look.x, 3.4, dt),
      damp(A.look.y, look.y, 3.4, dt),
      damp(A.look.z, look.z, 3.4, dt),
    );
    camera.lookAt(A.look);
    camera.updateMatrixWorld();
    // Slice 11 (§12): publish the camera's own axes on the
    // shared ref — the channel the drag point and the audio
    // playhead already travel — so the App's platter steps turn
    // about the axes this camera actually has. No second camera
    // is invented: these are read from this frame's camera,
    // after its final lookAt.
    const ce = camera.matrixWorld.elements;
    st.shared.cameraAxes = {
      right: [ce[0], ce[1], ce[2]],
      up: [ce[4], ce[5], ce[6]],
      forward: [-ce[8], -ce[9], -ce[10]],
    };
  });

  return null;
}

/* ---------- the base: the ground, and the well cut into it ---------- */

/**
 * THE GROUND — the scene's one STATIC base, and the platter's
 * protective sphere made visible. It does NOT ride the world
 * group: the assembly turns over it, and the sphere's circle
 * is subtracted from it — the disc is a Shape with a circular
 * hole of PLATTER_WELL_R at the ground plane, so at any
 * yaw/pitch/roll the assembly (every point within
 * PLATTER_PROTECTIVE_R of the pivot) swings through the well
 * while the floor that remains (every point at least
 * PLATTER_PROTECTIVE_R + PROTECTIVE_CLEARANCE from the pivot)
 * can never be reached. A machined lip ring lies on the cut's
 * edge, its inner radius a further clearance out, so the well
 * reads as a gimbal seat the platter turns in, not as damage.
 */
function GroundBase() {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 900, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, PLATTER_WELL_R, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape, 72);
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo} position={[0, GROUND_Y, 0]} rotation-x={-Math.PI / 2}>
        <meshStandardMaterial color={0x0d1113} roughness={1} />
      </mesh>
      <mesh position={[0, GROUND_Y + 0.05, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[PLATTER_WELL_R + PROTECTIVE_CLEARANCE, PLATTER_WELL_R + 16, 128]} />
        <meshStandardMaterial color={0x232e35} roughness={0.55} metalness={0.35} />
      </mesh>
    </group>
  );
}

/* ---------- the platter drum: the slab, its sockets, their lips ---------- */

/** The socket lips' height: a hair proud of the slab's top
 *  face (−0.05 + 0.13), so the ring clears the citizens' glass
 *  plot plates, whose bottoms rest at y 0. */
const SOCKET_LIP_Y = 0.08;
/** The lip's width — the well lip's proportion, at citizen scale. */
const SOCKET_LIP_W = 8;

/**
 * THE PLATTER DRUM, with the citizens' SOCKETS cut into its
 * top: the protective-sphere rule at citizen scale (see
 * space-state.js's PROTECTIVE_R and platter-top.js). The slab
 * is one CSG solid — the drum's own cylinder minus a cylinder
 * per citizen at its current home — re-evaluated only when the
 * positions signature changes: a layout switch, a drag drop.
 * During a drag the positions map does not move (the carried
 * citizen rides the drag point on the shared ref, lifted clear
 * by the drag machinery), so the surface is never re-cut
 * mid-carry; on drop it is cut at the new home. A machined lip
 * ring lies on each hole's edge — the ground well lip's finish
 * and convention, its inner radius a further clearance out
 * from the cut — so each socket reads as a gimbal seat.
 */
function PlatterDrum({ positions }) {
  const signature = OBJECT_IDS.map((id) => {
    const p = positions ? positions[id] : null;
    return p ? `${p.x.toFixed(2)},${p.z.toFixed(2)}` : "_";
  }).join("|");
  // The signature is the positions map's content; the circles
  // and the solid rebuild exactly when it changes.
  const circles = useMemo(() => socketCircles(positions), [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  const geo = useMemo(() => buildPlatterSolid(circles), [circles]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={0x12181c} roughness={0.85} />
      </mesh>
      {circles.map((c) => (
        <mesh key={c.id} position={[c.x, SOCKET_LIP_Y, c.z]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[c.r + PROTECTIVE_CLEARANCE, c.r + PROTECTIVE_CLEARANCE + SOCKET_LIP_W, 64]} />
          <meshStandardMaterial color={0x232e35} roughness={0.55} metalness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- the view ---------- */

export default function SpaceView(props) {
  const {
    space, currentId, hoverId, cardId, pendingId,
    projection, rotation, elevation, zoomMul,
    zoomFocusId, platterQuat, ringSpinDeg, fieldIndex,
    turntableOn, pulsesOn, ambientOn, labelsOn, sharedRef,
    libraryOpen, clipHeld, clipSummoned, inspectedId, inspectRot, pastes, inspectPanel,
    partFocus, partHoverId, branchHoverId, subHover, descents,
    bookStyle, bookAccess, bookSpread,
    tangleDataset,
    viewName, snapOn, strata, layers,
    openApp, audio, tokenHoverId, appFocusId, regionHover,
    onHover, onPartHover, onBranchHover, onSubHover, onObjectClick, onSelect, onTouch,
    onRingHover,
    onTokenHover, onTokenActivate, onRegionHover, onRegionActivate, onAudioEnd,
  } = props;

  const stateRef = useRef({});
  stateRef.current = {
    space, currentId, hoverId, cardId, pendingId,
    projection, rotation, elevation, zoomMul,
    zoomFocusId, platterQuat, ringSpinDeg, fieldIndex,
    turntableOn, pulsesOn, ambientOn, labelsOn,
    libraryOpen, clipSummoned, inspectedId, inspectRot,
    partFocus, partHoverId, branchHoverId, subHover, descents,
    bookStyle, bookAccess, bookSpread,
    tangleDataset,
    viewName, snapOn, strata, layers,
    openApp, audio, tokenHoverId, appFocusId, regionHover,
    shared: sharedRef.current,
    onHover, onPartHover, onBranchHover, onSubHover, onObjectClick, onSelect, onTouch,
    onRingHover,
    onTokenHover, onTokenActivate, onRegionHover, onRegionActivate, onAudioEnd,
  };

  const frameRef = useRef(null);
  if (!frameRef.current) {
    frameRef.current = {
      disp: new Map(), outerRefs: new Map(), innerRefs: new Map(),
      spinRefs: new Map(), ringRefs: new Map(), matsMap: new Map(),
      turntableAngle: 0, worldYaw: 0,
      anchorWorld: new Map(), baseWorld: new Map(), partWorld: new Map(),
      branchWorld: new Map(), branchLocal: null, treeGroupRef: null,
      subLocal: new Map(), subWorld: new Map(), subGroupRefs: new Map(),
      devicesAnchors: null, netHubLocal: null,
      camera: null, worldGroup: null, turntabling: false, knotSpinRef: null,
      crystalCores: [], crystalFaces: null,
      ringAngle: 0, ringItemRefs: new Map(), tokenRefs: new Map(),
      stageGroupRef: null,
    };
  }
  const frame = frameRef.current;

  const ctxRef = useRef(null);
  if (!ctxRef.current) ctxRef.current = { stateRef, frame };
  const ctx = ctxRef.current;

  const lib = useMemo(() => geoLib(), []);
  const worldRef = useRef(null);
  useEffect(() => { frame.worldGroup = worldRef.current; }, [frame]);

  const cameras = useMemo(() => {
    const persp = new THREE.PerspectiveCamera(40, 900 / 560, 1, 4000);
    const orthoHalf = 218;
    const ortho = new THREE.OrthographicCamera(
      -orthoHalf * (900 / 560), orthoHalf * (900 / 560), orthoHalf, -orthoHalf, -600, 4000,
    );
    return { persp, ortho, orthoHalf };
  }, []);

  const geo = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * PLATTER_R, 0, Math.sin(a) * PLATTER_R));
    }
    return {
      rim: new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x3a4a52 }),
      ),
    };
  }, []);

  const chipRefs = useRef(new Map());
  const compassRefs = useRef([]);
  const nameRef = useRef(null);
  const partRef = useRef(null);
  const branchRef = useRef(null);
  const subRef = useRef(null);
  const branchChipRefs = useRef([]);
  const faceChipRefs = useRef([]);
  const cardFacesRef = useRef(null);
  const cardRef = useRef(null);
  const tokenCapRefs = useRef(new Map());
  const regionChipRef = useRef(null);
  const xyRef = useRef(null);
  const yzRef = useRef(null);
  const inspectRef = useRef(null);
  const wrapRef = useRef(null);

  // DOM overlay loop: chips, compass, name tag and the card ride on
  // the frame snapshot the Rig publishes.
  useEffect(() => {
    let raf = 0;
    const v3 = new THREE.Vector3();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const wrap = wrapRef.current;
      const camera = frame.camera;
      if (!wrap || !camera) return;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight;
      if (!W || !H) return;
      const project = (v) => {
        v3.copy(v).project(camera);
        return [(v3.x * 0.5 + 0.5) * W, (-v3.y * 0.5 + 0.5) * H, v3.z < 1];
      };
      const st = stateRef.current;
      // A ring item's anchor comes from its live group (it rides
      // the turning ring), not from the citizens' anchor table.
      const ringAnchor = (id) => {
        const o = frame.ringItemRefs && frame.ringItemRefs.get(id);
        if (!o) return null;
        const v = new THREE.Vector3();
        o.getWorldPosition(v);
        v.y += 13;
        return v;
      };
      const chipList = [
        ...labeledObjects().map(({ object, label }) => ({ id: object.id, label })),
        ...labeledRingItems().map(({ item, label }) => ({ id: item.id, label })),
        ...(st.libraryOpen
          ? labeledMedia().map(({ item, label }) => ({ id: item.id, label }))
          : []),
      ];
      for (const { id, label } of chipList) {
        const chip = chipRefs.current.get(id);
        if (!chip) continue;
        const anchor = frame.anchorWorld.get(id) || ringAnchor(id);
        // Labels consult the layers like every addressing path: a
        // locked or hidden stratum's things wear no chips.
        if (!st.labelsOn || !anchor || (st.layers && !isAddressable(st.layers, id))) {
          chip.style.display = "none"; continue;
        }
        const [sx, sy, front] = project(anchor);
        if (!front) { chip.style.display = "none"; continue; }
        chip.style.display = "";
        if (chip.textContent !== label) chip.textContent = label;
        chip.classList.toggle("target", st.currentId === id);
        chip.classList.toggle("pending", st.pendingId === id);
        chip.style.transform = `translate(-50%, -130%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      }
      COMPASS.forEach((c, i) => {
        const el = compassRefs.current[i];
        if (!el || !frame.worldGroup) return;
        if (st.strata && !st.strata.scenery) { el.style.display = "none"; return; }
        el.style.display = "";
        const wp = frame.worldGroup.localToWorld(new THREE.Vector3(c.x, 1, c.z));
        const [sx, sy] = project(wp);
        el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      });
      const nameEl = nameRef.current;
      if (nameEl) {
        const named = st.inspectedId || st.cardId || st.currentId || st.hoverId;
        const anchor = named ? (frame.anchorWorld.get(named) || ringAnchor(named)) : null;
        if (named && anchor) {
          nameEl.style.display = "";
          const nm = thingName(named);
          if (nameEl.textContent !== nm) nameEl.textContent = nm;
          const [sx, sy] = project(anchor);
          nameEl.style.transform = `translate(-50%, -260%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        } else nameEl.style.display = "none";
      }
      const xyEl = xyRef.current;
      if (xyEl && frame.worldGroup) {
        if (st.strata && !st.strata.instruments) { xyEl.style.display = "none"; }
        else {
          xyEl.style.display = "";
          const wp = frame.worldGroup.localToWorld(new THREE.Vector3(-WALL.w / 2 + 10, WALL.cy + WALL.h / 2 - 8, WALL.z));
          const [sx, sy] = project(wp);
          xyEl.style.transform = `translate(0, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        }
      }
      const yzEl = yzRef.current;
      if (yzEl && frame.worldGroup) {
        if (st.strata && !st.strata.instruments) { yzEl.style.display = "none"; }
        else {
          yzEl.style.display = "";
          const wp = frame.worldGroup.localToWorld(new THREE.Vector3(YZ.x, YZ.cy + YZ.h / 2 - 8, -YZ.w / 2 + 10));
          const [sx, sy] = project(wp);
          yzEl.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        }
      }
      const partEl = partRef.current;
      if (partEl) {
        // The knot part chip: pinned at the part's world midpoint.
        // A hovered part (knot current) shows its name; a FOCUSED
        // part's chip is its panel — name, value, share of the
        // knot's total, and its arc range on the curve.
        const focId = st.partFocus && st.partFocus.objectId === "knot" ? st.partFocus.partId : null;
        const hovId = st.currentId === "knot" ? st.partHoverId : null;
        const pid = focId || hovId;
        const anchor = pid ? frame.partWorld.get(pid) : null;
        const part = pid ? partById(pid) : null;
        if (pid && part && anchor && !(st.layers && !isAddressable(st.layers, "knot"))) {
          const [t0, t1] = [
            Math.round((partMidT(pid) - Math.PI / 8) * 180 / Math.PI),
            Math.round((partMidT(pid) + Math.PI / 8) * 180 / Math.PI),
          ];
          const txt = focId
            ? `${part.name} — value ${part.value} · ${(partShare(part) * 100).toFixed(1)}% of the knot · arc ${t0}°–${t1}°`
            : part.name;
          if (partEl.textContent !== txt) partEl.textContent = txt;
          partEl.className = focId ? "us-chip target" : "us-chip";
          const [sx, sy, front] = project(anchor);
          if (!front) partEl.style.display = "none";
          else {
            partEl.style.display = "";
            partEl.style.transform = `translate(-50%, -170%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
          }
        } else partEl.style.display = "none";
      }
      const branchEl = branchRef.current;
      if (branchEl) {
        // The tree branch chip: pinned at the branch's fork tip on
        // hover (name only); a FOCUSED branch's chip is its panel —
        // name, value, share of the tree, leaf count, depth.
        const focId = st.partFocus && st.partFocus.objectId === "tree" ? st.partFocus.partId : null;
        const hovId = st.currentId === "tree" ? st.branchHoverId : null;
        const bid = focId || hovId;
        const bw = bid ? frame.branchWorld.get(bid) : null;
        const branch = bid ? lib.dataTree.branches.find((b) => b.id === bid) : null;
        if (bid && branch && bw && !(st.layers && !isAddressable(st.layers, "tree"))) {
          const txt = focId
            ? `${branch.name} — value ${branch.value} · ${(branch.share * 100).toFixed(1)}% of the tree · ${branch.leafCount} leaves · depth 1`
            : branch.name;
          if (branchEl.textContent !== txt) branchEl.textContent = txt;
          branchEl.className = focId ? "us-chip target" : "us-chip";
          const [sx, sy, front] = project(focId ? bw.centre : bw.tip);
          if (!front) branchEl.style.display = "none";
          else {
            branchEl.style.display = "";
            branchEl.style.transform = `translate(-50%, -170%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
          }
        } else branchEl.style.display = "none";
      }
      const subEl = subRef.current;
      if (subEl) {
        // Slice 12: the sub-node info card — it stands in the
        // space at the sub-node itself, on its world anchor
        // (through the citizen's display transform, pivot and
        // spin): name, value, share and depth on hover; a focused
        // node's card adds its path from the true root. Shares
        // read against the citizen's standing display root — a
        // sunburst under descent speaks of its descended root,
        // and says so.
        const focSub = st.partFocus && st.partFocus.partId
          && st.partFocus.objectId !== "knot" && st.partFocus.objectId !== "tree"
          ? st.partFocus : null;
        // Slice 13-2: the book's FOCUS is its page standing out
        // of the drum (the deepest access tier) — it wins over a
        // hover, as a part focus does, and its card is the page
        // itself: the full text.
        const focBook = !focSub && st.currentId === "book" && st.bookAccess
          ? bookPageOutId(st.bookAccess) : null;
        const hovSub = !focSub && !focBook && st.subHover && st.currentId && st.subHover.objectId === st.currentId
          ? st.subHover : null;
        const oid = focSub ? focSub.objectId : focBook ? "book" : hovSub ? hovSub.objectId : null;
        const nid = focSub ? focSub.partId : focBook || (hovSub ? hovSub.nodeId : null);
        const sw = oid && nid ? frame.subWorld.get(`${oid}:${nid}`) : null;
        const rootId = oid && st.descents ? displayRootOf(st.descents[oid], oid) : null;
        const node = oid && nid ? subnodeById(oid, nid, rootId, st.tangleDataset) : null;
        if (oid && nid && sw && node) {
          const whole = subnodeRootOf(oid, rootId, st.tangleDataset);
          let lines = [
            node.name,
            `value ${node.value} · ${(node.share * 100).toFixed(1)}% of ${whole ? whole.name : "the whole"} · depth ${node.depth}`,
          ];
          if (focSub) lines.push(node.path.join(" › "));
          if (rootId) lines.push("shares are of the display root — descended");
          if (oid === "book") {
            // The book's cards speak in the book's own terms:
            // tiers by their page counts and shares, a hovered
            // page by its first line and its place, and a page
            // standing out by its whole text.
            const bn = bookNodeById(nid);
            if (bn && focBook) {
              lines = [bn.title, ...bn.lines];
            } else if (bn && bn.kind === "page") {
              lines = [
                bn.title,
                bn.lines[0] || "",
                `page ${bn.number} of ${BOOK_TOTALS.pages} · ${bn.chapterName} › ${bn.sectionName}`,
              ];
            } else if (bn) {
              lines = [
                node.name,
                `${bn.pageCount} pages · ${node.value} words · ${(node.share * 100).toFixed(1)}% of the book`,
                node.path.join(" › "),
              ];
            }
          }
          if (oid === "devices") {
            // The devices' cards speak in their own terms: a
            // device by its state (the printer by its queue, in
            // full), the hub by its connections, a host by its
            // port and its bytes.
            if (nid === "devices/net") {
              const t = connectionTotals(ENVIRONMENT);
              lines = [
                "Network hub",
                `${t.count} connections · ${formatBytes(t.bytes)} moved`,
                "cables run from the hub to the hosts' tokens on the ring",
              ];
            } else if (nid.startsWith("devices/net/")) {
              const idx = connectionIds(ENVIRONMENT).indexOf(nid);
              const conn = idx >= 0 ? connectionsOf(ENVIRONMENT)[idx] : null;
              if (conn) {
                lines = [
                  conn.host,
                  `${conn.protocol} · port ${conn.port}`,
                  `in ${formatBytes(conn.bytesIn)} · out ${formatBytes(conn.bytesOut)}`,
                ];
              }
            } else {
              const dev = deviceBySlug(ENVIRONMENT, nid.slice("devices/".length));
              if (dev && dev.kind === "printer") {
                const q = queueTotals(dev);
                lines = [
                  dev.name,
                  `${q.jobs} jobs queued · ${q.pagesKnown ? `${q.pages} pages` : "pages not reported"}`,
                  ...(dev.queue || []).map((j) => `${j.name} — ${j.pages != null ? `${j.pages} pages` : "pages —"} · ${j.status}`),
                ];
              } else if (dev && dev.kind === "storage" && dev.sizeGB != null) {
                lines = [dev.name, `${dev.sizeGB} GB · ${dev.freeGB} GB free`];
              } else if (dev) {
                lines = [dev.name, dev.state || dev.kind];
              }
            }
          }
          const txt = lines.join("\n");
          if (subEl.textContent !== txt) subEl.textContent = txt;
          const [sx, sy, front] = project(sw.centre);
          if (!front) subEl.style.display = "none";
          else {
            subEl.style.display = "";
            subEl.style.transform = `translate(-50%, -135%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
          }
        } else subEl.style.display = "none";
      }
      // Label mode: the depth-1 branches name themselves at their
      // forks (DOM chips, like the crystal's face values).
      {
        const showBranches = st.labelsOn && !(st.layers && !isAddressable(st.layers, "tree"));
        lib.dataTree.branches.forEach((b, i) => {
          const el = branchChipRefs.current[i];
          if (!el) return;
          const bw = showBranches ? frame.branchWorld.get(b.id) : null;
          if (!bw) { el.style.display = "none"; return; }
          const [sx, sy, front] = project(bw.tip);
          if (!front) { el.style.display = "none"; return; }
          if (el.textContent !== b.name) el.textContent = b.name;
          el.style.display = "";
          el.style.transform = `translate(-50%, -130%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        });
      }
      const inspEl = inspectRef.current;
      if (inspEl) {
        const anchor = st.inspectedId ? frame.anchorWorld.get(st.inspectedId) : null;
        if (st.inspectedId && anchor) {
          inspEl.style.display = "";
          const [sx, sy] = project(anchor);
          inspEl.style.transform = `translate(-112%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        } else inspEl.style.display = "none";
      }
      const cardEl = cardRef.current;
      if (cardEl) {
        const anchor = st.cardId ? frame.anchorWorld.get(st.cardId) : null;
        if (st.cardId && anchor) {
          cardEl.style.display = "";
          const [sx, sy] = project(anchor);
          cardEl.style.transform = `translate(16px, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        } else cardEl.style.display = "none";
        // The living crystal's entered card lists its faces live.
        const facesEl = cardFacesRef.current;
        if (facesEl) {
          if (st.cardId === "crystal" && frame.crystalFaces) {
            const txt = frame.crystalFaces.map((f) => `${f.label} — ${f.value.toFixed(2)}`).join("\n");
            if (facesEl.textContent !== txt) facesEl.textContent = txt;
          }
        }
      }
      // The open app's ring-token captions: pinned over their
      // tokens, speaking their state (PLAY/PAUSE, the window the
      // ZOOM token would halve, LOOP ON/OFF). Shown only while
      // the app holds the stage.
      {
        const showTokens = Boolean(st.openApp && st.openApp.appId && st.audio);
        for (const t of APP_TOKEN_UI) {
          const el = tokenCapRefs.current.get(t.id);
          if (!el) continue;
          const o = showTokens && frame.tokenRefs ? frame.tokenRefs.get(t.id) : null;
          if (!o) { el.style.display = "none"; continue; }
          const v = new THREE.Vector3();
          o.getWorldPosition(v);
          v.y += 11;
          const [sx, sy, front] = project(v);
          if (!front) { el.style.display = "none"; continue; }
          const txt = t.caption(st.audio);
          if (el.textContent !== txt) el.textContent = txt;
          el.classList.toggle("target",
            st.tokenHoverId === t.id || (st.appFocusId === t.id && st.tokenHoverId == null));
          el.style.display = "";
          el.style.transform = `translate(-50%, -130%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        }
      }
      // The hovered waveform stretch names itself (its seconds)
      // over the fence — F drills into it, D comes back.
      {
        const el = regionChipRef.current;
        if (el) {
          const show = st.openApp && st.openApp.appId && st.audio
            && st.regionHover != null && frame.stageGroupRef;
          if (!show) el.style.display = "none";
          else {
            const w = st.audio.window;
            const z = st.regionHover;
            const t0 = w.start + ((w.end - w.start) * z) / REGION_ZONES;
            const t1 = w.start + ((w.end - w.start) * (z + 1)) / REGION_ZONES;
            const txt = `${t0.toFixed(1)}–${t1.toFixed(1)}s`;
            if (el.textContent !== txt) el.textContent = txt;
            const local = new THREE.Vector3(
              -168 / 2 + (z + 0.5) * (168 / REGION_ZONES), 36, 30);
            const world = frame.stageGroupRef.localToWorld(local);
            const [sx, sy, front] = project(world);
            if (!front) el.style.display = "none";
            else {
              el.style.display = "";
              el.style.transform = `translate(-50%, -130%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
            }
          }
        }
      }
      // The living crystal's face chips: a value pinned at each
      // face's centroid, shown only while it is current or
      // inspected (and its layer is addressable).
      {
        const showFaces = (st.currentId === "crystal" || st.inspectedId === "crystal")
          && frame.crystalFaces && !(st.layers && !isAddressable(st.layers, "crystal"));
        FACE_DATA.forEach((f, i) => {
          const el = faceChipRefs.current[i];
          if (!el) return;
          const face = showFaces ? frame.crystalFaces[i] : null;
          if (!face) { el.style.display = "none"; return; }
          const [sx, sy, front] = project(face.world);
          if (!front) { el.style.display = "none"; return; }
          const txt = `${face.label} ${face.value.toFixed(2)}`;
          if (el.textContent !== txt) el.textContent = txt;
          el.style.display = "";
          el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        });
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [frame]);

  const cardObj = cardId ? objectById(cardId) : null;
  const cardTr = cardId ? space.transforms[cardId] : null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}
      onPointerDown={() => stateRef.current.onTouch()}>
      <Canvas
        flat
        dpr={Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2)}
        gl={{ antialias: true }}
        camera={cameras.ortho}
        style={{ position: "absolute", inset: 0 }}
      >
        <color attach="background" args={[0x0b0e10]} />
        <hemisphereLight args={[0xdfeeea, 0x1a2226, 1.0]} />
        <directionalLight position={[180, 320, 220]} intensity={1.5} />
        <directionalLight position={[-240, 90, -260]} intensity={0.45} color={0x7fd4c1} />

        <Rig ctx={ctx} cameras={cameras} />

        {/* The ground is the one STATIC base: it stands outside
            the world group, and the platter's protective sphere
            has its circle subtracted from it (GroundBase). A
            hidden scenery stratum hides it with the rest. */}
        {strata?.scenery ? <GroundBase /> : null}

        <group ref={worldRef}>
          {/* Layers: a hidden stratum is NOT RENDERED — scenery
              included, no ghost exception. */}
          {strata?.scenery ? (
            <>
              {/* The drum, its top cut with the citizens'
                  sockets, re-cut when their positions change. */}
              <PlatterDrum positions={space.positions} />
              <primitive object={geo.rim} position={[0, 0.05, 0]} />
              <AtmosphereKnots ctx={ctx} />
              <CrystalCluster ctx={ctx} />
              <BotanicalTree ctx={ctx} />
            </>
          ) : null}
          {/* An app across the WHOLE platter hides the citizens:
              the data stratum unmounts (its displayed values rest
              in frame.disp and ease back when the app closes). */}
          {strata?.data && !(openApp && openApp.appId && openApp.mode === "full") ? (
            <>
              {OBJECTS.map((def) => (
                <SpaceObject key={def.id} def={def} ctx={ctx} lib={lib}
                  descentRootId={descents ? displayRootOf(descents[def.id], def.id) : null}
                  tangleDataset={tangleDataset}
                  bookStyle={bookStyle} bookAccess={bookAccess} bookSpread={bookSpread} />
              ))}
              {space.cables.map(([a, b], i) => (
                <Cable key={`${a}|${b}`} a={a} b={b} offset={(i * 0.37) % 1} ctx={ctx} />
              ))}
              <PendingCable ctx={ctx} />
              {/* Slice 14: the devices citizen's connections —
                  host tokens on the ring's back arc and their
                  cables from the shelf's hub. They belong to
                  the DATA stratum with their citizen. */}
              <NetworkLayer ctx={ctx} />
            </>
          ) : null}
          {strata?.instruments ? (
            <>
              <MediaWall ctx={ctx} />
              <DatumYZ />
              {MEDIA_ITEMS.map((item, i) => (
                <MediaCard key={item.id} item={item} index={i} ctx={ctx} />
              ))}
              <ClipboardTray ctx={ctx} held={clipHeld} />
              <PlatterRing ctx={ctx} />
              <WaveformStage ctx={ctx} />
            </>
          ) : null}
          <AxisGuide ctx={ctx} />
        </group>
        {strata?.instruments ? (pastes || []).map((p) => (
          <PasteCard key={p.targetId} targetId={p.targetId} item={p.item} frame={frame} />
        )) : null}
      </Canvas>

      <div ref={wrapRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[
          ...labeledObjects().map(({ object, label }) => ({ id: object.id, label })),
          ...labeledRingItems().map(({ item, label }) => ({ id: item.id, label })),
          ...(libraryOpen
            ? labeledMedia().map(({ item, label }) => ({ id: item.id, label }))
            : []),
        ].map(({ id, label }) => (
          <button
            key={id}
            ref={(el) => { if (el) chipRefs.current.set(id, el); else chipRefs.current.delete(id); }}
            className="us-chip"
            style={{ display: "none" }}
            onClick={() => stateRef.current.onSelect(id)}
          >
            {label}
          </button>
        ))}
        <div ref={xyRef} className="us-plane-tag">XY</div>
        <div ref={yzRef} className="us-plane-tag">YZ</div>
        <div ref={inspectRef} className="us-inspect" style={{ display: "none" }}>
          {inspectPanel ? (
            <>
              <b>{inspectPanel.title}</b><br />
              {inspectPanel.lines.map((ln, i) => (
                <span key={i}>{ln}<br /></span>
              ))}
            </>
          ) : null}
        </div>
        {COMPASS.map((c, i) => (
          <div
            key={c.t}
            ref={(el) => { compassRefs.current[i] = el; }}
            className="us-compass"
            style={c.t === "N" ? { color: "#ffa726", fontWeight: "bold" } : undefined}
          >
            {c.t}
          </div>
        ))}
        <div ref={nameRef} className="us-name" style={{ display: "none" }} />
        {APP_TOKEN_UI.map((t) => (
          <div
            key={t.id}
            ref={(el) => { if (el) tokenCapRefs.current.set(t.id, el); else tokenCapRefs.current.delete(t.id); }}
            className="us-chip"
            style={{ display: "none", pointerEvents: "none" }}
          />
        ))}
        <div ref={regionChipRef} className="us-chip" style={{ display: "none", pointerEvents: "none" }} />
        <div ref={partRef} className="us-chip" style={{ display: "none", pointerEvents: "none" }} />
        <div ref={branchRef} className="us-chip" style={{ display: "none", pointerEvents: "none" }} />
        <div ref={subRef} className="us-info" style={{ display: "none", pointerEvents: "none", whiteSpace: "pre-line" }} />
        {lib.dataTree.branches.map((b, i) => (
          <div key={b.id}
            ref={(el) => { branchChipRefs.current[i] = el; }}
            className="us-chip" style={{ display: "none", pointerEvents: "none" }} />
        ))}
        {FACE_DATA.map((f, i) => (
          <div key={f.id}
            ref={(el) => { faceChipRefs.current[i] = el; }}
            className="us-chip" style={{ display: "none", pointerEvents: "none" }} />
        ))}
        <div ref={cardRef} className="us-info" style={{ display: "none" }}>
          {cardObj && cardTr ? (
            <>
              <b>{cardObj.name}</b><br />
              {cardObj.blurb}<br />
              <span>
                yaw {Math.round(cardTr.yaw)}° · pitch {Math.round(cardTr.pitch)}° · roll {Math.round(cardTr.roll)}° · plane {Math.round(cardTr.spin || 0)}° · magnify {cardTr.scale.toFixed(2)}×
                <br />D (GO BACK II) — fly back to the world seat
              </span>
              {cardObj.id === "crystal" ? (
                <span ref={cardFacesRef} style={{ display: "block", whiteSpace: "pre-line", marginTop: 4 }} />
              ) : null}
              {cardObj.id === "tree" ? (
                <span style={{ display: "block", marginTop: 4 }}>
                  total value {lib.dataTree.totalValue} · {lib.dataTree.leafCount} leaves · depth {lib.dataTree.maxDepth}<br />
                  grown from the noctivagous-linux repository by L-system rules — file sizes are the values
                </span>
              ) : null}
              {(cardObj.id === "mesa" || cardObj.id === "drum") && descents
                && displayRootOf(descents[cardObj.id], cardObj.id) ? (
                <span style={{ display: "block", marginTop: 4 }}>
                  descended — rooted at {subnodeById(cardObj.id, displayRootOf(descents[cardObj.id], cardObj.id))?.path.join(" › ")}<br />
                  values and shares are of this root · the backs climb out
                </span>
              ) : null}
              {cardObj.id === "book" ? (
                <span style={{ display: "block", marginTop: 4 }}>
                  {BOOK_TOTALS.chapters} chapters · {BOOK_TOTALS.sections} sections · {BOOK_TOTALS.pages} pages · {BOOK_TOTALS.words} words<br />
                  {bookStyle === "spread"
                    ? `standing open — spread {(bookSpread || 0) + 1} of ${SPREAD_COUNT} · B / N flip the spread`
                    : "leaves around the drum · U stands it open, two pages at a time"}
                  {bookAccessedId(bookAccess) ? (
                    <><br />in the book at {subnodeById("book", bookAccessedId(bookAccess))?.path.join(" › ")}</>
                  ) : null}
                </span>
              ) : null}
              {cardObj.id === "devices" ? (
                <span style={{ display: "block", marginTop: 4 }}>
                  {ENV_TOTALS.devices} devices · printer queue {ENV_TOTALS.jobs} jobs · {ENV_TOTALS.connections} connections cabled to the ring<br />
                  {ENV_TOTALS.sample
                    ? "the environment snapshot is a SAMPLE machine — regenerate with snapshot-environment.mjs --real to show this one"
                    : "from this machine's environment snapshot"}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
