/* backdropService — owns the desktop backdrop's engine.
 *
 * The engine is NCTGraphite's iGeo panelization port
 * (PanelizationSimulation): a swarm skimming a NURBS sheet, pushing
 * hexagonal funnel panels that lean and colour with the flow. This
 * service builds the simulation from settings.backdrop, rebuilds it
 * on structural changes (surface, density, swarm count), applies
 * live parameters between steps (reach, memory, speed), steps it,
 * and paints frames. BackdropView (shell) only attaches a canvas —
 * all behaviour lives here (DESKTOP-ARCHITECTURE.md: services own
 * engines, views only render).
 *
 * One simulation serves both the login screen and the desktop; the
 * shell mounts the view once, behind both, and the login screen
 * runs it slower and darker (the `grade` the view passes in).
 */

import { PanelizationSimulation } from "../../../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphitePanelization.ts";
import { BACKDROP_SURFACES, BACKDROP_DENSITIES } from "./surfaces.js";

function buildSim(bd) {
  const surf = BACKDROP_SURFACES.find((s) => s.id === bd.surface) || BACKDROP_SURFACES[0];
  const dens = BACKDROP_DENSITIES[bd.density] || BACKDROP_DENSITIES.coarse;
  const sim = new PanelizationSimulation({
    surface: surf.make(),
    udiv: dens.udiv,
    vdiv: dens.vdiv,
    swarmCount: bd.swarmCount,
    panelReachDist: bd.reach,
    dirDecay: bd.memory,
    seed: 7,
  });
  // One extra attractor rides the cursor (settings.backdrop.cursorField).
  const cursorAttractor = { pos: sim.surface.pointAt(0.5, 0.5), strength: 1, gaussRadius: 100, gain: 0.9 };
  sim.attractors.push(cursorAttractor);
  return { sim, cursorAttractor };
}

function structuralKey(bd) {
  return [bd.surface, bd.density, bd.swarmCount].join("|");
}

/* Project the sheet (x 0..200, y up, z 0..60) onto the canvas:
 * a shallow technical tilt — depth slides down-screen, height lifts. */
function project(p, w, h) {
  // A top-down-leaning technical view: depth (z) does most of the
  // vertical spread so the field fills the screen, height (y) lifts.
  const s = Math.min(w / 205, h / 118);
  return [
    w / 2 + (p.x - 100) * s,
    h * 0.55 + (p.z - 30) * s * 1.25 - p.y * s * 0.55,
    p.z,
  ];
}

function ringPath(ctx, ring, w, h) {
  ctx.beginPath();
  ring.forEach((p, i) => {
    const [x, y] = project(p, w, h);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function paint(ctx, sim, w, h, dim) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#111410");
  bg.addColorStop(0.55, "#0a0c0a");
  bg.addColorStop(1, "#060606");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const panels = sim.panels
    .map((panel) => ({ panel, c: panel.center() }))
    .sort((a, b) => a.c.z - b.c.z); // far (small z) first
  for (const { panel } of panels) {
    const { rings, color } = panel.geometry();
    // NCT grade: the sim's push-direction colour (r = u-push,
    // g = v-push, b = 0.5) remapped into the desktop's dark
    // green-gray register, lifted by the panel's response.
    const fade = 0.55 + 0.45 * (panel.center().z / 60); // far panels recede
    const R = Math.round((26 + 72 * color.r) * dim * fade);
    const G = Math.round((46 + 96 * color.g) * dim * fade);
    const B = Math.round((32 + 52 * color.b) * dim * fade);
    ringPath(ctx, rings[2], w, h);
    ctx.fillStyle = `rgb(${Math.round(R * 0.55)},${Math.round(G * 0.55)},${Math.round(B * 0.55)})`;
    ctx.fill();
    ringPath(ctx, rings[1], w, h);
    ctx.fillStyle = `rgb(${Math.round(R * 0.8)},${Math.round(G * 0.8)},${Math.round(B * 0.8)})`;
    ctx.fill();
    ringPath(ctx, rings[0], w, h);
    ctx.fillStyle = `rgb(${R},${G},${B})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/* Attach to a canvas and run until the returned stop() is called.
 * getSettings() returns the current settings.backdrop object;
 * getGrade() returns {speed, dim} for the current screen. */
export function runBackdrop(canvas, { getSettings, getGrade, subscribe }) {
  const ctx = canvas.getContext("2d");
  let { sim, cursorAttractor } = buildSim(getSettings());
  let key = structuralKey(getSettings());
  let mouse = { x: 0.5, y: 0.5, seen: false };
  let raf = 0;
  let last = 0;
  let acc = 0;
  let stopped = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }
  resize();
  window.addEventListener("resize", resize);

  function onMouse(e) {
    mouse = {
      x: Math.min(1, Math.max(0, e.clientX / window.innerWidth)),
      y: Math.min(1, Math.max(0, e.clientY / window.innerHeight)),
      seen: true,
    };
  }
  window.addEventListener("mousemove", onMouse, { passive: true });

  const unsub = subscribe(() => {
    const bd = getSettings();
    const k = structuralKey(bd);
    if (k !== key) {
      key = k;
      ({ sim, cursorAttractor } = buildSim(bd));
    }
  });

  function frame(t) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const bd = getSettings();
    const grade = getGrade();
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;
    if (bd.motion) {
      const dt = Math.min(50, t - last || 16);
      last = t;
      acc += (dt / 16.7) * 0.9 * bd.speed * grade.speed;
      // Live parameters apply between steps (the sim's own contract).
      sim.panelReachDist = bd.reach;
      sim.dirDecay = bd.memory;
      if (bd.cursorField && mouse.seen) {
        cursorAttractor.pos = sim.surface.pointAt(mouse.x, 1 - mouse.y);
        cursorAttractor.gain = 0.9;
      } else {
        cursorAttractor.gain = 0;
      }
      while (acc >= 1) {
        sim.step();
        acc -= 1;
      }
    }
    paint(ctx, sim, w, h, grade.dim);
  }
  raf = requestAnimationFrame(frame);

  return function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("mousemove", onMouse);
    unsub();
  };
}
