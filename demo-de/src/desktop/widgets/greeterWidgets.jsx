/* NCT-WL-COMPOSITOR — greeter widgets are shell furniture (see
 * GreeterDashboard.jsx). These are the dashboard's animated
 * instruments: they render from the dashboard's own data table
 * and surface-level facts only.
 *
 * Part of the Widget System (src/desktop/widgets/): this file
 * holds the GREETER surface's widgets; the desktop surface's
 * widgets and the shared registry live in widgets.jsx, and
 * both surfaces draw from this one module.
 *
 * GreeterWidgets — the animated panels of the Greeter Dashboard.
 *
 *  WeatherAnim       the satellite loop: real GOES-18 ABI
 *                    GeoColor frames of the 2026-11-19
 *                    atmospheric river over California, sampled
 *                    from CIRA's SLIDER API into a 4×4 sprite
 *                    sheet and played frame by frame, with the
 *                    frame timestamp overlaid the way CIRA's own
 *                    loops carry it.
 *  SunburstProcesses a d3 partition laid out as an extruded,
 *                    slowly rotating sunburst: RAM by process
 *                    group, values breathing around their bases.
 *  VehicleMap        a dark street map with the tracked vehicle
 *                    travelling its route to Home.
 *  CamGrid           a 2×2 security-camera grid: synthetic line
 *                    scenes with grain, a light sweep, REC blink
 *                    and running timestamps.
 *  NetChart          a rolling d3 area/line chart of throughput.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, partition } from "d3-hierarchy";
import { area as d3area, line as d3line } from "d3-shape";
import { scaleLinear } from "d3-scale";
import ciraSprite from "../greeter/assets/cira-ar-loop.js";

/* One rAF loop per widget; the draw callback gets elapsed ms. */
function useAnim(draw) {
  const ref = useRef(draw);
  ref.current = draw;
  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const loop = (now) => {
      ref.current(now - t0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/* ---------------- Weather: the CIRA satellite loop ---------------- */

export function WeatherAnim({ loop }) {
  const cvRef = useRef(null);
  const stampRef = useRef(null);
  const imgRef = useRef(null);
  useEffect(() => {
    const im = new Image();
    im.src = ciraSprite;
    imgRef.current = im;
  }, []);
  useAnim((t) => {
    const cv = cvRef.current, im = imgRef.current;
    if (!cv || !im || !im.complete || !im.naturalWidth) return;
    const per = 550, total = per * loop.frames + 1100; // hold the last frame, like the source loop's cut back
    const f = Math.min(loop.frames - 1, Math.floor((t % total) / per));
    const ctx = cv.getContext("2d");
    ctx.drawImage(im, (f % 4) * 540, Math.floor(f / 4) * 208, 540, 208, 0, 0, 540, 208);
    if (stampRef.current) {
      const mins = loop.startMin + f * loop.stepMin;
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      stampRef.current.textContent = loop.date + " | " + hh + ":" + mm + " UTC | GOES-18 | ABI | GeoColor";
    }
  });
  return (
    <div className="gd-wxwrap">
      <canvas ref={cvRef} className="gd-anim gd-wx" width={540} height={208} data-anim="weather" />
      <span className="gd-wxstamp" ref={stampRef}></span>
      <span className="gd-wxcredit">CIRA · NOAA</span>
    </div>
  );
}

/* ---------------- System: the process sunburst ---------------- */

const GROUP_COLORS = ["#7d9bb5", "#93a97e", "#b59a5e", "#7186a0"];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return "rgb(" + r + "," + g + "," + b + ")";
}

function ring(ctx, cx, cy, r0, r1, a0, a1) {
  ctx.beginPath();
  ctx.arc(cx, cy, r1, a0, a1);
  ctx.arc(cx, cy, r0, a1, a0, true);
  ctx.closePath();
}

export function SunburstProcesses({ procs, ramTotal }) {
  const cvRef = useRef(null);
  const legendRef = useRef(null);
  const model = useMemo(() => {
    const data = { name: "root", children: procs };
    const root = hierarchy(data);
    const leaves = [];
    root.each((n) => { if (!n.children) leaves.push(n); });
    leaves.forEach((n, i) => { n.phase = i * 1.37; });
    return { root, leaves };
  }, [procs]);
  useAnim((t) => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const { root, leaves } = model;
    leaves.forEach((n) => {
      n.data.cur = n.data.mb * (1 + 0.13 * Math.sin(t / 900 + n.phase));
    });
    root.sum((d) => d.cur || 0);
    partition().size([Math.PI * 2, 56])(root);
    const cx = 300, cy = 132, rot = t * 0.000045;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const nodes = [];
    root.each((n) => { if (n.depth >= 1) nodes.push(n); });
    // Extruded sides first (offset copies), then the top faces.
    for (const pass of [0, 1]) {
      for (const n of nodes) {
        let gi = n;
        while (gi.depth > 1) gi = gi.parent;
        const base = GROUP_COLORS[procs.indexOf(gi.data)] || "#7d9bb5";
        const col = pass === 0 ? shade(base, 0.36) : (n.depth === 1 ? shade(base, 0.8) : shade(base, 1.05));
        ring(ctx, cx, cy + (pass === 0 ? 7 : 0), 30 + n.y0, 30 + n.y1 - 1.5, n.x0 + rot, n.x1 + rot);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
    /* Annotations (user, 2026-11-25): each process GROUP is
     * labelled on the chart itself with the common two-segment
     * leader line — one segment out from the ring, then a
     * horizontal segment — ending in the group's name and total.
     * Drawn on the same canvas pass, so the labels track the
     * ring's slow rotation instead of sitting in a static list. */
    const fmtMB = (v) => v >= 1024 ? (v / 1024).toFixed(1) + " GB" : Math.round(v) + " MB";
    /* Label size (user, 2026-11-25): the annotations and the
     * centre text must be READABLE at the panel's display size —
     * the canvas is drawn at 600px and shown at ~230px, so the
     * type is set large here (18px annotations, 40px centre)
     * to land at a legible size on screen. */
    ctx.font = "18px 'IBM Plex Mono', monospace";
    for (const n of nodes) {
      if (n.depth !== 1) continue;
      const a = (n.x0 + n.x1) / 2 + rot;
      const side = Math.cos(a) >= 0 ? 1 : -1;
      const p1x = cx + Math.cos(a) * 88, p1y = cy + Math.sin(a) * 88;
      const p2x = cx + Math.cos(a) * 110, p2y = cy + Math.sin(a) * 110;
      const p3x = p2x + side * 20;
      ctx.strokeStyle = "rgba(205,216,222,.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(p3x, p2y);
      ctx.stroke();
      ctx.fillStyle = "rgba(220,228,233,.9)";
      ctx.beginPath();
      ctx.arc(p1x, p1y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#cdd9df";
      ctx.textAlign = side > 0 ? "left" : "right";
      ctx.fillText(n.data.name + " " + fmtMB(n.value), p3x + side * 5, p2y + 6);
    }
    ctx.textAlign = "center";
    const used = leaves.reduce((a, n) => a + n.value, 0);
    ctx.fillStyle = "#d7e0e6";
    ctx.font = "600 40px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText((used / 1024).toFixed(1), cx, cy - 4);
    ctx.font = "14px 'IBM Plex Mono', monospace";
    const sub = "GB · " + Math.round((used / ramTotal) * 100) + "% RAM";
    const subW = ctx.measureText(sub).width;
    ctx.fillStyle = "rgba(6,10,14,.55)";
    ctx.beginPath();
    ctx.roundRect(cx - subW / 2 - 6, cy + 12, subW + 12, 19, 4);
    ctx.fill();
    ctx.fillStyle = "#a9bfcc";
    ctx.fillText(sub, cx, cy + 26);
    if (legendRef.current) {
      const top = [...leaves].sort((a, b) => b.value - a.value).slice(0, 3);
      legendRef.current.textContent =
        top.map((n) => n.data.name + " " + (n.value >= 1024 ? (n.value / 1024).toFixed(1) + " GB" : Math.round(n.value) + " MB")).join(" · ");
    }
  });
  return (
    <div>
      <canvas ref={cvRef} className="gd-anim gd-sun" width={600} height={264} data-anim="sunburst" />
      <div className="gd-legend" ref={legendRef}></div>
    </div>
  );
}

/* ---------------- Vehicle: the tracked-vehicle map ---------------- */

const STREETS = [
  "M0,26 H260", "M0,52 H260", "M0,84 H260", "M0,106 H260",
  "M28,0 V118", "M74,0 V118", "M122,0 V118", "M176,0 V118", "M224,0 V118",
  "M0,118 L96,0", "M150,118 L260,30",
];
const ROUTE = "M16,94 C58,86 82,62 126,59 C168,56 208,42 242,24";

export function VehicleMap() {
  const pathRef = useRef(null);
  const vehRef = useRef(null);
  const pulseRef = useRef(null);
  useAnim((t) => {
    const p = pathRef.current, v = vehRef.current, pu = pulseRef.current;
    if (!p || !v) return;
    const L = p.getTotalLength();
    const ph = (t % 30000) / 30000;
    const u = ph < 0.5 ? ph * 2 : 2 - ph * 2; // out and back
    const pt = p.getPointAtLength(u * L);
    v.setAttribute("transform", "translate(" + pt.x + "," + pt.y + ")");
    if (pu) {
      const r = 7 + 5 * (0.5 + 0.5 * Math.sin(t / 480));
      pu.setAttribute("r", r.toFixed(1));
      pu.setAttribute("opacity", (0.5 - 0.28 * (0.5 + 0.5 * Math.sin(t / 480))).toFixed(2));
    }
  });
  return (
    <svg className="gd-anim gd-map" viewBox="0 0 260 118" preserveAspectRatio="xMidYMid slice" data-anim="map" aria-hidden="true">
      <rect width="260" height="118" fill="#0a0f16" />
      <path d="M0,118 C40,96 30,74 62,58 L96,44 L92,118 Z" fill="#0d1a26" />
      <ellipse cx="212" cy="96" rx="30" ry="13" fill="#10200f" />
      {STREETS.map((d, i) => (
        <path key={i} d={d} stroke="#1c2938" strokeWidth={i % 4 === 0 ? 3 : 1.4} fill="none" />
      ))}
      <path d={ROUTE} stroke="#b59a5e" strokeWidth="5" fill="none" opacity="0.16" />
      <path ref={pathRef} d={ROUTE} stroke="#d8b96a" strokeWidth="1.8" fill="none" strokeDasharray="5 3" />
      <g transform="translate(16,94)">
        <rect x="-4" y="-4" width="8" height="8" fill="#7d9bb5" />
      </g>
      <g transform="translate(242,24)">
        <path d="M-5,1 L0,-5 L5,1 V6 H-5 Z" fill="#93a97e" />
      </g>
      <text x="246" y="38" fill="#7e93a5" fontSize="6.5" textAnchor="end" letterSpacing="1">HOME</text>
      <text x="34" y="22" fill="#54687c" fontSize="6.5" letterSpacing="1">RIVERWALK</text>
      <text x="130" y="80" fill="#54687c" fontSize="6.5" letterSpacing="1">WABASH AVE</text>
      <text x="182" y="112" fill="#54687c" fontSize="6.5" letterSpacing="1">I-55</text>
      <g ref={vehRef} transform="translate(16,94)">
        <circle ref={pulseRef} r="9" fill="none" stroke="#d8b96a" strokeWidth="1" opacity="0.4" />
        <circle r="4" fill="#e8cd82" stroke="#0a0f16" strokeWidth="1.4" />
      </g>
    </svg>
  );
}

/* ---------------- Security: the camera grid ---------------- */

const CAMS = ["PORCH", "DRIVE", "GARAGE", "YARD"];
let noiseTile = null;
function getNoise() {
  if (noiseTile) return noiseTile;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  const img = x.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

function camScene(ctx, i, x0, y0, w, h, t) {
  ctx.strokeStyle = "#406282";
  ctx.fillStyle = "#1a2836";
  ctx.lineWidth = 1.4;
  if (i === 0) { // PORCH: door, step, lamp
    ctx.strokeRect(x0 + w * 0.42, y0 + h * 0.18, w * 0.2, h * 0.64);
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.3, y0 + h * 0.84); ctx.lineTo(x0 + w * 0.74, y0 + h * 0.84);
    ctx.moveTo(x0 + w * 0.24, y0 + h * 0.93); ctx.lineTo(x0 + w * 0.8, y0 + h * 0.93);
    ctx.stroke();
    const fl = 0.1 + 0.03 * Math.sin(t / 300);
    const g = ctx.createRadialGradient(x0 + w * 0.78, y0 + h * 0.2, 2, x0 + w * 0.78, y0 + h * 0.2, 26);
    g.addColorStop(0, "rgba(232,205,130," + fl + ")");
    g.addColorStop(1, "rgba(232,205,130,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x0 + w * 0.6, y0, w * 0.4, h * 0.55);
    ctx.fillStyle = "#e8cd82";
    ctx.beginPath(); ctx.arc(x0 + w * 0.78, y0 + h * 0.2, 2.2, 0, 7); ctx.fill();
  } else if (i === 1) { // DRIVE: garage door + car
    ctx.strokeRect(x0 + w * 0.08, y0 + h * 0.14, w * 0.44, h * 0.6);
    for (let s = 1; s < 4; s++) {
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.08, y0 + h * (0.14 + 0.15 * s));
      ctx.lineTo(x0 + w * 0.52, y0 + h * (0.14 + 0.15 * s));
      ctx.stroke();
    }
    ctx.beginPath(); // car silhouette
    const cx0 = x0 + w * 0.6, cy0 = y0 + h * 0.62;
    ctx.moveTo(cx0, cy0);
    ctx.lineTo(cx0 + w * 0.06, cy0 - h * 0.13);
    ctx.lineTo(cx0 + w * 0.2, cy0 - h * 0.15);
    ctx.lineTo(cx0 + w * 0.28, cy0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (i === 2) { // GARAGE: shelves + boxes
    for (let s = 0; s < 3; s++) {
      const yy = y0 + h * (0.26 + 0.24 * s);
      ctx.beginPath(); ctx.moveTo(x0 + w * 0.1, yy); ctx.lineTo(x0 + w * 0.66, yy); ctx.stroke();
      ctx.strokeRect(x0 + w * (0.14 + 0.13 * s), yy - h * 0.16, w * 0.11, h * 0.16);
    }
    ctx.beginPath(); // bike hint
    ctx.arc(x0 + w * 0.82, y0 + h * 0.78, 7, 0, 7);
    ctx.arc(x0 + w * 0.93, y0 + h * 0.78, 7, 0, 7);
    ctx.moveTo(x0 + w * 0.82, y0 + h * 0.78); ctx.lineTo(x0 + w * 0.87, y0 + h * 0.58);
    ctx.lineTo(x0 + w * 0.93, y0 + h * 0.78);
    ctx.stroke();
  } else { // YARD: fence + tree + a passing cat
    for (let f = 0; f < 9; f++) {
      const fx = x0 + w * (0.06 + 0.11 * f);
      ctx.beginPath(); ctx.moveTo(fx, y0 + h * 0.62); ctx.lineTo(fx, y0 + h * 0.86); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.04, y0 + h * 0.7); ctx.lineTo(x0 + w * 0.98, y0 + h * 0.7);
    ctx.stroke();
    ctx.fillStyle = "#14231a";
    ctx.beginPath();
    ctx.arc(x0 + w * 0.84, y0 + h * 0.3, 15, 0, 7);
    ctx.arc(x0 + w * 0.74, y0 + h * 0.38, 11, 0, 7);
    ctx.fill();
    const ph = (t % 24000) / 24000;
    if (ph < 0.18) { // the cat crosses, low and quick
      const kx = x0 + (ph / 0.18) * w, ky = y0 + h * 0.9;
      ctx.fillStyle = "#05080b";
      ctx.beginPath(); ctx.ellipse(kx, ky, 8, 3.6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(kx + 8, ky - 2.4, 2.6, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(kx - 8, ky - 1); ctx.quadraticCurveTo(kx - 13, ky - 5, kx - 11, ky - 8); ctx.stroke();
    }
  }
}

export function CamGrid() {
  const cvRef = useRef(null);
  useAnim((t) => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height, cw = W / 2, ch = H / 2;
    const noise = getNoise();
    for (let i = 0; i < 4; i++) {
      const x0 = (i % 2) * cw, y0 = Math.floor(i / 2) * ch;
      const g = ctx.createLinearGradient(x0, y0, x0, y0 + ch);
      g.addColorStop(0, "#0e1620");
      g.addColorStop(1, "#090d12");
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, cw, ch);
      camScene(ctx, i, x0, y0, cw, ch, t);
      // light sweep
      const sx = x0 + (((t / 7000 + i * 0.27) % 1.4) - 0.2) * cw;
      const sg = ctx.createLinearGradient(sx - 22, y0, sx + 22, y0);
      sg.addColorStop(0, "rgba(180,205,225,0)");
      sg.addColorStop(0.5, "rgba(180,205,225,0.05)");
      sg.addColorStop(1, "rgba(180,205,225,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(x0, y0, cw, ch);
      // grain
      ctx.save();
      ctx.globalAlpha = 0.05;
      const ox = Math.floor(Math.random() * 64), oy = Math.floor(Math.random() * 64);
      ctx.beginPath(); ctx.rect(x0, y0, cw, ch); ctx.clip();
      ctx.drawImage(noise, x0 - ox, y0 - oy, 256, 256);
      ctx.restore();
      // labels
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#9fb4c4";
      ctx.fillText(CAMS[i], x0 + 7, y0 + 14);
      if (Math.floor(t / 620) % 2 === 0) {
        ctx.fillStyle = "#d86a5e";
        ctx.beginPath(); ctx.arc(x0 + cw - 26, y0 + 10, 2.6, 0, 7); ctx.fill();
        ctx.fillText("REC", x0 + cw - 20, y0 + 14);
      }
      const d = new Date();
      const ts = [d.getHours(), d.getMinutes(), d.getSeconds()].map((v) => String(v).padStart(2, "0")).join(":");
      ctx.fillStyle = "rgba(159,180,196,0.75)";
      ctx.fillText(ts, x0 + 7, y0 + ch - 7);
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, cw - 1, ch - 1);
    }
  });
  return <canvas ref={cvRef} className="gd-anim gd-cams" width={480} height={172} data-anim="cams" />;
}

/* ---------------- Network: the throughput chart ---------------- */

function netPoint(t) {
  const s = t / 1000;
  return {
    d: Math.max(0.08, 1.15 + 0.55 * Math.sin(s / 2.9) + 0.3 * Math.sin(s / 0.83 + 2) + Math.random() * 0.14),
    u: Math.max(0.04, 0.32 + 0.16 * Math.sin(s / 3.7 + 1) + Math.random() * 0.07),
  };
}

export function NetChart() {
  const [pts, setPts] = useState(() => {
    const now = performance.now();
    return Array.from({ length: 36 }, (_, i) => netPoint(now - (35 - i) * 500));
  });
  useEffect(() => {
    const id = setInterval(() => {
      setPts((p) => [...p.slice(-35), netPoint(performance.now())]);
    }, 500);
    return () => clearInterval(id);
  }, []);
  const x = scaleLinear().domain([0, 35]).range([0, 260]);
  const y = scaleLinear().domain([0, 2.4]).range([52, 4]);
  const areaD = d3area().x((_, i) => x(i)).y0(54).y1((p) => y(p.d))(pts);
  const lineD = d3line().x((_, i) => x(i)).y((p) => y(p.d))(pts);
  const lineU = d3line().x((_, i) => x(i)).y((p) => y(p.u))(pts);
  const last = pts[pts.length - 1];
  return (
    <div>
      <svg className="gd-anim gd-net" viewBox="0 0 260 54" preserveAspectRatio="none" data-anim="net" aria-hidden="true">
        <path d={areaD} fill="rgba(216,185,106,0.18)" />
        <path d={lineD} fill="none" stroke="#d8b96a" strokeWidth="1.5" />
        <path d={lineU} fill="none" stroke="#93a97e" strokeWidth="1.3" />
      </svg>
      <div className="gd-legend">↓ {last.d.toFixed(2)} MB/s · ↑ {last.u.toFixed(2)} MB/s</div>
    </div>
  );
}
