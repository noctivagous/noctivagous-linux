import React from 'react';
import { createRoot } from 'react-dom/client';
import Horizon3DApp from './Horizon3DApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Horizon3DApp />
  </React.StrictMode>,
);
