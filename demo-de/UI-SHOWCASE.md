# UI Showcase — the standing reference for the GUI and layout engine

The UI Showcase is a desktop app (in the Development launch
group) that serves as the **standing reference** for how this
system's components are built in terms of layout — for the
system itself and for apps built on its kit. It is referred
to regularly when building or reviewing UI; keep it current
when the kit changes.

## The two aspects

1. **The library.** Live specimens of the stock controls and
   widgets software developers are provided, on two shelves:
   - the **system kit** — window chrome, menus, the HUD, the
     settings-kit controls, desktop widgets;
   - the **app kit** — the paramorphic controls, Chrome pieces
     and control registry an app developer builds with.
   Specimens are **live** (the controls actually work), carry
   a **global style-set switcher** (style sets and themes
   re-skin the whole showcase), and show **live DOM
   measurements**, because layout claims here are measured,
   not eyeballed.
2. **The GUI builder.** Assemble mock UI from the stock
   palette — **drag-from-palette** onto a gridded canvas,
   move/resize on the canvas, a property inspector rendered by
   the settings kit. The builder supports **drag-lock and
   key-click** as well as the mouse. Mocks are saved/loaded as
   files in the demo file system, in a **GuiDocument-shaped
   format**, so the later step — using it for real software
   development — is not a rewrite.

## Device classes, orientation, breakpoints — as decided

Classes: **phone / tablet / desktop** (VR later), orientation
(portrait / landscape) as a modifier, breakpoints by width:
**phone ≤ 640, tablet 641–1024, desktop > 1024**. A control's
properties may carry per-class overrides. The contract lives
in `src/desktop/core/devices.js` (`deviceClassForWidth`,
`resolveProp`, `useDevice`, `DeviceContext`).

A showcase frame is a DEVICE (phone portrait 390, phone
landscape 844, tablet 768/1024, desktop 1280/864); the class
a layout sees is the **width band** the frame's width falls
in — a phone in landscape lays out in the tablet band, which
is how width breakpoints behave on real hardware.

## Device classes, orientation, breakpoints

The system targets **desktop, mobile, tablet — and later
VR**. Controls therefore carry **hooks for device class,
orientation, and breakpoints**: a control's properties and a
builder layout can vary per device class, with orientation as
a modifier. The showcase exercises those hooks with a device
frame switcher (phone / tablet / desktop sizes, portrait and
landscape) so the topic can be worked on properly later
without retrofitting the controls.

## Alignment is a widget property

Text alignment, vertical alignment, and their kin are
**controls on the widgets themselves** — properties a
developer sets (and the builder's inspector offers), not
one-off styling in each app. The library's specimens exist to
demonstrate those properties: alignment modes, label
placement, baseline and vertical-centering behaviour, rhythm
and spacing.

## Resources, not ports

The three lab apps the owner supplied (Grid Systems Lab,
Proshade GUI Builder, Form Layout Lab) are **resources**:
their topics — grid systems, form layout, builder mechanics —
are mined deliberately, with consideration for purpose, for
what the app kit as a whole needs. They are not dropped in
as-is.

## Status

Slice 1 (the library) is built and verified: the Development
group's UI Showcase app with the Controls, Alignment, Grid
Systems and Style Sets sections and the App Kit shelf (the
paramorphic registry read live — 45 controls; mapped types
render live with a kit inspector, the rest show footprints
at default size).

Slice 2 (the GUI builder) is built and verified: a Builder
section whose palette is the same registry. Drag from the
palette or click-to-pick-up / click-to-drop (drag-lock; an F
press does the same); drag placed elements, resize by the
corner handle or the inspector's geometry fields, right-click
an element for its contextual menu (Duplicate / Bring to
front / Delete), Delete key removes the selection. The
inspector is the stock settings kit driven by each control's
registry schema — one renderer set (apps/showcase/
kitRender.jsx) serves the shelf, the canvas and, later, real
apps. Layouts are per device class: the device frame above
selects which layout is being edited. Mocks save/load as
GuiDocument-shaped JSON in the demo file system
(Documents/<name>.gui.json, via fsWrite in services/fs.js).

## Input

Like the rest of the system, the showcase and the builder are
native to key-clicks and drag-lock **and** fully usable with
a regular mouse, contextual menus included.
