import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  descendants as sunburstDescendants,
  zoomTargets,
  arcVisible,
  labelVisible,
  interpolateSlice,
} from "../NCTGraphite/packages/nctgraphite/src/sunburst/NCTGraphiteSunburstLayout.ts";

/**
 * The zoomable sunburst in 3D — SunburstView.
 *
 * Bostock's 2D disc becomes a terraced mesa: each slice is an
 * annular-sector prism standing on the ground plane, and the inner
 * rings stand higher than the outer, so the disc reads as a stepped
 * amphitheatre of data. The zoom is the original's — spans re-map
 * into the clicked node's frame, interpolated over 750 ms — with
 * heights read off the animated y0, so rings rise, sink and trade
 * places as you descend. Key chips are projected over the view each
 * frame at each labelled slice's centroid, as on the tangled page.
 */

const RING = 54; // world units per depth band
const ZOOM_MS = 750;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function polar(angle, radius) {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/** An annular-sector prism: top at `top`, base on y=0, in the XZ plane. */
function wedgeGeometry(slice, terrace, gap) {
  const pad = Math.min((slice.x1 - slice.x0) / 2, 0.005);
  const a0 = slice.x0 + pad;
  const a1 = slice.x1 - pad;
  if (a1 - a0 < 0.002) return null;
  const r0 = Math.max(0, slice.y0 * RING);
  const r1 = Math.max(r0 + 0.5, slice.y1 * RING - gap);
  const top = 3 + Math.max(0, 2 - Math.min(slice.y0, 2)) * terrace;
  const segs = Math.max(1, Math.min(72, Math.ceil((a1 - a0) / (Math.PI / 30))));
  const pos = [];
  const quad = (p1, p2, p3, p4) => {
    pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
  };
  const pt = (angle, r, y) => {
    const [x, z] = polar(angle, r);
    return [x, y, z];
  };
  for (let i = 0; i < segs; i++) {
    const t0 = a0 + ((a1 - a0) * i) / segs;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / segs;
    // top
    if (r0 < 0.75) {
      pos.push(...pt(0, 0, top), ...pt(t0, r1, top), ...pt(t1, r1, top));
    } else {
      quad(pt(t0, r0, top), pt(t0, r1, top), pt(t1, r1, top), pt(t1, r0, top));
    }
    // outer wall
    quad(pt(t0, r1, top), pt(t0, r1, 0), pt(t1, r1, 0), pt(t1, r1, top));
    // inner wall
    if (r0 >= 0.75) quad(pt(t0, r0, 0), pt(t0, r0, top), pt(t1, r0, top), pt(t1, r0, 0));
    // side walls at the ends
    if (i === 0) quad(pt(t0, r0, 0), pt(t0, r1, 0), pt(t0, r1, top), pt(t0, r0, top));
    if (i === segs - 1) quad(pt(t1, r0, top), pt(t1, r1, top), pt(t1, r1, 0), pt(t1, r0, 0));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export default function SunburstView({
  root,
  colourOf,
  terrace,
  gap,
  labelsOn,
  drift,
  zoomReq,
  keyTargets,
  selected,
  focusNode,
  onZoomNode,
  onSelect,
  onCentre,
  onHover,
  onSettled,
}) {
  const mountRef = useRef(null);
  const chipsRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { keyTargets, labelsOn, selected, focusNode, colourOf };

  // Zoom requests: animate every node's current → target.
  const animRef = useRef(null);
  useEffect(() => {
    if (!zoomReq) return;
    zoomTargets(root, zoomReq.node);
    animRef.current = {
      start: performance.now(),
      from: new Map(sunburstDescendants(root).map((n) => [n, { ...n.current }])),
      node: zoomReq.node,
    };
  }, [zoomReq, root]);

  useEffect(() => {
    const mount = mountRef.current;
    const chipsEl = chipsRef.current;
    if (!mount) return undefined;
    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 560;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x0b0e10, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0e10, 700, 1400);
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 3000);

    scene.add(new THREE.HemisphereLight(0xdfeeea, 0x1a2226, 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(220, 420, 140);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x7fd4c1, 0.5);
    rim.position.set(-260, 120, -200);
    scene.add(rim);

    // Ground: dark disc + polar instrument rings.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(RING * 3.55, 96).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0e1316, roughness: 0.95, metalness: 0.05 }),
    );
    ground.position.y = -0.05;
    scene.add(ground);
    const ringMat = new THREE.LineBasicMaterial({ color: 0x2c3a41, transparent: true, opacity: 0.8 });
    for (let i = 1; i <= 3; i++) {
      const pts = [];
      for (let s = 0; s <= 96; s++) {
        const [x, z] = polar((s / 96) * Math.PI * 2, RING * i);
        pts.push(new THREE.Vector3(x, 0.02, z));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    }

    // One mesh per node; geometry is rebuilt while animating / on param change.
    const group = new THREE.Group();
    scene.add(group);
    const meshes = new Map();
    for (const node of sunburstDescendants(root)) {
      if (node === root) continue;
      const base = new THREE.Color(stateRef.current.colourOf(node));
      const mat = new THREE.MeshStandardMaterial({
        color: base,
        roughness: 0.55,
        metalness: 0.12,
        transparent: true,
        opacity: 0,
        emissive: base.clone().multiplyScalar(0.14),
      });
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      mesh.userData.node = node;
      mesh.visible = false;
      group.add(mesh);
      meshes.set(node, mesh);
    }

    // Centre pillar: click to climb (its datum is focusNode's parent).
    const centreMat = new THREE.MeshStandardMaterial({
      color: 0x141c20, roughness: 0.4, metalness: 0.3,
      emissive: 0xffa726, emissiveIntensity: 0.08,
    });
    const centre = new THREE.Mesh(new THREE.CylinderGeometry(RING - 3, RING - 1, 6, 72), centreMat);
    centre.position.y = 3;
    centre.userData.centre = true;
    scene.add(centre);
    const centreRing = new THREE.Mesh(
      new THREE.TorusGeometry(RING - 3, 0.9, 8, 72).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffa726 }),
    );
    centreRing.position.y = 6.1;
    scene.add(centreRing);

    const rebuild = () => {
      const { selected: sel } = stateRef.current;
      for (const [node, mesh] of meshes) {
        const cur = node.current;
        const drawable = cur.x1 - cur.x0 > 0.002 && cur.y1 > 0.03 && cur.y0 < 3.4;
        if (!drawable) {
          mesh.visible = false;
          continue;
        }
        const geo = wedgeGeometry(cur, terrace, gap);
        if (!geo) {
          mesh.visible = false;
          continue;
        }
        mesh.geometry.dispose();
        mesh.geometry = geo;
        mesh.visible = true;
        const targetVisible = arcVisible(node.target);
        let opacity = targetVisible ? (node.children.length ? 0.92 : 0.66) : 0;
        if (node.target.y0 < 1) opacity *= Math.max(0, Math.min(1, cur.y0)); // the focus slice sinks into the centre
        mesh.material.opacity = opacity;
        const base = new THREE.Color(stateRef.current.colourOf(node));
        const boost = node === sel ? 0.55 : node === hoverRef.current ? 0.3 : 0.14;
        mesh.material.emissive.copy(base).multiplyScalar(boost);
      }
    };

    const hoverRef = { current: null };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = null;
    const pick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([centre, ...meshes.values()].filter((m) => m.visible), false);
      return hits[0]?.object ?? null;
    };
    const onMove = (e) => {
      const hit = pick(e);
      const node = hit?.userData.node ?? null;
      if (node !== hoverRef.current) {
        hoverRef.current = node;
        onHover(node);
        renderer.domElement.style.cursor = hit ? "pointer" : "default";
      }
    };
    const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
    const onUp = (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
      downAt = null;
      if (moved > 5) return;
      const hit = pick(e);
      if (!hit) return;
      if (hit.userData.centre) onCentre();
      else if (hit.userData.node.children.length) onZoomNode(hit.userData.node);
      else onSelect(hit.userData.node);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // Key chips are DOM nodes, created once per labelled target set.
    let chipNodes = new Map();
    const syncChips = () => {
      const { keyTargets: targets, labelsOn: on } = stateRef.current;
      const wanted = new Map((on ? targets : []).map((t) => [t.node, t]));
      for (const [node, el] of chipNodes) {
        if (!wanted.has(node)) {
          el.remove();
          chipNodes.delete(node);
        }
      }
      for (const [node, t] of wanted) {
        if (!chipNodes.has(node)) {
          const el = document.createElement("button");
          el.className = "sun-chip";
          el.textContent = t.key;
          el.addEventListener("click", () => {
            if (node.children.length) onZoomNode(node);
            else onSelect(node);
          });
          chipsEl.appendChild(el);
          chipNodes.set(node, el);
        }
      }
    };

    let raf = 0;
    let azimuth = 0.65;
    let lastParamKey = "";
    const v3 = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();

      // Zoom animation.
      let animating = false;
      const anim = animRef.current;
      if (anim) {
        const t = Math.min(1, (now - anim.start) / ZOOM_MS);
        const e = easeInOut(t);
        for (const [node, from] of anim.from) node.current = interpolateSlice(from, node.target, e);
        animating = t < 1;
        if (!animating) {
          animRef.current = null;
          onSettled(anim.node);
        }
      }

      const paramKey = `${terrace}|${gap}|${stateRef.current.selected?.name ?? ""}|${hoverRef.current?.name ?? ""}`;
      if (animating || paramKey !== lastParamKey) {
        rebuild();
        lastParamKey = paramKey;
      }

      // Camera: a slow orbit over the table when drift is on.
      if (drift && !anim) azimuth += 0.00045;
      const dist = 470;
      camera.position.set(Math.sin(azimuth) * dist * 0.62, 330, Math.cos(azimuth) * dist * 0.62);
      camera.lookAt(0, 0, 0);

      // Project chips to their slices' current centroids.
      syncChips();
      const { keyTargets: targets, labelsOn: on, selected: sel } = stateRef.current;
      if (on) {
        for (const t of targets) {
          const el = chipNodes.get(t.node);
          if (!el) continue;
          const cur = t.node.current;
          const show = labelVisible(cur);
          const midA = (cur.x0 + cur.x1) / 2;
          const midR = ((cur.y0 + cur.y1) / 2) * RING;
          const [x, z] = polar(midA, midR);
          const top = 3 + Math.max(0, 2 - Math.min(cur.y0, 2)) * terrace;
          v3.set(x, top + 4, z).project(camera);
          const sx = (v3.x * 0.5 + 0.5) * mount.clientWidth;
          const sy = (-v3.y * 0.5 + 0.5) * mount.clientHeight;
          el.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
          el.style.opacity = show ? "1" : "0";
          el.style.pointerEvents = show ? "auto" : "none";
          el.classList.toggle("sel", t.node === sel);
        }
      }

      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      lastParamKey = "";
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      centre.geometry.dispose();
      centreMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      chipsEl.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, terrace, gap, drift]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={chipsRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
      <div
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          pointerEvents: "none", textAlign: "center", fontFamily: "Consolas, monospace",
          color: "#ffa726", fontSize: 12, letterSpacing: 1, textShadow: "0 1px 6px #000",
          maxWidth: RING * 1.7,
        }}
      >
        {focusNode?.name}
        {focusNode?.parent ? <div style={{ fontSize: 9.5, color: "#8fa3ab", marginTop: 2 }}>click centre / Esc to climb</div> : null}
      </div>
    </div>
  );
}
