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
