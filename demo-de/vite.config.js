import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { cpSync } from 'node:fs';
import { join } from 'node:path';

// The NCT Desktop root (index.html + styles/ + scripts/) is a plain
// static page, not a Rollup input — Vite never processes it. But the
// deployed site serves the BUILD OUTPUT, so without this copy step
// dist/ has no index.html and the host answers 404 at `/`. Copy the
// three static pieces into dist/ verbatim after every build; the
// sources stay unprocessed, builds still never overwrite them.
function copyDesktopRoot() {
  return {
    name: 'copy-desktop-root',
    apply: 'build',
    closeBundle() {
      const root = fileURLToPath(new URL('.', import.meta.url));
      const out = join(root, 'dist');
      cpSync(join(root, 'index.html'), join(out, 'index.html'));
      cpSync(join(root, 'styles'), join(out, 'styles'), { recursive: true });
      cpSync(join(root, 'scripts'), join(out, 'scripts'), { recursive: true });
    },
  };
}

// demo-de is a multi-page lab served by ONE Vite server:
//
//  - index.html      — NCT DESKTOP, the demo environment root:
//                      login screen + desktop (windows, terminal,
//                      settings, monitor). Plain static page —
//                      styles/nct-desktop.css + scripts/nct-desktop.js,
//                      no framework. Deliberately NOT a Vite build
//                      input, so builds never overwrite it; the dev
//                      server serves it as a plain page at `/`, and
//                      the copyDesktopRoot plugin below copies it
//                      verbatim into dist/ so the deployed site has
//                      an index.html at its root.
//  - index-demo-paramorphic-1.html — FLAT SPACE, the 2D environment
//                      view (src/flat-main.jsx): stationary panels +
//                      key-click frames, built from
//                      paramorphic-components. This was the root
//                      index.html until the NCT Desktop took the root;
//                      it stays a build input under its new name. The
//                      original vanilla key-clicks demo lives at
//                      index_fragment.html (sim.js / style.css).
//  - react.html      — the React shell (src/main.jsx): grid-systems
//                      foundation + the panelization view.
//  - definition.html — the Grasshopper-style definition strip
//                      (src/definition-main.jsx).
//
// Pages are separate explorations in different directions; the ones
// that prove out get promoted into the main file later. `appType:
// 'mpa'` keeps each page at its own URL with no SPA fallback.
export default defineConfig({
  plugins: [react(), copyDesktopRoot()],
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        flatSpace: fileURLToPath(new URL('./index-demo-paramorphic-1.html', import.meta.url)),
        react: fileURLToPath(new URL('./react.html', import.meta.url)),
        definition: fileURLToPath(new URL('./definition.html', import.meta.url)),
        tangled: fileURLToPath(new URL('./tangled.html', import.meta.url)),
        sunburst: fileURLToPath(new URL('./sunburst.html', import.meta.url)),
        horizon: fileURLToPath(new URL('./horizon.html', import.meta.url)),
        horizon3d: fileURLToPath(new URL('./horizon3d.html', import.meta.url)),
        treemap: fileURLToPath(new URL('./treemap.html', import.meta.url)),
        sunburstCylinder: fileURLToPath(new URL('./sunburst-cylinder.html', import.meta.url)),
        treemapCube: fileURLToPath(new URL('./treemap-cube.html', import.meta.url)),
        uiSpace: fileURLToPath(new URL('./ui-space/index.html', import.meta.url)),
        igeoLive: fileURLToPath(new URL('./igeo-live.html', import.meta.url)),
      },
    },
  },
});
