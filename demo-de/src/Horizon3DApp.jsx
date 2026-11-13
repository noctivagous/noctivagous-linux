import { useEffect, useRef, useState } from "react";
import Horizon3DView from "./Horizon3DView.jsx";
import {
  ACTIVITY_LANES,
  createMonitor,
} from "../NCTGraphite/packages/nctgraphite/src/horizon/NCTGraphiteHorizon.ts";
import {
  NCTParameterPanel,
  useNCTParameters,
} from "../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";

/**
 * Realtime horizon chart, in 3D — horizon3d.html.
 *
 * The activity monitor of horizon.html lifted into space, in the
 * terms of d3-js-uses.txt's 3D Spatial frame: the lanes become
 * terraced skylines running away from the viewer, time flowing
 * toward you, each fold of the horizon chart standing as a physical
 * terrace in the band's own colour. Whether such an instrument
 * should be seen in perspective or isometrically is left as a
 * parameter — perspective distorts with depth but gives presence;
 * the isometric camera compares magnitudes undistorted across the
 * whole tape. Operation is the monitor's own, unchanged: 1–8 / A–H
 * focus a lane and the camera travels to it, Space halts time,
 * Esc releases.
 */

const SAMPLES = 480;

const PARAM_DEFS = [
  { id: "bands", label: "Bands", type: "number", min: 1, max: 7, step: 1, defaultValue: 4 },
  { id: "bandHeight", label: "Relief per band", type: "number", min: 3, max: 14, step: 1, defaultValue: 8 },
  {
    id: "period", label: "Tick", type: "select", defaultValue: "250",
    options: [
      { value: "100", label: "100 ms" },
      { value: "250", label: "250 ms" },
      { value: "500", label: "500 ms" },
      { value: "1000", label: "1 s" },
    ],
  },
  {
    id: "projection", label: "Projection", type: "select", defaultValue: "perspective",
    options: [
      { value: "perspective", label: "Perspective" },
      { value: "iso", label: "Isometric" },
    ],
  },
  { id: "running", label: "Running", type: "boolean", defaultValue: true },
  { id: "labelsOn", label: "Lane labels", type: "boolean", defaultValue: true },
  { id: "drift", label: "Camera drift", type: "boolean", defaultValue: true },
];

const keyLabel = (i) => String.fromCharCode(65 + i);

function laneState(s) {
  const { mean } = s.stats();
  const v = s.current;
  if (v > 0.85) return "SATURATED";
  if (v > mean + 0.22) return "SURGING";
  if (v < 0.06) return "IDLE";
  return "STEADY";
}

const css = `
.h3-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.h3-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.h3-head h1 { font-size:17px; letter-spacing:2px; color:#e8f3ee; margin:0; }
.h3-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.h3-nav a.here { color:#ffa726; }
.h3-sub { padding:0 20px 10px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.h3-main { display:flex; gap:14px; margin:0 20px; align-items:stretch; }
.h3-stage { flex:1; border:1px solid #2c3a41; border-radius:6px; overflow:hidden; min-width:0; height:560px; }
.h3-rail { width:296px; flex:none; display:flex; flex-direction:column; gap:14px; }
.h3-box { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; }
.h3-box h3 { margin:0 0 8px; font-size:10.5px; letter-spacing:2px; color:#e8f3ee; font-weight:bold; }
.h3-readout { font-family:Consolas, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; white-space:pre-wrap; word-break:break-word; }
.h3-readout .k { color:#ffa726; }
.h3-keyline { font-family:Consolas, monospace; font-size:11.5px; color:#8fa3ab; line-height:1.7; }
.h3-keyline b { color:#ffa726; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:118px; }
.nct-parameter output { font-family:Consolas, monospace; color:#ffa726; min-width:30px; text-align:right; }
.nct-parameter select { background:#0b0e10; color:#ffa726; border:1px solid #2c3a41; font-family:Consolas, monospace; font-size:11px; }
.h3-label { position:absolute; left:0; top:0; text-align:center; pointer-events:none; will-change:transform; }
.h3-chip { pointer-events:auto; font-family:Consolas, monospace; font-size:9.5px; letter-spacing:.5px; padding:1px 4px;
  border-radius:3px; border:1px solid rgba(255,167,38,.65); background:rgba(6,12,14,.82); color:#ffa726; cursor:pointer; }
.h3-chip:hover { background:#ffa726; color:#0b0e10; }
.h3-label.focus .h3-chip { background:#ffa726; color:#0b0e10; font-weight:bold; }
.h3-name { font-size:9.5px; letter-spacing:1.5px; color:#cfd8dc; margin-top:3px; text-shadow:0 1px 5px #000; }
.h3-val { font-family:Consolas, monospace; font-size:11px; color:#a9f0dd; text-shadow:0 1px 5px #000; }
.figcap { margin:8px 20px 0; font-size:11.5px; line-height:17px; color:#8fa3ab; }
.figcap b { color:#cfd8dc; letter-spacing:1.5px; font-size:10.5px; }
.print { margin:24px 20px 34px; border-top:3px double #45565e; padding-top:18px; color:#d7dee2; font-family:Georgia, 'Times New Roman', serif; }
.print .kicker { font-family:Tahoma, sans-serif; font-size:10.5px; letter-spacing:3px; color:#ffa726; text-transform:uppercase; }
.print h2 { font-size:28px; line-height:34px; margin:8px 0 6px; font-weight:normal; color:#eef4f1; }
.print .standfirst { font-size:15px; line-height:24px; font-style:italic; color:#aebcc2; max-width:620px; margin:0 0 14px; }
.print .rule { border-top:1px solid #45565e; margin:0 0 16px; }
.print .cols { column-count:3; column-gap:28px; column-rule:1px solid #2c3a41; font-size:13.5px; line-height:24px; text-align:justify; }
.print .cols p { margin:0 0 24px; }
.print .cols h3 { font-size:12px; letter-spacing:2px; font-family:Tahoma, sans-serif; color:#7fd4c1; margin:0 0 6px; break-after:avoid; }
.print .index { margin-top:6px; }
.print .index h3 { font-size:12px; letter-spacing:2px; font-family:Tahoma, sans-serif; color:#7fd4c1; margin:0 0 10px; }
.print .lane-row { font-size:12.5px; line-height:23px; }
.print .lane-row button { background:none; border:none; color:#cfd8dc; font:inherit; cursor:pointer; padding:0; }
.print .lane-row button:hover { color:#ffa726; text-decoration:underline; }
.print .lane-row .pk { font-family:Consolas, monospace; font-size:10px; color:#7fd4c1; }
.print .lane-row .meta { font-family:Consolas, monospace; font-size:10.5px; color:#8fa3ab; }
`;

export default function Horizon3DApp() {
  const monitorRef = useRef(null);
  if (!monitorRef.current) {
    monitorRef.current = createMonitor(ACTIVITY_LANES, SAMPLES, 20261113);
  }
  const monitor = monitorRef.current;
  const { values, setValue } = useNCTParameters(PARAM_DEFS);
  const [tickCount, setTickCount] = useState(0);
  const [focusId, setFocusId] = useState(null);

  const bands = Number(values.bands);
  const bandHeight = Number(values.bandHeight);
  const periodMs = Number(values.period);
  const running = Boolean(values.running);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      for (const s of monitor) s.tick();
      setTickCount((c) => c + 1);
    }, periodMs);
    return () => clearInterval(id);
  }, [running, periodMs, monitor]);

  const toggleFocus = (id) => setFocusId((cur) => (cur === id ? null : id));

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { setFocusId(null); return; }
      if (e.key === " ") {
        e.preventDefault();
        setValue("running", !running);
        return;
      }
      let idx = -1;
      if (/^[1-8]$/.test(e.key)) idx = Number(e.key) - 1;
      else if (/^[a-hA-H]$/.test(e.key)) idx = e.key.toUpperCase().charCodeAt(0) - 65;
      if (idx >= 0 && idx < ACTIVITY_LANES.length) toggleFocus(ACTIVITY_LANES[idx].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, setValue]);

  const focus = monitor.find((s) => s.lane.id === focusId) ?? null;
  const busiest = monitor.reduce((a, b) => (b.current > a.current ? b : a), monitor[0]);
  const quietest = monitor.reduce((a, b) => (b.current < a.current ? b : a), monitor[0]);
  const windowSec = Math.round((SAMPLES * periodMs) / 1000);

  return (
    <div className="h3-page">
      <style>{css}</style>
      <div className="h3-head">
        <h1>DEMO-DE · ACTIVITY MONITOR IN 3D</h1>
        <nav className="h3-nav">
          <a href="./">key-clicks</a>
          <a href="./react.html">shell + panelization</a>
          <a href="./definition.html">definition</a>
          <a href="./tangled.html">tangled tree 3D</a>
          <a href="./sunburst.html">sunburst 3D</a>
          <a href="./horizon.html">horizon monitor</a>
          <a className="here" href="./horizon3d.html">horizon 3D</a>
        </nav>
      </div>
      <p className="h3-sub">
        The horizon activity monitor in space: eight labelled lanes recede into the dark,
        time flowing toward you, each lane a terraced skyline whose folds stand as solid
        terraces in the horizon chart's own colours. Load is read as height <i>and</i> as
        depth of colour. The camera is a question — perspective, or isometric — and is
        left as a parameter. Keys <b>1–8</b> focus a lane; <b>Space</b> halts time.
      </p>
      <div className="h3-main">
        <div className="h3-stage">
          <Horizon3DView
            monitor={monitor}
            bands={bands}
            bandHeight={bandHeight}
            tickCount={tickCount}
            focusId={focusId}
            projection={String(values.projection)}
            drift={Boolean(values.drift)}
            labelsOn={Boolean(values.labelsOn)}
            onFocus={toggleFocus}
          />
        </div>
        <div className="h3-rail">
          <div className="h3-box">
            <h3>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={setValue} />
          </div>
          <div className="h3-box">
            <h3>READOUT</h3>
            <div className="h3-readout">
              {focus ? (
                <>
                  <span className="k">LANE</span>{"    "}{focus.lane.label} — {focus.lane.what}{"\n"}
                  <span className="k">NOW</span>{"     "}{focus.lane.format(focus.current)} · {laneState(focus)}{"\n"}
                  <span className="k">WINDOW</span>{"  "}mean {focus.lane.format(focus.stats().mean)} · peak {focus.lane.format(focus.stats().max)}{"\n"}
                  <span className="k">RESTS</span>{"   "}near {focus.lane.format(focus.lane.baseline)}
                </>
              ) : (
                <>
                  <span className="k">BUSIEST</span>{" "}{busiest.lane.label} — {busiest.lane.format(busiest.current)}{"\n"}
                  <span className="k">QUIETEST</span>{" "}{quietest.lane.label} — {quietest.lane.format(quietest.current)}{"\n"}
                  <span className="k">LANE</span>{"    "}— type a lane's key (1–8 / A–H) —
                </>
              )}
            </div>
          </div>
          <div className="h3-box">
            <h3>KEY-CLICKS</h3>
            <p className="h3-keyline">
              <b>1–8</b> / <b>A–H</b> focus a lane — the camera travels to it{" · "}<b>Space</b>{" "}
              {running ? "halt" : "resume"} time{" · "}<b>Esc</b> release focus
            </p>
          </div>
        </div>
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — The activity monitor as terrain: {periodMs} ms a sample,{" "}
        {windowSec} seconds on the tape, the newest moment at the front of each lane.
        Each column of the skyline is terraced at the horizon chart's folds — the same
        bands, the same colours, standing up.
      </p>

      <div className="print">
        <div className="kicker">Flat UI frames · the 3D spatial treatment</div>
        <h2>The monitor, standing in space</h2>
        <p className="standfirst">
          The flat horizon monitor reads by colour alone. In space its folds become
          terraces and its signal becomes terrain — eight skylines of machine activity,
          running away into the dark, the present moment at your feet.
        </p>
        <div className="rule" />
        <div className="cols">
          <div>
            <h3>THE CHART, STANDING</h3>
            <p>
              A horizon chart folds a tall graph into a short strip: band over band, each
              in a deeper shade, magnitude told by depth of colour. Stand the chart up and
              the folds become what they always implied — terraces. Each moment of a lane's
              history is a column; each column is sliced at the fold heights; each slice
              wears its band's colour. The value is now told twice, in height and in hue,
              and the whole two minutes of a lane's life is a skyline you can read from
              across the room: the high dark ridge is the busy hour, the low pale flats
              are the idle night.
            </p>
          </div>
          <div>
            <h3>PERSPECTIVE, OR ISOMETRIC</h3>
            <p>
              Whether an instrument like this should be seen in perspective is a genuine
              question, and the page declines to settle it in advance. Perspective gives
              the lanes presence — the near moment looms, history diminishes — but it
              taxes comparison: a column far down the tape is the same height as one at
              the front and does not look it. The isometric camera, orthographic and
              corner-on, abolishes the tax: equal values stand equal anywhere on the
              tape, at the cost of the scene's depth and drama. Both cameras are here, one
              parameter apart, because the environment's arrangement of 2D and 3D — the
              open question in <i>d3-js-uses.txt</i> — will be settled by looking, not by
              argument.
            </p>
          </div>
          <div>
            <h3>THE OPERATION</h3>
            <p>
              The monitor's operation carries over unchanged, because it was built for
              keys from the first: 1 to 8, or A to H, takes a lane into focus — here that
              means the other lanes dim and the camera travels along the row to stand
              before the chosen skyline, while the readout states its present value, its
              window's mean and peak. Space halts time in space as it did on the flat
              tape. The lanes remain synthetic walks with each quantity's temperament;
              bound to real counters, this is what the distribution's activity surface
              could feel like from inside it.
            </p>
          </div>
        </div>
        <div className="index">
          <h3>THE LANES — WHAT EACH ONE WATCHES</h3>
          {ACTIVITY_LANES.map((lane, i) => (
            <div className="lane-row" key={lane.id}>
              <button onClick={() => toggleFocus(lane.id)}>
                <span className="pk">{keyLabel(i)} / {i + 1}</span> {lane.label}
              </button>{" "}
              <span className="meta">— {lane.what}; rests near {lane.format(lane.baseline)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
