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

## Round 3 (2026-11-23)

- **R = collapse + drag-lock in one press**: E's collapse-at-cursor,
  then the lock engages on the next frame; a second R drops it.
  Board cap: COLLAPSE+DRAG.
- **T = vertical titlebar**: the window collapses to a 30px bar on
  its left edge, as tall as the full window (content + titlebar);
  the record keeps its w/h, so **E restores it exactly**. The state
  crosses the bridge as `nct:vshade` and lives in the store as
  `rec.vshaded`. Board cap: VERTICAL.
- **Resizable windows**: eight handles per window, all *inside* the
  border box (an earlier outside placement silently intercepted
  clicks meant for neighbours). Size is store-owned
  (`resizeWindow`, min 280×150), so it persists across re-renders.
- **Space locks from anywhere in the window**, not just the
  titlebar; the login window stays excluded.
- **F is a genuine click everywhere**: on a control it clicks the
  control (a `label` resolves to the control it wraps — Settings
  checkboxes and radios included); on empty desktop it dispatches
  the full mouse sequence at the cursor point, so the shell's own
  outside-click handling runs — an open menu closes under F just
  as it does under the mouse. F and Enter also fall back to the
  element at the cursor point when nothing is hovered or targeted,
  which is what lets F on the Terminal's output area refocus its
  input and re-enter text mode after Esc (KeyPilot's behaviour for
  any text entry area). The terminal input carries no `type`
  attribute, so the engine picks the body's first genuine
  text-entry control rather than matching a type selector.
- **A closes an open system menu before it closes a window.**
  Menu dismissal clicks are dispatched on `document.body` — a
  click targeted at `document` itself has no `closest()`, and the
  shell's menu handler silently died on it.
- **Hover re-aims**: moving onto a different element clears a
  stale Tab/label target, so F acts on what is under the cursor,
  not on what was targeted earlier.
- **The drag-lock reticle keeps following the cursor** while
  locked (it still turns square for a window, bar for a range) —
  the move handler returned early on the lock before repositioning
  it.
- **Single-click desktop icons** (and a single F), fast
  collapse/expand/close transitions (~120ms), the HUD hint line
  wears `kbd` chips like the board's caps, and the collapsed
  KEYBOARD tab now docks on the **left** edge.

## The grace period (2026-11-23)

KeyPilot's text-mode click countdown, ported from
keypilot-chrome-extension (`_armTextModeClick` /
`_handleActivateFromTextFocus`): text mode isolates the keyboard
— keys type, action keys do not run — with exactly two exceptions,
Esc and the **armed F**.

- **Mouse-move arms the click.** While in text mode, hovering a
  clickable starts a 3-second countdown (the HUD mode line reads
  `TEXT · F CLICKS 3…2…1`; the target wears a pulsing green
  outline, `.kc-armed`; the board's F cap lights, as KeyPilot
  lights its Click Element key).
- **F inside the window** leaves text mode first — a real pointer
  click would blur the field, a programmatic one does not — then
  clicks the armed target. No `f` reaches the field.
- **Expiry disarms**: after 3 seconds the hover is just a hover
  again; F types `f` once more. Moving off the clickable (or onto
  the field itself, or the board — caps type in text mode, so the
  engine's own furniture never arms) disarms; moving onto a new
  clickable re-arms fresh. Esc, a real mouse down, and leaving
  text mode by any path all disarm.

## Round 4 (2026-11-23): contextual menus, HUD manners, board home, view operators

- **Right-click is contextual.** The desk-area menu now depends on
  what was right-clicked: a window gets Focus / Collapse–Expand /
  Vertical Titlebar / Minimize / Maximize–Restore / Close (and is
  focused by the right-click); a desktop icon gets Open (NavGraph:
  Open/Close, matching its toggle); a dock task gets Focus /
  Minimize / Close in a menu that opens upward; the bare desk
  keeps its original menu.
- **The HUD moved over and learned to collapse.** It sat on the
  dock's START button; it now starts at x=134, clear of it.
  Right-clicking the bar collapses it into a KEY-CLICK button at
  the same spot (click or right-click re-expands). The bar is
  pointer-events:none so it never blocks the dock, so the
  right-click is caught by hit-testing the point against the
  bar's box in the capture phase — and it *yields* where a
  window, icon or dock task with its own menu lies beneath it.
- **The board homes on the left.** Activation docks the onscreen
  keyboard at the left edge, vertically centred; dragging still
  moves it while open. Its close button is F-clickable: caps, the
  close button and the KEYBOARD tab all act on mousedown, so
  kcClick delivers a mousedown first for anything inside the
  engine's own root (a reentry guard keeps a cap's synthetic
  keydown from doubling it). A closes the board before menus and
  windows, on the same ladder as round 3's menu rung.
- **View operators: `;` `'` rotate, `[` `]` scale.** They act
  first on the NavGraph trees: 15° steps, ×1.15 scale clamped to
  0.3–3, about the layout's pivot, over the `nct:navgraph`
  bridge. "Hover over the graph" is tested as: the layer is
  open, the point is inside its area, and nothing obscures it —
  the layer is click-transparent off its nodes, so the point may
  land on the desk beneath and still count; a window, menu, icon,
  widget or the dock at the point makes the keys inert.
- **Font stepping: `-` and `=`.** They shrink/grow the font size
  of the element under the cursor (an inline size, ×/÷1.1 steps,
  clamped 6–120px). In text mode they type, as characters should.
- **NavGraph bar shading.** The RADIAL/TREE switch and the ✕
  close now wear the system's shaded button language — gradient
  fills, black borders, inset light — the switch as a recessed
  track with a shaded green segment, like START.

## Wiring up the windows (2026-11-23)

The article's patch system (refs/nctos-wiringupthewindows.txt;
interaction model from refs/ui/patch_synth_demo.html), built as
`core/patchbay.js` + a `patch` store slice. Windows AND desktop
elements publish ports; cords carry live data between them.

- **Ports.** Inputs on the left edge, outputs on the right,
  appended to the edge itself (15px dots, blue in / green out —
  the folder/file colour family). Registry: clock (tick event),
  sysload (cpu, mem), home (user out, status in), files
  (selected, folder out/in), terminal (command event out, run
  in), notes (text out/in), monitor (cpu), settings (wallpaper
  out/in, wired at the store). A "value" port delivers only on
  change (no echo loops); an "event" port delivers every time.
- **O** opens the ports of the window or element under the
  cursor — the clock widget included. **P** flips a window onto
  its back: an overlay panel (the app stays mounted; its state
  survives) listing each port, its live value and cord count.
- **F** on a port begins a cord (dashed orange line follows the
  cursor; compatible ports glow); F on a port of the opposite
  direction completes it, and the source's current value flows
  at once. F elsewhere, Esc or A cancels the drawing. **A** over
  a cord removes it — a new rung on A's ladder, after the board
  and the pending cord, before menus and windows. Cords are SVG
  beziers on a layer above the windows; a wide invisible hit
  stroke is what A and right-click find. Anchors prefer the live
  dot and fall back to the owner's edge, so cords survive their
  ports being hidden and follow windows as they move.
- **Deliveries** are window events (`nct:deliver`); each app
  applies its own. The terminal's run port types the command in
  and hands focus back afterwards — a delivery must not steal
  the keyboard (a stuck focus there silently ate the A and P
  keys during testing: they typed into the terminal instead).
- **Right-click** a port or a cord for its menu: Open Viewer,
  Begin/Connect Cord, Disconnect, Remove Cord. The **Patch
  Viewer** (a window app, also in the new sysbar **Patch** menu
  beside Show All/Hide All Ports and Clear All Cords) watches a
  port or cord: current value, the delivery stream, an inject
  box for inputs, focus/remove/clear-log actions.
