/* The Widgets app — the Widget System's gallery
 * (src/desktop/widgets/): a scrollable card layout of every
 * widget in the registry. Desktop widgets show a live preview;
 * a card that isn't on the desktop can be DRAGGED out of the
 * window and dropped on the desktop to place it (or placed
 * with its button), and a placed widget can be removed from
 * here too. Greeter widgets are listed with their surface —
 * they belong to the sign-in dashboard and are not placeable.
 * Placement itself is settings.desktopWidgets, owned by the
 * shell; this app only edits that list. */
import { useState } from "react";
import { useSlice, store } from "../core/react.js";
import { toast } from "../core/bus.js";
import { StatusBar } from "./shared.jsx";
import { WIDGETS, DEFAULT_DESKTOP_WIDGETS, ClockWidget, SysLoadWidget } from "../widgets/widgets.jsx";
import { useNow } from "../shell/useNow.js";

export default function WidgetsApp() {
  const settings = useSlice("settings");
  const ui = useSlice("ui");
  const now = useNow();
  const load = ui.load || { cpu: 34, mem: 52, net: 21 };
  const placed = settings.desktopWidgets || DEFAULT_DESKTOP_WIDGETS;
  const [drag, setDrag] = useState(null); // {id, x, y} while a card is being dragged out
  const setPlaced = (ids) => store.set("settings", { desktopWidgets: ids });
  const hour24 = !settings.appSettings || !settings.appSettings.clock || settings.appSettings.clock.hour24 !== false;

  const previewFor = (w) => {
    if (w.id === "clock") return <ClockWidget preview now={now} hour24={hour24} styleName="panel" />;
    if (w.id === "sysload") return <SysLoadWidget preview load={load} styleName="panel" />;
    return null;
  };

  /* Drag a card to the desktop: the press picks the card up (a
   * ghost label follows the pointer); releasing over the desk
   * area — and not over any window, this one included — places
   * the widget. */
  const startDrag = (w) => (e) => {
    if (placed.includes(w.id)) return;
    if (e.target.closest("button")) return;
    e.preventDefault();
    setDrag({ id: w.id, x: e.clientX, y: e.clientY });
    const move = (ev) => setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      setDrag(null);
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const onDesk = el && el.closest && el.closest("#deskArea") && !el.closest(".nwin");
      if (onDesk) {
        setPlaced([...placed, w.id]);
        toast(w.name + " widget placed on the desktop.");
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  };

  const desktopWidgets = WIDGETS.filter((w) => w.surface === "desktop");
  const greeterWidgets = WIDGETS.filter((w) => w.surface === "greeter");
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="wgrid">
          {desktopWidgets.map((w) => {
            const isPlaced = placed.includes(w.id);
            return (
              <div key={w.id} className={"wcard" + (isPlaced ? " placed" : "") + (drag && drag.id === w.id ? " dragging" : "")}
                data-widget-card={w.id} onPointerDown={startDrag(w)}>
                <div className="wcard-preview">{previewFor(w)}</div>
                <div className="wcard-head"><span>{w.name}</span><span className="wtag">DESKTOP</span></div>
                <div className="wcard-state">{isPlaced ? "On the desktop" : "Not placed — drag it to the desktop, or place it:"}</div>
                {isPlaced ? (
                  <button className="btn sm" onClick={() => setPlaced(placed.filter((id) => id !== w.id))}>Remove from Desktop</button>
                ) : (
                  <button className="btn sm" onClick={() => setPlaced([...placed, w.id])}>Place on Desktop</button>
                )}
              </div>
            );
          })}
          {greeterWidgets.map((w) => (
            <div key={w.id} className="wcard greeter" data-widget-card={w.id}>
              <div className="wcard-head"><span>{w.name}</span><span className="wtag">GREETER</span></div>
              <div className="wcard-state">Shown on the sign-in dashboard.</div>
            </div>
          ))}
        </div>
        <StatusBar left="WIDGET SYSTEM" right={placed.length + " ON DESKTOP"} />
      </div>
      {drag && (
        <div className="wdrag-ghost" style={{ left: drag.x + 10, top: drag.y + 10 }}>
          {(WIDGETS.find((w) => w.id === drag.id) || {}).name} widget
        </div>
      )}
    </>
  );
}
