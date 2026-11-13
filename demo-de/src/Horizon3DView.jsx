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
 * and depth of colour. The camera question the page leaves open —
 * perspective or isometric — is a parameter: perspective for
 * presence, an orthographic isometric camera for undistorted
 * comparison across the whole depth of the tape.
 */

export const LANE_W = 26;
export const LANE_PITCH = 35;
export const COLS = 120;
export const COL_D = 2.2;

export function laneX(i, count) {
  return (i - (count - 1) / 2) * LANE_PITCH;
}

export default function Horizon3DView({
  monitor,
  bands,
  bandHeight,
  tickCount,
  focusId,
  projection,
  drift,
  labelsOn,
  onFocus,
}) {
  const mountRef = useRef(null);
  const labelsRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { monitor, bands, bandHeight, focusId, labelsOn, onFocus };
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

    // Ground and per-lane floor plates.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(760, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0d1113, roughness: 1 }),
    );
    ground.position.set(0, -0.12, -COLS * COL_D * 0.45);
    scene.add(ground);
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
        const geo = horizonReliefGeometry(s.data, COLS, {
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

    let raf = 0;
    let camX = 0;
    let sway = 0;
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

      // Camera: ease toward the focused lane; drift sways gently.
      const focusIdx = st.focusId ? monitor.findIndex((s) => s.lane.id === st.focusId) : -1;
      const targetX = focusIdx >= 0 ? laneX(focusIdx, monitor.length) * 0.72 : 0;
      camX += (targetX - camX) * 0.05;
      if (drift) sway += 0.0006;
      const swayA = Math.sin(sway) * 0.05;
      const midZ = -COLS * COL_D * 0.46;
      if (camera === persp) {
        const dist = focusIdx >= 0 ? 330 : 385;
        camera.position.set(camX + Math.sin(swayA) * 60, focusIdx >= 0 ? 138 : 165, dist);
        camera.lookAt(camX * 0.9, 0, midZ);
      } else {
        const d = 700;
        const az = Math.PI / 4 + swayA;
        camera.position.set(camX + Math.sin(az) * d, d * 0.82, Math.cos(az) * d);
        camera.lookAt(camX, 0, midZ);
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
