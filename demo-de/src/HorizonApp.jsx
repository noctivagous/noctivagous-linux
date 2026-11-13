import { useEffect, useMemo, useRef, useState } from "react";
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

/**
 * Realtime horizon chart, as an activity monitor — horizon.html.
 *
 * A Flat UI frame in the terms of d3-js-uses.txt: "Realtime horizon
 * chart — activity monitor contexts". The D3 gallery original plots
 * twenty anonymous random walks labelled 0…19; a monitor's job is
 * to say what is going on, so here the walks are named lanes —
 * network, disk, memory, swap, processor, graphics — each with the
 * temperament of the quantity it names. The banding, the walk and
 * the colour rule are the original's, ported in the NCTGraphite
 * horizon module. Operation is key-click, rebuilt for the frame:
 * keys 1–8 (or A–H) take a lane into focus and magnify it, Space
 * halts time, Esc releases. The lanes are synthetic walks; in the
 * distribution they bind to real counters.
 */

const SAMPLES = 480;

const PARAM_DEFS = [
  { id: "bands", label: "Bands", type: "number", min: 1, max: 7, step: 1, defaultValue: 4 },
  { id: "step", label: "Strip height", type: "number", min: 18, max: 44, step: 2, defaultValue: 29 },
  {
    id: "period", label: "Tick", type: "select", defaultValue: "250",
    options: [
      { value: "100", label: "100 ms" },
      { value: "250", label: "250 ms" },
      { value: "500", label: "500 ms" },
      { value: "1000", label: "1 s" },
    ],
  },
  { id: "running", label: "Running", type: "boolean", defaultValue: true },
];

const keyLabel = (i) => String.fromCharCode(65 + i); // A..H

function laneState(s) {
  const { mean } = s.stats();
  const v = s.current;
  if (v > 0.85) return "SATURATED";
  if (v > mean + 0.22) return "SURGING";
  if (v < 0.06) return "IDLE";
  return "STEADY";
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
    ctx.fillStyle = "#f7faf7";
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
  return (
    <canvas
      ref={ref}
      width={SAMPLES}
      height={h}
      style={{ width: "100%", height: h, imageRendering: "pixelated", display: "block" }}
    />
  );
}

const css = `
.hz-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.hz-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.hz-head h1 { font-size:17px; letter-spacing:2px; color:#e8f3ee; margin:0; }
.hz-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.hz-nav a.here { color:#ffa726; }
.hz-sub { padding:0 20px 10px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.hz-main { display:flex; gap:14px; margin:0 20px; align-items:flex-start; }
.hz-stage { flex:1; border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; min-width:0; }
.hz-axis { display:flex; margin:0 0 6px 160px; justify-content:space-between; font-family:Consolas, monospace; font-size:10px; color:#8fa3ab; }
.hz-lane { display:flex; gap:12px; align-items:stretch; padding:5px 6px; border-radius:4px; cursor:pointer; border:1px solid transparent; }
.hz-lane:hover { background:#131b1f; }
.hz-lane.focus { background:#131b1f; border-color:#ffa726; }
.hz-lab { width:148px; flex:none; display:flex; flex-direction:column; justify-content:center; gap:2px; }
.hz-lab .nm { font-size:11px; letter-spacing:1.5px; color:#e8f3ee; }
.hz-lab .val { font-family:Consolas, monospace; font-size:15px; color:#a9f0dd; }
.hz-lab .val small { font-size:10px; color:#8fa3ab; }
.hz-chip { display:inline-block; font-family:Consolas, monospace; font-size:9.5px; padding:0 4px; margin-right:6px;
  border-radius:3px; border:1px solid rgba(255,167,38,.65); background:rgba(6,12,14,.82); color:#ffa726; }
.hz-lane.focus .hz-chip { background:#ffa726; color:#0b0e10; font-weight:bold; }
.hz-strip { flex:1; min-width:0; border:1px solid #2c3a41; border-radius:2px; overflow:hidden; }
.hz-rail { width:296px; flex:none; display:flex; flex-direction:column; gap:14px; }
.hz-box { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; }
.hz-box h3 { margin:0 0 8px; font-size:10.5px; letter-spacing:2px; color:#e8f3ee; font-weight:bold; }
.hz-readout { font-family:Consolas, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; white-space:pre-wrap; word-break:break-word; }
.hz-readout .k { color:#ffa726; }
.hz-keyline { font-family:Consolas, monospace; font-size:11.5px; color:#8fa3ab; line-height:1.7; }
.hz-keyline b { color:#ffa726; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:118px; }
.nct-parameter output { font-family:Consolas, monospace; color:#ffa726; min-width:30px; text-align:right; }
.nct-parameter select { background:#0b0e10; color:#ffa726; border:1px solid #2c3a41; font-family:Consolas, monospace; font-size:11px; }
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

export default function HorizonApp() {
  const monitorRef = useRef(null);
  if (!monitorRef.current) {
    monitorRef.current = createMonitor(ACTIVITY_LANES, SAMPLES, 20261113);
  }
  const monitor = monitorRef.current;
  const { values, setValue } = useNCTParameters(PARAM_DEFS);
  const [tickCount, setTickCount] = useState(0);
  const [focusId, setFocusId] = useState(null);

  const bands = Number(values.bands);
  const step = Number(values.step);
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
      if (idx >= 0 && idx < ACTIVITY_LANES.length) {
        const id = ACTIVITY_LANES[idx].id;
        setFocusId((cur) => (cur === id ? null : id));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, setValue]);

  const focus = monitor.find((s) => s.lane.id === focusId) ?? null;
  const busiest = monitor.reduce((a, b) => (b.current > a.current ? b : a), monitor[0]);
  const quietest = monitor.reduce((a, b) => (b.current < a.current ? b : a), monitor[0]);
  const windowSec = Math.round((SAMPLES * periodMs) / 1000);
  void tickCount;

  return (
    <div className="hz-page">
      <style>{css}</style>
      <div className="hz-head">
        <h1>DEMO-DE · ACTIVITY MONITOR</h1>
        <nav className="hz-nav">
          <a href="./">key-clicks</a>
          <a href="./react.html">shell + panelization</a>
          <a href="./definition.html">definition</a>
          <a href="./tangled.html">tangled tree 3D</a>
          <a href="./sunburst.html">sunburst 3D</a>
          <a href="./sunburst-cylinder.html">sunburst cylinder</a>
          <a className="here" href="./horizon.html">horizon monitor</a>
          <a href="./horizon3d.html">horizon 3D</a>
          <a href="./treemap.html">treemap 3D</a>
          <a href="./treemap-cube.html">treemap cube</a>
        </nav>
      </div>
      <p className="hz-sub">
        The realtime horizon chart from the D3 gallery, put to its named work in{" "}
        <i>d3-js-uses.txt</i>: a Flat UI activity monitor. Eight lanes move at once, each
        labelled with what is going on — network, disk, memory, swap, processor, graphics.
        The deeper a lane's colour, the higher its load. Keys <b>1–8</b> take a lane into
        focus; <b>Space</b> halts time.
      </p>
      <div className="hz-main">
        <div className="hz-stage">
          <div className="hz-axis">
            <span>−{windowSec}s</span>
            <span>−{Math.round(windowSec * 0.75)}s</span>
            <span>−{Math.round(windowSec * 0.5)}s</span>
            <span>−{Math.round(windowSec * 0.25)}s</span>
            <span>NOW</span>
          </div>
          {monitor.map((s, i) => (
            <div
              key={s.lane.id}
              className={`hz-lane${focusId === s.lane.id ? " focus" : ""}`}
              onClick={() => setFocusId(focusId === s.lane.id ? null : s.lane.id)}
            >
              <div className="hz-lab">
                <span className="nm">
                  <span className="hz-chip">{keyLabel(i)}</span>
                  {s.lane.label}
                </span>
                <span className="val">
                  {s.lane.format(s.current)} <small>{laneState(s)}</small>
                </span>
              </div>
              <div className="hz-strip">
                <LaneCanvas series={s} bands={bands} step={step} focused={focusId === s.lane.id} />
              </div>
            </div>
          ))}
        </div>
        <div className="hz-rail">
          <div className="hz-box">
            <h3>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={setValue} />
          </div>
          <div className="hz-box">
            <h3>READOUT</h3>
            <div className="hz-readout">
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
          <div className="hz-box">
            <h3>KEY-CLICKS</h3>
            <p className="hz-keyline">
              <b>1–8</b> / <b>A–H</b> focus a lane (again to release){" · "}<b>Space</b>{" "}
              {running ? "halt" : "resume"} time{" · "}<b>Esc</b> release focus
            </p>
          </div>
        </div>
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — Eight activity lanes as horizon charts: {periodMs} ms a sample,{" "}
        {windowSec} seconds on the tape. A horizon chart folds a tall graph into a short
        strip — each fold a deeper shade — so magnitude is read as depth of colour, and
        eight channels stay legible in the height of two.
      </p>

      <div className="print">
        <div className="kicker">Flat UI frames · activity monitor contexts</div>
        <h2>Everything the machine is doing, at a glance</h2>
        <p className="standfirst">
          A desktop that shows dense, futuristic surfaces still needs its quiet instruments:
          the gauges you read peripherally, all day, without thinking. The horizon chart is
          the gauge for activity — many channels, moving together, each one labelled.
        </p>
        <div className="rule" />
        <div className="cols">
          <div>
            <h3>THE CHART</h3>
            <p>
              A horizon chart takes an ordinary area graph and folds it. Cut the graph into
              horizontal bands; lay the bands over one another in deeper and deeper shades;
              the strip that results is a fraction of the height, yet nothing is lost — a
              value's height is recoverable from how deep its colour runs. Folding is what
              lets a monitor be dense without being tall: eight channels of machine activity
              in the vertical space a single conventional graph would take, all moving at
              once, all comparable at a glance. Peaks announce themselves as darkness.
            </p>
          </div>
          <div>
            <h3>THE CONVERSION</h3>
            <p>
              The D3 gallery's realtime version plots twenty random walks and labels them
              with numbers — a demonstration of the drawing, not yet a monitor. The
              conversion keeps the machinery exactly: the same walk, the same banding, the
              same colour rule, the same scheme greens, now ported into the NCTGraphite
              horizon module. What changes is the subject. The walks are given names and
              natures — network in and out, disk read and write, memory, swap, processor,
              graphics — each with the temperament of its quantity: memory high and slow,
              swap idle until it spikes. The data is synthetic, and the page says so; in
              the distribution these lanes bind to the machine's real counters.
            </p>
          </div>
          <div>
            <h3>THE OPERATION</h3>
            <p>
              The original's only interaction is a rule that follows the mouse. A monitor
              in a key-click environment is operated like everything else here: every lane
              carries its key — 1 to 8, or A to H — and typing it takes the lane into
              focus, magnifying its strip so its folds can be read closely, while the
              readout states its present value, its window's mean and peak, and the level
              it rests at. Space halts time itself, freezing every lane for inspection;
              Esc lets go. Nothing here needs the pointer, because the environment's
              premise is that the keyboard is the primary instrument.
            </p>
          </div>
        </div>
        <div className="index">
          <h3>THE LANES — WHAT EACH ONE WATCHES</h3>
          {ACTIVITY_LANES.map((lane, i) => (
            <div className="lane-row" key={lane.id}>
              <button onClick={() => setFocusId(lane.id)}>
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
