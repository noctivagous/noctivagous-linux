/* Session transitions — the shell's answers to the bus signals
 * (lock / logout / shutdown) and to a completed login. Kept out of
 * the components so Login, Desktop and the launcher all drive the
 * same transitions. */

import { store } from "../core/store.js";
import { clearWindows, openWindow } from "../core/windows.js";
import { toast } from "../core/bus.js";

export function enterDesktop() {
  store.set("session", { screen: "desktop", lockMode: false });
  clearWindows();
  openWindow("home");
  openWindow("files");
  toast("Session started — " + store.get().session.sessionType);
}

export function finishUnlock() {
  store.set("session", { screen: "desktop", lockMode: false });
}

export function lockScreen() {
  store.set("session", { screen: "login", lockMode: true });
}

export function logOut() {
  store.set("session", { screen: "login", lockMode: false, user: "noctivagous" });
}
