/* The Patch Viewer — a patch you open on a port or a cord to
 * watch its data: the current value, the stream of deliveries,
 * and, for inputs, a way to inject a value by hand. Opened from
 * the Patch menu or by right-clicking a port or cord.
 */

import { useState } from "react";
import { useSlice } from "../core/react.js";
import { APPS } from "../core/registry.jsx";
import {
  portDef, keyOf, inject, setWatch, clearLog, removeCord,
} from "../core/patchbay.js";
import { openWindow, focusWindow } from "../core/windows.js";
import { StatusBar } from "./shared.jsx";

const fmt = (v) => {
  if (v === undefined) return "—";
  const s = String(v);
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
};
const time = (at) => new Date(at).toLocaleTimeString();

export default function ViewerApp() {
  const patch = useSlice("patch");
  const watch = patch.watch;
  const [draft, setDraft] = useState("");

  if (!watch) {
    return (
      <>
        <div className="cap" style={{ marginBottom: 8 }}>Patch Viewer</div>
        <p style={{ color: "#a9a9a9", lineHeight: 1.6, margin: "4px 0 12px" }}>
          Nothing is being watched. Right-click any port or patch cord and choose
          Open Viewer — or start with the clock, whose tick you can wire into
          other windows.
        </p>
        <button className="btn sm primary" onClick={() => setWatch({ kind: "port", owner: "clock", port: "tick" })}>
          Watch the clock tick
        </button>
        <StatusBar left="IDLE" right="PATCH" />
      </>
    );
  }

  let title = "", value, entries = [], inputEnd = null, cord = null;
  if (watch.kind === "port") {
    const def = portDef(watch.owner, watch.port);
    title = watch.owner + " · " + (def ? def.label : watch.port) + (def ? ` (${def.dir})` : "");
    value = patch.values[keyOf(watch.owner, watch.port)];
    entries = patch.log.filter(
      (e) => (e.from.owner === watch.owner && e.from.port === watch.port) ||
             (e.to.owner === watch.owner && e.to.port === watch.port),
    );
    if (def && def.dir === "in") inputEnd = { owner: watch.owner, port: watch.port };
  } else {
    cord = patch.cords.find((c) => c.id === watch.id) || null;
    if (cord) {
      title = `cord · ${cord.from.owner}:${cord.from.port} → ${cord.to.owner}:${cord.to.port}`;
      const mine = patch.log.filter((e) => e.cordId === cord.id);
      value = mine.length ? mine[mine.length - 1].value : patch.values[keyOf(cord.from.owner, cord.from.port)];
      entries = mine;
      inputEnd = { owner: cord.to.owner, port: cord.to.port };
    } else {
      title = "cord (removed)";
      entries = patch.log.filter((e) => e.cordId === watch.id);
      value = entries.length ? entries[entries.length - 1].value : undefined;
    }
  }
  const ownerIsApp = watch.kind === "port" && APPS.some((a) => a.id === watch.owner);

  return (
    <>
      <div className="cap" style={{ marginBottom: 6 }}>Watching</div>
      <div className="mono" style={{ fontSize: 12.5, color: "#e8e8e8", marginBottom: 8 }}>{title}</div>
      <div className="group">
        <h4>Current value</h4>
        <div className="mono" style={{ fontSize: 15, color: "#7be07b", wordBreak: "break-word" }}>{fmt(value)}</div>
      </div>
      {inputEnd && (
        <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
          <input
            className="tinput"
            style={{ flex: 1 }}
            placeholder={`Inject into ${inputEnd.owner}:${inputEnd.port}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { inject(inputEnd.owner, inputEnd.port, draft); setDraft(""); }
            }}
          />
          <button className="btn sm primary" onClick={() => { inject(inputEnd.owner, inputEnd.port, draft); setDraft(""); }}>Send</button>
        </div>
      )}
      <div className="cap" style={{ margin: "8px 0 5px" }}>Deliveries · {entries.length}</div>
      <div className="listbox" style={{ maxHeight: 150, overflowY: "auto" }}>
        {entries.length === 0 && <div className="lrow"><span style={{ color: "#777" }}>Nothing yet — values arrive as the source publishes.</span></div>}
        {[...entries].reverse().map((e, i) => (
          <div className="lrow" key={i} style={{ gridTemplateColumns: "74px 1fr" }}>
            <span className="sz">{time(e.at)}</span>
            <span>{e.from.owner}:{e.from.port} → {e.to.owner}:{e.to.port} · <b style={{ color: "#ddd" }}>{fmt(e.value)}</b></span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {ownerIsApp && <button className="btn sm" onClick={() => { openWindow(watch.owner); focusWindow(watch.owner); }}>Focus {watch.owner}</button>}
        {cord && <button className="btn sm" onClick={() => removeCord(cord.id)}>Remove Cord</button>}
        <button className="btn sm" onClick={clearLog}>Clear Log</button>
        <button className="btn sm" onClick={() => setWatch(null)}>Stop Watching</button>
      </div>
      <StatusBar left="LIVE" right="PATCH VIEWER" />
    </>
  );
}
