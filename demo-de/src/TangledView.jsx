import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The tangled tree in 3D. The 2D metro layout (Abrate's algorithm,
 * ported in NCTGraphite's tangle module) lies in the XY plane; the
 * third dimension carries the *bundles*: each bundle's vertical
 * lane lifts off the plane to its own depth, so a link leaves its
 * parent on the plane, rises to its bundle's lane, runs along it,
 * and settles back onto its child. Levels stand as translucent
 * sheets. Key-click chips (HTML, projected each frame) label every
 * node with the key that clicks it.
 */

const HIGHLIGHT = new THREE.Color("#ffa726");

function linkPoints(l, layout, spread, laneZOf) {
  const X = (x) => (x - layout.width / 2) * spread;
  const Y = (y) => (layout.height / 2 - y) * spread;
  const laneZ = laneZOf(l.bundle);
  const c1 = Math.max(2, l.c1);
  const c2 = Math.max(2, l.c2);
  const pts = [];
  const push = (x, y) => pts.push([X(x), Y(y)]);
  // horizontal out of the target (parent)
  push(l.xt, l.yt);
  push(l.xb - c1, l.yt);
  // arc up to the bundle lane: centre (xb-c1, yt+c1) in layout coords
  for (let s = 1; s <= 4; s++) {
    const th = -Math.PI / 2 + (s / 4) * (Math.PI / 2);
    push(l.xb - c1 + c1 * Math.cos(th), l.yt + c1 + c1 * Math.sin(th));
  }
  // the lane run
  push(l.xb, l.ys - c2);
  // arc into the source (child): centre (xb+c2, ys-c2)
  for (let s = 1; s <= 4; s++) {
    const th = Math.PI - (s / 4) * (Math.PI / 2);
    push(l.xb + c2 + c2 * Math.cos(th), l.ys - c2 + c2 * Math.sin(th));
  }
  push(l.xs, l.ys);
  // z: a smooth lift to the lane depth and back to the plane
  const n = pts.length;
  return pts.map(([x, y], i) => {
    const t = n === 1 ? 0 : i / (n - 1);
    return new THREE.Vector3(x, y, laneZ * Math.sin(Math.PI * t));
  });
}

export default function TangledView({
  layout,
  depth = 14,
  tube = 1.1,
  spread = 0.5,
  sheets = true,
  labelsOn = true,
  drift = true,
  selectedId = null,
  labelFor = () => "",
  onSelect = () => {},
  resetNonce = 0,
  height = 560,
}) {
  const mountRef = useRef(null);
  const chipsRef = useRef(null);
  const liveRef = useRef({});
  liveRef.current = { depth, tube, spread, sheets, drift, selectedId, labelsOn };
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const labelRef = useRef(labelFor);
  labelRef.current = labelFor;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    const mount = mountRef.current;
    const chipsEl = chipsRef.current;
    if (!mount || !chipsEl) return;
    const L = layoutRef.current;
    const width = mount.clientWidth || 1100;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04080a);
    scene.fog = new THREE.Fog(0x04080a, 1400, 2600);

    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 5000);
    camera.position.set(0, 20, 680);
    const camHome = camera.position.clone();
    let camTarget = new THREE.Vector3(0, 0, 0);
    let focusPoint = null;

    // bundle lane index within its level (stable, layout order)
    const laneIndex = new Map();
    const byLevel = new Map();
    for (const b of L.bundles) {
      if (!byLevel.has(b.level)) byLevel.set(b.level, []);
      byLevel.get(b.level).push(b);
    }
    for (const [, arr] of byLevel) arr.forEach((b, i) => laneIndex.set(b, i - (arr.length - 1) / 2));
    const laneZOf = (b) => (laneIndex.get(b) ?? 0) * liveRef.current.depth;

    const world = new THREE.Group();
    scene.add(world);

    let builtKey = "";
    let nodeMeshes = new Map();
    let linkMeshes = [];
    let sheetMeshes = [];
    let chipDivs = new Map();

    const bundleMaterials = new Map();
    const matFor = (color) => {
      if (!bundleMaterials.has(color)) {
        bundleMaterials.set(color, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }));
      }
      return bundleMaterials.get(color);
    };
    const dimMat = new THREE.MeshBasicMaterial({ color: 0x39525c, transparent: true, opacity: 0.13 });
    const hiMat = new THREE.MeshBasicMaterial({ color: HIGHLIGHT });
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xe8f3ee });
    const nodeDimMat = new THREE.MeshBasicMaterial({ color: 0x39525c, transparent: true, opacity: 0.35 });
    const nodeHiMat = new THREE.MeshBasicMaterial({ color: HIGHLIGHT });

    const buildAll = () => {
      const { depth: d, tube: t, spread: s, sheets: sh } = liveRef.current;
      void d;
      for (const m of nodeMeshes.values()) { world.remove(m); m.geometry.dispose(); }
      for (const m of linkMeshes) { world.remove(m); m.geometry.dispose(); }
      for (const m of sheetMeshes) { world.remove(m); m.geometry.dispose(); }
      nodeMeshes = new Map(); linkMeshes = []; sheetMeshes = [];
      chipsEl.innerHTML = ""; chipDivs = new Map();

      const X = (x) => (x - L.layout.width / 2) * s;
      const Y = (y) => (L.layout.height / 2 - y) * s;

      if (sh) {
        const depthExtent = Math.max(60, ...L.bundles.map((b) => Math.abs(laneZOf(b)))) + 40;
        for (const level of L.levels) {
          if (!level.length) continue;
          const g = new THREE.PlaneGeometry(depthExtent * 2, L.layout.height * s);
          const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
            color: 0x7fd4c1, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false,
          }));
          m.rotation.y = Math.PI / 2;
          m.position.set(X(level[0].x), 0, 0);
          world.add(m); sheetMeshes.push(m);
          const frame = new THREE.LineSegments(
            new THREE.EdgesGeometry(g),
            new THREE.LineBasicMaterial({ color: 0x2c5a52, transparent: true, opacity: 0.5 }),
          );
          frame.rotation.y = Math.PI / 2;
          frame.position.copy(m.position);
          world.add(frame); sheetMeshes.push(frame);
        }
      }

      for (const n of L.nodes) {
        const h = (n.height + L.layout.nodeHeight) * s;
        const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, 3.4), nodeMat);
        m.position.set(X(n.x), Y(n.y), 0);
        m.userData.nodeId = n.id;
        world.add(m); nodeMeshes.set(n.id, m);
        const chip = document.createElement("button");
        chip.textContent = labelRef.current(n.id);
        chip.className = "tangle-chip";
        chip.addEventListener("click", () => selectRef.current(n.id));
        chipsEl.appendChild(chip);
        chipDivs.set(n.id, chip);
      }

      for (const l of L.links) {
        const pts = linkPoints(l, L.layout, s, laneZOf);
        const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
        const geo = new THREE.TubeGeometry(curve, 40, t, 6, false);
        const m = new THREE.Mesh(geo, matFor(l.bundle.color));
        m.userData.link = l;
        world.add(m); linkMeshes.push(m);
      }
      builtKey = [liveRef.current.depth, liveRef.current.tube, liveRef.current.spread, liveRef.current.sheets].join("|");
      applySelection();
    };

    const applySelection = () => {
      const sel = liveRef.current.selectedId;
      const selNode = sel ? L.nodesIndex[sel] : null;
      for (const [id, m] of nodeMeshes) {
        m.material = !sel ? nodeMat : id === sel ? nodeHiMat : nodeDimMat;
      }
      for (const m of linkMeshes) {
        const l = m.userData.link;
        m.material = !sel ? matFor(l.bundle.color)
          : l.source.id === sel || l.target.id === sel ? hiMat : dimMat;
      }
      for (const [id, chip] of chipDivs) {
        chip.classList.toggle("sel", id === sel);
        chip.classList.toggle("dim", Boolean(sel) && id !== sel);
      }
      if (selNode) {
        const s = liveRef.current.spread;
        focusPoint = new THREE.Vector3(
          (selNode.x - L.layout.width / 2) * s,
          (L.layout.height / 2 - selNode.y) * s,
          0,
        );
      } else {
        focusPoint = null;
      }
    };

    buildAll();
    let lastSel = liveRef.current.selectedId;
    let lastLabels = liveRef.current.labelsOn;

    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    renderer.domElement.addEventListener("pointerdown", (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects([...nodeMeshes.values()], false)[0];
      if (hit) selectRef.current(hit.object.userData.nodeId);
    });

    let raf = 0;
    let frame = 0;
    let disposed = false;
    const v3 = new THREE.Vector3();
    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      frame++;
      const key = [liveRef.current.depth, liveRef.current.tube, liveRef.current.spread, liveRef.current.sheets].join("|");
      if (key !== builtKey) buildAll();
      if (liveRef.current.selectedId !== lastSel) { lastSel = liveRef.current.selectedId; applySelection(); }
      if (liveRef.current.labelsOn !== lastLabels) {
        lastLabels = liveRef.current.labelsOn;
        chipsEl.style.display = lastLabels ? "block" : "none";
      }
      const t = frame * 0.0035;
      if (liveRef.current.drift && !focusPoint) {
        camera.position.x = Math.sin(t) * 46;
        camera.position.y = 20 + Math.sin(t * 0.7) * 22;
      }
      const look = focusPoint ?? camTarget;
      camera.position.lerp(
        focusPoint
          ? new THREE.Vector3(focusPoint.x * 0.55, focusPoint.y * 0.55 + 16, 470)
          : new THREE.Vector3(camera.position.x, camera.position.y, camHome.z),
        focusPoint ? 0.045 : 0.02,
      );
      camera.lookAt(look.x * (focusPoint ? 0.85 : 1), look.y * (focusPoint ? 0.85 : 1), 0);
      // project chips
      if (liveRef.current.labelsOn) {
        for (const n of L.nodes) {
          const chip = chipDivs.get(n.id);
          const mesh = nodeMeshes.get(n.id);
          if (!chip || !mesh) continue;
          v3.copy(mesh.position).project(camera);
          if (v3.z > 1) { chip.style.display = "none"; continue; }
          chip.style.display = "block";
          chip.style.transform = `translate(${(v3.x * 0.5 + 0.5) * width - 9}px, ${(-v3.y * 0.5 + 0.5) * height - 22}px)`;
        }
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      chipsEl.innerHTML = "";
    };
    // One scene per layout; parameter changes rebuild in-loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  void resetNonce; // camera reset is driven by clearing the selection (App)

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div ref={mountRef} style={{ width: "100%", height }} />
      <div ref={chipsRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
    </div>
  );
}
