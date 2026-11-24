/* The App Kit shelf of the UI Showcase.
 *
 * The catalogue is the paramorphic app-kit's own registry
 * data (controls/registry-data.ts in the submodule) — the
 * real list of what an app developer is provided, not a copy
 * maintained here. Selecting a control shows its registry
 * entry (family, default size, property schema); where the
 * control has a renderer in this shell it renders LIVE with
 * its default properties, editable through the stock settings
 * kit (the schema→kit adapter below is the same one the GUI
 * builder's inspector will use). Controls without a renderer
 * here show their footprint at default size, marked as such —
 * the catalogue is complete even where the wiring isn't.
 */

import { useMemo, useState } from "react";
import { CONTROL_DATA } from "../../../../paramorphic-components/src/framework/app-kit/controls/registry-data.ts";
import { SettingsKit } from "../settingsKit.jsx";
import { Specimen } from "./Specimen.jsx";

import { RENDERERS, schemaToKit, toKitValues, fromKitValues } from "./kitRender.jsx";

export default function AppKitSection() {
  const families = useMemo(() => {
    const seen = [];
    for (const d of CONTROL_DATA) if (!seen.includes(d.family)) seen.push(d.family);
    return seen;
  }, []);
  const [family, setFamily] = useState("all");
  const [type, setType] = useState("pro-button");
  const def = CONTROL_DATA.find((d) => d.type === type) || CONTROL_DATA[0];
  const [propsByType, setPropsByType] = useState({});
  const props = { ...def.defaultProps, ...(propsByType[def.type] || {}) };
  const setProps = (patch) =>
    setPropsByType((m) => ({ ...m, [def.type]: { ...(m[def.type] || {}), ...patch } }));
  const render = RENDERERS[def.type];
  const list = CONTROL_DATA.filter((d) => family === "all" || d.family === family);

  return (
    <div className="sc-appkit">
      <div className="sc-appkit-list">
        <div className="segrow" style={{ flexWrap: "wrap", marginBottom: 8 }}>
          {["all", ...families].map((f) => (
            <button key={f} className={"btn sm" + (family === f ? " primary" : "")} onClick={() => setFamily(f)}>
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
        {list.map((d) => (
          <button key={d.type} className={"sc-appkit-item" + (d.type === def.type ? " sel" : "")}
            onClick={() => setType(d.type)}>
            <span className="sc-appkit-icon">{d.icon}</span>
            <span>{d.label}</span>
            <span className="sc-appkit-fam">{d.family}</span>
          </button>
        ))}
      </div>
      <div className="sc-appkit-detail">
        <Specimen
          title={def.label + " — " + def.type}
          note={
            render
              ? "Live in this shell: rendered from the registry's default properties; edit them with the kit below."
              : "Registry specimen: no renderer in this shell yet — the outline is the control's footprint at its default size."
          }
          kit={def.propSchema && def.propSchema.length ? {
            spec: schemaToKit(def.propSchema),
            value: toKitValues(def, props),
            onChange: (v) => setProps(fromKitValues(def, v)),
          } : null}
        >
          {render ? (
            <div className="sc-appkit-live">{render(props, setProps)}</div>
          ) : (
            <div className="sc-footprint" style={{ width: def.defaultSize.w, height: def.defaultSize.h }}>
              <span className="sc-footprint-icon">{def.icon}</span>
              <span className="mono">{def.defaultSize.w} × {def.defaultSize.h}</span>
            </div>
          )}
        </Specimen>
        <div className="spec-card">
          <div className="spec-head"><span className="spec-title">Registry entry</span></div>
          <table className="sc-regtable">
            <tbody>
              <tr><td>type</td><td className="mono">{def.type}</td></tr>
              <tr><td>family</td><td>{def.family}</td></tr>
              <tr><td>default size</td><td className="mono">{def.defaultSize.w} × {def.defaultSize.h}</td></tr>
              <tr><td>container</td><td>{def.container ? "yes" : "no"}</td></tr>
              {(def.propSchema || []).map((f) => (
                <tr key={f.key}>
                  <td className="mono">{f.key}</td>
                  <td>{f.kind}{f.options ? " — " + f.options.join(" / ") : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="spec-note">
            Source: the paramorphic app-kit's registry data (submodule), read live —
            {CONTROL_DATA.length} controls in {families.length} families.
          </div>
        </div>
      </div>
    </div>
  );
}
