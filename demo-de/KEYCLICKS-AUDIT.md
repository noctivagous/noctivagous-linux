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

## The Browser window (2026-11-23)

A Browser app (registry id `browser`) frames web pages inside a
window. A framed page is a separate document: this engine's
listeners never see its keys and `elementFromPoint` stops at the
frame's edge, so key-clicks inside a page are served by a small
page-side counterpart, the frame bridge (`proxy/bridge.mjs`) —
the arrangement KeyPilot uses, a content script per frame. The
bridge draws its own hover ring, clicks with F, labels with
Alt+K, goes back with D, respects text entry, and reports the
page's location to the window by postMessage; Esc inside the
page hands control back to the window's chrome.

Pages reach the frame two ways: directly (the default — the
start page links only to sites verified to allow framing), or
through the NCT proxy, which strips framing refusals and
injects the bridge. The proxy, its lock, and its local/network
modes are documented in BROWSER-PROXY.md. Patch ports: `url`
out, `visit` in.

## Hide/show, icon states, and the text-mode cast (2026-11-23)

Windows gained a `hidden` state (the G key). G over an app's
desktop icon — or over the app's window — toggles it: the
window stops displaying but the app stays open and mounted, so
its state survives (unlike close; unlike min it is driven from
the icon as a toggle). The icon column now carries state: an
open app shows a green rail beside its icon, a hidden app is
dimmed and greyed with a grey rail, and the dock's task buttons
mark hidden windows too. The icon's right-click menu gained
Hide/Show and Quit. A over an app icon quits the app — a new
rung on A's ladder, placed after cords and after any open menu
(menus still close first). The engine reaches the store through
an `nct:appctl` bridge ({op: toggleHide | quit, app}), the same
pattern as the other shell bridges.

Text mode now casts the system bars orange: while the keyboard
belongs to a text field (`body.kc-textmode`, set by the
engine's existing text-mode tracking), the sysbar, the dock and
the login topbar carry an orange tint with a stronger orange
edge line, so the mode is visible at the system's frame, not
only at the field's ring.

## Keymap layering: global and app contexts (2026-11-23)

`src/desktop/core/keymaps.js` sorts out the relationship the
Browser window called for. Two contexts decide what a press
means: GLOBAL (the shell's operators) and APP — the keymap of
the app whose window is under the cursor; the hovered rectangle
is the context, not keyboard focus. Physical slots split in
two:

- RESERVED — the system's operators; apps cannot override
  them. F above all: F is the system left-click inside and
  outside apps, on every layout. Also A, G, O, P, E, R, T, Tab,
  Space, Esc, Alt+K, Alt+L.
- OVERRIDABLE — slots an app may bind for its own windows. A
  binding consumes the press inside that app's windows;
  everywhere else the slot keeps its global meaning.

Apps bind slots to GENERIC ACTIONS from a system vocabulary
(HISTORY_BACK, HISTORY_FORWARD, DELETE, …): the system supplies
the vocabulary and the dispatch — an `nct:key` window event
{app, key, action}, delivered by the engine when the press
lands on that app's window — and the app supplies the meaning.
First binding: the Browser's D → HISTORY_BACK. Inside a proxied
page the bridge's D does the same for the page's own history,
so D means "back" at both levels of the browser's context.

Two boundaries are intrinsic, not bugs: while a text field
holds the keyboard (text mode) letters type, and while a frame
holds focus its keys belong to the page — Esc is the way back
in both. The Browser's address bar therefore hands the keyboard
back on Enter, like the Terminal's run port.

## H: resize to the cursor point (2026-11-23)

H resizes the FOCUSED window to the cursor. The window's edges,
extended, divide the space around it into 8 sections; the
section the cursor occupies decides what moves: E pulls the
right edge to the cursor's x, W the left edge, S the bottom, N
the top, and the four corners land the corner itself on the
cursor point (both axes). Inside the window there is no section
and H does nothing — the cursor is outside the target by
definition, which is why the target is the focused window
rather than the window at the cursor as with E/R/T.

The engine computes the section and the candidate geometry
from the rendered rect (converted through the offsetParent,
like the drag-lock) and sends it over an `nct:winresize`
bridge; the store's `resizeTo` writer owns the rules: minimums
280×150 (the same as the drag handles), a maximised window
refuses, a vertical resize unshades a shaded window into its
new height while a sideways one leaves its shade and stored
height untouched. Sections outside the window can only grow
it, so the minimums are a safety net rather than a behaviour.
H is a reserved slot (window-geometry family, with E/R/T).

## WindowTransformerRegion (2026-11-23)

A fixed 104×104 square at the desktop's lower right (it never
changes size), in List mode: vertical orientation, stack
direction Up. Configuration (`WTR_CONFIG` in DesktopApp):
`accepts: "titlebar"` — only windows collapsed into titlebars
transform.

Dropping a collapsed titlebar into the square — by a mouse
titlebar drag (`nct:windrop`, dispatched by Window.jsx at drag
end) or by a drag-lock release (DesktopApp watches the
`nct:winlock` bridge go quiet) — transforms the window into a
list item of the region's stack when the titlebar's centre
lands inside the square. The window's record keeps its
geometry and gains `stacked`; the stack list lives in the
windows slice, in arrival order, rendered upward from the
square (first arrival nearest it). Uncollapsed windows are
refused.

Clicking a stack item restores the window to its titlebar at
the click point and, by default, turns drag-lock on for that
titlebar: the shell dispatches `nct:lockwin` after the restore,
and the engine engages the lock with a centre grab, so the bar
arrives already carried and Space drops it where wanted —
including back into the region, which transforms it again.

Coordinate note: windows live in `#winLayer`, whose origin is
34px below the viewport top (the sysbar). Both the restore
placement and the engine's centre grab convert through the
offsetParent — the engine's dragMove speaks client-minus-grab
coordinates, so the grab offset carries the origin back in.

## Round 7: wheel zoom, layer icons, HUD collapse, E/R swap, 0 styles (2026-11-23)

Four changes:

- **Wheel zoom for desktop-layer apps.** With a layer mounted
  (NavGraph), wheel steps over the desktop walk the same scale
  as `[` / `]` (nct:navgraph scaleUp/scaleDown, ×1.15, clamped
  0.3–3). Windows, frames and the engine's own furniture keep
  their wheel. Steps accumulate at 50px per step so trackpad
  flicks don't slam the clamp. Layer apps also got their own
  icon style in the launch stack: the NavGraph icon carries a
  `layer` class — teal family, a diamond badge, teal selection —
  distinct from window-app icons.
- **The status bar collapses into the task bar.** The bar
  gained a visible collapse control (▾, its one pointer-events
  island); collapsing swaps it for the KEY-CLICK button in the
  same task-bar spot, and clicking that re-expands. E (or R)
  over the bar toggles the same collapse — a geometric test,
  since the bar takes no pointer events, with the context
  menu's courtesy that a window, icon or task at the point
  wins. Right-click collapse from round 4 still works.
- **E and R swapped.** E is now collapse + drag-lock (the old
  R): the collapse lands its titlebar on the cursor and the
  lock engages on the same press, because what is underneath
  is draggable — all windows are. A second E drops the lock.
  R is the plain collapse (the old E).
- **0 cycles built-in style sets.** Pressing 0 over an element
  with a style set cycles it (nct:widgetstyle). First carriers:
  the desktop widgets — System Load and Local Time each have
  panel (default), glass (lighter, more transparent) and
  recessed (sunken) sets, stored per widget in
  settings.widgetStyles. 0 is a reserved slot.

## Freeze (2026-11-23)

`\` toggles Freeze on the element under the cursor — a window,
or the desktop-layer app beneath it. A frozen element stays
exactly in place and accepts no key or mouse events until
unfrozen: operators skip it (winAtCursor/appAtCursor treat it
as absent, F-clicks refuse its subtree, drag-lock won't take
it, H refuses it), its frame swallows presses and clicks, its
body is pointer-events:none so hosted content and iframes go
inert, and it wears a frost cast (desaturated, brightened, a
pale-blue wash). State: `frozen` on the window record;
`ui.frozenLayers` for layers. Frozen windows are found for the
`\` toggle geometrically (their bodies take no events, so
hit-testing alone can miss them).

Unfreeze has several doors, per the standing principle now
written in UI-FLOW.md at the repo root (functions approachable
from different points): `\` again, the window's context menu
(a right-click over a frozen body opens that window's menu —
the desk handler finds it geometrically), the desk menu and
the icon menu for a frozen layer. A frozen NavGraph ignores
view ops, its bar and nodes take no pointer events, and the
wheel passes it by — it can sit on the desk indefinitely
without conflicting with other interactions. `\` is a
reserved slot.


## Addendum — launch groups, app modes, external settings, the Configure key (2026-11-23)

Four system pieces landed together; the key-click-relevant
parts:

- **Groups in the launch column.** A group is a launch item
  that opens its contents in place (Utilities → Calculator,
  TextTransformer — the latter carrying caseconvert.net's
  function set: UPPER, lower, Sentence, Title, Capital,
  Hyphenated). Members are ordinary icons: F clicks them, their
  menus are the standard ones.
- **Window mode / desktop-layer mode.** Every app has a mode
  (`ui.appModes`; NavGraph defaults to layer, the rest to
  window). The icon menu's **Desktop-layer mode** toggle (and
  Settings' **Runs as**) switches it, migrating a live instance:
  window-born apps get a shell frame on the desk with the app at
  full size; NavGraph in window mode renders framed inside a
  conventional window. Apps use the same hooks and callbacks in
  either mode. A layer app of either kind shows in the launch
  column with the teal layer style and diamond badge.
- **Settings live outside the app.** `settings.appSettings`
  holds each app's own settings; the doors are the icon menu's
  **Settings…**, the Configure key (below), and Settings →
  Applications (which also hosts shell pages: Launch Column,
  the two desktop widgets). Apps declare settings as a
  **property list** rendered by the **stock settings kit**
  (`apps/settingsKit.jsx` — checkbox / select / segment /
  slider / text, one binding convention), or provide their own
  GUI as an escape hatch.
- **`\` is the global Configure key** (it was Freeze for one
  round; Freeze keeps its context menus). Elements declare
  `data-configure`; the engine resolves the nearest hook, else
  the window's or layer's app id, else a frozen window found
  geometrically, and dispatches `nct:configure`; the shell opens
  Settings on that target. No hook → the reticle shakes with a
  red ring (`kc-noconfig`) and nothing opens. `\` stays a
  RESERVED key.
- **The HUD's target cell is a fixed 210px** — the rest of the
  bar's layout no longer shifts as the target readout changes.

Verified in Chromium (24 checks across two suites): the group
opens; Calculator computes and honours its kit-bound rounding
(1 ÷ 3 = 0.33 at 2 places); TextTransformer's three spot-checked
conversions and its kit checkbox (sentence-case rest off keeps
"HELLO WORLD"); `\` over an icon / the clock / a column gap
opens Notes' / the Clock Widget's / the Launch Column's page;
the kit segment sets the clock's style; bare desktop gives the
shake and no page change; Calculator migrates window → layer →
window and computes inside the layer; NavGraph's mode toggle is
checked by default and migrates it layer → window (framed) →
layer; freeze/unfreeze still work from the window menu; the
HUD target width and hints offset are identical across targets.


## Addendum — Freeze's key is 9; a bridge bug found; nctsh in Files (2026-11-23)

- **Freeze moved to `9`** (the user's pick) when `\` became
  Configure. `9` is RESERVED. The toggle resolves like
  Configure's: window at cursor → frozen window geometrically
  → the mounted layer app.
- **A latent bridge bug, found by the `9` work:** the engine
  dispatched `nct:freeze` on **document** while DesktopApp
  listened on **window**, and a non-bubbling CustomEvent
  dispatched on document never reaches a window listener — so
  the freeze KEY silently never fired; the context menus
  (which call the writer directly) masked it completely. All
  other bridge pairs were audited in the same pass: winmove /
  winlock / vshade are document↔document, everything else is
  window↔window, freeze was the only mismatch. Fixed by
  dispatching on window. Lesson recorded: a bridge is a pair;
  verify both ends, and a green menu path proves nothing about
  the key path.
- **nctsh in the Files window.** A footer control opens the
  shell strip under the footer; the strip and the GUI list
  share one folder state (`cd` moves the list; tree clicks
  move the prompt). `pw` opens a preview drawer right of the
  list. The demo file system was rebuilt as a JSON-shaped
  tree (services/fsData.js) behind a mutable live tree
  (services/fs.js) shared by Files, the shell and NavGraph.

Verified in Chromium (15 checks): `9` freezes/unfreezes a
window and the NavGraph layer; the strip opens under the
footer; `cd`/`mkdir` land in the list, the tree pane and the
NavGraph layer; `pw` opens the drawer with the file's content
at the list's right; `cat` prints; a bad `cd` errors in shell
style; ArrowUp recalls history; the drawer's Close dismisses
it; the HUD target width stays fixed.
