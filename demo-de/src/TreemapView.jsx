import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  descendants as treemapDescendants,
  zoomTargets as treemapZoomTargets,
  treemapHouseColor,
  treemapPath,
} from "../NCTGraphite/packages/nctgraphite/src/treemap/NCTGraphiteTreemapLayout.ts";

/**
 * The zoomable treemap in 3D — TreemapView.
 *
 * The treemap's square lies on the lab's circular platter, lettered
 * with the four directions. Every branch under the focus node is a
 * shallow tray; every leaf is a cuboid standing in its tray, its
 * footprint the treemap rect, its colour its house's. A zoom
 * re-maps the whole tree through the focus node's frame (the
 * layout module's zoomTargets) and the cuboids fly to their new
 * rects over the original's 750 ms.
 *
 * Operation is bimodal, ground-up: every addressable node wears a
 * key chip. Letter keys TARGET a node (the alphabet skips D and F —
 * they are operators, not addresses); F is the click — on a branch
 * it opens the node up (descends), on a leaf it brings the leaf's
 * portion OUT of the cuboid as a rising drawer with a glyph on top
 * and its information card in 3D space beside it. D goes back:
 * retract the drawer, or climb to the parent — the original's
 * header-band click, given a key. The camera defaults to
 * isometric and orbits the platter's centre, as on the horizon
 * platter.
 */

export const MAP_W = 264;
export const MAP_H = 240;
export const PLATTER_R = 198;
const STEP = 1.4; // tray thickness per depth level
const GAP = 1.7; // world-unit gap between sibling cuboids

/** Key-label alphabet: every letter except the operators D and F. */
export const LABEL_ALPHABET = "ABCEGHIJKLMNOPQRSTUVWXYZ";

export function labelForIndex(i) {
  const A = LABEL_ALPHABET;
  if (i < A.length) return A[i];
  const j = i - A.length;
  return A[Math.floor(j / A.length)] + A[j % A.length];
}

/** World size of a rect (in the focus frame). */
function worldSize(r) {
  return { w: (r.x1 - r.x0) * MAP_W, d: (r.y1 - r.y0) * MAP_H };
}

function intersectsFrame(r) {
  return r.x1 > 0 && r.x0 < 1 && r.y1 > 0 && r.y0 < 1;
}

/**
 * The addressable nodes under a focus: descendants (not the focus
 * itself) whose target rect is big enough to carry a chip, in
 * reading order (top-to-bottom, left-to-right in the target frame),
 * each with its key label. Shared by the view (chips) and the app
 * (key handling) so both always agree on the addresses.
 */
export function labeledNodes(focus) {
  const nodes = treemapDescendants(focus)
    .filter((n) => n !== focus)
    .filter((n) => {
      if (!intersectsFrame(n.target)) return false;
      const { w, d } = worldSize(n.target);
      return w >= 7 && d >= 5;
    })
    .sort((a, b) => a.target.y0 - b.target.y0 || a.target.x0 - b.target.x0);
  return nodes.map((node, i) => ({ node, label: labelForIndex(i) }));
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fmt = (v) => Math.round(v).toLocaleString("en-US");

export default function TreemapView({
  root,
  focusNode,
  targetNode,
  openLeaf,
  leafH,
  projection,
  rotation,
  elevation,
  boundsOn,
  drift,
  labelsOn,
  onTarget,
  onNodeClick,
  onUp,
}) {
  const mountRef = useRef(null);
  const labelsRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = {
    focusNode, targetNode, openLeaf, leafH, rotation, elevation,
    boundsOn, labelsOn, onTarget, onNodeClick, onUp,
  };

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
    const orthoHalf = 208;
    const ortho = new THREE.OrthographicCamera(
      -orthoHalf * (width / height), orthoHalf * (width / height),
      orthoHalf, -orthoHalf, -500, 3000,
    );
    let camera = projection === "iso" ? ortho : persp;

    scene.add(new THREE.HemisphereLight(0xdfeeea, 0x1a2226, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(180, 320, 220);
    scene.add(sun);
    const rimLight = new THREE.DirectionalLight(0x7fd4c1, 0.45);
    rimLight.position.set(-240, 90, -260);
    scene.add(rimLight);

    // Ground and the circular platter (as on the horizon platter).
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
    disc.position.y = -1.55; // top face at −0.05
    platter.add(disc);
    {
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * PLATTER_R, 0, Math.sin(a) * PLATTER_R));
      }
      platter.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x3a4a52 }),
      ));
    }

    // Bounding-box wireframe of the map volume.
    const boundsBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x7fd4c1, transparent: true, opacity: 0.55 }),
    );
    scene.add(boundsBox);

    // Materials: one per house colour, leaf and tray shades.
    const leafMats = new Map();
    const trayMats = new Map();
    const matFor = (node, tray) => {
      const hex = treemapHouseColor(root, node);
      const cache = tray ? trayMats : leafMats;
      if (!cache.has(hex)) {
        const c = new THREE.Color(hex);
        if (tray) c.multiplyScalar(0.38);
        cache.set(hex, new THREE.MeshStandardMaterial({
          color: c, roughness: tray ? 0.9 : 0.55, metalness: 0.06, transparent: true,
        }));
      }
      return cache.get(hex);
    };
    const focusTrayMat = new THREE.MeshStandardMaterial({
      color: 0x27313a, roughness: 0.9, transparent: true,
    });

    // One unit-box mesh per node: trays for branches, cuboids for leaves.
    const all = treemapDescendants(root);
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const meshes = new Map();
    for (const node of all) {
      const isLeaf = node.children.length === 0;
      const mesh = new THREE.Mesh(unitBox, isLeaf ? matFor(node, false) : matFor(node, true));
      mesh.userData.node = node;
      mesh.visible = false;
      scene.add(mesh);
      meshes.set(node, mesh);
    }

    // Target outline.
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0xffa726 }),
    );
    outline.visible = false;
    scene.add(outline);

    // The drawer: a prism that rises out of an opened leaf's cuboid,
    // crowned by a slowly turning glyph. Its information card is a
    // DOM element projected at the glyph.
    const drawerMat = new THREE.MeshStandardMaterial({
      color: 0xd8e4ea, roughness: 0.35, metalness: 0.15, transparent: true,
    });
    const drawer = new THREE.Mesh(unitBox, drawerMat);
    drawer.visible = false;
    scene.add(drawer);
    const glyph = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffa726, emissive: 0xcc7a00, emissiveIntensity: 0.55, roughness: 0.3,
      }),
    );
    glyph.visible = false;
    scene.add(glyph);

    // DOM overlays: chips, name labels, compass, info card.
    const chipEls = new Map();
    const nameEls = new Map();
    for (const node of all) {
      const chip = document.createElement("button");
      chip.className = "tm-chip";
      chip.addEventListener("click", () => stateRef.current.onTarget(node));
      labelsEl.appendChild(chip);
      chipEls.set(node, chip);
      const nm = document.createElement("div");
      nm.className = "tm-name";
      nm.textContent = node.name;
      labelsEl.appendChild(nm);
      nameEls.set(node, nm);
    }
    const compassEls = [
      { t: "N", x: 0, z: -PLATTER_R + 17 },
      { t: "S", x: 0, z: PLATTER_R - 17 },
      { t: "W", x: -PLATTER_R + 17, z: 0 },
      { t: "E", x: PLATTER_R - 17, z: 0 },
    ].map(({ t, x, z }) => {
      const el = document.createElement("div");
      el.className = "tm-compass";
      el.textContent = t;
      if (t === "N") { el.style.color = "#ffa726"; el.style.fontWeight = "bold"; }
      labelsEl.appendChild(el);
      return { el, x, z };
    });
    const infoEl = document.createElement("div");
    infoEl.className = "tm-info";
    infoEl.style.display = "none";
    labelsEl.appendChild(infoEl);

    // Picking.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = null;
    const pick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...meshes.values()].filter((m) => m.visible), false);
      return hits[0]?.object?.userData.node ?? null;
    };
    const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
    const onUpHandler = (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
      downAt = null;
      if (moved > 5) return;
      const node = pick(e);
      if (!node) return;
      if (node === stateRef.current.focusNode) stateRef.current.onUp();
      else stateRef.current.onNodeClick(node);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUpHandler);

    // Animation state.
    let lastFocus = stateRef.current.focusNode;
    let anim = null; // { t0, from: Map<node, rect> }
    let drawerNode = null;
    let drawerRise = 0;
    let labelMap = new Map();
    let labelFocus = null;
    const refreshLabels = () => {
      labelMap = new Map(labeledNodes(lastFocus).map(({ node, label }) => [node, label]));
      labelFocus = lastFocus;
    };
    refreshLabels();

    let raf = 0;
    let sway = 0;
    const v3 = new THREE.Vector3();
    const project = (x, y, z) => {
      v3.set(x, y, z).project(camera);
      return [
        (v3.x * 0.5 + 0.5) * mount.clientWidth,
        (-v3.y * 0.5 + 0.5) * mount.clientHeight,
      ];
    };
    const rectWorld = (r) => ({
      cx: ((r.x0 + r.x1) / 2 - 0.5) * MAP_W,
      cz: ((r.y0 + r.y1) / 2 - 0.5) * MAP_H,
      w: (r.x1 - r.x0) * MAP_W,
      d: (r.y1 - r.y0) * MAP_H,
    });
    const trayTopY = (node) => (node.depth - lastFocus.depth + 1) * STEP;
    const baseY = (node) => (node.parent ? (node.parent.depth - lastFocus.depth + 1) * STEP : 0);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const st = stateRef.current;
      camera = projection === "iso" ? ortho : persp;

      // Zoom: a new focus re-maps every target; fly currents to them.
      if (st.focusNode !== lastFocus) {
        const from = new Map(all.map((n) => [n, { ...n.current }]));
        treemapZoomTargets(root, st.focusNode);
        anim = { t0: performance.now(), from };
        lastFocus = st.focusNode;
        refreshLabels();
      }
      if (anim) {
        const t = clamp01((performance.now() - anim.t0) / 750);
        const e = easeInOut(t);
        for (const n of all) {
          const f = anim.from.get(n);
          n.current = {
            x0: f.x0 + (n.target.x0 - f.x0) * e,
            y0: f.y0 + (n.target.y0 - f.y0) * e,
            x1: f.x1 + (n.target.x1 - f.x1) * e,
            y1: f.y1 + (n.target.y1 - f.y1) * e,
          };
        }
        if (t >= 1) anim = null;
      }
      if (labelFocus !== lastFocus) refreshLabels();

      // Drawer rise.
      const wantRise = st.openLeaf ? 1 : 0;
      if (st.openLeaf) drawerNode = st.openLeaf;
      drawerRise += (wantRise - drawerRise) * 0.12;
      if (drawerRise < 0.01 && !st.openLeaf) { drawerNode = null; drawerRise = 0; }

      // Camera: orbit the platter's centre.
      if (drift) sway += 0.0006;
      const swayA = Math.sin(sway) * 0.05;
      const rot = THREE.MathUtils.degToRad(st.rotation ?? 0) + swayA;
      const tilt = THREE.MathUtils.degToRad(st.elevation ?? 0);
      if (camera === persp) {
        const radius = 500;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(165, 506) + tilt));
        camera.position.set(
          Math.sin(rot) * Math.cos(elev) * radius,
          Math.sin(elev) * radius,
          Math.cos(rot) * Math.cos(elev) * radius,
        );
        camera.lookAt(0, 0, 0);
      } else {
        const radius = 1000;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(574, 790) + tilt));
        const az = Math.PI / 4 + rot;
        camera.position.set(
          Math.sin(az) * Math.cos(elev) * radius,
          Math.sin(elev) * radius,
          Math.cos(az) * Math.cos(elev) * radius,
        );
        camera.lookAt(0, 0, 0);
        camera.zoom = 1.0;
        camera.updateProjectionMatrix();
      }

      // Bounds.
      const boundsH = (root.height + 1) * STEP + st.leafH;
      boundsBox.visible = Boolean(st.boundsOn);
      boundsBox.scale.set(MAP_W, boundsH, MAP_H);
      boundsBox.position.y = boundsH / 2;

      // Place the nodes of the current focus subtree.
      const visibleSet = new Set(treemapDescendants(lastFocus));
      for (const node of all) {
        const mesh = meshes.get(node);
        if (!visibleSet.has(node) || !intersectsFrame(node.current)) {
          mesh.visible = false;
          continue;
        }
        const { cx, cz, w, d } = rectWorld(node.current);
        if (w < 0.4 || d < 0.4) { mesh.visible = false; continue; }
        mesh.visible = true;
        if (node.children.length === 0) {
          const base = baseY(node);
          mesh.position.set(cx, base + st.leafH / 2, cz);
          mesh.scale.set(Math.max(0.1, w - GAP), st.leafH, Math.max(0.1, d - GAP));
        } else {
          const top = trayTopY(node);
          mesh.material = node === lastFocus ? focusTrayMat : matFor(node, true);
          mesh.position.set(cx, top - STEP / 2, cz);
          mesh.scale.set(Math.max(0.1, w - 0.7), STEP, Math.max(0.1, d - 0.7));
        }
      }

      // Target outline + drawer.
      const tgt = st.targetNode;
      if (tgt && visibleSet.has(tgt)) {
        const { cx, cz, w, d } = rectWorld(tgt.current);
        const isLeaf = tgt.children.length === 0;
        const top = isLeaf ? baseY(tgt) + st.leafH : trayTopY(tgt);
        outline.visible = true;
        outline.position.set(cx, top + 0.4, cz);
        outline.scale.set(w + 0.8, 0.8, d + 0.8);
      } else {
        outline.visible = false;
      }
      if (drawerNode && drawerRise > 0.01 && visibleSet.has(drawerNode)) {
        const { cx, cz, w, d } = rectWorld(drawerNode.current);
        const base = baseY(drawerNode) + st.leafH;
        const h = 34 * easeOut(drawerRise);
        drawer.visible = true;
        drawer.position.set(cx, base + h / 2, cz);
        drawer.scale.set(Math.max(1.2, w * 0.55), Math.max(0.1, h), Math.max(1.2, d * 0.55));
        drawerMat.color.set(treemapHouseColor(root, drawerNode)).lerp(new THREE.Color(0xffffff), 0.3);
        const gr = Math.max(1.6, Math.min(w, d) * 0.16);
        glyph.visible = true;
        glyph.position.set(cx, base + h + gr + 3.5, cz);
        glyph.scale.setScalar(gr);
        glyph.rotation.y += 0.012;
        glyph.rotation.x += 0.004;
        // Info card in 3D space, beside the glyph.
        const leaf = drawerNode;
        infoEl.style.display = "";
        infoEl.innerHTML =
          `<b>${leaf.name}</b><br/>${fmt(leaf.value)} · ${(100 * leaf.value / root.value).toFixed(1)}% of flare` +
          `<br/><span>${treemapPath(leaf)}</span>`;
        const [sx, sy] = project(cx, base + h + gr + 3.5, cz);
        infoEl.style.transform = `translate(14px, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
      } else {
        drawer.visible = false;
        glyph.visible = false;
        infoEl.style.display = "none";
      }

      // Chips + names.
      const show = st.labelsOn;
      for (const node of all) {
        const chip = chipEls.get(node);
        const nm = nameEls.get(node);
        const label = labelMap.get(node);
        const mesh = meshes.get(node);
        if (!show || !label || !mesh.visible) {
          chip.style.display = "none";
          nm.style.display = "none";
          continue;
        }
        const { cx, cz, w, d } = rectWorld(node.current);
        const isLeaf = node.children.length === 0;
        const top = isLeaf ? baseY(node) + st.leafH : trayTopY(node);
        chip.style.display = "";
        chip.textContent = label;
        chip.classList.toggle("target", st.targetNode === node);
        const [sx, sy] = project(cx - w / 2 + 2.5, top + 3.5, cz - d / 2 + 2);
        chip.style.transform = `translate(0, -100%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        if (w >= 30 && d >= 15) {
          nm.style.display = "";
          const [nx, ny] = project(cx, top + 2.5, cz);
          nm.style.transform = `translate(-50%, -50%) translate(${nx.toFixed(1)}px, ${ny.toFixed(1)}px)`;
        } else {
          nm.style.display = "none";
        }
      }

      // Compass.
      for (const c of compassEls) {
        const [sx, sy] = project(c.x, 0.5, c.z);
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
      renderer.domElement.removeEventListener("pointerup", onUpHandler);
      scene.traverse((o) => {
        if (o.geometry && o.geometry !== unitBox) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      unitBox.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      labelsEl.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, projection, drift]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <div ref={labelsRef} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }} />
    </div>
  );
}
