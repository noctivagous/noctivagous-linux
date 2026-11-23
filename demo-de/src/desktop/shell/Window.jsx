/* The window frame — the only one. Titlebar, drag, shade / min /
 * max / close, and the app component the registry names. Geometry
 * and stacking live in the store (core/windows.js); this component
 * renders a record and turns gestures into actions. */

import { useRef } from "react";
import { appById } from "../core/registry.jsx";
import { closeWindow, focusWindow, minimizeWindow, toggleMax, toggleShade, moveWindow } from "../core/windows.js";
import { pad3 } from "../apps/shared.jsx";

export default function Window({ id, rec, focused, locked }) {
  const ap = appById(id);
  const App = ap.component;
  const dragRef = useRef(null);

  function onTitleMouseDown(e) {
    if (e.target.closest(".wbtn")) return;
    focusWindow(id);
    if (rec.max) return;
    const el = e.currentTarget.closest(".nwin");
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: rec.x, oy: rec.y, el };
    const area = el.offsetParent;
    function move(ev) {
      const d = dragRef.current;
      if (!d) return;
      const aw = area ? area.clientWidth : window.innerWidth;
      const ah = area ? area.clientHeight : window.innerHeight;
      const nx = Math.max(-el.offsetWidth + 80, Math.min(d.ox + ev.clientX - d.sx, aw - 60));
      const ny = Math.max(0, Math.min(d.oy + ev.clientY - d.sy, ah - 34));
      moveWindow(id, nx, ny);
    }
    function up() {
      dragRef.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    }
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    e.preventDefault();
  }

  const style = {
    left: rec.x + "px",
    top: rec.y + "px",
    zIndex: rec.z,
    display: rec.min ? "none" : "flex",
  };
  if (rec.max) {
    style.width = "100%";
    style.height = "100%";
  } else {
    if (rec.w) style.width = rec.w + "px";
    // A shaded window collapses to its titlebar: no fixed height.
    if (rec.h && !rec.shaded) style.height = rec.h + "px";
  }

  return (
    <div className={"nwin opening" + (focused ? " focused" : "") + (locked ? " kc-dragging" : "")} data-app={id} style={style}
      onMouseDown={() => focusWindow(id)}>
      <div className="titlebar" onMouseDown={onTitleMouseDown}
        onDoubleClick={(e) => { if (!e.target.closest(".wbtn")) toggleMax(id); }}>
        <span className="tid">WIN · {pad3(rec.seq)}</span>
        <span className="tt">{ap.name}</span>
        <span className="wctl">
          <button className="wbtn shade" title="Windowshade" aria-label="Shade" onClick={(e) => { e.stopPropagation(); toggleShade(id); }}>≡</button>
          <button className="wbtn min" title="Minimize" aria-label="Minimize" onClick={(e) => { e.stopPropagation(); minimizeWindow(id); }}>_</button>
          <button className="wbtn max" title="Maximize" aria-label="Maximize" onClick={(e) => { e.stopPropagation(); toggleMax(id); }}>□</button>
          <button className="wbtn close" title="Close" aria-label="Close" onClick={(e) => { e.stopPropagation(); closeWindow(id); }}>✕</button>
        </span>
      </div>
      {!rec.shaded && (
        <div className="wbody">
          <App />
        </div>
      )}
    </div>
  );
}
