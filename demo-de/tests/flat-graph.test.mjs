// Node tests for the user flow graph model (src/flat-graph.js).
// Run: node tests/flat-graph.test.mjs  (from demo-de/)
import assert from "node:assert";
import { buildFlowGraph, reachableFrom, accessPaths, USUAL_ACTIVITIES } from "../src/flat-graph.js";

let n = 0;
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };
const ok = (v, m) => { assert.ok(v, m); n++; };

const frames = [
  { id: "home", name: "HOME", sub: "bulletin board" },
  { id: "files", name: "FILES", sub: "treemap navigator" },
  { id: "monitor", name: "MONITOR", sub: "horizon lanes" },
  { id: "sunburst", name: "SUNBURST", sub: "zui plane viewer" },
  { id: "mail", name: "MAIL", sub: "folders · list · reading" },
  { id: "web", name: "WEB", sub: "captured pages" },
  { id: "flow", name: "FLOW", sub: "user flow graph" },
  { id: "settings", name: "SETTINGS", sub: "environment controls" },
  { id: "chat", name: "CHAT", sub: "channels" },
  { id: "docs", name: "DOCUMENTS", sub: "notes" },
  { id: "terminal", name: "TERMINAL", sub: "flat sh" },
  { id: "media", name: "MEDIA", sub: "tracks" },
  { id: "software", name: "SOFTWARE", sub: "manage the frames" },
];
const g = buildFlowGraph({
  frames,
  lanes: [{ id: "net-in", label: "NETWORK IN" }, { id: "cpu", label: "PROCESSOR" }],
  folders: [{ id: "inbox", name: "Inbox" }, { id: "sent", name: "Sent" }],
  webPages: [{ id: "start", title: "Start", url: "flat://start" }],
  flareTop: [{ name: "analytics", leafCount: 12 }, { name: "vis", leafCount: 9 }],
  extraSubs: [
    { frame: "settings", key: "accent", name: "ACCENT", desc: "setting" },
    { frame: "chat", key: "thread:ops", name: "OPS CHANNEL", desc: "channel" },
  ],
});
const byId = new Map(g.nodes.map((x) => [x.id, x]));

// Integrity: unique ids; every edge endpoint exists.
eq(new Set(g.nodes.map((x) => x.id)).size, g.nodes.length, "node ids unique");
for (const e of g.edges) { ok(byId.has(e.from), `edge from exists: ${e.from}`); ok(byId.has(e.to), `edge to exists: ${e.to}`); }

// Shape: shell + 13 frames + subnodes (1 ops + 2x2 branches + 2 lanes
// + 2 folders + compose + 1 page + 2 app subnodes = 13) + 0 gaps —
// every usual activity has a frame now.
eq(g.nodes.filter((x) => x.kind === "shell").length, 1);
eq(g.nodes.filter((x) => x.kind === "frame").length, 13);
eq(g.nodes.filter((x) => x.kind === "subnode").length, 13, "subnode count");
eq(g.nodes.filter((x) => x.kind === "gap").length, 0, "no usual activities are gaps");

// Reachability: every node is reachable from the shell. (The gap
// branch below is vacuous now — no gaps remain — but keeps the
// invariant checked if a future activity ever regresses to a gap.)
const reach = reachableFrom(g, "shell");
for (const x of g.nodes) if (x.kind !== "gap") ok(reach.has(x.id), `reachable: ${x.id}`);
for (const x of g.nodes) if (x.kind === "gap") {
  const into = accessPaths(g, x.id);
  eq(into.length, 1, `gap has exactly one inbound: ${x.id}`);
  eq(into[0].via, "NOT YET", "gap inbound is NOT YET");
}

// Access paths tell the truth about the environment's keys.
ok(accessPaths(g, "frame:mail").some((p) => p.via === "F" && p.from === "frame:home"), "MAIL opens from HOME with F");
ok(accessPaths(g, "frame:home").some((p) => p.via === "ESC" && p.from === "frame:mail"), "ESC leaves MAIL for HOME");
ok(accessPaths(g, "sub:files:analytics").some((p) => p.via === "F"), "branch reached by F");
ok(accessPaths(g, "frame:files").some((p) => p.via === "D" && p.from === "sub:files:analytics"), "D climbs from branch to frame");
ok(accessPaths(g, "sub:web:start").some((p) => p.via === "SEARCH" && p.from === "shell"), "search jumps straight to a web page");
ok(accessPaths(g, "sub:monitor:net-in").some((p) => p.via === "TAB"), "TAB enters the lane cycle");

// Branches descend: subnodes continue below them.
eq(byId.get("sub:files:analytics").descends, true);
eq(byId.get("sub:monitor:cpu").descends, undefined, "lanes do not descend");

// Activities coverage: every present activity names a real frame.
for (const a of USUAL_ACTIVITIES) {
  if (a.status === "present") ok(frames.some((f) => f.id === a.frame), `activity frame exists: ${a.activity}`);
  else eq(a.frame, null, `gap activity has no frame: ${a.activity}`);
}

console.log(`flat-graph: ${n} checks pass`);
