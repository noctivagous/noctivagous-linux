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
 *
 * Slice 11: the rotate/scale cluster lives on letter keys now
 * (derived like the punctuation was), the event caps are named
 * by their EVENTS (A FINISH, S GO BACK I, D GO BACK II, Esc
 * CANCEL), the DOLLY sits on C/V (§14: the dolly moves the
 * camera; the ZOOM is the focal pair), copy on H, strip cables
 * on J, and the punctuation caps stand bare — except [ and ]
 * (slice 13-3), which carry the platter's plane spin, derived
 * from PLATTER_SPIN_KEYS like the rest. The number row is
 * the camera and the room (§14/§15): 1–4 the named views (the
 * fieldset's order), 5/6 the field sizes, 7/8/9 the object
 * layouts. The rotate
 * caps' labels are DYNAMIC by the resolved target (ctx.rotate
 * Target, from resolveRotateTarget in space-state.js): on the
 * ring the yaw caps read SPIN RING, on the platter ROTATE
 * PLATTER, and the plane pair (B/N) names its target too. E's
 * cap is dynamic the other way (ctx.eKey, from resolveEKey):
 * FULL PLATTER when E would expand, YAW - when it would turn.
 */

import {
  TRANSFORM_KEYS,
  transformOpOf,
  PLATTER_SPIN_KEYS,
  LAYOUT_KEYS,
  LAYOUTS,
  VIEW_KEYS,
  VIEWS,
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

/** e.key → KeyboardEvent.code, for the derived caps. */
const CHAR_TO_CODE = {
  "-": "Minus", "=": "Equal",
  "[": "BracketLeft", "]": "BracketRight",
  ";": "Semicolon", "'": "Quote",
  ".": "Period", "/": "Slash", ",": "Comma",
};

const codeForChar = (ch) =>
  /^[a-z]$/.test(ch) ? `Key${ch.toUpperCase()}` : CHAR_TO_CODE[ch] || null;

const bind = (label, extra = {}) => ({ label, ...extra });
const op = (label, extra = {}) => ({ label, operator: true, ...extra });

/**
 * The transform caps, derived from TRANSFORM_KEYS: "yaw-" →
 * "YAW -", the plane pair → "ROTATE PLANE -" / "+". The rotate
 * caps (not magnify) rename themselves for the resolved target:
 * the ring only spins, the platter yaws as ROTATE PLATTER and
 * tilts, and plane-rotate names ring and platter outright.
 */
function transformBindings(ctx = {}) {
  const out = {};
  const target = ctx.rotateTarget || "citizen";
  for (const ch of Object.keys(TRANSFORM_KEYS)) {
    const code = codeForChar(ch);
    if (!code) continue;
    const opName = transformOpOf(ch);
    if (!opName) continue;
    const axis = opName.slice(0, -1);
    const sign = opName.slice(-1) === "+" ? "+" : "-";
    // §16: the Z/X operation is MAGNIFY — the caps name the
    // operation, not the geometric factor it steps.
    let label = axis === "spin" ? `ROTATE PLANE ${sign}`
      : axis === "scale" ? `MAGNIFY ${sign}`
      : `${axis.toUpperCase()} ${sign}`;
    if (target === "ring") {
      if (axis === "yaw" || axis === "spin") label = axis === "spin" ? "PLANE · RING" : "SPIN RING";
      else if (axis === "pitch" || axis === "roll") label = "SPIN ONLY";
    } else if (target === "platter") {
      // §12: on the platter the cluster turns the world in
      // CAMERA terms, B/N still turns it in its plane, and the
      // magnify keys are declined — the caps say all three.
      if (axis === "spin") label = "PLANE · PLATTER";
      else if (axis === "scale") label = "NO MAGNIFY · PLATTER";
      else label = "ROTATE PLATTER · CAMERA";
    }
    if (ctx.bookFlip && axis === "spin") {
      // Slice 13-2: in the book's SPREAD presentation, B and N
      // flip the spread instead of plane-spinning the book (the
      // App dispatches them there) — the cap must say so.
      label = `SPREAD ${sign}`;
    }
    out[code] = bind(label);
  }
  return out;
}

/**
 * The platter plane caps on [ and ] (slice 13-3, item 8),
 * derived from PLATTER_SPIN_KEYS: the platter's own plane spin,
 * platter-scoped — the caps light wherever the digit camera
 * keys light (space and label scopes; the armed line owns the
 * characters, an open app keeps its scope, a drag lock shrinks
 * the board to its four). ] steps the spin up —
 * counter-clockwise seen from overhead; [ steps it down.
 */
function platterSpinBindings() {
  const out = {};
  for (const [ch, opName] of Object.entries(PLATTER_SPIN_KEYS)) {
    const code = codeForChar(ch);
    if (!code) continue;
    const sign = opName.endsWith("+") ? "+" : "-";
    out[code] = op(`PLATTER PLANE ${sign}`, {
      hint: "the platter's plane spin — the rotation parameter; citizens keep B/N for their own plane",
    });
  }
  return out;
}

/**
 * The layout caps on 7 / 8 / 9, derived from LAYOUT_KEYS +
 * LAYOUTS. §13: the layouts are OBJECT keys — they rearrange
 * the citizens on the platter; the camera does not move — and
 * the caps say so.
 */
function layoutBindings() {
  const out = {};
  for (const [digit, name] of Object.entries(LAYOUT_KEYS)) {
    out[`Digit${digit}`] = bind(`OBJECT LAYOUT · ${LAYOUTS[name].name}`);
  }
  return out;
}

/* The view digits (§14): the fieldset's names, the fieldset's order. */
const VIEW_CAP_NAMES = { top: "PLAN", front: "ELEVATION", side: "SIDE", home: "HOME" };
function viewBindings() {
  const out = {};
  for (const [digit, view] of Object.entries(VIEW_KEYS)) {
    out[`Digit${digit}`] = bind(VIEW_CAP_NAMES[view], {
      hint: `the ${VIEWS[view].name} named view — the VIEW fieldset's order, the same goView as the buttons`,
    });
  }
  return out;
}

/**
 * The field digits (§15): the focal zoom, a ladder of named
 * field sizes. The caps name the gesture; the CURRENT field
 * size rides in the hint (ctx.fieldName, from the App), since
 * the panel head's echo is the last-key line, not a state line.
 */
function fieldBindings(ctx) {
  const now = ctx.fieldName ? `field now: ${ctx.fieldName} — ` : "";
  return {
    Digit5: bind("FIELD -", { hint: `${now}one field size wider: the focal zoom — the lens changes, the camera stays` }),
    Digit6: bind("FIELD +", { hint: `${now}one field size narrower: the focal zoom — the lens changes, the camera stays` }),
  };
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
    ...transformBindings(ctx),
    // E's second life: when resolveEKey says this press expands
    // an app, the cap names that instead of YAW -.
    ...(ctx.eKey === "expand" ? { KeyE: op("FULL PLATTER") } : {}),
    Escape: op("CANCEL"),
    ...layoutBindings(),
    ...viewBindings(),
    ...fieldBindings(ctx),
    ...platterSpinBindings(),
    Tab: op("CYCLE"),
    KeyA: op("FINISH"),
    KeyS: op("GO BACK I"),
    KeyD: op("GO BACK II"),
    KeyF: op(ctx.pending ? "COMPLETE PATCH" : "OPEN"),
    KeyG: op(ctx.pending ? "COMPLETE PATCH" : "PATCH"),
    KeyM: bind("LIBRARY"),
    KeyH: bind("COPY"),
    KeyI: bind("INSPECT"),
    KeyJ: bind("STRIP CABLES"),
    KeyC: bind("DOLLY OUT"),
    KeyV: bind("DOLLY IN"),
    KeyK: bind("KEYBOARD", { hint: "hide or show this panel" }),
    // Slice 13-2: U is BOOK STYLE only while the book is current
    // (ctx.bookStyle carries its presentation then, else null) —
    // in label scope U stays an address, as every letter does.
    ...(ctx.bookStyle ? {
      KeyU: op("BOOK STYLE", {
        hint: ctx.bookStyle === "spread"
          ? "stand the book as a cylinder again"
          : "stand the book open, two pages at a time",
      }),
    } : {}),
    Space: op("DRAG LOCK"),
    Enter: op("COMMAND LINE"),
  };
}

function labelBindings(ctx) {
  if (ctx.dragLocked) return dragBindings();
  const out = {
    Escape: op("CANCEL", { hint: "exit label mode — or release one level" }),
    ...layoutBindings(),
    ...viewBindings(),
    ...fieldBindings(ctx),
    ...platterSpinBindings(),
    Tab: op("CYCLE"),
    Space: op("DRAG LOCK"),
    Enter: op("COMMAND LINE"),
  };
  // Letters are addresses here: they resolve from the labeled
  // sets themselves, so a cap names its actual target — the
  // citizens in reading order, the ring's items continuing the
  // sequence, and the library's cards (ctx.cardLabels, present
  // only while the library is open) continuing it further. The
  // slice-11 operator letters (A, C, E, H, J, S, V, B, N…) are
  // addresses in this scope, exactly as the handler works them:
  // B is the drum, N the tree, J the arch, C the tray.
  for (const { object, label } of labeledObjects()) {
    out[`Key${label}`] = bind(object.name.toUpperCase(), { target: object.id });
  }
  for (const { item, label } of labeledRingItems()) {
    out[`Key${label}`] = bind(item.name.toUpperCase(), { target: item.id });
  }
  for (const cardLabel of ctx.cardLabels || []) {
    out[`Key${cardLabel.label}`] = bind(cardLabel.title.toUpperCase(), { target: cardLabel.id });
  }
  // Two letters stay OPERATORS even in label mode, because the
  // handler takes them before letter targeting ever runs and the
  // label alphabet excludes them: D is GO BACK II, F opens (or
  // completes a live patch). Applied last so the rule stands.
  out.KeyD = op("GO BACK II");
  out.KeyF = op(ctx.pending ? "COMPLETE PATCH" : "OPEN");
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
  if (ctx.appKind === "web") {
    // Slice 15: the WEB app's scope — the captured page on the
    // stage. Space steps the reading position forward a
    // section; C/V step it back and forth within the sheet's
    // own frame, as the waveform's C/V move its window; F
    // activates a token, follows a hovered link, or moves to a
    // hovered section.
    return {
      Escape: op("CANCEL"),
      Space: op("NEXT SECTION"),
      KeyC: bind("PREV SECTION"),
      KeyV: bind("NEXT SECTION"),
      Tab: op("CYCLE TOKENS"),
      KeyF: op("ACTIVATE", { hint: "the addressed ring token — or follow the hovered link / read the hovered section" }),
      KeyA: op("FINISH"),
      KeyS: op("GO BACK I"),
      KeyD: op("GO BACK II"),
      ...(ctx.appMode === "center" ? { KeyE: op("FULL PLATTER") } : {}),
      Enter: op("COMMAND LINE"),
    };
  }
  return {
    Escape: op("CANCEL"),
    Space: op(ctx.playing ? "PAUSE" : "PLAY"),
    KeyC: bind("WINDOW OUT"),
    KeyV: bind("WINDOW IN"),
    Tab: op("CYCLE TOKENS"),
    KeyF: op("ACTIVATE", { hint: "the addressed ring token — or drill the hovered stretch of the waveform" }),
    KeyA: op("FINISH"),
    KeyS: op("GO BACK I"),
    KeyD: op("GO BACK II"),
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

/** The app scope's name follows the app that holds the stage. */
const appScopeName = (ctx) => (ctx && ctx.appKind === "web" ? "WEB APP" : SCOPE_NAMES.app);

const SCOPE_TABLES = {
  space: spaceBindings,
  labels: labelBindings,
  command: commandBindings,
  app: appBindings,
};

/**
 * Resolve the board for one moment of the space.
 * ctx = { scope, playing, pending, dragLocked, appMode,
 *         rotateTarget: "citizen" | "ring" | "platter",
 *         eKey: "yaw-" | "expand" | null,
 *         fieldName: the current field size's name (§15),
 *         cardLabels: [{ label, title, id }],
 *         bookStyle: the book's presentation ("cylinder" |
 *           "spread") while the book is current, else null —
 *           U is BOOK STYLE only then (slice 13-2),
 *         bookFlip: the book current in SPREAD presentation —
 *           B and N read SPREAD − / SPREAD + (they flip),
 *         lastKey }
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
    scopeName: scope === "app" ? appScopeName(ctx) : SCOPE_NAMES[scope],
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
