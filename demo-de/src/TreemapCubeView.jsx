import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  descendants as treemapDescendants,
  treemapCubeFaces,
  treemapHouseColor,
  treemapPath,
} from "../NCTGraphite/packages/nctgraphite/src/treemap/NCTGraphiteTreemapLayout.ts";

/**
 * The treemap cube — TreemapCubeView.
 *
 * The current node's children are spread across the five open
 * faces of a cube (the bottom rests on the platter): the layout
 * module cuts them into five value-balanced contiguous groups —
 * top, north, east, south, west — and binary-tiles each group on
 * its face. Every child is a labeled piece of the shell, a shallow
 * slab standing proud of a dark core; the cube is not solid, it is
 * the layer, as an object.
 *
 * Clicking a branch piece re-forms the cube: the old pieces sink
 * into the core and the clicked node's children grow out on every
 * face. Clicking a leaf slides its piece out of the cube along the
 * face, and the leaf's information card stands in space to the
 * side. Operation is the lab's bimodal one — letter keys target a
 * piece (the alphabet skips the operators D and F), F clicks,
 * D goes back. Camera: isometric by default, orbiting the cube's
 * centre above the platter.
 */

export const CUBE_S = 176;
export const PLATTER_R = 198;
const THICK = 6;
const GAP = 2.4;
const CUBE_CY = CUBE_S / 2; // cube centre height (bottom rests at 0)

/** Key-label alphabet: every letter except the operators D and F. */
export const LABEL_ALPHABET = "ABCEGHIJKLMNOPQRSTUVWXYZ";

export function labelForIndex(i) {
  const A = LABEL_ALPHABET;
  if (i < A.length) return A[i];
  const j = i - A.length;
  return A[Math.floor(j / A.length)] + A[j % A.length];
}

const FACE_NORMAL = {
  top: new THREE.Vector3(0, 1, 0),
  north: new THREE.Vector3(0, 0, -1),
  east: new THREE.Vector3(1, 0, 0),
  south: new THREE.Vector3(0, 0, 1),
  west: new THREE.Vector3(-1, 0, 0),
};

/** World placement of a face piece: centre position + box scale. */
function piecePlacement(face, rect) {
  const S = CUBE_S;
  const uc = (rect.x0 + rect.x1) / 2;
  const vc = (rect.y0 + rect.y1) / 2;
  const w = Math.max(0.6, (rect.x1 - rect.x0) * S - GAP);
  const d = Math.max(0.6, (rect.y1 - rect.y0) * S - GAP);
  const y = (0.5 - vc) * S + CUBE_CY;
  switch (face) {
    case "top":
      return { pos: [(uc - 0.5) * S, S, (vc - 0.5) * S], scale: [w, THICK, d] };
    case "north":
      return { pos: [(uc - 0.5) * S, y, -S / 2], scale: [w, d, THICK] };
    case "south":
      return { pos: [(0.5 - uc) * S, y, S / 2], scale: [w, d, THICK] };
    case "east":
      return { pos: [S / 2, y, (0.5 - uc) * S], scale: [THICK, d, w] };
    case "west":
      return { pos: [-S / 2, y, (uc - 0.5) * S], scale: [THICK, d, w] };
    default:
      return { pos: [0, CUBE_CY, 0], scale: [w, THICK, d] };
  }
}

/**
 * The addressable pieces under a focus: big enough to carry a chip,
 * in distribution order (face order, then reading order on the
 * face), each with its key label. Shared by view and app.
 */
export function cubeAddresses(focus) {
  return treemapCubeFaces(focus)
    .filter(({ rect }) => (rect.x1 - rect.x0) * CUBE_S >= 13 && (rect.y1 - rect.y0) * CUBE_S >= 9)
    .map((piece, i) => ({ ...piece, label: labelForIndex(i) }));
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fmt = (v) => Math.round(v).toLocaleString("en-US");

export default function TreemapCubeView({
  root,
  focusNode,
  targetNode,
  openLeaf,
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
    focusNode, targetNode, openLeaf, rotation, elevation,
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
    const orthoHalf = 216;
    const ortho = new THREE.OrthographicCamera(
      -orthoHalf * (width / height), orthoHalf * (width / height),
      orthoHalf, -orthoHalf, -500, 3000,
    );
    let camera = projection === "iso" ? ortho : persp;

    scene.add(new THREE.HemisphereLight(0xdfeeea, 0x1a2226, 1.05));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(180, 340, 220);
    scene.add(sun);
    const rimLight = new THREE.DirectionalLight(0x7fd4c1, 0.45);
    rimLight.position.set(-240, 90, -260);
    scene.add(rimLight);

    // Ground + platter (the cube rests on it).
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(900, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0d1113, roughness: 1 }),
    );
    ground.position.set(0, -3.6, 0);
    scene.add(ground);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(PLATTER_R, PLATTER_R + 7, 3, 96),
      new THREE.MeshStandardMaterial({ color: 0x12181c, roughness: 0.85 }),
    );
    disc.position.y = -1.55;
    scene.add(disc);
    {
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * PLATTER_R, 0, Math.sin(a) * PLATTER_R));
      }
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x3a4a52 }),
      ));
    }

    // The cube's dark core, and a faint full-cube edge to hold the form.
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const core = new THREE.Mesh(
      unitBox,
      new THREE.MeshStandardMaterial({ color: 0x11171b, roughness: 0.95 }),
    );
    core.scale.set(CUBE_S - 3, CUBE_S - 3, CUBE_S - 3);
    core.position.set(0, CUBE_CY, 0);
    core.userData.isCore = true;
    scene.add(core);
    const cubeEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_S + 1, CUBE_S + 1, CUBE_S + 1)),
      new THREE.LineBasicMaterial({ color: 0x3f5058, transparent: true, opacity: 0.6 }),
    );
    cubeEdges.position.set(0, CUBE_CY, 0);
    scene.add(cubeEdges);

    const boundsBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x7fd4c1, transparent: true, opacity: 0.55 }),
    );
    boundsBox.scale.set(CUBE_S + 18, CUBE_S + 18, CUBE_S + 18);
    boundsBox.position.set(0, CUBE_CY, 0);
    scene.add(boundsBox);

    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0xffa726 }),
    );
    outline.visible = false;
    scene.add(outline);

    // DOM overlays.
    const all = treemapDescendants(root);
    const chipEls = new Map();
    const nameEls = new Map();
    for (const node of all) {
      const chip = document.createElement("button");
      chip.className = "tc-chip";
      chip.addEventListener("click", () => stateRef.current.onTarget(node));
      labelsEl.appendChild(chip);
      chipEls.set(node, chip);
      const nm = document.createElement("div");
      nm.className = "tc-name";
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
      el.className = "tc-compass";
      el.textContent = t;
      if (t === "N") { el.style.color = "#ffa726"; el.style.fontWeight = "bold"; }
      labelsEl.appendChild(el);
      return { el, x, z };
    });
    const infoEl = document.createElement("div");
    infoEl.className = "tc-info";
    infoEl.style.display = "none";
    labelsEl.appendChild(infoEl);

    // Piece sets: current layer + exiting layer.
    const pieceMat = (node) => {
      const c = new THREE.Color(treemapHouseColor(root, node));
      if (node.children.length) c.multiplyScalar(0.52);
      return new THREE.MeshStandardMaterial({
        color: c, roughness: 0.6, metalness: 0.08, transparent: true,
      });
    };
    let curSet = new Map(); // node -> {mesh, piece, basePos, normal}
    let exiting = []; // {mesh, t0, basePos, normal}
    let curFocus = null;
    let bornAt = 0;
    let addressMap = new Map();

    const buildSet = (focus) => {
      const set = new Map();
      for (const piece of treemapCubeFaces(focus)) {
        const mesh = new THREE.Mesh(unitBox, pieceMat(piece.node));
        const { pos, scale } = piecePlacement(piece.face, piece.rect);
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.scale.set(scale[0], scale[1], scale[2]);
        mesh.userData.node = piece.node;
        mesh.userData.baseScale = scale;
        scene.add(mesh);
        set.set(piece.node, {
          mesh, piece,
          basePos: new THREE.Vector3(pos[0], pos[1], pos[2]),
          normal: FACE_NORMAL[piece.face],
        });
      }
      addressMap = new Map(cubeAddresses(focus).map((a) => [a.node, a.label]));
      return set;
    };

    // Picking.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = null;
    const pick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([core, ...[...curSet.values()].map((p) => p.mesh)], false);
      return hits[0]?.object ?? null;
    };
    const onDown = (e) => { downAt = [e.clientX, e.clientY]; };
    const onUpHandler = (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
      downAt = null;
      if (moved > 5) return;
      const hit = pick(e);
      if (!hit) return;
      if (hit.userData.isCore) stateRef.current.onUp();
      else if (hit.userData.node) stateRef.current.onNodeClick(hit.userData.node);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUpHandler);

    let raf = 0;
    let sway = 0;
    let pullRise = 0;
    let pullNode = null;
    const v3 = new THREE.Vector3();
    const project = (x, y, z) => {
      v3.set(x, y, z).project(camera);
      return [
        (v3.x * 0.5 + 0.5) * mount.clientWidth,
        (-v3.y * 0.5 + 0.5) * mount.clientHeight,
      ];
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const st = stateRef.current;
      camera = projection === "iso" ? ortho : persp;
      const now = performance.now();

      // A new focus re-forms the cube.
      if (st.focusNode !== curFocus) {
        for (const { mesh, basePos, normal } of curSet.values()) {
          exiting.push({ mesh, t0: now, basePos, normal });
        }
        curSet = buildSet(st.focusNode);
        curFocus = st.focusNode;
        bornAt = now;
      }
      const grow = easeOut(clamp01((now - bornAt) / 550));

      // Pull-out rise for the opened leaf.
      if (st.openLeaf) pullNode = st.openLeaf;
      pullRise += ((st.openLeaf ? 1 : 0) - pullRise) * 0.13;
      if (pullRise < 0.01 && !st.openLeaf) pullNode = null;

      // Camera: orbit the cube's centre.
      if (drift) sway += 0.0006;
      const rot = THREE.MathUtils.degToRad(st.rotation ?? 0) + Math.sin(sway) * 0.05;
      const tilt = THREE.MathUtils.degToRad(st.elevation ?? 0);
      if (camera === persp) {
        const radius = 505;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(215, 455) + tilt));
        camera.position.set(
          Math.sin(rot) * Math.cos(elev) * radius,
          CUBE_CY + Math.sin(elev) * radius,
          Math.cos(rot) * Math.cos(elev) * radius,
        );
        camera.lookAt(0, CUBE_CY, 0);
      } else {
        const radius = 1000;
        const elev = Math.max(0.08, Math.min(1.3, Math.atan2(574, 790) + tilt));
        const az = Math.PI / 4 + rot;
        camera.position.set(
          Math.sin(az) * Math.cos(elev) * radius,
          CUBE_CY + Math.sin(elev) * radius,
          Math.cos(az) * Math.cos(elev) * radius,
        );
        camera.lookAt(0, CUBE_CY, 0);
        camera.zoom = 1.0;
        camera.updateProjectionMatrix();
      }
      boundsBox.visible = Boolean(st.boundsOn);

      // Current pieces: grow out of the core as they form; the
      // opened leaf's piece slides further out along its normal.
      for (const { mesh, basePos, normal } of curSet.values()) {
        const node = mesh.userData.node;
        const pull = node === pullNode ? easeOut(pullRise) * 17 : 0;
        const out = -7 * (1 - grow) + pull;
        mesh.position.set(
          basePos.x + normal.x * out,
          basePos.y + normal.y * out,
          basePos.z + normal.z * out,
        );
        const [sx, sy, sz] = mesh.userData.baseScale;
        const f = 0.35 + 0.65 * grow;
        mesh.scale.set(sx * (normal.x ? 1 : f), sy * (normal.y ? 1 : f), sz * (normal.z ? 1 : f));
        mesh.material.opacity = grow;
      }
      // Exiting pieces sink into the core and fade.
      exiting = exiting.filter(({ mesh, t0, basePos, normal }) => {
        const t = clamp01((now - t0) / 450);
        const e = easeInOut(t);
        mesh.position.set(
          basePos.x - normal.x * 10 * e,
          basePos.y - normal.y * 10 * e,
          basePos.z - normal.z * 10 * e,
        );
        mesh.material.opacity = 1 - e;
        if (t >= 1) {
          scene.remove(mesh);
          mesh.material.dispose();
          return false;
        }
        return true;
      });

      // Target outline.
      const tgt = st.targetNode;
      const tgtEntry = tgt ? curSet.get(tgt) : null;
      if (tgtEntry) {
        outline.visible = true;
        outline.position.copy(tgtEntry.mesh.position);
        const s = tgtEntry.mesh.scale;
        outline.scale.set(s.x + 1.2, s.y + 1.2, s.z + 1.2);
      } else {
        outline.visible = false;
      }

      // Info card in space to the side of the pulled-out piece.
      const openEntry = pullNode ? curSet.get(pullNode) : null;
      if (openEntry && pullRise > 0.05) {
        const leaf = pullNode;
        const c = openEntry.basePos.clone().addScaledVector(openEntry.normal, CUBE_S * 0.52);
        infoEl.style.display = "";
        infoEl.innerHTML =
          `<b>${leaf.name}</b><br/>${fmt(leaf.value)} · ${(100 * leaf.value / root.value).toFixed(1)}% of flare` +
          `<br/><span>${treemapPath(leaf)}</span>`;
        const [sx, sy] = project(c.x, c.y, c.z);
        infoEl.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        infoEl.style.opacity = String(Math.min(1, pullRise * 1.4));
      } else {
        infoEl.style.display = "none";
      }

      // Chips + names.
      const show = st.labelsOn;
      for (const node of all) {
        const chip = chipEls.get(node);
        const nm = nameEls.get(node);
        const entry = curSet.get(node);
        const label = addressMap.get(node);
        if (!show || !entry || !label || grow < 0.6) {
          chip.style.display = "none";
          nm.style.display = "none";
          continue;
        }
        const p = entry.mesh.position;
        const [sx, sy] = project(p.x, p.y, p.z);
        chip.style.display = "";
        chip.textContent = label;
        chip.classList.toggle("target", st.targetNode === node);
        chip.style.transform = `translate(-50%, -140%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
        const { rect } = entry.piece;
        if ((rect.x1 - rect.x0) * CUBE_S >= 34 && (rect.y1 - rect.y0) * CUBE_S >= 20) {
          nm.style.display = "";
          nm.style.transform = `translate(-50%, 25%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
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
