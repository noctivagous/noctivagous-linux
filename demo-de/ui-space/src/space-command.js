/**
 * UI Space — the footer command line: a CLI-v2 "Category CLI" for
 * the space (after noctivagous/CLI-v2).
 *
 * The grammar is Category › Action › Argument. Each letter COMMITS
 * the moment it is typed — there is no free text until the ARG step,
 * where Space is a character (object names contain spaces) and
 * never the run key. Argless actions run IMMEDIATELY on their
 * action letter; an action with an argument runs on Enter.
 * Backspace / Delete / Esc walk back ARG → ACT → CAT → disarmed.
 * Tab in an object-name ARG cycles the matching names. Object names
 * resolve by unique prefix — of the full name or of any word in it
 * ("cu" resolves the Treemap cube) — and ambiguity is an error that
 * leaves the composition standing at the ARG step.
 *
 * This module is pure: no React, no three.js, no DOM. It holds the
 * composing state machine and resolves a finished composition into
 * an INTENT; SpaceApp dispatches intents through the very same
 * transitions its key handlers use (selection, the transform
 * appliers in space-state.js, addCable, applyLayout, zoomStep), so
 * the command line and the keys can never disagree about the state.
 *
 * The line is a MODE, not an <input>: the space's bare letters
 * target objects, so while the line is armed the printable keys
 * feed this machine and the label keys suspend. Arming is Enter (or
 * a click on the footer); Esc from the CAT step disarms.
 */

import { OBJECTS, objectById, cableKey } from "./space-state.js";

/** Category colours, in CLI-v2's spirit. ARG is always amber. */
export const CAT_COLORS = {
  object: "#2563eb",
  patch: "#7c3aed",
  layout: "#4f46e5",
  view: "#0891b2",
  system: "#059669",
};
export const ARG_COLOR = "#ffa726";

/**
 * The command table. arg: "object" (a name, unique prefix),
 * "number" (degrees / a scale factor), or null (argless — the
 * action runs on its letter). `run` names the intent each completed
 * composition resolves to.
 */
export const CMD_CATEGORIES = {
  o: {
    key: "o", name: "object", color: CAT_COLORS.object,
    hint: "the addressed object — select, turn, size, enter",
    actions: {
      s: { key: "s", name: "select", arg: "object", run: "select", hint: "object name — unique prefix · Tab cycles names · ⏎ runs" },
      y: { key: "y", name: "yaw", arg: "number", run: "yaw", hint: "degrees to yaw the current object (may be negative) · ⏎ runs" },
      t: { key: "t", name: "pitch", arg: "number", run: "pitch", hint: "degrees to pitch the current object (may be negative) · ⏎ runs" },
      r: { key: "r", name: "roll", arg: "number", run: "roll", hint: "degrees to roll the current object (may be negative) · ⏎ runs" },
      z: { key: "z", name: "size", arg: "number", run: "size", hint: "scale factor for the current object, e.g. 1.5 · ⏎ runs" },
      f: { key: "f", name: "focus", arg: null, run: "focus", hint: "enter the current object — runs now" },
      x: { key: "x", name: "strip", arg: null, run: "strip", hint: "strip the current object's cables — runs now" },
    },
  },
  p: {
    key: "p", name: "patch", color: CAT_COLORS.patch,
    hint: "cables between objects",
    actions: {
      c: { key: "c", name: "connect", arg: "object", run: "connect", hint: "target object name — unique prefix · Tab cycles names · ⏎ runs" },
      x: { key: "x", name: "clear", arg: null, run: "strip", hint: "clear the current object's cables — runs now" },
    },
  },
  l: {
    key: "l", name: "layout", color: CAT_COLORS.layout,
    hint: "load an arrangement — runs on the letter",
    actions: {
      r: { key: "r", name: "ring", arg: null, run: "layout", layout: "ring", hint: "the RING — runs now" },
      d: { key: "d", name: "districts", arg: null, run: "layout", layout: "districts", hint: "the DISTRICTS — runs now" },
      t: { key: "t", name: "theatre", arg: null, run: "layout", layout: "theatre", hint: "the THEATRE — runs now" },
    },
  },
  v: {
    key: "v", name: "view", color: CAT_COLORS.view,
    hint: "the camera — named plane views and zoom, runs on the letter",
    actions: {
      t: { key: "t", name: "top", arg: null, run: "view", view: "top", hint: "TOP — above, looking down at XZ — runs now" },
      f: { key: "f", name: "front", arg: null, run: "view", view: "front", hint: "FRONT — square-on to the XY wall — runs now" },
      s: { key: "s", name: "side", arg: null, run: "view", view: "side", hint: "SIDE — square-on to the YZ plane — runs now" },
      h: { key: "h", name: "home", arg: null, run: "view", view: "home", hint: "HOME — the parametric seat, and release — runs now" },
      i: { key: "i", name: "zoom in", arg: null, run: "zoom", dir: 1, hint: "zoom in (the 2 key) — runs now" },
      o: { key: "o", name: "zoom out", arg: null, run: "zoom", dir: -1, hint: "zoom out (the 1 key) — runs now" },
    },
  },
  s: {
    key: "s", name: "system", color: CAT_COLORS.system,
    hint: "the line itself — runs on the letter",
    actions: {
      h: { key: "h", name: "help", arg: null, run: "help", hint: "echo the category list — runs now" },
      c: { key: "c", name: "clear", arg: null, run: "clear", hint: "clear the echo — runs now" },
    },
  },
};

export const categoryOf = (state) => (state.cat ? CMD_CATEGORIES[state.cat] : null);
export const actionOf = (state) => {
  const cat = categoryOf(state);
  return cat && state.act ? cat.actions[state.act] : null;
};

/* ---------------- the composing state ---------------- */

/**
 * One composition: which category and action letters have committed,
 * the argument text so far, and the Tab-cycle bookkeeping for
 * object-name arguments (the prefix the cycle started from and the
 * candidate it last landed on). `armed` is the mode itself.
 */
export function createCommandState() {
  return { armed: false, cat: null, act: null, arg: "", cyc: null };
}

export function armCommand(state) {
  return { ...createCommandState(), armed: true };
}

export function disarmCommand() {
  return createCommandState();
}

/** The step the composition stands at: idle · cat · act · arg. */
export function stepOf(state) {
  if (!state.armed) return "idle";
  if (!state.cat) return "cat";
  if (!state.act) return "act";
  return "arg";
}

/** "o › s › treemap cube" — what the line shows and the echo quotes. */
export function describeComposition(state) {
  const parts = [];
  const cat = categoryOf(state);
  if (cat) parts.push(cat.key);
  const act = actionOf(state);
  if (act) parts.push(act.key);
  if (state.arg) parts.push(state.arg);
  return parts.join(" › ");
}

/** The step's hint, shown on the line itself. */
export function stepHint(state) {
  const step = stepOf(state);
  if (step === "idle") return "command line — Enter or click to arm · o bject · p atch · l ayout · v iew · s ystem";
  if (step === "cat") {
    return "category — " + Object.values(CMD_CATEGORIES).map((c) => `${c.key} ${c.name}`).join(" · ");
  }
  if (step === "act") {
    const cat = categoryOf(state);
    return `${cat.name} — ` + Object.values(cat.actions).map((a) => `${a.key} ${a.name}`).join(" · ");
  }
  return actionOf(state).hint;
}

/**
 * The valid next keys for the current step, for the chips row that
 * sits directly above the footer while composing. At the ARG step
 * of an object action the chips are the names still matching; the
 * run/walk keys ride along.
 */
export function validNextKeys(state, ctx = {}) {
  const step = stepOf(state);
  if (step === "cat") {
    return Object.values(CMD_CATEGORIES).map((c) => ({ key: c.key, label: c.name, color: c.color }));
  }
  if (step === "act") {
    const cat = categoryOf(state);
    return Object.values(cat.actions).map((a) => ({
      key: a.key, label: a.arg ? `${a.name} …` : a.name, color: cat.color,
    }));
  }
  if (step === "arg") {
    const act = actionOf(state);
    const chips = [];
    if (act.arg === "object") {
      for (const m of nameMatches(state.arg)) {
        chips.push({ key: m.name, label: m.name, color: ARG_COLOR });
      }
      chips.push({ key: "Tab", label: "cycle names" });
    }
    chips.push({ key: "⏎", label: "run" }, { key: "⌫", label: "back" }, { key: "Esc", label: "back" });
    return chips;
  }
  return [];
}

/* ---------------- name resolution ---------------- */

/**
 * Names matching a typed prefix: the full name starts with it, or
 * any word of the name does ("cu" → Treemap cube). An exact full
 * name always resolves alone. Case-insensitive.
 */
export function nameMatches(arg) {
  const q = String(arg || "").trim().toLowerCase();
  if (!q) return [...OBJECTS];
  const exact = OBJECTS.filter((o) => o.name.toLowerCase() === q || o.id === q);
  if (exact.length) return exact;
  return OBJECTS.filter((o) => {
    const name = o.name.toLowerCase();
    return name.startsWith(q) || name.split(/\s+/).some((w) => w.startsWith(q));
  });
}

/**
 * Resolve an object-name argument: exactly one match wins, several
 * is ambiguity (the composition stays at the ARG step), none is an
 * error.
 */
export function resolveObjectName(arg) {
  const q = String(arg || "").trim();
  if (!q) return { status: "empty" };
  const matches = nameMatches(q);
  if (matches.length === 0) return { status: "none", matches };
  if (matches.length > 1) return { status: "ambiguous", matches };
  return { status: "unique", object: matches[0], matches };
}

/* ---------------- number arguments ---------------- */

export function parseNumberArg(arg) {
  const t = String(arg || "").trim();
  if (!t) return { ok: false, error: "an argument is needed — type the number, then ⏎" };
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return { ok: false, error: `“${t}” is not a number` };
  return { ok: true, value: Number(t) };
}

/* ---------------- resolution: composition → intent ---------------- */

/**
 * Turn a composition whose argument is complete into an intent.
 * ctx carries what resolution must agree with: { currentId, cables
 * } — the patch rules (no self-patch, no duplicate) are enforced
 * here, at the resolver, with the same canonical cable key the
 * G-path's addCable uses, and again by addCable itself when the
 * intent is dispatched.
 */
export function resolveCommand(state, ctx = {}) {
  const cat = categoryOf(state);
  const act = actionOf(state);
  if (!cat || !act) return { ok: false, error: "the composition is not complete" };
  const text = describeComposition(state);
  const base = { text, cat: cat.name, action: act.name };

  switch (act.run) {
    case "layout": return { ok: true, intent: { ...base, type: "layout", layout: act.layout } };
    case "zoom": return { ok: true, intent: { ...base, type: "zoom", dir: act.dir } };
    case "view": return { ok: true, intent: { ...base, type: "view", view: act.view } };
    case "help": return { ok: true, intent: { ...base, type: "help" } };
    case "clear": return { ok: true, intent: { ...base, type: "clear" } };
    case "focus": return { ok: true, intent: { ...base, type: "focus" } };
    case "strip": return { ok: true, intent: { ...base, type: "strip" } };
    case "select":
    case "connect": {
      const r = resolveObjectName(state.arg);
      if (r.status === "empty") return { ok: false, error: "an object name is needed — type a prefix, Tab cycles, ⏎ runs" };
      if (r.status === "none") return { ok: false, error: `no object matches “${state.arg.trim()}”` };
      if (r.status === "ambiguous") {
        return { ok: false, error: `“${state.arg.trim()}” is ambiguous — ${r.matches.map((m) => m.name).join(" · ")}` };
      }
      if (ctx.isAddressable && !ctx.isAddressable(r.object.id)) {
        return { ok: false, error: `${r.object.name} is on a locked or hidden layer` };
      }
      if (act.run === "connect") {
        if (!ctx.currentId) return { ok: false, error: "nothing is current — select an object to patch from first" };
        if (r.object.id === ctx.currentId) {
          return { ok: false, error: `an object cannot patch to itself — ${r.object.name} is current` };
        }
        const k = cableKey(ctx.currentId, r.object.id);
        const dup = (ctx.cables || []).some(([a, b]) => cableKey(a, b) === k);
        if (dup) return { ok: false, error: `${objectById(ctx.currentId)?.name} and ${r.object.name} are already patched` };
      }
      return { ok: true, intent: { ...base, type: act.run, id: r.object.id, name: r.object.name } };
    }
    case "yaw":
    case "pitch":
    case "roll": {
      const n = parseNumberArg(state.arg);
      if (!n.ok) return n;
      return { ok: true, intent: { ...base, type: act.run, degrees: n.value } };
    }
    case "size": {
      const n = parseNumberArg(state.arg);
      if (!n.ok) return n;
      if (!(n.value > 0)) return { ok: false, error: "a scale factor must be positive" };
      return { ok: true, intent: { ...base, type: "size", scale: n.value } };
    }
    default:
      return { ok: false, error: `unknown action ${act.run}` };
  }
}

/* ---------------- the key machine ---------------- */

const isRunKey = (key) => key === "Enter" || key === "Return";

/**
 * Feed one keydown (by e.key value) to an armed composition.
 * Returns { state, intent, error }: an intent means the command
 * completed and the line has disarmed; an error means the
 * composition stands where it was (the failing step) with the
 * error to echo. Unrelated keys are ignored, never errors.
 */
export function feedCommandKey(state, key, ctx = {}) {
  if (!state.armed) return { state, intent: null, error: null };
  const step = stepOf(state);

  // Walk back: Esc and Backspace/Delete climb ARG → ACT → CAT → out.
  if (key === "Escape") {
    if (step === "arg") return { state: { ...state, act: null, arg: "", cyc: null }, intent: null, error: null };
    if (step === "act") return { state: { ...state, cat: null }, intent: null, error: null };
    return { state: disarmCommand(), intent: null, error: null };
  }
  if (key === "Backspace" || key === "Delete") {
    if (step === "arg" && state.arg.length > 0) {
      return { state: { ...state, arg: state.arg.slice(0, -1), cyc: null }, intent: null, error: null };
    }
    if (step === "arg") return { state: { ...state, act: null, arg: "", cyc: null }, intent: null, error: null };
    if (step === "act") return { state: { ...state, cat: null }, intent: null, error: null };
    return { state: disarmCommand(), intent: null, error: null };
  }

  if (step === "cat") {
    if (/^[a-zA-Z]$/.test(key)) {
      const cat = CMD_CATEGORIES[key.toLowerCase()];
      if (cat) return { state: { ...state, cat: cat.key }, intent: null, error: null };
      return { state, intent: null, error: `no category on “${key}” — o p l v s` };
    }
    return { state, intent: null, error: null };
  }

  if (step === "act") {
    if (/^[a-zA-Z]$/.test(key)) {
      const cat = categoryOf(state);
      const act = cat.actions[key.toLowerCase()];
      if (!act) return { state, intent: null, error: `no action “${key}” in ${cat.name} — ${Object.keys(cat.actions).join(" ")}` };
      const withAct = { ...state, act: act.key, arg: "", cyc: null };
      if (!act.arg) {
        // Argless: the letter IS the command.
        const r = resolveCommand(withAct, ctx);
        if (!r.ok) return { state: withAct, intent: null, error: r.error };
        return { state: disarmCommand(), intent: r.intent, error: null };
      }
      return { state: withAct, intent: null, error: null };
    }
    return { state, intent: null, error: null };
  }

  // step === "arg"
  const act = actionOf(state);
  if (isRunKey(key)) {
    const r = resolveCommand(state, ctx);
    if (!r.ok) return { state, intent: null, error: r.error };
    return { state: disarmCommand(), intent: r.intent, error: null };
  }
  if (key === "Tab") {
    if (act.arg !== "object") return { state, intent: null, error: null };
    return { state: cycleName(state), intent: null, error: null };
  }
  if (key === " ") {
    // Space is a character inside ARG (names have spaces in them).
    if (act.arg === "object") return { state: { ...state, arg: state.arg + " ", cyc: null }, intent: null, error: null };
    return { state, intent: null, error: null };
  }
  if (key.length === 1) {
    if (act.arg === "number" && !/[0-9.\-]/.test(key)) {
      return { state, intent: null, error: `“${key}” cannot go in a number — digits, . and - only` };
    }
    return { state: { ...state, arg: state.arg + key, cyc: null }, intent: null, error: null };
  }
  return { state, intent: null, error: null };
}

/**
 * Tab in an object-name ARG: complete to the next name matching the
 * prefix the cycle began from (the empty prefix cycles everything),
 * wrapping. Landing on a name and pressing Tab again advances.
 */
export function cycleName(state) {
  const cyc = state.cyc;
  const base = cyc ? cyc.base : state.arg;
  const matches = nameMatches(base);
  if (!matches.length) return state;
  let idx = 0;
  if (cyc && cyc.base === base) {
    const cur = matches.findIndex((m) => m.name === state.arg);
    idx = cur >= 0 ? (cur + 1) % matches.length : (cyc.idx + 1) % matches.length;
  } else {
    const cur = matches.findIndex((m) => m.name === state.arg);
    idx = cur >= 0 ? (cur + 1) % matches.length : 0;
  }
  return { ...state, arg: matches[idx].name, cyc: { base, idx } };
}

/** The help echo: the category list, one line. */
export function helpText() {
  return Object.values(CMD_CATEGORIES)
    .map((c) => `${c.key} ${c.name} (${Object.values(c.actions).map((a) => `${a.key} ${a.name}`).join(" · ")})`)
    .join("  |  ");
}
