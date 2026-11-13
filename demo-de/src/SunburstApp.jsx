import { useEffect, useMemo, useRef, useState } from "react";
import SunburstView from "./SunburstView.jsx";
import { FLARE } from "./sunburst-data.js";
import {
  buildSunburst,
  descendants as sunburstDescendants,
  ancestors as sunburstAncestors,
  labelVisible,
  sunburstColourScale,
} from "../NCTGraphite/packages/nctgraphite/src/sunburst/NCTGraphiteSunburstLayout.ts";
import { formatDataPath } from "../NCTGraphite/packages/nctgraphite/src/datatree/NCTGraphiteDataTree.ts";
import {
  NCTParameterPanel,
  useNCTParameters,
} from "../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";

/**
 * Zoomable sunburst, in 3D, by key-click — sunburst.html.
 *
 * The second ZUI viewer from d3-js-uses.txt, and the second
 * instance of its "3D Spatial" frame (three.js + d3.js: a d3 chart
 * ported to 3D). Bostock's disc becomes a terraced mesa; the zoom
 * mathematics is the original's, so descending feels the way the 2D
 * gallery piece feels — only now the rings have height and the disc
 * sits in space. Every labelled slice carries a key: type it to
 * descend (branches) or to read the slice out (leaves). Esc, or a
 * click on the centre pillar, climbs back out — the original's
 * centre-circle gesture, rebuilt as a piece of the furniture.
 */

const PARAM_DEFS = [
  { id: "terrace", label: "Terrace height", type: "number", min: 0, max: 24, step: 1, defaultValue: 9 },
  { id: "gap", label: "Ring gap", type: "number", min: 0, max: 5, step: 0.25, defaultValue: 1.5 },
  { id: "labelsOn", label: "Key labels", type: "boolean", defaultValue: true },
  { id: "drift", label: "Camera drift", type: "boolean", defaultValue: true },
];

const keyLabel = (i) => {
  let s = "";
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};

const fmt = (n) => n.toLocaleString("en-US");

const css = `
.sb-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.sb-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.sb-head h1 { font-size:17px; letter-spacing:2px; color:#e8f3ee; margin:0; }
.sb-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.sb-nav a.here { color:#ffa726; }
.sb-sub { padding:0 20px 10px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.sb-main { display:flex; gap:14px; margin:0 20px; align-items:stretch; }
.sb-stage { flex:1; border:1px solid #2c3a41; border-radius:6px; overflow:hidden; min-width:0; height:560px; }
.sb-rail { width:296px; flex:none; display:flex; flex-direction:column; gap:14px; }
.sb-box { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; }
.sb-box h3 { margin:0 0 8px; font-size:10.5px; letter-spacing:2px; color:#e8f3ee; font-weight:bold; }
.sb-readout { font-family:Consolas, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; white-space:pre-wrap; word-break:break-word; }
.sb-readout .k { color:#ffa726; }
.sb-keyline { font-family:Consolas, monospace; font-size:11.5px; color:#8fa3ab; }
.sb-keyline b { color:#ffa726; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:118px; }
.nct-parameter output { font-family:Consolas, monospace; color:#ffa726; min-width:30px; text-align:right; }
.sun-chip { position:absolute; left:0; top:0; pointer-events:auto; font-family:Consolas, monospace; font-size:9.5px;
  letter-spacing:.5px; padding:1px 4px; border-radius:3px; border:1px solid rgba(255,167,38,.65);
  background:rgba(6,12,14,.82); color:#ffa726; cursor:pointer; will-change:transform; }
.sun-chip:hover { background:#ffa726; color:#0b0e10; }
.sun-chip.sel { background:#ffa726; color:#0b0e10; font-weight:bold; }
.figcap { margin:8px 20px 0; font-size:11.5px; line-height:17px; color:#8fa3ab; }
.figcap b { color:#cfd8dc; letter-spacing:1.5px; font-size:10.5px; }
.print { margin:24px 20px 34px; border-top:3px double #45565e; padding-top:18px; color:#d7dee2; font-family:Georgia, 'Times New Roman', serif; }
.print .kicker { font-family:Tahoma, sans-serif; font-size:10.5px; letter-spacing:3px; color:#ffa726; text-transform:uppercase; }
.print h2 { font-size:28px; line-height:34px; margin:8px 0 6px; font-weight:normal; color:#eef4f1; }
.print .standfirst { font-size:15px; line-height:24px; font-style:italic; color:#aebcc2; max-width:620px; margin:0 0 14px; }
.print .rule { border-top:1px solid #45565e; margin:0 0 16px; }
.print .cols { column-count:3; column-gap:28px; column-rule:1px solid #2c3a41; font-size:13.5px; line-height:24px; text-align:justify; }
.print .cols p { margin:0 0 24px; }
.print .cols h3 { font-size:12px; letter-spacing:2px; font-family:Tahoma, sans-serif; color:#7fd4c1; margin:0 0 6px; break-after:avoid; }
.print .index { margin-top:6px; }
.print .index h3 { font-size:12px; letter-spacing:2px; font-family:Tahoma, sans-serif; color:#7fd4c1; margin:0 0 10px; }
.print .house { background:none; border:none; color:#cfd8dc; font:inherit; cursor:pointer; padding:0 4px 0 0; font-size:13px; line-height:24px; }
.print .house:hover { color:#ffa726; text-decoration:underline; }
.print .house .sw { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:7px; }
.print .house .meta { font-family:Consolas, monospace; font-size:10.5px; color:#8fa3ab; }
`;

export default function SunburstApp() {
  const root = useMemo(() => buildSunburst(FLARE), []);
  const colourOf = useMemo(
    () => sunburstColourScale(root.children.map((c) => c.name)),
    [root],
  );
  const { values } = useNCTParameters(PARAM_DEFS);
  const [focusNode, setFocusNode] = useState(root);
  const [centreNode, setCentreNode] = useState(root);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [zoomReq, setZoomReq] = useState(null);
  const [labelsTick, setLabelsTick] = useState(0);
  const [buffer, setBuffer] = useState("");
  const bufferTimer = useRef(null);
  const nonce = useRef(0);

  const requestZoom = (node) => {
    setFocusNode(node);
    setCentreNode(node.parent ?? root);
    setSelected(null);
    nonce.current += 1;
    setZoomReq({ node, n: nonce.current });
  };

  // Keys belong to the slices the current zoom leaves labelled, in
  // reading order (ring, then angle), exactly as the labels are drawn.
  const keyTargets = useMemo(() => {
    const visible = sunburstDescendants(root)
      .filter((n) => n !== root && labelVisible(n.target))
      .sort((a, b) => a.target.y0 - b.target.y0 || a.target.x0 - b.target.x0);
    return visible.map((node, i) => ({ node, key: keyLabel(i) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, labelsTick, focusNode]);
  const nodeByKey = useMemo(
    () => new Map(keyTargets.map((t) => [t.key, t.node])),
    [keyTargets],
  );

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        setBuffer("");
        if (focusNode !== root) requestZoom(centreNode);
        else setSelected(null);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        const next = (buffer + e.key.toUpperCase()).slice(-2);
        const exact = nodeByKey.get(next);
        const isPrefix = [...nodeByKey.keys()].some((k) => k.startsWith(next));
        if (exact && (!isPrefix || next.length === 2)) {
          if (exact.children.length) requestZoom(exact);
          else setSelected(exact);
          setBuffer("");
        } else if (isPrefix) {
          setBuffer(next);
          clearTimeout(bufferTimer.current);
          bufferTimer.current = setTimeout(() => setBuffer(""), 800);
        } else {
          setBuffer("");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, nodeByKey, focusNode, centreNode, root]);

  const pathOf = (node) => sunburstAncestors(node).map((n) => n.name).join(" / ");
  const indexPathOf = (node) => {
    const parts = [];
    let n = node;
    while (n.parent) {
      parts.unshift(n.parent.children.indexOf(n));
      n = n.parent;
    }
    return formatDataPath(parts);
  };
  const shown = hovered ?? selected;
  const total = root.value;

  return (
    <div className="sb-page">
      <style>{css}</style>
      <div className="sb-head">
        <h1>DEMO-DE · ZUI VIEWER Nº 2</h1>
        <nav className="sb-nav">
          <a href="./">key-clicks</a>
          <a href="./react.html">shell + panelization</a>
          <a href="./definition.html">definition</a>
          <a href="./tangled.html">tangled tree 3D</a>
          <a className="here" href="./sunburst.html">sunburst 3D</a>
        </nav>
      </div>
      <p className="sb-sub">
        Bostock's zoomable sunburst — the second ZUI viewer named in <i>d3-js-uses.txt</i> — ported
        to 3D: the disc is a terraced mesa, inner rings standing higher, and the zoom is the
        original's own mathematics. Type a slice's key to descend into it; a leaf's key reads the
        slice out instead. Esc, or the centre pillar, climbs back out.
      </p>
      <div className="sb-main">
        <div className="sb-stage">
          <SunburstView
            root={root}
            colourOf={colourOf}
            terrace={values.terrace}
            gap={values.gap}
            labelsOn={values.labelsOn}
            drift={values.drift}
            zoomReq={zoomReq}
            keyTargets={keyTargets}
            selected={selected}
            focusNode={focusNode}
            onZoomNode={requestZoom}
            onSelect={setSelected}
            onCentre={() => { if (focusNode !== root) requestZoom(centreNode); }}
            onHover={setHovered}
            onSettled={() => setLabelsTick((t) => t + 1)}
          />
        </div>
        <div className="sb-rail">
          <div className="sb-box">
            <h3>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS} />
          </div>
          <div className="sb-box">
            <h3>READOUT</h3>
            <div className="sb-readout">
              <span className="k">INSIDE</span>{"  "}{pathOf(focusNode)}{"\n"}
              <span className="k">VALUE</span>{"   "}{fmt(focusNode.value)} ({((focusNode.value / total) * 100).toFixed(1)}% of flare){"\n"}
              <span className="k">HOLDS</span>{"   "}{focusNode.children.length} branches · depth {focusNode.depth}{"\n"}
              {shown ? (
                <>
                  <span className="k">{hovered ? "HOVER" : "LEAF"}</span>{"   "}{shown.name}{"\n"}
                  <span className="k">PATH</span>{"    "}{pathOf(shown)}{"\n"}
                  <span className="k">TREE</span>{"    "}{indexPathOf(shown)}{"\n"}
                  <span className="k">VALUE</span>{"   "}{fmt(shown.value)} ({((shown.value / total) * 100).toFixed(2)}% of flare
                  {shown.parent ? `, ${((shown.value / shown.parent.value) * 100).toFixed(1)}% of ${shown.parent.name}` : ""}){"\n"}
                  <span className="k">KIND</span>{"    "}{shown.children.length ? `branch — ${shown.children.length} children; its key descends` : "leaf — an endpoint class"}
                </>
              ) : (
                <><span className="k">SLICE</span>{"   "}— type a key, or point —</>
              )}
            </div>
          </div>
          <div className="sb-box">
            <h3>KEY-CLICKS</h3>
            <p className="sb-keyline">
              buffer: <b>{buffer || "—"}</b>{" · "}branch key = descend{" · "}leaf key = read out{" · "}
              <b>Esc</b> = climb
            </p>
          </div>
        </div>
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — The zoomable sunburst of the Flare class hierarchy (252 classes),
        terraced in three.js. The palette is the original's interpolateRainbow, ported
        colour for colour; each slice takes the colour of its house, the depth-1 branch
        it descends from.
      </p>

      <div className="print">
        <div className="kicker">ZUI viewers · the 3D spatial frame · nº 2</div>
        <h2>A hierarchy you descend into</h2>
        <p className="standfirst">
          The sunburst is the desktop's oldest question — what contains what, and how much
          of it is there — drawn as a disc of rings. In two dimensions you click to zoom.
          In space, the rings stand up as terraces, and the zoom becomes a descent.
        </p>
        <div className="rule" />
        <div className="cols">
          <div>
            <h3>THE ORIGINAL</h3>
            <p>
              Mike Bostock's zoomable sunburst, from the D3 gallery, shows two layers of a
              hierarchy at a time. Each slice's arc is its share of the whole; click a slice
              and the disc re-draws itself inside that slice's frame — its children become
              the rings, its grandchildren their contents — while the centre circle holds
              the way back out. The dataset is the Flare library's own class tree: 252
              classes in ten houses, sized by their code. Nothing about the drawing is
              decorative; the geometry is the data, twice over, in angle and in radius.
            </p>
          </div>
          <div>
            <h3>THE CONVERSION</h3>
            <p>
              The framing document for this distribution, <i>d3-js-uses.txt</i>, names the
              Sequences Sunburst among its ZUI viewers and defines the frame used here:
              3D Spatial — three.js + d3.js, d3 charts ported to 3D. The port keeps the
              original's mathematics untouched — the partition, the zoom re-mapping, the
              two-ring visibility rule, even the cubehelix rainbow, carried over constant
              for constant — and changes the rendering: slices are solid terraces, inner
              rings standing higher so the disc reads from across the room, and heights
              ride the animated zoom so the whole mesa breathes as you descend.
            </p>
          </div>
          <div>
            <h3>THE OPERATION</h3>
            <p>
              A mouse-first chart with keys bolted on would miss the point of this
              environment: the interaction basis has changed, so the operation is rebuilt
              from the ground up. Every labelled slice carries its key projected over the
              view. Branch keys descend; leaf keys — the original leaves were not even
              clickable — select the slice and read it out, because in a key-click
              environment everything shown must be addressable. Esc is the centre circle,
              everywhere: climb one level, from wherever you are. What the sunburst is
              <i> for</i> — a file system, a class tree, a storehouse of anything nested —
              is a question the project is deliberately taking second; the descent has to
              work, and feel right, first.
            </p>
          </div>
        </div>
        <div className="index">
          <h3>THE TEN HOUSES OF FLARE — CLICK TO DESCEND</h3>
          <div>
            {root.children.map((house) => {
              const count = sunburstDescendants(house).length;
              return (
                <span key={house.name}>
                  <button className="house" onClick={() => requestZoom(house)}>
                    <span className="sw" style={{ background: colourOf(house) }} />
                    {house.name}{" "}
                    <span className="meta">{count} classes · {fmt(house.value)} · {((house.value / total) * 100).toFixed(1)}%</span>
                  </button>
                  {"  "}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
