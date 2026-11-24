/* NCT-WL-COMPOSITOR — window records model xdg_toplevel state (geometry, stacking, min/max/shade/hide/freeze); these writers use surface-level facts only, never app internals. See WAYLAND-MAP.md. */
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
    stacked: false,
    frozen: false,
    flipped: false,
    seq: w.seq + 1,
    prev: null,
  };
  store.replace("windows", {
    order: [...w.order, id],
    byId: { ...w.byId, [id]: rec },
    stack: w.stack || [],
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
    stack: (w.stack || []).filter((x) => x !== id),
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

/* H: resize the window to the cursor point. The engine works
 * out the section (one of the 8 around the window) and the new
 * geometry; this writer applies it — x/w always, y/h only when
 * the section has a vertical part (v), so a sideways resize of
 * a shaded window leaves its shade and stored height alone,
 * while a vertical one unshades into the new height. A
 * maximised window refuses: restore it first. */
export function resizeTo(id, geo) {
  const rec = store.get().windows.byId[id];
  if (!rec || rec.max) return;
  const p = { x: Math.round(geo.x), w: Math.max(280, Math.round(geo.w)) };
  if (geo.v) {
    p.y = Math.max(0, Math.round(geo.y));
    p.h = Math.max(150, Math.round(geo.h));
    if (rec.shaded) p.shaded = false;
  }
  patch(id, p);
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

/* The WindowTransformerRegion: a collapsed titlebar dragged
 * into the region becomes a list item of its stack. The record
 * keeps its geometry; `stacked` windows render nowhere. */
export function transformWindow(id) {
  const w = store.get().windows;
  const rec = w.byId[id];
  if (!rec || rec.stacked) return;
  store.replace("windows", {
    ...w,
    stack: [...(w.stack || []), id],
    focusId: w.focusId === id ? null : w.focusId,
    byId: { ...w.byId, [id]: { ...rec, stacked: true } },
  });
}

/* Clicking a stack item restores the window to its titlebar at
 * the given desk position; the caller then hands it to
 * drag-lock (nct:lockwin) so it arrives already carried. */
export function restoreFromStack(id, x, y) {
  const w = store.get().windows;
  const rec = w.byId[id];
  if (!rec) return;
  store.replace("windows", {
    ...w,
    stack: (w.stack || []).filter((v) => v !== id),
    byId: { ...w.byId, [id]: { ...rec, stacked: false, shaded: true, x, y, anim: "expand" } },
  });
  focusWindow(id);
}

/* The restore expand animation clears its own flag when it
 * ends, so the class never lingers on the window. */
export function clearAnim(id) {
  const rec = store.get().windows.byId[id];
  if (rec && rec.anim) patch(id, { anim: null });
}

/* Freeze: the window stays exactly where it is and accepts no
 * key or mouse events until unfrozen (the \ key, or the
 * window's context menu). */
export function toggleFrozen(id) {
  const rec = store.get().windows.byId[id];
  if (rec) patch(id, { frozen: !rec.frozen });
}
