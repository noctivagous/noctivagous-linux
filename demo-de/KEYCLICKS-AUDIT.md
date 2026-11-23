# Key-clicks audit — against the React desktop architecture

Audited 2026-11-23, when the desktop root was converted to React
(`DESKTOP-ARCHITECTURE.md`). The engine audited is the former
`scripts/nct-keyclicks.js` (598 lines, one IIFE), written for the
vanilla desktop where the DOM was the only state. Findings, by
class (design / implementation / knowledge):

## Design

1. **Window geometry changed owners.** In the vanilla desktop the
   DOM *was* the window table, so drag-lock moving a window by
   `el.style.left/top` was correct. In the architecture, geometry
   lives in the store (`core/windows.js`) and React renders from
   it: a drag-lock move written only to the DOM is overwritten by
   the next render, and the store never learns the drop position.
   → The engine must not own geometry. It now emits a host-bridge
   event (`nct:winmove` with the window's app id + position) and
   the shell applies it through the window-manager actions, so the
   store stays the single truth during and after the drag.
2. **One IIFE is not a subsystem.** Addressing (the label algebra),
   the board (fixed data + sparse bindings) and the engine (the
   mode state machine) are three separable concerns with three
   different change-rates. → Split into `src/keyclicks/`
   (`addressing.js`, `board.js`, `engine.js`, `index.js`), pure
   parts separated from DOM parts, composed by `startKeyClicks()`.
3. **Mode was invisible to the system.** The engine's mode
   (KEY-CLICK / TEXT / LABELS / DRAG-LOCK) existed only in its HUD.
   → Mode changes are reported through a hook (`onMode`), which the
   composition wires to the bus as `kc:mode`; anything (a future
   Settings readout, a status widget) can subscribe.

## Implementation

4. **Scope detection read title text** (`.tt` containing "file" /
   "terminal"). Titles are display copy, not identity. → Scope now
   reads the window's `data-app` id and maps it through the board's
   scope table.
5. **The board's Enter did nothing in forms.** In text mode the
   onscreen Enter dispatched a synthetic keydown, which never
   submits a form — on the login screen (the board's most likely
   tablet use) Enter was dead. → Enter in text mode now calls
   `form.requestSubmit()` when the field is in a form.
6. **HUD / panel / tab were three loose body children.** → They
   now mount inside one engine-owned `#kcRoot` container.
7. **Range-input writes** already used the native value setter
   (React change tracking) — kept, and now documented in
   `addressing`'s neighbouring click dispatcher as a React-host
   requirement, not a trick.

## Knowledge (verified still true, no change)

8. The label algebra matches `src/flat-keys.js`: alphabet
   `ABEGHIJKLMNOPQRSTUWXYZ` (operators C D F V are not addresses),
   exact-and-not-prefix resolution, 1600 ms buffer window.
9. The text-entry guard matches the repo's rule: only genuine
   text-entry controls (text-like inputs, textarea,
   contentEditable) hold text mode; sliders / checkboxes / selects
   never swallow the operator keys.
10. Activation still dispatches through the elements' own handlers
    (synthetic `.click()`), so key and mouse cannot drift — this
    survives the React conversion because React's handlers are the
    elements' handlers.

## The DOM contract (what the engine may assume of its host)

- Screens: `#loginScreen` / `#desktopScreen`, live one has `.on`.
- Windows: `.nwin` with `data-app`, focused one has `.focused`;
  titlebar is `.nwin .titlebar`; the login window is `#loginWin`
  (never drag-locked).
- Files: `#fileTree button[data-folder]`.
- Addressables: the selector list in `addressing.js`.
- Host bridge: the host listens for `nct:winmove` (drag-lock) and
  renders window geometry from its own state.

## Round 2 (user's specification, 2026-11-23)

Five behaviours added, each placed by the same rules:

- **E collapses the window under the cursor** (its own shade
  button), and the remaining titlebar is placed directly under
  the cursor. Placement goes through `nct:winmove`; the cursor's
  viewport Y is converted into the window layer's frame first —
  the first browser check caught a 34px miss from mixing the two
  frames. E on a shaded window expands it in place.
- **F precedence fixed**: a real control inside a titlebar (the
  close/min/shade buttons) now wins over the titlebar itself —
  before, F over ✕ focused the window instead of closing it.
- **A closes the window under the cursor**, through its own close
  button. E and A are ordinary operators outside label mode (in
  label mode both letters still type labels) and are named on the
  board (COLLAPSE / CLOSE WIN).
- **Drag-lock states are visible three ways**: the reticle changes
  shape (ring → green square for a window, amber bar for a range),
  the system cursor follows (grabbing / ew-resize, via body
  classes), and the locked window wears a light-green cast at
  86% opacity. The cast is *host-rendered*: React owns the
  window's className and a re-render wiped the engine's class, so
  the engine reports the lock over a second bridge event
  (`nct:winlock`) and the shell paints it from store state —
  the same pattern as geometry.
- **Text mode wears KeyPilot's mark**: an orange ring on the
  terminal's content viewport when typing in the Terminal, on
  the text field itself otherwise (login screen included), and
  an orange cast over the board's caps while in text mode.
- **The board is draggable** by its panel head; position is the
  engine's own furniture, so it stays engine-owned.
- The stylesheet's F-click ripple (`.kc-ripple`, carried since
  the fragments) is now actually emitted, and the HUD markup was
  aligned to the stylesheet's class names (`kc-mode` /
  `kc-target` / `kc-hints`).
