import React from 'react';
import { createRoot } from 'react-dom/client';
import TreemapCubeApp from './TreemapCubeApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TreemapCubeApp />
  </React.StrictMode>,
);
