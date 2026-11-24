/* Window manager actions — the windows slice's only writers.
 *
 * Window records: {x, y, w, h, z, min, max, shaded, vshaded, hidden, seq, prev}.
 * `hidden` is the G-key state: the window is not displayed but
 * the app stays open and mounted (unlike close, unlike min it
 * is driven from the app's icon as a hide/show toggle).
 * Geometry lives in the store (not in component state) because the
 * taskbar, the window frames and key-clicks' D-back all read the
 * same table. Rendering is shell/Window.jsx.
 */

import { store } from "./store.js";
import { appById } from "./registry.jsx";

let cascade = 0;

function patch(id, p) {
  const w = store.get().windows;
  store.replace("windows", {
    ...w,
    byId: { ...w.byId, [id]: { ...w.byId[id], ...p } },
  });
}

export function openWindow(id) {
  const w = store.get().windows;
  if (w.byId[id]) {
    patch(id, { min: false, hidden: false });
    focusWindow(id);
    return;
  }
  const ap = appById(id);
  cascade = (cascade + 1) % 5;
  const defW = ap.defaultW || 480;
  const width = Math.min(defW, window.innerWidth - 16);
  const rec = {
    x: Math.min(28 + cascade * 26, Math.max(0, window.innerWidth - defW - 10)),
    y: 14 + cascade * 24,
    w: width,
    h: ap.defaultH ? Math.min(ap.defaultH, window.innerHeight - 110) : null,
    z: w.zTop + 1,
    min: false,
    max: false,
    shaded: false,
    vshaded: false,
    hidden: false,
    flipped: false,
    seq: w.seq + 1,
    prev: null,
  };
  store.replace("windows", {
    order: [...w.order, id],
    byId: { ...w.byId, [id]: rec },
    focusId: id,
    zTop: w.zTop + 1,
    seq: w.seq + 1,
  });
}

export function closeWindow(id) {
  const w = store.get().windows;
  const byId = { ...w.byId };
  delete byId[id];
  store.replace("windows", {
    ...w,
    order: w.order.filter((x) => x !== id),
    byId,
    focusId: w.focusId === id ? null : w.focusId,
  });
}

export function focusWindow(id) {
  const w = store.get().windows;
  if (!w.byId[id]) return;
  const z = w.zTop + 1;
  store.replace("windows", {
    ...w,
    focusId: id,
    zTop: z,
    byId: { ...w.byId, [id]: { ...w.byId[id], z, min: false, hidden: false } },
  });
}

export function minimizeWindow(id) {
  patch(id, { min: true });
}

export function toggleShade(id) {
  const rec = store.get().windows.byId[id];
  if (rec) patch(id, { shaded: !rec.shaded });
}

export function toggleMax(id) {
  const rec = store.get().windows.byId[id];
  if (!rec) return;
  if (!rec.max) {
    patch(id, {
      prev: { x: rec.x, y: rec.y, w: rec.w, h: rec.h },
      x: 0,
      y: 0,
      w: null, // null w/h = fill the desk area (maximised)
      h: null,
      max: true,
    });
  } else if (rec.prev) {
    patch(id, { ...rec.prev, max: false, prev: null });
  }
}

export function moveWindow(id, x, y) {
  patch(id, { x, y });
}

export function resizeWindow(id, w, h) {
  const rec = store.get().windows.byId[id];
  if (!rec) return;
  patch(id, {
    w: Math.max(280, Math.round(w)),
    h: Math.max(150, Math.round(h)),
  });
}

/** Vertical shade (the T key): the window becomes a vertical
 * titlebar whose height stays the window's full height; w/h are
 * kept untouched so restoring is exact. */
export function setVShade(id, on) {
  const rec = store.get().windows.byId[id];
  if (!rec) return;
  patch(id, { vshaded: !!on, shaded: on ? false : rec.shaded });
}

/* P flips a window onto its back, where its ports live. */
export function setFlipped(id, on) {
  patch(id, { flipped: on });
}

export function showDesktop() {
  const w = store.get().windows;
  const byId = {};
  Object.keys(w.byId).forEach((id) => (byId[id] = { ...w.byId[id], min: true }));
  store.replace("windows", { ...w, byId });
}

export function clearWindows() {
  store.replace("windows", { order: [], byId: {}, focusId: null, zTop: 10, seq: 0 });
}

/* G: hide/show. Hiding keeps the record (and the mounted app);
 * showing brings the window back focused. */
export function toggleHidden(id) {
  const w = store.get().windows;
  const rec = w.byId[id];
  if (!rec) return;
  if (rec.hidden) {
    patch(id, { hidden: false });
    focusWindow(id);
  } else {
    store.replace("windows", {
      ...w,
      focusId: w.focusId === id ? null : w.focusId,
      byId: { ...w.byId, [id]: { ...rec, hidden: true } },
    });
  }
}
