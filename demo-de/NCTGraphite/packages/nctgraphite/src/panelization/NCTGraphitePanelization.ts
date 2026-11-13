/**
 * Agent-based panelization, ported to TypeScript from Satoru
 * Sugihara's iGeo tutorial 59, "Agent-Based Panelization Algorithm"
 * (igeo.jp/tutorial/59.html; iGeo is LGPL, this is a clean-room port
 * of the tutorial algorithm, not a copy of the library).
 *
 * The system, as in the original:
 *
 * - A grid of PanelNodes is pinned to a NURBS surface in a staggered
 *   layout; hexagonal PanelAgents span six nodes each.
 * - A flock of Swarm boids skims the surface, held to it by a surface
 *   attractor field and drawn by point attractors. When a boid passes
 *   within `panelReachDist` of a panel's center, it pushes the panel
 *   with its velocity.
 * - Each panel accumulates those pushes in `dir`. The panel's visible
 *   geometry — a hexagonal funnel lofted through three rings — tilts
 *   its inner ring along `dir`, and its color encodes the push
 *   direction (u/v ratios), so the skin reads as a field of
 *   instruments reacting to the swarm.
 *
 * Renderer-independent: geometry is emitted as plain arrays
 * (positions / indices / colors) for three.js, canvas, or SVG.
 * Dynamics adaptations from iGeo's runtime are listed in the
 * module README.
 */

import {
  vec3,
  vAdd,
  vSub,
  vScale,
  vMid,
  vDot,
  vCross,
  vUnit,
  vLen,
  vDist,
  vWithLen,
  type NCTGraphiteVec3,
} from './NCTGraphiteVec3.js';
import type { NCTGraphiteNurbsSurface } from './NCTGraphiteNurbsSurface.js';

/** Deterministic RNG so simulations are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A particle pinned to the surface at (u, v). In the tutorial's own
 * setup the nodes' U and V are fixed (fixU/fixV), so a node's
 * position never leaves surface.pt(u, v); the tension anchor
 * (ITension, tension 4) and friction (0.1) are therefore structural —
 * pushes from panels are recorded in `force` but do not move the
 * node, exactly as in the original configuration. They are kept in
 * the port so an unfixed variant can be explored later.
 */
export class PanelNode {
  readonly u: number;
  readonly v: number;
  readonly pos: NCTGraphiteVec3;
  /** Accumulated pushes (inert while u/v are fixed, as in the source). */
  force: NCTGraphiteVec3 = vec3();
  /** The tutorial's ITension anchor strength / particle friction. */
  readonly tension = 4;
  readonly friction = 0.1;

  constructor(surface: NCTGraphiteNurbsSurface, u: number, v: number) {
    this.u = u;
    this.v = v;
    this.pos = surface.pointAt(u, v);
  }

  push(f: NCTGraphiteVec3): void {
    this.force = vAdd(this.force, f);
  }
}

export interface PanelColor {
  r: number;
  g: number;
  b: number;
}

export interface PanelGeometry {
  /** Three closed rings of 6 points, loft order: inner, middle, outer. */
  rings: [NCTGraphiteVec3[], NCTGraphiteVec3[], NCTGraphiteVec3[]];
  color: PanelColor;
}

/**
 * A hexagonal panel spanning six PanelNodes. Accumulates force in
 * `dir` from passing swarm boids and rebuilds its funnel geometry
 * from the current node positions plus `dir` every step.
 */
export class PanelAgent {
  readonly nodes: PanelNode[];
  /** Cache of center(), refreshed by interact(). iGeo: `pos`. */
  pos: NCTGraphiteVec3;
  /** Accumulated push direction. iGeo: `dir`. */
  dir: NCTGraphiteVec3 = vec3();
  /** iGeo default: 0.1 (a 1.0 variant is commented in the source). */
  dirScale = 0.1;

  constructor(nodes: PanelNode[]) {
    this.nodes = nodes;
    this.pos = this.center();
  }

  node(i: number): NCTGraphiteVec3 {
    if (i < 0 || i >= this.nodes.length) return vec3();
    return this.nodes[i].pos;
  }

  center(): NCTGraphiteVec3 {
    let cnt = this.nodes[0].pos;
    for (let i = 1; i < this.nodes.length; i++) {
      cnt = vAdd(cnt, this.nodes[i].pos);
    }
    return vScale(cnt, 1 / this.nodes.length);
  }

  uvec(): NCTGraphiteVec3 {
    return vSub(this.node(2), this.node(5));
  }

  vvec(): NCTGraphiteVec3 {
    return vSub(vMid(this.node(0), this.node(1)), vMid(this.node(3), this.node(4)));
  }

  nml(): NCTGraphiteVec3 {
    return vUnit(vCross(this.uvec(), this.vvec()));
  }

  /** Point in the panel's local frame; u/v in 0..1, optional normal offset. */
  pt(u: number, v: number, n?: number): NCTGraphiteVec3 {
    const center = this.center();
    let p = vAdd(
      center,
      vAdd(vScale(this.uvec(), u - 0.5), vScale(this.vvec(), v - 0.5)),
    );
    if (n !== undefined) p = vAdd(p, vScale(this.nml(), n));
    return p;
  }

  addForce(frc: NCTGraphiteVec3): void {
    this.dir = vAdd(this.dir, vScale(frc, 0.1));
  }

  /**
   * The panel shoves nearby nodes along its accumulated direction
   * (threshold 10, linear falloff, gain 0.1) — verbatim from the
   * source. Inert for position while node UVs are fixed.
   */
  interact(nodes: PanelNode[]): void {
    this.pos = this.center();
    const threshold = 10;
    for (const n of nodes) {
      const dist = vDist(n.pos, this.pos);
      if (dist < threshold) {
        n.push(vScale(this.dir, ((threshold - dist) / threshold) * 0.1));
      }
    }
  }

  shiftAmount(): number {
    return vLen(this.dir) * this.dirScale;
  }

  shiftRatio(): number {
    const r = this.shiftAmount();
    return r > 1 ? 1 : r;
  }

  shift(): NCTGraphiteVec3 {
    return vScale(this.dir, this.dirScale);
  }

  ushift(): NCTGraphiteVec3 {
    const uv = this.uvec();
    const ulen = vLen(uv);
    if (ulen === 0) return vec3();
    let dot = (vDot(this.dir, uv) * this.dirScale) / ulen;
    if (dot > ulen / 2) dot = ulen / 2;
    else if (dot < -ulen / 2) dot = -ulen / 2;
    return vScale(uv, dot / ulen);
  }

  vshift(): NCTGraphiteVec3 {
    const vv = this.vvec();
    const vlen = vLen(vv);
    if (vlen === 0) return vec3();
    let dot = (vDot(this.dir, vv) * this.dirScale) / vlen;
    if (dot > vlen / 2) dot = vlen / 2;
    else if (dot < -vlen / 2) dot = -vlen / 2;
    return vScale(vv, dot / vlen);
  }

  nshift(maxLen = -1, minLen = -1): NCTGraphiteVec3 {
    const n = this.nml();
    let dot = vDot(this.dir, n) * this.dirScale;
    if (maxLen !== -1) {
      if (dot > maxLen) dot = maxLen;
      if (minLen !== -1 && dot < minLen) dot = minLen;
    }
    return vScale(n, dot);
  }

  /** Push component along the panel's u axis, −0.5..0.5. */
  uratio(): number {
    const uv = this.uvec();
    const ulen = vLen(uv);
    if (ulen === 0) return 0;
    let dot = (vDot(this.dir, uv) * this.dirScale) / (ulen * ulen);
    if (dot > 0.5) dot = 0.5;
    else if (dot < -0.5) dot = -0.5;
    return dot;
  }

  /** Push component along the panel's v axis, −0.5..0.5. */
  vratio(): number {
    const vv = this.vvec();
    const vlen = vLen(vv);
    if (vlen === 0) return 0;
    let dot = (vDot(this.dir, vv) * this.dirScale) / (vlen * vlen);
    if (dot > 0.5) dot = 0.5;
    else if (dot < -0.5) dot = -0.5;
    return dot;
  }

  /** Push component along the panel normal, unclamped. */
  nratio(): number {
    return vDot(this.dir, this.nml()) * this.dirScale;
  }

  /**
   * The panel funnel: the hexagon ring through the six nodes, a copy
   * scaled 0.66 toward the center, and a copy scaled 0.33 whose
   * center is displaced by shift() (clamped to length 2). Lofted in
   * the source as IG.loft(hex3, hex2, hex1); color encodes the push
   * direction: clr(uratio*0.5, vratio*0.5 + 0.5, 0.5).
   */
  geometry(): PanelGeometry {
    const center = this.center();
    const ring1 = [0, 1, 2, 3, 4, 5].map((i) => this.node(i));
    const scaleAbout = (p: NCTGraphiteVec3, s: number) =>
      vAdd(center, vScale(vSub(p, center), s));
    const ring2 = ring1.map((p) => scaleAbout(p, 0.66));
    let shift = this.shift();
    if (vLen(shift) > 2) shift = vWithLen(shift, 2);
    const ring3 = ring1.map((p) => vAdd(scaleAbout(p, 0.33), shift));
    const raw = {
      r: this.uratio() * 0.5,
      g: this.vratio() * 0.5 + 0.5,
      b: 0.5,
    };
    return {
      rings: [ring3, ring2, ring1],
      color: {
        r: Math.min(1, Math.max(0, raw.r)),
        g: Math.min(1, Math.max(0, raw.g)),
        b: raw.b,
      },
    };
  }
}

/** A point attractor with gaussian falloff, as the tutorial places
 *  on the surface file's points (strength 1, gauss radius 100),
 *  targeting the swarm only. Gain is the port's calibration. */
export interface PanelAttractor {
  pos: NCTGraphiteVec3;
  strength: number;
  gaussRadius: number;
  gain: number;
}

/**
 * A boid of the swarm. iGeo's Swarm is an IBoid flying in 3D, held
 * near the surface by ISurfaceAttractorField (intensity 100) and
 * drawn by the point attractors. This port keeps the boid in surface
 * space — (u, v) plus height above the surface — integrating its 3D
 * velocity against the surface frame each step; behavior matches
 * (the flock skims the sheet) with far better stability.
 *
 * IBoid parameters from the source: cohesion ratio 10 / dist 10,
 * separation ratio 10 / dist 10, alignment ratio 0 (off).
 */
export class SwarmBoid {
  u: number;
  v: number;
  height: number;
  /** 3D velocity, units per step. */
  vel: NCTGraphiteVec3;
  /** Current 3D position (on/near the surface). */
  pos: NCTGraphiteVec3;
  cohesionRatio = 10;
  cohesionDist = 10;
  separationRatio = 10;
  separationDist = 10;
  alignmentRatio = 0;
  alignmentDist = 0;

  constructor(pos: NCTGraphiteVec3, vel: NCTGraphiteVec3, u = 0, v = 0, height = 0) {
    this.pos = pos;
    this.vel = vel;
    this.u = u;
    this.v = v;
    this.height = height;
  }
}

export interface PanelizationConfig {
  surface: NCTGraphiteNurbsSurface;
  /** Tutorial defaults: 70 x 20 divisions. */
  udiv?: number;
  vdiv?: number;
  /** Tutorial default: 50 boids. */
  swarmCount?: number;
  /** Tutorial default: 10 (world units). */
  panelReachDist?: number;
  /** Attractor points; default: three points on the surface. */
  attractors?: PanelAttractor[];
  /**
   * Per-step multiplier on each panel's accumulated `dir`.
   * 1 = faithful to the source (no decay; effects saturate at the
   * geometry clamps). < 1 lets panels relax after the swarm passes.
   */
  dirDecay?: number;
  seed?: number;
}

export interface PanelizationMesh {
  positions: number[];
  indices: number[];
  /** One RGB triple per vertex (the owning panel's color). */
  colors: number[];
}

export class PanelizationSimulation {
  readonly surface: NCTGraphiteNurbsSurface;
  readonly nodes: PanelNode[][] = [];
  readonly nodeList: PanelNode[] = [];
  readonly panels: PanelAgent[] = [];
  readonly boids: SwarmBoid[] = [];
  readonly attractors: PanelAttractor[];
  /** Live-tunable: hosts may adjust these between steps. */
  panelReachDist: number;
  dirDecay: number;
  stepCount = 0;

  constructor(config: PanelizationConfig) {
    this.surface = config.surface;
    const udiv = config.udiv ?? 70;
    const vdiv = config.vdiv ?? 20;
    this.panelReachDist = config.panelReachDist ?? 10;
    this.dirDecay = config.dirDecay ?? 1;
    const rand = mulberry32(config.seed ?? 1);

    this.attractors =
      config.attractors ??
      [
        { u: 0.25, v: 0.5 },
        { u: 0.55, v: 0.3 },
        { u: 0.8, v: 0.65 },
      ].map(({ u, v }) => ({
        pos: this.surface.pointAt(u, v),
        strength: 1,
        gaussRadius: 100,
        gain: 0.6,
      }));

    // Node grid with the tutorial's staggered u offset.
    const uinc = 1 / udiv;
    const vinc = 1 / vdiv;
    for (let i = 0; i <= udiv; i++) {
      const col: PanelNode[] = [];
      for (let j = 0; j <= vdiv; j++) {
        const ushift = ((i + j) % 2 - 0.5) * 2 * 0.2;
        const node = new PanelNode(
          this.surface,
          (i - ushift) * uinc,
          j * vinc,
        );
        col.push(node);
        this.nodeList.push(node);
      }
      this.nodes.push(col);
    }

    // Hexagonal panels: 1 cell in u, 2 cells in v, staggered by row.
    for (let i = 0; i < udiv; i++) {
      const jStart = i % 2 === 0 ? 0 : 1;
      for (let j = jStart; j < vdiv - 1; j += 2) {
        const n = this.nodes;
        this.panels.push(
          new PanelAgent([
            n[i][j],
            n[i + 1][j],
            n[i + 1][j + 1],
            n[i + 1][j + 2],
            n[i][j + 2],
            n[i][j + 1],
          ]),
        );
      }
    }

    // Swarm: random points on the surface, height -5..5, speed 10.
    const count = config.swarmCount ?? 50;
    for (let i = 0; i < count; i++) {
      const u = rand();
      const v = rand();
      const height = -5 + rand() * 10;
      const frame = this.surface.frameAt(u, v);
      const pos = vAdd(frame.point, vScale(frame.normal, height));
      const theta = rand() * Math.PI * 2;
      const vel = vWithLen(
        vAdd(
          vScale(vUnit(frame.tangentU), Math.cos(theta)),
          vScale(vUnit(frame.tangentV), Math.sin(theta)),
        ),
        10,
      );
      this.boids.push(new SwarmBoid(pos, vel, u, v, height));
    }
  }

  /** Swarm pushes panels within reach — the source's Swarm.interact. */
  private swarmInteract(): void {
    const reach = this.panelReachDist;
    for (const boid of this.boids) {
      for (const panel of this.panels) {
        const dist = vDist(panel.center(), boid.pos);
        if (dist < reach) {
          panel.addForce(vScale(boid.vel, (reach - dist) / reach));
        }
      }
    }
  }

  private stepBoids(): void {
    const surface = this.surface;
    for (const boid of this.boids) {
      let force = vec3();

      // Reynolds rules against the other boids (3D positions).
      let cohCenter = vec3();
      let cohCount = 0;
      let sep = vec3();
      for (const other of this.boids) {
        if (other === boid) continue;
        const d = vDist(other.pos, boid.pos);
        if (d < boid.cohesionDist && d > 0) {
          cohCenter = vAdd(cohCenter, other.pos);
          cohCount++;
        }
        if (d < boid.separationDist && d > 0) {
          sep = vAdd(
            sep,
            vScale(vSub(boid.pos, other.pos), 1 / (d * d)),
          );
        }
      }
      if (cohCount > 0) {
        const toCenter = vSub(vScale(cohCenter, 1 / cohCount), boid.pos);
        force = vAdd(force, vScale(toCenter, (boid.cohesionRatio / 100) * 0.1));
      }
      force = vAdd(force, vScale(sep, boid.separationRatio * 0.05));

      // Point attractors, gaussian falloff.
      for (const att of this.attractors) {
        const to = vSub(att.pos, boid.pos);
        const d = vLen(to);
        if (d > 0.001) {
          const g = Math.exp(-((d / att.gaussRadius) ** 2));
          force = vAdd(force, vScale(vUnit(to), att.strength * att.gain * g));
        }
      }

      boid.vel = vAdd(boid.vel, force);

      // Clamp speed so the flock stays coherent (spawn speed is 10).
      const speed = vLen(boid.vel);
      if (speed > 12) boid.vel = vWithLen(boid.vel, 12);
      else if (speed < 3 && speed > 0) boid.vel = vWithLen(boid.vel, 3);

      // Integrate in 3D, then re-express against the surface frame:
      // the surface attractor field (intensity 100 in the source) is
      // the pull of height toward 0 plus a normal spring.
      const frame = surface.frameAt(boid.u, boid.v);
      const springK = 0.08;
      boid.vel = vAdd(boid.vel, vScale(frame.normal, -boid.height * springK));

      const moved = vAdd(boid.pos, boid.vel);
      const delta = vSub(moved, frame.point);
      const du = vDot(delta, frame.tangentU) / Math.max(1e-9, vDot(frame.tangentU, frame.tangentU));
      const dv = vDot(delta, frame.tangentV) / Math.max(1e-9, vDot(frame.tangentV, frame.tangentV));
      boid.u = Math.min(0.999, Math.max(0.001, boid.u + du));
      boid.v = Math.min(0.999, Math.max(0.001, boid.v + dv));
      const newFrame = surface.frameAt(boid.u, boid.v);
      boid.height = vDot(vSub(moved, newFrame.point), newFrame.normal);
      boid.height = Math.max(-8, Math.min(8, boid.height));
      boid.pos = vAdd(newFrame.point, vScale(newFrame.normal, boid.height));
    }
  }

  /** Advance the whole system one step (one iGeo dynamics frame). */
  step(): void {
    this.stepBoids();
    this.swarmInteract();
    for (const panel of this.panels) panel.interact(this.nodeList);
    if (this.dirDecay !== 1) {
      for (const panel of this.panels) {
        panel.dir = vScale(panel.dir, this.dirDecay);
      }
    }
    this.stepCount++;
  }

  /**
   * All panel funnels as one triangle mesh: bands between the inner
   * and middle rings and between the middle and outer rings, closed
   * around the hexagon. Vertex colors carry each panel's color.
   */
  mesh(): PanelizationMesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    for (const panel of this.panels) {
      const { rings, color } = panel.geometry();
      const base = positions.length / 3;
      for (const ring of rings) {
        for (const p of ring) {
          positions.push(p.x, p.y, p.z);
          colors.push(color.r, color.g, color.b);
        }
      }
      // rings are [inner(0..5), middle(6..11), outer(12..17)]
      for (let band = 0; band < 2; band++) {
        const a0 = base + band * 6;
        const b0 = base + (band + 1) * 6;
        for (let k = 0; k < 6; k++) {
          const k2 = (k + 1) % 6;
          indices.push(a0 + k, b0 + k, b0 + k2);
          indices.push(a0 + k, b0 + k2, a0 + k2);
        }
      }
    }
    return { positions, indices, colors };
  }
}
