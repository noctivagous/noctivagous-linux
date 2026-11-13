import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  horizonReliefGeometry,
  SCHEME_BLUES,
  SCHEME_GREENS,
} from "../NCTGraphite/packages/nctgraphite/src/horizon/NCTGraphiteHorizon.ts";

/**
 * The activity monitor in 3D — Horizon3DView.
 *
 * Eight lanes run away from the viewer into the dark, time flowing
 * toward you: the newest sample stands at the front of each lane
 * and history recedes. Every lane is the horizon module's terraced
 * relief — each time column a stack of band segments, wearing the
 * horizon chart's own band colours, so load reads as both height
 * and depth of colour. The columns themselves travel: between
 * ticks each mesh slides one column-depth toward the back, and the
 * tick's rebuilt geometry lands exactly where the slide left it,
 * so a peak is a physical thing moving down the tape, not a
 * texture repaint. Time is marked either on a ground-plan scale
 * that travels with the tape, or by rods rising from the waves at
 * fixed ages. The lanes sit on a circular platter lettered with
 * the four directions, and every camera orbit turns about the
 * platter's centre. The default camera is isometric — an
 * orthographic camera for undistorted comparison across the whole
 * depth of the tape — with perspective one parameter away, and
 * continuous rotation and elevation parameters on both. A
 * bounding-box wireframe of the data volume is a parameter too.
 */

export const LANE_W = 26;
export const LANE_PITCH = 35;
/** Visible columns: the newest 121 samples, one column per sample. */
export const COLS = 121;
export const COL_D = 2.2;
/** Ages (in samples) at which time markers stand. */
export const TIME_AGES = [20, 40, 60, 80, 100, 120];
/** The centre of the tape — and of the platter, and of every camera orbit. */
export const CENTER_Z = -((COLS - 1) * COL_D) / 2;
/** Radius of the circular platter the lanes sit on. */
export const PLATTER_R = 205;

export function laneX(i, count) {
  return (i - (count - 1) / 2) * LANE_PITCH;
}

export default function Horizon3DView({
  monitor,
  bands,
  bandHeight,
  tickCount,
  periodMs,
  running,
  focusId,
  projection,
  rotation,
  elevation,
  timeMarkers,
  boundsOn,
  drift,
  labelsOn,
  onFocus,
}) {
  const mountRef = useRef(null);
  const labelsRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = {
    monitor, bands, bandHeight, periodMs, running, focusId,
    rotation, elevation, timeMarkers, boundsOn, labelsOn, onFocus,
  };
  const tickRef = useRef(tickCount);
  tickRef.current = tickCount;

  useEffect(() => {
    const mount = mountRef.current;
    const labelsEl = labelsRef.current;
    if (!mount) return undefined;
    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 560;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x0b0e10, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0e10, 620, 1250);

    const persp = new THREE.PerspectiveCamera(40, width / height, 1, 3000);
    const orthoHalf = 205;
    const ortho = new THREE.OrthographicCamera(
      -orthoHalf * (width / height), orthoHalf * (width / height),
      orthoHalf, -orthoHalf, -500, 3000,
    );
    let camera = projection === "iso" ? ortho : persp;

    scene.add(new THREE.HemisphereLight(0xdfeeea, 0x1a2226, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(180, 320, 220);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7fd4c1, 0.45);
    rim.position.set(-240, 90, -260);
    scene.add(rim);

    // Ground far below, and the circular platter the lanes sit on:
    // a shallow disc centred on the tape's centre, its rim ringed,
    // the four directions — N at the back, S at the front, W and E
    // to the sides — lettered on it (DOM labels, projected per frame).
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(900, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0d1113, roughness: 1 }),
    );
    ground.position.set(0, -3.6, CENTER_Z);
    scene.add(ground);
    const platter = new THREE.Group();
    platter.position.set(0, 0, CENTER_Z);
    scene.add(platter);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(PLATTER_R, PLATTER_R + 7, 3, 96),
      new THREE.MeshStandardMaterial({ color: 0x12181c, roughness: 0.85 }),
    );
    disc.position.y = -2.05; // top face at −0.55, just under the lane plates
    platter.add(disc);
    {
      const rimPts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        rimPts.push(new THREE.Vector3(Math.cos(a) * PLATTER_R, -0.5, Math.sin(a) * PLATTER_R));
      }
      platter.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(rimPts),
        new THREE.LineBasicMaterial({ color: 0x3a4a52 }),
      ));
    }
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x131a1e, roughness: 0.9 });
    const plateEdge = new THREE.LineBasicMaterial({ color: 0x2c3a41 });
    monitor.forEach((s, i) => {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(LANE_W + 5, 0.5, COLS * COL_D + 14),
        plateMat,
      );
      plate.position.set(laneX(i, monitor.length), -0.28, -COLS * COL_D / 2 + 2);
      scene.add(plate);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(LANE_W + 5, 0.55, COLS * COL_D + 14)),
        plateEdge,
      );
      edge.position.copy(plate.position);
      scene.add(edge);
    });

    // Ground-plan time scale: a ruler on the floor beside the lanes,
    // ticked every 10 samples, travelling with the tape (its group
    // takes the same flow offset as the relief meshes).
    const rulerX = laneX(monitor.length - 1, monitor.length) + LANE_W / 2 + 13;
    const timeGroup = new THREE.Group();
    scene.add(timeGroup);
    {
      const pts = [];
      pts.push(rulerX, 0.15, 2, rulerX, 0.15, -(COLS - 1) * COL_D);
      for (let age = 0; age < COLS; age += 10) {
        const len = age % 20 === 0 ? 8 : 4.5;
        pts.push(rulerX - len, 0.15, -age * COL_D, rulerX + len, 0.15, -age * COL_D);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
      timeGroup.add(new THREE.LineSegments(
        g, new THREE.LineBasicMaterial({ color: 0xffa726, transparent: true, opacity: 0.7 }),
      ));
    }

    // Label rods: vertical lines rising from each lane's surface at
    // the marker ages. Positions are recomputed per frame from the
    // interpolated signal at age + phase, so a rod tracks the same
    // physical point of the wave as it travels.
    const rodGeo = new THREE.BufferGeometry();
    const rodPos = new Float32Array(monitor.length * TIME_AGES.length * 2 * 3);
    rodGeo.setAttribute("position", new THREE.BufferAttribute(rodPos, 3));
    const rodGroup = new THREE.LineSegments(
      rodGeo, new THREE.LineBasicMaterial({ color: 0xffa726, transparent: true, opacity: 0.85 }),
    );
    scene.add(rodGroup);
    const sampleAge = (s, ageFloat) => {
      const pos = s.data.length - 1 - ageFloat;
      const i = Math.max(0, Math.min(s.data.length - 2, Math.floor(pos)));
      const f = Math.max(0, Math.min(1, pos - i));
      return s.data[i] * (1 - f) + s.data[i + 1] * f;
    };

    // Bounding-box wireframe of the whole data volume (a parameter):
    // a unit cube's edges, scaled per frame to the lane span, the
    // current full relief height, and the tape's length, centred on
    // the platter centre.
    const boundsBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x7fd4c1, transparent: true, opacity: 0.55 }),
    );
    boundsBox.position.set(0, 0, CENTER_Z);
    scene.add(boundsBox);
    const tapeW = laneX(monitor.length - 1, monitor.length) - laneX(0, monitor.length) + LANE_W;
    const tapeD = COLS * COL_D + COL_D;

    // One relief mesh per lane, rebuilt on each tick.
    const meshes = monitor.map((s, i) => {
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.6, metalness: 0.08, transparent: true,
      });
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      mesh.position.x = laneX(i, monitor.length);
      mesh.userData.laneId = s.lane.id;
      scene.add(mesh);
      return mesh;
    });

    const rebuild = () => {
      const { bands: b, bandHeight: bh, focusId: f } = stateRef.current;
      monitor.forEach((s, i) => {
        const geo = horizonReliefGeometry(s.data.subarray(s.data.length - COLS), COLS, {
          bands: b,
          bandHeight: bh,
          laneWidth: LANE_W,
          columnDepth: COL_D,
          scheme: s.lane.scheme === "greens" ? SCHEME_GREENS : SCHEME_BLUES,
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(geo.positions, 3));
        g.setAttribute("color", new THREE.BufferAttribute(geo.colors, 3));
        g.computeVertexNormals();
        meshes[i].geometry.dispose();
        meshes[i].geometry = g;
        meshes[i].material.opacity = f && f !== s.lane.id ? 0.45 : 1;
      });
    };
    let builtKey = "";

    // Picking: click a lane to focus it (mirrors the key-click).
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = null;
    const pick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(meshes, false);
      return hits[0]?.object?.userData.laneId ?? null;
    };
    const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
    const onUp = (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
      downAt = null;
      if (moved > 5) return;
      const id = pick(e);
      if (id) stateRef.current.onFocus(id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // Lane labels: DOM, projected each frame at each lane's front.
    const labelEls = monitor.map((s, i) => {
      const wrap = document.createElement("div");
      wrap.className = "h3-label";
      const chip = document.createElement("button");
      chip.className = "h3-chip";
      chip.textContent = String.fromCharCode(65 + i);
      chip.addEventListener("click", () => stateRef.current.onFocus(s.lane.id));
      const name = document.createElement("div");
      name.className = "h3-name";
      name.textContent = s.lane.label;
      const val = document.createElement("div");
      val.className = "h3-val";
      wrap.append(chip, name, val);
      labelsEl.appendChild(wrap);
      return { wrap, val, lane: s };
    });

    // Time-marker labels: one per marker age, projected each frame —
    // on the ground ruler in ground mode, on the label lane's rods
    // in rods mode.
    const timeLabelEls = TIME_AGES.map((age) => {
      const el = document.createElement("div");
      el.className = "h3-time-label";
      labelsEl.appendChild(el);
      return { el, age };
    });

    // Compass letters on the platter: N at the back (−Z), S at the
    // front (+Z), W and E to the sides, inset from the rim.
    const compassEls = [
      { t: "N", x: 0, z: CENTER_Z - PLATTER_R + 17 },
      { t: "S", x: 0, z: CENTER_Z + PLATTER_R - 17 },
      { t: "W", x: -PLATTER_R + 17, z: CENTER_Z },
      { t: "E", x: PLATTER_R - 17, z: CENTER_Z },
    ].map(({ t, x, z }) => {
      const el = document.createElement("div");
      el.className = "h3-compass";
      el.textContent = t;
      if (t === "N") { el.style.color = "#ffa726"; el.style.fontWeight = "bold"; }
      labelsEl.appendChild(el);
      return { el, x, z };
    });

    let raf = 0;
    let sway = 0;
    // Flow phase, kept on ONE clock: this loop watches the tick
    // counter itself and re-anchors the phase in the very frame it
    // rebuilds the geometry. (The earlier version accumulated the
    // phase from frame times in one place and reset it from a React
    // effect in another, while ticks arrived on the app's interval —
    // three clocks, and at every tick they disagreed by a frame or a
    // fraction, which the lanes showed as a slight jitter.)
    let lastTickSeen = tickRef.current;
    let anchor = performance.now();
    let phase = 0;
    let wasRunning = true;
    const v3 = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const st = stateRef.current;
      const key = `${tickRef.current}|${st.bands}|${st.bandHeight}|${st.focusId ?? ""}`;
      if (key !== builtKey) {
        rebuild();
        builtKey = key;
      }
      camera = projection === "iso" ? ortho : persp;

      // Flow: the phase is the elapsed fraction of the current tick,
      // measured from the anchor this loop set when it saw the tick
      // change — the same frame the geometry was rebuilt above. The
      // tape slides toward the back by that fraction of a column;
      // when the next tick rebuilds from the shifted buffer and the
      // phase restarts at 0, every column lands where the slide left
      // it — the motion is continuous, the data really travels.
      const now = performance.now();
      if (tickRef.current !== lastTickSeen) {
        lastTickSeen = tickRef.current;
        anchor = now;
        phase = 0;
      }
      if (st.running) {
        if (!wasRunning) {
          anchor = now - phase * Math.max(1, st.periodMs);
          wasRunning = true;
        }
        phase = Math.min(1, (now - anchor) / Math.max(1, st.periodMs));
      } else {
        wasRunning = false;
      }
      const flowZ = -phase * COL_D;
      for (const m of meshes) m.position.z = flowZ;
      timeGroup.position.z = flowZ;
      timeGroup.visible = st.timeMarkers === "ground";
      rodGroup.visible = st.timeMarkers === "rods";
      if (rodGroup.visible) {
        let rp = 0;
        monitor.forEach((s, i) => {
          const x = laneX(i, monitor.length);
          for (const age of TIME_AGES) {
            const h = sampleAge(s, age + phase) * st.bands * st.bandHeight;
            const z = -(age + phase) * COL_D;
            rodPos[rp++] = x; rodPos[rp++] = 0; rodPos[rp++] = z;
            rodPos[rp++] = x; rodPos[rp++] = h + 7; rodPos[rp++] = z;
          }
        });
        rodGeo.attributes.position.needsUpdate = true;
      }

      // Bounding box: fit the current full relief height.
      const fullH = st.bands * st.bandHeight;
      boundsBox.visible = Boolean(st.boundsOn);
      boundsBox.scale.set(tapeW, fullH, tapeD);
      boundsBox.position.y = fullH / 2;

      // Camera: ONE centre for everything — the platter's centre.
      // The orbit position and the look-at both use it, so rotation
      // turns about the middle of the platter (the earlier version
      // orbited one point and looked at another, and let the centre
      // drift toward the focused lane). Focus closes in instead of
      // travelling sideways. Drift sways the azimuth gently.
      const focusIdx = st.focusId ? monitor.findIndex((s) => s.lane.id === st.focusId) : -1;
      if (drift) sway += 0.0006;
      const swayA = Math.sin(sway) * 0.05;
      const rot = THREE.MathUtils.degToRad(st.rotation ?? 0) + swayA;
      const tilt = THREE.MathUtils.degToRad(st.elevation ?? 0);
      if (camera === persp) {
        const radius = focusIdx >= 0 ? 472 : 532;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(165, 506) + tilt));
        camera.position.set(
          Math.sin(rot) * Math.cos(elev) * radius,
          Math.sin(elev) * radius,
          CENTER_Z + Math.cos(rot) * Math.cos(elev) * radius,
        );
        camera.lookAt(0, 0, CENTER_Z);
      } else {
        const radius = 1000;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(574, 790) + tilt));
        const az = Math.PI / 4 + rot;
        camera.position.set(
          Math.sin(az) * Math.cos(elev) * radius,
          Math.sin(elev) * radius,
          CENTER_Z + Math.cos(az) * Math.cos(elev) * radius,
        );
        camera.lookAt(0, 0, CENTER_Z);
        camera.zoom = focusIdx >= 0 ? 1.25 : 1.0;
        camera.updateProjectionMatrix();
      }

      // Project labels to the front of each lane.
      const show = st.labelsOn;
      for (let i = 0; i < labelEls.length; i++) {
        const { wrap, val, lane } = labelEls[i];
        if (!show) { wrap.style.display = "none"; continue; }
        wrap.style.display = "";
        val.textContent = lane.lane.format(lane.current);
        const hNow = lane.current * st.bands * st.bandHeight;
        v3.set(laneX(i, monitor.length), hNow + 10, 8).project(camera);
        const sx = (v3.x * 0.5 + 0.5) * mount.clientWidth;
        const sy = (-v3.y * 0.5 + 0.5) * mount.clientHeight;
        wrap.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        wrap.classList.toggle("focus", st.focusId === lane.lane.id);
      }

      // Project the time-marker labels.
      const mode = st.timeMarkers;
      const labelLane = focusIdx >= 0 ? focusIdx : monitor.length - 1;
      for (const { el, age } of timeLabelEls) {
        if (mode === "off" || !show) { el.style.display = "none"; continue; }
        el.style.display = "";
        el.textContent = `−${Math.round((age * st.periodMs) / 1000)}s`;
        if (mode === "ground") {
          v3.set(rulerX, 1.5, -(age + phase) * COL_D);
        } else {
          const h = sampleAge(monitor[labelLane], age + phase) * st.bands * st.bandHeight;
          v3.set(laneX(labelLane, monitor.length), h + 13, -(age + phase) * COL_D);
        }
        v3.project(camera);
        const sx = (v3.x * 0.5 + 0.5) * mount.clientWidth;
        const sy = (-v3.y * 0.5 + 0.5) * mount.clientHeight;
        el.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      }

      // Project the compass letters (fixed to the platter, so they
      // travel with it as the camera orbits).
      for (const c of compassEls) {
        v3.set(c.x, 0.5, c.z).project(camera);
        const sx = (v3.x * 0.5 + 0.5) * mount.clientWidth;
        const sy = (-v3.y * 0.5 + 0.5) * mount.clientHeight;
        c.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      }

      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      renderer.setSize(w, h);
      persp.aspect = w / h;
      persp.updateProjectionMatrix();
      ortho.left = -orthoHalf * (w / h);
      ortho.right = orthoHalf * (w / h);
      ortho.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      for (const m of meshes) {
        m.geometry.dispose();
        m.material.dispose();
      }
      timeGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      rodGeo.dispose();
      rodGroup.material.dispose();
      platter.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      ground.geometry.dispose();
      ground.material.dispose();
      boundsBox.geometry.dispose();
      boundsBox.material.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      labelsEl.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitor, projection, drift]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
    </div>
  );
}
