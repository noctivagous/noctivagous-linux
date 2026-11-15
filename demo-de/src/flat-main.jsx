import React from 'react';
import { createRoot } from 'react-dom/client';
import FlatApp from './FlatApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <FlatApp />
  </React.StrictMode>,
);
