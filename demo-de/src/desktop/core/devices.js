/* NCT-WL-KIT — device classes, orientation and breakpoints are the toolkit's responsive layer: hooks native controls carry so layouts adapt per device. See WAYLAND-MAP.md. */
/* Device hooks — the responsive foundation.
 *
 * The system targets desktop, mobile, tablet, and later VR,
 * so controls carry hooks for device class, orientation and
 * breakpoints instead of being designed for one screen. This
 * module is the whole contract:
 *
 *   - device classes: "phone" | "tablet" | "desktop"
 *     (a "vr" class joins later, on the same terms);
 *   - breakpoints by width: phone ≤ 640, tablet ≤ 1024,
 *     desktop above;
 *   - orientation is a modifier, derived from the frame:
 *     width ≥ height is landscape, else portrait;
 *   - a property may carry per-class overrides —
 *     resolveProp({ desktop: 3, tablet: 2, phone: 1 }, cls)
 *     picks the value for the active class (falling back
 *     toward larger classes, then to `base`).
 *
 * useDevice(ref) observes an element and reports the device
 * context it finds itself in; DeviceContext carries that
 * context down to specimens and controls. The UI Showcase's
 * device frame is the reference consumer.
 */

import { createContext, useEffect, useState } from "react";

export const BREAKPOINTS = { phone: 640, tablet: 1024 };
export const DEVICE_CLASSES = ["phone", "tablet", "desktop"];

export function deviceClassForWidth(w) {
  if (w <= BREAKPOINTS.phone) return "phone";
  if (w <= BREAKPOINTS.tablet) return "tablet";
  return "desktop";
}

export function orientationFor(w, h) {
  return w >= h ? "landscape" : "portrait";
}

/* A property value is either plain, or an object keyed by
 * device class (with an optional `base`). Resolution falls
 * back from the active class toward larger ones, then base,
 * then the first defined value. */
export function resolveProp(value, deviceClass) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return value;
  const order = ["phone", "tablet", "desktop"];
  const start = Math.max(0, order.indexOf(deviceClass));
  for (let i = start; i < order.length; i++) {
    if (value[order[i]] !== undefined) return value[order[i]];
  }
  if (value.base !== undefined) return value.base;
  for (const k of order) if (value[k] !== undefined) return value[k];
  return undefined;
}

export const DeviceContext = createContext({
  deviceClass: "desktop", orientation: "landscape", width: 0, height: 0,
});

export function useDevice(ref) {
  const [ctx, setCtx] = useState({ deviceClass: "desktop", orientation: "landscape", width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setCtx({ deviceClass: deviceClassForWidth(w), orientation: orientationFor(w, h), width: w, height: h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return ctx;
}

/* The device frame presets the Showcase offers: named sizes
 * per class and orientation (CSS px, the usual device
 * viewports). A frame is a DEVICE; the class a layout sees
 * is the WIDTH BAND the frame's width falls in — a phone in
 * landscape (844px) lays out in the tablet band, which is how
 * width breakpoints behave on real hardware too. */
export const FRAME_PRESETS = {
  desktop: { landscape: { w: 1280, h: 800 }, portrait: { w: 864, h: 1152 } },
  tablet: { landscape: { w: 1024, h: 560 }, portrait: { w: 768, h: 640 } },
  phone: { landscape: { w: 844, h: 390 }, portrait: { w: 390, h: 640 } },
};
