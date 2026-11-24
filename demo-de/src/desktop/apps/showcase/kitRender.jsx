/* Shared control rendering for the Showcase: the registry
 * schema→kit adapter and the in-shell renderers, used by BOTH
 * the App Kit shelf (specimens) and the GUI builder (canvas
 * elements) — one renderer set, so a control looks the same
 * in the catalogue, on the canvas, and in an app.
 */

/* Prop-schema kinds (registry) → settings-kit spec kinds. */
export function schemaToKit(schema) {
  return (schema || []).map((f) => {
    switch (f.kind) {
      case "boolean": return { key: f.key, label: f.label, type: "checkbox", default: false };
      case "slider": return { key: f.key, label: f.label, type: "slider", min: f.min ?? 0, max: f.max ?? 100, step: f.step ?? 1 };
      case "number":
        return f.min != null && f.max != null
          ? { key: f.key, label: f.label, type: "slider", min: f.min, max: f.max, step: f.step ?? 1 }
          : { key: f.key, label: f.label, type: "text" };
      case "select": return { key: f.key, label: f.label, type: "segment", options: (f.options || []).map((o) => ({ value: o, label: o })) };
      default: return { key: f.key, label: f.label, type: "text" };
    }
  });
}

/* Kit values are flat; the registry's stringList props are
 * arrays — present them as comma-joined text and parse back.
 * Number-kind fields edited as text parse back to numbers. */
export function toKitValues(def, props) {
  const out = { ...props };
  for (const f of def.propSchema || []) {
    if (f.kind === "stringList" && Array.isArray(out[f.key])) out[f.key] = out[f.key].join(", ");
  }
  return out;
}
export function fromKitValues(def, values) {
  const out = { ...values };
  for (const f of def.propSchema || []) {
    if (f.kind === "stringList" && typeof out[f.key] === "string") {
      out[f.key] = out[f.key].split(",").map((s) => s.trim()).filter(Boolean);
    }
    if (f.kind === "number" && typeof out[f.key] === "string" && out[f.key] !== "") {
      const n = parseFloat(out[f.key]);
      if (!Number.isNaN(n)) out[f.key] = n;
    }
  }
  return out;
}

/* Renderers in this shell, keyed by registry type. Each takes
 * the control's props and a patch function. */
export const RENDERERS = {
  "pro-button": (p, set) => (
    <button className={"btn" + (p.styleVariant === "blue" ? " primary" : "")}
      style={{
        borderRadius: p.radius,
        ...(p.styleVariant === "danger" ? { background: "linear-gradient(180deg,#7a2e26,#54201a)", borderColor: "#2a0f0c", color: "#ffd9d2" } : {}),
      }}
      onClick={() => set({})}>{p.title}</button>
  ),
  "icon-button": (p) => <button className="btn" style={{ width: 32, height: 32, borderRadius: p.radius, padding: 0 }}>{p.title}</button>,
  "segmented-control": (p, set) => (
    <div className="segrow">
      {(p.segments || []).map((s, i) => (
        <button key={i} className={"btn sm" + (p.selectedSegment === i ? " primary" : "")} onClick={() => set({ selectedSegment: i })}>{s}</button>
      ))}
    </div>
  ),
  slider: (p, set) => (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 12 }}>{p.title}</span>
      <input type="range" className="sys" min={0} max={100} value={p.value} onChange={(e) => set({ value: parseFloat(e.target.value) })} />
      <b className="mono" style={{ fontSize: 11 }}>{p.value}</b>
    </span>
  ),
  toggle: (p, set) => (
    <label className="setrow">
      <input type="checkbox" checked={!!p.checked} onChange={(e) => set({ checked: e.target.checked })} />
      <span>{p.title || "Toggle"}</span>
    </label>
  ),
  progress: (p) => <div className="meter" style={{ width: 160 }}><i style={{ width: p.value + "%" }}></i></div>,
  "text-label": (p) => <span style={{ fontSize: 12.5 }}>{p.title}</span>,
  "text-block": (p) => <p style={{ margin: 0, fontSize: 12.5, maxWidth: 260 }}>{p.title}</p>,
  "input-field": (p, set) => (
    <input type="text" value={p.title} placeholder={p.placeholder}
      onChange={(e) => set({ title: e.target.value })} style={{ width: 170 }} />
  ),
  "text-area": (p, set) => (
    <textarea value={p.title} placeholder={p.placeholder} rows={3}
      onChange={(e) => set({ title: e.target.value })} style={{ width: 200 }} />
  ),
  checkbox: (p, set) => (
    <label className="setrow">
      <input type="checkbox" checked={!!p.checked} onChange={(e) => set({ checked: e.target.checked })} />
      <span>{p.title}</span>
    </label>
  ),
  panel: (p) => (
    <div className="widget ws-panel" style={{ width: 240, borderRadius: p.radius, opacity: p.opacity }}>
      <div className="cap" style={{ marginBottom: 6 }}>{p.title}</div>
      <div style={{ fontSize: 12 }}>Panel body — a container other controls live in.</div>
    </div>
  ),
  "tab-bar": (p, set) => (
    <div className="tabstrip" style={{ border: "1px solid #000", borderRadius: 4, overflow: "hidden" }}>
      {(p.tabs || []).map((t, i) => (
        <button key={i} className={p.selectedTab === i ? "sel" : ""} onClick={() => set({ selectedTab: i })}>{t}</button>
      ))}
    </div>
  ),
  "toolbar-strip": (p) => (
    <div className="toolbar" style={{ width: 340 }}>
      <button className="btn sm">New</button>
      <button className="btn sm">Open</button>
      <span className="sp"></span>
      <span className="mono" style={{ fontSize: 11, color: "#888" }}>{p.title}</span>
    </div>
  ),
  "list-box": (p, set) => (
    <div className="listbox" style={{ width: 200 }}>
      {(p.rows || []).map((r, i) => (
        <div key={i} className={"lrow" + (p.selected === i ? " sel" : "")} style={{ gridTemplateColumns: "1fr" }}
          onClick={() => set({ selected: i })}>
          <span>{r}</span>
        </div>
      ))}
    </div>
  ),
  "image-well": (p) => (
    <div className="preview-image" style={{ width: 150, height: 100 }}>
      <span>{p.title}</span>
    </div>
  ),
  separator: () => <div style={{ width: 160, height: 1, background: "var(--hair)" }}></div>,
  dropdown: (p, set) => (
    <select value={p.selected} onChange={(e) => set({ selected: parseInt(e.target.value, 10) })}>
      {(p.options || []).map((o, i) => <option key={i} value={i}>{o}</option>)}
    </select>
  ),
  "radio-group": (p, set) => (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      {(p.options || []).map((o, i) => (
        <label key={i} className="setrow" style={{ padding: 0 }}>
          <input type="radio" checked={p.selected === i} onChange={() => set({ selected: i })} />
          <span>{o}</span>
        </label>
      ))}
    </span>
  ),
  "bar-meter": (p) => <div className="meter blue" style={{ width: 170 }}><i style={{ width: p.value + "%" }}></i></div>,
  "led-button": (p, set) => (
    <button className="btn" onClick={() => set({ checked: !p.checked })}
      style={{
        width: 44, height: 44, borderRadius: "50%", padding: 0,
        background: p.checked ? p.color : undefined,
        color: p.checked ? "#fff" : undefined,
      }}>{p.title}</button>
  ),
};

