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
