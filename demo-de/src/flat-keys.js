/**
 * flat-keys.js — the 2D view's key-click core, as pure functions.
 *
 * Three things live here, all data or pure logic so they can be tested
 * in node and shared by the view (chips, keyboard panel) and the app
 * (key handling) — the two can never drift:
 *
 *  1. ADDRESSING. Every targetable thing wears a label from an alphabet
 *     that skips D and F — the operators are not addresses (the house
 *     rule of every demo-de page). Labels run spreadsheet-style past
 *     the single letters.
 *
 *  2. THE BUFFER RESOLVER. Typed letters accumulate in a buffer; the
 *     resolver says whether the buffer is an exact label (match), a
 *     live prefix of a longer label (pending), or a dead end. The app
 *     owns the timer, and clears it on EVERY exit from the buffer —
 *     match, dead end, operator, Esc — so a stale timer can never
 *     override a newer target (the shell-keyfix discipline).
 *
 *  3. THE SPARSE KEY DATABASE. The keyboard board is fixed data (rows
 *     of real KeyboardEvent codes). Bindings are stored SPARSELY, per
 *     scope: only the minority of caps that do something in a scope
 *     carry an entry; every other cap resolves to null and renders as a
 *     bare dim glyph. This is Floating Marker's sparse database lookup
 *     as NibGlider's key registry and UI Space's keyboard panel realise
 *     it: store the board once, store bindings sparsely, resolve at
 *     press time and at render time from the same tables.
 */

export const LABEL_ALPHABET = "ABCEGHIJKLMNOPQRSTUVWXYZ"; // no D, no F

export function labelForIndex(i) {
  const A = LABEL_ALPHABET;
  if (i < A.length) return A[i];
  const j = i - A.length;
  return A[Math.floor(j / A.length)] + A[j % A.length];
}

/** Pair each item with its label, in the order given. */
export function assignLabels(items) {
  return items.map((item, i) => ({ item, label: labelForIndex(i) }));
}

/**
 * Resolve a typed buffer against the live label set.
 * Returns { kind: "match", label } | { kind: "pending" } | { kind: "dead" }.
 * A buffer that is an exact label AND a prefix of a longer label stays
 * pending — the longer address may still be coming.
 */
export function resolveBuffer(buffer, labels) {
  if (!buffer) return { kind: "dead" };
  const set = new Set(labels);
  const isPrefix = labels.some((l) => l.length > buffer.length && l.startsWith(buffer));
  if (set.has(buffer) && !isPrefix) return { kind: "match", label: buffer };
  if (isPrefix || set.has(buffer)) return { kind: "pending" };
  return { kind: "dead" };
}

/** True for a key that could be part of a label (a letter in the alphabet). */
export function isLabelKey(key) {
  return typeof key === "string" && key.length === 1 && LABEL_ALPHABET.includes(key.toUpperCase());
}

/**
 * Text-entry guard, mirroring NCTGraphiteStageFocus.isTextEntryControl:
 * only genuinely text-entering controls keep their keys. Sliders,
 * checkboxes and selects do NOT swallow key-clicks (the demo-de
 * slider-focus lesson, AGENTS.md).
 */
export function isTextEntryControl(tagName, type = "", contentEditable = false) {
  const tag = String(tagName || "").toLowerCase();
  if (contentEditable) return true;
  if (tag === "textarea") return true;
  if (tag === "input") {
    const t = (type || "text").toLowerCase();
    return ["text", "search", "password", "email", "url", "number"].includes(t);
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* The board: fixed data. w = width in cap units (for the panel).      */
/* ------------------------------------------------------------------ */

const cap = (code, glyph, w = 1) => ({ code, glyph, w });

export const BOARD_ROWS = [
  [
    cap("Backquote", "`"), cap("Digit1", "1"), cap("Digit2", "2"), cap("Digit3", "3"),
    cap("Digit4", "4"), cap("Digit5", "5"), cap("Digit6", "6"), cap("Digit7", "7"),
    cap("Digit8", "8"), cap("Digit9", "9"), cap("Digit0", "0"), cap("Minus", "-"),
    cap("Equal", "="), cap("Backspace", "⌫", 2),
  ],
  [
    cap("Tab", "Tab", 1.5), cap("KeyQ", "Q"), cap("KeyW", "W"), cap("KeyE", "E"),
    cap("KeyR", "R"), cap("KeyT", "T"), cap("KeyY", "Y"), cap("KeyU", "U"),
    cap("KeyI", "I"), cap("KeyO", "O"), cap("KeyP", "P"), cap("BracketLeft", "["),
    cap("BracketRight", "]"), cap("Backslash", "\\", 1.5),
  ],
  [
    cap("CapsLock", "Caps", 1.75), cap("KeyA", "A"), cap("KeyS", "S"), cap("KeyD", "D"),
    cap("KeyF", "F"), cap("KeyG", "G"), cap("KeyH", "H"), cap("KeyJ", "J"),
    cap("KeyK", "K"), cap("KeyL", "L"), cap("Semicolon", ";"), cap("Quote", "'"),
    cap("Enter", "Enter", 2.25),
  ],
  [
    cap("ShiftLeft", "Shift", 2.25), cap("KeyZ", "Z"), cap("KeyX", "X"), cap("KeyC", "C"),
    cap("KeyV", "V"), cap("KeyB", "B"), cap("KeyN", "N"), cap("KeyM", "M"),
    cap("Comma", ","), cap("Period", "."), cap("Slash", "/"), cap("ShiftRight", "Shift", 2.75),
  ],
  [
    cap("ControlLeft", "Ctrl", 1.25), cap("AltLeft", "Alt", 1.25),
    cap("Space", "Space", 6.25), cap("AltRight", "Alt", 1.25), cap("ControlRight", "Ctrl", 1.25),
    cap("Escape", "Esc", 1.5),
  ],
];

/* ------------------------------------------------------------------ */
/* Sparse bindings per scope. Only bound caps appear. Scopes layer:    */
/* "shell" is always active; the active frame's scope adds its own.    */
/* A binding: { name, desc } — name is what the cap reads in the       */
/* panel; desc goes to the footer/inspector.                           */
/* ------------------------------------------------------------------ */

const b = (name, desc) => ({ name, desc });

export const KEY_BINDINGS = {
  shell: {
    KeyF: b("CLICK", "Click the targeted or hovered thing"),
    KeyD: b("BACK", "Go back within the frame's own scope"),
    Escape: b("RELEASE", "Release: leave the frame, clear the target"),
    Tab: b("NEXT", "Target the next addressable thing"),
    Enter: b("OPEN", "Open the targeted thing (same as F)"),
    KeyK: b("KEYS · Alt+K", "Toggle the keyboard panel (Alt+K, as in KeyPilot)"),
    Slash: b("SEARCH", "Search / command line"),
  },
  home: {
    Space: b("DRAG LOCK", "Pick up the targeted card; Space again to drop, Esc cancels"),
  },
  files: {
    Enter: b("OPEN", "Open the targeted node (same as F on a branch)"),
  },
  monitor: {
    Space: b("HOLD", "Halt / resume time"),
    Digit1: b("LANE 1", "Focus lane 1"), Digit2: b("LANE 2", "Focus lane 2"),
    Digit3: b("LANE 3", "Focus lane 3"), Digit4: b("LANE 4", "Focus lane 4"),
    Digit5: b("LANE 5", "Focus lane 5"), Digit6: b("LANE 6", "Focus lane 6"),
    Digit7: b("LANE 7", "Focus lane 7"), Digit8: b("LANE 8", "Focus lane 8"),
  },
  sunburst: {
    Enter: b("DESCEND", "Descend into the targeted wedge (same as F on a branch)"),
  },
  mail: {
    Enter: b("OPEN", "Open the targeted message"),
  },
  text: {
    Escape: b("EXIT TEXT", "Leave text mode; keys become clicks again"),
  },
};

/**
 * Resolve the whole board for a scope stack (e.g. ["shell", "monitor"]).
 * Returns rows of caps, each { code, glyph, w, binding|null }.
 * Later scopes win on conflict. Unbound caps get binding: null — the
 * sparse lookup: most caps, most of the time, are bare glyphs.
 */
export function resolveBoard(scopes) {
  const merged = {};
  for (const scope of scopes) Object.assign(merged, KEY_BINDINGS[scope] || {});
  return BOARD_ROWS.map((row) =>
    row.map((c) => ({ ...c, binding: merged[c.code] || null })),
  );
}

/** The binding for one KeyboardEvent.code in a scope stack, or null. */
export function bindingFor(code, scopes) {
  let found = null;
  for (const scope of scopes) {
    const table = KEY_BINDINGS[scope];
    if (table && table[code]) found = table[code];
  }
  return found;
}
