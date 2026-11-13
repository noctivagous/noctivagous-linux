import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PanelizationSimulation } from "../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphitePanelization.ts";
import {
  createDemoSheetSurface,
  createFlatSheetSurface,
} from "../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphiteNurbsSurface.ts";
import { vLen } from "../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphiteVec3.ts";
import { groupToTree } from "../NCTGraphite/packages/nctgraphite/src/datatree/NCTGraphiteDataTree.ts";

/**
 * Live three.js view of the iGeo panelization port (tutorial 59).
 *
 * Config splits into structural parameters (a Surface value wired
 * in from upstream, divisions, swarm count, seed — changing them
 * rebuilds the simulation, Grasshopper's re-solve) and live
 * parameters (reach, decay, attractor position — applied to the
 * running simulation between steps).
 * `onStats` receives { step, panels, pushed, meanDir, tree } a few
 * times per second for wire readouts; `tree` is a DataTree of
 * per-panel |dir| values, one branch per panel row.
 */
export default function PanelizationView({ config = {}, onStats } = {}) {
  const {
    surface = null,
    surfaceKey = "",
    surfaceKind = "arch",
    arch = 1,
    udiv = 70,
    vdiv = 20,
    swarmCount = 50,
    reach = 10,
    decay = 0.95,
    running = true,
    attractor = null,
    seed = 7,
    height = 440,
  } = config;

  const mountRef = useRef(null);
  const simRef = useRef(null);
  const liveRef = useRef({ reach, decay, running, attractor });
  liveRef.current = { reach, decay, running, attractor };
  const statsRef = useRef(onStats);
  statsRef.current = onStats;
  const vdivRef = useRef(vdiv);
  vdivRef.current = vdiv;

  const structuralKey = [
    surface ? surfaceKey : `${surfaceKind}|${arch}`,
    udiv,
    vdiv,
    swarmCount,
    seed,
  ].join("|");
  const structuralRef = useRef(structuralKey);
  structuralRef.current = structuralKey;
  const makeSimRef = useRef(() => null);
  makeSimRef.current = () => {
    const simSurface =
      surface ??
      (surfaceKind === "flat" ? createFlatSheetSurface() : createDemoSheetSurface(arch));
    const sim = new PanelizationSimulation({
      surface: simSurface,
      udiv,
      vdiv,
      swarmCount,
      panelReachDist: liveRef.current.reach,
      dirDecay: liveRef.current.decay,
      seed,
    });
    for (let i = 0; i < 40; i++) sim.step();
    return sim;
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    simRef.current = makeSimRef.current();
    let builtKey = structuralRef.current;

    const width = mount.clientWidth || 960;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04080a);
    scene.fog = new THREE.Fog(0x04080a, 320, 640);

    const camera = new THREE.PerspectiveCamera(38, width / height, 1, 2000);
    camera.position.set(100, 150, 190);
    camera.lookAt(100, 0, 30);

    let geometry = null;
    let panels = null;
    let wire = null;
    const installMesh = (meshData) => {
      if (panels) {
        scene.remove(panels);
        scene.remove(wire);
        geometry.dispose();
        wire.geometry.dispose();
      }
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(meshData.positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(meshData.colors, 3));
      geometry.setIndex(meshData.indices);
      panels = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      );
      wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x0e2a30, transparent: true, opacity: 0.55 }),
      );
      scene.add(panels);
      scene.add(wire);
    };
    installMesh(simRef.current.mesh());

    const boidGeo = new THREE.BufferGeometry();
    boidGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(simRef.current.boids.length * 3), 3),
    );
    const boidPts = new THREE.Points(
      boidGeo,
      new THREE.PointsMaterial({ color: 0xffa726, size: 2.4, sizeAttenuation: true }),
    );
    scene.add(boidPts);

    let raf = 0;
    let frame = 0;
    let disposed = false;
    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      frame++;
      if (structuralRef.current !== builtKey) {
        builtKey = structuralRef.current;
        simRef.current = makeSimRef.current();
        installMesh(simRef.current.mesh());
        boidGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(new Float32Array(simRef.current.boids.length * 3), 3),
        );
      }
      const sim = simRef.current;
      sim.panelReachDist = liveRef.current.reach;
      sim.dirDecay = liveRef.current.decay;
      const att = liveRef.current.attractor;
      if (att && sim.attractors.length > 0) {
        sim.attractors[0].pos = sim.surface.pointAt(att.u, att.v);
      }
      if (liveRef.current.running) {
        sim.step();
        sim.step();
      }
      if (frame % 2 === 0) {
        camera.position.x = 100 + Math.sin(frame * 0.0022) * 26;
        camera.position.z = 190 + Math.cos(frame * 0.0017) * 14;
        camera.lookAt(100, 0, 30);
      }
      const m = sim.mesh();
      if (m.positions.length !== geometry.attributes.position.array.length) {
        installMesh(m);
      } else {
        geometry.attributes.position.array.set(m.positions);
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.array.set(m.colors);
        geometry.attributes.color.needsUpdate = true;
        wire.geometry.dispose();
        wire.geometry = new THREE.WireframeGeometry(geometry);
      }
      const bp = boidGeo.attributes.position.array;
      sim.boids.forEach((b, i) => {
        bp[i * 3] = b.pos.x;
        bp[i * 3 + 1] = b.pos.y;
        bp[i * 3 + 2] = b.pos.z;
      });
      boidGeo.attributes.position.needsUpdate = true;
      if (statsRef.current && frame % 20 === 0) {
        let pushed = 0;
        let sum = 0;
        for (const p of sim.panels) {
          const d = vLen(p.dir);
          sum += d;
          if (d > 0.05) pushed++;
        }
        // The MESH output as a data tree: one branch per panel row,
        // values are per-panel |dir| (see NCTGraphiteDataTree).
        const tree = groupToTree(sim.panels, (p) => [
          Math.round(p.nodes[0].v * vdivRef.current),
        ]);
        statsRef.current({
          step: sim.stepCount,
          panels: sim.panels.length,
          pushed,
          meanDir: sim.panels.length ? sum / sim.panels.length : 0,
          tree: {
            branches: tree.branches.map((b) => ({
              path: [...b.path],
              values: b.items.map((p) => Math.round(vLen(p.dir) * 1000) / 1000),
            })),
          },
        });
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      if (geometry) geometry.dispose();
      boidGeo.dispose();
      mount.removeChild(renderer.domElement);
    };
    // One scene for the component's lifetime; structural changes are
    // picked up inside the loop via structuralRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height }} />;
}
