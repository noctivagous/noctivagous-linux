/* DesktopApp — the composition root.
 *
 * Creates nothing itself (the store is a module singleton), but it
 * starts everything: the input subsystem (key-clicks), the bus
 * handlers for session signals, the toast host, the battery drift,
 * and the global keys the desktop owns (Esc closes menus, Ctrl+L
 * locks). It renders the BackdropView behind whichever screen is
 * live, so the backdrop's one simulation runs across the session
 * boundary. See DESKTOP-ARCHITECTURE.md.
 */

import { useEffect, useState } from "react";
import { store, useSlice } from "../core/react.js";
import { bus } from "../core/bus.js";
import { openWindow, moveWindow, setVShade } from "../core/windows.js";
import { lockScreen, logOut } from "./sessionActions.js";
import { startKeyClicks } from "../../keyclicks/index.js";
import Login from "./Login.jsx";
import Desktop from "./Desktop.jsx";
import BackdropView from "./BackdropView.jsx";

export default function DesktopApp() {
  const session = useSlice("session");
  const [toastMsg, setToastMsg] = useState(null);
  const [overlay, setOverlay] = useState(null); // 'restart' | 'power' | null

  useEffect(() => {
    startKeyClicks();
    let toastTimer = null;
    const offToast = bus.on("toast", (msg) => {
      setToastMsg(msg);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setToastMsg(null), 2600);
    });
    const offOpen = bus.on("openApp", (id) => openWindow(id));
    const offLock = bus.on("lock", () => lockScreen());
    const offLogout = bus.on("logout", () => logOut());
    const batt = setInterval(() => {
      if (Math.random() < 0.25) {
        const b = store.get().ui.battery;
        if (b > 20) store.set("ui", { battery: b - 1 });
      }
    }, 30000);
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l" && store.get().session.screen === "desktop") {
        e.preventDefault();
        lockScreen();
      }
    }
    document.addEventListener("keydown", onKey);
    // Host bridge: the input subsystem never writes window
    // geometry; it asks, and the window manager applies.
    function onWinMove(e) {
      const d = e.detail || {};
      if (d.id) moveWindow(d.id, d.x, d.y);
    }
    document.addEventListener("nct:winmove", onWinMove);
    function onWinLock(e) {
      store.set("ui", { dragLock: e.detail || null });
    }
    document.addEventListener("nct:winlock", onWinLock);
    function onVShade(e) {
      const d = e.detail || {};
      if (d.id) setVShade(d.id, d.on);
    }
    document.addEventListener("nct:vshade", onVShade);
    return () => {
      offToast();
      offOpen();
      offLock();
      offLogout();
      clearInterval(batt);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("nct:winmove", onWinMove);
      document.removeEventListener("nct:winlock", onWinLock);
      document.removeEventListener("nct:vshade", onVShade);
    };
  }, []);

  function restart() {
    setOverlay("restart");
    setTimeout(() => {
      setOverlay(null);
      logOut();
    }, 1600);
  }
  function shutdown() {
    setOverlay("power");
  }
  function powerOn() {
    setOverlay(null);
    logOut();
  }

  return (
    <>
      <BackdropView />
      {session.screen === "login" ? (
        <Login onPower={shutdown} onRestart={restart} />
      ) : (
        <Desktop onShutdown={shutdown} />
      )}

      {overlay === "restart" && (
        <div className="overlay on" style={{ display: "flex" }}>
          <div className="big">Restarting…</div>
          <div className="indet" style={{ width: 220 }}><i></i></div>
          <div className="mono" style={{ fontSize: 11 }}>Stopping session · unmounting /home</div>
        </div>
      )}
      {overlay === "power" && (
        <div className="overlay on" style={{ display: "flex" }}>
          <div style={{ fontSize: 34, color: "#333" }}>⏻</div>
          <div className="big" style={{ color: "#555" }}>Powered off</div>
          <button className="btn primary" style={{ minWidth: 150 }} onClick={powerOn}>Power on</button>
        </div>
      )}
      {toastMsg && (
        <div id="toast" style={{ display: "block" }}>{toastMsg}</div>
      )}
    </>
  );
}
