import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// demo-de is a multi-page lab served by ONE Vite server:
//
//  - index.html      — the original vanilla key-clicks demo (sim.js /
//                      style.css). Left untouched; the dev server
//                      serves it as a plain page at `/`.
//  - react.html      — the React shell (src/main.jsx): grid-systems
//                      foundation + the panelization view.
//  - definition.html — the Grasshopper-style definition strip
//                      (src/definition-main.jsx).
//
// Pages are separate explorations in different directions; the ones
// that prove out get promoted into the main file later. `appType:
// 'mpa'` keeps each page at its own URL with no SPA fallback, and
// the build emits the two React pages (index.html stays a source
// file served by the dev server / any static host of the repo).
export default defineConfig({
  plugins: [react()],
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        react: fileURLToPath(new URL('./react.html', import.meta.url)),
        definition: fileURLToPath(new URL('./definition.html', import.meta.url)),
        tangled: fileURLToPath(new URL('./tangled.html', import.meta.url)),
        sunburst: fileURLToPath(new URL('./sunburst.html', import.meta.url)),
        horizon: fileURLToPath(new URL('./horizon.html', import.meta.url)),
        horizon3d: fileURLToPath(new URL('./horizon3d.html', import.meta.url)),
      },
    },
  },
});
