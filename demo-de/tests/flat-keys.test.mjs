// Node tests for the 2D view's pure key core (src/flat-keys.js).
// Run: node tests/flat-keys.test.mjs  (from demo-de/)
import assert from "node:assert";
import {
  LABEL_ALPHABET, labelForIndex, assignLabels, resolveBuffer, isLabelKey,
  isTextEntryControl, BOARD_ROWS, KEY_BINDINGS, resolveBoard, bindingFor,
} from "../src/flat-keys.js";

let n = 0;
const eq = (a, b, m) => { assert.strictEqual(a, b, m); n++; };
const deep = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
const ok = (v, m) => { assert.ok(v, m); n++; };

// Alphabet: operators are not addresses.
ok(!LABEL_ALPHABET.includes("D"), "D is not an address");
ok(!LABEL_ALPHABET.includes("F"), "F is not an address");
eq(LABEL_ALPHABET.length, 24, "24 address letters");

// Labels: single letters, then spreadsheet order (house rule).
eq(labelForIndex(0), "A");
eq(labelForIndex(1), "B");
eq(labelForIndex(2), "C");
eq(labelForIndex(3), "E", "index 3 skips D");
eq(labelForIndex(23), "Z");
eq(labelForIndex(24), "AA");
eq(labelForIndex(25), "AB");
eq(labelForIndex(24 + 24), "BA");

// assignLabels pairs in order.
deep(assignLabels(["x", "y"]).map((p) => p.label), ["A", "B"]);

// Buffer resolver: match / pending / dead.
deep(resolveBuffer("A", ["A", "B"]), { kind: "match", label: "A" });
deep(resolveBuffer("A", ["A", "AA"]), { kind: "pending" }, "exact but prefix of longer stays pending");
deep(resolveBuffer("AA", ["A", "AA"]), { kind: "match", label: "AA" });
deep(resolveBuffer("Q", ["A", "B"]), { kind: "dead" });
deep(resolveBuffer("", ["A"]), { kind: "dead" });

// Label keys.
ok(isLabelKey("a") && isLabelKey("Z"), "letters are label keys");
ok(!isLabelKey("d") && !isLabelKey("f"), "operators are not label keys");
ok(!isLabelKey("1"), "digits are not label keys");

// Text-entry guard: text controls keep keys; sliders/selects do not.
ok(isTextEntryControl("INPUT", "text"));
ok(isTextEntryControl("TEXTAREA", ""));
ok(isTextEntryControl("DIV", "", true), "contentEditable keeps keys");
ok(!isTextEntryControl("INPUT", "range"), "slider does not swallow keys");
ok(!isTextEntryControl("INPUT", "checkbox"));
ok(!isTextEntryControl("SELECT", ""), "select does not swallow keys (house rule)");
ok(!isTextEntryControl("BUTTON", ""));

// Board is fixed data with real codes; Escape lives on the board.
const allCodes = BOARD_ROWS.flat().map((c) => c.code);
ok(allCodes.includes("KeyF") && allCodes.includes("Space") && allCodes.includes("Escape"));
eq(new Set(allCodes).size, allCodes.length, "no duplicate caps");

// Sparse bindings: shell resolves a small minority of caps.
const shell = resolveBoard(["shell"]).flat();
const boundShell = shell.filter((c) => c.binding);
ok(boundShell.length < shell.length / 3, `sparse: ${boundShell.length}/${shell.length} bound in shell scope`);
eq(bindingFor("KeyF", ["shell"]).name, "CLICK");
eq(bindingFor("KeyQ", ["shell"]), null, "unbound cap resolves null");

// Scope layering: frame scope adds, text scope renames Esc.
eq(bindingFor("Space", ["shell"]), null);
eq(bindingFor("Space", ["shell", "monitor"]).name, "HOLD");
eq(bindingFor("Space", ["shell", "home"]).name, "DRAG LOCK");
eq(bindingFor("Escape", ["shell", "text"]).name, "EXIT TEXT", "later scope wins");
const monitor = resolveBoard(["shell", "monitor"]).flat();
eq(monitor.filter((c) => c.binding).length, boundShell.length + 9, "monitor adds Space + 8 lanes");

// Every binding code exists on the board.
for (const [scope, table] of Object.entries(KEY_BINDINGS)) {
  for (const code of Object.keys(table)) ok(allCodes.includes(code), `${scope}:${code} is a real cap`);
}

console.log(`flat-keys: ${n} checks pass`);
