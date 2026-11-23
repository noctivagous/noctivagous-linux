import { useEffect, useRef, useState } from "react";
import { store } from "../core/store.js";
import { publish } from "../core/patchbay.js";
import { StatusBar } from "./shared.jsx";

const PROCS = [["window-manager", 412], ["files", 688], ["terminal", 731], ["settings", 802], ["monitor", 915], ["dock", 388]];

export default function MonitorApp() {
  const [vals, setVals] = useState({ cpu: 30, mem: 62, disk: 50, netDown: "1.24", netUp: "0.31", temp: 54 });
  const [procs, setProcs] = useState(PROCS.map((p) => [...p, "0.0"]));
  const cvRef = useRef(null);
  const dataRef = useRef(null);
  if (!dataRef.current) {
    dataRef.current = Array.from({ length: 60 }, () => 30 + Math.random() * 25);
  }

  useEffect(() => {
    function draw() {
      const cv = cvRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      const data = dataRef.current;
      ctx.fillStyle = "#070707";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = "rgba(255,255,255,.07)";
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const y = 10 + g * 22;
        ctx.beginPath();
        ctx.moveTo(28, y);
        ctx.lineTo(cv.width - 6, y);
        ctx.stroke();
        ctx.fillStyle = "#666";
        ctx.font = "9px JetBrains Mono";
        ctx.fillText(String(100 - g * 25), 4, y + 3);
      }
      ctx.strokeStyle = "#5cb85c";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = 28 + i * ((cv.width - 36) / 59);
        const y = 98 - (v / 100) * 88;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
    function step() {
      const cpu = Math.round(28 + Math.random() * 38);
      const mem = Math.round(48 + Math.random() * 14);
      const disk = Math.round(36 + Math.random() * 10);
      setVals({
        cpu, mem, disk,
        netDown: (0.6 + Math.random() * 1.4).toFixed(2),
        netUp: (0.1 + Math.random() * 0.5).toFixed(2),
        temp: Math.round(50 + Math.random() * 9),
      });
      setProcs(PROCS.map((p) => [p[0], p[1], (Math.random() * 9).toFixed(1)]));
      dataRef.current.push(cpu);
      dataRef.current.shift();
      draw();
      // The desktop widget (W-02) reads the same samples — the shell
      // subscribes to this slice rather than sampling twice.
      store.set("ui", { load: { cpu, mem, net: Math.round(12 + Math.random() * 30) } });
      publish("monitor", "cpu", cpu);
    }
    step();
    const iv = setInterval(step, 900);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      <div className="cap" style={{ marginBottom: 9 }}>Live · sampling 500 ms</div>
      {[["CPU", vals.cpu, ""], ["Memory", vals.mem, " blue"], ["Disk", vals.disk, " amber"]].map(([n, v, cls]) => (
        <div className="prow" key={n}>
          <span>{n}</span>
          <div className={"meter" + cls}><i style={{ width: v + "%" }}></i></div>
          <span className="pv">{v}%</span>
        </div>
      ))}
      <div className="cap" style={{ margin: "10px 0 6px" }}>Value plotter · CPU %</div>
      <canvas className="plot" ref={cvRef} width="480" height="110"></canvas>
      <div className="cap" style={{ margin: "10px 0 6px" }}>Processes</div>
      <div className="listbox" style={{ maxHeight: 118 }}>
        <div className="listhead" style={{ gridTemplateColumns: "1fr 74px 92px" }}>
          <span>Process</span><span>PID</span><span>CPU</span>
        </div>
        <div>
          {procs.map((p) => (
            <div className="lrow" key={p[0]} style={{ gridTemplateColumns: "1fr 74px 92px" }}>
              <span>{p[0]}</span><span className="sz">{p[1]}</span><span className="tp">{p[2]}%</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontFamily: "var(--font-m)", fontSize: 11, color: "#9a9a9a", flexWrap: "wrap" }}>
        <span>NET ↓ <b style={{ color: "#ddd" }}>{vals.netDown} MB/s</b></span>
        <span>NET ↑ <b style={{ color: "#ddd" }}>{vals.netUp} MB/s</b></span>
        <span>TEMP <b style={{ color: "#ddd" }}>{vals.temp}°C</b></span>
      </div>
      <StatusBar left="SAMPLING" right="LOAD AVG 0.42" />
    </>
  );
}
