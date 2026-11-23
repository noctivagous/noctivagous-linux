/* The port dots on an owner's edges — inputs on the left,
 * outputs on the right, appended to the edge itself. One
 * component for windows and desktop widgets alike; presses go to
 * the patchbay, which owns pending/cord state. While a cord is
 * being drawn, ports that could complete it (the opposite
 * direction) wear the .compat glow.
 */

import { ownerPorts, portPressed, portDef } from "../core/patchbay.js";
import { useSlice } from "../core/react.js";

export default function PortDots({ owner }) {
  const patch = useSlice("patch");
  const ports = ownerPorts(owner);
  if (!ports.length) return null;
  const pend = patch.pending;
  const pendDef = pend ? portDef(pend.owner, pend.port) : null;

  function render(p, i, n) {
    const isPend = !!pend && pend.owner === owner && pend.port === p.id;
    const compat = !!pend && !isPend && !!pendDef && pendDef.dir !== p.dir;
    return (
      <button
        key={p.id}
        type="button"
        className={"pdot " + p.dir + (isPend ? " pending" : "") + (compat ? " compat" : "")}
        data-port={owner + ":" + p.id}
        data-owner={owner}
        data-pdir={p.dir}
        style={{ top: `calc(50% + ${(i - (n - 1) / 2) * 24}px)` }}
        title={`${p.label} · ${p.dir === "out" ? "output" : "input"} — F or click to ${pend ? "connect" : "start a cord"}`}
        aria-label={`${owner} port ${p.label}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          portPressed(owner, p.id);
        }}
      >
        <span className="pdot-tip">{p.label}</span>
      </button>
    );
  }

  return (
    <>
      {ports.filter((p) => p.dir === "in").map((p, i, arr) => render(p, i, arr.length))}
      {ports.filter((p) => p.dir === "out").map((p, i, arr) => render(p, i, arr.length))}
    </>
  );
}
