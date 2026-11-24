/* Session transitions — the shell's answers to the bus signals
 * (lock / logout / shutdown) and to a completed login. Kept out of
 * the components so Login, Desktop and the launcher all drive the
 * same transitions. */

import { store } from "../core/store.js";
import { clearWindows, openWindow } from "../core/windows.js";
import { appMode, toggleLayer } from "../core/layers.js";
import { toast } from "../core/bus.js";

/* Launch whatever the greeter dashboard queued (click-to-queue on
 * the login screen). Runs after the default windows exist; ids
 * already open are skipped, layer-mode apps open as layers. The
 * queue is cleared first so a re-entry can never replay it. */
export function drainLaunchQueue() {
  const queue = store.get().session.launchQueue || [];
  if (!queue.length) return;
  store.set("session", { launchQueue: [] });
  const open = store.get().windows.byId;
  for (const id of queue) {
    if (appMode(id) === "layer") {
      if (store.get().ui.layer !== id) toggleLayer(id);
    } else if (!open[id]) {
      openWindow(id);
    }
  }
}

export function enterDesktop() {
  store.set("session", { screen: "desktop", lockMode: false });
  clearWindows();
  openWindow("home");
  openWindow("files");
  drainLaunchQueue();
  toast("Session started — " + store.get().session.sessionType);
}

export function finishUnlock() {
  store.set("session", { screen: "desktop", lockMode: false });
  drainLaunchQueue();
}

export function lockScreen() {
  store.set("session", { screen: "login", lockMode: true });
}

export function logOut() {
  store.set("session", { screen: "login", lockMode: false, user: "noctivagous", launchQueue: [] });
}
