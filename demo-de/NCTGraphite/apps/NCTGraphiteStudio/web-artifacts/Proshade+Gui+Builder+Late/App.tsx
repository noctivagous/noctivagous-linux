import React, { useEffect, useRef, useState, useMemo } from "react";

// Types
type Device = "desktop" | "tablet" | "phone";
type WidgetType =
  | "pro-button"
  | "text-label"
  | "input-field"
  | "text-area"
  | "slider"
  | "knob"
  | "toggle"
  | "checkbox"
  | "progress"
  | "panel"
  | "list-box"
  | "tab-bar"
  | "toolbar-strip"
  | "image-well"
  | "separator"
  | "icon-button"
  | "segmented-control";

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  parentId: string | null;
  props: {
    title?: string;
    styleVariant?: string;
    radius?: number;
    opacity?: number;
    icon?: string;
    value?: number;
    checked?: boolean;
    placeholder?: string;
    segments?: string[];
    selectedSegment?: number;
    tabs?: string[];
    selectedTab?: number;
    rows?: string[];
  };
  layouts: Record<Device, LayoutRect>;
  locked?: boolean;
  visible?: boolean;
}

interface PaletteDef {
  type: WidgetType;
  label: string;
  cat: string;
  w: number;
  h: number;
  icon: string;
}

const PALETTE: PaletteDef[] = [
  { type: "pro-button", label: "Pro Button", cat: "CONTROLS", w: 110, h: 26, icon: "◫" },
  { type: "icon-button", label: "Icon Button", cat: "CONTROLS", w: 32, h: 32, icon: "◈" },
  { type: "segmented-control", label: "Segmented Control", cat: "CONTROLS", w: 160, h: 26, icon: "⧉" },
  { type: "slider", label: "Slider", cat: "CONTROLS", w: 140, h: 22, icon: "—◉—" },
  { type: "knob", label: "Knob / Dial", cat: "CONTROLS", w: 56, h: 56, icon: "◎" },
  { type: "toggle", label: "Toggle Switch", cat: "CONTROLS", w: 54, h: 28, icon: "◐" },
  { type: "text-label", label: "Text Label", cat: "INPUTS", w: 90, h: 18, icon: "T" },
  { type: "input-field", label: "Input Field", cat: "INPUTS", w: 160, h: 24, icon: "▭" },
  { type: "text-area", label: "Text Area", cat: "INPUTS", w: 180, h: 90, icon: "☰" },
  { type: "checkbox", label: "Checkbox", cat: "INPUTS", w: 120, h: 20, icon: "☑" },
  { type: "panel", label: "Panel / Container", cat: "CONTAINERS", w: 260, h: 180, icon: "▣" },
  { type: "tab-bar", label: "Tab Bar", cat: "CONTAINERS", w: 260, h: 34, icon: "⧂" },
  { type: "toolbar-strip", label: "Toolbar Strip", cat: "CONTAINERS", w: 960, h: 38, icon: "⬒" },
  { type: "list-box", label: "List Box", cat: "CONTAINERS", w: 180, h: 140, icon: "☷" },
  { type: "image-well", label: "Image Well", cat: "MEDIA", w: 120, h: 90, icon: "🖼" },
  { type: "separator", label: "Separator", cat: "MEDIA", w: 120, h: 2, icon: "―" },
  { type: "progress", label: "Progress Bar", cat: "MEDIA", w: 140, h: 14, icon: "▬" },
];

const CATS = ["CONTROLS", "INPUTS", "CONTAINERS", "MEDIA", "NAV"];

const DEFAULT_PROPS: Record<WidgetType, any> = {
  "pro-button": { title: "Button", styleVariant: "default", radius: 14 },
  "icon-button": { title: "★", radius: 6 },
  "segmented-control": { segments: ["One", "Two", "Three"], selectedSegment: 0, radius: 6 },
  slider: { value: 42, title: "Level" },
  knob: { value: 65, title: "Gain" },
  toggle: { checked: true },
  "text-label": { title: "Label Text" },
  "input-field": { title: "Text Field", placeholder: "Enter text" },
  "text-area": { title: "Lorem ipsum dolor sit amet, consectetur.", placeholder: "" },
  checkbox: { title: "Enable Option", checked: false },
  panel: { title: "Panel", radius: 8, opacity: 1 },
  "tab-bar": { tabs: ["Mix", "Edit", "Browser"], selectedTab: 0 },
  "toolbar-strip": { title: "Toolbar" },
  "list-box": { rows: ["Kick 01.wav", "Snare Tight.aif", "HiHat Closed", "Bass Synth", "Pad Warm", "Lead Sine"], title: "Library" },
  "image-well": { title: "Drop Image" },
  separator: { title: "" },
  progress: { value: 68 },
};

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function cloneLayouts(rect: LayoutRect): Record<Device, LayoutRect> {
  return {
    desktop: { ...rect },
    tablet: { ...rect, x: Math.min(rect.x, 700), w: Math.min(rect.w, 700) },
    phone: { ...rect, x: Math.min(rect.x, 320), w: Math.min(rect.w, 350) },
  };
}

const INITIAL_WIDGETS: Widget[] = [
  {
    id: "w_toolbar",
    type: "toolbar-strip",
    x: 0,
    y: 0,
    w: 960,
    h: 38,
    parentId: null,
    props: { title: "Toolbar" },
    layouts: {
      desktop: { x: 0, y: 0, w: 960, h: 38 },
      tablet: { x: 0, y: 0, w: 768, h: 38 },
      phone: { x: 0, y: 0, w: 390, h: 44 },
    },
  },
  {
    id: "w_panel",
    type: "panel",
    x: 32,
    y: 64,
    w: 340,
    h: 200,
    parentId: null,
    props: { title: "Channel Strip", radius: 8 },
    layouts: {
      desktop: { x: 32, y: 64, w: 340, h: 200 },
      tablet: { x: 24, y: 64, w: 340, h: 200 },
      phone: { x: 16, y: 64, w: 358, h: 190 },
    },
  },
  {
    id: "w_btn1",
    type: "pro-button",
    x: 18,
    y: 18,
    w: 110,
    h: 26,
    parentId: "w_panel",
    props: { title: "Action", styleVariant: "blue", radius: 14 },
    layouts: {
      desktop: { x: 18, y: 18, w: 110, h: 26 },
      tablet: { x: 18, y: 18, w: 110, h: 26 },
      phone: { x: 18, y: 18, w: 100, h: 28 },
    },
  },
  {
    id: "w_btn2",
    type: "pro-button",
    x: 142,
    y: 18,
    w: 110,
    h: 26,
    parentId: "w_panel",
    props: { title: "Cancel", styleVariant: "default", radius: 14 },
    layouts: {
      desktop: { x: 142, y: 18, w: 110, h: 26 },
      tablet: { x: 142, y: 18, w: 110, h: 26 },
      phone: { x: 132, y: 18, w: 100, h: 28 },
    },
  },
  {
    id: "w_slider",
    type: "slider",
    x: 18,
    y: 72,
    w: 304,
    h: 26,
    parentId: "w_panel",
    props: { title: "Volume", value: 58 },
    layouts: {
      desktop: { x: 18, y: 72, w: 304, h: 26 },
      tablet: { x: 18, y: 72, w: 304, h: 26 },
      phone: { x: 18, y: 68, w: 322, h: 26 },
    },
  },
  {
    id: "w_knob",
    type: "knob",
    x: 18,
    y: 120,
    w: 56,
    h: 56,
    parentId: "w_panel",
    props: { title: "Pan", value: 30 },
    layouts: {
      desktop: { x: 18, y: 120, w: 56, h: 56 },
      tablet: { x: 18, y: 120, w: 56, h: 56 },
      phone: { x: 18, y: 114, w: 56, h: 56 },
    },
  },
  {
    id: "w_toggle",
    type: "toggle",
    x: 110,
    y: 132,
    w: 54,
    h: 28,
    parentId: "w_panel",
    props: { checked: true },
    layouts: {
      desktop: { x: 110, y: 132, w: 54, h: 28 },
      tablet: { x: 110, y: 132, w: 54, h: 28 },
      phone: { x: 110, y: 126, w: 54, h: 28 },
    },
  },
  {
    id: "w_list",
    type: "list-box",
    x: 408,
    y: 64,
    w: 220,
    h: 240,
    parentId: null,
    props: { rows: ["Kick 01.wav", "Snare Tight.aif", "HiHat Closed", "Bass Synth", "Pad Warm", "Lead Sine", "Vox Chop", "FX Riser"], title: "Media" },
    layouts: {
      desktop: { x: 408, y: 64, w: 220, h: 240 },
      tablet: { x: 408, y: 64, w: 320, h: 240 },
      phone: { x: 16, y: 280, w: 358, h: 180 },
    },
  },
  {
    id: "w_label",
    type: "text-label",
    x: 408,
    y: 320,
    w: 180,
    h: 18,
    parentId: null,
    props: { title: "Output: Stereo Out" },
    layouts: {
      desktop: { x: 408, y: 320, w: 180, h: 18 },
      tablet: { x: 408, y: 320, w: 180, h: 18 },
      phone: { x: 16, y: 476, w: 180, h: 18 },
    },
  },
];

export default function App() {
  const [widgets, setWidgets] = useState<Widget[]>(INITIAL_WIDGETS);
  const [selectedId, setSelectedId] = useState<string | null>("w_panel");
  const [device, setDevice] = useState<Device>("desktop");
  const [separateLayouts, setSeparateLayouts] = useState<boolean>(false);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [gridEnabled, setGridEnabled] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [paletteDrag, setPaletteDrag] = useState<{ type: WidgetType; x: number; y: number; w: number; h: number } | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [editingTitle, setEditingTitle] = useState(false);

  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const dragMoveRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; parentAbs: { x: number; y: number } | null } | null>(null);
  const dragResizeRef = useRef<{ id: string; dir: string; startX: number; startY: number; orig: LayoutRect; parentAbs: { x: number; y: number } | null } | null>(null);
  const isDraggingRef = useRef(false);

  // records persistence
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("actions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "records.list", args: { collection: "proshade_projects", limit: 1 } }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.data && json.data.records && json.data.records.length > 0) {
          const rec = json.data.records[0];
          const v = rec.value;
          if (v && Array.isArray(v.widgets) && v.widgets.length > 0) {
            setWidgets(v.widgets);
            if (v.device) setDevice(v.device);
            if (typeof v.separateLayouts === "boolean") setSeparateLayouts(v.separateLayouts);
            setSavedRecordId(rec.id);
            setSaveStatus("Loaded saved project");
            setTimeout(() => setSaveStatus(""), 2000);
          }
        }
      } catch {}
    })();
  }, []);

  const selectedWidget = useMemo(() => widgets.find((w) => w.id === selectedId) || null, [widgets, selectedId]);

  function getLayout(widget: Widget, dev: Device): LayoutRect {
    return widget.layouts[dev] || { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
  }

  function getAbsolutePos(widgetId: string, all: Widget[], dev: Device): { x: number; y: number } {
    let x = 0,
      y = 0;
    let curr = all.find((w) => w.id === widgetId);
    const chain: Widget[] = [];
    while (curr) {
      chain.unshift(curr);
      if (!curr.parentId) break;
      curr = all.find((w) => w.id === curr!.parentId) || undefined;
    }
    for (const w of chain) {
      const l = getLayout(w, dev);
      x += l.x;
      y += l.y;
    }
    return { x, y };
  }

  function updateWidgetLayout(id: string, dev: Device, patch: Partial<LayoutRect>, separate: boolean) {
    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const newLayouts = { ...w.layouts };
        if (separate) {
          newLayouts[dev] = { ...newLayouts[dev], ...patch };
        } else {
          // update all devices
          (Object.keys(newLayouts) as Device[]).forEach((d) => {
            newLayouts[d] = { ...newLayouts[d], ...patch };
          });
          // also update base for compat
        }
        const basePatch = separate ? {} : patch;
        return { ...w, ...basePatch, layouts: newLayouts };
      })
    );
  }

  function updateWidgetProps(id: string, propsPatch: any) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, props: { ...w.props, ...propsPatch } } : w)));
  }

  // global mouse handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (paletteDrag) {
        setPaletteDrag((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : null));
      }
      if (dragMoveRef.current) {
        isDraggingRef.current = true;
        const dm = dragMoveRef.current;
        const dx = e.clientX - dm.startX;
        const dy = e.clientY - dm.startY;
        let nx = dm.origX + dx;
        let ny = dm.origY + dy;
        if (snapEnabled) {
          nx = Math.round(nx / 10) * 10;
          ny = Math.round(ny / 10) * 10;
        }
        // clamp
        nx = Math.max(-20, nx);
        ny = Math.max(-20, ny);
        updateWidgetLayout(dm.id, device, { x: nx, y: ny }, separateLayouts);
      }
      if (dragResizeRef.current) {
        isDraggingRef.current = true;
        const dr = dragResizeRef.current;
        const dx = e.clientX - dr.startX;
        const dy = e.clientY - dr.startY;
        let { x, y, w, h } = dr.orig;
        const dir = dr.dir;
        if (dir.includes("e")) w = Math.max(20, dr.orig.w + dx);
        if (dir.includes("s")) h = Math.max(14, dr.orig.h + dy);
        if (dir.includes("w")) {
          const newW = Math.max(20, dr.orig.w - dx);
          x = dr.orig.x + (dr.orig.w - newW);
          w = newW;
        }
        if (dir.includes("n")) {
          const newH = Math.max(14, dr.orig.h - dy);
          y = dr.orig.y + (dr.orig.h - newH);
          h = newH;
        }
        if (snapEnabled) {
          w = Math.round(w / 10) * 10;
          h = Math.round(h / 10) * 10;
          x = Math.round(x / 10) * 10;
          y = Math.round(y / 10) * 10;
        }
        updateWidgetLayout(dr.id, device, { x, y, w, h }, separateLayouts);
      }
    };
    const onUp = (e: MouseEvent) => {
      if (paletteDrag) {
        // check if over canvas content
        const rect = canvasContentRef.current?.getBoundingClientRect();
        if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const def = PALETTE.find((p) => p.type === paletteDrag.type);
          if (def) {
            const dropX = e.clientX - rect.left - def.w / 2;
            const dropY = e.clientY - rect.top - def.h / 2;
            // find container
            let parentId: string | null = null;
            let relX = dropX;
            let relY = dropY;
            const containers = widgets.filter((w) => w.type === "panel" && (w.visible !== false));
            // compute absolute positions
            const candidates: { id: string; abs: { x: number; y: number }; area: number }[] = [];
            for (const c of containers) {
              const abs = getAbsolutePos(c.id, widgets, device);
              const lay = getLayout(c, device);
              if (dropX >= abs.x && dropX <= abs.x + lay.w && dropY >= abs.y && dropY <= abs.y + lay.h) {
                candidates.push({ id: c.id, abs, area: lay.w * lay.h });
              }
            }
            if (candidates.length > 0) {
              candidates.sort((a, b) => a.area - b.area);
              const best = candidates[0];
              parentId = best.id;
              relX = dropX - best.abs.x;
              relY = dropY - best.abs.y;
            }
            const newId = genId();
            const baseRect = { x: parentId ? relX : dropX, y: parentId ? relY : dropY, w: def.w, h: def.h };
            const newWidget: Widget = {
              id: newId,
              type: def.type,
              x: baseRect.x,
              y: baseRect.y,
              w: baseRect.w,
              h: baseRect.h,
              parentId,
              props: { ...(DEFAULT_PROPS[def.type] || { title: def.label }), title: DEFAULT_PROPS[def.type]?.title || def.label },
              layouts: cloneLayouts(baseRect),
            };
            // adjust toolbar strip to full width if parent null and device
            if (def.type === "toolbar-strip" && !parentId) {
              const fullW = device === "desktop" ? 960 : device === "tablet" ? 768 : 390;
              newWidget.layouts = {
                desktop: { x: 0, y: dropY, w: 960, h: 38 },
                tablet: { x: 0, y: dropY, w: 768, h: 38 },
                phone: { x: 0, y: dropY, w: 390, h: 44 },
              };
              newWidget.x = 0;
              newWidget.w = fullW;
            }
            setWidgets((prev) => [...prev, newWidget]);
            setSelectedId(newId);
          }
        }
        setPaletteDrag(null);
      }
      if (dragMoveRef.current || dragResizeRef.current) {
        setTimeout(() => (isDraggingRef.current = false), 0);
      }
      dragMoveRef.current = null;
      dragResizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [paletteDrag, widgets, device, snapEnabled, separateLayouts]);

  // keyboard delete/duplicate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        // delete selected and children
        const toDelete = new Set<string>();
        const collect = (id: string) => {
          toDelete.add(id);
          widgets.filter((w) => w.parentId === id).forEach((c) => collect(c.id));
        };
        collect(selectedId);
        setWidgets((prev) => prev.filter((w) => !toDelete.has(w.id)));
        setSelectedId(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        const w = widgets.find((x) => x.id === selectedId);
        if (!w) return;
        const newId = genId();
        const lay = getLayout(w, device);
        const newW: Widget = {
          ...w,
          id: newId,
          x: lay.x + 20,
          y: lay.y + 20,
          layouts: {
            desktop: { ...w.layouts.desktop, x: w.layouts.desktop.x + 20, y: w.layouts.desktop.y + 20 },
            tablet: { ...w.layouts.tablet, x: w.layouts.tablet.x + 20, y: w.layouts.tablet.y + 20 },
            phone: { ...w.layouts.phone, x: w.layouts.phone.x + 20, y: w.layouts.phone.y + 20 },
          },
        };
        setWidgets((prev) => [...prev, newW]);
        setSelectedId(newId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, widgets, device]);

  const deviceFrame = useMemo(() => {
    if (device === "desktop") return { w: 960, h: 600, outerW: 960, outerH: 600 };
    if (device === "tablet") return { w: 768, h: 1024, outerW: 800, outerH: 1088 };
    return { w: 390, h: 844, outerW: 414, outerH: 876 };
  }, [device]);

  function handleSave() {
    (async () => {
      setSaveStatus("Saving...");
      const value = { widgets, device, separateLayouts, updated: Date.now() };
      try {
        if (savedRecordId) {
          const res = await fetch("actions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "records.replace", args: { collection: "proshade_projects", id: savedRecordId, value } }),
          });
          const j = await res.json();
          if (j.error) throw new Error(j.error);
          setSaveStatus("Saved");
        } else {
          const res = await fetch("actions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "records.create", args: { collection: "proshade_projects", value } }),
          });
          const j = await res.json();
          if (j.error) throw new Error(j.error);
          setSavedRecordId(j.data.id);
          setSaveStatus("Saved");
        }
        setTimeout(() => setSaveStatus(""), 2000);
      } catch (e: any) {
        setSaveStatus(e.message || "Save failed");
      }
    })();
  }

  // Recursive renderer
  const renderTree = (parentId: string | null): React.ReactNode => {
    const children = widgets.filter((w) => w.parentId === parentId && w.visible !== false).sort((a, b) => (a.type === "toolbar-strip" ? -1 : 0));
    return children.map((w) => {
      const lay = getLayout(w, device);
      const isSelected = selectedId === w.id;
      const isHover = hoverId === w.id;
      const commonStyle: React.CSSProperties = {
        position: "absolute",
        left: lay.x,
        top: lay.y,
        width: lay.w,
        height: lay.h,
        opacity: w.props.opacity ?? 1,
        zIndex: isSelected ? 10 : w.type === "toolbar-strip" ? 5 : 1,
        cursor: dragMoveRef.current ? "grabbing" : "grab",
        userSelect: "none",
      };

      const handleMouseDown = (e: React.MouseEvent) => {
        if (w.locked) return;
        e.stopPropagation();
        setSelectedId(w.id);
        const parentAbs = w.parentId ? getAbsolutePos(w.parentId, widgets, device) : null;
        dragMoveRef.current = {
          id: w.id,
          startX: e.clientX,
          startY: e.clientY,
          origX: lay.x,
          origY: lay.y,
          parentAbs,
        };
      };

      const handleResizeMouseDown = (e: React.MouseEvent, dir: string) => {
        e.stopPropagation();
        const parentAbs = w.parentId ? getAbsolutePos(w.parentId, widgets, device) : null;
        dragResizeRef.current = {
          id: w.id,
          dir,
          startX: e.clientX,
          startY: e.clientY,
          orig: { ...lay },
          parentAbs,
        };
      };

      let inner: React.ReactNode = null;

      // --- widget visual implementations ---
      if (w.type === "pro-button") {
        const isBlue = w.props.styleVariant === "blue";
        inner = (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: w.props.radius ?? 14,
              background: isBlue
                ? "linear-gradient(180deg, #6aa6ff 0%, #4a8af4 45%, #2a5cb0 100%)"
                : "linear-gradient(180deg, #4a4c4f 0%, #3a3c3f 48%, #2a2c2f 100%)",
              border: "1px solid #080808",
              borderTop: "1px solid rgba(255,255,255,0.22)",
              boxShadow: isBlue
                ? "inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.6), 0 0 10px rgba(74,138,244,0.4)"
                : "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.6)",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "52%",
                background: "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.02) 100%)",
                borderRadius: `${(w.props.radius ?? 14) - 1}px ${(w.props.radius ?? 14) - 1}px 0 0`,
                pointerEvents: "none",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: isBlue ? "#fff" : "#e6e6e6",
                textShadow: isBlue ? "0 -1px 0 rgba(0,0,0,0.5)" : "0 -1px 0 rgba(0,0,0,0.9)",
                letterSpacing: 0.2,
                position: "relative",
                zIndex: 1,
              }}
            >
              {w.props.title || "Button"}
            </span>
          </div>
        );
      } else if (w.type === "text-label") {
        inner = (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 4px" }}>
            <span
              style={{
                fontSize: 11,
                color: "#c2c4c6",
                textShadow: "0 1px 0 rgba(0,0,0,0.8)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {w.props.title || "Label"}
            </span>
          </div>
        );
      } else if (w.type === "input-field") {
        inner = (
          <div className="pro-inset-well" style={{ width: "100%", height: "100%", borderRadius: 5, display: "flex", alignItems: "center", padding: "0 8px", position: "relative" }}>
            <span style={{ fontSize: 11, color: "#8a8c8e", opacity: 0.9 }}>{w.props.title || "Text Field"}</span>
            <div style={{ position: "absolute", top: 1, left: 1, right: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>
        );
      } else if (w.type === "text-area") {
        inner = (
          <div className="pro-inset-well" style={{ width: "100%", height: "100%", borderRadius: 6, padding: 8, overflow: "hidden" }}>
            <div style={{ fontSize: 11, color: "#9a9c9e", lineHeight: "14px" }}>{w.props.title}</div>
          </div>
        );
      } else if (w.type === "slider") {
        const pct = w.props.value ?? 40;
        inner = (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, padding: "0 6px" }}>
            <div style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 0.8 }}>{w.props.title || "Slider"}</div>
            <div style={{ position: "relative", height: 12, display: "flex", alignItems: "center" }}>
              <div className="pro-inset-well" style={{ width: "100%", height: 6, borderRadius: 3, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: "linear-gradient(180deg, #5a9cff, #2a5cb0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }} />
              </div>
              <div
                style={{
                  position: "absolute",
                  left: `calc(${pct}% - 9px)`,
                  top: -2,
                  width: 18,
                  height: 16,
                  borderRadius: 8,
                  background: "linear-gradient(180deg, #5a5c5f, #2a2c2f)",
                  border: "1px solid #0a0a0a",
                  borderTop: "1px solid rgba(255,255,255,0.2)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.2)",
                }}
              >
                <div style={{ width: "100%", height: "50%", background: "linear-gradient(180deg, rgba(255,255,255,0.22), transparent)", borderRadius: "8px 8px 0 0" }} />
              </div>
            </div>
          </div>
        );
      } else if (w.type === "knob") {
        const val = w.props.value ?? 50;
        const rot = (val / 100) * 270 - 135;
        inner = (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                background: "radial-gradient(120% 120% at 30% 20%, #4a4c4f, #1e1f21 70%)",
                border: "1px solid #0a0a0a",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 6px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(0,0,0,0.8)",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 2,
                  height: 16,
                  background: "#4a8af4",
                  transformOrigin: "50% 100%",
                  transform: `translate(-50%, -100%) rotate(${rot}deg)`,
                  boxShadow: "0 0 4px #4a8af4",
                  borderRadius: 1,
                }}
              />
              <div style={{ position: "absolute", left: "50%", top: "50%", width: 6, height: 6, background: "#2a2c2f", borderRadius: 3, transform: "translate(-50%,-50%)", border: "1px solid #000" }} />
            </div>
            <div style={{ fontSize: 9, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 0.6 }}>{w.props.title || "Knob"}</div>
          </div>
        );
      } else if (w.type === "toggle") {
        const on = w.props.checked;
        inner = (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              className="pro-inset-well"
              style={{
                width: 54,
                height: 28,
                borderRadius: 14,
                position: "relative",
                background: on ? "linear-gradient(180deg, #2a5cb0, #4a8af4)" : "#0f0f10",
                boxShadow: on ? "inset 0 1px 3px rgba(0,0,0,0.6), 0 0 8px rgba(74,138,244,0.4)" : "inset 0 1px 3px rgba(0,0,0,0.9)",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: on ? 28 : 2,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  background: "linear-gradient(180deg, #f0f0f0, #a0a0a0)",
                  border: "1px solid #000",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.8)",
                  transition: "left 0.15s",
                }}
              />
            </div>
          </div>
        );
      } else if (w.type === "checkbox") {
        inner = (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 6, padding: "0 4px" }}>
            <div
              className="pro-inset-well"
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: w.props.checked ? "linear-gradient(180deg, #4a8af4, #2a5cb0)" : "#0f0f10",
              }}
            >
              {w.props.checked && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ fontSize: 11, color: "#b0b2b4" }}>{w.props.title || "Checkbox"}</span>
          </div>
        );
      } else if (w.type === "progress") {
        inner = (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
            <div className="pro-inset-well" style={{ width: "100%", height: 10, borderRadius: 5, overflow: "hidden", position: "relative" }}>
              <div style={{ width: `${w.props.value || 50}%`, height: "100%", background: "linear-gradient(180deg, #7ab4ff, #2a5cb0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }} />
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(180deg, rgba(255,255,255,0.18), transparent)" }} />
            </div>
          </div>
        );
      } else if (w.type === "panel") {
        inner = (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: w.props.radius ?? 8,
              background: "linear-gradient(180deg, #2d2e30 0%, #242528 18%, #1e1f21 100%)",
              border: "1px solid #0c0c0d",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.5)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div className="pro-grip" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 22, background: "linear-gradient(180deg, #3a3b3e, #2a2b2e)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px" }}>
              <span style={{ fontSize: 10, color: "#9a9c9e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, textShadow: "0 1px 0 rgba(0,0,0,0.8)" }}>{w.props.title || "Panel"}</span>
            </div>
            <div style={{ position: "absolute", top: 22, left: 0, right: 0, bottom: 0 }} />
            {/* children will be rendered inside */}
          </div>
        );
      } else if (w.type === "list-box") {
        inner = (
          <div style={{ width: "100%", height: "100%", borderRadius: 6, overflow: "hidden", background: "#0f0f10", border: "1px solid #000", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.9)" }}>
            <div style={{ height: 20, background: "linear-gradient(180deg, #3a3b3e, #2a2b2e)", borderBottom: "1px solid #000", display: "flex", alignItems: "center", padding: "0 8px" }}>
              <span style={{ fontSize: 10, color: "#8a8c8e", textTransform: "uppercase", letterSpacing: 0.8 }}>{w.props.title || "List"}</span>
            </div>
            <div style={{ padding: 2 }}>
              {(w.props.rows || []).map((r: string, i: number) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    padding: "3px 6px",
                    color: i === 1 ? "#fff" : "#9a9c9e",
                    background: i === 1 ? "linear-gradient(180deg, #4a8af4, #2a5cb0)" : "transparent",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r}
                </div>
              ))}
            </div>
          </div>
        );
      } else if (w.type === "tab-bar") {
        inner = (
          <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(180deg, #2d2e30, #1e1f21)", borderRadius: 6, border: "1px solid #0a0a0a", overflow: "hidden" }}>
            {(w.props.tabs || ["Tab 1", "Tab 2"]).map((t: string, i: number) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: (w.props.selectedTab ?? 0) === i ? "#fff" : "#8a8c8e",
                  background: (w.props.selectedTab ?? 0) === i ? "linear-gradient(180deg, #3a3b3e, #2a2b2e)" : "transparent",
                  borderRight: i < (w.props.tabs?.length || 2) - 1 ? "1px solid #0a0a0a" : "none",
                  boxShadow: (w.props.selectedTab ?? 0) === i ? "inset 0 1px 0 rgba(255,255,255,0.12)" : "none",
                  textShadow: "0 -1px 0 rgba(0,0,0,0.8)",
                }}
              >
                {t}
              </div>
            ))}
          </div>
        );
      } else if (w.type === "toolbar-strip") {
        inner = (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(180deg, #3a3b3e 0%, #2e2f32 50%, #242528 100%)",
              borderBottom: "1px solid #0a0a0a",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 10px",
              boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ width: 28, height: 24, borderRadius: 4, background: "linear-gradient(180deg, #4a4c4f, #2a2c2f)", border: "1px solid #0a0a0a", borderTop: "1px solid rgba(255,255,255,0.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 1px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#c0c0c0" }}>◫</div>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: "#0a0a0a", boxShadow: "1px 0 0 rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Untitled Toolbar</span>
            <div style={{ flex: 1 }} />
            <div style={{ width: 120, height: 18, borderRadius: 9, background: "#0f0f10", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)", border: "1px solid #000", display: "flex", alignItems: "center", padding: "0 8px" }}>
              <span style={{ fontSize: 10, color: "#5a5c5e" }}>Search</span>
            </div>
          </div>
        );
      } else if (w.type === "image-well") {
        inner = (
          <div className="pro-inset-well" style={{ width: "100%", height: "100%", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, border: "1px dashed #333" }}>
            <div style={{ width: 32, height: 32, borderRadius: 4, background: "linear-gradient(180deg, #2a2b2e, #1a1a1c)", border: "1px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#5a5c5e" }}>🖼</div>
            <span style={{ fontSize: 10, color: "#5a5c5e", textTransform: "uppercase" }}>{w.props.title || "Image Well"}</span>
          </div>
        );
      } else if (w.type === "separator") {
        inner = (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
            <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg, transparent, #0a0a0a, transparent)", boxShadow: "0 1px 0 rgba(255,255,255,0.04)" }} />
          </div>
        );
      } else if (w.type === "icon-button") {
        inner = (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: w.props.radius ?? 6,
              background: "linear-gradient(180deg, #4a4c4f, #2a2c2f)",
              border: "1px solid #0a0a0a",
              borderTop: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d0d0d0",
              fontSize: 14,
            }}
          >
            {w.props.title || "★"}
          </div>
        );
      } else if (w.type === "segmented-control") {
        inner = (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: w.props.radius ?? 6,
              background: "#0f0f10",
              border: "1px solid #000",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)",
              display: "flex",
              overflow: "hidden",
              padding: 2,
            }}
          >
            {(w.props.segments || []).map((s: string, i: number) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: 4,
                  background: (w.props.selectedSegment ?? 0) === i ? "linear-gradient(180deg, #4a4c4f, #2a2c2f)" : "transparent",
                  border: (w.props.selectedSegment ?? 0) === i ? "1px solid #0a0a0a" : "1px solid transparent",
                  borderTop: (w.props.selectedSegment ?? 0) === i ? "1px solid rgba(255,255,255,0.15)" : "1px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  color: (w.props.selectedSegment ?? 0) === i ? "#e0e0e0" : "#6a6c6e",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontWeight: 600,
                  boxShadow: (w.props.selectedSegment ?? 0) === i ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 1px rgba(0,0,0,0.3)" : "none",
                }}
              >
                {s}
              </div>
            ))}
          </div>
        );
      }

      return (
        <div
          key={w.id}
          style={commonStyle}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setHoverId(w.id)}
          onMouseLeave={() => setHoverId((prev) => (prev === w.id ? null : prev))}
        >
          {inner}
          {/* hover highlight */}
          {isHover && !isSelected && (
            <div
              style={{
                position: "absolute",
                inset: -1,
                border: "1px solid rgba(74,138,244,0.5)",
                borderRadius: w.type === "pro-button" ? w.props.radius ?? 14 : 4,
                pointerEvents: "none",
                boxShadow: "0 0 6px rgba(74,138,244,0.3)",
              }}
            />
          )}
          {/* selection */}
          {isSelected && (
            <>
              <div
                style={{
                  position: "absolute",
                  inset: -2,
                  border: "1px dashed #4a8af4",
                  borderRadius: w.type === "pro-button" ? (w.props.radius ?? 14) + 2 : 6,
                  boxShadow: "0 0 12px rgba(74,138,244,0.5), inset 0 0 0 1px rgba(74,138,244,0.2)",
                  pointerEvents: "none",
                }}
              />
              {/* resize handles */}
              {[
                ["nw", -4, -4, "nw-resize"],
                ["n", lay.w / 2 - 3, -4, "n-resize"],
                ["ne", lay.w - 2, -4, "ne-resize"],
                ["e", lay.w - 2, lay.h / 2 - 3, "e-resize"],
                ["se", lay.w - 2, lay.h - 2, "se-resize"],
                ["s", lay.w / 2 - 3, lay.h - 2, "s-resize"],
                ["sw", -4, lay.h - 2, "sw-resize"],
                ["w", -4, lay.h / 2 - 3, "w-resize"],
              ].map(([dir, lx, ty, cur]) => (
                <div
                  key={dir as string}
                  onMouseDown={(e) => handleResizeMouseDown(e, dir as string)}
                  style={{
                    position: "absolute",
                    left: lx as number,
                    top: ty as number,
                    width: 6,
                    height: 6,
                    background: "#4a8af4",
                    border: "1px solid #fff",
                    boxShadow: "0 0 4px rgba(74,138,244,0.8)",
                    cursor: cur as string,
                    zIndex: 20,
                  }}
                />
              ))}
            </>
          )}
          {/* children for panel */}
          {w.type === "panel" && (
            <div style={{ position: "absolute", left: 0, top: 22, right: 0, bottom: 0, overflow: "hidden" }}>{renderTree(w.id)}</div>
          )}
          {w.type !== "panel" && w.type !== "toolbar-strip" && renderTree(w.id)}
        </div>
      );
    });
  };

  const deviceStyleOuter: React.CSSProperties = useMemo(() => {
    const scale = zoom / 100;
    if (device === "desktop") {
      return {
        width: 960,
        height: 600,
        background: "linear-gradient(180deg, #2a2b2e, #1e1f21)",
        borderRadius: 6,
        border: "1px solid #000",
        boxShadow: "0 20px 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 1px 0 rgba(255,255,255,0.12) inset",
        overflow: "hidden",
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      };
    }
    if (device === "tablet") {
      return {
        width: 800,
        height: 1088,
        background: "#0e0e0e",
        borderRadius: 28,
        border: "1px solid #000",
        boxShadow: "0 30px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.9)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      };
    }
    return {
      width: 414,
      height: 876,
      background: "linear-gradient(180deg, #1a1a1c, #0a0a0a)",
      borderRadius: 48,
      border: "1px solid #000",
      boxShadow: "0 30px 80px rgba(0,0,0,0.9), inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,1)",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      transform: `scale(${scale})`,
      transformOrigin: "top left",
    };
  }, [device, zoom]);

  const innerScreenStyle: React.CSSProperties = useMemo(() => {
    if (device === "desktop") return { width: "100%", height: "calc(100% - 22px)", position: "relative" as const, background: "#1e1f21" };
    if (device === "tablet")
      return { width: 768, height: 1024, background: "#1e1f21", borderRadius: 8, overflow: "hidden", position: "relative" as const, boxShadow: "inset 0 0 0 1px #000" };
    return { width: 390, height: 844, background: "#1e1f21", borderRadius: 36, overflow: "hidden", position: "relative" as const, boxShadow: "inset 0 0 0 1px #000" };
  }, [device]);

  const exportJson = useMemo(() => JSON.stringify({ device, separateLayouts, widgets }, null, 2), [widgets, device, separateLayouts]);

  return (
    <div
      data-safe-area-inset-root
      style={{ boxSizing: "border-box", paddingTop: "var(--safe-area-inset-top)", height: "100vh", background: "#121214", display: "flex", flexDirection: "column", overflow: "clip", overflowX: "clip" } as React.CSSProperties}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap');
        .lucida { font-family: "Lucida Grande", Helvetica, Arial, sans-serif; }
        .mono { font-family: "JetBrains Mono", monospace; }
      `}</style>

      {/* Window chrome titlebar 24px */}
      <div
        data-safe-area-sticky-top
        style={{
          height: 24,
          background: "linear-gradient(180deg, #3a3b3e 0%, #2e2f32 50%, #242528 100%)",
          borderBottom: "1px solid #0a0a0a",
          borderTop: "1px solid rgba(255,255,255,0.14)",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 8,
          flexShrink: 0,
          position: "sticky",
          top: "var(--safe-area-inset-top)",
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "linear-gradient(180deg, #ff7a75, #ff5f57)", border: "1px solid #5a1a18", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "linear-gradient(180deg, #ffdf6b, #ffbd2e)", border: "1px solid #5a4a18", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }} />
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "linear-gradient(180deg, #5ae67a, #28ca42)", border: "1px solid #1a5a28", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }} />
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <span style={{ fontSize: 11, color: "#9a9c9e", textShadow: "0 1px 0 rgba(0,0,0,0.8)", fontWeight: 600, letterSpacing: 0.2 }}>ProShade Builder — Untitled.app — MainWindow</span>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Menubar 19px */}
      <div style={{ height: 19, background: "linear-gradient(180deg, #1e1e1e, #161617)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 10px", gap: 14, flexShrink: 0 }}>
        {["FILE", "EDIT", "VIEW", "LAYOUT", "OBJECT", "WINDOW", "HELP"].map((m) => (
          <span key={m} style={{ fontSize: 10, color: "#7a7c7e", letterSpacing: 0.8, fontWeight: 700, textShadow: "0 1px 0 rgba(0,0,0,0.9)" }}>
            {m}
          </span>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#4a4c4e", fontFamily: "JetBrains Mono" }}>{saveStatus || "• Ready"}</span>
      </div>

      {/* Toolbar 34px */}
      <div
        style={{
          height: 34,
          background: "linear-gradient(180deg, #2d2e30 0%, #242528 100%)",
          borderTop: "1px solid rgba(255,255,255,0.12)",
          borderBottom: "1px solid rgba(0,0,0,0.9)",
          display: "flex",
          alignItems: "center",
          padding: "0 10px",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Left play/build */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 28, height: 24, borderRadius: 4, background: "linear-gradient(180deg, #5a5c5f, #2a2c2f)", border: "1px solid #0a0a0a", borderTop: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 1px rgba(0,0,0,0.4)", cursor: "pointer" }}>
            <span style={{ fontSize: 10, color: "#c0c0c0" }}>▶</span>
          </div>
          <div style={{ width: 28, height: 24, borderRadius: 4, background: "linear-gradient(180deg, #4a4c4f, #2a2c2f)", border: "1px solid #0a0a0a", borderTop: "1px solid rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.8 }}>
            <span style={{ fontSize: 10, color: "#9a9c9e" }}>■</span>
          </div>
          <div style={{ width: 1, height: 20, background: "#0a0a0a", boxShadow: "1px 0 0 rgba(255,255,255,0.06)", margin: "0 4px" }} />
          <button
            onClick={handleSave}
            style={{
              height: 22,
              padding: "0 10px",
              borderRadius: 11,
              background: "linear-gradient(180deg, #4a4c4f, #2a2c2f)",
              border: "1px solid #0a0a0a",
              borderTop: "1px solid rgba(255,255,255,0.15)",
              color: "#b0b2b4",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>

        {/* Center device switcher */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#0f0f10", borderRadius: 6, border: "1px solid #000", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)", padding: 2 }}>
            {[
              { id: "desktop", label: "DESKTOP", icon: "🖥" },
              { id: "tablet", label: "TABLET", icon: "▭" },
              { id: "phone", label: "PHONE", icon: "📱" },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDevice(d.id as Device)}
                style={{
                  height: 22,
                  padding: "0 14px",
                  borderRadius: 4,
                  background: device === d.id ? "linear-gradient(180deg, #4a4c4f, #2a2c2f)" : "transparent",
                  border: device === d.id ? "1px solid #0a0a0a" : "1px solid transparent",
                  borderTop: device === d.id ? "1px solid rgba(255,255,255,0.16)" : "1px solid transparent",
                  color: device === d.id ? "#e0e0e0" : "#6a6c6e",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  boxShadow: device === d.id ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 1px 1px rgba(0,0,0,0.3)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 11 }}>{d.icon}</span> {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={gridEnabled} onChange={(e) => setGridEnabled(e.target.checked)} style={{ width: 12, height: 12, accentColor: "#4a8af4" }} />
            <span style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>Grid</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} style={{ width: 12, height: 12, accentColor: "#4a8af4" }} />
            <span style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>Snap</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setZoom((z) => Math.max(25, z - 25))} style={{ width: 20, height: 20, borderRadius: 3, background: "#2a2c2f", border: "1px solid #000", color: "#7a7c7e", fontSize: 12, cursor: "pointer" }}>
              −
            </button>
            <span style={{ fontSize: 11, color: "#9a9c9e", width: 44, textAlign: "center", fontFamily: "JetBrains Mono" }}>{zoom}%</span>
            <button onClick={() => setZoom((z) => Math.min(200, z + 25))} style={{ width: 20, height: 20, borderRadius: 3, background: "#2a2c2f", border: "1px solid #000", color: "#7a7c7e", fontSize: 12, cursor: "pointer" }}>
              +
            </button>
          </div>
          <div style={{ width: 1, height: 20, background: "#0a0a0a", boxShadow: "1px 0 0 rgba(255,255,255,0.06)" }} />
          <button
            onClick={() => setShowExport(true)}
            style={{
              height: 22,
              padding: "0 12px",
              borderRadius: 11,
              background: "linear-gradient(180deg, #4a8af4, #2a5cb0)",
              border: "1px solid #1a3a70",
              borderTop: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(0,0,0,0.5)",
              cursor: "pointer",
            }}
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Main 3-col */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Left palette 220px */}
        <div style={{ width: 220, background: "linear-gradient(180deg, #2d2e30 0%, #242528 60%, #1e1f21 100%)", borderRight: "1px solid #0a0a0a", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          <div className="pro-grip" style={{ height: 22, background: "linear-gradient(180deg, #3a3b3e, #2a2b2e)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: "#9a9c9e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 800, textShadow: "0 1px 0 rgba(0,0,0,0.8)" }}>Widgets</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {CATS.map((cat) => {
              const isCollapsed = collapsedCats[cat];
              const items = PALETTE.filter((p) => p.cat === cat || (cat === "NAV" && ["tab-bar", "toolbar-strip", "segmented-control"].includes(p.type) && p.cat === "CONTAINERS"));
              // special handling for NAV - show nav-related
              let displayItems = items;
              if (cat === "NAV") displayItems = PALETTE.filter((p) => ["tab-bar", "toolbar-strip", "segmented-control"].includes(p.type));
              else if (cat === "CONTAINERS") displayItems = PALETTE.filter((p) => p.cat === "CONTAINERS" && !["tab-bar", "toolbar-strip", "segmented-control"].includes(p.type));
              if (displayItems.length === 0) return null;
              return (
                <div key={cat} style={{ borderBottom: "1px solid #0f0f10" }}>
                  <div
                    onClick={() => setCollapsedCats((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                    style={{ height: 22, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", cursor: "pointer", background: "linear-gradient(180deg, #2a2b2e, #1e1f21)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid #0a0a0a" }}
                  >
                    <span style={{ fontSize: 9, color: "#5a5c5e", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.15s" }}>▼</span>
                    <span style={{ fontSize: 10, color: "#7a7c7e", letterSpacing: 0.8, fontWeight: 700, textTransform: "uppercase" }}>{cat}</span>
                    <span style={{ fontSize: 9, color: "#4a4c4e", marginLeft: "auto" }}>{displayItems.length}</span>
                  </div>
                  {!isCollapsed && (
                    <div style={{ padding: "4px 0" }}>
                      {displayItems.map((p) => (
                        <div
                          key={p.type + p.label}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPaletteDrag({ type: p.type, x: e.clientX, y: e.clientY, w: p.w, h: p.h });
                          }}
                          style={{
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "0 10px",
                            cursor: "grab",
                            borderBottom: "1px solid rgba(0,0,0,0.2)",
                            background: "transparent",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "linear-gradient(180deg, rgba(74,138,244,0.15), rgba(74,138,244,0.05))")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ width: 24, height: 24, borderRadius: 4, background: "linear-gradient(180deg, #3a3c3f, #1e1f21)", border: "1px solid #0a0a0a", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#8a8c8e", flexShrink: 0 }}>{p.icon}</div>
                          <span style={{ fontSize: 11, color: "#b0b2b4", textShadow: "0 1px 0 rgba(0,0,0,0.6)", whiteSpace: "nowrap" }}>{p.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ padding: 10, opacity: 0.6 }}>
              <div style={{ fontSize: 9, color: "#5a5c5e", textTransform: "uppercase", letterSpacing: 0.8, lineHeight: "13px" }}>Drag widgets onto canvas. Hold ⌘ to duplicate. Panels accept child drops. Use Device switcher to adapt layouts.</div>
            </div>
          </div>
        </div>

        {/* Center canvas */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#121214", minWidth: 0 }}>
          <div
            ref={canvasScrollRef}
            className={gridEnabled ? "canvas-grid" : ""}
            style={{
              flex: 1,
              overflow: "auto",
              position: "relative",
              backgroundColor: "#1a1a1c",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              padding: 40,
            }}
            onMouseDown={() => setSelectedId(null)}
          >
            {/* Device frame wrapper scaled */}
            <div style={{ flexShrink: 0, margin: "0 auto", width: deviceFrame.outerW * (zoom / 100), height: deviceFrame.outerH * (zoom / 100), position: "relative" }}>
              <div style={deviceStyleOuter}>
                {/* Desktop titlebar */}
                {device === "desktop" && (
                  <div style={{ height: 22, background: "linear-gradient(180deg, #3a3b3e, #2a2b2e)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px", gap: 6, flexShrink: 0 }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 4.5, background: "#ff5f57", border: "1px solid #4a1a18" }} />
                      <div style={{ width: 9, height: 9, borderRadius: 4.5, background: "#ffbd2e", border: "1px solid #4a3a18" }} />
                      <div style={{ width: 9, height: 9, borderRadius: 4.5, background: "#28ca42", border: "1px solid #1a4a28" }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#8a8c8e", marginLeft: 8, textShadow: "0 1px 0 rgba(0,0,0,0.8)" }}>Untitled.app — MainWindow</span>
                  </div>
                )}
                {device === "tablet" && (
                  <>
                    <div style={{ width: 768, height: 1024, background: "#000", borderRadius: 8, overflow: "hidden", position: "relative" }} />
                    {/* actual screen replaced by innerScreenStyle below */}
                  </>
                )}
                {/* Phone notch / tablet bezel content */}
                {device === "phone" && (
                  <div style={{ width: 390, height: 20, display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 2 }}>
                    <div style={{ width: 100, height: 26, background: "#000", borderRadius: 13, marginTop: 8, boxShadow: "inset 0 1px 2px rgba(255,255,255,0.1)" }} />
                  </div>
                )}

                <div
                  ref={canvasContentRef}
                  style={{
                    ...innerScreenStyle,
                    background: device === "desktop" ? "#252529" : "#1e1f21",
                    boxShadow: device !== "desktop" ? "none" : undefined,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {/* Empty state */}
                  {widgets.filter((w) => w.parentId === null).length === 0 && (
                    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 240, height: 100, border: "1px dashed #3a3c3e", borderRadius: 8, background: "rgba(15,15,16,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#5a5c5e", textTransform: "uppercase", letterSpacing: 0.8 }}>Drop widgets here</span>
                      <span style={{ fontSize: 10, color: "#3a3c3e" }}>Canvas • {device} • {gridEnabled ? "Grid 20px" : "Freeform"}</span>
                    </div>
                  )}

                  {renderTree(null)}

                  {/* Snap guides visualization */}
                  {snapEnabled && gridEnabled && (
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.15, backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                  )}
                </div>

                {device === "tablet" && (
                  <div style={{ width: 56, height: 56, borderRadius: 28, background: "linear-gradient(180deg, #2a2b2e, #0a0a0a)", border: "1px solid #000", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 4, border: "2px solid #2a2a2a" }} />
                  </div>
                )}
                {device === "phone" && <div style={{ width: 120, height: 4, background: "#2a2a2a", borderRadius: 2, marginTop: 10 }} />}
              </div>
            </div>
          </div>

          {/* Bottom layers 180px */}
          <div style={{ height: 180, background: "linear-gradient(180deg, #2d2e30, #1e1f21)", borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid #0a0a0a", display: "flex", flexShrink: 0, overflow: "hidden" }}>
            <div style={{ width: 320, borderRight: "1px solid #0a0a0a", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div className="pro-grip" style={{ height: 20, background: "linear-gradient(180deg, #3a3b3e, #2a2b2e)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: "#9a9c9e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Layers</span>
                <span style={{ fontSize: 9, color: "#5a5c5e", marginLeft: "auto" }}>{widgets.length} objects</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {widgets
                  .filter((w) => w.parentId === null)
                  .map((w) => {
                    const children = widgets.filter((c) => c.parentId === w.id);
                    return (
                      <div key={w.id}>
                        <div
                          onClick={() => setSelectedId(w.id)}
                          style={{
                            height: 22,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "0 8px",
                            background: selectedId === w.id ? "linear-gradient(180deg, #4a8af4, #2a5cb0)" : "transparent",
                            borderBottom: "1px solid rgba(0,0,0,0.15)",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontSize: 10, color: selectedId === w.id ? "#fff" : "#5a5c5e" }}>{w.type === "panel" ? "▼" : "•"}</span>
                          <span style={{ fontSize: 11, color: selectedId === w.id ? "#fff" : "#9a9c9e", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {w.props.title || w.type} [{w.id.slice(0, 4)}]
                          </span>
                          <span style={{ fontSize: 9, color: selectedId === w.id ? "rgba(255,255,255,0.7)" : "#4a4c4e", fontFamily: "JetBrains Mono" }}>
                            {getLayout(w, device).w}×{getLayout(w, device).h}
                          </span>
                        </div>
                        {children.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            style={{
                              height: 20,
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "0 8px 0 28px",
                              background: selectedId === c.id ? "rgba(74,138,244,0.25)" : "rgba(0,0,0,0.15)",
                              borderBottom: "1px solid rgba(0,0,0,0.1)",
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ fontSize: 11, color: selectedId === c.id ? "#c0d6ff" : "#7a7c7e" }}>{c.props.title || c.type}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0f0f10" }}>
              <div style={{ height: 20, background: "linear-gradient(180deg, #2a2b2e, #1e1f21)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px" }}>
                <span style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Properties Log</span>
                <span style={{ fontSize: 9, color: "#4a4c4e", marginLeft: 12, fontFamily: "JetBrains Mono" }}>{device.toUpperCase()} • {separateLayouts ? "Separate Layouts" : "Shared Layouts"} • Snap {snapEnabled ? "ON" : "OFF"}</span>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 8, fontFamily: "JetBrains Mono", fontSize: 10, color: "#5a8a5a", lineHeight: "14px", whiteSpace: "pre-wrap" }}>
                {`> ProShade Builder v8.0.3 (Late 2008)
> Canvas: ${deviceFrame.w}x${deviceFrame.h} @ ${zoom}%
> Selected: ${selectedWidget ? `${selectedWidget.type} id=${selectedWidget.id}` : "none"}
${selectedWidget ? `  → pos ${getLayout(selectedWidget, device).x},${getLayout(selectedWidget, device).y} size ${getLayout(selectedWidget, device).w}x${getLayout(selectedWidget, device).h}` : ""}
> Widgets: ${widgets.length} total, ${widgets.filter((w) => w.parentId !== null).length} nested
> Layouts: ${separateLayouts ? "Per-device overrides active" : "Shared across devices (change affects all)"}
> ${gridEnabled ? "Grid 20px • Dots visible" : "Grid off"}
> Use Delete to remove, ⌘D to duplicate, drag panels to nest.`}
              </div>
            </div>
          </div>
        </div>

        {/* Right inspector 260px */}
        <div style={{ width: 260, background: "linear-gradient(180deg, #2d2e30 0%, #242528 60%, #1e1f21 100%)", borderLeft: "1px solid #0a0a0a", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          <div className="pro-grip" style={{ height: 22, background: "linear-gradient(180deg, #3a3b3e, #2a2b2e)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: "#9a9c9e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 800, textShadow: "0 1px 0 rgba(0,0,0,0.8)" }}>Inspector</span>
            <span style={{ fontSize: 9, color: "#4a4c4e", marginLeft: "auto", textTransform: "uppercase" }}>Pro</span>
          </div>

          <div style={{ padding: 8, borderBottom: "1px solid #0a0a0a", background: "rgba(0,0,0,0.15)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={separateLayouts} onChange={(e) => setSeparateLayouts(e.target.checked)} style={{ width: 12, height: 12, accentColor: "#4a8af4" }} />
              <span style={{ fontSize: 10, color: "#b0b2b4", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>Separate Layouts per Device</span>
            </label>
            <div style={{ fontSize: 9, color: "#5a5c5e", marginTop: 4, lineHeight: "12px" }}>{separateLayouts ? "Moving/resizing affects only current device. Indicator • shows override." : "Shared mode: edits propagate to all devices. Turn on for custom per-device positioning."}</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {!selectedWidget ? (
              <div style={{ padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#5a5c5e", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>No Selection</div>
                <div style={{ fontSize: 10, color: "#3a3c3e", lineHeight: "13px" }}>Click a widget on canvas to edit its properties. Drag from palette to add.</div>
              </div>
            ) : (
              <>
                {/* GEOMETRY */}
                <div style={{ borderBottom: "1px solid #0f0f10" }}>
                  <div style={{ height: 20, background: "linear-gradient(180deg, #2a2b2e, #1e1f21)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px" }}>
                    <span style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Geometry</span>
                    <span style={{ fontSize: 9, color: "#4a8af4", marginLeft: "auto", fontFamily: "JetBrains Mono" }}>{device}</span>
                  </div>
                  <div style={{ padding: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { k: "x", label: "X" },
                      { k: "y", label: "Y" },
                      { k: "w", label: "W" },
                      { k: "h", label: "H" },
                    ].map(({ k, label }) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, color: "#5a5c5e", width: 12, fontWeight: 700 }}>{label}</span>
                        <input
                          type="number"
                          value={Math.round(getLayout(selectedWidget, device)[k as keyof LayoutRect] as number)}
                          onChange={(e) => {
                            const v = parseInt(e.target.value) || 0;
                            updateWidgetLayout(selectedWidget.id, device, { [k]: v }, separateLayouts);
                          }}
                          style={{
                            width: "100%",
                            height: 20,
                            background: "#0f0f10",
                            border: "1px solid #000",
                            borderRadius: 3,
                            color: "#b0b2b4",
                            fontSize: 11,
                            padding: "0 6px",
                            fontFamily: "JetBrains Mono",
                            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* APPEARANCE */}
                <div style={{ borderBottom: "1px solid #0f0f10" }}>
                  <div style={{ height: 20, background: "linear-gradient(180deg, #2a2b2e, #1e1f21)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px" }}>
                    <span style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Appearance</span>
                  </div>
                  <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "#5a5c5e", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>Title / Content</div>
                      <input
                        value={selectedWidget.props.title || ""}
                        onChange={(e) => updateWidgetProps(selectedWidget.id, { title: e.target.value })}
                        onFocus={() => setEditingTitle(true)}
                        onBlur={() => setEditingTitle(false)}
                        style={{
                          width: "100%",
                          height: 22,
                          background: "#0f0f10",
                          border: "1px solid #000",
                          borderRadius: 4,
                          color: "#c0c2c4",
                          fontSize: 11,
                          padding: "0 8px",
                          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8)",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: "#5a5c5e", textTransform: "uppercase", marginBottom: 3 }}>Radius</div>
                        <input
                          type="number"
                          value={selectedWidget.props.radius ?? 6}
                          onChange={(e) => updateWidgetProps(selectedWidget.id, { radius: parseInt(e.target.value) || 0 })}
                          style={{ width: "100%", height: 20, background: "#0f0f10", border: "1px solid #000", borderRadius: 3, color: "#9a9c9e", fontSize: 11, padding: "0 6px", fontFamily: "JetBrains Mono" }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: "#5a5c5e", textTransform: "uppercase", marginBottom: 3 }}>Opacity</div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={selectedWidget.props.opacity ?? 1}
                          onChange={(e) => updateWidgetProps(selectedWidget.id, { opacity: parseFloat(e.target.value) })}
                          style={{ width: "100%" }}
                        />
                      </div>
                    </div>
                    {selectedWidget.type === "pro-button" && (
                      <div>
                        <div style={{ fontSize: 9, color: "#5a5c5e", textTransform: "uppercase", marginBottom: 4 }}>Style</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {["default", "blue"].map((s) => (
                            <button
                              key={s}
                              onClick={() => updateWidgetProps(selectedWidget.id, { styleVariant: s })}
                              style={{
                                flex: 1,
                                height: 20,
                                borderRadius: 3,
                                background: selectedWidget.props.styleVariant === s ? "linear-gradient(180deg, #4a4c4f, #2a2c2f)" : "#0f0f10",
                                border: "1px solid #000",
                                color: selectedWidget.props.styleVariant === s ? "#c0c0c0" : "#5a5c5e",
                                fontSize: 10,
                                textTransform: "uppercase",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {(selectedWidget.type === "slider" || selectedWidget.type === "knob" || selectedWidget.type === "progress") && (
                      <div>
                        <div style={{ fontSize: 9, color: "#5a5c5e", textTransform: "uppercase", marginBottom: 4 }}>Value: {selectedWidget.props.value ?? 0}</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={selectedWidget.props.value ?? 50}
                          onChange={(e) => updateWidgetProps(selectedWidget.id, { value: parseInt(e.target.value) })}
                          style={{ width: "100%" }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* CONSTRAINTS */}
                <div style={{ borderBottom: "1px solid #0f0f10" }}>
                  <div style={{ height: 20, background: "linear-gradient(180deg, #2a2b2e, #1e1f21)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px" }}>
                    <span style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Constraints</span>
                  </div>
                  <div style={{ padding: 8 }}>
                    {(["desktop", "tablet", "phone"] as Device[]).map((d) => {
                      const lay = selectedWidget.layouts[d];
                      const isOverride = separateLayouts && (lay.x !== selectedWidget.layouts.desktop.x || lay.y !== selectedWidget.layouts.desktop.y || lay.w !== selectedWidget.layouts.desktop.w);
                      return (
                        <div key={d} style={{ display: "flex", alignItems: "center", gap: 8, height: 20, borderBottom: "1px solid rgba(0,0,0,0.2)" }}>
                          <span style={{ fontSize: 10, color: device === d ? "#4a8af4" : "#5a5c5e", textTransform: "uppercase", fontWeight: 700, width: 56 }}>{d}</span>
                          <span style={{ fontSize: 10, color: "#7a7c7e", fontFamily: "JetBrains Mono" }}>
                            {lay.x},{lay.y} • {lay.w}×{lay.h}
                          </span>
                          {isOverride && <span style={{ width: 6, height: 6, borderRadius: 3, background: "#4a8af4", boxShadow: "0 0 4px #4a8af4", marginLeft: "auto" }} />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* LAYOUT PINNING */}
                <div>
                  <div style={{ height: 20, background: "linear-gradient(180deg, #2a2b2e, #1e1f21)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 8px" }}>
                    <span style={{ fontSize: 10, color: "#7a7c7e", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Layout Pinning</span>
                  </div>
                  <div style={{ padding: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {["Top", "Left", "Bottom", "Right"].map((p) => (
                      <label key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="checkbox" defaultChecked={p === "Top" || p === "Left"} style={{ width: 11, height: 11, accentColor: "#4a8af4" }} />
                        <span style={{ fontSize: 10, color: "#6a6c6e" }}>{p}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ padding: "0 8px 8px", fontSize: 9, color: "#4a4c4e", lineHeight: "12px" }}>Pinning determines how widget stretches when device size changes. Legacy auto-layout from 2007.</div>
                </div>
              </>
            )}
          </div>

          <div style={{ height: 28, background: "#0f0f10", borderTop: "1px solid #000", display: "flex", alignItems: "center", padding: "0 8px", gap: 8 }}>
            <button
              onClick={() => {
                if (!selectedWidget) return;
                const toDelete = new Set<string>();
                const collect = (id: string) => {
                  toDelete.add(id);
                  widgets.filter((w) => w.parentId === id).forEach((c) => collect(c.id));
                };
                collect(selectedWidget.id);
                setWidgets((prev) => prev.filter((w) => !toDelete.has(w.id)));
                setSelectedId(null);
              }}
              disabled={!selectedWidget}
              style={{ height: 18, padding: "0 8px", borderRadius: 3, background: "#2a0a0a", border: "1px solid #000", color: selectedWidget ? "#ff6a6a" : "#4a2a2a", fontSize: 10, textTransform: "uppercase", cursor: selectedWidget ? "pointer" : "default", opacity: selectedWidget ? 1 : 0.5 }}
            >
              Delete
            </button>
            <span style={{ fontSize: 9, color: "#3a3c3e", marginLeft: "auto", fontFamily: "JetBrains Mono" }}>ID {selectedWidget?.id.slice(0, 6) || "—"}</span>
          </div>
        </div>
      </div>

      {/* Palette drag ghost */}
      {paletteDrag && (
        <div
          style={{
            position: "fixed",
            left: paletteDrag.x + 12,
            top: paletteDrag.y + 12,
            width: paletteDrag.w,
            height: paletteDrag.h,
            pointerEvents: "none",
            zIndex: 9999,
            opacity: 0.7,
            background: "linear-gradient(180deg, #3a3c3f, #1e1f21)",
            border: "1px dashed #4a8af4",
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.8), 0 0 12px rgba(74,138,244,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: "#9a9c9e",
          }}
        >
          {PALETTE.find((p) => p.type === paletteDrag.type)?.label || "Widget"}
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: 720, maxWidth: "90vw", maxHeight: "85vh", background: "linear-gradient(180deg, #2d2e30, #1e1f21)", borderRadius: 8, border: "1px solid #000", borderTop: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ height: 28, background: "linear-gradient(180deg, #3a3b3e, #2a2b2e)", borderBottom: "1px solid #0a0a0a", display: "flex", alignItems: "center", padding: "0 12px", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#c0c0c0", fontWeight: 700, letterSpacing: 0.5 }}>Export Layout JSON — Per-Device Frames</span>
              <button onClick={() => setShowExport(false)} style={{ width: 20, height: 20, borderRadius: 10, background: "#3a0a0a", border: "1px solid #000", color: "#ff8a8a", cursor: "pointer", fontSize: 12 }}>×</button>
            </div>
            <div style={{ padding: 12, flex: 1, overflow: "auto", background: "#0f0f10" }}>
              <pre style={{ margin: 0, fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "#8a9a8a", lineHeight: "14px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{exportJson}</pre>
            </div>
            <div style={{ height: 40, borderTop: "1px solid #0a0a0a", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 12px", background: "linear-gradient(180deg, #242528, #1e1f21)" }}>
              <button
                onClick={() => {
                  const ta = document.createElement("textarea");
                  ta.value = exportJson;
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  document.body.removeChild(ta);
                }}
                style={{ height: 24, padding: "0 12px", borderRadius: 12, background: "linear-gradient(180deg, #4a4c4f, #2a2c2f)", border: "1px solid #000", color: "#c0c0c0", fontSize: 11, cursor: "pointer" }}
              >
                Copy JSON
              </button>
              <button onClick={() => setShowExport(false)} style={{ height: 24, padding: "0 16px", borderRadius: 12, background: "linear-gradient(180deg, #4a8af4, #2a5cb0)", border: "1px solid #1a3a70", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
