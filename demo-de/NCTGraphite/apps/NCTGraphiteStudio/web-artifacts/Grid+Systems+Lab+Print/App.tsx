import React, { useEffect, useRef, useState, useMemo } from "react";

// Types
type GridType = "column" | "modular" | "combination";
type BaselineAlign = "none" | "top" | "baseline" | "bottom";
type WidgetKind = "text" | "image" | "vstack" | "hstack" | "flow" | "marginalia" | "baselineBox" | "gridContainer" | "zstack";

interface StackCfg {
  spacing: number; // px
  spacingBaselineUnits: boolean;
  distribution: "leading" | "center" | "trailing" | "spaceBetween" | "fill";
  alignment: "top" | "center" | "baseline" | "bottom";
  direction: "vertical" | "horizontal";
}

interface Struts {
  top: boolean; bottom: boolean; left: boolean; right: boolean;
  hSpring: boolean; vSpring: boolean;
}

interface Widget {
  id: string;
  kind: WidgetKind;
  colStart: number;
  colSpan: number;
  rowStart: number;
  rowSpan: number;
  baselineAlign: BaselineAlign;
  stack?: StackCfg;
  struts?: Struts;
  title?: string;
  locked?: boolean;
}

interface Overlays {
  columns: boolean;
  modular: boolean;
  baseline: boolean;
  gutters: boolean;
  marginalia: boolean;
}

const DEFAULT_WIDGETS: Widget[] = [
  { id: "w1", kind: "text", colStart: 0, colSpan: 3, rowStart: 0, rowSpan: 2, baselineAlign: "baseline", title: "Lead Text Block" },
  { id: "w2", kind: "image", colStart: 3, colSpan: 2, rowStart: 0, rowSpan: 2, baselineAlign: "top", title: "Image Well" },
  { id: "w3", kind: "vstack", colStart: 0, colSpan: 2, rowStart: 3, rowSpan: 3, baselineAlign: "baseline", title: "Inspector Card", stack: { spacing: 8, spacingBaselineUnits: true, distribution: "leading", alignment: "top", direction: "vertical" }, struts: { top: true, bottom: false, left: true, right: false, hSpring: false, vSpring: true } },
  { id: "w4", kind: "hstack", colStart: 0, colSpan: 6, rowStart: 6, rowSpan: 1, baselineAlign: "center", title: "Toolbar Strip", stack: { spacing: 6, spacingBaselineUnits: false, distribution: "spaceBetween", alignment: "center", direction: "horizontal" }, struts: { top: true, bottom: false, left: true, right: true, hSpring: true, vSpring: false } },
  { id: "w5", kind: "flow", colStart: 2, colSpan: 3, rowStart: 7, rowSpan: 2, baselineAlign: "top", title: "Tag Flow", stack: { spacing: 6, spacingBaselineUnits: false, distribution: "leading", alignment: "top", direction: "horizontal" } },
  { id: "w6", kind: "marginalia", colStart: 6, colSpan: 2, rowStart: 1, rowSpan: 2, baselineAlign: "baseline", title: "Side Note" },
];

const INFO: Record<string, string> = {
  column: "Column grids: continuous vertical divisions for text flow. Books, articles, and form layouts.",
  modular: "Modular grids: columns × rows = cells. For dashboards, pro app panels, both axes have rhythm.",
  combination: "Combination: column grid for text + modular for images/sidebars. Most flexible print+GUI hybrid.",
  baseline: "Baseline grid: all type sits on shared horizontal rhythm. Crucial for multi-column readability.",
  gutters: "Gutters are active breathing room that separate content without rules. Not just empty space.",
  marginalia: "Side notes, tools, metadata outside main flow but baseline-aligned — like inspector comments in DAW.",
};

function ProSlider({ label, value, min, max, onChange, unit = "px" }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string; }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const handlePointer = (e: React.PointerEvent | PointerEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const v = Math.round(min + x * (max - min));
    onChange(v);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => handlePointer(e);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragging]);

  return (
    <div className="flex items-center gap-2 py-[3px]">
      <div className="pro-label w-[62px] shrink-0 text-[9px]">{label}</div>
      <div ref={ref} className="relative flex-1 h-[14px] pro-well rounded-[7px] cursor-pointer overflow-hidden"
        onPointerDown={(e) => { setDragging(true); handlePointer(e); }}>
        <div className="absolute top-[4px] bottom-[4px] left-[3px] rounded-[3px]" style={{ width: `${pct}%`, background: "linear-gradient(180deg,#4a8af4,#2a5fb8)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }} />
        <div className="absolute top-0 bottom-0 w-[14px] -ml-[7px] pro-thumb rounded-full" style={{ left: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-1">
        <input className="w-[38px] h-[16px] bg-[#0a0a0b] border border-[#222] rounded-[3px] text-[10px] text-[#b8b9ba] mono text-center focus:outline-none focus:border-[#4a8af4]" type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || min)} min={min} max={max} />
        <span className="text-[9px] text-[#5a5c5e] mono w-[16px]">{unit}</span>
      </div>
    </div>
  );
}

function Disclosure({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#1a1b1d]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-1.5 px-2 h-[22px] hover:bg-white/[0.04] text-left">
        <span className={`text-[9px] text-[#5a5c5e] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        <span className="pro-label">{title}</span>
      </button>
      {open && <div className="px-2 py-2 bg-[#1c1d1f]/60">{children}</div>}
    </div>
  );
}

function InfoTip({ k }: { k: keyof typeof INFO }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex">
      <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} className="w-[12px] h-[12px] rounded-full bg-[#2a2b2e] border border-[#3a3b3e] text-[8px] text-[#7a7c7e] flex items-center justify-center ml-1">i</button>
      {show && <div className="absolute z-50 left-4 -top-1 w-[220px] p-2 rounded-[4px] bg-[#0f0f10] border border-[#333] text-[10px] leading-[1.4] text-[#b0b1b2] shadow-[0_8px_24px_rgba(0,0,0,0.8)]">{INFO[k]}</div>}
    </span>
  );
}

export default function App() {
  // Grid state
  const [gridType, setGridType] = useState<GridType>("combination");
  const [columns, setColumns] = useState(6);
  const [gutter, setGutter] = useState(24);
  const [marginL, setMarginL] = useState(48);
  const [marginR, setMarginR] = useState(48 + 140 + 16); // space for marginalia
  const [marginT, setMarginT] = useState(32);
  const [marginB, setMarginB] = useState(32);
  const [modRows, setModRows] = useState(12);
  const [rowGutter, setRowGutter] = useState(16);
  const [baseline, setBaseline] = useState(16);
  const [baselineOffset, setBaselineOffset] = useState(0);
  const [overlays, setOverlays] = useState<Overlays>({ columns: true, modular: true, baseline: true, gutters: true, marginalia: true });
  const [sheetWidth, setSheetWidth] = useState(800);
  const [sheetHeight] = useState(860);
  const [selectedId, setSelectedId] = useState<string>("w3");
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  const [zoom, setZoom] = useState(100);
  const [drag, setDrag] = useState<{ id: string; startX: number; startCol: number; startY: number; startRow: number; snapCol?: number; snapRow?: boolean } | null>(null);
  const [showGuides, setShowGuides] = useState<{ x?: number; y?: number } | null>(null);
  const [contentWidths, setContentWidths] = useState<[number, number, number]>([320, 600, 900]);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");

  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Persistence
  const reloadRecords = async () => {
    try {
      const res = await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.list", args: { collection: "widgets" } }) });
      const j = await res.json();
      if (j.data?.records?.length) {
        const vals = j.data.records.map((r: any) => r.value as Widget).filter(Boolean);
        if (vals.length) setWidgets(vals);
      }
      const res2 = await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.list", args: { collection: "lab_state" } }) });
      const j2 = await res2.json();
      if (j2.data?.records?.length) {
        const cfg = j2.data.records[0].value;
        if (cfg.gridType) setGridType(cfg.gridType);
        if (cfg.columns) setColumns(cfg.columns);
        if (cfg.overlays) setOverlays(cfg.overlays);
      }
    } catch (e) { /* backend unavailable in preview */ }
  };

  useEffect(() => { reloadRecords(); }, []);

  const createRow = async (w: Widget) => {
    const res = await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.create", args: { collection: "widgets", value: w, idempotency_key: `w-${w.id}` } }) });
    const j = await res.json();
    if (j.error) throw new Error(j.error);
  };

  const persistWidgets = async (next: Widget[]) => {
    setWidgets(next);
    try {
      // best-effort upsert each
      for (const w of next) {
        await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.create", args: { collection: "widgets", value: w, idempotency_key: `w-${w.id}` } }) })
          .then(async r => {
            const j = await r.json();
            if (j.error && j.error.includes("idempotency")) {
              // try replace
              const list = await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.list", args: { collection: "widgets" } }) }).then(x => x.json());
              const found = list.data?.records?.find((rec: any) => rec.value?.id === w.id);
              if (found) {
                await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.replace", args: { collection: "widgets", id: found.id, value: w } }) });
              }
            }
          });
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 1200);
    } catch (e: any) { setPersistError(e.message); }
  };

  const persistConfig = async () => {
    try {
      const res = await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.list", args: { collection: "lab_state" } }) }).then(r => r.json());
      const existing = res.data?.records?.[0];
      const val = { gridType, columns, gutter, marginL, marginR, marginT, marginB, modRows, rowGutter, baseline, overlays };
      if (existing) {
        await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.replace", args: { collection: "lab_state", id: existing.id, value: val } }) });
      } else {
        await fetch("actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "records.create", args: { collection: "lab_state", value: val } }) });
      }
    } catch {}
  };

  useEffect(() => { persistConfig(); }, [gridType, columns, gutter, marginL, marginR, marginT, marginB, modRows, rowGutter, baseline, overlays]);

  // Computed grid
  const usableW = sheetWidth - marginL - marginR;
  const colW = useMemo(() => (usableW - (columns - 1) * gutter) / columns, [usableW, columns, gutter]);
  const usableH = sheetHeight - marginT - marginB;
  const rowH = useMemo(() => (usableH - (modRows - 1) * rowGutter) / modRows, [usableH, modRows, rowGutter]);

  const selected = widgets.find(w => w.id === selectedId) || null;

  const handleWidgetMouseDown = (e: React.PointerEvent, w: Widget) => {
    e.stopPropagation();
    setSelectedId(w.id);
    const startX = e.clientX;
    const startY = e.clientY;
    setDrag({ id: w.id, startX, startY, startCol: w.colStart, startRow: w.rowStart });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const approxColShift = Math.round(dx / (colW + gutter));
      const approxRowShift = Math.round(dy / (rowH + rowGutter));
      let newCol = Math.max(0, Math.min(columns - 1, drag.startCol + approxColShift));
      let newRow = Math.max(0, Math.min(modRows - 1, drag.startRow + approxRowShift));
      // Snap detection within 10px
      const rawX = marginL + newCol * (colW + gutter);
      const mouseContentX = e.clientX - (contentRef.current?.getBoundingClientRect().left || 0);
      const snapThreshold = 10;
      let snapCol: number | undefined;
      let guideX: number | undefined;
      for (let c = 0; c <= columns; c++) {
        const edge = marginL + c * (colW + gutter) - (c > 0 ? gutter : 0);
        // for simplicity, snap to column start edges
        const colEdge = marginL + c * (colW + gutter);
        if (Math.abs(mouseContentX - colEdge) < snapThreshold) {
          snapCol = c;
          guideX = colEdge;
          newCol = c;
          break;
        }
      }
      // baseline snap
      const rawY = marginT + newRow * (rowH + rowGutter);
      const baselineY = Math.round(rawY / baseline) * baseline + baselineOffset;
      const snapRow = Math.abs((rawY + marginT) - baselineY) < 8;

      setShowGuides({ x: guideX, y: snapRow ? baselineY : undefined });

      setWidgets(prev => prev.map(w => w.id === drag.id ? { ...w, colStart: newCol, rowStart: newRow } : w));
      setDrag(d => d ? { ...d, snapCol, snapRow } : null);
    };
    const onUp = () => {
      setDrag(null);
      setShowGuides(null);
      persistWidgets(widgets);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [drag, colW, gutter, rowH, rowGutter, marginL, marginT, columns, modRows, baseline, baselineOffset, widgets]);

  const addWidget = (kind: WidgetKind) => {
    const id = `w${Date.now()}`;
    const nw: Widget = {
      id, kind,
      colStart: Math.floor(Math.random() * Math.max(1, columns - 2)),
      colSpan: kind === "hstack" ? columns : 2,
      rowStart: Math.floor(Math.random() * 4),
      rowSpan: kind === "image" ? 2 : 1,
      baselineAlign: "baseline",
      title: kind.toUpperCase() + " " + id.slice(-3),
      stack: (kind === "vstack" || kind === "hstack" || kind === "flow") ? { spacing: 8, spacingBaselineUnits: true, distribution: "leading", alignment: "top", direction: kind === "vstack" ? "vertical" : "horizontal" } : undefined,
      struts: { top: true, left: true, right: false, bottom: false, hSpring: kind === "hstack", vSpring: kind === "vstack" },
    };
    const next = [...widgets, nw];
    persistWidgets(next);
    createRow(nw).catch(() => {});
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<Widget>) => {
    if (!selected) return;
    const next = widgets.map(w => w.id === selected.id ? { ...w, ...patch } : w);
    persistWidgets(next);
  };

  const resizeSheet = (e: React.PointerEvent) => {
    const startX = e.clientX;
    const startW = sheetWidth;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      setSheetWidth(Math.max(420, Math.min(1100, startW + dx)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div data-safe-area-inset-root className="w-screen h-screen flex flex-col overflow-hidden select-none" style={{ boxSizing: "border-box", paddingTop: "var(--safe-area-inset-top)", background: "var(--bg-base)" }}>
      {/* Titlebar */}
      <div data-safe-area-sticky-top className="h-[24px] shrink-0 flex items-center px-2 gap-2 border-b border-black" style={{ top: "var(--safe-area-inset-top)", background: "linear-gradient(180deg, var(--title-start), var(--title-end))", zIndex: 50 }}>
        <div className="flex gap-1.5 items-center">
          <div className="w-[12px] h-[12px] rounded-full bg-[#ff5f57] border border-[#8a2a26] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
          <div className="w-[12px] h-[12px] rounded-full bg-[#ffbd2e] border border-[#8a6a1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
          <div className="w-[12px] h-[12px] rounded-full bg-[#28ca42] border border-[#1a6a24] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
        </div>
        <div className="flex-1 text-center text-[11px] tracking-wide text-[#c8c9ca] font-semibold drop-shadow-[0_1px_0_rgba(0,0,0,0.8)]">Grid Systems Lab — Print to GUI Layout 2008</div>
        <div className="text-[9px] text-[#5a5c5e] mono">{saveStatus || (persistError ? "offline" : "● live")}</div>
      </div>

      {/* Menubar */}
      <div className="h-[20px] shrink-0 flex items-center gap-4 px-3 bg-[#1e1f22] border-b border-[#0f0f10] text-[11px] text-[#a0a2a4]">
        {["FILE","EDIT","VIEW","GRID","LAYOUT","WINDOW","HELP"].map(m => (
          <span key={m} className="hover:text-white cursor-pointer pro-label text-[10px]">{m}</span>
        ))}
        <span className="ml-auto text-[9px] text-[#5a5c5e]">Base: #121214 • Panels: #242528 • Blue #4a8af4</span>
      </div>

      {/* Toolbar */}
      <div className="h-[38px] shrink-0 flex items-center px-3 gap-3 pro-panel border-x-0 border-t-0">
        <div className="font-bold text-[11px] tracking-[0.18em] text-[#c2c3c4]">GRID SYSTEMS LAB</div>
        <div className="h-[20px] w-px bg-black/40 mx-1" />
        <div className="pro-label mr-2">OVERLAYS:</div>
        <div className="flex rounded-[4px] overflow-hidden border border-black bg-[#0f0f10] p-[2px] gap-[2px]">
          {[
            { k: "columns" as const, label: "COLUMNS" },
            { k: "modular" as const, label: "MODULAR" },
            { k: "baseline" as const, label: "BASELINE" },
            { k: "gutters" as const, label: "GUTTERS" },
            { k: "marginalia" as const, label: "MARGINALIA" },
          ].map(o => {
            const active = overlays[o.k];
            return (
              <button key={o.k} onClick={() => setOverlays(v => ({ ...v, [o.k]: !v[o.k] }))}
                className={`px-2 h-[20px] rounded-[3px] text-[9px] font-bold tracking-wide transition-all ${active ? "bg-[#4a8af4] text-white shadow-[0_0_8px_rgba(74,138,244,0.6),inset_0_1px_0_rgba(255,255,255,0.3)]" : "bg-[#232426] text-[#7a7c7e] hover:text-[#a0a2a4]"}`}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="pro-label">ZOOM</span>
            <div className="flex items-center border border-black rounded-[3px] overflow-hidden bg-[#0f0f10]">
              <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="px-1.5 h-[20px] text-[11px] bg-[#2a2b2e] hover:bg-[#333]">−</button>
              <span className="px-2 h-[20px] flex items-center text-[10px] mono text-[#b8b9ba] w-[48px] justify-center">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="px-1.5 h-[20px] text-[11px] bg-[#2a2b2e] hover:bg-[#333]">+</button>
            </div>
          </div>
          <button onClick={() => { setWidgets(DEFAULT_WIDGETS); setSheetWidth(800); setOverlays({ columns: true, modular: true, baseline: true, gutters: true, marginalia: true }); }} className="h-[22px] px-3 rounded-[4px] bg-gradient-to-b from-[#3a3b3e] to-[#242528] border border-black text-[10px] text-[#c2c3c4] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">Reset</button>
        </div>
      </div>

      {/* Main 3-col */}
      <div className="flex-1 flex min-h-0">
        {/* Left inspector */}
        <div className="w-[240px] shrink-0 pro-panel border-t-0 border-b-0 border-l-0 flex flex-col overflow-hidden">
          <div className="h-[22px] flex items-center px-2 bg-[#1a1b1d] border-b border-black pro-label text-[10px]">GRID CONTROLS</div>
          <div className="flex-1 overflow-auto">
            <Disclosure title="Print Grid Type">
              <div className="space-y-2">
                {[
                  { id: "column" as GridType, label: "Column Grid (1–12 cols)", desc: "Continuous text, magazines, form stacks." },
                  { id: "modular" as GridType, label: "Modular Grid (cols × rows)", desc: "Complex UIs, dashboards, pro app panels." },
                  { id: "combination" as GridType, label: "Combination Grid", desc: "Column + modular hybrid, text + image blocks." },
                ].map(o => (
                  <label key={o.id} className={`flex gap-2 p-1.5 rounded-[3px] cursor-pointer border ${gridType === o.id ? "bg-[#4a8af4]/15 border-[#4a8af4]/40" : "border-transparent hover:bg-white/[0.03]"}`}>
                    <input type="radio" checked={gridType === o.id} onChange={() => setGridType(o.id)} className="mt-0.5 accent-[#4a8af4]" />
                    <div>
                      <div className="text-[11px] text-[#d0d1d2] leading-tight">{o.label}</div>
                      <div className="text-[9px] text-[#6a6c6e] leading-tight mt-0.5">{o.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </Disclosure>

            <Disclosure title="Grid Parameters">
              <div className="space-y-1">
                <ProSlider label="Columns" value={columns} min={1} max={12} onChange={setColumns} unit="" />
                <ProSlider label="Gutter" value={gutter} min={0} max={48} onChange={setGutter} />
                <div className="h-px bg-black/40 my-1" />
                <ProSlider label="Margin L" value={marginL} min={0} max={120} onChange={setMarginL} />
                <ProSlider label="Margin R" value={marginR} min={0} max={200} onChange={setMarginR} />
                <ProSlider label="Margin T" value={marginT} min={0} max={80} onChange={setMarginT} />
                <ProSlider label="Margin B" value={marginB} min={0} max={80} onChange={setMarginB} />
                {(gridType === "modular" || gridType === "combination") && (
                  <>
                    <div className="h-px bg-black/40 my-1" />
                    <ProSlider label="Mod Rows" value={modRows} min={1} max={16} onChange={setModRows} unit="" />
                    <ProSlider label="Row Gut" value={rowGutter} min={0} max={32} onChange={setRowGutter} />
                  </>
                )}
                <div className="h-px bg-black/40 my-1" />
                <ProSlider label="Baseline" value={baseline} min={4} max={32} onChange={setBaseline} />
                <ProSlider label="Bsl Off" value={baselineOffset} min={0} max={32} onChange={setBaselineOffset} />
                <div className="mt-2 p-1.5 rounded-[3px] bg-[#0f0f10] border border-[#222]">
                  <div className="pro-label text-[8px]">CALCULATED</div>
                  <div className="mono text-[9px] text-[#8a8c8e] mt-1 leading-[1.5]">
                    colW: {colW.toFixed(1)}px<br />
                    rowH: {rowH.toFixed(1)}px<br />
                    usable: {usableW.toFixed(0)}×{usableH.toFixed(0)}
                  </div>
                </div>
              </div>
            </Disclosure>

            <Disclosure title="GUI Stacking Widgets">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { k: "vstack" as WidgetKind, label: "VStack" },
                  { k: "hstack" as WidgetKind, label: "HStack" },
                  { k: "zstack" as WidgetKind, label: "ZStack" },
                  { k: "flow" as WidgetKind, label: "Flow/Wrap" },
                  { k: "gridContainer" as WidgetKind, label: "Grid Container" },
                  { k: "baselineBox" as WidgetKind, label: "Baseline Box" },
                ].map(b => (
                  <button key={b.k} onClick={() => addWidget(b.k)}
                    className="h-[28px] rounded-[4px] bg-gradient-to-b from-[#323335] to-[#1f2022] border border-black text-[10px] text-[#b8b9ba] hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] flex items-center justify-center gap-1">
                    <span className="w-[10px] h-[10px] rounded-[2px] bg-[#4a8af4]/60 border border-[#4a8af4]" />
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[9px] text-[#6a6c6e] leading-[1.4]">Click to add. Drag on canvas — snaps to columns & baseline. Pink guides show snap. Persisted via records API.</div>
            </Disclosure>

            <Disclosure title="Snapping & Content-Aware" defaultOpen={false}>
              <div className="text-[10px] leading-[1.5] text-[#8a8c8e] space-y-2">
                <div><b className="text-[#a0a2a4]">Snap logic:</b> column edge within 10px → pink guide. Baseline alignment within 8px → horizontal guide.</div>
                <div><b className="text-[#a0a2a4]">Resize:</b> drag bottom-right handle of page sheet. Columns shrink proportionally, gutters fixed. HStack springs expand. Flow wraps.</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-[14px] h-[2px] bg-[#ff6b8a]" /> snap guide
                  <div className="w-[14px] h-[14px] rounded-[2px] bg-[rgba(74,138,244,0.12)] border border-[rgba(74,138,244,0.3)] ml-2" /> column
                </div>
              </div>
            </Disclosure>
          </div>
        </div>

        {/* Center canvas */}
        <div ref={canvasRef} className="flex-1 bg-[#1a1a1c] dotted-bg relative overflow-auto overflow-x-clip flex flex-col">
          <div className="h-[22px] shrink-0 flex items-center px-3 gap-3 bg-[#1e1f22] border-b border-black/60 sticky top-0 z-20">
            <span className="pro-label">PAGE / WINDOW CANVAS</span>
            <span className="text-[9px] text-[#5a5c5e] mono">{sheetWidth} × {sheetHeight} • {gridType.toUpperCase()} • {columns} cols • {baseline}px baseline</span>
            <span className="ml-auto text-[9px] text-[#5a5c5e]">Drag widgets • Bottom-right resize handle →</span>
          </div>

          <div className="flex-1 flex justify-center p-8 overflow-auto">
            <div ref={contentRef} className="relative shrink-0 rounded-[6px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(0,0,0,0.9)] border border-[#2a2b2e] bg-[#1e1f22] overflow-hidden"
              style={{ width: sheetWidth, height: sheetHeight, transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}>
              {/* Paper texture subtle */}
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

              {/* Margin shading */}
              {overlays.columns && (
                <>
                  <div className="absolute top-0 bottom-0 bg-black/40 pointer-events-none" style={{ left: 0, width: marginL }}><div className="absolute top-1/2 left-2 -rotate-90 origin-left text-[8px] tracking-[0.2em] text-white/20 pro-label">MARGIN {marginL}px</div></div>
                  <div className="absolute top-0 bottom-0 bg-black/40 pointer-events-none" style={{ right: 0, width: marginR - 140 - 16 }}><div className="absolute top-1/2 right-2 rotate-90 origin-right text-[8px] tracking-[0.2em] text-white/20 pro-label">MARGIN</div></div>
                  <div className="absolute left-0 right-0 bg-black/30 pointer-events-none" style={{ top: 0, height: marginT }} />
                  <div className="absolute left-0 right-0 bg-black/30 pointer-events-none" style={{ bottom: 0, height: marginB }} />
                </>
              )}

              {/* Baseline grid */}
              {overlays.baseline && (
                <div className="absolute inset-0 pointer-events-none">
                  {Array.from({ length: Math.floor(sheetHeight / baseline) + 1 }).map((_, i) => {
                    const y = baselineOffset + i * baseline;
                    const isStrong = i % 5 === 0;
                    return <div key={i} className="absolute left-0 right-0 h-px" style={{ top: y, background: isStrong ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)" }} />;
                  })}
                </div>
              )}

              {/* Columns */}
              {overlays.columns && (
                <div className="absolute pointer-events-none" style={{ left: marginL, top: marginT, width: usableW, height: usableH }}>
                  {Array.from({ length: columns }).map((_, i) => {
                    const x = i * (colW + gutter);
                    return (
                      <div key={i} className="absolute top-0 bottom-0 rounded-[2px] border flex flex-col items-center pt-1" style={{ left: x, width: colW, background: "rgba(74,138,244,0.11)", borderColor: "rgba(74,138,244,0.28)" }}>
                        <span className="text-[8px] mono text-[#4a8af4]/70">{i + 1}</span>
                        <span className="text-[7px] mono text-[#4a8af4]/40 mt-auto mb-1">{colW.toFixed(0)}px</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Gutters */}
              {overlays.gutters && (
                <div className="absolute pointer-events-none" style={{ left: marginL, top: marginT, width: usableW, height: usableH }}>
                  {Array.from({ length: columns - 1 }).map((_, i) => {
                    const x = (i + 1) * colW + i * gutter;
                    return <div key={i} className="absolute top-0 bottom-0 flex flex-col items-center justify-center" style={{ left: x, width: gutter, background: "rgba(244,100,100,0.14)", borderLeft: "1px dashed rgba(244,100,100,0.3)", borderRight: "1px dashed rgba(244,100,100,0.3)" }}><span className="text-[7px] mono text-[#ff8a8a] -rotate-90 whitespace-nowrap">{gutter}px</span></div>;
                  })}
                </div>
              )}

              {/* Modular rows */}
              {overlays.modular && (gridType === "modular" || gridType === "combination") && (
                <div className="absolute pointer-events-none" style={{ left: marginL, top: marginT, width: usableW, height: usableH }}>
                  {Array.from({ length: modRows }).map((_, i) => {
                    const y = i * (rowH + rowGutter);
                    return <div key={i} className="absolute left-0 right-0 rounded-[2px] border border-dashed border-white/10" style={{ top: y, height: rowH, background: "rgba(74,138,244,0.04)" }}><span className="absolute -left-4 top-0 text-[7px] mono text-white/20">{i + 1}</span></div>;
                  })}
                  {Array.from({ length: modRows - 1 }).map((_, i) => {
                    const y = (i + 1) * rowH + i * rowGutter;
                    return <div key={`g${i}`} className="absolute left-0 right-0 h-[1px] flex items-center" style={{ top: y, height: rowGutter, background: "rgba(244,100,100,0.12)" }} />;
                  })}
                </div>
              )}

              {/* Snap guides */}
              {showGuides?.x !== undefined && <div className="absolute top-0 bottom-0 w-[2px] bg-[#ff5a7a] shadow-[0_0_8px_#ff5a7a] z-50 pointer-events-none" style={{ left: showGuides.x, animation: "snap-pulse 0.6s infinite" }} />}
              {showGuides?.y !== undefined && <div className="absolute left-0 right-0 h-[2px] bg-[#ff5a7a] shadow-[0_0_8px_#ff5a7a] z-50 pointer-events-none" style={{ top: showGuides.y, animation: "snap-pulse 0.6s infinite" }} />}

              {/* Widgets */}
              {widgets.map(w => {
                const isSel = w.id === selectedId;
                const x = marginL + w.colStart * (colW + gutter);
                const y = marginT + w.rowStart * (rowH + rowGutter);
                const ww = w.colSpan * colW + (w.colSpan - 1) * gutter;
                const hh = (gridType === "modular" || gridType === "combination") ? w.rowSpan * rowH + (w.rowSpan - 1) * rowGutter : undefined;
                return (
                  <div key={w.id} onPointerDown={e => handleWidgetMouseDown(e, w)}
                    className={`absolute rounded-[5px] border cursor-move select-none group ${isSel ? "border-[#4a8af4] shadow-[0_0_0_1px_#4a8af4,0_0_16px_rgba(74,138,244,0.5)] z-30" : "border-[#2a2b2e] hover:border-[#3a3b3e] z-10"}`}
                    style={{ left: x, top: y, width: ww, minHeight: hh, background: w.kind === "marginalia" ? "linear-gradient(180deg,#26272a,#1e1f22)" : "linear-gradient(180deg,#2d2e30,#1e1f21)" }}>
                    <div className="absolute inset-0 rounded-[5px] overflow-hidden pointer-events-none glossy-highlight" />
                    {/* Header */}
                    <div className="h-[18px] flex items-center px-2 gap-1.5 border-b border-black/60 bg-black/20 rounded-t-[5px]">
                      <div className={`w-[6px] h-[6px] rounded-full ${w.kind === "text" ? "bg-[#8ab4ff]" : w.kind === "image" ? "bg-[#ff9a8a]" : w.kind === "vstack" ? "bg-[#a8ff8a]" : w.kind === "hstack" ? "bg-[#ffde8a]" : w.kind === "flow" ? "bg-[#d8a8ff]" : "bg-[#8affd8]"}`} />
                      <span className="text-[8px] pro-label tracking-wide text-[#a0a2a4] truncate">{w.title}</span>
                      <span className="ml-auto text-[7px] mono text-[#5a5c5e]">{w.colStart + 1}:{w.colSpan} × {w.rowStart + 1}:{w.rowSpan}</span>
                    </div>
                    {/* Content */}
                    <div className="p-2">
                      {w.kind === "text" && (
                        <div className="space-y-1">
                          {[0, 1, 2].map(li => (
                            <div key={li} className="relative">
                              <div className="h-[12px] rounded-[2px] bg-[#3a3b3e]" style={{ width: `${92 - li * 14}%` }} />
                              <div className="absolute -bottom-[1px] left-0 right-0 h-[1px] bg-[#4a8af4]/30" title="baseline" />
                              <div className="absolute -bottom-[3px] left-0 w-[3px] h-[3px] rounded-full bg-[#4a8af4]" />
                            </div>
                          ))}
                          <div className="text-[8px] text-[#6a6c6e] mono mt-1">baseline-aligned • 3 lines</div>
                        </div>
                      )}
                      {w.kind === "image" && (
                        <div className="w-full h-[64px] rounded-[3px] pro-well flex flex-col items-center justify-center gap-1">
                          <div className="w-[22px] h-[16px] border border-[#3a3b3e] rounded-[2px] relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-br from-[#2a2b2e] to-[#1a1a1c]" /><div className="absolute bottom-0 left-0 right-0 h-[6px] bg-[#4a8af4]/20" /></div>
                          <span className="text-[8px] text-[#5a5c5e]">IMAGE WELL</span>
                          <span className="text-[7px] mono text-[#444]">2×2 cells</span>
                        </div>
                      )}
                      {w.kind === "vstack" && (
                        <div className="flex flex-col gap-1.5" style={{ gap: w.stack?.spacingBaselineUnits ? `${baseline}px` : `${w.stack?.spacing || 8}px` }}>
                          <div className="h-[14px] bg-[#2a2b2e] rounded-[2px] border border-[#333] flex items-center px-1.5 text-[9px] text-[#9a9c9e]">Label + Value</div>
                          <div className="h-[12px] rounded-full bg-[#0f0f10] border border-[#222] relative"><div className="absolute left-[20%] top-[2px] bottom-[2px] w-[40%] rounded-full bg-[#4a8af4]" /></div>
                          <div className="h-[18px] rounded-[3px] bg-gradient-to-b from-[#3a3b3e] to-[#242528] border border-black text-[9px] flex items-center justify-center text-[#c2c3c4]">Button</div>
                          <div className="text-[7px] mono text-[#555]">VStack spacing = {baseline}px baseline</div>
                        </div>
                      )}
                      {w.kind === "hstack" && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-[20px] px-2 rounded-[3px] bg-[#2a2b2e] border border-[#333] text-[8px] flex items-center text-[#aaa]">Btn</div>
                          <div className="h-[20px] px-2 rounded-[3px] bg-[#2a2b2e] border border-[#333] text-[8px] flex items-center text-[#aaa]">Btn</div>
                          <div className="h-[20px] px-2 rounded-[3px] bg-[#2a2b2e] border border-[#333] text-[8px] flex items-center text-[#aaa]">Btn</div>
                          <div className="flex-1 h-[1px] bg-[#333] border-t border-dashed border-[#444]" title="flexible spring" />
                          <div className="h-[20px] px-2 rounded-[3px] bg-[#4a8af4] text-white text-[8px] flex items-center">Action</div>
                        </div>
                      )}
                      {w.kind === "flow" && (
                        <div className="flex flex-wrap gap-1">
                          {["Drums","Bass","Vox","Keys","Gtr","Pad"].map(ch => (
                            <div key={ch} className="h-[16px] px-1.5 rounded-full bg-[#1f2022] border border-[#333] text-[8px] text-[#8a8c8e] flex items-center">{ch}</div>
                          ))}
                          <div className="text-[7px] text-[#555] w-full mt-1">Flow wraps when width ↓</div>
                        </div>
                      )}
                      {w.kind === "marginalia" && (
                        <div className="space-y-1.5">
                          <div className="text-[8px] text-[#8a8c8e] leading-[1.3]">Baseline pin → main text line 2. Stays outside but rhythm-linked.</div>
                          <div className="h-[1px] bg-[#4a8af4]/30" />
                          <div className="text-[7px] mono text-[#555]">SIDENOTE • meta</div>
                        </div>
                      )}
                      {(w.kind === "zstack" || w.kind === "gridContainer" || w.kind === "baselineBox") && (
                        <div className="text-[9px] text-[#7a7c7e]">{w.kind} — {w.colSpan} cols</div>
                      )}
                    </div>
                    {/* Resize dots */}
                    <div className="absolute -bottom-1 -right-1 w-[8px] h-[8px] rounded-[1px] bg-[#4a8af4] border border-black opacity-0 group-hover:opacity-100" />
                  </div>
                );
              })}

              {/* Marginalia zone */}
              {overlays.marginalia && (
                <div className="absolute top-0 bottom-0 border-l border-dashed border-[#444]/60 bg-[#0f0f10]/40 pointer-events-none" style={{ left: sheetWidth - 140 - 8, width: 140 }}>
                  <div className="p-2">
                    <div className="text-[8px] pro-label text-[#5a5c5e] tracking-[0.15em]">MARGINALIA — 140px</div>
                    <div className="text-[7px] text-[#444] mono mt-1 leading-[1.3]">sidenotes, tools, metadata. Dashed = outside flow but baseline-aligned.</div>
                    <div className="mt-3 space-y-2">
                      <div className="p-1.5 rounded-[3px] bg-[#1e1f22] border border-[#2a2b2e]"><div className="text-[8px] text-[#8a8c8e]">Comment pinned to baseline</div><div className="h-[1px] bg-[#4a8af4]/20 mt-1" /></div>
                      <div className="p-1.5 rounded-[3px] bg-[#1e1f22] border border-[#2a2b2e]"><div className="text-[8px] text-[#8a8c8e]">Track inspector note</div></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resize handle */}
              <div onPointerDown={resizeSheet} className="absolute bottom-0 right-0 w-[16px] h-[16px] cursor-ew-resize flex items-center justify-center bg-[#2a2b2e] border-l border-t border-black rounded-tl-[4px] hover:bg-[#333]">
                <div className="w-[8px] h-[8px] opacity-60" style={{ background: "repeating-linear-gradient( -45deg, #5a5c5e 0 1px, transparent 1px 3px)" }} />
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="h-[140px] shrink-0 pro-panel border-x-0 border-b-0 flex flex-col">
            <div className="h-[20px] flex items-center px-2 gap-2 bg-[#1a1b1d] border-b border-black">
              <span className="pro-label">CONTENT-AWARE LAYOUT • LIVE REFLOW</span>
              <span className="text-[9px] text-[#5a5c5e]">Drag dividers — same HStack + Flow at 3 widths</span>
              <span className="ml-auto text-[8px] mono text-[#555]">Print: gutters fixed, columns fluid. GUI: springs & flow wrap.</span>
            </div>
            <div className="flex-1 flex gap-px bg-black p-px">
              {contentWidths.map((cw, idx) => {
                const labels = ["Narrow 320", "Medium 600", "Wide 900"];
                return (
                  <div key={idx} className="flex-1 bg-[#1e1f22] relative flex flex-col overflow-hidden">
                    <div className="h-[18px] flex items-center px-2 bg-[#232426] border-b border-black/50">
                      <span className="text-[8px] mono text-[#7a7c7e]">{labels[idx]} • {cw}px</span>
                      <span className="ml-auto text-[7px] text-[#444]">{idx === 0 ? "wraps" : idx === 1 ? "balanced" : "spacious"}</span>
                    </div>
                    <div className="flex-1 p-2 overflow-hidden">
                      <div className="h-[22px] flex items-center gap-1 mb-2" style={{ width: cw, maxWidth: "100%" }}>
                        <div className="h-[18px] px-2 bg-[#2a2b2e] rounded-[2px] text-[7px] flex items-center text-[#999]">File</div>
                        <div className="h-[18px] px-2 bg-[#2a2b2e] rounded-[2px] text-[7px] flex items-center text-[#999]">Edit</div>
                        <div className="flex-1" />
                        <div className="h-[18px] px-2 bg-[#4a8af4] rounded-[2px] text-[7px] flex items-center text-white">Export</div>
                      </div>
                      <div className="flex flex-wrap gap-1" style={{ width: cw, maxWidth: "100%" }}>
                        {["Kick","Snare","HiHat","Bass","Pad","Lead","Vox","Fx"].slice(0, idx === 0 ? 4 : idx === 1 ? 6 : 8).map(t => (
                          <div key={t} className="h-[14px] px-1.5 rounded-full bg-[#252629] border border-[#333] text-[7px] text-[#777] flex items-center">{t}</div>
                        ))}
                      </div>
                      {cw < 400 && <div className="mt-2 text-[7px] text-[#ff8a8a]">↳ Flow wrapped to 2 rows</div>}
                    </div>
                    {/* divider drag */}
                    {idx < 2 && (
                      <div className="absolute top-0 bottom-0 right-0 w-[6px] cursor-col-resize hover:bg-[#4a8af4]/30 flex items-center justify-center"
                        onPointerDown={(e) => {
                          const startX = e.clientX;
                          const startW = contentWidths[idx];
                          const onMove = (ev: PointerEvent) => {
                            const dx = ev.clientX - startX;
                            const nw = [...contentWidths] as [number, number, number];
                            nw[idx] = Math.max(200, Math.min(700, startW + dx));
                            setContentWidths(nw);
                          };
                          const onUp = () => {
                            window.removeEventListener("pointermove", onMove);
                            window.removeEventListener("pointerup", onUp);
                          };
                          window.addEventListener("pointermove", onMove);
                          window.addEventListener("pointerup", onUp);
                        }}>
                        <div className="w-[1px] h-full bg-black/60" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right inspector */}
        <div className="w-[260px] shrink-0 pro-panel border-t-0 border-b-0 border-r-0 flex flex-col overflow-hidden">
          <div className="h-[22px] flex items-center px-2 bg-[#1a1b1d] border-b border-black pro-label">SELECTED WIDGET + STACKING</div>
          <div className="flex-1 overflow-auto">
            {!selected ? (
              <div className="p-3">
                <div className="pro-label mb-2">STACKING WIDGETS EXPLAINED</div>
                <div className="space-y-3 text-[10px] leading-[1.5] text-[#8a8c8e]">
                  {[
                    { name: "VStack", desc: "Stacks in Y, respects baseline between text items, spacing in baseline multiples.", ex: "1-col grid, row gutter = baseline" },
                    { name: "HStack", desc: "Stacks in X, alignment top/center/baseline/bottom, distribution leading/trailing/spaceBetween.", ex: "Row grid with springs" },
                    { name: "ZStack", desc: "Depth stacking for overlays, like print overprint. Baseline irrelevant, z-index matters.", ex: "Modular cell overlap" },
                    { name: "Flow/Wrap", desc: "Accounts for content area changes, wraps like print paragraphs when window narrows.", ex: "Paragraph with line breaks" },
                    { name: "Grid Container", desc: "Uses column/modular grid internally. Children snap to its own columns.", ex: "Nested grid system" },
                    { name: "Baseline Box", desc: "Forces children to sit on baseline grid. Like forcing type to baseline in InDesign.", ex: "Baseline lock" },
                  ].map(s => (
                    <div key={s.name} className="p-2 rounded-[3px] bg-[#1c1d1f] border border-[#222]">
                      <div className="text-[#c2c3c4] font-semibold text-[11px]">{s.name}</div>
                      <div className="mt-1">{s.desc}</div>
                      <div className="mt-1 text-[9px] mono text-[#4a8af4]">↳ {s.ex}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-[28px] h-[28px] rounded-[4px] bg-[#0f0f10] border border-[#222] flex items-center justify-center text-[14px]">◧</div>
                  <div>
                    <div className="text-[11px] text-[#d0d1d2] font-semibold">{selected.title}</div>
                    <div className="text-[9px] mono text-[#6a6c6e]">{selected.kind} • {selected.id}</div>
                  </div>
                  <button onClick={() => { const next = widgets.filter(w => w.id !== selected.id); setWidgets(next); persistWidgets(next); }} className="ml-auto text-[9px] px-2 h-[18px] rounded-[2px] bg-[#2a1f1f] border border-[#442] text-[#ff8a8a]">Delete</button>
                </div>

                <div className="pro-well rounded-[4px] p-2">
                  <div className="pro-label mb-2">GRID PLACEMENT</div>
                  <ProSlider label="Col Start" value={selected.colStart} min={0} max={columns - 1} onChange={v => updateSelected({ colStart: v })} unit="" />
                  <ProSlider label="Col Span" value={selected.colSpan} min={1} max={columns} onChange={v => updateSelected({ colSpan: Math.min(v, columns - selected.colStart) })} unit="" />
                  <ProSlider label="Row Start" value={selected.rowStart} min={0} max={modRows - 1} onChange={v => updateSelected({ rowStart: v })} unit="" />
                  <ProSlider label="Row Span" value={selected.rowSpan} min={1} max={modRows} onChange={v => updateSelected({ rowSpan: v })} unit="" />
                  <div className="mt-2 flex gap-1">
                    {(["none","top","baseline","bottom"] as BaselineAlign[]).map(b => (
                      <button key={b} onClick={() => updateSelected({ baselineAlign: b })} className={`flex-1 h-[20px] rounded-[2px] text-[8px] border ${selected.baselineAlign === b ? "bg-[#4a8af4] text-white border-[#4a8af4]" : "bg-[#232426] text-[#7a7c7e] border-black"}`}>{b.toUpperCase()}</button>
                    ))}
                  </div>
                </div>

                {(selected.kind === "vstack" || selected.kind === "hstack" || selected.kind === "flow") && selected.stack && (
                  <div className="pro-well rounded-[4px] p-2">
                    <div className="pro-label mb-2">STACKING <span className="text-[#4a8af4]">{selected.stack.direction}</span></div>
                    <ProSlider label="Spacing" value={selected.stack.spacing} min={0} max={32} onChange={v => updateSelected({ stack: { ...selected.stack!, spacing: v } })} />
                    <div className="flex items-center gap-2 mt-1">
                      <label className="flex items-center gap-1 text-[9px] text-[#7a7c7e]"><input type="checkbox" checked={selected.stack.spacingBaselineUnits} onChange={e => updateSelected({ stack: { ...selected.stack!, spacingBaselineUnits: e.target.checked } })} className="accent-[#4a8af4]" /> baseline units</label>
                    </div>
                    <div className="mt-2">
                      <div className="pro-label text-[8px]">Distribution</div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {(["leading","center","trailing","spaceBetween","fill"] as const).map(d => (
                          <button key={d} onClick={() => updateSelected({ stack: { ...selected.stack!, distribution: d } })} className={`h-[18px] rounded-[2px] text-[8px] border ${selected.stack!.distribution === d ? "bg-[#4a8af4] text-white border-[#4a8af4]" : "bg-[#232426] text-[#7a7c7e] border-black"}`}>{d}</button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="pro-label text-[8px]">Alignment</div>
                      <div className="flex gap-1 mt-1">
                        {(["top","center","baseline","bottom"] as const).map(a => (
                          <button key={a} onClick={() => updateSelected({ stack: { ...selected.stack!, alignment: a } })} className={`flex-1 h-[18px] rounded-[2px] text-[8px] border ${selected.stack!.alignment === a ? "bg-[#4a8af4] text-white border-[#4a8af4]" : "bg-[#232426] text-[#7a7c7e] border-black"}`}>{a}</button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 p-1.5 rounded-[2px] bg-[#0a0a0b] border border-[#222] mono text-[8px] text-[#6a6c6e]">
                      This {selected.kind.toUpperCase()} = {selected.stack.direction === "vertical" ? "1-column grid" : "row grid"} with {selected.stack.spacingBaselineUnits ? `${Math.round(selected.stack.spacing / baseline)}×baseline` : `${selected.stack.spacing}px`} gutter<br />
                      {selected.kind === "hstack" && selected.struts?.hSpring ? "• hSpring expands with window" : "• fixed width"}
                    </div>
                  </div>
                )}

                {/* Springs & Struts */}
                <div className="pro-well rounded-[4px] p-2">
                  <div className="pro-label mb-2 flex items-center">SPRINGS & STRUTS <InfoTip k="column" /></div>
                  <div className="flex justify-center">
                    <div className="w-[90px] h-[90px] relative bg-[#0a0a0b] border border-[#222] rounded-[4px]">
                      {/* outer box */}
                      <div className="absolute inset-[12px] border border-[#333] rounded-[1px]" />
                      {/* struts */}
                      {[
                        { key: "top", style: { top: 4, left: "50%", width: 12, height: 4, marginLeft: -6 } },
                        { key: "bottom", style: { bottom: 4, left: "50%", width: 12, height: 4, marginLeft: -6 } },
                        { key: "left", style: { left: 4, top: "50%", width: 4, height: 12, marginTop: -6 } },
                        { key: "right", style: { right: 4, top: "50%", width: 4, height: 12, marginTop: -6 } },
                      ].map(s => (
                        <button key={s.key} onClick={() => updateSelected({ struts: { ...selected.struts!, [s.key]: !selected.struts?.[s.key as keyof Struts] } as Struts })}
                          className="absolute rounded-[1px]" style={s.style as any}>
                          <div className={`w-full h-full rounded-[1px] border ${selected.struts?.[s.key as keyof Struts] ? "bg-[#ff5a7a] border-[#ff5a7a]" : "bg-[#2a2b2e] border-[#444]"}`} />
                        </button>
                      ))}
                      {/* springs */}
                      <button onClick={() => updateSelected({ struts: { ...selected.struts!, hSpring: !selected.struts?.hSpring } as Struts })} className="absolute top-1/2 left-[18px] right-[18px] h-[6px] -mt-[3px]">
                        <div className={`h-full rounded-full ${selected.struts?.hSpring ? "bg-[#4a8af4]" : "bg-[#333]"} flex items-center justify-center`}><div className="w-full h-[2px] bg-[repeating-linear-gradient(90deg,#fff_0_2px,transparent_2px_4px)] opacity-60" /></div>
                      </button>
                      <button onClick={() => updateSelected({ struts: { ...selected.struts!, vSpring: !selected.struts?.vSpring } as Struts })} className="absolute left-1/2 top-[18px] bottom-[18px] w-[6px] -ml-[3px]">
                        <div className={`w-full h-full rounded-full ${selected.struts?.vSpring ? "bg-[#4a8af4]" : "bg-[#333]"} flex items-center justify-center`}><div className="w-[2px] h-full bg-[repeating-linear-gradient(0deg,#fff_0_2px,transparent_2px_4px)] opacity-60" /></div>
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[8px] mono text-[#5a5c5e]">
                    <span>top: {selected.struts?.top ? "■" : "□"}</span>
                    <span>hSpring: {selected.struts?.hSpring ? "〰" : "—"}</span>
                    <span>left: {selected.struts?.left ? "■" : "□"}</span>
                  </div>
                </div>

                <div className="rounded-[4px] bg-[#1c1d1f] border border-[#2a2b2e] p-2">
                  <div className="pro-label text-[8px]">PRINT ANALOGY</div>
                  <div className="text-[9px] text-[#8a8c8e] leading-[1.4] mt-1">
                    {selected.kind === "vstack" && "VStack = single column text flow. Spacing in baseline units = leading. Like InDesign paragraph spacing."}
                    {selected.kind === "hstack" && "HStack = row of inline blocks with springs = flexible space between words. Justification = distribution."}
                    {selected.kind === "flow" && "Flow = justified paragraph that wraps. Content-aware: reflows when content area changes, like text reflow on resize."}
                    {selected.kind === "text" && "Text Block spans columns. Baselines lock to grid — all columns share same horizontal rhythm for readability."}
                    {selected.kind === "marginalia" && "Marginalia: outside main text block but baseline-pinned. Like DAW track comments or Finder info panel."}
                    {selected.kind === "image" && "Image Well uses modular cells: 2 cols × 2 rows. Modular grid allows both horizontal and vertical rhythm."}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="h-[22px] flex items-center px-2 bg-[#1a1b1d] border-t border-black text-[8px] mono text-[#555]">SEL: {selectedId || "none"} • {widgets.length} widgets • baseline {baseline}px</div>
        </div>
      </div>

      {/* Footer */}
      <div className="h-[26px] shrink-0 flex items-center px-3 gap-3 bg-[#151517] border-t border-black text-[10px] text-[#6a6c6e]">
        <span className="text-[#8a8c8e]">Print conventions (gutters, marginalia, baseline) + GUI stacking (VStack/HStack/Flow) = layout system that handles window resizing while keeping typographic rhythm</span>
        <span className="ml-auto mono text-[9px] text-[#444]">Logic Pro 8 / Final Cut 7 style • 2008 Pro App Lab • Dark #121214</span>
      </div>
    </div>
  );
}
