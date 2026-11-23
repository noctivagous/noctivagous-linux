/* NavGraph — a desktop-layer app: the file system drawn on the
 * desk itself, no window. Two layouts over one hierarchy, adapted
 * from the Observable d3 charts (@d3/radial-cluster/2 and
 * @d3/tree/2) and fitted to the desk area: a radial cluster and a
 * horizontal tidy tree, switched by the toggle in the layer's own
 * control bar. Folders are green circles (click to collapse or
 * expand; a dashed ring counts what is hidden), files are blue
 * diamonds (click for their facts). Depth reads as faint rings in
 * radial mode and as guide lines in tree mode — the drawing uses
 * the layer it lives on.
 *
 * Layout math is d3-hierarchy's (cluster / tree) with d3-shape
 * link generators; React owns the DOM, as everywhere in the shell.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, cluster, tree } from "d3-hierarchy";
import { linkRadial, linkHorizontal } from "d3-shape";
import { fsTree } from "../services/fs.js";
import { closeLayer } from "../core/layers.js";
import { toast } from "../core/bus.js";

const hasKids = (d) => !!(d.children && d.children.length);
/* Nodes hidden under a collapsed folder: everything below it,
 * following both the live and the shelved child lists. */
const hiddenCount = (d) =>
  [...(d.children || []), ...(d._children || [])].reduce(
    (n, c) => n + 1 + hiddenCount(c),
    0,
  );

export default function NavGraphLayer() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState("radial");
  const [, setTick] = useState(0);
  const [hoverPath, setHoverPath] = useState("/home/noctivagous");
  const root = useMemo(() => hierarchy(fsTree()), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function nodeClick(d) {
    if (d.data.kind === "folder") {
      if (hasKids(d)) { d._children = d.children; d.children = null; }
      else if (d._children) { d.children = d._children; d._children = null; }
      setTick((t) => t + 1);
    } else {
      toast(d.data.name + " — " + d.data.size + " · " + d.data.type);
    }
  }

  const { w, h } = size;
  let links = [], nodes = [], rings = [], guides = [], chartTransform = "";
  if (w > 0) {
    if (mode === "radial") {
      // Centre on the desk's open quarter (right and low, where
      // the default window cascade is not), and cap the radius so
      // the top labels clear the control bar.
      const cx = w * 0.58, cy = h * 0.55;
      const radius = Math.max(80, Math.min(Math.min(w, h) / 2 - 108, cy - 88));
      cluster().size([Math.PI * 2, radius])(root);
      const radial = linkRadial().angle((d) => d.x).radius((d) => d.y);
      links = root.links().map((l) => ({ key: l.target.data.path, d: radial(l) }));
      rings = [...new Set(root.descendants().map((d) => d.y))].filter((r) => r > 0);
      chartTransform = `translate(${cx},${cy})`;
      nodes = root.descendants().map((d) => {
        const leafSide = d.x < Math.PI === !hasKids(d);
        return {
          key: d.data.path, d,
          transform: `rotate(${(d.x * 180) / Math.PI - 90}) translate(${d.y},0)`,
          textTransform: d.x >= Math.PI ? "rotate(180)" : undefined,
          textAnchor: leafSide ? "start" : "end",
          textX: leafSide ? 8 : -8,
          textDy: "0.31em",
        };
      });
    } else {
      // The tree grows right from the edge of the default window
      // cascade, so the root and first depth stay in the open.
      const originX = Math.min(Math.round(w * 0.5), w - 380);
      tree().size([Math.max(120, h - 170), Math.max(160, w - originX - 210)])(root);
      const horiz = linkHorizontal().x((d) => d.y).y((d) => d.x);
      links = root.links().map((l) => ({ key: l.target.data.path, d: horiz(l) }));
      guides = [...new Set(root.descendants().map((d) => d.y))];
      chartTransform = `translate(${originX},86)`;
      nodes = root.descendants().map((d) => ({
        key: d.data.path, d,
        transform: `translate(${d.y},${d.x})`,
        textTransform: undefined,
        // The root's label goes under its node: to its left is
        // where the window cascade lives.
        textAnchor: d.depth === 0 ? "middle" : hasKids(d) ? "end" : "start",
        textX: d.depth === 0 ? 0 : hasKids(d) ? -9 : 9,
        textDy: d.depth === 0 ? "1.7em" : "0.31em",
      }));
    }
  }

  return (
    <div className="ng-layer" ref={ref}>
      <div className="ng-bar">
        <span className="ng-title">NAVGRAPH</span>
        <div className="ng-switch" role="group" aria-label="Layout">
          <button className={mode === "radial" ? "on" : ""} onClick={() => setMode("radial")}>RADIAL</button>
          <button className={mode === "tree" ? "on" : ""} onClick={() => setMode("tree")}>TREE</button>
        </div>
        <span className="ng-legend">
          <i className="lg-folder"></i>Folder
          <i className="lg-file"></i>File
        </span>
        <button className="ng-close" aria-label="Close NavGraph" onClick={closeLayer}>✕</button>
      </div>
      {w > 0 && (
        <svg className="ng-svg" width={w} height={h} key={mode}>
          <g transform={chartTransform}>
            {mode === "radial"
              ? rings.map((r) => <circle key={r} className="ng-ring" r={r} />)
              : guides.map((x) => (
                  <line key={x} className="ng-guide" x1={x} x2={x} y1={-52} y2={h - 190} />
                ))}
            {links.map((l) => <path key={l.key} className="ng-link" d={l.d} />)}
            {nodes.map((n) => {
              const d = n.d;
              const folder = d.data.kind === "folder";
              const collapsed = folder && !hasKids(d) && !!(d._children && d._children.length);
              return (
                <g key={n.key} className={"ng-node " + (folder ? "folder" : "file")}
                  transform={n.transform} tabIndex={0}
                  onClick={() => nodeClick(d)}
                  onMouseEnter={() => setHoverPath(d.data.path)}>
                  <title>{d.data.path}</title>
                  {folder ? (
                    <>
                      {collapsed && <circle className="ng-collapsed-ring" r={10.5} />}
                      <circle className="ng-dot-folder" r={5.5} />
                    </>
                  ) : (
                    <rect className="ng-dot-file" x={-4.2} y={-4.2} width={8.4} height={8.4} transform="rotate(45)" />
                  )}
                  <text dy={n.textDy} x={n.textX} textAnchor={n.textAnchor} transform={n.textTransform}>
                    {d.data.name}
                    {collapsed ? " +" + hiddenCount(d) : ""}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
      <div className="ng-path mono">{hoverPath}</div>
    </div>
  );
}
