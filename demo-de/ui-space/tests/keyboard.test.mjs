import test from "node:test";
import assert from "node:assert/strict";

import {
  KEYBOARD_ROWS,
  KEYBOARD_CAP_COUNT,
  resolveKeyboard,
  lastKeyEcho,
} from "../src/keyboard.js";
import {
  TRANSFORM_KEYS,
  LAYOUT_KEYS,
  LAYOUTS,
  labeledObjects,
  labeledRingItems,
  objectById,
} from "../src/space-state.js";

const capOf = (resolved, code) => resolved.caps.find((c) => c.code === code);
const labelOf = (resolved, code) => capOf(resolved, code)?.binding?.label ?? null;

/** e.key punctuation → code, mirroring the module's derivation map. */
const CHAR_TO_CODE = {
  "-": "Minus", "=": "Equal", "[": "BracketLeft", "]": "BracketRight",
  ";": "Semicolon", "'": "Quote", ".": "Period", "/": "Slash",
};

test("the grid covers every code the scheme needs", () => {
  const codes = new Set(KEYBOARD_ROWS.flat().map((c) => c.code));
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    assert.ok(codes.has(`Key${ch}`), `missing Key${ch}`);
  }
  for (const d of ["1", "2", "3", "4", "5"]) {
    assert.ok(codes.has(`Digit${d}`), `missing Digit${d}`);
  }
  for (const ch of Object.keys(TRANSFORM_KEYS)) {
    assert.ok(codes.has(CHAR_TO_CODE[ch]), `missing code for transform key ${ch}`);
  }
  for (const code of ["Space", "Tab", "Escape", "Enter"]) {
    assert.ok(codes.has(code), `missing ${code}`);
  }
  assert.equal(KEYBOARD_CAP_COUNT, 53);
  // Every row is the same total width, so the board is a rectangle.
  for (const row of KEYBOARD_ROWS) {
    const w = row.reduce((n, c) => n + c.width, 0);
    assert.ok(Math.abs(w - 13.5) < 1e-9, `row width ${w}`);
  }
});

test("the database is sparse: in space scope fewer than half the caps are bound", () => {
  const kb = resolveKeyboard({ scope: "space" });
  const bound = kb.caps.filter((c) => c.binding).length;
  assert.ok(bound < kb.caps.length / 2, `${bound} of ${kb.caps.length} bound`);
  // And the unbound majority really does include ordinary letters:
  assert.equal(labelOf(kb, "KeyQ"), null);
  assert.equal(labelOf(kb, "KeyA"), null);
  assert.equal(labelOf(kb, "Digit7"), null);
});

test("the transform and layout caps are derived from the real tables", () => {
  const kb = resolveKeyboard({ scope: "space" });
  for (const [ch, opName] of Object.entries(TRANSFORM_KEYS)) {
    const expected = `${opName.slice(0, -1).toUpperCase()} ${opName.slice(-1) === "+" ? "+" : "-"}`;
    assert.equal(labelOf(kb, CHAR_TO_CODE[ch]), expected, `transform cap for ${ch}`);
  }
  for (const [digit, name] of Object.entries(LAYOUT_KEYS)) {
    assert.equal(labelOf(kb, `Digit${digit}`), LAYOUTS[name].name);
  }
  assert.equal(labelOf(kb, "Digit3"), "RING");
  assert.equal(labelOf(kb, "Digit4"), "DISTRICTS");
  assert.equal(labelOf(kb, "Digit5"), "THEATRE");
});

test("space scope: the operators read as the handler works them", () => {
  const kb = resolveKeyboard({ scope: "space" });
  assert.equal(labelOf(kb, "KeyF"), "OPEN");
  assert.equal(labelOf(kb, "KeyD"), "BACK");
  assert.equal(labelOf(kb, "KeyG"), "PATCH");
  assert.equal(labelOf(kb, "KeyM"), "LIBRARY");
  assert.equal(labelOf(kb, "KeyC"), "COPY");
  assert.equal(labelOf(kb, "KeyI"), "INSPECT");
  assert.equal(labelOf(kb, "KeyX"), "STRIP CABLES");
  assert.equal(labelOf(kb, "Escape"), "RELEASE");
  assert.equal(labelOf(kb, "Enter"), "COMMAND LINE");
  assert.equal(labelOf(kb, "Digit1"), "ZOOM OUT");
  assert.equal(labelOf(kb, "Digit2"), "ZOOM IN");
});

test("dynamic labels: G with a patch live, Space under the drag lock", () => {
  const pending = resolveKeyboard({ scope: "space", pending: true });
  assert.equal(labelOf(pending, "KeyG"), "COMPLETE PATCH");
  assert.equal(labelOf(pending, "KeyF"), "COMPLETE PATCH");

  const locked = resolveKeyboard({ scope: "space", dragLocked: true });
  assert.equal(labelOf(locked, "Space"), "DROP");
  assert.equal(labelOf(locked, "Escape"), "CANCEL DRAG");
  assert.equal(labelOf(locked, "KeyX"), "AXIS X");
  assert.equal(labelOf(locked, "KeyZ"), "AXIS Z");
  // The locked branch swallows everything else — the board says so.
  assert.equal(labelOf(locked, "KeyF"), null);
  assert.equal(labelOf(locked, "Digit1"), null);
  assert.equal(labelOf(locked, "KeyM"), null);
});

test("K resolves in space scope to the keyboard toggle binding", () => {
  const kb = resolveKeyboard({ scope: "space" });
  assert.equal(labelOf(kb, "KeyK"), "KEYBOARD");
});

test("label scope: letters name their actual targets", () => {
  const kb = resolveKeyboard({ scope: "labels" });
  const cube = labeledObjects().find(({ object }) => object.id === "cube");
  assert.equal(labelOf(kb, `Key${cube.label}`), objectById("cube").name.toUpperCase());
  assert.ok(labelOf(kb, `Key${cube.label}`).includes("CUBE"));
  // Every citizen is named on its own letter.
  for (const { object, label } of labeledObjects()) {
    assert.equal(labelOf(kb, `Key${label}`), object.name.toUpperCase(), `citizen ${object.id}`);
  }
  // The ring's item continues the sequence.
  const ring = labeledRingItems()[0];
  assert.equal(labelOf(kb, `Key${ring.label}`), "WAVEFORM");
  // Cards resolve only when the App passes their labels in (library open).
  const withCards = resolveKeyboard({
    scope: "labels",
    cardLabels: [{ label: "P", title: "Neon Dunes at Dusk", id: "media-1" }],
  });
  assert.ok(labelOf(withCards, "KeyP").includes("NEON DUNES"));
  assert.equal(labelOf(kb, "KeyP"), null);
});

test("label scope: D, F and X stay operators, not addresses", () => {
  const kb = resolveKeyboard({ scope: "labels" });
  assert.equal(labelOf(kb, "KeyD"), "BACK");
  assert.equal(capOf(kb, "KeyD").binding.operator, true);
  assert.equal(labelOf(kb, "KeyF"), "OPEN");
  assert.equal(capOf(kb, "KeyF").binding.operator, true);
  assert.equal(labelOf(kb, "KeyX"), "STRIP CABLES");
  // No citizen or card can ever hold those letters as a target:
  for (const code of ["KeyD", "KeyF", "KeyX"]) {
    assert.equal(capOf(kb, code).binding.target, undefined);
  }
  assert.equal(labelOf(kb, "Escape"), "EXIT LABELS");
});

test("command scope: the line's frame — categories derived, walk-back, run", () => {
  const kb = resolveKeyboard({ scope: "command" });
  assert.equal(kb.scopeName, "COMMAND LINE");
  assert.equal(labelOf(kb, "KeyO"), "OBJECT");
  assert.equal(labelOf(kb, "KeyP"), "PATCH");
  assert.equal(labelOf(kb, "KeyL"), "LAYOUT");
  assert.equal(labelOf(kb, "KeyV"), "VIEW");
  assert.equal(labelOf(kb, "KeyS"), "SYSTEM");
  assert.equal(labelOf(kb, "Escape"), "WALK BACK");
  assert.equal(labelOf(kb, "Enter"), "RUN");
  // A letter that is no category and no line key stays bare.
  assert.equal(labelOf(kb, "KeyF"), null);
  assert.equal(labelOf(kb, "Digit1"), null);
});

test("app scope: the Waveform app's keys, and its dynamic transport", () => {
  const paused = resolveKeyboard({ scope: "app", playing: false, appMode: "center" });
  assert.equal(paused.scopeName, "WAVEFORM APP");
  assert.equal(labelOf(paused, "Space"), "PLAY");
  assert.equal(labelOf(paused, "KeyD"), "APP BACK");
  assert.equal(labelOf(paused, "Escape"), "LEAVE APP");
  assert.equal(labelOf(paused, "Digit1"), "WINDOW OUT");
  assert.equal(labelOf(paused, "Digit2"), "WINDOW IN");
  assert.equal(labelOf(paused, "KeyE"), "FULL PLATTER");
  // The space's manipulation keys suspend inside the app.
  assert.equal(labelOf(paused, "KeyG"), null);
  assert.equal(labelOf(paused, "KeyM"), null);
  assert.equal(labelOf(paused, "Minus"), null);

  const playing = resolveKeyboard({ scope: "app", playing: true, appMode: "center" });
  assert.equal(labelOf(playing, "Space"), "PAUSE");

  // Already full: E does nothing, and the cap goes bare.
  const full = resolveKeyboard({ scope: "app", playing: false, appMode: "full" });
  assert.equal(labelOf(full, "KeyE"), null);
});

test("combos: the Alt strip is the same in every scope", () => {
  // The handler checks the Alt chords before every scope branch —
  // the command line's and the open app's included — so Alt+1/2/3
  // layer toggles are NOT suspended in app scope, and the strip
  // never changes.
  for (const scope of ["space", "labels", "command", "app"]) {
    const kb = resolveKeyboard({ scope });
    const keys = kb.combos.map((c) => c.keys);
    assert.deepEqual(keys, ["Alt+L", "Alt+0", "Alt+1", "Alt+2", "Alt+3"], scope);
    assert.equal(kb.combos.find((c) => c.keys === "Alt+L").label, "LABELS");
    assert.equal(kb.combos.find((c) => c.keys === "Alt+0").label, "CLIPBOARD");
    // Alt itself binds nothing: its caps stay bare in every scope.
    assert.equal(labelOf(kb, "AltLeft"), null, scope);
    assert.equal(labelOf(kb, "AltRight"), null, scope);
  }
});

test("active marks exactly ctx.lastKey's cap; the echo reads the resolution", () => {
  const kb = resolveKeyboard({ scope: "space", lastKey: "KeyF" });
  const actives = kb.caps.filter((c) => c.active);
  assert.equal(actives.length, 1);
  assert.equal(actives[0].code, "KeyF");
  assert.equal(lastKeyEcho(kb, "KeyF"), "F — OPEN");
  assert.equal(lastKeyEcho(kb, "KeyQ"), "Q —");
  assert.equal(lastKeyEcho(kb, null), "");
  const none = resolveKeyboard({ scope: "space" });
  assert.equal(none.caps.some((c) => c.active), false);
});

test("an unknown scope falls back to the space scope", () => {
  const kb = resolveKeyboard({ scope: "bogus" });
  assert.equal(kb.scope, "space");
  assert.equal(kb.scopeName, "SPACE");
});
