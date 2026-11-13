import { useEffect, useRef, useState } from "react";
import TreemapCubeView, { cubeAddresses, LABEL_ALPHABET } from "./TreemapCubeView.jsx";
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
 * The treemap cube — treemap-cube.html.
 *
 * The zoomable treemap as an object: the current node's children
 * are spread across the five open faces of a cube (the bottom
 * rests on the platter), each face holding a value-balanced share
 * of the layer, binary-tiled. A piece clicked — or targeted by its
 * key and clicked with F — re-forms the cube to the next layer on
 * every face; a leaf's piece slides out of the cube and its
 * information stands in space to the side. D goes back.
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
  { id: "boundsOn", label: "Bounding box", type: "boolean", defaultValue: false },
  { id: "labelsOn", label: "Key labels", type: "boolean", defaultValue: true },
  { id: "drift", label: "Camera drift", type: "boolean", defaultValue: true },
];

const fmt = (v) => Math.round(v).toLocaleString("en-US");
const pct = (part, whole) => `${((100 * part) / whole).toFixed(1)}%`;

const css = `
.tc-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.tc-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.tc-head h1 { font-size:17px; letter-spacing:2px; color:#e8f3ee; margin:0; }
.tc-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.tc-nav a.here { color:#ffa726; }
.tc-sub { padding:0 20px 10px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.tc-main { display:flex; gap:14px; margin:0 20px; align-items:stretch; }
.tc-stage { flex:1; border:1px solid #2c3a41; border-radius:6px; overflow:hidden; min-width:0; height:560px; }
.tc-rail { width:296px; flex:none; display:flex; flex-direction:column; gap:14px; }
.tc-box { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; }
.tc-box h3 { margin:0 0 8px; font-size:10.5px; letter-spacing:2px; color:#e8f3ee; font-weight:bold; }
.tc-readout { font-family:Consolas, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; white-space:pre-wrap; word-break:break-word; }
.tc-readout .k { color:#ffa726; }
.tc-readout button { background:none; border:none; color:#a9f0dd; font:inherit; cursor:pointer; padding:0; }
.tc-readout button:hover { color:#ffa726; text-decoration:underline; }
.tc-keyline { font-family:Consolas, monospace; font-size:11.5px; color:#8fa3ab; line-height:1.7; }
.tc-keyline b { color:#ffa726; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:118px; }
.nct-parameter output { font-family:Consolas, monospace; color:#ffa726; min-width:30px; text-align:right; }
.nct-parameter select { background:#0b0e10; color:#ffa726; border:1px solid #2c3a41; font-family:Consolas, monospace; font-size:11px; }
.tc-chip { position:absolute; left:0; top:0; pointer-events:auto; font-family:Consolas, monospace; font-size:9.5px; letter-spacing:.5px;
  padding:1px 4px; border-radius:3px; border:1px solid rgba(255,167,38,.65); background:rgba(6,12,14,.82); color:#ffa726; cursor:pointer; }
.tc-chip:hover { background:#ffa726; color:#0b0e10; }
.tc-chip.target { background:#ffa726; color:#0b0e10; font-weight:bold; }
.tc-name { position:absolute; left:0; top:0; font-size:10px; letter-spacing:.5px; color:rgba(238,244,241,.85);
  text-shadow:0 1px 4px #000; pointer-events:none; white-space:nowrap; }
.tc-compass { position:absolute; left:0; top:0; font-family:Tahoma, sans-serif; font-size:14px; letter-spacing:1px;
  color:#8fa3ab; text-shadow:0 1px 6px #000; pointer-events:none; will-change:transform; }
.tc-info { position:absolute; left:0; top:0; font-family:Consolas, monospace; font-size:11px; line-height:1.6; color:#e8f3ee;
  background:rgba(6,12,14,.88); border:1px solid rgba(255,167,38,.6); border-radius:5px; padding:7px 10px;
  pointer-events:none; white-space:nowrap; will-change:transform; }
.tc-info b { color:#ffa726; font-size:12px; }
.tc-info span { color:#8fa3ab; font-size:10px; }
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

export default function TreemapCubeApp() {
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
      const labels = cubeAddresses(focus);
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
    <div className="tc-page">
      <style>{css}</style>
      <div className="tc-head">
        <h1>DEMO-DE · TREEMAP CUBE</h1>
        <nav className="tc-nav">
          <a href="./">key-clicks</a>
          <a href="./react.html">shell + panelization</a>
          <a href="./definition.html">definition</a>
          <a href="./tangled.html">tangled tree 3D</a>
          <a href="./sunburst.html">sunburst 3D</a>
          <a href="./sunburst-cylinder.html">sunburst cylinder</a>
          <a href="./horizon.html">horizon monitor</a>
          <a href="./horizon3d.html">horizon 3D</a>
          <a href="./treemap.html">treemap 3D</a>
          <a className="here" href="./treemap-cube.html">treemap cube</a>
        </nav>
      </div>
      <p className="tc-sub">
        The treemap as a cube: the current node's children are spread across its five
        open faces — top, north, east, south, west — each face a value-balanced share of
        the layer, binary-tiled, every child a labeled piece of the shell. Target a
        piece by its key and click it with <b>F</b>: a branch re-forms the cube to the
        next layer; a leaf's piece slides out of the cube with its information standing
        in space to the side. <b>D</b> goes back.
      </p>
      <div className="tc-main">
        <div className="tc-stage">
          <TreemapCubeView
            root={root}
            focusNode={focus}
            targetNode={target}
            openLeaf={openLeaf}
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
        <div className="tc-rail">
          <div className="tc-box">
            <h3>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={setValue} />
          </div>
          <div className="tc-box">
            <h3>READOUT</h3>
            <div className="tc-readout">
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
                  <span className="k">F</span>{"       "}{target.children.length === 0 ? "slide its piece out" : "re-form the cube to it"}
                </>
              ) : (
                <>
                  <span className="k">TARGET</span>{"  "}— type a piece's key —
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
          <div className="tc-box">
            <h3>KEY-CLICKS</h3>
            <p className="tc-keyline">
              <b>key</b> target a piece{" · "}<b>F</b> click it — re-form the cube, or
              slide a leaf out{" · "}<b>D</b> go back{" · "}<b>Esc</b> release
            </p>
          </div>
        </div>
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — The treemap cube at rest: flare's ten houses spread across the
        five open faces by value, the largest house (vis, 45% of the whole) taking the
        top face to itself, the rest shared around the sides. The cube is a shell of
        pieces over a dark core — turn it with the Rotation parameter and every face
        is a chart.
      </p>

      <div className="print">
        <div className="kicker">ZUI frames · 3D spatial · file-system navigation</div>
        <h2>The layer, as an object</h2>
        <p className="standfirst">
          A flat treemap shows one layer on one plane. The cube gives the layer five
          planes at once and makes it a thing you can turn in your hand — and when you
          open a piece, the whole cube re-forms around the next layer down.
        </p>
        <div className="rule" />
        <div className="cols">
          <div>
            <h3>THE CHART</h3>
            <p>
              The zoomable treemap underneath is the same one as on the flat page:
              Bostock's binary tiling, click to descend, the layout verified
              rect-for-rect against d3. What changes is only where the partition is
              drawn. A treemap's whole argument is that area is value; the cube keeps
              the argument and multiplies the wall space fivefold, at the price of
              never seeing the whole layer from one seat — which is why the camera
              parameters, and the drift, are part of the instrument rather than
              decoration.
            </p>
          </div>
          <div>
            <h3>THE CONVERSION</h3>
            <p>
              The children of the node you are inside are cut into five contiguous
              groups, balanced by value: each face's quota is the value remaining when
              the face starts, divided by the faces left — so one oversized child takes
              a face to itself, as vis takes the top, and the rest still spread evenly
              over the faces that remain. Each group is binary-tiled on its face, and
              each child stands as a shallow piece of the shell over a dark core: the
              cube is close to a cube, never solid, its faces aligned to the compass
              letters on the platter it rests on. Branches wear a darker shade of their
              house colour; leaves wear it full.
            </p>
          </div>
          <div>
            <h3>THE OPERATION</h3>
            <p>
              Every piece big enough to address wears a key. Type the key to target the
              piece; F is the click. On a branch, the click re-forms the cube: the old
              layer's pieces sink into the core and the clicked node's children grow
              out on every face — the cube changes because the layer changed. On a
              leaf, the click slides the piece out of the cube along its face, and the
              leaf's information stands in space to the side of it: name, path, size,
              share. D goes back — piece in first, then up a layer. The alphabet skips
              D and F: operators are not addresses.
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
