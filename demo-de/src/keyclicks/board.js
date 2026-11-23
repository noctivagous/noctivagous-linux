/* Key-clicks · board — the onscreen keyboard's data.
 *
 * The board is KeyPilot's shape: a full QWERTY board, collapsed to
 * an edge tab, whose caps are SPARSELY bound — in each scope only
 * the keys that do something are named (in green); the rest stay
 * bare glyphs that press to nothing in key-click mode, and type
 * their glyph in text mode. Bindings are resolved at render from
 * the live scope, never stored per-element.
 *
 * Scope comes from the focused window's data-app id (identity, not
 * title text — see KEYCLICKS-AUDIT.md finding 4).
 *
 * Cap spec format: "Code:Glyph" or "Code:Glyph:FlexGrow".
 */

export const BOARD_ROWS = [
  ["Backquote:`", "Digit1:1", "Digit2:2", "Digit3:3", "Digit4:4", "Digit5:5", "Digit6:6", "Digit7:7", "Digit8:8", "Digit9:9", "Digit0:0", "Minus:-", "Equal:=", "Backspace:⌫:1.5"],
  ["Tab:⇥:1.5", "KeyQ:Q", "KeyW:W", "KeyE:E", "KeyR:R", "KeyT:T", "KeyY:Y", "KeyU:U", "KeyI:I", "KeyO:O", "KeyP:P", "BracketLeft:[", "BracketRight:]", "Backslash:\\:1.5"],
  ["CapsLock:CAPS:1.75", "KeyA:A", "KeyS:S", "KeyD:D", "KeyF:F", "KeyG:G", "KeyH:H", "KeyJ:J", "KeyK:K", "KeyL:L", "Semicolon:;", "Quote:'", "Enter:⏎:2.25"],
  ["ShiftLeft:⇧:2.25", "KeyZ:Z", "KeyX:X", "KeyC:C", "KeyV:V", "KeyB:B", "KeyN:N", "KeyM:M", "Comma:,", "Period:.", "Slash:/", "ShiftRight:⇧:2.75"],
  ["Space:SPACE:6", "AltLeft:ALT", "AltRight:ALT", "ArrowLeft:←", "ArrowUp:↑", "ArrowDown:↓", "ArrowRight:→"],
];

export function keyForCap(code, glyph) {
  if (/^Key/.test(code)) return glyph.toLowerCase();
  if (/^Digit/.test(code)) return glyph;
  const map = {
    Backspace: "Backspace", Tab: "Tab", Enter: "Enter", CapsLock: "CapsLock",
    ShiftLeft: "Shift", ShiftRight: "Shift", Space: " ", AltLeft: "Alt",
    AltRight: "Alt", ArrowLeft: "ArrowLeft", ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown", ArrowRight: "ArrowRight", Minus: "-",
    Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
    Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/",
    Backquote: "`",
  };
  return map[code] || glyph;
}

/** Window app id → board scope. Anything else is the shell scope. */
export const SCOPE_FOR_APP = {
  files: "files",
  terminal: "terminal",
  settings: "settings",
  notes: "notes",
};

const BINDINGS = {
  shell: {
    KeyF: "CLICK", KeyD: "BACK", Tab: "TARGET", Space: "DRAG·LOCK",
    Enter: "OPEN", Slash: "LAUNCH", Escape: "UNWIND",
    AltLeft: "ALT+", KeyL: "LABELS", KeyK: "BOARD",
    ArrowUp: "SCROLL ↑", ArrowDown: "SCROLL ↓",
    ArrowLeft: "STEP ◀", ArrowRight: "STEP ▶",
  },
  files: { KeyN: "NEW FILE", Enter: "OPEN" },
  terminal: { Enter: "RUN", ArrowUp: "HIST ▲", ArrowDown: "HIST ▼", KeyL: "—" },
  settings: { ArrowLeft: "VALUE −", ArrowRight: "VALUE +" },
  notes: {},
};

export function bindingFor(scope, code, altDown) {
  if (altDown) {
    if (code === "KeyK") return "BOARD";
    if (code === "KeyL") return "LABELS";
    return "";
  }
  return (BINDINGS[scope] && BINDINGS[scope][code]) || BINDINGS.shell[code] || "";
}
