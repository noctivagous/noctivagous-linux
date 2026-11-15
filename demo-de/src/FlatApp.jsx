import { useEffect, useMemo, useRef, useState } from "react";
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
import { FLARE } from "./sunburst-data.js";
import {
  assignLabels,
  resolveBuffer,
  isLabelKey,
  isTextEntryControl,
  resolveBoard,
} from "./flat-keys.js";

/**
 * FLAT SPACE — the 2D environment view (flat.html), first build.
 *
 * The peer of ui-space/ (the 3D view), built to the conversion plan:
 * stationary panels around a frame stage, every frame operated by
 * key-clicks from the ground up. The shell is a proportioned grid —
 * top system bar, left Navigator rail, centre stage, right Inspector,
 * footer command line — in the NCTGraphite AppShell arrangement,
 * hand-rolled here as the other demo-de pages hand-roll theirs.
 *
 * Input is one system, shared by view and handler (flat-keys.js):
 *  - everything targetable wears a label (alphabet skips D and F —
 *    operators are not addresses); typing a label targets its thing;
 *  - F clicks the addressee — the hovered thing wins, else the
 *    targeted thing (the UI Space F rule); the mouse mirrors it;
 *  - D goes back WITHIN the frame's own scope; Esc releases in a big
 *    way (clear target, then leave the frame for Home);
 *  - Space is the frame's own verb (drag-lock on Home, hold time on
 *    the Monitor); Tab cycles targets; / searches; Alt+K toggles the
 *    keyboard panel, which is resolved SPARSELY per scope from the
 *    same binding tables the handler consults.
 *
 * Frames: HOME (bulletin board, drag-lock cards), FILES (2D treemap
 * of the flare hierarchy — the Flat UI file navigator), MONITOR
 * (realtime horizon lanes), SUNBURST (the ZUI 2D-plane viewer), MAIL
 * (folders/list/reading + compose in real text mode).
 */

const FRAMES = [
  { id: "home", name: "HOME", sub: "bulletin board", color: "#ffa726" },
  { id: "files", name: "FILES", sub: "treemap navigator", color: "#7fd4c1" },
  { id: "monitor", name: "MONITOR", sub: "horizon lanes", color: "#82aaff" },
  { id: "sunburst", name: "SUNBURST", sub: "zui plane viewer", color: "#c792ea" },
  { id: "mail", name: "MAIL", sub: "folders · list · reading", color: "#addb67" },
];
const frameById = (id) => FRAMES.find((f) => f.id === id);

const MAIL_SEED = [
  { id: "m1", folder: "inbox", from: "team@keypilot.io", subject: "Welcome to KeyPilot!", when: "2h ago", body: "Thank you for installing KeyPilot. Steering is the mouse's job; clicking belongs to the keys now. Press F on anything you hover, and Esc is always the way out of a mode." },
  { id: "m2", folder: "inbox", from: "orders@shop.example", subject: "Your order confirmation", when: "1d ago", body: "Order #KP-2025-001 has been confirmed. Keyboard XL ×1 — it will ship with the next post." },
  { id: "m3", folder: "inbox", from: "newsletter@techweekly.example", subject: "Weekly Newsletter", when: "3d ago", body: "This week's top stories: bimodal interfaces, sparse key databases, and why the mouse click was always two jobs collapsed into one." },
  { id: "m4", folder: "drafts", from: "you", subject: "Draft: the 2D view", when: "draft", body: "Stationary panels, a plane of frames, and labels on everything…" },
  { id: "m5", folder: "trash", from: "promo@spam.example", subject: "You won (not really)", when: "9d ago", body: "Deleted, as it should be." },
];
const FOLDERS = [
  { id: "inbox", name: "Inbox" },
  { id: "sent", name: "Sent" },
  { id: "drafts", name: "Drafts" },
  { id: "trash", name: "Trash" },
];

const SAMPLES = 480;
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const nodePath = (node, ancestorsFn) => ancestorsFn(node).map((n) => n.name).join(" / ");

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

export default function FlatApp() {
  const [frame, setFrame] = useState("home");
  const [targetId, setTargetId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [buffer, setBuffer] = useState("");
  const [echo, setEcho] = useState("FLAT SPACE — type a label to target, F to click it");
  const [keysOpen, setKeysOpen] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const monParams = useNCTParameters(PARAM_DEFS.monitor);
  const sbParams = useNCTParameters(PARAM_DEFS.sunburst);
  const fileParams = useNCTParameters(PARAM_DEFS.files);

  /* FILES — treemap */
  const tmRoot = useMemo(() => buildTreemap(FLARE), []);
  const [tmFocus, setTmFocus] = useState(null);
  const tmFocusNode = tmFocus || tmRoot;
  /* SUNBURST */
  const sbRoot = useMemo(() => buildSunburst(FLARE), []);
  const sbColour = useMemo(() => sunburstColourScale(sbRoot.children.map((c) => c.name)), [sbRoot]);
  const [sbFocus, setSbFocus] = useState(null);
  const sbFocusNode = sbFocus || sbRoot;
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
    }, 250);
    return () => clearInterval(id);
  }, [monRunning, frame, monitor]);
  /* HOME cards */
  const cardIds = [...FRAMES.map((f) => f.id), "ops"];
  const [cardPos, setCardPos] = useState(() =>
    Object.fromEntries(cardIds.map((id, i) => [id, { x: 3 + (i % 3) * 33, y: 5 + Math.floor(i / 3) * 46 }])),
  );
  const [drag, setDrag] = useState(null); // {id, origin:{x,y}, x, y, dx, dy}
  const mouseRef = useRef({ x: 0, y: 0 });
  const boardRef = useRef(null);
  /* MAIL */
  const [mailFolder, setMailFolder] = useState("inbox");
  const [mailOpenId, setMailOpenId] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sentExtra, setSentExtra] = useState([]);
  const allMail = [...sentExtra, ...MAIL_SEED];
  const folderMail = allMail.filter((m) => m.folder === mailFolder);
  const openMail = allMail.find((m) => m.id === mailOpenId) || null;

  const say = (msg) => setEcho(msg);

  const openFrame = (id) => {
    setFrame(id);
    setTargetId(null);
    setHoverId(null);
    clearBuffer();
    say(`${frameById(id).name} — ${frameById(id).sub}`);
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
        ...FRAMES.map((f) => ({
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
          if (v.node.children.length) { setTmFocus(v.node); setTargetId(null); say(`FILES ▸ ${nodePath(v.node, tmAncestors)}`); }
          else say(`LEAF ${v.node.name} — value ${fmt(v.node.value)} · ${nodePath(v.node, tmAncestors)}`);
        },
      }));
    } else if (frame === "monitor") {
      raw = monitor.map((s, i) => ({
        id: `lane:${s.lane.id}`, name: s.lane.label, kind: "LANE",
        desc: `${s.lane.label.toLowerCase()} · now ${s.current.toFixed(2)} · key ${i + 1} or its label focuses the lane`,
        onF: () => { setLaneFocus(i); say(`LANE ${s.lane.label} focused — strip magnified`); },
      }));
    } else if (frame === "sunburst") {
      raw = sbVisible.map((v) => ({
        id: `sb:${nodePath(v.node, sbAncestors)}`, name: v.node.name, kind: v.node.children.length ? "BRANCH" : "LEAF",
        desc: `${nodePath(v.node, sbAncestors)} · value ${fmt(v.node.value)} · ${v.node.children.length ? "F descends" : "leaf — F inspects"}`,
        node: v.node, vis: v,
        onF: () => {
          if (v.node.children.length) { setSbFocus(v.node); setTargetId(null); say(`SUNBURST ▸ ${nodePath(v.node, sbAncestors)}`); }
          else say(`LEAF ${v.node.name} — value ${fmt(v.node.value)} · ${nodePath(v.node, sbAncestors)}`);
        },
      }));
    } else if (frame === "mail") {
      if (composeOpen) {
        raw = [
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
          { id: "act:compose", name: "COMPOSE", kind: "ACTION", desc: "Write a message — the fields are real text mode; Esc leaves it", onF: () => { setComposeOpen(true); say("COMPOSE — click a field or Tab into it; Esc exits text mode"); } },
          ...folderMail.map((m) => ({
            id: `mail:${m.id}`, name: m.subject, kind: "MESSAGE",
            desc: `from ${m.from} · ${m.when}`,
            onF: () => { setMailOpenId(m.id); say(`MAIL ▸ ${m.subject}`); },
          })),
        ];
      }
    }
    return assignLabels(raw);
  }, [frame, tmVisible, sbVisible, laneFocus, mailFolder, folderMail, composeOpen, allMail]);

  const addrById = useMemo(() => new Map(addressables.map((a) => [a.item.id, a])), [addressables]);
  const targetItem = targetId ? addrById.get(targetId) : null;
  const hoverItem = hoverId ? addrById.get(hoverId) : null;
  const addressee = hoverItem || targetItem; // hover wins — the F rule

  function sendCompose() {
    const to = document.getElementById("cmp-to")?.value.trim();
    const subject = document.getElementById("cmp-subject")?.value.trim();
    const body = document.getElementById("cmp-body")?.value.trim();
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
  const doBack = () => {
    clearBuffer();
    if (frame === "files" && tmFocusNode.parent) { setTmFocus(tmFocusNode.parent); setTargetId(null); say(`FILES ▸ ${nodePath(tmFocusNode.parent, tmAncestors)}`); }
    else if (frame === "sunburst" && sbFocusNode.parent) { setSbFocus(sbFocusNode.parent); setTargetId(null); say(`SUNBURST ▸ ${nodePath(sbFocusNode.parent, sbAncestors)}`); }
    else if (frame === "mail" && composeOpen) { setComposeOpen(false); say("COMPOSE closed — draft kept in the fields' memory only"); }
    else if (frame === "mail" && mailOpenId) { setMailOpenId(null); say("MAIL ▸ back to the list"); }
    else if (frame === "monitor" && laneFocus !== null) { setLaneFocus(null); say("MONITOR — lane released"); }
    else say("D — already at this frame's root. Esc leaves the frame.");
  };
  const doEsc = () => {
    if (drag) { setCardPos((p) => ({ ...p, [drag.id]: drag.origin })); setDrag(null); say("DRAG cancelled — card restored"); return; }
    if (buffer) { clearBuffer(); say("Buffer cleared"); return; }
    if (targetId) { setTargetId(null); say("Target released"); return; }
    if (frame !== "home") { openFrame("home"); return; }
    say("RELEASED — everything is at rest");
  };
  const cycleTarget = () => {
    clearBuffer();
    if (!addressables.length) return;
    const ids = addressables.map((a) => a.item.id);
    const i = ids.indexOf(targetId);
    const next = addressables[(i + 1) % addressables.length];
    setTargetId(next.item.id);
    say(`TARGET ${next.label} — ${next.item.name}`);
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
      if (hit) { setTargetId(hit.item.id); say(`TARGET ${hit.label} — ${hit.item.name}. F clicks it.`); }
    } else if (res.kind === "pending") {
      bufferRef.current = next; setBuffer(next);
      const token = tokenRef.current;
      timerRef.current = setTimeout(() => {
        if (tokenRef.current !== token) return; // a newer key superseded this timer
        const cur = bufferRef.current;
        const hit = addressables.find((a) => a.label === cur);
        bufferRef.current = ""; setBuffer("");
        if (hit) { setTargetId(hit.item.id); say(`TARGET ${hit.label} — ${hit.item.name}. F clicks it.`); }
      }, 800);
    } else {
      bufferRef.current = ""; setBuffer("");
      say(`No address “${next}” in this frame`);
    }
  };

  const R = useRef({});
  R.current = { frame, drag, searchOpen, addressables, monRunning, addressee, cardPos };
  const A = useRef({});
  A.current = { doF, doBack, doEsc, cycleTarget, pushLabel };

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && isTextEntryControl(t.tagName, t instanceof HTMLInputElement ? t.type : "", t.isContentEditable)) {
        if (e.key === "Escape") { t.blur(); }
        return; // text mode: keys are text, only Esc is monitored
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.altKey) {
        if (e.code === "KeyK") { e.preventDefault(); setKeysOpen((v) => !v); }
        return;
      }
      const st = R.current;
      const act = A.current;
      if (e.key === "Escape") { e.preventDefault(); act.doEsc(); return; }
      if (e.key === "Tab") { e.preventDefault(); act.cycleTarget(); return; }
      if (e.key === "Enter") { e.preventDefault(); act.doF(); return; }
      if (e.key === "`") { openFrame("home"); return; }
      if (e.key === "/") { e.preventDefault(); setSearchOpen(true); return; }
      if (e.key === " ") {
        e.preventDefault();
        if (st.frame === "monitor") { monParams.setValue("running", !st.monRunning); say(st.monRunning ? "MONITOR — time held (Space resumes)" : "MONITOR — time running"); }
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
      if (e.key === "f" || e.key === "F") { e.preventDefault(); act.doF(); return; }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); act.doBack(); return; }
      if (st.frame === "monitor" && /^[1-8]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        setLaneFocus(i);
        setTargetId(`lane:${monitor[i].lane.id}`);
        say(`LANE ${monitor[i].lane.label} focused`);
        return;
      }
      if (isLabelKey(e.key)) { act.pushLabel(e.key.toUpperCase()); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* text-mode tracking: any focus landing in a text control is text mode */
  useEffect(() => {
    const onFocusIn = (e) => {
      const t = e.target;
      setTextMode(Boolean(t && isTextEntryControl(t.tagName, t instanceof HTMLInputElement ? t.type : "", t.isContentEditable)));
    };
    const onFocusOut = () => setTextMode(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => { document.removeEventListener("focusin", onFocusIn); document.removeEventListener("focusout", onFocusOut); };
  }, []);

  const scopes = ["shell", frame, ...(textMode ? ["text"] : [])];
  const board = resolveBoard(scopes);
  const modeName = textMode ? "TEXT" : drag ? "DRAG LOCK" : searchOpen ? "SEARCH" : "KEY-CLICK";

  /* ---------------- render helpers ---------------- */
  const labelOf = (id) => addrById.get(id)?.label || "";
  const bind = (entry) => ({
    onMouseOver: (e) => { e.stopPropagation(); setHoverId(entry.item.id); },
    onMouseLeave: () => setHoverId(null),
    onClick: () => { setTargetId(entry.item.id); entry.item.onF(); },
  });
  const stateCls = (id) => `${targetId === id ? "is-target" : ""} ${hoverId === id ? "is-hover" : ""}`;
  const entry = (id) => addrById.get(id);
  const chip = (id) => (labelOf(id) ? <span className="fl-chip">{labelOf(id)}</span> : null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    for (const f of FRAMES) if (f.name.toLowerCase().includes(q)) out.push({ kind: "FRAME", name: f.name, act: () => { openFrame(f.id); setSearchOpen(false); } });
    for (const m of allMail) if ((m.subject + m.from).toLowerCase().includes(q)) out.push({ kind: "MAIL", name: m.subject, act: () => { setFrame("mail"); setMailFolder(m.folder); setMailOpenId(m.id); setSearchOpen(false); say(`MAIL ▸ ${m.subject}`); } });
    for (const n of tmDescendants(tmRoot).filter((x) => x.name.toLowerCase().includes(q)).slice(0, 6)) {
      out.push({ kind: "FILE NODE", name: `${n.name} · ${fmt(n.value)}`, act: () => { setFrame("files"); setTmFocus(n.parent || tmRoot); setTargetId(`tm:${nodePath(n, tmAncestors)}`); setSearchOpen(false); say(`FILES ▸ ${nodePath(n, tmAncestors)}`); } });
    }
    return out.slice(0, 9);
  }, [searchQuery, allMail, tmRoot]);

  const guideText = {
    home: "The bulletin board. Cards are the frames plus the operations stream. Type a card's label to target it, F opens it, Space picks it up and drops it somewhere else on the board.",
    files: "The Flat UI file navigator: the flare hierarchy as a 2D treemap, laid out by NCTGraphite's treemap module. F on a branch descends; F on a leaf inspects it. D climbs, Esc releases.",
    monitor: "Realtime horizon chart — demo-de's first Flat UI frame, hosted here. Keys 1–8 or a lane's label focus and magnify it; Space holds time.",
    sunburst: "The ZUI viewer on the 2D plane: the same hierarchy as FILES, as a sunburst. F descends a branch, D climbs, the centre goes back too.",
    mail: "Folders, list, reading. F opens; COMPOSE's fields are real text mode — while you type, keys are text and only Esc is monitored. SEND lands the message in Sent.",
  }[frame];

  const paramsFor = { monitor: monParams, sunburst: sbParams, files: fileParams }[frame];

  return (
    <div className="fl-page" onMouseMove={(e) => { mouseRef.current = { x: e.clientX, y: e.clientY }; }}>
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
        <button className="fl-keys-btn" onClick={() => setKeysOpen((v) => !v)}>KEYS · Alt+K</button>
      </header>

      <div className="fl-main">
        <aside className="fl-rail">
          <h3>NAVIGATOR</h3>
          {FRAMES.map((f) => (
            <button key={f.id} className={`fl-rail-btn ${frame === f.id ? "here" : ""}`} onClick={() => openFrame(f.id)}>
              <span className="fl-dot" style={{ background: f.color }} />
              <span>{f.name}<small>{f.sub}</small></span>
            </button>
          ))}
          <h3 style={{ marginTop: 18 }}>KEY-CLICKS · THIS SCOPE</h3>
          <div className="fl-keylist">
            {board.flat().filter((c) => c.binding).map((c) => (
              <div key={c.code} className="fl-keyrow"><b>{c.binding.name}</b><span>{c.binding.desc}</span></div>
            ))}
            <div className="fl-keyrow"><b>LABELS</b><span>Type a thing's letters to target it (D and F are operators, never addresses)</span></div>
          </div>
        </aside>

        <section className={`fl-stage ${textMode ? "texting" : ""}`}>
          <div className="fl-crumbs">
            {frame === "files" && tmAncestors(tmFocusNode).map((n, i, arr) => (
              <span key={i}><button onClick={() => { setTmFocus(n); setTargetId(null); }}>{n.name}</button>{i < arr.length - 1 ? " ▸ " : ""}</span>
            ))}
            {frame === "sunburst" && sbAncestors(sbFocusNode).map((n, i, arr) => (
              <span key={i}><button onClick={() => { setSbFocus(n); setTargetId(null); }}>{n.name}</button>{i < arr.length - 1 ? " ▸ " : ""}</span>
            ))}
            {frame === "mail" && <span>MAIL ▸ {FOLDERS.find((f) => f.id === mailFolder)?.name}{openMail ? ` ▸ ${openMail.subject}` : ""}{composeOpen ? " ▸ Compose" : ""}</span>}
            {frame === "monitor" && <span>MONITOR ▸ {laneFocus === null ? "all lanes" : monitor[laneFocus].lane.label}</span>}
            {frame === "home" && <span>HOME ▸ bulletin board{drag ? ` ▸ dragging ${drag.id}` : ""}</span>}
            <span className="fl-buffer">{buffer ? `key buffer: ${buffer}▸` : ""}</span>
          </div>

          {frame === "home" && (
            <div className="fl-board" ref={boardRef} onMouseMove={(e) => {
              if (!drag) return;
              const r = boardRef.current.getBoundingClientRect();
              const x = Math.max(0, Math.min(68, ((e.clientX - r.left) / r.width) * 100 - drag.dx));
              const y = Math.max(0, Math.min(58, ((e.clientY - r.top) / r.height) * 100 - drag.dy));
              setDrag({ ...drag, x, y });
            }}>
              {addressables.map((a) => {
                const cid = a.item.id.slice(5);
                const pos = drag && drag.id === cid ? { x: drag.x, y: drag.y } : cardPos[cid];
                const f = frameById(cid);
                return (
                  <div key={a.item.id} className={`fl-card ${stateCls(a.item.id)} ${drag && drag.id === cid ? "dragging" : ""}`}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, borderColor: drag && drag.id === cid ? "#ffa726" : undefined }} {...bind(a)}>
                    {chip(a.item.id)}
                    <h4 style={{ color: f ? f.color : "#ffa726" }}>{a.item.name}</h4>
                    <p>{a.item.desc}</p>
                    <small>{f ? f.sub : "live operations"} · F opens · Space drags</small>
                  </div>
                );
              })}
            </div>
          )}

          {frame === "files" && (
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
          )}

          {frame === "monitor" && (
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
          )}

          {frame === "sunburst" && (
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
          )}

          {frame === "mail" && (
            composeOpen ? (
              <div className="fl-compose">
                <label>To <input id="cmp-to" type="text" placeholder="name@example.com" /></label>
                <label>Subject <input id="cmp-subject" type="text" placeholder="Subject" /></label>
                <label>Message <textarea id="cmp-body" rows={9} placeholder="Write… (keys are text now; Esc leaves text mode)" /></label>
                <div className="fl-compose-actions">
                  {addressables.map((a) => (
                    <button key={a.item.id} className={`fl-act ${stateCls(a.item.id)}`} {...bind(a)}>{chip(a.item.id)} {a.item.name}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="fl-mail">
                <div className="fl-mail-folders">
                  {FOLDERS.map((fo) => {
                    const e = entry(`folder:${fo.id}`);
                    return e ? <button key={fo.id} className={`fl-folder ${mailFolder === fo.id ? "here" : ""} ${stateCls(e.item.id)}`} {...bind(e)}>{chip(e.item.id)} {fo.name} <small>{allMail.filter((m) => m.folder === fo.id).length}</small></button> : null;
                  })}
                  {entry("act:compose") && <button className={`fl-folder compose ${stateCls("act:compose")}`} {...bind(entry("act:compose"))}>{chip("act:compose")} ✉ COMPOSE</button>}
                </div>
                <div className="fl-mail-list">
                  {folderMail.map((m) => {
                    const e = entry(`mail:${m.id}`);
                    return e ? (
                      <div key={m.id} className={`fl-msg ${mailOpenId === m.id ? "open" : ""} ${stateCls(e.item.id)}`} {...bind(e)}>
                        {chip(e.item.id)}<h5>{m.subject}</h5><small>{m.from} · {m.when}</small><p>{m.body.slice(0, 72)}…</p>
                      </div>
                    ) : null;
                  })}
                  {folderMail.length === 0 && <p className="fl-empty">No messages in this folder yet.</p>}
                </div>
                <div className="fl-mail-read">
                  {openMail ? (<><h4>{openMail.subject}</h4><small>from {openMail.from} · {openMail.when}</small><p>{openMail.body}</p></>) : <p className="fl-empty">Open a message with F — or click it.</p>}
                </div>
              </div>
            )
          )}

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

        <aside className="fl-insp">
          <h3>INSPECT</h3>
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
          </div>
          {paramsFor && (
            <><h3 style={{ marginTop: 16 }}>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS[frame]} values={paramsFor.values} onChange={paramsFor.setValue} /></>
          )}
          <h3 style={{ marginTop: 16 }}>GUIDE</h3>
          <p className="fl-guide">{guideText}</p>
        </aside>
      </div>

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
        <span className="fl-foot-keys">F click · D back · Esc release · Tab next · / search · Alt+K keys</span>
      </footer>
    </div>
  );
}

const css = `
.fl-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; height:100vh; display:flex; flex-direction:column; margin:0; overflow:hidden; }
.fl-top { display:flex; align-items:center; gap:16px; padding:8px 16px; border-bottom:1px solid #2c3a41; background:#0e1418; flex:none; }
.fl-top strong { letter-spacing:3px; color:#e8f3ee; font-size:15px; }
.fl-top-frame { font-family:Consolas, monospace; font-size:11px; color:#ffa726; letter-spacing:1px; }
.fl-mode { font-family:Consolas, monospace; font-size:10.5px; padding:2px 8px; border:1px solid #2c3a41; border-radius:3px; color:#7fd4c1; }
.fl-mode.texting { color:#ffb74d; border-color:#ffb74d; }
.fl-nav { margin-left:auto; display:flex; gap:14px; }
.fl-nav a { color:#7fd4c1; font-size:12px; text-decoration:none; }
.fl-nav a:hover { color:#ffa726; }
.fl-keys-btn { background:#131b1f; color:#cfd8dc; border:1px solid #2c3a41; border-radius:4px; padding:4px 10px; font-family:Consolas, monospace; font-size:11px; cursor:pointer; }
.fl-keys-btn:hover { border-color:#ffa726; color:#ffa726; }
.fl-main { flex:1; display:grid; grid-template-columns:224px 1fr 296px; gap:12px; padding:12px; min-height:0; }
.fl-rail, .fl-insp { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:12px; overflow-y:auto; }
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
.fl-stage { position:relative; border:1px solid #2c3a41; border-radius:6px; background:#0e1418; display:flex; flex-direction:column; min-width:0; overflow:hidden; }
.fl-stage.texting { box-shadow: inset 0 0 0 2px rgba(255,183,77,.55); }
.fl-crumbs { display:flex; gap:6px; align-items:center; padding:8px 12px; border-bottom:1px solid #22303a; font-family:Consolas, monospace; font-size:11.5px; color:#a9f0dd; flex:none; flex-wrap:wrap; }
.fl-crumbs button { background:none; border:none; color:#a9f0dd; font:inherit; cursor:pointer; padding:0; }
.fl-crumbs button:hover { color:#ffa726; }
.fl-buffer { margin-left:auto; color:#ffa726; }
.fl-chip { display:inline-block; font-family:Consolas, monospace; font-size:9.5px; padding:0 4px; border-radius:3px; border:1px solid rgba(255,167,38,.65); background:rgba(6,12,14,.85); color:#ffa726; margin-right:6px; vertical-align:1px; }
.is-target { outline:2px solid #ffa726 !important; outline-offset:-2px; }
.is-hover { outline:1px solid #7fd4c1; outline-offset:-1px; }
.is-target.is-hover { outline:2px solid #ffa726; }
/* HOME board */
.fl-board { position:relative; flex:1; margin:10px; border:1px dashed #22303a; border-radius:6px; background:radial-gradient(circle at 30% 20%, rgba(127,212,193,.05), transparent 55%); }
.fl-card { position:absolute; width:30%; min-height:118px; border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; cursor:pointer; }
.fl-card:hover { background:#131b1f; }
.fl-card.dragging { opacity:.85; z-index:5; box-shadow:0 14px 30px rgba(0,0,0,.5); }
.fl-card h4 { margin:2px 0 6px; font-size:13px; letter-spacing:1.5px; }
.fl-card p { margin:0 0 6px; font-size:11.5px; color:#b7c6cc; line-height:1.5; }
.fl-card small { color:#8fa3ab; font-size:10.5px; }
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
.fl-sb { position:relative; margin:6px auto; aspect-ratio:1/1; width:min(96%, calc(100vh - 215px)); flex:none; }
.fl-sb-svg { width:100%; height:100%; display:block; }
.fl-sb-path { stroke:#0b0e10; stroke-width:1.5; cursor:pointer; opacity:.92; }
.fl-sb-path:hover { opacity:1; stroke:#ffa726; }
.fl-sb-centre { fill:#131b1f; stroke:#2c3a41; cursor:pointer; }
.fl-sb-chip { position:absolute; transform:translate(-50%,-50%); margin:0; pointer-events:none; }
.fl-sb-root { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:12px; letter-spacing:1px; color:#e8f3ee; pointer-events:none; max-width:130px; text-align:center; word-break:break-word; }
/* MAIL */
.fl-mail { flex:1; display:grid; grid-template-columns:170px 1fr 1.1fr; gap:10px; padding:10px; min-height:0; }
.fl-mail-folders { display:flex; flex-direction:column; gap:6px; }
.fl-folder { background:#10161a; border:1px solid #2c3a41; border-radius:5px; color:#cfd8dc; text-align:left; padding:8px 10px; cursor:pointer; font:inherit; font-size:12px; }
.fl-folder small { color:#8fa3ab; float:right; }
.fl-folder.here { border-color:#addb67; }
.fl-folder.compose { color:#addb67; }
.fl-mail-list { overflow-y:auto; display:flex; flex-direction:column; gap:6px; }
.fl-msg { border:1px solid #2c3a41; border-radius:5px; background:#10161a; padding:8px 10px; cursor:pointer; }
.fl-msg.open { border-color:#addb67; }
.fl-msg h5 { margin:0 0 2px; font-size:12.5px; color:#e8f3ee; display:inline; }
.fl-msg small { display:block; color:#8fa3ab; font-size:10.5px; margin-top:2px; }
.fl-msg p { margin:4px 0 0; font-size:11.5px; color:#b7c6cc; }
.fl-mail-read { border:1px solid #2c3a41; border-radius:5px; background:#10161a; padding:12px; overflow-y:auto; }
.fl-mail-read h4 { margin:0 0 4px; color:#e8f3ee; font-size:14px; }
.fl-mail-read small { color:#8fa3ab; }
.fl-mail-read p { line-height:1.65; font-size:12.5px; color:#cfd8dc; white-space:pre-wrap; }
.fl-empty { color:#8fa3ab; font-size:12px; }
.fl-compose { flex:1; display:flex; flex-direction:column; gap:10px; padding:14px; overflow-y:auto; }
.fl-compose label { display:flex; flex-direction:column; gap:4px; font-size:11px; letter-spacing:1.5px; color:#8fa3ab; }
.fl-compose input, .fl-compose textarea { background:#0a0f12; border:1px solid #2c3a41; border-radius:4px; color:#e8f3ee; padding:8px 10px; font:inherit; font-size:13px; letter-spacing:0; }
.fl-compose input:focus, .fl-compose textarea:focus { border-color:#ffb74d; outline:none; }
.fl-compose-actions { display:flex; gap:10px; }
.fl-act { background:#131b1f; border:1px solid #addb67; color:#addb67; border-radius:5px; padding:8px 16px; cursor:pointer; font:inherit; font-size:12px; letter-spacing:1px; }
/* SEARCH */
.fl-search { position:absolute; top:44px; left:50%; transform:translateX(-50%); width:min(560px, 92%); background:#10161a; border:1px solid #ffa726; border-radius:6px; padding:10px; z-index:20; box-shadow:0 18px 40px rgba(0,0,0,.55); display:flex; flex-direction:column; gap:6px; }
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
.fl-foot { flex:none; display:flex; align-items:center; gap:14px; padding:6px 16px; border-top:1px solid #2c3a41; background:#0e1418; font-family:Consolas, monospace; font-size:11px; }
.fl-foot-mode { color:#0b0e10; background:#7fd4c1; border-radius:3px; padding:1px 7px; font-weight:bold; }
.fl-echo { color:#a9f0dd; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fl-foot-keys { color:#8fa3ab; }
body { margin:0; }
`;
