# demo-de

The desktop-environment demo directory of noctivagous-linux — a
**multi-page lab**. Each page is a separate exploration in a different
direction; what proves out gets promoted into the main file later. All
pages are served by the one Vite dev server:

```sh
npm install
npm run dev     # one server routes every page below
npm run build   # emits dist/react.html + dist/definition.html
```

## Pages

| URL | File | What it is |
| --- | --- | --- |
| `/` | `index.html` + `sim.js` + `style.css` | The original full-viewport key-clicks demo (vanilla). **Untouched** — deliberately not a Vite entry, so the builds never overwrite it. |
| `/react.html` | `src/main.jsx` → `src/App.jsx` | The React shell: grid-systems foundation (columns / baseline / overlay, after NCTGraphite's print recipe) plus the panelization view. |
| `/definition.html` | `src/definition-main.jsx` → `src/DefinitionApp.jsx` | The Grasshopper-style **definition canvas** for the panelization: parameter nodes, a SHEET component putting a NURBS surface on a wire, a Graph Mapper on the REACH wire, an MD-pad attractor, data-tree output with a TREE OP, a live Panel readout, draggable nodes with click-to-wire — and, below the viewport, the same content set in traditional print conventions (headline, ruled columns, figure caption, marginalia). See `GRASSHOPPER-TAXONOMY-MAP.md`. |
| `/tangled.html` | `src/tangled-main.jsx` → `src/TangledApp.jsx` | Abrate's **tangled tree** visualization (multiple-inheritance genealogy, bundled metro links) converted to **3D** — bundle lanes separated in depth — and operated by **key-clicks**: every figure carries a key label projected over the 3D view; type it to click the figure. NCTGraphite parameter panel, Panel readout with the figure's data-tree path, and a print index (dramatis personae) with the same keys. Layout: `NCTGraphite`'s tangle module, a port verified node-for-node against the original. |
| `/sunburst.html` | `src/sunburst-main.jsx` → `src/SunburstApp.jsx` | Bostock's **zoomable sunburst** (the second ZUI viewer named in `d3-js-uses.txt`) converted to **3D**: the disc is a terraced mesa whose rings rise and sink with the original's own zoom mathematics, operated by **key-clicks** — branch keys descend, leaf keys read a slice out, Esc climbs. NCTGraphite parameter panel, readout with the slice's data-tree path, and a print index of the ten houses of Flare. Layout + palette: `NCTGraphite`'s sunburst module, with `interpolateRainbow` ported colour for colour. |
| `/horizon.html` | `src/horizon-main.jsx` → `src/HorizonApp.jsx` | The D3 gallery's **realtime horizon chart** as a **Flat UI activity monitor** (its named use in `d3-js-uses.txt`): eight labelled lanes — network in/out, disk read/write, memory, swap, processor, graphics — moving at once on live canvas strips, magnitude read as depth of colour. Operated by **key-clicks**: 1–8 / A–H focus and magnify a lane, Space halts time, Esc releases. Walk, banding and colour rule: `NCTGraphite`'s horizon module, ported from the original; the lanes are synthetic walks with each quantity's temperament (in the distribution they bind to real counters). |
| `/horizon3d.html` | `src/horizon3d-main.jsx` → `src/Horizon3DApp.jsx` | The horizon activity monitor **in 3D**: the eight lanes as terraced skylines receding into the dark, each fold of the chart standing as a solid terrace in its band colour — magnitude as height *and* colour. The data really flows: one column per sample, born at the front and travelling to the back between ticks, with a ground-plan time scale travelling alongside (or label rods rising from the waves, as a setting). The lanes sit on a circular platter lettered **N / W / E / S**, and every camera orbit turns about the platter's centre. Camera defaults to **isometric**, with perspective a parameter away and continuous rotation/elevation parameters on both; a bounding-box wireframe of the data volume is a toggle. Same operation as the flat monitor: 1–8 / A–H focus a lane (camera travels, others dim), Space halts time, Esc releases. Relief geometry: `NCTGraphite`'s horizon module. |
| `/treemap.html` | `src/treemap-main.jsx` → `src/TreemapApp.jsx` | Bostock's **zoomable treemap** (the frame `d3-js-uses.txt` assigns to file-system navigation) converted to **3D** on the platter: branches are trays, leaves are cuboids, area is value, houses wear category-10 colours (the original is monochrome — the one departure, stated on the page). Operated **bimodally**: a node's key targets it, **F** clicks it — a branch opens, a leaf brings its portion **out of the cuboid** as a rising drawer with a glyph and its information card in 3D space — and **D** goes back up the tree. The label alphabet skips D and F: operators are not addresses. Camera defaults to **isometric** about the platter's centre, with rotation/elevation parameters and a bounding-box toggle. Layout: `NCTGraphite`'s treemap module, a port of the notebook's binary tiling verified **bit-identical** against real d3-hierarchy on all 252 nodes. |
| `/sunburst-cylinder.html` | `src/sunburst-cylinder-main.jsx` → `src/SunburstCylinderApp.jsx` | The **zoomable sunburst as a cylinder**: the disc becomes a drum of wedge blocks standing on the platter, rings on its top face. Operated **bimodally** like the treemap: letter keys target a slice (alphabet skips D and F), **F** clicks it — a branch descends; a leaf's wedge **slides out of the drum** and its information card stands in 3D space at the pulled portion — and **D** goes back (retract, then climb). Isometric by default about the platter's centre, rotation/elevation parameters, bounding-box toggle, print index of the ten houses. Layout + palette: `NCTGraphite`'s sunburst module, reused unchanged. |

Routing is plain multi-page Vite (`appType: 'mpa'` in
`vite.config.js`): each `.html` page lives at its own URL on the same
server, no SPA fallback.

## Vendored copies

`NCTGraphite/` and `paramorphic-components/` are plain copies of the two
source repositories, vendored into this directory so they can be modified
here, separately from the originals:

| Directory | Source repository | Copied at commit |
| --- | --- | --- |
| `NCTGraphite/` | https://github.com/noctivagous/NCTGraphite | `d67a5d5` |
| `paramorphic-components/` | https://github.com/noctivagous/paramorphic-components | `eb2be5f` |

They are ordinary tracked files in this repo — no submodule init is needed
after cloning. The only omission: paramorphic-components' four
`web-artifacts/*.tar.gz` archives (78 KB of binary bundles) are not carried,
because this repo's upload path is text-only; they remain in the source repo.

Local additions to the NCTGraphite copy so far: the iGeo panelization
port (`packages/nctgraphite/src/panelization/`), the data-tree module
(`packages/nctgraphite/src/datatree/`) — Grasshopper's branch-path data
model with flatten / graft / simplify — and the tangled-tree layout
(`packages/nctgraphite/src/tangle/`), a verified port of Abrate's
`constructTangleLayout`.
