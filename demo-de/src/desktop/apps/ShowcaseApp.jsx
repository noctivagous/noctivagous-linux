/* UI Showcase — the standing reference for the GUI and
 * layout engine (demo-de/UI-SHOWCASE.md).
 *
 * Two aspects: (1) the library — live specimens of the stock
 * controls and widgets, on the system shelf and the app-kit
 * shelf, each with its measured demo size; (2) later, the GUI
 * builder (a second slice).
 *
 * Style sets, the user's point: a set is a set of STYLES OF
 * THE CONTROLS WE ALREADY HAVE — the tabs, text fields and
 * sliders as they exist in Settings, the buttons, the
 * widgets. The switcher above re-skins every specimen in the
 * app, and the Style Sets section shows the same control
 * strip in each set, side by side.
 *
 * Device frame: the library renders inside a device frame
 * (desktop / tablet / phone × portrait / landscape). The
 * frame's width drives the device context (core/devices.js)
 * the specimens read — grid columns, label placement and the
 * like resolve per device class through resolveProp, the hook
 * the controls themselves carry.
 */

import { useRef, useState } from "react";
import { WIDGET_STYLES } from "../widgets/widgets.jsx";
import { DeviceContext, FRAME_PRESETS, resolveProp, useDevice } from "../core/devices.js";
import { StatusBar } from "./shared.jsx";
import { SettingsKit, specValue } from "./settingsKit.jsx";
import { Specimen } from "./showcase/Specimen.jsx";
import AppKitSection from "./showcase/AppKitSection.jsx";
import BuilderSection from "./showcase/BuilderSection.jsx";

const SECTIONS = [
  { id: "controls", name: "Controls" },
  { id: "alignment", name: "Alignment" },
  { id: "grid", name: "Grid Systems" },
  { id: "styles", name: "Style Sets" },
  { id: "appkit", name: "App Kit" },
  { id: "builder", name: "Builder" },
];

const SET_NAMES = ["panel", "glass", "recessed"];

/* --- The stock trio, as in Settings: tabs, a text field,
 * a slider. Rendered under the active style set so each set
 * can be judged on the controls that actually ship. --- */
function StockTrio() {
  const [tab, setTab] = useState(0);
  const [text, setText] = useState("Sample text");
  const [level, setLevel] = useState(55);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }}>
      <div className="tabstrip" style={{ border: "1px solid #000", borderRadius: 4, overflow: "hidden" }}>
        {["General", "Display", "Audio"].map((t, i) => (
          <button key={t} className={tab === i ? "sel" : ""} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} />
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12 }}>Level</span>
        <input type="range" className="sys" min={0} max={100} value={level}
          onChange={(e) => setLevel(parseFloat(e.target.value))} />
        <b className="mono" style={{ fontSize: 11 }}>{level}</b>
      </span>
    </div>
  );
}

function ControlsSection() {
  const [clicks, setClicks] = useState(0);
  const [kit, setKit] = useState({});
  const kitSpec = [
    { key: "enabled", label: "Enabled", type: "checkbox", default: true },
    { key: "quality", label: "Quality", type: "select", options: [{ value: "low", label: "Low" }, { value: "med", label: "Medium" }, { value: "high", label: "High" }], default: "med" },
    { key: "mode", label: "Mode", type: "segment", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }], default: "a" },
    { key: "level", label: "Level", type: "slider", min: 0, max: 100, step: 1, default: 42 },
    { key: "name", label: "Name", type: "text", default: "Specimen" },
  ];
  return (
    <div className="sc-sections">
      <Specimen title="Buttons — the stock .btn" note={"Primary pressed " + clicks + " time" + (clicks === 1 ? "" : "s") + "."}>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={() => setClicks((c) => c + 1)}>Default</button>
          <button className="btn primary" onClick={() => setClicks((c) => c + 1)}>Primary</button>
          <button className="btn sm">Small</button>
          <button className="btn" disabled>Disabled</button>
        </span>
      </Specimen>
      <Specimen title="The settings kit — the stock property controls"
        note="These are the controls the builder's inspector and every app's Settings page are built from."
        kit={{ spec: kitSpec, value: kit, onChange: setKit }}>
        <div className="mono" style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(specValue(kitSpec, kit), null, 1)}
        </div>
      </Specimen>
      <Specimen title="Tabs, fields and sliders — as in Settings"
        note="The controls Settings itself is made of. A style set restyles these, not a separate copy of them.">
        <StockTrio />
      </Specimen>
    </div>
  );
}

function AlignmentSection() {
  const [textProps, setTextProps] = useState({});
  const [formProps, setFormProps] = useState({});
  const [rowProps, setRowProps] = useState({});
  const textSpec = [
    { key: "align", label: "Text alignment", type: "segment", options: [{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }, { value: "justify", label: "Justify" }], default: "left" },
    { key: "leading", label: "Line height", type: "segment", options: [{ value: "1.3", label: "Tight" }, { value: "1.55", label: "Normal" }, { value: "1.8", label: "Loose" }], default: "1.55" },
  ];
  const formSpec = [
    { key: "labels", label: "Label placement", type: "segment", options: [{ value: "left", label: "Left" }, { value: "top", label: "Top" }], default: "left" },
    { key: "labelAlign", label: "Label text", type: "segment", options: [{ value: "left", label: "Left" }, { value: "right", label: "Right" }], default: "left" },
  ];
  const rowSpec = [
    { key: "valign", label: "Vertical alignment", type: "segment", options: [{ value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "baseline", label: "Baseline" }, { value: "bottom", label: "Bottom" }], default: "baseline" },
  ];
  const tv = specValue(textSpec, textProps);
  const fv = specValue(formSpec, formProps);
  const rv = specValue(rowSpec, rowProps);
  const align = tv.align;
  const leading = parseFloat(tv.leading);
  const labels = fv.labels;
  const labelAlign = fv.labelAlign;
  const valign = rv.valign;
  const alignItems = { top: "flex-start", middle: "center", baseline: "baseline", bottom: "flex-end" }[valign];
  const formRow = (label, value) => (
    <div key={label} style={{ display: "flex", flexDirection: labels === "top" ? "column" : "row", gap: 4, alignItems: labels === "top" ? "stretch" : "center" }}>
      <label style={{ width: labels === "top" ? "auto" : 110, textAlign: labels === "top" ? "left" : labelAlign, fontSize: 12 }}>{label}</label>
      <input type="text" defaultValue={value} style={{ flex: 1 }} />
    </div>
  );
  return (
    <div className="sc-sections">
      <Specimen title="Text alignment — a property of the text"
        note="Alignment is a control on the widget, set in the kit, not styling sprinkled on by the app."
        kit={{ spec: textSpec, value: textProps, onChange: setTextProps }}>
        <p style={{ margin: 0, textAlign: align, lineHeight: leading, fontSize: 13 }}>
          The text block holds its alignment as a property. A reader, a form and a toolbar all
          need the same four choices, so the choice lives on the control — and the builder offers
          it in the inspector.
        </p>
      </Specimen>
      <Specimen title="Form labels — placement and label alignment"
        note="Label placement is a property of the form control; it changes with device class in real layouts."
        kit={{ spec: formSpec, value: formProps, onChange: setFormProps }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
          {formRow("Name", "Noctivagous")}
          {formRow("Colour", "NCT green")}
        </div>
      </Specimen>
      <Specimen title="Mixed-size row — vertical alignment"
        note="Baseline is the typographic default; middle and top are choices the control offers."
        kit={{ spec: rowSpec, value: rowProps, onChange: setRowProps }}>
        <div style={{ display: "flex", gap: 12, alignItems }}>
          <span style={{ fontSize: 34, lineHeight: 1 }}>Aa</span>
          <button className="btn">Action</button>
          <span style={{ fontSize: 11, color: "#999" }}>small note beside a large glyph</span>
        </div>
      </Specimen>
    </div>
  );
}

const GRID_BLOCKS = [
  { t: "Lead Text Block", b: "The opening block: a wide measure of text that sets the page's voice." },
  { t: "Image Well", b: "A framed image area with a caption line beneath." },
  { t: "Inspector Card", b: "A dense card of properties and values, right-aligned." },
  { t: "Toolbar Strip", b: "A row of actions pinned to the top of its region." },
  { t: "Tag Flow", b: "Tags that wrap: small chips, left to right, line after line." },
  { t: "Text Block", b: "A plain paragraph block at the measure the grid gives it." },
];

function GridSection() {
  const [props, setProps] = useState({});
  return (
    <DeviceContext.Consumer>
      {(ctx) => {
        const cols = resolveProp({ desktop: 3, tablet: 2, phone: 1 }, ctx.deviceClass);
        const gapSpec = [{ key: "gap", label: "Gap", type: "slider", min: 4, max: 24, step: 2, default: 12 }];
        const gap = specValue(gapSpec, props).gap;
        return (
          <div className="sc-sections">
            <Specimen
              title={"Grid — " + ctx.deviceClass + " band, " + cols + " columns"}
              note={"Columns are a per-device property (desktop 3 / tablet 2 / phone 1) resolved through the device hooks from the frame's width band; switch the frame above and watch the grid reflow. The blocks are the Grid Systems Lab's own named blocks."}
              kit={{ spec: gapSpec, value: props, onChange: setProps }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ", 1fr)", gap }}>
                {GRID_BLOCKS.map((b) => (
                  <div key={b.t} className="sc-grid-block">
                    <div className="sc-grid-block-t">{b.t}</div>
                    <div className="sc-grid-block-b">{b.b}</div>
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen title="Vertical rhythm" note="Spacing is a scale, not a number: every vertical gap in the showcase is a step of 4, 8 or 12px.">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[4, 8, 12].map((g) => (
                  <div key={g} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ width: 34, fontSize: 11 }}>{g}px</span>
                    <div style={{ height: g, width: 160, background: "var(--green)", opacity: 0.7 }}></div>
                  </div>
                ))}
              </div>
            </Specimen>
          </div>
        );
      }}
    </DeviceContext.Consumer>
  );
}

function StyleSetsSection({ setIdx, setSetIdx }) {
  return (
    <div className="sc-sections">
      <Specimen title="One control strip, three style sets"
        note="The same tabs, field, slider, button and checkbox in each set. A set is a set of styles of the controls we already have — nothing here is a separate copy. The switcher above applies a set to the whole app; on the real desktop the 0 key cycles the same sets on a widget.">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {SET_NAMES.map((name, i) => (
            <div key={name} className={"sc-set-" + name} style={{ border: "1px solid var(--hair)", borderRadius: 6, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <b style={{ fontSize: 12 }}>{WIDGET_STYLES[i] || name}</b>
                <button className="btn sm" onClick={() => setSetIdx(i)}>Apply to whole showcase</button>
              </div>
              <StockTrio />
              <span style={{ display: "inline-flex", gap: 8, marginTop: 8 }}>
                <button className="btn sm">Button</button>
                <label className="setrow" style={{ padding: 0 }}><input type="checkbox" defaultChecked /> <span>Check</span></label>
              </span>
            </div>
          ))}
        </div>
      </Specimen>
      <Specimen title="Widget sets — panel, glass, recessed"
        note="The desktop's widgets (clock, system load) carry the same three sets; this is the same mechanism, at the showcase's scale.">
        <span style={{ display: "inline-flex", gap: 12, flexWrap: "wrap" }}>
          {WIDGET_STYLES.map((s) => (
            <div key={s} className={"widget ws-" + s} style={{ width: 170 }}>
              <div className="cap">{s}</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>12:34</div>
              <div style={{ fontSize: 11, color: "#999" }}>widget in the {s} set</div>
            </div>
          ))}
        </span>
      </Specimen>
    </div>
  );
}

export default function ShowcaseApp() {
  const [section, setSection] = useState("controls");
  const [setIdx, setSetIdx] = useState(0);
  const [frameClass, setFrameClass] = useState("desktop");
  const [orient, setOrient] = useState("landscape");
  const frameBodyRef = useRef(null);
  const ctx = useDevice(frameBodyRef);
  const preset = FRAME_PRESETS[frameClass][orient];
  const sec = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  return (
    <div className={"sc-root sc-set-" + SET_NAMES[setIdx]}>
      <div className="tabstrip">
        {SECTIONS.map((s) => (
          <button key={s.id} className={section === s.id ? "sel" : ""} onClick={() => setSection(s.id)}>{s.name}</button>
        ))}
      </div>
      <div className="sc-tools">
        <span className="sc-tools-label">Style set</span>
        <div className="segrow">
          {WIDGET_STYLES.map((name, i) => (
            <button key={name} className={"btn sm" + (setIdx === i ? " primary" : "")} onClick={() => setSetIdx(i)}>{name}</button>
          ))}
        </div>
        <span className="sc-tools-spacer"></span>
        <span className="sc-tools-label">Device frame</span>
        <div className="segrow">
          {["desktop", "tablet", "phone"].map((d) => (
            <button key={d} className={"btn sm" + (frameClass === d ? " primary" : "")} onClick={() => setFrameClass(d)}>{d[0].toUpperCase() + d.slice(1)}</button>
          ))}
        </div>
        <button className="btn sm" onClick={() => setOrient((o) => (o === "landscape" ? "portrait" : "landscape"))}>
          {orient === "landscape" ? "▭ Landscape" : "▯ Portrait"}
        </button>
      </div>
      <div className="sc-framewrap">
        <div className="sc-frame" style={{ width: preset.w ? preset.w + "px" : "100%", height: preset.h + "px" }}>
          <div className="sc-framelabel mono">
            {frameClass.toUpperCase()} FRAME · {ctx.width} × {ctx.height} · {ctx.orientation} · width band: {ctx.deviceClass} ({ctx.deviceClass === "phone" ? "≤ 640" : ctx.deviceClass === "tablet" ? "641–1024" : "> 1024"})
          </div>
          <div className="sc-framebody" ref={frameBodyRef}>
            <DeviceContext.Provider value={{ ...ctx, frame: frameClass }}>
              {section === "controls" && <ControlsSection />}
              {section === "alignment" && <AlignmentSection />}
              {section === "grid" && <GridSection />}
              {section === "styles" && <StyleSetsSection setIdx={setIdx} setSetIdx={setSetIdx} />}
              {section === "appkit" && <AppKitSection />}
              {section === "builder" && <BuilderSection />}
            </DeviceContext.Provider>
          </div>
        </div>
      </div>
      <StatusBar
        left={<span>UI SHOWCASE — THE STANDING REFERENCE FOR THE GUI AND LAYOUT ENGINE</span>}
        right={<span>{sec.name} · {(WIDGET_STYLES[setIdx] || "")} set · {ctx.deviceClass} band</span>}
      />
    </div>
  );
}
