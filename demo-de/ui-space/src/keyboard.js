/**
 * UI Space — the overlay keyboard panel's sparse keymap database
 * and its resolver (pure data; no React, no three.js, no DOM).
 *
 * Modelled on nibglider's on-screen keyboard architecture: a
 * shared keymap is RESOLVED per layout/state into resolved caps,
 * and the panel component owns nothing — it renders resolved
 * caps, highlights the active key, and does not itself run
 * commands. Here the "layout/state" is the space's current SCOPE,
 * and the database is SPARSE: a binding exists only where a scope
 * actually binds a key. Most caps in most scopes resolve to null
 * and render as bare dim glyphs — the board is a map of what the
 * keys do HERE, now, not a poster of everything they ever do.
 *
 * Scopes, in the App's precedence order: "app" (the Waveform app
 * holds the stage) > "command" (the command line is armed) >
 * "labels" (label mode) > "space" (the default scheme). While a
 * thing is being INSPECTED there is no fifth scope: inspection
 * suspends the modes themselves, and the panel keeps showing the
 * space scope — whose Esc / D / transform caps are the ones that
 * stay true at the inspection position anyway.
 *
 * What can be derived IS derived, so the panel cannot lie: the
 * transform caps come from TRANSFORM_KEYS and the layout caps
 * from LAYOUT_KEYS / LAYOUTS in space-state.js, the command
 * scope's category caps from CMD_CATEGORIES in space-command.js,
 * and the label scope's letter caps resolve dynamically from the
 * labeled sets (citizens, then the ring, then the media cards —
 * the App passes the card labels in via ctx, since they exist
 * only while the library is open). The rest is curated below,
 * key for key against SpaceApp's keydown handler: if a shown
 * binding is not honoured there, the bug is in this table.
 */

import {
  TRANSFORM_KEYS,
  LAYOUT_KEYS,
  LAYOUTS,
  labeledObjects,
  labeledRingItems,
} from "./space-state.js";
import { CMD_CATEGORIES } from "./space-command.js";

/* ---------------- the fixed grid ---------------- */

const cap = (code, glyph, width = 1) => ({ code, glyph, width });
const letterCap = (ch) => cap(`Key${ch}`, ch);
const digitCap = (d) => cap(`Digit${d}`, d);

/**
 * The physical board as data: five rows, widths in cap units
 * (every row sums to 13.5). The grid is FIXED — everything
 * variable comes from the sparse database below. Codes are
 * KeyboardEvent.code strings, matching what the App records.
 */
export const KEYBOARD_ROWS = [
  [
    cap("Escape", "ESC", 1.5),
    ...["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(digitCap),
    cap("Minus", "-"),
    cap("Equal", "="),
  ],
  [
    cap("Tab", "TAB", 1.5),
    ..."QWERTYUIOP".split("").map(letterCap),
    cap("BracketLeft", "["),
    cap("BracketRight", "]"),
  ],
  [
    ..."ASDFGHJKL".split("").map(letterCap),
    cap("Semicolon", ";"),
    cap("Quote", "'"),
    cap("Enter", "ENTER", 2.5),
  ],
  [
    cap("ShiftLeft", "SHIFT", 2.25),
    ..."ZXCVBNM".split("").map(letterCap),
    cap("Comma", ","),
    cap("Period", "."),
    cap("Slash", "/"),
    cap("ShiftRight", "SHIFT", 1.25),
  ],
  [
    cap("AltLeft", "ALT", 2),
    cap("Space", "SPACE", 9.5),
    cap("AltRight", "ALT", 2),
  ],
];

export const KEYBOARD_CAP_COUNT = KEYBOARD_ROWS.reduce((n, row) => n + row.length, 0);

/* ---------------- derived bindings ---------------- */

/** e.key punctuation → KeyboardEvent.code, for the derived caps. */
const CHAR_TO_CODE = {
  "-": "Minus", "=": "Equal",
  "[": "BracketLeft", "]": "BracketRight",
  ";": "Semicolon", "'": "Quote",
  ".": "Period", "/": "Slash", ",": "Comma",
};

const bind = (label, extra = {}) => ({ label, ...extra });
const op = (label, extra = {}) => ({ label, operator: true, ...extra });

/** The transform caps, derived from TRANSFORM_KEYS: "yaw-" → "YAW -". */
function transformBindings() {
  const out = {};
  for (const [ch, opName] of Object.entries(TRANSFORM_KEYS)) {
    const code = CHAR_TO_CODE[ch];
    if (!code) continue;
    const name = opName.slice(0, -1).toUpperCase();
    const sign = opName.slice(-1) === "+" ? "+" : "-";
    out[code] = bind(`${name} ${sign}`);
  }
  return out;
}

/** The layout caps on 3 / 4 / 5, derived from LAYOUT_KEYS + LAYOUTS. */
function layoutBindings() {
  const out = {};
  for (const [digit, name] of Object.entries(LAYOUT_KEYS)) {
    out[`Digit${digit}`] = bind(LAYOUTS[name].name);
  }
  return out;
}

/**
 * While the drag lock holds, the handler's locked branch swallows
 * everything but these four — so in ANY scope, a locked drag
 * resolves to exactly this set (Space drops, Esc cancels, X and Z
 * are the axis locks). The scope's other caps go bare.
 */
function dragBindings() {
  return {
    Escape: op("CANCEL DRAG"),
    Space: op("DROP"),
    KeyX: bind("AXIS X"),
    KeyZ: bind("AXIS Z"),
  };
}

/* ---------------- the sparse scope tables ---------------- */

function spaceBindings(ctx) {
  if (ctx.dragLocked) return dragBindings();
  return {
    Escape: op("RELEASE"),
    Digit1: bind("ZOOM OUT"),
    Digit2: bind("ZOOM IN"),
    ...layoutBindings(),
    Tab: op("CYCLE"),
    KeyF: op(ctx.pending ? "COMPLETE PATCH" : "OPEN"),
    KeyD: op("BACK"),
    KeyG: op(ctx.pending ? "COMPLETE PATCH" : "PATCH"),
    KeyM: bind("LIBRARY"),
    KeyC: bind("COPY"),
    KeyI: bind("INSPECT"),
    KeyX: bind("STRIP CABLES"),
    KeyK: bind("KEYBOARD", { hint: "hide or show this panel" }),
    Space: op("DRAG LOCK"),
    Enter: op("COMMAND LINE"),
    ...transformBindings(),
  };
}

function labelBindings(ctx) {
  if (ctx.dragLocked) return dragBindings();
  const out = {
    Escape: op("EXIT LABELS"),
    Digit1: bind("ZOOM OUT"),
    Digit2: bind("ZOOM IN"),
    ...layoutBindings(),
    Tab: op("CYCLE"),
    Space: op("DRAG LOCK"),
    Enter: op("COMMAND LINE"),
    ...transformBindings(),
  };
  // Letters are addresses here: they resolve from the labeled
  // sets themselves, so a cap names its actual target — the
  // citizens in reading order, the ring's items continuing the
  // sequence, and the library's cards (ctx.cardLabels, present
  // only while the library is open) continuing it further.
  for (const { object, label } of labeledObjects()) {
    out[`Key${label}`] = bind(object.name.toUpperCase(), { target: object.id });
  }
  for (const { item, label } of labeledRingItems()) {
    out[`Key${label}`] = bind(item.name.toUpperCase(), { target: item.id });
  }
  for (const cardLabel of ctx.cardLabels || []) {
    out[`Key${cardLabel.label}`] = bind(cardLabel.title.toUpperCase(), { target: cardLabel.id });
  }
  // Three letters stay OPERATORS even in label mode, because the
  // handler takes them before letter targeting ever runs: D backs
  // out, F opens (or completes a live patch), X strips cables.
  // They are applied last so the rule stands in the data.
  out.KeyD = op("BACK");
  out.KeyF = op(ctx.pending ? "COMPLETE PATCH" : "OPEN");
  out.KeyX = bind("STRIP CABLES");
  return out;
}

function commandBindings() {
  // The armed line's frame: its category caps are derived from
  // CMD_CATEGORIES; its action letters resolve per category and
  // the chips row above the line carries the live step, so the
  // board shows the categories and the line's own keys only.
  const out = {
    Escape: op("WALK BACK"),
    Enter: op("RUN"),
    Tab: bind("CYCLE NAMES", { hint: "in an object argument, Tab cycles the matching names" }),
    Space: bind("SPACE CHAR", { hint: "in an argument, space is a character — never the run key" }),
  };
  for (const cat of Object.values(CMD_CATEGORIES)) {
    out[`Key${cat.key.toUpperCase()}`] = bind(cat.name.toUpperCase(), { hint: cat.hint });
  }
  return out;
}

function appBindings(ctx) {
  return {
    Escape: op("LEAVE APP"),
    Space: op(ctx.playing ? "PAUSE" : "PLAY"),
    Digit1: bind("WINDOW OUT"),
    Digit2: bind("WINDOW IN"),
    Tab: op("CYCLE TOKENS"),
    KeyF: op("ACTIVATE", { hint: "the addressed ring token — or drill the hovered stretch of the waveform" }),
    KeyD: op("APP BACK"),
    // E expands a centre-stage app; already full, it does nothing
    // and the cap goes bare — ctx.appMode carries the fact.
    ...(ctx.appMode === "center" ? { KeyE: op("FULL PLATTER") } : {}),
    Enter: op("COMMAND LINE"),
  };
}

/* ---------------- the Alt combos strip ---------------- */

/**
 * The Alt combinations, as a strip along the panel's foot rather
 * than caps on the Alt keys (Alt alone does nothing, and its caps
 * stay bare in every scope). The handler checks all five BEFORE
 * every scope branch — command line and open app included — so
 * the strip is the same in all four scopes; layer toggles are
 * NOT suspended in app scope, whatever one might expect.
 */
export const KEYBOARD_COMBOS = [
  { keys: "Alt+L", label: "LABELS" },
  { keys: "Alt+0", label: "CLIPBOARD" },
  { keys: "Alt+1", label: "LAYER · DATA" },
  { keys: "Alt+2", label: "LAYER · INST" },
  { keys: "Alt+3", label: "LAYER · SCENERY" },
];

/* ---------------- the resolver ---------------- */

export const KEYBOARD_SCOPES = ["space", "labels", "command", "app"];

export const SCOPE_NAMES = {
  space: "SPACE",
  labels: "LABELS",
  command: "COMMAND LINE",
  app: "WAVEFORM APP",
};

const SCOPE_TABLES = {
  space: spaceBindings,
  labels: labelBindings,
  command: commandBindings,
  app: appBindings,
};

/**
 * Resolve the board for one moment of the space.
 * ctx = { scope, playing, pending, dragLocked, appMode,
 *         cardLabels: [{ label, title, id }], lastKey }
 * Returns { scope, scopeName, rows, caps, combos } where each cap
 * is { code, glyph, width, binding|null, active } — binding a
 * { label, hint?, operator?, target? } or null (a bare dim glyph),
 * and active marks ctx.lastKey's cap. Pure: the same ctx always
 * resolves the same board.
 */
export function resolveKeyboard(ctx = {}) {
  const scope = KEYBOARD_SCOPES.includes(ctx.scope) ? ctx.scope : "space";
  const table = SCOPE_TABLES[scope](ctx);
  const rows = KEYBOARD_ROWS.map((row) =>
    row.map((c) => ({
      ...c,
      binding: table[c.code] || null,
      active: Boolean(ctx.lastKey) && ctx.lastKey === c.code,
    })),
  );
  return {
    scope,
    scopeName: SCOPE_NAMES[scope],
    rows,
    caps: rows.flat(),
    combos: KEYBOARD_COMBOS,
  };
}

/** The panel head's last-key echo: "F — OPEN", "Q —" when unbound. */
export function lastKeyEcho(resolved, code) {
  if (!code) return "";
  const cap = resolved.caps.find((c) => c.code === code);
  if (!cap) return code;
  return cap.binding ? `${cap.glyph} — ${cap.binding.label}` : `${cap.glyph} —`;
}
