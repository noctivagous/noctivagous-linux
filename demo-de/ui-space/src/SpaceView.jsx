import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
import { FLARE } from "../../src/sunburst-data.js";
import { TANGLE_LEVELS } from "../../src/tangle-data.js";
import {
  OBJECTS,
  OBJECT_IDS,
  objectById,
  labeledObjects,
  PLATTER_R,
  clampGround,
  glowLevel,
  inspectScaleFor,
  viewSeat,
  snapGroundPoint,
  axisLockPoint,
  isAddressable,
} from "./space-state.js";
import { MEDIA_ITEMS, mediaById, labeledMedia } from "./media-library.js";
import {
  KNOT_FORMS,
  KNOT_PARTS,
  torusKnotPoint,
  partArc,
  partMidT,
  radiusFor,
  partById,
  partShare,
} from "./knots.js";
import {
  buildCrystal,
  formPlanes,
  solidFromForms,
  distanceForValue,
  FACE_DATA,
} from "./crystals.js";

/**
 * UI Space — SpaceView: the R3F scene.
 *
 * Eleven miniature frames stand on the platter as citizens of one
 * space. The scene is declared (one component per object, cables as
 * components), and ONE useFrame driver (the Rig) eases every
 * displayed value toward the pure state in space-state.js: object
 * positions (layout flights and drags), yaw/pitch/roll/scale, the
 * parametric camera (home seat from the parameters and the 1/2 zoom,
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
  return objectById(id)?.name || mediaById(id)?.title ||
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

let _lib = null;
function geoLib() {
  if (_lib) return _lib;
  const sbRoot = buildSunburst(FLARE);
  const sbColour = sunburstColourScale(sbRoot.children.map((c) => c.name));
  const sbNodes = sunburstDescendants(sbRoot).filter((n) => n.depth >= 1 && n.depth <= 2);
  const RING = 8.5;
  const mesaWedges = [];
  const drumBlocks = [];
  for (const n of sbNodes) {
    const color = sbColour(n);
    const mesaGeo = sectorGeometry(n.x0, n.x1, n.y0, n.y1, RING, 0, n.depth === 1 ? 12 : 6.5);
    if (mesaGeo) mesaWedges.push({ geo: mesaGeo, color });
    const drumGeo = sectorGeometry(n.x0, n.x1, n.y0, n.y1, RING, 0, 20);
    if (drumGeo) drumBlocks.push({ geo: drumGeo, color });
  }

  const tmRoot = buildTreemap(FLARE);
  const trayPlates = [];
  const trayCuboids = [];
  for (const n of treemapDescendants(tmRoot)) {
    if (n.depth === 1) trayPlates.push({ node: n, color: treemapHouseColor(tmRoot, n) });
    else if (n.depth === 2) trayCuboids.push({ node: n, color: treemapHouseColor(tmRoot, n) });
  }
  const cubePieces = treemapCubeFaces(tmRoot).map((p) => ({
    ...p, color: treemapHouseColor(tmRoot, p.node), isLeaf: p.node.children.length === 0,
  }));

  // Tangled tree fan: levels ascend, parents linked by line segments.
  const tanglePos = new Map();
  TANGLE_LEVELS.forEach((level, li) => {
    const n = level.length;
    level.forEach((node, i) => {
      const spread = n <= 1 ? 0 : Math.min(6.4, 44 / (n - 1));
      tanglePos.set(node.id, {
        x: (i - (n - 1) / 2) * spread,
        y: 2.5 + li * 3.4,
        z: (li - 3) * 5.6,
        level: li,
        parents: node.parents || [],
      });
    });
  });
  const tangleNodes = [...tanglePos.values()];
  const tangleLinePts = [];
  for (const p of tangleNodes) {
    for (const par of p.parents) {
      const q = tanglePos.get(par);
      if (q) tangleLinePts.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  const tangleLineGeo = new THREE.BufferGeometry();
  tangleLineGeo.setAttribute("position", new THREE.Float32BufferAttribute(tangleLinePts, 3));

  // Horizon skyline: a seeded relief of boxes.
  let seed = 20261113;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const skyline = [];
  const skyColors = ["#1d5c38", "#2e7d4f", "#3f6fb5", "#5b8fd6"];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 5; j++) {
      const h = 3 + rnd() * 11;
      skyline.push({ x: (i - 4) * 5.6, z: (j - 2) * 6, h, color: skyColors[Math.min(3, Math.floor(h / 4))] });
    }
  }

  // Horizon panel bars.
  const bars = [];
  for (let i = 0; i < 20; i++) {
    const h = 4 + 17 * Math.abs(Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.53) * 0.4);
    bars.push({ x: -21.5 + i * 2.26, h, alt: i % 2 === 0 });
  }

  // Definition wires.
  const wireGeos = [
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-16, 11, 0), new THREE.Vector3(-7, 18, 3), new THREE.Vector3(2, 15, 5)), 16, 0.45, 6),
    new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(2, 15, 5), new THREE.Vector3(9, 19, 1), new THREE.Vector3(17, 10, -3)), 16, 0.45, 6),
  ];

  _lib = {
    mesaWedges, drumBlocks, trayPlates, trayCuboids, cubePieces,
    tangleNodes, tangleLineGeo, skyline, bars, wireGeos,
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

function MiniMesa({ lib, matFor, ctx }) {
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
      {lib.mesaWedges.map((w, i) => (
        <mesh key={i} geometry={w.geo} material={matFor(w.color, { opacity: 0.86, glowScale: 0.7, keepDepth: true })} />
      ))}
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

function MiniDrum({ lib, matFor, ctx }) {
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
      {lib.drumBlocks.map((b, i) => (
        <mesh key={i} geometry={b.geo} position={[0, 1.6, 0]} material={matFor(b.color, { rough: 0.5 })} />
      ))}
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
  const amp = useRef(1);
  const chosen = useMemo(() => {
    const idx = [];
    const step = Math.max(1, Math.floor(lib.trayCuboids.length / 6));
    for (let i = 0; i < lib.trayCuboids.length && idx.length < 6; i += step) idx.push(i);
    return idx;
  }, [lib]);
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
  });
  return (
    <group>
      {/* The tray itself is glass; the cuboids stand solid in it. */}
      <mesh position={[0, 0.7, 0]} geometry={lib.unitBox} scale={[W + 5, 1.4, H + 5]}
        material={matFor(0x9fd8e8, { opacity: 0.28, glowScale: 0.3 })} />
      {lib.trayPlates.map(({ node, color }, i) => {
        const r = rect(node);
        return (
          <mesh key={`p${i}`} geometry={lib.unitBox} position={[r.cx, 1.7, r.cz]}
            scale={[Math.max(0.4, r.w - 0.7), 1, Math.max(0.4, r.d - 0.7)]}
            material={matFor(new THREE.Color(color).multiplyScalar(0.4).getHex(), { rough: 0.9 })} />
        );
      })}
      {lib.trayCuboids.map(({ node, color }, i) => {
        const r = rect(node);
        return (
          <mesh key={`c${i}`} geometry={lib.unitBox} position={[r.cx, 2.2 + 3, r.cz]}
            ref={(el) => { cuboidRefs.current[i] = el; }}
            scale={[Math.max(0.4, r.w - 1.4), 6, Math.max(0.4, r.d - 1.4)]}
            material={matFor(color, { rough: 0.5 })} />
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

function MiniTangle({ lib, matFor, ctx }) {
  const ref = useRef(null);
  // Flow: a handful of light points travel the tree's own link
  // segments, end to end, each on its own offset.
  const flow = useMemo(() => {
    const attr = lib.tangleLineGeo.getAttribute("position");
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
  }, [lib]);
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
    lib.tangleNodes.forEach((p, i) => {
      M.makeTranslation(p.x, p.y, p.z);
      m.setMatrixAt(i, M);
      m.setColorAt(i, C.set(TANGLE_PALETTE[p.level % TANGLE_PALETTE.length]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [lib]);
  return (
    <group>
      <mesh position={[0, 0.8, 0]} geometry={lib.unitBox} scale={[52, 1.6, 46]}
        material={matFor(0x1a2227, { rough: 0.9 })} />
      {/* Level sheets are glass; the figures stand solid on them. */}
      {TANGLE_LEVELS.map((_, li) => (
        <mesh key={li} position={[0, 2.3 + li * 3.4, (li - 3) * 5.6]} geometry={lib.unitBox}
          scale={[50, 0.35, 5.2]} material={matFor(0x9fd8e8, { opacity: 0.13, glowScale: 0.3 })} />
      ))}
      <lineSegments geometry={lib.tangleLineGeo}>
        <lineBasicMaterial color={0x6f8894} transparent opacity={0.75} />
      </lineSegments>
      <points geometry={flow.geo} material={flow.mat} />
      <instancedMesh ref={ref} args={[undefined, undefined, lib.tangleNodes.length]} key={lib.tangleNodes.length}>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <primitive object={matFor(0xffffff, { rough: 0.5 })} attach="material" />
      </instancedMesh>
    </group>
  );
}

function MiniSkyline({ lib, matFor, ctx }) {
  const ref = useRef(null);
  // The monitor lives: every tower's height breathes a few percent
  // on its own phase, so the lanes keep updating in place.
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
      S.set(4.8, h, 5.2);
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
      S.set(4.8, b.h, 5.2);
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

function MiniHorizonPanel({ lib, matFor, ctx }) {
  // The flat monitor lives too: its bars ride a slow shimmer,
  // each on its own phase, feet planted on the panel baseline.
  const barRefs = useRef([]);
  const amp = useRef(1);
  useFrame((state, dt) => {
    const a = ambientAmp(amp, ctx, dt);
    const t = state.clock.elapsedTime;
    lib.bars.forEach((b, i) => {
      const m = barRefs.current[i];
      if (!m) return;
      const h = b.h * (1 + a * 0.09 * Math.sin(t * 1.05 + i * 0.87));
      m.scale.y = h;
      m.position.y = -13 + h / 2;
    });
  });
  return (
    <group>
      <mesh position={[0, 1, 4]} geometry={lib.unitBox} scale={[50, 2, 10]}
        material={matFor(0x27313a, { rough: 0.85 })} />
      <group position={[0, 15, 0]} rotation-x={-0.1}>
        <mesh geometry={lib.unitBox} scale={[48, 28, 1.6]} material={matFor(0x131a1e, { rough: 0.8 })} />
        {lib.bars.map((b, i) => (
          <mesh key={i} geometry={lib.unitBox} position={[b.x, -13 + b.h / 2, 1.1]} scale={[1.7, b.h, 0.7]}
            ref={(el) => { barRefs.current[i] = el; }}
            material={matFor(b.alt ? 0x3f6fb5 : 0x2e7d4f, { rough: 0.45 })} />
        ))}
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

class KnotCurve extends THREE.Curve {
  constructor(p, q, scale) {
    super();
    this.p = p; this.q = q; this.scale = scale;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const [x, y, z] = torusKnotPoint(this.p, this.q, t * Math.PI * 2);
    return target.set(x * this.scale, z * this.scale, y * this.scale);
  }
}

/** One part's arc of a knot, as a curve for its tube segment. */
class KnotArcCurve extends THREE.Curve {
  constructor(p, q, t0, t1, scale) {
    super();
    this.p = p; this.q = q; this.t0 = t0; this.t1 = t1; this.scale = scale;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const [x, y, z] = torusKnotPoint(this.p, this.q, this.t0 + (this.t1 - this.t0) * t);
    return target.set(x * this.scale, z * this.scale, y * this.scale);
  }
}

/**
 * The DATA KNOT. Its tube is built per part — one TubeGeometry per
 * arc, radius from the part's value (knots.js radiusFor) — and,
 * per the opacity law, the tube is SEMI-TRANSPARENT because it
 * contains data: glass in the part's hue at 0.45, with a bright
 * solid DATA CORE (a bead at the arc midpoint) ghosting through.
 * The part materials are NOT in the Rig's glow list: this component
 * drives them itself, so a hovered or focused part can brighten
 * beyond the knot's own tier. The whole knot turns slowly on its
 * own (a living sculpture, independent of the turntable), pausing
 * while it is inspected or a part is zoomed. Parts report their
 * hover through ctx (the App gates it on the knot being current).
 */
function MiniKnot({ lib, matFor, ctx }) {
  const spin = useRef(null);
  const parts = useMemo(() => {
    const form = KNOT_FORMS.trefoil;
    return KNOT_PARTS.map((part, i) => {
      const [t0, t1] = partArc(i);
      const radius = radiusFor(part.value);
      const geo = new THREE.TubeGeometry(
        new KnotArcCurve(form.p, form.q, t0, t1, KNOT_SCALE), 42, radius, 10, false,
      );
      const mid = torusKnotPoint(form.p, form.q, partMidT(i));
      const hue = new THREE.Color().setHSL(part.hue / 360, 0.55, 0.55);
      const glass = new THREE.MeshStandardMaterial({
        color: hue, roughness: 0.25, metalness: 0.1,
        transparent: true, opacity: 0.45, depthWrite: false,
        emissive: hue, emissiveIntensity: 0,
      });
      const core = new THREE.MeshStandardMaterial({
        color: hue, roughness: 0.3, metalness: 0.05,
        emissive: hue, emissiveIntensity: 0.5,
      });
      return {
        part, geo, radius, glass, core,
        midV: new THREE.Vector3(mid[0] * KNOT_SCALE, mid[2] * KNOT_SCALE, mid[1] * KNOT_SCALE),
      };
    });
  }, []);

  useEffect(() => {
    ctx.frame.knotSpinRef = spin.current;
    return () => {
      if (ctx.frame.knotSpinRef === spin.current) ctx.frame.knotSpinRef = null;
      for (const p of parts) { p.geo.dispose(); p.glass.dispose(); p.core.dispose(); }
    };
  }, [ctx, parts]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw || 0.016);
    const st = ctx.stateRef.current;
    const paused = st.inspectedId === "knot" || Boolean(st.partFocus && st.partFocus.partId);
    if (spin.current && !paused && st.ambientOn !== false) spin.current.rotation.y += dt * 0.25;
    // The knot's own glow tier is the parts' base light; a hovered
    // part lifts past it, a focused part lifts further — and its
    // glass clears as it brightens, so the core reads through.
    const base = glowLevel({
      entered: st.cardId === "knot",
      current: st.currentId === "knot",
      pending: st.pendingId === "knot",
      hovered: st.hoverId === "knot",
    });
    const hov = st.currentId === "knot" ? st.partHoverId : null;
    const foc = st.partFocus && st.partFocus.objectId === "knot" ? st.partFocus.partId : null;
    for (const p of parts) {
      const boost = p.part.id === foc ? 0.55 : p.part.id === hov ? 0.4 : 0;
      p.glass.emissiveIntensity = damp(p.glass.emissiveIntensity, base * 0.7 + boost, 10, dt);
      const targetOpacity = p.part.id === hov || p.part.id === foc ? 0.72 : 0.45;
      p.glass.opacity = damp(p.glass.opacity, targetOpacity, 10, dt);
      p.core.emissiveIntensity = damp(p.core.emissiveIntensity, 0.5 + base * 0.5 + boost, 10, dt);
    }
  });

  const st = () => ctx.stateRef.current;
  return (
    <group>
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[11.5, 13, 4, 28]} />
        <primitive object={matFor(0x27313a, { rough: 0.85 })} attach="material" />
      </mesh>
      <group ref={spin} position={[0, KNOT_CY, 0]}>
        {parts.map((p) => (
          <group
            key={p.part.id}
            onPointerOver={() => { if (st().onPartHover) st().onPartHover(p.part.id); }}
            onPointerOut={() => { if (st().onPartHover) st().onPartHover(null); }}
          >
            <mesh geometry={p.geo} material={p.glass} />
            <mesh position={p.midV} material={p.core}>
              <sphereGeometry args={[p.radius * 1.02, 14, 14]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Atmosphere knots (SCENERY): the gallery's other two forms as
 * single-tube sculptures on low pedestals at the rim — a (4,3)
 * torus knot in teal at the south-east rim, a cinquefoil in amber
 * at the north-west. Dim emissive, thin tubes, turning slowly at
 * slightly different rates. They hold no data and take no address:
 * no pointer handlers, and they render inside the scenery stratum,
 * so the SCENERY layer hides them with the platter.
 */
const ATMOS_KNOTS = [
  { form: "torus43", pos: [133.5, -97], tilt: 0.55, rate: 0.12, color: 0x9fd8cf, emissive: 0x2e7d74, ei: 0.5 },
  { form: "cinquefoil", pos: [-133.5, 97], tilt: 0.85, rate: -0.09, color: 0xd8b25c, emissive: 0xffa726, ei: 0.35 },
];

function AtmosphereKnots({ ctx }) {
  const spins = useRef([]);
  const geos = useMemo(() => ATMOS_KNOTS.map((k) => {
    const f = KNOT_FORMS[k.form];
    return new THREE.TubeGeometry(new KnotCurve(f.p, f.q, 3.4), 220, 0.8, 10, true);
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

const MINIATURES = {
  mesa: MiniMesa, drum: MiniDrum, tray: MiniTray, cube: MiniCube,
  tangle: MiniTangle, horizon3d: MiniSkyline, horizonflat: MiniHorizonPanel,
  arch: MiniArch, definition: MiniDefinition, knot: MiniKnot, crystal: MiniCrystal,
};

/* ---------- one citizen of the space ---------- */

function SpaceObject({ def, ctx, lib }) {
  const outer = useRef(null);
  const inner = useRef(null);
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
    frame.ringRefs.set(def.id, ring.current);
    frame.matsMap.set(def.id, mats.list);
    if (inner.current) inner.current.rotation.order = "YXZ";
    const st = ctx.stateRef.current;
    const p = st.space.positions[def.id] || { x: 0, z: 0 };
    if (!frame.disp.has(def.id)) {
      frame.disp.set(def.id, {
        x: p.x, z: p.z, lift: 0,
        yaw: 0, pitch: 0, roll: 0,
        scale: st.space.transforms[def.id]?.scale ?? 1, glow: 0,
      });
    }
    return () => {
      frame.outerRefs.delete(def.id);
      frame.innerRefs.delete(def.id);
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
      <group ref={inner}>
        <Mini lib={lib} matFor={mats.matFor} ctx={ctx} />
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

/* ---------- the driver ---------- */

/**
 * The inspection position: platter centre, raised to reading
 * height, in world-group local coordinates — with the yaw that
 * turns the thing's front to the camera, plus whatever turn the
 * transform keys have added on top (st.inspectRot). Scale is the
 * documented inspection scale for the kind of thing.
 */
const _inspectV = new THREE.Vector3();
function inspectTargetFor(st, frame, camera, kind) {
  const wg = frame.worldGroup;
  _inspectV.set(0, 36, 0);
  const lp = wg ? wg.worldToLocal(_inspectV.clone()) : _inspectV;
  const worldYaw = Math.atan2(camera.position.x, camera.position.z) / DEG;
  const localYaw = worldYaw - (wg ? wg.rotation.y / DEG : 0);
  const rot = st.inspectRot || { yaw: 0, pitch: 0, roll: 0, scale: 1 };
  return {
    x: lp.x, y: lp.y, z: lp.z,
    yaw: localYaw + rot.yaw, pitch: rot.pitch, roll: rot.roll,
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
    cameras.persp.aspect = aspect;
    cameras.persp.updateProjectionMatrix();
    cameras.ortho.left = -cameras.orthoHalf * aspect;
    cameras.ortho.right = cameras.orthoHalf * aspect;
    cameras.ortho.top = cameras.orthoHalf;
    cameras.ortho.bottom = -cameras.orthoHalf;
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
    const modeActive = Boolean(shared.drag || st.pendingId || st.cardId || st.inspectedId || (st.partFocus && st.partFocus.partId));
    if (wg) {
      frame.turntabling = Boolean(st.turntableOn && idle && !modeActive);
      if (frame.turntabling) wg.rotation.y += dt * 2 * DEG;
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
      if (st.inspectedId === def.id) {
        // INSPECT: the thing itself travels to the inspection
        // position and faces the viewer; its home targets resume
        // the moment inspection ends, so it eases exactly back.
        const t = inspectTargetFor(st, frame, camera, "object");
        tX = t.x; tZ = t.z; tLift = t.y;
        tYaw = t.yaw; tPitch = t.pitch; tRoll = t.roll; tScale = t.scale;
      }
      d.x = damp(d.x, tX, 5.5, dt);
      d.z = damp(d.z, tZ, 5.5, dt);
      d.lift = damp(d.lift, tLift, 6, dt);
      d.yaw = damp(d.yaw, tYaw, 10, dt);
      d.pitch = damp(d.pitch, tPitch, 10, dt);
      d.roll = damp(d.roll, tRoll, 10, dt);
      d.scale = damp(d.scale, tScale, 8, dt);
      outer.position.set(d.x, d.lift, d.z);
      inner.rotation.set(d.pitch * DEG, d.yaw * DEG, d.roll * DEG);
      inner.scale.setScalar(Math.max(0.05, d.scale));

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
    const partW = st.partFocus && st.partFocus.partId
      ? frame.partWorld.get(st.partFocus.partId) : null;
    const cardBase = st.cardId ? frame.baseWorld.get(st.cardId) : null;
    if (st.partFocus && st.partFocus.partId && partW) {
      const centre = frame.partWorld.get("__centre") || partW;
      const dir = partW.clone().sub(centre);
      if (dir.lengthSq() < 1) dir.set(0, 0, 1);
      dir.normalize();
      seat = partW.clone().addScaledVector(dir, 52).add(new THREE.Vector3(0, 12, 0));
      look = partW.clone();
      if (camera === cameras.ortho) { camera.zoom = 1.5 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else if (st.cardId && cardBase) {
      const d = frame.disp.get(st.cardId);
      const sc = d ? d.scale : 1;
      const radial = new THREE.Vector3(cardBase.x, 0, cardBase.z);
      if (radial.lengthSq() < 1) radial.set(0, 0, 1);
      radial.normalize();
      seat = cardBase.clone()
        .addScaledVector(radial, 42 + 30 * sc)
        .add(new THREE.Vector3(0, 25 + 9 * sc, 0));
      look = cardBase.clone().add(new THREE.Vector3(0, ANCHOR_H[st.cardId] * 0.55 * sc, 0));
      if (camera === cameras.ortho) { camera.zoom = 1.35 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else if (st.viewName && st.viewName !== "home" && viewSeat(st.viewName, st.zoomMul)) {
      // A named plane view: a pure camera move to the table's seat.
      const vs = viewSeat(st.viewName, st.zoomMul);
      seat = new THREE.Vector3(...vs.seat);
      look = new THREE.Vector3(...vs.look);
      if (camera === cameras.ortho) { camera.zoom = 1 / st.zoomMul; camera.updateProjectionMatrix(); }
    } else {
      const rot = (st.rotation ?? 0) * DEG;
      const tilt = (st.elevation ?? 0) * DEG;
      if (camera === cameras.persp) {
        const radius = 520 * st.zoomMul;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(190, 486) + tilt));
        seat = new THREE.Vector3(
          Math.sin(rot) * Math.cos(elev) * radius,
          Math.sin(elev) * radius,
          Math.cos(rot) * Math.cos(elev) * radius,
        );
      } else {
        const radius = 1000;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(574, 790) + tilt));
        const az = Math.PI / 4 + rot;
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
  });

  return null;
}

/* ---------- the view ---------- */

export default function SpaceView(props) {
  const {
    space, currentId, hoverId, cardId, pendingId,
    projection, rotation, elevation, zoomMul,
    turntableOn, pulsesOn, ambientOn, labelsOn, sharedRef,
    libraryOpen, clipHeld, clipSummoned, inspectedId, inspectRot, pastes, inspectPanel,
    partFocus, partHoverId,
    viewName, snapOn, strata, layers,
    onHover, onPartHover, onObjectClick, onSelect, onTouch,
  } = props;

  const stateRef = useRef({});
  stateRef.current = {
    space, currentId, hoverId, cardId, pendingId,
    projection, rotation, elevation, zoomMul,
    turntableOn, pulsesOn, ambientOn, labelsOn,
    libraryOpen, clipSummoned, inspectedId, inspectRot,
    partFocus, partHoverId,
    viewName, snapOn, strata, layers,
    shared: sharedRef.current,
    onHover, onPartHover, onObjectClick, onSelect, onTouch,
  };

  const frameRef = useRef(null);
  if (!frameRef.current) {
    frameRef.current = {
      disp: new Map(), outerRefs: new Map(), innerRefs: new Map(),
      ringRefs: new Map(), matsMap: new Map(),
      anchorWorld: new Map(), baseWorld: new Map(), partWorld: new Map(),
      camera: null, worldGroup: null, turntabling: false, knotSpinRef: null,
      crystalCores: [], crystalFaces: null,
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
  const faceChipRefs = useRef([]);
  const cardFacesRef = useRef(null);
  const cardRef = useRef(null);
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
      const chipList = [
        ...labeledObjects().map(({ object, label }) => ({ id: object.id, label })),
        ...(st.libraryOpen
          ? labeledMedia().map(({ item, label }) => ({ id: item.id, label }))
          : []),
      ];
      for (const { id, label } of chipList) {
        const chip = chipRefs.current.get(id);
        if (!chip) continue;
        const anchor = frame.anchorWorld.get(id);
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
        const anchor = named ? frame.anchorWorld.get(named) : null;
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

        <group ref={worldRef}>
          {/* Layers: a hidden stratum is NOT RENDERED — scenery
              included, no ghost exception. */}
          {strata?.scenery ? (
            <>
              <mesh position={[0, -3.6, 0]} rotation-x={-Math.PI / 2}>
                <circleGeometry args={[900, 64]} />
                <meshStandardMaterial color={0x0d1113} roughness={1} />
              </mesh>
              <mesh position={[0, -1.55, 0]}>
                <cylinderGeometry args={[PLATTER_R, PLATTER_R + 7, 3, 96]} />
                <meshStandardMaterial color={0x12181c} roughness={0.85} />
              </mesh>
              <primitive object={geo.rim} position={[0, 0.05, 0]} />
              <AtmosphereKnots ctx={ctx} />
              <CrystalCluster ctx={ctx} />
            </>
          ) : null}
          {strata?.data ? (
            <>
              {OBJECTS.map((def) => (
                <SpaceObject key={def.id} def={def} ctx={ctx} lib={lib} />
              ))}
              {space.cables.map(([a, b], i) => (
                <Cable key={`${a}|${b}`} a={a} b={b} offset={(i * 0.37) % 1} ctx={ctx} />
              ))}
              <PendingCable ctx={ctx} />
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
        <div ref={partRef} className="us-chip" style={{ display: "none", pointerEvents: "none" }} />
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
                yaw {Math.round(cardTr.yaw)}° · pitch {Math.round(cardTr.pitch)}° · roll {Math.round(cardTr.roll)}° · scale {cardTr.scale.toFixed(2)}×
                <br />D — fly back to the world seat
              </span>
              {cardObj.id === "crystal" ? (
                <span ref={cardFacesRef} style={{ display: "block", whiteSpace: "pre-line", marginTop: 4 }} />
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
