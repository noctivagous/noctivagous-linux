import React from 'react';
import { createRoot } from 'react-dom/client';
import TangledApp from './TangledApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TangledApp />
  </React.StrictMode>,
);
