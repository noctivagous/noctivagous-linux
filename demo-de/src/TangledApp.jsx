import { useEffect, useMemo, useRef, useState } from "react";
import TangledView from "./TangledView.jsx";
import { TANGLE_LEVELS } from "./tangle-data.js";
import { constructTangleLayout } from "../NCTGraphite/packages/nctgraphite/src/tangle/NCTGraphiteTangleLayout.ts";
import { groupToTree, formatDataPath } from "../NCTGraphite/packages/nctgraphite/src/datatree/NCTGraphiteDataTree.ts";
import {
  NCTParameterPanel,
  useNCTParameters,
} from "../NCTGraphite/packages/nctgraphite/src/parameters/NCTGraphiteParameters.tsx";

/**
 * Tangled tree, in 3D, by key-click — tangled.html.
 *
 * Abrate's tangled-tree visualization (a tree with multiple
 * inheritance: bundled metro links between levels) lifted into
 * three dimensions: bundle lanes separate in depth. Every figure
 * carries a key label projected over the 3D view — type the label
 * and the figure is clicked: selected, framed, and read out.
 * Parameters are NCTGraphite's own (NCTParameterPanel); the
 * genealogy is also a data tree (one branch per level), and the
 * page closes with the dramatis personae set as a print index —
 * every figure listed with its key, clickable in print as in 3D.
 */

const PARAM_DEFS = [
  { id: "depth", label: "Bundle depth", type: "number", min: 0, max: 30, step: 1, defaultValue: 14 },
  { id: "spread", label: "Spread", type: "number", min: 0.34, max: 0.72, step: 0.02, defaultValue: 0.5 },
  { id: "tube", label: "Link tube", type: "number", min: 0.4, max: 2.4, step: 0.1, defaultValue: 1.1 },
  { id: "sheets", label: "Level sheets", type: "boolean", defaultValue: true },
  { id: "labelsOn", label: "Key labels", type: "boolean", defaultValue: true },
  { id: "drift", label: "Camera drift", type: "boolean", defaultValue: true },
];

const keyLabel = (i) => {
  // A..Z, AA..AZ, BA.. (spreadsheet order)
  let s = "";
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};

const css = `
.tg-page { background:#0b0e10; color:#cfd8dc; font-family:Tahoma, Verdana, sans-serif; margin:0; min-height:100vh; }
.tg-head { display:flex; align-items:baseline; gap:18px; padding:14px 20px 6px; flex-wrap:wrap; }
.tg-head h1 { font-size:17px; letter-spacing:2px; color:#e8f3ee; margin:0; }
.tg-nav a { color:#7fd4c1; font-size:12px; margin-right:14px; text-decoration:none; }
.tg-nav a.here { color:#ffa726; }
.tg-sub { padding:0 20px 10px; font-size:12px; color:#8fa3ab; max-width:940px; line-height:1.55; }
.tg-main { display:flex; gap:14px; margin:0 20px; align-items:stretch; }
.tg-stage { flex:1; border:1px solid #2c3a41; border-radius:6px; overflow:hidden; min-width:0; }
.tg-rail { width:296px; flex:none; display:flex; flex-direction:column; gap:14px; }
.tg-box { border:1px solid #2c3a41; border-radius:6px; background:#10161a; padding:10px 12px; }
.tg-box h3 { margin:0 0 8px; font-size:10.5px; letter-spacing:2px; color:#e8f3ee; font-weight:bold; }
.tg-readout { font-family:Consolas, monospace; font-size:11.5px; line-height:1.75; color:#a9f0dd; white-space:pre-wrap; word-break:break-word; }
.tg-readout .k { color:#ffa726; }
.tg-keyline { font-family:Consolas, monospace; font-size:11.5px; color:#8fa3ab; }
.tg-keyline b { color:#ffa726; }
.nct-parameters { display:flex; flex-direction:column; gap:9px; }
.nct-parameter { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; color:#b8c7cc; }
.nct-parameter-number { display:flex; align-items:center; gap:8px; }
.nct-parameter input[type=range] { accent-color:#ffa726; width:118px; }
.nct-parameter output { font-family:Consolas, monospace; color:#ffa726; min-width:30px; text-align:right; }
.tangle-chip { position:absolute; left:0; top:0; pointer-events:auto; font-family:Consolas, monospace; font-size:9.5px;
  letter-spacing:.5px; padding:1px 4px; border-radius:3px; border:1px solid rgba(255,167,38,.65);
  background:rgba(6,12,14,.82); color:#ffa726; cursor:pointer; will-change:transform; }
.tangle-chip:hover { background:#ffa726; color:#0b0e10; }
.tangle-chip.sel { background:#ffa726; color:#0b0e10; font-weight:bold; }
.tangle-chip.dim { opacity:.35; }
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
.print .lvl { margin:0 0 10px; font-size:12.5px; line-height:22px; }
.print .lvl .lh { font-family:Tahoma, sans-serif; font-size:10px; letter-spacing:2px; color:#ffa726; margin-right:8px; }
.print .person { background:none; border:none; color:#cfd8dc; font:inherit; cursor:pointer; padding:0 2px; }
.print .person:hover { color:#ffa726; text-decoration:underline; }
.print .person.sel { color:#ffa726; }
.print .person .pk { font-family:Consolas, monospace; font-size:10px; color:#7fd4c1; }
`;

export default function TangledApp() {
  const layout = useMemo(() => constructTangleLayout(TANGLE_LEVELS), []);
  const { values, setValue } = useNCTParameters(PARAM_DEFS);
  const [selectedId, setSelectedId] = useState(null);
  const [buffer, setBuffer] = useState("");
  const bufferTimer = useRef(null);

  const { labelOf, idByLabel, childrenOf } = useMemo(() => {
    const sorted = [...layout.nodes].sort((a, b) => a.level - b.level || a.y - b.y);
    const labelOf = new Map();
    const idByLabel = new Map();
    sorted.forEach((n, i) => {
      const k = keyLabel(i);
      labelOf.set(n.id, k);
      idByLabel.set(k, n.id);
    });
    const childrenOf = new Map(layout.nodes.map((n) => [n.id, []]));
    for (const n of layout.nodes) for (const p of n.parents) childrenOf.get(p.id).push(n.id);
    return { labelOf, idByLabel, childrenOf };
  }, [layout]);

  const levelTree = useMemo(() => groupToTree(layout.nodes, (n) => [n.level]), [layout]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { setSelectedId(null); setBuffer(""); return; }
      if (/^[a-zA-Z]$/.test(e.key)) {
        const next = (buffer + e.key.toUpperCase()).slice(-2);
        const exact = idByLabel.get(next);
        const isPrefix = [...idByLabel.keys()].some((k) => k.startsWith(next));
        if (exact && !([...idByLabel.keys()].some((k) => k.length > next.length && k.startsWith(next)))) {
          setSelectedId(exact);
          setBuffer("");
        } else if (isPrefix || exact) {
          setBuffer(next);
        } else if (idByLabel.get(e.key.toUpperCase())) {
          setSelectedId(idByLabel.get(e.key.toUpperCase()));
          setBuffer("");
        } else {
          setBuffer("");
        }
        clearTimeout(bufferTimer.current);
        bufferTimer.current = setTimeout(() => setBuffer(""), 800);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buffer, idByLabel]);

  const sel = selectedId ? layout.nodesIndex[selectedId] : null;
  let readout;
  if (!sel) {
    readout = (
      <>
        <span className="k">TANGLED TREE</span>{"\n"}
        {`${layout.nodes.length} figures · ${layout.bundles.length} bundles · ${layout.links.length} links\n`}
        {`level tree ${levelTree.branches.length} branches ${formatDataPath([0])}…${formatDataPath([levelTree.branches.length - 1])}\n\n`}
        {"Type a figure's key label — or click a chip, a figure, or a name in the index — to read it here."}
      </>
    );
  } else {
    const branch = levelTree.branches[sel.level];
    const idxInBranch = branch ? branch.items.findIndex((n) => n.id === sel.id) : -1;
    const lineage = [];
    let cur = sel;
    const guard = new Set();
    while (cur && cur.parents.length && !guard.has(cur.id)) {
      guard.add(cur.id);
      cur = cur.parents[0];
      lineage.unshift(cur.id);
    }
    const bundlesFed = sel.bundles.flat().map((b) => b.id.replaceAll("-X-", " + "));
    readout = (
      <>
        <span className="k">{sel.id.toUpperCase()}</span>{`  ·  key ${labelOf.get(sel.id)}\n`}
        {`level ${sel.level} · tree path ${formatDataPath([sel.level])} item ${idxInBranch}\n`}
        {`parents   ${sel.parents.length ? sel.parents.map((p) => p.id).join(", ") : "—"}\n`}
        {`children  ${childrenOf.get(sel.id).length ? childrenOf.get(sel.id).join(", ") : "—"}\n`}
        {`bundle    ${sel.bundle ? sel.bundle.id.replaceAll("-X-", " + ") : "—"}\n`}
        {`feeds     ${bundlesFed.length ? bundlesFed.join("  ·  ") : "—"}\n`}
        {`lineage   ${lineage.length ? [...lineage, sel.id].join(" → ") : sel.id}`}
      </>
    );
  }

  return (
    <div className="tg-page">
      <style>{css}</style>
      <div className="tg-head">
        <h1>TANGLED TREE — IN 3D, BY KEY-CLICK</h1>
        <nav className="tg-nav">
          <a href="index.html">vanilla demo</a>
          <a href="react.html">react shell</a>
          <a href="definition.html">definition canvas</a>
          <a href="tangled.html" className="here">tangled tree 3d</a>
          <a href="sunburst.html">sunburst 3d</a>
        </nav>
      </div>
      <p className="tg-sub">
        Matteo Abrate's tangled-tree visualization — a genealogy with multiple
        inheritance, drawn with bundled metro links — converted to 3D: each
        bundle's lane separates in depth. Every figure wears its key; type it to
        click the figure. The layout is a verified port of the original
        algorithm, running from NCTGraphite's tangle module.
      </p>

      <div className="tg-main">
        <div className="tg-stage">
          <TangledView
            layout={layout}
            depth={Number(values.depth)}
            spread={Number(values.spread)}
            tube={Number(values.tube)}
            sheets={Boolean(values.sheets)}
            labelsOn={Boolean(values.labelsOn)}
            drift={Boolean(values.drift)}
            selectedId={selectedId}
            labelFor={(id) => labelOf.get(id) ?? ""}
            onSelect={setSelectedId}
            height={560}
          />
        </div>
        <div className="tg-rail">
          <div className="tg-box">
            <h3>PARAMETERS</h3>
            <NCTParameterPanel definitions={PARAM_DEFS} values={values} onChange={setValue} />
          </div>
          <div className="tg-box">
            <h3>PANEL — READOUT</h3>
            <div className="tg-readout">{readout}</div>
          </div>
          <div className="tg-box">
            <h3>KEY-CLICK</h3>
            <div className="tg-keyline">
              {buffer ? <>key buffer: <b>{buffer}▸</b></> : <>type a key label (A…BO) to click its figure</>}
              <br />ESC clears · chips, figures and index names are clickable too
            </div>
          </div>
        </div>
      </div>
      <p className="figcap">
        <b>FIG. 1</b> — The house of Chaos, in depth. Links leave a parent on the
        plane, rise to their bundle's lane — one lane per shared parent-set —
        run along it, and settle onto the child. Colour is the bundle's, as in
        the original drawing.
      </p>

      <section className="print">
        <div className="kicker">Demo-de · Tangled trees · Nº 2</div>
        <h2>Multiple inheritance, drawn as a metro map</h2>
        <p className="standfirst">
          A family tree where a child can have two parents is not a tree at all,
          and the classic drawing breaks. The tangled tree keeps the levels and
          bundles the links — and here, gives the bundles room in depth.
        </p>
        <div className="rule" />
        <div className="cols">
          <h3>THE DRAWING</h3>
          <p>
            The figures stand in seven levels, from Chaos down to Hermione.
            Where several children share the same parents — the twelve Titans of
            Gaea and Uranus, the children of Rhea and Cronus — their links are
            gathered into a bundle that travels as one line, the way a metro map
            gathers lines between stations. A figure's tick grows with the
            number of bundles it feeds. The layout is Abrate's, after the
            GeneaQuilts system for large genealogies; the port in NCTGraphite
            reproduces the original's coordinates exactly, checked figure for
            figure against the notebook's own code.
          </p>
          <h3>THE THIRD DIMENSION</h3>
          <p>
            In the flat drawing the bundles share one plane and must be read by
            colour alone. Here each bundle's vertical lane is lifted to its own
            depth, ordered within its level, so the tangle becomes a stack of
            translucent sheets — one per level — with the lines running between
            them in space. The Bundle depth parameter is the distance between
            lanes; set it to zero and the drawing flattens back to the original.
          </p>
          <h3>OPERATION BY KEY</h3>
          <p>
            Dense graphics are usually where the keyboard gives up. Key-click
            takes the opposite position: everything on the surface is a labelled
            target, and the label is the click. Each figure's key floats over
            it in the 3D view; the same keys are printed beside the names in the
            index below, so the page can be operated from its own dramatis
            personae, in the print register, without touching the picture at
            all.
          </p>
        </div>
        <div className="index">
          <h3>DRAMATIS PERSONAE — INDEX OF FIGURES, BY LEVEL, WITH KEYS</h3>
          {layout.levels.map((level, li) => (
            <p className="lvl" key={li}>
              <span className="lh">LEVEL {li}</span>
              {level.map((n, ni) => (
                <span key={n.id}>
                  <button className={`person ${selectedId === n.id ? "sel" : ""}`}
                    onClick={() => setSelectedId(n.id)}>
                    {n.id} <span className="pk">{labelOf.get(n.id)}</span>
                  </button>
                  {ni < level.length - 1 ? " · " : ""}
                </span>
              ))}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
