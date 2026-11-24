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
- **Freeze / unfreeze** — the `9` key over the element, or its
  context menu (below). (`\` held this job for one round; it
  is the Configure key now — see the Configure flow.)
- **Configure anything** — the `\` key over it, or (for apps)
  **Settings…** in its launch icon's right-click menu.
- **An app's window/layer mode** — its icon menu's
  **Desktop-layer mode** toggle, or the **Runs as** control on
  its page in Settings → Applications.

## Freeze flow

Freeze is a toggle on an element — a window, or a desktop-layer
app. Press `9` with the cursor over the element, or use its
context menu (the window menu's **Freeze**; a layer app's desk
and icon menus likewise):

1. **Freeze.** The element stays exactly where it is, takes on
   a frost cast, and accepts **no key or mouse events** —
   operators (E/R/T/H/G/A, F-clicks, drag-lock) skip it, its
   content (including iframes) is inert, and it cannot be
   dragged.
2. **Unfreeze.** Press `9` again with the cursor over it (a
   frozen window is found geometrically, since its body takes
   no events), or right-click it and choose **Unfreeze** — for
   a window this works over its titlebar, and over its body too
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
- over the **launch bar** itself (not an icon) → the Launch
  Bar page;
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

## Launcher position and group flyouts

The launch bar's position is a setting
(`settings.launchColumn.position` — the storage key predates
the rename — set from Settings → Applications → Launch Bar,
or the `\` Configure key over the bar). The Position control
is a **2D matrix of stationary slots** laid out as a little
map of the screen's edges: the Top, Left, Right and Bottom
slots sit where the bar would go, and clicking one moves the
bar there. **Top** is the default; **left**/**right** are
vertical columns, **top**/**bottom** horizontal rows (top
under the sysbar, bottom above the dock). The About/Trash
pair mirrors when the bar docks right.

When the bar moves to an edge where a desktop widget's home
position would overlap it, the widget **relocates** instead
of being covered: the clock / system-load widgets drop below
the top bar's band, and the Window Stack moves to the
bottom-left when the bar takes the right edge (up the right
side, under the widgets, when the bar takes the bottom). The
shell measures each piece's home rect against the bar's
whenever the position changes and displaces only what would
actually collide.

**Minimized windows live on the bar.** The **S** key
minimizes the window under the cursor, and the window
becomes a list item attached to its app's bar button —
directly underneath the button when the bar is at the top
(above it at the bottom), as a horizontal item; to the side
of the button when the bar is on a side, where the item
stands vertical instead of horizontal. Clicking the item —
or pressing **F** over it, F being the click — restores the
window.

A launch group opens as a **flyout away from the docked
edge** — right of a left column, left of a right one, down
from the top bar, up from the bottom one — never pushing the
other launch items. The group's chevron points the way the
flyout opens.

Flyouts unfold **perpendicular to the launcher's axis, then
alternate at every depth**: from a left/right column the
first flyout lists its items **in a row**; a group inside it
opens **in a column** (dropping below its item in the row —
above it, when the launcher is docked at the bottom); a
group inside that opens in a row again, extending sideways
from its item in the column, and so on for as many levels as
the catalogue nests. From a top/bottom bar the first flyout
is a **column** and the alternation proceeds from there. A
group's members may be apps or other groups (registry
`GROUPS`); a group that is a member of another group lives
only inside its parent's flyout and is not also a top-level
launch item.

Two standing layout rules nearby: a window's title is
**centred in its titlebar** (the bar is a 1fr/auto/1fr grid,
so the id and the window controls balance), and the
key-click reference bar is **a single line** — and takes the
same orange Text Mode cast as the sysbar, dock and login
topbar.

## Launch groups

The launch bar has a second kind of item: a **Group**, which
opens a flyout of its member apps (see Launcher position and
group flyouts above). The first group is **Utilities** (Calculator,
TextTransformer). Members are ordinary apps — same menus, same
modes, same settings.

## The Files window's shell strip (nctsh)

The Files footer carries a **>_ CLI** control that opens the
**nctsh** strip underneath the footer, expanding the window's
content frame. The strip and the folder list drive the same
folder state — `cd` moves the list, clicking the tree moves
the shell's prompt — a mixed UI, not two views. Commands:
`pwd`, `ls`, `cd`, `mkdir`, `touch`, `rm`, `cat`, `help`,
`clear`, plus the bridge commands: `pw [file]` opens the
**preview drawer** to the right of the folder list (a file
double-click does the same), and `open <name>` enters a folder
or previews a file. The file system itself is one live tree,
kept as data (a JSON-shaped tree) and shared by Files, the
shell and NavGraph — a folder made with `mkdir` appears in
all three.

**More than one launch bar.** The desktop's right-click menu
has **Add Launch Bar**: a new bar appears at the first free
edge (bottom, then left, right, top) as an empty dashed
container — a bar is a container first. Right-clicking any
bar (its background, not an icon) opens the bar's own menu:
**Configure Launch Bar…** (its Settings page: the Position
matrix plus a checkbox per app — checked apps appear on the
bar in catalogue order), **Drag Mode**, and, for added bars,
**Remove Launch Bar**. In drag mode the bar wears a green
dashed outline; pressing on it and letting go near an edge
moves it there — the bar follows the nearest edge live while
dragged, and the press's click is swallowed so dragging from
a button never opens its app. The primary bar drags the same
way (its Settings page remains the other route). Bars that
share an edge stack inward in bands, minimized-window items
anchor by their own bar's edge, and furniture relocation
measures every bar, not just the primary.

**Desktop widgets: right-click, frozen by default.** The
Clock and System Load widgets answer a right-click with their
own menu: **Unfreeze/Freeze**, **Hide Widget**, and
**Configure…** (their Settings page). Widgets are **frozen**
by default — the desktop's freeze, as windows and layers wear
it: desaturated under a pale cast with a FROZEN tag, the
inside inert — and are unfrozen from that menu or by pressing
**9** over the widget (the freeze key-click; the key-click
bar's rows over a widget say so). A hidden widget leaves the
desktop and returns from the desktop menu's **Show … Widget**
entries — or by being placed again from the Widgets app.
