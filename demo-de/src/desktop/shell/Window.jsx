/* The window frame — the only one. Titlebar, drag, resize,
 * shade / vertical shade / min / max / close, and the app
 * component the registry names. Geometry and stacking live in
 * the store (core/windows.js); this component renders a record
 * and turns gestures into actions.
 *
 * Vertical shade (rec.vshaded, the key-clicks T key) renders a
 * vertical titlebar whose height is the window's full height;
 * w/h in the record are untouched, so restoring is exact.
 */

import { useRef, useState } from "react";
import { appById } from "../core/registry.jsx";
import {
  closeWindow,
  focusWindow,
  minimizeWindow,
  toggleMax,
  toggleShade,
  moveWindow,
  resizeWindow,
} from "../core/windows.js";
import { pad3 } from "../apps/shared.jsx";

const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function Window({ id, rec, focused, locked }) {
  const ap = appById(id);
  const App = ap.component;
  const dragRef = useRef(null);
  const [closing, setClosing] = useState(false);

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

  function onResizeMouseDown(edge) {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      focusWindow(id);
      const start = {
        sx: e.clientX, sy: e.clientY,
        x: rec.x, y: rec.y, w: rec.w || 480, h: rec.h || 320,
      };
      function move(ev) {
        const dx = ev.clientX - start.sx;
        const dy = ev.clientY - start.sy;
        let { x, y, w, h } = start;
        if (edge.includes("e")) w = start.w + dx;
        if (edge.includes("s")) h = start.h + dy;
        if (edge.includes("w")) { w = start.w - dx; x = start.x + (start.w - Math.max(280, w)); }
        if (edge.includes("n")) { h = start.h - dy; y = start.y + (start.h - Math.max(150, h)); }
        resizeWindow(id, w, h);
        if (x !== start.x || y !== start.y) moveWindow(id, x, Math.max(0, y));
      }
      function up() {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      }
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    };
  }

  function onClose(e) {
    e.stopPropagation();
    // Fast close transition: play it, then remove the window.
    setClosing(true);
    setTimeout(() => closeWindow(id), 120);
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
  } else if (rec.vshaded) {
    style.width = "30px";
    if (rec.h) style.height = rec.h + "px";
  } else {
    if (rec.w) style.width = rec.w + "px";
    // A shaded window collapses to its titlebar: no fixed height.
    if (rec.h && !rec.shaded) style.height = rec.h + "px";
  }

  const className =
    "nwin opening" +
    (focused ? " focused" : "") +
    (locked ? " kc-dragging" : "") +
    (rec.vshaded ? " vshade" : "") +
    (closing ? " closing" : "");

  if (rec.vshaded) {
    return (
      <div className={className} data-app={id} style={style}
        onMouseDown={() => focusWindow(id)}>
        <div className="vbar">
          <span className="vt">{ap.name}</span>
          <button className="wbtn close" title="Close" aria-label="Close" onClick={onClose}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-app={id} style={style}
      onMouseDown={() => focusWindow(id)}>
      <div className="titlebar" onMouseDown={onTitleMouseDown}
        onDoubleClick={(e) => { if (!e.target.closest(".wbtn")) toggleMax(id); }}>
        <span className="tid">WIN · {pad3(rec.seq)}</span>
        <span className="tt">{ap.name}</span>
        <span className="wctl">
          <button className="wbtn shade" title="Windowshade" aria-label="Shade" onClick={(e) => { e.stopPropagation(); toggleShade(id); }}>≡</button>
          <button className="wbtn min" title="Minimize" aria-label="Minimize" onClick={(e) => { e.stopPropagation(); minimizeWindow(id); }}>_</button>
          <button className="wbtn max" title="Maximize" aria-label="Maximize" onClick={(e) => { e.stopPropagation(); toggleMax(id); }}>□</button>
          <button className="wbtn close" title="Close" aria-label="Close" onClick={onClose}>✕</button>
        </span>
      </div>
      {!rec.shaded && (
        <div className="wbody">
          <App />
        </div>
      )}
      {!rec.max && !rec.shaded &&
        EDGES.map((edge) => (
          <div key={edge} className={"rsz rsz-" + edge} onMouseDown={onResizeMouseDown(edge)}></div>
        ))}
    </div>
  );
}
