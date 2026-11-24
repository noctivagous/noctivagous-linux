/* A specimen card: the unit of the UI Showcase library.
 *
 * Every specimen is LIVE (the control actually works), shows
 * its demo box's measured size (layout claims here are
 * measured, not eyeballed), and — where the specimen has
 * properties — edits them through the stock settings kit,
 * the same inspector the GUI builder will use. Alignment and
 * friends are properties of the widget, set here, not styling
 * sprinkled on by each app.
 */

import { useEffect, useRef, useState } from "react";
import { SettingsKit } from "../settingsKit.jsx";

export function Specimen({ title, note, kit, children }) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="spec-card">
      <div className="spec-head">
        <span className="spec-title">{title}</span>
        <span className="spec-measure mono">{size ? size.w + " × " + size.h + " px" : ""}</span>
      </div>
      <div className="spec-demo" ref={ref}>{children}</div>
      {note && <div className="spec-note">{note}</div>}
      {kit && (
        <div className="spec-kit">
          <SettingsKit spec={kit.spec} value={kit.value} onChange={kit.onChange} />
        </div>
      )}
    </div>
  );
}
