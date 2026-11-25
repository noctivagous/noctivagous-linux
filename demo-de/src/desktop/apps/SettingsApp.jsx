import { useEffect, useRef, useState } from "react";
import { useSlice, setSetting, setBackdrop, setGreeter } from "../core/react.js";
import { toast } from "../core/bus.js";
import { playTestTone } from "../services/soundService.js";
import { BACKDROP_SURFACES, BACKDROP_DENSITIES } from "../services/surfaces.js";
import { StatusBar } from "./shared.jsx";
import { APPS } from "../core/registry.jsx";
import { WIDGET_STYLES, widgetStyleIndex } from "../widgets/widgets.jsx";
import { appMode, setAppMode } from "../core/layers.js";
import { store } from "../core/react.js";
import { SettingsKit } from "./settingsKit.jsx";
import { KNOT_FORMS } from "../../../ui-space/src/knots.js";
import PlatformPicker from "./PlatformPicker.jsx";

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

const SHELL_PAGES = [
  { id: "launchcolumn", name: "Launch Bar" },
  { id: "widget:clock", name: "Clock Widget" },
  { id: "widget:sysload", name: "System Load Widget" },
];

export default function SettingsApp() {
  const settings = useSlice("settings");
  const ui = useSlice("ui");
  const bd = settings.backdrop;
  const greeter = settings.greeter || { knot: "trefoil", knotSpeed: 1 };
  const [tab, setTab] = useState(0);
  const [selPage, setSelPage] = useState("calculator");

  // The Configure key (\\) and the launch menus name a target;
  // when one arrives, show its page.
  useEffect(() => {
    if (ui.appSettingsTarget) {
      setTab(5);
      setSelPage(ui.appSettingsTarget);
    }
  }, [ui.appSettingsTarget]);

  const setAppSetting = (id, value) =>
    store.set("settings", { ...settings, appSettings: { ...(settings.appSettings || {}), [id]: value } });
  const setWidgetStyle = (id, idx) =>
    store.set("settings", { ...settings, widgetStyles: { ...(settings.widgetStyles || {}), [id]: idx } });
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
          {["Appearance", "Desktop", "Environment", "Controls", "Sound", "Applications"].map((n, i) => (
            <button key={n} className={tab === i ? "sel" : ""} data-tab={i} onClick={() => setTab(i)}>{n}</button>
          ))}
        </div>

        {tab === 0 && (
          <div className="tabpane sel" data-pane="0">
            <Slider label="Brightness" min={30} max={100} value={settings.brightness}
              onChange={(v) => setSetting("brightness", v)} />

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
            <Slider label="Viewpoint drift" min={0} max={1} step={0.05} value={bd.drift != null ? bd.drift : 0.5}
              onChange={(v) => setBackdrop({ drift: v })} format={(v) => Math.round(v * 100) + "%"} />
            <Slider label="Appearance variation" min={0} max={1} step={0.05} value={bd.variation != null ? bd.variation : 0.5}
              onChange={(v) => setBackdrop({ variation: v })} format={(v) => Math.round(v * 100) + "%"} />
            <label className="chk">
              <input type="checkbox" checked={bd.motion} onChange={(e) => setBackdrop({ motion: e.target.checked })} /> Backdrop motion
            </label>
            <label className="chk">
              <input type="checkbox" checked={bd.cursorField} onChange={(e) => setBackdrop({ cursorField: e.target.checked })} /> Cursor field (attractor follows the pointer)
            </label>

            <div className="cap" style={{ margin: "12px 0 7px" }}>Greeter · profile medallion</div>
            <div className="srow">
              <label>Knot</label>
              <div className="selwrap" style={{ flex: 1 }}>
                <select className="tinput" value={greeter.knot} onChange={(e) => setGreeter({ knot: e.target.value })}>
                  {Object.values(KNOT_FORMS).map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <Slider label="Knot rotation" min={0} max={2} step={0.25} value={greeter.knotSpeed}
              onChange={(v) => setGreeter({ knotSpeed: v })} format={(v) => v.toFixed(2) + "\u00d7"} />
            <div className="cap" style={{ margin: "12px 0 7px" }}>Greeter · clock knot presentation</div>
            <div className="srow">
              <label>Clock knot view</label>
              <div className="selwrap" style={{ flex: 1 }}>
                <select className="tinput" value={greeter.clockKnotView || "webgl"} onChange={(e) => setGreeter({ clockKnotView: e.target.value })}>
                  <option value="webgl">WebGL 3D knot</option>
                  <option value="canvas">Canvas 2D knot</option>
                </select>
              </div>
            </div>
            <div className="srow">
              <label>Clock format</label>
              <div className="selwrap" style={{ flex: 1 }}>
                <select className="tinput" value={greeter.clockAmpm === false ? "h24" : "ampm"} onChange={(e) => setGreeter({ clockAmpm: e.target.value === "ampm" })}>
                  <option value="ampm">12-hour · AM/PM label</option>
                  <option value="h24">24-hour</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div className="tabpane sel" data-pane="2">
            <div className="cap" style={{ margin: "12px 0 7px" }}>Environment · Platform Configuration</div>
            <div style={{ fontSize: 12, color: "#bdbdbd", marginBottom: 8 }}>
              Where are you coming from? The environment adapts its keys and layout to the
              platform you already know. This is also a step in the Setup Wizard.
            </div>
            <PlatformPicker settings={settings} />
            <div className="cap" style={{ marginTop: 10 }}>
              Foundation: keyboard shortcuts are not wired to the platform profile yet —
              the profile, its modifier and its layout are what they will consult.
            </div>
          </div>
        )}

        {tab === 3 && (
          <div className="tabpane sel" data-pane="3">
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

        {tab === 4 && (
          <div className="tabpane sel" data-pane="4">
            <Slider label="Volume" min={0} max={100} value={settings.volume} onChange={(v) => setSetting("volume", v)} />
            <div className="cap" style={{ margin: "10px 0 6px" }}>Output level</div>
            <div className="meter"><i style={{ width: settings.volume + "%" }}></i></div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              <button className="btn sm" onClick={() => setSoundMsg("Test tone played · " + playTestTone() + "%")}>Test sound</button>
              <span className="mono" style={{ fontSize: 11, color: "#888" }}>{soundMsg}</span>
            </div>
          </div>
        )}
        {tab === 5 && (
          <div className="tabpane sel" data-pane="5">
            <div className="appset">
              <div className="appset-list">
                {APPS.map((ap) => (
                  <button key={ap.id} className={selPage === ap.id ? "sel" : ""} onClick={() => setSelPage(ap.id)}>{ap.name}</button>
                ))}
                <div className="appset-sep"></div>
                {SHELL_PAGES.map((pg) => (
                  <button key={pg.id} className={selPage === pg.id ? "sel" : ""} onClick={() => setSelPage(pg.id)}>{pg.name}</button>
                ))}
                {(settings.launchBars || []).map((b) => (
                  <button key={"bar:" + b.id} className={selPage === "bar:" + b.id ? "sel" : ""} onClick={() => setSelPage("bar:" + b.id)}>Launch Bar · {b.position}</button>
                ))}
              </div>
              <div className="appset-page">
                {(() => {
                  const ap = APPS.find((a) => a.id === selPage);
                  if (ap) {
                    const Own = ap.Settings;
                    const mine = (settings.appSettings && settings.appSettings[ap.id]) || {};
                    return (
                      <>
                        <div className="appset-title">{ap.name}</div>
                        <SettingsKit
                          spec={[{ key: "mode", label: "Runs as", type: "segment", options: [
                            { value: "window", label: "Window" },
                            { value: "layer", label: "Desktop layer" },
                          ] }]}
                          value={{ mode: appMode(ap.id) }}
                          onChange={(v) => setAppMode(ap.id, v.mode)} />
                        {ap.settingsSpec ? (
                          <SettingsKit spec={ap.settingsSpec} value={mine} onChange={(v) => setAppSetting(ap.id, v)} />
                        ) : Own ? (
                          <Own value={mine} onChange={(v) => setAppSetting(ap.id, v)} />
                        ) : (
                          <div className="cap">{ap.name} has no settings of its own yet.</div>
                        )}
                      </>
                    );
                  }
                  if (selPage === "launchcolumn") {
                    const lc = settings.launchColumn || {};
                    return (
                      <>
                        <div className="appset-title">Launch Bar</div>
                        <SettingsKit
                          spec={[
                            { key: "position", type: "matrix", label: "Position", cols: 3, rows: 3, default: "top", options: [
                              { value: "top", label: "Top", slot: [1, 0] },
                              { value: "left", label: "Left", slot: [0, 1] },
                              { value: "right", label: "Right", slot: [2, 1] },
                              { value: "bottom", label: "Bottom", slot: [1, 2] },
                            ] },
                            { key: "utilitiesOpen", type: "checkbox", label: "Utilities group starts open", default: false },
                            { key: "layerBadge", type: "checkbox", label: "Show the diamond badge on desktop-layer app icons", default: true },
                          ]}
                          value={lc}
                          onChange={(v) => store.set("settings", { ...settings, launchColumn: v })} />
                      </>
                    );
                  }
                  if (selPage.startsWith("bar:")) {
                    const barId = selPage.slice(4);
                    const bars = settings.launchBars || [];
                    const bar = bars.find((b) => b.id === barId);
                    if (!bar) return <div className="cap">This launch bar no longer exists.</div>;
                    const val = { position: bar.position };
                    APPS.forEach((a) => { val["app:" + a.id] = bar.items.includes(a.id); });
                    return (
                      <>
                        <div className="appset-title">Launch Bar · {bar.position}</div>
                        <SettingsKit
                          spec={[
                            { key: "position", type: "matrix", label: "Position", cols: 3, rows: 3, default: "bottom", options: [
                              { value: "top", label: "Top", slot: [1, 0] },
                              { value: "left", label: "Left", slot: [0, 1] },
                              { value: "right", label: "Right", slot: [2, 1] },
                              { value: "bottom", label: "Bottom", slot: [1, 2] },
                            ] },
                            ...APPS.map((a) => ({ key: "app:" + a.id, type: "checkbox", label: a.name, default: false })),
                          ]}
                          value={val}
                          onChange={(v) => {
                            const items = APPS.filter((a) => v["app:" + a.id]).map((a) => a.id);
                            store.set("settings", { ...settings, launchBars: bars.map((b) => (b.id === barId ? { ...b, position: v.position, items } : b)) });
                          }} />
                        <div className="cap" style={{ marginTop: 8 }}>Checked apps appear on this bar, in catalogue order. The bar itself is moved by its right-click menu's Drag Mode.</div>
                      </>
                    );
                  }
                  if (selPage.startsWith("widget:")) {
                    const wid = selPage.slice(7);
                    const cur = widgetStyleIndex(settings, wid);
                    const clockMine = (settings.appSettings && settings.appSettings.clock) || {};
                    return (
                      <>
                        <div className="appset-title">{wid === "clock" ? "Clock Widget" : "System Load Widget"}</div>
                        <SettingsKit
                          spec={[{ key: "style", label: "Style set", type: "segment",
                            options: WIDGET_STYLES.map((n, i) => ({ value: i, label: n })) }]}
                          value={{ style: cur }}
                          onChange={(v) => setWidgetStyle(wid, v.style)} />
                        {wid === "clock" && (
                          <SettingsKit
                            spec={[{ key: "hour24", type: "checkbox", label: "24-hour time", default: true }]}
                            value={clockMine}
                            onChange={(v) => setAppSetting("clock", v)} />
                        )}
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
      <StatusBar left="CONTROL PANEL" right="APPLY: LIVE" />
    </>
  );
}
