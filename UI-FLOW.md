# UI Flow Notes — noctivagous-linux

Standing notes on how the desktop's functions are reached and how
they behave, kept at the repo root so any session can pick them up.

## Principle: functions are approachable from different points

A system function should never live in exactly one place. Each
function is reachable from several points — a key-click operator,
a visible control, and a context menu — so the user can reach it
from wherever their attention already is. When a function is
added, add its other doors in the same pass.

Examples in the current desktop:

- **Collapse the key-click status bar** — the ▾ control on the
  bar itself, E (or R) pressed while hovering it, or right-click
  on it. It collapses into the task bar; the KEY-CLICK button
  that replaces it re-expands it.
- **Hide / show / quit an app** — G / A over its icon, the
  icon's right-click menu, or the dock task's menu.
- **Freeze / unfreeze** — the element's context menu (below).
  (The `\` key held this job briefly; it is the Configure key
  now — see the Configure flow.)
- **Configure anything** — the `\` key over it, or (for apps)
  **Settings…** in its launch icon's right-click menu.
- **An app's window/layer mode** — its icon menu's
  **Desktop-layer mode** toggle, or the **Runs as** control on
  its page in Settings → Applications.

## Freeze flow

Freeze is a toggle on an element — a window, or a desktop-layer
app. It is reached from the element's context menu (the window
menu's **Freeze**; a layer app's desk and icon menus likewise):

1. **Freeze.** The element stays exactly where it is, takes on
   a frost cast, and accepts **no key or mouse events** —
   operators (E/R/T/H/G/A, F-clicks, drag-lock) skip it, its
   content (including iframes) is inert, and it cannot be
   dragged.
2. **Unfreeze.** Right-click it and choose **Unfreeze** — for a
   window this works over its titlebar, and over its body too
   (the body takes no events, so the desktop's right-click
   handler finds the frozen window geometrically and opens its
   menu). For a desktop-layer app, the desk right-click menu and
   the app's icon menu also carry **Unfreeze**.

**Desktop-layer apps are the standing use.** A layer app
(NavGraph) can be frozen on the desk and left there: its
controls and nodes take no pointer events, view keys and the
scroll wheel pass it by, and it does not conflict with other
interactions with the environment — windows open over it, the
transformer region works, patching works — until the user
unfreezes it.

## Configure flow

`\` is the global Configure key. Pressed over anything that
carries a configure hook, it opens the Settings app on that
thing's page:

- over a **launch item** → that app's page;
- over the **launch column** itself (not an icon) → the Launch
  Column page;
- over a **desktop widget** (clock, system load) → the widget's
  page;
- over a **window** or a **layer app** → its app's page.

Elements declare the hook (`data-configure`); windows and layer
apps resolve through their app id. Over something with no hook,
nothing opens and the key-click reticle shakes with a red ring
— the cursor itself says "not configurable".

## App settings and the stock kit

An app's settings do **not** live inside the app. They are
edited from outside it: the launch icon's **Settings…** menu,
the `\` Configure key, or Settings → Applications. Apps
declare their settings as a **property list** (a spec) and the
system renders it with the **stock settings kit** — the same
stock controls (checkbox, select, segment, slider, text) and
the same callbacks, bound to the app's slice of the system
settings, which the app reads back. An app that needs more can
provide its own settings GUI instead; the kit is the default,
not a cage.

## Window mode and desktop-layer mode

Every app runs in one of two modes. **Window mode** is a
conventional window. **Desktop-layer mode** puts the app on the
desk itself, under the windows, with layer conventions (no
titlebar; a shell frame bar for window-born apps; NavGraph,
which is layer-born, has its own full-desk surface). The mode
is a property of the app, set from outside it — the icon menu's
**Desktop-layer mode** toggle or Settings → Applications →
**Runs as** — and switching migrates a running instance. Apps
use the same hooks and callbacks in either mode; nothing in an
app knows which mode it is in. NavGraph defaults to layer mode;
everything else defaults to window mode. **Either kind can be
frozen.**

## Launch groups

The launch column has a second kind of item: a **Group**, which
opens up to show its member apps in place (indented, with a
chevron). The first group is **Utilities** (Calculator,
TextTransformer). Members are ordinary apps — same menus, same
modes, same settings.
