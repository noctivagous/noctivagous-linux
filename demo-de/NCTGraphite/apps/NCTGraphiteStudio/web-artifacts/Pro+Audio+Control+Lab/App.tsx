import React, { useEffect, useRef, useState, useMemo } from "react";

const categories = [
  { id: "range1d", label: "RANGE 1D", icon: "◫" },
  { id: "range2d", label: "RANGE 2D", icon: "⊞" },
  { id: "toggles", label: "TOGGLES & GATES", icon: "◍" },
  { id: "lists", label: "LISTS & SELECTION", icon: "☰" },
  { id: "sequencer", label: "SEQUENCER GRIDS", icon: "▦" },
  { id: "curves", label: "CURVE EDITORS", icon: "∿" },
  { id: "meters", label: "METERS & DISPLAYS", icon: "▌" },
  { id: "mod", label: "MOD & PATCHING", icon: "⎔" },
] as const;

function useDrag1D(initial = 0.5) {
  const [val, setVal] = useState(initial);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const ref = useRef<HTMLDivElement>(null);

  const onDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = val;
    e.preventDefault();
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const delta = (startY.current - e.clientY) / (rect.height || 200);
      let nv = startVal.current + delta;
      nv = Math.max(0, Math.min(1, nv));
      setVal(nv);
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);
  return { val, setVal, onDown, ref };
}

function ProCard({ title, subtitle, children, wide }: { title: string, subtitle: string, children: React.ReactNode, wide?: boolean }) {
  return (
    <div className={`panel-gradient rounded-[8px] overflow-hidden gloss-overlay ${wide ? "col-span-2" : ""}`} style={{ minWidth: 0 }}>
      <div className="px-3 py-[9px] flex flex-col gap-[2px] border-b border-black/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.1))] ">
        <div className="emboss-label leading-none">{title}</div>
        <div className="text-[10px] leading-[1.2] text-[#8a8d90] font-normal normal-case tracking-normal" style={{ textTransform: "none" }}>{subtitle}</div>
      </div>
      <div className="p-3">
        <div className="inset-well rounded-[6px] p-4 flex flex-col items-center justify-center min-h-[180px] relative">
          <div className="absolute inset-0 rounded-[6px] pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 30%)" }} />
          {children}
        </div>
      </div>
    </div>
  );
}

/* RANGE 1D CONTROLS */
function TallFrameSlider() {
  const [v, setV] = useState(0.68);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(v);
  const trackRef = useRef<HTMLDivElement>(null);

  const dB = useMemo(() => {
    if (v < 0.03) return "-∞";
    const db = (v - 0.75) * 40; // 0.75 => 0dB, 1 => +10? tweak
    const val = (v * 80 - 60);
    if (val <= -60) return "-∞";
    return (val > 0 ? "+" : "") + val.toFixed(1) + " dB";
  }, [v]);

  const onDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = v;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (startY.current - e.clientY) / 200;
      let nv = startVal.current + delta;
      nv = Math.max(0, Math.min(1, nv));
      setV(nv);
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <div className="w-[36px] h-[220px] rounded-[4px] bg-[#151618] border border-[#0a0a0a] p-[3px] shadow-[inset_0_1px_2px_black] relative">
          <div ref={trackRef} className="w-full h-full bg-[#0c0c0d] rounded-[2px] relative inset-well overflow-hidden border border-black/80">
            {/* ticks */}
            <div className="absolute left-[4px] top-[8px] bottom-[8px] w-[2px] bg-[#222] rounded" />
            <div className="absolute left-0 right-0 top-[45%] h-[1px] bg-[#3a3d41]" />
            <div
              className="absolute left-[2px] right-[2px] h-[34px] rounded-[3px] cursor-ns-resize select-none"
              style={{
                bottom: `${v * 100}%`,
                transform: "translateY(50%)",
                background: "linear-gradient(180deg, #3a3d40 0%, #2a2c2e 20%, #1e1f21 50%, #2e3033 100%)",
                border: "1px solid #4a4d50",
                borderTopColor: "#6a6e73",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.8)",
                top: "auto",
              }}
              onMouseDown={onDown}
            >
              <div className="absolute inset-[1px] rounded-[2px]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.02) 45%, rgba(0,0,0,0.15) 100%)" }} />
              <div className="absolute left-[6px] right-[6px] top-[50%] h-[1px] bg-[#111] shadow-[0_1px_0_rgba(255,255,255,0.15)] -translate-y-[3px]" />
              <div className="absolute left-[6px] right-[6px] top-[50%] h-[1px] bg-[#111] shadow-[0_1px_0_rgba(255,255,255,0.15)] translate-y-[2px]" />
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between py-1">
          <div className="text-[9px] mono text-[#5a5c5e]">+6</div>
          <div className="text-[9px] mono text-[#5a5c5e]">0</div>
          <div className="text-[9px] mono text-[#5a5c5e]">-12</div>
          <div className="text-[9px] mono text-[#5a5c5e]">-∞</div>
        </div>
      </div>
      <div className="mono text-[10px] px-2 py-1 rounded bg-black/60 text-[#9ec6ff] border border-[#1e2a3d]">{dB}</div>
    </div>
  );
}

function KnobOnTopSlider() {
  const [v, setV] = useState(0.33);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startVal = useRef(v);
  const onDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startVal.current = v;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (e.clientX - startX.current) / 180;
      let nv = startVal.current + delta;
      nv = Math.max(0, Math.min(1, nv));
      setV(nv);
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);
  return (
    <div className="w-[240px] flex flex-col gap-4 py-6">
      <div className="relative h-[36px]">
        <div className="absolute left-2 right-2 top-[50%] h-[4px] -translate-y-1/2 rounded-full bg-[#0c0c0d] border border-black shadow-[inset_0_1px_2px_black]">
          <div className="absolute left-0 top-0 bottom-0 bg-[#2a4a7a] rounded-full" style={{ width: `${v * 100}%`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }} />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[28px] rounded-[4px] cursor-ew-resize"
          style={{
            left: `calc(${v * 100}% - 9px)`,
            background: "linear-gradient(180deg, #42464b 0%, #2c2e31 50%, #232528 100%)",
            border: "1px solid #55595e",
            borderTopColor: "#7a7e83",
            boxShadow: "0 2px 6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.35)",
          }}
          onMouseDown={onDown}
        >
          <div className="absolute inset-0 rounded-[3px]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 60%)" }} />
          <div className="absolute left-[50%] top-[6px] bottom-[6px] w-[1px] bg-black/70 -translate-x-1/2" />
        </div>
      </div>
      <div className="flex justify-between mono text-[10px] text-[#6a6c6e]">
        <span>TRIM -12</span><span className="text-[#a9b4c2]">{(v * 24 - 12).toFixed(1)} dB</span><span>+12</span>
      </div>
    </div>
  );
}

function RotaryKnob({ variant, label }: { variant: "endless" | "detented" | "bipolar", label: string }) {
  const [v, setV] = useState(variant === "bipolar" ? 0.5 : 0.65);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(v);

  const onDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = v;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (startY.current - e.clientY) / 180;
      let nv = startVal.current + delta;
      if (variant === "detented") {
        nv = Math.round(nv * 12) / 12;
      }
      if (variant === "endless") {
        nv = ((nv % 1) + 1) % 1;
      } else {
        nv = Math.max(0, Math.min(1, nv));
      }
      setV(nv);
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [variant]);

  const angle = variant === "bipolar" ? (v - 0.5) * 300 : (v * 300 - 150);
  const displayVal = variant === "bipolar" ? ((v - 0.5) * 100).toFixed(0) : Math.round(v * 127);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-[72px] h-[72px] rounded-full"
        style={{
          background: "radial-gradient(120% 120% at 30% 20%, #4a4e53 0%, #2a2c2e 45%, #1a1b1d 100%)",
          border: "1px solid #3a3c3f",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 3px 8px rgba(0,0,0,0.7)",
        }}
        onMouseDown={onDown}
      >
        {/* LED ring */}
        <div className="absolute inset-0 rounded-full">
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * 300 - 150;
            const active = variant === "bipolar"
              ? (v > 0.5 ? i >= 12 && i <= 12 + (v - 0.5) * 24 : i <= 12 && i >= 12 - (0.5 - v) * 24)
              : (i / 24) <= v;
            return (
              <div key={i} className="absolute w-[3px] h-[3px] rounded-full left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%,-50%) rotate(${a}deg) translateY(-29px)`,
                  background: active ? "#4a8af4" : "#222326",
                  boxShadow: active ? "0 0 4px #4a8af4" : "inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              />
            );
          })}
        </div>
        <div className="absolute inset-[10px] rounded-full bg-[#151617] border border-black shadow-[inset_0_2px_4px_black] flex items-center justify-center">
          <div className="w-[2px] h-[22px] bg-[#c8d8ff] rounded-full origin-bottom"
            style={{ transform: `translateY(-6px) rotate(${angle}deg)`, boxShadow: "0 0 6px #7aa4ff" }}
          />
          <div className="absolute w-[6px] h-[6px] rounded-full bg-[#2a2c2e] border border-[#444] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]" />
        </div>
      </div>
      <div className="flex flex-col items-center">
        <div className="emboss-label text-[9px]">{label}</div>
        <div className="mono text-[10px] text-[#9ec6ff] bg-black/60 px-1.5 rounded border border-[#1e2a3d]">{variant === "bipolar" ? (displayVal as any) : displayVal}</div>
        <div className="text-[8px] mono text-[#5a5c5e] mt-1 uppercase">{variant}</div>
      </div>
    </div>
  );
}

function DualRange() {
  const [min, setMin] = useState(0.22);
  const [max, setMax] = useState(0.78);
  const dragRef = useRef<"min" | "max" | null>(null);

  const onDown = (which: "min" | "max") => (e: React.MouseEvent) => {
    dragRef.current = which;
    (e.target as any)._sx = e.clientX;
    (e.target as any)._sv = which === "min" ? min : max;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = (e.clientX - (window as any)._lastX) / 200; // fallback
      const width = 240;
      const d = (e as any).movementX / width || 0;
      if (dragRef.current === "min") {
        let nv = min + d;
        nv = Math.max(0, Math.min(max - 0.05, nv));
        setMin(nv);
      } else {
        let nv = max + d;
        nv = Math.max(min + 0.05, Math.min(1, nv));
        setMax(nv);
      }
    };
    const mm = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const track = document.getElementById("dual-track");
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      if (dragRef.current === "min") {
        let nv = Math.max(0, Math.min(max - 0.05, pct));
        setMin(nv);
      } else {
        let nv = Math.max(min + 0.05, Math.min(1, pct));
        setMax(nv);
      }
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", up); };
  }, [min, max]);

  return (
    <div className="w-[260px] py-4">
      <div id="dual-track" className="relative h-[28px]">
        <div className="absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full inset-well" />
        <div className="absolute top-1/2 h-[6px] -translate-y-1/2 bg-[#2f5aa0] rounded-full" style={{ left: `${min * 100}%`, right: `${100 - max * 100}%`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[22px] rounded-[3px] bg-[#3a3d41] border border-[#5a5d61] shadow-[0_2px_4px_black] cursor-ew-resize"
          style={{ left: `calc(${min * 100}% - 7px)` }} onMouseDown={onDown("min")} />
        <div className="absolute top-1/2 -translate-y-1/2 w-[14px] h-[22px] rounded-[3px] bg-[#3a3d41] border border-[#5a5d61] shadow-[0_2px_4px_black] cursor-ew-resize"
          style={{ left: `calc(${max * 100}% - 7px)` }} onMouseDown={onDown("max")} />
      </div>
      <div className="flex justify-between mono text-[10px] text-[#7a7c7e] mt-2">
        <span>LOOP START {Math.round(min * 127)}</span><span>END {Math.round(max * 127)}</span>
      </div>
    </div>
  );
}

function FaderBank() {
  const [vals, setVals] = useState<number[]>([0.7, 0.55, 0.82, 0.4, 0.65, 0.73, 0.5, 0.9]);
  const dragIdx = useRef<number | null>(null);
  const startY = useRef(0);
  const startVal = useRef(0);

  const onDown = (i: number) => (e: React.MouseEvent) => {
    dragIdx.current = i;
    startY.current = e.clientY;
    startVal.current = vals[i];
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragIdx.current === null) return;
      const delta = (startY.current - e.clientY) / 120;
      let nv = startVal.current + delta;
      nv = Math.max(0, Math.min(1, nv));
      setVals(v => { const c = [...v]; c[dragIdx.current!] = nv; return c; });
    };
    const up = () => { dragIdx.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  return (
    <div className="flex gap-[10px]">
      {vals.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="w-[18px] h-[120px] bg-[#0c0c0d] rounded-[2px] border border-black relative inset-well">
            <div className="absolute left-1/2 top-2 bottom-2 w-[2px] -translate-x-1/2 bg-[#222]" />
            <div className="absolute left-[2px] right-[2px] h-[16px] rounded-[2px] bg-[#3a3d41] border border-[#5a5d61] cursor-ns-resize"
              style={{ bottom: `${v * 100}%`, transform: "translateY(50%)", boxShadow: "0 1px 3px black" }}
              onMouseDown={onDown(i)}
            />
          </div>
          <div className="mono text-[8px] text-[#5a5c5e]">{i + 1}</div>
        </div>
      ))}
    </div>
  );
}

/* RANGE 2D */
function XYPad({ spring }: { spring?: boolean }) {
  const [pos, setPos] = useState({ x: 0.62, y: 0.38 });
  const [trail, setTrail] = useState<{ x: number, y: number }[]>([]);
  const dragging = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const updateFromEvent = (e: MouseEvent | React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = (e.clientY - rect.top) / rect.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    setPos({ x, y });
    setTrail(t => [...t.slice(-12), { x, y }]);
  };

  const onDown = (e: React.MouseEvent) => {
    dragging.current = true;
    updateFromEvent(e);
  };
  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) updateFromEvent(e); };
    const up = () => {
      dragging.current = false;
      if (spring) {
        // spring back animation
        const start = { ...pos };
        let p = 0;
        const animate = () => {
          p += 0.12;
          if (p >= 1) { setPos({ x: 0.5, y: 0.5 }); return; }
          setPos({ x: start.x + (0.5 - start.x) * p, y: start.y + (0.5 - start.y) * p });
          requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [pos, spring]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} className="w-[240px] h-[240px] rounded-[6px] inset-well relative overflow-hidden cursor-crosshair select-none"
        onMouseDown={onDown}
      >
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(#2a2a2a 1px, transparent 1px), linear-gradient(90deg, #2a2a2a 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        {/* crosshair */}
        <div className="absolute bg-[#2a3a5a]/60" style={{ left: `${pos.x * 100}%`, top: 0, bottom: 0, width: "1px" }} />
        <div className="absolute bg-[#2a3a5a]/60" style={{ top: `${pos.y * 100}%`, left: 0, right: 0, height: "1px" }} />
        {/* trails */}
        {trail.map((t, i) => (
          <div key={i} className="absolute w-[4px] h-[4px] rounded-full bg-[#4a8af4] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, opacity: (i / trail.length) * 0.6 }} />
        ))}
        {/* dot */}
        <div className="absolute w-[14px] h-[14px] rounded-full -translate-x-1/2 -translate-y-1/2 border border-[#8ab4ff] bg-[#4a8af4] shadow-[0_0_10px_#4a8af4,0_0_2px_white]"
          style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }} />
        <div className="absolute left-2 top-2 mono text-[8px] text-[#5a6a8a]">CUTOFF</div>
        <div className="absolute right-2 bottom-2 mono text-[8px] text-[#5a6a8a] rotate-[-90deg] origin-bottom-right">RESO</div>
      </div>
      <div className="flex gap-3 mono text-[10px] text-[#7a8ab0]">
        <span>X:{Math.round(pos.x * 127)}</span><span>Y:{Math.round((1 - pos.y) * 127)}</span>
        <span className="text-[#4a8af4]">{spring ? "JOYSTICK·SPRING" : "VECTOR PAD"}</span>
      </div>
    </div>
  );
}

function Matrix2D() {
  const [points, setPoints] = useState(() => Array.from({ length: 64 }, (_, i) => ({
    x: 0.2 + Math.random() * 0.6,
    y: 0.2 + Math.random() * 0.6,
  })));
  const drag = useRef<number | null>(null);

  const onDown = (idx: number) => (e: React.MouseEvent) => {
    drag.current = idx;
    e.stopPropagation();
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (drag.current === null) return;
      const idx = drag.current;
      const cell = document.getElementById(`mcell-${idx}`);
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      let x = (e.clientX - rect.left) / rect.width;
      let y = (e.clientY - rect.top) / rect.height;
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      setPoints(p => { const c = [...p]; c[idx] = { x, y }; return c; });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="grid grid-cols-8 gap-[1px] p-[2px] bg-black rounded-[4px] border border-[#111]">
        {points.map((pt, i) => (
          <div key={i} id={`mcell-${i}`} className="w-[28px] h-[28px] bg-[#151517] relative overflow-hidden">
            <div className="absolute w-[6px] h-[6px] rounded-full bg-[#4a8af4] shadow-[0_0_6px_#4a8af4] -translate-x-1/2 -translate-y-1/2 cursor-move"
              style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%` }}
              onMouseDown={onDown(i)}
            />
          </div>
        ))}
      </div>
      <div className="mono text-[9px] text-[#5a5c5e]">8×8 WAVETABLE POSITION MATRIX · DRAG PER-CELL VECTOR</div>
    </div>
  );
}

/* TOGGLES */
function CheckboxOld() {
  const [c, setC] = useState(true);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[20px] h-[20px] rounded-[3px] bg-[#0f0f10] border border-black shadow-[inset_0_1px_2px_black] flex items-center justify-center cursor-pointer"
        onClick={() => setC(!c)}
      >
        {c && <div className="w-[12px] h-[12px] rounded-[1px] bg-[#4a8af4] shadow-[0_0_6px_#4a8af4]"> <div className="w-full h-full flex items-center justify-center text-[10px] text-white">✓</div> </div>}
      </div>
      <div className="emboss-label text-[8px]">ENABLE</div>
    </div>
  );
}
function LEDButton() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-[48px] h-[28px] rounded-[4px] border cursor-pointer flex items-center justify-center transition-all ${on ? "bg-[#1a2a4a] border-[#4a8af4] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_12px_rgba(74,138,244,0.5)]" : "bg-[#202224] border-[#3a3c3f] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"}`}
        onClick={() => setOn(!on)}
      >
        <div className={`w-[10px] h-[10px] rounded-full ${on ? "bg-[#7ab0ff] shadow-[0_0_8px_#4a8af4]" : "bg-[#2a2c2e] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"}`} />
      </div>
      <div className="emboss-label text-[8px]">{on ? "ARMED" : "OFF"}</div>
    </div>
  );
}
function DrumPad() {
  const [held, setHeld] = useState(false);
  const [vel, setVel] = useState(0.8);
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-[56px] h-[56px] rounded-[6px] border flex items-center justify-center cursor-pointer select-none transition-all ${held ? "bg-[#2a3a5a] border-[#6aa2ff] scale-[0.96] shadow-[0_0_18px_rgba(74,138,244,0.6),inset_0_2px_0_rgba(255,255,255,0.15)]" : "bg-[#222426] border-[#3a3c3f] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_6px_black]"}`}
        onMouseDown={(e) => {
          const rect = (e.currentTarget as any).getBoundingClientRect();
          const cy = rect.top + rect.height / 2;
          const dist = Math.abs(e.clientY - cy) / (rect.height / 2);
          setVel(1 - dist * 0.5);
          setHeld(true);
        }}
        onMouseUp={() => setHeld(false)}
        onMouseLeave={() => setHeld(false)}
      >
        <div className={`w-[34px] h-[34px] rounded-[4px] ${held ? "bg-[#4a8af4]" : "bg-[#2e3033]"} shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]`} style={{ opacity: held ? vel : 0.6 }} />
      </div>
      <div className="mono text-[8px] text-[#5a5c5e]">VEL {Math.round(vel * 127)}</div>
    </div>
  );
}
function RockerSwitch() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[32px] h-[48px] rounded-[6px] bg-[#1a1b1d] border border-black p-[2px] inset-well cursor-pointer" onClick={() => setOn(!on)}>
        <div className={`w-full h-[50%] rounded-[4px] transition-all flex items-center justify-center ${on ? "translate-y-[100%] bg-[#4a8af4] shadow-[0_0_8px_#4a8af4]" : "bg-[#2a2c2e] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"}`}>
          <div className="w-[14px] h-[2px] bg-black/50 rounded" />
        </div>
      </div>
      <div className="emboss-label text-[8px]">{on ? "ON" : "OFF"}</div>
    </div>
  );
}
function SoloMuteRec() {
  const [s, setS] = useState({ solo: false, mute: false, rec: false });
  return (
    <div className="flex gap-1">
      {[
        { k: "solo", l: "S", col: "#f2c94c", active: s.solo },
        { k: "mute", l: "M", col: "#9a9c9e", active: s.mute },
        { k: "rec", l: "R", col: "#ff4a3d", active: s.rec },
      ].map(btn => (
        <div key={btn.k} className="flex flex-col items-center gap-1">
          <div className={`w-[22px] h-[18px] rounded-[3px] border text-[10px] font-bold flex items-center justify-center cursor-pointer mono ${btn.active ? "text-black" : "text-[#6a6c6e] bg-[#202224] border-[#3a3c3f]"}`}
            style={btn.active ? { background: btn.col, borderColor: btn.col, boxShadow: `0 0 8px ${btn.col}` } : {}}
            onClick={() => setS(v => ({ ...v, [btn.k]: !v[btn.k as keyof typeof v] }))}
          >
            {btn.l}
          </div>
        </div>
      ))}
    </div>
  );
}
function RadioGroup() {
  const [sel, setSel] = useState(1);
  return (
    <div className="flex flex-col gap-1">
      {["MONO", "STEREO", "MID-SIDE"].map((l, i) => (
        <div key={l} className="flex items-center gap-2 cursor-pointer" onClick={() => setSel(i)}>
          <div className={`w-[14px] h-[14px] rounded-full border flex items-center justify-center ${sel === i ? "bg-[#1a2a4a] border-[#4a8af4]" : "bg-[#151516] border-[#333]"}`}>
            {sel === i && <div className="w-[6px] h-[6px] rounded-full bg-[#4a8af4] shadow-[0_0_6px_#4a8af4]" />}
          </div>
          <div className={`text-[10px] mono ${sel === i ? "text-[#9ec6ff]" : "text-[#6a6c6e]"}`}>{l}</div>
        </div>
      ))}
    </div>
  );
}

/* LISTS */
function SegmentedSingle() {
  const opts = ["SINE", "SAW", "SQUARE", "NOISE"];
  const [sel, setSel] = useState(1);
  return (
    <div className="flex rounded-[6px] overflow-hidden border border-black bg-[#0f0f10] shadow-[inset_0_1px_2px_black]">
      {opts.map((o, i) => (
        <div key={o} className={`px-3 py-1.5 text-[10px] mono cursor-pointer border-r border-black last:border-r-0 transition-all ${sel === i ? "bg-[#2a4a7a] text-[#a9c6ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_10px_rgba(74,138,244,0.4)]" : "bg-[#202224] text-[#7a7c7e] hover:bg-[#26282b]"}`} onClick={() => setSel(i)}>{o}</div>
      ))}
    </div>
  );
}
function SegmentedMulti() {
  const opts = ["C", "E", "G", "Bb"];
  const [sel, setSel] = useState<boolean[]>([true, false, true, false]);
  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="flex rounded-[6px] overflow-hidden border border-black bg-[#0f0f10] shadow-[inset_0_1px_2px_black]">
        {opts.map((o, i) => (
          <div key={o} className={`px-3 py-1.5 text-[10px] mono cursor-pointer border-r border-black last:border-r-0 ${sel[i] ? "bg-[#2a4a7a] text-[#a9c6ff] shadow-[0_0_8px_rgba(74,138,244,0.4)]" : "bg-[#202224] text-[#7a7c7e]"}`} onClick={() => setSel(s => { const c = [...s]; c[i] = !c[i]; return c; })}>{o}</div>
        ))}
      </div>
      <div className="mono text-[9px] text-[#5a5c5e]">CHORD MODE · MULTI SELECT ALLOWED</div>
    </div>
  );
}
function ListBox() {
  const items = ["Analog Pad", "FM Bell", "Wavetable Lead", "Granular Cloud", "Vintage Keys", "Sub Bass", "Pluck Arp", "Noise Sweep"];
  const [sel, setSel] = useState(2);
  return (
    <div className="w-[200px] h-[120px] rounded-[4px] bg-[#0f0f10] border border-black overflow-auto shadow-[inset_0_1px_3px_black]">
      {items.map((it, i) => (
        <div key={it} className={`px-3 py-[5px] text-[11px] cursor-pointer mono ${sel === i ? "bg-[#2a4a7a] text-[#cfe0ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" : "text-[#7a7c7e] hover:bg-[#1e1f21]"}`} onClick={() => setSel(i)}>{it}</div>
      ))}
    </div>
  );
}
function Dropdown() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState("24 dB/Oct");
  const opts = ["6 dB/Oct", "12 dB/Oct", "24 dB/Oct", "48 dB/Oct"];
  return (
    <div className="relative">
      <div className="w-[160px] h-[26px] rounded-[4px] panel-gradient border border-[#3a3c3f] flex items-center justify-between px-3 cursor-pointer shadow-[0_1px_3px_black]" onClick={() => setOpen(!open)}>
        <span className="mono text-[11px] text-[#c8cacc]">{sel}</span>
        <span className="text-[10px] text-[#6a6c6e]">▼</span>
      </div>
      {open && (
        <div className="absolute top-[30px] left-0 w-[160px] rounded-[4px] bg-[#1e1f21] border border-black shadow-[0_6px_16px_black] z-10 overflow-hidden">
          {opts.map(o => (
            <div key={o} className="px-3 py-1.5 text-[11px] mono cursor-pointer flex justify-between hover:bg-[#2a4a7a] hover:text-[#cfe0ff] text-[#8a8c8e]" onClick={() => { setSel(o); setOpen(false); }}>
              <span>{o}</span>{sel === o && <span>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function MatrixButtons() {
  const [sel, setSel] = useState<number | null>(5);
  return (
    <div className="grid grid-cols-4 gap-[3px]">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className={`w-[44px] h-[28px] rounded-[3px] border text-[9px] mono flex items-center justify-center cursor-pointer ${sel === i ? "bg-[#2a4a7a] border-[#4a8af4] text-[#a9c6ff] shadow-[0_0_8px_rgba(74,138,244,0.4)]" : "bg-[#202224] border-[#333] text-[#6a6c6e]"}`} onClick={() => setSel(i)}>F{i + 1}</div>
      ))}
    </div>
  );
}
function TabStrip() {
  const tabs = ["EDIT", "MIX", "MOD", "FX"];
  const [sel, setSel] = useState(0);
  return (
    <div className="flex flex-col w-[260px]">
      <div className="flex gap-[2px]">
        {tabs.map((t, i) => (
          <div key={t} className={`px-3 py-1.5 rounded-t-[4px] text-[10px] mono cursor-pointer border border-b-0 ${sel === i ? "bg-[#2d2e30] text-[#c8cacc] border-[#43464b] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" : "bg-[#1a1b1d] text-[#5a5c5e] border-black mt-1"}`} onClick={() => setSel(i)}>{t}</div>
        ))}
      </div>
      <div className="h-[60px] rounded-b-[4px] rounded-tr-[4px] bg-[#2d2e30] border border-[#43464b] flex items-center justify-center mono text-[10px] text-[#7a7c7e]">CONTENT: {tabs[sel]}</div>
    </div>
  );
}

/* SEQUENCER */
function TRSequencer() {
  const rows = ["KICK", "SNARE", "CLAP", "HIHAT", "OPEN", "TOM L", "TOM H", "PERC"];
  const [grid, setGrid] = useState(() => Array.from({ length: 8 }, () => Array.from({ length: 16 }, () => Math.random() > 0.75 ? 1 : 0)));
  const [playhead, setPlayhead] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPlayhead(p => (p + 1) % 16), 125);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex">
        <div className="w-[54px] flex flex-col gap-[3px] pt-[2px]">
          {rows.map(r => <div key={r} className="h-[22px] flex items-center justify-end pr-2 mono text-[8px] text-[#6a6c6e]">{r}</div>)}
        </div>
        <div className="grid grid-cols-16 gap-[2px]">
          {grid.map((row, ri) => row.map((cell, ci) => (
            <div key={`${ri}-${ci}`} className={`w-[22px] h-[22px] rounded-[3px] border cursor-pointer relative ${playhead === ci ? "ring-1 ring-[#4a8af4]/60" : ""} ${cell ? "bg-[#2a4a7a] border-[#4a8af4] shadow-[0_0_8px_rgba(74,138,244,0.5),inset_0_1px_0_rgba(255,255,255,0.2)]" : "bg-[#151517] border-[#222] hover:bg-[#1e1f21]"}`}
              onClick={() => setGrid(g => { const c = g.map(r => [...r]); c[ri][ci] = c[ri][ci] ? 0 : 1; return c; })}
            >
              {playhead === ci && <div className="absolute inset-0 bg-[#4a8af4]/10 pointer-events-none" />}
              {cell ? <div className="absolute inset-[4px] rounded-[1px] bg-[#7ab0ff] shadow-[0_0_4px_#4a8af4]" /> : null}
            </div>
          )))}
        </div>
      </div>
      <div className="flex gap-1 px-[54px]">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className={`w-[22px] h-[3px] rounded-full ${playhead === i ? "bg-[#4a8af4] shadow-[0_0_6px_#4a8af4]" : "bg-[#222]"}`} />
        ))}
      </div>
    </div>
  );
}
function PianoRollMini() {
  const [notes, setNotes] = useState(() => [
    { id: 1, step: 0, pitch: 3, len: 2 },
    { id: 2, step: 4, pitch: 5, len: 3 },
    { id: 3, step: 8, pitch: 2, len: 1 },
    { id: 4, step: 10, pitch: 7, len: 2 },
  ]);
  return (
    <div className="flex flex-col gap-1">
      <div className="w-[320px] h-[144px] bg-[#0f0f10] border border-black rounded-[4px] grid grid-cols-16 grid-rows-12 gap-px p-px">
        {Array.from({ length: 12 }).flatMap((_, pitch) => Array.from({ length: 16 }).map((_, step) => {
          const note = notes.find(n => n.pitch === pitch && step >= n.step && step < n.step + n.len);
          return (
            <div key={`${pitch}-${step}`} className={`relative ${note ? "bg-[#2a4a7a]" : pitch % 2 === 0 ? "bg-[#151516]" : "bg-[#121214]"} hover:bg-[#1e1f21] cursor-pointer`}
              onClick={() => {
                if (note) setNotes(ns => ns.filter(n => n.id !== note.id));
                else setNotes(ns => [...ns, { id: Date.now() + Math.random(), step, pitch, len: 1 }]);
              }}
            >
              {note && step === note.step && <div className="absolute inset-[1px] bg-[#4a8af4] rounded-[1px] shadow-[0_0_4px_#4a8af4]" />}
            </div>
          );
        }))}
      </div>
      <div className="mono text-[9px] text-[#5a5c5e]">CLICK TO PLACE / REMOVE · PIANO ROLL 16×12</div>
    </div>
  );
}
function ClipLauncher() {
  const [active, setActive] = useState<number | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);
  const launch = (i: number) => {
    setPulse(i);
    setActive(i);
    setTimeout(() => setPulse(null), 300);
  };
  return (
    <div className="grid grid-cols-4 gap-[4px]">
      {Array.from({ length: 16 }).map((_, i) => (
        <div key={i} className={`w-[48px] h-[36px] rounded-[4px] border flex items-center justify-center cursor-pointer text-[9px] mono ${active === i ? "bg-[#1a2a1a] border-[#3dd68c] text-[#3dd68c] shadow-[0_0_10px_rgba(61,214,140,0.4)]" : "bg-[#1a1b1d] border-[#333] text-[#5a5c5e]"} ${pulse === i ? "scale-95 bg-[#2a5a3a]" : ""}`} onClick={() => launch(i)}>
          CLIP {i + 1}
        </div>
      ))}
    </div>
  );
}

/* CURVE EDITORS */
function ADSREditor() {
  const [pts, setPts] = useState([
    { x: 0, y: 1 },
    { x: 0.18, y: 0.15 },
    { x: 0.38, y: 0.62 },
    { x: 0.72, y: 0.62 },
    { x: 1, y: 1 },
  ]);
  const dragIdx = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const onDown = (i: number) => (e: React.MouseEvent) => { dragIdx.current = i; e.stopPropagation(); };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragIdx.current === null || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      let x = (e.clientX - rect.left) / rect.width;
      let y = (e.clientY - rect.top) / rect.height;
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      const idx = dragIdx.current;
      if (idx === 0) return;
      setPts(p => { const c = [...p]; c[idx] = { x, y }; // keep order
        if (idx > 0) c[idx].x = Math.max(c[idx - 1].x + 0.02, c[idx].x);
        if (idx < c.length - 1) c[idx].x = Math.min(c[idx + 1].x - 0.02, c[idx].x);
        return c;
      });
    };
    const up = () => { dragIdx.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const pathD = useMemo(() => {
    let d = `M ${pts[0].x * 400} ${pts[0].y * 140} `;
    for (let i = 1; i < pts.length; i++) d += `L ${pts[i].x * 400} ${pts[i].y * 140} `;
    return d;
  }, [pts]);

  return (
    <div className="flex flex-col gap-2">
      <svg ref={svgRef} width={400} height={160} className="rounded-[4px] bg-[#0f0f10] border border-black">
        <defs>
          <linearGradient id="adsrFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4a8af4" stopOpacity={0.4} /><stop offset="100%" stopColor="#4a8af4" stopOpacity={0} /></linearGradient>
        </defs>
        {/* grid */}
        {Array.from({ length: 8 }).map((_, i) => <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={160} stroke="#1e1f21" strokeWidth={1} />)}
        {Array.from({ length: 4 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 40} x2={400} y2={i * 40} stroke="#1e1f21" strokeWidth={1} />)}
        <path d={`${pathD} L 400 140 L 0 140 Z`} fill="url(#adsrFill)" />
        <path d={pathD} fill="none" stroke="#4a8af4" strokeWidth={2} />
        {pts.map((p, i) => (
          <g key={i} onMouseDown={onDown(i)} className="cursor-move">
            <circle cx={p.x * 400} cy={p.y * 140} r={6} fill={i === 0 ? "#151517" : "#2a4a7a"} stroke="#7ab0ff" strokeWidth={i === 0 ? 1 : 2} />
          </g>
        ))}
        <text x={pts[1].x * 400} y={12} fill="#5a6a8a" fontSize={9} className="mono">A</text>
        <text x={pts[2].x * 400} y={12} fill="#5a6a8a" fontSize={9} className="mono">D</text>
        <text x={pts[3].x * 400} y={12} fill="#5a6a8a" fontSize={9} className="mono">S</text>
        <text x={pts[4].x * 400 - 10} y={12} fill="#5a6a8a" fontSize={9} className="mono">R</text>
      </svg>
      <div className="flex gap-3 mono text-[9px] text-[#5a5c5e]"><span>ATTACK {Math.round(pts[1].x * 2000)}ms</span><span>DECAY {Math.round((pts[2].x - pts[1].x) * 2000)}ms</span><span>SUSTAIN {Math.round((1 - pts[3].y) * 100)}%</span></div>
    </div>
  );
}
function EQCurve() {
  const [nodes, setNodes] = useState([
    { freq: 0.15, gain: 0.6 },
    { freq: 0.4, gain: 0.3 },
    { freq: 0.65, gain: 0.7 },
    { freq: 0.85, gain: 0.5 },
  ]);
  const dragIdx = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onDown = (i: number) => (e: React.MouseEvent) => { dragIdx.current = i; e.stopPropagation(); };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragIdx.current === null || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      let x = (e.clientX - rect.left) / rect.width;
      let y = (e.clientY - rect.top) / rect.height;
      x = Math.max(0.02, Math.min(0.98, x));
      y = Math.max(0.05, Math.min(0.95, y));
      setNodes(ns => { const c = [...ns]; c[dragIdx.current!] = { freq: x, gain: y }; return c; });
    };
    const up = () => { dragIdx.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  // build smooth curve through nodes
  const path = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => a.freq - b.freq);
    let d = `M 0 ${0.5 * 140} `;
    sorted.forEach((n, i) => {
      if (i === 0) d += `C ${n.freq * 400 * 0.5} ${0.5 * 140} ${n.freq * 400 * 0.8} ${n.gain * 140} ${n.freq * 400} ${n.gain * 140} `;
      else {
        const prev = sorted[i - 1];
        const cx = (prev.freq + n.freq) / 2 * 400;
        d += `C ${cx} ${prev.gain * 140} ${cx} ${n.gain * 140} ${n.freq * 400} ${n.gain * 140} `;
      }
    });
    d += `L 400 ${0.5 * 140}`;
    return d;
  }, [nodes]);

  return (
    <div className="flex flex-col gap-2">
      <svg ref={svgRef} width={400} height={160} className="rounded-[4px] bg-[#0f0f10] border border-black">
        {Array.from({ length: 5 }).map((_, i) => <line key={i} x1={i * 80} y1={0} x2={i * 80} y2={160} stroke="#1a1b1d" strokeDasharray="2 4" />)}
        <line x1={0} y1={70} x2={400} y2={70} stroke="#2a2c2e" strokeWidth={1} />
        <path d={path} fill="none" stroke="#4a8af4" strokeWidth={2} />
        <path d={`${path} L 400 140 L 0 140 Z`} fill="#4a8af4" fillOpacity={0.12} />
        {nodes.map((n, i) => (
          <g key={i} onMouseDown={onDown(i)} className="cursor-move">
            <circle cx={n.freq * 400} cy={n.gain * 140} r={8} fill="#1a2a4a" stroke="#4a8af4" strokeWidth={2} />
            <text x={n.freq * 400} y={n.gain * 140 - 12} textAnchor="middle" fill="#7ab0ff" fontSize={8} className="mono">{Math.round(20 * Math.pow(1000, n.freq))}Hz</text>
          </g>
        ))}
        <text x={8} y={152} fill="#3a3c3f" fontSize={8} className="mono">20Hz</text><text x={360} y={152} fill="#3a3c3f" fontSize={8} className="mono">20kHz</text>
      </svg>
    </div>
  );
}
function AutomationCurve() {
  const [pts, setPts] = useState([
    { x: 0.05, y: 0.7, hx: 0.1, hy: 0 },
    { x: 0.35, y: 0.3, hx: -0.08, hy: 0.15 },
    { x: 0.7, y: 0.6, hx: 0.12, hy: -0.1 },
    { x: 0.95, y: 0.2, hx: 0, hy: 0 },
  ]);
  const drag = useRef<{ idx: number, type: "p" | "h" } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const onDown = (idx: number, type: "p" | "h") => (e: React.MouseEvent) => { drag.current = { idx, type }; e.stopPropagation(); };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!drag.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setPts(ps => {
        const c = [...ps];
        if (drag.current!.type === "p") {
          c[drag.current!.idx] = { ...c[drag.current!.idx], x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
        } else {
          const p = c[drag.current!.idx];
          c[drag.current!.idx] = { ...p, hx: x - p.x, hy: y - p.y };
        }
        return c;
      });
    };
    const up = () => { drag.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const d = useMemo(() => {
    if (pts.length < 2) return "";
    let s = `M ${pts[0].x * 400} ${pts[0].y * 140}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      s += ` C ${ (prev.x + prev.hx) * 400} ${(prev.y + prev.hy) * 140} ${(cur.x - cur.hx) * 400} ${(cur.y - cur.hy) * 140} ${cur.x * 400} ${cur.y * 140}`;
    }
    return s;
  }, [pts]);

  return (
    <div>
      <svg ref={svgRef} width={400} height={160} className="rounded-[4px] bg-[#0f0f10] border border-black">
        <path d={d} fill="none" stroke="#f2c94c" strokeWidth={2} />
        {pts.map((p, i) => (
          <g key={i}>
            <line x1={p.x * 400} y1={p.y * 140} x2={(p.x + p.hx) * 400} y2={(p.y + p.hy) * 140} stroke="#3a3520" strokeWidth={1} />
            <line x1={p.x * 400} y1={p.y * 140} x2={(p.x - p.hx) * 400} y2={(p.y - p.hy) * 140} stroke="#3a3520" strokeWidth={1} />
            <circle cx={(p.x + p.hx) * 400} cy={(p.y + p.hy) * 140} r={4} fill="#2a2410" stroke="#f2c94c" className="cursor-move" onMouseDown={onDown(i, "h")} />
            <circle cx={p.x * 400} cy={p.y * 140} r={6} fill="#3a3418" stroke="#f2c94c" strokeWidth={2} className="cursor-move" onMouseDown={onDown(i, "p")} />
          </g>
        ))}
      </svg>
      <div className="mono text-[8px] text-[#5a5c5e] mt-1">BEZIER HANDLES · DRAG POINTS + HANDLES FOR AUTOMATION CURVES</div>
    </div>
  );
}
function LFOEditor() {
  const [shape, setShape] = useState<"sine" | "square" | "saw" | "free">("sine");
  const [freePts, setFreePts] = useState<number[]>(Array.from({ length: 40 }, (_, i) => Math.sin(i / 40 * Math.PI * 2) * 0.4 + 0.5));
  const drawing = useRef(false);

  const getPath = () => {
    let pts: number[];
    if (shape === "sine") pts = Array.from({ length: 40 }, (_, i) => Math.sin(i / 40 * Math.PI * 2) * 0.4 + 0.5);
    else if (shape === "square") pts = Array.from({ length: 40 }, (_, i) => (i < 20 ? 0.2 : 0.8));
    else if (shape === "saw") pts = Array.from({ length: 40 }, (_, i) => (i / 40) * 0.6 + 0.2);
    else pts = freePts;
    let d = `M 0 ${pts[0] * 120}`;
    pts.forEach((y, i) => { d += ` L ${(i / pts.length) * 400} ${y * 120}`; });
    return d;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing.current || shape !== "free") return;
    const rect = (e.currentTarget as any).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const idx = Math.floor(x * 40);
    if (idx >= 0 && idx < 40) {
      setFreePts(p => { const c = [...p]; c[idx] = y; return c; });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {(["sine", "square", "saw", "free"] as const).map(s => (
          <div key={s} className={`px-2 py-1 rounded-[3px] text-[9px] mono cursor-pointer border ${shape === s ? "bg-[#2a4a7a] border-[#4a8af4] text-[#a9c6ff]" : "bg-[#1a1b1d] border-[#333] text-[#6a6c6e]"}`} onClick={() => setShape(s)}>{s.toUpperCase()}</div>
        ))}
      </div>
      <svg width={400} height={120} className="rounded-[4px] bg-[#0f0f10] border border-black cursor-crosshair"
        onMouseDown={() => { if (shape === "free") drawing.current = true; }}
        onMouseUp={() => { drawing.current = false; }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => { drawing.current = false; }}
      >
        <path d={getPath()} fill="none" stroke="#3dd68c" strokeWidth={2} />
        <line x1={0} y1={60} x2={400} y2={60} stroke="#1e2a1e" strokeDasharray="3 3" />
      </svg>
    </div>
  );
}

/* METERS */
function VerticalVU() {
  const [lvl, setLvl] = useState(0.6);
  const [peak, setPeak] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      const n = 0.3 + Math.random() * 0.7;
      setLvl(n);
      if (n > 0.92) { setPeak(true); setTimeout(() => setPeak(false), 400); }
    }, 120);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[24px] h-[160px] rounded-[3px] bg-[#0a0a0a] border border-black relative overflow-hidden inset-well">
        <div className="absolute bottom-0 left-1 right-1 bg-gradient-to-t from-[#1a5a2a] via-[#7ab82a] to-[#f2c94c] rounded-[2px] transition-all duration-75" style={{ height: `${lvl * 100}%`, boxShadow: "0 0 8px rgba(122,184,42,0.4)" }} />
        <div className="absolute top-0 left-0 right-0 h-[6px] bg-[#ff4a3d] shadow-[0_0_8px_#ff4a3d] opacity-90" style={{ display: peak ? "block" : "none" }} />
        {/* ticks */}
        <div className="absolute left-0 right-0 top-0 bottom-0 flex flex-col justify-between py-2 pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[1px] bg-black/60 w-full" />)}
        </div>
      </div>
      <div className={`w-[10px] h-[10px] rounded-full ${peak ? "bg-[#ff4a3d] shadow-[0_0_8px_#ff4a3d]" : "bg-[#2a1a1a]"} border border-black`} />
      <div className="mono text-[9px] text-[#6a6c6e]">{(lvl * 24 - 12).toFixed(1)} dB</div>
    </div>
  );
}
function HorizontalBar() {
  const [lvl, setLvl] = useState(0.72);
  const [clip, setClip] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      const n = Math.min(1, 0.4 + Math.random() * 0.7);
      setLvl(n);
      if (n > 0.97) { setClip(true); setTimeout(() => setClip(false), 800); }
    }, 100);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-[280px] flex flex-col gap-2">
      <div className="h-[16px] rounded-[3px] bg-[#0c0c0d] border border-black inset-well relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#2a6a3a] via-[#b8d42a] to-[#ff4a3d] rounded-[2px]" style={{ width: `${lvl * 100}%` }} />
      </div>
      <div className="flex justify-between items-center">
        <div className="mono text-[9px] text-[#6a6c6e]">-24 ————————— 0 ——— +6</div>
        <div className={`w-[12px] h-[8px] rounded-[2px] border ${clip ? "bg-[#ff4a3d] border-[#ff6a5d] shadow-[0_0_8px_#ff4a3d]" : "bg-[#2a1a1a] border-black"}`} />
      </div>
    </div>
  );
}
function WaveScrubber() {
  const [pos, setPos] = useState(0.34);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const onDown = (e: React.MouseEvent) => { dragging.current = true; update(e); };
  const update = (e: any) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    x = Math.max(0, Math.min(1, x));
    setPos(x);
  };
  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) update(e); };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);
  return (
    <div className="w-[320px] flex flex-col gap-2">
      <div ref={ref} className="h-[64px] rounded-[4px] bg-[#0f0f10] border border-black relative overflow-hidden cursor-ew-resize" onMouseDown={onDown}>
        <svg width="100%" height="64" viewBox="0 0 320 64" className="absolute inset-0">
          <path d={`M 0 32 ${Array.from({ length: 80 }, (_, i) => `L ${i * 4} ${32 + Math.sin(i * 0.6) * 18 * Math.sin(i * 0.12 + 1) + (Math.random() - 0.5) * 4}`).join(" ")}`} fill="none" stroke="#3a4a5a" strokeWidth={1.2} />
          <path d={`M 0 32 ${Array.from({ length: 80 }, (_, i) => `L ${i * 4} ${32 + Math.sin(i * 0.6) * 18 * Math.sin(i * 0.12 + 1) + (Math.random() - 0.5) * 4}`).join(" ")} L 320 64 L 0 64 Z`} fill="#1a2a3a" fillOpacity={0.2} />
        </svg>
        <div className="absolute top-0 bottom-0 w-[1px] bg-[#4a8af4] shadow-[0_0_6px_#4a8af4]" style={{ left: `${pos * 100}%` }} />
        <div className="absolute top-0 w-[8px] h-[10px] bg-[#4a8af4] -translate-x-1/2 rounded-b-[2px]" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="mono text-[9px] text-[#5a5c5e]">{(pos * 124.5).toFixed(2)}s / 2:04.50</div>
    </div>
  );
}
function MiniPiano() {
  const [active, setActive] = useState<number | null>(null);
  const whiteKeys = 14;
  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="relative w-[280px] h-[64px] bg-[#0a0a0a] border border-black rounded-[4px] flex">
        {Array.from({ length: whiteKeys }).map((_, i) => {
          const isActive = active === i * 2;
          return (
            <div key={i} className={`flex-1 border-r border-[#222] last:border-r-0 cursor-pointer ${isActive ? "bg-[#cfe0ff] shadow-[inset_0_0_10px_#4a8af4]" : "bg-[#e8e8e8] hover:bg-white"}`}
              onMouseDown={() => setActive(i * 2)} onMouseUp={() => setActive(null)} onMouseLeave={() => setActive(null)}
            />
          );
        })}
        {/* black keys */}
        <div className="absolute top-0 left-0 w-full h-[36px] flex pointer-events-none">
          {Array.from({ length: whiteKeys }).map((_, i) => {
            const hasBlack = ![2, 6, 9, 13].includes(i);
            return (
              <div key={i} className="flex-1 relative">
                {hasBlack && (
                  <div className="absolute right-0 top-0 w-[14px] h-full bg-[#0a0a0a] rounded-b-[3px] border border-black pointer-events-auto cursor-pointer translate-x-1/2 shadow-[0_2px_4px_black]"
                    style={{ background: active === i * 2 + 1 ? "#4a8af4" : "#111" }}
                    onMouseDown={(e) => { e.stopPropagation(); setActive(i * 2 + 1); }}
                    onMouseUp={() => setActive(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mono text-[9px] text-[#5a5c5e]">C2 — B3 · {active !== null ? `NOTE ${["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][active % 12]}${Math.floor(active / 12) + 2}` : "IDLE"}</div>
    </div>
  );
}

/* MOD */
function ModMatrix() {
  const sources = ["LFO 1", "ENV 2", "VELOCITY", "MODWHEEL"];
  const dests = ["FILTER CUTOFF", "AMP", "PITCH", "PAN"];
  const [amounts, setAmounts] = useState([0.6, -0.3, 0.45, 0.8]);
  return (
    <div className="flex flex-col gap-2 w-[360px]">
      {sources.map((s, i) => (
        <div key={s} className="flex items-center gap-2 h-[32px] bg-[#1a1b1d] rounded-[4px] border border-[#222] px-2">
          <div className="w-[72px] mono text-[10px] text-[#7a7c7e]">{s}</div>
          <div className="text-[#3a3c3f]">→</div>
          <div className="w-[96px] mono text-[10px] text-[#8a8d90]">{dests[i]}</div>
          <div className="flex-1 h-[4px] bg-[#0f0f10] rounded-full relative">
            <div className="absolute top-1/2 -translate-y-1/2 h-[4px] bg-[#4a8af4] rounded-full" style={{ left: amounts[i] < 0 ? `${50 + amounts[i] * 50}%` : "50%", width: `${Math.abs(amounts[i]) * 50}%` }} />
          </div>
          <div className="mono text-[10px] text-[#9ec6ff] w-[36px] text-right">{(amounts[i] * 100).toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}
function ValueScrub() {
  const [v, setV] = useState(440);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startV = useRef(v);
  const onDown = (e: React.MouseEvent) => { dragging.current = true; startY.current = e.clientY; startV.current = v; };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (startY.current - e.clientY) * 0.8;
      setV(Math.max(20, Math.min(20000, Math.round(startV.current + delta))));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);
  return (
    <div className="flex items-center gap-2">
      <div className="w-[96px] h-[28px] rounded-[4px] bg-[#0f0f10] border border-black flex items-center justify-between px-2 cursor-ns-resize inset-well" onMouseDown={onDown}>
        <span className="mono text-[11px] text-[#c8cacc]">{v} Hz</span>
        <span className="text-[8px] text-[#5a5c5e]">↕</span>
      </div>
      <div className="mono text-[9px] text-[#5a5c5e]">DRAG NUMBER TO SCRUB</div>
    </div>
  );
}
function JogWheel() {
  const [angle, setAngle] = useState(0);
  const dragging = useRef(false);
  const lastAngle = useRef(0);
  const centerRef = useRef<{ x: number, y: number } | null>(null);

  const onDown = (e: React.MouseEvent) => {
    dragging.current = true;
    const rect = (e.currentTarget as any).getBoundingClientRect();
    centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const a = Math.atan2(e.clientY - centerRef.current.y, e.clientX - centerRef.current.x);
    lastAngle.current = a;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current || !centerRef.current) return;
      const a = Math.atan2(e.clientY - centerRef.current.y, e.clientX - centerRef.current.x);
      let delta = a - lastAngle.current;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      setAngle(ang => ang + delta * 1.2);
      lastAngle.current = a;
    };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-[96px] h-[96px] rounded-full bg-[#1a1b1d] border border-[#333] shadow-[inset_0_2px_6px_black,0_2px_6px_black] flex items-center justify-center relative cursor-grab" onMouseDown={onDown}>
        <div className="w-[84px] h-[84px] rounded-full border border-[#2a2c2e] bg-[radial-gradient(#2a2c2e,#151516)] relative" style={{ transform: `rotate(${angle}rad)` }}>
          <div className="absolute top-[6px] left-1/2 w-[4px] h-[12px] bg-[#4a8af4] -translate-x-1/2 rounded-full shadow-[0_0_6px_#4a8af4]" />
          <div className="absolute inset-0 rounded-full" style={{ background: "repeating-conic-gradient(from 0deg, transparent 0deg 10deg, rgba(255,255,255,0.04) 10deg 11deg)" }} />
        </div>
      </div>
      <div className="mono text-[9px] text-[#5a5c5e]">JOG · {(angle % (Math.PI * 2)).toFixed(2)} rad</div>
    </div>
  );
}

export default function App() {
  const [activeCat, setActiveCat] = useState("range1d");
  const mainRef = useRef<HTMLDivElement>(null);
  const [vuBars, setVuBars] = useState<number[]>(Array.from({ length: 16 }, () => 0.2));

  useEffect(() => {
    const id = setInterval(() => {
      setVuBars(b => b.map(() => 0.1 + Math.random() * 0.9));
    }, 90);
    return () => clearInterval(id);
  }, []);

  const scrollTo = (id: string) => {
    setActiveCat(id);
    const el = document.getElementById(`sec-${id}`);
    if (el && mainRef.current) {
      mainRef.current.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
    }
  };

  return (
    <div data-safe-area-inset-root className="min-h-screen w-full bg-[#121214] text-[#c8cacc] flex flex-col overflow-hidden" style={{ boxSizing: "border-box", paddingTop: "var(--safe-area-inset-top)" }}>
      {/* Titlebar */}
      <div className="titlebar-gradient h-[24px] flex items-center px-2 select-none shrink-0" data-safe-area-sticky-top style={{ top: "var(--safe-area-inset-top)" }}>
        <div className="flex gap-[6px] items-center">
          <div className="traffic-light bg-[#ff5f57]" />
          <div className="traffic-light bg-[#ffbd2e]" />
          <div className="traffic-light bg-[#28c940]" />
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-[11px] font-semibold tracking-wide text-[#a8aaac] drop-shadow-[0_1px_0_black]">ProControl Reference — Audio UI Kit 2008 — Logic Pro Lab</span>
        </div>
        <div className="w-[52px]" />
      </div>

      {/* Menubar */}
      <div className="menubar h-[22px] flex items-center px-3 gap-4 text-[11px] tracking-wide shrink-0">
        {["FILE", "EDIT", "VIEW", "REFERENCE", "WINDOW", "HELP"].map(m => (
          <span key={m} className="text-[#9a9c9e] hover:text-[#c8cacc] cursor-pointer">{m}</span>
        ))}
        <div className="ml-auto mono text-[10px] text-[#5a5c5e]">⌘R  REFERENCE MODE · BUILD 8A251</div>
      </div>

      {/* Toolbar */}
      <div className="toolbar-gradient h-[36px] flex items-center px-3 gap-4 shrink-0" data-safe-area-sticky-top style={{ top: "calc(var(--safe-area-inset-top) + 24px + 22px)" }}>
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-[4px] bg-[#0f0f10] border border-black flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">◫</div>
          <span className="mono text-[12px] font-bold tracking-[0.12em] text-[#d0d2d4]">AUDIO CONTROL LAB - PRO REFERENCE</span>
          <span className="mono text-[9px] text-[#5a5c5e] px-2 py-0.5 rounded bg-black/40 border border-[#222]">v2.1 • DARK LAB</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="emboss-label text-[9px]">OUTPUT VU</span>
          <div className="flex gap-[2px] h-[18px] items-end">
            {vuBars.map((v, i) => (
              <div key={i} className="w-[4px] rounded-[1px] transition-all duration-75" style={{ height: `${v * 100}%`, background: i > 12 ? "#ff4a3d" : i > 9 ? "#f2c94c" : "#3dd68c", boxShadow: v > 0.8 ? `0 0 4px ${i > 12 ? "#ff4a3d" : i > 9 ? "#f2c94c" : "#3dd68c"}` : "none" }} />
            ))}
          </div>
          <div className="mono text-[10px] text-[#7a8ab0] ml-2">44.1kHz • 32-bit FLOAT</div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Nav */}
        <div className="w-[200px] shrink-0 panel-gradient border-r border-black flex flex-col overflow-hidden">
          <div className="p-2 flex flex-col gap-1 overflow-auto">
            <div className="emboss-label px-2 py-1 text-[10px]">CONTROL FAMILIES</div>
            {categories.map(c => (
              <div key={c.id} className={`h-[28px] flex items-center gap-2 px-2 rounded-[4px] cursor-pointer border text-[11px] mono transition-all ${activeCat === c.id ? "bg-[#24365a] border-[#4a8af4] text-[#b8d0ff] shadow-[0_0_10px_rgba(74,138,244,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]" : "bg-[#1a1b1d] border-[#2a2c2e] text-[#7a7c7e] hover:bg-[#222326] hover:text-[#9a9c9e]"}`} onClick={() => scrollTo(c.id)}>
                <span className="text-[12px]">{c.icon}</span>
                <span>{c.label}</span>
                {activeCat === c.id && <span className="ml-auto w-[6px] h-[6px] rounded-full bg-[#4a8af4] shadow-[0_0_6px_#4a8af4]" />}
              </div>
            ))}
            <div className="mt-4 emboss-label px-2 py-1 text-[10px]">WHAT ELSE?</div>
            <div className="px-2 py-2 rounded-[4px] bg-[#151517] border border-[#222] text-[10px] leading-[1.4] text-[#6a6c6e] mono">
              Pro apps need custom because OS widgets can't imitate hardware panels. Every knob has inertia, every fader has long throw for fine gain.
              <div className="mt-2 text-[#7a8ab0]">+ PATCH MATRIX<br />+ VALUE SCRUB<br />+ JOG / SHUTTLE<br />+ SPECTROGRAM<br />+ CORRELATION</div>
            </div>
            <div className="mt-3 p-2 rounded-[4px] bg-black/40 border border-[#1a1a1a]">
              <div className="mono text-[8px] text-[#3a3c3f]">REFERENCE NOTES</div>
              <div className="mono text-[9px] text-[#5a5c5e] mt-1 leading-[1.3]">All controls are draggable. No OS native widgets. Heavy bevels = tactile memory for engineers in dark studios.</div>
            </div>
          </div>
          <div className="mt-auto p-2 border-t border-black/60 bg-[#151517]">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-[#3dd68c] shadow-[0_0_4px_#3dd68c]" />
              <div className="mono text-[8px] text-[#5a5c5e]">LAB READY • 60fps INTERACTION</div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div ref={mainRef} className="flex-1 overflow-auto dotted-grid p-4">
          <div className="max-w-[1280px] mx-auto flex flex-col gap-10 pb-24">

            {/* RANGE 1D */}
            <section id="sec-range1d" className="scroll-mt-4">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#d0d2d4]">RANGE 1D</h2>
                <span className="mono text-[10px] text-[#5a5c5e]">CHANNEL STRIP FADERS · TRIM · GAIN · PAN — WHY LONG THROW MATTERS</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <ProCard title="TALL FRAME SLIDER" subtitle="Imitates hardware channel fader, long throw for fine control. Rectangular knob INSIDE track. Frame taller than track for grip.">
                  <TallFrameSlider />
                </ProCard>
                <ProCard title="KNOB ON TOP OF TRACK" subtitle="Trim / pan style. Thin 4px track, capsule knob sits ON TOP overlapping. Precise for ±12dB trims.">
                  <KnobOnTopSlider />
                </ProCard>
                <ProCard title="ROTARY KNOB VARIANTS" subtitle="Endless encoder, detented 12-step, bipolar ±. LED ring shows position. Drag vertical to rotate.">
                  <div className="flex gap-6">
                    <RotaryKnob variant="endless" label="CUTOFF" />
                    <RotaryKnob variant="detented" label="MODE" />
                    <RotaryKnob variant="bipolar" label="PAN" />
                  </div>
                </ProCard>
                <ProCard title="DUAL RANGE - MIN/MAX" subtitle="Loop start/end, filter range. One track two knobs, colored range between.">
                  <DualRange />
                </ProCard>
                <ProCard title="THIN FADER BANK" subtitle="Mixer: 8 channels side-by-side. Thin 12px faders for dense mixing. Shows why custom > OS slider." wide>
                  <FaderBank />
                </ProCard>
              </div>
            </section>

            {/* RANGE 2D */}
            <section id="sec-range2d">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#d0d2d4]">RANGE 2D</h2>
                <span className="mono text-[10px] text-[#5a5c5e]">VECTOR SYNTHESIS · FILTER / RESONANCE SIMULTANEOUS CONTROL</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <ProCard title="XY PAD / VECTOR PAD" subtitle="X: Filter Cutoff, Y: Resonance. Crosshair + trails. Drag in 2D. Joystick variant springs to center.">
                  <XYPad />
                </ProCard>
                <ProCard title="JOYSTICK - SPRING RETURN" subtitle="Performance control, returns to center on release. Used for pitch/mod or surround panning.">
                  <XYPad spring />
                </ProCard>
                <ProCard title="2D MATRIX GRID" subtitle="8×8 wavetable position matrix. Each cell has vector you drag inside cell - 128 values in compact space.">
                  <Matrix2D />
                </ProCard>
              </div>
            </section>

            {/* TOGGLES */}
            <section id="sec-toggles">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#d0d2d4]">TOGGLES & GATES</h2>
                <span className="mono text-[10px] text-[#5a5c5e]">WHY 6 KINDS? BECAUSE AUDIO HAS LATCHING, MOMENTARY, AND ARM STATES</span>
              </div>
              <div className="panel-gradient rounded-[8px] p-3 gloss-overlay">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="inset-well rounded-[6px] p-4 flex flex-col items-center">
                    <CheckboxOld />
                    <div className="mt-2 mono text-[8px] text-[#3a3c3f] text-center">OLD PRO DARK<br />CHECKBOX</div>
                  </div>
                  <div className="inset-well rounded-[6px] p-4 flex flex-col items-center">
                    <LEDButton />
                    <div className="mt-2 mono text-[8px] text-[#3a3c3f] text-center">LED LATCHING<br />PUSH STAYS LIT</div>
                  </div>
                  <div className="inset-well rounded-[6px] p-4 flex flex-col items-center">
                    <DrumPad />
                    <div className="mt-2 mono text-[8px] text-[#3a3c3f] text-center">MOMENTARY<br />DRUM PAD VELOCITY</div>
                  </div>
                  <div className="inset-well rounded-[6px] p-4 flex flex-col items-center">
                    <RockerSwitch />
                    <div className="mt-2 mono text-[8px] text-[#3a3c3f] text-center">POWER ROCKER<br />FLIPS</div>
                  </div>
                  <div className="inset-well rounded-[6px] p-4 flex flex-col items-center">
                    <SoloMuteRec />
                    <div className="mt-3 mono text-[8px] text-[#3a3c3f] text-center">SOLO MUTE REC<br />M RED S YELLOW</div>
                  </div>
                  <div className="inset-well rounded-[6px] p-4 flex flex-col items-center">
                    <RadioGroup />
                    <div className="mt-2 mono text-[8px] text-[#3a3c3f] text-center">RADIO GROUP<br />EXCLUSIVE</div>
                  </div>
                </div>
              </div>
            </section>

            {/* LISTS */}
            <section id="sec-lists">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#d0d2d4]">LISTS & SELECTION</h2>
                <span className="mono text-[10px] text-[#5a5c5e]">SEGMENTED = FAST MODE SWITCHING WITHOUT MENU DIVE</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <ProCard title="SINGLE-SELECT SEGMENTED" subtitle="Only one active blue. Glossy. For osc type, filter slope."><SegmentedSingle /></ProCard>
                <ProCard title="MULTI-SELECT SEGMENTED" subtitle="Chord mode - multiple blue. Allows C+E+G. For scale or arp."><SegmentedMulti /></ProCard>
                <ProCard title="LIST BOX" subtitle="Scrollable single select with blue highlight. Patch browser."><ListBox /></ProCard>
                <ProCard title="DROPDOWN / POPUP" subtitle="Click to open menu with checkmark. Classic pro dropdown."><Dropdown /></ProCard>
                <ProCard title="MATRIX BUTTONS" subtitle="4×4 grid labeled buttons, single select. Function keys."><MatrixButtons /></ProCard>
                <ProCard title="TAB STRIP" subtitle="Edit/Mix/Mod/FX tabs - heavy beveled, not flat web tabs."><TabStrip /></ProCard>
              </div>
            </section>

            {/* SEQUENCER */}
            <section id="sec-sequencer">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#d0d2d4]">SEQUENCER GRIDS</h2>
                <span className="mono text-[10px] text-[#5a5c5e]">WHEN CELLS ACTIVATE THEY REPRESENT BEAT OR NOTE — CORE OF PRO AUDIO</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <ProCard title="TR-STYLE STEP SEQUENCER" subtitle="16 steps × 8 tracks. Click cells to activate blue lit with glow. Playhead sweeps looping every 2 seconds. Second click = velocity." wide>
                  <TRSequencer />
                </ProCard>
                <ProCard title="PIANO ROLL MINI" subtitle="16×12 grid where cells = notes. Click to place note rectangles. Drag length."><PianoRollMini /></ProCard>
                <ProCard title="CLIP LAUNCHER" subtitle="4×4 grid of clips. Click to launch (pulses green). Session view style."><ClipLauncher /></ProCard>
              </div>
            </section>

            {/* CURVES */}
            <section id="sec-curves">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#d0d2d4]">CURVE EDITORS</h2>
                <span className="mono text-[10px] text-[#5a5c5e]">THE MOST CUSTOM — NO OS PROVIDES ADSR OR EQ CURVE</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ProCard title="ADSR ENVELOPE EDITOR" subtitle="4 draggable points Attack Decay Sustain Release, background grid, filled curve with gradient.">
                  <ADSREditor />
                </ProCard>
                <ProCard title="EQ CURVE EDITOR" subtitle="4 nodes on frequency chart (20Hz-20kHz log), draggable, curve interpolates, each node shows freq/gain.">
                  <EQCurve />
                </ProCard>
                <ProCard title="AUTOMATION CURVE" subtitle="Bezier handles, draggable points, smooth curve. For volume/pan automation lanes.">
                  <AutomationCurve />
                </ProCard>
                <ProCard title="LFO SHAPE EDITOR" subtitle="Draw wave freehand or pick shapes. Sine/Square/Saw/Free draw mode.">
                  <LFOEditor />
                </ProCard>
              </div>
            </section>

            {/* METERS */}
            <section id="sec-meters">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#d0d2d4]">METERS & DISPLAYS</h2>
                <span className="mono text-[10px] text-[#5a5c5e]">READOUTS THAT MUST FEEL ANALOG EVEN WHEN DIGITAL</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                <ProCard title="VERTICAL VU + PEAK" subtitle="Peak LED holds red on clip. Gradient from green to yellow to red.">
                  <VerticalVU />
                </ProCard>
                <ProCard title="HORIZONTAL LEVEL BAR" subtitle="Master bus level with clip indicator."><HorizontalBar /></ProCard>
                <ProCard title="WAVEFORM SCRUBBER" subtitle="Static waveform, draggable playhead. Scrub to audition."><WaveScrubber /></ProCard>
                <ProCard title="MINI PIANO 2 OCTAVES" subtitle="Clickable keys, shows active note name."><MiniPiano /></ProCard>
              </div>
            </section>

            {/* MOD */}
            <section id="sec-mod">
              <div className="flex items-baseline gap-3 mb-3">
                <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#d0d2d4]">MOD & PATCHING + WHAT ELSE?</h2>
                <span className="mono text-[10px] text-[#5a5c5e]">AUDIO APPS NEED CONTROLS NO OTHER CATEGORY NEEDS</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <ProCard title="PATCH CABLE MATRIX" subtitle="Mod matrix list: Source → Destination with amount knob. The heart of modular.">
                  <ModMatrix />
                </ProCard>
                <ProCard title="VALUE SCRUB + JOG" subtitle="Number box you drag to scrub values, and jog/shuttle wheel for tape-style shuttle.">
                  <div className="flex gap-8 items-center">
                    <ValueScrub />
                    <JogWheel />
                  </div>
                </ProCard>
                <div className="panel-gradient rounded-[8px] p-3 gloss-overlay">
                  <div className="emboss-label mb-2">OTHER CATEGORIES AUDIO NEEDS</div>
                  <div className="flex flex-col gap-2 mono text-[10px] leading-[1.4]">
                    <div className="inset-well rounded-[4px] p-2">
                      <div className="text-[#8ab4ff]">SPECTROGRAM DISPLAY</div>
                      <div className="text-[#5a5c5e]">Real-time FFT waterfall, not just meter. Needs custom canvas with log freq, color mapping heat.</div>
                    </div>
                    <div className="inset-well rounded-[4px] p-2">
                      <div className="text-[#f2c94c]">CORRELATION METER</div>
                      <div className="text-[#5a5c5e]">Goniometer / phase scope. Shows stereo width. Circular display with vector line.</div>
                    </div>
                    <div className="inset-well rounded-[4px] p-2">
                      <div className="text-[#3dd68c]">WAVE SHAPER CURVE</div>
                      <div className="text-[#5a5c5e]">Transfer function editor: input vs output curve with grid, similar to Photoshop curves but for distortion.</div>
                    </div>
                    <div className="inset-well rounded-[4px] p-2">
                      <div className="text-[#c8cacc]">TAPE TRANSPORT</div>
                      <div className="text-[#5a5c5e]">Play/Stop/Rec with varispeed shuttle. Buttons need heavy chrome + lamp glow.</div>
                    </div>
                    <div className="inset-well rounded-[4px] p-2">
                      <div className="text-[#ff8a7a]">PITCH BEND + MOD STRIP</div>
                      <div className="text-[#5a5c5e]">Vertical touch strip with spring, not wheel. Shows pressure and position.</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Footer */}
            <div className="mt-6 panel-gradient rounded-[8px] p-4 flex items-center justify-between">
              <div className="mono text-[10px] text-[#6a6c6e] leading-[1.5]">
                This kit shows why pro audio apps need custom controls - they imitate physical panels, not OS widgets.<br />
                <span className="text-[#7a7c7e]">Every fader has long throw for 0.1dB precision, every knob has detent feel, every grid cell has velocity. Logic 8 / Final Cut 7 / Aperture 2 era: heavy bevels, inset wells, blue selection glow.</span>
              </div>
              <div className="mono text-[9px] text-[#3a3c3f] text-right">
                ProControl Reference<br />AUDIO UI KIT 2008<br />© LAB INTERNAL
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
