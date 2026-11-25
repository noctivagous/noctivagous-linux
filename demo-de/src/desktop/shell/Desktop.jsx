/* NCT-WL-COMPOSITOR — the shell furniture (sysbar, dock, launcher, widgets) models layer-shell surfaces; the launcher position setting is edge anchoring. See WAYLAND-MAP.md. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSlice, store } from "../core/react.js";
import { APPS, appById, Icon, GROUPS, groupById } from "../core/registry.jsx";
import { bus, toast } from "../core/bus.js";
import { openWindow, closeWindow, focusWindow, minimizeWindow, toggleShade, toggleMax, setVShade, showDesktop, toggleHidden, restoreFromStack, toggleFrozen } from "../core/windows.js";
import { setSetting } from "../core/react.js";
import { lockScreen, logOut } from "./sessionActions.js";
import Window from "./Window.jsx";
import NavGraphLayer from "./NavGraphLayer.jsx";
import PatchLayer from "./PatchLayer.jsx";
import PortDots from "./PortDots.jsx";
import {
  publish, showAllPorts, hideAllPorts, clearCords, setWatch,
  portPressed, disconnectPort, removeCord, cordsTouching, portDef,
} from "../core/patchbay.js";
import { toggleLayer, toggleLayerFrozen, closeLayer, appMode, setAppMode } from "../core/layers.js";
import { useNow, hms, hm, fullDate, pad } from "./useNow.js";
import { WIDGETS, widgetById, WIDGET_STYLES, DEFAULT_DESKTOP_WIDGETS, ClockWidget, SysLoadWidget, WidgetTitlebar } from "../widgets/widgets.jsx";
import { MenuTree, menu as menuNode, item as menuItem, sep as menuSep, group as menuGroup } from "../core/menuTree.jsx";

/* The system menu bar's menus are menu TREES (core/menuTree.jsx):
 * each carries the default presentation — a list laid out in
 * multiple columns (columns: 2) — unless it sets its own. */
const MENUS = {
  File: menuNode(null, [menuItem("New Window", "files"), menuItem("Open Terminal", "terminal"), menuSep(), menuItem("Lock Screen", "lock"), menuItem("Log Out…", "logout")]),
  Edit: menuNode(null, [menuItem("Undo", "noop"), menuItem("Redo", "noop"), menuSep(), menuItem("Settings…", "settings")]),
  View: menuNode(null, [menuItem("Change Wallpaper", "wallpaper"), menuItem("System Monitor", "monitor"), menuSep(), menuItem("Show Desktop", "showdesk")]),
  Window: menuNode(null, [menuItem("Files", "files"), menuItem("Terminal", "terminal"), menuItem("Notes", "notes"), menuItem("About", "about")]),
  Patch: menuNode(null, [menuItem("Patch Viewer", "viewer"), menuItem("Show All Ports", "allports"), menuItem("Hide All Ports", "hideports"), menuSep(), menuItem("Clear All Cords", "clearcords")]),
  Help: menuNode(null, [menuItem("About This System", "about"), menuItem("System Monitor", "monitor")]),
};

/* The NOCTIVAGOUS system menu: default multi-column list, with
 * its session actions as a horizontal 1D section at the foot —
 * a mixed presentation inside one menu. */
const SYS_MENU = menuNode(null, [
  menuItem("◈  About This System", "about"),
  menuItem("⚙  Settings…", "settings", { kbd: "Ctrl+," }),
  menuItem("▤  System Monitor", "monitor"),
  menuSep(),
  menuGroup(null, { direction: "h", view: "list", columns: 1 }, [
    menuItem("▣  Lock", "lock", { kbd: "Ctrl+L" }),
    menuItem("⏻  Log Out…", "logout"),
  ]),
]);

/* The Start launcher is a menu tree with MIXED presentation:
 * the standalone apps as grid cards in 3 columns at the top,
 * then each app group as an accordion section (a tree list
 * that expands in place) — the sections’ presentations are
 * properties of their group nodes, not of the launcher. */
const appMenuItem = (ap) => menuItem(ap.name, ap.id, { icon: <Icon name={ap.icon} />, hint: ap.hint });
const LAUNCHER_MENU = menuNode({ direction: "v", view: "list", columns: 1 }, [
  menuGroup(null, { view: "grid", columns: 3 },
    APPS.filter((ap) => !GROUPS.some((g) => g.members.includes(ap.id))).map(appMenuItem)),
  ...GROUPS.map((g) => menuGroup(g.name, { view: "accordion" },
    g.members.map((id) => appMenuItem(appById(id))))),
]);

export default function Desktop({ onShutdown }) {
  const session = useSlice("session");
  const settings = useSlice("settings");
  const windows = useSlice("windows");
  const ui = useSlice("ui");
  const now = useNow();
  const patch = useSlice("patch");
  // The clock widget publishes its tick for anything wired to it.
  useEffect(() => { publish("clock", "tick", hms(now)); }, [now]);
  const [openMenu, setOpenMenu] = useState(null); // 'sys' | menu name | 'launcher' | null
  const [ctx, setCtx] = useState(null); // {x, y} | null
  const [selIcon, setSelIcon] = useState(null);
  const [openGroups, setOpenGroups] = useState(() => (settings.launchColumn && settings.launchColumn.utilitiesOpen ? { utilities: true } : {})); // launch-bar groups currently opened up
  const lcPosStored = (settings.launchColumn && settings.launchColumn.position) || "top"; // the primary launch bar's stored position
  /* Additional launch bars (settings.launchBars: [{id, position,
   * items}]) — plain containers the user adds from the desktop's
   * right-click menu, configures from their own right-click menu
   * or Settings page, and moves by drag mode. Drag state: a bar
   * is ARMED by its menu's Drag Mode (dragModeId), and while the
   * pointer drags it, barDrag carries the live edge preview that
   * the renders below fold into the bar's position. */
  const extraBars = settings.launchBars || [];
  const [dragModeId, setDragModeId] = useState(null); // "primary" | bar id | null
  const [barDrag, setBarDrag] = useState(null); // {id, pos} while dragging
  const lcPos = barDrag && barDrag.id === "primary" ? barDrag.pos : lcPosStored; // launch bar position: top (default) | left | right | bottom
  const barPosOf = (bar) => (barDrag && barDrag.id === bar.id ? barDrag.pos : bar.position);
  const sectionRef = useRef(null);
  const [displaced, setDisplaced] = useState({}); // furniture pieces relocated out of the launch bar's way: {widgets, wtr}
  const [sizeTick, setSizeTick] = useState(0);
  useEffect(() => {
    let t = 0;
    const onResize = () => { clearTimeout(t); t = setTimeout(() => setSizeTick((n) => n + 1), 150); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  /* Relocation: when the launch bar moves to an edge where a
   * desktop widget's home anchor would overlap the bar (the bar
   * itself, or its About/Trash end), the widget is displaced to
   * a clear anchor instead of being covered — the .displaced
   * rules in the stylesheet name the anchors (widgets drop
   * below the top bar; the Window Stack moves to the
   * bottom-left when the bar takes the right edge). The check
   * measures each piece's UNDISPLACED rect — the class is
   * lifted for the measurement — so it cannot chase its tail. */
  useLayoutEffect(() => {
    const sec = sectionRef.current;
    if (!sec) return;
    const bars = [...sec.querySelectorAll(".desk-area .icons, .desk-area .xbar")];
    if (!bars.length) return;
    const brs = bars.map((b) => b.getBoundingClientRect());
    const hitsBar = (el) => {
      const r = el.getBoundingClientRect();
      return brs.some((b) => r.left < b.right + 4 && b.left < r.right + 4 && r.top < b.bottom + 4 && b.top < r.bottom + 4);
    };
    const next = {};
    for (const [key, sel] of [["widgets", ".widgets"], ["wtr", ".wtr-wrap"]]) {
      const el = sec.querySelector(sel);
      if (!el) { next[key] = false; continue; }
      const had = el.classList.contains("displaced");
      if (had) el.classList.remove("displaced");
      next[key] = hitsBar(el);
      if (had) el.classList.add("displaced");
    }
    setDisplaced((prev) => (prev.widgets === next.widgets && prev.wtr === next.wtr ? prev : next));
  }, [lcPos, sizeTick, settings.launchBars, barDrag]);
  const CHEV = { left: ["\u25B8", "\u25C2"], right: ["\u25C2", "\u25B8"], top: ["\u25BE", "\u25B4"], bottom: ["\u25B4", "\u25BE"] }; // group chevrons point away from the docked edge
  /* Launch-group flyouts unfold PERPENDICULAR to the launcher's
   * axis and alternate at every depth: from a left/right (vertical)
   * launcher the first flyout lists its items in a row, the next
   * in a column, and so on; from a top/bottom (horizontal) launcher
   * the first is a column, the next a row. Members may be apps or
   * further groups (registry GROUPS), resolved per member. */
  const lcVertical = lcPos === "left" || lcPos === "right";
  // A group that is a member of another group lives only inside
  // its parent's flyout; it is not also a top-level launch item.
  const nestedGroupIds = new Set(GROUPS.flatMap((g) => g.members.filter((m) => groupById(m))));
  const flyIsRow = (depth) => (depth % 2 === 1) === lcVertical;
  // Chevron pair [closed, open] for a group item at `depth`, whose
  // own flyout opens at depth + 1: a row extends away from the
  // launcher's edge (left for a right-docked launcher, right
  // otherwise); a column drops below its item, or rises above it
  // when the launcher is docked at the bottom.
  function flyChevron(depth) {
    if (flyIsRow(depth + 1)) return lcPos === "right" ? ["◂", "▸"] : ["▸", "◂"];
    return lcPos === "bottom" ? ["▴", "▾"] : ["▾", "▴"];
  }
  /* A minimized window lives as a list item attached to its
   * app's launch-bar button — directly underneath the button
   * when the bar is at the top (above it at the bottom), to the
   * side when the bar is on a side, where the item stands
   * vertical instead of horizontal. Clicking it (or F over it)
   * restores the window. The stylesheet anchors the list by
   * .lcpos-<pos>; the item is an ordinary button, so the
   * key-click engine's F clicks it like any other. */
  const renderMinList = (id) => {
    const rec = windows.byId[id];
    if (!rec || !rec.min) return null;
    const ap = appById(id);
    if (!ap) return null;
    return (
      <div className="minlist">
        <button className="minitem" data-min-item={id} onClick={() => focusWindow(id)}>
          <Icon name={ap.icon} /><span>{ap.name}</span>
        </button>
      </div>
    );
  };
  function renderFlyMembers(group, depth) {    return group.members.map((id) => {
      const sub = groupById(id);
      if (sub) {
        const open = !!openGroups[sub.id];
        const ch = flyChevron(depth);
        return (
          <div key={sub.id} className="dgroup sub">
            <button data-icon={sub.id} className={"dicon member group" + (open ? " sel" : "")}
              onClick={() => { setSelIcon(sub.id); setOpenGroups((o) => ({ ...o, [sub.id]: !o[sub.id] })); }}>
              <span className="dib"><Icon name={sub.icon} /></span><span>{sub.name}</span>
              <span className="dchev">{ch[open ? 1 : 0]}</span>
            </button>
            {open && (
              <div className={"dfly nest " + (flyIsRow(depth + 1) ? "row" : "col")}>
                {renderFlyMembers(sub, depth + 1)}
              </div>
            )}
          </div>
        );
      }
      const ap = appById(id);
      return (
        <span className="dwrap" key={id}>
          <button data-icon={id} data-configure={id} className={"dicon member" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
            onClick={() => iconClick(id)}>
            <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
          </button>
          {renderMinList(id)}
        </span>
      );
    });
  }
  const lastIconClick = useRef({});
  const load = ui.load || { cpu: 34, mem: 52, net: 21 };

  function closeAll() {
    setOpenMenu(null);
    setCtx(null);
  }
  useEffect(() => {
    function onDoc(e) {
      if (!e.target.closest(".menuwrap") && !e.target.closest("#launcher") && !e.target.closest("#startBtn") && !e.target.closest("#ctxMenu")) closeAll();
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  function menuAction(a) {
    closeAll();
    if (a === "lock") lockScreen();
    else if (a === "logout") logOut();
    else if (a === "wallpaper") cycleWallpaper();
    else if (a === "showdesk") showDesktop();
    else if (a === "noop") toast("Nothing to undo.");
    else if (a === "allports") showAllPorts();
    else if (a === "hideports") hideAllPorts();
    else if (a === "clearcords") { clearCords(); toast("All patch cords removed."); }
    else openWindow(a);
  }
  function cycleWallpaper() {
    const w = (settings.wallpaper + 1) % 3;
    setSetting("wallpaper", w);
    toast("Wallpaper " + (w + 1) + " / 3");
  }

  /* A stack item's click restores its window to a titlebar at
   * the click point and hands it to drag-lock, so the bar
   * arrives already carried by the cursor. */
  const widgetStyle = (id) =>
    WIDGET_STYLES[((settings.widgetStyles || {})[id] || 0) % WIDGET_STYLES.length];

  const restoreStacked = (id) => (e) => {
    const rec = windows.byId[id];
    if (!rec) return;
    const area = document.getElementById("winLayer").getBoundingClientRect();
    const w = rec.w || 480;
    restoreFromStack(
      id,
      Math.round(e.clientX - area.left - w / 2),
      Math.round(e.clientY - area.top - 14),
    );
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("nct:lockwin", { detail: { id } }));
    }));
  };

  function iconClick(id) {
    setSelIcon(id);
    // An app in desktop-layer mode opens on the layer, not in
    // a window (the mode contract, core/layers.js).
    if (appMode(id) === "layer") { toggleLayer(id); return; }
    openWindow(id);
  }

  /* Switch an app's mode from outside it (its launch menu or
   * its settings page), migrating a live instance across. */
  const switchMode = (id) => {
    const next = appMode(id) === "layer" ? "window" : "layer";
    setAppMode(id, next);
    if (next === "layer") {
      if (windows.byId[id]) closeWindow(id);
      store.set("ui", { layer: id });
    } else {
      if (ui.layer === id) closeLayer();
      openWindow(id);
    }
  };

  /* App settings live outside the app: the launch menu's
   * Settings… opens the Settings app on that app's page. */
  const openAppSettings = (id) => {
    store.set("ui", { appSettingsTarget: id });
    if (windows.byId.settings) focusWindow("settings");
    else openWindow("settings");
  };

  /* ---------- launch bars: add, remove, drag ---------- */
  const setLaunchBars = (bars) => store.set("settings", { launchBars: bars });
  const addLaunchBar = () => {
    const used = new Set([lcPosStored, ...extraBars.map((b) => b.position)]);
    const pos = ["bottom", "left", "right", "top"].find((p) => !used.has(p)) || "bottom";
    setLaunchBars([...extraBars, { id: "bar" + Date.now().toString(36), position: pos, items: [] }]);
    toast("Launch bar added at the " + pos + " — right-click it to configure it.");
  };
  const removeLaunchBar = (id) => setLaunchBars(extraBars.filter((b) => b.id !== id));
  const setBarPosition = (key, pos) => {
    if (key === "primary") store.set("settings", { launchColumn: { ...(settings.launchColumn || {}), position: pos } });
    else setLaunchBars(extraBars.map((b) => (b.id === key ? { ...b, position: pos } : b)));
  };
  /* Drag mode: armed from a bar's right-click menu. Pressing on
   * the armed bar picks it up; the bar follows the nearest edge
   * as a live preview (barDrag), and letting go commits that
   * edge as its position and disarms. */
  const beginBarDrag = (key, curPos) => (e) => {
    if (dragModeId !== key) return;
    e.preventDefault();
    const areaEl = e.currentTarget.closest(".desk-area");
    if (!areaEl) return;
    const area = areaEl.getBoundingClientRect();
    let pos = curPos;
    const move = (ev) => {
      const d = {
        left: ev.clientX - area.left, right: area.right - ev.clientX,
        top: ev.clientY - area.top, bottom: area.bottom - ev.clientY,
      };
      pos = Object.keys(d).reduce((a, b) => (d[a] <= d[b] ? a : b));
      setBarDrag({ id: key, pos });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      // The press began on a bar button: swallow the click the
      // release would otherwise deliver to it, so a drag (or a
      // plain press in drag mode) never also opens the app.
      const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", swallow, true);
      setTimeout(() => window.removeEventListener("click", swallow, true), 80);
      setBarPosition(key, pos);
      setBarDrag(null);
      setDragModeId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---------- desktop widgets: placement + freeze ----------
   * The widgets themselves live in the Widget System module
   * (../widgets/widgets.jsx), shared with the greeter; the
   * shell owns their PLACEMENT: settings.desktopWidgets is the
   * ordered list of widget ids on the desktop (absent = the
   * default pair). Hiding a widget removes it from the list;
   * the desktop menu and the Widgets app put it back.
   * Widgets are FROZEN by default (the desktop's freeze, as on
   * windows and layers: desaturated, inert inside, still
   * right-clickable). settings.widgetFrozen records the
   * exceptions — a widget is frozen unless its entry is
   * explicitly false. Unfreezing lives in the widget's
   * right-click menu and on the 9 key. */
  const placedWidgets = settings.desktopWidgets || DEFAULT_DESKTOP_WIDGETS;
  const hiddenWidgets = WIDGETS.filter((w) => w.surface === "desktop" && !placedWidgets.includes(w.id)).map((w) => w.id);
  const isWidgetFrozen = (id) => !settings.widgetFrozen || settings.widgetFrozen[id] !== false;
  const toggleWidgetFrozen = (id) =>
    store.set("settings", { widgetFrozen: { ...(settings.widgetFrozen || {}), [id]: !isWidgetFrozen(id) } });
  const hideWidget = (id) => store.set("settings", { desktopWidgets: placedWidgets.filter((w) => w !== id) });
  const showWidget = (id) => store.set("settings", { desktopWidgets: [...placedWidgets, id] });
  const widgetName = (id) => (widgetById(id) ? widgetById(id).name : id);

  /* ---------- unfrozen widgets act like windows (user, 2026-11-25) ----------
   * An UNFROZEN widget is a draggable element: dragging it moves
   * it out of the widget column onto the desktop, and its
   * position persists (settings.widgetPos, relative to the
   * desktop screen). A frozen widget does not drag — the freeze
   * is what pins it. A widget can also COLLAPSE into a titlebar
   * (settings.widgetCollapsed: id -> "h" | "v"), horizontal like
   * a window's bar or a vertical standing strip; the bar carries
   * the widget's live summary (the clock's bar shows the time —
   * widgets.jsx widgetTitleInfo). Collapse/expand lives in the
   * widget's right-click menu, like Freeze and Hide. */
  const [widgetDrag, setWidgetDrag] = useState(null); // {id, x, y} while dragging
  const widgetCollapsed = (id) => (settings.widgetCollapsed || {})[id] || null;
  const setWidgetCollapsed = (id, mode) => {
    const wc = { ...(settings.widgetCollapsed || {}) };
    if (mode) wc[id] = mode; else delete wc[id];
    store.set("settings", { widgetCollapsed: wc });
  };
  const effWidgetPos = (id) => {
    if (widgetDrag && widgetDrag.id === id) return { x: widgetDrag.x, y: widgetDrag.y };
    return (settings.widgetPos || {})[id] || null;
  };
  const startWidgetDrag = (id, frozen) => (e) => {
    if (frozen || e.button !== 0) return;
    if (e.target.closest("button")) return;
    const sec = sectionRef.current;
    if (!sec) return;
    const secR = sec.getBoundingClientRect();
    const hostR = e.currentTarget.getBoundingClientRect();
    const offX = e.clientX - hostR.left, offY = e.clientY - hostR.top;
    const move = (ev) => setWidgetDrag({
      id,
      x: Math.round(ev.clientX - secR.left - offX),
      y: Math.round(ev.clientY - secR.top - offY),
    });
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setWidgetDrag(null);
      store.set("settings", {
        widgetPos: {
          ...(store.get().settings.widgetPos || {}),
          [id]: {
            x: Math.round(ev.clientX - secR.left - offX),
            y: Math.round(ev.clientY - secR.top - offY),
          },
        },
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const renderWidgetHost = (id) => {
    const frozen = isWidgetFrozen(id);
    const pos = effWidgetPos(id);
    const collapsed = widgetCollapsed(id);
    const h24 = !settings.appSettings || !settings.appSettings.clock || settings.appSettings.clock.hour24 !== false;
    return (
      <div key={id} className={"widget-host" + (frozen ? "" : " live") + (collapsed ? " collapsed" : "")}
        data-widget-host={id}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        onPointerDown={startWidgetDrag(id, frozen)}>
        {collapsed ? (
          <WidgetTitlebar id={id} orient={collapsed} now={now} load={load} hour24={h24}
            styleName={widgetStyle(id)} frozen={frozen} />
        ) : id === "clock" ? (
          <ClockWidget now={now} hour24={h24} styleName={widgetStyle(id)} frozen={frozen}
            portsNode={patch.openFor.clock ? <PortDots owner="clock" /> : null} />
        ) : id === "sysload" ? (
          <SysLoadWidget load={load} styleName={widgetStyle(id)} frozen={frozen}
            portsNode={patch.openFor.sysload ? <PortDots owner="sysload" /> : null} />
        ) : null}
      </div>
    );
  };

  return (
    <section ref={sectionRef} className={"screen on lcpos-" + lcPos} id="desktopScreen">
      <div className={"wall" + (settings.backdrop.mode === "parametric" ? " para" : "")} id="deskWall" data-w={settings.wallpaper}>
        <div className="wall-mark">N</div>
        <div className="reg tl"></div><div className="reg tr"></div><div className="reg bl"></div><div className="reg br"></div>
        <div className="wall-coords">WORKSPACE 01 / 04<br />GRID 44PX · ORIGIN 0,0</div>
      </div>
      <div id="brightVeil" style={{ opacity: ((100 - settings.brightness) / 100) * 0.55 }}></div>

      <header className="sysbar">
        <div className="menuwrap">
          <button className={"menubtn sys" + (openMenu === "sys" ? " open" : "")}
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "sys" ? null : "sys"); setCtx(null); }}>
            <span className="sq" style={{ width: 8, height: 8, background: "var(--green)", display: "inline-block" }}></span> NOCTIVAGOUS ▾
          </button>
          <div className={"dropdown" + (openMenu === "sys" ? " open" : "")}>
            <MenuTree tree={SYS_MENU} onAction={menuAction} />
          </div>
        </div>
        <nav style={{ display: "flex", gap: 2 }}>
          {Object.keys(MENUS).map((name) => (
            <div className="menuwrap" key={name}>
              <button className={"menubtn" + (openMenu === name ? " open" : "")}
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === name ? null : name); setCtx(null); }}>
                {name}
              </button>
              <div className={"dropdown" + (openMenu === name ? " open" : "")}>
                <MenuTree tree={MENUS[name]} onAction={menuAction} />
              </div>
            </div>
          ))}
        </nav>
        <div className="ws-ind"><span className="led"></span><span>Workspace 01 — {session.sessionType}</span></div>
        <div className="top-right">
          <span className="stat hidem" title="Network">
            <svg className="ic" viewBox="0 0 24 24"><path d="M3 10a13 13 0 0 1 18 0M6 13.5a8.5 8.5 0 0 1 12 0M9 17a4 4 0 0 1 6 0" /><circle cx="12" cy="20" r=".6" fill="currentColor" /></svg>
            <span>ETH0</span>
          </span>
          <span className="stat hidem" title="Volume">
            <svg className="ic" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4ZM16 9a4.5 4.5 0 0 1 0 6" /></svg>
            <span>{settings.volume}%</span>
          </span>
          <span className="stat hidem" title="Battery">
            <svg className="ic" viewBox="0 0 24 24"><rect x="3" y="8" width="15" height="8" /><path d="M21 11v2M6 11v2M9 11v2" /></svg>
            <span>{ui.battery}%</span>
          </span>
          <span className="stat" style={{ fontWeight: 700, color: "#eee" }}>{hms(now)}</span>
          <button className="iconbtn" aria-label="Session menu" title="Session"
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "sys" ? null : "sys"); }}>
            <svg className="ic" viewBox="0 0 24 24"><path d="M12 3v8M6.3 6.5a8 8 0 1 0 11.4 0" /></svg>
          </button>
        </div>
      </header>

      <div className="desk-area" id="deskArea"
        onContextMenu={(e) => {
          e.preventDefault();
          setOpenMenu(null);
          const x = Math.min(e.clientX, window.innerWidth - 226);
          const y = Math.min(e.clientY, window.innerHeight - 330);
          const portEl = e.target.closest("[data-port]");
          const cordEl = e.target.closest("[data-cord]");
          const winEl = e.target.closest(".nwin");
          const iconEl = e.target.closest(".dicon");
          const widgetEl = e.target.closest("[data-widget]");
          const barEl = e.target.closest("[data-launchbar]");
          if (portEl) {
            const [owner, port] = portEl.getAttribute("data-port").split(":");
            setCtx({ x, y, kind: "port", owner, port });
          } else if (cordEl) {
            setCtx({ x, y, kind: "cord", id: cordEl.getAttribute("data-cord") });
          } else if (winEl) {
            const id = winEl.getAttribute("data-app");
            focusWindow(id);
            setCtx({ x, y, kind: "win", id });
          } else if (iconEl) {
            const iid = iconEl.getAttribute("data-icon");
            if (groupById(iid)) setCtx({ x, y, kind: "group", id: iid });
            else setCtx({ x, y, kind: "icon", id: iid });
          } else if (widgetEl) {
            setCtx({ x, y, kind: "widget", id: widgetEl.getAttribute("data-widget") });
          } else if (barEl) {
            setCtx({ x, y, kind: "bar", id: barEl.getAttribute("data-launchbar") });
          } else {
            // A frozen window's body takes no events, so a
            // right-click over it lands here: if the point is
            // inside a frozen window, open that window's menu —
            // its Unfreeze lives there.
            const layerEl = document.getElementById("winLayer");
            const lr = layerEl ? layerEl.getBoundingClientRect() : { left: 0, top: 0 };
            const px = e.clientX - lr.left, py = e.clientY - lr.top;
            const fid = windows.order.find((id) => {
              const r = windows.byId[id];
              if (!r || !r.frozen || r.min || r.hidden || r.stacked) return false;
              const hh = r.shaded ? 34 : r.h || 320;
              return px >= r.x && px <= r.x + (r.w || 480) && py >= r.y && py <= r.y + hh;
            });
            if (fid) setCtx({ x, y, kind: "win", id: fid });
            else setCtx({ x, y, kind: "desk" });
          }
        }}>
        <div className={"icons" + (dragModeId === "primary" ? " dragmode" : "")} data-configure="launchcolumn" data-launchbar="primary"
          onPointerDown={beginBarDrag("primary", lcPos)}>
          {["home", "files"].map((id) => {
            const ap = appById(id);
            return (
              <span className="dwrap" key={id}>
                <button data-icon={id} data-configure={id} className={"dicon" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
                  onClick={() => iconClick(id)}>
                  <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
                </button>
                {renderMinList(id)}
              </span>
            );
          })}
          <span className="dwrap">
            <button data-icon="navgraph" data-configure="navgraph" className={"dicon layer" + (ui.layer === "navgraph" || windows.byId.navgraph ? " sel" : "") + (windows.byId.navgraph ? " open" : "") + (settings.launchColumn && settings.launchColumn.layerBadge === false ? " nobadge" : "")}
              onClick={() => iconClick("navgraph")}>
              <span className="dib"><Icon name="graph" /></span><span>NavGraph</span>
            </button>
            {renderMinList("navgraph")}
          </span>
          {["terminal", "browser", "settings", "monitor", "notes"].map((id) => {
            const ap = appById(id);
            return (
              <span className="dwrap" key={id}>
                <button data-icon={id} data-configure={id} className={"dicon" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
                  onClick={() => iconClick(id)}>
                  <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
                </button>
                {renderMinList(id)}
              </span>
            );
          })}
          {GROUPS.filter((g) => !nestedGroupIds.has(g.id)).map((g) => (
            <div key={g.id} className="dgroup">
              <button data-icon={g.id} className={"dicon group" + (openGroups[g.id] ? " sel" : "")}
                onClick={() => { setSelIcon(g.id); setOpenGroups((o) => ({ ...o, [g.id]: !o[g.id] })); }}>
                <span className="dib"><Icon name={g.icon} /></span><span>{g.name}</span>
                <span className="dchev">{(CHEV[lcPos] || CHEV.left)[openGroups[g.id] ? 1 : 0]}</span>
              </button>
              {openGroups[g.id] && (
                <div className={"dfly " + (flyIsRow(1) ? "row" : "col")}>
                  {renderFlyMembers(g, 1)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="icons right" data-launchbar="primary" onPointerDown={beginBarDrag("primary", lcPos)}>
          {["about", "trash"].map((id) => {
            const ap = appById(id);
            return (
              <span className="dwrap" key={id}>
                <button data-icon={id} data-configure={id} className={"dicon" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
                  onClick={() => iconClick(id)}>
                  <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
                </button>
                {renderMinList(id)}
              </span>
            );
          })}
        </div>
        {/* Additional launch bars: containers the user adds from
            the desktop menu. An empty one is just its dashed
            container; its right-click menu configures it (its
            Settings page chooses position + which apps it
            holds) and arms drag mode, in which pressing on the
            bar and letting go at an edge moves it there. Bars
            sharing an edge stack inward in bands. */}
        {extraBars.map((bar, i) => {
          const pos = barPosOf(bar);
          const horiz = pos === "top" || pos === "bottom";
          const band = extraBars.slice(0, i).filter((b) => barPosOf(b) === pos).length + (lcPos === pos ? 1 : 0);
          const base = pos === "bottom" ? 60 : pos === "top" ? 14 : 12;
          const off = { [pos]: base + band * (horiz ? 95 : 92) };
          return (
            <div key={bar.id} className={"xbar xpos-" + pos + (dragModeId === bar.id ? " dragmode" : "")}
              data-launchbar={bar.id} data-configure={"bar:" + bar.id} style={off}
              onPointerDown={beginBarDrag(bar.id, pos)}>
              {bar.items.length === 0 ? (
                <div className="xbar-empty">Launch Bar</div>
              ) : bar.items.map((id) => {
                const ap = appById(id);
                if (!ap) return null;
                return (
                  <span className="dwrap" key={id}>
                    <button data-icon={id} data-configure={id} className={"dicon" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
                      onClick={() => iconClick(id)}>
                      <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
                    </button>
                    {renderMinList(id)}
                  </span>
                );
              })}
            </div>
          );
        })}
        {/* WindowTransformerRegion — List mode, vertical,
            stacking up: collapsed titlebars dropped into the
            square become items of this stack. The wrap shrinks
            while the cursor is over it; a stack item restores
            its window on click and closes it on its × (or the
            A key) without leaving the stack. */}
        <div className={"wtr-wrap" + (displaced.wtr ? " displaced" : "")}>
          <div className="wtr-stack">
            {(windows.stack || []).map((id) => {
              const ap = appById(id);
              if (!ap) return null;
              return (
                <div key={id} className="wtr-item" data-stack-item={id} role="button" onClick={restoreStacked(id)}>
                  <Icon name={ap.icon} /><span>{ap.name}</span>
                  <button className="wtr-x" aria-label={"Close " + ap.name}
                    onClick={(e) => { e.stopPropagation(); closeWindow(id); }}>✕</button>
                </div>
              );
            })}
          </div>
          <div className="wtr"><span>WINDOW</span><span>STACK</span></div>
        </div>
        <div className={"widgets" + (displaced.widgets ? " displaced" : "")}>
          {placedWidgets.filter((id) => !effWidgetPos(id)).map((id) => renderWidgetHost(id))}
        </div>
        {/* Dragged widgets leave the column and live on the
            desktop itself, at their stored positions. */}
        <div className="widget-layer">
          {placedWidgets.filter((id) => effWidgetPos(id)).map((id) => renderWidgetHost(id))}
        </div>
        {ui.layer === "navgraph" && <NavGraphLayer frozen={!!(ui.frozenLayers && ui.frozenLayers.navgraph)} />}
        {ui.layer && ui.layer !== "navgraph" && (() => {
          const ap = appById(ui.layer);
          const App = ap.component;
          const isFrozen = !!(ui.frozenLayers && ui.frozenLayers[ui.layer]);
          return (
            <div className={"app-layer" + (isFrozen ? " frozen" : "")} data-layer-app={ui.layer}>
              <div className="app-layer-bar">
                <span className="app-layer-name">{ap.name} — desktop layer</span>
                <span className="sp"></span>
                <button className="btn sm" onClick={() => switchMode(ui.layer)}>Run in a window</button>
                <button className="btn sm" onClick={() => closeLayer()}>Close</button>
              </div>
              <div className="app-layer-body"><App /></div>
            </div>
          );
        })()}
        <div id="winLayer" style={{ position: "absolute", inset: 0 }}>
          {windows.order.map((id) => (
            <Window key={id} id={id} rec={windows.byId[id]} focused={windows.focusId === id} locked={!!(ui.dragLock && ui.dragLock.id === id)} />
          ))}
        </div>
        <PatchLayer />
      </div>

      <div className={"launcher" + (openMenu === "launcher" ? " open" : "")} id="launcher">
        <div className="lhead">
          <div className="avatar sm">{(session.user.charAt(0) || "N").toUpperCase()}</div>
          <div>
            <div style={{ fontFamily: "var(--font-d)", fontWeight: 600, letterSpacing: ".1em", color: "#eee" }}>{session.user.toUpperCase()}</div>
            <div className="mono" style={{ fontSize: 10, color: "#777", letterSpacing: ".1em" }}>{session.sessionType.toUpperCase()} · :0</div>
          </div>
        </div>
        <MenuTree tree={LAUNCHER_MENU} onAction={menuAction} />
        <div className="hairline"></div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn sm" style={{ flex: 1 }} data-lact="lock" onClick={() => { closeAll(); lockScreen(); }}>Lock</button>
          <button className="btn sm" style={{ flex: 1 }} data-lact="logout" onClick={() => { closeAll(); logOut(); }}>Log Out</button>
          <button className="btn sm danger" style={{ flex: 1 }} data-lact="shutdown" onClick={() => { closeAll(); onShutdown(); }}>Shut Down</button>
        </div>
      </div>

      <footer className="dock">
        <button className="startbtn" id="startBtn"
          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "launcher" ? null : "launcher"); setCtx(null); }}>
          ▦ &nbsp;START
        </button>
        <div className="tasks">
          {windows.order.map((id) => {
            const ap = appById(id);
            const rec = windows.byId[id];
            return (
              <button key={id} className={"task" + (windows.focusId === id ? " active" : "") + (rec.min ? " min" : "") + (rec.hidden ? " hidden" : "")}
                onClick={() => {
                  if (rec.min || windows.focusId !== id) focusWindow(id);
                  else minimizeWindow(id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenMenu(null);
                  setCtx({ x: Math.min(e.clientX, window.innerWidth - 226), y: Math.max(44, e.clientY - 176), kind: "task", id });
                }}>
                <Icon name={ap.icon} /><span>{ap.name}</span>
              </button>
            );
          })}
        </div>
        <button className="btn sm" title="Show desktop" onClick={showDesktop}>Desktop</button>
        <div className="dock-clock">
          <div>{hms(now)}</div>
          <div style={{ color: "#777", fontSize: 10 }}>{now.getDate()}/{pad(now.getMonth() + 1)}/{now.getFullYear()}</div>
        </div>
      </footer>

      {ctx && ctx.kind === "desk" && (
        <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
          {ui.frozenLayers && ui.frozenLayers.navgraph && (
            <button onClick={() => { setCtx(null); toggleLayerFrozen("navgraph"); }}>Unfreeze NavGraph</button>
          )}
          <button data-c="wallpaper" onClick={() => { setCtx(null); cycleWallpaper(); }}>▦ &nbsp;Change Wallpaper</button>
          <button data-c="terminal" onClick={() => { setCtx(null); openWindow("terminal"); }}>▸ &nbsp;Open Terminal</button>
          <button data-c="settings" onClick={() => { setCtx(null); openWindow("settings"); }}>⚙ &nbsp;Settings…</button>
          <button data-c="monitor" onClick={() => { setCtx(null); openWindow("monitor"); }}>▤ &nbsp;System Monitor</button>
          <button data-c="addbar" onClick={() => { setCtx(null); addLaunchBar(); }}>▦ &nbsp;Add Launch Bar</button>
          {hiddenWidgets.map((wid) => (
            <button key={wid} data-c={"showwidget:" + wid} onClick={() => { setCtx(null); showWidget(wid); }}>Show {widgetName(wid)} Widget</button>
          ))}
          <div style={{ height: 1, background: "var(--hair)", margin: "4px 6px" }}></div>
          <button data-c="lock" onClick={() => { setCtx(null); lockScreen(); }}>▣ &nbsp;Lock Screen</button>
          <button data-c="logout" onClick={() => { setCtx(null); logOut(); }}>⏻ &nbsp;Log Out</button>
          <div style={{ padding: "7px 9px 3px" }}>
            <button className="btn sm" style={{ width: "100%" }} onClick={() => { setCtx(null); setOpenMenu("launcher"); }}>Open menu (touch alternative)</button>
          </div>
        </div>
      )}
      {ctx && ctx.kind === "win" && windows.byId[ctx.id] && (() => {
        const rec = windows.byId[ctx.id];
        const run = (fn) => () => { setCtx(null); fn(ctx.id); };
        return (
          <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
            <button onClick={run(focusWindow)}>Focus</button>
            <button onClick={run(toggleShade)}>{rec.shaded ? "Expand" : "Collapse"}</button>
            <button onClick={() => { setCtx(null); setVShade(ctx.id, !rec.vshaded); }}>{rec.vshaded ? "Restore Titlebar" : "Vertical Titlebar"}</button>
            <button onClick={run(minimizeWindow)}>Minimize</button>
            <button onClick={run(toggleMax)}>{rec.max ? "Restore" : "Maximize"}</button>
            <button onClick={run(toggleFrozen)}>{rec.frozen ? "Unfreeze" : "Freeze"}</button>
            <div style={{ height: 1, background: "var(--hair)", margin: "4px 6px" }}></div>
            <button onClick={run(closeWindow)}>Close</button>
          </div>
        );
      })()}
      {ctx && ctx.kind === "icon" && (
        <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
          {ctx.id === "navgraph" ? (
            <>
              <button onClick={() => { setCtx(null); iconClick("navgraph"); }}>Open NavGraph</button>
              {ui.layer === "navgraph" && (
                <button onClick={() => { setCtx(null); toggleLayerFrozen("navgraph"); }}>{ui.frozenLayers && ui.frozenLayers.navgraph ? "Unfreeze NavGraph" : "Freeze NavGraph"}</button>
              )}
              {windows.byId.navgraph && (
                <button onClick={() => { setCtx(null); closeWindow("navgraph"); }}>Quit NavGraph</button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setCtx(null); iconClick(ctx.id); }}>Open {appById(ctx.id) ? appById(ctx.id).name : ctx.id}</button>
              {windows.byId[ctx.id] && (
                <button onClick={() => { setCtx(null); toggleHidden(ctx.id); }}>{windows.byId[ctx.id].hidden ? "Show" : "Hide"} {appById(ctx.id) ? appById(ctx.id).name : ctx.id}</button>
              )}
              {windows.byId[ctx.id] && (
                <button onClick={() => { setCtx(null); closeWindow(ctx.id); }}>Quit {appById(ctx.id) ? appById(ctx.id).name : ctx.id}</button>
              )}
            </>
          )}
          <div style={{ height: 1, background: "var(--hair)", margin: "4px 6px" }}></div>
          <button onClick={() => { setCtx(null); switchMode(ctx.id); }}>{appMode(ctx.id) === "layer" ? "✓ " : ""}Desktop-layer mode</button>
          <button onClick={() => { setCtx(null); openAppSettings(ctx.id); }}>Settings…</button>
        </div>
      )}
      {ctx && ctx.kind === "group" && (
        <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
          <button onClick={() => { setCtx(null); setOpenGroups((o) => ({ ...o, [ctx.id]: !o[ctx.id] })); }}>
            {openGroups[ctx.id] ? "Close" : "Open"} {groupById(ctx.id) ? groupById(ctx.id).name : ctx.id}
          </button>
        </div>
      )}
      {ctx && ctx.kind === "port" && (() => {
        const def = portDef(ctx.owner, ctx.port);
        const n = cordsTouching(ctx.owner, ctx.port).length;
        if (!def) return null;
        return (
          <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
            <div className="ctxhead">{ctx.owner} · {def.label} ({def.dir === "out" ? "output" : "input"})</div>
            <button onClick={() => { setCtx(null); setWatch({ kind: "port", owner: ctx.owner, port: ctx.port }); openWindow("viewer"); }}>Open Viewer</button>
            <button onClick={() => { setCtx(null); portPressed(ctx.owner, ctx.port); }}>{patch.pending ? "Connect Cord Here" : "Begin Cord"}</button>
            {n > 0 && <button onClick={() => { setCtx(null); disconnectPort(ctx.owner, ctx.port); }}>Disconnect ({n})</button>}
          </div>
        );
      })()}
      {ctx && ctx.kind === "cord" && (
        <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
          <div className="ctxhead">Patch cord</div>
          <button onClick={() => { setCtx(null); setWatch({ kind: "cord", id: ctx.id }); openWindow("viewer"); }}>Open Viewer</button>
          <button onClick={() => { setCtx(null); removeCord(ctx.id); }}>Remove Cord</button>
        </div>
      )}
      {ctx && ctx.kind === "bar" && (() => {
        const key = ctx.id;
        const isPrimary = key === "primary";
        const bar = isPrimary ? null : extraBars.find((b) => b.id === key);
        if (!isPrimary && !bar) return null;
        return (
          <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
            <div className="ctxhead">Launch Bar{isPrimary ? " · primary" : " · " + bar.position}</div>
            <button onClick={() => { setCtx(null); openAppSettings(isPrimary ? "launchcolumn" : "bar:" + key); }}>Configure Launch Bar…</button>
            <button onClick={() => { setCtx(null); setDragModeId(dragModeId === key ? null : key); }}>{dragModeId === key ? "✓ " : ""}Drag Mode</button>
            {!isPrimary && <button onClick={() => { setCtx(null); removeLaunchBar(key); }}>Remove Launch Bar</button>}
          </div>
        );
      })()}
      {ctx && ctx.kind === "widget" && (
        <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
          <div className="ctxhead">{widgetName(ctx.id)} Widget</div>
          <button onClick={() => { setCtx(null); toggleWidgetFrozen(ctx.id); }}>{isWidgetFrozen(ctx.id) ? "Unfreeze" : "Freeze"}</button>
          {widgetCollapsed(ctx.id)
            ? <button onClick={() => { setCtx(null); setWidgetCollapsed(ctx.id, null); }}>Expand Widget</button>
            : (<>
                <button onClick={() => { setCtx(null); setWidgetCollapsed(ctx.id, "h"); }}>Collapse to Titlebar — Horizontal</button>
                <button onClick={() => { setCtx(null); setWidgetCollapsed(ctx.id, "v"); }}>Collapse to Titlebar — Vertical</button>
              </>)}
          <button onClick={() => { setCtx(null); hideWidget(ctx.id); }}>Hide Widget</button>
          <button onClick={() => { setCtx(null); openAppSettings("widget:" + ctx.id); }}>Configure…</button>
        </div>
      )}
      {ctx && ctx.kind === "task" && windows.byId[ctx.id] && (() => {
        const rec = windows.byId[ctx.id];
        const run = (fn) => () => { setCtx(null); fn(ctx.id); };
        return (
          <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
            <button onClick={run(focusWindow)}>Focus</button>
            {!rec.min && <button onClick={run(minimizeWindow)}>Minimize</button>}
            <div style={{ height: 1, background: "var(--hair)", margin: "4px 6px" }}></div>
            <button onClick={run(closeWindow)}>Close</button>
          </div>
        );
      })()}
    </section>
  );
}
