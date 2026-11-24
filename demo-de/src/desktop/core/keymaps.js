/* NCT-WL-COMPOSITOR — the reserved operators are compositor input policy; the overridable slots are an opt-in vocabulary a foreign app simply never joins. See WAYLAND-MAP.md. */
/* Keymap layering for key-clicks.
 *
 * Two contexts decide what a key press means:
 *
 *   GLOBAL — the shell's own operators, active everywhere.
 *   APP    — the keymap of the app whose window is under the
 *            cursor. The hovered rectangle is the context: a
 *            press belongs to the app it hovers, not the app
 *            that happens to hold focus.
 *
 * Physical key slots split in two:
 *
 *   RESERVED — the system's operators. Apps cannot override
 *   them. F above all: F is the system left-click, inside apps
 *   and outside them, on the default layout and on every app
 *   layout. Also A (close), G (hide/show), O (ports), P (flip),
 *   E / R / T / H (window ops), 0 (style cycling), \ (configure), 9 (freeze),
 *   Tab, Space, Esc, Alt+K, Alt+L.
 *
 *   OVERRIDABLE — slots an app may bind for its own windows
 *   (D today). Inside that app's windows the binding consumes
 *   the press; everywhere else the slot keeps its global
 *   meaning (D is "back" in the shell's own ladder).
 *
 * Apps bind slots to GENERIC ACTIONS from the system's
 * vocabulary (HISTORY_BACK, HISTORY_FORWARD, DELETE, …). The
 * system supplies the vocabulary and the dispatch — an
 * `nct:key` window event {app, key, action} — and the app
 * supplies the meaning, in its own context. An app with no
 * binding for a slot simply gets the global behaviour.
 */

export const RESERVED_KEYS = [
  "f", "a", "g", "o", "p", "e", "r", "t", "h", "0", "\\", "9",
  "tab", " ", "escape",
];

/* appId -> { slot: GENERIC_ACTION } */
export const APP_KEYMAPS = {
  browser: { d: "HISTORY_BACK" },
};

export const OVERRIDABLE_KEYS = new Set(
  Object.values(APP_KEYMAPS).flatMap((m) => Object.keys(m)),
);

export function appActionFor(appId, key) {
  const m = APP_KEYMAPS[appId];
  return m ? m[key] || null : null;
}

/* Subscribe to one generic action delivered to one app.
 * Returns the unsubscribe function. */
export function onAppAction(appId, action, fn) {
  const h = (e) => {
    const d = e.detail || {};
    if (d.app === appId && d.action === action) fn(d);
  };
  window.addEventListener("nct:key", h);
  return () => window.removeEventListener("nct:key", h);
}
