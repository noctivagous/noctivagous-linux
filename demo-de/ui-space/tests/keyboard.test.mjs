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
  transformOpOf,
  LAYOUT_KEYS,
  LAYOUTS,
  labeledObjects,
  labeledRingItems,
  objectById,
} from "../src/space-state.js";

const capOf = (resolved, code) => resolved.caps.find((c) => c.code === code);
const labelOf = (resolved, code) => capOf(resolved, code)?.binding?.label ?? null;

/** e.key → KeyboardEvent.code, mirroring the module's derivation. */
const codeForChar = (ch) =>
  /^[a-z]$/.test(ch) ? `Key${ch.toUpperCase()}` : {
    "-": "Minus", "=": "Equal", "[": "BracketLeft", "]": "BracketRight",
    ";": "Semicolon", "'": "Quote", ".": "Period", "/": "Slash",
  }[ch];

test("the grid covers every code the scheme needs", () => {
  const codes = new Set(KEYBOARD_ROWS.flat().map((c) => c.code));
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    assert.ok(codes.has(`Key${ch}`), `missing Key${ch}`);
  }
  for (const d of ["1", "2", "3", "4", "5"]) {
    assert.ok(codes.has(`Digit${d}`), `missing Digit${d}`);
  }
  for (const ch of Object.keys(TRANSFORM_KEYS)) {
    assert.ok(codes.has(codeForChar(ch)), `missing code for transform key ${ch}`);
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

test("the database is sparse: a binding exists only where a scope binds the key", () => {
  // The command scope binds fewer than half the caps.
  const cmd = resolveKeyboard({ scope: "command" });
  const cmdBound = cmd.caps.filter((c) => c.binding).length;
  assert.ok(cmdBound < cmd.caps.length / 2, `${cmdBound} of ${cmd.caps.length} bound`);
  // In space scope the slice-11 letter cluster binds many caps —
  // but the unbound remainder still stands bare: ordinary letters
  // with no operator, digit 0, and the punctuation row — except
  // [ and ], which slice 13-3 bound to the platter's plane spin
  // (asserted in slice-13-3.test.mjs).
  const kb = resolveKeyboard({ scope: "space" });
  assert.equal(labelOf(kb, "KeyU"), null);
  assert.equal(labelOf(kb, "KeyP"), null);
  assert.equal(labelOf(kb, "KeyO"), null);
  assert.equal(labelOf(kb, "Digit0"), null);
  assert.equal(labelOf(kb, "Minus"), null);
  assert.equal(labelOf(kb, "Equal"), null);
  assert.equal(labelOf(kb, "Semicolon"), null);
  assert.equal(labelOf(kb, "Period"), null);
  assert.equal(labelOf(kb, "Slash"), null);
});

test("the transform and layout caps are derived from the real tables", () => {
  const kb = resolveKeyboard({ scope: "space" });
  for (const ch of Object.keys(TRANSFORM_KEYS)) {
    const opName = transformOpOf(ch);
    const axis = opName.slice(0, -1);
    const sign = opName.slice(-1) === "+" ? "+" : "-";
    // §16: the scale axis reads as the operation's name, MAGNIFY.
    const expected = axis === "spin" ? `ROTATE PLANE ${sign}`
      : axis === "scale" ? `MAGNIFY ${sign}`
      : `${axis.toUpperCase()} ${sign}`;
    assert.equal(labelOf(kb, codeForChar(ch)), expected, `transform cap for ${ch}`);
  }
  for (const [digit, name] of Object.entries(LAYOUT_KEYS)) {
    assert.equal(labelOf(kb, `Digit${digit}`), `OBJECT LAYOUT · ${LAYOUTS[name].name}`);
  }
  // §13+§14: the layout caps present as OBJECT layouts on 7/8/9,
  // never as camera keys.
  assert.equal(labelOf(kb, "Digit7"), "OBJECT LAYOUT · RING");
  assert.equal(labelOf(kb, "Digit8"), "OBJECT LAYOUT · DISTRICTS");
  assert.equal(labelOf(kb, "Digit9"), "OBJECT LAYOUT · THEATRE");
});

test("space scope: the operators read as the handler works them", () => {
  const kb = resolveKeyboard({ scope: "space" });
  assert.equal(labelOf(kb, "KeyF"), "OPEN");
  assert.equal(labelOf(kb, "KeyG"), "PATCH");
  assert.equal(labelOf(kb, "KeyM"), "LIBRARY");
  assert.equal(labelOf(kb, "KeyI"), "INSPECT");
  assert.equal(labelOf(kb, "KeyK"), "KEYBOARD");
  assert.equal(labelOf(kb, "Enter"), "COMMAND LINE");
  // Slice 11: the dolly on C/V (§14's name for it), strip on J.
  assert.equal(labelOf(kb, "KeyC"), "DOLLY OUT");
  assert.equal(labelOf(kb, "KeyV"), "DOLLY IN");
  // Slice 13-4 (item B): copy moved H → L, and H is RESET now —
  // the caps say both.
  assert.equal(labelOf(kb, "KeyL"), "COPY");
  assert.equal(labelOf(kb, "KeyH"), "RESET");
  assert.equal(labelOf(kb, "KeyJ"), "STRIP CABLES");
  // §16: Z/X carry the MAGNIFY name.
  assert.equal(labelOf(kb, "KeyZ"), "MAGNIFY -");
  assert.equal(labelOf(kb, "KeyX"), "MAGNIFY +");
  // Slice 11: the event caps are named by their events.
  assert.equal(labelOf(kb, "KeyA"), "FINISH");
  assert.equal(labelOf(kb, "KeyS"), "GO BACK I");
  assert.equal(labelOf(kb, "KeyD"), "GO BACK II");
  assert.equal(labelOf(kb, "Escape"), "CANCEL");
  // Slice 11 (§11): plane-rotate on B/N.
  assert.equal(labelOf(kb, "KeyB"), "ROTATE PLANE -");
  assert.equal(labelOf(kb, "KeyN"), "ROTATE PLANE +");
});

test("space scope: E's cap and the rotate caps follow the resolved target", () => {
  // Nothing addressed: the platter fallback — the cluster reads
  // in camera terms (§12), B/N in plane terms, scale declined.
  const rest = resolveKeyboard({ scope: "space", rotateTarget: "platter" });
  assert.equal(labelOf(rest, "KeyE"), "ROTATE PLATTER · CAMERA");
  assert.equal(labelOf(rest, "KeyR"), "ROTATE PLATTER · CAMERA");
  assert.equal(labelOf(rest, "KeyQ"), "ROTATE PLATTER · CAMERA");
  assert.equal(labelOf(rest, "KeyB"), "PLANE · PLATTER");
  assert.equal(labelOf(rest, "KeyZ"), "NO MAGNIFY · PLATTER");
  assert.equal(labelOf(rest, "KeyX"), "NO MAGNIFY · PLATTER");
  // A citizen addressed: plain axis labels. Slice 13-4 (item
  // E) swapped the yaw pair — E is YAW +, R is YAW − now (the
  // caps derive from TRANSFORM_KEYS, so they follow the swap).
  const citizen = resolveKeyboard({ scope: "space", rotateTarget: "citizen", eKey: "yaw+" });
  assert.equal(labelOf(citizen, "KeyE"), "YAW +");
  assert.equal(labelOf(citizen, "KeyR"), "YAW -");
  assert.equal(labelOf(citizen, "KeyQ"), "PITCH -");
  assert.equal(labelOf(citizen, "KeyB"), "ROTATE PLANE -");
  // The ring addressed: yaw and plane spin it; pitch/roll say so.
  const ring = resolveKeyboard({ scope: "space", rotateTarget: "ring" });
  assert.equal(labelOf(ring, "KeyR"), "SPIN RING");
  assert.equal(labelOf(ring, "KeyB"), "PLANE · RING");
  assert.equal(labelOf(ring, "KeyQ"), "SPIN ONLY");
  // The ring ITEM addressed: E would expand, and its cap says so.
  const item = resolveKeyboard({ scope: "space", rotateTarget: "ring", eKey: "expand" });
  assert.equal(labelOf(item, "KeyE"), "FULL PLATTER");
});

test("the number row (§14/§15): views, field sizes, object layouts", () => {
  const kb = resolveKeyboard({ scope: "space", fieldName: "MEDIUM CLOSE" });
  // 1–4: the named views in the VIEW fieldset's order.
  assert.equal(labelOf(kb, "Digit1"), "PLAN");
  assert.equal(labelOf(kb, "Digit2"), "ELEVATION");
  assert.equal(labelOf(kb, "Digit3"), "SIDE");
  assert.equal(labelOf(kb, "Digit4"), "HOME");
  // 5/6: the focal zoom — FIELD − / +, current field in the hint.
  assert.equal(labelOf(kb, "Digit5"), "FIELD -");
  assert.equal(labelOf(kb, "Digit6"), "FIELD +");
  assert.ok(capOf(kb, "Digit5").binding.hint.includes("MEDIUM CLOSE"));
  assert.ok(capOf(kb, "Digit6").binding.hint.includes("MEDIUM CLOSE"));
  // 7–9: the object layouts. 0 stays bare.
  assert.equal(labelOf(kb, "Digit7"), "OBJECT LAYOUT · RING");
  assert.equal(labelOf(kb, "Digit9"), "OBJECT LAYOUT · THEATRE");
  assert.equal(labelOf(kb, "Digit0"), null);
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
  assert.equal(labelOf(locked, "KeyC"), null);
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
    cardLabels: [{ label: "T", title: "Neon Dunes at Dusk", id: "media-1" }],
  });
  assert.ok(labelOf(withCards, "KeyT").includes("NEON DUNES"));
  assert.equal(labelOf(kb, "KeyT"), null);
});

test("label scope: the slice-11 operator letters are addresses here", () => {
  const kb = resolveKeyboard({ scope: "labels" });
  // B is the drum, N the tree, J the arch, C the tray, A the mesa,
  // H the horizon skyline — operators outside label mode only.
  assert.equal(labelOf(kb, "KeyB"), objectById("drum").name.toUpperCase());
  assert.equal(labelOf(kb, "KeyN"), objectById("tree").name.toUpperCase());
  assert.equal(labelOf(kb, "KeyJ"), objectById("arch").name.toUpperCase());
  assert.equal(labelOf(kb, "KeyC"), objectById("tray").name.toUpperCase());
  assert.equal(labelOf(kb, "KeyA"), objectById("mesa").name.toUpperCase());
  assert.equal(labelOf(kb, "KeyH"), objectById("horizon3d").name.toUpperCase());
  // X is no longer an operator at all: with no card holding it, bare.
  assert.equal(labelOf(kb, "KeyX"), null);
  // Digits are not addresses: the number row keeps its camera /
  // room meanings in label mode too (§14), and 0 stays bare.
  assert.equal(labelOf(kb, "Digit1"), "PLAN");
  assert.equal(labelOf(kb, "Digit5"), "FIELD -");
  assert.equal(labelOf(kb, "Digit7"), "OBJECT LAYOUT · RING");
  assert.equal(labelOf(kb, "Digit0"), null);
});

test("label scope: D and F stay operators, not addresses", () => {
  const kb = resolveKeyboard({ scope: "labels" });
  assert.equal(labelOf(kb, "KeyD"), "GO BACK II");
  assert.equal(capOf(kb, "KeyD").binding.operator, true);
  assert.equal(labelOf(kb, "KeyF"), "OPEN");
  assert.equal(capOf(kb, "KeyF").binding.operator, true);
  // No citizen or card can ever hold those letters as a target:
  for (const code of ["KeyD", "KeyF"]) {
    assert.equal(capOf(kb, code).binding.target, undefined);
  }
  assert.equal(labelOf(kb, "Escape"), "CANCEL");
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
  // Slice 11: the event caps, and window zoom on C/V.
  assert.equal(labelOf(paused, "KeyA"), "FINISH");
  assert.equal(labelOf(paused, "KeyS"), "GO BACK I");
  assert.equal(labelOf(paused, "KeyD"), "GO BACK II");
  assert.equal(labelOf(paused, "Escape"), "CANCEL");
  assert.equal(labelOf(paused, "KeyC"), "WINDOW OUT");
  assert.equal(labelOf(paused, "KeyV"), "WINDOW IN");
  // §14: in app scope digits stay bare — the camera is parked.
  assert.equal(labelOf(paused, "Digit1"), null);
  assert.equal(labelOf(paused, "Digit2"), null);
  assert.equal(labelOf(paused, "Digit5"), null);
  assert.equal(labelOf(paused, "Digit7"), null);
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
  assert.equal(lastKeyEcho(kb, "KeyA"), "A — FINISH");
  assert.equal(lastKeyEcho(kb, "KeyU"), "U —");
  assert.equal(lastKeyEcho(kb, null), "");
  const none = resolveKeyboard({ scope: "space" });
  assert.equal(none.caps.some((c) => c.active), false);
});

test("an unknown scope falls back to the space scope", () => {
  const kb = resolveKeyboard({ scope: "bogus" });
  assert.equal(kb.scope, "space");
  assert.equal(kb.scopeName, "SPACE");
});
