import { useEffect, useRef, useState } from "react";
import TreemapView, { labeledNodes, LABEL_ALPHABET } from "./TreemapView.jsx";
import { FLARE } from "./sunburst-data.js";
import {
  buildTreemap,
  descendants as treemapDescendants,
  ancestors as treemapAncestors,
  treemapPath,
  treemapHouse,
} from "../NCTGraphite/packages/nctgraphite/src/treemap/NCTGraphiteTreemapLayout.ts";
import {
  NCTParameterPanel,
  useNCTParameters,
} from "../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";

/**
 * Zoomable treemap, in 3D — treemap.html.
 *
 * Bostock's zoomable treemap (binary tiling, the notebook's custom
 * tile) laid on the lab's circular platter in isometric: branches
 * are trays, leaves are cuboids standing in them, coloured by
 * house. The operation is the bimodal one the user specified —
 * letter keys target a node, F clicks it (a branch opens; a leaf
 * brings its portion out of the cuboid with its information in 3D
 * space), and D goes back up the tree, the original's header-band
 * click given a key. The label alphabet skips D and F: operators
 * are not addresses.
 */

const PARAM_DEFS = [
  {
    id: "projection", label: "Projection", type: "select", defaultValue: "iso",
    options: [
      { value: "iso", label: "Isometric" },
      { value: "perspective", label: "Perspective" },
    ],
  },
  { id: "rotation", label: "Rotation", type: "number", min: -180, max: 180, step: 1, defaultValue: 0 },
  { id: "elevation", label: "Elevation", type: "number", min: -25, max: 50, step: 1, defaultValue: 0 },
  { id: "leafH", label: "Cuboid height", type: "number", min: 4, max: 24, step: 1, defaultValue: 10 },
  { id: "boundsOn", label: "Bounding box", type: "boolean", defaultValue: false },
  { id: "labelsOn", label: "Key labels", type: "boolean", defaultValue: true },
  { id: "drift", label: "Camera drift", type: "boolean", defaultValue: true },
];

const fmt = (v) => Math.round(v).toLocaleString("en-US");
const pct = (part, whole) => `${((100 * part) / whole).toFixed(1)}%`;

const css = `
.tm-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.tm-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.tm-head h1 { font-size:17px; letter-spacing:2px; color:#e8f3ee; margin:0; }
.tm-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.tm-nav a.here { color:#ffa726; }
.tm-sub { padding:0 20px 10px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.tm-main { display:flex; gap:14px; margin:0 20px; align-items:stretch; }
.tm-stage { flex:1; border:1px solid #2c3a41; border-radius:6px; overflow:hidden; min-width:0; height:560px; }
.tm-rail { width:296px; flex:none; display:flex; flex-direction:column; gap:14px; }
.tm-box { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; }
.tm-box h3 { margin:0 0 8px; font-size:10.5px; letter-spacing:2px; color:#e8f3ee; font-weight:bold; }
.tm-readout { font-family:Consolas, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; white-space:pre-wrap; word-break:break-word; }
.tm-readout .k { color:#ffa726; }
.tm-readout button { background:none; border:none; color:#a9f0dd; font:inherit; cursor:pointer; padding:0; }
.tm-readout button:hover { color:#ffa726; text-decoration:underline; }
.tm-keyline { font-family:Consolas, monospace; font-size:11.5px; color:#8fa3ab; line-height:1.7; }
.tm-keyline b { color:#ffa726; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:118px; }
.nct-parameter output { font-family:Consolas, monospace; color:#ffa726; min-width:30px; text-align:right; }
.nct-parameter select { background:#0b0e10; color:#ffa726; border:1px solid #2c3a41; font-family:Consolas, monospace; font-size:11px; }
.tm-chip { position:absolute; left:0; top:0; pointer-events:auto; font-family:Consolas, monospace; font-size:9.5px; letter-spacing:.5px;
  padding:1px 4px; border-radius:3px; border:1px solid rgba(255,167,38,.65); background:rgba(6,12,14,.82); color:#ffa726; cursor:pointer; }
.tm-chip:hover { background:#ffa726; color:#0b0e10; }
.tm-chip.target { background:#ffa726; color:#0b0e10; font-weight:bold; }
.tm-name { position:absolute; left:0; top:0; font-size:10px; letter-spacing:.5px; color:rgba(238,244,241,.85);
  text-shadow:0 1px 4px #000; pointer-events:none; white-space:nowrap; }
.tm-compass { position:absolute; left:0; top:0; font-family:Tahoma, sans-serif; font-size:14px; letter-spacing:1px;
  color:#8fa3ab; text-shadow:0 1px 6px #000; pointer-events:none; will-change:transform; }
.tm-info { position:absolute; left:0; top:0; font-family:Consolas, monospace; font-size:11px; line-height:1.6; color:#e8f3ee;
  background:rgba(6,12,14,.88); border:1px solid rgba(255,167,38,.6); border-radius:5px; padding:7px 10px;
  pointer-events:none; white-space:nowrap; will-change:transform; }
.tm-info b { color:#ffa726; font-size:12px; }
.tm-info span { color:#8fa3ab; font-size:10px; }
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
.print .house-row { font-size:12.5px; line-height:23px; }
.print .house-row button { background:none; border:none; color:#cfd8dc; font:inherit; cursor:pointer; padding:0; }
.print .house-row button:hover { color:#ffa726; text-decoration:underline; }
.print .house-row .meta { font-family:Consolas, monospace; font-size:10.5px; color:#8fa3ab; }
`;

export default function TreemapApp() {
  const rootRef = useRef(null);
  if (!rootRef.current) rootRef.current = buildTreemap(FLARE);
  const root = rootRef.current;
  const { values, setValue } = useNCTParameters(PARAM_DEFS);
  const [focus, setFocus] = useState(root);
  const [target, setTarget] = useState(null);
  const [openLeaf, setOpenLeaf] = useState(null);
  const bufferRef = useRef("");
  const bufferTimer = useRef(null);

  const descend = (node) => {
    setFocus(node);
    setTarget(null);
    setOpenLeaf(null);
  };
  const goBack = () => {
    if (openLeaf) { setOpenLeaf(null); return; }
    if (focus.parent) {
      setFocus(focus.parent);
      setTarget(null);
    }
  };
  const clickTarget = () => {
    if (!target) return;
    if (target.children.length === 0) {
      setOpenLeaf((cur) => (cur === target ? null : target));
    } else {
      descend(target);
    }
  };
  const onNodeClick = (node) => {
    if (node.children.length === 0) {
      setTarget(node);
      setOpenLeaf((cur) => (cur === node ? null : node));
    } else {
      descend(node);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (openLeaf) setOpenLeaf(null);
        else setTarget(null);
        return;
      }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); clickTarget(); return; }
      if (e.key === "d" || e.key === "D") { e.preventDefault(); goBack(); return; }
      if (!/^[a-zA-Z]$/.test(e.key)) return;
      const letter = e.key.toUpperCase();
      if (!LABEL_ALPHABET.includes(letter)) return;
      const labels = labeledNodes(focus);
      const attempt = (buf) => ({
        exact: labels.find((l) => l.label === buf),
        longer: labels.some((l) => l.label.length > buf.length && l.label.startsWith(buf)),
      });
      let buf = bufferRef.current + letter;
      let { exact, longer } = attempt(buf);
      if (!exact && !longer && buf.length > 1) {
        buf = letter;
        ({ exact, longer } = attempt(buf));
      }
      clearTimeout(bufferTimer.current);
      if (exact && !longer) {
        setTarget(exact.node);
        bufferRef.current = "";
        return;
      }
      if (exact || longer) {
        // A label that also starts a longer label waits out the
        // buffer window: a second letter completes the longer one;
        // the window lapsing targets the exact one.
        bufferRef.current = buf;
        const pending = exact ? exact.node : null;
        bufferTimer.current = setTimeout(() => {
          bufferRef.current = "";
          if (pending) setTarget(pending);
        }, 800);
        return;
      }
      bufferRef.current = "";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, target, openLeaf]);

  const crumbs = treemapAncestors(focus);
  const houses = root.children.map((house) => ({
    node: house,
    leaves: treemapDescendants(house).filter((n) => n.children.length === 0).length,
  }));

  return (
    <div className="tm-page">
      <style>{css}</style>
      <div className="tm-head">
        <h1>DEMO-DE · ZOOMABLE TREEMAP IN 3D</h1>
        <nav className="tm-nav">
          <a href="./">key-clicks</a>
          <a href="./react.html">shell + panelization</a>
          <a href="./definition.html">definition</a>
          <a href="./tangled.html">tangled tree 3D</a>
          <a href="./sunburst.html">sunburst 3D</a>
          <a href="./sunburst-cylinder.html">sunburst cylinder</a>
          <a href="./horizon.html">horizon monitor</a>
          <a href="./horizon3d.html">horizon 3D</a>
          <a className="here" href="./treemap.html">treemap 3D</a>
        </nav>
      </div>
      <p className="tm-sub">
        The zoomable treemap standing on the platter in isometric: branches are trays,
        leaves are cuboids, area is value, colour is house. Work it the bimodal way —
        a node's key targets it, <b>F</b> clicks it: a branch opens, a leaf brings its
        portion out of the cuboid with its information standing in 3D space beside it.{" "}
        <b>D</b> goes back up the tree.
      </p>
      <div className="tm-main">
        <div className="tm-stage">
          <TreemapView
            root={root}
            focusNode={focus}
            targetNode={target}
            openLeaf={openLeaf}
            leafH={Number(values.leafH)}
            projection={String(values.projection)}
            rotation={Number(values.rotation)}
            elevation={Number(values.elevation)}
            boundsOn={Boolean(values.boundsOn)}
            drift={Boolean(values.drift)}
            labelsOn={Boolean(values.labelsOn)}
            onTarget={setTarget}
            onNodeClick={onNodeClick}
            onUp={goBack}
          />
        </div>
        <div className="tm-rail">
          <div className="tm-box">
            <h3>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={setValue} />
          </div>
          <div className="tm-box">
            <h3>READOUT</h3>
            <div className="tm-readout">
              <span className="k">INSIDE</span>{"  "}
              {crumbs.map((c, i) => (
                <span key={c.name + i}>
                  {i > 0 ? " / " : ""}
                  <button onClick={() => descend(c)}>{c.name}</button>
                </span>
              ))}
              {"\n"}
              <span className="k">HOLDS</span>{"   "}{fmt(focus.value)} · {pct(focus.value, root.value)} of flare{"\n"}
              {target ? (
                <>
                  <span className="k">TARGET</span>{"  "}{target.name} — {fmt(target.value)} · {pct(target.value, focus.value)} of {focus.name}
                  {" · "}house {treemapHouse(target).name}{"\n"}
                  <span className="k">F</span>{"       "}{target.children.length === 0 ? "bring its portion out" : "open it up"}
                </>
              ) : (
                <>
                  <span className="k">TARGET</span>{"  "}— type a node's key —
                </>
              )}
              {openLeaf ? (
                <>
                  {"\n"}
                  <span className="k">OPEN</span>{"    "}{openLeaf.name} — {fmt(openLeaf.value)}{"\n"}
                  <span className="k">PATH</span>{"    "}{treemapPath(openLeaf)}{"\n"}
                  <span className="k">SHARE</span>{"   "}{pct(openLeaf.value, root.value)} of flare · {pct(openLeaf.value, openLeaf.parent.value)} of {openLeaf.parent.name}
                </>
              ) : null}
            </div>
          </div>
          <div className="tm-box">
            <h3>KEY-CLICKS</h3>
            <p className="tm-keyline">
              <b>key</b> target a node{" · "}<b>F</b> click it — open a branch, bring a
              leaf out{" · "}<b>D</b> go back{" · "}<b>Esc</b> release
            </p>
          </div>
        </div>
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — The treemap as a tray of cuboids: flare's 252 classes on the
        platter, binary-tiled exactly as the original lays them, the whole tree
        re-mapped through the focus node's frame at every zoom. A leaf's portion,
        brought out, stands at the right of the stage with its card.
      </p>

      <div className="print">
        <div className="kicker">ZUI frames · 3D spatial · file-system navigation</div>
        <h2>A hierarchy you open with a key</h2>
        <p className="standfirst">
          The treemap is the frame d3-js-uses.txt assigns to file-system navigation:
          a whole tree on one surface, area doing the talking. In space it becomes a
          tray of cuboids on the platter — and it is worked without a mouse, by
          targeting and clicking with keys.
        </p>
        <div className="rule" />
        <div className="cols">
          <div>
            <h3>THE CHART</h3>
            <p>
              Bostock's zoomable treemap tiles by the binary method: split the children
              where their running sum crosses half, cut along the longer side, recurse —
              each subtree laid out in the full chart space and scaled into its parent,
              so a zoomed group keeps its proportions. Click a cell to zoom in; click
              the header band to zoom out; the move takes 750 ms. The original is
              monochrome — white header, grey branches, paler leaves — because in 2D
              the rectangles must not shout over their own labels.
            </p>
          </div>
          <div>
            <h3>THE CONVERSION</h3>
            <p>
              On the platter the nesting becomes physical: a branch is a shallow tray,
              its children stand in it, leaves are cuboids whose footprints are their
              rects. Depth reads as stacking, value still reads as area. One departure
              is made in the open: the houses wear d3's category-10 colours (as in
              Bostock's non-zoomable treemap), because in space the ten families must
              be tellable apart across the platter. The camera is the horizon platter's
              — isometric by default, orbiting the platter's centre, rotation and
              elevation continuous. The layout itself is the original's, verified
              rect-for-rect against d3.
            </p>
          </div>
          <div>
            <h3>THE OPERATION</h3>
            <p>
              Every node big enough to address wears a key. Type the key and the node is
              targeted — outlined, named in the readout. Then F is the click, as in the
              keypilot model: on a branch, F opens it up and the tree re-maps around
              it; on a leaf, F brings that leaf's portion out of the cuboid — a drawer
              rises from the tile with a turning glyph on top and the leaf's
              information standing in 3D space beside it: its name, its path, its size,
              its share. D goes back: it puts the drawer away, or climbs to the parent
              — the original's header-band click, given a key. The alphabet skips D and
              F themselves: operators are not addresses.
            </p>
          </div>
        </div>
        <div className="index">
          <h3>THE TEN HOUSES OF FLARE — CLICK TO OPEN</h3>
          {houses.map(({ node, leaves }) => (
            <div className="house-row" key={node.name}>
              <button onClick={() => descend(node)}>{node.name}</button>{" "}
              <span className="meta">
                — {leaves} classes · {fmt(node.value)} · {pct(node.value, root.value)} of flare
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
