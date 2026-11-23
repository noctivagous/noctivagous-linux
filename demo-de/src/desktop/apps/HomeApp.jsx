import { useEffect, useState } from "react";
import { useSlice } from "../core/react.js";
import { openApp } from "../core/bus.js";
import { publish, onDeliver } from "../core/patchbay.js";
import { StatusBar, pad } from "./shared.jsx";

export default function HomeApp() {
  const session = useSlice("session");
  const [up, setUp] = useState("00:00");
  const [status, setStatus] = useState("READY");
  useEffect(() => {
    publish("home", "user", session.user);
    return onDeliver("home", "status", (v) => setStatus(String(v)));
  }, []);
  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setUp(pad(Math.floor(s / 60)) + ":" + pad(s % 60));
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <>
      <div className="cap" style={{ marginBottom: 8 }}>Home · 01</div>
      <div style={{ fontFamily: "var(--font-d)", fontSize: 19, fontWeight: 600, color: "#eee", letterSpacing: ".04em", marginBottom: 6 }}>
        Welcome, {session.user}
      </div>
      <p style={{ color: "#a9a9a9", lineHeight: 1.6, margin: "4px 0 10px" }}>
        {session.sessionType} session on NOCTIVAGOUS. Home is mounted and the window manager is running.
      </p>
      <div className="group">
        <h4>Session <span className="idx">01</span></h4>
        <dl className="kv">
          <dt>USER</dt><dd>{session.user}</dd>
          <dt>SESSION</dt><dd>{session.sessionType}</dd>
          <dt>DISPLAY</dt><dd>:0 · 60 Hz</dd>
          <dt>UPTIME</dt><dd className="mono">{up}</dd>
        </dl>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <button className="btn sm" data-open="files" onClick={() => openApp("files")}>Open Files</button>
        <button className="btn sm" data-open="terminal" onClick={() => openApp("terminal")}>Open Terminal</button>
        <button className="btn sm" data-open="settings" onClick={() => openApp("settings")}>Settings</button>
      </div>
      <StatusBar left={status} right={"SESSION · " + session.sessionType.toUpperCase()} />
    </>
  );
}
