/* NCT-WL-COMPOSITOR — the greeter medallion: one of UI Space's
 * torus knots (the Stemkoski parametrization in
 * ui-space/src/knots.js — the project's own knot lib), drawn as
 * a depth-shaded tube on a small canvas and turning slowly in
 * the circle where the profile initial used to sit. Pure 2D
 * canvas on purpose: the greeter is compositor furniture and
 * should not need a WebGL context to say hello. See
 * WAYLAND-MAP.md. */
import { useEffect, useRef } from "react";
import { torusKnotPoint, KNOT_FORMS } from "../../../ui-space/src/knots.js";

const N = 240; // samples around the curve

export default function GreeterKnot({ form, speed }) {
  const canvasRef = useRef(null);
  const cfgRef = useRef({ form, speed });
  cfgRef.current = { form, speed };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    let raf = 0;
    let stopped = false;
    const t0 = performance.now();

    function draw(now) {
      if (stopped) return;
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      const size = canvas.clientWidth;
      if (!size) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(size * dpr);
      if (canvas.width !== W) canvas.width = canvas.height = W;
      const f = KNOT_FORMS[cfgRef.current.form] || KNOT_FORMS.trefoil;
      const rate = cfgRef.current.speed != null ? cfgRef.current.speed : 1;
      const t = (now - t0) / 1000;
      const yaw = t * 0.16 * rate; // ~40 s per turn at 1x — a medallion, not a fan
      const pitch = 0.92 + Math.sin(t * 0.11) * 0.07; // near-still tilt, breathing a little

      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const pts = [];
      for (let i = 0; i < N; i++) {
        const [x, y, z] = torusKnotPoint(f.p, f.q, (i / N) * Math.PI * 2);
        const X = x * cy - y * sy, Y = x * sy + y * cy; // yaw around the torus axis
        pts.push([X, Y * cp - z * sp, Y * sp + z * cp]); // then pitch toward the viewer
      }
      const segs = [];
      for (let i = 0; i < N; i++) {
        const a = pts[i], b = pts[(i + 1) % N];
        segs.push({ a, b, z: (a[2] + b[2]) / 2 });
      }
      segs.sort((m, n) => m.z - n.z); // far first

      const C = W / 2, scale = W / 8.6, tube = W * 0.05;
      ctx.clearRect(0, 0, W, W);
      ctx.lineCap = "round";
      for (const s of segs) {
        const d = Math.max(0, Math.min(1, (s.z + 3.1) / 6.2)); // 0 far .. 1 near
        // Sage-steel by depth, warming to a faint gold at the front.
        let r = 34 + d * 150, g = 40 + d * 158, b = 36 + d * 138;
        if (d > 0.8) { const k = (d - 0.8) * 1.6; r += (216 - r) * k * 0.35; g += (188 - g) * k * 0.35; b += (118 - b) * k * 0.35; }
        ctx.strokeStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
        ctx.lineWidth = tube * (0.8 + d * 0.4);
        ctx.beginPath();
        ctx.moveTo(C + s.a[0] * scale, C - s.a[1] * scale);
        ctx.lineTo(C + s.b[0] * scale, C - s.b[1] * scale);
        ctx.stroke();
      }
    }
    raf = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, []);

  return <canvas ref={canvasRef} className="knot-canvas" aria-hidden="true" />;
}

/* The cinquefoil backdrop (user, 2026-11-25): the (5, 2) torus
 * knot — the cinquefoil from UI Space's knot gallery — turning
 * slowly as a BACKGROUND behind a text area (the greeter
 * clock). Same depth-shaded tube technique as the medallion,
 * dimmed further and drawn on a square canvas the caller
 * positions absolutely behind its text; the text itself is
 * not restructured in any way. */
export function CinquefoilBackdrop() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    let raf = 0, stopped = false;
    const t0 = performance.now();
    const f = KNOT_FORMS.cinquefoil;
    const N = 240;
    function draw(now) {
      if (stopped) return;
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      const size = canvas.clientWidth;
      if (!size) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.round(size * dpr);
      if (canvas.width !== W) canvas.width = canvas.height = W;
      const t = (now - t0) / 1000;
      const yaw = t * 0.06; // slow: about 105 s per turn
      const pitch = 0.92 + Math.sin(t * 0.09) * 0.06;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const pts = [];
      for (let i = 0; i < N; i++) {
        const [x, y, z] = torusKnotPoint(f.p, f.q, (i / N) * Math.PI * 2);
        const X = x * cy - y * sy, Y = x * sy + y * cy;
        pts.push([X, Y * cp - z * sp, Y * sp + z * cp]);
      }
      const segs = [];
      for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % N]; segs.push({ a, b, z: (a[2] + b[2]) / 2 }); }
      segs.sort((m, n) => m.z - n.z);
      const C = W / 2, scale = W / 8.6, tube = W * 0.042;
      ctx.clearRect(0, 0, W, W);
      ctx.lineCap = "round";
      for (const sg of segs) {
        const d = Math.max(0, Math.min(1, (sg.z + 3.1) / 6.2));
        const r = Math.round((30 + d * 120) * 0.6), g = Math.round((36 + d * 128) * 0.6), b = Math.round((32 + d * 110) * 0.6);
        ctx.strokeStyle = "rgb(" + r + "," + g + "," + b + ")";
        ctx.lineWidth = tube * (0.8 + d * 0.4);
        ctx.beginPath();
        ctx.moveTo(C + sg.a[0] * scale, C - sg.a[1] * scale);
        ctx.lineTo(C + sg.b[0] * scale, C - sg.b[1] * scale);
        ctx.stroke();
      }
    }
    raf = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className="knot-backdrop" data-clock-knot="cinquefoil" aria-hidden="true" />;
}
