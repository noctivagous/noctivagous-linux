/* NCT-WL-COMPOSITOR — the composition root of the compositor model: it hosts every window and layer and owns the bridges between them. See WAYLAND-MAP.md. */
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
import { openWindow, focusWindow, moveWindow, setVShade, setFlipped, toggleHidden, closeWindow, resizeTo, transformWindow, toggleFrozen, minimizeWindow } from "../core/windows.js";
import { toggleLayerFrozen } from "../core/layers.js";
import { attachPatchbay } from "../core/patchbay.js";
import { lockScreen, logOut } from "./sessionActions.js";
import { startKeyClicks } from "../../keyclicks/index.js";
import Login from "./Login.jsx";
import Desktop from "./Desktop.jsx";
import { WIDGET_STYLES, widgetStyleIndex } from "../widgets/widgets.jsx";
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
    // The WindowTransformerRegion claims a window when it is
    // dropped into the square — by a titlebar drag (nct:windrop)
    // or by a drag-lock release (the winlock bridge going
    // quiet). Configuration: only windows collapsed into
    // titlebars transform.
    const WTR_CONFIG = { accepts: "titlebar" };
    function maybeTransform(id) {
      const rec = store.get().windows.byId[id];
      if (!rec || rec.stacked) return;
      if (WTR_CONFIG.accepts === "titlebar" && !rec.shaded) return;
      const region = document.querySelector(".wtr");
      const winEl = document.querySelector('.nwin[data-app="' + id + '"]');
      if (!region || !winEl) return;
      const a = region.getBoundingClientRect();
      const b = winEl.getBoundingClientRect();
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      if (cx > a.left && cx < a.right && cy > a.top && cy < a.bottom) {
        transformWindow(id);
      }
    }
    const onWinDrop = (e) => {
      const d = e.detail || {};
      if (d.id) maybeTransform(d.id);
    };
    window.addEventListener("nct:windrop", onWinDrop);
    // The 0 key cycles a widget's built-in style set.
    const onWidgetStyle = (e) => {
      const id = e.detail && e.detail.id;
      if (!id) return;
      const st = store.get().settings;
      const ws = { ...(st.widgetStyles || {}) };
      ws[id] = (widgetStyleIndex(st, id) + 1) % WIDGET_STYLES.length;
      store.set("settings", { ...st, widgetStyles: ws });
    };
    window.addEventListener("nct:widgetstyle", onWidgetStyle);
    // The 9 key's freeze toggle (window, desktop widget or
    // desktop-layer app). Widgets are frozen by default: their
    // settings entry records the state outright (absent = frozen).
    const onFreeze = (e) => {
      const d = e.detail || {};
      if (d.target === "window" && d.id) toggleFrozen(d.id);
      else if (d.target === "layer" && d.id) toggleLayerFrozen(d.id);
      else if (d.target === "widget" && d.id) {
        const st = store.get().settings;
        const wf = { ...(st.widgetFrozen || {}) };
        const frozen = wf[d.id] !== false;
        wf[d.id] = !frozen;
        store.set("settings", { ...st, widgetFrozen: wf });
      }
    };
    window.addEventListener("nct:freeze", onFreeze);
    // The Configure key (\): open the Settings app on the
    // hovered element's page — configuration lives outside the
    // thing being configured.
    const onConfigure = (e) => {
      const target = e.detail && e.detail.target;
      if (!target) return;
      store.set("ui", { appSettingsTarget: target });
      const w = store.get().windows;
      if (w.byId.settings) focusWindow("settings");
      else openWindow("settings");
    };
    window.addEventListener("nct:configure", onConfigure);
    let lastLockId = null;
    function onWinLock(e) {
      store.set("ui", { dragLock: e.detail || null });
      if (e.detail && e.detail.id) lastLockId = e.detail.id;
      else if (lastLockId) {
        const id = lastLockId;
        lastLockId = null;
        maybeTransform(id);
      }
    }
    document.addEventListener("nct:winlock", onWinLock);
    function onVShade(e) {
      const d = e.detail || {};
      if (d.id) setVShade(d.id, d.on);
    }
    document.addEventListener("nct:vshade", onVShade);
    function onWinFlip(e) {
      const d = e.detail || {};
      const rec = d.id && store.get().windows.byId[d.id];
      if (rec) setFlipped(d.id, !rec.flipped);
    }
    window.addEventListener("nct:winflip", onWinFlip);
    const onAppCtl = (e) => {
      const { op, app } = e.detail || {};
      if (!app) return;
      if (op === "toggleHide") toggleHidden(app);
      else if (op === "quit") closeWindow(app);
      else if (op === "minimize") minimizeWindow(app);
    };
    window.addEventListener("nct:appctl", onAppCtl);
    const onWinResize = (e) => {
      const d = e.detail || {};
      if (d.id) resizeTo(d.id, d);
    };
    window.addEventListener("nct:winresize", onWinResize);
    const detachPatchbay = attachPatchbay();
    return () => {
      offToast();
      offOpen();
      offLock();
      offLogout();
      clearInterval(batt);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("nct:winmove", onWinMove);
      document.removeEventListener("nct:winlock", onWinLock);
      window.removeEventListener("nct:windrop", onWinDrop);
      window.removeEventListener("nct:widgetstyle", onWidgetStyle);
      window.removeEventListener("nct:freeze", onFreeze);
      window.removeEventListener("nct:configure", onConfigure);
      document.removeEventListener("nct:vshade", onVShade);
      window.removeEventListener("nct:winflip", onWinFlip);
      window.removeEventListener("nct:appctl", onAppCtl);
      window.removeEventListener("nct:winresize", onWinResize);
      detachPatchbay();
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
