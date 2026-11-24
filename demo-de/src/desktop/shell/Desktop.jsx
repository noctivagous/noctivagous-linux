import { useEffect, useRef, useState } from "react";
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

const MENUS = {
  File: [["New Window", "files"], ["Open Terminal", "terminal"], ["—"], ["Lock Screen", "lock"], ["Log Out…", "logout"]],
  Edit: [["Undo", "noop"], ["Redo", "noop"], ["—"], ["Settings…", "settings"]],
  View: [["Change Wallpaper", "wallpaper"], ["System Monitor", "monitor"], ["—"], ["Show Desktop", "showdesk"]],
  Window: [["Files", "files"], ["Terminal", "terminal"], ["Notes", "notes"], ["About", "about"]],
  Patch: [["Patch Viewer", "viewer"], ["Show All Ports", "allports"], ["Hide All Ports", "hideports"], ["—"], ["Clear All Cords", "clearcords"]],
  Help: [["About This System", "about"], ["System Monitor", "monitor"]],
};

/* The desktop widgets' built-in style sets. The 0 key cycles
 * the set of the widget under the cursor; the shell stores the
 * selected index per widget (settings.widgetStyles). */
export const WIDGET_STYLES = ["panel", "glass", "recessed"];

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
  const [openGroups, setOpenGroups] = useState(() => (settings.launchColumn && settings.launchColumn.utilitiesOpen ? { utilities: true } : {})); // launch-column groups currently opened up
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

  return (
    <section className="screen on" id="desktopScreen">
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
            <button data-act="about" onClick={() => menuAction("about")}>◈ &nbsp;About This System</button>
            <button data-act="settings" onClick={() => menuAction("settings")}>⚙ &nbsp;Settings… <span className="k">Ctrl+,</span></button>
            <button data-act="monitor" onClick={() => menuAction("monitor")}>▤ &nbsp;System Monitor</button>
            <div className="sep"></div>
            <button data-act="lock" onClick={() => menuAction("lock")}>▣ &nbsp;Lock Screen <span className="k">Ctrl+L</span></button>
            <button data-act="logout" onClick={() => menuAction("logout")}>⏻ &nbsp;Log Out…</button>
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
                {MENUS[name].map((it, i) =>
                  it[0] === "—" ? (
                    <div className="sep" key={i}></div>
                  ) : (
                    <button key={i} data-act={it[1]} onClick={() => menuAction(it[1])}>{it[0]}</button>
                  ),
                )}
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
        <div className="icons" data-configure="launchcolumn">
          {["home", "files"].map((id) => {
            const ap = appById(id);
            return (
              <button key={id} data-icon={id} data-configure={id} className={"dicon" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
                onClick={() => iconClick(id)}>
                <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
              </button>
            );
          })}
          <button data-icon="navgraph" data-configure="navgraph" className={"dicon layer" + (ui.layer === "navgraph" || windows.byId.navgraph ? " sel" : "") + (windows.byId.navgraph ? " open" : "") + (settings.launchColumn && settings.launchColumn.layerBadge === false ? " nobadge" : "")}
            onClick={() => iconClick("navgraph")}>
            <span className="dib"><Icon name="graph" /></span><span>NavGraph</span>
          </button>
          {["terminal", "browser", "settings", "monitor", "notes"].map((id) => {
            const ap = appById(id);
            return (
              <button key={id} data-icon={id} data-configure={id} className={"dicon" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
                onClick={() => iconClick(id)}>
                <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
              </button>
            );
          })}
          {GROUPS.map((g) => (
            <div key={g.id} className="dgroup">
              <button data-icon={g.id} className={"dicon group" + (openGroups[g.id] ? " sel" : "")}
                onClick={() => { setSelIcon(g.id); setOpenGroups((o) => ({ ...o, [g.id]: !o[g.id] })); }}>
                <span className="dib"><Icon name={g.icon} /></span><span>{g.name}</span>
                <span className="dchev">{openGroups[g.id] ? "▾" : "▸"}</span>
              </button>
              {openGroups[g.id] && g.members.map((id) => {
                const ap = appById(id);
                return (
                  <button key={id} data-icon={id} data-configure={id} className={"dicon member" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
                    onClick={() => iconClick(id)}>
                    <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="icons right">
          {["about", "trash"].map((id) => {
            const ap = appById(id);
            return (
              <button key={id} data-icon={id} data-configure={id} className={"dicon" + (selIcon === id ? " sel" : "") + (windows.byId[id] ? " open" : "") + (windows.byId[id] && windows.byId[id].hidden ? " hidden" : "")}
                onClick={() => iconClick(id)}>
                <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
              </button>
            );
          })}
        </div>
        {/* WindowTransformerRegion — List mode, vertical,
            stacking up: collapsed titlebars dropped into the
            square become items of this stack. */}
        <div className="wtr-stack">
          {(windows.stack || []).map((id) => {
            const ap = appById(id);
            if (!ap) return null;
            return (
              <button key={id} className="wtr-item" data-stack-item={id} onClick={restoreStacked(id)}>
                <Icon name={ap.icon} /><span>{ap.name}</span>
              </button>
            );
          })}
        </div>
        <div className="wtr"><span>STACK</span></div>
        <div className="widgets">
          <div className={"widget ws-" + widgetStyle("clock")} data-widget="clock" data-configure="widget:clock" data-patch-owner="clock">
            <div className="cap" style={{ marginBottom: 6 }}>Local time · <span style={{ color: "#5c5c5c" }}>W-01</span></div>
            <div className="wtime">{(() => {
              const h24 = !settings.appSettings || !settings.appSettings.clock || settings.appSettings.clock.hour24 !== false;
              if (h24) return hm(now);
              let h = now.getHours() % 12;
              if (h === 0) h = 12;
              return <>{pad(h) + ":" + pad(now.getMinutes())}<span className="wampm">{now.getHours() < 12 ? "AM" : "PM"}</span></>;
            })()}</div>
            <div className="wdate">{fullDate(now)}</div>
            {patch.openFor.clock && <PortDots owner="clock" />}
          </div>
          <div className={"widget ws-" + widgetStyle("sysload")} data-widget="sysload" data-configure="widget:sysload" data-patch-owner="sysload">
            <div className="cap" style={{ marginBottom: 7 }}>System load · <span style={{ color: "#5c5c5c" }}>W-02</span></div>
            {patch.openFor.sysload && <PortDots owner="sysload" />}
            <div className="wmrow"><span>CPU</span><div className="meter"><i style={{ width: load.cpu + "%" }}></i></div><b>{load.cpu}%</b></div>
            <div className="wmrow"><span>MEM</span><div className="meter blue"><i style={{ width: load.mem + "%" }}></i></div><b>{load.mem}%</b></div>
            <div className="wmrow"><span>NET</span><div className="meter amber"><i style={{ width: load.net + "%" }}></i></div><b>{load.net}%</b></div>
          </div>
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
        <div>
          {APPS.map((ap) => (
            <button key={ap.id} className="app" onClick={() => { closeAll(); openWindow(ap.id); }}>
              <Icon name={ap.icon} /><span>{ap.name}</span><small>{ap.hint}</small>
            </button>
          ))}
        </div>
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
