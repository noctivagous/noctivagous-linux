import { useEffect, useMemo, useRef, useState } from "react";
import SunburstCylinderView from "./SunburstCylinderView.jsx";
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
 * Zoomable sunburst as a cylinder, by key-click — sunburst-cylinder.html.
 *
 * The sunburst's sibling in the lab's 3D Spatial frame: where the
 * mesa page terraces the disc, this one stands it up as a drum on
 * the horizon monitor's platter — the rings lie on the cylinder's
 * top face, read isometrically by default. The operation is the
 * bimodal one, stated plainly: letter keys TARGET a slice (the
 * hover of key-click theory), F is the click — a targeted branch
 * descends, a targeted leaf's portion slides out of the drum and
 * its information stands in 3D space beside it — and D goes back,
 * putting the portion back or climbing a level. The mouse mirrors
 * it: chips target, wedge clicks click, the centre cap climbs.
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
  { id: "drumHeight", label: "Drum height", type: "number", min: 8, max: 48, step: 1, defaultValue: 26 },
  { id: "labelsOn", label: "Key labels", type: "boolean", defaultValue: true },
  { id: "boundsOn", label: "Bounding box", type: "boolean", defaultValue: false },
  { id: "drift", label: "Camera drift", type: "boolean", defaultValue: true },
];

// Key labels skip D and F — the operators are not addresses (the
// same rule as the treemap page, so the lab's operation is one
// operation everywhere).
const LABEL_ALPHABET = "ABCEGHIJKLMNOPQRSTUVWXYZ";
const keyLabel = (i) => {
  if (i < LABEL_ALPHABET.length) return LABEL_ALPHABET[i];
  const j = i - LABEL_ALPHABET.length;
  return LABEL_ALPHABET[Math.floor(j / LABEL_ALPHABET.length)] + LABEL_ALPHABET[j % LABEL_ALPHABET.length];
};

const fmt = (n) => n.toLocaleString("en-US");

const css = `
.sc-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.sc-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.sc-head h1 { font-size:17px; letter-spacing:2px; color:#e8f3ee; margin:0; }
.sc-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.sc-nav a.here { color:#ffa726; }
.sc-sub { padding:0 20px 10px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.sc-main { display:flex; gap:14px; margin:0 20px; align-items:stretch; }
.sc-stage { flex:1; border:1px solid #2c3a41; border-radius:6px; overflow:hidden; min-width:0; height:560px; }
.sc-rail { width:296px; flex:none; display:flex; flex-direction:column; gap:14px; }
.sc-box { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; }
.sc-box h3 { margin:0 0 8px; font-size:10.5px; letter-spacing:2px; color:#e8f3ee; font-weight:bold; }
.sc-readout { font-family:Consolas, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; white-space:pre-wrap; word-break:break-word; }
.sc-readout .k { color:#ffa726; }
.sc-keyline { font-family:Consolas, monospace; font-size:11.5px; color:#8fa3ab; line-height:1.7; }
.sc-keyline b { color:#ffa726; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:118px; }
.nct-parameter output { font-family:Consolas, monospace; color:#ffa726; min-width:30px; text-align:right; }
.nct-parameter select { background:#0b0e10; color:#ffa726; border:1px solid #2c3a41; font-family:Consolas, monospace; font-size:11px; }
.sc-chip { position:absolute; left:0; top:0; pointer-events:auto; font-family:Consolas, monospace; font-size:9.5px;
  letter-spacing:.5px; padding:1px 4px; border-radius:3px; border:1px solid rgba(255,167,38,.65);
  background:rgba(6,12,14,.82); color:#ffa726; cursor:pointer; will-change:transform; }
.sc-chip:hover { background:#ffa726; color:#0b0e10; }
.sc-chip.sel { background:#ffa726; color:#0b0e10; font-weight:bold; }
.sc-compass { position:absolute; left:0; top:0; font-family:Tahoma, sans-serif; font-size:14px; letter-spacing:1px;
  color:#8fa3ab; text-shadow:0 1px 6px #000; pointer-events:none; will-change:transform; }
.sc-info { position:absolute; left:0; top:0; pointer-events:none; background:rgba(6,12,14,.9);
  border:1px solid rgba(255,167,38,.7); border-radius:5px; padding:7px 11px; font-family:Consolas, monospace;
  font-size:11px; line-height:1.65; color:#a9f0dd; white-space:nowrap; will-change:transform,opacity; }
.sc-info .nm { color:#e8f3ee; font-size:13px; letter-spacing:1px; }
.sc-info .path { color:#8fa3ab; font-size:10.5px; }
.sc-info .k { color:#ffa726; }
.sc-info .hint { color:#8fa3ab; font-size:10px; }
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

export default function SunburstCylinderApp() {
  const root = useMemo(() => buildSunburst(FLARE), []);
  const colourOf = useMemo(
    () => sunburstColourScale(root.children.map((c) => c.name)),
    [root],
  );
  const { values, setValue } = useNCTParameters(PARAM_DEFS);
  const [focusNode, setFocusNode] = useState(root);
  const [centreNode, setCentreNode] = useState(root);
  const [target, setTarget] = useState(null);
  const [open, setOpen] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [zoomReq, setZoomReq] = useState(null);
  const [labelsTick, setLabelsTick] = useState(0);
  const [buffer, setBuffer] = useState("");
  const bufferTimer = useRef(null);
  const nonce = useRef(0);

  const requestZoom = (node) => {
    setFocusNode(node);
    setCentreNode(node.parent ?? root);
    setTarget(null);
    setOpen(null);
    nonce.current += 1;
    setZoomReq({ node, n: nonce.current });
  };

  // THE CLICK (the F key, or a wedge click): a branch descends; a
  // leaf's portion pulls out of the drum — or back in, if it is out.
  const clickNode = (node) => {
    if (node.children.length) {
      requestZoom(node);
    } else {
      setTarget(node);
      setOpen((cur) => (cur === node ? null : node));
    }
  };

  // THE WAY BACK (the D key): put the portion back first, then climb.
  const goBack = () => {
    if (open) setOpen(null);
    else if (focusNode !== root) requestZoom(centreNode);
  };

  // Keys belong to the slices the current zoom leaves labelled, in
  // reading order (ring, then angle), exactly as the chips are drawn.
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
        if (open) setOpen(null);
        else if (target) setTarget(null);
        else if (focusNode !== root) requestZoom(centreNode);
        return;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        const letter = e.key.toUpperCase();
        // F is the click and D is the way back — always. Neither is
        // ever a label letter (see LABEL_ALPHABET), so the two
        // operators can be unconditional.
        if (letter === "F") {
          setBuffer("");
          if (target) clickNode(target);
          return;
        }
        if (letter === "D") {
          setBuffer("");
          goBack();
          return;
        }
        // Otherwise the letter goes into the key buffer; a completed
        // label TARGETS its slice. Targeting is not clicking. A label
        // that is also the start of a longer label waits out the
        // buffer window: a second letter completes the longer label,
        // the window lapsing targets the exact one.
        const next = buffer + letter;
        const exact = nodeByKey.get(next);
        const isPrefix = [...nodeByKey.keys()].some((k) => k.length > next.length && k.startsWith(next));
        if (exact && !isPrefix) {
          setTarget(exact);
          setBuffer("");
        } else if (exact || isPrefix) {
          setBuffer(next);
          clearTimeout(bufferTimer.current);
          bufferTimer.current = setTimeout(() => {
            if (exact) setTarget(exact);
            setBuffer("");
          }, 800);
        } else {
          setBuffer("");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, nodeByKey, target, open, focusNode, centreNode, root]);

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
  const total = root.value;
  const shown = hovered ?? target;
  const openInfo = open
    ? {
        name: open.name,
        path: pathOf(open),
        value: fmt(open.value),
        pctWhole: ((open.value / total) * 100).toFixed(2),
        pctParent: open.parent ? ((open.value / open.parent.value) * 100).toFixed(1) : "100.0",
        parentName: open.parent ? open.parent.name : "flare",
      }
    : null;

  return (
    <div className="sc-page">
      <style>{css}</style>
      <div className="sc-head">
        <h1>DEMO-DE · SUNBURST CYLINDER</h1>
        <nav className="sc-nav">
          <a href="./">key-clicks</a>
          <a href="./react.html">shell + panelization</a>
          <a href="./definition.html">definition</a>
          <a href="./tangled.html">tangled tree 3D</a>
          <a href="./sunburst.html">sunburst 3D</a>
          <a href="./treemap.html">treemap 3D</a>
          <a href="./horizon.html">horizon monitor</a>
          <a href="./horizon3d.html">horizon 3D</a>
          <a className="here" href="./sunburst-cylinder.html">sunburst cylinder</a>
        </nav>
      </div>
      <p className="sc-sub">
        Bostock's zoomable sunburst stood up as a cylinder on the platter: the rings lie on
        the drum's top face, read isometrically, and the zoom is the original's own
        mathematics. The operation is bimodal — a letter key <i>targets</i> a slice,{" "}
        <b>F</b> is the click: a branch descends; a leaf's portion slides out of the drum
        and its information stands in space beside it. <b>D</b> goes back.
      </p>
      <div className="sc-main">
        <div className="sc-stage">
          <SunburstCylinderView
            root={root}
            colourOf={colourOf}
            drumHeight={Number(values.drumHeight)}
            projection={String(values.projection)}
            rotation={Number(values.rotation)}
            elevation={Number(values.elevation)}
            boundsOn={Boolean(values.boundsOn)}
            labelsOn={Boolean(values.labelsOn)}
            drift={Boolean(values.drift)}
            zoomReq={zoomReq}
            keyTargets={keyTargets}
            targetNode={target}
            openNode={open}
            openInfo={openInfo}
            onZoomNode={requestZoom}
            onLeafClick={clickNode}
            onTarget={setTarget}
            onCentre={() => { if (focusNode !== root) requestZoom(centreNode); }}
            onHover={setHovered}
            onSettled={() => setLabelsTick((t) => t + 1)}
          />
        </div>
        <div className="sc-rail">
          <div className="sc-box">
            <h3>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={setValue} />
          </div>
          <div className="sc-box">
            <h3>READOUT</h3>
            <div className="sc-readout">
              <span className="k">INSIDE</span>{"  "}{pathOf(focusNode)}{"\n"}
              <span className="k">VALUE</span>{"   "}{fmt(focusNode.value)} ({((focusNode.value / total) * 100).toFixed(1)}% of flare){"\n"}
              <span className="k">HOLDS</span>{"   "}{focusNode.children.length} branches · depth {focusNode.depth}{"\n"}
              {open ? (
                <>
                  <span className="k">OPEN</span>{"    "}{open.name} — pulled out of the drum{"\n"}
                  <span className="k">PATH</span>{"    "}{pathOf(open)}{"\n"}
                  <span className="k">TREE</span>{"    "}{indexPathOf(open)}{"\n"}
                  <span className="k">VALUE</span>{"   "}{fmt(open.value)} ({((open.value / total) * 100).toFixed(2)}% of flare
                  {open.parent ? `, ${((open.value / open.parent.value) * 100).toFixed(1)}% of ${open.parent.name}` : ""}){"\n"}
                </>
              ) : shown ? (
                <>
                  <span className="k">{hovered ? "HOVER" : "TARGET"}</span>{"  "}{shown.name}{"\n"}
                  <span className="k">PATH</span>{"    "}{pathOf(shown)}{"\n"}
                  <span className="k">VALUE</span>{"   "}{fmt(shown.value)} ({((shown.value / total) * 100).toFixed(2)}% of flare){"\n"}
                  <span className="k">KIND</span>{"    "}{shown.children.length ? `branch — ${shown.children.length} children; F descends` : "leaf — F pulls its portion out"}{"\n"}
                </>
              ) : (
                <><span className="k">TARGET</span>{"  "}— type a key to target a slice —</>
              )}
            </div>
          </div>
          <div className="sc-box">
            <h3>KEY-CLICKS</h3>
            <p className="sc-keyline">
              buffer: <b>{buffer || "—"}</b>{" · "}letter keys <b>target</b> a slice{" · "}
              <b>F</b> clicks the target{" · "}<b>D</b> goes back{" · "}<b>Esc</b> clears{" · "}
              chips target; a wedge click is the click itself
            </p>
          </div>
        </div>
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — The zoomable sunburst of the Flare class hierarchy (252 classes) as
        a cylinder on the platter. The palette is the original's interpolateRainbow, ported
        colour for colour; each slice takes the colour of its house, the depth-1 branch it
        descends from. A leaf pulled out of the drum carries its information with it.
      </p>

      <div className="print">
        <div className="kicker">ZUI frames · 3D spatial</div>
        <h2>The sunburst, standing as a drum</h2>
        <p className="standfirst">
          The mesa page laid the sunburst's rings out as terraces. Here the same disc is
          stood up as a cylinder on the platter, and its portions can be taken out of it —
          a leaf's wedge slides out of the drum with everything the chart knows about it
          written in the space beside it.
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
              classes in ten houses, sized by their code. In the original the leaves are
              not even clickable; the disc is for descending, not for reading.
            </p>
          </div>
          <div>
            <h3>THE CONVERSION</h3>
            <p>
              The disc becomes a drum. Every slice is a wedge block extruded to one height,
              so the two rings the original shows lie on the cylinder's top face, in the
              original's own rainbow, and the zoom re-mapping is untouched — only now you
              look down at the chart the way you look down at a pie on a table, isometrically
              by default, the table being the distribution's platter with its four
              directions lettered on it. And a portion is a physical thing in a way a
              screen slice never was: click a leaf and its wedge slides radially out of
              the drum, out from among its neighbours, and stands apart with its name,
              its path, its value and its shares written in the space next to it —
              information in 3D space, attached to the piece of the chart it describes.
            </p>
          </div>
          <div>
            <h3>THE OPERATION</h3>
            <p>
              The operation is bimodal control, the foundation this environment is built
              on, and it is two acts, not one. A letter key <i>targets</i> a slice — the
              key-click equivalent of the hover, the slice lights and the readout names
              it — and <b>F</b> is the click, the same F that clicks the hovered element
              in the keypilot system: on a branch it descends, on a leaf it pulls the
              portion out (or puts it back). <b>D</b> goes back: the portion first, then
              one level up the tree, as far as the root. The label alphabet skips D and
              F themselves: operators are not addresses. The mouse mirrors the theory
              rather than replacing it — chips target, wedge clicks click, the centre cap
              climbs — so the hand and the keys are doing the same two acts, never two
              different interfaces.
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
