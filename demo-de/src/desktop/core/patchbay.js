/* The patchbay — "Wiring Up The Windows" (refs/
 * nctos-wiringupthewindows.txt) as a desktop service.
 *
 * Windows and desktop elements (the clock widget, the load
 * widget) publish their capabilities as PORTS: outputs that emit
 * data or events, inputs that receive them. The user wires an
 * output to an input with a patch CORD; when the source
 * publishes, the value travels every cord out of that port and is
 * delivered to the input at the other end (a window event,
 * nct:deliver, which the owning app applies).
 *
 * Port kinds: a "value" port delivers only when its value
 * changes (state — notes text, wallpaper, cpu), which also keeps
 * a window wired to itself from looping; an "event" port
 * delivers every publication (the clock's tick, a terminal
 * command).
 *
 * State lives in the store's patch slice: which owners show
 * their ports, the cords, the cord being drawn (pending), the
 * viewer's watch target, the last value at every port, and a
 * short delivery log. The key-clicks engine reaches this module
 * only through the nct:patch bridge (see attachPatchbay), the
 * same host-bridge pattern as the window actions.
 */

import { store } from "./store.js";
import { toast } from "./bus.js";
import { setSetting } from "./react.js";

export const PORTS = {
  clock: [
    { id: "tick", dir: "out", label: "Tick (1s)", type: "event" },
  ],
  sysload: [
    { id: "cpu", dir: "out", label: "CPU %", type: "value" },
    { id: "mem", dir: "out", label: "Memory %", type: "value" },
  ],
  home: [
    { id: "user", dir: "out", label: "User", type: "value" },
    { id: "status", dir: "in", label: "Status line", type: "value" },
  ],
  files: [
    { id: "selected", dir: "out", label: "Selected item", type: "value" },
    { id: "folder", dir: "out", label: "Folder (out)", type: "value" },
    { id: "folder-in", dir: "in", label: "Go to folder", type: "value" },
  ],
  terminal: [
    { id: "command", dir: "out", label: "Command run", type: "event" },
    { id: "run", dir: "in", label: "Run command", type: "value" },
  ],
  notes: [
    { id: "text", dir: "out", label: "Text (out)", type: "value" },
    { id: "text-in", dir: "in", label: "Text (in)", type: "value" },
  ],
  browser: [
    { id: "url", dir: "out", label: "Current URL", type: "value" },
    { id: "visit", dir: "in", label: "Visit URL", type: "value" },
  ],
  monitor: [
    { id: "cpu", dir: "out", label: "CPU %", type: "value" },
  ],
  settings: [
    { id: "wallpaper", dir: "out", label: "Wallpaper (out)", type: "value" },
    { id: "wallpaper-in", dir: "in", label: "Set wallpaper", type: "value" },
  ],
};

export const portDef = (owner, port) =>
  (PORTS[owner] || []).find((p) => p.id === port) || null;
export const ownerPorts = (owner) => PORTS[owner] || [];
export const keyOf = (owner, port) => owner + ":" + port;

const patch = () => store.get().patch;
const setPatch = (p) => store.set("patch", p);
let cordSeq = 0;

/* ---------- ports visibility ---------- */

export function togglePorts(owner) {
  if (!PORTS[owner]) return;
  const openFor = { ...patch().openFor };
  openFor[owner] = !openFor[owner];
  setPatch({ openFor });
}
export function showAllPorts() {
  const openFor = {};
  Object.keys(PORTS).forEach((o) => { openFor[o] = true; });
  setPatch({ openFor });
}
export function hideAllPorts() {
  setPatch({ openFor: {} });
}

/* ---------- cords ---------- */

export function portPressed(owner, port) {
  const def = portDef(owner, port);
  if (!def) return;
  const st = patch();
  const pend = st.pending;
  if (!pend) {
    setPatch({ pending: { owner, port } });
    return;
  }
  if (pend.owner === owner && pend.port === port) {
    setPatch({ pending: null });
    return;
  }
  const fromDef = portDef(pend.owner, pend.port);
  let from = pend, to = { owner, port };
  if (fromDef && fromDef.dir === "in" && def.dir === "out") {
    from = { owner, port };
    to = pend;
  } else if (!(fromDef && fromDef.dir === "out" && def.dir === "in")) {
    toast("Cords run from an output to an input.");
    return;
  }
  const exists = st.cords.some(
    (c) => c.from.owner === from.owner && c.from.port === from.port &&
           c.to.owner === to.owner && c.to.port === to.port,
  );
  if (!exists) {
    cordSeq += 1;
    setPatch({
      cords: [...st.cords, { id: "cord" + cordSeq, from, to }],
      pending: null,
    });
    // A fresh cord carries the source's current value at once.
    const v = st.values[keyOf(from.owner, from.port)];
    if (v !== undefined) deliver(from, to, v, "cord" + cordSeq);
  } else {
    setPatch({ pending: null });
  }
}

export function cancelPending() {
  if (patch().pending) setPatch({ pending: null });
}
export function removeCord(id) {
  setPatch({ cords: patch().cords.filter((c) => c.id !== id) });
}
export function disconnectPort(owner, port) {
  setPatch({
    cords: patch().cords.filter(
      (c) => !(c.from.owner === owner && c.from.port === port) &&
             !(c.to.owner === owner && c.to.port === port),
    ),
  });
}
export function clearCords() {
  setPatch({ cords: [], pending: null });
}
export function cordsTouching(owner, port) {
  return patch().cords.filter(
    (c) => (c.from.owner === owner && c.from.port === port) ||
           (c.to.owner === owner && c.to.port === port),
  );
}

/* ---------- data flow ---------- */

function deliver(from, to, value, cordId) {
  const st = patch();
  const values = { ...st.values, [keyOf(to.owner, to.port)]: value };
  const entry = {
    at: Date.now(),
    cordId: cordId || null,
    from: { ...from },
    to: { ...to },
    value,
  };
  setPatch({ values, log: [...st.log.slice(-39), entry] });
  window.dispatchEvent(
    new CustomEvent("nct:deliver", {
      detail: { owner: to.owner, port: to.port, value, from },
    }),
  );
}

export function publish(owner, port, value) {
  const def = portDef(owner, port);
  if (!def || def.dir !== "out") return;
  const st = patch();
  const k = keyOf(owner, port);
  const changed = st.values[k] !== value;
  if (changed) setPatch({ values: { ...st.values, [k]: value } });
  if (def.type === "value" && !changed) return; // state ports: no echo
  st.cords
    .filter((c) => c.from.owner === owner && c.from.port === port)
    .forEach((c) => deliver({ owner, port }, c.to, value, c.id));
}

/* Send a value into an input from the viewer (or a test). */
export function inject(owner, port, value) {
  const def = portDef(owner, port);
  if (!def || def.dir !== "in") return;
  deliver({ owner: "viewer", port: "inject" }, { owner, port }, value, null);
}

/* Apps subscribe to their own deliveries with this. */
export function onDeliver(owner, port, fn) {
  const h = (e) => {
    const d = e.detail || {};
    if (d.owner === owner && d.port === port) fn(d.value, d.from);
  };
  window.addEventListener("nct:deliver", h);
  return () => window.removeEventListener("nct:deliver", h);
}

/* ---------- viewer ---------- */

export function setWatch(watch) {
  setPatch({ watch });
}
export function clearLog() {
  setPatch({ log: [] });
}

/* ---------- built-in sources and sinks ----------
 * The clock and the load widget publish from the shell; Settings
 * is wired here, at the store: its wallpaper is a setting, so
 * publishing and applying need no app code. */

function applyBuiltin(owner, port, value) {
  if (owner === "settings" && port === "wallpaper-in") {
    const n = Math.round(Number(value));
    if (Number.isFinite(n) && n >= 0 && n <= 2 && store.get().settings.wallpaper !== n) {
      setSetting("wallpaper", n);
    }
  }
}

export function attachPatchbay() {
  function onPatch(e) {
    const d = e.detail || {};
    if (d.op === "togglePorts" && d.owner) togglePorts(d.owner);
    else if (d.op === "cancelPending") cancelPending();
    else if (d.op === "removeCord" && d.id) removeCord(d.id);
  }
  window.addEventListener("nct:patch", onPatch);

  let lastWallpaper = store.get().settings.wallpaper;
  let lastLoad = store.get().ui.load || {};
  const offStore = store.subscribe(() => {
    const st = store.get();
    if (st.settings.wallpaper !== lastWallpaper) {
      lastWallpaper = st.settings.wallpaper;
      publish("settings", "wallpaper", lastWallpaper);
    }
    const load = st.ui.load || {};
    if (load.cpu !== lastLoad.cpu) publish("sysload", "cpu", load.cpu);
    if (load.mem !== lastLoad.mem) publish("sysload", "mem", load.mem);
    lastLoad = load;
  });
  const offDeliver = onDeliver("settings", "wallpaper-in", (v) =>
    applyBuiltin("settings", "wallpaper-in", v),
  );
  publish("settings", "wallpaper", lastWallpaper);
  return () => {
    window.removeEventListener("nct:patch", onPatch);
    offStore();
    offDeliver();
  };
}
