import { useEffect, useRef, useState } from "react";
import {
  NCTParameterPanel,
  useNCTParameters,
} from "../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";
import IgeoLiveView, { FORMS, SURFACES } from "./IgeoLiveView.jsx";

/**
 * IGEO LIVE PANEL — a standalone demo-de page.
 *
 * One live panel: the iGeo tutorial 59 agent-based panelization
 * (ported to TypeScript in the vendored NCTGraphite) running full
 * viewport. A swarm of boids skims a NURBS sheet; every hexagonal
 * panel accumulates the pushes of the flock passing over it and
 * rebuilds its form from them, so the skin is a living map of the
 * flow. The panel form, the surface, and the swarm's attractors are
 * all operated by key-clicks — F is the click.
 *
 * Layout follows the environment's overlay convention: the scene
 * fills the window and never scrolls; parameters, readout, form and
 * surface strips, the first-moves strip and the guide are
 * stationary panels over it.
 */

const PARAM_DEFS = [
  { id: "swarmCount", label: "Swarm count", type: "number", min: 10, max: 120, step: 5, defaultValue: 50 },
  { id: "cohesion", label: "Cohesion", type: "number", min: 0, max: 30, step: 1, defaultValue: 10 },
  { id: "separation", label: "Separation", type: "number", min: 0, max: 30, step: 1, defaultValue: 10 },
  { id: "reach", label: "Panel reach", type: "number", min: 4, max: 24, step: 1, defaultValue: 10 },
  { id: "decay", label: "Panel memory (decay)", type: "number", min: 0.8, max: 1, step: 0.01, defaultValue: 0.95 },
  { id: "speed", label: "Swarm speed", type: "number", min: 0.25, max: 3, step: 0.25, defaultValue: 1 },
  { id: "depth", label: "Response depth", type: "number", min: 0.2, max: 2.5, step: 0.1, defaultValue: 1 },
  {
    id: "density", label: "Panel density", type: "select", defaultValue: "standard",
    options: [
      { value: "coarse", label: "Coarse · 42×12" },
      { value: "standard", label: "Standard · 70×20" },
      { value: "dense", label: "Dense · 98×28" },
    ],
  },
  { id: "showBoids", label: "Boids", type: "boolean", defaultValue: true },
  { id: "showAttractors", label: "Attractor markers", type: "boolean", defaultValue: true },
  { id: "showBase", label: "Base surface", type: "boolean", defaultValue: true },
  { id: "wireframe", label: "Wireframe", type: "boolean", defaultValue: false },
  { id: "drift", label: "Camera drift", type: "boolean", defaultValue: true },
];

const css = `
html, body { margin:0; padding:0; background:#04080a; }
.il-page { position:fixed; inset:0; overflow:hidden; background:#04080a; color:#cfd8dc;
  font-family:Tahoma, Verdana, sans-serif; }
.il-stage { position:absolute; inset:0; }
.il-stage canvas { display:block; }
.il-panel { position:absolute; background:rgba(7,13,16,.88); border:1px solid #2c3a41; border-radius:6px;
  padding:10px 12px; backdrop-filter:blur(3px); z-index:5; }
.il-panel h3 { margin:0 0 8px; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600;
  font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:#e8f3ee; }
.il-title { top:14px; left:14px; padding:9px 14px 10px; pointer-events:none; }
.il-title h1 { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:20px;
  letter-spacing:.1em; text-transform:uppercase; color:#e8f3ee; margin:0; }
.il-title .sub { font-family:'IBM Plex Mono',Consolas,monospace; font-size:10px; color:#8fa3ab; margin-top:3px; }
.il-title nav { margin-top:6px; pointer-events:auto; }
.il-title nav a { color:#7fd4c1; font-size:11px; margin-right:12px; text-decoration:none; }
.il-title nav a:hover { color:#ffa726; }
.il-strips { position:absolute; top:14px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; gap:6px;
  align-items:center; pointer-events:none; z-index:5; }
.il-strip { display:flex; gap:5px; pointer-events:auto; }
.il-strip .lab { font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600; font-size:11px;
  letter-spacing:.14em; color:#8fa3ab; align-self:center; margin-right:2px; }
.il-chip { font-family:'IBM Plex Mono',Consolas,monospace; font-size:10.5px; letter-spacing:.4px;
  padding:4px 8px; border-radius:4px; border:1px solid rgba(127,212,193,.4);
  background:rgba(6,12,14,.85); color:#a9f0dd; cursor:pointer; }
.il-chip b { color:#ffa726; font-weight:600; margin-right:5px; }
.il-chip:hover { border-color:#ffa726; color:#e8f3ee; }
.il-chip.on { background:#ffa726; border-color:#ffa726; color:#0b0e10; }
.il-chip.on b { color:#0b0e10; }
.il-params { top:14px; right:14px; width:264px; max-height:calc(100vh - 28px); overflow-y:auto; }
.il-params .head { display:flex; justify-content:space-between; align-items:baseline; }
.il-mini { position:absolute; top:14px; right:14px; z-index:5; }
.il-readout { left:14px; bottom:44px; min-width:252px; pointer-events:none; }
.il-readout .rows { font-family:'IBM Plex Mono',Consolas,monospace; font-size:11px; line-height:1.8; color:#a9f0dd; white-space:pre; }
.il-readout .k { color:#ffa726; }
.il-readout .notice { color:#ffd9a0; min-height:15px; }
.il-moves { bottom:10px; left:50%; transform:translateX(-50%); display:flex; gap:5px; align-items:center;
  padding:6px 10px; pointer-events:none; white-space:nowrap; }
.il-moves .mv { font-family:'IBM Plex Mono',Consolas,monospace; font-size:10.5px; color:#8fa3ab; }
.il-moves .mv b { color:#ffa726; font-weight:600; }
.il-guidebtn { position:absolute; left:14px; top:118px; z-index:5; }
.il-guide { left:14px; top:152px; width:348px; max-height:calc(100vh - 260px); overflow-y:auto; z-index:6; }
.il-guide p, .il-guide li { font-size:12px; line-height:1.65; color:#b8c7cc; }
.il-guide p { margin:0 0 9px; }
.il-guide ul { margin:0 0 9px; padding-left:16px; }
.il-guide b { color:#ffa726; font-weight:600; }
.il-guide .kh { font-family:'IBM Plex Mono',Consolas,monospace; font-size:11px; line-height:1.9; color:#a9f0dd; white-space:pre-wrap; }
.il-guide h4 { margin:12px 0 5px; font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:600;
  font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:#7fd4c1; }
.il-guide h4:first-child { margin-top:0; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:104px; }
.nct-parameter output { font-family:'IBM Plex Mono',Consolas,monospace; color:#ffa726; min-width:32px; text-align:right; }
.nct-parameter select { background:#0b0e10; color:#ffa726; border:1px solid #2c3a41;
  font-family:'IBM Plex Mono',Consolas,monospace; font-size:11px; }
.il-fold { background:none; border:none; color:#7fd4c1; font-family:'IBM Plex Mono',Consolas,monospace;
  font-size:11px; cursor:pointer; padding:0; }
.il-fold:hover { color:#ffa726; }
@media (max-width: 1100px) { .il-guide { width:300px; } .il-params { width:236px; } }
`;

const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(d));

export default function IgeoLiveApp() {
  const { values, setValue } = useNCTParameters(PARAM_DEFS);
  const [form, setForm] = useState("funnel");
  const [surface, setSurface] = useState("arch");
  const [running, setRunning] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [cursor, setCursor] = useState({ u: 0.5, v: 0.5 });
  const [paramsOpen, setParamsOpen] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [stats, setStats] = useState(null);
  const [notice, setNotice] = useState("");

  const apiRef = useRef(null);
  const liveRef = useRef({});
  liveRef.current = {
    reach: Number(values.reach),
    decay: Number(values.decay),
    speed: Number(values.speed),
    cohesion: Number(values.cohesion),
    separation: Number(values.separation),
    depth: Number(values.depth),
    running,
    form,
    showBoids: Boolean(values.showBoids),
    showAttractors: Boolean(values.showAttractors),
    showBase: Boolean(values.showBase),
    wireframe: Boolean(values.wireframe),
    drift: Boolean(values.drift),
    zoom,
    cursor,
    onCanvasClick: (r) =>
      setNotice(r === "added" ? "ATTRACTOR PLACED (CLICK)" : "ATTRACTOR REMOVED (CLICK)"),
  };

  const structural = {
    surfaceId: surface,
    density: String(values.density),
    swarmCount: Number(values.swarmCount),
  };

  const clickSurface = () => {
    const api = apiRef.current;
    if (!api) return;
    const addr = api.getAddressedUV();
    const r = api.clickAtUV(addr.u, addr.v);
    if (r === "added") setNotice(`ATTRACTOR PLACED · U ${fmt(addr.u)} V ${fmt(addr.v)} · ${addr.source}`);
    else if (r === "removed") setNotice(`ATTRACTOR REMOVED · U ${fmt(addr.u)} V ${fmt(addr.v)} · ${addr.source}`);
  };

  const stepBack = () => {
    const api = apiRef.current;
    if (!api) return;
    const r = api.stepBack();
    if (r === "removed") setNotice("ATTRACTOR REMOVED · LAST PLACED");
    else if (r === "relaxed") setNotice("FIELD RESET · PANEL MEMORY CLEARED");
  };

  useEffect(() => {
    const onKey = (e) => {
      // Only genuinely text-entering controls keep their keys — a
      // slider, checkbox or select holding focus must not swallow
      // the key-clicks (the lab's standing rule). This page has no
      // text inputs at all.
      const el = e.target;
      const tag = (el?.tagName || "").toLowerCase();
      const type = (el?.type || "").toLowerCase();
      const textLike =
        tag === "textarea" ||
        Boolean(el?.isContentEditable) ||
        (tag === "input" &&
          ["text", "search", "password", "email", "url", "number"].includes(type));
      if (textLike || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === " ") {
        e.preventDefault();
        setRunning((r) => !r);
        return;
      }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); clickSurface(); return; }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); stepBack(); return; }
      if (e.key === "1") { e.preventDefault(); setZoom((z) => Math.min(2.2, z * 1.18)); return; }
      if (e.key === "2") { e.preventDefault(); setZoom((z) => Math.max(0.5, z / 1.18)); return; }
      const formHit = FORMS.find((f) => f.key === e.key);
      if (formHit) { e.preventDefault(); setForm(formHit.id); return; }
      if (e.key === ",") {
        e.preventDefault();
        setValue("speed", Math.max(0.25, Number(values.speed) - 0.25));
        return;
      }
      if (e.key === ".") {
        e.preventDefault();
        setValue("speed", Math.min(3, Number(values.speed) + 0.25));
        return;
      }
      if (e.key === "h" || e.key === "H") { e.preventDefault(); setGuideOpen((g) => !g); return; }
      if (e.key === "p" || e.key === "P") { e.preventDefault(); setParamsOpen((p) => !p); return; }
      if (e.key === "Escape") { setGuideOpen(false); return; }
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        apiRef.current?.useCursor();
        const step = e.shiftKey ? 0.012 : 0.05;
        setCursor((c) => {
          const next = { ...c };
          if (e.key === "ArrowLeft") next.u -= step;
          if (e.key === "ArrowRight") next.u += step;
          if (e.key === "ArrowUp") next.v -= step;
          if (e.key === "ArrowDown") next.v += step;
          next.u = Math.min(0.98, Math.max(0.02, next.u));
          next.v = Math.min(0.98, Math.max(0.02, next.v));
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.speed]);

  const blur = (e) => e.currentTarget.blur();
  const formName = FORMS.find((f) => f.id === form)?.name || form;
  const surfaceName = SURFACES.find((s) => s.id === surface)?.name || surface;
  const addr = stats?.addressed;

  return (
    <div className="il-page">
      <style>{css}</style>
      <IgeoLiveView
        liveRef={liveRef}
        structural={structural}
        apiRef={apiRef}
        onStats={setStats}
      />

      <div className="il-panel il-title">
        <h1>Demo-de · iGeo Live Panel</h1>
        <div className="sub">AGENT-BASED PANELIZATION · IGEO TUTORIAL 59, IN TYPESCRIPT</div>
        <nav>
          <a href="./react.html">react shell</a>
          <a href="./treemap.html">treemap</a>
          <a href="./ui-space/">ui space</a>
          <a href="./definition.html">definition</a>
        </nav>
      </div>

      <div className="il-strips">
        <div className="il-strip" role="group" aria-label="Panel forms">
          <span className="lab">FORM</span>
          {FORMS.map((f) => (
            <button
              key={f.id}
              className={`il-chip${form === f.id ? " on" : ""}`}
              onClick={(e) => { setForm(f.id); blur(e); }}
            >
              <b>{f.key}</b>{f.name}
            </button>
          ))}
        </div>
        <div className="il-strip" role="group" aria-label="Surfaces">
          <span className="lab">SURFACE</span>
          {SURFACES.map((s) => (
            <button
              key={s.id}
              className={`il-chip${surface === s.id ? " on" : ""}`}
              onClick={(e) => { setSurface(s.id); blur(e); }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {paramsOpen ? (
        <div className="il-panel il-params">
          <div className="head">
            <h3>Parameters</h3>
            <button className="il-fold" onClick={(e) => { setParamsOpen(false); blur(e); }}>fold · P</button>
          </div>
          <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={setValue} />
        </div>
      ) : (
        <button className="il-chip il-mini" onClick={(e) => { setParamsOpen(true); blur(e); }}>
          PARAMETERS · P
        </button>
      )}

      <button
        className="il-chip il-guidebtn"
        onClick={(e) => { setGuideOpen((g) => !g); blur(e); }}
      >
        GUIDE · H
      </button>
      {guideOpen && (
        <div className="il-panel il-guide">
          <h4>The demo</h4>
          <p>
            A NURBS sheet skinned with hexagonal panels. A flock of boids — iGeo's
            Swarm, cohesion and separation at the source's own ratios — skims the
            sheet, drawn by gaussian point attractors. Every boid that passes
            within reach pushes its panel; each panel accumulates the pushes in a
            direction vector and rebuilds its form from it. The skin is therefore
            a living map of the flow: where the flock has been, and how hard it
            pushed. Panel memory (decay &lt; 1) lets pushed panels relax, so the
            field keeps rewriting itself instead of saturating.
          </p>
          <h4>Key-clicks</h4>
          <div className="kh">{
            "F        click the addressed point:\n" +
            "         place an attractor there —\n" +
            "         F again on one removes it\n" +
            "D        step back: remove the last\n" +
            "         placed attractor, else\n" +
            "         reset the panel field\n" +
            "← → ↑ ↓  move the keyboard cursor\n" +
            "         over the sheet (Shift: fine)\n" +
            "SPACE    pause / resume the swarm\n" +
            "1 / 2    zoom out / in\n" +
            "3 – 7    panel forms\n" +
            ", / .    swarm speed down / up\n" +
            "H        this guide · P parameters\n" +
            "ESC      close the guide"
          }</div>
          <p>
            Addressing is bimodal: the pointer hovering the sheet addresses the
            point under it (pale ring); otherwise the teal keyboard cursor
            addresses its point. An arrow key hands addressing back to the
            cursor. A mouse click on the sheet does what F does, as a secondary
            path — F is the click of the system.
          </p>
          <h4>Forms — one data, five skins</h4>
          <ul>
            <li><b>3 FUNNEL</b> — the tutorial's native loft: three rings, the inner ring shifted by the push.</li>
            <li><b>4 FLAT TILE</b> — planar hexagons; the answer is carried by color and a slight lift only.</li>
            <li><b>5 PETAL FOLD</b> — the downstream half folds up around a hinge set by the push direction.</li>
            <li><b>6 SPIKE</b> — the centre rises into a low pyramid by accumulated energy.</li>
            <li><b>7 APERTURE</b> — an iris: the inner opening widens with traffic over the panel.</li>
          </ul>
          <p>
            Color is the tutorial's encoding — the push's u/v components as
            red/green over a blue base — and brightness rises with push
            strength, identically in every form. Response depth scales iGeo's
            own dirScale, so one knob drives all five forms.
          </p>
          <h4>Surfaces</h4>
          <p>
            ARCH and VAULT are the library's demo sheet at two arch heights;
            FLAT SHEET is its degree-1 plane; WAVE is a control net through the
            library's own NURBS class. Switching surface re-solves the whole
            simulation on it — placed attractors are kept, re-seated on the new
            sheet.
          </p>
          <h4>What it shows of iGeo</h4>
          <ul>
            <li>Agents as geometry: panels and boids are both agents; form is behaviour accumulated over time.</li>
            <li>Fields: a surface attractor field holds the flock to the sheet; point attractors bend it.</li>
            <li>Parametric skin: one simulation, many panel forms — the Grasshopper bargain, live.</li>
          </ul>
        </div>
      )}

      <div className="il-panel il-readout">
        <h3>Readout</h3>
        <div className="rows">
          <div><span className="k">FORM</span> {formName} · <span className="k">SURFACE</span> {surfaceName}</div>
          <div><span className="k">STEP</span> {stats ? stats.step.toLocaleString("en-US") : "—"} · <span className="k">PANELS</span> {stats?.panels ?? "—"}</div>
          <div><span className="k">BOIDS</span> {stats?.boids ?? "—"} · <span className="k">MEAN SPEED</span> {stats ? fmt(stats.meanSpeed, 1) : "—"}</div>
          <div><span className="k">ATTRACTORS</span> {stats?.attractors ?? "—"} · <span className="k">PLACED</span> {stats?.placed ?? "—"}</div>
          <div><span className="k">FIELD ENERGY |DIR|</span> {stats ? fmt(stats.energy, 3) : "—"}</div>
          <div><span className="k">ADDRESSED</span> {addr ? `U ${fmt(addr.u)} V ${fmt(addr.v)} · ${addr.source}` : "—"}</div>
          <div><span className="k">STATE</span> {running ? "RUNNING" : "PAUSED"} · <span className="k">ZOOM</span> ×{fmt(1 / zoom, 2)}</div>
          <div className="notice">{notice}</div>
        </div>
      </div>

      <div className="il-panel il-moves">
        <span className="mv"><b>F</b> place attractor</span>
        <span className="mv"><b>←→↑↓</b> cursor</span>
        <span className="mv"><b>SPACE</b> pause</span>
        <span className="mv"><b>1·2</b> zoom</span>
        <span className="mv"><b>3–7</b> forms</span>
        <span className="mv"><b>D</b> step back</span>
        <span className="mv"><b>H</b> guide</span>
      </div>
    </div>
  );
}
