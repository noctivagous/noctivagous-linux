import { useSlice } from "../core/react.js";
import { StatusBar } from "./shared.jsx";

export default function AboutApp() {
  const session = useSlice("session");
  const ui = useSlice("ui");
  return (
    <>
      <div style={{ textAlign: "center", padding: "4px 0 10px" }}>
        <div className="avatar" style={{ margin: "0 auto 8px" }}>N</div>
        <div style={{ fontFamily: "var(--font-d)", fontWeight: 700, letterSpacing: ".2em", fontSize: 17, color: "#f0f0f0" }}>NOCTIVAGOUS</div>
        <div className="mono" style={{ fontSize: 10.5, color: "#888", letterSpacing: ".14em", marginTop: 4 }}>DESKTOP ENVIRONMENT</div>
      </div>
      <div className="group">
        <h4>System <span className="idx">01</span></h4>
        <dl className="kv">
          <dt>VERSION</dt><dd>4.2.0 (build 2026.11)</dd>
          <dt>KERNEL</dt><dd>6.8-NCT</dd>
          <dt>SESSION</dt><dd>{session.sessionType}</dd>
          <dt>DISPLAY</dt><dd>:0 · Window manager 2.1</dd>
          <dt>USER</dt><dd>{session.user}</dd>
        </dl>
      </div>
      <div className="group">
        <h4>Hardware <span className="idx">02</span></h4>
        <dl className="kv">
          <dt>MEMORY</dt><dd>16 GB</dd>
          <dt>DISK</dt><dd>512 GB · 61% free</dd>
          <dt>BATTERY</dt><dd>{ui.battery}% · discharging</dd>
        </dl>
        <div className="cap" style={{ margin: "10px 0 5px" }}>Disk used</div>
        <div className="meter amber"><i style={{ width: "39%" }}></i></div>
      </div>
      <StatusBar left="READY" right="SYSINFO 4.2" />
    </>
  );
}
