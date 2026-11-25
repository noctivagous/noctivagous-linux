/* NCT-WL-KIT — the stock settings kit models the toolkit's property controls: native apps declare specs, the kit renders them. See WAYLAND-MAP.md. */
/* The stock settings kit.
 *
 * Apps declare their settings as a property list (a spec) and
 * get the system's stock controls and callbacks for free: the
 * Settings app renders the list with SettingsKit, bound to the
 * app's slice of the system settings (settings.appSettings),
 * and the app simply reads its values back from there. An app
 * that needs more than the stock controls can still provide
 * its own GUI (a Settings component in the registry) — the kit
 * is the default, not a cage.
 *
 * Spec entries:
 *   { key, label, type: "checkbox", default }
 *   { key, label, type: "select" | "segment",
 *     options: [{ value, label }], default }
 *   { key, label, type: "slider", min, max, step, format, default }
 *   { key, label, type: "text", placeholder, default }
 *   { key, label, type: "matrix", cols, rows,
 *     options: [{ value, label, slot: [col, row] }], default }
 *     — a 2D matrix of stationary slots, modelled on the app
 *     kit's matrix controls: each option sits in its slot of
 *     the grid, slots with no option stay empty, and clicking
 *     a slot selects its value. For a position setting the
 *     slots are laid out as the thing being positioned (the
 *     Launch Bar's matrix is a little map of the screen's
 *     edges).
 * Option values may be any JSON value (null, numbers, strings);
 * the kit maps them through option indexes, never coercion.
 */

export function specValue(spec, value) {
  const out = {};
  for (const e of spec || []) {
    out[e.key] = value && value[e.key] !== undefined ? value[e.key] : e.default;
  }
  return out;
}

function KitRow({ e, val, set }) {
  if (e.type === "checkbox") {
    return (
      <label className="setrow">
        <input type="checkbox" checked={!!val} onChange={(ev) => set(ev.target.checked)} />
        <span>{e.label}</span>
      </label>
    );
  }
  if (e.type === "select" || e.type === "segment") {
    const idx = Math.max(0, e.options.findIndex((o) => o.value === val));
    if (e.type === "select") {
      return (
        <div className="srow">
          <label>{e.label}</label>
          <select value={idx} onChange={(ev) => set(e.options[parseInt(ev.target.value, 10)].value)}>
            {e.options.map((o, i) => (
              <option key={i} value={i}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div className="srow">
        <label>{e.label}</label>
        <div className="segrow">
          {e.options.map((o, i) => (
            <button key={i} className={"btn sm" + (i === idx ? " primary" : "")} onClick={() => set(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (e.type === "slider") {
    return (
      <div className="srow">
        <label>{e.label}</label>
        <input type="range" className="sys" min={e.min} max={e.max} step={e.step || 1}
          value={val} onChange={(ev) => set(parseFloat(ev.target.value))} />
        <span className="sval">{e.format ? e.format(val) : val}</span>
      </div>
    );
  }
  if (e.type === "matrix") {
    const cols = e.cols || 3;
    const rows = e.rows || 3;
    const bySlot = new Map((e.options || []).map((o) => {
      const s = o.slot || [0, 0];
      return [s[0] + "," + s[1], o];
    }));
    const cells = [];
    for (let rI = 0; rI < rows; rI++) {
      for (let cI = 0; cI < cols; cI++) {
        const o = bySlot.get(cI + "," + rI);
        cells.push(o ? (
          <button key={cI + "," + rI} className={"setmatrix-slot" + (o.value === val ? " on" : "")}
            onClick={() => set(o.value)}>{o.label}</button>
        ) : (
          <div key={cI + "," + rI} className="setmatrix-cell"></div>
        ));
      }
    }
    return (
      <div className="srow">
        <label>{e.label}</label>
        <div className="setmatrix" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{cells}</div>
      </div>
    );
  }
  if (e.type === "text") {
    return (
      <div className="srow">
        <label>{e.label}</label>
        <input type="text" value={val || ""} placeholder={e.placeholder || ""}
          onChange={(ev) => set(ev.target.value)} />
      </div>
    );
  }
  return null;
}

export function SettingsKit({ spec, value, onChange }) {
  const v = specValue(spec, value);
  return (
    <div className="setkit">
      {(spec || []).map((e) => (
        <KitRow key={e.key} e={e} val={v[e.key]}
          set={(x) => onChange({ ...(value || {}), [e.key]: x })} />
      ))}
    </div>
  );
}
