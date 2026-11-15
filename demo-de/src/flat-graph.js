/**
 * flat-graph.js — Flat Space as a USER FLOW GRAPH, as pure data.
 *
 * The desktop environment, stated as nodes and access paths:
 *
 *   - WHAT EXISTS: a shell node, one node per frame, and subnodes —
 *     the things inside frames that can be addressed (treemap and
 *     sunburst branches, monitor lanes, mail folders, web pages, the
 *     operations card). Branch subnodes carry `descends: true`:
 *     subnodes continue below them by descent (F descends, D climbs),
 *     as deep as the data goes.
 *   - HOW YOU MOVE: edges are the actual access operations of the
 *     environment, not decorations —
 *       OPEN   shell → HOME (where you arrive)
 *       F      parent → child (open a frame, descend, follow, focus)
 *       D      child → parent (back within the frame's own scope)
 *       ESC    frame → HOME (release in a big way)
 *       TAB    frame → first subnode (Tab then cycles the siblings)
 *       SEARCH shell → any node (the / jump: direct access)
 *   - WHAT'S MISSING: the usual things people do on Linux that this
 *     environment does not have yet are nodes too — kind "gap",
 *     attached to the shell with via "NOT YET". The paradigm changes
 *     everything about HOW these are operated; it does not drop any
 *     of them. A gap node is a promise with a name, drawn dashed.
 *
 * The graph is BUILT FROM THE LIVE REGISTRIES (the app's FRAMES,
 * ACTIVITY_LANES, FOLDERS, web pages and the filesystem's top
 * level), so it cannot drift from the environment it describes: add
 * a frame and it appears here, with its access edges, automatically.
 */

export const USUAL_ACTIVITIES = [
  { activity: "File management", frame: "files", status: "present" },
  { activity: "Web browsing", frame: "web", status: "present" },
  { activity: "Email", frame: "mail", status: "present" },
  { activity: "System monitoring", frame: "monitor", status: "present" },
  { activity: "Data viewing", frame: "sunburst", status: "present" },
  { activity: "Terminal / shell", frame: "terminal", status: "present" },
  { activity: "Documents & text editing", frame: "docs", status: "present" },
  { activity: "Media — music, video, photos", frame: "media", status: "present" },
  { activity: "Software — install & update", frame: "software", status: "present" },
  { activity: "Settings", frame: "settings", status: "present" },
  { activity: "Chat & messaging", frame: "chat", status: "present" },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Build the graph. Inputs are the app's own registries:
 *   frames:   [{ id, name, sub }]                 (FRAMES)
 *   lanes:    [{ id, label }]                     (ACTIVITY_LANES)
 *   folders:  [{ id, name }]                      (mail FOLDERS)
 *   webPages: [{ id, title }]                     (WEB_PAGES)
 *   flareTop: [{ name, leafCount }]               (treemap/sunburst top level)
 */
export function buildFlowGraph({ frames, lanes, folders, webPages, flareTop, extraSubs = [] }) {
  const nodes = [];
  const edges = [];
  const node = (id, kind, name, frame, extra = {}) => {
    const n = { id, kind, name, frame, ...extra };
    nodes.push(n);
    return n;
  };
  const edge = (from, to, via) => edges.push({ from, to, via });

  node("shell", "shell", "FLAT SPACE", null, { desc: "The environment. You arrive at HOME." });
  edge("shell", "frame:home", "OPEN");

  for (const f of frames) {
    node(`frame:${f.id}`, "frame", f.name, f.id, { desc: f.sub });
    if (f.id !== "home") {
      edge("frame:home", `frame:${f.id}`, "F"); // the Home card
      edge(`frame:${f.id}`, "frame:home", "ESC"); // release leaves the frame
    }
  }

  const sub = (frameId, key, name, extra = {}) => {
    const id = `sub:${frameId}:${key}`;
    node(id, "subnode", name, frameId, extra);
    edge(`frame:${frameId}`, id, "F");
    edge(id, `frame:${frameId}`, "D");
    return id;
  };

  // HOME's own subnode: the operations stream card (the frames are
  // reached through Home, above, so they are not repeated here).
  sub("home", "ops", "OPERATIONS STREAM", { jump: "monitor", desc: "Live operations — rides the MONITOR frame" });

  // FILES + SUNBURST share the filesystem's top level; branches
  // descend, so their subnodes continue below these.
  for (const b of flareTop) {
    sub("files", b.name, b.name, { descends: true, jumpNode: b.name, desc: `branch — F descends (${b.leafCount} leaves below)` });
    sub("sunburst", b.name, b.name, { descends: true, jumpNode: b.name, desc: `branch — F descends (${b.leafCount} leaves below)` });
  }
  // MONITOR lanes.
  for (const l of lanes) sub("monitor", l.id, l.label, { jumpLane: l.id, desc: "lane — F or its digit focuses" });
  // MAIL folders + compose.
  for (const fo of folders) sub("mail", `folder:${fo.id}`, fo.name.toUpperCase(), { jumpFolder: fo.id, desc: "folder" });
  sub("mail", "compose", "COMPOSE", { jumpAction: "compose", desc: "write — real text mode" });
  // WEB pages.
  for (const p of webPages) sub("web", p.id, p.title, { jumpPage: p.id, desc: p.url || "captured page" });
  // The app frames' own subnodes (settings, threads, documents,
  // commands, media items, managed frames) — supplied by the host
  // from the same data the apps render.
  for (const s of extraSubs) sub(s.frame, s.key, s.name, { desc: s.desc || "", jumpApp: s.key });
  // FLOW's subnodes are the graph itself: F on a node jumps. Modelled
  // as edges from the FLOW frame to every frame node.
  for (const f of frames) if (f.id !== "flow") edge("frame:flow", `frame:${f.id}`, "F");

  // TAB: one edge per frame that has subnodes — Tab enters the cycle.
  const framesWithSubs = [...new Set(nodes.filter((n) => n.kind === "subnode").map((n) => n.frame))];
  for (const fid of framesWithSubs) {
    const first = nodes.find((n) => n.kind === "subnode" && n.frame === fid);
    if (first) edge(`frame:${fid}`, first.id, "TAB");
  }
  // SEARCH: the / jump reaches every frame and subnode directly.
  for (const n of nodes) {
    if (n.kind === "frame" || n.kind === "subnode") edge("shell", n.id, "SEARCH");
  }
  // GAPS: the usual activities not yet in the environment.
  for (const a of USUAL_ACTIVITIES.filter((x) => x.status === "gap")) {
    const id = `gap:${slug(a.activity)}`;
    node(id, "gap", a.activity.toUpperCase(), null, { desc: "a usual Linux activity — not built yet; the paradigm keeps it, operated the key-click way when it comes" });
    edge("shell", id, "NOT YET");
  }

  return { nodes, edges };
}

/** All node ids reachable from `startId` following directed edges. */
export function reachableFrom(graph, startId) {
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of graph.edges) {
      if (e.from === cur && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
    }
  }
  return seen;
}

/** The distinct ways INTO a node: [{ via, from }]. */
export function accessPaths(graph, nodeId) {
  return graph.edges.filter((e) => e.to === nodeId).map((e) => ({ via: e.via, from: e.from }));
}

/**
 * One frame's own graph, for the FLOW frame's drill-in view: the
 * frame node, its subnodes, and each subnode's contents (children)
 * — the graph the frame would draw of itself, brought into FLOW
 * instead of FLOW exiting to the frame. childrenOf(sub) returns
 * [{ key, name, desc }]. Edges: F descends (frame → sub → child),
 * D returns.
 */
export function buildFrameGraph(frameNode, subs, childrenOf) {
  const nodes = [{ ...frameNode }];
  const edges = [];
  for (const s of subs) {
    nodes.push(s);
    edges.push({ from: frameNode.id, to: s.id, via: "F" });
    edges.push({ from: s.id, to: frameNode.id, via: "D" });
    for (const c of childrenOf(s) || []) {
      const id = `child:${s.id}:${c.key}`;
      nodes.push({ id, kind: "child", frame: s.frame, name: c.name, desc: c.desc || "", parentSub: s.id });
      edges.push({ from: s.id, to: id, via: "F" });
      edges.push({ from: id, to: s.id, via: "D" });
    }
  }
  return { nodes, edges };
}
