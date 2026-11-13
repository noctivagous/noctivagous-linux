# demo-de

The desktop-environment demo directory of noctivagous-linux. It holds two
things side by side:

## Vanilla demo
`index.html` + `sim.js` + `style.css` — the original full-viewport
key-clicks demo, a plain static page.

## React app
`react.html` + `src/` — a Vite + React app in the same directory.

```sh
npm install
npm run dev     # Vite dev server; open the /react.html page it serves
npm run build   # outputs dist/react.html
```

The vanilla `index.html` is deliberately not the Vite entry, so the two
never overwrite each other.

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
