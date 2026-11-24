/* Desktop-layer app actions — the ui slice's layer field.
 *
 * A desktop-layer app renders on the desk area itself, under the
 * window layer, instead of inside a window (NavGraph is the
 * first). The store field is the app's id, or null when no layer
 * app is open; the shell mounts the matching component.
 */

import { store } from "./store.js";

export function toggleLayer(id) {
  store.set("ui", { layer: store.get().ui.layer === id ? null : id });
}

export function closeLayer() {
  store.set("ui", { layer: null });
}

/* Freeze a desktop-layer app: it stays on the desk, inert —
 * no pointer events, no view ops, no wheel zoom — until
 * unfrozen. This is the freeze built for layers: a frozen
 * layer app can sit on the desktop without conflicting with
 * other interactions. */
export function toggleLayerFrozen(id) {
  const ui = store.get().ui;
  const fl = { ...(ui.frozenLayers || {}) };
  fl[id] = !fl[id];
  store.set("ui", { frozenLayers: fl });
}

/* App modes — the hooks-and-callbacks contract for running in
 * either kind of frame. Every app has a mode: "window" (a
 * conventional window) or "layer" (a desktop-layer app, on the
 * desk under the window layer). NavGraph defaults to "layer";
 * everything else to "window". The mode is an app setting: it
 * is toggled from the app's launch-column context menu and
 * edited in the Settings app's Applications section — never
 * only from inside the app. An app that honours the contract
 * renders the same component in both frames (the layer host
 * and the window body both mount it at full size) and reads
 * its mode through appMode() rather than assuming a frame.
 * Either kind can be frozen (see toggleLayerFrozen and the
 * window record's frozen flag). */
export function appMode(id) {
  const m = store.get().ui.appModes || {};
  return m[id] || (id === "navgraph" ? "layer" : "window");
}

export function setAppMode(id, mode) {
  const ui = store.get().ui;
  store.set("ui", { appModes: { ...(ui.appModes || {}), [id]: mode } });
}
