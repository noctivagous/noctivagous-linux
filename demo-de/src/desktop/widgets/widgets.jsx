/* NCT-WL-KIT — the Widget System: ONE module owns every widget
 * the shell renders, on the desktop and on the greeter alike.
 *
 *   widgets.jsx        the registry (WIDGETS), the shared style
 *                      sets, and the DESKTOP surface's widgets
 *                      (Clock, System Load) as components.
 *   greeterWidgets.jsx the GREETER surface's widgets (weather,
 *                      processes, vehicle, cameras, network).
 *
 * A widget entry names its surface; each surface renders its
 * own widgets with its own data. Desktop widgets are placed by
 * settings.desktopWidgets (an ordered list of ids; absent =
 * the default pair) and are frozen by default — the shell
 * (Desktop.jsx) owns placement, freezing and the right-click
 * menu; this module owns what a widget IS. The Widgets app is
 * the gallery these cards are dragged from.
 */

import { hm, fullDate, pad } from "../shell/useNow.js";
import { WeatherAnim, SunburstProcesses, VehicleMap, CamGrid, NetChart } from "./greeterWidgets.jsx";

/* The desktop widgets' built-in style sets. The 0 key cycles
 * the set of the widget under the cursor; the shell stores the
 * selected index per widget (settings.widgetStyles).
 * "transparent" (user, 2026-11-25) is the fourth set: no plate
 * at all — the widget's text sits directly on the backdrop,
 * the way the greeter's clock area does. A widget may name a
 * defaultStyle in the registry (the clock's is transparent);
 * a stored choice always wins over the default. */
export const WIDGET_STYLES = ["panel", "glass", "recessed", "transparent"];

/* The effective style index for a widget: the stored choice,
 * else the widget's registry default, else "panel". */
export function widgetStyleIndex(settings, id) {
  const stored = settings && settings.widgetStyles ? settings.widgetStyles[id] : undefined;
  if (stored != null) return stored % WIDGET_STYLES.length;
  const w = widgetById(id);
  const d = w && w.defaultStyle ? WIDGET_STYLES.indexOf(w.defaultStyle) : -1;
  return d >= 0 ? d : 0;
}
export function widgetStyleName(settings, id) {
  return WIDGET_STYLES[widgetStyleIndex(settings, id)];
}

/* GRAY GRADATIONS (user, 2026-11-25): each desktop widget also
 * carries a gradation step (wg-1 lightest … wg-4 darkest) that
 * COMBINES with its style set — the styles render the step as a
 * plate, a translucent pane, or a recess (styles/nct-desktop.css,
 * the --wgt/--wgb variables). Registry entries name their step;
 * a caller may override it with the `gray` prop. */
export const WIDGET_GRAYS = ["wg-1", "wg-2", "wg-3", "wg-4"];

/* The desktop Clock: local time + date. `portsNode` is the
 * shell's PortDots element when the patch bay has this widget's
 * ports open; `preview` renders the bare widget for the Widgets
 * app's cards, without the desktop's data hooks. */
export function ClockWidget({ now, hour24, styleName, gray, frozen, portsNode, preview }) {
  return (
    <div className={"widget " + (gray || "wg-1") + " ws-" + (styleName || "panel") + (frozen ? " frozen" : "")}
      {...(preview ? {} : { "data-widget": "clock", "data-configure": "widget:clock", "data-patch-owner": "clock" })}>
      <div className="cap" style={{ marginBottom: 6 }}>Local time · <span style={{ color: "#5c5c5c" }}>W-01</span></div>
      <div className="wtime">{(() => {
        if (hour24 !== false) return hm(now);
        let h = now.getHours() % 12;
        if (h === 0) h = 12;
        return <>{pad(h) + ":" + pad(now.getMinutes())}<span className="wampm">{now.getHours() < 12 ? "AM" : "PM"}</span></>;
      })()}</div>
      <div className="wdate">{fullDate(now)}</div>
      {portsNode}
    </div>
  );
}

/* The desktop System Load: CPU / MEM / NET meters fed by the
 * shell's simulated load (ui.load). */
export function SysLoadWidget({ load, styleName, gray, frozen, portsNode, preview }) {
  const l = load || { cpu: 0, mem: 0, net: 0 };
  return (
    <div className={"widget " + (gray || "wg-2") + " ws-" + (styleName || "panel") + (frozen ? " frozen" : "")}
      {...(preview ? {} : { "data-widget": "sysload", "data-configure": "widget:sysload", "data-patch-owner": "sysload" })}>
      <div className="cap" style={{ marginBottom: 7 }}>System load · <span style={{ color: "#5c5c5c" }}>W-02</span></div>
      {portsNode}
      <div className="wmrow"><span>CPU</span><div className="meter"><i style={{ width: l.cpu + "%" }}></i></div><b>{l.cpu}%</b></div>
      <div className="wmrow"><span>MEM</span><div className="meter blue"><i style={{ width: l.mem + "%" }}></i></div><b>{l.mem}%</b></div>
      <div className="wmrow"><span>NET</span><div className="meter amber"><i style={{ width: l.net + "%" }}></i></div><b>{l.net}%</b></div>
    </div>
  );
}

/* The registry: every widget the system knows, and the surface
 * it belongs to. Desktop entries are placeable (the Widgets
 * app's cards, settings.desktopWidgets); greeter entries are
 * the sign-in dashboard's panels. */
export const WIDGETS = [
  { id: "clock", name: "Clock", surface: "desktop", component: ClockWidget, gray: "wg-1", defaultStyle: "transparent" },
  { id: "sysload", name: "System Load", surface: "desktop", component: SysLoadWidget, gray: "wg-2" },
  { id: "weather", name: "Weather", surface: "greeter", component: WeatherAnim },
  { id: "processes", name: "Processes", surface: "greeter", component: SunburstProcesses },
  { id: "vehicle", name: "Vehicle", surface: "greeter", component: VehicleMap },
  { id: "cameras", name: "Cameras", surface: "greeter", component: CamGrid },
  { id: "network", name: "Network", surface: "greeter", component: NetChart },
];
export const widgetById = (id) => WIDGETS.find((w) => w.id === id);
export const DEFAULT_DESKTOP_WIDGETS = ["clock", "sysload"];

/* The live one-line summary a widget shows when it is collapsed
 * into its titlebar (user, 2026-11-25): the bar still carries
 * the widget's essential information — the clock's bar shows
 * the time, the load widget's bar shows CPU · MEM. */
export function widgetTitleInfo(id, { now, load, hour24 } = {}) {
  if (id === "clock" && now) {
    if (hour24 !== false) return hm(now);
    let h = now.getHours() % 12;
    if (h === 0) h = 12;
    return pad(h) + ":" + pad(now.getMinutes()) + " " + (now.getHours() < 12 ? "AM" : "PM");
  }
  if (id === "sysload") {
    const l = load || { cpu: 0, mem: 0, net: 0 };
    return "CPU " + l.cpu + "% · MEM " + l.mem + "%";
  }
  return "";
}

/* A widget collapsed into its titlebar (user, 2026-11-25):
 * horizontal (a bar like a window's) or vertical (a standing
 * strip). It carries the widget's name and its live title info,
 * keeps the widget's gradation step + style set, and keeps the
 * shell's data-widget / data-configure hooks so right-click,
 * the 9 key and Configure… all still find the widget. */
export function WidgetTitlebar({ id, orient, now, load, hour24, styleName, gray, frozen }) {
  const w = widgetById(id);
  if (!w) return null;
  const info = widgetTitleInfo(id, { now, load, hour24 });
  return (
    <div className={"widget wtitlebar " + (gray || w.gray || "wg-2") + " ws-" + (styleName || "panel")
        + (orient === "v" ? " vert" : "") + (frozen ? " frozen" : "")}
      data-widget={id} data-configure={"widget:" + id}>
      <span className="wt-name">{w.name}</span>
      {info ? <span className="wt-info">{info}</span> : null}
    </div>
  );
}
