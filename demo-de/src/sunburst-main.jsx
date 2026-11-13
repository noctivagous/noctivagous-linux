import React from 'react';
import { createRoot } from 'react-dom/client';
import SunburstApp from './SunburstApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SunburstApp />
  </React.StrictMode>,
);
