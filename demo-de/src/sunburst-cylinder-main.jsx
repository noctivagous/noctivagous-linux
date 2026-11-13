import React from 'react';
import { createRoot } from 'react-dom/client';
import SunburstCylinderApp from './SunburstCylinderApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SunburstCylinderApp />
  </React.StrictMode>,
);
