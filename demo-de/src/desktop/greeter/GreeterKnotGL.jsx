/* NCT-WL-COMPOSITOR — the greeter clock's cinquefoil as a real
 * WebGL 3D knot (user, 2026-11-25): a three.js tube swept along
 * the same (5, 2) torus-knot curve the canvas backdrop draws
 * (ui-space/src/knots.js), lit and turning in space behind the
 * greeter clock. This is the clock knot's "webgl" presentation
 * view; the 2D canvas projection (GreeterKnot.jsx's
 * CinquefoilBackdrop) is kept as the "canvas" view — the choice
 * is settings.greeter.clockKnotView, set in Settings → Desktop.
 * Loaded lazily by Login.jsx so three.js is not in the
 * greeter's first paint; the canvas view shows while it loads
 * and remains the fallback if WebGL is unavailable. */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { torusKnotPoint, KNOT_FORMS } from "../../../ui-space/src/knots.js";

export default function CinquefoilWebGL() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch (e) {
      return undefined; // no WebGL: the caller's fallback stands
    }
    const size = canvas.clientWidth || 360;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 10.4);

    const f = KNOT_FORMS.cinquefoil;
    const pts = [];
    const N = 220;
    for (let i = 0; i < N; i++) {
      const [x, y, z] = torusKnotPoint(f.p, f.q, (i / N) * Math.PI * 2);
      pts.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const geo = new THREE.TubeGeometry(curve, 400, 0.17, 14, true);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x93a894, roughness: 0.34, metalness: 0.55,
    });
    const knot = new THREE.Mesh(geo, mat);
    // Two nested groups so the rotations compose like the
    // canvas view: the INNER group yaws about the torus axis
    // (its own Z), the OUTER tilts that axis toward the viewer.
    // A single Euler group lets the axis swing into the view
    // plane once per turn, where the ring collapses edge-on.
    const spin = new THREE.Group();
    spin.add(knot);
    const group = new THREE.Group();
    group.add(spin);
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xbcc8bc, 0.55));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.4);
    key.position.set(4, 6, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fa0c8, 1.1);
    rim.position.set(-6, -3, -5);
    scene.add(rim);

    let raf = 0, stopped = false;
    const t0 = performance.now();
    function draw(now) {
      if (stopped) return;
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      const t = (now - t0) / 1000;
      // The same motion language as the canvas view and the
      // medallion: a steady turn at 0.16 rad/s with the tilt
      // breathing, so the silhouette turns too.
      spin.rotation.z = t * 0.16;
      group.rotation.x = 0.58 + Math.sin(t * 0.05) * 0.16;
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} className="knot-backdrop" data-clock-knot="cinquefoil-webgl" aria-hidden="true" />;
}
