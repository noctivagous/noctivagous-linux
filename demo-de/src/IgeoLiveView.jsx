import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PanelizationSimulation } from "../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphitePanelization.ts";
import {
  NCTGraphiteNurbsSurface,
  createDemoSheetSurface,
  createFlatSheetSurface,
} from "../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphiteNurbsSurface.ts";
import {
  vec3,
  vAdd,
  vSub,
  vScale,
  vDot,
  vCross,
  vUnit,
  vLen,
  vDist,
} from "../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphiteVec3.ts";

/**
 * IGEO LIVE PANEL — the full-viewport three.js view.
 *
 * Owns the PanelizationSimulation (the iGeo tutorial 59 port in the
 * vendored NCTGraphite) and everything three.js. The App owns the
 * parameters and the keyboard; the two talk through refs:
 *
 * - liveRef:      knobs applied between steps (reach, decay, speed,
 *                 cohesion, separation, response depth, toggles,
 *                 camera zoom, the keyboard cursor's uv).
 * - structural:   surface / density / swarm count — a change rebuilds
 *                 the simulation inside the loop (Grasshopper's
 *                 re-solve), preserving the attractor model.
 * - apiRef:       filled in here with the click operations the keys
 *                 drive: clickAtUV (F), stepBack (D), getAddressedUV.
 *
 * The attractor model ({u, v, user} list) lives here because the
 * simulation's own attractor array is rebuilt from it on every
 * structural rebuild, so F-placed attractors survive surface and
 * density switches.
 */

/* ---------------- surfaces the library can really make ---------------- */

function createWaveSurface() {
  // A wave sheet over the same 200 x 60 extent as the tutorial
  // sheet, built as a control net through the library's own NURBS
  // surface class. The net samples y = 8 sin(2πu) cos(πv); the
  // cubic surface smooths it.
  const ys = [
    [0, 8, 0, -8, 0],
    [0, 4, 0, -4, 0],
    [0, -4, 0, 4, 0],
    [0, -8, 0, 8, 0],
  ];
  const net = ys.map((row, j) =>
    row.map((y, i) => vec3((200 * i) / 4, y, (60 * j) / 3)),
  );
  return new NCTGraphiteNurbsSurface({
    controlPoints: net,
    degreeU: 3,
    degreeV: 3,
  });
}

export const SURFACES = [
  { id: "arch", name: "ARCH", make: () => createDemoSheetSurface(1) },
  { id: "flat", name: "FLAT SHEET", make: () => createFlatSheetSurface() },
  { id: "vault", name: "VAULT", make: () => createDemoSheetSurface(2.4) },
  { id: "wave", name: "WAVE", make: createWaveSurface },
];

export const DENSITIES = {
  coarse: { udiv: 42, vdiv: 12, label: "Coarse · 42×12" },
  standard: { udiv: 70, vdiv: 20, label: "Standard · 70×20" },
  dense: { udiv: 98, vdiv: 28, label: "Dense · 98×28" },
};

export const FORMS = [
  { id: "funnel", key: "3", name: "FUNNEL" },
  { id: "flat", key: "4", name: "FLAT TILE" },
  { id: "petal", key: "5", name: "PETAL FOLD" },
  { id: "spike", key: "6", name: "SPIKE" },
  { id: "aperture", key: "7", name: "APERTURE" },
];

/* ---------------- panel form builders ----------------
 * Every form is built over the SAME simulation data: the panel's
 * six node positions, its accumulated push `dir` (via shiftRatio,
 * which folds in the response-depth dirScale), and the tutorial's
 * color (push direction encoded as rgb). Brightness is lifted by
 * field energy — brightness ∝ how hard the panel has been pushed —
 * as a render mapping, identically for every form.
 */

function pushVert(out, p, c, bright) {
  out.positions.push(p.x, p.y, p.z);
  out.colors.push(
    Math.min(1, c.r * bright),
    Math.min(1, c.g * bright),
    Math.min(1, c.b * bright),
  );
}

function prep(panel) {
  const center = panel.center();
  const ring = [0, 1, 2, 3, 4, 5].map((i) => panel.nodes[i].pos);
  const n = panel.nml();
  const ratio = panel.shiftRatio();
  const { color } = panel.geometry();
  return { center, ring, n, ratio, color, bright: 0.8 + 0.55 * ratio };
}

function fan(out, base) {
  for (let k = 0; k < 6; k++) {
    const k2 = (k + 1) % 6;
    out.indices.push(base, base + 1 + k, base + 1 + k2);
  }
}

/** FLAT: planar hex tile; the answer is color + a slight lift. */
function buildFlat(panel, out) {
  const { center, ring, n, ratio, color, bright } = prep(panel);
  const off = vScale(n, 0.2 + ratio * 1.1);
  const base = out.positions.length / 3;
  pushVert(out, vAdd(center, off), color, bright);
  for (const p of ring) pushVert(out, vAdd(p, off), color, bright);
  fan(out, base);
}

function rotAround(p, c, axis, ang) {
  const v = vSub(p, c);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const r = vAdd(
    vAdd(vScale(v, cos), vScale(vCross(axis, v), sin)),
    vScale(axis, vDot(axis, v) * (1 - cos)),
  );
  return vAdd(c, r);
}

/**
 * PETAL FOLD: the half of the panel downstream of the push folds up
 * around a hinge through the centre, perpendicular to the push.
 * Fold angle is the push strength (shiftRatio) at up to ~60°.
 */
function buildPetal(panel, out) {
  const { center, ring, n, ratio, color, bright } = prep(panel);
  const dirT = vSub(panel.dir, vScale(n, vDot(panel.dir, n)));
  const t = vLen(dirT) > 1e-5 ? vUnit(dirT) : vUnit(panel.uvec());
  const hinge = vUnit(vCross(n, t));
  const ang = -ratio * 1.05; // sign lifts the free edge toward +n
  const fold = (p) =>
    vDot(vSub(p, center), t) > 0 ? rotAround(p, center, hinge, ang) : p;
  const base = out.positions.length / 3;
  pushVert(out, center, color, bright);
  for (const p of ring) pushVert(out, fold(p), color, bright);
  fan(out, base);
}

/** SPIKE: the centre rises into a low pyramid by accumulated energy. */
function buildSpike(panel, out) {
  const { center, ring, n, ratio, color, bright } = prep(panel);
  const apex = vAdd(center, vScale(n, 0.3 + ratio * 4.2));
  const base = out.positions.length / 3;
  pushVert(out, apex, color, bright + 0.25);
  for (const p of ring) pushVert(out, p, color, bright);
  fan(out, base);
}

/**
 * APERTURE: an iris. The band runs from the node ring to an inner
 * ring whose radius opens with traffic — quiet panels sit nearly
 * closed, pushed panels open wide. The inner ring is dropped a
 * little along -n so the opening reads as a throat.
 */
function buildAperture(panel, out) {
  const { center, ring, n, ratio, color, bright } = prep(panel);
  const s = 0.14 + 0.6 * ratio;
  const drop = vScale(n, -(0.3 + 0.5 * ratio));
  const base = out.positions.length / 3;
  for (const p of ring) pushVert(out, p, color, bright);
  for (const p of ring) {
    pushVert(
      out,
      vAdd(vAdd(center, vScale(vSub(p, center), s)), drop),
      color,
      bright,
    );
  }
  for (let k = 0; k < 6; k++) {
    const k2 = (k + 1) % 6;
    out.indices.push(base + k, base + 6 + k, base + 6 + k2);
    out.indices.push(base + k, base + 6 + k2, base + k2);
  }
}

const FORM_BUILDERS = {
  flat: buildFlat,
  petal: buildPetal,
  spike: buildSpike,
  aperture: buildAperture,
};

function buildForm(sim, formId) {
  if (formId === "funnel") {
    // The tutorial's native loft, straight from the simulation —
    // with the same brightness-by-energy render mapping the other
    // forms get (18 verts per panel, emitted in panel order).
    const m = sim.mesh();
    for (let i = 0; i < sim.panels.length; i++) {
      const bright = 0.8 + 0.55 * sim.panels[i].shiftRatio();
      for (let vtx = 0; vtx < 18; vtx++) {
        const o = (i * 18 + vtx) * 3;
        m.colors[o] = Math.min(1, m.colors[o] * bright);
        m.colors[o + 1] = Math.min(1, m.colors[o + 1] * bright);
        m.colors[o + 2] = Math.min(1, m.colors[o + 2] * bright);
      }
    }
    return m;
  }
  const out = { positions: [], indices: [], colors: [] };
  const build = FORM_BUILDERS[formId] || buildFlat;
  for (const panel of sim.panels) build(panel, out);
  return out;
}

/* ---------------- surface sheet geometry ---------------- */

function surfaceGeometry(surface, su = 64, sv = 18) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let j = 0; j <= sv; j++) {
    for (let i = 0; i <= su; i++) {
      const u = i / su;
      const v = j / sv;
      const p = surface.pointAt(u, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < sv; j++) {
    for (let i = 0; i < su; i++) {
      const a = j * (su + 1) + i;
      const b = a + 1;
      const c = a + su + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/* ---------------- the view ---------------- */

const DEFAULT_ATTRACTORS = [
  { u: 0.25, v: 0.5, user: false },
  { u: 0.55, v: 0.3, user: false },
  { u: 0.8, v: 0.65, user: false },
];
const REMOVE_RADIUS = 9; // world units: F within this of an attractor removes it

export default function IgeoLiveView({
  liveRef,
  structural,
  apiRef,
  onStats,
}) {
  const mountRef = useRef(null);
  const structuralRef = useRef(structural);
  structuralRef.current = structural;
  const statsRef = useRef(onStats);
  statsRef.current = onStats;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const attractorModel = DEFAULT_ATTRACTORS.map((a) => ({ ...a }));
    let sim = null;
    let builtKey = "";

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04080a);
    scene.fog = new THREE.Fog(0x04080a, 400, 820);

    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      1,
      2000,
    );
    const camTarget = new THREE.Vector3(100, 2, 30);

    scene.add(new THREE.HemisphereLight(0xcfe8de, 0x0a0f12, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(60, 240, 140);
    scene.add(sun);

    // Panel skin.
    let panelGeo = null;
    const panelMesh = new THREE.Mesh(
      undefined,
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(panelMesh);
    let wire = null;

    // Base sheet (display) + an invisible twin for raycasting.
    let sheetGeo = null;
    const sheetMesh = new THREE.Mesh(
      undefined,
      new THREE.MeshLambertMaterial({
        color: 0x14262d,
        side: THREE.DoubleSide,
      }),
    );
    scene.add(sheetMesh);
    const proxyMesh = new THREE.Mesh(
      undefined,
      new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        transparent: true,
      }),
    );
    scene.add(proxyMesh);

    // Boids.
    let boidGeo = null;
    const boidPts = new THREE.Points(
      undefined,
      new THREE.PointsMaterial({
        color: 0xffa726,
        size: 2.6,
        sizeAttenuation: true,
      }),
    );
    scene.add(boidPts);

    // Attractor markers.
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    const markerMeshes = [];

    // Address markers: keyboard cursor ring + pointer hover ring.
    const cursorRing = new THREE.Mesh(
      new THREE.RingGeometry(3.3, 4.0, 40),
      new THREE.MeshBasicMaterial({
        color: 0x35e0c8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    scene.add(cursorRing);
    const hoverRing = new THREE.Mesh(
      new THREE.RingGeometry(1.7, 2.25, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    hoverRing.visible = false;
    scene.add(hoverRing);

    const placeOnSurface = (obj, u, v, lift) => {
      const f = sim.surface.frameAt(u, v);
      obj.position.set(
        f.point.x + f.normal.x * lift,
        f.point.y + f.normal.y * lift,
        f.point.z + f.normal.z * lift,
      );
      const m = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(f.tangentU.x, f.tangentU.y, f.tangentU.z).normalize(),
        new THREE.Vector3(f.tangentV.x, f.tangentV.y, f.tangentV.z).normalize(),
        new THREE.Vector3(f.normal.x, f.normal.y, f.normal.z).normalize(),
      );
      obj.quaternion.setFromRotationMatrix(m);
    };

    /* ----- simulation construction / rebuild ----- */

    const makeAttractor = (surface, a) => ({
      pos: surface.pointAt(a.u, a.v),
      strength: 1,
      gaussRadius: 100,
      gain: 0.6,
    });

    const syncAttractors = () => {
      sim.attractors.length = 0;
      for (const a of attractorModel) {
        sim.attractors.push(makeAttractor(sim.surface, a));
      }
    };

    let currentSurface = null;
    const rebuildSim = () => {
      const s = structuralRef.current;
      const surf = SURFACES.find((x) => x.id === s.surfaceId) || SURFACES[0];
      currentSurface = surf.make();
      const dens = DENSITIES[s.density] || DENSITIES.standard;
      sim = new PanelizationSimulation({
        surface: currentSurface,
        udiv: dens.udiv,
        vdiv: dens.vdiv,
        swarmCount: s.swarmCount,
        panelReachDist: liveRef.current.reach,
        dirDecay: liveRef.current.decay,
        seed: 7,
        attractors: attractorModel.map((a) => makeAttractor(currentSurface, a)),
      });
      for (let i = 0; i < 40; i++) sim.step(); // pre-roll so the field is alive on arrival
      // sheet + proxy
      if (sheetGeo) sheetGeo.dispose();
      sheetGeo = surfaceGeometry(currentSurface);
      sheetMesh.geometry = sheetGeo;
      proxyMesh.geometry = sheetGeo;
      // boid points buffer
      if (boidGeo) boidGeo.dispose();
      boidGeo = new THREE.BufferGeometry();
      boidGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(sim.boids.length * 3), 3),
      );
      boidPts.geometry = boidGeo;
      panelGeo = null; // force panel geometry reinstall
      syncMarkers(true);
    };

    const syncMarkers = (force = false) => {
      if (!force && markerMeshes.length === attractorModel.length) return;
      for (const m of markerMeshes) {
        markerGroup.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
      markerMeshes.length = 0;
      attractorModel.forEach((a) => {
        const mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(2.1),
          a.user
            ? new THREE.MeshBasicMaterial({ color: 0x35e0c8 })
            : new THREE.MeshBasicMaterial({ color: 0xffa726, wireframe: true }),
        );
        markerGroup.add(mesh);
        markerMeshes.push(mesh);
      });
    };

    /* ----- readout stats (time-based cadence, plus an immediate
       push after any click operation so F/D feedback is instant
       even on a slow machine) ----- */

    const pushStats = () => {
      if (!statsRef.current || !sim) return;
      let meanSpeed = 0;
      for (const b of sim.boids) meanSpeed += vLen(b.vel);
      meanSpeed = sim.boids.length ? meanSpeed / sim.boids.length : 0;
      let energy = 0;
      for (const p of sim.panels) energy += vLen(p.dir);
      energy = sim.panels.length ? energy / sim.panels.length : 0;
      const cur = liveRef.current.cursor;
      const addr =
        addressMode === "pointer" && hoverRef.current
          ? { ...hoverRef.current, source: "POINTER" }
          : { u: cur.u, v: cur.v, source: "CURSOR" };
      statsRef.current({
        step: sim.stepCount,
        panels: sim.panels.length,
        boids: sim.boids.length,
        attractors: attractorModel.length,
        placed: attractorModel.filter((a) => a.user).length,
        meanSpeed,
        energy,
        addressed: addr,
      });
    };

    /* ----- the click operations (the App's keys call these) ----- */

    const hoverRef = { current: null }; // {u,v} while the pointer is over the sheet
    let addressMode = "cursor"; // "pointer" after a move over the sheet, "cursor" after an arrow key

    apiRef.current = {
      getAddressedUV() {
        if (addressMode === "pointer" && hoverRef.current) {
          return { ...hoverRef.current, source: "POINTER" };
        }
        const c = liveRef.current.cursor;
        return { u: c.u, v: c.v, source: "CURSOR" };
      },
      useCursor() {
        addressMode = "cursor";
      },
      /** F: place an attractor at (u,v), or remove the one already there. */
      clickAtUV(u, v) {
        if (!sim) return null;
        const p = sim.surface.pointAt(u, v);
        let hit = -1;
        let best = REMOVE_RADIUS;
        attractorModel.forEach((a, i) => {
          const d = vDist(sim.surface.pointAt(a.u, a.v), p);
          if (d < best) {
            best = d;
            hit = i;
          }
        });
        if (hit >= 0) {
          attractorModel.splice(hit, 1);
          syncAttractors();
          syncMarkers(true);
          pushStats();
          return "removed";
        }
        attractorModel.push({ u, v, user: true });
        syncAttractors();
        syncMarkers(true);
        pushStats();
        return "added";
      },
      /** D: remove the most recently placed attractor; else reset the field. */
      stepBack() {
        if (!sim) return null;
        for (let i = attractorModel.length - 1; i >= 0; i--) {
          if (attractorModel[i].user) {
            attractorModel.splice(i, 1);
            syncAttractors();
            syncMarkers(true);
            pushStats();
            return "removed";
          }
        }
        for (const p of sim.panels) p.dir = vec3();
        pushStats();
        return "relaxed";
      },
    };

    /* ----- pointer addressing ----- */

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(proxyMesh);
      if (hits.length && hits[0].uv) {
        hoverRef.current = { u: hits[0].uv.x, v: hits[0].uv.y };
        addressMode = "pointer";
      } else {
        hoverRef.current = null;
      }
    };
    const onPointerLeave = () => {
      hoverRef.current = null;
    };
    const onPointerDown = (e) => {
      // Secondary path: a mouse click does what F does, at the
      // hovered point. F remains the click of the system.
      if (hoverRef.current && apiRef.current) {
        const r = apiRef.current.clickAtUV(hoverRef.current.u, hoverRef.current.v);
        if (r && liveRef.current.onCanvasClick) liveRef.current.onCanvasClick(r);
      }
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    /* ----- resize ----- */

    const onResize = () => {
      const w = mount.clientWidth;
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    /* ----- panel geometry install / update ----- */

    const installPanels = (data) => {
      if (panelGeo) panelGeo.dispose();
      panelGeo = new THREE.BufferGeometry();
      panelGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.positions, 3),
      );
      panelGeo.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(data.colors, 3),
      );
      panelGeo.setIndex(data.indices);
      panelGeo.computeVertexNormals();
      panelMesh.geometry = panelGeo;
    };

    const updatePanels = () => {
      const data = buildForm(sim, liveRef.current.form);
      if (
        !panelGeo ||
        data.positions.length !== panelGeo.attributes.position.array.length
      ) {
        installPanels(data);
      } else {
        panelGeo.attributes.position.array.set(data.positions);
        panelGeo.attributes.position.needsUpdate = true;
        panelGeo.attributes.color.array.set(data.colors);
        panelGeo.attributes.color.needsUpdate = true;
        panelGeo.computeVertexNormals();
      }
      if (wire) {
        wire.geometry.dispose();
        wire.geometry = new THREE.WireframeGeometry(panelGeo);
      }
    };

    /* ----- main loop ----- */

    let raf = 0;
    let frame = 0;
    let disposed = false;
    let stepAcc = 0;
    let lastForm = null;
    let lastStatsAt = 0;

    const structuralKey = () => {
      const s = structuralRef.current;
      return [s.surfaceId, s.density, s.swarmCount].join("|");
    };

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      frame++;
      const live = liveRef.current;

      if (structuralKey() !== builtKey) {
        builtKey = structuralKey();
        rebuildSim();
        lastForm = null;
      }

      // Live knobs, applied between steps as the sim class allows.
      sim.panelReachDist = live.reach;
      sim.dirDecay = live.decay;
      for (const b of sim.boids) {
        b.cohesionRatio = live.cohesion;
        b.separationRatio = live.separation;
      }
      const dirScale = 0.1 * live.depth;
      for (const p of sim.panels) {
        if (p.dirScale !== dirScale) p.dirScale = dirScale;
      }

      let stepped = false;
      if (live.running) {
        stepAcc += 2 * live.speed;
        let n = Math.floor(stepAcc);
        stepAcc -= n;
        if (n > 6) {
          n = 6;
          stepAcc = 0;
        }
        for (let i = 0; i < n; i++) sim.step();
        stepped = n > 0;
      } else {
        stepAcc = 0;
      }

      if (stepped || live.form !== lastForm) {
        updatePanels();
        lastForm = live.form;
      }

      // Wireframe toggle.
      if (live.wireframe && !wire) {
        wire = new THREE.LineSegments(
          new THREE.WireframeGeometry(panelGeo),
          new THREE.LineBasicMaterial({
            color: 0x0e2a30,
            transparent: true,
            opacity: 0.5,
          }),
        );
        scene.add(wire);
      } else if (!live.wireframe && wire) {
        scene.remove(wire);
        wire.geometry.dispose();
        wire = null;
      }

      sheetMesh.visible = live.showBase;
      boidPts.visible = live.showBoids;
      markerGroup.visible = live.showAttractors;

      // Boid positions.
      if (boidGeo) {
        const bp = boidGeo.attributes.position.array;
        sim.boids.forEach((b, i) => {
          bp[i * 3] = b.pos.x;
          bp[i * 3 + 1] = b.pos.y;
          bp[i * 3 + 2] = b.pos.z;
        });
        boidGeo.attributes.position.needsUpdate = true;
      }

      // Markers ride the surface, gently pulsing.
      attractorModel.forEach((a, i) => {
        const mesh = markerMeshes[i];
        if (!mesh) return;
        placeOnSurface(mesh, a.u, a.v, 1.6);
        const s = 1 + 0.16 * Math.sin(frame * 0.07 + i * 1.7);
        mesh.scale.setScalar(s);
      });

      // Address markers.
      const cur = live.cursor;
      placeOnSurface(cursorRing, cur.u, cur.v, 0.7);
      if (hoverRef.current) {
        hoverRing.visible = true;
        placeOnSurface(hoverRing, hoverRef.current.u, hoverRef.current.v, 0.7);
      } else {
        hoverRing.visible = false;
      }

      // Parameter camera: fixed seat, zoom + a slow drift.
      const t = frame / 60;
      const az = live.drift ? 0.1 * Math.sin(t * 0.11) : 0;
      const el = 0.66 + (live.drift ? 0.05 * Math.sin(t * 0.07 + 1.3) : 0);
      const dist = 208 * live.zoom;
      camera.position.set(
        camTarget.x + dist * Math.cos(el) * Math.sin(az),
        camTarget.y + dist * Math.sin(el),
        camTarget.z + dist * Math.cos(el) * Math.cos(az),
      );
      camera.lookAt(camTarget);

      if (performance.now() - lastStatsAt > 200) {
        lastStatsAt = performance.now();
        pushStats();
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      if (apiRef.current) apiRef.current = null;
      renderer.dispose();
      if (panelGeo) panelGeo.dispose();
      if (sheetGeo) sheetGeo.dispose();
      if (boidGeo) boidGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
    // One scene for the component's lifetime; parameter and
    // structural changes arrive through the refs (house pattern).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="il-stage" />;
}
