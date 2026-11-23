/* The cord layer — patch cords drawn over the desk area, above
 * the windows. Cords are SVG beziers between port anchors; an
 * anchor prefers the live port dot and falls back to the owner's
 * edge, so a cord survives its ports being hidden. The wide
 * invisible hit stroke is what the key-clicks engine (A removes)
 * and the right-click menu find at the cursor point.
 */

import { useEffect, useState } from "react";
import { useSlice } from "../core/react.js";
import { portDef } from "../core/patchbay.js";

function anchor(owner, port, deskRect) {
  const dot = document.querySelector(`[data-port="${owner}:${port}"]`);
  if (dot) {
    const r = dot.getBoundingClientRect();
    if (r.width) return { x: r.left + r.width / 2 - deskRect.left, y: r.top + r.height / 2 - deskRect.top };
  }
  const el =
    document.querySelector(`.nwin[data-app="${owner}"]`) ||
    document.querySelector(`[data-patch-owner="${owner}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  const def = portDef(owner, port);
  return {
    x: (def && def.dir === "in" ? r.left : r.right) - deskRect.left,
    y: r.top + r.height / 2 - deskRect.top,
  };
}

function cordPath(a, b) {
  const dx = Math.max(42, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export default function PatchLayer() {
  const patch = useSlice("patch");
  useSlice("windows"); // geometry changes re-anchor the cords
  const [svgEl, setSvgEl] = useState(null);
  const [mouse, setMouse] = useState(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    document.body.classList.toggle("patch-pending", !!patch.pending);
    return () => document.body.classList.remove("patch-pending");
  }, [patch.pending]);

  useEffect(() => {
    if (!patch.pending) return undefined;
    const mv = (e) => {
      if (!svgEl) return;
      const r = svgEl.getBoundingClientRect();
      setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    document.addEventListener("mousemove", mv);
    return () => document.removeEventListener("mousemove", mv);
  }, [patch.pending, svgEl]);

  useEffect(() => {
    const rz = () => setTick((t) => t + 1);
    window.addEventListener("resize", rz);
    return () => window.removeEventListener("resize", rz);
  }, []);

  if (!svgEl && patch.cords.length === 0 && !patch.pending) {
    return <svg ref={setSvgEl} className="patch-layer" aria-hidden="true" />;
  }
  const deskRect = svgEl ? svgEl.getBoundingClientRect() : { left: 0, top: 0 };
  const pendA = patch.pending ? anchor(patch.pending.owner, patch.pending.port, deskRect) : null;

  return (
    <svg ref={setSvgEl} className="patch-layer" aria-hidden="true">
      {patch.cords.map((c) => {
        const a = anchor(c.from.owner, c.from.port, deskRect);
        const b = anchor(c.to.owner, c.to.port, deskRect);
        if (!a || !b) return null;
        const d = cordPath(a, b);
        return (
          <g key={c.id}>
            <path className="cord-hit" data-cord={c.id} d={d} />
            <path className="cord-line" d={d} />
            <circle className="cord-end" cx={a.x} cy={a.y} r={3} />
            <circle className="cord-end" cx={b.x} cy={b.y} r={3} />
          </g>
        );
      })}
      {patch.pending && pendA && mouse && (
        <path className="cord-line cord-pending" d={cordPath(pendA, mouse)} />
      )}
    </svg>
  );
}
