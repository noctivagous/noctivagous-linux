import { useEffect, useRef, useState } from "react";
import { useSlice } from "../core/react.js";
import { APPS, appById, Icon } from "../core/registry.jsx";
import { bus, toast } from "../core/bus.js";
import { openWindow, focusWindow, minimizeWindow, showDesktop } from "../core/windows.js";
import { setSetting } from "../core/react.js";
import { lockScreen, logOut } from "./sessionActions.js";
import Window from "./Window.jsx";
import NavGraphLayer from "./NavGraphLayer.jsx";
import { toggleLayer } from "../core/layers.js";
import { useNow, hms, hm, fullDate, pad } from "./useNow.js";

const MENUS = {
  File: [["New Window", "files"], ["Open Terminal", "terminal"], ["—"], ["Lock Screen", "lock"], ["Log Out…", "logout"]],
  Edit: [["Undo", "noop"], ["Redo", "noop"], ["—"], ["Settings…", "settings"]],
  View: [["Change Wallpaper", "wallpaper"], ["System Monitor", "monitor"], ["—"], ["Show Desktop", "showdesk"]],
  Window: [["Files", "files"], ["Terminal", "terminal"], ["Notes", "notes"], ["About", "about"]],
  Help: [["About This System", "about"], ["System Monitor", "monitor"]],
};

export default function Desktop({ onShutdown }) {
  const session = useSlice("session");
  const settings = useSlice("settings");
  const windows = useSlice("windows");
  const ui = useSlice("ui");
  const now = useNow();
  const [openMenu, setOpenMenu] = useState(null); // 'sys' | menu name | 'launcher' | null
  const [ctx, setCtx] = useState(null); // {x, y} | null
  const [selIcon, setSelIcon] = useState(null);
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
    else openWindow(a);
  }
  function cycleWallpaper() {
    const w = (settings.wallpaper + 1) % 3;
    setSetting("wallpaper", w);
    toast("Wallpaper " + (w + 1) + " / 3");
  }

  function iconClick(id) {
    setSelIcon(id);
    openWindow(id);
  }

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
          if (e.target.closest(".nwin") || e.target.closest(".dicon")) return;
          e.preventDefault();
          setOpenMenu(null);
          setCtx({ x: Math.min(e.clientX, window.innerWidth - 226), y: Math.min(e.clientY, window.innerHeight - 300) });
        }}>
        <div className="icons">
          {["home", "files"].map((id) => {
            const ap = appById(id);
            return (
              <button key={id} className={"dicon" + (selIcon === id ? " sel" : "")}
                onClick={() => iconClick(id)}>
                <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
              </button>
            );
          })}
          <button className={"dicon" + (ui.layer === "navgraph" ? " sel" : "")}
            onClick={() => { setSelIcon("navgraph"); toggleLayer("navgraph"); }}>
            <span className="dib"><Icon name="graph" /></span><span>NavGraph</span>
          </button>
          {["terminal", "settings", "monitor", "notes"].map((id) => {
            const ap = appById(id);
            return (
              <button key={id} className={"dicon" + (selIcon === id ? " sel" : "")}
                onClick={() => iconClick(id)}>
                <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
              </button>
            );
          })}
        </div>
        <div className="icons right">
          {["about", "trash"].map((id) => {
            const ap = appById(id);
            return (
              <button key={id} className={"dicon" + (selIcon === id ? " sel" : "")}
                onClick={() => iconClick(id)}>
                <span className="dib"><Icon name={ap.icon} /></span><span>{ap.name}</span>
              </button>
            );
          })}
        </div>
        <div className="widgets">
          <div className="widget">
            <div className="cap" style={{ marginBottom: 6 }}>Local time · <span style={{ color: "#5c5c5c" }}>W-01</span></div>
            <div className="wtime">{hm(now)}</div>
            <div className="wdate">{fullDate(now)}</div>
          </div>
          <div className="widget">
            <div className="cap" style={{ marginBottom: 7 }}>System load · <span style={{ color: "#5c5c5c" }}>W-02</span></div>
            <div className="wmrow"><span>CPU</span><div className="meter"><i style={{ width: load.cpu + "%" }}></i></div><b>{load.cpu}%</b></div>
            <div className="wmrow"><span>MEM</span><div className="meter blue"><i style={{ width: load.mem + "%" }}></i></div><b>{load.mem}%</b></div>
            <div className="wmrow"><span>NET</span><div className="meter amber"><i style={{ width: load.net + "%" }}></i></div><b>{load.net}%</b></div>
          </div>
        </div>
        {ui.layer === "navgraph" && <NavGraphLayer />}
        <div id="winLayer" style={{ position: "absolute", inset: 0 }}>
          {windows.order.map((id) => (
            <Window key={id} id={id} rec={windows.byId[id]} focused={windows.focusId === id} locked={!!(ui.dragLock && ui.dragLock.id === id)} />
          ))}
        </div>
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
              <button key={id} className={"task" + (windows.focusId === id ? " active" : "") + (rec.min ? " min" : "")}
                onClick={() => {
                  if (rec.min || windows.focusId !== id) focusWindow(id);
                  else minimizeWindow(id);
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

      {ctx && (
        <div className="ctxmenu open" id="ctxMenu" style={{ left: ctx.x, top: ctx.y }}>
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
    </section>
  );
}
