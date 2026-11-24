/* The desktop store — one observable state container, plain JS.
 *
 * State lives in named slices; the store is the single source of
 * truth for anything two modules both need (see
 * DESKTOP-ARCHITECTURE.md). Components subscribe per slice through
 * core/react.js (useSlice). Services read and subscribe directly.
 *
 * Slices:
 *   session  — user, session type, lock state
 *   settings — volume, brightness, wallpaper, backdrop parameters
 *   windows  — the window manager's table (id -> window record)
 *   ui       — toast, battery readout (transient chrome state)
 *   patch    — the patchbay: ports, cords, deliveries (core/patchbay.js)
 */

import { BACKDROP_DEFAULTS } from "../services/surfaces.js";

const initialState = {
  session: {
    user: "noctivagous",
    sessionType: "Flat Space",
    screen: "login", // 'login' | 'desktop'
    lockMode: false,
  },
  settings: {
    volume: 62,
    brightness: 78,
    wallpaper: 0, // classic gradient index (backdrop.mode 'classic')
    widgetStyles: {}, // widget id -> built-in style-set index (the 0 key cycles it)
    appSettings: {}, // app id -> that app's own settings (edited from its launch menu's Settings…)
    launchColumn: {}, // the launch column's own settings (its Configure page)
    backdrop: { ...BACKDROP_DEFAULTS },
  },
  windows: {
    order: [], // app ids, in open order (taskbar order)
    byId: {}, // id -> {x,y,w,h,z,min,max,shaded,stacked,seq,prev}
    stack: [], // app ids transformed into the WindowTransformerRegion, in arrival order
    focusId: null,
    zTop: 10,
    seq: 0,
  },
  ui: {
    toast: null, // {msg, at}
    battery: 87,
    dragLock: null,
    layer: null, // desktop-layer app id ('navgraph') or null
    frozenLayers: {}, // layer id -> frozen (the \ key / Freeze): inert until unfrozen
    appModes: {}, // app id -> "window" | "layer" (default: navgraph layer, the rest window)
    appSettingsTarget: null, // app id whose settings the Settings app should show
  },
  patch: {
    openFor: {}, // owner id -> ports shown on its edges
    cords: [], // {id, from:{owner,port}, to:{owner,port}}
    pending: null, // {owner, port} — a cord being drawn
    watch: null, // the Patch Viewer's target
    values: {}, // "owner:port" -> last value seen there
    log: [], // recent deliveries {at, cordId, from, to, value}
  },
};

export function createStore() {
  let state = initialState;
  const listeners = new Set();
  return {
    get() {
      return state;
    },
    /* Replace one slice (shallow-merged) and notify. */
    set(slice, patch) {
      state = { ...state, [slice]: { ...state[slice], ...patch } };
      listeners.forEach((fn) => fn());
    },
    /* Replace a whole slice outright (window table surgery). */
    replace(slice, value) {
      state = { ...state, [slice]: value };
      listeners.forEach((fn) => fn());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/* The composition root creates exactly one store and passes it down
 * through React context; services receive it directly. */
export const store = createStore();
