import React from 'react';
import { createRoot } from 'react-dom/client';
import SpaceApp from './SpaceApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SpaceApp />
  </React.StrictMode>,
);
