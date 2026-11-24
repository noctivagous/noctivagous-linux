/* The app registry — the desktop's catalogue.
 *
 * The launcher, dock, desktop icons and window manager all read
 * this list. Adding an app is one entry here plus its component
 * file under apps/; nothing else changes (DESKTOP-ARCHITECTURE.md,
 * growth rule 1).
 */

import HomeApp from "../apps/HomeApp.jsx";
import FilesApp from "../apps/FilesApp.jsx";
import TerminalApp from "../apps/TerminalApp.jsx";
import SettingsApp from "../apps/SettingsApp.jsx";
import MonitorApp from "../apps/MonitorApp.jsx";
import NotesApp from "../apps/NotesApp.jsx";
import AboutApp from "../apps/AboutApp.jsx";
import TrashApp from "../apps/TrashApp.jsx";
import ViewerApp from "../apps/ViewerApp.jsx";
import BrowserApp from "../apps/BrowserApp.jsx";
import CalculatorApp, { SettingsSpec as CalculatorSpec } from "../apps/CalculatorApp.jsx";
import TextTransformerApp, { SettingsSpec as TextTransformerSpec } from "../apps/TextTransformerApp.jsx";
import NavGraphApp from "../apps/NavGraphApp.jsx";

export const ICONS = {
  home: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 11 12 4l8 7M6 9.5V20h12V9.5"/></svg>',
  folder: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v11H3zM3 6v13"/></svg>',
  term: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16"/><path d="M7 9l3 3-3 3M12 16h5"/></svg>',
  gear: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
  mon: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12"/><path d="M6 12l3-4 3 5 2.5-3H18M9 20h6M12 16v4"/></svg>',
  note: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/></svg>',
  trash: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>',
  info: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.1"/></svg>',
  file: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v4h4"/></svg>',
  graph: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v4M12 9l-5.5 5M12 9l5.5 5M7 16.5 5 19M17 16.5 19 19"/><circle cx="12" cy="4" r="1.8"/><circle cx="5.5" cy="15.5" r="1.8"/><circle cx="18.5" cy="15.5" r="1.8"/><circle cx="4" cy="20" r="1.4"/><circle cx="20" cy="20" r="1.4"/></svg>',
  patch: '<svg class="ic" viewBox="0 0 24 24"><circle cx="5" cy="5" r="2.6"/><circle cx="19" cy="19" r="2.6"/><path d="M7.5 7.5c5 5 4 4 9 9"/></svg>',
  globe: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18"/></svg>',
  calc: '<svg class="ic" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18"/><path d="M8 7h8M8 12h.1M12 12h.1M16 12h.1M8 16h.1M12 16h.1M16 16h.1"/></svg>',
  kase: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 19 7 5l4 14M4.8 14h4.4"/><circle cx="16.8" cy="14.8" r="3.4"/><path d="M20.2 11.4v7.6"/></svg>',
  group: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="12" height="12"/><path d="M9 21h12V9"/></svg>',
};

export function Icon({ name }) {
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: ICONS[name] || "" }} />;
}

/* defaultW/defaultH mirror the vanilla window sizing. */
export const APPS = [
  { id: "home", name: "Home", icon: "home", hint: "WIN · H", component: HomeApp, defaultW: 480 },
  { id: "files", name: "Files", icon: "folder", hint: "WIN · F", component: FilesApp, defaultW: 620, defaultH: 400 },
  { id: "terminal", name: "Terminal", icon: "term", hint: "CTRL+ALT+T", component: TerminalApp, defaultW: 480, defaultH: 360 },
  { id: "settings", name: "Settings", icon: "gear", hint: "CTRL+,", component: SettingsApp, defaultW: 560 },
  { id: "monitor", name: "Monitor", icon: "mon", hint: "WIN · M", component: MonitorApp, defaultW: 540, defaultH: 440 },
  { id: "notes", name: "Notes", icon: "note", hint: "WIN · N", component: NotesApp, defaultW: 480 },
  { id: "about", name: "About", icon: "info", hint: "SYS", component: AboutApp, defaultW: 480 },
  { id: "trash", name: "Trash", icon: "trash", hint: "0 ITEMS", component: TrashApp, defaultW: 480 },
  { id: "viewer", name: "Patch Viewer", icon: "patch", hint: "PATCH", component: ViewerApp, defaultW: 470, defaultH: 430 },
  { id: "browser", name: "Browser", icon: "globe", hint: "WEB", component: BrowserApp, defaultW: 880, defaultH: 580 },
  { id: "calculator", name: "Calculator", icon: "calc", hint: "UTIL", component: CalculatorApp, settingsSpec: CalculatorSpec, defaultW: 300, defaultH: 430 },
  { id: "texttransformer", name: "TextTransformer", icon: "kase", hint: "UTIL", component: TextTransformerApp, settingsSpec: TextTransformerSpec, defaultW: 560, defaultH: 470 },
  { id: "navgraph", name: "NavGraph", icon: "graph", hint: "LAYER", component: NavGraphApp, defaultW: 760, defaultH: 560 },
];

/* Launch-column groups: a group is a launch item that opens up
 * to show its member apps (the members stay ordinary apps in
 * every other respect — launcher, windows, patching). */
export const GROUPS = [
  { id: "utilities", name: "Utilities", icon: "group", members: ["calculator", "texttransformer"] },
];

export function groupById(id) {
  return GROUPS.find((g) => g.id === id) || null;
}

export function appById(id) {
  return APPS.find((a) => a.id === id) || APPS[0];
}
