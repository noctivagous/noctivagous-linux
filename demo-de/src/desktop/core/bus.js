/* The signal bus — events, not state.
 *
 * Signals are fire-and-forget: toast, openApp, lock, logout,
 * shutdown, showDesktop. Anything may raise one; the shell handles
 * the session-level ones. If a value must persist or be read later
 * it belongs in the store (core/store.js), never on the bus.
 */

const handlers = new Map();

export const bus = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => handlers.get(event).delete(fn);
  },
  emit(event, payload) {
    const set = handlers.get(event);
    if (set) set.forEach((fn) => fn(payload));
  },
};

export const toast = (msg) => bus.emit("toast", msg);
export const openApp = (id) => bus.emit("openApp", id);
