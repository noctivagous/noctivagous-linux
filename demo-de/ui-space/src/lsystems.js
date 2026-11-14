/**
 * lsystems.js — 3D L-systems for the UI Space, pure (no three.js): a
 * parallel rewriting engine, a 3D turtle with an H/L/U frame, da Vinci's
 * pipe model for radii, a stochastic BOTANICAL grammar, and a DATA TREE
 * grown by direct spatial recursion from a hierarchy. After Aristid
 * Lindenmayer (1968); Prusinkiewicz & Lindenmayer, "The Algorithmic
 * Beauty of Plants" (1990).
 *
 * THE TURTLE MINI-LANGUAGE (interpret):
 *   F   draw a segment along H with the current length/width state
 *   f   move along H without drawing
 *   + − yaw about U by ±angle        (turn left / right)
 *   & ^ pitch about L by +angle / −angle
 *   \ / roll about H by ±rollAngle   (rollAngle defaults to `angle`;
 *       the botanical grammar passes 120° so a roll step distributes
 *       branches phyllotactically around the stem)
 *   |   yaw 180° about U
 *   [ ] push / pop the full turtle state (position, frame, length,
 *       width, last-segment link). A ']' on an empty stack and an
 *       unclosed '[' are REPORTED in the returned errors, never thrown.
 *   '   length state ×= lengthFactor (default 0.85)
 *   !   width state ×= widthFactor (default 0.8) — the width state is
 *       the TIP-RADIUS SEED for pipe-model purposes (see below); it is
 *       saved/restored by brackets like everything else.
 *   Any other symbol (A, X, …) is a non-terminal and is ignored here.
 *
 * TROPISM: after every drawn step the heading H bends toward a tropism
 * vector by at most tropismAngle radians (params.tropism, default off).
 *
 * PIPE MODEL (da Vinci): radii are assigned bottom-up after drawing —
 * a tip segment's radius is tipRadius × its width state; every parent's
 * radius is sqrt(Σ children radii²), so cross-sectional area is
 * conserved exactly at every junction.
 *
 * Segments: { from:[x,y,z], to:[x,y,z], radius, depth, parent (segment
 * index or -1), tip:boolean, nodeId? }.
 */

// ------------------------------------------------------------- rng ----
// mulberry32: small, fast, seedable — the determinism contract of the
// stochastic grammars lives here (same seed → same stream → same tree).
export function createRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------- rewriting --
/**
 * expand(axiom, rules, iterations, rng?) — parallel string rewriting.
 * rules: { A: "production" } for deterministic grammars, or
 * { A: [{ production, weight }, …] } for stochastic choice, drawn with
 * the supplied rng (weighted). An array rule WITHOUT an rng falls back
 * to its first entry, so the engine is total and deterministic.
 */
export function expand(axiom, rules, iterations, rng = null) {
  let current = String(axiom);
  for (let step = 0; step < iterations; step++) {
    let next = "";
    for (const ch of current) {
      const rule = rules[ch];
      if (rule === undefined) { next += ch; continue; }
      if (typeof rule === "string") { next += rule; continue; }
      // stochastic: weighted pick
      let total = 0;
      for (const alt of rule) total += alt.weight ?? 1;
      let pick = rule[0].production;
      if (rng) {
        let r = rng() * total;
        for (const alt of rule) {
          r -= alt.weight ?? 1;
          if (r <= 0) { pick = alt.production; break; }
        }
      }
      next += pick;
    }
    current = next;
  }
  return current;
}

// ------------------------------------------------------- vector kit ---
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a) => {
  const l = vlen(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// Rodrigues rotation of v about unit axis k by angle θ.
function vrot(v, k, th) {
  const c = Math.cos(th), s = Math.sin(th);
  const cross = vcross(k, v);
  const d = vdot(k, v) * (1 - c);
  return [
    v[0] * c + cross[0] * s + k[0] * d,
    v[1] * c + cross[1] * s + k[1] * d,
    v[2] * c + cross[2] * s + k[2] * d,
  ];
}
// Rotate `frame` ({H,L,U}, orthonormal) about one of its own axes.
function rotFrame(frame, axisKey, th) {
  const k = frame[axisKey];
  for (const key of ["H", "L", "U"]) {
    if (key !== axisKey) frame[key] = vnorm(vrot(frame[key], k, th));
  }
}
// Bend H toward vector T by at most maxAngle; rebuild the frame around it.
function bendToward(frame, T, maxAngle) {
  const t = vnorm(T);
  const cos = Math.max(-1, Math.min(1, vdot(frame.H, t)));
  const ang = Math.acos(cos);
  if (ang < 1e-9 || maxAngle <= 0) return;
  const axis = vcross(frame.H, t);
  if (vlen(axis) < 1e-9) return; // parallel: nothing to bend around
  frame.H = vnorm(vrot(frame.H, vnorm(axis), Math.min(ang, maxAngle)));
  // re-orthogonalise: keep H, rebuild L from old U, then U from H × L
  frame.L = vnorm(vcross(frame.U, frame.H));
  frame.U = vcross(frame.H, frame.L);
}

// -------------------------------------------------------- pipe model --
/**
 * pipeRadii(segments, tipRadius) — bottom-up: a segment with no
 * children is a tip and gets tipRadius × (segment.tipScale ?? 1); every
 * parent gets sqrt(Σ children radii²). Mutates and returns segments;
 * also (re)computes each segment's `tip` flag.
 */
export function pipeRadii(segments, tipRadius = 0.1) {
  const children = segments.map(() => []);
  segments.forEach((s, i) => {
    if (s.parent != null && s.parent >= 0) children[s.parent].push(i);
  });
  // parents always precede children in both generators (the turtle
  // draws a parent before descending; the recursion emits pre-order),
  // so a reverse sweep is a valid bottom-up order.
  for (let i = segments.length - 1; i >= 0; i--) {
    const kids = children[i];
    const s = segments[i];
    s.tip = kids.length === 0;
    if (s.tip) s.radius = tipRadius * (s.tipScale ?? 1);
    else {
      let sum = 0;
      for (const k of kids) sum += segments[k].radius ** 2;
      s.radius = Math.sqrt(sum);
    }
  }
  return segments;
}

// ------------------------------------------------------------ turtle --
/**
 * interpret(program, params) → { segments, errors }.
 * params: { length=1 (first segment length), angle=22 (degrees, yaw &
 * pitch), rollAngle (= angle), lengthFactor=0.85, widthFactor=0.8,
 * tipRadius=0.1, tropism=null ([x,y,z]), tropismAngle=0.04 (radians,
 * per drawn step), pipe=true }.
 * Initial frame: H = +Y (grow up), U = +Z, L = −X (so H × L = U).
 */
export function interpret(program, params = {}) {
  const {
    length = 1,
    angle = 22,
    rollAngle = null,
    lengthFactor = 0.85,
    widthFactor = 0.8,
    tipRadius = 0.1,
    tropism = null,
    tropismAngle = 0.04,
    pipe = true,
  } = params;
  const A = (angle * Math.PI) / 180;
  const R = ((rollAngle ?? angle) * Math.PI) / 180;

  const segments = [];
  const errors = [];
  let state = {
    pos: [0, 0, 0],
    frame: { H: [0, 1, 0], L: [-1, 0, 0], U: [0, 0, 1] },
    len: length,
    width: 1,
    last: -1, // index of the segment ending at the current position
  };
  const stack = [];
  const clone = (s) => ({
    pos: [...s.pos],
    frame: { H: [...s.frame.H], L: [...s.frame.L], U: [...s.frame.U] },
    len: s.len, width: s.width, last: s.last,
  });

  [...String(program)].forEach((ch, i) => {
    const f = state.frame;
    switch (ch) {
      case "F": {
        const from = state.pos;
        const to = vadd(from, vscale(f.H, state.len));
        segments.push({
          from: [...from], to: [...to],
          radius: 0,
          depth: state.last >= 0 ? segments[state.last].depth + 1 : 0,
          parent: state.last,
          tip: false,
          tipScale: state.width,
        });
        state.last = segments.length - 1;
        state.pos = to;
        if (tropism) bendToward(state.frame, tropism, tropismAngle);
        break;
      }
      case "f":
        state.pos = vadd(state.pos, vscale(f.H, state.len));
        state.last = -1; // a move breaks the parent chain
        break;
      case "+": rotFrame(state.frame, "U", A); break;
      case "-": rotFrame(state.frame, "U", -A); break;
      case "&": rotFrame(state.frame, "L", A); break;
      case "^": rotFrame(state.frame, "L", -A); break;
      case "\\": rotFrame(state.frame, "H", R); break;
      case "/": rotFrame(state.frame, "H", -R); break;
      case "|": rotFrame(state.frame, "U", Math.PI); break;
      case "[": stack.push(clone(state)); break;
      case "]": {
        if (stack.length === 0) {
          errors.push(`']' with an empty stack at symbol ${i}`);
        } else state = stack.pop();
        break;
      }
      case "'": state.len *= lengthFactor; break;
      case "!": state.width *= widthFactor; break;
      default: break; // non-terminals pass through
    }
  });
  if (stack.length > 0) {
    errors.push(`${stack.length} unclosed '[' at end of program`);
  }
  if (pipe) pipeRadii(segments, tipRadius);
  return { segments, errors };
}

// -------------------------------------------------- botanical grammar -
/**
 * A stochastic branching tree. A is the growing apex/meristem: each
 * generation it lays down one internode F (shorter than its parent's,
 * via the leading '), throws two or three lateral branches — each
 * rolled 120° further around the stem (\ steps at rollAngle 120°) and
 * pitched outward (&) — and usually continues. The terminating
 * production ends a line, which is how crowns stay finite and shaggy.
 */
export const TREE_GRAMMAR = {
  axiom: "FA",
  rules: {
    A: [
      { production: "'F[&A][\\&A][\\\\&A]A", weight: 5 },
      { production: "'F[&A][\\&A]A", weight: 3 },
      { production: "'F[&A][\\&A]", weight: 2 },
    ],
  },
  params: {
    iterations: 5,
    length: 3.4,
    angle: 23,
    rollAngle: 120,
    lengthFactor: 0.8,
    widthFactor: 0.8,
    tipRadius: 0.085,
    tropism: [0, 1, 0],
    tropismAngle: 0.05,
  },
};

/** buildBotanicalTree(seed) → { segments, tips, errors } — deterministic per seed. */
export function buildBotanicalTree(seed = 7) {
  const { axiom, rules, params } = TREE_GRAMMAR;
  const rng = createRng(seed);
  const program = expand(axiom, rules, params.iterations, rng);
  const { segments, errors } = interpret(program, params);
  return {
    segments,
    tips: segments.filter((s) => s.tip),
    errors,
    program,
  };
}

// --------------------------------------------------------- data tree --
const GOLDEN_ANGLE = 2.399963229728653; // radians
const slug = (name) =>
  String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "node";

/**
 * buildDataTree(hierarchy, opts) — a hierarchy made spatial by DIRECT
 * RECURSION (not the string engine: the tree IS the data here).
 *
 * opts: { maxDepth = 3, length = 11 (root segment length),
 * decay = 0.74, tilt = 0.52 (radians of outward tilt per generation),
 * tipRadius = 0.3, seed = 11 }.
 *
 * Depth limiting & aggregation: nodes AT maxDepth (or childless nodes
 * at any depth) become TIPS — their value is the sum of every real
 * leaf beneath them in the full hierarchy, and leafCount counts those
 * leaves (a childless node counts itself once, value = its own value
 * ?? 0). Every node's `value` is its subtree total, so values sum
 * upward exactly.
 *
 * Geometry: the root segment runs from the origin along +Y. Each child
 * direction is the parent's direction tilted outward by `tilt` (scaled
 * a little by a seeded jitter) at a golden-angle azimuth about the
 * parent axis — siblings spiral instead of fanning flat. Child length
 * = parent length × decay × (0.62 + 0.6·√(child's share of the
 * parent's value)), so big subtrees reach further but small ones stay
 * visible. Radii by the same pipe model as the turtle's trees.
 *
 * Returns { segments, nodes, tips, branches, totalValue, leafCount,
 * maxDepth } — nodes carry { id (slug path), name, value, leafCount,
 * depth, segmentIndex, childIds, tip }; branches are the depth-1 node
 * records, each with `share` (of the total) and `sphere` (the subtree's
 * bounding sphere in tree space, for camera seats) and `tipPoint`
 * (the end of the branch's own segment, for label chips).
 */
export function buildDataTree(hierarchy, opts = {}) {
  const {
    maxDepth = 3,
    length = 11,
    decay = 0.74,
    tilt = 0.52,
    tipRadius = 0.3,
    seed = 11,
  } = opts;
  const rng = createRng(seed);

  // -- aggregate the raw hierarchy bottom-up (full depth) -------------
  const aggregate = (raw) => {
    const kids = (raw.children ?? []).map(aggregate);
    if (kids.length === 0) {
      return { name: raw.name, value: raw.value ?? 0, leafCount: 1, kids };
    }
    return {
      name: raw.name,
      value: kids.reduce((s, k) => s + k.value, 0),
      leafCount: kids.reduce((s, k) => s + k.leafCount, 0),
      kids,
    };
  };
  const aggRoot = aggregate(hierarchy);

  // -- spatial recursion ----------------------------------------------
  const segments = [];
  const nodes = [];
  const grow = (agg, id, depth, pos, dir, len, parentSeg, parentId = null) => {
    const to = vadd(pos, vscale(dir, len));
    const segIndex = segments.length;
    const isTip = depth >= maxDepth || agg.kids.length === 0;
    const node = {
      id,
      parentId,
      name: agg.name,
      value: agg.value,
      leafCount: agg.leafCount,
      depth,
      segmentIndex: segIndex,
      childIds: [],
      tip: isTip,
      end: to,
    };
    nodes.push(node);
    segments.push({
      from: [...pos], to: [...to],
      radius: 0, depth, parent: parentSeg, tip: false, nodeId: id,
    });
    if (!isTip) {
      // orthonormal basis about dir
      const ref = Math.abs(dir[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
      const a = vnorm(vcross(dir, ref));
      const b = vcross(dir, a);
      agg.kids.forEach((kid, i) => {
        const phi = i * GOLDEN_ANGLE + depth * 0.7;
        const t = tilt * (0.82 + 0.36 * rng());
        const share = agg.value > 0 ? kid.value / agg.value : 0;
        const childLen = len * decay * (0.62 + 0.6 * Math.sqrt(Math.max(0, share)));
        const radial = vadd(vscale(a, Math.cos(phi)), vscale(b, Math.sin(phi)));
        const childDir = vnorm(
          vadd(vscale(dir, Math.cos(t)), vscale(radial, Math.sin(t)))
        );
        const childId = `${id}/${slug(kid.name)}`;
        node.childIds.push(childId);
        grow(kid, childId, depth + 1, to, childDir, childLen, segIndex, id);
      });
    }
    return node;
  };
  grow(aggRoot, slug(aggRoot.name), 0, [0, 0, 0], [0, 1, 0], length, -1);
  pipeRadii(segments, tipRadius);

  // -- depth-1 branches with bounding spheres --------------------------
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const subtreeSegs = (node) => {
    const out = [segments[node.segmentIndex]];
    for (const cid of node.childIds) out.push(...subtreeSegs(byId.get(cid)));
    return out;
  };
  const branches = nodes
    .filter((n) => n.depth === 1)
    .map((n) => {
      const segs = subtreeSegs(n);
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (const s of segs) {
        for (const p of [s.from, s.to]) {
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], p[k]);
            hi[k] = Math.max(hi[k], p[k]);
          }
        }
      }
      const centre = lo.map((v, k) => (v + hi[k]) / 2);
      const radius = vlen(hi.map((v, k) => v - lo[k])) / 2;
      return {
        ...n,
        share: aggRoot.value > 0 ? n.value / aggRoot.value : 0,
        sphere: { centre, radius },
        tipPoint: [...segments[n.segmentIndex].to],
      };
    });

  let actualDepth = 0;
  for (const n of nodes) actualDepth = Math.max(actualDepth, n.depth);
  return {
    segments,
    nodes,
    tips: nodes.filter((n) => n.tip),
    branches,
    byId,
    totalValue: aggRoot.value,
    leafCount: aggRoot.leafCount,
    maxDepth: actualDepth,
  };
}

/** Lookups for the app layer (readout, panels, focus). */
export function dataBranchById(tree, id) {
  return tree.branches.find((b) => b.id === id) ?? null;
}
export function dataNodeById(tree, id) {
  return tree.byId.get(id) ?? null;
}
