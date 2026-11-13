# Panelization — iGeo agent-based panelization, ported to TypeScript

A renderer-independent port of Satoru Sugihara's iGeo tutorial 59,
**"Agent-Based Panelization Algorithm"** (igeo.jp/tutorial/59.html).
iGeo is a Java/Processing computational-design library (LGPL-3.0);
this is a port of the tutorial *algorithm*, written from the
tutorial's published code, not a copy of the library.

## What it does

A staggered grid of nodes is pinned to a NURBS surface. Hexagonal
panels span six nodes each. A flock of boids (the "swarm") skims the
surface, held to it by a surface attractor field and drawn by point
attractors. When a boid passes near a panel, it pushes the panel
with its velocity. Each panel accumulates the pushes in a direction
vector, and rebuilds its geometry from it every step:

- the panel is a hexagonal funnel lofted through three rings — the
  node hexagon, a copy scaled 0.66 toward the center, and a copy
  scaled 0.33 whose center is displaced by the accumulated push
  (clamped), so the funnel's throat leans with the force;
- the panel's color encodes the push direction
  (`clr(uratio*0.5, vratio*0.5 + 0.5, 0.5)`), so the skin reads as a
  field of instruments reacting to the swarm.

Output is plain data (`positions` / `indices` / `colors`) for any
renderer — three.js in the demo-de demo, canvas or SVG elsewhere.

## Files

| File | Contents |
| --- | --- |
| `NCTGraphiteVec3.ts` | Small immutable vec3 helpers (iGeo's IVec operations as pure functions). |
| `NCTGraphiteNurbsSurface.ts` | NURBS surface (normalized UV), points + frames; flat-sheet and demo-sheet presets. |
| `NCTGraphitePanelization.ts` | PanelNode, PanelAgent, SwarmBoid, PanelizationSimulation. |

## Mapping from the source

| iGeo (Java) | This port |
| --- | --- |
| `ISurface` from `srf1.3dm` | `NCTGraphiteNurbsSurface` defined in code; presets stand in for the unpublished .3dm control net. |
| `IParticleOnSurface` + `ITension(4)`, `fric(0.1)` | `PanelNode` (tension/friction recorded; see adaptation 1). |
| `PanelAgent extends IAgent` | `PanelAgent` — `interact`, `makePanel` (as `geometry()`), `ushift/vshift/nshift`, `uratio/vratio/nratio` keep the source's formulas and clamps. |
| `Swarm extends IBoid` | `SwarmBoid` + the flock step in `PanelizationSimulation`. |
| `IAttractor` (gauss 100) on the file's points | `PanelAttractor` with three default points on the surface. |
| `ISurfaceAttractorField` (intensity 100) | The height spring in the boid step. |
| `IG.loft(hex3, hex2, hex1)` | The two triangle bands between the three rings in `mesh()`. |

## Adaptations (where the port is not literal)

1. **Nodes are fixed anchors.** The tutorial's setup calls
   `fixU()`/`fixV()` on every node, so in the original's own
   configuration node positions never leave `surface.pt(u, v)` and
   panel→node pushes have no positional effect. The port keeps
   nodes fixed and records pushes in `PanelNode.force`, preserving
   the data flow without pretending the anchors move.
2. **Boids live in surface space.** iGeo's boids fly in 3D and are
   pulled onto the surface by the attractor field. The port carries
   each boid as (u, v, height) and integrates its 3D velocity
   against the surface frame each step — the flock still skims the
   sheet, with better stability and no closest-point search.
3. **Steering gains are calibrated.** IBoid's internal force
   scaling is not published with the tutorial; cohesion/separation
   use the source's ratio/dist parameters with gains chosen so the
   flock behaves like the tutorial's recordings (coherent, surface-
   hugging, speed clamped near the spawn speed of 10).
4. **`dirDecay` defaults to 1 (faithful).** The source never decays
   a panel's accumulated `dir`; its effects simply saturate at the
   geometry clamps. Setting `dirDecay < 1` (the demo uses 0.95)
   lets panels relax after the swarm passes — an ambient-display
   choice, off by default.
