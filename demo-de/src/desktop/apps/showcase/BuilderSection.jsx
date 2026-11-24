/* The GUI builder — slice 2 of the UI Showcase.
 *
 * Assemble mock UI from the app kit's stock palette. The mock
 * is a GuiDocument-shaped object with a layout PER DEVICE
 * CLASS (desktop / tablet / phone): the device frame above is
 * the layout switch — frame the phone, and you are editing
 * the phone layout. Mocks save into the demo file system
 * (Documents/<name>.gui.json) through fsWrite, so the later
 * step — using this for real development — starts from the
 * same document shape the paramorphic kit already speaks.
 *
 * Input, like the rest of the system, is bimodal:
 *   - mouse: drag from the palette, drag elements, drag the
 *     corner handle to resize, right-click an element for its
 *     contextual menu;
 *   - drag-lock / key-click: a plain click (or an F press) on
 *     a palette item PICKS the control up — it follows the
 *     cursor — and a click on the canvas drops it. The same
 *     click-again idiom picks a placed element up and drops
 *     it elsewhere. Nothing here requires holding a button.
 */

import { useContext, useEffect, useRef, useState } from "react";
import { CONTROL_DATA } from "../../../../paramorphic-components/src/framework/app-kit/controls/registry-data.ts";
import { DeviceContext } from "../../core/devices.js";
import { SettingsKit } from "../settingsKit.jsx";
import { HOME_PATH, fsList, fsNode, fsSubscribe, fsWrite } from "../../services/fs.js";
import { RENDERERS, fromKitValues, schemaToKit, toKitValues } from "./kitRender.jsx";

const DOCS = HOME_PATH + "/Documents";
const snap = (v) => Math.round(v / 8) * 8;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function emptyDoc(name) {
  return { kind: "gui-document", version: 1, name: name || "Untitled Mock", seq: 0, devices: { desktop: [], tablet: [], phone: [] } };
}

export default function BuilderSection() {
  const ctx = useContext(DeviceContext);
  const device = ctx.frame || ctx.deviceClass || "desktop";
  const [doc, setDoc] = useState(() => emptyDoc());
  const [sel, setSel] = useState(null);
  const [drag, setDrag] = useState(null); // {mode:"new"|"move"|"resize", type?, id?, dx, dy}
  const [carry, setCarry] = useState(null); // {x, y} cursor position over the canvas, canvas coords
  const [menu, setMenu] = useState(null); // {id, x, y}
  const [savedList, setSavedList] = useState([]);
  const [loadPick, setLoadPick] = useState("");
  const [status, setStatus] = useState("");
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  dragRef.current = drag;

  const elements = doc.devices[device] || [];
  const selEl = elements.find((e) => e.id === sel) || null;
  const selDef = selEl ? CONTROL_DATA.find((d) => d.type === selEl.type) : null;

  const refreshSaved = () => {
    const rows = fsList(DOCS) || [];
    setSavedList(rows.filter((r) => r.kind === "file" && r.name.endsWith(".gui.json")).map((r) => r.name));
  };
  useEffect(() => { refreshSaved(); return fsSubscribe(refreshSaved); }, []);

  const setElements = (list) =>
    setDoc((d) => ({ ...d, devices: { ...d.devices, [device]: list } }));
  const patchEl = (id, patch) =>
    setElements(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const canvasPos = (ev) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top, w: r.width, h: r.height };
  };

  const placeNew = (type, x, y) => {
    const def = CONTROL_DATA.find((d) => d.type === type);
    if (!def) return;
    const id = "el-" + (doc.seq + 1);
    const el = {
      id, type,
      x: clamp(snap(x - def.defaultSize.w / 2), 0, 4000),
      y: clamp(snap(y - 8), 0, 4000),
      w: def.defaultSize.w, h: def.defaultSize.h,
      props: { ...def.defaultProps },
    };
    setDoc((d) => ({ ...d, seq: d.seq + 1, devices: { ...d.devices, [device]: [...(d.devices[device] || []), el] } }));
    setSel(id);
  };

  /* --- drag / carry machinery: one state machine for the
   * held drag and the locked carry. --- */
  useEffect(() => {
    if (!drag) return undefined;
    const move = (ev) => {
      const d = dragRef.current;
      if (!d || !canvasRef.current) return;
      const p = canvasPos(ev);
      setCarry(p);
      if (d.mode === "move") patchEl(d.id, { x: clamp(snap(p.x - d.dx), 0, 4000), y: clamp(snap(p.y - d.dy), 0, 4000) });
      if (d.mode === "resize") patchEl(d.id, { w: clamp(snap(p.x - d.ax + 8), 24, 1200), h: clamp(snap(p.y - d.ay + 8), 16, 900) });
    };
    const up = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "new" && canvasRef.current && canvasRef.current.contains(ev.target)) {
        const p = canvasPos(ev);
        placeNew(d.type, p.x, p.y);
        setDrag(null);
      } else if (d.mode !== "new" && !d.locked) {
        const barelyMoved = Math.abs(ev.clientX - d.startX) < 4 && Math.abs(ev.clientY - d.startY) < 4;
        if (barelyMoved) setDrag({ ...d, locked: true }); // a plain click picks it up (drag-lock)
        else setDrag(null);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [drag, elements, device, doc.seq]);

  const onPaletteDown = (type) => (ev) => {
    ev.preventDefault();
    setMenu(null);
    setDrag({ mode: "new", type, locked: true });
  };

  const onCanvasDown = (ev) => {
    if (ev.button === 2) return;
    const d = dragRef.current;
    if (d && d.mode === "new") {
      const p = canvasPos(ev);
      placeNew(d.type, p.x, p.y);
      setDrag(null);
      return;
    }
    if (d && d.locked) { setDrag(null); return; } // second click drops a locked move/resize
    if (ev.target === canvasRef.current) { setSel(null); setMenu(null); }
  };

  const onElementDown = (el) => (ev) => {
    if (ev.button === 2) return;
    ev.stopPropagation();
    setMenu(null);
    const d = dragRef.current;
    if (d && d.mode === "new") { const p = canvasPos(ev); placeNew(d.type, p.x, p.y); setDrag(null); return; }
    if (d && d.locked && d.id === el.id) { setDrag(null); return; }
    setSel(el.id);
    const p = canvasPos(ev);
    setDrag({ mode: "move", id: el.id, dx: p.x - el.x, dy: p.y - el.y, locked: false, startX: ev.clientX, startY: ev.clientY });
  };

  const onResizeDown = (el) => (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    const p = canvasPos(ev);
    setSel(el.id);
    setDrag({ mode: "resize", id: el.id, ax: el.x, ay: el.y, locked: false, startX: ev.clientX, startY: ev.clientY });
  };

  /* Keyboard: Delete removes, Esc cancels/closes, Space drops
   * a locked drag (when the key reaches the app — the window
   * drag-lock owns Space over bare window, the click idiom
   * above is the guaranteed path). Text fields keep their
   * keys, as everywhere in the system. */
  useEffect(() => {
    const onKey = (ev) => {
      const t = ev.target;
      const typing = t && (t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (t.tagName === "INPUT" && ["text", "search", "password", "email", "url", "number"].includes(t.type)) || t.isContentEditable);
      if (typing) return;
      const root = canvasRef.current && canvasRef.current.closest(".sc-root");
      if (!root || !root.closest(".nwin") || !root.closest(".nwin").classList.contains("focused")) return;
      if (ev.key === "Escape") { setDrag(null); setMenu(null); setSel(null); }
      if ((ev.key === "Delete" || ev.key === "Backspace") && sel) {
        setElements(elements.filter((e) => e.id !== sel));
        setSel(null);
      }
      if (ev.key === " " && dragRef.current && dragRef.current.locked) { ev.preventDefault(); setDrag(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, elements, device]);

  const duplicate = (el) => {
    const id = "el-" + (doc.seq + 1);
    const copy = { ...el, id, x: el.x + 16, y: el.y + 16, props: { ...el.props } };
    setDoc((d) => ({ ...d, seq: d.seq + 1, devices: { ...d.devices, [device]: [...(d.devices[device] || []), copy] } }));
    setSel(id);
  };
  const toFront = (el) => setElements([...elements.filter((e) => e.id !== el.id), el]);
  const remove = (el) => { setElements(elements.filter((e) => e.id !== el.id)); if (sel === el.id) setSel(null); };

  const save = () => {
    const name = (doc.name || "Untitled Mock").replace(/[^\w\- ]+/g, "").trim() || "Untitled Mock";
    const err = fsWrite(DOCS + "/" + name + ".gui.json", JSON.stringify({ ...doc, name }, null, 1));
    setStatus(err ? "Save failed: " + err : "Saved to Documents/" + name + ".gui.json");
  };
  const load = () => {
    if (!loadPick) return;
    const node = fsNode(DOCS + "/" + loadPick);
    try {
      const parsed = JSON.parse(node.content || "");
      if (parsed.kind !== "gui-document" || !parsed.devices) throw new Error("not a gui document");
      setDoc({ ...emptyDoc(parsed.name || "Mock"), ...parsed });
      setSel(null);
      setStatus("Loaded " + loadPick);
    } catch (e) {
      setStatus("Load failed: " + e.message);
    }
  };

  const families = [];
  for (const d of CONTROL_DATA) if (!families.includes(d.family)) families.push(d.family);
  const dragDef = drag && drag.mode === "new" ? CONTROL_DATA.find((d) => d.type === drag.type) : null;

  return (
    <div className="bld-root">
      <div className="bld-toolbar">
        <input type="text" className="bld-name" value={doc.name}
          onChange={(e) => setDoc((d) => ({ ...d, name: e.target.value }))} />
        <button className="btn sm" onClick={save}>Save</button>
        <select value={loadPick} onChange={(e) => setLoadPick(e.target.value)}>
          <option value="">Saved mocks…</option>
          {savedList.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button className="btn sm" onClick={load} disabled={!loadPick}>Load</button>
        <button className="btn sm" onClick={() => { setDoc(emptyDoc()); setSel(null); setStatus("New mock"); }}>New</button>
        <span className="bld-device mono">editing: {device} layout · {elements.length} element{elements.length === 1 ? "" : "s"}</span>
        <span className="bld-status">{status}</span>
      </div>
      <div className="bld-main" data-band={ctx.deviceClass}>
        <div className="bld-palette">
          {families.map((f) => (
            <div key={f}>
              <div className="bld-fam">{f}</div>
              {CONTROL_DATA.filter((d) => d.family === f).map((d) => (
                <button key={d.type} className={"bld-pal-item" + (drag && drag.type === d.type ? " carrying" : "")}
                  onMouseDown={onPaletteDown(d.type)}>
                  <span className="sc-appkit-icon">{d.icon}</span><span>{d.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="bld-canvas" ref={canvasRef} onMouseDown={onCanvasDown}
          onContextMenu={(e) => { e.preventDefault(); setSel(null); setMenu(null); }}>
          {elements.map((el) => {
            const def = CONTROL_DATA.find((d) => d.type === el.type);
            const render = RENDERERS[el.type];
            const selected = el.id === sel;
            return (
              <div key={el.id} className={"bld-el" + (selected ? " sel" : "") + (drag && drag.id === el.id ? " dragging" : "")}
                style={{ left: el.x, top: el.y, width: el.w, height: el.h }}
                onMouseDown={onElementDown(el)}
                onContextMenu={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  setSel(el.id);
                  const p = canvasPos(e);
                  setMenu({ id: el.id, x: p.x, y: p.y });
                }}>
                {render ? (
                  <div className="bld-el-inner">{render(el.props, (patch) => patchEl(el.id, { props: { ...el.props, ...patch } }))}</div>
                ) : (
                  <div className="bld-el-foot">
                    <span className="sc-footprint-icon">{def ? def.icon : "?"}</span>
                    <span>{def ? def.label : el.type}</span>
                  </div>
                )}
                {selected && <span className="bld-handle" onMouseDown={onResizeDown(el)}></span>}
              </div>
            );
          })}
          {drag && drag.mode === "new" && carry && dragDef && (
            <div className="bld-ghost" style={{
              left: snap(carry.x - dragDef.defaultSize.w / 2), top: snap(carry.y - 8),
              width: dragDef.defaultSize.w, height: dragDef.defaultSize.h,
            }}>{dragDef.label}</div>
          )}
          {elements.length === 0 && !drag && (
            <div className="bld-empty">The {device} layout is empty.<br />Click a palette item to pick it up, then click here to drop it — or drag it in.</div>
          )}
          {menu && selEl && menu.id === selEl.id && (
            <div className="bld-menu" style={{ left: menu.x, top: menu.y }}>
              <button onClick={() => { duplicate(selEl); setMenu(null); }}>Duplicate</button>
              <button onClick={() => { toFront(selEl); setMenu(null); }}>Bring to front</button>
              <button onClick={() => { remove(selEl); setMenu(null); }}>Delete</button>
            </div>
          )}
        </div>
        <div className="bld-inspector">
          {selEl && selDef ? (
            <>
              <div className="bld-insp-head">{selDef.label} <span className="mono">{selEl.type}</span></div>
              <div className="bld-geom">
                {["x", "y", "w", "h"].map((k) => (
                  <label key={k}>{k.toUpperCase()}
                    <input type="number" value={selEl[k]}
                      onChange={(e) => patchEl(selEl.id, { [k]: clamp(parseInt(e.target.value || "0", 10) || 0, 0, 4000) })} />
                  </label>
                ))}
              </div>
              {selDef.propSchema && selDef.propSchema.length > 0 && (
                <SettingsKit spec={schemaToKit(selDef.propSchema)}
                  value={toKitValues(selDef, selEl.props)}
                  onChange={(v) => patchEl(selEl.id, { props: fromKitValues(selDef, v) })} />
              )}
              <div className="bld-insp-actions">
                <button className="btn sm" onClick={() => duplicate(selEl)}>Duplicate</button>
                <button className="btn sm" onClick={() => remove(selEl)}>Delete</button>
              </div>
            </>
          ) : (
            <div className="bld-insp-empty">
              Select an element to edit its properties. The inspector is the stock settings kit,
              driven by the control's own registry schema — the same properties the App Kit shelf shows.
            </div>
          )}
          <div className="bld-hint">
            Drag from the palette, or click to pick up and click to drop (drag-lock — an F press
            does the same). Right-click an element for its menu. Each device frame keeps its own layout.
          </div>
        </div>
      </div>
    </div>
  );
}
