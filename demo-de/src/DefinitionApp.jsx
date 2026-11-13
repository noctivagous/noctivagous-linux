import { useMemo, useRef, useState } from "react";
import PanelizationView from "./PanelizationView.jsx";
import {
  createDemoSheetSurface,
  createFlatSheetSurface,
} from "../NCTGraphite/packages/nctgraphite/src/panelization/NCTGraphiteNurbsSurface.ts";
import {
  makeDataTree,
  flattenTree,
  graftTree,
  simplifyTree,
  treeStats,
  formatDataPath,
} from "../NCTGraphite/packages/nctgraphite/src/datatree/NCTGraphiteDataTree.ts";

/**
 * The definition canvas — a Grasshopper-style definition for the
 * panelization, on its own page (definition.html); index.html is
 * untouched. Built to close the gaps named in
 * GRASSHOPPER-TAXONOMY-MAP.md, using the vendored resources:
 *
 *  - geometry as a wired value: the SHEET component evaluates its
 *    SURFACE/ARCH inputs into a NURBS surface *value* that travels
 *    on a wire into Panelization's SURFACE input;
 *  - Graph Mapper: the REACH wire passes through a drawn cubic
 *    function (drag its control points) before reaching the input;
 *  - MD pad: a 2D pad places the swarm's point attractor live;
 *  - data trees: the MESH output is a DataTree (one branch per
 *    panel row) and a TREE OP node (as-is / flatten / graft /
 *    simplify) reshapes it on the wire to the Panel readout;
 *  - a canvas that hosts the definition: drag any node by its
 *    title bar; click an output port, then an input port, to
 *    rewire; click a wired input port to unwire it (the input
 *    falls back to the component's default).
 *
 * Below the canvas, the same content is set again in traditional
 * print conventions — headline, standfirst, ruled columns on a
 * baseline rhythm, figure caption, marginalia — the print layer
 * that gives the futuristic environment its readability.
 */

const PARAMS = [
  { key: "surfaceKind", label: "SURFACE", kind: "select",
    options: [{ value: "arch", label: "Arch sheet" }, { value: "flat", label: "Flat sheet" }],
    fmt: (v) => (v === "arch" ? "Arch sheet" : "Flat sheet") },
  { key: "arch", label: "ARCH", kind: "slider", min: 0, max: 2, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: "udiv", label: "U DIV", kind: "slider", min: 20, max: 100, step: 2, fmt: (v) => String(v) },
  { key: "vdiv", label: "V DIV", kind: "slider", min: 6, max: 30, step: 1, fmt: (v) => String(v) },
  { key: "swarmCount", label: "SWARM", kind: "slider", min: 0, max: 80, step: 1, fmt: (v) => String(v) },
  { key: "reach", label: "REACH", kind: "slider", min: 4, max: 24, step: 1, fmt: (v) => String(v) },
  { key: "decay", label: "DECAY", kind: "slider", min: 0.8, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: "running", label: "RUN", kind: "toggle", fmt: (v) => (v ? "flowing" : "held") },
];
const paramByKey = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

/** Component inputs: key, label, default, display formatter. */
const INPUTS = [
  { key: "SURFACE", def: null },
  { key: "UDIV", def: 70 },
  { key: "VDIV", def: 20 },
  { key: "SWARM", def: 50 },
  { key: "REACH", def: 10 },
  { key: "DECAY", def: 0.95 },
  { key: "RUN", def: true },
  { key: "ATTRACT", def: null },
];

const DEFAULT_WIRING = {
  SURFACE: "sheet", UDIV: "udiv", VDIV: "vdiv", SWARM: "swarmCount",
  REACH: "mapper", DECAY: "decay", RUN: "running", ATTRACT: "pad",
};
const SOURCE_LABEL = { sheet: "SHEET", mapper: "MAPPER", pad: "PAD" };
const sourceLabel = (id) =>
  SOURCE_LABEL[id] ?? paramByKey[id]?.label ?? id;

/* Node geometry (widths/heights fixed; positions are state). */
const GEO = {
  param: { w: 196, h: 54 },
  sheet: { w: 212, h: 104 },
  mapper: { w: 212, h: 172 },
  pad: { w: 212, h: 186 },
  comp: { w: 254, header: 32, rowH: 26 },
  treeops: { w: 212, h: 54 },
  readout: { w: 254 },
  preview: { w: 254, h: 60 },
};
const compH = GEO.comp.header + INPUTS.length * GEO.comp.rowH + 8;

const DEFAULT_POS = {
  sheet: { x: 292, y: 36 },
  pad: { x: 292, y: 176 },
  mapper: { x: 292, y: 404 },
  comp: { x: 606, y: 52 },
  treeops: { x: 606, y: 392 },
  readout: { x: 958, y: 40 },
  preview: { x: 958, y: 348 },
};
PARAMS.forEach((p, i) => {
  DEFAULT_POS[`p_${p.key}`] = { x: 16, y: 14 + i * 66 };
});

/* Cubic bezier graph mapper: P0(0,0) P3(1,1), draggable P1/P2. */
function mapperEval(c1, c2, t) {
  const bx = (s) =>
    3 * (1 - s) ** 2 * s * c1.x + 3 * (1 - s) * s ** 2 * c2.x + s ** 3;
  const by = (s) =>
    3 * (1 - s) ** 2 * s * c1.y + 3 * (1 - s) * s ** 2 * c2.y + s ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bx(mid) < t) lo = mid; else hi = mid;
  }
  return by((lo + hi) / 2);
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function wirePath(x1, y1, x2, y2) {
  const dx = Math.max(34, Math.abs(x2 - x1) * 0.5);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

const css = `
.def-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.def-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.def-head h1 { font-size:17px; letter-spacing:2px; color:#e8f3ee; margin:0; }
.def-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.def-nav a.here { color:#ffa726; }
.def-sub { padding:0 20px 8px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.def-hint { margin:0 20px 8px; font-size:11.5px; color:#ffa726; letter-spacing:.4px; min-height:16px; }
.def-canvas { position:relative; margin:0 20px; height:660px; border:1px solid #2c3a41; border-radius:6px;
  background-color:#0d1216; background-image:radial-gradient(#22303a 1px, transparent 1px); background-size:22px 22px; overflow:hidden; }
.def-node { position:absolute; background:#161d21; border:1px solid #2c3a41; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,.45); user-select:none; }
.def-node .ttl { display:flex; justify-content:space-between; align-items:center; padding:5px 9px 3px; font-size:10.5px; letter-spacing:1.6px; color:#e8f3ee; cursor:grab; }
.def-node .ttl:active { cursor:grabbing; }
.def-tag { font-size:8.5px; letter-spacing:1px; padding:1px 5px; border-radius:3px; border:1px solid #45565e; color:#8fa3ab; }
.def-tag.live { border-color:#7fd4c1; color:#7fd4c1; }
.def-node .ctl { padding:2px 9px 7px; display:flex; align-items:center; gap:8px; }
.def-node .ctl input[type=range] { flex:1; accent-color:#ffa726; height:18px; }
.def-node .ctl select, .def-node select.wide { background:#0d1216; color:#cfd8dc; border:1px solid #2c3a41; border-radius:3px; font-size:12px; padding:2px; }
.def-node .val { font-family:Consolas, monospace; font-size:12px; color:#ffa726; min-width:38px; text-align:right; }
.def-port { position:absolute; width:9px; height:9px; border-radius:50%; border:2px solid #7fd4c1; background:#0b0e10; transform:translate(-50%,-50%); z-index:3; cursor:pointer; }
.def-port.out { border-color:#ffa726; background:#ffa726; }
.def-port.armed { background:#fff; border-color:#fff; box-shadow:0 0 0 4px rgba(255,167,38,.35); }
.def-port.unwired { border-color:#45565e; }
.def-comp .ttl { background:#1f2a30; border-bottom:1px solid #2c3a41; border-radius:6px 6px 0 0; padding:7px 10px; }
.def-comp .sub { font-size:9.5px; color:#8fa3ab; letter-spacing:1px; }
.def-row { display:flex; justify-content:space-between; align-items:center; padding:0 12px 0 16px; font-size:11px; letter-spacing:1px; color:#b8c7cc; position:relative; }
.def-row .rv { font-family:Consolas, monospace; font-size:11px; color:#7fd4c1; }
.def-row .rv.deflt { color:#5f737c; font-style:italic; }
.def-row .src { font-size:8.5px; color:#8fa3ab; letter-spacing:.6px; margin-left:6px; }
.def-readout .body { font-family:Consolas, monospace; font-size:11px; line-height:1.7; padding:6px 12px; color:#a9f0dd; white-space:pre; }
.def-view-wrap { margin:14px 20px 0; border:1px solid #2c3a41; border-radius:6px; overflow:hidden; }
.def-mapper-graph { display:block; margin:2px auto 0; }
.def-pad-box { margin:2px auto 0; display:block; cursor:crosshair; }
.def-foot { padding:4px 20px 10px; font-size:11.5px; color:#8fa3ab; line-height:1.6; max-width:940px; }
/* ——— the print layer: traditional print conventions ——— */
.print { margin:26px 20px 34px; border-top:3px double #45565e; padding-top:18px; color:#d7dee2;
  font-family:Georgia, 'Times New Roman', serif; }
.print .kicker { font-family:Tahoma, sans-serif; font-size:10.5px; letter-spacing:3px; color:#ffa726; text-transform:uppercase; }
.print h2 { font-size:30px; line-height:36px; margin:8px 0 6px; font-weight:normal; color:#eef4f1; max-width:700px; }
.print .standfirst { font-size:15px; line-height:24px; font-style:italic; color:#aebcc2; max-width:640px; margin:0 0 14px; }
.print .rule { border-top:1px solid #45565e; margin:0 0 16px; }
.print .cols-wrap { display:flex; gap:30px; align-items:flex-start; }
.print .cols { flex:1; column-count:3; column-gap:28px; column-rule:1px solid #2c3a41;
  font-size:13.5px; line-height:24px; text-align:justify; hyphens:auto; }
.print .cols p { margin:0 0 24px; }
.print .cols p:first-of-type::first-letter { font-size:52px; line-height:44px; float:left; padding:4px 8px 0 0; color:#ffa726; }
.print .cols h3 { font-size:12px; letter-spacing:2px; font-family:Tahoma, sans-serif; color:#7fd4c1; margin:0 0 6px; break-after:avoid; }
.print .margin { width:212px; flex:none; border-top:2px solid #ffa726; padding-top:8px;
  font-size:11.5px; line-height:18px; color:#8fa3ab; font-family:Tahoma, sans-serif; }
.print .margin p { margin:0 0 14px; }
.print .margin b { color:#cfd8dc; }
.figcap { margin:8px 20px 0; font-size:11.5px; line-height:17px; color:#8fa3ab; font-family:Tahoma, sans-serif; }
.figcap b { color:#cfd8dc; letter-spacing:1.5px; font-size:10.5px; }
`;

export default function DefinitionApp() {
  const [values, setValues] = useState({
    surfaceKind: "arch", arch: 1, udiv: 70, vdiv: 20,
    swarmCount: 50, reach: 10, decay: 0.95, running: true,
  });
  const [mapper, setMapper] = useState({ c1: { x: 0.25, y: 0.1 }, c2: { x: 0.6, y: 0.9 } });
  const [pad, setPad] = useState({ u: 0.25, v: 0.5 });
  const [treeOp, setTreeOp] = useState("asis");
  const [wiring, setWiring] = useState(DEFAULT_WIRING);
  const [armed, setArmed] = useState(null);
  const [pos, setPos] = useState(DEFAULT_POS);
  const [stats, setStats] = useState(null);
  const dragRef = useRef(null);
  const set = (key, value) => setValues((c) => ({ ...c, [key]: value }));

  /* ——— SHEET component: geometry as a value ——— */
  const sheetSurface = useMemo(
    () =>
      values.surfaceKind === "flat"
        ? createFlatSheetSurface()
        : createDemoSheetSurface(values.arch),
    [values.surfaceKind, values.arch],
  );
  const sheetDesc =
    values.surfaceKind === "flat"
      ? "flat sheet · bilinear"
      : `arch sheet · scale ${values.arch.toFixed(2)}`;

  /* ——— Graph Mapper on the REACH wire ——— */
  const reachNorm = (values.reach - 4) / 20;
  const mappedReach = Math.round((4 + mapperEval(mapper.c1, mapper.c2, reachNorm) * 20) * 10) / 10;

  /* ——— resolve component inputs through the wiring ——— */
  const resolve = (inputKey) => {
    const src = wiring[inputKey];
    if (!src) return { wired: false, value: INPUTS.find((i) => i.key === inputKey).def };
    if (src === "sheet") return { wired: true, src, value: sheetSurface };
    if (src === "mapper") return { wired: true, src, value: mappedReach };
    if (src === "pad") return { wired: true, src, value: pad };
    return { wired: true, src, value: values[src] };
  };
  const surfIn = resolve("SURFACE");
  const num = (key, def, lo, hi) => {
    const r = resolve(key);
    return r.wired && typeof r.value === "number" ? clamp(Math.round(r.value), lo, hi) : def;
  };
  const effConfig = {
    surface: surfIn.wired && typeof surfIn.value === "object" && surfIn.value !== null && "pointAt" in surfIn.value
      ? surfIn.value : sheetSurface,
    surfaceKey: `${values.surfaceKind}|${values.arch}`,
    udiv: num("UDIV", 70, 10, 120),
    vdiv: num("VDIV", 20, 4, 40),
    swarmCount: num("SWARM", 50, 0, 120),
    reach: (() => { const r = resolve("REACH"); return r.wired && typeof r.value === "number" ? clamp(r.value, 1, 40) : 10; })(),
    decay: (() => { const r = resolve("DECAY"); return r.wired && typeof r.value === "number" ? clamp(r.value, 0.5, 1) : 0.95; })(),
    running: (() => { const r = resolve("RUN"); return r.wired ? Boolean(r.value) : true; })(),
    attractor: (() => { const r = resolve("ATTRACT"); return r.wired && r.value && typeof r.value.u === "number" ? r.value : null; })(),
  };
  const inputDisplay = (inputKey) => {
    const r = resolve(inputKey);
    if (inputKey === "SURFACE") return r.wired && r.src === "sheet" ? sheetDesc : r.wired ? "surface" : "default sheet";
    if (inputKey === "ATTRACT") return r.wired && r.value ? `u ${r.value.u.toFixed(2)} v ${r.value.v.toFixed(2)}` : "—";
    if (inputKey === "RUN") return r.wired ? (r.value ? "flowing" : "held") : "flowing";
    if (typeof r.value === "number") return inputKey === "DECAY" ? r.value.toFixed(2) : String(Math.round(r.value * 10) / 10);
    if (typeof r.value === "boolean") return r.value ? "true" : "false";
    return "—";
  };

  /* ——— ports, from node positions ——— */
  const P = (id) => pos[id];
  const paramOut = (key) => ({ x: P(`p_${key}`).x + GEO.param.w, y: P(`p_${key}`).y + GEO.param.h / 2 });
  const sheetIn = (row) => ({ x: P("sheet").x, y: P("sheet").y + 34 + row * 24 + 9 });
  const sheetOut = () => ({ x: P("sheet").x + GEO.sheet.w, y: P("sheet").y + GEO.sheet.h / 2 });
  const mapperIn = () => ({ x: P("mapper").x, y: P("mapper").y + GEO.mapper.h / 2 });
  const mapperOut = () => ({ x: P("mapper").x + GEO.mapper.w, y: P("mapper").y + GEO.mapper.h / 2 });
  const padOut = () => ({ x: P("pad").x + GEO.pad.w, y: P("pad").y + GEO.pad.h / 2 });
  const compIn = (i) => ({ x: P("comp").x, y: P("comp").y + GEO.comp.header + i * GEO.comp.rowH + GEO.comp.rowH / 2 });
  const compOut = () => ({ x: P("comp").x + GEO.comp.w, y: P("comp").y + GEO.comp.header + (INPUTS.length * GEO.comp.rowH) / 2 });
  const treeIn = () => ({ x: P("treeops").x, y: P("treeops").y + GEO.treeops.h / 2 });
  const treeOut = () => ({ x: P("treeops").x + GEO.treeops.w, y: P("treeops").y + GEO.treeops.h / 2 });
  const readoutIn = () => ({ x: P("readout").x, y: P("readout").y + 40 });
  const previewIn = () => ({ x: P("preview").x, y: P("preview").y + 30 });
  const sourcePort = (src) =>
    src === "sheet" ? sheetOut() : src === "mapper" ? mapperOut() : src === "pad" ? padOut() : paramOut(src);

  /* ——— drag nodes by their title bars ——— */
  const startDrag = (id) => (e) => {
    if (e.target.closest("select,input,button")) return;
    const start = { id, dx: e.clientX - pos[id].x, dy: e.clientY - pos[id].y };
    dragRef.current = start;
    const move = (ev) =>
      setPos((cur) => ({ ...cur, [start.id]: { x: ev.clientX - start.dx, y: ev.clientY - start.dy } }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ——— click-to-wire ——— */
  const clickSource = (src) => () => setArmed((a) => (a === src ? null : src));
  const clickInput = (inputKey) => () => {
    if (armed) {
      setWiring((w) => ({ ...w, [inputKey]: armed }));
      setArmed(null);
    } else if (wiring[inputKey]) {
      setWiring((w) => ({ ...w, [inputKey]: null }));
    }
  };

  /* ——— the tree on the MESH wire, after the TREE OP ——— */
  let treeText = "TREE  …";
  if (stats?.tree) {
    const raw = makeDataTree(stats.tree.branches.map((b) => [b.path, b.values]));
    const t = treeOp === "flatten" ? flattenTree(raw) : treeOp === "graft" ? graftTree(raw) : treeOp === "simplify" ? simplifyTree(raw) : raw;
    const s = treeStats(t);
    const lines = t.branches.slice(0, 5).map((b) => {
      const mean = b.items.length ? b.items.reduce((a, x) => a + x, 0) / b.items.length : 0;
      return `      ${formatDataPath(b.path)} n=${b.items.length} mean ${mean.toFixed(2)}`;
    });
    treeText =
      `TREE  ${treeOp.toUpperCase()} — ${s.branches} branches · ${s.items} items\n` +
      lines.join("\n") + (s.branches > 5 ? `\n      … +${s.branches - 5} branches` : "");
  }
  const readout = stats
    ? `MESH  panels ${stats.panels} · verts ${stats.panels * 18}\n` +
      `      pushed ${stats.pushed} (${Math.round((stats.pushed / Math.max(1, stats.panels)) * 100)}%) · mean|dir| ${stats.meanDir.toFixed(2)}\n` +
      `      step ${stats.step}${effConfig.running ? "" : " · HELD"}\n${treeText}`
    : "MESH  …";

  const W = (a, b, color = "#7fd4c1", width = 1.6) => (
    <path d={wirePath(a.x, a.y, b.x, b.y)} fill="none" stroke={color} strokeWidth={width} opacity="0.8" />
  );

  return (
    <div className="def-page">
      <style>{css}</style>
      <div className="def-head">
        <h1>DEFINITION — PANELIZATION</h1>
        <nav className="def-nav">
          <a href="index.html">vanilla demo</a>
          <a href="react.html">react shell</a>
          <a href="definition.html" className="here">definition canvas</a>
          <a href="tangled.html">tangled tree 3d</a>
        </nav>
      </div>
      <p className="def-sub">
        A Grasshopper-style definition that closes the taxonomy map's gaps with the
        vendored resources: geometry travels as a value (SHEET), a drawn Graph Mapper
        reshapes the REACH wire, an MD pad places the swarm's attractor, the MESH
        output is a data tree reshaped by a TREE OP on its way to the Panel readout,
        and the canvas itself hosts the definition.
      </p>
      <p className="def-hint">
        {armed
          ? `Wiring from ${sourceLabel(armed)} — click a Panelization input port to connect it.`
          : "Drag title bars to move nodes · click an output port, then an input port, to rewire · click a wired input port to unwire it."}
      </p>

      <div className="def-canvas">
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {W(paramOut("surfaceKind"), sheetIn(0))}
          {W(paramOut("arch"), sheetIn(1))}
          {W(paramOut("reach"), mapperIn())}
          {INPUTS.map((inp, i) =>
            wiring[inp.key] ? (
              <g key={inp.key}>{W(sourcePort(wiring[inp.key]), compIn(i), inp.key === "SURFACE" ? "#b39df0" : "#7fd4c1")}</g>
            ) : null,
          )}
          {W(compOut(), treeIn(), "#ffa726", 1.8)}
          {W(treeOut(), readoutIn(), "#ffa726", 1.8)}
          {W(compOut(), previewIn(), "#ffa726", 1.8)}
        </svg>

        {PARAMS.map((p) => {
          const id = `p_${p.key}`;
          return (
            <div key={p.key} className="def-node" style={{ left: P(id).x, top: P(id).y, width: GEO.param.w, height: GEO.param.h }}>
              <div className="ttl" onPointerDown={startDrag(id)}>
                <span>{p.label}</span>
                <span className="def-tag">{p.key === "running" ? "DAM" : "PARAM"}</span>
              </div>
              <div className="ctl">
                {p.kind === "slider" && (
                  <>
                    <input type="range" min={p.min} max={p.max} step={p.step} value={values[p.key]}
                      aria-label={p.label} onChange={(e) => set(p.key, Number(e.target.value))} />
                    <span className="val">{p.fmt(values[p.key])}</span>
                  </>
                )}
                {p.kind === "select" && (
                  <select value={values[p.key]} aria-label={p.label} onChange={(e) => set(p.key, e.target.value)}>
                    {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {p.kind === "toggle" && (
                  <>
                    <input type="checkbox" checked={values[p.key]} aria-label={p.label}
                      onChange={(e) => set(p.key, e.target.checked)} />
                    <span className="val">{p.fmt(values[p.key])}</span>
                  </>
                )}
              </div>
              <span className={`def-port out ${armed === p.key ? "armed" : ""}`}
                style={{ left: GEO.param.w, top: GEO.param.h / 2 }} onClick={clickSource(p.key)} />
            </div>
          );
        })}

        {/* SHEET — geometry as a value */}
        <div className="def-node" style={{ left: P("sheet").x, top: P("sheet").y, width: GEO.sheet.w, height: GEO.sheet.h }}>
          <div className="ttl" onPointerDown={startDrag("sheet")}>
            <span>SHEET</span><span className="def-tag live">SURFACE VALUE</span>
          </div>
          {["SURFACE", "ARCH"].map((label, r) => (
            <div key={label} className="def-row" style={{ height: 24 }}>
              <span className="def-port" style={{ left: 0, top: 12 }} />
              <span>{label}</span>
              <span className="rv">{r === 0 ? paramByKey.surfaceKind.fmt(values.surfaceKind) : values.arch.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ padding: "2px 12px", fontSize: 10.5, color: "#8fa3ab" }}>→ {sheetDesc}</div>
          <span className={`def-port out ${armed === "sheet" ? "armed" : ""}`}
            style={{ left: GEO.sheet.w, top: GEO.sheet.h / 2, borderColor: "#b39df0", background: "#b39df0" }}
            onClick={clickSource("sheet")} />
        </div>

        {/* ATTRACTOR — MD pad */}
        <div className="def-node" style={{ left: P("pad").x, top: P("pad").y, width: GEO.pad.w, height: GEO.pad.h }}>
          <div className="ttl" onPointerDown={startDrag("pad")}>
            <span>ATTRACTOR</span><span className="def-tag live">MD PAD</span>
          </div>
          <svg className="def-pad-box" width="168" height="118"
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const upd = (ev) =>
                setPad({
                  u: clamp((ev.clientX - rect.left) / rect.width, 0.02, 0.98),
                  v: clamp(1 - (ev.clientY - rect.top) / rect.height, 0.02, 0.98),
                });
              upd(e);
              const move = (ev) => upd(ev);
              const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}>
            <rect x="0" y="0" width="168" height="118" fill="#0d1216" stroke="#2c3a41" />
            {[0.25, 0.5, 0.75].map((f) => (
              <g key={f} stroke="#22303a">
                <line x1={168 * f} y1="0" x2={168 * f} y2="118" />
                <line x1="0" y1={118 * f} x2="168" y2={118 * f} />
              </g>
            ))}
            <circle cx={pad.u * 168} cy={(1 - pad.v) * 118} r="6" fill="#ffa726" stroke="#0b0e10" strokeWidth="2" />
          </svg>
          <div style={{ padding: "3px 12px", fontSize: 11, fontFamily: "Consolas, monospace", color: "#7fd4c1" }}>
            u {pad.u.toFixed(2)} · v {pad.v.toFixed(2)}
          </div>
          <span className={`def-port out ${armed === "pad" ? "armed" : ""}`}
            style={{ left: GEO.pad.w, top: GEO.pad.h / 2 }} onClick={clickSource("pad")} />
        </div>

        {/* GRAPH MAPPER — drawn function on the REACH wire */}
        <div className="def-node" style={{ left: P("mapper").x, top: P("mapper").y, width: GEO.mapper.w, height: GEO.mapper.h }}>
          <div className="ttl" onPointerDown={startDrag("mapper")}>
            <span>GRAPH MAPPER</span><span className="def-tag live">ON REACH WIRE</span>
          </div>
          <svg className="def-mapper-graph" width="186" height="104">
            <rect x="0" y="0" width="186" height="104" fill="#0d1216" stroke="#2c3a41" />
            {[0.25, 0.5, 0.75].map((f) => (
              <g key={f} stroke="#22303a">
                <line x1={186 * f} y1="0" x2={186 * f} y2="104" />
                <line x1="0" y1={104 * f} x2="186" y2={104 * f} />
              </g>
            ))}
            <path d={Array.from({ length: 33 }, (_, i) => {
              const t = i / 32;
              return `${i === 0 ? "M" : "L"} ${(t * 186).toFixed(1)} ${((1 - mapperEval(mapper.c1, mapper.c2, t)) * 104).toFixed(1)}`;
            }).join(" ")} fill="none" stroke="#ffa726" strokeWidth="1.8" />
            <line x1="0" y1="104" x2={mapper.c1.x * 186} y2={(1 - mapper.c1.y) * 104} stroke="#45565e" strokeDasharray="3 3" />
            <line x1="186" y1="0" x2={mapper.c2.x * 186} y2={(1 - mapper.c2.y) * 104} stroke="#45565e" strokeDasharray="3 3" />
            {["c1", "c2"].map((k) => (
              <circle key={k} cx={mapper[k].x * 186} cy={(1 - mapper[k].y) * 104} r="7"
                fill="#161d21" stroke="#ffa726" strokeWidth="2" style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                  const move = (ev) =>
                    setMapper((m) => ({
                      ...m,
                      [k]: {
                        x: clamp((ev.clientX - rect.left) / rect.width, 0, 1),
                        y: clamp(1 - (ev.clientY - rect.top) / rect.height, 0, 1),
                      },
                    }));
                  const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }} />
            ))}
          </svg>
          <div style={{ padding: "3px 12px", fontSize: 11, fontFamily: "Consolas, monospace", color: "#7fd4c1" }}>
            reach {values.reach} → {mappedReach.toFixed(1)}
          </div>
          <span className="def-port" style={{ left: 0, top: GEO.mapper.h / 2 }} />
          <span className={`def-port out ${armed === "mapper" ? "armed" : ""}`}
            style={{ left: GEO.mapper.w, top: GEO.mapper.h / 2 }} onClick={clickSource("mapper")} />
        </div>

        {/* PANELIZATION component */}
        <div className="def-node def-comp" style={{ left: P("comp").x, top: P("comp").y, width: GEO.comp.w, height: compH }}>
          <div className="ttl" onPointerDown={startDrag("comp")}>
            <span>PANELIZATION</span><span className="sub">IGEO T59 · RELATION</span>
          </div>
          {INPUTS.map((inp, i) => {
            const r = resolve(inp.key);
            return (
              <div key={inp.key} className="def-row" style={{ height: GEO.comp.rowH }}>
                <span className={`def-port ${r.wired ? "" : "unwired"}`}
                  style={{ left: 0, top: GEO.comp.rowH / 2 }} onClick={clickInput(inp.key)} />
                <span>
                  {inp.key}
                  <span className="src">{r.wired ? `← ${sourceLabel(r.src)}` : "default"}</span>
                </span>
                <span className={`rv ${r.wired ? "" : "deflt"}`}>{inputDisplay(inp.key)}</span>
              </div>
            );
          })}
          <span className="def-port out" style={{ left: GEO.comp.w, top: GEO.comp.header + (INPUTS.length * GEO.comp.rowH) / 2 }} />
          <span style={{ position: "absolute", right: 12, top: GEO.comp.header + (INPUTS.length * GEO.comp.rowH) / 2 - 22, fontSize: 10, letterSpacing: 1.6, color: "#ffa726" }}>MESH</span>
        </div>

        {/* TREE OP on the MESH wire */}
        <div className="def-node" style={{ left: P("treeops").x, top: P("treeops").y, width: GEO.treeops.w, height: GEO.treeops.h }}>
          <div className="ttl" onPointerDown={startDrag("treeops")}>
            <span>TREE OP</span><span className="def-tag live">ON MESH WIRE</span>
          </div>
          <div className="ctl">
            <select className="wide" style={{ flex: 1 }} value={treeOp} aria-label="Tree operation"
              onChange={(e) => setTreeOp(e.target.value)}>
              <option value="asis">as-is — branch per row</option>
              <option value="flatten">flatten</option>
              <option value="graft">graft</option>
              <option value="simplify">simplify</option>
            </select>
          </div>
          <span className="def-port" style={{ left: 0, top: GEO.treeops.h / 2 }} />
          <span className="def-port out" style={{ left: GEO.treeops.w, top: GEO.treeops.h / 2 }} />
        </div>

        {/* PANEL readout */}
        <div className="def-node def-readout" style={{ left: P("readout").x, top: P("readout").y, width: GEO.readout.w }}>
          <div className="ttl" onPointerDown={startDrag("readout")}>
            <span>PANEL</span><span className="def-tag live">ON THE WIRE</span>
          </div>
          <div className="body">{readout}</div>
          <span className="def-port" style={{ left: 0, top: 40 }} />
        </div>

        {/* PREVIEW node */}
        <div className="def-node" style={{ left: P("preview").x, top: P("preview").y, width: GEO.preview.w, height: GEO.preview.h }}>
          <div className="ttl" onPointerDown={startDrag("preview")}>
            <span>PREVIEW</span><span className="def-tag">THREE.JS</span>
          </div>
          <div style={{ padding: "0 10px", fontSize: 11, color: "#8fa3ab" }}>renders the MESH wire, below ↓</div>
          <span className="def-port" style={{ left: 0, top: 30 }} />
        </div>
      </div>

      <div className="def-view-wrap">
        <PanelizationView config={effConfig} onStats={setStats} height={440} />
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — The panelization, live. A swarm of fifty boids skims the sheet,
        drawn to the attractor placed by the MD pad; panels within reach of a passing
        boid tilt and shift, and their colour answers. The definition above is the
        whole instrument: nothing here is operated from anywhere else.
      </p>

      {/* ——— the print layer ——— */}
      <section className="print">
        <div className="kicker">Demo-de · Computational design in the interface · Nº 1</div>
        <h2>A definition you can read like a page</h2>
        <p className="standfirst">
          The futuristic environment does not have to choose between the instrument
          panel and the printed page. Set the live machinery in columns, rule it,
          caption it — and it reads.
        </p>
        <div className="rule" />
        <div className="cols-wrap">
          <div className="cols">
            <h3>THE INSTRUMENT</h3>
            <p>
              What Grasshopper understood, and what the dense interfaces in the films
              only pretend to, is that a system becomes operable when its workings are
              laid out as objects: parameters that hold values, components that
              transform them, wires that carry the values where a reader can see them
              go. The definition above is deliberately small — eight parameters, one
              sheet, one mapper, one pad, one component — but nothing in it is a
              picture of a control. Every element is the control.
            </p>
            <h3>GEOMETRY AS A VALUE</h3>
            <p>
              In the first version of this page the surface was built inside the
              component, the way a tutorial does it. That is the habit the taxonomy
              map flagged: geometry passed by construction is geometry nobody can
              rewire. Here the SHEET component evaluates its two inputs into a NURBS
              surface and puts that surface on a wire, coloured violet because it is
              not a number. Panelization's first input receives it the way it
              receives a slider's number — as a value, from somewhere, replaceable.
            </p>
            <h3>TREES, NOT LISTS</h3>
            <p>
              Six hundred and sixty-five panels are not a list; they are ten rows of
              panels, and the difference matters the moment a downstream component
              wants to act per-row. The MESH output therefore travels as a data
              tree — one branch per row, addressed by path — and the TREE OP node
              demonstrates the three classic reshapings on the live values: flatten
              it to a single branch, graft it until every panel has a branch of its
              own, simplify away the path depth nobody needs. The Panel readout
              shows the tree's shape, not just its totals.
            </p>
            <h3>WHY PRINT</h3>
            <p>
              The films get their authority from print. The dense screens in
              Evangelion are believable because they are composed like documents —
              columns, rules, captions, marginal notes, everything on a grid —
              before they are animated. This page takes the hint literally: the
              machinery above is futuristic, and this text is set in the
              conventions of a journal — a headline, a standfirst, three ruled
              columns on a twenty-four-unit rhythm, a figure caption, marginalia in
              the rail. The two registers are not decoration on each other. Print
              is how the environment explains itself; the definition is how it
              runs.
            </p>
          </div>
          <aside className="margin">
            <p><b>Marginalia.</b> Notes live in the rail, as they have since the
              glossed manuscripts — commentary beside the text, never in its way.</p>
            <p><b>Key-click.</b> Every element on the canvas is discrete and
              labelled, so the whole definition is operable from the keyboard —
              the bimodal foundation this project is built on.</p>
            <p><b>Sources.</b> iGeo tutorial 59 for the algorithm; Grasshopper for
              the element taxonomy; NCTGraphite's print recipe for this page's
              grid, columns and baseline.</p>
            <p><b>Status.</b> Exploration page. What proves out here gets promoted
              into the main file; index.html remains untouched meanwhile.</p>
          </aside>
        </div>
      </section>

      <p className="def-foot">
        Taxonomy rows exercised (GRASSHOPPER-TAXONOMY-MAP.md): sliders / toggle /
        value list, component + typed ports, wires as data, solve-on-change,
        geometry as a wired value, graph mapper, MD pad, data trees with graft /
        flatten / simplify, the panel-on-a-wire readout, a draggable canvas with
        click-to-wire, and preview — with the print layer alongside.
      </p>
    </div>
  );
}
