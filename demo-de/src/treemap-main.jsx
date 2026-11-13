import React from 'react';
import { createRoot } from 'react-dom/client';
import TreemapApp from './TreemapApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TreemapApp />
  </React.StrictMode>,
);
