import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// demo-de is a multi-page lab served by ONE Vite server:
//
//  - index.html      — NCT DESKTOP, the demo environment root:
//                      login screen + desktop (windows, terminal,
//                      settings, monitor), now a React app
//                      (src/desktop-main.jsx; architecture in
//                      DESKTOP-ARCHITECTURE.md) with the iGeo
//                      panelization backdrop and key-clicks as its
//                      default input mode.
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
  plugins: [react()],
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
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
