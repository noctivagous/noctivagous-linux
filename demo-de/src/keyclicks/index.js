/* Key-clicks — composition.
 *
 * startKeyClicks() is the subsystem's one entry point, called once
 * by the shell. It is idempotent (a remount must not duplicate the
 * HUD) and wires the engine's mode hook to the app bus, so the
 * rest of the system can observe key-click modes (kc:mode) without
 * depending on the engine.
 */

import { createKeyClicks } from "./engine.js";
import { bus } from "../desktop/core/bus.js";

let started = false;

export function startKeyClicks() {
  if (started || document.getElementById("kcRoot")) return;
  started = true;
  createKeyClicks({
    onMode: (mode) => bus.emit("kc:mode", mode),
  });
}
