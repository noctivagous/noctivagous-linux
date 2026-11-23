import { useRef, useState } from "react";
import { useSlice, setSetting, setBackdrop } from "../core/react.js";
import { toast } from "../core/bus.js";
import { playTestTone } from "../services/soundService.js";
import { BACKDROP_SURFACES, BACKDROP_DENSITIES } from "../services/surfaces.js";
import { StatusBar } from "./shared.jsx";

function Slider({ label, min, max, step, value, onChange, format }) {
  return (
    <div className="srow">
      <label>{label}</label>
      <input type="range" className="sys" min={min} max={max} step={step || 1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span className="sval">{format ? format(value) : value + "%"}</span>
    </div>
  );
}

export default function SettingsApp() {
  const settings = useSlice("settings");
  const bd = settings.backdrop;
  const [tab, setTab] = useState(0);
  const [ptr, setPtr] = useState(50);
  const [xy, setXy] = useState({ x: 0.5, y: 0.5 });
  const [soundMsg, setSoundMsg] = useState("Output: Speakers · 48 kHz");
  const padRef = useRef(null);
  const dragRef = useRef(false);

  const setWall = (w) => setSetting("wallpaper", w);
  const xyFromEvent = (cx, cy) => {
    const r = padRef.current.getBoundingClientRect();
    setXy({
      x: Math.max(0, Math.min(1, (cx - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (cy - r.top) / r.height)),
    });
  };

  return (
    <>
      <div className="tabs">
        <div className="tabstrip">
          {["Appearance", "Controls", "Sound"].map((n, i) => (
            <button key={n} className={tab === i ? "sel" : ""} data-tab={i} onClick={() => setTab(i)}>{n}</button>
          ))}
        </div>

        {tab === 0 && (
          <div className="tabpane sel" data-pane="0">
            <Slider label="Brightness" min={30} max={100} value={settings.brightness}
              onChange={(v) => setSetting("brightness", v)} />

            <div className="cap" style={{ margin: "12px 0 7px" }}>Backdrop · parametric (iGeo panelization)</div>
            <div className="srow">
              <label>Mode</label>
              <div className="selwrap" style={{ flex: 1 }}>
                <select className="tinput" value={bd.mode} onChange={(e) => setBackdrop({ mode: e.target.value })}>
                  <option value="parametric">Parametric</option>
                  <option value="classic">Classic gradients</option>
                </select>
              </div>
            </div>
            <div className="srow">
              <label>Surface</label>
              <div className="selwrap" style={{ flex: 1 }}>
                <select className="tinput" value={bd.surface} onChange={(e) => setBackdrop({ surface: e.target.value })}>
                  {BACKDROP_SURFACES.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="srow">
              <label>Density</label>
              <div className="selwrap" style={{ flex: 1 }}>
                <select className="tinput" value={bd.density} onChange={(e) => setBackdrop({ density: e.target.value })}>
                  {Object.entries(BACKDROP_DENSITIES).map(([id, d]) => (
                    <option key={id} value={id}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <Slider label="Swarm count" min={10} max={120} step={5} value={bd.swarmCount}
              onChange={(v) => setBackdrop({ swarmCount: v })} format={(v) => String(v)} />
            <Slider label="Swarm speed" min={0.25} max={3} step={0.25} value={bd.speed}
              onChange={(v) => setBackdrop({ speed: v })} format={(v) => v.toFixed(2) + "×"} />
            <Slider label="Panel reach" min={4} max={24} value={bd.reach}
              onChange={(v) => setBackdrop({ reach: v })} format={(v) => String(v)} />
            <Slider label="Panel memory" min={0.8} max={1} step={0.01} value={bd.memory}
              onChange={(v) => setBackdrop({ memory: v })} format={(v) => v.toFixed(2)} />
            <label className="chk">
              <input type="checkbox" checked={bd.motion} onChange={(e) => setBackdrop({ motion: e.target.checked })} /> Backdrop motion
            </label>
            <label className="chk">
              <input type="checkbox" checked={bd.cursorField} onChange={(e) => setBackdrop({ cursorField: e.target.checked })} /> Cursor field (attractor follows the pointer)
            </label>

            <div className="cap" style={{ margin: "12px 0 7px" }}>Wallpaper · classic</div>
            <div className="swatches">
              {[0, 1, 2].map((w) => (
                <button key={w} className={"swatch" + (settings.wallpaper === w ? " sel" : "")} data-wp={w}
                  style={{ background: ["linear-gradient(150deg,#2b2b2b,#0a0a0a)", "linear-gradient(150deg,#26303a,#090b0d)", "linear-gradient(150deg,#33291f,#17141d)"][w] }}
                  aria-label={"Wallpaper " + (w + 1)} onClick={() => setWall(w)}></button>
              ))}
            </div>
            <div className="hairline"></div>
            <label className="chk"><input type="checkbox" defaultChecked /> Enable notifications</label>
            <label className="chk"><input type="checkbox" /> Auto-start session apps</label>
            <label className="chk">
              <input type="checkbox" defaultChecked
                onChange={(e) => { document.body.classList.toggle("noanim", !e.target.checked); toast("Animations " + (e.target.checked ? "on" : "off")); }} /> Animations
            </label>
          </div>
        )}

        {tab === 1 && (
          <div className="tabpane sel" data-pane="1">
            <Slider label="Volume" min={0} max={100} value={settings.volume} onChange={(v) => setSetting("volume", v)} />
            <Slider label="Brightness" min={30} max={100} value={settings.brightness} onChange={(v) => setSetting("brightness", v)} />
            <Slider label="Pointer speed" min={0} max={100} value={ptr} onChange={setPtr} />
            <div className="cap" style={{ margin: "10px 0 7px" }}>XY pad · pointer offset</div>
            <div className="xypad" ref={padRef}
              onMouseDown={(e) => { dragRef.current = true; xyFromEvent(e.clientX, e.clientY); }}
              onMouseMove={(e) => { if (dragRef.current) xyFromEvent(e.clientX, e.clientY); }}
              onMouseUp={() => (dragRef.current = false)}
              onTouchStart={(e) => xyFromEvent(e.touches[0].clientX, e.touches[0].clientY)}
              onTouchMove={(e) => xyFromEvent(e.touches[0].clientX, e.touches[0].clientY)}>
              <div className="xydot" style={{ left: xy.x * 100 + "%", top: xy.y * 100 + "%" }}></div>
            </div>
            <div className="mono" style={{ fontSize: 11, color: "#9a9a9a", marginTop: 6 }}>
              X <b style={{ color: "#ddd" }}>{xy.x.toFixed(2)}</b> &nbsp; Y <b style={{ color: "#ddd" }}>{xy.y.toFixed(2)}</b>
            </div>
            <div className="cap" style={{ margin: "12px 0 4px" }}>Pointer scheme</div>
            <label className="radio"><input type="radio" name="ptr" defaultChecked /> Default</label>
            <label className="radio"><input type="radio" name="ptr" /> Large</label>
            <label className="radio"><input type="radio" name="ptr" /> Crosshair</label>
          </div>
        )}

        {tab === 2 && (
          <div className="tabpane sel" data-pane="2">
            <Slider label="Volume" min={0} max={100} value={settings.volume} onChange={(v) => setSetting("volume", v)} />
            <div className="cap" style={{ margin: "10px 0 6px" }}>Output level</div>
            <div className="meter"><i style={{ width: settings.volume + "%" }}></i></div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              <button className="btn sm" onClick={() => setSoundMsg("Test tone played · " + playTestTone() + "%")}>Test sound</button>
              <span className="mono" style={{ fontSize: 11, color: "#888" }}>{soundMsg}</span>
            </div>
          </div>
        )}
      </div>
      <StatusBar left="CONTROL PANEL" right="APPLY: LIVE" />
    </>
  );
}
