import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// demo-de is two things at once:
//  - index.html — the original vanilla key-clicks demo (sim.js / style.css),
//    served as a plain static page and left untouched by this build.
//  - react.html — the React app entry (src/main.jsx), built by Vite.
// Keeping the React entry under its own name is what lets both coexist.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        react: fileURLToPath(new URL('./react.html', import.meta.url)),
      },
    },
  },
});
