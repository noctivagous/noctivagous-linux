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
 * The zoomable sunburst as a cylinder — SunburstCylinderView.
 *
 * Bostock's disc stands up as a drum: every slice is an annular-
 * sector wedge block extruded to one height, so the two visible
 * rings lie on the drum's top face and the whole reads as a
 * cylinder. The drum stands on the activity monitor's circular
 * platter (rim ringed, N/S/W/E lettered on it), and every camera
 * orbit turns about the platter's centre — isometric by default,
 * perspective one parameter away, rotation and elevation as
 * continuous offsets on both. The zoom is the original's (750 ms
 * interpolation of each slice's span into the clicked node's
 * frame). What the cylinder adds: a leaf's portion can be pulled
 * OUT of the drum — the wedge slides radially outward and its
 * information stands in 3D space beside it, on a card projected
 * at the pulled wedge.
 */

const RING = 54; // world units per depth band (as SunburstView)
const ZOOM_MS = 750;
const GAP = 1.2; // radial breathing room between rings
const PULL = 14; // how far a leaf portion slides out of the drum
const PULL_MS = 380;
const PLATTER_R = 205; // the horizon platter's radius

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function polar(angle, radius) {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

/** An annular-sector block: base on y=0, top at `height`, in the XZ plane. */
function blockGeometry(slice, height) {
  const pad = Math.min((slice.x1 - slice.x0) / 2, 0.005);
  const a0 = slice.x0 + pad;
  const a1 = slice.x1 - pad;
  if (a1 - a0 < 0.002) return null;
  const r0 = Math.max(0, slice.y0 * RING);
  const r1 = Math.max(r0 + 0.5, slice.y1 * RING - GAP);
  const top = height;
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

export default function SunburstCylinderView({
  root,
  colourOf,
  drumHeight,
  projection,
  rotation,
  elevation,
  boundsOn,
  labelsOn,
  drift,
  zoomReq,
  keyTargets,
  targetNode,
  openNode,
  openInfo,
  onZoomNode,
  onLeafClick,
  onTarget,
  onCentre,
  onHover,
  onSettled,
}) {
  const mountRef = useRef(null);
  const labelsRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = {
    keyTargets, labelsOn, targetNode, openNode, openInfo, colourOf,
    rotation, elevation, boundsOn, onLeafClick, onTarget,
  };

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
    scene.fog = new THREE.Fog(0x0b0e10, 800, 2000);

    const persp = new THREE.PerspectiveCamera(40, width / height, 1, 3000);
    const orthoHalf = 215;
    const ortho = new THREE.OrthographicCamera(
      -orthoHalf * (width / height), orthoHalf * (width / height),
      orthoHalf, -orthoHalf, -500, 3000,
    );

    scene.add(new THREE.HemisphereLight(0xdfeeea, 0x1a2226, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(180, 320, 220);
    scene.add(sun);
    const rimLight = new THREE.DirectionalLight(0x7fd4c1, 0.45);
    rimLight.position.set(-240, 90, -260);
    scene.add(rimLight);

    // Ground far below, and the circular platter (the horizon
    // monitor's furniture): a shallow disc, its rim ringed, the
    // four directions lettered on it — DOM labels projected per
    // frame, so they travel with the platter as the camera orbits.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(900, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0d1113, roughness: 1 }),
    );
    ground.position.set(0, -3.6, 0);
    scene.add(ground);
    const platter = new THREE.Group();
    scene.add(platter);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(PLATTER_R, PLATTER_R + 7, 3, 96),
      new THREE.MeshStandardMaterial({ color: 0x12181c, roughness: 0.85 }),
    );
    disc.position.y = -2.05; // top face at −0.55, just under the drum
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
    const compassEls = [
      { t: "N", x: 0, z: -PLATTER_R + 17 },
      { t: "S", x: 0, z: PLATTER_R - 17 },
      { t: "W", x: -PLATTER_R + 17, z: 0 },
      { t: "E", x: PLATTER_R - 17, z: 0 },
    ].map(({ t, x, z }) => {
      const el = document.createElement("div");
      el.className = "sc-compass";
      el.textContent = t;
      if (t === "N") { el.style.color = "#ffa726"; el.style.fontWeight = "bold"; }
      labelsEl.appendChild(el);
      return { el, x, z };
    });

    // The drum: all wedge meshes in a group resting on the platter.
    const drum = new THREE.Group();
    drum.position.y = -0.5;
    scene.add(drum);
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
      drum.add(mesh);
      meshes.set(node, mesh);
    }

    // Centre cap: completes the cylinder over the focus node's own
    // disc; clicking it climbs (the original's centre circle).
    const centreMat = new THREE.MeshStandardMaterial({
      color: 0x141c20, roughness: 0.4, metalness: 0.3,
      emissive: 0xffa726, emissiveIntensity: 0.08,
    });
    const centre = new THREE.Mesh(
      new THREE.CylinderGeometry(RING - 1.5, RING - 0.5, drumHeight, 72),
      centreMat,
    );
    centre.position.y = drumHeight / 2;
    centre.userData.centre = true;
    drum.add(centre);
    const centreRing = new THREE.Mesh(
      new THREE.TorusGeometry(RING - 1.5, 0.9, 8, 72).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffa726 }),
    );
    centreRing.position.y = drumHeight + 0.1;
    drum.add(centreRing);

    // Bounding-box wireframe of the drum volume (a parameter).
    const boundsBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x7fd4c1, transparent: true, opacity: 0.55 }),
    );
    boundsBox.scale.set(RING * 6 + 4, drumHeight, RING * 6 + 4);
    boundsBox.position.y = drumHeight / 2 - 0.5;
    scene.add(boundsBox);

    // The pulled leaf's information card: a DOM card projected at
    // the pulled-out wedge, its content rebuilt when the open leaf
    // changes, its position every frame.
    const infoEl = document.createElement("div");
    infoEl.className = "sc-info";
    infoEl.style.display = "none";
    labelsEl.appendChild(infoEl);
    let infoKey = "";

    const hoverRef = { current: null };
    const rebuild = () => {
      const st = stateRef.current;
      for (const [node, mesh] of meshes) {
        const cur = node.current;
        const drawable = cur.x1 - cur.x0 > 0.002 && cur.y1 > 0.03 && cur.y0 < 3.4;
        if (!drawable) {
          mesh.visible = false;
          continue;
        }
        const geo = blockGeometry(cur, drumHeight);
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
        const base = new THREE.Color(st.colourOf(node));
        const boost = node === st.openNode ? 0.6
          : node === st.targetNode ? 0.55
          : node === hoverRef.current ? 0.3 : 0.14;
        mesh.material.emissive.copy(base).multiplyScalar(boost);
      }
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = null;
    const pick = (e) => {
      const camera = projection === "iso" ? ortho : persp;
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
      else stateRef.current.onLeafClick(hit.userData.node);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // Key chips are DOM nodes, created once per labelled target set.
    // A chip click TARGETS its slice (the F key, or a wedge click,
    // does the clicking) — targeting and clicking are separate acts.
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
          el.className = "sc-chip";
          el.textContent = t.key;
          el.addEventListener("click", () => stateRef.current.onTarget(node));
          labelsEl.appendChild(el);
          chipNodes.set(node, el);
        }
      }
    };

    // Pull state: node → 0..1, how far its wedge is out of the drum.
    const pulls = new Map();

    let raf = 0;
    let sway = 0;
    let lastTime = performance.now();
    let lastParamKey = "";
    const v3 = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(100, now - lastTime);
      lastTime = now;
      const st = stateRef.current;
      const camera = projection === "iso" ? ortho : persp;

      // Zoom animation: interpolate every slice current → target.
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

      // Pull animation: the open leaf's wedge slides radially out;
      // any previously open wedge slides back in.
      let pulling = false;
      const pullNodes = new Set([...pulls.keys(), ...(st.openNode ? [st.openNode] : [])]);
      for (const n of pullNodes) {
        const goal = n === st.openNode ? 1 : 0;
        let t = pulls.get(n) ?? 0;
        t = goal > t ? Math.min(goal, t + dt / PULL_MS) : Math.max(goal, t - dt / PULL_MS);
        if (t <= 0 && goal === 0) pulls.delete(n);
        else pulls.set(n, t);
        if (t > 0 && t < 1) pulling = true;
        const mesh = meshes.get(n);
        if (mesh) {
          const midA = (n.current.x0 + n.current.x1) / 2;
          mesh.position.set(Math.cos(midA) * PULL * t, 0, Math.sin(midA) * PULL * t);
        }
      }

      const paramKey = `${st.targetNode?.name ?? ""}|${st.openNode?.name ?? ""}|${hoverRef.current?.name ?? ""}`;
      if (animating || pulling || paramKey !== lastParamKey) {
        rebuild();
        lastParamKey = paramKey;
      }

      // Bounding box.
      boundsBox.visible = Boolean(st.boundsOn);

      // Camera: ONE centre — the platter's centre — for orbit and
      // look-at alike (the horizon monitor's centred orbit).
      // Rotation and elevation are continuous offsets around each
      // projection's home position; drift sways the azimuth.
      if (drift) sway += 0.0006;
      const swayA = Math.sin(sway) * 0.05;
      const rot = THREE.MathUtils.degToRad(st.rotation ?? 0) + swayA;
      const tilt = THREE.MathUtils.degToRad(st.elevation ?? 0);
      const lookY = drumHeight * 0.3;
      if (camera === persp) {
        const radius = 532;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(165, 506) + tilt));
        camera.position.set(
          Math.sin(rot) * Math.cos(elev) * radius,
          Math.sin(elev) * radius,
          Math.cos(rot) * Math.cos(elev) * radius,
        );
        camera.lookAt(0, lookY, 0);
      } else {
        const radius = 1000;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(574, 790) + tilt));
        const az = Math.PI / 4 + rot;
        camera.position.set(
          Math.sin(az) * Math.cos(elev) * radius,
          Math.sin(elev) * radius,
          Math.cos(az) * Math.cos(elev) * radius,
        );
        camera.lookAt(0, lookY, 0);
      }

      // Project chips to their slices' current centroids (a pulled
      // leaf's chip rides out with its wedge).
      syncChips();
      if (st.labelsOn) {
        for (const t of st.keyTargets) {
          const el = chipNodes.get(t.node);
          if (!el) continue;
          const cur = t.node.current;
          const show = labelVisible(cur);
          const midA = (cur.x0 + cur.x1) / 2;
          const midR = ((cur.y0 + cur.y1) / 2) * RING;
          const pull = pulls.get(t.node) ?? 0;
          const [x, z] = polar(midA, midR + PULL * pull);
          v3.set(x, drumHeight + 3.5, z).project(camera);
          const sx = (v3.x * 0.5 + 0.5) * mount.clientWidth;
          const sy = (-v3.y * 0.5 + 0.5) * mount.clientHeight;
          el.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
          el.style.opacity = show ? "1" : "0";
          el.style.pointerEvents = show ? "auto" : "none";
          el.classList.toggle("sel", t.node === st.targetNode || t.node === st.openNode);
        }
      }

      // The information card at the pulled-out wedge.
      const open = st.openNode;
      const info = st.openInfo;
      if (open && info) {
        const key = `${info.name}|${info.value}`;
        if (key !== infoKey) {
          infoKey = key;
          infoEl.innerHTML =
            `<div class="nm">${info.name}</div>` +
            `<div class="path">${info.path}</div>` +
            `<div><span class="k">VALUE</span>  ${info.value}</div>` +
            `<div><span class="k">SHARE</span>  ${info.pctWhole}% of flare · ${info.pctParent}% of ${info.parentName}</div>` +
            `<div class="hint">F or D puts it back</div>`;
        }
        const t = pulls.get(open) ?? 0;
        if (t > 0.02) {
          const cur = open.current;
          const midA = (cur.x0 + cur.x1) / 2;
          const rOut = cur.y1 * RING + PULL * t + 2;
          const [x, z] = polar(midA, rOut);
          v3.set(x, drumHeight + 2, z).project(camera);
          const sx = (v3.x * 0.5 + 0.5) * mount.clientWidth;
          const sy = (-v3.y * 0.5 + 0.5) * mount.clientHeight;
          infoEl.style.display = "";
          infoEl.style.opacity = String(Math.min(1, t * 1.5));
          infoEl.style.transform = `translate(-50%, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        } else {
          infoEl.style.display = "none";
        }
      } else {
        infoEl.style.display = "none";
        infoKey = "";
      }

      // Project the compass letters (fixed to the platter).
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
      centreRing.geometry.dispose();
      centreRing.material.dispose();
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
  }, [root, drumHeight, projection, drift]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
    </div>
  );
}
