import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  buildTreemap,
  descendants as tmDescendants,
  ancestors as tmAncestors,
} from "../NCTGraphite/packages/nctgraphite/src/treemap/NCTGraphiteTreemapLayout.ts";
import {
  buildSunburst,
  descendants as sbDescendants,
  ancestors as sbAncestors,
  sunburstColourScale,
} from "../NCTGraphite/packages/nctgraphite/src/sunburst/NCTGraphiteSunburstLayout.ts";
import {
  ACTIVITY_LANES,
  createMonitor,
  horizonBandColor,
  horizonBandFill,
  horizonY,
  SCHEME_BLUES,
  SCHEME_GREENS,
} from "../NCTGraphite/packages/nctgraphite/src/horizon/NCTGraphiteHorizon.ts";
import {
  NCTParameterPanel,
  useNCTParameters,
} from "../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";
import { FS_TREE, FOLDERS, MAIL_SEED, THREADS_SEED, DOCS_SEED, MEDIA_ITEMS } from "./flat-data.js";
import {
  assignLabels,
  resolveBuffer,
  isLabelKey,
  isTextEntryControl,
  resolveBoard,
} from "./flat-keys.js";
import { buildFlowGraph, buildFrameGraph, USUAL_ACTIVITIES } from "./flat-graph.js";
import { createNav, navOpenFrame, navPush, navPop, navSetTop, navBackPlan, navEnterText, navExitText, navTop, navCrumbs, MODE_TEXT } from "./flat-nav.js";
import { WEB_PAGES, webPageById, resolveWebAddress } from "./flat-web.js";
/* The standing rule (2026-11-14): every app in the 2D environment is
   made out of paramorphic components; gaps become framework features.
   HOME is the first frame rebuilt that way — a GuiDocument of panel /
   text-block / text-label nodes hosted by the app-kit's AddressedGui,
   the key-click addressing layer backwards-derived into the framework
   from this app (paramorphic-components feat/addressed-gui). */
import { AddressedGui } from "../paramorphic-components/src/framework/app-kit/controls/AddressedGui.tsx";
import { HostSurface } from "../paramorphic-components/src/framework/app-kit/controls/HostSurface.tsx";
import { AppToolbar, AppStatus } from "../paramorphic-components/src/framework/app-kit/Chrome.tsx";
import "../paramorphic-components/src/framework/app-kit/controls/controls.css";

/**
 * FLAT SPACE — the 2D environment view, the peer of ui-space/ (the
 * 3D view). A full interactive 2D desktop environment built out of
 * key-clicks and d3.js layouts.
 *
 * The desktop fills the whole viewport; everything that was a panel
 * around it is now a stationary OVERLAY on top of it — top system
 * bar, Navigator rail, Inspector, command-line footer, keyboard
 * panel — each collapsible, none of them owning the surface. This is
 * the same move UI Space made, in the flat register.
 *
 * Input is one system, shared by view and handler (flat-keys.js):
 *  - everything targetable wears a label (alphabet skips C, D, F, V —
 *    the operators are not addresses); typing a label targets it;
 *  - F clicks the addressee — the hovered thing wins, else the
 *    targeted thing (the UI Space F rule); the mouse mirrors it;
 *  - D goes back WITHIN the frame's own scope; Esc releases in a big
 *    way (clear target, then leave the frame for Home);
 *  - V / C dolly the view into / out of whatever is being looked at;
 *  - Space is the frame's own verb (drag-lock on Home, hold time on
 *    the Monitor); Tab cycles targets; / searches; Alt+K toggles the
 *    keyboard panel, resolved SPARSELY per scope from the same
 *    binding tables the handler consults.
 *
 * The environment is also a USER FLOW GRAPH (flat-graph.js): nodes
 * are frames and the subnodes inside them, edges are the actual
 * access operations (F, D, Esc, Tab, search). The FLOW frame renders
 * that graph — built from the live registries, so it cannot drift —
 * and its nodes are themselves addressable: F on a node goes there.
 * The graph also carries the GAP nodes: the usual things people do
 * on Linux that are not built yet (terminal, documents, media,
 * software, settings, chat). The paradigm changes how each will be
 * operated; it drops none of them.
 *
 * Frames: HOME (bulletin board, drag-lock cards), FILES (2D treemap
 * file navigator), MONITOR (realtime horizon lanes), SUNBURST (ZUI
 * 2D-plane viewer), MAIL (folders/list/reading + compose in real
 * text mode), WEB (captured pages, Detach-style: links are
 * subnodes, D is history back), FLOW (the graph itself).
 */

const FRAMES = [
  { id: "home", name: "HOME", sub: "bulletin board", color: "#ffa726" },
  { id: "files", name: "FILES", sub: "treemap navigator", color: "#7fd4c1" },
  { id: "monitor", name: "MONITOR", sub: "horizon lanes", color: "#82aaff" },
  { id: "sunburst", name: "SUNBURST", sub: "zui plane viewer", color: "#c792ea" },
  { id: "mail", name: "MAIL", sub: "folders · list · reading", color: "#addb67" },
  { id: "web", name: "WEB", sub: "captured pages · detached", color: "#ffcc80" },
  { id: "flow", name: "FLOW", sub: "user flow graph", color: "#90caf9" },
  { id: "settings", name: "SETTINGS", sub: "environment controls", color: "#ffb74d" },
  { id: "chat", name: "CHAT", sub: "channels · messaging", color: "#81d4fa" },
  { id: "docs", name: "DOCUMENTS", sub: "notes · text editing", color: "#dce775" },
  { id: "terminal", name: "TERMINAL", sub: "flat sh · the shell", color: "#a5d6a7" },
  { id: "media", name: "MEDIA", sub: "tracks · clips · stills", color: "#f48fb1" },
  { id: "software", name: "SOFTWARE", sub: "manage the frames", color: "#b39ddb" },
];
const frameById = (id) => FRAMES.find((f) => f.id === id);


const SAMPLES = 480;
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const nodePath = (node, ancestorsFn) => ancestorsFn(node).map((n) => n.name).join(" / ");

function countLeaves(n) {
  return n.children && n.children.length ? n.children.reduce((s, c) => s + countLeaves(c), 0) : 1;
}

/* Lay the flow graph out in columns — shell → frames → subnodes —
   with the gap nodes in rows of their own along the bottom.
   Returns { pos: Map(id → {x, y}), w, h } in viewBox units. */
function layoutFlowGraph(g) {
  const ROW = 30;
  const TOP = 22; // pad so the first row's nodes are not clipped by the viewBox edge
  const frames = g.nodes.filter((nd) => nd.kind === "frame");
  const subsOf = (fid) => g.nodes.filter((nd) => nd.kind === "subnode" && nd.frame === fid);
  const pos = new Map();
  let row = 0;
  const frameY = {};
  for (const f of frames) {
    const subs = subsOf(f.frame);
    const rows = Math.max(1, subs.length);
    const y0 = TOP + row * ROW;
    frameY[f.frame] = y0 + ((rows - 1) * ROW) / 2;
    subs.forEach((s, i) => pos.set(s.id, { x: 620, y: y0 + i * ROW }));
    row += rows;
  }
  for (const f of frames) pos.set(f.id, { x: 330, y: frameY[f.frame] });
  pos.set("shell", { x: 80, y: frameY.home ?? TOP + ((row - 1) * ROW) / 2 });
  const gaps = g.nodes.filter((nd) => nd.kind === "gap");
  const gapY = TOP + row * ROW + 30;
  gaps.forEach((nd, i) => pos.set(nd.id, { x: 150 + (i % 3) * 300, y: gapY + Math.floor(i / 3) * ROW }));
  return { pos, w: 940, h: gapY + Math.ceil(gaps.length / 3) * ROW + 14 };
}

/* A frame's own graph inside FLOW: frame node left, subnodes in a
   column, each subnode's contents fanned to the right. */
function layoutFrameGraph(g) {
  const ROW = 30;
  const TOP = 22;
  const subs = g.nodes.filter((nd) => nd.kind === "subnode");
  const kidsOf = (sid) => g.nodes.filter((nd) => nd.kind === "child" && nd.parentSub === sid);
  const pos = new Map();
  let row = 0;
  for (const s of subs) {
    const kids = kidsOf(s.id);
    const rows = Math.max(1, kids.length);
    const y0 = TOP + row * ROW;
    pos.set(s.id, { x: 350, y: y0 + ((rows - 1) * ROW) / 2 });
    kids.forEach((c, i) => pos.set(c.id, { x: 690, y: y0 + i * ROW }));
    row += rows;
  }
  const frameNode = g.nodes.find((nd) => nd.kind === "frame");
  if (frameNode) pos.set(frameNode.id, { x: 100, y: TOP + ((Math.max(1, row) - 1) * ROW) / 2 });
  return { pos, w: 940, h: TOP + row * ROW + 14 };
}

/* Sunburst arc path in a 640 box, centre 320. Angles: 0 = up, clockwise. */
function arcPath(a0, a1, r0, r1) {
  const pt = (a, r) => [320 + r * Math.sin(a), 320 - r * Math.cos(a)];
  const [sx, sy] = pt(a0, r1);
  const [ex, ey] = pt(a1, r1);
  const [iex, iey] = pt(a1, r0);
  const [isx, isy] = pt(a0, r0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  if (r0 <= 0.5) {
    return `M320 320 L${sx.toFixed(1)} ${sy.toFixed(1)} A${r1} ${r1} 0 ${large} 1 ${ex.toFixed(1)} ${ey.toFixed(1)} Z`;
  }
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} A${r1} ${r1} 0 ${large} 1 ${ex.toFixed(1)} ${ey.toFixed(1)} L${iex.toFixed(1)} ${iey.toFixed(1)} A${r0} ${r0} 0 ${large} 0 ${isx.toFixed(1)} ${isy.toFixed(1)} Z`;
}

function LaneCanvas({ series, bands, step, focused }) {
  const ref = useRef(null);
  const h = focused ? step * 2 : step;
  const scheme = series.lane.scheme === "greens" ? SCHEME_GREENS : SCHEME_BLUES;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0d1216";
    ctx.fillRect(0, 0, SAMPLES, h);
    const data = series.data;
    for (let j = 0; j < SAMPLES; j++) {
      const y = horizonY(data[j], bands, h);
      for (let i = 0; i < bands; i++) {
        const fill = horizonBandFill(y, h, i);
        if (fill > 0) {
          ctx.fillStyle = horizonBandColor(scheme, bands, i);
          ctx.fillRect(j, h - fill, 1, fill);
        }
      }
    }
  });
  return <canvas ref={ref} width={SAMPLES} height={h} style={{ width: "100%", height: h, imageRendering: "pixelated", display: "block" }} />;
}

const PARAM_DEFS = {
  monitor: [
    { id: "bands", label: "Bands", type: "number", min: 1, max: 7, step: 1, defaultValue: 4 },
    { id: "step", label: "Strip height", type: "number", min: 18, max: 40, step: 2, defaultValue: 26 },
    { id: "running", label: "Running", type: "boolean", defaultValue: true },
  ],
  sunburst: [
    { id: "rings", label: "Rings", type: "number", min: 2, max: 3, step: 1, defaultValue: 2 },
  ],
  files: [
    { id: "minw", label: "Min label width %", type: "number", min: 3, max: 10, step: 1, defaultValue: 4 },
  ],
};

/* HOME as a paramorphic GuiDocument: one panel node per card, a
   text-block for its description, a text-label for its sub-line.
   Positions come from the same cardPos percentages the drag-lock
   edits, converted against the measured board size. Node ids mirror
   the addressable ids behind a "gui:" prefix (card:files ->
   gui:card:files) so the addressing layer and the key core share
   one naming. */
const guiIdOf = (addrId) => `gui:${addrId}`;
function homeDocument(cards, cardPos, drag, size) {
  const nodes = [];
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  for (const c of cards) {
    const pos = drag && drag.id === c.cid ? { x: drag.x, y: drag.y } : cardPos[c.cid];
    if (!pos) continue;
    const r = {
      x: Math.round((pos.x / 100) * size.w),
      y: Math.round((pos.y / 100) * size.h),
      w: Math.round(0.235 * size.w),
      h: 140,
    };
    const id = guiIdOf(c.id);
    nodes.push({ id, type: "panel", parentId: null, props: { title: c.name, radius: 4 }, layouts: L(r) });
    nodes.push({ id: `${id}:desc`, type: "text-block", parentId: id, props: { title: c.desc }, layouts: L({ x: 10, y: 32, w: r.w - 20, h: 56 }) });
    nodes.push({ id: `${id}:sub`, type: "text-block", parentId: id, props: { title: c.sub }, layouts: L({ x: 10, y: 96, w: r.w - 20, h: 36 }) });
  }
  return { schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes };
}

/* Measure an element into state (GuiDocuments lay out in px). */
function useSize(ref, deps) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = () => setS({ w: el.clientWidth, h: el.clientHeight });
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, deps);
  return s;
}

/* MAIL as a GuiDocument: folder buttons, one panel per message, a
   reading panel — or, in compose, the app-kit's field controls with
   SEND / DISCARD as addressed pro-buttons. */
function mailDocument({ folders, folderMail, openMail, composeOpen, size }) {
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  const nodes = [];
  const W = size.w, H = size.h;
  const doc = () => ({ schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes });
  if (composeOpen) {
    const fw = Math.min(620, W - 96);
    nodes.push({ id: "gui:lbl-to", type: "text-label", parentId: null, props: { title: "TO" }, layouts: L({ x: 12, y: 16, w: 56, h: 20 }) });
    nodes.push({ id: "gui:cmp-to", type: "input-field", parentId: null, props: { placeholder: "name@example.com" }, layouts: L({ x: 76, y: 10, w: fw, h: 30 }) });
    nodes.push({ id: "gui:lbl-subject", type: "text-label", parentId: null, props: { title: "SUBJECT" }, layouts: L({ x: 12, y: 62, w: 56, h: 20 }) });
    nodes.push({ id: "gui:cmp-subject", type: "input-field", parentId: null, props: { placeholder: "Subject" }, layouts: L({ x: 76, y: 56, w: fw, h: 30 }) });
    nodes.push({ id: "gui:lbl-body", type: "text-label", parentId: null, props: { title: "MESSAGE" }, layouts: L({ x: 12, y: 108, w: 56, h: 20 }) });
    nodes.push({ id: "gui:cmp-body", type: "text-area", parentId: null, props: { placeholder: "Write… (keys are text now; Esc leaves text mode)" }, layouts: L({ x: 76, y: 102, w: fw, h: Math.max(80, H - 168) }) });
    nodes.push({ id: "gui:act:send", type: "pro-button", parentId: null, props: { title: "SEND", styleVariant: "blue", radius: 4 }, layouts: L({ x: 76, y: H - 52, w: 150, h: 34 }) });
    nodes.push({ id: "gui:act:discard", type: "pro-button", parentId: null, props: { title: "DISCARD", radius: 4 }, layouts: L({ x: 238, y: H - 52, w: 150, h: 34 }) });
    return doc();
  }
  folders.forEach((fo, i) => {
    nodes.push({ id: guiIdOf(`folder:${fo.id}`), type: "pro-button", parentId: null, props: { title: `${fo.name.toUpperCase()} · ${fo.count}`, radius: 4 }, layouts: L({ x: 10, y: 10 + i * 40, w: 168, h: 32 }) });
  });
  nodes.push({ id: "gui:act:compose", type: "pro-button", parentId: null, props: { title: "✉ COMPOSE", styleVariant: "blue", radius: 4 }, layouts: L({ x: 10, y: 18 + folders.length * 40, w: 168, h: 32 }) });
  const listX = 190, listW = Math.max(230, Math.floor((W - 202) * 0.38));
  folderMail.forEach((m, i) => {
    const id = guiIdOf(`mail:${m.id}`);
    const r = { x: listX, y: 10 + i * 76, w: listW, h: 68 };
    nodes.push({ id, type: "panel", parentId: null, props: { title: m.subject, radius: 4 }, layouts: L(r) });
    nodes.push({ id: `${id}:meta`, type: "text-label", parentId: id, props: { title: `${m.from} · ${m.when}` }, layouts: L({ x: 10, y: 28, w: r.w - 20, h: 15 }) });
    nodes.push({ id: `${id}:snip`, type: "text-block", parentId: id, props: { title: `${m.body.slice(0, 72)}…` }, layouts: L({ x: 10, y: 44, w: r.w - 20, h: 20 }) });
  });
  if (!folderMail.length) nodes.push({ id: "gui:mail-empty", type: "text-block", parentId: null, props: { title: "No messages in this folder yet." }, layouts: L({ x: listX, y: 14, w: listW, h: 20 }) });
  const readX = listX + listW + 12, readW = W - readX - 10;
  nodes.push({ id: "gui:read", type: "panel", parentId: null, props: { title: openMail ? openMail.subject : "READING", radius: 4 }, layouts: L({ x: readX, y: 10, w: readW, h: H - 20 }) });
  nodes.push({ id: "gui:read:meta", type: "text-label", parentId: "gui:read", props: { title: openMail ? `from ${openMail.from} · ${openMail.when}` : "" }, layouts: L({ x: 12, y: 30, w: readW - 24, h: 15 }) });
  nodes.push({ id: "gui:read:body", type: "text-block", parentId: "gui:read", props: { title: openMail ? openMail.body : "Open a message with F — or click it." }, layouts: L({ x: 12, y: 54, w: readW - 24, h: H - 90 }) });
  return doc();
}

/* WEB as a GuiDocument: browser chrome (back / forward / address
   field riding the framework's onSubmit channel) over the captured
   page as a panel of text blocks, its links addressed pro-buttons. */
function webDocument({ page, hasFwd, size }) {
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  const nodes = [];
  const W = size.w, H = size.h;
  nodes.push({ id: "gui:web-back", type: "pro-button", parentId: null, props: { title: "◂ BACK · D", radius: 4 }, layouts: L({ x: 8, y: 8, w: 118, h: 32 }) });
  if (hasFwd) nodes.push({ id: "gui:act:web-fwd", type: "pro-button", parentId: null, props: { title: "FORWARD ▸", radius: 4 }, layouts: L({ x: 134, y: 8, w: 118, h: 32 }) });
  const addrX = hasFwd ? 260 : 134;
  nodes.push({ id: "gui:web-addr", type: "input-field", parentId: null, props: { placeholder: "flat:// address — Enter goes" }, layouts: L({ x: addrX, y: 8, w: W - addrX - 148, h: 32 }) });
  nodes.push({ id: "gui:web-badge", type: "text-label", parentId: null, props: { title: "CAPTURED · DETACHED" }, layouts: L({ x: W - 138, y: 14, w: 130, h: 20 }) });
  const pw = W - 16;
  nodes.push({ id: "gui:page", type: "panel", parentId: null, props: { title: page.title, radius: 4 }, layouts: L({ x: 8, y: 50, w: pw, h: H - 58 }) });
  nodes.push({ id: "gui:page:url", type: "text-label", parentId: "gui:page", props: { title: page.url }, layouts: L({ x: 14, y: 30, w: pw - 28, h: 15 }) });
  let y = 58;
  const cpl = Math.max(20, Math.floor((pw - 28) / 7.0));
  page.blocks.forEach((bl, i) => {
    if (bl.t === "h") {
      nodes.push({ id: `gui:page:b${i}`, type: "text-label", parentId: "gui:page", props: { title: bl.text }, layouts: L({ x: 14, y, w: pw - 28, h: 22 }) });
      y += 30;
    } else {
      const lines = Math.max(1, Math.ceil(bl.text.length / cpl));
      const h = lines * 18 + 4;
      nodes.push({ id: `gui:page:b${i}`, type: "text-block", parentId: "gui:page", props: { title: bl.text }, layouts: L({ x: 14, y, w: pw - 28, h }) });
      y += h + 8;
    }
  });
  y += 6;
  nodes.push({ id: "gui:page:links-h", type: "text-label", parentId: "gui:page", props: { title: "LINKS ON THIS PAGE — each one is a subnode" }, layouts: L({ x: 14, y, w: pw - 28, h: 18 }) });
  y += 26;
  page.links.forEach((l, i) => {
    nodes.push({ id: guiIdOf(`link:${l.to}`), type: "pro-button", parentId: "gui:page", props: { title: l.text, radius: 4 }, layouts: L({ x: 14, y: y + i * 38, w: Math.min(430, pw - 28), h: 30 }) });
  });
  return { schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes };
}

/* ---------------- the app frames (the former gap apps) ---------------- */

const ACCENTS = [
  { name: "AMBER", hex: "#ffa726" },
  { name: "TEAL", hex: "#7fd4c1" },
  { name: "VIOLET", hex: "#c792ea" },
];

/* SETTINGS as a GuiDocument: one panel, four control rows. The
   values ride the renderer's values channel; F on a setting cycles
   or flips it (the scope builder owns that), dragging works too. */
function settingsDocument({ size }) {
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  const nodes = [];
  const W = size.w, H = size.h;
  nodes.push({ id: "gui:set-panel", type: "panel", parentId: null, props: { title: "Environment", radius: 4 }, layouts: L({ x: 8, y: 8, w: W - 16, h: H - 16 }) });
  nodes.push({ id: "gui:set-head", type: "text-block", parentId: "gui:set-panel", props: { title: "These take effect immediately, everywhere in the environment." }, layouts: L({ x: 16, y: 34, w: W - 48, h: 20 }) });
  const rows = [
    { key: "accent", label: "ACCENT", type: "segmented-control", props: { segments: ACCENTS.map((a) => a.name) } },
    { key: "dolly", label: "DOLLY STEP", type: "slider", props: {} },
    { key: "chips", label: "LABEL CHIPS", type: "toggle", props: {} },
    { key: "rate", label: "MONITOR RATE", type: "slider", props: {} },
  ];
  rows.forEach((row, i) => {
    const y = 74 + i * 62;
    nodes.push({ id: `gui:set-lbl-${row.key}`, type: "text-label", parentId: "gui:set-panel", props: { title: row.label }, layouts: L({ x: 16, y: y + 4, w: 140, h: 18 }) });
    nodes.push({ id: guiIdOf(`set:${row.key}`), type: row.type, parentId: "gui:set-panel", props: row.props, layouts: L({ x: 168, y, w: Math.min(320, W - 400), h: 26 }) });
    nodes.push({ id: `gui:set-val-${row.key}`, type: "text-label", parentId: "gui:set-panel", props: { title: "" }, layouts: L({ x: 504, y: y + 4, w: W - 536, h: 18 }) });
  });
  return { schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes };
}


/* CHAT as a GuiDocument: channel buttons, a message panel whose
   text-blocks are the conversation, and a field + SEND riding the
   framework's submit channel. */
function chatDocument({ threads, thread, msgs, size }) {
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  const nodes = [];
  const W = size.w, H = size.h;
  threads.forEach((t, i) => {
    nodes.push({ id: guiIdOf(`thread:${t.id}`), type: "pro-button", parentId: null, props: { title: t.name, radius: 4, ...(t.id === thread.id ? { styleVariant: "blue" } : {}) }, layouts: L({ x: 10, y: 10 + i * 40, w: 168, h: 32 }) });
  });
  const px = 190, pw = W - px - 10;
  nodes.push({ id: "gui:chat-panel", type: "panel", parentId: null, props: { title: thread.name, radius: 4 }, layouts: L({ x: px, y: 10, w: pw, h: H - 20 }) });
  const cpl = Math.max(20, Math.floor((pw - 28) / 7.0));
  let y = 38;
  for (const m of msgs.slice(-9)) {
    const text = `${m.from === "you" ? "YOU" : thread.who.toUpperCase()} · ${m.text}`;
    const lines = Math.max(1, Math.ceil(text.length / cpl));
    const h = lines * 18 + 4;
    nodes.push({ id: `gui:chat-m-${y}`, type: "text-block", parentId: "gui:chat-panel", props: { title: text }, layouts: L({ x: 14, y, w: pw - 28, h }) });
    y += h + 6;
  }
  nodes.push({ id: "gui:chat-in", type: "input-field", parentId: "gui:chat-panel", props: { placeholder: `Message ${thread.name} — Enter sends` }, layouts: L({ x: 14, y: H - 84, w: pw - 170, h: 30 }) });
  nodes.push({ id: "gui:act:chat-send", type: "pro-button", parentId: "gui:chat-panel", props: { title: "SEND", styleVariant: "blue", radius: 4 }, layouts: L({ x: pw - 142, y: H - 84, w: 128, h: 30 }) });
  return { schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes };
}


/* DOCUMENTS as a GuiDocument: document buttons, an editor panel
   whose text-area rides the values channel, a live word count. */
function docsDocument({ docs, doc, size }) {
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  const nodes = [];
  const W = size.w, H = size.h;
  docs.forEach((d, i) => {
    nodes.push({ id: guiIdOf(`doc:${d.id}`), type: "pro-button", parentId: null, props: { title: d.title, radius: 4, ...(d.id === doc.id ? { styleVariant: "blue" } : {}) }, layouts: L({ x: 10, y: 10 + i * 40, w: 188, h: 32 }) });
  });
  nodes.push({ id: "gui:act:new-doc", type: "pro-button", parentId: null, props: { title: "+ NEW DOCUMENT", radius: 4 }, layouts: L({ x: 10, y: 10 + docs.length * 40 + 6, w: 188, h: 32 }) });
  const px = 210, pw = W - px - 10;
  nodes.push({ id: "gui:doc-panel", type: "panel", parentId: null, props: { title: doc.title, radius: 4 }, layouts: L({ x: px, y: 10, w: pw, h: H - 20 }) });
  nodes.push({ id: "gui:doc-body", type: "text-area", parentId: "gui:doc-panel", props: {}, layouts: L({ x: 14, y: 38, w: pw - 28, h: H - 110 }) });
  const words = doc.body.trim() ? doc.body.trim().split(/\s+/).length : 0;
  nodes.push({ id: "gui:doc-meta", type: "text-label", parentId: "gui:doc-panel", props: { title: `${words} words · ${doc.body.length} characters · kept in the environment's memory` }, layouts: L({ x: 14, y: H - 58, w: pw - 28, h: 18 }) });
  return { schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes };
}

/* TERMINAL as a GuiDocument: the scrollback is text-label lines in
   a panel; the command line is an input-field on the submit
   channel. The shell itself lives in the component (runTerm). */
function termDocument({ lines, size }) {
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  const nodes = [];
  const W = size.w, H = size.h;
  nodes.push({ id: "gui:term-panel", type: "panel", parentId: null, props: { title: "flat sh", radius: 4 }, layouts: L({ x: 10, y: 10, w: W - 20, h: H - 20 }) });
  nodes.push({ id: "gui:act:term-clear", type: "pro-button", parentId: "gui:term-panel", props: { title: "CLEAR", radius: 4 }, layouts: L({ x: W - 150, y: 6, w: 110, h: 24 }) });
  lines.slice(-13).forEach((ln, i) => {
    nodes.push({ id: `gui:term-l-${i}`, type: "text-label", parentId: "gui:term-panel", props: { title: ln || " " }, layouts: L({ x: 14, y: 40 + i * 19, w: W - 68, h: 17 }) });
  });
  nodes.push({ id: "gui:term-in", type: "input-field", parentId: "gui:term-panel", props: { placeholder: "type a command — Enter runs it (help lists them)" }, layouts: L({ x: 14, y: H - 76, w: W - 68, h: 30 }) });
  return { schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes };
}


/* MEDIA as a GuiDocument: a shelf of image-wells and a now-playing
   panel with the registry's own progress strip. */
function mediaDocument({ items, current, playing, pos, size }) {
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  const nodes = [];
  const W = size.w, H = size.h;
  const cw = Math.floor((W - 40) / 3);
  items.forEach((m, i) => {
    const x = 10 + (i % 3) * (cw + 10), y = 10 + Math.floor(i / 3) * 150;
    nodes.push({ id: guiIdOf(`media:${m.id}`), type: "image-well", parentId: null, props: { title: `${m.kind} — ${m.title}${current && current.id === m.id ? (playing ? " · playing" : " · paused") : ""}` }, layouts: L({ x, y, w: cw, h: 140 }) });
  });
  const py = H - 118;
  nodes.push({ id: "gui:media-panel", type: "panel", parentId: null, props: { title: "Now playing", radius: 4 }, layouts: L({ x: 10, y: py, w: W - 20, h: 108 }) });
  nodes.push({ id: "gui:media-title", type: "text-label", parentId: "gui:media-panel", props: { title: current ? `${current.title} — ${current.kind} · ${playing ? "playing" : "paused"} · ${pos}s / ${current.dur}s` : "Nothing selected — F on an item plays it" }, layouts: L({ x: 14, y: 36, w: W - 240, h: 18 }) });
  nodes.push({ id: "gui:media-prog", type: "progress", parentId: "gui:media-panel", props: { value: current ? Math.round(pos / current.dur * 100) : 0 }, layouts: L({ x: 14, y: 62, w: W - 240, h: 12 }) });
  nodes.push({ id: "gui:act:media-play", type: "pro-button", parentId: "gui:media-panel", props: { title: playing ? "PAUSE" : "PLAY", styleVariant: "blue", radius: 4 }, layouts: L({ x: W - 190, y: 40, w: 150, h: 32 }) });
  return { schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes };
}

/* SOFTWARE as a GuiDocument: one row panel per manageable frame,
   its toggle riding the values channel. HOME and SOFTWARE are not
   in the list — they cannot disable themselves. */
function softwareDocument({ frames, disabled, size }) {
  const L = (r) => ({ desktop: r, tablet: r, phone: r });
  const nodes = [];
  const W = size.w, H = size.h;
  nodes.push({ id: "gui:soft-head", type: "text-block", parentId: null, props: { title: "Every frame of the environment, managed. Disabling one removes its card from HOME and its entry from the Navigator, at once." }, layouts: L({ x: 12, y: 8, w: W - 24, h: 20 }) });
  frames.forEach((f, i) => {
    const y = 40 + i * 58, pid = `gui:soft-row-${f.id}`, off = disabled.includes(f.id);
    nodes.push({ id: pid, type: "panel", parentId: null, props: { title: f.name, radius: 4 }, layouts: L({ x: 10, y, w: W - 20, h: 50 }) });
    nodes.push({ id: `gui:soft-desc-${f.id}`, type: "text-label", parentId: pid, props: { title: `${f.sub} — ${off ? "DISABLED" : "enabled"}` }, layouts: L({ x: 14, y: 24, w: W - 180, h: 18 }) });
    nodes.push({ id: guiIdOf(`soft:${f.id}`), type: "toggle", parentId: pid, props: {}, layouts: L({ x: W - 110, y: 12, w: 56, h: 24 }) });
  });
  return { schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false, nodes };
}

/* The data frames (FILES / MONITOR / SUNBURST / FLOW) are laid out
   by NCTGraphite, not by widget grids: each is a one-node GuiDocument
   whose host:surface node carries the live surface through the
   framework's host-renderer seam. The surface keeps its own internal
   key-click furniture (bind / chips); the document supplies the
   hosting, placement and theme tokens, as for every other frame. */
const HOST_COMPONENTS = { "host:surface": HostSurface };
const NO_ADDRESSING = { labels: {} };
function hostDocument(size) {
  const r = { x: 0, y: 0, w: size.w, h: size.h };
  return {
    schema: "paramorphic-gui/1", device: "desktop", separateLayouts: false,
    nodes: [{ id: "gui:host", type: "host:surface", parentId: null, props: {}, layouts: { desktop: r, tablet: r, phone: r } }],
  };
}

export default function FlatApp() {
  const [frame, setFrame] = useState("home");
  /* The navigation state graph (flat-nav.js): where the user is in
     the view hierarchy, which frame they came from, and whether the
     keyboard is in nav or text mode. F pushes, D pops, Esc unwinds —
     decided from this graph, the same in every frame. */
  const [nav, setNav] = useState(() => createNav());
  const navRef = useRef(null);
  navRef.current = nav;
  const [targetId, setTargetId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [buffer, setBuffer] = useState("");
  const [echo, setEcho] = useState("FLAT SPACE — type a label to target, F to click it");
  const [keysOpen, setKeysOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  /* OVERLAYS + DOLLY: the panels float over a full-viewport stage */
  const [railOpen, setRailOpen] = useState(true);
  const [inspOpen, setInspOpen] = useState(true);
  const [settings, setSettings] = useState({ accent: 0, dollyStep: 1.25, chips: true, monRate: 1 });
  const [dolly, setDolly] = useState(1);
  const [dollyOrigin, setDollyOrigin] = useState({ x: 50, y: 50 });
  const dollyRef = useRef(null);

  const monParams = useNCTParameters(PARAM_DEFS.monitor);
  const sbParams = useNCTParameters(PARAM_DEFS.sunburst);
  const fileParams = useNCTParameters(PARAM_DEFS.files);

  /* FILES — treemap */
  const tmRoot = useMemo(() => buildTreemap(FS_TREE), []);
  const [tmFocus, setTmFocus] = useState(null);
  const tmFocusNode = tmFocus || tmRoot;
  /* SUNBURST */
  const sbRoot = useMemo(() => buildSunburst(FS_TREE), []);
  const sbColour = useMemo(() => sunburstColourScale(sbRoot.children.map((c) => c.name)), [sbRoot]);
  const [sbFocus, setSbFocus] = useState(null);
  const sbFocusNode = sbFocus || sbRoot;
  /* FLOW — the environment as a user flow graph, built from the live
     registries so the map cannot drift from the territory */
  /* (the flow graph itself is built further down, once the app
     frames' data exists — its subnodes come from the same data the
     apps render) */
  /* MONITOR */
  const monitorRef = useRef(null);
  if (!monitorRef.current) monitorRef.current = createMonitor(ACTIVITY_LANES, SAMPLES, 20261114);
  const monitor = monitorRef.current;
  const [tickCount, setTickCount] = useState(0);
  const [laneFocus, setLaneFocus] = useState(null);
  const monRunning = Boolean(monParams.values.running);
  useEffect(() => {
    if (!monRunning || frame !== "monitor") return undefined;
    const id = setInterval(() => {
      for (const s of monitor) s.tick();
      setTickCount((c) => c + 1);
    }, 250 / settings.monRate);
    return () => clearInterval(id);
  }, [monRunning, frame, monitor, settings.monRate]);
  /* HOME cards */
  const cardIds = [...FRAMES.map((f) => f.id), "ops"];
  const [cardPos, setCardPos] = useState(() =>
    Object.fromEntries(cardIds.map((id, i) => [id, { x: 2 + (i % 4) * 24.6, y: 4 + Math.floor(i / 4) * 24.2 }])),
  );
  const [drag, setDrag] = useState(null); // {id, origin:{x,y}, x, y, dx, dy}
  const mouseRef = useRef({ x: 0, y: 0 });
  const boardRef = useRef(null);
  /* The HOME GuiDocument is laid out in px, so the board's size is
     state: measured off the board element, rebuilt into the document. */
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoardSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame]);
  /* MAIL */
  const [mailFolder, setMailFolder] = useState("inbox");
  const [mailOpenId, setMailOpenId] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  /* Compose fields are app-kit controls: their values live in state
     and ride GuiRenderer's values channel (the draft survives close). */
  const [composeVals, setComposeVals] = useState({ to: "", subject: "", body: "" });
  const mailRef = useRef(null);
  const mailSize = useSize(mailRef, [frame]);
  const [sentExtra, setSentExtra] = useState([]);
  const allMail = [...sentExtra, ...MAIL_SEED];
  const folderMail = allMail.filter((m) => m.folder === mailFolder);
  const openMail = allMail.find((m) => m.id === mailOpenId) || null;
  /* WEB — captured pages; the history stack is the frame's own
     back-stack, so D is the browser's back button */
  const [webHistory, setWebHistory] = useState(["start"]);
  const [webIndex, setWebIndex] = useState(0);
  /* FLOW drill-in: level 0 is the whole-environment graph; level 1
     is one frame's own graph, brought into FLOW; level 2 has one
     node of that graph selected, its detail open. F descends, D
     climbs — the view never leaves the FLOW frame. */
  const [flowView, setFlowView] = useState({ level: 0, frame: null, sub: null });
  const webPage = webPageById(webHistory[webIndex]);
  const [addrText, setAddrText] = useState(webPage.url);
  useEffect(() => { setAddrText(webPage.url); }, [webPage]);
  const webRef = useRef(null);
  const webSize = useSize(webRef, [frame]);
  /* The app frames: SETTINGS (real environment state) + CHAT.
     (The settings state itself is declared with the dolly state —
     the monitor effect's deps reach it earlier in the render.) */
  const setRef = useRef(null);
  const setSize = useSize(setRef, [frame]);
  const [chatThreadId, setChatThreadId] = useState("ops");
  const [chatExtra, setChatExtra] = useState({});
  const [chatDraft, setChatDraft] = useState("");
  const chatThread = THREADS_SEED.find((t) => t.id === chatThreadId);
  const chatMsgs = [...chatThread.msgs, ...(chatExtra[chatThreadId] || [])];
  const chatRef = useRef(null);
  const chatSize = useSize(chatRef, [frame]);
  const sendChat = () => {
    const text = chatDraft.trim();
    if (!text) { say("CHAT — write a message first"); return; }
    const tid = chatThreadId;
    const thread = THREADS_SEED.find((t) => t.id === tid);
    const prior = (chatExtra[tid] || []).filter((m) => m.from === "you").length + thread.msgs.filter((m) => m.from === "you").length;
    setChatExtra((prev) => ({ ...prev, [tid]: [...(prev[tid] || []), { from: "you", text }] }));
    setChatDraft("");
    say(`CHAT ▸ ${thread.name} — sent`);
    setTimeout(() => {
      setChatExtra((prev) => ({ ...prev, [tid]: [...(prev[tid] || []), { from: thread.who, text: thread.replies[prior % thread.replies.length] }] }));
    }, 600);
  };
  /* DOCUMENTS + TERMINAL */
  const [docs, setDocs] = useState(DOCS_SEED);
  const [docId, setDocId] = useState(DOCS_SEED[0].id);
  const [docSeq, setDocSeq] = useState(1);
  const doc = docs.find((d) => d.id === docId) || docs[0];
  const docsRef = useRef(null);
  const docsSize = useSize(docsRef, [frame]);
  const newDoc = () => {
    const id = `untitled-${docSeq}`;
    setDocs((prev) => [...prev, { id, title: `Untitled ${docSeq}`, body: "" }]);
    setDocSeq((n) => n + 1);
    setDocId(id);
    say("DOCUMENTS ▸ new document");
  };
  const [termLines, setTermLines] = useState(["flat sh — the Flat Space shell", "type help for the commands"]);
  const [termCmd, setTermCmd] = useState("");
  const termRef = useRef(null);
  const termSize = useSize(termRef, [frame]);
  const runTerm = (raw) => {
    const line = (raw ?? termCmd).trim();
    setTermCmd("");
    if (!line) return;
    if (line === "clear") { setTermLines([]); return; }
    const out = [`$ ${line}`];
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ");
    if (cmd === "help") out.push("help · frames · open <frame> · ls · graph · echo <text> · date · whoami · clear");
    else if (cmd === "frames") out.push(FRAMES.map((f) => f.id).join("  "));
    else if (cmd === "open") {
      const f = FRAMES.find((x) => x.id === arg.toLowerCase() || x.name.toLowerCase() === arg.toLowerCase());
      if (f) { out.push(`opening ${f.name}`); setTermLines((prev) => [...prev, ...out].slice(-40)); openFrame(f.id); return; }
      out.push(`no such frame: ${arg || "(none given)"}`);
    }
    else if (cmd === "ls") out.push(tmRoot.children.map((c) => `${c.name} (${c.leafCount ?? c.value ?? ""})`).join("  "));
    else if (cmd === "graph") out.push(`flow graph: ${flowGraph.nodes.length} nodes, ${flowGraph.edges.length} edges, 0 gaps`);
    else if (cmd === "echo") out.push(arg);
    else if (cmd === "date") out.push(new Date().toLocaleString("en-GB"));
    else if (cmd === "whoami") out.push("noctivagous — the person this environment belongs to");
    else out.push(`flat sh: no such command: ${cmd} — help lists them`);
    setTermLines((prev) => [...prev, ...out].slice(-40));
  };
  /* MEDIA + SOFTWARE */
  const [mediaId, setMediaId] = useState(null);
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [mediaPos, setMediaPos] = useState(0);
  const mediaItem = MEDIA_ITEMS.find((m) => m.id === mediaId) || null;
  const mediaRef = useRef(null);
  const mediaSize = useSize(mediaRef, [frame]);
  const selectMedia = (id) => { setMediaId(id); setMediaPos(0); setMediaPlaying(true); say(`MEDIA ▸ ${MEDIA_ITEMS.find((m) => m.id === id).title} — playing`); };
  const toggleMedia = () => {
    if (!mediaItem) { selectMedia(MEDIA_ITEMS[0].id); return; }
    setMediaPlaying((p) => !p);
    say(mediaPlaying ? `MEDIA — ${mediaItem.title} paused` : `MEDIA — ${mediaItem.title} playing`);
  };
  useEffect(() => {
    if (!mediaPlaying || !mediaItem) return;
    const id = setInterval(() => {
      setMediaPos((pos) => {
        if (pos + 1 >= mediaItem.dur) {
          const next = MEDIA_ITEMS[(MEDIA_ITEMS.indexOf(mediaItem) + 1) % MEDIA_ITEMS.length];
          setMediaId(next.id);
          say(`MEDIA ▸ ${next.title} — next`);
          return 0;
        }
        return pos + 1;
      });
    }, 500);
    return () => clearInterval(id);
  }, [mediaPlaying, mediaItem]);
  const [disabledFrames, setDisabledFrames] = useState([]);
  const softRef = useRef(null);
  const softSize = useSize(softRef, [frame]);
  const toggleFrame = (id) => {
    setDisabledFrames((prev) => {
      const off = prev.includes(id);
      say(`SOFTWARE ▸ ${frameById(id).name} ${off ? "enabled" : "disabled"}`);
      return off ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };
  /* In FLOW, targeting a node scrolls it into view — the graph is
     taller than the stage now that every frame has subnodes. */
  useEffect(() => {
    if (frame !== "flow" || !targetId) return;
    const g = document.querySelector(`[data-flow-node="${CSS.escape(targetId.replace(/^graph:/, ""))}"]`);
    if (g) g.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [targetId, frame]);
  /* Data-frame host boxes (FILES / MONITOR / SUNBURST / FLOW) */
  const filesRef = useRef(null);
  const filesSize = useSize(filesRef, [frame]);
  const monRef = useRef(null);
  const monSize = useSize(monRef, [frame]);
  const sbRef = useRef(null);
  const sbSize = useSize(sbRef, [frame]);
  const flowRef = useRef(null);
  const flowSize = useSize(flowRef, [frame]);

  const say = (msg) => setEcho(msg);

  /* F on a field: put the keyboard into it. Focus is what enters
     text mode — the focus-capture handler on the page records it in
     the nav graph, so the mode is state, not a guess. */
  const focusField = (guiId) => {
    const el = document.querySelector(`[data-gui-node="${guiId}"] input, [data-gui-node="${guiId}"] textarea`);
    if (el) { el.focus(); if (guiId === "gui:web-addr") el.select(); }
  };

  const flowGraph = useMemo(() => buildFlowGraph({
    frames: FRAMES, lanes: ACTIVITY_LANES, folders: FOLDERS, webPages: WEB_PAGES,
    flareTop: tmRoot.children.map((c) => ({ name: c.name, leafCount: countLeaves(c) })),
    extraSubs: [
      { frame: "settings", key: "accent", name: "ACCENT", desc: "setting — F cycles it" },
      { frame: "settings", key: "dolly", name: "DOLLY STEP", desc: "setting — F cycles it" },
      { frame: "settings", key: "chips", name: "LABEL CHIPS", desc: "setting — F flips it" },
      { frame: "settings", key: "rate", name: "MONITOR RATE", desc: "setting — F cycles it" },
      ...THREADS_SEED.map((t) => ({ frame: "chat", key: `thread:${t.id}`, name: t.name, desc: "channel" })),
      ...docs.map((d) => ({ frame: "docs", key: `doc:${d.id}`, name: d.title.toUpperCase(), desc: "document" })),
      { frame: "terminal", key: "console", name: "FLAT SH", desc: "the shell" },
      ...MEDIA_ITEMS.map((m) => ({ frame: "media", key: `media:${m.id}`, name: m.title.toUpperCase(), desc: m.kind.toLowerCase() })),
      ...FRAMES.filter((f) => f.id !== "home" && f.id !== "software").map((f) => ({ frame: "software", key: `soft:${f.id}`, name: f.name, desc: "managed frame" })),
    ],
  }), [tmRoot, docs]);
  const flowLayout = useMemo(() => layoutFlowGraph(flowGraph), [flowGraph]);
  /* The contents of a graph subnode — what the frame's graph shows
     when FLOW brings it in: a folder's messages, a directory's
     entries, a page's links, a channel's messages. */
  const flowChildren = (nd) => {
    if (nd.jumpNode) {
      const root = nd.frame === "sunburst" ? sbRoot : tmRoot;
      const c = root.children.find((x) => x.name === nd.jumpNode);
      return c ? c.children.map((k) => ({ key: k.name, name: k.name, desc: k.children.length ? `${k.children.length} entries · ${fmt(k.value)} KiB in all` : `file · ${fmt(k.value)} KiB` })) : [];
    }
    if (nd.jumpFolder) return allMail.filter((m) => m.folder === nd.jumpFolder).map((m) => ({ key: m.id, name: m.subject, desc: `from ${m.from} · ${m.when}` }));
    if (nd.jumpPage) { const p = webPageById(nd.jumpPage); return p.links.map((l) => ({ key: l.to, name: l.text, desc: `link → ${webPageById(l.to).title}` })); }
    if (nd.jumpApp && nd.jumpApp.startsWith("thread:")) {
      const t = THREADS_SEED.find((x) => x.id === nd.jumpApp.slice(7));
      const msgs = t ? [...t.msgs, ...(chatExtra[t.id] || [])] : [];
      return msgs.map((m, i) => ({ key: `m${i}`, name: `${m.from}: ${m.text.slice(0, 44)}`, desc: "message" }));
    }
    return [];
  };
  const frameGraph = useMemo(() => {
    if (!flowView.frame) return null;
    const frameNode = flowGraph.nodes.find((nd) => nd.kind === "frame" && nd.frame === flowView.frame);
    if (!frameNode) return null;
    const subs = flowGraph.nodes.filter((nd) => nd.kind === "subnode" && nd.frame === flowView.frame);
    return buildFrameGraph(frameNode, subs, flowChildren);
  }, [flowGraph, flowView.frame, tmRoot, sbRoot, allMail, chatExtra]);
  const frameLayout = useMemo(() => (frameGraph ? layoutFrameGraph(frameGraph) : null), [frameGraph]);
  /* F inside FLOW descends the graph itself — the frame's graph is
     brought here; the view never exits to the frame. */
  /* stackNav always adds a rung (or relabels the same view's rung):
     drilling from the overview straight into a subnode stacks the
     frame rung and the subnode rung, so the crumbs show the whole
     path and D climbs it one level at a time. */
  const stackNav = (view, label) => updateNav((n) => (navTop(n).view === view ? navSetTop(n, view, label) : navPush(n, view, label)));
  const drillFlow = (frameId, subId = null) => {
    setFlowView({ level: subId ? 2 : 1, frame: frameId, sub: subId });
    if (subId) {
      const nd = flowGraph.nodes.find((n) => n.id === subId);
      stackNav(`flow:frame:${frameId}`, frameById(frameId).name);
      stackNav(`flow:sub:${subId}`, nd ? nd.name : "DETAIL");
      say(`FLOW ▸ ${frameById(frameId).name} ▸ ${nd ? nd.name : "detail"} — its contents, inside FLOW`);
    } else {
      stackNav(`flow:frame:${frameId}`, frameById(frameId).name);
      say(`FLOW ▸ ${frameById(frameId).name} — its graph, inside FLOW (D climbs back)`);
    }
  };
  const selectFlowNode = (nd) => {
    setFlowView({ level: 2, frame: flowView.frame, sub: nd.id });
    stackNav(`flow:sub:${nd.id}`, nd.name);
    say(`FLOW ▸ ${nd.name} — ${nd.desc || "detail"}`);
  };
  /* D inside FLOW: one level up the graph, never out of the frame. */
  const backFlow = () => {
    if (flowView.level === 2) {
      setFlowView({ level: 1, frame: flowView.frame, sub: null });
      updateNav((n) => navPop(n));
      say(`FLOW ▸ ${frameById(flowView.frame).name} — its graph`);
    } else if (flowView.level === 1) {
      setFlowView({ level: 0, frame: null, sub: null });
      updateNav((n) => navPop(n));
      say("FLOW ▸ the whole environment");
    }
  };
  /* updateNav keeps navRef fresh synchronously, so a rapid F D Esc
     sequence never reads a stale graph; pushNav opens a subview rung
     (push at a root, retarget the rung when one is already open). */
  const updateNav = (fn) => setNav((n) => { const next = fn(n); navRef.current = next; return next; });
  const pushNav = (view, label) => updateNav((n) => (navTop(n).view === "root" ? navPush(n, view, label) : navSetTop(n, view, label)));
  const openFrame = (id) => {
    if (disabledFrames.includes(id)) { say(`${frameById(id).name} is disabled — enable it in SOFTWARE`); return; }
    if (id !== "flow") setFlowView({ level: 0, frame: null, sub: null });
    setFrame(id);
    updateNav((n) => navOpenFrame(n, id, frameById(id).name));
    setTargetId(null);
    setHoverId(null);
    setDolly(1);
    clearBuffer();
    say(`${frameById(id).name} — ${frameById(id).sub}`);
  };
  /* Mirror the frames' subview state into the nav graph: when a
     subview opens (a message read, a treemap descended, a lane
     focused, a page visited), a rung appears; when it closes, the
     rung pops. D and Esc read the graph, so they never guess. */
  useEffect(() => {
    updateNav((n) => {
      if (navTop(n).frame !== frame) return n; // frame changes are openFrame's job
      let want = null;
      if (frame === "files" && tmFocus) want = { view: `node:${nodePath(tmFocusNode, tmAncestors)}`, label: nodePath(tmFocusNode, tmAncestors) };
      else if (frame === "sunburst" && sbFocus) want = { view: `node:${nodePath(sbFocusNode, sbAncestors)}`, label: nodePath(sbFocusNode, sbAncestors) };
      else if (frame === "mail" && composeOpen) want = { view: "compose", label: "COMPOSE" };
      else if (frame === "mail" && mailOpenId) { const m = allMail.find((x) => x.id === mailOpenId); want = { view: `reading:${mailOpenId}`, label: m ? m.subject : "READING" }; }
      else if (frame === "monitor" && laneFocus !== null) want = { view: `lane:${ACTIVITY_LANES[laneFocus].id}`, label: ACTIVITY_LANES[laneFocus].label };
      else if (frame === "web" && webIndex > 0) want = { view: `page:${webPage.id}`, label: webPage.title };
      else if (frame === "flow" && flowView.level === 1) want = { view: `flow:frame:${flowView.frame}`, label: frameById(flowView.frame).name };
      else if (frame === "flow" && flowView.level === 2) { const nd = (frameGraph ? frameGraph.nodes : flowGraph.nodes).find((x) => x.id === flowView.sub) || flowGraph.nodes.find((x) => x.id === flowView.sub); want = { view: `flow:sub:${flowView.sub}`, label: nd ? nd.name : "DETAIL" }; }
      const top = navTop(n);
      if (!want) return n.stack.length > 1 ? navPop(n) : n;
      if (top.view === want.view) return top.label === want.label ? n : navSetTop(n, want.view, want.label);
      if (top.view === "root") return navPush(n, want.view, want.label);
      return navSetTop(n, want.view, want.label);
    });
  }, [frame, tmFocus, sbFocus, mailOpenId, composeOpen, laneFocus, webIndex, webPage, flowView, frameGraph]);
  /* WEB navigation — push onto the frame's history (truncating any
     forward entries, as a browser does) */
  const webGo = (pageId) => {
    if (webHistory[webIndex] === pageId) return;
    const base = webHistory.slice(0, webIndex + 1);
    setWebHistory([...base, pageId]);
    setWebIndex(base.length);
    pushNav(`page:${pageId}`, webPageById(pageId).title);
  };
  const openWebAt = (pageId) => {
    setFrame("web");
    setTargetId(null);
    setHoverId(null);
    setDolly(1);
    clearBuffer();
    webGo(pageId);
    say(`WEB ▸ ${webPageById(pageId).title}`);
  };
  /* FLOW jumps — F on a graph node goes to the thing itself */
  const jumpToGraphNode = (nd) => {
    if (nd.kind === "frame") { openFrame(nd.frame); return; }
    const fid = nd.frame;
    if (fid === "files" && nd.jumpNode) {
      const c = tmRoot.children.find((x) => x.name === nd.jumpNode);
      openFrame("files");
      if (c) { setTmFocus(c); say(`FILES ▸ ${nd.jumpNode} — jumped from the flow graph`); }
    } else if (fid === "sunburst" && nd.jumpNode) {
      const c = sbRoot.children.find((x) => x.name === nd.jumpNode);
      openFrame("sunburst");
      if (c) { setSbFocus(c); say(`SUNBURST ▸ ${nd.jumpNode} — jumped from the flow graph`); }
    } else if (fid === "monitor" && nd.jumpLane) {
      const i = ACTIVITY_LANES.findIndex((l) => l.id === nd.jumpLane);
      openFrame("monitor");
      if (i >= 0) setLaneFocus(i);
    } else if (fid === "mail" && nd.jumpFolder) {
      openFrame("mail"); setMailFolder(nd.jumpFolder); setMailOpenId(null);
    } else if (fid === "mail" && nd.jumpAction === "compose") {
      openFrame("mail"); setComposeOpen(true);
    } else if (fid === "web" && nd.jumpPage) {
      openWebAt(nd.jumpPage);
    } else if (fid === "home") {
      openFrame("monitor"); say("OPERATIONS — git pushes and jobs stream here; the lanes are its first form");
    } else if (nd.jumpApp && nd.jumpApp.startsWith("thread:")) {
      openFrame("chat"); setChatThreadId(nd.jumpApp.slice(7));
    } else if (nd.jumpApp && nd.jumpApp.startsWith("doc:")) {
      openFrame("docs"); setDocId(nd.jumpApp.slice(4));
    } else if (nd.jumpApp && nd.jumpApp.startsWith("media:")) {
      openFrame("media"); selectMedia(nd.jumpApp.slice(6));
    } else openFrame(fid);
  };
  /* Full buffer exit: state + ref + timer + token, every time — a
     pending label must never survive an operator or a frame change
     (the shell-keyfix discipline). Defined here as a function
     declaration via ref-stable helpers below; the pieces it touches
     (bufferRef/timerRef/tokenRef) are initialised before any call. */
  function clearBuffer() {
    bufferRef.current = "";
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    tokenRef.current += 1;
    setBuffer("");
  }

  /* ---------------- addressables: one list per frame ---------------- */
  const tmVisible = useMemo(() => {
    const f = tmFocusNode;
    const w = f.x1 - f.x0;
    const h = f.y1 - f.y0;
    if (!w || !h) return [];
    const minw = Number(fileParams.values.minw) / 100;
    return tmDescendants(f)
      .filter((n) => n !== f)
      .map((n) => ({ node: n, nx0: (n.x0 - f.x0) / w, ny0: (n.y0 - f.y0) / h, nx1: (n.x1 - f.x0) / w, ny1: (n.y1 - f.y0) / h }))
      .filter((v) => v.nx1 > 0 && v.nx0 < 1 && v.ny1 > 0 && v.ny0 < 1 && v.nx1 - v.nx0 >= minw && v.ny1 - v.ny0 >= 0.045)
      .sort((a, b) => a.ny0 - b.ny0 || a.nx0 - b.nx0);
  }, [tmFocusNode, fileParams.values.minw]);

  const sbVisible = useMemo(() => {
    const f = sbFocusNode;
    const rings = Number(sbParams.values.rings);
    const span = f.x1 - f.x0;
    if (!span) return [];
    return sbDescendants(f)
      .filter((n) => n !== f && n.depth > f.depth && n.depth <= f.depth + rings)
      .map((n) => ({ node: n, a0: ((n.x0 - f.x0) / span) * Math.PI * 2, a1: ((n.x1 - f.x0) / span) * Math.PI * 2, ring: n.depth - f.depth }))
      .filter((v) => v.a1 - v.a0 > 0.02)
      .sort((a, b) => a.ring - b.ring || a.a0 - b.a0);
  }, [sbFocusNode, sbParams.values.rings]);

  const addressables = useMemo(() => {
    let raw = [];
    if (frame === "home") {
      raw = [
        ...FRAMES.filter((f) => !disabledFrames.includes(f.id)).map((f) => ({
          id: `card:${f.id}`, name: f.name, kind: "FRAME CARD",
          desc: `${f.sub} — Space picks the card up, F opens the frame`,
          onF: () => openFrame(f.id),
        })),
        { id: "card:ops", name: "OPERATIONS STREAM", kind: "CARD", desc: "Live operations — in this demo the stream rides the MONITOR frame", onF: () => { openFrame("monitor"); say("OPERATIONS — git pushes and jobs stream here; the lanes are its first form"); } },
      ];
    } else if (frame === "files") {
      raw = tmVisible.map((v) => ({
        id: `tm:${nodePath(v.node, tmAncestors)}`, name: v.node.name, kind: v.node.children.length ? "BRANCH" : "LEAF",
        desc: `${nodePath(v.node, tmAncestors)} · value ${fmt(v.node.value)} · ${v.node.children.length ? `${v.node.children.length} children — F descends` : "leaf — F inspects"}`,
        node: v.node, vis: v,
        onF: () => {
          if (v.node.children.length) { setTmFocus(v.node); setTargetId(null); pushNav(`node:${nodePath(v.node, tmAncestors)}`, nodePath(v.node, tmAncestors)); say(`FILES ▸ ${nodePath(v.node, tmAncestors)}`); }
          else say(`LEAF ${v.node.name} — value ${fmt(v.node.value)} · ${nodePath(v.node, tmAncestors)}`);
        },
      }));
    } else if (frame === "monitor") {
      raw = monitor.map((s, i) => ({
        id: `lane:${s.lane.id}`, name: s.lane.label, kind: "LANE",
        desc: `${s.lane.label.toLowerCase()} · now ${s.current.toFixed(2)} · key ${i + 1} or its label focuses the lane`,
        onF: () => { setLaneFocus(i); pushNav(`lane:${s.lane.id}`, s.lane.label); say(`LANE ${s.lane.label} focused — strip magnified`); },
      }));
    } else if (frame === "sunburst") {
      raw = sbVisible.map((v) => ({
        id: `sb:${nodePath(v.node, sbAncestors)}`, name: v.node.name, kind: v.node.children.length ? "BRANCH" : "LEAF",
        desc: `${nodePath(v.node, sbAncestors)} · value ${fmt(v.node.value)} · ${v.node.children.length ? "F descends" : "leaf — F inspects"}`,
        node: v.node, vis: v,
        onF: () => {
          if (v.node.children.length) { setSbFocus(v.node); setTargetId(null); pushNav(`node:${nodePath(v.node, sbAncestors)}`, nodePath(v.node, sbAncestors)); say(`SUNBURST ▸ ${nodePath(v.node, sbAncestors)}`); }
          else say(`LEAF ${v.node.name} — value ${fmt(v.node.value)} · ${nodePath(v.node, sbAncestors)}`);
        },
      }));
    } else if (frame === "mail") {
      if (composeOpen) {
        raw = [
          { id: "cmp-to", name: "TO", kind: "FIELD", desc: "The To field — F enters text mode; Esc leaves it", onF: () => focusField("gui:cmp-to") },
          { id: "cmp-subject", name: "SUBJECT", kind: "FIELD", desc: "The Subject field — F enters text mode; Esc leaves it", onF: () => focusField("gui:cmp-subject") },
          { id: "cmp-body", name: "MESSAGE", kind: "FIELD", desc: "The message body — F enters text mode; Esc leaves it", onF: () => focusField("gui:cmp-body") },
          { id: "act:send", name: "SEND", kind: "ACTION", desc: "Send the composed message (lands in Sent)", onF: () => sendCompose() },
          { id: "act:discard", name: "DISCARD", kind: "ACTION", desc: "Discard the draft and return to the list", onF: () => { setComposeOpen(false); say("Draft discarded"); } },
        ];
      } else {
        raw = [
          ...FOLDERS.map((fo) => ({
            id: `folder:${fo.id}`, name: fo.name.toUpperCase(), kind: "FOLDER",
            desc: `${allMail.filter((m) => m.folder === fo.id).length} messages`,
            onF: () => { setMailFolder(fo.id); setMailOpenId(null); say(`MAIL ▸ ${fo.name}`); },
          })),
          { id: "act:compose", name: "COMPOSE", kind: "ACTION", desc: "Write a message — the fields are real text mode; Esc leaves it", onF: () => { setComposeOpen(true); pushNav("compose", "COMPOSE"); say("COMPOSE — F on a field enters text mode; Esc leaves it"); } },
          ...folderMail.map((m) => ({
            id: `mail:${m.id}`, name: m.subject, kind: "MESSAGE",
            desc: `from ${m.from} · ${m.when}`,
            onF: () => { setMailOpenId(m.id); pushNav(`reading:${m.id}`, m.subject); say(`MAIL ▸ ${m.subject}`); },
          })),
        ];
      }
    } else if (frame === "web") {
      raw = [
        { id: "web-addr", name: "ADDRESS", kind: "FIELD", desc: "The address bar — F enters text mode; Enter visits a captured page; Esc leaves text mode", onF: () => focusField("gui:web-addr") },
        ...(webIndex < webHistory.length - 1 ? [{
          id: "act:web-fwd", name: "FORWARD ▸", kind: "ACTION",
          desc: `Forward to ${webPageById(webHistory[webIndex + 1]).title}`,
          onF: () => { setWebIndex(webIndex + 1); setTargetId(null); say(`WEB ▸ ${webPageById(webHistory[webIndex + 1]).title}`); },
        }] : []),
        ...webPage.links.map((l) => ({
          id: `link:${l.to}`, name: l.text, kind: "WEB LINK",
          desc: `${webPageById(l.to).url} — F follows the link`,
          onF: () => { webGo(l.to); setTargetId(null); say(`WEB ▸ ${webPageById(l.to).title}`); },
        })),
      ];
    } else if (frame === "settings") {
      raw = [
        { id: "set:accent", name: "ACCENT", kind: "SETTING", desc: `Accent colour — now ${ACCENTS[settings.accent].name}. F cycles it`, onF: () => { const n = (settings.accent + 1) % ACCENTS.length; setSettings((s) => ({ ...s, accent: n })); say(`SETTINGS ▸ accent ${ACCENTS[n].name}`); } },
        { id: "set:dolly", name: "DOLLY STEP", kind: "SETTING", desc: `How far V and C move — now ×${settings.dollyStep}. F cycles 1.15 / 1.25 / 1.40`, onF: () => { const steps = [1.15, 1.25, 1.4]; const n = steps[(steps.indexOf(settings.dollyStep) + 1) % steps.length]; setSettings((s) => ({ ...s, dollyStep: n })); say(`SETTINGS ▸ dolly step ×${n}`); } },
        { id: "set:chips", name: "LABEL CHIPS", kind: "SETTING", desc: `The label chips on every addressable thing — now ${settings.chips ? "ON" : "OFF"}. F flips it`, onF: () => { setSettings((s) => ({ ...s, chips: !s.chips })); say(`SETTINGS ▸ label chips ${!settings.chips ? "ON" : "OFF"}`); } },
        { id: "set:rate", name: "MONITOR RATE", kind: "SETTING", desc: `How fast MONITOR time runs — now ×${settings.monRate}. F cycles 0.5 / 1 / 2`, onF: () => { const steps = [0.5, 1, 2]; const n = steps[(steps.indexOf(settings.monRate) + 1) % steps.length]; setSettings((s) => ({ ...s, monRate: n })); say(`SETTINGS ▸ monitor rate ×${n}`); } },
      ];
    } else if (frame === "chat") {
      raw = [
        ...THREADS_SEED.map((t) => ({
          id: `thread:${t.id}`, name: t.name, kind: "CHANNEL",
          desc: `${[...t.msgs, ...(chatExtra[t.id] || [])].length} messages — F opens the channel`,
          onF: () => { setChatThreadId(t.id); say(`CHAT ▸ ${t.name}`); },
        })),
        { id: "chat-in", name: "MESSAGE FIELD", kind: "FIELD", desc: "The message field — F enters text mode; Enter sends; Esc leaves text mode", onF: () => focusField("gui:chat-in") },
        { id: "act:chat-send", name: "SEND", kind: "ACTION", desc: "Send the message in the field", onF: () => sendChat() },
      ];
    } else if (frame === "docs") {
      raw = [
        ...docs.map((d) => ({
          id: `doc:${d.id}`, name: d.title.toUpperCase(), kind: "DOCUMENT",
          desc: `${d.body.trim() ? d.body.trim().split(/\s+/).length : 0} words — F opens it in the editor`,
          onF: () => { setDocId(d.id); say(`DOCUMENTS ▸ ${d.title}`); },
        })),
        { id: "act:new-doc", name: "NEW DOCUMENT", kind: "ACTION", desc: "Start an untitled document", onF: () => newDoc() },
        { id: "doc-body", name: "EDITOR", kind: "FIELD", desc: "The document body — F enters text mode; Esc leaves it", onF: () => focusField("gui:doc-body") },
      ];
    } else if (frame === "terminal") {
      raw = [
        { id: "term-in", name: "COMMAND LINE", kind: "FIELD", desc: "The command line — F enters text mode; Enter runs; Esc leaves text mode", onF: () => focusField("gui:term-in") },
        { id: "act:term-clear", name: "CLEAR", kind: "ACTION", desc: "Clear the scrollback", onF: () => setTermLines([]) },
      ];
    } else if (frame === "media") {
      raw = [
        ...MEDIA_ITEMS.map((m) => ({
          id: `media:${m.id}`, name: m.title.toUpperCase(), kind: m.kind,
          desc: `${m.kind} · ${m.dur}s — F plays it`,
          onF: () => selectMedia(m.id),
        })),
        { id: "act:media-play", name: mediaPlaying ? "PAUSE" : "PLAY", kind: "ACTION", desc: "Play or pause (Space does this too)", onF: () => toggleMedia() },
      ];
    } else if (frame === "software") {
      raw = FRAMES.filter((f) => f.id !== "home" && f.id !== "software").map((f) => ({
        id: `soft:${f.id}`, name: f.name, kind: "FRAME",
        desc: `${f.sub} — now ${disabledFrames.includes(f.id) ? "DISABLED" : "enabled"}; F toggles it`,
        onF: () => toggleFrame(f.id),
      }));
    } else if (frame === "flow") {
      if (flowView.level === 0) {
        raw = flowGraph.nodes
          .filter((nd) => nd.kind === "frame" || nd.kind === "subnode")
          .map((nd) => ({
            id: `graph:${nd.id}`, name: nd.name, kind: nd.kind === "frame" ? "FRAME NODE" : "SUBNODE",
            desc: `${nd.desc || ""} — F brings its graph into FLOW`, graphNode: nd,
            onF: () => { if (nd.kind === "frame") drillFlow(nd.frame); else drillFlow(nd.frame, nd.id); },
          }));
      } else if (frameGraph) {
        raw = frameGraph.nodes
          .filter((nd) => nd.kind !== "frame")
          .map((nd) => ({
            id: `graph:${nd.id}`, name: nd.name, kind: nd.kind === "child" ? "DETAIL" : "SUBNODE",
            desc: nd.desc || "", graphNode: nd,
            onF: () => selectFlowNode(nd),
          }));
      }
    }
    return assignLabels(raw);
  }, [frame, tmVisible, sbVisible, laneFocus, mailFolder, folderMail, composeOpen, allMail, webPage, webIndex, webHistory, flowGraph, flowView, frameGraph, settings, chatThreadId, chatExtra, chatDraft, docs, docId, docSeq, mediaId, mediaPlaying, mediaPos, disabledFrames]);

  const addrById = useMemo(() => new Map(addressables.map((a) => [a.item.id, a])), [addressables]);
  const targetItem = targetId ? addrById.get(targetId) : null;
  const hoverItem = hoverId ? addrById.get(hoverId) : null;
  const addressee = hoverItem || targetItem; // hover wins — the F rule

  function sendCompose() {
    const to = composeVals.to.trim();
    const subject = composeVals.subject.trim();
    const body = composeVals.body.trim();
    if (!to || !subject || !body) { say("COMPOSE — fill To, Subject and the message first"); return; }
    setSentExtra((prev) => [{ id: `sent-${Date.now()}`, folder: "sent", from: "you", subject, when: "just now", body: `${body}\n\n— to ${to}` }, ...prev]);
    setComposeOpen(false);
    setMailFolder("sent");
    say(`SENT — “${subject}” is in Sent`);
  }

  /* ---------------- actions (mirrored into refs for the handler) ---------------- */
  const doF = () => {
    clearBuffer();
    const it = addressee;
    if (!it) { say("F — nothing hovered and nothing targeted. Type a label, Tab, or hover."); return; }
    setTargetId(it.item.id);
    it.item.onF();
    if (frame !== "files" && frame !== "sunburst") say(`${it.item.kind} ${it.item.name} — clicked with F`);
    if (frame === "files" || frame === "sunburst") { /* onF already spoke */ }
  };
  /* Close whatever subview the nav graph's top rung names. The
     mirror effect pops the rung once the state has closed. */
  const closeTopView = () => {
    const top = navTop(navRef.current);
    const v = top.view;
    if (frame === "files" && v.startsWith("node:") && tmFocusNode.parent) { const p = tmFocusNode.parent; setTmFocus(p); setTargetId(null); if (p === tmRoot) updateNav((n) => navPop(n)); else pushNav(`node:${nodePath(p, tmAncestors)}`, nodePath(p, tmAncestors)); say(`FILES ▸ ${nodePath(p, tmAncestors)}`); return true; }
    if (frame === "sunburst" && v.startsWith("node:") && sbFocusNode.parent) { const p = sbFocusNode.parent; setSbFocus(p); setTargetId(null); if (p === sbRoot) updateNav((n) => navPop(n)); else pushNav(`node:${nodePath(p, sbAncestors)}`, nodePath(p, sbAncestors)); say(`SUNBURST ▸ ${nodePath(p, sbAncestors)}`); return true; }
    if (frame === "mail" && v === "compose") { setComposeOpen(false); updateNav((n) => navPop(n)); say("COMPOSE closed — the draft is kept"); return true; }
    if (frame === "mail" && v.startsWith("reading:")) { setMailOpenId(null); updateNav((n) => navPop(n)); say("MAIL ▸ back to the list"); return true; }
    if (frame === "web" && v.startsWith("page:") && webIndex > 0) { const p = webPageById(webHistory[webIndex - 1]); setWebIndex(webIndex - 1); setTargetId(null); if (webIndex - 1 === 0) updateNav((n) => navPop(n)); else pushNav(`page:${p.id}`, p.title); say(`WEB ▸ back — ${p.title}`); return true; }
    if (frame === "monitor" && v.startsWith("lane:")) { setLaneFocus(null); updateNav((n) => navPop(n)); say("MONITOR — lane released"); return true; }
    if (frame === "flow" && v.startsWith("flow:")) { backFlow(); return true; }
    return false;
  };
  /* D — back, decided by the nav graph: pop the open subview; at a
     frame's root, return to the frame the user came from; from
     there, Home. D always has somewhere true to go. */
  const doBack = () => {
    clearBuffer();
    if (navTop(navRef.current).view !== "root" && closeTopView()) return;
    const plan = navBackPlan(navRef.current);
    if (plan.kind === "frame") { openFrame(plan.to); say(`D — back to ${frameById(plan.to).name}`); return; }
    if (plan.kind === "home") { openFrame("home"); say("D — back to HOME"); return; }
    say("D — Home is the root of the view graph; nowhere further back");
  };
  const doEsc = () => {
    if (drag) { setCardPos((p) => ({ ...p, [drag.id]: drag.origin })); setDrag(null); say("DRAG cancelled — card restored"); return; }
    if (buffer) { clearBuffer(); say("Buffer cleared"); return; }
    if (navRef.current.mode === MODE_TEXT) { document.activeElement?.blur(); updateNav((n) => navExitText(n)); say("Text mode left — keys are operators again"); return; }
    if (targetId) { setTargetId(null); say("Target released"); return; }
    if (navTop(navRef.current).view !== "root" && closeTopView()) return;
    if (frame !== "home") { openFrame("home"); return; }
    say("RELEASED — everything is at rest");
  };
  const cycleTarget = () => {
    clearBuffer();
    if (!addressables.length) return;
    const ids = addressables.map((a) => a.item.id);
    const i = ids.indexOf(targetId);
    const next = addressables[(i + 1) % addressables.length];
    setHoverId(null);
    setTargetId(next.item.id);
    say(`TARGET ${next.label} — ${next.item.name}`);
  };
  /* DOLLY — V in, C out, into whatever is being looked at. The
     origin follows the addressee (the effect below keeps it on the
     addressee's centre); with no addressee, the stage centre. */
  const doDolly = (dir) => {
    clearBuffer();
    const next = Math.min(3, Math.max(0.5, Math.round(dolly * (dir > 0 ? settings.dollyStep : 1 / settings.dollyStep) * 100) / 100));
    setDolly(next);
    say(`${dir > 0 ? "DOLLY IN" : "DOLLY OUT"} — view ×${next}${addressee ? `, centred on ${addressee.item.name}` : ""}`);
  };

  const bufferRef = useRef("");
  const timerRef = useRef(null);
  const tokenRef = useRef(0);
  const clearBufferTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const pushLabel = (letter) => {
    const labels = addressables.map((a) => a.label);
    const next = bufferRef.current + letter;
    const res = resolveBuffer(next, labels);
    tokenRef.current += 1;
    clearBufferTimer();
    if (res.kind === "match") {
      const hit = addressables.find((a) => a.label === res.label);
      bufferRef.current = ""; setBuffer("");
      if (hit) { setHoverId(null); setTargetId(hit.item.id); say(`TARGET ${hit.label} — ${hit.item.name}. F clicks it.`); }
    } else if (res.kind === "pending") {
      bufferRef.current = next; setBuffer(next);
      const token = tokenRef.current;
      timerRef.current = setTimeout(() => {
        if (tokenRef.current !== token) return; // a newer key superseded this timer
        const cur = bufferRef.current;
        const hit = addressables.find((a) => a.label === cur);
        bufferRef.current = ""; setBuffer("");
        if (hit) { setHoverId(null); setTargetId(hit.item.id); say(`TARGET ${hit.label} — ${hit.item.name}. F clicks it.`); }
      }, 800);
    } else {
      bufferRef.current = ""; setBuffer("");
      say(`No address “${next}” in this frame`);
    }
  };

  const R = useRef({});
  R.current = { frame, drag, searchOpen, addressables, monRunning, addressee, cardPos, mediaId, mediaPlaying };
  const A = useRef({});
  A.current = { doF, doBack, doEsc, cycleTarget, pushLabel, doDolly };

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      /* Text mode is state (the nav graph), with DOM focus as the
         backstop: while it lasts, keys are text and only Esc is
         monitored — Esc leaves the mode, as in KeyPilot. */
      const inText = (navRef.current && navRef.current.mode === MODE_TEXT)
        || (t && isTextEntryControl(t.tagName, t instanceof HTMLInputElement ? t.type : "", t.isContentEditable));
      if (inText) {
        if (e.key === "Escape") { t.blur(); setNav((n) => { const next = navExitText(n); navRef.current = next; return next; }); }
        return;
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.altKey) {
        if (e.code === "KeyK") { e.preventDefault(); setKeysOpen((v) => !v); }
        return;
      }
      const st = R.current;
      const act = A.current;
      /* Operators dispatch inside flushSync: the state they change
         is committed before the next keydown is processed, so a
         rapid F D Esc sequence never reads a stale closure. */
      if (e.key === "Escape") { e.preventDefault(); flushSync(() => act.doEsc()); return; }
      if (e.key === "Tab") { e.preventDefault(); flushSync(() => act.cycleTarget()); return; }
      if (e.key === "Enter") { e.preventDefault(); flushSync(() => act.doF()); return; }
      if (e.key === "`") { flushSync(() => openFrame("home")); return; }
      if (e.key === "/") { e.preventDefault(); setSearchOpen(true); return; }
      if (e.key === " ") {
        e.preventDefault();
        if (st.frame === "monitor") { monParams.setValue("running", !st.monRunning); say(st.monRunning ? "MONITOR — time held (Space resumes)" : "MONITOR — time running"); }
        else if (st.frame === "media") {
          if (!st.mediaId) { setMediaId(MEDIA_ITEMS[0].id); setMediaPos(0); setMediaPlaying(true); say(`MEDIA ▸ ${MEDIA_ITEMS[0].title} — playing`); }
          else { setMediaPlaying(!st.mediaPlaying); say(st.mediaPlaying ? "MEDIA — paused (Space resumes)" : "MEDIA — playing"); }
        }
        else if (st.frame === "home") {
          if (st.drag) {
            setCardPos((p) => ({ ...p, [st.drag.id]: { x: st.drag.x, y: st.drag.y } }));
            say(`DROP — card placed at ${Math.round(st.drag.x)}, ${Math.round(st.drag.y)}`);
            setDrag(null);
          } else {
            const it = st.addressee;
            if (it && it.item.id.startsWith("card:")) {
              const cid = it.item.id.slice(5);
              const pos = st.cardPos[cid];
              const board = boardRef.current;
              let dx = 0, dy = 0;
              if (board) {
                const r = board.getBoundingClientRect();
                dx = ((mouseRef.current.x - r.left) / r.width) * 100 - pos.x;
                dy = ((mouseRef.current.y - r.top) / r.height) * 100 - pos.y;
              }
              setDrag({ id: cid, origin: pos, x: pos.x, y: pos.y, dx, dy });
              say(`DRAG LOCK — ${it.item.name} rides the cursor. Space drops, Esc cancels.`);
            } else say("SPACE — hover or target a card first");
          }
        }
        return;
      }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); flushSync(() => act.doF()); return; }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); flushSync(() => act.doBack()); return; }
      if (e.key === "v" || e.key === "V") { e.preventDefault(); flushSync(() => act.doDolly(1)); return; }
      if (e.key === "c" || e.key === "C") { e.preventDefault(); flushSync(() => act.doDolly(-1)); return; }
      if (st.frame === "monitor" && /^[1-8]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        flushSync(() => {
          setLaneFocus(i);
          setTargetId(`lane:${monitor[i].lane.id}`);
          pushNav(`lane:${monitor[i].lane.id}`, monitor[i].lane.label);
          say(`LANE ${monitor[i].lane.label} focused`);
        });
        return;
      }
      if (isLabelKey(e.key)) { flushSync(() => act.pushLabel(e.key.toUpperCase())); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* The dolly origin tracks whatever is being looked at. Rects are
     post-transform; dividing the offset from the wrapper's visual
     top-left by the current scale recovers layout coordinates (the
     visual left edge is the image of layout x=0). */
  useEffect(() => {
    const wrap = dollyRef.current;
    if (!wrap || !wrap.offsetWidth) return;
    const id = hoverId || targetId;
    const el = id ? wrap.querySelector(`[data-addr="${id}"], [data-gui-node="gui:${id}"]`) : null;
    if (!el) { setDollyOrigin({ x: 50, y: 50 }); return; }
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const px = (r.left + r.width / 2 - wr.left) / dolly;
    const py = (r.top + r.height / 2 - wr.top) / dolly;
    setDollyOrigin({
      x: Math.max(0, Math.min(100, (px / wrap.offsetWidth) * 100)),
      y: Math.max(0, Math.min(100, (py / wrap.offsetHeight) * 100)),
    });
  }, [targetId, hoverId, frame, dolly]);

  const textMode = nav.mode === MODE_TEXT;
  const scopes = ["shell", frame, ...(textMode ? ["text"] : [])];
  const board = resolveBoard(scopes);
  const modeName = textMode ? `TEXT — ${nav.textField || "FIELD"}` : drag ? "DRAG LOCK" : searchOpen ? "SEARCH" : "KEY-CLICK";

  /* ---------------- render helpers ---------------- */
  const labelOf = (id) => addrById.get(id)?.label || "";
  const bind = (entry) => ({
    "data-addr": entry.item.id,
    onMouseOver: (e) => { e.stopPropagation(); setHoverId(entry.item.id); },
    onMouseLeave: () => setHoverId(null),
    onClick: () => { setTargetId(entry.item.id); entry.item.onF(); },
  });
  const stateCls = (id) => `${targetId === id ? "is-target" : ""} ${hoverId === id ? "is-hover" : ""}`;
  const entry = (id) => addrById.get(id);
  const chip = (id) => (labelOf(id) ? <span className="fl-chip">{labelOf(id)}</span> : null);
  /* The AddressedGui wiring, shared by every hosted frame: labels
     from the current scope's addressables; pointer reports map back
     to addressable ids (the gui: prefix stripped). */
  const addressing = {
    labels: Object.fromEntries(addressables.filter((a) => a.label).map((a) => [guiIdOf(a.item.id), a.label])),
    targetId: targetId ? guiIdOf(targetId) : null,
    hoverId: hoverId ? guiIdOf(hoverId) : null,
  };
  const onAddress = (gid, ev) => {
    const aid = gid ? gid.slice(4) : null;
    if (ev === "hover") setHoverId(aid);
    else if (ev === "leave") setHoverId(null);
    else if (ev === "activate" && aid) { const ent = entry(aid); setTargetId(aid); if (ent) ent.item.onF(); }
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const f of FRAMES) if (f.name.toLowerCase().includes(q)) out.push({ kind: "FRAME", name: f.name, act: () => { openFrame(f.id); setSearchOpen(false); } });
    for (const p of WEB_PAGES) if ((p.title + p.url).toLowerCase().includes(q)) out.push({ kind: "WEB PAGE", name: p.title, act: () => { openWebAt(p.id); setSearchOpen(false); } });
    for (const m of allMail) if ((m.subject + m.from).toLowerCase().includes(q)) out.push({ kind: "MAIL", name: m.subject, act: () => { setFrame("mail"); setMailFolder(m.folder); setMailOpenId(m.id); setSearchOpen(false); say(`MAIL ▸ ${m.subject}`); } });
    for (const n of tmDescendants(tmRoot).filter((x) => x.name.toLowerCase().includes(q)).slice(0, 6)) {
      out.push({ kind: "FILE NODE", name: `${n.name} · ${fmt(n.value)}`, act: () => { setFrame("files"); setTmFocus(n.parent || tmRoot); setTargetId(`tm:${nodePath(n, tmAncestors)}`); setSearchOpen(false); say(`FILES ▸ ${nodePath(n, tmAncestors)}`); } });
    }
    return out.slice(0, 9);
  }, [searchQuery, allMail, tmRoot]);

  const guideText = {
    home: "The bulletin board. Cards are the frames plus the operations stream. Type a card's label to target it, F opens it, Space picks it up and drops it somewhere else on the board.",
    files: "The Flat UI file navigator: this machine's filesystem — home, usr, var and all — as a 2D treemap, laid out by NCTGraphite's treemap module. F on a branch descends; F on a leaf inspects it. D climbs, Esc releases.",
    monitor: "Realtime horizon chart — demo-de's first Flat UI frame, hosted here. Keys 1–8 or a lane's label focus and magnify it; Space holds time.",
    sunburst: "The ZUI viewer on the 2D plane: the same hierarchy as FILES, as a sunburst. F descends a branch, D climbs, the centre goes back too.",
    mail: "Folders, list, reading. F opens; COMPOSE's fields are real text mode — while you type, keys are text and only Esc is monitored. SEND lands the message in Sent.",
    web: "The captured web, Detach-style: the page is rebuilt as the environment's furniture and its links are subnodes — type a link's label, F follows it. D is the back button (it is the frame's own back). The address bar takes the captured pages' addresses; the live web rides the local bridge in a later slice.",
    flow: "The environment drawn as what it is: a user flow graph. Shell → frames → subnodes; edges are the real access operations — F descends, D climbs back, Esc releases to Home, / jumps anywhere. F on a node no longer leaves FLOW: it brings that frame's own graph into this view — its subnodes and their contents, the data itself — and D climbs back out level by level. The frames' graphs live here now. Every usual Linux activity has a frame — the graph's gap row is empty.",
    settings: "The environment's own controls, as app-kit controls: accent, dolly step, label chips, monitor rate. They take effect immediately, everywhere — F on a setting cycles or flips it, or drag the control itself.",
    chat: "Channels and messaging. Pick a channel on the left; write in the field and Enter (or SEND) posts it — the other side answers. The field is real text mode while you type.",
    docs: "Documents and text editing. Pick a document; the editor is a real text area (text mode while you type, Esc leaves it). Words are counted live; everything is kept in the environment's memory.",
    terminal: "flat sh — a small shell that does real things here: help lists its commands, open <frame> jumps, ls shows the hierarchy, graph counts the flow graph. Enter runs the line; the field is text mode while you type.",
    media: "Tracks, clips and stills from the environment's own shelf. F selects an item and plays it; Space plays and pauses; the progress strip is the app-kit's own.",
    software: "Software manages the environment itself: every frame can be enabled or disabled here, and HOME and the Navigator honour it at once. HOME and SOFTWARE cannot disable themselves.",
  }[frame];

  const paramsFor = { monitor: monParams, sunburst: sbParams, files: fileParams }[frame];

  return (
    <div className={`fl-page ${settings.chips ? "" : "no-chips"}`} style={{ "--fl-accent": ACCENTS[settings.accent].hex }} onMouseMove={(e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; }}
      onFocusCapture={(e) => { const t = e.target; if (isTextEntryControl(t.tagName, t instanceof HTMLInputElement ? t.type : "", t.isContentEditable)) { const g = t.closest("[data-gui-node]"); const labels = { "gui:cmp-to": "COMPOSE · TO", "gui:cmp-subject": "COMPOSE · SUBJECT", "gui:cmp-body": "COMPOSE · MESSAGE", "gui:doc-body": "DOCUMENT · BODY", "gui:chat-in": "CHAT · MESSAGE", "gui:term-in": "TERMINAL · COMMAND", "gui:web-addr": "WEB · ADDRESS" }; setNav((n) => navEnterText(n, (g && labels[g.getAttribute("data-gui-node")]) || "TEXT FIELD")); } }}
      onBlurCapture={(e) => { const rt = e.relatedTarget; const rtText = rt && isTextEntryControl(rt.tagName, rt instanceof HTMLInputElement ? rt.type : "", rt.isContentEditable); if (!rtText) setNav((n) => (n.mode === MODE_TEXT ? navExitText(n) : n)); }}
      onClickCapture={(e) => { const b = e.target.closest && e.target.closest("button"); if (b) b.blur(); }}>
      <style>{css}</style>
      <header className="fl-top">
        <strong>FLAT SPACE</strong>
        <span className="fl-top-frame">{frameById(frame).name}</span>
        <span className={`fl-mode ${textMode ? "texting" : ""}`}>MODE · {modeName}</span>
        <nav className="fl-nav">
          <a href="ui-space/">3D view ↗</a>
          <a href="treemap.html">Treemap</a>
          <a href="horizon.html">Horizon</a>
          <a href="index_fragment.html">Keyclicks sim</a>
        </nav>
        <AppToolbar
          items={[
            { id: "nav", label: railOpen ? "NAV «" : "NAV »" },
            { id: "insp", label: inspOpen ? "INSPECT »" : "INSPECT «" },
            { id: "keys", label: "KEYS · Alt+K" },
          ]}
          onAction={(id) => {
            if (id === "nav") setRailOpen((v) => !v);
            if (id === "insp") setInspOpen((v) => !v);
            if (id === "keys") setKeysOpen((v) => !v);
            document.activeElement?.blur();
          }} />
      </header>

      <div className="fl-main">
        <aside className={`fl-rail ${railOpen ? "" : "closed"}`}>
          <h3>NAVIGATOR <button className="fl-collapse" onClick={(e) => { setRailOpen(false); e.currentTarget.blur(); }}>«</button></h3>
          {FRAMES.filter((f) => !disabledFrames.includes(f.id)).map((f) => (
            <button key={f.id} className={`fl-rail-btn ${frame === f.id ? "here" : ""}`} onClick={(e) => { openFrame(f.id); e.currentTarget.blur(); }}>
              <span className="fl-dot" style={{ background: f.color }} />
              <span>{f.name}<small>{f.sub}</small></span>
            </button>
          ))}
          <h3 style={{ marginTop: 18 }}>KEY-CLICKS · THIS SCOPE</h3>
          <div className="fl-keylist">
            {board.flat().filter((c) => c.binding).map((c) => (
              <div key={c.code} className="fl-keyrow"><b>{c.binding.name}</b><span>{c.binding.desc}</span></div>
            ))}
            <div className="fl-keyrow"><b>LABELS</b><span>Type a thing's letters to target it (C, D, F and V are operators, never addresses)</span></div>
          </div>
        </aside>

        <section className={`fl-stage ${textMode ? "texting" : ""}`}>
          <div className="fl-crumbs">
            {frame === "files" && tmAncestors(tmFocusNode).map((n, i, arr) => (
              <span key={i}><button onClick={(e) => { setTmFocus(n); setTargetId(null); e.currentTarget.blur(); }}>{n.name}</button>{i < arr.length - 1 ? " ▸ " : ""}</span>
            ))}
            {frame === "sunburst" && sbAncestors(sbFocusNode).map((n, i, arr) => (
              <span key={i}><button onClick={(e) => { setSbFocus(n); setTargetId(null); e.currentTarget.blur(); }}>{n.name}</button>{i < arr.length - 1 ? " ▸ " : ""}</span>
            ))}
            {nav.stack.length > 1 && frame !== "files" && frame !== "sunburst" && <span>{navCrumbs(nav).join(" ▸ ")}</span>}
            {frame === "mail" && nav.stack.length === 1 && <span>MAIL ▸ {FOLDERS.find((f) => f.id === mailFolder)?.name}</span>}
            {frame === "monitor" && nav.stack.length === 1 && <span>MONITOR ▸ all lanes</span>}
            {frame === "home" && <span>HOME ▸ bulletin board{drag ? ` ▸ dragging ${drag.id}` : ""}</span>}
            {frame === "web" && nav.stack.length === 1 && <span>WEB ▸ {webPage.title}</span>}
            {frame === "flow" && nav.stack.length === 1 && <span>FLOW ▸ {flowGraph.nodes.length} nodes · {flowGraph.edges.length} access edges · F on a node brings its graph here</span>}
            <span className="fl-buffer">{buffer ? `key buffer: ${buffer}▸` : ""}</span>
          </div>

          <div className={`fl-dolly ${railOpen ? "rail-open" : ""} ${inspOpen ? "insp-open" : ""}`} ref={dollyRef}
            style={{ transform: `scale(${dolly})`, transformOrigin: `${dollyOrigin.x}% ${dollyOrigin.y}%` }}>

          {frame === "home" && (
            <div className="fl-board" ref={boardRef} onMouseMove={(e) => {
              if (!drag) return;
              const r = boardRef.current.getBoundingClientRect();
              const x = Math.max(0, Math.min(74, ((e.clientX - r.left) / r.width) * 100 - drag.dx));
              const y = Math.max(0, Math.min(58, ((e.clientY - r.top) / r.height) * 100 - drag.dy));
              setDrag({ ...drag, x, y });
            }}>
              {boardSize.w > 0 && (
                <AddressedGui
                  document={homeDocument(
                    addressables.map((a) => {
                      const cid = a.item.id.slice(5);
                      const f = frameById(cid);
                      return { id: a.item.id, cid, name: a.item.name, desc: a.item.desc, sub: `${f ? f.sub : "live operations"} · F opens · Space drags` };
                    }),
                    cardPos, drag, boardSize)}
                  device="desktop" width={boardSize.w} height={boardSize.h}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "files" && (
            <div className="fl-hostbox" ref={filesRef}>
              {filesSize.w > 0 && (
                <AddressedGui document={hostDocument(filesSize)} device="desktop" width={filesSize.w} height={filesSize.h}
                  components={HOST_COMPONENTS} addressing={NO_ADDRESSING}
                  values={{ "gui:host": { surface: (
                    <div className="fl-tm">
                      {[...tmVisible].sort((a, b) => a.node.depth - b.node.depth).map((v) => {
                        const id = `tm:${nodePath(v.node, tmAncestors)}`;
                        const e = entry(id);
                        if (!e) return null;
                        const wPct = (v.nx1 - v.nx0) * 100;
                        return (
                          <div key={id} className={`fl-tm-node ${v.node.children.length ? "branch" : "leaf"} ${stateCls(id)}`}
                            style={{ left: `${v.nx0 * 100}%`, top: `${v.ny0 * 100}%`, width: `${wPct}%`, height: `${(v.ny1 - v.ny0) * 100}%` }} {...bind(e)}>
                            {chip(id)}
                            {wPct > 9 && <span className="fl-tm-name">{v.node.children.length ? "▸ " : ""}{v.node.name}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) } }} />
              )}
            </div>
          )}

          {frame === "monitor" && (
            <div className="fl-hostbox" ref={monRef}>
              {monSize.w > 0 && (
                <AddressedGui document={hostDocument(monSize)} device="desktop" width={monSize.w} height={monSize.h}
                  components={HOST_COMPONENTS} addressing={NO_ADDRESSING}
                  values={{ "gui:host": { surface: (
                    <div className="fl-mon">
                      <div className="fl-axis"><span>−8 min</span><span>{monRunning ? "live" : "HELD"} · tick {tickCount}</span><span>now</span></div>
                      {monitor.map((s, i) => {
                        const id = `lane:${s.lane.id}`;
                        const e = entry(id);
                        const focused = laneFocus === i;
                        return (
                          <div key={id} className={`fl-lane ${focused ? "focus" : ""} ${stateCls(id)}`} {...(e ? bind(e) : {})}>
                            <div className="fl-lab">{chip(id)}<span className="nm">{s.lane.label}</span><span className="val">{s.current.toFixed(2)}<small> · {i + 1}</small></span></div>
                            <div className="fl-strip"><LaneCanvas series={s} bands={Number(monParams.values.bands)} step={Number(monParams.values.step)} focused={focused} /></div>
                          </div>
                        );
                      })}
                    </div>
                  ) } }} />
              )}
            </div>
          )}

          {frame === "sunburst" && (
            <div className="fl-hostbox" ref={sbRef}>
              {sbSize.w > 0 && (
                <AddressedGui document={hostDocument(sbSize)} device="desktop" width={sbSize.w} height={sbSize.h}
                  components={HOST_COMPONENTS} addressing={NO_ADDRESSING}
                  values={{ "gui:host": { surface: (
                    <div className="fl-sb">
              <svg viewBox="0 0 640 640" className="fl-sb-svg">
                <circle cx="320" cy="320" r="84" className="fl-sb-centre" onClick={() => doBack()} />
                {[...sbVisible].sort((a, b) => a.ring - b.ring).map((v) => {
                  const id = `sb:${nodePath(v.node, sbAncestors)}`;
                  const e = entry(id);
                  if (!e) return null;
                  const r0 = 86 + (v.ring - 1) * 74;
                  const r1 = r0 + 74 - 3;
                  return <path key={id} d={arcPath(v.a0, v.a1, r0, r1)} fill={sbColour(v.node)} className={`fl-sb-path ${stateCls(id)}`} {...bind(e)} />;
                })}
              </svg>
              {sbVisible.map((v) => {
                const id = `sb:${nodePath(v.node, sbAncestors)}`;
                if (!labelOf(id)) return null;
                const a = (v.a0 + v.a1) / 2;
                const r = 86 + (v.ring - 1) * 74 + 37;
                const x = (320 + r * Math.sin(a)) / 640 * 100;
                const y = (320 - r * Math.cos(a)) / 640 * 100;
                return <span key={id} className="fl-chip fl-sb-chip" style={{ left: `${x}%`, top: `${y}%` }}>{labelOf(id)}</span>;
              })}
              <span className="fl-sb-root">{sbFocusNode.name}</span>
                    </div>
                  ) } }} />
              )}
            </div>
          )}

          {frame === "mail" && (
            <div className="fl-mail" ref={mailRef}>
              {mailSize.w > 0 && (
                <AddressedGui
                  document={mailDocument({
                    folders: FOLDERS.map((fo) => ({ ...fo, count: allMail.filter((m) => m.folder === fo.id).length })),
                    folderMail, openMail, composeOpen, size: mailSize,
                  })}
                  device="desktop" width={mailSize.w} height={mailSize.h}
                  values={composeOpen ? { "gui:cmp-to": { title: composeVals.to }, "gui:cmp-subject": { title: composeVals.subject }, "gui:cmp-body": { title: composeVals.body } } : undefined}
                  onValueChange={(nid, patch) => {
                    const f = { "gui:cmp-to": "to", "gui:cmp-subject": "subject", "gui:cmp-body": "body" }[nid];
                    if (f && typeof patch.title === "string") setComposeVals((v) => ({ ...v, [f]: patch.title }));
                  }}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "web" && (
            <div className="fl-web" ref={webRef}>
              {webSize.w > 0 && (
                <AddressedGui
                  document={webDocument({ page: webPage, hasFwd: webIndex < webHistory.length - 1, size: webSize })}
                  device="desktop" width={webSize.w} height={webSize.h}
                  values={{ "gui:web-addr": { title: addrText } }}
                  onValueChange={(nid, patch) => {
                    if (nid === "gui:web-back" && webIndex > 0) { const p = webPageById(webHistory[webIndex - 1]); setWebIndex(webIndex - 1); setTargetId(null); say(`WEB ▸ back — ${p.title}`); }
                    if (nid === "gui:web-addr" && typeof patch.title === "string") setAddrText(patch.title);
                  }}
                  onNodeSubmit={(nid) => {
                    if (nid !== "gui:web-addr") return;
                    const p = resolveWebAddress(addrText);
                    if (p) { webGo(p.id); setTargetId(null); say(`WEB ▸ ${p.title}`); }
                    else say(`“${addrText}” is not a captured page — the live web rides the local bridge (later slice)`);
                    document.activeElement?.blur();
                  }}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "settings" && (
            <div className="fl-app" ref={setRef}>
              {setSize.w > 0 && (
                <AddressedGui
                  document={settingsDocument({ size: setSize })}
                  device="desktop" width={setSize.w} height={setSize.h}
                  values={{
                    "gui:set:accent": { selectedSegment: settings.accent },
                    "gui:set:dolly": { value: Math.round((settings.dollyStep - 1.1) / 0.4 * 100) },
                    "gui:set:chips": { checked: settings.chips },
                    "gui:set:rate": { value: Math.round((settings.monRate - 0.5) / 1.5 * 100) },
                    "gui:set-val-accent": { title: ACCENTS[settings.accent].name },
                    "gui:set-val-dolly": { title: `×${settings.dollyStep}` },
                    "gui:set-val-chips": { title: settings.chips ? "ON" : "OFF" },
                    "gui:set-val-rate": { title: `×${settings.monRate}` },
                  }}
                  onValueChange={(nid, patch) => {
                    if (nid === "gui:set:accent" && typeof patch.selectedSegment === "number") setSettings((s) => ({ ...s, accent: patch.selectedSegment }));
                    if (nid === "gui:set:dolly" && typeof patch.value === "number") setSettings((s) => ({ ...s, dollyStep: Math.round((1.1 + patch.value / 100 * 0.4) * 100) / 100 }));
                    if (nid === "gui:set:chips" && typeof patch.checked === "boolean") setSettings((s) => ({ ...s, chips: patch.checked }));
                    if (nid === "gui:set:rate" && typeof patch.value === "number") setSettings((s) => ({ ...s, monRate: Math.round((0.5 + patch.value / 100 * 1.5) * 100) / 100 }));
                  }}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "chat" && (
            <div className="fl-app" ref={chatRef}>
              {chatSize.w > 0 && (
                <AddressedGui
                  document={chatDocument({ threads: THREADS_SEED, thread: chatThread, msgs: chatMsgs, size: chatSize })}
                  device="desktop" width={chatSize.w} height={chatSize.h}
                  values={{ "gui:chat-in": { title: chatDraft } }}
                  onValueChange={(nid, patch) => { if (nid === "gui:chat-in" && typeof patch.title === "string") setChatDraft(patch.title); }}
                  onNodeSubmit={(nid) => { if (nid === "gui:chat-in") sendChat(); }}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "docs" && (
            <div className="fl-app" ref={docsRef}>
              {docsSize.w > 0 && (
                <AddressedGui
                  document={docsDocument({ docs, doc, size: docsSize })}
                  device="desktop" width={docsSize.w} height={docsSize.h}
                  values={{ "gui:doc-body": { title: doc.body } }}
                  onValueChange={(nid, patch) => { if (nid === "gui:doc-body" && typeof patch.title === "string") setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, body: patch.title } : d))); }}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "terminal" && (
            <div className="fl-app" ref={termRef} onClick={(e) => { if (!e.target.closest('[data-gui-node="gui:act:term-clear"]')) document.querySelector('[data-gui-node="gui:term-in"] input')?.focus(); }}>
              {termSize.w > 0 && (
                <AddressedGui
                  document={termDocument({ lines: termLines, size: termSize })}
                  device="desktop" width={termSize.w} height={termSize.h}
                  values={{ "gui:term-in": { title: termCmd } }}
                  onValueChange={(nid, patch) => { if (nid === "gui:term-in" && typeof patch.title === "string") setTermCmd(patch.title); }}
                  onNodeSubmit={(nid) => { if (nid === "gui:term-in") runTerm(); }}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "media" && (
            <div className="fl-app" ref={mediaRef}>
              {mediaSize.w > 0 && (
                <AddressedGui
                  document={mediaDocument({ items: MEDIA_ITEMS, current: mediaItem, playing: mediaPlaying, pos: mediaPos, size: mediaSize })}
                  device="desktop" width={mediaSize.w} height={mediaSize.h}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "software" && (
            <div className="fl-app" ref={softRef}>
              {softSize.w > 0 && (
                <AddressedGui
                  document={softwareDocument({ frames: FRAMES.filter((f) => f.id !== "home" && f.id !== "software"), disabled: disabledFrames, size: softSize })}
                  device="desktop" width={softSize.w} height={softSize.h}
                  values={Object.fromEntries(FRAMES.map((f) => [guiIdOf(`soft:${f.id}`), { checked: !disabledFrames.includes(f.id) }]))}
                  onValueChange={(nid, patch) => { if (nid.startsWith("gui:soft:") && typeof patch.checked === "boolean") toggleFrame(nid.slice(9)); }}
                  addressing={addressing} onAddress={onAddress} />
              )}
            </div>
          )}

          {frame === "flow" && (
            <div className="fl-hostbox" ref={flowRef}>
              {flowSize.w > 0 && (
                <AddressedGui document={hostDocument(flowSize)} device="desktop" width={flowSize.w} height={flowSize.h}
                  components={HOST_COMPONENTS} addressing={NO_ADDRESSING}
                  values={{ "gui:host": { surface: (
                    <div className="fl-flow">
              {flowView.level === 0 || !frameGraph || !frameLayout ? (<>
              <div className="fl-flow-canvas">
                <svg viewBox={`0 0 ${flowLayout.w} ${flowLayout.h}`} className="fl-flow-svg">
                  {flowGraph.edges.filter((e) => ["OPEN", "F", "ESC", "NOT YET"].includes(e.via)).map((e, i) => {
                    const a = flowLayout.pos.get(e.from);
                    const bq = flowLayout.pos.get(e.to);
                    if (!a || !bq) return null;
                    return <line key={i} x1={a.x} y1={a.y} x2={bq.x} y2={bq.y} className={`fl-flow-edge ${e.via === "ESC" ? "esc" : e.via === "NOT YET" ? "gap" : "fwd"}`} />;
                  })}
                  {flowGraph.nodes.map((nd) => {
                    const p = flowLayout.pos.get(nd.id);
                    if (!p) return null;
                    if (nd.kind === "shell") return (
                      <g key={nd.id}><rect x={p.x - 62} y={p.y - 16} width={124} height={32} rx={5} className="fl-flow-shell" /><text x={p.x} y={p.y + 4} className="fl-flow-t shell">FLAT SPACE</text></g>
                    );
                    if (nd.kind === "gap") return (
                      <g key={nd.id}><rect x={p.x - 130} y={p.y - 11} width={260} height={22} rx={4} className="fl-flow-gap" /><text x={p.x} y={p.y + 3.5} className="fl-flow-t gap">{nd.name}</text></g>
                    );
                    const e2 = entry(`graph:${nd.id}`);
                    const isFrame = nd.kind === "frame";
                    const w = isFrame ? 150 : 216;
                    const h = isFrame ? 26 : 22;
                    return (
                      <g key={nd.id} data-flow-node={nd.id} {...(e2 ? bind(e2) : {})}>
                        <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx={4}
                          className={`fl-flow-node ${isFrame ? "frame" : "sub"} ${e2 ? stateCls(e2.item.id) : ""}`}
                          style={isFrame ? { stroke: frameById(nd.frame)?.color } : undefined} />
                        <text x={p.x + (e2 ? 16 : 0)} y={p.y + 3.5} className={`fl-flow-t ${isFrame ? "frame" : ""}`}>{(nd.name || "").slice(0, isFrame ? 16 : 27)}</text>
                      </g>
                    );
                  })}
                </svg>
                {addressables.map((a) => {
                  const p = flowLayout.pos.get(a.item.graphNode.id);
                  if (!p) return null;
                  const isFrame = a.item.graphNode.kind === "frame";
                  const left = (p.x - (isFrame ? 75 : 108) + 4) / flowLayout.w * 100;
                  return <span key={a.item.id} className="fl-chip fl-flow-chip" style={{ left: `${left}%`, top: `${(p.y / flowLayout.h) * 100}%` }}>{a.label}</span>;
                })}
              </div>
              <div className="fl-flow-acts">
                <h4>WHAT PEOPLE DO ON LINUX — WHAT'S AVAILABLE HERE</h4>
                <div className="fl-act-row">
                  {USUAL_ACTIVITIES.map((a) => (
                    <span key={a.activity} className={`fl-act-chip ${a.status}`}>{a.activity}{a.status === "present" ? ` · ${frameById(a.frame)?.name}` : " · not yet"}</span>
                  ))}
                </div>
                <p className="fl-flow-note">Edges drawn: F — open / descend / follow (teal), Esc — release to Home (amber dashed), NOT YET (grey dashed). Tab enters each frame's subnode cycle and / search-jumps straight to any node; those two paths reach everything, so they are stated here rather than drawn. Branch subnodes (FILES, SUNBURST) continue below the ones drawn — subnodes exist by descent, as deep as the data goes. Dolly with V and C into whatever you are looking at.</p>
              </div>
              </>) : (<>
              <div className="fl-flow-head">{frameById(flowView.frame).name} — ITS GRAPH, INSIDE FLOW · F opens a node here · D climbs back a level · the view never leaves FLOW</div>
              <div className="fl-flow-canvas">
                <svg viewBox={`0 0 ${frameLayout.w} ${frameLayout.h}`} className="fl-flow-svg">
                  {frameGraph.edges.map((e, i) => {
                    const a = frameLayout.pos.get(e.from);
                    const bq = frameLayout.pos.get(e.to);
                    if (!a || !bq) return null;
                    return <line key={i} x1={a.x} y1={a.y} x2={bq.x} y2={bq.y} className={`fl-flow-edge ${e.via === "D" ? "esc" : "fwd"}`} />;
                  })}
                  {frameGraph.nodes.map((nd) => {
                    const p = frameLayout.pos.get(nd.id);
                    if (!p) return null;
                    const e2 = entry(`graph:${nd.id}`);
                    const isFrame = nd.kind === "frame";
                    const isChild = nd.kind === "child";
                    const w = isFrame ? 150 : isChild ? 250 : 216;
                    const h = isFrame ? 26 : 22;
                    return (
                      <g key={nd.id} data-flow-node={nd.id} {...(e2 ? bind(e2) : {})}>
                        <rect x={p.x - w / 2} y={p.y - h / 2} width={w} height={h} rx={4}
                          className={`fl-flow-node ${isFrame ? "frame" : isChild ? "child" : "sub"} ${e2 ? stateCls(e2.item.id) : ""} ${flowView.sub === nd.id ? "selected" : ""}`}
                          style={isFrame ? { stroke: frameById(nd.frame)?.color } : undefined} />
                        <text x={p.x + (e2 ? 16 : 0)} y={p.y + 3.5} className={`fl-flow-t ${isFrame ? "frame" : ""}`}>{(nd.name || "").slice(0, isFrame ? 16 : 34)}</text>
                      </g>
                    );
                  })}
                </svg>
                {addressables.map((a) => {
                  const p = frameLayout.pos.get(a.item.graphNode.id);
                  if (!p) return null;
                  const w2 = a.item.graphNode.kind === "child" ? 250 : 216;
                  const left = (p.x - w2 / 2 + 4) / frameLayout.w * 100;
                  return <span key={a.item.id} className="fl-chip fl-flow-chip" style={{ left: `${left}%`, top: `${(p.y / frameLayout.h) * 100}%` }}>{a.label}</span>;
                })}
              </div>
              {flowView.level === 2 && (() => {
                const sel = frameGraph.nodes.find((nd) => nd.id === flowView.sub);
                if (!sel) return null;
                const kids = sel.kind === "subnode" ? frameGraph.nodes.filter((nd) => nd.kind === "child" && nd.parentSub === sel.id) : [];
                const parent = sel.kind === "child" ? frameGraph.nodes.find((nd) => nd.id === sel.parentSub) : null;
                return (
                  <div className="fl-flow-detail">
                    <h4>{sel.name}</h4>
                    {sel.desc ? <p>{sel.desc}</p> : null}
                    {parent && <p className="dim">inside {parent.name} · {frameById(flowView.frame).name}</p>}
                    {kids.length > 0 && (<ul>{kids.slice(0, 10).map((k) => <li key={k.id}>{k.name} <span className="dim">— {k.desc}</span></li>)}</ul>)}
                    {sel.kind === "subnode" && kids.length === 0 && <p className="dim">A leaf of this graph — the living version is in {frameById(flowView.frame).name} itself; D climbs back.</p>}
                  </div>
                );
              })()}
              </>)}
                    </div>
                  ) } }} />
              )}
            </div>
          )}
          </div>

          {searchOpen && (
            <div className="fl-search">
              <input autoFocus placeholder="Search frames, mail, file nodes… (Enter opens the first, Esc closes)" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && searchResults[0]) searchResults[0].act(); if (e.key === "Escape") setSearchOpen(false); }}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)} />
              {searchResults.map((r, i) => (
                <button key={i} className="fl-search-row" onMouseDown={(e) => { e.preventDefault(); r.act(); }}>
                  <b>{r.kind}</b> {r.name}
                </button>
              ))}
              {searchQuery && searchResults.length === 0 && <p className="fl-empty">Nothing matches.</p>}
            </div>
          )}
        </section>

        <aside className={`fl-insp ${inspOpen ? "" : "closed"}`}>
          <h3>INSPECT <button className="fl-collapse" onClick={(e) => { setInspOpen(false); e.currentTarget.blur(); }}>»</button></h3>
          <div className="fl-readout" data-testid="readout">
            {addressee ? (
              <>
                <div><span className="k">TARGET</span> {addressee.label} · {addressee.item.kind}</div>
                <div><span className="k">NAME</span> {addressee.item.name}</div>
                <div>{addressee.item.desc}</div>
              </>
            ) : (
              <div>Nothing targeted. Type a label, Tab through the frame, or hover — F clicks whatever the cursor is on.</div>
            )}
            <div style={{ marginTop: 8 }}><span className="k">FRAME</span> {frameById(frame).name} — {frameById(frame).sub}</div>
            <div><span className="k">MODE</span> {modeName}</div>
            <div><span className="k">DOLLY</span> ×{dolly}{dolly !== 1 ? ` · centred ${Math.round(dollyOrigin.x)}%, ${Math.round(dollyOrigin.y)}%` : ""}</div>
          </div>
          {paramsFor && (
            <><h3 style={{ marginTop: 16 }}>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS[frame]} values={paramsFor.values} onChange={paramsFor.setValue} /></>
          )}
          <h3 style={{ marginTop: 16 }}>GUIDE</h3>
          <p className="fl-guide">{guideText}</p>
        </aside>
      </div>

      {!railOpen && <button className="fl-tab left" onClick={(e) => { setRailOpen(true); e.currentTarget.blur(); }}>NAVIGATOR</button>}
      {!inspOpen && <button className="fl-tab right" onClick={(e) => { setInspOpen(true); e.currentTarget.blur(); }}>INSPECT</button>}

      {keysOpen && (
        <div className="fl-keys">
          <div className="fl-keys-head">KEYBOARD · SCOPE {scopes.join(" + ").toUpperCase()} — sparse: only bound caps carry a name; the rest are bare glyphs</div>
          {board.map((row, ri) => (
            <div key={ri} className="fl-krow">
              {row.map((c) => (
                <div key={c.code} className={`fl-cap ${c.binding ? "bound" : ""}`} style={{ width: c.w * 40 }}>
                  <span className="g">{c.glyph}</span>
                  {c.binding && <span className="n">{c.binding.name}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <footer className="fl-foot">
        <span className="fl-foot-mode">{modeName}</span>
        <span className="fl-echo" data-testid="echo">{echo}</span>
        <AppStatus
          items={[{ id: "frame", label: "FRAME" }, { id: "dolly", label: "DOLLY" }]}
          values={{ frame: frameById(frame).name, dolly: `×${dolly}` }} />
        <span className="fl-foot-keys">F click · D back · Esc release · V/C dolly · Tab next · / search · Alt+K keys</span>
      </footer>
    </div>
  );
}

const css = `
.fl-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; height:100dvh; position:relative; margin:0; overflow:hidden;
  /* the app-kit Chrome pieces (AppToolbar / AppStatus) theme off
     these shell variables */
  --border:#2c3a41; --bg-3:#131b1f; --text:#cfd8dc; --text-faint:#8fa3ab; }
.fl-top div[aria-label="Application toolbar"] { margin:0 !important; }
.fl-foot footer[aria-label="Application status"] { margin-top:0 !important; padding-top:0 !important; border-top:none !important; }
.fl-top { position:absolute; top:0; left:0; right:0; z-index:30; display:flex; align-items:center; gap:16px; padding:8px 16px; border-bottom:1px solid #2c3a41; background:rgba(14,20,24,.92); backdrop-filter:blur(6px); }
.fl-top strong { letter-spacing:3px; color:#e8f3ee; font-size:15px; }
.fl-top-frame { font-family:Consolas, monospace; font-size:11px; color:#ffa726; letter-spacing:1px; }
.fl-mode { font-family:Consolas, monospace; font-size:10.5px; padding:2px 8px; border:1px solid #2c3a41; border-radius:3px; color:#7fd4c1; }
.fl-mode.texting { color:#ffb74d; border-color:#ffb74d; }
.fl-nav { margin-left:auto; display:flex; gap:14px; }
.fl-nav a { color:#7fd4c1; font-size:12px; text-decoration:none; }
.fl-nav a:hover { color:#ffa726; }
.fl-keys-btn { background:#131b1f; color:#cfd8dc; border:1px solid #2c3a41; border-radius:4px; padding:4px 10px; font-family:Consolas, monospace; font-size:11px; cursor:pointer; }
.fl-keys-btn:hover { border-color:#ffa726; color:#ffa726; }
.fl-main { display:contents; }
.fl-rail, .fl-insp { position:absolute; top:96px; bottom:54px; z-index:25; border:1px solid #2c3a41; border-radius:6px; background:rgba(16,22,26,.93); backdrop-filter:blur(6px); padding:12px; overflow-y:auto; transition:transform .2s ease, opacity .2s ease; }
.fl-rail { left:12px; width:224px; }
.fl-insp { right:12px; width:296px; }
.fl-rail.closed { transform:translateX(-115%); opacity:0; pointer-events:none; }
.fl-insp.closed { transform:translateX(115%); opacity:0; pointer-events:none; }
.fl-collapse { float:right; background:none; border:1px solid #2c3a41; border-radius:3px; color:#8fa3ab; cursor:pointer; font-size:11px; padding:0 6px; line-height:1.5; }
.fl-collapse:hover { color:#ffa726; border-color:#ffa726; }
.fl-tab { position:absolute; top:96px; z-index:24; writing-mode:vertical-rl; background:rgba(16,22,26,.93); border:1px solid #2c3a41; color:#7fd4c1; font-family:Consolas, monospace; font-size:10px; letter-spacing:2px; padding:10px 5px; cursor:pointer; }
.fl-tab.left { left:0; border-radius:0 6px 6px 0; border-left:none; }
.fl-tab.right { right:0; border-radius:6px 0 0 6px; border-right:none; }
.fl-tab:hover { color:#ffa726; border-color:#ffa726; }
.fl-rail h3, .fl-insp h3 { margin:0 0 8px; font-size:10.5px; letter-spacing:2px; color:#e8f3ee; }
.fl-rail-btn { display:flex; gap:9px; align-items:flex-start; width:100%; text-align:left; background:none; border:1px solid transparent; border-radius:5px; color:#cfd8dc; padding:7px 8px; cursor:pointer; font:inherit; font-size:12.5px; }
.fl-rail-btn small { display:block; color:#8fa3ab; font-size:10.5px; }
.fl-rail-btn:hover { background:#131b1f; }
.fl-rail-btn.here { background:#131b1f; border-color:#ffa726; }
.fl-dot { width:9px; height:9px; border-radius:2px; margin-top:4px; flex:none; }
.fl-keylist { font-size:11px; }
.fl-keyrow { padding:4px 0; border-bottom:1px dashed #22303a; }
.fl-keyrow b { color:#ffa726; font-family:Consolas, monospace; font-size:10.5px; display:block; }
.fl-keyrow span { color:#8fa3ab; line-height:1.45; display:block; }
.fl-stage { position:absolute; inset:0; background:#0e1418; overflow:hidden; }
.fl-stage.texting { box-shadow: inset 0 0 0 2px rgba(255,183,77,.55); }
.fl-dolly { position:absolute; inset:0; padding:102px 16px 48px; display:flex; flex-direction:column; transition:transform .18s ease, padding .18s ease; }
.fl-dolly.rail-open { padding-left:252px; }
.fl-dolly.insp-open { padding-right:324px; }
.fl-crumbs { position:absolute; top:46px; left:12px; right:12px; z-index:15; display:flex; gap:6px; align-items:center; padding:7px 12px; border:1px solid #22303a; border-radius:6px; background:rgba(14,20,24,.87); backdrop-filter:blur(6px); font-family:Consolas, monospace; font-size:11.5px; color:#a9f0dd; flex-wrap:wrap; pointer-events:none; }
.fl-crumbs button { pointer-events:auto; }
.fl-crumbs button { background:none; border:none; color:#a9f0dd; font:inherit; cursor:pointer; padding:0; }
.fl-crumbs button:hover { color:#ffa726; }
.fl-buffer { margin-left:auto; color:#ffa726; }
.fl-chip { display:inline-block; font-family:Consolas, monospace; font-size:9.5px; padding:0 4px; border-radius:3px; border:1px solid rgba(255,167,38,.65); background:rgba(6,12,14,.85); color:#ffa726; margin-right:6px; vertical-align:1px; }
.is-target { outline:2px solid #ffa726 !important; outline-offset:-2px; }
.is-hover { outline:1px solid #7fd4c1; outline-offset:-1px; }
.is-target.is-hover { outline:2px solid #ffa726; }
/* HOME board */
.fl-board { position:relative; flex:1; margin:10px; border:1px dashed #22303a; border-radius:6px; background:radial-gradient(circle at 30% 20%, rgba(127,212,193,.05), transparent 55%); }
/* The hosted paramorphic surfaces, re-tokened to Flat Space's dark
   register through the app-kit's own --gui-* theme variables. */
.fl-board .gui-root, .fl-board .gui-node, .fl-board .gui-addressed,
.fl-mail .gui-root, .fl-mail .gui-node, .fl-mail .gui-addressed,
.fl-web .gui-root, .fl-web .gui-node, .fl-web .gui-addressed,
.fl-app .gui-root, .fl-app .gui-node, .fl-app .gui-addressed,
.fl-hostbox .gui-root, .fl-hostbox .gui-node, .fl-hostbox .gui-addressed {
  --gui-base:#0d1216;
  --gui-panel-top:#182227; --gui-panel-btm:#10161a; --gui-well:#0a0e11;
  --gui-line:#2c3a41; --gui-text:#d7dee2; --gui-dim:#93a5ad;
  --gui-accent:var(--fl-accent, #ffa726); --gui-tone:#7fd4c1;
  font-family:"IBM Plex Mono", ui-monospace, monospace;
}
.fl-board .gui-panel, .fl-mail .gui-panel, .fl-web .gui-panel, .fl-app .gui-panel { box-shadow:0 10px 24px rgba(0,0,0,.35); }
.fl-board .gui-panel-title, .fl-mail .gui-panel-title, .fl-web .gui-panel-title, .fl-app .gui-panel-title { font-size:12px; letter-spacing:1.5px; color:var(--gui-text); padding:7px 10px 0; }
.fl-board .gui-text-block, .fl-mail .gui-text-block, .fl-web .gui-text-block, .fl-app .gui-text-block { font-size:11.5px; color:#b7c6cc; }
.fl-board .gui-text-label, .fl-mail .gui-text-label, .fl-web .gui-text-label, .fl-app .gui-text-label { font-size:10.5px; color:var(--gui-dim); }
.fl-board .gui-node, .fl-mail .gui-node, .fl-web .gui-node, .fl-app .gui-node { cursor:pointer; }
.fl-mail .gui-text-block, .fl-web .gui-text-block, .fl-app .gui-text-block { font-size:12px; line-height:1.6; }
.fl-web .gui-panel-title { font-size:14px; }
/* Subjects and page titles keep their natural case (the panel's
   uppercase is the board's register, not the reading surface's). */
.fl-mail .gui-panel-title, .fl-web .gui-panel-title, .fl-app .gui-panel-title { text-transform:none; letter-spacing:.3px; }
/* Data-frame host boxes: the frame area is measured and hosted as a
   one-node GuiDocument; the surface fills (or, for the sunburst's
   square stage, centres in) the host node. */
.fl-hostbox { flex:1; position:relative; min-height:0; }
.fl-hostbox .fl-tm { position:absolute; inset:10px; width:auto; height:auto; flex:none; margin:0; }
.fl-hostbox .fl-mon { position:absolute; inset:0; }
.fl-hostbox .fl-flow { position:absolute; inset:0; }
.fl-hostbox .fl-sb { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); margin:0; }
/* FILES treemap */
.fl-tm { position:relative; flex:1; margin:10px; border:1px solid #22303a; border-radius:4px; overflow:hidden; background:#0a0f12; }
.fl-tm-node { position:absolute; box-sizing:border-box; border:1px solid rgba(11,14,16,.85); overflow:hidden; cursor:pointer; }
.fl-tm-node.branch { background:rgba(127,212,193,.20); }
.fl-tm-node.leaf { background:rgba(127,212,193,.48); }
.fl-tm-node:hover { background:rgba(255,167,38,.45); }
.fl-tm-node .fl-chip { position:absolute; top:2px; left:2px; margin:0; }
.fl-tm-name { position:absolute; top:2px; left:30px; right:3px; font-size:10.5px; color:#eafaf4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow:0 1px 2px rgba(0,0,0,.6); }
/* MONITOR */
.fl-mon { flex:1; overflow-y:auto; padding:10px 12px; }
.fl-axis { display:flex; justify-content:space-between; font-family:Consolas, monospace; font-size:10px; color:#8fa3ab; margin:0 0 6px 158px; }
.fl-lane { display:flex; gap:12px; align-items:stretch; padding:5px 6px; border-radius:4px; border:1px solid transparent; cursor:pointer; }
.fl-lane:hover { background:#131b1f; }
.fl-lane.focus { background:#131b1f; border-color:#ffa726; }
.fl-lab { width:146px; flex:none; display:flex; flex-direction:column; justify-content:center; gap:2px; }
.fl-lab .nm { font-size:11px; letter-spacing:1.5px; color:#e8f3ee; }
.fl-lab .val { font-family:Consolas, monospace; font-size:14px; color:#a9f0dd; }
.fl-lab .val small { color:#8fa3ab; font-size:10px; }
.fl-strip { flex:1; min-width:0; border:1px solid #2c3a41; border-radius:2px; overflow:hidden; }
/* SUNBURST */
.fl-sb { position:relative; margin:6px auto; aspect-ratio:1/1; width:min(96%, calc(100dvh - 250px)); flex:none; }
.fl-sb-svg { width:100%; height:100%; display:block; }
.fl-sb-path { stroke:#0b0e10; stroke-width:1.5; cursor:pointer; opacity:.92; }
.fl-sb-path:hover { opacity:1; stroke:#ffa726; }
.fl-sb-centre { fill:#131b1f; stroke:#2c3a41; cursor:pointer; }
.fl-sb-chip { position:absolute; transform:translate(-50%,-50%); margin:0; pointer-events:none; }
.fl-sb-root { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:12px; letter-spacing:1px; color:#e8f3ee; pointer-events:none; max-width:130px; text-align:center; word-break:break-word; }
/* MAIL — an app-kit document now; the frame is just its host box */
.fl-mail { flex:1; position:relative; margin:10px; min-height:0; }
/* The app frames (SETTINGS / CHAT / DOCUMENTS / TERMINAL / MEDIA /
   SOFTWARE) share one host box. */
.fl-app { flex:1; position:relative; margin:10px; min-height:0; }
/* SETTINGS at work: the accent variable recolours the frame name,
   and chips-off hides every label chip in the environment. */
.fl-top-frame { color:var(--fl-accent, #ffa726) !important; }
.no-chips .fl-chip, .no-chips .gui-chip { display:none; }
.fl-empty { color:#8fa3ab; font-size:12px; }
/* SEARCH */
.fl-search { position:absolute; top:100px; left:50%; transform:translateX(-50%); width:min(560px, 92%); background:#10161a; border:1px solid #ffa726; border-radius:6px; padding:10px; z-index:20; box-shadow:0 18px 40px rgba(0,0,0,.55); display:flex; flex-direction:column; gap:6px; }
.fl-search input { background:#0a0f12; border:1px solid #2c3a41; border-radius:4px; color:#e8f3ee; padding:9px 10px; font:inherit; font-size:13px; }
.fl-search input:focus { border-color:#ffb74d; outline:none; }
.fl-search-row { background:none; border:1px solid #22303a; border-radius:4px; color:#cfd8dc; text-align:left; padding:7px 9px; cursor:pointer; font:inherit; font-size:12px; }
.fl-search-row b { color:#ffa726; font-family:Consolas, monospace; font-size:10.5px; margin-right:8px; }
.fl-search-row:hover { border-color:#ffa726; }
/* INSPECTOR */
.fl-readout { font-family:Consolas, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; word-break:break-word; }
.fl-readout .k { color:#ffa726; }
.fl-guide { font-size:11.5px; line-height:1.6; color:#8fa3ab; margin:0; }
/* KEYBOARD PANEL */
.fl-keys { position:fixed; left:50%; bottom:46px; transform:translateX(-50%); background:rgba(13,18,22,.96); border:1px solid #2c3a41; border-radius:8px; padding:10px 12px; z-index:40; box-shadow:0 18px 44px rgba(0,0,0,.6); }
.fl-keys-head { font-family:Consolas, monospace; font-size:10px; color:#8fa3ab; letter-spacing:1px; margin-bottom:8px; text-align:center; }
.fl-krow { display:flex; gap:4px; margin-bottom:4px; justify-content:center; }
.fl-cap { height:40px; border:1px solid #22303a; border-radius:4px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#546e7a; flex:none; box-sizing:border-box; }
.fl-cap .g { font-size:11px; }
.fl-cap.bound { border-color:rgba(255,167,38,.6); color:#e8f3ee; background:rgba(255,167,38,.07); }
.fl-cap.bound .n { font-family:Consolas, monospace; font-size:7.5px; color:#ffa726; letter-spacing:.4px; text-align:center; line-height:1.2; padding:0 2px; }
/* FOOTER */
.fl-foot { position:absolute; bottom:0; left:0; right:0; z-index:30; display:flex; align-items:center; gap:14px; padding:6px 16px; border-top:1px solid #2c3a41; background:rgba(14,20,24,.92); backdrop-filter:blur(6px); font-family:Consolas, monospace; font-size:11px; }
.fl-foot-mode { color:#0b0e10; background:#7fd4c1; border-radius:3px; padding:1px 7px; font-weight:bold; }
.fl-echo { color:#a9f0dd; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fl-foot-keys { color:#8fa3ab; }
/* WEB — captured pages as an app-kit document; the frame is its host box */
.fl-web { flex:1; position:relative; margin:10px; min-height:0; }
/* FLOW — the user flow graph frame */
.fl-flow { flex:1; overflow-y:auto; padding:10px 12px; min-height:0; }
.fl-flow-canvas { position:relative; border:1px solid #22303a; border-radius:6px; background:#0a0f12; }
.fl-flow-svg { display:block; width:100%; }
.fl-flow-edge.fwd { stroke:rgba(127,212,193,.4); stroke-width:1; }
.fl-flow-edge.esc { stroke:rgba(255,167,38,.45); stroke-width:1; stroke-dasharray:4 3; }
.fl-flow-edge.gap { stroke:rgba(143,163,171,.4); stroke-width:1; stroke-dasharray:3 4; }
.fl-flow-shell { fill:#131b1f; stroke:#ffa726; stroke-width:1.2; }
.fl-flow-node.frame { fill:#10161a; stroke-width:1.4; cursor:pointer; }
.fl-flow-node.sub { fill:#0d1418; stroke:#2c3a41; stroke-width:1; cursor:pointer; }
.fl-flow-gap { fill:none; stroke:#546e7a; stroke-width:1; stroke-dasharray:4 3; }
.fl-flow-t { fill:#cfd8dc; font-size:10.5px; font-family:Consolas, monospace; text-anchor:middle; pointer-events:none; }
.fl-flow-t.frame { fill:#e8f3ee; font-size:11.5px; }
.fl-flow-t.shell { fill:#ffa726; font-size:11.5px; letter-spacing:1px; }
.fl-flow-t.gap { fill:#8fa3ab; font-size:10px; }
.fl-flow-chip { position:absolute; transform:translateY(-50%); margin:0; pointer-events:none; }
.fl-flow-acts { margin-top:12px; border:1px solid #22303a; border-radius:6px; background:#0d1216; padding:12px 14px; }
.fl-flow-acts h4 { margin:0 0 9px; font-size:10px; letter-spacing:2px; color:#e8f3ee; }
.fl-act-row { display:flex; flex-wrap:wrap; gap:7px; }
.fl-act-chip { font-size:11px; padding:4px 9px; border-radius:4px; border:1px solid rgba(127,212,193,.5); color:#a9f0dd; }
.fl-act-chip.gap { border-style:dashed; border-color:#546e7a; color:#8fa3ab; }
.fl-flow-note { font-size:11.5px; line-height:1.65; color:#8fa3ab; margin:11px 0 0; }
.fl-flow-node.child { fill:#0a1013; stroke:#22303a; stroke-width:1; cursor:pointer; }
.fl-flow-node.selected { stroke:var(--fl-accent, #ffa726); stroke-width:1.6; }
.fl-flow-head { font-family:Consolas, monospace; font-size:11px; letter-spacing:1px; color:#a9f0dd; border:1px solid #22303a; border-radius:6px; background:#0d1216; padding:8px 12px; margin-bottom:10px; }
.fl-flow-detail { margin-top:12px; border:1px solid var(--fl-accent, #ffa726); border-radius:6px; background:#0d1216; padding:12px 14px; max-width:640px; }
.fl-flow-detail h4 { margin:0 0 6px; font-size:12.5px; color:#e8f3ee; font-family:Consolas, monospace; }
.fl-flow-detail p { margin:0 0 6px; font-size:12px; line-height:1.6; color:#cfd8dc; }
.fl-flow-detail p.dim, .fl-flow-detail .dim { color:#8fa3ab; }
.fl-flow-detail ul { margin:6px 0 0; padding-left:16px; font-size:12px; line-height:1.7; color:#cfd8dc; }
/* Short viewports: the Navigator overlay compresses — key names stay,
   descriptions move to the keyboard panel (Alt+K) and the guide. */
@media (max-height: 840px) {
  .fl-keyrow span { display:none; }
  .fl-keyrow { padding:2.5px 0; }
  .fl-rail-btn small { display:none; }
  .fl-rail-btn { padding:5px 8px; }
}
body { margin:0; }
`;
